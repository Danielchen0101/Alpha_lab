"""Bound GTC parent entry lifetime while retaining overnight native stops.

Only authenticated receipts/intents can authorize cancellation. A cancel HTTP
response is never terminal evidence: the broker is fetched again. This module
does not place orders, infer missing fills, or clear a late-fill quarantine.
"""
from datetime import datetime, timezone
import time

from equity_data import content_hash
from equity_evidence_store import EquityEvidenceStore
from equity_program import STRATEGY_VERSION
from equity_risk import DurableEntryReservations, number, timestamp
from equity_runtime import ORDER_ATTRIBUTION_ARTIFACT, read_order_attribution, record_v1_order
from operations_store import OperationsVersionConflict


def _save_outcome(store, uid, account_id, mode, order_id, outcome):
    for _ in range(3):
        row, payload = read_order_attribution(store, uid, account_id, mode)
        if order_id not in payload['orders']:
            raise ValueError('entry_receipt_missing')
        current = payload['orders'][order_id]
        # An earlier verified late fill can never be cleared by a later
        # canceled snapshot, truncated quantities, or a worker race.
        if current.get('entryQuarantineReason'):
            outcome = {**outcome, 'entryQuarantineReason': current['entryQuarantineReason']}
        payload['orders'][order_id] = {**current, **outcome}
        if row['payload'] == payload:
            return
        try:
            store.put_artifact(uid, ORDER_ATTRIBUTION_ARTIFACT,
                EquityEvidenceStore.artifact_key(account_id, mode), payload=payload,
                idempotency_key='equity-expiry:' + content_hash(payload), expected_version=row['version'])
            return
        except OperationsVersionConflict:
            continue
    raise OperationsVersionConflict('Entry expiry changed concurrently')


def reconcile_entry_expiry(store, user_id, account_id, mode, get_order, find_by_client_id,
                           cancel_order, *, now=None):
    """Injected broker operations return actual order dicts or raise.

    The caller serializes account mutations. Failed/unknown cancellation keeps
    the reservation and blocks new entries. Known late fills remain held behind
    their broker GTC protection and require explicit strategy reconciliation.
    """
    clock = timestamp(now or datetime.now(timezone.utc).isoformat())
    if not clock:
        raise ValueError('entry_expiry_clock_invalid')
    blockers, quarantined, canceled = [], [], []
    deadline = time.monotonic() + 20
    attempts = 0
    reservations = DurableEntryReservations(store, user_id, account_id, 'paper' if mode == 'paper' else 'live')
    intents = reservations.read()
    for client_id, intent in intents.items():
        if intent.get('strategyVersion') != STRATEGY_VERSION:
            continue
        expires = timestamp(intent.get('entryExpiresAt'))
        if expires and clock < expires:
            continue
        if attempts >= 12 or time.monotonic() >= deadline:
            blockers.append('entry_expiry_budget_exhausted')
            break
        attempts += 1
        try:
            order = find_by_client_id(client_id)
            if not isinstance(order, dict) or not order.get('id'):
                raise ValueError('pending_entry_not_visible')
            if not record_v1_order(store, user_id, account_id, mode, order):
                raise ValueError('pending_entry_receipt_unverified')
        except Exception:
            blockers.append('expired_entry_submission_unresolved:' + client_id)
    _, payload = read_order_attribution(store, user_id, account_id, mode)
    for order_id, receipt in payload['orders'].items():
        if receipt.get('side') != 'buy' or receipt.get('strategyVersion') != STRATEGY_VERSION:
            continue
        if receipt.get('entryQuarantineReason'):
            blockers.append(receipt['entryQuarantineReason'] + ':' + order_id)
            quarantined.append(order_id)
        if receipt.get('entryReconciledTerminal'):
            continue
        expires = timestamp(receipt.get('entryExpiresAt'))
        if expires and clock < expires:
            continue
        if attempts >= 12 or time.monotonic() >= deadline:
            blockers.append('entry_expiry_budget_exhausted')
            break
        attempts += 1
        try:
            order = get_order(order_id)
            if not isinstance(order, dict) or str(order.get('id')) != order_id or str(order.get('symbol') or '').upper() != receipt['symbol'] or order.get('side') != 'buy':
                raise ValueError('entry_identity_unverified')
            status = str(order.get('status') or '').lower()
            terminal = {'filled', 'canceled', 'cancelled', 'expired', 'rejected'}
            if status not in terminal:
                cancel_order(order_id)
                order = get_order(order_id)
                if not isinstance(order, dict) or str(order.get('id')) != order_id:
                    raise ValueError('cancel_reconciliation_missing')
                status = str(order.get('status') or '').lower()
                if status not in terminal:
                    raise ValueError('cancel_not_terminal')
                canceled.append(order_id)
            filled = number(order.get('filled_qty'))
            if filled is None or filled < 0:
                raise ValueError('filled_quantity_unknown')
            filled_at = timestamp(order.get('filled_at'))
            reason = None
            if not expires:
                reason = 'entry_expiry_unknown'
            elif filled > 0 and status in {'canceled', 'cancelled', 'expired', 'rejected'}:
                reason = 'entry_partial_fill_requires_protection'
            elif filled > 0 and not filled_at:
                reason = 'entry_fill_timing_unverified'
            elif filled > 0 and filled_at > expires:
                reason = 'entry_filled_after_expiry'
            outcome = {'entryReconciledTerminal': True, 'entryTerminalStatus': status,
                       'entryTerminalFilledQty': filled, 'entryTerminalObservedAt': clock.isoformat()}
            if reason:
                outcome['entryQuarantineReason'] = reason
                blockers.append(reason + ':' + order_id)
                quarantined.append(order_id)
            _save_outcome(store, user_id, account_id, mode, order_id, outcome)
            client_id = receipt.get('clientOrderId') or order.get('client_order_id')
            if client_id and client_id in intents:
                reservations.release(client_id)
        except Exception:
            blockers.append('expired_entry_cancellation_unresolved:' + order_id)
    return {'ok': not blockers, 'blockers': list(dict.fromkeys(blockers)),
            'quarantinedOrderIds': sorted(set(quarantined)), 'canceledOrderIds': canceled}
