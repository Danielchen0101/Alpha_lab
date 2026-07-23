"""Pure-Python crypto research and risk engine.

The engine deliberately has no broker, database, web-framework, NumPy, or
Pandas dependency.  It is therefore safe to reuse in request handlers,
background workers, backtests, and unit tests without creating hidden state.

The first strategy is an explainable spot model for BTC/USD and ETH/USD.  It
supports both hourly allocation and 15-minute quick-trading cadences.  Signals
are formed at the close of a complete bar and backtests fill them at the
*next* bar's open.  That timing contract is important: it prevents the most
common form of look-ahead bias in lightweight strategy prototypes.
"""

from __future__ import annotations

import copy
import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


ALGORITHM_NAME = "Adaptive Trend Allocation"
ALGORITHM_VERSION = "1.3.0"
SUPPORTED_SYMBOLS: Tuple[str, ...] = ("BTC/USD", "ETH/USD")
BAR_INTERVAL_SECONDS = 60 * 60
SUPPORTED_BARS_PER_DAY = frozenset({24, 96})
SEVEN_DAY_COOLDOWN_HOURS = 72


DEFAULT_CONFIG: Dict[str, Any] = {
    "symbols": list(SUPPORTED_SYMBOLS),
    "bars_per_day": 24,
    "ema_fast": 10,
    "ema_slow": 40,
    "momentum_fast_days": 20,
    "momentum_slow_days": 65,
    "atr_hours": 24,
    "volatility_days": 30,
    "breakout_days": 20,
    "breakdown_days": 10,
    "entry_confirmation_bars": 2,
    "exit_confirmation_bars": 2,
    "entry_score": 60.0,
    "add_score": 80.0,
    "reduce_score": 40.0,
    "max_asset_weight": 0.20,
    # Position changes are deliberately sparse.  A held position is not
    # resized merely because the volatility estimate changes by a few basis
    # points; adds need both a fresh breakout and a meaningful price advance.
    "rebalance_band": 0.02,
    "add_min_price_gain_pct": 0.03,
    "reduced_weight_fraction": 0.25,
    "annual_volatility_target": 0.15,
    "high_volatility_threshold": 1.00,
    "stop_atr_multiple": 2.5,
    "min_stop_distance_pct": 0.02,
    "max_stop_distance_pct": 0.12,
    # Alpaca's first crypto fee tier currently charges up to 25 bps taker.
    # The engine defaults to taker-like costs instead of optimistic maker fees.
    "fee_bps": 25.0,
    "slippage_bps": 5.0,
    "daily_loss_limit": 0.015,
    "seven_day_loss_limit": 0.04,
    "max_drawdown_limit": 0.08,
    "data_stale_minutes": 90,
}


class CryptoEngineError(ValueError):
    """Raised for invalid strategy configuration or market data."""


def _finite_number(value: Any, name: str, *, positive: bool = False) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise CryptoEngineError(f"{name} must be a number") from exc
    if not math.isfinite(number):
        raise CryptoEngineError(f"{name} must be finite")
    if positive and number <= 0:
        raise CryptoEngineError(f"{name} must be greater than zero")
    return number


def validate_config(config: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    """Return a validated, fully populated strategy configuration.

    Unknown fields are rejected so a misspelled safety setting cannot silently
    fall back to a default value.
    """

    resolved = copy.deepcopy(DEFAULT_CONFIG)
    if config is not None:
        if not isinstance(config, Mapping):
            raise CryptoEngineError("config must be an object")
        unknown = sorted(set(config) - set(DEFAULT_CONFIG))
        if unknown:
            raise CryptoEngineError(f"unknown config fields: {', '.join(unknown)}")
        resolved.update(copy.deepcopy(dict(config)))

    symbols = resolved.get("symbols")
    if not isinstance(symbols, (list, tuple)) or not symbols:
        raise CryptoEngineError("symbols must be a non-empty list")
    normalized_symbols = []
    for value in symbols:
        symbol = str(value).strip().upper()
        if symbol not in SUPPORTED_SYMBOLS:
            raise CryptoEngineError(f"unsupported spot symbol: {symbol}")
        if symbol not in normalized_symbols:
            normalized_symbols.append(symbol)
    resolved["symbols"] = normalized_symbols

    integer_fields = (
        "bars_per_day",
        "ema_fast",
        "ema_slow",
        "momentum_fast_days",
        "momentum_slow_days",
        "atr_hours",
        "volatility_days",
        "breakout_days",
        "breakdown_days",
        "entry_confirmation_bars",
        "exit_confirmation_bars",
        "data_stale_minutes",
    )
    for field in integer_fields:
        raw = _finite_number(resolved[field], field, positive=True)
        if int(raw) != raw:
            raise CryptoEngineError(f"{field} must be a whole number")
        resolved[field] = int(raw)

    if resolved["bars_per_day"] not in SUPPORTED_BARS_PER_DAY:
        raise CryptoEngineError("bars_per_day must be 24 or 96 for contiguous crypto bars")

    number_fields = (
        "entry_score",
        "add_score",
        "reduce_score",
        "max_asset_weight",
        "rebalance_band",
        "add_min_price_gain_pct",
        "reduced_weight_fraction",
        "annual_volatility_target",
        "high_volatility_threshold",
        "stop_atr_multiple",
        "min_stop_distance_pct",
        "max_stop_distance_pct",
        "fee_bps",
        "slippage_bps",
        "daily_loss_limit",
        "seven_day_loss_limit",
        "max_drawdown_limit",
    )
    for field in number_fields:
        resolved[field] = _finite_number(resolved[field], field)

    if resolved["ema_fast"] >= resolved["ema_slow"]:
        raise CryptoEngineError("ema_fast must be below ema_slow")
    if resolved["momentum_fast_days"] >= resolved["momentum_slow_days"]:
        raise CryptoEngineError("momentum_fast_days must be below momentum_slow_days")
    if not 0 <= resolved["reduce_score"] <= resolved["entry_score"] <= resolved["add_score"] <= 100:
        raise CryptoEngineError("score thresholds must satisfy 0 <= reduce <= entry <= add <= 100")
    for field in (
        "max_asset_weight",
        "rebalance_band",
        "add_min_price_gain_pct",
        "reduced_weight_fraction",
        "daily_loss_limit",
        "seven_day_loss_limit",
        "max_drawdown_limit",
    ):
        if not 0 < resolved[field] <= 1:
            raise CryptoEngineError(f"{field} must be in (0, 1]")
    if resolved["rebalance_band"] >= resolved["max_asset_weight"]:
        raise CryptoEngineError("rebalance_band must be below max_asset_weight")
    for field in (
        "annual_volatility_target",
        "high_volatility_threshold",
        "stop_atr_multiple",
        "min_stop_distance_pct",
        "max_stop_distance_pct",
    ):
        if resolved[field] <= 0:
            raise CryptoEngineError(f"{field} must be greater than zero")
    if resolved["annual_volatility_target"] > resolved["high_volatility_threshold"]:
        raise CryptoEngineError("annual_volatility_target cannot exceed high_volatility_threshold")
    if resolved["min_stop_distance_pct"] > resolved["max_stop_distance_pct"]:
        raise CryptoEngineError("min_stop_distance_pct cannot exceed max_stop_distance_pct")
    if resolved["max_stop_distance_pct"] >= 1:
        raise CryptoEngineError("max_stop_distance_pct must be below one")
    if not 0 <= resolved["fee_bps"] < 10_000 or not 0 <= resolved["slippage_bps"] < 10_000:
        raise CryptoEngineError("fee_bps and slippage_bps must be in [0, 10000)")
    return resolved


def required_history_bars(config: Optional[Mapping[str, Any]] = None) -> int:
    cfg = validate_config(config)
    per_day = cfg["bars_per_day"]
    return max(
        cfg["ema_slow"],
        cfg["momentum_slow_days"] * per_day + 1,
        cfg["volatility_days"] * per_day + 1,
        cfg["breakout_days"] * per_day + 1,
        cfg["breakdown_days"] * per_day + 1,
        cfg["atr_hours"] + 1,
    )


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)) and math.isfinite(float(value)):
        numeric = float(value)
        # Alpaca and JavaScript clients may use either seconds or milliseconds.
        if abs(numeric) > 100_000_000_000:
            numeric /= 1000.0
        parsed = datetime.fromtimestamp(numeric, tz=timezone.utc)
    elif isinstance(value, str) and value.strip():
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError as exc:
            raise CryptoEngineError(f"invalid bar timestamp: {value}") from exc
    else:
        raise CryptoEngineError("each bar requires a timestamp")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_bars(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Validate contiguous hourly OHLCV bars in ascending timestamp order.

    Indicator lookbacks are expressed in elapsed hours and days.  Silently
    accepting a missing or sub-hourly observation would turn those lookbacks
    into a different strategy, so discontinuities fail closed.
    """

    cfg = validate_config(config)
    expected_interval_seconds = int(24 * 60 * 60 / cfg["bars_per_day"])
    if isinstance(bars, (str, bytes, Mapping)):
        raise CryptoEngineError("bars must be a sequence of objects")
    result: List[Dict[str, Any]] = []
    previous_time: Optional[datetime] = None
    aliases = {
        "open": ("open", "o"),
        "high": ("high", "h"),
        "low": ("low", "l"),
        "close": ("close", "c"),
        "volume": ("volume", "v"),
    }
    for index, raw in enumerate(bars):
        if not isinstance(raw, Mapping):
            raise CryptoEngineError(f"bar {index} must be an object")
        timestamp_value = raw.get("timestamp", raw.get("time", raw.get("t")))
        timestamp = _parse_timestamp(timestamp_value)
        if previous_time is not None and timestamp <= previous_time:
            raise CryptoEngineError("bars must be strictly ascending with no duplicate timestamps")
        if previous_time is not None:
            interval_seconds = (timestamp - previous_time).total_seconds()
            if interval_seconds != expected_interval_seconds:
                raise CryptoEngineError(
                    "bars must be contiguous strategy intervals "
                    f"(bar {index} is {interval_seconds:g} seconds after the prior bar)"
                )
        previous_time = timestamp
        row: Dict[str, Any] = {"timestamp": timestamp}
        for canonical, choices in aliases.items():
            value = None
            for choice in choices:
                if choice in raw:
                    value = raw[choice]
                    break
            row[canonical] = _finite_number(value, f"bar {index} {canonical}")
        if row["open"] <= 0 or row["high"] <= 0 or row["low"] <= 0 or row["close"] <= 0:
            raise CryptoEngineError(f"bar {index} prices must be positive")
        if row["volume"] < 0:
            raise CryptoEngineError(f"bar {index} volume cannot be negative")
        if row["high"] < max(row["open"], row["close"], row["low"]):
            raise CryptoEngineError(f"bar {index} high is inconsistent with OHLC")
        if row["low"] > min(row["open"], row["close"], row["high"]):
            raise CryptoEngineError(f"bar {index} low is inconsistent with OHLC")
        result.append(row)
    if not result:
        raise CryptoEngineError("bars cannot be empty")
    return result


def _mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _sample_stdev(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = _mean(values)
    return math.sqrt(sum((value - mean) ** 2 for value in values) / (len(values) - 1))


def compute_indicators(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Compute causal hourly indicators.

    Breakout and breakdown reference levels intentionally exclude the current
    bar.  Every row therefore depends only on information available by that
    row's close.
    """

    cfg = validate_config(config)
    normalized = normalize_bars(bars, cfg)
    per_day = cfg["bars_per_day"]
    momentum_fast_window = cfg["momentum_fast_days"] * per_day
    momentum_slow_window = cfg["momentum_slow_days"] * per_day
    volatility_window = cfg["volatility_days"] * per_day
    breakout_window = cfg["breakout_days"] * per_day
    breakdown_window = cfg["breakdown_days"] * per_day
    atr_window = cfg["atr_hours"]
    annualization = math.sqrt(365 * per_day)

    alpha_fast = 2.0 / (cfg["ema_fast"] + 1.0)
    alpha_slow = 2.0 / (cfg["ema_slow"] + 1.0)
    ema_fast: Optional[float] = None
    ema_slow: Optional[float] = None
    closes: List[float] = []
    highs: List[float] = []
    lows: List[float] = []
    log_returns: List[float] = []
    true_ranges: List[float] = []
    output: List[Dict[str, Any]] = []

    for index, bar in enumerate(normalized):
        close = bar["close"]
        ema_fast = close if ema_fast is None else alpha_fast * close + (1 - alpha_fast) * ema_fast
        ema_slow = close if ema_slow is None else alpha_slow * close + (1 - alpha_slow) * ema_slow
        previous_close = closes[-1] if closes else close
        true_range = max(
            bar["high"] - bar["low"],
            abs(bar["high"] - previous_close),
            abs(bar["low"] - previous_close),
        )
        true_ranges.append(true_range)
        if closes:
            log_returns.append(math.log(close / closes[-1]))

        high_20d = max(highs[index - breakout_window : index]) if index >= breakout_window else None
        low_10d = min(lows[index - breakdown_window : index]) if index >= breakdown_window else None
        momentum_20d = close / closes[index - momentum_fast_window] - 1 if index >= momentum_fast_window else None
        momentum_65d = close / closes[index - momentum_slow_window] - 1 if index >= momentum_slow_window else None
        atr_24h = _mean(true_ranges[-atr_window:]) if len(true_ranges) >= atr_window else None
        if len(log_returns) >= volatility_window:
            annualized_volatility_30d = _sample_stdev(log_returns[-volatility_window:]) * annualization
        else:
            annualized_volatility_30d = None

        output.append(
            {
                **bar,
                "ema_10": ema_fast if index + 1 >= cfg["ema_fast"] else None,
                "ema_40": ema_slow if index + 1 >= cfg["ema_slow"] else None,
                "momentum_20d": momentum_20d,
                "momentum_65d": momentum_65d,
                "atr_24h": atr_24h,
                "annualized_volatility_30d": annualized_volatility_30d,
                "high_20d": high_20d,
                "low_10d": low_10d,
                "breakout_20d": high_20d is not None and close > high_20d,
                "breakdown_10d": low_10d is not None and close < low_10d,
            }
        )
        closes.append(close)
        highs.append(bar["high"])
        lows.append(bar["low"])
    return output


def _utc_now(now: Optional[Any]) -> datetime:
    return datetime.now(timezone.utc) if now is None else _parse_timestamp(now)


def evaluate_risk_circuit(
    state: Optional[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    now: Optional[Any] = None,
) -> Dict[str, Any]:
    """Evaluate deterministic daily, seven-day, drawdown, and freshness gates.

    This function reports policy requirements but deliberately does not keep a
    clock or acknowledgement ledger.  The durable controller owns the start of
    a 72-hour cooldown and the explicit acknowledgement of a drawdown review.
    """

    cfg = validate_config(config)
    if state is not None and not isinstance(state, Mapping):
        raise CryptoEngineError("risk state must be an object")
    values = dict(state or {})
    daily_return = _finite_number(values.get("daily_return", 0.0), "daily_return")
    seven_day_return = _finite_number(values.get("seven_day_return", 0.0), "seven_day_return")
    drawdown = _finite_number(values.get("drawdown", 0.0), "drawdown")
    # Accept either a negative return convention or a positive drawdown depth.
    drawdown_depth = abs(min(drawdown, 0.0)) if drawdown <= 0 else drawdown
    triggers: List[Dict[str, Any]] = []

    if daily_return <= -cfg["daily_loss_limit"]:
        triggers.append({"code": "daily_loss", "observed": daily_return, "limit": -cfg["daily_loss_limit"]})
    if seven_day_return <= -cfg["seven_day_loss_limit"]:
        triggers.append({"code": "seven_day_loss", "observed": seven_day_return, "limit": -cfg["seven_day_loss_limit"]})
    if drawdown_depth >= cfg["max_drawdown_limit"]:
        triggers.append({"code": "max_drawdown", "observed": drawdown_depth, "limit": cfg["max_drawdown_limit"]})

    stale = False
    stale_minutes: Optional[float] = None
    if values.get("last_bar_time") is not None:
        last_bar_time = _parse_timestamp(values["last_bar_time"])
        stale_minutes = max(0.0, (_utc_now(now) - last_bar_time).total_seconds() / 60.0)
        stale = stale_minutes > cfg["data_stale_minutes"]
    elif values.get("require_fresh_data", False):
        stale = True
    if stale:
        triggers.append(
            {
                "code": "data_stale",
                "observed_minutes": stale_minutes,
                "limit_minutes": cfg["data_stale_minutes"],
            }
        )

    codes = [item["code"] for item in triggers]
    cooldown_required = "seven_day_loss" in codes
    manual_review_required = "max_drawdown" in codes
    return {
        "blocked": bool(triggers),
        "entry_blocked": bool(triggers),
        # Daily loss and a seven-day cooldown block fresh risk but do not
        # liquidate an otherwise valid holding.  A max-drawdown breach is the
        # sole performance circuit that requires an immediate exit.
        "exit_required": manual_review_required,
        "cooldown_required": cooldown_required,
        "cooldown_hours": SEVEN_DAY_COOLDOWN_HOURS if cooldown_required else 0,
        "cooldown_active": cooldown_required,
        "cooldown_remaining_bars": (
            SEVEN_DAY_COOLDOWN_HOURS if cooldown_required else 0
        ),
        "manual_review_required": manual_review_required,
        "data_stale": stale,
        "triggers": triggers,
        "allowed_actions": ["HOLD", "REDUCE", "EXIT"] if triggers else ["BUY", "ADD", "HOLD", "REDUCE", "EXIT"],
    }


def _position_values(
    position: Optional[Mapping[str, Any]],
) -> Tuple[float, Optional[float], Optional[float], Optional[float]]:
    if position is not None and not isinstance(position, Mapping):
        raise CryptoEngineError("position must be an object")
    values = dict(position or {})
    nested_state = values.get("position_state")
    if nested_state is not None and not isinstance(nested_state, Mapping):
        raise CryptoEngineError("position_state must be an object")
    if isinstance(nested_state, Mapping):
        for key, value in nested_state.items():
            values.setdefault(str(key), value)
    weight = _finite_number(values.get("weight", values.get("current_weight", 0.0)), "position weight")
    weight = max(0.0, min(1.0, weight))
    average_entry = values.get("average_entry_price")
    last_add = values.get("last_add_price", values.get("last_entry_price"))
    protective_stop = values.get("protective_stop", values.get("stop_price"))
    average_entry_value = _finite_number(average_entry, "average_entry_price", positive=True) if average_entry is not None else None
    last_add_value = _finite_number(last_add, "last_add_price", positive=True) if last_add is not None else None
    protective_stop_value = (
        _finite_number(protective_stop, "protective_stop", positive=True)
        if protective_stop is not None
        else None
    )
    if weight <= 1e-9:
        return weight, None, None, None
    return weight, average_entry_value, last_add_value, protective_stop_value


def apply_fill_to_position_state(
    state: Optional[Mapping[str, Any]],
    *,
    action: str,
    fill_price: Optional[Any] = None,
    stop_distance_pct: Optional[Any] = None,
    remaining_position: bool,
) -> Dict[str, Optional[float]]:
    """Apply one *confirmed* fill to the persistent strategy position state.

    Order acceptance is not a fill.  Callers must leave state unchanged for
    new, accepted, pending, rejected, or cancelled orders and invoke this
    helper only after reconciling an actual fill.  ``remaining_position`` is
    required so a partial REDUCE/EXIT cannot prematurely erase protection.
    """

    if not isinstance(remaining_position, bool):
        raise CryptoEngineError("remaining_position must be true or false")
    normalized_action = str(action or "").strip().upper()
    if normalized_action not in {"BUY", "ADD", "REDUCE", "EXIT"}:
        raise CryptoEngineError("filled action must be BUY, ADD, REDUCE, or EXIT")

    if state is not None and not isinstance(state, Mapping):
        raise CryptoEngineError("position state must be an object")
    values = dict(state or {})
    last_add_raw = values.get("last_add_price", values.get("last_entry_price"))
    stop_raw = values.get("protective_stop", values.get("stop_price"))
    last_add = (
        _finite_number(last_add_raw, "last_add_price", positive=True)
        if last_add_raw is not None
        else None
    )
    protective_stop = (
        _finite_number(stop_raw, "protective_stop", positive=True)
        if stop_raw is not None
        else None
    )

    if not remaining_position:
        return {"last_add_price": None, "protective_stop": None}

    if normalized_action in {"BUY", "ADD"}:
        price = _finite_number(fill_price, "fill_price", positive=True)
        distance = _finite_number(stop_distance_pct, "stop_distance_pct", positive=True)
        if distance >= 1:
            raise CryptoEngineError("stop_distance_pct must be below one")
        candidate_stop = price * (1.0 - distance)
        last_add = price
        # Adds can tighten the stop, but no state transition may widen it.
        protective_stop = max(protective_stop or 0.0, candidate_stop)

    return {
        "last_add_price": last_add,
        "protective_stop": protective_stop,
    }


def _signal_from_indicator(
    row: Mapping[str, Any],
    cfg: Mapping[str, Any],
    *,
    position: Optional[Mapping[str, Any]] = None,
    risk: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    current_weight, average_entry, last_add, persisted_stop = _position_values(position)
    persisted_last_add = (last_add or average_entry) if current_weight > 1e-9 else None
    required = (
        "ema_10",
        "ema_40",
        "momentum_20d",
        "momentum_65d",
        "atr_24h",
        "annualized_volatility_30d",
        "high_20d",
        "low_10d",
    )
    if any(row.get(field) is None for field in required):
        return {
            "algorithm": ALGORITHM_NAME,
            "version": ALGORITHM_VERSION,
            "timestamp": row["timestamp"].isoformat(),
            "price": row["close"],
            "action": "HOLD",
            "regime": "insufficient_data",
            "score": 0.0,
            "target_weight": current_weight,
            "stop_distance_pct": None,
            "reasons": ["Waiting for a complete 65-day hourly history."],
            "allowed_actions": ["HOLD", "REDUCE", "EXIT"] if current_weight > 0 else ["HOLD"],
            "position_state": {
                "last_add_price": persisted_last_add,
                "protective_stop": persisted_stop,
            },
            "evidence": {
                "entry_qualified": False,
                "negative_trend": False,
                "breakdown": False,
                "stop_triggered": False,
                "capital_exit": False,
            },
        }

    close = float(row["close"])
    ema_fast = float(row["ema_10"])
    ema_slow = float(row["ema_40"])
    momentum_fast = float(row["momentum_20d"])
    momentum_slow = float(row["momentum_65d"])
    volatility = float(row["annualized_volatility_30d"])
    score = 50.0
    reasons: List[str] = []

    if ema_fast > ema_slow:
        score += 15
        reasons.append("EMA10 is above EMA40.")
    else:
        score -= 15
        reasons.append("EMA10 is below EMA40.")
    if close > ema_fast:
        score += 10
        reasons.append("Price is above the fast trend filter.")
    else:
        score -= 10
        reasons.append("Price is below the fast trend filter.")
    if momentum_fast > 0:
        score += 20
        reasons.append("20-day momentum is positive.")
    else:
        score -= 15
        reasons.append("20-day momentum is negative.")
    if momentum_slow > 0:
        score += 20
        reasons.append("65-day momentum is positive.")
    else:
        score -= 20
        reasons.append("65-day momentum is negative.")
    if bool(row["breakout_20d"]):
        score += 20
        reasons.append("Price closed above the prior 20-day high.")
    elif close >= float(row["high_20d"]) * 0.97:
        score += 5
        reasons.append("Price is within 3% of the 20-day breakout level.")
    if bool(row["breakdown_10d"]):
        score -= 35
        reasons.append("Price closed below the prior 10-day low.")
    if volatility <= cfg["annual_volatility_target"] * 1.5:
        score += 10
        reasons.append("Realized volatility is inside the preferred risk band.")
    elif volatility >= cfg["high_volatility_threshold"]:
        score -= 20
        reasons.append("Realized volatility exceeds the high-volatility gate.")
    if float(row["volume"]) > 0:
        score += 5
    score = round(max(0.0, min(100.0, score)), 1)

    aligned = ema_fast > ema_slow and momentum_fast > 0 and momentum_slow > 0
    negative = ema_fast < ema_slow and momentum_fast < 0 and momentum_slow < 0
    if bool(row["breakdown_10d"]) or negative:
        regime = "risk_off"
    elif bool(row["breakout_20d"]) and aligned:
        regime = "breakout"
    elif aligned:
        regime = "trend"
    elif momentum_slow > 0:
        regime = "transition"
    else:
        regime = "defensive"

    atr_pct = float(row["atr_24h"]) / close
    stop_distance = max(
        cfg["min_stop_distance_pct"],
        min(cfg["max_stop_distance_pct"], atr_pct * cfg["stop_atr_multiple"]),
    )
    entry_qualified = aligned and regime in {"trend", "breakout"} and score >= cfg["entry_score"]
    if entry_qualified:
        volatility_scale = min(1.0, cfg["annual_volatility_target"] / max(volatility, 1e-9))
        conviction = max(0.35, score / 100.0)
        strategic_target = cfg["max_asset_weight"] * volatility_scale * conviction
    else:
        strategic_target = 0.0
    strategic_target = round(max(0.0, min(cfg["max_asset_weight"], strategic_target)), 6)

    risk_result = dict(risk or {})
    if persisted_stop is not None:
        stop_price = persisted_stop
    elif average_entry is not None:
        # Bootstrap legacy/broker-only positions once.  Once persisted, the
        # stop is not recomputed from a changing ATR and therefore cannot
        # widen between live cycles.
        stop_price = average_entry * (1.0 - stop_distance)
    else:
        stop_price = None
    stop_triggered = current_weight > 0 and stop_price is not None and close <= stop_price
    capital_exit = bool(risk_result.get("exit_required"))
    breakdown = bool(row["breakdown_10d"])
    hard_exit = capital_exit or breakdown or stop_triggered
    if capital_exit:
        reasons.append("A capital-protection circuit requires an exit.")
    elif stop_triggered:
        reasons.append("The completed bar closed through the protective stop.")
    if risk_result.get("blocked") and not capital_exit:
        reasons.append("The risk circuit blocks new exposure.")

    add_reference = max(value for value in (average_entry, last_add, 0.0) if value is not None)
    add_price_confirmed = (
        add_reference > 0
        and close >= add_reference * (1.0 + cfg["add_min_price_gain_pct"])
    )
    add_allowed = (
        current_weight > 0
        and not risk_result.get("blocked")
        and entry_qualified
        and bool(row["breakout_20d"])
        and score >= cfg["add_score"]
        and add_price_confirmed
        and strategic_target >= current_weight + cfg["rebalance_band"]
    )

    if current_weight <= 1e-9:
        target_weight = strategic_target if entry_qualified and not risk_result.get("blocked") else 0.0
        action = "BUY" if target_weight > 1e-6 else "HOLD"
        allowed_actions = ["BUY", "HOLD"] if action == "BUY" else ["HOLD"]
    elif hard_exit or negative:
        target_weight = 0.0
        action = "EXIT"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
    elif score < cfg["reduce_score"] or volatility >= cfg["high_volatility_threshold"]:
        # Every circuit blocks BUY/ADD, but risk-reducing actions remain
        # available even during a daily block, cooldown, or data fault.
        reduced_target = min(current_weight, cfg["max_asset_weight"] * cfg["reduced_weight_fraction"])
        if current_weight - reduced_target >= cfg["rebalance_band"]:
            target_weight = reduced_target
            action = "REDUCE"
        else:
            target_weight = current_weight
            action = "HOLD"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
    elif risk_result.get("blocked"):
        target_weight = current_weight
        action = "HOLD"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
    elif add_allowed:
        target_weight = strategic_target
        action = "ADD"
        allowed_actions = ["ADD", "HOLD", "REDUCE", "EXIT"]
    else:
        # Hysteresis is intentional: once invested, changes in the rolling
        # volatility estimate do not create tiny hourly rebalances. Exposure
        # changes only on an explicit add, reduction, or exit rule.
        target_weight = current_weight
        action = "HOLD"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
        if add_reference > 0 and close <= add_reference:
            reasons.append("Add blocked: the position is not above its cost/add reference.")
        elif (
            entry_qualified
            and score >= cfg["add_score"]
            and bool(row["breakout_20d"])
            and add_reference > 0
            and not add_price_confirmed
        ):
            reasons.append("Add blocked: price has not advanced enough above the cost/add reference.")

    return {
        "algorithm": ALGORITHM_NAME,
        "version": ALGORITHM_VERSION,
        "timestamp": row["timestamp"].isoformat(),
        "price": close,
        "action": action,
        "regime": regime,
        "score": score,
        "target_weight": round(target_weight, 6),
        "stop_distance_pct": round(stop_distance, 6),
        "reasons": reasons,
        "allowed_actions": allowed_actions,
        # This describes reconciled state *before* the proposed order.  It is
        # safe to persist on HOLD or while an order is pending.  Confirmed
        # fills must be applied with apply_fill_to_position_state().
        "position_state": {
            "last_add_price": persisted_last_add,
            "protective_stop": stop_price,
        },
        "evidence": {
            "entry_qualified": entry_qualified,
            "negative_trend": negative,
            "breakdown": breakdown,
            "stop_triggered": stop_triggered,
            "capital_exit": capital_exit,
            "protective_stop": round(stop_price, 8) if stop_price is not None else None,
            "strategic_target": strategic_target,
        },
        "indicators": {
            "ema_10": ema_fast,
            "ema_40": ema_slow,
            "momentum_20d": momentum_fast,
            "momentum_65d": momentum_slow,
            "atr_24h": float(row["atr_24h"]),
            "annualized_volatility_30d": volatility,
            "high_20d": float(row["high_20d"]),
            "low_10d": float(row["low_10d"]),
        },
    }


def _confirmed_signal(
    rows: Sequence[Mapping[str, Any]],
    index: int,
    cfg: Mapping[str, Any],
    *,
    position: Optional[Mapping[str, Any]],
    risk: Mapping[str, Any],
) -> Dict[str, Any]:
    """Apply causal entry/exit confirmation to one already-completed bar."""

    result = _signal_from_indicator(rows[index], cfg, position=position, risk=risk)
    current_weight, _, _, _ = _position_values(position)

    if result["action"] == "BUY":
        count = cfg["entry_confirmation_bars"]
        start = index - count + 1
        confirmed = start >= 0
        if confirmed:
            for candidate_index in range(start, index + 1):
                candidate = _signal_from_indicator(
                    rows[candidate_index],
                    cfg,
                    position=None,
                    risk={"blocked": False},
                )
                if not candidate.get("evidence", {}).get("entry_qualified", False):
                    confirmed = False
                    break
        if not confirmed:
            result["action"] = "HOLD"
            result["target_weight"] = 0.0
            result["allowed_actions"] = ["HOLD"]
            result["reasons"].append(
                f"Entry is waiting for {count} consecutive completed-hour confirmations."
            )

    # Breakdowns, protective stops, and capital circuits are immediate. A
    # slower trend reversal needs confirmation so a single noisy close cannot
    # liquidate the position.
    evidence = result.get("evidence", {})
    slow_exit = (
        result["action"] == "EXIT"
        and evidence.get("negative_trend", False)
        and not any(
            evidence.get(flag, False)
            for flag in ("breakdown", "stop_triggered", "capital_exit")
        )
    )
    if slow_exit:
        count = cfg["exit_confirmation_bars"]
        start = index - count + 1
        confirmed = start >= 0
        if confirmed:
            for candidate_index in range(start, index + 1):
                candidate = _signal_from_indicator(
                    rows[candidate_index],
                    cfg,
                    position=None,
                    risk={"blocked": False},
                )
                if not candidate.get("evidence", {}).get("negative_trend", False):
                    confirmed = False
                    break
        if not confirmed:
            result["action"] = "HOLD"
            result["target_weight"] = current_weight
            result["allowed_actions"] = ["HOLD", "REDUCE", "EXIT"]
            result["reasons"].append(
                f"Trend exit is waiting for {count} consecutive completed-hour confirmations."
            )
    return result


def generate_signal(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    position: Optional[Mapping[str, Any]] = None,
    risk_state: Optional[Mapping[str, Any]] = None,
    now: Optional[Any] = None,
) -> Dict[str, Any]:
    """Generate the latest explainable long/flat target and action."""

    cfg = validate_config(config)
    rows = compute_indicators(bars, cfg)
    state = dict(risk_state or {})
    state.setdefault("last_bar_time", rows[-1]["timestamp"])
    risk = evaluate_risk_circuit(state, cfg, now=now or rows[-1]["timestamp"])
    result = _confirmed_signal(
        rows,
        len(rows) - 1,
        cfg,
        position=position,
        risk=risk,
    )
    result["risk"] = risk
    return result


def _period_return(equity_curve: Sequence[float], lookback: int) -> float:
    if len(equity_curve) <= 1:
        return 0.0
    baseline_index = max(0, len(equity_curve) - 1 - lookback)
    baseline = equity_curve[baseline_index]
    return equity_curve[-1] / baseline - 1 if baseline > 0 else 0.0


def _drawdown(equity_curve: Sequence[float]) -> float:
    if not equity_curve:
        return 0.0
    peak = max(equity_curve)
    return equity_curve[-1] / peak - 1 if peak > 0 else 0.0


def _performance_metrics(
    equity_curve: Sequence[float],
    *,
    initial_capital: float,
    periods_per_year: int,
    trades: int,
    turnover: float,
    fees: float,
) -> Dict[str, Any]:
    if not equity_curve:
        equity_curve = [initial_capital]
    returns = [equity_curve[i] / equity_curve[i - 1] - 1 for i in range(1, len(equity_curve)) if equity_curve[i - 1] > 0]
    mean_return = _mean(returns)
    return_stdev = _sample_stdev(returns)
    sharpe = mean_return / return_stdev * math.sqrt(periods_per_year) if return_stdev > 0 else 0.0
    downside = [min(value, 0.0) for value in returns]
    downside_deviation = math.sqrt(_mean([value * value for value in downside])) if downside else 0.0
    sortino = mean_return / downside_deviation * math.sqrt(periods_per_year) if downside_deviation > 0 else 0.0
    peak = equity_curve[0]
    max_drawdown = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        if peak > 0:
            max_drawdown = min(max_drawdown, value / peak - 1)
    total_return = equity_curve[-1] / initial_capital - 1
    periods = max(1, len(returns))
    if equity_curve[-1] > 0 and initial_capital > 0:
        annualized_return = (equity_curve[-1] / initial_capital) ** (periods_per_year / periods) - 1
    else:
        annualized_return = -1.0
    calmar = annualized_return / abs(max_drawdown) if max_drawdown < 0 else 0.0
    return {
        "total_return": round(total_return, 8),
        "annualized_return": round(annualized_return, 8),
        "max_drawdown": round(max_drawdown, 8),
        "sharpe": round(sharpe, 6),
        "sortino": round(sortino, 6),
        "calmar": round(calmar, 6),
        "trades": int(trades),
        "turnover": round(turnover, 8),
        "fees": round(fees, 8),
        "ending_equity": round(equity_curve[-1], 8),
    }


def _benchmark(
    rows: Sequence[Mapping[str, Any]],
    evaluation_start_index: int,
    execution_index: int,
    initial_capital: float,
    cfg: Mapping[str, Any],
) -> Dict[str, Any]:
    evaluation_rows = rows[evaluation_start_index:]
    timestamps = [row["timestamp"].isoformat() for row in evaluation_rows]
    if not evaluation_rows or execution_index >= len(rows):
        curve = [initial_capital] * max(1, len(evaluation_rows))
        metrics = _performance_metrics(
            curve,
            initial_capital=initial_capital,
            periods_per_year=365 * cfg["bars_per_day"],
            trades=0,
            turnover=0.0,
            fees=0.0,
        )
        return {
            "metrics": metrics,
            "equity_curve": curve,
            "timestamps": timestamps,
            "from": timestamps[0] if timestamps else None,
            "to": timestamps[-1] if timestamps else None,
            "fills": [],
            "terminal_liquidation": {"liquidated": False},
        }
    fee_rate = cfg["fee_bps"] / 10_000.0
    slip_rate = cfg["slippage_bps"] / 10_000.0
    execution_price = float(rows[execution_index]["open"]) * (1 + slip_rate)
    gross_budget = initial_capital / (1 + fee_rate)
    units = gross_budget / execution_price
    entry_fee = gross_budget * fee_rate
    cash = initial_capital - gross_budget - entry_fee
    # Hold cash from the common evaluation start through the first executable
    # open, then mark the benchmark over exactly the same timestamps as the
    # strategy.  This also includes entry costs in the first period return.
    curve = [initial_capital] * (execution_index - evaluation_start_index)
    curve.extend(cash + units * float(row["close"]) for row in rows[execution_index:])
    terminal_mark = curve[-1]
    terminal_execution_price = float(rows[-1]["close"]) * (1 - slip_rate)
    terminal_gross = units * terminal_execution_price
    terminal_fee = terminal_gross * fee_rate
    cash += terminal_gross - terminal_fee
    curve[-1] = cash
    total_fees = entry_fee + terminal_fee
    turnover = gross_budget / initial_capital + terminal_gross / max(terminal_mark, 1e-9)
    fills = [
        {
            "timestamp": rows[execution_index]["timestamp"].isoformat(),
            "action": "BUY",
            "side": "buy",
            "execution_price": round(execution_price, 8),
            "gross_notional": round(gross_budget, 8),
            "fee": round(entry_fee, 8),
            "terminal": False,
        },
        {
            "timestamp": rows[-1]["timestamp"].isoformat(),
            "action": "TERMINAL_EXIT",
            "side": "sell",
            "execution_price": round(terminal_execution_price, 8),
            "gross_notional": round(terminal_gross, 8),
            "fee": round(terminal_fee, 8),
            "terminal": True,
        },
    ]
    metrics = _performance_metrics(
        curve,
        initial_capital=initial_capital,
        periods_per_year=365 * cfg["bars_per_day"],
        trades=len(fills),
        turnover=turnover,
        fees=total_fees,
    )
    return {
        "metrics": metrics,
        "equity_curve": [round(value, 8) for value in curve],
        "timestamps": timestamps,
        "from": timestamps[0],
        "to": timestamps[-1],
        "fills": fills,
        "terminal_liquidation": {
            "liquidated": True,
            "timestamp": rows[-1]["timestamp"].isoformat(),
            "mark_before_costs": round(terminal_mark, 8),
            "execution_price": round(terminal_execution_price, 8),
            "fee": round(terminal_fee, 8),
            "ending_cash": round(cash, 8),
        },
    }


def backtest(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    symbol: str = "BTC/USD",
    initial_capital: float = 10_000.0,
) -> Dict[str, Any]:
    """Run a causal next-bar backtest with fees and adverse slippage.

    Signals observed at row ``i`` are queued and may only change exposure at
    row ``i + 1``'s open.  All equity and risk statistics are then marked using
    that next row.  This avoids using a close before it exists.
    """

    cfg = validate_config(config)
    symbol = str(symbol).strip().upper()
    if symbol not in cfg["symbols"]:
        raise CryptoEngineError(f"symbol is not enabled by config: {symbol}")
    initial_capital = _finite_number(initial_capital, "initial_capital", positive=True)
    rows = compute_indicators(bars, cfg)
    warmup = required_history_bars(cfg) - 1
    if len(rows) <= warmup + 1:
        raise CryptoEngineError(f"backtest requires at least {warmup + 2} hourly bars")

    fee_rate = cfg["fee_bps"] / 10_000.0
    slip_rate = cfg["slippage_bps"] / 10_000.0
    cash = initial_capital
    units = 0.0
    average_entry: Optional[float] = None
    position_state: Dict[str, Optional[float]] = {
        "last_add_price": None,
        "protective_stop": None,
    }
    pending_target = 0.0
    pending_stop_distance: Optional[float] = None
    pending_action = "HOLD"
    trades = 0
    turnover = 0.0
    fees = 0.0
    equity_curve: List[float] = []
    timestamps: List[str] = []
    decisions: List[Dict[str, Any]] = []
    fills: List[Dict[str, Any]] = []
    cooldown_until_index: Optional[int] = None

    # Benchmark begins at the first open at which a complete signal from the
    # preceding bar could be filled.
    start_execution_index = warmup + 1
    for index in range(warmup, len(rows)):
        row = rows[index]
        open_price = float(row["open"])

        if index > warmup and pending_action in {"BUY", "ADD", "REDUCE", "EXIT"}:
            equity_at_open = cash + units * open_price
            current_notional = units * open_price
            target_notional = max(0.0, min(cfg["max_asset_weight"], pending_target)) * equity_at_open
            delta = target_notional - current_notional
            minimum_trade = max(1e-8, equity_at_open * 0.001)
            # Overnight/hour-boundary gaps can move the marked position across
            # its queued target.  A stale BUY/ADD intent may only buy or cancel;
            # it must never turn into a sell.  REDUCE/EXIT has the symmetric
            # sell-or-cancel contract.
            buy_intent = pending_action in {"BUY", "ADD"}
            sell_intent = pending_action in {"REDUCE", "EXIT"}
            if buy_intent and delta > minimum_trade:
                execution_price = open_price * (1 + slip_rate)
                desired_gross = delta
                affordable_gross = max(0.0, cash / (1 + fee_rate))
                gross = min(desired_gross, affordable_gross)
                if gross > minimum_trade:
                    acquired = gross / execution_price
                    fee = gross * fee_rate
                    previous_cost = units * average_entry if units > 0 and average_entry is not None else 0.0
                    cash -= gross + fee
                    units += acquired
                    average_entry = (previous_cost + acquired * execution_price) / units
                    position_state = apply_fill_to_position_state(
                        position_state,
                        action=pending_action,
                        fill_price=execution_price,
                        stop_distance_pct=pending_stop_distance,
                        remaining_position=True,
                    )
                    fees += fee
                    turnover += gross / max(equity_at_open, 1e-9)
                    trades += 1
                    fills.append(
                        {
                            "timestamp": row["timestamp"].isoformat(),
                            "action": pending_action,
                            "side": "buy",
                            "execution_price": round(execution_price, 8),
                            "gross_notional": round(gross, 8),
                            "fee": round(fee, 8),
                            "terminal": False,
                            "position_state": copy.deepcopy(position_state),
                        }
                    )
            elif sell_intent and delta < -minimum_trade and units > 0:
                execution_price = open_price * (1 - slip_rate)
                units_to_sell = min(units, abs(delta) / execution_price)
                gross = units_to_sell * execution_price
                fee = gross * fee_rate
                cash += gross - fee
                units -= units_to_sell
                remaining_position = units > 1e-12
                position_state = apply_fill_to_position_state(
                    position_state,
                    action=pending_action,
                    fill_price=execution_price,
                    remaining_position=remaining_position,
                )
                if not remaining_position:
                    units = 0.0
                    average_entry = None
                fees += fee
                turnover += gross / max(equity_at_open, 1e-9)
                trades += 1
                fills.append(
                    {
                        "timestamp": row["timestamp"].isoformat(),
                        "action": pending_action,
                        "side": "sell",
                        "execution_price": round(execution_price, 8),
                        "gross_notional": round(gross, 8),
                        "fee": round(fee, 8),
                        "terminal": False,
                        "position_state": copy.deepcopy(position_state),
                    }
                )

        close = float(row["close"])
        equity = cash + units * close
        equity_curve.append(equity)
        timestamps.append(row["timestamp"].isoformat())
        current_weight = units * close / equity if equity > 0 else 0.0
        risk_state = {
            "daily_return": _period_return(equity_curve, cfg["bars_per_day"]),
            "seven_day_return": _period_return(equity_curve, cfg["bars_per_day"] * 7),
            "drawdown": _drawdown(equity_curve),
            "last_bar_time": row["timestamp"],
        }
        risk = evaluate_risk_circuit(risk_state, cfg, now=row["timestamp"])
        if risk.get("cooldown_required") and (
            cooldown_until_index is None or index >= cooldown_until_index
        ):
            # Backtests have no durable controller, so reproduce its fixed
            # 72-hour latch with completed hourly bars. Repeated observations
            # inside one latch do not move the expiry forward.
            cooldown_until_index = index + SEVEN_DAY_COOLDOWN_HOURS
        cooldown_active = (
            cooldown_until_index is not None and index < cooldown_until_index
        )
        if cooldown_active:
            risk = copy.deepcopy(risk)
            risk.update(
                {
                    "blocked": True,
                    "entry_blocked": True,
                    "cooldown_active": True,
                    "cooldown_hours": SEVEN_DAY_COOLDOWN_HOURS,
                    "cooldown_remaining_bars": cooldown_until_index - index,
                    "allowed_actions": ["HOLD", "REDUCE", "EXIT"],
                }
            )
            if not any(
                trigger.get("code") == "seven_day_loss"
                for trigger in risk.get("triggers", [])
            ):
                risk.setdefault("triggers", []).append(
                    {
                        "code": "seven_day_cooldown_active",
                        "remaining_bars": cooldown_until_index - index,
                    }
                )
        elif cooldown_until_index is not None:
            cooldown_until_index = None
        signal = _confirmed_signal(
            rows,
            index,
            cfg,
            position={
                "weight": current_weight,
                "average_entry_price": average_entry,
                "position_state": position_state,
            },
            risk=risk,
        )
        pending_target = signal["target_weight"]
        pending_stop_distance = signal.get("stop_distance_pct")
        pending_action = signal["action"]
        decisions.append(
            {
                "timestamp": row["timestamp"].isoformat(),
                "action": signal["action"],
                "regime": signal["regime"],
                "score": signal["score"],
                "target_weight": signal["target_weight"],
                "equity": round(equity, 8),
                "risk": copy.deepcopy(risk),
            }
        )

    terminal_liquidation: Dict[str, Any] = {"liquidated": False}
    if units > 0 and equity_curve:
        terminal_row = rows[-1]
        terminal_close = float(terminal_row["close"])
        terminal_mark = cash + units * terminal_close
        execution_price = terminal_close * (1 - slip_rate)
        gross = units * execution_price
        fee = gross * fee_rate
        cash += gross - fee
        fees += fee
        turnover += gross / max(terminal_mark, 1e-9)
        trades += 1
        position_state = apply_fill_to_position_state(
            position_state,
            action="EXIT",
            fill_price=execution_price,
            remaining_position=False,
        )
        fills.append(
            {
                "timestamp": terminal_row["timestamp"].isoformat(),
                "action": "TERMINAL_EXIT",
                "side": "sell",
                "execution_price": round(execution_price, 8),
                "gross_notional": round(gross, 8),
                "fee": round(fee, 8),
                "terminal": True,
                "position_state": copy.deepcopy(position_state),
            }
        )
        units = 0.0
        average_entry = None
        equity_curve[-1] = cash
        terminal_liquidation = {
            "liquidated": True,
            "timestamp": terminal_row["timestamp"].isoformat(),
            "mark_before_costs": round(terminal_mark, 8),
            "execution_price": round(execution_price, 8),
            "fee": round(fee, 8),
            "ending_cash": round(cash, 8),
        }

    metrics = _performance_metrics(
        equity_curve,
        initial_capital=initial_capital,
        periods_per_year=365 * cfg["bars_per_day"],
        trades=trades,
        turnover=turnover,
        fees=fees,
    )
    benchmark = _benchmark(
        rows,
        warmup,
        start_execution_index,
        initial_capital,
        cfg,
    )
    return {
        "algorithm": ALGORITHM_NAME,
        "version": ALGORITHM_VERSION,
        "symbol": symbol,
        "symbols": [symbol],
        "from": timestamps[0] if timestamps else None,
        "to": timestamps[-1] if timestamps else None,
        "timeframe": "15Min" if cfg["bars_per_day"] == 96 else "1Hour",
        "config": cfg,
        "metrics": metrics,
        "benchmark": benchmark,
        "equity_curve": [round(value, 8) for value in equity_curve],
        "timestamps": timestamps,
        "decisions": decisions,
        "fills": fills,
        "terminal_liquidation": terminal_liquidation,
        "ending_position_state": copy.deepcopy(position_state),
        "cost_model": {
            "fee_bps": cfg["fee_bps"],
            "slippage_bps": cfg["slippage_bps"],
            "execution": "next_bar_open",
            "terminal_mark": "forced_liquidation_at_final_close",
        },
    }


__all__ = [
    "ALGORITHM_NAME",
    "ALGORITHM_VERSION",
    "SUPPORTED_SYMBOLS",
    "BAR_INTERVAL_SECONDS",
    "SEVEN_DAY_COOLDOWN_HOURS",
    "DEFAULT_CONFIG",
    "CryptoEngineError",
    "validate_config",
    "required_history_bars",
    "normalize_bars",
    "compute_indicators",
    "evaluate_risk_circuit",
    "apply_fill_to_position_state",
    "generate_signal",
    "backtest",
]
