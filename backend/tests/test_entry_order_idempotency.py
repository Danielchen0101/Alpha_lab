import start_quant_backend as backend


class _Response:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_alpaca_client_order_lookup_returns_existing_order(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        return _Response(200, {
            "id": "broker-order-1",
            "client_order_id": "alphalab-entry-AAPL-abc",
            "status": "new",
        })

    monkeypatch.setattr(backend.requests, "get", fake_get)
    order, error = backend._alpaca_lookup_order_by_client_id(
        "https://paper-api.alpaca.markets",
        {"APCA-API-KEY-ID": "key"},
        "alphalab-entry-AAPL-abc",
    )

    assert error is None
    assert order["id"] == "broker-order-1"
    assert calls[0][0].endswith("/v2/orders:by_client_order_id")
    assert calls[0][1]["params"]["client_order_id"] == "alphalab-entry-AAPL-abc"


def test_alpaca_client_order_lookup_treats_404_as_available(monkeypatch):
    monkeypatch.setattr(
        backend.requests,
        "get",
        lambda *args, **kwargs: _Response(404),
    )

    order, error = backend._alpaca_lookup_order_by_client_id(
        "https://paper-api.alpaca.markets",
        {},
        "alphalab-entry-MSFT-def",
    )

    assert order is None
    assert error is None


def test_ambiguous_submission_reconciliation_polls_same_client_id(monkeypatch):
    seen = []
    responses = [
        (None, None),
        (None, "lookup_http_503"),
        ({
            "id": "broker-order-2",
            "client_order_id": "alphalab-entry-NVDA-abc",
            "status": "accepted",
        }, None),
    ]

    def fake_lookup(base_url, headers, client_order_id):
        seen.append((base_url, client_order_id))
        return responses.pop(0)

    monkeypatch.setattr(backend, "_alpaca_lookup_order_by_client_id", fake_lookup)
    monkeypatch.setattr(backend.time, "sleep", lambda _seconds: None)

    order, error = backend._alpaca_reconcile_ambiguous_submission(
        "https://paper-api.alpaca.markets",
        {},
        "alphalab-entry-NVDA-abc",
    )

    assert error is None
    assert order["id"] == "broker-order-2"
    assert [client_id for _url, client_id in seen] == [
        "alphalab-entry-NVDA-abc",
        "alphalab-entry-NVDA-abc",
        "alphalab-entry-NVDA-abc",
    ]


def test_ambiguous_submission_remains_unknown_instead_of_inventing_new_id(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_alpaca_lookup_order_by_client_id",
        lambda *_args, **_kwargs: (None, None),
    )
    monkeypatch.setattr(backend.time, "sleep", lambda _seconds: None)

    order, error = backend._alpaca_reconcile_ambiguous_submission(
        "https://paper-api.alpaca.markets",
        {},
        "alphalab-entry-TSLA-stable",
    )

    assert order is None
    assert error == "order_not_visible_after_submit"
