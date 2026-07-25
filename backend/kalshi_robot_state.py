"""Persistent non-financial state for the AlphaLab Kalshi robot."""

from __future__ import annotations

import copy
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

try:
    from kalshi_engine import DEFAULT_STRATEGY_CONFIG, normalize_strategy_config
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_engine import DEFAULT_STRATEGY_CONFIG, normalize_strategy_config


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


MAX_DECISION_RECORDS = 250
MAX_SETTLEMENT_RECORDS = 1000
MAX_TRADED_TICKERS = 2000
PAPER_STATE_VERSION = 8
KALSHI_MODES = ("paper", "real")


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed == parsed and abs(parsed) != float("inf") else default


def _money(row: Mapping[str, Any], dollar_keys, cent_keys=()) -> float:
    for key in dollar_keys:
        value = row.get(key)
        if value not in (None, ""):
            return _number(value)
    for key in cent_keys:
        value = row.get(key)
        if value not in (None, ""):
            return _number(value) / 100.0
    return 0.0


def _settlement_result(settlement: Mapping[str, Any]) -> str:
    result = str(settlement.get("market_result") or settlement.get("result") or "").upper()
    if result in {"YES", "NO"}:
        return result
    value = settlement.get("value")
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return ""
    threshold = 0.5 if 0.0 <= numeric <= 1.0 else 50.0
    return "YES" if numeric >= threshold else "NO"


def _execution_environment(value: Any) -> str:
    mode = str(value or "paper").strip().lower()
    return "real" if mode in {"real", "live", "production"} else "paper"


def _order_fill_count(order: Optional[Mapping[str, Any]]) -> float:
    if not order:
        return 0.0
    for key in ("fill_count", "fill_count_fp", "filled_count", "filled_count_fp"):
        try:
            value = float(order.get(key) or 0)
        except (TypeError, ValueError):
            continue
        if value > 0:
            return value
    status = str(order.get("status") or "").strip().lower()
    if status == "filled":
        try:
            return float(order.get("count") or order.get("count_fp") or 1)
        except (TypeError, ValueError):
            return 1.0
    return 0.0


class KalshiRobotState:
    @staticmethod
    def _apply_v8_strategy_defaults(state: Dict[str, Any]) -> None:
        """Adopt settlement-aligned v5 controls without deleting audit records."""
        fields = (
            "minNetEdge", "minConservativeEdge", "maxSpread", "maxRelativeSpread",
            "minDepthContracts", "minSecondsToClose", "maxSecondsToClose",
            "minPrice", "maxPrice", "basisReserveBps",
            "minModelProbability", "maxModelMarketGap", "maxVolatilityRatio",
            "maxJumpSigma", "minimumAddIntervalSeconds", "addMinModelProbability",
            "addMinConservativeEdge", "addMinProbabilityImprovement",
            "addMinEdgeImprovement", "addSizeFraction", "exitValueBuffer",
            "minimumExitProfit", "takeProfitScaleOutPct", "stopLossPct",
            "emergencyStopLossPct",
        )

        def update_config(raw: Optional[Mapping[str, Any]], environment: Optional[str] = None) -> Dict[str, Any]:
            configured = normalize_strategy_config(raw or {})
            for field in fields:
                configured[field] = DEFAULT_STRATEGY_CONFIG[field]
            if environment:
                configured["executionMode"] = _execution_environment(environment)
            return configured

        change = {
            "at": _now(),
            "version": 5,
            "summary": (
                "Settlement-aligned v5: BRTI constituent proxy, final-60-second average "
                "horizon, wider staged entry window, marginal liquidity economics, and "
                "bounded scale-ins with durable Kalshi API audit history."
            ),
        }

        def update_changes(strategy: Dict[str, Any]) -> None:
            changes = list(strategy.get("changes") or [])
            if not changes or "settlement-aligned v5" not in str(changes[0].get("summary") or "").lower():
                changes.insert(0, dict(change))
            strategy["changes"] = changes[:50]

        state["config"] = update_config(state.get("config") or {})
        mode_state = state.get("modeState")
        if isinstance(mode_state, dict):
            for environment, bucket in mode_state.items():
                if isinstance(bucket, dict):
                    bucket["config"] = update_config(bucket.get("config") or {}, environment)
                    if isinstance(bucket.get("strategy"), dict):
                        update_changes(bucket["strategy"])
        state["storageVersion"] = PAPER_STATE_VERSION
        strategy = state.setdefault("strategy", {})
        update_changes(strategy)

    def __init__(
        self,
        path: Optional[str] = None,
        *,
        state_loader=None,
        state_saver=None,
        enabled_users_loader=None,
    ):
        self.path = path
        self._state_loader = state_loader
        self._state_saver = state_saver
        self._enabled_users_loader = enabled_users_loader
        self._lock = threading.RLock()
        self._users: Dict[str, Dict[str, Any]] = {}
        if path and os.path.exists(path) and not callable(self._state_loader):
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                if isinstance(payload, Mapping):
                    self._users = {str(key): dict(value) for key, value in payload.items() if isinstance(value, Mapping)}
            except Exception:
                self._users = {}
        migrated = False
        for user_id, state in list(self._users.items()):
            version = int(state.get("storageVersion") or 0)
            if version < 6:
                enabled = bool(state.get("enabled"))
                configured = normalize_strategy_config(state.get("config") or {})
                # The v3 favorite-carry strategy replaces the v2 longshot-prone
                # edge hunter. Old records and old tuned thresholds are not
                # valid evidence for the new entry logic, so both reset to the
                # freshly calibrated defaults.
                for field in (
                    "minNetEdge", "minConservativeEdge", "minPrice", "maxPrice",
                    "minModelProbability", "minSecondsToClose", "maxSecondsToClose",
                    "probabilityLogitScale", "momentumProjectionScale",
                    "basisReserveBps", "marketBlendWeight", "maxVolatilityRatio",
                    "exitProbabilityThreshold", "stopLossPct", "emergencyStopLossPct",
                    "minimumExitProfit", "riskPerTradePct",
                    "executionPriceTolerance",
                ):
                    configured[field] = DEFAULT_STRATEGY_CONFIG[field]
                replacement = self._initial()
                replacement["enabled"] = enabled
                replacement["config"] = configured
                replacement["strategy"]["changes"] = [{
                    "at": _now(),
                    "version": 5,
                    "summary": (
                        "Adopted deterministic BTC15 v4: fee-adjusted entries, bounded scale-ins, "
                        "economic exits, and explicit hold-to-settlement decisions. Removed all "
                        "AI learning, random exploration, contrarian mode, and strategy presets."
                    ),
                }]
                self._users[user_id] = replacement
                migrated = True
            if int(self._users[user_id].get("storageVersion") or 0) < PAPER_STATE_VERSION:
                self._apply_v8_strategy_defaults(self._users[user_id])
                migrated = True
        if migrated:
            self._save()

    @staticmethod
    def _initial() -> Dict[str, Any]:
        return {
            "storageVersion": PAPER_STATE_VERSION,
            "enabled": False,
            "activeEnvironment": "paper",
            "intervalSeconds": 5,
            "lastRunAt": None,
            "lastError": None,
            "runs": 0,
            "modeState": {},
            "config": {},
            "tradedTickers": [],
            "filledTrades": [],
            "processedSettlements": [],
            "decisions": [],
            "decisionLimit": MAX_DECISION_RECORDS,
            "strategy": {
                "name": "BTC15 Settlement-Aligned Carry v5",
                "version": 5,
                "philosophy": (
                    "Buy only the model-confirmed FAVORITE side in the final minutes of the "
                    "quarter-hour, priced 50-95c, and normally hold to settlement. Expected "
                    "win rate comes from measured calibration, never a guaranteed headline. Never "
                    "buy the longshot side; that is what produced the old ~20% win rate."
                ),
                "components": [
                    "distance to settlement strike over remaining diffusion horizon",
                    "BRTI constituent-exchange proxy with cross-venue dispersion reserve",
                    "final-60-second settlement-average variance horizon",
                    "bounded time-scaled logistic distance model",
                    "bounded 5m momentum logit shift",
                    "favorite-side selection with minimum model probability",
                    "Kalshi microprice blend, fee-adjusted and uncertainty-adjusted edge",
                    "bounded same-side scale-ins under incremental edge and exposure gates",
                    "economic exits versus hold-to-settlement value with deep protective stops",
                    "depth participation, exposure, loss-stop, and cooldown gates",
                ],
                "settledSamples": 0,
                "wins": 0,
                "losses": 0,
                "winRate": None,
                "brierScore": None,
                "totalPnl": 0.0,
                "averagePnl": 0.0,
                "bestTrade": None,
                "worstTrade": None,
                "settlementRecords": [],
                "closedTradeRecords": [],
                "closedTradeSamples": 0,
                "closedTradeWinRate": None,
                "closedTradeTotalPnl": 0.0,
                "realizedTradeRecords": [],
                "realizedSamples": 0,
                "realizedWins": 0,
                "realizedLosses": 0,
                "realizedWinRate": None,
                "realizedTotalPnl": 0.0,
                "realizedAveragePnl": 0.0,
                "equityCurve": [],
                "dailyPnlDate": None,
                "dailyPnl": 0.0,
                "lastEntryTicker": None,
                "lastEntryAt": None,
                "lastExitTicker": None,
                "lastExitAt": None,
                "changes": [{"at": _now(), "version": 4, "summary": "Introduced deterministic v4 position management and durable online execution."}],
            },
        }

    @staticmethod
    def _mode_template(environment: str, source: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
        environment = _execution_environment(environment)
        initial = KalshiRobotState._initial()
        source = dict(source or {})
        config = normalize_strategy_config(source.get("config") or {"executionMode": environment})
        config["executionMode"] = environment
        strategy = copy.deepcopy(source.get("strategy") or initial["strategy"])
        strategy.pop("learning", None)
        return {
            "config": config,
            "strategy": strategy,
            "tradedTickers": list(source.get("tradedTickers") or [])[-MAX_TRADED_TICKERS:],
            "filledTrades": [
                dict(row) for row in list(source.get("filledTrades") or [])
                if _execution_environment((row or {}).get("environment") or environment) == environment
            ][-MAX_SETTLEMENT_RECORDS:],
            "processedSettlements": [
                str(value) for value in list(source.get("processedSettlements") or [])
                if str(value).startswith(f"{environment}:")
            ][-1000:],
            "decisions": [
                dict(row) for row in list(source.get("decisions") or [])
                if _execution_environment((row or {}).get("environment") or environment) == environment
            ][:MAX_DECISION_RECORDS],
            "decisionLimit": MAX_DECISION_RECORDS,
        }

    def _mode_bucket(self, state: Dict[str, Any], environment: str) -> Dict[str, Any]:
        environment = _execution_environment(environment)
        mode_state = state.setdefault("modeState", {})
        if not isinstance(mode_state, dict):
            mode_state = {}
            state["modeState"] = mode_state
        if environment not in mode_state or not isinstance(mode_state.get(environment), Mapping):
            active = _execution_environment(state.get("activeEnvironment") or (state.get("config") or {}).get("executionMode"))
            source = state if environment == active else {"config": {"executionMode": environment}}
            mode_state[environment] = self._mode_template(environment, source)
        bucket = mode_state[environment]
        template = self._mode_template(environment)
        for field, value in template.items():
            bucket.setdefault(field, copy.deepcopy(value))
        bucket["config"] = normalize_strategy_config({**bucket.get("config", {}), "executionMode": environment})
        bucket["strategy"].pop("learning", None)
        bucket["decisionLimit"] = MAX_DECISION_RECORDS
        bucket["decisions"] = list(bucket.get("decisions") or [])[:MAX_DECISION_RECORDS]
        return bucket

    def _sync_mode_mirror(
        self,
        state: Dict[str, Any],
        environment: str,
        *,
        activate: bool = False,
    ) -> Dict[str, Any]:
        """Refresh the legacy top-level view without changing modes implicitly.

        Mode buckets are updated by background ticks and settlement reconciliation.
        Those writes must not silently switch the user's active Paper/Real mode.
        Only explicit reads/configuration with ``activate=True`` may select a mode.
        """
        environment = _execution_environment(environment)
        bucket = self._mode_bucket(state, environment)
        active_environment = _execution_environment(
            state.get("activeEnvironment")
            or (state.get("config") or {}).get("executionMode")
        )
        if activate:
            state["activeEnvironment"] = environment
            active_environment = environment
        if environment != active_environment:
            return state
        for field in (
            "config", "strategy", "tradedTickers", "filledTrades", "processedSettlements",
            "decisions", "decisionLimit",
        ):
            state[field] = copy.deepcopy(bucket.get(field))
        return state

    def _state(self, user_id: str) -> Dict[str, Any]:
        key = str(user_id)
        migrated = False
        if key not in self._users:
            restored = self._state_loader(key) if callable(self._state_loader) else None
            self._users[key] = dict(restored) if isinstance(restored, Mapping) else self._initial()
            if int(self._users[key].get("storageVersion") or 0) < PAPER_STATE_VERSION:
                self._apply_v8_strategy_defaults(self._users[key])
                migrated = True
        else:
            initial = self._initial()
            for field, value in initial.items():
                self._users[key].setdefault(field, value)
            for field, value in initial["strategy"].items():
                self._users[key]["strategy"].setdefault(field, value)
            strategy = self._users[key]["strategy"]
            self._users[key]["config"] = normalize_strategy_config(
                self._users[key].get("config") or {}
            )
            # The user-facing decision state is intentionally ephemeral: only
            # the current five-second evaluation is retained. Filled trades are
            # preserved separately so settlement attribution remains correct.
            legacy_decisions = list(self._users[key].get("decisions") or [])
            filled_trades = list(self._users[key].get("filledTrades") or [])
            known_order_ids = {str(row.get("orderId") or row.get("clientOrderId") or "") for row in filled_trades}
            for row in legacy_decisions:
                identity = str(row.get("orderId") or row.get("clientOrderId") or "")
                if row.get("orderFilled") and identity not in known_order_ids:
                    filled_trades.append(dict(row))
                    known_order_ids.add(identity)
            self._users[key]["filledTrades"] = filled_trades[-MAX_SETTLEMENT_RECORDS:]
            self._users[key].pop("learningObservations", None)
            self._users[key].pop("learningExamples", None)
            self._users[key].pop("strategyLibrary", None)
            self._users[key]["decisions"] = legacy_decisions[:MAX_DECISION_RECORDS]
            self._users[key]["decisionLimit"] = MAX_DECISION_RECORDS
            if int(strategy.get("version") or 1) < 2:
                strategy.update({
                    "name": initial["strategy"]["name"],
                    "version": 2,
                    "philosophy": initial["strategy"]["philosophy"],
                    "components": initial["strategy"]["components"],
                })
                changes = list(strategy.get("changes") or [])
                changes.insert(0, {
                    "at": _now(),
                    "version": 2,
                    "summary": "Migrated to conservative edge, full order-book, and account-level risk gates.",
                })
                strategy["changes"] = changes[:50]
        active_environment = _execution_environment(
            self._users[key].get("activeEnvironment")
            or (self._users[key].get("config") or {}).get("executionMode")
        )
        for environment in KALSHI_MODES:
            self._mode_bucket(self._users[key], environment)
        self._sync_mode_mirror(self._users[key], active_environment, activate=True)
        if migrated:
            self._save()
        return self._users[key]

    def _save(self) -> None:
        if callable(self._state_saver):
            for user_id, state in self._users.items():
                self._state_saver(str(user_id), copy.deepcopy(state))
        if not self.path:
            return
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        temporary = self.path + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(self._users, handle, ensure_ascii=True, separators=(",", ":"))
        os.replace(temporary, self.path)

    def get(self, user_id: str, *, environment: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            if environment is not None:
                self._sync_mode_mirror(
                    state,
                    _execution_environment(environment),
                    activate=True,
                )
            return copy.deepcopy(state)

    def reset_trading_history(self, user_id: str) -> Dict[str, Any]:
        """Clear all fills, settlements, and decisions."""
        with self._lock:
            current = self._state(user_id)
            enabled = bool(current.get("enabled"))
            active_environment = _execution_environment(current.get("activeEnvironment") or (current.get("config") or {}).get("executionMode"))
            config = normalize_strategy_config(current.get("config") or {})
            replacement = self._initial()
            replacement["enabled"] = enabled
            replacement["activeEnvironment"] = active_environment
            replacement["modeState"][active_environment] = self._mode_template(active_environment, {"config": config})
            self._sync_mode_mirror(replacement, active_environment, activate=True)
            self._users[str(user_id)] = replacement
            self._save()
            return copy.deepcopy(replacement)

    def start_fresh_strategy(
        self,
        user_id: str,
        *,
        environment: str = "paper",
        starting_bankroll: float = 1000.0,
        name: str = "",
    ) -> Dict[str, Any]:
        """Start a clean Paper run while leaving Real mode untouched."""
        selected_environment = _execution_environment(environment)
        if selected_environment != "paper":
            raise ValueError("fresh_strategy_reset_is_paper_only")
        bankroll = max(100.0, float(starting_bankroll))

        with self._lock:
            state = self._state(user_id)
            current_bucket = self._mode_bucket(state, selected_environment)
            current_config = normalize_strategy_config(current_bucket.get("config") or {})
            current_config.update({
                "executionMode": selected_environment,
                "paperBankroll": bankroll,
            })

            fresh_bucket = self._mode_template(
                selected_environment,
                {"config": current_config},
            )
            fresh_bucket["strategy"]["changes"] = [{
                "at": _now(),
                "version": 4,
                "source": "fresh_strategy",
                "summary": (
                    f"Started {(name or 'BTC15 Settlement-Aligned Carry v5')[:80]} "
                    f"with a ${bankroll:,.2f} Paper bankroll "
                    "and zero trading history."
                ),
            }]
            state.setdefault("modeState", {})[selected_environment] = fresh_bucket
            self._sync_mode_mirror(
                state,
                selected_environment,
                activate=state.get("activeEnvironment") == selected_environment,
            )
            self._save()
            return copy.deepcopy(state)

    def enabled_users(self):
        with self._lock:
            enabled = {key for key, value in self._users.items() if value.get("enabled")}
            if callable(self._enabled_users_loader):
                enabled.update(
                    str(user_id) for user_id in (self._enabled_users_loader() or [])
                    if str(user_id).strip()
                )
            return sorted(enabled)

    def configure(self, user_id: str, enabled: bool, config: Mapping[str, Any]) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            normalized = normalize_strategy_config(config)
            environment = _execution_environment(normalized.get("executionMode"))
            bucket = self._mode_bucket(state, environment)
            state["enabled"] = bool(enabled)
            bucket["config"] = normalized
            state["lastError"] = None
            bucket["strategy"].pop("learning", None)
            self._sync_mode_mirror(state, environment, activate=True)
            self._save()
            return copy.deepcopy(state)

    def record(self, user_id: str, decision: Mapping[str, Any], order: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            edge = dict(decision.get("edge") or {})
            market = dict(decision.get("market") or {})
            environment = _execution_environment(
                (order or {}).get("environment")
                or (decision.get("config") or {}).get("executionMode")
                or state.get("config", {}).get("executionMode")
            )
            bucket = self._mode_bucket(state, environment)
            row = {
                "generatedAt": decision.get("generatedAt") or _now(),
                "environment": environment,
                "ticker": market.get("ticker"),
                "action": decision.get("action"),
                "side": decision.get("side"),
                "signalQuality": decision.get("signalQuality"),
                "fairProbability": edge.get("fairProbability"),
                "price": edge.get("price"),
                "netEdge": edge.get("netEdge"),
                "conservativeEdge": edge.get("conservativeEdge"),
                "uncertainty": (decision.get("model") or {}).get("uncertainty"),
                "blockingReasons": list(decision.get("blockingReasons") or []),
                "gateSummary": {
                    category: sum(
                        1 for gate in decision.get("gates") or []
                        if gate.get("category") == category and gate.get("status") == "block"
                    )
                    for category in ("data", "signal", "execution", "account")
                },
                "orderId": (order or {}).get("order_id"),
                "clientOrderId": (order or {}).get("client_order_id"),
                "orderStatus": (order or {}).get("status"),
                "fillCount": (order or {}).get("fill_count") or (order or {}).get("fill_count_fp") or (order or {}).get("filled_count"),
                "orderSubmitted": bool(order),
                "orderFilled": _order_fill_count(order) > 0,
                "executionIntent": decision.get("executionIntent"),
                "account": dict(decision.get("account") or {}),
                "engine": decision.get("engine"),
                "features": {
                    "selectedSide": decision.get("side"),
                    "selectedPrice": edge.get("price"),
                    "netEdge": edge.get("netEdge"),
                    "conservativeEdge": edge.get("conservativeEdge"),
                    "signalQuality": decision.get("signalQuality"),
                    "uncertainty": (decision.get("model") or {}).get("uncertainty"),
                    "marketYesProbability": (decision.get("model") or {}).get("marketYesProbability"),
                    "rawModelYesProbability": (decision.get("model") or {}).get("rawModelYesProbability"),
                    "originalModelYesProbability": (decision.get("model") or {}).get("originalModelYesProbability"),
                    "modelYesProbability": (decision.get("model") or {}).get("modelYesProbability"),
                    "fairYesProbability": (decision.get("model") or {}).get("fairYesProbability"),
                    "momentum3m": (decision.get("model") or {}).get("momentum3m"),
                    "momentum5m": (decision.get("model") or {}).get("momentum5m"),
                    "momentum15m": (decision.get("model") or {}).get("momentum15m"),
                    "volatilityRatio": (decision.get("model") or {}).get("volatilityRatio"),
                    "jumpSigma": (decision.get("model") or {}).get("jumpSigma"),
                    "distanceBps": (decision.get("model") or {}).get("distanceBps"),
                    "settlementEffectiveHorizonMinutes": (decision.get("model") or {}).get("settlementEffectiveHorizonMinutes"),
                    "referenceModel": (decision.get("model") or {}).get("referenceModel"),
                    "referenceVenueCount": (decision.get("model") or {}).get("referenceVenueCount"),
                    "referenceDispersionBps": (decision.get("model") or {}).get("referenceDispersionBps"),
                    "basisReserveBpsApplied": (decision.get("model") or {}).get("basisReserveBpsApplied"),
                    "spread": market.get("spread"),
                    "edgeEligibleDepth": market.get("edgeEligibleDepth"),
                    "executionLimitPrice": edge.get("executionLimitPrice"),
                    "bookImbalance": market.get("bookImbalance"),
                    "secondsToClose": market.get("secondsToClose"),
                },
                "strategyVersion": bucket["strategy"]["version"],
            }
            bucket["decisions"].insert(0, row)
            bucket["decisions"] = bucket["decisions"][:MAX_DECISION_RECORDS]
            bucket["decisionLimit"] = MAX_DECISION_RECORDS
            if row["orderFilled"]:
                bucket["filledTrades"].append(dict(row))
                bucket["filledTrades"] = bucket["filledTrades"][-MAX_SETTLEMENT_RECORDS:]
                action = str(row.get("action") or "")
                if action.startswith("BUY_"):
                    bucket["strategy"]["lastEntryTicker"] = row.get("ticker")
                    bucket["strategy"]["lastEntryAt"] = row.get("generatedAt")
                elif action.startswith("SELL_"):
                    # Decision history intentionally keeps only the current
                    # cycle. Persist the latest filled exit separately so the
                    # reversal cooldown survives the next five-second tick,
                    # page changes, and process restarts.
                    bucket["strategy"]["lastExitTicker"] = row.get("ticker")
                    bucket["strategy"]["lastExitAt"] = row.get("generatedAt")
            ticker = str(market.get("ticker") or "")
            if _order_fill_count(order) > 0 and ticker and ticker not in bucket["tradedTickers"]:
                bucket["tradedTickers"].append(ticker)
                # Decision history is intentionally ephemeral, but the traded-ticker
                # guard must retain enough history to prevent duplicate entries.
                bucket["tradedTickers"] = bucket["tradedTickers"][-MAX_TRADED_TICKERS:]
            state["lastRunAt"] = _now()
            state["lastError"] = None
            state["runs"] = int(state.get("runs") or 0) + 1
            bucket["lastRunAt"] = state["lastRunAt"]
            bucket["runs"] = int(bucket.get("runs") or 0) + 1
            self._sync_mode_mirror(state, environment)
            self._save()
            return copy.deepcopy(state)

    def record_early_close(
        self,
        user_id: str,
        decision: Mapping[str, Any],
        order: Mapping[str, Any],
        *,
        environment: str = "paper",
    ) -> Dict[str, Any]:
        """Persist a realized reduce-only close without fabricating a settlement label.

        Early closes are kept separate from final settlement calibration
        because they do not reveal the eventual binary contract result.
        """
        if not order or _order_fill_count(order) <= 0:
            return self.get(user_id, environment=environment)
        action = str(order.get("action") or decision.get("action") or "").upper()
        if action != "SELL" and not action.startswith("SELL_") and not order.get("reduce_only"):
            return self.get(user_id, environment=environment)
        if order.get("realized_pnl_dollars") is None:
            # Live order acknowledgement is not realized-P/L evidence. It must
            # be reconciled from authenticated fills/settlement data later.
            return self.get(user_id, environment=environment)
        environment = _execution_environment(environment)
        with self._lock:
            state = self._state(user_id)
            bucket = self._mode_bucket(state, environment)
            strategy = bucket["strategy"]
            records = list(strategy.get("closedTradeRecords") or [])
            order_id = str(order.get("order_id") or order.get("client_order_id") or "")
            if order_id and any(str(row.get("orderId") or "") == order_id for row in records):
                return copy.deepcopy(state)
            pnl = _number(order.get("realized_pnl_dollars"), 0.0)
            count = _order_fill_count(order)
            row = {
                "orderId": order_id,
                "ticker": order.get("ticker") or (decision.get("market") or {}).get("ticker"),
                "environment": environment,
                "closedAt": order.get("created_time") or decision.get("generatedAt") or _now(),
                "side": order.get("outcome_side") or decision.get("side"),
                "count": count,
                "entryPrice": (decision.get("exitAnalysis") or {}).get("averageEntryPrice"),
                "exitPrice": order.get("average_price_dollars"),
                "entryFee": order.get("entry_fee_allocated_dollars"),
                "exitFee": order.get("fee_cost_dollars"),
                "pnl": round(pnl, 4),
                "executionIntent": decision.get("executionIntent"),
                "exitTrigger": (decision.get("exitAnalysis") or {}).get("trigger"),
                "exitValueEdge": (decision.get("exitAnalysis") or {}).get("exitValueEdge"),
                "netExitPnlPerContract": (decision.get("exitAnalysis") or {}).get("netExitPnlPerContract"),
                "exitLossFraction": (decision.get("exitAnalysis") or {}).get("exitLossFraction"),
                "settlementLabel": None,
            }
            records.append(row)
            records = records[-MAX_SETTLEMENT_RECORDS:]
            strategy["closedTradeRecords"] = records
            strategy["closedTradeSamples"] = len(records)
            strategy["closedTradeTotalPnl"] = round(sum(_number(item.get("pnl")) for item in records), 4)
            strategy["closedTradeWinRate"] = round(
                sum(1 for item in records if _number(item.get("pnl")) > 0) / len(records),
                4,
            ) if records else None
            self._sync_realized_analytics(strategy, environment)
            self._sync_mode_mirror(state, environment)
            self._save()
            return copy.deepcopy(state)

    @staticmethod
    def _sync_realized_analytics(strategy: Dict[str, Any], environment: str) -> None:
        """Combine settlement and early-exit P/L without mixing calibration labels."""
        environment = _execution_environment(environment)
        settlements = [
            dict(row) for row in strategy.get("settlementRecords") or []
            if _execution_environment(row.get("environment") or environment) == environment
        ]
        closed = [
            dict(row) for row in strategy.get("closedTradeRecords") or []
            if _execution_environment(row.get("environment") or environment) == environment
        ]
        realized = list(settlements)
        for row in closed:
            contracts = _number(row.get("count"))
            cost = _number(row.get("cost") or row.get("positionCost"))
            if cost <= 0:
                cost = _number(row.get("entryPrice")) * contracts
            revenue = _number(row.get("revenue") or row.get("grossProceeds"))
            if revenue <= 0:
                revenue = _number(row.get("exitPrice")) * contracts
            fees = _number(row.get("fees"))
            if fees <= 0:
                fees = _number(row.get("entryFee")) + _number(row.get("exitFee"))
            realized.append({
                "key": f"{environment}:sale:{row.get('orderId') or row.get('ticker')}:{row.get('closedAt')}",
                "environment": environment,
                "ticker": row.get("ticker"),
                "settledAt": row.get("closedAt"),
                "result": None,
                "side": row.get("side"),
                "contracts": round(contracts, 4),
                "revenue": round(revenue, 4),
                "cost": round(cost, 4),
                "fees": round(fees, 4),
                "pnl": round(_number(row.get("pnl")), 4),
                "entryPrice": row.get("entryPrice"),
                "exitPrice": row.get("exitPrice"),
                "exitType": "sale",
                "exitTrigger": row.get("exitTrigger"),
                "netExitPnlPerContract": row.get("netExitPnlPerContract"),
                "exitLossFraction": row.get("exitLossFraction"),
                "won": _number(row.get("pnl")) > 0,
                "matchedFill": True,
                "orderId": row.get("orderId"),
            })
        realized = sorted(
            realized,
            key=lambda row: str(row.get("settledAt") or ""),
        )[-MAX_SETTLEMENT_RECORDS:]
        cumulative = 0.0
        curve = []
        for row in realized:
            cumulative = round(cumulative + _number(row.get("pnl")), 4)
            curve.append({
                "environment": environment,
                "at": row.get("settledAt"),
                "ticker": row.get("ticker"),
                "pnl": row.get("pnl"),
                "cumulativePnl": cumulative,
                "exitType": row.get("exitType"),
            })
        wins = sum(1 for row in realized if _number(row.get("pnl")) > 0)
        strategy["realizedTradeRecords"] = list(reversed(realized))
        strategy["realizedSamples"] = len(realized)
        strategy["realizedWins"] = wins
        strategy["realizedLosses"] = max(0, len(realized) - wins)
        strategy["realizedWinRate"] = round(wins / len(realized), 4) if realized else None
        strategy["realizedTotalPnl"] = round(cumulative, 4)
        strategy["realizedAveragePnl"] = round(cumulative / len(realized), 4) if realized else 0.0
        strategy["realizedBestTrade"] = max((_number(row.get("pnl")) for row in realized), default=None)
        strategy["realizedWorstTrade"] = min((_number(row.get("pnl")) for row in realized), default=None)
        strategy["equityCurve"] = curve
        strategy["wins"] = strategy["realizedWins"]
        strategy["losses"] = strategy["realizedLosses"]
        strategy["winRate"] = strategy["realizedWinRate"]
        strategy["totalPnl"] = strategy["realizedTotalPnl"]
        strategy["averagePnl"] = strategy["realizedAveragePnl"]
        strategy["bestTrade"] = strategy["realizedBestTrade"]
        strategy["worstTrade"] = strategy["realizedWorstTrade"]

    def error(self, user_id: str, message: str) -> None:
        with self._lock:
            state = self._state(user_id)
            state["lastRunAt"] = _now()
            state["lastError"] = str(message)[:300]
            bucket = self._mode_bucket(state, state.get("activeEnvironment") or (state.get("config") or {}).get("executionMode"))
            bucket["lastRunAt"] = state["lastRunAt"]
            bucket["lastError"] = state["lastError"]
            self._save()

    def reconcile_settlements(
        self,
        user_id: str,
        settlements,
        fills=None,
        *,
        environment: str = "paper",
    ) -> Dict[str, Any]:
        """Build realized analytics from actually filled and settled contracts."""
        environment = _execution_environment(environment)
        with self._lock:
            state = self._state(user_id)
            bucket = self._mode_bucket(state, environment)
            processed = {
                str(value) for value in (bucket.get("processedSettlements") or [])
                if str(value).startswith(f"{environment}:")
            }
            changed = False
            legacy_forecast_mode = fills is None
            fill_rows = [
                row for row in list(fills or [])
                if _execution_environment((row or {}).get("environment") or environment) == environment
            ]
            strategy = bucket["strategy"]
            closed_by_order = {
                str(row.get("orderId")): dict(row)
                for row in strategy.get("closedTradeRecords") or []
                if row.get("orderId")
            }
            for fill in fill_rows:
                action = str(fill.get("action") or "").upper()
                if (
                    _order_fill_count(fill) <= 0
                    or fill.get("realized_pnl_dollars") is None
                    or not (fill.get("reduce_only") or action == "SELL" or action.startswith("SELL_"))
                ):
                    continue
                order_id = str(fill.get("order_id") or fill.get("client_order_id") or fill.get("fill_id") or "")
                if not order_id:
                    continue
                count = _order_fill_count(fill)
                allocated_cost = _number(fill.get("position_cost_dollars"))
                gross_proceeds = _number(fill.get("gross_proceeds_dollars"))
                entry_fee = _number(fill.get("entry_fee_allocated_dollars"))
                exit_fee = _number(fill.get("fee_cost_dollars"))
                row = {
                    "orderId": order_id,
                    "ticker": fill.get("ticker") or fill.get("market_ticker"),
                    "environment": environment,
                    "closedAt": fill.get("created_time") or fill.get("ts") or _now(),
                    "side": fill.get("outcome_side"),
                    "count": count,
                    "cost": round(allocated_cost, 4),
                    "revenue": round(gross_proceeds, 4),
                    "fees": round(entry_fee + exit_fee, 4),
                    "entryPrice": round(allocated_cost / count, 6) if count > 0 else None,
                    "exitPrice": fill.get("average_price_dollars") or fill.get("price_dollars"),
                    "entryFee": round(entry_fee, 4),
                    "exitFee": round(exit_fee, 4),
                    "pnl": round(_number(fill.get("realized_pnl_dollars")), 4),
                    "executionIntent": "CLOSE_POSITION",
                    "settlementLabel": None,
                }
                if closed_by_order.get(order_id) != row:
                    closed_by_order[order_id] = row
                    changed = True
            if closed_by_order:
                closed_records = sorted(
                    closed_by_order.values(),
                    key=lambda row: str(row.get("closedAt") or ""),
                )[-MAX_SETTLEMENT_RECORDS:]
                strategy["closedTradeRecords"] = closed_records
                strategy["closedTradeSamples"] = len(closed_records)
                strategy["closedTradeTotalPnl"] = round(
                    sum(_number(row.get("pnl")) for row in closed_records),
                    4,
                )
                closed_wins = sum(1 for row in closed_records if _number(row.get("pnl")) > 0)
                strategy["closedTradeWinRate"] = (
                    round(closed_wins / len(closed_records), 4) if closed_records else None
                )
            existing_records = {
                str(row.get("key")): dict(row)
                for row in bucket["strategy"].get("settlementRecords") or []
                if row.get("key") and _execution_environment(row.get("environment")) == environment
            }
            ordered_settlements = sorted(
                list(settlements or []),
                key=lambda row: str(row.get("settled_time") or ""),
            )
            for settlement in ordered_settlements:
                ticker = str(settlement.get("ticker") or settlement.get("market_ticker") or "")
                settled_at = str(settlement.get("settled_time") or settlement.get("created_time") or "")
                result = _settlement_result(settlement)
                settlement_key = f"{environment}:{ticker}:{settled_at}:{result}"
                if not ticker or result not in {"YES", "NO"}:
                    continue
                matching_fills = [
                    row for row in fill_rows
                    if str(row.get("ticker") or row.get("market_ticker") or "") == ticker
                ]
                # A reduce-only SELL is a separate early-close outcome. It
                # cannot also be treated as entry cost for settlement P/L.
                matching_entry_fills = [
                    row for row in matching_fills
                    if str(row.get("action") or "").upper() != "SELL"
                    and not row.get("reduce_only")
                ]
                forecasts = [
                    row for row in list(bucket.get("filledTrades") or [])
                    if _execution_environment(row.get("environment")) == environment
                ]
                if legacy_forecast_mode:
                    forecasts.extend(
                        row for row in (bucket.get("decisions") or [])
                        if _execution_environment(row.get("environment")) == environment
                    )
                forecast = next((
                    row for row in reversed(forecasts)
                    if row.get("ticker") == ticker
                    and (bool(row.get("orderFilled")) or (legacy_forecast_mode and row.get("action") != "WAIT"))
                ), None)
                if not forecast and not matching_entry_fills:
                    processed.add(settlement_key)
                    changed = True
                    continue
                side = str((forecast or {}).get("side") or "").upper()
                if side not in {"YES", "NO"}:
                    fill_side = str((matching_entry_fills[0] if matching_entry_fills else {}).get("outcome_side") or "").upper()
                    side = fill_side if fill_side in {"YES", "NO"} else ""
                yes_count = _number(settlement.get("yes_count_fp") or settlement.get("yes_count"))
                no_count = _number(settlement.get("no_count_fp") or settlement.get("no_count"))
                if side not in {"YES", "NO"}:
                    side = "YES" if yes_count > 0 else "NO" if no_count > 0 else ""
                count = yes_count if side == "YES" else no_count if side == "NO" else 0.0
                if count <= 0:
                    count = sum(_number(row.get("count_fp") or row.get("count") or row.get("fill_count_fp") or row.get("fill_count")) for row in matching_entry_fills)
                if count <= 0:
                    count = _number((forecast or {}).get("fillCount"), 1.0 if legacy_forecast_mode else 0.0)
                has_financials = any(settlement.get(key) not in (None, "") for key in (
                    "revenue_dollars", "revenue", "yes_total_cost_dollars", "yes_total_cost",
                    "no_total_cost_dollars", "no_total_cost", "fee_cost_dollars", "fee_cost",
                ))
                revenue = _money(settlement, ("revenue_dollars",), ("revenue",))
                yes_cost = _money(settlement, ("yes_total_cost_dollars",), ("yes_total_cost",))
                no_cost = _money(settlement, ("no_total_cost_dollars",), ("no_total_cost",))
                fees = _money(settlement, ("fee_cost_dollars", "fee_cost"), ("fees",))
                if yes_cost + no_cost <= 0 and matching_entry_fills:
                    derived_cost = 0.0
                    derived_fees = 0.0
                    for fill in matching_entry_fills:
                        fill_count = _number(fill.get("count_fp") or fill.get("count") or 0)
                        price = _money(fill, ("yes_price_dollars", "no_price_dollars", "price_dollars"), ("yes_price", "no_price", "price"))
                        derived_cost += fill_count * price
                        derived_fees += _money(fill, ("fee_cost_dollars", "fee_cost", "taker_fees_dollars", "maker_fees_dollars"), ("fees",))
                    if side == "YES":
                        yes_cost = derived_cost
                    elif side == "NO":
                        no_cost = derived_cost
                    fees = max(fees, derived_fees)
                if not has_financials and forecast and count > 0:
                    forecast_price = _number(forecast.get("price"), 0.0)
                    if side == "YES":
                        yes_cost = forecast_price * count
                    elif side == "NO":
                        no_cost = forecast_price * count
                    revenue = count if side == result else 0.0
                pnl = round(revenue - yes_cost - no_cost - fees, 4)
                won = pnl > 0
                probability = _number((forecast or {}).get("fairProbability"), 0.5)
                side_cost = yes_cost if side == "YES" else no_cost if side == "NO" else 0.0
                side_count = yes_count if side == "YES" else no_count if side == "NO" else 0.0
                entry_price = round(side_cost / side_count, 6) if side_count > 0 else None
                exit_price = 1.0 if side and side == result else 0.0 if side else None
                record = {
                    "key": settlement_key,
                    "environment": environment,
                    "ticker": ticker,
                    "settledAt": settled_at,
                    "result": result,
                    "side": side or None,
                    "contracts": round(count, 4),
                    "revenue": round(revenue, 4),
                    "cost": round(yes_cost + no_cost, 4),
                    "fees": round(fees, 4),
                    "pnl": pnl,
                    "entryPrice": entry_price,
                    "exitPrice": exit_price,
                    "exitType": "settlement",
                    "won": won,
                    "fairProbability": round(probability, 6),
                    "matchedFill": bool(matching_entry_fills or forecast),
                }
                existing_records[settlement_key] = record
                if settlement_key in processed:
                    continue
                strategy = bucket["strategy"]
                count = int(strategy.get("settledSamples") or 0) + 1
                previous_brier = strategy.get("brierScore")
                score = (probability - (1.0 if won else 0.0)) ** 2
                strategy["settledSamples"] = count
                strategy["wins"] = int(strategy.get("wins") or 0) + (1 if won else 0)
                strategy["winRate"] = round(strategy["wins"] / count, 4)
                strategy["brierScore"] = round(score if previous_brier is None else (float(previous_brier) * (count - 1) + score) / count, 5)
                try:
                    settlement_time = datetime.fromisoformat(settled_at.replace("Z", "+00:00")) if settled_at else datetime.now(timezone.utc)
                except ValueError:
                    settlement_time = datetime.now(timezone.utc)
                if settlement_time.tzinfo is None:
                    settlement_time = settlement_time.replace(tzinfo=timezone.utc)
                settlement_day = settlement_time.astimezone(timezone.utc).date().isoformat()
                if strategy.get("dailyPnlDate") != settlement_day:
                    strategy["dailyPnlDate"] = settlement_day
                    strategy["dailyPnl"] = 0.0
                strategy["dailyPnl"] = round(float(strategy.get("dailyPnl") or 0.0) + pnl, 4)
                processed.add(settlement_key)
                changed = True

            records = sorted(existing_records.values(), key=lambda row: str(row.get("settledAt") or ""))[-MAX_SETTLEMENT_RECORDS:]
            strategy = bucket["strategy"]
            strategy["settlementRecords"] = list(reversed(records))
            strategy["settledSamples"] = len(records)
            if records:
                brier = sum((_number(row.get("fairProbability"), 0.5) - (1.0 if row.get("result") == row.get("side") else 0.0)) ** 2 for row in records) / len(records)
                strategy["brierScore"] = round(brier, 5)
            self._sync_realized_analytics(strategy, environment)
            realized_records = list(reversed(strategy.get("realizedTradeRecords") or []))
            if changed or records or realized_records:
                preserved_processed = [
                    str(value) for value in (bucket.get("processedSettlements") or [])
                    if not str(value).startswith(f"{environment}:")
                ][-1000:]
                bucket["processedSettlements"] = (preserved_processed + list(processed))[-1000:]
                self._sync_mode_mirror(state, environment)
                self._save()
            return copy.deepcopy(state)

__all__ = ["KalshiRobotState"]
