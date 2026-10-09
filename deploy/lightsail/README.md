# AlphaLab on Amazon Lightsail

This deployment keeps the trading schedulers disabled until the Render-to-
Lightsail cutover is explicitly completed. Runtime secrets live only in
`/etc/alphalab/alphalab.env` on the server and are never committed.

The recommended Lightsail instance is Ubuntu 24.04 in Oregon (`us-west-2`),
general purpose, dual-stack, 2 vCPU, 4 GB RAM, and 80 GB SSD.

## Bootstrap

Paste `cloud-init.sh` into the Lightsail launch script field. It installs
Docker, creates a 2 GB swap file, clones the public repository, builds the
production image, and starts the app in passive mode.

## Cutover order

1. Populate `/etc/alphalab/alphalab.env` with the current production secrets.
2. Confirm `ALPHALAB_DISABLE_BACKGROUND_SERVICES=true` and test `/api/health`
   and `/api/ready` through the Lightsail IP.
3. Disable the Render background scheduler and confirm it released its durable
   leases.
4. Set `ALPHALAB_DISABLE_BACKGROUND_SERVICES=false` on Lightsail and restart
   the app container.
5. Verify the scheduler lease owner, account snapshot, Discord notifications,
   and paper-mode cycles before permitting real orders.
6. Copy `Caddyfile.production` to `/etc/alphalab/Caddyfile`, point
   `api.alphalabquant.com` to the Lightsail static IP, and restart Caddy.
7. Keep Render available but passive during the observation window; remove it
   only after production checks pass.

The deploy timer checks `main` every five minutes and deploys only commits whose
GitHub Actions CI workflow completed successfully. A failed health check rolls
back to the previous commit. The watchdog restarts an unhealthy app container.

The Dockerfile pulls Node and Python from Docker's Official Images on
[ECR Public](https://www.docker.com/press-release/docker-official-images-available-amazon-elastic-container-registry/)
using the same runtime versions and variants. This avoids Docker Hub's anonymous
pull quota for both CI and Lightsail builds and requires no registry credentials.
PR validation uses the runner's [embedded Docker BuildKit driver](https://docs.docker.com/build/builders/drivers/docker/)
and loads its single-platform image locally, avoiding a separate BuildKit image
pull. The optional release-image push retains the container builder and its
provenance metadata; it logs in with the existing Docker Hub credentials before
pulling the builder image. Publishing still requires Docker Hub availability.
