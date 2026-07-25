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
- two-sided executable book, spread no more than 6 cents and relative spread
  no more than 20%;
- at least five contracts of marginal depth that remain profitable at their
  actual price;
- selected favorite probability at least 58% (56% for the hourly scanner);
- price 47-95 cents with official BRTI (fallback remains at least 50 cents);
- net edge after quadratic Kalshi fee at least 0.75 percentage points;
- uncertainty-adjusted edge at least 0.20 percentage points;
- model/market gap, volatility, jump, cash, open-order, and exposure gates.

Multi-horizon momentum and top-book pressure are adaptive rather than hard
vetoes. Each disagreement adds 0.25 percentage points to both edge floors. This
prevents the previous all-signals-must-agree deadlock without buying negative
expected-value trades merely to create activity.

## Sizing and add-ons

Size is the minimum of fractional Kelly (25%), 0.75% bankroll risk, available
cash, 20% of edge-eligible depth, 25% portfolio exposure, and 8% per-market
exposure (6% hourly). A same-side add-on is allowed only after 45 seconds when
favorite probability is at least 64%, conservative edge is at least 0.75%, and
probability or edge improves versus the previous filled entry. Each add uses at
most 50% of newly calculated size. There is no trade-count cap.

## Exit and settlement

Holding to settlement is the baseline when expected settlement value exceeds
an executable sale. A normal early exit must remain profitable after allocated
entry fee, sale fee, spread, and a 1% value buffer; take-profit sells 50% by
default. A reversal or protective exit is reduce-only and cannot create the
opposite position. Protective exits require both probability deterioration and
a material loss; emergency deterioration may bypass only the minimum 60-second
hold. After a full close, a 90-second anti-churn cooldown applies.

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
