import json
import sys
from datetime import datetime, timedelta, timezone

import pytest

import start_quant_backend as backend


def test_alpaca_trading_base_url_allowlist_rejects_custom_and_private_origins():
    assert backend._trusted_alpaca_trading_base_url(
        "https://paper-api.alpaca.markets/", "paper",
    ) == "https://paper-api.alpaca.markets"
    assert backend._trusted_alpaca_trading_base_url(
        "https://api.alpaca.markets", "live",
    ) == "https://api.alpaca.markets"

    for value in (
        "http://127.0.0.1:8888",
        "https://api.alpaca.markets.attacker.example",
        "https://paper-api.alpaca.markets@attacker.example",
    ):
        with pytest.raises(ValueError):
            backend._trusted_alpaca_trading_base_url(value, "paper")


class _ImmediateThread:
    def __init__(self, target, args=(), kwargs=None, **_options):
        self.target = target
        self.args = args
        self.kwargs = kwargs or {}

    def start(self):
        self.target(*self.args, **self.kwargs)


class _TrackedThread:
    starts = 0

    def __init__(self, target, args=(), kwargs=None, **_options):
        self.target = target
        self.args = args
        self.kwargs = kwargs or {}
        self.alive = False

    def start(self):
        type(self).starts += 1
        self.alive = True

    def is_alive(self):
        return self.alive


class _FailingStartThread:
    def __init__(self, target, args=(), kwargs=None, **_options):
        self.target = target

    def start(self):
        raise RuntimeError("thread start failed")


def test_pipeline_timezone_helpers_do_not_depend_on_pytz(monkeypatch):
    monkeypatch.setitem(sys.modules, "pytz", object())

    current = backend._pa_now_et()
    converted = backend._pa_as_et(datetime(2026, 7, 15, 20, 0))

    assert current.tzinfo == backend._PA_EASTERN_TZ
    assert converted.isoformat() == "2026-07-15T16:00:00-04:00"


def test_circuit_breaker_state_uses_persisted_deadline_not_status_text():
    now = datetime(2026, 7, 13, 14, 0, tzinfo=timezone.utc)

    assert backend._pa_is_circuit_breaker_open({
        "last_decision": "pipeline_success",
        "circuit_breaker_until": (now + timedelta(minutes=5)).isoformat(),
    }, now) is True
    assert backend._pa_is_circuit_breaker_open({
        "last_decision": "circuit_breaker_open",
        "circuit_breaker_until": (now - timedelta(seconds=1)).isoformat(),
    }, now) is False
    assert backend._pa_is_circuit_breaker_open({
        "last_decision": "circuit_breaker_open",
        "circuit_breaker_until": "invalid",
    }, now) is False


def test_supabase_execute_retries_transient_transport_failure(monkeypatch):
    attempts = []

    def operation():
        attempts.append(True)
        if len(attempts) < 3:
            raise RuntimeError("Resource temporarily unavailable")
        return "ok"

    monkeypatch.setattr(backend.time, "sleep", lambda _seconds: None)

    assert backend._supabase_execute(operation, "test read") == "ok"
    assert len(attempts) == 3


def test_order_authority_explains_why_auto_orders_are_locked():
    locked = backend._pa_order_authority({
        "mode": "ai",
        "trade_mode": "real",
        "live_auto_trading_enabled": False,
    })
    paper = backend._pa_order_authority({
        "mode": "ai",
        "trade_mode": "paper",
        "live_auto_trading_enabled": False,
    })

    assert locked["authorized"] is False
    assert locked["code"] == "live_auto_not_enabled"
    assert paper["authorized"] is True
    assert paper["code"] == "paper_authorized"


def test_pipeline_config_preserves_live_authority_when_mode_temporarily_changes(monkeypatch):
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {
        "enabled": False,
        "interval_minutes": 0,
        "mode": "ai",
        "trade_mode": "real",
        "live_auto_trading_enabled": True,
    })
    monkeypatch.setattr(
        backend,
        "_pa_validate_live_auto_authority",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("incompatible authority must be revoked without broker validation")
        ),
    )
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )
    monkeypatch.setattr(backend, "_pa_ensure_scheduler", lambda: None)

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline-auto/config",
        json={
            "enabled": False,
            "mode": "hybrid",
            "tradeMode": "real",
            "liveAutoTradingEnabled": True,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["success"] is True
    assert response.get_json()["orderAuthority"]["code"] == "full_ai_required"
    assert saved[-1]["live_auto_trading_enabled"] is True


def test_workspace_preferences_restore_saved_operational_context(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 30,
        "mode": "ai",
        "risk_profile": "high",
        "time_horizon": "long",
        "trade_mode": "real",
        "live_auto_trading_enabled": True,
    }
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))

    response = backend.app.test_client().get("/api/user/preferences")
    payload = response.get_json()

    assert response.status_code == 200
    preferences = payload["preferences"]
    assert preferences["tradeMode"] == "real"
    assert preferences["pipelineMode"] == "ai"
    assert preferences["riskProfile"] == "high"
    assert preferences["timeHorizon"] == "long"
    assert preferences["leverageEnabled"] is False
    assert preferences["scheduleEnabled"] is True
    assert preferences["intervalMinutes"] == 30
    assert preferences["liveAutoTradingEnabled"] is True
    assert preferences["strategyPolicy"]["optionsAllowed"] is False
    assert preferences["strategyPolicy"]["permissions"]["autoBuy"] is True
    assert preferences["updatedAt"] == ""


def test_workspace_preferences_merge_without_resetting_schedule(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 60,
        "mode": "ai",
        "risk_profile": "medium",
        "time_horizon": "mid",
        "trade_mode": "real",
        "live_auto_trading_enabled": True,
        "next_run_at": "2026-07-16T10:30:00-04:00",
    }
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/user/preferences",
        json={"tradeMode": "paper", "riskProfile": "low"},
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert saved[-1]["enabled"] is True
    assert saved[-1]["interval_minutes"] == 60
    assert saved[-1]["next_run_at"] == "2026-07-16T10:30:00-04:00"
    assert saved[-1]["trade_mode"] == "paper"
    assert saved[-1]["risk_profile"] == "low"
    assert saved[-1]["live_auto_trading_enabled"] is True
    assert payload["preferences"]["scheduleEnabled"] is True


def test_workspace_preferences_persist_leverage_without_resetting_context(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 15,
        "mode": "ai",
        "risk_profile": "high",
        "time_horizon": "short",
        "trade_mode": "paper",
    }
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/user/preferences", json={"leverageEnabled": True}
    )
    preferences = response.get_json()["preferences"]

    assert response.status_code == 200
    assert saved[-1]["leverage_enabled"] is True
    assert saved[-1]["enabled"] is True
    assert saved[-1]["mode"] == "ai"
    assert preferences["strategyPolicy"]["leverageEnabled"] is True
    assert preferences["strategyPolicy"]["leveragedSleeveMaxPct"] == 15.0
    assert preferences["strategyPolicy"]["optionsAllowed"] is False


def test_workspace_preferences_persist_notification_language(monkeypatch):
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"enabled": True})
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/user/preferences", json={"language": "zh-CN"}
    )

    assert response.status_code == 200
    assert saved[-1]["language"] == "zh-CN"
    assert response.get_json()["preferences"]["language"] == "zh-CN"


def test_new_browser_device_is_registered_once_and_alerted(monkeypatch):
    config = {
        "user_preferences": {
            "security": {"newDeviceAlerts": True},
            "notifications": {"securityAlerts": True, "discord": True},
        }
    }
    saves = []
    alerts = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))

    def patch_config(uid, value):
        saves.append(dict(value))
        config.update(value)
        return True, ""

    monkeypatch.setattr(backend, "_pa_patch_config", patch_config)
    monkeypatch.setattr(
        backend,
        "send_discord_notification",
        lambda uid, event_type, payload: alerts.append((event_type, payload)) or {"sent": True},
    )
    client = backend.app.test_client()
    request_body = {
        "deviceId": "browser-device-1234567890",
        "deviceLabel": "Test Browser on macOS",
        "timezone": "America/New_York",
    }

    first = client.post("/api/user/security/device", json=request_body)
    second = client.post("/api/user/security/device", json=request_body)

    assert first.status_code == 200
    assert first.get_json()["isNew"] is True
    assert second.status_code == 200
    assert second.get_json()["isNew"] is False
    assert len(saves) == 1
    assert len(alerts) == 1
    assert alerts[0][0] == "security"
    assert saves[0]["known_devices"][0]["idHash"] != request_body["deviceId"]


def test_workspace_preferences_persist_nested_operational_defaults(monkeypatch):
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"enabled": True})
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/user/preferences",
        json={
            "general": {"timezone": "America/Los_Angeles", "density": "compact"},
            "risk": {"maxOrderNotional": 2500, "maxPositionPct": 7},
            "notifications": {"recommendations": False, "quietStart": "21:30"},
        },
    )

    assert response.status_code == 200
    stored = saved[-1]["user_preferences"]
    assert stored["general"]["timezone"] == "America/Los_Angeles"
    assert stored["general"]["density"] == "compact"
    assert stored["risk"]["maxOrderNotional"] == 2500
    assert stored["risk"]["maxPositionPct"] == 7
    assert stored["notifications"]["recommendations"] is False
    assert stored["notifications"]["quietStart"] == "21:30"
    assert saved[-1]["enabled"] is True


def test_workspace_preferences_reject_unknown_or_invalid_fields(monkeypatch):
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {})

    unknown = backend.app.test_client().patch(
        "/api/user/preferences", json={"liveAutoTradingEnabled": True}
    )
    invalid = backend.app.test_client().patch(
        "/api/user/preferences", json={"tradeMode": "danger"}
    )

    assert unknown.status_code == 400
    assert unknown.get_json()["reason"] == "unsupported_preference"
    assert invalid.status_code == 400
    assert invalid.get_json()["reason"] == "invalid_preference"


def test_live_auto_authority_updates_only_authority_and_preserves_schedule(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 30,
        "next_run_at": "2026-07-16T10:30:00-04:00",
        "mode": "ai",
        "risk_profile": "high",
        "time_horizon": "short",
        "trade_mode": "real",
        "live_auto_trading_enabled": False,
    }
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(backend, "_pa_validate_live_auto_authority", lambda uid, cfg: None)
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/ai-agent/live-auto-authority", json={"enabled": True}
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["liveAutoTradingEnabled"] is True
    assert saved[-1]["live_auto_trading_enabled"] is True
    assert saved[-1]["enabled"] is True
    assert saved[-1]["interval_minutes"] == 30
    assert saved[-1]["next_run_at"] == "2026-07-16T10:30:00-04:00"


def test_live_auto_authority_keeps_existing_value_when_validation_fails(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 15,
        "mode": "hybrid",
        "trade_mode": "real",
        "live_auto_trading_enabled": False,
    }
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: config)
    monkeypatch.setattr(
        backend,
        "_pa_validate_live_auto_authority",
        lambda uid, cfg: {
            "reason": "live_auto_requires_real_ai_mode",
            "message": "Full AI mode is required.",
        },
    )
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/ai-agent/live-auto-authority", json={"enabled": True}
    )

    assert response.status_code == 400
    assert response.get_json()["reason"] == "live_auto_requires_real_ai_mode"
    assert config["live_auto_trading_enabled"] is False
    assert saved == []


def test_live_auto_authority_revocation_never_requires_broker_verification(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 15,
        "mode": "ai",
        "trade_mode": "real",
        "live_auto_trading_enabled": True,
    }
    saved = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(
        backend,
        "_pa_validate_live_auto_authority",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("revocation must not call the live broker")
        ),
    )
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, ""),
    )

    response = backend.app.test_client().patch(
        "/api/ai-agent/live-auto-authority", json={"enabled": False}
    )

    assert response.status_code == 200
    assert response.get_json()["liveAutoTradingEnabled"] is False
    assert saved[-1]["live_auto_trading_enabled"] is False
    assert saved[-1]["enabled"] is True


def test_live_auto_authority_does_not_change_ui_state_when_save_fails(monkeypatch):
    config = {
        "enabled": True,
        "interval_minutes": 15,
        "mode": "ai",
        "trade_mode": "real",
        "live_auto_trading_enabled": False,
    }
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1", "aal": "aal2"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(backend, "_pa_validate_live_auto_authority", lambda uid, cfg: None)
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: (False, "supabase_write_failed"),
    )

    response = backend.app.test_client().patch(
        "/api/ai-agent/live-auto-authority", json={"enabled": True}
    )

    assert response.status_code == 503
    assert response.get_json()["status"] == "service_unavailable"
    assert "supabase_write_failed" not in response.get_data(as_text=True)


def test_discord_pipeline_event_is_deduped_only_after_success(monkeypatch):
    calls = []
    outcomes = [
        {"sent": False, "reason": "temporary_failure"},
        {"sent": True},
    ]

    def fake_send(uid, event_type, payload):
        calls.append((uid, event_type, payload))
        return outcomes.pop(0)

    monkeypatch.setattr(backend, "send_discord_notification", fake_send)
    with backend._PA_DISCORD_DEDUP_LOCK:
        backend._PA_SENT_DISCORD_EVENTS.clear()

    first = backend._pa_discord_send_once(
        "user-1", "run-1", "scan_summary", {"status": "completed"}
    )
    second = backend._pa_discord_send_once(
        "user-1", "run-1", "scan_summary", {"status": "completed"}
    )
    duplicate = backend._pa_discord_send_once(
        "user-1", "run-1", "scan_summary", {"status": "completed"}
    )

    assert first["sent"] is False
    assert second["sent"] is True
    assert duplicate is None
    assert len(calls) == 2
    assert calls[0][2]["event_id"] == "run-1:scan_summary"


def test_discord_quiet_policy_uses_trade_risk_and_digest_flags():
    config = {
        "notifyTradeActivity": True,
        "notifyRiskAlerts": False,
        "notifyCycleDigest": True,
        "notifyRecommendations": True,
    }

    assert backend._discord_event_enabled(config, "order_AAPL") is True
    assert backend._discord_event_enabled(config, "risk_alert") is False
    assert backend._discord_event_enabled(config, "error") is False
    assert backend._discord_event_enabled(config, "cycle_digest") is True
    assert backend._discord_event_enabled(config, "recommendation") is True


def test_discord_embed_uses_saved_website_language(monkeypatch):
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {"language": "zh-CN"})
    language = backend._discord_notification_language("user-1")
    embed = backend._discord_embed("order", {
        "_language": language,
        "mode": "real",
        "side": "buy",
        "symbol": "AAPL",
        "qty": 2,
        "orderType": "limit",
        "limitPrice": 200,
        "status": "submitted",
        "orderId": "order-123",
    })

    assert embed["title"] == "买入 · 已提交"
    assert [field["name"] for field in embed["fields"]][:3] == ["账户模式", "方向", "股票代码"]


def test_discord_crypto_order_uses_trading_pair_and_localized_action():
    embed = backend._discord_embed("order_crypto_btcusd", {
        "_language": "zh-CN",
        "assetClass": "crypto",
        "mode": "paper",
        "side": "buy",
        "action": "ADD",
        "symbol": "BTC/USD",
        "notional": 250,
        "orderType": "market",
        "status": "submitted",
        "orderId": "crypto-order-1",
    })

    assert embed["title"] == "加仓 · 已提交"
    assert [field["name"] for field in embed["fields"]][:3] == ["账户模式", "操作", "交易对"]
    assert embed["fields"][1]["value"] == "加仓"
    assert embed["fields"][2]["value"] == "BTC/USD"


def test_discord_crypto_recommendations_translate_bounded_actions():
    embed = backend._discord_embed("recommendation", {
        "_language": "zh-CN",
        "assetClass": "crypto",
        "mode": "paper",
        "recommendations": [
            {"symbol": "BTC/USD", "action": "BUY"},
            {"symbol": "ETH/USD", "action": "REDUCE"},
            {"symbol": "SOL/USD", "action": "EXIT"},
        ],
    })

    assert embed["title"] == "虚拟币候选"
    assert embed["fields"][1]["name"] == "虚拟币候选"
    assert embed["fields"][2]["value"].startswith("买入 |")
    assert embed["fields"][3]["value"].startswith("减仓 |")
    assert embed["fields"][4]["value"].startswith("退出 |")


def test_discord_crypto_risk_uses_trading_pair_and_localized_action():
    embed = backend._discord_embed("risk_alert", {
        "_language": "zh-CN",
        "assetClass": "crypto",
        "severity": "high",
        "step": "Drawdown circuit",
        "symbol": "ETH/USD",
        "status": "blocked",
        "reason": "Drawdown limit reached",
        "action": "HOLD",
    })

    assert embed["fields"][1]["name"] == "交易对"
    assert embed["fields"][4]["value"] == "持有"


def test_discord_test_uses_current_page_language(monkeypatch):
    sent = []
    saved_config = {
        "enabled": True,
        "webhookUrl": "https://discord.invalid/test",
        "notifyCycleDigest": True,
    }

    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "get_discord_config", lambda uid: dict(saved_config))
    monkeypatch.setattr(backend, "save_user_config", lambda *args: (True, ""))
    monkeypatch.setattr(
        backend,
        "send_discord_notification",
        lambda uid, event_type, payload: sent.append((event_type, dict(payload))) or {"sent": True},
    )

    response = backend.app.test_client().post(
        "/api/notifications/discord/test",
        json={"eventType": "cycle_digest", "language": "zh-CN", "mode": "paper"},
    )

    assert response.status_code == 200
    assert sent[0][0] == "cycle_digest"
    assert sent[0][1]["language"] == "zh-CN"
    assert sent[0][1]["descriptionZh"] == "这是 Discord 中文通知测试摘要。"


def test_discord_recommendation_dedupe_tracks_unchanged_candidate_set():
    backend._discord_notify_dedupe.clear()
    first = {"event_id": "run-1", "fingerprint": "aapl-buy", "symbol": "AAPL"}
    second = dict(first, event_id="run-2")

    assert backend._discord_should_send("user-1", "recommendation", first) is True
    assert backend._discord_should_send("user-1", "recommendation", second) is False


def test_recommendation_notification_contains_final_trade_levels(monkeypatch):
    sent = []
    monkeypatch.setattr(
        backend,
        "send_discord_notification",
        lambda uid, event_type, payload: sent.append((event_type, payload)) or {"sent": True},
    )

    result = backend._pa_send_recommendations("user-1", "run-1", "auto_run_now", "ai", "real", [{
        "symbol": "AAPL",
        "finalAction": "BUY_READY",
        "entryZoneDesc": "$198–$200",
        "stopLoss": 190,
        "takeProfit1": 220,
        "riskReward1": 2.5,
        "decisionReason": "Confirmed setup",
    }])

    assert result["sent"] is True
    assert sent[0][0] == "recommendation"
    assert sent[0][1]["recommendations"][0]["symbol"] == "AAPL"
    assert sent[0][1]["recommendations"][0]["stop"] == 190


def test_discord_risk_dedupe_tracks_condition_not_changing_event_id():
    backend._discord_notify_dedupe.clear()
    first = {
        "event_id": "run-1:risk",
        "step": "Position Protection",
        "symbol": "AAPL",
        "reason": "protective stop is missing",
    }
    second = dict(first, event_id="run-2:risk")

    assert backend._discord_should_send("user-1", "risk_alert", first) is True
    assert backend._discord_should_send("user-1", "risk_alert", second) is False


def test_cycle_digest_keeps_scheduled_noop_quiet_but_reports_run_now(monkeypatch):
    sent = []
    monkeypatch.setattr(
        backend,
        "_pa_discord_send_once",
        lambda uid, run_id, event_type, payload: sent.append((event_type, payload)) or {"sent": True},
    )
    summary = {
        "errors": 0,
        "scannedTotal": 1500,
        "scanned": 100,
        "fine_count": 30,
        "entry_plan_count": 0,
        "orders_submitted": 0,
        "durationSeconds": 45,
    }
    context = {"validation_results": [], "exit_results": {"holdingsScanned": 0, "submitted": []}}

    quiet = backend._pa_send_cycle_digest(
        "user-1", "scheduled-1", "market_auto_run", "ai", "paper", summary, context
    )
    reported = backend._pa_send_cycle_digest(
        "user-1", "manual-now-1", "auto_run_now", "ai", "paper", summary, context
    )

    assert quiet == {"sent": False, "reason": "scheduled_no_material_action"}
    assert reported["sent"] is True
    assert sent[0][0] == "cycle_digest"
    assert sent[0][1]["universeScanned"] == 1500


def test_auto_run_now_executes_backend_chain_without_frontend_claim(monkeypatch):
    executions = []
    releases = []

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_try_reserve_user_run", lambda uid, source: True)
    monkeypatch.setattr(backend, "_pa_get_active_run", lambda uid: None)
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {
        "interval_minutes": 30,
        "mode": "ai",
        "risk_profile": "medium",
        "time_horizon": "mid",
        "trade_mode": "paper",
    })
    monkeypatch.setattr(backend, "_pa_resolve_auto_run_context", lambda uid, config: {
        "interval": 30,
        "mode": "ai",
        "risk_profile": "medium",
        "time_horizon": "mid",
        "trade_mode": "paper",
        "contextSource": "saved_backend_config",
    })

    def fake_execute(uid, config, interval, mode, trigger, **kwargs):
        executions.append({
            "uid": uid,
            "interval": interval,
            "mode": mode,
            "trigger": trigger,
            **kwargs,
        })
        # The real executor owns and releases the shared heavy-work slot.
        # Keeping that ownership in this test also proves the endpoint wrapper
        # does not perform a second, racy release after execution returns.
        backend._pa_release_user_run(uid)
        return {
            "errors": 0,
            "startedAt": "2026-07-13T10:00:00Z",
            "finishedAt": "2026-07-13T10:01:00Z",
            "durationSeconds": 60,
        }

    monkeypatch.setattr(backend, "_pa_execute_and_save", fake_execute)
    monkeypatch.setattr(backend, "_pa_add_run_history", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend, "_pa_release_user_run", lambda uid: releases.append(uid))
    monkeypatch.setattr(backend.threading, "Thread", _ImmediateThread)

    response = backend.app.test_client().post("/api/ai-agent/pipeline-auto/run-now")

    assert response.status_code == 200
    assert response.get_json()["status"] == "running"
    assert len(executions) == 1
    assert executions[0]["trigger"] == "auto_run_now"
    assert executions[0]["mode"] == "ai"
    assert executions[0]["trade_mode"] == "paper"
    assert releases == ["user-1"]


def test_pipeline_status_exposes_active_stage_progress_and_quiet_discord_policy(monkeypatch):
    uid = "status-user"
    now_et = datetime(2026, 7, 13, 11, 0, tzinfo=timezone.utc)
    next_run = now_et + timedelta(minutes=15)
    active_run = {
        "runId": "auto-status-run",
        "trigger": "auto_run_now",
        "status": "running",
        "currentStep": "fine_scan",
        "stepIndex": 2,
        "totalSteps": 7,
        "progressPct": 21,
        "updatedAt": backend._pa_utc_iso(),
        "steps": {
            "market_scanner": {"status": "completed", "progressPct": 100},
            "fine_scan": {"status": "running", "progressPct": 50, "processed": 15, "total": 30},
        },
    }
    config = {
        "enabled": True,
        "interval_minutes": 15,
        "mode": "ai",
        "risk_profile": "medium",
        "time_horizon": "mid",
        "trade_mode": "paper",
        "next_run_at": next_run.isoformat(),
        "last_run_at": (now_et - timedelta(minutes=20)).isoformat(),
        "last_decision": "started_pipeline",
    }

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": uid})
    monkeypatch.setattr(backend, "_pa_get_config", lambda user_id: dict(config))
    monkeypatch.setattr(
        backend,
        "_pa_check_market_open",
        lambda user_id, trade_mode: (
            True,
            "open",
            "alpaca_clock",
            (now_et + timedelta(days=1)).isoformat(),
            (now_et + timedelta(hours=5)).isoformat(),
            "open",
        ),
    )
    monkeypatch.setattr(backend, "_pa_now_et", lambda: now_et)
    monkeypatch.setattr(backend, "_pa_get_active_run", lambda user_id: dict(active_run))
    monkeypatch.setattr(backend, "_pa_resolve_auto_run_context", lambda user_id, cfg: {"contextSource": "saved_backend_config"})
    monkeypatch.setattr(backend, "get_discord_config", lambda user_id: {
        "enabled": True,
        "webhookUrl": "https://discord.invalid/test",
        "notifyTradeActivity": True,
        "notifyRiskAlerts": True,
        "notifyCycleDigest": False,
        "notifyRecommendations": True,
    })
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_HEARTBEAT", backend.time.time())
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.add(uid)
    try:
        response = backend.app.test_client().get("/api/ai-agent/pipeline-auto/status")
    finally:
        with backend._PA_RUNNING_USERS_LOCK:
            backend._PA_RUNNING_USERS.discard(uid)

    payload = response.get_json()
    assert response.status_code == 200
    assert payload["activeRun"]["progressPct"] == 21
    assert payload["activeRun"]["steps"]["fine_scan"]["progressPct"] == 50
    assert len(payload["pipelineStages"]) == 7
    assert payload["nextRunBasis"] == "persisted_next_run_at"
    assert payload["discordPolicy"] == {
        "tradeActivity": True,
        "riskAlerts": True,
        "cycleDigest": False,
        "recommendations": True,
        "quietMode": True,
    }


def test_headless_pipeline_initializes_stage_timeout_tracking(monkeypatch):
    updates = []
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS.pop("user-1", None)

    def clear_active_run(uid):
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)

    monkeypatch.setattr(backend, "_pa_clear_active_run", clear_active_run)
    monkeypatch.setattr(
        backend,
        "_pa_update_active_run",
        lambda uid, **kwargs: updates.append(kwargs) or True,
    )
    monkeypatch.setattr(
        backend,
        "_pa_check_stop_requested",
        lambda uid, expected_run_id=None: False,
    )
    monkeypatch.setattr(backend, "_pa_reconcile_order_lifecycle", lambda *args, **kwargs: {})
    monkeypatch.setattr(backend, "_pa_save_pipeline_debug_dump", lambda *args, **kwargs: None)

    def fail_after_timeout_preflight(*args, **kwargs):
        raise RuntimeError("scanner reached")

    monkeypatch.setattr(backend, "_pa_market_scanner_headless", fail_after_timeout_preflight)

    summary = backend._pa_run_pipeline(
        "user-1",
        0,
        "hybrid",
        trigger="headless_test",
        trade_mode="paper",
        run_id="stage-timer-test",
    )

    assert summary["errors"] == 1
    assert summary["lastError"] == "scanner reached"
    assert not any("stage_started_at" in str(update.get("lastError", "")) for update in updates)


def test_pipeline_stage_progress_counts_only_completed_stages(monkeypatch):
    updates = []
    monkeypatch.setattr(backend, "_pa_update_active_run", lambda uid, **kwargs: updates.append(kwargs))

    backend._pa_active_run_step("user-1", "market_scanner", 1, 7, status="running")
    backend._pa_active_run_step("user-1", "market_scanner", 1, 7, status="completed")
    backend._pa_active_run_step("user-1", "fine_scan", 2, 7, status="running")

    assert [update["progressPct"] for update in updates] == [0, 14, 14]


def test_pipeline_stage_progress_includes_real_intra_stage_work(monkeypatch):
    updates = []
    monkeypatch.setattr(backend, "_pa_update_active_run", lambda uid, **kwargs: updates.append(kwargs))

    backend._pa_active_run_step(
        "user-1",
        "fine_scan",
        2,
        7,
        status="running",
        step_data={"processed": 15, "total": 30, "progressPct": 50},
    )

    assert updates[0]["progressPct"] == 21
    assert updates[0]["steps"]["fine_scan"]["processed"] == 15
    assert updates[0]["steps"]["fine_scan"]["total"] == 30


def test_active_run_failure_keeps_completed_progress_and_utc_timestamps(monkeypatch):
    uid = "progress-user"
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS.pop(uid, None)

    backend._pa_update_active_run(
        uid,
        runId="progress-run",
        status="running",
        startedAt=backend._pa_utc_iso(),
        steps=backend._pa_initial_steps(),
    )
    backend._pa_active_run_step(uid, "market_scanner", 1, 7, status="completed")
    backend._pa_active_run_step(
        uid,
        "fine_scan",
        2,
        7,
        status="running",
        step_data={"processed": 3, "total": 10, "progressPct": 30},
    )
    progress_before_failure = backend._pa_get_active_run(uid)["progressPct"]
    backend._pa_active_run_step(
        uid,
        "fine_scan",
        2,
        7,
        status="failed",
        step_data={"error": "provider timeout"},
    )
    backend._pa_update_active_run(
        uid,
        status="failed",
        lastError="provider timeout",
        finishedAt=backend._pa_utc_iso(),
    )

    run = backend._pa_get_active_run(uid)
    assert run["progressPct"] == progress_before_failure
    assert run["currentStep"] == "fine_scan"
    assert run["updatedAt"].endswith("Z")
    assert run["finishedAt"].endswith("Z")
    assert run["steps"]["fine_scan"]["status"] == "failed"
    assert run["steps"]["fine_scan"]["finishedAt"].endswith("Z")


def test_stop_request_preserves_stage_progress(monkeypatch):
    uid = "stop-progress-user"
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS.pop(uid, None)

    backend._pa_update_active_run(
        uid,
        runId="stop-progress-run",
        status="running",
        currentStep="market_scanner",
        stepIndex=1,
        progressPct=9,
        stopRequested=True,
        steps={
            "market_scanner": {
                "status": "running",
                "progressPct": 63,
                "startedAt": backend._pa_utc_iso(),
            }
        },
    )

    assert backend._pa_check_stop_requested(uid) is True
    run = backend._pa_get_active_run(uid)
    assert run["status"] == "stopped"
    assert run["progressPct"] == 9
    assert run["steps"]["market_scanner"]["status"] == "stopped"
    assert run["steps"]["market_scanner"]["progressPct"] == 63


def test_stop_endpoint_requires_and_matches_exact_run_id(monkeypatch):
    updates = []
    patches = []
    cached = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "stop-user"})
    monkeypatch.setattr(
        backend,
        "_pa_get_active_run",
        lambda uid: {
            "runId": "active-run-2",
            "status": "running",
            "stopRequested": False,
        },
    )
    monkeypatch.setattr(
        backend,
        "_pa_update_active_run",
        lambda uid, **kwargs: updates.append((uid, kwargs)) or True,
    )
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda uid, patch: patches.append((uid, patch)) or (True, ""),
    )
    monkeypatch.setattr(
        backend,
        "_pa_cache_stop_request",
        lambda uid, request: cached.append((uid, request)),
    )
    client = backend.app.test_client()

    missing = client.post("/api/ai-agent/pipeline/stop", json={})
    mismatch = client.post(
        "/api/ai-agent/pipeline/stop",
        json={"runId": "stale-run-1"},
    )
    accepted = client.post(
        "/api/ai-agent/pipeline/stop",
        json={"runId": "active-run-2", "reason": "operator_requested"},
    )

    assert missing.status_code == 400
    assert missing.get_json()["code"] == "run_id_required"
    assert mismatch.status_code == 409
    assert mismatch.get_json()["code"] == "run_id_mismatch"
    assert accepted.status_code == 202
    assert accepted.get_json()["durable"] is True
    assert len(updates) == 1
    assert updates[0][1]["status"] == "cancelling"
    assert updates[0][1]["stopRequested"] is True
    assert patches[0][1]["active_stop_request"]["runId"] == "active-run-2"
    assert cached[0][1]["runId"] == "active-run-2"


def test_stop_endpoint_is_idempotent_without_refreshing_cancel_deadline(
    monkeypatch,
):
    requested_at = "2026-07-25T20:00:00Z"
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "stop-user"})
    monkeypatch.setattr(
        backend,
        "_pa_get_active_run",
        lambda uid: {
            "runId": "active-run-2",
            "status": "cancelling",
            "stopRequested": True,
            "stopRequestedAt": requested_at,
        },
    )
    monkeypatch.setattr(
        backend,
        "_pa_update_active_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("idempotent stop must not rewrite active state")
        ),
    )
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("idempotent stop must not refresh durable state")
        ),
    )

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline/stop",
        json={"runId": "active-run-2"},
    )

    assert response.status_code == 202
    assert response.get_json()["alreadyRequested"] is True
    assert response.get_json()["requestedAt"] == requested_at


def test_active_run_compare_and_set_rejects_aba_update(monkeypatch):
    uid = "active-run-cas-user"
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    try:
        backend._pa_update_active_run(
            uid,
            runId="run-a",
            status="running",
        )
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS[uid]["runId"] = "run-b"
            backend._PA_ACTIVE_RUNS[uid]["status"] = "running"

        changed = backend._pa_update_active_run(
            uid,
            expected_run_id="run-a",
            expected_statuses=("running",),
            status="cancelling",
            stopRequested=True,
        )

        assert changed is False
        assert backend._pa_get_active_run(uid)["runId"] == "run-b"
        assert backend._pa_get_active_run(uid)["status"] == "running"
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)


def test_stop_endpoint_aba_race_does_not_cancel_new_run(monkeypatch):
    reads = [
        {"runId": "run-a", "status": "running"},
        {"runId": "run-b", "status": "running"},
    ]
    cached = []
    patches = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "stop-user"})
    monkeypatch.setattr(
        backend,
        "_pa_get_active_run",
        lambda uid: reads.pop(0),
    )
    monkeypatch.setattr(
        backend,
        "_pa_update_active_run",
        lambda *args, **kwargs: False,
    )
    monkeypatch.setattr(
        backend,
        "_pa_cache_stop_request",
        lambda *args, **kwargs: cached.append((args, kwargs)),
    )
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda *args, **kwargs: patches.append((args, kwargs)) or (True, ""),
    )

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline/stop",
        json={"runId": "run-a"},
    )

    assert response.status_code == 409
    assert response.get_json()["activeRunId"] == "run-b"
    assert cached == []
    assert patches == []


def test_pipeline_run_is_queued_before_worker_start_and_can_be_stopped(
    monkeypatch,
):
    uid = "queued-stop-user"
    patches = []
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": uid})
    monkeypatch.setattr(
        backend,
        "_pa_try_reserve_user_run",
        lambda candidate_uid, source: True,
    )
    monkeypatch.setattr(
        backend,
        "_pa_start_reserved_thread",
        lambda *args, **kwargs: object(),
    )
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda candidate_uid, patch: patches.append(
            (candidate_uid, patch)
        ) or (True, ""),
    )
    try:
        started = backend.app.test_client().post(
            "/api/ai-agent/pipeline/run",
            json={"trigger": "manual", "mode": "hybrid"},
        )
        run_id = started.get_json()["runId"]
        queued = backend._pa_get_active_run(uid)

        stopped = backend.app.test_client().post(
            "/api/ai-agent/pipeline/stop",
            json={"runId": run_id},
        )

        assert started.status_code == 200
        assert queued["status"] == "queued"
        assert queued["runId"] == run_id
        assert stopped.status_code == 202
        assert patches[0][1]["active_stop_request"]["runId"] == run_id
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)
        with backend._PA_STOP_REQUEST_CACHE_LOCK:
            backend._PA_STOP_REQUEST_CACHE.pop(uid, None)


def test_durable_stop_request_cannot_stop_a_new_run_or_position_guard(monkeypatch):
    monkeypatch.setattr(backend, "_pa_get_active_run", lambda uid: None)
    monkeypatch.setattr(
        backend,
        "_pa_get_cached_stop_request",
        lambda uid: {
            "runId": "completed-run-1",
            "requestedAt": "2026-07-25T10:00:00+00:00",
        },
    )

    assert backend._pa_check_stop_requested(
        "stop-user",
        expected_run_id="completed-run-1",
    ) is True
    assert backend._pa_check_stop_requested(
        "stop-user",
        expected_run_id="new-run-2",
    ) is False
    assert backend._pa_check_stop_requested(
        "stop-user",
        expected_run_id="position-guard-stop-user-3",
    ) is False


def test_scheduler_watchdog_persists_stale_exact_run_cancel_without_status_poll(
    monkeypatch,
):
    uid = "watchdog-user"
    now_ts = datetime.now(timezone.utc).timestamp()
    stale_at = datetime.fromtimestamp(
        now_ts - backend._PA_WATCHDOG_STALE_SECONDS - 1,
        timezone.utc,
    ).isoformat()
    patches = []
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_user_run_is_reserved",
        lambda candidate_uid: candidate_uid == uid,
    )
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda candidate_uid, patch: patches.append(
            (candidate_uid, patch)
        ) or (True, ""),
    )
    try:
        backend._pa_update_active_run(
            uid,
            runId="watchdog-run-1",
            status="running",
            currentStep="deeper_validation",
            stopRequested=False,
        )
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS[uid]["updatedAt"] = stale_at

        summary = backend._pa_watchdog_active_runs(
            now_ts=now_ts,
            only_uid=uid,
        )
        active = backend._pa_get_active_run(uid)

        assert summary["cancellationRequested"] == 1
        assert active["status"] == "cancelling"
        assert active["stopRequested"] is True
        assert active["stopRequestedAt"]
        assert patches == [
            (
                uid,
                {
                    "active_stop_request": {
                        "runId": "watchdog-run-1",
                        "requestedAt": active["stopRequestedAt"],
                        "reason": "stale_run_watchdog",
                    }
                },
            )
        ]
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)
        with backend._PA_STOP_REQUEST_CACHE_LOCK:
            backend._PA_STOP_REQUEST_CACHE.pop(uid, None)
        with backend._PA_WATCHDOG_LOCK:
            backend._PA_WATCHDOG_STALLED_RUNS.clear()


def test_watchdog_snapshot_cannot_cancel_replacement_run(monkeypatch):
    uid = "watchdog-aba-user"
    now_ts = datetime.now(timezone.utc).timestamp()
    stale_at = datetime.fromtimestamp(
        now_ts - backend._PA_WATCHDOG_STALE_SECONDS - 1,
        timezone.utc,
    ).isoformat()
    patches = []
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda candidate_uid, patch: patches.append(
            (candidate_uid, patch)
        ) or (True, ""),
    )
    try:
        backend._pa_update_active_run(
            uid,
            runId="watchdog-run-a",
            status="running",
            currentStep="fine_scan",
        )
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS[uid]["updatedAt"] = stale_at

        def replace_before_cas(candidate_uid):
            with backend._PA_ACTIVE_RUNS_LOCK:
                backend._PA_ACTIVE_RUNS[candidate_uid].update({
                    "runId": "watchdog-run-b",
                    "status": "running",
                    "stopRequested": False,
                })
            return True

        monkeypatch.setattr(
            backend,
            "_pa_user_run_is_reserved",
            replace_before_cas,
        )

        summary = backend._pa_watchdog_active_runs(
            now_ts=now_ts,
            only_uid=uid,
        )

        assert summary["cancellationRequested"] == 0
        assert backend._pa_get_active_run(uid)["runId"] == "watchdog-run-b"
        assert backend._pa_get_active_run(uid)["status"] == "running"
        assert patches == []
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)
        with backend._PA_WATCHDOG_LOCK:
            backend._PA_WATCHDOG_STALLED_RUNS.clear()


def test_stalled_watchdog_cancellation_fails_scheduler_readiness(monkeypatch):
    uid = "stalled-watchdog-user"
    now_ts = datetime.now(timezone.utc).timestamp()
    requested_at = datetime.fromtimestamp(
        now_ts - backend._PA_WATCHDOG_CANCEL_GRACE_SECONDS - 1,
        timezone.utc,
    ).isoformat()

    class AliveThread:
        @staticmethod
        def is_alive():
            return True

    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_user_run_is_reserved",
        lambda candidate_uid: candidate_uid == uid,
    )
    monkeypatch.setattr(backend, "_PA_SCHEDULER_THREAD", AliveThread())
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_HEARTBEAT", now_ts - 5)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_COMPLETED_AT", now_ts - 10)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_ERROR", "")
    monkeypatch.setattr(backend, "_PA_SCHEDULER_CONSECUTIVE_ERRORS", 0)
    monkeypatch.setattr(backend, "_pa_read_shared_scheduler_heartbeat", lambda: {})
    try:
        backend._pa_update_active_run(
            uid,
            runId="stalled-run-1",
            status="cancelling",
            currentStep="execution",
            stopRequested=True,
            stopRequestedAt=requested_at,
        )

        watchdog = backend._pa_watchdog_active_runs(
            now_ts=now_ts,
            only_uid=uid,
        )
        health = backend._pa_scheduler_health_snapshot(now_ts=now_ts)

        assert watchdog["stalled"] == 1
        assert health["stalledRunCount"] == 1
        assert health["stalledRuns"][0]["stage"] == "execution"
        assert health["running"] is False
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)
        with backend._PA_WATCHDOG_LOCK:
            backend._PA_WATCHDOG_STALLED_RUNS.clear()


def test_auto_run_now_respects_open_circuit_breaker(monkeypatch):
    breaker_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    reservations = []

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {
        "circuit_breaker_until": breaker_until,
    })
    monkeypatch.setattr(
        backend,
        "_pa_try_reserve_user_run",
        lambda uid, source: reservations.append((uid, source)) or True,
    )

    response = backend.app.test_client().post("/api/ai-agent/pipeline-auto/run-now")
    payload = response.get_json()

    assert response.status_code == 409
    assert payload["status"] == "circuit_open"
    assert payload["retryAt"] == breaker_until
    assert reservations == []


def test_non_manual_pipeline_endpoint_respects_open_circuit_breaker(monkeypatch):
    breaker_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    reservations = []

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {
        "circuit_breaker_until": breaker_until,
    })
    monkeypatch.setattr(
        backend,
        "_pa_try_reserve_user_run",
        lambda uid, source: reservations.append((uid, source)) or True,
    )

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline/run",
        json={"trigger": "auto_run_now", "mode": "ai"},
    )

    assert response.status_code == 409
    assert response.get_json()["reason"] == "circuit_breaker_open"
    assert reservations == []


def test_enabling_schedule_does_not_bypass_open_circuit_breaker(monkeypatch):
    breaker_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    config = {
        "enabled": False,
        "circuit_breaker_until": breaker_until,
        "live_auto_trading_enabled": False,
    }
    saved = []

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: config)
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, value: saved.append(dict(value)) or (True, "saved"),
    )
    monkeypatch.setattr(backend, "_pa_ensure_scheduler", lambda: None)
    monkeypatch.setattr(
        backend,
        "_pa_check_market_open",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("circuit-open enable must not start an immediate scan")
        ),
    )

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline-auto/config",
        json={
            "enabled": True,
            "intervalMinutes": 30,
            "mode": "ai",
            "riskProfile": "medium",
            "timeHorizon": "mid",
            "tradeMode": "paper",
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["status"] == "circuit_open"
    assert payload["enabled"] is True
    assert saved[-1]["next_run_at"] == breaker_until
    assert saved[-1]["last_decision"] == "circuit_breaker_open"


def test_manual_run_uses_the_same_backend_pipeline_executor(monkeypatch):
    executions = []

    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
    monkeypatch.setattr(backend, "_pa_try_reserve_user_run", lambda uid, source: True)
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {})
    monkeypatch.setattr(backend.threading, "Thread", _ImmediateThread)

    def fake_execute(uid, config, interval, mode, trigger, **kwargs):
        executions.append({
            "uid": uid,
            "interval": interval,
            "mode": mode,
            "trigger": trigger,
            **kwargs,
        })
        return {"errors": 0}

    monkeypatch.setattr(backend, "_pa_execute_and_save", fake_execute)

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline/run",
        json={
            "trigger": "manual",
            "mode": "hybrid",
            "riskProfile": "low",
            "timeHorizon": "long",
            "tradeMode": "real",
            "leverageEnabled": True,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["success"] is True
    assert len(executions) == 1
    assert executions[0]["trigger"] == "manual"
    assert executions[0]["mode"] == "hybrid"
    assert executions[0]["interval"] == 0
    assert executions[0]["risk_profile"] == "low"
    assert executions[0]["time_horizon"] == "long"
    assert executions[0]["trade_mode"] == "real"
    assert executions[0]["leverage_enabled"] is True


def test_manual_pipeline_rejects_non_boolean_leverage_preference(monkeypatch):
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})

    response = backend.app.test_client().post(
        "/api/ai-agent/pipeline/run",
        json={"trigger": "manual", "leverageEnabled": "yes"},
    )

    assert response.status_code == 400
    assert response.get_json()["reason"] == "invalid_leverage_preference"


def test_position_guard_runs_deterministic_protection_and_notifies(monkeypatch):
    exit_calls = []
    notifications = []
    releases = []

    with backend._PA_POSITION_GUARD_LOCK:
        backend._PA_POSITION_GUARD_STATE.clear()

    monkeypatch.setattr(backend, "_pa_try_reserve_user_run", lambda uid, source: True)
    monkeypatch.setattr(backend, "_pa_reconcile_order_lifecycle", lambda uid, mode, notify: {
        "checked": 1,
        "updated": 1,
    })

    def fake_exit(uid, entry_plans, mode, **kwargs):
        exit_calls.append({"uid": uid, "entry_plans": entry_plans, "mode": mode, **kwargs})
        return {
            "holdingsScanned": 1,
            "protectedCount": 0,
            "blockedCount": 1,
            "sellNowCount": 0,
            "holdCount": 0,
            "submitted": [],
            "signals": [{
                "symbol": "AAPL",
                "action": "protection_required",
                "status": "unprotected",
            }],
        }

    monkeypatch.setattr(backend, "_pa_exit_scan_headless", fake_exit)
    saved_configs = []
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {})
    monkeypatch.setattr(backend, "_pa_save_config", lambda uid, cfg: saved_configs.append(dict(cfg)) or (True, "saved"))
    monkeypatch.setattr(backend, "send_discord_notification", lambda uid, event_type, payload: (
        notifications.append((uid, event_type, payload)) or {"sent": True}
    ))
    monkeypatch.setattr(backend, "_pa_release_user_run", lambda uid: releases.append(uid))
    monkeypatch.setattr(backend.threading, "Thread", _ImmediateThread)

    started = backend._pa_maybe_start_position_guard(
        "user-1",
        {"enabled": False},
        datetime(2026, 7, 13, 10, 0, tzinfo=timezone.utc),
        "ai",
        "medium",
        "mid",
        "paper",
        True,
    )

    assert started is True
    assert len(exit_calls) == 1
    assert exit_calls[0]["dry_run"] is False
    assert exit_calls[0]["ai_review"] is False
    assert notifications[0][1] == "risk_alert"
    assert notifications[0][2]["step"] == "Position Protection"
    assert notifications[0][2]["status"] == "review_required"
    assert notifications[0][2]["symbol"] == "AAPL"
    assert any(config.get("position_guard_alert_fingerprint") for config in saved_configs)
    assert releases == ["user-1"]
    assert backend._PA_POSITION_GUARD_STATE["user-1"]["running"] is False


def test_position_guard_does_not_run_without_user_routing_lease(monkeypatch):
    with backend._PA_POSITION_GUARD_LOCK:
        backend._PA_POSITION_GUARD_STATE.clear()

    monkeypatch.setattr(backend, "_pa_try_reserve_user_run", lambda uid, source: False)
    monkeypatch.setattr(
        backend,
        "_pa_exit_scan_headless",
        lambda *args, **kwargs: pytest.fail("guard ran without a routing lease"),
    )

    started = backend._pa_maybe_start_position_guard(
        "user-1",
        {"enabled": True},
        datetime(2026, 7, 13, 10, 0, tzinfo=timezone.utc),
        "ai",
        "medium",
        "mid",
        "paper",
        True,
    )

    assert started is False
    assert "user-1" not in backend._PA_POSITION_GUARD_STATE


def test_cooperative_scanner_budget_raises_inside_long_running_batch(monkeypatch):
    monkeypatch.setattr(backend.time, "time", lambda: 1_000.0)
    backend._backend_set_pipeline_runtime_budget(
        "market_scanner",
        pipeline_started_at=0.0,
        pipeline_limit=1_800,
        stage_started_at=0.0,
        stage_limit=900,
    )
    try:
        with pytest.raises(backend._BackendStageDeadlineExceeded) as exc_info:
            backend._backend_enforce_runtime_budget()
    finally:
        backend._backend_clear_pipeline_runtime_budget()

    assert exc_info.value.stage == "market_scanner"
    assert exc_info.value.limit == 900


def test_execute_and_save_preserves_failure_state_on_early_exception(monkeypatch):
    saved = []
    releases = []
    config = {"enabled": False}

    monkeypatch.setattr(backend, "_pa_now_et", lambda: datetime(2026, 7, 13, 10, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(backend, "_pa_run_pipeline", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")))
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: {})
    monkeypatch.setattr(backend, "_pa_save_config", lambda uid, cfg: saved.append(dict(cfg)) or (True, "saved"))
    monkeypatch.setattr(backend, "_pa_release_user_run", lambda uid: releases.append(uid))

    with pytest.raises(RuntimeError, match="boom"):
        backend._pa_execute_and_save(
            "user-1",
            config,
            30,
            "ai",
            trigger="manual",
            trade_mode="paper",
        )

    assert config["last_backend_scan_status"] == "failed"
    assert config["last_backend_scan_error"] == "unknown error"
    assert saved[-1]["last_decision"] == "manual_pipeline_failed"
    assert releases == ["user-1"]


def test_execute_and_save_tracks_auto_runs_by_new_york_trading_date(monkeypatch):
    saved = []
    config = {
        "enabled": True,
        "run_count_date_et": "2026-07-13",
        "run_count_today": 2,
    }
    stored_config = dict(config)

    monkeypatch.setattr(backend, "_pa_now_et", lambda: datetime(2026, 7, 13, 15, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(backend, "_pa_run_pipeline", lambda *args, **kwargs: {"errors": 0})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(stored_config))
    monkeypatch.setattr(backend, "_pa_save_config", lambda uid, cfg: saved.append(dict(cfg)) or (True, "saved"))
    monkeypatch.setattr(backend, "_pa_release_user_run", lambda uid: None)

    backend._pa_execute_and_save(
        "user-1",
        config,
        30,
        "ai",
        trigger="auto_run_now",
        trade_mode="paper",
    )

    assert saved[-1]["run_count_date_et"] == "2026-07-13"
    assert saved[-1]["run_count_today"] == 3


def test_execute_and_save_resets_auto_run_count_on_next_trading_date(monkeypatch):
    saved = []
    config = {
        "enabled": True,
        "run_count_date_et": "2026-07-12",
        "run_count_today": 9,
    }

    monkeypatch.setattr(backend, "_pa_now_et", lambda: datetime(2026, 7, 13, 15, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(backend, "_pa_run_pipeline", lambda *args, **kwargs: {"errors": 0})
    monkeypatch.setattr(backend, "_pa_get_config", lambda uid: dict(config))
    monkeypatch.setattr(backend, "_pa_save_config", lambda uid, cfg: saved.append(dict(cfg)) or (True, "saved"))
    monkeypatch.setattr(backend, "_pa_release_user_run", lambda uid: None)

    backend._pa_execute_and_save(
        "user-1",
        config,
        30,
        "ai",
        trigger="market_auto_run",
        trade_mode="paper",
    )

    assert saved[-1]["run_count_date_et"] == "2026-07-13"
    assert saved[-1]["run_count_today"] == 1


def test_pipeline_outcome_never_masks_errors_as_stopped_or_skipped():
    assert backend._pa_pipeline_outcome({"errors": 0}) == "success"
    assert backend._pa_pipeline_outcome({"errors": 0, "stopped": True}) == "stopped"
    assert backend._pa_pipeline_outcome({"errors": 0, "skipped": True}) == "skipped"
    assert backend._pa_pipeline_outcome({"errors": 1, "stopped": True}) == "failed"
    assert backend._pa_pipeline_outcome({"errors": "invalid", "skipped": True}) == "failed"


def test_debug_dump_reclassification_updates_only_matching_run(monkeypatch, tmp_path):
    uid = "debug-reclassification-user"
    run_id = "debug-run-1"
    other_run_id = "debug-run-2"
    monkeypatch.setattr(
        backend,
        "__file__",
        str(tmp_path / "start_quant_backend.py"),
    )
    original = {
        "success": True,
        "outcome": "success",
        "runId": run_id,
        "userId": uid,
        "summary": {"errors": 0},
    }
    other = {
        "success": True,
        "outcome": "success",
        "runId": other_run_id,
        "userId": uid,
        "summary": {"errors": 0},
    }
    with backend._PA_LAST_PIPELINE_RESULTS_LOCK:
        for key in (
            (uid, run_id),
            (uid, "__last__"),
            (uid, "__last_auto__"),
        ):
            backend._PA_LAST_PIPELINE_RESULTS[key] = dict(original)
        backend._PA_LAST_PIPELINE_RESULTS[(uid, other_run_id)] = dict(other)
    debug_path = tmp_path / "debug_auto_pipeline_result.json"
    debug_path.write_text(json.dumps(original), encoding="utf-8")

    updated = backend._pa_reclassify_pipeline_debug_dump(
        uid,
        run_id,
        "market_auto_run",
        {
            "errors": 1,
            "lastError": "pipeline result persistence failed",
            "persistenceError": "write unavailable",
        },
    )

    assert updated["success"] is False
    assert updated["outcome"] == "failed"
    assert updated["summary"]["persistenceError"] == "write unavailable"
    with backend._PA_LAST_PIPELINE_RESULTS_LOCK:
        assert backend._PA_LAST_PIPELINE_RESULTS[(uid, "__last__")]["outcome"] == "failed"
        assert backend._PA_LAST_PIPELINE_RESULTS[(uid, other_run_id)] == other
        for key in (
            (uid, run_id),
            (uid, other_run_id),
            (uid, "__last__"),
            (uid, "__last_auto__"),
        ):
            backend._PA_LAST_PIPELINE_RESULTS.pop(key, None)
            backend._PA_LAST_PIPELINE_RESULT_TIMESTAMPS.pop(key, None)
    on_disk = json.loads(debug_path.read_text(encoding="utf-8"))
    assert on_disk["success"] is False
    assert on_disk["outcome"] == "failed"


def test_execute_and_save_marks_successful_scan_failed_when_result_is_not_durable(
    monkeypatch,
):
    uid = "persistence-failure-user"
    run_id = "persistence-run-1"
    config = {"enabled": True, "consecutive_failures": 0}
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS[uid] = {
            "runId": run_id,
            "status": "completed",
            "steps": backend._pa_initial_steps(),
        }
    backend._pa_clear_user_runtime_backoff(uid)
    monkeypatch.setattr(
        backend,
        "_pa_now_et",
        lambda: datetime(2026, 7, 13, 15, 0, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        backend,
        "_pa_run_pipeline",
        lambda *args, **kwargs: {"errors": 0, "finishedAt": "2026-07-13T15:01:00Z"},
    )
    monkeypatch.setattr(backend, "_pa_get_config", lambda candidate_uid: dict(config))
    monkeypatch.setattr(
        backend,
        "_pa_patch_config",
        lambda *args, **kwargs: (False, "durable write unavailable"),
    )

    try:
        summary = backend._pa_execute_and_save(
            uid,
            config,
            30,
            "ai",
            trigger="auto_run_now",
            trade_mode="paper",
            run_id=run_id,
        )

        assert summary["errors"] == 1
        assert summary["persistenceError"] == "durable write unavailable"
        assert backend._pa_pipeline_outcome(summary) == "failed"
        assert backend._pa_get_user_runtime_backoff(uid)["reason"] == (
            "pipeline_result_persistence_failed"
        )
        with backend._PA_ACTIVE_RUNS_LOCK:
            assert backend._PA_ACTIVE_RUNS[uid]["status"] == "failed"
            assert backend._PA_ACTIVE_RUNS[uid]["lastError"] == (
                "pipeline_result_persistence_failed"
            )
        assert backend._pa_user_run_is_reserved(uid) is False
    finally:
        backend._pa_clear_user_runtime_backoff(uid)
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop(uid, None)


def test_executor_decorator_releases_exact_reservation_when_finalizer_raises(
    monkeypatch,
):
    uid = "executor-finalizer-user"
    token = "executor-finalizer-token"
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.add(uid)
        backend._PA_RUNNING_USER_TOKENS[uid] = token
        backend._PA_RUNNING_USER_SOURCES[uid] = "auto_run_now"
    backend._pa_clear_user_runtime_backoff(uid)
    monkeypatch.setattr(
        backend,
        "_pa_run_pipeline",
        lambda *args, **kwargs: {"errors": 0},
    )
    monkeypatch.setattr(
        backend,
        "_pa_pipeline_outcome",
        lambda summary: (_ for _ in ()).throw(RuntimeError("finalizer failed")),
    )

    try:
        with pytest.raises(RuntimeError, match="finalizer failed"):
            backend._pa_execute_and_save(
                uid,
                {"enabled": True},
                30,
                "ai",
                trigger="auto_run_now",
                trade_mode="paper",
                run_id="executor-finalizer-run",
            )

        assert backend._pa_user_run_is_reserved(uid) is False
        assert backend._pa_current_user_reservation_token(uid) is None
        assert backend._pa_get_user_runtime_backoff(uid)["reason"] == (
            "pipeline_executor_finalization_failed"
        )
    finally:
        backend._pa_clear_user_runtime_backoff(uid)
        backend._pa_release_user_run(uid)


def test_managed_position_plan_persists_in_existing_pipeline_config(monkeypatch):
    saved = []
    monkeypatch.setattr(
        backend,
        "_pa_get_config",
        lambda uid: {
            "enabled": True,
            "interval_minutes": 30,
            "managed_positions": {
                "paper:MSFT": {"symbol": "MSFT", "updatedAt": "2026-07-12T10:00:00+00:00"},
            },
        },
    )
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda uid, config: saved.append((uid, dict(config))) or (True, ""),
    )

    success = backend._pa_persist_managed_position_to_config(
        "user-1",
        "real",
        "AAPL",
        {
            "symbol": "AAPL",
            "tradeMode": "real",
            "stopLoss": 95,
            "takeProfit1": 112,
            "updatedAt": "2026-07-12T12:00:00+00:00",
        },
    )

    assert success is True
    assert saved[-1][0] == "user-1"
    config = saved[-1][1]
    assert config["enabled"] is True
    assert config["managed_positions_version"] == 2
    assert config["managed_positions"]["paper:MSFT"]["symbol"] == "MSFT"
    assert config["managed_positions"]["real:AAPL"]["stopLoss"] == 95


def test_runtime_restore_marks_inflight_pipeline_interrupted(monkeypatch, tmp_path):
    runtime_path = tmp_path / "pipeline_runtime_state.json"
    runtime_path.write_text(json.dumps({
        "restart-user": {
            "runId": "run-before-restart",
            "status": "running",
            "currentStep": "deeper_validation",
        }
    }), encoding="utf-8")
    monkeypatch.setattr(backend, "_PA_RUNTIME_STATE_PATH", str(runtime_path))

    try:
        backend._pa_restore_runtime_state()
        restored = backend._PA_ACTIVE_RUNS["restart-user"]
        assert restored["status"] == "interrupted"
        assert restored["lastError"] == "backend_restart"
        assert restored["totalSteps"] == 7
        assert set(restored["steps"]) == {
            "market_scanner",
            "fine_scan",
            "deeper_validation",
            "admission",
            "entry_plan",
            "execution",
            "exit_scan",
        }
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.pop("restart-user", None)


def test_scheduler_health_requires_a_live_thread_and_fresh_heartbeat(monkeypatch):
    class AliveThread:
        @staticmethod
        def is_alive():
            return True

    monkeypatch.setattr(backend, "_PA_SCHEDULER_THREAD", AliveThread())
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_HEARTBEAT", 990.0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_COMPLETED_AT", 980.0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_ERROR", "")
    monkeypatch.setattr(backend, "_PA_SCHEDULER_CONSECUTIVE_ERRORS", 0)
    monkeypatch.setattr(backend, "_pa_read_shared_scheduler_heartbeat", lambda: {})

    healthy = backend._pa_scheduler_health_snapshot(now_ts=1000.0)
    stale = backend._pa_scheduler_health_snapshot(now_ts=1200.0)

    assert healthy["running"] is True
    assert healthy["threadAlive"] is True
    assert healthy["heartbeatAgeSeconds"] == 10.0
    assert healthy["lastCompletedTickAt"]
    assert stale["running"] is False
    assert stale["threadAlive"] is True


def test_scheduler_health_reads_master_process_heartbeat(monkeypatch):
    class StaleWorkerThread:
        @staticmethod
        def is_alive():
            return False

    monkeypatch.setattr(backend, "_PA_SCHEDULER_THREAD", StaleWorkerThread())
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_HEARTBEAT", 0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_COMPLETED_AT", 0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_ERROR", "")
    monkeypatch.setattr(backend, "_PA_SCHEDULER_CONSECUTIVE_ERRORS", 0)
    monkeypatch.setattr(
        backend,
        "_pa_read_shared_scheduler_heartbeat",
        lambda: {
            "heartbeat": 990.0,
            "completedAt": 980.0,
            "lastError": "",
            "loopCount": 12,
        },
    )

    healthy = backend._pa_scheduler_health_snapshot(now_ts=1000.0)
    stale = backend._pa_scheduler_health_snapshot(now_ts=1200.0)

    assert healthy["running"] is True
    assert healthy["threadAlive"] is True
    assert healthy["source"] == "shared_heartbeat"
    assert healthy["heartbeatAgeSeconds"] == 10.0
    assert healthy["loopCount"] == 12
    assert stale["running"] is False
    assert stale["threadAlive"] is False


def test_scheduler_health_fails_after_three_completed_tick_errors(monkeypatch):
    class AliveThread:
        @staticmethod
        def is_alive():
            return True

    monkeypatch.setattr(backend, "_PA_SCHEDULER_THREAD", AliveThread())
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_HEARTBEAT", 995.0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_COMPLETED_AT", 980.0)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_LAST_ERROR", "scheduler_user_discovery_failed")
    monkeypatch.setattr(backend, "_PA_SCHEDULER_CONSECUTIVE_ERRORS", 3)
    monkeypatch.setattr(backend, "_pa_read_shared_scheduler_heartbeat", lambda: {})

    snapshot = backend._pa_scheduler_health_snapshot(now_ts=1000.0)

    assert snapshot["threadAlive"] is True
    assert snapshot["heartbeatAgeSeconds"] == 5.0
    assert snapshot["consecutiveErrors"] == 3
    assert snapshot["running"] is False


def test_scheduler_start_is_singleton(monkeypatch):
    _TrackedThread.starts = 0
    monkeypatch.setattr(backend, "_PA_SCHEDULER_STARTED", False)
    monkeypatch.setattr(backend, "_PA_SCHEDULER_THREAD", None)
    monkeypatch.setattr(backend.threading, "Thread", _TrackedThread)

    backend._pa_ensure_scheduler()
    first_thread = backend._PA_SCHEDULER_THREAD
    backend._pa_ensure_scheduler()

    assert _TrackedThread.starts == 1
    assert backend._PA_SCHEDULER_THREAD is first_thread
    assert first_thread.is_alive() is True


def test_reserved_thread_start_failure_releases_only_its_token(monkeypatch):
    uid = "thread-start-failure-user"
    token = "reservation-token-1"
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.add(uid)
        backend._PA_RUNNING_USER_TOKENS[uid] = token
        backend._PA_RUNNING_USER_SOURCES[uid] = "pipeline_endpoint"
    monkeypatch.setattr(backend.threading, "Thread", _FailingStartThread)

    with pytest.raises(RuntimeError, match="thread start failed"):
        backend._pa_start_reserved_thread(
            uid,
            lambda: None,
            daemon=True,
        )

    assert backend._pa_user_run_is_reserved(uid) is False
    assert backend._pa_current_user_reservation_token(uid) is None


def test_reserved_thread_preflight_failure_releases_only_original_run(monkeypatch):
    uid = "thread-preflight-failure-user"
    token = "reservation-token-2"
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.add(uid)
        backend._PA_RUNNING_USER_TOKENS[uid] = token
        backend._PA_RUNNING_USER_SOURCES[uid] = "pipeline_endpoint"
    monkeypatch.setattr(backend.threading, "Thread", _ImmediateThread)

    def fail_before_executor():
        raise RuntimeError("config preflight failed")

    with pytest.raises(RuntimeError, match="config preflight failed"):
        backend._pa_start_reserved_thread(
            uid,
            fail_before_executor,
            daemon=True,
        )

    assert backend._pa_user_run_is_reserved(uid) is False
    assert backend._pa_current_user_reservation_token(uid) is None


def test_readiness_fails_with_safe_component_diagnostics(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_scheduler_health_snapshot",
        lambda: {
            "running": False,
            "threadAlive": True,
            "heartbeatAgeSeconds": 180,
            "lastError": "stale",
        },
    )
    monkeypatch.setattr(
        backend,
        "_supabase_dependency_snapshot",
        lambda: {
            "required": True,
            "configured": True,
            "healthy": True,
            "status": "ready",
        },
    )
    monkeypatch.setattr(backend, "_backend_current_rss_mb", lambda: 512)
    monkeypatch.setattr(backend, "_BACKEND_MEMORY_ABORT_LIMIT_MB", 3_700)
    monkeypatch.setattr(
        backend,
        "_background_thread_readiness_snapshot",
        lambda: {"required": True, "healthy": True},
    )

    response = backend.app.test_client().get("/api/ready")
    payload = response.get_json()

    assert response.status_code == 503
    assert payload["status"] == "not_ready"
    assert payload["components"]["scheduler"]["healthy"] is False
    assert payload["components"]["persistence"]["healthy"] is True
    assert payload["components"]["threads"]["healthy"] is True
    assert payload["components"]["migrations"]["healthy"] is True
    assert payload["components"]["leases"]["healthy"] is True
    assert payload["components"]["memory"]["healthy"] is True


def test_readiness_is_200_when_required_dependencies_are_healthy(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_scheduler_health_snapshot",
        lambda: {"running": True, "heartbeatAgeSeconds": 5},
    )
    monkeypatch.setattr(
        backend,
        "_supabase_dependency_snapshot",
        lambda: {
            "required": True,
            "configured": True,
            "healthy": True,
            "status": "ready",
        },
    )
    monkeypatch.setattr(backend, "_backend_current_rss_mb", lambda: 512)
    monkeypatch.setattr(backend, "_BACKEND_MEMORY_ABORT_LIMIT_MB", 3_700)
    monkeypatch.setattr(
        backend,
        "_background_thread_readiness_snapshot",
        lambda: {"required": True, "healthy": True},
    )

    response = backend.app.test_client().get("/api/ready")

    assert response.status_code == 200
    assert response.get_json()["status"] == "ready"
    assert response.headers["Cache-Control"] == "no-store, max-age=0"
    assert response.headers["Pragma"] == "no-cache"


def test_supabase_readiness_requires_two_final_failures_and_recovers(monkeypatch):
    class Query:
        should_fail = True

        def select(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.should_fail:
                raise TimeoutError("probe timed out")
            return {"data": []}

    query = Query()

    class Client:
        def table(self, _name):
            return query

        def rpc(self, _name, _arguments):
            return query

    monkeypatch.setattr(backend, "supabase_admin", Client())
    monkeypatch.setattr(backend, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(backend, "SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setattr(backend, "_strict_production_runtime", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(backend, "_SUPABASE_LAST_SUCCESS_AT", 0.0)
    monkeypatch.setattr(backend, "_SUPABASE_LAST_FAILURE_AT", 0.0)
    monkeypatch.setattr(backend, "_SUPABASE_CONSECUTIVE_FAILURES", 0)
    monkeypatch.setattr(backend, "_SUPABASE_LAST_FAILURE_LABEL", "")
    monkeypatch.setattr(backend, "_SUPABASE_LAST_FAILURE_TYPE", "")
    monkeypatch.setattr(
        backend,
        "_SUPABASE_READINESS_CACHE",
        {"checkedAt": 0.0, "probeOk": None},
    )

    first = backend._supabase_dependency_snapshot(force_probe=True)
    second = backend._supabase_dependency_snapshot(force_probe=True)
    query.should_fail = False
    recovered = backend._supabase_dependency_snapshot(force_probe=True)

    assert first["healthy"] is True
    assert first["consecutiveFailures"] == 1
    assert second["healthy"] is False
    assert second["consecutiveFailures"] == 2
    assert recovered["healthy"] is True
    assert recovered["consecutiveFailures"] == 0
    assert recovered["migrations"]["healthy"] is True
    assert recovered["leases"]["healthy"] is True


def test_supabase_readiness_fails_immediately_for_missing_lease_migration(monkeypatch):
    class Query:
        def select(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return {"data": []}

    class MissingRpc:
        def execute(self):
            raise RuntimeError(
                "PGRST202 could not find the function public.renew_app_worker_lease"
            )

    class Client:
        def table(self, _name):
            return Query()

        def rpc(self, _name, _arguments):
            return MissingRpc()

    monkeypatch.setattr(backend, "supabase_admin", Client())
    monkeypatch.setattr(backend, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(backend, "SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setattr(
        backend, "_strict_production_runtime", lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        backend,
        "_SUPABASE_READINESS_CACHE",
        {"checkedAt": 0.0, "probeOk": None},
    )

    snapshot = backend._supabase_dependency_snapshot(force_probe=True)

    assert snapshot["healthy"] is True  # one transient dependency grace remains
    assert snapshot["migrations"]["healthy"] is False
    assert snapshot["migrations"]["contractFailure"] is True
    assert snapshot["leases"]["healthy"] is False
