from datetime import date
import time

import start_quant_backend as backend
from start_quant_backend import (
    _market_calendar_filter_and_dedupe,
    _market_calendar_parse_census_html,
    _market_calendar_parse_fed_html,
    _market_calendar_parse_ics,
    _market_calendar_parse_omb_bls_text,
    _market_intelligence_filter_watchlist_earnings,
    _market_intelligence_enrich_news,
    _market_intelligence_theme_breadth,
    _market_intelligence_watchlist_symbols,
    _market_risk_aggregate,
    _market_risk_snapshot_row,
)


def _rows(changes):
    return [
        {
            'symbol': f'S{index}',
            'changePct': change,
            'dollarVolume': 10_000_000 + index * 1_000,
        }
        for index, change in enumerate(changes)
    ]


def _benchmarks(changes):
    symbols = ('SPY', 'QQQ', 'IWM')
    return [
        {'symbol': symbol, 'changePct': change, 'dollarVolume': 1_000_000_000}
        for symbol, change in zip(symbols, changes)
    ]


def test_broad_participation_produces_low_risk_state():
    result = _market_risk_aggregate(
        _rows([1.0] * 60 + [-0.4] * 25 + [0.0] * 15),
        benchmarks=_benchmarks([0.8, 1.1, 0.6]),
        universe_count=100,
    )

    assert result['advancing'] == 60
    assert result['declining'] == 25
    assert result['coveragePct'] == 100.0
    assert result['riskScore'] < 30
    assert result['regime'] in ('risk_on', 'constructive')


def test_broad_selloff_produces_high_risk_state():
    result = _market_risk_aggregate(
        _rows([-3.2] * 80 + [-1.0] * 10 + [0.4] * 10),
        benchmarks=_benchmarks([-2.4, -3.0, -2.8]),
        universe_count=100,
    )

    assert result['decliningPct'] == 90.0
    assert result['downTwoPct'] == 80.0
    assert result['riskScore'] >= 70
    assert result['riskLevel'] == 'high'
    assert result['regime'] == 'risk_off'


def test_snapshot_change_uses_daily_close_instead_of_noisy_latest_trade():
    snapshot = {
        'dailyBar': {'c': 102.0, 'v': 1_000_000, 't': '2026-07-17T20:00:00Z'},
        'prevDailyBar': {'c': 100.0, 'v': 900_000},
        'latestTrade': {'p': 140.0},
    }
    row = _market_risk_snapshot_row('TEST', snapshot, {'TEST': {'name': 'Test Inc', 'exchangeName': 'NYSE'}})

    assert row['changePct'] == 2.0
    assert row['price'] == 102.0
    assert row['exchange'] == 'NYSE'


def test_theme_breadth_groups_named_industries_and_counts_direction():
    result = _market_intelligence_theme_breadth([
        {'symbol': 'STX', 'name': 'Seagate Technology', 'changePct': 3.0},
        {'symbol': 'WDC', 'name': 'Western Digital', 'changePct': -1.0},
        {'symbol': 'RKLB', 'name': 'Rocket Lab USA', 'changePct': 4.0},
        {'symbol': 'LUNR', 'name': 'Intuitive Machines', 'changePct': 2.0},
    ])

    by_key = {row['key']: row for row in result}
    assert by_key['storage_memory']['advancing'] == 1
    assert by_key['storage_memory']['declining'] == 1
    assert by_key['space']['advancing'] == 2
    assert by_key['space']['averageChangePct'] == 3.0


def test_news_impact_explains_topic_direction_and_affected_symbols():
    enriched = _market_intelligence_enrich_news({
        'headline': 'Federal Reserve cuts interest rate after inflation report',
        'summary': 'Markets rally after the decision.',
        'symbols': ['SPY', 'QQQ', 'IWM'],
    })

    assert enriched['topic'] == 'Monetary policy'
    assert enriched['impactLevel'] in ('High', 'Critical')
    assert enriched['impactScore'] >= 60
    assert enriched['marketDirection'] == 'positive'
    assert 'broad-market' in enriched['marketImpact']


def test_macro_news_without_tickers_infers_market_proxies():
    enriched = _market_intelligence_enrich_news({
        'headline': 'Nonfarm payroll jobs report surprises markets',
        'summary': 'Unemployment and wage growth will shape rate expectations.',
        'symbols': [],
    })

    assert enriched['topic'] == 'Economy & labor'
    assert enriched['symbolImpactSource'] == 'topic_inference'
    assert {'SPY', 'IWM', 'TLT'}.issubset(set(enriched['symbols']))


def test_short_topic_keywords_do_not_match_inside_unrelated_words():
    enriched = _market_intelligence_enrich_news({
        'headline': 'Markets shrug off political turmoil',
        'summary': 'A migration debate dominated the weekend.',
        'symbols': [],
    })

    assert enriched['topic'] != 'Energy & commodities'
    assert 'XLE' not in enriched['symbols']


def test_watchlist_symbols_are_normalized_and_deduplicated():
    symbols = _market_intelligence_watchlist_symbols({
        'symbols': [' nvda ', 'AAPL', 'NVDA', '', None, 'brk.b'],
    })

    assert symbols == ['NVDA', 'AAPL', 'BRK.B']


def test_earnings_calendar_only_keeps_watchlist_symbols():
    events = [
        {'date': '2026-08-05', 'symbol': 'NVDA', 'hour': 'amc', 'epsEstimate': 1.2},
        {'date': '2026-08-05', 'symbol': ' nvda ', 'hour': 'amc', 'epsEstimate': 1.2},
        {'date': '2026-08-04', 'symbol': 'AAPL', 'hour': 'bmo'},
        {'date': '2026-08-06', 'symbol': 'MSFT', 'hour': 'amc'},
        {'date': '', 'symbol': 'AAPL', 'hour': 'amc'},
    ]

    filtered = _market_intelligence_filter_watchlist_earnings(events, ['aapl', 'NVDA'])

    assert [(event['date'], event['symbol']) for event in filtered] == [
        ('2026-08-04', 'AAPL'),
        ('2026-08-05', 'NVDA'),
    ]


def test_empty_watchlist_skips_all_earnings():
    assert _market_intelligence_filter_watchlist_earnings(
        [{'date': '2026-08-05', 'symbol': 'NVDA'}],
        [],
    ) == []


def test_official_ics_calendar_unfolds_titles_and_converts_to_eastern_time():
    events = _market_calendar_parse_ics(
        """BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Personal Income and Outlays\\, June 2026 with a long
 continuation
DTSTART;VALUE=DATE-TIME:20260730T123000Z
END:VEVENT
END:VCALENDAR
""",
        'BEA',
        'https://example.gov/calendar.ics',
    )

    assert len(events) == 1
    assert events[0]['date'] == '2026-07-30'
    assert events[0]['time'] == '08:30 ET'
    assert events[0]['name'] == 'Personal Income and Outlays, June 2026 with a longcontinuation (PCE inflation)'
    assert events[0]['importance'] == 'high'


def test_omb_bls_schedule_extracts_nonfarm_cpi_and_ppi_dates():
    schedule_text = """
    BUREAU OF LABOR STATISTICS
    The Employment Situation (Data are for previous month)
    9 6 6 3 8 5 2 7 4 2 6 4
    Producer Price Indexes (Data are for previous month)
    14 12 12 14 13 11 15 13 10 15 13 15
    Consumer Price Index (Data are for previous month)
    13 11 11 10 12 10 14 12 11 14 10 10
    Real Earnings (Data are for previous month)
    13 11 11 10 12 10 14 12 11 14 10 10
    Productivity and Costs
    Employment Cost Index (Data are for previous month)
    30 30 31 30
    U.S. Import and Export Price Indexes (Data are for previous month)
    15 18 17 15 14 16 17 18 16 16 17 17
    DEPT AGENCY/INDICATORS
    """

    events = _market_calendar_parse_omb_bls_text(schedule_text, 2026, 'https://example.gov/2026.pdf')
    by_name_and_month = {(event['name'], event['date'][:7]): event for event in events}

    assert by_name_and_month[('Employment Situation (Nonfarm Payrolls)', '2026-08')]['date'] == '2026-08-07'
    assert by_name_and_month[('Consumer Price Index (CPI)', '2026-08')]['date'] == '2026-08-12'
    assert by_name_and_month[('Producer Price Index', '2026-08')]['date'] == '2026-08-13'


def test_census_calendar_parser_preserves_period_and_market_importance():
    events = _market_calendar_parse_census_html(
        """<table><tr height="20">
        <td><a href="/retail">Advance Monthly Sales for Retail and Food Services</a></td>
        <td>August 14, 2026</td><td>8:30 AM</td><td>July 2026</td>
        </tr></table>""",
        'https://www.census.gov/economic-indicators/calendar-listview.html',
    )

    assert events[0]['date'] == '2026-08-14'
    assert events[0]['time'] == '08:30 ET'
    assert events[0]['period'] == 'July 2026'
    assert events[0]['importance'] == 'medium'


def test_fed_calendar_uses_decision_day_and_marks_projection_meetings():
    events = _market_calendar_parse_fed_html(
        """<a id="x">2026 FOMC Meetings</a>
        <div class="row fomc-meeting">
          <div class="fomc-meeting__month"><strong>September</strong></div>
          <div class="fomc-meeting__date">15-16*</div>
        </div>
        <a id="y">2027 FOMC Meetings</a>""",
        'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    )

    assert events[0]['date'] == '2026-09-16'
    assert events[0]['time'] == '14:00 ET'
    assert 'economic projections' in events[0]['name']
    assert events[0]['importance'] == 'high'


def test_official_events_are_windowed_and_exact_duplicates_removed():
    events = [
        {'date': '2026-08-07', 'time': '08:30 ET', 'name': 'Employment Situation', 'importance': 'high'},
        {'date': '2026-08-07', 'time': '08:30 ET', 'name': 'Employment Situation', 'importance': 'medium'},
        {'date': '2026-09-16', 'time': '14:00 ET', 'name': 'FOMC decision', 'importance': 'high'},
    ]

    filtered = _market_calendar_filter_and_dedupe(
        events,
        date(2026, 8, 1),
        date(2026, 8, 31),
    )

    assert filtered == [events[0]]


def test_official_calendar_keeps_per_source_stale_data_when_one_source_fails(monkeypatch):
    tomorrow = backend.datetime.now(backend.ZoneInfo('America/New_York')).date() + backend.timedelta(days=1)
    cached_event = {
        'date': tomorrow.isoformat(),
        'time': '08:30 ET',
        'name': 'Consumer Price Index (CPI)',
        'importance': 'high',
        'source': 'U.S. Bureau of Labor Statistics',
    }
    with backend._MARKET_ECONOMIC_CALENDAR_CACHE_LOCK:
        backend._MARKET_ECONOMIC_CALENDAR_CACHE.clear()
        backend._MARKET_ECONOMIC_CALENDAR_CACHE.update({
            'storedAt': time.time() - backend._MARKET_ECONOMIC_CALENDAR_CACHE_TTL_SECONDS - 1,
            'allEvents': [cached_event],
            'sourceEvents': {'bls': [cached_event]},
            'sourceStoredAt': {'bls': time.time() - 60},
            'sources': ['U.S. Bureau of Labor Statistics'],
            'warnings': [],
            'errors': [],
            'sourceStatus': {'bls': {'status': 'ready', 'source': 'U.S. Bureau of Labor Statistics'}},
        })

    def fail_bls(*_args):
        raise RuntimeError('temporary_failure')

    def empty_source(*_args):
        return [], 'Official test source', []

    monkeypatch.setattr(backend, '_market_calendar_fetch_bls', fail_bls)
    monkeypatch.setattr(backend, '_market_calendar_fetch_bea', empty_source)
    monkeypatch.setattr(backend, '_market_calendar_fetch_census', empty_source)
    monkeypatch.setattr(backend, '_market_calendar_fetch_fed', empty_source)

    payload = backend._market_intelligence_official_economic_events(30, force_refresh=True)

    assert payload['events'][0]['name'] == 'Consumer Price Index (CPI)'
    assert payload['sourceStatus']['bls']['status'] == 'stale'
    assert 'bls_using_stale_cache' in payload['warnings']

    with backend._MARKET_ECONOMIC_CALENDAR_CACHE_LOCK:
        backend._MARKET_ECONOMIC_CALENDAR_CACHE.clear()


def test_calendar_endpoint_combines_watchlist_earnings_with_public_macro_events(monkeypatch):
    monkeypatch.setattr(backend, 'require_auth', lambda: {'id': 'calendar-user'})
    monkeypatch.setattr(
        backend.operations_store,
        'get_artifact',
        lambda *_args: {'payload': {'symbols': ['AAPL']}},
    )
    monkeypatch.setattr(backend, 'resolve_finnhub_config_strict_user', lambda: ({'api_key': 'test'}, 'ok'))
    monkeypatch.setattr(
        backend,
        '_inst_fetch_finnhub_earnings_calendar',
        lambda *_args, **_kwargs: ({'earningsCalendar': [
            {'date': '2026-08-10', 'symbol': 'AAPL', 'hour': 'amc'},
            {'date': '2026-08-11', 'symbol': 'MSFT', 'hour': 'amc'},
        ]}, None),
    )
    monkeypatch.setattr(
        backend,
        '_market_intelligence_official_economic_events',
        lambda *_args, **_kwargs: {
            'events': [{
                'date': '2026-08-07', 'time': '08:30 ET',
                'name': 'Employment Situation (Nonfarm Payrolls)',
                'importance': 'high', 'source': 'U.S. Bureau of Labor Statistics',
            }],
            'sources': ['U.S. Bureau of Labor Statistics'],
            'errors': [], 'warnings': [],
            'sourceStatus': {'bls': {'status': 'ready', 'eventCount': 1}},
            'cache': {'status': 'miss', 'ageSeconds': 0},
        },
    )

    response = backend.app.test_client().get('/api/trade/intelligence/calendar?days=30')
    payload = response.get_json()

    assert response.status_code == 200
    assert [event['symbol'] for event in payload['earnings']] == ['AAPL']
    assert payload['watchlistSymbols'] == ['AAPL']
    assert payload['economicEvents'][0]['name'] == 'Employment Situation (Nonfarm Payrolls)'
    assert payload['economicCalendar']['status'] == 'ready'
    assert payload['sources'] == ['Finnhub /calendar/earnings', 'U.S. Bureau of Labor Statistics']
