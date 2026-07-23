"""Backtest harness for Kalshi KXBTC15M (15-minute BTC up/down) strategies.

Mechanics modeled from Kalshi docs/press:
- A new market opens every quarter hour; strike = reference price at window open.
- Settlement = 60-second average of CF Benchmarks Real-Time Index over the
  final minute (approximated here by the OHLC4 of the last 1-minute candle).
- Taker fee = 0.07 * C * P * (1-P), rounded up.

Data: Bitstamp BTC/USD 1-minute candles (Bitstamp is a CF Benchmarks
constituent exchange).
"""
import math
import numpy as np
import pandas as pd

CSV = "/tmp/btcdata/data/updates/btcusd_bitstamp_1min_latest.csv"

def norm_cdf(x):
    return 0.5 * (1.0 + np.vectorize(math.erf)(x / math.sqrt(2.0)))

def load():
    df = pd.read_csv(CSV)
    df = df.dropna(subset=["close"]).copy()
    df["timestamp"] = df["timestamp"].astype(np.int64)
    df = df.sort_values("timestamp").drop_duplicates("timestamp")
    # Reindex to a continuous 1-minute grid, forward-fill gaps (rare)
    full = np.arange(df["timestamp"].iloc[0], df["timestamp"].iloc[-1] + 60, 60)
    df = df.set_index("timestamp").reindex(full)
    df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].ffill()
    df["volume"] = df["volume"].fillna(0.0)
    df.index.name = "timestamp"
    return df.reset_index()

def build_features(df):
    close = df["close"].to_numpy()
    ts = df["timestamp"].to_numpy()
    r = np.zeros(len(close))
    r[1:] = np.log(close[1:] / close[:-1])
    # EWMA variance (RiskMetrics-style, lambda=0.94) with outlier clipping
    var = np.zeros(len(r))
    v = np.var(r[1:301]) if len(r) > 301 else 1e-8
    for i in range(1, len(r)):
        cap = 4.0 * math.sqrt(max(v, 1e-10))
        x = max(-cap, min(cap, r[i]))
        v = 0.94 * v + 0.06 * x * x
        var[i] = v
    sigma = np.sqrt(np.maximum(var, 0.0002 ** 2))  # engine floor 2bp/min
    sigma = np.minimum(sigma, 0.01)
    # Momentum sums
    mom3 = pd.Series(r).rolling(3).sum().to_numpy()
    mom5 = pd.Series(r).rolling(5).sum().to_numpy()
    mom15 = pd.Series(r).rolling(15).sum().to_numpy()
    # Volatility regime: short RMS (10) vs long RMS (60)
    r2 = pd.Series(r * r)
    short_rms = np.sqrt(r2.rolling(10).mean().to_numpy())
    long_rms = np.sqrt(r2.rolling(60).mean().to_numpy())
    vol_ratio = short_rms / np.maximum(long_rms, 1e-9)
    return ts, close, r, sigma, mom3, mom5, mom15, vol_ratio

def build_windows(df):
    """Return arrays: window start index for aligned quarter-hours."""
    ts = df["timestamp"].to_numpy()
    start_ok = (ts % 900) == 0
    idx = np.where(start_ok)[0]
    idx = idx[idx + 15 <= len(ts) - 1]
    # Verify continuity: candle idx+k has timestamp ts[idx]+60k (guaranteed by reindex)
    return idx

def settlement_price(df, i0):
    """~60s average ending at close: OHLC4 of final candle [T+14m, T+15m)."""
    row = df.iloc[i0 + 14]
    return (row["open"] + row["high"] + row["low"] + row["close"]) / 4.0

def kalshi_fee(p):
    return math.ceil(0.07 * p * (1 - p) * 10000 - 1e-12) / 10000.0

def run(df):
    ts, close, r, sigma, mom3, mom5, mom15, vol_ratio = build_features(df)
    win_idx = build_windows(df)
    rows = []
    for i0 in win_idx:
        if i0 < 310:
            continue
        strike = df["open"].iat[i0]
        settle = settlement_price(df, i0)
        result_yes = settle >= strike
        for m in (10, 11, 12, 13):
            i = i0 + m  # decision at T+m minutes; latest complete candle is i-1
            spot = close[i - 1]
            sig = sigma[i - 1]
            secs_left = (15 - m) * 60
            # Effective diffusion horizon: settlement averaging ends the clock
            # ~30s early on average.
            minutes_eff = max(0.25, (secs_left - 30) / 60.0)
            hsig = sig * math.sqrt(minutes_eff)
            z = math.log(spot / strike) / max(hsig, 1e-9)
            rows.append({
                "t": ts[i0], "m": m, "z": z, "sig": sig,
                "vr": vol_ratio[i - 1],
                "mom3": mom3[i - 1], "mom5": mom5[i - 1], "mom15": mom15[i - 1],
                "spot": spot, "strike": strike,
                "result_yes": bool(result_yes),
                "dist_bps": (spot / strike - 1.0) * 1e4,
                "hour": int((ts[i0] // 3600) % 24),
            })
    return pd.DataFrame(rows)

def prob_models(t):
    """Attach candidate probability models."""
    z = t["z"].to_numpy()
    t["p_gauss"] = norm_cdf(z)
    t["p_logi170"] = 1 / (1 + np.exp(-np.clip(1.702 * z, -30, 30)))
    # current engine: logistic 1.55 with ~0.9 reliability shrink
    raw = 1 / (1 + np.exp(-np.clip(1.55 * z, -30, 30)))
    t["p_engine_v2"] = 0.5 + (raw - 0.5) * 0.9
    # Student-t tails (nu=4) — fatter tails than Gaussian
    from scipy import stats
    t["p_t4"] = stats.t.cdf(z, df=4)
    t["p_t6"] = stats.t.cdf(z, df=6)
    return t

def calibration_table(t, col, side_threshold=0.5):
    """For favorite side (max(p,1-p)) — hit rate by predicted-prob bucket."""
    p = t[col].to_numpy()
    fav_yes = p >= side_threshold
    p_fav = np.where(fav_yes, p, 1 - p)
    hit = np.where(fav_yes, t["result_yes"], ~t["result_yes"]).astype(float)
    bins = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0001]
    out = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (p_fav >= lo) & (p_fav < hi)
        n = int(mask.sum())
        if n == 0:
            continue
        out.append({
            "bucket": f"{lo:.2f}-{hi:.2f}", "n": n,
            "mean_forecast": float(p_fav[mask].mean()),
            "hit_rate": float(hit[mask].mean()),
        })
    return pd.DataFrame(out)

if __name__ == "__main__":
    df = load()
    print("rows", len(df), "from", pd.to_datetime(df.timestamp.iloc[0], unit="s"),
          "to", pd.to_datetime(df.timestamp.iloc[-1], unit="s"))
    t = run(df)
    t = prob_models(t)
    t.to_parquet("/tmp/bt_frames.parquet")
    print("decision rows:", len(t), "windows:", t.t.nunique())
    for col in ("p_gauss", "p_logi170", "p_engine_v2", "p_t4", "p_t6"):
        print("\n===", col, "===")
        print(calibration_table(t, col).to_string(index=False))
