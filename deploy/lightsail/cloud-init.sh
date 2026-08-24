#!/usr/bin/env bash
set -Eeuo pipefail

curl --fail --silent --show-error --location \
  https://raw.githubusercontent.com/Danielchen0101/Alpha_lab/main/deploy/lightsail/bootstrap.sh \
  --output /tmp/alphalab-bootstrap.sh
chmod 0700 /tmp/alphalab-bootstrap.sh
exec /tmp/alphalab-bootstrap.sh
