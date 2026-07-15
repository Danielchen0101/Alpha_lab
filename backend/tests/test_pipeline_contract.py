import start_quant_backend as backend


def test_pipeline_contract_has_one_seven_stage_chain():
    assert [key for key, _ in backend._PA_PIPELINE_STAGES] == [
        "market_scanner",
        "fine_scan",
        "deeper_validation",
        "admission",
        "entry_plan",
        "execution",
        "exit_scan",
    ]
    assert backend._PA_PIPELINE_TOTAL_STEPS == 7


def test_execution_authority_remains_deterministic():
    authority = backend._PA_AI_AUTHORITY["execution"]

    assert authority["role"] == "deterministic_only"
    assert any("bypass" in rule for rule in authority["mayNot"])


def test_pipeline_result_exposes_backend_execution_owner():
    plan = {
        "symbol": "AAPL",
        "finalAction": "BUY_READY",
        "executionHandledByBackend": True,
        "pipelineRunId": "run-1",
    }
    execution = {
        "symbol": "AAPL",
        "action": "ORDER_SUBMITTED",
        "orderId": "order-1",
    }
    dump = backend._pa_build_pipeline_debug_dump(
        "user-1",
        "run-1",
        "manual",
        "ai",
        "medium",
        "mid",
        "paper",
        {"errors": 0, "orders_submitted": 1},
        {
            "market_results": [],
            "continue_candidates": [],
            "fine_results": [],
            "validation_results": [],
            "admission_results": [],
            "entry_plans": [plan],
            "execution_results": [execution],
            "exit_results": {},
        },
    )

    assert dump["pipelineStages"][3]["key"] == "admission"
    assert dump["entry_plan"]["results"][0]["executionHandledByBackend"] is True
    assert dump["execution"]["submittedCount"] == 1
    assert dump["execution"]["results"][0]["orderId"] == "order-1"


def test_headless_pipeline_reuses_institutional_whole_market_scanner(monkeypatch):
    captured = {}

    def fake_call(uid, path, view_func, payload=None, method="POST", query_string=None):
        captured.update({
            "uid": uid,
            "path": path,
            "view_func": view_func,
            "payload": payload,
            "method": method,
        })
        return {
            "success": True,
            "results": [{"symbol": "AAPL", "overallScore": 88}],
            "summary": {
                "universeScanned": 1500,
                "resultsCount": 1,
                "aiReviewedCount": 1,
            },
            "scan_stats": {
                "total_symbols": 1500,
                "method": "alpaca_whole_market_scan_v5_risk_adjusted_cross_section",
            },
        }, 200

    monkeypatch.setattr(backend, "_pa_call_endpoint", fake_call)

    rows, summary, stats = backend._pa_market_scanner_headless("user-1", trade_mode="real")

    assert captured["path"] == "/api/market/scanner"
    assert captured["view_func"] is backend.institutional_market_scanner
    assert captured["payload"]["maxSymbols"] == 1500
    assert captured["payload"]["maxResults"] == 100
    assert captured["payload"]["aiReviewTopN"] == 100
    assert captured["payload"]["alpacaMode"] == "live"
    assert captured["payload"]["suppressDiscord"] is True
    assert rows[0]["symbol"] == "AAPL"
    assert summary["universeScanned"] == 1500
    assert stats["total_symbols"] == 1500


def test_headless_pipeline_stops_when_institutional_scanner_fails(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_call_endpoint",
        lambda *args, **kwargs: ({"success": False, "message": "Alpaca unavailable"}, 503),
    )

    try:
        backend._pa_market_scanner_headless("user-1")
    except RuntimeError as exc:
        assert "Alpaca unavailable" in str(exc)
    else:
        raise AssertionError("scanner failure must stop the pipeline instead of using fake data")
