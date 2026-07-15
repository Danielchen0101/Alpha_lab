import start_quant_backend as backend
import json


def _candidate():
    return {
        "symbol": "TEST",
        "dataQuality": "good",
        "eventRisk": "Low",
        "avgDollarVolume20": 100_000_000,
        "estimatedRoundTripCostBps": 20,
        "spreadBps": 6,
        "executionReadinessScore": 78,
        "liquidityScore": 82,
        "_dvStrategyTrialCount": 5,
        "benchmarkReturns": {"SPY": {"12m": 15}},
    }


def _packet(oos_trades=6, bars=252, strategy_trials=5, return_spread=12, positive_fold_ratio=0.67,
            candidate_updates=None):
    candidate = _candidate()
    candidate["_dvStrategyTrialCount"] = strategy_trials
    candidate.update(candidate_updates or {})
    return backend._build_institutional_dv_packet(
        candidate,
        {
            "totalReturn": 30,
            "sharpeRatio": 1.5,
            "maxDrawdown": 12,
            "winRate": 56,
            "profitFactor": 1.7,
            "tradeCount": 12,
        },
        {
            "score": 82,
            "profitableRatio": 0.8,
            "medianReturn": 18,
            "returnSpread": return_spread,
        },
        "Consistent",
        {
            "currentPrice": 100,
            "entryZoneLow": 99,
            "entryZoneHigh": 101,
            "stopLoss": 96,
            "takeProfit1": 110,
            "riskReward1": 1.8,
            "entryDistancePct": 0,
        },
        {"status": "PASS", "reason": "ok"},
        "momentum",
        "test",
        bars,
        6,
        6,
        oos_validation={
            "available": True,
            "status": "Walk-forward Positive",
            "method": "anchored_walk_forward_v1",
            "foldCount": 3,
            "positiveFoldRatio": positive_fold_ratio,
            "worstFoldReturn": 0.5,
            "holdoutReturn": 6,
            "holdoutSharpe": 0.8,
            "holdoutTrades": oos_trades,
            "trainBars": 176,
            "holdoutBars": 76,
        },
    )


def test_fine_scan_ai_cannot_override_hard_gate():
    decision, blocked, reason = backend._pa_merge_fine_scan_ai_decision(
        "Reject", "Watch", "BLOCK", ["ADV20 below $5M"]
    )

    assert decision == "Reject"
    assert blocked is True
    assert "hard gate" in reason


def test_fine_scan_ai_cannot_promote_watch():
    decision, blocked, _ = backend._pa_merge_fine_scan_ai_decision(
        "Watch", "Continue", "REVIEW", []
    )

    assert decision == "Watch"
    assert blocked is True


def test_fine_scan_fresh_quote_replaces_stale_scanner_cost():
    cost, spread, source = backend._pa_fine_scan_execution_cost(
        100_000_000,
        35,
        4,
        900,
        1_050,
        False,
    )

    assert spread == 4
    assert cost < 20
    assert source.startswith("fresh Alpaca quote")


def test_dv_uses_net_excess_return_and_selection_adjustment():
    packet = _packet()

    assert packet["dvVersion"] == "institutional_v5_walk_forward_cost_selection_adjusted"
    assert packet["grossReturn"] == 30
    assert packet["netReturn"] == 27.6
    assert packet["benchmarkReturn"] == 15
    assert packet["excessReturn"] == 12.6
    assert packet["selectionBiasPenalty"] > 0
    assert packet["overfitRiskScore"] > 0
    assert packet["selectionAdjustedSharpeProxy"] < 1.5
    assert packet["walkForwardProxy"]["foldCount"] == 3
    assert packet["validationScore"] < packet["rawValidationScore"]
    assert packet["sampleQuality"]["minPassTrades"] == 10


def test_dv_does_not_pass_with_thin_oos_sample():
    packet = _packet(oos_trades=1)

    assert packet["dvDecision"] != "PASS_DV"
    assert any("thin walk-forward sample" in warning for warning in packet["institutionalGate"]["warnings"])


def test_dv_parameter_rank_is_cost_and_risk_adjusted():
    raw_winner = {"totalReturn": 20, "sharpeRatio": 0.4, "maxDrawdown": 30, "tradeCount": 40}
    robust = {"totalReturn": 16, "sharpeRatio": 1.4, "maxDrawdown": 10, "tradeCount": 8}

    raw_score, raw_net = backend._dv_parameter_rank_score(raw_winner, 50)
    robust_score, robust_net = backend._dv_parameter_rank_score(robust, 50)

    assert raw_net == 0
    assert robust_net == 12
    assert robust_score > raw_score


def test_dv_annualizes_multi_year_net_return_before_benchmark_comparison():
    packet = _packet(bars=504)

    assert packet["annualizedNetReturn"] < packet["netReturn"]
    assert packet["benchmarkAnnualizedReturn"] == 15
    assert packet["excessReturn"] == round(packet["annualizedNetReturn"] - 15, 1)


def test_dv_prefers_period_aligned_spy_benchmark():
    packet = _packet(candidate_updates={
        "_dvAlignedBenchmarkReturn": 9.5,
        "_dvAlignedBenchmarkSource": "Alpaca SPY bars aligned to 2y",
    })

    assert packet["benchmarkAnnualizedReturn"] == 9.5
    assert packet["benchmarkAligned"] is True
    assert packet["benchmarkSource"] == "Alpaca SPY bars aligned to 2y"


def test_dv_overfit_proxy_increases_with_trials_and_parameter_spread():
    baseline = _packet(strategy_trials=2, return_spread=5)
    searched = _packet(strategy_trials=12, return_spread=45)

    assert searched["overfitRiskScore"] > baseline["overfitRiskScore"]
    assert searched["selectionBiasPenalty"] > baseline["selectionBiasPenalty"]


def test_dv_weak_walk_forward_cannot_pass():
    packet = _packet(positive_fold_ratio=0.33)

    assert packet["dvDecision"] != "PASS_DV"
    assert any("walk-forward folds positive" in warning for warning in packet["institutionalGate"]["warnings"])


def test_dv_walk_forward_uses_chronological_anchored_folds(monkeypatch):
    calls = []

    def fake_backtest(symbol, strategy, params, rows, initial_capital):
        calls.append((len(rows), params["lookback"]))
        return {
            "metrics": {
                "totalReturn": 4 + params["lookback"] / 10,
                "sharpeRatio": 0.8,
                "maxDrawdown": 8,
                "tradeCount": 4,
            }
        }, None

    monkeypatch.setattr(backend, "_run_backtest_core", fake_backtest)
    rows = [{"timestamp": f"day-{index:03d}", "close": 100} for index in range(420)]
    result = backend._dv_walk_forward_validation(
        "TEST", "momentum", [{"lookback": 10}, {"lookback": 20}], {"lookback": 10},
        rows, 100_000, 10,
    )

    assert result["available"] is True
    assert result["foldCount"] == 3
    train_lengths = [fold["trainBars"] for fold in result["folds"]]
    assert train_lengths == sorted(train_lengths)
    assert len(set(train_lengths)) == 3
    assert all(fold["testBars"] > 0 for fold in result["folds"])
    assert max(length for length, _ in calls) < len(rows)


def test_dv_ai_cache_hit_keeps_routing_decision_in_sync(monkeypatch):
    backend._DV_AI_OVERLAY_CACHE.clear()
    result = {
        "symbol": "TEST",
        "validationStrategy": "momentum",
        "validationScore": 80,
        "edgeScore": 80,
        "sampleScore": 80,
        "executionScore": 80,
        "riskScore": 80,
        "totalReturn": 20,
        "sharpeRatio": 1.2,
        "maxDrawdown": 10,
        "profitFactor": 1.5,
        "verdict": "Confirmed",
        "dvDecision": "PASS_DV",
        "institutionalGate": {"status": "PASS", "blockers": [], "warnings": []},
    }
    config = {"provider": "TestAI", "model": "test-model", "apiKey": "test"}
    cache_key = backend._build_ai_overlay_cache_key(result, config)
    backend._DV_AI_OVERLAY_CACHE[cache_key] = {
        "ts": backend.time.time(),
        "fields": {
            "aiValidationUsed": True,
            "aiValidationVerdict": "Watch",
            "finalVerdict": "Watch",
            "finalVerdictSource": "local_rules_ai_downgrade",
        },
    }

    updated = backend._ai_deeper_validation_overlay_safe(result, ai_config=config)

    assert updated["aiValidationCacheHit"] is True
    assert updated["verdict"] == "Watch"
    assert updated["dvDecision"] == "WATCH"
    backend._DV_AI_OVERLAY_CACHE.clear()


def test_dv_ai_normalizes_percent_confidence_and_fenced_json(monkeypatch):
    class FakeResponse:
        status_code = 200

        def json(self):
            content = json.dumps({
                "aiVerdict": "Watch",
                "aiConfidence": 75,
                "aiReason": "OOS evidence deserves monitoring.",
                "aiRiskNotes": "Thin sample",
                "aiCatalystNotes": "none",
                "aiContextAdjustment": "none",
                "aiContradictions": [],
                "aiMissingEvidence": ["More OOS trades"],
                "aiNextCheck": "Re-run after five more OOS trades",
            })
            return {"choices": [{"message": {"content": "```json\n" + content + "\n```"}}]}

    monkeypatch.setattr(backend, "ai_chat_request", lambda *_args, **_kwargs: FakeResponse())
    result = _packet()
    result.update({
        "symbol": "TEST",
        "validationStrategy": "momentum",
        "strategyStackTested": ["momentum"],
        "verdict": "Confirmed",
        "dvDecision": "PASS_DV",
        "institutionalGate": {"status": "PASS", "blockers": [], "warnings": []},
    })

    updated = backend._ai_deeper_validation_overlay(
        result,
        ai_config={"apiKey": "test", "provider": "TestAI", "model": "test", "baseURL": "https://example.com"},
        ai_source="test",
    )

    assert updated["aiValidationConfidence"] == 0.75
    assert updated["finalVerdict"] == "Watch"
    assert updated["dvDecision"] == "WATCH"
