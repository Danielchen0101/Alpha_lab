# Kalshi BTC stable-return strategy v7

This document supersedes v6 as the active `KXBTC15M` and `KXBTCD` policy.

## Objective and evidence

This release optimizes fee-adjusted net return and loss recovery before raw
trade count. It does not promise profit. The policy remains deterministic,
auditable, and fail-closed for both `KXBTC15M` and `KXBTCD`.

The post-display-baseline Real ledger used for this change contained 42
realized events: 34 wins, 8 losses, `$2.6295` total P/L, `1.551` profit factor,
`$0.2177` average win, and `$0.5965` average loss. One average loss therefore
required about `2.74` average wins to recover. The hourly subset was stronger
than the 15-minute subset, but the sample is too small for a profitability
claim. A retrospective hard recovery cap also removed profitable high-price
trades, so v7 applies a soft price/recovery penalty instead of banning them.

## Entry and payoff policy

- Kalshi's current series fee coefficient is read from the series and scheduled
  fee-change endpoints. The general `0.07` coefficient is the fail-safe
  fallback. Maker execution remains shadow-only and can never route an order.
- The engine calculates the trade fee to `$0.0001`, then models the whole-order
  cash debit rounded up to the next cent. Expected value, cash, risk, and
  exposure checks all use this all-in debit.
- Each candidate exposes maximum loss, profit after fees on a win, break-even
  probability, and `maximum loss / win profit` recovery multiple.
- Recovery multiple above `2.0` adds `0.30` percentage points of conservative
  edge per excess unit, capped at `2.0` percentage points. This is an adaptive
  premium, not a hard blocker.
- A new position must remain on the same ticker and side for two consecutive
  scheduler snapshots. BTC15 uses a 25-second maximum gap, calibrated to the
  production cycle's reference, order-book, and account-read latency; hourly
  markets retain the generic 15-second gap. Browser refreshes do not advance
  the durable confirmation streak.

BTC 15-minute contracts use three stages:

| Stage | Time to close | Extra edge | Extra uncertainty |
| --- | ---: | ---: | ---: |
| Early | above 420 seconds | 0 | 0 |
| Middle | 181-420 seconds | 0.25 pp | 0.50 pp |
| Late | 60-180 seconds | 0.50 pp | 1.00 pp |

These stage premiums never apply to the hourly strike ladder. Hourly candidates
instead receive a multiple-comparison shrinkage penalty proportional to model
uncertainty and `sqrt(2 log(candidate count))`. Selection ranks candidates by
whether the shrunken conservative edge clears the full effective edge floor,
then by shrunken score. The top 12 diagnostics are persisted for review.

## Fixed-point sizing and risk

Kalshi V2 quantities are represented internally in hundredths of a contract.
The default quantity step is `0.01`; orders below `0.10` contracts are rejected
as uneconomic. Integer sizing remains available only as an explicit
compatibility mode.

The normal loss budget remains the lower of fractional Kelly and the
quality/price-scaled `0.50%` hard budget. When that budget cannot buy one full
contract, a strong signal that clears the existing micro-edge floors may use a
`1.50%` small-account target. The normalized configuration cannot exceed `2%`.
Cash, Kelly, book participation, portfolio exposure, single-market exposure,
and exact cent-rounded debit remain authoritative caps.

The final fixed-point quantity is stepped down until the exact debit fits every
cap. The order is blocked when expected value is non-positive or all-in fees
consume more than 20% of the potential gross win. A literal zero balance or
zero available cash never falls back to a configured paper bankroll.

## Position management

- Profitable exits still require executable value after entry fee, exit fee,
  spread, and the configured value buffer.
- An ordinary protective loss exit must persist for three durable scheduler
  snapshots. BTC15 uses a 30-second maximum gap so a persistent deterioration
  can complete the streak despite normal production latency; hourly markets
  retain the generic 20-second gap. A true emergency loss exit is immediate
  and is not delayed by confirmation.
- Every exit is a reduce-only sale of the held outcome. No complementary buy is
  treated as a close.
- Fractional inventory, ownership, fresh account cash, open orders, and event
  exposure are revalidated from authenticated account reads immediately before
  a Real order is signed.
- When several hourly strikes are held, executable emergency/protective exits
  retain priority over adds or new strikes, including positions below one
  contract.

## Accounting and diagnostics

Paper and Real normalization prefer fixed-point quantities and preserve an
explicit `0.00` rather than falling back to a stale integer field. Paper fills
model centicent trade fees, cent-aligned balance changes, order-level rounding
rebates, partial reduce-only sales, FIFO cost basis, and fractional settlement.

The UI separates BTC 15-minute and hourly performance and reports average win,
average loss, loss-recovery multiple, profit factor, maximum drawdown, worst
trade, and net P/L. It also shows planned fixed-point size, maximum planned
loss, and risk budget. Current scheduler/account/data failures take precedence
over historical opportunity blockers. Truncated trade records are never mixed
with full-period aggregates.

Each observation retains entry/exit confirmation state, hourly candidate
ladder, hold-versus-exit counterfactual, maker shadow result, fee policy, and
expected-versus-actual fee reconciliation. These fields support forward
calibration without changing live execution from retrospective results.

## Rollout and rollback

Deploy backend and frontend from the same revision because the execution and
display contracts add fixed-point fields together. Keep maker routing disabled.
Monitor fill rejection, fee variance, recovery multiple, per-family profit
factor, maximum drawdown, entry-confirmation attrition, and hourly shrinkage
attrition. Roll back by reverting this revision; durable ledgers remain
compatible because quantity fields are additive and old integer records are
still readable.

## Official references

- https://docs.kalshi.com/api-reference/orders/create-order-v2
- https://docs.kalshi.com/getting_started/fixed_point_migration
- https://docs.kalshi.com/getting_started/fee_rounding
- https://docs.kalshi.com/api-reference/exchange/get-series-fee-changes
- https://kalshi.com/docs/kalshi-fee-schedule.pdf
