"""CORS regression coverage for production and Cloudflare Pages previews."""

import pytest


@pytest.fixture(scope="module")
def client():
    from start_quant_backend import app as flask_app

    flask_app.config["TESTING"] = True
    with flask_app.test_client() as test_client:
        yield test_client


def _preflight(client, origin: str):
    return client.options(
        "/api/dashboard/status",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


@pytest.mark.parametrize(
    "origin",
    [
        "https://71b734c5.quant-platform.pages.dev",
        "https://dependabot-npm-and-yarn-frontend.quant-platform.pages.dev",
        "https://a.quant-platform.pages.dev",
        f"https://{'a' * 63}.quant-platform.pages.dev",
    ],
)
def test_cloudflare_pages_preview_origin_is_allowed(client, origin):
    response = _preflight(client, origin)

    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"
    assert response.headers.get("Vary") == "Origin"


def test_production_origin_remains_allowed(client):
    origin = "https://www.alphalabquant.com"
    response = _preflight(client, origin)

    assert response.headers.get("Access-Control-Allow-Origin") == origin


@pytest.mark.parametrize(
    "origin",
    [
        "https://quant-platform.pages.dev.evil.example",
        "https://nested.preview.quant-platform.pages.dev",
        "https://unrelated-project.pages.dev",
        "https://-invalid.quant-platform.pages.dev",
        "https://invalid-.quant-platform.pages.dev",
        "http://71b734c5.quant-platform.pages.dev",
        "https://71b734c5.quant-platform.pages.dev:443",
        "https://71b734c5.quant-platform.pages.dev/path",
        f"https://{'a' * 64}.quant-platform.pages.dev",
    ],
)
def test_untrusted_preview_like_origin_is_rejected(client, origin):
    response = _preflight(client, origin)

    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") is None
