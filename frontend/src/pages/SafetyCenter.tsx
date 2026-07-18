import React from 'react';
import { Checkbox, Modal } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  SwapOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import {
  NotificationHistoryItem,
  OrderEvent,
  ReadinessCheck,
  SafetyCenterSnapshot,
  SafetyState,
  normalizeReadinessChecks,
  safetyCenterAPI,
} from '../services/safetyCenterService';
import {
  buildEffectiveLimits,
  deriveSafetySemantics,
  readinessCheckIsReady,
} from './safetyCenterModel';
import './SafetyCenterEditorial.css';

const emptyState: SafetyState = {
  pauseNewEntries: false,
  cancelPendingEntryOrders: false,
  keepProtectiveExits: true,
  reason: '',
  pausedAt: null,
  updatedAt: null,
  version: 0,
};

const errorMessage = (error: any, fallback: string): string => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const formatTime = (value: string | null | undefined, language: string): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed);
};

const eventTone = (status?: string): 'good' | 'attention' | 'critical' | 'neutral' => {
  const normalized = String(status || '').toLowerCase();
  if (/fill|accept|deliver|success|complete|protect/.test(normalized)) return 'good';
  if (/reject|fail|error|cancel/.test(normalized)) return 'critical';
  if (/pending|partial|queue|submit|sent/.test(normalized)) return 'attention';
  return 'neutral';
};

const SafetyCenter: React.FC = () => {
  const { language } = useLanguage();
  const { tradeMode } = useTradeMode();
  const { user } = useAuth();
  const zh = language === 'zh-CN';
  const [snapshot, setSnapshot] = React.useState<SafetyCenterSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [action, setAction] = React.useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [loadError, setLoadError] = React.useState('');
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pauseOpen, setPauseOpen] = React.useState(false);
  const [resumeOpen, setResumeOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(true);
  const [resumeAccepted, setResumeAccepted] = React.useState(false);
  const requestRef = React.useRef(0);

  const copy = zh ? {
    eyebrow: '运行控制 / 交易安全',
    title: '交易安全中心',
    subtitle: '集中查看订单权限、保护性退出、风险限制与系统就绪状态。暂停为账户级控制，会阻止该账户的新入场订单，但不会停止持仓保护。',
    refresh: '刷新状态',
    lastChecked: '最后检查',
    live: '实盘环境',
    paper: '模拟环境',
    stateIndex: '01 / 全局状态',
    allowed: '允许新的入场订单',
    paused: '新的入场订单已暂停',
    critical: '保护状态需要立即检查',
    allowedDesc: '通过所有硬性风险门槛后，研究管线可以继续创建新的买入订单。',
    pausedDesc: '扫描和研究可以继续运行，但该账户不会向券商提交新的买入入场订单。',
    criticalDesc: '系统未能确认保护性退出持续生效。恢复交易前必须先处理此问题。',
    protected: '保护性退出始终保持启用',
    protectedDesc: '止损、止盈、OCO 和风险退出不受“暂停新入场”影响，也不会被批量取消。',
    pauseEntries: '暂停新入场',
    resumeEntries: '恢复新入场',
    cancelPending: '取消待处理入场单',
    pausedAt: '暂停时间',
    version: '控制版本',
    reason: '原因',
    userRequested: '用户手动暂停',
    controlsIndex: '02 / 操作边界',
    controls: '安全操作',
    controlsDesc: '暂停与恢复作用于整个账户；批量撤销只处理当前所选交易环境中的 AlphaLab 入场买单。',
    pauseTitle: '暂停新的入场订单？',
    pauseBody: '暂停后，扫描、验证和持仓监控仍会继续，但该账户不会提交新的买入入场订单。',
    cancelOwned: '同时取消当前交易环境中由 AlphaLab 创建且仍未成交的买入入场订单',
    cancelOwnedHelp: '卖出单、止损、止盈、OCO 和其他保护性订单永远不会被该操作取消。',
    keepRunning: '保持入场开放',
    confirmPause: '确认暂停',
    resumeTitle: '恢复新的入场订单？',
    resumeBody: '恢复后，符合当前风险策略和订单权限的管线可以再次提交新入场订单。',
    resumeConfirm: '我已检查交易环境、券商连接和当前风险限制。',
    remainPaused: '继续暂停',
    confirmResume: '确认恢复',
    pendingTitle: '取消待处理的入场买单？',
    pendingBody: '该操作会先在账户级暂停新的入场订单，然后只取消当前交易环境中由 AlphaLab 创建的待处理买入父订单；卖出和保护性订单不会被取消。',
    cancelAction: '取消入场买单',
    riskIndex: '03 / 生效限制',
    riskTitle: '当前风险边界',
    riskDesc: '这些是研究、仓位计算和订单执行共同使用的已保存策略限制。',
    dailyLoss: '每日亏损熔断',
    perTrade: '每笔风险预算',
    singlePosition: '单一仓位上限',
    grossExposure: '总风险敞口',
    sectorExposure: '板块敞口',
    openBuys: '同时入场买单',
    positions: '最大持仓数',
    slippage: '滑点上限',
    profile: '风险配置',
    horizon: '持有周期',
    pipeline: '决策权限',
    configure: '调整研究策略',
    readinessIndex: '04 / 上线检查',
    readinessTitle: '交易就绪清单',
    readinessDesc: '任何阻塞项都应在恢复实盘新入场前解决。',
    complete: '已完成',
    blocked: '待处理',
    signedIn: '认证会话',
    signedInReady: '当前账户会话有效',
    broker: '券商账户',
    brokerReady: '当前账户的 Alpaca 凭证已保存',
    marketData: '市场数据',
    marketDataReady: '至少一个行情数据源已配置',
    aiProvider: 'AI 提供商',
    aiReady: '研究模型已配置',
    aiOptional: '手动模式不要求 AI 提供商',
    policy: '风险策略',
    policyReady: '已加载账户级策略限制',
    environment: '交易环境',
    environmentReady: '页面模式与可用券商账户一致',
    entryAuthority: '全局入场权限',
    entryAllowed: '安全中心允许新的入场订单',
    entryPaused: '新的入场订单目前处于暂停状态',
    protection: '保护性退出',
    protectionReady: '暂停新入场时仍继续运行',
    needsAttention: '需要处理',
    allReady: '核心交易依赖项已就绪',
    connectionSettings: '打开连接设置',
    orderIndex: '05 / 订单事件',
    orderTitle: '订单生命周期',
    orderDesc: '券商事件与平台记录的最近状态。',
    noOrders: '暂无订单事件',
    noOrdersDesc: '提交、部分成交、成交、取消和拒绝事件会显示在这里。',
    notificationIndex: '06 / 通知记录',
    notificationTitle: '通知送达记录',
    notificationDesc: '记录 Discord 等渠道的发送与失败状态。',
    noNotifications: '暂无通知记录',
    noNotificationsDesc: '推荐、买卖、风险和运行摘要的送达结果会显示在这里。',
    loadFailed: '暂时无法读取安全状态，请确认后端服务后重试。',
    pauseSuccess: '新的入场订单已暂停；保护性退出保持启用。',
    resumeSuccess: '新的入场订单已恢复。',
    cancelSuccess: '待处理入场订单取消请求已完成。',
    cancelPartial: '新的入场订单已暂停，但部分待处理买单未能取消，请检查订单记录。',
    conflict: '安全状态已在其他页面更新，已重新加载最新状态。',
    retry: '重试',
  } : {
    eyebrow: 'OPERATIONS / TRADING SAFETY',
    title: 'Trading safety center',
    subtitle: 'Review order authority, protective exits, effective risk limits, and operational readiness in one place. The pause is account-wide: it blocks new entries while position protection continues.',
    refresh: 'Refresh status',
    lastChecked: 'Last checked',
    live: 'Live environment',
    paper: 'Paper environment',
    stateIndex: '01 / GLOBAL STATE',
    allowed: 'New entries are allowed',
    paused: 'New entries are paused',
    critical: 'Protection state needs attention',
    allowedDesc: 'The research pipeline may create new buy orders after every hard risk gate passes.',
    pausedDesc: 'Scanning and research can continue, but this account will not send new buy-entry orders to the broker.',
    criticalDesc: 'The system could not confirm that protective exits remain active. Resolve this before resuming entries.',
    protected: 'Protective exits always remain enabled',
    protectedDesc: 'Stops, targets, OCO, and risk exits are unaffected by “pause new entries” and are never bulk-cancelled.',
    pauseEntries: 'Pause new entries',
    resumeEntries: 'Resume new entries',
    cancelPending: 'Cancel pending entries',
    pausedAt: 'Paused at',
    version: 'Control version',
    reason: 'Reason',
    userRequested: 'Paused manually by user',
    controlsIndex: '02 / CONTROL BOUNDARY',
    controls: 'Safety operations',
    controlsDesc: 'Pause and resume apply to the whole account; bulk cancellation is limited to AlphaLab entry buys in the selected trading environment.',
    pauseTitle: 'Pause new entry orders?',
    pauseBody: 'Scanning, validation, and position monitoring continue, but this account will not submit new buy-entry orders.',
    cancelOwned: 'Also cancel unfilled AlphaLab buy-entry orders in the selected trading environment',
    cancelOwnedHelp: 'Sell orders, stops, targets, OCO, and other protective orders are never cancelled by this action.',
    keepRunning: 'Keep entries open',
    confirmPause: 'Confirm pause',
    resumeTitle: 'Resume new entry orders?',
    resumeBody: 'After resuming, pipelines that satisfy the current risk policy and order authority may submit new entries again.',
    resumeConfirm: 'I reviewed the trading environment, broker connection, and effective risk limits.',
    remainPaused: 'Remain paused',
    confirmResume: 'Confirm resume',
    pendingTitle: 'Cancel pending entry buys?',
    pendingBody: 'This first pauses new entries account-wide, then cancels only pending AlphaLab buy parent orders in the selected trading environment. Sell and protective orders are excluded.',
    cancelAction: 'Cancel entry buys',
    riskIndex: '03 / EFFECTIVE LIMITS',
    riskTitle: 'Current risk boundary',
    riskDesc: 'These saved mandate limits are shared by research, position sizing, and order execution.',
    dailyLoss: 'Daily loss stop',
    perTrade: 'Risk per trade',
    singlePosition: 'Single position',
    grossExposure: 'Gross exposure',
    sectorExposure: 'Sector exposure',
    openBuys: 'Concurrent buys',
    positions: 'Maximum positions',
    slippage: 'Slippage cap',
    profile: 'Risk profile',
    horizon: 'Holding horizon',
    pipeline: 'Decision authority',
    configure: 'Adjust research mandate',
    readinessIndex: '04 / GO-LIVE CHECK',
    readinessTitle: 'Trading readiness checklist',
    readinessDesc: 'Resolve every blocker before live new-entry authority is resumed.',
    complete: 'Complete',
    blocked: 'Needs attention',
    signedIn: 'Authenticated session',
    signedInReady: 'Current account session is valid',
    broker: 'Broker account',
    brokerReady: 'Alpaca credentials are saved for this account',
    marketData: 'Market data',
    marketDataReady: 'At least one quote-data source is configured',
    aiProvider: 'AI provider',
    aiReady: 'The research model is configured',
    aiOptional: 'Manual mode does not require an AI provider',
    policy: 'Risk mandate',
    policyReady: 'Account-level strategy limits are loaded',
    environment: 'Trading environment',
    environmentReady: 'Workspace mode matches an available broker account',
    entryAuthority: 'Global entry authority',
    entryAllowed: 'The Safety Center allows new entry orders',
    entryPaused: 'New entry orders are currently paused',
    protection: 'Protective exits',
    protectionReady: 'Continue running while new entries are paused',
    needsAttention: 'Needs attention',
    allReady: 'Core trading dependencies are ready',
    connectionSettings: 'Open connection settings',
    orderIndex: '05 / ORDER EVENTS',
    orderTitle: 'Order lifecycle',
    orderDesc: 'Recent broker events and platform records.',
    noOrders: 'No order events yet',
    noOrdersDesc: 'Submitted, partial fill, fill, cancellation, and rejection events will appear here.',
    notificationIndex: '06 / DELIVERY RECORDS',
    notificationTitle: 'Notification delivery history',
    notificationDesc: 'Delivery and failure states for Discord and other channels.',
    noNotifications: 'No notification records yet',
    noNotificationsDesc: 'Delivery results for recommendations, trades, risk, and run summaries will appear here.',
    loadFailed: 'Safety state is temporarily unavailable. Check the backend service and try again.',
    pauseSuccess: 'New entries are paused; protective exits remain active.',
    resumeSuccess: 'New entries are enabled again.',
    cancelSuccess: 'The pending-entry cancellation request completed.',
    cancelPartial: 'New entries are paused, but some pending buys could not be cancelled. Review the order ledger.',
    conflict: 'Safety state changed in another session. The latest state has been reloaded.',
    retry: 'Retry',
  };

  const refresh = React.useCallback(async (quiet = false) => {
    const requestId = ++requestRef.current;
    if (!quiet) setLoading(true);
    setLoadError('');
    try {
      const next = await safetyCenterAPI.getSnapshot(tradeMode);
      if (requestId !== requestRef.current) return;
      setSnapshot(next);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setLoadError(errorMessage(error, copy.loadFailed));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [copy.loadFailed, tradeMode]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const state = snapshot?.safety || emptyState;
  const controlsKnown = Boolean(snapshot) && !loadError;
  const semantics = controlsKnown
    ? deriveSafetySemantics(state)
    : {
      entriesAllowed: false,
      protectionsGuaranteed: false,
      canResume: false,
      canPause: false,
      tone: 'critical' as const,
    };
  const limits = buildEffectiveLimits(snapshot?.preferences || null);
  const policy = snapshot?.preferences?.strategyPolicy || {};
  const configuration = snapshot?.configuration;
  const brokerConfigured = tradeMode === 'real'
    ? Boolean(configuration?.alpaca?.liveConfigured)
    : Boolean(configuration?.alpaca?.paperConfigured);
  const marketDataConfigured = Boolean(
    configuration?.alpacaMarketData?.configured
    || configuration?.finnhub?.configured
    || configuration?.finnhub?.status === 'connected',
  );
  const aiConfigured = Boolean(
    configuration?.ai?.configured
    || configuration?.aiProvider?.status === 'connected',
  );
  const aiRequired = snapshot?.preferences?.pipelineMode !== 'manual';
  const accountMode = snapshot?.account?.modeUsed || snapshot?.account?.mode;
  const environmentReady = Boolean(snapshot?.account?.available)
    && accountMode === tradeMode
    && !snapshot?.account?.accountBlocked
    && !snapshot?.account?.tradingBlocked;

  const derivedChecks: ReadinessCheck[] = [
    { key: 'session', label: copy.signedIn, detail: copy.signedInReady, ready: Boolean(user) },
    { key: 'broker', label: copy.broker, detail: copy.brokerReady, ready: brokerConfigured },
    { key: 'market-data', label: copy.marketData, detail: copy.marketDataReady, ready: marketDataConfigured },
    { key: 'ai-provider', label: copy.aiProvider, detail: aiRequired ? copy.aiReady : copy.aiOptional, ready: aiConfigured || !aiRequired },
    { key: 'policy', label: copy.policy, detail: copy.policyReady, ready: Boolean(policy?.version) },
    { key: 'environment', label: copy.environment, detail: copy.environmentReady, ready: environmentReady },
    { key: 'entry-authority', label: copy.entryAuthority, detail: state.pauseNewEntries ? copy.entryPaused : copy.entryAllowed, ready: controlsKnown && !state.pauseNewEntries },
    { key: 'protection', label: copy.protection, detail: copy.protectionReady, ready: semantics.protectionsGuaranteed },
  ];
  const backendChecks = normalizeReadinessChecks(snapshot?.readiness?.checks || []);
  const checkKeys = new Set(derivedChecks.map((check) => check.key));
  const allChecks = [...derivedChecks, ...backendChecks.filter((check) => !checkKeys.has(check.key))];
  const completedChecks = allChecks.filter(readinessCheckIsReady).length;
  const completionPercent = allChecks.length > 0
    ? Math.round((completedChecks / allChecks.length) * 100)
    : 0;

  const mutate = async (kind: 'pause' | 'resume' | 'cancel') => {
    setAction(kind);
    setNotice(null);
    try {
      if (kind === 'cancel') {
        const result = await safetyCenterAPI.cancelPendingEntries(tradeMode);
        setSnapshot((current) => current ? { ...current, safety: result.state, loadedAt: new Date().toISOString() } : current);
        const failed = result.cancellation?.failed?.length || 0;
        setNotice({ tone: failed ? 'error' : 'success', text: failed ? copy.cancelPartial : copy.cancelSuccess });
      } else {
        const pause = kind === 'pause';
        const result = await safetyCenterAPI.updateSafety({
          pauseNewEntries: pause,
          cancelPendingEntryOrders: pause ? cancelPending : false,
          reason: pause ? 'user_requested' : 'user_resumed',
          mode: tradeMode,
          expectedVersion: state.version,
          idempotencyKey: `safety-${kind}-${state.version}-${Date.now()}`,
        });
        setSnapshot((current) => current ? { ...current, safety: result.state, loadedAt: new Date().toISOString() } : current);
        const cancelFailed = pause ? (result.cancellation?.failed?.length || 0) : 0;
        setNotice({
          tone: cancelFailed ? 'error' : 'success',
          text: cancelFailed ? copy.cancelPartial : (pause ? copy.pauseSuccess : copy.resumeSuccess),
        });
      }
      setPauseOpen(false);
      setResumeOpen(false);
      setCancelOpen(false);
      setResumeAccepted(false);
      await refresh(true);
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setNotice({ tone: 'error', text: copy.conflict });
        await refresh(true);
      } else {
        setNotice({ tone: 'error', text: errorMessage(error, copy.loadFailed) });
      }
    } finally {
      setAction(null);
    }
  };

  const stateTitle = semantics.tone === 'critical'
    ? copy.critical
    : semantics.entriesAllowed ? copy.allowed : copy.paused;
  const stateDescription = semantics.tone === 'critical'
    ? copy.criticalDesc
    : semantics.entriesAllowed ? copy.allowedDesc : copy.pausedDesc;

  const limitLabels: Record<string, string> = {
    dailyLoss: copy.dailyLoss,
    perTrade: copy.perTrade,
    singlePosition: copy.singlePosition,
    grossExposure: copy.grossExposure,
    sectorExposure: copy.sectorExposure,
    openBuys: copy.openBuys,
    positions: copy.positions,
    slippage: copy.slippage,
  };

  const renderOrderEvent = (event: OrderEvent, index: number) => {
    const payload = event.payload || {};
    const status = event.status || payload.status || event.eventType || 'recorded';
    const symbol = event.symbol || payload.symbol || payload.asset || '—';
    const side = event.side || payload.side || '';
    const eventTime = event.occurredAt || event.createdAt;
    return (
      <li key={event.id || `${event.orderId || 'order'}-${eventTime || index}`}>
        <i className={`safety-timeline__mark safety-timeline__mark--${eventTone(status)}`} aria-hidden="true" />
        <div>
          <strong>{String(status).replace(/_/g, ' ')}</strong>
          <span>{[symbol, side && String(side).toUpperCase(), event.orderId].filter(Boolean).join(' · ')}</span>
        </div>
        <time>{formatTime(eventTime, language)} ET</time>
      </li>
    );
  };

  const renderNotification = (item: NotificationHistoryItem, index: number) => {
    const status = item.status || 'recorded';
    return (
      <li key={item.id || `${item.messageId || 'notification'}-${item.createdAt || index}`}>
        <i className={`safety-timeline__mark safety-timeline__mark--${eventTone(status)}`} aria-hidden="true" />
        <div>
          <strong>{String(item.eventType || 'notification').replace(/_/g, ' ')}</strong>
          <span>{[item.channel || 'Discord', status, item.error].filter(Boolean).join(' · ')}</span>
        </div>
        <time>{formatTime(item.deliveredAt || item.createdAt, language)} ET</time>
      </li>
    );
  };

  return (
    <div className="safety-center-page">
      <header className="safety-hero">
        <div>
          <span className="safety-eyebrow"><SafetyCertificateOutlined /> {copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="safety-hero__controls">
          <span className={`safety-mode safety-mode--${tradeMode}`}>
            <i aria-hidden="true" />{tradeMode === 'real' ? copy.live : copy.paper}
          </span>
          <div>
            <small>{copy.lastChecked}</small>
            <strong>{formatTime(snapshot?.loadedAt, language)} ET</strong>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            <ReloadOutlined className={loading ? 'is-spinning' : undefined} />
            {copy.refresh}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="safety-alert safety-alert--error" role="alert">
          <ExclamationCircleOutlined />
          <span>{loadError}</span>
          <button type="button" onClick={() => void refresh()}>{copy.retry}</button>
        </div>
      )}
      {notice && (
        <div className={`safety-alert safety-alert--${notice.tone}`} role="status">
          {notice.tone === 'success' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          <span>{notice.text}</span>
        </div>
      )}

      <section className={`safety-state safety-state--${semantics.tone}`} aria-labelledby="safety-state-title">
        <div className="safety-state__copy">
          <span className="safety-section-index">{copy.stateIndex}</span>
          <div className="safety-state__title-row">
            <span className="safety-state__icon">
              {semantics.entriesAllowed ? <UnlockOutlined /> : <PauseCircleOutlined />}
            </span>
            <div>
              <h2 id="safety-state-title">{stateTitle}</h2>
              <p>{stateDescription}</p>
            </div>
          </div>
          <div className={`safety-protection-guarantee${semantics.protectionsGuaranteed ? '' : ' is-critical'}`}>
            {semantics.protectionsGuaranteed ? <SafetyCertificateOutlined /> : <ExclamationCircleOutlined />}
            <div>
              <strong>{semantics.protectionsGuaranteed ? copy.protected : copy.critical}</strong>
              <span>{semantics.protectionsGuaranteed ? copy.protectedDesc : copy.criticalDesc}</span>
            </div>
          </div>
        </div>
        <div className="safety-state__actions">
          {semantics.entriesAllowed ? (
            <button type="button" className="safety-action safety-action--pause" onClick={() => setPauseOpen(true)} disabled={Boolean(action) || loading || !controlsKnown}>
              <PauseCircleOutlined /> {copy.pauseEntries}
            </button>
          ) : (
            <button type="button" className="safety-action safety-action--resume" onClick={() => setResumeOpen(true)} disabled={Boolean(action) || loading || !controlsKnown || !semantics.canResume}>
              <UnlockOutlined /> {copy.resumeEntries}
            </button>
          )}
          <button type="button" className="safety-action safety-action--secondary" onClick={() => setCancelOpen(true)} disabled={Boolean(action) || loading || !controlsKnown}>
            <StopOutlined /> {copy.cancelPending}
          </button>
          <dl>
            <div><dt>{copy.pausedAt}</dt><dd>{formatTime(state.pausedAt, language)} ET</dd></div>
            <div><dt>{copy.reason}</dt><dd>{state.reason === 'user_requested' ? copy.userRequested : (state.reason ? state.reason.replace(/_/g, ' ') : '—')}</dd></div>
            <div><dt>{copy.version}</dt><dd>v{state.version}</dd></div>
          </dl>
        </div>
      </section>

      <section className="safety-limits" aria-labelledby="safety-limits-title">
        <header className="safety-section-heading">
          <div>
            <span className="safety-section-index">{copy.riskIndex}</span>
            <h2 id="safety-limits-title">{copy.riskTitle}</h2>
            <p>{copy.riskDesc}</p>
          </div>
          <Link to="/agent#portfolio-mandate">{copy.configure}</Link>
        </header>
        <div className="safety-context-strip">
          <div><span>{copy.profile}</span><strong>{snapshot?.preferences?.riskProfile || '—'}</strong></div>
          <div><span>{copy.horizon}</span><strong>{policy?.holdingPeriod || snapshot?.preferences?.timeHorizon || '—'}</strong></div>
          <div><span>{copy.pipeline}</span><strong>{policy?.permissions?.label || snapshot?.preferences?.pipelineMode || '—'}</strong></div>
        </div>
        <div className="safety-limit-grid">
          {limits.map((limit, index) => (
            <article key={limit.key}>
              <span>0{index + 1}</span>
              <small>{limitLabels[limit.key]}</small>
              <strong>{limit.value}</strong>
              <em>{limit.source}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="safety-readiness" aria-labelledby="safety-readiness-title">
        <header className="safety-section-heading">
          <div>
            <span className="safety-section-index">{copy.readinessIndex}</span>
            <h2 id="safety-readiness-title">{copy.readinessTitle}</h2>
            <p>{copy.readinessDesc}</p>
          </div>
          <div className="safety-readiness__score" aria-label={`${completionPercent}%`}>
            <strong>{completionPercent}%</strong>
            <span>{completedChecks}/{allChecks.length} {copy.complete}</span>
          </div>
        </header>
        <div
          className="safety-readiness__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completionPercent}
          aria-label={copy.readinessTitle}
        >
          <i style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="safety-check-grid">
          {allChecks.map((check) => {
            const ready = readinessCheckIsReady(check);
            return (
              <article key={check.key} className={ready ? 'is-ready' : 'is-blocked'}>
                {ready ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                <div>
                  <strong>{(zh && check.labelZh) || check.label || check.key.replace(/[_-]/g, ' ')}</strong>
                  <span>{(zh && check.detailZh) || check.detail || (ready ? copy.allReady : copy.needsAttention)}</span>
                </div>
                <em>{ready ? copy.complete : copy.blocked}</em>
              </article>
            );
          })}
        </div>
        {(snapshot?.readiness?.blockingReasons?.length || 0) > 0 && (
          <div className="safety-blockers" role="alert">
            <WarningList reasons={snapshot?.readiness?.blockingReasons || []} />
          </div>
        )}
        <Link className="safety-readiness__settings" to="/settings/configuration">{copy.connectionSettings}</Link>
      </section>

      <div className="safety-ledger-grid">
        <section className="safety-ledger" aria-labelledby="safety-order-title">
          <header>
            <div>
              <span className="safety-section-index">{copy.orderIndex}</span>
              <h2 id="safety-order-title">{copy.orderTitle}</h2>
              <p>{copy.orderDesc}</p>
            </div>
            <SwapOutlined />
          </header>
          {snapshot?.orderEvents?.length ? (
            <ol className="safety-timeline">{snapshot.orderEvents.slice(0, 8).map(renderOrderEvent)}</ol>
          ) : (
            <div className="safety-empty">
              <ClockCircleOutlined />
              <strong>{copy.noOrders}</strong>
              <span>{copy.noOrdersDesc}</span>
            </div>
          )}
        </section>
        <section className="safety-ledger" aria-labelledby="safety-notification-title">
          <header>
            <div>
              <span className="safety-section-index">{copy.notificationIndex}</span>
              <h2 id="safety-notification-title">{copy.notificationTitle}</h2>
              <p>{copy.notificationDesc}</p>
            </div>
            <BellOutlined />
          </header>
          {snapshot?.notifications?.length ? (
            <ol className="safety-timeline">{snapshot.notifications.slice(0, 8).map(renderNotification)}</ol>
          ) : (
            <div className="safety-empty">
              <BellOutlined />
              <strong>{copy.noNotifications}</strong>
              <span>{copy.noNotificationsDesc}</span>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={pauseOpen}
        onCancel={() => setPauseOpen(false)}
        title={null}
        footer={null}
        centered
        width={620}
        className="safety-confirm-modal"
        destroyOnClose
      >
        <div className="safety-confirm-modal__head">
          <PauseCircleOutlined />
          <div><span>{copy.controlsIndex}</span><h2>{copy.pauseTitle}</h2></div>
        </div>
        <p>{copy.pauseBody}</p>
        <label className="safety-confirm-modal__choice">
          <Checkbox checked={cancelPending} onChange={(event) => setCancelPending(event.target.checked)} />
          <span><strong>{copy.cancelOwned}</strong><small>{copy.cancelOwnedHelp}</small></span>
        </label>
        <div className="safety-confirm-modal__guarantee"><SafetyCertificateOutlined /><span><strong>{copy.protected}</strong>{copy.protectedDesc}</span></div>
        <div className="safety-confirm-modal__actions">
          <button type="button" onClick={() => setPauseOpen(false)}>{copy.keepRunning}</button>
          <button type="button" className="is-primary" onClick={() => void mutate('pause')} disabled={action === 'pause'}>{copy.confirmPause}</button>
        </div>
      </Modal>

      <Modal
        open={resumeOpen}
        onCancel={() => { setResumeOpen(false); setResumeAccepted(false); }}
        title={null}
        footer={null}
        centered
        width={620}
        className="safety-confirm-modal"
        destroyOnClose
      >
        <div className="safety-confirm-modal__head">
          <UnlockOutlined />
          <div><span>{copy.controlsIndex}</span><h2>{copy.resumeTitle}</h2></div>
        </div>
        <p>{copy.resumeBody}</p>
        <label className="safety-confirm-modal__choice">
          <Checkbox checked={resumeAccepted} onChange={(event) => setResumeAccepted(event.target.checked)} />
          <span><strong>{copy.resumeConfirm}</strong></span>
        </label>
        <div className="safety-confirm-modal__guarantee"><SafetyCertificateOutlined /><span><strong>{copy.protected}</strong>{copy.protectedDesc}</span></div>
        <div className="safety-confirm-modal__actions">
          <button type="button" onClick={() => { setResumeOpen(false); setResumeAccepted(false); }}>{copy.remainPaused}</button>
          <button type="button" className="is-primary" onClick={() => void mutate('resume')} disabled={!resumeAccepted || action === 'resume'}>{copy.confirmResume}</button>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        title={null}
        footer={null}
        centered
        width={620}
        className="safety-confirm-modal"
        destroyOnClose
      >
        <div className="safety-confirm-modal__head">
          <StopOutlined />
          <div><span>{copy.controlsIndex}</span><h2>{copy.pendingTitle}</h2></div>
        </div>
        <p>{copy.pendingBody}</p>
        <div className="safety-confirm-modal__guarantee"><SafetyCertificateOutlined /><span><strong>{copy.protected}</strong>{copy.protectedDesc}</span></div>
        <div className="safety-confirm-modal__actions">
          <button type="button" onClick={() => setCancelOpen(false)}>{copy.keepRunning}</button>
          <button type="button" className="is-primary" onClick={() => void mutate('cancel')} disabled={action === 'cancel'}>{copy.cancelAction}</button>
        </div>
      </Modal>
    </div>
  );
};

const WarningList: React.FC<{ reasons: string[] }> = ({ reasons }) => (
  <ul>
    {reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}
  </ul>
);

export default SafetyCenter;
