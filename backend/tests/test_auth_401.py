"""Regression tests: anonymous requests to protected APIs MUST return 401.

These tests verify that protected endpoints reject unauthenticated requests
BEFORE any business logic executes, preventing accidental data exposure.
"""
import pytest


# Endpoints that require authentication
PROTECTED_ENDPOINTS = [
    ('GET', '/api/settings/ai-config'),
    ('POST', '/api/settings/ai-config'),
    ('GET', '/api/settings/broker-config'),
    ('POST', '/api/settings/broker-config'),
    ('GET', '/api/settings/finnhub-config'),
    ('POST', '/api/settings/finnhub-config'),
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
        assert 'Authentication required' in str(body.get('error', '')), (
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
