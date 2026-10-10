from copy import deepcopy
from datetime import datetime, timezone

import pytest

import start_quant_backend as backend
from equity_broker_plan import prepare_plans
from equity_program import equity_policy
from equity_store import EquityAuthenticatedStore
from operations_store import OperationsStore, OperationsStoreUnavailable


def test_server_evidence_signature_cannot_be_reused_after_edit_or_across_users(tmp_path):
    raw = OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'state.json')
    store = EquityAuthenticatedStore(raw, 'test-server-secret')
    store.put_artifact('u', 'equity_shadow', 'p', payload={'eligible': False}, idempotency_key='one', expected_version=0)
    assert store.get_artifact('u', 'equity_shadow', 'p')['payload'] == {'eligible': False}
    copied = raw.get_artifact('u', 'equity_shadow', 'p')['payload']
    raw.put_artifact('other', 'equity_shadow', 'p', payload=copied, idempotency_key='copy')
    with pytest.raises(OperationsStoreUnavailable):
        store.get_artifact('other', 'equity_shadow', 'p')
    copied['eligible'] = True
    raw.put_artifact('u', 'equity_shadow', 'p', payload=copied, idempotency_key='edit')
    with pytest.raises(OperationsStoreUnavailable):
        store.get_artifact('u', 'equity_shadow', 'p')


@pytest.mark.parametrize('method', ['put', 'delete'])
def test_generic_artifact_route_cannot_forge_or_reset_equity_evidence(monkeypatch, method):
    monkeypatch.setattr(backend, 'require_auth', lambda: {'id': 'u'})
    response = getattr(backend.app.test_client(), method)('/api/operations/artifacts', json={
        'artifactType': ' Equity_research_result ', 'artifactKey': 'p', 'payload': {'eligible': True}})
    assert response.status_code == 403


def test_stock_activation_preserves_schedule_and_requires_frozen_protocol(monkeypatch):
    monkeypatch.setattr(backend, 'require_auth', lambda: {'id': 'u'})
    monkeypatch.setattr(backend, '_equity_program_status', lambda *a: {'protocol': {'protocolKey': 'p'}})
    monkeypatch.setattr(backend, '_pa_user_run_is_reserved', lambda uid: False)
    changes = []
    monkeypatch.setattr(backend, '_pa_patch_config', lambda uid, patch: changes.append(patch) or (True, ''))
    client = backend.app.test_client()
    assert client.post('/api/ai-agent/equity/activate', json={'protocolKey': 'wrong'}).status_code == 409
    assert not changes
    response = client.post('/api/ai-agent/equity/activate', json={'protocolKey': 'p'})
    assert response.status_code == 200
    assert changes[0]['equity_execution_mode'] == 'shadow'
    assert changes[0]['live_auto_trading_enabled'] is False
    assert 'enabled' not in changes[0] and 'interval_minutes' not in changes[0]


def test_shadow_cannot_inherit_legacy_paper_authority(monkeypatch):
    config = {'strategy_program': 'equity_swing_v1', 'mode': 'ai', 'trade_mode': 'paper',
              'live_auto_trading_enabled': True}
    assert not backend._pa_order_authority(config)['buyAuthorized']
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: config)
    assert backend._operations_buy_submission_block('u', 'paper')['code'] == 'equity_shadow_only'


def test_live_graduation_fails_before_broker_call_if_research_unproven(monkeypatch):
    monkeypatch.setattr(backend, '_equity_program_status', lambda *a: {'researchAdmission': {'eligible': False, 'blockers': ['sixtyForwardSessions']}})
    result = backend._pa_validate_live_auto_authority('u', {'strategy_program': 'equity_swing_v1', 'mode': 'ai', 'trade_mode': 'real'})
    assert result['reason'] == 'equity_research_not_admitted'


def test_admitted_fixed_rules_use_explicit_live_authority_without_ai(monkeypatch):
    config = {'strategy_program': 'equity_swing_v1', 'equity_execution_mode': 'broker',
              'mode': 'hybrid', 'trade_mode': 'real', 'live_auto_trading_enabled': True}
    assert backend._pa_order_authority(config)['buyAuthorized'] is True
    assert backend._pa_order_authority({**config, 'live_auto_trading_enabled': False})['buyAuthorized'] is False
    assert backend._pa_order_authority(config, trade_mode='paper')['buyAuthorized'] is False
    monkeypatch.setattr(backend, '_equity_program_status', lambda *a: {'researchAdmission': {'eligible': True}})
    monkeypatch.setattr(backend, 'resolve_alpaca_config_for_user', lambda *a: {'api_key': 'test', 'api_secret': 'test'})
    flags = {'trading_blocked': False, 'account_blocked': False, 'trade_suspended_by_user': False}
    class Response:
        status_code = 200
        def json(self):
            return flags
    monkeypatch.setattr(backend.requests, 'get', lambda *a, **kw: Response())
    assert backend._pa_validate_live_auto_authority('u', config) is None
    flags.pop('account_blocked')
    assert backend._pa_validate_live_auto_authority('u', config)['reason'] == 'live_account_not_ready'


def test_fixed_pipeline_dispatch_skips_legacy_daily_strategy_selection(monkeypatch):
    config = {'strategy_program': 'equity_swing_v1'}
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: config)
    calls = []
    monkeypatch.setattr(backend, '_equity_run_pipeline', lambda *args: calls.append(args) or {'businessStatus': 'no_signal'})
    assert backend._pa_run_pipeline('u', 15, 'ai')['businessStatus'] == 'no_signal'
    assert len(calls) == 1


def test_frozen_status_does_not_report_missing_protocol(monkeypatch):
    import equity_research_service
    import equity_shadow
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {})
    monkeypatch.setattr(backend, '_equity_operations_store', lambda: object())
    monkeypatch.setattr(equity_research_service.EquityResearchService, 'status',
                        lambda *args: {'protocol': {'protocolKey': 'p', 'protocolHash': 'h'}})
    monkeypatch.setattr(equity_shadow, 'read_shadow', lambda *args: {})
    status = backend._equity_program_status('u')
    assert status['protocolKey'] == 'p'
    assert 'protocol_not_frozen' not in status['blockers']
    assert status['brokerOrdersAllowed'] is False
    assert status['blockers'] == ['trusted_research_artifact_missing']


def test_broker_protection_runs_before_fallible_research_reads(monkeypatch):
    calls = []
    monkeypatch.setattr(backend, '_pa_check_stop_requested', lambda *a, **kw: False)
    monkeypatch.setattr(backend, '_pa_update_active_run', lambda *a, **kw: True)
    monkeypatch.setattr(backend, '_pa_save_pipeline_debug_dump', lambda *a, **kw: {})
    monkeypatch.setattr(backend, '_equity_reconcile_entry_expiry', lambda *a: calls.append('expiry') or {'ok': True}, raising=False)
    monkeypatch.setattr(backend, '_pa_reconcile_order_lifecycle', lambda *a, **kw: calls.append('reconcile'))
    monkeypatch.setattr(backend, '_pa_exit_scan_headless', lambda *a, **kw: calls.append('protect') or {})
    def failed_evidence(*args):
        calls.append('evidence')
        raise RuntimeError('archive unavailable')
    monkeypatch.setattr(backend, '_equity_program_status', failed_evidence)
    result = backend._equity_run_pipeline('u', {'equity_execution_mode': 'broker'}, 'hybrid', 'real', 'r', 'manual')
    assert calls == ['expiry', 'reconcile', 'protect', 'evidence']
    assert result['businessStatus'] == 'failed' and result['orders_submitted'] == 0


@pytest.mark.parametrize('program', ['equity_swing_v1', 'legacy'])
def test_expired_entry_guard_runs_after_hours_under_user_reservation(monkeypatch, program):
    calls = []
    class ImmediateThread:
        def __init__(self, target, **kwargs):
            self.target = target
        def start(self):
            self.target()
    monkeypatch.setattr(backend, '_PA_POSITION_GUARD_STATE', {})
    monkeypatch.setattr(backend.threading, 'Thread', ImmediateThread)
    monkeypatch.setattr(backend, '_pa_try_reserve_user_run', lambda *a: calls.append('reserve') or True)
    monkeypatch.setattr(backend, '_pa_release_user_run', lambda *a: calls.append('release'))
    monkeypatch.setattr(backend, '_equity_reconcile_entry_expiry', lambda uid, mode: calls.append(('expiry', mode)) or {'ok': True}, raising=False)
    monkeypatch.setattr(backend, '_pa_exit_scan_headless', lambda *a, **kw: pytest.fail('regular-session exit work ran after hours'))
    assert backend._pa_maybe_start_position_guard(
        'u', {'strategy_program': program, 'equity_broker_monitoring_required': True}, datetime(2026, 10, 9, 22, tzinfo=timezone.utc),
        'hybrid', 'low', 'mid', 'paper', False)
    assert calls == ['reserve', ('expiry', 'real'), 'release']
    assert backend._PA_POSITION_GUARD_STATE['u']['running'] is False


def test_after_hours_partial_quarantine_repairs_original_real_account_only(monkeypatch):
    calls = []
    class ImmediateThread:
        def __init__(self, target, **kwargs): self.target = target
        def start(self): self.target()
    monkeypatch.setattr(backend, '_PA_POSITION_GUARD_STATE', {})
    monkeypatch.setattr(backend.threading, 'Thread', ImmediateThread)
    monkeypatch.setattr(backend, '_pa_try_reserve_user_run', lambda *a: calls.append('reserve') or True)
    monkeypatch.setattr(backend, '_pa_release_user_run', lambda *a: calls.append('release'))
    monkeypatch.setattr(backend, '_equity_reconcile_entry_expiry', lambda uid, mode: calls.append(('expiry', mode)) or
                        {'ok': False, 'quarantinedOrderIds': ['partial'], 'blockers': ['partial_fill']})
    monkeypatch.setattr(backend, '_pa_reconcile_order_lifecycle', lambda uid, mode, **kw: calls.append(('lifecycle', mode)) or {})
    def protection(uid, plans, mode, **kwargs):
        assert kwargs['protection_only'] is True and kwargs['ai_review'] is False
        calls.append(('protect', kwargs['trade_mode']))
        return {'signals': [], 'submitted': []}
    monkeypatch.setattr(backend, '_pa_exit_scan_headless', protection)
    assert backend._pa_maybe_start_position_guard('u', {'strategy_program': 'legacy', 'equity_broker_monitoring_required': True},
        datetime(2026, 10, 9, 22, tzinfo=timezone.utc), 'hybrid', 'low', 'mid', 'paper', False)
    assert calls == ['reserve', ('expiry', 'real'), ('lifecycle', 'real'), ('protect', 'real'), 'release']
    assert backend._PA_POSITION_GUARD_STATE['u']['running'] is False


def test_ai_list_error_preserves_provider_context():
    from equity_program import business_outcome
    assert business_outcome({'aiResearch': [{'status': 'payment_required', 'error': '402'}]}) == 'ai_degraded'


def test_fixed_planner_reserves_batch_and_never_rounds_up_to_one_share():
    policy = equity_policy()
    protocol = {'symbols': ['IWM', 'XLF', 'QQQ'], 'strategy': 'breakout20', 'strategyVersion': 'equity_fixed_v1',
                'dataVersion': 'equity_sip_v1', 'protocolKey': 'p', 'protocolHash': 'h'}
    signals = [{'symbol': s, 'eligible': True, 'atr14': 1} for s in protocol['symbols']]
    now = '2026-10-09T14:00:00Z'
    quotes = {s: {'t': now, 'bp': 100, 'ap': 100.01} for s in protocol['symbols']}
    small = {'equity': 18.11, 'cash': 18.11, 'buying_power': 18.11, 'non_marginable_buying_power': 18.11}
    plans, blocked = prepare_plans(protocol, policy, signals, quotes, small, [], [], {}, now)
    assert not plans and len(blocked) == 3
    account = {key: 2000 for key in small}
    plans, blocked = prepare_plans(protocol, policy, signals, quotes, account, [], [], {}, now)
    assert sum(plan['shares'] * plan['entryZoneHigh'] for plan in plans) <= 800  # correlated ETF group
    assert all(plan['shares'] * plan['entryRiskPerShare'] <= 10 for plan in plans)
    assert all(plan['partialExitsAllowed'] is False for plan in plans)
