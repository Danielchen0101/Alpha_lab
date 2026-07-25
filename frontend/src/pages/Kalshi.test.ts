import { positionSideLabel, resolveKalshiView } from './Kalshi';
import { DEFAULT_KALSHI_BOT_CONFIG } from '../services/kalshiApi';

describe('Kalshi workspace routing', () => {
  it.each([
    ['/kalshi', 'desk'],
    ['/kalshi/markets/btc-15m', 'desk'],
    ['/kalshi/markets/btc-hourly', 'desk'],
    ['/kalshi/markets/rules', 'rules'],
    ['/kalshi/bots/btc-15m', 'bot'],
    ['/kalshi/bots/btc-hourly', 'bot'],
    ['/kalshi/bots/decisions', 'decisions'],
    ['/kalshi/bots/risk', 'risk'],
    ['/kalshi/portfolio/positions', 'positions'],
    ['/kalshi/portfolio/orders', 'orders'],
    ['/kalshi/settings/data', 'data'],
    ['/kalshi/settings/connection', 'connection'],
  ])('maps %s to the %s view', (pathname, expected) => {
    expect(resolveKalshiView(pathname)).toBe(expected);
  });

  it('defaults to official-BRTI v6 position-management controls', () => {
    expect(DEFAULT_KALSHI_BOT_CONFIG.paperBankroll).toBe(1000);
    expect(DEFAULT_KALSHI_BOT_CONFIG.riskPerTradePct).toBeLessThanOrEqual(1.0);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxBookParticipation).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minPrice).toBeGreaterThanOrEqual(0.47);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxPrice).toBeLessThanOrEqual(0.95);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minModelProbability).toBeGreaterThanOrEqual(0.58);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSecondsToClose).toBeLessThanOrEqual(840);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minNetEdge).toBeGreaterThanOrEqual(0.0075);
    expect(DEFAULT_KALSHI_BOT_CONFIG.addMinProbabilityImprovement).toBeGreaterThan(0);
    expect(DEFAULT_KALSHI_BOT_CONFIG.probabilityLogitScale).toBeGreaterThanOrEqual(1.7);
    expect(DEFAULT_KALSHI_BOT_CONFIG.marketBlendWeight).toBeGreaterThanOrEqual(0.45);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSingleMarketExposurePct).toBeLessThan(
      DEFAULT_KALSHI_BOT_CONFIG.maxPortfolioExposurePct,
    );
    expect(DEFAULT_KALSHI_BOT_CONFIG.addSizeFraction).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.takeProfitScaleOutPct).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.addMinModelProbability).toBeGreaterThan(
      DEFAULT_KALSHI_BOT_CONFIG.minModelProbability,
    );
    expect(DEFAULT_KALSHI_BOT_CONFIG.minimumAddIntervalSeconds).toBeGreaterThan(0);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minimumHoldSeconds).toBeGreaterThan(0);
  });

  it('does not present a flat position as a YES holding', () => {
    expect(positionSideLabel({ position_fp: 0 })).toBe('--');
    expect(positionSideLabel({ position_fp: 3 })).toBe('YES');
    expect(positionSideLabel({ position_fp: -2 })).toBe('NO');
    expect(positionSideLabel({ net_side: 'no', position_fp: 3 })).toBe('NO');
  });
});
