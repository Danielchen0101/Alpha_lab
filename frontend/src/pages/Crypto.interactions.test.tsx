/* eslint-disable testing-library/no-unnecessary-act -- these tests intentionally use React's low-level createRoot API */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLocation } from 'react-router-dom';
import Crypto from './Crypto';
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
    calibrate: jest.fn(),
    strategyLibrary: jest.fn(),
    startAutomation: jest.fn(),
    stopAutomation: jest.fn(),
    setKillSwitch: jest.fn(),
    simOverview: jest.fn(),
    simStart: jest.fn(),
    simStop: jest.fn(),
    simReset: jest.fn(),
    simRunCycle: jest.fn(),
    simUpdateConfig: jest.fn(),
    simTrain: jest.fn(),
    simTrades: jest.fn(),
    simEquity: jest.fn(),
    simResearchBacktest: jest.fn(),
  },
}));

jest.mock('../contexts/LanguageContext', () => ({ useLanguage: jest.fn() }));
jest.mock('../contexts/TradeModeContext', () => ({ useTradeMode: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(),
  Navigate: () => null,
}));
jest.mock('recharts', () => {
  const Container: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div>{children}</div>
  );
  const Chart: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <svg>{children}</svg>
  );
  const Empty: React.FC = () => null;
  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    BarChart: Chart,
    Area: Empty,
    Bar: Empty,
    Cell: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    ReferenceLine: Empty,
    Tooltip: Empty,
  };
});

const api = cryptoAPI as unknown as Record<string, jest.Mock>;
const mockedUseLocation = useLocation as jest.Mock;
const mockedUseLanguage = useLanguage as jest.Mock;
const mockedUseTradeMode = useTradeMode as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const overviewPayload = {
  data: {
    success: true,
    mode: 'paper',
    algorithm: { name: 'Helios Regime Ensemble', version: '2.0.0' },
    account: { configured: false },
    assets: [
      {
        symbol: 'BTC/USD',
        name: 'Bitcoin',
        price: 65000,
        change24h: 2.4,
        spreadBps: 4.2,
        dailyDollarVolume: 12345678,
        executionReady: true,
        signal: 'BUY',
        confidence: 71,
        regime: 'trend_up',
        signalDetail: {
          action: 'BUY',
          confidence: 71,
          regime: 'trend_up',
          targetWeight: 0.18,
          reasons: ['Directional up-trend regime (ADX 28).'],
          ensemble: {
            regime: 'trend_up',
            composite: 0.42,
            votes: { trend: 0.8, breakout: 0.5, momentum: 0.6, meanrev: -0.1 },
            weights: { trend: 0.33, breakout: 0.25, momentum: 0.25, meanrev: 0.17 },
            ml: { probability_up: 0.61, score_adjustment: 2.6, veto: false },
          },
        },
      },
    ],
    portfolio: {
      equity: 100000,
      exposurePct: 12.5,
      dayPnl: 250,
      positions: [{ symbol: 'BTC/USD', unrealizedPnl: 75 }],
    },
    automation: { enabled: false, status: 'idle', killSwitch: false },
    runtime: {
      cryptoPerformance: {
        realizedPnl: 125,
        estimatedFees: 12.5,
        tradeCount: 3,
        closedTradeCount: 2,
        wins: 1,
        losses: 1,
        curve: [
          {
            time: '2026-07-25T12:00:00Z',
            value: 125,
            tradePnl: 130,
            fee: 5,
            symbol: 'BTC/USD',
            action: 'REDUCE',
          },
        ],
      },
    },
    config: {
      enabled: false,
      mode: 'paper',
      symbols: ['BTC/USD', 'ETH/USD'],
      experimentalPaperSleeves: [],
      tradeHorizon: 'short',
      intervalMinutes: 15,
      liveAuthorized: false,
      killSwitch: false,
      maxTotalExposure: 0.30,
      maxAssetExposurePct: 18,
      assetAllocationsPct: { 'BTC/USD': 18, 'ETH/USD': 12 },
      riskPerTradePct: 0.25,
      minimumConfidence: 52,
      riskProfile: 'balanced',
      maxOrderNotional: 1000,
      minOrderNotional: 10,
      allowAdds: true,
      aiReviewEnabled: false,
      paperLearningEnabled: false,
      calibrationEveryCycles: 24,
      order: { type: 'market', timeInForce: 'gtc', limitOffsetBps: 8, stopOffsetBps: 15 },
      strategy: {},
      algorithm: { name: 'Helios Regime Ensemble', version: '2.0.0' },
    },
  },
};

const simPayload = {
  data: {
    success: true,
    running: true,
    threadAlive: true,
    config: { enabled: true, intervalMinutes: 5, mlEnabled: true, symbols: ['BTC/USD', 'ETH/USD'] },
    status: { lastCycleAt: new Date().toISOString(), cycleCount: 12, lastError: null },
    account: {
      cash: 88000,
      initialCapital: 100000,
      equity: 101500,
      positions: [
        {
          symbol: 'BTC/USD',
          qty: 0.2,
          avgEntry: 60000,
          lastPrice: 65000,
          marketValue: 13000,
          unrealizedPnl: 1000,
          unrealizedPnlPct: 8.3,
          weight: 0.128,
          protectiveStop: 58000,
        },
      ],
    },
    performance: {
      totalReturn: 0.015,
      annualizedReturn: 0.21,
      sharpe: 1.4,
      sortino: 1.9,
      maxDrawdown: -0.02,
      volatility: 0.18,
      observations: 500,
    },
    benchmark: {
      totalReturn: 0.005,
      annualizedReturn: 0.07,
      sharpe: 0.4,
      sortino: 0.5,
      maxDrawdown: -0.09,
      volatility: 0.5,
      observations: 500,
    },
    tradeCount: 9,
    sellTradeCount: 4,
    sellWinRate: 0.75,
    latestDecisions: [
      {
        timestamp: new Date().toISOString(),
        symbol: 'BTC/USD',
        action: 'HOLD',
        regime: 'trend_up',
        score: 66,
        reasons: ['Directional up-trend regime (ADX 28).'],
        ensemble: { ml: { probability_up: 0.58, veto: false } },
        executed: false,
      },
    ],
    recentTrades: [
      {
        symbol: 'BTC/USD',
        side: 'buy',
        action: 'BUY',
        grossNotional: 12000,
        fee: 30,
        qty: 0.2,
        price: 60000,
        timestamp: new Date().toISOString(),
      },
    ],
    recentErrors: [],
    ml: {
      'BTC/USD': {
        trainedAt: new Date().toISOString(),
        summary: { val_auc: 0.55, val_accuracy: 0.56 },
        dataset: { samples: 1500 },
      },
    },
    equityCurve: [
      ['2026-07-01T00:00:00+00:00', 100000],
      ['2026-07-02T00:00:00+00:00', 101500],
    ],
    benchmarkCurve: [
      ['2026-07-01T00:00:00+00:00', 100000],
      ['2026-07-02T00:00:00+00:00', 100500],
    ],
  },
};

let container: HTMLDivElement;
let root: Root;

const renderAt = async (pathname: string) => {
  mockedUseLocation.mockReturnValue({ pathname });
  await act(async () => {
    root.render(<Crypto />);
  });
  await act(async () => {
    await Promise.resolve();
  });
};

const clickButton = async (label: string) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label));
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockedUseLanguage.mockReturnValue({ language: 'en-US' });
  mockedUseTradeMode.mockReturnValue({ tradeMode: 'paper', tradeModeReady: true });
  mockedUseAuth.mockReturnValue({ isAuthenticated: true, loading: false, user: { id: 'u1' } });
  api.overview.mockResolvedValue(overviewPayload);
  api.simOverview.mockResolvedValue(simPayload);
  api.simTrades.mockResolvedValue({ data: { success: true, trades: [], decisions: [] } });
  api.ledger.mockResolvedValue({ data: { success: true, records: [] } });
  api.strategyLibrary.mockResolvedValue({ data: { success: true, strategies: [] } });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('Crypto operations workspace', () => {
  it('renders net performance, risk and explainable short-term decisions', async () => {
    await renderAt('/crypto');
    expect(container.textContent).toContain('Crypto Trading Desk');
    expect(container.textContent).toContain('BTC/USD');
    expect(container.textContent).toContain('Uptrend');
    expect(container.textContent).toContain('BUY');
    expect(container.textContent).toContain('Cumulative realized P/L after fills');
    expect(container.textContent).toContain('Crypto net P/L');
    expect(container.textContent).toContain('+$200.00');
    expect(container.textContent).toContain('Order rejected');
    expect(container.textContent).toContain('REJECTION');
    expect(container.textContent).toContain('15-minute decision cadence does not imply a trade on every bar');
    expect(container.textContent).toContain('reproducible / no generative AI');
    expect(container.textContent).not.toContain('P(up)');
    expect(api.overview).toHaveBeenCalledWith('paper');
    expect(api.simOverview).not.toHaveBeenCalled();
  });

  it('renders server-side 24/7 health, heartbeat and automation controls', async () => {
    api.overview.mockResolvedValue({
      data: {
        ...overviewPayload.data,
        automation: {
          enabled: true,
          status: 'idle',
          intervalMinutes: 15,
          lastRun: '2026-07-25T12:00:00Z',
          nextRun: '2026-07-25T12:15:00Z',
          killSwitch: false,
          locked: false,
        },
        runtime: {
          ...overviewPayload.data.runtime,
          currentStage: 'completed',
          progress: 100,
          heartbeatAgeSeconds: 12,
          staleAfterSeconds: 300,
          lastHeartbeat: '2026-07-25T12:00:05Z',
          cycleCount: 19,
          recoveryState: 'normal',
        },
      },
    });
    await renderAt('/crypto/automation');
    expect(container.textContent).toContain('24/7 SERVER AUTOPILOT');
    expect(container.textContent).toContain('24/7 scheduler healthy');
    expect(container.textContent).toContain('Backend heartbeat');
    expect(container.textContent).toContain('12s ago');
    expect(container.textContent).toContain('Continuous trading is enabled');
    expect(container.textContent).toContain('Run one cycle now');
  });

  it('uses lifecycle mutation responses immediately across stop and restart', async () => {
    const enabledOverview = {
      ...overviewPayload.data,
      account: { configured: true, eligible: true },
      automation: {
        enabled: true,
        status: 'idle',
        intervalMinutes: 15,
        killSwitch: false,
        locked: false,
      },
      runtime: {
        ...overviewPayload.data.runtime,
        enabled: true,
        status: 'idle',
        currentStage: 'completed',
        progress: 100,
      },
      config: { ...overviewPayload.data.config, enabled: true },
    };
    const stoppedOverview = {
      ...enabledOverview,
      automation: { ...enabledOverview.automation, enabled: false, status: 'stopped', nextRun: null },
      runtime: {
        ...enabledOverview.runtime,
        enabled: false,
        status: 'stopped',
        currentStage: 'stopped',
        progress: 0,
        nextRun: null,
      },
      config: { ...enabledOverview.config, enabled: false },
    };
    const restartedOverview = {
      ...enabledOverview,
      automation: { ...enabledOverview.automation, enabled: true, status: 'armed' },
      runtime: {
        ...enabledOverview.runtime,
        enabled: true,
        status: 'armed',
        currentStage: 'armed',
        progress: 0,
        nextRun: '2026-07-25T12:15:00Z',
      },
    };

    api.overview
      .mockResolvedValueOnce({ data: enabledOverview })
      .mockResolvedValueOnce({ data: stoppedOverview })
      .mockResolvedValueOnce({ data: restartedOverview });
    api.stopAutomation.mockResolvedValue({
      data: {
        success: true,
        config: stoppedOverview.config,
        runtime: stoppedOverview.runtime,
      },
    });
    api.startAutomation.mockResolvedValue({
      data: {
        success: true,
        config: restartedOverview.config,
        runtime: restartedOverview.runtime,
      },
    });

    await renderAt('/crypto/automation');
    await clickButton('Stop automation');

    expect(api.stopAutomation).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Automation is standing by');
    expect(container.textContent).toContain('Start 24/7 automation');

    await clickButton('Start 24/7 automation');

    expect(api.startAutomation).toHaveBeenCalledWith('paper', false);
    expect(container.textContent).toContain('Continuous trading is enabled');
    expect(container.textContent).toContain('Stop automation');
    expect(container.textContent).toContain('24/7 automation started.');
  });

  it('does not let an older overview request overwrite a lifecycle response', async () => {
    const enabledOverview = {
      ...overviewPayload.data,
      account: { configured: true, eligible: true },
      automation: {
        enabled: true,
        status: 'idle',
        intervalMinutes: 15,
        killSwitch: false,
        locked: false,
      },
      runtime: {
        ...overviewPayload.data.runtime,
        enabled: true,
        status: 'idle',
        currentStage: 'completed',
        progress: 100,
      },
      config: { ...overviewPayload.data.config, enabled: true },
    };
    const stoppedOverview = {
      ...enabledOverview,
      automation: { ...enabledOverview.automation, enabled: false, status: 'stopped' },
      runtime: {
        ...enabledOverview.runtime,
        enabled: false,
        status: 'stopped',
        currentStage: 'stopped',
        progress: 0,
      },
      config: { ...enabledOverview.config, enabled: false },
    };
    let resolveStale: ((value: unknown) => void) | undefined;
    const staleOverview = new Promise((resolve) => {
      resolveStale = resolve;
    });
    api.overview
      .mockResolvedValueOnce({ data: enabledOverview })
      .mockReturnValueOnce(staleOverview)
      .mockResolvedValueOnce({ data: stoppedOverview });
    api.stopAutomation.mockResolvedValue({
      data: {
        success: true,
        config: stoppedOverview.config,
        runtime: stoppedOverview.runtime,
      },
    });

    await renderAt('/crypto/automation');
    const refresh = container.querySelector(
      'button[aria-label="Refresh crypto data"]',
    );
    expect(refresh).not.toBeNull();
    await act(async () => {
      refresh?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await clickButton('Stop automation');
    expect(container.textContent).toContain('Automation is standing by');

    await act(async () => {
      resolveStale?.({ data: enabledOverview });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Automation is standing by');
    expect(container.textContent).toContain('Start 24/7 automation');
  });

  it('localizes a start 503 and silently rechecks the stopped state', async () => {
    mockedUseLanguage.mockReturnValue({ language: 'zh-CN' });
    const stoppedOverview = {
      ...overviewPayload.data,
      account: { configured: true, eligible: true },
      automation: {
        enabled: false,
        status: 'stopped',
        intervalMinutes: 15,
        killSwitch: false,
        locked: false,
      },
      runtime: {
        ...overviewPayload.data.runtime,
        enabled: false,
        status: 'stopped',
        currentStage: 'stopped',
        progress: 0,
      },
      config: { ...overviewPayload.data.config, enabled: false },
    };
    api.overview
      .mockResolvedValueOnce({ data: stoppedOverview })
      .mockResolvedValueOnce({ data: stoppedOverview });
    api.startAutomation.mockRejectedValue({
      response: {
        status: 503,
        data: {
          success: false,
          status: 'service_unavailable',
          message: 'The service is temporarily unavailable. Please try again shortly.',
        },
      },
    });

    await renderAt('/crypto/automation');
    await clickButton('启动 24/7 自动交易');

    expect(api.startAutomation).toHaveBeenCalledWith('paper', false);
    expect(api.overview).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('24/7 自动交易暂时无法启动');
    expect(container.textContent).toContain('自动交易等待启动');
    expect(container.textContent).toContain('已停止');
    expect(container.textContent).toContain('Crypto 自动交易已停止');
    expect(container.textContent).not.toContain('The service is temporarily unavailable');
  });

  it('does not report stop success when the reconciliation response omits enabled state', async () => {
    const enabledOverview = {
      ...overviewPayload.data,
      account: { configured: true, eligible: true },
      automation: {
        enabled: true,
        status: 'idle',
        intervalMinutes: 15,
        killSwitch: false,
        locked: false,
      },
      runtime: {
        ...overviewPayload.data.runtime,
        enabled: true,
        status: 'idle',
        currentStage: 'completed',
        progress: 100,
      },
      config: { ...overviewPayload.data.config, enabled: true },
    };
    api.overview
      .mockResolvedValueOnce({ data: enabledOverview })
      .mockResolvedValueOnce({
        data: {
          ...enabledOverview,
          automation: undefined,
          config: undefined,
          runtime: { cryptoPerformance: overviewPayload.data.runtime.cryptoPerformance },
        },
      });
    api.stopAutomation.mockRejectedValue(new Error('stop failed'));

    await renderAt('/crypto/automation');
    await clickButton('Stop automation');

    expect(container.textContent).toContain('stop failed');
    expect(container.textContent).not.toContain('Automation stopped.');
  });

  it('renders short-term and swing mandates while keeping backtests offline', async () => {
    await renderAt('/crypto/strategy');
    expect(container.textContent).toContain('Strategy & risk mandate');
    expect(container.textContent).toContain('Short-term');
    expect(container.textContent).toContain('Swing');
    expect(container.textContent).toContain('Entry, reduction and exit rules');
    expect(container.textContent).toContain('Backtesting remains an offline research tool');
    expect(container.textContent).not.toContain('Walk-forward ML');
  });

  it('renders configured SOL as an isolated Paper forward-validation sleeve', async () => {
    api.overview.mockResolvedValue({
      data: {
        ...overviewPayload.data,
        algorithm: { name: 'Helios Regime Ensemble', version: '2.4.0' },
        assets: [
          ...overviewPayload.data.assets,
          {
            symbol: 'SOL/USD',
            name: 'Solana',
            price: 184.25,
            change24h: 1.8,
            spreadBps: 7.5,
            executionReady: true,
            signal: 'WAIT',
            confidence: 58,
            regime: 'range',
          },
        ],
        config: {
          ...overviewPayload.data.config,
          symbols: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
          experimentalPaperSleeves: ['SOL/USD'],
          assetAllocationsPct: { 'BTC/USD': 18, 'ETH/USD': 12, 'SOL/USD': 4 },
          algorithm: { name: 'Helios Regime Ensemble', version: '2.4.0' },
        },
      },
    });

    await renderAt('/crypto');
    expect(container.textContent).toContain('BTC / ETH / SOL');
    expect(container.textContent).toContain('SOL/USD');
    expect(container.textContent).toContain('PAPER EXPERIMENT · FORWARD VALIDATION');
    expect(container.textContent).toContain('Isolated small-cap validation');
    expect(container.textContent).toContain('v2.4.0');

    await renderAt('/crypto/strategy');
    expect(container.textContent).toContain('SOL/USD allocation cap');
    expect(container.textContent).toContain('FORWARD VALIDATION');
    expect((container.querySelector('input[aria-label="SOL/USD allocation cap"]') as HTMLInputElement).disabled).toBe(false);
  });

  it('keeps Crypto in Paper mode when the workspace header is set to Real', async () => {
    mockedUseTradeMode.mockReturnValue({ tradeMode: 'real', tradeModeReady: true });
    api.overview.mockResolvedValue({
      data: {
        ...overviewPayload.data,
        mode: 'live',
        assets: [],
        config: {
          ...overviewPayload.data.config,
          mode: 'live',
          symbols: ['SOL/USD'],
          experimentalPaperSleeves: ['SOL/USD'],
          assetAllocationsPct: { 'SOL/USD': 4 },
        },
      },
    });

    await renderAt('/crypto');
    expect(container.textContent).toContain('SOL/USD');
    expect(container.textContent).toContain('PAPER EXPERIMENT · FORWARD VALIDATION');

    await renderAt('/crypto/strategy');
    expect(container.textContent).toContain('FORWARD VALIDATION');
    expect((container.querySelector('input[aria-label="SOL/USD allocation cap"]') as HTMLInputElement).disabled).toBe(false);
    expect(api.overview).toHaveBeenCalledWith('paper');
  });

  it('normalizes trades, decisions and system events into a professional ledger', async () => {
    api.ledger.mockResolvedValue({
      data: {
        success: true,
        scannedRows: 3,
        records: [
          {
            id: 'trade-1',
            eventType: 'crypto_trade_recorded',
            symbol: 'BTC/USD',
            source: 'scheduler',
            createdAt: '2026-07-25T12:00:00Z',
            payload: {
              action: 'REDUCE',
              status: 'filled',
              qty: 0.01,
              price: 65000,
              grossNotional: 650,
              netNotional: 647,
              fee: 3,
              realizedPnl: 20,
              positionBefore: { qty: 0.2 },
              positionAfter: { qty: 0.19 },
              source: 'scheduler',
            },
          },
          {
            id: 'decision-1',
            eventType: 'crypto_decision',
            symbol: 'ETH/USD',
            createdAt: '2026-07-25T11:45:00Z',
            payload: { action: 'HOLD', reason: 'Spread gate blocked entry.', source: 'scheduler' },
          },
          {
            id: 'system-1',
            eventType: 'crypto_automation_started',
            createdAt: '2026-07-25T11:30:00Z',
            payload: { source: 'manual', message: 'Automation enabled.' },
          },
        ],
      },
    });
    await renderAt('/crypto/ledger');
    expect(container.textContent).toContain('Professional trading ledger');
    expect(container.textContent).toContain('Trades 1');
    expect(container.textContent).toContain('Decisions 1');
    expect(container.textContent).toContain('System 1');
    expect(container.textContent).toContain('Realized P/L');
    expect(container.textContent).toContain('Net result');
    expect(container.textContent).toContain('+$17.00');
    expect(container.textContent).toContain('0.200000 → 0.190000');
    expect(container.textContent).toContain('Spread gate blocked entry.');
    expect(api.ledger).toHaveBeenCalledWith(100);
    expect(api.simTrades).not.toHaveBeenCalled();
  });

  it('renders the essential workspace labels in Chinese', async () => {
    mockedUseLanguage.mockReturnValue({ language: 'zh-CN' });
    await renderAt('/crypto');
    expect(container.textContent).toContain('数字资产交易台');
    expect(container.textContent).toContain('短线执行');
    expect(container.textContent).toContain('风险敞口');
    expect(container.textContent).toContain('拒绝下单');
  });
});
