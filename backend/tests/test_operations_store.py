import json
from pathlib import Path

import pytest


from operations_store import (
    OperationsStore,
    OperationsStoreUnavailable,
    OperationsVersionConflict,
)


def local_store(tmp_path):
    return OperationsStore(
        allow_local_fallback=True,
        fallback_path=tmp_path / "operations-store.json",
    )


def test_local_safety_is_user_scoped_idempotent_and_preserves_protection(tmp_path):
    store = local_store(tmp_path)

    first = store.update_safety(
        "user-a",
        pause_new_entries=True,
        cancel_pending_entry_orders=True,
        reason="manual safety pause",
        idempotency_key="pause-request-1",
        expected_version=0,
    )
    repeated = store.update_safety(
        "user-a",
        pause_new_entries=True,
        cancel_pending_entry_orders=True,
        reason="manual safety pause",
        idempotency_key="pause-request-1",
        expected_version=0,
    )

    assert first == repeated
    assert first["version"] == 1
    assert first["keep_protective_exits"] is True
    assert store.get_safety("user-b")["pause_new_entries"] is False

    with pytest.raises(OperationsVersionConflict):
        store.update_safety(
            "user-a",
            pause_new_entries=False,
            idempotency_key="resume-request-1",
            expected_version=0,
        )


def test_cancel_pending_flag_requires_pause(tmp_path):
    store = local_store(tmp_path)
    with pytest.raises(ValueError, match="only be canceled while new entries are paused"):
        store.update_safety(
            "user-a",
            pause_new_entries=False,
            cancel_pending_entry_orders=True,
            idempotency_key="invalid",
        )


def test_append_only_events_are_idempotent_and_user_scoped(tmp_path):
    store = local_store(tmp_path)
    audit = store.append_audit(
        "user-a",
        event_type="safety_state_changed",
        idempotency_key="audit-1",
        payload={"pause": True},
    )
    duplicate = store.append_audit(
        "user-a",
        event_type="safety_state_changed",
        idempotency_key="audit-1",
        payload={"pause": False},
    )
    store.append_audit(
        "user-b",
        event_type="safety_state_changed",
        idempotency_key="audit-1",
    )
    order = store.append_order_event(
        "user-a",
        order_id="order-1",
        broker_event_id="broker-update-1",
        event_type="fill",
        status="filled",
        payload={"filledQty": 2},
        idempotency_key="order-event-1",
    )
    delivery = store.append_notification(
        "user-a",
        channel="discord",
        event_type="order",
        status="sent",
        idempotency_key="notification-1",
    )

    assert audit == duplicate
    assert duplicate["payload"] == {"pause": True}
    assert len(store.list_audit("user-a")) == 1
    assert len(store.list_audit("user-b")) == 1
    assert store.list_order_events("user-a", order_id="order-1") == [order]
    assert store.list_notifications("user-a", status="sent") == [delivery]


def test_readiness_merges_checks_and_computes_completion(tmp_path):
    store = local_store(tmp_path)
    first = store.update_readiness(
        "user-a",
        checks={"auth": "ready", "broker": "missing"},
        blocking_reasons=["Connect a broker"],
        idempotency_key="readiness-1",
        expected_version=0,
    )
    second = store.update_readiness(
        "user-a",
        checks={"broker": "connected"},
        blocking_reasons=[],
        idempotency_key="readiness-2",
        expected_version=1,
    )

    assert first["completion_percent"] == 50
    assert second["completion_percent"] == 100
    assert second["checks"] == {"auth": "ready", "broker": "connected"}


def test_artifact_crud_is_versioned_scoped_and_persisted(tmp_path):
    path = tmp_path / "operations-store.json"
    store = OperationsStore(allow_local_fallback=True, fallback_path=path)
    created = store.put_artifact(
        "user-a", "backtest", "session-1",
        payload={"symbol": "AAPL"},
        idempotency_key="save-1",
        expected_version=0,
    )
    repeated = store.put_artifact(
        "user-a", "backtest", "session-1",
        payload={"symbol": "MSFT"},
        idempotency_key="save-1",
        expected_version=0,
    )
    updated = store.put_artifact(
        "user-a", "backtest", "session-1",
        payload={"symbol": "MSFT"},
        idempotency_key="save-2",
        expected_version=1,
    )

    assert repeated == created
    assert updated["version"] == 2
    assert store.get_artifact("user-b", "backtest", "session-1") is None
    assert json.loads(path.read_text(encoding="utf-8"))["artifacts"]

    restored = OperationsStore(allow_local_fallback=True, fallback_path=path)
    assert restored.get_artifact("user-a", "backtest", "session-1")["payload"] == {"symbol": "MSFT"}
    assert restored.delete_artifact(
        "user-a", "backtest", "session-1", expected_version=2,
    ) is True
    assert restored.get_artifact("user-a", "backtest", "session-1") is None


def test_production_never_silently_falls_back():
    store = OperationsStore(supabase_client=None, allow_local_fallback=False)
    assert store.backend == "unavailable"
    with pytest.raises(OperationsStoreUnavailable):
        store.get_safety("user-a")


def test_operations_migration_has_owner_rls_append_only_event_policies_and_grants():
    sql = (Path(__file__).parents[1] / "supabase_operations_store.sql").read_text(encoding="utf-8")

    for table in (
        "user_operations_safety_state",
        "user_operations_audit_events",
        "user_notification_delivery_events",
        "user_order_lifecycle_events",
        "user_readiness_status",
        "user_operation_artifacts",
    ):
        assert "ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY" % table in sql
    assert "USING ((SELECT auth.uid()) = user_id)" in sql
    assert "WITH CHECK ((SELECT auth.uid()) = user_id)" not in sql
    assert "TO authenticated" in sql
    assert "TO service_role" in sql
    assert "keep_protective_exits IS TRUE" in sql
    assert "UPDATE own operations audit" not in sql
    assert "DELETE own operations audit" not in sql
    for policy in (
        "Users can append own operations audit",
        "Users can append own notification history",
        "Users can append own order lifecycle",
    ):
        assert 'CREATE POLICY "%s"' % policy not in sql
    for table in (
        "user_operations_audit_events",
        "user_notification_delivery_events",
        "user_order_lifecycle_events",
    ):
        assert "GRANT SELECT ON TABLE public.%s TO authenticated" % table in sql
        assert "REVOKE ALL ON TABLE public.%s FROM anon, authenticated" % table in sql


def test_operations_endpoints_are_authenticated_scoped_and_idempotent(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-a", "aal": "aal2"})

    client = backend.app.test_client()
    default_response = client.get("/api/operations/safety")
    assert default_response.status_code == 200
    assert default_response.get_json()["state"]["pauseNewEntries"] is False

    pause_payload = {
        "pauseNewEntries": True,
        "cancelPendingEntryOrders": False,
        "reason": "operator pause",
        "expectedVersion": 0,
        "idempotencyKey": "pause-api-1",
    }
    paused = client.patch("/api/operations/safety", json=pause_payload)
    repeated = client.patch("/api/operations/safety", json=pause_payload)
    assert paused.status_code == 200
    assert repeated.status_code == 200
    assert paused.get_json()["state"]["version"] == 1
    assert repeated.get_json()["state"]["version"] == 1

    readiness = client.patch("/api/operations/readiness", json={
        "checks": {"broker": "connected", "risk": "ready"},
        "blockingReasons": [],
        "expectedVersion": 0,
        "idempotencyKey": "readiness-api-1",
    })
    assert readiness.status_code == 200
    assert readiness.get_json()["readiness"]["completionPercent"] == 100

    artifact = client.put("/api/operations/artifacts", json={
        "artifactType": "watchlist",
        "artifactKey": "primary",
        "payload": {"symbols": ["AAPL"]},
        "expectedVersion": 0,
        "idempotencyKey": "artifact-api-1",
    })
    assert artifact.status_code == 200
    assert artifact.get_json()["artifact"]["version"] == 1
    loaded = client.get(
        "/api/operations/artifacts?artifactType=watchlist&artifactKey=primary"
    )
    assert loaded.get_json()["artifact"]["payload"] == {"symbols": ["AAPL"]}


def test_global_pause_blocks_buys_but_not_protective_sells(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    store.update_safety(
        "user-a",
        pause_new_entries=True,
        reason="emergency pause",
        idempotency_key="pause-1",
    )
    monkeypatch.setattr(backend, "operations_store", store)

    blocked = backend._operations_entry_pause_block("user-a", "real")
    assert blocked["code"] == "new_entries_paused"
    # The gate is called only by BUY paths; SELL/protective paths remain live.
    assert store.get_safety("user-a")["keep_protective_exits"] is True


def test_cancel_pending_entries_only_cancels_owned_unfilled_buy_parents(monkeypatch):
    import start_quant_backend as backend

    class Response:
        def __init__(self, status_code, payload=None):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    orders = [
        {
            "id": "entry-1", "side": "buy", "status": "new", "filled_qty": "0",
            "client_order_id": "alphalab-entry-AAPL-abc", "symbol": "AAPL",
        },
        {
            "id": "partial-1", "side": "buy", "status": "partially_filled", "filled_qty": "1",
            "client_order_id": "alphalab-entry-MSFT-def", "symbol": "MSFT",
        },
        {
            "id": "protective-stop", "side": "sell", "type": "stop", "status": "new",
            "filled_qty": "0", "client_order_id": "alphalab-run-AAPL-stop", "symbol": "AAPL",
        },
        {
            "id": "external-buy", "side": "buy", "status": "new", "filled_qty": "0",
            "client_order_id": "outside-platform-order", "symbol": "NVDA",
        },
    ]
    deleted = []
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda mode: ({"api_key": "key", "api_secret": "secret", "base_url": "https://broker"}, "ok"),
    )
    monkeypatch.setattr(backend.requests, "get", lambda *args, **kwargs: Response(200, orders))
    monkeypatch.setattr(
        backend.requests,
        "delete",
        lambda url, **kwargs: deleted.append(url.rsplit("/", 1)[-1]) or Response(204),
    )
    monkeypatch.setattr(backend, "_record_order_lifecycle", lambda *args, **kwargs: None)

    summary = backend._operations_cancel_pending_entries("user-a", "real")

    assert deleted == ["entry-1"]
    assert summary["canceledOrderIds"] == ["entry-1"]
    assert set(summary["skippedOrderIds"]) == {"partial-1", "protective-stop", "external-buy"}
    assert summary["protectiveExitsPreserved"] is True


def test_legacy_ai_order_path_enforces_pause_and_records_submission(monkeypatch, tmp_path):
    import start_quant_backend as backend

    class Response:
        status_code = 200
        text = '{"id":"order-legacy-1","status":"new"}'

        @staticmethod
        def json():
            return {
                "id": "order-legacy-1",
                "status": "new",
                "client_order_id": "alphalab-entry-AAPL-legacy",
            }

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-a"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config",
        lambda *args, **kwargs: ({
            "api_key": "key", "api_secret": "secret", "base_url": "https://broker",
        }, "user"),
    )
    submitted = []
    monkeypatch.setattr(
        backend.requests,
        "post",
        lambda *args, **kwargs: submitted.append(kwargs.get("json")) or Response(),
    )
    client = backend.app.test_client()
    payload = {"symbol": "AAPL", "side": "buy", "qty": 1, "type": "market", "mode": "paper"}

    store.update_safety(
        "user-a", pause_new_entries=True, reason="operator pause", idempotency_key="pause",
    )
    blocked = client.post("/api/ai/alpaca/orders", json=payload)
    assert blocked.status_code == 423
    assert blocked.get_json()["code"] == "new_entries_paused"
    assert submitted == []

    store.update_safety(
        "user-a", pause_new_entries=False, reason="resume", idempotency_key="resume",
    )
    accepted = client.post("/api/ai/alpaca/orders", json=payload)
    assert accepted.status_code == 200
    assert len(submitted) == 1
    assert submitted[0]["client_order_id"].startswith("alphalab-entry-")
    assert len(submitted[0]["client_order_id"]) <= 48
    events = store.list_order_events("user-a", order_id="order-legacy-1")
    assert len(events) == 1
    assert events[0]["event_type"] == "submitted"


def test_manual_cancel_path_appends_lifecycle_event(monkeypatch, tmp_path):
    import start_quant_backend as backend

    class Response:
        status_code = 204
        text = ""

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-a"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda mode: ({
            "api_key": "test-api-key", "api_secret": "test-api-secret", "base_url": "https://broker",
        }, "ok"),
    )
    monkeypatch.setattr(backend.requests, "delete", lambda *args, **kwargs: Response())

    response = backend.app.test_client().post(
        "/api/trading/orders/order-1/cancel", json={"mode": "paper"},
    )

    assert response.status_code == 200
    events = store.list_order_events("user-a", order_id="order-1")
    assert len(events) == 1
    assert events[0]["event_type"] == "cancel_requested"


def test_real_buy_fails_closed_until_durable_safety_is_initialized(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-a", "aal": "aal2"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config",
        lambda *args, **kwargs: pytest.fail("broker config must not be read while safety is uninitialized"),
    )
    client = backend.app.test_client()
    payload = {
        "symbol": "AAPL", "side": "buy", "qty": 1, "type": "market",
        "mode": "real", "confirmed": True,
    }

    blocked = client.post("/api/ai/alpaca/orders", json=payload)

    assert blocked.status_code == 409
    assert blocked.get_json()["code"] == "entry_plan_required"
    assert backend._operations_buy_submission_block("user-a", "paper") is None
    store.update_safety(
        "user-a", pause_new_entries=False, idempotency_key="initialize-safety",
        expected_version=0,
    )
    assert backend._operations_buy_submission_block("user-a", "real") is None


def test_execution_modes_are_strict_and_live_alias_is_canonical(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    store.update_safety(
        "user-a", pause_new_entries=False, idempotency_key="initialize-safety",
        expected_version=0,
    )
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-a", "aal": "aal2"})
    client = backend.app.test_client()
    base = {
        "symbol": "AAPL", "side": "buy", "qty": 1, "type": "market",
        "automationMode": "full-ai", "confirmed": False,
    }

    invalid_mode = client.post(
        "/api/ai/execution/order", json={**base, "tradingMode": "production-ish"},
    )
    invalid_automation = client.post(
        "/api/ai/execution/order",
        json={**base, "tradingMode": "paper", "automationMode": "automatic"},
    )
    live_alias = client.post(
        "/api/ai/execution/order", json={**base, "tradingMode": "live"},
    )

    assert invalid_mode.status_code == 400
    assert invalid_mode.get_json()["status"] == "validation_error"
    assert invalid_automation.status_code == 400
    assert invalid_automation.get_json()["status"] == "validation_error"
    assert live_alias.status_code == 409
    assert live_alias.get_json()["code"] == "entry_plan_required"
    assert backend._operations_normalize_trading_mode("live") == "real"


def test_buy_rechecks_safety_immediately_before_broker_post(monkeypatch):
    import start_quant_backend as backend

    class Response:
        status_code = 201
        text = "{}"

        @staticmethod
        def json():
            return {"id": "must-not-submit"}

    checks = iter([
        None,
        {"code": "new_entries_paused", "message": "Paused after validation."},
    ])
    monkeypatch.setattr(
        backend, "_operations_buy_submission_block", lambda *args, **kwargs: next(checks),
    )
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-a"})
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config",
        lambda *args, **kwargs: ({
            "api_key": "key", "api_secret": "secret", "base_url": "https://broker",
        }, "user"),
    )
    submitted = []
    monkeypatch.setattr(
        backend.requests, "post",
        lambda *args, **kwargs: submitted.append(kwargs.get("json")) or Response(),
    )

    response = backend.app.test_client().post("/api/ai/alpaca/orders", json={
        "symbol": "AAPL", "side": "buy", "qty": 1, "type": "market", "mode": "paper",
    })

    assert response.status_code == 423
    assert response.get_json()["code"] == "new_entries_paused"
    assert submitted == []


def test_order_and_notification_event_posts_are_server_only(monkeypatch):
    import start_quant_backend as backend

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-a"})
    client = backend.app.test_client()

    assert client.post("/api/operations/orders/events", json={}).status_code == 405
    assert client.post("/api/operations/notifications/history", json={}).status_code == 405


def test_safety_patch_reports_partial_failure_when_broker_cancel_fails(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-a", "aal": "aal2"})
    monkeypatch.setattr(
        backend,
        "_operations_cancel_pending_entries",
        lambda *args, **kwargs: {
            "requested": True, "mode": "paper", "canceledOrderIds": [],
            "skippedOrderIds": [], "failed": [{"reason": "broker_read_failed"}],
        },
    )

    response = backend.app.test_client().patch("/api/operations/safety", json={
        "pauseNewEntries": True,
        "cancelPendingEntryOrders": True,
        "expectedVersion": 0,
        "idempotencyKey": "pause-and-cancel",
        "mode": "paper",
    })

    assert response.status_code == 207
    assert response.get_json()["success"] is False
    assert response.get_json()["partialSuccess"] is True
    assert response.get_json()["state"]["pauseNewEntries"] is True


def test_artifact_audit_idempotency_key_includes_artifact_key(monkeypatch, tmp_path):
    import start_quant_backend as backend

    store = local_store(tmp_path)
    monkeypatch.setattr(backend, "operations_store", store)
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-a"})
    audit_keys = []
    monkeypatch.setattr(
        backend, "_record_operations_audit",
        lambda user_id, event_type, idempotency_key, **kwargs: audit_keys.append(idempotency_key),
    )
    client = backend.app.test_client()

    for key in ("primary", "secondary"):
        response = client.put("/api/operations/artifacts", json={
            "artifactType": "watchlist",
            "artifactKey": key,
            "payload": {"symbols": ["AAPL"]},
            "expectedVersion": 0,
            "idempotencyKey": "save-%s" % key,
        })
        assert response.status_code == 200

    assert len(audit_keys) == 2
    assert audit_keys[0] != audit_keys[1]


def test_operations_request_body_has_a_hard_size_limit(monkeypatch):
    import start_quant_backend as backend

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-a"})
    response = backend.app.test_client().put(
        "/api/operations/artifacts",
        data=b"x" * (backend.OPERATIONS_MAX_BODY_BYTES + 1),
        content_type="application/json",
    )

    assert response.status_code == 413
    assert response.get_json()["status"] == "payload_too_large"


def test_managed_buy_client_order_ids_are_recognizable_and_bounded():
    import start_quant_backend as backend

    generated = backend._operations_managed_buy_client_order_id(
        "user-a", "BRK.B", "caller-provided-id",
    )
    preserved = backend._operations_managed_buy_client_order_id(
        "user-a", "AAPL", "alphalab-entry-AAPL-existing",
    )

    assert generated.startswith("alphalab-entry-BRKB-")
    assert len(generated) <= 48
    assert preserved == "alphalab-entry-AAPL-existing"
