#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="${ALPHALAB_REPO_DIR:-/opt/alphalab/repo}"
compose_file="$repo_dir/deploy/lightsail/compose.yaml"

if curl --fail --silent --max-time 5 http://127.0.0.1:8080/api/health >/dev/null; then
  exit 0
fi

echo "AlphaLab liveness check failed; restarting the app container" >&2
docker compose --file "$compose_file" restart app
