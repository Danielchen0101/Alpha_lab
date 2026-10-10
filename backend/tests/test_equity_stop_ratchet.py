from copy import deepcopy

import pytest
import start_quant_backend as backend


def stop(**updates):
    return {'id': 'native-stop', 'symbol': 'SPY', 'side': 'sell', 'type': 'stop',
            'qty': '5', 'filled_qty': '0', 'time_in_force': 'gtc',
            'status': 'new', 'stop_price': '96', **updates}


def test_broker_stop_overrides_previously_persisted_unapplied_desire():
    assert backend._pa_swing_effective_stop({'currentStop': 105}, {'stopPrice': 96}) == 96


def test_rejected_oto_ratchet_preserves_native_stop():
    actual = stop()
    def reject(_order_id, _price):
        raise ValueError('Broker does not support OTO replacement')
    result = backend._pa_ratchet_swing_stop('native-stop', 'SPY', 98, lambda _id: deepcopy(actual), reject)
    assert result['ok'] is False
    assert actual['stop_price'] == '96'


@pytest.mark.parametrize('updates', [
    {'stop_price': '96'}, {'status': 'pending_replace'}, {'status': 'held'},
    {'time_in_force': 'day'}, {'qty': '4'}, {'filled_qty': '1'},
    {'side': 'buy'}, {'symbol': 'QQQ'}, {'type': 'stop_limit'},
])
def test_successful_http_reply_is_not_verified_active_protection(updates):
    replies = iter([stop(), stop(id='replacement', stop_price='98', **{k: v for k, v in updates.items() if k != 'stop_price'})])
    if 'stop_price' in updates:
        replies = iter([stop(), stop(id='replacement', **updates)])
    result = backend._pa_ratchet_swing_stop('native-stop', 'SPY', 98, lambda _id: next(replies),
                                           lambda _id, price: {'id': 'replacement'})
    assert result['ok'] is False


def test_only_verified_full_remaining_gtc_stop_is_applied():
    replies = iter([stop(), stop(id='replacement', stop_price='98')])
    result = backend._pa_ratchet_swing_stop('native-stop', 'SPY', 98, lambda _id: next(replies),
                                           lambda _id, price: {'id': 'replacement'})
    assert result['ok'] is True
    assert result['stopPrice'] == 98
    assert result['order']['id'] == 'replacement'


def test_pending_replacement_can_later_reconcile_without_another_patch():
    pending = stop(id='replacement', stop_price='98', status='pending_replace')
    replies = iter([stop(), pending])
    first = backend._pa_ratchet_swing_stop('native-stop', 'SPY', 98, lambda _id: next(replies),
                                          lambda _id, price: pending)
    assert not first['ok']
    assert first['receipt']['id'] == 'replacement'
    def forbidden_patch(*args):
        pytest.fail('Already effective stop must only be reconciled')
    later = backend._pa_ratchet_swing_stop('replacement', 'SPY', 98,
                                          lambda _id: stop(id='replacement', stop_price='98'), forbidden_patch)
    assert later['ok']
    assert later['stopPrice'] == 98
