"""Keep backend tests isolated from developer and production credentials.

Pytest imports this file before collecting test modules.  The assignments must
therefore remain at module scope so ``start_quant_backend`` cannot load a local
``backend/.env`` and create real Supabase, broker, or notification clients.
Tests that exercise an integration boundary provide their own fake client or
explicitly monkeypatch the required environment.
"""

import os


os.environ["PYTHON_DOTENV_DISABLED"] = "1"
os.environ["APP_ENV"] = "test"
os.environ["FLASK_ENV"] = "test"
os.environ["ENV"] = "test"
os.environ["RENDER"] = ""
os.environ["ALPHALAB_DISABLE_BACKGROUND_SERVICES"] = ""
os.environ["ALPHALAB_DISABLE_CRYPTO_SCHEDULER"] = ""
os.environ["ALPHALAB_DISABLE_KALSHI_SCHEDULER"] = ""
os.environ["ALPHALAB_ENABLE_TEST_BACKGROUND_SERVICES"] = ""

# Empty values deliberately shadow matching keys in a developer's .env.
for _credential_name in (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "ALPACA_API_KEY",
    "ALPACA_API_SECRET",
    "FINNHUB_API_KEY",
    "TWELVEDATA_API_KEY",
    "DISCORD_WEBHOOK_URL",
    "DISCORD_BOT_TOKEN",
    "KALSHI_API_KEY",
    "KALSHI_API_KEY_ID",
    "KALSHI_PRIVATE_KEY",
    "KALSHI_PRIVATE_KEY_PATH",
    "COINBASE_API_KEY",
    "COINBASE_API_SECRET",
    "ALPHALAB_ADMIN_EMAIL",
    "ALPHALAB_ADMIN_PASSWORD",
):
    os.environ[_credential_name] = ""

# Stable, non-production-only values keep Flask and encryption code testable
# without inheriting the developer's application secrets.
os.environ["APP_SECRET_KEY"] = "alphalab-pytest-only-secret"
os.environ["FERNET_KEY"] = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
