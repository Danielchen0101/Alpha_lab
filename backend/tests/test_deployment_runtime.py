import json
import os
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_container_uses_single_scheduler_worker_and_real_health_route():
    start_script = (ROOT / "docker" / "start.sh").read_text(encoding="utf-8")
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "--workers 1" in start_script
    assert "--workers 4" not in start_script
    assert "--threads 4" in start_script
    assert 'MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"' in start_script
    assert "127.0.0.1:5000/api/health" in start_script
    assert "127.0.0.1:8080/api/health" in start_script
    assert "/api/system/status" not in start_script
    assert "127.0.0.1:8080/api/health" in dockerfile
    assert "FROM node:20-alpine" in dockerfile
    assert "ARG REACT_APP_SUPABASE_URL" in dockerfile
    assert "COPY --from=backend-builder /usr/local/bin /usr/local/bin" in dockerfile
    assert "command -v gunicorn" in start_script


def test_container_context_excludes_local_dependencies_and_secrets():
    dockerignore = (ROOT / ".dockerignore").read_text(encoding="utf-8")

    assert "**/.env" in dockerignore
    assert "frontend/node_modules" in dockerignore
    assert "backend/.venv" in dockerignore
    assert "backend/pipeline_runtime_state.json" in dockerignore
    assert "backend/*.json" in dockerignore
    assert "backend/*_config.json" in dockerignore
    assert "backend/*_state.json" in dockerignore
    assert "backend/*.lock" in dockerignore
    assert "backend/.*.lock" in dockerignore


def test_nginx_has_no_backend_port_collision_and_supports_supabase():
    nginx = (ROOT / "docker" / "nginx.conf").read_text(encoding="utf-8")

    assert "listen 5000" not in nginx
    assert "proxy_pass http://127.0.0.1:5000" in nginx
    assert "proxy_read_timeout 900s" in nginx
    assert "pid /tmp/nginx.pid" in nginx
    assert "https://nwpxjqgqegxttucsmvmp.supabase.co" in nginx
    assert "wss://nwpxjqgqegxttucsmvmp.supabase.co" in nginx


def test_render_start_command_keeps_scheduler_singleton():
    deployment = (ROOT / "DEPLOYMENT.md").read_text(encoding="utf-8")
    gunicorn_config = (
        ROOT / "backend" / "gunicorn.conf.py"
    ).read_text(encoding="utf-8")

    assert "MALLOC_ARENA_MAX=2 gunicorn" in deployment
    assert "--workers 1 --threads 4 --timeout 900" in deployment
    assert "only one scheduler" in deployment
    assert "always-on paid web-service instance" in deployment
    assert "SUPABASE_SERVICE_ROLE_KEY" in deployment
    assert "FERNET_KEY" in deployment
    assert "managed stop/target plans are" in deployment
    assert "preload_app = False" in gunicorn_config
    assert "def post_worker_init(worker):" in gunicorn_config
    assert "start_background_services()" in gunicorn_config


@pytest.mark.skipif(os.name != "posix", reason="Gunicorn requires a POSIX runtime")
def test_gunicorn_preload_starts_all_schedulers_inside_worker(tmp_path):
    """Exercise the production master/worker fork that unit tests cannot model."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    environment = os.environ.copy()
    for key in tuple(environment):
        if key.startswith("RENDER"):
            environment.pop(key, None)
    for key in (
        "ALPHALAB_DISABLE_CRYPTO_SCHEDULER",
        "ALPHALAB_DISABLE_KALSHI_SCHEDULER",
        "GUNICORN_CMD_ARGS",
    ):
        environment.pop(key, None)
    environment.update({
        "APP_ENV": "test",
        "FLASK_ENV": "test",
        "SUPABASE_URL": "",
        "SUPABASE_SERVICE_ROLE_KEY": "",
        "ALPACA_API_KEY": "",
        "ALPACA_API_SECRET": "",
        "FINNHUB_API_KEY": "",
        "ALPHALAB_RUNTIME_LOCK_DIR": str(tmp_path),
        "CRYPTO_SCHEDULER_LOCK_PATH": str(tmp_path / "crypto-scheduler.lock"),
        "ALPHALAB_ENABLE_TEST_BACKGROUND_SERVICES": "1",
        "PYTHONUNBUFFERED": "1",
    })

    command = [
        sys.executable,
        "-m",
        "gunicorn",
        "--preload",
        "--workers",
        "1",
        "--threads",
        "2",
        "--bind",
        f"127.0.0.1:{port}",
        "--timeout",
        "60",
        "--access-logfile",
        "-",
        "--error-logfile",
        "-",
        "start_quant_backend:app",
    ]
    log_path = tmp_path / "gunicorn-preload.log"
    with log_path.open("w+", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            command,
            cwd=ROOT / "backend",
            env=environment,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        deadline = time.monotonic() + 35
        payload = None
        worker_pid = None
        try:
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    break
                output = log_path.read_text(
                    encoding="utf-8",
                    errors="replace",
                )
                match = re.search(
                    r"\[Runtime\] background schedulers started in serving "
                    r"worker pid=(\d+)",
                    output,
                )
                if match:
                    worker_pid = int(match.group(1))
                    break
                time.sleep(0.1)

            assert worker_pid is not None, (
                "Gunicorn post_worker_init did not start the schedulers before "
                "the first HTTP request"
            )
            assert worker_pid != process.pid

            while time.monotonic() < deadline:
                if process.poll() is not None:
                    break
                try:
                    with urllib.request.urlopen(
                        f"http://127.0.0.1:{port}/api/health",
                        timeout=2,
                    ) as response:
                        payload = json.load(response)
                    threads = (payload or {}).get("threads") or {}
                    equity = threads.get("equityScheduler") or {}
                    crypto = threads.get("cryptoScheduler") or {}
                    kalshi = threads.get("kalshiScheduler") or {}
                    if (
                        equity.get("threadAlive") is True
                        and equity.get("source") == "process_local"
                        and crypto.get("schedulerAlive") is True
                        and crypto.get("schedulerCommandsAvailable") is True
                        and kalshi.get("threadAlive") is True
                        and kalshi.get("schedulerLeaseCheckedAt")
                    ):
                        break
                except (OSError, urllib.error.URLError, json.JSONDecodeError):
                    time.sleep(0.25)

            if payload is None:
                log_file.flush()
                log_file.seek(0)
                output = log_file.read()
                pytest.fail(
                    "Gunicorn worker did not become healthy after preload fork:\n"
                    + output[-4000:]
                )

            threads = payload["threads"]
            assert threads["equityScheduler"]["threadAlive"] is True
            assert threads["equityScheduler"]["source"] == "process_local"
            assert threads["cryptoScheduler"]["schedulerAlive"] is True
            assert threads["cryptoScheduler"]["schedulerCommandsAvailable"] is True
            assert threads["kalshiScheduler"]["threadAlive"] is True
            assert threads["kalshiScheduler"]["schedulerLeaseCheckedAt"]
        finally:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=5)


def test_supabase_schema_has_explicit_data_api_grants_and_owner_rls():
    schema = (ROOT / "backend" / "supabase_schema.sql").read_text(encoding="utf-8")

    assert "TO authenticated" in schema
    assert "USING ((SELECT auth.uid()) = user_id)" in schema
    assert "WITH CHECK ((SELECT auth.uid()) = user_id)" not in schema
    assert "GRANT SELECT ON TABLE user_pipeline_auto_configs TO authenticated" in schema
    assert "REVOKE ALL ON TABLE user_pipeline_auto_configs FROM anon, authenticated" in schema
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_pipeline_auto_configs TO service_role" in schema
    assert "GRANT SELECT ON TABLE user_pipeline_auto_runs TO authenticated" in schema
    assert "GRANT SELECT, INSERT ON TABLE user_pipeline_auto_runs TO authenticated" not in schema


def test_supabase_hardening_migration_revokes_browser_writes_and_anon_access():
    migration = (ROOT / "backend" / "supabase_security_hardening.sql").read_text(encoding="utf-8")

    for table in (
        "user_api_configs",
        "user_auto_scan_configs",
        "user_auto_scan_runs",
        "user_pipeline_auto_configs",
        "user_pipeline_auto_runs",
        "user_operations_safety_state",
        "user_operations_audit_events",
        "user_notification_delivery_events",
        "user_order_lifecycle_events",
        "user_readiness_status",
        "user_operation_artifacts",
    ):
        assert table in migration
    assert "REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated" in migration
    assert "GRANT SELECT ON TABLE public.%I TO authenticated" in migration
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role" in migration
