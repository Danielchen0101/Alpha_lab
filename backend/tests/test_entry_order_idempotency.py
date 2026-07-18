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
