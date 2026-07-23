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
    value = {
        "ticker": "KXBTC15M-TEST-00",
        "status": "active",
        "title": "BTC price up in next 15 mins?",
        "open_time": (now - timedelta(minutes=4)).isoformat(),
        "close_time": (now + timedelta(minutes=8)).isoformat(),
        "floor_strike": 64_000.0,
        "yes_bid_dollars": "0.4900",
        "yes_ask_dollars": "0.5000",
        "no_bid_dollars": "0.5000",
        "no_ask_dollars": "0.5100",
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


def test_obvious_edge_can_pass_all_paper_gates():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()

    result = evaluate_btc15_contract(
        _market(now, floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["action"] == "BUY_YES"
    assert result["paperOnly"] is True
    assert result["sizing"]["contracts"] > 0
    assert result["edge"]["netEdge"] >= result["edge"]["minimumNetEdge"]
    assert result["blockingReasons"] == []


def test_obvious_mirrored_edge_can_buy_no():
    now = datetime.now(timezone.utc)
    candles, _ = _candles(start=66_000.0, step=0.99988)
    spot = candles[-1][4]

    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=65_400.0,
            yes_bid_dollars="0.2000",
            yes_ask_dollars="0.2500",
            no_bid_dollars="0.7500",
            no_ask_dollars="0.8000",
        ),
        spot_price=spot,
        candles=candles,
        now=now,
    )

    assert result["action"] == "BUY_NO"
    assert result["side"] == "NO"
    assert result["sizing"]["contracts"] > 0
    assert result["blockingReasons"] == []


def test_position_size_is_not_capped_by_legacy_max_contracts():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()

    result = evaluate_btc15_contract(
        _market(
            now,
            floor_strike=64_660.0,
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
            "yes": [[0.49, 1000]],
            "no": [[0.50, 1000]],
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
            "portfolioExposure": 250.0,
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
    assert {
        "market_flat",
        "open_order",
        "portfolio_exposure",
        "loss_cooldown",
    }.issubset(result["blockingReasons"])
    assert result["sizing"]["contracts"] == 0


def test_missing_strike_and_late_entry_fail_closed():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    market = _market(
        now,
        floor_strike=None,
        close_time=(now + timedelta(seconds=45)).isoformat(),
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
    })

    assert config["paperBankroll"] == 100.0
    assert config["riskPerTradePct"] == 2.0
    assert "maxContracts" not in config
    assert "maxDailyLossPct" not in config
    assert config["minNetEdge"] == 0.02


def test_adaptive_learning_config_is_explicit_and_bounded():
    disabled = normalize_strategy_config({"learningMode": "true", "preTradeAiReview": "true"})
    enabled = normalize_strategy_config({
        "preTradeAiReview": True,
        "learningMode": True,
        "learningAiMode": True,
        "learningContrarianMode": True,
        "learningExplorationRate": 0.9,
        "learningReviewEvery": 1,
        "learningWindowSize": 500,
        "learningMaxRiskPct": 5,
    })

    assert disabled["preTradeAiReview"] is False
    assert enabled["preTradeAiReview"] is True

    assert disabled["learningMode"] is False
    assert enabled["learningMode"] is True
    assert enabled["learningAiMode"] is True
    assert enabled["learningContrarianMode"] is True
    assert enabled["learningExplorationRate"] == 0.35
    assert enabled["learningReviewEvery"] == 4
    assert enabled["learningWindowSize"] == 100
    assert enabled["learningMaxRiskPct"] == 1.0


def test_paper_exploration_can_collect_one_near_threshold_sample():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    result = evaluate_btc15_contract(
        _market(now, ticker="KXBTC15M-X-3", floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
        config={
            "learningMode": True,
            "learningExplorationRate": 0.35,
            "minNetEdge": 0.15,
            "minConservativeEdge": 0.08,
        },
    )

    assert result["explorationTrade"] is True
    assert result["explorationOverrides"] == ["net_edge"]
    assert result["action"] == "BUY_YES"
    assert result["sizing"]["contracts"] >= 1


def test_paper_exploration_never_overrides_account_or_execution_gates():
    now = datetime.now(timezone.utc)
    candles, spot = _candles()
    result = evaluate_btc15_contract(
        _market(now, ticker="KXBTC15M-X-3", floor_strike=64_660.0),
        spot_price=spot,
        candles=candles,
        now=now,
        config={
            "learningMode": True,
            "learningExplorationRate": 0.35,
            "minNetEdge": 0.15,
            "minConservativeEdge": 0.08,
        },
        account_context={
            "bankroll": 1000,
            "cashAvailable": 1000,
            "hasOpenOrder": True,
        },
    )

    assert result["explorationTrade"] is False
    assert result["action"] == "WAIT"
    assert "open_order" in result["blockingReasons"]
