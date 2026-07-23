"""Authenticated Alpaca Crypto API and 24/7 automation controller.

The HTTP layer intentionally keeps broker access, durable state, and the pure
strategy engine separate.  Crypto automation is spot-only and long/flat:
neither an AI reviewer nor a malformed client request may introduce a short,
margin, bracket, or unsupported time-in-force order.
"""

from __future__ import annotations

from collections import OrderedDict
from concurrent.futures import Future, ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_FLOOR
import hashlib
import json
import math
import os
import threading
import time
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple

import requests
from flask import Blueprint, jsonify, request

try:  # package import in tests
    from .crypto_engine import (
        ALGORITHM_NAME,
        ALGORITHM_VERSION,
        DEFAULT_CONFIG as ENGINE_DEFAULT_CONFIG,
        SUPPORTED_SYMBOLS,
        CryptoEngineError,
        apply_fill_to_position_state,
        backtest as run_engine_backtest,
        generate_signal,
        required_history_bars,
        validate_config as validate_engine_config,
    )
except ImportError:  # direct module import by the monolithic backend
    from crypto_engine import (  # type: ignore
        ALGORITHM_NAME,
        ALGORITHM_VERSION,
        DEFAULT_CONFIG as ENGINE_DEFAULT_CONFIG,
        SUPPORTED_SYMBOLS,
        CryptoEngineError,
        apply_fill_to_position_state,
        backtest as run_engine_backtest,
        generate_signal,
        required_history_bars,
        validate_config as validate_engine_config,
    )


CONFIG_TYPE = "crypto_config"
RUNTIME_TYPE = "crypto_runtime"
DECISION_TYPE = "crypto_decision"
PRIMARY_KEY = "primary"
DATA_BASE_URL = "https://data.alpaca.markets"
ALLOWED_ORDER_TYPES = frozenset({"market", "limit", "stop_limit"})
ALLOWED_TIFS = frozenset({"gtc", "ioc"})
ORDER_TIFS = {
    "market": frozenset({"gtc", "ioc"}),
    "limit": frozenset({"gtc", "ioc"}),
    "stop_limit": frozenset({"gtc"}),
}
ALLOWED_MODES = frozenset({"paper", "live"})
ALLOWED_TRADE_HORIZONS = frozenset({"short", "long"})
SHORT_INTERVALS = frozenset({15})
LONG_INTERVALS = frozenset({60, 120, 240})
ALLOWED_INTERVALS = SHORT_INTERVALS | LONG_INTERVALS
MAX_SCHEDULER_USERS = 200
MAX_ENTRY_QUOTE_AGE_SECONDS = 60.0
MAX_ENTRY_SPREAD_BPS = 50.0
MIN_ENTRY_DAILY_DOLLAR_VOLUME = 1_000_000.0
MAX_ENTRY_DAILY_VOLUME_PARTICIPATION = 0.001
MIN_ENTRY_TOP_OF_BOOK_FRACTION = 1.0
LEDGER_PAGE_SIZE = 100
LEDGER_MAX_PAGES = 20
LEDGER_MAX_SCANNED_ROWS = LEDGER_PAGE_SIZE * LEDGER_MAX_PAGES
MAX_PENDING_RECONCILIATIONS = 100
PENDING_RECONCILIATION_MAX_AGE = timedelta(days=30)
TERMINAL_ORDER_STATUSES = frozenset({
    "filled", "canceled", "cancelled", "expired", "rejected",
})
FILL_CONFIRMING_ORDER_STATUSES = frozenset({
    "filled", "partially_filled", "canceled", "cancelled", "expired",
})

# Curated, reproducible research challengers.  The scheduler never downloads
# executable strategy code from the internet: published ideas are translated
# into this bounded long/flat parameter family, then re-tested on Alpaca bars
# with the account's configured fees and slippage.  This keeps research
# provenance visible without turning a web page or an LLM response into an
# order-routing input.
STRATEGY_RESEARCH_LIBRARY: Tuple[Dict[str, Any], ...] = (
    {
        "id": "current",
        "name": "Current mandate",
        "patch": {},
        "source": {
            "title": "AlphaLab incumbent Paper mandate",
            "url": "",
            "concept": "The currently saved strategy is always the control candidate.",
        },
    },
    {
        "id": "time_series_momentum",
        "name": "Multi-horizon trend",
        "patch": {
            "ema_fast": 12, "ema_slow": 48,
            "momentum_fast_days": 21, "momentum_slow_days": 63,
            "breakout_days": 20, "breakdown_days": 10,
            "entry_confirmation_bars": 2, "exit_confirmation_bars": 2,
        },
        "source": {
            "title": "Time Series Momentum — Moskowitz, Ooi and Pedersen",
            "url": "https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum",
            "concept": "Combine an asset's own trend across multiple horizons.",
        },
    },
    {
        "id": "liquid_crypto_momentum",
        "name": "Liquid-crypto momentum",
        "patch": {
            "ema_fast": 8, "ema_slow": 32,
            "momentum_fast_days": 14, "momentum_slow_days": 45,
            "breakout_days": 14, "breakdown_days": 7,
            "entry_confirmation_bars": 3, "exit_confirmation_bars": 2,
        },
        "source": {
            "title": "Impact of Size and Volume on Cryptocurrency Momentum and Reversal — Fičura and Colak",
            "url": "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4378429",
            "concept": "Large, liquid crypto assets exhibit different short-horizon momentum behavior from illiquid coins.",
        },
    },
    {
        "id": "volatility_scaled_trend",
        "name": "Volatility-scaled trend",
        "patch": {
            "ema_fast": 16, "ema_slow": 64,
            "momentum_fast_days": 30, "momentum_slow_days": 90,
            "breakout_days": 30, "breakdown_days": 14,
            "annual_volatility_target": 0.10,
            "high_volatility_threshold": 0.80,
            "entry_confirmation_bars": 3, "exit_confirmation_bars": 3,
        },
        "source": {
            "title": "Adaptive Risk Allocation in Crypto Markets — Habeli, Barakchian and Motavasseli",
            "url": "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5090097",
            "concept": "Scale momentum exposure down when realized volatility rises.",
        },
    },
    {
        "id": "cost_aware_breakout",
        "name": "Cost-aware breakout",
        "patch": {
            "ema_fast": 16, "ema_slow": 72,
            "momentum_fast_days": 28, "momentum_slow_days": 84,
            "breakout_days": 40, "breakdown_days": 20,
            "entry_score": 65.0, "add_score": 85.0,
            "rebalance_band": 0.03,
            "entry_confirmation_bars": 3, "exit_confirmation_bars": 3,
        },
        "source": {
            "title": "Machine Learning-Based Bitcoin Trading Under Transaction Costs — Bysik and Ślepaczuk",
            "url": "https://arxiv.org/abs/2606.00060",
            "concept": "Require a stronger edge and lower turnover when transaction costs dominate weak hourly forecasts.",
        },
    },
)
ALPACA_TRADING_BASE_URLS = {
    "paper": "https://paper-api.alpaca.markets",
    "live": "https://api.alpaca.markets",
}


def _live_release_admission() -> Dict[str, Any]:
    """Read-only deployment gate for live strategy release.

    The current independent BTC/ETH validation has not admitted this strategy
    for live capital.  Operators may enable the gate only after the documented
    release criteria pass; browser payloads cannot modify it.
    """
    admitted = str(os.getenv("CRYPTO_LIVE_RELEASE_ADMITTED", "false")).strip().lower() in {
        "1", "true", "yes", "on",
    }
    return {
        "admitted": admitted,
        "environmentVariable": "CRYPTO_LIVE_RELEASE_ADMITTED",
        "defaultMode": "paper",
        "algorithm": {"name": ALGORITHM_NAME, "version": ALGORITHM_VERSION},
        "reason": (
            "deployment_release_admitted"
            if admitted
            else "independent_backtest_release_criteria_not_met"
        ),
    }


def _require_live_release_admitted():
    admission = _live_release_admission()
    if not admission["admitted"]:
        raise CryptoApiError(
            "Crypto strategy is not admitted for live capital; use Paper mode",
            status=403,
            code="strategy_not_admitted",
        )
    return admission


class CryptoApiError(RuntimeError):
    def __init__(self, message: str, *, status: int = 400, code: str = "crypto_error"):
        super().__init__(message)
        self.status = int(status)
        self.code = str(code)


class BrokerError(CryptoApiError):
    pass


class _BoundedTtlCache:
    """Small process-local cache; values never contain credentials."""

    def __init__(self, max_items: int = 128):
        self.max_items = max(8, int(max_items))
        self._values: OrderedDict[str, Tuple[float, Any]] = OrderedDict()
        self._lock = threading.RLock()

    def get(self, key: str):
        now = time.monotonic()
        with self._lock:
            item = self._values.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at <= now:
                self._values.pop(key, None)
                return None
            self._values.move_to_end(key)
            return deepcopy(value)

    def put(self, key: str, value: Any, ttl_seconds: float):
        with self._lock:
            self._values[key] = (time.monotonic() + max(0.1, float(ttl_seconds)), deepcopy(value))
            self._values.move_to_end(key)
            while len(self._values) > self.max_items:
                self._values.popitem(last=False)


_CACHE = _BoundedTtlCache()


class _BoundedBarsCache:
    """Read-only bar cache bounded by entries, bar count, and estimated bytes.

    Bar payloads are stored as tuples and returned by reference. Callers in
    this module treat market bars as immutable; avoiding two full deep copies
    on every hit materially reduces transient memory during concurrent scans.
    """

    def __init__(self, *, max_items: int = 16, max_bars: int = 20_000, max_bytes: int = 8 * 1024 * 1024):
        self.max_items = max(2, int(max_items))
        self.max_bars = max(1_000, int(max_bars))
        self.max_bytes = max(1_000_000, int(max_bytes))
        self._values: OrderedDict[str, Tuple[float, Tuple[Dict[str, Any], ...], int]] = OrderedDict()
        self._bars = 0
        self._bytes = 0
        self._lock = threading.RLock()

    @staticmethod
    def _estimated_bytes(rows: Sequence[Mapping[str, Any]]) -> int:
        return sum(
            72 + sum(len(str(key)) + len(str(value)) + 16 for key, value in row.items())
            for row in rows
        )

    def _remove(self, key: str):
        item = self._values.pop(key, None)
        if item:
            _, rows, size = item
            self._bars = max(0, self._bars - len(rows))
            self._bytes = max(0, self._bytes - size)

    def get(self, key: str):
        now = time.monotonic()
        with self._lock:
            item = self._values.get(key)
            if not item:
                return None
            expires_at, rows, _ = item
            if expires_at <= now:
                self._remove(key)
                return None
            self._values.move_to_end(key)
            return rows

    def put(self, key: str, rows: Sequence[Dict[str, Any]], ttl_seconds: float):
        immutable_rows = tuple(rows)
        size = self._estimated_bytes(immutable_rows)
        if len(immutable_rows) > self.max_bars or size > self.max_bytes:
            return
        with self._lock:
            self._remove(key)
            self._values[key] = (time.monotonic() + max(0.1, float(ttl_seconds)), immutable_rows, size)
            self._bars += len(immutable_rows)
            self._bytes += size
            self._values.move_to_end(key)
            while (
                len(self._values) > self.max_items
                or self._bars > self.max_bars
                or self._bytes > self.max_bytes
            ):
                self._remove(next(iter(self._values)))


_BARS_CACHE = _BoundedBarsCache()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _utc_now()).astimezone(timezone.utc).isoformat()


def _parse_utc_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)) and math.isfinite(float(value)):
        numeric = float(value)
        if abs(numeric) > 100_000_000_000:
            numeric /= 1000.0
        try:
            parsed = datetime.fromtimestamp(numeric, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    elif isinstance(value, str) and value.strip():
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _complete_bar_cutoff(now: datetime, timeframe: str) -> datetime:
    """Return the exclusive start timestamp for the newest complete bar."""

    current = now.astimezone(timezone.utc)
    if timeframe == "15Min":
        return current.replace(minute=(current.minute // 15) * 15, second=0, microsecond=0)
    if timeframe == "1Hour":
        return current.replace(minute=0, second=0, microsecond=0)
    if timeframe == "1Day":
        return current.replace(hour=0, minute=0, second=0, microsecond=0)
    return current


def _repair_isolated_hourly_backtest_gaps(
    rows: Sequence[Mapping[str, Any]],
    *,
    maximum_synthetic_bars: int = 3,
) -> Tuple[Sequence[Dict[str, Any]], Dict[str, Any]]:
    """Repair only tiny isolated gaps for a disclosed historical simulation.

    Live signals continue to use the strict engine path and never synthesize
    observations.  Alpaca can occasionally omit an isolated hourly aggregate;
    for a backtest, a zero-volume carry-forward bar is less misleading than
    either inventing price movement or silently shortening the selected
    lookback.  Larger outages still fail closed.
    """

    ordered = sorted(
        (dict(row) for row in rows if isinstance(row, Mapping)),
        key=lambda row: str(row.get("t") or row.get("timestamp") or row.get("time") or ""),
    )
    if len(ordered) < 2:
        return tuple(ordered), {
            "sourceBars": len(ordered), "syntheticBars": 0, "repairedGaps": [],
        }
    repaired: list[Dict[str, Any]] = [ordered[0]]
    repaired_gaps = []
    synthetic_count = 0
    for current in ordered[1:]:
        previous = repaired[-1]
        previous_time = _parse_utc_datetime(previous.get("t") or previous.get("timestamp") or previous.get("time"))
        current_time = _parse_utc_datetime(current.get("t") or current.get("timestamp") or current.get("time"))
        if previous_time is None or current_time is None:
            raise CryptoApiError("Backtest history contains an invalid timestamp", code="invalid_backtest_history")
        interval_seconds = int((current_time - previous_time).total_seconds())
        if interval_seconds <= 0 or interval_seconds % 3600 != 0:
            raise CryptoApiError("Backtest history is not ordered on hourly boundaries", code="invalid_backtest_history")
        missing = interval_seconds // 3600 - 1
        if missing:
            if synthetic_count + missing > maximum_synthetic_bars:
                raise CryptoApiError(
                    "Backtest history contains a market-data outage that is too large to repair safely",
                    code="incomplete_backtest_history",
                )
            close = _number(previous.get("c", previous.get("close")), float("nan"))
            if not math.isfinite(close) or close <= 0:
                raise CryptoApiError("Backtest history cannot repair a gap without a valid prior close", code="invalid_backtest_history")
            repaired_gaps.append({
                "after": _iso(previous_time),
                "before": _iso(current_time),
                "missingBars": missing,
            })
            for offset in range(1, missing + 1):
                timestamp = previous_time + timedelta(hours=offset)
                repaired.append({
                    "t": _iso(timestamp),
                    "o": close,
                    "h": close,
                    "l": close,
                    "c": close,
                    "v": 0.0,
                    "synthetic": True,
                })
            synthetic_count += missing
        repaired.append(current)
    return tuple(repaired), {
        "sourceBars": len(ordered),
        "syntheticBars": synthetic_count,
        "repairedGaps": repaired_gaps,
    }


def _jsonable(value: Any):
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _number(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return float(default)
    return result if math.isfinite(result) else float(default)


def _decimal(value: Any, default: str = "0") -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)
    return result if result.is_finite() else Decimal(default)


def _increment(value: Any, default: str) -> Decimal:
    result = _decimal(value, default)
    return result if result > 0 else Decimal(default)


def _quantize_increment(value: Any, increment: Any, *, round_up: bool = False) -> Decimal:
    amount = max(Decimal("0"), _decimal(value))
    step = _increment(increment, "0.000000001")
    rounding = ROUND_CEILING if round_up else ROUND_FLOOR
    units = (amount / step).to_integral_value(rounding=rounding)
    return units * step


def _decimal_string(value: Decimal) -> str:
    rendered = format(value, "f")
    return rendered.rstrip("0").rstrip(".") if "." in rendered else rendered


def _trusted_alpaca_base_url(value: Any, mode: str) -> str:
    normalized_mode = _mode(mode)
    expected = ALPACA_TRADING_BASE_URLS[normalized_mode]
    candidate = str(value or expected).strip().rstrip("/")
    if candidate != expected:
        raise CryptoApiError(
            "Alpaca trading base URL is not trusted",
            status=409,
            code="untrusted_broker_base_url",
        )
    return expected


def _boolean(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        raise CryptoApiError(f"{field} must be true or false", code="invalid_config")
    return value


def _optional_boolean(value: Any) -> Optional[bool]:
    """Return a broker boolean only when it is explicitly typed as one.

    Asset metadata is an execution-safety input.  Treating a missing or
    malformed broker field as truthy would make an unknown route look
    tradable in the UI, so unknown values deliberately remain ``None``.
    """
    return value if isinstance(value, bool) else None


def _normalize_symbol(value: Any) -> str:
    symbol = str(value or "").strip().upper().replace("-", "/")
    if "/" not in symbol and symbol.endswith("USD") and len(symbol) > 3:
        symbol = f"{symbol[:-3]}/USD"
    return symbol


def _mode(value: Any, default: str = "paper") -> str:
    normalized = str(value or default).strip().lower()
    if normalized == "real":
        normalized = "live"
    if normalized not in ALLOWED_MODES:
        raise CryptoApiError("mode must be paper or live", code="invalid_mode")
    return normalized


def _safe_symbol_key(symbol: str) -> str:
    return "".join(char for char in _normalize_symbol(symbol) if char.isalnum())[:12]


def _looks_like_crypto_pair(symbol: Any) -> bool:
    normalized = _normalize_symbol(symbol)
    if "/" not in normalized:
        return False
    base, quote = normalized.rsplit("/", 1)
    return bool(base) and quote in {"USD", "USDT", "USDC", "BTC"}


def _strategy_timeframe(strategy: Mapping[str, Any]) -> str:
    return "15Min" if int(_number(strategy.get("bars_per_day"), 24)) == 96 else "1Hour"


def _default_config() -> Dict[str, Any]:
    return {
        "mode": "paper",
        "symbols": list(SUPPORTED_SYMBOLS),
        "enabled": False,
        "tradeHorizon": "long",
        "intervalMinutes": 60,
        "liveAuthorized": False,
        "killSwitch": False,
        "maxTotalExposure": 0.20,
        "maxAssetExposurePct": 12.0,
        "assetAllocationsPct": {"BTC/USD": 12.0, "ETH/USD": 8.0},
        "riskPerTradePct": 0.35,
        "minimumConfidence": 60.0,
        "riskProfile": "balanced",
        "maxOrderNotional": 1000.0,
        "minOrderNotional": 10.0,
        "allowAdds": True,
        "aiReviewEnabled": True,
        "paperLearningEnabled": False,
        "calibrationEveryCycles": 24,
        "order": {
            "type": "market",
            "timeInForce": "gtc",
            "limitOffsetBps": 8.0,
            "stopOffsetBps": 15.0,
        },
        "strategy": validate_engine_config(),
        "algorithm": {"name": ALGORITHM_NAME, "version": ALGORITHM_VERSION},
    }


def _validate_config(payload: Mapping[str, Any], *, base: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise CryptoApiError("config must be an object", code="invalid_config")
    allowed = {
        "mode", "symbols", "enabled", "tradeHorizon", "intervalMinutes", "liveAuthorized",
        "killSwitch", "maxTotalExposure", "maxOrderNotional", "minOrderNotional",
        "allowAdds", "aiReviewEnabled", "paperLearningEnabled", "calibrationEveryCycles", "order", "strategy", "algorithm", "updatedAt",
        "riskProfile", "minimumConfidence", "maxAssetExposurePct", "maxAssetAllocation",
        "assetAllocationsPct", "riskPerTradePct",
    }
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise CryptoApiError("unsupported config fields: %s" % ", ".join(unknown), code="invalid_config")

    resolved = deepcopy(dict(base or _default_config()))
    normalized_payload = dict(payload)
    if "maxAssetAllocation" in normalized_payload and "maxAssetExposurePct" not in normalized_payload:
        alias_value = _number(normalized_payload.pop("maxAssetAllocation"), float("nan"))
        normalized_payload["maxAssetExposurePct"] = alias_value * 100 if 0 < alias_value <= 1 else alias_value
    else:
        normalized_payload.pop("maxAssetAllocation", None)
    for key, value in normalized_payload.items():
        if key not in {"algorithm", "updatedAt"}:
            resolved[key] = deepcopy(value)

    mode = _mode(resolved.get("mode"), "paper")
    resolved["mode"] = mode

    for field in ("enabled", "liveAuthorized", "killSwitch", "allowAdds", "aiReviewEnabled", "paperLearningEnabled"):
        resolved[field] = _boolean(resolved.get(field), field)

    try:
        calibration_every = int(resolved.get("calibrationEveryCycles", 24))
    except (TypeError, ValueError) as exc:
        raise CryptoApiError("calibrationEveryCycles is invalid", code="invalid_config") from exc
    if calibration_every not in {12, 24, 48, 168}:
        raise CryptoApiError("calibrationEveryCycles must be 12, 24, 48, or 168", code="invalid_config")
    resolved["calibrationEveryCycles"] = calibration_every
    if mode == "live":
        # Strategy discovery is deliberately Paper-only. Live always uses a
        # previously saved and explicitly authorized mandate.
        resolved["paperLearningEnabled"] = False

    trade_horizon = str(resolved.get("tradeHorizon") or "long").strip().lower()
    if trade_horizon not in ALLOWED_TRADE_HORIZONS:
        raise CryptoApiError("tradeHorizon must be short or long", code="invalid_config")
    if (
        "intervalMinutes" in normalized_payload
        and "tradeHorizon" not in normalized_payload
        and int(_number(resolved.get("intervalMinutes"), -1)) == 15
    ):
        trade_horizon = "short"
    if "tradeHorizon" in normalized_payload and "intervalMinutes" not in normalized_payload:
        if trade_horizon == "short":
            resolved["intervalMinutes"] = 15
        elif int(_number(resolved.get("intervalMinutes"), 60)) == 15:
            resolved["intervalMinutes"] = 60
    resolved["tradeHorizon"] = trade_horizon

    try:
        interval = int(resolved.get("intervalMinutes"))
    except (TypeError, ValueError) as exc:
        raise CryptoApiError("intervalMinutes is invalid", code="invalid_config") from exc
    allowed_intervals = SHORT_INTERVALS if trade_horizon == "short" else LONG_INTERVALS
    if interval not in allowed_intervals:
        if trade_horizon == "short":
            raise CryptoApiError("intervalMinutes must be 15 for the short-term strategy", code="invalid_config")
        raise CryptoApiError("intervalMinutes must be 60, 120, or 240 for the long-term strategy", code="invalid_config")
    resolved["intervalMinutes"] = interval

    symbols = resolved.get("symbols")
    if not isinstance(symbols, (list, tuple)) or not symbols:
        raise CryptoApiError("symbols must be a non-empty list", code="invalid_config")
    normalized_symbols = []
    for raw in symbols:
        symbol = _normalize_symbol(raw)
        if symbol not in SUPPORTED_SYMBOLS:
            raise CryptoApiError(f"strategy does not support {symbol}", code="unsupported_symbol")
        if symbol not in normalized_symbols:
            normalized_symbols.append(symbol)
    resolved["symbols"] = normalized_symbols

    risk_profile = str(resolved.get("riskProfile") or "balanced").strip().lower()
    if risk_profile not in {"conservative", "balanced", "aggressive"}:
        raise CryptoApiError("riskProfile must be conservative, balanced, or aggressive", code="invalid_config")
    resolved["riskProfile"] = risk_profile
    minimum_confidence = _number(resolved.get("minimumConfidence"), float("nan"))
    max_asset_exposure_pct = _number(resolved.get("maxAssetExposurePct"), float("nan"))
    if not 0 <= minimum_confidence <= 100:
        raise CryptoApiError("minimumConfidence must be between 0 and 100", code="invalid_config")
    if not 5 <= max_asset_exposure_pct <= 100:
        raise CryptoApiError("maxAssetExposurePct must be between 5 and 100", code="invalid_config")
    resolved["minimumConfidence"] = minimum_confidence
    resolved["maxAssetExposurePct"] = max_asset_exposure_pct
    risk_per_trade = _number(resolved.get("riskPerTradePct"), float("nan"))
    if not 0.05 <= risk_per_trade <= 2.0:
        raise CryptoApiError("riskPerTradePct must be between 0.05 and 2.0", code="invalid_config")
    resolved["riskPerTradePct"] = risk_per_trade
    raw_allocations = resolved.get("assetAllocationsPct") or {}
    if not isinstance(raw_allocations, Mapping):
        raise CryptoApiError("assetAllocationsPct must be an object", code="invalid_config")
    allocations = {}
    for symbol in normalized_symbols:
        allocation = _number(raw_allocations.get(symbol), min(max_asset_exposure_pct, 8.0))
        if not 1 <= allocation <= max_asset_exposure_pct:
            raise CryptoApiError(
                f"assetAllocationsPct for {symbol} must be between 1 and maxAssetExposurePct",
                code="invalid_config",
            )
        allocations[symbol] = allocation
    resolved["assetAllocationsPct"] = allocations

    for field, minimum, maximum in (
        ("maxTotalExposure", 0.01, 1.0),
        ("maxOrderNotional", 1.0, 200_000.0),
        ("minOrderNotional", 1.0, 10_000.0),
    ):
        value = _number(resolved.get(field), float("nan"))
        if not math.isfinite(value) or value < minimum or value > maximum:
            raise CryptoApiError(f"{field} is outside its safe range", code="invalid_config")
        resolved[field] = value
    if resolved["minOrderNotional"] > resolved["maxOrderNotional"]:
        raise CryptoApiError("minOrderNotional cannot exceed maxOrderNotional", code="invalid_config")

    order = resolved.get("order")
    if not isinstance(order, Mapping):
        raise CryptoApiError("order must be an object", code="invalid_order_contract")
    allowed_order_fields = {"type", "timeInForce", "limitOffsetBps", "stopOffsetBps"}
    if set(order) - allowed_order_fields:
        raise CryptoApiError("unsupported order field", code="invalid_order_contract")
    order_type = str(order.get("type") or "market").strip().lower()
    tif = str(order.get("timeInForce") or "gtc").strip().lower()
    if order_type not in ALLOWED_ORDER_TYPES:
        raise CryptoApiError("crypto orders must be market, limit, or stop_limit", code="invalid_order_contract")
    if tif not in ALLOWED_TIFS:
        raise CryptoApiError("crypto timeInForce must be gtc or ioc", code="invalid_order_contract")
    if tif not in ORDER_TIFS[order_type]:
        raise CryptoApiError(
            f"crypto {order_type} orders do not support {tif}",
            code="invalid_order_contract",
        )
    limit_offset = _number(order.get("limitOffsetBps"), float("nan"))
    stop_offset = _number(order.get("stopOffsetBps"), float("nan"))
    if not (0 <= limit_offset <= 500) or not (0 <= stop_offset <= 500):
        raise CryptoApiError("order offsets must be between 0 and 500 bps", code="invalid_order_contract")
    resolved["order"] = {
        "type": order_type,
        "timeInForce": tif,
        "limitOffsetBps": limit_offset,
        "stopOffsetBps": stop_offset,
    }

    strategy = deepcopy(dict(resolved.get("strategy") or {}))
    strategy["symbols"] = normalized_symbols
    if trade_horizon == "short":
        strategy.update({
            "bars_per_day": 96,
            "ema_fast": 12,
            "ema_slow": 48,
            "momentum_fast_days": 2,
            "momentum_slow_days": 7,
            "atr_hours": 16,
            "volatility_days": 3,
            "breakout_days": 2,
            "breakdown_days": 1,
            "entry_confirmation_bars": 1,
            "exit_confirmation_bars": 1,
            "rebalance_band": min(_number(strategy.get("rebalance_band"), 0.01), 0.01),
            "add_min_price_gain_pct": min(_number(strategy.get("add_min_price_gain_pct"), 0.01), 0.01),
            "stop_atr_multiple": min(_number(strategy.get("stop_atr_multiple"), 2.0), 2.0),
            "min_stop_distance_pct": min(_number(strategy.get("min_stop_distance_pct"), 0.01), 0.01),
            "max_stop_distance_pct": min(_number(strategy.get("max_stop_distance_pct"), 0.06), 0.06),
            "data_stale_minutes": 25,
        })
    else:
        strategy["bars_per_day"] = 24
        strategy["data_stale_minutes"] = max(90, int(_number(strategy.get("data_stale_minutes"), 90)))
    strategy["entry_score"] = minimum_confidence
    strategy["add_score"] = max(minimum_confidence, _number(strategy.get("add_score"), 75.0))
    strategy["reduce_score"] = min(minimum_confidence, _number(strategy.get("reduce_score"), 45.0))
    strategy["max_asset_weight"] = max_asset_exposure_pct / 100.0
    if "riskProfile" in normalized_payload:
        risk_values = {
            "conservative": {
                "annual_volatility_target": 0.10, "daily_loss_limit": 0.01,
                "seven_day_loss_limit": 0.03, "max_drawdown_limit": 0.06,
            },
            "balanced": {
                "annual_volatility_target": 0.15, "daily_loss_limit": 0.015,
                "seven_day_loss_limit": 0.04, "max_drawdown_limit": 0.08,
            },
            "aggressive": {
                "annual_volatility_target": 0.25, "daily_loss_limit": 0.025,
                "seven_day_loss_limit": 0.06, "max_drawdown_limit": 0.12,
            },
        }[risk_profile]
        strategy.update(risk_values)
    try:
        resolved["strategy"] = validate_engine_config(strategy)
    except CryptoEngineError as exc:
        raise CryptoApiError(str(exc), code="invalid_strategy") from exc
    resolved["algorithm"] = {"name": ALGORITHM_NAME, "version": ALGORITHM_VERSION}
    resolved["updatedAt"] = _iso()
    if mode != "live":
        resolved["liveAuthorized"] = False
    if resolved["killSwitch"]:
        resolved["enabled"] = False
        resolved["liveAuthorized"] = False
    return resolved


def _runtime_default() -> Dict[str, Any]:
    return {
        "status": "idle",
        "enabled": False,
        "locked": False,
        "killSwitch": False,
        "consecutiveErrors": 0,
        "lastError": "",
        "lastRun": None,
        "nextRun": None,
        "lastRunBucket": None,
        "lastDurationMs": None,
        "lastDecisions": [],
        "lastHeartbeat": None,
        "heartbeat": None,
        "cycleStartedAt": None,
        "currentStage": "idle",
        "progress": 0,
        "progressDetail": {
            "stage": "idle",
            "completedSymbols": 0,
            "totalSymbols": 0,
            "currentSymbol": None,
        },
        "runId": None,
        "message": "Crypto automation is idle.",
        "cooldownUntil": None,
        "manualReviewRequired": False,
        "positionState": {},
        "pendingReconciliations": {},
        "reconciliationRequired": False,
        "reconciliationMessage": "",
        "killReason": "",
        "equityCurve": [],
        "cycleCount": 0,
        "calibration": {
            "status": "not_run", "lastRun": None, "symbol": None,
            "champion": "current", "applied": False, "candidates": [],
            "completedRuns": 0, "history": [],
            "method": "three_60_day_walk_forward_windows_cost_aware",
        },
        "coverage": "24/7",
        "marketClockRequired": False,
    }


def _response_data(response: Any):
    if response is None:
        return []
    data = getattr(response, "data", None)
    if data is None and isinstance(response, Mapping):
        data = response.get("data")
    return data if isinstance(data, list) else []


def _request_json(
    method: str,
    url: str,
    *,
    headers: Optional[Mapping[str, str]] = None,
    params: Optional[Mapping[str, Any]] = None,
    payload: Optional[Mapping[str, Any]] = None,
    expected: Sequence[int] = (200,),
    timeout: float = 12.0,
    attempts: int = 3,
) -> Any:
    last_error: Optional[Exception] = None
    for attempt in range(max(1, min(int(attempts), 3))):
        try:
            response = requests.request(
                method.upper(), url, headers=dict(headers or {}), params=dict(params or {}),
                json=dict(payload) if payload is not None else None, timeout=timeout,
            )
        except requests.RequestException as exc:
            last_error = exc
            if attempt >= attempts - 1:
                break
            time.sleep(0.15 * (2 ** attempt))
            continue
        if response.status_code in expected:
            if response.status_code == 204:
                return {}
            try:
                return response.json()
            except Exception as exc:
                raise BrokerError("Broker returned invalid JSON", status=502, code="broker_invalid_json") from exc
        if response.status_code == 429 and attempt < attempts - 1:
            retry_after = _number(response.headers.get("Retry-After"), 0.25 * (2 ** attempt))
            time.sleep(max(0.05, min(retry_after, 2.0)))
            continue
        try:
            body = response.json()
            message = str(body.get("message") or body.get("error") or "") if isinstance(body, Mapping) else ""
        except Exception:
            message = ""
        raise BrokerError(
            message[:300] or f"Broker request failed with HTTP {response.status_code}",
            status=502 if response.status_code >= 500 else 400,
            code=f"broker_http_{response.status_code}",
        )
    raise BrokerError(
        "Broker request timed out or could not connect",
        status=503,
        code="broker_unavailable",
    ) from last_error


def _account_gate(account: Mapping[str, Any]) -> Dict[str, Any]:
    reasons = []
    crypto_status = str(account.get("crypto_status") or "").upper()
    if crypto_status != "ACTIVE":
        reasons.append("crypto_status_not_active")
    for field in ("account_blocked", "trading_blocked", "trade_suspended_by_user"):
        if bool(account.get(field)):
            reasons.append(field)
    account_status = str(account.get("status") or "ACTIVE").upper()
    if account_status not in {"ACTIVE", ""}:
        reasons.append("account_not_active")
    return {
        "eligible": not reasons,
        "cryptoStatus": crypto_status or "UNKNOWN",
        "reasons": reasons,
    }


def _position_symbol(row: Mapping[str, Any]) -> str:
    return _normalize_symbol(row.get("symbol"))


def _public_position(row: Mapping[str, Any]) -> Dict[str, Any]:
    qty = _number(row.get("qty"))
    return {
        "symbol": _position_symbol(row),
        "qty": qty,
        "marketValue": max(0.0, _number(row.get("market_value"))),
        "currentPrice": max(0.0, _number(row.get("current_price"))),
        "averageEntryPrice": max(0.0, _number(row.get("avg_entry_price"))),
        "unrealizedPnl": _number(row.get("unrealized_pl")),
        "side": str(row.get("side") or "long").lower(),
    }


def _decision_public(row: Mapping[str, Any]) -> Dict[str, Any]:
    payload = dict(row.get("payload") or row)
    public = {
        "action": payload.get("action") or "HOLD",
        "symbol": payload.get("symbol"),
        "confidence": payload.get("confidence", payload.get("score", 0)),
        "score": payload.get("score", 0),
        "reason": payload.get("reason") or "; ".join(payload.get("reasons") or []),
        "reasons": list(payload.get("reasons") or []),
        "targetWeight": payload.get("targetWeight", payload.get("target_weight", 0)),
        "regime": payload.get("regime") or "unknown",
        "price": payload.get("price"),
        "order": payload.get("order"),
        "timestamp": payload.get("timestamp") or row.get("updated_at") or row.get("created_at"),
        "reviewer": payload.get("reviewer") or "deterministic",
        "exitOnly": bool(payload.get("exitOnly", payload.get("exit_only", False))),
    }
    for field in (
        "currentWeight",
        "filledWeight",
        "openOrderReservation",
        "persistentRiskGate",
        "portfolioExposure",
        "protectiveStopMetadata",
        "entryGate",
        "entryCapacity",
        "dryRun",
        "mode",
        "source",
    ):
        if field in payload:
            public[field] = payload.get(field)
    return _jsonable(public)


def _snapshot_public(symbol: str, raw: Mapping[str, Any]) -> Dict[str, Any]:
    trade = raw.get("latestTrade") or raw.get("latest_trade") or {}
    quote = raw.get("latestQuote") or raw.get("latest_quote") or {}
    daily = raw.get("dailyBar") or raw.get("daily_bar") or {}
    previous = raw.get("prevDailyBar") or raw.get("prev_daily_bar") or {}
    price = _number(trade.get("p"), _number(daily.get("c")))
    previous_close = _number(previous.get("c"))
    change = ((price / previous_close) - 1) * 100 if price > 0 and previous_close > 0 else 0.0
    ask = _number(quote.get("ap"))
    bid = _number(quote.get("bp"))
    ask_size = max(0.0, _number(quote.get("as")))
    bid_size = max(0.0, _number(quote.get("bs")))
    midpoint = (ask + bid) / 2 if ask > 0 and bid > 0 else 0.0
    spread_bps = ((ask - bid) / midpoint * 10_000) if midpoint > 0 else None
    volume = max(0.0, _number(daily.get("v")))
    quote_as_of = quote.get("t")
    trade_as_of = trade.get("t")
    return {
        "symbol": symbol,
        "price": price or None,
        "change24h": round(change, 4),
        "volume24h": volume,
        "volume": volume,
        "dailyDollarVolume": round(volume * (price or midpoint), 2),
        "bid": bid or None,
        "ask": ask or None,
        "bidSize": bid_size,
        "askSize": ask_size,
        "bidNotional": round(bid_size * bid, 2),
        "askNotional": round(ask_size * ask, 2),
        "spreadBps": round(spread_bps, 2) if spread_bps is not None else None,
        "quoteAsOf": quote_as_of,
        "tradeAsOf": trade_as_of,
        "asOf": trade_as_of or quote_as_of or daily.get("t") or _iso(),
    }


def _entry_market_gate(
    snapshot: Optional[Mapping[str, Any]],
    *,
    notional: float,
    minimum_notional: float,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Fail closed for new exposure while leaving reduce/exit paths untouched."""

    row = dict(snapshot or {})
    quote = dict(row.get("latestQuote") or row.get("latest_quote") or {})
    bid = max(0.0, _number(row.get("bid"), _number(quote.get("bp"))))
    ask = max(0.0, _number(row.get("ask"), _number(quote.get("ap"))))
    bid_size = max(0.0, _number(row.get("bidSize"), _number(quote.get("bs"))))
    ask_size = max(0.0, _number(row.get("askSize"), _number(quote.get("as"))))
    midpoint = (bid + ask) / 2 if bid > 0 and ask >= bid else 0.0
    computed_spread = ((ask - bid) / midpoint * 10_000) if midpoint > 0 else None
    spread_bps = _number(row.get("spreadBps"), computed_spread if computed_spread is not None else float("nan"))
    quote_time = _parse_utc_datetime(
        row.get("quoteAsOf") or quote.get("t") or row.get("quoteTimestamp")
    )
    current = (now or _utc_now()).astimezone(timezone.utc)
    quote_age = (current - quote_time).total_seconds() if quote_time else None
    price = max(0.0, _number(row.get("price"), midpoint)) or midpoint
    volume = max(0.0, _number(row.get("volume24h"), _number(row.get("volume"), 0.0)))
    daily_dollar_volume = max(
        0.0,
        _number(row.get("dailyDollarVolume"), volume * price),
    )
    ask_notional = max(0.0, _number(row.get("askNotional"), ask_size * ask))
    requested = max(0.0, _number(notional))
    minimum = max(0.0, _number(minimum_notional))
    required_daily_volume = max(
        MIN_ENTRY_DAILY_DOLLAR_VOLUME,
        requested / MAX_ENTRY_DAILY_VOLUME_PARTICIPATION,
    )
    required_top_of_book = max(minimum, requested * MIN_ENTRY_TOP_OF_BOOK_FRACTION)
    reasons = []
    warnings = []
    if bid <= 0 or ask <= 0 or ask < bid:
        reasons.append("invalid_quote")
    if quote_age is None or quote_age < -5 or quote_age > MAX_ENTRY_QUOTE_AGE_SECONDS:
        reasons.append("stale_quote")
    if not math.isfinite(spread_bps) or spread_bps < 0:
        reasons.append("spread_unavailable")
    elif spread_bps > MAX_ENTRY_SPREAD_BPS:
        reasons.append("spread_too_wide")
    if daily_dollar_volume <= 0:
        warnings.append("daily_liquidity_unreported")
    elif daily_dollar_volume < required_daily_volume:
        reasons.append("insufficient_daily_liquidity")
    if ask_notional <= 0:
        warnings.append("quote_depth_unreported")
    elif ask_notional < required_top_of_book:
        reasons.append("insufficient_quote_depth")
    return _jsonable({
        "eligible": not reasons,
        "reasons": reasons,
        "warnings": warnings,
        "quoteAgeSeconds": round(quote_age, 3) if quote_age is not None else None,
        "spreadBps": round(spread_bps, 3) if math.isfinite(spread_bps) else None,
        "dailyDollarVolume": round(daily_dollar_volume, 2),
        "requiredDailyDollarVolume": round(required_daily_volume, 2),
        "askNotional": round(ask_notional, 2),
        "requiredAskNotional": round(required_top_of_book, 2),
    })


class _CryptoService:
    def __init__(
        self,
        *,
        require_auth,
        resolve_alpaca_config_for_user,
        operations_store,
        supabase_admin=None,
        supabase_execute=None,
        safe_print=print,
        ai_reviewer=None,
        ai_status_resolver=None,
        notifier=None,
    ):
        self.require_auth = require_auth
        self.resolve_alpaca = resolve_alpaca_config_for_user
        self.store = operations_store
        self.supabase_admin = supabase_admin
        self.supabase_execute = supabase_execute
        self.safe_print = safe_print
        self.ai_reviewer = ai_reviewer
        self.ai_status_resolver = ai_status_resolver
        self.notifier = notifier
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._user_locks: Dict[str, threading.Lock] = {}
        self._routing_locks: Dict[str, threading.RLock] = {}
        self._locks_guard = threading.RLock()
        self._scheduler_last_scan: Optional[str] = None
        self._scheduler_last_error = ""
        self._scheduler_cursor = 0
        self._scheduler_scan_count = 0
        self._scheduler_last_page_size = 0
        try:
            configured_workers = int(os.getenv("CRYPTO_SCHEDULER_WORKERS", "2"))
        except (TypeError, ValueError):
            configured_workers = 2
        self._scheduler_workers = max(1, min(configured_workers, 2))
        self._scheduler_executor = ThreadPoolExecutor(
            max_workers=self._scheduler_workers,
            thread_name_prefix="alphalab-crypto-cycle",
        )
        self._scheduler_futures: Dict[str, Future] = {}
        self._scheduler_futures_guard = threading.RLock()

    def _auth_user(self) -> Dict[str, Any]:
        user = self.require_auth()
        if not isinstance(user, Mapping) or not str(user.get("id") or "").strip():
            raise CryptoApiError("Authentication required", status=401, code="authentication_required")
        return dict(user)

    def _get_config_row(self, uid: str):
        return self.store.get_artifact(uid, CONFIG_TYPE, PRIMARY_KEY)

    def get_config_snapshot(self, uid: str) -> Tuple[Dict[str, Any], int]:
        row = self._get_config_row(uid)
        payload = dict((row or {}).get("payload") or {})
        version = int((row or {}).get("version") or 0)
        try:
            return _validate_config(payload, base=_default_config()), version
        except CryptoApiError:
            safe = _default_config()
            safe.update({"killSwitch": True, "enabled": False, "liveAuthorized": False})
            safe["configError"] = "Stored crypto configuration is invalid and was disabled."
            return safe, version

    def get_config(self, uid: str) -> Dict[str, Any]:
        return self.get_config_snapshot(uid)[0]

    def save_config(self, uid: str, config: Mapping[str, Any], idempotency_key: str):
        return self.store.put_artifact(
            uid, CONFIG_TYPE, PRIMARY_KEY, payload=_jsonable(dict(config)),
            idempotency_key=idempotency_key,
        )

    def get_runtime(self, uid: str) -> Dict[str, Any]:
        row = self.store.get_artifact(uid, RUNTIME_TYPE, PRIMARY_KEY)
        payload = dict((row or {}).get("payload") or {})
        result = _runtime_default()
        result.update(payload)
        # Migrate the original nested ``progress`` shape while preserving a
        # stable, top-level runtime contract for current clients.
        legacy_progress = result.get("progress")
        if isinstance(legacy_progress, Mapping):
            detail = dict(result.get("progressDetail") or {})
            detail.update(dict(legacy_progress))
            result["progressDetail"] = detail
            result["currentStage"] = str(
                payload.get("currentStage") or detail.get("stage") or result.get("status") or "idle"
            )
            result["progress"] = 100 if result["currentStage"] == "complete" else 0
        else:
            result["progress"] = max(0, min(100, int(_number(legacy_progress, 0))))
        heartbeat = result.get("heartbeat") or result.get("lastHeartbeat")
        result["heartbeat"] = heartbeat
        result["lastHeartbeat"] = result.get("lastHeartbeat") or heartbeat
        if not isinstance(result.get("progressDetail"), Mapping):
            result["progressDetail"] = deepcopy(_runtime_default()["progressDetail"])
        result["currentStage"] = str(
            result.get("currentStage")
            or result["progressDetail"].get("stage")
            or result.get("status")
            or "idle"
        )
        if not payload.get("message"):
            result["message"] = "Crypto automation is %s." % result["currentStage"]
        else:
            result["message"] = str(result.get("message"))
        return result

    def save_runtime(self, uid: str, runtime: Mapping[str, Any], idempotency_key: str):
        return self.store.put_artifact(
            uid, RUNTIME_TYPE, PRIMARY_KEY, payload=_jsonable(dict(runtime)),
            idempotency_key=idempotency_key,
        )

    def _audit(self, uid: str, event_type: str, payload: Mapping[str, Any], key: str, *, actor="system"):
        try:
            return self.store.append_audit(
                uid, event_type=event_type, idempotency_key=key, actor=actor,
                source="crypto_api", resource_type="crypto", resource_id=str(payload.get("symbol") or PRIMARY_KEY),
                payload=_jsonable(dict(payload)),
            )
        except Exception as exc:  # history degradation must not mutate order behavior
            self.safe_print("[Crypto] audit append failed: %s" % type(exc).__name__)
            return None

    def _notify(self, uid: str, event_type: str, payload: Mapping[str, Any]):
        if not callable(self.notifier):
            return None
        try:
            return self.notifier(uid, event_type, _jsonable(dict(payload)))
        except Exception as exc:
            self.safe_print("[Crypto] notification failed: %s" % type(exc).__name__)
            return None

    def _restricted_ai_review(self, uid: str, decision: Mapping[str, Any]) -> Dict[str, Any]:
        """Apply an optional structured AI challenge without widening risk.

        AI may veto a proposed entry or make a REDUCE more conservative. It
        cannot originate exposure, turn an exit into a hold, increase target
        weight, alter broker fields, or add an unsupported action.
        """
        result = deepcopy(dict(decision))
        result["reviewer"] = "deterministic"
        if not callable(self.ai_reviewer) or result.get("action") == "HOLD":
            return result
        evidence = {
            "symbol": result.get("symbol"),
            "mode": result.get("mode"),
            "action": result.get("action"),
            "score": result.get("score"),
            "regime": result.get("regime"),
            "targetWeight": result.get("targetWeight"),
            "price": result.get("price"),
            "indicators": dict(result.get("indicators") or {}),
            "risk": dict(result.get("risk") or {}),
            "reasons": list(result.get("reasons") or [])[:12],
            "allowedActions": list(result.get("allowed_actions") or []),
        }
        try:
            review = self.ai_reviewer(uid, evidence)
        except Exception as exc:
            unavailable = {"status": "unavailable", "reason": type(exc).__name__}
            if result.get("mode") == "live" and result.get("action") in {"BUY", "ADD"}:
                result["action"] = "HOLD"
                result["targetWeight"] = _number(result.get("currentWeight"), 0.0)
                unavailable["appliedAction"] = "HOLD"
            result["aiReview"] = unavailable
            return result
        if not isinstance(review, Mapping):
            invalid = {"status": "invalid"}
            if result.get("mode") == "live" and result.get("action") in {"BUY", "ADD"}:
                result["action"] = "HOLD"
                result["targetWeight"] = _number(result.get("currentWeight"), 0.0)
                invalid["appliedAction"] = "HOLD"
            result["aiReview"] = invalid
            return result
        review_status = str(review.get("status") or "reviewed").strip().lower()
        verdict = str(review.get("verdict") or "caution").strip().lower()
        suggested = str(review.get("action") or result["action"]).strip().upper()
        summary = str(review.get("summary") or review.get("reason") or "")[:600]
        original = str(result["action"])
        safe_action = original
        if original in {"BUY", "ADD"}:
            unavailable_live_entry = (
                result.get("mode") == "live"
                and (review_status in {"unavailable", "invalid", "not_configured", "error"} or verdict == "unavailable")
            )
            if unavailable_live_entry or verdict in {"reject", "block"} or suggested == "HOLD":
                safe_action = "HOLD"
                result["targetWeight"] = _number(result.get("currentWeight"), 0.0)
            elif original == "ADD" and suggested in {"REDUCE", "EXIT"}:
                safe_action = suggested
                current_weight = _number(result.get("currentWeight"), 0.0)
                result["targetWeight"] = 0.0 if suggested == "EXIT" else round(current_weight * 0.5, 6)
            elif original == "BUY" and suggested in {"REDUCE", "EXIT"}:
                safe_action = "HOLD"
                result["targetWeight"] = 0.0
        elif original == "REDUCE" and suggested == "EXIT":
            safe_action = "EXIT"
            result["targetWeight"] = 0.0
        # EXIT is immutable and HOLD never reaches the reviewer.
        result["action"] = safe_action
        result["reviewer"] = "restricted_ai_challenge"
        result["aiReview"] = {
            "status": review_status, "verdict": verdict,
            "suggestedAction": suggested, "appliedAction": safe_action,
            "source": str(review.get("source") or "settings_ai")[:120],
            "summary": summary,
            "counterEvidence": str(review.get("counterEvidence") or "")[:600],
            "invalidation": str(review.get("invalidation") or "")[:600],
        }
        return result

    def ai_status(self, uid: str) -> Dict[str, Any]:
        """Return non-secret metadata for the user's Settings AI provider."""
        if not callable(self.ai_status_resolver):
            return {"configured": False, "status": "unavailable", "provider": "", "model": ""}
        try:
            value = self.ai_status_resolver(uid)
            if not isinstance(value, Mapping):
                raise TypeError("invalid_ai_status")
            return {
                "configured": bool(value.get("configured")),
                "status": str(value.get("status") or "unknown")[:80],
                "provider": str(value.get("provider") or "")[:80],
                "model": str(value.get("model") or "")[:120],
                "source": str(value.get("source") or "")[:120],
                "role": "bounded_risk_challenge",
            }
        except Exception:
            return {"configured": False, "status": "unavailable", "provider": "", "model": ""}

    def _broker_config(self, uid: str, mode: str) -> Dict[str, Any]:
        resolver_mode = "paper" if mode == "paper" else "real"
        value = self.resolve_alpaca(uid, resolver_mode)
        if isinstance(value, tuple):
            value = value[0]
        config = dict(value or {})
        key = str(config.get("api_key") or "")
        secret = str(config.get("api_secret") or "")
        if not key or not secret:
            raise CryptoApiError(
                f"Alpaca {mode} credentials are not configured", status=409, code="broker_not_configured",
            )
        config["base_url"] = _trusted_alpaca_base_url(config.get("base_url"), mode)
        return config

    def _data_config(self, uid: str, mode: str) -> Dict[str, Any]:
        try:
            value = self.resolve_alpaca(uid, "market_data")
            if isinstance(value, tuple):
                value = value[0]
            value = dict(value or {})
            if value.get("api_key") and value.get("api_secret"):
                return value
        except Exception:
            pass
        return self._broker_config(uid, mode)

    @staticmethod
    def _headers(config: Mapping[str, Any]) -> Dict[str, str]:
        return {
            "APCA-API-KEY-ID": str(config["api_key"]),
            "APCA-API-SECRET-KEY": str(config["api_secret"]),
            "Accept": "application/json",
        }

    def account(self, uid: str, mode: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        config = self._broker_config(uid, mode)
        account = _request_json("GET", f"{config['base_url']}/v2/account", headers=self._headers(config))
        if not isinstance(account, Mapping):
            raise BrokerError("Broker account response is invalid", status=502, code="broker_invalid_account")
        return dict(account), _account_gate(account)

    def positions(self, uid: str, mode: str) -> Sequence[Dict[str, Any]]:
        config = self._broker_config(uid, mode)
        rows = _request_json("GET", f"{config['base_url']}/v2/positions", headers=self._headers(config))
        if not isinstance(rows, list):
            raise BrokerError("Broker positions response is invalid", status=502, code="broker_invalid_positions")
        crypto = []
        for raw in rows:
            if not isinstance(raw, Mapping):
                continue
            symbol = _position_symbol(raw)
            if (
                symbol not in SUPPORTED_SYMBOLS
                and str(raw.get("asset_class") or "").lower() != "crypto"
                and not _looks_like_crypto_pair(symbol)
            ):
                continue
            public = _public_position(raw)
            if public["qty"] < 0 or public["side"] == "short":
                raise CryptoApiError("Short crypto positions are not supported", status=409, code="short_position_blocked")
            crypto.append(public)
        return crypto

    @staticmethod
    def _public_order(raw: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
        symbol = _normalize_symbol(raw.get("symbol"))
        asset_class = str(raw.get("asset_class") or "").strip().lower()
        if symbol not in SUPPORTED_SYMBOLS and asset_class != "crypto" and not _looks_like_crypto_pair(symbol):
            return None
        side = str(raw.get("side") or "").strip().lower()
        if side not in {"buy", "sell"}:
            return None
        qty = max(0.0, _number(raw.get("qty")))
        filled_qty = max(0.0, _number(raw.get("filled_qty", raw.get("filledQty"))))
        return {
            "id": raw.get("id"),
            "clientOrderId": raw.get("client_order_id", raw.get("clientOrderId")),
            "symbol": symbol,
            "side": side,
            "type": str(raw.get("type") or "").lower(),
            "timeInForce": str(raw.get("time_in_force", raw.get("timeInForce")) or "").lower(),
            "status": str(raw.get("status") or "unknown").lower(),
            "qty": qty,
            "filledQty": filled_qty,
            "remainingQty": max(0.0, _number(raw.get("remaining_qty"), max(0.0, qty - filled_qty))),
            "notional": max(0.0, _number(raw.get("notional"))),
            "limitPrice": max(0.0, _number(raw.get("limit_price", raw.get("limitPrice")))),
            "stopPrice": max(0.0, _number(raw.get("stop_price", raw.get("stopPrice")))),
            "filledAveragePrice": max(0.0, _number(
                raw.get("filled_avg_price", raw.get("filledAveragePrice")),
            )),
            "createdAt": raw.get("created_at", raw.get("createdAt")),
            "updatedAt": raw.get("updated_at", raw.get("updatedAt")),
            "alphaLabOwned": str(
                raw.get("client_order_id", raw.get("clientOrderId")) or ""
            ).startswith("alphalab-crypto-"),
            "assetClass": asset_class or "crypto",
        }

    def open_orders(self, uid: str, mode: str) -> Sequence[Dict[str, Any]]:
        """Return all non-terminal crypto orders that still reserve exposure."""
        config = self._broker_config(uid, mode)
        rows = _request_json(
            "GET",
            f"{config['base_url']}/v2/orders",
            headers=self._headers(config),
            params={"status": "open", "limit": 500, "nested": "false"},
        )
        if not isinstance(rows, list):
            raise BrokerError("Broker open orders response is invalid", status=502, code="broker_invalid_orders")
        result = []
        for raw in rows:
            if not isinstance(raw, Mapping):
                continue
            public = self._public_order(raw)
            if public is not None:
                result.append(public)
        return result

    def removed_symbol_dependencies(
        self,
        uid: str,
        mode: str,
        symbols: Iterable[str],
    ) -> Dict[str, Sequence[str]]:
        """Return durable/broker dependencies that make symbol removal unsafe.

        The caller holds the per-user routing lock, so an AlphaLab order cannot
        be submitted between this read and the configuration write. Broker read
        failures intentionally propagate: losing visibility must never make a
        destructive universe change appear safe.
        """

        removed = {
            normalized
            for raw in symbols
            if (normalized := _normalize_symbol(raw)) in SUPPORTED_SYMBOLS
        }
        if not removed:
            return {}
        dependencies: Dict[str, set[str]] = {symbol: set() for symbol in removed}

        runtime = self.get_runtime(uid)
        raw_pending = runtime.get("pendingReconciliations") or {}
        if not isinstance(raw_pending, Mapping):
            raise CryptoApiError(
                "Crypto reconciliation state is invalid; symbol removal was blocked",
                status=409,
                code="symbol_dependency_unknown",
            )
        for record in raw_pending.values():
            if not isinstance(record, Mapping):
                raise CryptoApiError(
                    "Crypto reconciliation state is incomplete; symbol removal was blocked",
                    status=409,
                    code="symbol_dependency_unknown",
                )
            symbol = _normalize_symbol(record.get("symbol"))
            if not symbol:
                raise CryptoApiError(
                    "A pending crypto reconciliation has no reliable symbol; symbol removal was blocked",
                    status=409,
                    code="symbol_dependency_unknown",
                )
            if symbol in dependencies:
                dependencies[symbol].add("pending_reconciliation")

        for position in self.positions(uid, mode):
            if not isinstance(position, Mapping):
                continue
            symbol = _normalize_symbol(position.get("symbol"))
            if symbol in dependencies and (
                abs(_number(position.get("qty"))) > 1e-12
                or _number(position.get("marketValue")) > 0
            ):
                dependencies[symbol].add("position")

        for order in self.open_orders(uid, mode):
            if not isinstance(order, Mapping):
                continue
            symbol = _normalize_symbol(order.get("symbol"))
            if symbol in dependencies:
                dependencies[symbol].add("open_order")

        return {
            symbol: sorted(reasons)
            for symbol, reasons in dependencies.items()
            if reasons
        }

    def recent_orders(self, uid: str, mode: str, *, limit: int = 500) -> Sequence[Dict[str, Any]]:
        """Return recent open and closed crypto orders for fill reconciliation."""

        config = self._broker_config(uid, mode)
        rows = _request_json(
            "GET",
            f"{config['base_url']}/v2/orders",
            headers=self._headers(config),
            params={
                "status": "all",
                "limit": min(500, max(1, int(limit))),
                "direction": "desc",
                "nested": "false",
            },
        )
        if not isinstance(rows, list):
            raise BrokerError("Broker order history response is invalid", status=502, code="broker_invalid_orders")
        result = []
        for raw in rows:
            if isinstance(raw, Mapping):
                public = self._public_order(raw)
                if public is not None:
                    result.append(public)
        return result

    @staticmethod
    def _open_order_reservation(
        orders: Sequence[Mapping[str, Any]], symbol: str, mark_price: float,
    ) -> Dict[str, Any]:
        reservation = {
            "count": 0,
            "buyNotional": 0.0,
            "unpricedBuyCount": 0,
            "sellQty": 0.0,
            "sellNotional": 0.0,
            "orderIds": [],
        }
        mark = max(0.0, _number(mark_price))
        for order in orders:
            if _normalize_symbol(order.get("symbol")) != symbol:
                continue
            side = str(order.get("side") or "").lower()
            remaining_qty = max(0.0, _number(order.get("remainingQty")))
            reference_price = (
                max(0.0, _number(order.get("limitPrice")))
                or max(0.0, _number(order.get("stopPrice")))
                or mark
            )
            reservation["count"] += 1
            if order.get("id"):
                reservation["orderIds"].append(str(order["id"]))
            if side == "buy":
                remaining_notional = max(0.0, _number(order.get("notional")))
                if remaining_notional <= 0:
                    remaining_notional = remaining_qty * reference_price
                # Never understate a pending buy. Broker notional semantics can
                # vary by order state, so retain the larger observable reserve.
                remaining_notional = max(remaining_notional, remaining_qty * reference_price)
                reservation["buyNotional"] += remaining_notional
                if remaining_notional <= 0:
                    reservation["unpricedBuyCount"] += 1
            elif side == "sell":
                reservation["sellQty"] += remaining_qty
                reservation["sellNotional"] += remaining_qty * reference_price
        return reservation

    def assets(self, uid: str, mode: str) -> Sequence[Dict[str, Any]]:
        cache_key = f"assets:{uid}:{mode}"
        cached = _CACHE.get(cache_key)
        if cached is not None:
            return cached
        config = self._broker_config(uid, mode)
        rows = _request_json(
            "GET", f"{config['base_url']}/v2/assets", headers=self._headers(config),
            params={"asset_class": "crypto", "status": "active"},
        )
        if not isinstance(rows, list):
            raise BrokerError("Broker assets response is invalid", status=502, code="broker_invalid_assets")
        result = []
        for raw in rows:
            if not isinstance(raw, Mapping):
                continue
            symbol = _normalize_symbol(raw.get("symbol"))
            if not symbol or str(raw.get("status") or "active").lower() != "active":
                continue
            result.append({
                "symbol": symbol,
                "name": raw.get("name") or symbol,
                # Alpaca normally supplies a boolean.  Missing/malformed
                # metadata is not an affirmative routing permission.
                "tradable": _optional_boolean(raw.get("tradable")),
                "fractionable": bool(raw.get("fractionable", True)),
                "minOrderSize": str(raw.get("min_order_size") or "0.000000001"),
                "minTradeIncrement": str(raw.get("min_trade_increment") or "0.000000001"),
                "priceIncrement": str(raw.get("price_increment") or "0.01"),
                "status": "active",
                "strategySupported": symbol in SUPPORTED_SYMBOLS,
            })
        _CACHE.put(cache_key, result, 300)
        return result

    def snapshots(
        self,
        uid: str,
        mode: str,
        symbols: Iterable[str],
        *,
        force_refresh: bool = False,
    ) -> Dict[str, Dict[str, Any]]:
        normalized = tuple(sorted({_normalize_symbol(symbol) for symbol in symbols if _normalize_symbol(symbol)}))
        if not normalized:
            return {}
        cache_key = f"snapshots:{uid}:{mode}:{','.join(normalized)}"
        if not force_refresh:
            cached = _CACHE.get(cache_key)
            if cached is not None:
                return cached
        data_config = self._data_config(uid, mode)
        payload = _request_json(
            "GET", f"{DATA_BASE_URL}/v1beta3/crypto/us/snapshots",
            headers=self._headers(data_config), params={"symbols": ",".join(normalized)},
        )
        raw_snapshots = payload.get("snapshots") if isinstance(payload, Mapping) else {}
        raw_snapshots = dict(raw_snapshots or {})
        # Alpaca can occasionally omit one member of a multi-symbol snapshot
        # response even though the pair is healthy. Retry only the missing
        # member so a transient ETH omission does not blank the whole row.
        # This is a display/data-recovery retry only; order routing still
        # applies the strict fresh-quote gate below.
        for symbol in normalized:
            if raw_snapshots.get(symbol):
                continue
            try:
                retry_payload = _request_json(
                    "GET", f"{DATA_BASE_URL}/v1beta3/crypto/us/snapshots",
                    headers=self._headers(data_config), params={"symbols": symbol},
                    attempts=2,
                )
                retry_rows = retry_payload.get("snapshots") if isinstance(retry_payload, Mapping) else {}
                if isinstance(retry_rows, Mapping) and retry_rows.get(symbol):
                    raw_snapshots[symbol] = retry_rows[symbol]
            except Exception:
                # A missing member remains explicit in the public contract.
                # Never substitute it for execution-grade data.
                pass
        result = {
            symbol: _snapshot_public(symbol, dict(raw_snapshots.get(symbol) or {}))
            for symbol in normalized
        }
        _CACHE.put(cache_key, result, 10)
        return result

    def bars(
        self,
        uid: str,
        mode: str,
        symbol: str,
        *,
        timeframe: str = "1Hour",
        limit: Optional[int] = None,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> Sequence[Dict[str, Any]]:
        symbol = _normalize_symbol(symbol)
        if symbol not in SUPPORTED_SYMBOLS:
            raise CryptoApiError("Unsupported strategy symbol", code="unsupported_symbol")
        if timeframe not in {"15Min", "1Hour", "1Day"}:
            raise CryptoApiError("Unsupported crypto timeframe", code="invalid_timeframe")
        safe_limit = max(2, min(int(limit or required_history_bars()), 10_000))
        explicit_start = bool(start)
        explicit_end = bool(end)
        now = _utc_now()
        complete_before = _complete_bar_cutoff(now, timeframe)
        cache_window = f"{start or 'recent'}:{end or 'open'}:{complete_before.isoformat()}"
        cache_key = "bars:%s:%s:%s:%s:%s:%s" % (
            uid, mode, symbol, timeframe, safe_limit, cache_window,
        )
        cached = _BARS_CACHE.get(cache_key)
        if cached is not None:
            return cached
        if not explicit_start:
            minutes = {"15Min": 15, "1Hour": 60, "1Day": 1440}[timeframe]
            start = (_utc_now() - timedelta(minutes=minutes * int(safe_limit * 1.15 + 48))).isoformat()
        # Recent windows must be read newest-first.  Reading an oversized
        # window in ascending order and then stopping after ``safe_limit``
        # rows returns the *oldest* portion of that window, which makes the
        # strategy appear stale even though Alpaca has current bars.
        sort_order = "asc" if explicit_start else "desc"
        data_config = self._data_config(uid, mode)
        params: Dict[str, Any] = {
            "symbols": symbol,
            "timeframe": timeframe,
            # The latest Alpaca row can be the bar still in progress. Ask for
            # one extra row, then apply our own completion boundary.
            "limit": min(10_000, safe_limit + 1),
            "sort": sort_order,
            "start": start,
        }
        if explicit_end:
            params["end"] = end
        rows = []
        page_token = None
        seen_page_tokens = set()
        # Alpaca documents that a page may contain fewer rows than requested,
        # even when more data exists.  Follow every distinct continuation
        # token until the requested window is complete, with a defensive cap
        # against a malformed upstream token loop.
        for _ in range(128):
            if page_token:
                params["page_token"] = page_token
            payload = _request_json(
                "GET", f"{DATA_BASE_URL}/v1beta3/crypto/us/bars",
                headers=self._headers(data_config), params=params,
            )
            page_rows = ((payload.get("bars") or {}).get(symbol) or []) if isinstance(payload, Mapping) else []
            rows.extend(dict(row) for row in page_rows if isinstance(row, Mapping))
            next_page_token = payload.get("next_page_token") if isinstance(payload, Mapping) else None
            if next_page_token in seen_page_tokens:
                break
            if next_page_token:
                seen_page_tokens.add(next_page_token)
            page_token = next_page_token
            if not page_token or len(rows) >= safe_limit + 1:
                break
        deduped = {str(row.get("t") or row.get("timestamp")): row for row in rows}
        complete_rows = []
        for row in deduped.values():
            timestamp = _parse_utc_datetime(row.get("t") or row.get("timestamp") or row.get("time"))
            if timestamp is not None and timestamp < complete_before:
                complete_rows.append(row)
        result = sorted(complete_rows, key=lambda row: str(row.get("t") or row.get("timestamp")))
        result = result[-safe_limit:]
        _BARS_CACHE.put(cache_key, result, 45 if timeframe != "15Min" else 15)
        return tuple(result)

    def latest_decisions(self, uid: str) -> Sequence[Dict[str, Any]]:
        rows = self.store.list_artifacts(uid, artifact_type=DECISION_TYPE, limit=20)
        return [_decision_public(row) for row in rows]

    def _audit_page(self, uid: str, *, offset: int, limit: int) -> Sequence[Dict[str, Any]]:
        safe_offset = max(0, int(offset))
        safe_limit = min(LEDGER_PAGE_SIZE, max(1, int(limit)))
        if self.supabase_admin is not None:
            table_name = str(getattr(self.store, "AUDIT_TABLE", "user_operations_audit_events"))

            def operation():
                return self.supabase_admin.table(table_name).select("*").eq(
                    "user_id", uid,
                ).order(
                    "created_at", desc=True,
                ).order(
                    "id", desc=True,
                ).range(
                    safe_offset, safe_offset + safe_limit - 1,
                ).execute()

            response = self.supabase_execute(operation, "crypto ledger page") if self.supabase_execute else operation()
            return [dict(row) for row in _response_data(response) if isinstance(row, Mapping)]
        page_reader = getattr(self.store, "list_audit_page", None)
        if callable(page_reader):
            return list(page_reader(uid, offset=safe_offset, limit=safe_limit))
        # Legacy/local stores expose only a bounded first page. Retain that
        # compatibility without pretending later rows were scanned.
        rows = list(self.store.list_audit(uid, limit=min(200, safe_offset + safe_limit)))
        return rows[safe_offset:safe_offset + safe_limit]

    def ledger_with_meta(self, uid: str, limit: int = 50) -> Dict[str, Any]:
        safe_limit = min(100, max(1, int(limit)))
        result = []
        scanned_rows = 0
        scanned_pages = 0
        last_page_size = 0
        for page_index in range(LEDGER_MAX_PAGES):
            if scanned_rows >= LEDGER_MAX_SCANNED_ROWS or len(result) >= safe_limit:
                break
            page = list(self._audit_page(
                uid,
                offset=page_index * LEDGER_PAGE_SIZE,
                limit=min(LEDGER_PAGE_SIZE, LEDGER_MAX_SCANNED_ROWS - scanned_rows),
            ))
            scanned_pages += 1
            last_page_size = len(page)
            scanned_rows += len(page)
            for row in page:
                if not isinstance(row, Mapping):
                    continue
                if row.get("resource_type") != "crypto" and not str(row.get("event_type") or "").startswith("crypto_"):
                    continue
                result.append(_jsonable({
                    "id": row.get("id"),
                    "eventType": row.get("event_type"),
                    "actor": row.get("actor"),
                    "source": row.get("source"),
                    "symbol": row.get("resource_id"),
                    "payload": dict(row.get("payload") or {}),
                    "createdAt": row.get("created_at"),
                }))
                if len(result) >= safe_limit:
                    break
            if last_page_size < LEDGER_PAGE_SIZE:
                break
        return {
            "records": result[:safe_limit],
            "requestedLimit": safe_limit,
            "scannedRows": scanned_rows,
            "scannedPages": scanned_pages,
            "maxScannedRows": LEDGER_MAX_SCANNED_ROWS,
            "maxPages": LEDGER_MAX_PAGES,
            "scanTruncated": bool(
                len(result) < safe_limit
                and scanned_pages >= LEDGER_MAX_PAGES
                and last_page_size >= LEDGER_PAGE_SIZE
            ),
        }

    def ledger(self, uid: str, limit: int = 50) -> Sequence[Dict[str, Any]]:
        return list(self.ledger_with_meta(uid, limit)["records"])

    def _user_lock(self, uid: str) -> threading.Lock:
        """Return the stable process-local cycle lock for one user.

        This is not represented as a distributed/global lock. Cross-instance
        safety relies on durable config version checks, open-order
        reconciliation, and deterministic broker client-order IDs.
        """
        with self._locks_guard:
            if uid not in self._user_locks:
                self._user_locks[uid] = threading.Lock()
            return self._user_locks[uid]

    def _routing_lock(self, uid: str) -> threading.RLock:
        """Serialize order admission with durable stop/kill configuration writes.

        Cycle locks deliberately do not cover the whole stop endpoint: a user
        must be able to stop a long-running data/AI pass.  This much narrower
        lock is held only while the final durable policy check and broker order
        submission happen.  Once a stop or kill request returns, no later order
        from an already-running cycle can pass the same lock.
        """
        with self._locks_guard:
            if uid not in self._routing_locks:
                self._routing_locks[uid] = threading.RLock()
            return self._routing_locks[uid]

    def _assert_order_routing_allowed(
        self,
        uid: str,
        *,
        mode: str,
        expected_config_version: int,
        source: str,
    ) -> Dict[str, Any]:
        current, current_version = self.get_config_snapshot(uid)
        if current.get("killSwitch"):
            raise CryptoApiError(
                "Crypto kill switch is active",
                status=409,
                code="kill_switch_active",
            )
        if source == "scheduler" and not current.get("enabled"):
            raise CryptoApiError(
                "Crypto automation was stopped before order routing",
                status=409,
                code="automation_stopped",
            )
        if current_version != expected_config_version:
            raise CryptoApiError(
                "Crypto configuration changed before order routing; run a new cycle",
                status=409,
                code="cycle_config_changed",
            )
        if current.get("mode") != mode:
            raise CryptoApiError(
                "Crypto trading mode changed before order routing",
                status=409,
                code="cycle_config_changed",
            )
        if mode == "live" and not current.get("liveAuthorized"):
            raise CryptoApiError(
                "Live crypto automation is not explicitly authorized",
                status=403,
                code="live_not_authorized",
            )
        if mode == "live":
            _require_live_release_admitted()
        return current

    def _save_decision(self, uid: str, decision: Mapping[str, Any], bucket: int):
        symbol_key = _safe_symbol_key(str(decision.get("symbol") or "unknown"))
        key = f"latest:{symbol_key}"
        self.store.put_artifact(
            uid, DECISION_TYPE, key, payload=_jsonable(dict(decision)),
            idempotency_key=f"crypto-decision:{uid}:{symbol_key}:{bucket}",
        )
        self._audit(
            uid, "crypto_decision", decision,
            f"crypto-audit:{uid}:{symbol_key}:{bucket}", actor="system",
        )

    def _existing_order(self, broker: Mapping[str, Any], client_order_id: str):
        try:
            return _request_json(
                "GET", f"{broker['base_url']}/v2/orders:by_client_order_id",
                headers=self._headers(broker), params={"client_order_id": client_order_id},
                expected=(200, 404), attempts=1,
            )
        except BrokerError as exc:
            if exc.code == "broker_http_404":
                return None
            raise

    @staticmethod
    def _order_id(uid: str, symbol: str, action: str, bucket: int) -> str:
        digest = hashlib.sha256(f"{uid}:{symbol}:{action}:{bucket}".encode("utf-8")).hexdigest()[:12]
        return f"alphalab-crypto-{_safe_symbol_key(symbol)[:6]}-{bucket}-{digest}"[:48]

    def _build_order(
        self,
        config: Mapping[str, Any],
        *,
        symbol: str,
        action: str,
        price: float,
        notional: float = 0.0,
        qty: float = 0.0,
        client_order_id: str,
        asset: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        if action not in {"BUY", "ADD", "REDUCE", "EXIT"}:
            raise CryptoApiError("Unsupported crypto action", code="invalid_order_contract")
        order_config = dict(config.get("order") or {})
        order_type = str(order_config.get("type") or "market").lower()
        tif = str(order_config.get("timeInForce") or "gtc").lower()
        if (
            order_type not in ALLOWED_ORDER_TYPES
            or tif not in ALLOWED_TIFS
            or tif not in ORDER_TIFS.get(order_type, frozenset())
        ):
            raise CryptoApiError("Unsafe crypto order contract", code="invalid_order_contract")
        side = "buy" if action in {"BUY", "ADD"} else "sell"
        asset_config = dict(asset or {})
        min_order_size = _increment(
            asset_config.get("minOrderSize", asset_config.get("min_order_size")),
            "0.000000001",
        )
        trade_increment = max(
            _increment(
                asset_config.get("minTradeIncrement", asset_config.get("min_trade_increment")),
                "0.000000001",
            ),
            Decimal("0.000000001"),
        )
        price_increment = _increment(
            asset_config.get("priceIncrement", asset_config.get("price_increment")),
            "0.01",
        )
        reference_price = _decimal(price)
        if reference_price <= 0:
            raise CryptoApiError("Reference price must be positive", code="invalid_order_contract")
        payload: Dict[str, Any] = {
            "symbol": _normalize_symbol(symbol),
            "side": side,
            "type": order_type,
            "time_in_force": tif,
            "client_order_id": client_order_id,
        }
        if side == "buy":
            safe_notional = min(
                _decimal(notional),
                _decimal(config.get("maxOrderNotional")),
                Decimal("200000"),
            )
            if safe_notional <= 0:
                raise CryptoApiError("Buy notional must be positive", code="invalid_order_contract")
            if order_type == "market":
                rounded_notional = _quantize_increment(safe_notional, Decimal("0.01"))
                if rounded_notional <= 0:
                    raise CryptoApiError("Buy notional is below broker precision", code="invalid_order_contract")
                payload["notional"] = _decimal_string(rounded_notional)
            else:
                buy_qty = _quantize_increment(safe_notional / reference_price, trade_increment)
                if buy_qty < min_order_size or buy_qty <= 0:
                    raise CryptoApiError(
                        "Buy quantity is below the asset minimum",
                        code="order_below_asset_minimum",
                    )
                payload["qty"] = _decimal_string(buy_qty)
        else:
            sell_qty = _quantize_increment(qty, trade_increment)
            if sell_qty < min_order_size or sell_qty <= 0:
                raise CryptoApiError("Sell quantity must be positive", code="invalid_order_contract")
            payload["qty"] = _decimal_string(sell_qty)
        limit_offset = _decimal(order_config.get("limitOffsetBps")) / Decimal("10000")
        stop_offset = _decimal(order_config.get("stopOffsetBps")) / Decimal("10000")
        if order_type == "stop_limit":
            if side == "buy":
                stop_price = _quantize_increment(
                    reference_price * (Decimal("1") + stop_offset),
                    price_increment,
                    round_up=True,
                )
                raw_limit = reference_price * (Decimal("1") + limit_offset)
                limit_price = _quantize_increment(
                    max(raw_limit, stop_price), price_increment, round_up=True,
                )
            else:
                stop_price = _quantize_increment(
                    reference_price * (Decimal("1") - stop_offset),
                    price_increment,
                )
                raw_limit = reference_price * (Decimal("1") - limit_offset)
                limit_price = _quantize_increment(
                    min(raw_limit, stop_price), price_increment,
                )
            if stop_price <= 0 or limit_price <= 0:
                raise CryptoApiError("Stop-limit prices must be positive", code="invalid_order_contract")
            payload["stop_price"] = _decimal_string(stop_price)
            payload["limit_price"] = _decimal_string(limit_price)
        elif order_type == "limit":
            raw_limit = reference_price * (
                (Decimal("1") + limit_offset) if side == "buy"
                else (Decimal("1") - limit_offset)
            )
            limit_price = _quantize_increment(
                raw_limit, price_increment, round_up=side == "buy",
            )
            if limit_price <= 0:
                raise CryptoApiError("Limit price must be positive", code="invalid_order_contract")
            payload["limit_price"] = _decimal_string(limit_price)
        return payload

    def _submit_order_guarded(
        self,
        uid: str,
        mode: str,
        payload: Mapping[str, Any],
        *,
        expected_config_version: int,
        source: str,
    ):
        """Perform the final policy and open-order checks immediately before submit."""
        with self._routing_lock(uid):
            self._assert_order_routing_allowed(
                uid,
                mode=mode,
                expected_config_version=expected_config_version,
                source=source,
            )
            symbol = _normalize_symbol(payload.get("symbol"))
            client_order_id = str(payload.get("client_order_id") or "")
            competing = [
                order for order in self.open_orders(uid, mode)
                if _normalize_symbol(order.get("symbol")) == symbol
                and str(order.get("clientOrderId") or "") != client_order_id
            ]
            if competing:
                raise CryptoApiError(
                    f"An open crypto order already reserves {symbol}",
                    status=409,
                    code="open_order_reservation",
                )
            return self._submit_order(uid, mode, payload)

    def _submit_order(self, uid: str, mode: str, payload: Mapping[str, Any]):
        broker = self._broker_config(uid, mode)
        client_order_id = str(payload.get("client_order_id") or "")
        existing = self._existing_order(broker, client_order_id)
        if isinstance(existing, Mapping) and existing.get("id"):
            return {**dict(existing), "idempotent": True}
        try:
            result = _request_json(
                "POST", f"{broker['base_url']}/v2/orders", headers=self._headers(broker),
                payload=payload, expected=(200, 201),
            )
        except BrokerError as exc:
            # Another worker can win the same deterministic client-order ID
            # between lookup and submit. Resolve the duplicate as success.
            if exc.code != "broker_http_422":
                raise
            result = self._existing_order(broker, client_order_id)
            if not isinstance(result, Mapping) or not result.get("id"):
                raise
        if not isinstance(result, Mapping):
            raise BrokerError("Broker order response is invalid", status=502, code="broker_invalid_order")
        return dict(result)

    @staticmethod
    def _equity_risk(runtime: Mapping[str, Any]) -> Dict[str, Any]:
        curve = list(runtime.get("equityCurve") or [])
        points = []
        for row in curve:
            if not isinstance(row, Mapping) or _number(row.get("value")) <= 0:
                continue
            try:
                timestamp = datetime.fromisoformat(str(row.get("time") or "").replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                continue
            points.append((timestamp.astimezone(timezone.utc), _number(row.get("value"))))
        if not points:
            return {"daily_return": 0.0, "seven_day_return": 0.0, "drawdown": 0.0}
        points.sort(key=lambda item: item[0])
        current_time, latest = points[-1]

        def baseline(hours):
            cutoff = current_time - timedelta(hours=hours)
            eligible = [value for timestamp, value in points if timestamp <= cutoff]
            return eligible[-1] if eligible else points[0][1]

        daily_base = baseline(24)
        week_base = baseline(24 * 7)
        peak = max(value for _, value in points)
        return {
            "daily_return": latest / daily_base - 1 if daily_base else 0.0,
            "seven_day_return": latest / week_base - 1 if week_base else 0.0,
            "drawdown": latest / peak - 1 if peak else 0.0,
        }

    def _record_failure(self, uid: str, config: Mapping[str, Any], runtime: Mapping[str, Any], exc: Exception):
        result = dict(runtime)
        errors = int(result.get("consecutiveErrors") or 0) + 1
        locked = errors >= 3
        failed_at = _iso()
        progress_detail = dict(result.get("progressDetail") or {})
        progress_detail.update({"stage": "error", "currentSymbol": progress_detail.get("currentSymbol")})
        message = str(exc)[:500]
        result.update({
            "status": "locked" if locked else "error",
            "locked": locked,
            "consecutiveErrors": errors,
            "lastError": message,
            "lastRun": failed_at,
            "lastHeartbeat": failed_at,
            "heartbeat": failed_at,
            "lastCycleStartedAt": result.get("cycleStartedAt"),
            "cycleStartedAt": None,
            "currentStage": "error",
            "progressDetail": progress_detail,
            "message": message,
            "nextRun": None if locked else (_utc_now() + timedelta(minutes=int(config["intervalMinutes"]))).isoformat(),
        })
        try:
            self.save_runtime(uid, result, f"crypto-runtime-error:{uid}:{time.time_ns()}")
        except Exception:
            pass
        self._audit(uid, "crypto_cycle_error", {"error": str(exc)[:500], "locked": locked}, f"crypto-error:{uid}:{time.time_ns()}")
        if locked:
            self._notify(uid, "risk_alert", {
                "assetType": "crypto", "assetClass": "crypto",
                "event": "Crypto automation locked", "error": str(exc)[:300],
                "consecutiveErrors": errors,
            })
        return result

    def _save_cycle_progress(
        self,
        uid: str,
        runtime: Dict[str, Any],
        *,
        config_version: int,
        mode: str,
        source: str,
        bucket: int,
        stage: str,
        completed_symbols: int,
        total_symbols: int,
        current_symbol: Optional[str] = None,
    ) -> None:
        """Persist a heartbeat without overwriting a concurrent stop/kill."""

        with self._routing_lock(uid):
            current_config = self._assert_order_routing_allowed(
                uid,
                mode=mode,
                expected_config_version=config_version,
                source=source,
            )
            latest = self.get_runtime(uid)
            heartbeat = _iso()
            started_at = latest.get("cycleStartedAt") if latest.get("status") == "running" else None
            total = max(0, int(total_symbols))
            completed = max(0, int(completed_symbols))
            if stage == "account":
                percent = 5
                message = "Checking crypto account eligibility."
            elif stage == "market-data":
                percent = 15
                message = "Loading positions, orders, and market data."
            elif stage == "signals":
                ratio = min(1.0, completed / total) if total else 1.0
                percent = 20 + int(round(60 * ratio))
                message = (
                    f"Evaluating {current_symbol}."
                    if current_symbol
                    else f"Evaluated {completed} of {total} configured assets."
                )
            else:
                percent = max(0, min(99, int(_number(latest.get("progress"), 0))))
                message = "Crypto cycle is running."
            run_id = str(latest.get("runId") or "").strip()
            if latest.get("status") != "running" or not run_id:
                run_digest = hashlib.sha256(
                    f"{uid}:{mode}:{source}:{bucket}".encode("utf-8")
                ).hexdigest()[:16]
                run_id = f"crypto-{run_digest}"
            latest.update({
                "status": "running",
                "enabled": bool(current_config.get("enabled")),
                "lastError": "",
                "lastHeartbeat": heartbeat,
                "heartbeat": heartbeat,
                "cycleStartedAt": started_at or heartbeat,
                "currentStage": str(stage),
                "progress": percent,
                "progressDetail": {
                    "stage": str(stage),
                    "completedSymbols": completed,
                    "totalSymbols": total,
                    "currentSymbol": current_symbol,
                },
                "runId": run_id,
                "message": message,
                "mode": mode,
            })
            self.save_runtime(
                uid,
                latest,
                f"crypto-runtime-progress:{uid}:{bucket}:{stage}:{completed_symbols}:{time.time_ns()}",
            )
            runtime.clear()
            runtime.update(latest)

    @staticmethod
    def _clean_position_state(value: Any) -> Dict[str, Optional[float]]:
        raw = dict(value or {}) if isinstance(value, Mapping) else {}
        last_add = _number(raw.get("last_add_price"), 0.0)
        protective_stop = _number(raw.get("protective_stop", raw.get("stop_price")), 0.0)
        return {
            "last_add_price": last_add if last_add > 0 else None,
            "protective_stop": protective_stop if protective_stop > 0 else None,
        }

    def _persist_reconciliation_state(
        self,
        uid: str,
        runtime: Dict[str, Any],
        *,
        position_states: Mapping[str, Mapping[str, Any]],
        pending: Mapping[str, Mapping[str, Any]],
        clear_reconciliation_lock: bool,
        key: str,
    ) -> None:
        with self._routing_lock(uid):
            latest = self.get_runtime(uid)
            latest["positionState"] = {
                _normalize_symbol(symbol): self._clean_position_state(state)
                for symbol, state in position_states.items()
                if _normalize_symbol(symbol)
            }
            latest["pendingReconciliations"] = {
                str(client_id): _jsonable(dict(record))
                for client_id, record in pending.items()
            }
            if clear_reconciliation_lock and latest.get("reconciliationRequired"):
                resumed_running = runtime.get("status") == "running"
                latest.update({
                    "reconciliationRequired": False,
                    "reconciliationMessage": "",
                    "locked": False,
                    "status": "running" if resumed_running else "idle",
                    "lastError": "",
                })
                if not resumed_running:
                    latest.update({
                        "currentStage": "idle",
                        "progress": 0,
                        "progressDetail": {
                            "stage": "idle", "completedSymbols": 0,
                            "totalSymbols": 0, "currentSymbol": None,
                        },
                        "message": "Broker order reconciliation completed.",
                    })
            self.save_runtime(uid, latest, key)
            runtime.update({
                "positionState": deepcopy(latest["positionState"]),
                "pendingReconciliations": deepcopy(latest["pendingReconciliations"]),
                "reconciliationRequired": bool(latest.get("reconciliationRequired")),
                "reconciliationMessage": str(latest.get("reconciliationMessage") or ""),
                "locked": bool(latest.get("locked")),
            })

    def _raise_reconciliation_required(
        self,
        uid: str,
        runtime: Mapping[str, Any],
        message: str,
        *,
        client_order_id: str = "",
    ) -> None:
        safe_message = str(message or "Broker fill reconciliation is required")[:500]
        now = _iso()
        with self._routing_lock(uid):
            latest = self.get_runtime(uid)
            progress_detail = dict(latest.get("progressDetail") or {})
            progress_detail.update({"stage": "reconciliation_required", "currentSymbol": None})
            latest.update({
                "status": "locked",
                "locked": True,
                "reconciliationRequired": True,
                "reconciliationMessage": safe_message,
                "lastError": safe_message,
                "lastHeartbeat": now,
                "heartbeat": now,
                "currentStage": "reconciliation_required",
                "message": safe_message,
                "nextRun": None,
                "cycleStartedAt": None,
                "progressDetail": progress_detail,
            })
            self.save_runtime(uid, latest, f"crypto-runtime-reconciliation-lock:{uid}:{time.time_ns()}")
        digest = hashlib.sha256(f"{client_order_id}:{safe_message}".encode("utf-8")).hexdigest()[:16]
        self._audit(
            uid,
            "crypto_reconciliation_required",
            {"clientOrderId": client_order_id or None, "reason": safe_message, "locked": True},
            f"crypto-reconciliation-required:{uid}:{digest}",
        )
        self._notify(uid, "risk_alert", {
            "assetType": "crypto",
            "assetClass": "crypto",
            "event": "Crypto fill reconciliation required",
            "clientOrderId": client_order_id or None,
            "error": safe_message,
        })
        raise CryptoApiError(safe_message, status=423, code="reconciliation_required")

    def _reconcile_pending_orders(
        self,
        uid: str,
        mode: str,
        runtime: Dict[str, Any],
        *,
        positions_by_symbol: Mapping[str, Mapping[str, Any]],
        open_orders: Sequence[Mapping[str, Any]],
        asset_by_symbol: Mapping[str, Mapping[str, Any]],
    ) -> Tuple[Dict[str, Dict[str, Optional[float]]], Dict[str, Dict[str, Any]]]:
        raw_pending = runtime.get("pendingReconciliations") or {}
        if not isinstance(raw_pending, Mapping):
            self._raise_reconciliation_required(uid, runtime, "Pending crypto reconciliation state is malformed")
        pending = {
            str(client_id): dict(record)
            for client_id, record in raw_pending.items()
            if str(client_id).strip() and isinstance(record, Mapping)
        }
        if len(pending) != len(raw_pending):
            self._raise_reconciliation_required(uid, runtime, "Pending crypto reconciliation metadata is incomplete")
        if len(pending) > MAX_PENDING_RECONCILIATIONS:
            self._raise_reconciliation_required(uid, runtime, "Pending crypto reconciliation limit was exceeded")
        position_states = {
            _normalize_symbol(symbol): self._clean_position_state(state)
            for symbol, state in dict(runtime.get("positionState") or {}).items()
            if _normalize_symbol(symbol)
        } if isinstance(runtime.get("positionState"), Mapping) else {}
        if not pending:
            if runtime.get("reconciliationRequired"):
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Reconciliation lock has no durable pending-order evidence",
                )
            return position_states, pending

        try:
            recent = list(self.recent_orders(uid, mode, limit=500))
        except Exception as exc:
            self._raise_reconciliation_required(
                uid,
                runtime,
                f"Broker order history is unavailable for reconciliation: {type(exc).__name__}",
            )
        by_client: Dict[str, Dict[str, Any]] = {}
        by_id: Dict[str, Dict[str, Any]] = {}
        for order in [*recent, *open_orders]:
            if not isinstance(order, Mapping):
                continue
            public = self._public_order(order)
            if public is None:
                continue
            client_id = str(public.get("clientOrderId") or "")
            order_id = str(public.get("id") or "")
            if client_id:
                by_client[client_id] = public
            if order_id:
                by_id[order_id] = public

        now = _utc_now()
        reconciled_events = []

        def submitted_time(item: Tuple[str, Dict[str, Any]]) -> datetime:
            value = _parse_utc_datetime(item[1].get("submittedAt"))
            if value is None:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order is missing its submission timestamp",
                    client_order_id=item[0],
                )
            return value

        for client_id, record in sorted(pending.items(), key=submitted_time):
            action = str(record.get("action") or "").strip().upper()
            symbol = _normalize_symbol(record.get("symbol"))
            if action not in {"BUY", "ADD", "REDUCE", "EXIT"} or symbol not in SUPPORTED_SYMBOLS:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order is missing trusted symbol/action metadata",
                    client_order_id=client_id,
                )
            stop_distance = _number(record.get("stopDistancePct"), 0.0)
            if action in {"BUY", "ADD"} and not 0 < stop_distance < 1:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto buy is missing its original protective-stop distance",
                    client_order_id=client_id,
                )
            raw_state_before = record.get("positionStateBefore")
            if raw_state_before is not None and not isinstance(raw_state_before, Mapping):
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order has malformed pre-submit position state",
                    client_order_id=client_id,
                )
            state_before = self._clean_position_state(raw_state_before)
            current_state = self._clean_position_state(position_states.get(symbol))
            if action == "ADD" and state_before.get("protective_stop") is None:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto add is missing its pre-submit protective stop",
                    client_order_id=client_id,
                )
            # A stale/corrupt runtime write may never loosen the protection
            # captured immediately before submission.
            prior_stop = state_before.get("protective_stop")
            current_stop = current_state.get("protective_stop")
            if prior_stop is not None and (current_stop is None or prior_stop > current_stop):
                current_state["protective_stop"] = prior_stop
            if current_state.get("last_add_price") is None:
                current_state["last_add_price"] = state_before.get("last_add_price")
            position_states[symbol] = current_state
            submitted_at = submitted_time((client_id, record))
            if submitted_at > now + timedelta(minutes=5):
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order has an invalid future submission timestamp",
                    client_order_id=client_id,
                )
            expired = now - submitted_at > PENDING_RECONCILIATION_MAX_AGE
            order = by_client.get(client_id) or by_id.get(str(record.get("orderId") or ""))
            if order is None:
                try:
                    broker = self._broker_config(uid, mode)
                    raw_order = self._existing_order(broker, client_id)
                    order = self._public_order(raw_order) if isinstance(raw_order, Mapping) else None
                except Exception as exc:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        f"Broker order lookup failed during reconciliation: {type(exc).__name__}",
                        client_order_id=client_id,
                    )
            if order is None:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order is absent from both open and recent broker history",
                    client_order_id=client_id,
                )
            status = str(order.get("status") or "").strip().lower()
            expected_side = "buy" if action in {"BUY", "ADD"} else "sell"
            if (
                _normalize_symbol(order.get("symbol")) != symbol
                or str(order.get("side") or "").lower() != expected_side
                or not status
                or status == "unknown"
            ):
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Broker order identity does not match durable reconciliation metadata",
                    client_order_id=client_id,
                )
            filled_qty = max(0.0, _number(order.get("filledQty")))
            filled_average = max(0.0, _number(order.get("filledAveragePrice")))
            applied_qty = max(0.0, _number(record.get("appliedFilledQty")))
            applied_notional = max(0.0, _number(record.get("appliedFilledNotional")))
            if filled_qty + 1e-12 < applied_qty:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Broker cumulative fill quantity regressed",
                    client_order_id=client_id,
                )
            if status == "filled" and filled_qty <= 0:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Broker marked an order filled without fill quantity",
                    client_order_id=client_id,
                )
            if filled_qty > applied_qty + 1e-12:
                if status not in FILL_CONFIRMING_ORDER_STATUSES:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Broker reported new cumulative fill quantity in a non-confirming order state",
                        client_order_id=client_id,
                    )
                if filled_average <= 0:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Confirmed broker fill is missing its average fill price",
                        client_order_id=client_id,
                    )
                position = dict(positions_by_symbol.get(symbol) or {})
                position_qty = max(0.0, _number(position.get("qty")))
                if action in {"BUY", "ADD"} and position_qty <= 0:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Broker fill is not yet reflected in the reconciled crypto position",
                        client_order_id=client_id,
                    )
                cumulative_notional = filled_qty * filled_average
                incremental_qty = filled_qty - applied_qty
                incremental_notional = cumulative_notional - applied_notional
                if incremental_notional <= 0:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Broker cumulative fill notional is inconsistent",
                        client_order_id=client_id,
                    )
                incremental_price = incremental_notional / incremental_qty
                asset = dict(asset_by_symbol.get(symbol) or {})
                qty_increment = max(1e-12, _number(
                    asset.get("minTradeIncrement", asset.get("min_trade_increment")),
                    0.000000001,
                ))
                remaining_position = action in {"BUY", "ADD"} or position_qty > qty_increment
                try:
                    position_states[symbol] = self._clean_position_state(apply_fill_to_position_state(
                        position_states.get(symbol),
                        action=action,
                        fill_price=incremental_price,
                        stop_distance_pct=stop_distance if action in {"BUY", "ADD"} else None,
                        remaining_position=remaining_position,
                    ))
                except Exception as exc:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        f"Confirmed fill could not update position protection: {type(exc).__name__}",
                        client_order_id=client_id,
                    )
                record["appliedFilledQty"] = filled_qty
                record["appliedFilledNotional"] = cumulative_notional
                reconciled_events.append((client_id, symbol, action, filled_qty, filled_average))
            record.update({
                "orderId": order.get("id") or record.get("orderId"),
                "lastSeenStatus": status,
                "lastSeenFilledQty": filled_qty,
                "lastSeenFilledAveragePrice": filled_average or None,
                "lastCheckedAt": now.isoformat(),
            })
            if status in TERMINAL_ORDER_STATUSES:
                pending.pop(client_id, None)
            elif expired:
                self._raise_reconciliation_required(
                    uid,
                    runtime,
                    "Pending crypto order exceeded the reconciliation age limit",
                    client_order_id=client_id,
                )

        self._persist_reconciliation_state(
            uid,
            runtime,
            position_states=position_states,
            pending=pending,
            clear_reconciliation_lock=True,
            key=f"crypto-runtime-reconciled:{uid}:{time.time_ns()}",
        )
        for client_id, symbol, action, filled_qty, filled_average in reconciled_events:
            fill_key = _decimal_string(_decimal(filled_qty))
            self._audit(
                uid,
                "crypto_order_fill_reconciled",
                {
                    "clientOrderId": client_id,
                    "symbol": symbol,
                    "action": action,
                    "cumulativeFilledQty": filled_qty,
                    "filledAveragePrice": filled_average,
                },
                f"crypto-fill-reconciled:{uid}:{client_id}:{fill_key}",
            )
        return position_states, pending

    def calibrate_paper_strategy(
        self,
        uid: str,
        *,
        apply: bool = True,
        source: str = "manual",
    ) -> Dict[str, Any]:
        """Compare a bounded trend family on two cost-aware holdouts.

        Promotion is Paper-only. Live always requires the separately saved,
        explicitly authorized mandate.
        """
        config, version = self.get_config_snapshot(uid)
        if config.get("mode") != "paper":
            raise CryptoApiError(
                "Adaptive calibration is available only in Paper mode",
                status=409,
                code="paper_calibration_only",
            )
        if config.get("tradeHorizon") == "short":
            raise CryptoApiError(
                "Long-horizon calibration is available only for the long-term crypto strategy",
                status=409,
                code="long_horizon_calibration_only",
            )
        runtime = self.get_runtime(uid)
        symbol = config["symbols"][int(runtime.get("cycleCount") or 0) % len(config["symbols"])]
        current = dict(config["strategy"])
        candidate_specs = [deepcopy(item) for item in STRATEGY_RESEARCH_LIBRARY]
        candidates = []
        candidate_configs: Dict[str, Dict[str, Any]] = {}
        maximum_warmup = 0
        candidate_warmups: Dict[str, int] = {}
        for spec in candidate_specs:
            name = str(spec["id"])
            patch = dict(spec.get("patch") or {})
            candidate = validate_engine_config({**current, **patch, "symbols": [symbol]})
            candidate_configs[name] = candidate
            candidate_warmups[name] = required_history_bars(candidate)
            maximum_warmup = max(maximum_warmup, candidate_warmups[name])
        evaluation_bars = 60 * 24
        window_count = 3
        required = maximum_warmup + evaluation_bars * window_count + 4
        rows = list(self.bars(uid, "paper", symbol, timeframe="1Hour", limit=min(10_000, required)))
        rows, data_quality = _repair_isolated_hourly_backtest_gaps(rows)
        if len(rows) < required - 2:
            raise CryptoApiError(
                "Not enough continuous hourly history for three-window calibration",
                status=409,
                code="insufficient_calibration_history",
            )
        evaluation_start = len(rows) - evaluation_bars * window_count
        for spec in candidate_specs:
            name = str(spec["id"])
            window_results = []
            warmup = candidate_warmups[name]
            for window_index in range(window_count):
                start = evaluation_start + window_index * evaluation_bars
                end = start + evaluation_bars
                window = rows[max(0, start - warmup):end]
                tested = run_engine_backtest(
                    window, candidate_configs[name], symbol=symbol, initial_capital=10_000.0,
                )
                metrics = dict(tested.get("metrics") or {})
                window_results.append({
                    "return": _number(metrics.get("total_return")),
                    "sharpe": _number(metrics.get("sharpe")),
                    "sortino": _number(metrics.get("sortino")),
                    "calmar": _number(metrics.get("calmar")),
                    "drawdown": abs(_number(metrics.get("max_drawdown"))),
                    "trades": int(_number(metrics.get("trades"))),
                    "turnover": _number(metrics.get("turnover")),
                    "fees": _number(metrics.get("fees")),
                })
            robust_score = min(
                item["sharpe"]
                + 0.20 * item["sortino"]
                + 0.25 * item["calmar"]
                - 2.0 * item["drawdown"]
                - 0.02 * item["turnover"]
                for item in window_results
            )
            positive_windows = sum(1 for item in window_results if item["return"] > 0)
            gates_passed = bool(
                positive_windows == window_count
                and all(item["trades"] >= 1 for item in window_results)
                and all(item["drawdown"] <= 0.12 for item in window_results)
            )
            candidates.append({
                "name": name, "label": str(spec.get("name") or name),
                "robustScore": round(robust_score, 6),
                "gatesPassed": gates_passed,
                "positiveWindows": positive_windows,
                "source": deepcopy(spec.get("source") or {}),
                "windows": window_results,
            })
        baseline = next(item for item in candidates if item["name"] == "current")
        eligible = [item for item in candidates if item["gatesPassed"]]
        winner = max(eligible, key=lambda item: item["robustScore"], default=baseline)
        promoted = bool(
            apply
            and winner["name"] != "current"
            and winner["robustScore"] >= baseline["robustScore"] + 0.15
        )
        if promoted:
            with self._routing_lock(uid):
                latest, latest_version = self.get_config_snapshot(uid)
                if latest_version != version or latest.get("mode") != "paper":
                    promoted = False
                else:
                    updated = deepcopy(latest)
                    updated["strategy"] = candidate_configs[winner["name"]]
                    updated["updatedAt"] = _iso()
                    self.save_config(
                        uid,
                        _validate_config(updated, base=_default_config()),
                        f"crypto-paper-calibration-config:{uid}:{time.time_ns()}",
                    )
        previous_calibration = dict(runtime.get("calibration") or {})
        previous_history = list(previous_calibration.get("history") or [])
        completed_runs = int(_number(previous_calibration.get("completedRuns"), 0)) + 1
        report_summary = {
            "run": completed_runs,
            "at": _iso(),
            "symbol": symbol,
            "champion": winner["name"],
            "applied": promoted,
            "robustScore": winner["robustScore"],
        }
        calibration = {
            "status": "completed", "lastRun": _iso(), "symbol": symbol,
            "champion": winner["name"], "applied": promoted,
            "mode": "paper", "source": source,
            "method": "three_60_day_walk_forward_windows_cost_aware",
            "windowDays": 60, "windowCount": window_count,
            "completedRuns": completed_runs,
            "history": (previous_history + [report_summary])[-12:],
            "dataQuality": data_quality, "candidates": candidates,
            "researchLibraryVersion": "2026-07-20",
            "guardrail": "Paper-only; published ideas are reimplemented as bounded challengers and never copied into Live automatically.",
        }
        runtime = self.get_runtime(uid)
        runtime["calibration"] = calibration
        self.save_runtime(uid, runtime, f"crypto-paper-calibration-runtime:{uid}:{time.time_ns()}")
        self._audit(
            uid, "crypto_paper_calibration_completed", calibration,
            f"crypto-paper-calibration-audit:{uid}:{time.time_ns()}",
            actor="user" if source == "manual" else "system",
        )
        return {
            "success": True, "calibration": calibration,
            "config": self.get_config(uid), "version": version,
        }

    def run_cycle(
        self,
        uid: str,
        *,
        source: str = "manual",
        dry_run: bool = False,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        lock = self._user_lock(uid)
        if not lock.acquire(blocking=False):
            raise CryptoApiError("A crypto cycle is already running", status=409, code="cycle_in_progress")
        started = time.monotonic()
        config = _default_config()
        runtime = _runtime_default()
        try:
            config, config_version = self.get_config_snapshot(uid)
            runtime = self.get_runtime(uid)
            if config.get("killSwitch"):
                raise CryptoApiError("Crypto kill switch is active", status=409, code="kill_switch_active")
            if runtime.get("locked") and not runtime.get("reconciliationRequired"):
                raise CryptoApiError("Automation is locked after repeated errors", status=423, code="automation_locked")
            if source == "scheduler" and not config.get("enabled"):
                raise CryptoApiError("Crypto automation is disabled", status=409, code="automation_disabled")
            mode = config["mode"]
            if mode == "live" and not config.get("liveAuthorized"):
                raise CryptoApiError(
                    "Live crypto automation is not explicitly authorized", status=403, code="live_not_authorized",
                )
            if mode == "live":
                _require_live_release_admitted()
            interval = int(config["intervalMinutes"])
            bucket = int(time.time() // (interval * 60))
            if (
                not dry_run
                and runtime.get("lastRunBucket") == bucket
                and not runtime.get("pendingReconciliations")
                and not runtime.get("reconciliationRequired")
            ):
                return {"success": True, "idempotent": True, "runtime": runtime, "decisions": runtime.get("lastDecisions") or []}
            cycle_key = str(
                idempotency_key
                or (f"{bucket}:{time.time_ns()}" if dry_run else bucket)
            )[:200]

            if not dry_run:
                self._save_cycle_progress(
                    uid,
                    runtime,
                    config_version=config_version,
                    mode=mode,
                    source=source,
                    bucket=bucket,
                    stage="account",
                    completed_symbols=0,
                    total_symbols=len(config["symbols"]),
                )
            account, gate = self.account(uid, mode)
            if not gate["eligible"]:
                raise CryptoApiError(
                    "Alpaca crypto account is not eligible: %s" % ", ".join(gate["reasons"]),
                    status=409, code="crypto_account_ineligible",
                )
            positions = list(self.positions(uid, mode))
            positions_by_symbol = {row["symbol"]: row for row in positions}
            open_orders = list(self.open_orders(uid, mode))
            asset_by_symbol = {
                str(row.get("symbol")): dict(row)
                for row in self.assets(uid, mode)
                if isinstance(row, Mapping) and row.get("symbol")
            }
            reconciled_position_states, pending_reconciliations = self._reconcile_pending_orders(
                uid,
                mode,
                runtime,
                positions_by_symbol=positions_by_symbol,
                open_orders=open_orders,
                asset_by_symbol=asset_by_symbol,
            )
            configured_symbols = list(config["symbols"])
            exit_only_symbols = set()
            for position in positions:
                if not isinstance(position, Mapping):
                    continue
                symbol = _normalize_symbol(position.get("symbol"))
                qty = _number(position.get("qty"))
                if symbol not in SUPPORTED_SYMBOLS or symbol in configured_symbols:
                    continue
                if qty < 0 or str(position.get("side") or "long").strip().lower() == "short":
                    raise CryptoApiError(
                        f"Unsupported short crypto position detected for {symbol}",
                        status=409,
                        code="short_position_blocked",
                    )
                if qty <= 1e-12:
                    continue
                if (
                    _number(position.get("marketValue")) <= 0
                    or _number(position.get("currentPrice")) <= 0
                ):
                    raise CryptoApiError(
                        f"Cannot safely manage the out-of-universe {symbol} position without a reliable valuation",
                        status=409,
                        code="position_valuation_unavailable",
                    )
                asset = asset_by_symbol.get(symbol) or {}
                if not asset.get("strategySupported") or not asset.get("tradable"):
                    raise CryptoApiError(
                        f"Cannot safely manage the out-of-universe {symbol} position while broker tradability is unavailable",
                        status=409,
                        code="exit_only_asset_unavailable",
                    )
                exit_only_symbols.add(symbol)
            cycle_symbols = configured_symbols + sorted(exit_only_symbols)
            equity = max(0.0, _number(account.get("equity"), _number(account.get("portfolio_value"))))
            if equity <= 0:
                raise CryptoApiError("Account equity is unavailable", status=409, code="account_equity_unavailable")
            remaining_buying_power = max(
                0.0,
                _number(account.get("non_marginable_buying_power"), _number(account.get("cash"))),
            )

            if not dry_run:
                self._save_cycle_progress(
                    uid,
                    runtime,
                    config_version=config_version,
                    mode=mode,
                    source=source,
                    bucket=bucket,
                    stage="market-data",
                    completed_symbols=0,
                    total_symbols=len(cycle_symbols),
                )
            cycle_now = _utc_now()
            risk_curve = [
                row for row in list(runtime.get("equityCurve") or [])
                if isinstance(row, Mapping)
            ][-719:]
            # The just-read broker equity must participate in this cycle's
            # circuit decision, rather than taking effect one cycle late.
            risk_curve.append({"time": cycle_now.isoformat(), "value": equity})
            signals = []
            risk_state = self._equity_risk({**runtime, "equityCurve": risk_curve})
            persisted_position_states = reconciled_position_states
            next_position_states: Dict[str, Dict[str, Optional[float]]] = {
                _normalize_symbol(symbol): self._clean_position_state(state)
                for symbol, state in persisted_position_states.items()
                if _normalize_symbol(symbol)
            }
            for symbol_index, symbol in enumerate(cycle_symbols):
                if not dry_run:
                    self._save_cycle_progress(
                        uid,
                        runtime,
                        config_version=config_version,
                        mode=mode,
                        source=source,
                        bucket=bucket,
                        stage="signals",
                        completed_symbols=symbol_index,
                        total_symbols=len(cycle_symbols),
                        current_symbol=symbol,
                    )
                strategy_timeframe = _strategy_timeframe(config["strategy"])
                rows = self.bars(
                    uid, mode, symbol,
                    timeframe=strategy_timeframe,
                    limit=required_history_bars(config["strategy"]) + 4,
                )
                current = positions_by_symbol.get(symbol) or {}
                current_value = _number(current.get("marketValue"))
                current_qty = max(0.0, _number(current.get("qty")))
                stored_position_state = self._clean_position_state(persisted_position_states.get(symbol))
                position = {
                    "weight": current_value / equity if equity else 0.0,
                    "average_entry_price": current.get("averageEntryPrice"),
                    "last_add_price": stored_position_state.get("last_add_price"),
                    "protective_stop": stored_position_state.get("protective_stop"),
                }
                signal = generate_signal(rows, config["strategy"], position=position, risk_state=risk_state, now=_utc_now())
                signal = _jsonable(signal)
                exit_only = symbol in exit_only_symbols
                if exit_only:
                    # A supported broker position that predates the current
                    # configured universe remains managed, but may never grow.
                    # Normal hard exits and reductions still apply.
                    raw_target = max(0.0, _number(signal.get("target_weight")))
                    signal["target_weight"] = min(position["weight"], raw_target)
                    signal["allowed_actions"] = ["HOLD", "REDUCE", "EXIT"]
                    signal["exit_only"] = True
                    reasons = list(signal.get("reasons") or [])
                    reasons.append(
                        "Position is outside the configured universe and is managed exit-only."
                    )
                    signal["reasons"] = reasons
                returned_position_state = signal.get("position_state")
                if isinstance(returned_position_state, Mapping):
                    next_position_states[symbol] = self._clean_position_state(returned_position_state)
                elif current_qty > 0:
                    next_position_states[symbol] = stored_position_state
                else:
                    next_position_states[symbol] = self._clean_position_state({})
                signal.update({
                    "symbol": symbol,
                    "confidence": signal.get("score", 0),
                    "targetWeight": signal.get("target_weight", 0),
                    "reviewer": "deterministic",
                    "exitOnly": exit_only,
                })
                signals.append(signal)
                if not dry_run:
                    self._save_cycle_progress(
                        uid,
                        runtime,
                        config_version=config_version,
                        mode=mode,
                        source=source,
                        bucket=bucket,
                        stage="signals",
                        completed_symbols=symbol_index + 1,
                        total_symbols=len(cycle_symbols),
                        current_symbol=None,
                    )

            cooldown_until = _parse_utc_datetime(runtime.get("cooldownUntil"))
            if cooldown_until is not None and cooldown_until <= cycle_now:
                cooldown_until = None
            manual_review_required = bool(runtime.get("manualReviewRequired"))
            for signal in signals:
                signal_risk = dict(signal.get("risk") or {})
                if signal_risk.get("cooldown_required") and cooldown_until is None:
                    cooldown_hours = max(0.0, _number(signal_risk.get("cooldown_hours"), 72.0))
                    cooldown_until = cycle_now + timedelta(hours=cooldown_hours)
                if signal_risk.get("manual_review_required"):
                    manual_review_required = True
            runtime["cooldownUntil"] = cooldown_until.isoformat() if cooldown_until else None
            runtime["manualReviewRequired"] = manual_review_required
            persistent_entry_blocks = []
            if cooldown_until is not None and cooldown_until > cycle_now:
                persistent_entry_blocks.append("risk_cooldown_active")
            if manual_review_required:
                persistent_entry_blocks.append("manual_risk_review_required")

            signal_price_by_symbol = {
                str(row.get("symbol")): max(0.0, _number(row.get("price")))
                for row in signals
            }
            # Reserve every supported crypto order, not only symbols in the
            # current strategy. A user can narrow the strategy while an older
            # GTC order is still open; that order must continue consuming the
            # same portfolio exposure budget until the broker closes it.
            reservation_symbols = (
                set(SUPPORTED_SYMBOLS)
                | set(config["symbols"])
                | {
                    _normalize_symbol(order.get("symbol"))
                    for order in open_orders
                    if _normalize_symbol(order.get("symbol"))
                }
            )
            reservations = {
                symbol: self._open_order_reservation(
                    open_orders,
                    symbol,
                    signal_price_by_symbol.get(symbol)
                    or _number((positions_by_symbol.get(symbol) or {}).get("currentPrice")),
                )
                for symbol in reservation_symbols
            }
            filled_crypto_value = sum(max(0.0, _number(row.get("marketValue"))) for row in positions)
            pending_buy_value = sum(_number(row.get("buyNotional")) for row in reservations.values())
            pending_sell_value = sum(_number(row.get("sellNotional")) for row in reservations.values())
            unpriced_pending_buys = sum(int(row.get("unpricedBuyCount") or 0) for row in reservations.values())
            # Pending sells may be canceled or rejected, so they never create
            # headroom. Pending buys across every crypto asset always consume it.
            projected_crypto_value = max(0.0, filled_crypto_value + pending_buy_value)
            exposure_headroom = max(
                0.0,
                equity * _number(config["maxTotalExposure"]) - projected_crypto_value,
            )
            if unpriced_pending_buys:
                exposure_headroom = 0.0
            remaining_buying_power = min(remaining_buying_power, exposure_headroom)

            def submit_tracked_order(
                symbol: str,
                action: str,
                payload: Mapping[str, Any],
                *,
                stop_distance_pct: Optional[float],
                position_state_before: Mapping[str, Any],
            ) -> Dict[str, Any]:
                """Durably capture reconciliation evidence before broker submission."""

                client_id = str(payload.get("client_order_id") or "").strip()
                if not client_id:
                    raise CryptoApiError(
                        "Crypto order is missing its deterministic client order ID",
                        code="invalid_order_contract",
                    )
                if client_id not in pending_reconciliations and len(pending_reconciliations) >= MAX_PENDING_RECONCILIATIONS:
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Pending crypto reconciliation limit was reached before order submission",
                        client_order_id=client_id,
                    )
                submitted_at = _iso()
                pending_reconciliations[client_id] = {
                    "clientOrderId": client_id,
                    "orderId": None,
                    "symbol": symbol,
                    "action": action,
                    "stopDistancePct": stop_distance_pct,
                    "submittedAt": submitted_at,
                    "positionStateBefore": self._clean_position_state(position_state_before),
                    "appliedFilledQty": 0.0,
                    "appliedFilledNotional": 0.0,
                    "lastSeenStatus": "submission_pending",
                    "lastSeenFilledQty": 0.0,
                    "lastSeenFilledAveragePrice": None,
                    "lastCheckedAt": submitted_at,
                }
                self._persist_reconciliation_state(
                    uid,
                    runtime,
                    position_states=next_position_states,
                    pending=pending_reconciliations,
                    clear_reconciliation_lock=False,
                    key=f"crypto-runtime-order-intent:{uid}:{client_id}",
                )
                try:
                    result = self._submit_order_guarded(
                        uid,
                        mode,
                        payload,
                        expected_config_version=config_version,
                        source=source,
                    )
                except BrokerError as exc:
                    # The client ID and intent are durable, but a transport or
                    # broker error can occur after remote acceptance. Lock
                    # until the next cycle proves the outcome from broker
                    # history instead of treating the request as rejected.
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        f"Broker order submission outcome is ambiguous: {type(exc).__name__}",
                        client_order_id=client_id,
                    )
                except CryptoApiError as exc:
                    # A local policy denial guarantees that no broker request
                    # was made. Broker/network errors remain pending because
                    # the remote outcome can be ambiguous.
                    pending_reconciliations.pop(client_id, None)
                    self._persist_reconciliation_state(
                        uid,
                        runtime,
                        position_states=next_position_states,
                        pending=pending_reconciliations,
                        clear_reconciliation_lock=False,
                        key=f"crypto-runtime-order-intent-cancelled:{uid}:{client_id}:{time.time_ns()}",
                    )
                    raise
                if not isinstance(result, Mapping):
                    self._raise_reconciliation_required(
                        uid,
                        runtime,
                        "Broker returned an invalid crypto order after submission",
                        client_order_id=client_id,
                    )
                return dict(result)

            target_total = sum(max(0.0, _number(row.get("targetWeight"))) for row in signals)
            scale = min(1.0, _number(config["maxTotalExposure"]) / target_total) if target_total > 0 else 1.0
            decisions = []
            for signal in signals:
                symbol = signal["symbol"]
                current = positions_by_symbol.get(symbol) or {}
                current_value = _number(current.get("marketValue"))
                reservation = dict(reservations.get(symbol) or {})
                projected_value = max(
                    0.0,
                    current_value + _number(reservation.get("buyNotional")),
                )
                current_weight = projected_value / equity if equity else 0.0
                symbol_cap = _number((config.get("assetAllocationsPct") or {}).get(symbol), config["maxAssetExposurePct"]) / 100.0
                target_weight = min(symbol_cap, max(0.0, _number(signal.get("targetWeight")) * scale))
                exit_only = bool(signal.get("exitOnly"))
                if exit_only:
                    target_weight = min(current_weight, target_weight)
                allowed_actions = set(signal.get("allowed_actions") or [])
                if target_weight <= 1e-6:
                    action = "EXIT" if current_weight > 1e-6 else "HOLD"
                elif target_weight < current_weight - 0.01:
                    action = "REDUCE"
                elif target_weight > current_weight + 0.01:
                    desired = "BUY" if current_weight <= 1e-6 else "ADD"
                    if desired == "ADD" and (not config.get("allowAdds") or "ADD" not in allowed_actions):
                        action = "HOLD"
                        target_weight = current_weight
                    elif desired not in allowed_actions:
                        action = "HOLD"
                        target_weight = current_weight
                    else:
                        action = desired
                else:
                    action = "HOLD"
                if signal.get("risk", {}).get("data_stale") and action in {"BUY", "ADD"}:
                    action = "HOLD"
                    target_weight = current_weight
                if persistent_entry_blocks and action in {"BUY", "ADD"}:
                    action = "HOLD"
                    target_weight = current_weight
                decision = {
                    **signal,
                    "mode": mode,
                    "action": action,
                    "targetWeight": round(target_weight, 6),
                    "reason": "; ".join(signal.get("reasons") or [])[:1000],
                    "cycleBucket": bucket,
                    "source": source,
                    "currentWeight": round(current_weight, 6),
                    "filledWeight": round(current_value / equity, 6) if equity else 0.0,
                    "openOrderReservation": _jsonable(reservation),
                    "persistentRiskGate": {
                        "eligible": not persistent_entry_blocks,
                        "reasons": list(persistent_entry_blocks),
                        "cooldownUntil": runtime.get("cooldownUntil"),
                        "manualReviewRequired": manual_review_required,
                    },
                    "portfolioExposure": {
                        "filledCryptoValue": round(filled_crypto_value, 2),
                        "pendingBuyValue": round(pending_buy_value, 2),
                        "pendingSellValueIgnoredForHeadroom": round(pending_sell_value, 2),
                        "projectedCryptoValue": round(projected_crypto_value, 2),
                        "unpricedPendingBuys": unpriced_pending_buys,
                    },
                }
                if persistent_entry_blocks:
                    prior_reason = str(decision.get("reason") or "").strip()
                    risk_reason = "Persistent risk control blocks new crypto exposure: %s." % ", ".join(
                        persistent_entry_blocks
                    )
                    decision["reason"] = "; ".join(filter(None, (prior_reason, risk_reason)))[:1000]
                if config.get("aiReviewEnabled", True):
                    decision = self._restricted_ai_review(uid, decision)
                    action = str(decision.get("action") or "HOLD")
                    target_weight = max(0.0, _number(decision.get("targetWeight"), target_weight))
                if exit_only:
                    target_weight = min(current_weight, target_weight)
                    if action in {"BUY", "ADD"}:
                        action = "HOLD"
                    decision["action"] = action
                    decision["targetWeight"] = round(target_weight, 6)
                if int(reservation.get("count") or 0) > 0 and action != "HOLD":
                    action = "HOLD"
                    target_weight = current_weight
                    decision["action"] = "HOLD"
                    decision["targetWeight"] = round(target_weight, 6)
                    reservation_reason = "Existing open crypto order reserves this asset; no duplicate order was routed."
                    prior_reason = str(decision.get("reason") or "").strip()
                    decision["reason"] = "; ".join(filter(None, (prior_reason, reservation_reason)))[:1000]
                order_result = None
                submitted_client_id = ""
                submitted_stop_distance: Optional[float] = None
                submitted_state_before = self._clean_position_state(next_position_states.get(symbol))
                if action != "HOLD":
                    price = max(0.0, _number(signal.get("price"), _number(current.get("currentPrice"))))
                    target_value = equity * target_weight
                    delta = target_value - projected_value
                    if action in {"BUY", "ADD"}:
                        stop_distance = _number(signal.get("stop_distance_pct"), 0.0)
                        missing_add_stop = (
                            action == "ADD" and submitted_state_before.get("protective_stop") is None
                        )
                        if not 0 < stop_distance < 1 or missing_add_stop:
                            action = "HOLD"
                            target_weight = current_weight
                            decision["action"] = "HOLD"
                            decision["targetWeight"] = round(target_weight, 6)
                            metadata_reason = (
                                "The add was blocked because its durable pre-submit protective stop is unavailable."
                                if missing_add_stop
                                else "The entry was blocked because its original protective-stop distance is unavailable."
                            )
                            decision["reason"] = "; ".join(filter(None, (
                                str(decision.get("reason") or "").strip(), metadata_reason,
                            )))[:1000]
                            decision["protectiveStopMetadata"] = {
                                "eligible": False,
                                "reason": "protective_stop_metadata_missing",
                            }
                            continue_entry = False
                        else:
                            continue_entry = True
                            submitted_stop_distance = stop_distance
                        if not continue_entry:
                            notional = 0.0
                        else:
                            risk_budget = equity * (_number(config.get("riskPerTradePct"), 0.35) / 100.0)
                            risk_sized_notional = risk_budget / stop_distance
                            notional = min(
                                max(0.0, delta), risk_sized_notional,
                                _number(config["maxOrderNotional"]), 200_000.0,
                                remaining_buying_power,
                            )
                        if continue_entry and notional >= _number(config["minOrderNotional"]):
                            try:
                                execution_snapshot = dict(
                                    self.snapshots(
                                        uid,
                                        mode,
                                        [symbol],
                                        force_refresh=True,
                                    ).get(symbol) or {}
                                )
                                entry_gate = _entry_market_gate(
                                    execution_snapshot,
                                    notional=notional,
                                    minimum_notional=_number(config["minOrderNotional"]),
                                    now=_utc_now(),
                                )
                            except Exception as snapshot_exc:
                                entry_gate = {
                                    "eligible": False,
                                    "reasons": ["quote_unavailable"],
                                    "error": type(snapshot_exc).__name__,
                                }
                                execution_snapshot = {}
                            decision["entryGate"] = _jsonable(entry_gate)
                            if not entry_gate.get("eligible"):
                                action = "HOLD"
                                target_weight = current_weight
                                decision["action"] = "HOLD"
                                decision["targetWeight"] = round(target_weight, 6)
                                gate_reason = "Fresh quote, spread, or liquidity gate blocked new exposure: %s." % ", ".join(
                                    entry_gate.get("reasons") or ["market_gate_failed"]
                                )
                                decision["reason"] = "; ".join(filter(None, (
                                    str(decision.get("reason") or "").strip(), gate_reason,
                                )))[:1000]
                            elif not dry_run:
                                execution_price = max(
                                    0.0,
                                    _number(execution_snapshot.get("ask"), price),
                                ) or price
                                client_id = self._order_id(uid, symbol, action, bucket)
                                order_payload = self._build_order(
                                    config, symbol=symbol, action=action, price=execution_price,
                                    notional=notional, client_order_id=client_id,
                                    asset=asset_by_symbol.get(symbol),
                                )
                                submitted_client_id = client_id
                                order_result = submit_tracked_order(
                                    symbol,
                                    action,
                                    order_payload,
                                    stop_distance_pct=submitted_stop_distance,
                                    position_state_before=submitted_state_before,
                                )
                                remaining_buying_power = max(0.0, remaining_buying_power - notional)
                        elif continue_entry:
                            action = "HOLD"
                            target_weight = current_weight
                            decision["action"] = "HOLD"
                            decision["targetWeight"] = round(target_weight, 6)
                            decision["entryCapacity"] = {
                                "eligible": False,
                                "reason": "insufficient_exposure_or_buying_power",
                                "availableNotional": round(max(0.0, notional), 2),
                                "minimumNotional": _number(config["minOrderNotional"]),
                            }
                            capacity_reason = "Available crypto exposure or buying power is below the minimum order size."
                            decision["reason"] = "; ".join(filter(None, (
                                str(decision.get("reason") or "").strip(), capacity_reason,
                            )))[:1000]
                    elif not dry_run:
                        available_qty = max(
                            0.0,
                            _number(current.get("qty")) - _number(reservation.get("sellQty")),
                        )
                        sell_value = min(current_value, max(0.0, -delta)) if action == "REDUCE" else current_value
                        sell_qty = min(available_qty, sell_value / price if price > 0 else 0.0)
                        if sell_qty > 0 and sell_qty * price >= _number(config["minOrderNotional"]):
                            client_id = self._order_id(uid, symbol, action, bucket)
                            order_payload = self._build_order(
                                config, symbol=symbol, action=action, price=price,
                                qty=sell_qty, client_order_id=client_id,
                                asset=asset_by_symbol.get(symbol),
                            )
                            submitted_client_id = client_id
                            order_result = submit_tracked_order(
                                symbol,
                                action,
                                order_payload,
                                stop_distance_pct=None,
                                position_state_before=submitted_state_before,
                            )
                decision["order"] = _jsonable(order_result) if order_result else None
                position_state = self._clean_position_state(next_position_states.get(symbol))
                if isinstance(order_result, Mapping):
                    order_status = str(order_result.get("status") or "").strip().lower()
                    filled_qty = max(0.0, _number(order_result.get("filled_qty", order_result.get("filledQty"))))
                    fill_price = max(0.0, _number(
                        order_result.get("filled_avg_price", order_result.get("filledAveragePrice")),
                    ))
                    pending_record = pending_reconciliations.get(submitted_client_id)
                    response_client_id = str(
                        order_result.get("client_order_id", order_result.get("clientOrderId")) or ""
                    ).strip()
                    response_symbol_raw = order_result.get("symbol")
                    response_side = str(order_result.get("side") or "").strip().lower()
                    identity_mismatch = (
                        not submitted_client_id
                        or not isinstance(pending_record, Mapping)
                        or (response_client_id and response_client_id != submitted_client_id)
                        or (response_symbol_raw is not None and _normalize_symbol(response_symbol_raw) != symbol)
                        or (
                            response_side
                            and response_side != ("buy" if action in {"BUY", "ADD"} else "sell")
                        )
                    )
                    if identity_mismatch:
                        self._raise_reconciliation_required(
                            uid,
                            runtime,
                            "Broker order response does not match the durable submission metadata",
                            client_order_id=submitted_client_id,
                        )
                    pending_record = dict(pending_record)
                    pending_record.update({
                        "orderId": order_result.get("id") or pending_record.get("orderId"),
                        "lastSeenStatus": order_status or "unknown",
                        "lastSeenFilledQty": filled_qty,
                        "lastSeenFilledAveragePrice": fill_price or None,
                        "lastCheckedAt": _iso(),
                    })
                    pending_reconciliations[submitted_client_id] = pending_record
                    if not order_status or order_status == "unknown":
                        self._persist_reconciliation_state(
                            uid,
                            runtime,
                            position_states=next_position_states,
                            pending=pending_reconciliations,
                            clear_reconciliation_lock=False,
                            key=f"crypto-runtime-order-ambiguous:{uid}:{submitted_client_id}:{time.time_ns()}",
                        )
                        self._raise_reconciliation_required(
                            uid,
                            runtime,
                            "Broker order response is missing a reliable status",
                            client_order_id=submitted_client_id,
                        )
                    fill_confirming_status = order_status in FILL_CONFIRMING_ORDER_STATUSES
                    if order_status == "filled" and filled_qty <= 0:
                        self._persist_reconciliation_state(
                            uid,
                            runtime,
                            position_states=next_position_states,
                            pending=pending_reconciliations,
                            clear_reconciliation_lock=False,
                            key=f"crypto-runtime-order-ambiguous:{uid}:{submitted_client_id}:{time.time_ns()}",
                        )
                        self._raise_reconciliation_required(
                            uid,
                            runtime,
                            "Broker marked the submitted order filled without a fill quantity",
                            client_order_id=submitted_client_id,
                        )
                    if filled_qty > 0 and not fill_confirming_status:
                        self._persist_reconciliation_state(
                            uid,
                            runtime,
                            position_states=next_position_states,
                            pending=pending_reconciliations,
                            clear_reconciliation_lock=False,
                            key=f"crypto-runtime-order-ambiguous:{uid}:{submitted_client_id}:{time.time_ns()}",
                        )
                        self._raise_reconciliation_required(
                            uid,
                            runtime,
                            "Broker reported fill quantity in a non-confirming order state",
                            client_order_id=submitted_client_id,
                        )
                    if fill_confirming_status and filled_qty > 0:
                        if fill_price <= 0:
                            self._persist_reconciliation_state(
                                uid,
                                runtime,
                                position_states=next_position_states,
                                pending=pending_reconciliations,
                                clear_reconciliation_lock=False,
                                key=f"crypto-runtime-order-ambiguous:{uid}:{submitted_client_id}:{time.time_ns()}",
                            )
                            self._raise_reconciliation_required(
                                uid,
                                runtime,
                                "Confirmed broker fill is missing its average fill price",
                                client_order_id=submitted_client_id,
                            )
                        asset = dict(asset_by_symbol.get(symbol) or {})
                        qty_increment = _number(
                            asset.get("minTradeIncrement", asset.get("min_trade_increment")),
                            0.000000001,
                        )
                        remaining_position = action in {"BUY", "ADD"} or (
                            max(0.0, _number(current.get("qty")) - filled_qty) > qty_increment
                        )
                        position_state = self._clean_position_state(apply_fill_to_position_state(
                            position_state,
                            action=action,
                            fill_price=fill_price,
                            stop_distance_pct=submitted_stop_distance if action in {"BUY", "ADD"} else None,
                            remaining_position=remaining_position,
                        ))
                        next_position_states[symbol] = position_state
                        pending_record["appliedFilledQty"] = filled_qty
                        pending_record["appliedFilledNotional"] = filled_qty * fill_price
                        pending_reconciliations[submitted_client_id] = pending_record
                    if order_status in TERMINAL_ORDER_STATUSES:
                        pending_reconciliations.pop(submitted_client_id, None)
                    self._persist_reconciliation_state(
                        uid,
                        runtime,
                        position_states=next_position_states,
                        pending=pending_reconciliations,
                        clear_reconciliation_lock=False,
                        key=f"crypto-runtime-order-observed:{uid}:{submitted_client_id}:{time.time_ns()}",
                    )
                decision["positionState"] = position_state
                decision["dryRun"] = bool(dry_run)
                if dry_run:
                    self._audit(
                        uid,
                        "crypto_dry_run_decision",
                        decision,
                        f"crypto-dry-run-decision:{uid}:{_safe_symbol_key(symbol)}:{cycle_key}",
                        actor="user" if source == "manual" else "system",
                    )
                else:
                    self._save_decision(uid, decision, bucket)
                if action != "HOLD" and not dry_run:
                    self._notify(uid, "recommendation", {
                        "assetType": "crypto", "assetClass": "crypto",
                        "symbol": symbol, "action": action, "mode": mode,
                        "confidence": decision.get("confidence"), "regime": decision.get("regime"),
                        "targetWeight": decision.get("targetWeight"), "reason": decision.get("reason"),
                    })
                if order_result:
                    self._notify(uid, "order", {
                        "assetType": "crypto", "assetClass": "crypto",
                        "symbol": symbol, "action": action,
                        "orderId": order_result.get("id"), "status": order_result.get("status"),
                        "mode": mode,
                    })
                decisions.append(_jsonable(decision))

            with self._routing_lock(uid):
                self._assert_order_routing_allowed(
                    uid,
                    mode=mode,
                    expected_config_version=config_version,
                    source=source,
                )
                now = _utc_now()
                if dry_run:
                    durable_runtime = self.get_runtime(uid)
                    durable_runtime.update({
                        "lastDryRun": now.isoformat(),
                        "lastDryRunBucket": bucket,
                        "lastDryRunDurationMs": int((time.monotonic() - started) * 1000),
                        "lastDryRunDecisions": decisions,
                    })
                    self.save_runtime(uid, durable_runtime, f"crypto-runtime-dry-run:{uid}:{cycle_key}")
                    runtime = durable_runtime
                else:
                    cycle_started_at = runtime.get("cycleStartedAt")
                    runtime.update({
                        "status": "armed" if config.get("enabled") else "idle",
                        "enabled": bool(config.get("enabled")),
                        "locked": False,
                        "killSwitch": False,
                        "consecutiveErrors": 0,
                        "lastError": "",
                        "lastRun": now.isoformat(),
                        "nextRun": (now + timedelta(minutes=interval)).isoformat() if config.get("enabled") else None,
                        "lastRunBucket": bucket,
                        "lastDurationMs": int((time.monotonic() - started) * 1000),
                        "lastDecisions": decisions,
                        "lastHeartbeat": now.isoformat(),
                        "heartbeat": now.isoformat(),
                        "lastCycleStartedAt": cycle_started_at,
                        "cycleStartedAt": None,
                        "currentStage": "complete",
                        "progress": 100,
                        "progressDetail": {
                            "stage": "complete",
                            "completedSymbols": len(cycle_symbols),
                            "totalSymbols": len(cycle_symbols),
                            "currentSymbol": None,
                        },
                        "message": "Crypto cycle completed.",
                        "equityCurve": risk_curve,
                        "positionState": next_position_states,
                        "mode": mode,
                        "accountEligible": True,
                        "cycleCount": int(runtime.get("cycleCount") or 0) + 1,
                    })
                    self.save_runtime(uid, runtime, f"crypto-runtime-complete:{uid}:{bucket}")
            audit_event = "crypto_dry_run_completed" if dry_run else "crypto_cycle_completed"
            audit_key = (
                f"crypto-dry-run:{uid}:{cycle_key}"
                if dry_run
                else f"crypto-cycle:{uid}:{bucket}"
            )
            self._audit(
                uid, audit_event,
                {"mode": mode, "source": source, "decisions": decisions, "dryRun": dry_run},
                audit_key, actor="user" if source == "manual" else "system",
            )
            return {
                "success": True,
                "idempotent": False,
                "dryRun": bool(dry_run),
                "runtime": runtime,
                "decisions": decisions,
            }
        except Exception as exc:
            # Policy denials are expected fail-closed outcomes, not runtime
            # instability. Only broker/data/unexpected failures advance the
            # three-strike automation lock.
            if isinstance(exc, BrokerError) or not isinstance(exc, CryptoApiError):
                self._record_failure(uid, config, runtime, exc)
            elif not dry_run:
                try:
                    latest_runtime = self.get_runtime(uid)
                    if latest_runtime.get("status") == "running":
                        latest_config = self.get_config(uid)
                        interrupted_at = _iso()
                        if latest_config.get("killSwitch"):
                            status = "killed"
                        elif source == "scheduler" and not latest_config.get("enabled"):
                            status = "stopped"
                        else:
                            status = "interrupted"
                        progress_detail = dict(latest_runtime.get("progressDetail") or {})
                        progress_detail.update({"stage": status, "currentSymbol": None})
                        latest_runtime.update({
                            "status": status,
                            "enabled": bool(latest_config.get("enabled")),
                            "killSwitch": bool(latest_config.get("killSwitch")),
                            "lastHeartbeat": interrupted_at,
                            "heartbeat": interrupted_at,
                            "lastCycleStartedAt": latest_runtime.get("cycleStartedAt"),
                            "cycleStartedAt": None,
                            "currentStage": status,
                            "progressDetail": progress_detail,
                            "message": str(exc)[:500],
                            "lastError": str(exc)[:500],
                        })
                        self.save_runtime(
                            uid,
                            latest_runtime,
                            f"crypto-runtime-interrupted:{uid}:{time.time_ns()}",
                        )
                except Exception:
                    pass
            raise
        finally:
            lock.release()

    def runtime_snapshot(self, uid: Optional[str] = None):
        if uid:
            return self.get_runtime(uid)
        with self._scheduler_futures_guard:
            in_flight = sum(1 for future in self._scheduler_futures.values() if not future.done())
        scheduler_alive = bool(self._thread and self._thread.is_alive())
        scheduler_disabled = os.getenv(
            "ALPHALAB_DISABLE_CRYPTO_SCHEDULER", ""
        ).strip().lower() in {"1", "true", "yes"}
        if scheduler_disabled:
            scheduler_status = "disabled"
            scheduler_healthy = False
            scheduler_message = "Crypto scheduler is disabled by deployment configuration."
        elif scheduler_alive and self._scheduler_last_error:
            scheduler_status = "degraded"
            scheduler_healthy = False
            scheduler_message = "Crypto scheduler is running with a recent scan error."
        elif scheduler_alive:
            scheduler_status = "healthy"
            scheduler_healthy = True
            scheduler_message = "Crypto scheduler is running."
        else:
            scheduler_status = "stopped"
            scheduler_healthy = False
            scheduler_message = "Crypto scheduler is not running."
        return {
            "schedulerHealthy": scheduler_healthy,
            "status": scheduler_status,
            "message": scheduler_message,
            "schedulerAlive": scheduler_alive,
            "lastScan": self._scheduler_last_scan,
            "lastError": self._scheduler_last_error,
            "workers": self._scheduler_workers,
            "inFlight": in_flight,
            "scanCount": self._scheduler_scan_count,
            "cursor": self._scheduler_cursor,
            "lastPageSize": self._scheduler_last_page_size,
            "coordinationScope": "process-local with durable broker idempotency",
            "coverage": "24/7",
            "marketClockRequired": False,
        }

    def _enumerate_enabled(self) -> Sequence[str]:
        if self.supabase_admin is None:
            return []
        offset = max(0, int(self._scheduler_cursor))

        def operation():
            return self.supabase_admin.table("user_operation_artifacts").select(
                "user_id,payload,updated_at"
            ).eq("artifact_type", CONFIG_TYPE).eq("artifact_key", PRIMARY_KEY).contains(
                "payload", {"enabled": True, "killSwitch": False},
            ).order("user_id", desc=False).range(
                offset, offset + MAX_SCHEDULER_USERS - 1,
            ).execute()

        response = self.supabase_execute(operation, "crypto scheduler config scan") if self.supabase_execute else operation()
        result = []
        for row in _response_data(response):
            payload = dict(row.get("payload") or {}) if isinstance(row, Mapping) else {}
            uid = str(row.get("user_id") or "").strip() if isinstance(row, Mapping) else ""
            if uid and payload.get("enabled") is True and payload.get("killSwitch") is not True:
                result.append(uid)
        return result[:MAX_SCHEDULER_USERS]

    def _scheduler_run_user(self, uid: str):
        try:
            config = self.get_config(uid)
            runtime = self.get_runtime(uid)
            if (
                (runtime.get("locked") and not runtime.get("reconciliationRequired"))
                or config.get("killSwitch")
                or not config.get("enabled")
            ):
                return
            interval = int(config["intervalMinutes"])
            bucket = int(time.time() // (interval * 60))
            if (
                runtime.get("lastRunBucket") == bucket
                and not runtime.get("pendingReconciliations")
                and not runtime.get("reconciliationRequired")
            ):
                return
            self.run_cycle(uid, source="scheduler")
            refreshed_config = self.get_config(uid)
            refreshed_runtime = self.get_runtime(uid)
            cadence = int(refreshed_config.get("calibrationEveryCycles") or 24)
            cycle_count = int(refreshed_runtime.get("cycleCount") or 0)
            if (
                refreshed_config.get("mode") == "paper"
                and refreshed_config.get("paperLearningEnabled") is True
                and cycle_count > 0
                and cycle_count % cadence == 0
            ):
                self.calibrate_paper_strategy(uid, apply=True, source="scheduler")
        except Exception as exc:
            self.safe_print("[CryptoScheduler] user cycle failed: %s" % type(exc).__name__)

    def _scheduler_scan(self):
        """Submit a bounded, rotating page without starving later users."""
        with self._scheduler_futures_guard:
            for uid, future in list(self._scheduler_futures.items()):
                if future.done():
                    self._scheduler_futures.pop(uid, None)
            available = self._scheduler_workers - len(self._scheduler_futures)
            if available <= 0:
                return
            page_start = self._scheduler_cursor
            candidates = list(self._enumerate_enabled())
            if not candidates and page_start > 0:
                self._scheduler_cursor = 0
                page_start = 0
                candidates = list(self._enumerate_enabled())
            self._scheduler_last_page_size = len(candidates)
            inspected = 0
            for uid in candidates:
                if available <= 0:
                    break
                inspected += 1
                if uid in self._scheduler_futures:
                    continue
                self._scheduler_futures[uid] = self._scheduler_executor.submit(
                    self._scheduler_run_user, uid,
                )
                available -= 1
            if candidates:
                self._scheduler_cursor = page_start + max(1, inspected)
            else:
                self._scheduler_cursor = 0
            self._scheduler_scan_count += 1

    def _scheduler_loop(self):
        lock_handle = None
        while not self._stop.wait(0.1):
            try:
                try:
                    import fcntl
                    lock_handle = open(os.getenv("CRYPTO_SCHEDULER_LOCK_PATH", "/tmp/alphalab_crypto_scheduler.lock"), "a+")
                    fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                except (ImportError, BlockingIOError, OSError):
                    if lock_handle:
                        lock_handle.close()
                    lock_handle = None
                    if self._stop.wait(30):
                        return
                    continue
                self._scheduler_scan()
                self._scheduler_last_scan = _iso()
                self._scheduler_last_error = ""
            except Exception as exc:
                self._scheduler_last_error = type(exc).__name__
                self.safe_print("[CryptoScheduler] scan failed: %s" % type(exc).__name__)
            finally:
                if lock_handle:
                    try:
                        import fcntl
                        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
                    except Exception:
                        pass
                    lock_handle.close()
                    lock_handle = None
            if self._stop.wait(30):
                return

    def start(self):
        if os.getenv("ALPHALAB_DISABLE_CRYPTO_SCHEDULER", "").strip().lower() in {"1", "true", "yes"}:
            return
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._scheduler_loop, name="alphalab-crypto-24x7", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread and self._thread.is_alive() and self._thread is not threading.current_thread():
            self._thread.join(timeout=1.0)
        self._scheduler_executor.shutdown(wait=True, cancel_futures=True)


def register_crypto_api(
    app,
    *,
    require_auth,
    resolve_alpaca_config_for_user,
    operations_store,
    supabase_admin=None,
    supabase_execute=None,
    safe_print=print,
    ai_reviewer=None,
    ai_status_resolver=None,
    notifier=None,
):
    """Register user-scoped crypto routes and start the 24/7 scheduler.

    Returns a mapping containing callable ``runtime`` and ``stop`` controls so
    the host process and tests can inspect or shut down the daemon cleanly.
    """

    existing = app.extensions.get("alphalab_crypto_api")
    if existing:
        return existing

    service = _CryptoService(
        require_auth=require_auth,
        resolve_alpaca_config_for_user=resolve_alpaca_config_for_user,
        operations_store=operations_store,
        supabase_admin=supabase_admin,
        supabase_execute=supabase_execute,
        safe_print=safe_print,
        ai_reviewer=ai_reviewer,
        ai_status_resolver=ai_status_resolver,
        notifier=notifier,
    )
    blueprint = Blueprint("crypto_api", __name__)

    def ok(payload: Mapping[str, Any], status: int = 200):
        return jsonify(_jsonable(dict(payload))), status

    def fail(exc: Exception):
        if isinstance(exc, CryptoApiError):
            return ok({"success": False, "reason": exc.code, "message": str(exc)}, exc.status)
        safe_print("[CryptoAPI] unexpected error: %s" % type(exc).__name__)
        return ok({"success": False, "reason": "crypto_internal_error", "message": "Crypto request failed safely."}, 500)

    def json_object() -> Dict[str, Any]:
        data = request.get_json(silent=True)
        if isinstance(data, Mapping):
            return dict(data)
        raw = request.get_data(cache=True) or b""
        if not raw.strip():
            return {}
        raise CryptoApiError(
            "JSON request body must be an object",
            status=400,
            code="invalid_json_object",
        )

    @blueprint.get("/api/crypto/config")
    def crypto_config_get():
        try:
            user = service._auth_user()
            return ok({"success": True, "config": service.get_config(user["id"])})
        except Exception as exc:
            return fail(exc)

    @blueprint.put("/api/crypto/config")
    def crypto_config_put():
        try:
            user = service._auth_user()
            uid = user["id"]
            data = json_object()
            lifecycle_fields = sorted(set(data) & {"enabled", "killSwitch"})
            if lifecycle_fields:
                raise CryptoApiError(
                    "enabled and killSwitch may only be changed through automation lifecycle endpoints",
                    status=400,
                    code="lifecycle_control_required",
                )
            confirm_live = data.pop("confirmLiveRisk", False)
            current, current_version = service.get_config_snapshot(uid)
            config = _validate_config(data, base=current)
            if "symbols" in data and config["symbols"] != current.get("symbols"):
                active_assets = {
                    row["symbol"] for row in service.assets(uid, config["mode"])
                    if row.get("tradable") and row.get("strategySupported")
                }
                unavailable = sorted(set(config["symbols"]) - active_assets)
                if unavailable:
                    raise CryptoApiError(
                        "These crypto assets are not currently tradable at Alpaca: %s" % ", ".join(unavailable),
                        status=409, code="asset_not_tradable",
                    )
            if config["liveAuthorized"]:
                _require_live_release_admitted()
            if config["liveAuthorized"] and not current.get("liveAuthorized"):
                if confirm_live is not True:
                    raise CryptoApiError("Explicit live risk confirmation is required", status=403, code="live_confirmation_required")
                _, gate = service.account(uid, "live")
                if not gate["eligible"]:
                    raise CryptoApiError("Live crypto account is not eligible", status=409, code="crypto_account_ineligible")
            key = str(request.headers.get("X-Idempotency-Key") or f"crypto-config:{uid}:{time.time_ns()}")[:200]
            # Serialize the durable version fence with the final broker-order
            # check/submit section. This prevents a configuration update from
            # slipping between the per-order recheck and the broker request.
            with service._routing_lock(uid):
                _, latest_version = service.get_config_snapshot(uid)
                if latest_version != current_version:
                    raise CryptoApiError(
                        "Crypto configuration changed while this update was being prepared",
                        status=409,
                        code="config_version_conflict",
                    )
                removed_symbols = sorted(set(current.get("symbols") or []) - set(config["symbols"]))
                if removed_symbols:
                    dependencies = service.removed_symbol_dependencies(
                        uid,
                        _mode(current.get("mode"), "paper"),
                        removed_symbols,
                    )
                    if dependencies:
                        detail = "; ".join(
                            f"{symbol}: {', '.join(reasons)}"
                            for symbol, reasons in sorted(dependencies.items())
                        )
                        raise CryptoApiError(
                            "Cannot remove crypto assets that still have active state (%s)" % detail,
                            status=409,
                            code="symbol_in_use",
                        )
                service.save_config(uid, config, key)
            service._audit(uid, "crypto_config_updated", {"mode": config["mode"], "enabled": config["enabled"]}, key, actor="user")
            return ok({"success": True, "config": config})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/runtime")
    def crypto_runtime_get():
        try:
            user = service._auth_user()
            return ok({"success": True, "runtime": service.get_runtime(user["id"]), "scheduler": service.runtime_snapshot()})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/assets")
    def crypto_assets_get():
        try:
            user = service._auth_user()
            config = service.get_config(user["id"])
            mode = _mode(request.args.get("mode"), config["mode"])
            return ok({
                "success": True, "mode": mode,
                "assets": service.assets(user["id"], mode), "source": "Alpaca Crypto",
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/bars")
    def crypto_bars_get():
        try:
            user = service._auth_user()
            config = service.get_config(user["id"])
            mode = _mode(request.args.get("mode"), config["mode"])
            symbol = _normalize_symbol(request.args.get("symbol") or "BTC/USD")
            timeframe = str(request.args.get("timeframe") or "1Hour")
            try:
                limit = min(10_000, max(2, int(request.args.get("limit") or 720)))
            except ValueError as exc:
                raise CryptoApiError("limit is invalid", code="invalid_limit") from exc
            rows = service.bars(
                user["id"], mode, symbol, timeframe=timeframe, limit=limit,
                start=request.args.get("start"), end=request.args.get("end"),
            )
            return ok({
                "success": True, "mode": mode, "symbol": symbol,
                "timeframe": timeframe, "bars": rows, "source": "Alpaca Crypto",
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/ledger")
    def crypto_ledger_get():
        try:
            user = service._auth_user()
            try:
                limit = min(100, max(1, int(request.args.get("limit") or 50)))
            except ValueError as exc:
                raise CryptoApiError("limit is invalid", code="invalid_limit") from exc
            ledger = service.ledger_with_meta(user["id"], limit)
            records = list(ledger["records"])
            return ok({
                "success": True,
                "records": records,
                "limit": limit,
                "returnedCount": len(records),
                "scannedRows": ledger["scannedRows"],
                "scannedPages": ledger["scannedPages"],
                "maxScannedRows": ledger["maxScannedRows"],
                "maxPages": ledger["maxPages"],
                "scanTruncated": ledger["scanTruncated"],
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/overview")
    def crypto_overview_get():
        try:
            user = service._auth_user()
            uid = user["id"]
            config = service.get_config(uid)
            mode = _mode(request.args.get("mode"), config["mode"])
            runtime = service.get_runtime(uid)
            decisions = list(service.latest_decisions(uid))
            decision_by_symbol = {row.get("symbol"): row for row in decisions if row.get("symbol")}
            account_eligible = None
            account = {}
            positions = []
            account_error = ""
            gate = {"eligible": None, "cryptoStatus": "UNKNOWN", "reasons": []}
            try:
                service._broker_config(uid, mode)
                account_configured = True
            except Exception:
                account_configured = False
            try:
                account, gate = service.account(uid, mode)
                account_eligible = gate["eligible"]
                positions = list(service.positions(uid, mode))
            except Exception as exc:
                account_error = str(exc)[:300]
            snapshots = {}
            try:
                snapshots = service.snapshots(uid, mode, config["symbols"])
            except Exception as exc:
                if not account_error:
                    account_error = str(exc)[:300]
            # Asset metadata is cached for five minutes by ``assets``.  It is
            # the authoritative source for whether a pair may be routed; a
            # quote alone only proves that market data is currently present.
            asset_catalog: Dict[str, Dict[str, Any]] = {}
            asset_catalog_error = ""
            try:
                asset_catalog = {
                    str(row.get("symbol") or ""): dict(row)
                    for row in service.assets(uid, mode)
                    if isinstance(row, Mapping) and row.get("symbol")
                }
            except Exception as exc:
                asset_catalog_error = str(exc)[:300]
            names = {"BTC/USD": "Bitcoin", "ETH/USD": "Ethereum"}
            assets = []
            overview_now = _utc_now()
            for symbol in config["symbols"]:
                snapshot = dict(snapshots.get(symbol) or {"symbol": symbol})
                decision = decision_by_symbol.get(symbol) or {}
                price = max(0.0, _number(snapshot.get("price")))
                bid = max(0.0, _number(snapshot.get("bid")))
                ask = max(0.0, _number(snapshot.get("ask")))
                quote_time = _parse_utc_datetime(snapshot.get("quoteAsOf"))
                quote_age = (
                    (overview_now - quote_time).total_seconds()
                    if quote_time is not None else None
                )
                availability_reasons = []
                if price <= 0:
                    availability_reasons.append("price_unavailable")
                # Market display availability and execution readiness are
                # intentionally separate. A valid trade/daily mark may still
                # be shown when the top-of-book quote is momentarily missing;
                # BUY/ADD routing remains blocked until every quote gate passes.
                data_available = price > 0
                execution_reasons = []
                if bid <= 0 or ask <= 0:
                    execution_reasons.append("quote_unavailable")
                elif ask < bid:
                    execution_reasons.append("quote_invalid")
                if quote_time is None:
                    execution_reasons.append("quote_timestamp_unavailable")
                elif quote_age < -5 or quote_age > MAX_ENTRY_QUOTE_AGE_SECONDS:
                    execution_reasons.append("quote_stale")
                execution_ready = data_available and not execution_reasons
                broker_asset = asset_catalog.get(symbol)
                broker_tradable = (
                    _optional_boolean(broker_asset.get("tradable"))
                    if broker_asset is not None else None
                )
                tradability_reasons = []
                # A currently unusable quote makes the pair non-tradable for
                # this interface even when the broker lists the asset as
                # active.  Otherwise, only affirmative metadata *and* a
                # confirmed eligible account earn a true value.  Any missing
                # dependency stays unknown rather than optimistically true.
                if not execution_ready:
                    tradable: Optional[bool] = False
                elif broker_asset is None:
                    tradable = None
                    tradability_reasons.append(
                        "asset_metadata_unavailable" if asset_catalog_error else "asset_metadata_missing"
                    )
                elif broker_tradable is not True:
                    tradable = False if broker_tradable is False else None
                    tradability_reasons.append(
                        "asset_not_tradable" if broker_tradable is False else "broker_tradability_unknown"
                    )
                elif account_eligible is False:
                    tradable = False
                    tradability_reasons.append("account_ineligible")
                elif account_eligible is not True:
                    tradable = None
                    tradability_reasons.append("account_eligibility_unknown")
                else:
                    tradable = True
                snapshot.update({
                    "name": names.get(symbol, symbol),
                    "signal": decision.get("action") or "WAIT",
                    "confidence": decision.get("confidence", 0),
                    "regime": decision.get("regime") or "awaiting_data",
                    "dataAvailable": data_available,
                    "marketDataAvailable": data_available,
                    "executionReady": execution_ready,
                    "tradable": tradable,
                    "brokerTradable": broker_tradable,
                    "accountEligible": account_eligible,
                    "reasons": availability_reasons + execution_reasons + tradability_reasons,
                    "dataAvailabilityReasons": availability_reasons,
                    "executionReadinessReasons": execution_reasons,
                    "tradabilityReasons": tradability_reasons,
                    "quoteAgeSeconds": round(quote_age, 3) if quote_age is not None else None,
                })
                snapshot["signalDetail"] = {
                    "action": snapshot["signal"],
                    "confidence": snapshot["confidence"],
                    "regime": snapshot["regime"],
                    "targetWeight": decision.get("targetWeight", 0),
                    "reasons": list(decision.get("reasons") or []),
                }
                assets.append(snapshot)
            equity = _number(account.get("equity"), _number(account.get("portfolio_value")))
            crypto_equity = sum(_number(row.get("marketValue")) for row in positions)
            portfolio = {
                "equity": equity or None,
                "cryptoEquity": crypto_equity,
                "cash": _number(account.get("cash")) if account else None,
                "exposurePct": round(crypto_equity / equity * 100, 2) if equity > 0 else 0.0,
                "dayPnl": _number(account.get("equity")) - _number(account.get("last_equity")) if account else None,
                "positions": positions,
            }
            automation = {
                "enabled": bool(config.get("enabled")),
                "status": runtime.get("status") or "idle",
                "nextRun": runtime.get("nextRun"),
                "lastRun": runtime.get("lastRun"),
                "intervalMinutes": config["intervalMinutes"],
                "killSwitch": bool(config.get("killSwitch")),
                "locked": bool(runtime.get("locked")),
                "coverage": "24/7",
            }
            public_account = {
                "configured": account_configured,
                "cryptoStatus": gate.get("cryptoStatus") or "UNKNOWN",
                "eligible": account_eligible,
                "eligibilityReasons": list(gate.get("reasons") or []),
                "equity": equity or None,
                "nonMarginableBuyingPower": _number(account.get("non_marginable_buying_power")) if account else None,
            }
            ledger = service.ledger_with_meta(uid, 20)
            return ok({
                "success": True,
                "mode": mode,
                "asOf": _iso(),
                "source": "Alpaca Crypto 24/7",
                "liveAdmission": _live_release_admission(),
                "accountEligible": account_eligible,
                "accountError": account_error or None,
                "account": public_account,
                "assets": assets,
                "portfolio": portfolio,
                "automation": automation,
                "runtime": runtime,
                "risk": service._equity_risk(runtime),
                "decision": decisions[0] if decisions else None,
                "decisions": decisions,
                "equityCurve": list(runtime.get("equityCurve") or []),
                "config": config,
                "ledger": ledger,
                "algorithm": {"name": ALGORITHM_NAME, "version": ALGORITHM_VERSION},
                "ai": service.ai_status(uid),
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/backtest")
    def crypto_backtest_post():
        try:
            user = service._auth_user()
            uid = user["id"]
            data = json_object()
            config = service.get_config(uid)
            mode = _mode(data.get("mode"), config["mode"])
            symbol = _normalize_symbol(data.get("symbol") or config["symbols"][0])
            if symbol not in config["symbols"]:
                raise CryptoApiError(
                    "Backtests are limited to assets enabled in the saved crypto configuration",
                    code="unsupported_symbol",
                )
            strategy_patch = data.get("strategy") or {}
            if not isinstance(strategy_patch, Mapping):
                raise CryptoApiError("strategy must be an object", code="invalid_backtest")
            candidate_strategy = {**config["strategy"], **dict(strategy_patch), "symbols": [symbol]}
            minimum_confidence = _number(config.get("minimumConfidence"), 60.0)
            candidate_strategy["entry_score"] = max(
                minimum_confidence,
                _number(candidate_strategy.get("entry_score"), minimum_confidence),
            )
            candidate_strategy["add_score"] = max(
                candidate_strategy["entry_score"],
                minimum_confidence,
                _number(candidate_strategy.get("add_score"), minimum_confidence),
            )
            candidate_strategy["reduce_score"] = min(
                candidate_strategy["entry_score"],
                _number(candidate_strategy.get("reduce_score"), candidate_strategy["entry_score"]),
            )
            allocation_pct = _number(
                (config.get("assetAllocationsPct") or {}).get(symbol),
                config.get("maxAssetExposurePct"),
            )
            single_asset_cap = min(
                _number(config.get("maxTotalExposure"), 1.0),
                _number(config.get("maxAssetExposurePct"), 100.0) / 100.0,
                allocation_pct / 100.0,
            )
            candidate_strategy["max_asset_weight"] = min(
                single_asset_cap,
                _number(candidate_strategy.get("max_asset_weight"), single_asset_cap),
            )
            if _number(candidate_strategy.get("rebalance_band"), 0.0) >= candidate_strategy["max_asset_weight"]:
                candidate_strategy["rebalance_band"] = max(
                    0.000001, candidate_strategy["max_asset_weight"] / 2.0,
                )
            strategy = validate_engine_config(candidate_strategy)
            minimum = required_history_bars(strategy) + 2
            try:
                limit = min(10_000, max(minimum, int(data.get("limit") or minimum + 720)))
                initial = max(100.0, min(_number(data.get("initialCapital"), 10_000), 10_000_000.0))
            except (TypeError, ValueError) as exc:
                raise CryptoApiError("Backtest parameters are invalid", code="invalid_backtest") from exc
            strategy_timeframe = _strategy_timeframe(strategy)
            bar_label = "15-minute" if strategy_timeframe == "15Min" else "hourly"
            rows = service.bars(
                uid, mode, symbol, timeframe=strategy_timeframe, limit=limit,
                start=data.get("start"), end=data.get("end"),
            )
            if strategy_timeframe == "1Hour":
                backtest_rows, data_quality = _repair_isolated_hourly_backtest_gaps(rows)
            else:
                backtest_rows = rows
                data_quality = {"sourceBars": len(rows), "syntheticBars": 0, "repairedGaps": []}
            result = run_engine_backtest(backtest_rows, strategy, symbol=symbol, initial_capital=initial)
            result["dataQuality"] = data_quality
            if data_quality["syntheticBars"]:
                result.setdefault("notes", []).append(
                    "%d isolated missing hourly bar(s) were filled at the prior close with zero volume; live signals never use repaired bars."
                    % data_quality["syntheticBars"]
                )
            not_simulated = [
                {
                    "field": "riskPerTradePct",
                    "value": config.get("riskPerTradePct"),
                    "reason": "The single-asset engine backtest targets portfolio weight and does not size each order from a live equity risk budget.",
                },
                {
                    "field": "minOrderNotional/maxOrderNotional",
                    "value": {
                        "minimum": config.get("minOrderNotional"),
                        "maximum": config.get("maxOrderNotional"),
                    },
                    "reason": "Historical fills are not rounded or rejected using the broker notional limits.",
                },
                {
                    "field": "multiAssetAggregateExposure",
                    "value": config.get("maxTotalExposure"),
                    "reason": "This request simulates one asset; aggregate BTC/ETH competition is represented only by the applied single-asset cap.",
                },
                {
                    "field": "brokerOrderContract",
                    "value": config.get("order"),
                    "reason": "Broker order type, time-in-force, queueing, partial fills, and reconciliation are not replayed from historical order books.",
                },
                {
                    "field": "freshQuoteSpreadDepth",
                    "value": {
                        "maxQuoteAgeSeconds": MAX_ENTRY_QUOTE_AGE_SECONDS,
                        "maxSpreadBps": MAX_ENTRY_SPREAD_BPS,
                    },
                    "reason": f"{bar_label.capitalize()} OHLCV bars cannot reproduce live quote freshness, spread, or top-of-book depth gates.",
                },
                {
                    "field": "restrictedAiReview",
                    "value": bool(config.get("aiReviewEnabled")),
                    "reason": "The optional live decision challenge is not invoked during deterministic backtests.",
                },
            ]
            result["executionConstraints"] = {
                "scope": "single_asset",
                "symbol": symbol,
                "represented": [
                    f"Minimum confidence and entry score: {strategy['entry_score']:.2f}",
                    f"Add score: {strategy['add_score']:.2f}",
                    f"Effective single-asset weight cap: {strategy['max_asset_weight']:.4f}",
                    f"Configured allocation / asset cap / total cap: {allocation_pct:.2f}% / {_number(config.get('maxAssetExposurePct')):.2f}% / {_number(config.get('maxTotalExposure')):.4f}",
                    f"Fees and adverse slippage: {strategy['fee_bps']:.2f} bps / {strategy['slippage_bps']:.2f} bps",
                ],
                "applied": {
                    "minimumConfidence": minimum_confidence,
                    "entryScore": strategy["entry_score"],
                    "addScore": strategy["add_score"],
                    "singleAssetWeightCap": strategy["max_asset_weight"],
                    "rebalanceBand": strategy["rebalance_band"],
                    "configuredSingleAssetCap": single_asset_cap,
                    "symbolAllocationPct": allocation_pct,
                    "maxAssetExposurePct": config.get("maxAssetExposurePct"),
                    "maxTotalExposure": config.get("maxTotalExposure"),
                    "feeBps": strategy.get("fee_bps"),
                    "slippageBps": strategy.get("slippage_bps"),
                },
                "notSimulated": not_simulated,
            }
            result["timeframe"] = strategy_timeframe
            result["limitations"] = [
                f"This is a single-asset {bar_label}-bar simulation, not a multi-asset portfolio replay.",
                "Live broker eligibility, buying power, quote quality, order lifecycle, and asynchronous fill reconciliation are not modeled.",
                "Risk-per-trade and order-notional mandates are disclosed above but are not enforced by the historical engine.",
            ]
            result["equityCurvePoints"] = [
                {"time": timestamp, "value": value}
                for timestamp, value in zip(result.get("timestamps") or [], result.get("equity_curve") or [])
            ]
            key = str(request.headers.get("X-Idempotency-Key") or f"crypto-backtest:{uid}:{time.time_ns()}")[:200]
            service._audit(uid, "crypto_backtest_completed", {
                "symbol": symbol,
                "metrics": result.get("metrics"),
                "executionConstraints": result.get("executionConstraints"),
            }, key, actor="user")
            return ok({"success": True, "result": result})
        except (CryptoEngineError, CryptoApiError) as exc:
            return fail(exc if isinstance(exc, CryptoApiError) else CryptoApiError(str(exc), code="invalid_backtest"))
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/strategy-library")
    def crypto_strategy_library_get():
        try:
            service._auth_user()
            strategies = [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "source": deepcopy(item.get("source") or {}),
                    "role": "control" if item["id"] == "current" else "paper_challenger",
                }
                for item in STRATEGY_RESEARCH_LIBRARY
            ]
            return ok({
                "success": True,
                "version": "2026-07-20",
                "strategies": strategies,
                "method": "Published concepts are reimplemented as bounded long/flat challengers and re-tested on Alpaca hourly bars after costs.",
                "guardrail": "Paper-only discovery; no downloaded code or web content can route an order.",
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/calibration/run")
    def crypto_calibration_run():
        try:
            user = service._auth_user()
            data = json_object()
            apply_candidate = data.get("apply", True)
            if not isinstance(apply_candidate, bool):
                raise CryptoApiError("apply must be true or false", code="invalid_request")
            return ok(service.calibrate_paper_strategy(
                user["id"], apply=apply_candidate, source="manual",
            ))
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/run-cycle")
    def crypto_run_cycle_post():
        try:
            user = service._auth_user()
            data = json_object()
            if "order" in data or "timeInForce" in data or "side" in data:
                raise CryptoApiError("Direct order overrides are not accepted", code="invalid_order_contract")
            config = service.get_config(user["id"])
            requested_mode = _mode(data.get("mode"), config["mode"])
            if requested_mode != config["mode"]:
                raise CryptoApiError(
                    "Save the selected crypto mode before running a trading cycle",
                    status=409, code="config_mode_mismatch",
                )
            dry_run = data.get("dryRun", False)
            if not isinstance(dry_run, bool):
                raise CryptoApiError("dryRun must be true or false", code="invalid_request")
            request_key = str(request.headers.get("X-Idempotency-Key") or "").strip() or None
            return ok(service.run_cycle(
                user["id"],
                source="manual",
                dry_run=dry_run,
                idempotency_key=request_key,
            ))
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/automation/start")
    def crypto_automation_start():
        try:
            user = service._auth_user()
            uid = user["id"]
            data = json_object()
            acknowledge_risk = data.get("acknowledgeRisk", False)
            if not isinstance(acknowledge_risk, bool):
                raise CryptoApiError("acknowledgeRisk must be true or false", code="invalid_request")
            with service._routing_lock(uid):
                config = service.get_config(uid)
                runtime = service.get_runtime(uid)
                if runtime.get("reconciliationRequired"):
                    raise CryptoApiError(
                        str(runtime.get("reconciliationMessage") or "Broker fill reconciliation is required"),
                        status=423,
                        code="reconciliation_required",
                    )
                risk_acknowledged = bool(runtime.get("manualReviewRequired")) and acknowledge_risk
                if runtime.get("manualReviewRequired") and not acknowledge_risk:
                    raise CryptoApiError(
                        "Manual review of the crypto drawdown circuit must be acknowledged before restart",
                        status=409,
                        code="risk_acknowledgement_required",
                    )
                requested_mode = _mode(data.get("mode"), config["mode"])
                if requested_mode != config["mode"]:
                    raise CryptoApiError(
                        "Save the selected crypto mode before starting automation",
                        status=409, code="config_mode_mismatch",
                    )
                if config.get("killSwitch"):
                    raise CryptoApiError("Reset the crypto kill switch before starting", status=409, code="kill_switch_active")
                if config["mode"] == "live" and not config.get("liveAuthorized"):
                    raise CryptoApiError("Live crypto automation is not authorized", status=403, code="live_not_authorized")
                if config["mode"] == "live":
                    _require_live_release_admitted()
                scheduler = service.runtime_snapshot()
                if scheduler.get("schedulerHealthy") is not True:
                    raise CryptoApiError(
                        str(scheduler.get("message") or "Crypto scheduler health could not be verified"),
                        status=503,
                        code="scheduler_unavailable",
                    )
                _, gate = service.account(uid, config["mode"])
                if not gate["eligible"]:
                    raise CryptoApiError("Alpaca crypto account is not eligible", status=409, code="crypto_account_ineligible")
                config["enabled"] = True
                config["updatedAt"] = _iso()
                key = str(request.headers.get("X-Idempotency-Key") or f"crypto-start:{uid}:{time.time_ns()}")[:200]
                service.save_config(uid, config, key)
                runtime.update({
                    "status": "armed", "enabled": True, "locked": False,
                    "consecutiveErrors": 0, "lastError": "", "killSwitch": False,
                    "nextRun": _iso(), "coverage": "24/7", "marketClockRequired": False,
                    "manualReviewRequired": False if risk_acknowledged else bool(runtime.get("manualReviewRequired")),
                    "currentStage": "armed", "progress": 0,
                    "progressDetail": {
                        "stage": "armed", "completedSymbols": 0,
                        "totalSymbols": len(config["symbols"]), "currentSymbol": None,
                    },
                    "message": "Crypto automation is armed.",
                })
                service.save_runtime(uid, runtime, f"crypto-runtime-start:{uid}:{time.time_ns()}")
            if risk_acknowledged:
                service._audit(
                    uid,
                    "crypto_manual_risk_review_acknowledged",
                    {"mode": config["mode"], "acknowledged": True},
                    f"{key}:risk-ack",
                    actor="user",
                )
            service._audit(
                uid,
                "crypto_automation_started",
                {"mode": config["mode"], "coverage": "24/7", "riskAcknowledged": risk_acknowledged},
                key,
                actor="user",
            )
            return ok({"success": True, "config": config, "runtime": runtime})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/automation/stop")
    def crypto_automation_stop():
        try:
            user = service._auth_user()
            uid = user["id"]
            json_object()
            with service._routing_lock(uid):
                config = service.get_config(uid)
                config["enabled"] = False
                config["updatedAt"] = _iso()
                key = str(request.headers.get("X-Idempotency-Key") or f"crypto-stop:{uid}:{time.time_ns()}")[:200]
                service.save_config(uid, config, key)
                runtime = service.get_runtime(uid)
                heartbeat = _iso()
                runtime.update({
                    "status": "stopped", "enabled": False, "nextRun": None,
                    "lastHeartbeat": heartbeat, "heartbeat": heartbeat, "cycleStartedAt": None,
                    "currentStage": "stopped", "progress": 0,
                    "progressDetail": {
                        "stage": "stopped", "completedSymbols": 0,
                        "totalSymbols": 0, "currentSymbol": None,
                    },
                    "message": "Crypto automation is stopped.",
                })
                service.save_runtime(uid, runtime, f"crypto-runtime-stop:{uid}:{time.time_ns()}")
            service._audit(uid, "crypto_automation_stopped", {"mode": config["mode"]}, key, actor="user")
            return ok({"success": True, "config": config, "runtime": runtime})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/kill-switch")
    def crypto_kill_switch():
        try:
            user = service._auth_user()
            uid = user["id"]
            data = json_object()
            enabled = data.get("enabled", True)
            if not isinstance(enabled, bool):
                raise CryptoApiError("enabled must be true or false", code="invalid_request")
            raw_reason = data.get("reason")
            if raw_reason is not None and not isinstance(raw_reason, str):
                raise CryptoApiError("reason must be a string", code="invalid_request")
            reason = str(raw_reason or "").strip()[:500] or (
                "user_requested_emergency_stop" if enabled else "user_confirmed_kill_switch_reset"
            )
            with service._routing_lock(uid):
                config = service.get_config(uid)
                # Resetting the switch is an explicit user action, but never restores
                # automation or live authority implicitly.
                config.update({"killSwitch": enabled, "enabled": False, "liveAuthorized": False, "updatedAt": _iso()})
                operation = "kill" if enabled else "kill-reset"
                key = str(request.headers.get("X-Idempotency-Key") or f"crypto-{operation}:{uid}:{time.time_ns()}")[:200]
                service.save_config(uid, config, key)
                runtime = service.get_runtime(uid)
                heartbeat = _iso()
                stage = "killed" if enabled else "stopped"
                runtime.update({
                    "status": stage,
                    "enabled": False, "killSwitch": enabled, "nextRun": None,
                    "killReason": reason if enabled else "",
                    "lastHeartbeat": heartbeat, "heartbeat": heartbeat, "cycleStartedAt": None,
                    "currentStage": stage, "progress": 0,
                    "progressDetail": {
                        "stage": stage,
                        "completedSymbols": 0, "totalSymbols": 0,
                        "currentSymbol": None,
                    },
                    "message": (
                        f"Crypto automation was stopped by the kill switch: {reason}"
                        if enabled else "Crypto kill switch was reset; automation remains stopped."
                    ),
                })
                service.save_runtime(uid, runtime, f"crypto-runtime-{operation}:{uid}:{time.time_ns()}")
            service._audit(
                uid, "crypto_kill_switch_activated" if enabled else "crypto_kill_switch_reset",
                {"mode": config["mode"], "enabled": enabled, "reason": reason}, key, actor="user",
            )
            return ok({"success": True, "config": config, "runtime": runtime})
        except Exception as exc:
            return fail(exc)

    app.register_blueprint(blueprint)
    service.start()
    controls = {"runtime": service.runtime_snapshot, "stop": service.stop, "service": service}
    app.extensions["alphalab_crypto_api"] = controls
    return controls


__all__ = ["register_crypto_api", "CryptoApiError", "BrokerError"]
