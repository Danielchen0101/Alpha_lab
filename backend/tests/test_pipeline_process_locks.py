import uuid

import pytest

import start_quant_backend as backend


@pytest.mark.skipif(backend._fcntl is None, reason="host file locks are unavailable")
def test_runtime_file_lock_is_exclusive_on_the_same_host():
    identity = "test-%s" % uuid.uuid4().hex
    first = backend._pa_acquire_runtime_file_lock("test", identity)
    try:
        assert first is not None
        assert backend._pa_acquire_runtime_file_lock("test", identity) is None
    finally:
        backend._pa_release_runtime_file_lock(first)

    second = backend._pa_acquire_runtime_file_lock("test", identity)
    try:
        assert second is not None
    finally:
        backend._pa_release_runtime_file_lock(second)


@pytest.mark.skipif(backend._fcntl is None, reason="host file locks are unavailable")
def test_user_run_reservation_holds_a_cross_process_lock():
    uid = "lock-user-%s" % uuid.uuid4().hex
    assert backend._pa_try_reserve_user_run(uid, "manual_exit_scan") is True
    try:
        competing = backend._pa_acquire_runtime_file_lock("pipeline-user", uid)
        assert competing is None
    finally:
        backend._pa_release_user_run(uid)

    after_release = backend._pa_acquire_runtime_file_lock("pipeline-user", uid)
    try:
        assert after_release is not None
    finally:
        backend._pa_release_runtime_file_lock(after_release)
