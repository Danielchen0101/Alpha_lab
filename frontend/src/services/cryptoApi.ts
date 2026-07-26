import api, { scannerApi } from './api';

export type CryptoMode = 'paper' | 'live';
export type CryptoAction = 'BUY' | 'ADD' | 'HOLD' | 'REDUCE' | 'EXIT' | 'WAIT';
export type CryptoRegime = 'trend_up' | 'trend_down' | 'range' | 'panic' | 'insufficient_data' | string;
export const CRYPTO_LEDGER_LIMIT = 100;

export interface EnsembleVotes {
  trend?: number;
  breakout?: number;
  momentum?: number;
  meanrev?: number;
}

export interface EnsembleMl {
  probability_up?: number;
  score_adjustment?: number;
  veto?: boolean;
  model_version?: string | null;
}

export interface EnsembleDetail {
  regime?: CryptoRegime;
  composite?: number;
  votes?: EnsembleVotes;
  weights?: EnsembleVotes;
  ml?: EnsembleMl | null;
}

export interface SignalIndicators {
  ema_10?: number;
  ema_40?: number;
  ema_anchor?: number;
  anchor_slope_pct?: number;
  momentum_3d?: number;
  momentum_20d?: number;
  momentum_65d?: number;
  atr_pct?: number;
  annualized_volatility_30d?: number;
  vol_ratio?: number;
  rsi?: number;
  rsi_fast?: number;
  adx?: number;
  zscore?: number;
  macd_hist_pct?: number | null;
  volume_z?: number;
  donchian_pos?: number | null;
  [key: string]: number | null | undefined;
}

export interface CryptoSignalDetail {
  action?: CryptoAction;
  confidence?: number;
  regime?: CryptoRegime;
  targetWeight?: number;
  reasons?: string[];
  ensemble?: EnsembleDetail | null;
  indicators?: SignalIndicators | null;
}

export interface CryptoAssetSnapshot {
  symbol: string;
  name?: string;
  price?: number | null;
  change24h?: number | null;
  bid?: number | null;
  ask?: number | null;
  spreadBps?: number | null;
  volume?: number | null;
  volume24h?: number | null;
  dailyDollarVolume?: number | null;
  tradable?: boolean | null;
  dataAvailable?: boolean;
  marketDataAvailable?: boolean;
  executionReady?: boolean;
  reasons?: string[];
  quoteAgeSeconds?: number | null;
  signal?: string;
  confidence?: number;
  regime?: CryptoRegime;
  signalDetail?: CryptoSignalDetail;
}

export interface CryptoPosition {
  symbol?: string;
  qty?: number | null;
  marketValue?: number | null;
  currentPrice?: number | null;
  averageEntryPrice?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPnlPct?: number | null;
  side?: string;
  [key: string]: unknown;
}

export interface CryptoDecision {
  action?: CryptoAction | string;
  symbol?: string;
  confidence?: number | null;
  score?: number | null;
  reason?: string;
  reasons?: string[];
  currentWeight?: number | null;
  targetWeight?: number | null;
  regime?: CryptoRegime;
  price?: number | null;
  timestamp?: string | null;
  recordedAt?: string | null;
  source?: string;
  executed?: boolean;
  dryRun?: boolean;
  order?: Record<string, unknown> | null;
  entryGate?: {
    eligible?: boolean;
    reasons?: string[];
    [key: string]: unknown;
  } | null;
  persistentRiskGate?: {
    eligible?: boolean;
    reasons?: string[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface CryptoPerformancePoint {
  time?: string | number;
  value?: number | null;
  tradePnl?: number | null;
  grossPnl?: number | null;
  fee?: number | null;
  symbol?: string;
  action?: string;
  [key: string]: unknown;
}

export interface CryptoRuntime {
  status?: string;
  enabled?: boolean;
  locked?: boolean;
  killSwitch?: boolean;
  heartbeat?: string | null;
  lastHeartbeat?: string | null;
  heartbeatAgeSeconds?: number | null;
  staleAfterSeconds?: number | null;
  recoveryState?: string | null;
  lastRun?: string | null;
  nextRun?: string | null;
  lastDurationMs?: number | null;
  cycleCount?: number | null;
  consecutiveErrors?: number | null;
  lastError?: string | null;
  currentStage?: string | null;
  progress?: number | null;
  message?: string | null;
  cooldownUntil?: string | null;
  reconciliationRequired?: boolean;
  reconciliationMessage?: string | null;
  manualReviewRequired?: boolean;
  cryptoPerformance?: {
    realizedPnl?: number | null;
    estimatedFees?: number | null;
    tradeCount?: number | null;
    closedTradeCount?: number | null;
    wins?: number | null;
    losses?: number | null;
    curve?: CryptoPerformancePoint[];
    tradesPerWeek?: number | null;
    averageHoldingHours?: number | null;
    medianHoldingHours?: number | null;
    costToGrossProfit?: number | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CryptoRiskSnapshot {
  daily_return?: number | null;
  seven_day_return?: number | null;
  drawdown?: number | null;
  [key: string]: unknown;
}

export interface CryptoLedgerRecord {
  id?: string;
  eventType?: string;
  actor?: string;
  source?: string;
  symbol?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
}

export interface CryptoLedgerResponse {
  success?: boolean;
  records?: CryptoLedgerRecord[];
  limit?: number;
  returnedCount?: number;
  scannedRows?: number;
  scannedPages?: number;
  maxScannedRows?: number;
  maxPages?: number;
  scanTruncated?: boolean;
}

export interface CryptoOverviewResponse {
  success: boolean;
  mode: CryptoMode;
  asOf?: string;
  source?: string;
  account?: {
    configured?: boolean;
    cryptoStatus?: string;
    eligible?: boolean | null;
    eligibilityReasons?: string[];
    equity?: number | null;
    nonMarginableBuyingPower?: number | null;
  };
  accountError?: string | null;
  assets?: CryptoAssetSnapshot[];
  portfolio?: {
    equity?: number | null;
    cryptoEquity?: number | null;
    cash?: number | null;
    exposurePct?: number | null;
    dayPnl?: number | null;
    positions?: CryptoPosition[];
  };
  automation?: {
    enabled?: boolean;
    status?: string;
    nextRun?: string | null;
    lastRun?: string | null;
    intervalMinutes?: number;
    killSwitch?: boolean;
    locked?: boolean;
    coverage?: string;
  };
  runtime?: CryptoRuntime;
  risk?: CryptoRiskSnapshot;
  decision?: CryptoDecision | null;
  decisions?: CryptoDecision[];
  equityCurve?: Array<[string, number] | { time: string | number; value: number }>;
  config?: Partial<CryptoConfig>;
  ledger?: CryptoLedgerResponse;
  algorithm?: { name?: string; version?: string };
  liveAdmission?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  error?: string;
  message?: string;
}

export interface CryptoConfig {
  enabled: boolean;
  mode: CryptoMode;
  symbols: string[];
  experimentalPaperSleeves: string[];
  tradeHorizon: 'short' | 'long';
  intervalMinutes: number;
  liveAuthorized: boolean;
  killSwitch: boolean;
  maxTotalExposure: number;
  maxAssetExposurePct: number;
  assetAllocationsPct: Record<string, number>;
  riskPerTradePct: number;
  minimumConfidence: number;
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  maxOrderNotional: number;
  minOrderNotional: number;
  allowAdds: boolean;
  aiReviewEnabled: boolean;
  paperLearningEnabled: boolean;
  calibrationEveryCycles: 12 | 24 | 48 | 168;
  order: {
    type: 'market' | 'limit' | 'stop_limit';
    timeInForce: 'gtc' | 'ioc';
    limitOffsetBps: number;
    stopOffsetBps: number;
  };
  strategy: Record<string, unknown>;
  algorithm: { name: string; version: string };
  version?: number;
}

export type CryptoConfigUpdate = Partial<CryptoConfig> & {
  confirmLiveRisk?: boolean;
};

export const sanitizeCryptoConfigUpdate = (config: CryptoConfigUpdate): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...config };
  delete payload.enabled;
  delete payload.killSwitch;
  return payload;
};

// ---------------------------------------------------------------- simulator

export interface SimPosition {
  symbol: string;
  qty: number;
  avgEntry: number | null;
  lastPrice: number | null;
  marketValue: number;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  weight: number;
  protectiveStop?: number | null;
}

export interface SimPerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  volatility: number;
  observations: number;
}

export interface SimTrade {
  symbol: string;
  side: 'buy' | 'sell';
  action: string;
  grossNotional: number;
  fee: number;
  qty: number;
  price: number;
  realizedPnl?: number;
  timestamp: string;
  recordedAt?: string;
  source?: string;
  equityAfter?: number | null;
}

export interface SimDecision {
  timestamp?: string;
  recordedAt?: string;
  symbol: string;
  action: string;
  regime?: CryptoRegime;
  score?: number;
  targetWeight?: number;
  price?: number;
  reasons?: string[];
  ensemble?: EnsembleDetail | null;
  source?: string;
  executed?: boolean;
}

export interface SimMlMeta {
  trainedAt?: string;
  symbol?: string;
  modelVersion?: string;
  summary?: {
    epochs_run?: number;
    best_val_logloss?: number | null;
    val_accuracy?: number;
    val_auc?: number;
    positives?: number;
    negatives?: number;
  };
  dataset?: {
    samples?: number;
    train_samples?: number;
    validation_samples?: number;
    deadband_bps?: number;
  };
}

export interface SimOverviewResponse {
  success: boolean;
  version?: string;
  running?: boolean;
  threadAlive?: boolean;
  config?: {
    enabled?: boolean;
    intervalMinutes?: number;
    symbols?: string[];
    initialCapital?: number;
    feeBps?: number;
    slippageBps?: number;
    mlEnabled?: boolean;
    mlRetrainHours?: number;
    mlHistoryDays?: number;
    strategy?: Record<string, unknown>;
  };
  status?: {
    running?: boolean;
    lastCycleAt?: string | null;
    lastCycleDurationMs?: number | null;
    cycleCount?: number;
    lastError?: string | null;
    nextRunAt?: string | null;
    startedAt?: string | null;
  };
  account?: {
    cash: number;
    initialCapital: number;
    equity: number;
    positions: SimPosition[];
  };
  performance?: SimPerformance;
  benchmark?: SimPerformance | null;
  tradeCount?: number;
  sellTradeCount?: number;
  sellWinRate?: number | null;
  lastBarTime?: Record<string, string>;
  latestDecisions?: SimDecision[];
  recentTrades?: SimTrade[];
  recentErrors?: Array<{ at: string; message: string }>;
  ml?: Record<string, SimMlMeta>;
  equityCurve?: Array<[string, number]>;
  benchmarkCurve?: Array<[string, number]>;
  message?: string;
  reason?: string;
}

export interface ResearchBacktestMetrics {
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  trades: number;
  turnover: number;
  fees: number;
  ending_equity: number;
  win_rate?: number | null;
  profit_factor?: number | null;
}

export interface ResearchBacktestResponse {
  success: boolean;
  algorithm?: string;
  version?: string;
  symbol?: string;
  from?: string;
  to?: string;
  timeframe?: string;
  metrics?: ResearchBacktestMetrics;
  benchmarkMetrics?: ResearchBacktestMetrics;
  equityCurve?: Array<[string, number]>;
  benchmarkCurve?: Array<[string, number]>;
  regimeStats?: Record<string, { bars: number; share: number; return_contribution: number }>;
  tradeStats?: {
    round_trips?: number;
    wins?: number;
    losses?: number;
    win_rate?: number | null;
    average_win?: number | null;
    average_loss?: number | null;
    profit_factor?: number | null;
  };
  monthlyReturns?: Array<{ month: string; return: number }>;
  recentFills?: Array<Record<string, unknown>>;
  mlUsed?: boolean;
  mlReport?: {
    foldMetrics?: Array<{ fold: number; train_samples: number; test_samples: number; accuracy: number; auc: number }>;
    oosAuc?: number | null;
    coverage?: number;
    deadbandBps?: number;
    error?: string;
  } | null;
  dataBars?: number;
  message?: string;
  reason?: string;
}

export interface SimTradesResponse {
  success: boolean;
  trades?: SimTrade[];
  decisions?: SimDecision[];
  totalTrades?: number;
}

const SIM_TIMEOUT = 4 * 60 * 1000;

export const cryptoAPI = {
  // ---- Alpaca-account workspace (existing backend contract) ----
  overview: (mode: CryptoMode) =>
    api.get<CryptoOverviewResponse>('/crypto/overview', { params: { mode } }),
  assets: (mode: CryptoMode) =>
    api.get('/crypto/assets', { params: { mode } }),
  bars: (symbol: string, timeframe = '1Hour', limit = 720, mode?: CryptoMode) =>
    api.get('/crypto/bars', { params: { symbol, timeframe, limit, ...(mode ? { mode } : {}) } }),
  getConfig: () =>
    api.get<{ success: boolean; config: CryptoConfig }>('/crypto/config'),
  saveConfig: (config: CryptoConfigUpdate) =>
    api.put<{ success: boolean; config: CryptoConfig }>('/crypto/config', sanitizeCryptoConfigUpdate(config)),
  runtime: () => api.get('/crypto/runtime'),
  ledger: (limit = CRYPTO_LEDGER_LIMIT) =>
    api.get<CryptoLedgerResponse>('/crypto/ledger', {
      params: { limit: Math.min(CRYPTO_LEDGER_LIMIT, Math.max(1, limit)) },
    }),
  runCycle: (mode: CryptoMode, dryRun = false) =>
    scannerApi.post('/crypto/run-cycle', { mode, dryRun }, { timeout: SIM_TIMEOUT }),
  backtest: (payload: Record<string, unknown>) =>
    scannerApi.post('/crypto/backtest', payload, { timeout: SIM_TIMEOUT }),
  calibrate: (apply = true) =>
    scannerApi.post('/crypto/calibration/run', { apply }, { timeout: SIM_TIMEOUT }),
  strategyLibrary: () =>
    api.get<{
      success: boolean;
      version: string;
      strategies: Array<{
        id: string;
        name: string;
        role: 'control' | 'paper_challenger';
        source: { title?: string; url?: string; concept?: string };
      }>;
      method: string;
      guardrail: string;
    }>('/crypto/strategy-library'),
  startAutomation: (mode: CryptoMode, acknowledgeRisk = false) =>
    api.post('/crypto/automation/start', {
      mode,
      ...(acknowledgeRisk ? { acknowledgeRisk: true } : {}),
    }),
  stopAutomation: () => api.post('/crypto/automation/stop'),
  setKillSwitch: (enabled: boolean, reason = '') =>
    api.post('/crypto/kill-switch', { enabled, reason }),

  // ---- Local 24/7 paper-trading simulator (Helios) ----
  simOverview: () => api.get<SimOverviewResponse>('/crypto/sim/overview'),
  simStart: () => api.post<SimOverviewResponse>('/crypto/sim/start'),
  simStop: () => api.post<SimOverviewResponse>('/crypto/sim/stop'),
  simReset: (initialCapital?: number) =>
    api.post<SimOverviewResponse>('/crypto/sim/reset', {
      confirm: true,
      ...(initialCapital ? { initialCapital } : {}),
    }),
  simRunCycle: () =>
    scannerApi.post<SimOverviewResponse>('/crypto/sim/run-cycle', {}, { timeout: SIM_TIMEOUT }),
  simUpdateConfig: (payload: Record<string, unknown>) =>
    api.put<SimOverviewResponse>('/crypto/sim/config', payload),
  simTrain: (symbol?: string) =>
    scannerApi.post('/crypto/sim/train', symbol ? { symbol } : {}, { timeout: SIM_TIMEOUT }),
  simTrades: (limit = 100) =>
    api.get<SimTradesResponse>('/crypto/sim/trades', { params: { limit } }),
  simEquity: (points = 1000) =>
    api.get('/crypto/sim/equity', { params: { points } }),
  simResearchBacktest: (payload: {
    symbol: string;
    days: number;
    useMl: boolean;
    initialCapital?: number;
  }) =>
    scannerApi.post<ResearchBacktestResponse>('/crypto/sim/research-backtest', payload, {
      timeout: SIM_TIMEOUT,
    }),
};

export default cryptoAPI;
