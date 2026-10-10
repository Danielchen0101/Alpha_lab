"""Deterministic whole-share previews for the existing protected-entry route."""
import math
from copy import deepcopy
from datetime import timedelta

from equity_program import ETF_GROUPS
from equity_risk import portfolio_entry_budget
from equity_strategy import number, parse_time, entry_price_levels


def prepare_plans(protocol, policy, signals, quotes, account, positions, orders, managed, now):
    """Reserve each proposed entry before considering the next candidate.

    These previews convey no execution authority. The broker endpoint rechecks
    the frozen research, current signal, quote, ledger and shared account budget.
    """
    clock = parse_time(now)
    pending = deepcopy(orders)
    plans, rejected = [], []
    for signal in sorted(signals, key=lambda row: row.get('symbol', '')):
        symbol = signal.get('symbol')
        if not signal.get('eligible') or symbol not in protocol['symbols']:
            continue
        quote = quotes.get(symbol) or {}
        stamp = parse_time(quote.get('t'))
        bid, ask = number(quote.get('bp')), number(quote.get('ap'))
        atr = number(signal.get('atr14'))
        if (not clock or not stamp or not 0 <= (clock - stamp).total_seconds() <= 30 or
                not bid or not ask or bid <= 0 or ask < bid or not atr or atr <= 0):
            rejected.append({'symbol': symbol, 'reason': 'fresh_iex_quote_and_atr_required'})
            continue
        if (ask - bid) / ((ask + bid) / 2) * 10000 > policy['maxSpreadBps']:
            rejected.append({'symbol': symbol, 'reason': 'spread_too_wide'})
            continue
        group = ETF_GROUPS.get(symbol, 'unknown')
        candidate = {'symbol': symbol, 'sector': group, 'correlationGroup': group}
        budget = portfolio_entry_budget(account, positions, pending, managed, policy, candidate)
        try:
            levels = entry_price_levels(ask, atr, policy['maxSlippageBps'])
        except ValueError:
            rejected.append({'symbol': symbol, 'reason': 'invalid_protective_stop'})
            continue
        limit, risk, stop = levels['limitPrice'], levels['initialRiskPerShare'], levels['stopPrice']
        qty = math.floor(min(budget['maxAdditionalNotional'] / limit, budget['maxAdditionalRisk'] / risk)) if budget['ok'] else 0
        if qty < 1 or limit <= risk:
            rejected.append({'symbol': symbol, 'reason': 'whole_share_budget_unavailable', 'riskBudget': budget})
            continue
        plan = {**candidate, 'strategy': protocol['strategy'], 'strategyVersion': protocol['strategyVersion'],
                'protocolKey': protocol['protocolKey'], 'protocolHash': protocol['protocolHash'],
                'strategyPolicy': policy, 'equitySwingV1': True, 'entryAtr14': atr,
                'dataVersion': protocol['dataVersion'], 'finalAction': 'BUY_READY', 'entryIntent': 'NEW_ENTRY',
                'riskGate': {'status': 'PASS'}, 'dataQuality': 'GOOD', 'tradeReadiness': 'READY',
                'setupAutoEligible': True, 'entryTriggerMet': True, 'entryTriggerStatus': 'CONFIRMED',
                'triggerEvaluatedAt': clock.isoformat(), 'admissionDecision': 'ADMIT',
                'admissionSnapshot': {'id': protocol['protocolKey'], 'inputFingerprint': protocol['protocolHash'],
                                      'strategy': protocol['strategy'], 'expiresAt': (clock + timedelta(minutes=3)).isoformat()},
                'currentPrice': ask, 'entryZoneLow': bid, 'entryZoneHigh': limit,
                'stopLoss': stop, 'entryRiskPerShare': risk,
                # Required by the legacy preview contract; v1 exits do not use
                # this reference target and submit no profit-taking order leg.
                'takeProfit1': round(limit + 2 * risk, 2), 'targetIsReferenceOnly': True,
                'partialExitsAllowed': False, 'shares': qty, 'positionSizeShares': qty,
                'riskBudget': budget['maxAdditionalRisk'], 'maxAllocationDollars': budget['maxAdditionalNotional'],
                'buyingPowerBufferPct': 0, 'slippageCapBps': policy['maxSlippageBps'],
                'timeInForce': 'gtc', 'entryValidity': 'execution_session',
                'orderPreview': {'orderType': 'limit', 'limitPrice': limit, 'timeInForce': 'gtc'}}
        plans.append(plan)
        managed = {**managed, symbol: candidate}
        pending.append({'symbol': symbol, 'side': 'buy', 'qty': qty, 'filled_qty': 0, 'status': 'new',
                        'type': 'limit', 'limit_price': limit, 'order_class': 'oto', 'stop_loss': {'stop_price': stop}})
    return plans, rejected
