import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  Progress,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import { scannerApi } from '../services/api';
import { scannerStateStore } from '../services/scannerStateStore';
import {
  backtestForSymbolPath,
  marketSymbolPath,
  rememberMarketSymbol,
} from '../routes/marketRoutes';
import './MarketEditorial.css';

const SETTINGS_KEY = 'alpha_lab_market_scanner_settings_v4';
const SESSION_KEY = 'alpha_lab_market_scanner_view_v1';

type ScannerUniverse = 'alpaca_market';

interface ScannerFilters {
  minPrice: number;
  minMarketCap: number;
  minDollarVolume: number;
  minHistoryDays: number;
  maxAtrPercent: number;
  maxRealizedVol20: number;
}

interface ScannerSettings {
  universe: ScannerUniverse;
  maxSymbols: number;
  maxResults: number;
  aiReviewTopN: number;
  historyPeriod: string;
  filters: ScannerFilters;
}

interface ScannerResult {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  exchange?: string;
  exchangeName?: string;
  universe?: string;
  selectionScore?: number;
  selectionLabel?: string;
  scoreReliability?: number;
  factorAgreementPct?: number;
  factorCoveragePct?: number;
  directionScore?: number;
  trendLabel?: string;
  trendScore?: number;
  trendConfidence?: number;
  price?: number;
  changePct?: number;
  volume?: number;
  previousClose?: number;
  dayOpen?: number;
  dayHigh?: number;
  dayLow?: number;
  dayVWAP?: number;
  bidPrice?: number;
  askPrice?: number;
  bidAskSpreadPct?: number;
  avgDollarVolume20?: number;
  volumeRatio?: number;
  marketCap?: number;
  tradable?: boolean;
  marginable?: boolean;
  shortable?: boolean;
  easyToBorrow?: boolean;
  fractionable?: boolean;
  momentum1m?: number;
  momentum3m?: number;
  momentum6m?: number;
  momentum12m?: number;
  relativeStrength3m?: number;
  relativeStrength6m?: number;
  marketBeta?: number;
  marketCorrelation?: number;
  sectorBenchmarkSymbol?: string;
  sectorRelativeStrength3m?: number;
  sectorRank?: number;
  sectorCount?: number;
  closeVs50dma?: number;
  closeVs200dma?: number;
  realizedVol20?: number;
  atrPercent?: number;
  maxDrawdown126?: number;
  spreadBps?: number;
  estimatedRoundTripCostBps?: number;
  capacityScore?: number;
  liquidityTier?: string;
  participation10pctDollar?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  epsGrowthForward?: number;
  beta?: number;
  dividendYield?: number;
  analystRating?: string;
  nextEarningsDate?: string;
  daysToEarnings?: number;
  earningsHour?: string;
  shortVolumeRatio?: number;
  shortVolumeDate?: string;
  crowdingRisk?: string;
  optionContractsSampled?: number;
  avgCallIV?: number;
  avgPutIV?: number;
  optionIvSkew?: number;
  newsCount?: number;
  newsSentiment?: string;
  eventRisk?: string;
  eventTags?: string[];
  topNewsHeadline?: string;
  topNewsSource?: string;
  topNewsUrl?: string;
  latestNewsTime?: string;
  scannerReason?: string;
  ruleScannerReason?: string;
  aiCalled?: boolean;
  aiSuccess?: boolean;
  aiTraderDecision?: 'Advance' | 'Watch' | 'Avoid' | string;
  aiTraderConfidence?: number;
  aiTraderRationale?: string;
  aiRiskFlags?: string[];
  aiContradictions?: string[];
  aiMissingChecks?: string[];
  aiNextStep?: string;
  factorScores?: {
    momentum?: number;
    trend?: number;
    relative?: number;
    liquidity?: number;
    risk?: number;
  };
}

interface ScannerSummary {
  universe?: string;
  universeSource?: string;
  rawUniverseCount?: number;
  universeScanned?: number;
  passedInvestability?: number;
  filteredOut?: number;
  failedData?: number;
  resultsCount?: number;
  bullishCount?: number;
  bearishCount?: number;
  neutralCount?: number;
  strongTrendCount?: number;
  priorityACount?: number;
  reliableCount?: number;
  factorConflictCount?: number;
  lastScanTime?: number;
  filteredReasons?: Record<string, number>;
  weights?: Record<string, number>;
  dataSource?: string;
  finnhubStatus?: string;
  finnhubEnrichment?: {
    configured?: boolean;
    profileEnriched?: number;
    metricsEnriched?: number;
    ratingsEnriched?: number;
    preflightStatus?: string;
  };
  benchmarkEnrichment?: {
    symbolsAvailable?: number;
    benchmarkTrend?: string;
  };
  sectorEnrichment?: {
    symbolsWithSectorBenchmark?: number;
    symbolsWithSectorRank?: number;
  };
  newsEnrichment?: {
    source?: string;
    symbolsWithNews?: number;
    articlesFetched?: number;
  };
  earningsEnrichment?: {
    symbolsWithEarnings?: number;
  };
  shortVolumeEnrichment?: {
    symbolsWithShortVolume?: number;
  };
  optionsEnrichment?: {
    symbolsWithOptions?: number;
    maxSymbols?: number;
  };
  aiReview?: {
    configured?: boolean;
    used?: boolean;
    status?: string;
    provider?: string;
    model?: string;
    requestedSymbols?: number;
    reviewedSymbols?: number;
    error?: string;
  };
}

interface PersistedScannerView {
  results: ScannerResult[];
  summary: ScannerSummary | null;
  lastDuration: number | null;
}

type ScannerErrorCategory = 'session' | 'configuration' | 'rateLimit' | 'timeout' | 'network' | 'generic';

const scannerErrorDetail = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return scannerErrorDetail(
    record.response?.data?.detail
    ?? record.response?.data?.error
    ?? record.response?.data?.message
    ?? record.detail
    ?? record.error
    ?? record.message,
  );
};

const scannerErrorCategory = (value: unknown): ScannerErrorCategory => {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const status = Number(record.response?.status ?? record.statusCode ?? record.status);
  const detail = scannerErrorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid|parameter/.test(detail)) return 'configuration';
  return 'generic';
};

const defaultSettings: ScannerSettings = {
  universe: 'alpaca_market',
  maxSymbols: 1500,
  maxResults: 100,
  aiReviewTopN: 100,
  historyPeriod: '18mo',
  filters: {
    minPrice: 5,
    minMarketCap: 0,
    minDollarVolume: 10_000_000,
    minHistoryDays: 252,
    maxAtrPercent: 12,
    maxRealizedVol20: 120,
  },
};

const defaultWeights = {
  momentum: 0.3,
  trend: 0.2,
  relative: 0.2,
  liquidity: 0.15,
  risk: 0.15,
};

const copy = {
  en: {
    kicker: 'Cross-sectional research desk',
    title: 'Market scanner',
    subtitle: 'Rank the liquid US equity universe with deterministic factors, investability gates, and a separate AI challenge layer.',
    reset: 'Reset filters',
    run: 'Run market scan',
    scanning: 'Scanning market',
    filterTitle: 'Research mandate',
    filterNote: 'Changes are saved automatically for your next scan.',
    universe: 'Universe',
    scanCap: 'Scan cap',
    output: 'Output',
    minPrice: 'Minimum price',
    history: 'History days',
    minAdv: 'Minimum ADV20',
    minMarketCap: 'Minimum market cap',
    maxAtr: 'Maximum ATR',
    maxVol: 'Maximum Vol20',
    aiReview: 'AI review',
    universeValue: 'Alpaca US equities',
    rawUniverse: 'Raw universe',
    scanned: 'Scanned',
    investable: 'Investable',
    candidates: 'Candidates',
    bullish: 'Bullish',
    runtime: 'Runtime',
    liveAnalysis: 'Scan intelligence',
    awaitingRun: 'Awaiting first scan',
    completed: 'Last completed',
    dailyBreadth: 'Daily breadth',
    advancing: 'Advancing',
    declining: 'Declining',
    validMoves: 'valid moves',
    scoreDistribution: 'Score distribution',
    noScores: 'No score data yet',
    factorMandate: 'Factor mandate',
    sectorParticipation: 'Sector participation',
    noSector: 'No sector coverage yet',
    resultKicker: 'Ranked research universe',
    resultTitle: 'Candidate ledger',
    resultNote: 'Core decision fields stay visible. Open a row for provenance, overlays, and execution context.',
    symbol: 'Candidate',
    score: 'Research score',
    signal: 'Directional signal',
    liquidity: 'Liquidity',
    risk: 'Risk / event',
    ai: 'AI challenge',
    actions: 'Actions',
    analyze: 'Analyze',
    backtest: 'Backtest',
    emptyTitle: 'No ranked candidates yet',
    emptyBody: 'Run the market scanner to build a real, investability-filtered shortlist.',
    snapshot: 'Market snapshot',
    factors: 'Factor evidence',
    relative: 'Relative structure',
    friction: 'Risk and trading friction',
    rationale: 'Research rationale',
    aiReviewTitle: 'AI challenge record',
    news: 'Event and news context',
    source: 'Data coverage',
    filtered: 'filtered',
    failed: 'data failures',
    notReviewed: 'Rules only',
    noData: 'Not available',
    scannerComplete: 'Market scan completed',
    scannerFailed: 'Market scan failed',
    errorSession: 'Your session is no longer valid. Sign in again, then rerun the scan.',
    errorConfiguration: 'The scanner configuration or market-data setup is incomplete or invalid.',
    errorRateLimit: 'The market-data service is rate limiting requests. Wait a moment, then retry.',
    errorTimeout: 'The market scan timed out. Reduce the scan size or try again shortly.',
    errorNetwork: 'The scanner service could not be reached. Check the network and backend status.',
    errorGeneric: 'The market scan could not be completed. Try again shortly.',
    errorDetail: 'Detail',
    lastSession: 'Restored from this session',
    progressTitle: 'Market scan in progress',
    progressEstimated: 'Estimated progress',
    progressElapsed: 'Elapsed',
    progressNote: 'Stage and percentage are estimated from elapsed time; results appear only after the server completes the scan.',
    tradable: 'Tradable',
    shortable: 'Shortable',
    fractionable: 'Fractional shares',
    easyBorrow: 'Easy to borrow',
    price: 'Price',
    dayMove: 'Day move',
    dayRange: 'Day range',
    bidAsk: 'Bid / ask',
    marketCap: 'Market cap',
    exchange: 'Exchange',
    reliability: 'Reliability',
    agreement: 'Agreement',
    coverage: 'Coverage',
    momentum13: 'Momentum 1M / 3M',
    momentum612: 'Momentum 6M / 12M',
    spyRelative: 'SPY relative 3M',
    movingAverages: '50DMA / 200DMA',
    betaCorrelation: 'Market beta / corr',
    sectorRank: 'Sector rank',
    spreadRoundTrip: 'Spread / round trip',
    drawdown126: '126D drawdown',
    capacity10: '10% ADV capacity',
    nextEarnings: 'Next earnings',
    shortFlow: 'FINRA short flow',
    ivSkew: 'Options IV skew',
    newsItems: 'news',
    riskWord: 'risk',
    reliable: 'reliable',
    confidence: 'confidence',
    volume: 'Vol',
    tierUnavailable: 'Tier —',
    noEvent: 'No event signal',
    eventWord: 'event',
    earningsIn: 'Earnings {days}d',
    noNearEarnings: 'No near earnings',
    usEquity: 'US Equity',
    collapseDetail: 'Collapse detail',
    expandDetail: 'Expand detail',
    scannerSummary: 'Market scanner summary',
    filtersSection: 'Filters',
    analysisSection: 'Analysis',
    modePaper: 'Paper mode',
    modeReal: 'Live mode',
    top: 'Top',
    strong: 'strong',
    benchmarkCoverage: 'Benchmarks',
    newsCoverage: 'News',
    finraCoverage: 'FINRA short volume',
    optionsCoverage: 'Options',
    aiCoverage: 'AI reviewed',
    progressStages: [
      'Loading the Alpaca universe',
      'Ranking liquidity and loading price history',
      'Applying investability gates and factor scores',
      'Adding market, event, and risk context',
      'Ranking candidates and completing AI review',
    ],
  },
  zh: {
    kicker: '横截面研究工作台',
    title: '市场扫描器',
    subtitle: '以确定性因子、可投资性门槛和独立 AI 复核层，对美股流动性标的进行专业排序。',
    reset: '重置筛选',
    run: '运行市场扫描',
    scanning: '正在扫描市场',
    filterTitle: '研究条件',
    filterNote: '所有改动都会自动保存，供下一次扫描使用。',
    universe: '标的范围',
    scanCap: '扫描上限',
    output: '结果数量',
    minPrice: '最低价格',
    history: '历史天数',
    minAdv: '最低 ADV20',
    minMarketCap: '最低市值',
    maxAtr: '最高 ATR',
    maxVol: '最高 Vol20',
    aiReview: 'AI 复核数量',
    universeValue: 'Alpaca 美国股票',
    rawUniverse: '原始标的',
    scanned: '已扫描',
    investable: '通过筛选',
    candidates: '候选标的',
    bullish: '看涨标的',
    runtime: '运行时间',
    liveAnalysis: '扫描洞察',
    awaitingRun: '等待首次扫描',
    completed: '最近完成',
    dailyBreadth: '当日市场宽度',
    advancing: '上涨',
    declining: '下跌',
    validMoves: '有效涨跌',
    scoreDistribution: '评分分布',
    noScores: '暂无评分数据',
    factorMandate: '因子权重',
    sectorParticipation: '行业分布',
    noSector: '暂无行业覆盖',
    resultKicker: '研究候选排序',
    resultTitle: '候选标的清单',
    resultNote: '核心决策字段保持可见；展开任意行可查看数据来源、覆盖信息和交易执行背景。',
    symbol: '候选标的',
    score: '研究评分',
    signal: '方向信号',
    liquidity: '流动性',
    risk: '风险 / 事件',
    ai: 'AI 复核',
    actions: '操作',
    analyze: '分析',
    backtest: '回测',
    emptyTitle: '暂无排序候选标的',
    emptyBody: '运行市场扫描，生成基于真实数据和可投资性筛选的候选清单。',
    snapshot: '市场快照',
    factors: '因子证据',
    relative: '相对结构',
    friction: '风险与交易摩擦',
    rationale: '研究依据',
    aiReviewTitle: 'AI 复核记录',
    news: '事件与新闻背景',
    source: '数据覆盖',
    filtered: '个被筛除',
    failed: '个数据失败',
    notReviewed: '仅规则判断',
    noData: '暂无数据',
    scannerComplete: '市场扫描已完成',
    scannerFailed: '市场扫描失败',
    errorSession: '登录会话已失效，请重新登录后再运行扫描。',
    errorConfiguration: '扫描条件或行情数据配置不完整，请检查设置。',
    errorRateLimit: '行情服务请求过于频繁，请稍等片刻后重试。',
    errorTimeout: '市场扫描等待超时，请缩小扫描范围或稍后重试。',
    errorNetwork: '暂时无法连接扫描服务，请检查网络和后台状态。',
    errorGeneric: '市场扫描暂时无法完成，请稍后重试。',
    errorDetail: '详情',
    lastSession: '已恢复本次会话数据',
    progressTitle: '市场扫描进行中',
    progressEstimated: '估算进度',
    progressElapsed: '已用时间',
    progressNote: '阶段和百分比根据已用时间估算；服务器完成扫描后才会显示最终结果。',
    tradable: '可交易',
    shortable: '可卖空',
    fractionable: '支持碎股',
    easyBorrow: '易借券',
    price: '价格',
    dayMove: '当日涨跌',
    dayRange: '当日区间',
    bidAsk: '买价 / 卖价',
    marketCap: '市值',
    exchange: '交易所',
    reliability: '可靠度',
    agreement: '因子一致度',
    coverage: '数据覆盖',
    momentum13: '1 个月 / 3 个月动量',
    momentum612: '6 个月 / 12 个月动量',
    spyRelative: '相对 SPY 三个月表现',
    movingAverages: '相对 50 / 200 日均线',
    betaCorrelation: '市场 Beta / 相关性',
    sectorRank: '行业排名',
    spreadRoundTrip: '价差 / 往返成本',
    drawdown126: '126 日回撤',
    capacity10: '10% ADV 容量',
    nextEarnings: '下次财报',
    shortFlow: 'FINRA 做空流量',
    ivSkew: '期权隐波偏斜',
    newsItems: '条新闻',
    riskWord: '风险',
    reliable: '可靠度',
    confidence: '置信度',
    volume: '成交量',
    tierUnavailable: '等级 —',
    noEvent: '暂无事件信号',
    eventWord: '事件',
    earningsIn: '财报还有 {days} 天',
    noNearEarnings: '近期无财报',
    usEquity: '美国股票',
    collapseDetail: '收起详情',
    expandDetail: '展开详情',
    scannerSummary: '市场扫描摘要',
    filtersSection: '筛选条件',
    analysisSection: '扫描分析',
    modePaper: '模拟模式',
    modeReal: '实盘模式',
    top: '前',
    strong: '个强趋势',
    benchmarkCoverage: '基准数据',
    newsCoverage: '新闻',
    finraCoverage: 'FINRA 做空流量',
    optionsCoverage: '期权',
    aiCoverage: 'AI 已审核',
    progressStages: [
      '正在载入 Alpaca 标的范围',
      '正在进行流动性排序并载入价格历史',
      '正在应用可投资性门槛与因子评分',
      '正在补充市场、事件与风险信息',
      '正在排序候选标的并完成 AI 复核',
    ],
  },
} as const;

const factorLabels = {
  momentum: { en: 'Momentum', zh: '动量' },
  trend: { en: 'Trend', zh: '趋势' },
  relative: { en: 'Relative', zh: '相对强度' },
  liquidity: { en: 'Liquidity', zh: '流动性' },
  risk: { en: 'Risk', zh: '风险' },
};

const loadSettings = (): ScannerSettings => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
      filters: { ...defaultSettings.filters, ...(parsed.filters || {}) },
    };
  } catch {
    return defaultSettings;
  }
};

const saveSettings = (settings: ScannerSettings) => {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The scanner remains usable when storage is unavailable.
  }
};

const loadPersistedView = (): PersistedScannerView => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { results: [], summary: null, lastDuration: null };
    const parsed = JSON.parse(raw);
    return {
      results: Array.isArray(parsed.results) ? parsed.results : [],
      summary: parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null,
      lastDuration: Number.isFinite(parsed.lastDuration) ? parsed.lastDuration : null,
    };
  } catch {
    return { results: [], summary: null, lastDuration: null };
  }
};

const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const formatElapsed = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const formatRuntime = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
};

const compactMoney = (value?: number | null): string => {
  if (!hasNumber(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const parseCompactMoney = (value?: string): number => {
  const raw = String(value || '').replace(/[$,\s]/g, '').toUpperCase();
  if (!raw) return 0;
  const suffix = raw.slice(-1);
  const multiplier = suffix === 'T' ? 1e12 : suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : suffix === 'K' ? 1e3 : 1;
  const numeric = Number(raw.replace(/[TBMK]$/, ''));
  return Number.isFinite(numeric) ? numeric * multiplier : 0;
};

const compactNumber = (value?: number | null): string => {
  if (!hasNumber(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
};

const signedPct = (value?: number | null, digits = 1): string => {
  if (!hasNumber(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
};

const plainPct = (value?: number | null, digits = 1): string => {
  if (!hasNumber(value)) return '—';
  return `${value.toFixed(digits)}%`;
};

const shortDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const scoreFor = (record: ScannerResult): number | null => {
  if (hasNumber(record.selectionScore)) return record.selectionScore;
  if (hasNumber(record.trendScore)) return record.trendScore;
  return null;
};

const scoreTone = (score?: number | null): string => {
  if (!hasNumber(score)) return 'muted';
  if (score >= 80) return 'strong';
  if (score >= 65) return 'positive';
  if (score >= 50) return 'watch';
  return 'risk';
};

const trendColor = (label?: string): string => {
  if (!label) return 'default';
  if (/strong bullish/i.test(label)) return 'success';
  if (/bullish/i.test(label)) return 'green';
  if (/bearish/i.test(label)) return 'error';
  return 'gold';
};

const aiColor = (decision?: string): string => {
  if (decision === 'Advance') return 'success';
  if (decision === 'Avoid') return 'error';
  if (decision === 'Watch') return 'warning';
  return 'default';
};

const Market: React.FC = () => {
  const navigate = useNavigate();
  const { language, translateSector } = useLanguage();
  const { tradeMode } = useTradeMode();
  const isZh = language === 'zh-CN';
  const c = isZh ? copy.zh : copy.en;
  const formatScannerError = (value: unknown): string => {
    const detail = scannerErrorDetail(value);
    const category = scannerErrorCategory(value);
    const friendly = {
      session: c.errorSession,
      configuration: c.errorConfiguration,
      rateLimit: c.errorRateLimit,
      timeout: c.errorTimeout,
      network: c.errorNetwork,
      generic: c.errorGeneric,
    }[category];
    if (isZh || !detail || detail === friendly) return friendly;
    return `${friendly} ${c.errorDetail}: ${detail}`;
  };
  const localizeEventRisk = (value?: string) => {
    if (!value) return '—';
    if (value === 'Unknown') return isZh ? '未知' : value;
    if (!isZh) return value;
    return ({ High: '高', Medium: '中', Low: '低' } as Record<string, string>)[value] || value;
  };
  const localizeAiDecision = (value?: string) => {
    if (!value || !isZh) return value;
    return ({ Advance: '进入下一步', Watch: '继续观察', Avoid: '回避' } as Record<string, string>)[value] || value;
  };
  const localizeTrend = (value?: string) => {
    if (!value || !isZh) return value;
    return ({
      'Strong Bullish': '强势看涨',
      Bullish: '看涨',
      Neutral: '中性',
      Bearish: '看跌',
      'Strong Bearish': '强势看跌',
    } as Record<string, string>)[value] || value;
  };
  const [initialView] = useState<PersistedScannerView>(() => loadPersistedView());
  const [settings, setSettings] = useState<ScannerSettings>(() => loadSettings());
  const [results, setResults] = useState<ScannerResult[]>(initialView.results);
  const [summary, setSummary] = useState<ScannerSummary | null>(initialView.summary);
  const [lastDuration, setLastDuration] = useState<number | null>(initialView.lastDuration);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [scanElapsed, setScanElapsed] = useState(0);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ results, summary, lastDuration }));
    } catch {
      // Session persistence is an enhancement, not a scanning requirement.
    }
  }, [lastDuration, results, summary]);

  useEffect(() => {
    if (!initialView.results.length) return;
    const stored = scannerStateStore.getState().marketScanner;
    if (stored.results.length) return;
    const restoredAt = new Date().toISOString();
    scannerStateStore.updateMarketScanner({
      status: 'completed',
      lastScanTime: restoredAt,
      progress: 100,
      totalSymbols: initialView.summary?.rawUniverseCount || initialView.results.length,
      scannedSymbols: initialView.summary?.universeScanned || initialView.results.length,
      results: initialView.results,
      currentStatus: c.lastSession,
      detailedScanStatus: {
        ...stored.detailedScanStatus,
        currentStatus: 'completed',
        processedCount: initialView.summary?.universeScanned || initialView.results.length,
        totalCount: initialView.summary?.rawUniverseCount || initialView.results.length,
        validatedCount: initialView.results.length,
        percent: 100,
        lastScanAt: restoredAt,
        statusMessage: c.lastSession,
      },
    });
  }, [c.lastSession, initialView]);

  useEffect(() => {
    if (!loading || scanStartedAt === null) return undefined;
    const updateElapsed = () => setScanElapsed((Date.now() - scanStartedAt) / 1000);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [loading, scanStartedAt]);

  const updateSetting = (patch: Partial<ScannerSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const updateFilter = (key: keyof ScannerFilters, value: number | null) => {
    setSettings((current) => {
      const next = {
        ...current,
        filters: { ...current.filters, [key]: value ?? defaultSettings.filters[key] },
      };
      saveSettings(next);
      return next;
    });
  };

  const resetFilters = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  };

  const runScanner = async () => {
    const started = performance.now();
    try {
      setLoading(true);
      setScanStartedAt(Date.now());
      setScanElapsed(0);
      setError('');
      saveSettings(settings);
      const currentScanner = scannerStateStore.getState().marketScanner;
      scannerStateStore.updateMarketScanner({
        status: 'running',
        progress: 0,
        currentStatus: c.scanning,
        detailedScanStatus: {
          ...currentScanner.detailedScanStatus,
          currentStatus: 'scanning',
          currentStage: 'market_scanner',
          stageLabel: c.scanning,
          stageDetail: c.progressNote,
          startedAt: Date.now(),
          processedCount: 0,
          totalCount: settings.maxSymbols,
          percent: 0,
          statusMessage: c.scanning,
        },
      });
      const response = await scannerApi.post('/market/scanner', {
        ...settings,
        alpacaMode: tradeMode,
      });
      const payload = response.data || {};
      if (!payload.success) throw new Error(payload.message || payload.error || c.scannerFailed);

      const incoming = Array.isArray(payload.results) ? payload.results.filter((row: ScannerResult) => Boolean(row?.symbol)) : [];
      setResults(incoming);
      setSummary(payload.summary || null);
      setLastDuration((performance.now() - started) / 1000);
      const completedAt = new Date().toISOString();
      const completedScanner = scannerStateStore.getState().marketScanner;
      scannerStateStore.updateMarketScanner({
        status: 'completed',
        lastScanTime: completedAt,
        progress: 100,
        totalSymbols: payload.summary?.rawUniverseCount || incoming.length,
        scannedSymbols: payload.summary?.universeScanned || incoming.length,
        results: incoming,
        currentStatus: c.scannerComplete,
        detailedScanStatus: {
          ...completedScanner.detailedScanStatus,
          currentStatus: 'completed',
          currentStage: 'finalize',
          stageLabel: c.scannerComplete,
          stageDetail: payload.message || c.scannerComplete,
          processedCount: payload.summary?.universeScanned || incoming.length,
          totalCount: payload.summary?.rawUniverseCount || incoming.length,
          validatedCount: incoming.length,
          percent: 100,
          lastScanAt: completedAt,
          statusMessage: payload.message || c.scannerComplete,
        },
      });
      message.success(`${c.scannerComplete}: ${incoming.length}`);
    } catch (scanError: any) {
      const detail = formatScannerError(scanError);
      setError(detail);
      const failedScanner = scannerStateStore.getState().marketScanner;
      scannerStateStore.updateMarketScanner({
        status: 'failed',
        currentStatus: detail,
        detailedScanStatus: {
          ...failedScanner.detailedScanStatus,
          currentStatus: 'error',
          stageLabel: c.scannerFailed,
          stageDetail: detail,
          lastFailureReason: detail,
          statusMessage: detail,
        },
      });
      message.error(detail);
    } finally {
      setLoading(false);
      setScanStartedAt(null);
    }
  };

  const displayResults = useMemo(() => results.filter((row) => Boolean(row.symbol)), [results]);

  const breadth = useMemo(() => {
    const moves = displayResults.filter((row) => hasNumber(row.changePct));
    return {
      valid: moves.length,
      advancing: moves.filter((row) => Number(row.changePct) > 0).length,
      declining: moves.filter((row) => Number(row.changePct) < 0).length,
      unchanged: moves.filter((row) => Number(row.changePct) === 0).length,
    };
  }, [displayResults]);

  const bullishCount = useMemo(
    () => displayResults.filter((row) => /bullish/i.test(row.trendLabel || '')).length,
    [displayResults],
  );

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { label: '<50', min: -Infinity, max: 50, count: 0 },
      { label: '50–64', min: 50, max: 65, count: 0 },
      { label: '65–74', min: 65, max: 75, count: 0 },
      { label: '75–84', min: 75, max: 85, count: 0 },
      { label: '85+', min: 85, max: Infinity, count: 0 },
    ];
    displayResults.forEach((row) => {
      const score = scoreFor(row);
      if (!hasNumber(score)) return;
      const bucket = buckets.find((item) => score >= item.min && score < item.max);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [displayResults]);

  const sectorParticipation = useMemo(() => {
    const groups = new Map<string, number>();
    displayResults.forEach((row) => {
      const sector = String(row.sector || '').trim();
      if (sector) groups.set(sector, (groups.get(sector) || 0) + 1);
    });
    return Array.from(groups.entries())
      .map(([label, count]) => ({ label: translateSector(label), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [displayResults, translateSector]);

  const normalizedWeights = useMemo(() => Object.entries(summary?.weights || defaultWeights).map(([key, raw]) => {
    const numeric = Number(raw);
    return {
      key,
      label: factorLabels[key as keyof typeof factorLabels]?.[isZh ? 'zh' : 'en'] || key,
      value: Number.isFinite(numeric) ? (numeric <= 1 ? numeric * 100 : numeric) : 0,
    };
  }), [isZh, summary?.weights]);

  const lastScanLabel = useMemo(() => {
    if (!summary?.lastScanTime) return c.awaitingRun;
    return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }).format(new Date(summary.lastScanTime * 1000));
  }, [c.awaitingRun, isZh, summary?.lastScanTime]);

  const handleAnalyze = (symbol: string) => {
    rememberMarketSymbol(symbol);
    navigate(marketSymbolPath(symbol));
  };

  const handleBacktest = (symbol: string) => {
    navigate(backtestForSymbolPath(symbol), { state: { presetSymbol: symbol } });
  };

  const renderExpandedRow = (record: ScannerResult) => {
    const factors = record.factorScores || {};
    const factorEntries = Object.entries(factors).filter(([, value]) => hasNumber(value));
    const flags = [
      record.tradable ? c.tradable : '',
      record.shortable ? c.shortable : '',
      record.fractionable ? c.fractionable : '',
      record.easyToBorrow ? c.easyBorrow : '',
    ].filter(Boolean);

    return (
      <div className="market-detail">
        <section>
          <h4>{c.snapshot}</h4>
          <dl>
            <div><dt>{c.price}</dt><dd>{hasNumber(record.price) ? `$${record.price.toFixed(2)}` : '—'}</dd></div>
            <div><dt>{c.dayMove}</dt><dd className={Number(record.changePct) >= 0 ? 'is-positive' : 'is-negative'}>{signedPct(record.changePct, 2)}</dd></div>
            <div><dt>{c.dayRange}</dt><dd>{hasNumber(record.dayLow) && hasNumber(record.dayHigh) ? `$${record.dayLow.toFixed(2)} – $${record.dayHigh.toFixed(2)}` : '—'}</dd></div>
            <div><dt>{c.bidAsk}</dt><dd>{hasNumber(record.bidPrice) && hasNumber(record.askPrice) ? `$${record.bidPrice.toFixed(2)} / $${record.askPrice.toFixed(2)}` : '—'}</dd></div>
            <div><dt>{c.marketCap}</dt><dd>{compactMoney(record.marketCap)}</dd></div>
            <div><dt>{c.exchange}</dt><dd>{record.exchangeName || record.exchange || '—'}</dd></div>
          </dl>
          {flags.length > 0 && <div className="market-detail__tags">{flags.map((flag) => <Tag key={flag}>{flag}</Tag>)}</div>}
        </section>

        <section>
          <h4>{c.factors}</h4>
          {factorEntries.length > 0 ? (
            <div className="market-detail__factor-list">
              {factorEntries.map(([key, value]) => (
                <div key={key}>
                  <span>{factorLabels[key as keyof typeof factorLabels]?.[isZh ? 'zh' : 'en'] || key}</span>
                  <b>{Math.round(Number(value))}</b>
                  <Progress percent={Number(value)} showInfo={false} size="small" />
                </div>
              ))}
            </div>
          ) : <p>{c.noData}</p>}
          <div className="market-detail__micro-grid">
            <span>{c.reliability} <b>{hasNumber(record.scoreReliability) ? `${Math.round(record.scoreReliability)}%` : '—'}</b></span>
            <span>{c.agreement} <b>{hasNumber(record.factorAgreementPct) ? `${Math.round(record.factorAgreementPct)}%` : '—'}</b></span>
            <span>{c.coverage} <b>{hasNumber(record.factorCoveragePct) ? `${Math.round(record.factorCoveragePct)}%` : '—'}</b></span>
          </div>
        </section>

        <section>
          <h4>{c.relative}</h4>
          <dl>
            <div><dt>{c.momentum13}</dt><dd>{signedPct(record.momentum1m)} / {signedPct(record.momentum3m)}</dd></div>
            <div><dt>{c.momentum612}</dt><dd>{signedPct(record.momentum6m)} / {signedPct(record.momentum12m)}</dd></div>
            <div><dt>{c.spyRelative}</dt><dd>{signedPct(record.relativeStrength3m)}</dd></div>
            <div><dt>{c.movingAverages}</dt><dd>{signedPct(record.closeVs50dma)} / {signedPct(record.closeVs200dma)}</dd></div>
            <div><dt>{c.betaCorrelation}</dt><dd>{hasNumber(record.marketBeta) ? record.marketBeta.toFixed(2) : '—'} / {hasNumber(record.marketCorrelation) ? record.marketCorrelation.toFixed(2) : '—'}</dd></div>
            <div><dt>{c.sectorRank}</dt><dd>{hasNumber(record.sectorRank) ? `#${record.sectorRank}/${record.sectorCount || '—'}` : '—'}</dd></div>
          </dl>
        </section>

        <section>
          <h4>{c.friction}</h4>
          <dl>
            <div><dt>ADV20</dt><dd>{compactMoney(record.avgDollarVolume20)}</dd></div>
            <div><dt>{c.spreadRoundTrip}</dt><dd>{hasNumber(record.spreadBps) ? `${record.spreadBps.toFixed(1)} bps` : '—'} / {hasNumber(record.estimatedRoundTripCostBps) ? `${record.estimatedRoundTripCostBps.toFixed(1)} bps` : '—'}</dd></div>
            <div><dt>ATR / Vol20</dt><dd>{plainPct(record.atrPercent)} / {plainPct(record.realizedVol20)}</dd></div>
            <div><dt>{c.drawdown126}</dt><dd>{hasNumber(record.maxDrawdown126) ? `-${Math.abs(record.maxDrawdown126).toFixed(1)}%` : '—'}</dd></div>
            <div><dt>{c.capacity10}</dt><dd>{compactMoney(record.participation10pctDollar)}</dd></div>
            <div><dt>{c.nextEarnings}</dt><dd>{shortDate(record.nextEarningsDate)}{hasNumber(record.daysToEarnings) ? ` · ${record.daysToEarnings}${isZh ? '天' : 'd'}` : ''}</dd></div>
            <div><dt>{c.shortFlow}</dt><dd>{plainPct(record.shortVolumeRatio)}</dd></div>
            <div><dt>{c.ivSkew}</dt><dd>{plainPct(record.optionIvSkew)}</dd></div>
          </dl>
        </section>

        <section className="market-detail__narrative">
          <h4>{c.rationale}</h4>
          <p>{record.scannerReason || record.ruleScannerReason || c.noData}</p>
          {(record.aiTraderDecision || record.aiTraderRationale) && (
            <div className="market-detail__ai">
              <div><strong>{c.aiReviewTitle}</strong><Tag color={aiColor(record.aiTraderDecision)}>{localizeAiDecision(record.aiTraderDecision) || c.notReviewed}</Tag>{hasNumber(record.aiTraderConfidence) && <span>{Math.round(record.aiTraderConfidence)}%</span>}</div>
              <p>{record.aiTraderRationale || c.noData}</p>
              {record.aiNextStep && <small>{record.aiNextStep}</small>}
              {record.aiRiskFlags && record.aiRiskFlags.length > 0 && <div className="market-detail__tags">{record.aiRiskFlags.map((flag) => <Tag key={flag}>{flag}</Tag>)}</div>}
            </div>
          )}
          {(record.topNewsHeadline || hasNumber(record.newsCount)) && (
            <div className="market-detail__news">
              <strong>{c.news}</strong>
              <span>{record.newsCount ?? 0} {c.newsItems} · {record.newsSentiment || '—'} · {localizeEventRisk(record.eventRisk)} {c.riskWord}</span>
              {record.topNewsHeadline && (record.topNewsUrl
                ? <a href={record.topNewsUrl} target="_blank" rel="noreferrer">{record.topNewsHeadline}</a>
                : <span>{record.topNewsHeadline}</span>)}
            </div>
          )}
        </section>
      </div>
    );
  };

  const columns: ColumnsType<ScannerResult> = useMemo(() => [
    {
      title: c.symbol,
      dataIndex: 'symbol',
      width: 200,
      sorter: (a, b) => a.symbol.localeCompare(b.symbol),
      render: (_value, record) => (
        <div className="market-candidate">
          <div>
            <strong>{record.symbol}</strong>
            {record.selectionLabel && <span>{record.selectionLabel}</span>}
          </div>
          <p>{record.companyName || record.symbol}</p>
          <small>{record.sector ? translateSector(record.sector) : record.industry || record.exchangeName || c.usEquity}</small>
        </div>
      ),
    },
    {
      title: c.score,
      key: 'score',
      width: 150,
      align: 'right',
      sorter: (a, b) => Number(scoreFor(a) || 0) - Number(scoreFor(b) || 0),
      defaultSortOrder: 'descend',
      render: (_value, record) => {
        const score = scoreFor(record);
        return (
          <div className={`market-score market-score--${scoreTone(score)}`}>
            <div><strong>{hasNumber(score) ? Math.round(score) : '—'}</strong><span>/100</span></div>
            <Progress percent={score || 0} showInfo={false} size="small" />
            <small>{hasNumber(record.scoreReliability) ? `${Math.round(record.scoreReliability)}% ${c.reliable}` : hasNumber(record.trendConfidence) ? `${Math.round(record.trendConfidence * 100)}% ${c.confidence}` : c.noData}</small>
          </div>
        );
      },
    },
    {
      title: c.signal,
      key: 'signal',
      width: 175,
      render: (_value, record) => (
        <div className="market-signal">
          <Tag color={trendColor(record.trendLabel)}>{localizeTrend(record.trendLabel) || c.noData}</Tag>
          <span>1M {signedPct(record.momentum1m)} · 3M {signedPct(record.momentum3m)}</span>
          <small>SPY 3M {signedPct(record.relativeStrength3m)}</small>
        </div>
      ),
    },
    {
      title: c.liquidity,
      key: 'liquidity',
      width: 165,
      align: 'right',
      sorter: (a, b) => Number(a.avgDollarVolume20 || 0) - Number(b.avgDollarVolume20 || 0),
      render: (_value, record) => (
        <div className="market-liquidity">
          <strong>{compactMoney(record.avgDollarVolume20)} ADV</strong>
          <span>{c.volume} {compactNumber(record.volume)}{hasNumber(record.volumeRatio) ? ` · ${record.volumeRatio.toFixed(2)}x` : ''}</span>
          <small>{record.liquidityTier || c.tierUnavailable}{hasNumber(record.estimatedRoundTripCostBps) ? ` · ${record.estimatedRoundTripCostBps.toFixed(1)} bps` : ''}</small>
        </div>
      ),
    },
    {
      title: c.risk,
      key: 'risk',
      width: 165,
      render: (_value, record) => (
        <div className="market-risk">
          <Tag color={record.eventRisk === 'High' ? 'error' : record.eventRisk === 'Medium' ? 'warning' : 'default'}>{record.eventRisk && record.eventRisk !== 'Unknown' ? `${localizeEventRisk(record.eventRisk)} ${c.eventWord}` : c.noEvent}</Tag>
          <span>ATR {plainPct(record.atrPercent)} · Vol {plainPct(record.realizedVol20)}</span>
          <small>{hasNumber(record.daysToEarnings) && record.daysToEarnings >= 0 ? c.earningsIn.replace('{days}', String(record.daysToEarnings)) : c.noNearEarnings}</small>
        </div>
      ),
    },
    {
      title: c.ai,
      key: 'ai',
      width: 230,
      render: (_value, record) => (
        <div className="market-ai-cell">
          <div><Tag color={aiColor(record.aiTraderDecision)}>{record.aiTraderDecision ? `AI ${localizeAiDecision(record.aiTraderDecision)}` : c.notReviewed}</Tag>{hasNumber(record.aiTraderConfidence) && <span>{Math.round(record.aiTraderConfidence)}%</span>}</div>
          <Tooltip title={record.aiTraderRationale || record.scannerReason}>
            <p>{record.aiTraderRationale || record.scannerReason || c.noData}</p>
          </Tooltip>
        </div>
      ),
    },
    {
      title: c.actions,
      key: 'actions',
      width: 175,
      align: 'center',
      render: (_value, record) => (
        <div className="market-row-actions">
          <Button icon={<LineChartOutlined />} onClick={(event) => { event.stopPropagation(); handleAnalyze(record.symbol); }}>{c.analyze}</Button>
          <Button icon={<ExperimentOutlined />} onClick={(event) => { event.stopPropagation(); handleBacktest(record.symbol); }}>{c.backtest}</Button>
        </div>
      ),
    },
  ], [c, isZh, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreMax = Math.max(0, ...scoreDistribution.map((item) => item.count));
  const sectorMax = Math.max(0, ...sectorParticipation.map((item) => item.count));
  const hasSessionData = initialView.results.length > 0;
  const countFormatter = useMemo(
    () => new Intl.NumberFormat(isZh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 0 }),
    [isZh],
  );
  const formatCount = (value: unknown) => hasNumber(value) ? countFormatter.format(value) : undefined;
  const expectedScanSeconds = Math.min(600, Math.max(120, lastDuration || 240));
  const scanProgress = loading
    ? Math.min(94, Math.max(3, Math.round(3 + (scanElapsed / expectedScanSeconds) * 91)))
    : 0;
  const scanStageIndex = Math.min(c.progressStages.length - 1, Math.floor(scanProgress / 20));
  const scanStage = c.progressStages[scanStageIndex];
  const universeSource = summary?.universeSource || c.universeValue;
  const universeSourceShort = universeSource.replace(/\s*\([^)]*\)\s*$/, '');

  const ledger = [
    { label: c.rawUniverse, value: formatCount(summary?.rawUniverseCount), note: universeSourceShort, fullNote: universeSource },
    { label: c.scanned, value: formatCount(summary?.universeScanned), note: `${countFormatter.format(summary?.failedData ?? 0)} ${c.failed}` },
    { label: c.investable, value: formatCount(summary?.passedInvestability), note: `${countFormatter.format(summary?.filteredOut ?? 0)} ${c.filtered}` },
    { label: c.candidates, value: displayResults.length ? countFormatter.format(displayResults.length) : undefined, note: isZh ? `${c.top} ${countFormatter.format(settings.maxResults)}` : `${c.top} ${countFormatter.format(settings.maxResults)}` },
    { label: c.bullish, value: formatCount(summary?.bullishCount) ?? (displayResults.length ? countFormatter.format(bullishCount) : undefined), note: isZh ? `${countFormatter.format(summary?.strongTrendCount ?? 0)} ${c.strong}` : `${countFormatter.format(summary?.strongTrendCount ?? 0)} ${c.strong}` },
    { label: c.runtime, value: hasNumber(lastDuration) ? formatRuntime(lastDuration) : undefined, note: lastScanLabel },
  ];

  return (
    <div className="market-editorial">
      <header className="market-hero">
        <div>
          <span className="market-kicker"><BarChartOutlined /> {c.kicker}</span>
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
          <div className="market-hero__meta">
            <span><i className={tradeMode === 'real' ? 'is-real' : ''} />{tradeMode === 'real' ? c.modeReal : c.modePaper}</span>
            <span>{loading ? c.scanning : summary ? `${c.completed}: ${lastScanLabel}` : hasSessionData ? c.lastSession : c.awaitingRun}</span>
          </div>
        </div>
        <div className="market-hero__actions">
          <Button icon={<ReloadOutlined />} disabled={loading} onClick={resetFilters}>{c.reset}</Button>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => void runScanner()}>{loading ? c.scanning : c.run}</Button>
        </div>
      </header>

      {loading && (
        <section className="market-scan-progress" role="status" aria-live="polite">
          <div className="market-scan-progress__header">
            <div>
              <span><i />{c.progressTitle}</span>
              <strong>{scanStage}</strong>
            </div>
            <div className="market-scan-progress__metric">
              <strong>{scanProgress}<small>%</small></strong>
              <span>{c.progressEstimated}</span>
            </div>
          </div>
          <div
            className="market-scan-progress__track"
            role="progressbar"
            aria-label={c.progressEstimated}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={scanProgress}
          >
            <i style={{ width: `${scanProgress}%` }} />
          </div>
          <div className="market-scan-progress__footer">
            <span>{c.progressElapsed} <strong>{formatElapsed(scanElapsed)}</strong></span>
            <small>{c.progressNote}</small>
          </div>
        </section>
      )}

      <section className="market-filter-panel" aria-labelledby="market-filter-title">
        <div className="market-section-head">
          <div><span>01 / {c.filtersSection}</span><h2 id="market-filter-title">{c.filterTitle}</h2></div>
          <p>{c.filterNote}</p>
        </div>
        <div className="market-filter-grid">
          <label className="market-field market-field--universe">
            <span>{c.universe}</span>
            <div><BarChartOutlined /> <strong>{c.universeValue}</strong></div>
          </label>
          <label className="market-field"><span>{c.scanCap}</span><InputNumber min={25} max={3000} value={settings.maxSymbols} onChange={(value) => updateSetting({ maxSymbols: Number(value || 1500) })} /></label>
          <label className="market-field"><span>{c.output}</span><InputNumber min={5} max={300} value={settings.maxResults} onChange={(value) => updateSetting({ maxResults: Number(value || 100) })} /></label>
          <label className="market-field"><span>{c.minPrice}</span><InputNumber min={1} max={1000} prefix="$" value={settings.filters.minPrice} onChange={(value) => updateFilter('minPrice', Number(value || 5))} /></label>
          <label className="market-field"><span>{c.history}</span><InputNumber min={60} max={252} value={settings.filters.minHistoryDays} onChange={(value) => updateFilter('minHistoryDays', Number(value || 252))} /></label>
          <label className="market-field market-field--wide"><span>{c.minAdv}</span><InputNumber min={0} step={1_000_000} value={settings.filters.minDollarVolume} formatter={(value) => compactMoney(Number(value || 0))} parser={(value) => parseCompactMoney(value)} onChange={(value) => updateFilter('minDollarVolume', Number(value || 0))} /></label>
          <label className="market-field market-field--wide"><span>{c.minMarketCap}</span><InputNumber min={0} step={100_000_000} value={settings.filters.minMarketCap} formatter={(value) => compactMoney(Number(value || 0))} parser={(value) => parseCompactMoney(value)} onChange={(value) => updateFilter('minMarketCap', Number(value || 0))} /></label>
          <label className="market-field"><span>{c.maxAtr}</span><InputNumber min={1} max={100} suffix="%" value={settings.filters.maxAtrPercent} onChange={(value) => updateFilter('maxAtrPercent', Number(value || 12))} /></label>
          <label className="market-field"><span>{c.maxVol}</span><InputNumber min={5} max={300} suffix="%" value={settings.filters.maxRealizedVol20} onChange={(value) => updateFilter('maxRealizedVol20', Number(value || 120))} /></label>
          <label className="market-field"><span>{c.aiReview}</span><InputNumber min={0} max={100} value={settings.aiReviewTopN} onChange={(value) => updateSetting({ aiReviewTopN: Number(value ?? 100) })} /></label>
        </div>
      </section>

      {error && <Alert className="market-error" type="error" showIcon message={c.scannerFailed} description={error} closable onClose={() => setError('')} />}

      <section className="market-ledger" aria-label={c.scannerSummary}>
        {ledger.map((item, index) => (
          <div key={item.label}>
            <span>{String(index + 1).padStart(2, '0')} / {item.label}</span>
            <strong>{item.value ?? '—'}</strong>
            <small title={item.fullNote || item.note}>{item.note}</small>
          </div>
        ))}
      </section>

      <section className="market-intelligence" aria-labelledby="market-intelligence-title">
        <div className="market-intelligence__head">
          <div><span>02 / {c.analysisSection}</span><h2 id="market-intelligence-title">{c.liveAnalysis}</h2></div>
          <p>{summary?.dataSource || lastScanLabel}</p>
        </div>

        <div className="market-intelligence__grid">
          <article className="market-breadth">
            <div className="market-dark-label"><span>{c.dailyBreadth}</span><small>{breadth.valid} {c.validMoves}</small></div>
            <div className="market-breadth__ratio">
              <strong>{breadth.valid ? breadth.advancing : '—'}</strong><i>/</i><strong>{breadth.valid ? breadth.declining : '—'}</strong>
            </div>
            <div className="market-breadth__labels"><span>{c.advancing}</span><span>{c.declining}</span></div>
            <div className="market-breadth__bar">
              {breadth.valid ? <><i style={{ width: `${(breadth.advancing / breadth.valid) * 100}%` }} /><b style={{ width: `${(breadth.declining / breadth.valid) * 100}%` }} /></> : <em />}
            </div>
          </article>

          <article className="market-score-chart">
            <div className="market-dark-label"><span>{c.scoreDistribution}</span><small>{displayResults.length} {c.candidates.toLowerCase()}</small></div>
            {scoreMax > 0 ? (
              <div className="market-score-chart__bars">
                {scoreDistribution.map((bucket) => (
                  <div key={bucket.label}>
                    <span>{bucket.count}</span>
                    <i><b style={{ height: `${bucket.count === 0 ? 0 : Math.max(4, (bucket.count / scoreMax) * 100)}%` }} /></i>
                    <small>{bucket.label}</small>
                  </div>
                ))}
              </div>
            ) : <div className="market-dark-empty">{c.noScores}</div>}
          </article>

          <article className="market-weights">
            <div className="market-dark-label"><span>{c.factorMandate}</span><small>100%</small></div>
            <div className="market-horizontal-bars">
              {normalizedWeights.map((item) => (
                <div key={item.key}><span>{item.label}</span><i><b style={{ width: `${item.value}%` }} /></i><strong>{Math.round(item.value)}</strong></div>
              ))}
            </div>
          </article>

          <article className="market-sectors">
            <div className="market-dark-label"><span>{c.sectorParticipation}</span><small>{sectorParticipation.length}</small></div>
            {sectorMax > 0 ? (
              <div className="market-horizontal-bars market-horizontal-bars--sector">
                {sectorParticipation.map((item) => (
                  <div key={item.label}><span title={translateSector(item.label)}>{translateSector(item.label)}</span><i><b style={{ width: `${(item.count / sectorMax) * 100}%` }} /></i><strong>{item.count}</strong></div>
                ))}
              </div>
            ) : <div className="market-dark-empty">{c.noSector}</div>}
          </article>
        </div>
      </section>

      <section className="market-results" aria-labelledby="market-result-title">
        <div className="market-section-head market-section-head--results">
          <div><span>03 / {c.resultKicker}</span><h2 id="market-result-title">{c.resultTitle}</h2></div>
          <p>{c.resultNote}</p>
        </div>

        <div className="market-table-wrap">
          <Table<ScannerResult>
            className="market-table"
            rowKey="symbol"
            loading={loading}
            columns={columns}
            dataSource={displayResults}
            size="middle"
            pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 60], showTotal: (total) => `${total} ${c.candidates.toLowerCase()}` }}
            scroll={{ x: 1310 }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div className="market-empty"><strong>{c.emptyTitle}</strong><span>{c.emptyBody}</span></div>} />
              ),
            }}
            expandable={{
              expandedRowRender: renderExpandedRow,
              expandRowByClick: false,
              expandIcon: ({ expanded, onExpand, record }) => (
                <button className={`market-expand ${expanded ? 'is-open' : ''}`} type="button" aria-label={expanded ? c.collapseDetail : c.expandDetail} onClick={(event) => onExpand(record, event)}><ArrowRightOutlined /></button>
              ),
            }}
          />
        </div>
      </section>

      {summary && (
        <footer className="market-source-line">
          <span>{c.source}</span>
          <p>{[
            summary.dataSource,
            `${c.benchmarkCoverage} ${summary.benchmarkEnrichment?.symbolsAvailable ?? 0}`,
            `${c.newsCoverage} ${summary.newsEnrichment?.symbolsWithNews ?? 0}`,
            `${c.finraCoverage} ${summary.shortVolumeEnrichment?.symbolsWithShortVolume ?? 0}`,
            `${c.optionsCoverage} ${summary.optionsEnrichment?.symbolsWithOptions ?? 0}`,
            `${c.aiCoverage} ${summary.aiReview?.reviewedSymbols ?? 0}`,
          ].filter(Boolean).join(' · ')}</p>
        </footer>
      )}
    </div>
  );
};

export default Market;
