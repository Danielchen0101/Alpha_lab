"""User-scoped immutable research artifacts; read-only injected data transport.

The HTTP/UI layer can request freeze and run, but cannot submit passing results.
The first replay seals the dataset and consumes the holdout even on failure. A new
candidate requires a new externally reviewed research version, not tuning the
same holdout until it passes. No trading account writes occur in this service.
"""
from datetime import datetime, time, timedelta, timezone
import uuid
import json
from pathlib import Path

from equity_data import (EQUITY_DATA_VERSION, content_hash, dataset_hash,
                         read_corporate_actions, read_sip_history, CachedReadTransport, CollectionPending,
                         collect_quote_archives, reconcile_action_adjustments)
from equity_program import ETF_GROUPS
from equity_research import evaluate_admission, make_protocol, protocol_valid, run_research
from equity_strategy import NEW_YORK, parse_time


class EquityResearchService:
    def __init__(self, store):
        self.store = store

    def freeze(self, uid, strategy="breakout20", universe=None, periods=None, now=None):
        current = self.store.get_artifact(uid, "equity_research_active", "v1")
        if current:
            raise ValueError("candidate_already_frozen_for_v1")
        protocol = make_protocol(strategy, universe, periods, now)
        key = protocol["protocolKey"]
        self.store.put_artifact(uid, "equity_research_protocol", key, payload=protocol,
                                idempotency_key="freeze:" + key, expected_version=0)
        self.store.put_artifact(uid, "equity_research_active", "v1", payload={"protocolKey": key},
                                idempotency_key="activate:" + key, expected_version=0)
        return protocol

    def status(self, uid, protocol_key=None):
        if not protocol_key:
            active = self.store.get_artifact(uid, "equity_research_active", "v1")
            protocol_key = (active or {}).get("payload", {}).get("protocolKey")
        record = self.store.get_artifact(uid, "equity_research_protocol", protocol_key) if protocol_key else None
        protocol = (record or {}).get("payload")
        if not protocol:
            return {"status": "not_frozen", "protocol": None, "protocolKey": None, "result": None,
                    "admission": evaluate_admission(None)}
        if not protocol_valid(protocol):
            return {"status": "failed", "protocol": None, "protocolKey": protocol_key, "result": None,
                    "admission": {"eligible": False, "historicalEligible": False, "blockers": ["frozen_protocol_integrity_failed"], "checks": {}}}
        result_row = self.store.get_artifact(uid, "equity_research_result", protocol_key)
        result = (result_row or {}).get("payload")
        claim = self.store.get_artifact(uid, "equity_research_run", protocol_key)
        qualification_row = self.store.get_artifact(uid, "equity_qualification", protocol_key)
        qualification = (qualification_row or {}).get("payload")
        audit_row = self.store.get_artifact(uid, "equity_forward_audit", protocol_key)
        if qualification:
            qualification = {**qualification, "forwardAudit": (audit_row or {}).get("payload") or {}}
        admission = evaluate_admission(result, qualification)
        state = "complete" if admission["historicalEligible"] else "insufficient" if result else (claim or {}).get("payload", {}).get("status", "frozen")
        lease = parse_time((claim or {}).get("payload", {}).get("leaseUntil"))
        if state == "running" and lease and lease < datetime.now(timezone.utc) and (claim or {}).get("payload", {}).get("holdoutOpened") is False:
            state = "collecting"
        return {"status": state, "protocolKey": protocol_key, "protocol": protocol, "result": result, "admission": admission,
                "run": (claim or {}).get("payload"), "qualification": qualification, "forwardAudit": (audit_row or {}).get("payload")}

    def qualify(self, uid, protocol_key):
        from equity_qualification import build_qualification
        status = self.status(uid, protocol_key)
        if not status["admission"].get("historicalEligible"):
            return None
        exploratory_row = self.store.get_artifact(uid, "equity_shadow", protocol_key)
        exploratory = (exploratory_row or {}).get("payload") or {}
        prior = self.store.get_artifact(uid, "equity_qualification", protocol_key)
        if prior and exploratory.get("evidenceCorrections"):
            result = {**prior["payload"], "evidenceCorrections": exploratory["evidenceCorrections"],
                      "state": {**prior["payload"]["state"], "riskPaused": True, "valuationStale": True}}
        else:
            result = build_qualification(status["result"], exploratory)
        if not result:
            return None
        if prior and prior["payload"]["qualification"] != result["qualification"]:
            raise ValueError("qualification_identity_cannot_be_reset")
        self.store.put_artifact(uid, "equity_qualification", protocol_key, payload=result,
                                idempotency_key=content_hash(result), expected_version=int((prior or {}).get("version", 0)))
        return result

    def audit_forward(self, uid, protocol_key, fetch_page, *, now=None, cache_dir, max_requests=10):
        from equity_qualification import audit_qualification_quotes
        qualification = self.store.get_artifact(uid, "equity_qualification", protocol_key)
        if not qualification:
            return None
        proof = audit_qualification_quotes(qualification["payload"], fetch_page,
                                          now=now or datetime.now(timezone.utc).isoformat(), cache_dir=cache_dir, max_requests=max_requests)
        if proof.get("status") == "collecting":
            current = self.store.get_artifact(uid, "equity_forward_audit_progress", protocol_key)
            self.store.put_artifact(uid, "equity_forward_audit_progress", protocol_key, payload=proof,
                                    idempotency_key=content_hash(proof), expected_version=int((current or {}).get("version", 0)))
            return proof
        current = self.store.get_artifact(uid, "equity_forward_audit", protocol_key)
        self.store.put_artifact(uid, "equity_forward_audit", protocol_key, payload=proof,
                                idempotency_key=content_hash(proof), expected_version=int((current or {}).get("version", 0)))
        return proof

    def run(self, uid, protocol_key, fetch_page, fetch_calendar, now=None, *, mode="full", cache_dir=None, max_requests=120):
        status = self.status(uid, protocol_key)
        protocol = status.get("protocol")
        if not protocol or status.get("status") not in ("frozen", "collecting"):
            raise ValueError("research_requires_frozen_unopened_protocol")
        clock = parse_time(now) if now else datetime.now(timezone.utc)
        if not clock or clock < parse_time(protocol["frozenAt"]):
            raise ValueError("run_precedes_freeze")
        if mode == "probe":
            # Probe only the training interval. No holdout performance is opened.
            probe = self._build_dataset(protocol, fetch_page, fetch_calendar, clock, probe=True)
            payload = {"status": "data_probe_only", "protocolHash": protocol["protocolHash"], "manifest": probe["manifest"], "coverage": probe["coverage"], "holdoutOpened": False}
            self.store.put_artifact(uid, "equity_research_probe", protocol_key, payload=payload, idempotency_key=content_hash(payload))
            return {**self.status(uid, protocol_key), "probe": payload}
        if mode != "full" or not cache_dir:
            raise ValueError("full_research_requires_server_owned_persistent_cache")
        transport = CachedReadTransport(fetch_page, cache_dir, max_requests=max_requests)
        calendar_transport = CachedReadTransport(lambda _path, params: fetch_calendar(params["start"], params["end"]), cache_dir, max_requests=1)
        claim_id = str(uuid.uuid4())
        current = self.store.get_artifact(uid, "equity_research_run", protocol_key)
        claim = self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                       payload={"status": "running", "startedAt": clock.isoformat(), "leaseUntil": (clock + timedelta(minutes=15)).isoformat(), "holdoutOpened": False, "protocolHash": protocol["protocolHash"]},
                                       idempotency_key=claim_id, expected_version=int((current or {}).get("version", 0)))
        replay_started = False
        try:
            dataset = self._build_dataset(protocol, transport,
                                          lambda start, end: calendar_transport("/v2/calendar", {"start": start, "end": end}), clock, probe=False)
            manifest_path = Path(cache_dir) / "dataset.json"
            if manifest_path.exists():
                archived = json.loads(manifest_path.read_text())
                if archived.get("dataHash") != dataset["dataHash"]:
                    raise ValueError("frozen_dataset_manifest_changed")
            else:
                with manifest_path.open("x", encoding="utf-8") as handle:
                    json.dump(dataset, handle, sort_keys=True, allow_nan=False)
            compact = {"dataHash": dataset["dataHash"], "coverage": dataset["coverage"], "manifest": dataset["manifest"], "protocolHash": protocol["protocolHash"]}
            self.store.put_artifact(uid, "equity_research_dataset", protocol_key, payload=compact,
                                    idempotency_key="dataset:" + dataset["dataHash"], expected_version=0)
            # Quote pages stay on disk, replay heap-merges one page per symbol.
            # Large workloads are handed to the offline streaming runner rather
            # than monopolizing a production web worker for hours.
            if dataset["manifest"].get("quoteRowCount", 0) > 250000:
                self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                        payload={"status": "data_ready_requires_offline_replay", "protocolHash": protocol["protocolHash"], "dataHash": dataset["dataHash"], "quoteRowCount": dataset["manifest"]["quoteRowCount"], "holdoutOpened": False},
                                        idempotency_key="ready:" + claim_id, expected_version=claim["version"])
                return self.status(uid, protocol_key)
            replay_started = True
            claim = self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                           payload={"status": "running", "openedAt": clock.isoformat(), "protocolHash": protocol["protocolHash"], "holdoutOpened": True},
                                           idempotency_key="open:" + claim_id, expected_version=claim["version"])
            result = run_research(dataset, protocol, archive_root=cache_dir)
            self.store.put_artifact(uid, "equity_research_result", protocol_key, payload=result,
                                    idempotency_key="result:" + result["artifactHash"], expected_version=0)
            self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                    payload={"status": "complete", "openedAt": clock.isoformat(), "protocolHash": protocol["protocolHash"], "dataHash": dataset["dataHash"]},
                                    idempotency_key="complete:" + claim_id, expected_version=claim["version"])
        except CollectionPending:
            self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                    payload={"status": "collecting", "protocolHash": protocol["protocolHash"], "pagesFetchedThisRun": transport.requests, "cachedPagesRead": transport.cache_hits, "holdoutOpened": False},
                                    idempotency_key="slice:" + claim_id, expected_version=claim["version"])
        except Exception as error:
            self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                    payload={"status": "failed" if replay_started else "collecting", "protocolHash": protocol["protocolHash"], "errorType": type(error).__name__, "holdoutConsumed": replay_started},
                                    idempotency_key="failed:" + claim_id, expected_version=claim["version"])
            raise
        return self.status(uid, protocol_key)


    def _build_dataset(self, protocol, fetch_page, fetch_calendar, clock, probe=False):
        period, symbols = dict(protocol["periods"]), sorted(set(protocol["symbols"]) | {"SPY"})
        if probe:
            period["end"] = (datetime.fromisoformat(period["holdoutStart"]) - timedelta(days=1)).date().isoformat()
        calendar = fetch_calendar(period["start"], period["end"])
        if not isinstance(calendar, list):
            raise ValueError("exchange_calendar_unavailable")
        sessions = [str(row.get("date")) if isinstance(row, dict) else str(row) for row in calendar]
        if not sessions or sessions != sorted(set(sessions)) or any(not period["start"] <= day <= period["end"] for day in sessions):
            raise ValueError("exchange_calendar_invalid")
        start = datetime.combine(datetime.fromisoformat(period["start"]).date(), time(), NEW_YORK)
        end = datetime.combine(datetime.fromisoformat(period["end"]).date() + timedelta(days=1), time(), NEW_YORK)
        end = min(end, clock - timedelta(minutes=16))
        bar_result, _cache = read_sip_history(fetch_page, symbols, start.isoformat(), end.isoformat(), now=clock, expected_sessions=sessions)
        actions, action_coverage = read_corporate_actions(fetch_page, symbols, period["start"], (parse_time(protocol["frozenAt"]) + timedelta(days=90)).date().isoformat())
        split_result, _ = read_sip_history(fetch_page, symbols, start.isoformat(), end.isoformat(), now=clock, adjustment="split", expected_sessions=sessions)
        all_result, _ = read_sip_history(fetch_page, symbols, start.isoformat(), end.isoformat(), now=clock, adjustment="all", expected_sessions=sessions)
        reconciliation = reconcile_action_adjustments(bar_result["rows"], split_result["rows"], all_result["rows"], actions)
        # A probe uses two training sessions only; full mode archives every
        # regular-session quote page in the frozen holdout interval.
        eligible = sessions[-2:] if probe else []
        sample = sorted({eligible[index * (len(eligible) - 1) // min(23, len(eligible) - 1)] for index in range(min(24, len(eligible)))}) if len(eligible) > 1 else eligible
        quotes, windows, quote_issues = {symbol: [] for symbol in symbols}, [], []
        for day in sample:
            at = datetime.combine(datetime.fromisoformat(day).date(), time(9, 30), NEW_YORK)
            try:
                response, _cache = read_sip_history(fetch_page, symbols, at.isoformat(), (at + timedelta(minutes=2)).isoformat(),
                                                   now=clock, kind="quotes", max_pages=4)
                for symbol in symbols:
                    quotes[symbol].extend(response["rows"][symbol])
                windows.append({"start": at.isoformat(), "end": (at + timedelta(minutes=2)).isoformat(), "pageCount": response["pageCount"]})
            except ValueError as error:
                quote_issues.append({"session": day, "issue": str(error)})
        # Numeric sizes are conservative minimum shares across the provider's
        # 2025 display transition. Do not multiply historical values by 100.
        archives, archive_coverage = ({}, {}) if probe else collect_quote_archives(fetch_page, symbols, calendar, period["holdoutStart"], period["holdoutEnd"], now=clock)
        dataset = {"dataVersion": EQUITY_DATA_VERSION, "barAdjustment": "raw", "sessions": sessions,
                   "marketSessions": {str(row["date"]): {"open": row.get("open"), "close": row.get("close")} for row in calendar if isinstance(row, dict)},
                   "bars": bar_result["rows"], "quotes": quotes, "quoteArchives": archives, "universe": {day: protocol["symbols"] for day in sessions},
                   "corporateActions": actions, "symbolGroups": {symbol: ETF_GROUPS[symbol] for symbol in symbols},
                   "coverage": {"barsComplete": bar_result["coverage"]["complete"], "quotesComplete": not probe and archive_coverage.get("paginationComplete") is True,
                                "corporateActionsComplete": reconciliation["complete"] and not any(event.get("type") == "unsupported" for event in actions),
                                "pointInTimeUniverse": period["start"] >= "2016-01-01" and all(symbol in ETF_GROUPS for symbol in protocol["symbols"]), "calendarVerified": True,
                                "quoteSizesInShares": True},
                   "manifest": {"protocolHash": protocol["protocolHash"], "bars": bar_result["coverage"], "actions": action_coverage,
                                "quoteWindows": windows, "quoteIssues": quote_issues, "adjustmentReconciliation": reconciliation, "quoteRowCount": archive_coverage.get("rowCount", sum(len(rows) for rows in quotes.values())), "quoteArchivePages": archive_coverage.get("pageCount", 0),
                                "universeBasis": "Immutable eight-ETF research basket only; no current-stock screener or historical index-membership claim; instruments predate 2016",
                                "quoteSizeBasis": "Reported numeric sizes treated as conservative minimum shares across 2025-11-03 display transition; no lot multiplication",
                                "limitation": "Training-only probe; no holdout performance" if probe else "Full regular-session SIP pages; company actions cross-checked against raw/split/total adjustment transitions",
                                "protocolFrozenAt": protocol["frozenAt"]}}
        dataset["dataHash"] = dataset_hash(dataset)
        return dataset

    def replay_archived(self, uid, protocol_key, cache_dir):
        """Dedicated research-worker entry; never accepts a submitted result.

        The worker recomputes all trials from the frozen server-side archive.
        This may be lengthy; HTTP workers should only run collection slices.
        """
        status = self.status(uid, protocol_key)
        if status["status"] != "data_ready_requires_offline_replay":
            raise ValueError("immutable_archive_not_ready_for_replay")
        stored = self.store.get_artifact(uid, "equity_research_dataset", protocol_key)
        dataset = json.loads((Path(cache_dir) / "dataset.json").read_text())
        if dataset.get("dataHash") != dataset_hash(dataset) or dataset["dataHash"] != stored["payload"]["dataHash"]:
            raise ValueError("server_archive_manifest_integrity_failed")
        current = self.store.get_artifact(uid, "equity_research_run", protocol_key)
        request = str(uuid.uuid4())
        claim = self.store.put_artifact(uid, "equity_research_run", protocol_key,
                                       payload={"status": "running", "protocolHash": status["protocol"]["protocolHash"], "holdoutOpened": True},
                                       idempotency_key=request, expected_version=current["version"])
        try:
            result = run_research(dataset, status["protocol"], archive_root=cache_dir)
            self.store.put_artifact(uid, "equity_research_result", protocol_key, payload=result,
                                    idempotency_key="result:" + result["artifactHash"], expected_version=0)
            self.store.put_artifact(uid, "equity_research_run", protocol_key, payload={"status": "complete", "dataHash": dataset["dataHash"]},
                                    idempotency_key="done:" + request, expected_version=claim["version"])
        except Exception as error:
            self.store.put_artifact(uid, "equity_research_run", protocol_key, payload={"status": "failed", "errorType": type(error).__name__, "holdoutConsumed": True},
                                    idempotency_key="failed:" + request, expected_version=claim["version"])
            raise
        return self.status(uid, protocol_key)

def main():
    """Run the trusted archived-data worker without importing the web server."""
    import argparse
    import os
    from supabase import create_client
    from operations_store import OperationsStore
    from equity_store import EquityAuthenticatedStore
    parser = argparse.ArgumentParser(description="Replay a frozen server archive and save the computed result; never submits broker orders.")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--protocol-key", required=True)
    parser.add_argument("--cache-dir", required=True)
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    signing_key = os.environ.get("APP_SECRET_KEY")
    if not url or not key or not signing_key:
        parser.error("SUPABASE_URL, service-role credentials and the server APP_SECRET_KEY must be set in the worker environment")
    service = EquityResearchService(EquityAuthenticatedStore(OperationsStore(create_client(url, key)), signing_key))
    result = service.replay_archived(args.user_id, args.protocol_key, args.cache_dir)
    print(json.dumps({"status": result["status"], "protocolKey": result["protocolKey"], "admission": result["admission"]}, sort_keys=True))


if __name__ == "__main__":
    main()
