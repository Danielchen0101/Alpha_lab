from pathlib import Path

import start_quant_backend as backend


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
    assert "legacy_runtime_key" not in persisted


def test_supabase_schema_installs_service_role_only_atomic_merge():
    sql = (
        Path(__file__).parents[1] / "supabase_schema.sql"
    ).read_text(encoding="utf-8")

    assert "merge_user_pipeline_auto_config" in sql
    assert "FOR UPDATE" in sql
    assert "auth.role() IS DISTINCT FROM 'service_role'" in sql
    assert "REVOKE ALL ON FUNCTION public.merge_user_pipeline_auto_config" in sql
    assert "GRANT EXECUTE ON FUNCTION public.merge_user_pipeline_auto_config" in sql
