from copy import deepcopy
from datetime import datetime, timedelta

import pytest

from equity_data import dataset_hash, EQUITY_DATA_VERSION
from equity_qualification import (audit_qualification_quotes, build_qualification,
                                  forward_coverage_errors, qualification_identity)
from equity_strategy import entry_price_levels, NEW_YORK
from tests.test_equity_research import fixture_dataset


def book_fixture():
    days = ['2025-01-02', '2025-01-03', '2025-01-06']
    rows = [{'session': day, 'availableAt': day + 'T21:00:00Z', 'open': 100, 'high': 101,
             'low': 99, 'close': 100, 'volume': 10000} for day in days]
    dataset = {'dataVersion': EQUITY_DATA_VERSION, 'barAdjustment': 'raw', 'sessions': days,
               'marketSessions': {day: {'open': '09:30', 'close': '16:00'} for day in days},
               'bars': {'SPY': rows}, 'quotes': {'SPY': []}, 'corporateActions': []}
    dataset['dataHash'] = dataset_hash(dataset)
    entry, exit_at = '2025-01-06T15:00:00+00:00', '2025-01-06T15:05:00+00:00'
    return {'qualification': {'qualificationKey': 'cohort1', 'tradeStart': days[-1], 'symbols': ['SPY']},
            'dataset': dataset, 'asOf': '2025-01-07T22:00:00Z',
            'fills': [{'symbol': 'SPY', 'side': 'buy', 'timestamp': entry},
                      {'symbol': 'SPY', 'side': 'sell', 'timestamp': exit_at}],
            'protectionEvents': [{'symbol': 'SPY', 'entryTimestamp': entry, 'timestamp': entry, 'stopPrice': 98}],
            'orderIntents': [{'symbol': 'SPY', 'side': 'sell', 'submittedAt': '2025-01-06T15:04:00+00:00'}],
            'equityCurve': [{'session': days[-1], 'equity': 2001}],
            'diagnostics': ['quotesComplete_unverified', 'corporateActionsComplete_unverified', 'pointInTimeUniverse_unverified']}


def provider(book, bid=100, missing_day=None, quote_time='2025-01-06T15:02:00Z', missing_symbol=False):
    def fetch(path, params):
        if path == '/v1/corporate-actions':
            return {'corporate_actions': {}, 'next_page_token': None}
        if path == '/v2/stocks/bars':
            rows = [{'t': datetime.fromisoformat(row['session']).replace(tzinfo=NEW_YORK).isoformat(),
                     'o': row['open'], 'h': row['high'], 'l': row['low'], 'c': row['close'], 'v': row['volume']}
                    for row in book['dataset']['bars']['SPY'] if row['session'] != missing_day]
            return {'bars': {} if missing_symbol else {'SPY': rows}, 'next_page_token': None}
        return {'quotes': {'SPY': [{'t': quote_time, 'bp': bid, 'ap': bid + .01, 'bs': 100, 'as': 100}]}, 'next_page_token': None}
    return fetch


def audit(book, tmp_path, **kwargs):
    return audit_qualification_quotes(book, provider(book, **kwargs), now='2025-01-07T22:00:00Z', cache_dir=tmp_path)


def test_audit_proves_exposure_without_rewriting_polling_fills(tmp_path):
    book = book_fixture()
    original = deepcopy(book['fills'])
    proof = audit(book, tmp_path)
    assert proof['status'] == 'complete'
    assert proof['quoteRows'] == 1
    book['forwardAudit'] = proof
    assert forward_coverage_errors(book) == []
    assert book['fills'] == original
    book['protectionEvents'][0]['stopPrice'] = 97
    assert 'forward_audit_does_not_match_immutable_archive' in forward_coverage_errors(book)


def test_audit_catches_stop_breach_between_polling_observations(tmp_path):
    book = book_fixture()
    original = deepcopy(book['fills'])
    proof = audit(book, tmp_path, bid=97)
    assert proof['status'] == 'invalid'
    assert 'unobserved_protective_stop_breach' in proof['issues']
    assert book['fills'] == original


@pytest.mark.parametrize('missing', [{'missing_day': '2025-01-03'}, {'missing_symbol': True}])
def test_audit_rejects_incomplete_bar_response_even_with_other_matching_rows(tmp_path, missing):
    proof = audit(book_fixture(), tmp_path, **missing)
    assert proof['status'] == 'invalid'
    assert 'forward_daily_bar_coverage_incomplete' in proof['issues']


def test_audit_rejects_same_day_quote_outside_held_interval(tmp_path):
    with pytest.raises(ValueError, match='timestamp_outside_interval'):
        audit(book_fixture(), tmp_path, quote_time='2025-01-06T14:40:00Z')


def test_boolean_or_tampered_audit_is_not_coverage():
    book = book_fixture()
    book['forwardAudit'] = {'status': 'complete', 'eligible': True}
    assert forward_coverage_errors(book) == ['forward_sip_audit_required']


def test_clean_qualification_starts_at_first_actual_observation_after_history(monkeypatch):
    data = fixture_dataset()
    day = data['sessions'][0]
    previous = (datetime.fromisoformat(day) - timedelta(days=1)).date().isoformat()
    data['marketSessions'] = {day: {'open': '09:30', 'close': '16:00'}}
    data['quotes']['SPY'] = [data['quotes']['SPY'][0]]
    data['quotes']['SPY'][0]['feed'] = 'iex'
    data['dataHash'] = dataset_hash(data)
    artifact = {'completedAt': previous + 'T22:00:00Z', 'artifactHash': 'research1',
                'protocol': {'protocolKey': 'p', 'protocolHash': 'hash', 'strategy': 'breakout20', 'symbols': ['SPY'],
                             'frozenAt': '2025-01-01T00:00:00Z', 'config': {}}}
    exploratory = {'dataset': data, 'asOf': day + 'T20:00:00Z', 'state': {'cash': 123, 'positions': {'QQQ': {'qty': 10}}}}
    monkeypatch.setattr('equity_research.evaluate_admission', lambda artifact: {'historicalEligible': True})
    result = build_qualification(artifact, exploratory)
    assert result['state']['cash'] == 2000
    assert result['state']['positions'] == {}
    assert result['qualification']['startedAt'] == day + 'T14:30:00+00:00'
    assert result['qualification']['tradeStart'] == day
    data['quotes']['SPY'].append({**data['quotes']['SPY'][0], 'timestamp': day + 'T15:00:00Z', 'observedAt': day + 'T15:00:00Z'})
    assert qualification_identity(artifact, data) == result['qualification']


def test_entry_limit_stop_prices_are_cent_exact():
    levels = entry_price_levels(100.001, 1.234)
    assert levels['limitPrice'] == 100.11
    assert levels['initialRiskPerShare'] == 2.47
    assert levels['stopPrice'] == 97.64
