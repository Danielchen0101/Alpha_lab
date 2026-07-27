import {
  actionSummary,
  isAlphaLabManagedLedgerRecord,
  kalshiAccountEquityDollars,
  kalshiPortfolioWarnings,
  kalshiResponseStateMatchesMode,
  portfolioEnvironmentMatchesMode,
  positionSideLabel,
  resolveKalshiView,
  shouldAcceptKalshiOperationResponse,
  shouldStartKalshiPortfolioRequest,
  visibleKalshiLedger,
} from './Kalshi';
import { DEFAULT_KALSHI_BOT_CONFIG } from '../services/kalshiApi';
import type { KalshiPaperPortfolio } from '../services/kalshiApi';

const portfolioFixture = (overrides: Partial<KalshiPaperPortfolio> = {}): KalshiPaperPortfolio => ({
  environment: 'paper',
  balance: { balance: 100_000, portfolio_value: 0 },
  positions: [],
  orders: [],
  fills: [],
  settlements: [],
  asOf: '2026-07-27T12:00:00.000Z',
  ...overrides,
});

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
    expect(DEFAULT_KALSHI_BOT_CONFIG.riskPerTradePct).toBe(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxDailyLossPct).toBe(2);
    expect(DEFAULT_KALSHI_BOT_CONFIG.fractionalKelly).toBe(0.15);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxBookParticipation).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minPrice).toBeGreaterThanOrEqual(0.47);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxPrice).toBeLessThanOrEqual(0.92);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minModelProbability).toBeGreaterThanOrEqual(0.64);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSecondsToClose).toBeLessThanOrEqual(840);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minNetEdge).toBeGreaterThanOrEqual(0.01);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minConservativeEdge).toBeGreaterThanOrEqual(0.0075);
    expect(DEFAULT_KALSHI_BOT_CONFIG.addMinProbabilityImprovement).toBeGreaterThan(0);
    expect(DEFAULT_KALSHI_BOT_CONFIG.probabilityLogitScale).toBeGreaterThanOrEqual(1.7);
    expect(DEFAULT_KALSHI_BOT_CONFIG.marketBlendWeight).toBeGreaterThanOrEqual(0.45);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSingleMarketExposurePct).toBeLessThan(
      DEFAULT_KALSHI_BOT_CONFIG.maxPortfolioExposurePct,
    );
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxPortfolioExposurePct).toBeLessThanOrEqual(10);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSingleMarketExposurePct).toBeLessThanOrEqual(2);
    expect(DEFAULT_KALSHI_BOT_CONFIG.microPositionMaxLossDollars).toBe(1);
    expect(DEFAULT_KALSHI_BOT_CONFIG.microPositionMaxLossPct).toBe(5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.microPositionMinNetEdge).toBeGreaterThanOrEqual(0.02);
    expect(DEFAULT_KALSHI_BOT_CONFIG.microPositionMinConservativeEdge).toBeGreaterThanOrEqual(0.01);
    expect(DEFAULT_KALSHI_BOT_CONFIG.addSizeFraction).toBeLessThanOrEqual(0.25);
    expect(DEFAULT_KALSHI_BOT_CONFIG.takeProfitScaleOutPct).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.addMinModelProbability).toBeGreaterThanOrEqual(
      DEFAULT_KALSHI_BOT_CONFIG.minModelProbability,
    );
    expect(DEFAULT_KALSHI_BOT_CONFIG.minimumAddIntervalSeconds).toBeGreaterThanOrEqual(90);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minimumHoldSeconds).toBeGreaterThan(0);
  });

  it('does not present a flat position as a YES holding', () => {
    expect(positionSideLabel({ position_fp: 0 })).toBe('--');
    expect(positionSideLabel({ position_fp: 3 })).toBe('YES');
    expect(positionSideLabel({ position_fp: -2 })).toBe('NO');
    expect(positionSideLabel({ net_side: 'no', position_fp: 3 })).toBe('NO');
  });

  it('rejects a portfolio payload from a different or unknown environment', () => {
    expect(portfolioEnvironmentMatchesMode(portfolioFixture({ environment: 'paper' }), 'paper')).toBe(true);
    expect(portfolioEnvironmentMatchesMode(portfolioFixture({ environment: 'paper' }), 'real')).toBe(false);
    expect(portfolioEnvironmentMatchesMode(portfolioFixture({ environment: 'real' }), 'paper')).toBe(false);
    expect(portfolioEnvironmentMatchesMode(portfolioFixture({ environment: '' }), 'real')).toBe(false);
  });

  it('adds Kalshi cash and position value when calculating Real account equity', () => {
    expect(kalshiAccountEquityDollars({
      balance: 15_000,
      portfolio_value: 4_200,
    })).toBe(192);
    expect(kalshiAccountEquityDollars({
      balance: 15_000,
      portfolio_value: 0,
    })).toBe(150);
  });

  it('allows one portfolio request per mode while permitting a mode transition', () => {
    expect(shouldStartKalshiPortfolioRequest(null, 'paper')).toBe(true);
    expect(shouldStartKalshiPortfolioRequest('paper', 'paper')).toBe(false);
    expect(shouldStartKalshiPortfolioRequest('paper', 'real')).toBe(true);
    expect(shouldStartKalshiPortfolioRequest('real', 'real')).toBe(false);
  });

  it('accepts async state only when mode, epoch, request id, and backend state all match', () => {
    const token = { mode: 'real' as const, epoch: 4, requestId: 12 };
    const realState = {
      activeEnvironment: 'real',
      selectedEnvironment: 'real',
      config: { executionMode: 'real' },
    };

    expect(shouldAcceptKalshiOperationResponse(token, 'real', 4, 12, realState)).toBe(true);
    expect(shouldAcceptKalshiOperationResponse(token, 'paper', 4, 12, realState)).toBe(false);
    expect(shouldAcceptKalshiOperationResponse(token, 'real', 5, 12, realState)).toBe(false);
    expect(shouldAcceptKalshiOperationResponse(token, 'real', 4, 13, realState)).toBe(false);
  });

  it('rejects old-mode and internally inconsistent robot state responses', () => {
    expect(kalshiResponseStateMatchesMode({
      activeEnvironment: 'paper',
      selectedEnvironment: 'real',
      config: { executionMode: 'real' },
    }, 'real')).toBe(false);
    expect(kalshiResponseStateMatchesMode({
      activeEnvironment: 'real',
      selectedEnvironment: 'paper',
      config: { executionMode: 'real' },
    }, 'real')).toBe(false);
    expect(kalshiResponseStateMatchesMode({
      activeEnvironment: 'real',
      config: { executionMode: 'paper' },
    }, 'real')).toBe(false);
    expect(kalshiResponseStateMatchesMode({
      config: { executionMode: 'real' },
    }, 'real')).toBe(false);
  });

  it('rejects a Paper response captured before a Paper-to-Real epoch change', () => {
    const oldPaperToken = { mode: 'paper' as const, epoch: 8, requestId: 21 };
    const oldPaperState = {
      activeEnvironment: 'paper',
      selectedEnvironment: 'paper',
      config: { executionMode: 'paper' },
    };

    expect(shouldAcceptKalshiOperationResponse(
      oldPaperToken,
      'real',
      9,
      22,
      oldPaperState,
    )).toBe(false);
  });

  it('fails closed when a Real AlphaLab-only ledger baseline is absent or uncertified', () => {
    const realPortfolio = portfolioFixture({
      environment: 'real',
      orders: [{ order_id: 'new', created_time: '2026-07-27T12:01:00.000Z', alphaLabManaged: true }],
      analytics: {
        displayBaseline: {
          active: true,
          resetAt: '2026-07-27T12:00:00.000Z',
          environment: 'real',
        },
      },
    });

    expect(visibleKalshiLedger(realPortfolio)).toMatchObject({
      baselineReady: false,
      orders: [],
      fills: [],
      settlements: [],
    });
    expect(visibleKalshiLedger({
      ...realPortfolio,
      analytics: undefined,
    })).toMatchObject({ baselineReady: false, orders: [] });
  });

  it('shows only baseline-qualified AlphaLab Real activity and linked fills', () => {
    const realPortfolio = portfolioFixture({
      environment: 'real',
      orders: [
        { order_id: 'old-alpha', created_time: '2026-07-27T11:59:59.000Z', alphaLabManaged: true },
        { order_id: 'manual', created_time: '2026-07-27T12:01:00.000Z', source: 'kalshi_account' },
        { order_id: 'alpha-1', created_time: '2026-07-27T12:02:00.000Z', alphaLabManaged: true },
        { order_id: 'alpha-2', created_time: '2026-07-27T12:03:00.000Z', alphaLabOrder: true },
      ],
      fills: [
        { fill_id: 'linked', order_id: 'alpha-1', created_time: '2026-07-27T12:02:01.000Z' },
        { fill_id: 'manual-fill', created_time: '2026-07-27T12:02:02.000Z', source: 'kalshi_account' },
      ],
      settlements: [
        { settlement_id: 'alpha-settlement', settled_time: '2026-07-27T12:04:00.000Z', source: 'alphalab' },
        { settlement_id: 'old-settlement', settled_time: '2026-07-27T11:58:00.000Z', alphalabManaged: true },
      ],
      analytics: {
        displayBaseline: {
          active: true,
          resetAt: '2026-07-27T12:00:00.000Z',
          environment: 'real',
          ...({ alphaLabOnly: true } as any),
        },
      },
    });

    const visible = visibleKalshiLedger(realPortfolio);
    expect(visible.baselineReady).toBe(true);
    expect(visible.orders.map((record) => record.order_id)).toEqual(['alpha-1', 'alpha-2']);
    expect(visible.fills.map((record) => record.fill_id)).toEqual(['linked']);
    expect(visible.settlements.map((record) => record.settlement_id)).toEqual(['alpha-settlement']);
  });

  it('recognizes only the backend AlphaLab provenance contract', () => {
    expect(isAlphaLabManagedLedgerRecord({ alphaLabManaged: true })).toBe(true);
    expect(isAlphaLabManagedLedgerRecord({ alphalabManaged: true })).toBe(true);
    expect(isAlphaLabManagedLedgerRecord({ alphaLabOrder: true })).toBe(true);
    expect(isAlphaLabManagedLedgerRecord({ source: 'alphalab' })).toBe(true);
    expect(isAlphaLabManagedLedgerRecord({ source: 'kalshi_account' })).toBe(false);
    expect(isAlphaLabManagedLedgerRecord({ client_order_id: 'alphalab-guessed' })).toBe(false);
  });

  it('surfaces backend portfolio warnings and incomplete resources without duplicates', () => {
    const warnings = kalshiPortfolioWarnings({
      warnings: ['Kalshi fills are temporarily unavailable.', 'Kalshi fills are temporarily unavailable.'],
      completeness: {
        complete: false,
        balance: true,
        positions: true,
        orders: false,
        fills: false,
        settlements: true,
        history: false,
      },
    });

    expect(warnings).toEqual([
      'Kalshi fills are temporarily unavailable.',
      'Incomplete account data: orders, fills, history',
    ]);
  });

  it('does not present a stale Real account preflight as order-ready', () => {
    const decision = {
      action: 'WAIT',
      blockingReasons: ['account_snapshot_stale', 'robot_scheduler_unhealthy'],
      accountPreflight: { snapshotAgeSeconds: 183 },
    } as any;

    expect(actionSummary(decision, true, true)).toContain('后台实盘机器人当前不健康');
    expect(actionSummary({
      ...decision,
      blockingReasons: ['account_snapshot_stale'],
    }, false, true)).toContain('stale (183s)');
  });
});
