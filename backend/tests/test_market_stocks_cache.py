import threading
import time

import start_quant_backend as backend


def _clear_market_cache():
    with backend._MARKET_STOCKS_RESPONSE_CACHE_LOCK:
        backend._MARKET_STOCKS_RESPONSE_CACHE.clear()
        backend._MARKET_STOCKS_INFLIGHT.clear()


def test_market_stocks_response_cache_and_explicit_refresh(monkeypatch):
    _clear_market_cache()
    calls = []

    def fake_uncached():
        calls.append(time.time())
        return backend.jsonify({
            "stocks": [{"symbol": "AAPL", "price": 200}],
            "count": 1,
            "configStatus": "ok",
        }), 200

    monkeypatch.setattr(backend, "_get_market_stocks_uncached", fake_uncached)
    client = backend.app.test_client()

    first = client.get("/api/market/stocks")
    second = client.get("/api/market/stocks")
    refreshed = client.get("/api/market/stocks?refresh=true")

    assert first.status_code == 200
    assert second.get_json()["cacheInfo"]["status"] == "hit"
    assert refreshed.status_code == 200
    assert len(calls) == 2
    _clear_market_cache()


def test_market_stocks_coalesces_concurrent_cold_requests(monkeypatch):
    _clear_market_cache()
    entered = threading.Event()
    release = threading.Event()
    calls = []
    responses = []

    def fake_uncached():
        calls.append(time.time())
        entered.set()
        assert release.wait(2)
        return backend.jsonify({
            "stocks": [{"symbol": "MSFT", "price": 500}],
            "count": 1,
            "configStatus": "ok",
        }), 200

    monkeypatch.setattr(backend, "_get_market_stocks_uncached", fake_uncached)

    def request_market():
        with backend.app.test_client() as client:
            responses.append(client.get("/api/market/stocks"))

    first = threading.Thread(target=request_market)
    second = threading.Thread(target=request_market)
    first.start()
    assert entered.wait(1)
    second.start()
    time.sleep(0.05)
    release.set()
    first.join(2)
    second.join(2)

    assert len(calls) == 1
    assert sorted(response.status_code for response in responses) == [200, 200]
    assert any(
        (response.get_json().get("cacheInfo") or {}).get("status") == "coalesced"
        for response in responses
    )
    _clear_market_cache()
