import types

import pytest

import start_quant_backend as backend
from kalshi_api import _PaperRobotController


class _Response:
    def __init__(self, status_code, body=None, headers=None):
        self.status_code = status_code
        self._body = body
        self.headers = headers or {}

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def test_discord_delivery_waits_for_confirmation_and_retries_429(monkeypatch):
    calls = []
    responses = [
        _Response(429, {"retry_after": 0}),
        _Response(200, {"id": "discord-message-1"}),
    ]

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return responses.pop(0)

    monkeypatch.setattr(backend.requests, "post", post)
    monkeypatch.setattr(backend.time, "sleep", lambda _seconds: None)

    result = backend._discord_post_with_retry(
        "https://discord.com/api/webhooks/example/token",
        {"embeds": [{"title": "test"}]},
    )

    assert result == {
        "sent": True,
        "attempts": 2,
        "status": 200,
        "messageId": "discord-message-1",
    }
    assert len(calls) == 2
    assert calls[0][0].endswith("?wait=true")


def test_discord_delivery_does_not_retry_permanent_4xx(monkeypatch):
    calls = []
    monkeypatch.setattr(
        backend.requests,
        "post",
        lambda url, **kwargs: calls.append((url, kwargs)) or _Response(404),
    )

    result = backend._discord_post_with_retry(
        "https://discord.com/api/webhooks/example/token",
        {"embeds": [{"title": "test"}]},
    )

    assert result["sent"] is False
    assert result["reason"] == "discord_client_error"
    assert result["status"] == 404
    assert result["attempts"] == 1
    assert len(calls) == 1


def test_suffixed_order_stays_urgent_in_digest_mode(monkeypatch):
    monkeypatch.setattr(
        backend,
        "_pa_get_config",
        lambda _uid: {
            "preferences": {
                "notifications": {
                    "discord": True,
                    "tradeActivity": True,
                    "deliveryMode": "digest",
                    "quietHoursEnabled": True,
                    "quietStart": "00:00",
                    "quietEnd": "23:59",
                }
            }
        },
    )

    allowed, reason = backend._workspace_notification_allows(
        "user-1",
        "order_AAPL_buy",
        {"notificationScope": "equity", "symbol": "AAPL"},
    )

    assert allowed is True
    assert reason == ""


def test_mode_scope_toggle_blocks_only_selected_mode():
    config = {
        "notifyTradeActivity": True,
        "notifyKalshi": False,
        "notifyCrypto": True,
    }

    assert backend._discord_event_enabled(
        config,
        "order",
        {"notificationScope": "kalshi", "assetClass": "kalshi"},
    ) is False
    assert backend._discord_event_enabled(
        config,
        "order",
        {"notificationScope": "crypto", "assetClass": "crypto"},
    ) is True


def test_workspace_suppression_is_recorded_as_skipped(monkeypatch):
    captured = []
    fake_store = types.SimpleNamespace(
        append_notification=lambda user_id, **fields: captured.append((user_id, fields)) or fields
    )
    monkeypatch.setattr(backend, "operations_store", fake_store)

    backend._record_notification_delivery(
        "user-1",
        "cycle_digest",
        {"sent": False, "reason": "workspace_quiet_hours"},
        {"event_id": "quiet-1", "notificationScope": "research"},
    )

    assert captured[0][1]["status"] == "skipped"
    assert captured[0][1]["payload"]["_delivery"]["scope"] == "research"


def test_kalshi_paper_settlement_uses_actual_contract_financials():
    sent = []
    sink = types.SimpleNamespace(
        _notify=lambda user_id, event_type, payload: sent.append(
            (user_id, event_type, payload)
        )
    )
    settlement = {
        "settlement_id": "paper-settlement-1",
        "ticker": "KXBTC15M-26JUL251645-45",
        "market_result": "NO",
        "yes_count_fp": 0,
        "no_count_fp": 5,
        "revenue_dollars": 5.0,
        "yes_total_cost_dollars": 0.0,
        "no_total_cost_dollars": 3.114,
        "fee_cost_dollars": 0.0825,
        "settlement_fee_dollars": 0.0,
        "settled_time": "2026-07-25T20:45:00Z",
        "environment": "paper",
    }

    _PaperRobotController._notify_settlement(sink, "user-1", settlement)

    _, event_type, payload = sent[0]
    assert event_type == "settlement"
    assert payload["result"] == "NO"
    assert payload["outcome"] == "NO"
    assert payload["contracts"] == 5
    assert payload["pnl"] == pytest.approx(1.8035)

    embed = backend._discord_embed("settlement", {**payload, "_language": "zh-CN"})
    field_names = [field["name"] for field in embed["fields"]]
    assert "研究流程" not in field_names
    assert "合约" in field_names
    assert next(
        field["value"] for field in embed["fields"] if field["name"] == "净盈亏"
    ) == "+$1.8035"


class _ReadOnlyState:
    def __init__(self):
        self.reconcile_calls = 0

    def get(self, _user_id, environment=None):
        return {"strategy": {}, "config": {"executionMode": environment or "paper"}}

    def reconcile_settlements(self, *_args, **_kwargs):
        self.reconcile_calls += 1
        return {"strategy": {}}


class _ReadOnlyPaperAccounts:
    def open_tickers(self, _user_id):
        return ["KXBTC15M-READ-ONLY"]

    def portfolio(self, _user_id):
        return {
            "environment": "paper",
            "balance": {"balance": 10000, "portfolio_value": 0},
            "positions": [],
            "orders": [],
            "fills": [],
            "settlements": [],
        }


def test_kalshi_browser_portfolio_refresh_is_read_only():
    state = _ReadOnlyState()
    client = types.SimpleNamespace(
        market=lambda _ticker: (_ for _ in ()).throw(
            AssertionError("read-only refresh must not fetch-and-settle markets")
        )
    )
    controller = _PaperRobotController(
        client,
        state,
        _ReadOnlyPaperAccounts(),
        start_background=False,
    )

    result = controller.portfolio("user-1", mode="paper", mutate=False)

    assert result["environment"] == "paper"
    assert state.reconcile_calls == 0


class OperationsVersionConflict(RuntimeError):
    pass


def test_kalshi_version_conflict_alerts_only_after_threshold_and_recovers():
    sent = []
    fake = types.SimpleNamespace(
        _loop_error_counts={},
        _loop_alerted=set(),
        state=types.SimpleNamespace(
            error=lambda *_args, **_kwargs: (_ for _ in ()).throw(
                AssertionError("a version conflict must not overwrite robot state")
            )
        ),
        safe_print=lambda *_args, **_kwargs: None,
        _notify=lambda user_id, event_type, payload: sent.append(
            (user_id, event_type, payload)
        ),
    )

    for _ in range(2):
        _PaperRobotController._record_loop_failure(
            fake, "user-1", "btc15m", "paper", OperationsVersionConflict("changed")
        )
    assert sent == []

    _PaperRobotController._record_loop_failure(
        fake, "user-1", "btc15m", "paper", OperationsVersionConflict("changed")
    )
    assert sent[0][1] == "risk_alert"
    assert sent[0][2]["severity"] == "medium"
    assert "Artifact changed concurrently" not in sent[0][2]["reason"]

    _PaperRobotController._record_loop_success(fake, "user-1", "btc15m", "paper")
    assert sent[1][1] == "lifecycle"
    assert sent[1][2]["state"] == "recovered"


def test_crypto_cycle_digest_has_domain_specific_fields():
    embed = backend._discord_embed(
        "cycle_digest",
        {
            "_language": "zh-CN",
            "notificationScope": "crypto",
            "assetClass": "crypto",
            "mode": "paper",
            "processedSymbols": 4,
            "ordersSubmitted": 1,
            "decisionCounts": {"BUY": 1, "HOLD": 3},
            "durationSeconds": 2.5,
        },
    )

    names = [field["name"] for field in embed["fields"]]
    assert embed["title"] == "Crypto 周期已完成"
    assert "研究流程" not in names
    assert "已处理交易对" in names
