from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest

from equity_program import business_outcome, equity_policy
from equity_shadow import capture_cycle, read_shadow, _archive_bars, _archive_actions, _portfolio_budgets
from equity_strategy import normalize_daily_bars
from operations_store import OperationsStore


def test_fixed_policy_cannot_inherit_aggressive_legacy_limits():
    policy = equity_policy({'riskPerTradePct': 1.5, 'maxPositions': 12, 'scaleInAllowed': True,
                            'leverageEnabled': True, 'optionsAllowed': True})
    assert (policy['riskPerTradePct'], policy['maxSinglePositionPct'], policy['maxGrossExposurePct']) == (0.5, 20, 80)
    assert (policy['maxPositions'], policy['maxOpenStopRiskPct'], policy['maxCorrelatedExposurePct']) == (4, 2, 40)
    assert (policy['dailyLossStopPct'], policy['maxDrawdownPct']) == (1.5, 12)
    assert not policy['scaleInAllowed'] and not policy['leverageEnabled'] and not policy['optionsAllowed']


def test_domain_status_distinguishes_degraded_from_no_signal():
    assert business_outcome({'errors': 0, 'orders_submitted': 0}) == 'no_signal'
    assert business_outcome({'errors': 0, 'steps': [{'aiStatus': 'error', 'http': 402}]}) == 'ai_degraded'
    assert business_outcome({'errors': 0, 'admission_stats': {'aiChallenge': {'status': 'error'}}}) == 'ai_degraded'
    assert business_outcome({'businessStatus': 'capital_blocked'}) == 'capital_blocked'
    assert business_outcome({'errors': 1}) == 'failed'


def fixtures(tmp_path):
    store = OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'operations.json')
    start = datetime(2025, 11, 1, tzinfo=timezone.utc)
    days = [(start + timedelta(days=i)).date().isoformat() for i in range(342)
            if (start + timedelta(days=i)).weekday() < 5]
    days = [day for day in days if day <= '2026-10-08']
    calendar = [{'date': day, 'open': '09:30', 'close': '16:00'} for day in days + ['2026-10-09']]
    bars = [{'t': day + 'T04:00:00Z', 'o': 100 + i * .1, 'c': 100 + i * .1,
             'h': 100.05 + i * .1, 'l': 99.95 + i * .1, 'v': 1000000} for i, day in enumerate(days)]
    current = {'now': '2026-10-09T14:00:00+00:00', 'quote': True}
    def broker(path, params):
        if path == '/v2/clock':
            return {'timestamp': current['now'], 'is_open': True}
        return calendar
    def data(path, params):
        if path == '/v2/stocks/bars':
            return {'bars': {'IWM': bars}, 'next_page_token': None}
        if path == '/v2/stocks/quotes/latest':
            quote = {'t': current['now'], 'bp': 124.40, 'ap': 124.41, 'bs': 100, 'as': 100}
            return {'quotes': {'IWM': quote} if current['quote'] else {}}
        raise ValueError('actions_unavailable')
    protocol = {'protocolKey': 'frozen', 'protocolHash': 'hash', 'strategy': 'breakout20',
                'strategyVersion': 'equity_fixed_v1', 'frozenAt': '2026-10-09T13:00:00+00:00',
                'symbols': ['IWM'], 'config': {'initialCapital': 2000, 'monthlyOperatingCost': 0}}
    return store, protocol, data, broker, current


def test_shadow_never_invents_quotes_or_counts_repeated_runs_as_days(tmp_path):
    store, protocol, data, broker, current = fixtures(tmp_path)
    first = capture_cycle(store, 'owner', protocol, data, broker, now=current['now'])
    assert first['brokerOrdersSubmitted'] == 0
    assert first['forward']['tradingSessions'] == 0  # current session is incomplete
    assert first['forward']['completedTrades'] == 0
    second = capture_cycle(store, 'owner', protocol, data, broker, now=current['now'])
    assert first['state'] == second['state']
    saved = read_shadow(store, 'owner', 'frozen')
    assert len(saved['dataset']['quotes']['IWM']) == 1
    assert not read_shadow(store, 'different-user', 'frozen')
    current.update(now='2026-10-09T14:15:00+00:00', quote=False)
    missing = capture_cycle(store, 'owner', protocol, data, broker, now=current['now'])
    assert missing['businessStatus'] == 'data_insufficient'
    assert len(read_shadow(store, 'owner', 'frozen')['dataset']['quotes']['IWM']) == 1


def test_shadow_dry_run_does_not_mutate_durable_book(tmp_path):
    store, protocol, data, broker, current = fixtures(tmp_path)
    capture_cycle(store, 'owner', protocol, data, broker, now=current['now'], dry_run=True)
    assert not read_shadow(store, 'owner', 'frozen')


def test_shadow_rejects_changed_frozen_cohort(tmp_path):
    store, protocol, data, broker, current = fixtures(tmp_path)
    capture_cycle(store, 'owner', protocol, data, broker, now=current['now'])
    changed = {**protocol, 'protocolHash': 'retuned'}
    with pytest.raises(ValueError, match='protocol_changed'):
        capture_cycle(store, 'owner', changed, data, broker, now=current['now'])


def test_backfilled_daily_bar_is_unavailable_to_earlier_forward_quotes():
    row = {'session': '2026-10-08', 'timestamp': '2026-10-08T04:00:00Z',
           'availableAt': '2026-10-09T04:00:00Z', 'open': 100, 'high': 102,
           'low': 99, 'close': 101, 'volume': 10000, 'complete': True, 'feed': 'sip'}
    archive, corrections = _archive_bars({}, {'SPY': [row]}, '2026-10-12T14:00:00Z')
    assert corrections == []
    before, _ = normalize_daily_bars(archive['SPY'], '2026-10-09T14:00:00Z')
    after, _ = normalize_daily_bars(archive['SPY'], '2026-10-12T14:01:00Z')
    assert before == [] and len(after) == 1
    reread, _ = _archive_bars(archive, {'SPY': [row]}, '2026-10-13T14:00:00Z')
    assert reread == archive


def test_action_backfill_cannot_rewrite_prior_shadow_positions():
    dividend = {'id': 'd1', 'symbol': 'SPY', 'type': 'dividend', 'exDate': '2026-10-09',
                'cashAmount': 1, 'payDate': '2026-10-15'}
    archive, corrections = _archive_actions([], [dividend], '2026-10-12T14:00:00Z', '2026-10-09')
    assert archive == []
    assert corrections[0]['type'] == 'late_corporate_action'
    known_early, corrections = _archive_actions([], [dividend], '2026-10-08T14:00:00Z', '2026-10-08')
    assert corrections == [] and known_early[0]['id'] == 'd1'


def test_shadow_raw_revision_quarantines_and_preserves_committed_book(tmp_path):
    store, protocol, data, broker, current = fixtures(tmp_path)
    for minute in (0, 1, 2):
        current['now'] = '2026-10-09T14:%02d:00+00:00' % minute
        capture_cycle(store, 'owner', protocol, data, broker, now=current['now'])
    before = read_shadow(store, 'owner', 'frozen')
    assert before['fills']
    current['now'] = '2026-10-12T14:00:00+00:00'

    def changed_broker(path, params):
        rows = broker(path, params)
        return rows + [{'date': '2026-10-12', 'open': '09:30', 'close': '16:00'}] if path.endswith('calendar') else rows

    def revised_data(path, params):
        result = deepcopy(data(path, params))
        if path.endswith('/bars'):
            result['bars']['IWM'][0]['v'] += 1
            result['bars']['IWM'].append({'t': '2026-10-09T04:00:00Z', 'o': 124.4, 'h': 125, 'l': 124, 'c': 124.4, 'v': 1000000})
        return result

    result = capture_cycle(store, 'owner', protocol, revised_data, changed_broker, now=current['now'])
    after = read_shadow(store, 'owner', 'frozen')
    assert result['businessStatus'] == 'risk_paused'
    assert result['state']['valuationStale'] is True
    assert after['fills'] == before['fills']
    assert after['equityCurve'] == before['equityCurve']
    assert after['dataset']['bars']['IWM'][0] == before['dataset']['bars']['IWM'][0]
    assert after['evidenceCorrections'][0]['type'] == 'bar_revision'


def test_shadow_budget_includes_held_risk_and_pending_buys():
    state = {'equity': 2000, 'cash': 1500,
             'positions': {'IWM': {'qty': 2, 'entryPrice': 100, 'stopPrice': 95}},
             'pendingOrders': [{'symbol': 'GLD', 'side': 'buy', 'qty': 1, 'limitPrice': 200, 'initialRiskPerShare': 5}]}
    budget = _portfolio_budgets(state, {'IWM': [{'bid': 101}]}, ['IWM', 'QQQ', 'GLD'], equity_policy())
    assert budget['grossExposure'] == 402
    assert budget['pendingBuyNotional'] == 200
    assert budget['openStopRisk'] == 17
    assert budget['positionCountIncludingOrders'] == 2
