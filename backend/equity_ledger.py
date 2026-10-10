"""Pure account evidence and cash-flow-aware risk accounting.

Inputs are authenticated broker responses, never browser-supplied P/L.  The
caller must paginate *all* activity types (including non-trade activities).
Equity marks must carry their actual valuation time, not the API request time.
No network, database, wall clock, or application imports occur here.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from zoneinfo import ZoneInfo


NY = ZoneInfo("America/New_York")
SCHEMA_VERSION = 1
EXTERNAL = {"CSD", "CSW", "JNLC"}
OPERATING = {"FEE", "CFEE", "DIV", "DIVCGL", "DIVCGS", "DIVNRA", "INT"}
KNOWN_TYPES = EXTERNAL | OPERATING | {"FILL", "SPLIT"}
ZERO = Decimal("0")


class EquityEvidenceError(ValueError):
    """Evidence is malformed or does not belong to this ledger scope."""


def _decimal(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise EquityEvidenceError("invalid_number") from exc
    if not result.is_finite():
        raise EquityEvidenceError("nonfinite_number")
    return result


def _instant(value):
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError) as exc:
        raise EquityEvidenceError("invalid_timestamp") from exc
    if result.tzinfo is None:
        raise EquityEvidenceError("timestamp_requires_timezone")
    return result.astimezone(timezone.utc)


def _iso(value):
    return _instant(value).isoformat()


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def scope_identity(account_id, mode):
    account = str(account_id or "").strip()
    mode = "real" if mode == "live" else str(mode or "").lower()
    if not account or mode not in {"paper", "real"}:
        raise EquityEvidenceError("account_and_valid_mode_required")
    return {"account_hash": _digest(account), "mode": mode}


def _mark(raw):
    mark = {"as_of": _iso(raw.get("as_of")), "equity": str(_decimal(raw.get("equity")))}
    if _decimal(mark["equity"]) < 0:
        raise EquityEvidenceError("negative_equity")
    return mark


def normalize_activities(activities):
    """Deduplicate activity IDs; a full later fetch can correct an existing ID.

    Date-only cash flows retain their uncertainty.  A journal cash activity is
    not assumed to be a deposit unless explicitly classified by the caller.
    ``external_cashflow`` is a server-owned classification, not a broker field.
    """
    if not isinstance(activities, list):
        raise EquityEvidenceError("activities_must_be_list")
    rows = {}
    for raw in activities:
        if not isinstance(raw, dict):
            raise EquityEvidenceError("invalid_activity")
        identity = str(raw.get("id") or "").strip()
        kind = str(raw.get("activity_type") or "").upper()
        if not identity or kind not in KNOWN_TYPES:
            raise EquityEvidenceError("missing_activity_id_or_unknown_type")
        when = raw.get("effective_at") or raw.get("transaction_time") or raw.get("date")
        date_only = isinstance(when, str) and len(when) == 10
        if date_only:
            try:
                datetime.strptime(when, "%Y-%m-%d")
            except ValueError as exc:
                raise EquityEvidenceError("invalid_activity_date") from exc
        else:
            when = _iso(when)
        row = {"id": identity, "type": kind, "at": when, "date_only": date_only}
        if kind in {"FILL", "SPLIT"}:
            qty = _decimal(raw.get("qty"))
            symbol = str(raw.get("symbol") or "").strip()
            if not symbol or (kind == "FILL" and qty <= 0):
                raise EquityEvidenceError("invalid_fill_or_split")
            row.update(symbol=symbol, qty=str(qty))
        if kind == "FILL":
            price = _decimal(raw.get("price"))
            side = str(raw.get("side") or "").lower()
            if side not in {"buy", "sell"} or price <= 0 or date_only:
                raise EquityEvidenceError("invalid_fill")
            row.update(price=str(price), side=side, order_id=str(raw.get("order_id") or ""))
        else:
            row["amount"] = str(_decimal(raw.get("net_amount", "0") if kind == "SPLIT" else raw.get("net_amount")))
            if kind == "CSD" and _decimal(row["amount"]) < 0:
                raise EquityEvidenceError("deposit_has_negative_amount")
            if kind == "CSW" and _decimal(row["amount"]) > 0:
                raise EquityEvidenceError("withdrawal_has_positive_amount")
            if kind == "SPLIT" and _decimal(row["amount"]) != 0:
                raise EquityEvidenceError("split_cash_requires_explicit_classification")
            if kind == "JNLC" and raw.get("external_cashflow") is not True:
                raise EquityEvidenceError("journal_cash_classification_unknown")
            if raw.get("order_id"):
                row["order_id"] = str(raw["order_id"])
        if kind in EXTERNAL and raw.get("equity_before") is not None:
            if date_only:
                raise EquityEvidenceError("cashflow_valuation_requires_timestamp")
            row["equity_before"] = str(_decimal(raw["equity_before"]))
        if identity in rows and rows[identity] != row:
            raise EquityEvidenceError("conflicting_activity_id_in_fetch")
        rows[identity] = row
    return rows


def _between(flow, left, right):
    """Return inclusion and timing certainty for a valuation interval."""
    if flow["date_only"]:
        day = flow["at"]
        ld, rd = left.astimezone(NY).date().isoformat(), right.astimezone(NY).date().isoformat()
        if day < ld or day > rd:
            return False, True
        # A posting date cannot say on which side of an intraday mark cash moved.
        return ld < day <= rd, False
    return left < _instant(flow["at"]) <= right, True


def _interval(left, right, flows):
    start, end = _instant(left["as_of"]), _instant(right["as_of"])
    selected, certain = [], True
    for flow in flows:
        include, known = _between(flow, start, end)
        certain = certain and known
        if include:
            selected.append(flow)
    external = sum((_decimal(f["amount"]) for f in selected), ZERO)
    pnl = _decimal(right["equity"]) - _decimal(left["equity"]) - external
    result = {"pnl": pnl if certain else None, "return": None, "reason": None}
    if not certain:
        result["reason"] = "cashflow_timing_unknown"
        return result
    current, factor = _decimal(left["equity"]), Decimal("1")
    if current <= 0:
        result["reason"] = "nonpositive_return_baseline"
        return result
    for flow in sorted(selected, key=lambda item: (item["at"], item["id"])):
        if "equity_before" not in flow:
            result["reason"] = "cashflow_valuation_missing"
            return result
        before = _decimal(flow["equity_before"])
        if before < 0 or current <= 0:
            result["reason"] = "invalid_cashflow_valuation"
            return result
        factor *= before / current
        current = before + _decimal(flow["amount"])
    if current <= 0:
        result["reason"] = "nonpositive_return_baseline"
        return result
    factor *= _decimal(right["equity"]) / current
    result["return"] = factor - 1
    return result


def _accounting(rows, equity, opening_equity, attribution, strategy_version, costs_complete, external_operating_costs):
    external = fees = income = fill_cash = ZERO
    inventory, attributed = {}, []
    fills = []
    unassigned_cost = False
    attributed_income = ZERO
    for row in rows.values():
        kind = row["type"]
        if kind in EXTERNAL:
            external += _decimal(row["amount"])
        elif kind in OPERATING:
            amount = _decimal(row["amount"])
            if kind in {"FEE", "CFEE"}:
                fees += amount
                unassigned_cost |= not bool(attribution.get(row.get("order_id", "")))
            else:
                income += amount
            if attribution.get(row.get("order_id", "")) == strategy_version:
                attributed_income += amount
            else:
                unassigned_cost = True
        if kind in {"FILL", "SPLIT"}:
            sign = -1 if row.get("side") == "sell" else 1
            inventory[row["symbol"]] = inventory.get(row["symbol"], ZERO) + sign * _decimal(row["qty"])
        if kind == "FILL":
            amount = _decimal(row["qty"]) * _decimal(row["price"]) * (1 if row["side"] == "sell" else -1)
            fill_cash += amount
            fills.append(row)
            if attribution.get(row.get("order_id", "")) == strategy_version:
                attributed.append((row, amount))
    net = equity - opening_equity - external
    flat = not any(abs(qty) > Decimal("0.00000001") for qty in inventory.values())
    all_attributed = bool(fills) and all(attribution.get(row.get("order_id", "")) for row in fills)
    whole_book_attributed = bool(fills) and len(attributed) == len(fills)
    external_costs = None if external_operating_costs is None else _decimal(external_operating_costs)
    if external_costs is not None and external_costs < 0:
        raise EquityEvidenceError("external_operating_costs_must_be_nonnegative")
    # Cash from sales minus purchases is not realized P/L when inventory is open.
    return {
        "external_cashflow": float(external), "account_net_operating_pnl": float(net),
        "fees": float(fees) if costs_complete else None, "income": float(income),
        "gross_fill_cashflow": float(fill_cash),
        "gross_closed_book_pnl": float(fill_cash) if flat else None,
        "gross_operating_pnl": float(net - fees) if costs_complete else None,
        "external_operating_costs": None if external_costs is None else float(external_costs),
        "net_operating_profit": float(net - external_costs) if costs_complete and external_costs is not None else None,
        "costs_known": costs_complete, "inventory_flat": flat,
        "inventory": {s: float(q) for s, q in inventory.items() if q},
        "fill_count": len(fills), "activity_count": len(rows),
        "strategy_attribution_known": all_attributed,
        "strategy_attributed_fill_count": len(attributed),
        "strategy_gross_fill_cashflow": float(sum((amount for _, amount in attributed), ZERO)),
        "strategy_net_operating_pnl": float(fill_cash + attributed_income - external_costs) if whole_book_attributed and flat and costs_complete and not unassigned_cost and external_costs is not None else None,
        "strategy_net_unknown_reason": None if whole_book_attributed and flat and costs_complete and not unassigned_cost and external_costs is not None else "strategy_marks_or_cost_allocation_missing",
    }


def reconcile_equity_evidence(
    previous=None, *, account_id, mode, strategy_version, snapshot, activities,
    coverage, equity_history=None, order_attribution=None, opening_equity=0,
    drawdown_limit_pct=12, daily_loss_limit_pct=1.5, external_operating_costs=None,
):
    """Reconcile a complete broker fetch without losing a previous safety latch.

    ``coverage`` requires complete, pagination_complete, full_history and a
    timezone-aware as_of. ``costs_complete`` is separate from history coverage.
    Full-history deletions require authoritative_replacement=True; ordinary
    pagination regressions must not silently erase fills. Corrections to an
    existing ID recompute all historical metrics, but never clear a risk latch.

    An exact TWR around transfers requires equity_before at each transfer.
    Unknown timing/valuations fail closed rather than fabricating a return.
    The prior NY session's valuation mark is required for the daily loss gate.
    """
    identity = scope_identity(account_id, mode)
    strategy_version = str(strategy_version or "").strip()
    if not strategy_version:
        raise EquityEvidenceError("strategy_version_required")
    prior = deepcopy(previous or {})
    if prior and prior.get("scope") != identity:
        raise EquityEvidenceError("ledger_scope_mismatch")
    limit, daily_limit = _decimal(drawdown_limit_pct), _decimal(daily_loss_limit_pct)
    if not ZERO < limit <= 100 or not ZERO < daily_limit <= 100:
        raise EquityEvidenceError("invalid_risk_limits")
    state = prior or {"schema_version": SCHEMA_VERSION, "scope": identity, "activities": {}, "marks": [], "strategies": {}}
    old_risk = state.get("risk") or {}
    risk = {"entry_allowed": False, "complete": False, "as_of": None,
            "daily_pnl": None, "daily_loss_pct": None, "drawdown_pct": old_risk.get("drawdown_pct"),
            "drawdown_latched": bool(old_risk.get("drawdown_latched")), "latched_at": old_risk.get("latched_at"),
            "drawdown_limit_pct": float(min(limit, _decimal(old_risk.get("drawdown_limit_pct", limit)))),
            "daily_loss_limit_pct": float(daily_limit), "reasons": []}
    state["risk"] = risk
    state["last_attempt_coverage"] = deepcopy(coverage) if isinstance(coverage, dict) else {}
    try:
        current = _mark(snapshot)
        risk["as_of"] = current["as_of"]
        if not isinstance(coverage, dict) or not all(coverage.get(k) is True for k in ("complete", "pagination_complete", "full_history")):
            raise EquityEvidenceError("activity_history_incomplete")
        delta = (_instant(current["as_of"]) - _instant(coverage.get("as_of"))).total_seconds()
        if abs(delta) > 120:
            raise EquityEvidenceError("activity_snapshot_time_mismatch")
        if state.get("marks") and _instant(current["as_of"]) < _instant(state["marks"][-1]["as_of"]):
            raise EquityEvidenceError("out_of_order_snapshot")
        rows = normalize_activities(activities)
        for row in rows.values():
            if (row['date_only'] and row['at'] > _instant(current['as_of']).astimezone(NY).date().isoformat()) or (not row['date_only'] and _instant(row['at']) > _instant(current['as_of'])):
                raise EquityEvidenceError('future_account_activity')
        missing = set(state.get("activities", {})) - set(rows)
        if missing and coverage.get("authoritative_replacement") is not True:
            raise EquityEvidenceError("activity_history_regressed")
        marks = {m["as_of"]: m for m in state.get("marks", [])}
        for mark in equity_history or []:
            normalized = _mark(mark)
            if _instant(normalized["as_of"]) > _instant(current["as_of"]):
                raise EquityEvidenceError("future_equity_mark")
            marks[normalized["as_of"]] = normalized
        marks[current["as_of"]] = current
        ordered = sorted(marks.values(), key=lambda m: _instant(m["as_of"]))
        if prior.get("opening_equity") is not None and _decimal(prior["opening_equity"]) != _decimal(opening_equity):
            raise EquityEvidenceError("opening_equity_changed")
        flows = [row for row in rows.values() if row["type"] in EXTERNAL and _decimal(row["amount"]) != 0]
        factor = peak = Decimal("1")
        max_dd = ZERO
        return_known = len(ordered) >= 2
        return_reasons = set()
        for left, right in zip(ordered, ordered[1:]):
            interval = _interval(left, right, flows)
            if interval["return"] is None:
                return_known = False
                return_reasons.add(interval["reason"] or "return_unknown")
                continue
            if return_known:
                factor *= 1 + interval["return"]
                peak = max(peak, factor)
                max_dd = max(max_dd, (peak - factor) / peak * 100)
        today = _instant(current["as_of"]).astimezone(NY).date()
        daily_baseline = coverage.get("daily_baseline_as_of")
        closes = [mark for mark in ordered if _instant(mark["as_of"]).astimezone(NY).date() < today]
        if daily_baseline:
            closes = [mark for mark in closes if _instant(mark["as_of"]) == _instant(daily_baseline)]
        else:
            # An arbitrary observation yesterday is not yesterday's close.
            closes = [mark for mark in closes if (_instant(mark["as_of"]).astimezone(NY).hour,
                                                  _instant(mark["as_of"]).astimezone(NY).minute) == (16, 0)]
        closes = [mark for mark in closes if (_instant(current["as_of"]) - _instant(mark["as_of"])).total_seconds() <= 4 * 86400]
        if closes:
            close = closes[-1]
            interval = _interval(close, current, flows)
            if interval["pnl"] is not None and _decimal(close["equity"]) > 0:
                risk["daily_pnl"] = float(interval["pnl"])
                risk["daily_loss_pct"] = float(max(ZERO, -interval["pnl"]) / _decimal(close["equity"]) * 100)
        if return_known:
            risk["drawdown_pct"] = float((peak - factor) / peak * 100)
            state["twr_pct"] = float((factor - 1) * 100)
            state["max_drawdown_pct"] = float(max_dd)
            if max_dd >= _decimal(risk["drawdown_limit_pct"]):
                risk["drawdown_latched"] = True
                risk["latched_at"] = risk["latched_at"] or current["as_of"]
        else:
            risk["drawdown_pct"] = None
            state["twr_pct"] = None
            risk["reasons"].extend(sorted(return_reasons) or ["return_baseline_missing"])
        costs_complete = coverage.get("costs_complete") is True
        state["accounting"] = _accounting(rows, _decimal(current["equity"]), _decimal(opening_equity), order_attribution or {}, strategy_version, costs_complete, external_operating_costs)
        state['accounting_as_of'] = current['as_of']
        state.update(activities=rows, marks=ordered, opening_equity=str(_decimal(opening_equity)), coverage=deepcopy(coverage))
        state["strategies"][strategy_version] = {"as_of": current["as_of"], "accounting": deepcopy(state["accounting"])}
        if not costs_complete:
            risk["reasons"].append("cost_evidence_incomplete")
        if risk["daily_pnl"] is None:
            risk["reasons"].append("daily_pnl_unknown")
        if risk["daily_loss_pct"] is not None and risk["daily_loss_pct"] >= float(daily_limit):
            risk["reasons"].append("daily_loss_limit")
        if risk["drawdown_latched"]:
            risk["reasons"].append("drawdown_latched")
        risk["complete"] = return_known and costs_complete and risk["daily_pnl"] is not None
        risk["entry_allowed"] = risk["complete"] and not risk["reasons"]
    except (EquityEvidenceError, TypeError, KeyError) as exc:
        risk["reasons"] = [str(exc) if isinstance(exc, EquityEvidenceError) else "malformed_evidence"]
        if risk["drawdown_latched"]:
            risk["reasons"].append("drawdown_latched")
    state["evidence_digest"] = _digest({"activities": state.get("activities"), "marks": state.get("marks"), "risk": risk})
    return state
