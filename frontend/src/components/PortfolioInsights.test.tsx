import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PortfolioInsights from './PortfolioInsights';

const account = {
  success: true,
  equity: 100,
  cash: 0,
  portfolioValue: 100,
} as any;

const position = {
  symbol: 'AAPL',
  marketValue: 0,
  unrealizedPL: 0,
} as any;

describe('PortfolioInsights', () => {
  it('preserves real zeros but does not invent drawdown from one point', () => {
    const view = renderToStaticMarkup(
      <PortfolioInsights
        account={account}
        positions={[position]}
        history={[{ timestamp: Date.now(), equity: 100, profitLoss: 0, profitLossPct: 0 }]}
        mode="paper"
        language="en-US"
      />,
    );

    expect(view).toContain('Ledger cash-flow-adjusted max drawdown</span><strong class="">—</strong>');
    expect(view).toContain('Cash weight</span><strong>0.0%</strong>');
    expect(view).toContain('Unrealized P/L</span><strong class="">$0.00</strong>');
  });

  it('does not turn a withdrawal-driven equity drop into strategy drawdown', () => {
    const view = renderToStaticMarkup(<PortfolioInsights account={account} positions={[position]}
      history={[{ timestamp: 1, equity: 98.11, profitLoss: 0, profitLossPct: 0 },
        { timestamp: 2, equity: 18.11, profitLoss: -80, profitLossPct: -0.8154 }]}
      mode="real" language="en-US" />);
    expect(view).toContain('Ledger cash-flow-adjusted max drawdown</span><strong class="">—</strong>');
    expect(view).not.toContain('81.5%');
  });

  it('uses verified ledger drawdown independently of the raw equity curve', () => {
    const view = renderToStaticMarkup(<PortfolioInsights account={account} positions={[position]} history={[]}
      accountEvidence={{ max_drawdown_pct: 1.25 }} mode="paper" language="en-US" />);
    expect(view).toContain('1.3%');
  });

  it('marks a retained snapshot stale when refresh failed', () => {
    const view = renderToStaticMarkup(
      <PortfolioInsights
        account={account}
        positions={[position]}
        history={[]}
        mode="real"
        source="alpaca_real"
        updatedAt={new Date().toISOString()}
        language="en-US"
        stale
      />,
    );

    expect(view).toContain('is-stale">Stale</b>');
  });
});
