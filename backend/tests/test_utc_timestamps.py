"""Regression tests for UTC timestamp helpers."""

from datetime import timezone

from start_quant_backend import _utc_now, _utc_now_iso_z, _utc_now_iso_z_seconds


def test_utc_now_is_timezone_aware():
    assert _utc_now().tzinfo is timezone.utc


def test_utc_timestamp_helpers_emit_z_suffix():
    assert _utc_now_iso_z().endswith('Z')

    seconds_timestamp = _utc_now_iso_z_seconds()
    assert seconds_timestamp.endswith('Z')
    assert '.' not in seconds_timestamp
