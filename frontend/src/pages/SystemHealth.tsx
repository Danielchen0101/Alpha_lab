import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import api, {
  API_BASE_URL,
  ConfigStatusLoadResult,
  ConfigStatusResponse,
  loadConfigStatus,
  pipelineAutoAPI,
} from '../services/api';
import { getDashboardStatus } from '../services/marketDataService';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import './SystemHealthEditorial.css';

type Tone = 'good' | 'attention' | 'critical' | 'neutral' | 'checking';
type ErrorCategory = 'session' | 'configuration' | 'rateLimit' | 'timeout' | 'network' | 'generic';

const systemErrorDetail = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return systemErrorDetail(
    record.response?.data?.detail
    ?? record.response?.data?.error
    ?? record.response?.data?.message
    ?? record.detail
    ?? record.error
    ?? record.message,
  );
};

const systemErrorCategory = (value: unknown): ErrorCategory => {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const status = Number(record.response?.status ?? record.statusCode ?? record.status);
  const detail = systemErrorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid/.test(detail)) return 'configuration';
  return 'generic';
};

type ExtendedConfigStatus = ConfigStatusResponse & {
  ai?: ConfigStatusResponse['ai'] & {
    provider?: string;
    model?: string;
    keySource?: string;
    lastTestedAt?: string | null;
  };
  alpacaMarketData?: ConfigStatusResponse['alpacaMarketData'] & {
    baseUrl?: string;
    keySource?: string;
    credentialSource?: string;
  };
  finnhub?: ConfigStatusResponse['finnhub'] & {
    keySource?: string;
  };
};

interface DashboardStatus {
  marketData: string;
  quoteFeed: string;
  brokerConnection: string;
  environment: string;
  hasAlpacaConfig?: boolean;
  hasFinnhubConfig?: boolean;
  configStatus?: string;
}

interface PipelineStatus {
  success?: boolean;
  enabled?: boolean;
  schedulerRunning?: boolean;
  autoStatus?: string;
  marketStatus?: string;
  marketStage?: string;
  mode?: string;
  tradeMode?: string;
  intervalMinutes?: number;
  isRunning?: boolean;
  isAutoRunRunning?: boolean;
  staleDetected?: boolean;
  circuitBreakerOpen?: boolean;
  lastRunAt?: string;
  lastBackendRunAt?: string;
  lastBackendRunStatus?: string;
  lastError?: string;
  lastAutoError?: string;
  consecutiveFailures?: number;
  discordEnabled?: boolean;
  contextSource?: string;
}

interface HealthResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

interface HealthSnapshot {
  config: ConfigStatusLoadResult | null;
  dashboard: DashboardStatus | null;
  pipeline: PipelineStatus | null;
  pipelineError: string;
  health: HealthResult | null;
}

interface StateLabel {
  label: string;
  tone: Tone;
}

interface ServiceRecord {
  key: string;
  name: string;
  role: string;
  runtime: StateLabel;
  configuration: StateLabel;
  verification: StateLabel;
  source: string;
  checkedAt: string;
  needsAction?: boolean;
}

interface AttentionItem {
  key: string;
  title: string;
  description: string;
  severity: 'attention' | 'critical';
  action?: 'refresh' | 'configure';
}

const initialSnapshot: HealthSnapshot = {
  config: null,
  dashboard: null,
  pipeline: null,
  pipelineError: '',
  health: null,
};

const formatEtTime = (date: Date | null, includeDate = false): string => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: includeDate ? 'short' : undefined,
    day: includeDate ? '2-digit' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

const formatIsoTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : `${formatEtTime(date, true)} ET`;
};

const normalizeSource = (value?: string): string => {
  if (!value || value === 'missing' || value === 'none') return '—';
  return value.replace(/_/g, ' ').replace(/\//g, ' / ');
};

const StatusMark: React.FC<StateLabel & { compact?: boolean }> = ({ label, tone, compact = false }) => (
  <span className={`sh-status sh-status--${tone}${compact ? ' sh-status--compact' : ''}`}>
    <i aria-hidden="true" />
    {label}
  </span>
);

const LatencySparkline: React.FC<{ values: number[]; label: string }> = ({ values, label }) => {
  const width = 320;
  const height = 74;
  const inset = 7;
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(...values, maxValue);
  const range = Math.max(1, maxValue - minValue);
  const points = values.map((value, index) => {
    const x = values.length === 1
      ? width / 2
      : inset + (index / (values.length - 1)) * (width - inset * 2);
    const y = height - inset - ((value - minValue) / range) * (height - inset * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const singleValueY = values.length === 1
    ? height - inset - ((values[0] - minValue) / range) * (height - inset * 2)
    : null;
  const linePoints = values.length === 1 && singleValueY !== null
    ? `${inset},${singleValueY.toFixed(1)} ${width - inset},${singleValueY.toFixed(1)}`
    : points;

  return (
    <svg
      className="sh-latency-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <line x1="0" y1={height - inset} x2={width} y2={height - inset} className="sh-latency-chart__axis" />
      {values.length > 0 && <polyline points={linePoints} className="sh-latency-chart__line" />}
      {values.map((value, index) => {
        const point = values.length === 1
          ? `${width - inset},${singleValueY?.toFixed(1)}`
          : points.split(' ')[index];
        const [x, y] = point.split(',');
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="2.8" className="sh-latency-chart__point" />;
      })}
    </svg>
  );
};

const SystemHealth: React.FC = () => {
  const { language } = useLanguage();
  const { tradeMode } = useTradeMode();
  const isZh = language === 'zh-CN';
  const [snapshot, setSnapshot] = React.useState<HealthSnapshot>(initialSnapshot);
  const [checking, setChecking] = React.useState(true);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [latencyHistory, setLatencyHistory] = React.useState<number[]>([]);
  const requestIdRef = React.useRef(0);

  const ui = React.useMemo(() => (isZh ? {
    eyebrow: '概览 · 系统健康',
    title: '系统运行状态',
    subtitle: '查看运行时、外部服务配置和研究引擎状态。配置完成与连接验证在这里分别显示。',
    refresh: '重新检查',
    checking: '检查中',
    checked: '检查时间',
    overall: '整体状态',
    operational: '运行正常',
    actionNeeded: '需要处理',
    unavailable: '暂不可用',
    verifying: '正在验证',
    checksInProgress: '正在读取后台、配置与研究引擎状态。',
    currentChecks: '基于当前真实检查结果',
    runtime: '运行时',
    marketData: '行情数据',
    broker: '券商连接',
    research: '研究引擎',
    apiReachable: 'API 可达',
    apiUnavailable: 'API 不可达',
    responseTime: '响应时间',
    online: '可用',
    ready: '就绪',
    needsSetup: '需要配置',
    paperReady: '模拟环境已配置',
    liveReady: '实盘环境已配置',
    notConfigured: '未配置',
    running: '运行中',
    armed: '已启用',
    disabled: '未启用',
    schedulerOffline: '调度器离线',
    endpointVerified: '端点本次已验证',
    configurationDerived: '由配置状态推断',
    notIndependentlyVerified: '未独立验证',
    dependencyLedger: '服务依赖清单',
    dependencySubtitle: '运行、配置和验证是三种不同状态；这里不会把“已保存密钥”误写为“已连接”。',
    service: '服务',
    runtimeColumn: '运行状态',
    configuration: '配置状态',
    verification: '验证状态',
    source: '来源 / 环境',
    lastCheck: '最后验证',
    action: '操作',
    configure: '修复配置',
    builtIn: '内置',
    available: '可用',
    authenticated: '已认证',
    authUnavailable: '认证异常',
    configured: '已配置',
    configuredNotChecked: '未检查连接',
    configuredOffline: '当前离线',
    checkUnavailable: '无法检查',
    offline: '离线',
    verified: '已验证',
    verificationFailed: '验证失败',
    notVerified: '未验证',
    noTestRecord: '无测试记录',
    partial: '部分可用',
    backendRole: '应用 API 与状态检查',
    authRole: '会话与用户配置读取',
    paperRole: '模拟交易执行凭证',
    liveRole: '实盘交易执行凭证',
    dataRole: '快照、K 线与报价数据',
    fallbackRole: '备用报价与基本面数据',
    aiRole: '研究分析与模型推理',
    pipelineRole: '自动研究管线与调度器',
    attention: '需要关注',
    attentionSubtitle: '只显示真实检查发现的问题，并提供对应修复入口。',
    noBlockingIssues: '当前检查未发现阻断问题',
    noBlockingIssuesDesc: '未独立测试的服务仍会保持“未验证”，不会被推断为已连接。',
    environmentSecurity: '环境与安全摘要',
    tradingMode: '交易模式',
    currentEnvironment: '当前环境',
    quoteFeed: '报价源',
    apiEndpoint: 'API 端点',
    researchMode: '研究模式',
    marketWindow: '市场窗口',
    credentialPolicy: '凭证策略',
    credentialPolicyValue: '本页不显示或回传原始密钥',
    paper: '模拟',
    real: '实盘',
    thisSession: '本次页面会话',
    browserToApi: '浏览器至 API 的真实响应耗时',
    samples: '次样本',
    refreshForSample: '每次重新检查会增加一个真实样本。',
    backendProblem: '后端 API 当前不可达',
    backendProblemDesc: '健康检查没有收到有效响应。请确认后端服务正在运行。',
    configProblem: '配置状态无法读取',
    marketProblem: '行情数据尚未配置',
    marketProblemDesc: '当前没有可用的 Alpaca 或 Finnhub 行情配置。',
    marketCheckProblem: '行情运行状态无法读取',
    marketCheckProblemDesc: '已保存行情配置，但本次检查没有得到有效运行状态。',
    marketOfflineProblem: '行情服务已配置，但当前离线',
    brokerProblem: '券商凭证尚未配置',
    brokerProblemDesc: '模拟和实盘 Alpaca 凭证均未配置。',
    aiProblem: 'AI 提供商尚未配置',
    aiProblemDesc: '研究分析需要有效的 AI 提供商密钥。',
    aiTestProblem: 'AI 最近一次验证未通过',
    pipelineProblem: '研究引擎状态无法读取',
    schedulerProblem: '自动研究已启用，但调度器不在线',
    circuitProblem: '研究管线熔断器已打开',
    staleProblem: '检测到停滞的研究任务',
    defaultError: '状态检查失败，请稍后重试。',
    errorSession: '登录会话已失效，请重新登录后再检查。',
    errorConfiguration: '服务配置不完整或无效，请前往设置检查。',
    errorRateLimit: '状态检查过于频繁，请稍等片刻后重试。',
    errorTimeout: '状态检查等待超时，请稍后重试。',
    errorNetwork: '暂时无法连接服务，请检查网络和后台运行状态。',
    errorDetail: '详情',
    dependenciesSection: '服务依赖',
    attentionSection: '待处理项',
    environmentSection: '环境',
    servicesCount: '项服务',
    alpacaPaperName: 'Alpaca 模拟账户',
    alpacaLiveName: 'Alpaca 实盘账户',
    alpacaMarketDataName: 'Alpaca 行情数据',
    aiProviderName: 'AI 提供商',
    researchPipelineName: '研究管线',
  } : {
    eyebrow: 'OVERVIEW · SYSTEM HEALTH',
    title: 'System health',
    subtitle: 'Inspect runtime, external-service configuration, and the research engine. Configured and verified are reported separately.',
    refresh: 'Run checks',
    checking: 'Checking',
    checked: 'Checked',
    overall: 'Overall state',
    operational: 'Operational',
    actionNeeded: 'Action needed',
    unavailable: 'Unavailable',
    verifying: 'Verifying',
    checksInProgress: 'Reading backend, configuration, and research-engine status.',
    currentChecks: 'Based on current, real checks',
    runtime: 'Runtime',
    marketData: 'Market data',
    broker: 'Broker',
    research: 'Research engine',
    apiReachable: 'API reachable',
    apiUnavailable: 'API unavailable',
    responseTime: 'Response time',
    online: 'Available',
    ready: 'Ready',
    needsSetup: 'Setup required',
    paperReady: 'Paper configured',
    liveReady: 'Live configured',
    notConfigured: 'Not configured',
    running: 'Running',
    armed: 'Enabled',
    disabled: 'Disabled',
    schedulerOffline: 'Scheduler offline',
    endpointVerified: 'Endpoint verified now',
    configurationDerived: 'Derived from configuration',
    notIndependentlyVerified: 'Not independently verified',
    dependencyLedger: 'Service dependency ledger',
    dependencySubtitle: 'Runtime, configuration, and verification are distinct states; a saved credential is never presented as a live connection.',
    service: 'Service',
    runtimeColumn: 'Runtime',
    configuration: 'Configuration',
    verification: 'Verification',
    source: 'Source / environment',
    lastCheck: 'Last verified',
    action: 'Action',
    configure: 'Resolve setup',
    builtIn: 'Built in',
    available: 'Available',
    authenticated: 'Authenticated',
    authUnavailable: 'Auth unavailable',
    configured: 'Configured',
    configuredNotChecked: 'Not checked',
    configuredOffline: 'Currently offline',
    checkUnavailable: 'Check unavailable',
    offline: 'Offline',
    verified: 'Verified',
    verificationFailed: 'Verification failed',
    notVerified: 'Not verified',
    noTestRecord: 'No test record',
    partial: 'Partial',
    backendRole: 'Application API and health checks',
    authRole: 'Session and user configuration',
    paperRole: 'Simulated execution credentials',
    liveRole: 'Live execution credentials',
    dataRole: 'Snapshots, bars, and quote data',
    fallbackRole: 'Fallback quotes and fundamentals',
    aiRole: 'Research analysis and model reasoning',
    pipelineRole: 'Automated research pipeline and scheduler',
    attention: 'Attention queue',
    attentionSubtitle: 'Only issues found by real checks are shown, with a direct route to remediation.',
    noBlockingIssues: 'No blocking issues found in this check',
    noBlockingIssuesDesc: 'Services without an independent test remain “not verified”; they are not inferred to be connected.',
    environmentSecurity: 'Environment & security',
    tradingMode: 'Trading mode',
    currentEnvironment: 'Environment',
    quoteFeed: 'Quote feed',
    apiEndpoint: 'API endpoint',
    researchMode: 'Research mode',
    marketWindow: 'Market window',
    credentialPolicy: 'Credential policy',
    credentialPolicyValue: 'Raw credentials are never displayed or returned here',
    paper: 'Paper',
    real: 'Real',
    thisSession: 'This page session',
    browserToApi: 'Measured browser-to-API response time',
    samples: 'samples',
    refreshForSample: 'Each manual check adds one real sample.',
    backendProblem: 'Backend API is unreachable',
    backendProblemDesc: 'The health endpoint did not return a valid response. Confirm that the backend service is running.',
    configProblem: 'Configuration status could not be read',
    marketProblem: 'Market data is not configured',
    marketProblemDesc: 'No usable Alpaca or Finnhub market-data configuration is available.',
    marketCheckProblem: 'Market-data runtime status could not be read',
    marketCheckProblemDesc: 'Market-data configuration is saved, but this check did not return a usable runtime status.',
    marketOfflineProblem: 'Market data is configured but currently offline',
    brokerProblem: 'Broker credentials are not configured',
    brokerProblemDesc: 'Neither paper nor live Alpaca credentials are configured.',
    aiProblem: 'AI provider is not configured',
    aiProblemDesc: 'Research analysis requires a valid AI-provider credential.',
    aiTestProblem: 'The latest AI verification did not pass',
    pipelineProblem: 'Research-engine status could not be read',
    schedulerProblem: 'Auto research is enabled, but its scheduler is offline',
    circuitProblem: 'The research pipeline circuit breaker is open',
    staleProblem: 'A stalled research run was detected',
    defaultError: 'The status check failed. Try again shortly.',
    errorSession: 'Your session is no longer valid. Sign in again, then rerun the checks.',
    errorConfiguration: 'A required service configuration is missing or invalid.',
    errorRateLimit: 'Status checks are being rate limited. Wait a moment, then retry.',
    errorTimeout: 'The status check timed out. Try again shortly.',
    errorNetwork: 'The service could not be reached. Check the network and backend status.',
    errorDetail: 'Detail',
    dependenciesSection: 'Dependencies',
    attentionSection: 'Attention',
    environmentSection: 'Environment',
    servicesCount: 'services',
    alpacaPaperName: 'Alpaca Paper',
    alpacaLiveName: 'Alpaca Live',
    alpacaMarketDataName: 'Alpaca Market Data',
    aiProviderName: 'AI Provider',
    researchPipelineName: 'Research Pipeline',
  }), [isZh]);

  const formatSystemError = React.useCallback((value: unknown, fallback?: string): string => {
    const detail = systemErrorDetail(value);
    const knownFriendly = [
      ui.errorSession,
      ui.errorConfiguration,
      ui.errorRateLimit,
      ui.errorTimeout,
      ui.errorNetwork,
      ui.defaultError,
      ui.backendProblemDesc,
      ui.pipelineProblem,
    ].find((label) => detail === label || detail.startsWith(`${label} ${ui.errorDetail}:`));
    if (knownFriendly) return detail;
    const category = systemErrorCategory(value);
    const friendly = {
      session: ui.errorSession,
      configuration: ui.errorConfiguration,
      rateLimit: ui.errorRateLimit,
      timeout: ui.errorTimeout,
      network: ui.errorNetwork,
      generic: fallback || ui.defaultError,
    }[category];
    if (isZh || !detail || detail === friendly) return friendly;
    return `${friendly} ${ui.errorDetail}: ${detail}`;
  }, [isZh, ui]);

  const localizeRuntimeValue = React.useCallback((value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw || !isZh) return raw || '—';
    const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    const labels: Record<string, string> = {
      ONLINE: '在线', HEALTHY: '健康', CONNECTED: '已连接', DISCONNECTED: '未连接',
      OFFLINE: '离线', ERROR: '无法读取', 'CONFIG REQUIRED': '需要配置', UNKNOWN: '未知', PAPER: '模拟', REAL: '实盘', LIVE: '实盘',
      OPEN: '开盘', CLOSED: '休市', 'PRE MARKET': '盘前', 'AFTER HOURS': '盘后',
      RUNNING: '运行中', IDLE: '等待中', DISABLED: '未启用', ENABLED: '已启用',
      AUTO: '自动', MANUAL: '手动',
    };
    if (labels[normalized]) return labels[normalized];
    if (/ALPACA SANDBOX.*PAPER/i.test(raw)) return 'Alpaca 沙盒（模拟） · 用户级';
    if (/PER[- ]USER/i.test(raw)) return raw.replace(/per[- ]user/ig, '用户级');
    return raw;
  }, [isZh]);

  const runChecks = React.useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setChecking(true);

    const checkHealth = async (): Promise<HealthResult> => {
      const startedAt = performance.now();
      try {
        const response = await api.get('/health', { timeout: 5000 });
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
        return {
          ok: response.status >= 200 && response.status < 300 && response.data?.status === 'ok',
          latencyMs,
          message: response.data?.status === 'ok' ? '' : ui.defaultError,
        };
      } catch (error: any) {
        return {
          ok: false,
          message: formatSystemError(error, ui.backendProblemDesc),
        };
      }
    };

    const [healthResult, configResult, dashboardResult, pipelineResult] = await Promise.allSettled([
      checkHealth(),
      loadConfigStatus({ force: true, timeoutMs: 10000 }),
      getDashboardStatus(),
      pipelineAutoAPI.getStatus(),
    ]);

    if (requestIdRef.current !== requestId) return;

    const health = healthResult.status === 'fulfilled'
      ? healthResult.value
      : { ok: false, message: ui.defaultError };
    const config = configResult.status === 'fulfilled'
      ? configResult.value
      : { ok: false, errorCode: 'connection_check_failed', message: ui.defaultError };
    const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
    const pipelineResponse = pipelineResult.status === 'fulfilled' ? pipelineResult.value.data : null;
    const pipeline = pipelineResponse?.success ? pipelineResponse as PipelineStatus : null;
    const pipelineError = pipelineResult.status === 'rejected'
      ? formatSystemError(pipelineResult.reason, ui.pipelineProblem)
      : (!pipelineResponse?.success ? formatSystemError(pipelineResponse, ui.pipelineProblem) : '');

    setSnapshot({ config, dashboard, pipeline, pipelineError, health });
    setLastChecked(new Date());
    if (health.latencyMs != null) {
      setLatencyHistory(previous => [...previous, health.latencyMs as number].slice(-12));
    }
    setChecking(false);
  }, [formatSystemError, ui.backendProblemDesc, ui.defaultError, ui.pipelineProblem]);

  React.useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const firstCheck = checking && !lastChecked;
  const configData = snapshot.config?.data as ExtendedConfigStatus | undefined;
  const healthOk = snapshot.health?.ok === true;
  const configOk = snapshot.config?.ok === true
    && configData?.success !== false
    && configData?.supabase !== 'error'
    && configData?.auth !== 'error'
    && !snapshot.config?.errorCode;
  const dashboardMarketStatus = String(snapshot.dashboard?.marketData || '').toUpperCase();
  const dashboardBrokerStatus = String(snapshot.dashboard?.brokerConnection || '').toUpperCase();
  const dashboardCheckFailed = Boolean(
    snapshot.dashboard
    && (snapshot.dashboard.configStatus === 'error' || dashboardMarketStatus === 'ERROR')
  );
  const marketExplicitOffline = /OFFLINE|DISCONNECTED/.test(dashboardMarketStatus);
  const brokerExplicitOffline = /OFFLINE|DISCONNECTED/.test(dashboardBrokerStatus);
  const marketConfigured = Boolean(
    configData?.alpacaMarketData?.configured
    || configData?.finnhub?.configured
    || snapshot.dashboard?.hasAlpacaConfig
    || snapshot.dashboard?.hasFinnhubConfig
  );
  const paperConfigured = Boolean(configData?.alpaca?.paperConfigured);
  const liveConfigured = Boolean(configData?.alpaca?.liveConfigured);
  const brokerConfigured = paperConfigured || liveConfigured;
  const aiConfigured = Boolean(configData?.ai?.configured);
  const aiVerified = configData?.ai?.testStatus === 'connected';
  const aiVerificationFailed = Boolean(configData?.ai?.lastTestError || configData?.ai?.keyIsMasked);
  const pipelineReachable = Boolean(snapshot.pipeline?.success);
  const schedulerIssue = Boolean(snapshot.pipeline?.enabled && !snapshot.pipeline?.schedulerRunning);
  const researchCritical = Boolean(snapshot.pipeline?.circuitBreakerOpen || snapshot.pipeline?.staleDetected);

  const attentionItems = React.useMemo<AttentionItem[]>(() => {
    if (firstCheck) return [];
    const items: AttentionItem[] = [];
    if (!healthOk) {
      items.push({
        key: 'backend',
        title: ui.backendProblem,
        description: formatSystemError(snapshot.health?.message, ui.backendProblemDesc),
        severity: 'critical',
        action: 'refresh',
      });
    }
    if (!configOk) {
      items.push({
        key: 'config',
        title: ui.configProblem,
        description: formatSystemError(snapshot.config?.message, ui.errorConfiguration),
        severity: healthOk ? 'attention' : 'critical',
        action: 'refresh',
      });
    }
    if (configOk && !marketConfigured) {
      items.push({ key: 'market', title: ui.marketProblem, description: ui.marketProblemDesc, severity: 'attention', action: 'configure' });
    }
    if (configOk && marketConfigured && dashboardCheckFailed) {
      items.push({ key: 'market-check', title: ui.marketCheckProblem, description: ui.marketCheckProblemDesc, severity: 'attention', action: 'refresh' });
    } else if (configOk && marketConfigured && marketExplicitOffline) {
      items.push({ key: 'market-offline', title: ui.marketOfflineProblem, description: ui.marketCheckProblemDesc, severity: 'attention', action: 'refresh' });
    }
    if (configOk && !brokerConfigured) {
      items.push({ key: 'broker', title: ui.brokerProblem, description: ui.brokerProblemDesc, severity: 'attention', action: 'configure' });
    }
    if (configOk && !aiConfigured) {
      items.push({ key: 'ai', title: ui.aiProblem, description: ui.aiProblemDesc, severity: 'attention', action: 'configure' });
    } else if (aiVerificationFailed) {
      items.push({
        key: 'ai-test',
        title: ui.aiTestProblem,
        description: formatSystemError(configData?.ai?.lastTestError, ui.aiProblemDesc),
        severity: 'attention',
        action: 'configure',
      });
    }
    if (!pipelineReachable) {
      items.push({ key: 'pipeline', title: ui.pipelineProblem, description: formatSystemError(snapshot.pipelineError, ui.pipelineProblem), severity: 'attention', action: 'refresh' });
    }
    if (schedulerIssue) {
      items.push({ key: 'scheduler', title: ui.schedulerProblem, description: formatSystemError(snapshot.pipeline?.lastError, ui.schedulerProblem), severity: 'attention', action: 'configure' });
    }
    if (snapshot.pipeline?.circuitBreakerOpen) {
      items.push({ key: 'circuit', title: ui.circuitProblem, description: formatSystemError(snapshot.pipeline.lastError, ui.circuitProblem), severity: 'critical', action: 'configure' });
    }
    if (snapshot.pipeline?.staleDetected) {
      items.push({ key: 'stale', title: ui.staleProblem, description: formatSystemError(snapshot.pipeline.lastAutoError, ui.staleProblem), severity: 'critical', action: 'configure' });
    }
    return items;
  }, [
    aiConfigured,
    aiVerificationFailed,
    brokerConfigured,
    configData,
    configOk,
    dashboardCheckFailed,
    firstCheck,
    formatSystemError,
    healthOk,
    marketConfigured,
    marketExplicitOffline,
    pipelineReachable,
    schedulerIssue,
    snapshot,
    ui,
  ]);

  const overall: StateLabel = firstCheck
    ? { label: ui.verifying, tone: 'checking' }
    : !healthOk
      ? { label: ui.unavailable, tone: 'critical' }
      : attentionItems.length > 0
        ? { label: ui.actionNeeded, tone: 'attention' }
        : { label: ui.operational, tone: 'good' };

  const researchLabel = firstCheck
    ? ui.checking
    : !pipelineReachable
      ? ui.unavailable
    : snapshot.pipeline?.isRunning || snapshot.pipeline?.isAutoRunRunning
      ? ui.running
      : snapshot.pipeline?.enabled
        ? (snapshot.pipeline.schedulerRunning ? ui.armed : ui.schedulerOffline)
        : ui.disabled;

  const activeBrokerConfigured = tradeMode === 'real' ? liveConfigured : paperConfigured;
  const brokerLabel = firstCheck
    ? ui.checking
    : !configOk
      ? ui.checkUnavailable
      : !activeBrokerConfigured
        ? ui.needsSetup
        : brokerExplicitOffline
          ? ui.configuredOffline
          : ui.configuredNotChecked;

  const marketLabel = firstCheck
    ? ui.checking
    : !configOk
      ? ui.checkUnavailable
      : !marketConfigured
        ? ui.needsSetup
        : dashboardCheckFailed
          ? ui.checkUnavailable
          : marketExplicitOffline
            ? ui.configuredOffline
            : ui.configuredNotChecked;

  const tiles = [
    {
      key: 'runtime',
      index: '01',
      label: ui.runtime,
      value: healthOk ? ui.apiReachable : (checking ? ui.checking : ui.apiUnavailable),
      tone: healthOk ? 'good' as Tone : (checking ? 'checking' as Tone : 'critical' as Tone),
      detail: firstCheck ? ui.checksInProgress : snapshot.health?.latencyMs != null ? `${ui.responseTime} ${snapshot.health.latencyMs} ms` : ui.apiUnavailable,
      footer: healthOk ? ui.endpointVerified : firstCheck ? ui.verifying : ui.currentChecks,
    },
    {
      key: 'market',
      index: '02',
      label: ui.marketData,
      value: marketLabel,
      tone: firstCheck
        ? 'checking' as Tone
        : !configOk || dashboardCheckFailed || marketExplicitOffline
          ? 'attention' as Tone
          : marketConfigured
            ? 'neutral' as Tone
            : 'attention' as Tone,
      detail: firstCheck ? ui.checksInProgress : snapshot.dashboard?.quoteFeed && !dashboardCheckFailed ? `${ui.quoteFeed}: ${localizeRuntimeValue(snapshot.dashboard.quoteFeed)}` : ui.configurationDerived,
      footer: ui.notIndependentlyVerified,
    },
    {
      key: 'broker',
      index: '03',
      label: ui.broker,
      value: brokerLabel,
      tone: firstCheck
        ? 'checking' as Tone
        : !configOk || brokerExplicitOffline
          ? 'attention' as Tone
          : activeBrokerConfigured
            ? 'neutral' as Tone
            : 'attention' as Tone,
      detail: `${ui.tradingMode}: ${tradeMode === 'real' ? ui.real : ui.paper}`,
      footer: ui.notIndependentlyVerified,
    },
    {
      key: 'research',
      index: '04',
      label: ui.research,
      value: researchLabel,
      tone: firstCheck
        ? 'checking' as Tone
        : !pipelineReachable
          ? 'attention' as Tone
        : !snapshot.pipeline?.enabled
          ? 'neutral' as Tone
          : (schedulerIssue || researchCritical ? 'attention' as Tone : 'good' as Tone),
      detail: snapshot.pipeline?.marketStatus ? localizeRuntimeValue(snapshot.pipeline.marketStatus) : ui.currentChecks,
      footer: pipelineReachable ? ui.endpointVerified : ui.notVerified,
    },
  ];

  const services = React.useMemo<ServiceRecord[]>(() => {
    const checkedNow = lastChecked ? `${formatEtTime(lastChecked)} ET` : '—';
    const aiSource = [configData?.ai?.provider, configData?.ai?.model].filter(Boolean).join(' · ')
      || normalizeSource(configData?.ai?.keySource);
    const pendingState: StateLabel = { label: ui.checking, tone: 'checking' };
    const unavailableState: StateLabel = { label: ui.checkUnavailable, tone: 'critical' };
    const savedOnlyState: StateLabel = { label: ui.configuredNotChecked, tone: 'neutral' };
    const offlineState: StateLabel = { label: ui.configuredOffline, tone: 'attention' };

    return [
      {
        key: 'backend',
        name: 'AlphaLab API',
        role: ui.backendRole,
        runtime: firstCheck ? pendingState : { label: healthOk ? ui.online : ui.unavailable, tone: healthOk ? 'good' : 'critical' },
        configuration: { label: ui.builtIn, tone: 'neutral' },
        verification: firstCheck ? pendingState : { label: healthOk ? ui.verified : ui.verificationFailed, tone: healthOk ? 'good' : 'critical' },
        source: API_BASE_URL,
        checkedAt: healthOk ? checkedNow : '—',
        needsAction: !firstCheck && !healthOk,
      },
      {
        key: 'auth',
        name: 'Supabase Auth',
        role: ui.authRole,
        runtime: firstCheck ? pendingState : {
          label: configData?.supabase === 'ok' && configData?.auth === 'ok' ? ui.authenticated : ui.authUnavailable,
          tone: configData?.supabase === 'ok' && configData?.auth === 'ok' ? 'good' : 'critical',
        },
        configuration: firstCheck ? pendingState : { label: configData?.supabase === 'ok' ? ui.available : ui.unavailable, tone: configData?.supabase === 'ok' ? 'good' : 'critical' },
        verification: firstCheck ? pendingState : { label: configOk ? ui.verified : ui.verificationFailed, tone: configOk ? 'good' : 'critical' },
        source: configData?.user?.userId || 'Supabase',
        checkedAt: configOk ? checkedNow : '—',
        needsAction: !firstCheck && !configOk,
      },
      {
        key: 'alpaca-paper',
        name: ui.alpacaPaperName,
        role: ui.paperRole,
        runtime: firstCheck ? pendingState : !configOk ? unavailableState : paperConfigured ? savedOnlyState : { label: ui.needsSetup, tone: 'attention' },
        configuration: firstCheck ? pendingState : !configOk ? unavailableState : { label: paperConfigured ? ui.configured : ui.notConfigured, tone: paperConfigured ? 'good' : 'attention' },
        verification: firstCheck ? pendingState : { label: ui.noTestRecord, tone: 'neutral' },
        source: normalizeSource((configData?.alpaca as any)?.paperKeySource) || ui.paper,
        checkedAt: '—',
        needsAction: !firstCheck && !paperConfigured,
      },
      {
        key: 'alpaca-live',
        name: ui.alpacaLiveName,
        role: ui.liveRole,
        runtime: firstCheck ? pendingState : !configOk ? unavailableState : liveConfigured ? savedOnlyState : { label: ui.needsSetup, tone: 'neutral' },
        configuration: firstCheck ? pendingState : !configOk ? unavailableState : { label: liveConfigured ? ui.configured : ui.notConfigured, tone: liveConfigured ? 'good' : 'neutral' },
        verification: firstCheck ? pendingState : { label: ui.noTestRecord, tone: 'neutral' },
        source: normalizeSource((configData?.alpaca as any)?.liveKeySource) || ui.real,
        checkedAt: '—',
        needsAction: !firstCheck && !liveConfigured && tradeMode === 'real',
      },
      {
        key: 'market-data',
        name: ui.alpacaMarketDataName,
        role: ui.dataRole,
        runtime: firstCheck
          ? pendingState
          : !configOk || dashboardCheckFailed
            ? unavailableState
            : marketExplicitOffline
              ? offlineState
              : marketConfigured
                ? savedOnlyState
                : { label: ui.needsSetup, tone: 'attention' },
        configuration: firstCheck ? pendingState : !configOk ? unavailableState : { label: configData?.alpacaMarketData?.configured ? ui.configured : ui.notConfigured, tone: configData?.alpacaMarketData?.configured ? 'good' : 'attention' },
        verification: firstCheck ? pendingState : { label: ui.notVerified, tone: 'neutral' },
        source: normalizeSource(configData?.alpacaMarketData?.keySource),
        checkedAt: '—',
        needsAction: !firstCheck && !marketConfigured,
      },
      {
        key: 'finnhub',
        name: 'Finnhub',
        role: ui.fallbackRole,
        runtime: firstCheck ? pendingState : !configOk ? unavailableState : configData?.finnhub?.configured ? savedOnlyState : { label: ui.notConfigured, tone: 'neutral' },
        configuration: firstCheck ? pendingState : !configOk ? unavailableState : { label: configData?.finnhub?.configured ? ui.configured : ui.notConfigured, tone: configData?.finnhub?.configured ? 'good' : 'neutral' },
        verification: firstCheck ? pendingState : { label: ui.noTestRecord, tone: 'neutral' },
        source: normalizeSource(configData?.finnhub?.keySource),
        checkedAt: '—',
        needsAction: !firstCheck && !marketConfigured,
      },
      {
        key: 'ai',
        name: configData?.ai?.provider || ui.aiProviderName,
        role: ui.aiRole,
        runtime: firstCheck
          ? pendingState
          : !configOk
            ? unavailableState
            : aiVerified
              ? { label: ui.online, tone: 'good' }
              : aiVerificationFailed
                ? { label: ui.unavailable, tone: 'critical' }
                : aiConfigured
                  ? savedOnlyState
                  : { label: ui.needsSetup, tone: 'attention' },
        configuration: firstCheck ? pendingState : !configOk ? unavailableState : { label: aiConfigured ? ui.configured : ui.notConfigured, tone: aiConfigured ? 'good' : 'attention' },
        verification: firstCheck ? pendingState : { label: aiVerified ? ui.verified : aiVerificationFailed ? ui.verificationFailed : ui.notVerified, tone: aiVerified ? 'good' : aiVerificationFailed ? 'critical' : 'neutral' },
        source: aiSource || '—',
        checkedAt: aiVerified ? formatIsoTime(configData?.ai?.lastTestedAt) : '—',
        needsAction: !firstCheck && (!aiConfigured || aiVerificationFailed),
      },
      {
        key: 'pipeline',
        name: ui.researchPipelineName,
        role: ui.pipelineRole,
        runtime: firstCheck ? pendingState : {
          label: researchLabel,
          tone: !pipelineReachable
            ? 'attention'
            : !snapshot.pipeline?.enabled
              ? 'neutral'
              : (schedulerIssue || researchCritical ? 'critical' : 'good'),
        },
        configuration: firstCheck ? pendingState : !pipelineReachable ? unavailableState : { label: snapshot.pipeline?.enabled ? ui.configured : ui.disabled, tone: snapshot.pipeline?.enabled ? 'good' : 'neutral' },
        verification: firstCheck ? pendingState : { label: pipelineReachable ? ui.verified : ui.verificationFailed, tone: pipelineReachable ? 'good' : 'attention' },
        source: [snapshot.pipeline?.mode, snapshot.pipeline?.contextSource].filter(Boolean).join(' · ') || '—',
        checkedAt: pipelineReachable ? checkedNow : '—',
        needsAction: !firstCheck && (!pipelineReachable || schedulerIssue || researchCritical),
      },
    ];
  }, [
    aiConfigured,
    aiVerificationFailed,
    aiVerified,
    dashboardCheckFailed,
    firstCheck,
    configData,
    configOk,
    healthOk,
    lastChecked,
    liveConfigured,
    marketConfigured,
    marketExplicitOffline,
    paperConfigured,
    pipelineReachable,
    researchCritical,
    researchLabel,
    schedulerIssue,
    snapshot,
    tradeMode,
    ui,
  ]);

  const environmentRows = [
    { label: ui.tradingMode, value: tradeMode === 'real' ? ui.real : ui.paper, tone: tradeMode === 'real' ? 'attention' : 'good' },
    { label: ui.currentEnvironment, value: localizeRuntimeValue(snapshot.dashboard?.environment) },
    { label: ui.quoteFeed, value: localizeRuntimeValue(snapshot.dashboard?.quoteFeed) },
    { label: ui.apiEndpoint, value: API_BASE_URL },
    { label: ui.researchMode, value: localizeRuntimeValue(snapshot.pipeline?.mode) },
    { label: ui.marketWindow, value: localizeRuntimeValue(snapshot.pipeline?.marketStatus) },
  ];

  return (
    <div className="system-health-page">
      <header className="sh-hero">
        <div className="sh-hero__copy">
          <div className="sh-eyebrow">{ui.eyebrow}</div>
          <h1>{ui.title}</h1>
          <p>{ui.subtitle}</p>
        </div>
        <div className="sh-hero__controls">
          <div className="sh-check-time">
            <ClockCircleOutlined />
            <span>{ui.checked}</span>
            <strong>{lastChecked ? `${formatEtTime(lastChecked, true)} ET` : '—'}</strong>
          </div>
          <button type="button" className="sh-refresh" onClick={() => void runChecks()} disabled={checking}>
            <ReloadOutlined className={checking ? 'is-spinning' : undefined} />
            {checking ? ui.checking : ui.refresh}
          </button>
        </div>
      </header>

      <section className={`sh-overall sh-overall--${overall.tone}`} aria-live="polite">
        <div>
          <span className="sh-overall__label">{ui.overall}</span>
          <strong>{overall.label}</strong>
          <p>{firstCheck ? ui.checksInProgress : ui.currentChecks}</p>
        </div>
        <StatusMark label={overall.label} tone={overall.tone} />
      </section>

      <section className="sh-metrics" aria-label={ui.overall}>
        {tiles.map(tile => (
          <article key={tile.key} className={`sh-metric sh-metric--${tile.tone}`}>
            <div className="sh-metric__head">
              <span>{tile.index}</span>
              <StatusMark label={tile.label} tone={tile.tone} compact />
            </div>
            <strong>{tile.value}</strong>
            <p>{tile.detail}</p>
            <small>{tile.footer}</small>
          </article>
        ))}
      </section>

      <section className="sh-panel sh-ledger-panel">
        <div className="sh-section-heading">
          <div>
            <span>01 / {ui.dependenciesSection}</span>
            <h2>{ui.dependencyLedger}</h2>
            <p>{ui.dependencySubtitle}</p>
          </div>
          <span className="sh-record-count">{services.length.toString().padStart(2, '0')} {ui.servicesCount}</span>
        </div>

        <div className="sh-ledger" role="table" aria-label={ui.dependencyLedger}>
          <div className="sh-ledger__header" role="row">
            <span role="columnheader">{ui.service}</span>
            <span role="columnheader">{ui.runtimeColumn}</span>
            <span role="columnheader">{ui.configuration}</span>
            <span role="columnheader">{ui.verification}</span>
            <span role="columnheader">{ui.source}</span>
            <span role="columnheader">{ui.lastCheck}</span>
            <span role="columnheader">{ui.action}</span>
          </div>
          {services.map(service => (
            <div className="sh-ledger__row" role="row" key={service.key}>
              <div className="sh-service-name" role="cell">
                <strong>{service.name}</strong>
                <span>{service.role}</span>
              </div>
              <div role="cell"><StatusMark {...service.runtime} compact /></div>
              <div role="cell"><StatusMark {...service.configuration} compact /></div>
              <div role="cell"><StatusMark {...service.verification} compact /></div>
              <div className="sh-ledger__source" role="cell">{service.source}</div>
              <div className="sh-ledger__time" role="cell">{service.checkedAt}</div>
              <div role="cell">
                {service.needsAction ? (
                  <Link className="sh-row-action" to="/settings/configuration" aria-label={`${ui.configure}: ${service.name}`}>
                    {ui.configure}<ArrowRightOutlined />
                  </Link>
                ) : <CheckOutlined className="sh-row-ok" aria-label={ui.operational} />}
              </div>
            </div>
          ))}
        </div>

        <div className="sh-service-cards" aria-label={ui.dependencyLedger}>
          {services.map(service => (
            <article className="sh-service-card" key={service.key}>
              <div className="sh-service-card__head">
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.role}</span>
                </div>
                <StatusMark {...service.runtime} compact />
              </div>
              <dl>
                <div><dt>{ui.configuration}</dt><dd><StatusMark {...service.configuration} compact /></dd></div>
                <div><dt>{ui.verification}</dt><dd><StatusMark {...service.verification} compact /></dd></div>
                <div><dt>{ui.source}</dt><dd>{service.source}</dd></div>
                <div><dt>{ui.lastCheck}</dt><dd>{service.checkedAt}</dd></div>
              </dl>
              {service.needsAction && (
                <Link className="sh-card-action" to="/settings/configuration">
                  {ui.configure}<ArrowRightOutlined />
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="sh-lower-grid">
        <section className="sh-panel sh-attention-panel">
          <div className="sh-section-heading sh-section-heading--compact">
            <div>
              <span>02 / {ui.attentionSection}</span>
              <h2>{ui.attention}</h2>
              <p>{ui.attentionSubtitle}</p>
            </div>
            <span className={`sh-issue-count ${!firstCheck && attentionItems.length ? 'has-issues' : ''}`}>{firstCheck ? '—' : attentionItems.length}</span>
          </div>

          <div className="sh-attention-list">
            {firstCheck ? (
              <div className="sh-checking-state" role="status">
                <ReloadOutlined className="is-spinning" />
                <div>
                  <strong>{ui.verifying}</strong>
                  <p>{ui.checksInProgress}</p>
                </div>
              </div>
            ) : attentionItems.length === 0 ? (
              <div className="sh-clear-state">
                <CheckOutlined />
                <div>
                  <strong>{ui.noBlockingIssues}</strong>
                  <p>{ui.noBlockingIssuesDesc}</p>
                </div>
              </div>
            ) : attentionItems.map(item => (
              <article key={item.key} className={`sh-issue sh-issue--${item.severity}`}>
                <WarningOutlined />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                {item.action === 'configure' ? (
                  <Link to="/settings/configuration">{ui.configure}<ArrowRightOutlined /></Link>
                ) : (
                  <button type="button" onClick={() => void runChecks()} disabled={checking}>{ui.refresh}</button>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="sh-side-stack">
          <section className="sh-panel sh-environment-panel">
            <div className="sh-section-heading sh-section-heading--compact">
              <div>
                <span>03 / {ui.environmentSection}</span>
                <h2>{ui.environmentSecurity}</h2>
              </div>
              <SafetyCertificateOutlined />
            </div>
            <dl className="sh-environment-list">
              {environmentRows.map(row => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.tone ? `is-${row.tone}` : undefined}>{row.value}</dd>
                </div>
              ))}
              <div className="sh-environment-list__policy">
                <dt>{ui.credentialPolicy}</dt>
                <dd>{ui.credentialPolicyValue}</dd>
              </div>
            </dl>
          </section>

          <section className="sh-panel sh-latency-panel">
            <div className="sh-latency-head">
              <div>
                <span>{ui.thisSession}</span>
                <strong>{snapshot.health?.latencyMs != null ? `${snapshot.health.latencyMs} ms` : '—'}</strong>
              </div>
              <small>{latencyHistory.length} {ui.samples}</small>
            </div>
            <LatencySparkline values={latencyHistory} label={ui.browserToApi} />
            <p>{ui.browserToApi}. {ui.refreshForSample}</p>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default SystemHealth;
