from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json

import pytest

from equity_data import (CachedReadTransport, CollectionPending, EQUITY_DATA_VERSION,
                         content_hash, dataset_hash, read_sip_history, read_corporate_actions,
                         reconcile_action_adjustments)
from equity_research import (evaluate_admission, make_protocol, replay_portfolio,
                             run_research, protocol_valid)
from equity_research_service import EquityResearchService
from equity_strategy import evaluate_daily_signal, position_exit_decision
from equity_strategy import NEW_YORK


def bars(count=210):
    result = []
    day = datetime(2025, 1, 1)
    while len(result) < count:
        if day.weekday() < 5:
            close = 50 + len(result) * .1
            result.append({"session": day.date().isoformat(), "availableAt": day.date().isoformat() + "T21:00:00Z", "open": close - .02, "high": close + .02, "low": close - .04, "close": close, "volume": 100000})
        day += timedelta(days=1)
    return result


def fixture_dataset(quote_values=None):
    history = bars()
    day = datetime.fromisoformat(history[-1]["session"]) + timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    session = day.date().isoformat()
    price = history[-1]["close"]
    quotes = []
    for second, bid, ask in quote_values or [(0, price, price + .01), (1, price, price + .01), (2, price - 3, price - 2.99), (3, price - 4, price - 3.99)]:
        stamp = session + "T14:30:%02dZ" % second
        quotes.append({"timestamp": stamp, "observedAt": stamp, "bid": bid, "ask": ask, "bidSize": 100, "askSize": 100, "feed": "sip"})
    data = {"dataVersion": EQUITY_DATA_VERSION, "barAdjustment": "raw", "sessions": [session],
            "bars": {"SPY": history}, "quotes": {"SPY": quotes}, "universe": {session: ["SPY"]},
            "corporateActions": [], "coverage": {key: True for key in ("barsComplete", "quotesComplete", "corporateActionsComplete", "pointInTimeUniverse", "calendarVerified", "quoteSizesInShares")}}
    data["dataHash"] = dataset_hash(data)
    return data


def test_signal_warmup_and_future_bar_causality():
    history = bars()
    assert evaluate_daily_signal(history[:199])["eligible"] is False
    signal = evaluate_daily_signal(history)
    assert signal["eligible"] is True
    altered = history + [{**history[-1], "session": "2026-01-01", "availableAt": "2026-01-01T21:00:00Z", "high": 1001, "close": 1000}]
    assert evaluate_daily_signal(altered, as_of="2025-12-01T00:00:00Z") == signal


def test_exit_does_not_inherit_prefill_close_or_high():
    history = bars()
    position = {"entryPrice": 60, "initialRiskPerShare": 2, "stopPrice": 58, "entrySession": history[-1]["session"], "entryTimestamp": history[-1]["session"] + "T22:00:00Z"}
    decision = position_exit_decision(position, history)
    assert decision["sessionsHeld"] == 0
    assert decision["trailActive"] is False
    assert decision["stopPrice"] == 58


def test_quote_replay_next_tick_gap_stop_and_settlement():
    data = fixture_dataset()
    result = replay_portfolio(data)
    assert len(result["trades"]) == 1
    trade = result["trades"][0]
    assert trade["entryTime"].endswith("01+00:00")
    assert trade["exitTime"].endswith("03+00:00")
    assert trade["exitPrice"] < data["quotes"]["SPY"][2]["bid"]
    assert trade["reason"] == "STOP"
    assert result["state"]["unsettledProceeds"]
    assert result["state"]["cash"] < result["state"]["equity"]
    assert trade["qty"] * trade["entryPrice"] <= 400


def test_no_same_quote_fill_no_partial_or_terminal_ohlc_fill():
    data = fixture_dataset()
    data["quotes"]["SPY"] = data["quotes"]["SPY"][:1]
    result = replay_portfolio(data)
    assert result["fills"] == []
    assert result["state"]["pendingOrders"]
    data["quotes"]["SPY"].append({**data["quotes"]["SPY"][0], "timestamp": data["quotes"]["SPY"][0]["timestamp"].replace("00Z", "01Z"), "askSize": 1})
    result = replay_portfolio(data)
    assert result["fills"] == []


def test_shadow_rejects_stale_future_and_prefreeze_ticks():
    data = fixture_dataset()
    for row in data["quotes"]["SPY"]:
        row["feed"] = "iex"
        row["observedAt"] = row["observedAt"].replace("14:30", "14:31")
    result = replay_portfolio(data, {"mode": "shadow", "frozenAt": "2025-01-01T00:00:00Z"})
    assert result["fills"] == []
    assert "quote_not_fresh_server_observation" in result["diagnostics"]


def test_sip_reader_explicit_delay_pagination_and_cache():
    calls = []
    def fetch(path, query):
        calls.append(query)
        if "page_token" not in query:
            return {"bars": {"SPY": [{"t": "2025-01-02T05:00:00Z", "o": 10, "h": 11, "l": 9, "c": 10, "v": 100}]}, "next_page_token": "two"}
        return {"bars": {"SPY": [{"t": "2025-01-03T05:00:00Z", "o": 10, "h": 11, "l": 9, "c": 10, "v": 100}]}, "next_page_token": None}
    args = (fetch, ["SPY"], "2025-01-01T00:00:00Z", "2025-01-04T00:00:00Z")
    result, cache = read_sip_history(*args, now="2025-01-05T00:00:00Z", expected_sessions=["2025-01-02", "2025-01-03"])
    assert result["coverage"]["complete"] is True
    assert all(query["feed"] == "sip" and query["adjustment"] == "raw" for query in calls)
    read_sip_history(*args, now="2025-01-05T00:00:00Z", expected_sessions=["2025-01-02", "2025-01-03"], cache=cache)
    assert len(calls) == 2
    with pytest.raises(ValueError, match="15_minutes"):
        read_sip_history(fetch, ["SPY"], "2025-01-01T00:00:00Z", "2025-01-05T00:00:00Z", now="2025-01-05T00:00:00Z")


def test_cache_resume_and_corruption_fails_closed(tmp_path):
    calls = []
    fetch = lambda path, params: calls.append(params) or {"quotes": {"SPY": []}, "next_page_token": None}
    cached = CachedReadTransport(fetch, tmp_path, max_requests=1)
    cached("/quotes", {"page": 1})
    with pytest.raises(CollectionPending):
        cached("/quotes", {"page": 2})
    resumed = CachedReadTransport(fetch, tmp_path, max_requests=1)
    resumed("/quotes", {"page": 1})
    resumed("/quotes", {"page": 2})
    assert len(calls) == 2
    file = next(tmp_path.glob("*.json"))
    payload = json.loads(file.read_text())
    payload["payload"] = {"tampered": True}
    file.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="integrity"):
        resumed(payload["identity"]["path"], payload["identity"]["params"])


def test_actions_reader_reconciles_splits_but_never_claims_api_exdate_sla():
    events, coverage = read_corporate_actions(lambda p, q: {"corporate_actions": {"forward_splits": [{"id": "split1", "symbol": "SPY", "ex_date": "2025-01-03", "process_date": "2025-01-03", "new_rate": 2, "old_rate": 1}]}, "next_page_token": None}, ["SPY"], "2025-01-01", "2025-01-05")
    assert events[0]["ratio"] == 2
    assert coverage["paginationComplete"] and not coverage["complete"]
    raw = {"SPY": [{"session": "2025-01-02", "close": 100}, {"session": "2025-01-03", "close": 50}]}
    adjusted = {"SPY": [{"session": "2025-01-02", "close": 50}, {"session": "2025-01-03", "close": 50}]}
    assert reconcile_action_adjustments(raw, adjusted, adjusted, events)["complete"]
    assert not reconcile_action_adjustments(raw, adjusted, adjusted, [])["complete"]


class MemoryStore:
    def __init__(self):
        self.rows = {}
    def get_artifact(self, uid, kind, key):
        return deepcopy(self.rows.get((uid, kind, key)))
    def put_artifact(self, uid, kind, key, *, payload, idempotency_key, expected_version=None):
        old = self.rows.get((uid, kind, key), {})
        if old.get("last_idempotency_key") == idempotency_key:
            return deepcopy(old)
        if expected_version is not None and old.get("version", 0) != expected_version:
            raise ValueError("conflict")
        row = {"payload": deepcopy(payload), "version": old.get("version", 0) + 1, "last_idempotency_key": idempotency_key}
        self.rows[(uid, kind, key)] = row
        return deepcopy(row)


def test_user_scoped_freeze_is_immutable_and_cannot_submit_success():
    store = MemoryStore()
    service = EquityResearchService(store)
    protocol = service.freeze("a", now="2026-10-09T12:00:00Z")
    assert protocol_valid(protocol)
    assert protocol["registeredTrials"] == ["breakout20", "pullback20"]
    assert service.status("b", protocol["protocolKey"])["status"] == "not_frozen"
    with pytest.raises(ValueError, match="already_frozen"):
        service.freeze("a", strategy="pullback20", now="2026-10-09T12:00:01Z")
    assert not evaluate_admission({"admission": {"eligible": True}})["eligible"]
    altered = deepcopy(protocol)
    altered["config"]["riskPerTradePct"] = 100
    assert not protocol_valid(altered)


def test_research_reports_both_frozen_trials_and_missing_evidence():
    data = fixture_dataset()
    base = data["sessions"][0]
    data["sessions"] = [base, (datetime.fromisoformat(base) + timedelta(days=1)).date().isoformat(), (datetime.fromisoformat(base) + timedelta(days=2)).date().isoformat()]
    data["coverage"]["quotesComplete"] = False
    data["dataHash"] = dataset_hash(data)
    protocol = make_protocol(periods={"start": "2024-01-01", "end": "2026-10-08", "holdoutStart": "2024-10-01", "holdoutEnd": "2026-10-08"}, now="2026-10-09T12:00:00Z")
    result = run_research(data, protocol)
    assert [row["strategy"] for row in result["trials"]] == ["breakout20", "pullback20"]
    assert not result["admission"]["eligible"]
    assert not result["admission"]["checks"]["completeVerifiedData"]
    forward = {"protocolHash": protocol["protocolHash"], "strategyVersion": "equity_fixed_v1", "dataVersion": EQUITY_DATA_VERSION,
               "frozenAt": protocol["frozenAt"], "asOf": "2027-02-01T15:00:00Z", "dataHash": data["dataHash"], "dataset": data,
               "equityCurve": [{"session": "2027-01-01", "equity": 2100}], "trades": [], "state": {"riskPaused": False}, "metrics": {"maxDrawdownPct": 1}, "diagnostics": ["quote_gap"]}
    admission = evaluate_admission(result, forward)
    assert not admission["checks"]["forwardDataComplete"]
    assert not admission["checks"]["sixtyForwardSessions"]
    assert not admission["eligible"]


def test_hundred_trade_gate_never_pools_different_candidates():
    data = fixture_dataset()
    data['sessions'] = ['2025-10-01', '2025-10-02', '2025-10-03']
    data['dataHash'] = dataset_hash(data)
    protocol = make_protocol(periods={'start': '2024-01-01', 'end': '2026-10-08',
                                     'holdoutStart': '2024-10-01', 'holdoutEnd': '2026-10-08'},
                             now='2026-10-09T12:00:00Z')
    artifact = run_research(data, protocol)
    for trial in artifact['trials']:
        count = 20 if trial['strategy'] == protocol['strategy'] else 40
        for fold in trial['folds']:
            fold['trades'] = [{'netPnl': 1 if index % 2 else -.5} for index in range(count)]
    artifact['artifactHash'] = content_hash({key: value for key, value in artifact.items()
                                           if key not in ('artifactHash', 'admission')})
    verdict = evaluate_admission(artifact)
    assert verdict['closedTrades'] == 60
    assert not verdict['checks']['oneHundredClosedTrades']


def test_full_collection_resumes_pages_and_keeps_quotes_out_of_store(tmp_path):
    store = MemoryStore()
    service = EquityResearchService(store)
    protocol = service.freeze("a", universe=["SPY"], periods={"start": "2024-01-01", "end": "2026-10-08", "holdoutStart": "2024-10-01", "holdoutEnd": "2026-10-08"}, now="2026-10-09T12:00:00Z")
    days = ["2025-01-02", "2025-01-03", "2025-01-06"]
    calendar = [{"date": day, "open": "09:30", "close": "16:00"} for day in days]
    calls = []
    def fetch(path, query):
        calls.append((path, deepcopy(query)))
        if path == "/v1/corporate-actions":
            return {"corporate_actions": {}, "next_page_token": None}
        if path == "/v2/stocks/bars":
            return {"bars": {"SPY": [{"t": datetime.fromisoformat(day).replace(tzinfo=NEW_YORK).isoformat(), "o": 100, "h": 101, "l": 99, "c": 100, "v": 10000} for day in days]}, "next_page_token": None}
        day = query["start"][:10]
        return {"quotes": {"SPY": [{"t": day + "T14:30:00Z", "bp": 100, "ap": 100.01, "bs": 100, "as": 100}]}, "next_page_token": None}
    first = service.run("a", protocol["protocolKey"], fetch, lambda a, b: calendar, now="2026-10-09T12:00:00Z", cache_dir=tmp_path, max_requests=4)
    assert first["status"] == "collecting"
    assert first["run"]["holdoutOpened"] is False
    second = service.run("a", protocol["protocolKey"], fetch, lambda a, b: calendar, now="2026-10-09T12:01:00Z", cache_dir=tmp_path, max_requests=4)
    assert second["status"] == "insufficient"
    assert len(calls) == 7
    compact = store.get_artifact("a", "equity_research_dataset", protocol["protocolKey"])["payload"]
    assert "quotes" not in compact and "bars" not in compact
    assert compact["manifest"]["quoteArchivePages"] == 3
    assert (tmp_path / "dataset.json").exists()
    with pytest.raises(ValueError, match="unopened"):
        service.run("a", protocol["protocolKey"], fetch, lambda a, b: calendar, cache_dir=tmp_path)


def test_forward_today_does_not_complete_sixty_sessions():
    data = fixture_dataset()
    data["sessions"] = ["2025-10-01", "2025-10-02", "2025-10-03"]
    data["dataHash"] = dataset_hash(data)
    protocol = make_protocol(periods={"start": "2024-01-01", "end": "2026-10-08", "holdoutStart": "2024-10-01", "holdoutEnd": "2026-10-08"}, now="2026-10-09T12:00:00Z")
    artifact = run_research(data, protocol)
    artifact["completedAt"] = "2026-10-09T13:00:00Z"
    artifact["artifactHash"] = content_hash({key: value for key, value in artifact.items() if key not in ("artifactHash", "admission")})
    days = []
    day = datetime(2026, 10, 12)
    while len(days) < 60:
        if day.weekday() < 5:
            days.append(day.date().isoformat())
        day += timedelta(days=1)
    forward = {"protocolHash": protocol["protocolHash"], "strategyVersion": "equity_fixed_v1", "dataVersion": EQUITY_DATA_VERSION,
               "frozenAt": protocol["frozenAt"], "asOf": days[-1] + "T15:00:00Z", "dataHash": data["dataHash"], "dataset": data,
               "equityCurve": [{"session": day, "equity": 2000 + index} for index, day in enumerate(days)], "trades": [],
               "state": {"riskPaused": False}, "metrics": {"maxDrawdownPct": 1}, "diagnostics": []}
    forward['forwardAudit'] = {'auditedSessions': days}
    verdict = evaluate_admission(artifact, forward)
    assert verdict['forwardSessions'] == 59
    assert not verdict["checks"]["sixtyForwardSessions"]
    assert not verdict['checks']['forwardDataComplete']
    forward['asOf'] = (datetime.fromisoformat(days[-1]) + timedelta(days=1, hours=15)).isoformat() + 'Z'
    assert evaluate_admission(artifact, forward)['forwardSessions'] == 60
    forward["protocolHash"] = "other_cohort"
    assert not evaluate_admission(artifact, forward)["checks"]["forwardCohortIdentityVerified"]


def test_legacy_warmup_can_signal_before_test_but_never_hold_before_test():
    import start_quant_backend as backend
    rows = [{"timestamp": str(index), "open": 100 + index, "high": 101 + index, "low": 99 + index, "close": 100 + index} for index in range(10)]
    trades, curve = backend._bt_execute_long_signals(rows, lambda i, ctx: "BUY", 2000, "SPY", trade_start_index=7)
    assert trades[0]["entryBarIndex"] == 7
    assert trades[0]["entrySignalDate"] == "6"
    assert [point["date"] for point in curve] == ["7", "8", "9"]
