"""Hourly ranking must not discard an independently valid confirming strike."""

import copy
from datetime import datetime, timedelta, timezone

import pytest

import kalshi_api
from kalshi_api import (
    _PaperRobotController,
    _hourly_candidate_diagnostic,
    _hourly_confirmation_continuation_ticker,
)


EVENT = "KXBTCD-26OCT0910"
PENDING = f"{EVENT}-T81899.99"
SIBLING = f"{EVENT}-T81999.99"
NOW = datetime(2026, 10, 9, 13, 42, 54, tzinfo=timezone.utc)
CONFIG = {"entryConfirmationSnapshots": 2, "entryConfirmationMaxGapSeconds": 25}


def _state():
    return {
        "enabled": True,
        "activeEnvironment": "paper",
        "config": {"executionMode": "paper", **CONFIG},
        "strategy": {"entryConfirmations": {"btchourly": {
            "ticker": PENDING,
            "side": "NO",
            "generatedAt": (NOW - timedelta(seconds=17.28)).isoformat(),
            "streak": 1,
            "requiredSnapshots": 2,
            "confirmed": False,
            "dataQualityEligible": True,
        }}},
        "decisions": [],
        "tradedTickers": [],
        "filledTrades": [],
    }


def _candidate(ticker, score):
    market = {
        "ticker": ticker, "event_ticker": EVENT,
        "floor_strike": float(ticker.rsplit("-T", 1)[1]),
        "status": "active", "close_time": "2026-10-09T14:00:00Z",
    }
    book = {"yes": [["0.29", "100"]], "no": [["0.69", "100"]]}
    return ({
        "generatedAt": NOW.isoformat(),
        "action": "BUY_NO", "side": "NO", "blockingReasons": [],
        "model": {"uncertainty": 0.03, "fairYesProbability": 0.10},
        "market": {**market, "secondsToClose": 1026, "noAskDepth": 100},
        "edge": {
            "price": 0.71, "netEdge": score + 0.02,
            "conservativeEdge": score, "effectiveMinimumConservativeEdge": 0.015,
        },
        "sizing": {"contracts": 1, "contractsFp": 1, "plannedContractsFp": 1},
        "gates": [], "config": {"executionMode": "paper"},
    }, market, book)


def _diagnostics(candidates):
    return {market["ticker"]: _hourly_candidate_diagnostic(candidate, market, len(candidates))
            for candidate, market, _ in candidates}


def test_pending_strike_can_confirm_despite_higher_scoring_sibling():
    candidates = [_candidate(PENDING, 0.05), _candidate(SIBLING, 0.08)]
    diagnostics = _diagnostics(candidates)
    assert diagnostics[SIBLING]["shrunkenScore"] > diagnostics[PENDING]["shrunkenScore"]
    assert _hourly_confirmation_continuation_ticker(
        candidates, diagnostics, _state(), CONFIG, EVENT,
    ) == PENDING


@pytest.mark.parametrize("defect", [
    "expired", "duplicate_time", "future_cursor", "side_changed", "engine_wait",
    "penalty_failed", "different_event", "previous_invalid", "current_blocker",
    "missing_clock", "already_confirmed", "missing_cursor", "stale_data",
    "intervening_invalid_frame",
])
def test_continuity_never_revives_disqualified_pending_signal(defect):
    state = _state()
    candidates = [_candidate(PENDING, 0.05), _candidate(SIBLING, 0.08)]
    candidate = candidates[0][0]
    cursor = state["strategy"]["entryConfirmations"]["btchourly"]
    warnings = []
    event = EVENT
    if defect == "expired":
        cursor["generatedAt"] = (NOW - timedelta(seconds=25.01)).isoformat()
    elif defect == "duplicate_time":
        cursor["generatedAt"] = NOW.isoformat()
    elif defect == "future_cursor":
        cursor["generatedAt"] = (NOW + timedelta(seconds=1)).isoformat()
    elif defect == "side_changed":
        candidate.update(action="BUY_YES", side="YES")
    elif defect == "engine_wait":
        candidate["action"] = "WAIT"
    elif defect == "penalty_failed":
        candidate["edge"]["conservativeEdge"] = 0.016
    elif defect == "different_event":
        event = "KXBTCD-26OCT0911"
    elif defect == "previous_invalid":
        cursor["dataQualityEligible"] = False
    elif defect == "current_blocker":
        candidate["blockingReasons"] = ["position_size"]
    elif defect == "missing_clock":
        candidate.pop("generatedAt")
    elif defect == "already_confirmed":
        cursor["confirmed"] = True
    elif defect == "missing_cursor":
        state["strategy"]["entryConfirmations"] = {}
    elif defect == "stale_data":
        warnings = ["hourly_orderbooks_stale"]
    elif defect == "intervening_invalid_frame":
        state["decisions"] = [{
            "ticker": PENDING, "side": "NO",
            "generatedAt": (NOW - timedelta(seconds=5)).isoformat(),
            "blockingReasons": ["data_freshness"],
        }]
    assert _hourly_confirmation_continuation_ticker(
        candidates, _diagnostics(candidates), state, CONFIG, event, warnings=warnings,
    ) is None


@pytest.mark.parametrize("held", [False, True])
def test_tick_prefers_valid_continuation_but_held_management_has_priority(monkeypatch, held):
    candidates = [_candidate(PENDING, 0.05), _candidate(SIBLING, 0.08)]
    state = _state()

    class State:
        def get(self, *_args, **_kwargs):
            return copy.deepcopy(state)

    class Client:
        def hourly_snapshot(self, **_kwargs):
            return {
                "eventTicker": EVENT,
                "markets": [market for _, market, _ in candidates],
                "orderbooks": {market["ticker"]: book for _, market, book in candidates},
                "ladderFit": {},
                "reference": {"price": 81950, "rawPrice": 81950, "candles": [],
                              "timestamp": NOW.isoformat(), "isOfficialBrti": True},
                "referencePolicy": {"selectedPrice": 81950, "selectedSource": "raw_price"},
                "orderbookAsOf": NOW.isoformat(), "warnings": [],
            }

    decisions = {market["ticker"]: decision for decision, market, _ in candidates}
    monkeypatch.setattr(kalshi_api, "evaluate_btc15_contract", lambda market, **_: copy.deepcopy(decisions[market["ticker"]]))
    controller = _PaperRobotController(Client(), State(), None)
    monkeypatch.setattr(controller, "portfolio", lambda *_args, **_kwargs: {
        "environment": "paper", "balance": {"balance": 100_000, "portfolio_value": 0},
        "positions": ([{
            "ticker": SIBLING, "event_ticker": EVENT, "position_fp": -1,
            "no_count_fp": 1, "market_exposure_dollars": 0.71,
        }] if held else []),
        "orders": [], "fills": [], "settlements": [],
    })

    result = controller.tick("user-1", submit_order=False, mode="paper", family="btchourly")

    diagnostics = result["decision"]["candidateDiagnostics"]
    assert result["snapshot"]["market"]["ticker"] == (SIBLING if held else PENDING)
    assert diagnostics["selectionReason"] == (
        "held_position_management" if held else "pending_confirmation_continuity"
    )
    if not held:
        assert diagnostics["selectedRank"] == 2
        assert result["decision"]["entryConfirmation"]["confirmed"] is True
    assert result["orderSubmitted"] is False
