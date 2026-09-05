import json
from datetime import datetime, timedelta, timezone
from functools import partial

import start_quant_backend as backend


def test_target_only_sell_is_not_protective():
    state = backend._pa_classify_sell_protection([
        {
            "id": "target-1",
            "symbol": "AAPL",
            "side": "sell",
            "type": "limit",
            "limit_price": "120",
            "client_order_id": "alphalab-target",
        }
    ])

    assert state["hasTarget"] is True
    assert state["hasStop"] is False
    assert state["isProtective"] is False


def test_stop_only_sell_is_downside_protection_but_not_complete():
    state = backend._pa_classify_sell_protection([
        {
            "id": "stop-1",
            "symbol": "AAPL",
            "side": "sell",
            "type": "stop",
            "stop_price": "95",
            "client_order_id": "alphalab-position-stop",
        }
    ])

    assert state["hasStop"] is True
    assert state["hasTarget"] is False
    assert state["isProtective"] is True
    assert state["isComplete"] is False
    assert state["protectionStatus"] == "stop_only"
    assert state["managedByAlphaLab"] is True


def test_external_sell_order_is_not_owned_by_alphalab():
    state = backend._pa_classify_sell_protection([
        {
            "id": "external-stop",
            "symbol": "AAPL",
            "side": "sell",
            "type": "stop",
            "stop_price": "95",
            "client_order_id": "manual-order",
        }
    ])

    assert state["hasStop"] is True
    assert state["hasExternalOrders"] is True
    assert state["managedByAlphaLab"] is False


def test_nested_oco_is_recognized_as_protection():
    state = backend._pa_classify_sell_protection([
        {
            "id": "oco-parent",
            "symbol": "AAPL",
            "side": "sell",
            "type": "limit",
            "order_class": "oco",
            "limit_price": "120",
            "client_order_id": "alphalab-oco",
            "legs": [
                {
                    "id": "stop-leg",
                    "symbol": "AAPL",
                    "side": "sell",
                    "type": "stop",
                    "stop_price": "95",
                    "client_order_id": "alphalab-stop",
                }
            ],
        }
    ])

    assert state["hasTarget"] is True
    assert state["hasStop"] is True
    assert state["advancedOrder"] is True
    assert state["isProtective"] is True


def test_scale_in_keeps_managed_protection_and_schedules_coverage_refresh():
    gate = backend._pa_scale_in_protection_gate([{
        "id": "stop-1",
        "symbol": "AAPL",
        "side": "sell",
        "type": "stop",
        "stop_price": "95",
        "client_order_id": "alphalab-position-stop",
    }])

    assert gate["eligible"] is True
    assert gate["refreshRequired"] is True


def test_scale_in_never_cancels_or_bypasses_external_sell_order():
    gate = backend._pa_scale_in_protection_gate([{
        "id": "manual-stop",
        "symbol": "AAPL",
        "side": "sell",
        "type": "stop",
        "stop_price": "95",
        "client_order_id": "user-manual-order",
    }])

    assert gate["eligible"] is False
    assert "external sell order" in gate["blockers"][0]


def test_order_tree_flattening_retains_parent_identity():
    rows = backend._pa_flatten_alpaca_order_tree([
        {
            "id": "parent-1",
            "client_order_id": "alphalab-entry",
            "legs": [{"id": "target-1"}, {"id": "stop-1"}],
        }
    ])

    assert [row["id"] for row in rows] == ["parent-1", "target-1", "stop-1"]
    assert rows[1]["_parent_order_id"] == "parent-1"
    assert rows[1]["_parent_client_order_id"] == "alphalab-entry"


def test_reconcile_reports_nested_sell_fill_without_oco_cancel_false_alarm(monkeypatch):
    entry_filled_at = datetime.now(timezone.utc).isoformat()
    nested_order = {
        "id": "entry-parent",
        "client_order_id": "alphalab-run-aapl-buy",
        "symbol": "AAPL",
        "side": "buy",
        "type": "limit",
        "status": "filled",
        "filled_qty": "10",
        "filled_avg_price": "100",
        "filled_at": entry_filled_at,
        "legs": [
            {
                "id": "target-leg",
                "symbol": "AAPL",
                "side": "sell",
                "type": "limit",
                "status": "filled",
                "filled_qty": "10",
                "filled_avg_price": "110",
                "filled_at": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
            },
            {
                "id": "stop-leg",
                "symbol": "AAPL",
                "side": "sell",
                "type": "stop",
                "status": "canceled",
                "stop_price": "95",
            },
        ],
    }

    class FakeResponse:
        status_code = 200

        def json(self):
            return [nested_order]

    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        },
    )
    monkeypatch.setattr(backend.requests, "get", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(
        backend,
        "_pa_managed_records_for_user",
        lambda uid, mode: {
            "user:paper:AAPL": {
                "symbol": "AAPL",
                "entryOrderId": "entry-parent",
                "clientOrderId": "alphalab-run-aapl-buy",
                "initialStop": 95,
                "highWaterMark": 99,
                "lastNotifiedOrderStatus": "filled",
                "lastNotifiedOrderId": "entry-parent",
            }
        },
    )
    updates = []
    notifications = []
    monkeypatch.setattr(
        backend,
        "_pa_update_managed_position",
        lambda uid, mode, symbol, **values: updates.append(values),
    )
    monkeypatch.setattr(
        backend,
        "_pa_discord_send_once",
        lambda uid, run_id, event_type, payload: notifications.append((event_type, payload)) or {"sent": True},
    )

    summary = backend._pa_reconcile_order_lifecycle("user", "paper", notify=True)

    assert summary["checked"] == 3
    assert summary["filled"] == 2
    assert summary["failed"] == 0
    assert any(
        update.get("status") == "position_open"
        and update.get("filledAt") == entry_filled_at
        and update.get("entryReferencePrice") == 100
        and update.get("initialRiskPerShare") == 5
        for update in updates
    )
    assert any(update.get("status") == "closed" and update.get("lastOrderId") == "target-leg" for update in updates)
    assert len(notifications) == 1
    assert any(payload.get("side") == "sell" and payload.get("status") == "filled" for _, payload in notifications)
    assert not any(payload.get("status") == "canceled" for _, payload in notifications)


def test_ai_execution_blocks_sell_quantity_above_verified_position(monkeypatch):
    class PositionResponse:
        status_code = 200

        def json(self):
            return {"symbol": "AAPL", "qty": "5"}

    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "ai"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda mode: ({
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        }, "ok"),
    )
    monkeypatch.setattr(backend.requests, "get", lambda *args, **kwargs: PositionResponse())
    monkeypatch.setattr(
        backend.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("oversell must not reach Alpaca")),
    )
    monkeypatch.setattr(backend, "send_discord_notification", lambda *args, **kwargs: {"sent": True})

    response = backend.app.test_client().post('/api/ai/execution/order', json={
        "symbol": "AAPL",
        "side": "sell",
        "qty": 6,
        "type": "market",
        "tradingMode": "paper",
        "automationMode": "full-ai",
        "confirmed": True,
        "executionSource": "exit_scan_hard_stop",
    })
    payload = response.get_json()

    assert payload["success"] is False
    assert payload["code"] == "sell_quantity_exceeds_position"
    assert payload["availableQty"] == 5


def test_ai_execution_blocks_duplicate_open_sell_order(monkeypatch):
    class FakeResponse:
        def __init__(self, payload):
            self.status_code = 200
            self._payload = payload

        def json(self):
            return self._payload

    def fake_get(url, **kwargs):
        if '/v2/positions/' in url:
            return FakeResponse({"symbol": "AAPL", "qty": "10"})
        if url.endswith('/v2/orders'):
            return FakeResponse([{
                "id": "existing-stop",
                "symbol": "AAPL",
                "side": "sell",
                "type": "stop",
                "status": "new",
            }])
        raise AssertionError("unexpected URL %s" % url)

    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "ai"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda mode: ({
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        }, "ok"),
    )
    monkeypatch.setattr(backend.requests, "get", fake_get)
    monkeypatch.setattr(
        backend.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("duplicate sell must not reach Alpaca")),
    )
    monkeypatch.setattr(backend, "send_discord_notification", lambda *args, **kwargs: {"sent": True})

    response = backend.app.test_client().post('/api/ai/execution/order', json={
        "symbol": "AAPL",
        "side": "sell",
        "qty": 10,
        "type": "market",
        "tradingMode": "paper",
        "automationMode": "full-ai",
        "confirmed": True,
        "executionSource": "exit_scan_hard_stop",
    })
    payload = response.get_json()

    assert payload["success"] is False
    assert payload["code"] == "open_sell_order_exists"
    assert payload["openOrderIds"] == ["existing-stop"]


def test_ai_execution_requires_saved_full_ai_authority(monkeypatch):
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "hybrid"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda mode: (_ for _ in ()).throw(AssertionError("authority must fail before broker access")),
    )
    monkeypatch.setattr(backend, "send_discord_notification", lambda *args, **kwargs: {"sent": True})

    response = backend.app.test_client().post('/api/ai/execution/order', json={
        "symbol": "AAPL",
        "side": "sell",
        "qty": 1,
        "type": "market",
        "tradingMode": "paper",
        "automationMode": "full-ai",
        "confirmed": True,
        "executionSource": "exit_scan_hard_stop",
    })
    payload = response.get_json()

    assert response.status_code == 403
    assert payload["code"] == "full_ai_required"


def test_scale_in_submission_does_not_consume_fill_limit(monkeypatch):
    key = backend._pa_managed_position_key("user-1", "paper", "AAPL")
    with backend._PA_MANAGED_POSITIONS_LOCK:
        backend._PA_MANAGED_POSITIONS[key] = {
            "symbol": "AAPL",
            "scaleInCount": 1,
            "currentStop": 95,
            "initialStop": 95,
            "highWaterMark": 110,
        }
    monkeypatch.setattr(backend, "_pa_save_managed_positions", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_persist_managed_position_to_config",
        lambda *args, **kwargs: True,
    )

    backend._pa_record_managed_position_plan(
        "user-1",
        "paper",
        "AAPL",
        {
            "entryIntent": "SCALE_IN",
            "entryZoneLow": 108,
            "entryZoneHigh": 110,
            "stopLoss": 98,
            "takeProfit1": 125,
        },
        order={"id": "add-order-2", "client_order_id": "alphalab-add-2", "status": "new"},
    )

    record = backend._pa_get_managed_position_plan("user-1", "paper", "AAPL")
    assert record["scaleInCount"] == 1
    assert record["pendingScaleIn"] is True
    assert record["currentStop"] == 98


def test_scale_in_count_advances_once_when_broker_reports_fill(monkeypatch):
    filled_at = datetime.now(timezone.utc).isoformat()

    class FakeResponse:
        status_code = 200

        def json(self):
            return [{
                "id": "add-order-2",
                "client_order_id": "alphalab-add-2",
                "symbol": "AAPL",
                "side": "buy",
                "type": "limit",
                "status": "filled",
                "filled_qty": "2",
                "filled_avg_price": "110",
                "filled_at": filled_at,
            }]

    managed_record = {
        "symbol": "AAPL",
        "entryOrderId": "add-order-2",
        "clientOrderId": "alphalab-add-2",
        "entryIntent": "SCALE_IN",
        "pendingScaleIn": True,
        "scaleInCount": 1,
        "initialStop": 95,
        "currentStop": 100,
    }
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        },
    )
    monkeypatch.setattr(backend.requests, "get", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(
        backend,
        "_pa_managed_records_for_user",
        lambda uid, mode: {"user-1:paper:AAPL": managed_record},
    )
    updates = []
    monkeypatch.setattr(
        backend,
        "_pa_update_managed_position",
        lambda uid, mode, symbol, **values: updates.append(values),
    )

    backend._pa_reconcile_order_lifecycle("user-1", "paper", notify=False)

    fill_update = next(update for update in updates if update.get("lastOrderId") == "add-order-2")
    assert fill_update["scaleInCount"] == 2
    assert fill_update["pendingScaleIn"] is False
    assert fill_update["protectionRefreshRequired"] is True


def test_exit_risk_stop_is_binding():
    action, reason, pl_pct = backend._pa_exit_risk_decision(
        current_price=94,
        avg_entry=100,
        stop=95,
        target=112,
        risk_profile="medium",
    )

    assert action == "emergency_exit"
    assert "breached stop" in reason
    assert pl_pct == -6


def test_target_is_reported_without_overriding_existing_protection():
    action, _, _ = backend._pa_exit_risk_decision(
        current_price=113,
        avg_entry=100,
        stop=95,
        target=112,
        risk_profile="medium",
    )

    assert action == "target_reached"


def test_dynamic_exit_plan_moves_to_break_even_without_moving_target():
    plan = backend._pa_build_dynamic_exit_plan(
        {
            "avg_entry_price": "100",
            "current_price": "106",
            "qty": "10",
            "market_value": "1060",
        },
        {
            "initialStop": 95,
            "currentStop": 95,
            "takeProfit1": 112,
            "takeProfit2": 118,
            "initialRiskPerShare": 5,
            "highWaterMark": 106,
        },
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "uptrend", "quoteTime": "2026-07-13T14:00:00Z"},
        account_equity=100_000,
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert plan["state"] == "BREAKEVEN"
    assert plan["currentStop"] == 100
    assert plan["target1"] == 112
    assert plan["targetPolicy"] == "fixed_structural"


def test_first_target_reduction_quantity_comes_from_authoritative_mandate():
    low = backend._strategy_policy("low", "mid")
    medium = backend._strategy_policy("medium", "mid")
    high = backend._strategy_policy("high", "mid")

    assert low["target1ReducePct"] == 60
    assert medium["target1ReducePct"] == 50
    assert high["target1ReducePct"] == 40
    assert backend._pa_target1_reduction_quantity(10, medium["target1ReducePct"]) == 5
    assert backend._pa_target1_reduction_quantity(1, medium["target1ReducePct"]) == 0.5
    assert backend._pa_target1_reduction_quantity(10, 100) < 10


def test_second_target_and_time_stops_are_terminal_exit_actions():
    common_position = {
        "symbol": "AAPL",
        "avg_entry_price": "100",
        "qty": "5",
        "market_value": "595",
    }
    common_plan = {
        "initialStop": 95,
        "currentStop": 100,
        "takeProfit1": 112,
        "takeProfit2": 118,
        "initialRiskPerShare": 5,
        "highWaterMark": 119,
        "target1Completed": True,
        "target1ReductionStatus": "filled",
        "createdAt": "2026-07-10T14:00:00Z",
    }

    second_target = backend._pa_build_dynamic_exit_plan(
        {**common_position, "current_price": "119"},
        common_plan,
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "uptrend", "historyDays": 180},
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )
    time_stop = backend._pa_build_dynamic_exit_plan(
        {
            **common_position,
            "current_price": "99",
            "market_value": "495",
        },
        {
            **common_plan,
            "currentStop": 95,
            "highWaterMark": 103,
            "createdAt": "2026-05-20T14:00:00Z",
        },
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "mixed", "historyDays": 180},
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )
    leveraged_time_stop = backend._pa_build_dynamic_exit_plan(
        {
            **common_position,
            "symbol": "TQQQ",
            "current_price": "106",
            "market_value": "530",
        },
        {
            **common_plan,
            "isLeveraged": True,
            "currentStop": 95,
            "highWaterMark": 106,
            "target1Completed": False,
            "target1ReductionStatus": "eligible",
            "createdAt": "2026-07-11T14:00:00Z",
        },
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "uptrend", "historyDays": 180},
        risk_profile="high",
        time_horizon="short",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert second_target["action"] == "target2_reached"
    assert time_stop["action"] == "time_exit"
    assert leveraged_time_stop["action"] == "time_exit"
    assert leveraged_time_stop["timeStopDays"] == 1
    assert leveraged_time_stop["isLeveraged"] is True


def test_exit_indicators_exclude_incomplete_daily_bar_and_use_wilder_inputs():
    bars = []
    start = datetime(2026, 5, 13, tzinfo=timezone.utc)
    for index in range(60):
        close = 100 + index
        bars.append({
            "t": (start + timedelta(days=index)).isoformat(),
            "o": close - 0.5,
            "h": close + 1,
            "l": close - 1,
            "c": close,
            "v": 1_000_000,
        })
    bars.append({
        "t": "2026-07-13T04:00:00Z",
        "o": 160,
        "h": 300,
        "l": 50,
        "c": 200,
        "v": 100,
    })

    indicators = backend._pa_compute_exit_indicators(
        bars,
        {
            "snapshotPrice": 200,
            "latestQuoteTime": "2026-07-13T14:00:00Z",
            "bidPrice": 199.9,
            "askPrice": 200.1,
            "bidAskSpreadPct": 0.1,
        },
        now_et=datetime(2026, 7, 13, 10, 0, tzinfo=timezone(timedelta(hours=-4))),
    )

    assert indicators["excludedIncompleteDailyBar"] is True
    assert indicators["historyDays"] == 60
    assert str(indicators["barsAsOf"]).startswith("2026-07-11")
    assert indicators["atr14"] < 3
    assert indicators["rsi14"] == 100


def test_dynamic_exit_stop_never_widens_after_trailing_starts():
    plan = backend._pa_build_dynamic_exit_plan(
        {
            "avg_entry_price": "100",
            "current_price": "108",
            "qty": "10",
            "market_value": "1080",
        },
        {
            "initialStop": 95,
            "currentStop": 105,
            "takeProfit1": 115,
            "takeProfit2": 120,
            "initialRiskPerShare": 5,
            "highWaterMark": 110,
        },
        initial_stop=95,
        target_1=115,
        target_2=120,
        indicators={"atr14": 3, "trendState": "mixed", "quoteTime": "2026-07-13T14:00:00Z"},
        account_equity=100_000,
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert plan["state"] == "TRAILING"
    assert plan["currentStop"] == 105
    assert plan["stopPolicy"] == "ratchet_only"


def test_hard_stop_remains_binding_when_soft_thesis_checks_also_fail():
    plan = backend._pa_build_dynamic_exit_plan(
        {
            "avg_entry_price": "100",
            "current_price": "94",
            "qty": "10",
            "market_value": "940",
        },
        {
            "initialStop": 95,
            "currentStop": 95,
            "takeProfit1": 112,
            "initialRiskPerShare": 5,
            "highWaterMark": 103,
            "filledAt": "2026-05-01T14:00:00Z",
        },
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "downtrend", "rsi14": 31, "quoteTime": "2026-07-13T14:00:00Z"},
        account_equity=100_000,
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert plan["action"] == "emergency_exit"
    assert plan["thesisStatus"] == "invalid"
    assert "at/below ratcheted stop" in plan["reason"]


def test_exit_event_risk_requests_review_without_changing_geometry():
    plan = backend._pa_build_dynamic_exit_plan(
        {
            "avg_entry_price": "100",
            "current_price": "103",
            "qty": "10",
            "market_value": "1030",
        },
        {
            "initialStop": 95,
            "currentStop": 95,
            "takeProfit1": 112,
            "takeProfit2": 118,
            "initialRiskPerShare": 5,
            "highWaterMark": 103,
        },
        initial_stop=95,
        target_1=112,
        target_2=118,
        indicators={"atr14": 2, "trendState": "uptrend", "rsi14": 55, "quoteTime": "2026-07-13T14:00:00Z"},
        event_context={"eventRisk": "High", "daysToEarnings": 1},
        account_equity=100_000,
        risk_profile="medium",
        time_horizon="mid",
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert plan["action"] == "event_review"
    assert plan["eventReview"] is True
    assert plan["currentStop"] == 95
    assert plan["target1"] == 112


def test_exit_event_context_recomputes_earnings_distance():
    event = backend._pa_normalize_exit_event_context(
        {
            "eventRisk": "Low",
            "daysToEarnings": 20,
            "nextEarningsDate": "2026-07-14",
        },
        now=datetime(2026, 7, 13, 14, 1, tzinfo=timezone.utc),
    )

    assert event["daysToEarnings"] == 1
    assert event["eventRisk"] == "High"
    assert event["authority"] == "review_only_not_an_automatic_exit"


def test_unified_exit_scan_uses_persisted_entry_geometry(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_fetch_positions_for_mode",
        lambda uid, mode: ([{
            "symbol": "AAPL",
            "qty": "10",
            "side": "long",
            "avg_entry_price": "100",
            "current_price": "106",
            "market_value": "1060",
            "unrealized_pl": "60",
            "unrealized_plpc": "0.06",
        }], None),
    )
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {"api_key": "", "api_secret": "", "base_url": "https://paper.example.com"},
    )
    monkeypatch.setattr(
        backend,
        "_pa_fetch_exit_market_context",
        lambda uid, symbols, mode: ({
            "AAPL": {"indicators": {
                "price": 106,
                "atr14": 2,
                "trendState": "uptrend",
                "quoteTime": "2026-07-13T14:00:00Z",
                "quoteAgeSeconds": 1,
                "historyDays": 180,
            }},
            "SPY": {"indicators": {"trendState": "uptrend"}},
        }, {"source": "test"}),
    )
    monkeypatch.setattr(
        backend,
        "_pa_get_managed_position_plan",
        lambda uid, mode, symbol: {
            "symbol": symbol,
            "initialStop": 95,
            "currentStop": 95,
            "takeProfit1": 112,
            "takeProfit2": 118,
            "initialRiskPerShare": 5,
            "highWaterMark": 106,
            "createdAt": "2026-07-10T14:00:00Z",
        },
    )
    updates = []
    monkeypatch.setattr(
        backend,
        "_pa_update_managed_position",
        lambda uid, mode, symbol, **values: updates.append(values),
    )
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {})
    monkeypatch.setattr(
        backend,
        "_pa_exit_ai_challenge",
        lambda uid, signals, enabled=True: {"used": False, "status": "disabled"},
    )

    summary = backend._pa_exit_scan_headless(
        "user-1", [], "hybrid", dry_run=True, trade_mode="paper", ai_review=False,
    )

    assert summary["error"] is None
    assert summary["holdingsScanned"] == 1
    assert summary["scanPolicy"]["engine"] == "position_lifecycle_v3_staged_exits"
    signal = summary["signals"][0]
    assert signal["exitPlanSource"] == "managed_plan"
    assert signal["exitPlan"]["version"] == 3
    assert signal["exitPlan"]["currentStop"] == 100
    assert signal["exitPlan"]["target1"] == 112
    assert signal["plPct"] == 6
    assert signal["protection"]["stopCoveragePct"] == 0
    assert signal["protection"]["hasFullStopCoverage"] is False
    assert updates and updates[0]["exitPolicyVersion"] == 3


def test_exit_scan_reduces_half_once_then_closes_remainder_at_target2(monkeypatch):
    position = {
        "symbol": "AAPL",
        "qty": "10",
        "side": "long",
        "avg_entry_price": "100",
        "current_price": "113",
        "market_value": "1130",
        "unrealized_pl": "130",
        "unrealized_plpc": "0.13",
    }
    managed = {
        "symbol": "AAPL",
        "initialStop": 95,
        "currentStop": 100,
        "takeProfit1": 112,
        "takeProfit2": 118,
        "initialRiskPerShare": 5,
        "highWaterMark": 113,
        "createdAt": "2026-07-10T14:00:00Z",
        "target1Completed": False,
        "target1ReductionStatus": "eligible",
    }
    submitted_bodies = []

    monkeypatch.setattr(
        backend,
        "_pa_fetch_positions_for_mode",
        lambda uid, mode: ([dict(position)], None),
    )
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "",
            "api_secret": "",
            "base_url": "https://paper.example.com",
        },
    )
    monkeypatch.setattr(
        backend,
        "_pa_fetch_exit_market_context",
        lambda uid, symbols, mode: ({
            "AAPL": {"indicators": {
                "price": float(position["current_price"]),
                "atr14": 2,
                "trendState": "uptrend",
                "quoteTime": "2026-07-13T14:00:00Z",
                "quoteAgeSeconds": 1,
                "historyDays": 180,
            }},
            "SPY": {"indicators": {"trendState": "uptrend"}},
        }, {"source": "test"}),
    )
    monkeypatch.setattr(
        backend,
        "_pa_get_managed_position_plan",
        lambda uid, mode, symbol: dict(managed),
    )
    monkeypatch.setattr(
        backend,
        "_pa_update_managed_position",
        lambda uid, mode, symbol, **values: managed.update(values),
    )
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "ai"})
    monkeypatch.setattr(
        backend,
        "_pa_exit_ai_challenge",
        lambda uid, signals, enabled=True: {"used": False, "status": "disabled"},
    )

    def fake_call(uid, path, view_func, body):
        submitted_bodies.append(dict(body))
        return ({
            "success": True,
            "status": "submitted",
            "order": {"id": "order-%d" % len(submitted_bodies)},
        }, 200)

    monkeypatch.setattr(backend, "_pa_call_endpoint", fake_call)

    first = backend._pa_exit_scan_headless(
        "user-1", [], "ai", trade_mode="paper", run_id="run-first", ai_review=False,
    )
    assert first["signals"][0]["action"] == "target1_reduce_submitted"
    assert submitted_bodies[0]["qty"] == 5
    assert submitted_bodies[0]["type"] == "market"
    assert submitted_bodies[0]["executionSource"] == "exit_scan_target1_reduce"
    assert managed["target1ReductionStatus"] == "submitted"
    assert managed["target1PositionQtyBefore"] == 10

    second = backend._pa_exit_scan_headless(
        "user-1", [], "ai", trade_mode="paper", run_id="run-second", ai_review=False,
    )
    assert second["signals"][0]["action"] == "target1_pending_reconciliation"
    assert len(submitted_bodies) == 1

    position.update({
        "qty": "5",
        "current_price": "119",
        "market_value": "595",
        "unrealized_pl": "95",
        "unrealized_plpc": "0.19",
    })
    third = backend._pa_exit_scan_headless(
        "user-1", [], "ai", trade_mode="paper", run_id="run-third", ai_review=False,
    )
    assert third["signals"][0]["action"] == "target2_exit_submitted"
    assert submitted_bodies[1]["qty"] == 5
    assert submitted_bodies[1]["executionSource"] == "exit_scan_target2"
    assert managed["target1Completed"] is True


def _install_exit_runtime_scenario(monkeypatch, position_specs, on_submit=None):
    # These fixtures opened on July 24 and quote July 25. Use the production
    # planner with that same clock so ordinary holdings do not eventually age
    # into an unrelated time exit as the calendar advances.
    monkeypatch.setattr(
        backend,
        "_pa_build_dynamic_exit_plan",
        partial(
            backend._pa_build_dynamic_exit_plan,
            now=datetime(2026, 7, 25, 14, 0, tzinfo=timezone.utc),
        ),
    )
    positions = []
    managed_by_symbol = {}
    for spec in position_specs:
        symbol = spec["symbol"]
        price = float(spec["price"])
        qty = float(spec.get("qty", 10))
        avg_entry = float(spec.get("avgEntry", 100))
        positions.append({
            "symbol": symbol,
            "qty": str(qty),
            "side": "long",
            "avg_entry_price": str(avg_entry),
            "current_price": str(price),
            "market_value": str(price * qty),
            "unrealized_pl": str((price - avg_entry) * qty),
            "unrealized_plpc": str((price - avg_entry) / avg_entry),
        })
        managed_by_symbol[symbol] = {
            "symbol": symbol,
            "initialStop": spec.get("stop", 95),
            "currentStop": spec.get("stop", 95),
            "takeProfit1": spec.get("target1", 112),
            "takeProfit2": spec.get("target2", 125),
            "initialRiskPerShare": avg_entry - float(spec.get("stop", 95)),
            "highWaterMark": max(price, avg_entry),
            "createdAt": spec.get("createdAt", "2026-07-24T14:00:00Z"),
            "isLeveraged": bool(spec.get("isLeveraged", False)),
            "target1Completed": False,
            "target1ReductionStatus": "eligible",
        }

    submitted_bodies = []
    monkeypatch.setattr(
        backend,
        "_pa_fetch_positions_for_mode",
        lambda uid, mode: ([dict(position) for position in positions], None),
    )
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "",
            "api_secret": "",
            "base_url": "https://paper.example.com",
        },
    )

    def market_context(uid, symbols, mode):
        rows = {"SPY": {"indicators": {"trendState": "uptrend"}}}
        for position in positions:
            symbol = position["symbol"]
            price = float(position["current_price"])
            rows[symbol] = {"indicators": {
                "price": price,
                "atr14": 2,
                "trendState": "downtrend" if price <= 95 else "uptrend",
                "rsi14": 35 if price <= 95 else 55,
                "quoteTime": "2026-07-25T14:00:00Z",
                "quoteAgeSeconds": 1,
                "historyDays": 180,
            }}
        return rows, {"source": "test"}

    monkeypatch.setattr(backend, "_pa_fetch_exit_market_context", market_context)
    monkeypatch.setattr(
        backend,
        "_pa_get_managed_position_plan",
        lambda uid, mode, symbol: dict(managed_by_symbol[symbol]),
    )

    def update_managed(uid, mode, symbol, **values):
        managed_by_symbol[symbol].update(values)
        return True

    monkeypatch.setattr(backend, "_pa_update_managed_position", update_managed)
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "ai"})
    monkeypatch.setattr(
        backend,
        "_pa_exit_ai_challenge",
        lambda uid, signals, enabled=True: {"used": False, "status": "disabled"},
    )

    def fake_call(uid, path, view_func, body):
        submitted_bodies.append(dict(body))
        if on_submit is not None:
            on_submit(dict(body))
        return ({
            "success": True,
            "status": "submitted",
            "order": {"id": "runtime-order-%d" % len(submitted_bodies)},
        }, 200)

    monkeypatch.setattr(backend, "_pa_call_endpoint", fake_call)
    return submitted_bodies, managed_by_symbol


def test_run_stop_between_two_target1_candidates_blocks_second_discretionary_order(
    monkeypatch,
):
    stop_state = {"requested": False}

    def request_stop_after_first_submission(_body):
        stop_state["requested"] = True

    submitted, managed = _install_exit_runtime_scenario(
        monkeypatch,
        [
            {"symbol": "AAPL", "price": 113},
            {"symbol": "MSFT", "price": 113},
        ],
        on_submit=request_stop_after_first_submission,
    )
    monkeypatch.setattr(
        backend,
        "_pa_check_stop_requested",
        lambda uid, expected_run_id=None: stop_state["requested"],
    )
    monkeypatch.setattr(backend, "_backend_enforce_runtime_budget", lambda: None)

    summary = backend._pa_exit_scan_headless(
        "user-1",
        [],
        "ai",
        trade_mode="paper",
        run_id="run-stop-between-targets",
        ai_review=False,
    )
    signals = {signal["symbol"]: signal for signal in summary["signals"]}

    assert [body["executionSource"] for body in submitted] == [
        "exit_scan_target1_reduce"
    ]
    assert signals["AAPL"]["action"] == "target1_reduce_submitted"
    assert signals["MSFT"]["action"] == "stopped_before_target1_reduce"
    assert signals["MSFT"]["pauseReason"] == "run_stop_requested"
    assert managed["MSFT"]["target1ReductionStatus"] == "eligible"
    assert summary["stoppedAfterProtection"] is True
    assert summary["discretionaryPauseReason"] == "run_stop_requested"


def test_deadline_blocks_discretionary_target_but_allows_hard_exit_and_protection(
    monkeypatch,
):
    submitted, managed = _install_exit_runtime_scenario(
        monkeypatch,
        [
            {"symbol": "AAPL", "price": 113},
            {"symbol": "MSFT", "price": 94},
            {"symbol": "NVDA", "price": 106},
        ],
    )
    monkeypatch.setattr(
        backend,
        "_pa_check_stop_requested",
        lambda uid, expected_run_id=None: False,
    )

    def expired_stage_budget():
        raise backend._BackendStageDeadlineExceeded("exit_scan", 11, 10)

    monkeypatch.setattr(
        backend,
        "_backend_enforce_runtime_budget",
        expired_stage_budget,
    )

    summary = backend._pa_exit_scan_headless(
        "user-1",
        [],
        "ai",
        trade_mode="paper",
        run_id="run-deadline-safety",
        ai_review=False,
    )
    signals = {signal["symbol"]: signal for signal in summary["signals"]}
    sources = [body["executionSource"] for body in submitted]

    assert "exit_scan_target1_reduce" not in sources
    assert sources == ["exit_scan_hard_stop", "exit_scan_stop_protection"]
    assert signals["AAPL"]["action"] == "stopped_before_target1_reduce"
    assert signals["AAPL"]["pauseReason"] == "pipeline_stage_deadline_exceeded"
    assert managed["AAPL"]["target1ReductionStatus"] == "eligible"
    assert signals["MSFT"]["action"] == "emergency_exit_submitted"
    assert signals["NVDA"]["action"] == "attach_protection"
    assert summary["deadlineExceeded"] is True
    assert summary["error"] == "exit_deadline_exceeded"
    assert summary["discretionaryPauseReason"] == "pipeline_stage_deadline_exceeded"


def test_fractional_position_receives_day_stop_from_position_guard(monkeypatch):
    submitted, _managed = _install_exit_runtime_scenario(
        monkeypatch,
        [{"symbol": "BAC", "price": 63.63, "avgEntry": 63.63, "qty": 0.3084,
          "stop": 62.78, "target1": 65.52, "target2": 66.28}],
    )
    monkeypatch.setattr(
        backend, "_pa_check_stop_requested",
        lambda uid, expected_run_id=None: False,
    )
    monkeypatch.setattr(backend, "_backend_enforce_runtime_budget", lambda: None)

    summary = backend._pa_exit_scan_headless(
        "user-1", [], "ai", trade_mode="paper",
        run_id="position-guard-fractional", ai_review=False,
    )
    signal = summary["signals"][0]

    assert signal["action"] == "attach_protection"
    assert signal["status"] == "submitted"
    assert submitted[0]["qty"] == 0.3084
    assert submitted[0]["type"] == "stop"
    assert submitted[0]["time_in_force"] == "day"
    assert submitted[0]["executionSource"] == "exit_scan_fractional_stop"


def test_stop_blocks_target2_and_ordinary_time_exit_but_not_leveraged_time_stop(
    monkeypatch,
):
    submitted, _managed = _install_exit_runtime_scenario(
        monkeypatch,
        [
            {"symbol": "AAPL", "price": 126, "target2": 125},
            {
                "symbol": "MSFT",
                "price": 94,
                "stop": 90,
                "createdAt": "2026-01-01T14:00:00Z",
            },
            {
                "symbol": "TQQQ",
                "price": 100,
                "stop": 90,
                "createdAt": "2026-07-23T14:00:00Z",
                "isLeveraged": True,
            },
        ],
    )
    monkeypatch.setattr(
        backend,
        "_pa_check_stop_requested",
        lambda uid, expected_run_id=None: True,
    )
    monkeypatch.setattr(backend, "_backend_enforce_runtime_budget", lambda: None)

    summary = backend._pa_exit_scan_headless(
        "user-1",
        [],
        "ai",
        trade_mode="paper",
        run_id="run-stop-terminal-boundary",
        ai_review=False,
    )
    signals = {signal["symbol"]: signal for signal in summary["signals"]}

    assert [body["executionSource"] for body in submitted] == [
        "exit_scan_time_stop"
    ]
    assert signals["AAPL"]["triggerAction"] == "target2_reached"
    assert signals["AAPL"]["action"] == "stopped_before_terminal_exit"
    assert signals["MSFT"]["triggerAction"] == "time_exit"
    assert signals["MSFT"]["action"] == "stopped_before_terminal_exit"
    assert signals["TQQQ"]["triggerAction"] == "time_exit"
    assert signals["TQQQ"]["action"] == "time_exit_submitted"
    assert signals["TQQQ"]["exitPlan"]["isLeveraged"] is True
    assert summary["stoppedAfterProtection"] is True
    assert summary["discretionaryPauseReason"] == "run_stop_requested"


def test_target1_fill_reconciliation_marks_position_reduced_not_closed(monkeypatch):
    class FakeResponse:
        status_code = 200

        def json(self):
            return [{
                "id": "reduce-1",
                "client_order_id": "alphalab-run-aapl-t1-reduce-1",
                "symbol": "AAPL",
                "side": "sell",
                "type": "market",
                "status": "filled",
                "qty": "5",
                "filled_qty": "5",
                "filled_avg_price": "112.5",
                "filled_at": datetime.now(timezone.utc).isoformat(),
            }]

    record = {
        "symbol": "AAPL",
        "target1ReductionOrderId": "reduce-1",
        "target1ReductionClientOrderId": "alphalab-run-aapl-t1-reduce-1",
        "target1ReductionStatus": "submitted",
        "target1Completed": False,
    }
    updates = []
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        },
    )
    monkeypatch.setattr(backend.requests, "get", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(
        backend,
        "_pa_managed_records_for_user",
        lambda uid, mode: {"user-1:paper:AAPL": record},
    )
    monkeypatch.setattr(
        backend,
        "_pa_update_managed_position",
        lambda uid, mode, symbol, **values: updates.append(values),
    )
    monkeypatch.setattr(backend, "_record_order_lifecycle", lambda *args, **kwargs: None)

    summary = backend._pa_reconcile_order_lifecycle("user-1", "paper", notify=False)

    assert summary["filled"] == 1
    assert updates[0]["status"] == "position_reduced"
    assert updates[0]["target1ReductionStatus"] == "filled"
    assert updates[0]["target1Completed"] is True
    assert updates[0]["protectionRefreshRequired"] is True


def test_exit_scan_never_cancels_external_sell_order(monkeypatch):
    position = {
        "symbol": "AAPL",
        "qty": "10",
        "side": "long",
        "avg_entry_price": "100",
        "current_price": "94",
        "market_value": "940",
        "unrealized_pl": "-60",
        "unrealized_plpc": "-0.06",
    }

    class FakeResponse:
        status_code = 200

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    def fake_get(url, **kwargs):
        if url.endswith("/v2/orders"):
            return FakeResponse([{
                "id": "manual-stop",
                "client_order_id": "manual-order",
                "symbol": "AAPL",
                "side": "sell",
                "type": "stop",
                "status": "new",
                "qty": "10",
                "stop_price": "95",
            }])
        if url.endswith("/v2/account"):
            return FakeResponse({
                "equity": "100000",
                "last_equity": "100000",
                "buying_power": "50000",
            })
        raise AssertionError("unexpected broker request %s" % url)

    monkeypatch.setattr(
        backend,
        "_pa_fetch_positions_for_mode",
        lambda uid, mode: ([position], None),
    )
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda uid, mode: {
            "api_key": "P" * 24,
            "api_secret": "S" * 40,
            "base_url": "https://paper.example.com",
        },
    )
    monkeypatch.setattr(backend.requests, "get", fake_get)
    monkeypatch.setattr(
        backend.requests,
        "delete",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("external order must never be canceled")
        ),
    )
    monkeypatch.setattr(
        backend,
        "_pa_call_endpoint",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("blocked exit must not submit")
        ),
    )
    monkeypatch.setattr(
        backend,
        "_pa_fetch_exit_market_context",
        lambda uid, symbols, mode: ({
            "AAPL": {"indicators": {
                "price": 94,
                "atr14": 2,
                "trendState": "downtrend",
                "quoteTime": "2026-07-13T14:00:00Z",
                "quoteAgeSeconds": 1,
                "historyDays": 180,
            }},
            "SPY": {"indicators": {"trendState": "mixed"}},
        }, {"source": "test"}),
    )
    monkeypatch.setattr(
        backend,
        "_pa_get_managed_position_plan",
        lambda uid, mode, symbol: {
            "symbol": symbol,
            "initialStop": 95,
            "currentStop": 95,
            "takeProfit1": 112,
            "takeProfit2": 118,
            "initialRiskPerShare": 5,
            "highWaterMark": 103,
            "createdAt": "2026-07-10T14:00:00Z",
        },
    )
    monkeypatch.setattr(backend, "_pa_update_managed_position", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"mode": "ai"})
    monkeypatch.setattr(
        backend,
        "_pa_exit_ai_challenge",
        lambda uid, signals, enabled=True: {"used": False, "status": "disabled"},
    )

    summary = backend._pa_exit_scan_headless(
        "user-1", [], "ai", trade_mode="paper", run_id="run-external", ai_review=False,
    )

    assert summary["signals"][0]["action"] == "manual_intervention"
    assert summary["signals"][0]["status"] == "blocked_external_order"
    assert "will not be canceled" in summary["signals"][0]["reason"]


def test_exit_ai_cannot_delay_emergency_exit(monkeypatch):
    signals = [
        {
            "symbol": "AAPL",
            "action": "emergency_exit",
            "reason": "Price breached stop",
            "plPct": -8,
        },
        {
            "symbol": "MSFT",
            "action": "hold",
            "reason": "Inside validated range",
            "plPct": 1,
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
                                    "decision": "HOLD",
                                    "confidence": 100,
                                    "reason": "Try waiting",
                                    "nextCheck": "Later",
                                },
                                {
                                    "symbol": "MSFT",
                                    "decision": "REDUCE_REVIEW",
                                    "confidence": 70,
                                    "reason": "Thesis weakening",
                                    "nextCheck": "Review volume",
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

    stats = backend._pa_exit_ai_challenge("test-user", signals, enabled=True)

    assert stats["reviewedSymbols"] == 2
    assert signals[0]["action"] == "emergency_exit"
    assert signals[0]["aiExitReview"]["decision"] == "REVIEW_EXIT"
    assert signals[1]["action"] == "hold"
    assert signals[1]["aiReviewRequired"] is True
