# Scanner, AI, Continue Scan, and Quick Backtest Rules

Use this for:
- Market Scanner
- AI Recommendations
- Preferred Continue Scan List
- Continue Scan
- detailed scan
- quick backtest
- AI strategy matching

## Market Scanner rules

- Market Scan results must persist across page switches.
- Do not clear results unless a new scan starts.
- If scanning is active, switching pages must not stop the scan.
- Stop button must directly stop active scanning.
- Progress bar must stay visible while scanning.
- Batch rendering should still show completed batches.

## Preferred Continue Scan List rules

- It must be a separate section above AI Recommendations.
- It must not be inside the AI Recommendations card.
- It should wait until Market Scanner is complete before running.
- It should use AI when AI is required.
- It should not use static selection reasons.
- Prefer bullish or strong bullish candidates unless user requests otherwise.
- Rank by trend, score, risk, and AI reasoning.
- Maximum list size should be 20 unless user says otherwise.
- Include a progress bar while this selection is running.

## Detailed scan rules

For each shortlisted symbol:

- Analyze the symbol one at a time.
- Do multi-timeframe confirmation:
  - Daily = main trend
  - 4H / 1H = structure
  - 15m / 30m = entry rhythm
- Check whether higher timeframe and lower timeframe agree.
- Avoid chasing if daily is strong but intraday is overextended.
- If daily is range-bound, intraday signals should be treated carefully.

## Quick backtest rules

This is not a full historical backtest.

For each symbol:

- Run one symbol at a time.
- Use only the matched strategies for that symbol.
- For each matched strategy:
  - If backend supports it, run it.
  - If backend does not support it, skip it and continue.
  - Do not stop the whole scan because one strategy fails.
- Store detailed results inside the expandable detail section.
- Main page should show:
  - backtest status
  - best/summary result
  - whether backtest succeeded
  - basic metrics

## Quick backtest metrics

Capture these when available:
- total return
- Sharpe
- max drawdown
- win rate
- profit factor
- trade count
- recent 1-3 month validity
- whether recent performance appears degraded

Do not rank only by highest return.

Prefer stable candidates:
- reasonable drawdown
- enough trades
- not recently invalidated
- not overfit
- acceptable risk
