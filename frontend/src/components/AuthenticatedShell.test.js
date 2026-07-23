import {
  getShellNavigationState,
  isShellPath,
  normalizeShellPath,
} from './AuthenticatedShell';

jest.mock('../services/api', () => ({
  loadConfigStatus: jest.fn(),
}));

jest.mock('../services/marketDataService', () => ({
  searchStocks: jest.fn(),
}));

describe('authenticated workspace navigation', () => {
  it.each([
    ['/dashboard/', 'overview', 'daily-brief'],
    ['/activity', 'overview', 'activity'],
    ['/signals?source=legacy', 'overview', 'activity'],
    ['/system-status/', 'overview', 'system-health'],
    ['/safety', 'overview', 'safety-center'],
    ['/market', 'markets', 'market-scanner'],
    ['/market/symbol/AAPL', 'markets', 'symbol-analysis'],
    ['/analysis/TSLA/', 'markets', 'symbol-analysis'],
    ['/watchlist', 'markets', 'watchlist'],
    ['/crypto', 'crypto', 'crypto-overview'],
    ['/crypto/strategy', 'crypto', 'crypto-strategy'],
    ['/crypto/automation', 'crypto', 'crypto-automation'],
    ['/crypto/ledger', 'crypto', 'crypto-ledger'],
    ['/kalshi', 'kalshi-market', 'kalshi-btc15-market'],
    ['/kalshi/markets/btc-15m', 'kalshi-market', 'kalshi-btc15-market'],
    ['/kalshi/markets/rules', 'kalshi-market', 'kalshi-contract-rules'],
    ['/kalshi/bots/btc-15m', 'kalshi-bots', 'kalshi-btc15-bot'],
    ['/kalshi/bots/decisions', 'kalshi-bots', 'kalshi-decisions'],
    ['/kalshi/bots/risk', 'kalshi-bots', 'kalshi-risk'],
    ['/kalshi/portfolio/positions', 'kalshi-portfolio', 'kalshi-positions'],
    ['/kalshi/portfolio/orders', 'kalshi-portfolio', 'kalshi-orders'],
    ['/agent', 'research', 'ai-research'],
    ['/agent/candidates', 'research', 'research-market'],
    ['/agent/review', 'research', 'research-review'],
    ['/backtest/session-1', 'strategies', 'backtests'],
    ['/backtest-analysis/legacy-id', 'strategies', 'backtests'],
    ['/optimize', 'strategies', 'optimization'],
    ['/compare', 'strategies', 'comparison'],
    ['/ranking', 'strategies', 'ranking'],
    ['/trade', 'trade', 'execution'],
    ['/portfolio', 'trade', 'portfolio'],
    ['/settings', 'settings', 'preferences'],
    ['/settings/configuration', 'settings', 'connections'],
  ])('maps %s to %s / %s', (pathname, sectionKey, linkKey) => {
    expect(getShellNavigationState(pathname)).toMatchObject({ sectionKey, linkKey });
  });

  it('normalizes trailing slashes and ignores query/hash fragments', () => {
    expect(normalizeShellPath('market/symbol/SPY/?range=1D#chart')).toBe('/market/symbol/SPY');
  });

  it('does not mark similar prefixes as active routes', () => {
    expect(isShellPath('/marketplace', '/market')).toBe(false);
    expect(isShellPath('/settings-old', '/settings')).toBe(false);
    expect(getShellNavigationState('/portfolio-report')).toMatchObject({
      sectionKey: null,
      linkKey: null,
    });
  });
});
