"""Versioned stock research mandate, independent of legacy AI risk profiles."""
from copy import deepcopy

PROGRAM = "equity_swing_v1"
STRATEGY_VERSION = "equity_fixed_v1"
INITIAL_CAPITAL = 2000.0
# Registered ETF baseline. Individual equities require a dated universe archive.
ETF_GROUPS = {"SPY": "us_equity", "QQQ": "us_equity", "IWM": "us_equity",
              "XLF": "us_equity", "TLT": "treasuries", "IEF": "treasuries",
              "GLD": "metals", "SLV": "metals"}


def equity_policy(base=None):
    policy = deepcopy(base or {})
    policy.update({
        "version": STRATEGY_VERSION, "strategyVersion": STRATEGY_VERSION,
        "strategyProgram": PROGRAM, "equitySwingV1": True,
        "initialCapital": INITIAL_CAPITAL, "riskProfile": "fixed",
        "timeHorizon": "swing", "label": "Stock swing v1",
        "leverageEnabled": False, "allowOptions": False, "allowMargin": False,
        "assetScope": "ordinary_equities_and_etfs", "longOnly": True,
        "targetExposurePct": 80.0, "maxGrossExposurePct": 80.0,
        "targetDeploymentPct": 80.0,
        "maxSinglePositionPct": 20.0, "riskPerTradePct": 0.5,
        "maxPositions": 4, "maxPortfolioPositions": 4, "maxOpenBuyOrders": 4,
        "maxOpenBuys": 4,
        "maxOpenStopRiskPct": 2.0, "maxCorrelatedExposurePct": 40.0,
        "sectorCapPct": 40.0, "dailyLossStopPct": 1.5,
        "maxDrawdownPct": 12.0, "maxHoldingDays": 20,
        "timeStopDays": 20, "holdingPeriod": "Up to 20 trading sessions",
        "timeStopSessions": 20, "atrStopMultiplier": 2.0,
        "trailActivationR": 1.0, "partialExitsAllowed": False,
        "allowScaleIn": False, "maxScaleIns": 0, "target1ReducePct": 0,
        "scaleInAllowed": False, "leverageRequested": False,
        "leveragedSleeveMaxPct": 0.0, "optionsAllowed": False,
        "monthlyOperatingCost": 0.0, "aiRequired": False,
        "wholeSharesOnly": True, "executionFeed": "iex",
        "brokerEntryTimeInForce": "gtc", "entryValidity": "execution_session",
        "protectiveTimeInForce": "gtc",
        "executionFeedIsNBBO": False, "researchFeed": "sip",
        "maxQuoteAgeSeconds": 30, "maxSlippageBps": 10,
        "maxSpreadBps": 30, "feeReserveBps": 5,
        "executionFeeReserveBps": 5,
        "buyingPowerBufferPct": 0.0, "slippageCapBps": 10.0,
    })
    policy["effectiveLimits"] = {key: policy[key] for key in (
        "maxGrossExposurePct", "maxSinglePositionPct", "riskPerTradePct",
        "maxPositions", "maxOpenStopRiskPct", "maxCorrelatedExposurePct",
        "dailyLossStopPct", "maxDrawdownPct", "sectorCapPct")}
    permissions = dict(policy.get("permissions") or {})
    permissions.update({"aiResearch": False, "aiChallenge": False,
                        "aiSelects": False, "autoScaleIn": False, "autoReduce": False,
                        "optionsExecution": False, "leveragedProducts": False})
    policy["permissions"] = permissions
    return policy


def business_outcome(summary):
    """Transport success must not hide data/AI/funding failures."""
    if not isinstance(summary, dict):
        return "failed"
    if summary.get("errors") or summary.get("lastError"):
        return "failed"
    explicit = summary.get("businessStatus")
    if explicit in {"completed", "no_signal", "capital_blocked", "data_insufficient",
                    "ai_degraded", "research_blocked", "risk_paused", "market_closed",
                    "stopped", "failed"}:
        return explicit
    if summary.get("stopped"):
        return "stopped"
    # Legacy scanner failures are frequently nested in step results.
    def ai_failed(value, in_ai=False):
        if isinstance(value, dict):
            for key, item in value.items():
                context = in_ai or key.lower().startswith('ai')
                if context and ("error" in key.lower() or "status" in key.lower()):
                    if item not in (None, "", False, "ok", "success", "completed", "not_requested"):
                        if isinstance(item, str) and any(marker in item.lower() for marker in ('skipped', 'candidate rejected', 'no candidates', 'not requested')):
                            continue
                        return True
                if ai_failed(item, context):
                    return True
        elif isinstance(value, list):
            return any(ai_failed(item, in_ai) for item in value)
        return False
    if ai_failed(summary):
        return "ai_degraded"
    return "completed" if summary.get("orders_submitted") else "no_signal"
