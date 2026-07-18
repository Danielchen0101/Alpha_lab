import start_quant_backend as backend


def test_backtest_result_requires_auth(monkeypatch):
    monkeypatch.setattr(backend, 'require_auth', lambda: None)

    response = backend.app.test_client().get('/api/backtest/results/session-1')

    assert response.status_code == 401
    assert response.get_json()['success'] is False


def test_backtest_result_returns_matching_record(monkeypatch):
    monkeypatch.setattr(backend, 'require_auth', lambda: {'id': 'user-1'})
    original = list(backend.backtest_history)
    try:
        with backend.backtest_history_lock:
            backend.backtest_history[:] = [{
                'backtestId': 'session-1',
                'status': 'completed',
                'parameters': {'symbol': 'AAPL'},
                'results': {'totalReturn': 4.2},
            }]

        response = backend.app.test_client().get('/api/backtest/results/session-1')
    finally:
        with backend.backtest_history_lock:
            backend.backtest_history[:] = original

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['result']['backtestId'] == 'session-1'
    assert payload['result']['results']['totalReturn'] == 4.2


def test_backtest_result_returns_404_for_unknown_id(monkeypatch):
    monkeypatch.setattr(backend, 'require_auth', lambda: {'id': 'user-1'})
    original = list(backend.backtest_history)
    try:
        with backend.backtest_history_lock:
            backend.backtest_history.clear()

        response = backend.app.test_client().get('/api/backtest/results/missing')
    finally:
        with backend.backtest_history_lock:
            backend.backtest_history[:] = original

    assert response.status_code == 404
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['backtestId'] == 'missing'
