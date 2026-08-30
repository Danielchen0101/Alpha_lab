# Kalshi BTC execution-consistent policy v11 — 2026-08-30

## Decision

Version 11 keeps the validated v10 BTC15 and hourly signal policies. It fixes
two execution-path bottlenecks that prevented qualifying Real decisions from
becoming orders:

1. fractional sizing used the top quote, while the final IOC preflight used a
   wider marginal limit plus exact fee and cent rounding;
2. synchronous dual-family scheduling could spend the entire 25-second entry
   confirmation horizon before a fresh second evaluation.

No strategy can guarantee profit. The objective is to restore executable
frequency for already-qualified signals without promoting a weaker rule.

## Frozen recent evidence

A private production audit joined finalized outcomes only after selecting each
opportunity from information available at decision time. It found that multiple
two-frame-qualified BTC15 decisions were not routed because the final account
preflight returned `kalshi_live_exposure_changed`. The observations also showed
that the old 15-second upsert could overwrite scheduler frames with later
scheduler or browser evaluations. Version 11 separates those sources and
preserves confirmation/order events so future replay has one authoritative
lineage.

The execution failure is covered publicly with a synthetic $20 account fixture.
At a 2% single-market cap, a planned fractional order can fit at the actual book
depth it needs while the same quantity fails at a farther, unused price level
after exact fee and cent rounding. The final preflight was correct; the earlier
sizing calculation used a different price basis.

## Rejected frequency relaxations

The recent no-lookahead comparison did not justify weaker live signals:

| Candidate | Decision |
| --- | --- |
| v10 BTC15 champion, 25s | retain |
| same signal, 45s confirmation | reject; holdout was not positive |
| lower-edge shadow, 45s | reject; validation and holdout were negative |
| 68–80c, current edge, 25s | reject; validation profit factor was below 1 |

Hourly BTC did not provide enough independent finalized two-frame evidence to
justify a policy change. Pre-registered changes to candidate penalty,
price/window, and edge thresholds did not add a separately validated confirmed
sample, so the hourly signal envelope remains unchanged.

## Version 11 implementation

- Walk only the book depth required by `plannedContractsFp` and use that
  marginal price as the IOC limit.
- Re-run exact `kalshi_order_cost` at that price while stepping fractional size
  down by 0.01 until cash, risk, portfolio, and single-market caps all pass.
- Use the same execution price for maximum loss, expected value, fee burden,
  recovery profile, routing payload, and final preflight.
- Defer a routine hourly scan when BTC15 has a fresh first confirmation frame.
- Give an hourly first frame one prioritized fresh follow-up on the next
  five-second scheduler cycle. The requirement remains two frames within 25
  seconds; there is no bypass or wider live window.
- Separate scheduler and browser observation keys. Preserve champion frames
  and confirmation transitions at five-second resolution, and give an order
  result an identity-based key that cannot be erased by a later read-only
  refresh.
- Migrate strategy metadata to v11/storage v15 without changing Real arming,
  configured signal thresholds, fills, settlements, or ledger history.

## Production acceptance checks

After deployment, confirm that Real remains armed, both scheduler families are
healthy, strategy version is 11, and the next confirmed fractional order no
longer ends in `kalshi_live_exposure_changed`. Continue measuring realized
market-level P/L after fees; do not infer profitability from win rate alone.
