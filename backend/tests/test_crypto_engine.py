from datetime import datetime, timedelta, timezone

import pytest
import crypto_engine as crypto_engine_module

from crypto_engine import (
    CryptoEngineError,
    apply_fill_to_position_state,
    backtest,
    compute_indicators,
    evaluate_risk_circuit,
    generate_signal,
    required_history_bars,
    validate_config,
)


def _hourly_bars(count=1700, start_price=100.0, hourly_return=0.00025):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    bars = []
    price = start_price
    for index in range(count):
        open_price = price
        close = open_price * (1 + hourly_return)
        bars.append(
            {
                "t": (start + timedelta(hours=index)).isoformat(),
                "o": open_price,
                "h": max(open_price, close) * 1.001,
                "l": min(open_price, close) * 0.999,
                "c": close,
                "v": 1000 + index,
            }
        )
        price = close
    return bars


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


def test_market_data_must_be_strictly_ascending_and_valid_ohlc():
    bars = _hourly_bars(3)
    bars[2]["t"] = bars[1]["t"]
    with pytest.raises(CryptoEngineError, match="strictly ascending"):
        compute_indicators(bars)

    bars = _hourly_bars(3)
    bars[1]["h"] = bars[1]["l"] - 1
    with pytest.raises(CryptoEngineError, match="high is inconsistent"):
        compute_indicators(bars)


def test_market_data_must_be_contiguous_strategy_intervals():
    bars = _hourly_bars(4)
    bars[2]["t"] = (datetime.fromisoformat(bars[2]["t"]) + timedelta(hours=1)).isoformat()
    with pytest.raises(CryptoEngineError, match="contiguous strategy intervals"):
        compute_indicators(bars)

    bars = _hourly_bars(4)
    bars[1]["t"] = (datetime.fromisoformat(bars[0]["t"]) + timedelta(minutes=30)).isoformat()
    with pytest.raises(CryptoEngineError, match="1800 seconds"):
        compute_indicators(bars)


def test_breakout_level_excludes_current_bar_and_indicators_have_no_future_leakage():
    bars = _hourly_bars(1700)
    base = compute_indicators(bars)
    prior_high = max(item["h"] for item in bars[-20 * 24 - 1 : -1])

    assert base[-1]["high_20d"] == pytest.approx(prior_high)
    assert base[-1]["momentum_20d"] == pytest.approx(
        bars[-1]["c"] / bars[-1 - 20 * 24]["c"] - 1
    )

    future = dict(bars[-1])
    future["t"] = (datetime.fromisoformat(bars[-1]["t"]) + timedelta(hours=1)).isoformat()
    future["o"] *= 20
    future["h"] *= 20
    future["l"] *= 20
    future["c"] *= 20
    extended = compute_indicators(bars + [future])

    assert extended[:-1] == base


def test_adaptive_trend_signal_is_explainable_and_long_flat_only():
    bars = _hourly_bars()
    signal = generate_signal(bars)

    assert signal["action"] == "BUY"
    assert signal["regime"] in {"trend", "breakout"}
    assert signal["score"] >= 60
    assert 0 < signal["target_weight"] <= 0.20
    assert 0.02 <= signal["stop_distance_pct"] <= 0.12
    assert signal["allowed_actions"] == ["BUY", "HOLD"]
    assert any("momentum" in reason.lower() for reason in signal["reasons"])
    assert "SELL_SHORT" not in signal["allowed_actions"]


def test_add_is_blocked_when_position_is_below_cost_reference():
    bars = _hourly_bars()
    current_price = bars[-1]["c"]
    signal = generate_signal(
        bars,
        position={
            "weight": 0.10,
            "average_entry_price": current_price * 1.02,
            "last_add_price": current_price * 1.01,
        },
    )

    assert signal["action"] == "HOLD"
    assert signal["target_weight"] == pytest.approx(0.10)
    assert "ADD" not in signal["allowed_actions"]
    assert any("Add blocked" in reason for reason in signal["reasons"])


def test_confirmed_fill_state_never_widens_stop_and_clears_only_when_flat():
    entered = apply_fill_to_position_state(
        None,
        action="BUY",
        fill_price=100,
        stop_distance_pct=0.10,
        remaining_position=True,
    )
    assert entered == {"last_add_price": 100.0, "protective_stop": 90.0}

    looser_add = apply_fill_to_position_state(
        entered,
        action="ADD",
        fill_price=110,
        stop_distance_pct=0.30,
        remaining_position=True,
    )
    assert looser_add["last_add_price"] == 110
    assert looser_add["protective_stop"] == 90

    tighter_add = apply_fill_to_position_state(
        looser_add,
        action="ADD",
        fill_price=120,
        stop_distance_pct=0.10,
        remaining_position=True,
    )
    assert tighter_add["protective_stop"] == 108

    partial_exit = apply_fill_to_position_state(
        tighter_add,
        action="EXIT",
        fill_price=119,
        remaining_position=True,
    )
    assert partial_exit == tighter_add
    assert apply_fill_to_position_state(
        partial_exit,
        action="EXIT",
        fill_price=119,
        remaining_position=False,
    ) == {"last_add_price": None, "protective_stop": None}

    with pytest.raises(CryptoEngineError, match="filled action"):
        apply_fill_to_position_state(
            entered,
            action="HOLD",
            remaining_position=True,
        )


def test_signal_returns_persistable_state_without_atr_trailing_or_intent_mutation():
    bars = _hourly_bars()
    stop = bars[-1]["c"] * 0.75
    signal = generate_signal(
        bars,
        position={
            "weight": 0.10,
            "average_entry_price": bars[-1]["c"] * 0.80,
            "position_state": {
                "last_add_price": bars[-1]["c"] * 0.90,
                "protective_stop": stop,
            },
        },
    )

    assert signal["position_state"]["last_add_price"] == pytest.approx(bars[-1]["c"] * 0.90)
    assert signal["position_state"]["protective_stop"] == pytest.approx(stop)
    assert signal["evidence"]["protective_stop"] == pytest.approx(stop)

    bootstrapped = generate_signal(
        bars,
        position={"weight": 0.10, "average_entry_price": bars[-1]["c"] * 0.80},
    )
    assert bootstrapped["position_state"]["last_add_price"] == pytest.approx(
        bars[-1]["c"] * 0.80
    )
    assert bootstrapped["position_state"]["protective_stop"] > 0


def test_risk_circuit_covers_daily_weekly_drawdown_and_stale_data():
    now = datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc)
    result = evaluate_risk_circuit(
        {
            "daily_return": -0.05,
            "seven_day_return": -0.09,
            "drawdown": -0.16,
            "last_bar_time": now - timedelta(hours=4),
        },
        now=now,
    )

    assert result["blocked"] is True
    assert result["exit_required"] is True
    assert result["entry_blocked"] is True
    assert result["cooldown_required"] is True
    assert result["cooldown_hours"] == 72
    assert result["manual_review_required"] is True
    assert {item["code"] for item in result["triggers"]} == {
        "daily_loss",
        "seven_day_loss",
        "max_drawdown",
        "data_stale",
    }
    assert result["allowed_actions"] == ["HOLD", "REDUCE", "EXIT"]

    clean = evaluate_risk_circuit(
        {"daily_return": 0.01, "seven_day_return": 0.02, "drawdown": -0.03, "last_bar_time": now},
        now=now,
    )
    assert clean["blocked"] is False
    assert clean["entry_blocked"] is False
    assert clean["cooldown_hours"] == 0
    assert "BUY" in clean["allowed_actions"]


def test_daily_and_weekly_loss_block_entries_but_only_max_drawdown_forces_exit():
    bars = _hourly_bars()
    daily = generate_signal(
        bars,
        position={"weight": 0.25, "average_entry_price": bars[-1]["c"] * 0.8},
        risk_state={"daily_return": -0.05},
    )
    weekly = generate_signal(
        bars,
        position={"weight": 0.25, "average_entry_price": bars[-1]["c"] * 0.8},
        risk_state={"seven_day_return": -0.05},
    )
    drawdown = generate_signal(
        bars,
        position={"weight": 0.25, "average_entry_price": bars[-1]["c"] * 0.8},
        risk_state={"drawdown": -0.09},
    )

    assert daily["action"] == "HOLD"
    assert daily["risk"]["exit_required"] is False
    assert weekly["action"] == "HOLD"
    assert weekly["risk"]["cooldown_required"] is True
    assert weekly["risk"]["cooldown_hours"] == 72
    assert drawdown["action"] == "EXIT"
    assert drawdown["target_weight"] == 0
    assert drawdown["risk"]["exit_required"] is True
    assert drawdown["risk"]["manual_review_required"] is True


def test_weekly_cooldown_still_allows_a_risk_reducing_signal():
    bars = _hourly_bars(hourly_return=0.02)
    price = 100.0
    for index, bar in enumerate(bars):
        open_price = price
        close = open_price * (1.02 if index % 2 == 0 else 0.981)
        bar.update(
            {
                "o": open_price,
                "h": max(open_price, close) * 1.001,
                "l": min(open_price, close) * 0.999,
                "c": close,
            }
        )
        price = close

    signal = generate_signal(
        bars,
        position={"weight": 0.20, "average_entry_price": bars[-1]["c"] * 0.80},
        risk_state={"seven_day_return": -0.05},
    )

    assert signal["risk"]["cooldown_required"] is True
    assert signal["action"] == "REDUCE"
    assert signal["target_weight"] < 0.20


def test_backtest_uses_next_bar_execution_and_reports_costs_and_benchmark():
    bars = _hourly_bars(1750)
    result = backtest(bars)

    assert result["cost_model"]["execution"] == "next_bar_open"
    assert result["cost_model"]["fee_bps"] == 25.0
    assert result["metrics"]["trades"] >= 1
    assert result["metrics"]["fees"] > 0
    assert result["metrics"]["turnover"] > 0
    assert set(
        ["total_return", "max_drawdown", "sharpe", "sortino", "calmar", "trades", "turnover", "fees"]
    ).issubset(result["metrics"])
    assert result["benchmark"]["metrics"]["trades"] == 2
    assert result["benchmark"]["timestamps"] == result["timestamps"]
    assert result["benchmark"]["from"] == result["from"]
    assert result["benchmark"]["to"] == result["to"]
    assert len(result["benchmark"]["equity_curve"]) == len(result["equity_curve"])
    assert result["benchmark"]["equity_curve"][0] == pytest.approx(10_000.0)
    assert result["benchmark"]["fills"][0]["timestamp"] == result["timestamps"][1]
    # The first complete-bar observation has no equally complete predecessor,
    # so it cannot satisfy the two-bar confirmation rule. The second decision
    # may queue a BUY, which is filled at the third bar's open.
    assert result["decisions"][0]["action"] == "HOLD"
    assert result["decisions"][1]["action"] == "BUY"
    assert result["equity_curve"][0] == pytest.approx(10_000.0)
    assert result["equity_curve"][1] == pytest.approx(10_000.0)


def test_backtest_reuses_two_completed_bar_confirmation_and_does_not_churn_a_held_position():
    result = backtest(_hourly_bars(1800))

    assert result["decisions"][0]["action"] == "HOLD"
    assert result["decisions"][1]["action"] == "BUY"
    # A smooth established trend should not be rebalanced every hour merely
    # because its marked portfolio weight or rolling volatility moves.
    assert [fill["action"] for fill in result["fills"]] == ["BUY", "TERMINAL_EXIT"]
    assert result["metrics"]["trades"] == 2
    assert result["metrics"]["turnover"] < 0.50
    assert {decision["action"] for decision in result["decisions"][2:]} == {"HOLD"}


def test_completed_bar_breakdown_exits_on_the_following_open():
    bars = _hourly_bars(1700)
    crash_index = 1650
    previous_close = bars[crash_index - 1]["c"]
    for index in range(crash_index, len(bars)):
        open_price = previous_close
        close = open_price * (0.85 if index == crash_index else 0.999)
        bars[index].update(
            {
                "o": open_price,
                "h": max(open_price, close) * 1.001,
                "l": min(open_price, close) * 0.999,
                "c": close,
            }
        )
        previous_close = close

    result = backtest(bars)
    decision_index = crash_index - (required_history_bars() - 1)

    assert result["decisions"][decision_index]["action"] == "EXIT"
    # One confirmed entry and one next-open exit; no same-close fill occurs.
    assert result["metrics"]["trades"] == 2
    assert result["terminal_liquidation"]["liquidated"] is False
    assert [fill["action"] for fill in result["fills"]] == ["BUY", "EXIT"]
    assert result["equity_curve"][decision_index] != result["equity_curve"][decision_index + 1]


def test_fees_and_slippage_reduce_strategy_and_benchmark_returns():
    bars = _hourly_bars(1750)
    realistic = backtest(bars)
    frictionless = backtest(bars, {"fee_bps": 0, "slippage_bps": 0})

    assert realistic["metrics"]["ending_equity"] < frictionless["metrics"]["ending_equity"]
    assert (
        realistic["benchmark"]["metrics"]["ending_equity"]
        < frictionless["benchmark"]["metrics"]["ending_equity"]
    )


def test_terminal_liquidation_is_in_equity_fees_turnover_and_fill_ledger():
    result = backtest(_hourly_bars(1750))
    terminal = result["terminal_liquidation"]

    assert terminal["liquidated"] is True
    assert result["fills"][-1]["action"] == "TERMINAL_EXIT"
    assert result["fills"][-1]["terminal"] is True
    assert result["ending_position_state"] == {
        "last_add_price": None,
        "protective_stop": None,
    }
    assert result["metrics"]["fees"] == pytest.approx(
        sum(fill["fee"] for fill in result["fills"]), abs=1e-7
    )
    assert result["equity_curve"][-1] == result["metrics"]["ending_equity"]
    assert terminal["ending_cash"] == result["metrics"]["ending_equity"]
    assert terminal["mark_before_costs"] > terminal["ending_cash"]

    benchmark = result["benchmark"]
    assert benchmark["metrics"]["fees"] == pytest.approx(
        sum(fill["fee"] for fill in benchmark["fills"]), abs=1e-7
    )
    assert benchmark["equity_curve"][-1] == benchmark["metrics"]["ending_equity"]


def test_backtest_latches_weekly_loss_cooldown_for_exactly_72_completed_bars(monkeypatch):
    bars = _hourly_bars(1700)
    warmup = required_history_bars() - 1
    trigger_timestamp = datetime.fromisoformat(bars[warmup + 1]["t"])
    real_evaluator = crypto_engine_module.evaluate_risk_circuit

    def controlled_risk(state, config=None, *, now=None):
        result = real_evaluator(state, config, now=now)
        if state.get("last_bar_time") == trigger_timestamp:
            result.update(
                {
                    "blocked": True,
                    "entry_blocked": True,
                    "cooldown_required": True,
                    "cooldown_hours": 72,
                    "cooldown_active": True,
                    "cooldown_remaining_bars": 72,
                    "allowed_actions": ["HOLD", "REDUCE", "EXIT"],
                }
            )
            result["triggers"] = [
                {"code": "seven_day_loss", "observed": -0.05, "limit": -0.04}
            ]
        return result

    monkeypatch.setattr(crypto_engine_module, "evaluate_risk_circuit", controlled_risk)
    result = crypto_engine_module.backtest(bars)

    trigger_decision = 1
    resume_decision = trigger_decision + 72
    assert result["decisions"][trigger_decision]["risk"]["cooldown_remaining_bars"] == 72
    assert result["decisions"][resume_decision - 1]["risk"]["cooldown_remaining_bars"] == 1
    assert all(
        decision["action"] not in {"BUY", "ADD"}
        for decision in result["decisions"][trigger_decision:resume_decision]
    )
    assert result["decisions"][resume_decision]["risk"]["cooldown_active"] is False
    assert result["decisions"][resume_decision]["action"] == "BUY"
    # The resumed signal remains causal: it fills only on the next bar's open.
    assert result["fills"][0]["timestamp"] == bars[warmup + resume_decision + 1]["t"]


def test_backtest_add_fill_uses_same_non_widening_stop_transition(monkeypatch):
    bars = _hourly_bars(1570)
    warmup = required_history_bars() - 1

    def controlled_signal(rows, index, config, *, position, risk):
        offset = index - warmup
        if offset == 0:
            action, target, distance = "BUY", 0.10, 0.10
        elif offset == 1:
            action, target, distance = "ADD", 0.20, 0.50
        else:
            action, target, distance = "HOLD", position.get("weight", 0.0), 0.02
        return {
            "action": action,
            "regime": "controlled_test",
            "score": 100.0,
            "target_weight": target,
            "stop_distance_pct": distance,
        }

    monkeypatch.setattr(crypto_engine_module, "_confirmed_signal", controlled_signal)
    result = crypto_engine_module.backtest(bars)
    buy, add, terminal = result["fills"]

    assert [buy["action"], add["action"], terminal["action"]] == [
        "BUY",
        "ADD",
        "TERMINAL_EXIT",
    ]
    assert add["position_state"]["last_add_price"] == pytest.approx(add["execution_price"])
    assert add["position_state"]["protective_stop"] == pytest.approx(
        buy["position_state"]["protective_stop"]
    )


def test_backtest_high_gap_add_intent_cancels_instead_of_selling(monkeypatch):
    bars = _hourly_bars(1570)
    warmup = required_history_bars() - 1
    gap_index = warmup + 2
    gap_open = bars[gap_index]["o"] * 5
    bars[gap_index].update(
        {
            "o": gap_open,
            "h": gap_open * 1.001,
            "l": gap_open * 0.999,
            "c": gap_open,
        }
    )
    observed_states = {}
    observed_weights = {}

    def controlled_signal(rows, index, config, *, position, risk):
        offset = index - warmup
        observed_states[offset] = dict(position.get("position_state") or {})
        observed_weights[offset] = position.get("weight", 0.0)
        if offset == 0:
            action, target = "BUY", 0.10
        elif offset == 1:
            action, target = "ADD", 0.20
        else:
            action, target = "HOLD", position.get("weight", 0.0)
        return {
            "action": action,
            "regime": "controlled_test",
            "score": 100.0,
            "target_weight": target,
            "stop_distance_pct": 0.10,
        }

    monkeypatch.setattr(crypto_engine_module, "_confirmed_signal", controlled_signal)
    result = crypto_engine_module.backtest(bars)

    assert [(fill["action"], fill["side"]) for fill in result["fills"]] == [
        ("BUY", "buy"),
        ("TERMINAL_EXIT", "sell"),
    ]
    assert observed_weights[2] > 0.20
    assert observed_states[2] == observed_states[1]
    assert observed_states[2]["protective_stop"] > 0


def test_backtest_low_gap_reduce_intent_cancels_instead_of_buying(monkeypatch):
    bars = _hourly_bars(1570)
    warmup = required_history_bars() - 1
    gap_index = warmup + 2
    gap_open = bars[gap_index]["o"] * 0.25
    bars[gap_index].update(
        {
            "o": gap_open,
            "h": gap_open * 1.001,
            "l": gap_open * 0.999,
            "c": gap_open,
        }
    )
    observed_states = {}
    observed_weights = {}

    def controlled_signal(rows, index, config, *, position, risk):
        offset = index - warmup
        observed_states[offset] = dict(position.get("position_state") or {})
        observed_weights[offset] = position.get("weight", 0.0)
        if offset == 0:
            action, target = "BUY", 0.20
        elif offset == 1:
            action, target = "REDUCE", 0.10
        else:
            action, target = "HOLD", position.get("weight", 0.0)
        return {
            "action": action,
            "regime": "controlled_test",
            "score": 100.0,
            "target_weight": target,
            "stop_distance_pct": 0.10,
        }

    monkeypatch.setattr(crypto_engine_module, "_confirmed_signal", controlled_signal)
    result = crypto_engine_module.backtest(bars)

    assert [(fill["action"], fill["side"]) for fill in result["fills"]] == [
        ("BUY", "buy"),
        ("TERMINAL_EXIT", "sell"),
    ]
    assert observed_weights[2] < 0.10
    assert observed_states[2] == observed_states[1]
    assert observed_states[2]["last_add_price"] > 0


def test_backtest_does_not_rewrite_past_decisions_when_future_bar_is_appended():
    bars = _hourly_bars(1750)
    base = backtest(bars)
    future = dict(bars[-1])
    future["t"] = (datetime.fromisoformat(bars[-1]["t"]) + timedelta(hours=1)).isoformat()
    future["o"] *= 0.5
    future["h"] *= 0.5
    future["l"] *= 0.5
    future["c"] *= 0.5
    extended = backtest(bars + [future])

    assert extended["decisions"][:-1] == base["decisions"]
    # The former endpoint loses its forced-liquidation adjustment once it is
    # no longer terminal; every earlier causal mark is unchanged.
    assert extended["equity_curve"][:-2] == base["equity_curve"][:-1]
    assert extended["equity_curve"][-2] == pytest.approx(
        base["terminal_liquidation"]["mark_before_costs"]
    )
