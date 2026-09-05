# Kalshi BTC execution readiness — 2026-09-05

## Findings and scope

The recent no-trade incident has an infrastructure blocker and a collateral
blocker, separate from strategy quality. The production origin stopped
responding when the AWS free-plan credits expired. A code deployment cannot
reactivate an expired AWS account. Account restoration is an explicit billing
operation, not a strategy change.

Kalshi moved newly created crypto events to exchange shard 2 on August 24,
2026. The total portfolio balance is not necessarily spendable on that shard.
Both default and Crypto shards are Predictions; Crypto here does not mean
perpetual futures. Market `exchange_index` is authoritative. Cash must be
preallocated to the order's shard, and cross-shard allocation is an explicit
account-owner decision, never an implicit bot action.

## Research interpretation

The scoped post-routing-fix observation audit contained 9,080 BTC15 and 6,511
hourly rows before the origin stopped. BTC15 had 203 qualifying first frames
across 67 markets; hourly had two across two markets. No saved row contained a
confirmed entry or an order result. These are observations, not independent
trades, and a qualifying first frame is not an executable two-frame entry.

The routine stream is deduplicated and sampled. Failed submissions previously
could also raise before the observation was saved. Consequently, gaps between
saved rows do not establish scheduler latency or prove continuous signal
eligibility. Do not extend the 25-second confirmation window from these gaps,
or report those first frames as missed profitable trades. Future audits need
both failure evidence and independently fresh consecutive decision frames.

The prior frozen walk-forward comparisons rejected wider confirmation,
lower-edge, and broader-price alternatives. There is no new realized-trade
sample in this incident that warrants reversing those decisions. BTC15 keeps
its 70–80c champion; hourly keeps its existing 48–78c policy and multiple-strike
selection penalty. Signal thresholds, fee floors, position caps, and exit
ownership safeguards remain in force. Profit is not guaranteed.

## Changes

- Preserve and validate fixed-point dollar shard balances separately from the
  legacy aggregate balance in cents. Do not turn a missing balance into zero,
  or assume aggregate cash belongs to Crypto.
- Display funding readiness separately from strategy intent and keep shadow
  evidence. Reduce a cash-constrained entry only when exact cost and existing
  economics remain valid. Never block a reduce-only exit on entry funding.
- Recheck collateral before a real order; use a scoped uncached balance read
  when a restricted API key omits the breakdown. Never automatically move
  funds or blindly retry an order submission.
- Break durable confirmation progress on an intervening invalid execution
  frame. Browser-only refreshes cannot advance or clear this progress, and a
  repeated timestamp cannot count as a new confirmation.
- Persist each failed submission as a distinct research event before
  re-raising its operational error. Timeouts and server errors remain unknown
  outcomes, not fabricated rejections or fills. Routine WAIT sampling cannot
  discard these events, including failed reduce-only exits.
- When cent rounding makes a cap-fitting fractional order uneconomic, search
  a bounded number of smaller quantities using the same marginal depth, exact
  fee/cash calculation, and risk limits. Existing passing quantities remain
  unchanged. Synthetic regressions establish correctness, not profitability;
  this was not the observed account's main no-trade blocker.

## Acceptance after account restoration

1. Confirm the existing origin and container are healthy; do not create a
   replacement paid instance or silently change arming state.
2. Confirm the expected Git commit, a single scheduler lease, fresh BTC15 and
   hourly observations, and an accurate per-shard funding status.
3. Verify failures remain visible and do not become fabricated fills. Allow
   the existing bot to await its own qualified opportunities; do not submit a
   real test order merely to demonstrate connectivity.
4. Measure complete market/event sequences after actual fees, not raw frame
   counts or partial-exit win rate. Collect chronological out-of-sample
   evidence before promoting a more permissive signal rule.

References: [Kalshi exchange sharding](https://docs.kalshi.com/getting_started/exchange_sharding),
[Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance),
[target allocations](https://docs.kalshi.com/api-reference/portfolio/set-target-balance-allocation),
[v10 validation](kalshi_walk_forward_v10_2026-08-24.md), and
[v11 execution consistency](kalshi_execution_consistent_v11_2026-08-30.md).
