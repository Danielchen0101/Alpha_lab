import { resolveRouteTitle } from './routeTitles';

describe('resolveRouteTitle', () => {
  it('matches public routes exactly instead of accepting similar prefixes', () => {
    expect(resolveRouteTitle('/signin', 'en-US')).toBe('Sign In');
    expect(resolveRouteTitle('/signin-old', 'en-US')).toBe('Page Not Found');
    expect(resolveRouteTitle('/privacy/unknown', 'en-US')).toBe('Page Not Found');
  });

  it('supports only the registered dynamic route families', () => {
    expect(resolveRouteTitle('/market/symbol/SPY', 'en-US')).toBe('Markets');
    expect(resolveRouteTitle('/backtest/run-123', 'en-US')).toBe('Strategy Lab');
    expect(resolveRouteTitle('/crypto/automation', 'en-US')).toBe('Crypto Quant');
    expect(resolveRouteTitle('/kalshi/markets', 'en-US')).toBe('Kalshi Event Contracts');
    expect(resolveRouteTitle('/trade/intelligence/news', 'en-US')).toBe('Market Intelligence');
    expect(resolveRouteTitle('/market/intelligence/news', 'en-US')).toBe('Market Intelligence');
    expect(resolveRouteTitle('/crypto-old', 'en-US')).toBe('Page Not Found');
  });

  it('normalizes trailing slashes and returns localized titles', () => {
    expect(resolveRouteTitle('/technology/', 'zh-CN')).toBe('技术架构');
    expect(resolveRouteTitle('/TECHNOLOGY/', 'en-US')).toBe('Technology');
    expect(resolveRouteTitle('/unknown/', 'zh-CN')).toBe('页面未找到');
  });
});
