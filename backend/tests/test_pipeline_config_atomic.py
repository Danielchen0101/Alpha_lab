from pathlib import Path

import start_quant_backend as backend


BACKEND_ROOT = Path(__file__).parents[1]
ATOMIC_MERGE_MIGRATION = (
    BACKEND_ROOT
    / "migrations"
    / "20260726060000_pipeline_config_atomic_merge.sql"
)
WRITE_AMPLIFICATION_MIGRATION = (
    BACKEND_ROOT.parent
    / "supabase"
    / "migrations"
    / "20260802010716_reduce_runtime_write_amplification.sql"
)
REMOVE_UNUSED_INDEX_MIGRATION = (
    BACKEND_ROOT.parent
    / "supabase"
    / "migrations"
    / "20260802012440_remove_unused_artifact_scheduler_index.sql"
)


class _Response:
    def __init__(self, data):
        self.data = data


class _RpcCall:
    def __init__(self, response):
        self.response = response

    def execute(self):
        return self.response


class _Client:
    def __init__(self):
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return _RpcCall(_Response({"enabled": True, "last_decision": "idle"}))


def test_config_patch_prefers_atomic_supabase_rpc(monkeypatch):
    client = _Client()
    monkeypatch.setattr(backend, "_pa_supabase_client", lambda: client)
    monkeypatch.setattr(
        backend,
        "_supabase_execute",
        lambda operation, _label: operation(),
    )

    saved, reason = backend._pa_patch_config(
        "user-1",
        {"last_decision": "idle"},
        remove_keys=["legacy_runtime_key"],
    )

    assert saved is True
    assert reason == ""
    assert client.calls == [(
        "merge_user_pipeline_auto_config",
        {
            "p_user_id": "user-1",
            "p_patch": {"last_decision": "idle"},
            "p_remove_keys": ["legacy_runtime_key"],
        },
    )]


def test_production_atomic_merge_failure_never_uses_serialized_fallback(
    monkeypatch,
):
    class FailingRpc:
        def execute(self):
            raise RuntimeError(
                "PGRST202 could not find the function "
                "public.merge_user_pipeline_auto_config"
            )

    class Client:
        def rpc(self, _name, _params):
            return FailingRpc()

    monkeypatch.setattr(backend, "_pa_supabase_client", lambda: Client())
    monkeypatch.setattr(
        backend, "_supabase_execute", lambda operation, _label: operation()
    )
    monkeypatch.setattr(
        backend, "_strict_production_runtime", lambda *_args, **_kwargs: True
    )
    monkeypatch.setattr(
        backend,
        "_pa_get_config",
        lambda _uid: (_ for _ in ()).throw(
            AssertionError("non-atomic fallback must not run")
        ),
    )

    saved, reason = backend._pa_patch_config(
        "user-1", {"last_decision": "idle"}
    )

    assert saved is False
    assert reason == "atomic_merge_unavailable"


def test_development_ambiguous_rpc_failure_also_fails_closed(monkeypatch):
    class FailingRpc:
        def execute(self):
            raise TimeoutError("response lost after request")

    class Client:
        def rpc(self, _name, _params):
            return FailingRpc()

    monkeypatch.setattr(backend, "_pa_supabase_client", lambda: Client())
    monkeypatch.setattr(
        backend, "_supabase_execute", lambda operation, _label: operation()
    )
    monkeypatch.setattr(
        backend, "_strict_production_runtime", lambda *_args, **_kwargs: False
    )
    monkeypatch.setattr(
        backend,
        "_pa_get_config",
        lambda _uid: (_ for _ in ()).throw(
            AssertionError("ambiguous failure must not replay")
        ),
    )

    saved, reason = backend._pa_patch_config(
        "user-1", {"last_decision": "idle"}
    )

    assert saved is False
    assert reason == "atomic_merge_unavailable"


def test_serialized_config_patch_preserves_unrelated_and_deep_merges(monkeypatch):
    current = {
        "enabled": True,
        "risk_profile": "low",
        "managed_positions": {
            "paper:AAPL": {"status": "protected"},
        },
        "user_preferences": {
            "risk": {"maxPositionPct": 8, "dailyLossLimitPct": 1.5},
            "appearance": {"density": "compact"},
            "general": {"timezone": "UTC", "currency": "USD"},
            "research": {"maxSymbols": 1500, "outputSize": 100},
            "charts": {"timeframe": "1D", "benchmark": "SPY"},
        },
        "legacy_runtime_key": "remove-me",
    }
    saved_rows = []
    monkeypatch.setattr(backend, "_pa_supabase_client", lambda: None)
    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: current)
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda _uid, config: saved_rows.append(config) or (True, ""),
    )

    saved, reason = backend._pa_patch_config(
        "user-1",
        {
            "last_decision": "pipeline_success",
            "managed_positions": {
                "paper:MSFT": {"status": "entry_submitted"},
            },
            "user_preferences": {
                "risk": {"maxPositionPct": 6},
                "general": {"timezone": "America/New_York"},
                "research": {"outputSize": 50},
                "charts": {"timeframe": "1W"},
            },
        },
        remove_keys=["legacy_runtime_key"],
    )

    assert saved is True
    assert reason == ""
    persisted = saved_rows[0]
    assert persisted["enabled"] is True
    assert persisted["risk_profile"] == "low"
    assert persisted["last_decision"] == "pipeline_success"
    assert set(persisted["managed_positions"]) == {"paper:AAPL", "paper:MSFT"}
    assert persisted["user_preferences"]["risk"] == {
        "maxPositionPct": 6,
        "dailyLossLimitPct": 1.5,
    }
    assert persisted["user_preferences"]["appearance"] == {"density": "compact"}
    assert persisted["user_preferences"]["general"] == {
        "timezone": "America/New_York",
        "currency": "USD",
    }
    assert persisted["user_preferences"]["research"] == {
        "maxSymbols": 1500,
        "outputSize": 50,
    }
    assert persisted["user_preferences"]["charts"] == {
        "timeframe": "1W",
        "benchmark": "SPY",
    }
    assert "legacy_runtime_key" not in persisted


def test_supabase_schema_installs_service_role_only_atomic_merge():
    sql = (
        BACKEND_ROOT / "supabase_schema.sql"
    ).read_text(encoding="utf-8")
    merge_contract = sql[
        sql.index(
            "CREATE OR REPLACE FUNCTION public.merge_user_pipeline_auto_config("
        ):sql.index(
            "REVOKE ALL ON FUNCTION public.merge_user_pipeline_auto_config"
        )
    ]

    assert "merge_user_pipeline_auto_config" in sql
    assert "FOR UPDATE" in sql
    assert "SECURITY INVOKER" in merge_contract
    assert "SECURITY DEFINER" not in merge_contract
    assert "auth.role()" not in merge_contract
    assert "REVOKE ALL ON FUNCTION public.merge_user_pipeline_auto_config" in sql
    assert "GRANT EXECUTE ON FUNCTION public.merge_user_pipeline_auto_config" in sql
    assert "CREATE OR REPLACE FUNCTION public.probe_pipeline_config_atomic_merge()" in sql
    assert "SECURITY INVOKER" in sql
    assert "GRANT EXECUTE ON FUNCTION public.probe_pipeline_config_atomic_merge()" in sql


def test_additive_migration_matches_fresh_atomic_merge_contract():
    schema = (BACKEND_ROOT / "supabase_schema.sql").read_text(encoding="utf-8")
    migration = ATOMIC_MERGE_MIGRATION.read_text(encoding="utf-8")
    start_marker = (
        "CREATE OR REPLACE FUNCTION public.merge_user_pipeline_auto_config("
    )
    end_marker = (
        "GRANT EXECUTE ON FUNCTION "
        "public.merge_user_pipeline_auto_config(UUID, JSONB, TEXT[])\n"
        "  TO service_role;"
    )

    def contract(sql):
        start = sql.index(start_marker)
        end = sql.index(end_marker, start) + len(end_marker)
        return sql[start:end]

    assert contract(migration) == contract(schema)
    assert "FOR UPDATE" in migration
    assert "SECURITY INVOKER" in contract(migration)
    assert "SECURITY DEFINER" not in contract(migration)
    assert "auth.role()" not in contract(migration)
    assert (
        "REVOKE ALL ON FUNCTION "
        "public.merge_user_pipeline_auto_config(UUID, JSONB, TEXT[])"
    ) in migration


def test_atomic_sql_deep_merges_every_object_workspace_section():
    schema = (BACKEND_ROOT / "supabase_schema.sql").read_text(encoding="utf-8")
    migration = ATOMIC_MERGE_MIGRATION.read_text(encoding="utf-8")
    actual_sections = set(backend._WORKSPACE_PREFERENCE_DEFAULTS)

    assert {
        "general",
        "trading",
        "risk",
        "research",
        "charts",
        "notifications",
        "security",
    } <= actual_sections

    for sql in (schema, migration):
        assert (
            "FOR v_preference_key, v_preference_value IN\n"
            "      SELECT key, value\n"
            "      FROM jsonb_each(p_patch->'user_preferences')"
        ) in sql
        assert "IF jsonb_typeof(v_preference_value) = 'object' THEN" in sql
        assert (
            "THEN v_current->'user_preferences'->v_preference_key\n"
            "            ELSE '{}'::JSONB\n"
            "          END || v_preference_value"
        ) in sql


def test_additive_migration_installs_side_effect_free_service_role_probe():
    migration = ATOMIC_MERGE_MIGRATION.read_text(encoding="utf-8")

    assert (
        "CREATE OR REPLACE FUNCTION "
        "public.probe_pipeline_config_atomic_merge()"
    ) in migration
    assert "STABLE" in migration
    assert "SECURITY INVOKER" in migration
    assert "RETURNS TEXT" in migration
    assert "has_function_privilege(" in migration
    assert "'20260726060000_v2'" in migration
    assert (
        "'public.merge_user_pipeline_auto_config(uuid,jsonb,text[])'"
    ) in migration
    assert (
        "REVOKE ALL ON FUNCTION public.probe_pipeline_config_atomic_merge()\n"
        "  FROM PUBLIC, anon, authenticated;"
    ) in migration
    assert (
        "GRANT EXECUTE ON FUNCTION public.probe_pipeline_config_atomic_merge()\n"
        "  TO service_role;"
    ) in migration
    assert "NOTIFY pgrst, 'reload schema';" in migration


def test_deployment_contract_lists_and_verifies_atomic_merge_migration():
    deployment = (
        Path(__file__).parents[2] / "DEPLOYMENT.md"
    ).read_text(encoding="utf-8")
    normalized = " ".join(deployment.split())

    assert "20260726060000_pipeline_config_atomic_merge.sql" in deployment
    assert (
        "public.merge_user_pipeline_auto_config(uuid,jsonb,text[])"
        in normalized
    )
    assert "public.probe_pipeline_config_atomic_merge()" in normalized
    assert "ALPHALAB_DISABLE_BACKGROUND_SERVICES=true" in deployment


def test_runtime_write_amplification_migration_is_bounded_and_side_effect_free():
    sql = WRITE_AMPLIFICATION_MIGRATION.read_text(encoding="utf-8")

    assert "v_merged IS NOT DISTINCT FROM v_current" in sql
    assert "CREATE OR REPLACE FUNCTION public.probe_runtime_dependencies()" in sql
    assert "RETURNS JSONB" in sql
    assert "STABLE" in sql
    assert "SECURITY INVOKER" in sql
    assert "20260802010716_v1" in sql
    assert "NOTIFY pgrst, 'reload schema';" in sql


def test_followup_migration_removes_write_heavy_low_cardinality_index():
    sql = REMOVE_UNUSED_INDEX_MIGRATION.read_text(encoding="utf-8")

    assert (
        "DROP INDEX IF EXISTS "
        "public.user_operation_artifacts_scheduler_lookup_idx"
    ) in sql
