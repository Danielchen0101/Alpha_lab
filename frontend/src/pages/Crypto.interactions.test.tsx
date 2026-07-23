/* eslint-disable testing-library/no-unnecessary-act -- these tests intentionally use React's low-level createRoot API */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { useLocation } from 'react-router-dom';
import Crypto, { resetCryptoWorkspaceCacheForTests } from './Crypto';
import cryptoAPI from '../services/cryptoApi';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../services/cryptoApi', () => ({
  __esModule: true,
  CRYPTO_LEDGER_LIMIT: 100,
  default: {
    overview: jest.fn(),
    getConfig: jest.fn(),
    runtime: jest.fn(),
    ledger: jest.fn(),
    bars: jest.fn(),
    saveConfig: jest.fn(),
    runCycle: jest.fn(),
    backtest: jest.fn(),
    startAutomation: jest.fn(),
    stopAutomation: jest.fn(),
    setKillSwitch: jest.fn(),
  },
}));

jest.mock('../contexts/LanguageContext', () => ({ useLanguage: jest.fn() }));
jest.mock('../contexts/TradeModeContext', () => ({ useTradeMode: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(),
}));

const api = cryptoAPI as unknown as Record<keyof typeof cryptoAPI, jest.Mock>;
const mockedUseLocation = useLocation as jest.Mock;
const mockedUseLanguage = useLanguage as jest.Mock;
const mockedUseTradeMode = useTradeMode as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const configPayload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    success: true,
    config: {
      mode: 'paper',
      symbols: ['BTC/USD', 'ETH/USD'],
      intervalMinutes: 60,
      riskProfile: 'balanced',
      maxTotalExposure: 0.2,
      maxAssetExposurePct: 12,
      riskPerTradePct: 0.35,
      minimumConfidence: 60,
      enabled: false,
      liveAuthorized: false,
      killSwitch: false,
      ...overrides,
    },
  },
});

const runtimePayload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    success: true,
    runtime: {
      status: 'idle',
      currentStage: '',
      lastHeartbeat: '2026-07-19T12:00:00Z',
      nextRun: null,
      progress: null,
      manualReviewRequired: false,
      cooldownUntil: null,
      ...overrides,
    },
    scheduler: {
      schedulerHealthy: true,
      status: 'healthy',
      message: '',
    },
  },
});

const overviewPayload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    success: true,
    mode: 'paper',
    asOf: '2026-07-19T12:00:00Z',
    source: 'Alpaca Crypto 24/7',
    accountEligible: true,
    accountError: null,
    account: {
      configured: true,
      eligible: true,
      cryptoStatus: 'ACTIVE',
      eligibilityReasons: [],
      equity: 25000,
      nonMarginableBuyingPower: 20000,
    },
    config: { liveAuthorized: false },
    assets: [{
      symbol: 'BTC/USD',
      name: 'Bitcoin',
      price: 64000,
      change24h: 1.25,
      volume24h: 1_000_000,
      spreadBps: 3.2,
      dataAvailable: true,
      tradable: true,
      reasons: [],
      signal: 'HOLD',
      confidence: 62,
      regime: 'risk_on',
    }],
    portfolio: {
      equity: 25000,
      cryptoEquity: 3000,
      cash: 20000,
      exposurePct: 12,
      dayPnl: 125,
      drawdownPct: 2,
    },
    automation: {
      enabled: false,
      status: 'idle',
      nextRun: null,
      lastRun: null,
      intervalMinutes: 60,
      killSwitch: false,
      locked: false,
    },
    liveAdmission: { admitted: false, status: 'paper_only' },
    ...overrides,
  },
});

const mutationPayload = (
  configOverrides: Record<string, unknown> = {},
  runtimeOverrides: Record<string, unknown> = {},
) => ({
  data: {
    success: true,
    config: configPayload(configOverrides).data.config,
    runtime: runtimePayload(runtimeOverrides).data.runtime,
  },
});

const settle = async () => {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
};

const findButton = (container: HTMLElement, text: string) => (
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(text)) as HTMLButtonElement | undefined
);

const findLabelControl = <T extends HTMLInputElement | HTMLSelectElement>(container: HTMLElement, text: string): T => {
  const label = Array.from(container.querySelectorAll('label')).find((candidate) => candidate.textContent?.includes(text));
  return label?.querySelector('input, select') as T;
};

describe('Crypto page interactions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let pathname: string;
  let language: 'en-US' | 'zh-CN';

  beforeEach(() => {
    resetCryptoWorkspaceCacheForTests();
    mockedUseAuth.mockReturnValue({ user: { id: 'test-user', email: 'test@example.com' } });
    jest.clearAllMocks();
    pathname = '/crypto';
    language = 'en-US';
    mockedUseLocation.mockImplementation(() => ({ pathname, search: '', hash: '', state: null, key: 'test' }));
    mockedUseLanguage.mockImplementation(() => ({ language }));
    mockedUseTradeMode.mockReturnValue({ tradeMode: 'paper', tradeModeReady: true });
    api.overview.mockImplementation(() => Promise.resolve(overviewPayload()));
    api.getConfig.mockImplementation(() => Promise.resolve(configPayload()));
    api.runtime.mockImplementation(() => Promise.resolve(runtimePayload()));
    api.bars.mockResolvedValue({ data: { success: true, bars: [{ t: 1, c: 63000 }, { t: 2, c: 64000 }] } });
    api.ledger.mockResolvedValue({ data: { success: true, records: [] } });
    api.saveConfig.mockImplementation((patch: Record<string, unknown>) => Promise.resolve(configPayload(patch)));
    api.runCycle.mockResolvedValue(runtimePayload({ status: 'completed' }));
    api.backtest.mockResolvedValue({ data: { success: true, result: {} } });
    api.startAutomation.mockResolvedValue(mutationPayload({ enabled: true }, { status: 'armed', enabled: true }));
    api.stopAutomation.mockResolvedValue(mutationPayload({ enabled: false }, { status: 'stopped', enabled: false }));
    api.setKillSwitch.mockResolvedValue(mutationPayload({ killSwitch: true }, { status: 'killed', killSwitch: true }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(<Crypto />);
    });
    await settle();
  };

  it('refreshes independently and fails closed when account, config, and runtime data partially fail', async () => {
    await renderPage();
    expect(findButton(container, 'Run decision cycle')?.disabled).toBe(false);

    await act(async () => {
      findButton(container, 'Run decision cycle')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.runCycle).toHaveBeenCalledWith('paper', false);

    api.overview.mockResolvedValueOnce(overviewPayload({
      accountEligible: null,
      accountError: 'Broker credentials are unavailable',
      account: { configured: false, eligible: null, cryptoStatus: 'UNKNOWN', eligibilityReasons: [] },
      assets: [{ symbol: 'BTC/USD', name: 'Bitcoin', price: null, change24h: null, dataAvailable: false, tradable: true, reasons: ['snapshot_unavailable'], signal: 'WAIT', confidence: 0, regime: 'awaiting_data' }],
      portfolio: { equity: 0, cryptoEquity: 0, cash: null, exposurePct: 0, dayPnl: null },
    }));
    api.getConfig.mockRejectedValueOnce(new Error('config offline'));
    api.runtime.mockRejectedValueOnce(new Error('runtime offline'));

    await act(async () => {
      findButton(container, 'Refresh')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(api.overview).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain('No Alpaca Crypto connection is configured');
    expect(container.textContent).toContain('Trading controls remain locked');
    expect(container.textContent).toContain('Scheduler status could not be refreshed');
    expect(findButton(container, 'Run decision cycle')?.disabled).toBe(true);
    expect(container.querySelector('.crypto-change')?.classList.contains('is-neutral')).toBe(true);
    expect(container.textContent).toContain('Snapshot Unavailable');
    expect(container.querySelector('.crypto-availability')?.textContent).toContain('Data unavailable');
    expect(container.querySelector('.crypto-availability')?.textContent).not.toContain('Tradable');
    const pnlMetric = Array.from(container.querySelectorAll('.crypto-metric')).find((metric) => metric.textContent?.includes('Account 24h P/L'));
    expect(pnlMetric?.classList.contains('is-positive')).toBe(false);
    expect(pnlMetric?.textContent).toContain('—');
  });

  it('saves edited controls and disables the stale form after a later config refresh failure', async () => {
    pathname = '/crypto/automation';
    await renderPage();

    const confidence = findLabelControl<HTMLInputElement>(container, 'Minimum decision confidence');
    act(() => Simulate.change(confidence, { target: { value: '71' } } as any));
    await act(async () => {
      findButton(container, 'Save mandate')?.click();
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(api.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ minimumConfidence: 71, mode: 'paper' }));
    expect(container.textContent).toContain('Mandate saved');

    api.getConfig.mockRejectedValueOnce(new Error('saved config unavailable'));
    await act(async () => {
      findButton(container, 'Refresh')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(findButton(container, 'Save mandate')?.disabled).toBe(true);
    expect(findLabelControl<HTMLSelectElement>(container, 'Decision interval').disabled).toBe(true);
  });

  it('runs a cost-aware backtest and removes the result as soon as an input changes', async () => {
    pathname = '/crypto/strategy';
    api.backtest.mockResolvedValueOnce({
      data: {
        success: true,
        result: {
          symbols: ['BTC/USD'],
          timestamps: ['2026-01-01', '2026-01-02'],
          equity_curve: [10000, 10500],
          metrics: { total_return: 0.05, max_drawdown: -0.02, sharpe: 1.1, calmar: 0.8, trades: 4, turnover: 0.25, fees: 42 },
          benchmark: { metrics: { total_return: 0.03 } },
          executionConstraints: {
            scope: 'single_asset',
            symbol: 'BTC/USD',
            represented: ['Minimum confidence and entry score: 60.00'],
            applied: {
              minimumConfidence: 60,
              singleAssetWeightCap: 0.12,
              maxTotalExposure: 0.2,
              feeBps: 25,
              slippageBps: 5,
            },
            notSimulated: [{
              field: 'brokerOrderContract',
              value: { type: 'market', timeInForce: 'gtc' },
              reason: 'Broker order type, time-in-force, queueing, partial fills, and reconciliation are not replayed from historical order books.',
            }],
          },
          limitations: ['No partial-fill simulation', 'No exchange outage model'],
        },
      },
    });
    await renderPage();

    await act(async () => {
      findButton(container, 'Run backtest')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(api.backtest).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'BTC/USD',
      strategy: expect.objectContaining({ bars_per_day: 24, fee_bps: 25, slippage_bps: 5 }),
    }));
    expect(container.textContent).toContain('+5.00%');
    expect(container.textContent).toContain('Execution constraints represented');
    expect(container.textContent).toContain('Minimum confidence');
    expect(container.textContent).toContain('60 / 100');
    expect(container.textContent).toContain('Effective single-asset weight cap');
    expect(container.textContent).toContain('12.00%');
    expect(container.textContent).toContain('Fee per side');
    expect(container.textContent).toContain('25.00 bps');
    expect(container.textContent).toContain('Broker order contract');
    expect(container.textContent).toContain('partial fills, and reconciliation are not replayed');
    expect(container.textContent).toContain('Simulation limitations');
    expect(container.textContent).toContain('No partial-fill simulation');
    expect(container.textContent).toContain('can only tighten while a position remains open');
    expect(container.textContent).toContain('No continuously resting broker stop');
    expect(container.textContent).toContain('not a maximum-loss guarantee');
    expect(container.textContent).toContain('routed for the next bar open');
    expect(container.textContent).not.toContain('protective stop persists');

    const fee = findLabelControl<HTMLInputElement>(container, 'Fee (bps)');
    act(() => Simulate.change(fee, { target: { value: '30' } } as any));
    expect(container.textContent).not.toContain('+5.00%');
    expect(container.textContent).toContain('No backtest has been run in this session');
  });

  it('shows a failed backtest beside the backtest controls and allows an immediate retry', async () => {
    pathname = '/crypto/strategy';
    api.backtest.mockRejectedValueOnce(new Error('Hourly history is incomplete'));
    await renderPage();

    await act(async () => {
      findButton(container, 'Run backtest')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    expect(container.textContent).toContain('Backtest could not be completed');
    expect(container.textContent).toContain('Hourly history is incomplete');
    expect(findButton(container, 'Retry backtest')).not.toBeNull();
    expect(container.textContent).not.toContain('No backtest has been run in this session');
  });

  it('starts, stops, and engages the kill switch only through the explicit controls', async () => {
    pathname = '/crypto/automation';
    await renderPage();

    expect(container.textContent).toContain('No continuously resting broker stop');
    expect(container.textContent).toContain('gaps, fast markets, failed routing, or service interruptions');

    await act(async () => {
      findButton(container, 'Start Paper automation')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.startAutomation).toHaveBeenCalledWith('paper', false);

    api.overview.mockImplementation(() => Promise.resolve(overviewPayload({
      automation: { enabled: true, status: 'armed', nextRun: null, lastRun: null, intervalMinutes: 60, killSwitch: false },
    })));
    await act(async () => {
      findButton(container, 'Refresh')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    await act(async () => {
      findButton(container, 'Pause automation')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.stopAutomation).toHaveBeenCalledTimes(1);

    api.overview.mockImplementation(() => Promise.resolve(overviewPayload()));
    await act(async () => {
      findButton(container, 'Refresh')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    act(() => findButton(container, 'Engage kill switch')?.click());
    expect(container.textContent).toContain('Confirm emergency stop');
    await act(async () => {
      findButton(container, 'Stop all new activity')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.setKillSwitch).toHaveBeenCalledWith(true, 'operator_emergency_stop');
  });

  it('states hourly-close exit timing and gap risk clearly in Chinese on strategy and automation', async () => {
    pathname = '/crypto/strategy';
    language = 'zh-CN';
    await renderPage();

    expect(container.textContent).toContain('K 线收盘退出阈值');
    expect(container.textContent).toContain('持仓期间阈值只能收紧');
    expect(container.textContent).toContain('下一根 K 线开盘执行');
    expect(container.textContent).toContain('跳空或服务中断可能使实际退出价越过阈值');
    expect(container.textContent).toContain('不构成最大亏损保证');
    expect(container.textContent).not.toContain('保护止损');

    pathname = '/crypto/automation';
    await act(async () => {
      root.render(<Crypto />);
    });
    await settle();
    expect(container.textContent).toContain('券商端没有持续挂单止损');
    expect(container.textContent).toContain('路由失败或服务中断');
  });

  it('requires an explicit drawdown-risk acknowledgement before restarting', async () => {
    pathname = '/crypto/automation';
    api.runtime.mockResolvedValue(runtimePayload({ status: 'locked', manualReviewRequired: true, cooldownUntil: '2026-07-20T12:00:00Z' }));
    await renderPage();

    expect(container.textContent).toContain('Manual review required');
    act(() => findButton(container, 'Review restart')?.click());
    expect(container.textContent).toContain('Acknowledge drawdown risk and restart');
    await act(async () => {
      findButton(container, 'Acknowledge and restart')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.startAutomation).toHaveBeenCalledWith('paper', true);
  });

  it('shows scheduler failures prominently, keeps manual cycles available, and locks automation starts', async () => {
    api.runtime.mockResolvedValue({
      data: {
        success: true,
        runtime: runtimePayload({ status: 'idle' }).data.runtime,
        scheduler: { schedulerHealthy: false, status: 'degraded', message: 'worker thread stopped' },
      },
    });
    await renderPage();

    expect(container.textContent).toContain('Crypto scheduler is unhealthy');
    expect(container.textContent).toContain('worker thread stopped');
    expect(container.textContent).toContain('A manually initiated decision cycle remains available');
    expect(findButton(container, 'Run decision cycle')?.disabled).toBe(false);
    await act(async () => {
      findButton(container, 'Run decision cycle')?.click();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(api.runCycle).toHaveBeenCalledWith('paper', false);

    pathname = '/crypto/automation';
    await act(async () => {
      root.render(<Crypto />);
    });
    await settle();
    expect(findButton(container, 'Start Paper automation')?.disabled).toBe(true);
    expect(api.startAutomation).not.toHaveBeenCalled();
  });

  it('fails automation starts closed until scheduler health is explicitly verified', async () => {
    pathname = '/crypto/automation';
    api.runtime.mockResolvedValueOnce({
      data: {
        success: true,
        runtime: runtimePayload({ status: 'idle' }).data.runtime,
      },
    });
    await renderPage();

    expect(findButton(container, 'Start Paper automation')?.disabled).toBe(true);
    await act(async () => {
      findButton(container, 'Start Paper automation')?.click();
      for (let index = 0; index < 4; index += 1) await Promise.resolve();
    });
    expect(api.startAutomation).not.toHaveBeenCalled();
  });

  it('localizes ledger enums and keeps the 100-record, semantic table usable at a narrow viewport', async () => {
    pathname = '/crypto/ledger';
    language = 'zh-CN';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    api.ledger.mockResolvedValue({
      data: {
        success: true,
        scanTruncated: true,
        scannedRows: 1000,
        scannedPages: 10,
        records: [{
          id: 'risk-1',
          createdAt: '2026-07-19T12:00:00Z',
          eventType: 'crypto_decision',
          actor: 'system',
          payload: { symbol: 'BTC/USD', action: 'WAIT', status: 'blocked_by_risk', reason: 'spread too wide' },
          mode: 'paper',
        }],
      },
    });
    await renderPage();

    expect(api.ledger).toHaveBeenCalledWith(100);
    expect(container.textContent).toContain('虚拟币决策');
    expect(container.textContent).toContain('已被风控阻止');
    expect(container.textContent).toContain('本页最多加载最近 100 条记录');
    expect(container.textContent).toContain('源数据扫描: 1000 行 · 10 页');
    expect(container.textContent).toContain('此账本不完整');
    expect(container.querySelector('[role="table"]')?.getAttribute('aria-colcount')).toBe('8');
    expect(container.querySelectorAll('[role="columnheader"]')).toHaveLength(8);
    expect(container.querySelectorAll('.crypto-ledger-row [role="cell"]')).toHaveLength(8);
    expect(container.querySelector('.crypto-table-scroll')).not.toBeNull();
    expect(findButton(container, '全部')?.getAttribute('aria-pressed')).toBe('true');
  });
});
