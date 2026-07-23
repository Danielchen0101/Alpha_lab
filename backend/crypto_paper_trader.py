"""Helios 24/7 local paper-trading daemon for BTC/USD and ETH/USD.

A background simulator that trains the strategy against live market data
around the clock without needing any broker API keys:

* Pulls public hourly bars from Alpaca's keyless crypto data API.
* Runs the Helios Regime Ensemble (``crypto_engine``) plus the deep-learning
  advisor (``crypto_ml``) on every newly completed bar.
* Fills orders into a local simulated account with taker fees and adverse
  slippage, persists everything to JSON, and exposes a Flask blueprint for
  the Crypto workspace UI.

Downtime honesty: if the host backend was offline, the daemon replays every
missed completed bar in order and fills at the *next* bar's open — the same
anti-look-ahead contract as the engine backtester.  Only the newest completed
bar is filled at its close, because at that moment the close *is* the current
market price.  The simulated track record therefore stays continuous and
reproducible across restarts.
"""

from __future__ import annotations

import json
import math
import os
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

import requests
from flask import Blueprint, jsonify, request

try:
    from .crypto_engine import (
        CryptoEngineError,
        apply_fill_to_position_state,
        backtest as engine_backtest,
        generate_signal,
        required_history_bars,
        validate_config as validate_engine_config,
    )
    from . import crypto_ml
except ImportError:  # direct module import by the monolithic backend
    from crypto_engine import (  # type: ignore
        CryptoEngineError,
        apply_fill_to_position_state,
        backtest as engine_backtest,
        generate_signal,
        required_history_bars,
        validate_config as validate_engine_config,
    )
    import crypto_ml  # type: ignore


SIM_VERSION = "1.0.0"
DATA_BASE_URL = "https://data.alpaca.markets"
SIM_SYMBOLS = ("BTC/USD", "ETH/USD")
STATE_FILENAME = "crypto_paper_state.json"
ML_FILENAME = "crypto_paper_ml.json"
MAX_EQUITY_POINTS = 40_000
MAX_TRADES = 2_000
MAX_DECISIONS = 400
MAX_ERRORS = 40
MIN_ORDER_NOTIONAL = 10.0
FETCH_TIMEOUT_SECONDS = 20
MAX_GAP_FILL_BARS = 6

DEFAULT_SIM_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "intervalMinutes": 5,
    "symbols": list(SIM_SYMBOLS),
    "initialCapital": 100_000.0,
    "feeBps": 25.0,
    "slippageBps": 5.0,
    "mlEnabled": True,
    "mlRetrainHours": 24,
    # The 65-day slow-momentum feature only warms up after ~1,560 hourly
    # bars, so the training window must extend well past it.
    "mlHistoryDays": 150,
    "strategy": {
        # A paper-training account can run a little hotter than the cautious
        # Alpaca-account defaults; everything else inherits engine defaults.
        "max_asset_weight": 0.30,
    },
}


class CryptoSimError(RuntimeError):
    def __init__(self, message: str, *, status: int = 400, code: str = "crypto_sim_error"):
        super().__init__(message)
        self.status = status
        self.code = code


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _utc_now()).isoformat()


def _parse_iso(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str) and value.strip():
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _number(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _performance_from_curve(points: Sequence[Sequence[Any]], initial_capital: float) -> Dict[str, Any]:
    """Sharpe/Sortino/drawdown from persisted [timestamp, equity] points."""

    equities = [float(point[1]) for point in points if len(point) >= 2 and _number(point[1]) > 0]
    if len(equities) < 2:
        return {
            "totalReturn": 0.0, "annualizedReturn": 0.0, "sharpe": 0.0, "sortino": 0.0,
            "maxDrawdown": 0.0, "volatility": 0.0, "observations": len(equities),
        }
    returns = [equities[i] / equities[i - 1] - 1 for i in range(1, len(equities))]
    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / max(1, len(returns) - 1)
    stdev = math.sqrt(variance)
    downside = [min(r, 0.0) for r in returns]
    downside_dev = math.sqrt(sum(r * r for r in downside) / len(downside)) if downside else 0.0
    periods_per_year = 365 * 24  # curve points are appended per completed hourly bar
    sharpe = mean / stdev * math.sqrt(periods_per_year) if stdev > 0 else 0.0
    sortino = mean / downside_dev * math.sqrt(periods_per_year) if downside_dev > 0 else 0.0
    peak = equities[0]
    max_dd = 0.0
    for value in equities:
        peak = max(peak, value)
        if peak > 0:
            max_dd = min(max_dd, value / peak - 1)
    total_return = equities[-1] / initial_capital - 1 if initial_capital > 0 else 0.0
    n = max(1, len(returns))
    annualized = (
        (equities[-1] / initial_capital) ** (periods_per_year / n) - 1
        if equities[-1] > 0 and initial_capital > 0
        else -1.0
    )
    return {
        "totalReturn": round(total_return, 6),
        "annualizedReturn": round(annualized, 6),
        "sharpe": round(sharpe, 4),
        "sortino": round(sortino, 4),
        "maxDrawdown": round(max_dd, 6),
        "volatility": round(stdev * math.sqrt(periods_per_year), 6),
        "observations": len(equities),
    }


def _downsample(points: Sequence[Any], target: int) -> List[Any]:
    if target <= 0 or len(points) <= target:
        return list(points)
    step = len(points) / target
    sampled = [points[int(i * step)] for i in range(target)]
    if sampled[-1] is not points[-1]:
        sampled[-1] = points[-1]
    return sampled


class PaperTradingDaemon:
    """Thread-safe local crypto paper-trading simulator."""

    def __init__(
        self,
        *,
        state_dir: Optional[str] = None,
        safe_print: Callable[[str], None] = print,
        session: Optional[requests.Session] = None,
    ):
        base_dir = state_dir or os.environ.get("ALPHALAB_CRYPTO_SIM_DIR") or os.path.dirname(os.path.abspath(__file__))
        self.state_path = os.path.join(base_dir, STATE_FILENAME)
        self.ml_path = os.path.join(base_dir, ML_FILENAME)
        self.safe_print = safe_print
        self.session = session or requests.Session()
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._bars_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._ml_models: Dict[str, crypto_ml.MlpModel] = {}
        self._ml_meta: Dict[str, Dict[str, Any]] = {}
        self.state = self._load_state()
        self._load_ml()

    # ------------------------------------------------------------------ state
    def _default_state(self) -> Dict[str, Any]:
        now = _iso()
        return {
            "version": SIM_VERSION,
            "createdAt": now,
            "updatedAt": now,
            "config": json.loads(json.dumps(DEFAULT_SIM_CONFIG)),
            "account": {
                "cash": DEFAULT_SIM_CONFIG["initialCapital"],
                "initialCapital": DEFAULT_SIM_CONFIG["initialCapital"],
                "positions": {},
            },
            "benchmark": {"initialPrices": {}, "capital": DEFAULT_SIM_CONFIG["initialCapital"]},
            "lastBarTime": {},
            "equityCurve": [],
            "benchmarkCurve": [],
            "trades": [],
            "decisions": [],
            "errors": [],
            "status": {
                "running": False,
                "lastCycleAt": None,
                "lastCycleDurationMs": None,
                "cycleCount": 0,
                "lastError": None,
                "nextRunAt": None,
                "startedAt": None,
            },
            "ml": {},
        }

    def _load_state(self) -> Dict[str, Any]:
        try:
            with open(self.state_path, "r", encoding="utf-8") as handle:
                raw = json.load(handle)
            if not isinstance(raw, Mapping):
                raise ValueError("state must be an object")
            state = self._default_state()
            for key in state:
                if key in raw:
                    state[key] = raw[key]
            merged_config = json.loads(json.dumps(DEFAULT_SIM_CONFIG))
            saved_config = raw.get("config")
            if isinstance(saved_config, Mapping):
                for key in merged_config:
                    if key in saved_config:
                        merged_config[key] = saved_config[key]
            state["config"] = merged_config
            return state
        except FileNotFoundError:
            return self._default_state()
        except Exception as exc:
            self.safe_print(f"[CryptoSim] state file unreadable ({exc}); starting fresh")
            try:
                os.replace(self.state_path, self.state_path + ".corrupt")
            except OSError:
                pass
            return self._default_state()

    def _persist(self) -> None:
        with self._lock:
            self.state["updatedAt"] = _iso()
            payload = json.dumps(self.state, separators=(",", ":"))
        directory = os.path.dirname(self.state_path) or "."
        fd, tmp_path = tempfile.mkstemp(prefix=".crypto_sim_", dir=directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(tmp_path, self.state_path)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _load_ml(self) -> None:
        try:
            with open(self.ml_path, "r", encoding="utf-8") as handle:
                raw = json.load(handle)
            for symbol, payload in (raw.get("models") or {}).items():
                try:
                    self._ml_models[symbol] = crypto_ml.MlpModel.from_dict(payload)
                    self._ml_meta[symbol] = dict(raw.get("meta", {}).get(symbol) or {})
                except Exception as exc:
                    self.safe_print(f"[CryptoSim] discarding saved ML model for {symbol}: {exc}")
        except FileNotFoundError:
            pass
        except Exception as exc:
            self.safe_print(f"[CryptoSim] ML store unreadable ({exc}); models will retrain")

    def _persist_ml(self) -> None:
        with self._lock:
            payload = {
                "models": {symbol: model.to_dict() for symbol, model in self._ml_models.items()},
                "meta": self._ml_meta,
                "updatedAt": _iso(),
            }
        directory = os.path.dirname(self.ml_path) or "."
        fd, tmp_path = tempfile.mkstemp(prefix=".crypto_sim_ml_", dir=directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
            os.replace(tmp_path, self.ml_path)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    # ------------------------------------------------------------- market data
    def _fetch_bars(self, symbol: str, minimum_bars: int) -> List[Dict[str, Any]]:
        """Fetch ascending completed hourly bars from the keyless crypto feed."""

        span_hours = minimum_bars + 24
        start = _utc_now() - timedelta(hours=span_hours + MAX_GAP_FILL_BARS)
        collected: List[Dict[str, Any]] = []
        page_token: Optional[str] = None
        for _ in range(12):
            params: Dict[str, Any] = {
                "symbols": symbol,
                "timeframe": "1Hour",
                "limit": 1000,
                "start": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            if page_token:
                params["page_token"] = page_token
            response = self.session.get(
                f"{DATA_BASE_URL}/v1beta3/crypto/us/bars",
                params=params,
                timeout=FETCH_TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                raise CryptoSimError(
                    f"crypto data feed returned HTTP {response.status_code}",
                    status=502,
                    code="data_feed_error",
                )
            data = response.json() if response.content else {}
            rows = ((data or {}).get("bars") or {}).get(symbol) or []
            for raw in rows:
                stamp = _parse_iso(raw.get("t"))
                if stamp is None:
                    continue
                collected.append(
                    {
                        "timestamp": stamp,
                        "open": _number(raw.get("o")),
                        "high": _number(raw.get("h")),
                        "low": _number(raw.get("l")),
                        "close": _number(raw.get("c")),
                        "volume": max(0.0, _number(raw.get("v"))),
                    }
                )
            page_token = (data or {}).get("next_page_token")
            if not page_token:
                break
        collected.sort(key=lambda row: row["timestamp"])
        # Drop the still-forming bar: a bar stamped T covers [T, T+1h).
        cutoff = _utc_now() - timedelta(hours=1)
        completed = [row for row in collected if row["timestamp"] <= cutoff]
        completed = self._fill_small_gaps(completed)
        if len(completed) < minimum_bars:
            raise CryptoSimError(
                f"only {len(completed)} completed bars available for {symbol}, need {minimum_bars}",
                status=503,
                code="insufficient_history",
            )
        return completed[-minimum_bars:]

    @staticmethod
    def _fill_small_gaps(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Carry-forward fill for isolated missing hourly aggregates.

        The engine fails closed on discontinuous bars.  Alpaca's crypto feed
        very occasionally omits a quiet hour; a zero-volume synthetic bar at
        the prior close is disclosed and less misleading than dropping the
        whole cycle.  Long outages still surface as errors.
        """

        if len(rows) < 2:
            return rows
        repaired: List[Dict[str, Any]] = [rows[0]]
        for row in rows[1:]:
            previous = repaired[-1]
            gap_hours = int((row["timestamp"] - previous["timestamp"]).total_seconds() // 3600) - 1
            if 0 < gap_hours <= MAX_GAP_FILL_BARS:
                for step in range(1, gap_hours + 1):
                    close = previous["close"]
                    repaired.append(
                        {
                            "timestamp": previous["timestamp"] + timedelta(hours=step),
                            "open": close, "high": close, "low": close, "close": close,
                            "volume": 0.0, "synthetic": True,
                        }
                    )
            repaired.append(row)
        return repaired

    # ------------------------------------------------------------------ account
    def _strategy_config(self) -> Dict[str, Any]:
        with self._lock:
            overrides = dict(self.state["config"].get("strategy") or {})
            symbols = list(self.state["config"].get("symbols") or SIM_SYMBOLS)
            fee_bps = _number(self.state["config"].get("feeBps"), 25.0)
            slip_bps = _number(self.state["config"].get("slippageBps"), 5.0)
        merged = dict(overrides)
        merged["symbols"] = symbols
        merged["fee_bps"] = fee_bps
        merged["slippage_bps"] = slip_bps
        return validate_engine_config(merged)

    def _mark_equity(self, prices: Mapping[str, float]) -> float:
        with self._lock:
            account = self.state["account"]
            total = _number(account.get("cash"))
            for symbol, position in (account.get("positions") or {}).items():
                price = _number(prices.get(symbol))
                if price <= 0:
                    price = _number(position.get("lastPrice"))
                total += _number(position.get("qty")) * price
            return total

    def _position_weight(self, symbol: str, price: float, equity: float) -> float:
        with self._lock:
            position = (self.state["account"].get("positions") or {}).get(symbol) or {}
        value = _number(position.get("qty")) * price
        return value / equity if equity > 0 else 0.0

    def _risk_state(self, latest_bar_time: datetime) -> Dict[str, Any]:
        with self._lock:
            curve = self.state["equityCurve"]
            initial = _number(self.state["account"].get("initialCapital"), 1.0)
        equities = [_number(point[1]) for point in curve[-24 * 8 :]]
        if not equities:
            return {"daily_return": 0.0, "seven_day_return": 0.0, "drawdown": 0.0, "last_bar_time": latest_bar_time}
        current = equities[-1]
        day_base = equities[-min(len(equities), 25)]
        week_base = equities[-min(len(equities), 24 * 7 + 1)]
        peak = max(max(equities), initial)
        return {
            "daily_return": current / day_base - 1 if day_base > 0 else 0.0,
            "seven_day_return": current / week_base - 1 if week_base > 0 else 0.0,
            "drawdown": current / peak - 1 if peak > 0 else 0.0,
            "last_bar_time": latest_bar_time,
        }

    def _execute(
        self,
        symbol: str,
        action: str,
        target_weight: float,
        stop_distance_pct: Optional[float],
        fill_price: float,
        bar_time: datetime,
        equity: float,
        *,
        source: str,
    ) -> Optional[Dict[str, Any]]:
        cfg = self.state["config"]
        fee_rate = _number(cfg.get("feeBps"), 25.0) / 10_000.0
        slip_rate = _number(cfg.get("slippageBps"), 5.0) / 10_000.0
        with self._lock:
            account = self.state["account"]
            positions = account.setdefault("positions", {})
            position = positions.get(symbol) or {
                "qty": 0.0, "avgEntry": None, "lastPrice": fill_price,
                "positionState": {"last_add_price": None, "protective_stop": None},
            }
            qty = _number(position.get("qty"))
            current_value = qty * fill_price
            target_value = max(0.0, target_weight) * equity
            delta = target_value - current_value
            trade: Optional[Dict[str, Any]] = None

            if action in {"BUY", "ADD"} and delta > MIN_ORDER_NOTIONAL:
                execution_price = fill_price * (1 + slip_rate)
                affordable = max(0.0, _number(account.get("cash")) / (1 + fee_rate))
                gross = min(delta, affordable)
                if gross > MIN_ORDER_NOTIONAL:
                    acquired = gross / execution_price
                    fee = gross * fee_rate
                    prior_cost = qty * _number(position.get("avgEntry")) if qty > 0 and position.get("avgEntry") else 0.0
                    account["cash"] = _number(account.get("cash")) - gross - fee
                    qty += acquired
                    position["qty"] = qty
                    position["avgEntry"] = (prior_cost + acquired * execution_price) / qty
                    position["positionState"] = apply_fill_to_position_state(
                        position.get("positionState"),
                        action=action,
                        fill_price=execution_price,
                        stop_distance_pct=stop_distance_pct or 0.05,
                        remaining_position=True,
                    )
                    trade = {
                        "side": "buy", "action": action, "grossNotional": round(gross, 2),
                        "fee": round(fee, 4), "qty": acquired, "price": round(execution_price, 2),
                    }
            elif action in {"REDUCE", "EXIT"} and qty > 0 and (delta < -MIN_ORDER_NOTIONAL or action == "EXIT"):
                execution_price = fill_price * (1 - slip_rate)
                if action == "EXIT":
                    units_to_sell = qty
                else:
                    units_to_sell = min(qty, abs(delta) / execution_price)
                gross = units_to_sell * execution_price
                if gross > MIN_ORDER_NOTIONAL or action == "EXIT":
                    fee = gross * fee_rate
                    account["cash"] = _number(account.get("cash")) + gross - fee
                    qty -= units_to_sell
                    remaining = qty > 1e-12
                    avg_entry = _number(position.get("avgEntry"))
                    realized = (execution_price - avg_entry) * units_to_sell if avg_entry > 0 else 0.0
                    position["qty"] = max(0.0, qty)
                    position["positionState"] = apply_fill_to_position_state(
                        position.get("positionState"),
                        action=action,
                        fill_price=execution_price,
                        remaining_position=remaining,
                    )
                    if not remaining:
                        position["avgEntry"] = None
                    trade = {
                        "side": "sell", "action": action, "grossNotional": round(gross, 2),
                        "fee": round(fee, 4), "qty": units_to_sell, "price": round(execution_price, 2),
                        "realizedPnl": round(realized - gross * fee_rate, 2),
                    }

            position["lastPrice"] = fill_price
            positions[symbol] = position
            if trade is not None:
                trade.update({
                    "symbol": symbol,
                    "timestamp": _iso(bar_time),
                    "recordedAt": _iso(),
                    "source": source,
                    "equityAfter": None,  # filled by caller after the mark
                })
                trades = self.state["trades"]
                trades.append(trade)
                if len(trades) > MAX_TRADES:
                    del trades[: len(trades) - MAX_TRADES]
            return trade

    def _touch_price(self, symbol: str, price: float) -> None:
        """Refresh the mark price of an open position on non-trading bars."""

        if price <= 0:
            return
        with self._lock:
            position = (self.state["account"].get("positions") or {}).get(symbol)
            if position is not None:
                position["lastPrice"] = float(price)

    def _persist_trailing_stop(self, symbol: str, signal: Mapping[str, Any]) -> None:
        returned = signal.get("position_state")
        if not isinstance(returned, Mapping):
            return
        new_stop = returned.get("protective_stop")
        if new_stop is None:
            return
        with self._lock:
            position = (self.state["account"].get("positions") or {}).get(symbol)
            if not position or _number(position.get("qty")) <= 0:
                return
            stored = position.setdefault("positionState", {})
            previous = stored.get("protective_stop")
            if previous is None or float(new_stop) > float(previous):
                stored["protective_stop"] = float(new_stop)

    # ---------------------------------------------------------------- ML logic
    def _ml_ready(self, symbol: str, now: datetime) -> bool:
        meta = self._ml_meta.get(symbol) or {}
        trained_at = _parse_iso(meta.get("trainedAt"))
        retrain_hours = _number(self.state["config"].get("mlRetrainHours"), 24.0)
        return (
            symbol in self._ml_models
            and trained_at is not None
            and (now - trained_at) < timedelta(hours=max(1.0, retrain_hours))
        )

    def train_ml(self, symbol: str, *, force: bool = False) -> Dict[str, Any]:
        now = _utc_now()
        if not force and self._ml_ready(symbol, now):
            return dict(self._ml_meta.get(symbol) or {})
        cfg = self._strategy_config()
        history_days = int(_number(self.state["config"].get("mlHistoryDays"), 90))
        bars_needed = max(required_history_bars(cfg) + 48, history_days * 24)
        bars = self._fetch_bars(symbol, bars_needed)
        result = crypto_ml.train_direction_model(bars, cfg)
        model = result["model"]
        meta = {
            "trainedAt": _iso(now),
            "symbol": symbol,
            "summary": result["summary"],
            "dataset": result["dataset"],
            "modelVersion": f"{crypto_ml.MODEL_FAMILY}/{crypto_ml.MODEL_VERSION}",
        }
        with self._lock:
            self._ml_models[symbol] = model
            self._ml_meta[symbol] = meta
            self.state["ml"][symbol] = meta
        self._persist_ml()
        self._persist()
        return meta

    def _ml_signal_for(self, symbol: str, bars: Sequence[Mapping[str, Any]], cfg: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
        if not bool(self.state["config"].get("mlEnabled", True)):
            return None
        model = self._ml_models.get(symbol)
        if model is None:
            return None
        try:
            return crypto_ml.latest_probability(bars, model, cfg)
        except Exception as exc:
            self._record_error(f"ML inference failed for {symbol}: {exc}")
            return None

    # ------------------------------------------------------------------- cycle
    def _record_error(self, message: str) -> None:
        with self._lock:
            errors = self.state["errors"]
            errors.append({"at": _iso(), "message": str(message)[:400]})
            if len(errors) > MAX_ERRORS:
                del errors[: len(errors) - MAX_ERRORS]
            self.state["status"]["lastError"] = str(message)[:400]

    def _record_decision(self, symbol: str, signal: Mapping[str, Any], *, source: str, executed: Optional[Mapping[str, Any]]) -> None:
        ensemble = signal.get("ensemble") or {}
        record = {
            "timestamp": signal.get("timestamp"),
            "recordedAt": _iso(),
            "symbol": symbol,
            "action": signal.get("action"),
            "regime": signal.get("regime"),
            "score": signal.get("score"),
            "targetWeight": signal.get("target_weight"),
            "price": signal.get("price"),
            "reasons": list(signal.get("reasons") or [])[:8],
            "ensemble": {
                "composite": ensemble.get("composite"),
                "votes": ensemble.get("votes"),
                "weights": ensemble.get("weights"),
                "ml": ensemble.get("ml"),
            } if ensemble else None,
            "source": source,
            "executed": bool(executed),
        }
        with self._lock:
            decisions = self.state["decisions"]
            decisions.append(record)
            if len(decisions) > MAX_DECISIONS:
                del decisions[: len(decisions) - MAX_DECISIONS]

    def _append_curves(self, bar_time: datetime, prices: Mapping[str, float]) -> None:
        equity = self._mark_equity(prices)
        with self._lock:
            benchmark = self.state["benchmark"]
            initial_prices = benchmark.get("initialPrices") or {}
            missing = [s for s in self.state["config"]["symbols"] if s not in initial_prices and _number(prices.get(s)) > 0]
            for symbol in missing:
                initial_prices[symbol] = _number(prices.get(symbol))
            benchmark["initialPrices"] = initial_prices
            bench_equity = None
            valid = [s for s in self.state["config"]["symbols"] if _number(initial_prices.get(s)) > 0 and _number(prices.get(s)) > 0]
            if valid:
                capital = _number(benchmark.get("capital"), _number(self.state["account"].get("initialCapital")))
                bench_equity = capital * sum(
                    _number(prices.get(s)) / _number(initial_prices.get(s)) for s in valid
                ) / len(valid)
            stamp = _iso(bar_time)

            def upsert(points: List[Any], value: float) -> None:
                # Symbols are processed sequentially, so a replayed timestamp
                # may arrive after a *newer* stamp was already appended by the
                # previous symbol.  Update the matching point in place instead
                # of appending out of order; a bounded backward scan is enough
                # because replay windows are short.
                for offset in range(1, min(len(points), 96) + 1):
                    existing = points[-offset]
                    if existing[0] == stamp:
                        existing[1] = round(value, 2)
                        return
                    if existing[0] < stamp:
                        points.insert(len(points) - offset + 1, [stamp, round(value, 2)])
                        break
                else:
                    points.insert(0, [stamp, round(value, 2)])
                if len(points) > MAX_EQUITY_POINTS:
                    del points[: len(points) - MAX_EQUITY_POINTS]

            upsert(self.state["equityCurve"], equity)
            if bench_equity is not None:
                upsert(self.state["benchmarkCurve"], bench_equity)
            if self.state["trades"]:
                last_trade = self.state["trades"][-1]
                if last_trade.get("equityAfter") is None:
                    last_trade["equityAfter"] = round(equity, 2)

    def run_cycle(self, *, source: str = "scheduler") -> Dict[str, Any]:
        """Process every newly completed hourly bar for every symbol."""

        started = time.time()
        cfg = self._strategy_config()
        needed = required_history_bars(cfg) + 4
        results: Dict[str, Any] = {"processedBars": 0, "trades": 0, "symbols": {}}
        latest_prices: Dict[str, float] = {}
        latest_time: Optional[datetime] = None

        for symbol in cfg["symbols"]:
            try:
                bars = self._fetch_bars(symbol, needed)
            except Exception as exc:
                self._record_error(f"data fetch failed for {symbol}: {exc}")
                results["symbols"][symbol] = {"error": str(exc)[:200]}
                continue
            self._bars_cache[symbol] = bars
            with self._lock:
                last_processed = _parse_iso((self.state["lastBarTime"] or {}).get(symbol))
            new_indices = [
                i for i, bar in enumerate(bars)
                if last_processed is None or bar["timestamp"] > last_processed
            ]
            # Never replay the entire fetched window on a fresh account —
            # the simulation starts "now" and earns its history honestly.
            if last_processed is None:
                new_indices = new_indices[-1:]

            symbol_result = {"newBars": len(new_indices), "actions": []}
            for position_in_list in new_indices:
                bar = bars[position_in_list]
                is_latest = position_in_list == len(bars) - 1
                window = bars[: position_in_list + 1]
                if len(window) < needed - 4:
                    continue
                try:
                    ml_signal = self._ml_signal_for(symbol, window, cfg) if is_latest else None
                    equity_before = self._mark_equity({symbol: bar["close"], **latest_prices})
                    with self._lock:
                        position = (self.state["account"].get("positions") or {}).get(symbol) or {}
                    weight = self._position_weight(symbol, bar["close"], equity_before)
                    signal = generate_signal(
                        window,
                        cfg,
                        position={
                            "weight": weight,
                            "average_entry_price": position.get("avgEntry"),
                            "position_state": position.get("positionState"),
                        },
                        risk_state=self._risk_state(bar["timestamp"]),
                        now=bar["timestamp"] + timedelta(hours=1),
                        ml_signal=ml_signal,
                    )
                    action = signal.get("action") or "HOLD"
                    executed = None
                    if action in {"BUY", "ADD", "REDUCE", "EXIT"}:
                        if is_latest:
                            fill_price = float(bar["close"])
                        else:
                            next_bar = bars[position_in_list + 1]
                            fill_price = float(next_bar["open"])
                        executed = self._execute(
                            symbol,
                            action,
                            _number(signal.get("target_weight")),
                            signal.get("stop_distance_pct"),
                            fill_price,
                            bar["timestamp"],
                            equity_before,
                            source="replay" if not is_latest else source,
                        )
                        if executed:
                            results["trades"] += 1
                            symbol_result["actions"].append({"action": action, "at": _iso(bar["timestamp"])})
                    else:
                        self._persist_trailing_stop(symbol, signal)
                    self._touch_price(symbol, float(bar["close"]))
                    self._record_decision(
                        symbol, signal,
                        source="replay" if not is_latest else source,
                        executed=executed,
                    )
                    latest_prices[symbol] = float(bar["close"])
                    latest_time = bar["timestamp"] if latest_time is None or bar["timestamp"] > latest_time else latest_time
                    self._append_curves(bar["timestamp"], {**latest_prices})
                    with self._lock:
                        self.state["lastBarTime"][symbol] = _iso(bar["timestamp"])
                    results["processedBars"] += 1
                except CryptoEngineError as exc:
                    self._record_error(f"signal failed for {symbol}: {exc}")
                    symbol_result["error"] = str(exc)[:200]
                    break
            if not new_indices and bars:
                latest_prices[symbol] = float(bars[-1]["close"])
            results["symbols"][symbol] = symbol_result

        # ML housekeeping: retrain at most one symbol per cycle to bound time.
        if bool(self.state["config"].get("mlEnabled", True)):
            now = _utc_now()
            for symbol in cfg["symbols"]:
                if not self._ml_ready(symbol, now):
                    try:
                        self.train_ml(symbol)
                    except Exception as exc:
                        self._record_error(f"ML training failed for {symbol}: {exc}")
                    break

        duration_ms = int((time.time() - started) * 1000)
        with self._lock:
            status = self.state["status"]
            status["lastCycleAt"] = _iso()
            status["lastCycleDurationMs"] = duration_ms
            status["cycleCount"] = int(status.get("cycleCount") or 0) + 1
            interval = max(1, int(_number(self.state["config"].get("intervalMinutes"), 5)))
            status["nextRunAt"] = _iso(_utc_now() + timedelta(minutes=interval))
            if results["processedBars"] > 0 or results["trades"] > 0:
                status["lastError"] = None
        self._persist()
        results["durationMs"] = duration_ms
        return results

    # ------------------------------------------------------------------ thread
    def _loop(self) -> None:
        self.safe_print("[CryptoSim] 24/7 paper-trading daemon thread started")
        while not self._stop.is_set():
            enabled = bool(self.state["config"].get("enabled"))
            interval = max(1, int(_number(self.state["config"].get("intervalMinutes"), 5)))
            if enabled:
                try:
                    self.run_cycle()
                except Exception as exc:
                    self._record_error(f"cycle crashed safely: {exc}")
                    try:
                        self._persist()
                    except Exception:
                        pass
            self._wake.wait(timeout=interval * 60)
            self._wake.clear()

    def ensure_thread(self) -> None:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._stop.clear()
                self._thread = threading.Thread(
                    target=self._loop, name="alphalab-crypto-sim", daemon=True
                )
                self._thread.start()

    def stop_thread(self) -> None:
        self._stop.set()
        self._wake.set()

    # ------------------------------------------------------------------ control
    def start(self) -> Dict[str, Any]:
        with self._lock:
            self.state["config"]["enabled"] = True
            self.state["status"]["running"] = True
            if not self.state["status"].get("startedAt"):
                self.state["status"]["startedAt"] = _iso()
        self._persist()
        self.ensure_thread()
        self._wake.set()
        return self.status_snapshot()

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            self.state["config"]["enabled"] = False
            self.state["status"]["running"] = False
        self._persist()
        return self.status_snapshot()

    def reset(self, initial_capital: Optional[float] = None) -> Dict[str, Any]:
        with self._lock:
            config = json.loads(json.dumps(self.state["config"]))
            if initial_capital is not None:
                capital = _number(initial_capital, DEFAULT_SIM_CONFIG["initialCapital"])
                if not 1_000.0 <= capital <= 10_000_000.0:
                    raise CryptoSimError("initialCapital must be between 1,000 and 10,000,000")
                config["initialCapital"] = capital
            fresh = self._default_state()
            fresh["config"] = config
            fresh["config"]["enabled"] = False
            fresh["account"]["cash"] = config["initialCapital"]
            fresh["account"]["initialCapital"] = config["initialCapital"]
            fresh["benchmark"]["capital"] = config["initialCapital"]
            self.state = fresh
        self._persist()
        return self.status_snapshot()

    def update_config(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, Mapping):
            raise CryptoSimError("config payload must be an object")
        allowed = {"intervalMinutes", "mlEnabled", "mlRetrainHours", "mlHistoryDays", "strategy", "symbols"}
        unknown = sorted(set(payload) - allowed)
        if unknown:
            raise CryptoSimError(f"unsupported sim config fields: {', '.join(unknown)}")
        with self._lock:
            config = self.state["config"]
            if "intervalMinutes" in payload:
                interval = int(_number(payload.get("intervalMinutes"), 5))
                if interval not in {1, 5, 15, 30, 60}:
                    raise CryptoSimError("intervalMinutes must be 1, 5, 15, 30, or 60")
                config["intervalMinutes"] = interval
            if "mlEnabled" in payload:
                config["mlEnabled"] = bool(payload.get("mlEnabled"))
            if "mlRetrainHours" in payload:
                hours = int(_number(payload.get("mlRetrainHours"), 24))
                if not 1 <= hours <= 24 * 7:
                    raise CryptoSimError("mlRetrainHours must be between 1 and 168")
                config["mlRetrainHours"] = hours
            if "mlHistoryDays" in payload:
                days = int(_number(payload.get("mlHistoryDays"), 150))
                if not 90 <= days <= 365:
                    raise CryptoSimError("mlHistoryDays must be between 90 and 365")
                config["mlHistoryDays"] = days
            if "symbols" in payload:
                symbols = [str(s).strip().upper() for s in (payload.get("symbols") or [])]
                if not symbols or any(s not in SIM_SYMBOLS for s in symbols):
                    raise CryptoSimError("symbols may only include BTC/USD and ETH/USD")
                config["symbols"] = symbols
            if "strategy" in payload:
                overrides = payload.get("strategy")
                if not isinstance(overrides, Mapping):
                    raise CryptoSimError("strategy overrides must be an object")
                candidate = dict(overrides)
                candidate["symbols"] = config["symbols"]
                try:
                    validate_engine_config(candidate)
                except CryptoEngineError as exc:
                    raise CryptoSimError(f"invalid strategy override: {exc}")
                config["strategy"] = dict(overrides)
        self._persist()
        return self.status_snapshot()

    # ------------------------------------------------------------------- views
    def status_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            config = json.loads(json.dumps(self.state["config"]))
            status = dict(self.state["status"])
            account = json.loads(json.dumps(self.state["account"]))
            curve = list(self.state["equityCurve"])
            bench = list(self.state["benchmarkCurve"])
            ml_meta = json.loads(json.dumps(self.state.get("ml") or {}))
            trades = list(self.state["trades"])
            decisions = list(self.state["decisions"])
            errors = list(self.state["errors"])[-5:]
            last_bar_time = dict(self.state.get("lastBarTime") or {})
        initial = _number(account.get("initialCapital"), 1.0)
        equity = _number(curve[-1][1]) if curve else initial
        performance = _performance_from_curve(curve, initial)
        benchmark_perf = _performance_from_curve(bench, initial) if bench else None
        positions_view = []
        for symbol, position in (account.get("positions") or {}).items():
            qty = _number(position.get("qty"))
            if qty <= 0:
                continue
            price = _number(position.get("lastPrice"))
            value = qty * price
            avg_entry = _number(position.get("avgEntry"))
            positions_view.append(
                {
                    "symbol": symbol,
                    "qty": round(qty, 8),
                    "avgEntry": round(avg_entry, 2) if avg_entry > 0 else None,
                    "lastPrice": round(price, 2) if price > 0 else None,
                    "marketValue": round(value, 2),
                    "unrealizedPnl": round((price - avg_entry) * qty, 2) if avg_entry > 0 and price > 0 else None,
                    "unrealizedPnlPct": round((price / avg_entry - 1) * 100, 3) if avg_entry > 0 and price > 0 else None,
                    "weight": round(value / equity, 4) if equity > 0 else 0.0,
                    "protectiveStop": (position.get("positionState") or {}).get("protective_stop"),
                }
            )
        win_trades = [t for t in trades if t.get("side") == "sell" and _number(t.get("realizedPnl")) > 0]
        sell_trades = [t for t in trades if t.get("side") == "sell"]
        return {
            "version": SIM_VERSION,
            "running": bool(config.get("enabled")),
            "threadAlive": self._thread.is_alive() if self._thread else False,
            "config": config,
            "status": status,
            "account": {
                "cash": round(_number(account.get("cash")), 2),
                "initialCapital": round(initial, 2),
                "equity": round(equity, 2),
                "positions": positions_view,
            },
            "performance": performance,
            "benchmark": benchmark_perf,
            "tradeCount": len(trades),
            "sellTradeCount": len(sell_trades),
            "sellWinRate": round(len(win_trades) / len(sell_trades), 4) if sell_trades else None,
            "lastBarTime": last_bar_time,
            "latestDecisions": decisions[-8:][::-1],
            "recentTrades": trades[-8:][::-1],
            "recentErrors": errors[::-1],
            "ml": ml_meta,
            "equityCurve": _downsample(curve, 600),
            "benchmarkCurve": _downsample(bench, 600),
        }

    def trades_view(self, limit: int = 100) -> Dict[str, Any]:
        with self._lock:
            trades = list(self.state["trades"])
            decisions = list(self.state["decisions"])
        limit = max(1, min(500, int(limit)))
        return {
            "trades": trades[-limit:][::-1],
            "decisions": decisions[-limit:][::-1],
            "totalTrades": len(trades),
        }

    def equity_view(self, points: int = 1000) -> Dict[str, Any]:
        with self._lock:
            curve = list(self.state["equityCurve"])
            bench = list(self.state["benchmarkCurve"])
            initial = _number(self.state["account"].get("initialCapital"), 1.0)
        points = max(10, min(5000, int(points)))
        return {
            "equityCurve": _downsample(curve, points),
            "benchmarkCurve": _downsample(bench, points),
            "performance": _performance_from_curve(curve, initial),
            "points": len(curve),
        }

    def research_backtest(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        symbol = str(payload.get("symbol") or "BTC/USD").strip().upper()
        if symbol not in SIM_SYMBOLS:
            raise CryptoSimError("symbol must be BTC/USD or ETH/USD")
        days = int(_number(payload.get("days"), 180))
        if not 30 <= days <= 365:
            raise CryptoSimError("days must be between 30 and 365")
        use_ml = bool(payload.get("useMl"))
        initial_capital = _number(payload.get("initialCapital"), 10_000.0)
        if not 100.0 <= initial_capital <= 10_000_000.0:
            raise CryptoSimError("initialCapital must be between 100 and 10,000,000")
        cfg = self._strategy_config()
        if symbol not in cfg["symbols"]:
            merged = dict(cfg)
            merged["symbols"] = list(SIM_SYMBOLS)
            cfg = validate_engine_config(merged)
        # ``days`` measures the *evaluated* span; indicator warm-up history is
        # fetched on top of it so short requests still evaluate a full window.
        bars_needed = days * 24 + required_history_bars(cfg) + 24
        bars = self._fetch_bars(symbol, bars_needed)
        ml_series = None
        ml_report: Optional[Dict[str, Any]] = None
        if use_ml:
            try:
                wf = crypto_ml.walk_forward_probabilities(bars, cfg)
                ml_series = wf["probabilities"]
                ml_report = {
                    "foldMetrics": wf["fold_metrics"],
                    "oosAuc": wf["oos_auc"],
                    "coverage": wf["coverage"],
                    "deadbandBps": wf["deadband_bps"],
                }
            except crypto_ml.CryptoMlError as exc:
                ml_report = {"error": str(exc)}
        result = engine_backtest(
            bars, cfg, symbol=symbol, initial_capital=initial_capital, ml_series=ml_series
        )
        curve_points = list(zip(result["timestamps"], result["equity_curve"]))
        bench_points = list(zip(result["benchmark"]["timestamps"], result["benchmark"]["equity_curve"]))
        return {
            "algorithm": result["algorithm"],
            "version": result["version"],
            "symbol": symbol,
            "from": result["from"],
            "to": result["to"],
            "timeframe": result["timeframe"],
            "metrics": result["metrics"],
            "benchmarkMetrics": result["benchmark"]["metrics"],
            "equityCurve": _downsample(curve_points, 800),
            "benchmarkCurve": _downsample(bench_points, 800),
            "regimeStats": result["regime_stats"],
            "tradeStats": {k: v for k, v in result["trade_stats"].items() if k != "trips"},
            "monthlyReturns": result["monthly_returns"],
            "recentFills": result["fills"][-40:],
            "mlUsed": bool(ml_series),
            "mlReport": ml_report,
            "dataBars": len(bars),
        }


# ----------------------------------------------------------------- blueprint
_DAEMON_SINGLETON: Optional[PaperTradingDaemon] = None


def get_daemon(**kwargs: Any) -> PaperTradingDaemon:
    global _DAEMON_SINGLETON
    if _DAEMON_SINGLETON is None:
        _DAEMON_SINGLETON = PaperTradingDaemon(**kwargs)
    return _DAEMON_SINGLETON


def register_crypto_paper_api(
    app,
    *,
    require_auth: Callable[[], Any],
    safe_print: Callable[[str], None] = print,
    state_dir: Optional[str] = None,
):
    """Register the local paper-trading blueprint and start its daemon thread.

    The simulator is machine-local and broker-independent: one shared account
    per backend installation, guarded by the same authentication used for
    every other crypto route.
    """

    existing = app.extensions.get("alphalab_crypto_sim")
    if existing:
        return existing

    daemon = get_daemon(safe_print=safe_print, state_dir=state_dir)
    blueprint = Blueprint("crypto_paper_api", __name__)

    def _authenticated() -> None:
        user = require_auth()
        if not isinstance(user, Mapping) or not str(user.get("id") or "").strip():
            raise CryptoSimError("Authentication required", status=401, code="authentication_required")

    def ok(payload: Mapping[str, Any], status: int = 200):
        return jsonify(dict(payload)), status

    def fail(exc: Exception):
        if isinstance(exc, CryptoSimError):
            return ok({"success": False, "reason": exc.code, "message": str(exc)}, exc.status)
        safe_print(f"[CryptoSim] unexpected error: {type(exc).__name__}: {exc}")
        return ok({"success": False, "reason": "crypto_sim_internal_error", "message": "Simulator request failed safely."}, 500)

    def json_object() -> Dict[str, Any]:
        data = request.get_json(silent=True)
        if isinstance(data, Mapping):
            return dict(data)
        return {}

    @blueprint.get("/api/crypto/sim/overview")
    def sim_overview():
        try:
            _authenticated()
            return ok({"success": True, **daemon.status_snapshot()})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/start")
    def sim_start():
        try:
            _authenticated()
            snapshot = daemon.start()
            return ok({"success": True, **snapshot})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/stop")
    def sim_stop():
        try:
            _authenticated()
            return ok({"success": True, **daemon.stop()})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/reset")
    def sim_reset():
        try:
            _authenticated()
            body = json_object()
            if not body.get("confirm"):
                raise CryptoSimError("reset requires {\"confirm\": true}", code="confirmation_required")
            snapshot = daemon.reset(body.get("initialCapital"))
            return ok({"success": True, **snapshot})
        except Exception as exc:
            return fail(exc)

    @blueprint.put("/api/crypto/sim/config")
    def sim_config():
        try:
            _authenticated()
            snapshot = daemon.update_config(json_object())
            return ok({"success": True, **snapshot})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/run-cycle")
    def sim_run_cycle():
        try:
            _authenticated()
            result = daemon.run_cycle(source="manual")
            return ok({"success": True, "result": result, **daemon.status_snapshot()})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/train")
    def sim_train():
        try:
            _authenticated()
            body = json_object()
            symbol = str(body.get("symbol") or "").strip().upper()
            symbols = [symbol] if symbol else list(daemon.state["config"]["symbols"])
            reports = {}
            for entry in symbols:
                if entry not in SIM_SYMBOLS:
                    raise CryptoSimError("symbol must be BTC/USD or ETH/USD")
                reports[entry] = daemon.train_ml(entry, force=True)
            return ok({"success": True, "models": reports})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/sim/trades")
    def sim_trades():
        try:
            _authenticated()
            limit = int(_number(request.args.get("limit"), 100))
            return ok({"success": True, **daemon.trades_view(limit)})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/crypto/sim/equity")
    def sim_equity():
        try:
            _authenticated()
            points = int(_number(request.args.get("points"), 1000))
            return ok({"success": True, **daemon.equity_view(points)})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/crypto/sim/research-backtest")
    def sim_research_backtest():
        try:
            _authenticated()
            return ok({"success": True, **daemon.research_backtest(json_object())})
        except Exception as exc:
            return fail(exc)

    app.register_blueprint(blueprint)
    daemon.ensure_thread()
    controls = {"daemon": daemon, "stop": daemon.stop_thread}
    app.extensions["alphalab_crypto_sim"] = controls
    safe_print("[CryptoSim] local 24/7 paper-trading API registered")
    return controls


__all__ = [
    "SIM_VERSION",
    "CryptoSimError",
    "PaperTradingDaemon",
    "register_crypto_paper_api",
    "get_daemon",
]
