"""Kalshi market data and per-user API connection routes."""

from __future__ import annotations

import base64
import copy
import hashlib
import math
import os
import re
import statistics
import threading
import time
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterator, Mapping, Optional, Tuple

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from flask import Blueprint, jsonify, request

try:
    from kalshi_engine import (
        BTC_15M_SERIES,
        evaluate_btc15_contract,
        normalize_strategy_config,
        select_btc15_market,
    )
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_engine import (
        BTC_15M_SERIES,
        evaluate_btc15_contract,
        normalize_strategy_config,
        select_btc15_market,
    )
try:
    from kalshi_robot_state import KalshiRobotState
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_robot_state import KalshiRobotState
try:
    from kalshi_paper import KalshiPaperAccountStore, executable_bid_levels, taker_fill_amounts
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_paper import KalshiPaperAccountStore, executable_bid_levels, taker_fill_amounts
try:
    from kalshi_reference_stream import KalshiReferenceStream
except ImportError:  # pragma: no cover - package-style test imports
    from .kalshi_reference_stream import KalshiReferenceStream


KALSHI_PUBLIC_BASE = "https://external-api.kalshi.com/trade-api/v2"
COINBASE_EXCHANGE_BASE = "https://api.exchange.coinbase.com"
BITSTAMP_BASE = "https://www.bitstamp.net/api/v2"
GEMINI_BASE = "https://api.gemini.com/v1"
KRAKEN_BASE = "https://api.kraken.com/0/public"
KALSHI_ENVIRONMENTS = {
    "production": KALSHI_PUBLIC_BASE,
}
KALSHI_ROUTING_LEASE_TTL_SECONDS = 30
KALSHI_ROUTING_LEASE_TIMEOUT_SECONDS = 5.0


def _is_btc15_ticker(value: Any) -> bool:
    """Return whether a ticker belongs to the legacy 15-minute robot."""
    return str(value or "").upper().startswith(str(BTC_15M_SERIES).upper())


BTC_HOURLY_SERIES = "KXBTCD"


def _market_family(value: Any) -> Optional[str]:
    ticker = str(value or "").upper()
    if ticker.startswith(str(BTC_15M_SERIES).upper()):
        return "btc15m"
    if ticker.startswith(BTC_HOURLY_SERIES):
        return "btchourly"
    return None


def _is_supported_kalshi_ticker(value: Any) -> bool:
    return _market_family(value) is not None


def _tag_market_family(row: Mapping[str, Any]) -> Dict[str, Any]:
    result = dict(row or {})
    result["market_family"] = _market_family(
        result.get("ticker") or result.get("market_ticker")
    )
    return result


def _family_performance(strategy: Mapping[str, Any]) -> Dict[str, Dict[str, Any]]:
    records = [
        dict(row) for row in (strategy.get("realizedTradeRecords") or [])
        if isinstance(row, Mapping)
    ]
    output: Dict[str, Dict[str, Any]] = {}
    for family, label in (("btc15m", "BTC 15-minute"), ("btchourly", "BTC hourly strikes")):
        selected = [row for row in records if _market_family(row.get("ticker")) == family]
        pnl_values = [_finite_number(row.get("pnl"), 0.0) for row in selected]
        wins = sum(1 for value in pnl_values if value > 0)
        cumulative = 0.0
        curve = []
        for row, pnl in reversed(list(zip(selected, pnl_values))):
            cumulative = round(cumulative + pnl, 4)
            curve.append({
                "at": row.get("settledAt") or row.get("closedAt"),
                "pnl": round(pnl, 4),
                "cumulativePnl": cumulative,
                "ticker": row.get("ticker"),
            })
        output[family] = {
            "family": family,
            "label": label,
            "samples": len(selected),
            "uniqueMarkets": len({
                str(row.get("ticker") or "") for row in selected if row.get("ticker")
            }),
            "settlementEvents": sum(
                str(row.get("exitType") or "").lower() == "settlement"
                for row in selected
            ),
            "saleEvents": sum(
                str(row.get("exitType") or "").lower() == "sale"
                for row in selected
            ),
            "wins": wins,
            "losses": max(0, len(selected) - wins),
            "winRate": round(wins / len(selected), 4) if selected else None,
            "realizedPnl": round(sum(pnl_values), 4),
            "averagePnl": round(sum(pnl_values) / len(selected), 4) if selected else 0.0,
            "records": [_tag_market_family(row) for row in selected],
            "equityCurve": curve,
        }
    return output


_PORTFOLIO_ANALYTICS_KEYS = (
    "settledSamples", "wins", "losses", "winRate", "totalPnl",
    "averagePnl", "bestTrade", "worstTrade", "settlementRecords",
    "closedTradeRecords", "realizedTradeRecords", "realizedSamples",
    "realizedWins", "realizedLosses", "realizedWinRate",
    "realizedTotalPnl", "realizedAveragePnl", "realizedBestTrade",
    "realizedWorstTrade", "equityCurve",
)


def _portfolio_analytics(strategy: Mapping[str, Any]) -> Dict[str, Any]:
    analytics = {key: strategy.get(key) for key in _PORTFOLIO_ANALYTICS_KEYS}
    analytics["marketPerformance"] = _family_performance(strategy)
    return analytics


def _portfolio_timestamp(value: Any) -> Optional[float]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except (TypeError, ValueError, OverflowError):
        return None


def _portfolio_record_timestamp(row: Mapping[str, Any]) -> Optional[float]:
    return _portfolio_timestamp(
        row.get("settledAt")
        or row.get("closedAt")
        or row.get("settled_time")
        or row.get("created_time")
        or row.get("updated_time")
    )


def _portfolio_rows_after(rows: Any, reset_timestamp: float) -> list:
    visible = []
    for row in rows or []:
        if not isinstance(row, Mapping):
            continue
        row_timestamp = _portfolio_record_timestamp(row)
        if row_timestamp is not None and row_timestamp > reset_timestamp:
            visible.append(dict(row))
    return visible


def _portfolio_realized_summary(records: Any, *, baseline_at: Optional[str] = None) -> Dict[str, Any]:
    clean = [dict(row) for row in records or [] if isinstance(row, Mapping)]
    pnl_values = [_finite_number(row.get("pnl"), 0.0) for row in clean]
    wins = sum(value > 0 for value in pnl_values)
    total = round(sum(pnl_values), 4)
    chronological = sorted(
        clean,
        key=lambda row: _portfolio_record_timestamp(row) or 0.0,
    )
    cumulative = 0.0
    curve = []
    if baseline_at:
        curve.append({
            "at": baseline_at,
            "ticker": "DISPLAY-BASELINE",
            "pnl": 0.0,
            "cumulativePnl": 0.0,
            "environment": None,
            "displayBaseline": True,
        })
    for row in chronological:
        pnl = _finite_number(row.get("pnl"), 0.0)
        cumulative = round(cumulative + pnl, 4)
        curve.append({
            "at": row.get("settledAt") or row.get("closedAt"),
            "ticker": row.get("ticker"),
            "pnl": round(pnl, 4),
            "cumulativePnl": cumulative,
            "exitType": row.get("exitType"),
            "environment": row.get("environment"),
        })
    return {
        "records": clean,
        "samples": len(clean),
        "wins": wins,
        "losses": max(0, len(clean) - wins),
        "winRate": round(wins / len(clean), 4) if clean else None,
        "totalPnl": total,
        "averagePnl": round(total / len(clean), 4) if clean else 0.0,
        "bestTrade": round(max(pnl_values), 4) if pnl_values else None,
        "worstTrade": round(min(pnl_values), 4) if pnl_values else None,
        "equityCurve": curve,
    }


def _portfolio_analytics_after_reset(
    lifetime_analytics: Mapping[str, Any],
    baseline: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return a non-destructive, post-baseline analytics projection.

    The source analytics remain the durable lifetime ledger.  Only the object
    returned to the Portfolio view is filtered so users can start a fresh
    visible measurement period without deleting orders, fills or settlements.
    """
    reset_at = str(baseline.get("resetAt") or "").strip()
    reset_timestamp = _portfolio_timestamp(reset_at)
    analytics = dict(lifetime_analytics or {})
    if reset_timestamp is None:
        analytics["displayBaseline"] = {"active": False}
        return analytics

    lifetime_records = [
        dict(row) for row in (lifetime_analytics.get("realizedTradeRecords") or [])
        if isinstance(row, Mapping)
    ]
    visible_records = _portfolio_rows_after(lifetime_records, reset_timestamp)
    realized = _portfolio_realized_summary(visible_records, baseline_at=reset_at)

    lifetime_settlements = lifetime_analytics.get("settlementRecords") or []
    visible_settlements = _portfolio_rows_after(lifetime_settlements, reset_timestamp)
    settled = _portfolio_realized_summary(visible_settlements)
    visible_closed = _portfolio_rows_after(
        lifetime_analytics.get("closedTradeRecords") or [],
        reset_timestamp,
    )

    analytics.update({
        "settledSamples": settled["samples"],
        "wins": settled["wins"],
        "losses": settled["losses"],
        "winRate": settled["winRate"],
        "totalPnl": settled["totalPnl"],
        "averagePnl": settled["averagePnl"],
        "bestTrade": settled["bestTrade"],
        "worstTrade": settled["worstTrade"],
        "settlementRecords": visible_settlements,
        "closedTradeRecords": visible_closed,
        "realizedTradeRecords": visible_records,
        "realizedSamples": realized["samples"],
        "realizedWins": realized["wins"],
        "realizedLosses": realized["losses"],
        "realizedWinRate": realized["winRate"],
        "realizedTotalPnl": realized["totalPnl"],
        "realizedAveragePnl": realized["averagePnl"],
        "realizedBestTrade": realized["bestTrade"],
        "realizedWorstTrade": realized["worstTrade"],
        "equityCurve": realized["equityCurve"],
        "marketPerformance": _family_performance({"realizedTradeRecords": visible_records}),
        "lifetime": {
            "realizedSamples": len(lifetime_records),
            "realizedTotalPnl": round(sum(
                _finite_number(row.get("pnl"), 0.0) for row in lifetime_records
            ), 4),
        },
        "displayBaseline": {
            **dict(baseline),
            "active": True,
            "archivedRealizedEvents": max(0, len(lifetime_records) - len(visible_records)),
        },
    })
    return analytics


def _observation_analytics(rows) -> Dict[str, Any]:
    """Build a compact, auditable opportunity funnel for both strategy families."""
    clean = [dict(row) for row in rows or [] if isinstance(row, Mapping)]
    result: Dict[str, Any] = {"generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "families": {}}
    for family, prefix, label in (
        ("btc15m", str(BTC_15M_SERIES), "BTC 15-minute"),
        ("btchourly", BTC_HOURLY_SERIES, "BTC hourly strikes"),
    ):
        selected = [row for row in clean if str(row.get("ticker") or "").upper().startswith(prefix)]
        blocker_counts = Counter(
            str(reason)
            for row in selected
            for reason in (row.get("blocked_reasons") or [])
        )
        sources = Counter(
            str(((row.get("features") or {}).get("model") or {}).get("referenceModel") or "unknown")
            for row in selected
        )
        latencies = [
            _finite_number(((row.get("features") or {}).get("dataQuality") or {}).get("snapshotLatencyMs"), -1.0)
            for row in selected
        ]
        latencies = [value for value in latencies if value >= 0]
        positive_net = sum(_finite_number(row.get("net_edge"), -99.0) > 0 for row in selected)
        positive_conservative = sum(
            _finite_number(row.get("conservative_edge"), -99.0) > 0 for row in selected
        )
        entry_ready = sum("entry_window" not in set(row.get("blocked_reasons") or []) for row in selected)
        data_ready = sum(
            not set(row.get("blocked_reasons") or []).intersection({
                "contract_active", "reference_ready", "data_freshness", "history_sample",
            })
            for row in selected
        )
        liquidity_ready = sum(
            not set(row.get("blocked_reasons") or []).intersection({
                "two_sided_quote", "spread", "relative_spread", "depth",
            })
            for row in selected
        )
        routed = sum(str(row.get("action") or "").startswith("BUY_") for row in selected)
        orders = sum(bool(row.get("order_result")) for row in selected)
        near_misses = [
            row for row in selected
            if str(row.get("action") or "") == "WAIT"
            and _finite_number(row.get("conservative_edge"), -99.0) > 0
        ]
        near_misses.sort(
            key=lambda row: _finite_number(row.get("conservative_edge"), -99.0),
            reverse=True,
        )
        timeline_rows = list(reversed(selected[:160]))
        result["families"][family] = {
            "family": family,
            "label": label,
            "observations": len(selected),
            "uniqueMarkets": len({str(row.get("ticker") or "") for row in selected}),
            "latestAt": selected[0].get("observed_at") if selected else None,
            "funnel": {
                "observations": len(selected),
                "dataReady": data_ready,
                "entryWindow": entry_ready,
                "liquidityReady": liquidity_ready,
                "positiveNetEdge": positive_net,
                "positiveConservativeEdge": positive_conservative,
                "routable": routed,
                "orders": orders,
            },
            "blockers": [
                {"key": key, "count": count}
                for key, count in blocker_counts.most_common(10)
            ],
            "referenceSources": [
                {"key": key, "count": count}
                for key, count in sources.most_common()
            ],
            "officialBrtiSamples": sum(
                bool(((row.get("features") or {}).get("model") or {}).get("isOfficialBrti"))
                for row in selected
            ),
            "averageSnapshotLatencyMs": (
                round(sum(latencies) / len(latencies), 1) if latencies else None
            ),
            "edgeTimeline": [
                {
                    "at": row.get("observed_at"),
                    "ticker": row.get("ticker"),
                    "action": row.get("action"),
                    "secondsToClose": row.get("seconds_to_close"),
                    "netEdge": row.get("net_edge"),
                    "conservativeEdge": row.get("conservative_edge"),
                    "signalQuality": row.get("signal_quality"),
                }
                for row in timeline_rows
            ],
            "nearMisses": [
                {
                    "at": row.get("observed_at"),
                    "ticker": row.get("ticker"),
                    "side": row.get("side"),
                    "price": row.get("executable_price"),
                    "netEdge": row.get("net_edge"),
                    "conservativeEdge": row.get("conservative_edge"),
                    "secondsToClose": row.get("seconds_to_close"),
                    "blockingReasons": list(row.get("blocked_reasons") or []),
                }
                for row in near_misses[:8]
            ],
        }
    return result


class KalshiApiError(RuntimeError):
    def __init__(self, message: str, *, status: int = 502, code: str = "kalshi_data_unavailable"):
        super().__init__(message)
        self.status = status
        self.code = code


def _finite_number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _venue_quote(venue: str, payload: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
    """Normalize a public BTC/USD quote used to approximate CF BRTI."""
    venue = str(venue).lower()
    row: Mapping[str, Any] = payload or {}
    timestamp = None
    if venue == "kraken":
        values = list((row.get("result") or {}).values())
        row = values[0] if values and isinstance(values[0], Mapping) else {}
        bid = _finite_number((row.get("b") or [None])[0], -1.0)
        ask = _finite_number((row.get("a") or [None])[0], -1.0)
        last = _finite_number((row.get("c") or [None])[0], -1.0)
    else:
        bid = _finite_number(row.get("bid"), -1.0)
        ask = _finite_number(row.get("ask"), -1.0)
        last = _finite_number(row.get("price", row.get("last")), -1.0)
        timestamp = row.get("time") or row.get("timestamp")
    if bid > 0 and ask > bid:
        price = (bid + ask) / 2.0
    elif last > 0:
        price = last
    else:
        return None
    return {
        "venue": venue,
        "price": price,
        "bid": bid if bid > 0 else None,
        "ask": ask if ask > 0 else None,
        "timestamp": timestamp,
    }


def _brti_proxy(quotes) -> Optional[Dict[str, Any]]:
    """Robust constituent-venue aggregate; deliberately not labelled official BRTI."""
    clean = [dict(row) for row in quotes or [] if row and _finite_number(row.get("price"), 0.0) > 0]
    if not clean:
        return None
    median = statistics.median(_finite_number(row["price"]) for row in clean)
    deviations = [abs(_finite_number(row["price"]) - median) for row in clean]
    mad = statistics.median(deviations) if deviations else 0.0
    tolerance = max(median * 0.0015, mad * 4.5)
    accepted = [row for row in clean if abs(_finite_number(row["price"]) - median) <= tolerance]
    if not accepted:
        accepted = clean
    proxy = statistics.median(_finite_number(row["price"]) for row in accepted)
    dispersion = (
        (max(_finite_number(row["price"]) for row in accepted)
         - min(_finite_number(row["price"]) for row in accepted))
        / proxy * 10_000.0
        if len(accepted) > 1 and proxy > 0 else 0.0
    )
    return {
        "price": proxy,
        "venueCount": len(accepted),
        "venues": [row["venue"] for row in accepted],
        "rejectedVenues": [row["venue"] for row in clean if row not in accepted],
        "dispersionBps": dispersion,
        "quotes": accepted,
    }


def _book_mid_probability(
    market: Mapping[str, Any],
    book: Optional[Mapping[str, Any]] = None,
) -> Optional[Tuple[float, float]]:
    """Return an executable YES midpoint and a bounded liquidity weight."""
    book = dict(book or {})
    yes_levels = [
        (_finite_number(row[0], -1.0), _finite_number(row[1], 0.0))
        for row in (book.get("yes") or []) if isinstance(row, (list, tuple)) and len(row) >= 2
    ]
    no_levels = [
        (_finite_number(row[0], -1.0), _finite_number(row[1], 0.0))
        for row in (book.get("no") or []) if isinstance(row, (list, tuple)) and len(row) >= 2
    ]
    yes_levels = [row for row in yes_levels if 0 < row[0] < 1 and row[1] > 0]
    no_levels = [row for row in no_levels if 0 < row[0] < 1 and row[1] > 0]
    yes_bid = max(yes_levels, default=(None, 0.0), key=lambda row: row[0])
    no_bid = max(no_levels, default=(None, 0.0), key=lambda row: row[0])
    direct_bid = _finite_number(market.get("yes_bid_dollars"), -1.0)
    direct_ask = _finite_number(market.get("yes_ask_dollars"), -1.0)
    bid = yes_bid[0] if yes_bid[0] is not None else direct_bid
    ask = 1.0 - no_bid[0] if no_bid[0] is not None else direct_ask
    if not (0.0 < bid < 1.0 and 0.0 < ask < 1.0 and ask >= bid):
        return None
    bid_size = yes_bid[1] or _finite_number(market.get("yes_bid_size_fp"), 0.0)
    ask_size = no_bid[1] or _finite_number(market.get("yes_ask_size_fp"), 0.0)
    weight = max(1.0, min(5000.0, math.sqrt(max(1.0, bid_size * ask_size))))
    return _clamp_probability((bid + ask) / 2.0), weight


def _clamp_probability(value: float) -> float:
    return max(0.001, min(0.999, float(value)))


def _monotone_ladder_probabilities(
    markets: list[Mapping[str, Any]],
    books: Mapping[str, Mapping[str, Any]],
) -> Dict[str, Dict[str, float]]:
    """Liquidity-weighted PAV fit for a decreasing strike probability curve."""
    points = []
    for market in markets:
        ticker = str(market.get("ticker") or "")
        strike = _finite_number(market.get("floor_strike"), -1.0)
        quote = _book_mid_probability(market, books.get(ticker) or {})
        if ticker and strike > 0 and quote:
            probability, weight = quote
            points.append((strike, ticker, probability, weight))
    points.sort(key=lambda row: row[0])
    blocks = []
    for index, (_strike, _ticker, probability, weight) in enumerate(points):
        blocks.append({
            "start": index,
            "end": index,
            "weight": weight,
            "weighted": probability * weight,
        })
        # For increasing strikes, P(YES) must not increase.
        while len(blocks) >= 2:
            left = blocks[-2]
            right = blocks[-1]
            left_mean = left["weighted"] / left["weight"]
            right_mean = right["weighted"] / right["weight"]
            if left_mean >= right_mean:
                break
            blocks[-2:] = [{
                "start": left["start"],
                "end": right["end"],
                "weight": left["weight"] + right["weight"],
                "weighted": left["weighted"] + right["weighted"],
            }]
    fitted = [0.5] * len(points)
    for block in blocks:
        mean = _clamp_probability(block["weighted"] / block["weight"])
        for index in range(block["start"], block["end"] + 1):
            fitted[index] = mean
    return {
        ticker: {
            "rawProbability": round(raw, 6),
            "smoothedProbability": round(fitted[index], 6),
            "dislocation": round(fitted[index] - raw, 6),
        }
        for index, (_strike, ticker, raw, _weight) in enumerate(points)
    }


def _account_equity_cents(balance: Mapping[str, Any], environment: str) -> float:
    """Return mode-correct account equity without double counting Real cash."""
    cash_cents = _finite_number(balance.get("balance"))
    portfolio_value = balance.get("portfolio_value")
    if str(environment).lower() == "real":
        # Kalshi's current API defines portfolio_value as total account value.
        # Fall back to cash only for older or incomplete responses.
        return _finite_number(portfolio_value, cash_cents) if portfolio_value is not None else cash_cents
    # AlphaLab Paper stores marked open-position value separately from cash.
    return cash_cents + _finite_number(portfolio_value)


def _live_position_direction(
    position: Any,
    yes_count: Any,
    no_count: Any,
) -> Tuple[Optional[str], float]:
    """Normalize Kalshi's signed and outcome-specific position fields.

    A zero position is flat, not a YES position. Some account responses retain
    settled/closed rows with all counts at zero; those rows must not leak into
    the open-position UI or robot risk context.
    """
    signed_position = _finite_number(position, 0.0)
    outcome_delta = _finite_number(yes_count, 0.0) - _finite_number(no_count, 0.0)
    net = signed_position if abs(signed_position) > 1e-9 else outcome_delta
    if abs(net) <= 1e-9:
        return None, 0.0
    return ("YES" if net > 0 else "NO"), abs(net)


def _parse_utc(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _market_observation(
    environment: str,
    decision: Mapping[str, Any],
    order: Optional[Mapping[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Build a compact, idempotent 15-second research sample."""
    market = dict(decision.get("market") or {})
    ticker = str(market.get("ticker") or "").strip()
    if not ticker:
        return None
    observed = _parse_utc(decision.get("generatedAt")) or datetime.now(timezone.utc)
    bucket_epoch = int(observed.timestamp()) // 15 * 15
    model = dict(decision.get("model") or {})
    edge = dict(decision.get("edge") or {})
    account = dict(decision.get("account") or {})
    return {
        "environment": _execution_mode(environment),
        "ticker": ticker,
        "observation_key": f"{ticker}:{bucket_epoch}",
        "observed_at": observed.isoformat().replace("+00:00", "Z"),
        "action": str(decision.get("action") or "WAIT"),
        "side": decision.get("side"),
        "execution_intent": decision.get("executionIntent"),
        "signal_quality": int(_finite_number(decision.get("signalQuality"), 0.0)),
        "seconds_to_close": int(_finite_number(market.get("secondsToClose"), -1.0)),
        "model_yes_probability": model.get("modelYesProbability"),
        "fair_yes_probability": model.get("fairYesProbability"),
        "executable_price": edge.get("price"),
        "net_edge": edge.get("netEdge"),
        "conservative_edge": edge.get("conservativeEdge"),
        "spread": market.get("spread"),
        "book_imbalance": market.get("bookImbalance"),
        "blocked_reasons": [
            str(reason)[:80] for reason in (decision.get("blockingReasons") or [])[:20]
        ],
        "features": {
            "market": {
                key: market.get(key)
                for key in (
                    "status", "yesBid", "yesAsk", "noBid", "noAsk",
                    "yesAskDepth", "noAskDepth", "selectedDepth",
                    "edgeEligibleDepth", "referenceAgeSeconds",
                )
            },
            "model": {
                key: model.get(key)
                for key in (
                    "spot", "strike", "distanceBps", "momentum3m",
                    "momentum15m", "volatilityRatio", "jumpSigma",
                    "marketYesProbability", "uncertainty", "sampleSize",
                    "settlementEffectiveHorizonMinutes", "referenceModel",
                    "referenceVenueCount", "referenceDispersionBps",
                    "basisReserveBpsApplied", "isOfficialBrti",
                    "referenceRawPrice", "settlementWindowAverage",
                    "settlementWindowSamples", "settlementWindowProgress",
                    "rawMarketYesProbability", "ladderRawProbability",
                    "ladderSmoothedProbability", "ladderDislocation",
                )
            },
            "execution": {
                "topPrice": edge.get("price"),
                "marginalLimitPrice": edge.get("executionLimitPrice"),
                "feePerContract": edge.get("feePerContract"),
                "adaptiveEdgePremium": edge.get("adaptiveEdgePremium"),
            },
            "account": {
                key: account.get(key)
                for key in (
                    "heldSide", "heldCount", "cashAvailable",
                    "portfolioExposure", "currentMarketExposure",
                )
            },
            "positionManagement": dict(decision.get("positionManagement") or {}),
            "dataQuality": dict(decision.get("dataQuality") or {}),
            "exitAnalysis": {
                key: (decision.get("exitAnalysis") or {}).get(key)
                for key in (
                    "heldProbability", "netExitValuePerContract", "exitValueEdge",
                    "netExitPnlPerContract", "exitLossFraction", "trigger",
                )
            },
        },
        "order_result": ({
            key: order.get(key)
            for key in (
                "order_id", "client_order_id", "status", "action",
                "outcome_side", "count_fp", "fill_count_fp",
                "average_price_dollars", "fee_cost_dollars",
                "realized_pnl_dollars",
            )
        } if order else None),
    }


def _paper_account_context(
    portfolio: Mapping[str, Any],
    state: Mapping[str, Any],
    ticker: str,
    bankroll: float,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    positions = list(portfolio.get("positions") or [])
    orders = list(portfolio.get("orders") or [])
    fills = list(portfolio.get("fills") or [])
    matching_positions = [
        row for row in positions
        if str(row.get("ticker") or row.get("market_ticker") or "") == ticker
        and abs(_finite_number(row.get("position_fp") or row.get("position"))) > 1e-9
    ]
    terminal_order_states = {"canceled", "cancelled", "executed", "filled", "expired", "rejected"}
    matching_orders = [
        row for row in orders
        if str(row.get("ticker") or row.get("market_ticker") or "") == ticker
        and str(row.get("status") or "").lower() not in terminal_order_states
        and _finite_number(row.get("remaining_count_fp") or row.get("remaining_count") or row.get("count_fp") or row.get("count"), 1.0) > 0
    ]
    portfolio_exposure = sum(
        abs(_finite_number(row.get("market_exposure_dollars") or row.get("market_exposure")))
        for row in positions
    )
    current_market_exposure = sum(
        abs(_finite_number(row.get("market_exposure_dollars") or row.get("market_exposure")))
        for row in matching_positions
    )
    daily_order_ids = {
        str(row.get("order_id") or row.get("fill_id") or "")
        for row in fills
        if (_parse_utc(row.get("created_time")) or datetime.min.replace(tzinfo=timezone.utc)).date() == now.date()
    }
    strategy = dict(state.get("strategy") or {})
    daily_pnl = (
        _finite_number(strategy.get("dailyPnl"))
        if strategy.get("dailyPnlDate") == now.date().isoformat()
        else 0.0
    )
    balance = dict(portfolio.get("balance") or {})
    cash_available = _finite_number(balance.get("balance")) / 100.0
    return {
        "bankroll": bankroll,
        "cashAvailable": max(0.0, cash_available),
        "portfolioExposure": portfolio_exposure,
        "currentMarketExposure": current_market_exposure,
        "hasPosition": bool(matching_positions),
        "hasOpenOrder": bool(matching_orders),
        "alreadyTraded": ticker in set(state.get("tradedTickers") or []),
        "dailyTrades": len(daily_order_ids - {""}),
        "dailyPnl": daily_pnl,
    }


def _position_side_and_count(portfolio: Mapping[str, Any], ticker: str) -> Tuple[Optional[str], int]:
    for row in list(portfolio.get("positions") or []):
        if str(row.get("ticker") or row.get("market_ticker") or "") != ticker:
            continue
        yes_count = _finite_number(row.get("yes_count_fp") or row.get("yes_count"), 0.0)
        no_count = _finite_number(row.get("no_count_fp") or row.get("no_count"), 0.0)
        # Older Paper ledgers may contain complementary YES/NO hedges from the
        # pre-sell close implementation. Treat only their residual as current
        # directional exposure; all new exits are reduce-only sales.
        net_count = yes_count - no_count
        if abs(net_count) > 1e-9:
            return ("YES" if net_count > 0 else "NO"), int(math.ceil(abs(net_count)))
        if yes_count > 0 or no_count > 0:
            return None, 0
        position = _finite_number(row.get("position_fp") or row.get("position"), 0.0)
        if position > 0:
            return "YES", int(math.ceil(abs(position)))
        if position < 0:
            return "NO", int(math.ceil(abs(position)))
    return None, 0


def _position_execution_context(
    portfolio: Mapping[str, Any],
    ticker: str,
) -> Dict[str, Any]:
    """Return normalized entry economics for the currently held outcome."""
    side, count = _position_side_and_count(portfolio, ticker)
    result: Dict[str, Any] = {
        "side": side,
        "count": count,
        "averageEntryPrice": None,
        "allocatedEntryFee": 0.0,
        "lastTradeAt": None,
    }
    if not side or count <= 0:
        return result
    for row in list(portfolio.get("positions") or []):
        if str(row.get("ticker") or row.get("market_ticker") or "") != ticker:
            continue
        prefix = side.lower()
        average = _finite_number(row.get(f"{prefix}_average_price_dollars"), -1.0)
        side_cost = _finite_number(row.get(f"{prefix}_cost"), -1.0)
        if average <= 0.0 and side_cost >= 0.0:
            average = side_cost / count
        if average <= 0.0:
            # Kalshi's live position response exposes market exposure more
            # consistently than an average entry field. It is a conservative
            # fallback for reporting; exit routing never relies on it.
            exposure = abs(_finite_number(
                row.get("market_exposure_dollars") or row.get("market_exposure"),
                0.0,
            ))
            average = exposure / count if exposure > 0 else -1.0
        fee = _finite_number(
            row.get(f"{prefix}_fee_cost_dollars")
            or row.get("feeCost")
            or row.get("fees_paid_dollars"),
            0.0,
        )
        result.update({
            "averageEntryPrice": average if 0.0 < average < 1.0 else None,
            "allocatedEntryFee": max(0.0, fee),
            "lastTradeAt": row.get("last_trade_at") or row.get("lastTradeAt") or row.get("updated_time"),
        })
        break
    return result


def _estimate_reduce_only_sale(
    side: str,
    requested: int,
    orderbook: Mapping[str, Any],
) -> Dict[str, Any]:
    """Estimate a full-depth reduce-only fill, including the official taker fee."""
    remaining = max(0, int(requested))
    gross = 0.0
    fee = 0.0
    fill_count = 0
    worst_price = None
    for price, depth in executable_bid_levels(side, orderbook):
        if remaining <= 0:
            break
        count = min(remaining, int(depth))
        if count <= 0:
            continue
        amounts = taker_fill_amounts(price, count)
        gross += float(amounts["positionCost"])
        fee += float(amounts["tradeFee"])
        fill_count += count
        remaining -= count
        worst_price = price
    average = gross / fill_count if fill_count else None
    net_proceeds = math.floor(max(0.0, gross - fee) * 100.0 + 1e-9) / 100.0
    return {
        "requestedCount": max(0, int(requested)),
        "fillableCount": fill_count,
        "averageBid": average,
        "worstBid": worst_price,
        "grossProceeds": gross,
        "estimatedExitFee": fee,
        "netProceeds": net_proceeds,
        "fullDepthAvailable": fill_count >= max(0, int(requested)),
    }


def _protective_exit_state(
    held_probability: Optional[float],
    strategy_config: Mapping[str, Any],
) -> Dict[str, Any]:
    """Classify deterministic exit risk without inventing an executable price.

    This is the probability half of the stop rule. A materially weaker
    probability (20 percentage points below it) is treated as an emergency.
    The caller must still combine it with fee-adjusted loss and executable
    liquidity gates.
    """
    threshold = _finite_number(strategy_config.get("exitProbabilityThreshold"), 0.46)
    emergency_threshold = max(0.05, threshold - 0.20)
    probability = _finite_number(held_probability, 1.0)
    return {
        "protectiveExitThreshold": threshold,
        "emergencyExitThreshold": emergency_threshold,
        "protectiveExit": probability <= threshold,
        "emergencyExit": probability <= emergency_threshold,
    }


def _exit_economic_state(
    *,
    average_entry_price: Optional[float],
    allocated_entry_fee: float,
    held_count: int,
    net_exit_value_per_contract: Optional[float],
    held_probability: Optional[float],
    strategy_config: Mapping[str, Any],
) -> Dict[str, Any]:
    """Evaluate an exit against actual entry cost, both fees, and model risk.

    A probability threshold alone is too noisy for a contract evaluated every
    five seconds.  It previously allowed repeated loss-taking exits whose gross
    price movement was small relative to two taker fees.  Normal closes now
    require a real fee-adjusted profit.  Loss-taking closes require both model
    deterioration and a material mark-to-market loss; an emergency probability
    collapse uses a lower loss threshold but still needs an executable bid.
    """
    probability_state = _protective_exit_state(held_probability, strategy_config)
    count = max(0, int(held_count or 0))
    entry_price = _finite_number(average_entry_price, -1.0)
    entry_fee_per_contract = (
        max(0.0, _finite_number(allocated_entry_fee, 0.0)) / count
        if count > 0
        else 0.0
    )
    break_even = (
        entry_price + entry_fee_per_contract
        if 0.0 < entry_price < 1.0
        else None
    )
    exit_value = (
        _finite_number(net_exit_value_per_contract)
        if net_exit_value_per_contract is not None
        else None
    )
    pnl_per_contract = (
        exit_value - break_even
        if exit_value is not None and break_even is not None
        else None
    )
    loss_fraction = (
        max(0.0, -pnl_per_contract / break_even)
        if pnl_per_contract is not None and break_even and break_even > 0
        else None
    )
    minimum_profit = _finite_number(strategy_config.get("minimumExitProfit"), 0.01)
    stop_loss = _finite_number(strategy_config.get("stopLossPct"), 0.35)
    emergency_stop = min(
        stop_loss,
        _finite_number(strategy_config.get("emergencyStopLossPct"), 0.20),
    )
    profitable_exit = bool(
        pnl_per_contract is not None
        and pnl_per_contract >= minimum_profit
    )
    emergency_loss_exit = bool(
        probability_state["emergencyExit"]
        and loss_fraction is not None
        and loss_fraction >= emergency_stop
    )
    protective_loss_exit = bool(
        probability_state["protectiveExit"]
        and loss_fraction is not None
        and loss_fraction >= stop_loss
    )
    return {
        **probability_state,
        "entryFeePerContract": entry_fee_per_contract,
        "breakEvenExitValuePerContract": break_even,
        "netExitPnlPerContract": pnl_per_contract,
        "exitLossFraction": loss_fraction,
        "minimumExitProfit": minimum_profit,
        "stopLossPct": stop_loss,
        "emergencyStopLossPct": emergency_stop,
        "profitableExit": profitable_exit,
        "protectiveLossExit": protective_loss_exit,
        "emergencyLossExit": emergency_loss_exit,
        "lossExitAuthorized": protective_loss_exit or emergency_loss_exit,
    }


def _seconds_since(value: Any) -> Optional[float]:
    parsed = _parse_utc(value)
    if parsed is None:
        return None
    return max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds())


def _recent_filled_exit_age(state: Mapping[str, Any], ticker: str) -> Optional[float]:
    strategy = dict(state.get("strategy") or {})
    if str(strategy.get("lastExitTicker") or "") == ticker:
        age = _seconds_since(strategy.get("lastExitAt"))
        if age is not None:
            return age
    for row in list(state.get("decisions") or []):
        if str(row.get("ticker") or "") != ticker:
            continue
        if not row.get("orderFilled") or not str(row.get("action") or "").startswith("SELL_"):
            continue
        return _seconds_since(row.get("generatedAt"))
    return None


def _recent_filled_entry_age(state: Mapping[str, Any], ticker: str) -> Optional[float]:
    strategy = dict(state.get("strategy") or {})
    if str(strategy.get("lastEntryTicker") or "") == ticker:
        age = _seconds_since(strategy.get("lastEntryAt"))
        if age is not None:
            return age
    for row in list(state.get("decisions") or []):
        if str(row.get("ticker") or "") != ticker:
            continue
        if not row.get("orderFilled") or not str(row.get("action") or "").startswith("BUY_"):
            continue
        return _seconds_since(row.get("generatedAt"))
    return None


def _recent_filled_entry_signal(state: Mapping[str, Any], ticker: str, side: str) -> Optional[Dict[str, float]]:
    """Return the last filled same-side signal so scale-ins require improvement."""
    side = str(side or "").upper()
    for row in list(state.get("decisions") or []):
        if str(row.get("ticker") or "") != ticker or str(row.get("side") or "").upper() != side:
            continue
        if not row.get("orderFilled") or not str(row.get("action") or "").startswith("BUY_"):
            continue
        return {
            "probability": _finite_number(row.get("fairProbability"), 0.0),
            "conservativeEdge": _finite_number(row.get("conservativeEdge"), -1.0),
        }
    return None


def _intent_client_order_id(
    user_id: str,
    environment: str,
    ticker: str,
    action: str,
    side: str,
    held_count: int,
    *,
    now_epoch: Optional[float] = None,
) -> str:
    """Create a short-lived idempotency key for one observable trade intent.

    A retry after an ambiguous network timeout reuses the same key, while a
    later quote cycle or a changed position receives a new key.
    """
    bucket = int(float(now_epoch if now_epoch is not None else time.time())) // 10
    identity = ":".join((
        str(user_id),
        str(environment),
        str(ticker),
        str(action),
        str(side),
        str(max(0, int(held_count))),
        str(bucket),
    ))
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"alphalab:kalshi:intent:{identity}"))


def _paper_order_payload(
    decision: Mapping[str, Any],
    ticker: str,
    *,
    count_override: Optional[int] = None,
    price_tolerance: float = 0.0,
    client_order_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Translate a cleared engine decision into Kalshi's V2 YES-book shape."""
    action = str(decision.get("action") or "")
    side = str(decision.get("side") or "").upper()
    edge = dict(decision.get("edge") or {})
    sizing = dict(decision.get("sizing") or {})
    selected_price = _finite_number(edge.get("price"), -1.0)
    count = int(count_override) if count_override is not None else int(_finite_number(sizing.get("contracts"), 0.0))
    is_buy = action in {"BUY_YES", "BUY_NO"}
    is_sell = action in {"SELL_YES", "SELL_NO"}
    if not (is_buy or is_sell) or side not in {"YES", "NO"} or count <= 0:
        return None

    # V2 quotes one YES book: bid buys YES, while ask sells YES and is
    # economically the same as buying NO at 1 - YES price.
    # A small, user-capped crossing allowance protects IOC orders from a quote
    # moving by one tick between evaluation and submission. It is also capped by
    # the remaining conservative edge so execution can never erase the thesis.
    edge_room = max(
        0.0,
        _finite_number(edge.get("conservativeEdge"))
        - _finite_number(edge.get("minimumConservativeEdge")),
    )
    crossing = min(max(0.0, float(price_tolerance or 0.0)), edge_room * 0.5)
    marginal_limit = _finite_number(edge.get("executionLimitPrice"), -1.0)
    if is_buy and selected_price <= marginal_limit < 1.0:
        # The engine has evaluated every included depth level after fees and
        # uncertainty, so this limit can safely consume positive-edge depth.
        execution_price = min(0.99, marginal_limit)
        crossing = max(0.0, execution_price - selected_price)
    else:
        execution_price = min(0.99, selected_price + crossing) if is_buy else max(0.01, selected_price - crossing)
    yes_book_price = execution_price if side == "YES" else 1.0 - execution_price
    if not str(ticker or "").strip() or not 0.0 < yes_book_price < 1.0:
        return None
    return {
        "ticker": str(ticker),
        "client_order_id": str(client_order_id or uuid.uuid4()),
        "side": ("bid" if side == "YES" else "ask") if is_buy else ("ask" if side == "YES" else "bid"),
        "count": f"{count:.2f}",
        "price": f"{yes_book_price:.4f}",
        "user_side_limit_price": f"{execution_price:.4f}",
        "user_side_reference_price": f"{selected_price:.4f}",
        "crossing_allowance": f"{crossing:.4f}",
        "time_in_force": "immediate_or_cancel",
        "self_trade_prevention_type": "taker_at_cross",
        "post_only": False,
        "cancel_order_on_pause": True,
        "reduce_only": bool(is_sell),
        "subaccount": 0,
        "exchange_index": 0,
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


def _environment_name(value: Any) -> str:
    environment = str(value or "production").strip().lower()
    aliases = {"live": "production", "real": "production"}
    environment = aliases.get(environment, environment)
    if environment not in KALSHI_ENVIRONMENTS:
        raise KalshiApiError("Kalshi credential environment must be production", status=400, code="invalid_environment")
    return environment


def _execution_mode(value: Any) -> str:
    mode = str(value or "paper").strip().lower()
    return "real" if mode in {"real", "live", "production"} else "paper"


def _cents_amount(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(parsed):
        return default
    # Kalshi account endpoints conventionally return cents as integers. If the
    # API ever returns a decimal dollar value for a derived field, keep it sane.
    if abs(parsed) < 10_000 and isinstance(value, float):
        return int(round(parsed * 100))
    return int(round(parsed))


def _dollar_amount(dollar_value: Any = None, cents_value: Any = None, default: float = 0.0) -> float:
    """Read Kalshi fixed-point dollar fields before legacy integer-cent fields."""
    if dollar_value not in (None, ""):
        return _finite_number(dollar_value, default)
    if cents_value not in (None, ""):
        return _cents_amount(cents_value, int(round(default * 100))) / 100.0
    return default


def _live_order_payload(payload: Mapping[str, Any]) -> Dict[str, Any]:
    allowed = {
        "ticker",
        "client_order_id",
        "side",
        "count",
        "price",
        "time_in_force",
        "self_trade_prevention_type",
        "post_only",
        "cancel_order_on_pause",
        "reduce_only",
        "subaccount",
        "exchange_index",
    }
    return {key: value for key, value in dict(payload or {}).items() if key in allowed and value is not None}


def _live_order_economic_side(order: Mapping[str, Any], payload: Mapping[str, Any]) -> str:
    """Recover the traded outcome from Kalshi's single YES-book order shape."""
    explicit = str(
        order.get("outcome_side")
        or payload.get("outcome_side")
        or ""
    ).upper()
    if explicit in {"YES", "NO"}:
        return explicit
    legacy_side = str(order.get("side") or "").upper()
    if legacy_side in {"YES", "NO"}:
        return legacy_side

    book_side = str(
        order.get("book_side")
        or order.get("side")
        or payload.get("book_side")
        or payload.get("side")
        or ""
    ).lower()
    action = str(order.get("action") or payload.get("action") or "").lower()
    reduce_only = bool(
        order.get("reduce_only")
        or payload.get("reduce_only")
        or action == "sell"
    )
    if book_side == "bid":
        return "NO" if reduce_only else "YES"
    if book_side == "ask":
        return "YES" if reduce_only else "NO"
    return ""


def _normalise_live_order(raw: Mapping[str, Any], payload: Mapping[str, Any], decision: Mapping[str, Any]) -> Dict[str, Any]:
    order = dict(raw or {})
    side = str((decision.get("side") or "")).upper()
    if side not in {"YES", "NO"}:
        side = _live_order_economic_side(order, payload)
    explicit_action = str(order.get("action") or payload.get("action") or "").upper()
    reduce_only = bool(
        payload.get("reduce_only")
        or order.get("reduce_only")
        or explicit_action == "SELL"
    )
    action = explicit_action if explicit_action in {"BUY", "SELL"} else ("SELL" if reduce_only else "BUY")
    requested = _finite_number(order.get("count") or order.get("count_fp") or payload.get("count"), 0.0)
    filled = _finite_number(order.get("fill_count") or order.get("fill_count_fp") or order.get("filled_count"), 0.0)
    explicit_remaining = order.get("remaining_count_fp")
    if explicit_remaining in (None, ""):
        explicit_remaining = order.get("remaining_count")
    remaining = (
        _finite_number(explicit_remaining, 0.0)
        if explicit_remaining not in (None, "")
        else max(0.0, requested - filled)
    )
    # Event-market V2 transports every order on one YES book.  Preserve the
    # economic price of the outcome the user is actually trading: a 64c YES
    # book price for a NO order is a 36c NO contract, not a 64c NO contract.
    user_side_limit = _finite_number(payload.get("user_side_limit_price"), None)
    if user_side_limit is None:
        user_side_limit = _dollar_amount(
            order.get("no_price_dollars") if side == "NO" else order.get("yes_price_dollars"),
            default=None,
        )
    yes_book_limit = _finite_number(
        order.get("price_dollars") or order.get("price") or payload.get("price"),
        None,
    )
    if user_side_limit is None and yes_book_limit is not None:
        user_side_limit = round(1.0 - yes_book_limit, 8) if side == "NO" else yes_book_limit
    yes_book_average = _finite_number(order.get("average_fill_price"), None)
    if yes_book_average is None:
        yes_book_average = _finite_number(
            order.get("average_price") or order.get("average_price_dollars"),
            None,
        )
    user_side_average = (
        (round(1.0 - yes_book_average, 8) if side == "NO" else yes_book_average)
    ) if yes_book_average is not None else None
    if user_side_average is None:
        user_side_average = _dollar_amount(
            order.get("no_price_dollars") if side == "NO" else order.get("yes_price_dollars"),
            default=None,
        )
    if user_side_average is None:
        user_side_average = user_side_limit

    fee_cost = _dollar_amount(
        order.get("fee_cost_dollars") or order.get("fee_dollars"),
        order.get("fee") or order.get("fees"),
    )
    if fee_cost <= 0 and order.get("average_fee_paid") not in (None, ""):
        fee_cost = round(_finite_number(order.get("average_fee_paid"), 0.0) * filled, 8)

    explicit_status = str(order.get("status") or "").lower()
    if explicit_status:
        status = explicit_status
    elif requested > 0 and filled >= requested:
        status = "filled"
    elif filled > 0:
        status = "partially_filled"
    else:
        status = "submitted"
    return {
        **order,
        "environment": "real",
        "ticker": order.get("ticker") or payload.get("ticker"),
        "order_id": order.get("order_id") or order.get("id") or payload.get("client_order_id"),
        "client_order_id": order.get("client_order_id") or payload.get("client_order_id"),
        "outcome_side": side,
        "action": action,
        "reduce_only": reduce_only,
        "count_fp": requested,
        "fill_count_fp": filled,
        "remaining_count_fp": remaining,
        "limit_price_dollars": user_side_limit,
        "average_price_dollars": user_side_average,
        "fee_cost_dollars": fee_cost,
        "status": status,
        "time_in_force": order.get("time_in_force") or payload.get("time_in_force") or "immediate_or_cancel",
        "created_time": order.get("created_time") or order.get("created_ts") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _normalise_live_fill(
    raw: Mapping[str, Any],
    order_context: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    fill = dict(raw or {})
    context = dict(order_context or {})
    ticker = fill.get("ticker") or fill.get("market_ticker") or fill.get("market") or fill.get("contract_ticker")
    side = str(fill.get("outcome_side") or fill.get("side") or fill.get("result") or "").upper()
    if side not in {"YES", "NO"}:
        side = str(context.get("outcome_side") or "").upper()
    if side not in {"YES", "NO"}:
        has_yes = fill.get("yes_price") not in (None, "") or fill.get("yes_price_dollars") not in (None, "")
        has_no = fill.get("no_price") not in (None, "") or fill.get("no_price_dollars") not in (None, "")
        if has_yes and not has_no:
            side = "YES"
        elif has_no and not has_yes:
            side = "NO"
    count = _finite_number(
        fill.get("count")
        or fill.get("count_fp")
        or fill.get("fill_count")
        or fill.get("fill_count_fp")
        or fill.get("contracts"),
        0.0,
    )
    price_dollars = None
    if side in {"YES", "NO"}:
        price_dollars = _dollar_amount(
            fill.get("no_price_dollars") if side == "NO" else fill.get("yes_price_dollars"),
            default=None,
        )
    if price_dollars is None and side in {"YES", "NO"}:
        yes_book_price = _finite_number(
            fill.get("price_dollars") or fill.get("average_price_dollars"),
            None,
        )
        if yes_book_price is not None:
            price_dollars = round(1.0 - yes_book_price, 8) if side == "NO" else yes_book_price
    if price_dollars is None and side in {"YES", "NO"}:
        outcome_cents = (
            fill.get("no_price") if side == "NO"
            else fill.get("yes_price") if side == "YES"
            else None
        )
        if outcome_cents not in (None, ""):
            price_dollars = _cents_amount(outcome_cents) / 100.0
        else:
            yes_book_raw = _finite_number(
                fill.get("price") or fill.get("average_price"),
                0.0,
            )
            yes_book_dollars = yes_book_raw / 100.0 if yes_book_raw > 1 else yes_book_raw
            price_dollars = (
                round(1.0 - yes_book_dollars, 8)
                if side == "NO" and yes_book_dollars > 0
                else yes_book_dollars
            )
    fee_dollars = _dollar_amount(
        fill.get("fee_cost_dollars")
        or fill.get("fee_cost")
        or fill.get("taker_fees_dollars")
        or fill.get("maker_fees_dollars"),
        fill.get("fee") or fill.get("fees") or fill.get("taker_fees") or fill.get("maker_fees"),
    )
    action = str(fill.get("action") or context.get("action") or "").lower()
    reduce_only = bool(
        fill.get("reduce_only")
        or context.get("reduce_only")
        or action == "sell"
    )
    return {
        **fill,
        "environment": "real",
        "ticker": ticker,
        "fill_id": fill.get("fill_id") or fill.get("trade_id") or fill.get("id") or fill.get("order_id"),
        "order_id": fill.get("order_id"),
        "outcome_side": side,
        "action": action,
        "reduce_only": reduce_only,
        "count_fp": count,
        "fill_count_fp": count,
        "price_dollars": price_dollars,
        "average_price_dollars": price_dollars,
        "fee_cost_dollars": fee_dollars,
        "created_time": fill.get("created_time") or fill.get("created_ts") or fill.get("trade_time") or fill.get("updated_time"),
    }


def _reconcile_live_exit_fills(fills) -> list:
    """Attach FIFO cost basis and realized P/L to authenticated SELL fills.

    Kalshi fill rows describe execution, not account-level realized P/L.  This
    helper reconstructs only fully supported round trips from the returned
    history.  A SELL whose complete cost basis is outside the fetched window is
    deliberately left unscored instead of inventing a profit or loss.
    """
    rows = [
        dict(row) for row in list(fills or [])
        if isinstance(row, Mapping)
        and _is_supported_kalshi_ticker(row.get("ticker") or row.get("market_ticker"))
    ]
    rows.sort(key=lambda row: (
        str(row.get("created_time") or ""),
        str(row.get("fill_id") or row.get("order_id") or ""),
    ))
    lots: Dict[Tuple[str, str], list] = {}
    reconciled = []
    for row in rows:
        action = str(row.get("action") or "").upper()
        side = str(row.get("outcome_side") or "").upper()
        ticker = str(row.get("ticker") or row.get("market_ticker") or "")
        count = _finite_number(row.get("count_fp") or row.get("fill_count_fp"), 0.0)
        price = _finite_number(row.get("average_price_dollars") or row.get("price_dollars"), 0.0)
        fee = max(0.0, _finite_number(row.get("fee_cost_dollars"), 0.0))
        if side not in {"YES", "NO"} or count <= 0 or price <= 0:
            reconciled.append(row)
            continue

        key = (ticker, side)
        queue = lots.setdefault(key, [])
        if action == "BUY":
            queue.append({
                "count": count,
                "price": price,
                "fee": fee,
            })
            reconciled.append(row)
            continue
        if action != "SELL":
            reconciled.append(row)
            continue

        remaining = count
        principal = 0.0
        entry_fee = 0.0
        while remaining > 1e-9 and queue:
            lot = queue[0]
            available = _finite_number(lot.get("count"), 0.0)
            matched = min(remaining, available)
            fraction = matched / available if available > 0 else 0.0
            principal += matched * _finite_number(lot.get("price"), 0.0)
            allocated_fee = _finite_number(lot.get("fee"), 0.0) * fraction
            entry_fee += allocated_fee
            lot["count"] = max(0.0, available - matched)
            lot["fee"] = max(0.0, _finite_number(lot.get("fee"), 0.0) - allocated_fee)
            remaining -= matched
            if lot["count"] <= 1e-9:
                queue.pop(0)

        # Consume any known inventory above, but publish a P/L record only when
        # the entire SELL has an authenticated cost basis in this fill window.
        if remaining > 1e-9:
            reconciled.append(row)
            continue
        gross_proceeds = count * price
        realized_pnl = gross_proceeds - fee - principal - entry_fee
        reconciled.append({
            **row,
            "reduce_only": True,
            "position_cost_dollars": round(principal, 8),
            "gross_proceeds_dollars": round(gross_proceeds, 8),
            "entry_fee_allocated_dollars": round(entry_fee, 8),
            "realized_pnl_dollars": round(realized_pnl, 8),
        })
    return reconciled


def _open_live_fill_inventory(fills) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """Rebuild open FIFO lots from canonical Kalshi fills.

    The authenticated position endpoint is authoritative for quantity. Fill
    history supplies the missing entry economics used by exit decisions, so
    market exposure is never mistaken for cost basis.
    """
    queues: Dict[Tuple[str, str], list] = {}
    last_trade: Dict[Tuple[str, str], Any] = {}
    rows = sorted(
        [dict(row) for row in fills or [] if isinstance(row, Mapping)],
        key=lambda row: (
            str(row.get("created_time") or ""),
            str(row.get("fill_id") or row.get("order_id") or ""),
        ),
    )
    for row in rows:
        ticker = str(row.get("ticker") or row.get("market_ticker") or "")
        side = str(row.get("outcome_side") or "").upper()
        action = str(row.get("action") or "").upper()
        count = _finite_number(row.get("count_fp") or row.get("fill_count_fp"), 0.0)
        price = _finite_number(row.get("average_price_dollars") or row.get("price_dollars"), 0.0)
        if not _is_supported_kalshi_ticker(ticker) or side not in {"YES", "NO"} or count <= 0:
            continue
        key = (ticker, side)
        queue = queues.setdefault(key, [])
        last_trade[key] = row.get("created_time")
        if action == "BUY" and price > 0:
            queue.append({
                "count": count,
                "price": price,
                "fee": max(0.0, _finite_number(row.get("fee_cost_dollars"), 0.0)),
            })
        elif action == "SELL":
            remaining = count
            while remaining > 1e-9 and queue:
                lot = queue[0]
                available = _finite_number(lot.get("count"), 0.0)
                matched = min(remaining, available)
                fraction = matched / available if available > 0 else 0.0
                lot["count"] = max(0.0, available - matched)
                lot["fee"] = max(0.0, _finite_number(lot.get("fee"), 0.0) * (1.0 - fraction))
                remaining -= matched
                if lot["count"] <= 1e-9:
                    queue.pop(0)

    result: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for key, queue in queues.items():
        count = sum(_finite_number(lot.get("count"), 0.0) for lot in queue)
        if count <= 1e-9:
            continue
        principal = sum(
            _finite_number(lot.get("count"), 0.0) * _finite_number(lot.get("price"), 0.0)
            for lot in queue
        )
        result[key] = {
            "count": count,
            "principal": principal,
            "averagePrice": principal / count,
            "entryFee": sum(_finite_number(lot.get("fee"), 0.0) for lot in queue),
            "lastTradeAt": last_trade.get(key),
        }
    return result


def _normalise_live_settlement(raw: Mapping[str, Any]) -> Dict[str, Any]:
    settlement = dict(raw or {})
    ticker = settlement.get("ticker") or settlement.get("market_ticker") or settlement.get("market") or settlement.get("contract_ticker")
    result = str(settlement.get("market_result") or settlement.get("result") or settlement.get("settlement_value") or "").upper()
    if result not in {"YES", "NO"}:
        value = _finite_number(settlement.get("yes_win") or settlement.get("value"), float("nan"))
        if math.isfinite(value):
            result = "YES" if value >= (0.5 if 0 <= value <= 1 else 50.0) else "NO"
    return {
        **settlement,
        "environment": "real",
        "ticker": ticker,
        "market_ticker": ticker,
        "market_result": result,
        "settled_time": (
            settlement.get("settled_time")
            or settlement.get("settlement_time")
            or settlement.get("determined_time")
            or settlement.get("created_time")
            or settlement.get("updated_time")
        ),
        "yes_count_fp": _finite_number(settlement.get("yes_count_fp") or settlement.get("yes_count") or settlement.get("yes_position"), 0.0),
        "no_count_fp": _finite_number(settlement.get("no_count_fp") or settlement.get("no_count") or settlement.get("no_position"), 0.0),
        "revenue_dollars": _dollar_amount(
            settlement.get("revenue_dollars"),
            settlement.get("revenue") or settlement.get("settlement_value") or settlement.get("proceeds"),
        ),
        "yes_total_cost_dollars": _dollar_amount(
            settlement.get("yes_total_cost_dollars"),
            settlement.get("yes_total_cost") or settlement.get("yes_cost"),
        ),
        "no_total_cost_dollars": _dollar_amount(
            settlement.get("no_total_cost_dollars"),
            settlement.get("no_total_cost") or settlement.get("no_cost"),
        ),
        "fee_cost_dollars": _dollar_amount(
            settlement.get("fee_cost_dollars") or settlement.get("fee_cost"),
            settlement.get("fees") or settlement.get("fee"),
        ),
    }


def _credential_fields(environment: str) -> Tuple[str, str]:
    prefix = _environment_name(environment)
    return f"{prefix}_api_key_id", f"{prefix}_private_key"


def _normalize_private_key(value: Any) -> str:
    raw = str(value or "").strip().replace("\\n", "\n")
    if not raw or len(raw) > 20_000:
        raise KalshiApiError("A valid Kalshi RSA private key is required", status=400, code="invalid_private_key")
    match = re.search(
        r"-----BEGIN (?:RSA )?PRIVATE KEY-----(.*?)-----END (?:RSA )?PRIVATE KEY-----",
        raw,
        flags=re.DOTALL,
    )
    if match:
        body = re.sub(r"\s+", "", match.group(1))
        label = "RSA PRIVATE KEY" if "BEGIN RSA PRIVATE KEY" in raw else "PRIVATE KEY"
        wrapped = "\n".join(body[index:index + 64] for index in range(0, len(body), 64))
        raw = f"-----BEGIN {label}-----\n{wrapped}\n-----END {label}-----"
    return raw


def _load_rsa_private_key(value: Any):
    try:
        key = serialization.load_pem_private_key(_normalize_private_key(value).encode("utf-8"), password=None)
    except Exception as exc:
        raise KalshiApiError(
            "The Kalshi private key is not a valid unencrypted RSA PEM key",
            status=400,
            code="invalid_private_key",
        ) from exc
    if not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 2048:
        raise KalshiApiError(
            "Kalshi requires an RSA private key of at least 2048 bits",
            status=400,
            code="invalid_private_key",
        )
    return key


def _signed_headers(api_key_id: str, private_key: str, method: str, path: str, *, timestamp_ms: Optional[int] = None):
    key_id = str(api_key_id or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{8,200}", key_id):
        raise KalshiApiError("A valid Kalshi API Key ID is required", status=400, code="invalid_api_key_id")
    clean_path = str(path or "").split("?", 1)[0]
    timestamp = int(timestamp_ms if timestamp_ms is not None else time.time() * 1000)
    message = f"{timestamp}{str(method).upper()}{clean_path}".encode("utf-8")
    signature = _load_rsa_private_key(private_key).sign(
        message,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=hashes.SHA256().digest_size),
        hashes.SHA256(),
    )
    return {
        "Accept": "application/json",
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-TIMESTAMP": str(timestamp),
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode("ascii"),
        "User-Agent": "AlphaLab-Kalshi/1.0",
    }


class _PublicDataClient:
    def __init__(self, *, http_get=None, safe_print=print):
        self.http_get = http_get or requests.get
        self.safe_print = safe_print
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._cache_meta: Dict[str, Dict[str, Any]] = {}
        self._cache_lock = threading.RLock()
        self._headers = {
            "Accept": "application/json",
            "User-Agent": "AlphaLab-Kalshi-Research/1.0",
        }

    def _cached_json(
        self,
        key: str,
        url: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        ttl: float,
        timeout: float = 8.0,
    ) -> Any:
        now = time.monotonic()
        with self._cache_lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] <= ttl:
                meta = self._cache_meta.setdefault(key, {})
                meta.update({
                    "servedStale": False,
                    "ageSeconds": round(max(0.0, now - cached[0]), 3),
                })
                return cached[1]

        response = None
        error: Optional[Exception] = None
        for attempt in range(2):
            try:
                response = self.http_get(
                    url,
                    params=dict(params or {}),
                    headers=self._headers,
                    timeout=timeout,
                )
                if hasattr(response, "raise_for_status"):
                    response.raise_for_status()
                payload = response.json() if hasattr(response, "json") else response
                error = None
                break
            except Exception as exc:
                error = exc
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if attempt == 0 and (status == 429 or (status is not None and status >= 500)):
                    time.sleep(0.08)
                    continue
                break
        if error is not None:
            with self._cache_lock:
                stale = self._cache.get(key)
            if stale:
                age = max(0.0, time.monotonic() - stale[0])
                with self._cache_lock:
                    meta = self._cache_meta.setdefault(key, {})
                    meta.update({"servedStale": True, "ageSeconds": round(age, 3)})
                self.safe_print(f"[Kalshi] public request failed key={key} error={type(error).__name__}; serving stale cache")
                return stale[1]
            self.safe_print(f"[Kalshi] public request failed key={key} error={type(error).__name__}")
            raise KalshiApiError(f"Public data request failed for {key}") from error
        fetched_monotonic = time.monotonic()
        fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with self._cache_lock:
            self._cache[key] = (fetched_monotonic, payload)
            self._cache_meta[key] = {
                "fetchedAt": fetched_at,
                "servedStale": False,
                "ageSeconds": 0.0,
            }
        return payload

    def _cache_status(self, key: str) -> Dict[str, Any]:
        with self._cache_lock:
            meta = dict(self._cache_meta.get(key) or {})
            cached = self._cache.get(key)
        if cached:
            meta["ageSeconds"] = round(max(0.0, time.monotonic() - cached[0]), 3)
        return meta

    @staticmethod
    def _top_book_from_market(market: Mapping[str, Any]) -> Dict[str, Any]:
        """Build a valid top-level fallback from Kalshi's market quote fields."""
        yes_bid = _finite_number(market.get("yes_bid_dollars"), -1.0)
        no_bid = _finite_number(market.get("no_bid_dollars"), -1.0)
        yes_size = _finite_number(market.get("yes_bid_size_fp"), 0.0)
        # A YES ask is the reciprocal NO bid.  Kalshi exposes the matching YES
        # ask size on the market object even when no_bid_size_fp is omitted.
        no_size = _finite_number(
            market.get("no_bid_size_fp", market.get("yes_ask_size_fp")),
            0.0,
        )
        return {
            "yes": [[yes_bid, yes_size]] if 0.0 < yes_bid < 1.0 and yes_size > 0 else [],
            "no": [[no_bid, no_size]] if 0.0 < no_bid < 1.0 and no_size > 0 else [],
        }

    def _market_candidates(self, now: datetime, base_url: str):
        environment_key = "production"
        live_payload = self._cached_json(
            f"kalshi-btc15-open:{environment_key}",
            f"{base_url}/markets",
            params={"series_ticker": BTC_15M_SERIES, "status": "open", "limit": 100},
            ttl=2.0,
        )
        live_markets = list((live_payload or {}).get("markets") or [])
        market, selection = select_btc15_market(live_markets, now, min_active_seconds_to_close=45.0)
        if market and selection == "active":
            return market, selection

        schedule_payload = self._cached_json(
            f"kalshi-btc15-schedule:{environment_key}",
            f"{base_url}/markets",
            params={"series_ticker": BTC_15M_SERIES, "limit": 1000},
            ttl=30.0,
        )
        combined = live_markets + list((schedule_payload or {}).get("markets") or [])
        return select_btc15_market(combined, now, min_active_seconds_to_close=45.0)

    def market(self, ticker: str) -> Dict[str, Any]:
        payload = self._cached_json(
            f"kalshi-market:{ticker}",
            f"{KALSHI_PUBLIC_BASE}/markets/{str(ticker)}",
            ttl=1.0,
        )
        return dict((payload or {}).get("market") or payload or {})

    def snapshot(
        self,
        *,
        now: Optional[datetime] = None,
        base_url: str = KALSHI_PUBLIC_BASE,
        reference_override: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        started_at = time.perf_counter()
        now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        warnings = []
        market, selection = self._market_candidates(now, base_url)
        if not market:
            raise KalshiApiError("No KXBTC15M contract was returned by Kalshi")

        orderbook = {"yes": [], "no": []}
        orderbook_as_of = None
        ticker = str(market.get("ticker") or "")
        if ticker and selection == "active":
            book_key = f"kalshi-orderbook:{base_url}:{ticker}"
            try:
                book_payload = self._cached_json(
                    book_key,
                    f"{base_url}/markets/{ticker}/orderbook",
                    params={"depth": 10},
                    ttl=0.75,
                )
                fixed = (book_payload or {}).get("orderbook_fp") or {}
                orderbook = {
                    "yes": fixed.get("yes_dollars") or [],
                    "no": fixed.get("no_dollars") or [],
                }
                book_status = self._cache_status(book_key)
                orderbook_as_of = book_status.get("fetchedAt")
                if book_status.get("servedStale"):
                    warnings.append("kalshi_orderbook_stale")
            except KalshiApiError:
                warnings.append("kalshi_orderbook_unavailable")
            if not orderbook["yes"] or not orderbook["no"]:
                fallback_book = self._top_book_from_market(market)
                if fallback_book["yes"] and fallback_book["no"]:
                    orderbook = fallback_book
                    orderbook_as_of = (
                        market.get("updated_time")
                        or now.isoformat().replace("+00:00", "Z")
                    )
                    warnings.append("kalshi_top_quote_fallback")

        ticker_payload: Mapping[str, Any] = {}
        venue_payloads: Dict[str, Mapping[str, Any]] = {}
        candles = []
        official_reference = (
            dict(reference_override or {})
            if _finite_number((reference_override or {}).get("price"), 0.0) > 0
            and bool((reference_override or {}).get("isOfficialBrti"))
            else {}
        )
        venue_requests = {
            "coinbase": ("coinbase-btc-ticker", f"{COINBASE_EXCHANGE_BASE}/products/BTC-USD/ticker"),
            "bitstamp": ("bitstamp-btc-ticker", f"{BITSTAMP_BASE}/ticker/btcusd/"),
            "gemini": ("gemini-btc-ticker", f"{GEMINI_BASE}/pubticker/btcusd"),
            "kraken": ("kraken-btc-ticker", f"{KRAKEN_BASE}/Ticker?pair=XBTUSD"),
        }
        proxy = None
        accepted_statuses = []
        if not official_reference:
            with ThreadPoolExecutor(max_workers=len(venue_requests)) as executor:
                futures = {
                    venue: executor.submit(self._cached_json, cache_key, url, ttl=1.0, timeout=4.0)
                    for venue, (cache_key, url) in venue_requests.items()
                }
                for venue, future in futures.items():
                    try:
                        venue_payloads[venue] = future.result() or {}
                    except KalshiApiError:
                        warnings.append(f"{venue}_reference_unavailable")
            ticker_payload = venue_payloads.get("coinbase") or {}
            venue_quotes = [
                quote for quote in (
                    _venue_quote(venue, payload)
                    for venue, payload in venue_payloads.items()
                ) if quote
            ]
            proxy = _brti_proxy(venue_quotes)
            if not proxy:
                warnings.append("btc_reference_unavailable")
            elif int(proxy.get("venueCount") or 0) < 2:
                warnings.append("brti_proxy_single_venue")
            accepted_venues = set((proxy or {}).get("venues") or [])
            accepted_statuses = [
                self._cache_status(cache_key)
                for venue, (cache_key, _url) in venue_requests.items()
                if venue in accepted_venues
            ]
            if any(item.get("servedStale") for item in accepted_statuses):
                warnings.append("brti_proxy_stale")
        try:
            candles = self._cached_json(
                "coinbase-btc-candles-1m",
                f"{COINBASE_EXCHANGE_BASE}/products/BTC-USD/candles",
                params={"granularity": 60},
                # 15s keeps the momentum logit term at most one refresh behind
                # inside the 100-320s decision window while staying far under
                # Coinbase's public rate limits at a 5-second robot cadence.
                ttl=15.0,
            ) or []
        except KalshiApiError:
            warnings.append("btc_history_unavailable")

        fetched_at = now.isoformat().replace("+00:00", "Z")
        reference_price = (
            official_reference.get("price")
            or (proxy or {}).get("price")
            or ticker_payload.get("price")
        )
        proxy_fetch_times = [
            str(item.get("fetchedAt")) for item in accepted_statuses if item.get("fetchedAt")
        ]
        fallback_timestamp = (
            min(proxy_fetch_times)
            if proxy and proxy_fetch_times
            else fetched_at if proxy else ticker_payload.get("time")
        )
        reference = {
            "symbol": "BTC-USD",
            "price": reference_price,
            "bid": ticker_payload.get("bid"),
            "ask": ticker_payload.get("ask"),
            "timestamp": official_reference.get("timestamp") or fallback_timestamp,
            "model": official_reference.get("model") or (
                "brti_constituent_proxy" if proxy else "coinbase_fallback"
            ),
            "isOfficialBrti": bool(official_reference),
            "venueCount": int(
                official_reference.get("venueCount")
                or (proxy or {}).get("venueCount")
                or 0
            ),
            "venues": list(
                official_reference.get("venues")
                or (proxy or {}).get("venues")
                or []
            ),
            "rejectedVenues": list(
                official_reference.get("rejectedVenues")
                or (proxy or {}).get("rejectedVenues")
                or []
            ),
            "dispersionBps": round(
                _finite_number(
                    official_reference.get("dispersionBps", (proxy or {}).get("dispersionBps"))
                ),
                4,
            ),
            "venueQuotes": list((proxy or {}).get("quotes") or []),
            "candles": candles,
            "candleCount": len(candles),
        }
        for key in (
            "rawPrice", "trailing60sAverage", "settlementWindowAverage",
            "settlementWindowSamples", "settlementWindowProgress", "receivedAt",
            "streamAgeSeconds", "streamStatus", "sourceSequence",
        ):
            if key in official_reference:
                reference[key] = official_reference.get(key)
        return {
            "asOf": fetched_at,
            "latencyMs": int(round((time.perf_counter() - started_at) * 1000)),
            "selection": selection,
            "seriesTicker": BTC_15M_SERIES,
            "market": market,
            "orderbook": orderbook,
            "orderbookAsOf": orderbook_as_of,
            "reference": reference,
            "warnings": warnings,
            "sources": {
                "contract": f"Kalshi {BTC_15M_SERIES}",
                "orderbook": "Kalshi public market orderbook",
                "settlement": "CF Benchmarks BRTI",
                "spotReference": (
                    "Official CF Benchmarks BRTI via Kalshi WebSocket"
                    if official_reference
                    else "BRTI constituent-exchange proxy (Coinbase, Bitstamp, Gemini, Kraken)"
                ),
            },
        }

    def hourly_snapshot(
        self,
        *,
        now: Optional[datetime] = None,
        base_url: str = KALSHI_PUBLIC_BASE,
        reference_override: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Return the nearest active KXBTCD event and executable strike books.

        The hourly event is a ladder of binary strike contracts.  It is kept
        separate from the 15-minute contract selector, while sharing the same
        BRTI-proxy reference evidence and candle history.
        """
        started_at = time.perf_counter()
        now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        reference_snapshot = self.snapshot(
            now=now,
            base_url=base_url,
            reference_override=reference_override,
        )
        payload = self._cached_json(
            f"kalshi-btchourly-open:{base_url}",
            f"{base_url}/markets",
            params={"series_ticker": BTC_HOURLY_SERIES, "status": "open", "limit": 1000},
            ttl=2.0,
        )
        markets = [dict(row) for row in ((payload or {}).get("markets") or []) if isinstance(row, Mapping)]
        eligible = []
        for market in markets:
            close_at = _parse_utc(market.get("close_time") or market.get("close_ts"))
            seconds = (close_at - now).total_seconds() if close_at else -1
            if 45 <= seconds <= 3700 and str(market.get("status") or "").lower() in {"active", "open"}:
                eligible.append((seconds, str(market.get("event_ticker") or ""), market))
        if not eligible:
            raise KalshiApiError("No active KXBTCD hourly strike event was returned by Kalshi")
        nearest_seconds, event_ticker, _ = min(eligible, key=lambda item: item[0])
        event_markets = [market for seconds, event, market in eligible if event == event_ticker]
        spot = _finite_number((reference_snapshot.get("reference") or {}).get("price"), 0.0)
        event_markets.sort(
            key=lambda market: abs(_finite_number(market.get("floor_strike"), spot) - spot)
        )
        # The batch endpoint makes a wider ladder cheap.  Keep all contracts
        # with a two-sided direct quote plus nearby strikes, then cap at 32 so
        # the probability fit remains focused on the liquid part of the event.
        quoted = [
            market for market in event_markets
            if 0.0 < _finite_number(market.get("yes_bid_dollars"), -1.0) < 1.0
            and 0.0 < _finite_number(market.get("yes_ask_dollars"), -1.0) < 1.0
        ]
        selected_by_ticker = {
            str(market.get("ticker") or ""): market
            for market in (event_markets[:16] + quoted)
            if str(market.get("ticker") or "")
        }
        selected_markets = list(selected_by_ticker.values())
        selected_markets.sort(
            key=lambda market: abs(_finite_number(market.get("floor_strike"), spot) - spot)
        )
        selected_markets = selected_markets[:32]

        books: Dict[str, Dict[str, Any]] = {}
        warnings = list(reference_snapshot.get("warnings") or [])
        tickers = [str(market.get("ticker") or "") for market in selected_markets]
        batch_key = f"kalshi-orderbooks:{base_url}:{event_ticker}:{','.join(tickers)}"
        try:
            batch = self._cached_json(
                batch_key,
                f"{base_url}/markets/orderbooks",
                params={"tickers": tickers},
                ttl=0.75,
                timeout=6.0,
            )
            for row in (batch or {}).get("orderbooks") or []:
                ticker = str((row or {}).get("ticker") or "")
                fixed = (row or {}).get("orderbook_fp") or {}
                if ticker:
                    books[ticker] = {
                        "yes": fixed.get("yes_dollars") or [],
                        "no": fixed.get("no_dollars") or [],
                    }
            batch_status = self._cache_status(batch_key)
            if batch_status.get("servedStale"):
                warnings.append("hourly_orderbooks_stale")
        except KalshiApiError:
            warnings.append("hourly_orderbooks_unavailable")
        for market in selected_markets:
            ticker = str(market.get("ticker") or "")
            book = books.get(ticker) or {}
            if not book.get("yes") or not book.get("no"):
                fallback = self._top_book_from_market(market)
                if fallback["yes"] and fallback["no"]:
                    books[ticker] = fallback
                    warnings.append("hourly_top_quote_fallback")
        ladder_fit = _monotone_ladder_probabilities(selected_markets, books)
        as_of = now.isoformat().replace("+00:00", "Z")
        orderbook_as_of = self._cache_status(batch_key).get("fetchedAt") or as_of
        return {
            "asOf": as_of,
            "latencyMs": int(round((time.perf_counter() - started_at) * 1000)),
            "selection": "active",
            "seriesTicker": BTC_HOURLY_SERIES,
            "eventTicker": event_ticker,
            "secondsToClose": nearest_seconds,
            "markets": selected_markets,
            "orderbooks": books,
            "orderbookAsOf": orderbook_as_of,
            "ladderFit": ladder_fit,
            "reference": dict(reference_snapshot.get("reference") or {}),
            "warnings": sorted(set(warnings)),
            "sources": {
                **dict(reference_snapshot.get("sources") or {}),
                "contract": f"Kalshi {BTC_HOURLY_SERIES} hourly strike ladder",
            },
        }


class _PaperRobotController:
    def __init__(
        self,
        client,
        state,
        paper_accounts,
        *,
        connection_loader: Optional[Callable[[str], Mapping[str, Any]]] = None,
        signed_request: Optional[Callable[..., Dict[str, Any]]] = None,
        notifier: Optional[Callable[[str, str, Mapping[str, Any]], Any]] = None,
        observation_saver: Optional[Callable[[str, Mapping[str, Any]], Any]] = None,
        portfolio_display_loader: Optional[Callable[[str], Mapping[str, Any]]] = None,
        portfolio_display_saver: Optional[Callable[[str, Mapping[str, Any]], Any]] = None,
        scheduler_lease_acquirer: Optional[Callable[[], bool]] = None,
        worker_lease_store=None,
        reference_stream: Optional[KalshiReferenceStream] = None,
        safe_print=print,
        start_background=False,
    ):
        self.client = client
        self.state = state
        self.paper_accounts = paper_accounts
        self.connection_loader = connection_loader
        self.signed_request = signed_request
        self.notifier = notifier
        self.observation_saver = observation_saver
        self.portfolio_display_loader = portfolio_display_loader
        self.portfolio_display_saver = portfolio_display_saver
        self.scheduler_lease_acquirer = scheduler_lease_acquirer
        self.worker_lease_store = worker_lease_store
        self.reference_stream = reference_stream
        self.safe_print = safe_print
        self._stop_event = threading.Event()
        self._tick_locks: Dict[str, threading.RLock] = {}
        self._tick_locks_guard = threading.RLock()
        self._historical_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._historical_cache_lock = threading.RLock()
        self._last_hourly_tick: Dict[str, float] = {}
        self._loop_error_counts: Dict[str, int] = {}
        self._loop_alerted: set[str] = set()
        self._portfolio_display_lock = threading.RLock()
        self._local_portfolio_display: Dict[str, Dict[str, Any]] = {}
        self._runtime_lock = threading.RLock()
        self._thread = None
        self._loop_started_at = datetime.now(timezone.utc).isoformat()
        self._loop_last_heartbeat_monotonic = time.monotonic()
        self._loop_last_heartbeat_at = self._loop_started_at
        self._loop_last_error = ""
        self._scheduler_lease_owned: Optional[bool] = None
        self._scheduler_lease_checked_at = ""
        self._routing_owner_prefix = "%s:%s" % (
            os.environ.get("RENDER_INSTANCE_ID")
            or os.environ.get("HOSTNAME")
            or "local",
            uuid.uuid4().hex,
        )
        scheduler_disabled = str(
            os.environ.get("ALPHALAB_DISABLE_KALSHI_SCHEDULER") or ""
        ).strip().lower() in {"1", "true", "yes", "on"}
        self._background_requested = bool(start_background)
        self._scheduler_disabled = scheduler_disabled
        self.persist_derived_state = not scheduler_disabled
        if start_background and not scheduler_disabled:
            self._thread = threading.Thread(
                target=self._loop, name="kalshi-robot", daemon=True,
            )
            self._thread.start()
        elif start_background and scheduler_disabled:
            self.safe_print("[KalshiRobot] background scheduler disabled by environment")

    def _load_portfolio_display(self, user_id: str, *, strict: bool = False) -> Dict[str, Any]:
        if callable(self.portfolio_display_loader):
            try:
                payload = self.portfolio_display_loader(user_id)
                return dict(payload or {}) if isinstance(payload, Mapping) else {}
            except Exception as exc:
                if strict:
                    raise
                self.safe_print(
                    f"[KalshiPortfolio] display baseline read failed "
                    f"user={str(user_id)[:8]} error={type(exc).__name__}"
                )
                return {}
        return copy.deepcopy(self._local_portfolio_display.get(str(user_id)) or {})

    def _apply_portfolio_display(
        self,
        user_id: str,
        portfolio: Mapping[str, Any],
        environment: str,
        *,
        display_payload: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        result = copy.deepcopy(dict(portfolio or {}))
        payload = dict(display_payload or self._load_portfolio_display(user_id) or {})
        modes = payload.get("modes") if isinstance(payload.get("modes"), Mapping) else {}
        baseline = modes.get(environment) if isinstance(modes, Mapping) else None
        analytics = dict(result.get("analytics") or {})
        if isinstance(baseline, Mapping):
            analytics = _portfolio_analytics_after_reset(analytics, baseline)
        else:
            analytics["displayBaseline"] = {"active": False}
        result["analytics"] = analytics
        return result

    def reset_portfolio_display(self, user_id: str, *, mode: str = "paper") -> Dict[str, Any]:
        """Start a new visible Portfolio period without mutating its ledger."""
        environment = _execution_mode(mode)
        portfolio = self.portfolio(user_id, mode=environment, include_display=False, mutate=False)
        balance = dict(portfolio.get("balance") or {})
        baseline = {
            "resetAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "baselineEquityCents": int(round(_account_equity_cents(balance, environment))),
            "baselineCashCents": int(round(_finite_number(balance.get("balance"), 0.0))),
            "environment": environment,
            "ledgerPreserved": True,
        }
        with self._portfolio_display_lock:
            payload = self._load_portfolio_display(user_id, strict=True)
            modes = dict(payload.get("modes") or {}) if isinstance(payload.get("modes"), Mapping) else {}
            modes[environment] = baseline
            updated = {
                **payload,
                "schemaVersion": 1,
                "modes": modes,
                "updatedAt": baseline["resetAt"],
            }
            if callable(self.portfolio_display_saver):
                self.portfolio_display_saver(user_id, updated)
            else:
                self._local_portfolio_display[str(user_id)] = copy.deepcopy(updated)
        return self._apply_portfolio_display(
            user_id,
            portfolio,
            environment,
            display_payload=updated,
        )

    def _real_config(self, user_id: str) -> Mapping[str, Any]:
        if not callable(self.connection_loader):
            raise KalshiApiError("Kalshi credential storage is unavailable", status=503, code="credential_store_unavailable")
        config = dict(self.connection_loader(user_id) or {})
        key_field, private_field = _credential_fields("production")
        if not str(config.get(key_field) or "").strip() or not str(config.get(private_field) or "").strip():
            raise KalshiApiError(
                "Kalshi Real mode requires a configured production API key in Settings.",
                status=409,
                code="kalshi_real_credentials_missing",
            )
        if not callable(self.signed_request):
            raise KalshiApiError("Kalshi signed order transport is unavailable", status=503, code="kalshi_signed_transport_unavailable")
        return config

    def _signed(self, config: Mapping[str, Any], method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        if not callable(self.signed_request):
            raise KalshiApiError("Kalshi signed order transport is unavailable", status=503, code="kalshi_signed_transport_unavailable")
        return self.signed_request(config, "production", method, endpoint, **kwargs)

    def _optional_signed(self, config: Mapping[str, Any], endpoint: str, *, params: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
        try:
            payload = self._signed(config, "GET", endpoint, params=dict(params or {}))
            return payload if isinstance(payload, Mapping) else {}
        except Exception as exc:
            self.safe_print(f"[KalshiReal] optional signed fetch failed endpoint={endpoint} error={type(exc).__name__}")
            return {}

    def _historical_account_rows(self, user_id: str, config: Mapping[str, Any]) -> Dict[str, Any]:
        """Load paginated exchange history with a bounded 15-minute cache."""
        cache_key = str(user_id)
        now = time.monotonic()
        with self._historical_cache_lock:
            cached = self._historical_cache.get(cache_key)
            if cached and now - cached[0] < 900:
                return copy.deepcopy(cached[1])

        def collect(endpoint: str, collection: str) -> list:
            rows = []
            cursor = None
            for _ in range(5):
                params: Dict[str, Any] = {"limit": 1000}
                if cursor:
                    params["cursor"] = cursor
                payload = self._optional_signed(config, endpoint, params=params)
                page = payload.get(collection) or []
                rows.extend(dict(row) for row in page if isinstance(row, Mapping))
                cursor = payload.get("cursor") or payload.get("next_cursor")
                if not cursor or not page:
                    break
            return rows

        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="kalshi-history") as pool:
            orders_future = pool.submit(collect, "/historical/orders", "orders")
            fills_future = pool.submit(collect, "/historical/fills", "fills")
            result = {
                "orders": orders_future.result(),
                "fills": fills_future.result(),
            }
        with self._historical_cache_lock:
            self._historical_cache[cache_key] = (now, copy.deepcopy(result))
        return result

    def _live_portfolio(self, user_id: str, *, mutate: bool = True) -> Dict[str, Any]:
        config = self._real_config(user_id)
        # These endpoints are independent. Reading them concurrently cuts the
        # pre-decision account snapshot latency without increasing request count
        # or weakening any execution/risk gate.
        with ThreadPoolExecutor(max_workers=5, thread_name_prefix="kalshi-account") as pool:
            balance_future = pool.submit(self._signed, config, "GET", "/portfolio/balance")
            positions_future = pool.submit(
                self._signed, config, "GET", "/portfolio/positions", params={"limit": 100}
            )
            orders_future = pool.submit(
                self._signed, config, "GET", "/portfolio/orders", params={"limit": 100}
            )
            fills_future = pool.submit(
                self._optional_signed, config, "/portfolio/fills", params={"limit": 1000}
            )
            settlements_future = pool.submit(
                self._optional_signed, config, "/portfolio/settlements", params={"limit": 1000}
            )
            balance_payload = balance_future.result()
            positions_payload = positions_future.result()
            orders_payload = orders_future.result()
            fills_payload = fills_future.result()
            settlements_payload = settlements_future.result()
        historical = self._historical_account_rows(user_id, config)

        raw_positions = list(
            positions_payload.get("market_positions")
            or positions_payload.get("positions")
            or positions_payload.get("event_positions")
            or []
        )
        positions = []
        for row in raw_positions:
            if not isinstance(row, Mapping):
                continue
            ticker = str(row.get("ticker") or row.get("market_ticker") or row.get("market") or "")
            if not _is_supported_kalshi_ticker(ticker):
                continue
            yes_count = _finite_number(row.get("yes_count") or row.get("yes_count_fp") or row.get("yes_position") or 0.0)
            no_count = _finite_number(row.get("no_count") or row.get("no_count_fp") or row.get("no_position") or 0.0)
            position = _finite_number(row.get("position") or row.get("position_fp"), yes_count - no_count)
            if yes_count == 0 and no_count == 0 and position:
                if position > 0:
                    yes_count = abs(position)
                else:
                    no_count = abs(position)
            net_side, net_count = _live_position_direction(position, yes_count, no_count)
            if not net_side or net_count <= 0:
                continue
            exposure_dollars = _dollar_amount(
                row.get("market_exposure_dollars") or row.get("cost_dollars"),
                row.get("market_exposure") or row.get("cost") or row.get("realized_cost"),
            )
            value_dollars = _dollar_amount(
                row.get("market_value_dollars") or row.get("value_dollars") or row.get("settlement_value_dollars"),
                row.get("market_value") or row.get("value") or row.get("settlement_value"),
            )
            fee_dollars = _dollar_amount(
                row.get("fees_paid_dollars") or row.get("fee_cost_dollars"),
                row.get("fees_paid") or row.get("fee_cost") or row.get("fees"),
            )
            positions.append({
                **dict(row),
                "environment": "real",
                "ticker": ticker,
                "position_fp": position,
                "yes_count_fp": yes_count,
                "no_count_fp": no_count,
                "net_count_fp": net_count,
                "net_side": net_side,
                "market_exposure_dollars": exposure_dollars,
                "market_value_dollars": value_dollars,
                "fee_cost_dollars": fee_dollars,
                "unrealized_pnl_dollars": value_dollars - exposure_dollars - fee_dollars,
                "yes_mark_dollars": _finite_number(row.get("yes_mark_dollars") or row.get("yes_mark") or row.get("yes_price"), 0.0),
                "no_mark_dollars": _finite_number(row.get("no_mark_dollars") or row.get("no_mark") or row.get("no_price"), 0.0),
                "last_trade_at": row.get("last_trade_at") or row.get("updated_time") or row.get("created_time"),
            })

        raw_orders = list(orders_payload.get("orders") or orders_payload.get("order_history") or [])
        raw_orders.extend(historical.get("orders") or [])
        orders = []
        orders_by_id = {}
        order_fill_fallback = []
        seen_order_ids = set()
        for row in raw_orders:
            if not isinstance(row, Mapping):
                continue
            normalized = _normalise_live_order(row, row, {"side": row.get("outcome_side") or ""})
            if not _is_supported_kalshi_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
                continue
            order_key = str(normalized.get("order_id") or normalized.get("client_order_id") or "")
            if order_key and order_key in seen_order_ids:
                continue
            if order_key:
                seen_order_ids.add(order_key)
            orders.append(normalized)
            for identifier in (normalized.get("order_id"), normalized.get("client_order_id")):
                if identifier:
                    orders_by_id[str(identifier)] = normalized
            if _order_fill_count(normalized) > 0:
                fill_id = str(normalized.get("order_id") or normalized.get("client_order_id") or "")
                order_fill_fallback.append({**normalized, "fill_id": fill_id})

        raw_fills = list(
            fills_payload.get("fills")
            or fills_payload.get("fill_history")
            or fills_payload.get("trades")
            or []
        )
        raw_fills.extend(historical.get("fills") or [])
        fills = []
        seen_fill_ids = set()
        for row in raw_fills:
            if not isinstance(row, Mapping):
                continue
            order_context = orders_by_id.get(str(row.get("order_id") or ""))
            normalized = _normalise_live_fill(row, order_context)
            if not _is_supported_kalshi_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
                continue
            fill_id = str(normalized.get("fill_id") or normalized.get("order_id") or uuid.uuid4())
            if fill_id in seen_fill_ids:
                continue
            seen_fill_ids.add(fill_id)
            fills.append(normalized)
        # Prefer canonical fill rows. Order summaries are only a degraded
        # fallback when the optional fills endpoint is unavailable/empty; using
        # both would count one execution twice under different identifiers.
        if not fills:
            fills = order_fill_fallback
        fills = _reconcile_live_exit_fills(fills)
        open_inventory = _open_live_fill_inventory(fills)
        for position_row in positions:
            ticker = str(position_row.get("ticker") or "")
            side = str(position_row.get("net_side") or "").upper()
            inventory = open_inventory.get((ticker, side))
            if not inventory:
                continue
            prefix = side.lower()
            position_row[f"{prefix}_average_price_dollars"] = inventory["averagePrice"]
            position_row[f"{prefix}_cost"] = inventory["principal"]
            position_row[f"{prefix}_fee_cost_dollars"] = inventory["entryFee"]
            position_row["position_cost_dollars"] = inventory["principal"]
            position_row["fee_cost_dollars"] = inventory["entryFee"]
            position_row["last_trade_at"] = inventory.get("lastTradeAt") or position_row.get("last_trade_at")
            # Cost-based unrealized P/L is intentionally marked only when the
            # position endpoint supplies a usable current value.
            if _finite_number(position_row.get("market_value_dollars"), 0.0) > 0:
                position_row["unrealized_pnl_dollars"] = (
                    _finite_number(position_row.get("market_value_dollars"))
                    - inventory["principal"]
                    - inventory["entryFee"]
                )

        raw_settlements = list(
            settlements_payload.get("settlements")
            or settlements_payload.get("settlement_history")
            or settlements_payload.get("market_settlements")
            or []
        )
        settlements = []
        for row in raw_settlements:
            if not isinstance(row, Mapping):
                continue
            normalized = _normalise_live_settlement(row)
            if _is_supported_kalshi_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
                settlements.append(normalized)

        before_state = self.state.get(user_id, environment="real")
        before_records = {
            str(row.get("key") or "")
            for row in ((before_state.get("strategy") or {}).get("settlementRecords") or [])
            if row.get("key")
        }
        if mutate:
            state = self.state.reconcile_settlements(
                user_id,
                settlements,
                fills,
                environment="real",
                persist=self.persist_derived_state,
            )
            if self.persist_derived_state:
                for record in ((state.get("strategy") or {}).get("settlementRecords") or []):
                    if str(record.get("key") or "") not in before_records:
                        self._notify_settlement(user_id, record)
        else:
            state = before_state
        analytics = _portfolio_analytics(state.get("strategy") or {})

        return {
            "environment": "real",
            "accountProvider": "Kalshi",
            "asOf": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "balance": {
                "balance": _cents_amount(balance_payload.get("balance")),
                "portfolio_value": _cents_amount(balance_payload.get("portfolio_value") or balance_payload.get("portfolioValue")),
            },
            "positions": [_tag_market_family(row) for row in positions],
            "orders": [_tag_market_family(row) for row in orders],
            "fills": [_tag_market_family(row) for row in fills],
            "settlements": [_tag_market_family(row) for row in settlements],
            "analytics": analytics,
        }

    def portfolio(
        self,
        user_id: str,
        *,
        mode: str = "paper",
        include_display: bool = False,
        mutate: bool = True,
    ) -> Dict[str, Any]:
        environment = _execution_mode(mode)
        if environment == "real":
            result = self._live_portfolio(user_id, mutate=mutate)
            return self._apply_portfolio_display(user_id, result, environment) if include_display else result
        open_tickers = set(self.paper_accounts.open_tickers(user_id))
        refreshed_markets: Dict[str, Mapping[str, Any]] = {}
        if open_tickers and mutate:
            # A user can hold several rolling contracts at once. Sequential
            # market refreshes used to exceed the frontend's ten-second poll,
            # causing every completed response to be discarded as stale. Fetch
            # the independent marks concurrently, then update the ledger in a
            # deterministic single-threaded pass.
            with ThreadPoolExecutor(
                max_workers=min(8, len(open_tickers)),
                thread_name_prefix="kalshi-paper-marks",
            ) as pool:
                futures = {ticker: pool.submit(self.client.market, ticker) for ticker in open_tickers}
                for ticker, future in futures.items():
                    try:
                        refreshed_markets[ticker] = future.result()
                    except Exception as exc:
                        self.safe_print(
                            f"[KalshiPaper] market refresh failed ticker={ticker} "
                            f"error={type(exc).__name__}"
                        )
        for ticker in (sorted(open_tickers) if mutate else []):
            market = refreshed_markets.get(ticker)
            if not market:
                continue
            result_value = str(market.get("result") or market.get("market_result") or "").upper()
            if result_value in {"YES", "NO"}:
                settled_time = str(market.get("settlement_ts") or market.get("determined_time") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
                settlement = self.paper_accounts.settle(
                    user_id,
                    ticker,
                    result_value,
                    settled_time=settled_time,
                    persist=self.persist_derived_state,
                )
                if settlement:
                    if self.persist_derived_state:
                        self._notify_settlement(user_id, settlement)
            else:
                self.paper_accounts.update_mark(user_id, ticker, market)
        result = self.paper_accounts.portfolio(user_id)
        for collection in ("positions", "orders", "fills", "settlements"):
            result[collection] = [
                row for row in result.get(collection) or []
                if _is_supported_kalshi_ticker((row or {}).get("ticker") or (row or {}).get("market_ticker"))
            ]
        state = (
            self.state.reconcile_settlements(
                user_id,
                result["settlements"],
                result["fills"],
                environment=environment,
                persist=self.persist_derived_state,
            )
            if mutate
            else self.state.get(user_id, environment=environment)
        )
        result["analytics"] = _portfolio_analytics(state.get("strategy") or {})
        for collection in ("positions", "orders", "fills", "settlements"):
            result[collection] = [_tag_market_family(row) for row in result.get(collection) or []]
        return self._apply_portfolio_display(user_id, result, environment) if include_display else result

    @contextmanager
    def _live_routing_lease(self, user_id: str) -> Iterator[Dict[str, Any]]:
        claim = getattr(self.worker_lease_store, "claim_worker_lease_fenced", None)
        renew = getattr(self.worker_lease_store, "renew_worker_lease", None)
        release = getattr(self.worker_lease_store, "release_worker_lease", None)
        if not (callable(claim) and callable(renew) and callable(release)):
            raise KalshiApiError(
                "Fenced Kalshi order-routing coordination is unavailable",
                status=503,
                code="kalshi_routing_fence_unavailable",
            )
        uid_digest = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()[:32]
        lease_name = "kalshi-routing:%s" % uid_digest
        owner_id = "%s:routing:%s" % (
            self._routing_owner_prefix, uuid.uuid4().hex,
        )
        deadline = time.monotonic() + KALSHI_ROUTING_LEASE_TIMEOUT_SECONDS
        lease = None
        while True:
            try:
                result = claim(
                    lease_name,
                    owner_id,
                    ttl_seconds=KALSHI_ROUTING_LEASE_TTL_SECONDS,
                    metadata={
                        "component": "kalshi_order_routing",
                        "userScope": uid_digest,
                    },
                )
            except Exception as exc:
                raise KalshiApiError(
                    "Durable Kalshi order-routing coordination is unavailable",
                    status=503,
                    code="kalshi_routing_lease_unavailable",
                ) from exc
            if (
                isinstance(result, Mapping)
                and result.get("acquired")
                and result.get("fencingToken")
            ):
                lease = {
                    "lease_name": lease_name,
                    "owner_id": owner_id,
                    "fencing_token": int(result["fencingToken"]),
                    "user_scope": uid_digest,
                }
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise KalshiApiError(
                    "Kalshi order routing is busy; retry shortly",
                    status=423,
                    code="kalshi_routing_lease_timeout",
                )
            time.sleep(min(0.025, remaining))
        try:
            yield lease
        finally:
            try:
                release(
                    lease["lease_name"],
                    lease["owner_id"],
                    lease["fencing_token"],
                )
            except Exception as exc:
                self.safe_print(
                    "[KalshiReal] routing lease release failed error=%s"
                    % type(exc).__name__
                )

    def _renew_live_routing_lease(self, lease: Mapping[str, Any]) -> None:
        renew = getattr(self.worker_lease_store, "renew_worker_lease", None)
        if not callable(renew):
            raise KalshiApiError(
                "Fenced Kalshi order-routing coordination is unavailable",
                status=503,
                code="kalshi_routing_fence_unavailable",
            )
        try:
            renewed = bool(renew(
                lease.get("lease_name"),
                lease.get("owner_id"),
                lease.get("fencing_token"),
                ttl_seconds=KALSHI_ROUTING_LEASE_TTL_SECONDS,
                metadata={
                    "component": "kalshi_order_routing",
                    "userScope": lease.get("user_scope"),
                },
            ))
        except Exception as exc:
            raise KalshiApiError(
                "Durable Kalshi order-routing coordination is unavailable",
                status=503,
                code="kalshi_routing_lease_unavailable",
            ) from exc
        if not renewed:
            raise KalshiApiError(
                "This backend no longer owns the fenced Kalshi routing lease",
                status=423,
                code="kalshi_routing_lease_lost",
            )

    def _submit_live_order(self, user_id: str, payload: Mapping[str, Any], decision: Mapping[str, Any]) -> Dict[str, Any]:
        live_payload = _live_order_payload(payload)
        if not live_payload.get("ticker") or not live_payload.get("client_order_id"):
            raise KalshiApiError("Real Kalshi order payload is incomplete", status=400, code="kalshi_live_order_incomplete")
        with self._live_routing_lease(user_id) as lease:
            if self.state is None or not callable(getattr(self.state, "get", None)):
                raise KalshiApiError(
                    "Durable Kalshi robot state is unavailable",
                    status=503,
                    code="kalshi_robot_state_unavailable",
                )
            latest_state = self.state.get(user_id, environment="real")
            latest_config = dict((latest_state or {}).get("config") or {})
            if (
                not bool((latest_state or {}).get("enabled"))
                or _execution_mode(latest_config.get("executionMode")) != "real"
            ):
                raise KalshiApiError(
                    "Real Kalshi automation was stopped before order submission",
                    status=409,
                    code="kalshi_automation_stopped",
                )
            config = self._real_config(user_id)
            recent = self._signed(
                config,
                "GET",
                "/portfolio/orders",
                params={"ticker": live_payload["ticker"], "limit": 100},
            )
            existing = next(
                (
                    dict(row)
                    for row in (recent.get("orders") or [])
                    if isinstance(row, Mapping)
                    and str(row.get("client_order_id") or "")
                    == str(live_payload["client_order_id"])
                ),
                None,
            )
            if existing is not None:
                return {
                    **_normalise_live_order(existing, payload, decision),
                    "idempotent": True,
                }
            # The account read above can outlive a lease generation. An exact
            # unexpired-token renewal is the final fence before the real POST.
            self._renew_live_routing_lease(lease)
            response = self._signed(
                config,
                "POST",
                "/portfolio/events/orders",
                json_body=live_payload,
            )
        raw_order = response.get("order") or response.get("order_response") or response
        if not isinstance(raw_order, Mapping):
            raw_order = {}
        # The local payload also contains the user-outcome price that is
        # intentionally stripped before the signed request.  Keep it only for
        # normalization so NO orders cannot be recorded at the complementary
        # YES-book price.
        order = _normalise_live_order(raw_order, payload, decision)
        self._notify_order(user_id, order, decision)
        return order

    def tick(
        self,
        user_id: str,
        *,
        submit_order: bool,
        mode: Optional[str] = None,
        family: str = "btc15m",
    ) -> Dict[str, Any]:
        """Serialize each account's evaluate-and-route cycle.

        The background scheduler and a manual refresh may arrive together. A
        per-user lock prevents both from observing the same position and
        submitting the same close before either portfolio refresh completes.
        """
        key = str(user_id)
        with self._tick_locks_guard:
            lock = self._tick_locks.setdefault(key, threading.RLock())
        with lock:
            return self._tick_locked(
                user_id,
                submit_order=submit_order,
                mode=mode,
                family=family,
            )

    def _tick_locked(
        self,
        user_id: str,
        *,
        submit_order: bool,
        mode: Optional[str] = None,
        family: str = "btc15m",
    ) -> Dict[str, Any]:
        seed_state = self.state.get(user_id)
        strategy_seed = dict(seed_state.get("config") or {})
        execution_mode = _execution_mode(mode or strategy_seed.get("executionMode") or "paper")
        robot_state = self.state.get(user_id, environment=execution_mode)
        strategy_seed = dict(robot_state.get("config") or {})
        try:
            portfolio = self.portfolio(
                user_id,
                mode=execution_mode,
                mutate=bool(submit_order),
            )
        except TypeError as exc:
            # Preserve compatibility with small injected portfolio adapters used
            # by integrations/tests that predate the explicit read-only flag.
            if "unexpected keyword argument 'mutate'" not in str(exc):
                raise
            portfolio = self.portfolio(user_id, mode=execution_mode)
        environment = "real" if execution_mode == "real" else "paper"
        balance = portfolio.get("balance") or {}
        cash_cents = _finite_number(balance.get("balance"), 0.0)
        # Current Kalshi /portfolio/balance semantics define portfolio_value as
        # total account value (available balance plus marked positions). Do not
        # add cash again or Real sizing will be overstated. AlphaLab Paper keeps
        # open-position value separately and still requires the sum.
        bankroll_cents = _account_equity_cents(balance, execution_mode)
        try:
            bankroll = float(bankroll_cents) / 100.0
        except (TypeError, ValueError):
            bankroll = 0.0 if execution_mode == "real" else 1000.0
        if execution_mode != "real":
            bankroll = max(100.0, bankroll)
        strategy_config = dict(robot_state.get("config") or {})
        strategy_config["executionMode"] = execution_mode
        strategy_config["paperBankroll"] = bankroll
        strategy_config = normalize_strategy_config(strategy_config)
        family = "btchourly" if str(family).lower() == "btchourly" else "btc15m"
        reference_override = None
        if self.reference_stream is not None:
            try:
                reference_override = self.reference_stream.snapshot(user_id)
            except Exception as exc:
                self.safe_print(
                    f"[KalshiBRTI] snapshot unavailable user={str(user_id)[:8]} "
                    f"error={type(exc).__name__}"
                )
        if family == "btchourly":
            hourly_snapshot_args: Dict[str, Any] = {"base_url": KALSHI_PUBLIC_BASE}
            if reference_override is not None:
                hourly_snapshot_args["reference_override"] = reference_override
            ladder = self.client.hourly_snapshot(**hourly_snapshot_args)
            hourly_config = {
                **strategy_config,
                "riskPerTradePct": min(_finite_number(strategy_config.get("riskPerTradePct"), 0.75), 0.50),
                "minNetEdge": max(0.005, min(_finite_number(strategy_config.get("minNetEdge"), 0.0075), 0.0075)),
                "minConservativeEdge": max(0.001, min(_finite_number(strategy_config.get("minConservativeEdge"), 0.002), 0.002)),
                "marketBlendWeight": max(
                    0.45,
                    min(_finite_number(strategy_config.get("marketBlendWeight"), 0.45), 0.65),
                ),
                "minSecondsToClose": 120,
                "maxSecondsToClose": 1800,
                "minPrice": 0.48,
                "maxPrice": 0.96,
                "minModelProbability": 0.56,
                "maxSingleMarketExposurePct": min(_finite_number(strategy_config.get("maxSingleMarketExposurePct"), 8.0), 6.0),
            }
            hourly_config = normalize_strategy_config(hourly_config)
            candidates = []
            for market in ladder.get("markets") or []:
                candidate_ticker = str((market or {}).get("ticker") or "")
                book = (ladder.get("orderbooks") or {}).get(candidate_ticker) or {}
                context = _paper_account_context(portfolio, robot_state, candidate_ticker, bankroll)
                if context.get("hasPosition"):
                    context["hasPosition"] = False
                    context["alreadyTraded"] = False
                candidate_reference = dict(ladder.get("reference") or {})
                candidate_reference.update(
                    dict((ladder.get("ladderFit") or {}).get(candidate_ticker) or {})
                )
                candidate = evaluate_btc15_contract(
                    market,
                    spot_price=(ladder.get("reference") or {}).get("price"),
                    candles=(ladder.get("reference") or {}).get("candles") or [],
                    config=hourly_config,
                    orderbook=book,
                    reference_time=(ladder.get("reference") or {}).get("timestamp"),
                    reference_metadata=candidate_reference,
                    book_time=ladder.get("orderbookAsOf"),
                    account_context=context,
                )
                candidates.append((candidate, market, book))
            if not candidates:
                raise KalshiApiError("The active KXBTCD event has no executable strike candidates")
            # Prefer a routable opportunity; otherwise expose the closest
            # uncertainty-adjusted candidate so the UI explains why it waited.
            decision, selected_market, selected_book = max(
                candidates,
                key=lambda item: (
                    1 if str(item[0].get("action") or "").startswith("BUY_") else 0,
                    _finite_number((item[0].get("edge") or {}).get("conservativeEdge"), -99.0),
                    _finite_number((item[0].get("edge") or {}).get("netEdge"), -99.0),
                ),
            )
            strategy_config = hourly_config
            snapshot = {
                **dict(ladder),
                "market": dict(selected_market),
                "orderbook": dict(selected_book),
                "candidateCount": len(candidates),
                "candidateSummary": [
                    {
                        "ticker": (item[1] or {}).get("ticker"),
                        "strike": (item[1] or {}).get("floor_strike"),
                        "action": item[0].get("action"),
                        "side": item[0].get("side"),
                        "netEdge": (item[0].get("edge") or {}).get("netEdge"),
                        "conservativeEdge": (item[0].get("edge") or {}).get("conservativeEdge"),
                        "blockingReasons": item[0].get("blockingReasons"),
                    }
                    for item in candidates
                ],
            }
        else:
            snapshot_args: Dict[str, Any] = {"base_url": KALSHI_PUBLIC_BASE}
            if reference_override is not None:
                snapshot_args["reference_override"] = reference_override
            snapshot = self.client.snapshot(**snapshot_args)
            candidate_ticker = str((snapshot.get("market") or {}).get("ticker") or "")
            context = _paper_account_context(portfolio, robot_state, candidate_ticker, bankroll)
            if context.get("hasPosition"):
                context["hasPosition"] = False
                context["alreadyTraded"] = False
            decision = evaluate_btc15_contract(
                snapshot["market"],
                spot_price=snapshot["reference"].get("price"),
                candles=snapshot["reference"].get("candles") or [],
                config=strategy_config,
                orderbook=snapshot.get("orderbook") or {},
                reference_time=snapshot["reference"].get("timestamp"),
                reference_metadata=snapshot.get("reference") or {},
                book_time=snapshot.get("orderbookAsOf"),
                account_context=context,
            )
        decision = dict(decision)
        decision["marketFamily"] = family
        decision["engine"] = "btchourly-strike-ladder-v2" if family == "btchourly" else decision.get("engine")
        decision["dataQuality"] = {
            "referenceModel": (snapshot.get("reference") or {}).get("model"),
            "officialBrti": bool((snapshot.get("reference") or {}).get("isOfficialBrti")),
            "referenceAgeSeconds": (decision.get("model") or {}).get("referenceAgeSeconds"),
            "bookAgeSeconds": (decision.get("market") or {}).get("bookAgeSeconds"),
            "snapshotLatencyMs": snapshot.get("latencyMs"),
            "settlementWindowSamples": (snapshot.get("reference") or {}).get("settlementWindowSamples"),
            "warnings": list(snapshot.get("warnings") or []),
            "candidateCount": snapshot.get("candidateCount", 1),
        }
        ticker = str((snapshot.get("market") or {}).get("ticker") or "")
        account_context = _paper_account_context(portfolio, robot_state, ticker, bankroll)
        position_context = _position_execution_context(portfolio, ticker)
        held_side = position_context.get("side")
        held_count = int(position_context.get("count") or 0)
        fair_yes = _finite_number((decision.get("model") or {}).get("fairYesProbability"), 0.5)
        held_probability = (
            fair_yes if held_side == "YES"
            else 1.0 - fair_yes if held_side == "NO"
            else None
        )
        sale_estimate = (
            _estimate_reduce_only_sale(held_side, held_count, snapshot.get("orderbook") or {})
            if held_side and held_count > 0
            else {}
        )
        fillable_exit_count = int(sale_estimate.get("fillableCount") or 0)
        exit_net_per_contract = (
            _finite_number(sale_estimate.get("netProceeds")) / fillable_exit_count
            if fillable_exit_count > 0
            else None
        )
        hold_age_seconds = _seconds_since(position_context.get("lastTradeAt"))
        if hold_age_seconds is None and held_side:
            hold_age_seconds = _recent_filled_entry_age(robot_state, ticker)
        minimum_hold_seconds = int(_finite_number(strategy_config.get("minimumHoldSeconds"), 45))
        exit_value_buffer = _finite_number(strategy_config.get("exitValueBuffer"), 0.01)
        exit_value_edge = (
            exit_net_per_contract - held_probability
            if exit_net_per_contract is not None and held_probability is not None
            else None
        )
        exit_economics = _exit_economic_state(
            average_entry_price=position_context.get("averageEntryPrice"),
            allocated_entry_fee=_finite_number(position_context.get("allocatedEntryFee"), 0.0),
            held_count=held_count,
            net_exit_value_per_contract=exit_net_per_contract,
            held_probability=held_probability,
            strategy_config=strategy_config,
        )
        economically_executable = bool(
            fillable_exit_count > 0
            and exit_value_edge is not None
            and exit_value_edge >= exit_value_buffer
            and exit_economics["profitableExit"]
        )
        exit_analysis = {
            **position_context,
            **sale_estimate,
            **exit_economics,
            "heldProbability": held_probability,
            "netExitValuePerContract": exit_net_per_contract,
            "exitValueEdge": exit_value_edge,
            "requiredExitValueEdge": exit_value_buffer,
            "holdAgeSeconds": hold_age_seconds,
            "minimumHoldSeconds": minimum_hold_seconds,
            "economicallyExecutable": economically_executable,
        }
        decision["exitAnalysis"] = exit_analysis
        decision["account"] = {
            "heldSide": held_side,
            "heldCount": held_count,
            "cashAvailable": account_context.get("cashAvailable"),
            "portfolioExposure": account_context.get("portfolioExposure"),
            "currentMarketExposure": account_context.get("currentMarketExposure"),
        }

        if execution_mode == "real" and cash_cents <= 0 and not held_side:
            decision["action"] = "WAIT"
            decision["executionIntent"] = "WAIT_REAL_NO_CASH"
            decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["real_cash_unavailable"]
            decision["gates"] = list(decision.get("gates") or []) + [{
                "category": "account",
                "name": "Real cash available",
                "status": "block",
                "value": 0,
                "threshold": "> 0",
                "detail": "Real Kalshi account has no available cash; robot will not submit orders.",
            }]
            decision["sizing"] = {**dict(decision.get("sizing") or {}), "contracts": 0, "notional": 0.0}
        order = None
        decision_side = str(decision.get("side") or "").upper()
        can_route = False
        route_count_override: Optional[int] = None
        if str(decision.get("action") or "").startswith("BUY_") and ticker:
            if held_side and held_side == decision_side:
                add_age_seconds = _seconds_since(position_context.get("lastTradeAt"))
                minimum_add_interval = int(_finite_number(strategy_config.get("minimumAddIntervalSeconds"), 30))
                add_probability = _finite_number(
                    (decision.get("edge") or {}).get("fairProbability"),
                    _finite_number((decision.get("edge") or {}).get("modelProbability"), 0.0),
                )
                add_edge = _finite_number((decision.get("edge") or {}).get("conservativeEdge"), -1.0)
                add_probability_floor = _finite_number(strategy_config.get("addMinModelProbability"), 0.67)
                add_edge_floor = _finite_number(strategy_config.get("addMinConservativeEdge"), 0.01)
                previous_signal = _recent_filled_entry_signal(robot_state, ticker, decision_side)
                probability_improvement = _finite_number(
                    strategy_config.get("addMinProbabilityImprovement"), 0.01
                )
                edge_improvement = _finite_number(strategy_config.get("addMinEdgeImprovement"), 0.001)
                signal_improved = bool(
                    not previous_signal
                    or add_probability >= previous_signal["probability"] + probability_improvement
                    or add_edge >= previous_signal["conservativeEdge"] + edge_improvement
                )
                if account_context.get("hasOpenOrder"):
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["add_order_pending"]
                elif add_age_seconds is not None and add_age_seconds < minimum_add_interval:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["add_interval"]
                elif add_probability < add_probability_floor or add_edge < add_edge_floor or not signal_improved:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["add_signal_not_improved"]
                elif int(_finite_number((decision.get("sizing") or {}).get("contracts"), 0.0)) <= 0:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["add_exposure_full"]
                else:
                    can_route = True
                    proposed_add = int(_finite_number((decision.get("sizing") or {}).get("contracts"), 0.0))
                    add_fraction = max(
                        0.10,
                        min(1.0, _finite_number(strategy_config.get("addSizeFraction"), 0.50)),
                    )
                    route_count_override = max(1, int(math.floor(proposed_add * add_fraction)))
                    decision["executionIntent"] = f"ADD_{decision_side}"
                    decision["positionManagement"] = {
                        "mode": "add",
                        "existingContracts": held_count,
                        "proposedContracts": proposed_add,
                        "routedContracts": route_count_override,
                        "addSizeFraction": add_fraction,
                        "secondsSinceLastFill": add_age_seconds,
                        "minimumAddIntervalSeconds": minimum_add_interval,
                        "minimumAddModelProbability": add_probability_floor,
                        "minimumAddConservativeEdge": add_edge_floor,
                        "previousSignal": previous_signal,
                        "minimumProbabilityImprovement": probability_improvement,
                        "minimumEdgeImprovement": edge_improvement,
                    }
            elif held_side and held_side != decision_side:
                if account_context.get("hasOpenOrder"):
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["close_order_pending"]
                elif (
                    hold_age_seconds is not None
                    and hold_age_seconds < minimum_hold_seconds
                    and not exit_economics["emergencyLossExit"]
                ):
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["minimum_hold_period"]
                elif fillable_exit_count <= 0:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["no_executable_close_depth"]
                elif not economically_executable and not exit_economics["lossExitAuthorized"]:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["reversal_exit_value_insufficient"]
                elif exit_net_per_contract is not None and 0.0 < exit_net_per_contract < 1.0:
                    # A reversal is deliberately two-step. First reduce the
                    # existing outcome to zero; a later fresh cycle may open the
                    # opposite side. Full-depth VWAP, fees, and the model's
                    # expected hold value must justify the close first.
                    decision["action"] = f"SELL_{held_side}"
                    decision["side"] = held_side
                    decision["edge"] = {
                        **dict(decision.get("edge") or {}),
                        "side": held_side,
                        # Route at the worst depth level included by the
                        # estimator. A VWAP limit would exclude lower bids and
                        # can turn a planned full close into a partial fill.
                        "price": _finite_number(sale_estimate.get("worstBid"), exit_net_per_contract),
                    }
                    decision["blockingReasons"] = []
                    decision["executionIntent"] = f"CLOSE_{held_side}_FOR_REVERSE_TO_{decision_side}"
                    decision["exitAnalysis"]["trigger"] = (
                        "emergency_stop_loss"
                        if exit_economics["emergencyLossExit"]
                        else "protective_stop_loss"
                        if exit_economics["protectiveLossExit"] and not economically_executable
                        else "fee_adjusted_take_profit"
                    )
                    route_count_override = fillable_exit_count
                    can_route = True
                else:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["no_executable_close_bid"]
            else:
                # There is deliberately no per-contract or per-day trade-count
                # ceiling.  Re-entry is governed by current position/open-order,
                # cash, Kelly sizing, exposure, and anti-churn timing gates.
                recent_exit_age = _recent_filled_exit_age(robot_state, ticker)
                reversal_cooldown = int(_finite_number(strategy_config.get("reversalCooldownSeconds"), 90))
                if recent_exit_age is not None and recent_exit_age < reversal_cooldown:
                    decision["action"] = "WAIT"
                    decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["reversal_cooldown"]
                    decision["exitAnalysis"]["recentExitAgeSeconds"] = recent_exit_age
                    decision["exitAnalysis"]["reversalCooldownSeconds"] = reversal_cooldown
                else:
                    can_route = True
                    decision["executionIntent"] = f"OPEN_{decision_side}"
        elif held_side and ticker:
            if account_context.get("hasOpenOrder"):
                decision["action"] = "WAIT"
                decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["close_order_pending"]
            elif (
                hold_age_seconds is not None
                and hold_age_seconds < minimum_hold_seconds
                and not exit_economics["emergencyLossExit"]
            ):
                decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["minimum_hold_period"]
            elif (
                fillable_exit_count > 0
                and exit_net_per_contract is not None
                and (
                    economically_executable
                    or exit_economics["lossExitAuthorized"]
                )
            ):
                # Close the held outcome with a reduce-only sale. Buying the
                # complementary outcome is a hedge, not a close. A normal exit
                # requires a real fee-adjusted profit. A loss exit requires both
                # material model deterioration and a configured realized-loss
                # gate; an emergency can only bypass the minimum hold period.
                decision["action"] = f"SELL_{held_side}"
                decision["side"] = held_side
                decision["edge"] = {
                    **dict(decision.get("edge") or {}),
                    "side": held_side,
                    "price": _finite_number(sale_estimate.get("worstBid"), exit_net_per_contract),
                    "conservativeEdge": max(0.0, exit_value_edge),
                    "minimumConservativeEdge": 0.0,
                }
                decision["blockingReasons"] = []
                decision["executionIntent"] = f"CLOSE_{held_side}"
                exit_trigger = (
                    "emergency_stop_loss"
                    if exit_economics["emergencyLossExit"]
                    else "protective_stop_loss"
                    if exit_economics["protectiveLossExit"] and not economically_executable
                    else "fee_adjusted_take_profit"
                )
                decision["exitAnalysis"]["trigger"] = exit_trigger
                if exit_trigger == "fee_adjusted_take_profit" and fillable_exit_count > 1:
                    scale_out = max(
                        0.10,
                        min(1.0, _finite_number(strategy_config.get("takeProfitScaleOutPct"), 0.50)),
                    )
                    route_count_override = max(1, int(math.ceil(fillable_exit_count * scale_out)))
                    decision["executionIntent"] = f"REDUCE_{held_side}_TAKE_PROFIT"
                    decision["positionManagement"] = {
                        "mode": "reduce",
                        "existingContracts": held_count,
                        "routedContracts": route_count_override,
                        "takeProfitScaleOutPct": scale_out,
                        "remainingIfFilled": max(0, held_count - route_count_override),
                    }
                else:
                    route_count_override = fillable_exit_count
                can_route = True
            else:
                decision["executionIntent"] = f"HOLD_{held_side}_TO_SETTLEMENT"
                decision["exitAnalysis"]["trigger"] = "hold_to_settlement"
        if (
            submit_order
            and bool(robot_state.get("enabled"))
            and can_route
        ):
            order_payload = _paper_order_payload(
                decision,
                ticker,
                count_override=route_count_override,
                price_tolerance=_finite_number(strategy_config.get("executionPriceTolerance"), 0.01),
                client_order_id=_intent_client_order_id(
                    user_id,
                    execution_mode,
                    ticker,
                    str(decision.get("action") or ""),
                    str(decision.get("side") or ""),
                    held_count,
                ),
            )
            if order_payload:
                side = str(decision.get("side") or "").upper()
                is_close_order = str(decision.get("action") or "").startswith("SELL_")
                selected_price = _finite_number((decision.get("edge") or {}).get("price"), 0.0)
                available_depth = _finite_number(
                    ((decision.get("market") or {}).get("yesAskDepth") if side == "YES" else (decision.get("market") or {}).get("noAskDepth")),
                    _finite_number((decision.get("market") or {}).get("selectedDepth"), float(order_payload.get("count") or 0)),
                )
                if execution_mode == "real":
                    order = self._submit_live_order(user_id, order_payload, decision)
                elif is_close_order:
                    order = self.paper_accounts.submit_close(
                        user_id,
                        ticker=ticker,
                        side=side,
                        price=selected_price,
                        contracts=int(float(order_payload["count"])),
                        limit_price=_finite_number(order_payload.get("user_side_limit_price"), selected_price),
                        orderbook=snapshot.get("orderbook") or {},
                        client_order_id=str(order_payload["client_order_id"]),
                    )
                else:
                    order = self.paper_accounts.submit_taker(
                        user_id,
                        ticker=ticker,
                        side=side,
                        price=selected_price,
                        contracts=int(float(order_payload["count"])),
                        available_depth=available_depth,
                        limit_price=_finite_number(order_payload.get("user_side_limit_price"), selected_price),
                        orderbook=snapshot.get("orderbook") or {},
                        client_order_id=str(order_payload["client_order_id"]),
                        market=snapshot.get("market") or {},
                    )
                if order and execution_mode != "real":
                    self._notify_order(user_id, order, decision)
        # Only the lease-owning execution cycle mutates durable robot state.
        # Browser refreshes still persist their compact research observation
        # below, but must not race the online scheduler or overwrite its
        # enabled flag, decision history, and fill guards from another process.
        state = (
            self.state.record(user_id, decision, order)
            if submit_order
            else robot_state
        )
        observation = _market_observation(environment, decision, order)
        if observation and callable(self.observation_saver):
            try:
                self.observation_saver(user_id, observation)
            except Exception as exc:
                self.safe_print(
                    f"[KalshiRobot] observation persistence failed "
                    f"user={user_id} ticker={observation.get('ticker')} "
                    f"error={type(exc).__name__}"
                )
        if order and str(decision.get("action") or "").startswith("SELL_"):
            state = self.state.record_early_close(
                user_id,
                decision,
                order,
                environment=environment,
            )
        if order:
            # The initial portfolio was read before the IOC order. Refresh after
            # submission so the UI can immediately show filled positions, fills,
            # and any rejected/unfilled order status.
            try:
                portfolio = self.portfolio(user_id, mode=execution_mode, mutate=True)
            except Exception as exc:
                self.safe_print(f"[KalshiPaper] post-order portfolio refresh failed user={user_id} error={type(exc).__name__}")
        clean_snapshot = dict(snapshot)
        clean_snapshot["reference"] = dict(snapshot["reference"])
        clean_snapshot["reference"].pop("candles", None)
        return {
            "portfolio": portfolio,
            "state": state,
            "snapshot": clean_snapshot,
            "decision": decision,
            "order": order,
            "orderSubmitted": bool(order),
            "orderFilled": _order_fill_count(order) > 0,
        }

    def _notify(self, user_id: str, event_type: str, payload: Mapping[str, Any]) -> None:
        if not callable(self.notifier):
            return
        try:
            self.notifier(user_id, event_type, dict(payload or {}))
        except Exception as exc:
            self.safe_print(f"[KalshiPaper] discord notify failed user={user_id} event={event_type} error={type(exc).__name__}")

    def _notify_order(self, user_id: str, order: Mapping[str, Any], decision: Mapping[str, Any]) -> None:
        mode = _execution_mode(order.get("environment") or (decision.get("config") or {}).get("executionMode") or "paper")
        source = "Kalshi Real Robot" if mode == "real" else "Kalshi Paper Robot"
        status = str(order.get("status") or "").lower()
        filled = int(_finite_number(order.get("fill_count_fp"), 0.0))
        requested = int(_finite_number(order.get("count_fp"), 0.0))
        symbol = str(order.get("ticker") or "")
        side = str(order.get("outcome_side") or "").upper()
        avg_price = _finite_number(order.get("average_price_dollars"), None)
        limit_price = _finite_number(order.get("limit_price_dollars"), None)
        fee = _finite_number(order.get("fee_cost_dollars"), 0.0)
        action_name = "SELL" if bool(order.get("reduce_only")) or str(order.get("action") or "").upper() == "SELL" else "BUY"
        action_zh = "卖出减仓" if action_name == "SELL" else "买入"
        payload = {
            "source": source,
            "notificationScope": "kalshi",
            "assetClass": "kalshi",
            "event_id": order.get("order_id") or order.get("client_order_id"),
            "mode": mode,
            "symbol": symbol,
            "side": action_name,
            "action": f"{action_name} {side}".strip(),
            "qty": f"{filled} / {requested} contracts",
            "orderType": "IOC limit",
            "price": f"{avg_price * 100:.1f}c avg" if avg_price is not None else None,
            "limitPrice": f"{limit_price * 100:.1f}c limit" if limit_price is not None else None,
            "status": "filled" if status in {"filled", "partially_filled"} else status,
            "orderId": order.get("order_id"),
            "description": f"{source} {action_name.lower()} {status.replace('_', ' ')} {filled}/{requested} {side} on {symbol}.",
            "descriptionZh": f"Kalshi {'实盘' if mode == 'real' else '模拟盘'}{action_zh}{status.replace('_', ' ')}：{symbol} {side} 成交 {filled}/{requested} 张。",
            "reason": (
                f"Intent {decision.get('executionIntent') or decision.get('action')}; "
                f"fee ${fee:.4f}; slippage {(float(order.get('slippage_dollars') or 0.0) * 100):.1f}c."
            ),
            "reasonZh": (
                f"意图 {decision.get('executionIntent') or decision.get('action')}；"
                f"手续费 ${fee:.4f}；滑点 {(float(order.get('slippage_dollars') or 0.0) * 100):.1f}c。"
            ),
        }
        self._notify(user_id, "order", payload)

    def _notify_settlement(self, user_id: str, settlement: Mapping[str, Any]) -> None:
        ticker = str(settlement.get("ticker") or "")
        result = str(settlement.get("result") or settlement.get("market_result") or "").upper()
        environment = _execution_mode(settlement.get("environment") or "paper")
        revenue = _finite_number(
            settlement.get("revenue") if settlement.get("revenue") is not None else settlement.get("revenue_dollars"),
            0.0,
        )
        yes_cost = _finite_number(settlement.get("yes_total_cost_dollars"), 0.0)
        no_cost = _finite_number(settlement.get("no_total_cost_dollars"), 0.0)
        cost = _finite_number(settlement.get("cost"), yes_cost + no_cost)
        fees = _finite_number(
            settlement.get("fees"),
            _finite_number(settlement.get("fee_cost_dollars"), 0.0)
            + _finite_number(settlement.get("settlement_fee_dollars"), 0.0),
        )
        raw_pnl = settlement.get("pnl")
        if raw_pnl is None:
            raw_pnl = settlement.get("pnl_dollars")
        pnl = _finite_number(raw_pnl, revenue - cost - fees)
        side = str(settlement.get("side") or "").upper()
        yes_count = _finite_number(settlement.get("yes_count_fp") or settlement.get("yes_count"), 0.0)
        no_count = _finite_number(settlement.get("no_count_fp") or settlement.get("no_count"), 0.0)
        if side not in {"YES", "NO"}:
            side = "YES" if yes_count > 0 else "NO" if no_count > 0 else ""
        contracts = _finite_number(
            settlement.get("contracts"),
            yes_count if side == "YES" else no_count if side == "NO" else yes_count + no_count,
        )
        settled_at = (
            settlement.get("settledAt")
            or settlement.get("settled_time")
            or settlement.get("created_time")
        )
        source = "Kalshi Real Settlement" if environment == "real" else "Kalshi Paper Settlement"
        payload = {
            "source": source,
            "notificationScope": "kalshi",
            "assetClass": "kalshi",
            "event_id": settlement.get("key") or settlement.get("settlement_id") or f"{environment}:{ticker}:{settled_at}:{result}",
            "mode": environment,
            "symbol": ticker,
            "result": result,
            "outcome": side,
            "contracts": contracts,
            "revenue": revenue,
            "cost": cost,
            "fees": fees,
            "pnl": pnl,
            "settledAt": settled_at,
            "description": f"{source}: {ticker} resolved {result}; net P/L ${pnl:.4f}.",
            "descriptionZh": f"Kalshi {'实盘' if environment == 'real' else '模拟盘'}结算：{ticker} 结果 {result}，净盈亏 ${pnl:.4f}。",
        }
        self._notify(user_id, "settlement", payload)

    def _record_loop_success(self, user_id: str, family: str, mode: str) -> None:
        runtime_lock = getattr(self, "_runtime_lock", None)
        if runtime_lock is None:
            self._loop_last_error = ""
        else:
            with runtime_lock:
                self._loop_last_error = ""
        key = f"{user_id}:{family}"
        previous = self._loop_error_counts.pop(key, 0)
        if key not in self._loop_alerted:
            return
        self._loop_alerted.discard(key)
        self._notify(
            user_id,
            "lifecycle",
            {
                "source": "Kalshi Robot",
                "notificationScope": "kalshi",
                "assetClass": "kalshi",
                "event_id": f"kalshi-recovered:{family}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
                "component": "BTC Hourly Robot" if family == "btchourly" else "BTC 15-Minute Robot",
                "state": "recovered",
                "mode": mode,
                "detail": f"Background cycles recovered after {previous} consecutive failures.",
                "detailZh": f"后台周期已恢复，此前连续失败 {previous} 次。",
            },
        )

    def _record_loop_failure(self, user_id: str, family: str, mode: str, exc: Exception) -> None:
        runtime_lock = getattr(self, "_runtime_lock", None)
        if runtime_lock is None:
            self._loop_last_error = type(exc).__name__
        else:
            with runtime_lock:
                self._loop_last_error = type(exc).__name__
        key = f"{user_id}:{family}"
        count = int(self._loop_error_counts.get(key, 0)) + 1
        self._loop_error_counts[key] = count
        error_type = type(exc).__name__
        is_version_conflict = error_type == "OperationsVersionConflict"
        self.safe_print(
            f"[KalshiRobot] {family} tick failed user={user_id} "
            f"error={error_type} consecutive={count}"
        )
        if not is_version_conflict:
            try:
                self.state.error(user_id, f"{error_type}: background cycle failed")
            except Exception as state_exc:
                self.safe_print(
                    f"[KalshiRobot] state error record skipped user={user_id} "
                    f"error={type(state_exc).__name__}"
                )
        if count < 3 or key in self._loop_alerted:
            return

        self._loop_alerted.add(key)
        if is_version_conflict:
            reason = "State changed on another backend instance; AlphaLab reloaded it and will retry."
            reason_zh = "状态已被另一后端实例更新；AlphaLab 已重新读取，并将在下一周期重试。"
            severity = "medium"
        else:
            reason = f"{family} background cycle failed {count} consecutive times ({error_type})."
            reason_zh = f"{'BTC 小时' if family == 'btchourly' else 'BTC 15 分钟'}后台周期已连续失败 {count} 次（{error_type}）。"
            severity = "high"
        self._notify(
            user_id,
            "risk_alert",
            {
                "source": "Kalshi Robot",
                "notificationScope": "kalshi",
                "assetClass": "kalshi",
                "event_id": f"kalshi-loop:{family}:{error_type}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
                "fingerprint": f"kalshi:{family}:{error_type}",
                "symbol": BTC_HOURLY_SERIES if family == "btchourly" else BTC_15M_SERIES,
                "step": "Kalshi Hourly Robot" if family == "btchourly" else "Kalshi BTC15 Robot",
                "status": "attention",
                "severity": severity,
                "reason": reason,
                "reasonZh": reason_zh,
                "action": "The robot remains fail-closed and will keep retrying. Review backend health if it does not recover.",
                "actionZh": "机器人保持安全关闭并继续重试；若未自动恢复，请检查后端健康状态。",
                "mode": mode,
            },
        )

    def _loop(self):
        while not self._stop_event.wait(5.0):
            with self._runtime_lock:
                self._loop_last_heartbeat_monotonic = time.monotonic()
                self._loop_last_heartbeat_at = datetime.now(timezone.utc).isoformat()
            if callable(self.scheduler_lease_acquirer):
                try:
                    owns_lease = bool(self.scheduler_lease_acquirer())
                    with self._runtime_lock:
                        self._scheduler_lease_owned = owns_lease
                        self._scheduler_lease_checked_at = (
                            datetime.now(timezone.utc).isoformat()
                        )
                    if not owns_lease:
                        continue
                except Exception as exc:
                    with self._runtime_lock:
                        self._scheduler_lease_owned = False
                        self._scheduler_lease_checked_at = (
                            datetime.now(timezone.utc).isoformat()
                        )
                        self._loop_last_error = type(exc).__name__
                    self.safe_print(
                        f"[KalshiRobot] scheduler lease unavailable "
                        f"error={type(exc).__name__}"
                    )
                    continue
            try:
                enabled_users = self.state.enabled_users()
                with self._runtime_lock:
                    if not self._loop_error_counts:
                        self._loop_last_error = ""
            except Exception as exc:
                with self._runtime_lock:
                    self._loop_last_error = type(exc).__name__
                self.safe_print(
                    f"[KalshiRobot] enabled-user discovery failed error={type(exc).__name__}"
                )
                continue
            for user_id in enabled_users:
                mode = "paper"
                try:
                    state = self.state.get(user_id)
                    mode = _execution_mode((state.get("config") or {}).get("executionMode"))
                    self.tick(user_id, submit_order=True, mode=mode, family="btc15m")
                    self._record_loop_success(user_id, "btc15m", mode)
                    now_monotonic = time.monotonic()
                    if now_monotonic - self._last_hourly_tick.get(str(user_id), 0.0) >= 5.0:
                        try:
                            self.tick(user_id, submit_order=True, mode=mode, family="btchourly")
                            self._record_loop_success(user_id, "btchourly", mode)
                        except Exception as exc:
                            self._record_loop_failure(user_id, "btchourly", mode, exc)
                        finally:
                            self._last_hourly_tick[str(user_id)] = now_monotonic
                except Exception as exc:
                    self._record_loop_failure(user_id, "btc15m", mode, exc)

    def runtime_snapshot(self) -> Dict[str, Any]:
        with self._runtime_lock:
            heartbeat_mono = self._loop_last_heartbeat_monotonic
            heartbeat_at = self._loop_last_heartbeat_at
            last_error = self._loop_last_error
            lease_owned = self._scheduler_lease_owned
            lease_checked_at = self._scheduler_lease_checked_at
        thread_alive = bool(self._thread and self._thread.is_alive())
        heartbeat_age = max(0.0, time.monotonic() - heartbeat_mono)
        required = bool(self._background_requested and not self._scheduler_disabled)
        healthy = bool(
            (not required)
            or (thread_alive and heartbeat_age <= 30 and not last_error)
        )
        return {
            "required": required,
            "healthy": healthy,
            "status": (
                "disabled" if self._scheduler_disabled else
                "standby" if healthy and lease_owned is False else
                "healthy" if healthy else
                "degraded"
            ),
            "threadAlive": thread_alive,
            "startedAt": self._loop_started_at,
            "lastHeartbeatAt": heartbeat_at,
            "heartbeatAgeSeconds": round(heartbeat_age, 3),
            "lastError": last_error,
            "schedulerLeaseOwned": lease_owned,
            "schedulerLeaseCheckedAt": lease_checked_at,
            "routingFencingSupported": bool(
                callable(getattr(self.worker_lease_store, "claim_worker_lease_fenced", None))
                and callable(getattr(self.worker_lease_store, "renew_worker_lease", None))
                and callable(getattr(self.worker_lease_store, "release_worker_lease", None))
            ),
        }



def register_kalshi_api(
    app,
    *,
    require_auth,
    safe_print=print,
    http_get=None,
    get_user_config=None,
    save_user_config=None,
    mask_key=None,
    robot_state_path=None,
    paper_account_path=None,
    start_background=False,
    http_request=None,
    notifier=None,
    robot_state_loader=None,
    robot_state_saver=None,
    enabled_users_loader=None,
    paper_account_loader=None,
    paper_account_saver=None,
    portfolio_display_loader=None,
    portfolio_display_saver=None,
    observation_saver=None,
    observation_loader=None,
    scheduler_lease_acquirer=None,
    worker_lease_store=None,
):
    """Register Kalshi research and per-user connection APIs once per app."""
    existing = app.extensions.get("alphalab_kalshi_api")
    if existing:
        return existing

    client = _PublicDataClient(http_get=http_get, safe_print=safe_print)
    blueprint = Blueprint("kalshi_api", __name__)

    def authenticated_user():
        user = require_auth()
        if not isinstance(user, Mapping) or not str(user.get("id") or "").strip():
            raise KalshiApiError("Authentication required", status=401, code="authentication_required")
        return dict(user)

    def ok(payload: Mapping[str, Any], status: int = 200):
        return jsonify(dict(payload)), status

    def fail(exc: Exception):
        if isinstance(exc, KalshiApiError):
            return ok({"success": False, "code": exc.code, "message": str(exc)}, exc.status)
        safe_print(f"[KalshiAPI] unexpected error={type(exc).__name__}")
        return ok({
            "success": False,
            "code": "kalshi_internal_error",
            "message": "Kalshi research request failed safely.",
        }, 500)

    def configuration_available():
        return callable(get_user_config) and callable(save_user_config)

    connection_cache: Dict[str, Dict[str, Any]] = {}
    connection_cache_lock = threading.RLock()

    def remember_connection(user_id: str, config: Mapping[str, Any]):
        with connection_cache_lock:
            connection_cache[user_id] = dict(config or {})

    def load_connection(user_id: str) -> Dict[str, Any]:
        if not configuration_available():
            return {}
        config = dict(get_user_config(user_id, "kalshi") or {})
        if config:
            remember_connection(user_id, config)
            return config
        with connection_cache_lock:
            cached = connection_cache.get(user_id)
        if cached:
            safe_print(f"[Kalshi] using cached connection config for user={user_id[:8]}...")
            return dict(cached)
        return {}

    def request_mode(default: str = "paper") -> str:
        body = request.get_json(silent=True) if request.method in {"POST", "PUT", "PATCH", "DELETE"} else None
        if isinstance(body, Mapping):
            config = body.get("config")
            if body.get("mode") is not None:
                return _execution_mode(body.get("mode"))
            if isinstance(config, Mapping) and config.get("executionMode") is not None:
                return _execution_mode(config.get("executionMode"))
        return _execution_mode(request.args.get("mode") or default)

    def ensure_real_ready(user_id: str, mode: str) -> None:
        if _execution_mode(mode) != "real":
            return
        config = load_connection(user_id)
        if not environment_summary(config, "production")["configured"]:
            raise KalshiApiError(
                "Kalshi Real mode needs a production API key and private key in Settings before the robot can trade.",
                status=409,
                code="kalshi_real_credentials_missing",
            )

    def environment_summary(config: Mapping[str, Any], environment: str):
        key_field, private_field = _credential_fields(environment)
        key_id = str(config.get(key_field) or "")
        private_key = str(config.get(private_field) or "")
        masker = mask_key if callable(mask_key) else (lambda value: "********" if value else "")
        return {
            "configured": bool(key_id and private_key),
            "apiKeyIdMasked": masker(key_id),
            "privateKeySaved": bool(private_key),
            "baseUrl": KALSHI_ENVIRONMENTS[environment],
            "testStatus": config.get(f"{environment}_test_status", "not_tested"),
            "lastTestedAt": config.get(f"{environment}_last_tested_at"),
        }

    def signed_account_check(config: Mapping[str, Any], environment: str):
        key_field, private_field = _credential_fields(environment)
        key_id = str(config.get(key_field) or "").strip()
        private_key = str(config.get(private_field) or "").strip()
        if not key_id or not private_key:
            raise KalshiApiError(
                f"Kalshi {environment} credentials are not configured",
                status=400,
                code="credentials_not_configured",
            )
        path = "/trade-api/v2/portfolio/balance"
        try:
            response = (http_get or requests.get)(
                KALSHI_ENVIRONMENTS[environment] + "/portfolio/balance",
                headers=_signed_headers(key_id, private_key, "GET", path),
                timeout=10.0,
            )
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()
            payload = response.json() if hasattr(response, "json") else response
        except KalshiApiError:
            raise
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (401, 403):
                raise KalshiApiError(
                    "Kalshi rejected the API Key ID or signature",
                    status=400,
                    code="kalshi_auth_rejected",
                ) from exc
            raise KalshiApiError(
                "Kalshi connection test could not reach the account endpoint",
                status=502,
                code="kalshi_connection_failed",
            ) from exc
        return payload if isinstance(payload, Mapping) else {}

    def signed_api_request(
        config: Mapping[str, Any],
        environment: str,
        method: str,
        endpoint: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        json_body: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        environment = _environment_name(environment)
        key_field, private_field = _credential_fields(environment)
        key_id = str(config.get(key_field) or "").strip()
        private_key = str(config.get(private_field) or "").strip()
        if not key_id or not private_key:
            raise KalshiApiError(
                f"Kalshi {environment} credentials are not configured",
                status=409,
                code="credentials_not_configured",
            )
        endpoint = "/" + str(endpoint or "").lstrip("/")
        sign_path = "/trade-api/v2" + endpoint
        headers = _signed_headers(key_id, private_key, method, sign_path)
        if json_body is not None:
            headers["Content-Type"] = "application/json"
        transport = http_request or requests.request
        try:
            response = transport(
                str(method).upper(),
                KALSHI_ENVIRONMENTS[environment] + endpoint,
                params=dict(params or {}),
                json=dict(json_body) if json_body is not None else None,
                headers=headers,
                timeout=12.0,
            )
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()
            payload = response.json() if hasattr(response, "json") else response
            return dict(payload or {}) if isinstance(payload, Mapping) else {}
        except Exception as exc:
            status_code = getattr(response, "status_code", None) if "response" in locals() else None
            if status_code in (401, 403):
                raise KalshiApiError(f"Kalshi {environment} rejected the API credentials", status=401, code="kalshi_auth_rejected") from exc
            if status_code == 429:
                raise KalshiApiError(f"Kalshi {environment} rate limit reached; the robot will retry", status=429, code="kalshi_rate_limited") from exc
            detail = ""
            try:
                detail = str(response.json().get("message") or response.json().get("details") or "")
            except Exception:
                pass
            raise KalshiApiError(detail or f"Kalshi {environment} account request failed", status=502, code="kalshi_account_request_failed") from exc

    scheduler_disabled = str(
        os.environ.get("ALPHALAB_DISABLE_KALSHI_SCHEDULER") or ""
    ).strip().lower() in {"1", "true", "yes", "on"}
    reference_stream = KalshiReferenceStream(
        connection_loader=load_connection,
        header_factory=_signed_headers,
        safe_print=safe_print,
        enabled=start_background,
    )
    robot_state = KalshiRobotState(
        robot_state_path,
        state_loader=robot_state_loader,
        state_saver=robot_state_saver,
        enabled_users_loader=enabled_users_loader,
        persist_migrations=not scheduler_disabled,
    )
    paper_accounts = KalshiPaperAccountStore(
        paper_account_path,
        account_loader=paper_account_loader,
        account_saver=paper_account_saver,
    )
    paper_robot = _PaperRobotController(
        client,
        robot_state,
        paper_accounts,
        connection_loader=load_connection,
        signed_request=signed_api_request,
        notifier=notifier,
        observation_saver=observation_saver,
        portfolio_display_loader=portfolio_display_loader,
        portfolio_display_saver=portfolio_display_saver,
        scheduler_lease_acquirer=scheduler_lease_acquirer,
        worker_lease_store=worker_lease_store,
        reference_stream=reference_stream,
        safe_print=safe_print,
        start_background=start_background,
    )

    @blueprint.route("/api/kalshi/config", methods=["GET", "POST", "DELETE"])
    def kalshi_config():
        try:
            user = authenticated_user()
            if not configuration_available():
                raise KalshiApiError("Credential storage is unavailable", status=503, code="credential_store_unavailable")
            config = load_connection(user["id"])
            if request.method == "GET":
                return ok({
                    "success": True,
                    "activeEnvironment": "paper",
                    "paper": {
                        "builtIn": True,
                        "configured": True,
                        "startingBalance": round(paper_accounts.starting_balance_cents / 100.0, 2),
                        "startingBalanceCents": paper_accounts.starting_balance_cents,
                        "marketDataBaseUrl": KALSHI_PUBLIC_BASE,
                    },
                    "environments": {
                        name: environment_summary(config, name) for name in KALSHI_ENVIRONMENTS
                    },
                })

            body = request.get_json(silent=True) or {}
            if not isinstance(body, Mapping):
                raise KalshiApiError("JSON body must be an object", status=400, code="invalid_request")
            environment = _environment_name(body.get("environment"))
            key_field, private_field = _credential_fields(environment)

            if request.method == "DELETE" or body.get("clear") is True:
                config.pop(key_field, None)
                config.pop(private_field, None)
                config.pop(f"{environment}_test_status", None)
                config.pop(f"{environment}_last_tested_at", None)
            else:
                incoming_key_id = str(body.get("apiKeyId") or "").strip()
                incoming_private = str(body.get("privateKey") or "").strip()
                if incoming_key_id and "****" not in incoming_key_id:
                    if not re.fullmatch(r"[A-Za-z0-9._-]{8,200}", incoming_key_id):
                        raise KalshiApiError("A valid Kalshi API Key ID is required", status=400, code="invalid_api_key_id")
                    config[key_field] = incoming_key_id
                if incoming_private and "****" not in incoming_private:
                    _load_rsa_private_key(incoming_private)
                    config[private_field] = _normalize_private_key(incoming_private)
                if not config.get(key_field) or not config.get(private_field):
                    raise KalshiApiError(
                        "Both the API Key ID and RSA private key are required",
                        status=400,
                        code="incomplete_credentials",
                    )
                config[f"{environment}_test_status"] = "saved"
            config["active_environment"] = environment
            config["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            saved, error = save_user_config(user["id"], "kalshi", config)
            if not saved:
                message = "Kalshi configuration could not be saved"
                if error == "config_type_check":
                    message = "Database migration for Kalshi configuration is required"
                raise KalshiApiError(message, status=500, code=error or "config_save_failed")
            remember_connection(user["id"], config)
            return ok({
                "success": True,
                "environment": environment,
                "configured": bool(config.get(key_field) and config.get(private_field)),
                "message": "Kalshi credentials removed" if request.method == "DELETE" or body.get("clear") is True else "Kalshi credentials saved",
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/config/test")
    def kalshi_config_test():
        try:
            user = authenticated_user()
            body = request.get_json(silent=True) or {}
            if not isinstance(body, Mapping):
                raise KalshiApiError("JSON body must be an object", status=400, code="invalid_request")
            environment = _environment_name(body.get("environment"))
            config = load_connection(user["id"])
            started_at = time.perf_counter()
            account = signed_account_check(config, environment)
            # A balance-only check can pass even when the portfolio transport
            # used by the robot is broken. Verify the two additional signed
            # reads needed immediately before order routing. This remains a
            # strictly read-only preflight: no order is created or cancelled.
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix="kalshi-preflight") as pool:
                positions_future = pool.submit(
                    signed_api_request,
                    config,
                    environment,
                    "GET",
                    "/portfolio/positions",
                    params={"limit": 1},
                )
                orders_future = pool.submit(
                    signed_api_request,
                    config,
                    environment,
                    "GET",
                    "/portfolio/orders",
                    params={"limit": 1},
                )
                positions_payload = positions_future.result()
                orders_payload = orders_future.result()
            latency_ms = int(round((time.perf_counter() - started_at) * 1000))
            config[f"{environment}_test_status"] = "connected"
            config[f"{environment}_last_tested_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            saved, error = save_user_config(user["id"], "kalshi", config)
            if not saved:
                raise KalshiApiError("Connection succeeded but its status could not be saved", status=500, code=error or "config_save_failed")
            remember_connection(user["id"], config)
            return ok({
                "success": True,
                "environment": environment,
                "message": "Kalshi account connection verified",
                "account": {
                    "balance": account.get("balance"),
                    "portfolioValue": account.get("portfolio_value"),
                },
                "preflight": {
                    "authenticatedReads": ["balance", "positions", "orders"],
                    "positionsVisible": len(positions_payload.get("market_positions") or positions_payload.get("positions") or []),
                    "ordersVisible": len(orders_payload.get("orders") or []),
                    "orderTransportPath": "/trade-api/v2/portfolio/events/orders",
                    "orderSigningReady": True,
                    "writeRequestSent": False,
                    "latencyMs": latency_ms,
                },
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/btc-15m/snapshot")
    def btc15_snapshot():
        try:
            user = authenticated_user()
            snapshot = client.snapshot(
                base_url=KALSHI_PUBLIC_BASE,
                reference_override=reference_stream.snapshot(user["id"]),
            )
            decision = evaluate_btc15_contract(
                snapshot["market"],
                spot_price=snapshot["reference"].get("price"),
                candles=snapshot["reference"].get("candles") or [],
                orderbook=snapshot.get("orderbook") or {},
                reference_time=snapshot["reference"].get("timestamp"),
                reference_metadata=snapshot.get("reference") or {},
                book_time=snapshot.get("orderbookAsOf"),
            )
            snapshot["reference"].pop("candles", None)
            return ok({"success": True, "snapshot": snapshot, "decision": decision})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/btc-15m/evaluate")
    def btc15_evaluate():
        try:
            user = authenticated_user()
            body = request.get_json(silent=True)
            if body is not None and not isinstance(body, Mapping):
                raise KalshiApiError("JSON body must be an object", status=400, code="invalid_request")
            config = normalize_strategy_config((body or {}).get("config") or {})
            snapshot = client.snapshot(
                base_url=KALSHI_PUBLIC_BASE,
                reference_override=reference_stream.snapshot(user["id"]),
            )
            decision = evaluate_btc15_contract(
                snapshot["market"],
                spot_price=snapshot["reference"].get("price"),
                candles=snapshot["reference"].get("candles") or [],
                config=config,
                orderbook=snapshot.get("orderbook") or {},
                reference_time=snapshot["reference"].get("timestamp"),
                reference_metadata=snapshot.get("reference") or {},
                book_time=snapshot.get("orderbookAsOf"),
            )
            snapshot["reference"].pop("candles", None)
            mode = _execution_mode(config.get("executionMode") or (body or {}).get("mode") or "paper")
            return ok({"success": True, "snapshot": snapshot, "decision": decision, "robotState": robot_state.get(user["id"], environment=mode)})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/btc-hourly/snapshot")
    def btc_hourly_snapshot():
        try:
            user = authenticated_user()
            snapshot = client.hourly_snapshot(
                base_url=KALSHI_PUBLIC_BASE,
                reference_override=reference_stream.snapshot(user["id"]),
            )
            snapshot["reference"].pop("candles", None)
            return ok({"success": True, "snapshot": snapshot})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/btc-hourly/evaluate")
    def btc_hourly_evaluate():
        try:
            user = authenticated_user()
            state = robot_state.get(user["id"])
            mode = request_mode((state.get("config") or {}).get("executionMode") or "paper")
            result = paper_robot.tick(
                user["id"],
                submit_order=False,
                mode=mode,
                family="btchourly",
            )
            return ok({"success": True, **result, "robotState": result.get("state")})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/paper/portfolio")
    def kalshi_paper_portfolio():
        try:
            user = authenticated_user()
            mode = request_mode()
            return ok({
                "success": True,
                "portfolio": paper_robot.portfolio(
                    user["id"], mode=mode, include_display=True, mutate=False
                ),
                "state": robot_state.get(user["id"], environment=mode),
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.delete("/api/kalshi/paper/portfolio")
    def kalshi_paper_portfolio_reset():
        try:
            user = authenticated_user()
            mode = request_mode()
            if mode == "real":
                raise KalshiApiError("Real Kalshi accounts cannot be reset from AlphaLab.", status=400, code="kalshi_real_reset_not_allowed")
            body = request.get_json(silent=True) or {}
            starting_balance = body.get("startingBalance", 10_000)
            try:
                starting_balance = float(starting_balance)
            except (TypeError, ValueError):
                raise KalshiApiError(
                    "Starting balance must be a number.",
                    status=400,
                    code="kalshi_invalid_starting_balance",
                )
            if not 100 <= starting_balance <= 1_000_000:
                raise KalshiApiError(
                    "Starting balance must be between $100 and $1,000,000.",
                    status=400,
                    code="kalshi_invalid_starting_balance",
                )
            portfolio = paper_accounts.reset(
                user["id"],
                starting_balance_dollars=starting_balance,
            )
            state = robot_state.start_fresh_strategy(
                user["id"],
                environment="paper",
                starting_bankroll=starting_balance,
                name=str(body.get("strategyName") or ""),
            )
            return ok({"success": True, "portfolio": portfolio, "state": robot_state.get(user["id"], environment=mode)})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/paper/robot")
    def kalshi_paper_robot_status():
        try:
            user = authenticated_user()
            raw_mode = request.args.get("mode")
            state = robot_state.get(user["id"], environment=raw_mode) if raw_mode else robot_state.get(user["id"])
            return ok({"success": True, "state": state})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/paper/robot")
    def kalshi_paper_robot_configure():
        try:
            user = authenticated_user()
            body = request.get_json(silent=True) or {}
            if not isinstance(body, Mapping) or not isinstance(body.get("enabled"), bool):
                raise KalshiApiError("enabled must be true or false", status=400, code="invalid_request")
            config = normalize_strategy_config(body.get("config") or {})
            mode = _execution_mode(config.get("executionMode") or body.get("mode"))
            config["executionMode"] = mode
            if body["enabled"]:
                ensure_real_ready(user["id"], mode)
            previous = robot_state.get(user["id"], environment=mode)
            state = robot_state.configure(user["id"], body["enabled"], config)
            payload = {"success": True, "state": state}
            if bool(previous.get("enabled")) != bool(body["enabled"]):
                paper_robot._notify(
                    user["id"],
                    "lifecycle",
                    {
                        "source": "Kalshi Robot",
                        "notificationScope": "kalshi",
                        "assetClass": "kalshi",
                        "event_id": f"kalshi-robot:{mode}:{'start' if body['enabled'] else 'stop'}:{time.time_ns()}",
                        "component": "Kalshi BTC Robot",
                        "state": "started" if body["enabled"] else "stopped",
                        "mode": mode,
                        "trigger": "user",
                        "description": (
                            f"Kalshi {mode} automation is armed."
                            if body["enabled"]
                            else f"Kalshi {mode} automation is stopped."
                        ),
                        "descriptionZh": (
                            f"Kalshi {'实盘' if mode == 'real' else '模拟盘'}自动化已启动。"
                            if body["enabled"]
                            else f"Kalshi {'实盘' if mode == 'real' else '模拟盘'}自动化已停止。"
                        ),
                    },
                )
            if body["enabled"]:
                payload.update(paper_robot.tick(user["id"], submit_order=True, mode=mode))
            return ok(payload)
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/paper/robot/config")
    def kalshi_paper_robot_save_config():
        """Persist risk limits without starting, stopping, or trading the robot."""
        try:
            user = authenticated_user()
            body = request.get_json(silent=True) or {}
            config = normalize_strategy_config(body.get("config") or {})
            mode = _execution_mode(config.get("executionMode") or body.get("mode"))
            config["executionMode"] = mode
            ensure_real_ready(user["id"], mode)
            current = robot_state.get(user["id"], environment=mode)
            state = robot_state.configure(user["id"], bool(current.get("enabled")), config)
            return ok({"success": True, "state": state})
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/paper/robot/tick")
    def kalshi_paper_robot_tick():
        try:
            user = authenticated_user()
            raw_mode = request.args.get("mode") or request.args.get("environment")
            state = robot_state.get(user["id"], environment=raw_mode) if raw_mode else robot_state.get(user["id"])
            mode = request_mode((state.get("config") or {}).get("executionMode") or "paper")
            ensure_real_ready(user["id"], mode)
            body = request.get_json(silent=True) or {}
            family = str(request.args.get("family") or body.get("family") or "btc15m").lower()
            if family not in {"btc15m", "btchourly"}:
                raise KalshiApiError("family must be btc15m or btchourly", status=400, code="invalid_request")
            return ok({
                "success": True,
                **paper_robot.tick(
                    user["id"],
                    submit_order=bool(state.get("enabled")),
                    mode=mode,
                    family=family,
                ),
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/status")
    def kalshi_status():
        try:
            user = authenticated_user()
            config = load_connection(user["id"])
            active_summary = environment_summary(config, "production")
            state = robot_state.get(user["id"])
            active_mode = _execution_mode((state.get("config") or {}).get("executionMode") or "paper")
            return ok({
                "success": True,
                "publicData": "available",
                "seriesTicker": BTC_15M_SERIES,
                "strategyFamilies": ["btc15m", "btchourly"],
                "execution": "real_available" if active_summary["configured"] else "paper_only",
                "activeEnvironment": active_mode,
                "accountProvider": "Kalshi" if active_mode == "real" else "AlphaLab",
                "builtInPaperConfigured": True,
                "personalApiConfigured": active_summary["configured"],
                "liveTradingConfigured": active_summary["configured"],
                "connectionStatus": active_summary["testStatus"],
                "referenceFeed": reference_stream.status(user["id"]),
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/portfolio/display-reset")
    def kalshi_portfolio_display_reset():
        try:
            user = authenticated_user()
            mode = request_mode()
            portfolio = paper_robot.reset_portfolio_display(user["id"], mode=mode)
            return ok({
                "success": True,
                "portfolio": portfolio,
                "state": robot_state.get(user["id"], environment=mode),
                "message": "Portfolio display period reset; the complete account ledger was preserved.",
            })
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/analytics")
    def kalshi_analytics():
        try:
            user = authenticated_user()
            if not callable(observation_loader):
                raise KalshiApiError(
                    "Kalshi analytics storage is unavailable",
                    status=503,
                    code="kalshi_analytics_unavailable",
                )
            mode = request_mode("paper")
            try:
                hours = max(1, min(int(request.args.get("hours") or 24), 168))
            except (TypeError, ValueError):
                hours = 24
            since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            rows = observation_loader(
                user["id"],
                environment=mode,
                since=since,
                limit=5000,
            )
            return ok({
                "success": True,
                "environment": mode,
                "windowHours": hours,
                "analytics": _observation_analytics(rows),
                "referenceFeed": reference_stream.status(user["id"]),
            })
        except Exception as exc:
            return fail(exc)


    app.register_blueprint(blueprint)
    controls = {
        "client": client,
        "robot_state": robot_state,
        "paper_accounts": paper_accounts,
        "paper_robot": paper_robot,
        "runtime": paper_robot.runtime_snapshot,
        "reference_stream": reference_stream,
    }
    app.extensions["alphalab_kalshi_api"] = controls
    return controls


__all__ = [
    "COINBASE_EXCHANGE_BASE",
    "KALSHI_ENVIRONMENTS",
    "KALSHI_PUBLIC_BASE",
    "KalshiApiError",
    "_paper_order_payload",
    "_signed_headers",
    "register_kalshi_api",
]
