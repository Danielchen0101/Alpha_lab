# Kalshi BTC walk-forward policy v10 — 2026-08-24

## Objective and decision rule

This review optimizes for realized profit factor and drawdown, not headline
win rate.  A rule is eligible for Real routing only when it is evaluated at
the first chronologically executable observation and remains positive across
the pre-declared train, validation, and holdout blocks.  Complete ticker-level
P/L is used; partial exits are not counted as independent wins.

No strategy can guarantee profit.  These results are small-sample evidence
for bounded risk controls, not a promise of future returns.

## Production evidence

The AlphaLab-only Real ledger contained 107 BTC15 markets and 20 hourly BTC
markets at review time.  BTC15 won 65.4% but lost $0.6200 after fees because
the average loss was about twice the average win.  Hourly BTC was positive by
$0.6352, but its 20-market sample is too small for aggressive recalibration.

For v9 BTC15, low-priced entries were the main failure mode.  The 70–80c
champion was replayed from production observations against official finalized
Kalshi outcomes, using the first two same-ticker/same-side qualifying frames,
the actual 25-second confirmation limit, a fixed 0.30-contract comparison
size, and exact fee/cash rounding:

| Segment | Markets | Profit factor | Net P/L |
| --- | ---: | ---: | ---: |
| Train | 13 | 1.458 | +$0.22 |
| Validation | 5 | 1.167 | +$0.04 |
| Holdout | 7 | 1.565 | +$0.13 |
| Total | 25 | 1.411 | +$0.39 |

Two frequency relaxations failed the same test:

- Extending confirmation to 45 seconds produced 31 markets, but train profit
  factor fell to 0.737 and train P/L became negative.
- Lowering the BTC15 net/conservative edge floors increased the total sample,
  but train profit factor fell below 1.

For hourly BTC, the multiple-candidate penalty was not the main volume
constraint.  Removing it produced 10 first-eligible events with five wins and
approximately -$1.65 per standardized one-contract sequence.  Reducing its
weight from 0.15 to 0.10 released four events and only one won.  The live
hourly edge, depth, and candidate-penalty policy therefore remains unchanged.

## v10 production policy

Real BTC15 routing uses the walk-forward champion:

- price band: 70–80c;
- net edge: existing 1.0 percentage-point floor plus adaptive premiums;
- conservative edge: 1.5 percentage-point floor plus adaptive premiums;
- two consecutive same-ticker/same-side snapshots within 25 seconds;
- unchanged official-BRTI freshness, spread, depth, volatility, fee,
  order-economics, Kelly, cash, and exposure gates.

The hourly policy retains its v9 48–78c envelope, 1.5 percentage-point edge
floors, 0.60 market blend, 20-minute window, and 0.15 candidate penalty.

## Non-routing challenger

Every BTC15 cycle also evaluates the exact same immutable market snapshot with
0.5pp net edge and 1.0pp conservative edge, then records whether that snapshot
is a qualifying frame for a two-frame, 45-second confirmation policy.  This
second evaluation makes no network request and is explicitly
`routeAllowed=false`; it cannot submit an order.  Both champion and challenger
diagnostics are persisted in the market-observation row so future analysis can
reconstruct consecutive confirmations against untouched finalized outcomes
rather than reselecting a favorable frame.  Challenger evaluation failures are
isolated and recorded by exception type, so shadow observability cannot stop a
validated champion cycle.

The challenger may be considered for promotion only after at least 50 new
finalized markets, three consecutive out-of-sample windows with profit factor
above 1.10, positive aggregate after-fee P/L, and drawdown no worse than the
champion over the same interval.

## External mechanics checked

The review revalidated that KXBTC15M resolves from the average of the final 60
one-second CF Benchmarks BRTI observations.  It also revalidated the July 7,
2026 Kalshi general taker-fee formula `ceil(0.07 * C * P * (1-P))`; AlphaLab
continues to consume the live fee policy and applies exact order-level cash
rounding.
