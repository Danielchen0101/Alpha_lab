import asyncio
import json
import sys
import threading
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from kalshi_reference_stream import (
    KalshiReferenceFeedError,
    KalshiReferenceStream,
    _connection_error_detail,
)


def _frame(data, *, average=None, samples=0):
    message = {
        "type": "cfbenchmarks_value",
        "seq": 17,
        "msg": {
            "index_id": "BRTI",
            "data": json.dumps({"value": data, "time": 1_756_000_000_000}),
            "received_at": 1_756_000_000_050,
            "avg_60s_data": {"value": data - 1},
        },
    }
    if average is not None:
        message["msg"]["last_60s_windowed_average_15min"] = {
            "value": average,
            "window_size": samples,
        }
    return message


def test_normalize_brti_tick_uses_raw_value_outside_final_window():
    sample = KalshiReferenceStream.normalize_message(_frame(64_123.5))

    assert sample["price"] == 64_123.5
    assert sample["rawPrice"] == 64_123.5
    assert sample["trailing60sAverage"] == 64_122.5
    assert sample["settlementWindowSamples"] == 0
    assert sample["isOfficialBrti"] is True


def test_normalize_brti_tick_estimates_unfinished_settlement_average():
    sample = KalshiReferenceStream.normalize_message(
        _frame(110.0, average=100.0, samples=30)
    )

    assert sample["price"] == 105.0
    assert sample["settlementWindowAverage"] == 100.0
    assert sample["settlementWindowProgress"] == 0.5


def test_normalize_brti_tick_rejects_other_channels_and_indices():
    assert KalshiReferenceStream.normalize_message({"type": "ticker", "msg": {}}) is None
    frame = _frame(100.0)
    frame["msg"]["index_id"] = "ETHUSD_RTI"
    assert KalshiReferenceStream.normalize_message(frame) is None


def test_rotated_credentials_stop_the_previous_stream(monkeypatch):
    class FakeThread:
        def __init__(self, *args, **kwargs):
            self.started = False

        def is_alive(self):
            return True

        def start(self):
            self.started = True

    stream = KalshiReferenceStream(
        connection_loader=lambda _user_id: {
            "production_api_key_id": "new-key",
            "production_private_key": "new-private-key",
        },
        header_factory=lambda *args: {},
    )
    old_stop = threading.Event()
    stream._entries["user-1"] = {
        "thread": FakeThread(),
        "stop": old_stop,
        "credentialTag": "old-credential-tag",
    }
    monkeypatch.setattr("kalshi_reference_stream.threading.Thread", FakeThread)

    stream.ensure("user-1")

    assert old_stop.is_set()
    assert stream._entries["user-1"]["thread"].started is True


def test_stream_lifecycle_disables_active_connections_and_can_reenable():
    stream = KalshiReferenceStream(
        connection_loader=lambda _user_id: {},
        header_factory=lambda *args: {},
        enabled=True,
    )
    stop = threading.Event()
    stream._entries["user-1"] = {"stop": stop}

    stream.set_enabled(False)
    assert stream.enabled is False
    assert stop.is_set()

    stream.set_enabled(True)
    assert stream.enabled is True


@pytest.mark.parametrize("source_time", [None, "invalid", 0, float("inf"), 1e100])
def test_invalid_source_time_does_not_become_fresh_receipt_time(source_time):
    frame = _frame(100.0)
    frame["msg"]["data"] = json.dumps({"value": "100.0", "time": source_time})
    frame["msg"]["received_at"] = int(datetime.now(timezone.utc).timestamp() * 1000)

    assert KalshiReferenceStream.normalize_message(frame) is None


@pytest.mark.parametrize("raw", ["[]", "null", "42", "malformed"])
def test_non_object_upstream_frame_is_rejected(raw):
    frame = _frame(100.0)
    frame["msg"]["data"] = raw
    assert KalshiReferenceStream.normalize_message(frame) is None


@pytest.mark.parametrize(
    "source_age,cache_age,timestamp_override,error",
    [
        (0.5, 0.5, None, ""),
        (10.0, 0.1, None, "cfbenchmarks_source_stale"),
        (-10.0, 0.1, None, "cfbenchmarks_source_timestamp_future"),
        (0.1, 10.0, None, "cfbenchmarks_stream_stale"),
        (0.1, 0.1, "invalid", "cfbenchmarks_source_timestamp_invalid"),
        (0.1, 0.1, "2026-10-09T00:00:00", "cfbenchmarks_source_timestamp_invalid"),
    ],
)
def test_snapshot_and_status_share_source_and_cache_freshness(
    monkeypatch, source_age, cache_age, timestamp_override, error,
):
    stream = KalshiReferenceStream(connection_loader=lambda _: {}, header_factory=lambda *args: {})
    monkeypatch.setattr(stream, "ensure", lambda _: None)
    monkeypatch.setattr("kalshi_reference_stream.time.monotonic", lambda: 100.0)
    timestamp = timestamp_override or (
        datetime.now(timezone.utc) - timedelta(seconds=source_age)
    ).isoformat()
    stream._entries["user-1"] = {
        "sample": {"timestamp": timestamp, "price": 100.0, "rawPrice": 100.0},
        "sampleMonotonic": 100.0 - cache_age,
        "status": "live",
    }

    snapshot = stream.snapshot("user-1")
    status = stream.status("user-1")

    assert status["fresh"] is (not error)
    assert status["freshnessError"] == error
    assert (snapshot is not None) is (not error)
    if not error:
        assert snapshot["sourceAgeSeconds"] < 1.0


def test_subscription_error_retains_safe_access_diagnostic(monkeypatch):
    sent = []

    class Websocket:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def send(self, payload):
            sent.append(json.loads(payload))

        async def recv(self):
            return json.dumps({
                "type": "error",
                "msg": {"code": 9, "msg": "Missing entitlement for key PRIVATE-SECRET"},
            })

    monkeypatch.setitem(sys.modules, "websockets", SimpleNamespace(connect=lambda *args, **kwargs: Websocket()))
    stream = KalshiReferenceStream(connection_loader=lambda _: {}, header_factory=lambda *args: {})
    stream._entries["user-1"] = {}

    with pytest.raises(KalshiReferenceFeedError) as error:
        asyncio.run(stream._consume("user-1", "key", "private", threading.Event()))

    assert str(error.value) == "cfbenchmarks_access_denied:code_9"
    assert sent[0]["params"] == {"channels": ["cfbenchmarks_value"], "index_ids": ["BRTI"]}


@pytest.mark.parametrize(
    "http_status,expected",
    [
        (401, "authentication_failed"),
        (403, "access_denied"),
        (429, "rate_limited"),
        (503, "upstream_unavailable"),
    ],
)
def test_connection_errors_preserve_http_status_without_raw_response(http_status, expected):
    error = RuntimeError("PRIVATE-SECRET upstream details")
    error.response = SimpleNamespace(status_code=http_status)
    assert _connection_error_detail(error) == f"cfbenchmarks_{expected}:http_{http_status}"


def test_reconnect_status_and_log_preserve_safe_error(monkeypatch):
    logs = []
    stream = KalshiReferenceStream(
        connection_loader=lambda _: {}, header_factory=lambda *args: {}, safe_print=logs.append,
    )
    stream._entries["user-1"] = {}

    async def fail(*args):
        raise KalshiReferenceFeedError("cfbenchmarks_access_denied:code_9")

    monkeypatch.setattr(stream, "_consume", fail)
    stream._thread_main(
        "user-1", "key", "private", SimpleNamespace(is_set=lambda: False, wait=lambda _: True),
    )

    assert stream._entries["user-1"]["lastError"] == "cfbenchmarks_access_denied:code_9"
    assert "cfbenchmarks_access_denied:code_9" in logs[0]
