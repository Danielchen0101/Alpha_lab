import json

from kalshi_robot_state import KalshiRobotState


def test_decision_log_survives_process_restart(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    store = KalshiRobotState(str(path))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "signalQuality": 82,
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-TEST"},
        "edge": {"fairProbability": 0.62, "price": 0.53, "netEdge": 0.07},
    }, {"order_id": "order-1", "status": "filled", "fill_count": 1})

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["decisions"][0]["ticker"] == "KXBTC15M-TEST"
    assert restored["decisions"][0]["fairProbability"] == 0.62


def test_robot_state_restores_from_durable_user_store_without_local_file(tmp_path):
    durable = {}

    def load(user_id):
        return durable.get(user_id)

    def save(user_id, state):
        durable[user_id] = state

    store = KalshiRobotState(
        str(tmp_path / "ignored-local-state.json"),
        state_loader=load,
        state_saver=save,
        enabled_users_loader=lambda: ["user-1"] if durable.get("user-1", {}).get("enabled") else [],
    )
    store.configure("user-1", True, {"executionMode": "paper"})

    restored = KalshiRobotState(
        str(tmp_path / "ignored-local-state.json"),
        state_loader=load,
        state_saver=save,
        enabled_users_loader=lambda: ["user-1"] if durable.get("user-1", {}).get("enabled") else [],
    )

    assert restored.get("user-1")["enabled"] is True
    assert restored.enabled_users() == ["user-1"]


def test_successful_cycle_clears_mode_local_transient_error(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.configure("user-1", True, {"executionMode": "paper"})
    store.error("user-1", "Artifact changed concurrently")

    state = store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "WAIT",
        "side": "YES",
        "blockingReasons": ["net_edge"],
        "config": {"executionMode": "paper"},
        "market": {"ticker": "KXBTC15M-TEST"},
        "edge": {"fairProbability": 0.60, "price": 0.65, "netEdge": -0.05},
    })

    assert state["lastError"] is None
    assert state["modeState"]["paper"]["lastError"] is None




def test_pre_v6_trade_and_learning_data_is_removed_during_upgrade(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    path.write_text(json.dumps({"user-1": {
        "storageVersion": 4,
        "enabled": True,
        "config": {"riskPerTradePct": 0.5, "minPrice": 0.12, "maxPrice": 0.88},
        "decisions": [{"ticker": "OLD"}],
        "filledTrades": [{"ticker": "OLD"}],
        "learningObservations": [{"ticker": "OLD"}],
        "learningExamples": [{"ticker": "OLD"}],
    }}), encoding="utf-8")

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["storageVersion"] == 9
    assert restored["enabled"] is True
    assert restored["decisions"] == []
    assert restored["filledTrades"] == []
    assert "learningObservations" not in restored
    assert "learningExamples" not in restored
    assert "strategyLibrary" not in restored
    # Old longshot-era tuning is replaced by the deterministic v4 favorite band.
    assert restored["config"]["minPrice"] == 0.47
    assert restored["config"]["maxPrice"] == 0.95
    assert restored["config"]["minModelProbability"] == 0.58


def test_v6_state_adopts_calibrated_defaults_without_losing_records(tmp_path):
    path = tmp_path / "kalshi-robot.json"
    path.write_text(json.dumps({"user-1": {
        "storageVersion": 6,
        "enabled": True,
        "config": {
            "executionMode": "paper",
            "minNetEdge": 0.015,
            "minModelProbability": 0.60,
        },
        "decisions": [{"ticker": "KXBTC15M-KEEP", "environment": "paper"}],
        "filledTrades": [{"ticker": "KXBTC15M-KEEP", "environment": "paper"}],
    }}), encoding="utf-8")

    restored = KalshiRobotState(str(path)).get("user-1")

    assert restored["storageVersion"] == 9
    assert restored["config"]["minNetEdge"] == 0.0075
    assert restored["config"]["minModelProbability"] == 0.58
    assert restored["config"]["marketBlendWeight"] == 0.45
    assert restored["config"]["probabilityLogitScale"] == 1.70
    assert restored["strategy"]["version"] == 6
    assert restored["decisions"][0]["ticker"] == "KXBTC15M-KEEP"
    assert restored["filledTrades"][0]["ticker"] == "KXBTC15M-KEEP"


def test_removed_learning_configuration_is_not_persisted(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    state = store.configure("user-1", True, {
        "executionMode": "paper",
        "learningMode": True,
        "learningAiMode": True,
        "learningExplorationRate": 0.9,
        "riskPerTradePct": 0.5,
    })

    assert state["config"]["riskPerTradePct"] == 0.5
    assert not any(key.startswith("learning") for key in state["config"])
    assert "learning" not in state["strategy"]


def test_settlement_calibration_is_idempotent(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-TEST"},
        "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
    })
    settlement = {"ticker": "KXBTC15M-TEST", "settled_time": "2026-07-21T00:15:00Z", "market_result": "yes"}

    first = store.reconcile_settlements("user-1", [settlement])
    second = store.reconcile_settlements("user-1", [settlement])

    assert first["strategy"]["settledSamples"] == 1
    assert first["strategy"]["winRate"] == 1.0
    assert second["strategy"]["settledSamples"] == 1


def test_settlement_record_exposes_weighted_entry_and_resolution_exit_prices(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    ticker = "KXBTC15M-PRICES"
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": ticker},
        "edge": {"fairProbability": 0.70, "price": 0.55},
    }, {"order_id": "price-order", "status": "filled", "fill_count": 10})
    settlement = {
        "ticker": ticker,
        "settled_time": "2026-07-21T00:15:00Z",
        "market_result": "yes",
        "yes_count_fp": 10,
        "no_count_fp": 0,
        "revenue_dollars": 10,
        "yes_total_cost_dollars": 5.5,
        "no_total_cost_dollars": 0,
        "fee_cost_dollars": 0.2,
    }
    fills = [{
        "ticker": ticker,
        "outcome_side": "YES",
        "count_fp": 10,
        "price_dollars": 0.55,
        "environment": "paper",
    }]

    state = store.reconcile_settlements("user-1", [settlement], fills)
    record = state["strategy"]["settlementRecords"][0]

    assert record["entryPrice"] == 0.55
    assert record["exitPrice"] == 1.0
    assert record["exitType"] == "settlement"












def test_only_filled_trades_enter_realized_win_rate(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "blockingReasons": [],
        "market": {"ticker": "KXBTC15M-NOFILL"},
        "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
    }, {"order_id": "order-no-fill", "status": "canceled", "fill_count": 0})

    state = store.reconcile_settlements("user-1", [{
        "ticker": "KXBTC15M-NOFILL",
        "settled_time": "2026-07-21T00:15:00Z",
        "market_result": "yes",
        "revenue_dollars": "1.00",
        "yes_total_cost_dollars": "0.55",
    }], [])

    assert state["strategy"]["settledSamples"] == 0
    assert state["strategy"]["settlementRecords"] == []


def test_decision_log_retains_compact_audit_history_and_filled_trade_evidence(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    for index in range(3):
        store.record("user-1", {
            "generatedAt": f"2026-07-21T00:0{index}:00Z",
            "action": "BUY_YES",
            "side": "YES",
            "blockingReasons": [],
            "market": {"ticker": f"KXBTC15M-{index}"},
            "edge": {"fairProbability": 0.70, "price": 0.55, "netEdge": 0.05},
        }, {"order_id": f"order-{index}", "status": "filled", "fill_count": 1})

    state = store.get("user-1")

    assert state["decisionLimit"] == 250
    assert len(state["decisions"]) == 3
    assert [row["ticker"] for row in state["decisions"]] == [
        "KXBTC15M-2", "KXBTC15M-1", "KXBTC15M-0",
    ]
    assert len(state["filledTrades"]) == 3
    assert state["tradedTickers"] == ["KXBTC15M-0", "KXBTC15M-1", "KXBTC15M-2"]


def test_filled_entry_and_exit_times_persist_with_decision_audit_history(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-TIMING"},
        "edge": {"price": 0.45},
    }, {"status": "filled", "fill_count": 2})
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:01:00Z",
        "action": "SELL_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-TIMING"},
        "edge": {"price": 0.55},
    }, {"status": "filled", "fill_count": 2})
    store.record("user-1", {
        "generatedAt": "2026-07-21T00:01:05Z",
        "action": "WAIT",
        "market": {"ticker": "KXBTC15M-TIMING"},
    })

    restored = KalshiRobotState(str(tmp_path / "state.json")).get("user-1")

    assert len(restored["decisions"]) == 3
    assert restored["strategy"]["lastEntryTicker"] == "KXBTC15M-TIMING"
    assert restored["strategy"]["lastEntryAt"] == "2026-07-21T00:00:00Z"
    assert restored["strategy"]["lastExitTicker"] == "KXBTC15M-TIMING"
    assert restored["strategy"]["lastExitAt"] == "2026-07-21T00:01:00Z"






















def test_early_close_pnl_is_tracked_without_becoming_calibration_label(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    decision = {
        "generatedAt": "2026-07-22T12:00:00Z",
        "action": "SELL_YES",
        "side": "YES",
        "executionIntent": "CLOSE_YES",
        "market": {"ticker": "KXBTC15M-CLOSE"},
        "exitAnalysis": {
            "averageEntryPrice": 0.40,
            "exitValueEdge": 0.03,
            "trigger": "fee_adjusted_take_profit",
            "netExitPnlPerContract": 0.136,
            "exitLossFraction": 0.0,
        },
    }
    order = {
        "order_id": "close-1",
        "ticker": "KXBTC15M-CLOSE",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "YES",
        "status": "executed",
        "fill_count_fp": 5,
        "average_price_dollars": 0.55,
        "entry_fee_allocated_dollars": 0.03,
        "fee_cost_dollars": 0.04,
        "realized_pnl_dollars": 0.68,
    }

    state = store.record_early_close("user-1", decision, order, environment="paper")
    strategy = state["strategy"]

    assert strategy["closedTradeSamples"] == 1
    assert strategy["closedTradeTotalPnl"] == 0.68
    assert strategy["closedTradeRecords"][0]["settlementLabel"] is None
    assert strategy["settlementRecords"] == []
    assert "learning" not in strategy
    assert strategy["realizedSamples"] == 1
    assert strategy["realizedTotalPnl"] == 0.68
    assert strategy["realizedTradeRecords"][0]["exitType"] == "sale"
    assert strategy["realizedTradeRecords"][0]["result"] is None
    assert strategy["realizedTradeRecords"][0]["exitTrigger"] == "fee_adjusted_take_profit"
    assert strategy["realizedTradeRecords"][0]["netExitPnlPerContract"] == 0.136
    assert strategy["realizedTradeRecords"][0]["exitLossFraction"] == 0.0
    assert strategy["closedTradeRecords"][0]["exitTrigger"] == "fee_adjusted_take_profit"
    assert strategy["closedTradeRecords"][0]["netExitPnlPerContract"] == 0.136
    assert strategy["closedTradeRecords"][0]["exitLossFraction"] == 0.0


def test_reconcile_backfills_reduce_only_fills_into_realized_analytics(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    fill = {
        "fill_id": "fill-close-1",
        "order_id": "close-1",
        "ticker": "KXBTC15M-CLOSE",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "NO",
        "fill_count_fp": 10,
        "average_price_dollars": 0.62,
        "position_cost_dollars": 4.0,
        "gross_proceeds_dollars": 6.2,
        "entry_fee_allocated_dollars": 0.1,
        "fee_cost_dollars": 0.2,
        "realized_pnl_dollars": 1.9,
        "created_time": "2026-07-22T12:15:00Z",
    }

    state = store.reconcile_settlements(
        "user-1",
        [],
        [fill],
        environment="paper",
    )
    strategy = state["strategy"]

    assert strategy["settledSamples"] == 0
    assert strategy["realizedSamples"] == 1
    assert strategy["realizedWins"] == 1
    assert strategy["totalPnl"] == 1.9
    assert strategy["equityCurve"][0]["cumulativePnl"] == 1.9
    record = strategy["realizedTradeRecords"][0]
    assert record["entryPrice"] == 0.4
    assert record["exitPrice"] == 0.62
    assert record["fees"] == 0.3


def test_repeated_settlement_reconciliation_does_not_rewrite_unchanged_state(tmp_path):
    durable = {}
    saves = []

    def save(user_id, payload):
        durable[user_id] = payload
        saves.append((user_id, payload))

    store = KalshiRobotState(
        str(tmp_path / "state.json"),
        state_loader=durable.get,
        state_saver=save,
    )
    store.record("u", {
        "generatedAt": "2026-07-25T12:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-IDEMPOTENT"},
        "edge": {"fairProbability": 0.70, "price": 0.50},
    }, {
        "order_id": "entry-1",
        "status": "filled",
        "fill_count": 1,
        "environment": "paper",
    })
    settlement = {
        "ticker": "KXBTC15M-IDEMPOTENT",
        "settled_time": "2026-07-25T12:15:00Z",
        "market_result": "YES",
        "yes_count_fp": 1,
        "revenue_dollars": 1.0,
        "yes_total_cost_dollars": 0.5,
    }
    store.reconcile_settlements("u", [settlement], [], environment="paper")
    writes_after_first_reconciliation = len(saves)

    store.reconcile_settlements("u", [settlement], [], environment="paper")

    assert len(saves) == writes_after_first_reconciliation


def test_robot_state_tracks_durable_version_and_invalidates_after_conflict(tmp_path):
    calls = []

    def save(_user_id, payload):
        calls.append(payload)
        if len(calls) == 1:
            return {"version": 41}
        raise RuntimeError("stale durable version")

    store = KalshiRobotState(
        str(tmp_path / "state.json"),
        state_saver=save,
    )
    store.configure("u", True, {"executionMode": "paper"})

    assert store._users["u"]["_operationsVersion"] == 41
    try:
        store.configure("u", False, {"executionMode": "paper"})
    except RuntimeError:
        pass
    else:
        raise AssertionError("stale write must fail")
    assert "u" not in store._users


def test_paper_reconciliation_removes_stale_conflict_artifacts_for_same_market(tmp_path):
    store = KalshiRobotState(str(tmp_path / "state.json"))
    state = store._state("u")
    strategy = state["modeState"]["paper"]["strategy"]
    strategy["closedTradeRecords"] = [{
        "orderId": "stale-close",
        "ticker": "KXBTC15M-CONFLICT",
        "environment": "paper",
        "closedAt": "2026-07-25T12:12:00Z",
        "side": "YES",
        "count": 1,
        "pnl": 0.20,
    }]
    strategy["settlementRecords"] = [{
        "key": "paper:KXBTC15M-CONFLICT:2026-07-25T12:15:00Z:YES",
        "ticker": "KXBTC15M-CONFLICT",
        "environment": "paper",
        "settledAt": "2026-07-25T12:15:00Z",
        "side": "YES",
        "result": "YES",
        "contracts": 1,
        "pnl": 0.40,
    }]
    canonical_fill = {
        "fill_id": "canonical-close-fill",
        "order_id": "canonical-close",
        "ticker": "KXBTC15M-CONFLICT",
        "environment": "paper",
        "action": "SELL",
        "reduce_only": True,
        "outcome_side": "YES",
        "fill_count_fp": 1,
        "average_price_dollars": 0.70,
        "position_cost_dollars": 0.50,
        "gross_proceeds_dollars": 0.70,
        "entry_fee_allocated_dollars": 0.01,
        "fee_cost_dollars": 0.01,
        "realized_pnl_dollars": 0.18,
        "created_time": "2026-07-25T12:13:00Z",
    }
    canonical_entry = {
        "fill_id": "canonical-entry-fill",
        "order_id": "canonical-entry",
        "ticker": "KXBTC15M-CONFLICT",
        "environment": "paper",
        "action": "BUY",
        "outcome_side": "YES",
        "fill_count_fp": 2,
        "price_dollars": 0.50,
        "position_cost_dollars": 1.0,
        "fee_cost_dollars": 0.02,
        "created_time": "2026-07-25T12:10:00Z",
    }
    canonical_settlement = {
        "ticker": "KXBTC15M-CONFLICT",
        "settled_time": "2026-07-25T12:15:05Z",
        "market_result": "YES",
        "yes_count_fp": 1,
        "revenue_dollars": 1.0,
        "yes_total_cost_dollars": 0.50,
        "fee_cost_dollars": 0.01,
    }

    reconciled = store.reconcile_settlements(
        "u", [canonical_settlement], [canonical_entry, canonical_fill], environment="paper",
    )
    strategy = reconciled["strategy"]

    assert [row["orderId"] for row in strategy["closedTradeRecords"]] == ["canonical-close"]
    assert [row["key"] for row in strategy["settlementRecords"]] == [
        "paper:KXBTC15M-CONFLICT:2026-07-25T12:15:05Z:YES"
    ]


def test_read_only_reconciliation_returns_analytics_without_durable_write(tmp_path):
    saves = []

    def save(_user_id, _payload):
        saves.append(1)

    store = KalshiRobotState(
        str(tmp_path / "state.json"),
        state_saver=save,
    )
    store.record("u", {
        "generatedAt": "2026-07-25T12:00:00Z",
        "action": "BUY_YES",
        "side": "YES",
        "market": {"ticker": "KXBTC15M-READONLY"},
        "edge": {"fairProbability": 0.70, "price": 0.50},
    }, {
        "order_id": "entry-readonly",
        "status": "filled",
        "fill_count": 1,
        "environment": "paper",
    })
    writes_after_entry = len(saves)

    state = store.reconcile_settlements("u", [{
        "ticker": "KXBTC15M-READONLY",
        "settled_time": "2026-07-25T12:15:00Z",
        "market_result": "YES",
        "yes_count_fp": 1,
        "revenue_dollars": 1.0,
        "yes_total_cost_dollars": 0.50,
    }], None, environment="paper", persist=False)

    assert state["strategy"]["settledSamples"] == 1
    assert len(saves) == writes_after_entry
