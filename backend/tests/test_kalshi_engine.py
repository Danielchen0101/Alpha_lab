from datetime import datetime, timedelta, timezone

import pytest

from kalshi_engine import (
    evaluate_btc15_contract,
    kalshi_fee,
    normalize_strategy_config,
    select_btc15_market,
)


def _candles(count=90, start=64_000.0, step=1.00012):
    price = start
    values = []
    for index in range(count):
        price *= step
        values.append([index, price, price, price, price, 10.0])
    return values, price


def _market(now, **overrides):
    """Active contract inside the v3 late-entry window with the favorite side
    (YES) priced like a real Kalshi book: favorites trade in the 70s-80s."""
    value = {
        "ticker": "KXBTC15M-TEST-00",
        "status": "active",
        "title": "BTC price up in next 15 mins?",
        "open_time": (now - timedelta(minutes=11)).isoformat(),
        "close_time": (now + timedelta(minutes=4)).isoformat(),
        "floor_strike": 64_000.0,
        "yes_bid_dollars": "0.7200",
        "yes_ask_dollars": "0.7400",
        "no_bid_dollars": "0.2600",
        "no_ask_dollars": "0.2800",
        "yes_bid_size_fp": "100.0",
        "yes_ask_size_fp": "100.0",
    }
    value.update(overrides)
    return value


def test_selects_active_contract_before_upcoming_contract():
    now = datetime(2026, 7, 20, 18, 0, tzinfo=timezone.utc)
    active = _market(now)
    upcoming = _market(
        now,
        ticker="KXBTC15M-NEXT-15",
        status="initialized",
        open_time=(now + timedelta(minutes=11)).isoformat(),
        close_time=(now + timedelta(minutes=26)).isoformat(),
    )

    selected, state = select_btc15_market([upcoming, active], now)

    assert state == "active"
    assert selected["ticker"] == active["ticker"]


def test_fee_uses_current_probability_weighted_formula():
    assert kalshi_fee(0.50) == pytest.approx(0.0175)
    assert kalshi_fee(0.50, 10) == pytest.approx(0.175)
    assert kalshi_fee(0.10) == pytest.approx(0.0063)


def test_confirmed_favorite_can_pass_all_paper_gates():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()

    result = evaluate_btc15_contract(
        _market(now, floor_strike=64_650.0),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["action"] == "BUY_YES"
    assert result["paperOnly"] is True
    assert result["sizing"]["contracts"] > 0
    assert result["edge"]["netEdge"] >= result["edge"]["minimumNetEdge"]
    assert result["edge"]["modelProbability"] >= result["config"]["minModelProbability"]
    assert result["blockingReasons"] == []


def test_mirrored_favorite_can_buy_no():
    now = datetime.now(timezone.utc)
    candles, _ = _candles(start=66_000.0, step=0.99988)
    spot = candles[-1][4]

    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=65_400.0,
            yes_bid_dollars="0.1000",
            yes_ask_dollars="0.1200",
            no_bid_dollars="0.8800",
            no_ask_dollars="0.9000",
        ),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["action"] == "BUY_NO"
    assert result["side"] == "NO"
    assert result["sizing"]["contracts"] > 0
    assert result["blockingReasons"] == []


def test_engine_buys_the_favorite_side_not_the_longshot():
    """The v2 max-edge rule bought under-priced longshots (~20% winners).
    v3 must select the model-favorite side even when the longshot side has a
    nominally positive edge against its ask."""
    now = datetime.now(timezone.utc)
    candles, spot = _candles()

    result = evaluate_btc15_contract(
        _market(now, floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["side"] == "YES"
    assert result["edge"]["price"] >= result["config"]["minPrice"]
    assert result["model"]["selectedModelProbability"] >= 0.5
    gate_keys = [gate["key"] for gate in result["gates"]]
    assert "model_probability" in gate_keys


def test_coin_flip_contract_is_blocked_by_model_probability_gate():
    now = datetime.now(timezone.utc)
    candles, spot = _candles(step=1.0)  # flat tape: spot == strike, p ~= 0.5

    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=round(spot, 2),
            yes_bid_dollars="0.4900",
            yes_ask_dollars="0.5100",
            no_bid_dollars="0.4900",
            no_ask_dollars="0.5100",
        ),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["action"] == "WAIT"
    assert "model_probability" in result["blockingReasons"]


def test_position_size_is_not_capped_by_legacy_max_contracts():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()

    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=64_650.0,
            yes_ask_size_fp="1000.0",
            no_ask_size_fp="1000.0",
        ),
        spot_price=spot,
        candles=candles,
        now=now,
        config={
            "paperBankroll": 100_000,
            "riskPerTradePct": 2.0,
            "fractionalKelly": 0.50,
            "maxBookParticipation": 0.50,
            "minDepthContracts": 5,
            "maxContracts": 20,
        },
        account_context={
            "bankroll": 100_000,
            "cashAvailable": 100_000,
            "portfolioExposure": 0,
            "dailyPnl": 0,
        },
        orderbook={
            "yes": [[0.72, 1000]],
            "no": [[0.26, 1000]],
        },
        reference_time=now,
        book_time=now,
    )

    assert result["action"] == "BUY_YES"
    assert result["sizing"]["contracts"] > 20


def test_full_bid_book_derives_executable_asks_and_depth():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    market = _market(
        now,
        floor_strike=64_660.0,
        yes_bid_dollars=None,
        yes_ask_dollars=None,
        no_bid_dollars=None,
        no_ask_dollars=None,
    )

    result = evaluate_btc15_contract(
        market,
        spot_price=spot,
        candles=candles,
        now=now,
        orderbook={
            "yes": [["0.4400", "25.00"], ["0.4800", "40.00"]],
            "no": [["0.4500", "30.00"], ["0.4900", "60.00"]],
        },
        reference_time=now,
        book_time=now,
    )

    assert result["market"]["yesBid"] == pytest.approx(0.48)
    assert result["market"]["yesAsk"] == pytest.approx(0.51)
    assert result["market"]["noBid"] == pytest.approx(0.49)
    assert result["market"]["noAsk"] == pytest.approx(0.52)
    assert result["market"]["yesAskDepth"] == pytest.approx(60.0)
    assert result["market"]["noAskDepth"] == pytest.approx(40.0)
    assert result["model"]["marketYesProbability"] is not None


def test_missing_book_never_becomes_zero_probability_or_a_trade():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    market = _market(
        now,
        yes_bid_dollars=None,
        yes_ask_dollars=None,
        no_bid_dollars=None,
        no_ask_dollars=None,
        yes_bid_size_fp=None,
        yes_ask_size_fp=None,
    )

    result = evaluate_btc15_contract(
        market,
        spot_price=spot,
        candles=candles,
        now=now,
        orderbook={"yes": [], "no": []},
        reference_time=now,
        book_time=now,
    )

    assert result["action"] == "WAIT"
    assert result["model"]["marketYesProbability"] is None
    assert result["model"]["fairYesProbability"] is None
    assert result["edge"]["price"] is None
    assert "two_sided_quote" in result["blockingReasons"]
    assert result["signalQuality"] < 50


def test_official_brti_avoids_single_venue_proxy_uncertainty_penalty():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    # Keep distance-to-strike at zero so proxy basis reserves cannot alter the
    # model/market disagreement term; this isolates the venue-count penalty.
    market = _market(now, floor_strike=spot)
    common = {
        "market": market,
        "spot_price": spot,
        "candles": candles,
        "now": now,
        "reference_time": now,
        "book_time": now,
    }

    official = evaluate_btc15_contract(
        **common,
        reference_metadata={
            "model": "kalshi_cf_benchmarks_brti",
            "isOfficialBrti": True,
            "venueCount": 1,
            "dispersionBps": 0,
        },
    )
    single_venue_proxy = evaluate_btc15_contract(
        **common,
        reference_metadata={
            "model": "brti_constituent_proxy",
            "isOfficialBrti": False,
            "venueCount": 1,
            "dispersionBps": 0,
        },
    )

    assert official["model"]["uncertainty"] == pytest.approx(
        single_venue_proxy["model"]["uncertainty"] - 0.01
    )


def test_paper_account_gates_prevent_duplicate_or_over_budget_entries():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    result = evaluate_btc15_contract(
        _market(now, floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
        account_context={
            "bankroll": 1_000.0,
            "cashAvailable": 500.0,
            "portfolioExposure": 300.0,
            "hasPosition": True,
            "hasOpenOrder": True,
            "alreadyTraded": True,
            "dailyTrades": 8,
            "dailyPnl": -25.0,
            "cooldownActive": True,
            "cooldownDetail": "three-loss cooldown",
        },
    )

    assert result["action"] == "WAIT"
    assert {"open_order", "portfolio_exposure"}.issubset(result["blockingReasons"])
    assert "market_flat" not in result["blockingReasons"]
    assert "loss_cooldown" not in result["blockingReasons"]
    assert result["sizing"]["contracts"] == 0

    real_result = evaluate_btc15_contract(
        _market(now, floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
        config={"executionMode": "real"},
        account_context={
            "bankroll": 1_000.0,
            "cashAvailable": 500.0,
            "portfolioExposure": 0.0,
            "cooldownActive": True,
            "cooldownDetail": "three-loss cooldown",
        },
    )

    assert "loss_cooldown" not in real_result["blockingReasons"]
    assert real_result["paperOnly"] is False
    assert real_result["executionEnvironment"] == "kalshi_real"
    assert "Real IOC limit order" in real_result["methodology"]["orderPolicy"]
    assert "no AI or random exploration" in real_result["methodology"]["samplePolicy"]
    account_gate = next(gate for gate in real_result["gates"] if gate["key"] == "account_ready")
    assert account_gate["label"] == "Kalshi Real account ready"


def test_missing_strike_and_late_entry_fail_closed():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    market = _market(
        now,
        floor_strike=None,
        close_time=(now + timedelta(seconds=40)).isoformat(),
    )

    result = evaluate_btc15_contract(market, spot_price=spot, candles=candles, now=now)

    assert result["action"] == "WAIT"
    assert "reference_ready" in result["blockingReasons"]
    assert "entry_window" in result["blockingReasons"]


def test_user_config_is_bounded_to_research_limits():
    config = normalize_strategy_config({
        "paperBankroll": 5,
        "riskPerTradePct": 50,
        "minNetEdge": 0,
        "minModelProbability": 0.2,
        "minimumHoldSeconds": -1,
        "reversalCooldownSeconds": 5000,
        "exitValueBuffer": 1,
        "minimumExitProfit": 1,
        "stopLossPct": 0,
        "emergencyStopLossPct": 1,
    })

    assert config["paperBankroll"] == 100.0
    assert config["riskPerTradePct"] == 2.0
    assert "maxContracts" not in config
    assert "maxDailyLossPct" not in config
    assert config["minNetEdge"] == 0.005
    assert config["minModelProbability"] == 0.50
    assert config["minimumHoldSeconds"] == 0
    assert config["reversalCooldownSeconds"] == 600
    assert config["exitValueBuffer"] == 0.05
    assert config["minimumExitProfit"] == 0.10
    assert config["stopLossPct"] == 0.15
    assert config["emergencyStopLossPct"] == 0.15


def test_v4_config_ignores_removed_learning_and_bounds_add_on_controls():
    config = normalize_strategy_config({
        "learningMode": True,
        "learningAiMode": True,
        "learningExplorationRate": 0.9,
        "maxSingleMarketExposurePct": 100,
        "minimumAddIntervalSeconds": 1,
        "addMinModelProbability": 0.99,
    })

    assert not any(key.startswith("learning") for key in config)
    assert config["maxSingleMarketExposurePct"] == 20
    assert config["minimumAddIntervalSeconds"] == 10
    assert config["addMinModelProbability"] == 0.95






def test_relative_spread_blocks_wide_percentage_friction():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=64_660.0,
            yes_bid_dollars="0.4500",
            yes_ask_dollars="0.5500",
            no_bid_dollars="0.4500",
            no_ask_dollars="0.5500",
        ),
        spot_price=spot,
        candles=candles,
        now=now,
        config={"maxSpread": 0.12, "maxRelativeSpread": 0.15},
    )

    assert "relative_spread" in result["blockingReasons"]
