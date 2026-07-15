import React from 'react';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import { pipelineAutoAPI, tradingAccountAPI } from '../services/api';
import './ActivityEditorial.css';

type EventKind = 'research' | 'validation' | 'risk' | 'orders' | 'warnings';
type EventStatus = 'success' | 'running' | 'warning' | 'failed' | 'blocked' | 'unknown';

interface ActivityMetric {
  label: string;
  value: string;
}

interface ActivityEvent {
  id: string;
  kind: EventKind;
  timestamp: string | null;
  title: string;
  description: string;
  status: EventStatus;
  source: string;
  metrics: ActivityMetric[];
  evidence?: Record<string, unknown>;
}

interface EvidenceSummary {
  status: EventStatus;
  resultCount: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  trigger: string;
  note: string;
  error: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number | null;
  notional: number | null;
  price: number | null;
  stage: string;
}

interface EvidenceField {
  label: string;
  value: string;
}

type SourcePhase = 'loading' | 'ready' | 'error';
type ErrorCategory = 'session' | 'configuration' | 'rateLimit' | 'timeout' | 'network' | 'generic';

interface SourceLoadState {
  phase: SourcePhase;
  hasLoaded: boolean;
  error: string;
}

interface ActivitySourceState {
  status: SourceLoadState;
  history: SourceLoadState;
  orders: SourceLoadState;
}

const initialSourceLoadState = (): SourceLoadState => ({
  phase: 'loading',
  hasLoaded: false,
  error: '',
});

const errorDetail = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return errorDetail(
    record.response?.data?.detail
    ?? record.response?.data?.error
    ?? record.response?.data?.message
    ?? record.detail
    ?? record.error
    ?? record.message
    ?? record.reason,
  );
};

const errorCategory = (value: unknown): ErrorCategory => {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const status = Number(record.response?.status ?? record.statusCode ?? record.status);
  const detail = errorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid/.test(detail)) return 'configuration';
  return 'generic';
};

const filters: EventKind[] = ['research', 'validation', 'risk', 'orders', 'warnings'];

const safeNumber = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const safeObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const safeEvidenceText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return safeEvidenceText(record.message ?? record.detail ?? record.reason ?? record.description);
  }
  return '';
};

const evidenceValue = (scopes: Record<string, any>[], keys: string[]): unknown => {
  for (const key of keys) {
    for (const scope of scopes) {
      if (scope[key] !== undefined && scope[key] !== null && scope[key] !== '') return scope[key];
    }
  }
  return undefined;
};

const safeEvidenceCount = (value: unknown): number | null => {
  if (Array.isArray(value)) return value.length;
  return safeNumber(value);
};

const safeEvidenceTimestamp = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
};

const summarizeEvidence = (event: ActivityEvent): EvidenceSummary => {
  const evidence = safeObject(event.evidence);
  const summary = safeObject(evidence.summary);
  const result = safeObject(evidence.result);
  const stats = safeObject(evidence.stats);
  const metadata = safeObject(evidence.metadata);
  const progress = safeObject(evidence.progress);
  const scopes = [summary, result, stats, metadata, progress, evidence];
  const startedAt = safeEvidenceTimestamp(evidenceValue(scopes, [
    'started_at', 'startedAt', 'start_time', 'startTime', 'submitted_at', 'submittedAt', 'created_at', 'createdAt',
  ]));
  const finishedAt = safeEvidenceTimestamp(evidenceValue(scopes, [
    'finished_at', 'finishedAt', 'completed_at', 'completedAt', 'end_time', 'endTime', 'filled_at', 'filledAt', 'updated_at', 'updatedAt',
  ])) || event.timestamp;
  const durationMilliseconds = safeNumber(evidenceValue(scopes, ['duration_ms', 'durationMs', 'elapsed_ms', 'elapsedMs']));
  let durationSeconds = safeNumber(evidenceValue(scopes, [
    'duration_seconds', 'durationSeconds', 'elapsed_seconds', 'elapsedSeconds', 'runtime_seconds', 'runtimeSeconds',
  ]));
  if (durationSeconds === null && durationMilliseconds !== null) durationSeconds = durationMilliseconds / 1000;
  if (durationSeconds === null && startedAt && finishedAt) {
    const calculated = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;
    durationSeconds = calculated >= 0 && Number.isFinite(calculated) ? calculated : null;
  }

  const rawStatus = evidenceValue(scopes, ['status', 'state', 'result_status', 'resultStatus', 'outcome']);
  const normalizedStatus = rawStatus === undefined ? event.status : normalizeStatus(rawStatus);
  const countKeys: Record<EventKind, string[]> = {
    research: [
      'scanned', 'scan_count', 'scanCount', 'candidate_count', 'candidateCount', 'output_count', 'outputCount',
      'result_count', 'resultCount', 'results_count', 'resultsCount', 'results',
    ],
    validation: [
      'validation_count', 'validationCount', 'validated', 'validated_count', 'validatedCount', 'result_count',
      'resultCount', 'results_count', 'resultsCount', 'results',
    ],
    risk: [
      'admission_count', 'admissionCount', 'admitted', 'risk_admitted', 'riskAdmitted', 'entry_plan_count',
      'entryPlanCount', 'plans', 'result_count', 'resultCount',
    ],
    orders: ['orders_submitted', 'ordersSubmitted', 'submitted_count', 'submittedCount', 'result_count', 'resultCount'],
    warnings: ['errors', 'error_count', 'errorCount', 'warnings', 'warning_count', 'warningCount'],
  };
  const rawCount = evidenceValue(scopes, countKeys[event.kind]);
  const error = safeEvidenceText(evidenceValue(scopes, [
    'error', 'lastError', 'error_message', 'errorMessage', 'failure_reason', 'failureReason', 'exception',
  ]));
  const note = safeEvidenceText(evidenceValue(scopes, [
    'reason', 'message', 'note', 'description', 'market_status', 'marketStatus', 'label',
  ])) || event.description;

  return {
    status: normalizedStatus,
    resultCount: safeEvidenceCount(rawCount),
    startedAt,
    finishedAt,
    durationSeconds,
    trigger: safeEvidenceText(evidenceValue(scopes, [
      'trigger_type', 'triggerType', 'trigger', 'run_source', 'runSource', 'source', 'submitted_by', 'submittedBy',
    ])) || event.source,
    note: note === error ? '' : note,
    error,
    symbol: safeEvidenceText(evidenceValue(scopes, ['symbol', 'ticker', 'asset'])).toUpperCase(),
    side: safeEvidenceText(evidenceValue(scopes, ['side', 'direction', 'action'])).toLowerCase(),
    orderType: safeEvidenceText(evidenceValue(scopes, ['order_type', 'orderType', 'type'])).toLowerCase(),
    quantity: safeNumber(evidenceValue(scopes, ['filled_qty', 'filledQty', 'qty', 'quantity'])),
    notional: safeNumber(evidenceValue(scopes, ['notional', 'notional_value', 'notionalValue'])),
    price: safeNumber(evidenceValue(scopes, [
      'filled_avg_price', 'filledAvgPrice', 'average_price', 'averagePrice', 'limit_price', 'limitPrice', 'price',
    ])),
    stage: safeEvidenceText(evidenceValue(scopes, ['current_step', 'currentStep', 'stage', 'phase'])),
  };
};

const normalizeStatus = (value: unknown): EventStatus => {
  const status = String(value || '').toLowerCase();
  if (status.includes('success') || status.includes('complete') || status.includes('fill')) return 'success';
  if (status.includes('run') || status.includes('new') || status.includes('accept') || status.includes('pending')) return 'running';
  if (status.includes('fail') || status.includes('error') || status.includes('reject') || status.includes('cancel')) return 'failed';
  if (status.includes('block') || status.includes('skip')) return 'blocked';
  if (status.includes('warn') || status.includes('partial')) return 'warning';
  return 'unknown';
};

const eventTimestamp = (entry: Record<string, any>): string | null => (
  entry.finished_at || entry.finishedAt || entry.started_at || entry.startedAt || entry.created_at || entry.createdAt || null
);

const timestampValue = (value: string | null): number => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const Activity: React.FC = () => {
  const { language } = useLanguage();
  const { tradeMode } = useTradeMode();
  const isChinese = language === 'zh-CN';
  const [activeFilter, setActiveFilter] = React.useState<'all' | EventKind>('all');
  const [visibleLimit, setVisibleLimit] = React.useState(40);
  const [pipelineStatus, setPipelineStatus] = React.useState<Record<string, any> | null>(null);
  const [history, setHistory] = React.useState<Record<string, any>[]>([]);
  const [orders, setOrders] = React.useState<Record<string, any>[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [sourceState, setSourceState] = React.useState<ActivitySourceState>(() => ({
    status: initialSourceLoadState(),
    history: initialSourceLoadState(),
    orders: initialSourceLoadState(),
  }));
  const requestInFlight = React.useRef(false);

  const copy = React.useMemo(() => (isChinese ? {
    kicker: '审计记录 / 研究到执行',
    title: '活动记录',
    intro: '把扫描、验证、风险计划与订单结果放在同一条可追溯时间线上。这里仅显示后台真实记录。',
    refresh: '刷新记录',
    workspace: '打开研究工作区',
    all: '全部',
    research: '研究',
    validation: '验证',
    risk: '风险计划',
    orders: '订单',
    warnings: '异常',
    recordedRuns: '已记录运行',
    visibleEvents: '当前事件',
    currentStage: '当前阶段',
    lastResult: '最近结果',
    issues: '异常记录',
    market: '市场时段',
    scheduler: '调度器',
    circuit: '风险断路器',
    environment: '交易环境',
    active: '运行中',
    ready: '就绪',
    stopped: '未启用',
    open: '打开',
    guarded: '保护中',
    currentRun: '当前运行',
    latestEvidence: '最近一次运行摘要',
    dataSources: '记录来源',
    noActivity: '还没有符合当前筛选条件的活动。',
    noActivityHint: '运行一次研究管线后，扫描与验证记录会出现在这里。',
    sourcePipeline: '研究管线历史',
    sourceOrders: '券商订单记录',
    statusUnavailable: '状态暂不可用',
    loadingState: '正在读取',
    unavailableState: '无法读取',
    offlineState: '离线',
    staleData: '显示上次读取的记录',
    retry: '重试',
    recordsLoading: '正在读取活动记录',
    recordsLoadingHint: '页面正在向研究管线和券商订单接口请求数据。',
    recordsUnavailable: '活动记录暂时无法读取',
    recordsUnavailableHint: '后台没有返回有效记录。请检查服务后重试。',
    filterEmpty: '当前筛选没有匹配记录。',
    filterEmptyHint: '选择其他类型即可查看已读取的活动，不会删除任何记录。',
    historyUnavailable: '研究管线历史无法读取。',
    statusReadUnavailable: '研究引擎状态无法读取。',
    ordersUnavailable: '券商订单记录无法读取。',
    errorSession: '登录会话已失效，请重新登录后再试。',
    errorConfiguration: '当前配置不完整或不适用于这项操作，请检查设置。',
    errorRateLimit: '请求过于频繁，请稍等片刻后重试。',
    errorTimeout: '请求等待超时，请稍后重试。',
    errorNetwork: '暂时无法连接服务，请检查网络和后台状态。',
    errorGeneric: '这项记录暂时无法读取，请稍后重试。',
    errorDetail: '详情',
    lastChecked: '最后检查',
    duration: '耗时',
    scanned: '扫描',
    validated: '验证',
    admitted: '通过风控',
    plans: '风险计划',
    submitted: '订单',
    errors: '错误',
    pipelineRun: '研究管线运行',
    validationStage: '验证阶段完成',
    riskStage: '风险准入与计划',
    executionStage: '执行阶段提交',
    warningEvent: '运行异常',
    runningNow: '研究管线正在运行',
    orderActivity: '券商订单活动',
    details: '查看运行详情',
    evidenceSummary: '运行详情',
    evidenceStatus: '状态',
    evidenceResults: '结果数量',
    evidenceStarted: '开始时间',
    evidenceFinished: '结束时间',
    evidenceDuration: '运行耗时',
    evidenceTrigger: '触发来源',
    evidenceNote: '关键说明',
    evidenceError: '错误信息',
    evidenceSymbol: '标的',
    evidenceSide: '买卖方向',
    evidenceOrderType: '订单类型',
    evidenceQuantity: '数量',
    evidenceNotional: '订单金额',
    evidencePrice: '成交 / 限价',
    evidenceStage: '处理阶段',
    technicalRecord: '技术记录',
    technicalRecordHint: '仅用于排查与客服支持',
    loadMore: '加载更多记录',
    et: '美东时间',
  } : {
    kicker: 'AUDIT TRAIL / RESEARCH TO EXECUTION',
    title: 'Activity',
    intro: 'A single, traceable timeline for scans, validation, risk plans, and order outcomes. Only recorded backend activity is shown.',
    refresh: 'Refresh records',
    workspace: 'Open research workspace',
    all: 'All',
    research: 'Research',
    validation: 'Validation',
    risk: 'Risk plans',
    orders: 'Orders',
    warnings: 'Warnings',
    recordedRuns: 'Recorded runs',
    visibleEvents: 'Visible events',
    currentStage: 'Current stage',
    lastResult: 'Last result',
    issues: 'Recorded issues',
    market: 'Market session',
    scheduler: 'Scheduler',
    circuit: 'Risk circuit',
    environment: 'Environment',
    active: 'Running',
    ready: 'Ready',
    stopped: 'Not enabled',
    open: 'Open',
    guarded: 'Guarded',
    currentRun: 'Current run',
    latestEvidence: 'Latest run summary',
    dataSources: 'Record sources',
    noActivity: 'No activity matches this filter yet.',
    noActivityHint: 'Run the research pipeline to populate scan and validation records.',
    sourcePipeline: 'Research pipeline history',
    sourceOrders: 'Broker order records',
    statusUnavailable: 'Status unavailable',
    loadingState: 'Loading',
    unavailableState: 'Unavailable',
    offlineState: 'Offline',
    staleData: 'Showing the last records loaded',
    retry: 'Try again',
    recordsLoading: 'Loading activity records',
    recordsLoadingHint: 'Reading saved pipeline history and broker order records.',
    recordsUnavailable: 'Activity records are unavailable',
    recordsUnavailableHint: 'The backend did not return a usable record set. Check the service and try again.',
    filterEmpty: 'No records match this filter.',
    filterEmptyHint: 'Choose another activity type to view the records already loaded. Nothing will be removed.',
    historyUnavailable: 'Pipeline history could not be loaded.',
    statusReadUnavailable: 'Research-engine status could not be loaded.',
    ordersUnavailable: 'Broker order records could not be loaded.',
    errorSession: 'Your session is no longer valid. Sign in again, then retry.',
    errorConfiguration: 'The current configuration is missing or invalid for this request.',
    errorRateLimit: 'Too many requests were sent. Wait a moment, then retry.',
    errorTimeout: 'The request timed out. Try again shortly.',
    errorNetwork: 'The service could not be reached. Check the network and backend status.',
    errorGeneric: 'This record could not be loaded. Try again shortly.',
    errorDetail: 'Detail',
    lastChecked: 'Last checked',
    duration: 'Duration',
    scanned: 'Scanned',
    validated: 'Validated',
    admitted: 'Risk admitted',
    plans: 'Risk plans',
    submitted: 'Orders',
    errors: 'Errors',
    pipelineRun: 'Research pipeline run',
    validationStage: 'Validation stage completed',
    riskStage: 'Risk admission and plans',
    executionStage: 'Execution stage submitted',
    warningEvent: 'Run exception',
    runningNow: 'Research pipeline is running',
    orderActivity: 'Broker order activity',
    details: 'View run details',
    evidenceSummary: 'Run details',
    evidenceStatus: 'Status',
    evidenceResults: 'Result count',
    evidenceStarted: 'Started',
    evidenceFinished: 'Finished',
    evidenceDuration: 'Duration',
    evidenceTrigger: 'Triggered by',
    evidenceNote: 'Key note',
    evidenceError: 'Error',
    evidenceSymbol: 'Symbol',
    evidenceSide: 'Side',
    evidenceOrderType: 'Order type',
    evidenceQuantity: 'Quantity',
    evidenceNotional: 'Order value',
    evidencePrice: 'Fill / limit price',
    evidenceStage: 'Processing stage',
    technicalRecord: 'Technical record',
    technicalRecordHint: 'For troubleshooting and support only',
    loadMore: 'Load more records',
    et: 'Eastern Time',
  }), [isChinese]);

  const formatActivityError = React.useCallback((value: unknown, fallback?: string): string => {
    const detail = errorDetail(value);
    const knownFriendly = [
      copy.errorSession,
      copy.errorConfiguration,
      copy.errorRateLimit,
      copy.errorTimeout,
      copy.errorNetwork,
      copy.errorGeneric,
    ].find((label) => detail === label || detail.startsWith(`${label} ${copy.errorDetail}:`));
    if (knownFriendly) return detail;
    const category = errorCategory(value);
    const friendly = {
      session: copy.errorSession,
      configuration: copy.errorConfiguration,
      rateLimit: copy.errorRateLimit,
      timeout: copy.errorTimeout,
      network: copy.errorNetwork,
      generic: fallback || copy.errorGeneric,
    }[category];
    if (isChinese || !detail || detail === friendly) return friendly;
    return `${friendly} ${copy.errorDetail}: ${detail}`;
  }, [copy, isChinese]);

  const formatTime = React.useCallback((value: string | null, includeDate = true) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-US', {
      timeZone: 'America/New_York',
      month: includeDate ? 'short' : undefined,
      day: includeDate ? '2-digit' : undefined,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }, [isChinese]);

  const refresh = React.useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setSourceState((previous) => ({
      status: { ...previous.status, phase: 'loading', error: '' },
      history: { ...previous.history, phase: 'loading', error: '' },
      orders: { ...previous.orders, phase: 'loading', error: '' },
    }));
    const [statusResult, historyResult, orderResult] = await Promise.allSettled([
      pipelineAutoAPI.getStatus(),
      pipelineAutoAPI.getHistory(100),
      tradingAccountAPI.getOrders(tradeMode, 'all'),
    ]);

    const resultError = (result: PromiseSettledResult<any>, fallback: string): string => {
      if (result.status === 'rejected') {
        return formatActivityError(result.reason, fallback);
      }
      return formatActivityError(result.value?.data, fallback);
    };

    const statusSucceeded = statusResult.status === 'fulfilled' && statusResult.value.data?.success;
    const historySucceeded = historyResult.status === 'fulfilled' && historyResult.value.data?.success;
    const orderPayload = orderResult.status === 'fulfilled' ? orderResult.value.data as any : null;
    const ordersSucceeded = orderResult.status === 'fulfilled' && orderPayload?.success !== false;

    if (statusSucceeded) {
      setPipelineStatus(statusResult.value.data);
    }

    if (historySucceeded) {
      setHistory(Array.isArray(historyResult.value.data.history) ? historyResult.value.data.history : []);
    }

    if (ordersSucceeded) {
      const nextOrders = Array.isArray(orderPayload?.orders) ? orderPayload.orders : Array.isArray(orderPayload?.data) ? orderPayload.data : [];
      setOrders(nextOrders);
    }

    setSourceState((previous) => ({
      status: statusSucceeded
        ? { phase: 'ready', hasLoaded: true, error: '' }
        : { phase: 'error', hasLoaded: previous.status.hasLoaded, error: resultError(statusResult, copy.statusReadUnavailable) },
      history: historySucceeded
        ? { phase: 'ready', hasLoaded: true, error: '' }
        : { phase: 'error', hasLoaded: previous.history.hasLoaded, error: resultError(historyResult, copy.historyUnavailable) },
      orders: ordersSucceeded
        ? { phase: 'ready', hasLoaded: true, error: '' }
        : { phase: 'error', hasLoaded: previous.orders.hasLoaded, error: resultError(orderResult, copy.ordersUnavailable) },
    }));

    setLastChecked(new Date());
    setLoading(false);
    requestInFlight.current = false;
  }, [copy.historyUnavailable, copy.ordersUnavailable, copy.statusReadUnavailable, formatActivityError, tradeMode]);

  React.useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const events = React.useMemo<ActivityEvent[]>(() => {
    const next: ActivityEvent[] = [];

    history.forEach((entry, index) => {
      const summary = safeObject(entry.summary);
      const timestamp = eventTimestamp(entry);
      const status = normalizeStatus(entry.status);
      const duration = safeNumber(entry.duration_seconds ?? summary.durationSeconds);
      const scanned = safeNumber(summary.scanned);
      const validated = safeNumber(summary.validation_count ?? summary.validationCount);
      const admitted = safeNumber(summary.admission_count ?? summary.admissionCount);
      const plans = safeNumber(summary.entry_plan_count ?? summary.entryPlanCount);
      const submitted = safeNumber(summary.orders_submitted ?? summary.ordersSubmitted);
      const errors = safeNumber(summary.errors);
      const source = entry.trigger_type || summary.trigger || 'pipeline';
      const rawDescription = String(entry.reason || entry.error || summary.lastError || entry.market_status || '').trim();
      const description = (status === 'failed' || status === 'blocked' || entry.error || summary.lastError)
        ? formatActivityError(rawDescription, copy.errorGeneric)
        : rawDescription;
      const commonEvidence = { ...entry, summary };
      const commonMetrics: ActivityMetric[] = [
        ...(scanned !== null ? [{ label: copy.scanned, value: scanned.toLocaleString() }] : []),
        ...(duration !== null ? [{ label: copy.duration, value: `${Math.round(duration)}s` }] : []),
      ];

      next.push({
        id: `run-${entry.id || timestamp || index}`,
        kind: 'research',
        timestamp,
        title: copy.pipelineRun,
        description: description || (isChinese ? '扫描与候选筛选记录已保存。' : 'Scan and candidate-selection evidence recorded.'),
        status,
        source,
        metrics: commonMetrics,
        evidence: commonEvidence,
      });

      if (validated !== null && validated > 0) {
        next.push({
          id: `validation-${entry.id || timestamp || index}`,
          kind: 'validation',
          timestamp,
          title: copy.validationStage,
          description: isChinese ? '候选项完成独立验证并写入本次运行摘要。' : 'Independent validation results were written to this run summary.',
          status,
          source,
          metrics: [{ label: copy.validated, value: validated.toLocaleString() }],
          evidence: commonEvidence,
        });
      }

      if ((admitted !== null && admitted > 0) || (plans !== null && plans > 0)) {
        next.push({
          id: `risk-${entry.id || timestamp || index}`,
          kind: 'risk',
          timestamp,
          title: copy.riskStage,
          description: isChinese ? '风险准入与入场计划保留在可审计摘要中。' : 'Risk admission and entry-plan evidence retained in the audit summary.',
          status,
          source,
          metrics: [
            ...(admitted !== null ? [{ label: copy.admitted, value: admitted.toLocaleString() }] : []),
            ...(plans !== null ? [{ label: copy.plans, value: plans.toLocaleString() }] : []),
          ],
          evidence: commonEvidence,
        });
      }

      if (submitted !== null && submitted > 0) {
        next.push({
          id: `execution-${entry.id || timestamp || index}`,
          kind: 'orders',
          timestamp,
          title: copy.executionStage,
          description: isChinese ? '本次运行向券商执行层提交了订单。' : 'This run submitted orders to the broker execution layer.',
          status,
          source,
          metrics: [{ label: copy.submitted, value: submitted.toLocaleString() }],
          evidence: commonEvidence,
        });
      }

      if (status === 'failed' || status === 'blocked' || description || (errors !== null && errors > 0)) {
        if (status === 'failed' || status === 'blocked' || (errors !== null && errors > 0) || entry.error) {
          next.push({
            id: `warning-${entry.id || timestamp || index}`,
            kind: 'warnings',
            timestamp,
            title: copy.warningEvent,
            description: description || (isChinese ? '后台记录了失败或阻断状态。' : 'The backend recorded a failed or blocked state.'),
            status: status === 'unknown' ? 'warning' : status,
            source,
            metrics: errors !== null ? [{ label: copy.errors, value: errors.toLocaleString() }] : [],
            evidence: commonEvidence,
          });
        }
      }
    });

    orders.forEach((order, index) => {
      const timestamp = order.updated_at || order.filled_at || order.submitted_at || order.created_at || null;
      const side = String(order.side || '').toUpperCase();
      const symbol = String(order.symbol || '').toUpperCase();
      const qty = safeNumber(order.filled_qty ?? order.qty);
      const price = safeNumber(order.filled_avg_price ?? order.limit_price);
      const metrics: ActivityMetric[] = [];
      if (qty !== null) metrics.push({ label: isChinese ? '数量' : 'Quantity', value: qty.toLocaleString() });
      if (price !== null) metrics.push({ label: isChinese ? '价格' : 'Price', value: `$${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` });
      next.push({
        id: `order-${order.id || timestamp || index}`,
        kind: 'orders',
        timestamp,
        title: `${side || (isChinese ? '订单' : 'ORDER')} ${symbol}`.trim(),
        description: String(order.status || copy.orderActivity),
        status: normalizeStatus(order.status),
        source: `Alpaca · ${tradeMode.toUpperCase()}`,
        metrics,
        evidence: order,
      });
    });

    if (pipelineStatus?.isAutoRunRunning) {
      next.push({
        id: `active-${pipelineStatus.currentAutoRunId || 'pipeline'}`,
        kind: 'research',
        timestamp: pipelineStatus.activeRun?.updatedAt || pipelineStatus.nowEt || null,
        title: copy.runningNow,
        description: String(pipelineStatus.currentAutoStep || pipelineStatus.progress?.label || ''),
        status: 'running',
        source: pipelineStatus.lastRunSource || 'backend scheduler',
        metrics: [{ label: isChinese ? '进度' : 'Progress', value: `${safeNumber(pipelineStatus.currentAutoProgressPct) ?? 0}%` }],
        evidence: pipelineStatus.activeRun || {},
      });
    }

    if (pipelineStatus?.lastError && !next.some((event) => event.kind === 'warnings' && event.description === pipelineStatus.lastError)) {
      next.push({
        id: 'latest-pipeline-error',
        kind: 'warnings',
        timestamp: pipelineStatus.lastRunAt || pipelineStatus.schedulerLastCheckAt || null,
        title: copy.warningEvent,
        description: formatActivityError(pipelineStatus.lastError, copy.errorGeneric),
        status: 'failed',
        source: 'pipeline status',
        metrics: [],
        evidence: { lastError: pipelineStatus.lastError },
      });
    }

    return next.sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp));
  }, [copy, formatActivityError, history, isChinese, orders, pipelineStatus, tradeMode]);

  const visibleEvents = activeFilter === 'all' ? events : events.filter((event) => event.kind === activeFilter);
  const displayedEvents = visibleEvents.slice(0, visibleLimit);
  const issueCount = events.filter((event) => event.kind === 'warnings').length;
  const firstLoad = loading && !lastChecked;
  const failedSources = (Object.entries(sourceState) as Array<[keyof ActivitySourceState, SourceLoadState]>)
    .filter(([, state]) => state.phase === 'error');
  const allRecordSourcesUnavailable = !sourceState.history.hasLoaded
    && !sourceState.orders.hasLoaded
    && sourceState.history.phase === 'error'
    && sourceState.orders.phase === 'error';
  const timelineKnown = sourceState.history.hasLoaded || sourceState.orders.hasLoaded || sourceState.status.hasLoaded;
  const latestSummary = sourceState.status.hasLoaded
    ? safeObject(pipelineStatus?.lastSummary || pipelineStatus?.lastAutoSummary)
    : {};
  const currentStep = pipelineStatus?.currentAutoStep || pipelineStatus?.activeRun?.currentStep || '—';
  const isRunActive = sourceState.status.phase === 'ready' && Boolean(pipelineStatus?.isAutoRunRunning);
  const localizeRuntimeValue = (value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    const labels: Record<string, [string, string]> = {
      OPEN: ['开盘', 'Open'], CLOSED: ['休市', 'Closed'], 'PRE MARKET': ['盘前', 'Pre-market'], 'AFTER HOURS': ['盘后', 'After-hours'],
      RUNNING: ['运行中', 'Running'], COMPLETED: ['已完成', 'Completed'], SUCCESS: ['成功', 'Success'],
      FAILED: ['失败', 'Failed'], BLOCKED: ['已阻断', 'Blocked'], IDLE: ['等待中', 'Idle'],
      PAPER: ['模拟', 'Paper'], REAL: ['实盘', 'Live'],
      'MARKET SCANNER': ['市场扫描', 'Market scanner'], 'FINE SCAN': ['精细扫描', 'Fine scan'],
      'DEEPER VALIDATION': ['深度验证', 'Deeper validation'], 'PORTFOLIO ADMISSION': ['组合准入', 'Portfolio admission'],
      'ENTRY PLAN': ['入场计划', 'Entry plan'], EXECUTION: ['执行', 'Execution'], 'POSITION EXIT': ['持仓与退出', 'Position & exit'],
      'MANUAL TRIGGER': ['手动触发', 'Manual trigger'], SCHEDULER: ['定时调度', 'Scheduler'],
    };
    const known = labels[normalized];
    if (known) return known[isChinese ? 0 : 1];
    if (isChinese && /MARKET CLOSED/i.test(raw)) return '市场已休市';
    return raw.replace(/_/g, ' ');
  };
  const statusPendingWithoutData = sourceState.status.phase === 'loading' && !sourceState.status.hasLoaded;
  const statusUnavailable = sourceState.status.phase === 'error';
  const stageValue = statusPendingWithoutData
    ? copy.loadingState
    : !sourceState.status.hasLoaded
      ? copy.unavailableState
      : isRunActive
        ? localizeRuntimeValue(currentStep)
        : localizeRuntimeValue(pipelineStatus?.lastBackendRunStatus || pipelineStatus?.autoStatus || '—');
  const marketLabel = statusPendingWithoutData
    ? copy.loadingState
    : statusUnavailable
      ? copy.unavailableState
      : pipelineStatus?.marketStatus
        ? localizeRuntimeValue(pipelineStatus.marketStatus)
        : copy.statusUnavailable;
  const schedulerLabel = statusPendingWithoutData
    ? copy.loadingState
    : statusUnavailable
      ? copy.unavailableState
      : !pipelineStatus?.enabled
        ? copy.stopped
        : pipelineStatus?.schedulerRunning
          ? copy.ready
          : copy.offlineState;
  const circuitLabel = statusPendingWithoutData
    ? copy.loadingState
    : statusUnavailable
      ? copy.unavailableState
      : pipelineStatus?.circuitBreakerOpen
        ? copy.open
        : copy.guarded;
  const sourceNoticeText = failedSources
    .map(([, state]) => state.error)
    .filter((message, index, messages) => Boolean(message) && messages.indexOf(message) === index)
    .join(' ');

  const filterLabel = (filter: 'all' | EventKind) => copy[filter];

  React.useEffect(() => {
    setVisibleLimit(40);
  }, [activeFilter]);
  const statusLabel = (status: EventStatus) => {
    const labels = isChinese
      ? { success: '成功', running: '运行中', warning: '注意', failed: '失败', blocked: '已阻断', unknown: '已记录' }
      : { success: 'Success', running: 'Running', warning: 'Attention', failed: 'Failed', blocked: 'Blocked', unknown: 'Recorded' };
    return labels[status];
  };
  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return '—';
    if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
  };
  const formatMoney = (value: number) => new Intl.NumberFormat(isChinese ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
  const readableToken = (value: string) => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const labels: Record<string, [string, string]> = {
      auto_run_now: ['手动运行', 'Manual run'],
      manual_trigger: ['手动运行', 'Manual run'],
      manual: ['手动运行', 'Manual run'],
      scheduler: ['定时调度', 'Scheduled run'],
      background_scheduler: ['后台调度', 'Background schedule'],
      pipeline: ['研究管线', 'Research pipeline'],
      backend_scheduler: ['后台调度', 'Backend schedule'],
      buy: ['买入', 'Buy'],
      sell: ['卖出', 'Sell'],
      market: ['市价单', 'Market'],
      limit: ['限价单', 'Limit'],
      stop: ['止损单', 'Stop'],
      stop_limit: ['止损限价单', 'Stop limit'],
      trailing_stop: ['跟踪止损单', 'Trailing stop'],
    };
    if (labels[normalized]) return labels[normalized][isChinese ? 0 : 1];
    const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    if (!words) return '—';
    return isChinese ? words : words.replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  const resultLabel = (kind: EventKind) => ({
    research: copy.scanned,
    validation: copy.validated,
    risk: copy.admitted,
    orders: copy.submitted,
    warnings: copy.errors,
  })[kind];
  const buildEvidenceFields = (event: ActivityEvent, summary: EvidenceSummary): EvidenceField[] => [
    { label: copy.evidenceStatus, value: statusLabel(summary.status) },
    ...(summary.symbol ? [{ label: copy.evidenceSymbol, value: summary.symbol }] : []),
    ...(summary.side ? [{ label: copy.evidenceSide, value: readableToken(summary.side) }] : []),
    ...(summary.orderType ? [{ label: copy.evidenceOrderType, value: readableToken(summary.orderType) }] : []),
    ...(summary.resultCount !== null ? [{ label: resultLabel(event.kind), value: summary.resultCount.toLocaleString() }] : []),
    ...(summary.quantity !== null ? [{ label: copy.evidenceQuantity, value: summary.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 }) }] : []),
    ...(summary.notional !== null ? [{ label: copy.evidenceNotional, value: formatMoney(summary.notional) }] : []),
    ...(summary.price !== null ? [{ label: copy.evidencePrice, value: formatMoney(summary.price) }] : []),
    ...(summary.stage ? [{ label: copy.evidenceStage, value: readableToken(summary.stage) }] : []),
    ...(summary.startedAt ? [{ label: copy.evidenceStarted, value: formatTime(summary.startedAt) }] : []),
    ...(summary.finishedAt ? [{ label: copy.evidenceFinished, value: formatTime(summary.finishedAt) }] : []),
    ...(summary.durationSeconds !== null ? [{ label: copy.evidenceDuration, value: formatDuration(summary.durationSeconds) }] : []),
    ...(summary.trigger ? [{ label: copy.evidenceTrigger, value: readableToken(summary.trigger) }] : []),
  ];

  return (
    <div className="activity-page">
      <div className="activity-page__canvas">
        <header className="activity-page__hero">
          <div>
            <span className="activity-page__kicker">{copy.kicker}</span>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
          <div className="activity-page__hero-actions">
            <span>{copy.lastChecked}<strong>{lastChecked ? `${formatTime(lastChecked.toISOString(), false)} ET` : '—'}</strong></span>
            <button type="button" onClick={() => void refresh()} disabled={loading}>
              <ReloadOutlined className={loading ? 'is-spinning' : undefined} />
              {copy.refresh}
            </button>
            <Link to="/agent">{copy.workspace}<ArrowRightOutlined /></Link>
          </div>
        </header>

        <section className="activity-page__ledger" aria-label={isChinese ? '活动摘要' : 'Activity summary'}>
          <article><span>01 / {copy.recordedRuns}</span><strong>{sourceState.history.hasLoaded ? history.length.toLocaleString() : '—'}</strong><small>{sourceState.history.phase === 'error' && sourceState.history.hasLoaded ? copy.staleData : copy.sourcePipeline}</small></article>
          <article><span>02 / {copy.visibleEvents}</span><strong>{timelineKnown ? visibleEvents.length.toLocaleString() : '—'}</strong><small>{filterLabel(activeFilter)}</small></article>
          <article><span>03 / {isRunActive ? copy.currentStage : copy.lastResult}</span><strong className="is-text">{stageValue}</strong><small>{isRunActive ? copy.active : formatTime(pipelineStatus?.lastRunAt || null)}</small></article>
          <article><span>04 / {copy.issues}</span><strong className={timelineKnown ? (issueCount > 0 ? 'is-negative' : 'is-positive') : undefined}>{timelineKnown ? issueCount.toLocaleString() : '—'}</strong><small>{!timelineKnown ? copy.statusUnavailable : issueCount > 0 ? (isChinese ? '需要复核' : 'Needs review') : (isChinese ? '未记录异常' : 'No recorded issues')}</small></article>
        </section>

        <section className="activity-page__runtime" aria-label={isChinese ? '运行状态' : 'Runtime status'}>
          <div><span>{copy.market}</span><strong>{marketLabel}</strong><i className={sourceState.status.phase !== 'ready' ? 'is-neutral' : pipelineStatus?.marketOpen ? 'is-ok' : 'is-neutral'} /></div>
          <div><span>{copy.scheduler}</span><strong>{schedulerLabel}</strong><i className={sourceState.status.phase !== 'ready' ? 'is-neutral' : pipelineStatus?.schedulerRunning ? 'is-ok' : pipelineStatus?.enabled ? 'is-error' : 'is-neutral'} /></div>
          <div><span>{copy.circuit}</span><strong>{circuitLabel}</strong><i className={sourceState.status.phase !== 'ready' ? 'is-neutral' : pipelineStatus?.circuitBreakerOpen ? 'is-error' : 'is-ok'} /></div>
          <div><span>{copy.environment}</span><strong>{localizeRuntimeValue(tradeMode)}</strong><i className={tradeMode === 'real' ? 'is-error' : 'is-ok'} /></div>
        </section>

        {failedSources.length > 0 && (
          <div className="activity-page__notice" role="alert">
            <WarningOutlined />
            <span>{sourceNoticeText}{failedSources.some(([, state]) => state.hasLoaded) ? ` ${copy.staleData}.` : ''}</span>
            <button type="button" onClick={() => void refresh()} disabled={loading}><ReloadOutlined />{copy.retry}</button>
          </div>
        )}

        <div className="activity-page__toolbar">
          <div role="tablist" aria-label={isChinese ? '活动筛选' : 'Activity filters'}>
            {(['all', ...filters] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                className={activeFilter === filter ? 'is-active' : undefined}
                onClick={() => setActiveFilter(filter)}
              >
                {filterLabel(filter)}
                <span>{filter === 'all' ? events.length : events.filter((event) => event.kind === filter).length}</span>
              </button>
            ))}
          </div>
          <span>{copy.et}</span>
        </div>

        <div className="activity-page__workspace">
          <section className="activity-page__feed" aria-live="polite">
            <div className="activity-page__feed-head">
              <span>{isChinese ? '时间' : 'TIME'}</span>
              <span>{isChinese ? '类型与结果' : 'TYPE & RESULT'}</span>
              <span>{isChinese ? '运行详情' : 'RUN DETAILS'}</span>
              <span>{isChinese ? '来源' : 'SOURCE'}</span>
            </div>
            {visibleEvents.length === 0 ? (
              <div className="activity-page__empty">
                {allRecordSourcesUnavailable ? <WarningOutlined /> : <ClockCircleOutlined />}
                <h2>{firstLoad ? copy.recordsLoading : allRecordSourcesUnavailable ? copy.recordsUnavailable : activeFilter !== 'all' && events.length > 0 ? copy.filterEmpty : copy.noActivity}</h2>
                <p>{firstLoad ? copy.recordsLoadingHint : allRecordSourcesUnavailable ? copy.recordsUnavailableHint : activeFilter !== 'all' && events.length > 0 ? copy.filterEmptyHint : copy.noActivityHint}</p>
                {allRecordSourcesUnavailable && <button type="button" onClick={() => void refresh()} disabled={loading}><ReloadOutlined />{copy.retry}</button>}
              </div>
            ) : displayedEvents.map((event) => {
              const evidenceSummary = summarizeEvidence(event);
              const evidenceFields = buildEvidenceFields(event, evidenceSummary);
              return (
              <article className={`activity-event activity-event--${event.status}`} key={event.id}>
                <time dateTime={event.timestamp || undefined}>{formatTime(event.timestamp)}</time>
                <div className="activity-event__identity">
                  <span className={`activity-event__status activity-event__status--${event.status}`}>
                    {event.status === 'success' ? <CheckCircleOutlined /> : event.status === 'failed' || event.status === 'blocked' ? <WarningOutlined /> : <ClockCircleOutlined />}
                    {statusLabel(event.status)}
                  </span>
                  <small>{filterLabel(event.kind)}</small>
                </div>
                <div className="activity-event__body">
                  <h2>{event.title}</h2>
                  <p>{event.description || '—'}</p>
                  {event.metrics.length > 0 && (
                    <div className="activity-event__metrics">
                      {event.metrics.map((metric) => <span key={`${event.id}-${metric.label}`}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}
                    </div>
                  )}
                  {event.evidence && Object.keys(event.evidence).length > 0 && (
                    <details className="activity-event__evidence-details">
                      <summary>{copy.details}</summary>
                      <section className="activity-event__evidence-card" aria-label={copy.evidenceSummary}>
                        <div className="activity-event__evidence-head">
                          <span>{copy.evidenceSummary}</span>
                          <strong className={`activity-event__evidence-state activity-event__evidence-state--${evidenceSummary.status}`}>
                            {statusLabel(evidenceSummary.status)}
                          </strong>
                        </div>
                        <dl className="activity-event__evidence-grid">
                          {evidenceFields.map((field) => (
                            <div key={`${event.id}-${field.label}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                          ))}
                        </dl>
                        {evidenceSummary.note && (
                          <div className="activity-event__evidence-note">
                            <span>{copy.evidenceNote}</span>
                            <p>{event.status === 'failed' || event.status === 'blocked' || event.status === 'warning'
                              ? formatActivityError(evidenceSummary.note, copy.errorGeneric)
                              : evidenceSummary.note}</p>
                          </div>
                        )}
                        {evidenceSummary.error && (
                          <div className="activity-event__evidence-note activity-event__evidence-note--error">
                            <span>{copy.evidenceError}</span>
                            <p>{formatActivityError(evidenceSummary.error, copy.errorGeneric)}</p>
                          </div>
                        )}
                        {!isChinese && <details className="activity-event__technical-record">
                          <summary>
                            <span>{copy.technicalRecord}</span>
                            <small>{copy.technicalRecordHint}</small>
                          </summary>
                          <pre>{JSON.stringify(event.evidence, null, 2)}</pre>
                        </details>}
                      </section>
                    </details>
                  )}
                </div>
                <span className="activity-event__source">{event.source}</span>
              </article>
              );
            })}
            {visibleLimit < visibleEvents.length && (
              <button
                type="button"
                className="activity-page__load-more"
                onClick={() => setVisibleLimit((current) => current + 40)}
              >
                {copy.loadMore}
                <span>{visibleEvents.length - displayedEvents.length}</span>
              </button>
            )}
          </section>

          <aside className="activity-page__side">
            <section className="activity-page__side-dark">
              <span className="activity-page__side-kicker">01 / {copy.currentRun}</span>
              <h2>{statusPendingWithoutData ? copy.loadingState : statusUnavailable ? copy.unavailableState : isRunActive ? localizeRuntimeValue(currentStep) : localizeRuntimeValue(pipelineStatus?.autoStatus || copy.stopped)}</h2>
              <div className="activity-page__progress" aria-label={`${isRunActive ? pipelineStatus?.currentAutoProgressPct || 0 : 0}%`}>
                <i style={{ width: `${isRunActive ? Math.max(0, Math.min(100, safeNumber(pipelineStatus?.currentAutoProgressPct) ?? 0)) : 0}%` }} />
              </div>
              <p>{statusPendingWithoutData
                ? copy.recordsLoadingHint
                : statusUnavailable
                  ? sourceState.status.error || copy.recordsUnavailableHint
                  : pipelineStatus?.progress?.label
                    || (pipelineStatus?.lastBackendRunReason && /fail|error|block/i.test(String(pipelineStatus?.lastBackendRunStatus || pipelineStatus?.autoStatus || ''))
                      ? formatActivityError(pipelineStatus.lastBackendRunReason, copy.errorGeneric)
                      : pipelineStatus?.lastBackendRunReason)
                    || (isChinese ? '后台研究引擎等待下一次运行。' : 'The research engine is waiting for its next run.')}</p>
              <dl>
                <div><dt>{isChinese ? '调度间隔' : 'Interval'}</dt><dd>{sourceState.status.hasLoaded && pipelineStatus?.intervalMinutes ? `${pipelineStatus.intervalMinutes} min` : '—'}</dd></div>
                <div><dt>{isChinese ? '今日运行' : 'Runs today'}</dt><dd>{sourceState.status.hasLoaded ? (safeNumber(pipelineStatus?.runCountToday)?.toLocaleString() ?? '—') : '—'}</dd></div>
                <div><dt>{isChinese ? '最近运行' : 'Last run'}</dt><dd>{sourceState.status.hasLoaded ? formatTime(pipelineStatus?.lastRunAt || null) : '—'}</dd></div>
              </dl>
            </section>

            <section className="activity-page__evidence">
              <span className="activity-page__side-kicker">02 / {copy.latestEvidence}</span>
              {[
                [copy.scanned, latestSummary.scanned],
                [copy.validated, latestSummary.validation_count ?? latestSummary.validationCount],
                [copy.admitted, latestSummary.admission_count ?? latestSummary.admissionCount],
                [copy.plans, latestSummary.entry_plan_count ?? latestSummary.entryPlanCount],
                [copy.submitted, latestSummary.orders_submitted ?? latestSummary.ordersSubmitted],
                [copy.errors, latestSummary.errors],
              ].map(([label, value]) => (
                <div key={String(label)}><span>{String(label)}</span><strong>{safeNumber(value)?.toLocaleString() ?? '—'}</strong></div>
              ))}
            </section>

            <section className="activity-page__sources">
              <span className="activity-page__side-kicker">03 / {copy.dataSources}</span>
              <p><i className={sourceState.history.phase === 'ready' ? 'is-ok' : sourceState.history.phase === 'error' ? 'is-error' : 'is-neutral'} />{copy.sourcePipeline}<small>{sourceState.history.hasLoaded ? `${history.length} ${isChinese ? '次运行' : 'runs'}` : sourceState.history.phase === 'loading' ? copy.loadingState : copy.unavailableState}</small></p>
              <p><i className={sourceState.orders.phase === 'ready' ? 'is-ok' : sourceState.orders.phase === 'error' ? 'is-error' : 'is-neutral'} />{copy.sourceOrders}<small>{sourceState.orders.hasLoaded ? `${orders.length} ${isChinese ? '条记录' : 'records'}` : sourceState.orders.phase === 'loading' ? copy.loadingState : copy.unavailableState}</small></p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Activity;
