"""Deterministic research engine for Kalshi's 15-minute BTC contracts.

The engine is intentionally pure: it accepts a market snapshot and reference
prices, then returns an auditable, execution-neutral decision. It never signs
or submits an order; the controller separately applies the selected Paper or
Real environment and its authorization and risk checks.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


BTC_15M_SERIES = "KXBTC15M"

DEFAULT_STRATEGY_CONFIG: Dict[str, Any] = {
    "executionMode": "paper",
    "paperBankroll": 1000.0,
    "riskPerTradePct": 0.50,
    # These are policy floors, not an asserted win rate. They must be
    # recalibrated against genuinely out-of-sample contract outcomes.
    "minNetEdge": 0.010,
    "minConservativeEdge": 0.0075,
    "maxSpread": 0.06,
    "maxRelativeSpread": 0.20,
    "minDepthContracts": 5.0,
    "maxBookParticipation": 0.20,
    # Entries live in the final minutes, where distance to the strike carries
    # more information and exposure duration remains short.
    "minSecondsToClose": 60,
    "maxSecondsToClose": 840,
    # Buy the model-confirmed favorite side only. Longshot buying is excluded
    # because its payoff profile is inconsistent with this carry strategy.
    "minPrice": 0.47,
    "maxPrice": 0.92,
    "minModelProbability": 0.64,
    # Logged out-of-sample contract outcomes show that Kalshi's executable
    # probability is a stronger prior than the old spot-only model early in a
    # contract.  Keep enough model weight to identify dislocations, but do not
    # let a noisy reference proxy overwhelm the traded market.
    "marketBlendWeight": 0.45,
    "maxModelMarketGap": 0.30,
    # The engine steepens the standardized distance score as expiry approaches.
    # 1.70 maps the standardised distance to a normal digital-option CDF.
    # The setting remains tunable as a transparent calibration multiplier.
    "probabilityLogitScale": 1.70,
    # Momentum enters as a bounded score shift, not a drift projection.
    "momentumProjectionScale": 0.07,
    "basisReserveBps": 3.0,
    "maxVolatilityRatio": 3.0,
    "maxJumpSigma": 5.0,
    "fractionalKelly": 0.15,
    # The hard loss budget is scaled down when a signal only just clears its
    # probability/edge floors or when a high-priced favorite offers little
    # payout relative to the capital at risk. Each multiplier is returned in
    # the decision payload so the sizing haircut is fully auditable.
    "minimumRiskBudgetScale": 0.35,
    "fullRiskModelProbability": 0.75,
    "fullRiskConservativeEdge": 0.030,
    "highPriceRiskStart": 0.75,
    "highPriceRiskFloor": 0.50,
    "maxPortfolioExposurePct": 10.0,
    "maxSingleMarketExposurePct": 2.0,
    # Percentage-only sizing can round every valid setup to zero on a small
    # account.  A one-contract micro position is allowed only after every
    # signal/data/liquidity gate clears, and only when both an absolute loss
    # cap and an equity-relative cap can absorb the full contract cost.
    "microPositionMaxLossDollars": 1.0,
    "microPositionMaxLossPct": 5.0,
    "microPositionMinNetEdge": 0.020,
    "microPositionMinConservativeEdge": 0.010,
    "executionPriceTolerance": 0.01,
    "exitProbabilityThreshold": 0.35,
    # Exit orders are governed by executable value, not by the model
    # probability alone. These controls add hysteresis around entries so a
    # noisy five-second update cannot immediately reverse a fresh position.
    "minimumHoldSeconds": 60,
    "reversalCooldownSeconds": 90,
    "minimumAddIntervalSeconds": 90,
    "addMinModelProbability": 0.64,
    "addMinConservativeEdge": 0.0075,
    "addMinProbabilityImprovement": 0.01,
    "addMinEdgeImprovement": 0.001,
    "addSizeFraction": 0.25,
    "exitValueBuffer": 0.010,
    # Entries happen only inside the contract's bounded final window, so the
    # default is to HOLD TO SETTLEMENT. Crystallizing losses mid-window was a major
    # driver of the old strategy's poor realized win rate: exits must either
    # clear the fee-adjusted profit floor or meet both a deep probability
    # deterioration gate and a large mark-to-market loss gate.
    "minimumExitProfit": 0.015,
    "takeProfitScaleOutPct": 0.50,
    "stopLossPct": 0.45,
    "emergencyStopLossPct": 0.25,
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _number(value: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _parse_time(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_strategy_config(raw: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    """Validate user-adjustable research limits against conservative bounds."""
    value = dict(DEFAULT_STRATEGY_CONFIG)
    raw = dict(raw or {})
    bounds: Dict[str, Tuple[float, float]] = {
        "paperBankroll": (100.0, 1_000_000.0),
        "riskPerTradePct": (0.10, 2.0),
        "minNetEdge": (0.005, 0.15),
        "minConservativeEdge": (0.0, 0.08),
        "maxSpread": (0.01, 0.20),
        "maxRelativeSpread": (0.05, 0.50),
        "minDepthContracts": (1.0, 10_000.0),
        "maxBookParticipation": (0.05, 0.50),
        "minSecondsToClose": (45.0, 360.0),
        # The 15-minute robot defaults to 840 seconds.  The wider upper
        # validation bound is used only by the separate hourly-strike robot.
        "maxSecondsToClose": (180.0, 2400.0),
        "minPrice": (0.30, 0.60),
        "maxPrice": (0.55, 0.99),
        "minModelProbability": (0.50, 0.90),
        "marketBlendWeight": (0.0, 0.75),
        "maxModelMarketGap": (0.10, 0.40),
        "probabilityLogitScale": (1.40, 2.60),
        "momentumProjectionScale": (0.0, 0.30),
        "basisReserveBps": (0.0, 15.0),
        "maxVolatilityRatio": (1.5, 5.0),
        "maxJumpSigma": (2.5, 8.0),
        "fractionalKelly": (0.05, 0.50),
        "minimumRiskBudgetScale": (0.10, 1.0),
        "fullRiskModelProbability": (0.65, 0.95),
        "fullRiskConservativeEdge": (0.01, 0.15),
        "highPriceRiskStart": (0.60, 0.90),
        "highPriceRiskFloor": (0.25, 1.0),
        "maxPortfolioExposurePct": (2.0, 50.0),
        "maxSingleMarketExposurePct": (1.0, 20.0),
        "microPositionMaxLossDollars": (0.25, 5.0),
        "microPositionMaxLossPct": (1.0, 10.0),
        "microPositionMinNetEdge": (0.01, 0.10),
        "microPositionMinConservativeEdge": (0.005, 0.08),
        "executionPriceTolerance": (0.0, 0.03),
        "exitProbabilityThreshold": (0.10, 0.49),
        "minimumHoldSeconds": (0.0, 300.0),
        "reversalCooldownSeconds": (15.0, 600.0),
        "minimumAddIntervalSeconds": (10.0, 180.0),
        "addMinModelProbability": (0.55, 0.95),
        "addMinConservativeEdge": (0.0, 0.08),
        "addMinProbabilityImprovement": (0.0, 0.10),
        "addMinEdgeImprovement": (0.0, 0.03),
        "addSizeFraction": (0.10, 1.0),
        "exitValueBuffer": (0.0025, 0.05),
        "minimumExitProfit": (0.0, 0.10),
        "takeProfitScaleOutPct": (0.10, 1.0),
        "stopLossPct": (0.15, 0.80),
        "emergencyStopLossPct": (0.10, 0.60),
    }
    for key, (low, high) in bounds.items():
        if key not in raw:
            continue
        parsed = _number(raw.get(key))
        if parsed is None:
            continue
        value[key] = _clamp(parsed, low, high)

    requested_mode = str(raw.get("executionMode") or raw.get("mode") or value.get("executionMode") or "paper").strip().lower()
    value["executionMode"] = "real" if requested_mode in {"real", "live", "production"} else "paper"
    value["minSecondsToClose"] = int(value["minSecondsToClose"])
    value["minimumHoldSeconds"] = int(value["minimumHoldSeconds"])
    value["reversalCooldownSeconds"] = int(value["reversalCooldownSeconds"])
    value["minimumAddIntervalSeconds"] = int(value["minimumAddIntervalSeconds"])
    value["maxSingleMarketExposurePct"] = min(
        value["maxSingleMarketExposurePct"],
        value["maxPortfolioExposurePct"],
    )
    value["microPositionMinNetEdge"] = max(
        value["microPositionMinNetEdge"],
        value["minNetEdge"],
    )
    value["microPositionMinConservativeEdge"] = max(
        value["microPositionMinConservativeEdge"],
        value["minConservativeEdge"],
    )
    value["emergencyStopLossPct"] = min(
        value["emergencyStopLossPct"],
        value["stopLossPct"],
    )
    value["maxSecondsToClose"] = max(
        int(value["maxSecondsToClose"]), value["minSecondsToClose"] + 30
    )
    if value["minPrice"] >= value["maxPrice"]:
        value["minPrice"], value["maxPrice"] = 0.50, 0.93
    value["fullRiskModelProbability"] = max(
        value["fullRiskModelProbability"],
        min(0.95, value["minModelProbability"] + 0.01),
    )
    value["fullRiskConservativeEdge"] = max(
        value["fullRiskConservativeEdge"],
        min(0.15, value["minConservativeEdge"] + 0.005),
    )
    value["highPriceRiskStart"] = min(
        value["highPriceRiskStart"],
        value["maxPrice"],
    )
    return value


def _candle_points(candles: Iterable[Any]) -> List[Tuple[float, float]]:
    points: List[Tuple[float, float]] = []
    for index, candle in enumerate(candles or []):
        timestamp: Optional[float] = None
        close: Optional[float] = None
        if isinstance(candle, Mapping):
            timestamp = _number(candle.get("time") or candle.get("t") or candle.get("timestamp"))
            close = _number(candle.get("close") or candle.get("c"))
        elif isinstance(candle, Sequence) and not isinstance(candle, (str, bytes)):
            # Coinbase Exchange candles are [time, low, high, open, close, volume].
            if len(candle) >= 5:
                timestamp = _number(candle[0])
                close = _number(candle[4])
        if timestamp is None:
            timestamp = float(index)
        if close is not None and close > 0:
            points.append((timestamp, close))
    points.sort(key=lambda item: item[0])
    return points


def minute_return_series(candles: Iterable[Any]) -> List[float]:
    points = _candle_points(candles)
    returns: List[float] = []
    for (_, previous), (_, current) in zip(points, points[1:]):
        if previous > 0 and current > 0:
            returns.append(math.log(current / previous))
    return returns


def realized_minute_volatility(returns: Sequence[float]) -> Optional[float]:
    """EWMA one-minute volatility with a light outlier cap."""
    clean = [float(value) for value in returns if math.isfinite(float(value))]
    if len(clean) < 12:
        return None

    absolute = sorted(abs(value) for value in clean)
    cap = max(absolute[min(len(absolute) - 1, int(len(absolute) * 0.95))], 0.0002)
    clipped = [_clamp(value, -cap, cap) for value in clean[-120:]]
    weighted_square = 0.0
    weight_total = 0.0
    decay = 0.94
    for age, value in enumerate(reversed(clipped)):
        weight = decay ** age
        weighted_square += weight * value * value
        weight_total += weight
    if weight_total <= 0:
        return None
    return _clamp(math.sqrt(weighted_square / weight_total), 0.00020, 0.01000)


def _candle_rows(candles: Iterable[Any]) -> List[Dict[str, float]]:
    rows: List[Dict[str, float]] = []
    for index, candle in enumerate(candles or []):
        values: Dict[str, Optional[float]] = {}
        if isinstance(candle, Mapping):
            values = {
                "time": _number(candle.get("time") or candle.get("t") or candle.get("timestamp")),
                "low": _number(candle.get("low") or candle.get("l")),
                "high": _number(candle.get("high") or candle.get("h")),
                "open": _number(candle.get("open") or candle.get("o")),
                "close": _number(candle.get("close") or candle.get("c")),
                "volume": _number(candle.get("volume") or candle.get("v"), 0.0),
            }
        elif isinstance(candle, Sequence) and not isinstance(candle, (str, bytes)) and len(candle) >= 5:
            values = {
                "time": _number(candle[0]),
                "low": _number(candle[1]),
                "high": _number(candle[2]),
                "open": _number(candle[3]),
                "close": _number(candle[4]),
                "volume": _number(candle[5], 0.0) if len(candle) > 5 else 0.0,
            }
        close = values.get("close")
        if close is None or close <= 0:
            continue
        low = values.get("low") or close
        high = values.get("high") or close
        opened = values.get("open") or close
        if min(low, high, opened) <= 0 or low > high:
            continue
        rows.append({
            "time": values.get("time") if values.get("time") is not None else float(index),
            "low": low,
            "high": high,
            "open": opened,
            "close": close,
            "volume": values.get("volume") or 0.0,
        })
    rows.sort(key=lambda row: row["time"])
    return rows


def _garman_klass_minute_volatility(candles: Iterable[Any]) -> Optional[float]:
    rows = _candle_rows(candles)[-120:]
    if len(rows) < 12:
        return None
    variances: List[float] = []
    for row in rows:
        log_range = math.log(row["high"] / row["low"])
        log_close_open = math.log(row["close"] / row["open"])
        variance = 0.5 * log_range * log_range - (2.0 * math.log(2.0) - 1.0) * log_close_open * log_close_open
        variances.append(max(0.0, variance))
    return _clamp(math.sqrt(sum(variances) / len(variances)), 0.00020, 0.01000)


def _root_mean_square(values: Sequence[float]) -> Optional[float]:
    clean = [float(value) for value in values if math.isfinite(float(value))]
    if not clean:
        return None
    return math.sqrt(sum(value * value for value in clean) / len(clean))


def _book_levels(raw: Any) -> List[Tuple[float, float]]:
    levels: List[Tuple[float, float]] = []
    for level in raw or []:
        if not isinstance(level, Sequence) or isinstance(level, (str, bytes)) or len(level) < 2:
            continue
        price = _number(level[0])
        size = _number(level[1])
        if price is None or size is None or not 0.0 < price < 1.0 or size <= 0:
            continue
        levels.append((price, size))
    return sorted(levels, key=lambda level: level[0])


def _age_seconds(value: Any, now: datetime) -> Optional[float]:
    parsed = _parse_time(value)
    if parsed is None:
        return None
    return max(0.0, (now - parsed).total_seconds())


def kalshi_fee(price: float, contracts: float = 1.0, rate: float = 0.07) -> float:
    """Conservative current general taker fee, rounded to the next centicent."""
    price = _clamp(float(price), 0.0, 1.0)
    contracts = max(0.0, float(contracts))
    raw = rate * contracts * price * (1.0 - price)
    return math.ceil((raw - 1e-12) * 10_000.0) / 10_000.0


def _normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def _time_scaled_probability_scale(base_scale: float, seconds_to_close: float) -> float:
    """Steepen the distance calibration modestly as settlement approaches."""
    ramp = _clamp((300.0 - float(seconds_to_close)) / 180.0, 0.0, 1.0)
    return float(base_scale) * (1.0 + 0.12 * ramp)


def _gate(
    key: str,
    passed: bool,
    label: str,
    label_zh: str,
    detail: str,
    severity: str = "hard",
    category: str = "signal",
) -> Dict[str, Any]:
    return {
        "key": key,
        "status": "pass" if passed else ("observe" if severity == "adaptive" else "block"),
        "blocking": bool(not passed and severity != "adaptive"),
        "severity": severity,
        "label": label,
        "labelZh": label_zh,
        "detail": detail,
        "category": category,
    }


def select_btc15_market(
    markets: Iterable[Mapping[str, Any]],
    now: Optional[datetime] = None,
    *,
    min_active_seconds_to_close: float = 0.0,
) -> Tuple[Optional[Dict[str, Any]], str]:
    """Select the active KXBTC15M contract, or the nearest upcoming one."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    candidates = [
        dict(market) for market in markets or []
        if str(market.get("ticker") or "").upper().startswith(f"{BTC_15M_SERIES}-")
    ]
    active: List[Tuple[datetime, Dict[str, Any]]] = []
    upcoming: List[Tuple[datetime, Dict[str, Any]]] = []
    recent: List[Tuple[datetime, Dict[str, Any]]] = []
    for market in candidates:
        opened = _parse_time(market.get("open_time"))
        closes = _parse_time(market.get("close_time"))
        status = str(market.get("status") or "").lower()
        if opened and closes and opened <= now < closes and status in {"active", "open"}:
            if (closes - now).total_seconds() >= min_active_seconds_to_close:
                active.append((closes, market))
            else:
                recent.append((closes, market))
        elif opened and opened > now and status in {"initialized", "active", "open"}:
            upcoming.append((opened, market))
        elif closes and closes <= now:
            recent.append((closes, market))
    if active:
        return min(active, key=lambda item: item[0])[1], "active"
    if upcoming:
        return min(upcoming, key=lambda item: item[0])[1], "upcoming"
    if recent:
        return max(recent, key=lambda item: item[0])[1], "recent"
    return None, "unavailable"


def evaluate_btc15_contract(
    market: Mapping[str, Any],
    *,
    spot_price: Optional[float],
    candles: Iterable[Any],
    now: Optional[datetime] = None,
    config: Optional[Mapping[str, Any]] = None,
    orderbook: Optional[Mapping[str, Any]] = None,
    reference_time: Any = None,
    reference_metadata: Optional[Mapping[str, Any]] = None,
    book_time: Any = None,
    account_context: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Return a fail-closed decision using model, book, and account evidence."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    settings = normalize_strategy_config(config)
    market = dict(market or {})
    account = dict(account_context or {})
    reference = dict(reference_metadata or {})
    opened = _parse_time(market.get("open_time"))
    closes = _parse_time(market.get("close_time"))
    seconds_to_close = (closes - now).total_seconds() if closes else -1.0
    status = str(market.get("status") or "").lower()
    is_active = bool(opened and closes and opened <= now < closes and status in {"active", "open"})

    strike = _number(market.get("floor_strike"))
    spot = _number(spot_price)
    book = dict(orderbook or market.get("_orderbook") or {})
    yes_levels = _book_levels(book.get("yes"))
    no_levels = _book_levels(book.get("no"))
    best_yes_bid = yes_levels[-1] if yes_levels else None
    best_no_bid = no_levels[-1] if no_levels else None

    yes_bid = best_yes_bid[0] if best_yes_bid else _number(market.get("yes_bid_dollars"))
    no_bid = best_no_bid[0] if best_no_bid else _number(market.get("no_bid_dollars"))
    yes_ask = 1.0 - best_no_bid[0] if best_no_bid else _number(market.get("yes_ask_dollars"))
    no_ask = 1.0 - best_yes_bid[0] if best_yes_bid else _number(market.get("no_ask_dollars"))
    if no_bid is None and yes_ask is not None:
        no_bid = 1.0 - yes_ask
    if no_ask is None and yes_bid is not None:
        no_ask = 1.0 - yes_bid

    quotes_valid = all(
        value is not None and 0.0 < value < 1.0
        for value in (yes_bid, yes_ask, no_bid, no_ask)
    ) and bool(yes_ask >= yes_bid and no_ask >= no_bid)
    yes_spread = (yes_ask - yes_bid) if quotes_valid else None
    no_spread = (no_ask - no_bid) if quotes_valid else None
    spread = max(yes_spread or 0.0, no_spread or 0.0) if quotes_valid else None

    yes_bid_depth = best_yes_bid[1] if best_yes_bid else (_number(market.get("yes_bid_size_fp"), 0.0) or 0.0)
    no_bid_depth = best_no_bid[1] if best_no_bid else (_number(market.get("no_bid_size_fp"), 0.0) or 0.0)
    yes_ask_depth = no_bid_depth or (_number(market.get("yes_ask_size_fp"), 0.0) or 0.0)
    no_ask_depth = yes_bid_depth or (_number(market.get("no_ask_size_fp"), 0.0) or 0.0)
    top_depth_total = yes_bid_depth + yes_ask_depth
    book_imbalance = yes_bid_depth / top_depth_total if top_depth_total > 0 else None
    microprice_yes = None
    if quotes_valid and top_depth_total > 0:
        microprice_yes = (
            yes_ask * yes_bid_depth + yes_bid * yes_ask_depth
        ) / top_depth_total
    indicative_market_yes = None
    if quotes_valid:
        indicative_market_yes = microprice_yes if microprice_yes is not None else (yes_bid + yes_ask) / 2.0
    else:
        indicative_points = []
        direct_last = _number(market.get("last_price_dollars"))
        direct_yes_bid = _number(market.get("yes_bid_dollars"))
        direct_yes_ask = _number(market.get("yes_ask_dollars"))
        direct_no_bid = _number(market.get("no_bid_dollars"))
        direct_no_ask = _number(market.get("no_ask_dollars"))
        if direct_last is not None and 0.0 < direct_last < 1.0:
            indicative_points.append(direct_last)
        if direct_yes_bid is not None and 0.0 < direct_yes_bid < 1.0:
            indicative_points.append(direct_yes_bid)
        if direct_yes_ask is not None and 0.0 < direct_yes_ask < 1.0:
            indicative_points.append(direct_yes_ask)
        if direct_no_bid is not None and 0.0 < direct_no_bid < 1.0:
            indicative_points.append(1.0 - direct_no_bid)
        if direct_no_ask is not None and 0.0 < direct_no_ask < 1.0:
            indicative_points.append(1.0 - direct_no_ask)
        if indicative_points:
            indicative_market_yes = _clamp(sum(indicative_points) / len(indicative_points), 0.001, 0.999)

    returns = minute_return_series(candles)
    close_sigma = realized_minute_volatility(returns)
    range_sigma = _garman_klass_minute_volatility(candles)
    if close_sigma is not None and range_sigma is not None:
        sigma_minute = math.sqrt(0.70 * close_sigma * close_sigma + 0.30 * range_sigma * range_sigma)
    else:
        sigma_minute = close_sigma or range_sigma

    short_rms = _root_mean_square(returns[-10:])
    long_rms = _root_mean_square(returns[-60:])
    volatility_ratio = (
        short_rms / max(long_rms, 1e-9)
        if short_rms is not None and long_rms is not None
        else None
    )
    jump_sigma = (
        max((abs(value) for value in returns[-5:]), default=0.0) / max(sigma_minute or 0.0, 1e-9)
        if sigma_minute is not None
        else None
    )
    model_yes: Optional[float] = None
    fair_yes: Optional[float] = None
    market_mid: Optional[float] = None
    model_raw: Optional[float] = None
    horizon_sigma: Optional[float] = None
    momentum_3m: Optional[float] = None
    momentum_5m: Optional[float] = None
    momentum_15m: Optional[float] = None
    uncertainty = 0.12
    market_weight = 0.0
    basis_reserve = None
    effective_horizon_minutes = None
    venue_count = int(_number(reference.get("venueCount"), 0.0) or 0)
    dispersion_bps = max(0.0, _number(reference.get("dispersionBps"), 0.0) or 0.0)

    raw_market_mid = indicative_market_yes
    ladder_probability = _number(reference.get("smoothedProbability"))
    ladder_raw_probability = _number(reference.get("rawProbability"))
    ladder_dislocation = _number(reference.get("dislocation"))
    if ladder_probability is not None and 0.0 < ladder_probability < 1.0:
        market_mid = (
            _clamp(indicative_market_yes * 0.60 + ladder_probability * 0.40, 0.001, 0.999)
            if indicative_market_yes is not None
            else ladder_probability
        )
    else:
        market_mid = indicative_market_yes
    if spot and strike and spot > 0 and strike > 0 and sigma_minute is not None and seconds_to_close > 0:
        # KXBTC15M resolves from the arithmetic mean of the final 60 one-second
        # BRTI samples. Under a Brownian approximation, variance of that future
        # average is equivalent to a point horizon ending 40 seconds before
        # close (T - 60 + 60/3), not the old T - 30 shortcut.
        minutes = max((seconds_to_close - 40.0) / 60.0, 1.0 / 3.0)
        effective_horizon_minutes = minutes
        # Public constituent quotes are a proxy for licensed BRTI. Charge the
        # observed cross-venue dispersion and missing-venue risk explicitly.
        official_brti = bool(reference.get("isOfficialBrti")) or str(
            reference.get("model") or ""
        ) == "kalshi_cf_benchmarks_brti"
        quality_reserve_bps = dispersion_bps * 0.50 + max(0, 3 - venue_count) * 2.0
        # The authenticated Kalshi stream is the actual settlement index.  It
        # needs only a small timing reserve; public constituent quotes retain
        # the full observed basis and missing-venue reserve.
        configured_basis = (
            min(float(settings["basisReserveBps"]), 0.50)
            if official_brti else float(settings["basisReserveBps"])
        )
        basis_reserve = max(
            configured_basis,
            quality_reserve_bps if not official_brti else 0.0,
        ) / 10_000.0
        horizon_sigma = math.sqrt(max(sigma_minute, 0.00035) ** 2 * minutes + basis_reserve ** 2)
        momentum_3m = math.exp(sum(returns[-3:])) - 1.0 if returns else 0.0
        momentum_5m = math.exp(sum(returns[-5:])) - 1.0 if returns else 0.0
        momentum_15m = math.exp(sum(returns[-15:])) - 1.0 if returns else 0.0
        # Momentum is a small, bounded probability-score shift (fit: ~0.07 per standardized
        # 5-minute move), not a projected drift. Projected drift plus the old
        # reliability shrink systematically under-confident forecasts, which
        # made the engine "find value" on the longshot side and buy ~20%
        # winners. See docs/kalshi_dual_market_strategy_v6.md.
        momentum_z = _clamp(
            sum(returns[-5:]) / max(sigma_minute * math.sqrt(5.0), 1e-9),
            -3.0,
            3.0,
        ) if len(returns) >= 5 else 0.0
        distance_z = math.log(spot / strike) / max(horizon_sigma, 1e-9)
        scale = _time_scaled_probability_scale(float(settings["probabilityLogitScale"]), seconds_to_close)
        # Per-regime MLE fits show marginal favorites decay in elevated
        # volatility (hit 67.6% -> 61.6% as the 10m/60m vol ratio moves from
        # calm to 1.5-2.5). Damp confidence up to 5% across that band so
        # borderline entries fall below the probability floor instead of
        # entering over-priced.
        if volatility_ratio is not None and volatility_ratio > 1.5:
            scale *= 1.0 - 0.05 * _clamp((volatility_ratio - 1.5) / 1.0, 0.0, 1.0)
        distribution_z = _clamp(
            distance_z * (scale / 1.70)
            + momentum_z * float(settings["momentumProjectionScale"]),
            -8.0,
            8.0,
        )
        model_raw = _normal_cdf(distribution_z)
        model_yes = _clamp(model_raw, 0.02, 0.98)
        original_model_yes = model_yes

        if market_mid is not None:
            book_health = _clamp(
                (1.0 - (spread or settings["maxSpread"]) / max(settings["maxSpread"], 0.01)) * 0.50
                + min(1.0, min(yes_ask_depth, no_ask_depth) / max(settings["minDepthContracts"], 1.0)) * 0.50,
                0.15,
                1.0,
            )
            market_weight = settings["marketBlendWeight"] * book_health
            fair_yes = _clamp(model_yes * (1.0 - market_weight) + market_mid * market_weight, 0.03, 0.97)

        disagreement = abs(model_yes - market_mid) if market_mid is not None else 0.30
        uncertainty = _clamp(
            0.015
            + 0.10 / math.sqrt(max(len(returns), 1))
            + (spread or settings["maxSpread"]) * 0.35
            + min(0.03, max(0.0, (volatility_ratio or 1.0) - 1.0) * 0.02)
            + min(0.05, disagreement * 0.15),
            # A wide or single-venue proxy must not create false precision.
            0.02,
            0.12,
        )
        uncertainty = _clamp(
            uncertainty + min(0.025, dispersion_bps / 10_000.0 * 2.0)
            # A one-venue public quote is fragile; the official BRTI stream is
            # itself a regulated multi-exchange composite and must not receive
            # that proxy-only penalty merely because it is one index feed.
            + (0.01 if venue_count == 1 and not official_brti else 0.0),
            0.02,
            0.14,
        )

    side: Optional[str] = None
    selected_price: Optional[float] = None
    selected_depth = 0.0
    selected_near_depth = 0.0
    selected_fair: Optional[float] = None
    gross_edge: Optional[float] = None
    fee_per_contract: Optional[float] = None
    net_edge: Optional[float] = None
    conservative_probability: Optional[float] = None
    conservative_edge: Optional[float] = None
    selected_model_probability: Optional[float] = None
    selected_levels: List[Tuple[float, float]] = []
    eligible_levels: List[Tuple[float, float]] = []
    edge_eligible_depth = 0.0
    execution_limit_price: Optional[float] = None
    if fair_yes is not None and quotes_valid:
        # Favorite-carry selection: trade only the side the blended forecast
        # says is MORE likely to settle in the money. The old max-edge rule
        # compared both sides and, because the forecast was under-confident,
        # almost always "found value" on the longshot — a structural ~20%
        # winner. The favorite side's win rate is the forecast itself.
        if fair_yes >= 0.5:
            side, selected_price, selected_fair = "YES", yes_ask, fair_yes
            gross_edge = fair_yes - yes_ask
            selected_depth = yes_ask_depth
            selected_near_depth = sum(
                size for price, size in no_levels
                if (1.0 - price) <= (yes_ask or 0.0) + 0.03
            ) or selected_depth
            selected_levels = sorted(
                ((1.0 - price, size) for price, size in no_levels),
                key=lambda level: level[0],
            )
        else:
            side, selected_price, selected_fair = "NO", no_ask, 1.0 - fair_yes
            gross_edge = (1.0 - fair_yes) - no_ask
            selected_depth = no_ask_depth
            selected_near_depth = sum(
                size for price, size in yes_levels
                if (1.0 - price) <= (no_ask or 0.0) + 0.03
            ) or selected_depth
            selected_levels = sorted(
                ((1.0 - price, size) for price, size in yes_levels),
                key=lambda level: level[0],
            )
        selected_model_probability = model_yes if side == "YES" else 1.0 - model_yes
        fee_per_contract = kalshi_fee(selected_price)
        net_edge = gross_edge - fee_per_contract
        conservative_probability = max(0.0, selected_fair - uncertainty * 0.50)
        conservative_edge = conservative_probability - selected_price - fee_per_contract
        if not selected_levels and selected_price is not None and selected_depth > 0:
            selected_levels = [(selected_price, selected_depth)]

    sample_ok = len(returns) >= 30 and sigma_minute is not None
    timing_ok = (
        settings["minSecondsToClose"] <= seconds_to_close <= settings["maxSecondsToClose"]
    )
    spread_ok = spread is not None and spread <= settings["maxSpread"]
    relative_spread = spread / selected_price if spread is not None and selected_price else None
    relative_spread_ok = (
        relative_spread is not None
        and relative_spread <= settings["maxRelativeSpread"]
    )
    depth_ok = selected_depth >= settings["minDepthContracts"]
    official_reference = bool(reference.get("isOfficialBrti")) or str(
        reference.get("model") or ""
    ) == "kalshi_cf_benchmarks_brti"
    # Model-confirmed dislocations below 50c are allowed only when the model
    # is driven by the exact settlement index.  The public proxy keeps the old
    # 50c favorite-carry floor to avoid basis-driven longshot entries.
    effective_min_price = (
        settings["minPrice"] if official_reference else max(0.50, settings["minPrice"])
    )
    price_ok = (
        selected_price is not None
        and effective_min_price <= selected_price <= settings["maxPrice"]
    )
    edge_ok = net_edge is not None and net_edge >= settings["minNetEdge"]
    conservative_edge_ok = (
        conservative_edge is not None
        and conservative_edge >= settings["minConservativeEdge"]
    )
    strike_ok = bool(strike and strike > 0 and spot and spot > 0)
    model_probability_ok = (
        selected_model_probability is not None
        and selected_model_probability >= settings["minModelProbability"]
    )
    volatility_ok = bool(
        volatility_ratio is not None
        and jump_sigma is not None
        and volatility_ratio <= settings["maxVolatilityRatio"]
        and jump_sigma <= settings["maxJumpSigma"]
    )
    model_market_gap = abs(model_yes - market_mid) if model_yes is not None and market_mid is not None else None
    model_agreement_ok = (
        model_market_gap is not None
        and model_market_gap <= settings["maxModelMarketGap"]
    )
    momentum_votes = [
        1 if value and value > 0 else -1 if value and value < 0 else 0
        for value in (momentum_3m, momentum_5m, momentum_15m)
    ]
    selected_vote = 1 if side == "YES" else -1 if side == "NO" else 0
    trend_support = sum(1 for vote in momentum_votes if vote == selected_vote)
    trend_conflict = sum(1 for vote in momentum_votes if vote == -selected_vote)
    trend_ok = side is not None and (trend_support >= 1 or trend_conflict < 2)
    book_pressure_ok = bool(
        side == "YES" and book_imbalance is not None and book_imbalance >= 0.20
        or side == "NO" and book_imbalance is not None and book_imbalance <= 0.80
    )
    # Trend and top-of-book pressure are noisy over a five-second cycle. They
    # should make entry more expensive, not veto an otherwise liquid,
    # fee-adjusted opportunity. This avoids the old "every signal must agree"
    # deadlock while still charging a 0.25-0.50pp confirmation premium.
    adaptive_edge_premium = (0.0025 if not trend_ok else 0.0) + (
        0.0025 if not book_pressure_ok else 0.0
    )
    effective_min_net_edge = settings["minNetEdge"] + adaptive_edge_premium
    effective_min_conservative_edge = (
        settings["minConservativeEdge"] + adaptive_edge_premium
    )
    if selected_fair is not None and conservative_probability is not None:
        eligible_levels = [
            (price, size) for price, size in selected_levels
            if effective_min_price <= price <= settings["maxPrice"]
            and selected_fair - price - kalshi_fee(price) >= effective_min_net_edge
            and conservative_probability - price - kalshi_fee(price) >= effective_min_conservative_edge
        ]
        edge_eligible_depth = sum(size for _, size in eligible_levels)
        execution_limit_price = max((price for price, _ in eligible_levels), default=selected_price)
    depth_ok = edge_eligible_depth >= settings["minDepthContracts"]
    edge_ok = net_edge is not None and net_edge >= effective_min_net_edge
    conservative_edge_ok = (
        conservative_edge is not None
        and conservative_edge >= effective_min_conservative_edge
    )
    reference_age = _age_seconds(reference_time, now)
    book_age = _age_seconds(book_time, now)
    reference_fresh = reference_age is not None and reference_age <= 10.0
    book_fresh = book_age is not None and book_age <= 8.0
    freshness_detail = " / ".join(
        (
            f"spot {reference_age:.1f}s"
            if reference_age is not None
            else "spot timestamp missing",
            f"book {book_age:.1f}s"
            if book_age is not None
            else "book timestamp missing",
        )
    )

    gates = [
        _gate("contract_active", is_active, "Active contract", "合约交易中", f"status={status or 'unknown'}", category="data"),
        _gate("entry_window", timing_ok, "Entry window", "进场时段", f"{max(0, int(seconds_to_close))}s / {settings['minSecondsToClose']}-{settings['maxSecondsToClose']}s", category="data"),
        _gate("reference_ready", strike_ok, "Reference price", "参考价格", "BRTI strike and BTC reference available" if strike_ok else "missing strike or reference", category="data"),
        _gate("data_freshness", reference_fresh and book_fresh, "Fresh evidence", "数据新鲜度", freshness_detail, category="data"),
        _gate("history_sample", sample_ok, "Volatility sample", "波动率样本", f"{len(returns)} one-minute returns", category="data"),
        _gate("volatility_regime", volatility_ok, "Stable volatility regime", "波动状态", f"ratio {(volatility_ratio or 0.0):.2f} / jump {(jump_sigma or 0.0):.1f} sigma", category="signal"),
        _gate(
            "model_probability",
            model_probability_ok,
            "Favorite-side confidence",
            "优势侧胜率下限",
            (
                f"{(selected_model_probability or 0.0) * 100:.1f}% / min {settings['minModelProbability'] * 100:.0f}%"
                if selected_model_probability is not None
                else "model probability unavailable"
            ),
            category="signal",
        ),
        _gate("model_market_agreement", model_agreement_ok, "Model-market agreement", "模型市场一致性", f"gap {(model_market_gap or 0.0) * 100:.1f}pp / max {settings['maxModelMarketGap'] * 100:.1f}pp", category="signal"),
        _gate("trend_confirmation", trend_ok, "Multi-horizon confirmation", "多周期确认", f"{trend_support} support / {trend_conflict} oppose", severity="adaptive", category="signal"),
        _gate("two_sided_quote", quotes_valid, "Two-sided market", "双边报价", "YES and NO bid books derive executable asks" if quotes_valid else "quote unavailable", category="execution"),
        _gate("spread", spread_ok, "Spread limit", "点差限制", f"{spread * 100:.1f}c / max {settings['maxSpread'] * 100:.1f}c" if spread is not None else "no executable spread", category="execution"),
        _gate("relative_spread", relative_spread_ok, "Relative spread", "相对点差", f"{(relative_spread or 0.0) * 100:.1f}% / max {settings['maxRelativeSpread'] * 100:.1f}%" if relative_spread is not None else "relative spread unavailable", category="execution"),
        _gate("depth", depth_ok, "Edge-eligible depth", "可执行深度", f"{selected_depth:.0f} top / {edge_eligible_depth:.0f} positive marginal edge / min {settings['minDepthContracts']:.0f}", category="execution"),
        _gate("book_pressure", book_pressure_ok, "Adverse book pressure", "盘口逆向压力", f"YES imbalance {(book_imbalance or 0.0) * 100:.0f}%", severity="adaptive", category="execution"),
        _gate(
            "price_band",
            price_ok,
            "Price band",
            "价格区间",
            (
                f"{selected_price * 100:.1f}c / min {effective_min_price * 100:.0f}c "
                f"({'official BRTI' if official_reference else 'proxy reference'})"
                if selected_price is not None else "no executable price"
            ),
            category="execution",
        ),
        _gate("net_edge", edge_ok, "Fee-adjusted edge", "扣费后边际", f"{net_edge * 100:.1f}pp / adaptive min {effective_min_net_edge * 100:.2f}pp" if net_edge is not None else "edge unavailable", category="signal"),
        _gate("conservative_edge", conservative_edge_ok, "Uncertainty-adjusted edge", "不确定性后边际", f"{conservative_edge * 100:.1f}pp / adaptive min {effective_min_conservative_edge * 100:.2f}pp" if conservative_edge is not None else "edge unavailable", category="signal"),
    ]

    bankroll = _number(account.get("bankroll"), settings["paperBankroll"]) or settings["paperBankroll"]
    daily_pnl = _number(account.get("dailyRealizedPnl"))
    if daily_pnl is None:
        daily_pnl = _number(account.get("dailyPnl"), 0.0) or 0.0
    daily_realized_loss = max(0.0, -daily_pnl)

    if account:
        exposure = max(0.0, _number(account.get("portfolioExposure"), 0.0) or 0.0)
        market_exposure = max(0.0, _number(account.get("currentMarketExposure"), 0.0) or 0.0)
        exposure_pct = exposure / max(bankroll, 1.0) * 100.0
        market_exposure_pct = market_exposure / max(bankroll, 1.0) * 100.0
        is_real_execution = settings.get("executionMode") == "real"
        account_gates = [
            _gate(
                "account_ready",
                bankroll > 0,
                "Kalshi Real account ready" if is_real_execution else "AlphaLab Paper account ready",
                "Kalshi 实盘账户可用" if is_real_execution else "AlphaLab 模拟账户可用",
                f"portfolio {bankroll:.2f}",
                category="account",
            ),
            _gate("open_order", not bool(account.get("hasOpenOrder")), "No open order", "无未完成订单", "no resting order for this contract" if not account.get("hasOpenOrder") else "open order already exists", category="account"),
            _gate("portfolio_exposure", exposure_pct < settings["maxPortfolioExposurePct"], "Portfolio exposure", "组合总敞口", f"{exposure_pct:.1f}% / max {settings['maxPortfolioExposurePct']:.1f}%", category="account"),
            _gate("market_exposure", market_exposure_pct < settings["maxSingleMarketExposurePct"], "Single-market exposure", "单市场敞口", f"{market_exposure_pct:.1f}% / max {settings['maxSingleMarketExposurePct']:.1f}%", category="account"),
        ]
        gates.extend(account_gates)

    blocking = [gate["key"] for gate in gates if gate.get("blocking")]

    hard_risk_budget = bankroll * settings["riskPerTradePct"] / 100.0
    probability_strength = 0.0
    if selected_model_probability is not None:
        probability_strength = _clamp(
            (
                selected_model_probability - settings["minModelProbability"]
            )
            / max(
                settings["fullRiskModelProbability"]
                - settings["minModelProbability"],
                0.01,
            ),
            0.0,
            1.0,
        )
    edge_strength = 0.0
    if conservative_edge is not None:
        edge_strength = _clamp(
            (
                conservative_edge - effective_min_conservative_edge
            )
            / max(
                settings["fullRiskConservativeEdge"]
                - effective_min_conservative_edge,
                0.005,
            ),
            0.0,
            1.0,
        )
    # Both components must be strong before the strategy receives its full
    # hard loss budget. A setup that only just clears either entry floor gets
    # the configured minimum scale instead of the old all-or-nothing sizing.
    quality_strength = math.sqrt(probability_strength * edge_strength)
    quality_risk_scale = (
        settings["minimumRiskBudgetScale"]
        + (1.0 - settings["minimumRiskBudgetScale"]) * quality_strength
    )
    price_risk_scale = 1.0
    if (
        selected_price is not None
        and selected_price > settings["highPriceRiskStart"]
    ):
        high_price_progress = _clamp(
            (
                selected_price - settings["highPriceRiskStart"]
            )
            / max(
                settings["maxPrice"] - settings["highPriceRiskStart"],
                0.01,
            ),
            0.0,
            1.0,
        )
        price_risk_scale = (
            1.0
            - high_price_progress
            * (1.0 - settings["highPriceRiskFloor"])
        )
    applied_risk_scale = quality_risk_scale * price_risk_scale
    scaled_hard_risk_budget = hard_risk_budget * applied_risk_scale
    full_kelly = 0.0
    if conservative_probability is not None and selected_price is not None and fee_per_contract is not None:
        unit_cost = selected_price + fee_per_contract
        full_kelly = max(0.0, (conservative_probability - unit_cost) / max(1.0 - unit_cost, 0.01))
    kelly_budget = bankroll * full_kelly * settings["fractionalKelly"]
    max_loss_budget = min(scaled_hard_risk_budget, kelly_budget) if kelly_budget > 0 else 0.0
    contracts = 0
    estimated_fee = 0.0
    max_loss = 0.0
    expected_value = 0.0
    standard_risk_budget = max_loss_budget
    micro_sizing_applied = False
    micro_position_loss_cap = min(
        settings["microPositionMaxLossDollars"],
        bankroll * settings["microPositionMaxLossPct"] / 100.0,
    )
    if not blocking and selected_price is not None and fee_per_contract is not None:
        unit_cost = selected_price + fee_per_contract
        depth_cap = int(edge_eligible_depth * settings["maxBookParticipation"])
        cash_available = _number(account.get("cashAvailable"), bankroll) or bankroll
        cash_cap = int(cash_available // max(unit_cost, 0.01))
        portfolio_exposure = max(0.0, _number(account.get("portfolioExposure"), 0.0) or 0.0)
        market_exposure = max(0.0, _number(account.get("currentMarketExposure"), 0.0) or 0.0)
        portfolio_room = max(
            0.0,
            bankroll * settings["maxPortfolioExposurePct"] / 100.0 - portfolio_exposure,
        )
        market_room = max(
            0.0,
            bankroll * settings["maxSingleMarketExposurePct"] / 100.0 - market_exposure,
        )
        exposure_cap = int(min(portfolio_room, market_room) // max(unit_cost, 0.01))
        contracts = min(
            depth_cap,
            cash_cap,
            exposure_cap,
            int(max_loss_budget // max(unit_cost, 0.01)),
        )
        micro_position_eligible = bool(
            contracts <= 0
            and depth_cap >= 1
            and cash_cap >= 1
            and portfolio_room >= unit_cost
            and market_exposure <= 0.0
            and unit_cost <= micro_position_loss_cap
            and max_loss_budget > 0.0
            and net_edge is not None
            and net_edge >= settings["microPositionMinNetEdge"]
            and conservative_edge is not None
            and conservative_edge >= settings["microPositionMinConservativeEdge"]
        )
        if micro_position_eligible:
            contracts = 1
            micro_sizing_applied = True
            max_loss_budget = unit_cost
            gates.append(_gate(
                "micro_position_size",
                True,
                "Small-account executable size",
                "小账户可执行仓位",
                (
                    f"1 contract / loss {unit_cost:.2f} / cap "
                    f"{micro_position_loss_cap:.2f}"
                ),
                severity="review",
                category="account",
            ))
        if contracts <= 0:
            blocking.append("position_size")
            gates.append(_gate(
                "position_size",
                False,
                "Executable position size",
                "可执行仓位",
                (
                    "Kelly/risk/depth caps are below one contract; "
                    f"small-account loss cap {micro_position_loss_cap:.2f}"
                ),
                category="account",
            ))
        else:
            estimated_fee = kalshi_fee(selected_price, contracts)
            max_loss = selected_price * contracts + estimated_fee
            expected_value = (conservative_edge or 0.0) * contracts

    action = f"BUY_{side}" if side and not blocking and contracts > 0 else "WAIT"
    # Favorite confidence drives the headline score; net edge and execution
    # friction adjust it around that base.
    signal_quality = int(round(_clamp(
        28.0
        + max(0.0, (selected_model_probability or 0.5) - 0.5) * 90.0
        + (conservative_edge or -0.05) * 500.0
        + min(len(returns), 90) / 15.0
        - uncertainty * 80.0
        - (spread if spread is not None else settings["maxSpread"] * 2.0) * 100.0
        - len(blocking) * 2.5,
        0.0,
        100.0,
    )))
    if blocking:
        # A blocked setup can contain an interesting forecast, but it is not a
        # high-quality trade. Keep the headline score aligned with that fact.
        signal_quality = min(signal_quality, max(0, 55 - len(blocking) * 5))

    distance_bps = ((spot / strike) - 1.0) * 10_000.0 if spot and strike else None
    is_real_execution = settings.get("executionMode") == "real"
    return {
        "engine": "btc15_settlement_aligned_v7",
        "generatedAt": _iso(now),
        "paperOnly": not is_real_execution,
        "executionEnvironment": "kalshi_real" if is_real_execution else "alphalab_paper",
        "action": action,
        "side": side,
        "signalQuality": signal_quality,
        "blockingReasons": blocking,
        "market": {
            "ticker": market.get("ticker"),
            "seriesTicker": BTC_15M_SERIES,
            "status": status,
            "title": market.get("title"),
            "openTime": market.get("open_time"),
            "closeTime": market.get("close_time"),
            "occurrenceTime": market.get("occurrence_datetime"),
            "secondsToClose": max(-1, int(seconds_to_close)),
            "strike": strike,
            "yesBid": yes_bid,
            "yesAsk": yes_ask,
            "noBid": no_bid,
            "noAsk": no_ask,
            "lastPrice": _number(market.get("last_price_dollars")),
            "spread": spread,
            "yesAskDepth": yes_ask_depth,
            "noAskDepth": no_ask_depth,
            "bookImbalance": book_imbalance,
            "micropriceYes": microprice_yes,
            "selectedDepth": selected_depth,
            "edgeEligibleDepth": edge_eligible_depth,
            "bookAgeSeconds": book_age,
            "volume": _number(market.get("volume_fp"), 0.0),
            "openInterest": _number(market.get("open_interest_fp"), 0.0),
        },
        "model": {
            "spot": spot,
            "strike": strike,
            "distanceBps": distance_bps,
            "minuteVolatility": sigma_minute,
            "projected15mVolatility": sigma_minute * math.sqrt(15.0) if sigma_minute else None,
            "horizonVolatility": horizon_sigma,
            "settlementEffectiveHorizonMinutes": effective_horizon_minutes,
            "referenceModel": reference.get("model") or "unspecified_spot_proxy",
            "isOfficialBrti": official_reference,
            "referenceRawPrice": _number(reference.get("rawPrice")),
            "settlementWindowAverage": _number(reference.get("settlementWindowAverage")),
            "settlementWindowSamples": int(_number(reference.get("settlementWindowSamples"), 0.0) or 0),
            "settlementWindowProgress": _number(reference.get("settlementWindowProgress"), 0.0),
            "referenceVenueCount": venue_count,
            "referenceDispersionBps": dispersion_bps,
            "basisReserveBpsApplied": basis_reserve * 10_000.0 if basis_reserve is not None else None,
            "momentum3m": momentum_3m,
            "momentum5m": momentum_5m,
            "momentum15m": momentum_15m,
            "volatilityRatio": volatility_ratio,
            "jumpSigma": jump_sigma,
            "marketYesProbability": market_mid,
            "rawMarketYesProbability": raw_market_mid,
            "ladderRawProbability": ladder_raw_probability,
            "ladderSmoothedProbability": ladder_probability,
            "ladderDislocation": ladder_dislocation,
            "rawModelYesProbability": model_raw,
            "originalModelYesProbability": original_model_yes if 'original_model_yes' in locals() else model_yes,
            "modelYesProbability": model_yes,
            "fairYesProbability": fair_yes,
            "selectedModelProbability": selected_model_probability,
            "marketWeight": market_weight,
            "uncertainty": uncertainty,
            "referenceAgeSeconds": reference_age,
            "sampleSize": len(returns),
        },
        "edge": {
            "side": side,
            "price": selected_price,
            "executionLimitPrice": execution_limit_price,
            "fairProbability": selected_fair,
            "modelProbability": selected_model_probability,
            "minimumModelProbability": settings["minModelProbability"],
            "effectiveMinimumPrice": effective_min_price,
            "grossEdge": gross_edge,
            "feePerContract": fee_per_contract,
            "netEdge": net_edge,
            "conservativeProbability": conservative_probability,
            "conservativeEdge": conservative_edge,
            "minimumNetEdge": settings["minNetEdge"],
            "minimumConservativeEdge": settings["minConservativeEdge"],
            "adaptiveEdgePremium": adaptive_edge_premium,
            "effectiveMinimumNetEdge": effective_min_net_edge,
            "effectiveMinimumConservativeEdge": effective_min_conservative_edge,
        },
        "sizing": {
            "paperBankroll": bankroll,
            "riskPerTradePct": settings["riskPerTradePct"],
            "dailyPnl": daily_pnl,
            "dailyRealizedLoss": daily_realized_loss,
            "riskBudget": max_loss_budget,
            "standardRiskBudget": standard_risk_budget,
            "hardRiskBudget": hard_risk_budget,
            "scaledHardRiskBudget": scaled_hard_risk_budget,
            "kellyRiskBudget": kelly_budget,
            "probabilityStrength": probability_strength,
            "edgeStrength": edge_strength,
            "qualityRiskScale": quality_risk_scale,
            "priceRiskScale": price_risk_scale,
            "appliedRiskScale": applied_risk_scale,
            "fullKelly": full_kelly,
            "fractionalKelly": settings["fractionalKelly"],
            "bookParticipationPct": settings["maxBookParticipation"] * 100.0,
            "microSizingApplied": micro_sizing_applied,
            "microPositionLossCap": micro_position_loss_cap,
            "contracts": contracts,
            "estimatedFee": estimated_fee,
            "maximumLoss": max_loss,
            "expectedValue": expected_value,
        },
        "gates": gates,
        "config": settings,
        "methodology": {
            "settlementReference": "CF Benchmarks real-time index, 60-second settlement average",
            "spotReference": (
                "Official CF Benchmarks BRTI with final-minute settlement-average progress"
                if official_reference
                else "BRTI constituent-exchange proxy; official BRTI is the target settlement reference"
            ),
            "feeModel": "Kalshi general taker fee estimate",
            "probabilityModel": (
                "favorite-carry: normal digital probability on distance-to-strike, "
                "bounded momentum shift, market microprice blend, and monotone ladder prior"
            ),
            "directionMode": "normal",
            "samplePolicy": "deterministic fee-adjusted entry; no AI or random exploration overrides",
            "dailyLossPolicy": (
                "Realized profit and loss is informational and never blocks "
                "new entries"
            ),
            "orderPolicy": (
                "Kalshi Real IOC limit order signed and submitted by the backend only after every deterministic gate passes"
                if is_real_execution
                else "AlphaLab Paper IOC simulation at production Kalshi executable quotes; no exchange order is submitted"
            ),
        },
    }


__all__ = [
    "BTC_15M_SERIES",
    "DEFAULT_STRATEGY_CONFIG",
    "evaluate_btc15_contract",
    "kalshi_fee",
    "minute_return_series",
    "normalize_strategy_config",
    "realized_minute_volatility",
    "select_btc15_market",
]
