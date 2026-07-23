"""Kalshi market data and per-user API connection routes."""

from __future__ import annotations

import base64
import copy
import math
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping, Optional, Tuple

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


KALSHI_PUBLIC_BASE = "https://external-api.kalshi.com/trade-api/v2"
COINBASE_EXCHANGE_BASE = "https://api.exchange.coinbase.com"
KALSHI_ENVIRONMENTS = {
    "production": KALSHI_PUBLIC_BASE,
}


def _is_btc15_ticker(value: Any) -> bool:
    """AlphaLab Kalshi workspace is intentionally scoped to BTC 15-minute contracts."""
    return str(value or "").upper().startswith(str(BTC_15M_SERIES).upper())


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
    daily_order_ids = {
        str(row.get("order_id") or row.get("fill_id") or "")
        for row in fills
        if (_parse_utc(row.get("created_time")) or datetime.min.replace(tzinfo=timezone.utc)).date() == now.date()
    }
    strategy = dict(state.get("strategy") or {})
    cooldown_until = _parse_utc(strategy.get("cooldownUntil"))
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
        "hasPosition": bool(matching_positions),
        "hasOpenOrder": bool(matching_orders),
        "alreadyTraded": ticker in set(state.get("tradedTickers") or []),
        "dailyTrades": len(daily_order_ids - {""}),
        "dailyPnl": daily_pnl,
        "cooldownActive": bool(cooldown_until and cooldown_until > now),
        "cooldownDetail": (
            f"until {cooldown_until.isoformat().replace('+00:00', 'Z')}"
            if cooldown_until and cooldown_until > now
            else f"{int(strategy.get('consecutiveLosses') or 0)} consecutive losses"
        ),
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
        and _is_btc15_ticker(row.get("ticker") or row.get("market_ticker"))
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
                return cached[1]

        try:
            response = self.http_get(url, params=dict(params or {}), headers=self._headers, timeout=timeout)
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()
            payload = response.json() if hasattr(response, "json") else response
        except Exception as exc:
            with self._cache_lock:
                stale = self._cache.get(key)
            if stale:
                self.safe_print(f"[Kalshi] public request failed key={key} error={type(exc).__name__}; serving stale cache")
                return stale[1]
            self.safe_print(f"[Kalshi] public request failed key={key} error={type(exc).__name__}")
            raise KalshiApiError(f"Public data request failed for {key}") from exc
        with self._cache_lock:
            self._cache[key] = (now, payload)
        return payload

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

    def snapshot(self, *, now: Optional[datetime] = None, base_url: str = KALSHI_PUBLIC_BASE) -> Dict[str, Any]:
        now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        warnings = []
        market, selection = self._market_candidates(now, base_url)
        if not market:
            raise KalshiApiError("No KXBTC15M contract was returned by Kalshi")

        orderbook = {"yes": [], "no": []}
        orderbook_as_of = None
        ticker = str(market.get("ticker") or "")
        if ticker and selection == "active":
            try:
                book_payload = self._cached_json(
                    f"kalshi-orderbook:{base_url}:{ticker}",
                    f"{base_url}/markets/{ticker}/orderbook",
                    params={"depth": 10},
                    ttl=0.75,
                )
                fixed = (book_payload or {}).get("orderbook_fp") or {}
                orderbook = {
                    "yes": fixed.get("yes_dollars") or [],
                    "no": fixed.get("no_dollars") or [],
                }
                orderbook_as_of = now.isoformat().replace("+00:00", "Z")
            except KalshiApiError:
                warnings.append("kalshi_orderbook_unavailable")

        ticker_payload: Mapping[str, Any] = {}
        candles = []
        try:
            ticker_payload = self._cached_json(
                "coinbase-btc-ticker",
                f"{COINBASE_EXCHANGE_BASE}/products/BTC-USD/ticker",
                ttl=1.0,
            ) or {}
        except KalshiApiError:
            warnings.append("btc_reference_unavailable")
        try:
            candles = self._cached_json(
                "coinbase-btc-candles-1m",
                f"{COINBASE_EXCHANGE_BASE}/products/BTC-USD/candles",
                params={"granularity": 60},
                ttl=30.0,
            ) or []
        except KalshiApiError:
            warnings.append("btc_history_unavailable")

        fetched_at = now.isoformat().replace("+00:00", "Z")
        return {
            "asOf": fetched_at,
            "selection": selection,
            "seriesTicker": BTC_15M_SERIES,
            "market": market,
            "orderbook": orderbook,
            "orderbookAsOf": orderbook_as_of,
            "reference": {
                "symbol": "BTC-USD",
                "price": ticker_payload.get("price"),
                "bid": ticker_payload.get("bid"),
                "ask": ticker_payload.get("ask"),
                "timestamp": ticker_payload.get("time"),
                "candles": candles,
                "candleCount": len(candles),
            },
            "warnings": warnings,
            "sources": {
                "contract": f"Kalshi {BTC_15M_SERIES}",
                "orderbook": "Kalshi public market orderbook",
                "settlement": "CF Benchmarks BRTI",
                "spotReference": "Coinbase Exchange BTC-USD",
            },
        }


class _PaperRobotController:
    def __init__(
        self,
        client,
        state,
        paper_accounts,
        *,
        ai_candidate_reviewer=None,
        ai_learning_reviewer=None,
        ai_status_resolver=None,
        connection_loader: Optional[Callable[[str], Mapping[str, Any]]] = None,
        signed_request: Optional[Callable[..., Dict[str, Any]]] = None,
        notifier: Optional[Callable[[str, str, Mapping[str, Any]], Any]] = None,
        safe_print=print,
        start_background=False,
    ):
        self.client = client
        self.state = state
        self.paper_accounts = paper_accounts
        self.ai_candidate_reviewer = ai_candidate_reviewer
        self.ai_learning_reviewer = ai_learning_reviewer
        self.ai_status_resolver = ai_status_resolver
        self.connection_loader = connection_loader
        self.signed_request = signed_request
        self.notifier = notifier
        self.safe_print = safe_print
        self._stop_event = threading.Event()
        self._ai_review_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._ai_review_lock = threading.RLock()
        self._tick_locks: Dict[str, threading.RLock] = {}
        self._tick_locks_guard = threading.RLock()
        if start_background:
            threading.Thread(target=self._loop, name="kalshi-robot", daemon=True).start()

    def _candidate_ai_review(
        self,
        user_id: str,
        decision: Mapping[str, Any],
        account_context: Mapping[str, Any],
    ) -> Dict[str, Any]:
        """Run a cached, downgrade-only review for a cleared new-entry candidate."""
        config = dict(decision.get("config") or {})
        if not config.get("preTradeAiReview"):
            return {"status": "disabled", "verdict": "not_reviewed"}
        if not callable(self.ai_candidate_reviewer):
            return {"status": "unavailable", "verdict": "not_reviewed", "summary": "AI reviewer is unavailable."}

        market = dict(decision.get("market") or {})
        model = dict(decision.get("model") or {})
        edge = dict(decision.get("edge") or {})
        ticker = str(market.get("ticker") or "")
        evidence = {
            "ticker": ticker,
            "generatedAt": decision.get("generatedAt"),
            "deterministicAction": decision.get("action"),
            "selectedSide": decision.get("side"),
            "signalQuality": decision.get("signalQuality"),
            "market": {key: market.get(key) for key in (
                "status", "secondsToClose", "strike", "yesBid", "yesAsk", "noBid", "noAsk",
                "spread", "yesAskDepth", "noAskDepth", "bookImbalance", "micropriceYes",
                "bookAgeSeconds", "volume", "openInterest",
            )},
            "model": {key: model.get(key) for key in (
                "spot", "distanceBps", "momentum3m", "momentum5m", "momentum15m",
                "projected15mVolatility", "horizonVolatility", "volatilityRatio", "jumpSigma",
                "marketYesProbability", "modelYesProbability", "fairYesProbability",
                "uncertainty", "referenceAgeSeconds", "sampleSize",
            )},
            "edge": {key: edge.get(key) for key in (
                "side", "price", "fairProbability", "grossEdge", "feePerContract",
                "netEdge", "conservativeProbability", "conservativeEdge",
                "minimumNetEdge", "minimumConservativeEdge",
            )},
            "account": {key: account_context.get(key) for key in (
                "bankroll", "cashAvailable", "portfolioExposure", "dailyTrades", "dailyPnl",
                "cooldownActive", "hasPosition", "hasOpenOrder", "alreadyTraded",
            )},
            "passedGates": [str(gate.get("key")) for gate in decision.get("gates") or [] if gate.get("status") == "pass"],
            "rule": "AI may challenge this new entry but cannot change side, price, size, or any hard gate.",
        }
        # The robot evaluates every five seconds. Keep the key stable across
        # small quote changes so one contract/side can trigger at most one AI
        # request per review window.
        cache_key = "%s:%s:%s" % (user_id, ticker, decision.get("side"))
        now = time.time()
        with self._ai_review_lock:
            cached = self._ai_review_cache.get(cache_key)
            if cached and now - cached[0] < 45.0:
                return {**copy.deepcopy(cached[1]), "cached": True}
        try:
            result = dict(self.ai_candidate_reviewer(user_id, evidence) or {})
        except Exception as exc:
            result = {
                "status": "unavailable",
                "verdict": "not_reviewed",
                "summary": f"AI review failed safely: {type(exc).__name__}.",
            }
        result.setdefault("status", "unavailable")
        result.setdefault("verdict", "not_reviewed")
        result["ticker"] = ticker
        result["reviewedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        result["cached"] = False
        with self._ai_review_lock:
            self._ai_review_cache[cache_key] = (now, copy.deepcopy(result))
            if len(self._ai_review_cache) > 256:
                oldest = sorted(self._ai_review_cache.items(), key=lambda item: item[1][0])[:64]
                for key, _ in oldest:
                    self._ai_review_cache.pop(key, None)
        return result

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

    def _live_portfolio(self, user_id: str) -> Dict[str, Any]:
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
                self._optional_signed, config, "/portfolio/settlements", params={"limit": 100}
            )
            balance_payload = balance_future.result()
            positions_payload = positions_future.result()
            orders_payload = orders_future.result()
            fills_payload = fills_future.result()
            settlements_payload = settlements_future.result()

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
            if not _is_btc15_ticker(ticker):
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
        orders = []
        orders_by_id = {}
        order_fill_fallback = []
        for row in raw_orders:
            if not isinstance(row, Mapping):
                continue
            normalized = _normalise_live_order(row, row, {"side": row.get("outcome_side") or ""})
            if not _is_btc15_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
                continue
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
        fills = []
        seen_fill_ids = set()
        for row in raw_fills:
            if not isinstance(row, Mapping):
                continue
            order_context = orders_by_id.get(str(row.get("order_id") or ""))
            normalized = _normalise_live_fill(row, order_context)
            if not _is_btc15_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
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
            if _is_btc15_ticker(normalized.get("ticker") or normalized.get("market_ticker")):
                settlements.append(normalized)

        state = self.state.reconcile_settlements(user_id, settlements, fills, environment="real")
        analytics = {
            key: (state.get("strategy") or {}).get(key)
            for key in (
                "settledSamples", "wins", "losses", "winRate", "totalPnl",
                "averagePnl", "bestTrade", "worstTrade", "settlementRecords",
                "closedTradeRecords", "realizedTradeRecords", "realizedSamples",
                "realizedWins", "realizedLosses", "realizedWinRate",
                "realizedTotalPnl", "realizedAveragePnl", "equityCurve",
                "learning",
            )
        }

        return {
            "environment": "real",
            "accountProvider": "Kalshi",
            "asOf": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "balance": {
                "balance": _cents_amount(balance_payload.get("balance")),
                "portfolio_value": _cents_amount(balance_payload.get("portfolio_value") or balance_payload.get("portfolioValue")),
            },
            "positions": positions,
            "orders": orders,
            "fills": fills,
            "settlements": settlements,
            "analytics": analytics,
        }

    def portfolio(self, user_id: str, *, mode: str = "paper") -> Dict[str, Any]:
        environment = _execution_mode(mode)
        if environment == "real":
            return self._live_portfolio(user_id)
        open_tickers = set(self.paper_accounts.open_tickers(user_id))
        learning_tickers = set(self.state.pending_learning_tickers(user_id, environment=environment))
        for ticker in open_tickers | learning_tickers:
            try:
                market = self.client.market(ticker)
            except Exception as exc:
                self.safe_print(f"[KalshiPaper] market refresh failed ticker={ticker} error={type(exc).__name__}")
                continue
            result_value = str(market.get("result") or market.get("market_result") or "").upper()
            if result_value in {"YES", "NO"}:
                settled_time = str(market.get("settlement_ts") or market.get("determined_time") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
                self.state.reconcile_learning_outcome(user_id, ticker, result_value, settled_at=settled_time, environment=environment)
                if ticker in open_tickers:
                    settlement = self.paper_accounts.settle(user_id, ticker, result_value, settled_time=settled_time)
                    if settlement:
                        self._notify_settlement(user_id, settlement)
            elif ticker in open_tickers:
                self.paper_accounts.update_mark(user_id, ticker, market)
        result = self.paper_accounts.portfolio(user_id)
        for collection in ("positions", "orders", "fills", "settlements"):
            result[collection] = [
                row for row in result.get(collection) or []
                if _is_btc15_ticker((row or {}).get("ticker") or (row or {}).get("market_ticker"))
            ]
        state = self.state.reconcile_settlements(
            user_id,
            result["settlements"],
            result["fills"],
            environment=environment,
        )
        result["analytics"] = {
            key: (state.get("strategy") or {}).get(key)
            for key in (
                "settledSamples", "wins", "losses", "winRate", "totalPnl",
                "averagePnl", "bestTrade", "worstTrade", "settlementRecords",
                "closedTradeRecords", "realizedTradeRecords", "realizedSamples",
                "realizedWins", "realizedLosses", "realizedWinRate",
                "realizedTotalPnl", "realizedAveragePnl", "equityCurve",
                "learning",
            )
        }
        return result

    def _submit_live_order(self, user_id: str, payload: Mapping[str, Any], decision: Mapping[str, Any]) -> Dict[str, Any]:
        config = self._real_config(user_id)
        live_payload = _live_order_payload(payload)
        if not live_payload.get("ticker") or not live_payload.get("client_order_id"):
            raise KalshiApiError("Real Kalshi order payload is incomplete", status=400, code="kalshi_live_order_incomplete")
        response = self._signed(config, "POST", "/portfolio/events/orders", json_body=live_payload)
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

    def tick(self, user_id: str, *, submit_order: bool, mode: Optional[str] = None) -> Dict[str, Any]:
        """Serialize each account's evaluate-and-route cycle.

        The background scheduler and a manual refresh may arrive together. A
        per-user lock prevents both from observing the same position and
        submitting the same close before either portfolio refresh completes.
        """
        key = str(user_id)
        with self._tick_locks_guard:
            lock = self._tick_locks.setdefault(key, threading.RLock())
        with lock:
            return self._tick_locked(user_id, submit_order=submit_order, mode=mode)

    def _tick_locked(self, user_id: str, *, submit_order: bool, mode: Optional[str] = None) -> Dict[str, Any]:
        seed_state = self.state.get(user_id)
        strategy_seed = dict(seed_state.get("config") or {})
        execution_mode = _execution_mode(mode or strategy_seed.get("executionMode") or "paper")
        robot_state = self.state.get(user_id, environment=execution_mode)
        strategy_seed = dict(robot_state.get("config") or {})
        portfolio = self.portfolio(user_id, mode=execution_mode)
        environment = "real" if execution_mode == "real" else "paper"
        evidence = self.state.claim_ai_learning_review(user_id, environment=environment)
        if evidence and callable(self.ai_learning_reviewer):
            try:
                response = dict(self.ai_learning_reviewer(user_id, evidence) or {})
                self.state.complete_ai_learning_review(
                    user_id,
                    dict(response.get("review") or {}),
                    provider=str(response.get("provider") or ""),
                    model=str(response.get("model") or ""),
                    error=str(response.get("error") or "") or None,
                )
            except Exception as exc:
                self.state.complete_ai_learning_review(
                    user_id,
                    {},
                    error=f"AI calibration review failed: {type(exc).__name__}",
                )
        robot_state = self.state.get(user_id, environment=execution_mode)
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
        snapshot = self.client.snapshot(base_url=KALSHI_PUBLIC_BASE)
        ticker = str((snapshot.get("market") or {}).get("ticker") or "")
        account_context = _paper_account_context(portfolio, robot_state, ticker, bankroll)
        if execution_mode != "real":
            account_context["cooldownActive"] = False
            account_context["cooldownDetail"] = "disabled for paper mode"
        decision_context = dict(account_context)
        position_context = _position_execution_context(portfolio, ticker)
        held_side = position_context.get("side")
        held_count = int(position_context.get("count") or 0)
        if held_side:
            # Let the model calculate a fresh directional signal first. The
            # controller then decides whether that signal closes/reverses an
            # existing contract or should be skipped because we are already
            # aligned.
            decision_context["hasPosition"] = False
            decision_context["alreadyTraded"] = False
        decision = evaluate_btc15_contract(
            snapshot["market"],
            spot_price=snapshot["reference"].get("price"),
            candles=snapshot["reference"].get("candles") or [],
            config=strategy_config,
            orderbook=snapshot.get("orderbook") or {},
            reference_time=snapshot["reference"].get("timestamp"),
            book_time=snapshot.get("orderbookAsOf"),
            account_context=decision_context,
        )
        decision = dict(decision)
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
                decision["action"] = "WAIT"
                decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["position_already_aligned"]
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
                # cash, Kelly sizing, exposure, daily-loss and cooldown gates.
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
                decision["exitAnalysis"]["trigger"] = (
                    "emergency_stop_loss"
                    if exit_economics["emergencyLossExit"]
                    else "protective_stop_loss"
                    if exit_economics["protectiveLossExit"] and not economically_executable
                    else "fee_adjusted_take_profit"
                )
                route_count_override = fillable_exit_count
                can_route = True
        is_new_entry = bool(can_route and str(decision.get("executionIntent") or "").startswith("OPEN_"))
        if is_new_entry:
            ai_review = self._candidate_ai_review(user_id, decision, account_context)
            decision["aiReview"] = ai_review
            confidence = _finite_number(ai_review.get("confidence"), 0.0)
            if (
                ai_review.get("status") == "reviewed"
                and str(ai_review.get("verdict") or "").lower() == "challenge"
                and confidence >= 0.65
            ):
                decision["action"] = "WAIT"
                decision["blockingReasons"] = list(decision.get("blockingReasons") or []) + ["ai_challenge"]
                decision["gates"] = list(decision.get("gates") or []) + [{
                    "key": "ai_challenge",
                    "status": "block",
                    "severity": "review",
                    "label": "AI contradiction review",
                    "labelZh": "AI 矛盾复核",
                    "detail": str(ai_review.get("summary") or "Material contradiction requires another market update.")[:240],
                    "category": "review",
                }]
                can_route = False
        else:
            decision["aiReview"] = {
                "status": "not_required",
                "verdict": "not_reviewed",
                "summary": "AI review is reserved for cleared new-entry candidates; exits and hard gates remain deterministic.",
            }
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
        state = self.state.record(user_id, decision, order)
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
                portfolio = self.portfolio(user_id, mode=execution_mode)
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
        result = str(settlement.get("result") or "").upper()
        pnl = _finite_number(settlement.get("pnl_dollars"), 0.0)
        revenue = _finite_number(settlement.get("revenue_dollars"), 0.0)
        fees = _finite_number(settlement.get("fee_cost_dollars"), 0.0)
        payload = {
            "source": "Kalshi Paper Settlement",
            "event_id": settlement.get("settlement_id") or f"{ticker}:{settlement.get('settled_time')}",
            "trigger": "settlement",
            "mode": "paper",
            "timeEt": settlement.get("settled_time"),
            "processed": 1,
            "passedCandidates": 0,
            "runTime": "-",
            "warning": "",
            "topCandidates": [
                f"{ticker} settled {result} · payout ${revenue:.2f} · fees ${fees:.4f} · net P/L ${pnl:.2f}"
            ],
            "topSymbols": [ticker],
            "recommendations": [],
            "description": f"Kalshi Paper settlement: {ticker} resolved {result}. Net P/L ${pnl:.2f}.",
            "descriptionZh": f"Kalshi 模拟盘结算：{ticker} 结果 {result}，净盈亏 ${pnl:.2f}。",
        }
        self._notify(user_id, "cycle_digest", payload)

    def _loop(self):
        while not self._stop_event.wait(5.0):
            for user_id in self.state.enabled_users():
                try:
                    state = self.state.get(user_id)
                    mode = _execution_mode((state.get("config") or {}).get("executionMode"))
                    self.tick(user_id, submit_order=True, mode=mode)
                except Exception as exc:
                    self.safe_print(f"[KalshiRobot] tick failed user={user_id} error={type(exc).__name__}")
                    self.state.error(user_id, str(exc))
                    minute_key = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
                    self._notify(
                        user_id,
                        "risk_alert",
                        {
                            "source": "Kalshi Robot",
                            "event_id": f"kalshi-loop:{type(exc).__name__}:{minute_key}",
                            "symbol": BTC_15M_SERIES,
                            "step": "Kalshi robot",
                            "status": "attention",
                            "reason": f"Background tick failed: {type(exc).__name__}. {str(exc)[:180]}",
                            "reasonZh": f"Kalshi 后台机器人运行失败：{type(exc).__name__}。{str(exc)[:180]}",
                            "action": "The bot will keep retrying. Check Kalshi connectivity, quote freshness, and backend logs.",
                            "actionZh": "机器人会继续重试。请检查 Kalshi 连接、行情刷新和后端日志。",
                        },
                    )



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
    ai_learning_reviewer=None,
    ai_candidate_reviewer=None,
    ai_status_resolver=None,
    notifier=None,
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

    robot_state = KalshiRobotState(robot_state_path)
    paper_accounts = KalshiPaperAccountStore(paper_account_path)
    paper_robot = _PaperRobotController(
        client,
        robot_state,
        paper_accounts,
        ai_candidate_reviewer=ai_candidate_reviewer,
        ai_learning_reviewer=ai_learning_reviewer,
        ai_status_resolver=ai_status_resolver,
        connection_loader=load_connection,
        signed_request=signed_api_request,
        notifier=notifier,
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
            snapshot = client.snapshot(base_url=KALSHI_PUBLIC_BASE)
            decision = evaluate_btc15_contract(
                snapshot["market"],
                spot_price=snapshot["reference"].get("price"),
                candles=snapshot["reference"].get("candles") or [],
                orderbook=snapshot.get("orderbook") or {},
                reference_time=snapshot["reference"].get("timestamp"),
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
            snapshot = client.snapshot(base_url=KALSHI_PUBLIC_BASE)
            decision = evaluate_btc15_contract(
                snapshot["market"],
                spot_price=snapshot["reference"].get("price"),
                candles=snapshot["reference"].get("candles") or [],
                config=config,
                orderbook=snapshot.get("orderbook") or {},
                reference_time=snapshot["reference"].get("timestamp"),
                book_time=snapshot.get("orderbookAsOf"),
            )
            snapshot["reference"].pop("candles", None)
            mode = _execution_mode(config.get("executionMode") or (body or {}).get("mode") or "paper")
            return ok({"success": True, "snapshot": snapshot, "decision": decision, "robotState": robot_state.get(user["id"], environment=mode)})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/paper/portfolio")
    def kalshi_paper_portfolio():
        try:
            user = authenticated_user()
            mode = request_mode()
            return ok({
                "success": True,
                "portfolio": paper_robot.portfolio(user["id"], mode=mode),
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
            state = robot_state.configure(user["id"], body["enabled"], config)
            payload = {"success": True, "state": state}
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
            return ok({"success": True, **paper_robot.tick(user["id"], submit_order=bool(state.get("enabled")), mode=mode)})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/strategies")
    def kalshi_strategy_library():
        try:
            user = authenticated_user()
            mode = request_mode()
            return ok(robot_state.list_strategies(user["id"], environment=mode))
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/strategies")
    def kalshi_strategy_save():
        try:
            user = authenticated_user()
            body = request.get_json(silent=True) or {}
            if not isinstance(body, Mapping):
                raise KalshiApiError("JSON body must be an object", status=400, code="invalid_request")
            config = normalize_strategy_config(body.get("config") or {})
            mode = _execution_mode(config.get("executionMode") or body.get("mode") or "paper")
            config["executionMode"] = mode
            state = robot_state.save_strategy(
                user["id"],
                config,
                name=str(body.get("name") or ""),
                environment=mode,
                source=str(body.get("source") or "manual"),
            )
            return ok(state)
        except Exception as exc:
            return fail(exc)

    @blueprint.post("/api/kalshi/strategies/apply")
    def kalshi_strategy_apply():
        try:
            user = authenticated_user()
            body = request.get_json(silent=True) or {}
            if not isinstance(body, Mapping) or not body.get("strategyId"):
                raise KalshiApiError("strategyId is required", status=400, code="invalid_request")
            mode = request_mode(body.get("mode"))
            try:
                state = robot_state.apply_strategy(
                    user["id"],
                    str(body.get("strategyId")),
                    environment=mode,
                )
            except ValueError as exc:
                if str(exc) == "strategy_mode_mismatch":
                    raise KalshiApiError(
                        "The selected strategy belongs to a different execution mode.",
                        status=409,
                        code="kalshi_strategy_mode_mismatch",
                    ) from exc
                raise
            return ok({"success": True, "state": state})
        except Exception as exc:
            return fail(exc)

    @blueprint.get("/api/kalshi/strategies/recommend")
    def kalshi_strategy_recommend():
        try:
            user = authenticated_user()
            mode = request_mode()
            return ok(robot_state.recommend_strategy(user["id"], environment=mode))
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
            ai_status = (
                dict(ai_status_resolver(user["id"]) or {})
                if callable(ai_status_resolver)
                else {"configured": False, "status": "unavailable", "provider": "", "model": ""}
            )
            return ok({
                "success": True,
                "publicData": "available",
                "seriesTicker": BTC_15M_SERIES,
                "execution": "real_available" if active_summary["configured"] else "paper_only",
                "activeEnvironment": active_mode,
                "accountProvider": "Kalshi" if active_mode == "real" else "AlphaLab",
                "builtInPaperConfigured": True,
                "personalApiConfigured": active_summary["configured"],
                "liveTradingConfigured": active_summary["configured"],
                "connectionStatus": active_summary["testStatus"],
                "ai": ai_status,
            })
        except Exception as exc:
            return fail(exc)


    app.register_blueprint(blueprint)
    controls = {"client": client, "robot_state": robot_state, "paper_accounts": paper_accounts, "paper_robot": paper_robot}
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
