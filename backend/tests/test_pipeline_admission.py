from datetime import datetime, timezone
import json

import start_quant_backend as backend


def _candidate(symbol="AAPL", **updates):
    row = {
        "symbol": symbol,
        "dvDecision": "PASS_DV",
        "finalVerdict": "Confirmed",
        "riskGate": {"status": "PASS"},
        "dataQuality": "ok",
        "strategy": "moving_average",
        "validationScore": 82,
        "executionScore": 78,
        "stabilityScore": 86,
        "eventRisk": "Low",
        "sector": "Technology",
        "bestParams": {"shortPeriod": 20, "longPeriod": 50},
        "entryPlan": {"currentPrice": 100, "atr": 2},
    }
    row.update(updates)
    return row


def _fine(symbol="AAPL", **updates):
    row = {
        "symbol": symbol,
        "decision": "Continue",
        "dataQuality": "ok",
        "strategyStack": ["moving_average", "macd"],
        "bestStrategy": "moving_average",
        "executionReadinessScore": 78,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sector": "Technology",
    }
    row.update(updates)
    return row


def _market(symbol="AAPL", price=100, **updates):
    row = {
        "symbol": symbol,
        "price": price,
        "dataQuality": "ok",
        "sector": "Technology",
        "timestamp": datetime.now(timezone.utc).timestamp(),
    }
    row.update(updates)
    return row


def _account(**updates):
    state = {
        "holdingSymbols": [],
        "openBuySymbols": [],
        "positionCount": 0,
        "buyingPower": 100_000,
        "accountBlocked": False,
    }
    state.update(updates)
    return state


def test_admission_allows_fresh_consistent_candidate():
    rows, summary = backend._pa_run_admission(
        "test-user",
        [_candidate()],
        fine_results=[_fine()],
        market_results=[_market()],
        account_state=_account(),
        ai_enabled=False,
    )

    assert rows[0]["admissionDecision"] == "ADMIT"
    assert rows[0]["strategyConsistent"] is True
    assert rows[0]["signalSnapshot"]["id"]
    assert summary["counts"] == {"ADMIT": 1, "HOLD": 0, "BLOCK": 0}


def test_admission_blocks_existing_position_and_open_order():
    rows, summary = backend._pa_run_admission(
        "test-user",
        [_candidate()],
        fine_results=[_fine()],
        market_results=[_market()],
        account_state=_account(
            holdingSymbols=["AAPL"],
            openBuySymbols=["AAPL"],
            positionCount=1,
        ),
        ai_enabled=False,
    )

    assert rows[0]["admissionDecision"] == "BLOCK"
    assert "Existing position already held" in rows[0]["blockers"]
    assert "Open buy order already exists" in rows[0]["blockers"]
    assert summary["counts"]["BLOCK"] == 1


def test_admission_holds_strategy_mismatch_and_price_drift():
    rows, _ = backend._pa_run_admission(
        "test-user",
        [_candidate(strategy="rsi")],
        fine_results=[_fine(strategyStack=["moving_average", "macd"])],
        market_results=[_market(price=103)],
        account_state=_account(),
        ai_enabled=False,
    )

    assert rows[0]["admissionDecision"] == "HOLD"
    assert rows[0]["strategyConsistent"] is False
    assert rows[0]["priceDriftAtr"] == 1.5
    assert any("strategy" in warning.lower() for warning in rows[0]["warnings"])
    assert any("drifted" in warning.lower() for warning in rows[0]["warnings"])


def test_admission_arbitrates_batch_capacity_by_score():
    symbols = ["AAA", "BBB", "CCC"]
    candidates = [
        _candidate("AAA", validationScore=90, sector="Technology"),
        _candidate("BBB", validationScore=80, sector="Healthcare"),
        _candidate("CCC", validationScore=70, sector="Energy"),
    ]
    fine_rows = [_fine(symbol, sector=candidate["sector"]) for symbol, candidate in zip(symbols, candidates)]
    market_rows = [_market(symbol, sector=candidate["sector"]) for symbol, candidate in zip(symbols, candidates)]

    rows, summary = backend._pa_run_admission(
        "test-user",
        candidates,
        fine_results=fine_rows,
        market_results=market_rows,
        account_state=_account(positionCount=3),
        risk_profile="low",
        ai_enabled=False,
    )

    admitted = [row["symbol"] for row in rows if row["admissionDecision"] == "ADMIT"]
    assert admitted == ["AAA", "BBB"]
    assert summary["availablePortfolioSlots"] == 2
    assert summary["counts"]["HOLD"] == 1


def test_admission_ai_can_downgrade_but_never_promote(monkeypatch):
    rows = [
        {
            "symbol": "AAPL",
            "deterministicDecision": "ADMIT",
            "admissionDecision": "ADMIT",
            "warnings": [],
        },
        {
            "symbol": "MSFT",
            "deterministicDecision": "BLOCK",
            "admissionDecision": "BLOCK",
            "warnings": [],
        },
    ]

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "reviews": [
                                {
                                    "symbol": "AAPL",
                                    "result": "CHALLENGE",
                                    "confidence": 88,
                                    "reason": "Regime conflict",
                                    "nextCheck": "Wait for confirmation",
                                },
                                {
                                    "symbol": "MSFT",
                                    "result": "CLEAR",
                                    "confidence": 99,
                                    "reason": "Looks acceptable",
                                    "nextCheck": "None",
                                },
                            ]
                        })
                    }
                }]
            }

    monkeypatch.setattr(
        backend,
        "resolve_ai_config_for_user",
        lambda uid: ({
            "apiKey": "test",
            "provider": "DeepSeek",
            "model": "deepseek-chat",
            "baseURL": "https://example.com",
        }, "test"),
    )
    monkeypatch.setattr(backend, "ai_chat_request", lambda *args, **kwargs: FakeResponse())

    stats = backend._pa_admission_ai_challenge("test-user", rows, enabled=True)

    assert stats["reviewedSymbols"] == 2
    assert rows[0]["admissionDecision"] == "HOLD"
    assert "AI challenge" in rows[0]["warnings"][0]
    assert rows[1]["admissionDecision"] == "BLOCK"
