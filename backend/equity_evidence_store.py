"""Durable equity evidence over the existing user-scoped OperationsStore.

Account/mode safety is deliberately independent of strategy version.  Strategy
evidence lives inside that artifact so a version switch cannot reset a latch.
All broker I/O is optional and injected; importing this module has no side effects.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json

from equity_ledger import EquityEvidenceError, reconcile_equity_evidence, scope_identity, _instant
from operations_store import OperationsStoreError, OperationsVersionConflict


ARTIFACT_TYPE = "equity_account_evidence"


def _blocked(reason, *, as_of=None):
    return {"entry_allowed": False, "complete": False, "as_of": as_of,
            "daily_pnl": None, "daily_loss_pct": None, "drawdown_pct": None,
            "drawdown_latched": False, "latched_at": None, "reasons": [reason]}


def fetch_broker_activities(get_activities, *, as_of, max_pages=100, page_size=100, costs_complete=False):
    """Fetch every activity type from origin with explicit completeness evidence.

    ``get_activities(params)`` returns ``(http_status, JSON_payload)``. Use the
    authenticated account-specific /v2/account/activities endpoint. It must not
    inject an after/date/type filter, omit non-trades, or follow another account.
    No retry conceals a failed page. The partial rows remain diagnostic only.
    ``costs_complete`` is an explicit caller assertion, not inferred from HTTP200.
    """
    coverage = {"complete": False, "pagination_complete": False, "full_history": False,
                "as_of": as_of, "costs_complete": bool(costs_complete), "pages": 0,
                "fetched_count": 0, "error": None}
    rows, token, seen_tokens = [], None, set()
    if not isinstance(max_pages, int) or not isinstance(page_size, int) or max_pages < 1 or not 1 <= page_size <= 100:
        coverage["error"] = "invalid_pagination_limits"
        return {"activities": rows, "coverage": coverage}
    try:
        _instant(as_of)
        for _ in range(max_pages):
            params = {"direction": "asc", "page_size": page_size, "until": as_of}
            if token:
                params["page_token"] = token
            status, payload = get_activities(params)
            coverage["pages"] += 1
            if status != 200 or not isinstance(payload, list):
                coverage["error"] = "activity_http_%s" % status if status != 200 else "activity_response_not_list"
                break
            if len(payload) > page_size or any(not isinstance(row, dict) or not row.get("id") for row in payload):
                coverage["error"] = "invalid_activity_page"
                break
            rows.extend(payload)
            coverage["fetched_count"] = len(rows)
            if len(payload) < page_size:
                coverage.update(complete=True, pagination_complete=True, full_history=True)
                break
            token = str(payload[-1]["id"])
            if token in seen_tokens:
                coverage["error"] = "activity_cursor_repeated"
                break
            seen_tokens.add(token)
        else:
            coverage["error"] = "activity_page_limit"
    except Exception as exc:
        # Do not persist exception messages: HTTP clients may include credentials.
        coverage["error"] = "activity_fetch_%s" % type(exc).__name__
    return {"activities": rows, "coverage": coverage}


class EquityEvidenceStore:
    def __init__(self, operations_store):
        self.store = operations_store

    @staticmethod
    def artifact_key(account_id, mode):
        identity = scope_identity(account_id, mode)
        return "%s:%s" % (identity["mode"], identity["account_hash"])

    def reconcile(self, user_id, *, account_id, mode, strategy_version, **evidence):
        """CAS the canonical ledger before returning entry permission.

        A conflict is retried against the winning state, so a concurrent risk
        latch cannot be overwritten by a previously fetched healthy snapshot.
        Storage failures never return an entry permission computed in memory.
        """
        key = self.artifact_key(account_id, mode)
        for _ in range(3):
            try:
                current = self.store.get_artifact(user_id, ARTIFACT_TYPE, key)
                previous = (current or {}).get("payload")
                state = reconcile_equity_evidence(previous, account_id=account_id, mode=mode,
                                                  strategy_version=strategy_version, **evidence)
                digest = hashlib.sha256(json.dumps(state, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
                row = self.store.put_artifact(user_id, ARTIFACT_TYPE, key, payload=state,
                                              idempotency_key="equity:" + digest,
                                              expected_version=int((current or {}).get("version") or 0))
                result = deepcopy(row["payload"])
                result["durable_version"] = row["version"]
                return result
            except OperationsVersionConflict:
                continue
            except (OperationsStoreError, EquityEvidenceError, TypeError, ValueError):
                return {"risk": _blocked("equity_evidence_store_unavailable")}
        return {"risk": _blocked("equity_evidence_version_conflict")}

    def read_risk(self, user_id, *, account_id, mode, strategy_version, now=None, max_age_seconds=120):
        """Read the persisted gate; never infer healthy state from an empty row."""
        try:
            key = self.artifact_key(account_id, mode)
            row = self.store.get_artifact(user_id, ARTIFACT_TYPE, key)
            state = (row or {}).get("payload") or {}
            if not state:
                return _blocked("equity_evidence_missing")
            if state.get("scope") != scope_identity(account_id, mode):
                return _blocked("equity_evidence_scope_mismatch")
            risk = deepcopy(state.get("risk") or _blocked("equity_evidence_missing"))
            reason = None
            if strategy_version not in (state.get("strategies") or {}):
                reason = "strategy_evidence_missing"
            age = (_instant(now or datetime.now(timezone.utc).isoformat()) - _instant(risk.get("as_of"))).total_seconds()
            if age < -5 or age > max_age_seconds:
                reason = "equity_evidence_stale"
            if reason:
                risk["entry_allowed"] = False
                risk["complete"] = False
                risk.setdefault("reasons", []).append(reason)
            return risk
        except (OperationsStoreError, EquityEvidenceError, TypeError, ValueError):
            return _blocked("equity_evidence_store_unavailable")
