from pathlib import Path


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


def test_nginx_has_no_backend_port_collision_and_supports_supabase():
    nginx = (ROOT / "docker" / "nginx.conf").read_text(encoding="utf-8")

    assert "listen 5000" not in nginx
    assert "proxy_pass http://127.0.0.1:5000" in nginx
    assert "proxy_read_timeout 900s" in nginx
    assert "pid /tmp/nginx.pid" in nginx
    assert "https://*.supabase.co" in nginx
    assert "wss://*.supabase.co" in nginx


def test_render_start_command_keeps_scheduler_singleton():
    deployment = (ROOT / "DEPLOYMENT.md").read_text(encoding="utf-8")

    assert "MALLOC_ARENA_MAX=2 gunicorn" in deployment
    assert "--workers 1 --threads 4 --timeout 900" in deployment
    assert "only one scheduler" in deployment
    assert "always-on paid web-service instance" in deployment
    assert "SUPABASE_SERVICE_ROLE_KEY" in deployment
    assert "FERNET_KEY" in deployment
    assert "managed stop/target plans are" in deployment


def test_supabase_schema_has_explicit_data_api_grants_and_owner_rls():
    schema = (ROOT / "backend" / "supabase_schema.sql").read_text(encoding="utf-8")

    assert "TO authenticated" in schema
    assert "USING ((SELECT auth.uid()) = user_id)" in schema
    assert "WITH CHECK ((SELECT auth.uid()) = user_id)" in schema
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE user_pipeline_auto_configs TO authenticated" in schema
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_pipeline_auto_configs TO service_role" in schema
    assert "GRANT SELECT, INSERT ON TABLE user_pipeline_auto_runs TO authenticated" in schema
