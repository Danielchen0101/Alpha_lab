import copy
import json
from datetime import datetime, timezone

import pytest

import kalshi_daily_risk
from kalshi_daily_risk import daily_risk_for_ticker, rebuild_daily_risk
from kalshi_robot_state import KalshiRobotState


NOW = datetime(2026, 10, 9, 20, tzinfo=timezone.utc)


def entry(ticker, count=1, order_id=None, environment="paper"):
    return {
        "ticker": ticker, "action": "BUY_YES", "fillCount": count,
        "orderId": order_id or ticker, "environment": environment,
    }


def outcome(ticker, pnl, hour=12, contracts=1, key=None, **extra):
    return {
        "key": key or ticker, "ticker": ticker, "pnl": pnl,
        "settledAt": f"2026-10-09T{hour:02d}:00:00Z", "contracts": contracts,
        "exitType": "settlement", **extra,
    }


def test_three_fee_net_losses_latch_until_next_new_york_day():
    entries = [entry(f"KXBTC15M-{index}") for index in range(4)]
    strategy = {"realizedTradeRecords": [
        outcome(row["ticker"], -0.01 if index < 3 else 5, 12 + index)
        for index, row in enumerate(entries)
    ]}
    risks = rebuild_daily_risk(strategy, entries, now=NOW)
    risk = risks["btc15m"]
    assert risk["stopped"]
    assert risk["consecutiveLosses"] == 0
    assert risk["maxConsecutiveLosses"] == 3
    assert risk["netPnl"] == 4.97
    assert risk["stoppedAt"] == "2026-10-09T14:00:00Z"
    assert risk["resumeAt"] == "2026-10-10T04:00:00Z"
    assert not risks["btchourly"]["stopped"]

    strategy["dailyRiskByFamily"] = risks
    # Late/corrected history cannot unlock a stopped strategy during the day.
    strategy["realizedTradeRecords"] = []
    assert rebuild_daily_risk(strategy, entries, now=NOW)["btc15m"]["stopped"]
    next_day = datetime(2026, 10, 10, 4, tzinfo=timezone.utc)
    assert not daily_risk_for_ticker(strategy, entries[0]["ticker"], next_day)["stopped"]
    assert not rebuild_daily_risk(strategy, entries, now=next_day)["btc15m"]["stopped"]


def test_breakeven_interrupts_streak_and_unrealized_losses_do_not_count():
    entries = [entry(f"KXBTC15M-{index}") for index in range(5)]
    strategy = {"realizedTradeRecords": [
        outcome(entries[index]["ticker"], pnl, 12 + index)
        for index, pnl in enumerate([-1, -1, 0, -1])
    ]}
    risk = rebuild_daily_risk(strategy, entries, now=NOW)["btc15m"]
    assert risk["consecutiveLosses"] == 1
    assert risk["maxConsecutiveLosses"] == 2
    assert risk["completedOutcomes"] == 4
    assert not risk["stopped"]


def test_partial_sales_combine_with_final_settlement_as_one_net_outcome():
    ticker = "KXBTC15M-PARTIAL"
    entries = [entry(ticker, count=4)]
    strategy = {"realizedTradeRecords": [
        outcome(ticker, -1, key="sale-1", exitType="sale"),
        outcome(ticker, -1, key="sale-2", exitType="sale"),
        outcome(ticker, -1, key="sale-3", exitType="sale"),
    ]}
    partial = rebuild_daily_risk(strategy, entries, now=NOW)["btc15m"]
    assert partial["completedOutcomes"] == 0
    assert not partial["stopped"]
    strategy["realizedTradeRecords"].append(outcome(ticker, 4, key="final", hour=13))
    complete = rebuild_daily_risk(strategy, entries, now=NOW)["btc15m"]
    assert complete["completedOutcomes"] == 1
    assert complete["consecutiveLosses"] == 0
    assert complete["netPnl"] == 1


def test_hourly_strikes_form_one_event_and_wait_until_every_owned_market_closes():
    tickers = [f"KXBTCD-26OCT0913-T{strike}" for strike in (61000, 61100, 61200)]
    strategy = {"realizedTradeRecords": [outcome(ticker, -1) for ticker in tickers[:2]]}
    entries = [entry(ticker) for ticker in tickers]
    assert rebuild_daily_risk(strategy, entries, now=NOW)["btchourly"]["completedOutcomes"] == 0
    strategy["realizedTradeRecords"].append(outcome(tickers[2], 0.5))
    risk = rebuild_daily_risk(strategy, entries, now=NOW)["btchourly"]
    assert risk["completedOutcomes"] == 1
    assert risk["consecutiveLosses"] == 1
    assert risk["netPnl"] == -1.5
    assert risk["recentOutcomes"][0]["eventTicker"] == "KXBTCD-26OCT0913"


def test_new_york_date_and_dst_resume_are_calendar_based():
    ticker = "KXBTC15M-NIGHT"
    at = datetime(2026, 10, 10, 3, 59, tzinfo=timezone.utc)
    strategy = {"realizedTradeRecords": [outcome(ticker, -1, settledAt="2026-10-10T02:00:00Z")]}
    risk = rebuild_daily_risk(strategy, [entry(ticker)], now=at)["btc15m"]
    assert risk["date"] == "2026-10-09"
    assert risk["completedOutcomes"] == 1
    after_midnight = at.replace(hour=4)
    assert rebuild_daily_risk(strategy, [entry(ticker)], now=after_midnight)["btc15m"]["completedOutcomes"] == 0
    fall_back = datetime(2026, 11, 1, 4, 30, tzinfo=timezone.utc)
    assert daily_risk_for_ticker({}, ticker, fall_back)["resumeAt"] == "2026-11-02T05:00:00Z"


def test_real_manual_history_is_not_strategy_loss_evidence():
    ticker = "KXBTC15M-MANUAL"
    fill = {"ticker": ticker, "order_id": "manual-order", "action": "BUY", "fill_count_fp": 1}
    strategy = {"realizedTradeRecords": [outcome(ticker, -1, environment="real")]}
    assert rebuild_daily_risk(strategy, [], fills=[fill], environment="real", now=NOW)["btc15m"]["completedOutcomes"] == 0
    fill["alphaLabManaged"] = True
    assert rebuild_daily_risk(strategy, [], fills=[fill], environment="real", now=NOW)["btc15m"]["completedOutcomes"] == 1


def test_duplicate_partial_entry_fills_do_not_fabricate_completed_quantity():
    ticker = "KXBTC15M-QUANTITY"
    trades = [entry(ticker, count=1, order_id="buy")]
    fills = [
        {"ticker": ticker, "action": "BUY", "order_id": "buy", "fill_id": "fill1", "count_fp": 0.4},
        {"ticker": ticker, "action": "BUY", "order_id": "buy", "fill_id": "fill2", "count_fp": 0.6},
    ]
    strategy = {"realizedTradeRecords": [outcome(ticker, -1)]}
    complete = rebuild_daily_risk(strategy, trades, fills=fills + fills, now=NOW)["btc15m"]
    assert complete["completedOutcomes"] == 1
    strategy["realizedTradeRecords"][0]["contracts"] = 0.4
    assert rebuild_daily_risk(strategy, trades, fills=fills[:1], now=NOW)["btc15m"]["completedOutcomes"] == 0


def test_quantity_mismatch_and_missing_entry_do_not_count_as_completed():
    ticker = "KXBTC15M-BAD-QUANTITY"
    strategy = {"realizedTradeRecords": [outcome(ticker, -1, contracts=2)]}
    assert rebuild_daily_risk(strategy, [entry(ticker)], now=NOW)["btc15m"]["completedOutcomes"] == 0
    assert rebuild_daily_risk(strategy, [], now=NOW)["btc15m"]["completedOutcomes"] == 0


def test_requested_order_quantity_and_explicit_zero_are_not_fills():
    ticker = "KXBTC15M-ORDER-QUANTITY"
    strategy = {"realizedTradeRecords": [outcome(ticker, -0.1, contracts=0.2)]}
    filled = {**entry(ticker), "count_fp": 1, "fill_count_fp": 0.2}
    assert rebuild_daily_risk(strategy, [filled], now=NOW)["btc15m"]["completedOutcomes"] == 1
    filled["fill_count_fp"] = 0
    assert rebuild_daily_risk(strategy, [filled], now=NOW)["btc15m"]["completedOutcomes"] == 0


def test_state_stop_survives_restart_configure_and_reconciliation(tmp_path, monkeypatch):
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW.astimezone(tz) if tz else NOW.replace(tzinfo=None)

    monkeypatch.setattr(kalshi_daily_risk, "datetime", FixedDateTime)
    path = tmp_path / "risk.json"
    store = KalshiRobotState(str(path))
    settlements = []
    for index in range(3):
        ticker = f"KXBTC15M-LOSS-{index}"
        store.record("u", {
            "generatedAt": f"2026-10-09T{11 + index}:50:00Z", "action": "BUY_YES", "side": "YES",
            "market": {"ticker": ticker}, "edge": {"price": 0.6, "fairProbability": 0.7},
        }, {"order_id": ticker, "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker, "settled_time": f"2026-10-09T{12 + index}:00:00Z",
            "market_result": "NO", "yes_count_fp": 1,
            "yes_total_cost_dollars": 0.6, "fee_cost_dollars": 0.01, "revenue_dollars": 0,
        })
    first = store.reconcile_settlements("u", settlements)
    assert first["strategy"]["dailyRiskByFamily"]["btc15m"]["stopped"]
    restored = KalshiRobotState(str(path))
    configured = restored.configure("u", False, {"minNetEdge": 0.03})
    risk = configured["strategy"]["dailyRiskByFamily"]["btc15m"]
    assert risk["stopped"]
    assert risk["netPnl"] == -1.83
    assert restored.reconcile_settlements("u", settlements)["strategy"]["dailyRiskByFamily"]["btc15m"] == risk
    assert not configured["modeState"]["real"]["strategy"].get("dailyRiskByFamily", {}).get("btc15m", {}).get("stopped")


def test_multi_fill_close_orders_keep_all_net_pnl_and_replays_are_idempotent(tmp_path):
    store = KalshiRobotState(str(tmp_path / "fills.json"))
    fills = [
        {
            "fill_id": f"sell-fill-{index}", "order_id": "sell-order", "ticker": "KXBTC15M-MULTIFILL",
            "action": "SELL", "reduce_only": True, "outcome_side": "YES", "fill_count_fp": count,
            "position_cost_dollars": count * 0.6, "gross_proceeds_dollars": count * 0.4,
            "average_price_dollars": 0.4, "entry_fee_allocated_dollars": 0.01,
            "fee_cost_dollars": 0.01, "realized_pnl_dollars": -count * 0.2 - 0.02,
            "created_time": f"2026-10-09T12:00:0{index}Z",
        }
        for index, count in enumerate((1, 2))
    ]
    first = store.reconcile_settlements("u", [], fills + fills)
    closed = first["strategy"]["closedTradeRecords"][0]
    assert closed["count"] == 3
    assert closed["pnl"] == pytest.approx(-0.64)
    assert closed["fees"] == pytest.approx(0.04)
    replay = store.reconcile_settlements("u", [], fills)
    assert replay["strategy"]["closedTradeRecords"] == [closed]
    partial_history = store.reconcile_settlements("u", [], fills[:1])
    assert partial_history["strategy"]["closedTradeRecords"] == [closed]


def test_delayed_entry_fill_quantity_survives_truncation_and_preserves_daily_streak(tmp_path, monkeypatch):
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW.astimezone(tz) if tz else NOW.replace(tzinfo=None)

    monkeypatch.setattr(kalshi_daily_risk, "datetime", FixedDateTime)
    path = tmp_path / "delayed.json"
    store = KalshiRobotState(str(path))
    ticker = "KXBTC15M-DELAYED-PARTIAL-ENTRY"
    store.configure("u", False, {"executionMode": "real"})
    store.record("u", {
        "generatedAt": "2026-10-09T12:00:00Z", "action": "BUY_YES", "side": "YES",
        "market": {"ticker": ticker}, "config": {"executionMode": "real"},
        "edge": {"price": .6, "fairProbability": .7},
    }, {"order_id": "buy", "status": "filled", "fill_count_fp": 1, "environment": "real"})
    fills = [
        {"order_id": "buy", "fill_id": f"buy-{index}", "ticker": ticker, "action": "BUY",
         "outcome_side": "YES", "fill_count_fp": 1, "environment": "real"}
        for index in (1, 2)
    ]
    first = store.reconcile_live_fills("u", fills + fills, environment="real")
    assert first["modeState"]["real"]["filledTrades"][0]["fillCount"] == 2
    store.record_early_close("u", {
        "action": "SELL_YES", "side": "YES", "generatedAt": "2026-10-09T13:00:00Z",
        "market": {"ticker": ticker},
    }, {
        "order_id": "sell", "ticker": ticker, "action": "SELL", "outcome_side": "YES",
        "fill_count_fp": 2, "realized_pnl_dollars": -.4,
        "created_time": "2026-10-09T13:00:00Z",
    }, environment="real")
    restored = KalshiRobotState(str(path))
    truncated = restored.reconcile_live_fills("u", fills[:1], environment="real")
    bucket = truncated["modeState"]["real"]
    assert bucket["filledTrades"][0]["fillCount"] == 2
    risk = rebuild_daily_risk(bucket["strategy"], bucket["filledTrades"], fills=fills[:1], environment="real", now=NOW)["btc15m"]
    assert risk["consecutiveLosses"] == 1
    assert risk["completedOutcomes"] == 1


def test_entry_quantity_increase_requires_order_ticker_side_and_unique_fill_proof(tmp_path):
    store = KalshiRobotState(str(tmp_path / "entry-proof.json"))
    ticker = "KXBTC15M-ENTRY-PROOF"
    store.configure("u", False, {"executionMode": "real"})
    store.record("u", {
        "action": "BUY_YES", "side": "YES", "market": {"ticker": ticker},
        "config": {"executionMode": "real"},
    }, {"order_id": "buy", "status": "filled", "fill_count_fp": 1, "environment": "real"})
    base = {"order_id": "buy", "ticker": ticker, "action": "BUY", "outcome_side": "YES", "fill_count_fp": 1}
    mismatches = [
        {**base, "fill_id": "wrong-side", "outcome_side": "NO", "fill_count_fp": 10},
        {**base, "fill_id": "wrong-ticker", "ticker": "KXBTC15M-OTHER", "fill_count_fp": 10},
        {**base, "fill_id": "wrong-order", "order_id": "manual", "fill_count_fp": 10},
        {**base, "fill_id": "wrong-mode", "environment": "paper", "fill_count_fp": 10},
    ]
    state = store.reconcile_live_fills("u", [base, base, *mismatches], environment="real")
    assert state["modeState"]["real"]["filledTrades"][0]["fillCount"] == 1


@pytest.mark.parametrize("custom", [False, True])
@pytest.mark.parametrize("environment", ["paper", "real"])
def test_v16_migration_preserves_all_existing_limits_arming_and_trades(tmp_path, custom, environment):
    config = {
        "executionMode": environment, "riskPerTradePct": 0.25 if custom else 0.5,
        "maxSingleMarketExposurePct": 1 if custom else 2,
        "maxPortfolioExposurePct": 8 if custom else 10,
    }
    arming = {"armed": True, "awaitingExplicitEnable": False}
    ledger = [{"orderId": "keep", "ticker": "KXBTC15M-OLD"}]
    state = {
        "storageVersion": 15, "activeEnvironment": environment, "enabled": True,
        "config": config, "modeState": {environment: {
            "config": copy.deepcopy(config), "arming": arming,
            "filledTrades": ledger, "strategy": {},
        }},
    }
    path = tmp_path / "old.json"
    path.write_text(json.dumps({"u": state}))
    real = KalshiRobotState(str(path)).get("u")["modeState"][environment]
    for field in ("riskPerTradePct", "maxSingleMarketExposurePct", "maxPortfolioExposurePct"):
        assert real["config"][field] == config[field]
    assert real["arming"] == arming
    assert real["filledTrades"] == ledger
    assert real["strategy"]["version"] == 12
    assert real["strategy"]["name"] == "BTC Dual-Market Daily-Risk v12"
    assert real["strategy"]["changes"][0]["version"] == 12
