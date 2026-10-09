"""Durable, fee-net daily loss streaks for the two managed BTC strategies.

A partial sale is not a new bet.  Only quantity-reconciled completed markets
count, and correlated hourly strikes are combined into one event outcome.
"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Any, Mapping
from zoneinfo import ZoneInfo


RISK_TIMEZONE = ZoneInfo("America/New_York")
DAILY_LOSS_STREAK_LIMIT = 3
FAMILIES = ("btc15m", "btchourly")


def _number(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return 0.0
    return result if math.isfinite(result) else 0.0


def _time(value: Any) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def risk_family(ticker: Any) -> str | None:
    value = str(ticker or "").upper()
    if value.startswith("KXBTC15M-"):
        return "btc15m"
    if value.startswith("KXBTCD-"):
        return "btchourly"
    return None


def _event(ticker: str) -> str:
    # A KXBTCD event may have many strike markets. They share a settlement
    # reference and must never count as multiple independent losing bets.
    match = re.match(r"^(KXBTCD-.+?)-[TB]\d", ticker, flags=re.IGNORECASE)
    return match.group(1) if match else ticker


def _quantity(row: Mapping[str, Any]) -> float:
    for key in ("fill_count_fp", "count_fp", "fillCount", "fill_count", "count"):
        if row.get(key) not in (None, ""):
            return max(0.0, _number(row[key]))
    return 0.0


def _order_id(row: Mapping[str, Any]) -> str:
    return str(row.get("order_id") or row.get("orderId") or row.get("client_order_id") or row.get("clientOrderId") or "")


def _entry(row: Mapping[str, Any]) -> bool:
    action = str(row.get("action") or "").upper()
    return not row.get("reduce_only") and (action == "BUY" or action.startswith("BUY_"))


def _empty(family: str | None, now: datetime) -> dict[str, Any]:
    day = now.astimezone(RISK_TIMEZONE).date()
    tomorrow = datetime.combine(day + timedelta(days=1), time(), RISK_TIMEZONE)
    return {
        "date": day.isoformat(),
        "timezone": "America/New_York",
        "family": family,
        "limit": DAILY_LOSS_STREAK_LIMIT,
        "consecutiveLosses": 0,
        "maxConsecutiveLosses": 0,
        "stopped": False,
        "stoppedAt": None,
        "resumeAt": _utc(tomorrow),
        "completedOutcomes": 0,
        "netPnl": 0.0,
        "recentOutcomes": [],
    }


def daily_risk_for_ticker(
    strategy: Mapping[str, Any], ticker: str, now: datetime | None = None,
) -> dict[str, Any]:
    """Return the current NY-day gate, including expiry before reconciliation."""
    now = now or datetime.now(timezone.utc)
    family = risk_family(ticker)
    result = _empty(family, now)
    saved = dict((strategy.get("dailyRiskByFamily") or {}).get(family) or {})
    if saved.get("date") == result["date"]:
        result.update(saved)
    # The stop is a policy, not an adjustable strategy setting.
    result["limit"] = DAILY_LOSS_STREAK_LIMIT
    return result


def rebuild_daily_risk(
    strategy: Mapping[str, Any],
    filled_trades: list[Mapping[str, Any]],
    *,
    fills: list[Mapping[str, Any]] | None = None,
    environment: str = "paper",
    now: datetime | None = None,
) -> dict[str, dict[str, Any]]:
    """Rebuild completed outcomes and preserve any same-day stop latch.

    Recorded strategy BUY orders establish ownership. Authenticated managed
    fills replace their acknowledgement quantities; distinct fills under one
    order are summed once. Paper fills are from AlphaLab's private ledger.
    Sales/settlements already contain net P/L including allocated entry fees.
    Missing entry evidence never turns a sale into a completed outcome.
    """
    now = now or datetime.now(timezone.utc)
    orders: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(filled_trades):
        if str(row.get("environment") or environment) != environment or not _entry(row):
            continue
        ticker = str(row.get("ticker") or row.get("market_ticker") or "")
        if not risk_family(ticker) or _quantity(row) <= 0:
            continue
        identity = _order_id(row) or f"record:{ticker}:{row.get('generatedAt')}:{index}"
        orders[identity] = {"ticker": ticker, "quantity": _quantity(row)}

    canonical: dict[str, dict[str, Any]] = {}
    seen: set[str] = set()
    for row in fills or []:
        if str(row.get("environment") or environment) != environment or not _entry(row):
            continue
        ticker = str(row.get("ticker") or row.get("market_ticker") or "")
        identity = _order_id(row)
        if not risk_family(ticker) or not identity or _quantity(row) <= 0:
            continue
        if environment == "real" and identity not in orders and not row.get("alphaLabManaged"):
            continue
        fill_id = str(row.get("fill_id") or row.get("trade_id") or identity)
        if fill_id in seen:
            continue
        seen.add(fill_id)
        item = canonical.setdefault(identity, {"ticker": ticker, "quantity": 0.0})
        item["quantity"] += _quantity(row)
    for identity, row in canonical.items():
        # A fetched fill window may omit an earlier partial fill. Never shrink
        # a previously acknowledged entry quantity and falsely complete it.
        row["quantity"] = max(row["quantity"], (orders.get(identity) or {}).get("quantity", 0.0))
        orders[identity] = row

    entries: dict[str, float] = defaultdict(float)
    for row in orders.values():
        entries[row["ticker"]] += row["quantity"]
    groups: dict[str, set[str]] = defaultdict(set)
    for ticker in entries:
        groups[_event(ticker)].add(ticker)

    realized: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    seen_records: set[str] = set()
    for row in strategy.get("realizedTradeRecords") or []:
        ticker = str(row.get("ticker") or "")
        at = _time(row.get("settledAt") or row.get("closedAt"))
        if ticker not in entries or not at or at > now:
            continue
        if str(row.get("environment") or environment) != environment:
            continue
        identity = str(row.get("key") or f"{ticker}:{row.get('orderId')}:{_utc(at)}:{row.get('exitType')}")
        if identity in seen_records:
            continue
        seen_records.add(identity)
        realized[ticker].append(row)

    outcomes: dict[str, list[dict[str, Any]]] = {family: [] for family in FAMILIES}
    for event, tickers in groups.items():
        rows = []
        for ticker in tickers:
            ticker_rows = realized.get(ticker, [])
            # Settlement quantity is remaining inventory, so it is additive
            # with prior partial sales. Full early closes have no settlement
            # record in the canonical analytics ledger.
            completed = sum(max(0.0, _number(row.get("contracts"))) for row in ticker_rows)
            if not ticker_rows or abs(completed - entries[ticker]) > 1e-6:
                break
            rows.extend(ticker_rows)
        else:
            completed_at = max(_time(row.get("settledAt") or row.get("closedAt")) for row in rows)
            if completed_at.astimezone(RISK_TIMEZONE).date() != now.astimezone(RISK_TIMEZONE).date():
                continue
            outcomes[risk_family(next(iter(tickers)))].append({
                "eventTicker": event,
                "tickers": sorted(tickers),
                "completedAt": _utc(completed_at),
                "netPnl": round(sum(_number(row.get("pnl")) for row in rows), 4),
            })

    result = {}
    for family in FAMILIES:
        risk = _empty(family, now)
        previous = dict((strategy.get("dailyRiskByFamily") or {}).get(family) or {})
        for outcome in sorted(outcomes[family], key=lambda item: (_time(item["completedAt"]), item["eventTicker"])):
            # A break-even completed event interrupts the losing streak.
            risk["consecutiveLosses"] = risk["consecutiveLosses"] + 1 if outcome["netPnl"] < 0 else 0
            risk["maxConsecutiveLosses"] = max(risk["maxConsecutiveLosses"], risk["consecutiveLosses"])
            risk["completedOutcomes"] += 1
            risk["netPnl"] = round(risk["netPnl"] + outcome["netPnl"], 4)
            risk["recentOutcomes"].append(outcome)
            if risk["consecutiveLosses"] >= DAILY_LOSS_STREAK_LIMIT and not risk["stopped"]:
                risk["stopped"] = True
                risk["stoppedAt"] = outcome["completedAt"]
        risk["recentOutcomes"] = risk["recentOutcomes"][-20:]
        if previous.get("date") == risk["date"] and previous.get("stopped"):
            # Late wins, corrected history, process restarts, and config edits
            # do not re-arm entries once the stop has fired for this NY day.
            risk["stopped"] = True
            risk["stoppedAt"] = previous.get("stoppedAt") or risk["stoppedAt"]
            risk["maxConsecutiveLosses"] = max(risk["maxConsecutiveLosses"], int(_number(previous.get("maxConsecutiveLosses"))))
        result[family] = risk
    return result
