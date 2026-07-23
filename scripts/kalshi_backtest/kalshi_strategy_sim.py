"""Simulate old (v2) vs new (v3) Kalshi BTC15M strategies on real windows."""
import math
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
t = pd.read_parquet("/tmp/bt_frames.parquet")

def fee(p):
    return np.ceil(0.07 * p * (1 - p) * 10000 - 1e-12) / 10000.0

def logistic(x):
    return 1 / (1 + np.exp(-np.clip(x, -30, 30)))

# Calibrated per-minute scales (fit on real data)
SCALE = {10: 1.93, 11: 1.99, 12: 2.04, 13: 2.15}
t["scale"] = t["m"].map(SCALE)
t["p_cal"] = logistic(t["scale"] * t["z"])

# Market simulation scenarios ------------------------------------------------
# market_mid = true calibrated prob + noise, optionally with favorite-longshot
# bias (market shades the favorite cheap by `bias`).
def market_mid(t, noise_sd, bias):
    p = t["p_cal"].to_numpy().copy()
    fav_yes = p >= 0.5
    shade = np.where(fav_yes, -bias, bias)  # shift YES mid toward 0.5 if YES is favorite
    mid = p + shade + rng.normal(0, noise_sd, len(p))
    return np.clip(mid, 0.02, 0.98)

HALF_SPREAD = 0.01

def one_per_window(frame):
    """Keep the earliest qualifying decision minute per window."""
    return frame.sort_values("m").groupby("t", as_index=False).first()

def summarize(name, fr, price_col, win_col):
    if not len(fr):
        print(f"{name:44s} 0 trades")
        return
    days = (t.t.max() - t.t.min()) / 86400
    wr = fr[win_col].mean()
    price = fr[price_col].to_numpy()
    f = fee(price)
    pnl = fr[win_col].to_numpy() * 1.0 - price - f
    print(f"{name:44s} trades={len(fr):6d} ({len(fr)/days:5.1f}/day) win={wr*100:5.1f}% "
          f"avg_price={price.mean()*100:5.1f}c EV={pnl.mean()*100:+6.2f}c/contract roi={pnl.mean()/max(price.mean(),1e-9)*100:+6.2f}%")

print(f"Windows: {t.t.nunique()}  days: {(t.t.max()-t.t.min())/86400:.0f}")

for label, noise_sd, bias in [("sharp market (noise 2.5pp, no bias)", 0.025, 0.0),
                              ("retail market (noise 4pp, favorite 1.5pp cheap)", 0.04, 0.015)]:
    print("\n### Scenario:", label)
    mid = market_mid(t, noise_sd, bias)
    yes_ask = np.clip(mid + HALF_SPREAD, 0.01, 0.99)
    no_ask = np.clip(1 - mid + HALF_SPREAD, 0.01, 0.99)

    # ---- OLD ENGINE v2 -----------------------------------------------------
    raw = logistic(1.55 * t["z"].to_numpy())
    model_v2 = 0.5 + (raw - 0.5) * 0.9
    fair_v2 = 0.75 * model_v2 + 0.25 * mid
    yes_edge = fair_v2 - yes_ask
    no_edge = (1 - fair_v2) - no_ask
    pick_yes = yes_edge >= no_edge
    sel_price = np.where(pick_yes, yes_ask, no_ask)
    sel_fair = np.where(pick_yes, fair_v2, 1 - fair_v2)
    net_edge = np.where(pick_yes, yes_edge, no_edge) - fee(sel_price)
    uncertainty = 0.06
    cons_edge = (sel_fair - uncertainty * 0.5) - sel_price - fee(sel_price)
    ok = (net_edge >= 0.04) & (cons_edge >= 0.015) & (sel_price >= 0.12) & (sel_price <= 0.88) & t.m.isin([10]).to_numpy()
    fr = t[ok].copy()
    fr["price"] = sel_price[ok]
    fr["win"] = np.where(pick_yes[ok], fr["result_yes"], ~fr["result_yes"]).astype(float)
    fr = one_per_window(fr)
    summarize("OLD v2 (edge-hunter, 12-88c band)", fr, "price", "win")
    if len(fr):
        cheap = fr[fr.price < 0.45]
        print(f"    -> share of entries on longshot side (<45c): {len(cheap)/len(fr)*100:.0f}%")

    # ---- NEW v3: late-window favorite --------------------------------------
    p_cal = t["p_cal"].to_numpy()
    fav_yes = p_cal >= 0.5
    p_fav = np.where(fav_yes, p_cal, 1 - p_cal)
    ask_fav = np.where(fav_yes, yes_ask, no_ask)
    f_fav = fee(ask_fav)
    edge = p_fav - ask_fav - f_fav
    for min_prob, min_edge in [(0.60, 0.0), (0.65, 0.0), (0.70, 0.0),
                               (0.68, 0.01), (0.70, 0.015), (0.75, 0.015)]:
        ok = (p_fav >= min_prob) & (edge >= min_edge) & (ask_fav >= 0.50) & (ask_fav <= 0.93) \
             & (t.vr.to_numpy() <= 2.5) & t.m.isin([11, 12, 13]).to_numpy()
        fr = t[ok].copy()
        fr["price"] = ask_fav[ok]
        fr["win"] = np.where(fav_yes[ok], fr["result_yes"], ~fr["result_yes"]).astype(float)
        fr = one_per_window(fr)
        summarize(f"NEW v3 minProb={min_prob:.2f} minEdge={min_edge:.3f}", fr, "price", "win")

# Pure hit-rate curves (market-free): what win rate does the entry filter alone give?
print("\n### Market-free favorite hit rates (calibrated model, minutes 11-13, first qualifying)")
p_cal = t["p_cal"].to_numpy()
fav_yes = p_cal >= 0.5
p_fav = np.where(fav_yes, p_cal, 1 - p_cal)
for min_prob in (0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85):
    ok = (p_fav >= min_prob) & t.m.isin([11, 12, 13]).to_numpy() & (t.vr.to_numpy() <= 2.5)
    fr = t[ok].copy()
    fr["win"] = np.where(fav_yes[ok], fr["result_yes"], ~fr["result_yes"]).astype(float)
    fr = one_per_window(fr)
    days = (t.t.max() - t.t.min()) / 86400
    if len(fr):
        print(f"  minProb {min_prob:.2f}: trades/day {len(fr)/days:5.1f}  hit {fr['win'].mean()*100:5.1f}%  (n={len(fr)})")

# Momentum-agreement filter effect at minProb 0.70
print("\n### Momentum filter at minProb=0.70 (m in 11-13)")
mom5 = t["mom5"].to_numpy()
agree = np.where(fav_yes, mom5 > 0, mom5 < 0)
for name, extra in [("no filter", np.ones(len(t), bool)), ("momentum agrees", agree), ("momentum opposes", ~agree)]:
    ok = (p_fav >= 0.70) & t.m.isin([11, 12, 13]).to_numpy() & (t.vr.to_numpy() <= 2.5) & extra
    fr = t[ok].copy()
    fr["win"] = np.where(fav_yes[ok], fr["result_yes"], ~fr["result_yes"]).astype(float)
    fr = one_per_window(fr)
    if len(fr):
        print(f"  {name:18s}: hit {fr['win'].mean()*100:5.1f}% n={len(fr)}")

# Stability across months
print("\n### Monthly hit rate, minProb=0.70 rule")
ok = (p_fav >= 0.70) & t.m.isin([11, 12, 13]).to_numpy() & (t.vr.to_numpy() <= 2.5)
fr = t[ok].copy()
fr["win"] = np.where(fav_yes[ok], fr["result_yes"], ~fr["result_yes"]).astype(float)
fr = one_per_window(fr)
fr["month"] = pd.to_datetime(fr["t"], unit="s").dt.to_period("M")
g = fr.groupby("month")["win"].agg(["mean", "count"])
print((g["mean"] * 100).round(1).to_string())
print("min month:", (g["mean"].min() * 100).round(1), "%")
