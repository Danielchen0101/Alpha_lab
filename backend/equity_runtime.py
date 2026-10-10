"""Credential-injected, user-scoped stock evidence integration.

This module only performs GETs through injected clients. Research and shadow
artifacts cannot authorize a broker order or change a broker account balance.
"""
from datetime import datetime, timezone
from copy import deepcopy
from decimal import Decimal

from equity_evidence_store import EquityEvidenceStore, fetch_broker_activities
from equity_program import PROGRAM, STRATEGY_VERSION, equity_policy
from equity_data import content_hash
from equity_ledger import scope_identity
from operations_store import OperationsVersionConflict

ORDER_ATTRIBUTION_ARTIFACT = 'equity_order_attribution'


def read_order_attribution(store, user_id, account_id, mode):
    identity = scope_identity(account_id, mode)
    key = EquityEvidenceStore.artifact_key(account_id, mode)
    row = store.get_artifact(user_id, ORDER_ATTRIBUTION_ARTIFACT, key)
    payload = deepcopy((row or {}).get('payload') or {})
    if payload and (payload.get('scope') != identity or payload.get('schemaVersion') != 1):
        raise ValueError('order_attribution_scope_mismatch')
    if payload and (not isinstance(payload.get('orders'), dict) or not isinstance(payload.get('incrementalCostBudgets'), dict)):
        raise ValueError('order_attribution_shape_invalid')
    return row, payload or {'schemaVersion': 1, 'scope': identity, 'orders': {}, 'incrementalCostBudgets': {}}


def record_v1_order(store, user_id, account_id, mode, order, *, protocol_key=None,
                    entry_order_id=None, validated_entry=False, recorded_at=None, entry_expires_at=None, initial_stop_price=None):
    """Bind an actual broker receipt to validated server execution evidence.

    Production callers supply an authenticated store. Only a just-submitted,
    server-validated BUY can create new ownership. Recovery requires an existing
    receipt or its authenticated pre-POST reservation. Managed config fields and
    client-ID prefixes alone never establish ownership.
    """
    from equity_risk import DurableEntryReservations
    if not isinstance(order, dict) or not order.get('id') or not order.get('symbol'):
        return False
    order_id = str(order['id'])
    side, symbol = str(order.get('side') or '').lower(), str(order['symbol']).upper()
    if side not in ('buy', 'sell'):
        return False
    now = recorded_at or datetime.now(timezone.utc).isoformat()
    for _ in range(3):
        row, payload = read_order_attribution(store, user_id, account_id, mode)
        existing = payload['orders'].get(order_id)
        parent_id = str(entry_order_id or order.get('_parent_order_id') or '')
        parent = payload['orders'].get(parent_id)
        if existing:
            if existing.get('symbol') != symbol or existing.get('side') != side:
                raise ValueError('broker_order_identity_changed')
            protocol_key = existing['protocolKey']
            parent_id = existing.get('entryOrderId') or order_id
        elif side == 'buy':
            if not validated_entry:
                reservation_mode = 'paper' if mode == 'paper' else 'live'
                intents = DurableEntryReservations(store, user_id, account_id, reservation_mode).read()
                intent = intents.get(str(order.get('client_order_id') or '')) or {}
                if intent.get('strategyVersion') != STRATEGY_VERSION or intent.get('symbol') != symbol:
                    return False
                protocol_key = intent.get('protocolKey')
                entry_expires_at = intent.get('entryExpiresAt')
                initial_stop_price = intent.get('stopPrice')
            if not protocol_key:
                return False
            parent_id = order_id
        elif not parent or parent.get('side') != 'buy' or parent.get('symbol') != symbol:
            return False
        else:
            protocol_key = parent['protocolKey']
        payload['orders'][order_id] = {
            **(existing or {}),
            'strategyVersion': STRATEGY_VERSION, 'protocolKey': protocol_key,
            'symbol': symbol, 'side': side, 'entryOrderId': parent_id,
            'firstRecordedAt': (existing or {}).get('firstRecordedAt') or now,
        }
        if side == 'buy':
            if not existing and initial_stop_price:
                from equity_risk import number
                if not number(initial_stop_price) or number(initial_stop_price) <= 0:
                    raise ValueError('entry_stop_invalid')
                payload['orders'][order_id]['originalStopPrice'] = float(initial_stop_price)
            if not existing and entry_expires_at:
                from equity_risk import timestamp
                expires = timestamp(entry_expires_at)
                if not expires:
                    raise ValueError('entry_expiry_invalid')
                payload['orders'][order_id]['entryExpiresAt'] = expires.isoformat()
            payload['orders'][order_id]['clientOrderId'] = order.get('client_order_id') or (existing or {}).get('clientOrderId')
            for leg in order.get('legs') or []:
                if not isinstance(leg, dict) or not leg.get('id') or str(leg.get('side') or '').lower() != 'sell' or str(leg.get('symbol') or symbol).upper() != symbol:
                    continue
                leg_id = str(leg['id'])
                old_leg = payload['orders'].get(leg_id) or {}
                if old_leg and (old_leg.get('symbol') != symbol or old_leg.get('side') != 'sell' or old_leg.get('entryOrderId') != order_id):
                    raise ValueError('broker_order_parent_changed')
                payload['orders'][leg_id] = {**old_leg, 'strategyVersion': STRATEGY_VERSION, 'protocolKey': protocol_key,
                    'symbol': symbol, 'side': 'sell', 'entryOrderId': order_id,
                    'firstRecordedAt': old_leg.get('firstRecordedAt') or now}
        payload['incrementalCostBudgets'].setdefault(str(protocol_key), {
            'strategyVersion': STRATEGY_VERSION, 'scope': 'incremental_v1_ai_and_data_only',
            'currency': 'USD', 'amount': 0.0, 'validFrom': now,
            'basis': 'No paid AI calls or new data subscription used by fixed v1',
            'historicalCostsKnown': False, 'totalExternalOperatingCostsKnown': False,
        })
        version = int((row or {}).get('version') or 0)
        if row and row.get('payload') == payload:
            return True
        try:
            store.put_artifact(user_id, ORDER_ATTRIBUTION_ARTIFACT,
                               EquityEvidenceStore.artifact_key(account_id, mode), payload=payload,
                               idempotency_key='equity-orders:' + content_hash(payload), expected_version=version)
            return True
        except OperationsVersionConflict:
            continue
    raise OperationsVersionConflict('Order attribution changed concurrently')


def account_evidence(store, user_id, mode, account, get_activities, *, now=None,
                     equity_history=None, daily_baseline_as_of=None):
    now = now or datetime.now(timezone.utc).isoformat()
    if not account.get("id"):
        return {"risk": {"entry_allowed": False, "complete": False,
                         "reasons": ["broker_account_identity_missing"]}}
    # Broker activities are the posted cash ledger. Paper costs remain unknown:
    # paper trading deliberately omits some real-world execution expenses.
    fetched = fetch_broker_activities(get_activities, as_of=now,
                                      costs_complete=mode in ("real", "live"))
    if daily_baseline_as_of:
        fetched['coverage']['daily_baseline_as_of'] = daily_baseline_as_of
    _, ownership = read_order_attribution(store, user_id, account['id'], mode)
    attribution = {order_id: row['strategyVersion'] for order_id, row in ownership['orders'].items()
                   if row.get('strategyVersion') == STRATEGY_VERSION}
    state = EquityEvidenceStore(store).reconcile(
        user_id, account_id=account["id"], mode="paper" if mode == "paper" else "live",
        strategy_version=STRATEGY_VERSION,
        snapshot={"as_of": now, "equity": account.get("equity"), "cash": account.get("cash")},
        activities=fetched["activities"], coverage=fetched["coverage"],
        equity_history=equity_history,
        order_attribution=attribution,
        drawdown_limit_pct=12.0,
    )
    rows = (state.get('activities') or {}).values()
    owned_fills = [row for row in rows if row['type'] == 'FILL' and attribution.get(row.get('order_id')) == STRATEGY_VERSION]
    fee_cashflow = sum((Decimal(row['amount']) for row in (state.get('activities') or {}).values()
                       if row['type'] in ('FEE', 'CFEE') and attribution.get(row.get('order_id')) == STRATEGY_VERSION), Decimal('0'))
    current_accounting = bool(state.get('accounting_as_of')) and datetime.fromisoformat(state['accounting_as_of'].replace('Z', '+00:00')) == datetime.fromisoformat(now.replace('Z', '+00:00'))
    state['strategyExecutionEvidence'] = {
        'strategyVersion': STRATEGY_VERSION, 'authenticatedOrderCount': len(attribution),
        'attributedFillCount': len(owned_fills),
        'attributedFeeCashflow': float(fee_cashflow) if fetched['coverage']['complete'] and fetched['coverage']['costs_complete'] and current_accounting else None,
        'attributionComplete': (state.get('accounting') or {}).get('strategy_attribution_known') is True,
        'incrementalCostBudgets': deepcopy(ownership['incrementalCostBudgets']),
        # Zero incremental AI/data expense does not establish total operating
        # costs, legacy ownership, or marks for an open strategy inventory.
        'totalExternalOperatingCostsKnown': False,
    }
    return state


def empty_program_status():
    return {"strategyProgram": PROGRAM, "strategyVersion": STRATEGY_VERSION,
            "dataVersion": None, "policy": equity_policy(),
            "businessStatus": "research_blocked", "blockers": ["protocol_not_frozen"],
            "researchAdmission": {"eligible": False, "status": "insufficient_evidence"},
            "forward": {"tradingSessions": 0, "completedTrades": 0,
                        "requiredSessions": 60, "requiredTrades": 30},
            "ai": {"required": False, "status": "not_requested", "incrementalCost": 0},
            "executionMode": "shadow", "brokerOrdersAllowed": False}
