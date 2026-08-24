#!/usr/bin/env bash
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install --yes ca-certificates curl git gnupg jq
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
printf '%s\n' \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
  >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get install --yes docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '%s\n' '/swapfile none swap sw 0 0' >>/etc/fstab
fi

install -d -m 0750 /etc/alphalab /opt/alphalab /var/lib/alphalab
if [[ ! -d /opt/alphalab/repo/.git ]]; then
  git clone --branch main --single-branch \
    https://github.com/Danielchen0101/Alpha_lab.git /opt/alphalab/repo
fi

if [[ ! -f /etc/alphalab/alphalab.env ]]; then
  install -m 0600 \
    /opt/alphalab/repo/deploy/lightsail/alphalab.env.example \
    /etc/alphalab/alphalab.env
fi
if [[ ! -f /etc/alphalab/Caddyfile ]]; then
  install -m 0644 \
    /opt/alphalab/repo/deploy/lightsail/Caddyfile.staging \
    /etc/alphalab/Caddyfile
fi

chmod 0755 \
  /opt/alphalab/repo/deploy/lightsail/bootstrap.sh \
  /opt/alphalab/repo/deploy/lightsail/deploy.sh \
  /opt/alphalab/repo/deploy/lightsail/watchdog.sh
install -m 0644 /opt/alphalab/repo/deploy/lightsail/alphalab-deploy.service /etc/systemd/system/
install -m 0644 /opt/alphalab/repo/deploy/lightsail/alphalab-deploy.timer /etc/systemd/system/
install -m 0644 /opt/alphalab/repo/deploy/lightsail/alphalab-watchdog.service /etc/systemd/system/
install -m 0644 /opt/alphalab/repo/deploy/lightsail/alphalab-watchdog.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now alphalab-deploy.timer alphalab-watchdog.timer

ALPHALAB_REQUIRE_CI=0 /opt/alphalab/repo/deploy/lightsail/deploy.sh
