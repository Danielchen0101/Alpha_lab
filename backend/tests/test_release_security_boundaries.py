from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import time
from types import SimpleNamespace

import pytest

import start_quant_backend as backend


class _BrokerResponse:
    status_code = 201
    text = '{"id":"order-1","status":"new"}'

    @staticmethod
    def json():
        return {"id": "order-1", "status": "new", "client_order_id": "client-1"}


def test_verified_supabase_claims_are_the_only_source_of_aal(monkeypatch):
    class Claims:
        def model_dump(self):
            return {
                "sub": "user-1",
                "email": "user@example.com",
                "aal": "aal2",
                "amr": [{"method": "totp"}],
                "exp": time.time() + 300,
            }

    auth = SimpleNamespace(get_claims=lambda _token: SimpleNamespace(claims=Claims()))
    monkeypatch.setattr(backend, "supabase_admin", SimpleNamespace(auth=auth))
    backend._auth_cache.clear()

    user = backend.get_supabase_user_from_token("verified-aal2-token")

    assert user["id"] == "user-1"
    assert user["aal"] == "aal2"
    assert user["source"] == "verified_jwt"


def test_verified_claim_missing_subject_fails_closed(monkeypatch):
    auth = SimpleNamespace(
        get_claims=lambda _token: {
            "claims": {"sub": "", "aal": "aal2", "exp": time.time() + 300}
        },
    )
    monkeypatch.setattr(backend, "supabase_admin", SimpleNamespace(auth=auth))
    backend._auth_cache.clear()

    assert backend.get_supabase_user_from_token("missing-subject-token") is None


def test_parallel_requests_verify_one_token_once(monkeypatch):
    calls = []

    def get_claims(_token):
        calls.append(1)
        time.sleep(0.05)
        return {"claims": {
            "sub": "user-1",
            "email": "user@example.com",
            "aal": "aal1",
            "exp": time.time() + 300,
        }}

    monkeypatch.setattr(
        backend,
        "supabase_admin",
        SimpleNamespace(auth=SimpleNamespace(get_claims=get_claims)),
    )
    backend._auth_cache.clear()
    backend._auth_inflight.clear()

    with ThreadPoolExecutor(max_workers=8) as executor:
        users = list(executor.map(
            backend.get_supabase_user_from_token,
            ["same-valid-token"] * 8,
        ))

    assert len(calls) == 1
    assert {user["id"] for user in users} == {"user-1"}


def test_headless_live_execution_requires_explicit_durable_authority(monkeypatch):
    user = {"id": "user-1", "source": "headless"}
    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: {
        "live_auto_trading_enabled": True,
        "live_auto_authorized_at": "2026-07-17T20:00:00+00:00",
        "live_auto_authorized_by": "user-1",
    })
    assert backend._require_aal2(user, allow_headless_live_authority=True) is None

    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: {
        "live_auto_trading_enabled": True,
        "live_auto_authorized_at": "",
        "live_auto_authorized_by": "",
    })
    with backend.app.app_context():
        response, status = backend._require_aal2(
            user, allow_headless_live_authority=True,
        )
    assert status == 403
    assert response.get_json()["code"] == "mfa_required"


def test_live_auto_authority_uses_explicit_confirmation_without_mfa(monkeypatch):
    saved = {}
    monkeypatch.setattr(
        backend,
        "require_auth",
        lambda: {"id": "user-1", "aal": "aal1", "source": "verified_jwt"},
    )
    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: {
        "trade_mode": "real",
        "mode": "ai",
    })
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_for_user",
        lambda _uid, _mode: {
            "api_key": "key",
            "api_secret": "secret",
            "base_url": "https://broker.example",
        },
    )
    monkeypatch.setattr(
        backend.requests,
        "get",
        lambda *_args, **_kwargs: SimpleNamespace(
            status_code=200,
            json=lambda: {"trading_blocked": False, "account_blocked": False},
        ),
    )

    def save_config(uid, config):
        saved.update(config)
        assert uid == "user-1"
        return True, ""

    monkeypatch.setattr(backend, "_pa_save_config", save_config)

    response = backend.app.test_client().patch(
        "/api/ai-agent/live-auto-authority",
        json={"enabled": True},
    )

    assert response.status_code == 200
    assert response.get_json()["liveAutoTradingEnabled"] is True
    assert saved["live_auto_authorized_method"] == "explicit_confirmation"
    assert saved["live_auto_authorized_by"] == "user-1"
    assert saved.get("live_auto_authorized_aal") is None


def test_generic_real_buy_requires_aal2_then_entry_plan_and_never_calls_broker(monkeypatch):
    broker_calls = []
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda _mode: broker_calls.append(True) or pytest.fail("generic real BUY reached broker"),
    )
    payload = {
        "symbol": "AAPL", "side": "buy", "qty": 1,
        "type": "market", "mode": "real", "confirmed": True,
    }

    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1", "aal": "aal1"})
    mfa = backend.app.test_client().post("/api/trading/order", json=payload)
    assert mfa.status_code == 403
    assert mfa.get_json()["code"] == "mfa_required"

    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1", "aal": "aal2"})
    gated = backend.app.test_client().post("/api/trading/order", json=payload)
    assert gated.status_code == 409
    assert gated.get_json()["code"] == "entry_plan_required"
    assert broker_calls == []


@pytest.mark.parametrize(
    "mode,side,confirmed",
    [("paper", "buy", False), ("real", "sell", True)],
)
def test_paper_buy_and_real_sell_remain_available(monkeypatch, mode, side, confirmed):
    submitted = []
    monkeypatch.setattr(backend, "get_supabase_user", lambda: {"id": "user-1", "aal": "aal1"})
    monkeypatch.setattr(backend, "_operations_buy_submission_block", lambda *_args: None)
    monkeypatch.setattr(
        backend,
        "resolve_alpaca_config_strict_user",
        lambda _mode: ({"api_key": "key", "api_secret": "secret", "base_url": "https://broker"}, "ok"),
    )
    monkeypatch.setattr(
        backend.requests,
        "post",
        lambda *args, **kwargs: submitted.append(kwargs["json"]) or _BrokerResponse(),
    )
    monkeypatch.setattr(backend, "_record_order_lifecycle", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(backend, "send_discord_notification", lambda *_args, **_kwargs: {"sent": True})

    response = backend.app.test_client().post("/api/trading/order", json={
        "symbol": "AAPL", "side": side, "qty": 1,
        "type": "market", "mode": mode, "confirmed": confirmed,
    })

    assert response.status_code == 200
    assert response.get_json()["status"] == "submitted"
    assert submitted[0]["side"] == side


def test_production_secret_validation_fails_closed_but_local_remains_usable():
    production = {"RENDER": "true"}
    local = {"APP_ENV": "development"}

    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        backend._validate_production_secrets(production)
    assert set(backend._validate_production_secrets(local)) == {
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FERNET_KEY", "APP_SECRET_KEY",
    }


def test_production_origins_are_exact_and_exclude_preview_and_localhost():
    assert backend.PRODUCTION_CORS_ORIGINS == (
        "https://alphalabquant.com",
        "https://www.alphalabquant.com",
    )
    assert "http://localhost:3000" not in backend.PRODUCTION_CORS_ORIGINS
    assert "https://quant-platform.pages.dev" not in backend.PRODUCTION_CORS_ORIGINS


def test_paper_auto_orders_respect_every_order_confirmation_preference():
    authority = backend._pa_order_authority({
        "mode": "ai",
        "trade_mode": "paper",
        "user_preferences": {
            "trading": {"confirmationPolicy": "always"},
        },
    })

    assert authority["authorized"] is False
    assert authority["code"] == "confirmation_required"


def test_headless_scanner_uses_saved_research_preferences(monkeypatch):
    monkeypatch.setattr(backend, "_pa_get_config", lambda _uid: {
        "user_preferences": {
            "research": {
                "maxSymbols": 250,
                "outputSize": 25,
                "aiReviewLimit": 12,
                "excludedSymbols": ["TSLA"],
                "excludedSectors": ["Energy"],
                "minPrice": 8,
                "minMarketCap": 500000000,
                "minDollarVolume": 20000000,
                "dataFreshnessSeconds": 75,
                "includeExtendedHours": True,
            },
        },
    })

    settings = backend._pa_market_scanner_settings_for_user("user-1")

    assert settings["maxSymbols"] == 250
    assert settings["maxResults"] == 25
    assert settings["aiReviewTopN"] == 12
    assert settings["excludedSymbols"] == ["TSLA"]
    assert settings["excludedSectors"] == ["Energy"]
    assert settings["filters"]["minPrice"] == 8
    assert settings["filters"]["minMarketCap"] == 500000000
    assert settings["filters"]["minDollarVolume"] == 20000000
    assert settings["dataFreshnessSeconds"] == 75
    assert settings["includeExtendedHours"] is True


def test_5xx_responses_are_sanitized_and_production_hsts_is_present(monkeypatch):
    monkeypatch.setattr(backend, "_strict_production_runtime", lambda environ=None: True)
    with backend.app.test_request_context(
        "/__release-tests__/leaky-5xx",
        headers={"X-Request-ID": "release-test-request"},
    ):
        response = backend.app.make_response((backend.jsonify({
            "error": "postgres password=secret and provider response",
        }), 500))
        response = backend.add_security_headers(response)
    body = response.get_data(as_text=True)

    assert response.status_code == 500
    assert response.get_json()["status"] == "internal_error"
    assert response.get_json()["requestId"] == "release-test-request"
    assert "password" not in body
    assert "provider response" not in body
    assert response.headers["Strict-Transport-Security"].startswith("max-age=31536000")


def test_daily_filled_order_counter_deduplicates_and_uses_new_york_day():
    now = datetime(2026, 7, 16, 15, 0, tzinfo=timezone.utc)
    orders = [
        {"id": "one", "status": "filled", "filled_at": "2026-07-16T14:00:00Z"},
        {"id": "one", "status": "filled", "filled_at": "2026-07-16T14:00:00Z"},
        {"id": "two", "status": "new", "filled_at": "2026-07-16T14:00:00Z"},
        {"id": "old", "status": "filled", "filled_at": "2026-07-15T14:00:00Z"},
    ]

    assert backend._count_daily_filled_orders(orders, now=now) == 1
