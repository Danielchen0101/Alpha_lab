"""Gunicorn worker lifecycle hooks for AlphaLab background schedulers."""

# Background schedulers must never be created in the Gunicorn master process.
# Command-line flags remain more authoritative, so the post-worker hook below
# also makes an accidental ``--preload`` deployment safe.
preload_app = False


def post_worker_init(worker):
    """Start schedulers only after the serving worker has loaded the app."""
    from start_quant_backend import start_background_services

    start_background_services()
