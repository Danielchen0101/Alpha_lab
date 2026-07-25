import api from './api';

export type KalshiDecisionAction = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'WAIT';
export type KalshiExecutionMode = 'paper' | 'real';

// v6 adds settlement-aligned reference and improved scale-in controls.
export const KALSHI_CONFIG_STORAGE_KEY = 'alphalab:kalshi:btc15m:config:v6';
export const KALSHI_CONFIG_CHANGED_EVENT = 'alphalab:kalshi-config-changed';

export interface KalshiBotConfig {
  executionMode: KalshiExecutionMode;
  paperBankroll: number;
  riskPerTradePct: number;
  minNetEdge: number;
  minConservativeEdge: number;
  maxSpread: number;
  maxRelativeSpread: number;
  minDepthContracts: number;
  maxBookParticipation: number;
  minSecondsToClose: number;
  maxSecondsToClose: number;
  minPrice: number;
  maxPrice: number;
  minModelProbability: number;
  marketBlendWeight: number;
  maxModelMarketGap: number;
  probabilityLogitScale: number;
  momentumProjectionScale: number;
  basisReserveBps: number;
  maxVolatilityRatio: number;
  maxJumpSigma: number;
  fractionalKelly: number;
  maxPortfolioExposurePct: number;
  executionPriceTolerance: number;
  exitProbabilityThreshold: number;
  minimumExitProfit: number;
  stopLossPct: number;
  emergencyStopLossPct: number;
  maxSingleMarketExposurePct: number;
  minimumAddIntervalSeconds: number;
  addMinModelProbability: number;
  addMinConservativeEdge: number;
  addMinProbabilityImprovement: number;
  addMinEdgeImprovement: number;
  addSizeFraction: number;
  minimumHoldSeconds: number;
  reversalCooldownSeconds: number;
  exitValueBuffer: number;
  takeProfitScaleOutPct: number;
}

// Mirror backend DEFAULT_STRATEGY_CONFIG (kalshi_engine.py).
export const DEFAULT_KALSHI_BOT_CONFIG: KalshiBotConfig = {
  executionMode: 'paper',
  paperBankroll: 1000,
  riskPerTradePct: 0.75,
  minNetEdge: 0.0075,
  minConservativeEdge: 0.002,
  maxSpread: 0.06,
  maxRelativeSpread: 0.20,
  minDepthContracts: 5,
  maxBookParticipation: 0.20,
  minSecondsToClose: 60,
  maxSecondsToClose: 720,
  minPrice: 0.50,
  maxPrice: 0.95,
  minModelProbability: 0.58,
  marketBlendWeight: 0.20,
  maxModelMarketGap: 0.30,
  probabilityLogitScale: 1.95,
  momentumProjectionScale: 0.07,
  basisReserveBps: 3,
  maxVolatilityRatio: 3,
  maxJumpSigma: 5,
  fractionalKelly: 0.25,
  maxPortfolioExposurePct: 25,
  executionPriceTolerance: 0.01,
  exitProbabilityThreshold: 0.35,
  minimumExitProfit: 0.015,
  takeProfitScaleOutPct: 0.50,
  stopLossPct: 0.45,
  emergencyStopLossPct: 0.25,
  maxSingleMarketExposurePct: 8,
  minimumAddIntervalSeconds: 45,
  addMinModelProbability: 0.64,
  addMinConservativeEdge: 0.0075,
  addMinProbabilityImprovement: 0.01,
  addMinEdgeImprovement: 0.001,
  addSizeFraction: 0.50,
  minimumHoldSeconds: 60,
  reversalCooldownSeconds: 90,
  exitValueBuffer: 0.010,
};


export interface KalshiGate {
  key: string;
  status: 'pass' | 'observe' | 'block';
  blocking?: boolean;
  severity: 'hard' | 'review' | string;
  label: string;
  labelZh: string;
  detail: string;
  category?: 'data' | 'signal' | 'execution' | 'account' | string;
}

export interface KalshiDecision {
  engine: string;
  generatedAt: string;
  paperOnly: boolean;
  action: KalshiDecisionAction;
  side?: 'YES' | 'NO' | null;
  signalQuality: number;
  blockingReasons: string[];
  market: {
    ticker?: string;
    status?: string;
    title?: string;
    openTime?: string;
    closeTime?: string;
    occurrenceTime?: string;
    secondsToClose?: number;
    strike?: number | null;
    yesBid?: number | null;
    yesAsk?: number | null;
    noBid?: number | null;
    noAsk?: number | null;
    lastPrice?: number | null;
    spread?: number | null;
    yesAskDepth?: number | null;
    noAskDepth?: number | null;
    selectedDepth?: number | null;
    edgeEligibleDepth?: number | null;
    bookImbalance?: number | null;
    micropriceYes?: number | null;
    bookAgeSeconds?: number | null;
    volume?: number | null;
    openInterest?: number | null;
  };
  model: {
    spot?: number | null;
    strike?: number | null;
    distanceBps?: number | null;
    minuteVolatility?: number | null;
    projected15mVolatility?: number | null;
    horizonVolatility?: number | null;
    settlementEffectiveHorizonMinutes?: number | null;
    referenceModel?: string;
    referenceVenueCount?: number;
    referenceDispersionBps?: number | null;
    basisReserveBpsApplied?: number | null;
    momentum3m?: number | null;
    momentum5m?: number | null;
    momentum15m?: number | null;
    volatilityRatio?: number | null;
    jumpSigma?: number | null;
    marketYesProbability?: number | null;
    modelYesProbability?: number | null;
    fairYesProbability?: number | null;
    selectedModelProbability?: number | null;
    marketWeight?: number | null;
    uncertainty?: number | null;
    referenceAgeSeconds?: number | null;
    sampleSize?: number;
  };
  edge: {
    side?: 'YES' | 'NO' | null;
    price?: number | null;
    executionLimitPrice?: number | null;
    fairProbability?: number | null;
    modelProbability?: number | null;
    minimumModelProbability?: number;
    grossEdge?: number | null;
    feePerContract?: number | null;
    netEdge?: number | null;
    conservativeProbability?: number | null;
    conservativeEdge?: number | null;
    minimumNetEdge?: number;
    minimumConservativeEdge?: number;
  };
  sizing: {
    paperBankroll: number;
    riskPerTradePct: number;
    riskBudget: number;
    hardRiskBudget?: number;
    fullKelly?: number;
    fractionalKelly?: number;
    bookParticipationPct?: number;
    contracts: number;
    estimatedFee: number;
    maximumLoss: number;
    expectedValue: number;
  };
  gates: KalshiGate[];
  config: KalshiBotConfig;
  methodology: Record<string, string>;
}

export interface KalshiSnapshot {
  asOf: string;
  selection: 'active' | 'upcoming' | 'recent' | 'unavailable';
  seriesTicker: string;
  market: Record<string, unknown>;
  orderbook: {
    yes: Array<[string, string]>;
    no: Array<[string, string]>;
  };
  orderbookAsOf?: string | null;
  reference: {
    symbol: string;
    price?: string | number | null;
    bid?: string | number | null;
    ask?: string | number | null;
    timestamp?: string | null;
    model?: string;
    isOfficialBrti?: boolean;
    venueCount?: number;
    venues?: string[];
    rejectedVenues?: string[];
    dispersionBps?: number;
    candleCount?: number;
  };
  warnings: string[];
  sources: Record<string, string>;
  eventTicker?: string;
  candidateCount?: number;
  candidateSummary?: Array<Record<string, any>>;
}

export interface KalshiEvaluationResponse {
  success: boolean;
  snapshot: KalshiSnapshot;
  decision: KalshiDecision;
  code?: string;
  message?: string;
  robotState?: KalshiPaperRobotState;
}

export interface KalshiPaperRobotState {
  enabled: boolean;
  intervalSeconds: number;
  lastRunAt?: string | null;
  lastError?: string | null;
  runs: number;
  config: Partial<KalshiBotConfig>;
  decisions: Array<Record<string, any>>;
  decisionLimit?: number;
  strategy: {
    name: string;
    version: number;
    philosophy: string;
    components: string[];
    changes: Array<Record<string, any>>;
    settledSamples?: number;
    wins?: number;
    winRate?: number | null;
    brierScore?: number | null;
    dailyPnl?: number;
    totalPnl?: number;
    averagePnl?: number;
    losses?: number;
    settlementRecords?: KalshiSettlementRecord[];
    realizedTradeRecords?: KalshiSettlementRecord[];
    realizedSamples?: number;
    realizedWins?: number;
    realizedLosses?: number;
    realizedWinRate?: number | null;
    realizedTotalPnl?: number;
    realizedAveragePnl?: number;
    equityCurve?: KalshiEquityPoint[];
  };
}

export interface KalshiSettlementRecord {
  key: string;
  ticker: string;
  settledAt: string;
  result?: 'YES' | 'NO' | null;
  side?: 'YES' | 'NO' | null;
  contracts: number;
  revenue: number;
  cost: number;
  fees: number;
  pnl: number;
  entryPrice?: number | null;
  exitPrice?: number | null;
  exitType?: 'settlement' | 'sale' | string;
  exitTrigger?: string | null;
  netExitPnlPerContract?: number | null;
  exitLossFraction?: number | null;
  won: boolean;
  matchedFill: boolean;
}

export interface KalshiEquityPoint {
  at: string;
  ticker: string;
  pnl: number;
  cumulativePnl: number;
}

export interface KalshiPortfolioAnalytics {
  settledSamples?: number;
  wins?: number;
  losses?: number;
  winRate?: number | null;
  totalPnl?: number;
  averagePnl?: number;
  bestTrade?: number | null;
  worstTrade?: number | null;
  settlementRecords?: KalshiSettlementRecord[];
  realizedTradeRecords?: KalshiSettlementRecord[];
  realizedSamples?: number;
  realizedWins?: number;
  realizedLosses?: number;
  realizedWinRate?: number | null;
  realizedTotalPnl?: number;
  realizedAveragePnl?: number;
  realizedBestTrade?: number | null;
  realizedWorstTrade?: number | null;
  equityCurve?: KalshiEquityPoint[];
  marketPerformance?: Record<'btc15m' | 'btchourly', {
    family: 'btc15m' | 'btchourly';
    label: string;
    samples: number;
    wins: number;
    losses: number;
    winRate: number | null;
    realizedPnl: number;
    averagePnl: number;
    records: KalshiSettlementRecord[];
    equityCurve: KalshiEquityPoint[];
  }>;
}

export interface KalshiPaperPortfolio {
  environment: KalshiExecutionMode | string;
  accountProvider?: 'AlphaLab' | 'Kalshi' | string;
  balance: { balance?: number; portfolio_value?: number; starting_balance?: number; updated_ts?: number };
  positions: Array<Record<string, any>>;
  orders: Array<Record<string, any>>;
  fills: Array<Record<string, any>>;
  settlements: Array<Record<string, any>>;
  analytics?: KalshiPortfolioAnalytics;
  asOf: string;
}

export interface KalshiPaperResponse {
  success: boolean;
  portfolio?: KalshiPaperPortfolio;
  state: KalshiPaperRobotState;
  snapshot?: KalshiSnapshot;
  decision?: KalshiDecision;
  order?: Record<string, any> | null;
  orderSubmitted?: boolean;
  orderFilled?: boolean;
  message?: string;
}

export type KalshiEnvironment = 'production';

export interface KalshiConnectionSummary {
  configured: boolean;
  apiKeyIdMasked: string;
  privateKeySaved: boolean;
  baseUrl: string;
  testStatus: 'not_tested' | 'saved' | 'connected' | string;
  lastTestedAt?: string | null;
}

export interface KalshiConnectionConfigResponse {
  success: boolean;
  activeEnvironment: KalshiExecutionMode;
  paper?: { builtIn: boolean; configured: boolean; startingBalance: number; startingBalanceCents?: number; marketDataBaseUrl: string };
  environments: Record<KalshiEnvironment, KalshiConnectionSummary>;
  message?: string;
}

const kalshiAPI = {
  snapshot: () => api.get<KalshiEvaluationResponse>('/kalshi/btc-15m/snapshot', { timeout: 15000 }),
  evaluate: (config: KalshiBotConfig) => api.post<KalshiEvaluationResponse>(
    '/kalshi/btc-15m/evaluate',
    { config },
    { timeout: 15000 },
  ),
  evaluateHourly: (mode: KalshiExecutionMode = 'paper') => api.post<KalshiEvaluationResponse>(
    '/kalshi/btc-hourly/evaluate',
    { mode },
    { timeout: 30000 },
  ),
  paperPortfolio: (mode: KalshiExecutionMode = 'paper') => api.get<KalshiPaperResponse>('/kalshi/paper/portfolio', { params: { mode }, timeout: 20000 }),
  paperRobotStatus: (mode?: KalshiExecutionMode) => api.get<KalshiPaperResponse>('/kalshi/paper/robot', { params: mode ? { mode } : undefined, timeout: 10000 }),
  setPaperRobot: (enabled: boolean, config: KalshiBotConfig, mode: KalshiExecutionMode = config.executionMode || 'paper') => api.post<KalshiPaperResponse>(
    '/kalshi/paper/robot',
    { enabled, mode, config: { ...config, executionMode: mode } },
    { timeout: 25000 },
  ),
  savePaperRobotConfig: (config: KalshiBotConfig, mode: KalshiExecutionMode = config.executionMode || 'paper') => api.post<KalshiPaperResponse>(
    '/kalshi/paper/robot/config',
    { mode, config: { ...config, executionMode: mode } },
    { timeout: 15000 },
  ),
  runPaperRobotTick: (mode: KalshiExecutionMode = 'paper', family: 'btc15m' | 'btchourly' = 'btc15m') => api.post<KalshiPaperResponse>('/kalshi/paper/robot/tick', { mode, family }, { timeout: 30000 }),
  resetPaperAccount: (mode: KalshiExecutionMode = 'paper') => api.delete<KalshiPaperResponse>('/kalshi/paper/portfolio', { params: { mode }, timeout: 15000 }),
  status: () => api.get('/kalshi/status', { timeout: 10000 }),
  getConnectionConfig: () => api.get<KalshiConnectionConfigResponse>('/kalshi/config', { timeout: 10000 }),
  saveConnectionConfig: (payload: { environment: KalshiEnvironment; apiKeyId?: string; privateKey?: string }) => (
    api.post('/kalshi/config', payload, { timeout: 15000 })
  ),
  testConnection: (environment: KalshiEnvironment) => api.post(
    '/kalshi/config/test',
    { environment },
    { timeout: 15000 },
  ),
  removeConnection: (environment: KalshiEnvironment) => api.delete(
    '/kalshi/config',
    { data: { environment }, timeout: 15000 },
  ),
};

export default kalshiAPI;
