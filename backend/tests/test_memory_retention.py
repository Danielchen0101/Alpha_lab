import time
import json

import start_quant_backend as backend


def test_active_run_scanner_step_keeps_summary_not_full_rows(monkeypatch):
    uid = "memory-active-run"
    monkeypatch.setattr(backend, "_pa_persist_runtime_state", lambda: None)
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS.pop(uid, None)

    backend._pa_update_active_run(
        uid,
        steps={
            "market_scanner": {
                "status": "completed",
                "processed": 1500,
                "results": [{"symbol": "AAPL", "payload": "large"}, {"symbol": "MSFT"}],
            }
        },
    )

    scanner_step = backend._pa_get_active_run(uid)["steps"]["market_scanner"]
    assert "results" not in scanner_step
    assert scanner_step["resultCount"] == 2
    assert scanner_step["topSymbols"] == ["AAPL", "MSFT"]


def test_pipeline_debug_cache_keeps_only_recent_runs_per_user(monkeypatch):
    monkeypatch.setattr(backend, "_PA_LAST_PIPELINE_RESULTS_MAX_RUNS_PER_USER", 2)
    monkeypatch.setattr(backend, "_PA_LAST_PIPELINE_RESULTS_MAX_ENTRIES", 24)
    monkeypatch.setattr(backend, "_PA_LAST_PIPELINE_RESULTS_TTL_SECONDS", 3600)
    with backend._PA_LAST_PIPELINE_RESULTS_LOCK:
        backend._PA_LAST_PIPELINE_RESULTS.clear()
        backend._PA_LAST_PIPELINE_RESULT_TIMESTAMPS.clear()

    for index in range(4):
        backend._pa_cache_pipeline_debug_dump(
            "memory-user",
            f"run-{index}",
            "manual",
            {"runId": f"run-{index}", "payload": index},
        )

    with backend._PA_LAST_PIPELINE_RESULTS_LOCK:
        run_keys = {
            key for key in backend._PA_LAST_PIPELINE_RESULTS
            if key[0] == "memory-user" and not str(key[1]).startswith("__last")
        }
        assert len(run_keys) == 2
        assert ("memory-user", "run-3") in run_keys
        assert backend._PA_LAST_PIPELINE_RESULTS[("memory-user", "__last__")]["runId"] == "run-3"


def test_simple_cache_expires_and_caps_entries():
    cache = backend.SimpleCache(ttl_seconds=60, max_entries=2)
    cache.set("old", 1)
    cache.set("keep", 2)
    with cache.lock:
        cache.timestamps["old"] = time.time() - 61
    cache.set("new", 3)

    assert cache.get("old") is None
    assert cache.get("keep") == 2
    assert cache.get("new") == 3
    assert len(cache.cache) == 2


def test_in_memory_backtest_history_limit_is_twenty():
    assert backend.MAX_HISTORY_SIZE == 20


def test_restore_marks_queued_run_interrupted(tmp_path, monkeypatch):
    uid = "queued-before-restart"
    state_path = tmp_path / "pipeline_runtime_state.json"
    state_path.write_text(
        json.dumps({
            uid: {
                "runId": "queued-run",
                "status": "queued",
                "steps": backend._pa_initial_steps(),
            }
        }),
        encoding="utf-8",
    )
    monkeypatch.setattr(backend, "_PA_RUNTIME_STATE_PATH", str(state_path))
    with backend._PA_ACTIVE_RUNS_LOCK:
        backend._PA_ACTIVE_RUNS.pop(uid, None)

    backend._pa_restore_runtime_state()

    restored = backend._pa_get_active_run(uid)
    assert restored["status"] == "interrupted"
    assert restored["lastError"] == "backend_restart"


def test_active_run_cache_caps_terminal_history(monkeypatch):
    monkeypatch.setattr(backend, "_PA_ACTIVE_RUNS_MAX_ENTRIES", 2)
    users = ["old-active-run", "new-active-run", "current-active-run"]
    original_runs = {}
    try:
        with backend._PA_ACTIVE_RUNS_LOCK:
            original_runs = dict(backend._PA_ACTIVE_RUNS)
            backend._PA_ACTIVE_RUNS.clear()
            backend._PA_ACTIVE_RUNS[users[0]] = {
                "status": "completed",
                "updatedAt": "2026-07-01T00:00:00+00:00",
            }
            backend._PA_ACTIVE_RUNS[users[1]] = {
                "status": "completed",
                "updatedAt": "2026-07-02T00:00:00+00:00",
            }
            backend._PA_ACTIVE_RUNS[users[2]] = {
                "status": "running",
                "updatedAt": "2026-07-03T00:00:00+00:00",
            }
            backend._pa_prune_active_runs_locked()
            remaining = {uid for uid in users if uid in backend._PA_ACTIVE_RUNS}
    finally:
        with backend._PA_ACTIVE_RUNS_LOCK:
            backend._PA_ACTIVE_RUNS.clear()
            backend._PA_ACTIVE_RUNS.update(original_runs)

    assert remaining == {users[1], users[2]}
