import kalshi_api

import copy
from datetime import datetime, timedelta, timezone

from flask import Flask

from kalshi_api import (
    _PaperRobotController,
    _account_equity_cents,
    _brti_proxy,
    _live_order_payload,
    _live_position_direction,
    _normalise_live_fill,
    _normalise_live_order,
    _normalise_live_settlement,
    _open_live_fill_inventory,
    _reconcile_live_exit_fills,
    _estimate_reduce_only_sale,
    _exit_economic_state,
    _intent_client_order_id,
    _market_observation,
    _monotone_ladder_probabilities,
    _paper_order_payload,
    _position_execution_context,
    _position_side_and_count,
    _portfolio_analytics_after_reset,
    _protective_exit_state,
    _recent_filled_entry_age,
    _recent_filled_exit_age,
    _venue_quote,
    _PublicDataClient,
    register_kalshi_api,
)


def test_portfolio_display_baseline_filters_only_the_visible_projection():
    lifetime = {
        "realizedTradeRecords": [
            {
                "key": "new",
                "ticker": "KXBTCD-NEW",
                "settledAt": "2026-07-25T12:01:00Z",
                "pnl": -1.25,
                "exitType": "sale",
                "environment": "paper",
            },
            {
                "key": "old",
                "ticker": "KXBTC15M-OLD",
                "settledAt": "2026-07-25T11:59:00Z",
                "pnl": 4.0,
                "exitType": "settlement",
                "environment": "paper",
            },
        ],
        "settlementRecords": [],
        "closedTradeRecords": [],
    }

    visible = _portfolio_analytics_after_reset(
        lifetime,
        {
            "resetAt": "2026-07-25T12:00:00Z",
            "baselineEquityCents": 1_000_000,
            "ledgerPreserved": True,
        },
    )

    assert [row["key"] for row in visible["realizedTradeRecords"]] == ["new"]
    assert visible["realizedSamples"] == 1
    assert visible["realizedTotalPnl"] == -1.25
    assert visible["equityCurve"][0]["displayBaseline"] is True
    assert visible["equityCurve"][0]["cumulativePnl"] == 0
    assert visible["equityCurve"][-1]["cumulativePnl"] == -1.25
    assert visible["marketPerformance"]["btc15m"]["samples"] == 0
    assert visible["marketPerformance"]["btchourly"]["samples"] == 1
    assert visible["lifetime"] == {"realizedSamples": 2, "realizedTotalPnl": 2.75}
    assert visible["displayBaseline"]["archivedRealizedEvents"] == 1


def test_brti_proxy_uses_crossed_safe_robust_constituent_midpoints():
    quotes = [
        _venue_quote("coinbase", {"bid": "9999", "ask": "10001", "price": "10000"}),
        _venue_quote("bitstamp", {"bid": "10000", "ask": "10002", "last": "10001"}),
        _venue_quote("gemini", {"bid": "10999", "ask": "11001", "last": "11000"}),
    ]

    result = _brti_proxy(quotes)

    assert result["price"] == 10000.5
    assert result["venueCount"] == 2
    assert result["rejectedVenues"] == ["gemini"]


def test_hourly_strike_ladder_fit_is_monotone_by_strike():
    markets = [
        {"ticker": "LOW", "floor_strike": 64_000},
        {"ticker": "MID", "floor_strike": 65_000},
        {"ticker": "HIGH", "floor_strike": 66_000},
    ]
    books = {
        "LOW": {"yes": [["0.39", "100"]], "no": [["0.59", "100"]]},
        "MID": {"yes": [["0.59", "100"]], "no": [["0.39", "100"]]},
        "HIGH": {"yes": [["0.29", "100"]], "no": [["0.69", "100"]]},
    }

    fitted = _monotone_ladder_probabilities(markets, books)
    probabilities = [fitted[ticker]["smoothedProbability"] for ticker in ("LOW", "MID", "HIGH")]

    assert probabilities[0] >= probabilities[1] >= probabilities[2]
    assert probabilities[0] == probabilities[1] == 0.5


def test_hourly_snapshot_fetches_strike_books_in_one_batch():
    now = datetime.now(timezone.utc)
    calls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        params = dict(params or {})
        calls.append((url, params))
        if url.endswith("/markets") and params.get("series_ticker") == "KXBTC15M":
            return _Response({"markets": [{
                "ticker": "KXBTC15M-TEST",
                "status": "active",
                "open_time": (now - timedelta(minutes=3)).isoformat(),
                "close_time": (now + timedelta(minutes=12)).isoformat(),
                "floor_strike": 65_000,
            }]})
        if url.endswith("/markets") and params.get("series_ticker") == "KXBTCD":
            return _Response({"markets": [
                {
                    "ticker": "KXBTCD-E-T64000", "event_ticker": "KXBTCD-E",
                    "status": "active", "open_time": (now - timedelta(minutes=30)).isoformat(),
                    "close_time": (now + timedelta(minutes=30)).isoformat(),
                    "floor_strike": 64_000, "yes_bid_dollars": "0.70", "yes_ask_dollars": "0.72",
                },
                {
                    "ticker": "KXBTCD-E-T65000", "event_ticker": "KXBTCD-E",
                    "status": "active", "open_time": (now - timedelta(minutes=30)).isoformat(),
                    "close_time": (now + timedelta(minutes=30)).isoformat(),
                    "floor_strike": 65_000, "yes_bid_dollars": "0.49", "yes_ask_dollars": "0.51",
                },
            ]})
        if url.endswith("/markets/orderbooks"):
            return _Response({"orderbooks": [
                {"ticker": ticker, "orderbook_fp": {
                    "yes_dollars": [["0.49", "100"]],
                    "no_dollars": [["0.49", "100"]],
                }} for ticker in params.get("tickers", [])
            ]})
        if url.endswith("/orderbook"):
            return _Response({"orderbook_fp": {
                "yes_dollars": [["0.49", "100"]],
                "no_dollars": [["0.49", "100"]],
            }})
        if url.endswith("/candles"):
            return _Response([[index, 65_000, 65_001, 65_000, 65_000, 10] for index in range(90)])
        raise AssertionError((url, params))

    snapshot = _PublicDataClient(http_get=fake_get).hourly_snapshot(
        now=now,
        reference_override={
            "price": 65_000,
            "timestamp": now.isoformat(),
            "model": "kalshi_cf_benchmarks_brti",
            "isOfficialBrti": True,
            "venueCount": 1,
        },
    )

    batch_calls = [call for call in calls if call[0].endswith("/markets/orderbooks")]
    assert len(batch_calls) == 1
    assert set(batch_calls[0][1]["tickers"]) == {"KXBTCD-E-T64000", "KXBTCD-E-T65000"}
    assert len(snapshot["markets"]) == 2
    assert len(snapshot["ladderFit"]) == 2


def test_venue_quote_rejects_empty_or_crossed_without_last():
    assert _venue_quote("coinbase", {"bid": "101", "ask": "100"}) is None


class _Response:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def _fake_get(url, params=None, headers=None, timeout=None):
    now = datetime.now(timezone.utc)
    if url.endswith("/markets"):
        return _Response({"markets": [{
            "ticker": "KXBTC15M-TEST-00",
            "status": "active",
            "title": "BTC price up in next 15 mins?",
            "open_time": (now - timedelta(minutes=4)).isoformat(),
            "close_time": (now + timedelta(minutes=11)).isoformat(),
            "floor_strike": 64_000.0,
            "yes_bid_dollars": "0.4900",
            "yes_ask_dollars": "0.5000",
            "no_bid_dollars": "0.5000",
            "no_ask_dollars": "0.5100",
            "yes_bid_size_fp": "100.0",
            "yes_ask_size_fp": "100.0",
            "volume_fp": "1000.0",
            "open_interest_fp": "500.0",
        }]})
    if url.endswith("/orderbook"):
        return _Response({"orderbook_fp": {"yes_dollars": [["0.49", "100"]], "no_dollars": [["0.50", "100"]]}})
    if url.endswith("/ticker"):
        return _Response({"price": "64600", "bid": "64599", "ask": "64601", "time": now.isoformat()})
    if url.endswith("/candles"):
        return _Response([[index, 64_000, 64_000, 64_000, 64_000 + index, 10] for index in range(90)])
    raise AssertionError(url)


def test_live_fill_uses_current_fixed_point_dollar_fields():
    fill = _normalise_live_fill({
        "fill_id": "fill-1",
        "ticker": "KXBTC15M-TEST-00",
        "side": "yes",
        "count_fp": "12.50",
        "yes_price_dollars": "0.4300",
        "fee_cost": "0.5600",
    })

    assert fill["outcome_side"] == "YES"
    assert fill["count_fp"] == 12.5
    assert fill["price_dollars"] == 0.43
    assert fill["fee_cost_dollars"] == 0.56


def test_account_equity_uses_mode_specific_balance_semantics():
    balance = {"balance": 80_000, "portfolio_value": 100_000}

    assert _account_equity_cents(balance, "real") == 100_000
    assert _account_equity_cents(balance, "paper") == 180_000
    assert _account_equity_cents({"balance": 80_000}, "real") == 80_000


def test_live_position_direction_never_labels_flat_exposure_as_yes():
    assert _live_position_direction(0, 0, 0) == (None, 0.0)
    assert _live_position_direction(0, 7, 7) == (None, 0.0)
    assert _live_position_direction(3, 0, 0) == ("YES", 3.0)
    assert _live_position_direction(-4, 0, 0) == ("NO", 4.0)
    assert _live_position_direction(0, 2, 5) == ("NO", 3.0)


def test_real_tick_with_zero_cash_fails_closed_without_routing(monkeypatch):
    class State:
        def get(self, _user_id, *, environment=None):
            return {
                "enabled": True,
                "config": {"executionMode": environment or "real"},
                "strategy": {},
                "tradedTickers": [],
            }

        def record(self, _user_id, decision, order):
            return {"decision": decision, "order": order}

    class Client:
        def snapshot(self, *, base_url):
            return {
                "market": {"ticker": "KXBTC15M-TEST-00"},
                "reference": {"price": 65_000, "candles": [], "timestamp": "2026-07-22T12:00:00Z"},
                "orderbook": {},
                "orderbookAsOf": "2026-07-22T12:00:00Z",
            }

    decision = {
        "action": "BUY_YES",
        "side": "YES",
        "model": {"fairYesProbability": 0.65},
        "edge": {"price": 0.50},
        "sizing": {"contracts": 5, "notional": 2.5},
        "gates": [],
        "blockingReasons": [],
        "config": {"executionMode": "real"},
    }
    monkeypatch.setattr(kalshi_api, "evaluate_btc15_contract", lambda *args, **kwargs: decision)
    controller = _PaperRobotController(Client(), State(), paper_accounts=None)
    monkeypatch.setattr(
        controller,
        "portfolio",
        lambda _user_id, *, mode: {
            "balance": {"balance": 0, "portfolio_value": 0},
            "positions": [],
            "orders": [],
            "fills": [],
        },
    )

    result = controller.tick("user-1", submit_order=True, mode="real")

    assert result["orderSubmitted"] is False
    assert result["decision"]["action"] == "WAIT"
    assert result["decision"]["executionIntent"] == "WAIT_REAL_NO_CASH"
    assert "real_cash_unavailable" in result["decision"]["blockingReasons"]
    assert result["decision"]["sizing"]["contracts"] == 0


def test_same_side_signal_becomes_add_on_without_a_trade_count_gate(monkeypatch):
    class State:
        def get(self, _user_id, *, environment=None):
            return {
                "enabled": True,
                "config": {
                    "executionMode": environment or "paper",
                    "minimumAddIntervalSeconds": 30,
                    "addMinModelProbability": 0.67,
                    "addMinConservativeEdge": 0.01,
                },
                "strategy": {},
                "tradedTickers": ["KXBTC15M-TEST-00"],
            }

        def record(self, _user_id, decision, order):
            return {"decisions": [decision]}

    class Client:
        def snapshot(self, *, base_url):
            return {
                "market": {"ticker": "KXBTC15M-TEST-00"},
                "reference": {"price": 65_000, "candles": [], "timestamp": "2026-07-25T12:00:00Z"},
                "orderbook": {"yes": [["0.60", "100"]], "no": [["0.38", "100"]]},
                "orderbookAsOf": "2026-07-25T12:00:00Z",
            }

    decision = {
        "generatedAt": "2026-07-25T12:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "model": {"fairYesProbability": 0.74},
        "edge": {
            "price": 0.62,
            "modelProbability": 0.74,
            "conservativeEdge": 0.03,
        },
        "sizing": {"contracts": 3},
        "gates": [],
        "blockingReasons": [],
        "config": {"executionMode": "paper"},
    }
    monkeypatch.setattr(
        kalshi_api,
        "evaluate_btc15_contract",
        lambda *args, **kwargs: decision,
    )
    controller = _PaperRobotController(Client(), State(), paper_accounts=None)
    monkeypatch.setattr(
        controller,
        "portfolio",
        lambda _user_id, *, mode: {
            "balance": {"balance": 99_000, "portfolio_value": 300},
            "positions": [{
                "ticker": "KXBTC15M-TEST-00",
                "yes_count_fp": 5,
                "no_count_fp": 0,
                "yes_average_price_dollars": 0.55,
                "market_exposure_dollars": 2.75,
                "last_trade_at": "2020-01-01T00:00:00Z",
            }],
            "orders": [],
            "fills": [],
            "settlements": [],
        },
    )

    result = controller.tick("user-1", submit_order=False, mode="paper")

    assert result["decision"]["action"] == "BUY_YES"
    assert result["decision"]["executionIntent"] == "ADD_YES"
    assert result["decision"]["positionManagement"]["existingContracts"] == 5
    assert "market_flat" not in result["decision"]["blockingReasons"]


def test_live_exit_fill_reconciliation_uses_fifo_cost_and_both_fees():
    rows = _reconcile_live_exit_fills([
        {
            "fill_id": "buy-1", "ticker": "KXBTC15M-TEST-00",
            "outcome_side": "NO", "action": "buy", "count_fp": 4,
            "average_price_dollars": 0.30, "fee_cost_dollars": 0.04,
            "created_time": "2026-07-22T12:00:00Z",
        },
        {
            "fill_id": "buy-2", "ticker": "KXBTC15M-TEST-00",
            "outcome_side": "NO", "action": "buy", "count_fp": 6,
            "average_price_dollars": 0.40, "fee_cost_dollars": 0.06,
            "created_time": "2026-07-22T12:01:00Z",
        },
        {
            "fill_id": "sell-1", "ticker": "KXBTC15M-TEST-00",
            "outcome_side": "NO", "action": "sell", "count_fp": 5,
            "average_price_dollars": 0.55, "fee_cost_dollars": 0.05,
            "created_time": "2026-07-22T12:02:00Z",
        },
    ])

    sale = rows[-1]
    assert sale["reduce_only"] is True
    assert sale["position_cost_dollars"] == 1.6
    assert sale["entry_fee_allocated_dollars"] == 0.05
    assert sale["gross_proceeds_dollars"] == 2.75
    assert sale["realized_pnl_dollars"] == 1.05


def test_live_exit_fill_reconciliation_skips_unknown_cost_basis():
    rows = _reconcile_live_exit_fills([{
        "fill_id": "sell-only", "ticker": "KXBTC15M-TEST-00",
        "outcome_side": "YES", "action": "sell", "count_fp": 3,
        "average_price_dollars": 0.60, "fee_cost_dollars": 0.03,
        "created_time": "2026-07-22T12:02:00Z",
    }])

    assert "realized_pnl_dollars" not in rows[0]


def test_trade_intent_id_is_stable_for_retries_and_rotates_by_window():
    first = _intent_client_order_id("u", "real", "T", "BUY_YES", "YES", 0, now_epoch=100)
    retry = _intent_client_order_id("u", "real", "T", "BUY_YES", "YES", 0, now_epoch=109)
    later = _intent_client_order_id("u", "real", "T", "BUY_YES", "YES", 0, now_epoch=110)
    changed_position = _intent_client_order_id("u", "real", "T", "BUY_YES", "YES", 2, now_epoch=100)

    assert retry == first
    assert later != first
    assert changed_position != first


def test_market_observation_uses_a_stable_15_second_bucket():
    decision = {
        "generatedAt": "2026-07-25T12:00:14Z",
        "action": "BUY_YES",
        "side": "YES",
        "executionIntent": "ADD_YES",
        "signalQuality": 78,
        "blockingReasons": [],
        "market": {
            "ticker": "KXBTC15M-TEST",
            "secondsToClose": 140,
            "spread": 0.02,
        },
        "model": {
            "modelYesProbability": 0.72,
            "fairYesProbability": 0.69,
        },
        "edge": {
            "price": 0.62,
            "netEdge": 0.04,
            "conservativeEdge": 0.02,
        },
    }

    first = _market_observation("paper", decision)
    second = _market_observation(
        "paper",
        {**decision, "generatedAt": "2026-07-25T12:00:01Z"},
    )

    assert first["observation_key"] == second["observation_key"]
    assert first["execution_intent"] == "ADD_YES"
    assert first["environment"] == "paper"


def test_live_settlement_keeps_dollars_and_converts_cent_revenue():
    settlement = _normalise_live_settlement({
        "ticker": "KXBTC15M-TEST-00",
        "market_result": "yes",
        "yes_count_fp": "12.50",
        "yes_total_cost_dollars": "12.3400",
        "revenue": 1500,
        "fee_cost": "0.6600",
    })

    assert settlement["market_result"] == "YES"
    assert settlement["yes_count_fp"] == 12.5
    assert settlement["yes_total_cost_dollars"] == 12.34
    assert settlement["revenue_dollars"] == 15.0
    assert settlement["fee_cost_dollars"] == 0.66


def _app(tmp_path, *, auth=True):
    app = Flask(__name__)
    register_kalshi_api(
        app,
        require_auth=(lambda: {"id": "user-1"}) if auth else (lambda: None),
        http_get=_fake_get,
        robot_state_path=str(tmp_path / "state.json"),
        paper_account_path=str(tmp_path / "paper.json"),
    )
    return app


def test_snapshot_uses_production_public_data_and_is_paper_only(tmp_path):
    payload = _app(tmp_path).test_client().get("/api/kalshi/btc-15m/snapshot").get_json()
    assert payload["success"] is True
    assert payload["decision"]["paperOnly"] is True
    assert payload["decision"]["executionEnvironment"] == "alphalab_paper"
    assert payload["decision"]["methodology"]["orderPolicy"].startswith("AlphaLab Paper")


def test_paper_account_is_available_without_personal_credentials(tmp_path):
    client = _app(tmp_path).test_client()
    response = client.get("/api/kalshi/paper/portfolio")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["portfolio"]["environment"] == "paper"
    assert payload["portfolio"]["accountProvider"] == "AlphaLab"
    assert payload["portfolio"]["balance"]["balance"] == 1_000_000
    assert payload["portfolio"]["fills"] == []


def test_display_reset_preserves_the_complete_paper_ledger(tmp_path):
    display_store = {}

    def load_display(user_id):
        return copy.deepcopy(display_store.get(user_id))

    def save_display(user_id, payload):
        display_store[user_id] = copy.deepcopy(dict(payload))
        return copy.deepcopy(display_store[user_id])

    app = Flask(__name__)
    controls = register_kalshi_api(
        app,
        require_auth=lambda: {"id": "user-1"},
        http_get=_fake_get,
        robot_state_path=str(tmp_path / "state.json"),
        paper_account_path=str(tmp_path / "paper.json"),
        portfolio_display_loader=load_display,
        portfolio_display_saver=save_display,
    )
    controls["paper_accounts"].submit_taker(
        "user-1",
        ticker="KXBTC15M-TEST-00",
        side="YES",
        price=0.55,
        contracts=3,
        available_depth=0,
        client_order_id="preserved-order",
    )
    before = controls["paper_accounts"].portfolio("user-1")

    response = app.test_client().post(
        "/api/kalshi/portfolio/display-reset",
        json={"mode": "paper"},
    )
    payload = response.get_json()
    after = controls["paper_accounts"].portfolio("user-1")

    assert response.status_code == 200
    assert payload["success"] is True
    assert payload["portfolio"]["analytics"]["displayBaseline"]["active"] is True
    assert payload["portfolio"]["analytics"]["displayBaseline"]["ledgerPreserved"] is True
    assert len(before["orders"]) == len(after["orders"]) == 1
    assert before["orders"][0]["client_order_id"] == after["orders"][0]["client_order_id"]
    assert before["balance"] == after["balance"]
    assert display_store["user-1"]["modes"]["paper"]["baselineEquityCents"] == 1_000_000


def test_config_exposes_builtin_paper_and_production_only_environment(tmp_path):
    app = Flask(__name__)
    register_kalshi_api(
        app,
        require_auth=lambda: {"id": "user-1"},
        http_get=_fake_get,
        get_user_config=lambda *_: {},
        save_user_config=lambda *_: (True, None),
        robot_state_path=str(tmp_path / "state.json"),
        paper_account_path=str(tmp_path / "paper.json"),
    )
    payload = app.test_client().get("/api/kalshi/config").get_json()
    assert payload["activeEnvironment"] == "paper"
    assert payload["paper"]["builtIn"] is True
    assert payload["paper"]["startingBalance"] == 10_000.0
    assert payload["paper"]["startingBalanceCents"] == 1_000_000
    assert set(payload["environments"]) == {"production"}


def test_missing_auth_returns_stable_401(tmp_path):
    response = _app(tmp_path, auth=False).test_client().get("/api/kalshi/status")
    assert response.status_code == 401
    assert response.get_json()["code"] == "authentication_required"


def test_status_has_no_removed_ai_learning_surface(tmp_path):
    payload = _app(tmp_path).test_client().get("/api/kalshi/status").get_json()

    assert "ai" not in payload


def test_analytics_exposes_per_family_opportunity_funnels(tmp_path):
    rows = [
        {
            "ticker": "KXBTC15M-TEST-00",
            "environment": "paper",
            "observed_at": "2026-07-25T12:00:00Z",
            "action": "WAIT",
            "side": "YES",
            "seconds_to_close": 300,
            "net_edge": 0.02,
            "conservative_edge": 0.01,
            "blocked_reasons": ["depth"],
            "features": {
                "model": {
                    "referenceModel": "kalshi_cf_benchmarks_brti",
                    "isOfficialBrti": True,
                },
                "dataQuality": {"snapshotLatencyMs": 210},
            },
        },
        {
            "ticker": "KXBTCD-26JUL2515-T65000",
            "environment": "paper",
            "observed_at": "2026-07-25T12:00:01Z",
            "action": "BUY_NO",
            "side": "NO",
            "seconds_to_close": 600,
            "net_edge": 0.03,
            "conservative_edge": 0.012,
            "blocked_reasons": [],
            "order_result": {"status": "filled"},
            "features": {
                "model": {"referenceModel": "kalshi_cf_benchmarks_brti"},
                "dataQuality": {"snapshotLatencyMs": 400},
            },
        },
    ]
    app = Flask(__name__)
    register_kalshi_api(
        app,
        require_auth=lambda: {"id": "user-1"},
        http_get=_fake_get,
        observation_loader=lambda *_args, **_kwargs: rows,
        robot_state_path=str(tmp_path / "state.json"),
        paper_account_path=str(tmp_path / "paper.json"),
    )

    response = app.test_client().get("/api/kalshi/analytics?mode=paper&hours=24")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["analytics"]["families"]["btc15m"]["officialBrtiSamples"] == 1
    assert payload["analytics"]["families"]["btc15m"]["blockers"] == [
        {"key": "depth", "count": 1}
    ]
    assert payload["analytics"]["families"]["btchourly"]["funnel"]["orders"] == 1


def test_paper_order_payload_uses_yes_book_shape():
    yes = _paper_order_payload({"action": "BUY_YES", "side": "YES", "edge": {"price": 0.42}, "sizing": {"contracts": 7}}, "T")
    no = _paper_order_payload({"action": "BUY_NO", "side": "NO", "edge": {"price": 0.31}, "sizing": {"contracts": 4}}, "T")
    assert yes["side"] == "bid" and yes["price"] == "0.4200"
    assert no["side"] == "ask" and no["price"] == "0.6900"
    assert yes["time_in_force"] == "immediate_or_cancel"


def test_close_order_payload_uses_reduce_only_yes_book_shape():
    sell_yes = _paper_order_payload(
        {"action": "SELL_YES", "side": "YES", "edge": {"price": 0.57}, "sizing": {"contracts": 7}},
        "T",
    )
    sell_no = _paper_order_payload(
        {"action": "SELL_NO", "side": "NO", "edge": {"price": 0.36}, "sizing": {"contracts": 4}},
        "T",
    )

    assert sell_yes["side"] == "ask" and sell_yes["price"] == "0.5700"
    assert sell_no["side"] == "bid" and sell_no["price"] == "0.6400"
    assert sell_yes["reduce_only"] is True
    assert sell_no["reduce_only"] is True


def test_live_no_order_is_normalised_to_the_user_outcome_price():
    decision = {"action": "SELL_NO", "side": "NO"}
    payload = _paper_order_payload(
        {**decision, "edge": {"price": 0.36}, "sizing": {"contracts": 4}},
        "T",
    )
    order = _normalise_live_order(
        {"order_id": "order-1", "average_price": "0.6500", "fill_count": "4"},
        payload,
        decision,
    )

    assert order["outcome_side"] == "NO"
    assert order["limit_price_dollars"] == 0.36
    assert order["average_price_dollars"] == 0.35
    assert order["action"] == "SELL"
    assert order["reduce_only"] is True


def test_live_v2_partial_fill_uses_average_price_fee_and_remaining_count():
    decision = {"action": "BUY_NO", "side": "NO"}
    payload = _paper_order_payload(
        {**decision, "edge": {"price": 0.31}, "sizing": {"contracts": 4}},
        "T",
    )
    order = _normalise_live_order(
        {
            "order_id": "order-v2",
            "fill_count": "2.00",
            "remaining_count": "2.00",
            "average_fill_price": "0.6800",
            "average_fee_paid": "0.0125",
        },
        payload,
        decision,
    )

    assert order["outcome_side"] == "NO"
    assert order["average_price_dollars"] == 0.32
    assert order["fee_cost_dollars"] == 0.025
    assert order["fill_count_fp"] == 2.0
    assert order["remaining_count_fp"] == 2.0
    assert order["status"] == "partially_filled"


def test_live_fill_prefers_canonical_outcome_price_and_action():
    fill = _normalise_live_fill({
        "fill_id": "fill-no-1",
        "ticker": "KXBTC15M-TEST-00",
        "outcome_side": "no",
        "book_side": "yes",
        "action": "sell",
        "count_fp": "3.00",
        "yes_price_dollars": "0.6400",
        "no_price_dollars": "0.3600",
        "fee_cost": "0.0200",
    })

    assert fill["outcome_side"] == "NO"
    assert fill["action"] == "sell"
    assert fill["price_dollars"] == 0.36
    assert fill["fee_cost_dollars"] == 0.02


def test_live_order_recovers_all_economic_sides_from_yes_book_shape():
    cases = (
        ("bid", False, "YES", "BUY"),
        ("ask", False, "NO", "BUY"),
        ("ask", True, "YES", "SELL"),
        ("bid", True, "NO", "SELL"),
    )
    for book_side, reduce_only, expected_side, expected_action in cases:
        order = _normalise_live_order(
            {"order_id": f"{book_side}-{reduce_only}", "side": book_side},
            {"side": book_side, "reduce_only": reduce_only, "count": "1", "price": "0.5"},
            {},
        )
        assert order["outcome_side"] == expected_side
        assert order["action"] == expected_action


def test_live_fill_uses_matching_order_when_fill_omits_economic_side_and_action():
    order = _normalise_live_order(
        {"order_id": "order-no", "side": "ask"},
        {"side": "ask", "reduce_only": False, "count": "2", "price": "0.64"},
        {},
    )
    fill = _normalise_live_fill({
        "fill_id": "fill-no",
        "order_id": "order-no",
        "ticker": "KXBTC15M-TEST-00",
        "count_fp": "2",
        "yes_price_dollars": "0.6400",
        "no_price_dollars": "0.3600",
    }, order)

    assert fill["outcome_side"] == "NO"
    assert fill["action"] == "buy"
    assert fill["price_dollars"] == 0.36


def test_live_fill_does_not_guess_side_when_both_prices_exist_without_order_context():
    fill = _normalise_live_fill({
        "fill_id": "ambiguous",
        "ticker": "KXBTC15M-TEST-00",
        "count_fp": "2",
        "yes_price_dollars": "0.6400",
        "no_price_dollars": "0.3600",
    })

    assert fill["outcome_side"] == ""
    assert fill["price_dollars"] is None


def test_live_no_fill_uses_outcome_specific_legacy_cent_price():
    fill = _normalise_live_fill({
        "fill_id": "fill-no-cent",
        "ticker": "KXBTC15M-TEST-00",
        "outcome_side": "no",
        "count": 2,
        "yes_price": 64,
        "no_price": 36,
    })

    assert fill["outcome_side"] == "NO"
    assert fill["price_dollars"] == 0.36


def test_live_order_payload_keeps_symmetric_yes_and_no_order_shapes():
    yes = _paper_order_payload({"action": "BUY_YES", "side": "YES", "edge": {"price": 0.42}, "sizing": {"contracts": 7}}, "T")
    no = _paper_order_payload({"action": "BUY_NO", "side": "NO", "edge": {"price": 0.31}, "sizing": {"contracts": 4}}, "T")

    yes_live = _live_order_payload(yes)
    no_live = _live_order_payload(no)

    assert yes_live["side"] == "bid" and yes_live["price"] == "0.4200"
    assert no_live["side"] == "ask" and no_live["price"] == "0.6900"
    assert yes_live["count"] == "7.00" and no_live["count"] == "4.00"


def test_real_order_submission_uses_current_event_order_endpoint_without_side_rewrite():
    calls = []

    def signed_request(config, environment, method, endpoint, **kwargs):
        calls.append((config, environment, method, endpoint, kwargs))
        body = kwargs["json_body"]
        return {"order": {
            "order_id": "order-yes-1",
            "ticker": body["ticker"],
            "client_order_id": body["client_order_id"],
            "side": body["side"],
            "count_fp": body["count"],
            "fill_count_fp": body["count"],
            "price": body["price"],
            "status": "filled",
        }}

    controller = _PaperRobotController(
        client=None,
        state=None,
        paper_accounts=None,
        connection_loader=lambda _uid: {
            "production_api_key_id": "key-id-12345678",
            "production_private_key": "private-key-present",
        },
        signed_request=signed_request,
    )
    payload = _paper_order_payload(
        {"action": "BUY_YES", "side": "YES", "edge": {"price": 0.42}, "sizing": {"contracts": 7}},
        "KXBTC15M-TEST",
    )
    order = controller._submit_live_order("user-1", payload, {"side": "YES", "config": {"executionMode": "real"}})

    assert calls[0][1:4] == ("production", "POST", "/portfolio/events/orders")
    assert calls[0][4]["json_body"]["side"] == "bid"
    assert calls[0][4]["json_body"]["price"] == "0.4200"
    assert order["environment"] == "real"
    assert order["outcome_side"] == "YES"


def test_real_reduce_only_close_is_preserved_and_normalised_as_sell():
    calls = []

    def signed_request(config, environment, method, endpoint, **kwargs):
        calls.append(kwargs["json_body"])
        body = kwargs["json_body"]
        return {"order": {
            "order_id": "order-close-1",
            "ticker": body["ticker"],
            "client_order_id": body["client_order_id"],
            "side": body["side"],
            "count_fp": body["count"],
            "fill_count_fp": body["count"],
            "price": body["price"],
            "status": "filled",
        }}

    controller = _PaperRobotController(
        client=None,
        state=None,
        paper_accounts=None,
        connection_loader=lambda _uid: {
            "production_api_key_id": "key-id-12345678",
            "production_private_key": "private-key-present",
        },
        signed_request=signed_request,
    )
    payload = _paper_order_payload(
        {"action": "SELL_NO", "side": "NO", "edge": {"price": 0.36}, "sizing": {"contracts": 4}},
        "KXBTC15M-TEST",
    )
    order = controller._submit_live_order(
        "user-1",
        payload,
        {"side": "NO", "action": "SELL_NO", "config": {"executionMode": "real"}},
    )

    assert calls[0]["side"] == "bid"
    assert calls[0]["price"] == "0.6400"
    assert calls[0]["reduce_only"] is True
    assert order["action"] == "SELL"
    assert order["reduce_only"] is True


def test_complementary_fills_are_net_not_repeated_close_exposure():
    portfolio = {
        "positions": [{
            "ticker": "KXBTC15M-HEDGE",
            "yes_count_fp": 17,
            "no_count_fp": 17,
            "position_fp": 0,
        }]
    }
    assert _position_side_and_count(portfolio, "KXBTC15M-HEDGE") == (None, 0)


def test_complementary_fills_report_only_residual_direction():
    portfolio = {
        "positions": [{
            "ticker": "KXBTC15M-NET",
            "yes_count_fp": 10,
            "no_count_fp": 14,
            "position_fp": -4,
        }]
    }
    assert _position_side_and_count(portfolio, "KXBTC15M-NET") == ("NO", 4)


def test_reduce_only_sale_estimate_uses_depth_weighted_price_and_fees():
    estimate = _estimate_reduce_only_sale(
        "YES",
        6,
        {"yes": [[0.61, 2], [0.58, 4], [0.50, 10]], "no": []},
    )

    assert estimate["fillableCount"] == 6
    assert estimate["fullDepthAvailable"] is True
    assert estimate["averageBid"] == (0.61 * 2 + 0.58 * 4) / 6
    assert estimate["worstBid"] == 0.58
    assert estimate["estimatedExitFee"] > 0
    assert estimate["netProceeds"] < estimate["grossProceeds"]


def test_protective_exit_uses_configured_threshold_and_emergency_floor():
    normal = _protective_exit_state(0.40, {"exitProbabilityThreshold": 0.46})
    emergency = _protective_exit_state(0.25, {"exitProbabilityThreshold": 0.46})
    healthy = _protective_exit_state(0.60, {"exitProbabilityThreshold": 0.46})

    assert normal["protectiveExit"] is True
    assert normal["emergencyExit"] is False
    assert emergency["protectiveExit"] is True
    assert emergency["emergencyExit"] is True
    assert emergency["emergencyExitThreshold"] == 0.26
    assert healthy["protectiveExit"] is False


def test_probability_dip_alone_cannot_force_a_small_loss_exit():
    state = _exit_economic_state(
        average_entry_price=0.30,
        allocated_entry_fee=0.30,
        held_count=100,
        net_exit_value_per_contract=0.28,
        held_probability=0.40,
        strategy_config={
            "exitProbabilityThreshold": 0.46,
            "minimumExitProfit": 0.01,
            "stopLossPct": 0.35,
            "emergencyStopLossPct": 0.20,
        },
    )

    assert state["protectiveExit"] is True
    assert state["profitableExit"] is False
    assert state["protectiveLossExit"] is False
    assert state["lossExitAuthorized"] is False


def test_take_profit_is_measured_after_entry_and_exit_fees():
    state = _exit_economic_state(
        average_entry_price=0.30,
        allocated_entry_fee=1.0,
        held_count=100,
        net_exit_value_per_contract=0.325,
        held_probability=0.60,
        strategy_config={"minimumExitProfit": 0.01},
    )

    assert state["breakEvenExitValuePerContract"] == 0.31
    assert round(state["netExitPnlPerContract"], 6) == 0.015
    assert state["profitableExit"] is True
    assert state["lossExitAuthorized"] is False


def test_open_live_fill_inventory_rebuilds_fifo_cost_after_partial_sale():
    inventory = _open_live_fill_inventory([
        {
            "fill_id": "buy-1", "ticker": "KXBTC15M-FIFO", "outcome_side": "YES",
            "action": "BUY", "count_fp": 4, "average_price_dollars": 0.40,
            "fee_cost_dollars": 0.04, "created_time": "2026-07-25T00:00:00Z",
        },
        {
            "fill_id": "buy-2", "ticker": "KXBTC15M-FIFO", "outcome_side": "YES",
            "action": "BUY", "count_fp": 4, "average_price_dollars": 0.60,
            "fee_cost_dollars": 0.08, "created_time": "2026-07-25T00:01:00Z",
        },
        {
            "fill_id": "sell-1", "ticker": "KXBTC15M-FIFO", "outcome_side": "YES",
            "action": "SELL", "count_fp": 5, "average_price_dollars": 0.70,
            "fee_cost_dollars": 0.03, "created_time": "2026-07-25T00:02:00Z",
        },
    ])

    row = inventory[("KXBTC15M-FIFO", "YES")]
    assert row["count"] == 3
    assert round(row["principal"], 8) == 1.8
    assert round(row["averagePrice"], 8) == 0.6
    assert round(row["entryFee"], 8) == 0.06


def test_material_loss_requires_the_matching_probability_stop_gate():
    protective = _exit_economic_state(
        average_entry_price=0.40,
        allocated_entry_fee=1.0,
        held_count=100,
        net_exit_value_per_contract=0.25,
        held_probability=0.40,
        strategy_config={
            "exitProbabilityThreshold": 0.46,
            "stopLossPct": 0.35,
            "emergencyStopLossPct": 0.20,
        },
    )
    emergency = _exit_economic_state(
        average_entry_price=0.40,
        allocated_entry_fee=1.0,
        held_count=100,
        net_exit_value_per_contract=0.31,
        held_probability=0.20,
        strategy_config={
            "exitProbabilityThreshold": 0.46,
            "stopLossPct": 0.35,
            "emergencyStopLossPct": 0.20,
        },
    )

    assert protective["protectiveLossExit"] is True
    assert protective["emergencyLossExit"] is False
    assert emergency["protectiveLossExit"] is False
    assert emergency["emergencyLossExit"] is True


def test_persisted_entry_and_exit_times_survive_ephemeral_decision_history():
    now = datetime.now(timezone.utc)
    recent = (now - timedelta(seconds=12)).isoformat()
    state = {
        "strategy": {
            "lastEntryTicker": "KXBTC15M-TIMING",
            "lastEntryAt": recent,
            "lastExitTicker": "KXBTC15M-TIMING",
            "lastExitAt": recent,
        },
        "decisions": [{"ticker": "OTHER", "action": "WAIT"}],
    }

    assert 0 <= _recent_filled_entry_age(state, "KXBTC15M-TIMING") < 30
    assert 0 <= _recent_filled_exit_age(state, "KXBTC15M-TIMING") < 30


def test_position_execution_context_keeps_entry_cost_and_age_inputs():
    portfolio = {
        "positions": [{
            "ticker": "KXBTC15M-CONTEXT",
            "yes_count_fp": 8,
            "no_count_fp": 0,
            "yes_average_price_dollars": 0.41,
            "yes_fee_cost_dollars": 0.12,
            "last_trade_at": "2026-07-22T12:00:00Z",
        }],
    }

    context = _position_execution_context(portfolio, "KXBTC15M-CONTEXT")

    assert context["side"] == "YES"
    assert context["count"] == 8
    assert context["averageEntryPrice"] == 0.41
    assert context["allocatedEntryFee"] == 0.12


def test_evaluate_does_not_persist_a_trade(tmp_path):
    client = _app(tmp_path).test_client()
    payload = client.post("/api/kalshi/btc-15m/evaluate", json={"config": {}}).get_json()
    assert payload["success"] is True
    assert payload["robotState"]["decisions"] == []


def test_reset_clears_builtin_paper_ledger(tmp_path):
    client = _app(tmp_path).test_client()
    payload = client.delete("/api/kalshi/paper/portfolio").get_json()
    assert payload["success"] is True
    assert payload["portfolio"]["balance"]["balance"] == 1_000_000
    assert payload["state"]["strategy"]["settledSamples"] == 0
