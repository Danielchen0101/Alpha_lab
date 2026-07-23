"""Deterministic research engine for Kalshi's 15-minute BTC contracts.

The engine is intentionally pure: it accepts a market snapshot and reference
prices, then returns an auditable paper-trading decision. It never signs or
submits an order.
"""

from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


BTC_15M_SERIES = "KXBTC15M"

DEFAULT_STRATEGY_CONFIG: Dict[str, Any] = {
    "executionMode": "paper",
    "paperBankroll": 1000.0,
    "riskPerTradePct": 0.35,
    "minNetEdge": 0.04,
    "minConservativeEdge": 0.015,
    "maxSpread": 0.06,
    "minDepthContracts": 15.0,
    "maxBookParticipation": 0.20,
    "minSecondsToClose": 180,
    "maxSecondsToClose": 600,
    "minPrice": 0.12,
    "maxPrice": 0.88,
    "marketBlendWeight": 0.25,
    "probabilityLogitScale": 1.55,
    "momentumProjectionScale": 0.15,
    "basisReserveBps": 6.0,
    "maxVolatilityRatio": 2.75,
    "maxJumpSigma": 4.0,
    "fractionalKelly": 0.25,
    "maxPortfolioExposurePct": 20.0,
    "executionPriceTolerance": 0.01,
    "exitProbabilityThreshold": 0.46,
    # Adaptive learning is deliberately opt-in and is applied only to Kalshi
    # AlphaLab Paper accounts. These values control review cadence and exploration
    # budget; deterministic risk gates remain authoritative.
    "learningMode": True,
    "learningAiMode": True,
    "preTradeAiReview": True,
    "learningContrarianMode": False,
    "learningExplorationRate": 0.30,
    "learningReviewEvery": 4,
    "learningWindowSize": 24,
    "learningMaxRiskPct": 0.50,
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
        "minNetEdge": (0.02, 0.15),
        "minConservativeEdge": (0.005, 0.08),
        "maxSpread": (0.01, 0.20),
        "minDepthContracts": (1.0, 10_000.0),
        "maxBookParticipation": (0.05, 0.50),
        "minSecondsToClose": (60.0, 360.0),
        "maxSecondsToClose": (300.0, 840.0),
        "minPrice": (0.01, 0.45),
        "maxPrice": (0.55, 0.99),
        "marketBlendWeight": (0.0, 0.50),
        "probabilityLogitScale": (1.20, 1.90),
        "momentumProjectionScale": (0.05, 0.30),
        "basisReserveBps": (3.0, 15.0),
        "maxVolatilityRatio": (1.5, 5.0),
        "maxJumpSigma": (2.5, 8.0),
        "fractionalKelly": (0.05, 0.50),
        "maxPortfolioExposurePct": (2.0, 50.0),
        "executionPriceTolerance": (0.0, 0.03),
        "exitProbabilityThreshold": (0.35, 0.49),
        "learningExplorationRate": (0.0, 0.35),
        "learningReviewEvery": (4.0, 24.0),
        "learningWindowSize": (12.0, 100.0),
        "learningMaxRiskPct": (0.10, 1.0),
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
    value["learningMode"] = value["learningMode"] if "learningMode" not in raw else raw.get("learningMode") is True
    value["learningAiMode"] = value["learningAiMode"] if "learningAiMode" not in raw else raw.get("learningAiMode") is True
    value["preTradeAiReview"] = value["preTradeAiReview"] if "preTradeAiReview" not in raw else raw.get("preTradeAiReview") is True
    value["learningContrarianMode"] = value["learningContrarianMode"] if "learningContrarianMode" not in raw else raw.get("learningContrarianMode") is True
    value["learningReviewEvery"] = int(value["learningReviewEvery"])
    value["learningWindowSize"] = int(value["learningWindowSize"])
    value["minSecondsToClose"] = int(value["minSecondsToClose"])
    value["maxSecondsToClose"] = max(
        int(value["maxSecondsToClose"]), value["minSecondsToClose"] + 30
    )
    if value["minPrice"] >= value["maxPrice"]:
        value["minPrice"], value["maxPrice"] = 0.08, 0.92
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
        "status": "pass" if passed else "block",
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
    book_time: Any = None,
    account_context: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Return a fail-closed Paper decision using model, book, and account evidence."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    settings = normalize_strategy_config(config)
    market = dict(market or {})
    account = dict(account_context or {})
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

    market_mid = indicative_market_yes
    if spot and strike and spot > 0 and strike > 0 and sigma_minute is not None and seconds_to_close > 0:
        minutes = max(seconds_to_close / 60.0, 0.25)
        # The basis reserve reflects that Coinbase spot is only a proxy for BRTI.
        basis_reserve = float(settings["basisReserveBps"]) / 10_000.0
        horizon_sigma = math.sqrt(max(sigma_minute, 0.00035) ** 2 * minutes + basis_reserve ** 2)
        momentum_3m = math.exp(sum(returns[-3:])) - 1.0 if returns else 0.0
        momentum_5m = math.exp(sum(returns[-5:])) - 1.0 if returns else 0.0
        momentum_15m = math.exp(sum(returns[-15:])) - 1.0 if returns else 0.0
        drift_per_minute = (
            0.50 * sum(returns[-3:]) / max(1, len(returns[-3:]))
            + 0.30 * sum(returns[-5:]) / max(1, len(returns[-5:]))
            + 0.20 * sum(returns[-15:]) / max(1, len(returns[-15:]))
        )
        projected_drift = _clamp(
            drift_per_minute * minutes * float(settings["momentumProjectionScale"]),
            -0.50 * horizon_sigma,
            0.50 * horizon_sigma,
        )
        distance_z = (math.log(spot / strike) + projected_drift) / max(horizon_sigma, 1e-9)
        # A logistic tail plus calibration shrink is less overconfident than a raw Gaussian digital.
        model_raw = 1.0 / (1.0 + math.exp(-_clamp(
            distance_z * float(settings["probabilityLogitScale"]), -8.0, 8.0
        )))
        sample_reliability = _clamp(len(returns) / 90.0, 0.55, 0.95)
        regime_reliability = _clamp(1.0 - max(0.0, (volatility_ratio or 1.0) - 1.0) * 0.12, 0.70, 1.0)
        reliability = sample_reliability * regime_reliability
        model_yes = _clamp(0.5 + (model_raw - 0.5) * reliability, 0.03, 0.97)
        original_model_yes = model_yes
        # A contrarian direction is never enabled from a single losing streak.
        # It is a persisted Paper-learning result that must first pass the
        # multi-window evidence checks in KalshiRobotState.
        if settings.get("learningMode") and settings.get("learningContrarianMode"):
            model_yes = 1.0 - model_yes
        else:
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
            0.018
            + 0.12 / math.sqrt(max(len(returns), 1))
            + (spread or settings["maxSpread"]) * 0.50
            + min(0.04, max(0.0, (volatility_ratio or 1.0) - 1.0) * 0.025)
            + min(0.05, disagreement * 0.15),
            0.025,
            0.15,
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
    if fair_yes is not None and quotes_valid:
        yes_edge = fair_yes - yes_ask
        no_edge = (1.0 - fair_yes) - no_ask
        if yes_edge >= no_edge:
            side, selected_price, selected_fair, gross_edge = "YES", yes_ask, fair_yes, yes_edge
            selected_depth = yes_ask_depth
            selected_near_depth = sum(
                size for price, size in no_levels
                if (1.0 - price) <= (yes_ask or 0.0) + 0.03
            ) or selected_depth
        else:
            side, selected_price, selected_fair, gross_edge = "NO", no_ask, 1.0 - fair_yes, no_edge
            selected_depth = no_ask_depth
            selected_near_depth = sum(
                size for price, size in yes_levels
                if (1.0 - price) <= (no_ask or 0.0) + 0.03
            ) or selected_depth
        fee_per_contract = kalshi_fee(selected_price)
        net_edge = gross_edge - fee_per_contract
        conservative_probability = max(0.0, selected_fair - uncertainty * 0.50)
        conservative_edge = conservative_probability - selected_price - fee_per_contract

    sample_ok = len(returns) >= 30 and sigma_minute is not None
    timing_ok = (
        settings["minSecondsToClose"] <= seconds_to_close <= settings["maxSecondsToClose"]
    )
    spread_ok = spread is not None and spread <= settings["maxSpread"]
    depth_ok = selected_depth >= settings["minDepthContracts"]
    price_ok = (
        selected_price is not None
        and settings["minPrice"] <= selected_price <= settings["maxPrice"]
    )
    edge_ok = net_edge is not None and net_edge >= settings["minNetEdge"]
    conservative_edge_ok = (
        conservative_edge is not None
        and conservative_edge >= settings["minConservativeEdge"]
    )
    strike_ok = bool(strike and strike > 0 and spot and spot > 0)
    volatility_ok = bool(
        volatility_ratio is not None
        and jump_sigma is not None
        and volatility_ratio <= settings["maxVolatilityRatio"]
        and jump_sigma <= settings["maxJumpSigma"]
    )
    model_market_gap = abs(model_yes - market_mid) if model_yes is not None and market_mid is not None else None
    model_agreement_ok = model_market_gap is not None and model_market_gap <= 0.30
    momentum_votes = [
        1 if value and value > 0 else -1 if value and value < 0 else 0
        for value in (momentum_3m, momentum_5m, momentum_15m)
    ]
    selected_vote = 1 if side == "YES" else -1 if side == "NO" else 0
    trend_support = sum(1 for vote in momentum_votes if vote == selected_vote)
    trend_conflict = sum(1 for vote in momentum_votes if vote == -selected_vote)
    trend_ok = side is not None and (trend_support >= 1 or trend_conflict < 2)
    book_pressure_ok = bool(
        side == "YES" and book_imbalance is not None and book_imbalance >= 0.15
        or side == "NO" and book_imbalance is not None and book_imbalance <= 0.85
    )
    reference_age = _age_seconds(reference_time, now)
    book_age = _age_seconds(book_time, now)
    reference_fresh = reference_age is None or reference_age <= 10.0
    book_fresh = book_age is None or book_age <= 8.0

    gates = [
        _gate("contract_active", is_active, "Active contract", "合约交易中", f"status={status or 'unknown'}", category="data"),
        _gate("entry_window", timing_ok, "Entry window", "进场时段", f"{max(0, int(seconds_to_close))}s / {settings['minSecondsToClose']}-{settings['maxSecondsToClose']}s", category="data"),
        _gate("reference_ready", strike_ok, "Reference price", "参考价格", "BRTI strike and BTC reference available" if strike_ok else "missing strike or reference", category="data"),
        _gate("data_freshness", reference_fresh and book_fresh, "Fresh evidence", "数据新鲜度", f"spot {reference_age:.1f}s / book {book_age:.1f}s" if reference_age is not None and book_age is not None else "timestamps supplied by live adapters", category="data"),
        _gate("history_sample", sample_ok, "Volatility sample", "波动率样本", f"{len(returns)} one-minute returns", category="data"),
        _gate("volatility_regime", volatility_ok, "Stable volatility regime", "波动状态", f"ratio {(volatility_ratio or 0.0):.2f} / jump {(jump_sigma or 0.0):.1f} sigma", category="signal"),
        _gate("model_market_agreement", model_agreement_ok, "Model-market agreement", "模型市场一致性", f"gap {(model_market_gap or 0.0) * 100:.1f}pp / max 30.0pp", category="signal"),
        _gate("trend_confirmation", trend_ok, "Multi-horizon confirmation", "多周期确认", f"{trend_support} support / {trend_conflict} oppose", category="signal"),
        _gate("two_sided_quote", quotes_valid, "Two-sided market", "双边报价", "YES and NO bid books derive executable asks" if quotes_valid else "quote unavailable", category="execution"),
        _gate("spread", spread_ok, "Spread limit", "点差限制", f"{spread * 100:.1f}c / max {settings['maxSpread'] * 100:.1f}c" if spread is not None else "no executable spread", category="execution"),
        _gate("depth", depth_ok, "Top-level depth", "可执行深度", f"{selected_depth:.0f} top / {selected_near_depth:.0f} within 3c / min {settings['minDepthContracts']:.0f}", category="execution"),
        _gate("book_pressure", book_pressure_ok, "Adverse book pressure", "盘口逆向压力", f"YES imbalance {(book_imbalance or 0.0) * 100:.0f}%", category="execution"),
        _gate("price_band", price_ok, "Price band", "价格区间", f"{selected_price * 100:.1f}c" if selected_price is not None else "no executable price", category="execution"),
        _gate("net_edge", edge_ok, "Fee-adjusted edge", "扣费后边际", f"{net_edge * 100:.1f}pp / min {settings['minNetEdge'] * 100:.1f}pp" if net_edge is not None else "edge unavailable", category="signal"),
        _gate("conservative_edge", conservative_edge_ok, "Uncertainty-adjusted edge", "不确定性后边际", f"{conservative_edge * 100:.1f}pp / min {settings['minConservativeEdge'] * 100:.1f}pp" if conservative_edge is not None else "edge unavailable", category="signal"),
    ]

    if account:
        bankroll = _number(account.get("bankroll"), settings["paperBankroll"]) or settings["paperBankroll"]
        exposure = max(0.0, _number(account.get("portfolioExposure"), 0.0) or 0.0)
        exposure_pct = exposure / max(bankroll, 1.0) * 100.0
        account_gates = [
            _gate("account_ready", bankroll > 0, "Paper account ready", "Paper 账户可用", f"portfolio {bankroll:.2f}", category="account"),
            _gate("market_flat", not bool(account.get("hasPosition")), "No duplicate position", "无重复持仓", "current contract is flat" if not account.get("hasPosition") else "position already exists", category="account"),
            _gate("open_order", not bool(account.get("hasOpenOrder")), "No open order", "无未完成订单", "no resting order for this contract" if not account.get("hasOpenOrder") else "open order already exists", category="account"),
            _gate("portfolio_exposure", exposure_pct < settings["maxPortfolioExposurePct"], "Portfolio exposure", "组合总敞口", f"{exposure_pct:.1f}% / max {settings['maxPortfolioExposurePct']:.1f}%", category="account"),
            _gate("loss_cooldown", not bool(account.get("cooldownActive")), "Loss-streak cooldown", "连败冷却", str(account.get("cooldownDetail") or "clear"), category="account"),
        ]
        gates.extend(account_gates)

    blocking = [gate["key"] for gate in gates if gate["status"] == "block"]

    # Paper exploration collects evidence from near-threshold, positive-edge
    # candidates. It may only override the two statistical edge thresholds;
    # stale data, spread, depth, book pressure, cash, exposure and
    # all other execution/account gates remain authoritative.
    exploration_trade = False
    exploration_overrides: List[str] = []
    edge_only_blocks = set(blocking).issubset({"net_edge", "conservative_edge"})
    near_threshold = bool(
        net_edge is not None
        and conservative_edge is not None
        and net_edge > 0.0
        and conservative_edge >= -0.005
    )
    if (
        settings.get("executionMode") == "paper"
        and settings.get("learningMode")
        and blocking
        and edge_only_blocks
        and near_threshold
        and side in {"YES", "NO"}
    ):
        identity = f"{market.get('ticker') or ''}:{side}"
        bucket = int(hashlib.sha256(identity.encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF
        if bucket < float(settings.get("learningExplorationRate") or 0.0):
            exploration_trade = True
            exploration_overrides = list(blocking)
            blocking = []
            for gate in gates:
                if gate.get("key") in exploration_overrides:
                    gate["status"] = "pass"
                    gate["detail"] = f"{gate.get('detail')} · Paper exploration sample"

    bankroll = _number(account.get("bankroll"), settings["paperBankroll"]) or settings["paperBankroll"]
    hard_risk_budget = bankroll * settings["riskPerTradePct"] / 100.0
    full_kelly = 0.0
    if conservative_probability is not None and selected_price is not None and fee_per_contract is not None:
        full_kelly = max(0.0, (conservative_probability - selected_price - fee_per_contract) / max(1.0 - selected_price, 0.01))
    kelly_budget = bankroll * full_kelly * settings["fractionalKelly"]
    max_loss_budget = min(hard_risk_budget, kelly_budget) if kelly_budget > 0 else 0.0
    if exploration_trade and selected_price is not None and fee_per_contract is not None:
        max_loss_budget = min(hard_risk_budget, max_loss_budget if max_loss_budget > 0 else hard_risk_budget)
    contracts = 0
    estimated_fee = 0.0
    max_loss = 0.0
    expected_value = 0.0
    if not blocking and selected_price is not None and fee_per_contract is not None:
        unit_cost = selected_price + fee_per_contract
        depth_cap = int(selected_depth * settings["maxBookParticipation"])
        cash_available = _number(account.get("cashAvailable"), bankroll) or bankroll
        cash_cap = int(cash_available // max(unit_cost, 0.01))
        contracts = min(
            depth_cap,
            cash_cap,
            int(max_loss_budget // max(unit_cost, 0.01)),
        )
        if contracts <= 0:
            blocking.append("position_size")
            gates.append(_gate("position_size", False, "Executable position size", "可执行仓位", "Kelly/risk/depth caps are below one contract", category="account"))
        else:
            estimated_fee = kalshi_fee(selected_price, contracts)
            max_loss = selected_price * contracts + estimated_fee
            expected_value = (conservative_edge or 0.0) * contracts

    action = f"BUY_{side}" if side and not blocking and contracts > 0 else "WAIT"
    signal_quality = int(round(_clamp(
        35.0
        + (conservative_edge or -0.05) * 420.0
        + min(len(returns), 90) / 12.0
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
    return {
        "engine": "btc15_probability_v2",
        "generatedAt": _iso(now),
        "paperOnly": settings.get("executionMode") != "real",
        "executionEnvironment": "kalshi_real" if settings.get("executionMode") == "real" else "alphalab_paper",
        "action": action,
        "side": side,
        "signalQuality": signal_quality,
        "blockingReasons": blocking,
        "explorationTrade": exploration_trade,
        "explorationOverrides": exploration_overrides,
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
            "momentum3m": momentum_3m,
            "momentum5m": momentum_5m,
            "momentum15m": momentum_15m,
            "volatilityRatio": volatility_ratio,
            "jumpSigma": jump_sigma,
            "marketYesProbability": market_mid,
            "rawModelYesProbability": model_raw,
            "originalModelYesProbability": original_model_yes if 'original_model_yes' in locals() else model_yes,
            "modelYesProbability": model_yes,
            "fairYesProbability": fair_yes,
            "marketWeight": market_weight,
            "uncertainty": uncertainty,
            "referenceAgeSeconds": reference_age,
            "sampleSize": len(returns),
        },
        "edge": {
            "side": side,
            "price": selected_price,
            "fairProbability": selected_fair,
            "grossEdge": gross_edge,
            "feePerContract": fee_per_contract,
            "netEdge": net_edge,
            "conservativeProbability": conservative_probability,
            "conservativeEdge": conservative_edge,
            "minimumNetEdge": settings["minNetEdge"],
            "minimumConservativeEdge": settings["minConservativeEdge"],
        },
        "sizing": {
            "paperBankroll": bankroll,
            "riskPerTradePct": settings["riskPerTradePct"],
            "riskBudget": max_loss_budget,
            "hardRiskBudget": hard_risk_budget,
            "fullKelly": full_kelly,
            "fractionalKelly": settings["fractionalKelly"],
            "bookParticipationPct": settings["maxBookParticipation"] * 100.0,
            "contracts": contracts,
            "estimatedFee": estimated_fee,
            "maximumLoss": max_loss,
            "expectedValue": expected_value,
        },
        "gates": gates,
        "config": settings,
        "methodology": {
            "settlementReference": "CF Benchmarks BRTI 60-second averages",
            "spotReference": "Coinbase Exchange BTC-USD",
            "feeModel": "Kalshi general taker fee estimate",
            "probabilityModel": "volatility ensemble, bounded momentum, market microprice, and uncertainty shrinkage",
            "directionMode": "contrarian" if settings.get("learningContrarianMode") else "normal",
            "samplePolicy": "one-contract near-threshold Paper exploration; hard data, execution and account gates remain binding" if exploration_trade else "standard edge-qualified entry",
            "orderPolicy": "AlphaLab Paper IOC simulation at production Kalshi executable quotes; no exchange order is submitted",
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
