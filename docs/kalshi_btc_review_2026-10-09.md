# Kalshi BTC execution and net-outcome review — 2026-10-09

## Findings

The current production scheduler is running. Intermittent missing/stale official
BRTI still prevents hourly evaluation, but valid fresh official-reference frames
also exist. This is not the earlier expired-hosting incident or an unfunded
Crypto shard. Depth blockers often mean **no depth at a price preserving the
required edge**, not an empty order book.

The scoped September 5–October 9 observation audit contained 73,215 BTC15 rows
and 54,647 hourly rows. Hourly produced no submitted orders and only 21
qualifying first frames. A confirmed selection defect discarded a still-valid
pending strike when a sibling's score became slightly higher: two fresh frames
17.28 seconds apart both qualified the original strike, but the selector changed
strikes and restarted confirmation. Sampled row gaps alone were not used to
relax the 25-second confirmation limit.

The initial BTC15 audit excluded partial-sale markets whose recorded settlement
quantity exceeded the remaining position. This was an accounting defect, not
proof of manual mixing. Kalshi can represent a sale as an opposite-side gross
purchase in settlement history. Adding its full original cost to a previously
realized partial sale duplicated cost basis. Authenticated entry and sale fills
must determine residual quantity, cost and entry fees.

Reconciliation with fresh authenticated fills and official settlements repaired
20 partial-sale markets and recovered one fully closed outcome. The corrected
recent v11 sample is:

| Metric | BTC15 v11 (September 6–October 9) | Hourly historical sample |
| --- | ---: | ---: |
| Quantity-complete markets | 108 | 20 |
| Positive / negative outcomes | 80 / 28 | 12 / 8 |
| Positive outcome rate | 74.07% | 60.00% |
| Net trading P/L | +$0.5331 | +$0.6352 |
| Profit factor | 1.0216 | 1.2867 |
| Average positive outcome | $0.3148 | — |
| Average loss magnitude | $0.8805 | — |
| Observed payoff break-even rate | 73.66% | — |
| Completed-market drawdown | $5.0410 | — |

The earlier 87-market subset returned -$6.1007 because many repaired partial-sale
winners were omitted. It must not be presented as full-policy performance.
All 215 complete BTC15 historical markets, including older policies, total
-$0.1040. Neither the near-break-even v11 result nor the small hourly sample
establishes stable profitability. Trading P/L excludes hosting, subscriptions,
taxes, open-position drawdowns, and any future larger-size execution effects.
No private exports, credentials, user IDs or raw account records are committed.

## Changes

- **Hourly selection:** prioritize an unconfirmed pending strike only while a
  fresh evaluation still passes every entry gate and the multiple-candidate
  penalty, on the same side/event and within the original confirmation window.
  Owned-position exit management takes precedence. Preserve raw score rank and
  expose why a pending candidate was retained.
- **Accounting:** combine distinct fills of a SELL order without dropping their
  P/L, avoid replay duplicates, and reconcile partial-sale settlement residuals
  from complete canonical fill economics. Do not infer cost from gross
  settlement fields when there is a realized sale. Preserve already verified
  records when subsequent history pages are truncated. Settlement forecasts
  come from entries, not a later sell's near-expiry probability.
- **Daily stop:** three consecutive completed fee-net losses pause entries and
  additions for that family until midnight in `America/New_York`. Count hourly
  strikes in one event together; incomplete positions and partial sales do not
  count separately. A zero/positive result interrupts the streak before the
  stop fires. Once stopped, late wins, restarts and configuration edits cannot
  reopen that day's entries. Position exits remain available.
- **Sizing:** support a per-order maximum loss of 15% of account equity,
  including fees. It is a ceiling, not a target: fractional Kelly, quality and
  price haircuts, market/event exposure, shared account exposure, available
  shard cash, exact rounding and executable depth still restrict actual size.
  New defaults use 15% order, event and shared portfolio ceilings; simultaneous
  BTC exposures do not each receive a separate unrestricted 15% allocation.
  Final routing rechecks the latest per-order cap as well as event and total
  exposure. Existing users' saved limits are preserved during migration;
  applying a higher limit is a separate account-scoped configuration action.
- **Reference evidence:** reject invalid source clocks instead of substituting
  receipt/current time. Both status and decisions require fresh source and
  cache timestamps. Surface sanitized authentication, entitlement, rate-limit
  and upstream failure categories without leaking credentials.
- **Auditability:** strategy version 12 separates future observations from v11;
  preserve existing entry thresholds, durable ledgers and Real arming state.

The fixed-recorded-outcome simulation of the requested three-loss rule removes
one subsequent winning trade in this sample: net +$0.2858 versus +$0.5331,
profit factor 1.0116 versus 1.0216, and completed-event drawdown $5.2883 versus
$5.0410. This is a risk preference, not an empirically proven profit improvement.
The replay uses only outcomes completed before a later entry; already-open
positions remain included. It does not simulate changed fills or future state.

The 11 fully sold v11 markets would have improved by about $1.8858 if held to
official settlement. That small retrospective sample does not justify disabling
protective exits. No price/side/time filter was selected after inspecting these
same outcomes, and no synthetic OHLC replay is called a production backtest.

## Verification and rollout

Regression coverage includes candidate churn with a still-valid second-ranked
strike, stale/invalid/future frames, conflicting sides, held-position priority,
partial sales and multiple SELL fills, replay/truncated-history preservation,
fee-inclusive sizing, a cap lowered after a decision, two market families,
mode isolation, sticky loss stops and New York daylight-saving boundaries.

Local verification passed the full 1,125-test backend suite, the final 381-test
accounting/risk/routing/audit subset, 38 Kalshi frontend tests, TypeScript, ESLint
and the production frontend build. CI also passed backend, frontend and browser
smoke tests. Release validation found an existing Axios high-severity advisory;
minimal Axios 1.20.0 and React Router DOM 6.30.6 updates passed 63 relevant
frontend tests and the production high/critical dependency gate. Two moderate
router advisories still require a major-version upgrade. The isolated backend
dependency audit found no known vulnerabilities in 62 resolved packages.

Run the offline audit against a private export with:

```sh
python scripts/kalshi_backtest/kalshi_owned_performance.py /path/to/private-state.json --loss-stop-threshold 3
```

A raw export with the old accounting defect must first be reconciled against
complete authenticated broker history. The audit does not invent missing fills.
Its chronological splits are descriptive, not untouched holdouts.

Production uses the existing CI-approved `main` deployment mechanism. A GitHub
push or passing tests alone does not prove production has deployed. Verify the
running release and fresh strategy-version-12 observations, then apply the
requested account-specific ceiling through the configuration-only endpoint/UI.
Do not change arming state, move shard collateral or submit a test trade.
Evaluate complete future events after fees before promoting new signal rules.

## Research sources

- [Kalshi crypto settlement rules](https://help.kalshi.com/en/articles/13823838-crypto-markets): BTC15 uses starting/ending 60-second BRTI averages; the hourly ladder compares its final average with the strike.
- [Official BRTI stream](https://docs.kalshi.com/websockets/cfbenchmarks-value): source timestamps and raw/reference-window semantics.
- [Order-book semantics](https://docs.kalshi.com/getting_started/orderbook_responses) and [fee rounding](https://docs.kalshi.com/getting_started/fee_rounding): executable opposite bids, actual costs and cash rounding.
- [Historical data](https://docs.kalshi.com/getting_started/historical_data) and [API changelog](https://docs.kalshi.com/changelog): live endpoints omit archived records; archived positions are audit evidence, not open exposure. Long-range completeness still requires both live and historical sources.
- [The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf) and [The Deflated Sharpe Ratio](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf): repeated parameter selection and small samples can overstate performance.
