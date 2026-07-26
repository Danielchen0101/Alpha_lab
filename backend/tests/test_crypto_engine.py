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


def _intraday_bars(count=1200, seed=41):
    """Fifteen-minute BTC-like tape with alternating trend/range sessions."""
    rng = random.Random(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], 60_000.0
    for index in range(count):
        session = (index // 96) % 4
        drift = (0.00035, -0.00025, 0.00005, 0.0004)[session]
        intraday_wave = 0.0007 * math.sin(index / 7.0)
        close = price * math.exp(drift + intraday_wave + rng.gauss(0, 0.0009))
        spread = price * 0.0008
        bars.append({
            "t": (start + timedelta(minutes=15 * index)).isoformat(),
            "o": price,
            "h": max(price, close) + spread,
            "l": min(price, close) - spread,
            "c": close,
            "v": 1_000 + abs(close / price - 1) * 500_000,
        })
        price = close
    return bars


def _sol_drawdown_bars(count=1500):
    """15-minute uptrend ending in a causal four-bar, 1.3% drawdown."""

    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars, price = [], 100.0
    for index in range(count):
        change = -0.0033 if index >= count - 4 else 0.0002
        close = price * (1.0 + change)
        bars.append({
            "t": (start + timedelta(minutes=15 * index)).isoformat(),
            "o": price,
            "h": max(price, close) * 1.0005,
            "l": min(price, close) * 0.9995,
            "c": close,
            "v": 2_000.0,
        })
        price = close
    return bars


def _sol_config():
    return validate_config({
        **DEFAULT_CONFIG,
        "symbols": ["SOL/USD"],
        "enable_sol_drawdown_sleeve": True,
        "bars_per_day": 96,
        "max_asset_weight": 0.20,
    })


def _intraday_config():
    return validate_config({
        **DEFAULT_CONFIG,
        "bars_per_day": 96,
        "ema_fast": 8,
        "ema_slow": 21,
        "anchor_ema": 96,
        "momentum_fast_days": 1,
        "momentum_slow_days": 3,
        "atr_hours": 12,
        "volatility_days": 2,
        "vol_fast_days": 1,
        "breakout_days": 1,
        "breakdown_days": 1,
        "rsi_period": 9,
        "adx_period": 10,
        "adx_trend_threshold": 18.0,
        "meanrev_entry_z": -0.8,
        "meanrev_rsi_buy": 38.0,
        "entry_confirmation_bars": 1,
        "exit_confirmation_bars": 1,
        "entry_score": 52.0,
        "add_score": 64.0,
        "reduce_score": 47.0,
        "rebalance_band": 0.005,
        "add_min_price_gain_pct": 0.0035,
        "stop_atr_multiple": 1.6,
        "trail_atr_multiple": 1.8,
        "min_stop_distance_pct": 0.0045,
        "max_stop_distance_pct": 0.025,
        "reduced_weight_fraction": 0.5,
    })


# --------------------------------------------------------------------- config


def test_config_is_strict_and_sol_requires_explicit_experimental_sleeve():
    resolved = validate_config({"symbols": ["btc/usd", "ETH/USD"]})

    assert resolved["symbols"] == ["BTC/USD", "ETH/USD"]
    assert resolved["enable_sol_drawdown_sleeve"] is False
    assert required_history_bars(resolved) == 14 * 24 + 1
    with pytest.raises(CryptoEngineError, match="requires enable_sol_drawdown_sleeve"):
        validate_config({"symbols": ["SOL/USD"]})
    with pytest.raises(CryptoEngineError, match="requires SOL/USD"):
        validate_config({"enable_sol_drawdown_sleeve": True})
    with pytest.raises(CryptoEngineError, match="15-minute"):
        validate_config({
            "symbols": ["SOL/USD"],
            "enable_sol_drawdown_sleeve": True,
            "bars_per_day": 24,
        })
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
    for key in (
        "ema_10", "ema_40", "rsi", "adx", "zscore", "momentum_20d", "high_20d",
        "return_24h", "return_72h", "efficiency_ratio", "bollinger_mean", "fast_channel_pos",
    ):
        assert rows_extended[index][key] == rows[index][key]


# -------------------------------------------------------------------- signals


def test_trend_entry_signal_is_explainable_and_long_flat_only():
    # End on a causal post-breakout retest, not the deliberately overextended
    # final breakout bar.
    signal = generate_signal(_noisy_trend_bars(seed=3, drift=0.0006)[:-1])

    assert signal["algorithm"] == ALGORITHM_NAME
    assert signal["version"] == ALGORITHM_VERSION
    assert signal["action"] == "BUY"
    assert signal["regime"] == "trend_up"
    assert signal["evidence"]["entry_mode"] in {"trend", "breakout_retest"}
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


def test_range_regime_dip_that_cannot_pay_costs_is_rejected():
    bars = _range_with_dip_bars()
    signal = generate_signal(bars)

    assert signal["regime"] == "range"
    # The technical setup exists, but the lagged-mean distance is smaller
    # than the complete fee/slippage + risk hurdle.
    assert signal["action"] == "HOLD"
    assert signal["evidence"]["setup_mode"] == "dip"
    assert signal["evidence"]["entry_mode"] is None
    assert signal["evidence"]["cost_qualified"] is False
    assert signal["evidence"]["edge_proxy_pct"] < signal["evidence"]["cost_hurdle_pct"]
    assert signal["ensemble"]["votes"]["meanrev"] >= 0.6


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


def test_retired_ml_advisor_cannot_change_live_signal():
    bars = _hourly_bars()
    baseline = generate_signal(bars)
    boosted = generate_signal(bars, ml_signal={"probability_up": 1.0})
    suppressed = generate_signal(bars, ml_signal={"probability_up": 0.0})

    assert boosted["score"] == baseline["score"]
    assert suppressed["score"] == baseline["score"]
    assert boosted["action"] == baseline["action"]
    assert suppressed["action"] == baseline["action"]
    assert boosted["ensemble"]["ml"] is None
    assert suppressed["ensemble"]["ml"] is None


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
    opened_at = "2026-01-01T00:00:00+00:00"
    state = apply_fill_to_position_state(
        None, action="BUY", fill_price=100.0, stop_distance_pct=0.05,
        remaining_position=True, filled_at=opened_at,
    )
    assert state == {
        "last_add_price": 100.0, "protective_stop": 95.0,
        "opened_at": opened_at, "last_exit_at": None, "last_action_at": opened_at,
    }

    added = apply_fill_to_position_state(
        state, action="ADD", fill_price=110.0, stop_distance_pct=0.05,
        remaining_position=True, filled_at="2026-01-01T02:00:00+00:00",
    )
    assert added["last_add_price"] == 110.0
    assert added["protective_stop"] == pytest.approx(104.5)
    assert added["opened_at"] == opened_at

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
        partial, action="EXIT", fill_price=120.0, remaining_position=False,
        filled_at="2026-01-01T04:00:00+00:00",
    )
    assert flat["last_add_price"] is None and flat["protective_stop"] is None
    assert flat["opened_at"] is None
    assert flat["last_exit_at"] == "2026-01-01T04:00:00+00:00"

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


def test_cost_gate_rejects_weak_edge_that_zero_cost_model_can_admit():
    # This slice ends on a range dip whose observed edge is large enough in a
    # zero-friction model but smaller than the configured cost/risk hurdle.
    bars = _noisy_trend_bars(seed=8, drift=0.0003)[:-64]
    free = generate_signal(bars, {**DEFAULT_CONFIG, "fee_bps": 0.0, "slippage_bps": 0.0})
    costly = generate_signal(bars)

    assert free["action"] == "BUY"
    assert costly["action"] == "HOLD"
    assert costly["evidence"]["setup_mode"] == "dip"
    assert costly["evidence"]["edge_proxy_pct"] < costly["evidence"]["cost_hurdle_pct"]


def test_minimum_hold_and_reentry_cooldown_preserve_immediate_protection():
    bearish = _panic_bars()
    config = {**DEFAULT_CONFIG, "panic_vol_ratio": 10.0}
    timestamp = datetime.fromisoformat(bearish[-1]["t"])
    close = bearish[-1]["c"]
    recent_position = {
        "weight": 0.1,
        "average_entry_price": close * 1.2,
        "position_state": {
            "last_add_price": close * 1.2,
            "protective_stop": close * 0.5,
            "opened_at": (timestamp - timedelta(hours=1)).isoformat(),
        },
    }
    held = generate_signal(bearish, config, position=recent_position)
    assert held["action"] == "HOLD"
    assert held["evidence"]["minimum_hold_active"] is True

    recent_position["position_state"]["protective_stop"] = close * 1.01
    protected = generate_signal(bearish, config, position=recent_position)
    assert protected["action"] == "EXIT"
    assert protected["evidence"]["stop_triggered"] is True

    bullish = _noisy_trend_bars(seed=3, drift=0.0006)[:-1]
    latest = datetime.fromisoformat(bullish[-1]["t"])
    cooling = generate_signal(
        bullish,
        position={
            "weight": 0.0,
            "position_state": {"last_exit_at": (latest - timedelta(hours=1)).isoformat()},
        },
    )
    ready = generate_signal(
        bullish,
        position={
            "weight": 0.0,
            "position_state": {"last_exit_at": (latest - timedelta(hours=10)).isoformat()},
        },
    )
    assert cooling["action"] == "HOLD"
    assert cooling["evidence"]["reentry_cooldown_active"] is True
    assert ready["action"] == "BUY"


def test_sol_experimental_sleeve_entry_exit_and_cooldown_use_persisted_timestamps():
    bars = _sol_drawdown_bars()
    config = _sol_config()
    latest = datetime.fromisoformat(bars[-1]["t"])
    close = bars[-1]["c"]

    entry = generate_signal(bars, config, symbol="SOL/USD")
    assert entry["action"] == "BUY"
    assert entry["target_weight"] == pytest.approx(0.12)
    assert entry["evidence"]["experimental"] is True
    assert entry["evidence"]["sleeve"] == "sol_drawdown_v1"
    assert "Experimental Paper sleeve" in entry["reasons"][0]

    cooling = generate_signal(
        bars,
        config,
        symbol="SOL/USD",
        position={
            "weight": 0.0,
            "position_state": {
                "last_exit_at": (latest - timedelta(minutes=30)).isoformat(),
            },
        },
    )
    assert cooling["action"] == "HOLD"
    assert cooling["evidence"]["reentry_cooldown_active"] is True

    cooled = generate_signal(
        bars,
        config,
        symbol="SOL/USD",
        position={
            "weight": 0.0,
            "position_state": {
                "last_exit_at": (latest - timedelta(minutes=75)).isoformat(),
            },
        },
    )
    assert cooled["action"] == "BUY"

    profitable = generate_signal(
        bars,
        config,
        symbol="SOL/USD",
        position={
            "weight": 0.12,
            "average_entry_price": close / 1.013,
            "position_state": {
                "opened_at": (latest - timedelta(hours=1)).isoformat(),
            },
        },
    )
    assert profitable["action"] == "EXIT"
    assert profitable["evidence"]["take_profit"] is True

    timed = generate_signal(
        bars,
        config,
        symbol="SOL/USD",
        position={
            "weight": 0.12,
            "average_entry_price": close,
            "position_state": {
                "opened_at": (latest - timedelta(hours=8, minutes=15)).isoformat(),
            },
        },
    )
    assert timed["action"] == "EXIT"
    assert timed["evidence"]["time_stop"] is True

    protected = generate_signal(
        bars,
        config,
        symbol="SOL/USD",
        position={
            "weight": 0.12,
            "average_entry_price": close,
            "position_state": {
                "opened_at": (latest - timedelta(minutes=15)).isoformat(),
            },
        },
        risk_state={"drawdown": -0.09},
    )
    assert protected["action"] == "EXIT"
    assert protected["evidence"]["capital_exit"] is True


def test_sol_backtest_executes_next_open_and_keeps_full_cost_model():
    bars = _sol_drawdown_bars()
    latest = datetime.fromisoformat(bars[-1]["t"])
    first_open = bars[-1]["c"] * 1.001
    first_close = first_open * 1.015
    second_open = first_close * 1.001
    bars.extend([
        {
            "t": (latest + timedelta(minutes=15)).isoformat(),
            "o": first_open,
            "h": first_close * 1.0005,
            "l": first_open * 0.9995,
            "c": first_close,
            "v": 2_000.0,
        },
        {
            "t": (latest + timedelta(minutes=30)).isoformat(),
            "o": second_open,
            "h": second_open * 1.0005,
            "l": second_open * 0.9995,
            "c": second_open,
            "v": 2_000.0,
        },
    ])

    result = backtest(bars, _sol_config(), symbol="SOL/USD")
    assert result["version"] == "2.4.0"
    assert result["fills"][0]["action"] == "BUY"
    assert result["fills"][0]["timestamp"] == bars[-2]["t"]
    assert result["fills"][0]["execution_price"] == pytest.approx(first_open * 1.0005)
    assert result["fills"][0]["fee"] > 0
    assert result["fills"][0]["slippage_cost"] > 0
    assert result["fills"][1]["side"] == "sell"
    assert result["fills"][1]["timestamp"] == bars[-1]["t"]
    assert result["cost_model"] == {
        "fee_bps": 25.0,
        "slippage_bps": 5.0,
        "execution": "next_bar_open",
        "terminal_mark": "forced_liquidation_at_final_close",
    }


def test_intraday_mandate_uses_fast_features_and_generates_repeatable_turnover():
    config = _intraday_config()
    bars = _intraday_bars()
    signal = generate_signal(bars, config)
    tested = backtest(bars, config, symbol="BTC/USD", initial_capital=10_000.0)

    assert signal["version"] == ALGORITHM_VERSION
    assert signal["indicators"]["return_1h"] is not None
    assert signal["indicators"]["return_3h"] is not None
    assert signal["indicators"]["return_12h"] is not None
    # This is deliberately an active short-horizon mandate, but still bounded
    # away from one order on every completed bar.
    assert 10 <= tested["metrics"]["trades"] <= 150
    assert tested["cost_model"]["fee_bps"] == config["fee_bps"]
    assert tested["metrics"]["trades_per_week"] > 1
    assert tested["metrics"]["average_holding_hours"] >= 1
    assert tested["trade_stats"]["frequency_unit"] == "completed_round_trips_per_week"


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
    assert result["ending_position_state"]["last_add_price"] is None
    assert result["ending_position_state"]["protective_stop"] is None
    assert result["ending_position_state"]["opened_at"] is None


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


def test_backtest_ignores_retired_ml_series():
    bars = _noisy_trend_bars(seed=21)
    probabilities = [0.65] * len(bars)
    result = backtest(bars, symbol="BTC/USD", ml_series=probabilities)
    assert result["ml_used"] is False
    scored = [d for d in result["decisions"] if d.get("ensemble")]
    assert all(d["ensemble"].get("ml") is None for d in scored)
