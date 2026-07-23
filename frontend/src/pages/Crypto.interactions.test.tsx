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
  const Passthrough: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div>{children}</div>
  );
  const Empty: React.FC = () => null;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: Passthrough,
    BarChart: Passthrough,
    Area: Empty,
    Bar: Empty,
    Cell: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
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
    portfolio: { equity: 100000, exposurePct: 12.5, dayPnl: 250 },
    automation: { enabled: false, status: 'idle', killSwitch: false },
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

describe('Crypto workspace (Helios v2)', () => {
  it('renders the command view with ensemble signal details', async () => {
    await renderAt('/crypto');
    expect(container.textContent).toContain('Crypto Command');
    expect(container.textContent).toContain('BTC/USD');
    expect(container.textContent).toContain('Uptrend');
    expect(container.textContent).toContain('BUY');
    expect(container.textContent).toContain('P(up) 61%');
    expect(api.overview).toHaveBeenCalledWith('paper');
    expect(api.simOverview).toHaveBeenCalled();
  });

  it('renders the simulator view with performance stats', async () => {
    await renderAt('/crypto/automation');
    expect(container.textContent).toContain('24/7 Paper Autopilot');
    expect(container.textContent).toContain('RUNNING');
    expect(container.textContent).toContain('101,500');
    expect(container.textContent).toContain('Open positions');
  });

  it('renders the strategy lab explainer', async () => {
    await renderAt('/crypto/strategy');
    expect(container.textContent).toContain('Strategy Lab');
    expect(container.textContent).toContain('How Helios decides');
    expect(container.textContent).toContain('Walk-forward backtest');
  });

  it('renders the ledger with tabs', async () => {
    await renderAt('/crypto/ledger');
    expect(container.textContent).toContain('Sim trades');
    expect(container.textContent).toContain('Alpaca ledger');
    expect(api.simTrades).toHaveBeenCalled();
  });
});
