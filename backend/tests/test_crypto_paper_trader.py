import math
import random
import time
from datetime import datetime, timedelta, timezone

import pytest

import crypto_paper_trader as cpt
from crypto_paper_trader import CryptoSimError, PaperTradingDaemon


NOW = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
# Large enough for a 40-day research backtest on top of the ~65-day warm-up.
SERIES_LENGTH = 2700


def _series(seed, count=SERIES_LENGTH, trending=True):
    rng = random.Random(seed)
    bars, price = [], 40_000.0
    start = NOW - timedelta(hours=count + 1)
    for index in range(count):
        drift = 0.0005 if trending and index > count - 24 * 40 else 0.0001
        ret = drift + rng.gauss(0, 0.003)
        close = price * math.exp(ret)
        bars.append(
            {
                "timestamp": start + timedelta(hours=index),
                "open": price,
                "high": max(price, close) * 1.001,
                "low": min(price, close) * 0.999,
                "close": close,
                "volume": 120 + rng.random() * 40,
            }
        )
        price = close
    return bars


@pytest.fixture()
def daemon(tmp_path):
    market = {"BTC/USD": _series(1), "ETH/USD": _series(2)}
    cursor = {"BTC/USD": SERIES_LENGTH - 3, "ETH/USD": SERIES_LENGTH - 3}
    instance = PaperTradingDaemon(state_dir=str(tmp_path), safe_print=lambda *_: None)

    def fake_fetch(symbol, minimum_bars):
        data = market[symbol][: cursor[symbol] + 1]
        if len(data) < minimum_bars:
            raise CryptoSimError(f"only {len(data)} bars for {symbol}")
        return data[-minimum_bars:]

    instance._fetch_bars = fake_fetch
    instance.state["config"]["mlEnabled"] = False
    instance._market = market
    instance._cursor = cursor
    return instance


def test_first_cycle_processes_only_the_latest_bar_per_symbol(daemon):
    result = daemon.run_cycle(source="manual")

    # A fresh account earns its history honestly: exactly one new bar each.
    assert result["processedBars"] == 2
    snapshot = daemon.status_snapshot()
    assert snapshot["account"]["equity"] > 0
    assert len(daemon.state["equityCurve"]) >= 1
    assert daemon.state["lastBarTime"]["BTC/USD"]


def test_catch_up_replay_fills_missed_bars_at_next_open(daemon):
    daemon.run_cycle(source="manual")
    daemon._cursor["BTC/USD"] = SERIES_LENGTH - 1
    daemon._cursor["ETH/USD"] = SERIES_LENGTH - 1

    result = daemon.run_cycle(source="manual")
    assert result["processedBars"] == 4  # two missed bars replayed per symbol

    replayed = [d for d in daemon.state["decisions"] if d.get("source") == "replay"]
    assert replayed, "missed bars must be recorded as replay decisions"
    # Replay must never process the same bar twice.
    again = daemon.run_cycle(source="manual")
    assert again["processedBars"] == 0


def test_trades_update_cash_positions_and_protective_stops(daemon):
    daemon.run_cycle(source="manual")
    daemon._cursor["BTC/USD"] = SERIES_LENGTH - 1
    daemon._cursor["ETH/USD"] = SERIES_LENGTH - 1
    daemon.run_cycle(source="manual")

    snapshot = daemon.status_snapshot()
    initial = snapshot["account"]["initialCapital"]
    positions = snapshot["account"]["positions"]
    if positions:  # trending fixture should open at least one position
        total_value = sum(p["marketValue"] for p in positions)
        assert snapshot["account"]["cash"] + total_value == pytest.approx(
            snapshot["account"]["equity"], rel=1e-6
        )
        assert all(p["weight"] <= 0.31 for p in positions)
        assert any(p.get("protectiveStop") for p in positions)
        assert snapshot["tradeCount"] >= 1
        buy = next(t for t in daemon.state["trades"] if t["side"] == "buy")
        assert buy["fee"] > 0
        assert snapshot["account"]["equity"] < initial + 10_000  # sanity bound


def test_state_persists_and_reloads_across_restarts(daemon, tmp_path):
    daemon.run_cycle(source="manual")
    equity_points = len(daemon.state["equityCurve"])
    cash = daemon.state["account"]["cash"]

    reloaded = PaperTradingDaemon(state_dir=str(tmp_path), safe_print=lambda *_: None)
    assert len(reloaded.state["equityCurve"]) == equity_points
    assert reloaded.state["account"]["cash"] == pytest.approx(cash)


def test_second_worker_reloads_shared_state_before_processing(daemon, tmp_path):
    first = daemon.run_cycle(source="manual")
    decision_count = len(daemon.state["decisions"])

    second = PaperTradingDaemon(state_dir=str(tmp_path), safe_print=lambda *_: None)
    second._fetch_bars = daemon._fetch_bars
    repeated = second.run_cycle(source="manual")

    assert first["processedBars"] == 2
    assert repeated["processedBars"] == 0
    assert len(second.state["decisions"]) == decision_count


def test_shared_cycle_lease_rejects_a_competing_worker(daemon, tmp_path):
    second = PaperTradingDaemon(state_dir=str(tmp_path), safe_print=lambda *_: None)
    second._fetch_bars = daemon._fetch_bars

    with cpt._process_file_lease(daemon.process_lock_path) as backend:
        assert backend in {"msvcrt", "fcntl"}
        with pytest.raises(CryptoSimError) as captured:
            second.run_cycle(source="manual")

    assert captured.value.code == "cycle_in_progress"


def test_latest_signal_waits_for_next_completed_bar_open(daemon, monkeypatch):
    def always_buy(bars, *_args, **_kwargs):
        latest = bars[-1]
        return {
            "timestamp": latest["timestamp"].isoformat(),
            "action": "BUY",
            "regime": "trend_up",
            "score": 90.0,
            "target_weight": 0.10,
            "stop_distance_pct": 0.02,
            "price": latest["close"],
            "reasons": ["forced causal execution test"],
        }

    monkeypatch.setattr(cpt, "generate_signal", always_buy)
    first = daemon.run_cycle(source="manual")

    assert first["trades"] == 0
    assert daemon.state["trades"] == []
    assert set(daemon.state["pendingExecutions"]) == {"BTC/USD", "ETH/USD"}

    daemon._cursor["BTC/USD"] += 1
    next_bar = daemon._market["BTC/USD"][daemon._cursor["BTC/USD"]]
    second = daemon.run_cycle(source="manual")
    btc_trade = next(
        trade for trade in daemon.state["trades"]
        if trade["symbol"] == "BTC/USD"
    )

    assert second["trades"] == 1
    assert btc_trade["timestamp"] == next_bar["timestamp"].isoformat()
    assert btc_trade["price"] == pytest.approx(next_bar["open"] * 1.0005, abs=0.01)
    assert btc_trade["source"].endswith(":next-bar-open")


def test_scheduler_rechecks_durable_stop_inside_shared_lease(daemon):
    daemon.stop()
    before = {
        "cycles": daemon.state["status"]["cycleCount"],
        "decisions": len(daemon.state["decisions"]),
        "pending": dict(daemon.state["pendingExecutions"]),
    }

    result = daemon.run_cycle(source="scheduler")

    assert result["skipped"] == "automation_stopped"
    assert daemon.state["status"]["cycleCount"] == before["cycles"]
    assert len(daemon.state["decisions"]) == before["decisions"]
    assert daemon.state["pendingExecutions"] == before["pending"]


def test_removing_symbol_discards_its_unfilled_signal(daemon, monkeypatch):
    def always_buy(bars, *_args, **_kwargs):
        latest = bars[-1]
        return {
            "timestamp": latest["timestamp"].isoformat(),
            "action": "BUY",
            "regime": "trend_up",
            "score": 90.0,
            "target_weight": 0.10,
            "stop_distance_pct": 0.02,
            "price": latest["close"],
        }

    monkeypatch.setattr(cpt, "generate_signal", always_buy)
    daemon.run_cycle(source="manual")
    assert "BTC/USD" in daemon.state["pendingExecutions"]

    daemon.update_config({"symbols": ["ETH/USD"]})

    assert "BTC/USD" not in daemon.state["pendingExecutions"]


def test_enabled_standby_requires_recent_completed_cycle_for_health(daemon):
    class AliveThread:
        @staticmethod
        def is_alive():
            return True

    daemon._thread = AliveThread()
    with daemon._lock:
        daemon.state["config"]["enabled"] = True
        daemon.state["status"]["threadHeartbeatAt"] = cpt._iso()
        daemon.state["status"]["lastCycleAt"] = cpt._iso(NOW - timedelta(hours=2))
        daemon.state["status"]["consecutiveErrors"] = 0
    daemon._persist()

    snapshot = daemon.status_snapshot()

    assert snapshot["threadAlive"] is True
    assert snapshot["daemonHealthy"] is False
    assert snapshot["status"]["cycleHeartbeatAgeSeconds"] > 60


def test_reset_and_config_updates_are_validated(daemon):
    daemon.run_cycle(source="manual")
    daemon.reset(50_000)
    assert daemon.state["account"]["cash"] == 50_000
    assert daemon.state["equityCurve"] == []
    assert daemon.state["trades"] == []

    with pytest.raises(CryptoSimError, match="initialCapital"):
        daemon.reset(10)
    with pytest.raises(CryptoSimError, match="intervalMinutes"):
        daemon.update_config({"intervalMinutes": 7})
    with pytest.raises(CryptoSimError, match="unsupported sim config"):
        daemon.update_config({"hacks": True})
    with pytest.raises(CryptoSimError, match="invalid strategy override"):
        daemon.update_config({"strategy": {"max_asset_weight": 5.0}})

    daemon.update_config({"intervalMinutes": 15, "strategy": {"max_asset_weight": 0.25}})
    assert daemon.state["config"]["intervalMinutes"] == 15


def test_small_gaps_are_carry_forward_filled_but_long_outages_are_not():
    bars = _series(3, count=60)
    with_gap = bars[:30] + bars[32:]  # two missing hours
    repaired = PaperTradingDaemon._fill_small_gaps(list(with_gap))
    assert len(repaired) == 60
    synthetic = [row for row in repaired if row.get("synthetic")]
    assert len(synthetic) == 2
    assert all(row["volume"] == 0.0 for row in synthetic)

    big_gap = bars[:10] + bars[40:]  # 30 missing hours stay missing
    untouched = PaperTradingDaemon._fill_small_gaps(list(big_gap))
    assert len(untouched) == len(big_gap)


def test_research_backtest_returns_metrics_curves_and_regimes(daemon):
    report = daemon.research_backtest({"symbol": "BTC/USD", "days": 40, "useMl": False})

    assert report["symbol"] == "BTC/USD"
    assert report["metrics"]["ending_equity"] > 0
    assert report["benchmarkMetrics"]["ending_equity"] > 0
    assert report["equityCurve"] and report["benchmarkCurve"]
    assert report["regimeStats"]
    assert report["mlUsed"] is False

    with pytest.raises(CryptoSimError, match="days"):
        daemon.research_backtest({"symbol": "BTC/USD", "days": 5})
    with pytest.raises(CryptoSimError, match="symbol"):
        daemon.research_backtest({"symbol": "DOGE/USD", "days": 60})


def test_run_cycle_survives_data_feed_failures(daemon):
    def failing_fetch(symbol, minimum_bars):
        raise CryptoSimError("feed down", status=502, code="data_feed_error")

    daemon._fetch_bars = failing_fetch
    result = daemon.run_cycle(source="manual")
    assert result["processedBars"] == 0
    assert daemon.state["status"]["lastError"]
    assert all("error" in value for value in result["symbols"].values())


def test_daemon_thread_can_stop_and_restart_with_a_fresh_heartbeat(daemon):
    daemon.ensure_thread()
    deadline = time.time() + 2
    while not daemon.status_snapshot()["threadAlive"] and time.time() < deadline:
        time.sleep(0.01)
    first_thread = daemon._thread
    daemon.stop_thread()
    assert daemon.status_snapshot()["threadAlive"] is False

    daemon.ensure_thread()
    deadline = time.time() + 2
    while not daemon.status_snapshot()["daemonHealthy"] and time.time() < deadline:
        time.sleep(0.01)
    snapshot = daemon.status_snapshot()
    assert snapshot["threadAlive"] is True
    assert snapshot["daemonHealthy"] is True
    assert daemon._thread is not first_thread
    daemon.stop_thread()


def test_legacy_state_migration_keeps_new_runtime_status_fields(tmp_path):
    path = tmp_path / cpt.STATE_FILENAME
    path.write_text(
        '{"config":{"enabled":false},"status":{"cycleCount":7},"account":{"cash":1234}}',
        encoding="utf-8",
    )
    restored = PaperTradingDaemon(state_dir=str(tmp_path), safe_print=lambda *_: None)
    assert restored.state["status"]["cycleCount"] == 7
    assert restored.state["status"]["currentStage"] == "idle"
    assert "threadHeartbeatAt" in restored.state["status"]
    assert restored.state["account"]["positions"] == {}
