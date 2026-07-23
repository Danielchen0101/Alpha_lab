import api from './api';

export type KalshiDecisionAction = 'BUY_YES' | 'BUY_NO' | 'WAIT';
export type KalshiExecutionMode = 'paper' | 'real';

// v3 key: stale pre-v3 local configs carried longshot-era parameters and must
// not override the calibrated favorite-carry defaults.
export const KALSHI_CONFIG_STORAGE_KEY = 'alphalab:kalshi:btc15m:config:v3';
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
  preTradeAiReview: boolean;
  learningMode: boolean;
  learningAiMode: boolean;
  learningContrarianMode: boolean;
  learningExplorationRate: number;
  learningReviewEvery: number;
  learningWindowSize: number;
  learningMaxRiskPct: number;
}

// v3 Favorite Carry defaults — mirror backend DEFAULT_STRATEGY_CONFIG
// (kalshi_engine.py). Calibrated on 53,936 real 15-minute windows.
export const DEFAULT_KALSHI_BOT_CONFIG: KalshiBotConfig = {
  executionMode: 'paper',
  paperBankroll: 1000,
  riskPerTradePct: 0.75,
  minNetEdge: 0.015,
  minConservativeEdge: 0.005,
  maxSpread: 0.05,
  maxRelativeSpread: 0.15,
  minDepthContracts: 10,
  maxBookParticipation: 0.20,
  minSecondsToClose: 100,
  maxSecondsToClose: 320,
  minPrice: 0.50,
  maxPrice: 0.93,
  minModelProbability: 0.60,
  marketBlendWeight: 0.20,
  maxModelMarketGap: 0.25,
  probabilityLogitScale: 1.95,
  momentumProjectionScale: 0.07,
  basisReserveBps: 3,
  maxVolatilityRatio: 2.50,
  maxJumpSigma: 4,
  fractionalKelly: 0.25,
  maxPortfolioExposurePct: 25,
  executionPriceTolerance: 0.01,
  exitProbabilityThreshold: 0.35,
  minimumExitProfit: 0.02,
  stopLossPct: 0.55,
  emergencyStopLossPct: 0.30,
  preTradeAiReview: true,
  learningMode: true,
  learningAiMode: true,
  learningContrarianMode: false,
  learningExplorationRate: 0.15,
  learningReviewEvery: 6,
  learningWindowSize: 40,
  learningMaxRiskPct: 1.0,
};


export interface KalshiGate {
  key: string;
  status: 'pass' | 'block';
  severity: 'hard' | 'review' | string;
  label: string;
  labelZh: string;
  detail: string;
  category?: 'data' | 'signal' | 'execution' | 'account' | string;
}

export interface KalshiAiReview {
  status: 'reviewed' | 'not_configured' | 'unavailable' | 'disabled' | 'not_required' | string;
  verdict: 'clear' | 'challenge' | 'not_reviewed' | string;
  ticker?: string;
  confidence?: number;
  summary?: string;
  contradictions?: string[];
  missingData?: string[];
  topRisks?: string[];
  nextCheck?: string;
  provider?: string;
  model?: string;
  source?: string;
  reviewedAt?: string;
  cached?: boolean;
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
  aiReview?: KalshiAiReview;
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
    candleCount?: number;
  };
  warnings: string[];
  sources: Record<string, string>;
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
    consecutiveLosses?: number;
    cooldownUntil?: string | null;
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
    preTradeAi?: KalshiAiReview;
    learning?: {
      enabled: boolean;
      paperOnly: boolean;
      status: 'disabled' | 'warmup' | 'reviewed' | 'paper_only' | string;
      reviewEvery: number;
      windowSize: number;
      lastReviewSample: number;
      nextReviewSample: number;
      lastReviewAt?: string | null;
      lastReason?: string;
      recentWinRate?: number | null;
      recentAveragePnl?: number | null;
      recentBrierScore?: number | null;
      adjustmentCount?: number;
      explorationRate?: number;
      aiEnabled?: boolean;
      aiStatus?: string;
      aiProvider?: string | null;
      aiModel?: string | null;
      lastAiReviewSample?: number;
      lastAiReviewAt?: string | null;
      lastAiDiagnosis?: string | null;
      lastAiRootCause?: string | null;
      lastAiTargetMetric?: string | null;
      lastAiExpectedEffect?: string | null;
      lastAiEvidenceUsed?: string[];
      lastAiReasons?: string[];
      lastAiAdjustments?: Record<string, { delta?: number; value?: unknown }>;
      aiConfidence?: number;
      aiDirectionRecommendation?: 'normal' | 'contrarian' | 'hold' | string;
      originalDirectionalAccuracy?: number | null;
      inverseDirectionalAccuracy?: number | null;
      directionalSamples?: number;
      observedDirectionalAccuracy?: number | null;
      observedInverseAccuracy?: number | null;
      activeDirectionalAccuracy?: number | null;
      observedSamples?: number;
      directionalWindowSamples?: number;
      tradedSamples?: number;
      contrarianMode?: boolean;
    };
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

export interface KalshiStrategyLibraryItem {
  id: string;
  mode: KalshiExecutionMode;
  name: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  active?: boolean;
  recommendationScore?: number;
  config: Partial<KalshiBotConfig>;
  metrics: {
    settledSamples?: number;
    realizedSamples?: number;
    wins?: number;
    losses?: number;
    winRate?: number | null;
    totalPnl?: number;
    averagePnl?: number;
    brierScore?: number | null;
    adjustmentCount?: number;
    activeDirection?: string;
    observedSamples?: number;
    directionalWindowSamples?: number;
    observedDirectionalAccuracy?: number | null;
    observedInverseAccuracy?: number | null;
  };
}

export interface KalshiStrategyLibraryResponse {
  success: boolean;
  activeEnvironment: KalshiExecutionMode;
  activeStrategyId?: string;
  recommendedStrategyId?: string | null;
  strategies: KalshiStrategyLibraryItem[];
  strategy?: KalshiStrategyLibraryItem;
  state?: KalshiPaperRobotState;
  reason?: string;
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
  runPaperRobotTick: (mode: KalshiExecutionMode = 'paper') => api.post<KalshiPaperResponse>('/kalshi/paper/robot/tick', { mode }, { timeout: 25000 }),
  resetPaperAccount: (mode: KalshiExecutionMode = 'paper') => api.delete<KalshiPaperResponse>('/kalshi/paper/portfolio', { params: { mode }, timeout: 15000 }),
  strategies: (mode: KalshiExecutionMode = 'paper') => api.get<KalshiStrategyLibraryResponse>('/kalshi/strategies', { params: { mode }, timeout: 10000 }),
  saveStrategy: (name: string, config: KalshiBotConfig, mode: KalshiExecutionMode = config.executionMode || 'paper') => api.post<KalshiStrategyLibraryResponse>(
    '/kalshi/strategies',
    { name, mode, config: { ...config, executionMode: mode } },
    { timeout: 15000 },
  ),
  applyStrategy: (strategyId: string, mode: KalshiExecutionMode) => api.post<KalshiStrategyLibraryResponse>(
    '/kalshi/strategies/apply',
    { strategyId, mode },
    { timeout: 15000 },
  ),
  recommendStrategy: (mode: KalshiExecutionMode = 'paper') => api.get<KalshiStrategyLibraryResponse>('/kalshi/strategies/recommend', { params: { mode }, timeout: 10000 }),
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
