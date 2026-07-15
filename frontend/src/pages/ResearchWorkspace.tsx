import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  ArrowRightOutlined,
  AuditOutlined,
  ExperimentOutlined,
  FilterOutlined,
  FundOutlined,
  LineChartOutlined,
  LoadingOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import scannerStateStore from '../services/scannerStateStore';
import type { ScannerStoreState } from '../services/scannerStateStore';
import {
  MARKET_SCANNER_PATH,
  marketSymbolPath,
  rememberMarketSymbol,
} from '../routes/marketRoutes';
import {
  AI_RESEARCH_PATH,
  RESEARCH_CANDIDATES_PATH,
  RESEARCH_REVIEW_PATH,
} from '../routes/researchRoutes';
import './ResearchWorkspace.css';

type CandidateFilter = 'all' | 'priority' | 'advance' | 'challenge' | 'event';
type CandidateRecord = Record<string, any> & { symbol: string };
type ReviewStage = 'fine' | 'validation' | 'admission' | 'entry' | 'execution';
type DecisionCategory = 'ready' | 'review' | 'watch' | 'block' | 'needData' | 'other';

interface ReviewArtifact {
  symbol: string;
  stage: ReviewStage;
  decision: string;
  score: number | null;
  reason: string;
  updatedAt: string | null;
  record: Record<string, any>;
}

const copy = {
  en: {
    candidateKicker: '02 / Research universe',
    candidateTitle: 'Candidate universe',
    candidateSubtitle: 'View the latest saved candidates with ranking, AI review, liquidity, and event-risk fields kept on each record.',
    reviewKicker: '03 / Decision control',
    reviewTitle: 'Review workspace',
    reviewSubtitle: 'Review validation exceptions, portfolio admission, entry plans, and execution candidates without changing saved research state.',
    pipeline: 'AI research pipeline',
    marketScanner: 'Markets scanner',
    reviewWorkspace: 'Review workspace',
    candidateUniverse: 'Candidate universe',
    snapshot: 'Latest persisted research snapshot',
    noSnapshot: 'No completed research snapshot',
    total: 'Candidates',
    priorityA: 'Priority A',
    aiReviewed: 'AI reviewed',
    aiAdvance: 'AI advance',
    challenge: 'AI challenge',
    eventReview: 'Event review',
    search: 'Search symbol, company, sector…',
    filters: 'Research views',
    all: 'All',
    scoreDistribution: 'Research score distribution',
    scoreDistributionNote: 'Latest deterministic ranking score',
    sectorParticipation: 'Sector participation',
    sectorParticipationNote: 'Top sectors in the visible research universe',
    ledger: 'Candidate ledger',
    ledgerNote: 'Open a symbol for its full market dossier, or move to the review queue for downstream decisions.',
    candidate: 'Candidate',
    score: 'Research score',
    signal: 'Signal',
    liquidity: 'Liquidity',
    aiReview: 'AI review',
    risk: 'Event & risk',
    actions: 'Actions',
    analyze: 'Analyze',
    review: 'Review',
    noCandidatesTitle: 'No Research Pipeline candidates yet',
    noCandidatesBody: 'Run the AI research pipeline to create a candidate universe. This page only displays persisted research results.',
    noFilteredTitle: 'No candidates match this view',
    noFilteredBody: 'Clear the search or choose another research view. No underlying result has been removed.',
    loadingTitle: 'Research run in progress',
    loadingBody: 'Counts will appear after the pipeline saves a snapshot.',
    loadingSavedBody: 'A new run is in progress. The page is showing the last saved snapshot until it finishes.',
    failedTitle: 'The latest research run failed',
    failedBody: 'No usable snapshot was saved. Open the pipeline to review the failure and try again.',
    failedSavedBody: 'The latest run failed. The records below come from the last saved snapshot.',
    notLoadedTitle: 'No saved research snapshot',
    notLoadedBody: 'Run the research pipeline once to create a snapshot. Until then, counts are shown as unavailable rather than zero.',
    retryPipeline: 'Open pipeline to retry',
    noScoresTitle: 'No ranking scores in this view',
    noScoresBody: 'The matching records do not contain a usable research score.',
    noSectorsTitle: 'No sector data in this view',
    noSectorsBody: 'The matching records do not contain a sector or industry value.',
    unknownCompany: 'Company name unavailable',
    noData: 'Not available',
    notReviewed: 'Not reviewed',
    evidence: 'Evidence',
    currentRun: 'Pipeline currently running',
    pipelineIdle: 'Pipeline not running',
    reviewTotal: 'Research records',
    attention: 'Needs attention',
    ready: 'Ready',
    watch: 'Watch / hold',
    blocked: 'Blocked',
    executionQueue: 'Execution queue',
    funnel: 'Research funnel',
    funnelNote: 'Latest persisted count at each decision stage',
    decisions: 'Decision distribution',
    decisionsNote: 'Latest downstream decision for each symbol',
    pendingQueue: 'Unified review queue',
    pendingQueueNote: 'Only records with review, wait, hold, missing-data, blocked, draft, or failed states appear here.',
    stage: 'Current stage',
    decision: 'Decision',
    confidence: 'Evidence score',
    reason: 'Review note',
    updated: 'Updated',
    open: 'Open',
    noReviewTitle: 'No research records require manual attention',
    noReviewBodyEmpty: 'Run the AI research pipeline to populate validation, admission, and entry-plan decisions.',
    noReviewBodyClear: 'The latest persisted decisions contain no review, hold, missing-data, or blocked states.',
    noReviewFilteredTitle: 'No review records match this search',
    noReviewFilteredBody: 'Clear the search to return to the full manual-attention queue.',
    noDecisionSnapshotTitle: 'No downstream decision snapshot',
    noDecisionSnapshotBody: 'A candidate snapshot exists, but validation, admission, and entry-plan decisions have not been saved yet.',
    pipelineFailed: 'Latest run failed',
    fine: 'Fine scan',
    validation: 'Validation',
    admission: 'Admission',
    entry: 'Entry plan',
    execution: 'Execution',
    needData: 'Need data',
    other: 'Other',
    symbols: 'symbols',
    distributionSection: 'Distribution',
    participationSection: 'Participation',
    ledgerSection: 'Research ledger',
    pipelineSection: 'Pipeline',
    decisionsSection: 'Decisions',
    attentionSection: 'Manual attention',
    usEquity: 'US equity',
    priorityLabel: 'Priority A',
    researchLabel: 'Research',
    oneMonth: '1M',
    threeMonths: '3M',
    spyThreeMonths: 'SPY 3M',
    averageDailyVolume: 'ADV',
    earningsIn: 'Earnings in {days}d',
    readOnly: 'Read-only research view',
    readOnlyNote: 'This page subscribes to existing Research Pipeline state. It does not start scans, change decisions, or submit orders.',
  },
  zh: {
    candidateKicker: '02 / 研究标的池',
    candidateTitle: '候选标的',
    candidateSubtitle: '集中查看研究流程最近一次保留的候选结果。每个标的的评分、AI 质疑、流动性和事件风险都会随研究记录保留。',
    reviewKicker: '03 / 决策控制',
    reviewTitle: '审核工作区',
    reviewSubtitle: '统一处理验证异常、组合准入、入场计划和执行候选，同时不修改任何底层研究状态。',
    pipeline: 'AI 研究流程',
    marketScanner: '市场扫描器',
    reviewWorkspace: '审核工作区',
    candidateUniverse: '候选标的',
    snapshot: '最近保留的研究快照',
    noSnapshot: '暂无已完成的研究快照',
    total: '候选数量',
    priorityA: 'A 级优先',
    aiReviewed: 'AI 已审核',
    aiAdvance: 'AI 建议推进',
    challenge: 'AI 质疑',
    eventReview: '事件复核',
    search: '搜索代码、公司或行业…',
    filters: '研究视图',
    all: '全部',
    scoreDistribution: '研究评分分布',
    scoreDistributionNote: '最近一次确定性排名评分',
    sectorParticipation: '行业参与度',
    sectorParticipationNote: '当前研究标的池中的主要行业',
    ledger: '候选标的账本',
    ledgerNote: '打开标的查看完整市场档案，或进入审核队列处理后续决策。',
    candidate: '候选标的',
    score: '研究评分',
    signal: '信号',
    liquidity: '流动性',
    aiReview: 'AI 审核',
    risk: '事件与风险',
    actions: '操作',
    analyze: '分析',
    review: '审核',
    noCandidatesTitle: '暂无研究流程候选结果',
    noCandidatesBody: '请先运行 AI 研究流程生成候选标的。本页只展示已经保留的真实研究结果。',
    noFilteredTitle: '当前视图没有匹配标的',
    noFilteredBody: '清除搜索条件或选择其他研究视图，底层结果不会被删除。',
    loadingTitle: '研究流程正在运行',
    loadingBody: '流程保存新快照后，这里才会显示对应数量。',
    loadingSavedBody: '新一次运行尚未完成。在此期间，页面继续显示上次保存的快照。',
    failedTitle: '最近一次研究运行失败',
    failedBody: '本次没有保存可用快照。请打开研究流程查看原因并重试。',
    failedSavedBody: '最近一次运行失败。下方仍显示上次保存的快照。',
    notLoadedTitle: '还没有保存研究快照',
    notLoadedBody: '请先运行一次研究流程。在快照产生前，未知数量会显示为不可用，不会显示成 0。',
    retryPipeline: '打开流程重试',
    noScoresTitle: '当前视图没有可用评分',
    noScoresBody: '匹配的研究记录中没有可用的排名评分。',
    noSectorsTitle: '当前视图没有行业数据',
    noSectorsBody: '匹配的研究记录中没有行业或细分行业信息。',
    unknownCompany: '暂无公司名称',
    noData: '暂无数据',
    notReviewed: '尚未审核',
    evidence: '证据',
    currentRun: '研究流程运行中',
    pipelineIdle: '研究流程未运行',
    reviewTotal: '研究记录',
    attention: '需要关注',
    ready: '可推进',
    watch: '观察 / 暂缓',
    blocked: '已阻断',
    executionQueue: '执行队列',
    funnel: '研究漏斗',
    funnelNote: '各决策阶段最近保留的真实数量',
    decisions: '决策分布',
    decisionsNote: '每个标的最近的下游决策',
    pendingQueue: '统一审核队列',
    pendingQueueNote: '仅显示审核、等待、暂缓、缺失数据、阻断、草稿或失败状态。',
    stage: '当前阶段',
    decision: '决策',
    confidence: '证据评分',
    reason: '审核说明',
    updated: '更新时间',
    open: '打开',
    noReviewTitle: '当前没有需要人工关注的研究记录',
    noReviewBodyEmpty: '请先运行 AI 研究流程，以生成验证、准入和入场计划决策。',
    noReviewBodyClear: '最近保留的决策中没有审核、暂缓、缺失数据或阻断状态。',
    noReviewFilteredTitle: '没有审核记录匹配当前搜索',
    noReviewFilteredBody: '清除搜索即可返回完整的人工关注队列。',
    noDecisionSnapshotTitle: '还没有下游决策快照',
    noDecisionSnapshotBody: '候选快照已存在，但验证、准入与入场计划还没有保存决策结果。',
    pipelineFailed: '最近运行失败',
    fine: '精细扫描',
    validation: '深度验证',
    admission: '组合准入',
    entry: '入场计划',
    execution: '执行候选',
    needData: '缺少数据',
    other: '其他',
    symbols: '个标的',
    distributionSection: '分布',
    participationSection: '参与度',
    ledgerSection: '研究记录',
    pipelineSection: '研究流程',
    decisionsSection: '决策',
    attentionSection: '人工关注',
    usEquity: '美国股票',
    priorityLabel: 'A 级优先',
    researchLabel: '研究候选',
    oneMonth: '1 个月',
    threeMonths: '3 个月',
    spyThreeMonths: '相对 SPY 3 个月',
    averageDailyVolume: '日均成交额',
    earningsIn: '距离财报 {days} 天',
    readOnly: '只读研究视图',
    readOnlyNote: '此页面只读取现有研究流程状态，不会启动扫描、修改决策或提交订单。',
  },
};

const asArray = (value: unknown): Record<string, any>[] => Array.isArray(value) ? value : [];

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const scoreFor = (record: Record<string, any>): number | null => (
  finiteNumber(record.selectionScore)
  ?? finiteNumber(record.overallScore)
  ?? finiteNumber(record.trendScore)
  ?? finiteNumber(record.fineScanScore)
  ?? finiteNumber(record.validationScore)
  ?? finiteNumber(record.confidence)
);

const compactNumber = (value: unknown): string => {
  const parsed = finiteNumber(value);
  if (parsed === null) return '—';
  const absolute = Math.abs(parsed);
  if (absolute >= 1e12) return `${(parsed / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${(parsed / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(parsed / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${(parsed / 1e3).toFixed(1)}K`;
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const compactMoney = (value: unknown): string => {
  const formatted = compactNumber(value);
  return formatted === '—' ? formatted : `$${formatted}`;
};

const signedPercent = (value: unknown): string => {
  const parsed = finiteNumber(value);
  if (parsed === null) return '—';
  return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(1)}%`;
};

const isPriorityA = (record: Record<string, any>): boolean => {
  const label = String(record.selectionLabel || '').trim().toLowerCase();
  const score = scoreFor(record);
  return label === 'priority a' || (!label && score !== null && score >= 80);
};

const isAiAdvance = (record: Record<string, any>): boolean => (
  String(record.aiTraderDecision || record.aiDecision || '').toLowerCase() === 'advance'
);

const isAiChallenge = (record: Record<string, any>): boolean => {
  const decision = String(record.aiTraderDecision || record.aiDecision || '').toLowerCase();
  return Boolean(record.aiChallenged) || decision === 'watch' || decision === 'avoid';
};

const hasEventReview = (record: Record<string, any>): boolean => {
  const earnings = finiteNumber(record.daysToEarnings);
  const skew = finiteNumber(record.optionIvSkew);
  return String(record.eventRisk || '').toLowerCase() === 'high'
    || (earnings !== null && earnings >= 0 && earnings <= 10)
    || (skew !== null && Math.abs(skew) >= 20);
};

const candidateMatches = (record: Record<string, any>, filter: CandidateFilter): boolean => {
  if (filter === 'priority') return isPriorityA(record);
  if (filter === 'advance') return isAiAdvance(record);
  if (filter === 'challenge') return isAiChallenge(record);
  if (filter === 'event') return hasEventReview(record);
  return true;
};

const formatTimestamp = (value: unknown, isZh: boolean): string => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const localizeKnownToken = (value: unknown, isZh: boolean): string => {
  const raw = String(value || '').trim();
  if (!raw || !isZh) return raw;
  const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  const labels: Record<string, string> = {
    'PRIORITY A': 'A 级优先', RESEARCH: '研究候选',
    ADVANCE: '推进', WATCH: '观察', AVOID: '回避', REVIEW: '复核', DRAFT: '草稿',
    HOLD: '暂缓', WAIT: '等待', PENDING: '待处理', BLOCKED: '已阻断', BLOCK: '阻断',
    REJECT: '拒绝', ADMIT: '准入', PASS: '通过', CONFIRMED: '已确认',
    'BUY READY': '可买入', EXECUTABLE: '可执行', FILLED: '已成交', SUBMITTED: '已提交',
    'NEED DATA': '缺少数据', 'MISSING DATA': '缺少数据', 'NO DATA': '暂无数据',
    'STRONG BULLISH': '强势看涨', BULLISH: '看涨', NEUTRAL: '中性', BEARISH: '看跌', 'STRONG BEARISH': '强势看跌',
    HIGH: '高', MEDIUM: '中', LOW: '低',
    COMPLETED: '已完成', PERSISTED: '已保留', RUNNING: '运行中', LOADING: '载入中', SCANNING: '扫描中',
    FAILED: '失败', ERROR: '失败', STOPPED: '已停止', IDLE: '等待中',
  };
  return labels[normalized] || raw;
};

const decisionColor = (decisionValue: unknown): string => {
  const decision = String(decisionValue || '').toUpperCase();
  if (/ADVANCE|ADMIT|PASS|CONFIRMED|BUY_READY|FILLED|SUBMITTED/.test(decision)) return 'success';
  if (/BLOCK|REJECT|AVOID|FAIL|ERROR|SKIP|CANCEL/.test(decision)) return 'error';
  if (/WATCH|WAIT|HOLD|PENDING/.test(decision)) return 'warning';
  if (/REVIEW|DRAFT/.test(decision)) return 'processing';
  if (/NEED|MISSING|NO_DATA/.test(decision)) return 'orange';
  return 'default';
};

const extractDecision = (record: Record<string, any>, stage: ReviewStage): string => {
  if (stage === 'execution') return String(record.executionStatus || record.status || '');
  if (stage === 'entry') return String(record.effectiveAction || record.action || record.finalAction || record.entryAction || record.decision || '');
  if (stage === 'admission') return String(record.admissionDecision || record.decision || record.status || '');
  if (stage === 'validation') return String(record.dvDecision || record.verdict || record.decision || record.status || '');
  return String(record.decision || record.finalDecision || record.status || '');
};

const extractReason = (record: Record<string, any>): string => {
  const value = record.readyReviewReason
    || record.decisionReason
    || record.finalReason
    || record.admissionReason
    || record.riskComment
    || record.executionError
    || record.reason
    || record.message;
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  return String(value || '—');
};

const classifyDecision = (value: unknown): DecisionCategory => {
  const decision = String(value || '').toUpperCase();
  if (/NEED|MISSING|NO_DATA/.test(decision)) return 'needData';
  if (/BLOCK|REJECT|AVOID|FAIL|ERROR|SKIP|CANCEL/.test(decision)) return 'block';
  if (/ADMIT|PASS|CONFIRMED|BUY_READY|EXECUTABLE|FILLED|SUBMITTED|ADVANCE/.test(decision)) return 'ready';
  if (/REVIEW|DRAFT/.test(decision)) return 'review';
  if (/WATCH|WAIT|HOLD|PENDING/.test(decision)) return 'watch';
  return 'other';
};

const requiresAttention = (value: unknown): boolean => {
  const category = classifyDecision(value);
  return ['review', 'watch', 'block', 'needData'].includes(category);
};

const useResearchSnapshot = (): ScannerStoreState => {
  const [snapshot, setSnapshot] = useState<ScannerStoreState>(() => scannerStateStore.getState());

  useEffect(() => scannerStateStore.subscribe(setSnapshot), []);
  return snapshot;
};

const EmptyResearchState: React.FC<{
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}> = ({ title, body, actionLabel, onAction, compact = false }) => (
  <div className={`rw-empty${compact ? ' rw-empty--compact' : ''}`}>
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
    <strong>{title}</strong>
    <p>{body}</p>
    {actionLabel && onAction && <Button onClick={onAction} icon={<ArrowRightOutlined />}>{actionLabel}</Button>}
  </div>
);

const WorkspaceStateBand: React.FC<{
  tone: 'loading' | 'error' | 'empty' | 'stale';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ tone, title, body, actionLabel, onAction }) => (
  <section className={`rw-state-band rw-state-band--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span className="rw-state-band__icon">
      {tone === 'loading' ? <LoadingOutlined className="is-spinning" /> : tone === 'error' || tone === 'stale' ? <WarningOutlined /> : <FundOutlined />}
    </span>
    <div><strong>{title}</strong><p>{body}</p></div>
    {actionLabel && onAction && <Button onClick={onAction} icon={<ReloadOutlined />}>{actionLabel}</Button>}
  </section>
);

export const CandidateUniversePage: React.FC = () => {
  const navigate = useNavigate();
  const { language, translateSector } = useLanguage();
  const snapshot = useResearchSnapshot();
  const isZh = language === 'zh-CN';
  const c = isZh ? copy.zh : copy.en;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CandidateFilter>('all');
  const results = useMemo(
    () => asArray(snapshot.marketScanner.results).filter((row): row is CandidateRecord => Boolean(row?.symbol)),
    [snapshot.marketScanner.results],
  );
  const scannerRunning = snapshot.marketScanner.status === 'running'
    || snapshot.marketScanner.detailedScanStatus.currentStatus === 'scanning';
  const scannerFailed = snapshot.marketScanner.status === 'failed'
    || snapshot.marketScanner.detailedScanStatus.currentStatus === 'error';
  const hasCandidateSnapshot = results.length > 0
    || snapshot.marketScanner.status === 'completed'
    || Boolean(snapshot.marketScanner.lastScanTime || snapshot.marketScanner.detailedScanStatus.lastScanAt);
  const candidateFailureDetail = snapshot.marketScanner.detailedScanStatus.lastFailureReason
    || (scannerFailed ? snapshot.marketScanner.detailedScanStatus.statusMessage : '')
    || c.failedBody;

  const counts = useMemo(() => ({
    all: results.length,
    priority: results.filter(isPriorityA).length,
    advance: results.filter(isAiAdvance).length,
    challenge: results.filter(isAiChallenge).length,
    event: results.filter(hasEventReview).length,
    reviewed: results.filter((row) => row.aiCalled && row.aiSuccess !== false).length,
  }), [results]);

  const visibleResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return results.filter((record) => {
      if (!candidateMatches(record, filter)) return false;
      if (!needle) return true;
      return [record.symbol, record.companyName, record.name, record.sector, record.industry]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [filter, results, search]);

  const scoreBuckets = useMemo(() => {
    const buckets = [
      { label: '<50', min: -Infinity, max: 50, count: 0 },
      { label: '50–64', min: 50, max: 65, count: 0 },
      { label: '65–79', min: 65, max: 80, count: 0 },
      { label: '80–89', min: 80, max: 90, count: 0 },
      { label: '90+', min: 90, max: Infinity, count: 0 },
    ];
    visibleResults.forEach((record) => {
      const score = scoreFor(record);
      if (score === null) return;
      const bucket = buckets.find((item) => score >= item.min && score < item.max);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [visibleResults]);

  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    visibleResults.forEach((record) => {
      const sector = String(record.sector || record.industry || '').trim();
      if (sector) map.set(sector, (map.get(sector) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 7);
  }, [visibleResults]);

  const openSymbol = (symbol: string) => {
    rememberMarketSymbol(symbol);
    navigate(marketSymbolPath(symbol));
  };

  const columns: TableColumnsType<CandidateRecord> = useMemo(() => [
    {
      title: c.candidate,
      dataIndex: 'symbol',
      key: 'symbol',
      fixed: 'left',
      width: 205,
      render: (symbol: string, record: CandidateRecord) => {
        const change = finiteNumber(record.changePct ?? record.changePercent);
        return (
          <div className="rw-candidate-cell">
            <div><strong>{symbol}</strong><span>{record.exchangeName || record.exchange || c.usEquity}</span></div>
            <p>{record.companyName || record.name || c.unknownCompany}</p>
            <small>{finiteNumber(record.price) !== null ? `$${Number(record.price).toFixed(2)}` : c.noData}{change !== null && <em className={change >= 0 ? 'is-positive' : 'is-negative'}>{signedPercent(change)}</em>}</small>
          </div>
        );
      },
    },
    {
      title: c.score,
      key: 'score',
      width: 175,
      align: 'right',
      sorter: (a, b) => Number(scoreFor(a) || 0) - Number(scoreFor(b) || 0),
      defaultSortOrder: 'descend',
      render: (_value, record) => {
        const score = scoreFor(record);
        const reliability = finiteNumber(record.scoreReliability);
        return (
          <div className="rw-score-cell">
            <div><strong>{score === null ? '—' : Math.round(score)}</strong><span>/100</span><Tag color={isPriorityA(record) ? 'success' : 'default'} bordered={false}>{record.selectionLabel ? localizeKnownToken(record.selectionLabel, isZh) : (isPriorityA(record) ? c.priorityLabel : c.researchLabel)}</Tag></div>
            <i><b style={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }} /></i>
            <small>{c.evidence} {reliability === null ? '—' : `${Math.round(reliability)}%`}</small>
          </div>
        );
      },
    },
    {
      title: c.signal,
      key: 'signal',
      width: 180,
      render: (_value, record) => (
        <div className="rw-stack-cell">
          <Tag color={/bull/i.test(String(record.trendLabel || '')) ? 'success' : /bear/i.test(String(record.trendLabel || '')) ? 'error' : 'default'} bordered={false}>{record.trendLabel ? localizeKnownToken(record.trendLabel, isZh) : c.noData}</Tag>
          <span>{c.oneMonth} {signedPercent(record.momentum1m)} · {c.threeMonths} {signedPercent(record.momentum3m)}</span>
          <small>{c.spyThreeMonths} {signedPercent(record.relativeStrength3m)}</small>
        </div>
      ),
    },
    {
      title: c.liquidity,
      key: 'liquidity',
      width: 175,
      align: 'right',
      sorter: (a, b) => Number(a.avgDollarVolume20 || 0) - Number(b.avgDollarVolume20 || 0),
      render: (_value, record) => (
        <div className="rw-stack-cell rw-stack-cell--numeric">
          <strong>{compactMoney(record.avgDollarVolume20)} {c.averageDailyVolume}</strong>
          <span>{record.liquidityTier ? localizeKnownToken(record.liquidityTier, isZh) : c.noData}</span>
          <small>{finiteNumber(record.estimatedRoundTripCostBps) === null ? c.noData : `${Number(record.estimatedRoundTripCostBps).toFixed(1)} bps`}</small>
        </div>
      ),
    },
    {
      title: c.aiReview,
      key: 'ai',
      width: 225,
      render: (_value, record) => {
        const decision = record.aiTraderDecision || record.aiDecision;
        return (
          <div className="rw-ai-cell">
            <div><Tag color={decisionColor(decision)} bordered={false}>{decision ? `AI ${localizeKnownToken(decision, isZh)}` : c.notReviewed}</Tag>{finiteNumber(record.aiTraderConfidence) !== null && <span>{Math.round(Number(record.aiTraderConfidence))}%</span>}</div>
            <Tooltip title={record.aiTraderRationale || record.scannerReason || c.noData}><p>{record.aiTraderRationale || record.scannerReason || c.noData}</p></Tooltip>
          </div>
        );
      },
    },
    {
      title: c.risk,
      key: 'risk',
      width: 175,
      render: (_value, record) => (
        <div className="rw-stack-cell">
          <Tag color={hasEventReview(record) ? 'warning' : 'default'} bordered={false}>{record.eventRisk && record.eventRisk !== 'Unknown' ? localizeKnownToken(record.eventRisk, isZh) : (hasEventReview(record) ? c.eventReview : c.noData)}</Tag>
          <span>ATR {signedPercent(record.atrPercent).replace('+', '')}</span>
          <small>{finiteNumber(record.daysToEarnings) !== null && Number(record.daysToEarnings) >= 0 ? c.earningsIn.replace('{days}', String(Math.round(Number(record.daysToEarnings)))) : c.noData}</small>
        </div>
      ),
    },
    {
      title: c.actions,
      key: 'actions',
      fixed: 'right',
      width: 178,
      align: 'center',
      render: (_value, record) => (
        <div className="rw-row-actions">
          <Button icon={<LineChartOutlined />} onClick={() => openSymbol(record.symbol)}>{c.analyze}</Button>
          <Button icon={<AuditOutlined />} onClick={() => navigate(`${RESEARCH_REVIEW_PATH}?symbol=${encodeURIComponent(record.symbol)}`)}>{c.review}</Button>
        </div>
      ),
    },
  ], [c, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterItems: Array<{ key: CandidateFilter; label: string; count: number | null }> = [
    { key: 'all', label: c.all, count: hasCandidateSnapshot ? counts.all : null },
    { key: 'priority', label: c.priorityA, count: hasCandidateSnapshot ? counts.priority : null },
    { key: 'advance', label: c.aiAdvance, count: hasCandidateSnapshot ? counts.advance : null },
    { key: 'challenge', label: c.challenge, count: hasCandidateSnapshot ? counts.challenge : null },
    { key: 'event', label: c.eventReview, count: hasCandidateSnapshot ? counts.event : null },
  ];
  const scoreMax = Math.max(0, ...scoreBuckets.map((item) => item.count));
  const sectorMax = Math.max(0, ...sectors.map((item) => item.count));
  const lastUpdated = snapshot.marketScanner.lastScanTime || snapshot.lastUpdated;

  return (
    <div className="research-workspace rw-candidates">
      <header className="rw-hero">
        <div>
          <span className="rw-kicker"><FundOutlined /> {c.candidateKicker}</span>
          <h1>{c.candidateTitle}</h1>
          <p>{c.candidateSubtitle}</p>
          <div className="rw-hero-meta"><span><i className={scannerRunning ? 'is-live' : scannerFailed ? 'is-error' : undefined} />{scannerRunning ? c.currentRun : scannerFailed ? c.pipelineFailed : c.pipelineIdle}</span><span>{lastUpdated ? `${c.snapshot}: ${formatTimestamp(lastUpdated, isZh)}` : c.noSnapshot}</span></div>
        </div>
        <div className="rw-hero-actions">
          <Button icon={<RadarChartOutlined />} onClick={() => navigate(MARKET_SCANNER_PATH)}>{c.marketScanner}</Button>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={() => navigate(AI_RESEARCH_PATH)}>{c.pipeline}</Button>
        </div>
      </header>

      {scannerRunning ? (
        <WorkspaceStateBand tone="loading" title={c.loadingTitle} body={hasCandidateSnapshot ? c.loadingSavedBody : c.loadingBody} />
      ) : scannerFailed ? (
        <WorkspaceStateBand tone={hasCandidateSnapshot ? 'stale' : 'error'} title={c.failedTitle} body={hasCandidateSnapshot ? `${c.failedSavedBody}${candidateFailureDetail && candidateFailureDetail !== c.failedBody ? ` ${candidateFailureDetail}` : ''}` : candidateFailureDetail} actionLabel={c.retryPipeline} onAction={() => navigate(AI_RESEARCH_PATH)} />
      ) : !hasCandidateSnapshot ? (
        <WorkspaceStateBand tone="empty" title={c.notLoadedTitle} body={c.notLoadedBody} actionLabel={c.pipeline} onAction={() => navigate(AI_RESEARCH_PATH)} />
      ) : null}

      <section className="rw-kpi-ledger" aria-label={c.snapshot}>
        {[
          [c.total, hasCandidateSnapshot ? counts.all : null],
          [c.priorityA, hasCandidateSnapshot ? counts.priority : null],
          [c.aiReviewed, hasCandidateSnapshot ? counts.reviewed : null],
          [c.aiAdvance, hasCandidateSnapshot ? counts.advance : null],
          [c.challenge, hasCandidateSnapshot ? counts.challenge : null],
          [c.eventReview, hasCandidateSnapshot ? counts.event : null],
        ].map(([label, value], index) => <article key={String(label)}><span>0{index + 1} / {label}</span><strong>{value === null ? '—' : Number(value).toLocaleString()}</strong><small>{value === null ? c.noData : c.symbols}</small></article>)}
      </section>

      <section className="rw-filter-band" aria-label={c.filters}>
        <div className="rw-filter-label"><FilterOutlined /><span>{c.filters}</span></div>
        <div className="rw-filter-tabs">
          {filterItems.map((item) => <button type="button" className={filter === item.key ? 'is-active' : undefined} onClick={() => setFilter(item.key)} key={item.key}><span>{item.label}</span><b>{item.count === null ? '—' : item.count}</b></button>)}
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} allowClear prefix={<SearchOutlined />} placeholder={c.search} aria-label={c.search} />
      </section>

      <section className="rw-analysis-grid">
        <article className="rw-dark-panel rw-score-distribution">
          <div className="rw-panel-heading"><div><span>01 / {c.distributionSection}</span><h2>{c.scoreDistribution}</h2></div><p>{c.scoreDistributionNote}</p></div>
          {scoreMax > 0 ? (
            <div className="rw-vertical-bars">
              {scoreBuckets.map((item) => <div key={item.label}><b>{item.count}</b><i><span style={{ height: `${item.count === 0 ? 0 : Math.max(5, (item.count / scoreMax) * 100)}%` }} /></i><small>{item.label}</small></div>)}
            </div>
          ) : <EmptyResearchState
            title={scannerRunning && !hasCandidateSnapshot ? c.loadingTitle : scannerFailed && !hasCandidateSnapshot ? c.failedTitle : !hasCandidateSnapshot ? c.notLoadedTitle : visibleResults.length === 0 && results.length > 0 ? c.noFilteredTitle : results.length > 0 ? c.noScoresTitle : c.noCandidatesTitle}
            body={scannerRunning && !hasCandidateSnapshot ? c.loadingBody : scannerFailed && !hasCandidateSnapshot ? candidateFailureDetail : !hasCandidateSnapshot ? c.notLoadedBody : visibleResults.length === 0 && results.length > 0 ? c.noFilteredBody : results.length > 0 ? c.noScoresBody : c.noCandidatesBody}
            compact
          />}
        </article>
        <article className="rw-dark-panel rw-sector-panel">
          <div className="rw-panel-heading"><div><span>02 / {c.participationSection}</span><h2>{c.sectorParticipation}</h2></div><p>{c.sectorParticipationNote}</p></div>
          {sectorMax > 0 ? (
            <div className="rw-horizontal-bars">
              {sectors.map((item) => <div key={item.label}><span title={translateSector(item.label)}>{translateSector(item.label)}</span><i><b style={{ width: `${(item.count / sectorMax) * 100}%` }} /></i><strong>{item.count}</strong></div>)}
            </div>
          ) : <EmptyResearchState
            title={scannerRunning && !hasCandidateSnapshot ? c.loadingTitle : scannerFailed && !hasCandidateSnapshot ? c.failedTitle : !hasCandidateSnapshot ? c.notLoadedTitle : visibleResults.length === 0 && results.length > 0 ? c.noFilteredTitle : results.length > 0 ? c.noSectorsTitle : c.noCandidatesTitle}
            body={scannerRunning && !hasCandidateSnapshot ? c.loadingBody : scannerFailed && !hasCandidateSnapshot ? candidateFailureDetail : !hasCandidateSnapshot ? c.notLoadedBody : visibleResults.length === 0 && results.length > 0 ? c.noFilteredBody : results.length > 0 ? c.noSectorsBody : c.noCandidatesBody}
            compact
          />}
        </article>
      </section>

      <section className="rw-table-section">
        <div className="rw-section-heading"><div><span>03 / {c.ledgerSection}</span><h2>{c.ledger}</h2></div><p>{c.ledgerNote}</p></div>
        <Table<CandidateRecord>
          className="rw-table rw-candidate-table"
          rowKey="symbol"
          columns={columns}
          dataSource={visibleResults}
          loading={scannerRunning}
          scroll={{ x: 1310 }}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 60], showTotal: (total) => `${total} ${c.symbols}` }}
          locale={{
            emptyText: <EmptyResearchState
              title={scannerRunning && !hasCandidateSnapshot ? c.loadingTitle : scannerFailed && !hasCandidateSnapshot ? c.failedTitle : !hasCandidateSnapshot ? c.notLoadedTitle : results.length ? c.noFilteredTitle : c.noCandidatesTitle}
              body={scannerRunning && !hasCandidateSnapshot ? c.loadingBody : scannerFailed && !hasCandidateSnapshot ? candidateFailureDetail : !hasCandidateSnapshot ? c.notLoadedBody : results.length ? c.noFilteredBody : c.noCandidatesBody}
              actionLabel={scannerFailed ? c.retryPipeline : !hasCandidateSnapshot || !results.length ? c.pipeline : undefined}
              onAction={scannerFailed || !hasCandidateSnapshot || !results.length ? () => navigate(AI_RESEARCH_PATH) : undefined}
            />,
          }}
        />
      </section>
    </div>
  );
};

const buildReviewArtifacts = (snapshot: ScannerStoreState): ReviewArtifact[] => {
  const latest = new Map<string, ReviewArtifact>();
  const addStage = (rows: Record<string, any>[], stage: ReviewStage, rank: number) => {
    rows.forEach((record) => {
      const symbol = String(record?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      const existing = latest.get(symbol) as (ReviewArtifact & { rank?: number }) | undefined;
      if (existing && Number(existing.rank || 0) > rank) return;
      latest.set(symbol, {
        symbol,
        stage,
        decision: extractDecision(record, stage),
        score: scoreFor(record),
        reason: extractReason(record),
        updatedAt: record.updatedAt || record.lastUpdated || record.completedAt || null,
        record,
        rank,
      } as ReviewArtifact & { rank: number });
    });
  };

  addStage(asArray(snapshot.fineScan.results), 'fine', 1);
  addStage(asArray(snapshot.deeperValidation.results), 'validation', 2);
  addStage(asArray(snapshot.admission.results), 'admission', 3);
  addStage(asArray(snapshot.entryPlan.results), 'entry', 4);
  addStage(asArray(snapshot.aiExecutionCandidates), 'execution', 5);
  return Array.from(latest.values());
};

export const ReviewWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const snapshot = useResearchSnapshot();
  const isZh = language === 'zh-CN';
  const c = isZh ? copy.zh : copy.en;
  const [search, setSearch] = useState(() => searchParams.get('symbol') || '');

  useEffect(() => {
    const requestedSymbol = searchParams.get('symbol');
    if (requestedSymbol) setSearch(requestedSymbol.toUpperCase());
  }, [searchParams]);
  const artifacts = useMemo(() => buildReviewArtifacts(snapshot), [snapshot]);
  const marketStageKnown = asArray(snapshot.marketScanner.results).length > 0
    || snapshot.marketScanner.status === 'completed'
    || Boolean(snapshot.marketScanner.lastScanTime || snapshot.marketScanner.detailedScanStatus.lastScanAt);
  const fineStageKnown = asArray(snapshot.fineScan.results).length > 0
    || snapshot.fineScan.status === 'completed'
    || Boolean(snapshot.fineScan.lastUpdated);
  const validationStageKnown = snapshot.deeperValidation.results !== null
    || snapshot.deeperValidation.status === 'completed'
    || Boolean(snapshot.deeperValidation.lastUpdated);
  const admissionStageKnown = snapshot.admission.results !== null
    || snapshot.admission.status === 'completed'
    || Boolean(snapshot.admission.lastUpdated);
  const entryStageKnown = snapshot.entryPlan.results !== null
    || snapshot.entryPlan.status === 'completed'
    || Boolean(snapshot.entryPlan.lastUpdated);
  const executionStageKnown = snapshot.aiExecutionCandidates.length > 0 || entryStageKnown;
  const decisionSnapshotKnown = fineStageKnown || validationStageKnown || admissionStageKnown || entryStageKnown || executionStageKnown;
  const reviewSnapshotKnown = marketStageKnown || decisionSnapshotKnown;
  const failedStageNames = [
    snapshot.marketScanner.status,
    snapshot.marketScanner.detailedScanStatus.currentStatus,
    snapshot.fineScan.status,
    snapshot.deeperValidation.status,
    snapshot.admission.status,
    snapshot.entryPlan.status,
  ].filter((status) => ['failed', 'error'].includes(String(status).toLowerCase()));
  const reviewFailureDetail = snapshot.marketScanner.detailedScanStatus.lastFailureReason
    || snapshot.fineScan.message
    || c.failedBody;
  const reviewRows = useMemo(() => artifacts.filter((item) => requiresAttention(item.decision)), [artifacts]);
  const filteredReviewRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return reviewRows;
    return reviewRows.filter((item) => [item.symbol, item.stage, item.decision, item.reason]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [reviewRows, search]);

  const decisions = useMemo(() => {
    const value: Record<DecisionCategory, number> = { ready: 0, review: 0, watch: 0, block: 0, needData: 0, other: 0 };
    artifacts.forEach((item) => { value[classifyDecision(item.decision)] += 1; });
    return value;
  }, [artifacts]);

  const funnel: Array<{ key: string; label: string; count: number | null; status: string }> = [
    { key: 'market', label: c.total, count: marketStageKnown ? asArray(snapshot.marketScanner.results).length : null, status: snapshot.marketScanner.status },
    { key: 'fine', label: c.fine, count: fineStageKnown ? asArray(snapshot.fineScan.results).length : null, status: snapshot.fineScan.status },
    { key: 'validation', label: c.validation, count: validationStageKnown ? asArray(snapshot.deeperValidation.results).length : null, status: snapshot.deeperValidation.status },
    { key: 'admission', label: c.admission, count: admissionStageKnown ? asArray(snapshot.admission.results).length : null, status: snapshot.admission.status },
    { key: 'entry', label: c.entry, count: entryStageKnown ? asArray(snapshot.entryPlan.results).length : null, status: snapshot.entryPlan.status },
    { key: 'execution', label: c.execution, count: executionStageKnown ? asArray(snapshot.aiExecutionCandidates).length : null, status: executionStageKnown ? 'persisted' : 'idle' },
  ];
  const funnelMax = Math.max(0, ...funnel.map((item) => item.count ?? 0));
  const decisionItems: Array<{ key: DecisionCategory; label: string; value: number }> = [
    { key: 'ready', label: c.ready, value: decisions.ready },
    { key: 'review', label: c.attention, value: decisions.review },
    { key: 'watch', label: c.watch, value: decisions.watch },
    { key: 'block', label: c.blocked, value: decisions.block },
    { key: 'needData', label: c.needData, value: decisions.needData },
    { key: 'other', label: c.other, value: decisions.other },
  ];
  const decisionTotal = decisionItems.reduce((sum, item) => sum + item.value, 0);
  const pipelineRunning = [
    snapshot.marketScanner.status,
    snapshot.fineScan.status,
    snapshot.deeperValidation.status,
    snapshot.admission.status,
    snapshot.entryPlan.status,
  ].some((status) => ['running', 'loading', 'scanning'].includes(String(status)));
  const reviewFailed = failedStageNames.length > 0;

  const stageLabel = (stage: ReviewStage) => c[stage];
  const columns: TableColumnsType<ReviewArtifact> = [
    {
      title: c.candidate,
      dataIndex: 'symbol',
      key: 'symbol',
      fixed: 'left',
      width: 150,
      render: (symbol: string, item) => <div className="rw-review-symbol"><strong>{symbol}</strong><span>{item.record.companyName || item.record.name || c.unknownCompany}</span></div>,
    },
    {
      title: c.stage,
      dataIndex: 'stage',
      key: 'stage',
      width: 145,
      filters: (['fine', 'validation', 'admission', 'entry', 'execution'] as ReviewStage[]).map((stage) => ({ text: stageLabel(stage), value: stage })),
      onFilter: (value, item) => item.stage === value,
      render: (stage: ReviewStage) => <span className="rw-stage-label"><i />{stageLabel(stage)}</span>,
    },
    {
      title: c.decision,
      dataIndex: 'decision',
      key: 'decision',
      width: 165,
      render: (decision: string) => <Tag color={decisionColor(decision)} bordered={false}>{decision ? localizeKnownToken(decision, isZh) : c.noData}</Tag>,
    },
    {
      title: c.confidence,
      dataIndex: 'score',
      key: 'score',
      width: 140,
      align: 'right',
      sorter: (a, b) => Number(a.score || 0) - Number(b.score || 0),
      render: (score: number | null) => <div className="rw-evidence-score"><strong>{score === null ? '—' : Math.round(score)}</strong><span>{score === null ? '' : '/100'}</span></div>,
    },
    {
      title: c.reason,
      dataIndex: 'reason',
      key: 'reason',
      width: 360,
      render: (reason: string) => <Tooltip title={reason}><p className="rw-review-reason">{reason}</p></Tooltip>,
    },
    {
      title: c.updated,
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 145,
      align: 'right',
      render: (value: string | null) => <span className="rw-date-cell">{formatTimestamp(value, isZh)}</span>,
    },
    {
      title: c.open,
      key: 'open',
      fixed: 'right',
      width: 116,
      align: 'center',
      render: (_value, item) => <Button icon={<LineChartOutlined />} onClick={() => { rememberMarketSymbol(item.symbol); navigate(marketSymbolPath(item.symbol)); }}>{c.analyze}</Button>,
    },
  ];

  return (
    <div className="research-workspace rw-review">
      <header className="rw-hero">
        <div>
          <span className="rw-kicker"><AuditOutlined /> {c.reviewKicker}</span>
          <h1>{c.reviewTitle}</h1>
          <p>{c.reviewSubtitle}</p>
          <div className="rw-hero-meta"><span><i className={pipelineRunning ? 'is-live' : reviewFailed ? 'is-error' : undefined} />{pipelineRunning ? c.currentRun : reviewFailed ? c.pipelineFailed : c.pipelineIdle}</span><span>{snapshot.lastUpdated && reviewSnapshotKnown ? `${c.snapshot}: ${formatTimestamp(snapshot.lastUpdated, isZh)}` : c.noSnapshot}</span></div>
        </div>
        <div className="rw-hero-actions">
          <Button icon={<FundOutlined />} onClick={() => navigate(RESEARCH_CANDIDATES_PATH)}>{c.candidateUniverse}</Button>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={() => navigate(AI_RESEARCH_PATH)}>{c.pipeline}</Button>
        </div>
      </header>

      {pipelineRunning ? (
        <WorkspaceStateBand tone="loading" title={c.loadingTitle} body={reviewSnapshotKnown ? c.loadingSavedBody : c.loadingBody} />
      ) : reviewFailed ? (
        <WorkspaceStateBand tone={reviewSnapshotKnown ? 'stale' : 'error'} title={c.failedTitle} body={reviewSnapshotKnown ? `${c.failedSavedBody}${reviewFailureDetail && reviewFailureDetail !== c.failedBody ? ` ${reviewFailureDetail}` : ''}` : reviewFailureDetail} actionLabel={c.retryPipeline} onAction={() => navigate(AI_RESEARCH_PATH)} />
      ) : !reviewSnapshotKnown ? (
        <WorkspaceStateBand tone="empty" title={c.notLoadedTitle} body={c.notLoadedBody} actionLabel={c.pipeline} onAction={() => navigate(AI_RESEARCH_PATH)} />
      ) : !decisionSnapshotKnown ? (
        <WorkspaceStateBand tone="empty" title={c.noDecisionSnapshotTitle} body={c.noDecisionSnapshotBody} actionLabel={c.pipeline} onAction={() => navigate(AI_RESEARCH_PATH)} />
      ) : null}

      <section className="rw-kpi-ledger rw-review-kpis" aria-label={c.snapshot}>
        {[
          [c.reviewTotal, decisionSnapshotKnown ? artifacts.length : null],
          [c.attention, decisionSnapshotKnown ? reviewRows.length : null],
          [c.ready, decisionSnapshotKnown ? decisions.ready : null],
          [c.watch, decisionSnapshotKnown ? decisions.watch : null],
          [c.blocked, decisionSnapshotKnown ? decisions.block + decisions.needData : null],
          [c.executionQueue, executionStageKnown ? snapshot.aiExecutionCandidates.length : null],
        ].map(([label, value], index) => <article key={String(label)}><span>0{index + 1} / {label}</span><strong>{value === null ? '—' : Number(value).toLocaleString()}</strong><small>{value === null ? c.noData : c.symbols}</small></article>)}
      </section>

      <section className="rw-analysis-grid rw-review-analysis">
        <article className="rw-dark-panel rw-funnel-panel">
          <div className="rw-panel-heading"><div><span>01 / {c.pipelineSection}</span><h2>{c.funnel}</h2></div><p>{c.funnelNote}</p></div>
          {funnelMax > 0 ? (
            <div className="rw-funnel">
              {funnel.map((item, index) => <div key={item.key}><span><b>0{index + 1}</b>{item.label}<small>{localizeKnownToken(item.status, isZh) || c.noData}</small></span><i><strong style={{ width: `${item.count === null || item.count === 0 ? 0 : Math.max(2, (item.count / funnelMax) * 100)}%` }} /></i><em>{item.count === null ? '—' : item.count}</em></div>)}
            </div>
          ) : <EmptyResearchState
            title={pipelineRunning && !reviewSnapshotKnown ? c.loadingTitle : reviewFailed && !reviewSnapshotKnown ? c.failedTitle : !reviewSnapshotKnown ? c.notLoadedTitle : !decisionSnapshotKnown ? c.noDecisionSnapshotTitle : c.noReviewTitle}
            body={pipelineRunning && !reviewSnapshotKnown ? c.loadingBody : reviewFailed && !reviewSnapshotKnown ? reviewFailureDetail : !reviewSnapshotKnown ? c.notLoadedBody : !decisionSnapshotKnown ? c.noDecisionSnapshotBody : c.noReviewBodyClear}
            compact
          />}
        </article>
        <article className="rw-dark-panel rw-decision-panel">
          <div className="rw-panel-heading"><div><span>02 / {c.decisionsSection}</span><h2>{c.decisions}</h2></div><p>{c.decisionsNote}</p></div>
          {decisionTotal > 0 ? (
            <div className="rw-decision-grid">
              {decisionItems.map((item) => <div className={`is-${item.key}`} key={item.key}><span>{item.label}</span><strong>{item.value}</strong><i><b style={{ width: `${(item.value / decisionTotal) * 100}%` }} /></i></div>)}
            </div>
          ) : <EmptyResearchState
            title={pipelineRunning && !decisionSnapshotKnown ? c.loadingTitle : reviewFailed && !decisionSnapshotKnown ? c.failedTitle : !reviewSnapshotKnown ? c.notLoadedTitle : !decisionSnapshotKnown ? c.noDecisionSnapshotTitle : c.noReviewTitle}
            body={pipelineRunning && !decisionSnapshotKnown ? c.loadingBody : reviewFailed && !decisionSnapshotKnown ? reviewFailureDetail : !reviewSnapshotKnown ? c.notLoadedBody : !decisionSnapshotKnown ? c.noDecisionSnapshotBody : c.noReviewBodyClear}
            compact
          />}
        </article>
      </section>

      <section className="rw-table-section">
        <div className="rw-section-heading rw-section-heading--queue">
          <div><span>03 / {c.attentionSection}</span><h2>{c.pendingQueue}</h2></div>
          <p>{c.pendingQueueNote}</p>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} allowClear prefix={<SearchOutlined />} placeholder={c.search} aria-label={c.search} />
        </div>
        <Table<ReviewArtifact>
          className="rw-table rw-review-table"
          rowKey={(item) => `${item.stage}-${item.symbol}`}
          columns={columns}
          dataSource={filteredReviewRows}
          loading={pipelineRunning && !decisionSnapshotKnown}
          scroll={{ x: 1120 }}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 60], showTotal: (total) => `${total} ${c.symbols}` }}
          locale={{
            emptyText: <EmptyResearchState
              title={pipelineRunning && !decisionSnapshotKnown ? c.loadingTitle : reviewFailed && !decisionSnapshotKnown ? c.failedTitle : !reviewSnapshotKnown ? c.notLoadedTitle : !decisionSnapshotKnown ? c.noDecisionSnapshotTitle : reviewRows.length > 0 && filteredReviewRows.length === 0 ? c.noReviewFilteredTitle : c.noReviewTitle}
              body={pipelineRunning && !decisionSnapshotKnown ? c.loadingBody : reviewFailed && !decisionSnapshotKnown ? reviewFailureDetail : !reviewSnapshotKnown ? c.notLoadedBody : !decisionSnapshotKnown ? c.noDecisionSnapshotBody : reviewRows.length > 0 && filteredReviewRows.length === 0 ? c.noReviewFilteredBody : c.noReviewBodyClear}
              actionLabel={reviewFailed ? c.retryPipeline : !decisionSnapshotKnown ? c.pipeline : undefined}
              onAction={reviewFailed || !decisionSnapshotKnown ? () => navigate(AI_RESEARCH_PATH) : undefined}
            />,
          }}
        />
      </section>

      <footer className="rw-source-line"><SafetyCertificateOutlined /><span>{c.readOnly}</span><p>{c.readOnlyNote}</p><Button type="link" onClick={() => navigate(AI_RESEARCH_PATH)}>{c.pipeline} <ArrowRightOutlined /></Button></footer>
    </div>
  );
};

export default CandidateUniversePage;
