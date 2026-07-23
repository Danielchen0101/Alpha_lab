import math
import random
from datetime import datetime, timedelta, timezone

import pytest

from crypto_engine import (
    ALGORITHM_NAME,
    ALGORITHM_VERSION,
    CryptoEngineError,
    DEFAULT_CONFIG,
    apply_fill_to_position_state,
    backtest,
    compute_indicators,
    evaluate_risk_circuit,
    generate_signal,
    required_history_bars,
    validate_config,
)


def _bar(start, index, open_price, close, volume=1000.0):
    return {
        "t": (start + timedelta(hours=index)).isoformat(),
        "o": open_price,
        "h": max(open_price, close) * 1.001,
        "l": min(open_price, close) * 0.999,
        "c": close,
        "v": volume,
    }


def _hourly_bars(count=1700, start_price=100.0, hourly_return=0.00025):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], start_price
    for index in range(count):
        close = price * (1 + hourly_return)
        bars.append(_bar(start, index, price, close, 1000 + index))
        price = close
    return bars


def _noisy_trend_bars(count=1700, seed=5, drift=0.0004, sigma=0.002):
    rng = random.Random(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], 100.0
    for index in range(count):
        close = price * math.exp(drift + rng.gauss(0, sigma))
        bars.append(_bar(start, index, price, close, 900 + rng.random() * 200))
        price = close
    return bars


def _range_with_dip_bars(count=1700, seed=23):
    """High-noise low-ADX chop above a drifting anchor, ending in a sharp dip.

    Calibrated so the final bar sits in a ``range`` regime with a stretched
    Bollinger z-score and washed-out fast RSI while the close stays above the
    200-bar anchor — the exact conditions of a mean-reversion dip entry.
    """

    rng = random.Random(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], 100.0
    for index in range(count):
        if index >= count - 3:
            close = price * 0.993  # three sharp down hours into the close
        else:
            close = price * math.exp(0.0002 + rng.gauss(0, 0.006))
        bars.append(_bar(start, index, price, close, 900 + rng.random() * 200))
        price = close
    return bars


def _panic_bars(count=1700, seed=11):
    """Calm series that collapses hard on expanding volatility at the end."""

    rng = random.Random(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], 100.0
    for index in range(count):
        if index < count - 12:
            ret = 0.0002 + rng.gauss(0, 0.0012)
        else:
            ret = -0.03 + rng.gauss(0, 0.004)
        close = price * math.exp(ret)
        bars.append(_bar(start, index, price, close, 1500 + rng.random() * 300))
        price = close
    return bars


# --------------------------------------------------------------------- config


def test_config_is_strict_and_supports_only_first_release_spot_universe():
    resolved = validate_config({"symbols": ["btc/usd", "ETH/USD"]})

    assert resolved["symbols"] == ["BTC/USD", "ETH/USD"]
    assert required_history_bars(resolved) == 65 * 24 + 1
    with pytest.raises(CryptoEngineError, match="unsupported spot symbol"):
        validate_config({"symbols": ["DOGE/USD"]})
    with pytest.raises(CryptoEngineError, match="unknown config"):
        validate_config({"max_weigth": 0.5})
    with pytest.raises(CryptoEngineError, match="score thresholds"):
        validate_config({"entry_score": 90, "add_score": 80})
    with pytest.raises(CryptoEngineError, match="bars_per_day must be 24"):
        validate_config({"bars_per_day": 12})
    with pytest.raises(CryptoEngineError, match="max_stop_distance_pct must be below one"):
        validate_config({"max_stop_distance_pct": 1.0})
    with pytest.raises(CryptoEngineError, match="must be in"):
        validate_config({"slippage_bps": 10_000})


def test_v2_ensemble_fields_validate_and_legacy_v1_configs_still_load():
    with pytest.raises(CryptoEngineError, match="panic_vol_ratio"):
        validate_config({"panic_vol_ratio": 0.9})
    with pytest.raises(CryptoEngineError, match="weights cannot all be zero"):
        validate_config({
            "weight_trend": 0, "weight_breakout": 0,
            "weight_momentum": 0, "weight_meanrev": 0,
        })
    with pytest.raises(CryptoEngineError, match="ml_veto_threshold"):
        validate_config({"ml_veto_threshold": 0.9})
    with pytest.raises(CryptoEngineError, match="ml_gate_enabled"):
        validate_config({"ml_gate_enabled": "yes"})

    # Every v1 field name remains valid so persisted configs need no migration.
    v1_only = {
        "symbols": ["BTC/USD"], "bars_per_day": 24, "ema_fast": 10, "ema_slow": 40,
        "momentum_fast_days": 20, "momentum_slow_days": 65, "atr_hours": 24,
        "volatility_days": 30, "breakout_days": 20, "breakdown_days": 10,
        "entry_confirmation_bars": 2, "exit_confirmation_bars": 2,
        "entry_score": 60.0, "add_score": 80.0, "reduce_score": 40.0,
        "max_asset_weight": 0.20, "rebalance_band": 0.02,
        "add_min_price_gain_pct": 0.03, "reduced_weight_fraction": 0.25,
        "annual_volatility_target": 0.15, "high_volatility_threshold": 1.00,
        "stop_atr_multiple": 2.5, "min_stop_distance_pct": 0.02,
        "max_stop_distance_pct": 0.12, "fee_bps": 25.0, "slippage_bps": 5.0,
        "daily_loss_limit": 0.015, "seven_day_loss_limit": 0.04,
        "max_drawdown_limit": 0.08, "data_stale_minutes": 90,
    }
    resolved = validate_config(v1_only)
    assert resolved["weight_trend"] == DEFAULT_CONFIG["weight_trend"]

    # The short-cadence preset applied by crypto_api keeps validating, with the
    # fast volatility window clamped inside the shrunken slow window.
    short = dict(v1_only)
    short.update({
        "bars_per_day": 96, "momentum_fast_days": 2, "momentum_slow_days": 7,
        "volatility_days": 3, "breakout_days": 2, "breakdown_days": 1,
        "atr_hours": 16, "entry_confirmation_bars": 1, "exit_confirmation_bars": 1,
    })
    resolved_short = validate_config(short)
    assert resolved_short["vol_fast_days"] < resolved_short["volatility_days"]


# ---------------------------------------------------------------- market data


def test_market_data_must_be_strictly_ascending_and_valid_ohlc():
    bars = _hourly_bars(3)
    bars[2]["t"] = bars[1]["t"]
    with pytest.raises(CryptoEngineError, match="strictly ascending"):
        compute_indicators(bars)

    bad = _hourly_bars(3)
    bad[1]["h"] = bad[1]["l"] / 2
    with pytest.raises(CryptoEngineError, match="inconsistent"):
        compute_indicators(bad)


def test_market_data_must_be_contiguous_strategy_intervals():
    bars = _hourly_bars(6)
    stamp = datetime.fromisoformat(bars[3]["t"])
    bars[3]["t"] = (stamp + timedelta(minutes=30)).isoformat()
    with pytest.raises(CryptoEngineError, match="contiguous"):
        compute_indicators(bars)


def test_breakout_level_excludes_current_bar_and_indicators_have_no_future_leakage():
    bars = _hourly_bars()
    rows = compute_indicators(bars)
    index = len(rows) - 1
    window = DEFAULT_CONFIG["breakout_days"] * 24
    highs = [bar["h"] for bar in bars[index - window : index]]
    assert rows[index]["high_20d"] == pytest.approx(max(highs))

    # Appending a future bar must not rewrite any earlier indicator row.
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    extended = bars + [_bar(start, len(bars), bars[-1]["c"], bars[-1]["c"] * 1.3)]
    rows_extended = compute_indicators(extended)
    for key in ("ema_10", "ema_40", "rsi", "adx", "zscore", "momentum_20d", "high_20d"):
        assert rows_extended[index][key] == rows[index][key]


# -------------------------------------------------------------------- signals


def test_trend_entry_signal_is_explainable_and_long_flat_only():
    signal = generate_signal(_hourly_bars())

    assert signal["algorithm"] == ALGORITHM_NAME
    assert signal["version"] == ALGORITHM_VERSION
    assert signal["action"] == "BUY"
    assert signal["regime"] == "trend_up"
    assert signal["evidence"]["entry_mode"] == "trend"
    assert 0 < signal["target_weight"] <= DEFAULT_CONFIG["max_asset_weight"]
    assert signal["score"] >= DEFAULT_CONFIG["entry_score"]
    assert set(signal["ensemble"]["votes"]) == {"trend", "breakout", "momentum", "meanrev"}
    assert abs(sum(signal["ensemble"]["weights"].values()) - 1.0) < 0.02
    assert signal["allowed_actions"] == ["BUY", "HOLD"]
    assert (
        DEFAULT_CONFIG["min_stop_distance_pct"]
        <= signal["stop_distance_pct"]
        <= DEFAULT_CONFIG["max_stop_distance_pct"]
    )
    assert signal["reasons"]


def test_range_regime_dip_entry_skips_multi_bar_confirmation():
    bars = _range_with_dip_bars()
    signal = generate_signal(bars)

    assert signal["regime"] == "range"
    # Dip entries execute on the signal bar (no multi-bar confirmation wait)
    # and are sized down by meanrev_size_fraction.
    assert signal["action"] == "BUY"
    assert signal["evidence"]["entry_mode"] == "dip"
    assert signal["ensemble"]["votes"]["meanrev"] >= 0.6
    maximum = DEFAULT_CONFIG["max_asset_weight"] * DEFAULT_CONFIG["meanrev_size_fraction"]
    assert 0 < signal["target_weight"] <= maximum + 1e-9


def test_panic_regime_forces_exit_of_open_position_without_confirmation():
    bars = _panic_bars()
    position = {"weight": 0.1, "average_entry_price": 95.0}
    signal = generate_signal(bars, position=position)

    assert signal["regime"] == "panic"
    assert signal["action"] == "EXIT"
    assert signal["target_weight"] == 0.0
    assert (
        signal["evidence"]["panic_exit"]
        or signal["evidence"]["breakdown"]
        or signal["evidence"]["stop_triggered"]
    )


def test_flat_book_in_panic_regime_never_buys():
    signal = generate_signal(_panic_bars())
    assert signal["action"] == "HOLD"
    assert signal["target_weight"] == 0.0
    assert signal["score"] <= 50.0


def test_ml_advisor_adjusts_score_boundedly_and_can_veto_entries():
    bars = _hourly_bars()
    baseline = generate_signal(bars)
    boosted = generate_signal(bars, ml_signal={"probability_up": 1.0})
    suppressed = generate_signal(bars, ml_signal={"probability_up": 0.0})

    max_adjust = DEFAULT_CONFIG["ml_max_adjust"]
    assert boosted["score"] <= min(100.0, baseline["score"] + max_adjust + 1e-6)
    assert boosted["score"] > baseline["score"]
    assert suppressed["score"] < baseline["score"]
    # A probability below the veto floor blocks the fresh entry entirely.
    assert suppressed["action"] == "HOLD"
    assert suppressed["evidence"]["ml_veto"] is True
    assert suppressed["ensemble"]["ml"]["veto"] is True

    disabled = generate_signal(
        bars,
        {**DEFAULT_CONFIG, "ml_gate_enabled": False},
        ml_signal={"probability_up": 0.0},
    )
    assert disabled["ensemble"]["ml"] is None
    assert disabled["action"] == "BUY"

    with pytest.raises(CryptoEngineError, match="probability_up"):
        generate_signal(bars, ml_signal={"probability_up": 1.5})


def test_trailing_stop_ratchets_up_through_position_state_but_never_widens():
    bars = _hourly_bars()
    entry_price = bars[-200]["c"]
    initial_stop = entry_price * 0.9
    position = {
        "weight": 0.1,
        "average_entry_price": entry_price,
        "position_state": {"last_add_price": entry_price, "protective_stop": initial_stop},
    }
    signal = generate_signal(bars, position=position)

    assert signal["action"] in {"HOLD", "ADD", "REDUCE"}
    emitted = signal["position_state"]["protective_stop"]
    assert emitted is not None and emitted > initial_stop

    # Re-running with the ratcheted stop persisted must never lower it.
    position["position_state"]["protective_stop"] = emitted
    second = generate_signal(bars, position=position)
    assert second["position_state"]["protective_stop"] >= emitted


def test_add_is_blocked_when_position_is_below_cost_reference():
    bars = _hourly_bars()
    close = bars[-1]["c"]
    position = {
        "weight": 0.05,
        "average_entry_price": close * 1.2,
        "position_state": {"last_add_price": close * 1.2, "protective_stop": close * 0.8},
    }
    signal = generate_signal(bars, position=position)

    assert signal["action"] in {"HOLD", "REDUCE"}
    assert signal["action"] != "ADD"


# ------------------------------------------------------------- position state


def test_confirmed_fill_state_never_widens_stop_and_clears_only_when_flat():
    state = apply_fill_to_position_state(
        None, action="BUY", fill_price=100.0, stop_distance_pct=0.05, remaining_position=True
    )
    assert state == {"last_add_price": 100.0, "protective_stop": 95.0}

    added = apply_fill_to_position_state(
        state, action="ADD", fill_price=110.0, stop_distance_pct=0.05, remaining_position=True
    )
    assert added["last_add_price"] == 110.0
    assert added["protective_stop"] == pytest.approx(104.5)

    # A later add at a lower price cannot widen the stop.
    lower = apply_fill_to_position_state(
        added, action="ADD", fill_price=100.0, stop_distance_pct=0.2, remaining_position=True
    )
    assert lower["protective_stop"] == pytest.approx(104.5)

    partial = apply_fill_to_position_state(
        lower, action="REDUCE", fill_price=120.0, remaining_position=True
    )
    assert partial["protective_stop"] == pytest.approx(104.5)

    flat = apply_fill_to_position_state(
        partial, action="EXIT", fill_price=120.0, remaining_position=False
    )
    assert flat == {"last_add_price": None, "protective_stop": None}

    with pytest.raises(CryptoEngineError, match="remaining_position"):
        apply_fill_to_position_state(None, action="EXIT", fill_price=1.0, remaining_position="no")


# ---------------------------------------------------------------- risk gates


def test_risk_circuit_covers_daily_weekly_drawdown_and_stale_data():
    clear = evaluate_risk_circuit({"daily_return": 0.01})
    assert clear["blocked"] is False
    assert "BUY" in clear["allowed_actions"]

    daily = evaluate_risk_circuit({"daily_return": -0.02})
    assert daily["blocked"] is True
    assert daily["exit_required"] is False

    weekly = evaluate_risk_circuit({"seven_day_return": -0.05})
    assert weekly["cooldown_required"] is True
    assert weekly["cooldown_hours"] == 72

    drawdown = evaluate_risk_circuit({"drawdown": -0.09})
    assert drawdown["exit_required"] is True
    assert drawdown["manual_review_required"] is True

    stale = evaluate_risk_circuit(
        {"last_bar_time": datetime(2026, 1, 1, tzinfo=timezone.utc)},
        now=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    assert stale["data_stale"] is True
    assert any(t["code"] == "data_stale" for t in stale["triggers"])


def test_daily_loss_blocks_entries_but_does_not_force_liquidation():
    bars = _hourly_bars()
    blocked = generate_signal(bars, risk_state={"daily_return": -0.05})
    assert blocked["action"] == "HOLD"
    assert blocked["target_weight"] == 0.0

    held = generate_signal(
        bars,
        position={"weight": 0.08, "average_entry_price": bars[-300]["c"]},
        risk_state={"daily_return": -0.05},
    )
    assert held["action"] in {"HOLD", "REDUCE"}
    assert "EXIT" in held["allowed_actions"]


# ------------------------------------------------------------------ backtests


def test_backtest_uses_next_bar_execution_and_reports_costs_and_benchmark():
    bars = _noisy_trend_bars()
    result = backtest(bars, symbol="BTC/USD", initial_capital=10_000.0)

    assert result["algorithm"] == ALGORITHM_NAME
    assert result["metrics"]["trades"] >= 1
    assert result["metrics"]["fees"] > 0
    assert result["cost_model"]["execution"] == "next_bar_open"
    assert len(result["equity_curve"]) == len(result["timestamps"])
    assert result["benchmark"]["metrics"]["ending_equity"] > 0
    assert len(result["benchmark"]["equity_curve"]) == len(result["equity_curve"])
    # v2 evidence blocks
    assert "regime_stats" in result and result["regime_stats"]
    assert "trade_stats" in result
    assert isinstance(result["monthly_returns"], list) and result["monthly_returns"]
    assert result["ml_used"] is False

    # The first possible fill is the open after the first complete-signal bar.
    if result["fills"]:
        assert result["fills"][0]["timestamp"] > result["timestamps"][0]


def test_backtest_fees_and_slippage_reduce_returns():
    bars = _noisy_trend_bars(seed=7)
    cheap = backtest(
        bars, {**DEFAULT_CONFIG, "fee_bps": 0.0, "slippage_bps": 0.0}, symbol="BTC/USD"
    )
    costly = backtest(
        bars, {**DEFAULT_CONFIG, "fee_bps": 50.0, "slippage_bps": 20.0}, symbol="BTC/USD"
    )
    assert costly["metrics"]["total_return"] <= cheap["metrics"]["total_return"]


def test_backtest_terminal_liquidation_flattens_the_book_into_cash():
    result = backtest(_noisy_trend_bars(seed=3), symbol="BTC/USD")
    terminal = result["terminal_liquidation"]
    if terminal["liquidated"]:
        assert result["fills"][-1]["terminal"] is True
        assert result["equity_curve"][-1] == pytest.approx(terminal["ending_cash"])
    assert result["ending_position_state"] == {"last_add_price": None, "protective_stop": None}


def test_backtest_does_not_rewrite_past_decisions_when_future_bar_is_appended():
    bars = _noisy_trend_bars(seed=13, count=1650)
    base = backtest(bars, symbol="BTC/USD")

    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    extended_bars = bars + [_bar(start, len(bars), bars[-1]["c"], bars[-1]["c"] * 1.3)]
    extended = backtest(extended_bars, symbol="BTC/USD")

    overlap = len(base["decisions"]) - 1  # the endpoint loses terminal-mark effects
    for index in range(overlap):
        assert base["decisions"][index]["action"] == extended["decisions"][index]["action"]
        assert base["decisions"][index]["score"] == extended["decisions"][index]["score"]


def test_backtest_ml_series_must_align_and_participates_when_supplied():
    bars = _noisy_trend_bars(seed=21)
    with pytest.raises(CryptoEngineError, match="align"):
        backtest(bars, symbol="BTC/USD", ml_series=[0.5])

    probabilities = [0.65] * len(bars)
    result = backtest(bars, symbol="BTC/USD", ml_series=probabilities)
    assert result["ml_used"] is True
    scored = [d for d in result["decisions"] if d.get("ensemble")]
    assert any((d["ensemble"].get("ml") or {}).get("probability_up") == 0.65 for d in scored)
