# Kalshi BTC 15-Minute Strategy v3 — "Favorite Carry"

**Engine:** `backend/kalshi_engine.py` (`btc15_favorite_carry_v3`)
**Calibration data:** 53,936 real 15-minute BTC windows (Bitstamp 1m candles, 2025-01-07 → 2026-07-23; Bitstamp is a CF Benchmarks constituent exchange)
**Replay of the shipped engine (last 120 days):** 813 trades, **89.9% win rate**, avg entry 83.3c, every month 86.6–91.6%

---

## 1. Why the old strategy lost (~20% win rate)

The v2 engine ("Conservative Edge Ensemble") compared its own probability
against both sides' asks and bought whichever side showed more "edge". Three
deliberately conservative pieces made that fatal:

1. **Logit scale 1.55** (a proper probit-equivalent is ~1.70; the *real* fit is ~2.0)
2. **Reliability shrink** — forecasts pulled toward 50%
3. **Momentum projected as drift**, adding noise

The result: the model was systematically **under-confident**. When the market
priced the favorite at 80c, the shrunken model said ~65%, so the longshot at
20c looked "cheap" (fair 35%!). The engine bought it. Simulated on real data,
v2 put **100% of entries on the longshot side (<45c)** and won **18–21.5%** —
exactly the observed live ~20% win rate. Stop-losses then crystallized extra
losses mid-window.

Win rate on a binary contract is structural: **buy 20c contracts → win ~20%;
buy 85c contracts → win ~85%.** Positive EV and high win rate are separate
questions; v2 had neither because the "edge" was model miscalibration.

## 2. What v3 does

**Buy only the model-confirmed FAVORITE side, late in the window, and hold to
settlement.**

- **Probability model:** `p = logistic(scale(t) · z + 0.07 · momentum_z)` with
  `z = ln(spot/strike) / σ√(remaining minutes − 0.5)`. The −30s adjusts for
  Kalshi's 60-second settlement averaging. `scale(t)` is the MLE fit on real
  outcomes: ~1.95 at 300s rising ~12% by 120s (favorites strengthen into the
  close). No reliability shrink.
- **Entry window:** 100–320 seconds to close (calibration minutes 11–13).
- **Selection gates:** favorite side only (`fair ≥ 0.5`), model probability
  ≥ `minModelProbability` (0.60), price band **50–93c**, fee-adjusted edge vs
  the executable ask ≥ 1.5pp, uncertainty-adjusted edge ≥ 0.5pp, spread /
  depth / volatility-regime / freshness / account gates unchanged.
- **Exit:** hold to settlement. Early exits only for fee-cleared profit
  (≥2c/contract) or deep protective stops (prob ≤ 0.35 **and** loss ≥ 55%;
  emergency at prob ≤ 0.15 **and** loss ≥ 30%). Mid-window loss-taking was a
  major drag in v2.
- **Sizing:** min(0.75% bankroll hard budget, 25% fractional Kelly), depth-capped.

### Calibration evidence (favorite side, minutes 11–13, real windows)

| Model p bucket | n | Empirical hit |
|---|---|---|
| 0.60–0.65 | 11,387 | 67.5% |
| 0.70–0.75 | 13,379 | 79.4% |
| 0.80–0.85 | 17,524 | 89.1% |
| 0.90–0.95 | 30,269 | 96.4% |

MLE logistic scale by horizon: 1.93 (300s) → 1.99 (240s) → 2.04 (180s) →
2.15 (120s). Momentum adds a small but significant logit term (+0.067 per
standardized 5-minute move). Monthly hit rate of the entry rule never fell
below **89.5%** across 19 months.

## 3. Honest expectations

- **Win rate:** structural. Entries average ~83c and ~89% model probability;
  60%+ is exceeded with a wide margin even if calibration degrades several
  points. This was the user-specified goal.
- **EV:** the hard part on 15-minute binaries is the **cost wall** (spread +
  7%·p·(1−p) fee). Fee at 85c is only ~0.9c (cheapest region of the fee
  curve — another reason to trade favorites). The edge gates require the
  model to beat the executable ask net of fees before entering; whether live
  quotes leave that edge often decides trades/day (backtest: ~7–45/day
  depending on gate strictness). Judge live EV from Paper evidence, not from
  the backtest's synthetic quotes.
- **Losses cluster:** consecutive windows share regime. Sizing stays ≤0.75%
  per trade; Real mode keeps the 3-loss cooldown.

## 4. AI / learning loop (recalibrated)

Benchmarks moved to favorite-carry levels: weak = win rate < 72% or negative
P/L (tighten sizing, raise `minModelProbability`); strong = ≥85% win rate,
Brier ≤ 0.15 (cautious expansion). Settings-AI reviews may now also nudge
`minModelProbability` (±0.02, evidence-gated, never loosened during weak
performance). Brier > 0.19 counts as poor calibration (a calibrated 85%
forecaster scores ~0.1275).

## 5. Files

- `backend/kalshi_engine.py` — v3 model, gates, defaults, bounds
- `backend/kalshi_robot_state.py` — v5 state migration, recalibrated learning controller
- `backend/start_quant_backend.py` — updated Settings-AI reviewer brief
- `frontend/src/services/kalshiApi.ts` — v3 defaults incl. `minModelProbability`
- `frontend/src/pages/Kalshi.tsx` — v3 presets (Fortress / Favorite Carry / AI Learning / Active Sampling), new controls
- `scripts/kalshi_backtest/` — data loader, calibration fit, strategy sim, shipped-engine replay

To re-run the backtest: fetch 1m data (`git clone --depth 1
https://github.com/ff137/bitstamp-btcusd-minute-data`), then run
`kalshi_backtest.py`, `kalshi_strategy_sim.py`, `kalshi_engine_replay.py`.

## 5.1 Fine-tuning policy — when and how the AI adjusts

Three layers act on different cadences; none can bypass hard gates or size orders.

**Layer 1 — Pre-trade AI challenge (every cleared new entry, cached 45s).**
Reviews one candidate against a v3-aware rubric (favorite side, high price and
small edge are *by design*; challenges require a concrete contradiction such
as stale quotes, a vol spike, or momentum reversal on a marginal strike
distance). A CHALLENGE with ≥0.65 confidence only delays to the next 5-second
snapshot.

**Layer 2 — Deterministic walk-forward controller (every 6 realized trades
after a 12-trade warmup, per environment).**
- *Weak window* (avg P/L < 0 **or** win rate < 72%; poor Brier > 0.19):
  shrink risk ×0.85, raise `minNetEdge` +0.25pp, `minConservativeEdge`
  +0.15pp, `minModelProbability` +1pp, cut exploration ×0.75; if calibration
  is poor also reduce `probabilityLogitScale` −0.05.
- *Strong window* (≥16 trades, win rate ≥ 85%, positive P/L, Brier ≤ 0.15):
  expand risk ×1.08 (never above `learningMaxRiskPct`), relax edge floors
  slightly.
- *Neutral*: tiny edge-threshold relaxation funded by the exploration budget;
  execution/liquidity gates never move.

**Layer 3 — Settings-AI calibration review (every 6 settled shadow samples,
≥8 minimum, per environment).**
Receives the evidence summary including the v3 cohort tables
(`modelProbability`, `secondsToClose`, `volatilityRatio`, `utcHourBand`
buckets), reliability bins, and Brier vs-market comparison. Proposes bounded
deltas (all re-validated server-side with per-parameter evidence
requirements): blend ±0.05, logit scale ±0.05, momentum ±0.02, basis ±1bp,
net edge ±0.25pp, conservative edge ±0.15pp, `minModelProbability` ±2pp,
tolerance ±0.2c, exploration ±5pp. Guardrails: nothing loosens while
realized win rate < 72% or P/L < 0; confidence can't rise while Brier > 0.19;
direction flips need independent shadow + traded cohort agreement; risk %
is never AI-controlled. Real mode additionally keeps the 3-loss cooldown and
never explores.

**Cohort → lever mapping** (what "training" means here): weak
`modelProbability.below070/070to080` → raise `minModelProbability`; decay
concentrated in a `secondsToClose` bucket → adjust confidence via
`probabilityLogitScale`, not timing; weak `volatilityRatio.elevated` →
reduce scale/momentum (the engine already damps scale up to 5% for vol-ratio
1.5-2.5); `utcHourBand` is informational (hourly spread measured at only
87.0-89.9%, no per-hour lever is justified).

## 6. Recommended operating mode (24/7)

Preset **“AI Learning · 24/7 Recommended”**: Favorite Carry defaults +
bounded exploration (15%) + evidence-gated AI reviews every 6 settlements
over a 40-trade window. Alternative modes: **Fortress** (fewer, stronger
entries, highest hit rate) when you want maximum win rate; **Active
Sampling** to gather more evidence faster at slightly lower expected hit
rate. Overnight/weekend books are thinner — the spread, depth and relative-
spread gates handle that automatically by trading less.
