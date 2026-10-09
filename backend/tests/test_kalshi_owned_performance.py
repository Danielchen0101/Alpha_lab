"""Synthetic-only tests for the offline descriptive ownership/performance audit."""

import copy
import gzip
import importlib.util
import json
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts/kalshi_backtest/kalshi_owned_performance.py"
SPEC = importlib.util.spec_from_file_location("kalshi_owned_performance", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def entry(ticker="KXBTC15M-A", count=1, day="2026-08-01", **overrides):
    return {
        "ticker": ticker, "environment": "real", "action": "BUY_YES", "side": "YES",
        "orderFilled": True, "fillCount": count, "orderId": f"buy-{ticker}",
        "generatedAt": f"{day}T12:00:00Z", "strategyVersion": "test-v1", **overrides,
    }


def outcome(ticker="KXBTC15M-A", count=1, pnl=0.2, day="2026-08-01", **overrides):
    return {
        "ticker": ticker, "environment": "real", "contracts": count, "side": "YES",
        "pnl": pnl, "settledAt": f"{day}T12:15:00Z", "key": f"settlement-{ticker}",
        **overrides,
    }


def state(entries=None, settlements=None, closes=None):
    return {
        "config": {"executionMode": "real"},
        "filledTrades": entries if entries is not None else [entry()],
        "strategy": {
            "settlementRecords": settlements if settlements is not None else [outcome()],
            "closedTradeRecords": closes or [],
        },
    }


def test_aggregate_partial_exit_and_settlement_before_win_classification():
    close = outcome(count="0.4", pnl="-0.10", key=None, orderId="sell-a",
                    closedAt="2026-08-01T12:10:00Z")
    data = state(settlements=[outcome(count="0.6", pnl="0.30")], closes=[close])
    # The state mirror must not be summed again.
    data["strategy"]["realizedTradeRecords"] = [outcome(count="0.6", pnl="0.30"), close]
    report = MODULE.audit(data, include_markets=True)
    assert report["complete"]["markets"] == 1
    assert report["complete"]["wins"] == 1
    assert report["complete"]["losses"] == 0
    assert report["complete"]["netPnl"] == 0.2
    assert report["markets"][0]["outcomeRows"] == 2
    assert report["outcomeSource"] == "canonical_settlements_and_closes"


def test_unowned_and_same_ticker_manual_mix_are_not_bot_performance():
    data = state(settlements=[outcome(count=3, pnl=12), outcome("MANUAL", pnl=50)])
    report = MODULE.audit(data)
    assert report["complete"]["markets"] == 0
    assert report["unownedOutcomeTickers"] == 1
    assert report["ambiguous"]["markets"] == 1
    assert "manual" in " ".join(report["limitations"]).lower()
    assert report["ownershipScope"] == "bot_buy_filled_tickers_not_verified_lots"


def test_even_matching_quantities_do_not_claim_exact_lot_ownership():
    report = MODULE.audit(state(), include_markets=True)
    assert report["markets"][0]["status"] == "quantity_complete_ticker_scoped"
    assert "even when quantities" in " ".join(report["limitations"])


def test_net_pnl_explicitly_excludes_operating_costs_and_taxes():
    limitations = " ".join(MODULE.audit(state())["limitations"])
    assert "after recorded exchange/trading fees only" in limitations
    assert "excludes hosting, market-data and AI subscription costs and taxes" in limitations
    assert "not net business profit" in limitations


def test_partial_and_open_positions_not_counted_as_completed_wins():
    report = MODULE.audit(state([entry(), entry("KXBTC15M-B")], [outcome(count="0.3", pnl="0.12")]))
    assert report["complete"]["markets"] == 0
    assert report["incomplete"] == {"markets": 2, "recordedPartialNetPnl": 0.12}


def test_filled_flag_and_fixed_point_quantity_are_authoritative():
    report = MODULE.audit(state([
        entry(orderFilled=False), entry("B", orderFilled="false"),
        entry("C", action="SELL_YES"), entry("D", fill_count_fp="0.00", fillCount=1),
    ], [outcome("D")]))
    assert report["ownedEntryTickers"] == 1
    assert report["complete"]["markets"] == 0
    assert report["ambiguous"]["markets"] == 1


def test_environment_bucket_precedence_does_not_double_count_mirror():
    real, paper = state(), state([entry("P", environment="paper")], [outcome("P", environment="paper")])
    paper["config"]["executionMode"] = "paper"
    data = {**real, "modeState": {"real": real, "paper": paper}}
    assert MODULE.audit(data)["complete"]["markets"] == 1
    assert MODULE.audit(data, environment="paper")["complete"]["markets"] == 1
    with pytest.raises(ValueError, match="absent"):
        MODULE.audit({"modeState": {"paper": paper}})


def test_missing_environment_is_not_silently_assumed_live():
    data = state()
    data.pop("config")
    data["filledTrades"][0].pop("environment")
    data["strategy"]["settlementRecords"][0].pop("environment")
    report = MODULE.audit(data)
    assert report["ownedEntryTickers"] == 0
    assert report["dataQualityCounts"]["missingEnvironmentRows"] == 2


def test_exact_duplicates_deduplicated_and_conflicts_quarantined():
    data = state([entry(), entry()], [outcome(), outcome()])
    report = MODULE.audit(data)
    assert report["complete"]["netPnl"] == 0.2
    assert report["dataQualityCounts"]["duplicateEntryRows"] == 1
    assert report["dataQualityCounts"]["duplicateOutcomeRows"] == 1
    data["strategy"]["settlementRecords"][1]["pnl"] = 999
    report = MODULE.audit(data)
    assert report["complete"]["markets"] == 0
    assert report["ambiguous"]["reasons"]["conflicting_duplicate_outcome"] == 1


def test_cumulative_entry_quantity_conflict_not_arbitrarily_added():
    report = MODULE.audit(state([entry(count=1), entry(count=2)], [outcome(count=3)]))
    assert report["complete"]["markets"] == 0
    assert "conflicting_or_unidentified_duplicate_entry" in report["ambiguous"]["reasons"]


@pytest.mark.parametrize("bad_value", [None, "NaN", "Infinity", True])
def test_missing_nonfinite_or_boolean_pnl_not_assumed_zero(bad_value):
    report = MODULE.audit(state(settlements=[outcome(pnl=bad_value)]))
    assert report["complete"]["markets"] == 0
    assert report["ambiguous"]["reasons"]["missing_or_invalid_net_pnl"] == 1


def test_net_pnl_does_not_subtract_fees_twice_and_fallback_requires_all_fields():
    row = outcome(pnl=0.12, fees=0.04, revenue=1, cost=0.84)
    assert MODULE.audit(state(settlements=[row]))["complete"]["netPnl"] == 0.12
    row.pop("pnl")
    assert MODULE.audit(state(settlements=[row]))["complete"]["netPnl"] == 0.12
    row.pop("fees")
    assert MODULE.audit(state(settlements=[row]))["ambiguous"]["markets"] == 1


def test_flat_is_not_loss_pf_and_drawdown_are_market_level():
    buys, closes = [], []
    for index, pnl in enumerate([-1, 2, 0, -3], start=1):
        day, ticker = f"2026-08-0{index}", f"KXBTC15M-{index}"
        buys.append(entry(ticker, day=day))
        closes.append(outcome(ticker, pnl=pnl, day=day))
    report = MODULE.audit(state(buys, closes))
    assert report["complete"]["wins"] == 1
    assert report["complete"]["losses"] == 2
    assert report["complete"]["flat"] == 1
    assert report["complete"]["profitFactor"] == 0.5
    assert report["complete"]["maxCompletedMarketDrawdown"] == 3
    assert MODULE.audit(state(settlements=[outcome(pnl=-1)]))["complete"]["maxCompletedMarketDrawdown"] == 1
    assert MODULE.audit(state())["complete"]["profitFactor"] is None
    json.dumps(report, allow_nan=False)


def test_chronological_boundaries_purge_crossing_outcomes_and_shared_hourly_event():
    buys = [
        entry("KXBTC15M-TRAIN", day="2026-08-01"),
        entry("KXBTC15M-CROSS", day="2026-08-01"),
        entry("KXBTCD-E-T1", day="2026-08-01"),
        entry("KXBTCD-E-T2", day="2026-08-02"),
        entry("KXBTC15M-VALID", day="2026-08-02"),
        entry("KXBTC15M-TEST", day="2026-08-03"),
    ]
    exits = [outcome(row["ticker"], day=row["generatedAt"][:10]) for row in buys]
    exits[1]["settledAt"] = "2026-08-02T00:01:00Z"
    report = MODULE.audit(state(buys, exits), train_end="2026-08-02", validation_end="2026-08-03")
    split = report["chronologicalSplit"]
    assert split["boundaryOrSharedEventPurgedMarkets"] == 3
    assert [split["groups"][name]["markets"] for name in ("train", "validation", "holdout")] == [1, 1, 1]
    assert split["untouchedHoldoutProven"] is False


def test_default_split_is_descriptive_and_policy_not_backfilled_from_current_config():
    buys = [entry(f"KXBTC15M-{index}", day=f"2026-08-0{index}") for index in range(1, 6)]
    buys[0].pop("strategyVersion")
    buys[1]["strategyVersion"] = "old-version"
    data = state(buys, [outcome(row["ticker"], day=row["generatedAt"][:10]) for row in buys])
    data["strategy"]["version"] = "current-version-not-historical"
    report = MODULE.audit(data)
    assert report["byRecordedEntryPolicy"]["unknown"]["markets"] == 1
    assert report["byRecordedEntryPolicy"]["old-version"]["markets"] == 1
    assert "current-version-not-historical" not in report["byRecordedEntryPolicy"]
    assert report["chronologicalSplit"]["mode"].startswith("descriptive_")


def test_dates_must_be_aware_and_pnl_curve_normalizes_offsets():
    bad = state(settlements=[outcome(settledAt="2026-08-01T12:15:00")])
    assert MODULE.audit(bad)["ambiguous"]["markets"] == 1
    with pytest.raises(ValueError, match="both increasing"):
        MODULE.audit(state(), train_end="2026-08-02")
    with pytest.raises(ValueError, match="both increasing"):
        MODULE.audit(state(), train_end="2026-08-03", validation_end="2026-08-02")
    good = state(settlements=[outcome(settledAt="2026-08-01T14:15:00+02:00")])
    assert MODULE.audit(good)["complete"]["lastCompletedAt"] == "2026-08-01T12:15:00Z"


def test_bare_ledger_requires_explicit_bot_entries_and_supports_mirror_only():
    with pytest.raises(ValueError, match="--entries"):
        MODULE.audit([outcome()])
    report = MODULE.audit([outcome()], entries=[entry()])
    assert report["outcomeSource"] == "realized_mirror_only"
    assert report["complete"]["netPnl"] == 0.2
    assert MODULE.audit({"realizedTradeRecords": [outcome()]})["ownedEntryTickers"] == 0


def test_sale_action_can_supply_side_and_malformed_mirror_rows_are_counted():
    sale = outcome(side=None, action="SELL_YES", exitType="sale", orderId="sell-a")
    report = MODULE.audit([sale, None], entries=[entry()])
    assert report["complete"]["markets"] == 1
    assert report["dataQualityCounts"]["malformedRows"] == 1


def test_cli_json_gzip_and_input_is_not_mutated(tmp_path, capsys):
    data = state()
    before = copy.deepcopy(data)
    MODULE.audit(data)
    assert data == before
    path = tmp_path / "state.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        json.dump(data, handle)
    assert MODULE.main([str(path), "--include-markets"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["complete"]["markets"] == 1
    assert report["markets"][0]["ticker"] == "KXBTC15M-A"
    assert "buy-KXBTC15M-A" not in json.dumps(report)  # No order identifiers emitted.
    missing = tmp_path / "missing.json"
    assert MODULE.main([str(missing)]) == 2
    assert "audit error:" in capsys.readouterr().err


def test_payoff_statistics_explain_why_winning_more_often_can_lose_money():
    buys = [entry(f"KXBTC15M-{index}") for index in range(3)]
    exits = [outcome(row["ticker"], pnl=pnl) for row, pnl in zip(buys, [0.2, 0.2, -0.8])]
    stats = MODULE.audit(state(buys, exits))["complete"]
    assert stats["winRate"] == pytest.approx(2 / 3)
    assert stats["averageWin"] == 0.2
    assert stats["averageLossMagnitude"] == 0.8
    assert stats["breakEvenWinRate"] == 0.8
    assert stats["netPnl"] == -0.4


def _timed_state(specifications):
    buys, exits = [], []
    for ticker, entered, completed, pnl in specifications:
        buys.append(entry(ticker, generatedAt=entered))
        exits.append(outcome(ticker, settledAt=completed, pnl=pnl))
    return state(buys, exits)


def test_daily_stop_waits_for_completed_events_and_retains_existing_positions():
    data = _timed_state([
        ("KXBTC15M-A", "2026-08-01T12:00:00Z", "2026-08-01T12:10:00Z", -1),
        ("KXBTC15M-B", "2026-08-01T12:11:00Z", "2026-08-01T12:20:00Z", -1),
        ("KXBTC15M-C", "2026-08-01T12:21:00Z", "2026-08-01T12:30:00Z", -1),
        # This position is already open when the third loss completes.
        ("KXBTC15M-D", "2026-08-01T12:25:00Z", "2026-08-01T12:35:00Z", 1),
        ("KXBTC15M-E", "2026-08-01T12:31:00Z", "2026-08-01T12:40:00Z", -2),
        # A later win from an open position must not unlatch the day's stop.
        ("KXBTC15M-F", "2026-08-01T12:36:00Z", "2026-08-01T12:45:00Z", -2),
    ])
    result = MODULE.audit(data, loss_stop_threshold=3)["dailyLossStopScenario"]["btc15"]
    assert result["baseline"]["events"] == 6
    assert result["withStop"]["events"] == 4
    assert result["withStop"]["netPnl"] == -2
    assert result["skipped"]["netPnl"] == -4
    assert result["stoppedDays"] == [{"date": "2026-08-01", "haltedAt": "2026-08-01T12:30:00Z"}]
    assert "not_backtest" in result["mode"]


def test_stop_resets_at_new_york_midnight_not_utc_midnight_and_families_are_separate():
    data = _timed_state([
        ("KXBTC15M-A", "2026-08-01T23:00:00Z", "2026-08-01T23:15:00Z", -1),
        ("KXBTC15M-B", "2026-08-02T00:00:00Z", "2026-08-02T00:15:00Z", -1),
        ("KXBTC15M-C", "2026-08-02T01:00:00Z", "2026-08-02T01:15:00Z", -1),
        ("KXBTC15M-D", "2026-08-02T03:59:00Z", "2026-08-02T04:05:00Z", -1),
        ("KXBTC15M-E", "2026-08-02T04:00:00Z", "2026-08-02T04:15:00Z", 0.2),
        ("KXBTCD-X-T1", "2026-08-02T02:00:00Z", "2026-08-02T03:00:00Z", 0.3),
    ])
    result = MODULE.audit(data, loss_stop_threshold=3)["dailyLossStopScenario"]
    assert result["btc15"]["skipped"]["events"] == 1
    assert result["btc15"]["withStop"]["events"] == 4
    assert result["btc15"]["stoppedDays"][0]["date"] == "2026-08-01"
    assert result["btc_hourly"]["withStop"]["events"] == 1


def test_hourly_strikes_aggregate_before_losses_and_partial_events_are_excluded():
    data = _timed_state([
        ("KXBTCD-A-T1", "2026-08-01T12:00:00Z", "2026-08-01T12:15:00Z", -0.5),
        ("KXBTCD-A-T2", "2026-08-01T12:00:00Z", "2026-08-01T12:16:00Z", 1.0),
        ("KXBTCD-B-T1", "2026-08-01T13:00:00Z", "2026-08-01T13:15:00Z", -1.0),
        ("KXBTCD-C-T1", "2026-08-01T14:00:00Z", "2026-08-01T14:15:00Z", -1.0),
        ("KXBTCD-C-T2", "2026-08-01T14:00:00Z", "2026-08-01T14:16:00Z", -0.2),
    ])
    data["strategy"]["settlementRecords"][-1]["contracts"] = 0.5
    result = MODULE.audit(data, loss_stop_threshold=1)["dailyLossStopScenario"]["btc_hourly"]
    assert result["excludedIncompleteOrAmbiguousEvents"] == 1
    assert result["baseline"]["events"] == 2
    assert result["baseline"]["wins"] == 1
    assert result["baseline"]["netPnl"] == -0.5
    assert result["stoppedDays"][0]["haltedAt"] == "2026-08-01T13:15:00Z"


def test_simultaneous_entry_cannot_use_outcome_at_same_timestamp_and_flat_breaks_streak():
    data = _timed_state([
        ("KXBTC15M-A", "2026-08-01T12:00:00Z", "2026-08-01T12:10:00Z", -1),
        ("KXBTC15M-B", "2026-08-01T12:10:00Z", "2026-08-01T12:20:00Z", 0),
        ("KXBTC15M-C", "2026-08-01T12:21:00Z", "2026-08-01T12:30:00Z", -1),
    ])
    one = MODULE.audit(data, loss_stop_threshold=1)["dailyLossStopScenario"]["btc15"]
    assert one["withStop"]["events"] == 2
    two = MODULE.audit(data, loss_stop_threshold=2)["dailyLossStopScenario"]["btc15"]
    assert two["withStop"]["events"] == 3
    assert two["stoppedDays"] == []


@pytest.mark.parametrize("threshold", [True, 0, -1, 2.5])
def test_loss_stop_rejects_invalid_thresholds(threshold):
    with pytest.raises(ValueError, match="positive integer"):
        MODULE.audit(state(), loss_stop_threshold=threshold)


def test_loss_stop_rejects_unknown_timezone():
    with pytest.raises(ValueError, match="IANA timezone"):
        MODULE.audit(state(), loss_stop_threshold=3, loss_stop_timezone="invalid/zone")
