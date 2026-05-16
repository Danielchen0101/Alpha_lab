"""Regression tests: anonymous requests to protected APIs MUST return 401.

These tests verify that protected endpoints reject unauthenticated requests
BEFORE any business logic executes, preventing accidental data exposure.

Uses require_auth()-gated endpoints (/api/config/status, /api/dashboard/status,
/api/ai/provider/config) because they work correctly even when Supabase
is not configured — require_auth() returns None and the endpoint returns 401.
The /api/settings/* endpoints gate on supabase_admin first (returning 503),
making them unsuitable for CI where Supabase credentials may not be set.
"""
import pytest


# Endpoints using require_auth() — works correctly without Supabase
PROTECTED_ENDPOINTS = [
    ('GET', '/api/config/status'),
    ('GET', '/api/dashboard/status'),
    ('GET', '/api/ai/provider/config'),
    ('POST', '/api/ai/provider/config'),
]


@pytest.fixture(scope='module')
def client():
    """Create a Flask test client."""
    from start_quant_backend import app as flask_app
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as c:
        yield c


class TestAnonymous401:
    """Anonymous (no auth header) requests must 401."""

    @pytest.mark.parametrize('method,path', PROTECTED_ENDPOINTS)
    def test_no_auth_header_returns_401(self, client, method, path):
        """No Authorization header → 401."""
        resp = client.open(path, method=method)
        assert resp.status_code == 401, (
            f'{method} {path} without auth returned {resp.status_code}, expected 401'
        )
        body = resp.get_json(silent=True) or {}
        # Different endpoints use different keys: some use 'error', some use 'message'
        err_text = str(body.get('error', '') or body.get('message', ''))
        assert 'Authentication required' in err_text, (
            f'{method} {path} response body does not mention "Authentication required": {body}'
        )
        # Verify no internal details are leaked in the body
        body_str = str(body)
        assert 'Missing Supabase' not in body_str, (
            f'{method} {path} leaks internal details: {body}'
        )
        assert 'access token' not in body_str, (
            f'{method} {path} leaks "access token" in response: {body}'
        )

    @pytest.mark.parametrize('method,path', PROTECTED_ENDPOINTS)
    def test_invalid_bearer_token_returns_401(self, client, method, path):
        """Invalid Bearer token → 401."""
        resp = client.open(
            path, method=method,
            headers={'Authorization': 'Bearer this-is-not-a-real-token'},
        )
        assert resp.status_code == 401, (
            f'{method} {path} with invalid token returned {resp.status_code}, expected 401'
        )

    @pytest.mark.parametrize('method,path', PROTECTED_ENDPOINTS)
    def test_malformed_auth_header_returns_401(self, client, method, path):
        """Malformed Authorization header (no Bearer prefix) → 401."""
        resp = client.open(
            path, method=method,
            headers={'Authorization': 'Basic somecreds'},
        )
        assert resp.status_code == 401, (
            f'{method} {path} with malformed auth returned {resp.status_code}, expected 401'
        )
