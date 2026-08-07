import start_quant_backend as backend
from datetime import datetime, timezone


def test_confirmation_score_reweights_only_available_signals():
    metrics = backend._pa_fine_scan_confirmation_metrics({
        "momentum1m": 4,
        "momentum3m": 12,
        "momentum6m": None,
        "closeVs50dma": 3,
        "closeVs200dma": None,
        "relativeStrength3m": -2,
    })

    assert metrics["availableCount"] == 4
    assert metrics["positiveCount"] == 3
    assert metrics["score"] == 75
    assert metrics["coveragePct"] == 66.67


def test_fine_scan_ready_setup_routes_to_deeper_validation():
    decision = backend._pa_fine_scan_decision_policy(
        76,
        "REVIEW",
        entry_readiness="Ready",
        execution_score=70,
        setup_score=78,
        warning_count=2,
        reward_risk=1.45,
        evidence_reliability=88,
    )

    assert decision == "Continue"


def test_fine_scan_review_requires_exceptional_quality_to_continue():
    ordinary = backend._pa_fine_scan_decision_policy(
        74,
        "REVIEW",
        entry_readiness="Review",
        execution_score=70,
        setup_score=74,
        warning_count=1,
        reward_risk=1.6,
        evidence_reliability=90,
    )
    exceptional = backend._pa_fine_scan_decision_policy(
        80,
        "REVIEW",
        entry_readiness="Review",
        execution_score=74,
        setup_score=79,
        warning_count=1,
        reward_risk=1.65,
        evidence_reliability=92,
    )

    assert ordinary == "Watch"
    assert exceptional == "Continue"


def test_fine_scan_missing_required_evidence_is_not_a_reject():
    decision = backend._pa_fine_scan_decision_policy(
        30,
        "REVIEW",
        required_evidence_missing=["ADV20 unavailable"],
        entry_readiness="Review",
        execution_score=25,
        setup_score=60,
        evidence_reliability=40,
    )

    assert decision == "NeedMoreData"


def test_fine_scan_hard_gate_remains_binding():
    decision = backend._pa_fine_scan_decision_policy(
        90,
        "BLOCK",
        entry_readiness="Ready",
        execution_score=90,
        setup_score=90,
        hard_blockers=["asset not tradable"],
        reward_risk=2.0,
        evidence_reliability=98,
    )

    assert decision == "Reject"


def test_fine_scan_headless_emits_v4_evidence_contract(monkeypatch):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    snapshot = {
        "dailyBar": {"o": 100, "h": 103, "l": 99, "c": 101, "v": 2_000_000, "vw": 100.8},
        "prevDailyBar": {"c": 100, "v": 2_100_000},
        "latestTrade": {"p": 101, "t": now},
        "latestQuote": {"bp": 100.98, "ap": 101.02, "bs": 300, "as": 250, "t": now},
    }
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda *_args, **_kwargs: {"api_key": "test", "api_secret": "test"},
    )
    monkeypatch.setattr(
        backend,
        "_inst_fetch_alpaca_snapshots",
        lambda *_args, **_kwargs: ({"TEST": snapshot}, {}),
    )
    candidate = {
        "symbol": "TEST",
        "companyName": "Test Corp",
        "selectionScore": 84,
        "directionScore": 82,
        "scoreReliability": 94,
        "factorAgreementPct": 83,
        "dataQuality": "good",
        "historyDays": 252,
        "tradable": True,
        "avgDollarVolume20": 180_000_000,
        "capacityScore": 88,
        "estimatedRoundTripCostBps": 8,
        "spreadBps": 4,
        "momentum1m": 5,
        "momentum3m": 14,
        "momentum6m": 22,
        "relativeStrength3m": 8,
        "closeVs50dma": 4,
        "closeVs200dma": 12,
        "volumeRatio": 1.3,
        "realizedVol20": 28,
        "atrPercent": 2.4,
        "recentLow20": 96,
        "recentHigh20": 108,
        "eventRisk": "Low",
        "factorScores": {
            "momentum": 84,
            "trend": 82,
            "relative": 78,
            "liquidity": 88,
            "risk": 82,
        },
    }

    with backend.app.test_request_context("/api/ai-agent/fine-scan", method="POST", json={"maxSymbols": 30}):
        rows = backend._pa_fine_scan_headless("user-test", [candidate], pipeline_mode="rules")

    assert len(rows) == 1
    assert rows[0]["fineScanSource"] == "backend_institutional_v4"
    assert rows[0]["confirmationAvailableCount"] == 6
    assert rows[0]["requiredEvidenceMissing"] == []
    assert rows[0]["fineScoreReliability"] >= 90
    assert rows[0]["decision"] in {"Continue", "Watch"}


def test_fine_scan_ai_batches_cover_every_candidate_and_cannot_promote(monkeypatch):
    monkeypatch.setattr(
        backend,
        "resolve_ai_config",
        lambda **_kwargs: ({"apiKey": "test", "provider": "TestAI", "model": "test-model"}, "test"),
    )

    def fake_ai(_config, _system_prompt, user_prompt):
        symbols_line = next(line for line in user_prompt.splitlines() if line.startswith("Symbols:"))
        symbols = [symbol for symbol in symbols_line.replace("Symbols:", "").strip().split(",") if symbol]
        return {
            "reviews": [
                {
                    "symbol": symbol,
                    "decision": "Continue",
                    "confidence": 80,
                    "rationale": "Evidence reviewed.",
                    "strengths": ["setup"],
                    "warnings": [],
                    "contradictions": [],
                    "missingChecks": ["DV robustness"],
                    "urgency": "Low",
                    "nextStep": "Run DV.",
                }
                for symbol in symbols
            ]
        }, None

    monkeypatch.setattr(backend, "_inst_call_ai_trader", fake_ai)
    rows = []
    for index in range(7):
        deterministic = "Watch" if index == 0 else "Continue"
        rows.append({
            "symbol": f"T{index}",
            "decision": deterministic,
            "deterministicDecision": deterministic,
            "riskGateStatus": "REVIEW",
            "decisionBlockers": [],
            "decisionWarnings": [],
            "entryPlanFine": {},
            "fineScanFactorScores": {},
            "dataSources": {},
        })

    stats = backend._pa_apply_fine_scan_ai_reviews("user-test", rows, enabled=True)

    assert stats["reviewedSymbols"] == 7
    assert stats["status"] == "ok"
    assert all(row["aiUsed"] for row in rows)
    assert rows[0]["decision"] == "Watch"
    assert rows[0]["aiOverrideBlocked"] is True


def test_auto_fine_scan_ai_reviews_only_top_actionable_candidates(monkeypatch):
    monkeypatch.setattr(
        backend,
        "resolve_ai_config",
        lambda **_kwargs: ({"apiKey": "test", "provider": "TestAI", "model": "test-model"}, "test"),
    )
    calls = []

    def fake_ai(_config, _system_prompt, user_prompt):
        symbols_line = next(line for line in user_prompt.splitlines() if line.startswith("Symbols:"))
        symbols = [symbol for symbol in symbols_line.replace("Symbols:", "").strip().split(",") if symbol]
        calls.append(symbols)
        return {
            "reviews": [
                {
                    "symbol": symbol,
                    "decision": "Watch",
                    "confidence": 70,
                    "rationale": "Actionable evidence reviewed.",
                    "strengths": [],
                    "warnings": [],
                    "contradictions": [],
                    "missingChecks": [],
                    "urgency": "Low",
                    "nextStep": "Continue deterministic workflow.",
                }
                for symbol in symbols
            ]
        }, None

    monkeypatch.setattr(backend, "_inst_call_ai_trader", fake_ai)
    rows = [
        {
            "symbol": "CONT",
            "decision": "Continue",
            "deterministicDecision": "Continue",
            "fineScanScore": 72,
            "riskGateStatus": "REVIEW",
            "decisionBlockers": [],
            "entryPlanFine": {},
            "fineScanFactorScores": {},
            "dataSources": {},
        },
        {
            "symbol": "WATCHHI",
            "decision": "Watch",
            "deterministicDecision": "Watch",
            "fineScanScore": 85,
            "riskGateStatus": "REVIEW",
            "decisionBlockers": [],
            "entryPlanFine": {},
            "fineScanFactorScores": {},
            "dataSources": {},
        },
        {
            "symbol": "WATCHLO",
            "decision": "Watch",
            "deterministicDecision": "Watch",
            "fineScanScore": 60,
            "riskGateStatus": "REVIEW",
            "decisionBlockers": [],
            "entryPlanFine": {},
            "fineScanFactorScores": {},
            "dataSources": {},
        },
        {
            "symbol": "REJECT",
            "decision": "Reject",
            "deterministicDecision": "Reject",
            "fineScanScore": 95,
            "riskGateStatus": "BLOCK",
            "decisionBlockers": ["hard gate"],
            "entryPlanFine": {},
            "fineScanFactorScores": {},
            "dataSources": {},
        },
    ]

    stats = backend._pa_apply_fine_scan_ai_reviews(
        "user-test",
        rows,
        enabled=True,
        max_symbols=2,
        max_attempts=1,
        actionable_only=True,
    )

    assert stats["eligibleSymbols"] == 3
    assert stats["requestedSymbols"] == 2
    assert stats["skippedSymbols"] == 2
    assert stats["maxAttempts"] == 1
    assert calls == [["CONT", "WATCHHI"]]
    assert rows[2]["fineScanAiStatus"] == "capacity_skipped"
    assert rows[3]["fineScanAiStatus"] == "not_needed"
    assert rows[3]["aiCalled"] is False


def test_auto_fine_scan_ai_failure_is_non_fatal_and_not_retried(monkeypatch):
    monkeypatch.setattr(
        backend,
        "resolve_ai_config",
        lambda **_kwargs: ({"apiKey": "test", "provider": "TestAI", "model": "test-model"}, "test"),
    )
    calls = []

    def failed_ai(*_args):
        calls.append(1)
        return None, "ai_timeout"

    monkeypatch.setattr(backend, "_inst_call_ai_trader", failed_ai)
    row = {
        "symbol": "KEEP",
        "decision": "Continue",
        "deterministicDecision": "Continue",
        "fineScanScore": 80,
        "riskGateStatus": "REVIEW",
        "decisionBlockers": [],
        "entryPlanFine": {},
        "fineScanFactorScores": {},
        "dataSources": {},
    }

    stats = backend._pa_apply_fine_scan_ai_reviews(
        "user-test",
        [row],
        enabled=True,
        max_symbols=12,
        max_attempts=1,
        actionable_only=True,
    )

    assert calls == [1]
    assert stats["status"] == "error"
    assert stats["retryAttempts"] == 0
    assert row["decision"] == "Continue"
    assert row["deterministicDecision"] == "Continue"
