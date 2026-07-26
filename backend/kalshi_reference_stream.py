"""Authenticated Kalshi CF Benchmarks reference stream.

Kalshi settles the BTC contracts in this project from CF Benchmarks' BRTI,
not from a single crypto venue.  This module keeps a small per-user WebSocket
cache of the official one-second BRTI feed.  Callers may always fall back to
public constituent venues when credentials or the stream are unavailable.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping, Optional


KALSHI_WS_URL = "wss://external-api-ws.kalshi.com/trade-api/ws/v2"
KALSHI_WS_SIGN_PATH = "/trade-api/ws/v2"


def _number(value: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _iso_from_milliseconds(value: Any) -> Optional[str]:
    milliseconds = _number(value)
    if milliseconds is None or milliseconds <= 0:
        return None
    return datetime.fromtimestamp(milliseconds / 1000.0, tz=timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )


class KalshiReferenceStream:
    """Maintain fresh BRTI samples without exposing stored API credentials."""

    def __init__(
        self,
        *,
        connection_loader: Callable[[str], Mapping[str, Any]],
        header_factory: Callable[..., Mapping[str, str]],
        safe_print=print,
        enabled: bool = True,
        websocket_url: str = KALSHI_WS_URL,
        freshness_seconds: float = 4.0,
        max_users: int = 50,
    ):
        self.connection_loader = connection_loader
        self.header_factory = header_factory
        self.safe_print = safe_print
        self.enabled = bool(enabled)
        self.websocket_url = str(websocket_url)
        self.freshness_seconds = max(1.0, float(freshness_seconds))
        self.max_users = max(1, int(max_users))
        self._lock = threading.RLock()
        self._entries: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def normalize_message(payload: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
        """Normalize one ``cfbenchmarks_value`` frame for strategy use."""
        if str(payload.get("type") or "") != "cfbenchmarks_value":
            return None
        message = payload.get("msg") or {}
        if not isinstance(message, Mapping) or str(message.get("index_id") or "") != "BRTI":
            return None
        try:
            raw = json.loads(str(message.get("data") or "{}"))
        except (TypeError, ValueError, json.JSONDecodeError):
            raw = {}
        raw_price = _number(raw.get("value"))
        if raw_price is None or raw_price <= 0:
            return None

        trailing = message.get("avg_60s_data") or {}
        settlement = message.get("last_60s_windowed_average_15min") or {}
        trailing_value = _number(trailing.get("value"), raw_price) or raw_price
        settlement_value = _number(settlement.get("value"))
        settlement_samples = max(0, min(60, int(_number(settlement.get("window_size"), 0) or 0)))
        # During the final minute, combine the observed official average with a
        # flat-forward estimate for the unobserved seconds.  At sample 60 this
        # is exactly the official settlement average; before that it converges
        # smoothly instead of jumping from the raw spot tick at expiry.
        settlement_estimate = raw_price
        if settlement_value is not None and settlement_samples > 0:
            settlement_estimate = (
                settlement_value * settlement_samples
                + raw_price * (60 - settlement_samples)
            ) / 60.0

        source_ms = raw.get("time") or message.get("received_at")
        timestamp = _iso_from_milliseconds(source_ms) or datetime.now(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
        return {
            "symbol": "BTC-USD",
            "price": settlement_estimate,
            "rawPrice": raw_price,
            "trailing60sAverage": trailing_value,
            "settlementWindowAverage": settlement_value,
            "settlementWindowSamples": settlement_samples,
            "settlementWindowProgress": round(settlement_samples / 60.0, 4),
            "timestamp": timestamp,
            "receivedAt": _iso_from_milliseconds(message.get("received_at")),
            "model": "kalshi_cf_benchmarks_brti",
            "isOfficialBrti": True,
            "venueCount": 1,
            "venues": ["CF Benchmarks BRTI via Kalshi"],
            "rejectedVenues": [],
            "dispersionBps": 0.0,
            "sourceSequence": payload.get("seq"),
        }

    def _credentials(self, user_id: str):
        config = dict(self.connection_loader(user_id) or {})
        key_id = str(config.get("production_api_key_id") or "").strip()
        private_key = str(config.get("production_private_key") or "").strip()
        return key_id, private_key

    def set_enabled(self, enabled: bool) -> None:
        """Enable lazy connections or stop every active authenticated stream."""
        target = bool(enabled)
        with self._lock:
            self.enabled = target
            entries = list(self._entries.values()) if not target else []
        for entry in entries:
            stop = entry.get("stop")
            if stop:
                stop.set()

    def ensure(self, user_id: str) -> None:
        uid = str(user_id or "").strip()
        if not self.enabled or not uid:
            return
        key_id, private_key = self._credentials(uid)
        if not key_id or not private_key:
            with self._lock:
                self._entries.setdefault(uid, {}).update({
                    "status": "credentials_missing",
                    "lastError": "",
                })
            return
        # A short one-way fingerprint lets us restart a connection when a key
        # is rotated without retaining or exposing the private key in status.
        credential_tag = hashlib.sha256(
            f"{key_id}\0{private_key}".encode("utf-8")
        ).hexdigest()[:16]
        with self._lock:
            current = self._entries.get(uid) or {}
            thread = current.get("thread")
            if thread and thread.is_alive() and current.get("credentialTag") == credential_tag:
                return
            if thread and thread.is_alive():
                # A rotated key must retire the old authenticated connection.
                # Otherwise both threads can continue writing samples into the
                # same user entry until the old socket happens to disconnect.
                current_stop = current.get("stop")
                if current_stop:
                    current_stop.set()
            if len(self._entries) >= self.max_users and uid not in self._entries:
                return
            stop = threading.Event()
            entry = {
                "status": "connecting",
                "lastError": "",
                "sample": current.get("sample"),
                "sampleMonotonic": current.get("sampleMonotonic", 0.0),
                "credentialTag": credential_tag,
                "stop": stop,
            }
            thread = threading.Thread(
                target=self._thread_main,
                args=(uid, key_id, private_key, stop),
                name=f"kalshi-brti-{uid[:8]}",
                daemon=True,
            )
            entry["thread"] = thread
            self._entries[uid] = entry
            thread.start()

    def snapshot(self, user_id: str) -> Optional[Dict[str, Any]]:
        self.ensure(user_id)
        uid = str(user_id or "").strip()
        with self._lock:
            entry = dict(self._entries.get(uid) or {})
            sample = entry.get("sample")
            age = max(0.0, time.monotonic() - float(entry.get("sampleMonotonic") or 0.0))
        if not isinstance(sample, Mapping) or age > self.freshness_seconds:
            return None
        result = dict(sample)
        result["streamAgeSeconds"] = round(age, 3)
        result["streamStatus"] = str(entry.get("status") or "live")
        return result

    def status(self, user_id: str) -> Dict[str, Any]:
        self.ensure(user_id)
        uid = str(user_id or "").strip()
        with self._lock:
            entry = dict(self._entries.get(uid) or {})
        age = None
        if entry.get("sampleMonotonic"):
            age = max(0.0, time.monotonic() - float(entry["sampleMonotonic"]))
        return {
            "status": str(entry.get("status") or ("disabled" if not self.enabled else "starting")),
            "fresh": bool(age is not None and age <= self.freshness_seconds),
            "ageSeconds": round(age, 3) if age is not None else None,
            "lastError": str(entry.get("lastError") or ""),
            "source": "CF Benchmarks BRTI via Kalshi WebSocket",
        }

    def _set_status(self, uid: str, status: str, error: str = "") -> None:
        with self._lock:
            if uid in self._entries:
                self._entries[uid]["status"] = status
                self._entries[uid]["lastError"] = str(error)[:160]

    def _store_sample(self, uid: str, sample: Mapping[str, Any]) -> None:
        with self._lock:
            if uid in self._entries:
                self._entries[uid]["sample"] = dict(sample)
                self._entries[uid]["sampleMonotonic"] = time.monotonic()
                self._entries[uid]["status"] = "live"
                self._entries[uid]["lastError"] = ""

    def _thread_main(self, uid: str, key_id: str, private_key: str, stop: threading.Event) -> None:
        delay = 1.0
        while not stop.is_set():
            try:
                asyncio.run(self._consume(uid, key_id, private_key, stop))
                delay = 1.0
            except Exception as exc:  # reconnect is deliberately fail-soft
                self._set_status(uid, "reconnecting", type(exc).__name__)
                self.safe_print(
                    f"[KalshiBRTI] stream reconnect user={uid[:8]} error={type(exc).__name__}"
                )
            if stop.wait(delay):
                return
            delay = min(30.0, delay * 2.0)

    async def _consume(self, uid: str, key_id: str, private_key: str, stop: threading.Event) -> None:
        import websockets

        headers = dict(
            self.header_factory(key_id, private_key, "GET", KALSHI_WS_SIGN_PATH)
        )
        self._set_status(uid, "connecting")
        async with websockets.connect(
            self.websocket_url,
            additional_headers=headers,
            open_timeout=10,
            close_timeout=4,
            ping_interval=20,
            ping_timeout=20,
            max_queue=256,
        ) as websocket:
            await websocket.send(json.dumps({
                "id": 1,
                "cmd": "subscribe",
                "params": {
                    "channels": ["cfbenchmarks_value"],
                    "index_ids": ["BRTI"],
                },
            }))
            self._set_status(uid, "subscribed")
            while not stop.is_set():
                raw = await asyncio.wait_for(websocket.recv(), timeout=35)
                payload = json.loads(raw)
                if payload.get("type") == "error":
                    message = payload.get("msg") or {}
                    raise RuntimeError(f"Kalshi feed error {message.get('code')}")
                sample = self.normalize_message(payload)
                if sample:
                    self._store_sample(uid, sample)

    def close(self) -> None:
        self.set_enabled(False)


__all__ = ["KalshiReferenceStream", "KALSHI_WS_URL", "KALSHI_WS_SIGN_PATH"]
