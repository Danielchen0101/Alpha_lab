from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from kalshi_api import (
    KalshiApiError, _PaperRobotController, _paper_account_context,
    _paper_order_payload, _live_order_payload,
)
from kalshi_engine import evaluate_btc15_contract
from tests.test_kalshi_engine import _candles, _early_market


def _strategy(family):
    return {'dailyRiskByFamily': {family: {
        'date': datetime.now(ZoneInfo('America/New_York')).date().isoformat(),
        'stopped': True, 'consecutiveLosses': 3, 'limit': 3,
    }}}


@pytest.mark.parametrize('ticker,family', [
    ('KXBTC15M-TEST-00', 'btc15m'), ('KXBTCD-TEST-T65000', 'btchourly'),
])
def test_current_family_streak_blocks_entry_and_final_router(ticker, family):
    now = datetime.now(timezone.utc)
    account = {'balance': {'balance': 100000, 'portfolio_value': 0}, 'positions': [], 'orders': []}
    state = {'config': {}, 'strategy': _strategy(family)}
    context = _paper_account_context(account, state, ticker, 1000)
    assert context['dailyLossStreakStopped']
    candles, spot = _candles()
    decision = evaluate_btc15_contract(
        _early_market(now, ticker=ticker, floor_strike=64600),
        spot_price=spot, candles=candles, now=now, reference_time=now,
        book_time=now, account_context=context,
    )
    assert decision['action'] == 'WAIT'
    assert 'daily_loss_streak' in decision['blockingReasons']
    assert decision['sizing']['contracts'] == 0
    assert decision['dailyRisk']['stopped']
    # A previously valid decision must not bypass a newly latched daily stop.
    previous = {'action': 'BUY_YES', 'side': 'YES', 'edge': {'price': .70}, 'sizing': {'contracts': 1}}
    payload = _paper_order_payload(previous, ticker)
    live_payload = _live_order_payload(payload)
    controller = _PaperRobotController(None, None, None)
    with pytest.raises(KalshiApiError) as exc:
        controller._validate_live_order_preflight(state, account, payload, live_payload, previous, verify_shard_cash=False)
    assert exc.value.code == 'kalshi_daily_loss_streak'


def test_loss_stop_leaves_reduce_only_protective_exit_available():
    ticker = 'KXBTC15M-TEST-00'
    state = {'config': {}, 'strategy': _strategy('btc15m'), 'filledTrades': [{
        'ticker': ticker, 'action': 'BUY_YES', 'side': 'YES', 'fillCount': 1,
        'orderId': 'entry', 'orderFilled': True, 'environment': 'real',
    }]}
    account = {'balance': {'balance': 100000, 'portfolio_value': 0}, 'positions': [{
        'ticker': ticker, 'position_fp': '1.00', 'market_exposure_dollars': '.70',
    }], 'orders': []}
    decision = {'action': 'SELL_YES', 'side': 'YES', 'executionIntent': 'PROTECTIVE_EXIT_YES',
                'edge': {'price': .50}, 'sizing': {'contracts': 1}}
    payload = _paper_order_payload(decision, ticker)
    live_payload = _live_order_payload(payload)
    controller = _PaperRobotController(None, None, None)
    assert controller._validate_live_order_preflight(state, account, payload, live_payload, decision, verify_shard_cash=False) is None


@pytest.mark.parametrize('exposure,contracts,blocked', [(0, 200, False), (10, 200, True), (0, 215, True)])
def test_shared_fifteen_percent_cap_rechecked_against_actual_cost(exposure, contracts, blocked):
    ticker = 'KXBTC15M-TEST-00'
    state = {'config': {'riskPerTradePct': 15, 'maxSingleMarketExposurePct': 15, 'maxPortfolioExposurePct': 15}}
    positions = [{'ticker': 'KXBTCD-OTHER-T65000', 'position_fp': '20', 'market_exposure_dollars': exposure}] if exposure else []
    account = {'balance': {'balance': 100000, 'portfolio_value': 0}, 'positions': positions, 'orders': []}
    decision = {'action': 'BUY_YES', 'side': 'YES', 'edge': {'price': .70}, 'sizing': {'contracts': contracts}}
    payload = _paper_order_payload(decision, ticker)
    live_payload = _live_order_payload(payload)
    controller = _PaperRobotController(None, None, None)
    if blocked:
        with pytest.raises(KalshiApiError) as exc:
            controller._validate_live_order_preflight(state, account, payload, live_payload, decision, verify_shard_cash=False)
        assert exc.value.code == 'kalshi_live_exposure_changed'
    else:
        assert controller._validate_live_order_preflight(state, account, payload, live_payload, decision, verify_shard_cash=False) is None


def _validate_entry_budget(config, *, bankroll=1000, count=10, sizing=None, edge=None):
    ticker = 'KXBTC15M-PER-ORDER-CAP'
    decision = {
        'action': 'BUY_YES', 'side': 'YES',
        'edge': {'price': .70, **(edge or {})},
        'sizing': {'plannedContractsFp': count, **(sizing or {})},
        # A decision evaluated under the old ceiling is intentionally stale.
        'config': {'riskPerTradePct': 15},
    }
    state = {'config': {
        'riskPerTradePct': 15, 'maxSingleMarketExposurePct': 15,
        'maxPortfolioExposurePct': 15, **config,
    }}
    account = {
        'balance': {'balance': int(bankroll * 100), 'portfolio_value': 0},
        'positions': [], 'orders': [],
    }
    payload = _paper_order_payload(decision, ticker)
    return _PaperRobotController(None, None, None)._validate_live_order_preflight(
        state, account, payload, _live_order_payload(payload), decision,
        verify_shard_cash=False,
    )


def test_final_router_rechecks_lowered_per_order_cap_after_decision():
    assert _validate_entry_budget({'riskPerTradePct': .25}, count=3) is None
    with pytest.raises(KalshiApiError) as exc:
        _validate_entry_budget({'riskPerTradePct': .25}, count=10)
    assert exc.value.code == 'kalshi_live_order_risk_changed'


def test_exact_one_contract_micro_exception_remains_bounded():
    assert _validate_entry_budget(
        {'riskPerTradePct': .5}, bankroll=20, count=1,
        sizing={'microSizingApplied': True},
        edge={'netEdge': .04, 'conservativeEdge': .02},
    ) is None
    with pytest.raises(KalshiApiError) as exc:
        _validate_entry_budget(
            {'riskPerTradePct': .5}, bankroll=20, count=2,
            sizing={'microSizingApplied': True},
            edge={'netEdge': .04, 'conservativeEdge': .02},
        )
    assert exc.value.code == 'kalshi_live_order_risk_changed'


def test_fractional_small_account_exception_revalidates_current_budget():
    sizing = {
        'smallAccountSizingApplied': True, 'fractionalSizingEnabled': True,
        'appliedRiskScale': 1, 'smallAccountRiskBudget': .4, 'riskBudget': .4,
    }
    edge = {'netEdge': .10, 'conservativeEdge': .10, 'conservativeProbability': .90}
    assert _validate_entry_budget(
        {'riskPerTradePct': .5}, bankroll=20, count=.3, sizing=sizing, edge=edge,
    ) is None
    for config, count in [
        ({'riskPerTradePct': .5, 'smallAccountRiskTargetPct': .5}, .3),
        ({'riskPerTradePct': .5, 'fractionalContractSizingEnabled': False}, .3),
        ({'riskPerTradePct': .5}, .6),
    ]:
        with pytest.raises(KalshiApiError) as exc:
            _validate_entry_budget(config, bankroll=20, count=count, sizing=sizing, edge=edge)
        assert exc.value.code == 'kalshi_live_order_risk_changed'


def test_small_account_boolean_without_sizing_evidence_does_not_bypass_cap():
    with pytest.raises(KalshiApiError) as exc:
        _validate_entry_budget(
            {'riskPerTradePct': .5}, bankroll=20, count=.3,
            sizing={'smallAccountSizingApplied': True},
            edge={'netEdge': .10, 'conservativeEdge': .10},
        )
    assert exc.value.code == 'kalshi_live_order_risk_changed'
