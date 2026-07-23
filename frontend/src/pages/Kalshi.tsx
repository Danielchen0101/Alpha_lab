import React from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
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
  KalshiGate,
  KalshiSnapshot,
  KalshiStrategyLibraryItem,
} from '../services/kalshiApi';
import '../styles/Kalshi.css';

const MARKET_REFRESH_MS = 5_000;
const PORTFOLIO_REFRESH_MS = 10_000;

type StrategyPreset = {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  recommended?: boolean;
  config: Partial<KalshiBotConfig>;
};

export const buildPresetConfig = (preset: StrategyPreset, paperBankroll: number, executionMode: KalshiBotConfig['executionMode'] = 'paper'): KalshiBotConfig => ({
  ...DEFAULT_KALSHI_BOT_CONFIG,
  executionMode,
  paperBankroll,
  ...preset.config,
  learningAiMode: preset.config.learningMode ? preset.config.learningAiMode !== false : false,
});

// All presets are variations of the v3 Favorite Carry strategy: buy only the
// model-confirmed favorite side (50-93c) in the final minutes and hold to
// settlement. Backtested win rate ~86-92% (53,936 real windows, 18.5 months).
export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: 'fortress',
    name: 'Fortress · Highest Win Rate',
    nameZh: '堡垒 · 最高胜率',
    description: 'Only very strong favorites (75%+ model confidence) with strict edge and book gates. Fewest trades, highest expected hit rate.',
    descriptionZh: '只买模型置信度 75% 以上的强势方，边际与盘口门槛最严。交易最少，预期胜率最高。',
    config: { riskPerTradePct: 0.40, minModelProbability: 0.75, minNetEdge: 0.02, minConservativeEdge: 0.01, maxSpread: 0.04, minDepthContracts: 20, maxBookParticipation: 0.10, maxPortfolioExposurePct: 12, minPrice: 0.60, maxPrice: 0.93, minSecondsToClose: 100, maxSecondsToClose: 280, executionPriceTolerance: 0.005, fractionalKelly: 0.15, learningMode: false },
  },
  {
    id: 'favorite-carry',
    name: 'Favorite Carry · Calibrated Baseline',
    nameZh: '优势侧携带 · 校准基准',
    description: 'The backtested v3 baseline: calibrated favorite entries in the last 100-320 seconds, hold to settlement.',
    descriptionZh: '回测校准的 v3 基准：最后 100-320 秒进场买优势侧，持有到结算。',
    recommended: true,
    config: { learningMode: false },
  },
  {
    id: 'adaptive-learning',
    name: 'AI Learning · 24/7 Recommended',
    nameZh: '推荐 · AI 自适应 24 小时',
    description: 'Favorite Carry baseline plus bounded exploration and evidence-gated AI parameter reviews. Best for continuous unattended trading.',
    descriptionZh: '在校准基准上叠加受控探索与证据门槛的 AI 参数复核，最适合 24 小时无人值守运行。',
    recommended: true,
    config: { learningMode: true, learningAiMode: true, learningExplorationRate: 0.15, learningReviewEvery: 6, learningWindowSize: 40, learningMaxRiskPct: 1.0 },
  },
  {
    id: 'active-sampling',
    name: 'Active Sampling · More Trades',
    nameZh: '积极采样 · 更多交易',
    description: 'Looser edge gates and a wider entry window for more fills per day; win rate stays structurally high via the favorite gate.',
    descriptionZh: '放宽边际门槛并拉宽进场窗口以增加成交；优势侧门槛仍保证结构性高胜率。',
    config: { riskPerTradePct: 0.60, minModelProbability: 0.58, minNetEdge: 0.008, minConservativeEdge: 0.0, maxSpread: 0.07, minDepthContracts: 8, maxBookParticipation: 0.25, minSecondsToClose: 90, maxSecondsToClose: 360, executionPriceTolerance: 0.015, learningMode: true, learningAiMode: true, learningExplorationRate: 0.25, learningReviewEvery: 6, learningWindowSize: 40 },
  },
];

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
  const [robotState, setRobotState] = React.useState<KalshiPaperRobotState | null>(null);
  const [robotBusy, setRobotBusy] = React.useState(false);
  const [applyBusy, setApplyBusy] = React.useState(false);
  const [strategyBusy, setStrategyBusy] = React.useState(false);
  const [strategyLibrary, setStrategyLibrary] = React.useState<KalshiStrategyLibraryItem[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = React.useState('');
  const [applyMessage, setApplyMessage] = React.useState('');
  const [clock, setClock] = React.useState(Date.now());
  const inFlightRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const syncedServerConfigRef = React.useRef('');
  const modeRef = React.useRef<KalshiBotConfig['executionMode']>(config.executionMode === 'real' ? 'real' : 'paper');
  const portfolioRequestRef = React.useRef(0);
  const evaluationRequestRef = React.useRef(0);
  const executionMode: KalshiBotConfig['executionMode'] = config.executionMode === 'real' ? 'real' : 'paper';
  const isRealMode = executionMode === 'real';
  const storedPreTradeAi = robotState?.strategy?.preTradeAi;
  const preTradeAi = decision?.aiReview?.status === 'reviewed'
    ? decision.aiReview
    : (!storedPreTradeAi?.ticker || storedPreTradeAi.ticker === decision?.market.ticker)
      ? storedPreTradeAi
      : undefined;

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
      const response = await kalshiAPI.evaluate(config);
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
  }, [acceptPayload, config, copy, executionMode]);

  React.useEffect(() => {
    mountedRef.current = true;
    void evaluate();
    return () => { mountedRef.current = false; };
  // Initial request is intentionally once; config changes are applied explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStrategies = React.useCallback(async (modeOverride: KalshiBotConfig['executionMode'] = modeRef.current) => {
    try {
      const response = await kalshiAPI.strategies(modeOverride);
      if (!mountedRef.current || modeRef.current !== modeOverride) return;
      const rows = response.data?.strategies || [];
      setStrategyLibrary(rows);
      const active = rows.find((row) => row.active && row.mode === modeOverride) || rows.find((row) => row.mode === modeOverride);
      setSelectedStrategyId((current) => (
        current && rows.some((row) => row.id === current && row.mode === modeOverride)
          ? current
          : active?.id || ''
      ));
    } catch {
      if (mountedRef.current) setStrategyLibrary([]);
    }
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
      setRefreshing(true);
      inFlightRef.current = false;
      const evaluationRequestId = evaluationRequestRef.current + 1;
      evaluationRequestRef.current = evaluationRequestId;
      void Promise.all([
        loadPaperPortfolio(nextMode),
        loadStrategies(nextMode),
        kalshiAPI.evaluate(nextConfig).then((response) => {
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
  }, [acceptPayload, copy, loadPaperPortfolio, loadStrategies]);

  React.useEffect(() => {
    const mode = executionMode;
    kalshiAPI.paperRobotStatus(mode)
      .then((response) => {
        if (!mountedRef.current || modeRef.current !== mode) return;
        if (response.data?.state && (response.data.state.config?.executionMode === mode)) setRobotState(response.data.state);
      })
      .catch(() => undefined);
    void loadPaperPortfolio(mode);
    void loadStrategies(mode);
  }, [executionMode, loadPaperPortfolio, loadStrategies]);

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
    const timer = window.setInterval(() => void loadPaperPortfolio(), PORTFOLIO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadPaperPortfolio]);

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

  const applyConfig = async (nextConfig: KalshiBotConfig = config, presetName = '') => {
    if (applyBusy) return;
    setApplyBusy(true);
    setApplyMessage('');
    setConfig(nextConfig);
    writeStoredConfig(nextConfig);
    try {
      const saved = await kalshiAPI.savePaperRobotConfig(nextConfig, nextConfig.executionMode);
      if (saved.data?.state) setRobotState(saved.data.state);
      const response = await kalshiAPI.evaluate(nextConfig);
      if (!response.data?.success) throw new Error(response.data?.message || 'Kalshi evaluation failed');
      acceptPayload(response.data, nextConfig.executionMode === 'real' ? 'real' : 'paper');
      setApplyMessage(presetName
        ? copy(`${presetName} applied and evaluated.`, `已应用并评估：${presetName}。`)
        : copy('Saved and evaluated with the new limits.', '已保存，并使用新限制完成评估。'));
      await loadPaperPortfolio(nextConfig.executionMode === 'real' ? 'real' : 'paper');
      await loadStrategies(nextConfig.executionMode === 'real' ? 'real' : 'paper');
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

  const applyPreset = (preset: StrategyPreset) => {
    const nextConfig = buildPresetConfig(preset, config.paperBankroll, executionMode);
    void applyConfig(nextConfig, chinese ? preset.nameZh : preset.name);
  };

  const saveCurrentStrategy = async () => {
    if (strategyBusy) return;
    setStrategyBusy(true);
    setApplyMessage('');
    try {
      const name = `${isRealMode ? 'Kalshi Real' : 'AlphaLab Paper'} Strategy ${new Date().toLocaleString()}`;
      const response = await kalshiAPI.saveStrategy(name, config, executionMode);
      const rows = response.data?.strategies || [];
      setStrategyLibrary(rows);
      setSelectedStrategyId(response.data?.strategy?.id || rows.find((row) => row.active)?.id || '');
      setApplyMessage(copy('Strategy saved to the selected mode library.', '策略已保存到当前模式策略库。'));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || copy('Strategy could not be saved.', '策略无法保存。'));
    } finally {
      setStrategyBusy(false);
    }
  };

  const applySavedStrategy = async (strategyId = selectedStrategyId) => {
    if (strategyBusy || !strategyId) return;
    setStrategyBusy(true);
    setApplyMessage('');
    try {
      const response = await kalshiAPI.applyStrategy(strategyId, executionMode);
      const nextConfig = {
        ...config,
        ...(response.data?.state?.config || {}),
      } as KalshiBotConfig;
      const nextMode = nextConfig.executionMode === 'real' ? 'real' : 'paper';
      modeRef.current = nextMode;
      setConfig(nextConfig);
      writeStoredConfig(nextConfig);
      if (response.data?.state) setRobotState(response.data.state);
      await loadStrategies(nextMode);
      await loadPaperPortfolio(nextMode);
      const evaluation = await kalshiAPI.evaluate(nextConfig);
      if (evaluation.data?.success) acceptPayload(evaluation.data, nextMode);
      setApplyMessage(copy('Strategy applied to the robot.', '策略已应用到机器人。'));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || copy('Strategy could not be applied.', '策略无法应用。'));
    } finally {
      setStrategyBusy(false);
    }
  };

  const recommendStrategy = async () => {
    if (strategyBusy) return;
    setStrategyBusy(true);
    setApplyMessage('');
    try {
      const response = await kalshiAPI.recommendStrategy(executionMode);
      const rows = response.data?.strategies || [];
      setStrategyLibrary(rows);
      if (response.data?.recommendedStrategyId) setSelectedStrategyId(response.data.recommendedStrategyId);
      setApplyMessage(response.data?.reason || copy('AI-ranked strategy recommendation is ready.', '策略推荐已生成。'));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || copy('Strategy recommendation failed.', '策略推荐失败。'));
    } finally {
      setStrategyBusy(false);
    }
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
  const kalshiModeLabel = isRealMode ? copy('KALSHI REAL', 'KALSHI 实盘') : copy('ALPHALAB PAPER', 'ALPHALAB 模拟盘');

  const renderMetrics = () => (
    <section className="kalshi-metric-strip" aria-label={copy('Contract snapshot', '合约快照')}>
      <div><span>{copy('CONTRACT', '合约')}</span><strong>{decision?.market.ticker || 'KXBTC15M'}</strong><small>{active ? copy('Trading now', '正在交易') : copy('Next available interval', '下一个可用时段')}</small></div>
      <div><span>{copy('TIME LEFT', '剩余时间')}</span><strong>{countdown}</strong><small>{copy('Entry closes before settlement', '进场早于结算')}</small></div>
      <div><span>{copy('STRIKE', '结算基准')}</span><strong>{money(decision?.market.strike)}</strong><small>{copy('Reference at window open', '开盘参考价')}</small></div>
      <div><span>{copy('BTC REFERENCE', 'BTC 参考价')}</span><strong>{money(decision?.model.spot)}</strong><small>Coinbase BTC-USD</small></div>
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
          <RobotOutlined />
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
        <div className={`kalshi-pretrade-ai is-${preTradeAi?.verdict || preTradeAi?.status || 'waiting'}`}>
          <div>
            <RobotOutlined />
            <span><b>{copy('AI entry challenger', 'AI 进场质检')}</b><small>{copy('New entries only · downgrade authority', '仅审核新开仓 · 只有降级权限')}</small></span>
            <strong>{preTradeAi?.status === 'reviewed'
              ? (preTradeAi.verdict === 'challenge' ? copy('CHALLENGE', '要求等待') : copy('CLEAR', '未发现矛盾'))
              : preTradeAi?.status === 'not_configured'
                ? copy('NOT CONFIGURED', '未配置')
                : copy('WAITING', '等待候选')}</strong>
          </div>
          <p>{preTradeAi?.summary || copy('Runs only after every deterministic entry gate passes. It cannot create a trade or change price, side, size, exits, or hard limits.', '仅在确定性进场门控全部通过后运行；不能发起交易，也不能修改价格、方向、仓位、退出或硬限制。')}</p>
          {preTradeAi?.status === 'reviewed' && <small>{[preTradeAi.provider, preTradeAi.model, preTradeAi.confidence == null ? '' : `${Math.round(preTradeAi.confidence * 100)}%`, preTradeAi.cached ? copy('cached', '缓存') : ''].filter(Boolean).join(' · ')}</small>}
        </div>
      </aside>
    </section>
  );

  const renderGates = () => (
    <section className="kalshi-gates-section">
      <div className="kalshi-section-head">
        <div><span>03 / {copy('TRADE GATES', '交易门控')}</span><h2>{copy('Every condition must pass', '所有条件必须通过')}</h2></div>
        <strong>{decision ? `${decision.gates.length - blockedGateCount}/${decision.gates.length}` : '--'} {copy('clear', '通过')}</strong>
      </div>
      <div className="kalshi-gate-list">
        {(decision?.gates || []).map((gate: KalshiGate) => (
          <div key={gate.key} className={`kalshi-gate is-${gate.status}`}>
            {gate.status === 'pass' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            <span><em>{String(gate.category || 'signal').toUpperCase()}</em><b>{chinese ? gate.labelZh : gate.label}</b><small>{gate.detail}</small></span>
            <strong>{gate.status === 'pass' ? copy('PASS', '通过') : copy('BLOCK', '阻断')}</strong>
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
    const learning = robotState?.strategy?.learning;
    const parameterLabels: Record<string, [string, string]> = {
      riskPerTradePct: ['Risk per interval', '每时段风险'],
      minNetEdge: ['Minimum net edge', '最低净边际'],
      minConservativeEdge: ['Conservative edge', '最低保守边际'],
      minModelProbability: ['Favorite confidence floor', '优势侧置信下限'],
      minPrice: ['Price band floor', '价格区间下限'],
      maxPrice: ['Price band ceiling', '价格区间上限'],
      marketBlendWeight: ['Market blend weight', '市场价格权重'],
      probabilityLogitScale: ['Probability confidence', '概率置信强度'],
      momentumProjectionScale: ['Momentum weight', '动量权重'],
      basisReserveBps: ['Reference basis reserve', '基准价差缓冲'],
      executionPriceTolerance: ['Execution tolerance', '成交容差'],
      learningExplorationRate: ['Exploration budget', '探索预算'],
      learningContrarianMode: ['Direction mode', '方向模式'],
      maxSpread: ['Maximum spread', '最大点差'],
      maxBookParticipation: ['Book participation', '盘口参与率'],
      minDepthContracts: ['Minimum depth', '最低深度'],
      maxPortfolioExposurePct: ['Portfolio exposure', '组合敞口'],
    };
    const percentParameters = new Set([
      'riskPerTradePct', 'minNetEdge', 'minConservativeEdge', 'minModelProbability',
      'minPrice', 'maxPrice', 'marketBlendWeight',
      'momentumProjectionScale', 'executionPriceTolerance', 'learningExplorationRate',
      'maxSpread', 'maxBookParticipation', 'maxPortfolioExposurePct',
    ]);
    const parameterLabel = (key: string) => {
      const labels = parameterLabels[key] || [key, key];
      return chinese ? labels[1] : labels[0];
    };
    const adjustmentValue = (key: string, value: any) => {
      if (typeof value === 'boolean') return value ? copy('CONTRARIAN', '反向') : copy('NORMAL', '正常');
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return String(value ?? '--');
      if (key === 'basisReserveBps') return `${numeric.toFixed(1)} bps`;
      if (key === 'minDepthContracts') return Math.round(numeric).toLocaleString();
      if (percentParameters.has(key)) return `${(numeric * (key.endsWith('Pct') ? 1 : 100)).toFixed(2)}${key === 'executionPriceTolerance' || key === 'maxSpread' ? 'c' : '%'}`;
      return numeric.toFixed(3);
    };
    const learningChanges: any[] = (robotState?.strategy?.changes || [])
      .filter((change) => {
        const source = String(change?.source || '');
        return source.startsWith('adaptive_') || source.startsWith('settings_ai_') || source.startsWith('evidence_recovery_');
      })
      .slice(0, 10)
      .map((change) => {
        const applied = change?.applied && Object.keys(change.applied).length
          ? change.applied
          : Object.fromEntries(Object.keys(change?.after || {}).filter((key) => change?.before?.[key] !== change?.after?.[key]).map((key) => [
            key,
            { before: change?.before?.[key], after: change?.after?.[key], reason: change?.summary },
          ]));
        return { ...change, applied };
      });
    const auditedAdjustmentCount = Math.max(
      Number(learning?.adjustmentCount || 0),
      (robotState?.strategy?.changes || []).filter((change) => {
        const source = String(change?.source || '');
        return source.startsWith('adaptive_') || source.startsWith('settings_ai_') || source.startsWith('evidence_recovery_');
      }).length,
    );
    const modeEquity = paperPortfolio
      ? (
        isRealMode
          ? Number(paperPortfolio.balance?.portfolio_value ?? paperPortfolio.balance?.balance ?? 0)
          : Number(paperPortfolio.balance?.balance || 0) + Number(paperPortfolio.balance?.portfolio_value || 0)
      ) / 100
      : Number(config.paperBankroll || 0);
    const modeLabel = isRealMode ? copy('Kalshi Real', 'Kalshi 实盘') : copy('AlphaLab Paper', 'AlphaLab 模拟');
    const learningStatus = !config.learningMode
      ? copy('OFF', '未开启')
      : learning?.status === 'paper_only'
        ? copy('MODE-SCOPED EVIDENCE', '按当前模式收集')
        : learning?.status === 'reviewed'
          ? copy('REVIEWED', '已完成复盘')
          : copy('COLLECTING EVIDENCE', '正在收集证据');
    return <section className="kalshi-controls-section">
      <div className="kalshi-section-head">
        <div><span>{isRealMode ? copy('REAL RISK POLICY', '实盘风控策略') : copy('PAPER RISK POLICY', '模拟风控策略')}</span><h2>{copy('BTC 15-minute limits', 'BTC 15 分钟限制')}</h2></div>
        <div className="kalshi-apply-action">
          {applyMessage && <small>{applyMessage}</small>}
          <button type="button" onClick={() => void applyConfig()} disabled={applyBusy}><ThunderboltOutlined className={applyBusy ? 'is-spinning' : ''} />{applyBusy ? copy('Applying…', '正在应用…') : copy('Apply and evaluate', '应用并评估')}</button>
        </div>
      </div>
      <div className="kalshi-presets" aria-label={copy('Strategy presets', '策略预设')}>
        <div className="kalshi-presets-intro">
          <span>{copy('ONE-CLICK PRESETS · FAVORITE CARRY v3', '一键策略预设 · 优势侧携带 v3')}</span>
          <h3>{copy('Pick selectivity vs. trade count', '在胜率强度与交易数量之间选择')}</h3>
          <p>{copy('Every preset buys only the model-confirmed favorite side in the final minutes and holds to settlement — the structure behind the 86-92% backtested win rate. Applying replaces the full parameter set and re-evaluates immediately.', '所有预设都只在最后几分钟买入模型确认的优势侧并持有到结算——这正是回测 86-92% 胜率的结构来源。应用后会替换整套参数并立即重新评估。')}</p>
        </div>
        <div className="kalshi-preset-grid">
          {STRATEGY_PRESETS.map((preset) => {
            const merged = { ...DEFAULT_KALSHI_BOT_CONFIG, ...preset.config };
            return (
            <article key={preset.id} className={preset.id === 'adaptive-learning' ? 'is-learning' : ''}>
              <div><span>{preset.recommended ? copy('RECOMMENDED', '推荐') : copy('PRESET', '预设')}</span><h4>{chinese ? preset.nameZh : preset.name}</h4><p>{chinese ? preset.descriptionZh : preset.description}</p></div>
              <dl>
                <div><dt>{copy('Risk', '单次风险')}</dt><dd>{merged.riskPerTradePct}%</dd></div>
                <div><dt>{copy('Confidence', '置信下限')}</dt><dd>{Math.round(merged.minModelProbability * 100)}%</dd></div>
                <div><dt>{copy('Edge', '净边际')}</dt><dd>{(merged.minNetEdge * 100).toFixed(1)}%</dd></div>
              </dl>
              <details className="kalshi-preset-details">
                <summary>{copy('View all parameters', '查看完整参数')}</summary>
                <div>
                  <span>{copy('Price band', '价格区间')}<b>{Math.round(merged.minPrice * 100)}-{Math.round(merged.maxPrice * 100)}c</b></span>
                  <span>{copy('Entry window', '进场窗口')}<b>{merged.minSecondsToClose}-{merged.maxSecondsToClose}s</b></span>
                  <span>{copy('Spread', '最大点差')}<b>{(merged.maxSpread * 100).toFixed(0)}c</b></span>
                  <span>{copy('Depth', '最低深度')}<b>{merged.minDepthContracts}</b></span>
                  <span>{copy('Participation', '参与率')}<b>{Math.round(merged.maxBookParticipation * 100)}%</b></span>
                  <span>{copy('IOC tolerance', '成交容差')}<b>{(merged.executionPriceTolerance * 100).toFixed(1)}c</b></span>
                  <span>{copy('Exposure', '敞口上限')}<b>{merged.maxPortfolioExposurePct}%</b></span>
                  <span>{copy('Kelly fraction', '凯利比例')}<b>{Math.round(merged.fractionalKelly * 100)}%</b></span>
                  {merged.learningMode && <span>{copy('Review every', '复盘间隔')}<b>{merged.learningReviewEvery}</b></span>}
                </div>
              </details>
              <button type="button" disabled={applyBusy} onClick={() => applyPreset(preset)}>{merged.learningMode ? <RobotOutlined /> : <ThunderboltOutlined />}{copy('Apply preset', '直接应用')}</button>
            </article>
            );
          })}
        </div>
      </div>
      <div className="kalshi-strategy-library">
        <div className="kalshi-library-head">
          <div>
            <span>{copy('MODE-SCOPED STRATEGY LIBRARY', '按模式隔离的策略库')}</span>
            <h3>{isRealMode ? copy('Real strategies', '实盘策略') : copy('Paper strategies', '模拟盘策略')}</h3>
            <p>{copy('Paper and Real share one library view, but each strategy keeps separate bankroll, fills, learning evidence, and risk parameters.', 'Paper 和 Real 显示在同一个策略库里，但资金、成交、学习证据和风控参数彼此独立。')}</p>
          </div>
          <div className="kalshi-library-actions">
            <select value={selectedStrategyId} onChange={(event) => setSelectedStrategyId(event.target.value)} disabled={strategyBusy}>
              {strategyLibrary.filter((item) => item.mode === executionMode).map((item) => (
                <option key={item.id} value={item.id}>{item.active ? '● ' : ''}{item.name}</option>
              ))}
            </select>
            <button type="button" className="is-secondary" onClick={() => void recommendStrategy()} disabled={strategyBusy}>{copy('AI recommend', 'AI 推荐')}</button>
            <button type="button" className="is-secondary" onClick={() => void saveCurrentStrategy()} disabled={strategyBusy}>{copy('Save current', '保存当前')}</button>
            <button type="button" onClick={() => void applySavedStrategy()} disabled={strategyBusy || !selectedStrategyId}><ThunderboltOutlined />{copy('Apply strategy', '应用策略')}</button>
          </div>
        </div>
        <div className="kalshi-library-grid">
          {strategyLibrary.filter((item) => item.mode === executionMode).map((item) => {
            const metrics = item.metrics || {};
            return (
              <article key={item.id} className={`kalshi-library-card${item.active ? ' is-active' : ''}`}>
                <header>
                  <div><span>{item.mode === 'real' ? copy('REAL STRATEGY', '实盘策略') : copy('PAPER STRATEGY', '模拟策略')}</span><h4>{item.name}</h4></div>
                  {item.active && <b>{copy('ACTIVE', '运行中')}</b>}
                </header>
                <dl>
                  <div><dt>{copy('Win rate', '胜率')}</dt><dd>{metrics.winRate == null ? '--' : probability(metrics.winRate)}</dd></div>
                  <div><dt>{copy('Realized', '已实现')}</dt><dd>{metrics.realizedSamples || metrics.settledSamples || 0}</dd></div>
                  <div><dt>{copy('Net P/L', '净盈亏')}</dt><dd>{money(metrics.totalPnl || 0)}</dd></div>
                  <div><dt>{copy('Avg / trade', '单笔平均')}</dt><dd>{money(metrics.averagePnl || 0)}</dd></div>
                  <div><dt>{copy('Brier', 'Brier')}</dt><dd>{metrics.brierScore == null ? '--' : Number(metrics.brierScore).toFixed(3)}</dd></div>
                  <div><dt>{copy('AI / learning', 'AI / 学习')}</dt><dd>{metrics.adjustmentCount || 0}</dd></div>
                </dl>
                <p>{copy('Risk', '风险')} {item.config?.riskPerTradePct ?? '--'}% · {copy('Edge', '边际')} {Number(item.config?.minNetEdge || 0) * 100}% · {copy('Direction', '方向')} {metrics.activeDirection || 'normal'}</p>
                <button type="button" disabled={strategyBusy || item.active} onClick={() => void applySavedStrategy(item.id)}>{item.active ? copy('Applied', '已应用') : copy('Apply this strategy', '应用这个策略')}</button>
              </article>
            );
          })}
          {!strategyLibrary.filter((item) => item.mode === executionMode).length && (
            <div className="kalshi-library-empty">{copy('No saved strategy yet. Save the current limits to create Strategy 1.', '当前模式还没有已保存策略。保存当前参数即可创建策略 1。')}</div>
          )}
        </div>
      </div>
      <div className={`kalshi-learning-panel${config.learningMode ? ' is-enabled' : ''}`}>
        <div className="kalshi-learning-head">
          <div><RobotOutlined /><span><b>{isRealMode ? copy('Adaptive Real Learning', '实盘自适应学习') : copy('Adaptive Paper Learning', '模拟盘自适应学习')}</b><small>{copy('P/L learning uses every realized exit; probability calibration uses final settlements only', '盈亏学习使用每笔已实现退出；概率校准只使用最终结算')}</small></span></div>
          <label className="kalshi-learning-switch"><input type="checkbox" checked={config.learningMode} onChange={(event) => setConfig((current) => ({ ...current, learningMode: event.target.checked }))} /><span>{config.learningMode ? copy('ON', '已开启') : copy('OFF', '关闭')}</span></label>
        </div>
        <div className="kalshi-learning-status">
          <div><span>{copy('STATUS', '状态')}</span><strong>{learningStatus}</strong><small>{learning?.lastReason || copy('Enable learning or apply the Learning Lab preset.', '开启学习，或应用“自适应学习实验室”预设。')}</small></div>
          <div><span>{copy('REALIZED PROGRESS', '已实现样本进度')}</span><strong>{robotState?.strategy?.realizedSamples || robotState?.strategy?.settledSamples || 0} / {learning?.nextReviewSample ?? 12}</strong><small>{copy('next deterministic P/L review', '达到右侧数量后进行确定性盈亏复盘')}</small></div>
          <div><span>{copy('RECENT WIN RATE', '近期胜率')}</span><strong>{learning?.recentWinRate == null ? '--' : probability(learning.recentWinRate)}</strong><small>{Math.min(Number(robotState?.strategy?.realizedSamples || 0), Number(learning?.windowSize || 24))} {copy('realized exits in the active window', '笔已实现退出（当前窗口）')}</small></div>
          <div><span>{copy('RECENT NET P/L', '近期平均净盈亏')}</span><strong>{learning?.recentAveragePnl == null ? '--' : money(learning.recentAveragePnl)}</strong><small>{copy('after fees', '已扣除费用')}</small></div>
          <div><span>{copy('ADJUSTMENTS', '已调整次数')}</span><strong>{auditedAdjustmentCount}</strong><small>{copy('audited changes', '可审计参数变更')}</small></div>
          <div><span>{copy('SETTINGS AI', '设置 AI')}</span><strong>{learning?.aiStatus ? String(learning.aiStatus).toUpperCase() : copy('WAITING', '等待样本')}</strong><small>{[learning?.aiProvider, learning?.aiModel].filter(Boolean).join(' · ') || copy('Uses your configured provider', '调用设置中配置的模型')}</small></div>
          <div><span>{copy('NORMAL DIRECTION', '原方向命中')}</span><strong>{learning?.observedDirectionalAccuracy == null ? '--' : probability(learning.observedDirectionalAccuracy)}</strong><small>{learning?.directionalWindowSamples ?? learning?.observedSamples ?? 0} {copy('forecasts in calculation window', '个计算窗口内预测')}</small></div>
          <div><span>{copy('INVERSE COUNTERFACTUAL', '反向命中假设')}</span><strong>{learning?.observedInverseAccuracy == null ? '--' : probability(learning.observedInverseAccuracy)}</strong><small>{learning?.directionalWindowSamples ?? learning?.observedSamples ?? 0} {copy('same-window complement, not P/L', '个同窗口预测 · 互补命中率，非收益率')}</small></div>
          <div><span>{copy('ACTIVE DIRECTION', '当前方向模式')}</span><strong>{learning?.contrarianMode ? copy('CONTRARIAN', '反向') : copy('NORMAL', '正常')}</strong><small>{copy('24+ stable samples required to flip', '至少 24 个稳定样本才可切换')}</small></div>
        </div>
        {learning?.lastAiDiagnosis && <div className="kalshi-ai-diagnosis"><RobotOutlined /><span><b>{copy('Latest AI calibration review', '最近一次 AI 校准复盘')}</b><p>{learning.lastAiDiagnosis}</p><div className="kalshi-ai-review-meta">{learning?.lastAiRootCause && <em>{copy('Root cause', '根因')} · {String(learning.lastAiRootCause).replace(/_/g, ' ')}</em>}{learning?.lastAiTargetMetric && <em>{copy('Target', '目标')} · {learning.lastAiTargetMetric}</em>}{learning?.lastAiExpectedEffect && <em>{copy('Expected', '预期')} · {learning.lastAiExpectedEffect}</em>}</div>{learning.lastAiReasons?.length ? <small>{learning.lastAiReasons.join(' · ')}</small> : null}</span></div>}
        <div className="kalshi-learning-playbook">
          <header><span>{copy('AI TRAINING PLAYBOOK', 'AI 调参培训规则')}</span><b>{copy('Diagnose first, adjust one cause', '先诊断，再针对一个根因调整')}</b></header>
          <div>
            <article><strong>01</strong><span><b>{copy('Calibration', '概率校准')}</b><small>{copy('Poor Brier or reliability gaps reduce forecast extremity and increase market blending.', 'Brier 或可靠性分箱较差时，降低预测极端程度并提高市场价格融合。')}</small></span></article>
            <article><strong>02</strong><span><b>{copy('Entry selectivity', '入场选择')}</b><small>{copy('Calibration is sound but net P/L is weak: require more edge instead of taking more trades.', '校准正常但净盈亏偏弱时，提高边际要求，而不是增加交易次数。')}</small></span></article>
            <article><strong>03</strong><span><b>{copy('Execution friction', '成交摩擦')}</b><small>{copy('Negative early exits or high fees tighten crossing tolerance, spread, and participation.', '早退亏损或费用过高时，收紧成交容差、点差和盘口参与率。')}</small></span></article>
            <article><strong>04</strong><span><b>{copy('Direction and regime', '方向与行情状态')}</b><small>{copy('Direction changes need independent shadow and traded cohorts; unstable regimes produce no change.', '方向反转需要影子与交易样本独立支持；行情不稳定时保持不变。')}</small></span></article>
          </div>
        </div>
        <div className="kalshi-adjustment-ledger">
          <div className="kalshi-adjustment-head">
            <div>
              <span>{copy('LEARNING AUDIT', '学习审计')}</span>
              <h4>{copy('What AI and the controller changed', 'AI 与控制器具体调整了什么')}</h4>
              <p>{copy('Every applied parameter change keeps its previous value, new value, evidence, and source.', '每项已应用参数都会保留调整前后数值、触发证据与来源。')}</p>
            </div>
            <strong>{learningChanges.length}</strong>
          </div>
          {learningChanges.length ? <div className="kalshi-adjustment-list">
            {learningChanges.map((change, changeIndex) => {
              const source = String(change?.source || '').startsWith('settings_ai_')
                ? copy('AI REVIEW', 'AI 复盘')
                : copy('RULE CONTROLLER', '规则控制器');
              const entries = Object.entries(change.applied || {});
              return <article key={`${change.at || changeIndex}-${change.version || changeIndex}`}>
                <header>
                  <div><b>{source}</b><span>v{change.version || '--'} · {change.at ? new Date(change.at).toLocaleString(chinese ? 'zh-CN' : 'en-US') : '--'}</span></div>
                  <small>{change?.metrics?.samples ? `${change.metrics.samples} ${copy('samples', '个样本')}` : change?.evidence?.realizedSamples ? `${change.evidence.realizedSamples} ${copy('realized', '笔已实现')}` : ''}</small>
                </header>
                <p>{change.summary}</p>
                <div>
                  {entries.map(([key, raw]: [string, any]) => {
                    const before = raw?.before ?? change?.before?.[key];
                    const after = raw?.after ?? raw?.value ?? change?.after?.[key];
                    return <span key={key}>
                      <em>{parameterLabel(key)}</em>
                      <b>{adjustmentValue(key, before)} <i>→</i> {adjustmentValue(key, after)}</b>
                      <small>{raw?.reason || change.summary}</small>
                    </span>;
                  })}
                </div>
                {!!Object.keys(change?.rejected || {}).length && <details>
                  <summary>{copy(`${Object.keys(change.rejected).length} proposal(s) rejected by guardrails`, `${Object.keys(change.rejected).length} 项建议被护栏拒绝`)}</summary>
                  {Object.entries(change.rejected).map(([key, raw]: [string, any]) => <p key={key}><b>{parameterLabel(key)}</b>: {raw?.reason}</p>)}
                </details>}
              </article>;
            })}
          </div> : <div className="kalshi-empty-row">{copy('No learning adjustment has been applied yet.', '尚未应用任何学习调整。')}</div>}
        </div>
        <div className="kalshi-learning-inputs">
          <label><span>{copy('Pre-trade AI challenge', '进场前 AI 质检')}<small>{copy('may stop a new entry only', '只能阻止新开仓')}</small></span><input type="checkbox" checked={config.preTradeAiReview} onChange={(event) => setConfig((current) => ({ ...current, preTradeAiReview: event.target.checked }))} /></label>
          <label><span>{copy('AI-assisted review', 'AI 辅助复盘')}<small>{copy('Settings provider, bounded changes', '使用设置模型，调整受限')}</small></span><input type="checkbox" checked={config.learningAiMode} disabled={!config.learningMode} onChange={(event) => setConfig((current) => ({ ...current, learningAiMode: event.target.checked }))} /></label>
          <label><span>{copy('Exploration budget', '探索预算')}<small>{copy('more samples, still gated', '增加样本但仍受硬门控')}</small></span><input type="number" min="0" max="35" step="5" value={config.learningExplorationRate * 100} disabled={!config.learningMode} onChange={(event) => updateConfig('learningExplorationRate', event.target.valueAsNumber, 100)} /></label>
          <label><span>{copy('Review cadence', '复盘频率')}<small>{copy('settled trades', '个结算交易')}</small></span><input type="number" min="4" max="24" step="1" value={config.learningReviewEvery} disabled={!config.learningMode} onChange={(event) => updateConfig('learningReviewEvery', event.target.valueAsNumber)} /></label>
          <label><span>{copy('Evidence window', '证据窗口')}<small>{copy('recent settlements', '近期结算样本')}</small></span><input type="number" min="12" max="100" step="4" value={config.learningWindowSize} disabled={!config.learningMode} onChange={(event) => updateConfig('learningWindowSize', event.target.valueAsNumber)} /></label>
          <label><span>{copy('Maximum learned risk', '学习风险上限')}<small>%</small></span><input type="number" min="0.1" max="1" step="0.05" value={config.learningMaxRiskPct} disabled={!config.learningMode} onChange={(event) => updateConfig('learningMaxRiskPct', event.target.valueAsNumber)} /></label>
        </div>
        <ol className="kalshi-learning-rules">
          <li><b>01</b><span>{copy(`Warm up with 12 filled-and-settled ${modeLabel} trades; open signals and rejected orders never train the controller.`, `先收集 12 笔已成交且已结算的${modeLabel}交易；未成交订单和普通信号不会参与学习。`)}</span></li>
          <li><b>02</b><span>{copy('Negative net P/L or a weak hit rate reduces size and exploration. Poor settlement calibration also de-extremizes probability forecasts.', '净盈亏为负或命中率偏弱时会降低仓位和探索；结算校准较差时还会降低概率预测的极端程度。')}</span></li>
          <li><b>03</b><span>{copy('Only a profitable, calibrated 16+ trade window may expand risk, and never above the learned-risk cap.', '只有盈利且校准良好的 16 笔以上窗口才可小幅扩大风险，并且绝不超过学习风险上限。')}</span></li>
          <li><b>04</b><span>{copy('Neutral windows may relax signal thresholds slightly, but execution tolerance, spread, depth, exposure, and order-size gates stay fixed.', '中性窗口可以轻微放宽信号阈值，但成交容差、点差、深度、敞口和订单大小门控保持不变。')}</span></li>
          <li><b>05</b><span>{copy('AI proposals are semantically checked. It cannot loosen execution or exploration during losses, raise overconfident forecasts, size orders, or flip direction without agreement across independent cohorts.', 'AI 建议会经过语义护栏；亏损期不能放宽成交或探索，校准较差时不能提高置信度，也不能决定仓位，且不同证据组未达成一致时不能反转方向。')}</span></li>
        </ol>
      </div>
      <div className="kalshi-control-grid">
        <label><span>{isRealMode ? copy('Real account equity', '实盘账户权益') : copy('Paper account equity', 'Paper 账户权益')}<small>{isRealMode ? copy('from signed Kalshi account', '来自 Kalshi 签名账户') : copy('maintained by AlphaLab', '由 AlphaLab 内置账本维护')}</small></span><input type="number" value={Number.isFinite(modeEquity) ? modeEquity.toFixed(2) : config.paperBankroll} disabled readOnly /></label>
        <label><span>{copy('Risk per interval', '每时段风险')}<small>%</small></span><input type="number" min="0.1" max="2" step="0.1" value={config.riskPerTradePct} onChange={(event) => updateConfig('riskPerTradePct', event.target.valueAsNumber)} /></label>
        <label><span>{copy('Favorite confidence floor', '优势侧置信下限')}<small>{copy('model win probability, %', '模型胜率下限，%')}</small></span><input type="number" min="50" max="90" step="1" value={config.minModelProbability * 100} onChange={(event) => updateConfig('minModelProbability', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Price band', '价格区间下限')}<small>{copy('minimum entry price, cents', '最低进场价，美分')}</small></span><input type="number" min="30" max="60" step="1" value={config.minPrice * 100} onChange={(event) => updateConfig('minPrice', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Price ceiling', '价格区间上限')}<small>{copy('maximum entry price, cents', '最高进场价，美分')}</small></span><input type="number" min="55" max="99" step="1" value={config.maxPrice * 100} onChange={(event) => updateConfig('maxPrice', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Entry window start', '进场窗口起点')}<small>{copy('min seconds to close', '距结算最少秒数')}</small></span><input type="number" min="45" max="360" step="5" value={config.minSecondsToClose} onChange={(event) => updateConfig('minSecondsToClose', event.target.valueAsNumber)} /></label>
        <label><span>{copy('Entry window end', '进场窗口终点')}<small>{copy('max seconds to close', '距结算最多秒数')}</small></span><input type="number" min="180" max="840" step="10" value={config.maxSecondsToClose} onChange={(event) => updateConfig('maxSecondsToClose', event.target.valueAsNumber)} /></label>
        <label><span>{copy('Minimum net edge', '最低净边际')}<small>{copy('percentage points', '百分点')}</small></span><input type="number" min="0.5" max="15" step="0.25" value={config.minNetEdge * 100} onChange={(event) => updateConfig('minNetEdge', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Conservative edge', '最低保守边际')}<small>{copy('after uncertainty', '扣除不确定性后')}</small></span><input type="number" min="0" max="8" step="0.25" value={config.minConservativeEdge * 100} onChange={(event) => updateConfig('minConservativeEdge', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Maximum spread', '最大点差')}<small>{copy('cents', '美分')}</small></span><input type="number" min="1" max="20" step="0.5" value={config.maxSpread * 100} onChange={(event) => updateConfig('maxSpread', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Maximum relative spread', '最大相对点差')}<small>{copy('spread / contract price', '点差 / 合约价格')}</small></span><input type="number" min="5" max="50" step="1" value={config.maxRelativeSpread * 100} onChange={(event) => updateConfig('maxRelativeSpread', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Minimum ask depth', '最低卖方深度')}<small>{copy('contracts', '份')}</small></span><input type="number" min="1" max="10000" step="5" value={config.minDepthContracts} onChange={(event) => updateConfig('minDepthContracts', event.target.valueAsNumber)} /></label>
        <label><span>{copy('Book participation cap', '盘口参与率上限')}<small>%</small></span><input type="number" min="5" max="50" step="5" value={config.maxBookParticipation * 100} onChange={(event) => updateConfig('maxBookParticipation', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Portfolio exposure cap', '组合敞口上限')}<small>%</small></span><input type="number" min="2" max="50" step="1" value={config.maxPortfolioExposurePct} onChange={(event) => updateConfig('maxPortfolioExposurePct', event.target.valueAsNumber)} /></label>
        <label><span>{copy('IOC crossing allowance', 'IOC 成交容差')}<small>{copy('cents, edge-capped', '美分，受边际约束')}</small></span><input type="number" min="0" max="3" step="0.5" value={config.executionPriceTolerance * 100} onChange={(event) => updateConfig('executionPriceTolerance', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Model-market gap limit', '模型市场分歧上限')}<small>{copy('percentage points', '百分点')}</small></span><input type="number" min="10" max="40" step="1" value={config.maxModelMarketGap * 100} onChange={(event) => updateConfig('maxModelMarketGap', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Protective probability gate', '保护性概率门槛')}<small>{copy('must also clear the loss gate', '必须同时满足亏损门槛')}</small></span><input type="number" min="10" max="49" step="1" value={config.exitProbabilityThreshold * 100} onChange={(event) => updateConfig('exitProbabilityThreshold', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Minimum net exit profit', '最低净平仓盈利')}<small>{copy('dollars per contract, after both fees', '每份美元，已扣除两侧手续费')}</small></span><input type="number" min="0" max="10" step="0.5" value={config.minimumExitProfit * 100} onChange={(event) => updateConfig('minimumExitProfit', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Protective stop-loss gate', '保护性止损门槛')}<small>{copy('loss from fee-adjusted break-even', '相对含费盈亏平衡点的亏损')}</small></span><input type="number" min="15" max="80" step="5" value={config.stopLossPct * 100} onChange={(event) => updateConfig('stopLossPct', event.target.valueAsNumber, 100)} /></label>
        <label><span>{copy('Emergency stop-loss gate', '紧急止损门槛')}<small>{copy('only after probability collapse', '仅在概率严重恶化后启用')}</small></span><input type="number" min="10" max="60" step="5" value={config.emergencyStopLossPct * 100} onChange={(event) => updateConfig('emergencyStopLossPct', event.target.valueAsNumber, 100)} /></label>
      </div>
      <div className="kalshi-policy-note"><SafetyCertificateOutlined /><span><b>{copy('Hard limits remain deterministic.', '硬限制始终由确定性规则控制。')}</b>{copy(' The robot follows your selected Kalshi environment and uses IOC limit orders only. AI may challenge a cleared new entry, but cannot approve a blocked trade, alter an exit, size an order, or route one.', ' 机器人会跟随你选择的 Kalshi 账户环境，并且只使用 IOC 限价单；AI 可以质疑已通过的新开仓，但不能放行被阻止的交易、修改退出、决定仓位或直接下单。')}</span></div>
    </section>;
  };

  const renderDecisionLog = () => {
    const item: any = robotState?.decisions?.[0] || history[0];
    const intent = String(item?.executionIntent || '');
    const decisionText = !item || item.action === 'WAIT'
      ? copy('WAIT', '等待')
      : `${intent.startsWith('CLOSE') ? copy('CLOSE', '平仓') : intent.startsWith('REVERSE') ? copy('REVERSE', '反手') : copy('BUY', '买入')} ${item.side || ''}`;
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
      position_already_aligned: copy('Existing position already matches the signal', '现有持仓已经与信号一致'),
      ai_challenge: copy('AI found a material contradiction and requested a fresh snapshot', 'AI 发现重大矛盾，要求等待下一份行情快照'),
    };
    const reasons = (item?.blockingReasons || []).map((reason: string) => reasonLabels[reason] || reason.replace(/_/g, ' '));
    const itemAiReview = item?.aiReview?.status === 'reviewed' ? item.aiReview : undefined;
    return (
      <section className="kalshi-current-decision">
        <div className="kalshi-section-head"><div><span>{copy('CURRENT 15-MINUTE DECISION', '当前 15 分钟决策')}</span><h2>{copy('What the robot is doing now', '机器人现在在做什么')}</h2><small>{copy('Only the latest decision is retained. Filled orders remain in the settlement ledger.', '只保留最新决策；已成交订单仍保留在结算记录中。')}</small></div><strong>{item?.ticker || '--'}</strong></div>
        {item ? <div className="kalshi-current-decision-grid">
          <article className={item.action === 'WAIT' ? 'is-waiting' : 'is-trading'}><span>{copy('DECISION', '当前决定')}</span><strong>{decisionText}</strong><small>{new Date(item.generatedAt).toLocaleString(chinese ? 'zh-CN' : 'en-US')}</small></article>
          <article><span>{copy('ORDER RESULT', '订单结果')}</span><strong>{item.orderFilled ? copy('FILLED', '已成交') : item.orderSubmitted ? copy('NOT FILLED', '未成交') : copy('NO ORDER', '未下单')}</strong><small>{item.fillCount ? `${copy('Quantity', '数量')} ${item.fillCount}` : kalshiModeLabel}</small></article>
          <article><span>{copy('MODEL / EXECUTABLE PRICE', '模型概率 / 可成交价')}</span><strong>{probability(item.fairProbability)} / {cents(item.price)}</strong><small>{copy('Probability compared with current cost', '模型概率与当前成本对比')}</small></article>
          <article><span>{copy('SIGNAL QUALITY', '信号质量')}</span><strong>{Math.round(Number(item.signalQuality || 0))}/100</strong><small>{reasons.length ? copy(`${reasons.length} controls blocked`, `${reasons.length} 项条件未通过`) : copy('All controls passed', '所有条件已通过')}</small></article>
        </div> : <div className="kalshi-empty-row">{copy('Waiting for the first complete market decision.', '正在等待第一条完整市场决策。')}</div>}
        {item && <div className="kalshi-decision-explanation"><b>{reasons.length ? copy('Why it is waiting', '为什么等待') : copy('Why it can trade', '为什么可以交易')}</b>{reasons.length ? <ul>{reasons.slice(0, 5).map((reason: string) => <li key={reason}>{reason}</li>)}</ul> : <p>{copy('The signal, executable price, liquidity and account limits all passed.', '信号、可成交价格、流动性和账户限制均已通过。')}</p>}</div>}
        {itemAiReview && <div className={`kalshi-ai-audit is-${itemAiReview.verdict}`}>
          <div><RobotOutlined /><span><b>{copy('AI challenge audit', 'AI 质检记录')}</b><small>{[itemAiReview.provider, itemAiReview.model, itemAiReview.confidence == null ? '' : `${Math.round(itemAiReview.confidence * 100)}%`].filter(Boolean).join(' · ')}</small></span><strong>{itemAiReview.verdict === 'challenge' ? copy('CHALLENGE', '要求等待') : copy('CLEAR', '未发现矛盾')}</strong></div>
          <p>{itemAiReview.summary}</p>
          {!!(itemAiReview.contradictions?.length || itemAiReview.topRisks?.length) && <ul>{[...(itemAiReview.contradictions || []), ...(itemAiReview.topRisks || [])].slice(0, 4).map((value: string) => <li key={value}>{value}</li>)}</ul>}
          {itemAiReview.nextCheck && <small>{copy('Next check', '下次检查')}: {itemAiReview.nextCheck}</small>}
        </div>}
      </section>
    );
  };

  const renderRules = () => (
    <section className="kalshi-reference-page">
      <div className="kalshi-reference-column"><span>01</span><h2>{copy('Resolution rule', '结算规则')}</h2><p>{rulesPrimary || copy('Waiting for the active contract rule.', '正在等待当前合约规则。')}</p></div>
      <div className="kalshi-reference-column"><span>02</span><h2>{copy('Reference methodology', '参考方法')}</h2><p>{rulesSecondary || copy('The official result is a 60-second average of the CF Benchmarks Real-Time Index over the final minute, not the last Coinbase trade.', '官方结果为结算前最后一分钟 CF Benchmarks 实时指数的 60 秒均价，而不是 Coinbase 最后一笔成交。')}</p></div>
      <div className="kalshi-reference-column"><span>03</span><h2>{copy('Model boundary', '模型边界')}</h2><p>{copy('Coinbase is an independent spot proxy. Basis differences against the CF Benchmarks index remain inside the uncertainty and edge buffers.', 'Coinbase 仅作为独立现货代理；它与 CF Benchmarks 指数的基准差被保留在不确定性和边际缓冲中。')}</p></div>
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
      analytics.realizedTradeRecords?.length
        ? analytics.realizedTradeRecords
        : robotState?.strategy?.realizedTradeRecords?.length
          ? robotState.strategy.realizedTradeRecords
          : analytics.settlementRecords?.length
            ? analytics.settlementRecords
            : fallbackSettlementRecords
    )
      .filter((record: any) => !record.environment || record.environment === portfolioMode);
    const fallbackEquityCurve = robotState?.strategy?.equityCurve || [];
    const equityCurve = (analytics.equityCurve?.length ? analytics.equityCurve : fallbackEquityCurve)
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
    const unrealizedPnl = positionRows.reduce((sum: number, item: any) => sum + Number(item.unrealized_pnl_dollars || 0), 0);
    const openExposure = positionRows.reduce((sum: number, item: any) => sum + Number(item.market_exposure_dollars || 0), 0);
    const totalReturnPct = startingBalance > 0 ? (accountEquity - startingBalance) / startingBalance : null;
    const pnlValues = realizedRecords.map((record: any) => Number(record.pnl || 0));
    const bestTrade = analytics.realizedBestTrade ?? (pnlValues.length ? Math.max(...pnlValues) : null);
    const worstTrade = analytics.realizedWorstTrade ?? (pnlValues.length ? Math.min(...pnlValues) : null);
    const losses = Math.max(0, realizedSamples - Number(wins || 0));
    const grossWin = pnlValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = pnlValues.filter((value) => value < 0).reduce((sum, value) => sum + Math.abs(value), 0);
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);

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
        <section className="kalshi-account-strip">
          <div className="is-headline">
            <span>{copy('ACCOUNT EQUITY', '账户权益')}</span>
            <strong>{money(accountEquity)}</strong>
            <small>{totalReturnPct === null
              ? copy('Cash plus open-position value', '现金加未结持仓市值')
              : <>{copy('Total return', '总回报')} <em className={returnClass}>{totalReturnPct >= 0 ? '+' : ''}{(totalReturnPct * 100).toFixed(2)}%</em>{startingBalance > 0 ? ` · ${copy('from', '起始')} ${money(startingBalance)}` : ''}</>}</small>
          </div>
          <div><span>{isRealMode ? copy('REAL CASH', '实盘现金') : copy('PAPER CASH', '模拟现金')}</span><strong>{money(cash)}</strong><small>{copy('Available buying power', '可用购买力')}</small></div>
          <div><span>{copy('UNREALIZED P/L', '未实现盈亏')}</span><strong className={unrealizedPnl >= 0 ? 'is-profit' : 'is-loss'}>{unrealizedPnl >= 0 ? '+' : ''}{money(unrealizedPnl)}</strong><small>{positionRows.length} {copy('open · exposure', '持仓 · 敞口')} {money(openExposure)}</small></div>
          <div><span>{copy('REALIZED P/L', '已实现盈亏')}</span><strong className={Number(totalPnl) >= 0 ? 'is-profit' : 'is-loss'}>{Number(totalPnl) >= 0 ? '+' : ''}{money(totalPnl)}</strong><small>{copy('Net of fees · updated', '扣费后 · 更新于')} {new Date(paperPortfolio.asOf).toLocaleTimeString(chinese ? 'zh-CN' : 'en-US')}</small></div>
        </section>
        <section className="kalshi-performance-section">
          <div className="kalshi-performance-summary">
            <div><span>{copy('REALIZED WIN RATE', '已实现胜率')}</span><strong>{winRate === null ? '--' : probability(winRate)}</strong><small><em className="is-profit">{wins}{copy('W', ' 胜')}</em> · <em className="is-loss">{losses}{copy('L', ' 负')}</em> / {realizedSamples} {copy('trades', '笔')}</small></div>
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
          <div className="kalshi-section-head"><div><span>{copy('REALIZED LEDGER', '已实现账本')}</span><h2>{copy('Realized trade outcomes', '已实现交易结果')}</h2><small>{copy('Every filled sale and final settlement is shown with net P/L.', '每笔成交卖出和最终结算均显示净收益。')}</small></div><strong>{realizedRecords.length}</strong></div>
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

  const renderStrategy = () => (
    <section className="kalshi-strategy-section">
      <div className="kalshi-section-head"><div><span>{copy('STRATEGY GOVERNANCE', '策略治理')}</span><h2>{robotState?.strategy?.name || 'BTC15 Favorite Carry v3'}</h2></div><strong>v{robotState?.strategy?.version || 3}</strong></div>
      <div className="kalshi-strategy-grid">
        <article><span>{copy('PHILOSOPHY', '策略理念')}</span><p>{robotState?.strategy?.philosophy || copy('Probability, edge, liquidity, and risk must agree before an order is allowed.', '概率、边际、流动性与风险必须同时通过后才允许下单。')}</p></article>
        <article><span>{copy('MODEL INPUTS', '模型输入')}</span><ul>{(robotState?.strategy?.components || []).map((component) => <li key={component}>{component}</li>)}</ul></article>
        <article><span>{copy('CONSERVATIVE ESTIMATE', '保守估计')}</span><strong>{probability(decision?.edge.conservativeProbability)}</strong><small>{decision?.side || '--'} · {copy('conservative edge', '保守边际')} {probability(decision?.edge.conservativeEdge)}</small></article>
        <article><span>{copy('LATEST CHANGE', '最近改动')}</span><p>{robotState?.strategy?.changes?.[0]?.summary || copy('No parameter changes recorded.', '尚无参数改动。')}</p><small>{robotState?.strategy?.changes?.[0]?.at ? new Date(robotState.strategy.changes[0].at).toLocaleString() : '--'}</small></article>
      </div>
    </section>
  );

  const renderData = () => (
    <section className="kalshi-source-grid">
      {[
        [copy('Contract and quotes', '合约与报价'), 'Kalshi Trade API v2', 'KXBTC15M'],
        [copy('Order book', '订单簿'), 'Kalshi production public orderbook', copy('Sub-second hot cache for active contracts', '活跃合约亚秒级热缓存')],
        [copy('Settlement authority', '结算依据'), 'CF Benchmarks Real-Time Index', copy('60-second average over the final minute before close', '结算前最后一分钟的 60 秒均价')],
        [copy('Independent spot', '独立现货'), 'Coinbase Exchange BTC-USD', copy('Ticker + 1-minute candles', '报价与一分钟 K 线')],
      ].map(([title, source, detail]) => <div key={title}><DatabaseOutlined /><span>{title}</span><strong>{source}</strong><small>{detail}</small></div>)}
    </section>
  );

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

  const renderBody = () => {
    if (view === 'rules') return renderRules();
    if (view === 'decisions') return renderDecisionLog();
    if (view === 'risk') return renderRiskControls();
    if (view === 'positions' || view === 'orders') return renderPortfolio();
    if (view === 'data') return renderData();
    if (view === 'connection') return renderConnection();
    if (view === 'bot') return <>{renderStrategy()}{renderDecision()}{renderGates()}</>;
    return <>{renderMetrics()}{renderDecision()}{renderGates()}{renderBook()}</>;
  };

  const pageMeta: Record<KalshiView, { eyebrow: string; title: string; description: string }> = {
    desk: { eyebrow: copy('KALSHI / LIVE MARKET', 'KALSHI / 实时市场'), title: copy('BTC 15-minute contract desk', 'BTC 15 分钟合约工作台'), description: copy('Live contract, executable order book, reference price and model evidence.', '实时合约、可成交订单簿、参考价格与模型证据。') },
    rules: { eyebrow: copy('KALSHI / METHODOLOGY', 'KALSHI / 结算方法'), title: copy('Contract rules and settlement', '合约规则与结算'), description: copy('The exact market question, BRTI settlement authority and model boundary.', '准确的市场问题、BRTI 结算依据与模型边界。') },
    bot: { eyebrow: copy('KALSHI / AUTOMATION', 'KALSHI / 自动化'), title: copy('BTC 15-minute robot monitor', 'BTC 15 分钟机器人监控'), description: copy('Current decision, AI challenge, sizing and deterministic trade gates.', '当前决策、AI 质检、仓位与确定性交易门控。') },
    decisions: { eyebrow: copy('KALSHI / AUDIT', 'KALSHI / 审计'), title: copy('Decision audit log', '决策审计记录'), description: copy('The latest model decision, evidence, gate result and AI review.', '最近一次模型决策、证据、门控结果与 AI 复核。') },
    risk: { eyebrow: copy('KALSHI / GOVERNANCE', 'KALSHI / 策略治理'), title: copy('Strategy and risk controls', '策略与风控'), description: copy('Choose a preset, manage saved strategies, learning and hard limits in one place.', '在一个页面管理预设、已保存策略、学习与硬限制。') },
    positions: { eyebrow: copy('KALSHI / PORTFOLIO', 'KALSHI / 组合'), title: copy('Portfolio overview', '投资组合总览'), description: copy('Account equity, open exposure, marked P/L and realized outcomes.', '账户权益、当前敞口、盯市盈亏与已实现结果。') },
    orders: { eyebrow: copy('KALSHI / EXECUTION', 'KALSHI / 执行'), title: copy('Order execution ledger', '订单执行流水'), description: copy('IOC requests, fills, executable prices, slippage, fees and rejects.', 'IOC 请求、成交、可成交价格、滑点、费用与拒单。') },
    data: { eyebrow: copy('KALSHI / DATA', 'KALSHI / 数据'), title: copy('Market data sources', '市场数据源'), description: copy('Contract, order-book, settlement and independent spot provenance.', '合约、订单簿、结算与独立现货的数据来源。') },
    connection: { eyebrow: copy('KALSHI / CONNECTION', 'KALSHI / 连接'), title: copy('Account connection', '账户连接'), description: copy('Public market data status and personal trading authorization.', '公开市场数据状态与个人交易授权。') },
  };
  const currentPage = pageMeta[view];
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
        {showPortfolioRefresh && <div className="kalshi-command-actions"><button type="button" className="is-secondary" onClick={() => void loadPaperPortfolio()} disabled={portfolioLoading}><ReloadOutlined className={portfolioLoading ? 'is-spinning' : ''} />{portfolioLoading ? copy('Refreshing…', '刷新中…') : copy('Refresh account', '刷新账户')}</button></div>}
      </header>

      {showSafetyBanner && <div className={`kalshi-safety-banner${isRealMode ? ' is-real' : ''}`}><SafetyCertificateOutlined /><span><b>{isRealMode ? copy('Kalshi Real mode.', 'Kalshi 实盘模式。') : copy('AlphaLab Paper mode.', 'AlphaLab 内置模拟盘。')}</b>{isRealMode ? copy(' Public market data is still used for evidence; orders are signed on the backend with your saved Kalshi API key and sent to your real Kalshi account.', ' 行情证据仍使用公开数据；订单会在后端用你保存的 Kalshi API Key 签名，并发送到你的真实 Kalshi 账户。') : copy(' Fills use production Kalshi public executable quotes and the official taker-fee schedule, but no order is sent to Kalshi and profitability is not guaranteed.', ' 成交使用 Kalshi 正式公开可成交报价和官方 taker 手续费规则，但不会向 Kalshi 发送订单，也不保证盈利。')}</span></div>}
      {showDecisionLoading && loading && !decision && <div className="kalshi-loading"><ClockCircleOutlined /><span>{copy('Loading Kalshi contract and BTC reference data...', '正在加载 Kalshi 合约与 BTC 参考数据……')}</span></div>}
      {error && <div className="kalshi-error" role="alert"><CloseCircleOutlined /><span><b>{copy('Data refresh failed', '数据刷新失败')}</b>{error}</span><button type="button" onClick={() => void evaluate()}>{copy('Retry', '重试')}</button></div>}
      {!loading && renderBody()}
    </div>
  );
};

export default Kalshi;
