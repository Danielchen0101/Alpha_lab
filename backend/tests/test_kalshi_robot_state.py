import json

import pytest

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


def test_pre_v5_trade_and_learning_data_is_removed_during_upgrade(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    path.write_text(json.dumps({"user-1": {
        "storageVersion": 4,
        "enabled": True,
        "config": {"riskPerTradePct": 0.5, "minPrice": 0.12, "maxPrice": 0.88},
        "decisions": [{"ticker": "OLD"}],
        "filledTrades": [{"ticker": "OLD"}],
        "learningObservations": [{"ticker": "OLD"}],
        "learningExamples": [{"ticker": "OLD"}],
    }}), encoding="utf-8")

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["storageVersion"] == 5
    assert restored["enabled"] is True
    assert restored["decisions"] == []
    assert restored["filledTrades"] == []
    assert restored["learningObservations"] == []
    assert restored["learningExamples"] == []
    # Old longshot-era tuning is replaced by the calibrated v3 favorite band.
    assert restored["config"]["minPrice"] == 0.50
    assert restored["config"]["maxPrice"] == 0.93
    assert restored["config"]["minModelProbability"] == 0.60


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
    assert state["config"]["riskPerTradePct"] < 0.75
    assert state["config"]["marketBlendWeight"] > 0.20
    assert state["config"]["minNetEdge"] > 0.015
    assert state["config"]["minModelProbability"] > 0.60
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
        "learningMaxRiskPct": 0.85,
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
            "edge": {"fairProbability": 0.88, "price": 0.82},
        }, {"order_id": f"win-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T04:{index:02d}:00Z",
            "market_result": "yes",
        })

    state = store.reconcile_settlements("user-1", settlements)

    assert configured["config"]["riskPerTradePct"] < state["config"]["riskPerTradePct"]
    assert state["config"]["riskPerTradePct"] <= 0.85
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
            "edge": {"fairProbability": 0.75, "price": 0.55},
        }, {"order_id": f"neutral-{index}", "status": "filled", "fill_count": 1})
        settlements.append({
            "ticker": ticker,
            "settled_time": f"2026-07-21T06:{index:02d}:00Z",
            # 12 of 16 wins: above the v3 weak threshold (72%) but below the
            # expansion benchmark (85%), i.e. a genuinely neutral window.
            "market_result": "no" if index % 4 == 3 else "yes",
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


def test_filled_entry_and_exit_times_persist_outside_single_decision_slot(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-TIMING"},
        "edge": {"price": 0.45},
    }, {"status": "filled", "fill_count": 2})
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:01:00Z",
        "action": "SELL_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-TIMING"},
        "edge": {"price": 0.55},
    }, {"status": "filled", "fill_count": 2})
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:01:05Z",
        "action": "WAIT",
        "market": {"ticker": "KXBTC15M-TIMING"},
    })

    restored = KalshiRobotState(str(tmp_path / "state.json")).get("user-1")

    assert len(restored["decisions"]) == 1
    assert restored["strategy"]["lastEntryTicker"] == "KXBTC15M-TIMING"
    assert restored["strategy"]["lastEntryAt"] == "2026-07-21T00:00:00Z"
    assert restored["strategy"]["lastExitTicker"] == "KXBTC15M-TIMING"
    assert restored["strategy"]["lastExitAt"] == "2026-07-21T00:01:00Z"


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
    store.record_early_close("user-1", {
        "generatedAt": "2026-07-21T08:10:00Z",
        "action": "SELL_YES",
        "side": "YES",
        "executionIntent": "CLOSE_YES",
        "market": {"ticker": "KXBTC15M-AI-CLOSE"},
        "exitAnalysis": {"averageEntryPrice": 0.42, "exitValueEdge": 0.02},
    }, {
        "order_id": "ai-close-1",
        "ticker": "KXBTC15M-AI-CLOSE",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "YES",
        "status": "executed",
        "fill_count_fp": 3,
        "average_price_dollars": 0.50,
        "entry_fee_allocated_dollars": 0.01,
        "fee_cost_dollars": 0.02,
        "realized_pnl_dollars": 0.21,
    }, environment="paper")

    evidence = store.claim_ai_learning_review("user-1", environment="paper")

    assert evidence["sampleCount"] == 8
    assert evidence["metrics"]["originalDirectionalAccuracy"] == 0.0
    assert evidence["metrics"]["inverseDirectionalAccuracy"] == 1.0
    assert evidence["metrics"]["observedDirectionalAccuracy"] == 0.0
    assert evidence["metrics"]["earlyExitSamples"] == 1
    assert evidence["metrics"]["earlyExitTotalPnl"] == 0.21
    assert evidence["earlyCloseWindow"][0]["pnl"] == 0.21
    assert evidence["evidenceSummary"]["samples"]["finalSettlements"] == 8
    assert evidence["evidenceSummary"]["samples"]["shadowLabels"] == 8
    assert evidence["evidenceSummary"]["calibration"]["modelBrier"] is not None
    assert evidence["evidenceSummary"]["calibration"]["reliabilityBins"]
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
    assert state["strategy"]["learning"]["directionalWindowSamples"] == 8
    assert state["strategy"]["learning"]["observedDirectionalAccuracy"] == 0.0
    assert state["strategy"]["learning"]["observedInverseAccuracy"] == 1.0
    evidence = store.claim_ai_learning_review("user-1", environment="paper")
    assert len(evidence["shadowForecastWindow"]) == 8
    assert evidence["settledTradeWindow"] == []


def test_directional_accuracy_reports_the_actual_rolling_window_denominator(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningWindowSize": 12,
    })
    results = ["NO", "NO"] + (["YES"] * 9) + (["NO"] * 3)
    for index, result in enumerate(results):
        ticker = f"KXBTC15M-WINDOW-{index}"
        store.record("user-1", {
            "action": "WAIT",
            "side": "YES",
            "blockingReasons": ["net_edge"],
            "market": {"ticker": ticker, "secondsToClose": 300},
            "model": {"originalModelYesProbability": 0.60},
            "edge": {"fairProbability": 0.60, "price": 0.58, "netEdge": 0.01},
        })
        store.reconcile_learning_outcome("user-1", ticker, result)

    learning = store.get("user-1")["strategy"]["learning"]
    assert learning["observedSamples"] == 14
    assert learning["directionalWindowSamples"] == 12
    assert learning["observedDirectionalAccuracy"] == 0.75
    assert learning["observedInverseAccuracy"] == 0.25


def test_ai_adjustments_are_bounded_and_cannot_raise_sizing_risk(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "riskPerTradePct": 0.25,
        "learningExplorationRate": 0.20,
    })
    internal = store._state("user-1")["modeState"]["paper"]
    internal["strategy"].update({
        "realizedSamples": 20,
        # Healthy for the v3 favorite-carry benchmark (weak is < 0.72).
        "realizedWinRate": 0.88,
        "realizedAveragePnl": 2.0,
        "settledSamples": 16,
        "brierScore": 0.12,
    })
    internal["strategy"]["learning"].update({
        "observedSamples": 24,
        "earlyExitSamples": 12,
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


def test_ai_guardrails_reject_looser_execution_exploration_and_confidence_after_losses(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "executionPriceTolerance": 0.01,
        "learningExplorationRate": 0.20,
        "probabilityLogitScale": 1.55,
        "marketBlendWeight": 0.25,
    })
    state = store._state("user-1")
    strategy = state["modeState"]["paper"]["strategy"]
    strategy.update({
        "realizedSamples": 20,
        "realizedWinRate": 0.25,
        "realizedAveragePnl": -12.0,
        "settledSamples": 12,
        "brierScore": 0.42,
    })

    reviewed = store.complete_ai_learning_review("user-1", {
        "diagnosis": "Execution and calibration are weak.",
        "confidence": 0.9,
        "adjustments": {
            "executionPriceTolerance": 0.002,
            "learningExplorationRate": 0.05,
            "probabilityLogitScale": 0.05,
            "marketBlendWeight": 0.03,
        },
    })

    assert reviewed["config"]["executionPriceTolerance"] == 0.01
    assert reviewed["config"]["learningExplorationRate"] == 0.20
    assert reviewed["config"]["probabilityLogitScale"] == 1.55
    assert reviewed["config"]["marketBlendWeight"] == 0.28
    rejected = reviewed["strategy"]["learning"]["lastAiRejectedAdjustments"]
    assert set(rejected) == {
        "executionPriceTolerance",
        "learningExplorationRate",
        "probabilityLogitScale",
    }
    assert reviewed["strategy"]["changes"][0]["rejected"] == rejected


def test_ai_parameter_changes_require_parameter_specific_evidence(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "minNetEdge": 0.05,
        "marketBlendWeight": 0.25,
    })

    reviewed = store.complete_ai_learning_review("user-1", {
        "diagnosis": "There is not enough labeled evidence.",
        "rootCause": "insufficient_data",
        "confidence": 0.9,
        "adjustments": {
            "minNetEdge": -0.0025,
            "marketBlendWeight": 0.05,
        },
    })

    assert reviewed["config"]["minNetEdge"] == configured["config"]["minNetEdge"]
    assert reviewed["config"]["marketBlendWeight"] == configured["config"]["marketBlendWeight"]
    rejected = reviewed["strategy"]["learning"]["lastAiRejectedAdjustments"]
    assert "16 realized trades" in rejected["minNetEdge"]["reason"]
    assert "12 final settlement labels" in rejected["marketBlendWeight"]["reason"]


def test_ai_cannot_loosen_entry_selectivity_during_weak_performance(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "learningMode": True,
        "learningAiMode": True,
        "minNetEdge": 0.05,
        "minConservativeEdge": 0.025,
    })
    strategy = store._state("user-1")["modeState"]["paper"]["strategy"]
    strategy.update({
        "realizedSamples": 20,
        "realizedWinRate": 0.25,
        "realizedAveragePnl": -5.0,
    })

    reviewed = store.complete_ai_learning_review("user-1", {
        "diagnosis": "Losses suggest more selectivity, not less.",
        "rootCause": "entry_selectivity",
        "confidence": 0.9,
        "adjustments": {
            "minNetEdge": -0.0025,
            "minConservativeEdge": -0.0015,
        },
    })

    assert reviewed["config"]["minNetEdge"] == configured["config"]["minNetEdge"]
    assert reviewed["config"]["minConservativeEdge"] == configured["config"]["minConservativeEdge"]
    assert set(reviewed["strategy"]["learning"]["lastAiRejectedAdjustments"]) == {
        "minNetEdge",
        "minConservativeEdge",
    }


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


def test_fresh_paper_strategy_archives_history_and_starts_strategy_2_clean(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    configured = store.configure("user-1", True, {
        "executionMode": "paper",
        "paperBankroll": 10_000,
        "learningMode": True,
        "learningAiMode": True,
        "learningContrarianMode": True,
        "learningReviewEvery": 4,
        "learningWindowSize": 24,
    })
    bucket = configured["modeState"]["paper"]
    bucket["strategy"]["realizedSamples"] = 2
    bucket["strategy"]["realizedWins"] = 1
    bucket["strategy"]["realizedLosses"] = 1
    bucket["strategy"]["realizedWinRate"] = 0.5
    bucket["strategy"]["realizedTotalPnl"] = -4.0
    bucket["strategy"]["learning"]["adjustmentCount"] = 3
    store._users["user-1"] = configured
    store._save()

    fresh = store.start_fresh_strategy(
        "user-1",
        starting_bankroll=1000,
        name="AlphaLab Paper Strategy 2",
    )
    paper = fresh["modeState"]["paper"]
    strategies = [
        item for item in fresh["strategyLibrary"]
        if item["mode"] == "paper"
    ]
    archived = next(item for item in strategies if item["name"] == "AlphaLab Paper Strategy 1")
    active = next(item for item in strategies if item["active"])

    assert archived["active"] is False
    assert archived["metrics"]["realizedSamples"] == 2
    assert archived["metrics"]["adjustmentCount"] == 3
    assert active["name"] == "AlphaLab Paper Strategy 2"
    assert active["metrics"]["realizedSamples"] == 0
    assert active["metrics"]["adjustmentCount"] == 0
    assert paper["config"]["paperBankroll"] == 1000
    assert paper["strategy"]["learning"]["enabled"] is True
    assert paper["strategy"]["learning"]["contrarianMode"] is True
    assert paper["filledTrades"] == []
    assert paper["processedSettlements"] == []
    assert paper["learningObservations"] == []


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


def test_early_close_pnl_is_tracked_without_becoming_calibration_label(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    decision = {
        "generatedAt": "2026-07-22T12:00:00Z",
        "action": "SELL_YES",
        "side": "YES",
        "executionIntent": "CLOSE_YES",
        "market": {"ticker": "KXBTC15M-CLOSE"},
        "exitAnalysis": {
            "averageEntryPrice": 0.40,
            "exitValueEdge": 0.03,
            "trigger": "fee_adjusted_take_profit",
            "netExitPnlPerContract": 0.136,
            "exitLossFraction": 0.0,
        },
    }
    order = {
        "order_id": "close-1",
        "ticker": "KXBTC15M-CLOSE",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "YES",
        "status": "executed",
        "fill_count_fp": 5,
        "average_price_dollars": 0.55,
        "entry_fee_allocated_dollars": 0.03,
        "fee_cost_dollars": 0.04,
        "realized_pnl_dollars": 0.68,
    }

    state = store.record_early_close("user-1", decision, order, environment="paper")
    strategy = state["strategy"]

    assert strategy["closedTradeSamples"] == 1
    assert strategy["closedTradeTotalPnl"] == 0.68
    assert strategy["closedTradeRecords"][0]["settlementLabel"] is None
    assert strategy["settlementRecords"] == []
    assert strategy["learning"]["earlyExitCalibrationExcluded"] is True
    assert strategy["learning"]["earlyExitIncludedInPnlLearning"] is True
    assert strategy["realizedSamples"] == 1
    assert strategy["realizedTotalPnl"] == 0.68
    assert strategy["realizedTradeRecords"][0]["exitType"] == "sale"
    assert strategy["realizedTradeRecords"][0]["result"] is None
    assert strategy["realizedTradeRecords"][0]["exitTrigger"] == "fee_adjusted_take_profit"
    assert strategy["realizedTradeRecords"][0]["netExitPnlPerContract"] == 0.136
    assert strategy["realizedTradeRecords"][0]["exitLossFraction"] == 0.0
    assert strategy["closedTradeRecords"][0]["exitTrigger"] == "fee_adjusted_take_profit"
    assert strategy["closedTradeRecords"][0]["netExitPnlPerContract"] == 0.136
    assert strategy["closedTradeRecords"][0]["exitLossFraction"] == 0.0


def test_reconcile_backfills_reduce_only_fills_into_realized_analytics(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    fill = {
        "fill_id": "fill-close-1",
        "order_id": "close-1",
        "ticker": "KXBTC15M-CLOSE",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "NO",
        "fill_count_fp": 10,
        "average_price_dollars": 0.62,
        "position_cost_dollars": 4.0,
        "gross_proceeds_dollars": 6.2,
        "entry_fee_allocated_dollars": 0.1,
        "fee_cost_dollars": 0.2,
        "realized_pnl_dollars": 1.9,
        "created_time": "2026-07-22T12:15:00Z",
    }

    state = store.reconcile_settlements(
        "user-1",
        [],
        [fill],
        environment="paper",
    )
    strategy = state["strategy"]

    assert strategy["settledSamples"] == 0
    assert strategy["realizedSamples"] == 1
    assert strategy["realizedWins"] == 1
    assert strategy["totalPnl"] == 1.9
    assert strategy["equityCurve"][0]["cumulativePnl"] == 1.9
    record = strategy["realizedTradeRecords"][0]
    assert record["entryPrice"] == 0.4
    assert record["exitPrice"] == 0.62
    assert record["fees"] == 0.3


def test_saved_strategy_can_only_be_applied_to_its_own_execution_mode(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    saved = store.save_strategy(
        "user-1",
        {
            "executionMode": "paper",
            "riskPerTradePct": 0.35,
            "minimumNetEdgePct": 2.5,
        },
        name="Paper calibration",
        environment="paper",
    )
    strategy_id = saved["strategy"]["id"]

    with pytest.raises(ValueError, match="strategy_mode_mismatch"):
        store.apply_strategy("user-1", strategy_id, environment="real")

    real_state = store.get("user-1", environment="real")
    assert real_state["activeEnvironment"] == "real"
    assert real_state["config"]["executionMode"] == "real"
    assert real_state.get("activeStrategyId") != strategy_id

    paper_state = store.apply_strategy("user-1", strategy_id, environment="paper")
    assert paper_state["activeEnvironment"] == "paper"
    assert paper_state["config"]["executionMode"] == "paper"
    assert paper_state["modeState"]["paper"]["activeStrategyId"] == strategy_id
