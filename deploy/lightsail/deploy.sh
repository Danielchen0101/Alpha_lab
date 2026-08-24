#!/usr/bin/env bash
set -Eeuo pipefail

exec 9>/var/lock/alphalab-deploy.lock
flock -n 9 || exit 0

repo_dir="${ALPHALAB_REPO_DIR:-/opt/alphalab/repo}"
compose_file="$repo_dir/deploy/lightsail/compose.yaml"
env_file="${ALPHALAB_ENV_FILE:-/etc/alphalab/alphalab.env}"
deployed_file="/var/lib/alphalab/deployed-sha"
require_ci="${ALPHALAB_REQUIRE_CI:-1}"

mkdir -p /var/lib/alphalab
cd "$repo_dir"
git fetch --quiet origin main
target_sha="$(git rev-parse origin/main)"
current_sha="$(cat "$deployed_file" 2>/dev/null || true)"

if [[ "$target_sha" == "$current_sha" ]]; then
  exit 0
fi

if [[ "$require_ci" == "1" ]]; then
  ci_conclusion="$(
    curl --fail --silent --show-error \
      -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/Danielchen0101/Alpha_lab/actions/workflows/ci.yml/runs?head_sha=$target_sha&branch=main&status=completed&per_page=5" \
      | jq -r '.workflow_runs[0].conclusion // "pending"'
  )"
  if [[ "$ci_conclusion" != "success" ]]; then
    echo "CI has not passed for $target_sha (status: $ci_conclusion); skipping deploy"
    exit 0
  fi
fi

previous_sha="$(git rev-parse HEAD)"
git checkout --quiet --detach "$target_sha"

export ALPHALAB_IMAGE_TAG="$target_sha"
docker compose --env-file "$env_file" --file "$compose_file" build app
docker compose --env-file "$env_file" --file "$compose_file" up --detach --remove-orphans

healthy=0
for _ in $(seq 1 60); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:8080/api/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" == "1" ]]; then
  printf '%s\n' "$target_sha" >"$deployed_file"
  docker image prune --force --filter 'until=168h' >/dev/null
  echo "AlphaLab deployed successfully at $target_sha"
  exit 0
fi

echo "Health check failed for $target_sha; rolling back to $previous_sha" >&2
git checkout --quiet --detach "$previous_sha"
export ALPHALAB_IMAGE_TAG="$previous_sha"
docker compose --env-file "$env_file" --file "$compose_file" build app
docker compose --env-file "$env_file" --file "$compose_file" up --detach --remove-orphans
exit 1
