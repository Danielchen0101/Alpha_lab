# Kalshi BTC dual-market strategy v6

## Scope and objective

AlphaLab runs two independent scanners through one execution and accounting
controller:

- `KXBTC15M`: rolling BTC 15-minute contracts.
- `KXBTCD`: hourly BTC price-above/below strike ladders.

Paper and Real modes use the same deterministic decision, sizing, add-on, exit,
and risk code. Paper routes against production public books; Real sends
backend-signed IOC limits to the user's Kalshi account. There is no daily trade
quota, random exploration, AI reviewer, deep-learning preset, or profitability
guarantee. Every evaluation and execution event is retained for out-of-sample
calibration.

## Authoritative data path

- Contracts and quotes come from Kalshi Trade API v2.
- Nearby hourly books use `GET /markets/orderbooks` in one request instead of
  one request per strike.
- The primary BTC reference is the authenticated Kalshi WebSocket
  `cfbenchmarks_value` stream for CF Benchmarks `BRTI`, emitted about once per
  second.
- During a quarter-hour's final minute, the model consumes Kalshi's
  `last_60s_windowed_average_15min`. Before all 60 observations arrive, the
  observed official average is flat-forward completed with the latest BRTI
  value; at sample 60 it is the exact official average.
- Coinbase, Bitstamp, Gemini, and Kraken form a labelled robust fallback only
  if BRTI credentials or the stream are unavailable. The fallback keeps a
  higher price floor and basis/dispersion reserve.
- One-minute Coinbase OHLC data estimates realized volatility and bounded
  momentum. It is not used as the settlement price.

## Probability models

### BTC 15-minute

1. Compute log distance between official BRTI settlement estimate and the
   contract's `floor_strike`.
2. Estimate one-minute volatility from EWMA close returns plus a Garman-Klass
   range component.
3. Convert remaining time to the variance-equivalent horizon for a final
   60-second average: approximately `T - 40 seconds`.
4. Convert standardized distance through a normal CDF. Momentum contributes a
   small bounded adjustment; high short/long volatility ratios damp confidence.
5. Blend the model with executable Kalshi microprice. Default market weight is
   45%, scaled down when spread or depth quality is poor.

### BTC hourly ladder

Each nearby strike first receives an executable book probability. Weighted
pool-adjacent-violators fitting enforces the required monotone relationship:
the probability of finishing above a strike cannot rise as the strike rises.
Each contract combines 60% of its own microprice with 40% of the fitted ladder,
then passes through the same distance, volatility, fee, uncertainty, and risk
engine. The robot ranks every strike and routes at most the strongest valid
candidate in a cycle.

## Entry criteria

The default 15-minute entry window is 60-840 seconds before close. The hourly
window is 120-1,800 seconds. An entry requires all hard gates:

- active contract, sufficient history, fresh reference and book timestamps;
  a missing timestamp is stale by definition and blocks entry;
- two-sided executable book, spread no more than 6 cents and relative spread
  no more than 20%;
- at least five contracts of marginal depth that remain profitable at their
  actual price;
- selected favorite probability at least 64% for both the 15-minute and
  hourly-strike scanners;
- price 47-92 cents with official BRTI (fallback remains at least 50 cents);
- net edge after quadratic Kalshi fee at least 1.00 percentage point;
- uncertainty-adjusted edge at least 0.75 percentage points;
- realized daily loss remains below 2.0% of current bankroll;
- model/market gap, volatility, jump, cash, open-order, and exposure gates.

The daily-loss gate is entry-only. At or beyond the configured threshold it
blocks new buys and add-ons, while the controller may still submit reduce-only
protective exits, take-profit reductions, and settlement reconciliation.

Multi-horizon momentum and top-book pressure are adaptive rather than hard
vetoes. Each disagreement adds 0.25 percentage points to both edge floors. This
prevents the previous all-signals-must-agree deadlock without buying negative
expected-value trades merely to create activity.

## Sizing and add-ons

The unscaled hard loss budget is 0.50% of bankroll. The engine then applies two
auditable haircuts before comparing that budget with fractional Kelly (15%):

1. Signal quality maps probability and conservative edge independently from
   their entry floors to their full-risk targets (75% probability and 3.0%
   conservative edge). The geometric mean requires both components to be
   strong. `minimumRiskBudgetScale` defaults to 35%, so a barely valid signal
   cannot receive the full hard loss budget.
2. Favorite prices above 75 cents receive a linear payout-compression haircut.
   The multiplier reaches `highPriceRiskFloor`, 50% by default, at the maximum
   allowed entry price.

The applied budget is therefore:

`min(fractional Kelly budget, hard loss budget × quality scale × price scale)`.

Available cash, 20% of edge-eligible depth, 10% portfolio exposure, and 2%
per-market exposure remain additional caps. Decisions expose
`probabilityStrength`, `edgeStrength`, `qualityRiskScale`, `priceRiskScale`,
`appliedRiskScale`, `scaledHardRiskBudget`, and `kellyRiskBudget`, so a reviewer
can reproduce every size. The same payload also exposes `dailyPnl`,
`dailyRealizedLoss`, and `dailyLossLimit`.

This haircut addresses payoff asymmetry: one adverse favorite can lose much
more capital than one correct favorite earns. It is a deterministic risk policy,
not an inferred win rate or a profitability claim, and still requires
out-of-sample calibration.

A same-side add-on is allowed only after 90 seconds when favorite probability is
at least 64%, conservative edge is at least 0.75%, and both probability and edge
improve versus the previous filled entry. Each add uses at most 25% of newly
calculated size. There is no trade-count cap.

Persisted 15-minute configurations must be migrated idempotently: add the five
new sizing keys when absent and preserve stricter user values while enforcing
safe floors of 64% model probability, 1.00% net edge, 0.75% conservative edge,
and a 92-cent maximum price. Durable configuration also enforces 0.50% maximum
per-trade risk, 15% fractional Kelly, 10% portfolio exposure, 2% single-market
exposure, a 90-second minimum add interval, a 25% add fraction, at least a
1.00-point probability improvement and 0.10-point conservative-edge
improvement for adds, a 60-second minimum hold, a 90-second reversal cooldown,
and a daily-loss limit between 0.10% and 2.0%. This prevents an older stored
configuration from silently overriding the safer engine defaults.

## Exit and settlement

Holding to settlement is the baseline when expected settlement value exceeds
an executable sale. A normal early exit must remain profitable after allocated
entry fee, sale fee, spread, and a 1% value buffer; take-profit sells 50% by
default. A reversal or protective exit is reduce-only and cannot create the
opposite position. Protective exits require both probability deterioration and
a material loss; emergency deterioration may bypass only the minimum 60-second
hold. After a full close, a 90-second anti-churn cooldown applies. A normal
post-close re-entry must then pass a stronger confirmation gate: model
probability is at least the stricter of 70% or five points above its entry
floor, and conservative edge is at least the stricter of 1.25% or 0.50 points
above its entry floor. Protective or emergency exits remain blocked for the
rest of that contract cycle.

When several hourly strikes are held, the controller first ranks every
executable risk reduction: fillable emergency exit, fillable protective exit,
then profitable reduction. Unfillable emergency/protective exits remain ahead
of every add and produce an auditable wait, but can no longer starve a sibling
position whose protective exit is executable.

## Execution realism and records

Paper buys consume implied asks from Kalshi's YES/NO bid books; sells consume
the held side's bids. IOC orders can partially fill and record matched levels,
VWAP, slippage, rejected quantity, trade fee, rounding fee, fee-accumulator
rebate, and realized FIFO P/L. The quadratic fee is
`0.07 × contracts × price × (1 - price)`, rounded to `$0.0001`; account balance
rounding and per-order accumulated rebates follow Kalshi's documented model.
Settlement itself has no trading fee.

Supabase retains user-scoped robot state, Paper account ledgers, compact
decisions, orders, fills, settlements, realized records, per-family P/L, and
15-second market observations. A database worker lease elects one online
scheduler, so multiple backend instances cannot duplicate orders.

All Real enable/disable, mode-change, configuration-save, connection-test,
credential-delete, and final POST operations share a user-scoped durable
routing fence. Irreversible paths bypass every process-local credential cache
and read the latest durable record while holding that fence. The executor then
paginates fresh signed reads of balance, positions, and open orders and
revalidates cash, account ownership, daily loss, portfolio/ticker/event
exposure, the latest durable state, and the stronger re-entry gate. Missing or
incomplete credentials or account resources fail closed. Realized daily P/L is
recomputed idempotently from both early-sale and settlement records.

Durable artifacts use optimistic version checks. A stale worker must reload
instead of overwriting a newer Paper ledger or robot state. When a developer
runs the backend with the Kalshi scheduler disabled, reconciliation and live
marking are read-only: local page views cannot mutate the online account.

Performance cards report unique settled/traded markets separately from
realized events. Partial exits are several realized events from one market, so
the displayed event win rate is an execution diagnostic, not a claim that each
partial fill was an independent forecast trial.

## Official references

- https://docs.kalshi.com/websockets/cfbenchmarks-value
- https://docs.kalshi.com/api-reference/market/get-multiple-market-orderbooks
- https://docs.kalshi.com/getting_started/orderbook_responses
- https://docs.kalshi.com/getting_started/fee_rounding
- https://docs.kalshi.com/getting_started/rate_limits
- https://docs.kalshi.com/api-reference/orders/create-order-v2
- https://docs.kalshi.com/api-reference/portfolio/get-fills
- https://docs.kalshi.com/api-reference/portfolio/get-positions
