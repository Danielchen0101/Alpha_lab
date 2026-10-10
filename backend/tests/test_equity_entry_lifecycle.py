from copy import deepcopy

import pytest

from equity_entry_lifecycle import reconcile_entry_expiry
from equity_risk import DurableEntryReservations, portfolio_entry_budget
from equity_runtime import read_order_attribution, record_v1_order
from tests.test_equity_attribution import _store, _buy


EXPIRY = '2026-10-09T20:00:00+00:00'
AFTER = '2026-10-09T21:00:00+00:00'


def setup(tmp_path, **order_fields):
    _, store = _store(tmp_path)
    order = _buy(status='new', filled_qty='0', **order_fields)
    record_v1_order(store, 'owner', 'account-a', 'real', order, validated_entry=True,
                    protocol_key='frozen', entry_expires_at=EXPIRY, initial_stop_price=96)
    return store, order


def reconcile(store, order, cancel, now=AFTER):
    return reconcile_entry_expiry(store, 'owner', 'account-a', 'real', lambda oid: deepcopy(order),
                                  lambda cid: deepcopy(order), cancel, now=now)


def test_expired_gtc_parent_is_canceled_and_requires_terminal_get(tmp_path):
    store, order = setup(tmp_path)
    calls = []
    first = reconcile(store, order, lambda oid: calls.append(oid))
    assert calls == ['buy'] and not first['ok']
    assert 'unresolved' in first['blockers'][0]
    assert not read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']['buy'].get('entryReconciledTerminal')
    def confirmed(oid):
        order['status'] = 'canceled'
    second = reconcile(store, order, confirmed)
    assert second['ok'] and second['canceledOrderIds'] == ['buy']
    assert reconcile(store, order, lambda oid: pytest.fail('terminal parent must not cancel twice'))['ok']


def test_no_cancel_before_verified_session_close_or_for_unknown_legacy(tmp_path):
    store, order = setup(tmp_path)
    assert reconcile(store, order, lambda oid: pytest.fail('entry session is open'), now='2026-10-09T19:00:00Z')['ok']
    empty_store = _store(tmp_path / 'other')[1]
    result = reconcile_entry_expiry(empty_store, 'owner', 'account-a', 'real', lambda oid: pytest.fail('no owned receipt'),
                                    lambda cid: pytest.fail('no owned intent'), lambda oid: pytest.fail('legacy order'))
    assert result['ok']


def test_cancel_partial_fill_is_sticky_quarantine_with_actual_qty_and_stop_proof(tmp_path):
    store, order = setup(tmp_path)
    order.update(status='partially_filled', filled_qty='3', filled_avg_price='100', filled_at='2026-10-09T19:59:00Z')
    result = reconcile(store, order, lambda oid: order.update(status='canceled'))
    assert not result['ok'] and result['quarantinedOrderIds'] == ['buy']
    receipt = read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']['buy']
    assert receipt['entryQuarantineReason'] == 'entry_partial_fill_requires_protection'
    assert receipt['entryTerminalFilledQty'] == 3 and receipt['originalStopPrice'] == 96
    record_v1_order(store, 'owner', 'account-a', 'real', order)
    assert not reconcile(store, order, lambda oid: pytest.fail('already terminal'))['ok']


@pytest.mark.parametrize('fill_time', ['2026-10-09T20:00:01Z', None])
def test_late_or_untimed_fill_never_becomes_valid_strategy_evidence(tmp_path, fill_time):
    store, order = setup(tmp_path)
    order.update(status='filled', filled_qty='10', filled_at=fill_time)
    result = reconcile(store, order, lambda oid: pytest.fail('filled parent cannot be canceled'))
    assert not result['ok'] and result['quarantinedOrderIds'] == ['buy']


def test_ambiguous_post_survives_restart_and_recovers_before_expiry_cancel(tmp_path):
    _, store = _store(tmp_path)
    reserve = DurableEntryReservations(store, 'owner', 'account-a', 'live')
    reserve.read()
    reserve.reserve('client-buy', {'symbol': 'SPY', 'strategyVersion': 'equity_fixed_v1', 'protocolKey': 'frozen',
                                 'entryExpiresAt': EXPIRY, 'stopPrice': 96})
    order = _buy(status='new', filled_qty='0')
    missing = reconcile_entry_expiry(store, 'owner', 'account-a', 'real', lambda oid: order,
                                     lambda cid: None, lambda oid: pytest.fail('not visible'), now=AFTER)
    assert not missing['ok'] and reserve.read()
    result = reconcile(store, order, lambda oid: order.update(status='canceled'))
    assert result['ok']
    assert not DurableEntryReservations(store, 'owner', 'account-a', 'live').read()


def test_day_stop_is_not_persistent_swing_protection():
    from tests.test_equity_risk import _budget, _position, _stop
    result = _budget([_position()], [_stop(time_in_force='day')])
    assert not result['ok']
    assert any('protection' in reason.lower() or 'stop' in reason.lower() for reason in result['blockers'])


def test_failed_stop_ratchet_and_day_child_never_authorize_new_swing_exposure():
    import start_quant_backend as backend
    from tests.test_equity_risk import _budget, _position, _stop
    result = _budget([_position()], [_stop()], managed={'AAA': {'stopRatchetReviewRequired': True}})
    assert not result['ok'] and any('ratchet' in reason for reason in result['blockers'])
    assert backend._pa_classify_sell_protection([_stop(time_in_force='day')])['persistentStopQty'] == 0
    assert backend._pa_classify_sell_protection([_stop(qty=10, filled_qty='3')])['persistentStopQty'] == 7


def test_expiry_monitor_survives_strategy_revoke_and_uses_signed_real_receipts(monkeypatch, tmp_path):
    import start_quant_backend as backend
    store, order = setup(tmp_path)
    order.update(status='canceled')
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {'strategy_program': 'legacy', 'equity_broker_monitoring_required': True})
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: store)
    monkeypatch.setattr(backend, '_PA_RUNTIME_LOCK_DIR', str(tmp_path))
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {'api_key': 'test', 'api_secret': 'test', 'base_url': 'https://broker.invalid'})
    class Response:
        status_code = 200
        def __init__(self, data): self.data = data
        def json(self): return self.data
    reads = []
    def get(url, **kw):
        reads.append(url)
        return Response({'id': 'account-a'} if url.endswith('/account') else order)
    monkeypatch.setattr(backend.requests, 'get', get)
    result = backend._equity_reconcile_entry_expiry('owner', 'real')
    assert result['ok'], result
    assert reads and reads[0].endswith('/account')


def test_canceled_partial_gets_only_gtc_stop_for_actual_owned_shares(monkeypatch, tmp_path):
    import start_quant_backend as backend
    from tests.test_pipeline_position_protection import _install_exit_runtime_scenario
    store, order = setup(tmp_path)
    order.update(status='partially_filled', filled_qty='3', filled_avg_price='100')
    reconcile(store, order, lambda oid: order.update(status='canceled'))
    _, managed = _install_exit_runtime_scenario(monkeypatch, [{'symbol': 'SPY', 'price': 100, 'qty': 3}])
    managed['SPY'].update(equitySwingV1=True, brokerAccountId='account-a', entryOrderId='buy',
                          entryValidityReviewRequired=True, entryFilledQty=3, entryFillPrice=100)
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: store)
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {'strategy_program': 'equity_swing_v1',
        'equity_execution_mode': 'broker', 'mode': 'hybrid', 'trade_mode': 'real', 'live_auto_trading_enabled': True})
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {'api_key': 'test', 'api_secret': 'test', 'base_url': 'https://broker.invalid'})
    class Response:
        status_code = 200
        def __init__(self, data): self.data = data
        def json(self): return self.data
    monkeypatch.setattr(backend.requests, 'get', lambda url, **kw: Response({'id': 'account-a', 'equity': 2000,
        'trading_blocked': False, 'account_blocked': False, 'trade_suspended_by_user': False} if url.endswith('/account') else []))
    sent = []
    def submit(uid, path, view, body):
        sent.append(body)
        return {'success': True, 'order': {'id': 'repair', 'symbol': 'SPY', 'side': 'sell'}}, 200
    monkeypatch.setattr(backend, '_pa_call_endpoint', submit)
    result = backend._pa_exit_scan_headless('owner', [], 'hybrid', trade_mode='real', protection_only=True)
    assert len(sent) == 1, result
    assert (sent[0]['type'], sent[0]['time_in_force'], sent[0]['qty'], sent[0]['stop_price']) == ('stop', 'gtc', 3, 96)
    assert result['signals'][0]['status'] == 'unprotected'  # Submitted is not verified coverage.
    assert managed['SPY']['entryValidityReviewRequired'] is True
    assert read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']['repair']['entryOrderId'] == 'buy'
    active_stop = {'id': 'repair', 'symbol': 'SPY', 'side': 'sell', 'type': 'stop', 'status': 'new',
                   'time_in_force': 'gtc', 'qty': '3', 'filled_qty': '0', 'stop_price': '96',
                   'client_order_id': 'alphalab-gtc-repair'}
    monkeypatch.setattr(backend.requests, 'get', lambda url, **kw: Response({'id': 'account-a', 'equity': 2000,
        'trading_blocked': False, 'account_blocked': False, 'trade_suspended_by_user': False} if url.endswith('/account') else [active_stop]))
    monkeypatch.setattr(backend, '_pa_fetch_exit_market_context', lambda *a: ({'SPY': {'indicators': {
        'price': 90, 'bid': 89.99, 'quoteAgeSeconds': 1}}}, {}))
    protected = backend._pa_exit_scan_headless('owner', [], 'hybrid', trade_mode='real', protection_only=True)
    assert len(sent) == 1  # Even below the stop, no after-hours ordinary market exit.
    assert protected['signals'][0]['action'] == 'protected_hold'
