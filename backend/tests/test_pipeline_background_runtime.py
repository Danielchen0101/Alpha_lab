import json
import sys
from datetime import datetime, timedelta, timezone

import pytest

import start_quant_backend as backend


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
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
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
    assert saved[-1]["live_auto_trading_enabled"] is False
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
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
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
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
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
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
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
    monkeypatch.setattr(backend, "require_auth", lambda: {"id": "user-1"})
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
    assert response.get_json()["reason"] == "supabase_write_failed"


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
    }

    assert backend._discord_event_enabled(config, "order_AAPL") is True
    assert backend._discord_event_enabled(config, "risk_alert") is False
    assert backend._discord_event_enabled(config, "error") is False
    assert backend._discord_event_enabled(config, "cycle_digest") is True


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
        "quietMode": True,
    }


def test_headless_pipeline_initializes_stage_timeout_tracking(monkeypatch):
    updates = []

    monkeypatch.setattr(backend, "_pa_clear_active_run", lambda uid: None)
    monkeypatch.setattr(backend, "_pa_update_active_run", lambda uid, **kwargs: updates.append(kwargs))
    monkeypatch.setattr(backend, "_pa_check_stop_requested", lambda uid: False)
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
        {"enabled": True},
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
    assert saved_configs[0]["position_guard_alert_fingerprint"]
    assert releases == ["user-1"]
    assert backend._PA_POSITION_GUARD_STATE["user-1"]["running"] is False


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
    assert config["managed_positions_version"] == 1
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
