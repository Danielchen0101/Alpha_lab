"""Helios Regime Ensemble — pure-Python crypto research and risk engine (v2).

A complete redesign of the original single-model "Adaptive Trend Allocation"
engine.  The v2 engine is a *regime-switching multi-strategy ensemble* for
spot BTC/USD and ETH/USD, built on ideas with published evidence:

* Trend following + time-series momentum across multiple horizons
  (Moskowitz, Ooi & Pedersen, "Time Series Momentum").
* Mean reversion performs best in range-bound / low-volume regimes while
  trend following wins in directional regimes (QuantPedia, "Revisiting
  Trend-following and Mean-reversion Strategies in Bitcoin", SSRN 4955617).
* Volatility-targeted position sizing materially improves crypto
  risk-adjusted returns (vol-scaled BTC trend research, 2018-2025).
* Transaction-cost aware execution: weak hourly edges must clear fees before
  they are allowed to trade (Bysik & Ślepaczuk, arXiv 2606.00060).

Four explainable sleeves vote in [-1, +1] and are combined with
regime-dependent weights:

    1. Trend        — EMA structure, long anchor and anchor slope.
    2. Breakout     — Donchian channel breaks with volume confirmation.
    3. Momentum     — 3d / 20d / 65d time-series momentum.
    4. MeanRev      — Bollinger z-score + fast RSI dip/fade logic.

A market regime (``trend_up``, ``trend_down``, ``range``, ``panic``) is
detected from ADX, EMA structure and a volatility-expansion ratio.  An
optional deep-learning advisor (see ``crypto_ml.py``) may nudge the composite
score by a bounded number of points and can veto marginal entries, but it can
never force a trade on its own.

The engine deliberately has no broker, database, web-framework, NumPy, or
Pandas dependency.  Signals are formed at the close of a complete bar and
backtests fill them at the *next* bar's open — the same anti-look-ahead
timing contract as v1.  The public API is a superset of v1, so existing
callers (crypto_api.py, the 24/7 scheduler and the calibration loop) keep
working unchanged.
"""

from __future__ import annotations

import copy
import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


ALGORITHM_NAME = "Helios Regime Ensemble"
ALGORITHM_VERSION = "2.0.0"
SUPPORTED_SYMBOLS: Tuple[str, ...] = ("BTC/USD", "ETH/USD")
BAR_INTERVAL_SECONDS = 60 * 60
SUPPORTED_BARS_PER_DAY = frozenset({24, 96})
SEVEN_DAY_COOLDOWN_HOURS = 72

REGIMES = ("trend_up", "trend_down", "range", "panic")

# Regime-dependent sleeve weight multipliers.  These are fixed by design so
# that user-tunable base weights stay interpretable: the matrix expresses the
# published stylized fact that trend sleeves should dominate directional
# regimes while mean reversion should dominate ranges.
REGIME_WEIGHT_MULTIPLIERS: Dict[str, Dict[str, float]] = {
    "trend_up":   {"trend": 1.20, "breakout": 1.10, "momentum": 1.10, "meanrev": 0.40},
    "trend_down": {"trend": 1.20, "breakout": 1.00, "momentum": 1.10, "meanrev": 0.30},
    "range":      {"trend": 0.50, "breakout": 0.70, "momentum": 0.60, "meanrev": 1.50},
    "panic":      {"trend": 1.30, "breakout": 1.20, "momentum": 1.20, "meanrev": 0.00},
}
PANIC_SCORE_PENALTY = 0.25  # composite-space penalty applied in panic regime


DEFAULT_CONFIG: Dict[str, Any] = {
    "symbols": list(SUPPORTED_SYMBOLS),
    "bars_per_day": 24,
    # ---- Trend sleeve (legacy field names kept for config compatibility) ----
    "ema_fast": 10,
    "ema_slow": 40,
    "anchor_ema": 200,              # long structural anchor, in bars
    # ---- Momentum sleeve ----
    "momentum_fast_days": 20,
    "momentum_slow_days": 65,
    # ---- Breakout sleeve ----
    "breakout_days": 20,
    "breakdown_days": 10,
    # ---- Mean-reversion sleeve ----
    "rsi_period": 14,
    "rsi_fast_period": 3,
    "bollinger_period": 20,         # bars
    "meanrev_entry_z": -1.25,
    "meanrev_rsi_buy": 30.0,
    "meanrev_size_fraction": 0.6,
    # ---- Regime detection ----
    "adx_period": 14,
    "adx_trend_threshold": 22.0,
    "vol_fast_days": 7,
    "panic_vol_ratio": 1.75,
    # ---- Ensemble base weights ----
    "weight_trend": 0.30,
    "weight_breakout": 0.25,
    "weight_momentum": 0.25,
    "weight_meanrev": 0.20,
    # ---- Volatility / risk ----
    "atr_hours": 24,
    "volatility_days": 30,
    "annual_volatility_target": 0.15,
    "high_volatility_threshold": 1.00,
    "stop_atr_multiple": 2.5,
    "trail_atr_multiple": 3.0,
    "min_stop_distance_pct": 0.02,
    "max_stop_distance_pct": 0.12,
    # ---- Entry / exit discipline ----
    "entry_confirmation_bars": 2,
    "exit_confirmation_bars": 2,
    "entry_score": 58.0,
    "add_score": 78.0,
    "reduce_score": 40.0,
    "max_asset_weight": 0.20,
    "rebalance_band": 0.02,
    "add_min_price_gain_pct": 0.03,
    "reduced_weight_fraction": 0.25,
    # ---- Deep-learning advisor gate ----
    "ml_gate_enabled": True,
    "ml_max_adjust": 12.0,
    "ml_veto_threshold": 0.42,
    # ---- Costs (Alpaca tier-1 taker ≈ 25 bps) ----
    "fee_bps": 25.0,
    "slippage_bps": 5.0,
    # ---- Capital-protection circuits ----
    "daily_loss_limit": 0.015,
    "seven_day_loss_limit": 0.04,
    "max_drawdown_limit": 0.08,
    "data_stale_minutes": 90,
    # ---- Legacy MACD fields (informational indicator; kept configurable) ----
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
}

_BOOLEAN_FIELDS = ("ml_gate_enabled",)

_INTEGER_FIELDS = (
    "bars_per_day",
    "ema_fast",
    "ema_slow",
    "anchor_ema",
    "momentum_fast_days",
    "momentum_slow_days",
    "atr_hours",
    "volatility_days",
    "vol_fast_days",
    "breakout_days",
    "breakdown_days",
    "rsi_period",
    "rsi_fast_period",
    "bollinger_period",
    "adx_period",
    "macd_fast",
    "macd_slow",
    "macd_signal",
    "entry_confirmation_bars",
    "exit_confirmation_bars",
    "data_stale_minutes",
)

_NUMBER_FIELDS = (
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
    "trail_atr_multiple",
    "min_stop_distance_pct",
    "max_stop_distance_pct",
    "fee_bps",
    "slippage_bps",
    "daily_loss_limit",
    "seven_day_loss_limit",
    "max_drawdown_limit",
    "adx_trend_threshold",
    "panic_vol_ratio",
    "weight_trend",
    "weight_breakout",
    "weight_momentum",
    "weight_meanrev",
    "meanrev_entry_z",
    "meanrev_rsi_buy",
    "meanrev_size_fraction",
    "ml_max_adjust",
    "ml_veto_threshold",
)


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


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def validate_config(config: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    """Return a validated, fully populated strategy configuration.

    Unknown fields are rejected so a misspelled safety setting cannot
    silently fall back to a default value.  Every v1 field remains a valid
    field with an unchanged meaning, so previously saved strategies and the
    calibration candidate library validate without migration.
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

    for field in _BOOLEAN_FIELDS:
        raw = resolved.get(field)
        if isinstance(raw, bool):
            continue
        if raw in (0, 1):
            resolved[field] = bool(raw)
        else:
            raise CryptoEngineError(f"{field} must be true or false")

    for field in _INTEGER_FIELDS:
        raw = _finite_number(resolved[field], field, positive=True)
        if int(raw) != raw:
            raise CryptoEngineError(f"{field} must be a whole number")
        resolved[field] = int(raw)

    if resolved["bars_per_day"] not in SUPPORTED_BARS_PER_DAY:
        raise CryptoEngineError("bars_per_day must be 24 or 96 for contiguous crypto bars")

    for field in _NUMBER_FIELDS:
        resolved[field] = _finite_number(resolved[field], field)

    if resolved["ema_fast"] >= resolved["ema_slow"]:
        raise CryptoEngineError("ema_fast must be below ema_slow")
    if resolved["macd_fast"] >= resolved["macd_slow"]:
        raise CryptoEngineError("macd_fast must be below macd_slow")
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
        "meanrev_size_fraction",
    ):
        if not 0 < resolved[field] <= 1:
            raise CryptoEngineError(f"{field} must be in (0, 1]")
    if resolved["rebalance_band"] >= resolved["max_asset_weight"]:
        raise CryptoEngineError("rebalance_band must be below max_asset_weight")
    for field in (
        "annual_volatility_target",
        "high_volatility_threshold",
        "stop_atr_multiple",
        "trail_atr_multiple",
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

    if not 0 <= resolved["adx_trend_threshold"] <= 100:
        raise CryptoEngineError("adx_trend_threshold must be between 0 and 100")
    if resolved["panic_vol_ratio"] <= 1.0:
        raise CryptoEngineError("panic_vol_ratio must be above one")
    weight_total = 0.0
    for field in ("weight_trend", "weight_breakout", "weight_momentum", "weight_meanrev"):
        if not 0 <= resolved[field] <= 1:
            raise CryptoEngineError(f"{field} must be between 0 and 1")
        weight_total += resolved[field]
    if weight_total <= 0:
        raise CryptoEngineError("ensemble sleeve weights cannot all be zero")
    if not -4.0 <= resolved["meanrev_entry_z"] <= 0.0:
        raise CryptoEngineError("meanrev_entry_z must be between -4 and 0")
    if not 0 < resolved["meanrev_rsi_buy"] <= 50:
        raise CryptoEngineError("meanrev_rsi_buy must be in (0, 50]")
    if not 0 <= resolved["ml_max_adjust"] <= 30:
        raise CryptoEngineError("ml_max_adjust must be between 0 and 30 score points")
    if not 0 <= resolved["ml_veto_threshold"] <= 0.5:
        raise CryptoEngineError("ml_veto_threshold must be between 0 and 0.5")
    # The fast volatility window must stay inside the slow window.  Short
    # cadence presets shrink volatility_days aggressively, so clamp instead of
    # failing to preserve backwards compatibility with saved configurations.
    if resolved["vol_fast_days"] >= resolved["volatility_days"]:
        resolved["vol_fast_days"] = max(1, resolved["volatility_days"] - 1)
    return resolved


def required_history_bars(config: Optional[Mapping[str, Any]] = None) -> int:
    cfg = validate_config(config)
    per_day = cfg["bars_per_day"]
    return max(
        cfg["ema_slow"],
        cfg["anchor_ema"] + per_day + 1,          # anchor value plus slope lookback
        cfg["momentum_slow_days"] * per_day + 1,
        cfg["volatility_days"] * per_day + 1,
        cfg["vol_fast_days"] * per_day + 1,
        cfg["breakout_days"] * per_day + 1,
        cfg["breakdown_days"] * per_day + 1,
        cfg["atr_hours"] + 1,
        cfg["rsi_period"] + 2,
        cfg["rsi_fast_period"] + 2,
        cfg["bollinger_period"] + 1,
        cfg["adx_period"] * 3 + 1,
        cfg["macd_slow"] + cfg["macd_signal"] + 1,
        3 * per_day + 1,                          # momentum_3d
        7 * per_day + 1,                          # volume z-score window
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
    """Validate contiguous OHLCV bars in ascending timestamp order.

    Indicator lookbacks are expressed in elapsed bars and days.  Silently
    accepting a missing or sub-interval observation would turn those
    lookbacks into a different strategy, so discontinuities fail closed.
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


class _WilderRsi:
    """Wilder-smoothed RSI computed incrementally and causally."""

    def __init__(self, period: int):
        self.period = period
        self.avg_gain: Optional[float] = None
        self.avg_loss: Optional[float] = None
        self.previous_close: Optional[float] = None
        self.samples = 0
        self._gains: List[float] = []
        self._losses: List[float] = []

    def update(self, close: float) -> Optional[float]:
        if self.previous_close is None:
            self.previous_close = close
            return None
        change = close - self.previous_close
        self.previous_close = close
        gain = max(change, 0.0)
        loss = max(-change, 0.0)
        self.samples += 1
        if self.avg_gain is None:
            self._gains.append(gain)
            self._losses.append(loss)
            if self.samples < self.period:
                return None
            self.avg_gain = _mean(self._gains)
            self.avg_loss = _mean(self._losses)
            self._gains = []
            self._losses = []
        else:
            self.avg_gain = (self.avg_gain * (self.period - 1) + gain) / self.period
            self.avg_loss = (self.avg_loss * (self.period - 1) + loss) / self.period
        if self.avg_loss <= 1e-12:
            return 100.0
        rs = self.avg_gain / self.avg_loss
        return 100.0 - 100.0 / (1.0 + rs)


class _WilderAdx:
    """Wilder ADX with directional movement, computed incrementally."""

    def __init__(self, period: int):
        self.period = period
        self.prev_high: Optional[float] = None
        self.prev_low: Optional[float] = None
        self.prev_close: Optional[float] = None
        self.tr_smooth: Optional[float] = None
        self.plus_smooth: Optional[float] = None
        self.minus_smooth: Optional[float] = None
        self.adx: Optional[float] = None
        self._tr: List[float] = []
        self._plus: List[float] = []
        self._minus: List[float] = []
        self._dx: List[float] = []

    def update(self, high: float, low: float, close: float) -> Optional[float]:
        if self.prev_close is None:
            self.prev_high, self.prev_low, self.prev_close = high, low, close
            return None
        up_move = high - self.prev_high
        down_move = self.prev_low - low
        plus_dm = up_move if (up_move > down_move and up_move > 0) else 0.0
        minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0
        tr = max(high - low, abs(high - self.prev_close), abs(low - self.prev_close))
        self.prev_high, self.prev_low, self.prev_close = high, low, close

        if self.tr_smooth is None:
            self._tr.append(tr)
            self._plus.append(plus_dm)
            self._minus.append(minus_dm)
            if len(self._tr) < self.period:
                return None
            self.tr_smooth = sum(self._tr)
            self.plus_smooth = sum(self._plus)
            self.minus_smooth = sum(self._minus)
            self._tr, self._plus, self._minus = [], [], []
        else:
            self.tr_smooth = self.tr_smooth - self.tr_smooth / self.period + tr
            self.plus_smooth = self.plus_smooth - self.plus_smooth / self.period + plus_dm
            self.minus_smooth = self.minus_smooth - self.minus_smooth / self.period + minus_dm

        if self.tr_smooth <= 1e-12:
            dx = 0.0
        else:
            plus_di = 100.0 * self.plus_smooth / self.tr_smooth
            minus_di = 100.0 * self.minus_smooth / self.tr_smooth
            di_sum = plus_di + minus_di
            dx = 100.0 * abs(plus_di - minus_di) / di_sum if di_sum > 1e-12 else 0.0

        if self.adx is None:
            self._dx.append(dx)
            if len(self._dx) < self.period:
                return None
            self.adx = _mean(self._dx)
            self._dx = []
        else:
            self.adx = (self.adx * (self.period - 1) + dx) / self.period
        return self.adx


def compute_indicators(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Compute the causal indicator stack for the ensemble.

    Breakout/breakdown reference levels and z-score baselines intentionally
    exclude the current bar, so every row depends only on information
    available by that row's close.
    """

    cfg = validate_config(config)
    normalized = normalize_bars(bars, cfg)
    per_day = cfg["bars_per_day"]
    momentum_short_window = 3 * per_day
    momentum_fast_window = cfg["momentum_fast_days"] * per_day
    momentum_slow_window = cfg["momentum_slow_days"] * per_day
    volatility_window = cfg["volatility_days"] * per_day
    vol_fast_window = cfg["vol_fast_days"] * per_day
    breakout_window = cfg["breakout_days"] * per_day
    breakdown_window = cfg["breakdown_days"] * per_day
    volume_window = 7 * per_day
    atr_window = cfg["atr_hours"]
    boll_window = cfg["bollinger_period"]
    annualization = math.sqrt(365 * per_day)

    alpha_fast = 2.0 / (cfg["ema_fast"] + 1.0)
    alpha_slow = 2.0 / (cfg["ema_slow"] + 1.0)
    alpha_anchor = 2.0 / (cfg["anchor_ema"] + 1.0)
    alpha_macd_fast = 2.0 / (cfg["macd_fast"] + 1.0)
    alpha_macd_slow = 2.0 / (cfg["macd_slow"] + 1.0)
    alpha_macd_signal = 2.0 / (cfg["macd_signal"] + 1.0)

    ema_fast: Optional[float] = None
    ema_slow: Optional[float] = None
    ema_anchor: Optional[float] = None
    macd_fast_ema: Optional[float] = None
    macd_slow_ema: Optional[float] = None
    macd_signal_ema: Optional[float] = None
    macd_signal_samples = 0
    anchor_history: List[float] = []
    rsi = _WilderRsi(cfg["rsi_period"])
    rsi_fast = _WilderRsi(cfg["rsi_fast_period"])
    adx = _WilderAdx(cfg["adx_period"])

    closes: List[float] = []
    highs: List[float] = []
    lows: List[float] = []
    log_volumes: List[float] = []
    log_returns: List[float] = []
    true_ranges: List[float] = []
    output: List[Dict[str, Any]] = []

    for index, bar in enumerate(normalized):
        close = bar["close"]
        ema_fast = close if ema_fast is None else alpha_fast * close + (1 - alpha_fast) * ema_fast
        ema_slow = close if ema_slow is None else alpha_slow * close + (1 - alpha_slow) * ema_slow
        ema_anchor = close if ema_anchor is None else alpha_anchor * close + (1 - alpha_anchor) * ema_anchor
        macd_fast_ema = close if macd_fast_ema is None else alpha_macd_fast * close + (1 - alpha_macd_fast) * macd_fast_ema
        macd_slow_ema = close if macd_slow_ema is None else alpha_macd_slow * close + (1 - alpha_macd_slow) * macd_slow_ema
        macd_line = macd_fast_ema - macd_slow_ema
        if index + 1 >= cfg["macd_slow"]:
            macd_signal_ema = (
                macd_line if macd_signal_ema is None
                else alpha_macd_signal * macd_line + (1 - alpha_macd_signal) * macd_signal_ema
            )
            macd_signal_samples += 1

        previous_close = closes[-1] if closes else close
        true_range = max(
            bar["high"] - bar["low"],
            abs(bar["high"] - previous_close),
            abs(bar["low"] - previous_close),
        )
        true_ranges.append(true_range)
        if closes:
            log_returns.append(math.log(close / closes[-1]))

        rsi_value = rsi.update(close)
        rsi_fast_value = rsi_fast.update(close)
        adx_value = adx.update(bar["high"], bar["low"], close)

        high_break = max(highs[index - breakout_window : index]) if index >= breakout_window else None
        low_break = min(lows[index - breakdown_window : index]) if index >= breakdown_window else None
        momentum_3d = close / closes[index - momentum_short_window] - 1 if index >= momentum_short_window else None
        momentum_fast_v = close / closes[index - momentum_fast_window] - 1 if index >= momentum_fast_window else None
        momentum_slow_v = close / closes[index - momentum_slow_window] - 1 if index >= momentum_slow_window else None
        atr_value = _mean(true_ranges[-atr_window:]) if len(true_ranges) >= atr_window else None

        vol_slow_value: Optional[float] = None
        vol_fast_value: Optional[float] = None
        if len(log_returns) >= volatility_window:
            vol_slow_value = _sample_stdev(log_returns[-volatility_window:]) * annualization
        if len(log_returns) >= vol_fast_window:
            vol_fast_value = _sample_stdev(log_returns[-vol_fast_window:]) * annualization
        if vol_fast_value is None or vol_slow_value is None:
            vol_ratio: Optional[float] = None
        elif vol_slow_value > 1e-9:
            vol_ratio = vol_fast_value / vol_slow_value
        else:
            # A flat tape has no measurable volatility; report "no expansion"
            # instead of refusing to signal on an otherwise complete history.
            vol_ratio = 1.0

        zscore: Optional[float] = None
        if index >= boll_window:
            window_closes = closes[index - boll_window : index]
            boll_mean = _mean(window_closes)
            boll_std = _sample_stdev(window_closes)
            if boll_std > 1e-12:
                zscore = (close - boll_mean) / boll_std
            else:
                zscore = 0.0

        volume_z: Optional[float] = None
        if index >= volume_window:
            window_vol = log_volumes[index - volume_window : index]
            vol_mean = _mean(window_vol)
            vol_std = _sample_stdev(window_vol)
            current_log_volume = math.log1p(max(0.0, bar["volume"]))
            volume_z = (current_log_volume - vol_mean) / vol_std if vol_std > 1e-12 else 0.0

        anchor_slope_pct: Optional[float] = None
        if len(anchor_history) >= per_day and index + 1 >= cfg["anchor_ema"]:
            baseline = anchor_history[-per_day]
            if baseline > 0:
                anchor_slope_pct = (ema_anchor / baseline - 1.0) * 100.0

        donchian_pos: Optional[float] = None
        if high_break is not None and low_break is not None and high_break > low_break:
            donchian_pos = _clamp((close - low_break) / (high_break - low_break), 0.0, 1.0)

        macd_hist_pct: Optional[float] = None
        if macd_signal_ema is not None and macd_signal_samples >= cfg["macd_signal"] and close > 0:
            macd_hist_pct = (macd_line - macd_signal_ema) / close * 100.0

        output.append(
            {
                **bar,
                # v1-compatible indicator keys
                "ema_10": ema_fast if index + 1 >= cfg["ema_fast"] else None,
                "ema_40": ema_slow if index + 1 >= cfg["ema_slow"] else None,
                "momentum_20d": momentum_fast_v,
                "momentum_65d": momentum_slow_v,
                "atr_24h": atr_value,
                "annualized_volatility_30d": vol_slow_value,
                "high_20d": high_break,
                "low_10d": low_break,
                "breakout_20d": high_break is not None and close > high_break,
                "breakdown_10d": low_break is not None and close < low_break,
                # v2 ensemble indicators
                "ema_anchor": ema_anchor if index + 1 >= cfg["anchor_ema"] else None,
                "anchor_slope_pct": anchor_slope_pct,
                "momentum_3d": momentum_3d,
                "rsi": rsi_value,
                "rsi_fast": rsi_fast_value,
                "adx": adx_value,
                "zscore": zscore,
                "macd_hist_pct": macd_hist_pct,
                "vol_fast_annualized": vol_fast_value,
                "vol_ratio": vol_ratio,
                "volume_z": volume_z,
                "donchian_pos": donchian_pos,
                "atr_pct": (atr_value / close) if atr_value is not None and close > 0 else None,
            }
        )
        closes.append(close)
        highs.append(bar["high"])
        lows.append(bar["low"])
        log_volumes.append(math.log1p(max(0.0, bar["volume"])))
        anchor_history.append(ema_anchor)
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

    This function reports policy requirements but deliberately does not keep
    a clock or acknowledgement ledger.  The durable controller owns the start
    of a 72-hour cooldown and the explicit acknowledgement of a drawdown
    review.
    """

    cfg = validate_config(config)
    if state is not None and not isinstance(state, Mapping):
        raise CryptoEngineError("risk state must be an object")
    values = dict(state or {})
    daily_return = _finite_number(values.get("daily_return", 0.0), "daily_return")
    seven_day_return = _finite_number(values.get("seven_day_return", 0.0), "seven_day_return")
    drawdown = _finite_number(values.get("drawdown", 0.0), "drawdown")
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


def _validated_ml_signal(ml_signal: Optional[Mapping[str, Any]]) -> Optional[Dict[str, Any]]:
    if ml_signal is None:
        return None
    if not isinstance(ml_signal, Mapping):
        raise CryptoEngineError("ml_signal must be an object")
    probability = ml_signal.get("probability_up")
    if probability is None:
        return None
    value = _finite_number(probability, "ml probability_up")
    if not 0.0 <= value <= 1.0:
        raise CryptoEngineError("ml probability_up must be between 0 and 1")
    result = {
        "probability_up": value,
        "model_version": str(ml_signal.get("model_version") or ""),
    }
    auc = ml_signal.get("validation_auc")
    if auc is not None:
        result["validation_auc"] = _finite_number(auc, "ml validation_auc")
    return result


def _detect_regime(row: Mapping[str, Any], cfg: Mapping[str, Any]) -> str:
    close = float(row["close"])
    ema_fast = float(row["ema_10"])
    ema_slow = float(row["ema_40"])
    ema_anchor = float(row["ema_anchor"])
    adx_value = float(row["adx"])
    vol_ratio = row.get("vol_ratio")
    momentum_3d = row.get("momentum_3d")
    if (
        vol_ratio is not None
        and float(vol_ratio) >= cfg["panic_vol_ratio"]
        and momentum_3d is not None
        and float(momentum_3d) < 0
    ):
        return "panic"
    if adx_value >= cfg["adx_trend_threshold"]:
        if ema_fast > ema_slow and close > ema_anchor:
            return "trend_up"
        if ema_fast < ema_slow and close < ema_anchor:
            return "trend_down"
    return "range"


def _sleeve_votes(row: Mapping[str, Any], cfg: Mapping[str, Any]) -> Dict[str, float]:
    close = float(row["close"])
    ema_fast = float(row["ema_10"])
    ema_slow = float(row["ema_40"])
    ema_anchor = float(row["ema_anchor"])
    anchor_slope = float(row["anchor_slope_pct"]) if row.get("anchor_slope_pct") is not None else 0.0
    zscore = float(row["zscore"])
    rsi_fast_value = float(row["rsi_fast"])
    volume_z = float(row["volume_z"]) if row.get("volume_z") is not None else 0.0
    donchian_pos = float(row["donchian_pos"]) if row.get("donchian_pos") is not None else 0.5
    momentum_3d = float(row["momentum_3d"])
    momentum_fast = float(row["momentum_20d"])
    momentum_slow = float(row["momentum_65d"])

    # --- Trend sleeve: EMA gap, anchor side, anchor slope -------------------
    ema_gap_pct = (ema_fast - ema_slow) / ema_slow * 100.0 if ema_slow > 0 else 0.0
    trend_vote = (
        0.45 * _clamp(ema_gap_pct / 2.0)
        + 0.30 * (1.0 if close > ema_anchor else -1.0)
        + 0.25 * _clamp(anchor_slope / 0.30)
    )

    # --- Breakout sleeve: Donchian breaks with volume confirmation ----------
    if bool(row["breakdown_10d"]):
        breakout_vote = -1.0
    elif bool(row["breakout_20d"]):
        breakout_vote = 1.0 if volume_z >= 0.5 else 0.6
    elif row.get("high_20d") is not None and close >= float(row["high_20d"]) * 0.98:
        breakout_vote = 0.35
    else:
        breakout_vote = (donchian_pos - 0.5) * 0.6

    # --- Momentum sleeve: three-horizon time-series momentum ----------------
    momentum_vote = (
        0.25 * _clamp(momentum_3d / 0.05)
        + 0.40 * _clamp(momentum_fast / 0.10)
        + 0.35 * _clamp(momentum_slow / 0.25)
    )

    # --- Mean-reversion sleeve: dip buying / overbought fading ---------------
    rsi_sell = 100.0 - cfg["meanrev_rsi_buy"]
    if zscore <= cfg["meanrev_entry_z"] and rsi_fast_value <= cfg["meanrev_rsi_buy"]:
        meanrev_vote = 1.0 if close > ema_anchor * 0.9 else 0.4
    elif zscore >= 1.5 or rsi_fast_value >= rsi_sell:
        meanrev_vote = -1.0
    else:
        meanrev_vote = _clamp(-zscore / 2.0) * 0.5

    return {
        "trend": round(_clamp(trend_vote), 4),
        "breakout": round(_clamp(breakout_vote), 4),
        "momentum": round(_clamp(momentum_vote), 4),
        "meanrev": round(_clamp(meanrev_vote), 4),
    }


def _composite_score(
    votes: Mapping[str, float],
    regime: str,
    cfg: Mapping[str, Any],
) -> Tuple[float, Dict[str, float]]:
    multipliers = REGIME_WEIGHT_MULTIPLIERS.get(regime, REGIME_WEIGHT_MULTIPLIERS["range"])
    weights = {
        "trend": cfg["weight_trend"] * multipliers["trend"],
        "breakout": cfg["weight_breakout"] * multipliers["breakout"],
        "momentum": cfg["weight_momentum"] * multipliers["momentum"],
        "meanrev": cfg["weight_meanrev"] * multipliers["meanrev"],
    }
    total = sum(weights.values())
    if total <= 1e-12:
        return 0.0, {key: 0.0 for key in weights}
    composite = sum(weights[key] * votes[key] for key in weights) / total
    if regime == "panic":
        composite = min(composite - PANIC_SCORE_PENALTY, 0.0)
    normalized_weights = {key: round(value / total, 4) for key, value in weights.items()}
    return _clamp(composite), normalized_weights


_REQUIRED_INDICATORS = (
    "ema_10",
    "ema_40",
    "ema_anchor",
    "anchor_slope_pct",
    "momentum_3d",
    "momentum_20d",
    "momentum_65d",
    "atr_24h",
    "annualized_volatility_30d",
    "vol_fast_annualized",
    "vol_ratio",
    "high_20d",
    "low_10d",
    "rsi",
    "rsi_fast",
    "adx",
    "zscore",
    "volume_z",
)


def _signal_from_indicator(
    row: Mapping[str, Any],
    cfg: Mapping[str, Any],
    *,
    position: Optional[Mapping[str, Any]] = None,
    risk: Optional[Mapping[str, Any]] = None,
    ml_signal: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    current_weight, average_entry, last_add, persisted_stop = _position_values(position)
    persisted_last_add = (last_add or average_entry) if current_weight > 1e-9 else None
    if any(row.get(field) is None for field in _REQUIRED_INDICATORS):
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
            "reasons": ["Waiting for a complete indicator warm-up history."],
            "allowed_actions": ["HOLD", "REDUCE", "EXIT"] if current_weight > 0 else ["HOLD"],
            "position_state": {
                "last_add_price": persisted_last_add,
                "protective_stop": persisted_stop,
            },
            "ensemble": None,
            "evidence": {
                "entry_qualified": False,
                "entry_mode": None,
                "negative_trend": False,
                "breakdown": False,
                "stop_triggered": False,
                "capital_exit": False,
                "panic_exit": False,
                "ml_veto": False,
            },
        }

    close = float(row["close"])
    volatility = float(row["annualized_volatility_30d"])
    atr_pct = float(row["atr_pct"])
    zscore = float(row["zscore"])
    rsi_fast_value = float(row["rsi_fast"])
    reasons: List[str] = []

    regime = _detect_regime(row, cfg)
    votes = _sleeve_votes(row, cfg)
    composite, used_weights = _composite_score(votes, regime, cfg)
    score = 50.0 * (1.0 + composite)

    regime_labels = {
        "trend_up": "Directional up-trend regime (ADX %.0f)." % float(row["adx"]),
        "trend_down": "Directional down-trend regime (ADX %.0f)." % float(row["adx"]),
        "range": "Range-bound regime — mean reversion carries the most weight.",
        "panic": "Volatility-expansion panic regime — new risk is disabled.",
    }
    reasons.append(regime_labels[regime])
    vote_text = {
        "trend": "Trend sleeve %.2f", "breakout": "Breakout sleeve %.2f",
        "momentum": "Momentum sleeve %.2f", "meanrev": "Mean-reversion sleeve %.2f",
    }
    top_sleeves = sorted(votes.items(), key=lambda item: abs(item[1] * used_weights[item[0]]), reverse=True)[:2]
    for name, vote in top_sleeves:
        reasons.append((vote_text[name] % vote) + f" × weight {used_weights[name]:.2f}.")

    # --- Deep-learning advisor -------------------------------------------
    ml = _validated_ml_signal(ml_signal) if cfg["ml_gate_enabled"] else None
    ml_adjust = 0.0
    if ml is not None:
        ml_adjust = (2.0 * ml["probability_up"] - 1.0) * cfg["ml_max_adjust"]
        score += ml_adjust
        reasons.append(
            "ML advisor P(up)=%.2f adjusted the score by %+.1f points."
            % (ml["probability_up"], ml_adjust)
        )
    score = round(max(0.0, min(100.0, score)), 1)

    momentum_fast = float(row["momentum_20d"])
    momentum_slow = float(row["momentum_65d"])
    ema_fast = float(row["ema_10"])
    ema_slow = float(row["ema_40"])
    negative = ema_fast < ema_slow and momentum_fast < 0 and momentum_slow < 0
    breakdown = bool(row["breakdown_10d"])

    # --- Stops -------------------------------------------------------------
    stop_distance = max(
        cfg["min_stop_distance_pct"],
        min(cfg["max_stop_distance_pct"], atr_pct * cfg["stop_atr_multiple"]),
    )
    risk_result = dict(risk or {})
    if persisted_stop is not None:
        stop_price = persisted_stop
    elif average_entry is not None:
        stop_price = average_entry * (1.0 - stop_distance)
    else:
        stop_price = None
    stop_triggered = current_weight > 0 and stop_price is not None and close <= stop_price

    # Chandelier-style trailing ratchet: while the position is in profit the
    # stop may rise with price, and it can never widen.  The updated value is
    # emitted through position_state so the durable controller persists it on
    # HOLD as well as on fills.
    trailed_stop = stop_price
    reference_cost = last_add or average_entry
    if (
        current_weight > 0
        and not stop_triggered
        and reference_cost is not None
        and close > reference_cost
    ):
        candidate = close * (1.0 - max(
            cfg["min_stop_distance_pct"],
            min(cfg["max_stop_distance_pct"], atr_pct * cfg["trail_atr_multiple"]),
        ))
        if trailed_stop is None or candidate > trailed_stop:
            trailed_stop = candidate

    # --- Entry qualification ------------------------------------------------
    trend_entry = regime == "trend_up" and score >= cfg["entry_score"]
    dip_entry = (
        regime == "range"
        and votes["meanrev"] >= 0.6
        and close > float(row["ema_anchor"])
        and score >= cfg["entry_score"]
    )
    entry_mode = "trend" if trend_entry else ("dip" if dip_entry else None)
    entry_qualified = entry_mode is not None
    ml_veto = False
    if (
        entry_qualified
        and ml is not None
        and ml["probability_up"] < cfg["ml_veto_threshold"]
    ):
        entry_qualified = False
        entry_mode = None
        ml_veto = True
        reasons.append(
            "ML advisor vetoed the entry: P(up)=%.2f is below the %.2f floor."
            % (ml["probability_up"], cfg["ml_veto_threshold"])
        )

    if entry_qualified:
        volatility_scale = min(1.0, cfg["annual_volatility_target"] / max(volatility, 1e-9))
        conviction = _clamp((score - 50.0) / 50.0, 0.3, 1.0)
        strategic_target = cfg["max_asset_weight"] * volatility_scale * conviction
        if entry_mode == "dip":
            strategic_target *= cfg["meanrev_size_fraction"]
    else:
        strategic_target = 0.0
    strategic_target = round(max(0.0, min(cfg["max_asset_weight"], strategic_target)), 6)

    capital_exit = bool(risk_result.get("exit_required"))
    panic_exit = regime == "panic" and current_weight > 0
    hard_exit = capital_exit or breakdown or stop_triggered or panic_exit
    if capital_exit:
        reasons.append("A capital-protection circuit requires an exit.")
    elif stop_triggered:
        reasons.append("The completed bar closed through the protective stop.")
    elif panic_exit:
        reasons.append("Panic regime: volatility expansion with falling prices forces an exit.")
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
        and regime == "trend_up"
        and bool(row["breakout_20d"])
        and score >= cfg["add_score"]
        and add_price_confirmed
        and strategic_target >= current_weight + cfg["rebalance_band"]
    )

    # Range-regime overbought take-profit: in chop, strength is sold rather
    # than chased (QuantPedia range-regime evidence).
    rsi_sell = 100.0 - cfg["meanrev_rsi_buy"]
    range_take_profit = (
        current_weight > 0
        and regime == "range"
        and zscore >= 1.0
        and rsi_fast_value >= rsi_sell
    )

    if current_weight <= 1e-9:
        target_weight = strategic_target if entry_qualified and not risk_result.get("blocked") else 0.0
        action = "BUY" if target_weight > 1e-6 else "HOLD"
        allowed_actions = ["BUY", "HOLD"] if action == "BUY" else ["HOLD"]
    elif hard_exit or negative:
        target_weight = 0.0
        action = "EXIT"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
    elif score < cfg["reduce_score"] or volatility >= cfg["high_volatility_threshold"] or range_take_profit:
        reduced_target = min(current_weight, cfg["max_asset_weight"] * cfg["reduced_weight_fraction"])
        if current_weight - reduced_target >= cfg["rebalance_band"]:
            target_weight = reduced_target
            action = "REDUCE"
            if range_take_profit:
                reasons.append("Range-regime overbought take-profit: selling strength into chop.")
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
        # Hysteresis is intentional: once invested, small drifts in the
        # volatility estimate never create tiny hourly rebalances.  Exposure
        # changes only on an explicit add, reduction, or exit rule.
        target_weight = current_weight
        action = "HOLD"
        allowed_actions = ["HOLD", "REDUCE", "EXIT"]
        if add_reference > 0 and close <= add_reference:
            reasons.append("Add blocked: the position is not above its cost/add reference.")

    emitted_stop = trailed_stop if action in {"HOLD", "ADD", "REDUCE"} else stop_price

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
            "protective_stop": round(emitted_stop, 8) if emitted_stop is not None else None,
        },
        "ensemble": {
            "regime": regime,
            "composite": round(composite, 4),
            "votes": votes,
            "weights": used_weights,
            "ml": (
                {
                    "probability_up": round(ml["probability_up"], 4),
                    "score_adjustment": round(ml_adjust, 2),
                    "veto": ml_veto,
                    "model_version": ml.get("model_version") or None,
                }
                if ml is not None
                else None
            ),
        },
        "evidence": {
            "entry_qualified": entry_qualified,
            "entry_mode": entry_mode,
            "negative_trend": negative,
            "breakdown": breakdown,
            "stop_triggered": stop_triggered,
            "capital_exit": capital_exit,
            "panic_exit": panic_exit,
            "ml_veto": ml_veto,
            "protective_stop": round(stop_price, 8) if stop_price is not None else None,
            "trailing_stop": round(emitted_stop, 8) if emitted_stop is not None else None,
            "strategic_target": strategic_target,
        },
        "indicators": {
            "ema_10": ema_fast,
            "ema_40": ema_slow,
            "ema_anchor": float(row["ema_anchor"]),
            "anchor_slope_pct": round(float(row["anchor_slope_pct"]), 4),
            "momentum_3d": round(float(row["momentum_3d"]), 6),
            "momentum_20d": momentum_fast,
            "momentum_65d": momentum_slow,
            "atr_24h": float(row["atr_24h"]),
            "atr_pct": round(atr_pct, 6),
            "annualized_volatility_30d": volatility,
            "vol_fast_annualized": float(row["vol_fast_annualized"]),
            "vol_ratio": round(float(row["vol_ratio"]), 4),
            "high_20d": float(row["high_20d"]),
            "low_10d": float(row["low_10d"]),
            "rsi": round(float(row["rsi"]), 2),
            "rsi_fast": round(rsi_fast_value, 2),
            "adx": round(float(row["adx"]), 2),
            "zscore": round(zscore, 4),
            "macd_hist_pct": (
                round(float(row["macd_hist_pct"]), 5)
                if row.get("macd_hist_pct") is not None
                else None
            ),
            "volume_z": round(float(row["volume_z"]), 4),
            "donchian_pos": (
                round(float(row["donchian_pos"]), 4)
                if row.get("donchian_pos") is not None
                else None
            ),
        },
    }


def _confirmed_signal(
    rows: Sequence[Mapping[str, Any]],
    index: int,
    cfg: Mapping[str, Any],
    *,
    position: Optional[Mapping[str, Any]],
    risk: Mapping[str, Any],
    ml_signal: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Apply causal entry/exit confirmation to one already-completed bar."""

    result = _signal_from_indicator(rows[index], cfg, position=position, risk=risk, ml_signal=ml_signal)
    current_weight, _, _, _ = _position_values(position)

    # Dip entries in a range regime are transient by nature; they execute on
    # the signal bar with a tight stop instead of waiting for multi-bar
    # confirmation that would erase the dip.
    entry_mode = result.get("evidence", {}).get("entry_mode")
    if result["action"] == "BUY" and entry_mode == "trend":
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
                f"Trend entry is waiting for {count} consecutive completed-bar confirmations."
            )

    # Breakdowns, protective stops, panic and capital circuits are immediate.
    # A slower trend reversal needs confirmation so a single noisy close
    # cannot liquidate the position.
    evidence = result.get("evidence", {})
    slow_exit = (
        result["action"] == "EXIT"
        and evidence.get("negative_trend", False)
        and not any(
            evidence.get(flag, False)
            for flag in ("breakdown", "stop_triggered", "capital_exit", "panic_exit")
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
                f"Trend exit is waiting for {count} consecutive completed-bar confirmations."
            )
    return result


def generate_signal(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    position: Optional[Mapping[str, Any]] = None,
    risk_state: Optional[Mapping[str, Any]] = None,
    now: Optional[Any] = None,
    ml_signal: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate the latest explainable long/flat target and action.

    ``ml_signal`` may carry ``{"probability_up": float, "model_version": str}``
    from the deep-learning advisor.  It is optional; the deterministic
    ensemble remains fully functional without it.
    """

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
        ml_signal=ml_signal,
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


def _round_trip_stats(fills: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    """Aggregate buy/sell fills into round trips and win/loss statistics."""

    round_trips: List[Dict[str, Any]] = []
    open_cost = 0.0
    open_units = 0.0
    entry_time: Optional[str] = None
    realized = 0.0
    for fill in fills:
        side = fill.get("side")
        gross = float(fill.get("gross_notional") or 0.0)
        fee = float(fill.get("fee") or 0.0)
        price = float(fill.get("execution_price") or 0.0)
        if price <= 0:
            continue
        units = gross / price
        if side == "buy":
            if open_units <= 1e-12:
                entry_time = fill.get("timestamp")
                realized = 0.0
            open_cost += gross + fee
            open_units += units
        elif side == "sell" and open_units > 1e-12:
            fraction = min(1.0, units / open_units)
            cost_released = open_cost * fraction
            realized += (gross - fee) - cost_released
            open_cost -= cost_released
            open_units -= units
            if open_units <= 1e-9:
                round_trips.append(
                    {
                        "entry_time": entry_time,
                        "exit_time": fill.get("timestamp"),
                        "pnl": round(realized, 8),
                    }
                )
                open_cost = 0.0
                open_units = 0.0
                entry_time = None
                realized = 0.0
    wins = [trip for trip in round_trips if trip["pnl"] > 0]
    losses = [trip for trip in round_trips if trip["pnl"] <= 0]
    gross_win = sum(trip["pnl"] for trip in wins)
    gross_loss = abs(sum(trip["pnl"] for trip in losses))
    return {
        "round_trips": len(round_trips),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(round_trips), 6) if round_trips else None,
        "average_win": round(gross_win / len(wins), 8) if wins else None,
        "average_loss": round(-gross_loss / len(losses), 8) if losses else None,
        "profit_factor": round(gross_win / gross_loss, 6) if gross_loss > 1e-12 else None,
        "trips": round_trips[-50:],
    }


def _monthly_returns(timestamps: Sequence[str], equity_curve: Sequence[float]) -> List[Dict[str, Any]]:
    if not timestamps or len(timestamps) != len(equity_curve):
        return []
    months: List[Dict[str, Any]] = []
    current_month: Optional[str] = None
    month_start_equity: Optional[float] = None
    last_equity: Optional[float] = None
    for stamp, equity in zip(timestamps, equity_curve):
        month = stamp[:7]
        if month != current_month:
            if current_month is not None and month_start_equity and last_equity is not None:
                months.append(
                    {
                        "month": current_month,
                        "return": round(last_equity / month_start_equity - 1, 6),
                    }
                )
            current_month = month
            month_start_equity = last_equity if last_equity is not None else equity
        last_equity = equity
    if current_month is not None and month_start_equity and last_equity is not None:
        months.append(
            {
                "month": current_month,
                "return": round(last_equity / month_start_equity - 1, 6),
            }
        )
    return months


def backtest(
    bars: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
    *,
    symbol: str = "BTC/USD",
    initial_capital: float = 10_000.0,
    ml_series: Optional[Sequence[Optional[float]]] = None,
) -> Dict[str, Any]:
    """Run a causal next-bar backtest with fees and adverse slippage.

    Signals observed at row ``i`` are queued and may only change exposure at
    row ``i + 1``'s open.  All equity and risk statistics are then marked
    using that next row.  This avoids using a close before it exists.

    ``ml_series`` optionally supplies one out-of-sample ``P(up)`` per input
    bar (aligned by index; ``None`` entries are skipped) so walk-forward
    deep-learning probabilities can participate without look-ahead.
    """

    cfg = validate_config(config)
    symbol = str(symbol).strip().upper()
    if symbol not in cfg["symbols"]:
        raise CryptoEngineError(f"symbol is not enabled by config: {symbol}")
    initial_capital = _finite_number(initial_capital, "initial_capital", positive=True)
    rows = compute_indicators(bars, cfg)
    if ml_series is not None and len(ml_series) != len(rows):
        raise CryptoEngineError("ml_series must align one probability per bar")
    warmup = required_history_bars(cfg) - 1
    if len(rows) <= warmup + 1:
        raise CryptoEngineError(f"backtest requires at least {warmup + 2} bars")

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
    regime_bars: Dict[str, int] = {}
    regime_pnl: Dict[str, float] = {}
    previous_equity: Optional[float] = None
    previous_regime: Optional[str] = None

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
        if previous_equity is not None and previous_regime is not None and previous_equity > 0:
            regime_pnl[previous_regime] = regime_pnl.get(previous_regime, 0.0) + (equity / previous_equity - 1.0)
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
        ml_signal = None
        if ml_series is not None and ml_series[index] is not None:
            ml_signal = {"probability_up": float(ml_series[index])}
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
            ml_signal=ml_signal,
        )
        # Persist the trailing-stop ratchet exactly as the durable controller
        # would when it stores position_state from a HOLD signal.
        returned_state = signal.get("position_state")
        if units > 0 and isinstance(returned_state, Mapping):
            new_stop = returned_state.get("protective_stop")
            if new_stop is not None:
                previous_stop = position_state.get("protective_stop")
                if previous_stop is None or float(new_stop) > float(previous_stop):
                    position_state = dict(position_state)
                    position_state["protective_stop"] = float(new_stop)
        pending_target = signal["target_weight"]
        pending_stop_distance = signal.get("stop_distance_pct")
        pending_action = signal["action"]
        regime = signal["regime"]
        regime_bars[regime] = regime_bars.get(regime, 0) + 1
        previous_equity = equity
        previous_regime = regime
        decisions.append(
            {
                "timestamp": row["timestamp"].isoformat(),
                "action": signal["action"],
                "regime": regime,
                "score": signal["score"],
                "target_weight": signal["target_weight"],
                "equity": round(equity, 8),
                "ensemble": signal.get("ensemble"),
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
    total_regime_bars = max(1, sum(regime_bars.values()))
    regime_stats = {
        regime: {
            "bars": count,
            "share": round(count / total_regime_bars, 4),
            "return_contribution": round(regime_pnl.get(regime, 0.0), 6),
        }
        for regime, count in sorted(regime_bars.items())
    }
    trade_stats = _round_trip_stats(fills)
    metrics["win_rate"] = trade_stats["win_rate"]
    metrics["profit_factor"] = trade_stats["profit_factor"]
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
        "regime_stats": regime_stats,
        "trade_stats": trade_stats,
        "monthly_returns": _monthly_returns(timestamps, equity_curve),
        "ml_used": ml_series is not None,
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
    "REGIMES",
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
