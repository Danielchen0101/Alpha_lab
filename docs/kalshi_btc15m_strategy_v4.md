# Kalshi BTC 15-minute settlement-aligned carry v5

## Objective

Run continuously in Paper or Real mode with one auditable strategy. The robot
does not use AI reviews, random exploration, contrarian learning, or
trade-count limits. Profitability is not guaranteed; every decision and fill is
stored so thresholds can later be evaluated from actual out-of-sample results.

## Entry

- Trade only the model-confirmed favorite side with 60-720 seconds remaining
  in an active `KXBTC15M` contract.
- Require fresh reference and order-book data, sufficient history, a stable
  volatility regime, model/market agreement, a two-sided executable quote,
  bounded spread, depth, and positive fee-adjusted edge.
- Data, liquidity, volatility, fee-adjusted edge, and account exposure are hard
  gates. Trend and order-book pressure are adaptive confirmations: each
  disagreement adds 0.25 percentage points to the required edge rather than
  vetoing the setup.
- The default favorite probability floor is 58%; the default net and
  uncertainty-adjusted edge floors are 0.75% and 0.2% before adaptive premiums.
- The target variable is Kalshi's CF Benchmarks BRTI final-60-sample average.
  Until a licensed real-time BRTI feed is configured, the runtime uses a
  clearly labelled robust proxy from Coinbase, Bitstamp, Gemini, and Kraken,
  rejects venue outliers, and adds cross-venue dispersion to model uncertainty.
- Settlement-average variance uses the Brownian `T - 40 seconds` equivalent
  horizon instead of treating one exchange's final spot tick as settlement.
- Position size uses only order-book levels whose marginal price still clears
  fees and uncertainty, and the IOC limit is capped at the worst accepted level.
- Size with fractional Kelly, per-order risk, available cash, displayed depth,
  portfolio exposure, and a separate single-market exposure cap.
- There is no per-day or per-contract trade-count ceiling.

## Position management

- A stronger same-side signal may add to the position after the minimum add
  interval, but only if the absolute floors pass and probability or
  conservative edge improves versus the previous filled entry.
- Each add routes at most 50% of a newly calculated position size, preventing
  one strong five-second update from immediately doubling the position.
- Opposite signals never create an instant hedge. The robot first evaluates a
  reduce-only sale using executable bid depth and both entry and exit fees.
- New entries after a close observe a short anti-churn cooldown.

## Exit and settlement

- Holding to final settlement is the default.
- A normal early exit must be executable and better than the model's expected
  settlement value by the configured buffer, while also clearing the net
  profit floor after entry and exit fees.
- A normal take-profit reduces 50% by default. Reversal, protective, and
  emergency exits close the fillable position instead of leaving risk behind.
- A protective loss exit requires both meaningful probability deterioration
  and the configured loss gate. An emergency gate may bypass only the minimum
  hold time.
- Settlement has no trading fee.

## Real execution and records

- Paper and Real modes call the same deterministic strategy engine. Only the
  execution adapter changes.
- Real orders are backend-signed IOC limit orders sent to Kalshi's Event Market
  V2 order endpoint. Outcome-side prices are translated to Kalshi's single YES
  book and sells are marked `reduce_only`.
- Real balance, positions, orders, fills, and settlements are read from the
  authenticated Kalshi portfolio API. Canonical live and historical fills are
  merged and used to rebuild FIFO entry cost and realized P/L.
- Historical orders and fills are paginated in bounded batches and cached for
  15 minutes, while current portfolio data refreshes every cycle.
- Up to 250 compact decisions and 1,000 realized records are retained per mode.

## Paper execution realism

- Paper buys consume implied asks from Kalshi's public YES/NO bid ladders.
- Paper sells are reduce-only and consume the held side's bid ladder.
- Orders are IOC limits, may fill partially, and record VWAP, slippage,
  available depth, fees, rejected quantity, entry cost, and realized P/L.
- The general taker fee is rounded using
  `0.07 × contracts × price × (1 - price)`; an explicit market fee multiplier
  is honored when Kalshi supplies one.

## Durable online operation

- Robot state and Paper accounts are stored as user-scoped Supabase artifacts.
- Market/decision observations are upserted to
  `user_kalshi_market_observations` in deterministic 15-second buckets.
- Observation JSON includes the reference model, venue count and dispersion,
  settlement-average horizon, applied basis reserve, marginal executable
  depth and limit price. Settlement records join back by ticker for calibration.
- RLS allows authenticated users to read only their own observations; writes
  use the server-side service role.
- `claim_app_worker_lease` elects one online scheduler across backend
  instances, preventing duplicate background cycles after scaling or restart.
