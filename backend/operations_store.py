"""Durable, user-scoped operational state for AlphaLab.

The service-role Supabase client bypasses RLS, so every query in this module
still includes an explicit ``user_id`` predicate.  Production never silently
falls back to process memory or the local filesystem: a missing/unavailable
Supabase store is surfaced to callers so safety controls fail visibly.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import threading
import uuid


class OperationsStoreError(RuntimeError):
    """Base error for operational persistence."""


class OperationsStoreUnavailable(OperationsStoreError):
    """Raised when durable storage is unavailable and fallback is forbidden."""


class OperationsVersionConflict(OperationsStoreError):
    """Raised when an optimistic version check fails."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def deterministic_key(namespace: str, *parts: object) -> str:
    raw = "|".join([str(namespace), *[str(part) for part in parts]])
    return "%s:%s" % (namespace, hashlib.sha256(raw.encode("utf-8")).hexdigest())


class OperationsStore:
    SAFETY_TABLE = "user_operations_safety_state"
    AUDIT_TABLE = "user_operations_audit_events"
    NOTIFICATION_TABLE = "user_notification_delivery_events"
    ORDER_TABLE = "user_order_lifecycle_events"
    READINESS_TABLE = "user_readiness_status"
    ARTIFACT_TABLE = "user_operation_artifacts"
    KALSHI_OBSERVATION_TABLE = "user_kalshi_market_observations"
    WORKER_LEASE_TABLE = "app_worker_leases"

    def __init__(
        self,
        supabase_client=None,
        execute=None,
        *,
        allow_local_fallback: bool = False,
        fallback_path: str | os.PathLike[str] | None = None,
    ):
        self._client = supabase_client
        self._execute_wrapper = execute
        self._allow_local_fallback = bool(allow_local_fallback)
        self._fallback_path = Path(fallback_path) if fallback_path else None
        self._lock = threading.RLock()
        self._local = {
            "safety": {},
            "audit": [],
            "notifications": [],
            "orders": [],
            "readiness": {},
            "artifacts": {},
            "kalshi_observations": {},
            "worker_leases": {},
            "worker_lease_fencing": 0,
        }
        if self._client is None and self._allow_local_fallback:
            self._load_local()

    @property
    def backend(self) -> str:
        if self._client is not None:
            return "supabase"
        if self._allow_local_fallback:
            return "local"
        return "unavailable"

    @staticmethod
    def _uid(user_id: object) -> str:
        uid = str(user_id or "").strip()
        if not uid:
            raise ValueError("user_id is required")
        return uid

    @staticmethod
    def _data(response):
        if response is None:
            return []
        data = getattr(response, "data", None)
        return data if isinstance(data, list) else []

    def _execute(self, operation, label: str):
        if self._client is None:
            if self._allow_local_fallback:
                return operation()
            raise OperationsStoreUnavailable("Durable operations store is not configured")
        try:
            if self._execute_wrapper:
                return self._execute_wrapper(operation, label)
            return operation()
        except OperationsStoreError:
            raise
        except Exception as exc:
            raise OperationsStoreUnavailable(
                "%s failed: %s" % (label, type(exc).__name__)
            ) from exc

    def _load_local(self):
        if not self._fallback_path or not self._fallback_path.exists():
            return
        try:
            payload = json.loads(self._fallback_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                for key in self._local:
                    if key in payload and isinstance(payload[key], type(self._local[key])):
                        self._local[key] = payload[key]
        except Exception:
            # Development fallback must not prevent the backend from starting.
            self._local = {
                "safety": {}, "audit": [], "notifications": [],
                "orders": [], "readiness": {}, "artifacts": {},
                "kalshi_observations": {},
                "worker_leases": {},
                "worker_lease_fencing": 0,
            }

    def _save_local(self):
        if not self._fallback_path:
            return
        self._fallback_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self._fallback_path.with_suffix(self._fallback_path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(self._local, ensure_ascii=False, separators=(",", ":"), default=str),
            encoding="utf-8",
        )
        os.replace(temporary, self._fallback_path)

    @staticmethod
    def default_safety(user_id: str) -> dict:
        return {
            "user_id": user_id,
            "pause_new_entries": False,
            "cancel_pending_entry_orders": False,
            "keep_protective_exits": True,
            "reason": "",
            "paused_at": None,
            "updated_at": None,
            "version": 0,
            "last_idempotency_key": None,
        }

    def get_safety(self, user_id: object) -> dict:
        uid = self._uid(user_id)
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                return deepcopy(self._local["safety"].get(uid) or self.default_safety(uid))
        response = self._execute(
            lambda: self._client.table(self.SAFETY_TABLE).select("*").eq(
                "user_id", uid
            ).limit(1).execute(),
            "safety state read",
        )
        rows = self._data(response)
        return dict(rows[0]) if rows else self.default_safety(uid)

    def update_safety(
        self,
        user_id: object,
        *,
        pause_new_entries: bool,
        cancel_pending_entry_orders: bool = False,
        reason: str = "",
        idempotency_key: str,
        expected_version: int | None = None,
    ) -> dict:
        uid = self._uid(user_id)
        if not isinstance(pause_new_entries, bool):
            raise ValueError("pause_new_entries must be boolean")
        if not isinstance(cancel_pending_entry_orders, bool):
            raise ValueError("cancel_pending_entry_orders must be boolean")
        if cancel_pending_entry_orders and not pause_new_entries:
            raise ValueError("pending entries can only be canceled while new entries are paused")
        key = str(idempotency_key or "").strip()
        if not key:
            raise ValueError("idempotency_key is required")
        with self._lock:
            current = self.get_safety(uid)
            if current.get("last_idempotency_key") == key:
                return current
            current_version = int(current.get("version") or 0)
            if expected_version is not None and int(expected_version) != current_version:
                raise OperationsVersionConflict(
                    "Expected safety version %s, found %s" % (expected_version, current_version)
                )
            now = utc_now_iso()
            row = {
                "user_id": uid,
                "pause_new_entries": pause_new_entries,
                "cancel_pending_entry_orders": cancel_pending_entry_orders,
                # This invariant is also enforced by a database CHECK constraint.
                "keep_protective_exits": True,
                "reason": str(reason or "").strip()[:500],
                "paused_at": now if pause_new_entries else None,
                "updated_at": now,
                "version": current_version + 1,
                "last_idempotency_key": key,
            }
            if self._client is None:
                self._local["safety"][uid] = row
                self._save_local()
                return deepcopy(row)
            if current_version == 0:
                response = self._execute(
                    lambda: self._client.table(self.SAFETY_TABLE).insert(row).execute(),
                    "safety state insert",
                )
            else:
                response = self._execute(
                    lambda: self._client.table(self.SAFETY_TABLE).update(row).eq(
                        "user_id", uid
                    ).eq("version", current_version).execute(),
                    "safety state update",
                )
            rows = self._data(response)
            if not rows:
                raise OperationsVersionConflict("Safety state changed concurrently")
            return dict(rows[0])

    def _find_event(self, table: str, user_id: str, idempotency_key: str):
        response = self._execute(
            lambda: self._client.table(table).select("*").eq(
                "user_id", user_id
            ).eq("idempotency_key", idempotency_key).limit(1).execute(),
            "%s idempotency read" % table,
        )
        rows = self._data(response)
        return dict(rows[0]) if rows else None

    def _append(self, collection: str, table: str, user_id: object, row: dict) -> dict:
        uid = self._uid(user_id)
        key = str(row.get("idempotency_key") or "").strip()
        if not key:
            raise ValueError("idempotency_key is required")
        item = dict(row)
        item["user_id"] = uid
        item.setdefault("created_at", utc_now_iso())
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                for existing in self._local[collection]:
                    if existing.get("user_id") == uid and existing.get("idempotency_key") == key:
                        return deepcopy(existing)
                item.setdefault("id", str(uuid.uuid4()))
                self._local[collection].append(item)
                self._save_local()
                return deepcopy(item)
        existing = self._find_event(table, uid, key)
        if existing:
            return existing
        try:
            response = self._execute(
                lambda: self._client.table(table).insert(item).execute(),
                "%s append" % table,
            )
            rows = self._data(response)
            if rows:
                return dict(rows[0])
        except OperationsStoreUnavailable:
            # A unique conflict can mean a concurrent retry won the insert.
            existing = self._find_event(table, uid, key)
            if existing:
                return existing
            raise
        raise OperationsStoreUnavailable("%s append returned no row" % table)

    def _list(
        self,
        collection: str,
        table: str,
        user_id: object,
        *,
        limit: int = 50,
        filters: dict | None = None,
    ) -> list[dict]:
        uid = self._uid(user_id)
        safe_limit = max(1, min(int(limit or 50), 200))
        active_filters = {
            key: value for key, value in (filters or {}).items()
            if value is not None and str(value) != ""
        }
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                rows = [
                    deepcopy(row) for row in self._local[collection]
                    if row.get("user_id") == uid
                    and all(row.get(key) == value for key, value in active_filters.items())
                ]
            rows.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
            return rows[:safe_limit]

        def operation():
            query = self._client.table(table).select("*").eq("user_id", uid)
            for key, value in active_filters.items():
                query = query.eq(key, value)
            return query.order("created_at", desc=True).limit(safe_limit).execute()

        return [dict(row) for row in self._data(self._execute(operation, "%s list" % table))]

    def append_audit(
        self,
        user_id: object,
        *,
        event_type: str,
        idempotency_key: str,
        actor: str = "user",
        source: str = "api",
        resource_type: str = "",
        resource_id: str = "",
        payload: dict | None = None,
    ) -> dict:
        return self._append("audit", self.AUDIT_TABLE, user_id, {
            "event_type": str(event_type or "unknown")[:100],
            "actor": str(actor or "user")[:50],
            "source": str(source or "api")[:80],
            "resource_type": str(resource_type or "")[:80],
            "resource_id": str(resource_id or "")[:200],
            "payload": dict(payload or {}),
            "idempotency_key": idempotency_key,
        })

    def list_audit(self, user_id: object, *, limit: int = 50) -> list[dict]:
        return self._list("audit", self.AUDIT_TABLE, user_id, limit=limit)

    def append_notification(self, user_id: object, *, idempotency_key: str, **fields) -> dict:
        return self._append("notifications", self.NOTIFICATION_TABLE, user_id, {
            "channel": str(fields.get("channel") or "discord")[:50],
            "event_type": str(fields.get("event_type") or "unknown")[:100],
            "status": str(fields.get("status") or "unknown")[:50],
            "message_id": str(fields.get("message_id") or "")[:200],
            "payload": dict(fields.get("payload") or {}),
            "error": str(fields.get("error") or "")[:1000],
            "idempotency_key": idempotency_key,
        })

    def list_notifications(self, user_id: object, *, limit: int = 50, status=None) -> list[dict]:
        return self._list(
            "notifications", self.NOTIFICATION_TABLE, user_id,
            limit=limit, filters={"status": status},
        )

    def append_order_event(self, user_id: object, *, idempotency_key: str, **fields) -> dict:
        order_id = str(fields.get("order_id") or "").strip()
        if not order_id:
            raise ValueError("order_id is required")
        return self._append("orders", self.ORDER_TABLE, user_id, {
            "order_id": order_id[:200],
            "broker_event_id": str(fields.get("broker_event_id") or "")[:200],
            "event_type": str(fields.get("event_type") or "unknown")[:100],
            "status": str(fields.get("status") or "unknown")[:80],
            "payload": dict(fields.get("payload") or {}),
            "idempotency_key": idempotency_key,
        })

    def list_order_events(self, user_id: object, *, limit: int = 50, order_id=None) -> list[dict]:
        return self._list(
            "orders", self.ORDER_TABLE, user_id,
            limit=limit, filters={"order_id": order_id},
        )

    @staticmethod
    def default_readiness(user_id: str) -> dict:
        return {
            "user_id": user_id,
            "checks": {},
            "completion_percent": 0,
            "blocking_reasons": [],
            "updated_at": None,
            "version": 0,
            "last_idempotency_key": None,
        }

    def get_readiness(self, user_id: object) -> dict:
        uid = self._uid(user_id)
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                return deepcopy(self._local["readiness"].get(uid) or self.default_readiness(uid))
        response = self._execute(
            lambda: self._client.table(self.READINESS_TABLE).select("*").eq(
                "user_id", uid
            ).limit(1).execute(),
            "readiness read",
        )
        rows = self._data(response)
        return dict(rows[0]) if rows else self.default_readiness(uid)

    def update_readiness(
        self,
        user_id: object,
        *,
        checks: dict,
        blocking_reasons: list | None,
        idempotency_key: str,
        expected_version: int | None = None,
    ) -> dict:
        uid = self._uid(user_id)
        if not isinstance(checks, dict):
            raise ValueError("checks must be an object")
        if blocking_reasons is not None and not isinstance(blocking_reasons, list):
            raise ValueError("blocking_reasons must be an array")
        with self._lock:
            current = self.get_readiness(uid)
            if current.get("last_idempotency_key") == idempotency_key:
                return current
            current_version = int(current.get("version") or 0)
            if expected_version is not None and int(expected_version) != current_version:
                raise OperationsVersionConflict("Readiness state changed concurrently")
            merged_checks = dict(current.get("checks") or {})
            merged_checks.update(checks)
            total = len(merged_checks)
            ready = sum(
                1 for value in merged_checks.values()
                if value is True or str(value).lower() in {"ready", "complete", "completed", "ok", "connected"}
            )
            row = {
                "user_id": uid,
                "checks": merged_checks,
                "completion_percent": round((ready / total) * 100, 2) if total else 0,
                "blocking_reasons": [str(item)[:300] for item in (blocking_reasons if blocking_reasons is not None else current.get("blocking_reasons") or [])][:50],
                "updated_at": utc_now_iso(),
                "version": current_version + 1,
                "last_idempotency_key": str(idempotency_key or ""),
            }
            if self._client is None:
                self._local["readiness"][uid] = row
                self._save_local()
                return deepcopy(row)
            if current_version == 0:
                response = self._execute(
                    lambda: self._client.table(self.READINESS_TABLE).insert(row).execute(),
                    "readiness insert",
                )
            else:
                response = self._execute(
                    lambda: self._client.table(self.READINESS_TABLE).update(row).eq(
                        "user_id", uid
                    ).eq("version", current_version).execute(),
                    "readiness update",
                )
            rows = self._data(response)
            if not rows:
                raise OperationsVersionConflict("Readiness state changed concurrently")
            return dict(rows[0])

    @staticmethod
    def _artifact_identity(user_id: str, artifact_type: object, artifact_key: object):
        kind = str(artifact_type or "").strip().lower()
        key = str(artifact_key or "").strip()
        if not kind or len(kind) > 80:
            raise ValueError("artifact_type is required and must be at most 80 characters")
        if not key or len(key) > 200:
            raise ValueError("artifact_key is required and must be at most 200 characters")
        return kind, key, "%s:%s:%s" % (user_id, kind, key)

    def get_artifact(self, user_id: object, artifact_type: object, artifact_key: object):
        uid = self._uid(user_id)
        kind, key, local_key = self._artifact_identity(uid, artifact_type, artifact_key)
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                item = self._local["artifacts"].get(local_key)
                return deepcopy(item) if item else None
        response = self._execute(
            lambda: self._client.table(self.ARTIFACT_TABLE).select("*").eq(
                "user_id", uid
            ).eq("artifact_type", kind).eq("artifact_key", key).limit(1).execute(),
            "artifact read",
        )
        rows = self._data(response)
        return dict(rows[0]) if rows else None

    def list_artifacts(self, user_id: object, *, artifact_type=None, limit: int = 100):
        uid = self._uid(user_id)
        kind = str(artifact_type or "").strip().lower()
        safe_limit = max(1, min(int(limit or 100), 200))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                rows = [
                    deepcopy(row) for row in self._local["artifacts"].values()
                    if row.get("user_id") == uid
                    and (not kind or row.get("artifact_type") == kind)
                ]
            rows.sort(key=lambda row: str(row.get("updated_at") or ""), reverse=True)
            return rows[:safe_limit]

        def operation():
            query = self._client.table(self.ARTIFACT_TABLE).select("*").eq("user_id", uid)
            if kind:
                query = query.eq("artifact_type", kind)
            return query.order("updated_at", desc=True).limit(safe_limit).execute()

        return [dict(row) for row in self._data(self._execute(operation, "artifact list"))]

    def list_scheduler_artifacts(
        self,
        artifact_type: object,
        artifact_key: object,
        *,
        limit: int = 200,
    ) -> list[dict]:
        """List one server-owned artifact identity across users.

        This method is only for in-process schedulers restoring durable,
        user-authorized work after a restart; browser-facing artifact APIs stay
        user-scoped.
        """
        kind = str(artifact_type or "").strip().lower()
        key = str(artifact_key or "").strip()
        if not kind or len(kind) > 80:
            raise ValueError("artifact_type is required and must be at most 80 characters")
        if not key or len(key) > 200:
            raise ValueError("artifact_key is required and must be at most 200 characters")
        safe_limit = max(1, min(int(limit or 200), 500))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                rows = [
                    deepcopy(row) for row in self._local["artifacts"].values()
                    if row.get("artifact_type") == kind and row.get("artifact_key") == key
                ]
            rows.sort(key=lambda row: str(row.get("updated_at") or ""), reverse=True)
            return rows[:safe_limit]

        response = self._execute(
            lambda: self._client.table(self.ARTIFACT_TABLE).select(
                "user_id,payload,version,updated_at"
            ).eq("artifact_type", kind).eq("artifact_key", key).order(
                "updated_at", desc=True
            ).limit(safe_limit).execute(),
            "scheduler artifact list",
        )
        return [dict(row) for row in self._data(response)]

    def put_artifact(
        self,
        user_id: object,
        artifact_type: object,
        artifact_key: object,
        *,
        payload: dict,
        idempotency_key: str,
        expected_version: int | None = None,
    ):
        uid = self._uid(user_id)
        kind, key, local_key = self._artifact_identity(uid, artifact_type, artifact_key)
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        request_key = str(idempotency_key or "").strip()
        if not request_key:
            raise ValueError("idempotency_key is required")
        with self._lock:
            current = self.get_artifact(uid, kind, key)
            if current and current.get("last_idempotency_key") == request_key:
                return current
            current_version = int((current or {}).get("version") or 0)
            if expected_version is not None and int(expected_version) != current_version:
                raise OperationsVersionConflict("Artifact changed concurrently")
            now = utc_now_iso()
            row = {
                "user_id": uid,
                "artifact_type": kind,
                "artifact_key": key,
                "payload": deepcopy(payload),
                "version": current_version + 1,
                "created_at": (current or {}).get("created_at") or now,
                "updated_at": now,
                "last_idempotency_key": request_key,
            }
            if self._client is None:
                self._local["artifacts"][local_key] = row
                self._save_local()
                return deepcopy(row)
            if current_version == 0:
                response = self._execute(
                    lambda: self._client.table(self.ARTIFACT_TABLE).insert(row).execute(),
                    "artifact insert",
                )
            else:
                response = self._execute(
                    lambda: self._client.table(self.ARTIFACT_TABLE).update(row).eq(
                        "user_id", uid
                    ).eq("artifact_type", kind).eq("artifact_key", key).eq(
                        "version", current_version
                    ).execute(),
                    "artifact update",
                )
            rows = self._data(response)
            if not rows:
                raise OperationsVersionConflict("Artifact changed concurrently")
            return dict(rows[0])

    def put_kalshi_observation(self, user_id: object, observation: dict) -> dict:
        """Upsert one deterministic 15-second Kalshi decision sample."""
        uid = self._uid(user_id)
        if not isinstance(observation, dict):
            raise ValueError("observation must be an object")
        environment = str(observation.get("environment") or "").strip().lower()
        ticker = str(observation.get("ticker") or "").strip()
        observation_key = str(observation.get("observation_key") or "").strip()
        observed_at = str(observation.get("observed_at") or "").strip()
        action = str(observation.get("action") or "WAIT").strip().upper()
        if environment not in {"paper", "real"}:
            raise ValueError("Kalshi observation environment must be paper or real")
        if not ticker or not observation_key or not observed_at:
            raise ValueError("Kalshi observation ticker, key, and time are required")
        row = {
            **deepcopy(observation),
            "user_id": uid,
            "environment": environment,
            "ticker": ticker[:160],
            "observation_key": observation_key[:240],
            "observed_at": observed_at,
            "action": action[:40],
        }
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            local_key = f"{uid}:{environment}:{observation_key}"
            with self._lock:
                self._local["kalshi_observations"][local_key] = row
                # Keep development fallback bounded while production remains
                # durable and queryable in Supabase.
                if len(self._local["kalshi_observations"]) > 20_000:
                    keys = list(self._local["kalshi_observations"])[:-20_000]
                    for key in keys:
                        self._local["kalshi_observations"].pop(key, None)
                self._save_local()
                return deepcopy(row)
        response = self._execute(
            lambda: self._client.table(self.KALSHI_OBSERVATION_TABLE).upsert(
                row,
                on_conflict="user_id,environment,observation_key",
            ).execute(),
            "Kalshi observation upsert",
        )
        rows = self._data(response)
        return dict(rows[0]) if rows else row

    def list_kalshi_observations(
        self,
        user_id: object,
        *,
        environment: object | None = None,
        since: object | None = None,
        limit: int = 1000,
    ) -> list[dict]:
        """Read recent user-scoped samples for diagnostics and calibration."""
        uid = self._uid(user_id)
        mode = str(environment or "").strip().lower()
        if mode and mode not in {"paper", "real"}:
            raise ValueError("Kalshi observation environment must be paper or real")
        since_value = str(since or "").strip()
        safe_limit = max(1, min(int(limit or 1000), 5000))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                rows = [
                    deepcopy(row)
                    for row in self._local["kalshi_observations"].values()
                    if row.get("user_id") == uid
                    and (not mode or row.get("environment") == mode)
                    and (not since_value or str(row.get("observed_at") or "") >= since_value)
                ]
            rows.sort(key=lambda row: str(row.get("observed_at") or ""), reverse=True)
            return rows[:safe_limit]

        def operation():
            query = self._client.table(self.KALSHI_OBSERVATION_TABLE).select(
                "ticker,environment,observed_at,action,side,execution_intent,"
                "signal_quality,seconds_to_close,model_yes_probability,"
                "fair_yes_probability,executable_price,net_edge,"
                "conservative_edge,spread,book_imbalance,blocked_reasons,"
                "features,order_result"
            ).eq("user_id", uid)
            if mode:
                query = query.eq("environment", mode)
            if since_value:
                query = query.gte("observed_at", since_value)
            return query.order("observed_at", desc=True).limit(safe_limit).execute()

        response = self._execute(operation, "Kalshi observation list")
        return [dict(row) for row in self._data(response)]

    def claim_worker_lease(
        self,
        lease_name: object,
        owner_id: object,
        *,
        ttl_seconds: int = 20,
        metadata: dict | None = None,
    ) -> bool:
        """Atomically claim or renew one cross-process scheduler lease."""
        name = str(lease_name or "").strip()
        owner = str(owner_id or "").strip()
        if not name or not owner:
            raise ValueError("lease_name and owner_id are required")
        ttl = max(5, min(int(ttl_seconds or 20), 300))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            # A local fallback runs in one backend process, so its in-process
            # scheduler owns the lease.
            with self._lock:
                self._local["worker_leases"][name] = {
                    "owner_id": owner,
                    "updated_at": utc_now_iso(),
                }
                return True
        response = self._execute(
            lambda: self._client.rpc(
                "claim_app_worker_lease",
                {
                    "p_lease_name": name,
                    "p_owner_id": owner,
                    "p_ttl_seconds": ttl,
                    "p_metadata": dict(metadata or {}),
                },
            ).execute(),
            "worker lease claim",
        )
        data = getattr(response, "data", response)
        if isinstance(data, list):
            data = data[0] if data else False
        return bool(data)

    @staticmethod
    def _lease_result(response) -> dict:
        data = getattr(response, "data", response)
        if isinstance(data, list):
            data = data[0] if data else {}
        if isinstance(data, bool):
            return {"acquired": data, "renewed": data}
        if not isinstance(data, dict):
            return {}
        return dict(data)

    def claim_worker_lease_fenced(
        self,
        lease_name: object,
        owner_id: object,
        *,
        ttl_seconds: int = 20,
        metadata: dict | None = None,
    ) -> dict:
        """Claim a lease generation and return its immutable fencing token.

        Unlike the compatibility ``claim_worker_lease`` method, this call never
        falls back to an unfenced RPC. Live broker routes use it so a worker
        paused beyond the TTL cannot resume with an obsolete lease generation.
        """
        name = str(lease_name or "").strip()
        owner = str(owner_id or "").strip()
        if not name or not owner:
            raise ValueError("lease_name and owner_id are required")
        ttl = max(5, min(int(ttl_seconds or 20), 300))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                now_epoch = datetime.now(timezone.utc).timestamp()
                current = self._local["worker_leases"].get(name) or {}
                current_owner = str(current.get("owner_id") or "")
                current_expiry = float(current.get("lease_expires_epoch") or 0)
                if current_owner and current_owner != owner and current_expiry > now_epoch:
                    return {"acquired": False, "fencingToken": None}
                if current_owner == owner and current_expiry > now_epoch:
                    fencing_token = int(current.get("fencing_token") or 0)
                else:
                    fencing_token = int(self._local.get("worker_lease_fencing") or 0) + 1
                    self._local["worker_lease_fencing"] = fencing_token
                expires_epoch = now_epoch + ttl
                self._local["worker_leases"][name] = {
                    "owner_id": owner,
                    "fencing_token": fencing_token,
                    "lease_expires_epoch": expires_epoch,
                    "metadata": dict(metadata or {}),
                    "updated_at": utc_now_iso(),
                }
                self._save_local()
                return {
                    "acquired": True,
                    "fencingToken": fencing_token,
                    "leaseExpiresAt": datetime.fromtimestamp(
                        expires_epoch, timezone.utc
                    ).isoformat(),
                }
        response = self._execute(
            lambda: self._client.rpc(
                "claim_app_worker_lease_fenced",
                {
                    "p_lease_name": name,
                    "p_owner_id": owner,
                    "p_ttl_seconds": ttl,
                    "p_metadata": dict(metadata or {}),
                },
            ).execute(),
            "fenced worker lease claim",
        )
        result = self._lease_result(response)
        token = result.get("fencingToken")
        if result.get("acquired") and (
            isinstance(token, bool) or not isinstance(token, (int, float)) or int(token) <= 0
        ):
            raise OperationsStoreUnavailable(
                "Fenced worker lease claim returned no fencing token"
            )
        return result

    def renew_worker_lease(
        self,
        lease_name: object,
        owner_id: object,
        fencing_token: object,
        *,
        ttl_seconds: int = 20,
        metadata: dict | None = None,
    ) -> bool:
        """Renew only an unexpired, exact lease generation."""
        name = str(lease_name or "").strip()
        owner = str(owner_id or "").strip()
        try:
            token = int(fencing_token)
        except (TypeError, ValueError) as exc:
            raise ValueError("fencing_token must be a positive integer") from exc
        if not name or not owner or token <= 0:
            raise ValueError("lease_name, owner_id, and fencing_token are required")
        ttl = max(5, min(int(ttl_seconds or 20), 300))
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                now_epoch = datetime.now(timezone.utc).timestamp()
                current = self._local["worker_leases"].get(name) or {}
                if (
                    str(current.get("owner_id") or "") != owner
                    or int(current.get("fencing_token") or 0) != token
                    or float(current.get("lease_expires_epoch") or 0) <= now_epoch
                ):
                    return False
                current.update({
                    "lease_expires_epoch": now_epoch + ttl,
                    "metadata": dict(metadata or current.get("metadata") or {}),
                    "updated_at": utc_now_iso(),
                })
                self._save_local()
                return True
        response = self._execute(
            lambda: self._client.rpc(
                "renew_app_worker_lease",
                {
                    "p_lease_name": name,
                    "p_owner_id": owner,
                    "p_fencing_token": token,
                    "p_ttl_seconds": ttl,
                    "p_metadata": dict(metadata or {}),
                },
            ).execute(),
            "fenced worker lease renewal",
        )
        result = self._lease_result(response)
        return bool(result.get("renewed"))

    def release_worker_lease(
        self,
        lease_name: object,
        owner_id: object,
        fencing_token: object = None,
    ) -> bool:
        """Release one worker lease only when the caller still owns it."""
        name = str(lease_name or "").strip()
        owner = str(owner_id or "").strip()
        if not name or not owner:
            raise ValueError("lease_name and owner_id are required")
        token = None
        if fencing_token is not None:
            try:
                token = int(fencing_token)
            except (TypeError, ValueError) as exc:
                raise ValueError("fencing_token must be a positive integer") from exc
            if token <= 0:
                raise ValueError("fencing_token must be a positive integer")
        if self._client is None:
            if not self._allow_local_fallback:
                raise OperationsStoreUnavailable("Durable operations store is not configured")
            with self._lock:
                current = self._local["worker_leases"].get(name) or {}
                if str(current.get("owner_id") or "") != owner:
                    return False
                if token is not None and int(current.get("fencing_token") or 0) != token:
                    return False
                self._local["worker_leases"].pop(name, None)
                self._save_local()
                return True
        arguments = {"p_lease_name": name, "p_owner_id": owner}
        rpc_name = "release_app_worker_lease"
        if token is not None:
            arguments["p_fencing_token"] = token
            rpc_name = "release_app_worker_lease_fenced"
        response = self._execute(
            lambda: self._client.rpc(
                rpc_name,
                arguments,
            ).execute(),
            "worker lease release",
        )
        data = getattr(response, "data", response)
        if isinstance(data, list):
            data = data[0] if data else False
        return bool(data)

    def probe_worker_lease_runtime(self, probe_id: object) -> dict:
        """Verify the fenced claim/renew/release migration without live work."""
        suffix = hashlib.sha256(str(probe_id or uuid.uuid4()).encode("utf-8")).hexdigest()[:24]
        lease_name = "runtime-readiness:%s" % suffix
        owner_id = "runtime-readiness:%s" % uuid.uuid4().hex
        token = None
        released = False
        try:
            claim = self.claim_worker_lease_fenced(
                lease_name,
                owner_id,
                ttl_seconds=5,
                metadata={"component": "runtime_readiness"},
            )
            token = claim.get("fencingToken")
            acquired = bool(claim.get("acquired") and token)
            renewed = bool(
                acquired
                and self.renew_worker_lease(
                    lease_name,
                    owner_id,
                    token,
                    ttl_seconds=5,
                    metadata={"component": "runtime_readiness"},
                )
            )
            if acquired:
                released = self.release_worker_lease(
                    lease_name, owner_id, token,
                )
            return {
                "healthy": bool(acquired and renewed and released),
                "claim": acquired,
                "renew": renewed,
                "release": released,
                "fencing": bool(token),
            }
        finally:
            if token is not None and not released:
                try:
                    self.release_worker_lease(lease_name, owner_id, token)
                except Exception:
                    pass

    def delete_artifact(
        self,
        user_id: object,
        artifact_type: object,
        artifact_key: object,
        *,
        expected_version: int | None = None,
    ) -> bool:
        uid = self._uid(user_id)
        kind, key, local_key = self._artifact_identity(uid, artifact_type, artifact_key)
        with self._lock:
            current = self.get_artifact(uid, kind, key)
            if not current:
                return False
            if expected_version is not None and int(expected_version) != int(current.get("version") or 0):
                raise OperationsVersionConflict("Artifact changed concurrently")
            if self._client is None:
                self._local["artifacts"].pop(local_key, None)
                self._save_local()
                return True
            response = self._execute(
                lambda: self._client.table(self.ARTIFACT_TABLE).delete().eq(
                    "user_id", uid
                ).eq("artifact_type", kind).eq("artifact_key", key).eq(
                    "version", int(current.get("version") or 0)
                ).execute(),
                "artifact delete",
            )
            rows = self._data(response)
            if not rows:
                raise OperationsVersionConflict("Artifact changed concurrently")
            return True
