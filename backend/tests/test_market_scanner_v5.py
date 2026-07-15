import start_quant_backend as backend
from datetime import datetime
from zoneinfo import ZoneInfo


def _row(symbol, direction=1, cost=8, capacity=85, adv=100_000_000, volatility=25):
    return {
        "symbol": symbol,
        "companyName": symbol,
        "historyDays": 320,
        "momentum1m": 4 * direction,
        "momentum3m": 12 * direction,
        "momentum6m": 22 * direction,
        "momentum12m": 30 * direction,
        "momentum12mEx1m": 26 * direction,
        "closeVs50dma": 6 * direction,
        "closeVs200dma": 12 * direction,
        "ma50": 110 if direction > 0 else 90,
        "ma200": 100,
        "relativeStrength3m": 7 * direction,
        "relativeStrength6m": 11 * direction,
        "relativeStrength12m": 15 * direction,
        "avgDollarVolume20": adv,
        "estimatedRoundTripCostBps": cost,
        "capacityScore": capacity,
        "realizedVol20": volatility,
        "atrPercent": 2.5 if direction > 0 else 6,
        "maxDrawdown126": 10 if direction > 0 else 28,
        "volumeRatio": 1.0,
        "dataSources": {},
        "provenance": {},
    }


def test_percentile_uses_average_rank_for_ties():
    scores = backend._inst_percentile([10, 10, 20, None])

    assert scores[0] == scores[1]
    assert scores[0] == 25
    assert scores[2] == 100
    assert scores[3] == 50


def test_risk_adjusted_momentum_prefers_lower_volatility():
    low_vol = _row("LOW", volatility=20)
    high_vol = _row("HIGH", volatility=60)

    assert backend._inst_risk_adjusted_momentum(low_vol) > backend._inst_risk_adjusted_momentum(high_vol)


def test_snapshot_liquidity_proxy_uses_previous_complete_session():
    snapshot = {
        "dailyBar": {"c": 50, "v": 10_000},
        "prevDailyBar": {"c": 49, "v": 2_000_000},
        "latestTrade": {"p": 50},
        "latestQuote": {"bp": 49.99, "ap": 50.01},
    }

    metrics = backend._inst_snapshot_metrics("TEST", snapshot)

    assert metrics["snapshotCurrentDollarVolume"] == 500_000
    assert metrics["snapshotPreviousDollarVolume"] == 98_000_000
    assert metrics["snapshotLiquidityProxyDollarVolume"] == 98_000_000


def test_selection_priority_and_direction_are_separate_contracts():
    rows = [
        _row("UP", direction=1, cost=5, capacity=95, adv=200_000_000, volatility=20),
        _row("MID", direction=1, cost=12, capacity=70, adv=60_000_000, volatility=35),
        _row("DOWN", direction=-1, cost=20, capacity=50, adv=25_000_000, volatility=55),
    ]

    scored = backend._inst_score_rows(rows)

    assert all(row["scoreVersion"] == "institutional_cross_section_v5" for row in scored)
    assert all(row["trendScore"] == row["selectionScore"] for row in scored)
    assert all(row["trendScoreDetail"] == row["directionScore"] for row in scored)
    assert scored[0]["selectionScore"] > scored[2]["selectionScore"]
    assert scored[0]["trendLabel"] in {"Bullish", "Strong Bullish"}
    assert scored[2]["trendLabel"] in {"Bearish", "Strong Bearish"}


def test_liquidity_factor_includes_cost_and_capacity():
    cheap = _row("CHEAP", cost=4, capacity=95, adv=100_000_000)
    expensive = _row("EXPENSIVE", cost=80, capacity=35, adv=100_000_000)
    middle = _row("MIDDLE", cost=20, capacity=65, adv=100_000_000)

    scored = backend._inst_score_rows([cheap, expensive, middle])

    assert scored[0]["factorScores"]["liquidity"] > scored[1]["factorScores"]["liquidity"]


def test_stale_quote_cost_falls_back_to_adv_model():
    row = {
        "avgDollarVolume20": 100_000_000,
        "bidAskSpreadPct": 10,
        "latestQuoteTime": "2020-01-01T00:00:00Z",
        "realizedVol20": 30,
        "dataSources": {},
        "provenance": {},
    }

    backend._inst_apply_trading_cost_metrics(row)

    assert row["quoteStale"] is True
    assert row["spreadSource"] == "ADV liquidity estimate"
    assert row["spreadBps"] == 7
    assert row["estimatedRoundTripCostBps"] < 20


def test_optional_market_cap_filter_reports_missing_values():
    rows = [
        {"symbol": "LARGE", "marketCap": 1_000_000_000},
        {"symbol": "SMALL", "marketCap": 100_000_000},
        {"symbol": "UNKNOWN", "marketCap": None},
    ]

    kept, stats = backend._inst_apply_market_cap_filter(rows, 500_000_000)

    assert [row["symbol"] for row in kept] == ["LARGE"]
    assert stats["belowThreshold"] == 1
    assert stats["unavailable"] == 1
    assert stats["candidatePoolRefilled"] is False


def test_daily_snapshot_completion_uses_us_session_cutoff():
    eastern = ZoneInfo("America/New_York")
    bar_time = "2026-07-10T04:00:00Z"

    assert backend._inst_daily_snapshot_is_complete(
        bar_time, datetime(2026, 7, 10, 12, 0, tzinfo=eastern)
    ) is False
    assert backend._inst_daily_snapshot_is_complete(
        bar_time, datetime(2026, 7, 10, 17, 0, tzinfo=eastern)
    ) is True
    assert backend._inst_daily_snapshot_is_complete(
        bar_time, datetime(2026, 7, 11, 10, 0, tzinfo=eastern)
    ) is True


def test_symbol_metrics_compare_completed_session_volume(monkeypatch):
    monkeypatch.setattr(backend, "_inst_daily_snapshot_is_complete", lambda _value: False)
    bars = [
        {
            "t": "2026-06-%02dT04:00:00Z" % (index + 1),
            "c": 100,
            "h": 101,
            "l": 99,
            "v": 1_000_000,
        }
        for index in range(20)
    ]
    bars.append({
        "t": "2026-07-10T04:00:00Z",
        "c": 100,
        "h": 101,
        "l": 99,
        "v": 100_000,
    })
    snapshot = {
        "snapshotPrice": 100,
        "snapshotPrevClose": 99,
        "snapshotVolume": 100_000,
        "snapshotCurrentVolume": 100_000,
        "snapshotPreviousVolume": 2_000_000,
        "dayBarTime": "2026-07-10T04:00:00Z",
    }

    metrics = backend._inst_compute_symbol_metrics("TEST", bars, {"name": "Test"}, snapshot)

    assert metrics["avgVolume20"] == 1_000_000
    assert metrics["volumeRatio"] == 2.0
    assert metrics["intradayVolumeRatioRaw"] == 0.1
    assert metrics["volumeRatioSource"] == "previous completed session"


def test_finra_daily_short_volume_is_not_labeled_as_short_interest(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_inst_fetch_finra_latest_short_volume",
        lambda _symbols: ({
            "TEST": {
                "shortVolumeRatio": 72.5,
                "shortVolumeDate": "2026-07-10",
                "shortVolumeSource": "FINRA",
            }
        }, {"source": "FINRA", "symbolsWithShortVolume": 1, "date": "2026-07-10", "error": None}),
    )
    rows = [{"symbol": "TEST", "dataSources": {}, "provenance": {}}]

    backend._inst_apply_finra_short_volume(rows)

    assert rows[0]["shortVolumeContext"] == "Daily short-sale flow only"
    assert rows[0]["shortVolumeIsShortInterest"] is False
    assert rows[0]["crowdingRisk"] is None


def test_market_ai_batches_cover_every_requested_candidate(monkeypatch):
    monkeypatch.setattr(
        backend,
        "resolve_ai_config",
        lambda **_kwargs: ({"apiKey": "test", "provider": "TestAI", "model": "test-model"}, "test"),
    )

    def fake_ai(_config, _system_prompt, user_prompt):
        marker = "Batch symbols:"
        symbols_line = next(line for line in user_prompt.splitlines() if line.startswith(marker))
        symbols = [symbol for symbol in symbols_line.replace(marker, "").strip().split(",") if symbol]
        return {"reviews": [{
            "symbol": symbol,
            "decision": "Advance",
            "confidence": 80,
            "rationale": "Evidence supports Fine Scan review.",
            "riskFlags": [],
            "contradictions": [],
            "missingChecks": ["Fine Scan execution"],
            "urgency": "Low",
            "nextStep": "Run Fine Scan.",
        } for symbol in symbols]}, None

    monkeypatch.setattr(backend, "_inst_call_ai_trader", fake_ai)
    rows = [_row("T%02d" % index) for index in range(12)]

    stats = backend._inst_apply_ai_trader_review(rows, max_symbols=12)

    assert stats["requestedSymbols"] == 12
    assert stats["reviewedSymbols"] == 12
    assert stats["status"] == "ok"
    assert all(row["aiSuccess"] for row in rows)
