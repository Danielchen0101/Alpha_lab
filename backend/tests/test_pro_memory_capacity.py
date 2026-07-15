import pytest

import start_quant_backend as backend


def test_health_reports_memory_budget_and_scan_capacity(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(2)
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(backend, "_backend_current_rss_mb", lambda: 512.25)

    response = backend.app.test_client().get("/api/health")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["status"] == "ok"
    assert payload["memory"]["rssMb"] == 512.2
    assert payload["memory"]["planMb"] == backend._BACKEND_PLAN_MEMORY_MB
    assert payload["memory"]["pressure"] is False
    assert payload["scannerCapacity"] == {"active": 0, "capacity": 2, "available": 2}
    assert payload["heavyWorkCapacity"] == payload["scannerCapacity"]


def test_pro_scan_capacity_allows_two_heavy_scans_and_rejects_third():
    limiter = backend._InstitutionalScanCapacity(2)

    assert limiter.acquire(0) is True
    assert limiter.acquire(0) is True
    assert limiter.acquire(0) is False
    assert limiter.snapshot() == {"active": 2, "capacity": 2, "available": 0}

    assert limiter.release() is True
    assert limiter.acquire(0) is True
    assert limiter.release() is True
    assert limiter.release() is True
    assert limiter.release() is False


def test_full_pipelines_share_the_same_two_pro_slots(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(2)
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    users = ["capacity-user-1", "capacity-user-2", "capacity-user-3"]
    with backend._PA_RUNNING_USERS_LOCK:
        for uid in users:
            backend._PA_RUNNING_USERS.discard(uid)
            backend._PA_HEAVY_PIPELINE_USERS.discard(uid)

    try:
        assert backend._pa_try_reserve_user_run(users[0], "scheduler") is True
        assert backend._pa_try_reserve_user_run(users[1], "pipeline_endpoint") is True
        assert backend._pa_try_reserve_user_run(users[2], "scheduler") is False
        assert limiter.snapshot()["active"] == 2
        assert backend._pa_user_owns_heavy_capacity(users[0]) is True

        backend._pa_release_user_run(users[0])
        assert backend._pa_try_reserve_user_run(users[2], "scheduler") is True
        assert limiter.snapshot()["active"] == 2
    finally:
        for uid in users:
            backend._pa_release_user_run(uid)

    assert limiter.snapshot()["active"] == 0


def test_execute_and_save_releases_once_when_final_config_write_fails(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(1)
    uid = "capacity-final-save-user"
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(backend, "_backend_enforce_memory_budget", lambda _stage: 100)
    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: {})
    monkeypatch.setattr(
        backend,
        "_pa_run_pipeline",
        lambda *_args, **_kwargs: {"errors": 0},
    )
    monkeypatch.setattr(
        backend,
        "_pa_save_config",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("save failed")),
    )
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.discard(uid)
        backend._PA_HEAVY_PIPELINE_USERS.discard(uid)

    assert backend._pa_try_reserve_user_run(uid, "pipeline_endpoint") is True
    with pytest.raises(RuntimeError, match="save failed"):
        backend._pa_execute_and_save(uid, {}, 15, "ai", trigger="manual")

    assert backend._pa_user_run_is_reserved(uid) is False
    assert backend._pa_user_owns_heavy_capacity(uid) is False
    assert limiter.snapshot()["active"] == 0


def test_new_pipeline_is_deferred_while_memory_stays_above_soft_limit(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(2)
    uid = "memory-admission-user"
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(
        backend,
        "_backend_enforce_memory_budget",
        lambda _stage: backend._BACKEND_MEMORY_SOFT_LIMIT_MB + 1,
    )
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.discard(uid)
        backend._PA_HEAVY_PIPELINE_USERS.discard(uid)

    assert backend._pa_try_reserve_user_run(uid, "scheduler") is False
    assert backend._pa_user_run_is_reserved(uid) is False
    assert limiter.snapshot()["active"] == 0


def test_headless_scanner_reuses_pipeline_slot_without_double_acquire(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(1)
    uid = "capacity-headless-user"
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(backend, "_backend_enforce_memory_budget", lambda _stage: 100)
    monkeypatch.setattr(
        backend,
        "_backend_release_unused_memory",
        lambda trim=False: {"trimmed": trim, "rssMb": 100},
    )
    monkeypatch.setattr(
        backend,
        "_institutional_market_scanner_impl",
        lambda: backend.jsonify({"success": True}),
    )
    with backend._PA_RUNNING_USERS_LOCK:
        backend._PA_RUNNING_USERS.discard(uid)
        backend._PA_HEAVY_PIPELINE_USERS.discard(uid)

    assert backend._pa_try_reserve_user_run(uid, "scheduler") is True
    try:
        with backend.app.test_request_context("/api/market/scanner", method="POST", json={}):
            with backend.headless_user_context(uid):
                response = backend.institutional_market_scanner()
        assert response.get_json()["success"] is True
        assert limiter.snapshot()["active"] == 1
    finally:
        backend._pa_release_user_run(uid)

    assert limiter.snapshot()["active"] == 0


def test_memory_guard_collects_then_aborts_before_render_hard_limit(monkeypatch):
    monkeypatch.setattr(backend, "_BACKEND_MEMORY_SOFT_LIMIT_MB", 3200)
    monkeypatch.setattr(backend, "_BACKEND_MEMORY_ABORT_LIMIT_MB", 3700)
    monkeypatch.setattr(backend, "_backend_current_rss_mb", lambda: 3300)
    monkeypatch.setattr(
        backend,
        "_backend_release_unused_memory",
        lambda trim=False: {"collected": 10, "trimmed": trim, "rssMb": 3750},
    )

    with pytest.raises(backend._BackendMemoryPressure) as exc_info:
        backend._backend_enforce_memory_budget("test_stage")

    assert exc_info.value.stage == "test_stage"
    assert exc_info.value.rss_mb == 3750


def test_scanner_returns_retryable_429_when_pro_capacity_is_full(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(1)
    assert limiter.acquire(0) is True
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(backend, "_INST_SCANNER_INTERACTIVE_WAIT_SECONDS", 0)

    with backend.app.test_request_context("/api/market/scanner", method="POST", json={}):
        response, status, headers = backend.institutional_market_scanner()

    payload = response.get_json()
    assert status == 429
    assert headers["Retry-After"] == "15"
    assert payload["error"] == "scanner_capacity_busy"
    assert payload["activeScans"] == 1
    assert payload["maxConcurrentScans"] == 1
    assert limiter.release() is True


def test_scanner_releases_slot_and_memory_on_pressure(monkeypatch):
    limiter = backend._InstitutionalScanCapacity(1)
    release_calls = []
    monkeypatch.setattr(backend, "_INST_SCANNER_CAPACITY", limiter)
    monkeypatch.setattr(
        backend,
        "_backend_enforce_memory_budget",
        lambda stage: (_ for _ in ()).throw(backend._BackendMemoryPressure(stage, 3800)),
    )
    monkeypatch.setattr(
        backend,
        "_backend_release_unused_memory",
        lambda trim=False: release_calls.append(trim) or {"rssMb": 100},
    )

    with backend.app.test_request_context("/api/market/scanner", method="POST", json={}):
        response, status, headers = backend.institutional_market_scanner()

    assert status == 503
    assert headers["Retry-After"] == "30"
    assert response.get_json()["error"] == "backend_memory_pressure"
    assert limiter.snapshot()["active"] == 0
    assert release_calls == [True]


def test_streaming_batch_preserves_compute_error_over_memory_guard(monkeypatch):
    def fake_batches(*_args, **_kwargs):
        yield ["AAA"], {"AAA": [{"t": "2026-07-01", "c": 10}]}, {}

    monkeypatch.setattr(backend, "_inst_iter_alpaca_bar_batches", fake_batches)
    monkeypatch.setattr(
        backend,
        "_inst_compute_symbol_metrics",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("metric bug")),
    )
    monkeypatch.setattr(
        backend,
        "_backend_enforce_memory_budget",
        lambda _stage: (_ for _ in ()).throw(backend._BackendMemoryPressure("batch", 3800)),
    )
    monkeypatch.setattr(
        backend,
        "_backend_release_unused_memory",
        lambda trim=False: {"trimmed": trim, "rssMb": 100},
    )

    with pytest.raises(ValueError, match="metric bug"):
        backend._inst_stream_alpaca_symbol_metrics(
            ["AAA"],
            {},
            {"AAA": {}},
            {"AAA": {}},
            {},
        )


def test_headless_stream_honors_stop_between_batches(monkeypatch):
    history = {"AAA": [{"t": "2026-07-01", "c": 10}]}

    def fake_batches(*_args, **_kwargs):
        yield ["AAA"], history, {}

    monkeypatch.setattr(backend, "_inst_iter_alpaca_bar_batches", fake_batches)
    monkeypatch.setattr(backend, "_pa_check_stop_requested", lambda _uid: True)

    with backend.headless_user_context("stopped-headless-user"):
        with pytest.raises(backend._BackendScanCancelled):
            backend._inst_stream_alpaca_symbol_metrics(
                ["AAA"],
                {},
                {"AAA": {}},
                {"AAA": {}},
                {},
            )

    assert history == {}
