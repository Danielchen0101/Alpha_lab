"""AlphaLab-owned Kalshi paper-trading ledger.

The ledger consumes Kalshi's production public quotes but never submits an
order to Kalshi.  Money is stored in integer cents and contracts are whole
units, matching the account-level behaviour users see on Kalshi.
"""

from __future__ import annotations

import copy
import json
import math
import os
import threading
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple


PAPER_ACCOUNT_VERSION = 2
DEFAULT_STARTING_BALANCE_CENTS = 1_000_000  # $10,000.00
MAX_LEDGER_ROWS = 500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _ceil(value: Decimal, quantum: Decimal) -> Decimal:
    return value.quantize(quantum, rounding=ROUND_CEILING)


def taker_fill_amounts(price: float, contracts: int) -> Dict[str, float]:
    """Return Kalshi-compatible taker cost and fee amounts in dollars.

    Kalshi's general event fee is 7% * C * P * (1-P), rounded up to
    $0.0001.  The total account debit is then rounded up to a whole cent;
    that final alignment is reported as part of the effective fill fee.
    """
    count = int(contracts)
    p = Decimal(str(price))
    if count <= 0 or p <= 0 or p >= 1:
        raise ValueError("price must be between 0 and 1 and contracts must be positive")
    cost = p * Decimal(count)
    trade_fee = _ceil(Decimal("0.07") * Decimal(count) * p * (Decimal(1) - p), Decimal("0.0001"))
    debit = _ceil(cost + trade_fee, Decimal("0.01"))
    rounding_fee = debit - cost - trade_fee
    return {
        "positionCost": float(cost),
        "tradeFee": float(trade_fee),
        "roundingFee": float(rounding_fee),
        "fee": float(debit - cost),
        "debit": float(debit),
    }


def _normalize_book_levels(raw: Any) -> List[Tuple[float, int]]:
    levels: List[Tuple[float, int]] = []
    for level in raw or []:
        if not isinstance(level, Sequence) or isinstance(level, (str, bytes)) or len(level) < 2:
            continue
        price = _number(level[0])
        size = int(math.floor(_number(level[1])))
        if 0.0 < price < 1.0 and size > 0:
            levels.append((price, size))
    return sorted(levels, key=lambda item: item[0])


def executable_ask_levels(side: str, orderbook: Optional[Mapping[str, Any]]) -> List[Tuple[float, int]]:
    """Return Paper-executable user-side ask levels from Kalshi's YES book.

    Kalshi's public book exposes YES and NO bid ladders. Buying YES consumes the
    implied YES asks from NO bids at ``1 - no_bid``; buying NO consumes the
    implied NO asks from YES bids at ``1 - yes_bid``.
    """
    book = dict(orderbook or {})
    if str(side).upper() == "YES":
        return _normalize_book_levels((1.0 - price, size) for price, size in _normalize_book_levels(book.get("no")))
    if str(side).upper() == "NO":
        return _normalize_book_levels((1.0 - price, size) for price, size in _normalize_book_levels(book.get("yes")))
    return []


def _aggregate_fill(levels: Sequence[Tuple[float, int]], requested: int, limit_price: float, cash_cents: int) -> Dict[str, Any]:
    fills: List[Dict[str, Any]] = []
    remaining = max(0, int(requested))
    total_cost = 0.0
    total_trade_fee = 0.0
    total_debit_cents = 0
    for level_price, level_size in levels:
        if remaining <= 0 or level_price > limit_price + 1e-9:
            break
        count = min(remaining, int(level_size))
        while count > 0:
            amounts = taker_fill_amounts(level_price, count)
            debit_cents = int(round(amounts["debit"] * 100))
            if total_debit_cents + debit_cents <= cash_cents:
                break
            count -= 1
        if count <= 0:
            break
        amounts = taker_fill_amounts(level_price, count)
        debit_cents = int(round(amounts["debit"] * 100))
        fills.append({
            "price_dollars": round(level_price, 4),
            "count_fp": count,
            "position_cost_dollars": round(amounts["positionCost"], 4),
            "trade_fee_dollars": round(amounts["tradeFee"], 4),
            "rounding_fee_dollars": round(amounts["roundingFee"], 4),
            "fee_cost_dollars": round(amounts["fee"], 4),
            "debit_dollars": round(amounts["debit"], 4),
        })
        total_cost += amounts["positionCost"]
        total_trade_fee += amounts["tradeFee"]
        total_debit_cents += debit_cents
        remaining -= count
    fill_count = sum(int(item["count_fp"]) for item in fills)
    average_price = total_cost / fill_count if fill_count else 0.0
    return {
        "fills": fills,
        "fill_count": fill_count,
        "remaining_count": max(0, requested - fill_count),
        "average_price": average_price,
        "position_cost": total_cost,
        "trade_fee": total_trade_fee,
        "debit_cents": total_debit_cents,
        "fee_cost": (total_debit_cents / 100.0) - total_cost,
    }


class KalshiPaperAccountStore:
    """Thread-safe, per-user AlphaLab paper account and execution ledger."""

    def __init__(self, path: Optional[str] = None, *, starting_balance_cents: int = DEFAULT_STARTING_BALANCE_CENTS):
        self.path = path
        self.starting_balance_cents = max(10_000, int(starting_balance_cents))
        self._lock = threading.RLock()
        self._users: Dict[str, Dict[str, Any]] = {}
        if path and os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                if isinstance(payload, Mapping):
                    self._users = {
                        str(key): dict(value)
                        for key, value in payload.items()
                        if isinstance(value, Mapping)
                    }
            except Exception:
                self._users = {}
        migrated = False
        for user_id, account in list(self._users.items()):
            if int(account.get("version") or 0) < PAPER_ACCOUNT_VERSION:
                self._users[user_id] = self._initial()
                migrated = True
        if migrated:
            self._save()

    def _initial(self) -> Dict[str, Any]:
        return {
            "version": PAPER_ACCOUNT_VERSION,
            "createdAt": _now(),
            "updatedAt": _now(),
            "startingBalanceCents": self.starting_balance_cents,
            "dataProvenance": "kalshi_production_public_v2",
            "feeSchedule": {
                "seriesTicker": "KXBTC15M",
                "feeType": "quadratic",
                "feeMultiplier": 1.0,
                "formula": "0.07 * contracts * price * (1 - price)",
            },
            "cashCents": self.starting_balance_cents,
            "positions": {},
            "orders": [],
            "fills": [],
            "settlements": [],
        }

    def _account(self, user_id: str) -> Dict[str, Any]:
        key = str(user_id)
        account = self._users.get(key)
        if not isinstance(account, dict) or int(account.get("version") or 0) != PAPER_ACCOUNT_VERSION:
            account = self._initial()
            self._users[key] = account
        return account

    def _save(self) -> None:
        if not self.path:
            return
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        temporary = f"{self.path}.tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(self._users, handle, ensure_ascii=False, indent=2)
        os.replace(temporary, self.path)

    def reset(self, user_id: str) -> Dict[str, Any]:
        with self._lock:
            self._users[str(user_id)] = self._initial()
            self._save()
            return self.portfolio(user_id)

    @staticmethod
    def _position_value(position: Mapping[str, Any]) -> float:
        yes = _number(position.get("yesCount"))
        no = _number(position.get("noCount"))
        yes_mark = _number(position.get("yesMark"), _number(position.get("yesAveragePrice")))
        no_mark = _number(position.get("noMark"), _number(position.get("noAveragePrice")))
        return max(0.0, yes * yes_mark + no * no_mark)

    def update_mark(self, user_id: str, ticker: str, market: Mapping[str, Any]) -> None:
        with self._lock:
            position = (self._account(user_id).get("positions") or {}).get(str(ticker))
            if not isinstance(position, dict):
                return
            yes_bid = _number(market.get("yes_bid_dollars"), _number(market.get("yes_bid")) / 100.0)
            no_bid = _number(market.get("no_bid_dollars"), _number(market.get("no_bid")) / 100.0)
            if 0 < yes_bid < 1:
                position["yesMark"] = yes_bid
            if 0 < no_bid < 1:
                position["noMark"] = no_bid
            position["lastMarkedAt"] = _now()
            self._account(user_id)["updatedAt"] = _now()
            self._save()

    def submit_taker(
        self,
        user_id: str,
        *,
        ticker: str,
        side: str,
        price: float,
        contracts: int,
        available_depth: Optional[float] = None,
        limit_price: Optional[float] = None,
        orderbook: Optional[Mapping[str, Any]] = None,
        client_order_id: Optional[str] = None,
        market: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Immediately simulate a Paper IOC against production Kalshi book levels."""
        side = str(side or "").upper()
        ticker = str(ticker or "").strip()
        requested = max(0, int(contracts))
        base_price = float(price)
        limit = float(limit_price if limit_price is not None else price)
        order_id = f"paper-order-{uuid.uuid4()}"
        client_id = str(client_order_id or uuid.uuid4())
        created = _now()
        if side not in {"YES", "NO"} or not ticker or requested <= 0 or not 0 < base_price < 1 or not 0 < limit < 1:
            raise ValueError("A valid ticker, YES/NO side, price, and contract count are required")

        with self._lock:
            account = self._account(user_id)
            levels = executable_ask_levels(side, orderbook)
            if not levels:
                depth = requested
                if available_depth is not None and _number(available_depth) >= 0:
                    depth = min(depth, int(math.floor(_number(available_depth))))
                if depth > 0 and base_price <= limit + 1e-9:
                    levels = [(base_price, depth)]
            execution = _aggregate_fill(levels, requested, limit, int(account.get("cashCents") or 0))
            fill_count = int(execution["fill_count"])
            avg_price = float(execution["average_price"] or 0.0)
            remaining_count = int(execution["remaining_count"])
            status = "filled" if fill_count == requested else "partially_filled" if fill_count > 0 else "rejected"
            top_depth = sum(size for price_level, size in levels if price_level <= limit + 1e-9)
            rejection_reason = None
            if fill_count <= 0:
                rejection_reason = "insufficient_liquidity_or_price" if top_depth <= 0 else "insufficient_paper_cash"

            order = {
                "order_id": order_id,
                "client_order_id": client_id,
                "ticker": ticker,
                "outcome_side": side,
                "side": "bid" if side == "YES" else "ask",
                "type": "limit",
                "time_in_force": "immediate_or_cancel",
                "count_fp": requested,
                "fill_count_fp": fill_count,
                "remaining_count_fp": remaining_count,
                "limit_price_dollars": round(limit, 4),
                "average_price_dollars": round(avg_price, 4) if fill_count else None,
                "slippage_dollars": round(max(0.0, avg_price - base_price), 4) if fill_count else None,
                "position_cost_dollars": round(float(execution["position_cost"]), 4),
                "trade_fee_dollars": round(float(execution["trade_fee"]), 4),
                "rounding_fee_dollars": round(float(execution["fee_cost"]) - float(execution["trade_fee"]), 4),
                "fee_cost_dollars": round(float(execution["fee_cost"]), 4),
                "yes_price_dollars": round(avg_price if side == "YES" and fill_count else base_price if side == "YES" else 1.0 - (avg_price or base_price), 4),
                "no_price_dollars": round(avg_price if side == "NO" and fill_count else base_price if side == "NO" else 1.0 - (avg_price or base_price), 4),
                "status": status,
                "rejection_reason": rejection_reason,
                "matched_levels": copy.deepcopy(execution["fills"]),
                "created_time": created,
                "environment": "paper",
                "data_provenance": "kalshi_production_public_v2",
            }
            account["orders"].insert(0, order)
            account["orders"] = account["orders"][:MAX_LEDGER_ROWS]
            if fill_count <= 0:
                account["updatedAt"] = created
                self._save()
                return copy.deepcopy(order)

            debit_cents = int(execution["debit_cents"])
            account["cashCents"] = int(account.get("cashCents") or 0) - debit_cents
            fill = {
                "fill_id": f"paper-fill-{uuid.uuid4()}",
                "order_id": order_id,
                "client_order_id": client_id,
                "ticker": ticker,
                "outcome_side": side,
                "side": order["side"],
                "count_fp": fill_count,
                "yes_price_dollars": order["yes_price_dollars"],
                "no_price_dollars": order["no_price_dollars"],
                "price_dollars": round(avg_price, 4),
                "limit_price_dollars": round(limit, 4),
                "slippage_dollars": round(max(0.0, avg_price - base_price), 4),
                "position_cost_dollars": round(float(execution["position_cost"]), 4),
                "trade_fee_dollars": round(float(execution["trade_fee"]), 4),
                "rounding_fee_dollars": round(float(execution["fee_cost"]) - float(execution["trade_fee"]), 4),
                "fee_cost_dollars": round(float(execution["fee_cost"]), 4),
                "matched_levels": copy.deepcopy(execution["fills"]),
                "created_time": created,
                "environment": "paper",
                "data_provenance": "kalshi_production_public_v2",
            }
            account["fills"].insert(0, fill)
            account["fills"] = account["fills"][:MAX_LEDGER_ROWS]

            position = account["positions"].setdefault(ticker, {
                "ticker": ticker,
                "yesCount": 0,
                "noCount": 0,
                "yesCost": 0.0,
                "noCost": 0.0,
                "feeCost": 0.0,
                "yesMark": 0.0,
                "noMark": 0.0,
                "marketTitle": str((market or {}).get("title") or ""),
                "closeTime": (market or {}).get("close_time"),
            })
            count_key = "yesCount" if side == "YES" else "noCount"
            cost_key = "yesCost" if side == "YES" else "noCost"
            position[count_key] = int(position.get(count_key) or 0) + fill_count
            position[cost_key] = round(_number(position.get(cost_key)) + float(execution["position_cost"]), 4)
            position["feeCost"] = round(_number(position.get("feeCost")) + float(execution["fee_cost"]), 4)
            position["yesMark"] = avg_price if side == "YES" else max(0.0, 1.0 - avg_price)
            position["noMark"] = avg_price if side == "NO" else max(0.0, 1.0 - avg_price)
            position["lastTradeAt"] = created
            account["updatedAt"] = created
            self._save()
            return copy.deepcopy(order)

    def settle(self, user_id: str, ticker: str, result: str, *, settled_time: Optional[str] = None) -> Optional[Dict[str, Any]]:
        result = str(result or "").upper()
        if result not in {"YES", "NO"}:
            return None
        with self._lock:
            account = self._account(user_id)
            position = (account.get("positions") or {}).pop(str(ticker), None)
            if not isinstance(position, Mapping):
                return None
            yes_count = int(position.get("yesCount") or 0)
            no_count = int(position.get("noCount") or 0)
            revenue = float(yes_count if result == "YES" else no_count)
            account["cashCents"] = int(account.get("cashCents") or 0) + int(round(revenue * 100))
            row = {
                "settlement_id": f"paper-settlement-{uuid.uuid4()}",
                "ticker": str(ticker),
                "market_result": result,
                "yes_count_fp": yes_count,
                "no_count_fp": no_count,
                "revenue_dollars": round(revenue, 4),
                "yes_total_cost_dollars": round(_number(position.get("yesCost")), 4),
                "no_total_cost_dollars": round(_number(position.get("noCost")), 4),
                "fee_cost_dollars": round(_number(position.get("feeCost")), 4),
                "settlement_fee_dollars": 0.0,
                "settled_time": settled_time or _now(),
                "environment": "paper",
            }
            account["settlements"].insert(0, row)
            account["settlements"] = account["settlements"][:MAX_LEDGER_ROWS]
            account["updatedAt"] = _now()
            self._save()
            return copy.deepcopy(row)

    def open_tickers(self, user_id: str):
        with self._lock:
            return list((self._account(user_id).get("positions") or {}).keys())

    def portfolio(self, user_id: str) -> Dict[str, Any]:
        with self._lock:
            account = self._account(user_id)
            positions = []
            portfolio_value = 0.0
            for position in (account.get("positions") or {}).values():
                yes_count = int(position.get("yesCount") or 0)
                no_count = int(position.get("noCount") or 0)
                value = self._position_value(position)
                portfolio_value += value
                yes_cost = _number(position.get("yesCost"))
                no_cost = _number(position.get("noCost"))
                exposure = yes_cost + no_cost
                fees = _number(position.get("feeCost"))
                positions.append({
                    "ticker": position.get("ticker"),
                    "market_title": position.get("marketTitle"),
                    "close_time": position.get("closeTime"),
                    "yes_count_fp": yes_count,
                    "no_count_fp": no_count,
                    "position_fp": yes_count - no_count,
                    "market_exposure_dollars": round(exposure, 4),
                    "market_value_dollars": round(value, 4),
                    "unrealized_pnl_dollars": round(value - exposure - fees, 4),
                    "net_side": "YES" if yes_count > no_count else "NO" if no_count > yes_count else "HEDGED",
                    "net_count_fp": abs(yes_count - no_count),
                    "locked_payout_dollars": round(min(yes_count, no_count), 4),
                    "yes_average_price_dollars": round(yes_cost / yes_count, 4) if yes_count else None,
                    "no_average_price_dollars": round(no_cost / no_count, 4) if no_count else None,
                    "yes_mark_dollars": round(_number(position.get("yesMark")), 4),
                    "no_mark_dollars": round(_number(position.get("noMark")), 4),
                    "fee_cost_dollars": round(fees, 4),
                    "last_trade_at": position.get("lastTradeAt"),
                })
            return {
                "environment": "paper",
                "accountProvider": "AlphaLab",
                "balance": {
                    "balance": int(account.get("cashCents") or 0),
                    "portfolio_value": int(round(portfolio_value * 100)),
                    "starting_balance": int(account.get("startingBalanceCents") or self.starting_balance_cents),
                },
                "positions": positions,
                "orders": copy.deepcopy(list(account.get("orders") or [])),
                "fills": copy.deepcopy(list(account.get("fills") or [])),
                "settlements": copy.deepcopy(list(account.get("settlements") or [])),
                "asOf": _now(),
            }


__all__ = [
    "DEFAULT_STARTING_BALANCE_CENTS",
    "KalshiPaperAccountStore",
    "taker_fill_amounts",
]
