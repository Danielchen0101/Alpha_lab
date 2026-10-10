"""Fixed, causal stock signals shared by research and order planning.

Daily bars must represent completed regular trading sessions. No broker or
network clients are created here. Percentages and risk limits live in the
execution policy; this module defines the immutable v1 signal/exit rules.
"""
from datetime import datetime, time, timezone
from math import isfinite
from decimal import Decimal, ROUND_CEILING
from zoneinfo import ZoneInfo

EQUITY_STRATEGY_VERSION = "equity_fixed_v1"
STRATEGIES = ("breakout20", "pullback20")
NEW_YORK = ZoneInfo("America/New_York")


def number(value):
    try:
        result = float(value)
        return result if isfinite(result) else None
    except (TypeError, ValueError, OverflowError):
        return None


def entry_price_levels(ask, atr, slippage_bps=10, cost_multiplier=1):
    """The same cent-exact limit and attached OTO stop in replay and routing."""
    values = [number(value) for value in (ask, atr, slippage_bps, cost_multiplier)]
    if any(value is None for value in values) or values[0] <= 0 or values[1] <= 0 or values[2] < 0 or values[3] not in (1, 2):
        raise ValueError("invalid_entry_price_inputs")
    cent = Decimal("0.01")
    limit = (Decimal(str(ask)) * (1 + Decimal(str(slippage_bps)) * Decimal(str(cost_multiplier)) / 10000)).quantize(cent, rounding=ROUND_CEILING)
    risk = (2 * Decimal(str(atr))).quantize(cent, rounding=ROUND_CEILING)
    stop = limit - risk
    if stop <= 0:
        raise ValueError("entry_stop_not_positive")
    return {"limitPrice": float(limit), "initialRiskPerShare": float(risk), "stopPrice": float(stop)}


def parse_time(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def session_date(bar):
    value = bar.get("session") or bar.get("date") or bar.get("timestamp") or bar.get("t")
    try:
        return datetime.fromisoformat(str(value)[:10]).date().isoformat()
    except (ValueError, TypeError):
        return None


def completed_at(bar):
    explicit = bar.get("availableAt") or bar.get("completedAt")
    if explicit is not None:
        return parse_time(explicit)
    date = session_date(bar)
    return datetime.combine(datetime.fromisoformat(date).date(), time(16), NEW_YORK).astimezone(timezone.utc) if date else None


def normalize_daily_bars(bars, as_of=None):
    """Reject malformed/duplicate/unordered bars; never silently repair OHLC."""
    cutoff = parse_time(as_of) if as_of is not None else None
    if as_of is not None and cutoff is None:
        return [], ["invalid_as_of"]
    result, previous = [], None
    for raw in bars or []:
        if not isinstance(raw, dict):
            return [], ["invalid_bar"]
        date, available = session_date(raw), completed_at(raw)
        if not date or not available or (previous is not None and date <= previous):
            return [], ["unordered_or_invalid_sessions"]
        previous = date
        if raw.get("complete") is False or (cutoff is not None and available > cutoff):
            continue
        values = {key: number(raw.get(key, raw.get(short))) for key, short in (("open", "o"), ("high", "h"), ("low", "l"), ("close", "c"), ("volume", "v"))}
        if any(values[key] is None or values[key] <= 0 for key in ("open", "high", "low", "close")):
            return [], ["invalid_ohlc"]
        if values["high"] < max(values["open"], values["close"], values["low"]) or values["low"] > min(values["open"], values["close"]):
            return [], ["invalid_ohlc_range"]
        result.append({**values, "session": date, "availableAt": available.isoformat()})
    return result, []


def atr14(bars):
    """Wilder ATR, seeded by the first 14 true ranges with a prior close."""
    if len(bars) < 15:
        return None
    ranges = [max(bar["high"] - bar["low"], abs(bar["high"] - bars[i - 1]["close"]), abs(bar["low"] - bars[i - 1]["close"])) for i, bar in enumerate(bars) if i]
    value = sum(ranges[:14]) / 14.0
    for item in ranges[14:]:
        value = (13.0 * value + item) / 14.0
    return value


def evaluate_daily_signal(bars, strategy="breakout20", as_of=None):
    result = {"strategyVersion": EQUITY_STRATEGY_VERSION, "strategy": strategy, "eligible": False, "action": "HOLD", "blockers": []}
    if strategy not in STRATEGIES:
        return {**result, "blockers": ["unsupported_fixed_strategy"]}
    rows, errors = normalize_daily_bars(bars, as_of)
    if errors or len(rows) < 200:
        return {**result, "blockers": errors or ["requires_200_completed_sessions"]}
    closes = [row["close"] for row in rows]
    sma = lambda period, end=len(rows): sum(closes[end - period:end]) / period
    close, atr = closes[-1], atr14(rows)
    result.update({"signalAt": rows[-1]["availableAt"], "session": rows[-1]["session"], "close": close, "atr14": atr, "sma20": sma(20), "sma50": sma(50), "sma200": sma(200), "initialRiskPerShare": 2.0 * atr if atr else None, "initialStop": close - 2.0 * atr if atr else None, "timeStopSessions": 20, "partialExitsAllowed": False})
    if not atr or close - 2.0 * atr <= 0:
        return {**result, "blockers": ["invalid_atr_risk"]}
    if not close > sma(50) > sma(200):
        return {**result, "blockers": ["uptrend_required"]}
    if strategy == "breakout20":
        trigger = max(row["high"] for row in rows[-21:-1])
        result["triggerPrice"] = trigger
        triggered = close > trigger
    else:
        # The consecutive pullback must end yesterday. A sixth below-average
        # session, or a pullback without a complete trend history, is ineligible.
        below = 0
        for end in range(len(rows) - 1, max(0, len(rows) - 7), -1):
            if end < 200 or closes[end - 1] >= sma(20, end):
                break
            if not closes[end - 1] > sma(50, end) > sma(200, end):
                return {**result, "blockers": ["pullback_left_uptrend"]}
            below += 1
        result["pullbackSessions"] = below
        result["triggerPrice"] = sma(20)
        triggered = 1 <= below <= 5 and close > sma(20)
    result.update({"eligible": triggered, "action": "BUY" if triggered else "HOLD", "blockers": [] if triggered else ["no_fixed_v1_trigger"]})
    return result


def position_exit_decision(position, completed_bars, current_bid=None):
    """Whole-position protection; trailing changes use completed closes only.

    Call before the next quote to activate a newly computed stop. Never use a
    session's eventual high/low to fabricate an earlier stop execution.
    """
    rows, errors = normalize_daily_bars(completed_bars)
    entry = number(position.get("entryPrice"))
    initial_risk = number(position.get("initialRiskPerShare"))
    stop = number(position.get("stopPrice", position.get("initialStop")))
    entry_session = position.get("entrySession")
    if errors or entry is None or initial_risk is None or stop is None or not entry_session or min(entry, initial_risk, stop) <= 0:
        return {"exit": False, "reason": "invalid_position_protection", "blockers": errors or ["invalid_position_protection"]}
    entry_time = parse_time(position.get("entryTimestamp"))
    held = [bar for bar in rows if bar["session"] >= entry_session and (entry_time is None or parse_time(bar["availableAt"]) > entry_time)]
    high_close = max([entry] + [row["close"] for row in held])
    active = bool(position.get("trailActive")) or high_close >= entry + initial_risk
    atr = atr14(rows)
    if active and atr is not None:
        stop = max(stop, high_close - 2.0 * atr)
    bid = number(current_bid)
    stopped = bid is not None and bid > 0 and bid <= stop
    timed = len(held) >= 20
    return {"exit": stopped or timed, "reason": "STOP" if stopped else "TIME_STOP" if timed else "HOLD", "stopPrice": stop, "trailActive": active, "sessionsHeld": len(held), "partialExitsAllowed": False, "blockers": []}
