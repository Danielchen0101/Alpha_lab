import api from './api';

export type KalshiDecisionAction = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'WAIT';
export type KalshiExecutionMode = 'paper' | 'real';
export type KalshiControlSource = 'kalshi-workspace-toggle' | 'shell-mode-switch' | 'api';

const KALSHI_CONTROL_SESSION_KEY = 'alphalab:kalshi:control-session';

const kalshiControlContext = (source: KalshiControlSource) => {
  let sessionId = '';
  if (typeof window !== 'undefined') {
    try {
      sessionId = window.sessionStorage.getItem(KALSHI_CONTROL_SESSION_KEY) || '';
      if (!sessionId) {
        sessionId = typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(KALSHI_CONTROL_SESSION_KEY, sessionId);
      }
    } catch {
      sessionId = '';
    }
  }
  return {
    source,
    sessionId,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  };
};

// v7 adds the official BRTI stream, normal-CDF calibration, and ladder fitting.
export const KALSHI_CONFIG_STORAGE_KEY = 'alphalab:kalshi:btc15m:config:v7';
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
  minimumRiskBudgetScale: number;
  fullRiskModelProbability: number;
  fullRiskConservativeEdge: number;
  highPriceRiskStart: number;
  highPriceRiskFloor: number;
  maxPortfolioExposurePct: number;
  microPositionMaxLossDollars: number;
  microPositionMaxLossPct: number;
  microPositionMinNetEdge: number;
  microPositionMinConservativeEdge: number;
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
  riskPerTradePct: 0.50,
  minNetEdge: 0.010,
  minConservativeEdge: 0.0075,
  maxSpread: 0.06,
  maxRelativeSpread: 0.20,
  minDepthContracts: 5,
  maxBookParticipation: 0.20,
  minSecondsToClose: 60,
  maxSecondsToClose: 840,
  minPrice: 0.47,
  maxPrice: 0.92,
  minModelProbability: 0.64,
  marketBlendWeight: 0.45,
  maxModelMarketGap: 0.30,
  probabilityLogitScale: 1.70,
  momentumProjectionScale: 0.07,
  basisReserveBps: 3,
  maxVolatilityRatio: 3,
  maxJumpSigma: 5,
  fractionalKelly: 0.15,
  minimumRiskBudgetScale: 0.35,
  fullRiskModelProbability: 0.75,
  fullRiskConservativeEdge: 0.030,
  highPriceRiskStart: 0.75,
  highPriceRiskFloor: 0.50,
  maxPortfolioExposurePct: 10,
  microPositionMaxLossDollars: 1,
  microPositionMaxLossPct: 5,
  microPositionMinNetEdge: 0.020,
  microPositionMinConservativeEdge: 0.010,
  executionPriceTolerance: 0.01,
  exitProbabilityThreshold: 0.35,
  minimumExitProfit: 0.015,
  takeProfitScaleOutPct: 0.50,
  stopLossPct: 0.45,
  emergencyStopLossPct: 0.25,
  maxSingleMarketExposurePct: 2,
  minimumAddIntervalSeconds: 90,
  addMinModelProbability: 0.64,
  addMinConservativeEdge: 0.0075,
  addMinProbabilityImprovement: 0.01,
  addMinEdgeImprovement: 0.001,
  addSizeFraction: 0.25,
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
    isOfficialBrti?: boolean;
    referenceRawPrice?: number | null;
    settlementWindowAverage?: number | null;
    settlementWindowSamples?: number;
    settlementWindowProgress?: number | null;
    referenceVenueCount?: number;
    referenceDispersionBps?: number | null;
    basisReserveBpsApplied?: number | null;
    momentum3m?: number | null;
    momentum5m?: number | null;
    momentum15m?: number | null;
    volatilityRatio?: number | null;
    jumpSigma?: number | null;
    marketYesProbability?: number | null;
    rawMarketYesProbability?: number | null;
    ladderRawProbability?: number | null;
    ladderSmoothedProbability?: number | null;
    ladderDislocation?: number | null;
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
    effectiveMinimumPrice?: number;
    grossEdge?: number | null;
    feePerContract?: number | null;
    netEdge?: number | null;
    conservativeProbability?: number | null;
    conservativeEdge?: number | null;
    minimumNetEdge?: number;
    minimumConservativeEdge?: number;
    recoveryMultiple?: number | null;
    payoffIfWin?: number | null;
    lossIfWrong?: number | null;
  };
  sizing: {
    paperBankroll: number;
    riskPerTradePct: number;
    riskBudget: number;
    hardRiskBudget?: number;
    fullKelly?: number;
    fractionalKelly?: number;
    bookParticipationPct?: number;
    standardRiskBudget?: number;
    microSizingApplied?: boolean;
    microPositionLossCap?: number;
    contracts: number;
    plannedContracts?: number;
    estimatedFee: number;
    maximumLoss: number;
    maxLoss?: number;
    maxLossPct?: number | null;
    expectedValue: number;
  };
  gates: KalshiGate[];
  config: KalshiBotConfig;
  methodology: Record<string, string>;
  dataQuality?: {
    referenceModel?: string;
    officialBrti?: boolean;
    referenceAgeSeconds?: number | null;
    bookAgeSeconds?: number | null;
    snapshotLatencyMs?: number | null;
    settlementWindowSamples?: number | null;
    warnings?: string[];
    candidateCount?: number;
  };
  accountPreflight?: {
    snapshotAt?: string | null;
    snapshotAgeSeconds?: number | null;
    maximumAgeSeconds?: number;
    accountSnapshotPresent?: boolean;
    accountSnapshotFresh?: boolean;
    schedulerHealthy?: boolean;
    schedulerRunning?: boolean;
    schedulerLeaseOwned?: boolean;
    schedulerLastError?: string;
    ready?: boolean;
  };
}

export interface KalshiSnapshot {
  asOf: string;
  latencyMs?: number;
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
    rawPrice?: number | null;
    trailing60sAverage?: number | null;
    settlementWindowAverage?: number | null;
    settlementWindowSamples?: number;
    settlementWindowProgress?: number;
    streamAgeSeconds?: number;
    streamStatus?: string;
  };
  warnings: string[];
  sources: Record<string, string>;
  eventTicker?: string;
  candidateCount?: number;
  candidateSummary?: Array<Record<string, any>>;
  ladderFit?: Record<string, {
    rawProbability: number;
    smoothedProbability: number;
    dislocation: number;
  }>;
}

export interface KalshiFamilyDiagnostics {
  family: 'btc15m' | 'btchourly';
  label: string;
  observations: number;
  uniqueMarkets: number;
  latestAt?: string | null;
  funnel: Record<'observations' | 'dataReady' | 'entryWindow' | 'liquidityReady' | 'positiveNetEdge' | 'positiveConservativeEdge' | 'routable' | 'orders', number>;
  blockers: Array<{ key: string; count: number }>;
  primaryBlocker?: string | { key: string; count?: number; share?: number | null } | null;
  primaryBlockers?: Array<string | { key: string; count?: number; share?: number | null }>;
  referenceSources: Array<{ key: string; count: number }>;
  officialBrtiSamples: number;
  averageSnapshotLatencyMs?: number | null;
  edgeTimeline: Array<{
    at: string;
    ticker: string;
    action: string;
    secondsToClose?: number;
    netEdge?: number | null;
    conservativeEdge?: number | null;
    signalQuality?: number;
  }>;
  nearMisses: Array<Record<string, any>>;
}

export interface KalshiAnalyticsResponse {
  success: boolean;
  environment: KalshiExecutionMode;
  windowHours: number;
  analytics: {
    generatedAt: string;
    families: Record<'btc15m' | 'btchourly', KalshiFamilyDiagnostics>;
  };
  referenceFeed?: {
    status: string;
    fresh: boolean;
    ageSeconds?: number | null;
    lastError?: string;
    source?: string;
  };
}

export interface KalshiEvaluationResponse {
  success: boolean;
  snapshot: KalshiSnapshot;
  decision: KalshiDecision;
  code?: string;
  message?: string;
  robotState?: KalshiPaperRobotState;
  robotRuntime?: Record<string, unknown> | null;
}

export interface KalshiPaperRobotState {
  enabled: boolean;
  activeEnvironment?: KalshiExecutionMode;
  selectedEnvironment?: KalshiExecutionMode;
  modeState?: Partial<Record<KalshiExecutionMode, {
    arming?: {
      armed?: boolean;
      awaitingExplicitEnable?: boolean;
      requestedEnableOnSwitch?: boolean;
      updatedAt?: string;
      reason?: string;
    };
  }>>;
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
  realizedAverageWin?: number | null;
  realizedAverageLoss?: number | null;
  realizedProfitFactor?: number | null;
  realizedRecoveryMultiple?: number | null;
  realizedMaxDrawdown?: number | null;
  equityCurve?: KalshiEquityPoint[];
  lifetime?: {
    realizedSamples?: number;
    realizedTotalPnl?: number;
  };
  displayBaseline?: {
    active: boolean;
    resetAt?: string;
    baselineEquityCents?: number;
    baselineCashCents?: number;
    environment?: KalshiExecutionMode | string;
    ledgerPreserved?: boolean;
    alphaLabOnly?: boolean;
    reason?: string;
    archivedRealizedEvents?: number;
  };
  marketPerformance?: Record<'btc15m' | 'btchourly', {
    family: 'btc15m' | 'btchourly';
    label: string;
    samples: number;
    uniqueMarkets: number;
    settlementEvents: number;
    saleEvents: number;
    wins: number;
    losses: number;
    winRate: number | null;
    realizedPnl: number;
    totalPnl?: number;
    averagePnl: number;
    averageWin?: number | null;
    averageLoss?: number | null;
    profitFactor?: number | null;
    recoveryMultiple?: number | null;
    maxDrawdown?: number | null;
    worstTrade?: number | null;
    records: KalshiSettlementRecord[];
    equityCurve: KalshiEquityPoint[];
  }>;
}

export interface KalshiPaperPortfolio {
  environment: KalshiExecutionMode | string;
  accountProvider?: 'AlphaLab' | 'Kalshi' | string;
  balance: {
    balance?: number;
    portfolio_value?: number;
    equity?: number;
    starting_balance?: number;
    realized_pnl_dollars?: number;
    updated_ts?: number;
  };
  positions: Array<Record<string, any>>;
  orders: Array<Record<string, any>>;
  fills: Array<Record<string, any>>;
  settlements: Array<Record<string, any>>;
  analytics?: KalshiPortfolioAnalytics;
  warnings?: Array<string | Record<string, unknown>>;
  completeness?: {
    complete?: boolean;
    balance?: boolean;
    positions?: boolean;
    orders?: boolean;
    fills?: boolean;
    settlements?: boolean;
    history?: boolean;
    status?: string;
    warnings?: unknown;
    errors?: unknown;
    missing?: unknown;
    missingResources?: unknown;
    missing_resources?: unknown;
  };
  accountActivity?: {
    scope?: string;
    lifetimeCounts?: Record<string, number>;
    visibleCounts?: Record<string, number>;
  };
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
  resetPortfolioDisplay: (mode: KalshiExecutionMode = 'paper') => api.post<KalshiPaperResponse>(
    '/kalshi/portfolio/display-reset',
    { mode },
    { timeout: 20000 },
  ),
  paperRobotStatus: (mode?: KalshiExecutionMode) => api.get<KalshiPaperResponse>('/kalshi/paper/robot', { params: mode ? { mode } : undefined, timeout: 10000 }),
  setPaperRobot: (
    enabled: boolean,
    config: KalshiBotConfig,
    mode: KalshiExecutionMode = config.executionMode || 'paper',
    source: KalshiControlSource = 'api',
  ) => api.post<KalshiPaperResponse>(
    '/kalshi/paper/robot',
    { enabled, mode, config: { ...config, executionMode: mode }, controlContext: kalshiControlContext(source) },
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
  analytics: (mode: KalshiExecutionMode = 'paper', hours = 24) => api.get<KalshiAnalyticsResponse>(
    '/kalshi/analytics',
    { params: { mode, hours }, timeout: 15000 },
  ),
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
