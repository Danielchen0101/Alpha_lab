import React from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import kalshiAPI, {
  DEFAULT_KALSHI_BOT_CONFIG,
  KALSHI_CONFIG_CHANGED_EVENT,
  KALSHI_CONFIG_STORAGE_KEY,
  KalshiBotConfig,
  KalshiDecision,
  KalshiPaperPortfolio,
  KalshiPaperRobotState,
  KalshiEvaluationResponse,
  KalshiAnalyticsResponse,
  KalshiFamilyDiagnostics,
  KalshiGate,
  KalshiSnapshot,
} from '../services/kalshiApi';
import '../styles/Kalshi.css';

const MARKET_REFRESH_MS = 5_000;
const PORTFOLIO_REFRESH_MS = 10_000;

export type KalshiView =
  | 'desk'
  | 'rules'
  | 'bot'
  | 'decisions'
  | 'risk'
  | 'positions'
  | 'orders'
  | 'data'
  | 'connection';

export const resolveKalshiView = (pathname: string): KalshiView => {
  if (pathname.endsWith('/markets/rules')) return 'rules';
  if (pathname.endsWith('/bots/decisions')) return 'decisions';
  if (pathname.endsWith('/bots/risk')) return 'risk';
  if (pathname.includes('/bots/')) return 'bot';
  if (pathname.endsWith('/portfolio/orders')) return 'orders';
  if (pathname.includes('/portfolio/')) return 'positions';
  if (pathname.endsWith('/settings/connection')) return 'connection';
  if (pathname.includes('/settings/')) return 'data';
  return 'desk';
};

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const money = (value: unknown, digits = 2) => {
  const parsed = number(value);
  if (parsed === null) return '--';
  return parsed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });
};

const probability = (value: unknown, digits = 1) => {
  const parsed = number(value);
  return parsed === null ? '--' : `${(parsed * 100).toFixed(digits)}%`;
};

const cents = (value: unknown, digits = 1) => {
  const parsed = number(value);
  return parsed === null ? '--' : `${(parsed * 100).toFixed(digits)}c`;
};

const orderSidePrice = (item: any, key: 'limit' | 'average') => {
  const direct = key === 'limit' ? item?.limit_price_dollars : item?.average_price_dollars;
  if (direct != null) return direct;
  const side = String(item?.outcome_side || '').toUpperCase();
  if (side === 'YES') return item?.yes_price_dollars;
  if (side === 'NO') return item?.no_price_dollars;
  return null;
};

const orderFee = (item: any) => {
  if (item?.fee_cost_dollars != null) return Number(item.fee_cost_dollars);
  if (Array.isArray(item?.matched_levels) && item.matched_levels.length) {
    return item.matched_levels.reduce((sum: number, level: any) => sum + Number(level.fee_cost_dollars || 0), 0);
  }
  return null;
};

export const positionSideLabel = (item: any): 'YES' | 'NO' | '--' => {
  const explicit = String(item?.net_side || '').toUpperCase();
  if (explicit === 'YES' || explicit === 'NO') return explicit;
  const rawPosition = number(item?.position_fp ?? item?.position) ?? 0;
  if (rawPosition > 0) return 'YES';
  if (rawPosition < 0) return 'NO';
  return '--';
};

const exitTriggerLabel = (trigger: string | null | undefined, chinese: boolean) => {
  switch (trigger) {
    case 'fee_adjusted_take_profit':
      return chinese ? '扣费后止盈' : 'NET TAKE PROFIT';
    case 'protective_stop_loss':
      return chinese ? '保护止损' : 'PROTECTIVE STOP';
    case 'emergency_stop_loss':
      return chinese ? '紧急止损' : 'EMERGENCY STOP';
    default:
      return '';
  }
};

const compact = (value: unknown) => {
  const parsed = number(value);
  if (parsed === null) return '--';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(parsed);
};

const readStoredConfig = (): KalshiBotConfig => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KALSHI_CONFIG_STORAGE_KEY) || '{}');
    return { ...DEFAULT_KALSHI_BOT_CONFIG, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_KALSHI_BOT_CONFIG };
  }
};

const writeStoredConfig = (config: KalshiBotConfig) => {
  try {
    localStorage.setItem(KALSHI_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(KALSHI_CONFIG_CHANGED_EVENT, { detail: config }));
  } catch {}
};

const PnlChart: React.FC<{ points: Array<{ at: string; cumulativePnl: number }>; label: string }> = ({ points, label }) => {
  if (!points.length) return <div className="kalshi-pnl-empty">{label}</div>;
  const width = 820;
  const height = 230;
  const paddingX = 46;
  const paddingY = 24;
  const values = points.map((point) => Number(point.cumulativePnl) || 0);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = Math.max(1, high - low);
  const x = (index: number) => paddingX + (index / Math.max(1, points.length - 1)) * (width - paddingX * 2);
  const y = (value: number) => paddingY + ((high - value) / span) * (height - paddingY * 2);
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(Number(point.cumulativePnl) || 0).toFixed(2)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(2)} ${y(low).toFixed(2)} L ${x(0).toFixed(2)} ${y(low).toFixed(2)} Z`;
  const zeroY = y(0);
  const last = values[values.length - 1] || 0;
  const firstLabel = points[0]?.at ? new Date(points[0].at).toLocaleDateString() : '';
  const lastLabel = points[points.length - 1]?.at ? new Date(points[points.length - 1].at).toLocaleDateString() : '';
  return (
    <svg className="kalshi-pnl-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="kalshiPnlArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={last >= 0 ? '#5f7f60' : '#b66a45'} stopOpacity="0.22" />
          <stop offset="100%" stopColor={last >= 0 ? '#5f7f60' : '#b66a45'} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={paddingX} y1={paddingY + ratio * (height - paddingY * 2)} x2={width - paddingX} y2={paddingY + ratio * (height - paddingY * 2)} className="kalshi-pnl-grid" />)}
      <line x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} className="kalshi-pnl-zero" />
      <path d={area} className="kalshi-pnl-area" />
      <path d={line} className={last >= 0 ? 'is-positive' : 'is-negative'} />
      <circle cx={x(points.length - 1)} cy={y(last)} r="4.5" className={last >= 0 ? 'is-positive' : 'is-negative'} />
      <text x={paddingX} y={height - 7} className="kalshi-pnl-axis">{firstLabel}</text>
      <text x={width - paddingX} y={height - 7} textAnchor="end" className="kalshi-pnl-axis">{lastLabel}</text>
      <text x={paddingX - 8} y={y(high) + 4} textAnchor="end" className="kalshi-pnl-axis">{money(high)}</text>
      <text x={paddingX - 8} y={y(low) + 4} textAnchor="end" className="kalshi-pnl-axis">{money(low)}</text>
    </svg>
  );
};

const EdgeTimelineChart: React.FC<{
  points: KalshiFamilyDiagnostics['edgeTimeline'];
  emptyLabel: string;
}> = ({ points, emptyLabel }) => {
  const clean = points.filter((point) => number(point.netEdge) !== null || number(point.conservativeEdge) !== null);
  if (clean.length < 2) return <div className="kalshi-edge-empty">{emptyLabel}</div>;
  const width = 820;
  const height = 218;
  const paddingX = 48;
  const paddingY = 24;
  const values = clean.flatMap((point) => [number(point.netEdge), number(point.conservativeEdge)]).filter((value): value is number => value !== null);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = Math.max(0.01, high - low);
  const x = (index: number) => paddingX + (index / Math.max(1, clean.length - 1)) * (width - paddingX * 2);
  const y = (value: number) => paddingY + ((high - value) / span) * (height - paddingY * 2);
  const pathFor = (key: 'netEdge' | 'conservativeEdge') => clean
    .map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(number(point[key]) || 0).toFixed(2)}`)
    .join(' ');
  const start = clean[0]?.at ? new Date(clean[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const end = clean[clean.length - 1]?.at ? new Date(clean[clean.length - 1].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <svg className="kalshi-edge-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={emptyLabel}>
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={paddingX} y1={paddingY + ratio * (height - paddingY * 2)} x2={width - paddingX} y2={paddingY + ratio * (height - paddingY * 2)} className="kalshi-edge-grid" />)}
      <line x1={paddingX} y1={y(0)} x2={width - paddingX} y2={y(0)} className="kalshi-edge-zero" />
      <path d={pathFor('netEdge')} className="is-net" />
      <path d={pathFor('conservativeEdge')} className="is-conservative" />
      <text x={paddingX} y={height - 5} className="kalshi-edge-axis">{start}</text>
      <text x={width - paddingX} y={height - 5} textAnchor="end" className="kalshi-edge-axis">{end}</text>
      <text x={paddingX - 8} y={y(high) + 4} textAnchor="end" className="kalshi-edge-axis">{(high * 100).toFixed(1)}%</text>
      <text x={paddingX - 8} y={y(low) + 4} textAnchor="end" className="kalshi-edge-axis">{(low * 100).toFixed(1)}%</text>
    </svg>
  );
};

const actionLabel = (decision: KalshiDecision | null, chinese: boolean) => {
  if (!decision || decision.action === 'WAIT') return chinese ? '等待' : 'WAIT';
  if (decision.action === 'BUY_YES') return chinese ? '买入信号 YES' : 'BUY SIGNAL YES';
  return chinese ? '买入信号 NO' : 'BUY SIGNAL NO';
};

const actionSummary = (decision: KalshiDecision | null, chinese: boolean, isRealMode: boolean) => {
  if (!decision) return chinese ? '正在等待首个完整快照。' : 'Waiting for the first complete snapshot.';
  if (decision.action === 'WAIT') {
    const count = decision.blockingReasons.length;
    const accountLabel = isRealMode ? (chinese ? 'Kalshi 实盘账户' : 'Kalshi Real account') : (chinese ? 'AlphaLab 模拟账户' : 'AlphaLab Paper account');
    return chinese
      ? `${count} 道门控尚未通过；本轮不向${accountLabel}提交订单。`
      : `${count} gate${count === 1 ? '' : 's'} remain blocked; no order is routed to the ${accountLabel}.`;
  }
  return chinese
    ? `扣除费用和模型不确定性后仍有正边际，并通过盘口与账户门控；只有机器人运行时才会提交限价单。`
    : 'Edge remains positive after fees and uncertainty, and all book and account gates clear; only the running robot submits limit orders.';
};

const Kalshi: React.FC = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const chinese = language === 'zh-CN';
  const view = resolveKalshiView(location.pathname);
  const isHourly = location.pathname.includes('btc-hourly');
  const copy = React.useCallback((english: string, chineseText: string) => (chinese ? chineseText : english), [chinese]);
  const [snapshot, setSnapshot] = React.useState<KalshiSnapshot | null>(null);
  const [decision, setDecision] = React.useState<KalshiDecision | null>(null);
  const [history, setHistory] = React.useState<KalshiDecision[]>([]);
  const [config, setConfig] = React.useState<KalshiBotConfig>(readStoredConfig);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState('');
  const [accountStatus, setAccountStatus] = React.useState<Record<string, any> | null>(null);
  const [paperPortfolio, setPaperPortfolio] = React.useState<KalshiPaperPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = React.useState(false);
  const [portfolioResetting, setPortfolioResetting] = React.useState(false);
  const [robotState, setRobotState] = React.useState<KalshiPaperRobotState | null>(null);
  const [robotBusy, setRobotBusy] = React.useState(false);
  const [applyBusy, setApplyBusy] = React.useState(false);
  const [applyMessage, setApplyMessage] = React.useState('');
  const [analytics, setAnalytics] = React.useState<KalshiAnalyticsResponse | null>(null);
  const [clock, setClock] = React.useState(Date.now());
  const inFlightRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const syncedServerConfigRef = React.useRef('');
  const modeRef = React.useRef<KalshiBotConfig['executionMode']>(config.executionMode === 'real' ? 'real' : 'paper');
  const portfolioRequestRef = React.useRef(0);
  const evaluationRequestRef = React.useRef(0);
  const executionMode: KalshiBotConfig['executionMode'] = config.executionMode === 'real' ? 'real' : 'paper';
  const isRealMode = executionMode === 'real';

  React.useEffect(() => {
    modeRef.current = executionMode;
  }, [executionMode]);

  const acceptPayload = React.useCallback((payload: KalshiEvaluationResponse, expectedMode = modeRef.current) => {
    if (!mountedRef.current) return;
    const payloadMode = (payload.robotState?.config?.executionMode || payload.decision?.config?.executionMode || expectedMode) === 'real' ? 'real' : 'paper';
    if (payloadMode !== expectedMode || modeRef.current !== expectedMode) return;
    setSnapshot(payload.snapshot);
    setDecision(payload.decision);
    setHistory((current) => {
      if (current[0]?.generatedAt === payload.decision.generatedAt) return current;
      return [payload.decision, ...current].slice(0, 24);
    });
    setError('');
    if (payload.robotState) setRobotState(payload.robotState);
  }, []);

  const evaluate = React.useCallback(async (quiet = false) => {
    if (inFlightRef.current || document.hidden) return;
    const expectedMode = executionMode;
    const requestId = evaluationRequestRef.current + 1;
    evaluationRequestRef.current = requestId;
    inFlightRef.current = true;
    if (!quiet) setRefreshing(true);
    try {
      const response = isHourly
        ? await kalshiAPI.evaluateHourly(expectedMode)
        : await kalshiAPI.evaluate(config);
      if (!response.data?.success) throw new Error(response.data?.message || 'Kalshi evaluation failed');
      if (evaluationRequestRef.current === requestId) acceptPayload(response.data, expectedMode);
    } catch (requestError: any) {
      if (mountedRef.current && modeRef.current === expectedMode && evaluationRequestRef.current === requestId) {
        setError(requestError?.response?.data?.message || requestError?.message || copy('Market data is temporarily unavailable.', '市场数据暂时不可用。'));
      }
    } finally {
      if (evaluationRequestRef.current === requestId) inFlightRef.current = false;
      if (mountedRef.current && modeRef.current === expectedMode && evaluationRequestRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [acceptPayload, config, copy, executionMode, isHourly]);

  React.useEffect(() => {
    mountedRef.current = true;
    void evaluate();
    return () => { mountedRef.current = false; };
  // Initial request is intentionally once; config changes are applied explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPaperPortfolio = React.useCallback(async (modeOverride: KalshiBotConfig['executionMode'] = modeRef.current) => {
    const requestId = portfolioRequestRef.current + 1;
    portfolioRequestRef.current = requestId;
    if (mountedRef.current) setPortfolioLoading(true);
    try {
      const response = await kalshiAPI.paperPortfolio(modeOverride);
      if (!mountedRef.current || modeRef.current !== modeOverride || portfolioRequestRef.current !== requestId) return;
      if (response.data?.portfolio) {
        setPaperPortfolio(response.data.portfolio);
      }
      if (response.data?.state) {
        const stateMode = response.data.state.config?.executionMode === 'real' ? 'real' : 'paper';
        if (stateMode === modeOverride) setRobotState(response.data.state);
      }
    } catch (requestError: any) {
      if (mountedRef.current && modeRef.current === modeOverride) {
        setError(requestError?.response?.data?.message || copy('Kalshi account refresh failed. Try again.', 'Kalshi 账户刷新失败，请重试。'));
      }
    } finally {
      if (mountedRef.current && portfolioRequestRef.current === requestId) setPortfolioLoading(false);
    }
  }, [copy]);

  const loadAnalytics = React.useCallback(async (
    modeOverride: KalshiBotConfig['executionMode'] = modeRef.current,
  ) => {
    try {
      const response = await kalshiAPI.analytics(modeOverride, 24);
      if (!mountedRef.current || modeRef.current !== modeOverride || !response.data?.success) return;
      setAnalytics(response.data);
    } catch {
      // Trading/evaluation stays available if the durable diagnostics endpoint
      // is temporarily unavailable; its source card will show no samples.
    }
  }, []);

  const resetPortfolioDisplay = async () => {
    if (portfolioResetting) return;
    const confirmed = window.confirm(copy(
      'Start a new visible Portfolio period? Account equity and every historical order, fill and settlement will be preserved.',
      '确定开始一个新的 Portfolio 显示周期吗？账户权益以及所有历史订单、成交和结算都会完整保留。',
    ));
    if (!confirmed) return;
    setPortfolioResetting(true);
    try {
      const response = await kalshiAPI.resetPortfolioDisplay(executionMode);
      if (!response.data?.success || !response.data.portfolio) {
        throw new Error(response.data?.message || 'Portfolio display reset failed');
      }
      setPaperPortfolio(response.data.portfolio);
      if (response.data.state) setRobotState(response.data.state);
      setError('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || copy(
        'Portfolio display period could not be reset.',
        'Portfolio 显示周期重置失败。',
      ));
    } finally {
      setPortfolioResetting(false);
    }
  };

  React.useEffect(() => {
    const handleExternalConfigChange = (event: Event) => {
      const detail = (event as CustomEvent<Partial<KalshiBotConfig> | undefined>).detail;
      if (!detail || typeof detail !== 'object') return;
      const nextConfig = { ...readStoredConfig(), ...detail } as KalshiBotConfig;
      const nextMode = nextConfig.executionMode === 'real' ? 'real' : 'paper';
      setConfig(nextConfig);
      modeRef.current = nextMode;
      setPaperPortfolio(null);
      setSnapshot(null);
      setDecision(null);
      setHistory([]);
      setRobotState(null);
      setAnalytics(null);
      setRefreshing(true);
      inFlightRef.current = false;
      const evaluationRequestId = evaluationRequestRef.current + 1;
      evaluationRequestRef.current = evaluationRequestId;
      void Promise.all([
        loadPaperPortfolio(nextMode),
        loadAnalytics(nextMode),
        (isHourly ? kalshiAPI.evaluateHourly(nextMode) : kalshiAPI.evaluate(nextConfig)).then((response) => {
          if (evaluationRequestRef.current === evaluationRequestId && response.data?.success) {
            acceptPayload(response.data, nextMode);
          }
        }),
      ])
        .catch((requestError: any) => {
          if (modeRef.current === nextMode && evaluationRequestRef.current === evaluationRequestId) {
            setError(requestError?.response?.data?.message || copy('Kalshi account refresh failed. Try again.', 'Kalshi 账户刷新失败，请重试。'));
          }
        })
        .finally(() => {
          if (modeRef.current === nextMode && evaluationRequestRef.current === evaluationRequestId) {
            setRefreshing(false);
          }
        });
    };
    window.addEventListener(KALSHI_CONFIG_CHANGED_EVENT, handleExternalConfigChange);
    return () => window.removeEventListener(KALSHI_CONFIG_CHANGED_EVENT, handleExternalConfigChange);
  }, [acceptPayload, copy, isHourly, loadAnalytics, loadPaperPortfolio]);

  React.useEffect(() => {
    const mode = executionMode;
    kalshiAPI.paperRobotStatus(mode)
      .then((response) => {
        if (!mountedRef.current || modeRef.current !== mode) return;
        if (response.data?.state && (response.data.state.config?.executionMode === mode)) setRobotState(response.data.state);
      })
      .catch(() => undefined);
    void loadPaperPortfolio(mode);
    void loadAnalytics(mode);
  }, [executionMode, loadAnalytics, loadPaperPortfolio]);

  React.useEffect(() => {
    const serverConfig = robotState?.config;
    if (!serverConfig || Object.keys(serverConfig).length === 0) return;
    const serverMode = serverConfig.executionMode === 'real' ? 'real' : 'paper';
    if (serverMode !== executionMode) return;
    const signature = JSON.stringify(serverConfig);
    if (syncedServerConfigRef.current === signature) return;
    syncedServerConfigRef.current = signature;
    setConfig((current) => {
      const next = { ...current, ...serverConfig } as KalshiBotConfig;
      writeStoredConfig(next);
      return next;
    });
  }, [executionMode, robotState?.config]);

  React.useEffect(() => {
    if (view !== 'connection') return;
    let active = true;
    kalshiAPI.status()
      .then((response) => { if (active) setAccountStatus(response.data || null); })
      .catch(() => { if (active) setAccountStatus(null); });
    return () => { active = false; };
  }, [view]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(() => void evaluate(true), MARKET_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [evaluate]);

  React.useEffect(() => {
    setSnapshot(null);
    setDecision(null);
    setHistory([]);
    setLoading(true);
    inFlightRef.current = false;
    void evaluate();
  // Switching robot tabs keeps this page mounted, so refresh explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHourly]);

  React.useEffect(() => {
    const timer = window.setInterval(() => void loadPaperPortfolio(), PORTFOLIO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadPaperPortfolio]);

  React.useEffect(() => {
    const timer = window.setInterval(() => void loadAnalytics(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadAnalytics]);

  const toggleRobot = async () => {
    if (robotBusy) return;
    setRobotBusy(true);
    try {
      writeStoredConfig(config);
      const response = await kalshiAPI.setPaperRobot(!robotState?.enabled, config, executionMode);
      if (response.data?.state) setRobotState(response.data.state);
      if (response.data?.portfolio) setPaperPortfolio(response.data.portfolio);
      if (response.data?.snapshot && response.data?.decision) {
        acceptPayload({ success: true, snapshot: response.data.snapshot, decision: response.data.decision, robotState: response.data.state }, executionMode);
      }
      setError('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || copy('Kalshi robot could not be updated.', 'Kalshi 机器人无法更新。'));
    } finally {
      setRobotBusy(false);
    }
  };

  const applyConfig = async (nextConfig: KalshiBotConfig = config) => {
    if (applyBusy) return;
    setApplyBusy(true);
    setApplyMessage('');
    setConfig(nextConfig);
    writeStoredConfig(nextConfig);
    try {
      const saved = await kalshiAPI.savePaperRobotConfig(nextConfig, nextConfig.executionMode);
      if (saved.data?.state) setRobotState(saved.data.state);
      const response = isHourly
        ? await kalshiAPI.evaluateHourly(nextConfig.executionMode)
        : await kalshiAPI.evaluate(nextConfig);
      if (!response.data?.success) throw new Error(response.data?.message || 'Kalshi evaluation failed');
      acceptPayload(response.data, nextConfig.executionMode === 'real' ? 'real' : 'paper');
      setApplyMessage(copy('Saved and evaluated with the new limits.', '已保存，并使用新限制完成评估。'));
      await loadPaperPortfolio(nextConfig.executionMode === 'real' ? 'real' : 'paper');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || copy('Robot limits could not be saved.', '机器人限制无法保存。'));
    } finally {
      setApplyBusy(false);
    }
  };

  const updateConfig = (key: keyof KalshiBotConfig, raw: number, scale = 1) => {
    if (!Number.isFinite(raw)) return;
    setConfig((current) => ({ ...current, [key]: raw / scale }));
  };

  const closeAt = decision?.market.closeTime ? Date.parse(decision.market.closeTime) : NaN;
  const secondsLeft = Number.isFinite(closeAt) ? Math.max(0, Math.floor((closeAt - clock) / 1000)) : null;
  const countdown = secondsLeft === null
    ? '--:--'
    : `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const rawMarket = snapshot?.market || {};
  const rulesPrimary = typeof rawMarket.rules_primary === 'string' ? rawMarket.rules_primary : '';
  const rulesSecondary = typeof rawMarket.rules_secondary === 'string' ? rawMarket.rules_secondary : '';
  const active = snapshot?.selection === 'active';
  const blockedGateCount = decision?.gates.filter((gate) => gate.status === 'block').length || 0;
  const adaptiveGateCount = decision?.gates.filter((gate) => gate.status === 'observe').length || 0;
  const kalshiModeLabel = isRealMode ? copy('KALSHI REAL', 'KALSHI 实盘') : copy('ALPHALAB PAPER', 'ALPHALAB 模拟盘');

  const renderMetrics = () => (
    <section className="kalshi-metric-strip" aria-label={copy('Contract snapshot', '合约快照')}>
      <div><span>{copy('CONTRACT', '合约')}</span><strong>{decision?.market.ticker || 'KXBTC15M'}</strong><small>{active ? copy('Trading now', '正在交易') : copy('Next available interval', '下一个可用时段')}</small></div>
      <div><span>{copy('TIME LEFT', '剩余时间')}</span><strong>{countdown}</strong><small>{copy('Entry closes before settlement', '进场早于结算')}</small></div>
      <div><span>{copy('STRIKE', '结算基准')}</span><strong>{money(decision?.market.strike)}</strong><small>{copy('Reference at window open', '开盘参考价')}</small></div>
      <div><span>{copy('BTC REFERENCE', 'BTC 参考价')}</span><strong>{money(decision?.model.spot)}</strong><small>{decision?.model.isOfficialBrti ? `Official BRTI · ${decision.model.settlementWindowSamples || 0}/60` : decision?.model.referenceModel === 'brti_constituent_proxy' ? `BRTI proxy · ${decision.model.referenceVenueCount || 0} venues` : 'BTC-USD fallback'}</small></div>
      <div><span>{copy('YES / NO ASK', 'YES / NO 卖价')}</span><strong>{cents(decision?.market.yesAsk)} / {cents(decision?.market.noAsk)}</strong><small>{copy('Executable quotes', '可成交报价')}</small></div>
      <div><span>{copy('VOLUME / OI', '成交量 / 持仓量')}</span><strong>{compact(decision?.market.volume)} / {compact(decision?.market.openInterest)}</strong><small>{copy('Contract units', '合约份数')}</small></div>
    </section>
  );

  const renderDecision = () => (
    <section className="kalshi-desk-grid">
      <article className="kalshi-probability-panel">
        <div className="kalshi-section-head">
          <div><span>01 / {copy('PROBABILITY', '概率')}</span><h2>{copy('Market vs. model', '市场与模型')}</h2></div>
          <span className={`kalshi-live-mark${active ? ' is-live' : ''}`}><i />{active ? copy('LIVE CONTRACT', '实时合约') : copy('SCHEDULED', '等待开盘')}</span>
        </div>
        <div className="kalshi-probability-readout">
          <div><span>{copy('Market YES', '市场 YES')}</span><strong>{probability(decision?.model.marketYesProbability)}</strong><small>{copy('midpoint probability', '中间价概率')}</small></div>
          <div><span>{copy('Model YES', '模型 YES')}</span><strong>{probability(decision?.model.modelYesProbability)}</strong><small>{copy('spot and realized volatility', '现货与实现波动率')}</small></div>
          <div className="is-accent"><span>{copy('Tradable fair YES', '可交易公平 YES')}</span><strong>{probability(decision?.model.fairYesProbability)}</strong><small>{copy('requires a valid live book', '必须有有效实时盘口')}</small></div>
        </div>
        <div className="kalshi-probability-rail" aria-label={copy('YES probability comparison', 'YES 概率对比')}>
          <span className="kalshi-probability-axis"><i>0%</i><i>50%</i><i>100%</i></span>
          {number(decision?.model.marketYesProbability) !== null && <i className="is-market" style={{ left: `${Math.min(100, Math.max(0, Number(decision?.model.marketYesProbability) * 100))}%` }}><b>{copy('Market', '市场')}</b></i>}
          {number(decision?.model.fairYesProbability) !== null && <i className="is-model" style={{ left: `${Math.min(100, Math.max(0, Number(decision?.model.fairYesProbability) * 100))}%` }}><b>{copy('Fair', '公平')}</b></i>}
        </div>
        <dl className="kalshi-evidence-grid">
          <div><dt>{copy('Distance to strike', '距离基准')}</dt><dd>{number(decision?.model.distanceBps) === null ? '--' : `${Number(decision?.model.distanceBps).toFixed(1)} bps`}</dd></div>
          <div><dt>{copy('3m / 15m momentum', '3 / 15 分钟动量')}</dt><dd>{probability(decision?.model.momentum3m, 2)} / {probability(decision?.model.momentum15m, 2)}</dd></div>
          <div><dt>{copy('Horizon / 15m vol', '剩余周期 / 15 分钟波动')}</dt><dd>{probability(decision?.model.horizonVolatility, 2)} / {probability(decision?.model.projected15mVolatility, 2)}</dd></div>
          <div><dt>{copy('Model uncertainty', '模型不确定性')}</dt><dd>{probability(decision?.model.uncertainty, 1)}</dd></div>
          <div><dt>{copy('Vol regime / jump', '波动状态 / 跳跃')}</dt><dd>{number(decision?.model.volatilityRatio) === null ? '--' : `${Number(decision?.model.volatilityRatio).toFixed(2)}x / ${Number(decision?.model.jumpSigma || 0).toFixed(1)}σ`}</dd></div>
          <div><dt>{copy('Book imbalance', '盘口不平衡')}</dt><dd>{probability(decision?.market.bookImbalance)}</dd></div>
          <div><dt>{copy('Selected side', '选择方向')}</dt><dd>{decision?.edge.side || '--'}</dd></div>
        </dl>
      </article>

      <aside className={`kalshi-decision-panel is-${decision?.action === 'WAIT' ? 'wait' : 'advance'}`}>
        <div className="kalshi-section-head">
          <div><span>02 / {isRealMode ? copy('REAL DECISION', '实盘决策') : copy('PAPER DECISION', '模拟决策')}</span><h2>{copy('Risk-owned output', '风控主导输出')}</h2></div>
          <SafetyCertificateOutlined />
        </div>
        <div className="kalshi-action-line">
          <span>{actionLabel(decision, chinese)}</span>
          <strong>{decision?.signalQuality ?? 0}<small>/100</small></strong>
        </div>
        <p>{actionSummary(decision, chinese, isRealMode)}</p>
        <dl className="kalshi-decision-numbers">
          <div className="is-highlight"><dt>{copy('Favorite confidence', '优势侧胜率')}</dt><dd>{probability(decision?.edge.modelProbability ?? decision?.model.selectedModelProbability)}<em>{copy('min', '下限')} {probability(decision?.edge.minimumModelProbability, 0)}</em></dd></div>
          <div><dt>{copy('Executable price', '可成交价格')}</dt><dd>{cents(decision?.edge.price)}</dd></div>
          <div><dt>{copy('Conservative probability', '保守概率')}</dt><dd>{probability(decision?.edge.conservativeProbability)}</dd></div>
          <div><dt>{copy('Fee estimate', '费用估算')}</dt><dd>{cents(decision?.edge.feePerContract, 2)}</dd></div>
          <div><dt>{copy('Net / conservative edge', '净边际 / 保守边际')}</dt><dd>{probability(decision?.edge.netEdge)} / {probability(decision?.edge.conservativeEdge)}</dd></div>
          <div><dt>{copy('Required conservative edge', '最低保守边际')}</dt><dd>{probability(decision?.edge.minimumConservativeEdge)}</dd></div>
        </dl>
        <div className="kalshi-size-line">
          <span>{isRealMode ? copy('Real order size', '实盘订单数量') : copy('Paper size', '模拟仓位')}<small>{copy('Fractional Kelly, hard risk, cash, and book participation capped', '受分数凯利、硬风险、现金与盘口参与率共同限制')}</small></span>
          <strong>{decision?.sizing.contracts || 0} <small>{copy('contracts', '份')}</small></strong>
          <b>{money(decision?.sizing.maximumLoss)}</b>
        </div>
      </aside>
    </section>
  );

  const renderGates = () => (
    <section className="kalshi-gates-section">
      <div className="kalshi-section-head">
        <div><span>03 / {copy('TRADE GATES', '交易门控')}</span><h2>{copy('Hard controls and adaptive confirmation', '硬风控与自适应确认')}</h2></div>
        <strong>{decision ? `${blockedGateCount} ${copy('blocked', '阻断')} · ${adaptiveGateCount} ${copy('adaptive', '自适应')}` : '--'}</strong>
      </div>
      <div className="kalshi-gate-list">
        {(decision?.gates || []).map((gate: KalshiGate) => (
          <div key={gate.key} className={`kalshi-gate is-${gate.status}`}>
            {gate.status === 'pass' ? <CheckCircleOutlined /> : gate.status === 'observe' ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
            <span><em>{String(gate.category || 'signal').toUpperCase()}</em><b>{chinese ? gate.labelZh : gate.label}</b><small>{gate.detail}</small></span>
            <strong>{gate.status === 'pass' ? copy('PASS', '通过') : gate.status === 'observe' ? copy('EDGE+', '提高边际') : copy('BLOCK', '阻断')}</strong>
          </div>
        ))}
      </div>
    </section>
  );

  const renderBook = () => {
    const rows = Math.max(snapshot?.orderbook.yes.length || 0, snapshot?.orderbook.no.length || 0, 1);
    return (
      <section className="kalshi-book-section">
        <div className="kalshi-section-head">
          <div><span>04 / {copy('ORDER BOOK', '订单簿')}</span><h2>{copy('Resting bid depth', '挂单买方深度')}</h2></div>
          <small>{copy('Asks are implied by the reciprocal YES / NO book', '卖价由 YES / NO 互补订单簿推导')}</small>
        </div>
        <div className="kalshi-book-table" role="table" aria-label={copy('Kalshi order book', 'Kalshi 订单簿')}>
          <div className="kalshi-book-header" role="row"><span>YES {copy('BID', '买价')}</span><span>{copy('SIZE', '数量')}</span><span>NO {copy('BID', '买价')}</span><span>{copy('SIZE', '数量')}</span></div>
          {Array.from({ length: Math.min(rows, 8) }).map((_, index) => {
            const yes = snapshot?.orderbook.yes[snapshot.orderbook.yes.length - 1 - index];
            const no = snapshot?.orderbook.no[snapshot.orderbook.no.length - 1 - index];
            return <div className="kalshi-book-row" role="row" key={index}><b>{yes ? cents(yes[0]) : '--'}</b><span>{yes ? compact(yes[1]) : '--'}</span><b>{no ? cents(no[0]) : '--'}</b><span>{no ? compact(no[1]) : '--'}</span></div>;
          })}
        </div>
      </section>
    );
  };

  const renderRiskControls = () => {
    const modeEquity = paperPortfolio
      ? (
        isRealMode
          ? Number(paperPortfolio.balance?.portfolio_value ?? paperPortfolio.balance?.balance ?? 0)
          : Number(paperPortfolio.balance?.balance || 0) + Number(paperPortfolio.balance?.portfolio_value || 0)
      ) / 100
      : Number(config.paperBankroll || 0);
    const controls: Array<{
      key: keyof KalshiBotConfig;
      label: [string, string];
      unit: [string, string];
      min: number;
      max: number;
      step: number;
      scale?: number;
    }> = [
      { key: 'riskPerTradePct', label: ['Risk per order', '每次下单风险'], unit: ['%', '%'], min: 0.1, max: 2, step: 0.05 },
      { key: 'minModelProbability', label: ['Model probability floor', '模型概率下限'], unit: ['%', '%'], min: 50, max: 90, step: 1, scale: 100 },
      { key: 'minPrice', label: ['Entry price floor', '进场价格下限'], unit: ['cents', '美分'], min: 30, max: 60, step: 1, scale: 100 },
      { key: 'maxPrice', label: ['Entry price ceiling', '进场价格上限'], unit: ['cents', '美分'], min: 40, max: 99, step: 1, scale: 100 },
      { key: 'minSecondsToClose', label: ['Entry window start', '进场窗口起点'], unit: ['seconds to close', '距关闭秒数'], min: 45, max: 360, step: 5 },
      { key: 'maxSecondsToClose', label: ['Entry window end', '进场窗口终点'], unit: ['seconds to close', '距关闭秒数'], min: 180, max: 840, step: 10 },
      { key: 'minNetEdge', label: ['Minimum net edge', '最低净边际'], unit: ['%', '%'], min: 0, max: 15, step: 0.25, scale: 100 },
      { key: 'minConservativeEdge', label: ['Conservative edge floor', '保守边际下限'], unit: ['%', '%'], min: 0, max: 10, step: 0.25, scale: 100 },
      { key: 'maxSpread', label: ['Maximum spread', '最大点差'], unit: ['cents', '美分'], min: 1, max: 20, step: 0.5, scale: 100 },
      { key: 'minDepthContracts', label: ['Minimum ask depth', '最低卖方深度'], unit: ['contracts', '份'], min: 1, max: 10000, step: 5 },
      { key: 'maxBookParticipation', label: ['Book participation cap', '盘口参与率上限'], unit: ['%', '%'], min: 1, max: 50, step: 1, scale: 100 },
      { key: 'maxPortfolioExposurePct', label: ['Portfolio exposure cap', '组合敞口上限'], unit: ['%', '%'], min: 2, max: 50, step: 1 },
      { key: 'maxSingleMarketExposurePct', label: ['Single-market exposure cap', '单一市场敞口上限'], unit: ['%', '%'], min: 1, max: 20, step: 1 },
      { key: 'addMinModelProbability', label: ['Add-on probability floor', '加仓概率下限'], unit: ['%', '%'], min: 50, max: 95, step: 1, scale: 100 },
      { key: 'addMinConservativeEdge', label: ['Add-on edge floor', '加仓边际下限'], unit: ['%', '%'], min: 0, max: 10, step: 0.25, scale: 100 },
      { key: 'addMinProbabilityImprovement', label: ['Add-on probability improvement', '加仓概率改善'], unit: ['percentage points', '百分点'], min: 0, max: 10, step: 0.25, scale: 100 },
      { key: 'addMinEdgeImprovement', label: ['Add-on edge improvement', '加仓边际改善'], unit: ['percentage points', '百分点'], min: 0, max: 3, step: 0.1, scale: 100 },
      { key: 'addSizeFraction', label: ['Add-on size fraction', '单次加仓比例'], unit: ['% of fresh size', '新计算仓位比例'], min: 10, max: 100, step: 5, scale: 100 },
      { key: 'minimumAddIntervalSeconds', label: ['Minimum add interval', '最短加仓间隔'], unit: ['seconds', '秒'], min: 10, max: 180, step: 5 },
      { key: 'executionPriceTolerance', label: ['IOC crossing allowance', 'IOC 成交容差'], unit: ['cents', '美分'], min: 0, max: 3, step: 0.25, scale: 100 },
      { key: 'minimumHoldSeconds', label: ['Minimum hold time', '最短持仓时间'], unit: ['seconds', '秒'], min: 0, max: 300, step: 5 },
      { key: 'exitValueBuffer', label: ['Exit edge buffer', '平仓边际缓冲'], unit: ['%', '%'], min: 0.25, max: 5, step: 0.25, scale: 100 },
      { key: 'minimumExitProfit', label: ['Minimum net exit profit', '最低净平仓盈利'], unit: ['cents per contract', '每份美分'], min: 0, max: 10, step: 0.5, scale: 100 },
      { key: 'takeProfitScaleOutPct', label: ['Take-profit scale-out', '止盈减仓比例'], unit: ['% of position', '持仓比例'], min: 10, max: 100, step: 5, scale: 100 },
      { key: 'exitProbabilityThreshold', label: ['Protective probability gate', '保护性概率门槛'], unit: ['%', '%'], min: 10, max: 49, step: 1, scale: 100 },
      { key: 'stopLossPct', label: ['Protective stop-loss gate', '保护性止损门槛'], unit: ['%', '%'], min: 15, max: 80, step: 5, scale: 100 },
      { key: 'emergencyStopLossPct', label: ['Emergency stop-loss gate', '紧急止损门槛'], unit: ['%', '%'], min: 10, max: 60, step: 5, scale: 100 },
    ];

    return <section className="kalshi-controls-section">
      <div className="kalshi-section-head">
        <div><span>{isRealMode ? copy('REAL RISK POLICY', '实盘风控策略') : copy('PAPER RISK POLICY', '模拟风控策略')}</span><h2>{isHourly ? copy('BTC hourly monotone ladder v2', 'BTC 整点单调阶梯策略 v2') : copy('BTC 15-minute settlement-aligned v6', 'BTC 15 分钟结算对齐策略 v6')}</h2></div>
        <div className="kalshi-apply-action">
          {applyMessage && <small>{applyMessage}</small>}
          <button type="button" onClick={() => void applyConfig()} disabled={applyBusy}><ThunderboltOutlined className={applyBusy ? 'is-spinning' : ''} />{applyBusy ? copy('Applying…', '正在应用…') : copy('Apply and evaluate', '应用并评估')}</button>
        </div>
      </div>
      <div className="kalshi-policy-note"><SafetyCertificateOutlined /><span><b>{copy('One transparent deterministic strategy.', '只保留一套透明的确定性策略。')}</b>{copy(' Data, liquidity, fee-adjusted edge and exposure are hard controls. Trend and book pressure are adaptive confirmations: disagreement raises the required edge instead of vetoing every trade.', ' 数据、流动性、扣费后边际和敞口属于硬风控；趋势与盘口压力属于自适应确认，出现分歧时会提高所需边际，而不是直接封死交易。')}</span></div>
      <div className="kalshi-control-grid">
        <label><span>{isRealMode ? copy('Real account equity', '实盘账户权益') : copy('Paper account equity', '模拟账户权益')}<small>{copy('USD', '美元')}</small></span><input type="number" value={Number.isFinite(modeEquity) ? modeEquity.toFixed(2) : config.paperBankroll} disabled readOnly /></label>
        {controls.map((control) => {
          const scale = control.scale || 1;
          return <label key={control.key}><span>{copy(control.label[0], control.label[1])}<small>{copy(control.unit[0], control.unit[1])}</small></span><input type="number" min={control.min} max={control.max} step={control.step} value={Number(config[control.key]) * scale} onChange={(event) => updateConfig(control.key, event.target.valueAsNumber, scale)} /></label>;
        })}
      </div>
      <div className="kalshi-policy-note"><SafetyCertificateOutlined /><span><b>{copy('No trade-count cap.', '不限制交易次数。')}</b>{copy(' Every order still needs positive fee-adjusted edge, fresh data, sufficient liquidity, and available exposure. Positions are held to settlement unless a fee-adjusted exit or protective exit is better.', ' 但每次下单仍须满足扣费后正边际、数据新鲜、流动性充足和敞口可用；仓位默认持有至结算，只有扣费后平仓更优或触发保护性退出时才离场。')}</span></div>
    </section>;
  };
  const renderDecisionLog = () => {
    const retainedDecisions: any[] = (robotState?.decisions?.length ? robotState.decisions : history) as any[];
    const item: any = retainedDecisions[0];
    const intent = String(item?.executionIntent || '');
    const decisionText = !item
      ? copy('WAIT', '等待')
      : `${intent.startsWith('CLOSE')
        ? copy('CLOSE', '平仓')
        : intent.startsWith('ADD')
          ? copy('ADD', '加仓')
          : intent.startsWith('HOLD')
            ? copy('HOLD', '持有')
            : item.action === 'WAIT'
              ? copy('WAIT', '等待')
              : copy('BUY', '买入')} ${item.side || ''}`;
    const reasonLabels: Record<string, string> = {
      contract_active: copy('Contract is not active', '合约当前不可交易'),
      entry_window: copy('Outside the permitted entry window', '不在允许进场时段'),
      data_freshness: copy('Market evidence is stale', '市场数据已过期'),
      history_sample: copy('Not enough price history', '价格历史样本不足'),
      volatility_regime: copy('Volatility is outside the strategy range', '波动率超出策略范围'),
      model_market_agreement: copy('Model and market disagree too much', '模型与市场分歧过大'),
      model_probability: copy('Favorite-side confidence is below the floor', '优势侧模型胜率低于下限'),
      price_band: copy('Executable price is outside the favorite band', '可成交价不在优势侧价格区间'),
      book_pressure: copy('Order-book pressure is adverse', '盘口压力不利'),
      trend_confirmation: copy('Trend confirmation is insufficient', '趋势确认不足'),
      two_sided_quote: copy('No executable two-sided quote', '缺少可成交双边报价'),
      spread: copy('Spread is too wide', '点差过宽'),
      relative_spread: copy('Spread is too large relative to the contract price', '相对合约价格而言点差过宽'),
      depth: copy('Available depth is too low', '可成交深度不足'),
      net_edge: copy('Net edge is below the minimum', '净边际低于最低要求'),
      conservative_edge: copy('Conservative edge is below the minimum', '保守边际低于最低要求'),
      portfolio_exposure: copy('Portfolio exposure limit reached', '组合敞口已达上限'),
      loss_cooldown: copy('Loss-streak cooldown is active', '连败冷却中'),
      market_exposure: copy('Single-market exposure limit reached', '单一市场敞口已达上限'),
      add_order_pending: copy('An add-on order is still pending', '加仓订单仍在处理中'),
      add_interval: copy('Minimum add-on interval has not elapsed', '尚未达到最短加仓间隔'),
      add_signal_not_improved: copy('The signal is not strong enough to add', '当前信号强度不足以加仓'),
      add_exposure_full: copy('No exposure room remains for an add-on', '当前没有可用的加仓敞口'),
      close_order_pending: copy('A close order is still pending', '平仓订单仍在处理中'),
      minimum_hold_period: copy('Minimum hold time has not elapsed', '尚未达到最短持仓时间'),
    };
    const reasons = (item?.blockingReasons || []).map((reason: string) => reasonLabels[reason] || reason.replace(/_/g, ' '));
    return (
      <section className="kalshi-current-decision">
        <div className="kalshi-section-head"><div><span>{copy('DECISION AUDIT', '决策审计')}</span><h2>{copy('What the robot is doing now', '机器人现在在做什么')}</h2><small>{copy('Up to 250 compact decisions are retained per mode; orders and fills remain in their execution ledgers.', '每个模式最多保留 250 条精简决策；订单与成交长期保留在执行账本中。')}</small></div><strong>{retainedDecisions.length}</strong></div>
        {item ? <div className="kalshi-current-decision-grid">
          <article className={item.action === 'WAIT' ? 'is-waiting' : 'is-trading'}><span>{copy('DECISION', '当前决定')}</span><strong>{decisionText}</strong><small>{new Date(item.generatedAt).toLocaleString(chinese ? 'zh-CN' : 'en-US')}</small></article>
          <article><span>{copy('ORDER RESULT', '订单结果')}</span><strong>{item.orderFilled ? copy('FILLED', '已成交') : item.orderSubmitted ? copy('NOT FILLED', '未成交') : copy('NO ORDER', '未下单')}</strong><small>{item.fillCount ? `${copy('Quantity', '数量')} ${item.fillCount}` : kalshiModeLabel}</small></article>
          <article><span>{copy('MODEL / EXECUTABLE PRICE', '模型概率 / 可成交价')}</span><strong>{probability(item.fairProbability)} / {cents(item.price)}</strong><small>{copy('Probability compared with current cost', '模型概率与当前成本对比')}</small></article>
          <article><span>{copy('SIGNAL QUALITY', '信号质量')}</span><strong>{Math.round(Number(item.signalQuality || 0))}/100</strong><small>{reasons.length ? copy(`${reasons.length} controls blocked`, `${reasons.length} 项条件未通过`) : copy('All controls passed', '所有条件已通过')}</small></article>
        </div> : <div className="kalshi-empty-row">{copy('Waiting for the first complete market decision.', '正在等待第一条完整市场决策。')}</div>}
        {item && <div className="kalshi-decision-explanation"><b>{reasons.length ? copy('Why it is waiting', '为什么等待') : copy('Why it can trade', '为什么可以交易')}</b>{reasons.length ? <ul>{reasons.slice(0, 5).map((reason: string) => <li key={reason}>{reason}</li>)}</ul> : <p>{copy('The signal, executable price, liquidity and account limits all passed.', '信号、可成交价格、流动性和账户限制均已通过。')}</p>}</div>}
        {retainedDecisions.length > 1 && <div className="kalshi-decision-history">
          {retainedDecisions.slice(1, 13).map((row: any, index: number) => <div key={`${row.generatedAt}-${index}`}>
            <time>{row.generatedAt ? new Date(row.generatedAt).toLocaleTimeString(chinese ? 'zh-CN' : 'en-US') : '--'}</time>
            <b>{row.executionIntent || row.action || 'WAIT'}</b>
            <span>{row.ticker || '--'}</span>
            <span>{row.side || '--'} · {cents(row.price)}</span>
            <em>{probability(row.conservativeEdge)}</em>
            <small>{(row.blockingReasons || []).length ? `${(row.blockingReasons || []).length} ${copy('hard blocks', '项硬阻断')}` : row.orderFilled ? copy('FILLED', '已成交') : copy('CLEAR', '通过')}</small>
          </div>)}
        </div>}
      </section>
    );
  };

  const renderRules = () => (
    <section className="kalshi-reference-page">
      <div className="kalshi-reference-column"><span>01</span><h2>{copy('Resolution rule', '结算规则')}</h2><p>{rulesPrimary || copy('Waiting for the active contract rule.', '正在等待当前合约规则。')}</p></div>
      <div className="kalshi-reference-column"><span>02</span><h2>{copy('Reference methodology', '参考方法')}</h2><p>{rulesSecondary || copy('The official result is a 60-second average of the CF Benchmarks Real-Time Index over the final minute, not the last Coinbase trade.', '官方结果为结算前最后一分钟 CF Benchmarks 实时指数的 60 秒均价，而不是 Coinbase 最后一笔成交。')}</p></div>
      <div className="kalshi-reference-column"><span>03</span><h2>{copy('Model boundary', '模型边界')}</h2><p>{copy('The primary input is Kalshi\'s authenticated official BRTI stream. If it is unavailable, the engine clearly falls back to a four-venue proxy, raises its basis reserve, and keeps the stricter 50-cent price floor.', '模型主要使用 Kalshi 认证的官方 BRTI 实时流；若不可用，会明确回退到四交易所代理、提高基差缓冲，并保持更严格的 50 美分价格下限。')}</p></div>
    </section>
  );

  const renderPortfolio = () => {
    if (!paperPortfolio) {
      return <section className="kalshi-empty-workspace"><SafetyCertificateOutlined /><span>{kalshiModeLabel}</span><h2>{isRealMode ? copy('Your Kalshi account is loading.', '正在加载你的 Kalshi 账户。') : copy('The built-in Paper account is loading.', '内置 Paper 账户正在加载。')}</h2><p>{isRealMode ? copy('Real mode uses the API key saved in Settings.', '实盘模式使用设置里保存的 API Key。') : copy('No personal Kalshi API key is required.', '无需配置个人 Kalshi API Key。')}</p></section>;
    }
    const cash = Number(paperPortfolio.balance?.balance || 0) / 100;
    const portfolioValue = Number(paperPortfolio.balance?.portfolio_value || 0) / 100;
    const portfolioMode = (isRealMode || paperPortfolio.environment === 'real') ? 'real' : 'paper';
    // Kalshi Real's portfolio_value is already total account value (cash plus
    // positions). AlphaLab Paper stores open-position value separately.
    const accountEquity = portfolioMode === 'real'
      ? Number(paperPortfolio.balance?.portfolio_value ?? paperPortfolio.balance?.balance ?? 0) / 100
      : cash + portfolioValue;
    const analytics = paperPortfolio.analytics || {};
    const fallbackSettlementRecords = robotState?.strategy?.settlementRecords || [];
    const realizedRecords = (
      Array.isArray(analytics.realizedTradeRecords)
        ? analytics.realizedTradeRecords
        : robotState?.strategy?.realizedTradeRecords?.length
          ? robotState.strategy.realizedTradeRecords
          : analytics.settlementRecords?.length
            ? analytics.settlementRecords
            : fallbackSettlementRecords
    )
      .filter((record: any) => !record.environment || record.environment === portfolioMode);
    const fallbackEquityCurve = robotState?.strategy?.equityCurve || [];
    const equityCurve = (Array.isArray(analytics.equityCurve) ? analytics.equityCurve : fallbackEquityCurve)
      .filter((point: any) => !point.environment || point.environment === portfolioMode);
    const realizedSamples = analytics.realizedSamples ?? realizedRecords.length;
    const wins = analytics.realizedWins ?? analytics.wins ?? realizedRecords.filter((record) => record.pnl > 0).length;
    const winRate = analytics.realizedWinRate ?? analytics.winRate ?? (realizedSamples ? wins / realizedSamples : null);
    const totalPnl = analytics.realizedTotalPnl ?? analytics.totalPnl ?? realizedRecords.reduce((sum, record) => sum + Number(record.pnl || 0), 0);
    const averagePnl = analytics.realizedAveragePnl ?? analytics.averagePnl ?? (realizedSamples ? Number(totalPnl) / realizedSamples : 0);
    const positionRows = paperPortfolio.positions || [];
    const orderRows = paperPortfolio.orders || [];
    const filledOrders = orderRows.filter((item: any) => Number(item.fill_count_fp || 0) > 0);
    const rejectedOrders = orderRows.filter((item: any) => String(item.status || '').toLowerCase() === 'rejected');
    const totalFees = orderRows.reduce((sum: number, item: any) => sum + Number(orderFee(item) || 0), 0);
    // Portfolio analytics ---------------------------------------------------
    const startingBalance = Number(paperPortfolio.balance?.starting_balance || 0) / 100;
    const displayBaseline = analytics.displayBaseline;
    const displayBaselineEquity = displayBaseline?.active
      ? Number(displayBaseline.baselineEquityCents || 0) / 100
      : 0;
    const returnBase = displayBaselineEquity > 0 ? displayBaselineEquity : startingBalance;
    const unrealizedPnl = positionRows.reduce((sum: number, item: any) => sum + Number(item.unrealized_pnl_dollars || 0), 0);
    const openExposure = positionRows.reduce((sum: number, item: any) => sum + Number(item.market_exposure_dollars || 0), 0);
    const totalReturnPct = returnBase > 0 ? (accountEquity - returnBase) / returnBase : null;
    const pnlValues = realizedRecords.map((record: any) => Number(record.pnl || 0));
    const bestTrade = analytics.realizedBestTrade ?? (pnlValues.length ? Math.max(...pnlValues) : null);
    const worstTrade = analytics.realizedWorstTrade ?? (pnlValues.length ? Math.min(...pnlValues) : null);
    const losses = Math.max(0, realizedSamples - Number(wins || 0));
    const grossWin = pnlValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = pnlValues.filter((value) => value < 0).reduce((sum, value) => sum + Math.abs(value), 0);
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
    const familyPerformance = (analytics.marketPerformance || {}) as Record<string, any>;

    if (view === 'orders') {
      return (
        <>
          <section className="kalshi-execution-strip">
            <div><span>{copy('ORDER REQUESTS', '订单请求')}</span><strong>{orderRows.length}</strong><small>{copy('Current account ledger', '当前账户流水')}</small></div>
            <div><span>{copy('FILLED', '已成交')}</span><strong>{filledOrders.length}</strong><small>{copy('Full or partial fills', '全部或部分成交')}</small></div>
            <div><span>{copy('REJECTED', '已拒绝')}</span><strong>{rejectedOrders.length}</strong><small>{copy('No position created', '未建立仓位')}</small></div>
            <div><span>{copy('REPORTED FEES', '已报告费用')}</span><strong>{money(totalFees)}</strong><small>{copy('Across displayed orders', '当前列表合计')}</small></div>
          </section>
          <section className="kalshi-ledger-section">
            <div className="kalshi-section-head"><div><span>{copy('EXECUTION LEDGER', '执行流水')}</span><h2>{copy('Orders and fills', '订单与成交')}</h2><small>{copy('IOC requests, fill quantity, executable prices, slippage and fees.', 'IOC 请求、成交数量、可成交价格、滑点与费用。')}</small></div><strong>{orderRows.length}</strong></div>
            <div className="kalshi-order-table">
              <div className="kalshi-order-head"><span>{copy('TIME', '时间')}</span><span>{copy('CONTRACT', '合约')}</span><span>{copy('ORDER', '订单')}</span><span>{copy('REQUEST / FILLED', '请求 / 成交')}</span><span>{copy('LIMIT / AVG', '限价 / 均价')}</span><span>{copy('SLIPPAGE / FEE', '滑点 / 费用')}</span><span>{copy('STATUS', '状态')}</span></div>
              {orderRows.length ? orderRows.map((item: any, index: number) => {
                const tradeAction = String(item.action || item.order_action || '').replace(/_/g, ' ').toUpperCase();
                const outcomeSide = String(item.outcome_side || '').toUpperCase();
                const orderLabel = [tradeAction, outcomeSide].filter(Boolean).join(' ') || '--';
                return (
                  <div className={`kalshi-order-row is-${String(item.status || 'unknown').replace(/_/g, '-')}`} key={item.order_id || `${item.ticker}-${index}`}>
                    <span>{item.created_time ? new Date(item.created_time).toLocaleTimeString(chinese ? 'zh-CN' : 'en-US') : '--'}</span>
                    <b>{item.ticker || '--'}</b>
                    <span>{orderLabel} · {String(item.time_in_force || 'IOC').toUpperCase()}</span>
                    <strong>{Number(item.count_fp || 0)} / {Number(item.fill_count_fp || 0)}</strong>
                    <span>{cents(orderSidePrice(item, 'limit'))} / {cents(orderSidePrice(item, 'average'))}</span>
                    <span>{item.slippage_dollars != null ? `${(Number(item.slippage_dollars) * 100).toFixed(1)}c` : Number(item.fill_count_fp || 0) > 0 ? '0.0c' : '--'} / {orderFee(item) == null ? '--' : money(orderFee(item))}</span>
                    <span><em>{String(item.status || '--').replace(/_/g, ' ')}</em>{item.rejection_reason ? <small>{item.rejection_reason}</small> : null}</span>
                  </div>
                );
              }) : <div className="kalshi-empty-row">{isRealMode ? copy('No real Kalshi IOC orders have been returned yet.', '尚未返回实盘 Kalshi IOC 订单。') : copy('No Paper IOC orders have been submitted yet.', '尚无 Paper IOC 订单。')}</div>}
            </div>
          </section>
          <section className="kalshi-ledger-section">
            <div className="kalshi-section-head"><div><span>{copy('EXECUTION EVENTS', '执行事件')}</span><h2>{copy('Fills and settlements', '成交与结算')}</h2><small>{copy('Raw account events for execution audit.', '用于执行审计的原始账户事件。')}</small></div><strong>{paperPortfolio.fills.length + paperPortfolio.settlements.length}</strong></div>
            <div className="kalshi-activity-list">{[...paperPortfolio.fills.map((item) => ({ ...item, kind: 'FILL' })), ...paperPortfolio.settlements.map((item) => ({ ...item, kind: 'SETTLEMENT' }))].map((item: any, index) => {
              const eventTime = item.created_time || item.settled_time;
              return <div key={item.fill_id || item.settlement_id || `${item.ticker}-${index}`}><b className={item.kind === 'SETTLEMENT' ? 'is-settlement' : ''}>{item.kind}</b><strong>{item.ticker || item.market_ticker || '--'}</strong><span>{String(item.outcome_side || item.market_result || item.side || '--').toUpperCase()}</span><span>{item.count_fp || item.yes_count_fp || item.no_count_fp || '--'}</span><small>{eventTime ? new Date(eventTime).toLocaleString(chinese ? 'zh-CN' : 'en-US') : '--'}</small></div>;
            })}</div>
          </section>
        </>
      );
    }

    const returnClass = totalReturnPct === null ? '' : totalReturnPct >= 0 ? 'is-profit' : 'is-loss';
    return (
      <>
        {displayBaseline?.active && <section className="kalshi-display-baseline" data-testid="kalshi-display-baseline">
          <DatabaseOutlined />
          <div>
            <span>{copy('VISIBLE PERIOD', '当前显示周期')}</span>
            <strong>{copy('New measurement period is active', '新的统计周期已启用')}</strong>
            <small>{copy('Visible P/L and results restart from', '可见盈亏与交易结果从')} {displayBaseline.resetAt ? new Date(displayBaseline.resetAt).toLocaleString(chinese ? 'zh-CN' : 'en-US') : '--'} · {copy('The full execution ledger remains available in Orders.', '完整订单与成交历史仍保留在“订单”页面。')}</small>
          </div>
          <div><b>{displayBaseline.archivedRealizedEvents || 0}</b><span>{copy('preserved prior events', '笔历史事件已保留')}</span></div>
        </section>}
        <section className="kalshi-family-performance">
          {([
            ['btc15m', copy('BTC 15-minute', 'BTC 15 分钟')],
            ['btchourly', copy('BTC hourly strikes', 'BTC 整点执行价')],
          ] as const).map(([family, label]) => {
            const performance = familyPerformance[family];
            const pnl = Number(performance?.realizedPnl || 0);
            return (
              <article key={family}>
                <span>{label}</span>
                <strong className={pnl >= 0 ? 'is-profit' : 'is-loss'}>{pnl >= 0 ? '+' : ''}{money(pnl)}</strong>
                <small>{performance?.uniqueMarkets || 0} {copy('markets', '个市场')} · {performance?.samples || 0} {copy('realized events', '笔已实现事件')} · {copy('event win rate', '事件胜率')} {performance?.winRate == null ? '--' : probability(performance.winRate)}</small>
                <div><i style={{ width: `${Math.min(100, Math.max(0, Number(performance?.winRate || 0) * 100))}%` }} /></div>
              </article>
            );
          })}
        </section>
        <section className="kalshi-account-strip">
          <div className="is-headline">
            <span>{copy('ACCOUNT EQUITY', '账户权益')}</span>
            <strong>{money(accountEquity)}</strong>
            <small>{totalReturnPct === null
              ? copy('Cash plus open-position value', '现金加未结持仓市值')
              : <>{displayBaseline?.active ? copy('Visible-period return', '当前周期回报') : copy('Total return', '总回报')} <em className={returnClass}>{totalReturnPct >= 0 ? '+' : ''}{(totalReturnPct * 100).toFixed(2)}%</em>{returnBase > 0 ? ` · ${copy('from', '基准')} ${money(returnBase)}` : ''}</>}</small>
          </div>
          <div><span>{isRealMode ? copy('REAL CASH', '实盘现金') : copy('PAPER CASH', '模拟现金')}</span><strong>{money(cash)}</strong><small>{copy('Available buying power', '可用购买力')}</small></div>
          <div><span>{copy('UNREALIZED P/L', '未实现盈亏')}</span><strong className={unrealizedPnl >= 0 ? 'is-profit' : 'is-loss'}>{unrealizedPnl >= 0 ? '+' : ''}{money(unrealizedPnl)}</strong><small>{positionRows.length} {copy('open · exposure', '持仓 · 敞口')} {money(openExposure)}</small></div>
          <div><span>{copy('REALIZED P/L', '已实现盈亏')}</span><strong className={Number(totalPnl) >= 0 ? 'is-profit' : 'is-loss'}>{Number(totalPnl) >= 0 ? '+' : ''}{money(totalPnl)}</strong><small>{copy('Net of fees · updated', '扣费后 · 更新于')} {new Date(paperPortfolio.asOf).toLocaleTimeString(chinese ? 'zh-CN' : 'en-US')}</small></div>
        </section>
        <section className="kalshi-performance-section">
          <div className="kalshi-performance-summary">
            <div><span>{copy('REALIZED EVENT WIN RATE', '已实现事件胜率')}</span><strong>{winRate === null ? '--' : probability(winRate)}</strong><small><em className="is-profit">{wins}{copy('W', ' 胜')}</em> · <em className="is-loss">{losses}{copy('L', ' 负')}</em> / {realizedSamples} {copy('events', '笔事件')}</small></div>
            <div><span>{copy('AVERAGE / TRADE', '单笔平均')}</span><strong className={Number(averagePnl) >= 0 ? 'is-profit' : Number(averagePnl) < 0 ? 'is-loss' : ''}>{averagePnl === null ? '--' : money(averagePnl)}</strong><small>{copy('Profit factor', '盈亏比')} {profitFactor === null ? '--' : profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}</small></div>
            <div><span>{copy('BEST / WORST', '最佳 / 最差')}</span><strong>{bestTrade === null ? '--' : <><em className="is-profit">{money(bestTrade)}</em></>}</strong><small>{copy('Worst', '最差')} {worstTrade === null ? '--' : <em className="is-loss">{money(worstTrade)}</em>}</small></div>
          </div>
          <div className="kalshi-performance-chart">
            <div><span>{copy('CUMULATIVE REALIZED P/L', '累计已实现盈亏')}</span><small>{copy('Trade-by-trade realized account curve', '逐笔已实现交易账户曲线')}</small></div>
            <PnlChart points={equityCurve} label={copy('No realized trade curve is available yet.', '暂无已实现交易曲线。')} />
          </div>
        </section>
        <section className="kalshi-ledger-section">
          <div className="kalshi-section-head"><div><span>{copy('OPEN EXPOSURE', '当前敞口')}</span><h2>{copy('Positions and marked P/L', '持仓与盯市盈亏')}</h2><small>{kalshiModeLabel}</small></div><strong>{positionRows.length}</strong></div>
          <div className="kalshi-portfolio-table">
              <div className="kalshi-portfolio-head"><span>{copy('CONTRACT', '合约')}</span><span>{copy('SIDE / SIZE', '方向 / 数量')}</span><span>{copy('AVG ENTRY', '平均成本')}</span><span>{copy('MARK', '盯市价')}</span><span>{copy('VALUE / COST', '市值 / 成本')}</span><span>{copy('UNREALIZED / FEES', '浮盈亏 / 费用')}</span><span>{copy('UPDATED', '更新时间')}</span></div>
              {positionRows.length ? positionRows.map((item: any, index: number) => {
                const side = positionSideLabel(item);
                const avgEntry = side === 'NO' ? item.no_average_price_dollars : item.yes_average_price_dollars;
                const mark = side === 'NO' ? item.no_mark_dollars : item.yes_mark_dollars;
                const unrealized = Number(item.unrealized_pnl_dollars || 0);
                return (
                <div className="kalshi-portfolio-row" key={item.ticker || index}>
                  <b>{item.ticker || '--'}</b>
                  <span><em className={`kalshi-side-badge is-${side.toLowerCase()}`}>{side}</em> {Number(item.net_count_fp || 0)}</span>
                  <span>{cents(avgEntry)}</span>
                  <span>{cents(mark)}</span>
                  <span>{money(Number(item.market_value_dollars || 0))} / {money(Number(item.market_exposure_dollars || 0))}</span>
                  <span className={unrealized >= 0 ? 'is-profit' : 'is-loss'}>{unrealized >= 0 ? '+' : ''}{money(unrealized)} / {money(Number(item.fee_cost_dollars || 0))}</span>
                  <span>{item.last_trade_at ? new Date(item.last_trade_at).toLocaleTimeString(chinese ? 'zh-CN' : 'en-US') : '--'}</span>
                </div>
                );
              }) : <div className="kalshi-empty-row">{isRealMode ? copy('Your Kalshi account has no open positions yet.', '你的 Kalshi 账户当前没有持仓。') : copy('The Paper account has no open positions yet.', 'Paper 账户当前没有持仓。')}</div>}
          </div>
        </section>
        <section className="kalshi-ledger-section">
          <div className="kalshi-section-head"><div><span>{copy('REALIZED LEDGER', '已实现账本')}</span><h2>{copy('Realized trade outcomes', '已实现交易结果')}</h2><small>{displayBaseline?.active ? copy('Showing the current visible period; prior results remain preserved in the durable ledger.', '当前仅显示新周期；以前的结果仍完整保存在持久账本中。') : copy('Every filled sale and final settlement is shown with net P/L.', '每笔成交卖出和最终结算均显示净收益。')}</small></div><strong>{realizedRecords.length}</strong></div>
          <div className="kalshi-settlement-table">
            <div className="kalshi-settlement-head"><span>{copy('SETTLED', '结算时间')}</span><span>{copy('CONTRACT', '合约')}</span><span>{copy('POSITION / RESULT', '方向 / 结果')}</span><span>{copy('BUY / EXIT', '买入 / 退出价')}</span><span>{copy('SIZE', '数量')}</span><span>{copy('COST / FEES', '成本 / 费用')}</span><span>{copy('REALIZED P/L', '已实现盈亏')}</span></div>
            {realizedRecords.length ? realizedRecords.map((record) => (
              <div className="kalshi-settlement-row" key={record.key}>
                <span>{record.settledAt ? new Date(record.settledAt).toLocaleString(chinese ? 'zh-CN' : 'en-US') : '--'}</span>
                <b>{record.ticker}</b>
                <span>
                  {record.side || '--'} → {record.exitType === 'sale' ? copy('SOLD', '卖出') : record.result || '--'}
                  {record.exitType === 'sale' && record.exitTrigger ? <small>{exitTriggerLabel(record.exitTrigger, chinese)}</small> : null}
                </span>
                <span><b>{cents(record.entryPrice ?? (Number(record.contracts || 0) > 0 ? Number(record.cost || 0) / Number(record.contracts) : null))}</b> → {cents(record.exitPrice ?? (record.side && record.result ? (record.side === record.result ? 1 : 0) : null))}<small>{record.exitType === 'sale' ? copy('sold', '卖出') : copy('settled', '结算')}</small></span>
                <span>{record.contracts || '--'}</span>
                <span>{money(record.cost)} / {money(record.fees)}</span>
                <strong className={record.pnl > 0 ? 'is-profit' : record.pnl < 0 ? 'is-loss' : ''}>{record.pnl > 0 ? '+' : ''}{money(record.pnl)}</strong>
              </div>
            )) : <div className="kalshi-empty-row">{copy('No realized trades are available yet.', '尚无已实现交易。')}</div>}
          </div>
        </section>
      </>
    );
  };

  const renderDiagnostics = () => {
    const familyKey: 'btc15m' | 'btchourly' = isHourly ? 'btchourly' : 'btc15m';
    const diagnostics = analytics?.analytics?.families?.[familyKey];
    const referenceFeed = analytics?.referenceFeed;
    const funnel = diagnostics?.funnel;
    const funnelSteps: Array<{ key: keyof KalshiFamilyDiagnostics['funnel']; en: string; zh: string }> = [
      { key: 'observations', en: 'Observed', zh: '已观察' },
      { key: 'dataReady', en: 'Fresh data', zh: '数据有效' },
      { key: 'entryWindow', en: 'Entry window', zh: '进场时窗' },
      { key: 'liquidityReady', en: 'Executable book', zh: '盘口可成交' },
      { key: 'positiveNetEdge', en: 'Positive net edge', zh: '扣费后正边际' },
      { key: 'positiveConservativeEdge', en: 'Conservative edge', zh: '保守边际为正' },
      { key: 'routable', en: 'Order candidate', zh: '可下单候选' },
      { key: 'orders', en: 'Order recorded', zh: '已记录订单' },
    ];
    const denominator = Math.max(1, Number(funnel?.observations || 0));
    const blockerLabels: Record<string, [string, string]> = {
      conservative_edge: ['Conservative edge', '保守边际'],
      net_edge: ['Net edge after fees', '扣费后边际'],
      entry_window: ['Entry window', '进场时窗'],
      model_probability: ['Favorite confidence', '优势方向置信度'],
      depth: ['Executable depth', '可成交深度'],
      price_band: ['Contract price band', '合约价格区间'],
      spread: ['Absolute spread', '绝对点差'],
      relative_spread: ['Relative spread', '相对点差'],
      data_freshness: ['Data freshness', '数据新鲜度'],
      reference_ready: ['BRTI reference', 'BRTI 参考价'],
    };
    const blockerName = (key: string) => {
      const label = blockerLabels[key];
      if (label) return copy(label[0], label[1]);
      return key.replace(/_/g, ' ');
    };
    const officialNow = Boolean(decision?.dataQuality?.officialBrti || referenceFeed?.fresh);
    return (
      <section className="kalshi-diagnostics-section">
        <div className="kalshi-section-head">
          <div>
            <span>{copy('24H OPPORTUNITY AUDIT', '24 小时机会审计')}</span>
            <h2>{copy('Why the robot traded — or waited', '机器人为何交易或等待')}</h2>
            <small>{copy('Every server evaluation is stored durably and reduced to an auditable funnel.', '服务端每次评估都会持久保存，并汇总为可审计漏斗。')}</small>
          </div>
          <span className={`kalshi-source-health${officialNow ? ' is-live' : ''}`}>
            <i />
            <b>{officialNow ? copy('OFFICIAL BRTI LIVE', '官方 BRTI 实时') : copy('PROXY FALLBACK', '代理源回退')}</b>
            <small>{referenceFeed?.ageSeconds == null ? '--' : `${Number(referenceFeed.ageSeconds).toFixed(1)}s`}</small>
          </span>
        </div>
        <div className="kalshi-diagnostic-stats">
          <div><span>{copy('OBSERVATIONS', '评估次数')}</span><strong>{diagnostics?.observations?.toLocaleString() || '0'}</strong><small>{copy('durable server samples', '服务端持久样本')}</small></div>
          <div><span>{copy('MARKETS SCANNED', '扫描市场')}</span><strong>{diagnostics?.uniqueMarkets || 0}</strong><small>{isHourly ? copy('hourly strike contracts', '整点执行价合约') : copy('rolling 15-minute contracts', '滚动 15 分钟合约')}</small></div>
          <div><span>{copy('OFFICIAL FEED', '官方行情')}</span><strong>{diagnostics?.officialBrtiSamples || 0}</strong><small>{copy('BRTI-confirmed samples', 'BRTI 确认样本')}</small></div>
          <div><span>{copy('SNAPSHOT LATENCY', '快照延迟')}</span><strong>{diagnostics?.averageSnapshotLatencyMs == null ? '--' : `${Math.round(diagnostics.averageSnapshotLatencyMs)}ms`}</strong><small>{copy('market + reference acquisition', '市场与参考价获取')}</small></div>
        </div>
        <div className="kalshi-diagnostic-grid">
          <article className="kalshi-funnel-panel">
            <div className="kalshi-diagnostic-title"><span>{copy('OPPORTUNITY FUNNEL', '机会漏斗')}</span><small>{copy('Counts are independent gate passes, not a forced trade quota.', '统计为各门控独立通过数，不是强制交易配额。')}</small></div>
            <div className="kalshi-funnel-list">
              {funnelSteps.map((step) => {
                const value = Number(funnel?.[step.key] || 0);
                const width = Math.max(value > 0 ? 2 : 0, Math.min(100, value / denominator * 100));
                return <div key={step.key}><span>{copy(step.en, step.zh)}</span><i><b style={{ width: `${width}%` }} /></i><strong>{value}</strong></div>;
              })}
            </div>
          </article>
          <article className="kalshi-edge-panel">
            <div className="kalshi-diagnostic-title">
              <span>{copy('EDGE TIMELINE', '边际时间线')}</span>
              <small><i className="is-net" />{copy('Net', '净边际')}<i className="is-conservative" />{copy('Conservative', '保守边际')}</small>
            </div>
            <EdgeTimelineChart points={diagnostics?.edgeTimeline || []} emptyLabel={copy('Waiting for durable edge samples.', '正在等待持久化边际样本。')} />
          </article>
          <article className="kalshi-blocker-panel">
            <div className="kalshi-diagnostic-title"><span>{copy('TOP BLOCKERS', '主要阻断原因')}</span><small>{copy('Used to tune gates from evidence.', '用于根据证据校准门槛。')}</small></div>
            <div className="kalshi-blocker-list">
              {(diagnostics?.blockers || []).slice(0, 7).map((item) => <div key={item.key}><span>{blockerName(item.key)}</span><strong>{item.count}</strong></div>)}
              {!diagnostics?.blockers?.length && <p>{copy('No blockers recorded in this window.', '本时间窗尚无阻断记录。')}</p>}
            </div>
          </article>
        </div>
        {!!diagnostics?.nearMisses?.length && <div className="kalshi-near-miss-table">
          <div className="kalshi-near-miss-head"><span>{copy('NEAR-MISS TIME', '接近成交时间')}</span><span>{copy('CONTRACT', '合约')}</span><span>{copy('SIDE / PRICE', '方向 / 价格')}</span><span>{copy('NET / CONS. EDGE', '净 / 保守边际')}</span><span>{copy('REMAINING BLOCKS', '剩余阻断')}</span></div>
          {diagnostics.nearMisses.slice(0, 5).map((item: any, index) => <div className="kalshi-near-miss-row" key={`${item.at}-${item.ticker}-${index}`}>
            <time>{item.at ? new Date(item.at).toLocaleTimeString() : '--'}</time>
            <b>{item.ticker || '--'}</b>
            <span>{item.side || '--'} / {cents(item.price)}</span>
            <span>{probability(item.netEdge)} / {probability(item.conservativeEdge)}</span>
            <small>{(item.blockingReasons || []).map(blockerName).join(' · ') || copy('None', '无')}</small>
          </div>)}
        </div>}
      </section>
    );
  };

  const renderStrategy = () => (
    <section className="kalshi-strategy-section">
      <div className="kalshi-section-head"><div><span>{copy('STRATEGY GOVERNANCE', '策略治理')}</span><h2>{isHourly ? copy('BTC Hourly Monotone Strike Ladder', 'BTC 整点单调执行价阶梯') : (robotState?.strategy?.name || 'BTC15 Settlement-Aligned v6')}</h2></div><strong>{isHourly ? 'v2' : `v${robotState?.strategy?.version || 6}`}</strong></div>
      <div className="kalshi-strategy-grid">
        <article><span>{copy('PHILOSOPHY', '策略理念')}</span><p>{robotState?.strategy?.philosophy || copy('Probability, edge, liquidity, and risk must agree before an order is allowed.', '概率、边际、流动性与风险必须同时通过后才允许下单。')}</p></article>
        <article><span>{copy('MODEL INPUTS', '模型输入')}</span><ul>{(robotState?.strategy?.components || []).map((component) => <li key={component}>{component}</li>)}</ul></article>
        <article><span>{copy('CONSERVATIVE ESTIMATE', '保守估计')}</span><strong>{probability(decision?.edge.conservativeProbability)}</strong><small>{decision?.side || '--'} · {copy('conservative edge', '保守边际')} {probability(decision?.edge.conservativeEdge)}</small></article>
        <article><span>{copy('LATEST CHANGE', '最近改动')}</span><p>{robotState?.strategy?.changes?.[0]?.summary || copy('No parameter changes recorded.', '尚无参数改动。')}</p><small>{robotState?.strategy?.changes?.[0]?.at ? new Date(robotState.strategy.changes[0].at).toLocaleString() : '--'}</small></article>
      </div>
    </section>
  );

  const renderData = () => (<>
    <section className="kalshi-source-grid">
      {[
        [copy('Contract and quotes', '合约与报价'), 'Kalshi Trade API v2', isHourly ? 'KXBTCD' : 'KXBTC15M'],
        [copy('Order book', '订单簿'), 'Kalshi batch orderbooks', copy('One batched request with a sub-second hot cache', '单次批量请求，并使用亚秒级热缓存')],
        [copy('Settlement authority', '结算依据'), 'CF Benchmarks Real-Time Index', copy('60-second average over the final minute before close', '结算前最后一分钟的 60 秒均价')],
        [copy('Live reference', '实时参考价'), 'Official BRTI WebSocket', copy('Authenticated one-second stream; four-venue proxy is failover only', '认证的一秒实时流；四交易所代理仅用于故障回退')],
      ].map(([title, source, detail]) => <div key={title}><DatabaseOutlined /><span>{title}</span><strong>{source}</strong><small>{detail}</small></div>)}
    </section>
    {renderDiagnostics()}
  </>);

  const renderConnection = () => (
    <section className="kalshi-connection-page">
      <div><span>{copy('PUBLIC MARKET DATA', '公开市场数据')}</span><strong className={error ? 'is-error' : 'is-ready'}>{error ? copy('DEGRADED', '异常') : copy('CONNECTED', '已连接')}</strong><small>{snapshot?.asOf ? new Date(snapshot.asOf).toLocaleString() : '--'}</small></div>
      <div>
        <span>{copy('PERSONAL ACCOUNT API', '个人账户 API')}</span>
        <strong className={accountStatus?.personalApiConfigured ? 'is-ready' : ''}>{accountStatus?.personalApiConfigured ? copy('CONFIGURED', '已配置') : copy('NOT CONFIGURED', '未配置')}</strong>
        <small>{accountStatus?.personalApiConfigured
          ? `${copy('Production credentials stored securely for signed account requests and Real orders', '生产凭证已安全保存，可用于签名账户请求和实盘下单')}`
          : copy('Not required for AlphaLab Paper', 'AlphaLab Paper 无需凭证')}</small>
        <button type="button" onClick={() => navigate('/settings/configuration#kalshi', { state: { returnTo: location.pathname } })}>{copy('Manage personal API', '管理个人 API')}</button>
      </div>
      <div><span>{copy('ORDER AUTHORITY', '下单权限')}</span><strong>{accountStatus?.personalApiConfigured ? copy('PAPER + REAL', '模拟 + 实盘') : copy('PAPER ONLY', '仅模拟')}</strong><small>{accountStatus?.personalApiConfigured ? copy('Real mode submits backend-signed IOC limit orders to Kalshi.', '实盘模式会向 Kalshi 提交后端签名的 IOC 限价单。') : copy('Add a production API key before enabling Real mode.', '启用实盘前请先添加生产 API Key。')}</small></div>
    </section>
  );

  const renderHourlyLadder = () => {
    const candidates = (snapshot?.candidateSummary || []).slice().sort(
      (left: any, right: any) => Number(left.strike || 0) - Number(right.strike || 0),
    );
    return (
      <section className="kalshi-hourly-ladder">
        <div className="kalshi-section-head">
          <div>
            <span>{copy('HOURLY STRIKE SCAN', '整点执行价扫描')}</span>
            <h2>{snapshot?.eventTicker || 'KXBTCD'}</h2>
            <small>{copy('Nearby contracts ranked after spread, fee, uncertainty and depth.', '附近合约按点差、手续费、不确定性和深度综合排序。')}</small>
          </div>
          <strong>{snapshot?.candidateCount || candidates.length} {copy('strikes', '个执行价')}</strong>
        </div>
        <div className="kalshi-hourly-grid">
          {candidates.slice(0, 9).map((item: any) => {
            const selected = item.ticker === decision?.market.ticker;
            const blocked = Array.isArray(item.blockingReasons) ? item.blockingReasons.length : 0;
            return (
              <article key={item.ticker} className={selected ? 'is-selected' : ''}>
                <span>{money(item.strike, 0)}</span>
                <strong>{item.side || '--'} · {item.action === 'WAIT' ? copy('WAIT', '等待') : copy('READY', '可执行')}</strong>
                <small>{copy('Net', '净边际')} {probability(item.netEdge)} · {blocked} {copy('blocks', '项阻断')}</small>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  const renderBody = () => {
    if (view === 'rules') return renderRules();
    if (view === 'decisions') return renderDecisionLog();
    if (view === 'risk') return renderRiskControls();
    if (view === 'positions' || view === 'orders') return renderPortfolio();
    if (view === 'data') return renderData();
    if (view === 'connection') return renderConnection();
    if (view === 'bot') return <>{isHourly && renderHourlyLadder()}{renderStrategy()}{renderDecision()}{renderDiagnostics()}{renderGates()}</>;
    return <>{renderMetrics()}{isHourly && renderHourlyLadder()}{renderDecision()}{renderDiagnostics()}{renderGates()}{renderBook()}</>;
  };

  const pageMeta: Record<KalshiView, { eyebrow: string; title: string; description: string }> = {
    desk: { eyebrow: copy('KALSHI / LIVE MARKET', 'KALSHI / 实时市场'), title: copy('BTC 15-minute contract desk', 'BTC 15 分钟合约工作台'), description: copy('Live contract, executable order book, reference price and model evidence.', '实时合约、可成交订单簿、参考价格与模型证据。') },
    rules: { eyebrow: copy('KALSHI / METHODOLOGY', 'KALSHI / 结算方法'), title: copy('Contract rules and settlement', '合约规则与结算'), description: copy('The exact market question, BRTI settlement authority and model boundary.', '准确的市场问题、BRTI 结算依据与模型边界。') },
    bot: { eyebrow: copy('KALSHI / AUTOMATION', 'KALSHI / 自动化'), title: copy('BTC 15-minute robot monitor', 'BTC 15 分钟机器人监控'), description: copy('Current decision, position management, sizing and deterministic trade gates.', '当前决策、仓位管理、仓位大小与确定性交易门控。') },
    decisions: { eyebrow: copy('KALSHI / AUDIT', 'KALSHI / 审计'), title: copy('Decision audit log', '决策审计记录'), description: copy('The latest model decision, evidence, gate result and execution outcome.', '最近一次模型决策、证据、门控结果与执行结果。') },
    risk: { eyebrow: copy('KALSHI / GOVERNANCE', 'KALSHI / 策略治理'), title: copy('Strategy and risk controls', '策略与风控'), description: copy('Manage deterministic entry, add-on, exit and exposure limits.', '管理确定性的开仓、加仓、平仓与敞口限制。') },
    positions: { eyebrow: copy('KALSHI / PORTFOLIO', 'KALSHI / 组合'), title: copy('Portfolio overview', '投资组合总览'), description: copy('Account equity, open exposure, marked P/L and realized outcomes.', '账户权益、当前敞口、盯市盈亏与已实现结果。') },
    orders: { eyebrow: copy('KALSHI / EXECUTION', 'KALSHI / 执行'), title: copy('Order execution ledger', '订单执行流水'), description: copy('IOC requests, fills, executable prices, slippage, fees and rejects.', 'IOC 请求、成交、可成交价格、滑点、费用与拒单。') },
    data: { eyebrow: copy('KALSHI / DATA', 'KALSHI / 数据'), title: copy('Market data sources', '市场数据源'), description: copy('Contract, order-book, settlement and independent spot provenance.', '合约、订单簿、结算与独立现货的数据来源。') },
    connection: { eyebrow: copy('KALSHI / CONNECTION', 'KALSHI / 连接'), title: copy('Account connection', '账户连接'), description: copy('Public market data status and personal trading authorization.', '公开市场数据状态与个人交易授权。') },
  };
  const currentPage = isHourly && (view === 'desk' || view === 'bot')
    ? {
      eyebrow: copy('KALSHI / BTC HOURLY', 'KALSHI / BTC 整点市场'),
      title: view === 'bot' ? copy('BTC hourly strike robot', 'BTC 整点执行价机器人') : copy('BTC hourly strike ladder', 'BTC 整点执行价阶梯'),
      description: copy(
        'Scans the active hourly event across nearby strikes and routes only the strongest fee-adjusted favorite.',
        '扫描当前整点事件附近的执行价，只执行扣费后价值最高的优势方向。',
      ),
    }
    : pageMeta[view];
  const showRobotActions = view === 'desk' || view === 'bot';
  const showPortfolioRefresh = view === 'positions' || view === 'orders';
  const showSafetyBanner = view === 'bot' || view === 'risk';
  const showDecisionLoading = view === 'desk' || view === 'bot' || view === 'rules' || view === 'decisions';

  return (
    <div className="kalshi-page">
      <header className="kalshi-command-header">
        <div>
          <span>{currentPage.eyebrow}</span>
          <h1>{currentPage.title}</h1>
          <p>{currentPage.description}</p>
        </div>
        {showRobotActions && <div className="kalshi-command-actions">
          <div className={`kalshi-monitor-state${robotState?.enabled ? ' is-on' : ''}`}><i /><span>{robotState?.enabled ? copy('ROBOT ON', '机器人运行中') : copy('ROBOT OFF', '机器人已关闭')}</span><small>{kalshiModeLabel} · {copy('5-second server cycle', '服务端每 5 秒运行')}</small></div>
          <button type="button" className="is-secondary" onClick={() => void evaluate()} disabled={refreshing}><ReloadOutlined className={refreshing ? 'is-spinning' : ''} />{copy('Refresh', '刷新')}</button>
          <button type="button" className={robotState?.enabled ? 'is-stop' : 'is-start'} onClick={() => void toggleRobot()} disabled={robotBusy}>{robotState?.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}{robotState?.enabled ? copy('Stop robot', '停止机器人') : copy('Start robot', '启动机器人')}</button>
        </div>}
        {showPortfolioRefresh && <div className="kalshi-command-actions">
          {view === 'positions' && <button type="button" className="is-secondary" data-testid="reset-portfolio-display" onClick={() => void resetPortfolioDisplay()} disabled={portfolioResetting || portfolioLoading}><DatabaseOutlined />{portfolioResetting ? copy('Resetting…', '重置中…') : copy('Reset visible period', '重置显示周期')}</button>}
          <button type="button" className="is-secondary" onClick={() => void loadPaperPortfolio()} disabled={portfolioLoading || portfolioResetting}><ReloadOutlined className={portfolioLoading ? 'is-spinning' : ''} />{portfolioLoading ? copy('Refreshing…', '刷新中…') : copy('Refresh account', '刷新账户')}</button>
        </div>}
      </header>
      <section className="kalshi-context-rail" aria-label={copy('Kalshi workspace status', 'Kalshi 工作区状态')}>
        <div><span>{copy('ENVIRONMENT', '运行环境')}</span><strong className={isRealMode ? 'is-real' : ''}>{kalshiModeLabel}</strong></div>
        <div><span>{copy('ACTIVE CONTRACT', '当前合约')}</span><strong>{decision?.market.ticker || 'KXBTC15M'}</strong></div>
        <div><span>{copy('TIME TO CLOSE', '距离关闭')}</span><strong>{countdown}</strong></div>
        <div><span>{copy('ENGINE', '策略引擎')}</span><strong>{isHourly ? copy('LADDER v2', '阶梯 v2') : copy('SETTLEMENT v6', '结算对齐 v6')}</strong></div>
        <div><span>{copy('AUTOMATION', '自动交易')}</span><strong className={robotState?.enabled ? 'is-on' : ''}>{robotState?.enabled ? copy('RUNNING', '运行中') : copy('STOPPED', '已停止')}</strong></div>
        <div><span>{copy('ACCOUNT SOURCE', '账户数据源')}</span><strong>{isRealMode ? 'KALSHI API' : 'ALPHALAB'}</strong></div>
      </section>

      {showSafetyBanner && <div className={`kalshi-safety-banner${isRealMode ? ' is-real' : ''}`}><SafetyCertificateOutlined /><span><b>{isRealMode ? copy('Kalshi Real mode.', 'Kalshi 实盘模式。') : copy('AlphaLab Paper mode.', 'AlphaLab 内置模拟盘。')}</b>{isRealMode ? copy(' Public market data is still used for evidence; orders are signed on the backend with your saved Kalshi API key and sent to your real Kalshi account.', ' 行情证据仍使用公开数据；订单会在后端用你保存的 Kalshi API Key 签名，并发送到你的真实 Kalshi 账户。') : copy(' Fills use production Kalshi public executable quotes and the official taker-fee schedule, but no order is sent to Kalshi and profitability is not guaranteed.', ' 成交使用 Kalshi 正式公开可成交报价和官方 taker 手续费规则，但不会向 Kalshi 发送订单，也不保证盈利。')}</span></div>}
      {showDecisionLoading && loading && !decision && <div className="kalshi-loading"><ClockCircleOutlined /><span>{copy('Loading Kalshi contract and BTC reference data...', '正在加载 Kalshi 合约与 BTC 参考数据……')}</span></div>}
      {error && <div className="kalshi-error" role="alert"><CloseCircleOutlined /><span><b>{copy('Data refresh failed', '数据刷新失败')}</b>{error}</span><button type="button" onClick={() => void evaluate()}>{copy('Retry', '重试')}</button></div>}
      {!loading && renderBody()}
    </div>
  );
};

export default Kalshi;
