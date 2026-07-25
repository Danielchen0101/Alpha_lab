import json
import threading

from kalshi_reference_stream import KalshiReferenceStream


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
