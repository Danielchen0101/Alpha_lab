"""Durable forward observations for the same fixed portfolio replay engine.

Only quotes actually observed after protocol freeze enter this book. Replaying
the recorded observations is deterministic and never submits broker orders.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from equity_data import content_hash, dataset_hash, read_sip_history
from equity_program import ETF_GROUPS, equity_policy
from equity_strategy import NEW_YORK, evaluate_daily_signal, number, parse_time
from operations_store import OperationsVersionConflict
from equity_risk import portfolio_entry_budget

ARTIFACT = "equity_shadow"


def read_shadow(store, uid, protocol_key):
    row = store.get_artifact(uid, ARTIFACT, protocol_key)
    return deepcopy((row or {}).get("payload") or {})


def public_shadow(state):
    """Keep the quote archive out of routine API responses."""
    return {key: deepcopy(value) for key, value in (state or {}).items()
            if key not in ("dataset", "barCache", "observations")}


def _archive_bars(previous, incoming, observed_at):
    """Freeze first-seen prices and causal availability, including backfills."""
    archive, corrections = deepcopy(previous or {}), []
    observed = parse_time(observed_at)
    fields = ('session', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'complete', 'feed')
    for symbol, rows in (incoming or {}).items():
        saved = {row['session']: row for row in archive.get(symbol, [])}
        for row in rows:
            date = row['session']
            economic = {field: row.get(field) for field in fields}
            if date in saved:
                original = saved[date]
                before = {field: original.get(field) for field in fields}
                if before != economic:
                    corrections.append({'type': 'bar_revision', 'symbol': symbol, 'session': date,
                                        'previousHash': content_hash(before), 'receivedHash': content_hash(economic),
                                        'observedAt': observed_at})
                if not original.get('firstObservedAt'):
                    corrections.append({'type': 'legacy_bar_availability_unverified', 'symbol': symbol, 'session': date})
                continue
            complete_at = parse_time(row.get('availableAt'))
            if not complete_at:
                raise ValueError('bar_completion_timestamp_missing')
            saved[date] = {**deepcopy(row), 'sourceAvailableAt': complete_at.isoformat(),
                           'firstObservedAt': observed_at,
                           'availableAt': max(complete_at, observed).isoformat()}
        archive[symbol] = [saved[date] for date in sorted(saved)]
    return archive, corrections


def _archive_actions(previous, incoming, observed_at, last_observed_session=None):
    """Late actions quarantine the book rather than rewriting earlier trades."""
    saved = {str(row['id']): deepcopy(row) for row in previous or []}
    corrections = []
    for row in incoming:
        identity = str(row['id'])
        prior = saved.get(identity)
        if prior:
            before = {key: value for key, value in prior.items() if key != 'firstObservedAt'}
            if before != row:
                corrections.append({'type': 'action_revision', 'id': identity,
                                    'previousHash': content_hash(before), 'receivedHash': content_hash(row),
                                    'observedAt': observed_at})
        elif last_observed_session and row.get('exDate', '9999') <= last_observed_session:
            corrections.append({'type': 'late_corporate_action', 'id': identity, 'symbol': row.get('symbol'),
                                'exDate': row.get('exDate'), 'receivedHash': content_hash(row), 'observedAt': observed_at})
        else:
            saved[identity] = {**deepcopy(row), 'firstObservedAt': observed_at}
    return sorted(saved.values(), key=lambda row: (row.get('exDate') or '9999', row['id'])), corrections


def _portfolio_budgets(state, quotes, symbols, policy):
    positions, orders, managed = [], [], {}
    for symbol, position in (state.get('positions') or {}).items():
        quote = (quotes.get(symbol) or [{}])[-1]
        price = number(quote.get('bid')) or position['entryPrice']
        positions.append({'symbol': symbol, 'qty': position['qty'], 'current_price': price,
                          'market_value': position['qty'] * price, 'side': 'long'})
        orders.append({'id': 'shadow-stop-' + symbol, 'symbol': symbol, 'side': 'sell',
                       'qty': position['qty'], 'type': 'stop', 'status': 'new', 'time_in_force': 'gtc', 'stop_price': position['stopPrice']})
        managed[symbol] = {**position, 'corporateActionReviewRequired': position.get('quarantined', False)}
    for order in state.get('pendingOrders') or []:
        if order.get('side') != 'buy':
            continue
        orders.append({'id': 'shadow-buy-' + order['symbol'], 'symbol': order['symbol'],
                       'side': 'buy', 'qty': order['qty'], 'filled_qty': 0, 'type': 'limit', 'status': 'new',
                       'limit_price': order['limitPrice'], 'order_class': 'oto',
                       'stop_loss': {'stop_price': order['limitPrice'] - order['initialRiskPerShare']}})
    account = {'equity': state.get('equity', 2000), 'cash': state.get('cash', 2000), 'buying_power': state.get('cash', 2000)}
    budgets = {symbol: portfolio_entry_budget(account, positions, orders, managed, policy, {'symbol': symbol}) for symbol in symbols}
    representative = next(iter(budgets.values()), {})
    return {'accountEquity': account['equity'], 'cash': account['cash'],
            'grossExposure': representative.get('grossExposure', 0),
            'openStopRisk': representative.get('openStopRisk', 0),
            'pendingBuyNotional': representative.get('pendingBuyNotional', 0),
            'positionCountIncludingOrders': representative.get('positionCountIncludingOrders', 0),
            'bySymbol': budgets}


def capture_cycle(store, uid, protocol, fetch_data, fetch_broker, *, now=None, dry_run=False):
    from equity_research import replay_portfolio
    clock = parse_time(now or datetime.now(timezone.utc).isoformat())
    frozen = parse_time(protocol.get("frozenAt"))
    key = protocol["protocolKey"]
    if not clock or not frozen or clock < frozen:
        raise ValueError("invalid_forward_clock")
    # CAS serializes two workers: an unsuccessful writer can never report a
    # committed fill. Its next cycle reloads the winning observations.
    row = store.get_artifact(uid, ARTIFACT, key)
    state = deepcopy((row or {}).get("payload") or {})
    if state and state.get("protocolHash") != protocol["protocolHash"]:
        raise ValueError("shadow_protocol_changed")
    if state.get('asOf') and parse_time(state['asOf']) > clock:
        raise ValueError('forward_clock_moved_backwards')
    symbols = protocol["symbols"]
    today = clock.astimezone(NEW_YORK).date().isoformat()
    result = {"protocolKey": key, "protocolHash": protocol["protocolHash"],
              "strategyVersion": "equity_fixed_v1", "dataVersion": "equity_sip_v1",
              "executionMode": "shadow", "brokerOrdersSubmitted": 0,
              "asOf": clock.isoformat(), "businessStatus": "no_signal", "blockers": [],
              "policy": equity_policy(), "ai": {"required": False, "status": "not_requested"}}
    broker_clock = fetch_broker("/v2/clock", {})
    clock_stamp = parse_time(broker_clock.get("timestamp"))
    if not clock_stamp or abs((clock - clock_stamp).total_seconds()) > 60:
        raise ValueError("broker_clock_stale")
    if broker_clock.get("is_open") is not True:
        return {**public_shadow(state), **result, "businessStatus": "market_closed", "blockers": ["regular_session_required"]}
    start = (frozen - timedelta(days=500)).date().isoformat()
    calendar = fetch_broker("/v2/calendar", {"start": start, "end": today})
    if not isinstance(calendar, list) or not calendar or today not in [r.get("date") for r in calendar]:
        raise ValueError("exchange_calendar_missing")
    sessions = [r["date"] for r in calendar]
    if sessions != sorted(set(sessions)):
        raise ValueError("exchange_calendar_invalid")
    past_sessions = [s for s in sessions if s < today]
    dataset = deepcopy(state.get("dataset") or {})
    cache = state.get("barCache") or {}
    if cache.get("session") != today:
        # Both signal-adjusted and actual raw prices are archived. The replay
        # uses raw prices plus explicit company actions, never adjusted fills.
        end = (clock - timedelta(minutes=16)).isoformat()
        raw, _ = read_sip_history(fetch_data, symbols, start + "T00:00:00Z", end,
                                  now=clock.isoformat(), expected_sessions=past_sessions)
        adjusted, _ = read_sip_history(fetch_data, symbols, start + "T00:00:00Z", end,
                                       now=clock.isoformat(), adjustment="split", expected_sessions=past_sessions)
        cache = {"session": today, "raw": raw, "adjusted": adjusted}
    missing_bars = not cache["raw"]["coverage"]["complete"] or not cache["adjusted"]["coverage"]["complete"]
    if missing_bars:
        result["blockers"].append("daily_bar_gaps")
    bars_observed_at = clock.isoformat() if now is not None else datetime.now(timezone.utc).isoformat()
    archived_bars, bar_corrections = _archive_bars(
        dataset.get('bars'), cache['raw']['rows'], bars_observed_at,
    )
    # Action completeness is independently verified by the data adapter. An
    # unavailable feed still permits diagnostic observations, never admission.
    actions, actions_complete = [], False
    try:
        from equity_data import read_corporate_actions
        action_data = read_corporate_actions(fetch_data, symbols, start, today)
        if isinstance(action_data, tuple):
            actions, action_coverage = action_data
            actions_complete = action_coverage.get("complete") is True
    except (ImportError, ValueError, KeyError, TypeError):
        result["blockers"].append("corporate_actions_unverified")
    if not actions_complete and 'corporate_actions_unverified' not in result['blockers']:
        result['blockers'].append('corporate_actions_unverified')
    last_observed_session = max(state.get('observations') or [], default=None)
    archived_actions, action_corrections = _archive_actions(
        dataset.get('corporateActions'), actions, bars_observed_at, last_observed_session,
    )
    # Revisions are sticky for this frozen cohort. They require an explicit
    # reconciled/new forward protocol, never a silent replay of nicer history.
    corrections = {content_hash({k: v for k, v in item.items() if k != 'observedAt'}): item
                   for item in state.get('evidenceCorrections') or []}
    for item in bar_corrections + action_corrections:
        identity = content_hash({k: v for k, v in item.items() if k != 'observedAt'})
        corrections.setdefault(identity, item)
    quarantined = bool(corrections)
    if quarantined:
        result['blockers'].append('forward_evidence_revision_requires_reconciliation')
    quotes = deepcopy(dataset.get("quotes") or {symbol: [] for symbol in symbols})
    latest = fetch_data("/v2/stocks/quotes/latest", {"symbols": ",".join(symbols), "feed": "iex"})
    # The market can tick while earlier HTTP reads are in flight. Measure quote
    # age at receipt, not against the cycle's older start timestamp.
    if now is None:
        clock = datetime.now(timezone.utc)
        result['asOf'] = clock.isoformat()
    fresh_symbols, rejected = [], []
    for symbol in symbols:
        raw = (latest.get("quotes") or {}).get(symbol) or {}
        stamp, bid, ask = parse_time(raw.get("t")), number(raw.get("bp")), number(raw.get("ap"))
        bs, az = number(raw.get("bs")), number(raw.get("as"))
        if (not stamp or not bid or not ask or bid > ask or bid <= 0 or
                not bs or not az or min(bs, az) <= 0 or
                not 0 <= (clock - stamp).total_seconds() <= 30 or stamp < frozen):
            rejected.append(symbol)
            continue
        fresh_symbols.append(symbol)
        event = {"timestamp": stamp.isoformat(), "availableAt": stamp.isoformat(),
                 "observedAt": clock.isoformat(), "bid": bid, "ask": ask,
                 # Conservatively use reported units as a lower bound in shares.
                 # Never multiply an undocumented IEX size by 100.
                 "bidSize": bs, "askSize": az, "feed": "iex"}
        symbol_quotes = quotes.setdefault(symbol, [])
        if not symbol_quotes or parse_time(symbol_quotes[-1]["timestamp"]) < stamp:
            symbol_quotes.append(event)
    if rejected:
        result["blockers"].append("missing_or_stale_iex_quotes:" + ",".join(rejected))
    dataset = {"dataVersion": "equity_sip_v1", "mode": "shadow", "barAdjustment": "raw",
               "sessions": sessions,
               "marketSessions": {r['date']: {'open': r.get('open'), 'close': r.get('close')} for r in calendar},
               "bars": archived_bars,
               "adjustedBars": cache["adjusted"]["rows"], "quotes": quotes,
               "universe": {session: symbols for session in sessions},
               "corporateActions": archived_actions,
               "coverage": {"barsComplete": not missing_bars, "quotesComplete": False,
                            "corporateActionsComplete": actions_complete,
                            "pointInTimeUniverse": False, "calendarVerified": True,
                            "quoteSizesInShares": True,
                            "quoteSizeInterpretation": "conservative_reported_unit_lower_bound",
                            "executionFeed": "iex", "executionFeedIsNBBO": False}}
    dataset["dataHash"] = dataset_hash(dataset)
    config = {**protocol["config"], "strategy": protocol["strategy"], "mode": "shadow",
              "executionFeed": "iex", "protocolHash": protocol['protocolHash'],
              "tradeStart": frozen.astimezone(NEW_YORK).date().isoformat(),
              "tradeEnd": today, "frozenAt": frozen.isoformat(), "liquidateEnd": False,
              "correlationGroups": {s: ETF_GROUPS.get(s, "unknown") for s in symbols}}
    if quarantined and state:
        # Preserve committed trading decisions. Mark valuation stale explicitly;
        # do not fabricate retroactive corrections or any new shadow fills.
        replay = {key: deepcopy(state.get(key)) for key in ('state', 'metrics', 'fills', 'trades', 'equityCurve', 'diagnostics', 'config', 'costVersion')}
        replay['state'] = {**(replay.get('state') or {}), 'riskPaused': True, 'valuationStale': True}
        replay['diagnostics'] = sorted(set(replay.get('diagnostics') or []) | {'forward_evidence_revision_requires_reconciliation'})
        replay['proposedOrders'] = deepcopy(state.get('orderIntents') or [])
    else:
        replay = replay_portfolio(dataset, config)
    observed = sorted(set(state.get("observations") or []) | ({today} if len(fresh_symbols) == len(symbols) and not missing_bars and not quarantined else set()))
    signals = [{"symbol": symbol, **evaluate_daily_signal(cache["adjusted"]["rows"].get(symbol), protocol["strategy"], clock.isoformat())} for symbol in symbols]
    result.update({"dataHash": dataset["dataHash"], "frozenAt": frozen.isoformat(),
                   "config": replay.get('config'), "costVersion": replay.get('costVersion'),
                   "signals": signals, "state": replay.get("state"), "metrics": replay.get("metrics"),
                   "fills": replay.get('fills', []), "orderIntents": replay.get('proposedOrders', []),
                   "trades": replay.get("trades", []), "equityCurve": replay.get("equityCurve", []),
                   "diagnostics": replay.get("diagnostics", []),
                   "forward": {"tradingSessions": len([s for s in observed if s < today]),
                               "completedTrades": len(replay.get("trades") or []),
                               "requiredSessions": 60, "requiredTrades": 30},
                   "researchAdmission": {"eligible": False, "status": "shadow_observations_only"}})
    result['evidenceCorrections'] = list(corrections.values())
    result['riskBudget'] = _portfolio_budgets(replay.get('state') or {}, quotes, symbols, result['policy'])
    if not fresh_symbols or missing_bars:
        result["businessStatus"] = "data_insufficient"
    elif any(signal["eligible"] for signal in signals):
        result["businessStatus"] = "completed"
        affordable = False
        for signal in signals:
            if not signal.get('eligible') or signal['symbol'] not in fresh_symbols:
                continue
            quote = quotes[signal['symbol']][-1]
            budget = result['riskBudget']['bySymbol'][signal['symbol']]
            risk = number(signal.get('initialRiskPerShare')) or 0
            limit = quote['ask'] * (1 + result['policy']['maxSlippageBps'] / 10000.0)
            if budget['ok'] and risk > 0 and int(min(budget['maxAdditionalNotional'] / limit, budget['maxAdditionalRisk'] / risk)) >= 1:
                affordable = True
        if not affordable and not any(order.get('side') == 'buy' for order in (replay.get('state') or {}).get('pendingOrders') or []):
            result['businessStatus'] = 'capital_blocked'
    if (replay.get('state') or {}).get('riskPaused'):
        result['businessStatus'] = 'risk_paused'
    state = {**result, "dataset": dataset, "barCache": cache, "observations": observed}
    if not dry_run:
        store.put_artifact(uid, ARTIFACT, key, payload=state,
                           idempotency_key=content_hash(state), expected_version=int((row or {}).get("version") or 0))
    else:
        result["dryRun"] = True
    return result
