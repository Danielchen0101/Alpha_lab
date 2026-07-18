from start_quant_backend import _market_risk_aggregate, _market_risk_snapshot_row


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
