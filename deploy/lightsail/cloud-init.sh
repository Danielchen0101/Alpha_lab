#!/bin/sh
# Lightsail invokes launch scripts with /bin/sh even when a bash shebang is
# present, so keep this small wrapper POSIX-compatible. The bootstrap itself
# still runs under bash.
set -eu

curl --fail --silent --show-error --location \
  https://raw.githubusercontent.com/Danielchen0101/Alpha_lab/main/deploy/lightsail/bootstrap.sh \
  --output /tmp/alphalab-bootstrap.sh
chmod 0700 /tmp/alphalab-bootstrap.sh
exec /bin/bash /tmp/alphalab-bootstrap.sh
