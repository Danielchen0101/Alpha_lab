# AlphaLab Crypto Adaptive Trend v1.2

## Product boundary

AlphaLab Crypto is a 24/7 spot-crypto research and automation workspace. The
first release is deliberately limited to BTC/USD and ETH/USD, runs long/flat,
and supports `BUY`, `ADD`, `HOLD`, `REDUCE`, and `EXIT`. It does not short, use
margin, average down, or allow an AI model to bypass deterministic risk gates.

No public strategy, open-source bot, backtest, or AI model can guarantee future
profit. The product therefore reports evidence after fees, drawdown, turnover,
and Paper-vs-Live execution drift instead of presenting a profit promise.
The strategy is not admitted for Live automation; the deployment gate remains
closed by default.

## Why this strategy

The research record is mixed rather than uniformly bullish:

- Liu, Tsyvinski, and Wu's *Common Risk Factors in Cryptocurrency* documents
  momentum and other common crypto risk factors, but its broad cross-sectional
  long/short portfolio cannot be copied into an Alpaca spot-only account.
- *Cryptocurrency momentum has (not) its moments* finds that ordinary crypto
  momentum is not robust across the full sample and can suffer severe tail
  events. Volatility scaling helps but does not remove this risk.
- *A Decade of Evidence of Trend Following in Cryptocurrencies* provides a
  reproducible BTC trend-following hypothesis, while also finding little
  evidence for intraday trend trading. Its old sample and preprint status mean
  it is a starting hypothesis, not proof of future returns.
- Freqtrade and Hummingbot demonstrate that automated crypto infrastructure has
  real users. Stars and trading volume do not prove that any bundled strategy
  is profitable. AlphaLab borrows their dry-run, bias-check, and audit ideas,
  not their code or return claims.

During the 2026-07-18 review, Freqtrade showed about 51.5k GitHub stars, 10.7k
forks, and 114 releases; its own README tells users to begin in Dry-Run and
disclaims trading results. Hummingbot showed about 19.2k stars and 4.8k forks,
and its maintainers reported more than $34 billion of user-generated volume
across 140+ venues in the preceding year. Those figures support the conclusion
that automation frameworks are used in practice. They do **not** establish
the profitability of a strategy, survivorship-free user returns, or suitability
for an Alpaca spot account.

Primary references:

- <https://onlinelibrary.wiley.com/doi/10.1111/jofi.13119>
- <https://osuva.uwasa.fi/bitstream/handle/10024/20018/Osuva_Grobys_Kolari_Sandretto_Shahzad_%C3%84ij%C3%B6_2025.pdf?sequence=2>
- <https://arxiv.org/abs/2009.12155>
- <https://github.com/Globe-Research/bittrends>
- <https://github.com/freqtrade/freqtrade>
- <https://github.com/hummingbot/hummingbot>

## Deterministic signal

Signals update only after a complete one-hour bar. The evidence score is an
explainable 0–100 rules score, not a probability or expected return. It starts
at 50 and applies the following causal evidence available at that close:

| Evidence | Score change |
| --- | ---: |
| EMA10 above / below EMA40 | +15 / -15 |
| Close above / below EMA10 | +10 / -10 |
| 20-day momentum positive / non-positive | +20 / -15 |
| 65-day momentum positive / non-positive | +20 / -20 |
| Close above the prior 20-day high | +20 |
| Close within 3% of that high | +5 |
| Close below the prior 10-day low | -35 |
| Realized volatility inside the preferred band / above the hard gate | +10 / -20 |
| Non-zero reported volume | +5 |

The regime is `breakout`, `trend`, `transition`, `defensive`, or `risk_off`.
A new entry requires EMA and both momentum horizons to agree, a score of at
least 60, and two consecutive completed-hour confirmations. A slower negative
trend also requires two completed bars to exit; a 10-day breakdown, protective
stop, or capital circuit exits without waiting for that confirmation.

Position sizing uses inverse volatility at entry, capped by account risk. Once
held, the position is not resized every hour as the rolling volatility estimate
drifts. An add requires a fresh 20-day breakout, score of at least 80, price at
least 3% above the latest cost/add reference, and at least a two-percentage-point
allocation gap. The engine never averages down. A low-score or extreme-
volatility reduction uses a fixed defensive tier and the same allocation band,
preventing a sequence of tiny rebalances.

The initial allocation is inverse-volatility weighted and capped by account
risk. Product-level defaults cap BTC at 12% of equity, ETH at 8%, and total
crypto exposure at 20%. The standalone engine's default
`max_asset_weight` is also 20%, but this is a validated configuration default,
not an invariant hard upper bound; product policy can tighten or otherwise
adjust it. Stop distance is
`clamp((2.5 × 24-hour ATR) / close, 2%, 12%)`. The backtest records that stop
at the next-open fill and never loosens it after an add.

Live and backtest position state follow the same fill-based contract. The
latest confirmed `BUY` or `ADD` fill becomes the last-add reference. Its stop
candidate is the fill price less the signal's stop distance, and the persisted
protective stop is the greater of that candidate and the stop already in
force. A partial reduction preserves both values; a confirmed flat position
clears them. An accepted, new, pending, cancelled, or rejected order is not a
fill and cannot advance or clear this state. Broker-only legacy positions may
bootstrap one stop from broker average entry when no persisted stop exists;
that stop is then held fixed unless a later confirmed fill tightens it. This is
not an ATR trailing stop.

The current stop is a completed-bar strategy threshold, not a broker-native
continuous protective order. The engine tests each completed hourly close
against the persisted stop; a breach queues an `EXIT` for the following hour's
open. Intrahour moves and opening gaps can therefore pass through the threshold.
This mechanism does not guarantee a maximum loss or continuous broker-side
protection.

## AI reviewer contract

The AI is a constrained reviewer, not the risk engine. It receives a compact
evidence packet and returns structured action, confidence, counter-evidence,
and an invalidation condition. It may veto an entry or reduce risk. It may not:

- add a new asset;
- exceed a target weight;
- convert a reduction into an entry;
- remove a stop or circuit breaker;
- submit an order when account, quote, spread, liquidity, or idempotency checks
  fail.

The order executor validates the final action again after the AI review.

The provider and model come from the authenticated user's Settings record.
Only non-secret provider metadata is shown in the Crypto workspace and the
review source is retained in the decision audit record. If the configured
provider is unavailable, Live entries fail closed; deterministic exits and
risk reductions remain available.

## Long-horizon Paper research

Optional research is deliberately restricted to Paper mode and runs inside the
same durable 24/7 scheduler. At the chosen cadence, the service rotates between
the configured BTC/USD and ETH/USD universe and compares the saved mandate
against four bounded challengers: multi-horizon time-series momentum,
liquid-crypto momentum, volatility-scaled trend, and a lower-turnover,
cost-aware breakout. The service never downloads or executes third-party code;
published work supplies hypotheses and provenance only.

Every candidate is replayed over three independent, non-overlapping 60-day
evaluation windows. Each window has candidate-specific warm-up history, and all
comparisons use the same next-bar execution convention, configured fees,
slippage, and terminal liquidation accounting as the normal backtest. The
robust score uses the weakest window and penalizes drawdown and turnover. A
challenger can replace the Paper mandate only when all three windows remain
positive after costs, each contains actual trades, drawdown stays within 12%,
and the weakest-window score materially exceeds the incumbent. The latest 12
research summaries are retained with the account runtime and every completed
run is written to the audit trail.

The process never changes symbols, account risk limits, order authority, or the
Live strategy, and it never promotes a Paper result to Live. This is controlled
model selection over a small, versioned library—not unrestricted strategy
invention and not evidence of future profitability.

Research provenance:

- *Time Series Momentum* — Moskowitz, Ooi and Pedersen:
  <https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum>
- *Impact of Size and Volume on Cryptocurrency Momentum and Reversal* —
  Fičura and Colak: <https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4378429>
- *Adaptive Risk Allocation in Crypto Markets* — Habeli, Barakchian and
  Motavasseli: <https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5090097>
- *Machine Learning-Based Bitcoin Trading Under Transaction Costs* — Bysik
  and Ślepaczuk: <https://arxiv.org/abs/2606.00060>

## Alpaca contract

Alpaca supports 24/7 spot crypto in Paper and eligible Live accounts. Live is
allowed only when `/v2/account` reports `crypto_status=ACTIVE` and the account
is not blocked, suspended, or trading-blocked. Eligibility is jurisdiction- and
account-dependent; the UI never infers it from an API key alone.

The asset catalog is refreshed from `/v2/assets?asset_class=crypto&status=active`,
and its current minimum order size, quantity increment, and price increment are
applied at order time. Market and limit orders may use GTC or IOC; stop-limit
orders use GTC because Alpaca does not support stop-limit with IOC. Stock-only
DAY, extended-hours, bracket, OCO, and short-sale semantics are prohibited.
Each automated order has a stable `client_order_id`; existing open orders are
reserved against exposure, and a timed-out submission is reconciled before any
retry.

Official references:

- <https://docs.alpaca.markets/us/docs/crypto-trading>
- <https://docs.alpaca.markets/us/docs/crypto-orders>
- <https://docs.alpaca.markets/us/docs/crypto-fees>
- <https://docs.alpaca.markets/us/docs/real-time-crypto-pricing-data>

## Cost and validation standard

The baseline backtest charges a 0.25% taker fee on every fill and applies a
five-basis-point adverse execution adjustment on every buy and sell. That
adjustment is a coarse spread/slippage allowance, not a calibrated order-book
impact model. It executes strategy signals only at the next bar's open. Any
position still open at the dataset boundary is forcibly liquidated at the
final close with sell-side slippage and fees; that boundary event is labeled
`TERMINAL_EXIT` rather than presented as a strategy signal. The reported ending
equity, fees, turnover, trade count, fill ledger, and benchmark all include
that liquidation.

A queued action cannot reverse direction because of an opening gap: `BUY` and
`ADD` may only buy or cancel, while `REDUCE` and `EXIT` may only sell or cancel.
The strategy and benchmark are evaluated on the same timestamp window, from
the first fully warmed-up close through the final close. The benchmark remains
in cash at the first point, buys at the first executable next open, and uses
the same terminal liquidation convention.

Input must be strictly ascending, contiguous one-hour OHLCV data. Duplicate,
missing, or sub-hourly timestamps fail closed because a bar-count lookback
would otherwise cease to represent the documented elapsed hours and days.
Zero-volume midpoint bars are still not proof that a live order could fill.

Before Live can be considered, the strategy must pass anchored walk-forward and
locked holdout tests, then at least 60 days of Paper execution. The release gate
requires, after fees, a combined out-of-sample Sharpe of at least 0.75, Calmar
of at least 0.5, maximum drawdown no worse than 20%, positive results in at
least two-thirds of walk-forward windows, and survival under doubled costs.
These are admission criteria, not a return guarantee.

### Current research admission status

The strategy is **not admitted for Live automation**. A 2026-07-18 one-year
sanity run failed the net-return, Sharpe, and Calmar gates. Engine v1.2 also
corrected terminal liquidation and fee accounting, so pre-v1.2 figures are not
carried forward as current evidence. No valid rerun has passed the admission
standard. Alpaca data, locked walk-forward windows, doubled-cost stress, and at
least 60 days of observed Paper execution still govern admission.

## Independent circuit breakers

- 1.5% daily crypto-equity loss: block `BUY` and `ADD`; do not force an
  otherwise valid holding to exit.
- 4% rolling seven-day loss: block `BUY` and `ADD` and request a durable
  72-hour cooldown. The live controller owns the durable cooldown clock; the
  backtest models the same latch as exactly 72 subsequent completed hourly
  bars and does not extend the deadline on every observation inside the latch.
- 8% strategy peak-to-trough drawdown: exit existing exposure immediately and
  require durable manual review before automation can restart. The controller
  owns the acknowledgement record; the engine cannot self-acknowledge.
- stale data, abnormal spread, insufficient depth, account restriction, or
  reconciliation failure: allow only cancel/reduce/exit.
- three consecutive execution or synchronization failures: lock automation.
- a durable kill switch stops new entries without depending on an open browser.

All decisions, evidence, risk results, order responses, and state changes are
persisted and scoped to the authenticated user.
