"""Causal fixed-v1 portfolio research and the shared forward shadow ledger.

Every fill needs a subsequent executable quote. Daily OHLC is signal data, not
proof that a stop/limit traded. Incomplete datasets can produce diagnostics but
cannot pass admission. No account, broker or network calls occur here.
"""
import argparse
from copy import deepcopy
from datetime import datetime, time, timedelta, timezone
import json
import heapq
from bisect import bisect_left
import math
from pathlib import Path
import random

from equity_data import EQUITY_DATA_VERSION, content_hash, dataset_hash, validate_dataset, iter_archived_quotes
from equity_program import ETF_GROUPS, equity_policy
from equity_risk import portfolio_entry_budget
from equity_strategy import (EQUITY_STRATEGY_VERSION, NEW_YORK, evaluate_daily_signal,
                             normalize_daily_bars, number, parse_time, position_exit_decision, entry_price_levels)

RESEARCH_VERSION = "equity_research_v1"
COST_VERSION = "spread_plus_10bps_slippage_5bps_fee_proxy_v1"
REGISTERED_TRIALS = ("breakout20", "pullback20")


def _quote(raw, mode, expected_feed, frozen_at):
    event = parse_time(raw.get("timestamp"))
    observed = parse_time(raw.get("observedAt")) if mode == "shadow" else event
    if not event or not observed or raw.get("feed") != expected_feed:
        return None, "quote_source_or_timestamp_invalid"
    if mode == "shadow" and (not frozen_at or observed < frozen_at or not 0 <= (observed - event).total_seconds() <= 30):
        return None, "quote_not_fresh_server_observation"
    values = {key: number(raw.get(key)) for key in ("bid", "ask", "bidSize", "askSize")}
    if any(value is None or value <= 0 for value in values.values()) or values["bid"] > values["ask"]:
        return None, "quote_not_executable"
    local = observed.astimezone(NEW_YORK)
    if not time(9, 30) <= local.time().replace(tzinfo=None) < time(16):
        return None, "quote_outside_regular_session"
    return {**values, "timestamp": raw["timestamp"], "observedAt": observed.isoformat(), "at": observed,
            "session": local.date().isoformat(), "feed": expected_feed}, None


def _raw_quote_rows(dataset, symbol, archive_root=None):
    if (dataset.get("quoteArchives") or {}).get(symbol):
        if not archive_root:
            raise ValueError("archived_dataset_requires_trusted_archive_root")
        yield from iter_archived_quotes(dataset, symbol, archive_root)
    else:
        yield from (dataset.get("quotes") or {}).get(symbol, [])


def replay_portfolio(dataset, config=None):
    """Replay an independent $2,000 cash account, never an external account.

    Shadow accepts IEX quotes observed by the server after freeze, historical
    replay accepts SIP. Orders are whole-share, full-fill only and take effect
    on a strictly later quote. Overnight gaps fill at that quote, not the stop.
    This is a conservative simulation, not a representation of actual fills.
    """
    config = dict(config or {})
    policy = equity_policy()
    mode = config.get("mode", "historical")
    feed = config.get("executionFeed", "iex" if mode == "shadow" else "sip")
    if mode not in ("historical", "shadow") or feed != ("iex" if mode == "shadow" else "sip"):
        raise ValueError("invalid_replay_mode_or_feed")
    strategy = config.get("strategy", "breakout20")
    if strategy not in REGISTERED_TRIALS:
        raise ValueError("unregistered_strategy")
    frozen_at = parse_time(config.get("frozenAt"))
    if mode == "shadow" and frozen_at is None:
        raise ValueError("shadow_requires_frozen_protocol")
    start, end = config.get("tradeStart", "0001-01-01"), config.get("tradeEnd", "9999-12-31")
    stress = number(config.get("costMultiplier", 1))
    monthly_cost = number(config.get("monthlyOperatingCost", 0))
    if stress not in (1, 2) or monthly_cost is None or not 0 <= monthly_cost <= 30:
        raise ValueError("invalid_fixed_cost_assumptions")
    diagnostics = set(validate_dataset(dataset))
    bars = {}
    for symbol, raw in (dataset.get("bars") or {}).items():
        rows, errors = normalize_daily_bars(raw)
        if errors:
            diagnostics.update(symbol + ":" + item for item in errors)
        bars[symbol] = rows
    sessions = set(dataset.get("sessions") or [])
    bar_times = {symbol: [parse_time(row["availableAt"]) for row in rows] for symbol, rows in bars.items()}
    ordered_sessions = sorted(sessions)
    universe = dataset.get("universe") or {}
    def symbol_events(symbol):
        previous, last_identity = None, None
        for raw in _raw_quote_rows(dataset, symbol, config.get("archiveRoot")):
            quote, error = _quote(raw, mode, feed, frozen_at)
            if error:
                # Zero-sided/crossed quote states and session boundaries are
                # observations to skip, not hypothetical executable markets.
                if error not in ("quote_not_executable", "quote_outside_regular_session"):
                    diagnostics.add(error)
                continue
            if not start <= quote["session"] <= end:
                continue
            if stress == 2:
                midpoint = (quote["ask"] + quote["bid"]) / 2
                half_spread = (quote["ask"] - quote["bid"]) / 2
                quote["ask"], quote["bid"] = midpoint + 2 * half_spread, midpoint - 2 * half_spread
            if quote["session"] not in sessions:
                diagnostics.add("quote_without_exchange_calendar_session")
                continue
            market_session = (dataset.get("marketSessions") or {}).get(quote["session"], {})
            close_time = market_session.get("close")
            open_time = market_session.get("open", "09:30")
            if close_time:
                local_time = quote["at"].astimezone(NEW_YORK).strftime("%H:%M:%S")
                if not str(open_time)[:5] + ":00" <= local_time < str(close_time)[:5] + ":00":
                    continue
            identity = (symbol, quote["timestamp"], quote["observedAt"])
            if identity == last_identity:
                continue
            if previous and quote["at"] < previous:
                raise ValueError("quote_archive_not_chronological")
            previous, last_identity = quote["at"], identity
            yield quote["at"], symbol, quote
    events = heapq.merge(*(symbol_events(symbol) for symbol in (dataset.get("quotes") or {})), key=lambda row: (row[0], row[1]))
    cash = 2000.0
    positions, pending, marks = {}, {}, {}
    trades, fills, equity_curve, intents, protection_events = [], [], [], [], []
    signal_cache, acted_sessions, history_cache, exit_cache = {}, set(), {}, {}
    applied_actions, receivables, settlements = set(), [], []
    peak, day_open, current_session, last_cost_date = cash, cash, None, None
    risk_latched = False
    actions = dataset.get("corporateActions") or []
    groups = {**ETF_GROUPS, **(dataset.get("symbolGroups") or {})}

    def nav():
        liquidation = 0.0
        for symbol, p in positions.items():
            notional = p["qty"] * marks.get(symbol, p["entryPrice"]) * (1 - policy["maxSlippageBps"] / 10000 * stress)
            liquidation += notional - fee(notional)
        return cash + liquidation + sum(r["amount"] for r in receivables) + sum(r["amount"] for r in settlements)

    def fee(notional):
        # Explicit conservative proxy; do not pretend current fees are historical.
        return max(0.01, notional * policy["feeReserveBps"] / 10000.0) * stress

    def history(symbol, at, day):
        count = bisect_left(bar_times.get(symbol, []), at)
        key = (symbol, day, count)
        if key in history_cache:
            return history_cache[key]
        rows = deepcopy(bars.get(symbol, [])[:count])
        # Causally split-adjust only information available by this event. Cash
        # dividends remain cash flows, so total-return bars cannot double-count.
        for action in actions:
            if action.get("symbol") != symbol or action.get("type") != "split" or not action.get("exDate", "9999") <= day:
                continue
            ratio = number(action.get("ratio"))
            if ratio and ratio > 0:
                for row in rows:
                    if row["session"] < action["exDate"]:
                        for key in ("open", "high", "low", "close"):
                            row[key] /= ratio
                        if row.get("volume") is not None:
                            row["volume"] *= ratio
        history_cache[key] = rows
        return rows

    def budget(symbol, exclude=None):
        broker_positions, orders, managed = [], [], {}
        for held_symbol, p in positions.items():
            price = marks.get(held_symbol, p["entryPrice"])
            broker_positions.append({"symbol": held_symbol, "qty": p["qty"], "current_price": price, "market_value": p["qty"] * price, "side": "long"})
            orders.append({"id": "stop_" + held_symbol, "symbol": held_symbol, "qty": p["qty"], "type": "stop", "side": "sell", "status": "new", "time_in_force": "gtc", "stop_price": p["stopPrice"]})
            managed[held_symbol] = p
        for order_symbol, order in pending.items():
            if order_symbol == exclude or order["side"] != "buy":
                continue
            orders.append({"id": "entry_" + order_symbol, "symbol": order_symbol, "qty": order["qty"], "limit_price": order["limitPrice"], "type": "limit", "side": "buy", "status": "new", "order_class": "oto", "time_in_force": "gtc", "stop_loss": {"stop_price": order["limitPrice"] - order["initialRiskPerShare"]}})
            managed[order_symbol] = {"sector": groups.get(order_symbol, "unknown"), "correlationGroup": groups.get(order_symbol, "unknown")}
        return portfolio_entry_budget({"cash": cash, "buying_power": cash, "equity": nav()}, broker_positions, orders, managed, policy,
                                      {"symbol": symbol, "sector": groups.get(symbol, "unknown"), "correlationGroup": groups.get(symbol, "unknown")})

    for at, symbol, quote in events:
        day = quote["session"]
        if current_session != day:
            prior_close_equity = nav()
            if current_session is not None:
                equity_curve.append({"session": current_session, "equity": nav(), "cash": cash})
                for held_symbol in positions:
                    if marks.get(held_symbol + ":session") != current_session:
                        diagnostics.add("held_position_missing_session_quote")
            if last_cost_date:
                elapsed = (datetime.fromisoformat(day) - datetime.fromisoformat(last_cost_date)).days
                cash -= monthly_cost * elapsed / 30.4375
            last_cost_date = day
            # Day orders expire; protective exit intentions survive overnight.
            pending = {key: order for key, order in pending.items() if order["side"] == "sell"}
            for index, action in enumerate(actions):
                if index in applied_actions or not action.get("exDate") or action["exDate"] > day:
                    continue
                applied_actions.add(index)
                held_symbol = action.get("symbol")
                p = positions.get(held_symbol)
                if action.get("type") == "split":
                    ratio = number(action.get("ratio"))
                    if not ratio or ratio <= 0:
                        diagnostics.add("invalid_split_action")
                    elif p:
                        p["qty"] *= ratio
                        if abs(p["qty"] - round(p["qty"])) > 1e-8:
                            p["quarantined"] = True
                            diagnostics.add("fractional_split_requires_cash_in_lieu_evidence")
                        for key in ("entryPrice", "initialRiskPerShare", "stopPrice"):
                            p[key] /= ratio
                        if held_symbol in marks:
                            marks[held_symbol] /= ratio
                elif action.get("type") == "dividend":
                    amount = number(action.get("cashAmount"))
                    if amount is None or amount < 0 or not action.get("payDate"):
                        diagnostics.add("dividend_cash_flow_incomplete")
                    elif p:
                        value = p["qty"] * amount
                        p["dividends"] += value
                        receivables.append({"payDate": action["payDate"], "amount": value})
                else:
                    diagnostics.add("unsupported_corporate_action")
                    if p:
                        p["quarantined"] = True
            due = [r for r in receivables if r["payDate"] <= day]
            cash += sum(r["amount"] for r in due)
            receivables[:] = [r for r in receivables if r["payDate"] > day]
            cash += sum(item["amount"] for item in settlements if item["settleSession"] <= day)
            settlements[:] = [item for item in settlements if item["settleSession"] > day]
            current_session, day_open = day, prior_close_equity
        marks[symbol], marks[symbol + ":session"] = quote["bid"], day
        peak = max(peak, nav())
        if nav() <= peak * (1 - policy["maxDrawdownPct"] / 100):
            risk_latched = True
        daily_paused = nav() <= day_open * (1 - policy["dailyLossStopPct"] / 100)
        spread = (quote["ask"] - quote["bid"]) / ((quote["ask"] + quote["bid"]) / 2) * 10000
        order = pending.get(symbol)
        if order and at > parse_time(order["submittedAt"]):
            # A new receive timestamp for the same stale exchange tick cannot
            # prove a subsequent executable market observation.
            later_market_tick = parse_time(quote["timestamp"]) > parse_time(order["quoteTimestamp"])
            if order["side"] == "buy" and (risk_latched or daily_paused):
                del pending[symbol]
            elif later_market_tick and order["side"] == "buy":
                fill_price = quote["ask"] * (1 + policy["maxSlippageBps"] / 10000 * stress)
                allowed = budget(symbol, exclude=symbol)
                qty = order["qty"]
                notional = qty * fill_price
                actual_risk = fill_price - order["stopPrice"]
                if allowed["ok"] and spread <= policy["maxSpreadBps"] and fill_price <= order["limitPrice"] and actual_risk > 0 and quote["askSize"] >= qty and notional <= allowed["maxAdditionalNotional"] + 1e-8 and qty * actual_risk <= allowed["maxAdditionalRisk"] + 1e-8 and notional + fee(notional) <= cash:
                    costs = fee(notional)
                    cash -= notional + costs
                    positions[symbol] = {"symbol": symbol, "qty": qty, "entryPrice": fill_price, "entryTimestamp": at.isoformat(), "entrySession": day,
                                         "initialRiskPerShare": actual_risk, "stopPrice": order["stopPrice"], "entryFee": costs,
                                         "dividends": 0.0, "trailActive": False, "sector": groups.get(symbol, "unknown"), "correlationGroup": groups.get(symbol, "unknown"), "strategy": order["strategy"]}
                    fills.append({"side": "buy", "symbol": symbol, "qty": qty, "price": fill_price, "fee": costs, "timestamp": at.isoformat()})
                    protection_events.append({"symbol": symbol, "entryTimestamp": at.isoformat(), "timestamp": at.isoformat(), "qty": qty, "stopPrice": order["stopPrice"]})
                    del pending[symbol]
            elif later_market_tick and order["side"] == "sell" and symbol in positions:
                p = positions[symbol]
                if quote["bidSize"] >= p["qty"] and not p.get("quarantined"):
                    fill_price = quote["bid"] * (1 - policy["maxSlippageBps"] / 10000 * stress)
                    costs = fee(p["qty"] * fill_price)
                    proceeds = p["qty"] * fill_price - costs
                    lag = 2 if day < "2024-05-28" else 1
                    next_sessions = [session for session in ordered_sessions if session > day]
                    settle_session = next_sessions[lag - 1] if len(next_sessions) >= lag else "9999-12-31"
                    settlements.append({"settleSession": settle_session, "amount": proceeds, "tradeSession": day})
                    pnl = p["qty"] * (fill_price - p["entryPrice"]) - p["entryFee"] - costs + p["dividends"]
                    trades.append({"symbol": symbol, "strategy": p["strategy"], "qty": p["qty"], "entryTime": p["entryTimestamp"], "exitTime": at.isoformat(), "entryPrice": p["entryPrice"], "exitPrice": fill_price, "netPnl": pnl, "fees": p["entryFee"] + costs, "dividends": p["dividends"], "reason": order["reason"]})
                    fills.append({"side": "sell", "symbol": symbol, "qty": p["qty"], "price": fill_price, "fee": costs, "timestamp": at.isoformat()})
                    del pending[symbol], positions[symbol]
        rows = history(symbol, at, day)
        if symbol in positions:
            p = positions[symbol]
            exit_key = (symbol, day, p["entryTimestamp"], len(rows))
            if exit_key not in exit_cache:
                exit_cache[exit_key] = position_exit_decision(p, rows)
            decision = dict(exit_cache[exit_key])
            if quote["bid"] <= decision.get("stopPrice", p["stopPrice"]):
                decision.update(exit=True, reason="STOP")
            if decision.get("blockers"):
                diagnostics.update(decision["blockers"])
            else:
                if decision["stopPrice"] > p["stopPrice"]:
                    protection_events.append({"symbol": symbol, "entryTimestamp": p["entryTimestamp"], "timestamp": at.isoformat(), "qty": p["qty"], "stopPrice": decision["stopPrice"]})
                p.update({key: decision[key] for key in ("stopPrice", "trailActive", "sessionsHeld")})
            if config.get("liquidateEnd") and day == end:
                decision = {**decision, "exit": True, "reason": "SCHEDULED_WINDOW_END"}
            if decision.get("exit") and symbol not in pending and not p.get("quarantined"):
                pending[symbol] = {"symbol": symbol, "side": "sell", "qty": p["qty"], "reason": decision["reason"], "submittedAt": at.isoformat(), "quoteTimestamp": quote["timestamp"]}
                intents.append(deepcopy(pending[symbol]))
        elif symbol not in pending and (day, symbol) not in acted_sessions and not (risk_latched or daily_paused):
            if symbol not in universe.get(day, []):
                continue
            key = (day, symbol, len(rows))
            if key not in signal_cache:
                candidates = [evaluate_daily_signal(rows, strategy, as_of=at)]
                signal_cache[key] = next((signal for signal in candidates if signal["eligible"]), candidates[0])
            signal = signal_cache[key]
            if not signal["eligible"] or not rows or rows[-1]["session"] >= day or spread > policy["maxSpreadBps"]:
                continue
            allowed = budget(symbol)
            levels = entry_price_levels(quote["ask"], signal["atr14"], policy["maxSlippageBps"], stress)
            risk, limit = levels["initialRiskPerShare"], levels["limitPrice"]
            qty = math.floor(min(allowed["maxAdditionalNotional"] / limit, allowed["maxAdditionalRisk"] / risk)) if allowed["ok"] else 0
            if qty <= 0 or limit <= risk:
                continue
            pending[symbol] = {"symbol": symbol, "side": "buy", "qty": qty, **levels, "strategy": signal["strategy"], "signalSession": signal["session"], "submittedAt": at.isoformat(), "quoteTimestamp": quote["timestamp"]}
            acted_sessions.add((day, symbol))
            intents.append(deepcopy(pending[symbol]))
    if current_session:
        equity_curve.append({"session": current_session, "equity": nav(), "cash": cash})
        for held_symbol in positions:
            if marks.get(held_symbol + ":session") != current_session:
                diagnostics.add("held_position_missing_session_quote")
    missing_sessions = [day for day in sorted(sessions) if start <= day <= end and day not in {row["session"] for row in equity_curve}]
    if missing_sessions:
        diagnostics.add("sessions_without_executable_observations")
    if positions and config.get("liquidateEnd"):
        diagnostics.add("window_end_exit_not_executable")
    gross_wins = sum(max(0, row["netPnl"]) for row in trades)
    gross_losses = -sum(min(0, row["netPnl"]) for row in trades)
    high, max_dd, previous = 2000.0, 0.0, 2000.0
    daily_returns = []
    for row in equity_curve:
        high = max(high, row["equity"])
        max_dd = max(max_dd, (high - row["equity"]) / high)
        daily_returns.append(row["equity"] / previous - 1)
        previous = row["equity"]
    return {"researchVersion": RESEARCH_VERSION, "strategyVersion": EQUITY_STRATEGY_VERSION, "dataVersion": EQUITY_DATA_VERSION,
            "costVersion": COST_VERSION, "dataHash": dataset.get("dataHash"), "config": config,
            "valuationBasis": "last observed bid less explicit exit slippage/fee reserve; open positions are not closed trades",
            "state": {"cash": cash, "equity": nav(), "positions": deepcopy(positions), "pendingOrders": list(pending.values()), "receivables": receivables, "unsettledProceeds": settlements, "riskPaused": risk_latched},
            "trades": trades, "fills": fills, "proposedOrders": intents, "protectionEvents": protection_events, "equityCurve": equity_curve, "dailyReturns": daily_returns,
            "metrics": {"closedTrades": len(trades), "netPnl": nav() - 2000, "maxDrawdownPct": max_dd * 100,
                        "profitFactor": gross_wins / gross_losses if gross_losses else None, "grossWins": gross_wins, "grossLosses": gross_losses},
            "diagnostics": sorted(diagnostics), "missingSessions": missing_sessions}


def block_bootstrap_lower(returns, trials=2, samples=2000, block=20):
    """One-sided familywise 95% lower mean with contiguous session blocks.

    Bonferroni accounts for every registered candidate, including failed trials.
    This is not a guarantee nor a substitute for an untouched forward period.
    """
    values = [number(value) for value in returns]
    if len(values) < 60 or any(value is None for value in values):
        return None
    rng = random.Random(41719)
    means = []
    for _ in range(samples):
        draw = []
        while len(draw) < len(values):
            index = rng.randrange(max(1, len(values) - block + 1))
            draw.extend(values[index:index + block])
        means.append(sum(draw[:len(values)]) / len(values))
    means.sort()
    return means[max(0, int(samples * .05 / max(1, trials)) - 1)]


def make_protocol(strategy="breakout20", symbols=None, periods=None, now=None):
    periods = dict(periods or {})
    if set(periods) - {"start", "end", "holdoutStart", "holdoutEnd", "monthlyOperatingCost"}:
        raise ValueError("unknown_protocol_field")
    if strategy not in REGISTERED_TRIALS:
        raise ValueError("unregistered_strategy")
    symbols = sorted(set(symbols or ETF_GROUPS))
    if not symbols or any(symbol not in ETF_GROUPS for symbol in symbols):
        raise ValueError("v1_requires_registered_etf_universe")
    clock = parse_time(now) if now else datetime.now(timezone.utc)
    if not clock:
        raise ValueError("invalid_freeze_time")
    end = periods.get("end", (clock.date() - timedelta(days=1)).isoformat())
    start = periods.get("start", (datetime.fromisoformat(end).date() - timedelta(days=365 * 4)).isoformat())
    holdout_start = periods.get("holdoutStart", (datetime.fromisoformat(end).date() - timedelta(days=365 * 2 + 1)).isoformat())
    holdout_end = periods.get("holdoutEnd", end)
    for value in (start, end, holdout_start, holdout_end):
        if not isinstance(value, str) or datetime.fromisoformat(value).date().isoformat() != value:
            raise ValueError("invalid_protocol_date")
    if not start < holdout_start < holdout_end <= end or parse_time(end) >= clock:
        raise ValueError("invalid_frozen_holdout_period")
    cost = number(periods.get("monthlyOperatingCost", 0))
    if cost is None or not 0 <= cost <= 30:
        raise ValueError("operating_cost_outside_budget")
    protocol = {"researchVersion": RESEARCH_VERSION, "strategyVersion": EQUITY_STRATEGY_VERSION, "dataVersion": EQUITY_DATA_VERSION,
                "costVersion": COST_VERSION, "strategy": strategy, "symbols": symbols, "frozenAt": clock.isoformat(),
                "periods": {"start": start, "end": end, "holdoutStart": holdout_start, "holdoutEnd": holdout_end},
                "config": {"strategy": strategy, "monthlyOperatingCost": cost, "initialCapital": 2000},
                "benchmarkPolicy": {"initialCapital": 2000, "maxAllocationPct": 80, "riskBudgetAnnualizedVolPct": 8, "volLookbackSessions": 60, "allocationFrozenPerFold": True},
                "registeredTrials": list(REGISTERED_TRIALS), "policy": equity_policy(), "holdoutSealed": True}
    protocol["protocolKey"] = content_hash(protocol)[:32]
    protocol["protocolHash"] = content_hash(protocol)
    return protocol


def protocol_valid(protocol):
    return isinstance(protocol, dict) and protocol.get("protocolHash") == content_hash({k: v for k, v in protocol.items() if k != "protocolHash"}) and protocol.get("registeredTrials") == list(REGISTERED_TRIALS) and protocol.get("strategyVersion") == EQUITY_STRATEGY_VERSION and protocol.get("policy") == equity_policy()


def _benchmark_evidence(dataset, folds, protocol, archive_root=None):
    """Quote-executed SPY with cash dividends, splits and ex-ante risk budget.

    The risk comparator sets its allocation once per fold from the preceding
    60 completed sessions, targeting 8% annualized volatility, capped at 80%.
    It is never scaled using subsequent realized strategy returns/volatility.
    """
    result = {key: {"sourceDataHash": dataset.get("dataHash"), "equityCurve": [], "issues": []} for key in ("cash", "spyBuyHold", "spyRiskBudget")}
    bars, errors = normalize_daily_bars((dataset.get("bars") or {}).get("SPY"))
    if errors or not bars or "SPY" not in (dataset.get("quotes") or {}):
        return {}
    actions = [row for row in dataset.get("corporateActions", []) if row.get("symbol") == "SPY"]
    for fold in folds:
        sessions = [day for day in dataset.get("sessions", []) if fold["tradeStart"] <= day <= fold["tradeEnd"]]
        def events():
            for row in _raw_quote_rows(dataset, "SPY", archive_root):
                quote, error = _quote(row, "historical", "sip", None)
                if not error and quote["session"] in sessions:
                    yield quote
        for name in result:
            cash, qty, mark, active_day, previous_day = 2000.0, 0, 0.0, None, None
            pending, bought, actions_seen, receivables, curve = None, False, set(), [], []
            issues = []
            def marked_equity():
                liquidation = qty * mark * .999
                return cash + liquidation - (max(.01, liquidation * .0005) if qty else 0) + sum(row["amount"] for row in receivables)
            for quote in events():
                day = quote["session"]
                if active_day != day:
                    if active_day:
                        curve.append({"session": active_day, "equity": marked_equity()})
                    if previous_day:
                        cash -= protocol["config"]["monthlyOperatingCost"] * (datetime.fromisoformat(day) - datetime.fromisoformat(previous_day)).days / 30.4375
                    for index, action in enumerate(actions):
                        if index in actions_seen or not action.get("exDate") or action["exDate"] > day:
                            continue
                        actions_seen.add(index)
                        if action["type"] == "split" and number(action.get("ratio")):
                            qty *= action["ratio"]
                            mark /= action["ratio"]
                            if abs(qty - round(qty)) > 1e-8:
                                issues.append("benchmark_fractional_split_unreconciled")
                        elif action["type"] == "dividend" and action.get("payDate") and number(action.get("cashAmount")) is not None:
                            receivables.append({"amount": qty * action["cashAmount"], "payDate": action["payDate"]})
                        else:
                            issues.append("benchmark_action_unsupported")
                    cash += sum(row["amount"] for row in receivables if row["payDate"] <= day)
                    receivables = [row for row in receivables if row["payDate"] > day]
                    active_day, previous_day = day, day
                mark = quote["bid"]
                if name == "cash":
                    continue
                if pending and quote["at"] > pending["at"]:
                    if pending["side"] == "buy":
                        price = quote["ask"] * 1.001
                        amount = pending["qty"] * price
                        if price <= pending["limit"] and quote["askSize"] >= pending["qty"] and amount * 1.0005 <= cash:
                            qty = pending["qty"]
                            cash -= amount + max(.01, amount * .0005)
                            pending, bought = None, True
                    elif quote["bidSize"] >= qty:
                        amount = qty * quote["bid"] * .999
                        cash += amount - max(.01, amount * .0005)
                        qty, pending = 0, None
                if not bought and pending is None:
                    available = [row for row in bars if parse_time(row["availableAt"]) < quote["at"]]
                    weight = .8
                    if name == "spyRiskBudget":
                        if len(available) < 61:
                            issues.append("benchmark_requires_prior_60_returns")
                            continue
                        closes = [row["close"] for row in available[-61:]]
                        # Splits available before allocation must not masquerade
                        # as historical volatility.
                        dates = [row["session"] for row in available[-61:]]
                        for action in actions:
                            if action.get("type") == "split" and action.get("exDate", "9999") <= day and number(action.get("ratio")):
                                closes = [value / action["ratio"] if date < action["exDate"] else value for date, value in zip(dates, closes)]
                        rets = [closes[i] / closes[i - 1] - 1 for i in range(1, len(closes))]
                        mean = sum(rets) / len(rets)
                        vol = math.sqrt(sum((item - mean) ** 2 for item in rets) / (len(rets) - 1) * 252)
                        weight = min(.8, .08 / vol) if vol > 0 else .8
                    limit = quote["ask"] * 1.001
                    pending = {"side": "buy", "at": quote["at"], "limit": limit, "qty": math.floor(2000 * weight / (limit * 1.0005))}
            if active_day:
                curve.append({"session": active_day, "equity": marked_equity()})
            if (name != "cash" and not bought) or [row["session"] for row in curve] != sessions:
                issues.append("benchmark_execution_or_session_coverage_incomplete")
            result[name]["equityCurve"].extend(curve)
            result[name]["issues"].extend(sorted(set(issues)))
    result["spyRiskBudget"]["riskDefinition"] = "8pct annualized volatility from preceding 60 sessions, allocation capped at 80pct, frozen per fold"
    return result


def run_research(dataset, protocol, *, archive_root=None):
    if not protocol_valid(protocol):
        raise ValueError("frozen_protocol_tampered_or_incompatible")
    periods = protocol["periods"]
    test_sessions = [day for day in dataset.get("sessions", []) if periods["holdoutStart"] <= day <= periods["holdoutEnd"]]
    if len(test_sessions) < 3:
        raise ValueError("insufficient_holdout_sessions")
    folds = []
    for i in range(3):
        part = test_sessions[i * len(test_sessions) // 3:(i + 1) * len(test_sessions) // 3]
        folds.append({"tradeStart": part[0], "tradeEnd": part[-1]})
    trials = []
    for strategy in protocol["registeredTrials"]:
        runs, stress_runs = [], []
        for fold in folds:
            config = {**protocol["config"], **fold, "strategy": strategy, "mode": "historical", "executionFeed": "sip", "liquidateEnd": False, **({"archiveRoot": str(archive_root)} if archive_root else {})}
            runs.append(replay_portfolio(dataset, config))
            stress_runs.append(replay_portfolio(dataset, {**config, "costMultiplier": 2}))
        trials.append({"strategy": strategy, "folds": runs, "stressFolds": stress_runs})
    artifact = {"researchVersion": RESEARCH_VERSION, "strategyVersion": EQUITY_STRATEGY_VERSION, "dataVersion": EQUITY_DATA_VERSION,
                "costVersion": COST_VERSION, "protocol": deepcopy(protocol), "dataHash": dataset.get("dataHash"),
                "dataValidationErrors": validate_dataset(dataset), "folds": folds, "trials": trials,
                "benchmarkEvidence": _benchmark_evidence(dataset, folds, protocol, archive_root), "completedAt": datetime.now(timezone.utc).isoformat()}
    artifact["artifactHash"] = content_hash(artifact)
    artifact["admission"] = evaluate_admission(artifact)
    return artifact


def evaluate_admission(artifact, forward=None):
    blockers, checks = [], {}
    if not isinstance(artifact, dict):
        return {"eligible": False, "historicalEligible": False, "blockers": ["trusted_research_artifact_missing"], "checks": {}}
    hashed = {k: v for k, v in artifact.items() if k not in ("artifactHash", "admission")}
    if artifact.get("artifactHash") != content_hash(hashed) or not protocol_valid(artifact.get("protocol")):
        return {"eligible": False, "historicalEligible": False, "blockers": ["research_artifact_integrity_failed"], "checks": {}}
    protocol = artifact["protocol"]
    trials = artifact.get("trials") or []
    checks["allRegisteredTrialsReported"] = [trial.get("strategy") for trial in trials] == protocol["registeredTrials"]
    trial = next((row for row in trials if row.get("strategy") == protocol["strategy"]), {})
    folds, stress = trial.get("folds") or [], trial.get("stressFolds") or []
    fold_ranges = [(row.get("config", {}).get("tradeStart", ""), row.get("config", {}).get("tradeEnd", "")) for row in folds]
    checks["threeNonoverlappingOosFolds"] = len(folds) >= 3 and all(a <= b for a, b in fold_ranges) and all(fold_ranges[i - 1][1] < fold_ranges[i][0] for i in range(1, len(fold_ranges)))
    period = protocol["periods"]
    checks["twentyFourMonthsOos"] = (datetime.fromisoformat(period["holdoutEnd"]) - datetime.fromisoformat(period["holdoutStart"])).days >= 730
    diagnostics = artifact.get("dataValidationErrors", []) + [error for row in folds + stress for error in row.get("diagnostics", [])]
    checks["completeVerifiedData"] = not diagnostics
    closed = [trade for row in folds for trade in row.get("trades", [])]
    wins = sum(max(0, number(row.get("netPnl")) or 0) for row in closed)
    losses = -sum(min(0, number(row.get("netPnl")) or 0) for row in closed)
    checks["oneHundredClosedTrades"] = len(closed) >= 100
    checks["profitFactorAtLeast1_2"] = losses > 0 and wins / losses >= 1.2
    # Recompute portfolio economics from equity, never caller-provided metrics.
    returns, fold_profits, dd = [], [], 0.0
    for row in folds:
        high, previous = 2000.0, 2000.0
        curve = row.get("equityCurve") or []
        for point in curve:
            value = number(point.get("equity"))
            if value is None or value <= 0:
                diagnostics.append("invalid_equity_evidence")
                continue
            high = max(high, value)
            dd = max(dd, (high - value) / high)
            returns.append(value / previous - 1)
            previous = value
        fold_profits.append(previous - 2000)
    checks["positiveAfterOperatingCosts"] = bool(fold_profits) and sum(fold_profits) > 0
    chained, chain_peak = 1.0, 1.0
    for value in returns:
        chained *= 1 + value
        chain_peak = max(chain_peak, chained)
        dd = max(dd, (chain_peak - chained) / chain_peak)
    checks["maxDrawdownAtMost12Pct"] = bool(folds) and dd <= .12
    checks["doubleCostStressPositive"] = len(stress) == len(folds) and bool(stress) and sum((row.get("equityCurve") or [{"equity": 2000}])[-1]["equity"] - 2000 for row in stress) > 0
    stress_trades = [trade for row in stress for trade in row.get("trades", [])]
    stress_wins = sum(max(0, number(row.get("netPnl")) or 0) for row in stress_trades)
    stress_losses = -sum(min(0, number(row.get("netPnl")) or 0) for row in stress_trades)
    checks["doubleCostStressProfitFactorAbove1"] = stress_losses > 0 and stress_wins / stress_losses > 1
    lower = block_bootstrap_lower(returns, trials=len(protocol["registeredTrials"]))
    checks["familywiseBlockBootstrapLowerPositive"] = lower is not None and lower > 0
    # Benchmark execution/corporate-action evidence must be generated/audited by
    # the research service; a bare submitted pass flag is never evidence.
    benchmark = artifact.get("benchmarkEvidence") or {}
    required = ("cash", "spyBuyHold", "spyRiskBudget")
    checks["cashAndSpyBenchmarksVerified"] = all(isinstance(benchmark.get(key), dict) and not benchmark[key].get("issues") and benchmark[key].get("sourceDataHash") == artifact.get("dataHash") and isinstance(benchmark[key].get("equityCurve"), list) and len(benchmark[key]["equityCurve"]) >= len(returns) for key in required)
    if checks["cashAndSpyBenchmarksVerified"]:
        final_sessions = {end for _start, end in fold_ranges}
        benchmark_return = math.prod(point["equity"] / 2000 for point in benchmark["spyRiskBudget"]["equityCurve"] if point["session"] in final_sessions) - 1
        strategy_return = math.prod(1 + value for value in returns) - 1
        checks["beatsCashAndRiskBudgetSpy"] = strategy_return > max(0, benchmark_return)
    else:
        checks["beatsCashAndRiskBudgetSpy"] = False
    checks["completeVerifiedData"] = not diagnostics
    blockers.extend(key for key, passed in checks.items() if not passed)
    historical = not blockers
    forward = forward or {}
    from equity_qualification import qualification_identity, forward_coverage_errors
    qualified = parse_time(artifact.get("completedAt"))
    as_of = parse_time(forward.get("asOf"))
    qualified_day = qualified.astimezone(NEW_YORK).date().isoformat() if qualified else "9999"
    today = as_of.astimezone(NEW_YORK).date().isoformat() if as_of else "0000"
    forward_dataset = forward.get("dataset")
    expected_identity = qualification_identity(artifact, forward_dataset) if isinstance(forward_dataset, dict) else None
    checks["forwardCohortIdentityVerified"] = bool(expected_identity) and forward.get("qualification") == expected_identity and forward.get("protocolHash") == protocol["protocolHash"] and forward.get("strategyVersion") == EQUITY_STRATEGY_VERSION and forward.get("dataVersion") == EQUITY_DATA_VERSION and forward.get("frozenAt") == protocol["frozenAt"] and (forward.get("config") or {}).get("tradeStart") == expected_identity["tradeStart"] and (forward.get("config") or {}).get("qualificationKey") == expected_identity["qualificationKey"]
    checks["forwardDatasetIntegrityVerified"] = isinstance(forward_dataset, dict) and forward.get("dataHash") == forward_dataset.get("dataHash") == dataset_hash(forward_dataset)
    forward_issues = forward_coverage_errors(forward)
    checks["forwardDataComplete"] = bool(forward) and not forward_issues
    checks["forwardRiskLimitsRespected"] = bool(forward.get("state")) and forward["state"].get("riskPaused") is not True and number((forward.get("metrics") or {}).get("maxDrawdownPct")) is not None and forward["metrics"]["maxDrawdownPct"] <= 12
    audited_days = set((forward.get("forwardAudit") or {}).get("auditedSessions") or [])
    forward_sessions = {point.get("session") for point in forward.get("equityCurve", []) if point.get("session") in audited_days and qualified_day < point["session"] < today}
    started = parse_time((forward.get("qualification") or {}).get("startedAt"))
    forward_trades = [row for row in forward.get("trades", []) if parse_time(row.get("entryTime")) and started and parse_time(row["entryTime"]) >= started and parse_time(row.get("exitTime")) and as_of and parse_time(row["exitTime"]) <= as_of and parse_time(row["exitTime"]).astimezone(NEW_YORK).date().isoformat() in audited_days]
    checks["sixtyForwardSessions"] = len(forward_sessions) >= 60
    checks["thirtyForwardClosedTrades"] = len(forward_trades) >= 30
    qualified_curve = [point for point in forward.get("equityCurve", []) if point.get("session") in forward_sessions]
    checks["forwardNetPositive"] = len(qualified_curve) > 1 and qualified_curve[-1].get("equity", 0) > 2000
    blockers.extend(key for key in ("forwardCohortIdentityVerified", "forwardDatasetIntegrityVerified", "forwardDataComplete", "forwardRiskLimitsRespected", "sixtyForwardSessions", "thirtyForwardClosedTrades", "forwardNetPositive") if not checks[key])
    return {"eligible": not blockers, "historicalEligible": historical, "blockers": blockers, "checks": checks,
            "closedTrades": len(closed), "profitFactor": wins / losses if losses else None, "bootstrapLowerDailyMean": lower,
            "dataIssues": sorted(set(diagnostics)), "forwardIssues": forward_issues,
            "forwardSessions": len(forward_sessions), "forwardClosedTrades": len(forward_trades), "strategyVersion": EQUITY_STRATEGY_VERSION}


def _write_exclusive(path, payload):
    with Path(path).open("x", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, allow_nan=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    freeze = sub.add_parser("freeze")
    freeze.add_argument("--protocol", required=True)
    freeze.add_argument("--strategy", choices=REGISTERED_TRIALS, default="breakout20")
    freeze.add_argument("--start", required=True)
    freeze.add_argument("--end", required=True)
    freeze.add_argument("--holdout-start", required=True)
    freeze.add_argument("--holdout-end", required=True)
    freeze.add_argument("--monthly-operating-cost", type=float, default=0)
    run = sub.add_parser("run")
    run.add_argument("--protocol", required=True)
    run.add_argument("--dataset", required=True)
    run.add_argument("--output", required=True)
    run.add_argument("--archive-root", help="Directory of checksum-verified SIP page archives")
    args = parser.parse_args()
    if args.command == "freeze":
        _write_exclusive(args.protocol, make_protocol(args.strategy, periods={"start": args.start, "end": args.end, "holdoutStart": args.holdout_start, "holdoutEnd": args.holdout_end, "monthlyOperatingCost": args.monthly_operating_cost}))
    else:
        protocol = json.loads(Path(args.protocol).read_text())
        dataset = json.loads(Path(args.dataset).read_text())
        if not protocol_valid(protocol) or dataset.get("dataHash") != dataset_hash(dataset):
            raise ValueError("input_integrity_failed")
        # Exclusive read marker records the first holdout opening, including a
        # failed run; tuning and silently reusing the holdout is not permitted.
        _write_exclusive(args.protocol + ".opened.json", {"protocolHash": protocol["protocolHash"], "dataHash": dataset["dataHash"], "openedAt": datetime.now(timezone.utc).isoformat()})
        _write_exclusive(args.output, run_research(dataset, protocol, archive_root=args.archive_root))


if __name__ == "__main__":
    main()
