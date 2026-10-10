from datetime import datetime, timedelta, timezone

import pytest
import start_quant_backend as backend
from equity_risk import DurableEntryReservations
from operations_store import OperationsStore


def _bars():
    day = datetime(2026, 5, 1)
    rows = []
    while day <= datetime(2026, 7, 10):
        if day.weekday() < 5:
            rows.append({'date': day.date().isoformat(), 'open': 100, 'high': 102,
                         'low': 98, 'close': 100, 'volume': 10000})
        day += timedelta(days=1)
    return rows


def _exit(record_updates=None, indicator_updates=None):
    record = {
        'equitySwingV1': True, 'entryFillPrice': 100, 'fillAnchorVerified': True,
        'entryFilledQty': 5, 'entrySession': '2026-07-10', 'entryTimestamp': '2026-07-10T14:00:00Z',
        'filledAt': '2026-07-10T14:00:00Z', 'initialRiskPerShare': 4,
        'initialStop': 96, 'currentStop': 96, 'entryAtr14': 2,
        'takeProfit1': 101, 'takeProfit2': 102, 'highWaterMark': 150,
        **(record_updates or {}),
    }
    indicators = {'price': 103, 'bid': 102.99, 'quoteAgeSeconds': 1,
                  'completedBars': _bars(), 'sessionHigh': 150,
                  **(indicator_updates or {})}
    return backend._pa_build_dynamic_exit_plan(
        {'symbol': 'AAPL', 'avg_entry_price': '100', 'qty': '5', 'current_price': '103'},
        record, 96, 101, 102, indicators, account_equity=5000,
        now=datetime(2026, 7, 13, 14, tzinfo=timezone.utc),
    )


def test_swing_does_not_inherit_prefill_high_or_structural_partial_targets():
    result = _exit()
    assert result['action'] == 'hold'
    assert result['currentStop'] == 96
    assert result['highWaterMark'] == 100
    assert result['sessionsHeld'] == 1
    assert result['target1'] is None and result['target2'] is None
    assert result['partialExitsAllowed'] is False


def test_swing_time_stop_is_whole_exit_after_twenty_completed_sessions():
    result = _exit({'entrySession': '2026-05-20', 'entryTimestamp': '2026-05-20T14:00:00Z'})
    assert result['sessionsHeld'] >= 20
    assert result['action'] == 'time_exit'
    assert result['partialExitsAllowed'] is False


@pytest.mark.parametrize('record,indicators', [
    ({'fillAnchorVerified': False}, {}),
    ({'corporateActionReviewRequired': True}, {}),
    ({}, {'quoteAgeSeconds': None}),
    ({}, {'completedBars': []}),
])
def test_uncertain_swing_state_preserves_stop_and_blocks_mutations(record, indicators):
    result = _exit(record, indicators)
    assert result['action'] == 'manual_review'
    assert result['protectionMutationBlocked'] is True
    assert result['currentStop'] == 96


def test_legacy_prefill_session_high_cannot_trigger_a_false_emergency_exit():
    result = backend._pa_build_dynamic_exit_plan(
        {'symbol': 'AAPL', 'avg_entry_price': 100, 'qty': 5, 'current_price': 100},
        {'initialStop': 95, 'currentStop': 95, 'initialRiskPerShare': 5, 'highWaterMark': 100},
        95, 112, 118, {'atr14': 1, 'sessionHigh': 110}, account_equity=5000,
    )
    assert result['currentStop'] == 95
    assert result['action'] == 'hold'


def test_swing_preflight_reprices_two_atr_and_requires_whole_share_protection():
    plan = {'equitySwingV1': True, 'entryAtr14': 2, 'entryZoneLow': 99, 'entryZoneHigh': 101,
            'stopLoss': 97, 'takeProfit1': 110, 'shares': 100, 'riskBudget': 25,
            'maxAllocationDollars': 1000}
    quote = {'bid': 100, 'ask': 100.05, 'bidSize': 100, 'askSize': 100}
    result = backend._build_entry_limit_preflight(plan, quote, 5000)
    assert result['ok'] is True
    assert result['limitPrice'] == 100.16
    assert result['stopLoss'] == 96.16
    assert result['shares'] == 6
    assert result['riskDollars'] <= 25
    assert result['orderClass'] == 'oto'
    assert backend._build_entry_limit_preflight({**plan, 'riskBudget': 0}, quote, 5000)['ok'] is False
    assert backend._build_entry_limit_preflight({**plan, 'shares': 0.5}, quote, 5000)['ok'] is False


def test_swing_preflight_matches_registered_preview_and_cent_exact_risk():
    from equity_broker_plan import prepare_plans
    from equity_program import equity_policy
    now = datetime.now(timezone.utc).isoformat()
    protocol = {'symbols': ['SPY'], 'strategy': 'breakout20', 'strategyVersion': 'equity_fixed_v1',
                'protocolKey': 'frozen', 'protocolHash': 'hash', 'dataVersion': 'data'}
    quotes = {'SPY': {'t': now, 'bp': 100, 'ap': 100.01, 'bs': 100, 'as': 100}}
    plans, rejected = prepare_plans(protocol, equity_policy(), [{'symbol': 'SPY', 'eligible': True, 'atr14': 2.0001}],
                                    quotes, {'equity': 5000, 'cash': 5000, 'buying_power': 5000}, [], [], {}, now)
    assert not rejected and len(plans) == 1
    quote = {'bid': 100, 'ask': 100.01, 'bidSize': 100, 'askSize': 100}
    final = backend._build_entry_limit_preflight(plans[0], quote, 5000, limit_offset_bps=5)
    assert final['ok'], final
    assert final['limitPrice'] == plans[0]['orderPreview']['limitPrice'] == 100.12
    assert final['stopLoss'] == plans[0]['stopLoss'] == 96.11
    assert final['riskPerShare'] == plans[0]['entryRiskPerShare'] == 4.01
    assert final['shares'] == plans[0]['shares']
    assert backend._build_entry_limit_preflight(plans[0], {**quote, 'askSize': 1}, 5000)['code'] == 'quote_depth_insufficient'
    assert backend._build_entry_limit_preflight(plans[0], {**quote, 'bidSize': None}, 5000)['code'] == 'quote_depth_unavailable'
    assert backend._build_entry_limit_preflight(plans[0], {**quote, 'ask': 100.02}, 5000)['code'] == 'price_outside_zone'


def test_preflight_risk_uses_the_actual_tick_rounded_stop():
    plan = {'entryZoneLow': 99, 'entryZoneHigh': 101, 'stopLoss': 97.009,
            'takeProfit1': 110, 'shares': 1000, 'riskBudget': 304.5,
            'maxAllocationDollars': 100000}
    result = backend._build_entry_limit_preflight(plan, {'bid': 100, 'ask': 100.05}, 100000)
    assert result['ok']
    assert result['shares'] * (result['limitPrice'] - result['stopLoss']) <= 304.5


def _install_entry_route(monkeypatch, tmp_path):
    policy = {
        'equitySwingV1': True, 'riskPerTradePct': 0.5, 'maxSinglePositionPct': 20,
        'maxGrossExposurePct': 80, 'maxPositions': 4, 'sectorCapPct': 40,
        'maxOpenStopRiskPct': 2, 'maxCorrelatedExposurePct': 40,
        'maxDailyFilledOrders': 10, 'dailyLossStopPct': 1.5,
        'optionsAllowed': False, 'leverageEnabled': False, 'effectiveLimits': {},
    }
    monkeypatch.setattr(backend, '_PA_RUNTIME_LOCK_DIR', str(tmp_path))
    monkeypatch.setattr(backend, 'operations_store', OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'operations.json'))
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: backend.operations_store, raising=False)
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'swing-user'})
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {'equitySwingV1': True})
    monkeypatch.setattr(backend, '_equity_swing_enabled', lambda config: True)
    monkeypatch.setattr(backend, '_strategy_policy', lambda *a, **kw: dict(policy))
    monkeypatch.setattr(backend, '_apply_account_hard_risk_limits', lambda p, uid: p)
    monkeypatch.setattr(backend, '_operations_buy_submission_block', lambda *a, **kw: None)
    monkeypatch.setattr(backend, '_pa_workspace_preferences', lambda config: {'risk': {}})
    monkeypatch.setattr(backend, '_equity_account_risk_snapshot', lambda *a: {'entry_allowed': True, 'complete': True, 'daily_loss_pct': 0})
    monkeypatch.setattr(backend, '_equity_validate_entry_plan', lambda *a: {'ok': True, 'atr14': 2, 'protocolKey': 'trusted'}, raising=False)
    monkeypatch.setattr(backend, '_pa_get_managed_position_plan', lambda *a: {})
    monkeypatch.setattr(backend, '_pa_managed_records_for_user', lambda *a: {})
    monkeypatch.setattr(backend, '_record_order_lifecycle', lambda *a, **kw: {'stored': True})
    monkeypatch.setattr(backend, '_pa_record_managed_position_plan', lambda *a, **kw: None)
    monkeypatch.setattr(backend, 'resolve_alpaca_config', lambda *a, **kw: ({'api_key': 'test', 'api_secret': 'test', 'base_url': 'https://broker.invalid'}, 'test'))
    state = {'positions': [], 'orders': [], 'posts': [], 'lookup': {}, 'equity': 5000, 'cash': 5000}

    class Response:
        def __init__(self, payload, status=200):
            self.payload, self.status_code, self.text = payload, status, '{}'

        def json(self):
            return self.payload

    def get(url, **kwargs):
        if url.endswith('/clock'):
            return Response({'is_open': True})
        if url.endswith('/calendar'):
            return Response([{'date': kwargs['params']['start'], 'open': '00:00', 'close': '23:59:59'}])
        if url.endswith('/snapshot'):
            return Response({'latestQuote': {'bp': 100, 'ap': 100.05, 'bs': 100, 'as': 100,
                                             't': datetime.now(timezone.utc).isoformat(), **state.get('quote_overrides', {})}})
        if url.endswith('/account'):
            return Response({'id': 'acct', 'equity': state['equity'], 'cash': state['cash'], 'buying_power': state['cash'] * 2,
                             'trading_blocked': False, 'account_blocked': False, 'trade_suspended_by_user': False,
                             **state.get('account_overrides', {})})
        if '/assets/' in url:
            return Response({'class': 'us_equity', 'tradable': True, 'status': 'active', 'fractionable': True,
                             **state.get('asset_overrides', {})})
        if url.endswith('/positions'):
            return Response(state['positions'])
        if url.endswith('/orders'):
            return Response(state['orders'] if kwargs['params']['status'] == 'open' else [])
        raise AssertionError('Unexpected request ' + url)

    def post(url, **kwargs):
        body = kwargs['json']
        state['posts'].append(body)
        if state.get('timeout'):
            raise TimeoutError('unknown')
        if state.get('reject'):
            return Response({'message': 'rejected'}, 422)
        order = {**body, 'id': 'order-' + str(len(state['posts'])), 'status': 'new', 'filled_qty': '0'}
        state['lookup'][body['client_order_id']] = order
        state['orders'].append(order)
        return Response(order)

    monkeypatch.setattr(backend.requests, 'get', get)
    monkeypatch.setattr(backend.requests, 'post', post)
    monkeypatch.setattr(backend, '_alpaca_lookup_order_by_client_id', lambda url, headers, cid: (state['lookup'].get(cid), None))
    monkeypatch.setattr(backend, '_alpaca_reconcile_ambiguous_submission', lambda *a: (None, 'not_visible'))

    def submit(symbol='AAPL'):
        now = datetime.now(timezone.utc)
        plan = {'symbol': symbol, 'entryZoneLow': 99, 'entryZoneHigh': 101,
                'stopLoss': 97, 'takeProfit1': 110, 'shares': 100, 'riskBudget': 500,
                'maxAllocationDollars': 10000, 'entryAtr14': 0.01,
                'strategyVersion': 'equity_fixed_v1',
                'finalAction': 'BUY_READY', 'riskGate': {'status': 'PASS'},
                'dataQuality': 'GOOD', 'tradeReadiness': 'READY', 'setupAutoEligible': True,
                'entryTriggerMet': True, 'entryTriggerStatus': 'CONFIRMED',
                'triggerEvaluatedAt': now.isoformat(), 'sector': 'Technology'}
        return backend.app.test_client().post('/api/entry-plan/execute', json={
            'symbol': symbol, 'planSnapshot': plan, 'executionMode': 'paper',
            'isAutoExecute': False, 'suppressDiscord': True,
        }).get_json()
    return state, submit


def test_final_entry_uses_trusted_atr_and_reserves_sequential_orders(monkeypatch, tmp_path):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    first = submit()
    assert first['action'] == 'ORDER_SUBMITTED', first
    assert state['posts'][0]['qty'] == '6'
    assert state['posts'][0]['time_in_force'] == 'gtc'
    assert state['posts'][0]['stop_loss'] == {'stop_price': '96.16'}
    from equity_runtime import read_order_attribution
    receipt = read_order_attribution(backend.operations_store, 'swing-user', 'acct', 'paper')[1]['orders']['order-1']
    assert receipt['entryExpiresAt'] and receipt['originalStopPrice'] == 96.16
    duplicate = submit()
    assert duplicate['action'] == 'BLOCKED'
    assert len(state['posts']) == 1
    # The previous buy reserves $600.96 from the shared 40% correlated cap.
    state['orders'][0]['qty'] = '19'
    state['orders'][0]['stop_loss']['stop_price'] = '99.05'
    second = submit('MSFT')
    assert second['action'] == 'BLOCKED', second  # < one share remains.
    assert len(state['posts']) == 1


@pytest.mark.parametrize('field', ['trading_blocked', 'account_blocked', 'trade_suspended_by_user'])
def test_swing_final_account_unknown_flags_cannot_submit(monkeypatch, tmp_path, field):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    state['account_overrides'] = {field: None}
    result = submit()
    assert result['action'] == 'BLOCKED'
    assert any('explicit unblocked' in reason for reason in result['blockers'])
    assert state['posts'] == []


@pytest.mark.parametrize('field', ['class', 'tradable', 'status'])
def test_swing_unknown_asset_eligibility_cannot_submit(monkeypatch, tmp_path, field):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    state['asset_overrides'] = {field: None}
    result = submit()
    assert result['action'] == 'BLOCKED'
    assert any('explicitly active' in reason for reason in result['blockers'])
    assert state['posts'] == []


@pytest.mark.parametrize('age_seconds', [-60, 31])
def test_swing_quote_requires_registered_freshness_and_nonfuture_time(monkeypatch, tmp_path, age_seconds):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    state['quote_overrides'] = {'t': (datetime.now(timezone.utc) - timedelta(seconds=age_seconds)).isoformat()}
    result = submit()
    assert result['action'] == 'BLOCKED'
    assert state['posts'] == []


def test_ambiguous_post_reservation_blocks_retry_and_survives_restart(monkeypatch, tmp_path):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    state['timeout'] = True
    first = submit()
    assert first['code'] == 'broker_submission_ambiguous', first
    assert DurableEntryReservations(backend.operations_store, 'swing-user', 'acct', 'paper').read()
    monkeypatch.setattr(backend, 'operations_store', OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'operations.json'))
    state['timeout'] = False
    second = submit('MSFT')
    assert second['action'] == 'BLOCKED'
    assert any('unresolved' in reason for reason in second['blockers'])
    assert len(state['posts']) == 1


def test_definite_rejection_frees_reservation_and_all_entry_locks(monkeypatch, tmp_path):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    state['reject'] = True
    assert submit()['action'] == 'BLOCKED'
    assert not DurableEntryReservations(backend.operations_store, 'swing-user', 'acct', 'paper').read()
    state['reject'] = False
    assert submit('MSFT')['action'] == 'ORDER_SUBMITTED'
    assert len(state['posts']) == 2


def test_broker_account_lock_blocks_an_independent_entry_path(monkeypatch, tmp_path):
    state, submit = _install_entry_route(monkeypatch, tmp_path)
    lease = backend._pa_acquire_runtime_file_lock('equity-entry-account', 'paper:acct')
    try:
        response = submit()
        assert response['code'] == 'equity_entry_busy'
        assert state['posts'] == []
    finally:
        backend._pa_release_runtime_file_lock(lease)


def test_first_reconciliation_of_cancelled_partial_entry_keeps_its_fill_anchor(monkeypatch):
    class Response:
        status_code = 200

        def json(self):
            return [{'id': 'entry', 'client_order_id': 'alphalab-partial', 'symbol': 'IWM',
                     'side': 'buy', 'type': 'limit', 'status': 'canceled', 'qty': '10',
                     'filled_qty': '4', 'filled_avg_price': '100', 'updated_at': '2026-07-10T15:00:00Z'}]
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {'api_key': 'test', 'api_secret': 'test', 'base_url': 'https://broker.invalid'})
    monkeypatch.setattr(backend.requests, 'get', lambda *a, **kw: Response())
    monkeypatch.setattr(backend, '_record_order_lifecycle', lambda *a, **kw: None)
    monkeypatch.setattr(backend, '_pa_managed_records_for_user', lambda *a: {'user:paper:IWM': {
        'symbol': 'IWM', 'entryOrderId': 'entry', 'clientOrderId': 'alphalab-partial',
        'equitySwingV1': True, 'entryAtr14': 2, 'currentStop': 96}})
    updates = []
    monkeypatch.setattr(backend, '_pa_update_managed_position', lambda *a, **kw: updates.append(kw))
    backend._pa_reconcile_order_lifecycle('user', 'paper', notify=False)
    assert updates[0]['status'] == 'position_open'
    assert updates[0]['entryFilledQty'] == 4
    assert updates[0]['entryFillPrice'] == 100
    assert updates[0]['fillAnchorVerified'] is True
