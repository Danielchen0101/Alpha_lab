"""End-to-end replay of the SHIPPED kalshi_engine v3 over real BTC 1m data.

For each 15-minute window (last N days), the real evaluate_btc15_contract is
called at decision minutes 11/12/13 with a synthetic-but-fair order book
(market mid = independently calibrated probability + noise, 2c spread).
First BUY_* per window is taken and held to settlement.
"""
import math
import sys
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd

sys.path.insert(0, "/tmp/engine")
from kalshi_engine import evaluate_btc15_contract, kalshi_fee  # noqa: E402

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 120
rng = np.random.default_rng(11)

df = pd.read_csv("/tmp/btcdata/data/updates/btcusd_bitstamp_1min_latest.csv")
df = df.sort_values("timestamp").drop_duplicates("timestamp")
full = np.arange(df["timestamp"].iloc[0], df["timestamp"].iloc[-1] + 60, 60)
df = df.set_index("timestamp").reindex(full)
df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].ffill()
df["volume"] = df["volume"].fillna(0.0)
df = df.reset_index().rename(columns={"index": "timestamp"})

cutoff = df["timestamp"].iloc[-1] - DAYS * 86400
df = df[df["timestamp"] >= cutoff - 300 * 60].reset_index(drop=True)
ts = df["timestamp"].to_numpy()
O = df["open"].to_numpy(); H = df["high"].to_numpy()
L = df["low"].to_numpy(); C = df["close"].to_numpy(); V = df["volume"].to_numpy()

# Benchmark market probability (independent scale fit, for quoting only)
r = np.zeros(len(C)); r[1:] = np.log(C[1:] / C[:-1])
var = np.zeros(len(r)); v = np.var(r[1:301])
for i in range(1, len(r)):
    cap = 4.0 * math.sqrt(max(v, 1e-10))
    x = max(-cap, min(cap, r[i]))
    v = 0.94 * v + 0.06 * x * x
    var[i] = v
sigma_bench = np.clip(np.sqrt(np.maximum(var, 4e-8)), 2e-4, 1e-2)

win_starts = np.where((ts % 900 == 0) & (ts >= cutoff))[0]
win_starts = win_starts[(win_starts > 310) & (win_starts + 15 < len(ts))]

trades = []
blocks = {}
for i0 in win_starts:
    t0 = int(ts[i0])
    strike = O[i0]
    settle = (O[i0 + 14] + H[i0 + 14] + L[i0 + 14] + C[i0 + 14]) / 4.0
    result = "YES" if settle >= strike else "NO"
    open_iso = datetime.fromtimestamp(t0, tz=timezone.utc)
    close_iso = open_iso + timedelta(minutes=15)
    for m in (11, 12, 13):
        i = i0 + m
        spot = C[i - 1]
        now = datetime.fromtimestamp(t0 + m * 60, tz=timezone.utc)
        secs = (15 - m) * 60
        # independent benchmark quote
        hs = sigma_bench[i - 1] * math.sqrt(max((secs - 30) / 60.0, 0.25))
        zb = math.log(spot / strike) / max(hs, 1e-9)
        scale = 2.0 * (1.0 + 0.12 * min(max((300 - secs) / 180.0, 0.0), 1.0))
        p_mkt = 1 / (1 + math.exp(-max(-30, min(30, scale * zb))))
        mid = min(0.97, max(0.03, p_mkt + rng.normal(0, 0.03)))
        yes_bid = round(max(0.01, mid - 0.01), 2)
        no_bid = round(max(0.01, (1 - mid) - 0.01), 2)
        candles = [
            [float(ts[k]), float(L[k]), float(H[k]), float(O[k]), float(C[k]), float(V[k])]
            for k in range(i - 200, i)
        ]
        market = {
            "ticker": f"KXBTC15M-{t0}",
            "status": "active",
            "open_time": open_iso.isoformat(),
            "close_time": close_iso.isoformat(),
            "floor_strike": float(strike),
        }
        decision = evaluate_btc15_contract(
            market,
            spot_price=float(spot),
            candles=candles,
            now=now,
            orderbook={"yes": [[yes_bid, 200]], "no": [[no_bid, 200]]},
            reference_time=now,
            book_time=now,
            account_context={"bankroll": 1000.0, "cashAvailable": 1000.0, "portfolioExposure": 0.0},
            config={"learningMode": False, "preTradeAiReview": False},
        )
        if str(decision.get("action") or "").startswith("BUY_"):
            side = decision["side"]
            price = decision["edge"]["price"]
            fee = decision["edge"]["feePerContract"]
            win = side == result
            trades.append({
                "t": t0, "m": m, "side": side, "price": price,
                "win": win, "pnl": (1.0 if win else 0.0) - price - fee,
                "contracts": decision["sizing"]["contracts"],
                "p_model": decision["edge"]["modelProbability"],
            })
            break
        else:
            for reason in decision.get("blockingReasons") or []:
                blocks[reason] = blocks.get(reason, 0) + 1

fr = pd.DataFrame(trades)
days = (ts[win_starts[-1]] - ts[win_starts[0]]) / 86400
print(f"windows={len(win_starts)} days={days:.0f}")
if len(fr):
    print(f"SHIPPED ENGINE: trades={len(fr)} ({len(fr)/days:.1f}/day) "
          f"win_rate={fr.win.mean()*100:.1f}% avg_price={fr.price.mean()*100:.1f}c "
          f"EV={fr.pnl.mean()*100:+.2f}c/contract avg_model_p={fr.p_model.mean()*100:.1f}%")
    fr["month"] = pd.to_datetime(fr["t"], unit="s").dt.to_period("M")
    print(fr.groupby("month")["win"].agg(["mean", "count"]).to_string())
    lows = fr[fr.p_model < 0.75]
    if len(lows):
        print(f"entries with model_p<0.75: n={len(lows)} win={lows.win.mean()*100:.1f}%")
print("top blocking reasons:", sorted(blocks.items(), key=lambda kv: -kv[1])[:6])
