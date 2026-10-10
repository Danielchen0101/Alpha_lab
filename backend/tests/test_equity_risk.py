import json

import pytest

from equity_risk import PendingEntryReservations, cash_funded_buying_power, portfolio_entry_budget
from equity_risk import entry_fill_anchor_updates, position_anchor_review, completed_sessions_since
from equity_risk import DurableEntryReservations
from equity_risk import protection_reconciliation_blockers
from operations_store import OperationsStore, OperationsVersionConflict


def _policy(**updates):
    return {
        'equitySwingV1': True, 'riskPerTradePct': 0.5,
        'maxSinglePositionPct': 20, 'maxGrossExposurePct': 80,
        'maxPositions': 4, 'sectorCapPct': 40,
        'maxOpenStopRiskPct': 2, 'maxCorrelatedExposurePct': 40,
        **updates,
    }


def _account(**updates):
    return {'equity': '5000', 'cash': '5000', 'buying_power': '10000', **updates}


def _position(symbol='AAA', qty=10, price=100, sector='Technology'):
    return {'symbol': symbol, 'qty': str(qty), 'current_price': str(price),
            'market_value': str(qty * price), 'side': 'long', 'sector': sector}


def _stop(symbol='AAA', qty=10, price=98, **updates):
    return {'id': 'stop-' + symbol, 'symbol': symbol, 'side': 'sell',
            'type': 'stop', 'qty': str(qty), 'filled_qty': '0',
            'stop_price': str(price), 'status': 'new', 'time_in_force': 'gtc', **updates}


def _buy(symbol='BBB', qty=5, price=100, filled=0):
    return {'id': 'buy-' + symbol, 'symbol': symbol, 'side': 'buy', 'type': 'limit',
            'qty': str(qty), 'filled_qty': str(filled), 'limit_price': str(price),
            'status': 'new', 'order_class': 'oto',
            'legs': [_stop(symbol, qty, price - 2, status='held')]}


def _budget(positions=None, orders=None, managed=None, policy=None, **candidate):
    return portfolio_entry_budget(
        _account(), positions or [], orders or [], managed or {}, policy or _policy(),
        {'symbol': 'NEW', 'sector': 'Energy', 'notional': 500, 'riskDollars': 10, **candidate},
    )


def test_negative_cash_cannot_be_replaced_by_non_marginable_buying_power():
    assert cash_funded_buying_power(_account(cash=-23140.2, non_marginable_buying_power=7386.56)) == 0
    assert cash_funded_buying_power(_account(cash=100, non_marginable_buying_power=500)) == 100
    assert cash_funded_buying_power(_account(cash=100, non_marginable_buying_power=50)) == 50


def test_pending_orders_reserve_cash_without_double_subtracting_broker_buying_power():
    assert cash_funded_buying_power(_account(cash=5000, buying_power=3000), 2000, 10) == 2990


def test_existing_gross_exposure_leaves_only_actual_remaining_capacity():
    result = _budget(
        [_position(qty=30)], [], policy=_policy(equitySwingV1=False, maxGrossExposurePct=60,
                                               maxOpenStopRiskPct=None, maxCorrelatedExposurePct=None),
    )
    assert result['ok'] is False
    assert result['maxAdditionalNotional'] == 0
    assert 'gross portfolio budget would be exceeded' in result['blockers']


def test_partial_open_buy_reserves_remaining_quantity_and_deduplicates_nested_stops():
    buy = _buy(qty=10, filled=4)
    result = _budget(orders=[buy, buy['legs'][0]], managed={'BBB': {'sector': 'Financial'}})
    assert result['ok'] is True
    assert result['pendingBuyNotional'] == 600
    assert result['openStopRisk'] == 12
    assert result['positionCountIncludingOrders'] == 1


def test_cancelled_order_never_reserves_cash_or_position_slot():
    buy = _buy()
    buy['status'] = 'canceled'
    result = _budget(orders=[buy])
    assert result['ok'] is True
    assert result['pendingBuyNotional'] == 0
    assert result['positionCountIncludingOrders'] == 0


@pytest.mark.parametrize('orders', [[], [_stop(qty=9)], [_stop(type='stop_limit')], [_stop(status='pending_cancel')], [_stop(status='unknown')]])
def test_swing_entry_blocks_unknown_or_partial_stop_protection(orders):
    result = _budget([_position()], orders)
    assert result['ok'] is False
    assert any('protection' in blocker for blocker in result['blockers'])


def test_existing_stop_risk_and_pending_stop_risk_share_one_budget():
    result = _budget([_position(qty=10)], [_stop(price=91), _buy(qty=1)],
                     managed={'BBB': {'sector': 'Financial'}})
    assert result['openStopRisk'] == 92
    assert result['maxAdditionalRisk'] == 8
    assert 'Portfolio stop-risk budget would be exceeded' in result['blockers']


def test_unknown_sector_is_not_proof_of_diversification():
    result = _budget([_position(qty=19, sector='Unknown')], [_stop(qty=19)], notional=500)
    assert result['correlatedExposure'] == 1900
    assert 'correlated portfolio budget would be exceeded' in result['blockers']


def test_positions_plus_pending_symbols_reserve_all_four_slots():
    positions = [_position('A'), _position('B')]
    orders = [_stop('A'), _stop('B'), _buy('C'), _buy('D')]
    result = _budget(positions, orders)
    assert 'Portfolio position capacity is exhausted including pending buys' in result['blockers']


def test_unpriced_pending_order_fails_closed():
    buy = _buy()
    buy.pop('limit_price')
    assert 'Pending buy exposure cannot be bounded' in _budget(orders=[buy])['blockers']


def test_legacy_explicit_lower_position_limit_is_preserved():
    result = _budget(policy=_policy(equitySwingV1=False, maxSinglePositionPct=5,
                                   maxOpenStopRiskPct=None, maxCorrelatedExposurePct=None))
    assert result['maxAdditionalNotional'] == 250
    assert 'singlePosition portfolio budget would be exceeded' in result['blockers']


def test_reservations_survive_restart_and_duplicate_id_cannot_change_intent(tmp_path):
    path = tmp_path / 'intents.json'
    store = PendingEntryReservations(path)
    store.reserve('client-1', {'symbol': 'A', 'qty': 2, 'notional': 100})
    assert PendingEntryReservations(path).read()['client-1']['qty'] == 2
    with pytest.raises(ValueError, match='different intent'):
        store.reserve('client-1', {'symbol': 'B', 'qty': 2, 'notional': 100})
    store.release('client-1')
    assert store.read() == {}


def test_corrupt_reservation_store_is_not_treated_as_empty(tmp_path):
    path = tmp_path / 'intents.json'
    path.write_text(json.dumps({'version': 0, 'intents': {}}))
    with pytest.raises(ValueError, match='Invalid'):
        PendingEntryReservations(path).read()


def test_duplicate_pending_parents_reserve_once_and_filled_quantity_is_not_pending():
    buy = _buy(qty=10, filled=4)
    assert _budget(orders=[buy, dict(buy)])['pendingBuyNotional'] == 600
    buy['filled_qty'] = '10'
    result = _budget(orders=[buy])
    assert result['pendingBuyNotional'] == 0
    assert result['positionCountIncludingOrders'] == 0


def test_pending_cancel_buy_keeps_reserving_until_broker_confirms_terminal():
    buy = {**_buy(), 'status': 'pending_cancel'}
    assert _budget(orders=[buy])['pendingBuyNotional'] == 500
    buy['status'] = 'canceled'
    assert _budget(orders=[buy])['pendingBuyNotional'] == 0


def test_fill_anchors_exclude_prefill_high_and_ignore_replayed_older_partial():
    record = {'entryOrderId': 'entry', 'equitySwingV1': True, 'entryAtr14': 2,
              'initialStop': 97, 'currentStop': 97, 'highWaterMark': 110}
    order = {'id': 'entry', 'side': 'buy', 'filled_qty': '2', 'filled_avg_price': '100',
             'updated_at': '2026-07-10T15:00:00Z'}
    first = entry_fill_anchor_updates(record, order)
    assert first['highWaterMark'] == 100
    assert first['entrySession'] == '2026-07-10'
    assert first['initialStop'] == 97
    assert first['currentStop'] == 97  # Never loosen the real attached stop.
    assert first['initialRiskPerShare'] == 3
    later = entry_fill_anchor_updates({**record, **first}, {**order, 'filled_qty': '4', 'updated_at': '2026-07-10T16:00:00Z'})
    assert later['filledAt'] == first['filledAt']
    assert later['entryFilledQty'] == 4
    assert entry_fill_anchor_updates({**record, **later}, order) == {}
    assert entry_fill_anchor_updates(record, {**order, 'id': 'foreign'}) == {}


def test_actual_fill_risk_uses_original_stop_after_partial_fill_and_stop_ratchet():
    record = {'entryOrderId': 'entry', 'equitySwingV1': True, 'initialStop': 97,
              'originalAttachedStop': 97, 'currentStop': 99, 'entryFilledQty': 2,
              'filledAt': '2026-07-10T15:00:00Z'}
    order = {'id': 'entry', 'side': 'buy', 'filled_qty': '4', 'filled_avg_price': '99.5'}
    result = entry_fill_anchor_updates(record, order)
    assert result['initialRiskPerShare'] == 2.5
    assert result['initialStop'] == 97 and result['currentStop'] == 99
    gap = entry_fill_anchor_updates(record, {**order, 'filled_avg_price': '96'})
    assert gap['entryGeometryReviewRequired']
    assert 'currentStop' not in gap
    assert position_anchor_review({'avg_entry_price': 96, 'qty': 4}, {**record, **gap})


def test_basis_discontinuity_requires_reconciliation_and_cannot_self_clear():
    record = {'equitySwingV1': True, 'fillAnchorVerified': True, 'entryFillPrice': 100, 'entryFilledQty': 10}
    assert position_anchor_review({'avg_entry_price': 50, 'qty': 20}, record)
    assert position_anchor_review({'avg_entry_price': 100, 'qty': 15}, record)
    assert position_anchor_review({'avg_entry_price': 100, 'qty': 8}, record) is None
    assert position_anchor_review({'avg_entry_price': 100, 'qty': 10}, {**record, 'corporateActionReviewRequired': True})
    assert position_anchor_review({'avg_entry_price': 95, 'qty': 10}, {**record, 'equitySwingV1': False, 'entryIntent': 'SCALE_IN'}) is None


def test_session_count_uses_completed_bars_after_fill_not_weekend_or_submission():
    bars = [
        {'date': date, 'open': 100, 'high': 101, 'low': 99, 'close': 100}
        for date in ['2026-07-09', '2026-07-10', '2026-07-13']
    ]
    assert completed_sessions_since('2026-07-10T14:00:00Z', bars, '2026-07-13T14:00:00Z') == 1
    assert completed_sessions_since('2026-07-10T21:00:00Z', bars, '2026-07-13T14:00:00Z') == 0
    assert completed_sessions_since(None, bars) is None


def test_durable_reservations_invalidate_a_concurrently_sized_account(tmp_path):
    store = OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'operations.json')
    one = DurableEntryReservations(store, 'owner', 'acct', 'paper')
    two = DurableEntryReservations(store, 'owner', 'acct', 'paper')
    assert one.read() == two.read() == {}
    one.reserve('client-a', {'qty': 5, 'notional': 500})
    with pytest.raises(OperationsVersionConflict):
        two.reserve('client-b', {'qty': 5, 'notional': 500})
    restarted = OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / 'operations.json')
    restored = DurableEntryReservations(restarted, 'owner', 'acct', 'paper')
    assert restored.read()['client-a']['notional'] == 500
    assert DurableEntryReservations(store, 'owner', 'acct', 'live').read() == {}
    assert DurableEntryReservations(store, 'owner', 'other-account', 'paper').read() == {}
    assert DurableEntryReservations(store, 'different-owner', 'acct', 'paper').read() == {}
    restored.release('client-a')
    assert restored.read() == {}


def test_partial_oto_never_claims_its_held_leg_is_active_protection():
    position = _position('BBB', qty=4)
    pending = _buy('BBB', qty=10, filled=4)
    blockers = protection_reconciliation_blockers(position, [pending])
    assert len(blockers) == 2
    pending['status'] = 'filled'
    pending['filled_qty'] = '10'
    pending['legs'][0]['status'] = 'new'
    assert protection_reconciliation_blockers(position, [pending]) == []
    pending['legs'][0]['status'] = 'pending_cancel'
    assert protection_reconciliation_blockers(position, [pending])
    assert protection_reconciliation_blockers(position, [], snapshot_complete=False)
