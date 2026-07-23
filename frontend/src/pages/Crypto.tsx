import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Navigate, useLocation } from 'react-router-dom';
import cryptoAPI, { CRYPTO_LEDGER_LIMIT } from '../services/cryptoApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import '../styles/Crypto.css';

type CryptoView = 'command' | 'strategy' | 'automation' | 'ledger' | 'not-found';
type ApiMode = 'paper' | 'live';
type NullableNumber = number | null;
type SignalTone = 'positive' | 'negative' | 'warning' | 'neutral';

interface CryptoPoint {
  time: string | number;
  value: number;
}

interface CryptoAsset {
  symbol: string;
  name: string;
  price: NullableNumber;
  change24h: NullableNumber;
  volume24h: NullableNumber;
  spreadBps: NullableNumber;
  signal: string;
  confidence: NullableNumber;
  regime: string;
  tradable: boolean | null;
  dataAvailable: boolean;
  executionReady: boolean;
  reasons: string[];
  weight: NullableNumber;
  series: CryptoPoint[];
}

interface CryptoPortfolio {
  equity: NullableNumber;
  cryptoEquity: NullableNumber;
  cash: NullableNumber;
  exposurePct: NullableNumber;
  dayPnl: NullableNumber;
  drawdownPct: NullableNumber;
}

interface CryptoAutomation {
  enabled: boolean;
  status: string;
  nextRun: string | null;
  lastRun: string | null;
  intervalMinutes: NullableNumber;
  killSwitch: boolean;
  locked: boolean;
  lastAction: string | null;
}

interface CryptoOrderEvidence {
  id: string;
  status: string;
  side: string;
  quantity: NullableNumber;
  price: NullableNumber;
  notional: NullableNumber;
  createdAt: string | null;
}

interface CryptoGateDetail {
  eligible: boolean | null;
  reasons: string[];
  warnings: string[];
  quoteAgeSeconds: NullableNumber;
  spreadBps: NullableNumber;
  dailyDollarVolume: NullableNumber;
  requiredDailyDollarVolume: NullableNumber;
  askNotional: NullableNumber;
  requiredAskNotional: NullableNumber;
}

interface CryptoCapacityDetail {
  eligible: boolean | null;
  reason: string;
  availableNotional: NullableNumber;
  minimumNotional: NullableNumber;
}

interface CryptoReservationDetail {
  count: NullableNumber;
  buyNotional: NullableNumber;
  sellNotional: NullableNumber;
}

interface CryptoExposureDetail {
  filledCryptoValue: NullableNumber;
  pendingBuyValue: NullableNumber;
  projectedCryptoValue: NullableNumber;
}

interface CryptoDecision {
  action: string;
  symbol: string;
  confidence: NullableNumber;
  reason: string;
  targetWeight: NullableNumber;
  currentWeight: NullableNumber;
  filledWeight: NullableNumber;
  mode: ApiMode | null;
  dryRun: boolean;
  entryGate: CryptoGateDetail | null;
  entryCapacity: CryptoCapacityDetail | null;
  openOrderReservation: CryptoReservationDetail | null;
  persistentRiskGate: { eligible: boolean | null; reasons: string[] } | null;
  portfolioExposure: CryptoExposureDetail | null;
  createdAt: string | null;
  order: CryptoOrderEvidence | null;
}

interface CryptoOverview {
  asOf: string | null;
  source: string;
  mode: ApiMode;
  accountConfigured: boolean | null;
  accountEligible: boolean | null;
  liveAuthorized: boolean;
  accountStatus: string;
  accountError: string;
  eligibilityReasons: string[];
  assets: CryptoAsset[];
  portfolio: CryptoPortfolio;
  automation: CryptoAutomation;
  decision: CryptoDecision | null;
  admission: {
    admitted: boolean;
    status: string;
    reasons: string[];
  };
  equityCurve: CryptoPoint[];
  warnings: string[];
  ai: {
    configured: boolean;
    status: string;
    provider: string;
    model: string;
  };
}

interface CryptoConfig {
  mode: ApiMode;
  symbols: string[];
  strategy: string;
  tradeHorizon: 'short' | 'long';
  intervalMinutes: number;
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  maxPortfolioExposurePct: number;
  maxAssetExposurePct: number;
  riskPerTradePct: number;
  minimumConfidence: number;
  paperLearningEnabled: boolean;
  calibrationEveryCycles: 12 | 24 | 48 | 168;
}

interface CryptoRuntime {
  status: string;
  currentStage: string;
  lastHeartbeat: string | null;
  nextRun: string | null;
  cooldownUntil: string | null;
  manualReviewRequired: boolean;
  runId: string | null;
  progress: NullableNumber;
  message: string;
  schedulerHealthy: boolean | null;
  schedulerStatus: string;
  schedulerMessage: string;
  calibration: {
    status: string;
    lastRun: string | null;
    symbol: string;
    champion: string;
    applied: boolean;
    completedRuns: number;
    method: string;
  };
}

interface StrategyLibraryItem {
  id: string;
  name: string;
  role: 'control' | 'paper_challenger';
  source: { title?: string; url?: string; concept?: string };
}

interface LedgerRecord {
  id: string;
  createdAt: string | null;
  type: string;
  symbol: string;
  action: string;
  status: string;
  mode: string;
  quantity: NullableNumber;
  price: NullableNumber;
  confidence: NullableNumber;
  reason: string;
  source: string;
  actor: string;
  categories: Array<'decision' | 'order' | 'risk' | 'operator'>;
}

interface LedgerScanMetadata {
  scanTruncated: boolean;
  scannedRows: NullableNumber;
  scannedPages: NullableNumber;
}

interface BacktestConstraintField {
  field: string;
  value: unknown;
}

interface BacktestConstraintGap extends BacktestConstraintField {
  reason: string;
}

interface BacktestExecutionConstraints {
  scope: string;
  symbol: string;
  represented: string[];
  applied: BacktestConstraintField[];
  notSimulated: BacktestConstraintGap[];
}

interface BacktestResult {
  status: 'idle' | 'ready';
  from: string | null;
  to: string | null;
  symbols: string[];
  totalReturnPct: NullableNumber;
  benchmarkReturnPct: NullableNumber;
  maxDrawdownPct: NullableNumber;
  sharpe: NullableNumber;
  calmar: NullableNumber;
  trades: NullableNumber;
  winRatePct: NullableNumber;
  turnover: NullableNumber;
  totalCosts: NullableNumber;
  equityCurve: CryptoPoint[];
  notes: string[];
  executionConstraints: BacktestExecutionConstraints;
  limitations: string[];
}

const DEFAULT_CONFIG: CryptoConfig = {
  mode: 'paper',
  symbols: ['BTC/USD', 'ETH/USD'],
  strategy: 'adaptive_trend_allocation',
  tradeHorizon: 'long',
  intervalMinutes: 60,
  riskProfile: 'balanced',
  maxPortfolioExposurePct: 20,
  maxAssetExposurePct: 12,
  riskPerTradePct: 0.35,
  minimumConfidence: 60,
  paperLearningEnabled: false,
  calibrationEveryCycles: 24,
};

const EMPTY_PORTFOLIO: CryptoPortfolio = {
  equity: null,
  cryptoEquity: null,
  cash: null,
  exposurePct: null,
  dayPnl: null,
  drawdownPct: null,
};

const EMPTY_AUTOMATION: CryptoAutomation = {
  enabled: false,
  status: '',
  nextRun: null,
  lastRun: null,
  intervalMinutes: null,
  killSwitch: false,
  locked: false,
  lastAction: null,
};

const EMPTY_LEDGER_SCAN: LedgerScanMetadata = {
  scanTruncated: false,
  scannedRows: null,
  scannedPages: null,
};

const EMPTY_EXECUTION_CONSTRAINTS: BacktestExecutionConstraints = {
  scope: '',
  symbol: '',
  represented: [],
  applied: [],
  notSimulated: [],
};

interface CryptoWorkspaceCacheEntry {
  overview: CryptoOverview | null;
  config: CryptoConfig | null;
  runtime: CryptoRuntime | null;
  ledger: LedgerRecord[];
  ledgerScan: LedgerScanMetadata;
  backtest: BacktestResult | null;
  updatedAt: number;
  loadedAt: Partial<Record<CryptoView, number>>;
}

// Keep the last verified workspace state while React routes are switched.
// This contains no credentials and is deliberately process-local: a full
// browser reload still revalidates everything with the backend.
const cryptoWorkspaceCache: Record<string, CryptoWorkspaceCacheEntry | undefined> = {};

// Test isolation helper. Production cache entries are already isolated by the
// authenticated user id and mode; this only lets component tests start clean.
export const resetCryptoWorkspaceCacheForTests = (): void => {
  Object.keys(cryptoWorkspaceCache).forEach((key) => delete cryptoWorkspaceCache[key]);
};

const COPY = {
  en: {
    desk: 'CRYPTO / 24·7 SPOT DESK',
    commandTitle: 'A continuous market, governed like a research system.',
    commandIntro: 'Monitor liquid crypto markets, evaluate deterministic signals, and route only risk-approved spot orders. AI reviews context; hard limits retain final authority.',
    strategyTitle: 'Evidence before capital.',
    strategyIntro: 'Test the adaptive trend allocation mandate against buy-and-hold after fees and slippage. A profitable historical result is not a promise of future returns.',
    automationTitle: 'Automation with an off switch.',
    automationIntro: 'Define when the 24/7 engine may observe, size, and submit. Live routing stays locked until account eligibility and explicit authorization are verified.',
    ledgerTitle: 'Every decision leaves a record.',
    ledgerIntro: 'A traceable ledger for signals, risk decisions, orders, fills, rejected actions, and operator interventions.',
    paper: 'PAPER', live: 'LIVE', livePending: 'LIVE ELIGIBILITY UNVERIFIED', marketOpen: '24/7 MARKET',
    refreshed: 'Last synchronized', refresh: 'Refresh', runCycle: 'Run decision cycle', running: 'Cycle running', cycleComplete: 'Decision cycle completed', pairsScanned: 'pairs evaluated', aiChecks: 'AI challenges', ordersRouted: 'orders routed',
    backendUnavailable: 'Crypto services are temporarily unavailable.', operationFailed: 'The requested crypto operation failed.', retry: 'Try again', noSnapshot: 'No verified crypto snapshot has been returned yet.',
    staleSnapshot: 'Refresh failed. Values shown are from the last verified snapshot and may be stale.',
    accountDataUnavailable: 'Broker account data is unavailable.', accountNotConfigured: 'No Alpaca Crypto connection is configured for this mode.', accountIneligible: 'This broker account is not eligible for crypto trading.', eligibilityUnknown: 'Crypto trading eligibility could not be verified.', accountStatus: 'Broker account status', eligibilityDetails: 'Eligibility details',
    configUnavailable: 'The saved crypto mandate could not be loaded. Trading controls remain locked to prevent overwriting it.',
    configControlsLocked: 'Saved settings are unavailable. Values shown below are read-only and may be stale.',
    runtimeUnavailable: 'Scheduler status could not be refreshed. The last verified runtime state is shown.',
    ledgerUnavailable: 'The audit ledger could not be refreshed. Retry before relying on the records shown.',
    barsUnavailable: 'Some market history could not be refreshed. Affected sparklines may be incomplete.',
    noSnapshotHint: 'Connect Alpaca Crypto or run a Paper decision cycle. The page will not substitute sample prices for missing market data.',
    paperSafe: 'Paper mode — no real-money order will be submitted.',
    liveGuard: 'Live mode is visible, but execution stays locked until research admission, Alpaca crypto eligibility, and explicit authorization are all verified.',
    admissionLocked: 'Research is not admitted for live trading. Continue in Paper mode until the independent release gate is approved.',
    admissionStatus: 'Research admission', admittedStatus: 'Admitted', paperOnlyStatus: 'Paper only',
    accountEquity: 'Account equity', cryptoEquity: 'Crypto holdings value', exposure: 'Crypto exposure', dayPnl: 'Account 24h P/L', drawdown: 'Drawdown', universe: 'Monitored pairs',
    marketTape: 'Liquid market tape', marketTapeNote: 'Alpaca US crypto spot · continuous session', pair: 'Pair', price: 'Last price', change: '24h move', volume: '24h volume', spread: 'Spread', availability: 'Availability', signal: 'Mandate', confidence: 'Confidence',
    noAssets: 'No validated market rows are available.', dataUnavailable: 'Data unavailable', tradable: 'Tradable', notTradable: 'Not tradable', tradabilityUnknown: 'Tradability unverified',
    portfolioPosture: 'Portfolio posture', allocated: 'Allocated', cashReserve: 'Cash reserve', riskBudget: 'Risk budget',
    latestDecision: 'Latest governed decision', noDecision: 'No decision has been recorded for this account.', targetWeight: 'Target weight', rationale: 'Rationale',
    latestOrder: 'Order evidence', orderStatus: 'Order status', orderId: 'Order ID', orderValue: 'Order value', noOrderRouted: 'No order routed', noOrderRoutedHint: 'This cycle did not submit an order. Check the decision, quote quality, and risk gates before assuming it bought or sold.', viewLedger: 'Open ledger',
    executionCheck: 'Execution check', currentWeight: 'Current weight', filledWeight: 'Filled weight', routeMode: 'Route mode', entryGate: 'Entry gate', capacity: 'Order capacity', openOrder: 'Open order', projectedExposure: 'Projected exposure', routeReady: 'Ready', routeBlocked: 'Blocked', warningsLabel: 'Warnings', noBlockers: 'No blockers', simulatedCycle: 'Paper / dry run', buyCapacity: 'Available buy notional', quoteQuality: 'Quote quality',
    liveEligibility: 'Live eligibility', eligible: 'Verified', unverified: 'Unverified', dataSource: 'Data source',
    cycle: '24/7 decision cycle', observe: 'Observe', score: 'Score', review: 'AI review', gate: 'Risk gate', route: 'Paper / route',
    deterministic: 'Deterministic first', deterministicText: 'Trend, breakout, volatility, liquidity, and drawdown rules create the candidate decision.',
    aiBoundary: 'Bounded AI review', aiBoundaryText: 'AI can challenge context at threshold crossings; it cannot raise position caps or bypass a kill switch.',
    executionBoundary: 'Spot-only execution', executionBoundaryText: 'Reduce and exit only from held inventory. No crypto margin and no short selling are assumed.',
    disclosure: 'Research system, not a profit guarantee', disclosureText: 'Crypto is volatile and can lose substantial value. Validate in Paper mode, include trading costs, and review drawdowns before enabling live routing.',
    strategyMandate: 'Adaptive trend allocation', strategyMandateText: 'A long/flat spot mandate combining multi-horizon trend, breakout confirmation, volatility targeting, and circuit breakers.',
    method: 'METHOD / 01', costModel: 'COST MODEL / 02', validation: 'VALIDATION / 03',
    trendStack: 'Trend stack', trendStackText: 'Fast/slow exponential trend plus multi-window momentum. Signals must agree before exposure can rise.',
    liquidityGate: 'Liquidity gate', liquidityGateText: 'Spread and turnover checks block fragile entries. Position size falls as volatility rises.',
    exitGeometry: 'Bar-close exit threshold', exitGeometryText: 'The ATR-derived exit threshold is evaluated only after a complete bar and can only tighten while a position remains open. A triggered exit signal executes at the next bar open; gaps or service interruptions can produce an exit beyond the threshold.',
    exitRiskTitle: 'No continuously resting broker stop', exitRiskText: 'This threshold is strategy logic, not a stop order continuously resting at the broker and not a maximum-loss guarantee. It is evaluated on a complete bar close and routed for the next bar open; gaps, fast markets, failed routing, or service interruptions may produce a materially worse exit.',
    feeAssumption: 'Taker fee / side', slippageAssumption: 'Slippage / side', roundTrip: 'Modeled round trip', honestCosts: 'Conservative cost assumptions are deducted from every simulated trade.',
    backtestLab: 'Cost-aware backtest bench', backtestLabNote: 'Single historical window · Alpaca bars · no look-ahead · costs included',
    currentCadence: 'Current cadence',
    lookback: 'Lookback', capital: 'Initial capital', fee: 'Fee (bps)', slippage: 'Slippage (bps)', runBacktest: 'Run backtest', backtesting: 'Testing…',
    pairUnderTest: 'Pair under test', totalReturn: 'Strategy return', benchmark: 'Buy & hold', maxDrawdown: 'Max drawdown', sharpe: 'Sharpe', trades: 'Trades', winRate: 'Win rate', turnover: 'Turnover', costs: 'Trading costs',
    releaseGate: 'Research admission', gatePassed: 'Single-window checks passed', gateFailed: 'Not admitted · keep in Paper', gatePassedNote: 'A locked holdout and at least 60 days of Paper execution are still required before live consideration.', gateFailedNote: 'This window does not support a profitability claim. Adjusting parameters to make one chart pass would be overfitting.',
    netPositive: 'Net return > 0%', sharpeGate: 'Sharpe ≥ 0.75', calmarGate: 'Calmar ≥ 0.50', drawdownGate: 'Max drawdown ≤ 20%',
    noBacktest: 'No backtest has been run in this session.', noBacktestHint: 'Run the cost-aware test before considering automation. Results should be reviewed across multiple windows.',
    backtestFailed: 'Backtest could not be completed', backtestRetry: 'Retry backtest',
    backtestIncomplete: 'The backtest returned incomplete data.', backtestIncompleteHint: 'No verified equity curve was returned. Review the available metrics and retry before relying on this result.',
    executionConstraints: 'Execution constraints represented', appliedConstraints: 'Applied in this simulation', notSimulated: 'Disclosed but not simulated', limitations: 'Simulation limitations', constraintMetadataMissing: 'No constraint metadata was returned. Do not assume live broker behavior was simulated.',
    validationRules: 'Acceptance rules', v1: 'Positive out-of-sample expectancy after costs', v2: 'Drawdown remains inside the configured circuit breaker', v3: 'Beats or materially de-risks the buy-and-hold benchmark', v4: 'Performance is not concentrated in one short window',
    researchWarning: 'Historical performance can fail without warning. The platform does not label a strategy “profitable” from in-sample return alone.',
    operatingMandate: 'Operating mandate', operatingNote: 'Changes persist to the account after Save.', save: 'Save mandate', saving: 'Saving…', saved: 'Mandate saved.',
    assets: 'Trading universe', tradeHorizon: 'Trading horizon', shortTerm: 'Short-term', shortTermHint: '15m quick trading', longTerm: 'Long-term', longTermHint: '1h+ steady allocation', interval: 'Decision interval', riskProfile: 'Risk profile', conservative: 'Conservative', balanced: 'Balanced', aggressive: 'Aggressive',
    maxPortfolio: 'Max crypto exposure', maxAsset: 'Max per pair', riskPerTrade: 'Risk per new trade', minConfidence: 'Minimum decision confidence', aiReview: 'AI counter-review', aiReviewHint: 'Constrained review runs only when a configured provider is available; deterministic gates remain final.',
    scheduler: '24/7 scheduler', schedulerNote: 'One account-scoped cycle at a time. Settings survive page changes and service restarts.',
    start: 'Start Paper automation', startLive: 'Start Live automation', stop: 'Pause automation', starting: 'Starting…', stopping: 'Pausing…',
    status: 'Status', currentStage: 'Current stage', heartbeat: 'Heartbeat', nextRun: 'Next eligible run', lastRun: 'Last completed', progress: 'Progress', schedulerHealth: 'Scheduler health', runId: 'Run ID',
    idle: 'Idle', noRuntime: 'No verified scheduler details are available.', runtimeUnknown: 'Runtime unavailable', cooldownUntil: 'Cooldown until', manualReview: 'Manual review required', manualReviewText: 'A drawdown circuit breaker requires an explicit operator review before automation can restart.',
    schedulerUnhealthy: 'Crypto scheduler is unhealthy', schedulerUnhealthyText: 'Automated starts are locked until scheduler health is restored. A manually initiated decision cycle remains available when all trading safety gates pass.',
    reviewRestart: 'Review restart', riskRestartConfirm: 'Acknowledge drawdown risk and restart?', riskRestartConfirmText: 'Confirm that the drawdown and current positions were reviewed. This clears the manual-review lock only; all other risk gates remain active.', acknowledgeRestart: 'Acknowledge and restart',
    killSwitch: 'Global crypto kill switch', killDescription: 'Immediately stop new crypto decisions and order routing. Existing broker orders and positions still require review.',
    engageKill: 'Engage kill switch', releaseKill: 'Release kill switch', confirmKill: 'Confirm emergency stop?', confirmKillText: 'This pauses the scheduler and blocks all new crypto orders for this account.', cancel: 'Cancel', confirm: 'Stop all new activity',
    liveLocked: 'Live start locked', liveLockedText: 'Alpaca crypto trading eligibility has not been verified. Use Paper mode or resolve the account connection first.',
    liveAuthorizationRequired: 'Explicit authorization required', liveAuthorizationText: 'The broker account is eligible, but unattended real-money crypto orders have not been authorized.', authorizeLive: 'Review live authorization', authorizeConfirm: 'Authorize unattended live crypto orders?', authorizeConfirmText: 'This permits the governed 24/7 engine to submit eligible real-money spot orders. Exposure caps, stale-data checks, circuit breakers, and the kill switch remain final.', authorize: 'Authorize live routing', authorizing: 'Authorizing…', authorized: 'Authorized',
    controls: 'Non-negotiable controls', c1: 'No margin or short exposure', c2: 'Per-asset and portfolio exposure caps', c3: 'Stale-data and wide-spread rejection', c4: 'Daily/account drawdown circuit breaker', c5: 'Idempotent orders and one active cycle', c6: 'Operator kill switch and audit trail',
    auditLedger: 'Decision and order ledger', records: 'records', all: 'All', decisions: 'Decisions', orders: 'Orders', risk: 'Risk', operator: 'Operator',
    time: 'Time', event: 'Event', action: 'Action', mode: 'Mode', qtyPrice: 'Quantity / price', result: 'Result', source: 'Source', details: 'Details',
    noLedger: 'No crypto audit records have been returned.', noLedgerHint: 'Signals, blocked actions, Paper orders, live orders, and operator interventions will appear here.',
    ledgerLimit: 'At most the 100 most recent records are loaded; this view does not currently paginate older records. Filters and export apply to the loaded records only.', ledgerScan: 'Source scan', ledgerRows: 'rows', ledgerPages: 'pages', ledgerTruncated: 'This ledger is incomplete because the source scan reached its safety limit. Older matching records may be omitted.', loaded: 'loaded', shown: 'shown',
    export: 'Export visible JSON', filterPlaceholder: 'Search symbol, action, or reason', technicalRecord: 'Technical record',
    accountMetrics: 'Crypto account metrics', marketHistory: 'Seven-day price history', fifteenMinutes: '15 minutes', oneHour: '1 hour', twoHours: '2 hours', fourHours: '4 hours',
    switchOn: 'Learning active', switchReady: 'Not active', aiConnected: 'Settings AI connected', aiNotConfigured: 'Configure an AI provider in Settings', paperLearning: 'Long-horizon Paper research', paperLearningHint: 'Runs inside the 24/7 Paper scheduler. Reproducible challengers derived from published trend, liquid-crypto momentum, volatility-scaling, and cost-aware research are compared across three independent 60-day walk-forward windows after fees and slippage. Only a robust improvement may update Paper; downloaded code and Live settings are never changed.', shortLearningPaused: 'Long-horizon learning is paused in 15-minute mode. The 15-minute decision engine still runs every cycle; switch to long-term mode for walk-forward research promotion.', researchLibrary: 'Published research library', calibrationCadence: 'Research cadence', runCalibration: 'Run research now', calibrating: 'Researching…', calibrationApplied: 'Paper challenger promoted', calibrationHeld: 'Current Paper mandate retained', calibrationRuns: 'completed research runs', cycles: 'cycles',
    quoteWaiting: 'Quote waiting', sourceUnknown: 'Awaiting verified source', unknown: 'Unknown', notAvailable: 'Not available', serviceMessage: 'Service message', serviceField: 'Service field',
  },
  zh: {
    desk: 'CRYPTO / 24·7 现货交易台',
    commandTitle: '连续市场，也要像研究系统一样受约束。',
    commandIntro: '监控高流动性虚拟币市场、评估确定性信号，并只发送通过风控的现货订单。AI 负责复核语境，硬性限制拥有最终决定权。',
    strategyTitle: '先有证据，再投入资金。',
    strategyIntro: '在扣除手续费和滑点后，将自适应趋势配置与买入持有基准比较。历史盈利不代表未来收益。',
    automationTitle: '自动化，也必须有总开关。',
    automationIntro: '定义 24/7 引擎何时可以观察、计算仓位和提交订单。只有账户资格和明确授权验证后，实盘路由才会解锁。',
    ledgerTitle: '每一个决定都留下记录。',
    ledgerIntro: '追踪信号、风控决定、订单、成交、拒绝操作和人工干预的完整账本。',
    paper: '模拟', live: '实盘', livePending: '实盘资格未验证', marketOpen: '24/7 市场',
    refreshed: '最后同步', refresh: '刷新', runCycle: '运行决策周期', running: '正在运行', cycleComplete: '决策周期已完成', pairsScanned: '个交易对已评估', aiChecks: '次 AI 复核', ordersRouted: '笔订单已路由',
    backendUnavailable: '虚拟币服务暂时不可用。', operationFailed: '请求的虚拟币操作失败。', retry: '重试', noSnapshot: '尚未返回经过验证的虚拟币快照。',
    staleSnapshot: '刷新失败。当前显示的是上一次验证快照，数据可能已过期。',
    accountDataUnavailable: '无法获取券商账户数据。', accountNotConfigured: '当前模式尚未配置 Alpaca 虚拟币连接。', accountIneligible: '该券商账户不具备虚拟币交易资格。', eligibilityUnknown: '无法验证虚拟币交易资格。', accountStatus: '券商账户状态', eligibilityDetails: '资格详情',
    configUnavailable: '无法加载已保存的虚拟币运行规则。为避免覆盖现有设置，交易控制已锁定。',
    configControlsLocked: '无法获取已保存设置。下方数值仅供查看，可能已过期。',
    runtimeUnavailable: '无法刷新调度器状态，当前显示上一次已验证的运行状态。',
    ledgerUnavailable: '无法刷新审计账本。在依赖当前记录前请重试。',
    barsUnavailable: '部分历史行情无法刷新，相关趋势线可能不完整。',
    noSnapshotHint: '请连接 Alpaca Crypto 或运行一次模拟决策周期。市场数据缺失时，本页不会用示例价格代替。',
    paperSafe: '模拟模式——不会提交真实资金订单。',
    liveGuard: '当前显示实盘模式，但只有研究准入、Alpaca 虚拟币资格和明确实盘授权全部验证后，执行才会解锁。',
    admissionLocked: '该策略尚未通过实盘研究准入。请继续模拟运行，直到独立发布门批准。',
    admissionStatus: '研究准入', admittedStatus: '已准入', paperOnlyStatus: '仅限模拟',
    accountEquity: '账户权益', cryptoEquity: '虚拟币持仓市值', exposure: '虚拟币敞口', dayPnl: '账户24小时盈亏', drawdown: '回撤', universe: '监控交易对',
    marketTape: '高流动性市场行情', marketTapeNote: 'Alpaca 美国虚拟币现货 · 连续交易', pair: '交易对', price: '最新价', change: '24小时变化', volume: '24小时成交额', spread: '点差', availability: '可用性', signal: '策略决定', confidence: '置信度',
    noAssets: '暂无经过验证的市场数据。', dataUnavailable: '数据不可用', tradable: '可交易', notTradable: '不可交易', tradabilityUnknown: '交易资格未验证',
    portfolioPosture: '组合状态', allocated: '已配置', cashReserve: '现金储备', riskBudget: '风险预算',
    latestDecision: '最新受控决策', noDecision: '该账户尚未记录虚拟币决策。', targetWeight: '目标权重', rationale: '依据',
    latestOrder: '订单证据', orderStatus: '订单状态', orderId: '订单 ID', orderValue: '订单金额', noOrderRouted: '未路由订单', noOrderRoutedHint: '本周期没有提交订单。请结合决策、报价质量和风控门槛判断，不要默认它已经买入或卖出。', viewLedger: '查看账本',
    executionCheck: '执行检查', currentWeight: '当前权重', filledWeight: '已成交权重', routeMode: '路由模式', entryGate: '入场门槛', capacity: '下单额度', openOrder: '挂单占用', projectedExposure: '预计敞口', routeReady: '可路由', routeBlocked: '已阻断', warningsLabel: '警告', noBlockers: '无阻断', simulatedCycle: '模拟 / 干跑', buyCapacity: '可用买入金额', quoteQuality: '报价质量',
    liveEligibility: '实盘资格', eligible: '已验证', unverified: '未验证', dataSource: '数据源',
    cycle: '24/7 决策周期', observe: '观察', score: '评分', review: 'AI 复核', gate: '风控门槛', route: '模拟 / 路由',
    deterministic: '确定性规则优先', deterministicText: '趋势、突破、波动率、流动性与回撤规则先形成候选决策。',
    aiBoundary: '受约束的 AI 复核', aiBoundaryText: 'AI 可在临界事件中提出反证，但不能提高仓位上限或绕过总开关。',
    executionBoundary: '仅限现货', executionBoundaryText: '卖出只用于减持或退出已有仓位；系统不假设虚拟币融资或做空。',
    disclosure: '这是研究系统，不是盈利承诺', disclosureText: '虚拟币波动剧烈，可能产生重大损失。开启实盘前应先在模拟模式验证，并检查成本和回撤。',
    strategyMandate: '自适应趋势配置', strategyMandateText: '结合多周期趋势、突破确认、波动率目标和熔断机制的做多/空仓现货策略。',
    method: '方法 / 01', costModel: '成本模型 / 02', validation: '验证 / 03',
    trendStack: '趋势组合', trendStackText: '快慢指数趋势与多窗口动量必须一致，才允许增加敞口。',
    liquidityGate: '流动性门槛', liquidityGateText: '点差和成交额检查会阻止脆弱入场；波动率越高，仓位越低。',
    exitGeometry: 'K 线收盘退出阈值', exitGeometryText: 'ATR 派生的退出阈值只在完整 K 线收盘后评估；持仓期间阈值只能收紧。触发的退出信号在下一根 K 线开盘执行，跳空或服务中断可能使实际退出价越过阈值。',
    exitRiskTitle: '券商端没有持续挂单止损', exitRiskText: '该阈值属于策略逻辑，不是持续挂在券商端的止损单，也不构成最大亏损保证。系统仅在完整 K 线收盘时评估，并在下一根 K 线开盘执行；跳空、快速行情、路由失败或服务中断都可能导致实际退出价格明显差于阈值。',
    feeAssumption: '单边吃单费', slippageAssumption: '单边滑点', roundTrip: '估算往返成本', honestCosts: '每笔模拟交易都会扣除保守成本假设。',
    backtestLab: '含成本回测台', backtestLabNote: '单一历史窗口 · Alpaca K 线 · 无前视 · 包含成本',
    currentCadence: '当前节奏',
    lookback: '回看周期', capital: '初始资金', fee: '手续费（基点）', slippage: '滑点（基点）', runBacktest: '运行回测', backtesting: '测试中…',
    pairUnderTest: '测试交易对', totalReturn: '策略收益', benchmark: '买入持有', maxDrawdown: '最大回撤', sharpe: '夏普比率', trades: '交易次数', winRate: '胜率', turnover: '换手率', costs: '交易成本',
    releaseGate: '研究准入', gatePassed: '单窗口检查通过', gateFailed: '未准入 · 继续模拟验证', gatePassedNote: '进入实盘考虑前，仍需通过锁定保留集，并完成至少 60 天模拟运行。', gateFailedNote: '该窗口不支持“可盈利”结论。为让单一曲线通过而调参会造成过拟合。',
    netPositive: '净收益 > 0%', sharpeGate: '夏普 ≥ 0.75', calmarGate: '卡玛 ≥ 0.50', drawdownGate: '最大回撤 ≤ 20%',
    noBacktest: '本次会话尚未运行回测。', noBacktestHint: '考虑自动化之前先进行含成本测试，并检查多个时间窗口。',
    backtestFailed: '回测未能完成', backtestRetry: '重新运行回测',
    backtestIncomplete: '回测返回的数据不完整。', backtestIncompleteHint: '未返回经过验证的权益曲线。请检查现有指标并重试，不要依赖该结果。',
    executionConstraints: '已纳入的执行约束', appliedConstraints: '本次模拟实际应用', notSimulated: '已披露但未模拟', limitations: '模拟限制', constraintMetadataMissing: '未返回约束元数据。不得据此假设已模拟实盘券商行为。',
    validationRules: '验收规则', v1: '扣除成本后，样本外期望仍为正', v2: '回撤保持在设定熔断线以内', v3: '超过买入持有基准，或显著降低其风险', v4: '表现不能只集中在一个短窗口',
    researchWarning: '历史表现可能随时失效。平台不会仅根据样本内收益把策略标记为“可盈利”。',
    operatingMandate: '运行规则', operatingNote: '保存后将持久化到当前账户。', save: '保存规则', saving: '保存中…', saved: '规则已保存。',
    assets: '交易范围', tradeHorizon: '交易节奏', shortTerm: '短期快速', shortTermHint: '15分钟快进快出', longTerm: '长期稳健', longTermHint: '1小时以上稳健配置', interval: '决策间隔', riskProfile: '风险档位', conservative: '保守', balanced: '平衡', aggressive: '进取',
    maxPortfolio: '虚拟币最大敞口', maxAsset: '单一交易对上限', riskPerTrade: '每笔新交易风险', minConfidence: '最低决策置信度', aiReview: 'AI 反向复核', aiReviewHint: '仅在已配置模型服务时进行受约束复核；确定性风控仍拥有最终权力。',
    scheduler: '24/7 调度器', schedulerNote: '同一账户一次只运行一个周期；设置在切换页面或服务重启后仍会保留。',
    start: '启动模拟自动化', startLive: '启动实盘自动化', stop: '暂停自动化', starting: '启动中…', stopping: '暂停中…',
    status: '状态', currentStage: '当前阶段', heartbeat: '心跳', nextRun: '下次可运行', lastRun: '上次完成', progress: '进度', schedulerHealth: '调度器健康状态', runId: '运行 ID',
    idle: '空闲', noRuntime: '暂无经过验证的调度器详情。', runtimeUnknown: '运行状态不可用', cooldownUntil: '冷却至', manualReview: '需要人工复核', manualReviewText: '回撤熔断已触发；重新启动自动化前必须由操作员明确复核。',
    schedulerUnhealthy: '虚拟币调度器状态异常', schedulerUnhealthyText: '调度器恢复健康前无法启动自动化；若所有交易安全门槛均通过，仍可手动运行单次决策周期。',
    reviewRestart: '复核后重启', riskRestartConfirm: '确认已复核回撤风险并重新启动？', riskRestartConfirmText: '请确认已检查回撤和当前持仓。此操作只解除人工复核锁，其他风控门槛仍然有效。', acknowledgeRestart: '确认风险并重启',
    killSwitch: '虚拟币全局总开关', killDescription: '立即停止新的虚拟币决策和订单路由。已有券商订单及持仓仍需人工检查。',
    engageKill: '启动总开关', releaseKill: '解除总开关', confirmKill: '确认紧急停止？', confirmKillText: '这将暂停调度器，并阻止该账户产生任何新的虚拟币订单。', cancel: '取消', confirm: '停止所有新活动',
    liveLocked: '实盘启动已锁定', liveLockedText: '尚未验证 Alpaca 虚拟币交易资格。请先使用模拟模式，或修复账户连接。',
    liveAuthorizationRequired: '需要明确授权', liveAuthorizationText: '券商账户已有交易资格，但尚未授权无人值守的真实资金虚拟币订单。', authorizeLive: '查看实盘授权', authorizeConfirm: '授权无人值守的虚拟币实盘订单？', authorizeConfirmText: '这将允许受约束的 24/7 引擎提交符合条件的真实资金现货订单。敞口上限、数据时效检查、熔断和总开关仍拥有最终权力。', authorize: '授权实盘路由', authorizing: '正在授权…', authorized: '已授权',
    controls: '不可绕过的控制', c1: '禁止融资和做空敞口', c2: '单币种和组合敞口上限', c3: '拒绝过期数据和过宽点差', c4: '账户回撤熔断', c5: '幂等订单且一次只运行一个周期', c6: '人工总开关与完整审计',
    auditLedger: '决策与订单账本', records: '条记录', all: '全部', decisions: '决策', orders: '订单', risk: '风控', operator: '人工',
    time: '时间', event: '事件', action: '操作', mode: '模式', qtyPrice: '数量 / 价格', result: '结果', source: '来源', details: '详情',
    noLedger: '尚未返回虚拟币审计记录。', noLedgerHint: '信号、被阻止操作、模拟订单、实盘订单与人工干预都会显示在这里。',
    ledgerLimit: '本页最多加载最近 100 条记录，当前不提供更早记录的分页。筛选和导出仅针对已加载记录。', ledgerScan: '源数据扫描', ledgerRows: '行', ledgerPages: '页', ledgerTruncated: '此账本不完整：源数据扫描已达到安全上限，可能遗漏更早的匹配记录。', loaded: '已加载', shown: '当前显示',
    export: '导出当前 JSON', filterPlaceholder: '搜索交易对、操作或原因', technicalRecord: '技术记录',
    accountMetrics: '虚拟币账户指标', marketHistory: '七日价格走势', fifteenMinutes: '15 分钟', oneHour: '1 小时', twoHours: '2 小时', fourHours: '4 小时',
    switchOn: '学习已运行', switchReady: '尚未运行', aiConnected: '已连接设置中的 AI', aiNotConfigured: '请先在设置中配置 AI 服务', paperLearning: '长期模拟策略研究', paperLearningHint: '融入 24/7 模拟调度。系统会把公开研究中的多周期趋势、高流动性虚拟币动量、波动率调仓和成本过滤转成受限且可复现的候选，并在扣除手续费和滑点后，用 3 个相互独立的 60 天滚动窗口比较。只有稳健提升才会更新模拟策略；不会下载并执行网上代码，也绝不会自动修改实盘。', shortLearningPaused: '15 分钟短线模式会暂停长期策略晋级研究；15 分钟决策引擎仍会按周期运行。切回长期模式后，才会启用滚动窗口研究和策略晋级。', researchLibrary: '公开研究策略库', calibrationCadence: '研究频率', runCalibration: '立即运行研究', calibrating: '研究中…', calibrationApplied: '已提升模拟候选策略', calibrationHeld: '保留当前模拟策略', calibrationRuns: '次长期研究已完成', cycles: '个周期',
    quoteWaiting: '等待最新报价', sourceUnknown: '等待验证数据源', unknown: '未知', notAvailable: '不可用', serviceMessage: '服务消息', serviceField: '服务字段',
  },
} as const;

const numberOrNull = (value: unknown): NullableNumber => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanOrNull = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const percentValue = (value: unknown, fallback: number): number => {
  const parsed = numberOrNull(value);
  if (parsed === null) return fallback;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
};

const percentOrNull = (value: unknown): NullableNumber => {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
};

const asRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
);

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const normalizeTextList = (value: unknown): string[] => (Array.isArray(value) ? value : value ? [value] : [])
  .map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
    const row = asRecord(item);
    return String(row.message ?? row.label ?? row.reason ?? row.code ?? '').trim();
  })
  .filter(Boolean);

const normalizeConstraintFields = (value: unknown): BacktestConstraintField[] => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const row = asRecord(item);
      const field = String(row.field ?? row.key ?? row.code ?? '').trim();
      return field ? { field, value: row.value ?? row.appliedValue ?? row.detail ?? null } : null;
    }).filter(Boolean) as BacktestConstraintField[];
  }
  const record = asRecord(value);
  return Object.entries(record).map(([field, fieldValue]) => ({ field, value: fieldValue }));
};

const normalizeExecutionConstraints = (value: unknown): BacktestExecutionConstraints => {
  if (!value) return { ...EMPTY_EXECUTION_CONSTRAINTS };
  if (Array.isArray(value) || typeof value !== 'object') {
    return { ...EMPTY_EXECUTION_CONSTRAINTS, represented: normalizeTextList(value) };
  }
  const record = asRecord(value);
  const structured = ['scope', 'symbol', 'represented', 'applied', 'notSimulated', 'not_simulated']
    .some((field) => Object.prototype.hasOwnProperty.call(record, field));
  const notSimulated = asArray(record.notSimulated ?? record.not_simulated).map((item) => {
    const row = asRecord(item);
    const field = String(row.field ?? row.key ?? row.code ?? '').trim();
    if (!field) return null;
    return {
      field,
      value: row.value ?? null,
      reason: String(row.reason ?? row.message ?? row.description ?? '').trim(),
    };
  }).filter(Boolean) as BacktestConstraintGap[];
  return {
    scope: String(record.scope ?? '').trim(),
    symbol: String(record.symbol ?? '').trim(),
    represented: normalizeTextList(record.represented),
    applied: normalizeConstraintFields(structured ? record.applied : record),
    notSimulated,
  };
};

const unwrapResponse = (response: any): Record<string, any> => {
  const body = asRecord(response?.data);
  return asRecord(body.data && typeof body.data === 'object' ? body.data : body);
};

const normalizePoints = (value: unknown): CryptoPoint[] => asArray(value)
  .map((item, index) => {
    const row = asRecord(item);
    const pointValue = numberOrNull(row.value ?? row.equity ?? row.price ?? row.close ?? row.c ?? row.y);
    if (pointValue === null) return null;
    return {
      time: row.time ?? row.timestamp ?? row.t ?? row.date ?? index,
      value: pointValue,
    };
  })
  .filter(Boolean) as CryptoPoint[];

const normalizeGateDetail = (value: unknown): CryptoGateDetail | null => {
  const row = asRecord(value);
  if (!Object.keys(row).length) return null;
  return {
    eligible: booleanOrNull(row.eligible),
    reasons: normalizeTextList(row.reasons),
    warnings: normalizeTextList(row.warnings),
    quoteAgeSeconds: numberOrNull(row.quoteAgeSeconds ?? row.quote_age_seconds),
    spreadBps: numberOrNull(row.spreadBps ?? row.spread_bps),
    dailyDollarVolume: numberOrNull(row.dailyDollarVolume ?? row.daily_dollar_volume),
    requiredDailyDollarVolume: numberOrNull(row.requiredDailyDollarVolume ?? row.required_daily_dollar_volume),
    askNotional: numberOrNull(row.askNotional ?? row.ask_notional),
    requiredAskNotional: numberOrNull(row.requiredAskNotional ?? row.required_ask_notional),
  };
};

const normalizeCapacityDetail = (value: unknown): CryptoCapacityDetail | null => {
  const row = asRecord(value);
  if (!Object.keys(row).length) return null;
  return {
    eligible: booleanOrNull(row.eligible),
    reason: String(row.reason ?? ''),
    availableNotional: numberOrNull(row.availableNotional ?? row.available_notional),
    minimumNotional: numberOrNull(row.minimumNotional ?? row.minimum_notional),
  };
};

const normalizeReservationDetail = (value: unknown): CryptoReservationDetail | null => {
  const row = asRecord(value);
  if (!Object.keys(row).length) return null;
  return {
    count: numberOrNull(row.count),
    buyNotional: numberOrNull(row.buyNotional ?? row.buy_notional),
    sellNotional: numberOrNull(row.sellNotional ?? row.sell_notional),
  };
};

const normalizeExposureDetail = (value: unknown): CryptoExposureDetail | null => {
  const row = asRecord(value);
  if (!Object.keys(row).length) return null;
  return {
    filledCryptoValue: numberOrNull(row.filledCryptoValue ?? row.filled_crypto_value),
    pendingBuyValue: numberOrNull(row.pendingBuyValue ?? row.pending_buy_value),
    projectedCryptoValue: numberOrNull(row.projectedCryptoValue ?? row.projected_crypto_value),
  };
};

const normalizeAsset = (value: unknown): CryptoAsset | null => {
  const row = asRecord(value);
  const signal = asRecord(row.signalDetail ?? row.signal);
  const symbol = String(row.symbol ?? row.pair ?? '').trim().toUpperCase();
  if (!symbol) return null;
  const price = numberOrNull(row.price ?? row.lastPrice ?? row.last ?? row.close);
  const explicitDataAvailable = booleanOrNull(row.dataAvailable ?? row.marketDataAvailable ?? row.hasMarketData);
  // Availability is an explicit backend contract. A positive-looking price
  // alone must never turn a partial or legacy payload into verified market
  // data in the trading UI.
  const dataAvailable = price !== null && price > 0 && explicitDataAvailable === true;
  const brokerTradable = booleanOrNull(row.tradable ?? row.isTradable);
  const executionReady = booleanOrNull(row.executionReady ?? row.quoteReady) === true;
  return {
    symbol,
    name: String(row.name ?? row.assetName ?? symbol.split('/')[0]),
    price: dataAvailable ? price : null,
    change24h: dataAvailable ? numberOrNull(row.change24h ?? row.change24hPct ?? row.change_pct ?? row.dailyChangePct) : null,
    volume24h: dataAvailable ? numberOrNull(row.volume24h ?? row.notionalVolume24h ?? row.volume ?? row.dailyVolume) : null,
    spreadBps: dataAvailable ? numberOrNull(row.spreadBps ?? row.spread_bps) : null,
    signal: String(signal.action ?? row.action ?? row.decision ?? (typeof row.signal === 'string' ? row.signal : '')).toUpperCase(),
    confidence: numberOrNull(signal.confidence ?? signal.score ?? row.confidence ?? row.score),
    regime: String(signal.regime ?? row.regime ?? row.trend ?? ''),
    tradable: dataAvailable ? brokerTradable : false,
    dataAvailable,
    executionReady,
    reasons: normalizeTextList(row.reasons ?? row.dataReasons ?? row.unavailableReasons ?? row.availabilityReasons ?? signal.reasons),
    weight: (() => {
      const rawWeight = numberOrNull(signal.targetWeight ?? row.weight ?? row.currentWeight ?? row.allocationPct);
      return rawWeight === null ? null : percentValue(rawWeight, 0);
    })(),
    series: normalizePoints(row.series ?? row.prices ?? row.history ?? row.sparkline),
  };
};

export const normalizeOverview = (response: any, requestedMode: ApiMode): CryptoOverview => {
  const data = unwrapResponse(response);
  const savedConfig = asRecord(data.config);
  const account = asRecord(data.account ?? data.eligibility);
  const portfolio = asRecord(data.portfolio ?? data.accountSummary);
  const risk = asRecord(data.risk);
  const automation = asRecord(data.automation ?? data.scheduler);
  const admission = asRecord(data.liveAdmission);
  const ai = asRecord(data.ai);
  const decisionRow = asRecord(data.decision ?? data.latestDecision);
  const orderRow = asRecord(decisionRow.order ?? decisionRow.orderResult ?? decisionRow.routedOrder);
  const rawAssets = data.assets ?? data.market ?? data.snapshots ?? data.universe;
  const assets = asArray(rawAssets).map(normalizeAsset).filter(Boolean) as CryptoAsset[];
  const positionValue = asArray(data.positions).reduce((sum, position) => {
    const row = asRecord(position);
    return sum + (numberOrNull(row.marketValue ?? row.market_value ?? row.notional) ?? 0);
  }, 0);
  const orderEvidence = Object.keys(orderRow).length ? {
    id: String(orderRow.id ?? orderRow.orderId ?? orderRow.clientOrderId ?? orderRow.client_order_id ?? ''),
    status: String(orderRow.status ?? orderRow.state ?? ''),
    side: String(orderRow.side ?? orderRow.action ?? decisionRow.action ?? '').toUpperCase(),
    quantity: numberOrNull(orderRow.qty ?? orderRow.quantity ?? orderRow.filledQty ?? orderRow.filled_qty),
    price: numberOrNull(orderRow.limitPrice ?? orderRow.limit_price ?? orderRow.filledAvgPrice ?? orderRow.filled_avg_price ?? orderRow.price),
    notional: numberOrNull(orderRow.notional ?? orderRow.orderValue ?? orderRow.value),
    createdAt: orderRow.createdAt ?? orderRow.created_at ?? orderRow.submittedAt ?? orderRow.submitted_at ?? decisionRow.createdAt ?? decisionRow.timestamp ?? null,
  } : null;
  const decision = Object.keys(decisionRow).length ? {
    action: String(decisionRow.action ?? decisionRow.signal ?? '').toUpperCase(),
    symbol: String(decisionRow.symbol ?? decisionRow.pair ?? ''),
    confidence: numberOrNull(decisionRow.confidence ?? decisionRow.score),
    reason: String(decisionRow.reason ?? decisionRow.rationale ?? decisionRow.summary ?? ''),
    targetWeight: (() => {
      const rawWeight = numberOrNull(decisionRow.targetWeight ?? decisionRow.targetWeightPct ?? decisionRow.weight);
      return rawWeight === null ? null : percentValue(rawWeight, 0);
    })(),
    currentWeight: (() => {
      const rawWeight = numberOrNull(decisionRow.currentWeight ?? decisionRow.currentWeightPct ?? decisionRow.current_weight);
      return rawWeight === null ? null : percentValue(rawWeight, 0);
    })(),
    filledWeight: (() => {
      const rawWeight = numberOrNull(decisionRow.filledWeight ?? decisionRow.filledWeightPct ?? decisionRow.filled_weight);
      return rawWeight === null ? null : percentValue(rawWeight, 0);
    })(),
    mode: decisionRow.mode === 'live' || decisionRow.mode === 'paper' ? decisionRow.mode : null,
    dryRun: decisionRow.dryRun === true || decisionRow.dry_run === true,
    entryGate: normalizeGateDetail(decisionRow.entryGate ?? decisionRow.entry_gate),
    entryCapacity: normalizeCapacityDetail(decisionRow.entryCapacity ?? decisionRow.entry_capacity),
    openOrderReservation: normalizeReservationDetail(decisionRow.openOrderReservation ?? decisionRow.open_order_reservation),
    persistentRiskGate: (() => {
      const gate = asRecord(decisionRow.persistentRiskGate ?? decisionRow.persistent_risk_gate);
      if (!Object.keys(gate).length) return null;
      return { eligible: booleanOrNull(gate.eligible), reasons: normalizeTextList(gate.reasons) };
    })(),
    portfolioExposure: normalizeExposureDetail(decisionRow.portfolioExposure ?? decisionRow.portfolio_exposure),
    createdAt: decisionRow.createdAt ?? decisionRow.timestamp ?? null,
    order: orderEvidence,
  } : null;
  const warnings = asArray(data.warnings).map(String).filter(Boolean);
  const accountError = String(data.accountError ?? account.error ?? '').trim();
  const hasVerifiedAccountData = !accountError;
  return {
    asOf: data.asOf ?? data.generatedAt ?? data.updatedAt ?? data.timestamp ?? null,
    source: String(data.source ?? data.dataSource ?? data.provider ?? ''),
    mode: data.mode === 'live' ? 'live' : requestedMode,
    accountConfigured: booleanOrNull(data.accountConfigured ?? account.configured),
    accountEligible: booleanOrNull(data.accountEligible ?? data.cryptoTradingEligible ?? account.cryptoTradingEligible ?? account.eligible),
    liveAuthorized: savedConfig.liveAuthorized === true,
    accountStatus: String(data.accountStatus ?? account.cryptoStatus ?? account.status ?? ''),
    accountError,
    eligibilityReasons: asArray(data.eligibilityReasons ?? account.eligibilityReasons ?? account.reasons)
      .map(String)
      .filter(Boolean),
    assets,
    portfolio: {
      equity: hasVerifiedAccountData ? numberOrNull(portfolio.equity ?? portfolio.accountEquity ?? account.equity) : null,
      cryptoEquity: hasVerifiedAccountData
        ? numberOrNull(portfolio.cryptoEquity ?? portfolio.cryptoValue ?? portfolio.marketValue) ?? (positionValue > 0 ? positionValue : null)
        : null,
      cash: hasVerifiedAccountData ? numberOrNull(portfolio.cash ?? portfolio.buyingPower ?? account.nonMarginableBuyingPower) : null,
      exposurePct: hasVerifiedAccountData
        ? numberOrNull(portfolio.exposurePct ?? portfolio.cryptoExposurePct)
          ?? (positionValue > 0 && numberOrNull(account.equity) ? (positionValue / Number(account.equity)) * 100 : null)
        : null,
      dayPnl: hasVerifiedAccountData ? numberOrNull(portfolio.dayPnl ?? portfolio.pnl24h ?? portfolio.dailyPnl) : null,
      drawdownPct: (() => {
        if (!hasVerifiedAccountData) return null;
        const rawDrawdown = numberOrNull(portfolio.drawdownPct ?? portfolio.drawdown ?? risk.drawdownPct ?? risk.drawdown);
        if (rawDrawdown === null) return null;
        return Math.abs(rawDrawdown) <= 1 ? Math.abs(rawDrawdown * 100) : Math.abs(rawDrawdown);
      })(),
    },
    automation: {
      enabled: automation.enabled === true || automation.active === true,
      status: String(automation.status ?? ''),
      nextRun: automation.nextRun ?? automation.nextRunAt ?? null,
      lastRun: automation.lastRun ?? automation.lastRunAt ?? null,
      intervalMinutes: numberOrNull(automation.intervalMinutes ?? automation.interval),
      killSwitch: automation.killSwitch === true || automation.killed === true,
      locked: automation.locked === true,
      lastAction: automation.lastAction ?? null,
    },
    decision,
    admission: {
      admitted: admission.admitted === true,
      status: String(admission.status ?? (admission.admitted === true ? 'admitted' : 'paper_only')),
      reasons: [admission.reason, ...asArray(admission.reasons ?? admission.blockers)]
        .filter((reason) => reason !== null && reason !== undefined && reason !== '')
        .map(String),
    },
    equityCurve: normalizePoints(data.equityCurve ?? portfolio.equityCurve ?? data.history),
    warnings,
    ai: {
      configured: ai.configured === true,
      status: String(ai.status ?? ''),
      provider: String(ai.provider ?? ''),
      model: String(ai.model ?? ''),
    },
  };
};

export const normalizeConfig = (response: any): CryptoConfig => {
  const data = unwrapResponse(response);
  const config = asRecord(data.config ?? data);
  const targetVolatility = numberOrNull(config.targetVolatility);
  const inferredRisk = targetVolatility !== null && targetVolatility <= 0.12
    ? 'conservative'
    : targetVolatility !== null && targetVolatility >= 0.2
      ? 'aggressive'
      : 'balanced';
  const risk = String(config.riskProfile ?? inferredRisk);
  const tradeHorizon = config.tradeHorizon === 'short' || numberOrNull(config.intervalMinutes) === 15 ? 'short' : 'long';
  const requestedInterval = numberOrNull(config.intervalMinutes);
  const intervalMinutes = tradeHorizon === 'short'
    ? 15
    : requestedInterval === 120 || requestedInterval === 240 ? requestedInterval : 60;
  return {
    mode: config.mode === 'live' ? 'live' : 'paper',
    symbols: asArray(config.symbols ?? config.universe).map(String).filter(Boolean).length
      ? asArray(config.symbols ?? config.universe).map((item) => String(item).toUpperCase())
      : DEFAULT_CONFIG.symbols,
    strategy: String(config.strategy ?? config.strategyVersion ?? DEFAULT_CONFIG.strategy),
    tradeHorizon,
    intervalMinutes,
    riskProfile: risk === 'conservative' || risk === 'aggressive' || risk === 'opportunistic'
      ? (risk === 'opportunistic' ? 'aggressive' : risk)
      : 'balanced',
    maxPortfolioExposurePct: percentValue(config.maxPortfolioExposurePct ?? config.maxExposurePct ?? config.maxTotalExposure ?? config.maxCryptoAllocation, DEFAULT_CONFIG.maxPortfolioExposurePct),
    maxAssetExposurePct: percentValue(config.maxAssetExposurePct ?? config.maxAssetPct ?? config.maxBtcAllocation ?? config.maxEthAllocation, DEFAULT_CONFIG.maxAssetExposurePct),
    riskPerTradePct: numberOrNull(config.riskPerTradePct) ?? DEFAULT_CONFIG.riskPerTradePct,
    minimumConfidence: numberOrNull(config.minimumConfidence ?? config.minConfidence) ?? DEFAULT_CONFIG.minimumConfidence,
    paperLearningEnabled: config.paperLearningEnabled === true,
    calibrationEveryCycles: ([12, 24, 48, 168].includes(Number(config.calibrationEveryCycles))
      ? Number(config.calibrationEveryCycles)
      : 24) as 12 | 24 | 48 | 168,
  };
};

export const hasUsableCryptoConfigResponse = (response: any): boolean => {
  const data = unwrapResponse(response);
  const config = asRecord(data.config);
  const symbols = asArray(config.symbols ?? config.universe).filter(Boolean);
  return Object.keys(config).length > 0
    && (config.mode === 'paper' || config.mode === 'live')
    && symbols.length > 0
    && numberOrNull(config.intervalMinutes) !== null
    && typeof config.riskProfile === 'string'
    && numberOrNull(config.minimumConfidence ?? config.minConfidence) !== null
    && numberOrNull(config.maxAssetExposurePct ?? config.maxAssetPct ?? config.maxAssetAllocation) !== null
    && numberOrNull(config.maxPortfolioExposurePct ?? config.maxExposurePct ?? config.maxTotalExposure ?? config.maxCryptoAllocation) !== null
    && numberOrNull(config.riskPerTradePct) !== null;
};

export const normalizeRuntime = (response: any): CryptoRuntime => {
  const data = unwrapResponse(response);
  const runtime = asRecord(data.runtime ?? data);
  const progressDetails = asRecord(runtime.progress);
  const completedSymbols = numberOrNull(progressDetails.completedSymbols ?? progressDetails.completed_symbols);
  const totalSymbols = numberOrNull(progressDetails.totalSymbols ?? progressDetails.total_symbols);
  const calculatedProgress = completedSymbols !== null && totalSymbols !== null && totalSymbols > 0
    ? (completedSymbols / totalSymbols) * 100
    : null;
  const scheduler = asRecord(data.scheduler);
  const schedulerMessage = String(
    data.schedulerMessage ?? scheduler.message ?? scheduler.lastError ?? scheduler.error ?? '',
  ).trim();
  const explicitSchedulerHealth = booleanOrNull(
    data.schedulerHealthy ?? scheduler.schedulerHealthy ?? scheduler.healthy,
  );
  const schedulerAlive = booleanOrNull(scheduler.schedulerAlive ?? scheduler.alive ?? scheduler.threadAlive);
  const schedulerStatus = String(data.schedulerStatus ?? scheduler.status ?? '').trim();
  const calibration = asRecord(runtime.calibration);
  const schedulerHealthy = explicitSchedulerHealth ?? (
    schedulerAlive !== null
      ? schedulerAlive && !schedulerMessage
      : schedulerStatus
        ? schedulerStatus.toLowerCase() === 'healthy'
        : null
  );
  return {
    status: String(data.runtimeStatus ?? runtime.status ?? ''),
    currentStage: String(data.currentStage ?? runtime.currentStage ?? runtime.stage ?? progressDetails.stage ?? ''),
    lastHeartbeat: data.heartbeat ?? data.lastHeartbeat ?? runtime.heartbeat ?? runtime.lastHeartbeat ?? runtime.heartbeatAt ?? null,
    nextRun: data.nextRun ?? runtime.nextRun ?? runtime.nextRunAt ?? null,
    cooldownUntil: data.cooldownUntil ?? runtime.cooldownUntil ?? runtime.cooldown_until ?? null,
    manualReviewRequired: data.manualReviewRequired === true || runtime.manualReviewRequired === true || runtime.manual_review_required === true,
    runId: data.runId ?? runtime.runId ?? runtime.id ?? null,
    progress: numberOrNull(data.progress ?? runtime.progressPct ?? runtime.progress) ?? calculatedProgress,
    message: String(data.message ?? runtime.message ?? runtime.detail ?? runtime.lastError ?? ''),
    schedulerHealthy,
    schedulerStatus: schedulerStatus || (schedulerHealthy === true ? 'healthy' : schedulerHealthy === false ? 'unhealthy' : ''),
    schedulerMessage,
    calibration: {
      status: String(calibration.status ?? 'not_run'),
      lastRun: calibration.lastRun ?? null,
      symbol: String(calibration.symbol ?? ''),
      champion: String(calibration.champion ?? ''),
      applied: calibration.applied === true,
      completedRuns: Math.max(0, Math.trunc(numberOrNull(calibration.completedRuns) ?? 0)),
      method: String(calibration.method ?? ''),
    },
  };
};

export const classifyLedgerRecord = (
  type: string,
  actor: string,
  payload: Record<string, any>,
): LedgerRecord['categories'] => {
  const normalizedType = type.toLowerCase();
  const normalizedActor = actor.toLowerCase();
  const payloadText = (() => {
    try { return JSON.stringify(payload).toLowerCase(); } catch { return ''; }
  })();
  const classificationText = `${normalizedType} ${payloadText}`;
  const categories = new Set<LedgerRecord['categories'][number]>();
  const order = asRecord(payload.order);
  if (Object.keys(order).length || /order|fill|submit|cancel|execution/.test(classificationText)) categories.add('order');
  if (/risk|kill|circuit|block|reject|eligib|drawdown|exposure|stale|spread|error|failed/.test(classificationText)) categories.add('risk');
  if (normalizedActor === 'user' || normalizedActor === 'operator' || /config_updated|automation_started|automation_stopped|backtest_completed/.test(normalizedType)) categories.add('operator');
  if (/decision|signal|cycle|backtest/.test(normalizedType) || (!categories.size && normalizedActor === 'system')) categories.add('decision');
  if (!categories.size) categories.add('decision');
  return Array.from(categories);
};

export const normalizeLedger = (response: any): LedgerRecord[] => {
  const data = unwrapResponse(response);
  return asArray(data.records ?? data.items ?? data.events ?? data.ledger).map((item, index) => {
    const row = asRecord(item);
    const payload = asRecord(row.payload ?? row.details);
    const order = asRecord(row.order ?? payload.order);
    const type = String(row.type ?? row.eventType ?? row.category ?? 'decision');
    const actor = String(row.actor ?? payload.actor ?? '');
    return {
      id: String(row.id ?? row.eventId ?? `${row.createdAt ?? 'event'}-${index}`),
      createdAt: row.createdAt ?? row.timestamp ?? row.recordedAt ?? null,
      type,
      symbol: String(row.symbol ?? payload.symbol ?? order.symbol ?? ''),
      action: String(row.action ?? payload.action ?? order.action ?? order.side ?? row.event ?? ''),
      status: String(row.status ?? row.result ?? payload.status ?? order.status ?? ''),
      mode: String(row.mode ?? payload.mode ?? order.mode ?? ''),
      quantity: numberOrNull(row.quantity ?? row.qty ?? payload.quantity ?? order.quantity ?? order.qty),
      price: numberOrNull(row.price ?? payload.price ?? order.price ?? order.limitPrice ?? order.limit_price),
      confidence: numberOrNull(row.confidence ?? payload.confidence),
      reason: String(row.reason ?? row.summary ?? payload.reason ?? payload.message ?? ''),
      source: String(row.source ?? payload.source ?? ''),
      actor,
      categories: classifyLedgerRecord(type, actor, { ...payload, order }),
    };
  });
};

export const normalizeLedgerMetadata = (response: any): LedgerScanMetadata => {
  const data = unwrapResponse(response);
  return {
    scanTruncated: data.scanTruncated === true,
    scannedRows: numberOrNull(data.scannedRows),
    scannedPages: numberOrNull(data.scannedPages),
  };
};

export const normalizeBacktest = (response: any, symbols: string[]): BacktestResult => {
  const envelope = unwrapResponse(response);
  const data = asRecord(envelope.result ?? envelope);
  const metrics = asRecord(data.metrics ?? data.summary ?? data);
  const benchmark = asRecord(asRecord(data.benchmark).metrics ?? data.benchmark);
  const timestamps = asArray(data.timestamps);
  const rawCurve = asArray(data.equity_curve);
  const generatedCurve = rawCurve.map((value, index) => ({
    time: timestamps[index] ?? index,
    value,
  }));
  return {
    status: 'ready',
    from: data.from ?? data.startDate ?? null,
    to: data.to ?? data.endDate ?? null,
    symbols: asArray(data.symbols).map(String).length ? asArray(data.symbols).map(String) : symbols,
    totalReturnPct: metrics.total_return !== undefined ? percentOrNull(metrics.total_return) : numberOrNull(metrics.totalReturnPct ?? metrics.returnPct ?? metrics.totalReturn),
    benchmarkReturnPct: benchmark.total_return !== undefined ? percentOrNull(benchmark.total_return) : numberOrNull(metrics.benchmarkReturnPct ?? metrics.buyHoldReturnPct ?? metrics.benchmarkReturn),
    maxDrawdownPct: metrics.max_drawdown !== undefined ? (() => { const value = percentOrNull(metrics.max_drawdown); return value === null ? null : Math.abs(value); })() : numberOrNull(metrics.maxDrawdownPct ?? metrics.maxDrawdown),
    sharpe: numberOrNull(metrics.sharpe ?? metrics.sharpeRatio),
    calmar: numberOrNull(metrics.calmar ?? metrics.calmarRatio),
    trades: numberOrNull(metrics.trades ?? metrics.tradeCount),
    winRatePct: numberOrNull(metrics.winRatePct ?? metrics.winRate),
    turnover: metrics.turnover !== undefined ? percentOrNull(metrics.turnover) : numberOrNull(metrics.turnoverPct),
    totalCosts: numberOrNull(metrics.totalCosts ?? metrics.costs ?? metrics.fees),
    equityCurve: normalizePoints(data.equityCurvePoints ?? data.equityCurve ?? data.curve ?? data.history ?? generatedCurve),
    notes: normalizeTextList(data.notes ?? data.warnings),
    executionConstraints: normalizeExecutionConstraints(data.executionConstraints ?? data.execution_constraints),
    limitations: normalizeTextList(data.limitations ?? data.simulationLimitations ?? data.simulation_limitations),
  };
};

const extractError = (error: any, fallback: string): string => {
  const body = asRecord(error?.response?.data);
  return String(body.message ?? body.error ?? body.detail ?? error?.message ?? fallback);
};

const formatMoney = (value: NullableNumber, compact = false): string => {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', compact ? {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2,
  } : {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
};

const formatPrice = (value: NullableNumber): string => {
  if (value === null) return '—';
  const digits = value < 1 ? 4 : value < 100 ? 2 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
};

const formatPct = (value: NullableNumber, signed = false): string => {
  if (value === null) return '—';
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${signed && normalized > 0 ? '+' : ''}${normalized.toFixed(2)}%`;
};

const formatBps = (value: NullableNumber): string => value === null ? '—' : `${value.toFixed(1)} bps`;

const formatDate = (value: string | null, isZh: boolean, includeSeconds = false): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(isZh ? 'zh-CN' : 'en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: !isZh,
  });
};

const signalTone = (signal: string): SignalTone => {
  const normalized = signal.toLowerCase();
  if (/buy|add|advance|long|filled|complete|success|eligible|admitted/.test(normalized)) return 'positive';
  if (/sell|exit|reduce|reject|block|fail|error|kill|lock|ineligible|denied/.test(normalized)) return 'negative';
  if (/watch|wait|pause/.test(normalized)) return 'warning';
  return 'neutral';
};

const ENUM_ZH: Record<string, string> = {
  buy: '买入', add: '加仓', hold: '持有', reduce: '减仓', exit: '退出', sell: '卖出', wait: '等待',
  risk_on: '风险偏好', transition: '过渡', risk_off: '风险规避', awaiting_data: '等待数据', unconfirmed: '未确认',
  account: '账户核验', reconcile: '订单核对', symbols: '交易对检查', refresh: '刷新数据', positions: '持仓核验', route: '订单路由',
  market_data: '行情数据', signals: '信号计算', reconciliation_required: '需要核对券商成交',
  price_unavailable: '价格不可用', quote_unavailable: '买卖报价不可用', quote_invalid: '买卖报价无效',
  quote_timestamp_unavailable: '报价时间不可用', quote_stale: '报价已过期', asset_catalog_unavailable: '券商资产目录不可用',
  invalid_quote: '买卖报价无效', stale_quote: '报价已过期', spread_unavailable: '点差不可用',
  spread_too_wide: '点差过宽', insufficient_daily_liquidity: '成交额不足', insufficient_quote_depth: '盘口深度不足',
  daily_liquidity_unreported: '成交额未上报', quote_depth_unreported: '盘口深度未上报',
  order_below_minimum: '订单低于最小金额',
  insufficient_exposure_or_buying_power: '敞口或购买力不足',
  asset_metadata_unavailable: '券商资产资料不可用', asset_metadata_missing: '券商资产资料缺失', broker_tradability_unknown: '券商交易资格未确认',
  account_eligibility_unknown: '账户虚拟币交易资格未确认', account_ineligible: '账户不符合虚拟币交易条件',
  asset_not_active: '该资产未启用', asset_not_tradable: '券商当前不允许交易', strategy_unsupported: '当前策略不支持该资产',
  single_asset: '单资产', market: '市价', limit: '限价', stop_limit: '止损限价', gtc: '撤销前有效', ioc: '立即成交否则取消',
  paper: '模拟', live: '实盘', user: '用户', operator: '操作员', system: '系统',
  idle: '空闲', armed: '待命', running: '运行中', stopped: '已暂停', paused: '已暂停', killed: '已紧急停止', locked: '已锁定',
  ready: '就绪', healthy: '健康', degraded: '异常', disabled: '已禁用', unhealthy: '不健康', complete: '已完成', completed: '已完成', success: '成功', error: '错误', failed: '失败', unavailable: '不可用',
  active: '正常', inactive: '未启用', submitted: '已提交', accepted: '已接受', filled: '已成交', canceled: '已取消', cancelled: '已取消',
  pending: '待处理', rejected: '已拒绝', denied: '已拒绝', blocked: '已阻止', blocked_by_risk: '已被风控阻止',
  crypto_decision: '虚拟币决策', crypto_cycle_completed: '决策周期完成', crypto_cycle_error: '决策周期错误',
  crypto_config_updated: '运行规则已更新', crypto_automation_started: '自动化已启动', crypto_automation_stopped: '自动化已暂停',
  crypto_kill_switch_activated: '总开关已启动', crypto_kill_switch_reset: '总开关已解除', crypto_backtest_completed: '回测已完成',
  account_blocked: '账户已被阻止', trading_blocked: '交易已被阻止', trade_suspended_by_user: '用户已暂停交易',
  account_not_active: '账户不是正常状态', crypto_status_not_active: '虚拟币交易状态不是正常状态',
};

const humanizeEnum = (value: string): string => value
  .trim()
  .replace(/^crypto_/, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const SERVICE_MESSAGE_ZH: Record<string, string> = {
  'crypto scheduler is disabled by deployment configuration.': '部署配置已禁用虚拟币调度器。',
  'crypto scheduler is running with a recent scan error.': '虚拟币调度器仍在运行，但最近一次扫描发生错误。',
  'crypto scheduler is running.': '虚拟币调度器正在运行。',
  'crypto scheduler is not running.': '虚拟币调度器未运行。',
  'worker thread stopped': '调度工作线程已停止。',
  'fees and slippage': '手续费与滑点',
  'no partial-fill simulation': '未模拟部分成交。',
  'no exchange outage model': '未模拟交易场所中断。',
  'this is a single-asset hourly-bar simulation, not a multi-asset portfolio replay.': '这是基于小时 K 线的单资产模拟，并非多资产组合回放。',
  'this is a single-asset 15-minute-bar simulation, not a multi-asset portfolio replay.': '这是基于 15 分钟 K 线的单资产模拟，并非多资产组合回放。',
  'live broker eligibility, buying power, quote quality, order lifecycle, and asynchronous fill reconciliation are not modeled.': '未模拟实盘券商资格、购买力、报价质量、订单生命周期和异步成交核对。',
  'risk-per-trade and order-notional mandates are disclosed above but are not enforced by the historical engine.': '上方已披露单笔风险和订单金额规则，但历史引擎不会执行这些规则。',
  'the single-asset engine backtest targets portfolio weight and does not size each order from a live equity risk budget.': '单资产回测引擎以组合权重为目标，不会依据实时权益风险预算计算每笔订单规模。',
  'historical fills are not rounded or rejected using the broker notional limits.': '历史成交不会依据券商订单金额限制进行取整或拒绝。',
  'this request simulates one asset; aggregate btc/eth competition is represented only by the applied single-asset cap.': '本请求只模拟一种资产；BTC 与 ETH 的组合敞口竞争仅通过已应用的单资产上限近似表示。',
  'broker order type, time-in-force, queueing, partial fills, and reconciliation are not replayed from historical order books.': '历史订单簿不会回放券商订单类型、有效期、排队、部分成交和成交核对。',
  'hourly ohlcv bars cannot reproduce live quote freshness, spread, or top-of-book depth gates.': '小时级 OHLCV K 线无法复现实时报价时效、点差或盘口深度门槛。',
  '15-minute ohlcv bars cannot reproduce live quote freshness, spread, or top-of-book depth gates.': '15 分钟 OHLCV K 线无法复现实时报价时效、点差或盘口深度门槛。',
  'the optional live decision challenge is not invoked during deterministic backtests.': '确定性回测不会调用可选的实盘决策反向复核。',
};

const CONSTRAINT_FIELD_COPY: Record<string, { en: string; zh: string }> = {
  minimum_confidence: { en: 'Minimum confidence', zh: '最低决策置信度' },
  entry_score: { en: 'Entry score threshold', zh: '入场评分阈值' },
  add_score: { en: 'Add score threshold', zh: '加仓评分阈值' },
  single_asset_weight_cap: { en: 'Effective single-asset weight cap', zh: '有效单资产权重上限' },
  rebalance_band: { en: 'Rebalance band', zh: '再平衡区间' },
  configured_single_asset_cap: { en: 'Configured single-asset cap', zh: '配置的单资产上限' },
  symbol_allocation_pct: { en: 'Configured symbol allocation', zh: '配置的交易对分配' },
  max_asset_exposure_pct: { en: 'Maximum asset exposure', zh: '单资产最大敞口' },
  max_total_exposure: { en: 'Maximum portfolio exposure', zh: '组合总敞口上限' },
  fee_bps: { en: 'Fee per side', zh: '单边手续费' },
  slippage_bps: { en: 'Adverse slippage per side', zh: '单边不利滑点' },
  completed_bars_only: { en: 'Completed bars only', zh: '仅使用已完成 K 线' },
  cost_model: { en: 'Cost model', zh: '成本模型' },
  risk_per_trade_pct: { en: 'Risk per trade', zh: '单笔交易风险' },
  'min_order_notional/max_order_notional': { en: 'Broker order-notional limits', zh: '券商订单金额限制' },
  multi_asset_aggregate_exposure: { en: 'Multi-asset aggregate exposure', zh: '多资产组合敞口' },
  broker_order_contract: { en: 'Broker order contract', zh: '券商订单规则' },
  fresh_quote_spread_depth: { en: 'Fresh quote, spread, and depth gates', zh: '报价时效、点差与深度门槛' },
  restricted_ai_review: { en: 'Restricted AI review', zh: '受约束的 AI 复核' },
  minimum: { en: 'Minimum', zh: '最小值' },
  maximum: { en: 'Maximum', zh: '最大值' },
  max_quote_age_seconds: { en: 'Maximum quote age', zh: '最大报价时延' },
  max_spread_bps: { en: 'Maximum spread', zh: '最大点差' },
  type: { en: 'Order type', zh: '订单类型' },
  time_in_force: { en: 'Time in force', zh: '订单有效期' },
  limit_offset_bps: { en: 'Limit offset', zh: '限价偏移' },
  stop_offset_bps: { en: 'Stop offset', zh: '止损偏移' },
};

const normalizeMachineKey = (value: string): string => value
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[\s-]+/g, '_')
  .toLowerCase();

export const localizeServiceMessage = (value: string | null | undefined, isZh: boolean, fallback = '—'): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (!isZh || /[\u3400-\u9fff]/.test(raw)) return raw;
  const repairedBars = raw.match(/^(\d+) isolated missing hourly bar\(s\) were filled at the prior close with zero volume; live signals never use repaired bars\.$/i);
  if (repairedBars) return `历史行情中 ${repairedBars[1]} 个孤立缺失小时已按前一收盘价、零成交量补齐；实时信号不会使用补齐数据。`;
  const mapped = SERVICE_MESSAGE_ZH[raw.toLowerCase()] ?? ENUM_ZH[normalizeMachineKey(raw)];
  return mapped ?? `${COPY.zh.serviceMessage}：${raw}`;
};

export const localizeConstraintField = (field: string, isZh: boolean): string => {
  const raw = String(field ?? '').trim();
  const mapped = CONSTRAINT_FIELD_COPY[normalizeMachineKey(raw)];
  if (mapped) return isZh ? mapped.zh : mapped.en;
  const readable = humanizeEnum(raw);
  return isZh ? `${COPY.zh.serviceField}：${readable}` : readable;
};

const formatConstraintValue = (field: string, value: unknown, isZh: boolean): string => {
  if (value === null || value === undefined || value === '') return '—';
  const key = normalizeMachineKey(field);
  if (Array.isArray(value)) return value.map((item) => formatConstraintValue(field, item, isZh)).join(' · ');
  if (value && typeof value === 'object') {
    return Object.entries(asRecord(value))
      .map(([nestedField, nestedValue]) => `${localizeConstraintField(nestedField, isZh)}: ${formatConstraintValue(nestedField, nestedValue, isZh)}`)
      .join(' · ') || '—';
  }
  if (typeof value === 'boolean') return isZh ? (value ? '是' : '否') : (value ? 'Yes' : 'No');
  const numeric = numberOrNull(value);
  if (numeric !== null) {
    if (['minimum_confidence', 'entry_score', 'add_score'].includes(key)) return `${numeric.toFixed(Number.isInteger(numeric) ? 0 : 2)} / 100`;
    if (['single_asset_weight_cap', 'rebalance_band', 'configured_single_asset_cap', 'max_total_exposure', 'multi_asset_aggregate_exposure'].includes(key)) return `${(numeric * 100).toFixed(2)}%`;
    if (['symbol_allocation_pct', 'max_asset_exposure_pct', 'risk_per_trade_pct'].includes(key)) return `${numeric.toFixed(2)}%`;
    if (key.endsWith('_bps')) return `${numeric.toFixed(2)} bps`;
    if (key.endsWith('_seconds')) return isZh ? `${numeric.toFixed(0)} 秒` : `${numeric.toFixed(0)} sec`;
    return new Intl.NumberFormat(isZh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 4 }).format(numeric);
  }
  const raw = String(value).trim();
  if (isZh && ENUM_ZH[normalizeMachineKey(raw)]) return ENUM_ZH[normalizeMachineKey(raw)];
  return localizeServiceMessage(raw, isZh, '—');
};

export const localizeCryptoEnum = (value: string | null | undefined, isZh: boolean, fallback = '—'): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (isZh && ENUM_ZH[key]) return ENUM_ZH[key];
  if (isZh && /[\u3400-\u9fff]/.test(raw)) return raw;
  return humanizeEnum(raw);
};

export const cryptoViewFromPath = (pathname: string): CryptoView => {
  const normalized = `/${pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean).join('/')}`;
  if (normalized === '/crypto') return 'command';
  if (normalized === '/crypto/strategy') return 'strategy';
  if (normalized === '/crypto/automation') return 'automation';
  if (normalized === '/crypto/ledger') return 'ledger';
  return 'not-found';
};

export const cryptoSymbolFromSearch = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('symbol');
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized === 'BTCUSD' || normalized === 'BTC') return 'BTC/USD';
  if (normalized === 'ETHUSD' || normalized === 'ETH') return 'ETH/USD';
  return null;
};

export const ledgerRecordMatchesFilter = (
  record: LedgerRecord,
  filter: 'all' | 'decision' | 'order' | 'risk' | 'operator',
): boolean => filter === 'all' || record.categories.includes(filter);

const linePath = (points: CryptoPoint[], width = 640, height = 220, padding = 10): string => {
  if (points.length < 2) return '';
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - ((point.value - min) / span)) * (height - padding * 2);
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

const areaPath = (points: CryptoPoint[], width = 640, height = 220, padding = 10): string => {
  const line = linePath(points, width, height, padding);
  if (!line) return '';
  return `${line} L${width - padding},${height - padding} L${padding},${height - padding} Z`;
};

const EmptyState: React.FC<{ title: string; description: string; compact?: boolean }> = ({ title, description, compact }) => (
  <div className={`crypto-empty${compact ? ' is-compact' : ''}`}>
    <span className="crypto-empty__mark" aria-hidden="true"><LineChartOutlined /></span>
    <strong>{title}</strong>
    <p>{description}</p>
  </div>
);

const Metric: React.FC<{ index: string; label: string; value: string; tone?: SignalTone; hint?: string }> = ({ index, label, value, tone = 'neutral', hint }) => (
  <article className={`crypto-metric is-${tone}`}>
    <div><span>{index}</span><p>{label}</p></div>
    <strong>{value}</strong>
    {hint ? <small>{hint}</small> : null}
  </article>
);

const CurveChart: React.FC<{ points: CryptoPoint[]; ariaLabel: string; tone?: 'amber' | 'violet' }> = ({ points, ariaLabel, tone = 'amber' }) => {
  const path = linePath(points);
  const fill = areaPath(points);
  if (!path) return null;
  return (
    <svg className={`crypto-curve is-${tone}`} viewBox="0 0 640 220" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`crypto-area-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="crypto-curve__grid">
        <line x1="10" x2="630" y1="10" y2="10" />
        <line x1="10" x2="630" y1="76" y2="76" />
        <line x1="10" x2="630" y1="143" y2="143" />
        <line x1="10" x2="630" y1="210" y2="210" />
      </g>
      <path className="crypto-curve__area" d={fill} fill={`url(#crypto-area-${tone})`} />
      <path className="crypto-curve__line" d={path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const Sparkline: React.FC<{ points: CryptoPoint[]; positive: boolean | null; ariaLabel: string }> = ({ points, positive, ariaLabel }) => {
  const path = linePath(points, 116, 32, 2);
  return path ? (
    <svg className={`crypto-sparkline ${positive === null ? 'is-neutral' : positive ? 'is-positive' : 'is-negative'}`} viewBox="0 0 116 32" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <path d={path} vectorEffect="non-scaling-stroke" />
    </svg>
  ) : <span className="crypto-sparkline__empty" aria-label={ariaLabel}>—</span>;
};

const StatusPill: React.FC<{ children: React.ReactNode; tone?: SignalTone }> = ({ children, tone = 'neutral' }) => (
  <span className={`crypto-status-pill is-${tone}`}>{children}</span>
);

type CryptoCopy = typeof COPY.en | typeof COPY.zh;

const ExecutionDiagnostics: React.FC<{ decision: CryptoDecision; c: CryptoCopy; isZh: boolean }> = ({ decision, c, isZh }) => {
  const entryGate = decision.entryGate;
  const capacity = decision.entryCapacity;
  const reservation = decision.openOrderReservation;
  const exposure = decision.portfolioExposure;
  const riskGate = decision.persistentRiskGate;
  const gateReasons = [
    ...normalizeTextList(entryGate?.reasons),
    ...normalizeTextList(riskGate?.reasons),
    ...(capacity?.reason ? [capacity.reason] : []),
  ];
  const gateWarnings = normalizeTextList(entryGate?.warnings);
  const gateIsReady = entryGate?.eligible === true && riskGate?.eligible !== false && capacity?.eligible !== false;
  const gateStatus = entryGate || riskGate || capacity
    ? (gateIsReady ? c.routeReady : c.routeBlocked)
    : c.noBlockers;
  const gateTone: SignalTone = gateStatus === c.routeBlocked ? 'negative' : gateWarnings.length ? 'warning' : 'positive';
  const detailText = gateReasons.length
    ? gateReasons.map((reason) => localizeCryptoEnum(reason, isZh, reason)).join(' · ')
    : gateWarnings.length
      ? `${c.warningsLabel}: ${gateWarnings.map((warning) => localizeCryptoEnum(warning, isZh, warning)).join(' · ')}`
      : c.noBlockers;
  const quoteQuality = [
    entryGate?.quoteAgeSeconds === null || entryGate?.quoteAgeSeconds === undefined ? null : `${Math.max(0, entryGate.quoteAgeSeconds).toFixed(0)}s`,
    formatBps(entryGate?.spreadBps ?? null),
  ].filter(Boolean).join(' · ') || '—';
  const capacityText = capacity
    ? `${formatMoney(capacity.availableNotional)} / ${formatMoney(capacity.minimumNotional)}`
    : c.noBlockers;
  const openOrderText = reservation
    ? `${reservation.count ?? 0} · ${formatMoney(reservation.buyNotional)}`
    : '0 · $0.00';
  return (
    <div className="crypto-execution-diagnostics" aria-label={c.executionCheck}>
      <div className="crypto-diagnostic-heading">
        <span>{c.executionCheck}</span>
        <StatusPill tone={gateTone}>{gateStatus}</StatusPill>
      </div>
      <div><small>{c.currentWeight}</small><strong>{formatPct(decision.currentWeight)}</strong></div>
      <div><small>{c.filledWeight}</small><strong>{formatPct(decision.filledWeight)}</strong></div>
      <div><small>{c.routeMode}</small><strong>{decision.dryRun ? c.simulatedCycle : localizeCryptoEnum(decision.mode ?? '', isZh, c.notAvailable)}</strong></div>
      <div><small>{c.quoteQuality}</small><strong>{quoteQuality}</strong></div>
      <div><small>{c.capacity}</small><strong>{capacityText}</strong></div>
      <div><small>{c.openOrder}</small><strong>{openOrderText}</strong></div>
      <div><small>{c.projectedExposure}</small><strong>{formatMoney(exposure?.projectedCryptoValue ?? null)}</strong></div>
      <p>{detailText}</p>
    </div>
  );
};

const Crypto: React.FC = () => {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { tradeMode, tradeModeReady } = useTradeMode();
  const isZh = language === 'zh-CN';
  const c = isZh ? COPY.zh : COPY.en;
  const view = cryptoViewFromPath(pathname);
  const apiMode: ApiMode = tradeMode === 'real' ? 'live' : 'paper';
  const cacheKey = `${user?.id ?? 'signed-out'}:${apiMode}`;
  const querySymbol = useMemo(() => cryptoSymbolFromSearch(search), [search]);
  const initialCache = cryptoWorkspaceCache[cacheKey];
  const loadSequenceRef = useRef(0);
  const backtestSequenceRef = useRef(0);
  const overviewRef = useRef<CryptoOverview | null>(null);

  const [overview, setOverview] = useState<CryptoOverview | null>(initialCache?.overview ?? null);
  const [config, setConfig] = useState<CryptoConfig>(initialCache?.config ?? DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(Boolean(initialCache?.config));
  const [runtime, setRuntime] = useState<CryptoRuntime | null>(initialCache?.runtime ?? null);
  const [ledger, setLedger] = useState<LedgerRecord[]>(initialCache?.ledger ?? []);
  const [ledgerScan, setLedgerScan] = useState<LedgerScanMetadata>(initialCache?.ledgerScan ?? EMPTY_LEDGER_SCAN);
  const [ledgerStale, setLedgerStale] = useState(false);
  const [snapshotStale, setSnapshotStale] = useState(false);
  const [loading, setLoading] = useState(!initialCache?.overview);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'data' | 'operation'>('data');
  const [configError, setConfigError] = useState('');
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [confirmRiskRestart, setConfirmRiskRestart] = useState(false);
  const [liveAuthBusy, setLiveAuthBusy] = useState(false);
  const [confirmLiveAuth, setConfirmLiveAuth] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'decision' | 'order' | 'risk' | 'operator'>('all');
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [backtestBusy, setBacktestBusy] = useState(false);
  const [calibrationBusy, setCalibrationBusy] = useState(false);
  const [strategyLibrary, setStrategyLibrary] = useState<StrategyLibraryItem[]>([]);
  const [backtest, setBacktest] = useState<BacktestResult | null>(initialCache?.backtest ?? null);
  const [backtestError, setBacktestError] = useState('');
  const [testLookback, setTestLookback] = useState(365);
  const [testSymbol, setTestSymbol] = useState('BTC/USD');
  const [testCapital, setTestCapital] = useState(10000);
  const [testFee, setTestFee] = useState(25);
  const [testSlippage, setTestSlippage] = useState(5);

  const strategyAdmitted = overview?.admission.admitted === true;
  const brokerReady = overview?.accountEligible === true && !overview.accountError;
  const liveExecutionReady = apiMode === 'live'
    && strategyAdmitted
    && overview?.accountEligible === true
    && overview.liveAuthorized === true;
  const liveEligible = apiMode === 'paper' || liveExecutionReady;
  const liveAdmissionMissing = apiMode === 'live' && overview !== null && !strategyAdmitted;
  const liveEligibilityUnknown = apiMode === 'live' && strategyAdmitted && overview?.accountEligible !== true;
  const liveAuthorizationMissing = apiMode === 'live'
    && strategyAdmitted
    && overview?.accountEligible === true
    && overview.liveAuthorized !== true;
  const liveBlocked = apiMode === 'live' && (!overview || liveAdmissionMissing || liveEligibilityUnknown || liveAuthorizationMissing);
  const automation = overview?.automation ?? EMPTY_AUTOMATION;
  const portfolio = overview?.portfolio ?? EMPTY_PORTFOLIO;
  const schedulerReady = runtime?.schedulerHealthy === true;
  const schedulerUnhealthy = runtime?.schedulerHealthy === false;
  const configuredDrawdownLimit = config.riskProfile === 'conservative'
    ? 6
    : config.riskProfile === 'aggressive'
      ? 12
      : 8;

  const invalidateBacktest = useCallback(() => {
    backtestSequenceRef.current += 1;
    setBacktest(null);
    setBacktestError('');
    setBacktestBusy(false);
    const cached = cryptoWorkspaceCache[cacheKey];
    if (cached) cached.backtest = null;
  }, [cacheKey]);

  const loadData = useCallback(async (quiet = false) => {
    if (!tradeModeReady || view === 'not-found') return;
    const requestId = ++loadSequenceRef.current;
    const isLatest = () => requestId === loadSequenceRef.current;
    const hasVerifiedState = overviewRef.current !== null || cryptoWorkspaceCache[cacheKey]?.overview != null;
    if (quiet || hasVerifiedState) setRefreshing(true);
    else setLoading(true);
    setError('');
    setErrorKind('data');
    setConfigError('');
    setDataWarnings([]);
    try {
      const ledgerPromise = view === 'ledger' ? cryptoAPI.ledger(CRYPTO_LEDGER_LIMIT) : null;
      const results = await Promise.allSettled([
        cryptoAPI.overview(apiMode),
        cryptoAPI.getConfig(),
        cryptoAPI.runtime(),
        ...(ledgerPromise ? [ledgerPromise] : []),
      ]);
      if (!isLatest()) return;

      const warnings: string[] = [];
      const configResult = results[1];
      const nextConfig = configResult.status === 'fulfilled' && hasUsableCryptoConfigResponse(configResult.value)
        ? normalizeConfig(configResult.value)
        : null;
      const overviewResult = results[0];
      let nextOverview: CryptoOverview | null = null;
      if (overviewResult.status === 'fulfilled') {
        nextOverview = normalizeOverview(overviewResult.value, apiMode);
        if (view === 'command' && nextOverview.assets.length) {
          const historyConfig = nextConfig ?? cryptoWorkspaceCache[cacheKey]?.config ?? DEFAULT_CONFIG;
          const historyTimeframe = historyConfig.tradeHorizon === 'short' ? '15Min' : '1Hour';
          const historyLimit = historyConfig.tradeHorizon === 'short' ? 96 * 7 : 168;
          const historyResults = await Promise.allSettled(
            nextOverview.assets.map((asset) => cryptoAPI.bars(asset.symbol, historyTimeframe, historyLimit, apiMode)),
          );
          if (!isLatest()) return;
          if (historyResults.some((result) => result.status === 'rejected')) warnings.push(c.barsUnavailable);
          nextOverview.assets = nextOverview.assets.map((asset, index) => {
            const history = historyResults[index];
            if (history?.status !== 'fulfilled') return asset;
            const body = unwrapResponse(history.value);
            const series = normalizePoints(body.bars);
            return series.length ? { ...asset, series } : asset;
          });
        }
      }

      const runtimeResult = results[2];
      const nextRuntime = runtimeResult.status === 'fulfilled' ? normalizeRuntime(runtimeResult.value) : null;
      if (runtimeResult.status === 'rejected') warnings.push(c.runtimeUnavailable);

      let nextLedger: LedgerRecord[] | null = null;
      let nextLedgerScan: LedgerScanMetadata | null = null;
      if (ledgerPromise) {
        const ledgerResult = results[3];
        if (ledgerResult?.status === 'fulfilled') {
          nextLedger = normalizeLedger(ledgerResult.value);
          nextLedgerScan = normalizeLedgerMetadata(ledgerResult.value);
        }
        else warnings.push(c.ledgerUnavailable);
      }

      if (!isLatest()) return;
      if (nextOverview) {
        overviewRef.current = nextOverview;
        setOverview(nextOverview);
        setSnapshotStale(false);
      } else if (overviewResult.status === 'rejected') {
        setSnapshotStale(quiet && overviewRef.current !== null);
        setError(extractError(overviewResult.reason, c.backendUnavailable));
      }

      if (nextConfig) {
        setConfig(nextConfig);
        setConfigLoaded(true);
        setTestSymbol((current) => {
          if (querySymbol && nextConfig.symbols.includes(querySymbol)) return querySymbol;
          return nextConfig.symbols.includes(current) ? current : (nextConfig.symbols[0] ?? 'BTC/USD');
        });
      } else {
        setConfigLoaded(false);
        setConfigError(configResult.status === 'rejected'
          ? extractError(configResult.reason, c.configUnavailable)
          : c.configUnavailable);
      }
      if (nextRuntime) setRuntime(nextRuntime);
      if (nextLedger) {
        setLedger(nextLedger);
        setLedgerScan(nextLedgerScan ?? EMPTY_LEDGER_SCAN);
        setLedgerStale(false);
      } else if (ledgerPromise) {
        setLedgerStale(quiet);
      }
      setDataWarnings(Array.from(new Set(warnings)));
      const previousCache = cryptoWorkspaceCache[cacheKey];
      cryptoWorkspaceCache[cacheKey] = {
        overview: nextOverview ?? overviewRef.current ?? previousCache?.overview ?? null,
        config: nextConfig ?? previousCache?.config ?? null,
        runtime: nextRuntime ?? previousCache?.runtime ?? null,
        ledger: nextLedger ?? previousCache?.ledger ?? [],
        ledgerScan: nextLedgerScan ?? previousCache?.ledgerScan ?? EMPTY_LEDGER_SCAN,
        backtest: previousCache?.backtest ?? null,
        updatedAt: Date.now(),
        loadedAt: { ...(previousCache?.loadedAt ?? {}), [view]: Date.now() },
      };
    } catch (loadError) {
      if (isLatest()) setError(extractError(loadError, c.backendUnavailable));
    } finally {
      if (isLatest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [apiMode, c.backendUnavailable, c.barsUnavailable, c.configUnavailable, c.ledgerUnavailable, c.runtimeUnavailable, cacheKey, querySymbol, tradeModeReady, view]);

  useEffect(() => {
    if (view === 'not-found') return;
    const cached = cryptoWorkspaceCache[cacheKey];
    if (cached) {
      overviewRef.current = cached.overview;
      setOverview(cached.overview);
      if (cached.config) {
        setConfig(cached.config);
        setConfigLoaded(true);
      }
      setRuntime(cached.runtime);
      setLedger(cached.ledger);
      setLedgerScan(cached.ledgerScan);
      setBacktest(cached.backtest);
      setLoading(false);
    }
    // Route changes should feel like switching workspace tabs, not a page
    // reload. Reuse a recently verified view and let the existing 30-second
    // foreground poll refresh it; stale views still revalidate immediately.
    const recentlyVerified = Boolean(cached?.loadedAt?.[view]
      && Date.now() - Number(cached.loadedAt[view]) < 120_000);
    if (!recentlyVerified) void loadData(Boolean(cached));
  }, [cacheKey, loadData, view]);

  useEffect(() => () => {
    loadSequenceRef.current += 1;
    backtestSequenceRef.current += 1;
  }, []);

  useEffect(() => {
    if (view !== 'command' && view !== 'automation') return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadData(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadData, view]);

  useEffect(() => {
    if (view !== 'automation') return undefined;
    if (typeof cryptoAPI.strategyLibrary !== 'function') return undefined;
    let active = true;
    void cryptoAPI.strategyLibrary().then((response) => {
      if (!active) return;
      const body = unwrapResponse(response);
      const rows = Array.isArray(body.strategies) ? body.strategies : [];
      setStrategyLibrary(rows.filter((item): item is StrategyLibraryItem => Boolean(
        item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string',
      )));
    }).catch(() => {
      // The trading mandate remains usable if provenance metadata is
      // temporarily unavailable; calibration itself still runs server-side.
    });
    return () => { active = false; };
  }, [view]);

  const patchConfig = <K extends keyof CryptoConfig>(key: K, value: CryptoConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    setNotice('');
    invalidateBacktest();
  };

  const setTradeHorizon = (tradeHorizon: CryptoConfig['tradeHorizon']) => {
    setConfig((current) => ({
      ...current,
      tradeHorizon,
      intervalMinutes: tradeHorizon === 'short' ? 15 : current.intervalMinutes === 15 ? 60 : current.intervalMinutes,
      paperLearningEnabled: tradeHorizon === 'short' ? false : current.paperLearningEnabled,
    }));
    setNotice('');
    invalidateBacktest();
  };

  const mergeMutationResponse = (response: any) => {
    const body = unwrapResponse(response);
    const responseConfig = asRecord(body.config);
    const responseRuntime = asRecord(body.runtime);
    if (Object.keys(responseConfig).length) {
      setConfig(normalizeConfig({ data: { config: responseConfig } }));
      setConfigLoaded(true);
    }
    if (Object.keys(responseRuntime).length) {
      const nextRuntime = normalizeRuntime({ data: { runtime: responseRuntime } });
      setRuntime((current) => ({
        ...nextRuntime,
        schedulerHealthy: nextRuntime.schedulerHealthy ?? current?.schedulerHealthy ?? null,
        schedulerStatus: nextRuntime.schedulerStatus || current?.schedulerStatus || '',
        schedulerMessage: nextRuntime.schedulerMessage || current?.schedulerMessage || '',
      }));
    }
    if (!Object.keys(responseConfig).length && !Object.keys(responseRuntime).length) return;
    setOverview((current) => {
      if (!current) return current;
      const next: CryptoOverview = {
        ...current,
        liveAuthorized: responseConfig.liveAuthorized === undefined
          ? current.liveAuthorized
          : responseConfig.liveAuthorized === true,
        automation: {
          ...current.automation,
          enabled: responseConfig.enabled === undefined
            ? responseRuntime.enabled === undefined ? current.automation.enabled : responseRuntime.enabled === true
            : responseConfig.enabled === true,
          status: String(responseRuntime.status ?? current.automation.status),
          nextRun: responseRuntime.nextRun ?? current.automation.nextRun,
          lastRun: responseRuntime.lastRun ?? current.automation.lastRun,
          intervalMinutes: numberOrNull(responseConfig.intervalMinutes) ?? current.automation.intervalMinutes,
          killSwitch: responseConfig.killSwitch === undefined
            ? responseRuntime.killSwitch === undefined ? current.automation.killSwitch : responseRuntime.killSwitch === true
            : responseConfig.killSwitch === true,
          locked: responseRuntime.locked === undefined ? current.automation.locked : responseRuntime.locked === true,
        },
      };
      overviewRef.current = next;
      return next;
    });
  };

  const ensureConfigMode = async () => {
    if (!configLoaded) throw new Error(c.configUnavailable);
    if (config.mode === apiMode) return;
    const response = await cryptoAPI.saveConfig({ mode: apiMode });
    mergeMutationResponse(response);
    invalidateBacktest();
  };

  const saveConfig = async () => {
    if (!configLoaded) {
      setConfigError(c.configUnavailable);
      return;
    }
    setSaving(true);
    setConfigError('');
    setNotice('');
    try {
      const allocationTotal = Math.min(config.maxPortfolioExposurePct, config.maxAssetExposurePct * config.symbols.length);
      const btcAllocation = config.symbols.includes('BTC/USD')
        ? Math.min(config.maxAssetExposurePct, config.symbols.length === 1 ? allocationTotal : allocationTotal * 0.6)
        : 0;
      const ethAllocation = config.symbols.includes('ETH/USD')
        ? Math.min(config.maxAssetExposurePct, config.symbols.length === 1 ? allocationTotal : Math.max(0, allocationTotal - btcAllocation))
        : 0;
      const configPayload = {
        mode: apiMode,
        symbols: config.symbols,
        tradeHorizon: config.tradeHorizon,
        intervalMinutes: config.intervalMinutes,
        riskProfile: config.riskProfile,
        minimumConfidence: config.minimumConfidence,
        maxAssetExposurePct: config.maxAssetExposurePct,
        maxTotalExposure: config.maxPortfolioExposurePct / 100,
        riskPerTradePct: config.riskPerTradePct,
        paperLearningEnabled: apiMode === 'paper' && config.tradeHorizon !== 'short' && config.paperLearningEnabled,
        calibrationEveryCycles: config.calibrationEveryCycles,
        assetAllocationsPct: {
          'BTC/USD': Number(btcAllocation.toFixed(2)),
          'ETH/USD': Number(ethAllocation.toFixed(2)),
        },
      };
      const response = await cryptoAPI.saveConfig(configPayload);
      mergeMutationResponse(response);
      invalidateBacktest();
      setNotice(c.saved);
    } catch (saveError) {
      setErrorKind('operation');
      setError(extractError(saveError, c.backendUnavailable));
    } finally {
      setSaving(false);
    }
  };

  const runCycle = async () => {
    if (cycleRunning || liveBlocked || !configLoaded || !brokerReady || automation.killSwitch) return;
    setCycleRunning(true);
    setError('');
    setErrorKind('operation');
    try {
      await ensureConfigMode();
      const response = await cryptoAPI.runCycle(apiMode, false);
      mergeMutationResponse(response);
      const responseBody = unwrapResponse(response);
      const decisions = asArray(responseBody.decisions);
      const aiChecks = decisions.filter((item) => {
        const row = asRecord(item);
        return String(row.reviewer ?? '').includes('ai') || Object.keys(asRecord(row.aiReview)).length > 0;
      }).length;
      const routed = decisions.filter((item) => Object.keys(asRecord(asRecord(item).order)).length > 0).length;
      setNotice(`${c.cycleComplete} · ${decisions.length} ${c.pairsScanned} · ${aiChecks} ${c.aiChecks} · ${routed} ${c.ordersRouted}`);
      await loadData(true);
    } catch (cycleError) {
      setError(extractError(cycleError, c.backendUnavailable));
    } finally {
      setCycleRunning(false);
    }
  };

  const setAutomation = async (enabled: boolean, acknowledgeRisk = false) => {
    if (enabled && (liveBlocked || !configLoaded || !brokerReady || !schedulerReady)) return;
    setAutomationBusy(true);
    setError('');
    setErrorKind('operation');
    try {
      let response;
      if (enabled) {
        await ensureConfigMode();
        response = await cryptoAPI.startAutomation(apiMode, acknowledgeRisk);
      }
      else response = await cryptoAPI.stopAutomation();
      mergeMutationResponse(response);
      setConfirmRiskRestart(false);
      await loadData(true);
    } catch (automationError) {
      setError(extractError(automationError, c.backendUnavailable));
    } finally {
      setAutomationBusy(false);
    }
  };

  const authorizeLiveAutomation = async () => {
    if (!strategyAdmitted || !configLoaded || !brokerReady) return;
    setLiveAuthBusy(true);
    setError('');
    setErrorKind('operation');
    try {
      const authorizationPayload = {
        mode: 'live' as const,
        liveAuthorized: true,
        confirmLiveRisk: true,
      };
      const response = await cryptoAPI.saveConfig(authorizationPayload);
      mergeMutationResponse(response);
      setConfirmLiveAuth(false);
      await loadData(true);
    } catch (authorizationError) {
      setError(extractError(authorizationError, c.backendUnavailable));
    } finally {
      setLiveAuthBusy(false);
    }
  };

  const toggleKillSwitch = async () => {
    setKillBusy(true);
    setError('');
    setErrorKind('operation');
    try {
      const response = await cryptoAPI.setKillSwitch(
        !automation.killSwitch,
        automation.killSwitch ? 'operator_release' : 'operator_emergency_stop',
      );
      mergeMutationResponse(response);
      setConfirmKill(false);
      setConfirmRiskRestart(false);
      await loadData(true);
    } catch (killError) {
      setError(extractError(killError, c.backendUnavailable));
    } finally {
      setKillBusy(false);
    }
  };

  const runBacktest = async () => {
    if (!configLoaded) {
      setConfigError(c.configUnavailable);
      return;
    }
    const requestId = ++backtestSequenceRef.current;
    setBacktest(null);
    setBacktestError('');
    setBacktestBusy(true);
    setError('');
    setErrorKind('operation');
    try {
      const symbol = config.symbols.includes(testSymbol) ? testSymbol : (config.symbols[0] ?? 'BTC/USD');
      const barsPerDay = config.tradeHorizon === 'short' ? 96 : 24;
      const response = await cryptoAPI.backtest({
        mode: apiMode,
        symbol,
        limit: Math.min(10000, testLookback * barsPerDay),
        initialCapital: testCapital,
        strategy: {
          bars_per_day: barsPerDay,
          fee_bps: testFee,
          slippage_bps: testSlippage,
        },
      });
      if (requestId === backtestSequenceRef.current) {
        const nextBacktest = normalizeBacktest(response, [symbol]);
        setBacktest(nextBacktest);
        const cached = cryptoWorkspaceCache[cacheKey];
        if (cached) cached.backtest = nextBacktest;
      }
    } catch (testError) {
      if (requestId === backtestSequenceRef.current) {
        setBacktestError(extractError(testError, c.backendUnavailable));
      }
    } finally {
      if (requestId === backtestSequenceRef.current) setBacktestBusy(false);
    }
  };

  const runCalibration = async () => {
    if (!configLoaded || apiMode !== 'paper' || calibrationBusy) return;
    setCalibrationBusy(true);
    setError('');
    setErrorKind('operation');
    try {
      await ensureConfigMode();
      const response = await cryptoAPI.calibrate(true);
      mergeMutationResponse(response);
      const body = unwrapResponse(response);
      const calibration = asRecord(body.calibration);
      setNotice(`${calibration.applied === true ? c.calibrationApplied : c.calibrationHeld} · ${String(calibration.symbol ?? '')} · ${String(calibration.champion ?? 'current')}`);
      await loadData(true);
    } catch (calibrationError) {
      setError(extractError(calibrationError, c.backendUnavailable));
    } finally {
      setCalibrationBusy(false);
    }
  };

  const filteredLedger = useMemo(() => {
    const query = ledgerQuery.trim().toLowerCase();
    return ledger.filter((record) => {
      if (!ledgerRecordMatchesFilter(record, ledgerFilter)) return false;
      if (!query) return true;
      return [record.symbol, record.action, record.reason, record.status, record.source, record.actor, record.type]
        .join(' ').toLowerCase().includes(query);
    });
  }, [ledger, ledgerFilter, ledgerQuery]);

  const commandAssets = useMemo(() => {
    const assets = overview?.assets ?? [];
    if (!querySymbol) return assets;
    return [...assets].sort((left, right) => (
      Number(right.symbol === querySymbol) - Number(left.symbol === querySymbol)
    ));
  }, [overview?.assets, querySymbol]);

  const exportLedger = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      scope: 'visible_loaded_records',
      apiLimit: CRYPTO_LEDGER_LIMIT,
      sourceScan: ledgerScan,
      loadedRecordCount: ledger.length,
      exportedRecordCount: filteredLedger.length,
      filter: ledgerFilter,
      query: ledgerQuery.trim(),
      records: filteredLedger,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `alphalab-crypto-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (view === 'not-found') return <Navigate to="/crypto" replace />;

  const heroTitle = view === 'strategy' ? c.strategyTitle : view === 'automation' ? c.automationTitle : view === 'ledger' ? c.ledgerTitle : c.commandTitle;
  const heroIntro = view === 'strategy' ? c.strategyIntro : view === 'automation' ? c.automationIntro : view === 'ledger' ? c.ledgerIntro : c.commandIntro;
  const cadenceLabel = config.tradeHorizon === 'short'
    ? `${c.shortTerm} · ${c.fifteenMinutes}`
    : `${c.longTerm} · ${config.intervalMinutes === 240 ? c.fourHours : config.intervalMinutes === 120 ? c.twoHours : c.oneHour}`;
  const strategyBadgeLabel = config.tradeHorizon === 'short' ? '15M / QUICK' : 'LONG / FLAT';

  const pageHero = (
    <header className="crypto-hero">
      <div className="crypto-hero__copy">
        <span className="crypto-kicker"><span className="crypto-bitcoin" aria-hidden="true">₿</span>{c.desk}</span>
        <h1>{heroTitle}</h1>
        <p>{heroIntro}</p>
        <div className="crypto-hero__meta">
          <StatusPill tone={apiMode === 'paper' ? 'positive' : liveEligible ? 'warning' : 'negative'}>
            {apiMode === 'paper' ? c.paper : liveEligible ? c.live : c.livePending}
          </StatusPill>
          <span><i className="is-open" />{c.marketOpen}</span>
          <span><ClockCircleOutlined /> ET · UTC</span>
          <span>{c.currentCadence}: {cadenceLabel}</span>
          <span>{c.refreshed}: {formatDate(overview?.asOf ?? null, isZh, true)}</span>
        </div>
      </div>
      <div className="crypto-hero__actions">
        <button className="crypto-button is-secondary" type="button" onClick={() => void loadData(true)} disabled={refreshing || loading}>
          <ReloadOutlined className={refreshing ? 'is-spinning' : ''} /> {c.refresh}
        </button>
        {view === 'command' ? (
          <button className="crypto-button is-primary" type="button" onClick={() => void runCycle()} disabled={cycleRunning || loading || !configLoaded || !brokerReady || liveBlocked || automation.killSwitch}>
            <ThunderboltOutlined /> {cycleRunning ? c.running : c.runCycle}
          </button>
        ) : null}
      </div>
    </header>
  );

  const notices = (
    <>
      {error ? <div className="crypto-notice is-error" role="alert"><WarningOutlined /><span><strong>{errorKind === 'data' ? c.backendUnavailable : c.operationFailed}</strong>{error}</span><button type="button" onClick={() => void loadData()}>{c.retry}</button></div> : null}
      {notice && view !== 'automation' ? <div className="crypto-inline-success crypto-cycle-result" role="status"><CheckCircleOutlined />{notice}</div> : null}
      {snapshotStale ? <div className="crypto-mode-note is-live" role="status"><WarningOutlined />{c.staleSnapshot}</div> : null}
      {configError ? <div className="crypto-notice is-error" role="alert"><WarningOutlined /><span><strong>{c.configUnavailable}</strong>{configError !== c.configUnavailable ? configError : null}<small>{c.configControlsLocked}</small></span><button type="button" onClick={() => void loadData()}>{c.retry}</button></div> : null}
      {schedulerUnhealthy ? <div className="crypto-notice is-error" role="alert"><WarningOutlined /><span><strong>{c.schedulerUnhealthy}</strong>{runtime?.schedulerMessage ? localizeServiceMessage(runtime.schedulerMessage, isZh, c.runtimeUnknown) : localizeCryptoEnum(runtime?.schedulerStatus, isZh, c.runtimeUnknown)}<small>{c.schedulerUnhealthyText}</small></span><button type="button" onClick={() => void loadData(true)}>{c.retry}</button></div> : null}
      {overview?.accountError ? (
        <div className="crypto-notice is-error" role="alert"><WarningOutlined /><span><strong>{overview.accountConfigured === false ? c.accountNotConfigured : c.accountDataUnavailable}</strong>{overview.accountError}</span><button type="button" onClick={() => void loadData(true)}>{c.retry}</button></div>
      ) : null}
      {overview && !overview.accountError && overview.accountEligible === false ? (
        <div className="crypto-notice is-error" role="alert"><WarningOutlined /><span><strong>{c.accountIneligible}</strong>{overview.eligibilityReasons.length ? `${c.eligibilityDetails}: ${overview.eligibilityReasons.map((reason) => localizeCryptoEnum(reason, isZh, reason)).join(' · ')}` : null}</span></div>
      ) : null}
      {overview && !overview.accountError && overview.accountEligible === null ? <div className="crypto-mode-note is-live" role="status"><WarningOutlined />{c.eligibilityUnknown}</div> : null}
      {dataWarnings.map((warning) => <div className="crypto-mode-note is-live" role="status" key={warning}><WarningOutlined />{warning}</div>)}
      {ledgerStale ? <div className="crypto-mode-note is-live" role="status"><WarningOutlined />{c.ledgerUnavailable}</div> : null}
      {apiMode === 'paper' ? <div className="crypto-mode-note is-paper"><SafetyCertificateOutlined />{c.paperSafe}</div> : null}
      {liveAdmissionMissing ? <div className="crypto-mode-note is-live" role="alert"><SafetyCertificateOutlined /><span><strong>{c.admissionLocked}</strong>{overview?.admission.reasons.length ? <small>{overview.admission.reasons.map((reason) => localizeCryptoEnum(reason, isZh, reason)).join(' · ')}</small> : null}</span></div> : null}
      {liveBlocked && overview ? <div className="crypto-mode-note is-live"><WarningOutlined />{c.liveGuard}</div> : null}
      {overview?.warnings.map((warning, index) => <div className="crypto-mode-note is-live" key={`${warning}-${index}`}><WarningOutlined />{warning}</div>)}
    </>
  );

  const commandView = (
    <>
      <section className="crypto-metric-grid" aria-label={c.accountMetrics}>
        <Metric index="01" label={c.accountEquity} value={formatMoney(portfolio.equity)} />
        <Metric index="02" label={c.cryptoEquity} value={formatMoney(portfolio.cryptoEquity)} tone={portfolio.cryptoEquity === null ? 'neutral' : 'warning'} />
        <Metric index="03" label={c.exposure} value={formatPct(portfolio.exposurePct)} />
        <Metric index="04" label={c.dayPnl} value={formatMoney(portfolio.dayPnl)} tone={portfolio.dayPnl === null ? 'neutral' : portfolio.dayPnl >= 0 ? 'positive' : 'negative'} />
        <Metric index="05" label={c.drawdown} value={formatPct(portfolio.drawdownPct)} tone={portfolio.drawdownPct !== null && portfolio.drawdownPct > configuredDrawdownLimit * 0.7 ? 'negative' : 'neutral'} />
        <Metric index="06" label={c.universe} value={overview ? String(overview.assets.length) : '—'} hint={configLoaded ? config.symbols.join(' · ') : c.notAvailable} />
      </section>

      <section className="crypto-command-grid">
        <article className="crypto-market-panel">
          <div className="crypto-panel-heading is-dark">
            <div><span>01 / MARKET</span><h2>{c.marketTape}</h2></div>
            <p>{c.marketTapeNote}</p>
          </div>
          {loading ? <div className="crypto-loading-table" role="status" aria-label={c.refresh}>{Array.from({ length: 4 }).map((_, index) => <span key={index} />)}</div> : commandAssets.length ? (
            <div className="crypto-table-scroll" role="region" aria-label={c.marketTape} tabIndex={0}>
              <div className="crypto-market-table" role="table" aria-label={c.marketTape} aria-colcount={8} aria-rowcount={commandAssets.length + 1}>
                <div role="rowgroup">
                  <div className="crypto-market-table__head" role="row">
                    <span role="columnheader">{c.pair}</span><span role="columnheader">{c.price}</span><span role="columnheader">{c.change}</span><span role="columnheader">7D</span><span role="columnheader">{c.volume}</span><span role="columnheader">{c.spread}</span><span role="columnheader">{c.availability}</span><span role="columnheader">{c.signal}</span>
                  </div>
                </div>
                <div role="rowgroup">
                  {commandAssets.map((asset) => {
                    const dataAvailable = asset.dataAvailable;
                    const changePositive = asset.change24h === null ? null : asset.change24h >= 0;
                    const tone = dataAvailable ? signalTone(asset.signal) : 'neutral';
                    const executionReady = asset.executionReady !== false;
                    const availabilityTone: SignalTone = !dataAvailable
                      ? 'negative'
                      : !executionReady ? 'warning' : asset.tradable === true ? 'positive' : asset.tradable === false ? 'negative' : 'warning';
                    const availabilityLabel = !dataAvailable
                      ? c.dataUnavailable
                      : !executionReady ? c.quoteWaiting
                      : asset.tradable === true ? c.tradable : asset.tradable === false ? c.notTradable : c.tradabilityUnknown;
                    return (
                      <div className={`crypto-market-row${querySymbol === asset.symbol ? ' is-selected' : ''}`} role="row" key={asset.symbol}>
                        <div className="crypto-asset-cell" role="cell"><span className="crypto-asset-mark" aria-hidden="true">{asset.symbol.startsWith('BTC') ? '₿' : asset.symbol.slice(0, 1)}</span><span><strong>{asset.symbol}</strong><small>{asset.name} · {dataAvailable ? localizeCryptoEnum(asset.regime, isZh, c.unknown) : c.dataUnavailable}</small></span></div>
                        <strong className="crypto-tabular" role="cell">{formatPrice(asset.price)}</strong>
                        <span className={`crypto-change is-${changePositive === null ? 'neutral' : changePositive ? 'positive' : 'negative'}`} role="cell">{changePositive === null ? null : changePositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{formatPct(asset.change24h, true)}</span>
                        <span role="cell"><Sparkline points={asset.series} positive={changePositive} ariaLabel={`${asset.symbol} ${c.marketHistory}`} /></span>
                        <span className="crypto-tabular" role="cell">{formatMoney(asset.volume24h, true)}</span>
                        <span className="crypto-tabular" role="cell">{formatBps(asset.spreadBps)}</span>
                        <span className="crypto-availability" role="cell"><StatusPill tone={availabilityTone}>{availabilityLabel}</StatusPill>{asset.reasons.length ? <small title={asset.reasons.join(' · ')}>{asset.reasons.map((reason) => localizeCryptoEnum(reason, isZh, reason)).join(' · ')}</small> : null}</span>
                        <span role="cell"><StatusPill tone={tone}>{dataAvailable ? localizeCryptoEnum(asset.signal, isZh, c.unknown) : c.dataUnavailable}</StatusPill><small className="crypto-confidence">{dataAvailable ? formatPct(asset.confidence) : '—'}</small></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : <EmptyState title={c.noSnapshot} description={c.noSnapshotHint} />}
        </article>

        <aside className="crypto-posture-panel">
          <div className="crypto-panel-heading is-dark"><div><span>02 / RISK</span><h2>{c.portfolioPosture}</h2></div></div>
          <div className="crypto-allocation-ring" style={{ '--allocation': `${Math.max(0, Math.min(100, portfolio.exposurePct ?? 0))}%` } as React.CSSProperties}>
            <div><strong>{formatPct(portfolio.exposurePct)}</strong><span>{c.allocated}</span></div>
          </div>
          <dl className="crypto-posture-list">
            <div><dt>{c.cashReserve}</dt><dd>{formatMoney(portfolio.cash)}</dd></div>
            <div><dt>{c.maxPortfolio}</dt><dd>{configLoaded ? `${config.maxPortfolioExposurePct}%` : '—'}</dd></div>
            <div><dt>{c.admissionStatus}</dt><dd className={!overview ? '' : strategyAdmitted ? 'is-positive' : 'is-warning'}>{!overview ? c.unknown : strategyAdmitted ? c.admittedStatus : c.paperOnlyStatus}</dd></div>
            <div><dt>{c.liveEligibility}</dt><dd className={overview?.accountEligible === true ? 'is-positive' : overview?.accountEligible === false ? 'is-negative' : 'is-warning'}>{overview?.accountEligible === true ? c.eligible : overview?.accountEligible === false ? c.accountIneligible : c.unverified}</dd></div>
            <div><dt>{c.accountStatus}</dt><dd>{localizeCryptoEnum(overview?.accountStatus, isZh, c.unknown)}</dd></div>
            <div><dt>{c.dataSource}</dt><dd>{overview?.source || c.sourceUnknown}</dd></div>
          </dl>
          <div className={`crypto-kill-mini ${automation.killSwitch ? 'is-engaged' : ''}`}><StopOutlined /><span><strong>{c.killSwitch}</strong><small>{c.status}: {automation.killSwitch ? c.switchOn : c.switchReady}</small></span></div>
        </aside>
      </section>

      <section className="crypto-decision-grid">
        <article className="crypto-decision-card">
          <div className="crypto-panel-heading"><div><span>03 / DECISION</span><h2>{c.latestDecision}</h2></div>{overview?.decision ? <StatusPill tone={signalTone(overview.decision.action)}>{localizeCryptoEnum(overview.decision.action, isZh, c.unknown)}</StatusPill> : null}</div>
          {overview?.decision ? (
            <div className="crypto-decision-body">
              <div className="crypto-decision-symbol"><span>{overview.decision.symbol || '—'}</span><strong>{formatPct(overview.decision.confidence)}</strong><small>{c.confidence}</small></div>
              <div className="crypto-decision-rationale"><span>{c.rationale}</span><p>{overview.decision.reason || c.notAvailable}</p></div>
              <dl><div><dt>{c.targetWeight}</dt><dd>{formatPct(overview.decision.targetWeight)}</dd></div><div><dt>{c.time}</dt><dd>{formatDate(overview.decision.createdAt, isZh)}</dd></div></dl>
              <ExecutionDiagnostics decision={overview.decision} c={c} isZh={isZh} />
              {overview.decision.order ? (
                <div className="crypto-order-evidence">
                  <div><span>{c.latestOrder}</span><StatusPill tone={signalTone(overview.decision.order.status || overview.decision.action)}>{localizeCryptoEnum(overview.decision.order.status || overview.decision.action, isZh, c.unknown)}</StatusPill></div>
                  <dl>
                    <div><dt>{c.action}</dt><dd>{localizeCryptoEnum(overview.decision.order.side || overview.decision.action, isZh, c.unknown)}</dd></div>
                    <div><dt>{c.qtyPrice}</dt><dd>{[overview.decision.order.quantity === null ? null : overview.decision.order.quantity.toFixed(6), formatPrice(overview.decision.order.price)].filter(Boolean).join(' / ') || c.notAvailable}</dd></div>
                    <div><dt>{c.orderValue}</dt><dd>{formatMoney(overview.decision.order.notional)}</dd></div>
                  </dl>
                  {overview.decision.order.id ? <small>{c.orderId}: {overview.decision.order.id}</small> : null}
                </div>
              ) : (
                <div className="crypto-order-evidence is-empty">
                  <strong>{c.noOrderRouted}</strong>
                  <span>{c.noOrderRoutedHint}</span>
                  <a href="/crypto/ledger">{c.viewLedger}<ArrowRightOutlined /></a>
                </div>
              )}
            </div>
          ) : <EmptyState title={c.noDecision} description={c.paperSafe} compact />}
        </article>
        <article className="crypto-cycle-card">
          <div className="crypto-panel-heading"><div><span>04 / ENGINE</span><h2>{c.cycle}</h2></div><StatusPill tone={automation.enabled ? 'positive' : signalTone(automation.status)}>{localizeCryptoEnum(automation.status, isZh, c.unknown)}</StatusPill></div>
          <div className="crypto-cycle-flow">
            {[c.observe, c.score, c.review, c.gate, c.route].map((label, index) => <React.Fragment key={label}><span className={runtime?.progress !== null && runtime?.progress !== undefined && runtime.progress >= index * 25 ? 'is-complete' : ''}><i>{String(index + 1).padStart(2, '0')}</i>{label}</span>{index < 4 ? <ArrowRightOutlined /> : null}</React.Fragment>)}
          </div>
          <div className="crypto-runtime-strip"><span><small>{c.status}</small><strong>{localizeCryptoEnum(runtime?.status, isZh, c.runtimeUnknown)}</strong></span><span><small>{c.currentStage}</small><strong>{localizeCryptoEnum(runtime?.currentStage, isZh, c.notAvailable)}</strong></span><span><small>{c.nextRun}</small><strong>{formatDate(runtime?.nextRun ?? automation.nextRun, isZh)}</strong></span></div>
        </article>
      </section>

      <section className="crypto-principles">
        {[[c.deterministic, c.deterministicText, <ExperimentOutlined />], [c.aiBoundary, c.aiBoundaryText, <ThunderboltOutlined />], [c.executionBoundary, c.executionBoundaryText, <SafetyCertificateOutlined />]].map(([title, text, icon], index) => (
          <article key={String(title)}><span>{icon}</span><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p></article>
        ))}
      </section>
    </>
  );

  const strategyView = (
    <>
      <section className="crypto-strategy-intro">
        <div className="crypto-strategy-intro__copy"><span>01 / MANDATE</span><h2>{c.strategyMandate}</h2><p>{c.strategyMandateText}</p></div>
        <div className="crypto-strategy-badge"><span>{strategyBadgeLabel}</span><strong>BTC · ETH</strong><small>SPOT ONLY</small></div>
      </section>
      <section className="crypto-exit-risk" role="note" aria-label={c.exitRiskTitle}><WarningOutlined /><div><strong>{c.exitRiskTitle}</strong><p>{c.exitRiskText}</p></div></section>
      <section className="crypto-method-grid">
        <article><span>{c.method}</span><h3>{c.trendStack}</h3><p>{c.trendStackText}</p><div className="crypto-signal-diagram"><i /><i /><i /><b /></div></article>
        <article><span>{c.method}</span><h3>{c.liquidityGate}</h3><p>{c.liquidityGateText}</p><div className="crypto-bar-diagram"><i style={{ width: '78%' }} /><i style={{ width: '54%' }} /><i style={{ width: '31%' }} /></div></article>
        <article><span>{c.method}</span><h3>{c.exitGeometry}</h3><p>{c.exitGeometryText}</p><div className="crypto-exit-diagram"><i /><b /><span /></div></article>
      </section>
      <section className="crypto-cost-band">
        <div><span>{c.costModel}</span><h2>{c.honestCosts}</h2></div>
        <dl><div><dt>{c.feeAssumption}</dt><dd>{testFee} bps</dd></div><div><dt>{c.slippageAssumption}</dt><dd>{testSlippage} bps</dd></div><div><dt>{c.roundTrip}</dt><dd>{(testFee + testSlippage) * 2} bps</dd></div></dl>
      </section>
      <section className="crypto-backtest-panel">
        <div className="crypto-panel-heading"><div><span>{c.validation}</span><h2>{c.backtestLab}</h2></div><p>{c.backtestLabNote}</p></div>
        <div className="crypto-backtest-controls">
          <label><span>{c.pairUnderTest}</span><select disabled={!configLoaded || backtestBusy} value={testSymbol} onChange={(event) => { setTestSymbol(event.target.value); invalidateBacktest(); }}>{config.symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select></label>
          <label><span>{c.lookback}</span><select disabled={!configLoaded || backtestBusy} value={testLookback} onChange={(event) => { setTestLookback(Number(event.target.value)); invalidateBacktest(); }}><option value={180}>180D</option><option value={365}>365D</option><option value={400}>400D</option></select></label>
          <label><span>{c.capital}</span><input disabled={!configLoaded || backtestBusy} type="number" min={1000} step={1000} value={testCapital} onChange={(event) => { setTestCapital(Math.max(1000, Number(event.target.value) || 1000)); invalidateBacktest(); }} /></label>
          <label><span>{c.fee}</span><input disabled={!configLoaded || backtestBusy} type="number" min={0} max={100} value={testFee} onChange={(event) => { setTestFee(Math.min(100, Math.max(0, Number(event.target.value) || 0))); invalidateBacktest(); }} /></label>
          <label><span>{c.slippage}</span><input disabled={!configLoaded || backtestBusy} type="number" min={0} max={100} value={testSlippage} onChange={(event) => { setTestSlippage(Math.min(100, Math.max(0, Number(event.target.value) || 0))); invalidateBacktest(); }} /></label>
          <button className="crypto-button is-primary" type="button" onClick={() => void runBacktest()} disabled={backtestBusy || !configLoaded}><ExperimentOutlined />{backtestBusy ? c.backtesting : c.runBacktest}</button>
        </div>
        {backtestError ? (
          <div className="crypto-backtest-error" role="alert">
            <WarningOutlined />
            <div><strong>{c.backtestFailed}</strong><p>{backtestError}</p></div>
            <button type="button" onClick={() => void runBacktest()} disabled={backtestBusy || !configLoaded}>{c.backtestRetry}</button>
          </div>
        ) : backtest ? (
          <div className="crypto-backtest-result">
            <div className="crypto-backtest-chart"><div><span>{backtest.symbols.join(' · ') || c.unknown}</span><small>{formatDate(backtest.from, isZh)} — {formatDate(backtest.to, isZh)}</small></div>{backtest.equityCurve.length > 1 ? <CurveChart points={backtest.equityCurve} ariaLabel={c.backtestLab} tone="violet" /> : <EmptyState title={c.backtestIncomplete} description={c.backtestIncompleteHint} compact />}</div>
            <div className="crypto-backtest-metrics">
              <Metric index="01" label={c.totalReturn} value={formatPct(backtest.totalReturnPct, true)} tone={backtest.totalReturnPct === null ? 'neutral' : backtest.totalReturnPct >= 0 ? 'positive' : 'negative'} />
              <Metric index="02" label={c.benchmark} value={formatPct(backtest.benchmarkReturnPct, true)} />
              <Metric index="03" label={c.maxDrawdown} value={formatPct(backtest.maxDrawdownPct)} tone="warning" />
              <Metric index="04" label={c.sharpe} value={backtest.sharpe === null ? '—' : backtest.sharpe.toFixed(2)} />
              <Metric index="05" label={c.trades} value={backtest.trades === null ? '—' : String(backtest.trades)} />
              <Metric index="06" label={c.costs} value={formatMoney(backtest.totalCosts)} />
            </div>
            {backtest.notes.length ? <ul className="crypto-backtest-notes" aria-label={c.details}>{backtest.notes.map((note, index) => <li key={`${note}-${index}`}><WarningOutlined />{localizeServiceMessage(note, isZh)}</li>)}</ul> : null}
            <div className="crypto-backtest-boundaries">
              <section>
                <strong><SafetyCertificateOutlined />{c.executionConstraints}</strong>
                {backtest.executionConstraints.scope || backtest.executionConstraints.symbol ? <small className="crypto-constraint-scope">{[localizeCryptoEnum(backtest.executionConstraints.scope, isZh, ''), backtest.executionConstraints.symbol].filter(Boolean).join(' · ')}</small> : null}
                {backtest.executionConstraints.applied.length ? (
                  <div className="crypto-applied-constraints">
                    <em>{c.appliedConstraints}</em>
                    <dl>{backtest.executionConstraints.applied.map((constraint) => <div key={constraint.field}><dt>{localizeConstraintField(constraint.field, isZh)}</dt><dd>{formatConstraintValue(constraint.field, constraint.value, isZh)}</dd></div>)}</dl>
                  </div>
                ) : backtest.executionConstraints.represented.length ? <ul>{backtest.executionConstraints.represented.map((constraint, index) => <li key={`${constraint}-${index}`}>{localizeServiceMessage(constraint, isZh)}</li>)}</ul> : null}
                {backtest.executionConstraints.notSimulated.length ? (
                  <div className="crypto-unsimulated-constraints">
                    <em>{c.notSimulated}</em>
                    <ul>{backtest.executionConstraints.notSimulated.map((constraint) => <li key={constraint.field}><b>{localizeConstraintField(constraint.field, isZh)}</b><span>{formatConstraintValue(constraint.field, constraint.value, isZh)}</span>{constraint.reason ? <small>{localizeServiceMessage(constraint.reason, isZh)}</small> : null}</li>)}</ul>
                  </div>
                ) : null}
                {!backtest.executionConstraints.applied.length && !backtest.executionConstraints.represented.length && !backtest.executionConstraints.notSimulated.length ? <p>{c.constraintMetadataMissing}</p> : null}
              </section>
              <section>
                <strong><WarningOutlined />{c.limitations}</strong>
                {backtest.limitations.length ? <ul>{backtest.limitations.map((limitation, index) => <li key={`${limitation}-${index}`}>{localizeServiceMessage(limitation, isZh)}</li>)}</ul> : <p>{c.constraintMetadataMissing}</p>}
              </section>
            </div>
            {(() => {
              const checks = [
                { label: c.netPositive, pass: (backtest.totalReturnPct ?? -Infinity) > 0 },
                { label: c.sharpeGate, pass: (backtest.sharpe ?? -Infinity) >= 0.75 },
                { label: c.calmarGate, pass: (backtest.calmar ?? -Infinity) >= 0.5 },
                { label: c.drawdownGate, pass: backtest.maxDrawdownPct !== null && backtest.maxDrawdownPct <= 20 },
              ];
              const preliminaryPass = checks.every((check) => check.pass);
              return <div className={`crypto-admission ${preliminaryPass ? 'is-pass' : 'is-fail'}`}><div><span>{c.releaseGate}</span><strong>{preliminaryPass ? c.gatePassed : c.gateFailed}</strong><p>{preliminaryPass ? c.gatePassedNote : c.gateFailedNote}</p></div><ul>{checks.map((check) => <li className={check.pass ? 'is-pass' : 'is-fail'} key={check.label}>{check.pass ? <CheckCircleOutlined /> : <WarningOutlined />}{check.label}</li>)}</ul></div>;
            })()}
          </div>
        ) : <EmptyState title={c.noBacktest} description={c.noBacktestHint} />}
      </section>
      <section className="crypto-validation-grid"><article><span>{c.validationRules}</span><ol>{[c.v1, c.v2, c.v3, c.v4].map((rule) => <li key={rule}><CheckCircleOutlined />{rule}</li>)}</ol></article><aside><WarningOutlined /><strong>{c.researchWarning}</strong><p>{c.disclosureText}</p></aside></section>
    </>
  );

  const automationView = (
    <>
      <section className="crypto-exit-risk is-automation" role="note" aria-label={c.exitRiskTitle}><WarningOutlined /><div><strong>{c.exitRiskTitle}</strong><p>{c.exitRiskText}</p></div></section>
      <section className="crypto-automation-grid">
        <article className="crypto-mandate-panel">
          <div className="crypto-panel-heading"><div><span>01 / POLICY</span><h2>{c.operatingMandate}</h2></div><p>{c.operatingNote}</p></div>
          {notice ? <div className="crypto-inline-success" role="status"><CheckCircleOutlined />{notice}</div> : null}
          <div className="crypto-config-grid">
            <fieldset disabled={!configLoaded}><legend>{c.assets}</legend><div className="crypto-choice-row is-assets">{['BTC/USD', 'ETH/USD'].map((symbol) => { const selected = config.symbols.includes(symbol); return <button key={symbol} aria-pressed={selected} className={selected ? 'is-selected' : ''} type="button" onClick={() => patchConfig('symbols', selected ? config.symbols.filter((item) => item !== symbol) : [...config.symbols, symbol])}><span>{symbol.split('/')[0]}</span><small>USD SPOT</small></button>; })}</div></fieldset>
            <fieldset disabled={!configLoaded}><legend>{c.tradeHorizon}</legend><div className="crypto-choice-row is-horizon">{(['short', 'long'] as const).map((horizon) => <button key={horizon} aria-pressed={config.tradeHorizon === horizon} className={config.tradeHorizon === horizon ? 'is-selected' : ''} type="button" onClick={() => setTradeHorizon(horizon)}><span>{horizon === 'short' ? c.shortTerm : c.longTerm}</span><small>{horizon === 'short' ? c.shortTermHint : c.longTermHint}</small></button>)}</div></fieldset>
            <fieldset disabled={!configLoaded}><legend>{c.riskProfile}</legend><div className="crypto-choice-row">{(['conservative', 'balanced', 'aggressive'] as const).map((risk) => <button key={risk} aria-pressed={config.riskProfile === risk} className={config.riskProfile === risk ? 'is-selected' : ''} type="button" onClick={() => patchConfig('riskProfile', risk)}><span>{c[risk]}</span><small>{risk === 'conservative' ? '10% VOL' : risk === 'balanced' ? '15% VOL' : '25% VOL'}</small></button>)}</div></fieldset>
            <label><span>{c.interval}</span><select disabled={!configLoaded} value={config.intervalMinutes} onChange={(event) => patchConfig('intervalMinutes', Number(event.target.value))}>{config.tradeHorizon === 'short' ? <option value={15}>{c.fifteenMinutes}</option> : <><option value={60}>{c.oneHour}</option><option value={120}>{c.twoHours}</option><option value={240}>{c.fourHours}</option></>}</select></label>
            <label><span>{c.maxPortfolio}</span><input disabled={!configLoaded} type="range" min={5} max={75} step={5} value={config.maxPortfolioExposurePct} onChange={(event) => patchConfig('maxPortfolioExposurePct', Number(event.target.value))} /><b>{config.maxPortfolioExposurePct}%</b></label>
            <label><span>{c.maxAsset}</span><input disabled={!configLoaded} type="range" min={5} max={50} step={1} value={config.maxAssetExposurePct} onChange={(event) => patchConfig('maxAssetExposurePct', Number(event.target.value))} /><b>{config.maxAssetExposurePct}%</b></label>
            <label><span>{c.riskPerTrade}</span><input disabled={!configLoaded} type="range" min={0.05} max={2} step={0.05} value={config.riskPerTradePct} onChange={(event) => patchConfig('riskPerTradePct', Number(event.target.value))} /><b>{config.riskPerTradePct.toFixed(2)}%</b></label>
            <label><span>{c.minConfidence}</span><input disabled={!configLoaded} type="range" min={50} max={95} step={1} value={config.minimumConfidence} onChange={(event) => patchConfig('minimumConfidence', Number(event.target.value))} /><b>{config.minimumConfidence}%</b></label>
            <div className="crypto-readonly-setting"><span><strong>{c.aiReview}</strong><small>{overview?.ai.configured ? `${c.aiConnected} · ${[overview.ai.provider, overview.ai.model].filter(Boolean).join(' / ')}` : c.aiNotConfigured}</small></span><StatusPill tone={overview?.ai.configured ? 'positive' : 'warning'}>{overview?.ai.configured ? localizeCryptoEnum(overview.ai.status, isZh, c.eligible) : c.unverified}</StatusPill></div>
            <div className="crypto-learning-setting">
              <span><strong>{c.paperLearning}</strong><small>{c.paperLearningHint}</small></span>
              <label className="crypto-learning-toggle"><input type="checkbox" disabled={!configLoaded || apiMode !== 'paper' || config.tradeHorizon === 'short'} checked={apiMode === 'paper' && config.tradeHorizon !== 'short' && config.paperLearningEnabled} onChange={(event) => patchConfig('paperLearningEnabled', event.target.checked)} /><span>{config.paperLearningEnabled && config.tradeHorizon !== 'short' ? c.switchOn : c.switchReady}</span></label>
              <label><span>{c.calibrationCadence}</span><select disabled={!configLoaded || apiMode !== 'paper' || config.tradeHorizon === 'short'} value={config.calibrationEveryCycles} onChange={(event) => patchConfig('calibrationEveryCycles', Number(event.target.value) as 12 | 24 | 48 | 168)}><option value={12}>12 {c.cycles}</option><option value={24}>24 {c.cycles}</option><option value={48}>48 {c.cycles}</option><option value={168}>168 {c.cycles}</option></select></label>
              <button className="crypto-button is-secondary" type="button" disabled={!configLoaded || apiMode !== 'paper' || config.tradeHorizon === 'short' || calibrationBusy} onClick={() => void runCalibration()}><ExperimentOutlined />{calibrationBusy ? c.calibrating : c.runCalibration}</button>
              {config.tradeHorizon === 'short' ? <small className="crypto-learning-note">{c.shortLearningPaused}</small> : null}
              {runtime?.calibration.lastRun ? <small>{runtime.calibration.applied ? c.calibrationApplied : c.calibrationHeld} · {runtime.calibration.symbol} · {runtime.calibration.champion} · {runtime.calibration.completedRuns} {c.calibrationRuns} · {formatDate(runtime.calibration.lastRun, isZh, true)}</small> : null}
              {strategyLibrary.some((item) => item.role === 'paper_challenger') ? <div className="crypto-research-library"><b>{c.researchLibrary}</b>{strategyLibrary.filter((item) => item.role === 'paper_challenger').map((item) => item.source.url ? <a href={item.source.url} target="_blank" rel="noreferrer" title={item.source.concept} key={item.id}>{item.name}</a> : <span key={item.id}>{item.name}</span>)}</div> : null}
            </div>
          </div>
          <div className="crypto-config-footer"><span>{config.symbols.length} {c.universe.toLowerCase()} · {config.tradeHorizon === 'short' ? c.shortTerm : c.longTerm} · {config.intervalMinutes}m · {c[config.riskProfile]}</span><button className="crypto-button is-primary" type="button" disabled={saving || !configLoaded || !config.symbols.length} onClick={() => void saveConfig()}><SettingOutlined />{saving ? c.saving : c.save}</button></div>
        </article>
        <aside className="crypto-scheduler-panel">
          <div className="crypto-panel-heading is-dark"><div><span>02 / SCHEDULER</span><h2>{c.scheduler}</h2></div><StatusPill tone={schedulerUnhealthy || automation.killSwitch || automation.locked ? 'negative' : automation.enabled ? 'positive' : signalTone(automation.status)}>{localizeCryptoEnum(schedulerUnhealthy ? runtime?.schedulerStatus || 'unhealthy' : automation.killSwitch ? 'killed' : automation.locked ? 'locked' : automation.status, isZh, c.unknown)}</StatusPill></div>
          <p>{c.schedulerNote}</p>
          <div className="crypto-scheduler-primary"><span><small>{c.status}</small><strong>{localizeCryptoEnum(runtime?.status || automation.status, isZh, c.runtimeUnknown)}</strong></span><span><small>{c.currentStage}</small><strong>{localizeCryptoEnum(runtime?.currentStage, isZh, c.notAvailable)}</strong></span></div>
          <div className="crypto-progress" role="progressbar" aria-label={c.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={runtime?.progress ?? undefined}><i style={{ width: `${Math.max(0, Math.min(100, runtime?.progress ?? 0))}%` }} /><span className="sr-only">{runtime?.progress === null || runtime?.progress === undefined ? c.notAvailable : `${runtime.progress}%`}</span></div>
          <dl><div><dt>{c.schedulerHealth}</dt><dd className={runtime?.schedulerHealthy === true ? 'is-positive' : runtime?.schedulerHealthy === false ? 'is-negative' : ''}>{localizeCryptoEnum(runtime?.schedulerStatus, isZh, c.unknown)}</dd></div>{runtime?.runId ? <div><dt>{c.runId}</dt><dd>{runtime.runId}</dd></div> : null}<div><dt>{c.heartbeat}</dt><dd>{formatDate(runtime?.lastHeartbeat ?? null, isZh, true)}</dd></div><div><dt>{c.nextRun}</dt><dd>{formatDate(runtime?.nextRun ?? automation.nextRun, isZh)}</dd></div><div><dt>{c.lastRun}</dt><dd>{formatDate(automation.lastRun, isZh)}</dd></div>{runtime?.cooldownUntil ? <div><dt>{c.cooldownUntil}</dt><dd>{formatDate(runtime.cooldownUntil, isZh, true)}</dd></div> : null}</dl>
          {!runtime || (!runtime.status && !runtime.lastHeartbeat && !runtime.message) ? <div className="crypto-runtime-empty" role="status">{c.noRuntime}</div> : null}
          {runtime?.message ? <div className="crypto-runtime-message" role="status"><WarningOutlined />{localizeServiceMessage(runtime.message, isZh)}</div> : null}
          {runtime?.schedulerMessage && !schedulerUnhealthy ? <div className="crypto-runtime-message" role="status"><WarningOutlined />{localizeServiceMessage(runtime.schedulerMessage, isZh)}</div> : null}
          {runtime?.manualReviewRequired ? (
            <div className="crypto-live-authorization is-risk-review">
              <div><WarningOutlined /><span><strong>{c.manualReview}</strong><small>{c.manualReviewText}</small></span></div>
              {confirmRiskRestart ? (
                <div className="crypto-live-authorization__confirm">
                  <strong>{c.riskRestartConfirm}</strong>
                  <p>{c.riskRestartConfirmText}</p>
                  <span><button type="button" onClick={() => setConfirmRiskRestart(false)} disabled={automationBusy}>{c.cancel}</button><button className="is-authorize" type="button" onClick={() => void setAutomation(true, true)} disabled={automationBusy || !configLoaded || !brokerReady || liveBlocked || !schedulerReady}>{automationBusy ? c.starting : c.acknowledgeRestart}</button></span>
                </div>
              ) : <button type="button" onClick={() => setConfirmRiskRestart(true)} disabled={!configLoaded || !brokerReady || liveBlocked || !schedulerReady}>{c.reviewRestart}</button>}
            </div>
          ) : null}
          {liveAdmissionMissing ? <div className="crypto-live-lock"><SafetyCertificateOutlined /><span><strong>{c.admissionStatus}: {c.paperOnlyStatus}</strong><small>{c.admissionLocked}</small></span></div> : null}
          {liveEligibilityUnknown ? <div className="crypto-live-lock"><WarningOutlined /><span><strong>{c.liveLocked}</strong><small>{c.liveLockedText}</small></span></div> : null}
          {liveAuthorizationMissing ? (
            <div className="crypto-live-authorization">
              <div><SafetyCertificateOutlined /><span><strong>{c.liveAuthorizationRequired}</strong><small>{c.liveAuthorizationText}</small></span></div>
              {confirmLiveAuth ? (
                <div className="crypto-live-authorization__confirm">
                  <strong>{c.authorizeConfirm}</strong>
                  <p>{c.authorizeConfirmText}</p>
                  <span><button type="button" onClick={() => setConfirmLiveAuth(false)} disabled={liveAuthBusy}>{c.cancel}</button><button className="is-authorize" type="button" onClick={() => void authorizeLiveAutomation()} disabled={liveAuthBusy || !configLoaded || !brokerReady}>{liveAuthBusy ? c.authorizing : c.authorize}</button></span>
                </div>
              ) : <button type="button" onClick={() => setConfirmLiveAuth(true)} disabled={!configLoaded || !brokerReady}>{c.authorizeLive}</button>}
            </div>
          ) : null}
          <button className={`crypto-button is-wide ${automation.enabled ? 'is-secondary-dark' : 'is-primary-light'}`} type="button" onClick={() => runtime?.manualReviewRequired && !automation.enabled ? setConfirmRiskRestart(true) : void setAutomation(!automation.enabled)} disabled={automationBusy || automation.killSwitch || (!automation.enabled && (!schedulerReady || !configLoaded || !brokerReady || !liveEligible || (automation.locked && !runtime?.manualReviewRequired)))}>{automation.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}{automationBusy ? (automation.enabled ? c.stopping : c.starting) : automation.enabled ? c.stop : apiMode === 'live' ? c.startLive : c.start}</button>
        </aside>
      </section>
      <section className={`crypto-kill-panel ${automation.killSwitch ? 'is-engaged' : ''}`}>
        <div><span><StopOutlined /></span><div><small>03 / EMERGENCY CONTROL</small><h2>{c.killSwitch}</h2><p>{c.killDescription}</p></div></div>
        {confirmKill && !automation.killSwitch ? <div className="crypto-kill-confirm"><span><strong>{c.confirmKill}</strong><small>{c.confirmKillText}</small></span><button type="button" onClick={() => setConfirmKill(false)}>{c.cancel}</button><button className="is-danger" type="button" onClick={() => void toggleKillSwitch()} disabled={killBusy}>{c.confirm}</button></div> : <button className={automation.killSwitch ? 'is-release' : ''} type="button" onClick={() => automation.killSwitch ? void toggleKillSwitch() : setConfirmKill(true)} disabled={killBusy}>{automation.killSwitch ? <PlayCircleOutlined /> : <StopOutlined />}{automation.killSwitch ? c.releaseKill : c.engageKill}</button>}
      </section>
      <section className="crypto-control-list"><div><span>04 / RISK CONTROLS</span><h2>{c.controls}</h2></div><ol>{[c.c1, c.c2, c.c3, c.c4, c.c5, c.c6].map((control, index) => <li key={control}><span>{String(index + 1).padStart(2, '0')}</span><CheckCircleOutlined /><p>{control}</p></li>)}</ol></section>
    </>
  );

  const ledgerView = (
    <section className="crypto-ledger-panel">
      <div className="crypto-panel-heading"><div><span>01 / AUDIT</span><h2>{c.auditLedger}</h2></div><p>{filteredLedger.length} {c.shown} · {ledger.length} {c.loaded}</p></div>
      <div className="crypto-ledger-toolbar">
        <div className="crypto-ledger-filters">{(['all', 'decision', 'order', 'risk', 'operator'] as const).map((filter) => <button key={filter} aria-pressed={ledgerFilter === filter} className={ledgerFilter === filter ? 'is-active' : ''} type="button" onClick={() => setLedgerFilter(filter)}>{filter === 'all' ? c.all : filter === 'decision' ? c.decisions : filter === 'order' ? c.orders : filter === 'risk' ? c.risk : c.operator}</button>)}</div>
        <div><label><span className="sr-only">{c.filterPlaceholder}</span><input type="search" placeholder={c.filterPlaceholder} value={ledgerQuery} onChange={(event) => setLedgerQuery(event.target.value)} /></label><button className="crypto-button is-secondary" type="button" onClick={exportLedger} disabled={!filteredLedger.length}><AuditOutlined />{c.export}</button></div>
      </div>
      <div className={`crypto-ledger-scope${ledgerScan.scanTruncated ? ' is-truncated' : ''}`} role={ledgerScan.scanTruncated ? 'alert' : 'note'}>
        <span>{c.ledgerLimit}</span>
        {ledgerScan.scannedRows !== null || ledgerScan.scannedPages !== null ? <small>{c.ledgerScan}: {ledgerScan.scannedRows ?? '—'} {c.ledgerRows} · {ledgerScan.scannedPages ?? '—'} {c.ledgerPages}</small> : null}
        {ledgerScan.scanTruncated ? <strong>{c.ledgerTruncated}</strong> : null}
      </div>
      {loading ? <div className="crypto-loading-table" role="status" aria-label={c.refresh}>{Array.from({ length: 6 }).map((_, index) => <span key={index} />)}</div> : filteredLedger.length ? (
        <div className="crypto-table-scroll" role="region" aria-label={c.auditLedger} tabIndex={0}>
          <div className="crypto-ledger-table" role="table" aria-label={c.auditLedger} aria-colcount={8} aria-rowcount={filteredLedger.length + 1}>
            <div role="rowgroup">
              <div className="crypto-ledger-table__head" role="row"><span role="columnheader">{c.time}</span><span role="columnheader">{c.event}</span><span role="columnheader">{c.action}</span><span role="columnheader">{c.mode}</span><span role="columnheader">{c.qtyPrice}</span><span role="columnheader">{c.result}</span><span role="columnheader">{c.source}</span><span role="columnheader">{c.details}</span></div>
            </div>
            <div role="rowgroup">
              {filteredLedger.map((record) => (
                <div className="crypto-ledger-row" role="row" key={record.id}>
                  <time role="cell" dateTime={record.createdAt ?? undefined}>{formatDate(record.createdAt, isZh, true)}</time>
                  <span role="cell"><b>{localizeCryptoEnum(record.type, isZh, c.unknown)}</b><small>{record.symbol || '—'}</small></span>
                  <strong role="cell">{localizeCryptoEnum(record.action, isZh, '—')}</strong>
                  <span role="cell"><StatusPill tone={record.mode.toLowerCase().includes('live') ? 'warning' : 'neutral'}>{localizeCryptoEnum(record.mode, isZh, '—')}</StatusPill></span>
                  <span className="crypto-tabular" role="cell">{record.quantity === null ? '—' : record.quantity.toFixed(6)}<small>{formatPrice(record.price)}</small></span>
                  <span role="cell"><StatusPill tone={signalTone(record.status)}>{localizeCryptoEnum(record.status, isZh, '—')}</StatusPill></span>
                  <span role="cell">{record.source || '—'}</span>
                  <div role="cell"><details><summary>{c.technicalRecord}</summary><p>{record.reason || c.notAvailable}</p>{record.confidence !== null ? <small>{c.confidence}: {formatPct(record.confidence)}</small> : null}</details></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : <EmptyState title={c.noLedger} description={c.noLedgerHint} />}
    </section>
  );

  return (
    <main className={`crypto-page crypto-page--${view}`}>
      {pageHero}
      {notices}
      {view === 'command' ? commandView : view === 'strategy' ? strategyView : view === 'automation' ? automationView : ledgerView}
      <footer className="crypto-disclosure"><WarningOutlined /><div><strong>{c.disclosure}</strong><p>{c.disclosureText}</p></div><span>ALPHALAB · CRYPTO RISK STANDARD 01</span></footer>
    </main>
  );
};

export default Crypto;
