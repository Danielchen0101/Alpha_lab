import pytest

import start_quant_backend as backend


def _bars(closes, opens=None):
    opens = opens or closes
    return [
        {
            "timestamp": f"2025-01-{index + 1:02d}",
            "open": float(opens[index]),
            "high": float(max(opens[index], close) + 1),
            "low": float(min(opens[index], close) - 1),
            "close": float(close),
            "volume": 1_000_000,
        }
        for index, close in enumerate(closes)
    ]


def test_shared_executor_fills_completed_bar_signals_at_next_open_and_debits_both_sides():
    rows = _bars([100, 105, 95, 96], opens=[100, 110, 90, 96])

    def signals(index, _context):
        if index == 0:
            return {"action": "BUY", "reason": "test entry"}
        if index == 1:
            return {"action": "SELL", "reason": "test exit"}
        return None

    trades, equity = backend._bt_execute_long_signals(
        rows,
        signals,
        1_000,
        "TEST",
        round_trip_cost_bps=100,
    )

    assert len(trades) == 1
    trade = trades[0]
    assert trade["entrySignalDate"] == rows[0]["timestamp"]
    assert trade["entryDate"] == rows[1]["timestamp"]
    assert trade["rawEntryPrice"] == 110
    assert trade["exitSignalDate"] == rows[1]["timestamp"]
    assert trade["exitDate"] == rows[2]["timestamp"]
    assert trade["rawExitPrice"] == 90
    assert trade["entryPrice"] == pytest.approx(110.55)
    assert trade["exitPrice"] == pytest.approx(89.55)
    assert trade["transactionCost"] == pytest.approx(9.0)
    assert trade["pnl"] == pytest.approx(-189.0)
    assert equity[-1]["equity"] == pytest.approx(811.0)
    assert equity[-1]["grossEquity"] == pytest.approx(820.0)


def test_ma_and_rsi_wrappers_use_the_same_next_open_contract():
    ma_rows = _bars(
        [10, 9, 8, 9, 12, 13, 14],
        opens=[10, 9, 8, 9, 12, 50, 14],
    )
    ma_trades, _ = backend.run_moving_average_strategy_for_optimization(
        ma_rows,
        {"shortMaPeriod": 2, "longMaPeriod": 3},
        10_000,
        "MA",
    )
    assert ma_trades
    assert ma_trades[0]["entrySignalDate"] == ma_rows[4]["timestamp"]
    assert ma_trades[0]["entryDate"] == ma_rows[5]["timestamp"]
    assert ma_trades[0]["rawEntryPrice"] == 50

    rsi_rows = _bars(
        [10, 9, 8, 9, 12, 11],
        opens=[10, 9, 8, 20, 12, 30],
    )
    rsi_trades, _ = backend.run_rsi_strategy_for_optimization(
        rsi_rows,
        {"rsiPeriod": 2, "oversoldLevel": 40, "overboughtLevel": 60},
        10_000,
        "RSI",
    )
    assert rsi_trades
    assert rsi_trades[0]["entrySignalDate"] == rsi_rows[2]["timestamp"]
    assert rsi_trades[0]["entryDate"] == rsi_rows[3]["timestamp"]
    assert rsi_trades[0]["rawEntryPrice"] == 20
    assert rsi_trades[0]["exitSignalDate"] == rsi_rows[4]["timestamp"]
    assert rsi_trades[0]["exitDate"] == rsi_rows[5]["timestamp"]
    assert rsi_trades[0]["rawExitPrice"] == 30


def test_former_same_close_momentum_strategy_now_waits_for_next_open():
    rows = _bars(
        [100, 100, 110, 115, 120],
        opens=[100, 100, 110, 200, 120],
    )
    trades, _ = backend.run_momentum_strategy_for_optimization(
        rows,
        {"momentum_period": 1, "momentum_threshold": 0},
        100_000,
        "MOM",
    )

    assert trades
    assert trades[0]["entrySignalDate"] == rows[2]["timestamp"]
    assert trades[0]["entryDate"] == rows[3]["timestamp"]
    assert trades[0]["rawEntryPrice"] == 200
    assert trades[0]["rawEntryPrice"] != rows[2]["close"]


def test_tail_position_is_liquidated_and_counted_with_costs_in_metrics():
    rows = _bars([100, 110, 120], opens=[100, 102, 111])
    result, error = backend._run_backtest_core(
        "HOLD",
        "buy_hold",
        {"_roundTripCostBps": 20},
        rows,
        10_000,
    )

    assert error is None
    assert result["metrics"]["tradeCount"] == 1
    assert result["tradeCount"] == 1
    assert result["trades"][0]["forcedExit"] is True
    assert result["trades"][0]["exitDate"] == rows[-1]["timestamp"]
    assert result["trades"][0]["rawExitPrice"] == rows[-1]["close"]
    assert result["metrics"]["transactionCostDollars"] > 0
    assert result["metrics"]["costsIncluded"] is True
    assert result["metrics"]["totalReturn"] < result["metrics"]["grossTotalReturn"]
    assert result["finalEquity"] == result["equityCurve"][-1]["equity"]


def test_institutional_packet_does_not_charge_embedded_costs_twice():
    candidate = {
        "symbol": "TEST",
        "dataQuality": "good",
        "estimatedRoundTripCostBps": 20,
        "avgDollarVolume20": 100_000_000,
        "benchmarkReturns": {"SPY": {"12m": 15}},
    }
    metrics = {
        "grossTotalReturn": 30,
        "totalReturn": 27.6,
        "netTotalReturn": 27.6,
        "costsIncluded": True,
        "sharpeRatio": 1.5,
        "maxDrawdown": 12,
        "winRate": 56,
        "profitFactor": 1.7,
        "tradeCount": 12,
    }
    packet = backend._build_institutional_dv_packet(
        candidate,
        metrics,
        {"score": 80, "profitableRatio": 0.8, "medianReturn": 18, "returnSpread": 8},
        "Consistent",
        {"riskReward1": 1.8},
        {"status": "PASS", "reason": "ok"},
        "momentum",
        "test",
        252,
        6,
        6,
        oos_validation={
            "available": True,
            "method": "anchored_walk_forward_v1",
            "foldCount": 3,
            "positiveFoldRatio": 0.67,
            "worstFoldReturn": 0.5,
            "holdoutReturn": 6,
            "holdoutSharpe": 0.8,
            "holdoutTrades": 6,
        },
    )

    assert packet["grossReturn"] == 30
    assert packet["netReturn"] == 27.6
    assert packet["estimatedCostDragPct"] == 2.4
