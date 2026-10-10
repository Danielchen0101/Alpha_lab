from copy import deepcopy

import pytest

from equity_ledger import EquityEvidenceError, normalize_activities, reconcile_equity_evidence


CLOSE = "2026-10-08T20:00:00Z"
NOW = "2026-10-09T19:00:00Z"


def evidence(**overrides):
    values = dict(account_id="account-a", mode="paper", strategy_version="swing-v1",
                  snapshot={"as_of": NOW, "equity": 2000}, activities=[],
                  coverage={"complete": True, "pagination_complete": True, "full_history": True,
                            "as_of": NOW, "costs_complete": True},
                  equity_history=[{"as_of": CLOSE, "equity": 2000}],
                  opening_equity=2000, external_operating_costs=0)
    values.update(overrides)
    return values


def flow(identity="withdrawal", amount=-80, **extra):
    return {"id": identity, "activity_type": "CSW" if amount < 0 else "CSD",
            "effective_at": "2026-10-09T16:00:00Z", "net_amount": str(amount), **extra}


def fill(identity, side, qty, price, **extra):
    return {"id": identity, "order_id": "order-" + identity, "activity_type": "FILL", "symbol": "SPY",
            "transaction_time": "2026-10-09T15:00:00Z", "side": side,
            "qty": str(qty), "price": str(price), **extra}


def test_2000_validation_baseline_is_not_account_profit():
    result = reconcile_equity_evidence(**evidence())
    assert result["risk"]["entry_allowed"]
    assert result["accounting"]["account_net_operating_pnl"] == 0
    assert result["twr_pct"] == 0


def test_withdrawal_is_not_loss_and_does_not_change_nav():
    result = reconcile_equity_evidence(**evidence(
        snapshot={"as_of": NOW, "equity": 1920},
        activities=[flow(equity_before=2000)],
    ))
    assert result["risk"]["entry_allowed"]
    assert result["risk"]["daily_pnl"] == 0
    assert result["risk"]["drawdown_pct"] == 0
    assert result["twr_pct"] == 0
    assert result["accounting"]["account_net_operating_pnl"] == 0


def test_observed_live_balance_cashflow_reconciliation():
    activities = [flow("deposit", 100, effective_at="2026-05-26T16:00:00Z"),
                  flow("withdrawal", -80, effective_at="2026-08-27T16:00:00Z"),
                  {"id": "fees", "activity_type": "FEE", "date": "2026-07-29", "net_amount": "-0.47"},
                  {"id": "dividend", "activity_type": "DIV", "date": "2026-08-20", "net_amount": "0.12"}]
    result = reconcile_equity_evidence(**evidence(mode="real", activities=activities, opening_equity=0,
        snapshot={"as_of": NOW, "equity": "18.11"}, equity_history=[{"as_of": CLOSE, "equity": "18.11"}]))
    assert result["accounting"]["account_net_operating_pnl"] == pytest.approx(-1.89)
    assert result["accounting"]["gross_operating_pnl"] == pytest.approx(-1.42)
    assert result["risk"]["daily_pnl"] == 0


def test_transfer_without_flow_valuation_is_unknown_not_fabricated_twr():
    result = reconcile_equity_evidence(**evidence(snapshot={"as_of": NOW, "equity": 1920}, activities=[flow()]))
    assert result["risk"]["daily_pnl"] == 0
    assert result["accounting"]["account_net_operating_pnl"] == 0
    assert result["twr_pct"] is None
    assert not result["risk"]["entry_allowed"]
    assert "cashflow_valuation_missing" in result["risk"]["reasons"]


def test_date_only_cashflow_does_not_claim_daily_loss_or_exact_return():
    activity = flow()
    activity.pop("effective_at")
    activity["date"] = "2026-10-09"
    result = reconcile_equity_evidence(**evidence(snapshot={"as_of": NOW, "equity": 1920}, activities=[activity]))
    assert result["risk"]["daily_pnl"] is None
    assert result["accounting"]["account_net_operating_pnl"] == 0
    assert "cashflow_timing_unknown" in result["risk"]["reasons"]


def test_exact_twr_links_subperiods_at_cash_flow_marks():
    # 10% gain before a deposit; another 10% afterwards => 21% TWR.
    result = reconcile_equity_evidence(**evidence(snapshot={"as_of": NOW, "equity": 3520},
        activities=[flow(amount=1000, equity_before=2200)]))
    assert result["twr_pct"] == pytest.approx(21)
    assert result["risk"]["daily_pnl"] == 520


def test_12_percent_latch_survives_recovery_deposit_and_strategy_change():
    breached = reconcile_equity_evidence(**evidence(snapshot={"as_of": NOW, "equity": 1760}))
    assert breached["risk"]["drawdown_latched"]
    original = breached["risk"]["latched_at"]
    later = "2026-10-09T19:30:00Z"
    recovered = reconcile_equity_evidence(breached, **evidence(
        strategy_version="swing-v2", snapshot={"as_of": later, "equity": 3000},
        activities=[flow(amount=1000, effective_at="2026-10-09T19:15:00Z", equity_before=2000)],
        coverage={**evidence()["coverage"], "as_of": later}))
    assert recovered["risk"]["drawdown_latched"]
    assert recovered["risk"]["latched_at"] == original
    assert not recovered["risk"]["entry_allowed"]
    assert set(recovered["strategies"]) == {"swing-v1", "swing-v2"}


def test_historical_breach_latches_even_if_current_value_recovered():
    result = reconcile_equity_evidence(**evidence(equity_history=[
        {"as_of": CLOSE, "equity": 2000}, {"as_of": "2026-10-09T14:00:00Z", "equity": 1700}]))
    assert result["risk"]["drawdown_latched"]
    assert result["max_drawdown_pct"] == 15
    assert result["risk"]["drawdown_pct"] == 0


def test_daily_loss_limit_is_cashflow_adjusted():
    result = reconcile_equity_evidence(**evidence(snapshot={"as_of": NOW, "equity": 1880},
        activities=[flow(equity_before=1960)]))
    assert result["risk"]["daily_pnl"] == -40
    assert result["risk"]["daily_loss_pct"] == 2
    assert "daily_loss_limit" in result["risk"]["reasons"]
    assert not result["risk"]["drawdown_latched"]


@pytest.mark.parametrize("field", ["complete", "pagination_complete", "full_history", "costs_complete"])
def test_incomplete_fetch_never_becomes_zero_activity_or_permission(field):
    prior = reconcile_equity_evidence(**evidence(activities=[fill("buy", "buy", 1, 50)]))
    c = evidence()["coverage"]
    c[field] = False
    result = reconcile_equity_evidence(prior, **evidence(activities=[], coverage=c))
    assert not result["risk"]["entry_allowed"]
    assert not result["risk"]["complete"]
    assert "buy" in result["activities"]


def test_split_changes_inventory_not_cash_profit_and_replays_idempotently():
    activities = [fill("buy", "buy", 1, 90),
        {"id": "remove", "activity_type": "SPLIT", "date": "2026-10-09", "symbol": "SPY", "qty": -1},
        {"id": "add", "activity_type": "SPLIT", "date": "2026-10-09", "symbol": "SPY", "qty": 3},
        fill("sell", "sell", 3, 31)]
    first = reconcile_equity_evidence(**evidence(activities=activities, snapshot={"as_of": NOW, "equity": 2003}))
    replay = reconcile_equity_evidence(first, **evidence(activities=activities + [activities[0]], snapshot={"as_of": NOW, "equity": 2003}))
    assert first == replay
    assert replay["accounting"]["inventory_flat"]
    assert replay["accounting"]["gross_closed_book_pnl"] == 3


def test_sales_cashflow_is_not_pnl_with_open_inventory():
    result = reconcile_equity_evidence(**evidence(activities=[fill("buy", "buy", 1, 50)]))
    assert result["accounting"]["gross_fill_cashflow"] == -50
    assert result["accounting"]["gross_closed_book_pnl"] is None


def test_correction_recomputes_metrics_without_erasing_latch():
    transfer = flow(amount=100, effective_at="2026-10-07T14:00:00Z")
    prior = reconcile_equity_evidence(**evidence(activities=[transfer], snapshot={"as_of": NOW, "equity": 1760}))
    corrected = {**transfer, "net_amount": "200"}
    result = reconcile_equity_evidence(prior, **evidence(activities=[corrected], snapshot={"as_of": NOW, "equity": 2000}))
    assert result["risk"]["drawdown_latched"]
    assert result["accounting"]["external_cashflow"] == 200
    assert result["activities"]["withdrawal"]["amount"] == "200"


def test_canonical_deletion_requires_explicit_authoritative_replacement():
    prior = reconcile_equity_evidence(**evidence(activities=[fill("buy", "buy", 1, 50)]))
    missing = reconcile_equity_evidence(prior, **evidence())
    assert "activity_history_regressed" in missing["risk"]["reasons"]
    result = reconcile_equity_evidence(prior, **evidence(coverage={**evidence()["coverage"], "authoritative_replacement": True}))
    assert not result["activities"]


@pytest.mark.parametrize("change", [{"mode": "real"}, {"account_id": "account-b"}])
def test_scope_cannot_be_reused(change):
    prior = reconcile_equity_evidence(**evidence())
    with pytest.raises(EquityEvidenceError, match="scope"):
        reconcile_equity_evidence(prior, **evidence(**change))


@pytest.mark.parametrize("activities", [[{"id": "x", "activity_type": "UNKNOWN", "date": "2026-10-09"}],
    [{"id": "fee", "activity_type": "FEE", "date": "2026-10-09"}],
    [fill("x", "buy", 1, "NaN")], [fill("x", "buy", 1, 50), fill("x", "buy", 1, 51)]])
def test_unknown_or_malformed_evidence_fails_closed(activities):
    result = reconcile_equity_evidence(**evidence(activities=activities))
    assert not result["risk"]["entry_allowed"]
    assert not result["risk"]["complete"]


def test_journal_requires_explicit_external_classification():
    activity = {"id": "fund", "activity_type": "JNLC", "date": "2026-03-16", "net_amount": "100000"}
    with pytest.raises(EquityEvidenceError, match="classification"):
        normalize_activities([activity])
    assert normalize_activities([{**activity, "external_cashflow": True}])["fund"]["amount"] == "100000"


def test_attribution_and_external_costs_are_not_invented():
    acts = [fill("b", "buy", 1, 100), fill("s", "sell", 1, 110)]
    result = reconcile_equity_evidence(**evidence(activities=acts, snapshot={"as_of": NOW, "equity": 2010}, external_operating_costs=None))
    assert not result["accounting"]["strategy_attribution_known"]
    assert result["accounting"]["strategy_net_operating_pnl"] is None
    assert result["accounting"]["net_operating_profit"] is None
    known = reconcile_equity_evidence(**evidence(activities=acts, snapshot={"as_of": NOW, "equity": 2010}, external_operating_costs=2,
        order_attribution={"order-b": "swing-v1", "order-s": "swing-v1"}))
    assert known["accounting"]["strategy_net_operating_pnl"] == 8
    assert known["accounting"]["net_operating_profit"] == 8


def test_snapshot_and_activity_window_must_match():
    result = reconcile_equity_evidence(**evidence(coverage={**evidence()["coverage"], "as_of": CLOSE}))
    assert "activity_snapshot_time_mismatch" in result["risk"]["reasons"]


def test_no_previous_close_and_stale_close_are_not_daily_pnl():
    for marks in ([], [{"as_of": "2026-10-08T15:00:00Z", "equity": 2000}],
                  [{"as_of": "2026-09-01T20:00:00Z", "equity": 2000}]):
        result = reconcile_equity_evidence(**evidence(equity_history=marks))
        assert result["risk"]["daily_pnl"] is None
        assert not result["risk"]["entry_allowed"]


def test_risk_threshold_cannot_be_loosened_after_initialization():
    prior = reconcile_equity_evidence(**evidence())
    result = reconcile_equity_evidence(prior, **evidence(drawdown_limit_pct=15, snapshot={"as_of": NOW, "equity": 1740}))
    assert result["risk"]["drawdown_limit_pct"] == 12
    assert result["risk"]["drawdown_latched"]


def test_input_objects_are_not_mutated():
    args = evidence()
    copy = deepcopy(args)
    reconcile_equity_evidence(**args)
    assert args == copy
