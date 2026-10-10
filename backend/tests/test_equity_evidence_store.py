from copy import deepcopy

from equity_evidence_store import EquityEvidenceStore, fetch_broker_activities
from operations_store import OperationsStore, OperationsStoreUnavailable, OperationsVersionConflict
from tests.test_equity_ledger import CLOSE, NOW, evidence


def arguments(**changes):
    result = evidence(**changes)
    return result


def local_store(tmp_path):
    return OperationsStore(allow_local_fallback=True, fallback_path=tmp_path / "equity.json")


def test_restart_and_version_switch_do_not_clear_account_latch(tmp_path):
    adapter = EquityEvidenceStore(local_store(tmp_path))
    original = adapter.reconcile("owner", **arguments(snapshot={"as_of": NOW, "equity": 1700}))
    assert original["risk"]["drawdown_latched"]
    restarted = EquityEvidenceStore(local_store(tmp_path))
    state = restarted.reconcile("owner", **arguments(strategy_version="swing-v2"))
    assert state["risk"]["drawdown_latched"]
    assert not state["risk"]["entry_allowed"]
    assert state["durable_version"] > original["durable_version"]


def test_account_mode_and_user_isolation(tmp_path):
    adapter = EquityEvidenceStore(local_store(tmp_path))
    adapter.reconcile("owner", **arguments(snapshot={"as_of": NOW, "equity": 1700}))
    for user, changed in [("other", {}), ("owner", {"mode": "real"}), ("owner", {"account_id": "different"})]:
        assert adapter.reconcile(user, **arguments(**changed))["risk"]["entry_allowed"]


def test_replay_does_not_duplicate_durable_revision(tmp_path):
    adapter = EquityEvidenceStore(local_store(tmp_path))
    first = adapter.reconcile("owner", **arguments())
    second = adapter.reconcile("owner", **arguments())
    assert first == second


def test_unavailable_storage_never_grants_permission():
    adapter = EquityEvidenceStore(OperationsStore())
    result = adapter.reconcile("owner", **arguments())
    assert not result["risk"]["entry_allowed"]
    assert "store_unavailable" in result["risk"]["reasons"][0]


def test_failed_write_does_not_expose_healthy_in_memory_gate(tmp_path):
    store = local_store(tmp_path)
    def failed(*args, **kwargs):
        raise OperationsStoreUnavailable("write failed")
    store.put_artifact = failed
    result = EquityEvidenceStore(store).reconcile("owner", **arguments())
    assert not result["risk"]["entry_allowed"]


def test_read_requires_current_strategy_and_fresh_evidence(tmp_path):
    adapter = EquityEvidenceStore(local_store(tmp_path))
    adapter.reconcile("owner", **arguments())
    params = dict(account_id="account-a", mode="paper", strategy_version="swing-v1", now=NOW)
    assert adapter.read_risk("owner", **params)["entry_allowed"]
    assert not adapter.read_risk("owner", **{**params, "strategy_version": "missing"})["entry_allowed"]
    assert not adapter.read_risk("owner", **{**params, "now": "2026-10-09T20:00:00Z"})["entry_allowed"]


def test_cas_retry_preserves_concurrent_latch(tmp_path):
    store = local_store(tmp_path)
    adapter = EquityEvidenceStore(store)
    original_put = store.put_artifact
    attempted = []
    def conflicting(*args, **kwargs):
        if not attempted:
            attempted.append(True)
            store.put_artifact = original_put
            adapter.reconcile("owner", **arguments(snapshot={"as_of": NOW, "equity": 1700}))
            store.put_artifact = conflicting
            raise OperationsVersionConflict("other worker wrote a latch")
        return original_put(*args, **kwargs)
    store.put_artifact = conflicting
    result = adapter.reconcile("owner", **arguments())
    assert result["risk"]["drawdown_latched"]
    assert not result["risk"]["entry_allowed"]


def test_paginated_fetch_covers_all_types_and_retains_metadata():
    calls = []
    def get(params):
        calls.append(deepcopy(params))
        return (200, [{"id": "fill", "activity_type": "FILL"}, {"id": "withdrawal", "activity_type": "CSW"}]) if len(calls) == 1 else (200, [])
    result = fetch_broker_activities(get, as_of=NOW, page_size=2, costs_complete=True)
    assert result["coverage"]["complete"]
    assert result["coverage"]["pages"] == 2
    assert result["coverage"]["fetched_count"] == 2
    assert calls[1]["page_token"] == "withdrawal"
    assert "activity_types" not in calls[0]


def test_failed_second_page_is_not_complete_or_empty_history():
    calls = []
    def get(params):
        calls.append(params)
        return (200, [{"id": "first"}]) if len(calls) == 1 else (503, {"message": "unavailable"})
    result = fetch_broker_activities(get, as_of=NOW, page_size=1)
    assert result["activities"] == [{"id": "first"}]
    assert not result["coverage"]["complete"]
    assert not result["coverage"]["pagination_complete"]


def test_repeated_cursor_and_page_limit_fail_closed():
    for count, reason in [(5, "activity_cursor_repeated"), (1, "activity_page_limit")]:
        result = fetch_broker_activities(lambda p: (200, [{"id": "same"}]), as_of=NOW, page_size=1, max_pages=count)
        assert not result["coverage"]["complete"]
        assert result["coverage"]["error"] == reason


def test_empty_success_and_failed_request_are_distinct():
    empty = fetch_broker_activities(lambda p: (200, []), as_of=NOW)
    failed = fetch_broker_activities(lambda p: (401, {}), as_of=NOW)
    assert empty["coverage"]["complete"]
    assert not empty["coverage"]["costs_complete"]
    assert not failed["coverage"]["complete"]


def test_exception_diagnostics_do_not_contain_sensitive_messages():
    def failing(params):
        raise RuntimeError("credential must not be copied")
    result = fetch_broker_activities(failing, as_of=NOW)
    assert result["coverage"]["error"] == "activity_fetch_RuntimeError"
