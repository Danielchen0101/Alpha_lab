"""A fresh qualification ledger and read-only audit of forward stop exposure.

Polling observations remain immutable. Delayed full SIP quotes may prove that
the polling simulator missed a stop; the audit invalidates that evidence and
never rewrites a fill to manufacture a better historical outcome.
"""
from copy import deepcopy
from datetime import datetime, time, timedelta, timezone

from equity_data import (CachedReadTransport, CollectionPending, collect_quote_archives,
                         content_hash, dataset_hash, iter_archived_quotes, read_corporate_actions,
                         read_sip_history, reconcile_action_adjustments)
from equity_strategy import EQUITY_STRATEGY_VERSION, NEW_YORK, number, parse_time

QUALIFICATION_VERSION = "equity_qualification_v1"


def _exposures(book, symbol, cutoff):
    result, opened = [], None
    for fill in sorted((row for row in book.get("fills", []) if row.get("symbol") == symbol), key=lambda row: row["timestamp"]):
        stamp = parse_time(fill.get("timestamp"))
        if not stamp or stamp > cutoff:
            continue
        if fill["side"] == "buy":
            opened = stamp
        elif opened:
            result.append((opened, stamp))
            opened = None
    if opened:
        result.append((opened, cutoff))
    return result


def qualification_identity(artifact, dataset):
    completed = parse_time(artifact.get("completedAt"))
    protocol = artifact.get("protocol") or {}
    if not completed or not protocol.get("protocolHash"):
        return None
    completed_day = completed.astimezone(NEW_YORK).date().isoformat()
    candidates = []
    for symbol in protocol.get("symbols") or []:
        for quote in (dataset.get("quotes") or {}).get(symbol, []):
            observed, event = parse_time(quote.get("observedAt")), parse_time(quote.get("timestamp"))
            if not observed or not event or quote.get("feed") != "iex" or not 0 <= (observed - event).total_seconds() <= 30:
                continue
            bid, ask = number(quote.get("bid")), number(quote.get("ask"))
            if not bid or not ask or not 0 < bid <= ask:
                continue
            candidates.append(observed)
    for observed in sorted(candidates):
        day = observed.astimezone(NEW_YORK).date().isoformat()
        session = (dataset.get("marketSessions") or {}).get(day) or {}
        if day <= completed_day or not session.get("open") or not session.get("close"):
            continue
        opened = datetime.fromisoformat(day + "T" + session["open"]).replace(tzinfo=NEW_YORK).astimezone(timezone.utc)
        closed = datetime.fromisoformat(day + "T" + session["close"]).replace(tzinfo=NEW_YORK).astimezone(timezone.utc)
        if not opened <= observed < closed:
            continue
        identity = {"version": QUALIFICATION_VERSION, "strategyVersion": EQUITY_STRATEGY_VERSION,
                    "protocolHash": protocol["protocolHash"], "researchArtifactHash": artifact["artifactHash"],
                    "strategy": protocol["strategy"], "symbols": protocol["symbols"], "qualifiedAt": completed.isoformat(),
                    "startedAt": observed.isoformat(), "tradeStart": day, "initialCapital": 2000.0}
        identity["qualificationKey"] = content_hash(identity)
        return identity
    return None


def build_qualification(artifact, exploratory):
    from equity_research import evaluate_admission, replay_portfolio
    if not evaluate_admission(artifact).get("historicalEligible"):
        return None
    dataset = deepcopy(exploratory.get("dataset") or {})
    if dataset.get("dataHash") != dataset_hash(dataset):
        raise ValueError("forward_source_archive_integrity_failed")
    identity = qualification_identity(artifact, dataset)
    if not identity:
        return None
    protocol = artifact["protocol"]
    clock = parse_time(exploratory.get("asOf"))
    if not clock or clock < parse_time(identity["startedAt"]):
        return None
    config = {**protocol["config"], "mode": "shadow", "executionFeed": "iex", "strategy": protocol["strategy"],
              "protocolHash": protocol["protocolHash"], "qualificationKey": identity["qualificationKey"],
              "tradeStart": identity["tradeStart"], "tradeEnd": clock.astimezone(NEW_YORK).date().isoformat(),
              "frozenAt": protocol["frozenAt"], "liquidateEnd": False}
    replay = replay_portfolio(dataset, config)
    return {**replay, "qualification": identity, "protocolKey": protocol["protocolKey"], "protocolHash": protocol["protocolHash"],
            "frozenAt": protocol["frozenAt"], "asOf": clock.isoformat(), "dataset": dataset,
            "orderIntents": replay["proposedOrders"], "evidenceCorrections": deepcopy(exploratory.get("evidenceCorrections") or []),
            "blockers": deepcopy(exploratory.get("blockers") or []), "status": "qualification_observations"}


def forward_prefix_hash(book, through):
    end = datetime.combine(datetime.fromisoformat(through).date(), time(23, 59, 59), NEW_YORK).astimezone(timezone.utc)
    dataset = book.get("dataset") or {}
    prefix = {"qualification": book.get("qualification"), "through": through,
              "bars": {symbol: [row for row in rows if parse_time(row.get("availableAt")) and parse_time(row["availableAt"]) <= end] for symbol, rows in dataset.get("bars", {}).items()},
              "quotes": {symbol: [row for row in rows if parse_time(row.get("observedAt")) and parse_time(row["observedAt"]) <= end] for symbol, rows in dataset.get("quotes", {}).items()},
              "actions": [row for row in dataset.get("corporateActions", []) if row.get("exDate", "9999") <= through],
              "fills": [row for row in book.get("fills", []) if parse_time(row.get("timestamp")) and parse_time(row["timestamp"]) <= end],
              "protectionEvents": [row for row in book.get("protectionEvents", []) if parse_time(row.get("timestamp")) and parse_time(row["timestamp"]) <= end],
              "orders": [row for row in book.get("orderIntents", []) if parse_time(row.get("submittedAt")) and parse_time(row["submittedAt"]) <= end]}
    return content_hash(prefix)


def audit_qualification_quotes(book, fetch_page, *, now, cache_dir, max_requests=120):
    """Independent delayed SIP audit, bounded and resumable through page cache.

    Every held regular-session interval is checked against the stop that was
    actually active at that instant. An unobserved breach is an evidence gap,
    even if a later quote recovered. No new hypothetical fill is added.
    """
    clock = parse_time(now)
    identity = book.get("qualification") or {}
    dataset = book.get("dataset") or {}
    if not clock or not identity.get("qualificationKey") or dataset.get("dataHash") != dataset_hash(dataset):
        raise ValueError("invalid_qualification_archive")
    calendar = []
    for day in dataset.get("sessions", []):
        session = (dataset.get("marketSessions") or {}).get(day) or {}
        if day < identity["tradeStart"] or day >= clock.astimezone(NEW_YORK).date().isoformat() or not session.get("open") or not session.get("close"):
            continue
        closed = datetime.fromisoformat(day + "T" + session["close"]).replace(tzinfo=NEW_YORK)
        if closed <= clock - timedelta(minutes=15):
            calendar.append({"date": day, **session})
    if not calendar:
        return {"status": "collecting", "issues": ["completed_qualification_session_required"]}
    through = calendar[-1]["date"]
    symbols = identity["symbols"]
    transport = CachedReadTransport(fetch_page, cache_dir, max_requests, max_elapsed_seconds=20)
    cutoff = datetime.fromisoformat(through + "T" + calendar[-1]["close"]).replace(tzinfo=NEW_YORK).astimezone(timezone.utc)
    exposure_by_symbol = {symbol: _exposures(book, symbol, cutoff) for symbol in symbols}
    exposure_calendars = {}
    for symbol in symbols:
        intervals = []
        for session in calendar:
            opened = datetime.fromisoformat(session["date"] + "T" + session["open"]).replace(tzinfo=NEW_YORK)
            closed = datetime.fromisoformat(session["date"] + "T" + session["close"]).replace(tzinfo=NEW_YORK)
            for entry, exit_at in exposure_by_symbol[symbol]:
                start_at, end_at = max(opened, entry), min(closed, exit_at)
                if start_at < end_at:
                    intervals.append({"date": session["date"], "open": start_at.astimezone(NEW_YORK).strftime("%H:%M:%S.%f"), "close": end_at.astimezone(NEW_YORK).strftime("%H:%M:%S.%f")})
        exposure_calendars[symbol] = intervals
    try:
        archives, coverage = {}, {"rowCount": 0}
        for symbol in symbols:
            pages, detail = collect_quote_archives(transport, [symbol], exposure_calendars[symbol], identity["tradeStart"], through, now=clock)
            archives[symbol] = pages[symbol]
            coverage["rowCount"] += detail["rowCount"]
        first_bar = min(row["session"] for rows in dataset.get("bars", {}).values() for row in rows)
        expected_sessions = [day for day in dataset.get("sessions", []) if first_bar <= day <= through]
        expected_days = set(expected_sessions)
        start = datetime.fromisoformat(first_bar).replace(tzinfo=NEW_YORK)
        end = datetime.combine(datetime.fromisoformat(through).date() + timedelta(days=1), time(), NEW_YORK)
        end = min(end, clock - timedelta(minutes=16))
        raw, _ = read_sip_history(transport, symbols, start.isoformat(), end.isoformat(), now=clock, adjustment="raw", expected_sessions=expected_sessions)
        split, _ = read_sip_history(transport, symbols, start.isoformat(), end.isoformat(), now=clock, adjustment="split", expected_sessions=expected_sessions)
        total, _ = read_sip_history(transport, symbols, start.isoformat(), end.isoformat(), now=clock, adjustment="all", expected_sessions=expected_sessions)
        actions, _ = read_corporate_actions(transport, symbols, first_bar, (clock + timedelta(days=90)).date().isoformat())
        reconciliation = reconcile_action_adjustments(raw["rows"], split["rows"], total["rows"], actions)
    except CollectionPending:
        return {"status": "collecting", "qualificationKey": identity["qualificationKey"], "pagesFetchedThisRun": transport.requests,
                "issues": ["forward_sip_audit_collection_pending"]}
    issues, missed = [], []
    if not expected_days or any(not response["coverage"].get("complete") or any(
            {row["session"] for row in response["rows"].get(symbol, [])} != expected_days
            for symbol in symbols) for response in (raw, split, total)):
        issues.append("forward_daily_bar_coverage_incomplete")
    if not reconciliation["complete"]:
        issues.append("forward_corporate_action_reconciliation_incomplete")
    archived_actions = {row.get("id"): row for row in dataset.get("corporateActions", [])}
    for action in actions:
        if not action.get("exDate") or not first_bar <= action["exDate"] <= through:
            continue
        original = archived_actions.get(action["id"], {})
        fields = ("type", "symbol", "exDate", "ratio", "cashAmount", "payDate")
        if any(original.get(key) != action.get(key) for key in fields):
            issues.append("forward_action_archive_differs_from_independent_audit")
    for symbol in symbols:
        originals = {row["session"]: row for row in dataset.get("bars", {}).get(symbol, [])}
        if {day for day in originals if first_bar <= day <= through} != expected_days:
            issues.append("forward_original_daily_bar_coverage_incomplete")
        for row in raw["rows"].get(symbol, []):
            old = originals.get(row["session"])
            if old is None or any(number(old.get(key)) != number(row.get(key)) for key in ("open", "high", "low", "close", "volume")):
                issues.append("forward_bar_archive_differs_from_independent_audit")
        exposures = exposure_by_symbol[symbol]
        stops = sorted((row for row in book.get("protectionEvents", []) if row.get("symbol") == symbol), key=lambda row: row["timestamp"])
        orders = [row for row in book.get("orderIntents", []) if row.get("symbol") == symbol and row.get("side") == "sell"]
        for entry, exit_at in exposures:
            if not any(parse_time(row.get("entryTimestamp")) == entry for row in stops):
                issues.append("forward_protective_order_history_missing")
        quote_dataset = {"quoteArchives": {symbol: archives[symbol]}}
        observed_intervals = set()
        required_intervals = [(datetime.fromisoformat(row["date"] + "T" + row["open"]).replace(tzinfo=NEW_YORK),
                               datetime.fromisoformat(row["date"] + "T" + row["close"]).replace(tzinfo=NEW_YORK))
                              for row in exposure_calendars[symbol]]
        for quote in iter_archived_quotes(quote_dataset, symbol, cache_dir):
            stamp, bid = parse_time(quote["timestamp"]), number(quote["bid"])
            if not stamp or bid is None or bid <= 0:
                continue
            exposure = next(((entry, exit_at) for entry, exit_at in exposures if entry <= stamp < exit_at), None)
            if not exposure:
                continue
            for index, (start_at, end_at) in enumerate(required_intervals):
                if start_at <= stamp < end_at:
                    observed_intervals.add(index)
            applicable = [row for row in stops if parse_time(row["entryTimestamp"]) == exposure[0] and parse_time(row["timestamp"]) <= stamp]
            if not applicable:
                continue
            stop = applicable[-1]["stopPrice"]
            if bid <= stop and not any(exposure[0] <= parse_time(order["submittedAt"]) <= stamp for order in orders):
                if len(missed) < 100:
                    missed.append({"symbol": symbol, "timestamp": quote["timestamp"], "bid": bid, "stopPrice": stop, "entryTimestamp": exposure[0].isoformat()})
                issues.append("unobserved_protective_stop_breach")
        if observed_intervals != set(range(len(required_intervals))):
            issues.append("forward_sip_session_coverage_missing")
    proof = {"version": "forward_sip_stop_audit_v1", "qualificationKey": identity["qualificationKey"], "through": through,
             "inputPrefixHash": forward_prefix_hash(book, through), "auditedSessions": [row["date"] for row in calendar],
             "quoteArchiveHash": content_hash(archives), "quoteRows": coverage["rowCount"], "actionReconciliation": reconciliation,
             "exposureCount": sum(len(rows) for rows in exposure_by_symbol.values()),
             "missedStops": missed, "issues": sorted(set(issues)), "completedAt": clock.isoformat()}
    proof["proofHash"] = content_hash(proof)
    return {**proof, "status": "invalid" if issues else "complete"}


def forward_coverage_errors(book):
    """Verify server-generated audit evidence; no uploaded success flags."""
    identity, proof = book.get("qualification") or {}, book.get("forwardAudit") or {}
    errors = []
    if proof.get("proofHash") != content_hash({key: value for key, value in proof.items() if key not in ("proofHash", "status")}):
        return ["forward_sip_audit_required"]
    if proof.get("qualificationKey") != identity.get("qualificationKey") or not proof.get("through") or proof.get("inputPrefixHash") != forward_prefix_hash(book, proof["through"]):
        errors.append("forward_audit_does_not_match_immutable_archive")
    clock = parse_time(book.get("asOf"))
    completed_days = [row["session"] for row in book.get("equityCurve", []) if clock and row.get("session", "9999") < clock.astimezone(NEW_YORK).date().isoformat()]
    if completed_days and proof.get("through", "") < max(completed_days):
        errors.append("latest_completed_forward_exposure_not_audited")
    errors.extend(proof.get("issues") or [])
    if proof.get("missedStops"):
        errors.append("unobserved_protective_stop_breach")
    if not proof.get("auditedSessions") or (not proof.get("quoteRows") and proof.get("exposureCount") != 0) or not (proof.get("actionReconciliation") or {}).get("complete"):
        errors.append("forward_audit_incomplete")
    if book.get("evidenceCorrections"):
        errors.append("forward_evidence_revision_requires_reconciliation")
    # These historical manifest assertions are superseded only by the actual
    # immutable-universe, price and exposure audit above, never by a Boolean.
    superseded = {"quotesComplete_unverified", "corporateActionsComplete_unverified", "pointInTimeUniverse_unverified", "corporate_actions_unverified"}
    errors.extend(item for item in book.get("diagnostics", []) + book.get("blockers", []) if item not in superseded)
    return sorted(set(errors))
