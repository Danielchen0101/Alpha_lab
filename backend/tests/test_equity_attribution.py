from copy import deepcopy

import pytest

from equity_evidence_store import EquityEvidenceStore
from equity_program import STRATEGY_VERSION
from equity_risk import DurableEntryReservations
from equity_runtime import ORDER_ATTRIBUTION_ARTIFACT, account_evidence, read_order_attribution, record_v1_order
from equity_store import EquityAuthenticatedStore
from operations_store import OperationsStore, OperationsStoreUnavailable
from tests.test_equity_ledger import NOW, CLOSE, fill, flow


def _store(tmp_path):
    raw = OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'orders.json')
    return raw, EquityAuthenticatedStore(raw, 'test-equity-signing-key')


def _buy(identity='buy', **changes):
    return {'id': identity, 'symbol': 'SPY', 'side': 'buy', 'client_order_id': 'client-' + identity,
            'qty': '10', 'limit_price': '100', **changes}


def _record(store, order, **kwargs):
    return record_v1_order(store, 'owner', 'account-a', 'real', order, recorded_at=NOW, **kwargs)


def test_signed_entry_and_nested_oto_leg_create_only_narrow_new_cost_budget(tmp_path):
    raw, store = _store(tmp_path)
    order = _buy(legs=[{'id': 'stop', 'side': 'sell', 'symbol': 'SPY'}])
    assert _record(store, order, validated_entry=True, protocol_key='frozen')
    first, evidence = read_order_attribution(store, 'owner', 'account-a', 'real')
    assert evidence['orders']['stop']['entryOrderId'] == 'buy'
    assert evidence['orders']['buy']['strategyVersion'] == STRATEGY_VERSION
    budget = evidence['incrementalCostBudgets']['frozen']
    assert budget['amount'] == 0 and budget['validFrom'] == NOW
    assert budget['scope'] == 'incremental_v1_ai_and_data_only'
    assert budget['historicalCostsKnown'] is False and budget['totalExternalOperatingCostsKnown'] is False
    assert _record(store, order)
    assert read_order_attribution(store, 'owner', 'account-a', 'real')[0]['version'] == first['version']
    signed = raw.get_artifact('owner', ORDER_ATTRIBUTION_ARTIFACT, EquityEvidenceStore.artifact_key('account-a', 'real'))
    assert signed['payload']['_serverAttestation']


def test_unsigned_client_prefix_and_unrelated_managed_parent_cannot_claim_ownership(tmp_path):
    _, store = _store(tmp_path)
    assert not _record(store, _buy(client_order_id='alphalab-entry-fabricated'))
    assert not _record(store, {'id': 'sell', 'symbol': 'SPY', 'side': 'sell'}, entry_order_id='unknown')
    _record(store, _buy(), validated_entry=True, protocol_key='frozen')
    assert not _record(store, {'id': 'sell', 'symbol': 'GLD', 'side': 'sell'}, entry_order_id='buy')
    assert not record_v1_order(store, 'owner', 'different-account', 'real', _buy())
    assert not record_v1_order(store, 'owner', 'account-a', 'paper', _buy())


def test_ambiguous_submission_recovers_only_from_signed_matching_intent(tmp_path):
    _, store = _store(tmp_path)
    reservations = DurableEntryReservations(store, 'owner', 'account-a', 'live')
    reservations.read()
    reservations.reserve('client-buy', {'symbol': 'SPY', 'strategyVersion': STRATEGY_VERSION, 'protocolKey': 'frozen'})
    assert not _record(store, _buy(symbol='GLD'))
    assert _record(store, _buy())
    assert read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']['buy']['protocolKey'] == 'frozen'


def test_child_receipt_cannot_switch_parent_and_signed_registry_cannot_be_forged(tmp_path):
    raw, store = _store(tmp_path)
    _record(store, _buy(legs=[{'id': 'stop', 'side': 'sell'}]), validated_entry=True, protocol_key='frozen')
    with pytest.raises(ValueError, match='parent_changed'):
        _record(store, _buy('other', legs=[{'id': 'stop', 'side': 'sell'}]), validated_entry=True, protocol_key='frozen')
    key = EquityEvidenceStore.artifact_key('account-a', 'real')
    row = raw.get_artifact('owner', ORDER_ATTRIBUTION_ARTIFACT, key)
    altered = deepcopy(row['payload'])
    altered['orders']['legacy'] = altered['orders']['buy']
    raw.put_artifact('owner', ORDER_ATTRIBUTION_ARTIFACT, key, payload=altered,
                     idempotency_key='forged', expected_version=row['version'])
    with pytest.raises(OperationsStoreUnavailable, match='Unverified'):
        read_order_attribution(store, 'owner', 'account-a', 'real')


def test_lifecycle_reconciliation_attaches_later_broker_stop_receipt(monkeypatch, tmp_path):
    import start_quant_backend as backend
    _, store = _store(tmp_path)
    _record(store, _buy(), validated_entry=True, protocol_key='frozen')
    parent = _buy(status='filled', filled_qty='10', filled_avg_price='100', filled_at=CLOSE,
                  legs=[{'id': 'late-stop', 'symbol': 'SPY', 'side': 'sell', 'type': 'stop', 'status': 'new'}])
    class Response:
        status_code = 200
        def json(self):
            return [parent]
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: store)
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {
        'api_key': 'P' * 24, 'api_secret': 'S' * 40, 'base_url': 'https://broker.invalid'})
    monkeypatch.setattr(backend.requests, 'get', lambda *a, **kw: Response())
    monkeypatch.setattr(backend, '_pa_managed_records_for_user', lambda *a: {'owner:real:SPY': {
        'symbol': 'SPY', 'entryOrderId': 'buy', 'brokerAccountId': 'account-a', 'initialStop': 95}})
    monkeypatch.setattr(backend, '_pa_update_managed_position', lambda *a, **kw: None)
    monkeypatch.setattr(backend, '_record_order_lifecycle', lambda *a, **kw: None)
    backend._pa_reconcile_order_lifecycle('owner', 'real')
    assert read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']['late-stop']['entryOrderId'] == 'buy'


@pytest.mark.parametrize('legacy', [True, False])
@pytest.mark.parametrize('mode', ['real', 'paper'])
def test_broker_fills_and_fees_attributed_without_inventing_legacy_or_total_profit(tmp_path, legacy, mode):
    _, store = _store(tmp_path)
    record_v1_order(store, 'owner', 'account-a', mode, _buy(), validated_entry=True, protocol_key='frozen', recorded_at=CLOSE)
    record_v1_order(store, 'owner', 'account-a', mode, {'id': 'sell', 'symbol': 'SPY', 'side': 'sell'}, entry_order_id='buy', recorded_at=CLOSE)
    rows = [flow('deposit', 2000, effective_at='2026-10-01T14:00:00Z'),
            fill('buy-fill', 'buy', 10, 100, order_id='buy'),
            fill('sell-fill', 'sell', 10, 105, order_id='sell'),
            {'id': 'fee', 'activity_type': 'CFEE', 'order_id': 'sell', 'effective_at': '2026-10-09T16:00:00Z', 'net_amount': '-0.05'}]
    if legacy:
        rows += [fill('legacy-b', 'buy', 1, 10, symbol='GLD'), fill('legacy-s', 'sell', 1, 10, symbol='GLD')]
    state = account_evidence(store, 'owner', mode, {'id': 'account-a', 'equity': 2049.95, 'cash': 2049.95},
                             lambda params: (200, rows), now=NOW,
                             equity_history=[{'as_of': CLOSE, 'equity': 2000}], daily_baseline_as_of=CLOSE)
    accounting = state['accounting']
    assert accounting['strategy_attributed_fill_count'] == 2
    assert accounting['strategy_gross_fill_cashflow'] == 50
    assert accounting['strategy_attribution_known'] is (not legacy)
    assert accounting['strategy_net_operating_pnl'] is None
    assert accounting['external_operating_costs'] is None
    summary = state['strategyExecutionEvidence']
    assert summary['attributedFillCount'] == 2
    assert summary['attributedFeeCashflow'] == (-0.05 if mode == 'real' else None)
    assert summary['totalExternalOperatingCostsKnown'] is False


def test_receipt_storage_failure_does_not_change_successful_broker_submission(monkeypatch, tmp_path):
    import start_quant_backend as backend
    from tests.test_equity_swing_execution import _install_entry_route
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    original = backend.operations_store.put_artifact
    def fail_receipt(uid, kind, *args, **kwargs):
        if kind == ORDER_ATTRIBUTION_ARTIFACT:
            raise OperationsStoreUnavailable('receipt temporarily unavailable')
        return original(uid, kind, *args, **kwargs)
    monkeypatch.setattr(backend.operations_store, 'put_artifact', fail_receipt)
    result = submit()
    assert result['action'] == 'ORDER_SUBMITTED', result
    assert len(state['posts']) == 1
    assert DurableEntryReservations(backend.operations_store, 'swing-user', 'acct', 'paper').read()


@pytest.mark.parametrize('broker_mode', [True, False])
def test_fixed_hybrid_exit_endpoint_requires_explicit_broker_authority(monkeypatch, broker_mode):
    import start_quant_backend as backend
    config = {'mode': 'hybrid', 'trade_mode': 'real', 'strategy_program': 'equity_swing_v1',
              'equity_execution_mode': 'broker' if broker_mode else 'shadow', 'live_auto_trading_enabled': True}
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'owner'})
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: config)
    calls = []
    monkeypatch.setattr(backend, 'resolve_alpaca_config_strict_user', lambda mode: (calls.append(mode) or {}, 'config_required'))
    response = backend.app.test_client().post('/api/ai/execution/order', json={
        'symbol': 'SPY', 'side': 'sell', 'qty': 1, 'type': 'market', 'tradingMode': 'real',
        'automationMode': 'full-ai', 'confirmed': True, 'suppressDiscord': True,
        'executionSource': 'exit_scan_hard_stop',
    }).get_json()
    assert calls == (['live'] if broker_mode else [])
    assert response.get('status') == ('config_required' if broker_mode else 'risk_blocked')


@pytest.mark.parametrize('account_flags_known', [True, False])
def test_fixed_hybrid_managed_exit_records_receipt_and_never_pays_ai(monkeypatch, tmp_path, account_flags_known):
    import start_quant_backend as backend
    from tests.test_pipeline_position_protection import _install_exit_runtime_scenario
    _, store = _store(tmp_path)
    _, managed = _install_exit_runtime_scenario(monkeypatch, [{'symbol': 'SPY', 'price': 94}])
    managed['SPY'].update(brokerAccountId='account-a', entryOrderId='buy')
    _record(store, _buy(), validated_entry=True, protocol_key='frozen')
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: store)
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {
        'strategy_program': 'equity_swing_v1', 'equity_execution_mode': 'broker', 'mode': 'hybrid',
        'trade_mode': 'real', 'live_auto_trading_enabled': True,
    })
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {
        'api_key': 'test', 'api_secret': 'test', 'base_url': 'https://broker.invalid',
    })
    class Response:
        status_code = 200
        def __init__(self, payload):
            self.payload = payload
        def json(self):
            return self.payload
    flags = {key: False for key in ('trading_blocked', 'account_blocked', 'trade_suspended_by_user')} if account_flags_known else {}
    monkeypatch.setattr(backend.requests, 'get', lambda url, **kw: Response(
        {'id': 'account-a', 'equity': 2000, 'cash': 2000, **flags} if url.endswith('/account') else []))
    ai = []
    monkeypatch.setattr(backend, '_pa_exit_ai_challenge', lambda *a, **kw: ai.append(kw['enabled']) or {'used': False})
    submitted = []
    def submit(uid, path, view, body):
        submitted.append(body)
        return {'success': True, 'status': 'submitted', 'order': {'id': 'managed-exit', 'symbol': 'SPY', 'side': 'sell'}}, 200
    monkeypatch.setattr(backend, '_pa_call_endpoint', submit)
    result = backend._pa_exit_scan_headless('owner', [], 'hybrid', trade_mode='real')
    assert len(submitted) == (1 if account_flags_known else 0), result
    assert ai == [False]
    ownership = read_order_attribution(store, 'owner', 'account-a', 'real')[1]['orders']
    assert ('managed-exit' in ownership) is account_flags_known
