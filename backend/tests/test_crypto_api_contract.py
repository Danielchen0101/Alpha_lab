from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import threading

from flask import Flask
import pytest

import crypto_api


class FakeStore:
    def __init__(self):
        self.artifacts = {}
        self.audit = []
        self.lock = threading.RLock()

    def get_artifact(self, user_id, artifact_type, artifact_key):
        with self.lock:
            return deepcopy(self.artifacts.get((str(user_id), artifact_type, artifact_key)))

    def put_artifact(
        self, user_id, artifact_type, artifact_key, *, payload,
        idempotency_key, expected_version=None,
    ):
        key = (str(user_id), artifact_type, artifact_key)
        with self.lock:
            current = self.artifacts.get(key) or {}
            version = int(current.get("version") or 0) + 1
            row = {
                "user_id": str(user_id), "artifact_type": artifact_type,
                "artifact_key": artifact_key, "payload": deepcopy(payload),
                "version": version, "updated_at": f"2026-07-18T00:00:{version:02d}+00:00",
                "created_at": current.get("created_at") or "2026-07-18T00:00:00+00:00",
                "last_idempotency_key": idempotency_key,
            }
            self.artifacts[key] = row
            return deepcopy(row)

    def list_artifacts(self, user_id, *, artifact_type=None, limit=100):
        uid = str(user_id)
        with self.lock:
            rows = [
                deepcopy(row) for (owner, kind, _), row in self.artifacts.items()
                if owner == uid and (not artifact_type or kind == artifact_type)
            ]
        rows.sort(key=lambda row: row.get("updated_at") or "", reverse=True)
        return rows[:limit]

    def append_audit(self, user_id, **fields):
        row = {
            "id": str(len(self.audit) + 1), "user_id": str(user_id),
            "created_at": "2026-07-18T00:00:00+00:00", **deepcopy(fields),
        }
        self.audit.append(row)
        return deepcopy(row)

    def list_audit(self, user_id, *, limit=50):
        uid = str(user_id)
        return [deepcopy(row) for row in reversed(self.audit) if row["user_id"] == uid][:limit]

    def list_audit_page(self, user_id, *, offset=0, limit=50):
        uid = str(user_id)
        rows = [deepcopy(row) for row in reversed(self.audit) if row["user_id"] == uid]
        return rows[offset:offset + limit]


class FakeResponse:
    def __init__(self, status_code, payload=None, headers=None):
        self.status_code = status_code
        self.payload = payload
        self.headers = headers or {}

    def json(self):
        if self.payload is None:
            raise ValueError("no json")
        return deepcopy(self.payload)


def make_api(monkeypatch, *, auth=None, store=None, resolver=None):
    monkeypatch.setenv("ALPHALAB_DISABLE_CRYPTO_SCHEDULER", "1")
    app = Flask(__name__)
    app.config.update(TESTING=True)
    auth_state = auth if auth is not None else {"user": {"id": "user-a"}}
    fake_store = store or FakeStore()

    def require_auth():
        return auth_state.get("user")

    def default_resolver(uid, mode):
        return {
            "api_key": f"key-{uid}-{mode}", "api_secret": "secret",
            "base_url": "https://paper-api.alpaca.markets" if mode == "paper" else "https://api.alpaca.markets",
        }

    controls = crypto_api.register_crypto_api(
        app,
        require_auth=require_auth,
        resolve_alpaca_config_for_user=resolver or default_resolver,
        operations_store=fake_store,
        safe_print=lambda *_args, **_kwargs: None,
    )
    return app, app.test_client(), auth_state, fake_store, controls


def test_crypto_routes_require_verified_user(monkeypatch):
    app, client, _, _, controls = make_api(monkeypatch, auth={"user": None})
    try:
        for path in ("/api/crypto/config", "/api/crypto/runtime", "/api/crypto/overview"):
            response = client.get(path)
            assert response.status_code == 401
            assert response.get_json()["reason"] == "authentication_required"
    finally:
        controls["stop"]()


def test_live_cycle_fails_closed_before_any_broker_or_data_call(monkeypatch):
    store = FakeStore()
    config = crypto_api._default_config()
    config.update({"mode": "live", "liveAuthorized": False, "enabled": True})
    store.put_artifact(
        "user-a", crypto_api.CONFIG_TYPE, crypto_api.PRIMARY_KEY,
        payload=config, idempotency_key="seed-live",
    )
    calls = []
    monkeypatch.setattr(crypto_api.requests, "request", lambda *args, **kwargs: calls.append(args) or None)
    _, client, _, _, controls = make_api(monkeypatch, store=store)
    try:
        response = client.post("/api/crypto/run-cycle", json={})
        assert response.status_code == 403
        assert response.get_json()["reason"] == "live_not_authorized"
        assert calls == []
    finally:
        controls["stop"]()


def test_read_mode_can_be_selected_but_trading_mode_must_match_saved_config(monkeypatch):
    calls = []
    monkeypatch.setattr(crypto_api.requests, "request", lambda *args, **kwargs: calls.append(args) or None)
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    observed_modes = []
    try:
        monkeypatch.setattr(
            service, "_broker_config",
            lambda _uid, mode: observed_modes.append(("config", mode)) or {},
        )
        monkeypatch.setattr(
            service, "account",
            lambda _uid, mode: (
                observed_modes.append(("account", mode))
                or ({"equity": "1000", "cash": "1000"}, {
                    "eligible": True, "cryptoStatus": "ACTIVE", "reasons": [],
                })
            ),
        )
        monkeypatch.setattr(
            service, "positions",
            lambda _uid, mode: observed_modes.append(("positions", mode)) or [],
        )
        monkeypatch.setattr(
            service, "snapshots",
            lambda _uid, mode, _symbols: observed_modes.append(("snapshots", mode)) or {},
        )
        monkeypatch.setattr(
            service, "assets",
            lambda _uid, mode: observed_modes.append(("assets", mode)) or [],
        )

        overview = client.get("/api/crypto/overview?mode=live")
        assert overview.status_code == 200
        assert overview.get_json()["mode"] == "live"
        assert observed_modes == [
            ("config", "live"), ("account", "live"),
            ("positions", "live"), ("snapshots", "live"), ("assets", "live"),
        ]

        run = client.post("/api/crypto/run-cycle", json={"mode": "live"})
        start = client.post("/api/crypto/automation/start", json={"mode": "live"})
        assert run.status_code == 409
        assert start.status_code == 409
        assert run.get_json()["reason"] == "config_mode_mismatch"
        assert start.get_json()["reason"] == "config_mode_mismatch"
        assert calls == []
    finally:
        controls["stop"]()


def test_order_contract_rejects_day_bracket_and_direct_overrides(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        invalid_tif = client.put("/api/crypto/config", json={
            "order": {"type": "market", "timeInForce": "day", "limitOffsetBps": 5, "stopOffsetBps": 10},
        })
        assert invalid_tif.status_code == 400
        assert invalid_tif.get_json()["reason"] == "invalid_order_contract"

        invalid_class = client.put("/api/crypto/config", json={
            "order": {
                "type": "market", "timeInForce": "gtc", "limitOffsetBps": 5,
                "stopOffsetBps": 10, "orderClass": "bracket",
            },
        })
        assert invalid_class.status_code == 400

        invalid_stop_tif = client.put("/api/crypto/config", json={
            "order": {"type": "stop_limit", "timeInForce": "ioc", "limitOffsetBps": 5, "stopOffsetBps": 10},
        })
        assert invalid_stop_tif.status_code == 400
        assert invalid_stop_tif.get_json()["reason"] == "invalid_order_contract"

        direct = client.post("/api/crypto/run-cycle", json={
            "order": {"side": "sell", "timeInForce": "day"},
        })
        assert direct.status_code == 400
        assert direct.get_json()["reason"] == "invalid_order_contract"
    finally:
        controls["stop"]()


def test_kill_switch_blocks_orders_and_explicit_reset_does_not_restore_live_authority(monkeypatch):
    calls = []
    monkeypatch.setattr(crypto_api.requests, "request", lambda *args, **kwargs: calls.append(args) or None)
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        killed = client.post("/api/crypto/kill-switch", json={"enabled": True})
        assert killed.status_code == 200
        assert killed.get_json()["config"]["killSwitch"] is True

        cycle = client.post("/api/crypto/run-cycle", json={})
        assert cycle.status_code == 409
        assert cycle.get_json()["reason"] == "kill_switch_active"
        assert calls == []

        reset = client.post("/api/crypto/kill-switch", json={"enabled": False})
        payload = reset.get_json()
        assert reset.status_code == 200
        assert payload["config"]["killSwitch"] is False
        assert payload["config"]["enabled"] is False
        assert payload["config"]["liveAuthorized"] is False
    finally:
        controls["stop"]()


def test_config_and_ledger_are_strictly_user_scoped(monkeypatch):
    _, client, auth, store, controls = make_api(monkeypatch)
    try:
        first = client.put("/api/crypto/config", json={"riskProfile": "conservative"})
        assert first.status_code == 200
        store.append_audit(
            "user-a", event_type="crypto_private_a", idempotency_key="a",
            actor="user", source="test", resource_type="crypto", resource_id="BTC/USD",
            payload={"secret": "a"},
        )

        auth["user"] = {"id": "user-b"}
        second = client.put("/api/crypto/config", json={"riskProfile": "aggressive"})
        assert second.status_code == 200
        store.append_audit(
            "user-b", event_type="crypto_private_b", idempotency_key="b",
            actor="user", source="test", resource_type="crypto", resource_id="ETH/USD",
            payload={"secret": "b"},
        )
        b_config = client.get("/api/crypto/config").get_json()["config"]
        b_ledger = client.get("/api/crypto/ledger").get_json()["records"]
        assert b_config["riskProfile"] == "aggressive"
        assert [row["eventType"] for row in b_ledger] == ["crypto_private_b", "crypto_config_updated"]

        auth["user"] = {"id": "user-a"}
        a_config = client.get("/api/crypto/config").get_json()["config"]
        a_ledger = client.get("/api/crypto/ledger").get_json()["records"]
        assert a_config["riskProfile"] == "conservative"
        assert [row["eventType"] for row in a_ledger] == ["crypto_private_a", "crypto_config_updated"]
    finally:
        controls["stop"]()


def test_automation_start_is_24x7_and_never_reads_equity_market_clock(monkeypatch):
    calls = []

    def fake_request(method, url, **kwargs):
        calls.append((method, url, kwargs))
        assert "/v2/clock" not in url
        if url.endswith("/v2/account"):
            return FakeResponse(200, {
                "status": "ACTIVE", "crypto_status": "ACTIVE",
                "trading_blocked": False, "account_blocked": False,
                "trade_suspended_by_user": False, "equity": "10000",
            })
        raise AssertionError(f"unexpected broker request: {url}")

    monkeypatch.setattr(crypto_api.requests, "request", fake_request)
    _, client, _, _, controls = make_api(monkeypatch)
    monkeypatch.setattr(controls["service"], "runtime_snapshot", lambda: {
        "schedulerHealthy": True, "status": "healthy", "message": "Crypto scheduler is running.",
    })
    try:
        response = client.post("/api/crypto/automation/start", json={})
        assert response.status_code == 200
        runtime = response.get_json()["runtime"]
        assert runtime["coverage"] == "24/7"
        assert runtime["marketClockRequired"] is False
        assert len(calls) == 1
        assert calls[0][1].endswith("/v2/account")
    finally:
        controls["stop"]()


def test_automation_start_fails_closed_when_scheduler_is_not_healthy(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    account_calls = []
    monkeypatch.setattr(
        service,
        "account",
        lambda *_args: account_calls.append(True) or ({}, {
            "eligible": True, "cryptoStatus": "ACTIVE", "reasons": [],
        }),
    )
    try:
        response = client.post("/api/crypto/automation/start", json={})
        assert response.status_code == 503
        assert response.get_json()["reason"] == "scheduler_unavailable"
        assert account_calls == []
        assert service.get_config("user-a")["enabled"] is False
        assert service.get_runtime("user-a")["status"] != "armed"
    finally:
        controls["stop"]()


def test_scheduler_enumeration_is_capped_and_only_selects_enabled_crypto_configs(monkeypatch):
    rows = [
        {"user_id": f"user-{index}", "payload": {"enabled": index % 2 == 0, "killSwitch": False}}
        for index in range(480)
    ]

    class Query:
        def __init__(self):
            self.range_value = None
            self.required_payload = {}
            self.order_value = None

        def select(self, *_args): return self
        def eq(self, *_args): return self
        def contains(self, _field, value): self.required_payload = dict(value); return self
        def order(self, field, **_kwargs): self.order_value = field; return self
        def range(self, start, end): self.range_value = (start, end); return self
        def execute(self):
            filtered = [
                row for row in rows
                if all((row.get("payload") or {}).get(key) == value for key, value in self.required_payload.items())
            ]
            filtered.sort(key=lambda row: row["user_id"])
            start, end = self.range_value
            return SimpleNamespace(data=filtered[start:end + 1])

    query = Query()
    admin = SimpleNamespace(table=lambda _name: query)
    monkeypatch.setenv("ALPHALAB_DISABLE_CRYPTO_SCHEDULER", "1")
    app = Flask(__name__)
    controls = crypto_api.register_crypto_api(
        app,
        require_auth=lambda: {"id": "user-a"},
        resolve_alpaca_config_for_user=lambda *_args: {},
        operations_store=FakeStore(), supabase_admin=admin,
        safe_print=lambda *_args: None,
    )
    try:
        enabled = controls["service"]._enumerate_enabled()
        assert query.range_value == (0, crypto_api.MAX_SCHEDULER_USERS - 1)
        assert query.order_value == "user_id"
        assert query.required_payload == {"enabled": True, "killSwitch": False}
        assert len(enabled) == crypto_api.MAX_SCHEDULER_USERS
        assert all(int(uid.split("-")[1]) % 2 == 0 for uid in enabled)
        controls["service"]._scheduler_cursor = crypto_api.MAX_SCHEDULER_USERS
        second_page = controls["service"]._enumerate_enabled()
        assert query.range_value == (200, 399)
        assert len(second_page) == 40
    finally:
        controls["stop"]()


def test_three_broker_failures_lock_automation_but_policy_denials_do_not(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        # An expected kill-switch denial is not an infrastructure strike.
        client.post("/api/crypto/kill-switch", json={"enabled": True})
        denied = client.post("/api/crypto/run-cycle", json={})
        assert denied.status_code == 409
        assert service.get_runtime("user-a")["consecutiveErrors"] == 0
        client.post("/api/crypto/kill-switch", json={"enabled": False})

        def fail_account(*_args, **_kwargs):
            raise crypto_api.BrokerError("upstream unavailable", status=503, code="broker_unavailable")

        monkeypatch.setattr(service, "account", fail_account)
        for expected_errors in (1, 2, 3):
            response = client.post("/api/crypto/run-cycle", json={})
            assert response.status_code == 503
            runtime = service.get_runtime("user-a")
            assert runtime["consecutiveErrors"] == expected_errors
        assert service.get_runtime("user-a")["locked"] is True

        locked = client.post("/api/crypto/run-cycle", json={})
        assert locked.status_code == 423
        assert service.get_runtime("user-a")["consecutiveErrors"] == 3
    finally:
        controls["stop"]()


def test_spot_order_builder_never_creates_short_or_bracket_orders(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        config = crypto_api._default_config()
        market_buy = service._build_order(
            config, symbol="BTC/USD", action="BUY", price=60_000,
            notional=100, client_order_id="crypto-buy-1",
        )
        assert market_buy["side"] == "buy"
        assert market_buy["notional"] == "100"
        assert "order_class" not in market_buy

        config["order"] = {
            "type": "limit", "timeInForce": "gtc",
            "limitOffsetBps": 5, "stopOffsetBps": 10,
        }
        limit_buy = service._build_order(
            config, symbol="BTC/USD", action="BUY", price=50_000,
            notional=100, client_order_id="crypto-buy-2",
        )
        assert "qty" in limit_buy and "notional" not in limit_buy

        try:
            service._build_order(
                config, symbol="BTC/USD", action="EXIT", price=50_000,
                qty=-1, client_order_id="crypto-sell-1",
            )
        except crypto_api.CryptoApiError as exc:
            assert exc.code == "invalid_order_contract"
        else:
            raise AssertionError("negative crypto sell quantity was accepted")
    finally:
        controls["stop"]()


def test_optional_ai_reviewer_can_only_make_a_decision_more_conservative(monkeypatch):
    monkeypatch.setenv("ALPHALAB_DISABLE_CRYPTO_SCHEDULER", "1")
    app = Flask(__name__)

    def reviewer(_uid, evidence):
        # Attempt to manufacture a BUY even when the deterministic action is
        # an exit. The safety wrapper must ignore it.
        return {"verdict": "approve", "action": "BUY", "summary": "take more risk"}

    controls = crypto_api.register_crypto_api(
        app,
        require_auth=lambda: {"id": "user-a"},
        resolve_alpaca_config_for_user=lambda *_args: {},
        operations_store=FakeStore(), ai_reviewer=reviewer,
        safe_print=lambda *_args: None,
    )
    service = controls["service"]
    try:
        reviewed_exit = service._restricted_ai_review("user-a", {
            "symbol": "BTC/USD", "action": "EXIT", "score": 10,
            "targetWeight": 0.0, "currentWeight": 0.1,
        })
        assert reviewed_exit["action"] == "EXIT"
        assert reviewed_exit["targetWeight"] == 0.0

        service.ai_reviewer = lambda _uid, _evidence: {
            "verdict": "reject", "action": "HOLD", "summary": "context risk",
        }
        blocked_entry = service._restricted_ai_review("user-a", {
            "symbol": "ETH/USD", "action": "BUY", "score": 80,
            "targetWeight": 0.08, "currentWeight": 0.0,
        })
        assert blocked_entry["action"] == "HOLD"
        assert blocked_entry["targetWeight"] == 0.0
        assert blocked_entry["aiReview"]["source"] == "settings_ai"

        service.ai_reviewer = lambda _uid, _evidence: {
            "status": "unavailable", "verdict": "unavailable",
            "action": "BUY", "summary": "provider timeout",
        }
        live_entry = service._restricted_ai_review("user-a", {
            "symbol": "BTC/USD", "mode": "live", "action": "BUY", "score": 82,
            "targetWeight": 0.12, "currentWeight": 0.0,
        })
        paper_entry = service._restricted_ai_review("user-a", {
            "symbol": "BTC/USD", "mode": "paper", "action": "BUY", "score": 82,
            "targetWeight": 0.12, "currentWeight": 0.0,
        })
        assert live_entry["action"] == "HOLD"
        assert live_entry["targetWeight"] == 0.0
        assert paper_entry["action"] == "BUY"

        service.ai_reviewer = lambda _uid, _evidence: {
            "status": "reviewed", "verdict": "caution",
            "action": "REDUCE", "summary": "reduce event risk",
        }
        reduced_add = service._restricted_ai_review("user-a", {
            "symbol": "ETH/USD", "mode": "paper", "action": "ADD", "score": 85,
            "targetWeight": 0.12, "currentWeight": 0.08,
        })
        assert reduced_add["action"] == "REDUCE"
        assert reduced_add["targetWeight"] == 0.04
    finally:
        controls["stop"]()


def test_paper_learning_settings_are_bounded_and_never_carry_into_live():
    paper = crypto_api._validate_config({
        "mode": "paper", "paperLearningEnabled": True,
        "calibrationEveryCycles": 48,
    })
    assert paper["paperLearningEnabled"] is True
    assert paper["calibrationEveryCycles"] == 48

    live = crypto_api._validate_config({
        "mode": "live", "paperLearningEnabled": True,
        "calibrationEveryCycles": 12,
    })
    assert live["paperLearningEnabled"] is False

    with pytest.raises(crypto_api.CryptoApiError) as error:
        crypto_api._validate_config({"calibrationEveryCycles": 1})
    assert error.value.code == "invalid_config"


def test_strategy_calibration_route_is_paper_only(monkeypatch):
    store = FakeStore()
    config = crypto_api._default_config()
    config.update({"mode": "live", "paperLearningEnabled": False})
    store.put_artifact(
        "user-a", crypto_api.CONFIG_TYPE, crypto_api.PRIMARY_KEY,
        payload=config, idempotency_key="seed-live-calibration",
    )
    _, client, _, _, controls = make_api(monkeypatch, store=store)
    try:
        response = client.post("/api/crypto/calibration/run", json={"apply": True})
        assert response.status_code == 409
        assert response.get_json()["reason"] == "paper_calibration_only"
    finally:
        controls["stop"]()


def test_strategy_library_exposes_curated_sources_without_executable_patches(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        response = client.get("/api/crypto/strategy-library")
        assert response.status_code == 200
        body = response.get_json()
        assert len(body["strategies"]) == len(crypto_api.STRATEGY_RESEARCH_LIBRARY)
        assert body["strategies"][0]["role"] == "control"
        assert all("patch" not in item for item in body["strategies"])
        assert all(item["source"]["title"] for item in body["strategies"])
        assert "downloaded code" in body["guardrail"]
    finally:
        controls["stop"]()


def test_paper_calibration_uses_three_cost_aware_windows_and_tracks_history(monkeypatch):
    store = FakeStore()
    config = crypto_api._default_config()
    config.update({"mode": "paper", "paperLearningEnabled": True})
    store.put_artifact(
        "user-a", crypto_api.CONFIG_TYPE, crypto_api.PRIMARY_KEY,
        payload=config, idempotency_key="seed-paper-learning",
    )
    _, _, _, _, controls = make_api(monkeypatch, store=store)
    service = controls["service"]
    try:
        monkeypatch.setattr(crypto_api, "required_history_bars", lambda _config: 10)
        monkeypatch.setattr(
            crypto_api, "_repair_isolated_hourly_backtest_gaps",
            lambda rows: (list(rows), {"syntheticBars": 0}),
        )
        monkeypatch.setattr(
            service, "bars",
            lambda *_args, **_kwargs: list(range(10 + 60 * 24 * 3 + 4)),
        )

        def fake_backtest(_rows, candidate, **_kwargs):
            preferred = candidate["ema_fast"] == 12
            return {"metrics": {
                "total_return": 0.03 if preferred else 0.01,
                "sharpe": 1.5 if preferred else 0.5,
                "sortino": 1.8 if preferred else 0.6,
                "calmar": 1.2 if preferred else 0.4,
                "max_drawdown": -0.03,
                "trades": 3,
                "turnover": 0.4,
                "fees": 5.0,
            }}

        monkeypatch.setattr(crypto_api, "run_engine_backtest", fake_backtest)
        result = service.calibrate_paper_strategy("user-a", apply=True)
        report = result["calibration"]
        assert report["method"] == "three_60_day_walk_forward_windows_cost_aware"
        assert report["windowCount"] == 3
        assert len(report["candidates"]) == len(crypto_api.STRATEGY_RESEARCH_LIBRARY)
        assert all(len(candidate["windows"]) == 3 for candidate in report["candidates"])
        assert report["champion"] == "time_series_momentum"
        assert report["applied"] is True
        assert report["completedRuns"] == 1
        assert report["history"][0]["champion"] == "time_series_momentum"
        assert service.get_config("user-a")["strategy"]["ema_fast"] == 12
    finally:
        controls["stop"]()


def _prepare_cycle(service, monkeypatch, *, open_orders=None, enabled=False, symbols=None):
    config = crypto_api._default_config()
    config.update({"enabled": enabled, "aiReviewEnabled": False})
    if symbols:
        config["symbols"] = list(symbols)
        config["strategy"]["symbols"] = list(symbols)
        config["assetAllocationsPct"] = {
            symbol: config["assetAllocationsPct"].get(symbol, 8.0) for symbol in symbols
        }
    service.save_config("user-a", config, "cycle-config")
    monkeypatch.setattr(service, "account", lambda *_args: ({
        "status": "ACTIVE", "crypto_status": "ACTIVE",
        "equity": "10000", "cash": "10000", "non_marginable_buying_power": "10000",
    }, {"eligible": True, "cryptoStatus": "ACTIVE", "reasons": []}))
    monkeypatch.setattr(service, "positions", lambda *_args: [])
    monkeypatch.setattr(service, "open_orders", lambda *_args: deepcopy(open_orders or []))
    monkeypatch.setattr(service, "assets", lambda *_args: [
        {
            "symbol": symbol, "tradable": True, "strategySupported": True,
            "minOrderSize": "0.000000001", "minTradeIncrement": "0.000000001",
            "priceIncrement": "0.01",
        }
        for symbol in crypto_api.SUPPORTED_SYMBOLS
    ])
    monkeypatch.setattr(service, "snapshots", lambda *_args, **_kwargs: {
        symbol: {
            "symbol": symbol,
            "price": 50_000.0,
            "bid": 49_995.0,
            "ask": 50_005.0,
            "bidSize": 10.0,
            "askSize": 10.0,
            "spreadBps": 2.0,
            "quoteAsOf": crypto_api._iso(),
            "volume24h": 100_000.0,
            "dailyDollarVolume": 5_000_000_000.0,
            "askNotional": 500_050.0,
        }
        for symbol in crypto_api.SUPPORTED_SYMBOLS
    })
    monkeypatch.setattr(service, "bars", lambda *_args, **_kwargs: [{"t": "2026-07-18T00:00:00Z"}])
    monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
        "score": 82.0,
        "target_weight": 0.08,
        "price": 50_000.0,
        "allowed_actions": ["BUY", "ADD"],
        "reasons": ["test signal"],
        "risk": {"data_stale": False},
        "stop_distance_pct": 0.05,
    })
    return config


@pytest.mark.parametrize("dependency", ["position", "open_order", "pending_reconciliation"])
def test_config_cannot_remove_a_symbol_with_active_broker_or_reconciliation_state(
    monkeypatch,
    dependency,
):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        monkeypatch.setattr(service, "assets", lambda *_args: [
            {"symbol": symbol, "tradable": True, "strategySupported": True}
            for symbol in crypto_api.SUPPORTED_SYMBOLS
        ])
        positions = []
        open_orders = []
        if dependency == "position":
            positions = [{
                "symbol": "BTC/USD", "qty": 0.01, "marketValue": 500.0,
                "currentPrice": 50_000.0, "averageEntryPrice": 49_000.0,
                "side": "long",
            }]
        elif dependency == "open_order":
            open_orders = [{
                "id": "order-1", "clientOrderId": "external-order-1",
                "symbol": "BTC/USD", "side": "buy", "status": "accepted",
                "qty": 0.01, "remainingQty": 0.01,
            }]
        else:
            runtime = service.get_runtime("user-a")
            runtime["pendingReconciliations"] = {
                "alphalab-crypto-pending": {
                    "clientOrderId": "alphalab-crypto-pending",
                    "symbol": "BTC/USD",
                    "action": "BUY",
                    "submittedAt": crypto_api._iso(),
                },
            }
            service.save_runtime("user-a", runtime, "seed-pending-removal")
        monkeypatch.setattr(service, "positions", lambda *_args: deepcopy(positions))
        monkeypatch.setattr(service, "open_orders", lambda *_args: deepcopy(open_orders))

        response = client.put("/api/crypto/config", json={"symbols": ["ETH/USD"]})

        assert response.status_code == 409
        assert response.get_json()["reason"] == "symbol_in_use"
        assert "BTC/USD" in service.get_config("user-a")["symbols"]
    finally:
        controls["stop"]()


def test_config_symbol_removal_fails_closed_when_broker_state_cannot_be_read(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        monkeypatch.setattr(service, "assets", lambda *_args: [
            {"symbol": symbol, "tradable": True, "strategySupported": True}
            for symbol in crypto_api.SUPPORTED_SYMBOLS
        ])
        monkeypatch.setattr(
            service,
            "positions",
            lambda *_args: (_ for _ in ()).throw(
                crypto_api.BrokerError(
                    "positions unavailable", status=503, code="broker_unavailable",
                )
            ),
        )

        response = client.put("/api/crypto/config", json={"symbols": ["ETH/USD"]})

        assert response.status_code == 503
        assert response.get_json()["reason"] == "broker_unavailable"
        assert "BTC/USD" in service.get_config("user-a")["symbols"]
    finally:
        controls["stop"]()


def test_out_of_universe_position_is_managed_exit_only_and_cannot_be_added(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, symbols=["ETH/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "BTC/USD", "qty": 0.01, "marketValue": 500.0,
            "currentPrice": 50_000.0, "averageEntryPrice": 49_000.0,
            "side": "long",
        }])
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 95.0,
            "target_weight": 0.20,
            "price": 50_000.0,
            "allowed_actions": ["BUY", "ADD"],
            "reasons": ["bullish test signal"],
            "risk": {"data_stale": False},
            "stop_distance_pct": 0.05,
        })
        monkeypatch.setattr(
            service,
            "_submit_order",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(
                AssertionError("an exit-only position must never be increased")
            ),
        )

        result = service.run_cycle("user-a", source="manual", dry_run=True)

        btc = next(row for row in result["decisions"] if row["symbol"] == "BTC/USD")
        assert btc["exitOnly"] is True
        assert btc["action"] == "HOLD"
        assert btc["targetWeight"] <= btc["currentWeight"]
        assert "managed exit-only" in btc["reason"]
    finally:
        controls["stop"]()


def test_out_of_universe_position_routes_only_a_sell_when_exit_is_required(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    submitted = []
    try:
        _prepare_cycle(service, monkeypatch, symbols=["ETH/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "BTC/USD", "qty": 0.01, "marketValue": 500.0,
            "currentPrice": 50_000.0, "averageEntryPrice": 49_000.0,
            "side": "long",
        }])

        def exit_signal(_rows, _strategy, *, position, **_kwargs):
            held = float(position.get("weight") or 0)
            return {
                "score": 10.0,
                "target_weight": 0.0 if held > 0 else 0.0,
                "price": 50_000.0,
                "allowed_actions": ["EXIT"],
                "reasons": ["hard exit test signal"],
                "risk": {"data_stale": False},
                "stop_distance_pct": 0.05,
            }

        monkeypatch.setattr(crypto_api, "generate_signal", exit_signal)

        def fake_submit(_uid, _mode, payload):
            submitted.append(deepcopy(payload))
            return {
                "id": "exit-order-1",
                "client_order_id": payload["client_order_id"],
                "symbol": payload["symbol"],
                "side": payload["side"],
                "status": "accepted",
                "filled_qty": "0",
            }

        monkeypatch.setattr(service, "_submit_order", fake_submit)

        result = service.run_cycle("user-a", source="manual")

        btc = next(row for row in result["decisions"] if row["symbol"] == "BTC/USD")
        assert btc["exitOnly"] is True
        assert btc["action"] == "EXIT"
        assert len(submitted) == 1
        assert submitted[0]["symbol"] == "BTC/USD"
        assert submitted[0]["side"] == "sell"
    finally:
        controls["stop"]()


def test_out_of_universe_position_with_unknown_valuation_fails_closed(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, symbols=["ETH/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "BTC/USD", "qty": 0.01, "marketValue": 0.0,
            "currentPrice": 0.0, "averageEntryPrice": 49_000.0,
            "side": "long",
        }])

        with pytest.raises(crypto_api.CryptoApiError) as captured:
            service.run_cycle("user-a", source="manual", dry_run=True)

        assert captured.value.code == "position_valuation_unavailable"
    finally:
        controls["stop"]()


def test_open_order_reservation_prevents_gtc_order_stacking(monkeypatch):
    open_order = {
        "id": "open-1", "clientOrderId": "external-open-1", "symbol": "BTC/USD",
        "side": "buy", "remainingQty": 0.01, "notional": 500.0,
        "limitPrice": 50_000.0, "stopPrice": 0.0, "filledQty": 0.0,
        "filledAveragePrice": 0.0,
    }
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, open_orders=[open_order], symbols=["BTC/USD"])
        monkeypatch.setattr(
            service, "_submit_order",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("duplicate order submitted")),
        )

        result = service.run_cycle("user-a", source="manual")

        btc = next(row for row in result["decisions"] if row["symbol"] == "BTC/USD")
        assert btc["action"] == "HOLD"
        assert btc["order"] is None
        assert btc["openOrderReservation"]["count"] == 1
        assert btc["openOrderReservation"]["buyNotional"] == 500.0
        assert "no duplicate order" in btc["reason"]
    finally:
        controls["stop"]()


def test_each_order_rechecks_kill_switch_and_stops_running_cycle(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    submitted = []
    try:
        _prepare_cycle(service, monkeypatch)

        def submit(_uid, _mode, payload):
            submitted.append(dict(payload))
            config = service.get_config("user-a")
            config.update({"killSwitch": True, "enabled": False, "liveAuthorized": False})
            service.save_config("user-a", config, "activate-kill-mid-cycle")
            return {"id": "first-order", "status": "accepted"}

        monkeypatch.setattr(service, "_submit_order", submit)
        try:
            service.run_cycle("user-a", source="manual")
        except crypto_api.CryptoApiError as exc:
            assert exc.code == "kill_switch_active"
        else:
            raise AssertionError("cycle routed an order after the kill switch")
        assert len(submitted) == 1
    finally:
        controls["stop"]()


def test_each_scheduler_order_rechecks_stop_and_stops_running_cycle(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    submitted = []
    try:
        _prepare_cycle(service, monkeypatch, enabled=True)

        def submit(_uid, _mode, payload):
            submitted.append(dict(payload))
            config = service.get_config("user-a")
            config["enabled"] = False
            service.save_config("user-a", config, "stop-mid-cycle")
            return {"id": "first-order", "status": "accepted"}

        monkeypatch.setattr(service, "_submit_order", submit)
        try:
            service.run_cycle("user-a", source="scheduler")
        except crypto_api.CryptoApiError as exc:
            assert exc.code == "automation_stopped"
        else:
            raise AssertionError("scheduler routed an order after automation stopped")
        assert len(submitted) == 1
    finally:
        controls["stop"]()


def test_stop_limit_contract_uses_asset_precision_and_valid_price_relationship(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    asset = {
        "minOrderSize": "0.0001", "minTradeIncrement": "0.0001", "priceIncrement": "5",
    }
    config = crypto_api._default_config()
    config["order"] = {
        "type": "stop_limit", "timeInForce": "gtc",
        "limitOffsetBps": 5, "stopOffsetBps": 10,
    }
    try:
        buy = service._build_order(
            config, symbol="BTC/USD", action="BUY", price=50_000,
            notional=123.456, client_order_id="precision-buy", asset=asset,
        )
        sell = service._build_order(
            config, symbol="BTC/USD", action="EXIT", price=50_000,
            qty=0.00249, client_order_id="precision-sell", asset=asset,
        )

        assert float(buy["limit_price"]) >= float(buy["stop_price"])
        assert float(sell["limit_price"]) <= float(sell["stop_price"])
        assert all(float(order[field]) % 5 == 0 for order in (buy, sell) for field in ("limit_price", "stop_price"))
        assert buy["qty"] == "0.0024"
        assert sell["qty"] == "0.0024"
        assert all(len(value.partition(".")[2]) <= 9 for value in (buy["qty"], sell["qty"]))
    finally:
        controls["stop"]()


def test_untrusted_alpaca_trading_origin_is_rejected_before_request(monkeypatch):
    calls = []
    resolver = lambda *_args: {
        "api_key": "key", "api_secret": "secret", "base_url": "http://127.0.0.1:8888",
    }
    monkeypatch.setattr(crypto_api.requests, "request", lambda *args, **kwargs: calls.append((args, kwargs)))
    _, _, _, _, controls = make_api(monkeypatch, resolver=resolver)
    try:
        try:
            controls["service"]._broker_config("user-a", "paper")
        except crypto_api.CryptoApiError as exc:
            assert exc.code == "untrusted_broker_base_url"
        else:
            raise AssertionError("untrusted Alpaca origin was accepted")
        assert calls == []
    finally:
        controls["stop"]()


def test_live_release_gate_defaults_to_paper_only_and_account_gate_still_applies(monkeypatch):
    monkeypatch.delenv("CRYPTO_LIVE_RELEASE_ADMITTED", raising=False)
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    account_calls = []
    try:
        monkeypatch.setattr(service, "account", lambda *_args: account_calls.append(True) or ({}, {
            "eligible": True, "cryptoStatus": "ACTIVE", "reasons": [],
        }))
        denied = client.put("/api/crypto/config", json={
            "mode": "live", "liveAuthorized": True, "confirmLiveRisk": True,
        })
        assert denied.status_code == 403
        assert denied.get_json()["reason"] == "strategy_not_admitted"
        assert account_calls == []

        monkeypatch.setenv("CRYPTO_LIVE_RELEASE_ADMITTED", "true")
        monkeypatch.setattr(service, "account", lambda *_args: ({}, {
            "eligible": False, "cryptoStatus": "INACTIVE", "reasons": ["crypto_status_not_active"],
        }))
        inactive = client.put("/api/crypto/config", json={
            "mode": "live", "liveAuthorized": True, "confirmLiveRisk": True,
        })
        assert inactive.status_code == 409
        assert inactive.get_json()["reason"] == "crypto_account_ineligible"

        monkeypatch.setattr(service, "account", lambda *_args: ({}, {
            "eligible": True, "cryptoStatus": "ACTIVE", "reasons": [],
        }))
        admitted = client.put("/api/crypto/config", json={
            "mode": "live", "liveAuthorized": True, "confirmLiveRisk": True,
        })
        assert admitted.status_code == 200
        assert admitted.get_json()["config"]["liveAuthorized"] is True

        monkeypatch.setenv("CRYPTO_LIVE_RELEASE_ADMITTED", "false")
        run = client.post("/api/crypto/run-cycle", json={"mode": "live"})
        assert run.status_code == 403
        assert run.get_json()["reason"] == "strategy_not_admitted"
        monkeypatch.setattr(service, "positions", lambda *_args: [])
        monkeypatch.setattr(service, "snapshots", lambda *_args: {})
        overview = client.get("/api/crypto/overview?mode=live")
        assert overview.status_code == 200
        assert overview.get_json()["liveAdmission"]["admitted"] is False
    finally:
        controls["stop"]()


def test_dry_run_does_not_claim_scheduler_bucket(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, enabled=True)
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 40.0, "target_weight": 0.0, "price": 50_000.0,
            "allowed_actions": [], "reasons": ["hold"], "risk": {"data_stale": False},
        })

        result = service.run_cycle("user-a", source="manual", dry_run=True)
        runtime = service.get_runtime("user-a")

        assert result["success"] is True
        assert runtime["lastRunBucket"] is None
        assert runtime["lastRun"] is None
        assert runtime["lastDryRun"]
    finally:
        controls["stop"]()


def test_cycle_lock_is_stable_and_shared_by_manual_and_scheduler(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        original = service._user_lock("user-a")
        assert original.acquire(blocking=False)
        for index in range(crypto_api.MAX_SCHEDULER_USERS + 50):
            service._user_lock(f"other-{index}")
        assert service._user_lock("user-a") is original
        try:
            service.run_cycle("user-a", source="scheduler")
        except crypto_api.CryptoApiError as exc:
            assert exc.code == "cycle_in_progress"
        else:
            raise AssertionError("manual/scheduler cycle lock was not shared")
        original.release()

        monkeypatch.setattr(service, "get_config_snapshot", lambda _uid: (_ for _ in ()).throw(RuntimeError("db down")))
        try:
            service.run_cycle("user-a", source="manual")
        except RuntimeError:
            pass
        else:
            raise AssertionError("config read failure did not propagate")
        assert original.acquire(blocking=False)
        original.release()
    finally:
        controls["stop"]()


def test_recent_bars_cache_key_is_stable_and_avoids_duplicate_fetch(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    calls = []
    try:
        monkeypatch.setattr(
            crypto_api, "_utc_now",
            lambda: crypto_api.datetime(2026, 7, 18, 2, 0, tzinfo=crypto_api.timezone.utc),
        )
        monkeypatch.setattr(service, "_data_config", lambda *_args: {"api_key": "key", "api_secret": "secret"})

        def request_json(*_args, **_kwargs):
            calls.append(True)
            return {"bars": {"BTC/USD": [
                {"t": "2026-07-18T00:00:00Z", "o": 1, "h": 2, "l": 1, "c": 2, "v": 3},
                {"t": "2026-07-18T01:00:00Z", "o": 2, "h": 3, "l": 2, "c": 3, "v": 4},
            ]}}

        monkeypatch.setattr(crypto_api, "_request_json", request_json)
        first = service.bars("cache-user", "paper", "BTC/USD", timeframe="1Hour", limit=2)
        second = service.bars("cache-user", "paper", "BTC/USD", timeframe="1Hour", limit=2)
        assert first == second
        assert len(calls) == 1
        assert isinstance(second, tuple)
    finally:
        controls["stop"]()


def test_recent_bars_fetch_newest_rows_and_follow_short_pages(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    calls = []
    now = datetime(2026, 7, 20, 12, 30, tzinfo=timezone.utc)
    try:
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "_data_config", lambda *_args: {"api_key": "key", "api_secret": "secret"})

        def request_json(*_args, **kwargs):
            params = dict(kwargs["params"])
            calls.append(params)
            if not params.get("page_token"):
                return {
                    "bars": {"BTC/USD": [
                        {"t": "2026-07-20T11:00:00Z", "o": 4, "h": 5, "l": 4, "c": 5, "v": 5},
                    ]},
                    "next_page_token": "older-page",
                }
            return {
                "bars": {"BTC/USD": [
                    {"t": "2026-07-20T10:00:00Z", "o": 3, "h": 4, "l": 3, "c": 4, "v": 4},
                    {"t": "2026-07-20T09:00:00Z", "o": 2, "h": 3, "l": 2, "c": 3, "v": 3},
                ]},
            }

        monkeypatch.setattr(crypto_api, "_request_json", request_json)
        rows = service.bars("recent-user", "paper", "BTC/USD", timeframe="1Hour", limit=3)

        assert calls[0]["sort"] == "desc"
        assert calls[1]["page_token"] == "older-page"
        assert [row["t"] for row in rows] == [
            "2026-07-20T09:00:00Z",
            "2026-07-20T10:00:00Z",
            "2026-07-20T11:00:00Z",
        ]
    finally:
        controls["stop"]()


def test_explicit_backtest_window_remains_ascending(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    calls = []
    try:
        monkeypatch.setattr(service, "_data_config", lambda *_args: {"api_key": "key", "api_secret": "secret"})

        def request_json(*_args, **kwargs):
            calls.append(dict(kwargs["params"]))
            return {"bars": {"BTC/USD": [
                {"t": "2026-07-19T00:00:00Z", "o": 1, "h": 2, "l": 1, "c": 2, "v": 3},
                {"t": "2026-07-19T01:00:00Z", "o": 2, "h": 3, "l": 2, "c": 3, "v": 4},
            ]}}

        monkeypatch.setattr(crypto_api, "_request_json", request_json)
        service.bars(
            "window-user", "paper", "BTC/USD", timeframe="1Hour", limit=2,
            start="2026-07-19T00:00:00Z", end="2026-07-19T02:00:00Z",
        )
        assert calls[0]["sort"] == "asc"
    finally:
        controls["stop"]()


def test_backtest_repairs_an_isolated_hourly_gap_with_disclosed_flat_bar():
    rows = [
        {"t": "2026-07-20T10:00:00+00:00", "o": 100, "h": 102, "l": 99, "c": 101, "v": 8},
        {"t": "2026-07-20T12:00:00+00:00", "o": 103, "h": 104, "l": 102, "c": 103, "v": 9},
    ]

    repaired, quality = crypto_api._repair_isolated_hourly_backtest_gaps(rows)

    assert len(repaired) == 3
    assert repaired[1] == {
        "t": "2026-07-20T11:00:00+00:00",
        "o": 101.0,
        "h": 101.0,
        "l": 101.0,
        "c": 101.0,
        "v": 0.0,
        "synthetic": True,
    }
    assert quality["sourceBars"] == 2
    assert quality["syntheticBars"] == 1
    assert quality["repairedGaps"][0]["missingBars"] == 1


def test_backtest_rejects_a_market_data_outage_larger_than_repair_limit():
    rows = [
        {"t": "2026-07-20T10:00:00+00:00", "c": 101},
        {"t": "2026-07-20T15:00:00+00:00", "c": 105},
    ]

    with pytest.raises(crypto_api.CryptoApiError) as error:
        crypto_api._repair_isolated_hourly_backtest_gaps(rows)

    assert error.value.code == "incomplete_backtest_history"


def test_long_term_strategy_rejects_subhour_scheduler_intervals(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        response = client.put("/api/crypto/config", json={"intervalMinutes": 30})
        assert response.status_code == 400
        assert response.get_json()["reason"] == "invalid_config"
    finally:
        controls["stop"]()


def test_short_term_strategy_allows_fifteen_minute_scheduler(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        response = client.put("/api/crypto/config", json={"tradeHorizon": "short"})
        assert response.status_code == 200
        config = response.get_json()["config"]
        assert config["tradeHorizon"] == "short"
        assert config["intervalMinutes"] == 15
        assert config["strategy"]["bars_per_day"] == 96
        assert config["strategy"]["data_stale_minutes"] == 25

        denied = client.put("/api/crypto/config", json={"tradeHorizon": "long", "intervalMinutes": 15})
        assert denied.status_code == 400
        assert denied.get_json()["reason"] == "invalid_config"
    finally:
        controls["stop"]()


def test_short_term_cycle_uses_fifteen_minute_bars(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    captured = {}
    try:
        config = _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        config.update({"tradeHorizon": "short", "intervalMinutes": 15})
        config["strategy"].update({
            "symbols": ["BTC/USD"], "bars_per_day": 96, "ema_fast": 12, "ema_slow": 48,
            "momentum_fast_days": 2, "momentum_slow_days": 7, "atr_hours": 16,
            "volatility_days": 3, "breakout_days": 2, "breakdown_days": 1,
            "entry_confirmation_bars": 1, "exit_confirmation_bars": 1,
            "data_stale_minutes": 25,
        })
        service.save_config("user-a", config, "short-cycle-config")

        def bars(_uid, _mode, _symbol, **kwargs):
            captured.update(kwargs)
            return [{"t": "2026-07-18T00:00:00Z"}]

        monkeypatch.setattr(service, "bars", bars)
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 40.0,
            "target_weight": 0.0,
            "price": 50_000.0,
            "allowed_actions": [],
            "reasons": ["hold"],
            "risk": {"data_stale": False},
        })
        service.run_cycle("user-a")
        assert captured["timeframe"] == "15Min"
        assert captured["limit"] >= crypto_api.required_history_bars(service.get_config("user-a")["strategy"])
    finally:
        controls["stop"]()


def test_scheduler_submits_at_most_two_users_and_never_duplicates_inflight_user(monkeypatch):
    monkeypatch.setenv("CRYPTO_SCHEDULER_WORKERS", "2")
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]

    class PendingFuture:
        def done(self):
            return False

    class RecordingExecutor:
        def __init__(self):
            self.submissions = []

        def submit(self, function, uid):
            self.submissions.append((function, uid))
            return PendingFuture()

        def shutdown(self, **_kwargs):
            return None

    real_executor = service._scheduler_executor
    recorder = RecordingExecutor()
    real_executor.shutdown(wait=True, cancel_futures=True)
    service._scheduler_executor = recorder
    monkeypatch.setattr(service, "_enumerate_enabled", lambda: ["user-a", "user-b", "user-c"])
    try:
        service._scheduler_scan()
        service._scheduler_scan()

        assert [uid for _, uid in recorder.submissions] == ["user-a", "user-b"]
        assert set(service._scheduler_futures) == {"user-a", "user-b"}
        assert service.runtime_snapshot()["inFlight"] == 2
    finally:
        controls["stop"]()


def test_recent_hourly_bars_exclude_the_still_open_candle(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    calls = []
    now = datetime(2026, 7, 18, 2, 30, tzinfo=timezone.utc)
    try:
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "_data_config", lambda *_args: {"api_key": "key", "api_secret": "secret"})

        def request_json(*_args, **kwargs):
            calls.append(dict(kwargs["params"]))
            return {"bars": {"BTC/USD": [
                {"t": "2026-07-18T00:00:00Z", "o": 1, "h": 2, "l": 1, "c": 2, "v": 3},
                {"t": "2026-07-18T01:00:00Z", "o": 2, "h": 3, "l": 2, "c": 3, "v": 4},
                {"t": "2026-07-18T02:00:00Z", "o": 3, "h": 4, "l": 3, "c": 4, "v": 5},
            ]}}

        monkeypatch.setattr(crypto_api, "_request_json", request_json)
        rows = service.bars("complete-hour-user", "paper", "BTC/USD", timeframe="1Hour", limit=2)
        assert [row["t"] for row in rows] == ["2026-07-18T00:00:00Z", "2026-07-18T01:00:00Z"]
        assert calls[0]["limit"] == 3
    finally:
        controls["stop"]()


def test_entry_gate_rejects_stale_wide_and_illiquid_quotes(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    now = datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc)
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "snapshots", lambda *_args, **_kwargs: {"BTC/USD": {
            "price": 50_000.0, "bid": 49_500.0, "ask": 50_500.0,
            "bidSize": 1.0, "askSize": 0.0001,
            "spreadBps": 200.0,
            "quoteAsOf": (now - timedelta(minutes=2)).isoformat(),
            "dailyDollarVolume": 1_000.0,
            "askNotional": 5.05,
        }})
        monkeypatch.setattr(
            service, "_submit_order",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unsafe quote routed")),
        )
        result = service.run_cycle("user-a")
        decision = result["decisions"][0]
        assert decision["action"] == "HOLD"
        assert set(decision["entryGate"]["reasons"]) >= {
            "stale_quote", "spread_too_wide", "insufficient_daily_liquidity",
            "insufficient_quote_depth",
        }
        assert decision["entryGate"]["requiredAskNotional"] == 700.0
    finally:
        controls["stop"]()


def test_entry_gate_warns_but_does_not_block_when_depth_is_unreported():
    now = datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc)
    gate = crypto_api._entry_market_gate(
        {
            "price": 50_000.0,
            "bid": 49_995.0,
            "ask": 50_005.0,
            "spreadBps": 2.0,
            "quoteAsOf": now.isoformat(),
            "dailyDollarVolume": 0,
            "askNotional": 0,
        },
        notional=700.0,
        minimum_notional=10.0,
        now=now,
    )

    assert gate["eligible"] is True
    assert gate["reasons"] == []
    assert set(gate["warnings"]) == {"daily_liquidity_unreported", "quote_depth_unreported"}


def test_public_decision_exposes_execution_diagnostics():
    public = crypto_api._decision_public({
        "payload": {
            "action": "BUY",
            "symbol": "BTC/USD",
            "targetWeight": 0.08,
            "currentWeight": 0.0,
            "filledWeight": 0.0,
            "dryRun": True,
            "entryGate": {"eligible": True, "reasons": [], "warnings": ["quote_depth_unreported"]},
            "entryCapacity": {"eligible": True, "availableNotional": 350.0, "minimumNotional": 10.0},
            "openOrderReservation": {"count": 0, "buyNotional": 0.0, "sellNotional": 0.0},
            "portfolioExposure": {"filledCryptoValue": 0.0, "pendingBuyValue": 0.0, "projectedCryptoValue": 350.0},
        },
        "created_at": "2026-07-18T12:00:00Z",
    })

    assert public["entryGate"]["eligible"] is True
    assert public["entryCapacity"]["availableNotional"] == 350.0
    assert public["openOrderReservation"]["count"] == 0
    assert public["portfolioExposure"]["projectedCryptoValue"] == 350.0
    assert public["dryRun"] is True


def test_current_broker_equity_is_used_by_same_cycle_risk_circuit(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    now = datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc)
    observed = {}
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        runtime = service.get_runtime("user-a")
        runtime["equityCurve"] = [{"time": (now - timedelta(hours=25)).isoformat(), "value": 10_000.0}]
        service.save_runtime("user-a", runtime, "seed-equity")
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "account", lambda *_args: ({
            "status": "ACTIVE", "crypto_status": "ACTIVE", "equity": "9800",
            "cash": "9800", "non_marginable_buying_power": "9800",
        }, {"eligible": True, "cryptoStatus": "ACTIVE", "reasons": []}))

        def signal(*_args, **kwargs):
            observed.update(kwargs["risk_state"])
            return {
                "score": 40.0, "target_weight": 0.0, "price": 50_000.0,
                "allowed_actions": [], "reasons": ["hold"], "risk": {"data_stale": False},
            }

        monkeypatch.setattr(crypto_api, "generate_signal", signal)
        service.run_cycle("user-a")
        assert observed["daily_return"] == pytest.approx(-0.02)
    finally:
        controls["stop"]()


def test_pending_buys_across_all_crypto_consume_headroom_and_sells_do_not_create_it(monkeypatch):
    open_orders = [
        {"id": "sol-buy", "symbol": "SOL/USD", "side": "buy", "notional": 600.0, "remainingQty": 0.0},
        {"id": "doge-sell", "symbol": "DOGE/USD", "side": "sell", "remainingQty": 1500.0, "limitPrice": 1.0},
    ]
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, open_orders=open_orders, symbols=["BTC/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "DOGE/USD", "qty": 1500.0, "marketValue": 1500.0,
            "currentPrice": 1.0, "averageEntryPrice": 0.8, "side": "long",
        }])
        monkeypatch.setattr(
            service, "_submit_order",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("exposure breach routed")),
        )
        decision = service.run_cycle("user-a")["decisions"][0]
        assert decision["action"] == "HOLD"
        assert decision["portfolioExposure"]["pendingBuyValue"] == 600.0
        assert decision["portfolioExposure"]["pendingSellValueIgnoredForHeadroom"] == 1500.0
        assert decision["portfolioExposure"]["projectedCryptoValue"] == 2100.0
    finally:
        controls["stop"]()


def test_config_lifecycle_fields_and_non_object_json_are_rejected(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        for payload in ({"enabled": True}, {"killSwitch": True}):
            response = client.put("/api/crypto/config", json=payload)
            assert response.status_code == 400
            assert response.get_json()["reason"] == "lifecycle_control_required"
        for body in ("[]", '"text"', "null"):
            response = client.post(
                "/api/crypto/run-cycle", data=body, content_type="application/json",
            )
            assert response.status_code == 400
            assert response.get_json()["reason"] == "invalid_json_object"
    finally:
        controls["stop"]()


def test_kill_switch_reason_is_durable_and_audited(monkeypatch):
    _, client, _, store, controls = make_api(monkeypatch)
    try:
        response = client.post("/api/crypto/kill-switch", json={
            "enabled": True, "reason": "operator observed reconciliation drift",
        })
        assert response.status_code == 200
        assert response.get_json()["runtime"]["killReason"] == "operator observed reconciliation drift"
        event = next(row for row in store.audit if row["event_type"] == "crypto_kill_switch_activated")
        assert event["payload"]["reason"] == "operator observed reconciliation drift"
    finally:
        controls["stop"]()


def test_runtime_exposes_in_progress_heartbeat_and_completed_progress(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    seen = {}
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])

        def bars(*_args, **_kwargs):
            seen.update(service.get_runtime("user-a"))
            return [{"t": "2026-07-18T00:00:00Z"}]

        monkeypatch.setattr(service, "bars", bars)
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 40.0, "target_weight": 0.0, "price": 50_000.0,
            "allowed_actions": [], "reasons": ["hold"], "risk": {"data_stale": False},
        })
        service.run_cycle("user-a")
        runtime = service.get_runtime("user-a")
        assert seen["status"] == "running"
        assert seen["lastHeartbeat"]
        assert seen["heartbeat"] == seen["lastHeartbeat"]
        assert seen["currentStage"] == "signals"
        assert isinstance(seen["progress"], int)
        assert 0 < seen["progress"] < 100
        assert seen["progressDetail"]["stage"] == "signals"
        assert seen["runId"]
        assert seen["message"]
        assert runtime["currentStage"] == "complete"
        assert runtime["progress"] == 100
        assert runtime["progressDetail"]["stage"] == "complete"
        assert runtime["lastCycleStartedAt"]
        assert runtime["cycleStartedAt"] is None
    finally:
        controls["stop"]()


def test_ledger_limit_applies_after_crypto_filtering_and_reports_effective_limit(monkeypatch):
    class TrackingStore(FakeStore):
        def __init__(self):
            super().__init__()
            self.pages = []

        def list_audit_page(self, user_id, *, offset=0, limit=50):
            self.pages.append((offset, limit))
            return super().list_audit_page(user_id, offset=offset, limit=limit)

    store = TrackingStore()
    for index in range(3):
        store.append_audit(
            "user-a", event_type="crypto_test", idempotency_key=f"crypto-{index}",
            actor="system", source="test", resource_type="crypto", resource_id="BTC/USD",
            payload={"index": index},
        )
    for index in range(20):
        store.append_audit(
            "user-a", event_type="stock_test", idempotency_key=f"stock-{index}",
            actor="system", source="test", resource_type="stock", resource_id="AAPL", payload={},
        )
    _, client, _, _, controls = make_api(monkeypatch, store=store)
    try:
        response = client.get("/api/crypto/ledger?limit=2")
        body = response.get_json()
        assert response.status_code == 200
        assert len(body["records"]) == 2
        assert body["limit"] == 2 and body["returnedCount"] == 2
        assert body["scannedRows"] == 23
        assert body["scannedPages"] == 1
        assert store.pages == [(0, crypto_api.LEDGER_PAGE_SIZE)]
    finally:
        controls["stop"]()


def test_dry_run_audit_and_decisions_do_not_claim_live_cycle_idempotency(monkeypatch):
    _, _, _, store, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, enabled=True, symbols=["BTC/USD"])
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 40.0, "target_weight": 0.0, "price": 50_000.0,
            "allowed_actions": [], "reasons": ["hold"], "risk": {"data_stale": False},
        })
        service.run_cycle("user-a", dry_run=True, idempotency_key="same-request")
        live = service.run_cycle("user-a", dry_run=False)
        assert live["idempotent"] is False
        events = {row["event_type"]: row["idempotency_key"] for row in store.audit}
        assert events["crypto_dry_run_completed"] != events["crypto_cycle_completed"]
        assert store.get_artifact("user-a", crypto_api.DECISION_TYPE, "latest:BTCUSD") is not None
    finally:
        controls["stop"]()


def test_scheduler_rotates_candidates_after_completed_futures(monkeypatch):
    monkeypatch.setenv("CRYPTO_SCHEDULER_WORKERS", "2")
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]

    class DoneFuture:
        def done(self): return True

    class RecordingExecutor:
        def __init__(self): self.submissions = []
        def submit(self, function, uid):
            self.submissions.append((function, uid))
            return DoneFuture()
        def shutdown(self, **_kwargs): return None

    real_executor = service._scheduler_executor
    recorder = RecordingExecutor()
    real_executor.shutdown(wait=True, cancel_futures=True)
    service._scheduler_executor = recorder
    monkeypatch.setattr(service, "_enumerate_enabled", lambda: [
        f"user-{index}" for index in range(service._scheduler_cursor, service._scheduler_cursor + 10)
    ])
    try:
        service._scheduler_scan()
        service._scheduler_scan()
        assert [uid for _, uid in recorder.submissions] == ["user-0", "user-1", "user-2", "user-3"]
        assert service.runtime_snapshot()["cursor"] == 4
    finally:
        controls["stop"]()


def test_manual_review_requires_explicit_start_acknowledgement_and_is_audited(monkeypatch):
    _, client, _, store, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        runtime = service.get_runtime("user-a")
        runtime["manualReviewRequired"] = True
        service.save_runtime("user-a", runtime, "manual-review")
        monkeypatch.setattr(service, "account", lambda *_args: ({}, {
            "eligible": True, "cryptoStatus": "ACTIVE", "reasons": [],
        }))
        monkeypatch.setattr(service, "runtime_snapshot", lambda: {
            "schedulerHealthy": True, "status": "healthy", "message": "Crypto scheduler is running.",
        })
        denied = client.post("/api/crypto/automation/start", json={})
        assert denied.status_code == 409
        assert denied.get_json()["reason"] == "risk_acknowledgement_required"
        started = client.post("/api/crypto/automation/start", json={"acknowledgeRisk": True})
        assert started.status_code == 200
        assert started.get_json()["runtime"]["manualReviewRequired"] is False
        assert any(row["event_type"] == "crypto_manual_risk_review_acknowledged" for row in store.audit)
    finally:
        controls["stop"]()


def test_seven_day_cooldown_is_persisted_as_a_fixed_non_sliding_latch(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    first_now = datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc)
    clock = {"now": first_now}
    try:
        _prepare_cycle(service, monkeypatch, enabled=True, symbols=["BTC/USD"])
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: clock["now"])
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 82.0, "target_weight": 0.08, "price": 50_000.0,
            "allowed_actions": ["BUY", "ADD"], "reasons": ["seven-day circuit"],
            "risk": {
                "data_stale": False, "cooldown_required": True,
                "cooldown_hours": 72, "manual_review_required": False,
            },
        })
        first = service.run_cycle("user-a")
        first_until = first["runtime"]["cooldownUntil"]
        assert first["decisions"][0]["action"] == "HOLD"
        assert first_until == (first_now + timedelta(hours=72)).isoformat()

        runtime = service.get_runtime("user-a")
        runtime["lastRunBucket"] = None
        service.save_runtime("user-a", runtime, "allow-second-cycle")
        clock["now"] = first_now + timedelta(hours=1)
        second = service.run_cycle("user-a")
        assert second["runtime"]["cooldownUntil"] == first_until
    finally:
        controls["stop"]()


def test_confirmed_fill_updates_and_persists_position_state(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        monkeypatch.setattr(crypto_api, "generate_signal", lambda *_args, **_kwargs: {
            "score": 82.0, "target_weight": 0.08, "price": 50_000.0,
            "allowed_actions": ["BUY", "ADD"], "reasons": ["entry"],
            "risk": {"data_stale": False}, "stop_distance_pct": 0.05,
            "position_state": {"last_add_price": None, "protective_stop": None},
        })
        monkeypatch.setattr(service, "_submit_order", lambda *_args, **_kwargs: {
            "id": "filled-1", "status": "filled", "filled_qty": "0.01",
            "filled_avg_price": "50000",
        })
        service.run_cycle("user-a")
        state = service.get_runtime("user-a")["positionState"]["BTC/USD"]
        assert state["last_add_price"] == 50_000.0
        assert state["protective_stop"] == 47_500.0
    finally:
        controls["stop"]()


def test_new_unfilled_market_order_preserves_stop_state_and_next_cycle_reserves_it(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    observed_states = []
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "BTC/USD", "qty": 0.02, "marketValue": 1000.0,
            "currentPrice": 50_000.0, "averageEntryPrice": 48_000.0, "side": "long",
        }])
        runtime = service.get_runtime("user-a")
        runtime["positionState"] = {"BTC/USD": {
            "last_add_price": 48_000.0, "protective_stop": 45_000.0,
        }}
        service.save_runtime("user-a", runtime, "seed-position-state")

        def signal(*_args, **kwargs):
            observed_states.append(dict(kwargs["position"]))
            return {
                "score": 85.0, "target_weight": 0.12, "price": 50_000.0,
                "allowed_actions": ["BUY", "ADD"], "reasons": ["add"],
                "risk": {"data_stale": False}, "stop_distance_pct": 0.05,
                "position_state": {"last_add_price": 48_000.0, "protective_stop": 45_000.0},
            }

        monkeypatch.setattr(crypto_api, "generate_signal", signal)
        monkeypatch.setattr(service, "_submit_order", lambda *_args, **_kwargs: {
            "id": "new-1", "status": "new", "filled_qty": "0", "filled_avg_price": None,
        })
        first = service.run_cycle("user-a")
        assert first["decisions"][0]["order"]["status"] == "new"
        assert first["runtime"]["positionState"]["BTC/USD"]["protective_stop"] == 45_000.0

        runtime = service.get_runtime("user-a")
        runtime["lastRunBucket"] = None
        service.save_runtime("user-a", runtime, "second-cycle")
        monkeypatch.setattr(service, "open_orders", lambda *_args: [{
            "id": "new-1", "clientOrderId": next(iter(runtime["pendingReconciliations"])),
            "symbol": "BTC/USD", "side": "buy", "remainingQty": 0.004,
            "notional": 200.0, "limitPrice": 0.0, "stopPrice": 0.0,
            "filledQty": 0.0, "filledAveragePrice": 0.0, "status": "new",
        }])
        monkeypatch.setattr(service, "recent_orders", lambda *_args, **_kwargs: [])
        second = service.run_cycle("user-a")
        assert second["decisions"][0]["action"] == "HOLD"
        assert second["runtime"]["positionState"]["BTC/USD"]["protective_stop"] == 45_000.0
        assert all(state["protective_stop"] == 45_000.0 for state in observed_states)
    finally:
        controls["stop"]()


def test_async_partial_and_final_fills_reconcile_cumulatively_once(monkeypatch):
    _, _, _, store, controls = make_api(monkeypatch)
    service = controls["service"]
    phase = {"value": 0}
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])

        def positions(*_args):
            if phase["value"] == 0:
                return []
            qty = 0.004 if phase["value"] == 1 else 0.01
            price = 50_000.0 if phase["value"] == 1 else 51_000.0
            return [{
                "symbol": "BTC/USD", "qty": qty, "marketValue": qty * price,
                "currentPrice": price, "averageEntryPrice": price, "side": "long",
            }]

        def signal(*_args, **_kwargs):
            target = {0: 0.08, 1: 0.02, 2: 0.051}[phase["value"]]
            return {
                "score": 85.0, "target_weight": target, "price": 50_000.0,
                "allowed_actions": ["BUY", "ADD"], "reasons": ["test"],
                "risk": {"data_stale": False}, "stop_distance_pct": 0.04,
            }

        monkeypatch.setattr(service, "positions", positions)
        monkeypatch.setattr(crypto_api, "generate_signal", signal)
        monkeypatch.setattr(service, "_submit_order", lambda *_args, **_kwargs: {
            "id": "async-1", "status": "accepted", "filled_qty": "0",
            "filled_avg_price": None,
        })
        first = service.run_cycle("user-a")
        pending = first["runtime"]["pendingReconciliations"]
        assert len(pending) == 1
        client_id = next(iter(pending))
        assert pending[client_id]["stopDistancePct"] == 0.04
        assert pending[client_id]["appliedFilledQty"] == 0.0
        assert first["runtime"]["positionState"]["BTC/USD"]["last_add_price"] is None

        def recent_orders(*_args, **_kwargs):
            filled_qty = 0.004 if phase["value"] == 1 else 0.01
            fill_price = 50_000.0 if phase["value"] == 1 else 51_000.0
            status = "partially_filled" if phase["value"] == 1 else "filled"
            return [{
                "id": "async-1", "clientOrderId": client_id,
                "symbol": "BTC/USD", "side": "buy", "type": "market",
                "timeInForce": "gtc", "status": status, "qty": 0.01,
                "filledQty": filled_qty, "remainingQty": max(0.0, 0.01 - filled_qty),
                "filledAveragePrice": fill_price, "assetClass": "crypto",
            }]

        monkeypatch.setattr(service, "recent_orders", recent_orders)
        phase["value"] = 1
        second = service.run_cycle("user-a")
        second_pending = second["runtime"]["pendingReconciliations"][client_id]
        assert second_pending["appliedFilledQty"] == pytest.approx(0.004)
        assert second["runtime"]["positionState"]["BTC/USD"] == {
            "last_add_price": 50_000.0,
            "protective_stop": 48_000.0,
        }

        phase["value"] = 2
        third = service.run_cycle("user-a")
        assert third["runtime"]["pendingReconciliations"] == {}
        assert third["runtime"]["positionState"]["BTC/USD"]["last_add_price"] == pytest.approx(
            51_666.6666667,
        )
        assert third["runtime"]["positionState"]["BTC/USD"]["protective_stop"] == pytest.approx(49_600.0)
        fill_events = [row for row in store.audit if row["event_type"] == "crypto_order_fill_reconciled"]
        assert [row["payload"]["cumulativeFilledQty"] for row in fill_events] == [0.004, 0.01]

        fourth = service.run_cycle("user-a")
        assert fourth["idempotent"] is True
        assert len([row for row in store.audit if row["event_type"] == "crypto_order_fill_reconciled"]) == 2
    finally:
        controls["stop"]()


def test_missing_buy_reconciliation_metadata_locks_and_cannot_be_acknowledged_away(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        _prepare_cycle(service, monkeypatch, enabled=True, symbols=["BTC/USD"])
        runtime = service.get_runtime("user-a")
        runtime["pendingReconciliations"] = {
            "alphalab-crypto-missing-stop": {
                "clientOrderId": "alphalab-crypto-missing-stop",
                "orderId": "order-1",
                "symbol": "BTC/USD",
                "action": "BUY",
                "stopDistancePct": None,
                "submittedAt": crypto_api._iso(),
                "positionStateBefore": {},
                "appliedFilledQty": 0.0,
                "appliedFilledNotional": 0.0,
            },
        }
        service.save_runtime("user-a", runtime, "missing-stop")
        monkeypatch.setattr(service, "recent_orders", lambda *_args, **_kwargs: [])
        with pytest.raises(crypto_api.CryptoApiError) as caught:
            service.run_cycle("user-a")
        assert caught.value.code == "reconciliation_required"
        locked = service.get_runtime("user-a")
        assert locked["locked"] is True
        assert locked["reconciliationRequired"] is True
        assert locked["currentStage"] == "reconciliation_required"

        start = client.post("/api/crypto/automation/start", json={"acknowledgeRisk": True})
        assert start.status_code == 423
        assert start.get_json()["reason"] == "reconciliation_required"
    finally:
        controls["stop"]()


def test_accepted_order_state_never_counts_reported_quantity_as_a_fill(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    client_id = "alphalab-crypto-accepted-qty"
    try:
        _prepare_cycle(service, monkeypatch, enabled=True, symbols=["BTC/USD"])
        monkeypatch.setattr(service, "positions", lambda *_args: [{
            "symbol": "BTC/USD", "qty": 0.01, "marketValue": 500.0,
            "currentPrice": 50_000.0, "averageEntryPrice": 50_000.0, "side": "long",
        }])
        runtime = service.get_runtime("user-a")
        runtime["pendingReconciliations"] = {
            client_id: {
                "clientOrderId": client_id,
                "orderId": "accepted-1",
                "symbol": "BTC/USD",
                "action": "BUY",
                "stopDistancePct": 0.05,
                "submittedAt": crypto_api._iso(),
                "positionStateBefore": {},
                "appliedFilledQty": 0.0,
                "appliedFilledNotional": 0.0,
            },
        }
        service.save_runtime("user-a", runtime, "accepted-with-qty")
        monkeypatch.setattr(service, "recent_orders", lambda *_args, **_kwargs: [{
            "id": "accepted-1", "clientOrderId": client_id,
            "symbol": "BTC/USD", "side": "buy", "status": "accepted",
            "qty": 0.01, "filledQty": 0.01, "remainingQty": 0.0,
            "filledAveragePrice": 50_000.0, "assetClass": "crypto",
        }])
        with pytest.raises(crypto_api.CryptoApiError) as caught:
            service.run_cycle("user-a")
        assert caught.value.code == "reconciliation_required"
        locked = service.get_runtime("user-a")
        assert locked["positionState"].get("BTC/USD") is None
        assert locked["reconciliationRequired"] is True
    finally:
        controls["stop"]()


def test_backtest_projects_saved_confidence_and_single_asset_exposure_mandates(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    captured = {}
    try:
        saved = client.put("/api/crypto/config", json={
            "minimumConfidence": 77,
            "maxTotalExposure": 0.09,
            "maxAssetExposurePct": 10,
            "assetAllocationsPct": {"BTC/USD": 7, "ETH/USD": 8},
        })
        assert saved.status_code == 200
        monkeypatch.setattr(service, "bars", lambda *_args, **_kwargs: [])

        def fake_backtest(rows, strategy, *, symbol, initial_capital):
            captured.update({
                "rows": rows, "strategy": deepcopy(strategy),
                "symbol": symbol, "initialCapital": initial_capital,
            })
            return {"timestamps": [], "equity_curve": [], "metrics": {"return": 0.0}}

        monkeypatch.setattr(crypto_api, "run_engine_backtest", fake_backtest)
        response = client.post("/api/crypto/backtest", json={
            "symbol": "BTC/USD",
            "strategy": {"entry_score": 10, "add_score": 20, "max_asset_weight": 0.9},
        })
        body = response.get_json()
        assert response.status_code == 200
        assert captured["strategy"]["symbols"] == ["BTC/USD"]
        assert captured["strategy"]["entry_score"] == 77
        assert captured["strategy"]["add_score"] >= 77
        assert captured["strategy"]["max_asset_weight"] == pytest.approx(0.07)
        constraints = body["result"]["executionConstraints"]
        assert constraints["applied"]["minimumConfidence"] == 77
        assert constraints["applied"]["singleAssetWeightCap"] == pytest.approx(0.07)
        assert {row["field"] for row in constraints["notSimulated"]} >= {
            "riskPerTradePct", "multiAssetAggregateExposure", "brokerOrderContract",
        }
        assert body["result"]["limitations"]
    finally:
        controls["stop"]()


def test_minimum_confidence_is_saved_into_engine_thresholds_and_used_by_cycle(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    captured = {}
    try:
        _prepare_cycle(service, monkeypatch, symbols=["BTC/USD"])
        saved = client.put("/api/crypto/config", json={"minimumConfidence": 88})
        config = saved.get_json()["config"]
        assert config["strategy"]["entry_score"] == 88
        assert config["strategy"]["add_score"] >= 88

        def signal(_rows, strategy, **_kwargs):
            captured.update(deepcopy(strategy))
            return {
                "score": 40.0, "target_weight": 0.0, "price": 50_000.0,
                "allowed_actions": [], "reasons": ["hold"], "risk": {"data_stale": False},
            }

        monkeypatch.setattr(crypto_api, "generate_signal", signal)
        service.run_cycle("user-a")
        assert captured["entry_score"] == 88
        assert captured["add_score"] >= 88
    finally:
        controls["stop"]()


def test_overview_separates_display_data_from_stale_execution_quotes(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    now = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)
    try:
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "_broker_config", lambda *_args: {})
        monkeypatch.setattr(service, "account", lambda *_args: (
            {"equity": "10000", "cash": "10000", "non_marginable_buying_power": "10000"},
            {"eligible": True, "cryptoStatus": "ACTIVE", "reasons": []},
        ))
        monkeypatch.setattr(service, "positions", lambda *_args: [])
        monkeypatch.setattr(service, "assets", lambda *_args: [
            {"symbol": "BTC/USD", "tradable": True},
            {"symbol": "ETH/USD", "tradable": True},
        ])
        monkeypatch.setattr(service, "snapshots", lambda *_args: {
            "BTC/USD": {
                "symbol": "BTC/USD", "price": 50_000, "bid": 49_995, "ask": 50_005,
                "quoteAsOf": now.isoformat(),
            },
            "ETH/USD": {
                "symbol": "ETH/USD", "price": 3_000, "bid": 2_999, "ask": 3_001,
                "quoteAsOf": (now - timedelta(minutes=5)).isoformat(),
            },
        })
        response = client.get("/api/crypto/overview")
        assets = {row["symbol"]: row for row in response.get_json()["assets"]}
        assert response.status_code == 200
        assert assets["BTC/USD"]["dataAvailable"] is True
        assert assets["BTC/USD"]["tradable"] is True
        assert assets["BTC/USD"]["reasons"] == []
        # A stale bid/ask must pause order routing without blanking the latest
        # valid market price and daily context in the workspace.
        assert assets["ETH/USD"]["dataAvailable"] is True
        assert assets["ETH/USD"]["marketDataAvailable"] is True
        assert assets["ETH/USD"]["executionReady"] is False
        assert assets["ETH/USD"]["tradable"] is False
        assert "quote_stale" in assets["ETH/USD"]["reasons"]

        monkeypatch.setattr(service, "snapshots", lambda *_args: {})
        missing = client.get("/api/crypto/overview").get_json()["assets"]
        assert all(row["dataAvailable"] is False and row["tradable"] is False for row in missing)
        assert all("price_unavailable" in row["reasons"] for row in missing)
    finally:
        controls["stop"]()


def test_overview_separates_market_data_from_broker_tradability(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    now = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)
    fresh_quotes = {
        "BTC/USD": {
            "symbol": "BTC/USD", "price": 50_000, "bid": 49_995, "ask": 50_005,
            "quoteAsOf": now.isoformat(),
        },
        "ETH/USD": {
            "symbol": "ETH/USD", "price": 3_000, "bid": 2_999, "ask": 3_001,
            "quoteAsOf": now.isoformat(),
        },
    }
    try:
        monkeypatch.setattr(crypto_api, "_utc_now", lambda: now)
        monkeypatch.setattr(service, "_broker_config", lambda *_args: {})
        monkeypatch.setattr(service, "account", lambda *_args: (
            {"equity": "10000", "cash": "10000"},
            {"eligible": True, "cryptoStatus": "ACTIVE", "reasons": []},
        ))
        monkeypatch.setattr(service, "positions", lambda *_args: [])
        monkeypatch.setattr(service, "snapshots", lambda *_args: fresh_quotes)
        monkeypatch.setattr(service, "assets", lambda *_args: [
            {"symbol": "BTC/USD", "tradable": True},
            {"symbol": "ETH/USD", "tradable": False},
        ])

        assets = {row["symbol"]: row for row in client.get("/api/crypto/overview").get_json()["assets"]}
        assert assets["BTC/USD"]["dataAvailable"] is True
        assert assets["BTC/USD"]["tradable"] is True
        assert assets["ETH/USD"]["dataAvailable"] is True
        assert assets["ETH/USD"]["tradable"] is False
        assert "asset_not_tradable" in assets["ETH/USD"]["tradabilityReasons"]

        # A quote is not a routing guarantee.  Missing/ambiguous broker
        # metadata must render as unknown, never as a green tradable state.
        monkeypatch.setattr(service, "assets", lambda *_args: [{"symbol": "BTC/USD"}])
        unknown = {row["symbol"]: row for row in client.get("/api/crypto/overview").get_json()["assets"]}
        assert unknown["BTC/USD"]["dataAvailable"] is True
        assert unknown["BTC/USD"]["tradable"] is None
        assert "broker_tradability_unknown" in unknown["BTC/USD"]["tradabilityReasons"]
        assert unknown["ETH/USD"]["tradable"] is None
        assert "asset_metadata_missing" in unknown["ETH/USD"]["tradabilityReasons"]

        monkeypatch.setattr(service, "assets", lambda *_args: [{"symbol": "BTC/USD", "tradable": True}])
        monkeypatch.setattr(service, "account", lambda *_args: (
            {"equity": "10000", "cash": "10000"},
            {"eligible": None, "cryptoStatus": "UNKNOWN", "reasons": []},
        ))
        eligibility_unknown = {
            row["symbol"]: row for row in client.get("/api/crypto/overview").get_json()["assets"]
        }
        assert eligibility_unknown["BTC/USD"]["tradable"] is None
        assert "account_eligibility_unknown" in eligibility_unknown["BTC/USD"]["tradabilityReasons"]
    finally:
        controls["stop"]()


def test_asset_catalog_does_not_coerce_missing_or_malformed_tradability_to_true(monkeypatch):
    _, _, _, _, controls = make_api(monkeypatch)
    service = controls["service"]
    try:
        monkeypatch.setattr(service, "_broker_config", lambda *_args: {
            "api_key": "key", "api_secret": "secret", "base_url": "https://paper-api.alpaca.markets",
        })
        monkeypatch.setattr(crypto_api, "_request_json", lambda *_args, **_kwargs: [
            {"symbol": "BTC/USD", "status": "active"},
            {"symbol": "ETH/USD", "status": "active", "tradable": "true"},
            {"symbol": "SOL/USD", "status": "active", "tradable": False},
        ])
        assets = {row["symbol"]: row for row in service.assets("asset-unknown-user", "paper")}
        assert assets["BTC/USD"]["tradable"] is None
        assert assets["ETH/USD"]["tradable"] is None
        assert assets["SOL/USD"]["tradable"] is False
    finally:
        controls["stop"]()


def test_ledger_paginates_past_two_hundred_unrelated_rows_with_a_hard_scan_bound(monkeypatch):
    class TrackingStore(FakeStore):
        def __init__(self):
            super().__init__()
            self.pages = []

        def list_audit_page(self, user_id, *, offset=0, limit=50):
            self.pages.append((offset, limit))
            return super().list_audit_page(user_id, offset=offset, limit=limit)

    store = TrackingStore()
    for index in range(3):
        store.append_audit(
            "user-a", event_type="crypto_old", idempotency_key=f"crypto-{index}",
            actor="system", source="test", resource_type="crypto", resource_id="BTC/USD",
            payload={"index": index},
        )
    for index in range(250):
        store.append_audit(
            "user-a", event_type="stock_new", idempotency_key=f"stock-{index}",
            actor="system", source="test", resource_type="stock", resource_id="AAPL", payload={},
        )
    _, client, _, _, controls = make_api(monkeypatch, store=store)
    try:
        response = client.get("/api/crypto/ledger?limit=3")
        body = response.get_json()
        assert response.status_code == 200
        assert len(body["records"]) == 3
        assert body["scannedRows"] == 253
        assert body["scannedPages"] == 3
        assert body["scanTruncated"] is False
        assert store.pages == [(0, 100), (100, 100), (200, 100)]
        assert body["scannedRows"] <= body["maxScannedRows"]
        assert body["scannedPages"] <= body["maxPages"]
    finally:
        controls["stop"]()


def test_runtime_endpoint_reports_scheduler_health_contract(monkeypatch):
    _, client, _, _, controls = make_api(monkeypatch)
    try:
        body = client.get("/api/crypto/runtime").get_json()
        assert body["scheduler"]["schedulerHealthy"] is False
        assert body["scheduler"]["status"] == "disabled"
        assert body["scheduler"]["message"]
        assert isinstance(body["runtime"]["progress"], int)
        for field in ("currentStage", "runId", "message", "heartbeat"):
            assert field in body["runtime"]
    finally:
        controls["stop"]()
