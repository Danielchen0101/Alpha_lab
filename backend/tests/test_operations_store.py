import json
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

import pytest
from postgrest.types import CountMethod, ReturnMethod


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


class RecordingQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.action = ""
        self.projection = None
        self.payload = None
        self.options = {}
        self.filters = []
        self.ordering = None
        self.limit_value = None
        self.range_value = None
        self.retry_enabled = None

    def select(self, projection):
        self.action = "select"
        self.projection = projection
        return self

    def insert(self, payload, **options):
        self.action = "insert"
        self.payload = payload
        self.options = options
        return self

    def update(self, payload, **options):
        self.action = "update"
        self.payload = payload
        self.options = options
        return self

    def upsert(self, payload, **options):
        self.action = "upsert"
        self.payload = payload
        self.options = options
        return self

    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self

    def contains(self, field, value):
        self.filters.append(("contains", field, value))
        return self

    def order(self, field, **options):
        self.ordering = (field, options)
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def range(self, start, end):
        self.range_value = (start, end)
        return self

    def retry(self, enabled):
        self.retry_enabled = enabled
        return self

    def execute(self):
        self.client.queries.append(self)
        if not self.client.responses:
            raise AssertionError("No mock Supabase response remains")
        response = self.client.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


class RecordingSupabase:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.queries = []

    def table(self, name):
        return RecordingQuery(self, name)


class FakePostgrestError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


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


def test_supabase_artifact_insert_reads_only_metadata_and_returns_local_canonical_row():
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        SimpleNamespace(data=[], count=1),
    )
    store = OperationsStore(supabase_client=client)

    created = store.put_artifact(
        "user-a",
        "kalshi_robot_state",
        "current",
        payload={"enabled": True, "large": "x" * 1000},
        idempotency_key="insert-1",
        expected_version=0,
    )

    metadata_query, insert_query = client.queries
    assert metadata_query.projection == "id,created_at,version,last_idempotency_key"
    assert ("eq", "user_id", "user-a") in metadata_query.filters
    assert insert_query.action == "insert"
    assert insert_query.options == {
        "returning": ReturnMethod.minimal,
        "count": CountMethod.exact,
    }
    assert created == insert_query.payload
    assert str(UUID(created["id"])) == created["id"]
    assert created["version"] == 1
    assert created["payload"]["large"] == "x" * 1000


def test_supabase_artifact_update_uses_minimal_exact_and_preserves_created_at():
    client = RecordingSupabase(
        SimpleNamespace(
            data=[{
                "id": "artifact-id-3",
                "created_at": "2026-07-25T12:00:00+00:00",
                "version": 3,
                "last_idempotency_key": "previous",
            }],
            count=None,
        ),
        SimpleNamespace(data=[], count=1),
    )
    store = OperationsStore(supabase_client=client)

    updated = store.put_artifact(
        "user-a",
        "crypto_config",
        "primary",
        payload={"enabled": True},
        idempotency_key="update-4",
        expected_version=3,
    )

    metadata_query, update_query = client.queries
    assert metadata_query.projection == "id,created_at,version,last_idempotency_key"
    assert update_query.options == {
        "returning": ReturnMethod.minimal,
        "count": CountMethod.exact,
    }
    assert ("eq", "version", 3) in update_query.filters
    assert updated == update_query.payload
    assert updated["id"] == "artifact-id-3"
    assert updated["created_at"] == "2026-07-25T12:00:00+00:00"
    assert updated["version"] == 4


def test_supabase_artifact_update_count_zero_is_a_cas_conflict():
    client = RecordingSupabase(
        SimpleNamespace(
            data=[{
                "id": "artifact-id-2",
                "created_at": "2026-07-25T12:00:00+00:00",
                "version": 2,
                "last_idempotency_key": "previous",
            }],
            count=None,
        ),
        SimpleNamespace(data=[], count=0),
        SimpleNamespace(data=[], count=None),
    )
    store = OperationsStore(supabase_client=client)

    with pytest.raises(OperationsVersionConflict, match="changed concurrently"):
        store.put_artifact(
            "user-a",
            "crypto_runtime",
            "primary",
            payload={"status": "armed"},
            idempotency_key="update-3",
            expected_version=2,
        )

    assert client.queries[1].options["returning"] is ReturnMethod.minimal
    assert client.queries[1].options["count"] is CountMethod.exact
    assert client.queries[2].projection == "*"
    assert ("eq", "version", 3) in client.queries[2].filters
    assert ("eq", "last_idempotency_key", "update-3") in client.queries[2].filters


def test_supabase_artifact_update_count_zero_recovers_a_committed_retry():
    canonical = {
        "id": "artifact-id-4",
        "user_id": "user-a",
        "artifact_type": "crypto_runtime",
        "artifact_key": "primary",
        "payload": {"status": "armed"},
        "version": 4,
        "created_at": "2026-07-25T12:00:00+00:00",
        "updated_at": "2026-07-25T12:01:00+00:00",
        "last_idempotency_key": "update-4",
    }
    client = RecordingSupabase(
        SimpleNamespace(data=[{
            "id": canonical["id"],
            "created_at": canonical["created_at"],
            "version": 3,
            "last_idempotency_key": "previous",
        }], count=None),
        SimpleNamespace(data=[], count=0),
        SimpleNamespace(data=[canonical], count=None),
    )
    store = OperationsStore(supabase_client=client)

    recovered = store.put_artifact(
        "user-a",
        "crypto_runtime",
        "primary",
        payload={"status": "armed"},
        idempotency_key="update-4",
        expected_version=3,
    )

    assert recovered == canonical
    recovery_query = client.queries[2]
    assert recovery_query.projection == "*"
    assert ("eq", "version", 4) in recovery_query.filters
    assert ("eq", "last_idempotency_key", "update-4") in recovery_query.filters


def test_supabase_artifact_update_exception_recovers_committed_write():
    canonical = {
        "id": "artifact-id-2",
        "user_id": "user-a",
        "artifact_type": "crypto_config",
        "artifact_key": "primary",
        "payload": {"enabled": True},
        "version": 2,
        "created_at": "2026-07-25T12:00:00+00:00",
        "updated_at": "2026-07-25T12:01:00+00:00",
        "last_idempotency_key": "update-2",
    }
    client = RecordingSupabase(
        SimpleNamespace(data=[{
            "id": canonical["id"],
            "created_at": canonical["created_at"],
            "version": 1,
            "last_idempotency_key": "previous",
        }], count=None),
        TimeoutError("response lost after commit"),
        SimpleNamespace(data=[canonical], count=None),
    )
    store = OperationsStore(supabase_client=client)

    assert store.put_artifact(
        "user-a",
        "crypto_config",
        "primary",
        payload={"enabled": True},
        idempotency_key="update-2",
        expected_version=1,
    ) == canonical


def test_supabase_artifact_missing_count_recovers_committed_write():
    canonical = {
        "id": "artifact-id-2",
        "user_id": "user-a",
        "artifact_type": "backtest",
        "artifact_key": "session-1",
        "payload": {"symbol": "AAPL"},
        "version": 2,
        "created_at": "2026-07-25T12:00:00+00:00",
        "updated_at": "2026-07-25T12:01:00+00:00",
        "last_idempotency_key": "update-2",
    }
    client = RecordingSupabase(
        SimpleNamespace(data=[{
            "id": canonical["id"],
            "created_at": canonical["created_at"],
            "version": 1,
            "last_idempotency_key": "previous",
        }], count=None),
        SimpleNamespace(data=[], count=None),
        SimpleNamespace(data=[canonical], count=None),
    )
    store = OperationsStore(supabase_client=client)

    assert store.put_artifact(
        "user-a",
        "backtest",
        "session-1",
        payload={"symbol": "AAPL"},
        idempotency_key="update-2",
        expected_version=1,
    ) == canonical


def test_supabase_artifact_insert_count_zero_is_a_cas_conflict():
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        SimpleNamespace(data=[], count=0),
        SimpleNamespace(data=[], count=None),
    )
    store = OperationsStore(supabase_client=client)

    with pytest.raises(OperationsVersionConflict, match="changed concurrently"):
        store.put_artifact(
            "user-a",
            "kalshi_robot_state",
            "current",
            payload={"enabled": True},
            idempotency_key="insert-1",
            expected_version=0,
        )

    assert client.queries[1].action == "insert"
    assert client.queries[1].options == {
        "returning": ReturnMethod.minimal,
        "count": CountMethod.exact,
    }
    assert ("eq", "version", 1) in client.queries[2].filters
    assert ("eq", "last_idempotency_key", "insert-1") in client.queries[2].filters


def test_supabase_artifact_insert_unique_conflict_recovers_committed_write():
    canonical = {
        "id": "artifact-id-1",
        "user_id": "user-a",
        "artifact_type": "kalshi_robot_state",
        "artifact_key": "current",
        "payload": {"enabled": True},
        "version": 1,
        "created_at": "2026-07-25T12:00:00+00:00",
        "updated_at": "2026-07-25T12:00:00+00:00",
        "last_idempotency_key": "insert-1",
    }
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        FakePostgrestError("23505", "duplicate key after response loss"),
        SimpleNamespace(data=[canonical], count=None),
    )
    store = OperationsStore(supabase_client=client)

    recovered = store.put_artifact(
        "user-a",
        "kalshi_robot_state",
        "current",
        payload={"enabled": True},
        idempotency_key="insert-1",
        expected_version=0,
    )

    assert recovered == canonical
    assert ("eq", "version", 1) in client.queries[2].filters
    assert ("eq", "last_idempotency_key", "insert-1") in client.queries[2].filters


def test_supabase_artifact_insert_unique_conflict_with_different_key_is_cas_conflict():
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        FakePostgrestError("23505", "concurrent artifact insert"),
        SimpleNamespace(data=[], count=None),
    )
    store = OperationsStore(supabase_client=client)

    with pytest.raises(OperationsVersionConflict, match="changed concurrently"):
        store.put_artifact(
            "user-a",
            "kalshi_robot_state",
            "current",
            payload={"enabled": True},
            idempotency_key="our-insert",
            expected_version=0,
        )

    recovery_query = client.queries[2]
    assert ("eq", "version", 1) in recovery_query.filters
    assert ("eq", "last_idempotency_key", "our-insert") in recovery_query.filters


def test_supabase_artifact_write_exception_is_preserved_when_recovery_misses():
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        TimeoutError("request failed before commit"),
        SimpleNamespace(data=[], count=None),
    )
    store = OperationsStore(supabase_client=client)

    with pytest.raises(OperationsStoreUnavailable, match="artifact insert failed"):
        store.put_artifact(
            "user-a",
            "backtest",
            "session-1",
            payload={"symbol": "AAPL"},
            idempotency_key="insert-1",
            expected_version=0,
        )


def test_supabase_artifact_write_fails_closed_without_exact_count():
    client = RecordingSupabase(
        SimpleNamespace(data=[], count=None),
        SimpleNamespace(data=[], count=None),
        SimpleNamespace(data=[], count=None),
    )
    store = OperationsStore(supabase_client=client)

    with pytest.raises(OperationsStoreUnavailable, match="exact affected-row count"):
        store.put_artifact(
            "user-a",
            "backtest",
            "session-1",
            payload={"symbol": "AAPL"},
            idempotency_key="insert-1",
            expected_version=0,
        )


def test_supabase_artifact_idempotent_replay_conditionally_reads_canonical_row():
    canonical = {
        "user_id": "user-a",
        "id": "artifact-id-7",
        "artifact_type": "backtest",
        "artifact_key": "session-1",
        "payload": {"symbol": "AAPL"},
        "version": 7,
        "created_at": "2026-07-25T12:00:00+00:00",
        "updated_at": "2026-07-25T12:01:00+00:00",
        "last_idempotency_key": "save-7",
    }
    client = RecordingSupabase(
        SimpleNamespace(
            data=[{
                "id": canonical["id"],
                "created_at": canonical["created_at"],
                "version": canonical["version"],
                "last_idempotency_key": canonical["last_idempotency_key"],
            }],
            count=None,
        ),
        SimpleNamespace(data=[canonical], count=None),
    )
    store = OperationsStore(supabase_client=client)

    replayed = store.put_artifact(
        "user-a",
        "backtest",
        "session-1",
        payload={"symbol": "MSFT"},
        idempotency_key="save-7",
        expected_version=0,
    )

    metadata_query, canonical_query = client.queries
    assert metadata_query.projection == "id,created_at,version,last_idempotency_key"
    assert canonical_query.projection == "*"
    assert ("eq", "version", 7) in canonical_query.filters
    assert ("eq", "last_idempotency_key", "save-7") in canonical_query.filters
    assert replayed == canonical
    assert replayed["payload"] == {"symbol": "AAPL"}


def test_scheduler_user_scan_filters_json_server_side_and_projects_only_user_id():
    client = RecordingSupabase(
        SimpleNamespace(data=[{"user_id": "user-a"}, {"user_id": "user-b"}], count=None),
    )
    store = OperationsStore(supabase_client=client)

    users = store.list_scheduler_artifact_user_ids(
        "kalshi_robot_state",
        "current",
        payload_contains={"enabled": True},
        limit=500,
    )

    query = client.queries[0]
    assert users == ["user-a", "user-b"]
    assert query.projection == "user_id"
    assert ("contains", "payload", {"enabled": True}) in query.filters
    assert query.ordering == ("updated_at", {"desc": True})
    assert query.limit_value == 500
    assert query.retry_enabled is False


def test_local_scheduler_user_scan_preserves_json_boolean_types(tmp_path):
    store = local_store(tmp_path)
    store.put_artifact(
        "numeric-user",
        "kalshi_robot_state",
        "current",
        payload={"enabled": 1},
        idempotency_key="numeric",
        expected_version=0,
    )
    store.put_artifact(
        "enabled-user",
        "kalshi_robot_state",
        "current",
        payload={"enabled": True},
        idempotency_key="boolean",
        expected_version=0,
    )

    assert store.list_scheduler_artifact_user_ids(
        "kalshi_robot_state",
        "current",
        payload_contains={"enabled": True},
        limit=500,
    ) == ["enabled-user"]


def test_kalshi_enabled_user_enumeration_uses_filtered_id_only_store_contract(monkeypatch):
    import start_quant_backend as backend

    captured = {}

    class Store:
        def list_scheduler_artifact_user_ids(
            self,
            artifact_type,
            artifact_key,
            *,
            payload_contains,
            limit,
        ):
            captured.update({
                "artifact_type": artifact_type,
                "artifact_key": artifact_key,
                "payload_contains": payload_contains,
                "limit": limit,
            })
            return ["user-a", "user-b"]

    monkeypatch.setattr(backend, "operations_store", Store())

    assert backend._kalshi_enabled_users() == ["user-a", "user-b"]
    assert captured == {
        "artifact_type": "kalshi_robot_state",
        "artifact_key": "current",
        "payload_contains": {"enabled": True},
        "limit": 500,
    }


def test_supabase_kalshi_observation_upsert_uses_minimal_and_returns_local_row():
    client = RecordingSupabase(SimpleNamespace(data=[], count=None))
    store = OperationsStore(supabase_client=client)
    observation = {
        "environment": "paper",
        "ticker": "KXBTC15M-TEST",
        "observation_key": "KXBTC15M-TEST:123",
        "observed_at": "2026-07-25T12:00:00Z",
        "action": "WAIT",
        "features": {"model": {"distanceBps": 4.2}},
    }

    saved = store.put_kalshi_observation("user-a", observation)

    query = client.queries[0]
    assert query.action == "upsert"
    assert query.options == {
        "on_conflict": "user_id,environment,observation_key",
        "returning": ReturnMethod.minimal,
    }
    assert saved == query.payload
    assert saved["user_id"] == "user-a"
    assert saved["features"] == observation["features"]


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
    assert UUID(artifact.get_json()["artifact"]["id"])
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


def test_kalshi_observation_upsert_and_worker_lease_use_local_fallback(tmp_path):
    store = local_store(tmp_path)
    observation = {
        "environment": "paper",
        "ticker": "KXBTC15M-TEST",
        "observation_key": "KXBTC15M-TEST:123",
        "observed_at": "2026-07-25T12:00:00Z",
        "action": "WAIT",
        "blocked_reasons": ["net_edge"],
        "features": {"model": {"distanceBps": 4.2}},
    }

    first = store.put_kalshi_observation("user-a", observation)
    second = store.put_kalshi_observation(
        "user-a",
        {**observation, "action": "BUY_YES", "blocked_reasons": []},
    )

    assert first["action"] == "WAIT"
    assert second["action"] == "BUY_YES"
    assert len(store._local["kalshi_observations"]) == 1
    assert store.list_kalshi_observations("user-a", environment="paper") == [second]
    assert store.list_kalshi_observations("user-a", environment="real") == []
    assert store.list_kalshi_observations(
        "user-a", since="2026-07-25T12:00:01Z"
    ) == []
    assert store.claim_worker_lease("kalshi-btc15-robot", "worker-a") is True
    assert store.release_worker_lease("kalshi-btc15-robot", "worker-b") is False
    assert store.release_worker_lease("kalshi-btc15-robot", "worker-a") is True
    assert "kalshi-btc15-robot" not in store._local["worker_leases"]


def test_worker_lease_release_migration_is_owner_checked_and_service_role_only():
    sql = (
        Path(__file__).parents[1]
        / "migrations"
        / "20260725_worker_lease_release.sql"
    ).read_text(encoding="utf-8").lower()

    assert "owner_id = p_owner_id" in sql
    assert "security definer" in sql
    assert "set search_path = public, pg_temp" in sql
    assert "from public, anon, authenticated" in sql
    assert "to service_role" in sql


def test_fenced_worker_lease_generation_is_exact_and_monotonic_locally(tmp_path):
    store = local_store(tmp_path)

    first = store.claim_worker_lease_fenced(
        "crypto-routing:user-a", "worker-a", ttl_seconds=30,
    )
    renewed_claim = store.claim_worker_lease_fenced(
        "crypto-routing:user-a", "worker-a", ttl_seconds=30,
    )

    assert first["acquired"] is True
    assert first["fencingToken"] > 0
    assert renewed_claim["fencingToken"] == first["fencingToken"]
    assert store.claim_worker_lease_fenced(
        "crypto-routing:user-a", "worker-b", ttl_seconds=30,
    )["acquired"] is False
    assert store.renew_worker_lease(
        "crypto-routing:user-a",
        "worker-a",
        first["fencingToken"],
        ttl_seconds=30,
    ) is True
    store._local["worker_leases"]["crypto-routing:user-a"][
        "lease_expires_epoch"
    ] = 0
    assert store.renew_worker_lease(
        "crypto-routing:user-a",
        "worker-a",
        first["fencingToken"],
        ttl_seconds=30,
    ) is False
    replacement = store.claim_worker_lease_fenced(
        "crypto-routing:user-a", "worker-a", ttl_seconds=30,
    )
    assert replacement["fencingToken"] > first["fencingToken"]
    assert store.release_worker_lease(
        "crypto-routing:user-a", "worker-a", first["fencingToken"],
    ) is False
    assert store.release_worker_lease(
        "crypto-routing:user-a", "worker-a", replacement["fencingToken"],
    ) is True

    next_generation = store.claim_worker_lease_fenced(
        "crypto-routing:user-a", "worker-b", ttl_seconds=30,
    )
    assert next_generation["fencingToken"] > replacement["fencingToken"]


def test_worker_lease_hardening_migration_is_rls_safe_and_rolling_compatible():
    root = Path(__file__).parents[1]
    migration = (
        root / "migrations" / "20260726010000_worker_lease_runtime_hardening.sql"
    ).read_text(encoding="utf-8").lower()
    fresh_schema = (root / "supabase_schema.sql").read_text(encoding="utf-8").lower()

    for sql in (migration, fresh_schema):
        assert "create table if not exists public.app_worker_leases" in sql
        assert "alter table public.app_worker_leases enable row level security" in sql
        assert "revoke all on table public.app_worker_leases from public, anon, authenticated" in sql
        assert "fencing_token bigint" in sql
        assert "claim_app_worker_lease_fenced" in sql
        assert "renew_app_worker_lease" in sql
        assert "release_app_worker_lease_fenced" in sql
        assert "and lease_expires_at > statement_timestamp()" in sql
        assert "security invoker" in sql
        assert "to service_role" in sql

    # Legacy rolling-deploy RPC signatures remain available.
    assert "create or replace function public.claim_app_worker_lease(" in migration
    assert "create or replace function public.release_app_worker_lease(" in migration
    assert "p_fencing_token bigint default null" not in migration


def test_remote_fenced_worker_lease_uses_new_rpc_chain():
    calls = []

    class Response:
        def __init__(self, data):
            self.data = data

    class Rpc:
        def __init__(self, name):
            self.name = name

        def execute(self):
            payloads = {
                "claim_app_worker_lease_fenced": {
                    "acquired": True,
                    "fencingToken": 91,
                },
                "renew_app_worker_lease": {
                    "renewed": True,
                    "fencingToken": 91,
                },
                "release_app_worker_lease_fenced": True,
            }
            return Response(payloads[self.name])

    class Client:
        def rpc(self, name, arguments):
            calls.append((name, dict(arguments)))
            return Rpc(name)

    store = OperationsStore(Client())
    claim = store.claim_worker_lease_fenced("lease-a", "owner-a")
    renewed = store.renew_worker_lease(
        "lease-a", "owner-a", claim["fencingToken"],
    )
    released = store.release_worker_lease(
        "lease-a", "owner-a", claim["fencingToken"],
    )

    assert renewed is True
    assert released is True
    assert [name for name, _arguments in calls] == [
        "claim_app_worker_lease_fenced",
        "renew_app_worker_lease",
        "release_app_worker_lease_fenced",
    ]
    assert calls[1][1]["p_fencing_token"] == 91
    assert calls[2][1]["p_fencing_token"] == 91
