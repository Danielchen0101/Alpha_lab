"""Persistent non-financial state for the AlphaLab Kalshi robot."""

from __future__ import annotations

import copy
import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Mapping, Optional

try:
    from kalshi_engine import DEFAULT_STRATEGY_CONFIG, normalize_strategy_config
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_engine import DEFAULT_STRATEGY_CONFIG, normalize_strategy_config


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


MAX_DECISION_RECORDS = 1
MAX_SETTLEMENT_RECORDS = 200
MAX_LEARNING_OBSERVATIONS = 500
MAX_TRADED_TICKERS = 500
PAPER_STATE_VERSION = 5
KALSHI_MODES = ("paper", "real")

# The v3 favorite-carry strategy targets a structurally high win rate
# (~85-90% in the 18-month calibration backtest), so "weak" and "strong"
# evidence thresholds sit far above the coin-flip levels used by v2.
V3_WEAK_WIN_RATE = 0.72
V3_STRONG_WIN_RATE = 0.85
V3_POOR_BRIER = 0.19
V3_GOOD_BRIER = 0.15


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


def _config_adjustments(before: Mapping[str, Any], after: Mapping[str, Any], reason: str) -> Dict[str, Dict[str, Any]]:
    """Return a compact, user-facing audit record for changed parameters."""
    adjustments: Dict[str, Dict[str, Any]] = {}
    for key, value in after.items():
        if key not in before or before.get(key) == value:
            continue
        old_value = before.get(key)
        row: Dict[str, Any] = {
            "before": old_value,
            "after": value,
            "reason": reason,
        }
        if isinstance(old_value, (int, float)) and isinstance(value, (int, float)):
            row["delta"] = round(float(value) - float(old_value), 6)
        adjustments[key] = row
    return adjustments


def _learning_evidence_summary(
    settlement_records,
    shadow_records,
    early_close_records,
    realized_records,
) -> Dict[str, Any]:
    """Build deterministic evidence cohorts before an LLM may suggest changes."""
    settled = [
        dict(row) for row in (settlement_records or [])
        if str(row.get("side") or "").upper() in {"YES", "NO"}
        and str(row.get("result") or "").upper() in {"YES", "NO"}
    ]
    shadow = [
        dict(row) for row in (shadow_records or [])
        if str(row.get("side") or "").upper() in {"YES", "NO"}
        and str(row.get("result") or "").upper() in {"YES", "NO"}
    ]
    realized = [dict(row) for row in (realized_records or [])]
    early = [dict(row) for row in (early_close_records or [])]

    calibration_bins = []
    for low, high in ((0.0, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)):
        rows = [
            row for row in settled
            if low <= _number(row.get("fairProbability"), 0.5) < high
        ]
        if not rows:
            continue
        forecasts = [_number(row.get("fairProbability"), 0.5) for row in rows]
        outcomes = [1.0 if row.get("side") == row.get("result") else 0.0 for row in rows]
        mean_forecast = sum(forecasts) / len(forecasts)
        hit_rate = sum(outcomes) / len(outcomes)
        calibration_bins.append({
            "range": f"{low:.1f}-{min(high, 1.0):.1f}",
            "samples": len(rows),
            "meanForecast": round(mean_forecast, 4),
            "hitRate": round(hit_rate, 4),
            "gap": round(mean_forecast - hit_rate, 4),
        })

    def brier(rows, probability_getter):
        values = []
        for row in rows:
            probability = probability_getter(row)
            if probability is None:
                continue
            outcome = 1.0 if row.get("side") == row.get("result") else 0.0
            values.append((probability - outcome) ** 2)
        return round(sum(values) / len(values), 5) if values else None

    def selected_market_probability(row):
        features = dict(row.get("learningFeatures") or {})
        market_yes = features.get("marketYesProbability")
        if market_yes is None:
            return None
        value = _number(market_yes, 0.5)
        return value if row.get("side") == "YES" else 1.0 - value

    def cohort(rows, predicate):
        selected = [row for row in rows if predicate(row)]
        if not selected:
            return {"samples": 0, "winRate": None, "averagePnl": None}
        pnl_rows = [row for row in selected if row.get("pnl") not in (None, "")]
        wins = sum(1 for row in selected if row.get("side") == row.get("result"))
        return {
            "samples": len(selected),
            "winRate": round(wins / len(selected), 4),
            "averagePnl": (
                round(sum(_number(row.get("pnl")) for row in pnl_rows) / len(pnl_rows), 4)
                if pnl_rows else None
            ),
        }

    def selected_model_probability_of(row):
        features = dict(row.get("learningFeatures") or {})
        model_yes = features.get("modelYesProbability")
        if model_yes is None:
            return None
        value = _number(model_yes, 0.5)
        return value if str(row.get("side") or "").upper() == "YES" else 1.0 - value

    def feature_number(row, key, default=None):
        features = dict(row.get("learningFeatures") or {})
        value = features.get(key)
        return _number(value) if value is not None else default

    def settled_hour(row):
        raw = str(row.get("settledAt") or "")
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed.astimezone(timezone.utc).hour

    realized_pnls = [_number(row.get("pnl")) for row in realized]
    early_pnls = [_number(row.get("pnl")) for row in early]
    model_brier = brier(settled, lambda row: _number(row.get("fairProbability"), 0.5))
    market_brier = brier(settled, selected_market_probability)
    return {
        "samples": {
            "finalSettlements": len(settled),
            "shadowLabels": len(shadow),
            "realizedTrades": len(realized),
            "earlyCloses": len(early),
        },
        "calibration": {
            "modelBrier": model_brier,
            "marketBrier": market_brier,
            "modelMinusMarketBrier": (
                round(model_brier - market_brier, 5)
                if model_brier is not None and market_brier is not None else None
            ),
            "reliabilityBins": calibration_bins,
        },
        "financial": {
            "totalPnl": round(sum(realized_pnls), 4),
            "averagePnl": round(sum(realized_pnls) / len(realized_pnls), 4) if realized_pnls else None,
            "winRate": (
                round(sum(1 for value in realized_pnls if value > 0) / len(realized_pnls), 4)
                if realized_pnls else None
            ),
            "earlyCloseAveragePnl": (
                round(sum(early_pnls) / len(early_pnls), 4) if early_pnls else None
            ),
        },
        "cohorts": {
            "yes": cohort(settled, lambda row: row.get("side") == "YES"),
            "no": cohort(settled, lambda row: row.get("side") == "NO"),
            "cheapEntry": cohort(settled, lambda row: _number(row.get("entryPrice"), 0.5) < 0.35),
            "midEntry": cohort(settled, lambda row: 0.35 <= _number(row.get("entryPrice"), 0.5) <= 0.65),
            "expensiveEntry": cohort(settled, lambda row: _number(row.get("entryPrice"), 0.5) > 0.65),
            "exploration": cohort(settled, lambda row: bool(row.get("explorationTrade"))),
            "standard": cohort(settled, lambda row: not bool(row.get("explorationTrade"))),
        },
        # v3 fine-tuning cohorts. Each maps directly to one bounded lever:
        # marginal-confidence decay -> minModelProbability; a specific
        # entry-timing bucket underperforming -> min/maxSecondsToClose;
        # elevated-volatility decay -> maxVolatilityRatio / logit scale;
        # a weak hour band is informational (no per-hour lever exists).
        "v3Cohorts": {
            "modelProbability": {
                "below070": cohort(settled, lambda row: (selected_model_probability_of(row) or 1.0) < 0.70),
                "070to080": cohort(settled, lambda row: 0.70 <= (selected_model_probability_of(row) or -1.0) < 0.80),
                "080to090": cohort(settled, lambda row: 0.80 <= (selected_model_probability_of(row) or -1.0) < 0.90),
                "above090": cohort(settled, lambda row: (selected_model_probability_of(row) or -1.0) >= 0.90),
            },
            "secondsToClose": {
                "over240": cohort(settled, lambda row: (feature_number(row, "secondsToClose") or 0.0) > 240),
                "180to240": cohort(settled, lambda row: 180 < (feature_number(row, "secondsToClose") or -1.0) <= 240),
                "under180": cohort(settled, lambda row: 0 < (feature_number(row, "secondsToClose") or -1.0) <= 180),
            },
            "volatilityRatio": {
                "calm": cohort(settled, lambda row: (feature_number(row, "volatilityRatio") or 1.0) <= 1.5),
                "elevated": cohort(settled, lambda row: (feature_number(row, "volatilityRatio") or 1.0) > 1.5),
            },
            "utcHourBand": {
                "h00to05": cohort(settled, lambda row: (settled_hour(row) or -1) in range(0, 6)),
                "h06to11": cohort(settled, lambda row: (settled_hour(row) or -1) in range(6, 12)),
                "h12to17": cohort(settled, lambda row: (settled_hour(row) or -1) in range(12, 18)),
                "h18to23": cohort(settled, lambda row: (settled_hour(row) or -1) in range(18, 24)),
            },
        },
    }


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
    def __init__(self, path: Optional[str] = None):
        self.path = path
        self._lock = threading.RLock()
        self._users: Dict[str, Dict[str, Any]] = {}
        if path and os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                if isinstance(payload, Mapping):
                    self._users = {str(key): dict(value) for key, value in payload.items() if isinstance(value, Mapping)}
            except Exception:
                self._users = {}
        migrated = False
        for user_id, state in list(self._users.items()):
            if int(state.get("storageVersion") or 0) < PAPER_STATE_VERSION:
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
                    "executionPriceTolerance", "learningExplorationRate",
                ):
                    configured[field] = DEFAULT_STRATEGY_CONFIG[field]
                configured["learningContrarianMode"] = False
                replacement = self._initial()
                replacement["enabled"] = enabled
                replacement["config"] = configured
                replacement["strategy"]["changes"] = [{
                    "at": _now(),
                    "version": 5,
                    "summary": (
                        "Adopted the v3 favorite-carry strategy: late-window entries on the "
                        "model-confirmed favorite side only, calibrated on 53,936 real 15-minute "
                        "windows. Cleared pre-v3 records; they measured a different strategy."
                    ),
                }]
                self._users[user_id] = replacement
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
            "strategyLibrary": [],
            "config": {},
            "tradedTickers": [],
            "filledTrades": [],
            "processedSettlements": [],
            "learningObservations": [],
            "learningExamples": [],
            "decisions": [],
            "decisionLimit": MAX_DECISION_RECORDS,
            "strategy": {
                "name": "BTC15 Favorite Carry v3",
                "version": 3,
                "philosophy": (
                    "Buy only the model-confirmed FAVORITE side in the final minutes of the "
                    "quarter-hour, priced 50-93c, hold to settlement. Win rate is structural: "
                    "the forecast itself (~85-90% calibrated) is the expected hit rate. Never "
                    "buy the longshot side; that is what produced the old ~20% win rate."
                ),
                "components": [
                    "distance to settlement strike over remaining diffusion horizon",
                    "MLE-calibrated time-scaled logistic (fit on 53,936 real 15m windows)",
                    "bounded 5m momentum logit shift",
                    "favorite-side selection with minimum model probability",
                    "Kalshi microprice blend, fee-adjusted and uncertainty-adjusted edge",
                    "hold-to-settlement exits with deep protective stops only",
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
                "consecutiveLosses": 0,
                "cooldownUntil": None,
                "lastEntryTicker": None,
                "lastEntryAt": None,
                "lastExitTicker": None,
                "lastExitAt": None,
                "learning": {
                    "enabled": False,
                    "paperOnly": True,
                    "status": "disabled",
                    "reviewEvery": 8,
                    "windowSize": 24,
                    "lastReviewSample": 0,
                    "nextReviewSample": 12,
                    "lastReviewAt": None,
                    "lastReason": "Adaptive learning has not been enabled.",
                    "recentWinRate": None,
                    "recentAveragePnl": None,
                    "recentBrierScore": None,
                    "adjustmentCount": 0,
                    "explorationRate": 0.15,
                    "aiEnabled": False,
                    "aiStatus": "not_configured",
                    "aiProvider": None,
                    "aiModel": None,
                    "lastAiReviewSample": 0,
                    "lastAiReviewAt": None,
                    "lastAiDiagnosis": None,
                    "lastAiReasons": [],
                    "lastAiAdjustments": {},
                    "originalDirectionalAccuracy": None,
                    "inverseDirectionalAccuracy": None,
                    "observedDirectionalAccuracy": None,
                    "observedInverseAccuracy": None,
                    "activeDirectionalAccuracy": None,
                    "observedSamples": 0,
                    "directionalWindowSamples": 0,
                    "tradedSamples": 0,
                    "contrarianMode": False,
                },
                "changes": [{"at": _now(), "version": 3, "summary": "Introduced AlphaLab Paper execution on production public Kalshi market evidence."}],
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
        strategy.setdefault("learning", {})
        strategy["learning"].setdefault("enabled", bool(config.get("learningMode")))
        strategy["learning"]["paperOnly"] = environment != "real"
        strategy["learning"]["environment"] = environment
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
            "learningObservations": [
                dict(row) for row in list(source.get("learningObservations") or [])
                if _execution_environment((row or {}).get("environment") or environment) == environment
            ][-MAX_LEARNING_OBSERVATIONS:],
            "learningExamples": [
                dict(row) for row in list(source.get("learningExamples") or [])
                if _execution_environment((row or {}).get("environment") or environment) == environment
            ][-MAX_LEARNING_OBSERVATIONS:],
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
        bucket["strategy"].setdefault("learning", {})
        # Older state files counted only deterministic walk-forward reviews,
        # even though Settings-AI reviews were already persisted as audited
        # strategy changes.  Rebuild the user-facing total from the audit log
        # so the counter reflects every parameter update, including historical
        # AI calibration changes.
        audited_adjustments = sum(
            1
            for change in (bucket["strategy"].get("changes") or [])
            if str((change or {}).get("source") or "").startswith(("adaptive_", "settings_ai_", "evidence_recovery_"))
        )
        learning = bucket["strategy"]["learning"]
        learning["adjustmentCount"] = max(
            int(learning.get("adjustmentCount") or 0),
            audited_adjustments,
        )
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
            "learningObservations", "learningExamples", "decisions", "decisionLimit",
        ):
            state[field] = copy.deepcopy(bucket.get(field))
        return state

    @staticmethod
    def _strategy_metrics(bucket: Mapping[str, Any]) -> Dict[str, Any]:
        strategy = dict(bucket.get("strategy") or {})
        learning = dict(strategy.get("learning") or {})
        return {
            "settledSamples": int(strategy.get("settledSamples") or 0),
            "realizedSamples": int(strategy.get("realizedSamples") or 0),
            "wins": int(strategy.get("wins") or 0),
            "losses": int(strategy.get("losses") or 0),
            "winRate": strategy.get("winRate"),
            "totalPnl": round(_number(strategy.get("totalPnl")), 4),
            "averagePnl": round(_number(strategy.get("averagePnl")), 4),
            "brierScore": strategy.get("brierScore"),
            "adjustmentCount": int(learning.get("adjustmentCount") or 0),
            "activeDirection": "contrarian" if learning.get("contrarianMode") else "normal",
            "observedSamples": int(learning.get("observedSamples") or 0),
            "directionalWindowSamples": int(learning.get("directionalWindowSamples") or 0),
            "observedDirectionalAccuracy": learning.get("observedDirectionalAccuracy"),
            "observedInverseAccuracy": learning.get("observedInverseAccuracy"),
        }

    def _ensure_strategy_library(self, state: Dict[str, Any]) -> None:
        library = state.setdefault("strategyLibrary", [])
        if not isinstance(library, list):
            library = []
            state["strategyLibrary"] = library
        existing_ids = {str(item.get("id")) for item in library if isinstance(item, Mapping)}
        for environment in KALSHI_MODES:
            bucket = self._mode_bucket(state, environment)
            strategy_id = str(bucket.get("activeStrategyId") or f"{environment}-active")
            if strategy_id not in existing_ids:
                library.append({
                    "id": strategy_id,
                    "mode": environment,
                    "name": "Kalshi Real Strategy 1" if environment == "real" else "AlphaLab Paper Strategy 1",
                    "source": "active",
                    "createdAt": _now(),
                    "updatedAt": _now(),
                    "config": copy.deepcopy(bucket.get("config") or {}),
                    "metrics": self._strategy_metrics(bucket),
                    "active": True,
                })
                bucket["activeStrategyId"] = strategy_id
                existing_ids.add(strategy_id)
        self._refresh_strategy_library(state)

    def _refresh_strategy_library(self, state: Dict[str, Any]) -> None:
        library = state.setdefault("strategyLibrary", [])
        for item in library:
            if not isinstance(item, dict):
                continue
            environment = _execution_environment(item.get("mode"))
            bucket = self._mode_bucket(state, environment)
            active_id = str(bucket.get("activeStrategyId") or f"{environment}-active")
            if str(item.get("id")) == active_id:
                item["active"] = True
                item["updatedAt"] = _now()
                item["config"] = copy.deepcopy(bucket.get("config") or {})
                item["metrics"] = self._strategy_metrics(bucket)
            else:
                item["active"] = False

    def _state(self, user_id: str) -> Dict[str, Any]:
        key = str(user_id)
        if key not in self._users:
            self._users[key] = self._initial()
        else:
            initial = self._initial()
            for field, value in initial.items():
                self._users[key].setdefault(field, value)
            for field, value in initial["strategy"].items():
                self._users[key]["strategy"].setdefault(field, value)
            strategy = self._users[key]["strategy"]
            stored_config = self._users[key].setdefault("config", {})
            if stored_config.get("learningMode") is True and "learningAiMode" not in stored_config:
                # Existing Adaptive Learning users receive the new Settings-AI
                # reviewer without having to re-apply the preset.
                stored_config["learningAiMode"] = True
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
            self._users[key].setdefault("learningObservations", [])
            self._users[key].setdefault("learningExamples", [])
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
        self._ensure_strategy_library(self._users[key])
        self._sync_mode_mirror(self._users[key], active_environment, activate=True)
        return self._users[key]

    def _save(self) -> None:
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
        """Clear all fills, settlements, decisions, and learned calibration."""
        with self._lock:
            current = self._state(user_id)
            enabled = bool(current.get("enabled"))
            active_environment = _execution_environment(current.get("activeEnvironment") or (current.get("config") or {}).get("executionMode"))
            config = normalize_strategy_config(current.get("config") or {})
            replacement = self._initial()
            replacement["enabled"] = enabled
            replacement["activeEnvironment"] = active_environment
            replacement["modeState"][active_environment] = self._mode_template(active_environment, {"config": config})
            self._ensure_strategy_library(replacement)
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
        """Archive the active strategy and start a clean, mode-scoped experiment.

        The archived strategy keeps its configuration and measured history.
        The new strategy copies only the active configuration, then starts with
        no fills, settlements, observations, decisions, or learning changes.
        The other execution mode is deliberately left untouched.
        """
        selected_environment = _execution_environment(environment)
        if selected_environment != "paper":
            raise ValueError("fresh_strategy_reset_is_paper_only")
        bankroll = max(100.0, float(starting_bankroll))

        with self._lock:
            state = self._state(user_id)
            self._refresh_strategy_library(state)
            current_bucket = self._mode_bucket(state, selected_environment)
            current_config = normalize_strategy_config(current_bucket.get("config") or {})
            current_config.update({
                "executionMode": selected_environment,
                "paperBankroll": bankroll,
            })

            library = state.setdefault("strategyLibrary", [])
            existing_ids = {
                str(item.get("id"))
                for item in library
                if isinstance(item, Mapping)
            }
            sequence = 2
            while f"paper-active-{sequence}" in existing_ids:
                sequence += 1
            strategy_id = f"paper-active-{sequence}"
            strategy_name = (name or f"AlphaLab Paper Strategy {sequence}")[:80]

            fresh_bucket = self._mode_template(
                selected_environment,
                {"config": current_config},
            )
            fresh_bucket["activeStrategyId"] = strategy_id
            learning = fresh_bucket["strategy"].setdefault("learning", {})
            learning.update({
                "enabled": bool(current_config.get("learningMode")),
                "paperOnly": True,
                "environment": selected_environment,
                "status": "warmup" if current_config.get("learningMode") else "disabled",
                "reviewEvery": int(current_config.get("learningReviewEvery") or 8),
                "windowSize": int(current_config.get("learningWindowSize") or 24),
                "lastReviewSample": 0,
                "nextReviewSample": 12,
                "explorationRate": float(current_config.get("learningExplorationRate") or 0.0),
                "aiEnabled": bool(current_config.get("learningAiMode")),
                "aiStatus": "waiting_evidence" if current_config.get("learningAiMode") else "disabled",
                "contrarianMode": bool(current_config.get("learningContrarianMode")),
                "adjustmentCount": 0,
                "observedSamples": 0,
                "directionalWindowSamples": 0,
                "tradedSamples": 0,
            })
            fresh_bucket["strategy"]["changes"] = [{
                "at": _now(),
                "version": 1,
                "source": "fresh_strategy",
                "summary": (
                    f"Started {strategy_name} with a ${bankroll:,.2f} Paper bankroll "
                    "and zero trading or learning history."
                ),
            }]
            state.setdefault("modeState", {})[selected_environment] = fresh_bucket
            library.append({
                "id": strategy_id,
                "mode": selected_environment,
                "name": strategy_name,
                "source": "active",
                "createdAt": _now(),
                "updatedAt": _now(),
                "config": copy.deepcopy(current_config),
                "metrics": self._strategy_metrics(fresh_bucket),
                "active": True,
            })
            state["strategyLibrary"] = library[-60:]
            self._sync_mode_mirror(
                state,
                selected_environment,
                activate=state.get("activeEnvironment") == selected_environment,
            )
            self._refresh_strategy_library(state)
            self._save()
            return copy.deepcopy(state)

    def enabled_users(self):
        with self._lock:
            return [key for key, value in self._users.items() if value.get("enabled")]

    def configure(self, user_id: str, enabled: bool, config: Mapping[str, Any]) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            normalized = normalize_strategy_config(config)
            environment = _execution_environment(normalized.get("executionMode"))
            bucket = self._mode_bucket(state, environment)
            state["enabled"] = bool(enabled)
            bucket["config"] = normalized
            state["lastError"] = None
            learning = bucket["strategy"].setdefault("learning", {})
            learning.update({
                "enabled": bool(normalized.get("learningMode")),
                "paperOnly": environment != "real",
                "environment": environment,
                "status": "warmup" if normalized.get("learningMode") else "disabled",
                "reviewEvery": int(normalized.get("learningReviewEvery") or 8),
                "windowSize": int(normalized.get("learningWindowSize") or 24),
                "explorationRate": float(normalized.get("learningExplorationRate") or 0.0),
                "aiEnabled": bool(normalized.get("learningAiMode")),
                "aiStatus": "waiting_evidence" if normalized.get("learningAiMode") else "disabled",
                "contrarianMode": bool(normalized.get("learningContrarianMode")),
            })
            if not normalized.get("learningMode"):
                learning["lastReason"] = "Adaptive learning has not been enabled."
            self._sync_mode_mirror(state, environment, activate=True)
            self._refresh_strategy_library(state)
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
            ai_review = copy.deepcopy(decision.get("aiReview") or {})
            if ai_review and ai_review.get("status") not in {None, "not_required"}:
                bucket["strategy"]["preTradeAi"] = ai_review
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
                "aiReview": ai_review,
                "account": dict(decision.get("account") or {}),
                "engine": decision.get("engine"),
                "directionMode": (decision.get("methodology") or {}).get("directionMode") or "normal",
                "explorationTrade": bool(decision.get("explorationTrade")),
                "learningFeatures": {
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
                    "spread": market.get("spread"),
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
            learning_seconds = _number((row.get("learningFeatures") or {}).get("secondsToClose"), -1.0)
            active_config = normalize_strategy_config(bucket.get("config") or {})
            learning_window_open = (
                active_config["minSecondsToClose"] <= learning_seconds <= active_config["maxSecondsToClose"]
            )
            if (
                bucket.get("config", {}).get("learningMode")
                and ticker
                and row.get("side") in {"YES", "NO"}
                and learning_window_open
            ):
                observations = list(bucket.get("learningObservations") or [])
                if not any(str(item.get("ticker") or "") == ticker for item in observations):
                    original_side = row["side"]
                    if row.get("directionMode") == "contrarian":
                        original_side = "NO" if original_side == "YES" else "YES"
                    observations.append({
                        "ticker": ticker,
                        "observedAt": row["generatedAt"],
                        "environment": environment,
                        "side": row["side"],
                        "originalSide": original_side,
                        "fairProbability": row.get("fairProbability"),
                        "price": row.get("price"),
                        "netEdge": row.get("netEdge"),
                        "conservativeEdge": row.get("conservativeEdge"),
                        "blockingReasons": row.get("blockingReasons"),
                        "learningFeatures": row.get("learningFeatures"),
                        "directionMode": row.get("directionMode"),
                        "traded": bool(row.get("orderFilled")),
                        "settled": False,
                    })
                    bucket["learningObservations"] = observations[-MAX_LEARNING_OBSERVATIONS:]
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
            self._refresh_strategy_library(state)
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

        Early closes are useful financial evidence, but they do not reveal the
        eventual binary contract result. Keeping them in a separate ledger
        prevents exit P/L from corrupting Brier score or directional accuracy.
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
            learning = strategy.setdefault("learning", {})
            learning.update({
                "earlyExitSamples": len(records),
                "earlyExitWinRate": strategy["closedTradeWinRate"],
                "earlyExitTotalPnl": strategy["closedTradeTotalPnl"],
                "earlyExitAveragePnl": round(strategy["closedTradeTotalPnl"] / len(records), 4) if records else None,
                "earlyExitCalibrationExcluded": True,
                "earlyExitIncludedInPnlLearning": True,
            })
            self._sync_realized_analytics(strategy, environment)
            self._sync_mode_mirror(state, environment)
            self._refresh_strategy_library(state)
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

    def pending_learning_tickers(self, user_id: str, *, environment: str = "paper"):
        """Return unresolved shadow forecasts used for non-financial learning."""
        environment = _execution_environment(environment)
        with self._lock:
            state = self._state(user_id)
            bucket = self._mode_bucket(state, environment)
            return [
                str(row.get("ticker")) for row in bucket.get("learningObservations") or []
                if row.get("ticker")
                and not row.get("settled")
                and _execution_environment(row.get("environment")) == environment
            ]

    def reconcile_learning_outcome(self, user_id: str, ticker: str, result: str, *, settled_at: str = "", environment: str = "paper") -> Dict[str, Any]:
        """Label a shadow forecast without counting it as a financial trade."""
        result = str(result or "").upper()
        if result not in {"YES", "NO"} or not ticker:
            return self.get(user_id)
        environment = _execution_environment(environment)
        with self._lock:
            state = self._state(user_id)
            bucket = self._mode_bucket(state, environment)
            observations = list(bucket.get("learningObservations") or [])
            examples = list(bucket.get("learningExamples") or [])
            changed = False
            known = {
                f"{_execution_environment(row.get('environment'))}:{str(row.get('ticker') or '')}"
                for row in examples
            }
            for row in observations:
                if (
                    str(row.get("ticker") or "") != ticker
                    or row.get("settled")
                    or _execution_environment(row.get("environment")) != environment
                ):
                    continue
                row["settled"] = True
                row["settledAt"] = settled_at or _now()
                row["result"] = result
                row["selectedHit"] = str(row.get("side") or "").upper() == result
                row["originalHit"] = str(row.get("originalSide") or "").upper() == result
                row["environment"] = environment
                key = f"{environment}:{ticker}"
                if key not in known:
                    examples.append(dict(row))
                    known.add(key)
                changed = True
            if changed:
                bucket["learningObservations"] = observations[-MAX_LEARNING_OBSERVATIONS:]
                bucket["learningExamples"] = examples[-MAX_LEARNING_OBSERVATIONS:]
                learning = bucket["strategy"].setdefault("learning", {})
                window_size = int((bucket.get("config") or {}).get("learningWindowSize") or 24)
                environment_examples = [
                    row for row in bucket["learningExamples"]
                    if _execution_environment(row.get("environment")) == environment
                ]
                window = environment_examples[-window_size:]
                size = len(window)
                original_hits = sum(1 for row in window if row.get("originalHit"))
                selected_hits = sum(1 for row in window if row.get("selectedHit"))
                learning["observedSamples"] = len(environment_examples)
                learning["directionalWindowSamples"] = size
                learning["observedDirectionalAccuracy"] = round(original_hits / size, 4) if size else None
                learning["observedInverseAccuracy"] = round(1.0 - original_hits / size, 4) if size else None
                learning["activeDirectionalAccuracy"] = round(selected_hits / size, 4) if size else None
                learning["tradedSamples"] = sum(1 for row in environment_examples if row.get("traded"))
                self._sync_mode_mirror(state, environment)
                self._refresh_strategy_library(state)
                self._save()
            return copy.deepcopy(state)

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
                learning = strategy.setdefault("learning", {})
                learning.update({
                    "earlyExitSamples": len(closed_records),
                    "earlyExitWinRate": strategy["closedTradeWinRate"],
                    "earlyExitTotalPnl": strategy["closedTradeTotalPnl"],
                    "earlyExitAveragePnl": round(
                        strategy["closedTradeTotalPnl"] / len(closed_records),
                        4,
                    ) if closed_records else None,
                    "earlyExitCalibrationExcluded": True,
                    "earlyExitIncludedInPnlLearning": True,
                })
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
                    "directionMode": str((forecast or {}).get("directionMode") or "normal"),
                    "explorationTrade": bool((forecast or {}).get("explorationTrade")),
                    "learningFeatures": dict((forecast or {}).get("learningFeatures") or {}),
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
                if environment != "real":
                    strategy["consecutiveLosses"] = 0
                    strategy["cooldownUntil"] = None
                elif won:
                    strategy["consecutiveLosses"] = 0
                    strategy["cooldownUntil"] = None
                else:
                    strategy["consecutiveLosses"] = int(strategy.get("consecutiveLosses") or 0) + 1
                    if strategy["consecutiveLosses"] >= 3:
                        strategy["cooldownUntil"] = (
                            settlement_time + timedelta(minutes=30)
                        ).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                processed.add(settlement_key)
                changed = True

            records = sorted(existing_records.values(), key=lambda row: str(row.get("settledAt") or ""))[-MAX_SETTLEMENT_RECORDS:]
            strategy = bucket["strategy"]
            strategy["settlementRecords"] = list(reversed(records))
            strategy["settledSamples"] = len(records)
            if records:
                brier = sum((_number(row.get("fairProbability"), 0.5) - (1.0 if row.get("result") == row.get("side") else 0.0)) ** 2 for row in records) / len(records)
                strategy["brierScore"] = round(brier, 5)
            directional = [
                row for row in records
                if str(row.get("side") or "").upper() in {"YES", "NO"}
                and str(row.get("result") or "").upper() in {"YES", "NO"}
            ]
            normal_hits = 0
            for row in directional:
                selected_hit = str(row.get("side")).upper() == str(row.get("result")).upper()
                normal_hits += int(not selected_hit if row.get("directionMode") == "contrarian" else selected_hit)
            original_accuracy = normal_hits / len(directional) if directional else None
            inverse_accuracy = (1.0 - original_accuracy) if original_accuracy is not None else None
            learning = strategy.setdefault("learning", {})
            learning["originalDirectionalAccuracy"] = round(original_accuracy, 4) if original_accuracy is not None else None
            learning["inverseDirectionalAccuracy"] = round(inverse_accuracy, 4) if inverse_accuracy is not None else None
            learning["directionalSamples"] = len(directional)
            learning["contrarianMode"] = bool((bucket.get("config") or {}).get("learningContrarianMode"))
            learning["environment"] = environment
            self._sync_realized_analytics(strategy, environment)
            realized_records = list(reversed(strategy.get("realizedTradeRecords") or []))
            if self._review_adaptive_learning(
                bucket,
                records,
                realized_records=realized_records,
                environment=environment,
            ):
                changed = True
            if changed or records or realized_records:
                preserved_processed = [
                    str(value) for value in (bucket.get("processedSettlements") or [])
                    if not str(value).startswith(f"{environment}:")
                ][-1000:]
                bucket["processedSettlements"] = (preserved_processed + list(processed))[-1000:]
                self._sync_mode_mirror(state, environment)
                self._refresh_strategy_library(state)
                self._save()
            return copy.deepcopy(state)

    def claim_ai_learning_review(self, user_id: str, *, environment: str = "paper") -> Optional[Dict[str, Any]]:
        """Atomically claim one bounded Settings-AI review for the active execution environment."""
        environment = _execution_environment(environment)
        with self._lock:
            state = self._state(user_id)
            bucket = self._mode_bucket(state, environment)
            config = normalize_strategy_config(bucket.get("config") or {})
            learning = bucket["strategy"].setdefault("learning", {})
            records = [
                row for row in reversed(bucket["strategy"].get("settlementRecords") or [])
                if _execution_environment(row.get("environment")) == environment
            ]
            early_closes = [
                row for row in bucket["strategy"].get("closedTradeRecords") or []
                if _execution_environment(row.get("environment")) == environment
            ]
            observations = [
                row for row in (bucket.get("learningExamples") or [])
                if _execution_environment(row.get("environment")) == environment
            ]
            sample_count = len(observations)
            last_sample_key = f"lastAiReviewSample_{environment}"
            last_sample = int(learning.get(last_sample_key) or 0)
            cadence = max(4, min(24, int(config.get("learningReviewEvery") or 8)))
            if (
                not config.get("learningMode")
                or not config.get("learningAiMode")
                or sample_count < 8
                or sample_count < last_sample + cadence
            ):
                return None
            learning[last_sample_key] = sample_count
            learning["lastAiReviewSample"] = sample_count
            learning["aiStatus"] = "reviewing"
            self._sync_mode_mirror(state, environment)
            self._save()
            safe_records = []
            for row in records[-int(config.get("learningWindowSize") or 24):]:
                safe_records.append({
                    key: row.get(key) for key in (
                        "ticker", "settledAt", "result", "side", "contracts", "pnl",
                        "won", "fairProbability", "directionMode", "explorationTrade",
                        "learningFeatures",
                    )
                })
            safe_observations = []
            for row in observations[-int(config.get("learningWindowSize") or 24):]:
                safe_observations.append({
                    key: row.get(key) for key in (
                        "ticker", "observedAt", "settledAt", "result", "side",
                        "originalSide", "selectedHit", "originalHit", "traded",
                        "fairProbability", "price", "netEdge", "conservativeEdge",
                        "blockingReasons", "learningFeatures", "directionMode",
                    )
                })
            safe_early_closes = []
            for row in early_closes[-int(config.get("learningWindowSize") or 24):]:
                safe_early_closes.append({
                    key: row.get(key) for key in (
                        "ticker", "closedAt", "side", "count", "entryPrice",
                        "exitPrice", "entryFee", "exitFee", "pnl",
                        "executionIntent", "exitValueEdge",
                    )
                })
            realized_records = [
                row for row in reversed(bucket["strategy"].get("realizedTradeRecords") or [])
                if _execution_environment(row.get("environment")) == environment
            ]
            evidence_summary = _learning_evidence_summary(
                safe_records,
                safe_observations,
                safe_early_closes,
                realized_records[-int(config.get("learningWindowSize") or 24):],
            )
            return {
                "environment": environment,
                "sampleCount": sample_count,
                "settledTradeWindow": safe_records,
                "shadowForecastWindow": safe_observations,
                # Early exits are financial/routing evidence only. They help
                # Settings AI diagnose fees, churn and exit quality, but never
                # become binary settlement labels or Brier-score observations.
                "earlyCloseWindow": safe_early_closes,
                "evidenceSummary": evidence_summary,
                "metrics": {
                    "winRate": bucket["strategy"].get("winRate"),
                    "averagePnl": bucket["strategy"].get("averagePnl"),
                    "totalPnl": bucket["strategy"].get("totalPnl"),
                    "brierScore": bucket["strategy"].get("brierScore"),
                    "originalDirectionalAccuracy": learning.get("originalDirectionalAccuracy"),
                    "inverseDirectionalAccuracy": learning.get("inverseDirectionalAccuracy"),
                    "directionalSamples": learning.get("directionalSamples"),
                    "observedDirectionalAccuracy": learning.get("observedDirectionalAccuracy"),
                    "observedInverseAccuracy": learning.get("observedInverseAccuracy"),
                    "activeDirectionalAccuracy": learning.get("activeDirectionalAccuracy"),
                    "observedSamples": learning.get("observedSamples"),
                    "directionalWindowSamples": learning.get("directionalWindowSamples"),
                    "tradedSamples": learning.get("tradedSamples"),
                    "earlyExitSamples": bucket["strategy"].get("closedTradeSamples"),
                    "earlyExitWinRate": bucket["strategy"].get("closedTradeWinRate"),
                    "earlyExitTotalPnl": bucket["strategy"].get("closedTradeTotalPnl"),
                    "realizedSamples": bucket["strategy"].get("realizedSamples"),
                    "realizedWinRate": bucket["strategy"].get("realizedWinRate"),
                    "realizedAveragePnl": bucket["strategy"].get("realizedAveragePnl"),
                    "realizedTotalPnl": bucket["strategy"].get("realizedTotalPnl"),
                },
                "config": config,
            }

    def complete_ai_learning_review(
        self,
        user_id: str,
        review: Mapping[str, Any],
        *,
        provider: str = "",
        model: str = "",
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate and apply an AI diagnosis inside narrow, auditable bounds."""
        with self._lock:
            state = self._state(user_id)
            environment = _execution_environment(review.get("environment") or state.get("activeEnvironment") or (state.get("config") or {}).get("executionMode"))
            bucket = self._mode_bucket(state, environment)
            strategy = bucket["strategy"]
            learning = strategy.setdefault("learning", {})
            learning.update({"aiProvider": provider or None, "aiModel": model or None})
            if error:
                learning.update({
                    "aiStatus": "unavailable",
                    "lastAiReviewAt": _now(),
                    "lastAiDiagnosis": str(error)[:400],
                })
                self._sync_mode_mirror(state, environment)
                self._save()
                return copy.deepcopy(state)

            config = normalize_strategy_config(bucket.get("config") or {})
            before = dict(config)
            confidence = max(0.0, min(1.0, _number(review.get("confidence"))))
            deltas = dict(review.get("adjustments") or {})
            delta_limits = {
                "marketBlendWeight": (-0.05, 0.05),
                "probabilityLogitScale": (-0.05, 0.05),
                "momentumProjectionScale": (-0.02, 0.02),
                "basisReserveBps": (-1.0, 1.0),
                "minNetEdge": (-0.0025, 0.0025),
                "minConservativeEdge": (-0.0015, 0.0015),
                "minModelProbability": (-0.02, 0.02),
                "executionPriceTolerance": (-0.002, 0.002),
                "learningExplorationRate": (-0.05, 0.05),
            }
            applied = {}
            rejected = {}
            realized_samples = int(strategy.get("realizedSamples") or learning.get("realizedSamples") or 0)
            settled_samples = int(strategy.get("settledSamples") or learning.get("settledCalibrationSamples") or 0)
            observed_samples = int(learning.get("observedSamples") or 0)
            early_exit_samples = int(strategy.get("closedTradeSamples") or learning.get("earlyExitSamples") or 0)
            realized_win_rate = _number(strategy.get("realizedWinRate"), _number(strategy.get("winRate"), 0.0))
            realized_average_pnl = _number(strategy.get("realizedAveragePnl"), _number(strategy.get("averagePnl"), 0.0))
            brier_score = _number(strategy.get("brierScore"), -1.0)
            weak_financial_evidence = (
                realized_samples >= 12
                and (realized_average_pnl < 0 or realized_win_rate < V3_WEAK_WIN_RATE)
            )
            poor_calibration = settled_samples >= 12 and brier_score > V3_POOR_BRIER
            evidence_requirements = {
                "marketBlendWeight": (settled_samples, 12, "final settlement labels"),
                "probabilityLogitScale": (settled_samples, 12, "final settlement labels"),
                "momentumProjectionScale": (observed_samples, 24, "settled shadow labels"),
                "basisReserveBps": (observed_samples, 24, "settled shadow labels"),
                "minNetEdge": (realized_samples, 16, "realized trades"),
                "minConservativeEdge": (realized_samples, 16, "realized trades"),
                "minModelProbability": (settled_samples, 12, "final settlement labels"),
                "executionPriceTolerance": (max(early_exit_samples, realized_samples), 12, "execution outcomes"),
                "learningExplorationRate": (min(realized_samples, settled_samples), 12, "realized and finally settled trades"),
            }
            if confidence >= 0.55:
                for key, (low, high) in delta_limits.items():
                    if key not in deltas:
                        continue
                    delta = max(low, min(high, _number(deltas.get(key))))
                    rejection_reason = ""
                    available, required, evidence_name = evidence_requirements[key]
                    if available < required:
                        rejection_reason = f"Rejected: {key} requires {required} {evidence_name}; only {available} available."
                    elif key == "probabilityLogitScale" and delta > 0 and poor_calibration:
                        rejection_reason = "Rejected: poor Brier calibration forbids increasing forecast confidence."
                    elif key == "executionPriceTolerance" and delta > 0 and weak_financial_evidence:
                        rejection_reason = "Rejected: negative fee-adjusted evidence forbids looser execution."
                    elif key == "learningExplorationRate" and delta > 0 and weak_financial_evidence:
                        rejection_reason = "Rejected: exploration cannot expand while realized performance is weak."
                    elif key in {"minNetEdge", "minConservativeEdge", "minModelProbability"} and delta < 0 and weak_financial_evidence:
                        rejection_reason = "Rejected: entry selectivity cannot be loosened while fee-adjusted performance is weak."
                    elif key == "marketBlendWeight" and delta < 0 and poor_calibration:
                        rejection_reason = "Rejected: poor calibration forbids reducing the stabilizing market-price blend."
                    if rejection_reason:
                        rejected[key] = {
                            "requestedDelta": round(delta, 6),
                            "value": config[key],
                            "reason": rejection_reason,
                        }
                        continue
                    value = float(config[key]) + delta
                    config[key] = value
                    applied[key] = {
                        "before": before[key],
                        "after": config[key],
                        "delta": round(delta, 6),
                        "reason": "Bounded Settings AI calibration proposal.",
                    }

            sample_count = int(learning.get("observedSamples") or 0)
            original_accuracy = _number(learning.get("observedDirectionalAccuracy"), -1.0)
            inverse_accuracy = _number(learning.get("observedInverseAccuracy"), -1.0)
            traded_samples = int(learning.get("directionalSamples") or 0)
            traded_original_accuracy = _number(learning.get("originalDirectionalAccuracy"), -1.0)
            traded_inverse_accuracy = _number(learning.get("inverseDirectionalAccuracy"), -1.0)
            recommendation = str(review.get("directionRecommendation") or "hold").strip().lower()
            if (
                recommendation == "contrarian"
                and confidence >= 0.75
                and sample_count >= 24
                and inverse_accuracy >= 0.58
                and inverse_accuracy - original_accuracy >= 0.15
                and traded_samples >= 12
                and traded_inverse_accuracy >= traded_original_accuracy + 0.10
                and _number(strategy.get("averagePnl")) < 0
            ):
                config["learningContrarianMode"] = True
                applied["learningContrarianMode"] = {
                    "before": bool(before.get("learningContrarianMode")),
                    "after": True,
                    "reason": "Shadow and traded settlement cohorts independently support inversion.",
                }
            elif recommendation == "contrarian":
                rejected["learningContrarianMode"] = {
                    "requested": True,
                    "value": bool(config.get("learningContrarianMode")),
                    "reason": "Rejected: direction changes require agreement from both shadow and traded settlement cohorts.",
                }
            elif (
                recommendation == "normal"
                and config.get("learningContrarianMode")
                and confidence >= 0.75
                and sample_count >= 24
                and original_accuracy >= inverse_accuracy + 0.15
            ):
                config["learningContrarianMode"] = False
                applied["learningContrarianMode"] = {
                    "before": True,
                    "after": False,
                    "reason": "Stable shadow evidence restored the normal direction.",
                }

            config = normalize_strategy_config(config)
            # The language model never increases sizing or risk. Those remain
            # under the deterministic walk-forward controller.
            config["riskPerTradePct"] = before["riskPerTradePct"]
            bucket["config"] = config
            reasons = [str(value)[:240] for value in (review.get("reasons") or [])][:5]
            learning.update({
                "aiStatus": "reviewed",
                "lastAiReviewAt": _now(),
                "lastAiDiagnosis": str(review.get("diagnosis") or "AI review completed.")[:500],
                "lastAiRootCause": str(review.get("rootCause") or "insufficient_data")[:80],
                "lastAiTargetMetric": str(review.get("targetMetric") or "")[:120],
                "lastAiExpectedEffect": str(review.get("expectedEffect") or "")[:240],
                "lastAiEvidenceUsed": [str(value)[:180] for value in (review.get("evidenceUsed") or [])][:6],
                "lastAiReasons": reasons,
                "lastAiAdjustments": applied,
                "lastAiRejectedAdjustments": rejected,
                "aiConfidence": round(confidence, 4),
                "aiDirectionRecommendation": recommendation,
                "contrarianMode": bool(config.get("learningContrarianMode")),
            })
            if applied:
                learning["adjustmentCount"] = int(learning.get("adjustmentCount") or 0) + 1
            if applied or rejected:
                strategy["version"] = int(strategy.get("version") or 1) + 1
                strategy["changes"].insert(0, {
                    "at": _now(),
                    "version": strategy["version"],
                    "source": "settings_ai_bounded_calibration",
                    "summary": learning["lastAiDiagnosis"],
                    "before": before,
                    "after": config,
                    "applied": applied,
                    "rejected": rejected,
                    "evidence": {
                        "realizedSamples": realized_samples,
                        "realizedWinRate": round(realized_win_rate, 4),
                        "realizedAveragePnl": round(realized_average_pnl, 4),
                        "settledSamples": settled_samples,
                        "observedSamples": observed_samples,
                        "earlyExitSamples": early_exit_samples,
                        "brierScore": round(brier_score, 5) if brier_score >= 0 else None,
                    },
                })
                strategy["changes"] = strategy["changes"][:50]
            self._sync_mode_mirror(state, environment)
            self._refresh_strategy_library(state)
            self._save()
            return copy.deepcopy(state)

    @staticmethod
    def _review_adaptive_learning(
        state: Dict[str, Any],
        records,
        *,
        realized_records=None,
        environment: str,
    ) -> bool:
        """Review settled evidence for the active environment and make one bounded parameter update.

        This is an adaptive walk-forward controller, not an unconstrained
        self-modifying model.  It increases exploration only when recent
        evidence is neutral, tightens immediately when calibration or net P/L
        deteriorates, and never bypasses deterministic risk limits.
        """
        environment = _execution_environment(environment)
        env_label = "Kalshi Real" if environment == "real" else "AlphaLab Paper"
        strategy = state["strategy"]
        config = normalize_strategy_config(state.get("config") or {})
        learning = strategy.setdefault("learning", {})
        enabled = bool(config.get("learningMode"))
        review_every = int(config.get("learningReviewEvery") or 8)
        window_size = int(config.get("learningWindowSize") or 24)
        exploration = float(config.get("learningExplorationRate") or 0.0)
        performance_records = list(realized_records if realized_records is not None else records)
        sample_count = len(performance_records)
        minimum_samples = 12
        last_review_sample = int(learning.get("lastReviewSample") or 0)
        next_review_sample = max(minimum_samples, last_review_sample + review_every)
        learning.update({
            "enabled": enabled,
            "paperOnly": environment != "real",
            "environment": environment,
            "reviewEvery": review_every,
            "windowSize": window_size,
            "explorationRate": round(exploration, 4),
            "nextReviewSample": next_review_sample,
        })

        if not enabled:
            learning["status"] = "disabled"
            learning["lastReason"] = "Adaptive learning has not been enabled."
            return False
        if sample_count < next_review_sample:
            learning["status"] = "warmup"
            learning["lastReason"] = (
                f"Collecting realized {env_label} P/L evidence ({sample_count}/{next_review_sample})."
            )
            return False

        window = performance_records[-window_size:]
        calibration_window = list(records)[-window_size:]
        wins = sum(1 for row in window if _number(row.get("pnl")) > 0)
        win_rate = wins / max(1, len(window))
        average_pnl = sum(_number(row.get("pnl")) for row in window) / max(1, len(window))
        brier = sum(
            (_number(row.get("fairProbability"), 0.5) - (1.0 if row.get("result") == row.get("side") else 0.0)) ** 2
            for row in calibration_window
        ) / len(calibration_window) if len(calibration_window) >= 12 else None

        before = dict(config)
        reasons = []
        weak_performance = average_pnl < 0 or win_rate < V3_WEAK_WIN_RATE
        poor_calibration = brier is not None and brier > V3_POOR_BRIER
        early_closes = [row for row in window if str(row.get("exitType") or "") == "sale"]
        early_close_average = (
            sum(_number(row.get("pnl")) for row in early_closes) / len(early_closes)
            if early_closes else None
        )
        if poor_calibration or weak_performance:
            config["riskPerTradePct"] = max(0.10, float(config["riskPerTradePct"]) * 0.85)
            config["minNetEdge"] = min(0.10, float(config["minNetEdge"]) + 0.0025)
            config["minConservativeEdge"] = min(0.05, float(config["minConservativeEdge"]) + 0.0015)
            config["minModelProbability"] = min(0.90, float(config.get("minModelProbability") or 0.60) + 0.01)
            config["learningExplorationRate"] = max(0.05, exploration * 0.75)
            config["marketBlendWeight"] = min(0.50, float(config["marketBlendWeight"]) + 0.025)
            if poor_calibration:
                config["probabilityLogitScale"] = max(1.40, float(config["probabilityLogitScale"]) - 0.05)
                reasons.append("settled forecasts were overconfident; forecast extremity was reduced and favorite selectivity raised")
            if weak_performance:
                reasons.append("fee-adjusted hit rate or net P/L weakened below the favorite-carry benchmark; sizing and exploration were reduced")
            if early_close_average is not None and early_close_average < 0:
                config["executionPriceTolerance"] = max(0.0, float(config["executionPriceTolerance"]) - 0.002)
                config["maxSpread"] = max(0.04, float(config["maxSpread"]) - 0.005)
                config["maxBookParticipation"] = max(0.10, float(config["maxBookParticipation"]) - 0.025)
                reasons.append("early exits lost money after fees; crossing, spread, and book participation were tightened")
        elif (
            len(window) >= 16
            and win_rate >= V3_STRONG_WIN_RATE
            and average_pnl > 0
            and (brier is None or brier <= V3_GOOD_BRIER)
        ):
            risk_cap = float(config.get("learningMaxRiskPct") or 0.50)
            config["riskPerTradePct"] = min(risk_cap, float(config["riskPerTradePct"]) * 1.08)
            config["minNetEdge"] = max(0.005, float(config["minNetEdge"]) - 0.0015)
            config["minConservativeEdge"] = max(0.0, float(config["minConservativeEdge"]) - 0.0005)
            reasons.append(f"recent {env_label} window beat the favorite-carry benchmark; sizing expanded cautiously")
        else:
            # A neutral window uses only the configured exploration budget. It
            # can collect more fills, but cannot cross the hard edge,
            # spread, exposure, loss-stop, or order-size bounds.
            relaxation = min(0.0025, exploration * 0.0125)
            config["minNetEdge"] = max(0.005, float(config["minNetEdge"]) - relaxation)
            config["minConservativeEdge"] = max(0.0, float(config["minConservativeEdge"]) - relaxation * 0.4)
            reasons.append(f"recent {env_label} evidence was neutral; signal thresholds relaxed slightly while execution limits stayed fixed")

        config = normalize_strategy_config(config)
        config["riskPerTradePct"] = min(
            float(config["riskPerTradePct"]),
            float(config.get("learningMaxRiskPct") or 0.50),
        )
        changed = config != before
        if changed:
            reason = "; ".join(reasons)
            applied = _config_adjustments(before, config, reason)
            state["config"] = config
            strategy["version"] = int(strategy.get("version") or 1) + 1
            strategy["changes"].insert(0, {
                "at": _now(),
                "version": strategy["version"],
                "source": f"adaptive_{environment}_learning",
                "summary": reason,
                "before": before,
                "after": config,
                "applied": applied,
                "metrics": {
                    "samples": len(window),
                    "winRate": round(win_rate, 4),
                    "averagePnl": round(average_pnl, 4),
                    "brierScore": round(brier, 5) if brier is not None else None,
                    "settledCalibrationSamples": len(calibration_window),
                    "earlyExitSamples": len(early_closes),
                    "earlyExitAveragePnl": round(early_close_average, 4) if early_close_average is not None else None,
                },
            })
            strategy["changes"] = strategy["changes"][:50]

        learning.update({
            "status": "reviewed",
            "lastReviewSample": sample_count,
            "nextReviewSample": sample_count + review_every,
            "lastReviewAt": _now(),
            "lastReason": "; ".join(reasons),
            "recentWinRate": round(win_rate, 4),
            "recentAveragePnl": round(average_pnl, 4),
            "recentBrierScore": round(brier, 5) if brier is not None else None,
            "realizedSamples": sample_count,
            "settledCalibrationSamples": len(calibration_window),
            "adjustmentCount": int(learning.get("adjustmentCount") or 0) + (1 if changed else 0),
            "explorationRate": round(float(config.get("learningExplorationRate") or 0.0), 4),
        })
        return True

    def list_strategies(self, user_id: str, *, environment: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            self._refresh_strategy_library(state)
            selected_environment = _execution_environment(environment or state.get("activeEnvironment"))
            strategies = [
                copy.deepcopy(item) for item in state.get("strategyLibrary") or []
                if environment is None or _execution_environment((item or {}).get("mode")) == selected_environment
            ]
            recommendation = self._recommend_from_items(strategies)
            return {
                "success": True,
                "activeEnvironment": selected_environment,
                "activeStrategyId": self._mode_bucket(state, selected_environment).get("activeStrategyId"),
                "recommendedStrategyId": recommendation.get("id") if recommendation else None,
                "strategies": strategies,
            }

    def save_strategy(
        self,
        user_id: str,
        config: Mapping[str, Any],
        *,
        name: str = "",
        environment: Optional[str] = None,
        source: str = "manual",
    ) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            normalized = normalize_strategy_config(config)
            selected_environment = _execution_environment(environment or normalized.get("executionMode"))
            normalized["executionMode"] = selected_environment
            bucket = self._mode_bucket(state, selected_environment)
            existing = [
                item for item in state.setdefault("strategyLibrary", [])
                if _execution_environment((item or {}).get("mode")) == selected_environment
                and str((item or {}).get("source")) != "active"
            ]
            strategy_id = f"{selected_environment}-strategy-{len(existing) + 1}"
            created = {
                "id": strategy_id,
                "mode": selected_environment,
                "name": (name or ("Real Strategy" if selected_environment == "real" else "Paper Strategy"))[:80],
                "source": source,
                "createdAt": _now(),
                "updatedAt": _now(),
                "config": copy.deepcopy(normalized),
                "metrics": self._strategy_metrics(bucket),
                "active": False,
            }
            state["strategyLibrary"].append(created)
            state["strategyLibrary"] = state["strategyLibrary"][-60:]
            self._refresh_strategy_library(state)
            self._save()
            return {"success": True, "strategy": copy.deepcopy(created), **self.list_strategies(user_id, environment=selected_environment)}

    def apply_strategy(
        self,
        user_id: str,
        strategy_id: str,
        *,
        environment: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            self._refresh_strategy_library(state)
            strategy = next((item for item in state.get("strategyLibrary") or [] if str(item.get("id")) == str(strategy_id)), None)
            if not strategy:
                raise KeyError("strategy_not_found")
            strategy_environment = _execution_environment(strategy.get("mode"))
            if environment is not None and _execution_environment(environment) != strategy_environment:
                raise ValueError("strategy_mode_mismatch")
            bucket = self._mode_bucket(state, strategy_environment)
            config = normalize_strategy_config(strategy.get("config") or {})
            config["executionMode"] = strategy_environment
            bucket["config"] = config
            bucket["activeStrategyId"] = str(strategy.get("id"))
            bucket["strategy"].setdefault("learning", {}).update({
                "enabled": bool(config.get("learningMode")),
                "paperOnly": strategy_environment != "real",
                "environment": strategy_environment,
                "aiEnabled": bool(config.get("learningAiMode")),
                "contrarianMode": bool(config.get("learningContrarianMode")),
                "explorationRate": float(config.get("learningExplorationRate") or 0.0),
            })
            self._sync_mode_mirror(state, strategy_environment, activate=True)
            self._refresh_strategy_library(state)
            self._save()
            return copy.deepcopy(state)

    @staticmethod
    def _recommend_from_items(items) -> Optional[Dict[str, Any]]:
        best = None
        best_score = float("-inf")
        for item in items or []:
            metrics = dict((item or {}).get("metrics") or {})
            samples = _number(metrics.get("realizedSamples") or metrics.get("settledSamples"))
            win_rate = _number(metrics.get("winRate"), 0.0)
            pnl = _number(metrics.get("totalPnl"), 0.0)
            brier = _number(metrics.get("brierScore"), 0.35)
            adjustment = min(10.0, _number(metrics.get("adjustmentCount"), 0.0))
            score = (win_rate * 100.0) + min(25.0, samples) + min(40.0, pnl / 25.0) - (brier * 40.0) + adjustment
            if samples < 4:
                score -= 15.0
            if score > best_score:
                best_score = score
                best = dict(item)
                best["recommendationScore"] = round(score, 2)
        return best

    def recommend_strategy(self, user_id: str, *, environment: str = "paper") -> Dict[str, Any]:
        with self._lock:
            state = self._state(user_id)
            environment = _execution_environment(environment)
            self._refresh_strategy_library(state)
            items = [
                copy.deepcopy(item) for item in state.get("strategyLibrary") or []
                if _execution_environment((item or {}).get("mode")) == environment
            ]
            recommended = self._recommend_from_items(items)
            return {
                "success": True,
                "activeEnvironment": environment,
                "recommendedStrategyId": recommended.get("id") if recommended else None,
                "strategy": recommended,
                "reason": (
                    "Highest blend of win rate, net P/L, sample size, Brier score, and adaptive-adjustment evidence."
                    if recommended else "No saved strategy is available for this mode."
                ),
            }


__all__ = ["KalshiRobotState"]
