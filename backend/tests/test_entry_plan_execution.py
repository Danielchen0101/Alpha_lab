from datetime import datetime, timedelta, timezone

import start_quant_backend as backend


def _plan(**updates):
    plan = {
        'entryZoneLow': 99,
        'entryZoneHigh': 101,
        'stopLoss': 97,
        'takeProfit1': 110,
        'shares': 100,
        'riskBudget': 500,
        'maxAllocationDollars': 10_000,
        'slippageCapBps': 18,
    }
    plan.update(updates)
    return plan


def _executable_snapshot(**updates):
    now = datetime.now(timezone.utc)
    plan = _plan(
        symbol='AAPL',
        finalAction='BUY_READY',
        aiDecision='BUY',
        riskGate={'status': 'PASS', 'blockers': []},
        dataQuality='GOOD',
        tradeReadiness='READY',
        setupAutoEligible=True,
        entryTriggerMet=True,
        entryTriggerStatus='CONFIRMED',
        triggerEvaluatedAt=now.isoformat(),
        admissionDecision='ADMIT',
        admissionSnapshot={
            'id': 'admission-1',
            'inputFingerprint': 'fingerprint-1',
            'strategy': 'moving_average',
            'expiresAt': (now + timedelta(minutes=10)).isoformat(),
        },
        strategy='moving_average',
    )
    plan.update(updates)
    return plan


def test_entry_ai_overlay_can_only_confirm_or_downgrade():
    assert backend._merge_entry_ai_decision('BUY', 'BUY') == ('BUY', False, 'BUY')
    assert backend._merge_entry_ai_decision('BUY', 'WATCH') == ('WATCH', False, 'WATCH')
    assert backend._merge_entry_ai_decision('BUY', 'SKIP') == ('SKIP', False, 'SKIP')
    assert backend._merge_entry_ai_decision('WATCH', 'BUY') == ('WATCH', True, 'BUY')
    assert backend._merge_entry_ai_decision('SKIP', 'WATCH') == ('SKIP', True, 'WATCH')


def test_entry_preflight_uses_executable_ask_and_whole_share_bracket():
    result = backend._build_entry_limit_preflight(
        _plan(),
        {'bid': 100.00, 'ask': 100.05, 'last': 100.02},
        buying_power=100_000,
        fractionable=True,
    )

    assert result['ok'] is True
    assert result['limitPrice'] == 100.05
    assert result['shares'] == 99
    assert result['orderClass'] == 'bracket'
    assert result['protectionMode'] == 'alpaca_bracket'
    assert result['marketable'] is True
    assert result['notional'] <= 10_000
    assert result['riskDollars'] <= 500


def test_entry_preflight_resizes_to_cash_funded_buying_power():
    result = backend._build_entry_limit_preflight(
        _plan(shares=100, maxAllocationDollars=10_000, riskBudget=500),
        {'bid': 100.00, 'ask': 100.05, 'last': 100.02},
        buying_power=1_000,
        fractionable=True,
        require_attached_protection=True,
        require_marketable=True,
    )

    assert result['ok'] is True
    assert result['shares'] == 9
    assert result['notional'] <= 950
    assert result['riskDollars'] <= 500
    assert result['orderClass'] == 'bracket'


def test_entry_preflight_never_submits_when_ask_is_outside_zone():
    result = backend._build_entry_limit_preflight(
        _plan(),
        {'bid': 101.90, 'ask': 102.00, 'last': 100.50},
        buying_power=100_000,
    )

    assert result['ok'] is False
    assert result['code'] == 'price_outside_zone'
    assert 'Executable ask' in result['blockers'][0]


def test_entry_preflight_uses_passive_limit_when_ask_exceeds_slippage_cap():
    result = backend._build_entry_limit_preflight(
        _plan(),
        {'bid': 99.50, 'ask': 100.50, 'last': 100.00},
        buying_power=100_000,
    )

    assert result['ok'] is True
    assert result['limitPrice'] == 100.18
    assert result['marketable'] is False
    assert result['limitPrice'] <= 101


def test_entry_preflight_keeps_small_fractional_plan_limit_only():
    result = backend._build_entry_limit_preflight(
        _plan(shares=0.5, maxAllocationDollars=100),
        {'bid': 100.00, 'ask': 100.05, 'last': 100.02},
        buying_power=1_000,
        fractionable=True,
    )

    assert result['ok'] is True
    assert result['shares'] == 0.5
    assert result['orderClass'] == 'simple'
    assert result['protectionMode'] == 'exit_scan'


def test_entry_preflight_blocks_fractional_auto_order_without_attached_protection():
    result = backend._build_entry_limit_preflight(
        _plan(shares=0.5, maxAllocationDollars=100),
        {'bid': 100.00, 'ask': 100.05, 'last': 100.02},
        buying_power=1_000,
        fractionable=True,
        require_attached_protection=True,
    )

    assert result['ok'] is False
    assert result['code'] == 'fractional_protection_unavailable'


def test_entry_preflight_blocks_passive_limit_for_automatic_execution():
    result = backend._build_entry_limit_preflight(
        _plan(),
        {'bid': 99.50, 'ask': 100.50, 'last': 100.00},
        buying_power=100_000,
        require_marketable=True,
    )

    assert result['ok'] is False
    assert result['code'] == 'non_marketable_auto_limit'


def test_entry_preflight_rejects_levels_that_collapse_after_tick_rounding():
    result = backend._build_entry_limit_preflight(
        _plan(stopLoss=100.049, takeProfit1=100.059),
        {'bid': 100.00, 'ask': 100.05, 'last': 100.02},
        buying_power=1_000,
        fractionable=True,
    )

    assert result['ok'] is False
    assert result['code'] == 'invalid_risk_geometry'


def test_entry_price_precision_matches_alpaca_order_rules():
    assert backend._entry_round_price(290.123, 'down') == 290.12
    assert backend._entry_round_price(0.123456, 'down') == 0.1234
    assert backend._entry_round_price(0.123401, 'up') == 0.1235


def test_entry_quote_age_is_timezone_safe():
    now = datetime(2026, 7, 12, 14, 30, tzinfo=timezone.utc)
    timestamp = (now - timedelta(seconds=42)).isoformat()

    assert backend._entry_quote_age_seconds(timestamp, now=now) == 42


def test_watch_only_setup_is_never_auto_eligible():
    result = backend._evaluate_entry_setup_trigger(
        'Watch Only',
        100,
        99,
        101,
        latest_bar={'o': 99.5, 'c': 100.5, 'l': 99.4},
        previous_bar={'c': 100},
        bar_age_seconds=60,
    )

    assert result['eligible'] is False
    assert result['met'] is False
    assert result['status'] == 'NOT_ELIGIBLE'


def test_price_in_zone_alone_does_not_confirm_entry():
    result = backend._evaluate_entry_setup_trigger(
        'Breakout Entry',
        101,
        100,
        102,
        resistance=100.8,
        ema20=99,
    )

    assert result['met'] is False
    assert result['status'] == 'NEED_DATA'
    assert 'Completed 5m bar fresh' in result['missing']


def test_breakout_requires_completed_close_and_participation():
    result = backend._evaluate_entry_setup_trigger(
        'Breakout Entry',
        101.2,
        100.8,
        102,
        latest_bar={'o': 100.7, 'c': 101.3, 'l': 100.6},
        previous_bar={'c': 100.9},
        bar_age_seconds=120,
        resistance=101,
        ema20=99.5,
        intraday_volume_ratio=1.4,
    )

    assert result['eligible'] is True
    assert result['met'] is True
    assert result['status'] == 'CONFIRMED'


def test_pullback_confirmation_uses_reversal_trend_and_rsi_reset():
    result = backend._evaluate_entry_setup_trigger(
        'Pullback Entry',
        100.3,
        99,
        101,
        latest_bar={'o': 100.0, 'c': 100.5, 'l': 99.8},
        previous_bar={'c': 100.2},
        bar_age_seconds=90,
        ema20=101,
        ema50=98,
        rsi14=51,
        intraday_volume_ratio=1.1,
    )

    assert result['met'] is True
    assert result['status'] == 'CONFIRMED'


def test_structural_target_is_scored_without_being_inflated():
    result = backend._assess_entry_reward_geometry(
        entry=100,
        stop=95,
        target1=105,
        target2=112,
        min_rr=1.45,
    )

    assert result['riskPerShare'] == 5
    assert result['riskReward1'] == 1.0
    assert result['riskReward2'] == 2.4
    assert result['passesMinimum'] is False


def test_entry_execute_ai_buy_cannot_override_risk_gate(monkeypatch):
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'test-user'})
    monkeypatch.setattr(backend, 'send_discord_notification', lambda *args, **kwargs: {'sent': True})
    snapshot = _executable_snapshot(riskGate={'status': 'BLOCK', 'blockers': ['Portfolio risk limit']})

    response = backend.app.test_client().post('/api/entry-plan/execute', json={
        'symbol': 'AAPL',
        'planSnapshot': snapshot,
        'executionMode': 'paper',
        'isAutoExecute': True,
    })
    payload = response.get_json()

    assert payload['action'] == 'BLOCKED'
    assert payload['code'] == 'safety_gate'
    assert any('Risk Gate status is BLOCK' in blocker for blocker in payload['blockers'])


def test_live_auto_requires_explicit_backend_authorization(monkeypatch):
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'test-user'})
    monkeypatch.setattr(backend, '_pa_get_config', lambda uid: {'live_auto_trading_enabled': False})
    monkeypatch.setattr(backend, 'send_discord_notification', lambda *args, **kwargs: {'sent': True})

    response = backend.app.test_client().post('/api/entry-plan/execute', json={
        'symbol': 'AAPL',
        'planSnapshot': _executable_snapshot(),
        'executionMode': 'live',
        'isAutoExecute': True,
    })
    payload = response.get_json()

    assert payload['action'] == 'BLOCKED'
    assert payload['code'] == 'live_auto_not_enabled'


def test_entry_execute_rejects_options_before_broker_submission(monkeypatch):
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'test-user'})
    monkeypatch.setattr(backend, 'send_discord_notification', lambda *args, **kwargs: {'sent': True})
    snapshot = _executable_snapshot(
        instrumentType='option',
        optionsAllowed=False,
        strategyPolicy={
            'optionsAllowed': False,
            'allowedAssetClasses': ['us_equity'],
            'leverageEnabled': False,
            'dailyLossStopPct': 2.5,
        },
    )

    response = backend.app.test_client().post('/api/entry-plan/execute', json={
        'symbol': 'AAPL260717C00200000',
        'planSnapshot': snapshot,
        'executionMode': 'paper',
        'isAutoExecute': True,
    })
    payload = response.get_json()

    assert payload['action'] == 'BLOCKED'
    assert any('Options are prohibited' in blocker for blocker in payload['blockers'])
