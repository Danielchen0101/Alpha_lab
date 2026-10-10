# Stock v1: implementation and evidence workflow

Stock v1 is an opt-in, deterministic, long-only ETF research and execution path.
It starts with a separate **$2,000 shadow book**; it does not reset an Alpaca paper
account, deposit funds, inherit legacy live permission, or establish profitability.
The seven-stage screen remains an evidence viewer. AI is not part of entry
qualification and adds no new data/AI subscription cost by default.

## Frozen rules and scope

The registered basket is SPY, QQQ, IWM, XLF, TLT, IEF, GLD and SLV. Membership is
recorded in the protocol and daily datasets. This is an explicitly chosen ETF
basket, not a historical index-membership or survivorship-free stock-screen claim.
Large-cap stocks and options are not enabled in v1; they need their own universe
evidence and research version.

Only two candidate rules are registered:

* `breakout20`: completed close exceeds the previous 20 session highs and
  close > SMA50 > SMA200.
* `pullback20`: a 1–5 session pullback below SMA20, with the uptrend retained,
  followed by a completed close back above SMA20 and SMA50 > SMA200.

Both require 200 completed sessions. Signals execute on a later session and a
subsequent valid quote, never on the bar or quote used to submit the intention.
Wilder ATR14 defines the initial 2 ATR protective stop. The fixed v1 trailing
rule activates after a **completed post-fill close** reaches 1R, then follows the
highest completed post-fill close minus 2 ATR. This deliberately registered
close-based rule never uses the entry day's pre-purchase high. There is no partial
profit-taking. The time exit is 20 exchange sessions, not 20 calendar days.

| Constraint | v1 value |
| --- | ---: |
| Initial shadow equity | $2,000 |
| Planned stop risk per entry | 0.5% of equity |
| Maximum notional per symbol | 20% |
| Maximum gross exposure | 80% |
| Maximum positions, including pending entries | 4 |
| Aggregate planned stop risk | 2% |
| Correlated group notional | 40% |
| Cash-flow-adjusted daily loss pause | 1.5% |
| Drawdown pause, latched across restart/deposit | 12% |

Entries use whole shares with protective GTC OTO orders; small accounts never round
up to one share to force a trade. Risk includes positions, unfilled buy remainders,
fees and durable submission reservations. Final submission re-reads the broker
account, orders and positions under account/user locks and applies a CAS-backed
reservation. Cash qualification uses the minimum available cash/eligible buying
power, not margin buying power as substitute cash. Missing protection, unknown
submission outcomes, stale data and unresolved corporate actions block entries.
Planned stop risk is not a guarantee against gaps or execution loss.

The native protective stop must survive the entry session. The GTC parent has a
server-enforced entry validity ending at the broker's verified session close;
unfilled remainders are canceled and reconciled after expiry, including after
restart. Unknown cancellations continue to consume budget. A late fill after
expiry is an execution deviation requiring reconciliation and actual-position
protection, not a successful in-policy entry. The normal replay expires unfilled
entry intentions at the session boundary; it does not assume a server outage
can be prevented. DAY stops are not reported as persistent overnight protection.
See [Alpaca order lifetimes and OTO behavior](https://docs.alpaca.markets/us/docs/orders-at-alpaca).

## Workflow in the Agent page

1. Select a candidate and **Freeze protocol**. There is one immutable v1 protocol
   per user. Both registered candidates remain in the experiment report; failure
   does not offer a button to reset the holdout and tune until it passes.
2. **Run out-of-sample research** collects explicit SIP historical data. Each web
   invocation fetches at most 120 new pages, saves checksummed progress and
   reports `collecting`. **Resume research collection** advances the same archive.
   Collection is not a passing backtest and does not consume the holdout.
3. Large archives report `data_ready_requires_offline_replay`. A trusted dedicated
   worker must replay them using the CLI below. This avoids an unbounded CPU job
   in the trading web process. Full-session SIP archives can be very large; the
   small live data probe is not a substitute for collecting the full research set.
   Free API entitlement does not establish zero storage or compute cost. Measure
   archive bytes and collection/replay time on the existing local worker before
   provisioning a full run; no paid worker, storage or data subscription is
   provisioned by this feature. The full archive's operating budget has not yet
   been validated.
4. **Start $2,000 shadow validation** switches the saved stock program to v1,
   clears legacy live authorization and preserves the existing schedule. Before
   historical acceptance, these observations are explicitly exploratory. They
   cannot count as a completed qualifying forward trial.
5. Historical and qualifying forward checks must pass before the existing human
   live-auto authorization flow can permit broker entries. Activation alone does
   not submit paper or real orders. Protective management continues if a formerly
   admitted broker program loses entry eligibility.

## Historical research and costs

Defaults freeze four years of data, with a final two-year holdout divided into
three non-overlapping scored windows. Prior bars supply indicator warmup, but
their returns and trades are not scored. The selected rule is fixed before the
holdout is opened. Every registered candidate and stress run is retained; this
release does not select the best daily backtest for each symbol.

Historical bars explicitly use SIP with raw prices for fills and separately
reconciled splits/dividends for indicators and cash flows. Every quote page must
be fetched. The archive records provider, timestamps, calendar, data hash and
coverage. SIP entitlement is checked with an explicit historical end time; it
does not imply access to live SIP. Live/shadow entry quotations are fresh IEX
observations during regular exchange hours and are labelled **not NBBO**.

The replay uses the bid/ask spread, a frozen 10 bps execution slippage proxy and
a 5 bps fee reserve (minimum $0.01 per fill). Those are research assumptions, not
claims about exact historical regulatory fees. Friction doubles in the stress
run. Incremental operating costs default to $0 and can be registered at protocol
creation; the legacy account's unrecorded external costs remain unknown. Sales
settle on the appropriate exchange session (T+2 before the 2024 transition and
T+1 thereafter). Missing quotes/depth do not create assumed fills. Open positions
remain marked at executable bid less estimated exit friction at window end.

Admission requires positive cost-adjusted OOS P/L, PF ≥ 1.20, positive net P/L and
PF > 1 under doubled friction, maximum drawdown ≤ 12%, ≥ 24 months, ≥ 3 separate
OOS windows and ≥ 100 completed trades for the selected rule. A 20-session block
bootstrap of portfolio daily returns accounts for overlapping holdings; its
one-sided lower bound is adjusted for both registered trials. This is an explicit
Bonferroni correction, not a claim to implement the Deflated Sharpe Ratio itself.

Benchmarks are cash, SPY with cash dividends and an ex-ante risk-budget SPY
baseline. The latter targets 8% annualized volatility from the preceding 60
sessions, caps allocation at 80% and freezes allocation within each fold. That is
a declared research baseline, not proof that SPY has identical pathwise stop risk
or satisfies the candidate's 20% single-symbol cap. Benchmark evidence comes
from the same archived executable data; missing benchmark evidence blocks use.

Forward qualification additionally requires ≥ 60 completed trading sessions,
≥ 30 completed trades, positive net P/L, valid provenance and respected risk
limits. Periodically polling IEX's latest quote cannot by itself establish that
an intervening protective stop was never crossed. Such a book is exploratory
until its executable exposure intervals are independently verified. A separate
qualifying book starts from $2,000 after historical acceptance; its recorded
entry/stop intervals are audited against complete, paginated, delayed SIP quotes.
The audit has a resumable request budget. A missed stop invalidates evidence;
it never rewrites a past fill. The UI must not turn a sparse quote count into a
passing forward result. Late bars, changed
historical prices, or late/revised corporate actions quarantine the cohort rather
than rewrite already committed forward fills or improve prior performance.

## Ledger and status semantics

Account evidence is isolated by user, broker account identity, paper/live mode
and strategy version. Full activity pagination covers fills, posted fees,
dividends, splits and external flows. Ambiguous journals are unknown instead of
being guessed as deposits or profit. A withdrawal is not a trading loss.

Account P/L, attributed strategy P/L, external operating costs and flow-adjusted
return/drawdown are separate. Daily baselines use the previous exchange-session
close, including half days. Missing return marks, cost allocation or order
attribution remain unknown and block the corresponding risk/admission check.
The UI shows the observation period; it does not present a newly observed
drawdown series as the entire account's history. The old equity chart is labelled
as account equity including transfers.

Business status distinguishes `no_signal`, `capital_blocked`, `data_insufficient`,
`risk_paused`, `market_closed`, `research_blocked`, `ai_degraded` and `failed`.
Missing broker eligibility flags remain null. Legacy PDT fields are informational,
not a substitute for the current account's broker-reported restrictions.

## Storage, worker and deployment

No new SQL migration is needed. Existing operations artifacts are service-role
written and user-readable under account isolation. Every `equity_*` artifact is
server-signed using `APP_SECRET_KEY`, including its user, type and key. The generic
artifact write/delete API rejects that namespace. Unsigned, edited, cross-user
or old-key evidence is rejected. Key rotation therefore requires controlled
reverification; it cannot silently grant eligibility from an unsigned record.

Set `ALPHALAB_EQUITY_DATA_DIR` to persistent storage outside the image. Otherwise
the development default is `backend/.equity-data`, which is excluded from Git
and Docker. Container recreation without the persistent archive loses collection
progress. The service uses a user-hash/protocol-key directory under that root.
Run the trusted archive replay with the same server environment and archive:

```sh
python backend/equity_research_service.py \
  --user-id "$RESEARCH_USER_ID" \
  --protocol-key "$RESEARCH_PROTOCOL_KEY" \
  --cache-dir "$RESEARCH_ARCHIVE_DIR"
```

The CLI needs the service-role storage configuration and the same
`APP_SECRET_KEY`; never put their values in a command, PR, browser or report.
It verifies the saved manifest, seals the first holdout opening and computes its
own result. It does not accept an uploaded passing summary or place orders.

Authenticated API additions are `/api/ai-agent/equity/status`, `/protocol`,
`/research/run`, `/activate` and `/account-evidence`. Research returns HTTP 202;
status polling must observe the durable job record rather than interpret 202 as
successful research. Existing scheduler, live approval and entry execution APIs
remain in use, with v1-specific server-side gates.

## Verification and evidence limits

Regression tests cover cash withdrawals, fees/dividends/splits, insufficient
whole-share capital, concurrent portfolio budgets, duplicate/ambiguous orders,
partial fills and held OTO legs, actual-fill stop anchors, weekends, stale quotes,
restart behavior, warmup, causal fills, revised data and forged evidence.

The implementation's read-only provider check on 2026-10-09 verified complete
activity pagination and 257 SIP daily bars per registered ETF without missing
exchange sessions. A one-minute IWM SIP quote probe required two pages and
returned 19,244 rows, illustrating why one page or a tiny quote window is not a
complete portfolio backtest. These checks establish data access and accounting
behavior, **not positive strategy expectation**. No new historical profit result
or 60-day forward result is claimed by this release.

Primary references: [SIP/IEX entitlement](https://docs.alpaca.markets/us/docs/market-data-faq),
[paper execution limitations](https://docs.alpaca.markets/us/docs/paper-trading),
[corporate actions](https://docs.alpaca.markets/us/reference/corporateactions-1),
[multiple-testing research](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf).
