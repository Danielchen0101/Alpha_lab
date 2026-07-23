import json

from kalshi_robot_state import KalshiRobotState


def test_decision_log_survives_process_restart(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    store = KalshiRobotState(str(path))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "signalQuality": 82,
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-TEST"},
        "edge": {"fairProbability": 0.62, "price": 0.53, "netEdge": 0.07},
    }, {"order_id": "order-1", "status": "filled", "fill_count": 1})

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["decisions"][0]["ticker"] == "KXBTC15M-TEST"
    assert restored["decisions"][0]["fairProbability"] == 0.62


def test_pretrade_ai_review_is_audited_with_the_latest_decision(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    store = KalshiRobotState(str(path))
    review = {
        "status": "reviewed",
        "verdict": "challenge",
        "confidence": 0.81,
        "summary": "Momentum conflicts with the selected side.",
        "ticker": "KXBTC15M-AI",
    }
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "WAIT",
        "side": "YES",
        "blockingReasons": ["ai_challenge"],
        "market": {"ticker": "KXBTC15M-AI"},
        "edge": {"fairProbability": 0.62, "price": 0.53},
        "aiReview": review,
    })

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["decisions"][0]["aiReview"] == review
    assert restored["strategy"]["preTradeAi"] == review


def test_pre_v4_trade_and_learning_data_is_removed_during_upgrade(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    path.write_text(json.dumps({"user-1": {
        "storageVersion": 3,
        "enabled": True,
        "config": {"riskPerTradePct": 0.5},
        "decisions": [{"ticker": "OLD"}],
        "filledTrades": [{"ticker": "OLD"}],
        "learningObservations": [{"ticker": "OLD"}],
        "learningExamples": [{"ticker": "OLD"}],
    }}), encoding="utf-8")

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["storageVersion"] == 4
    assert restored["enabled"] is True
    assert restored["decisions"] == []
    assert restored["filledTrades"] == []
    assert restored["learningObservations"] == []
    assert restored["learningExamples"] == []


def test_settlement_calibration_is_idempotent(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-TEST"},
        "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
    })
    settlement = {"ticker": "KXBTC15M-TEST", "settled_time": "2026-07-21T00:15:00Z", "market_result": "yes"}

    first = store.reconcile_settlements("user-1", [settlement])
    second = store.reconcile_settlements("user-1", [settlement])

    assert first["strategy"]["settledSamples"] == 1
    assert first["strategy"]["winRate"] == 1.0
    assert second["strategy"]["settledSamples"] == 1


def test_settlement_record_exposes_weighted_entry_and_resolution_exit_prices(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    ticker = "KXBTC15M-PRICES"
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": ticker},
        "edge": {"fairProbability": 0.70, "price": 0.55},
    }, {"order_id": "price-order", "status": "filled", "fill_count": 10})
    settlement = {
        "ticker": ticker,
        "settled_time": "2026-07-21T00:15:00Z",
        "market_result": "yes",
        "yes_count_fp": 10,
        "no_count_fp": 0,
        "revenue_dollars": 10,
        "yes_total_cost_dollars": 5.5,
        "no_total_cost_dollars": 0,
        "fee_cost_dollars": 0.2,
    }
    fills = [{
        "ticker": ticker,
        "outcome_side": "YES",
        "count_fp": 10,
        "price_dollars": 0.55,
        "environment": "paper",
    }]

    state = store.reconcile_settlements("user-1", [settlement], fills)
    record = state["strategy"]["settlementRecords"][0]

    assert record["entryPrice"] == 0.55
    assert record["exitPrice"] == 1.0
    assert record["exitType"] == "settlement"


def test_weak_calibration_only_tightens_default_risk(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningReviewEvery": 4,
        "learningWindowSize": 20,
        "learningExplorationRate": 0.20,
    })
    settlements = []
    for index in range(20):
        ticker = f"KXBTC15M-LOSS-{index}"
        store.record("user-1", {
            "generatedAt": f"2026-07-21T00:{index:02d}:00Z",
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
        }, {"order_id": f"order-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T01:{index:02d}:00Z",
            "market_result": "no",
        })

    state = store.reconcile_settlements("user-1", settlements)

    assert state["strategy"]["settledSamples"] == 20
    assert state["strategy"]["winRate"] == 0.0
    assert state["config"]["riskPerTradePct"] < 0.35
    assert state["config"]["marketBlendWeight"] > 0.25
    assert state["config"]["minNetEdge"] > 0.04
    assert state["strategy"]["learning"]["status"] == "reviewed"
    assert state["strategy"]["learning"]["adjustmentCount"] == 1


def test_learning_never_adapts_production_configuration(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningReviewEvery": 4,
        "learningWindowSize": 20,
    })
    before = dict(configured["config"])
    settlements = []
    for index in range(12):
        ticker = f"KXBTC15M-PROD-{index}"
        store.record("user-1", {
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "edge": {"fairProbability": 0.75, "price": 0.55},
        }, {"order_id": f"prod-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T02:{index:02d}:00Z",
            "market_result": "no",
        })

    state = store.reconcile_settlements(
        "user-1", settlements, environment="production"
    )

    assert state["config"] == before
    assert state["activeEnvironment"] == "paper"
    real_learning = state["modeState"]["real"]["strategy"]["learning"]
    assert real_learning["paperOnly"] is False
    assert real_learning["adjustmentCount"] == 0


def test_learning_waits_for_filled_and_settled_warmup(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningReviewEvery": 4,
    })

    state = store.reconcile_settlements("user-1", [])

    assert state["config"] == configured["config"]
    assert state["strategy"]["learning"]["status"] == "warmup"
    assert state["strategy"]["learning"]["nextReviewSample"] == 12


def test_profitable_calibrated_window_expands_only_inside_learning_cap(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningReviewEvery": 4,
        "learningWindowSize": 20,
        "learningMaxRiskPct": 0.36,
    })
    settlements = []
    for index in range(16):
        ticker = f"KXBTC15M-WIN-{index}"
        store.record("user-1", {
            "generatedAt": f"2026-07-21T03:{index:02d}:00Z",
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "edge": {"fairProbability": 0.75, "price": 0.55},
        }, {"order_id": f"win-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T04:{index:02d}:00Z",
            "market_result": "yes",
        })

    state = store.reconcile_settlements("user-1", settlements)

    assert configured["config"]["riskPerTradePct"] < state["config"]["riskPerTradePct"]
    assert state["config"]["riskPerTradePct"] <= 0.36
    assert state["strategy"]["learning"]["recentWinRate"] == 1.0
    assert "expanded cautiously" in state["strategy"]["learning"]["lastReason"]


def test_neutral_window_increases_paper_exploration_without_relaxing_hard_gates(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningReviewEvery": 4,
        "learningWindowSize": 20,
        "learningExplorationRate": 0.20,
    })
    settlements = []
    for index in range(16):
        ticker = f"KXBTC15M-NEUTRAL-{index}"
        store.record("user-1", {
            "generatedAt": f"2026-07-21T05:{index:02d}:00Z",
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "edge": {"fairProbability": 0.50, "price": 0.45},
        }, {"order_id": f"neutral-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T06:{index:02d}:00Z",
            "market_result": "yes" if index % 2 == 0 else "no",
        })

    state = store.reconcile_settlements("user-1", settlements)

    assert state["config"]["minNetEdge"] < configured["config"]["minNetEdge"]
    assert state["config"]["maxSpread"] == configured["config"]["maxSpread"]
    assert state["config"]["minDepthContracts"] == configured["config"]["minDepthContracts"]
    assert state["config"]["maxPortfolioExposurePct"] == configured["config"]["maxPortfolioExposurePct"]
    assert "maxDailyLossPct" not in state["config"]
    assert "neutral" in state["strategy"]["learning"]["lastReason"]


def test_only_filled_trades_enter_realized_win_rate(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-NOFILL"},
        "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
    }, {"order_id": "order-no-fill", "status": "canceled", "fill_count": 0})

    state = store.reconcile_settlements("user-1", [{
        "ticker": "KXBTC15M-NOFILL",
        "settled_time": "2026-07-21T00:15:00Z",
        "market_result": "yes",
        "revenue_dollars": "1.00",
        "yes_total_cost_dollars": "0.55",
    }], [])

    assert state["strategy"]["settledSamples"] == 0
    assert state["strategy"]["settlementRecords"] == []


def test_decision_log_keeps_only_latest_but_filled_trade_evidence_survives(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    for index in range(3):
        store.record("user-1", {
            "generatedAt": f"2026-07-21T00:0{index}:00Z",
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": f"KXBTC15M-{index}"},
            "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
        }, {"order_id": f"order-{index}", "status": "filled", "fill_count": 1})

    state = store.get("user-1")

    assert state["decisionLimit"] == 1
    assert len(state["decisions"]) == 1
    assert state["decisions"][0]["ticker"] == "KXBTC15M-2"
    assert len(state["filledTrades"]) == 3
    assert state["tradedTickers"] == ["KXBTC15M-0", "KXBTC15M-1", "KXBTC15M-2"]


def test_settings_ai_review_is_claimed_once_per_new_evidence_batch(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "learningReviewEvery": 4,
    })
    settlements = []
    for index in range(8):
        ticker = f"KXBTC15M-AI-{index}"
        store.record("user-1", {
            "action": "BUY_YES",
            "side": "YES",
            "market": {"ticker": ticker, "secondsToClose": 300},
            "model": {"originalModelYesProbability": 0.70},
            "edge": {"fairProbability": 0.70, "price": 0.55},
        }, {"order_id": f"ai-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T08:{index:02d}:00Z",
            "market_result": "no",
        })
        store.reconcile_learning_outcome("user-1", ticker, "NO", settled_at=f"2026-07-21T08:{index:02d}:00Z")
    store.reconcile_settlements("user-1", settlements)

    evidence = store.claim_ai_learning_review("user-1", environment="paper")

    assert evidence["sampleCount"] == 8
    assert evidence["metrics"]["originalDirectionalAccuracy"] == 0.0
    assert evidence["metrics"]["inverseDirectionalAccuracy"] == 1.0
    assert evidence["metrics"]["observedDirectionalAccuracy"] == 0.0
    assert store.claim_ai_learning_review("user-1", environment="paper") is None


def test_shadow_forecasts_create_learning_labels_without_fake_trades(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "learningReviewEvery": 4,
    })
    for index in range(8):
        ticker = f"KXBTC15M-SHADOW-{index}"
        store.record("user-1", {
            "action": "WAIT",
            "side": "YES",
            "blockingReasons": ["net_edge"],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "model": {"originalModelYesProbability": 0.60},
            "edge": {"fairProbability": 0.60, "price": 0.58, "netEdge": 0.01},
        })
        store.reconcile_learning_outcome("user-1", ticker, "NO")

    state = store.get("user-1")
    assert state["strategy"]["settledSamples"] == 0
    assert state["strategy"]["learning"]["observedSamples"] == 8
    assert state["strategy"]["learning"]["observedDirectionalAccuracy"] == 0.0
    assert state["strategy"]["learning"]["observedInverseAccuracy"] == 1.0
    evidence = store.claim_ai_learning_review("user-1", environment="paper")
    assert len(evidence["shadowForecastWindow"]) == 8
    assert evidence["settledTradeWindow"] == []


def test_ai_adjustments_are_bounded_and_cannot_raise_sizing_risk(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "riskPerTradePct": 0.25,
        "learningExplorationRate": 0.20,
    })

    state = store.complete_ai_learning_review("user-1", {
        "diagnosis": "The model is over-weighting recent momentum.",
        "confidence": 0.9,
        "directionRecommendation": "contrarian",
        "reasons": ["Six losses are insufficient for a direction flip."],
        "adjustments": {
            "marketBlendWeight": 5,
            "learningExplorationRate": 5,
            "riskPerTradePct": 1.5,
        },
    }, provider="deepseek", model="deepseek-chat")

    assert state["config"]["riskPerTradePct"] == configured["config"]["riskPerTradePct"]
    assert state["config"]["marketBlendWeight"] == configured["config"]["marketBlendWeight"] + 0.05
    assert state["config"]["learningExplorationRate"] == configured["config"]["learningExplorationRate"] + 0.05
    assert state["config"]["learningContrarianMode"] is False
    assert state["strategy"]["learning"]["aiStatus"] == "reviewed"
    assert state["strategy"]["learning"]["adjustmentCount"] == 1


def test_historical_ai_changes_are_included_in_adjustment_count(tmp_path):
    state_path = tmp_path / "state.json"
    store = KalshiRobotState(str(state_path))
    store.configure("user-1", True, {"learningMode": True, "learningAiMode": True})
    store.complete_ai_learning_review("user-1", {
        "diagnosis": "Apply one bounded calibration.",
        "confidence": 0.9,
        "adjustments": {"marketBlendWeight": 0.02},
    })

    payload = json.loads(state_path.read_text())
    payload["user-1"]["modeState"]["paper"]["strategy"]["learning"]["adjustmentCount"] = 0
    state_path.write_text(json.dumps(payload))

    reloaded = KalshiRobotState(str(state_path)).get("user-1", environment="paper")
    assert reloaded["strategy"]["learning"]["adjustmentCount"] == 1


def test_contrarian_mode_requires_large_stable_direction_gap(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "learningReviewEvery": 6,
        "learningWindowSize": 24,
    })
    settlements = []
    for index in range(24):
        ticker = f"KXBTC15M-INVERSE-{index}"
        store.record("user-1", {
            "action": "BUY_YES",
            "side": "YES",
            "market": {"ticker": ticker, "secondsToClose": 300},
            "model": {"originalModelYesProbability": 0.75},
            "edge": {"fairProbability": 0.75, "price": 0.55},
        }, {"order_id": f"inverse-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T09:{index:02d}:00Z",
            "market_result": "no",
        })
        store.reconcile_learning_outcome("user-1", ticker, "NO", settled_at=f"2026-07-21T09:{index:02d}:00Z")
    store.reconcile_settlements("user-1", settlements)
    assert store.claim_ai_learning_review("user-1", environment="paper") is not None

    state = store.complete_ai_learning_review("user-1", {
        "diagnosis": "The inverse direction is stable across the full window.",
        "confidence": 0.82,
        "directionRecommendation": "contrarian",
        "reasons": ["24 of 24 original directions missed."],
        "adjustments": {},
    })

    assert state["config"]["learningContrarianMode"] is True
    assert state["strategy"]["learning"]["contrarianMode"] is True
