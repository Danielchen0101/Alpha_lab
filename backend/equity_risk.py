"""Pure, broker-snapshot equity entry limits.

Money is never inferred from margin buying power.  Callers serialize the fresh
account snapshot and submission, and pass the complete open-order snapshot.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import json
import math
import os
import tempfile
import hashlib


def number(value, default=None):
    try:
        result = float(value)
    except (ValueError, TypeError):
        return default
    return result if math.isfinite(result) else default


def cash_funded_buying_power(account, pending_notional=0.0, fee_reserve=0.0):
    """Available positive cash, limited by broker eligibility and reservations.

    ``non_marginable_buying_power`` is not cash: margin accounts can report a
    positive value alongside a negative cash balance.  It can only tighten the
    cash ceiling, never increase it. Broker buying power already reserves open
    orders; subtract their remaining notional from cash, not from buying power.
    """
    cash = max(0.0, number(account.get('cash'), 0.0))
    buying_power = max(0.0, number(account.get('buying_power'), 0.0))
    limits = [max(0.0, cash - pending_notional - fee_reserve), buying_power]
    non_marginable = number(account.get('non_marginable_buying_power'))
    if non_marginable is not None:
        limits.append(max(0.0, non_marginable))
    return max(0.0, min(limits))


def _flatten_orders(orders):
    """Retain OTO parent identity while deduplicating nested order snapshots."""
    result = []
    seen = set()

    def visit(order, parent=None):
        if not isinstance(order, dict):
            return
        identity = order.get('id') or order.get('client_order_id')
        if identity and identity in seen:
            return
        if identity:
            seen.add(identity)
        row = dict(order)
        row['_parent'] = parent
        result.append(row)
        for leg in order.get('legs') or []:
            visit(leg, row)

    for order in orders or []:
        visit(order)
    return result


def _remaining(order):
    qty = number(order.get('qty'))
    filled = number(order.get('filled_qty'), 0.0)
    return max(0.0, qty - filled) if qty is not None else None


def _active(order):
    return str(order.get('status') or '').lower() not in {
        'filled', 'canceled', 'cancelled', 'expired', 'rejected', 'replaced',
    }


def _group(row, fallback='unknown'):
    return str(row.get('correlationGroup') or row.get('sector') or fallback).strip().lower()


def portfolio_entry_budget(account, positions, open_orders, managed_positions, policy, candidate):
    """Return conservative remaining budgets and assess a proposed entry.

    For the swing policy, every existing long and pending buy needs verifiable
    downside protection. Unknown exposure, missing prices, and incomplete order
    lists fail closed. Existing policies keep their configured percentages.
    """
    account = account or {}
    candidate = candidate or {}
    managed_positions = managed_positions or {}
    equity = number(account.get('equity'), 0.0)
    strict = policy.get('equitySwingV1') is True
    def verified_metadata(row_symbol, submitted):
        if not strict:
            return submitted
        from equity_program import ETF_GROUPS
        group = ETF_GROUPS.get(row_symbol, 'unknown')
        return {**submitted, 'sector': group, 'correlationGroup': group}
    blockers = []
    if equity <= 0:
        blockers.append('Account equity is unavailable')
    if not isinstance(positions, list) or not isinstance(open_orders, list):
        blockers.append('Complete broker position and order snapshots are required')
        positions, open_orders = [], []
    # The caller requests at most 500 open orders. A full page is ambiguous.
    if len(open_orders) >= 500:
        blockers.append('Open order snapshot may be truncated')
    symbol = str(candidate.get('symbol') or '').upper()
    candidate = verified_metadata(symbol, candidate)
    candidate_group = _group(candidate)
    candidate_sector = str(candidate.get('sector') or 'unknown').lower()
    correlated_symbols = {str(item).upper() for item in candidate.get('correlatedSymbols') or []}
    orders = _flatten_orders(open_orders)
    open_buys = [row for row in orders if str(row.get('side')).lower() == 'buy' and _active(row)]
    pending_notional = 0.0
    gross = 0.0
    name_exposure = 0.0
    sector_exposure = 0.0
    correlated_exposure = 0.0
    stop_risk = 0.0
    existing_symbols = set()
    pending_symbols = set()

    def add_exposure(row_symbol, notional, metadata):
        nonlocal name_exposure, sector_exposure, correlated_exposure
        if row_symbol == symbol:
            name_exposure += notional
        if str(metadata.get('sector') or 'unknown').lower() == candidate_sector:
            sector_exposure += notional
        # An unknown group cannot be treated as proven diversification.
        group = _group(metadata)
        if group == candidate_group or group == 'unknown' or candidate_group == 'unknown' or row_symbol in correlated_symbols:
            correlated_exposure += notional

    for position in positions:
        row_symbol = str(position.get('symbol') or '').upper()
        qty = number(position.get('qty'))
        price = number(position.get('current_price'))
        notional = number(position.get('market_value'))
        metadata = verified_metadata(row_symbol, managed_positions.get(row_symbol) or position)
        if qty is None or not row_symbol or notional is None:
            blockers.append('Position exposure cannot be verified')
            continue
        if not qty:
            continue
        existing_symbols.add(row_symbol)
        gross += abs(notional)
        add_exposure(row_symbol, abs(notional), metadata)
        if strict and (qty < 0 or str(position.get('side') or 'long').lower() != 'long'):
            blockers.append('%s is outside the long-only portfolio policy' % row_symbol)
        if strict and metadata.get('corporateActionReviewRequired'):
            blockers.append('%s corporate action requires reconciliation' % row_symbol)
        if strict and metadata.get('stopRatchetReviewRequired'):
            blockers.append('%s broker stop ratchet requires reconciliation' % row_symbol)
        if not strict and policy.get('maxOpenStopRiskPct') is None:
            continue
        price = price or (abs(notional / qty) if qty else None)
        stops = []
        for order in orders:
            if str(order.get('symbol') or '').upper() != row_symbol or str(order.get('side')).lower() != 'sell' or not _active(order):
                continue
            # Held OTO legs do not yet protect an existing broker position.
            if str(order.get('status') or '').lower() not in {'new', 'accepted', 'partially_filled'}:
                continue
            if str(order.get('type') or '').lower() != 'stop':
                continue
            if strict and str(order.get('time_in_force') or '').lower() != 'gtc':
                continue
            remaining = _remaining(order)
            stop = number(order.get('stop_price'))
            if remaining is not None and remaining > 0 and stop is not None and stop > 0:
                stops.append((stop, remaining))
        covered = 0.0
        # Count the least protective verified stops first; never assume fills
        # beyond the held quantity or count an OCO target as stop protection.
        for stop, stop_qty in sorted(stops):
            used_qty = min(stop_qty, max(0.0, abs(qty) - covered))
            stop_risk += used_qty * max(0.0, (price or 0) - stop)
            covered += used_qty
        if covered + 1e-6 < abs(qty):
            blockers.append('%s has unverified or incomplete stop protection' % row_symbol)

    for order in open_buys:
        row_symbol = str(order.get('symbol') or '').upper()
        remaining = _remaining(order)
        price = number(order.get('limit_price'))
        # Only a bounded limit/stop-limit proves the maximum reserved exposure.
        if remaining is None or price is None or price <= 0 or not row_symbol:
            blockers.append('Pending buy exposure cannot be bounded')
            continue
        notional = remaining * price
        if remaining <= 0:
            continue
        pending_symbols.add(row_symbol)
        pending_notional += notional
        gross += notional
        metadata = verified_metadata(row_symbol, managed_positions.get(row_symbol) or {})
        add_exposure(row_symbol, notional, metadata)
        if strict or policy.get('maxOpenStopRiskPct') is not None:
            stop = number((order.get('stop_loss') or {}).get('stop_price'))
            for leg in order.get('legs') or []:
                if str(leg.get('side')).lower() == 'sell' and str(leg.get('type')).lower() == 'stop' and _active(leg):
                    stop = number(leg.get('stop_price'), stop)
            if not stop or stop >= price or str(order.get('order_class') or '').lower() not in {'oto', 'bracket'}:
                blockers.append('%s pending buy has unverified attached stop' % row_symbol)
            else:
                stop_risk += remaining * (price - stop)

    fee_bps = max(0.0, number(policy.get('executionFeeReserveBps'), 10.0))
    # The final account mark can observe a fill after the position snapshot.
    # It may tighten gross exposure, never erase a pending order reservation.
    broker_long = number(account.get('long_market_value'))
    broker_short = number(account.get('short_market_value'))
    if broker_long is not None or broker_short is not None:
        marked_holdings = abs(broker_long or 0.0) + abs(broker_short or 0.0)
        observed_holdings = gross - pending_notional
        gross = max(gross, marked_holdings + pending_notional)
        # Material unexplained holdings may be an asynchronous fill. Refresh
        # the full position/stop snapshot on the next attempt before entering.
        if strict and marked_holdings - observed_holdings > max(1.0, observed_holdings * 0.005):
            blockers.append('Broker account and position exposure require reconciliation')
    fixed_cash_reserve = max(0.0, number(policy.get('cashReserveDollars'), 0.0))
    fee_reserve = fixed_cash_reserve + pending_notional * fee_bps / 10000.0
    cash_available = cash_funded_buying_power(account, pending_notional, fee_reserve)
    if not strict and policy.get('leverageEnabled') is True and candidate.get('allowMargin') is True:
        cash_available = max(0.0, number(account.get('buying_power'), 0.0) - fee_reserve)
    limits = {
        'cash': cash_available / (1.0 + fee_bps / 10000.0),
        'gross': max(0.0, equity * number(policy.get('maxGrossExposurePct'), 100.0) / 100.0 - gross),
        'singlePosition': max(0.0, equity * number(policy.get('maxSinglePositionPct'), 15.0) / 100.0 - name_exposure),
        'sector': max(0.0, equity * number(policy.get('sectorCapPct'), 40.0) / 100.0 - sector_exposure),
    }
    correlation_cap = number(policy.get('maxCorrelatedExposurePct'))
    if correlation_cap is not None:
        limits['correlated'] = max(0.0, equity * correlation_cap / 100.0 - correlated_exposure)
    max_additional = min(limits.values())
    max_risk = equity * number(policy.get('riskPerTradePct'), 1.0) / 100.0
    open_risk_cap = number(policy.get('maxOpenStopRiskPct'))
    if open_risk_cap is not None:
        max_risk = min(max_risk, max(0.0, equity * open_risk_cap / 100.0 - stop_risk))
    portfolio_symbols = existing_symbols | pending_symbols
    max_positions = int(number(policy.get('maxPositions'), number(policy.get('maxPortfolioPositions'), 10)))
    if symbol not in portfolio_symbols and len(portfolio_symbols) >= max_positions:
        blockers.append('Portfolio position capacity is exhausted including pending buys')
    if symbol in pending_symbols:
        blockers.append('Open buy order already reserves this symbol')
    if strict and symbol in existing_symbols:
        blockers.append('Swing v1 does not permit scale-ins')
    proposed = max(0.0, number(candidate.get('notional'), 0.0))
    proposed_risk = max(0.0, number(candidate.get('riskDollars'), 0.0))
    for name, remaining in limits.items():
        if proposed > remaining + 0.005:
            blockers.append('%s portfolio budget would be exceeded' % name)
    if proposed_risk > max_risk + 0.005:
        blockers.append('Portfolio stop-risk budget would be exceeded')
    return {
        'ok': not blockers,
        'blockers': list(dict.fromkeys(blockers)),
        'cashAvailable': round(cash_available, 6),
        'maxAdditionalNotional': max(0.0, max_additional),
        'maxAdditionalRisk': max(0.0, max_risk),
        'remainingLimits': limits,
        'grossExposure': round(gross, 6),
        'pendingBuyNotional': round(pending_notional, 6),
        'openStopRisk': round(stop_risk, 6),
        'correlatedExposure': round(correlated_exposure, 6),
        'positionCountIncludingOrders': len(portfolio_symbols),
        'feeReserveBps': fee_bps,
    }


def timestamp(value):
    try:
        result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def entry_fill_anchor_updates(record, order):
    """Anchor geometry to authenticated entry fills; ignore older partials."""
    if str(order.get('side') or '').lower() != 'buy':
        return {}
    if str(order.get('id') or '') != str(record.get('entryOrderId') or ''):
        return {}
    qty = number(order.get('filled_qty'), 0.0)
    price = number(order.get('filled_avg_price'), 0.0)
    previous_qty = number(record.get('entryFilledQty'), 0.0)
    if qty <= 0 or price <= 0 or qty + 1e-6 < previous_qty:
        return {}
    fill_at = record.get('filledAt') or order.get('filled_at') or order.get('updated_at')
    parsed = timestamp(fill_at)
    if not parsed:
        return {}
    updates = {
        'filledAt': parsed.isoformat(), 'entryTimestamp': parsed.isoformat(),
        'entrySession': parsed.astimezone(ZoneInfo('America/New_York')).date().isoformat(),
        'entryFilledQty': qty, 'entryReferencePrice': price,
        'entryFillPrice': price, 'fillAnchorVerified': True,
        'highWaterMark': max(price, number(record.get('highWaterMark'), price)) if previous_qty > 0 else price,
    }
    if record.get('equitySwingV1') is True:
        expiry = timestamp(record.get('entryExpiresAt'))
        if expiry and parsed > expiry:
            updates['entryValidityReviewRequired'] = True
            updates['entryValidityReviewReason'] = 'entry_filled_after_expiry'
        # The broker's submitted OTO stop is fixed. A price improvement reduces
        # actual initial risk; it does not move that stop below its real level.
        initial_stop = number(record.get('originalAttachedStop') or record.get('initialStop'))
        if not initial_stop or price <= initial_stop:
            updates['entryGeometryReviewRequired'] = True
            return updates
        updates.update({
            'initialRiskPerShare': price - initial_stop, 'initialStop': initial_stop,
            'originalAttachedStop': initial_stop,
            'currentStop': max(initial_stop, number(record.get('currentStop'), initial_stop)),
        })
    else:
        stop = number(record.get('initialStop') or record.get('stopLoss'))
        if stop and price > stop:
            updates['initialRiskPerShare'] = price - stop
    return updates


def position_anchor_review(position, record):
    """Do not infer a split ratio or reinterpret stale protection geometry."""
    if record.get('entryGeometryReviewRequired'):
        return 'Actual entry fill is not above the original attached stop; reconcile broker protection before changing it'
    if record.get('entryValidityReviewRequired'):
        return 'Entry validity requires reconciliation: %s' % (record.get('entryValidityReviewReason') or 'late or unverified fill')
    if record.get('corporateActionReviewRequired'):
        return 'Corporate action or position basis requires explicit reconciliation'
    anchor = number(record.get('entryFillPrice'))
    basis = number(position.get('avg_entry_price'))
    # Legacy scale-ins change the blended basis legitimately. Their individual
    # latest fill is not a verified whole-position cost anchor.
    blended_basis_unverified = str(record.get('entryIntent') or '').upper() == 'SCALE_IN' or number(record.get('scaleInCount'), 0) > 0
    if anchor and basis and not blended_basis_unverified and abs(basis / anchor - 1.0) > 0.02:
        return 'Broker position basis differs from the verified fill anchor; reconcile corporate actions before changing protection'
    qty = number(position.get('qty'), 0.0)
    filled = number(record.get('entryFilledQty'), 0.0)
    if record.get('equitySwingV1') and record.get('fillAnchorVerified') and qty > filled + 1e-6:
        return 'Broker quantity exceeds verified entry fills; reconcile the position before changing protection'
    return None


def protection_reconciliation_blockers(position, orders, snapshot_complete=True):
    """Do not mutate protection while an entry/stop lifecycle is unresolved."""
    if not snapshot_complete:
        return ['Complete broker order state is required before changing protection']
    symbol = str(position.get('symbol') or '').upper()
    blockers = []
    for order in _flatten_orders(orders):
        if str(order.get('symbol') or '').upper() != symbol or not _active(order):
            continue
        side = str(order.get('side') or '').lower()
        if side == 'buy' and (_remaining(order) is None or _remaining(order) > 0):
            blockers.append('Entry is still pending or partially filled; reconcile the parent and attached stop before changing protection')
        if side == 'sell' and str(order.get('type') or '').lower() in {'stop', 'stop_limit', 'trailing_stop'}:
            if str(order.get('status') or '').lower() not in {'new', 'accepted', 'partially_filled'}:
                blockers.append('Broker stop activation or cancellation is unresolved')
    return list(dict.fromkeys(blockers))


def completed_sessions_since(fill_at, bars, now=None):
    """Count observed completed exchange sessions, never calendar days."""
    from equity_strategy import normalize_daily_bars
    opened = timestamp(fill_at)
    if not opened:
        return None
    rows, errors = normalize_daily_bars(bars, now)
    if errors or not rows:
        return None
    return sum(timestamp(row['availableAt']) > opened for row in rows)


class PendingEntryReservations:
    """Crash-safe pending intents, accessed only while the account lock is held.

    A missing broker order never erases an intent: a timed-out POST may still
    have succeeded. The caller removes an intent only after a positive broker
    reconciliation, and re-fetches its account snapshot after that evidence.
    """

    def __init__(self, path):
        self.path = os.fspath(path)

    def read(self):
        try:
            with open(self.path, encoding='utf-8') as handle:
                payload = json.load(handle)
        except FileNotFoundError:
            return {}
        if not isinstance(payload, dict) or payload.get('version') != 1 or not isinstance(payload.get('intents'), dict):
            raise ValueError('Invalid equity entry reservation state')
        return payload['intents']

    def _write(self, intents):
        directory = os.path.dirname(os.path.abspath(self.path))
        os.makedirs(directory, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix='.equity-intent-', dir=directory)
        try:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
                json.dump({'version': 1, 'intents': intents}, handle, sort_keys=True)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def reserve(self, client_order_id, intent):
        if not client_order_id:
            raise ValueError('Client order identity is required')
        intents = self.read()
        if client_order_id in intents and intents[client_order_id] != intent:
            raise ValueError('Client order identity already reserves a different intent')
        intents[client_order_id] = dict(intent)
        self._write(intents)

    def release(self, client_order_id):
        intents = self.read()
        if client_order_id in intents:
            del intents[client_order_id]
            self._write(intents)


class DurableEntryReservations:
    """Account/mode scoped OperationsStore intents with optimistic locking.

    The read version binds the later reservation to the snapshot being sized.
    Another worker's change invalidates that snapshot before either new POST.
    No implicit local fallback is introduced: the injected store owns that
    explicitly configured development-only choice.
    """
    artifact_type = 'equity_entry_reservations'

    def __init__(self, store, user_id, account_id, mode):
        if not store or not user_id or not account_id:
            raise ValueError('Durable account reservation identity is required')
        self.store, self.user_id = store, user_id
        self.scope = hashlib.sha256((str(account_id) + ':' + str(mode)).encode()).hexdigest()
        self.version = None

    def _row(self):
        row = self.store.get_artifact(self.user_id, self.artifact_type, self.scope)
        payload = (row or {}).get('payload') or {'schemaVersion': 1, 'scope': self.scope, 'intents': {}}
        if payload.get('schemaVersion') != 1 or payload.get('scope') != self.scope or not isinstance(payload.get('intents'), dict):
            raise ValueError('Invalid durable entry reservation state')
        return row, payload

    def read(self):
        row, payload = self._row()
        self.version = int((row or {}).get('version') or 0)
        return {key: dict(value) for key, value in payload['intents'].items()}

    def _save(self, payload, expected_version):
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, allow_nan=False).encode()).hexdigest()
        row = self.store.put_artifact(
            self.user_id, self.artifact_type, self.scope, payload=payload,
            idempotency_key='equity-entry:%s:%s' % (expected_version, digest),
            expected_version=expected_version,
        )
        if not isinstance(row, dict) or row.get('payload') != payload:
            raise ValueError('Durable entry reservation could not be verified')
        self.version = int(row['version'])

    def reserve(self, client_order_id, intent):
        from operations_store import OperationsVersionConflict
        if not client_order_id or self.version is None:
            raise ValueError('Reservations must be read before verifying a new entry')
        row, payload = self._row()
        current_version = int((row or {}).get('version') or 0)
        if current_version != self.version:
            raise OperationsVersionConflict('Entry reservations changed during portfolio verification')
        stored_intent = {**dict(intent), 'identityHash': hashlib.sha256((self.scope + ':' + client_order_id).encode()).hexdigest()}
        previous = payload['intents'].get(client_order_id)
        if previous is not None and previous != stored_intent:
            raise ValueError('Client order identity already reserves a different intent')
        payload['intents'][client_order_id] = stored_intent
        self._save(payload, current_version)

    def release(self, client_order_id):
        from operations_store import OperationsVersionConflict
        for _ in range(3):
            row, payload = self._row()
            version = int((row or {}).get('version') or 0)
            if self.version is not None and version != self.version:
                raise OperationsVersionConflict('Entry reservations changed during reconciliation')
            if client_order_id not in payload['intents']:
                self.version = version
                return
            del payload['intents'][client_order_id]
            try:
                self._save(payload, version)
                return
            except OperationsVersionConflict:
                continue
        raise OperationsVersionConflict('Entry reservation release requires reconciliation')
