from datetime import datetime, timedelta, timezone

from flask import Flask

from kalshi_api import (
    _PaperRobotController,
    _live_order_payload,
    _normalise_live_fill,
    _normalise_live_settlement,
    _paper_order_payload,
    _position_side_and_count,
    register_kalshi_api,
)


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


def _app(tmp_path, *, auth=True, ai_status_resolver=None):
    app = Flask(__name__)
    register_kalshi_api(
        app,
        require_auth=(lambda: {"id": "user-1"}) if auth else (lambda: None),
        http_get=_fake_get,
        robot_state_path=str(tmp_path / "state.json"),
        paper_account_path=str(tmp_path / "paper.json"),
        ai_status_resolver=ai_status_resolver,
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


def test_status_exposes_only_non_secret_ai_availability(tmp_path):
    payload = _app(
        tmp_path,
        ai_status_resolver=lambda _uid: {
            "configured": True,
            "status": "connected",
            "provider": "test-provider",
            "model": "test-model",
        },
    ).test_client().get("/api/kalshi/status").get_json()

    assert payload["ai"] == {
        "configured": True,
        "status": "connected",
        "provider": "test-provider",
        "model": "test-model",
    }


def test_pretrade_ai_review_is_rate_limited_and_receives_bounded_evidence():
    calls = []

    def reviewer(user_id, evidence):
        calls.append((user_id, evidence))
        return {"status": "reviewed", "verdict": "clear", "confidence": 0.8, "summary": "No contradiction."}

    controller = _PaperRobotController(
        client=None,
        state=None,
        paper_accounts=None,
        ai_candidate_reviewer=reviewer,
    )
    decision = {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "signalQuality": 80,
        "config": {"preTradeAiReview": True},
        "market": {"ticker": "KXBTC15M-AI", "yesAsk": 0.50, "spread": 0.02},
        "model": {"fairYesProbability": 0.62, "momentum5m": 0.01},
        "edge": {"side": "YES", "price": 0.50, "netEdge": 0.10},
        "gates": [{"key": "spread", "status": "pass"}],
    }

    first = controller._candidate_ai_review("user-1", decision, {"cashAvailable": 1000})
    decision["edge"]["price"] = 0.51
    second = controller._candidate_ai_review("user-1", decision, {"cashAvailable": 1000})

    assert len(calls) == 1
    assert calls[0][1]["passedGates"] == ["spread"]
    assert first["ticker"] == "KXBTC15M-AI"
    assert first["cached"] is False
    assert second["cached"] is True


def test_paper_order_payload_uses_yes_book_shape():
    yes = _paper_order_payload({"action": "BUY_YES", "side": "YES", "edge": {"price": 0.42}, "sizing": {"contracts": 7}}, "T")
    no = _paper_order_payload({"action": "BUY_NO", "side": "NO", "edge": {"price": 0.31}, "sizing": {"contracts": 4}}, "T")
    assert yes["side"] == "bid" and yes["price"] == "0.4200"
    assert no["side"] == "ask" and no["price"] == "0.6900"
    assert yes["time_in_force"] == "immediate_or_cancel"


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
