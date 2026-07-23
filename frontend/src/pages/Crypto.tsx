import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AimOutlined,
  AlertOutlined,
  AreaChartOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FireOutlined,
  FundOutlined,
  HistoryOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import cryptoAPI, {
  CryptoAssetSnapshot,
  CryptoOverviewResponse,
  CryptoRegime,
  EnsembleDetail,
  ResearchBacktestResponse,
  SimDecision,
  SimOverviewResponse,
  SimTrade,
} from '../services/cryptoApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import '../styles/Crypto.css';

type CryptoView = 'command' | 'lab' | 'sim' | 'ledger' | 'not-found';
type ApiMode = 'paper' | 'live';

const REFRESH_OVERVIEW_MS = 30_000;
const REFRESH_SIM_MS = 20_000;

// ---------------------------------------------------------------- formatting

const fmtMoney = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtPct = (value: number | null | undefined, digits = 2, alreadyPct = false): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pct = alreadyPct ? value : value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
};

const fmtNum = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
};

const shortTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const chartTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const timeAgo = (iso: string | null | undefined, zh: boolean): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 90) return zh ? `${Math.round(seconds)} 秒前` : `${Math.round(seconds)}s ago`;
  const minutes = seconds / 60;
  if (minutes < 90) return zh ? `${Math.round(minutes)} 分钟前` : `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 36) return zh ? `${Math.round(hours)} 小时前` : `${Math.round(hours)}h ago`;
  return zh ? `${Math.round(hours / 24)} 天前` : `${Math.round(hours / 24)}d ago`;
};

const toneOf = (value: number | null | undefined): 'up' | 'down' | 'flat' => {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
};

// ---------------------------------------------------------------- primitives

const REGIME_META: Record<string, { en: string; zh: string; className: string }> = {
  trend_up: { en: 'Uptrend', zh: '上升趋势', className: 'regime-up' },
  trend_down: { en: 'Downtrend', zh: '下降趋势', className: 'regime-down' },
  range: { en: 'Range', zh: '震荡区间', className: 'regime-range' },
  panic: { en: 'Panic', zh: '恐慌波动', className: 'regime-panic' },
  insufficient_data: { en: 'Warming up', zh: '数据预热', className: 'regime-warmup' },
};

const RegimeBadge: React.FC<{ regime?: CryptoRegime; zh: boolean }> = ({ regime, zh }) => {
  const meta = REGIME_META[String(regime || '')] || {
    en: String(regime || '—'),
    zh: String(regime || '—'),
    className: 'regime-warmup',
  };
  return <span className={`hx-regime ${meta.className}`}>{zh ? meta.zh : meta.en}</span>;
};

const ACTION_CLASS: Record<string, string> = {
  BUY: 'action-buy',
  ADD: 'action-buy',
  HOLD: 'action-hold',
  REDUCE: 'action-reduce',
  EXIT: 'action-exit',
  WAIT: 'action-hold',
};

const ActionChip: React.FC<{ action?: string | null }> = ({ action }) => {
  const label = String(action || 'WAIT').toUpperCase();
  return <span className={`hx-action ${ACTION_CLASS[label] || 'action-hold'}`}>{label}</span>;
};

const ScoreDial: React.FC<{ score?: number | null; zh: boolean }> = ({ score, zh }) => {
  const value = Math.max(0, Math.min(100, Number(score ?? 0)));
  const hue = value < 40 ? 4 : value < 58 ? 38 : 145;
  return (
    <div
      className="hx-dial"
      style={{
        background: `conic-gradient(hsl(${hue} 75% 48%) ${value * 3.6}deg, rgba(148,163,184,0.15) 0deg)`,
      }}
      title={zh ? '综合评分' : 'Composite score'}
    >
      <div className="hx-dial-inner">
        <span className="hx-dial-value">{value.toFixed(0)}</span>
        <span className="hx-dial-label">{zh ? '评分' : 'score'}</span>
      </div>
    </div>
  );
};

const SLEEVE_LABELS: Record<string, { en: string; zh: string }> = {
  trend: { en: 'Trend', zh: '趋势' },
  breakout: { en: 'Breakout', zh: '突破' },
  momentum: { en: 'Momentum', zh: '动量' },
  meanrev: { en: 'MeanRev', zh: '均值回归' },
};

const VoteBars: React.FC<{ ensemble?: EnsembleDetail | null; zh: boolean }> = ({ ensemble, zh }) => {
  const votes = ensemble?.votes;
  if (!votes) return null;
  return (
    <div className="hx-votes">
      {(['trend', 'breakout', 'momentum', 'meanrev'] as const).map((key) => {
        const vote = Number(votes[key] ?? 0);
        const weight = Number(ensemble?.weights?.[key] ?? 0);
        const width = Math.min(50, Math.abs(vote) * 50);
        const style: React.CSSProperties =
          vote >= 0 ? { width: `${width}%`, left: '50%' } : { width: `${width}%`, right: '50%' };
        return (
          <div className="hx-vote-row" key={key}>
            <span className="hx-vote-name">
              {zh ? SLEEVE_LABELS[key].zh : SLEEVE_LABELS[key].en}
              <em>×{weight.toFixed(2)}</em>
            </span>
            <div className="hx-vote-track">
              <div className={`hx-vote-fill ${vote >= 0 ? 'positive' : 'negative'}`} style={style} />
              <div className="hx-vote-axis" />
            </div>
            <span className={`hx-vote-value ${vote >= 0 ? 'up' : 'down'}`}>{vote.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
};

const MlChip: React.FC<{ ensemble?: EnsembleDetail | null; zh: boolean }> = ({ ensemble, zh }) => {
  const ml = ensemble?.ml;
  if (!ml || ml.probability_up === undefined || ml.probability_up === null) {
    return <span className="hx-ml-chip idle">{zh ? 'ML 待命' : 'ML idle'}</span>;
  }
  const pct = ml.probability_up * 100;
  const tone = pct >= 55 ? 'up' : pct <= 45 ? 'down' : 'flat';
  return (
    <span className={`hx-ml-chip ${tone} ${ml.veto ? 'veto' : ''}`}>
      <RobotOutlined /> P(up) {pct.toFixed(0)}%
      {ml.veto ? (zh ? ' · 已否决' : ' · veto') : ''}
    </span>
  );
};

const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: 'up' | 'down' | 'flat';
  hint?: string;
}> = ({ label, value, tone = 'flat', hint }) => (
  <div className="hx-stat" title={hint}>
    <span className="hx-stat-label">{label}</span>
    <span className={`hx-stat-value tone-${tone}`}>{value}</span>
  </div>
);

interface CurvePoint {
  t: string;
  label: string;
  strategy: number | null;
  benchmark: number | null;
}

const mergeCurves = (
  strategy?: Array<[string, number]>,
  benchmark?: Array<[string, number]>,
): CurvePoint[] => {
  const map = new Map<string, CurvePoint>();
  (strategy || []).forEach(([t, v]) => {
    map.set(t, { t, label: chartTime(t), strategy: v, benchmark: null });
  });
  (benchmark || []).forEach(([t, v]) => {
    const existing = map.get(t);
    if (existing) existing.benchmark = v;
    else map.set(t, { t, label: chartTime(t), strategy: null, benchmark: v });
  });
  return Array.from(map.values()).sort((a, b) => (a.t < b.t ? -1 : 1));
};

const EquityChart: React.FC<{
  data: CurvePoint[];
  zh: boolean;
  height?: number;
}> = ({ data, zh, height = 260 }) => {
  if (!data.length) {
    return <div className="hx-chart-empty">{zh ? '暂无净值数据' : 'No equity data yet'}</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hxStrategyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#7c8aa5', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
        />
        <YAxis
          tick={{ fill: '#7c8aa5', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
          domain={['auto', 'auto']}
          tickFormatter={(value: number) =>
            value.toLocaleString('en-US', { maximumFractionDigits: 0 })
          }
        />
        <Tooltip
          contentStyle={{
            background: '#0b1424',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: '#94a3b8' }}
          formatter={(value: number | string, name: string) => [
            typeof value === 'number'
              ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
              : value,
            name === 'strategy' ? (zh ? '策略净值' : 'Strategy') : zh ? '买入持有' : 'HODL',
          ]}
        />
        <Area
          type="monotone"
          dataKey="benchmark"
          stroke="#64748b"
          strokeWidth={1.4}
          strokeDasharray="5 4"
          fill="none"
          dot={false}
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="strategy"
          stroke="#22d3ee"
          strokeWidth={2}
          fill="url(#hxStrategyFill)"
          dot={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const MonthlyBars: React.FC<{ months: Array<{ month: string; return: number }>; zh: boolean }> = ({
  months,
  zh,
}) => {
  if (!months.length) return null;
  const data = months.map((m) => ({ ...m, pct: m.return * 100 }));
  return (
    <div className="hx-panel">
      <h4>{zh ? '月度收益' : 'Monthly returns'}</h4>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#7c8aa5', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#7c8aa5', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#0b1424',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 10,
              fontSize: 12,
            }}
            formatter={(value: number | string) => [
              `${Number(value).toFixed(2)}%`,
              zh ? '收益' : 'Return',
            ]}
          />
          <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.month} fill={entry.pct >= 0 ? '#34d399' : '#f87171'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const DecisionList: React.FC<{ decisions: SimDecision[]; zh: boolean; expandable?: boolean }> = ({
  decisions,
  zh,
  expandable = false,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!decisions.length) {
    return <p className="hx-muted">{zh ? '暂无决策记录。' : 'No decisions recorded yet.'}</p>;
  }
  return (
    <div className="hx-decisions">
      {decisions.map((decision, index) => {
        const open = openIndex === index;
        return (
          <div
            className={`hx-decision ${expandable ? 'clickable' : ''}`}
            key={`${decision.timestamp || index}-${decision.symbol}-${index}`}
            onClick={expandable ? () => setOpenIndex(open ? null : index) : undefined}
          >
            <div className="hx-decision-row">
              <span className="hx-decision-time">{shortTime(decision.timestamp)}</span>
              <b>{decision.symbol}</b>
              <ActionChip action={decision.action} />
              <RegimeBadge regime={decision.regime} zh={zh} />
              <span className="hx-decision-score">
                {zh ? '评分' : 'score'} {fmtNum(decision.score, 0)}
              </span>
              <MlChip ensemble={decision.ensemble} zh={zh} />
              {decision.executed && (
                <span className="hx-executed">
                  <CheckCircleOutlined /> {zh ? '已成交' : 'filled'}
                </span>
              )}
              {decision.source === 'replay' && (
                <span className="hx-replay">{zh ? '补跑' : 'replay'}</span>
              )}
            </div>
            {(open || !expandable) &&
              (decision.reasons || []).slice(0, open ? 8 : 2).map((reason, reasonIndex) => (
                <p className="hx-reason" key={reasonIndex}>
                  {reason}
                </p>
              ))}
          </div>
        );
      })}
    </div>
  );
};

const TradeTable: React.FC<{ trades: SimTrade[]; zh: boolean; compact?: boolean }> = ({
  trades,
  zh,
  compact = false,
}) => {
  if (!trades.length) {
    return <p className="hx-muted">{zh ? '暂无成交记录。' : 'No trades yet.'}</p>;
  }
  return (
    <table className={`hx-table ${compact ? 'compact' : ''}`}>
      <thead>
        <tr>
          <th>{zh ? '时间' : 'Time'}</th>
          <th>{zh ? '交易对' : 'Pair'}</th>
          <th>{zh ? '方向' : 'Side'}</th>
          <th>{zh ? '金额' : 'Notional'}</th>
          <th>{zh ? '价格' : 'Price'}</th>
          {!compact && <th>{zh ? '手续费' : 'Fee'}</th>}
          <th>{zh ? '已实现盈亏' : 'Realized P&L'}</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((trade, index) => (
          <tr key={`${trade.timestamp}-${index}`}>
            <td>{shortTime(trade.timestamp)}</td>
            <td>{trade.symbol}</td>
            <td>
              <ActionChip action={trade.action} />
            </td>
            <td>${fmtMoney(trade.grossNotional)}</td>
            <td>${fmtMoney(trade.price)}</td>
            {!compact && <td>${fmtMoney(trade.fee)}</td>}
            <td className={`tone-${toneOf(trade.realizedPnl)}`}>
              {trade.realizedPnl !== undefined ? `$${fmtMoney(trade.realizedPnl)}` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ------------------------------------------------------------------- page

const viewFromPath = (pathname: string): CryptoView => {
  if (pathname === '/crypto') return 'command';
  if (pathname === '/crypto/strategy') return 'lab';
  if (pathname === '/crypto/automation') return 'sim';
  if (pathname === '/crypto/ledger') return 'ledger';
  return 'not-found';
};

interface LibraryItem {
  id: string;
  name: string;
  role: string;
  source: { title?: string; url?: string; concept?: string };
}

const Crypto: React.FC = () => {
  const location = useLocation();
  const view = viewFromPath(location.pathname);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const zh = language === 'zh-CN';
  const t = useCallback((en: string, zhText: string) => (zh ? zhText : en), [zh]);
  const { tradeMode } = useTradeMode();
  const apiMode: ApiMode = tradeMode === 'real' ? 'live' : 'paper';

  const [overview, setOverview] = useState<CryptoOverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [sim, setSim] = useState<SimOverviewResponse | null>(null);
  const [simError, setSimError] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [notice, setNotice] = useState('');

  const [btSymbol, setBtSymbol] = useState('BTC/USD');
  const [btDays, setBtDays] = useState(180);
  const [btUseMl, setBtUseMl] = useState(true);
  const [btResult, setBtResult] = useState<ResearchBacktestResponse | null>(null);
  const [btRunning, setBtRunning] = useState(false);
  const [btError, setBtError] = useState('');

  const [ledgerTab, setLedgerTab] = useState<'trades' | 'decisions' | 'alpaca'>('trades');
  const [simTrades, setSimTrades] = useState<SimTrade[]>([]);
  const [simDecisions, setSimDecisions] = useState<SimDecision[]>([]);
  const [alpacaLedger, setAlpacaLedger] = useState<Array<Record<string, unknown>>>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      if (mounted.current) setNotice('');
    }, 4000);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const response = await cryptoAPI.overview(apiMode);
      if (!mounted.current) return;
      const data =
        (response as { data?: CryptoOverviewResponse })?.data ??
        (response as unknown as CryptoOverviewResponse);
      setOverview(data);
      setOverviewError(data?.success === false ? data?.message || 'overview failed' : '');
    } catch (error) {
      if (mounted.current) setOverviewError((error as Error)?.message || 'overview failed');
    } finally {
      if (mounted.current) setOverviewLoading(false);
    }
  }, [apiMode]);

  const loadSim = useCallback(async () => {
    try {
      const response = await cryptoAPI.simOverview();
      if (!mounted.current) return;
      const data =
        (response as { data?: SimOverviewResponse })?.data ??
        (response as unknown as SimOverviewResponse);
      setSim(data);
      setSimError(data?.success === false ? data?.message || 'simulator unavailable' : '');
    } catch (error) {
      if (mounted.current) setSimError((error as Error)?.message || 'simulator unavailable');
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const [tradesRes, ledgerRes] = await Promise.allSettled([
        cryptoAPI.simTrades(200),
        cryptoAPI.ledger(100),
      ]);
      if (!mounted.current) return;
      if (tradesRes.status === 'fulfilled') {
        const data = (
          tradesRes.value as { data?: { trades?: SimTrade[]; decisions?: SimDecision[] } }
        )?.data;
        setSimTrades(data?.trades || []);
        setSimDecisions(data?.decisions || []);
      }
      if (ledgerRes.status === 'fulfilled') {
        const data = (
          ledgerRes.value as { data?: { records?: Array<Record<string, unknown>> } }
        )?.data;
        setAlpacaLedger(data?.records || []);
      }
    } finally {
      if (mounted.current) setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    loadOverview();
    loadSim();
    const overviewTimer = window.setInterval(loadOverview, REFRESH_OVERVIEW_MS);
    const simTimer = window.setInterval(loadSim, REFRESH_SIM_MS);
    return () => {
      window.clearInterval(overviewTimer);
      window.clearInterval(simTimer);
    };
  }, [isAuthenticated, loadOverview, loadSim]);

  useEffect(() => {
    if (view === 'ledger' && isAuthenticated) loadLedger();
  }, [view, isAuthenticated, loadLedger]);

  useEffect(() => {
    if (view === 'lab' && isAuthenticated && !library.length) {
      cryptoAPI
        .strategyLibrary()
        .then((response) => {
          const data = (response as { data?: { strategies?: LibraryItem[] } })?.data;
          if (mounted.current && data?.strategies) setLibrary(data.strategies);
        })
        .catch(() => undefined);
    }
  }, [view, isAuthenticated, library.length]);

  const runAction = useCallback(
    async (key: string, action: () => Promise<unknown>, done?: string) => {
      if (busy) return;
      setBusy(key);
      try {
        await action();
        await Promise.all([
          loadSim(),
          key.startsWith('alpaca') || key === 'kill-switch' || key === 'calibrate'
            ? loadOverview()
            : Promise.resolve(),
        ]);
        if (done) flash(done);
      } catch (error) {
        flash(
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (error as Error)?.message ||
            'failed',
        );
      } finally {
        if (mounted.current) setBusy('');
      }
    },
    [busy, flash, loadOverview, loadSim],
  );

  const runBacktest = useCallback(async () => {
    if (btRunning) return;
    setBtRunning(true);
    setBtError('');
    try {
      const response = await cryptoAPI.simResearchBacktest({
        symbol: btSymbol,
        days: btDays,
        useMl: btUseMl,
      });
      const data =
        (response as { data?: ResearchBacktestResponse })?.data ??
        (response as unknown as ResearchBacktestResponse);
      if (data?.success === false) {
        setBtError(data?.message || 'backtest failed');
        setBtResult(null);
      } else {
        setBtResult(data);
      }
    } catch (error) {
      setBtError(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (error as Error)?.message ||
          'backtest failed',
      );
      setBtResult(null);
    } finally {
      if (mounted.current) setBtRunning(false);
    }
  }, [btDays, btRunning, btSymbol, btUseMl]);

  const simCurve = useMemo(
    () => mergeCurves(sim?.equityCurve, sim?.benchmarkCurve),
    [sim?.equityCurve, sim?.benchmarkCurve],
  );
  const btCurve = useMemo(
    () => mergeCurves(btResult?.equityCurve, btResult?.benchmarkCurve),
    [btResult?.equityCurve, btResult?.benchmarkCurve],
  );

  if (!authLoading && !isAuthenticated) return <Navigate to="/login" replace />;
  if (view === 'not-found') return <Navigate to="/crypto" replace />;

  const assets: CryptoAssetSnapshot[] = overview?.assets || [];
  const algorithmName = overview?.algorithm?.name || 'Helios Regime Ensemble';
  const algorithmVersion = overview?.algorithm?.version || '2.0.0';
  const automation = overview?.automation || {};
  const simAccount = sim?.account;
  const simPerf = sim?.performance;
  const simBench = sim?.benchmark;
  const simRunning = Boolean(sim?.running);

  const header = (
    <header className="hx-header">
      <div className="hx-header-title">
        <span className="hx-header-icon">
          <ThunderboltOutlined />
        </span>
        <div>
          <h1>
            {view === 'command' && t('Crypto Command', '虚拟币指挥中心')}
            {view === 'lab' && t('Strategy Lab', '策略实验室')}
            {view === 'sim' && t('24/7 Paper Autopilot', '24 小时模拟盘')}
            {view === 'ledger' && t('Ledger', '交易账本')}
          </h1>
          <p>
            {algorithmName} v{algorithmVersion} · BTC/USD + ETH/USD ·{' '}
            {t(
              '4-sleeve regime ensemble + deep-learning advisor',
              '四策略融合 · 市场状态切换 · 深度学习顾问',
            )}
          </p>
        </div>
      </div>
      <div className="hx-header-side">
        {notice && <span className="hx-notice">{notice}</span>}
        <span className={`hx-pill ${simRunning ? 'pill-live' : 'pill-idle'}`}>
          {simRunning ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
          {t('Sim', '模拟盘')} {simRunning ? t('running', '运行中') : t('stopped', '已停止')}
        </span>
        <button
          type="button"
          className="hx-btn ghost"
          onClick={() => {
            setOverviewLoading(true);
            loadOverview();
            loadSim();
          }}
          disabled={overviewLoading}
        >
          {overviewLoading ? <LoadingOutlined /> : <ReloadOutlined />} {t('Refresh', '刷新')}
        </button>
      </div>
    </header>
  );

  const commandView = (
    <>
      <section className="hx-asset-grid">
        {assets.length === 0 && (
          <div className="hx-card hx-card-empty">
            {overviewLoading ? (
              <>
                <LoadingOutlined /> {t('Loading market state…', '加载市场状态…')}
              </>
            ) : (
              <>
                <WarningOutlined />{' '}
                {overviewError
                  ? `${t('Overview unavailable', '总览不可用')}: ${overviewError}`
                  : t(
                      'No assets returned yet — run one cycle to seed signals.',
                      '暂无信号 — 先运行一次策略周期。',
                    )}
              </>
            )}
          </div>
        )}
        {assets.map((asset) => {
          const detail = asset.signalDetail || {};
          const ensemble = detail.ensemble || null;
          const change = asset.change24h ?? null;
          return (
            <article className="hx-card hx-asset" key={asset.symbol}>
              <div className="hx-asset-head">
                <div>
                  <span className="hx-symbol">{asset.symbol}</span>
                  <span className="hx-symbol-name">{asset.name || ''}</span>
                </div>
                <RegimeBadge regime={detail.regime || asset.regime} zh={zh} />
              </div>
              <div className="hx-asset-price">
                <span className="hx-price">${fmtMoney(asset.price ?? null)}</span>
                <span className={`hx-change tone-${toneOf(change)}`}>
                  {toneOf(change) === 'up' ? (
                    <CaretUpOutlined />
                  ) : toneOf(change) === 'down' ? (
                    <CaretDownOutlined />
                  ) : null}
                  {fmtPct(change, 2, true)}
                </span>
              </div>
              <div className="hx-asset-meta">
                <span>
                  {t('24h $ volume', '24h 成交额')}: $
                  {fmtMoney(asset.dailyDollarVolume ?? asset.volume24h ?? null, 0)}
                </span>
                <span>
                  {t('Spread', '点差')}:{' '}
                  {asset.spreadBps != null ? `${fmtNum(asset.spreadBps, 1)} bps` : '—'}
                </span>
              </div>
              <div className="hx-asset-signal">
                <ScoreDial score={detail.confidence ?? asset.confidence} zh={zh} />
                <div className="hx-asset-signal-main">
                  <div className="hx-signal-row">
                    <ActionChip action={detail.action || asset.signal} />
                    <span className="hx-target">
                      {t('Target weight', '目标仓位')}: {fmtPct(detail.targetWeight ?? 0, 1)}
                    </span>
                  </div>
                  <MlChip ensemble={ensemble} zh={zh} />
                </div>
              </div>
              <VoteBars ensemble={ensemble} zh={zh} />
              {(detail.reasons || []).slice(0, 3).map((reason, index) => (
                <p className="hx-reason" key={index}>
                  {reason}
                </p>
              ))}
              {asset.executionReady === false && (
                <p className="hx-reason warn">
                  <WarningOutlined /> {t('Execution gate', '执行门槛')}:{' '}
                  {(asset.reasons || []).join(', ') || t('quote unavailable', '报价不可用')}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="hx-grid-2">
        <div className="hx-card">
          <div className="hx-card-title">
            <FundOutlined /> {t('Local paper account (Helios sim)', '本地模拟账户（Helios）')}
          </div>
          {sim ? (
            <>
              <div className="hx-stat-grid">
                <Stat label={t('Equity', '净值')} value={`$${fmtMoney(simAccount?.equity)}`} />
                <Stat
                  label={t('Total return', '总收益')}
                  value={fmtPct(simPerf?.totalReturn)}
                  tone={toneOf(simPerf?.totalReturn)}
                />
                <Stat
                  label={t('Sharpe', '夏普')}
                  value={fmtNum(simPerf?.sharpe)}
                  tone={toneOf(simPerf?.sharpe)}
                />
                <Stat
                  label={t('Max drawdown', '最大回撤')}
                  value={fmtPct(simPerf?.maxDrawdown)}
                  tone={simPerf?.maxDrawdown ? 'down' : 'flat'}
                />
                <Stat
                  label={t('vs HODL', '对比持有')}
                  value={
                    simPerf && simBench ? fmtPct(simPerf.totalReturn - simBench.totalReturn) : '—'
                  }
                  tone={
                    simPerf && simBench
                      ? toneOf(simPerf.totalReturn - simBench.totalReturn)
                      : 'flat'
                  }
                />
                <Stat label={t('Trades', '成交数')} value={sim?.tradeCount ?? 0} />
              </div>
              <EquityChart data={simCurve} zh={zh} height={200} />
            </>
          ) : (
            <p className="hx-muted">
              {simError
                ? `${t('Simulator unavailable', '模拟盘不可用')}: ${simError}`
                : t('Loading simulator…', '加载模拟盘…')}
            </p>
          )}
        </div>

        <div className="hx-card">
          <div className="hx-card-title">
            <SafetyCertificateOutlined /> {t('Alpaca account & risk circuits', 'Alpaca 账户与风控电路')}
          </div>
          <div className="hx-stat-grid">
            <Stat
              label={t('Account equity', '账户净值')}
              value={
                overview?.portfolio?.equity != null
                  ? `$${fmtMoney(overview.portfolio.equity)}`
                  : '—'
              }
            />
            <Stat
              label={t('Crypto exposure', '币种敞口')}
              value={
                overview?.portfolio?.exposurePct != null
                  ? `${fmtNum(overview.portfolio.exposurePct, 1)}%`
                  : '—'
              }
            />
            <Stat
              label={t('Day P&L', '当日盈亏')}
              value={
                overview?.portfolio?.dayPnl != null
                  ? `$${fmtMoney(overview.portfolio.dayPnl)}`
                  : '—'
              }
              tone={toneOf(overview?.portfolio?.dayPnl)}
            />
            <Stat
              label={t('Automation', '自动化')}
              value={
                automation.killSwitch
                  ? t('Kill switch', '紧急停止')
                  : automation.enabled
                    ? t('Enabled', '已启用')
                    : t('Off', '关闭')
              }
              tone={automation.killSwitch ? 'down' : automation.enabled ? 'up' : 'flat'}
            />
          </div>
          {!overview?.account?.configured && (
            <p className="hx-muted">
              <WarningOutlined />{' '}
              {t(
                'No Alpaca keys configured — the local simulator works without any keys.',
                '未配置 Alpaca 密钥 — 本地模拟盘无需密钥即可运行。',
              )}
            </p>
          )}
          {overviewError && <p className="hx-muted warn">{overviewError}</p>}
          <div className="hx-actions-row">
            <button
              type="button"
              className="hx-btn"
              disabled={busy !== ''}
              onClick={() =>
                runAction(
                  'sim-cycle',
                  () => cryptoAPI.simRunCycle(),
                  t('Simulator cycle finished', '模拟盘周期已完成'),
                )
              }
            >
              {busy === 'sim-cycle' ? <LoadingOutlined /> : <ThunderboltOutlined />}{' '}
              {t('Run sim cycle now', '立即运行模拟周期')}
            </button>
            <button
              type="button"
              className="hx-btn ghost"
              disabled={busy !== ''}
              onClick={() =>
                runAction(
                  'alpaca-cycle',
                  () => cryptoAPI.runCycle(apiMode, true),
                  t('Alpaca dry-run finished', 'Alpaca 试运行完成'),
                )
              }
            >
              {busy === 'alpaca-cycle' ? <LoadingOutlined /> : <AimOutlined />}{' '}
              {t('Alpaca dry-run', 'Alpaca 试运行')}
            </button>
          </div>
        </div>
      </section>

      <section className="hx-card">
        <div className="hx-card-title">
          <HistoryOutlined /> {t('Latest decisions', '最新决策')}
        </div>
        <DecisionList decisions={sim?.latestDecisions || []} zh={zh} />
      </section>
    </>
  );

  const labView = (
    <>
      <section className="hx-grid-2">
        <div className="hx-card">
          <div className="hx-card-title">
            <ExperimentOutlined /> {t('How Helios decides', 'Helios 策略结构')}
          </div>
          <ul className="hx-explain">
            <li>
              <b>{t('Regime detector', '市场状态识别')}</b>
              {' — '}
              {t(
                'ADX, EMA structure and a volatility-expansion ratio classify each hour as trend_up / trend_down / range / panic.',
                '通过 ADX、EMA 结构与波动率扩张比，把每小时归类为上升趋势 / 下降趋势 / 震荡 / 恐慌。',
              )}
            </li>
            <li>
              <b>{t('Four sleeves vote', '四个子策略投票')}</b>
              {' — '}
              {t(
                'Trend (EMA + 200-bar anchor), Breakout (Donchian + volume), Momentum (3/20/65-day TSMOM), Mean reversion (Bollinger z + fast RSI). Regime-dependent weights combine votes into a 0–100 score.',
                '趋势（EMA+200 锚线）、突破（唐奇安通道+量能）、动量（3/20/65 日时序动量）、均值回归（布林 z 分数+快速 RSI）。按市场状态加权合成 0–100 评分。',
              )}
            </li>
            <li>
              <b>{t('Deep-learning advisor', '深度学习顾问')}</b>
              {' — '}
              {t(
                'A NumPy MLP predicts P(next bar up); it can nudge the score by ±12 points and veto marginal entries — it never trades alone.',
                'NumPy 实现的多层感知机预测下一根K线上涨概率；可 ±12 分微调评分并否决边缘入场，绝不单独下单。',
              )}
            </li>
            <li>
              <b>{t('Risk engine', '风控引擎')}</b>
              {' — '}
              {t(
                'Volatility-targeted sizing, ATR chandelier trailing stops, panic-regime forced exit, daily/7-day/drawdown circuits with a 72h cooldown.',
                '波动率目标仓位、ATR 吊灯移动止损、恐慌状态强制离场、日内/7日/回撤三重风控电路与 72 小时冷却。',
              )}
            </li>
          </ul>
          <div className="hx-ml-cards">
            {(['BTC/USD', 'ETH/USD'] as const).map((symbol) => {
              const meta = sim?.ml?.[symbol];
              return (
                <div className="hx-ml-card" key={symbol}>
                  <div className="hx-ml-card-head">
                    <RobotOutlined /> {symbol} {t('model', '模型')}
                  </div>
                  {meta?.summary ? (
                    <>
                      <span>
                        AUC {fmtNum(meta.summary.val_auc, 3)} · {t('acc', '准确率')}{' '}
                        {fmtPct(meta.summary.val_accuracy, 1)}
                      </span>
                      <span>
                        {t('Samples', '样本')} {meta.dataset?.samples ?? '—'} ·{' '}
                        {timeAgo(meta.trainedAt, zh)}
                      </span>
                    </>
                  ) : (
                    <span className="hx-muted">{t('Not trained yet', '尚未训练')}</span>
                  )}
                  <button
                    type="button"
                    className="hx-btn ghost small"
                    disabled={busy !== ''}
                    onClick={() =>
                      runAction(
                        `train-${symbol}`,
                        () => cryptoAPI.simTrain(symbol),
                        t('Model trained', '模型已训练'),
                      )
                    }
                  >
                    {busy === `train-${symbol}` ? <LoadingOutlined /> : <FireOutlined />}{' '}
                    {t('Train now', '立即训练')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hx-card">
          <div className="hx-card-title">
            <AreaChartOutlined /> {t('Walk-forward backtest', '滚动前推回测')}
          </div>
          <div className="hx-form-row">
            <label>
              {t('Symbol', '交易对')}
              <select value={btSymbol} onChange={(event) => setBtSymbol(event.target.value)}>
                <option value="BTC/USD">BTC/USD</option>
                <option value="ETH/USD">ETH/USD</option>
              </select>
            </label>
            <label>
              {t('Window', '评估区间')}
              <select value={btDays} onChange={(event) => setBtDays(Number(event.target.value))}>
                {[60, 90, 180, 270, 365].map((days) => (
                  <option key={days} value={days}>
                    {days} {t('days', '天')}
                  </option>
                ))}
              </select>
            </label>
            <label className="hx-checkbox">
              <input
                type="checkbox"
                checked={btUseMl}
                onChange={(event) => setBtUseMl(event.target.checked)}
              />
              {t('Use walk-forward ML', '启用滚动 ML')}
            </label>
            <button type="button" className="hx-btn" onClick={runBacktest} disabled={btRunning}>
              {btRunning ? <LoadingOutlined /> : <PlayCircleOutlined />} {t('Run backtest', '运行回测')}
            </button>
          </div>
          {btError && <p className="hx-muted warn">{btError}</p>}
          {btRunning && (
            <p className="hx-muted">
              <LoadingOutlined />{' '}
              {t('Fetching bars, training folds, simulating…', '拉取行情、训练折叠、模拟撮合中…')}
            </p>
          )}
          {btResult && btResult.metrics && (
            <>
              <div className="hx-stat-grid wide">
                <Stat
                  label={t('Strategy return', '策略收益')}
                  value={fmtPct(btResult.metrics.total_return)}
                  tone={toneOf(btResult.metrics.total_return)}
                />
                <Stat
                  label={t('HODL return', '持有收益')}
                  value={fmtPct(btResult.benchmarkMetrics?.total_return)}
                  tone={toneOf(btResult.benchmarkMetrics?.total_return)}
                />
                <Stat label={t('Sharpe', '夏普')} value={fmtNum(btResult.metrics.sharpe)} />
                <Stat label={t('Sortino', '索提诺')} value={fmtNum(btResult.metrics.sortino)} />
                <Stat
                  label={t('Max DD', '最大回撤')}
                  value={fmtPct(btResult.metrics.max_drawdown)}
                  tone="down"
                />
                <Stat label={t('Trades', '交易数')} value={btResult.metrics.trades} />
                <Stat
                  label={t('Win rate', '胜率')}
                  value={
                    btResult.metrics.win_rate != null ? fmtPct(btResult.metrics.win_rate, 0) : '—'
                  }
                />
                <Stat
                  label={t('Profit factor', '盈亏比')}
                  value={
                    btResult.metrics.profit_factor != null
                      ? fmtNum(btResult.metrics.profit_factor)
                      : '—'
                  }
                />
              </div>
              <EquityChart data={btCurve} zh={zh} height={230} />
              {btResult.mlUsed && btResult.mlReport && !btResult.mlReport.error && (
                <p className="hx-muted">
                  <RobotOutlined /> {t('ML out-of-sample AUC', 'ML 样本外 AUC')}:{' '}
                  {fmtNum(btResult.mlReport.oosAuc ?? null, 3)} · {t('coverage', '覆盖率')}{' '}
                  {fmtPct(btResult.mlReport.coverage ?? null, 0)}
                </p>
              )}
              {btResult.mlReport?.error && (
                <p className="hx-muted warn">
                  {t('ML skipped', 'ML 已跳过')}: {btResult.mlReport.error}
                </p>
              )}
              {btResult.regimeStats && (
                <div className="hx-regime-stats">
                  {Object.entries(btResult.regimeStats).map(([regime, stats]) => (
                    <div key={regime} className="hx-regime-stat">
                      <RegimeBadge regime={regime} zh={zh} />
                      <span>
                        {fmtPct(stats.share, 0)} {t('of bars', '时间占比')} ·{' '}
                        {t('contribution', '收益贡献')} {fmtPct(stats.return_contribution)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {btResult.monthlyReturns && <MonthlyBars months={btResult.monthlyReturns} zh={zh} />}
            </>
          )}
        </div>
      </section>

      <section className="hx-card">
        <div className="hx-card-title">
          <DashboardOutlined /> {t('Research library & calibration', '研究库与参数校准')}
        </div>
        <p className="hx-muted">
          {t(
            'Published strategy ideas are translated into bounded parameter candidates and re-tested on real bars with fees; the champion can replace the paper mandate.',
            '公开研究被转译为受限参数候选，在真实K线与手续费下重测；冠军配置可替换纸面策略。',
          )}
        </p>
        <div className="hx-library">
          {library.map((item) => (
            <div className="hx-library-item" key={item.id}>
              <div>
                <b>{item.name}</b>
                <span className={`hx-role ${item.role === 'control' ? 'control' : ''}`}>
                  {item.role === 'control' ? t('control', '对照') : t('challenger', '挑战者')}
                </span>
              </div>
              <p>{item.source?.concept || ''}</p>
              {item.source?.url ? (
                <a href={item.source.url} target="_blank" rel="noreferrer">
                  {item.source?.title || item.source.url}
                </a>
              ) : (
                <span className="hx-muted">{item.source?.title || ''}</span>
              )}
            </div>
          ))}
          {!library.length && <p className="hx-muted">{t('Loading library…', '加载研究库…')}</p>}
        </div>
        <div className="hx-actions-row">
          <button
            type="button"
            className="hx-btn"
            disabled={busy !== ''}
            onClick={() =>
              runAction('calibrate', () => cryptoAPI.calibrate(true), t('Calibration finished', '校准完成'))
            }
          >
            {busy === 'calibrate' ? <LoadingOutlined /> : <ExperimentOutlined />}{' '}
            {t('Run calibration now', '立即运行校准')}
          </button>
        </div>
      </section>
    </>
  );

  const simView = (
    <>
      <section className="hx-card">
        <div className="hx-sim-head">
          <div className="hx-card-title no-margin">
            <RobotOutlined /> {t('Helios 24/7 paper autopilot', 'Helios 24 小时模拟盘')}
            <span className={`hx-pill ${simRunning ? 'pill-live' : 'pill-idle'}`}>
              {simRunning ? t('RUNNING', '运行中') : t('STOPPED', '已停止')}
            </span>
          </div>
          <div className="hx-actions-row">
            {!simRunning ? (
              <button
                type="button"
                className="hx-btn primary"
                disabled={busy !== ''}
                onClick={() =>
                  runAction('sim-start', () => cryptoAPI.simStart(), t('Simulator started', '模拟盘已启动'))
                }
              >
                {busy === 'sim-start' ? <LoadingOutlined /> : <PlayCircleOutlined />} {t('Start', '启动')}
              </button>
            ) : (
              <button
                type="button"
                className="hx-btn danger"
                disabled={busy !== ''}
                onClick={() =>
                  runAction('sim-stop', () => cryptoAPI.simStop(), t('Simulator stopped', '模拟盘已停止'))
                }
              >
                {busy === 'sim-stop' ? <LoadingOutlined /> : <StopOutlined />} {t('Stop', '停止')}
              </button>
            )}
            <button
              type="button"
              className="hx-btn"
              disabled={busy !== ''}
              onClick={() =>
                runAction('sim-cycle2', () => cryptoAPI.simRunCycle(), t('Cycle finished', '周期完成'))
              }
            >
              {busy === 'sim-cycle2' ? <LoadingOutlined /> : <ThunderboltOutlined />}{' '}
              {t('Run cycle', '运行一次')}
            </button>
            <button
              type="button"
              className="hx-btn ghost"
              disabled={busy !== ''}
              onClick={() => {
                if (
                  window.confirm(
                    t('Reset the simulated account? All history is erased.', '重置模拟账户？全部历史将被清空。'),
                  )
                ) {
                  runAction('sim-reset', () => cryptoAPI.simReset(), t('Simulator reset', '模拟盘已重置'));
                }
              }}
            >
              {busy === 'sim-reset' ? <LoadingOutlined /> : <ReloadOutlined />} {t('Reset', '重置')}
            </button>
          </div>
        </div>

        <div className="hx-sim-status">
          <span>
            <ClockCircleOutlined /> {t('Last cycle', '上次周期')}: {timeAgo(sim?.status?.lastCycleAt, zh)}
          </span>
          <span>
            {t('Cycles', '周期数')}: {sim?.status?.cycleCount ?? 0}
          </span>
          <span>
            {t('Interval', '间隔')}:{' '}
            <select
              className="hx-inline-select"
              value={sim?.config?.intervalMinutes ?? 5}
              disabled={busy !== ''}
              onChange={(event) =>
                runAction(
                  'sim-interval',
                  () => cryptoAPI.simUpdateConfig({ intervalMinutes: Number(event.target.value) }),
                  t('Interval updated', '间隔已更新'),
                )
              }
            >
              {[1, 5, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} {t('min', '分钟')}
                </option>
              ))}
            </select>
          </span>
          <span>
            {t('ML advisor', 'ML 顾问')}:{' '}
            <button
              type="button"
              className={`hx-toggle ${sim?.config?.mlEnabled ? 'on' : ''}`}
              disabled={busy !== ''}
              onClick={() =>
                runAction(
                  'sim-ml-toggle',
                  () => cryptoAPI.simUpdateConfig({ mlEnabled: !sim?.config?.mlEnabled }),
                  t('ML setting saved', 'ML 设置已保存'),
                )
              }
            >
              {sim?.config?.mlEnabled ? t('On', '开') : t('Off', '关')}
            </button>
          </span>
          {sim?.status?.lastError && (
            <span className="hx-muted warn">
              <AlertOutlined /> {sim.status.lastError}
            </span>
          )}
        </div>

        <div className="hx-stat-grid wide">
          <Stat label={t('Equity', '净值')} value={`$${fmtMoney(simAccount?.equity)}`} />
          <Stat label={t('Cash', '现金')} value={`$${fmtMoney(simAccount?.cash)}`} />
          <Stat
            label={t('Total return', '总收益')}
            value={fmtPct(simPerf?.totalReturn)}
            tone={toneOf(simPerf?.totalReturn)}
          />
          <Stat
            label={t('Annualized', '年化')}
            value={fmtPct(simPerf?.annualizedReturn)}
            tone={toneOf(simPerf?.annualizedReturn)}
          />
          <Stat label={t('Sharpe', '夏普')} value={fmtNum(simPerf?.sharpe)} />
          <Stat label={t('Max DD', '最大回撤')} value={fmtPct(simPerf?.maxDrawdown)} tone="down" />
          <Stat
            label={t('Sell win rate', '卖出胜率')}
            value={sim?.sellWinRate != null ? fmtPct(sim.sellWinRate, 0) : '—'}
          />
          <Stat
            label={t('vs HODL', '对比持有')}
            value={simPerf && simBench ? fmtPct(simPerf.totalReturn - simBench.totalReturn) : '—'}
            tone={simPerf && simBench ? toneOf(simPerf.totalReturn - simBench.totalReturn) : 'flat'}
          />
        </div>
        <EquityChart data={simCurve} zh={zh} height={280} />
        <p className="hx-muted small">
          {t(
            'Runs inside your backend process: while the backend is up it trades every completed hourly bar; after downtime it replays missed bars at next-bar-open fills, so the record stays honest.',
            '模拟盘运行于你的后端进程内：后端在线时逐小时K线决策；停机后会以“下一根K线开盘价”补跑错过的K线，保证净值记录诚实连续。',
          )}
        </p>
      </section>

      <section className="hx-grid-2">
        <div className="hx-card">
          <div className="hx-card-title">
            <FundOutlined /> {t('Open positions', '当前持仓')}
          </div>
          {simAccount?.positions?.length ? (
            <table className="hx-table">
              <thead>
                <tr>
                  <th>{t('Pair', '交易对')}</th>
                  <th>{t('Qty', '数量')}</th>
                  <th>{t('Avg entry', '均价')}</th>
                  <th>{t('Last', '现价')}</th>
                  <th>{t('Unrealized', '浮盈')}</th>
                  <th>{t('Weight', '仓位')}</th>
                  <th>{t('Stop', '止损')}</th>
                </tr>
              </thead>
              <tbody>
                {simAccount.positions.map((position) => (
                  <tr key={position.symbol}>
                    <td>{position.symbol}</td>
                    <td>{position.qty}</td>
                    <td>${fmtMoney(position.avgEntry)}</td>
                    <td>${fmtMoney(position.lastPrice)}</td>
                    <td className={`tone-${toneOf(position.unrealizedPnl)}`}>
                      ${fmtMoney(position.unrealizedPnl)} ({fmtPct(position.unrealizedPnlPct, 2, true)})
                    </td>
                    <td>{fmtPct(position.weight, 1)}</td>
                    <td>
                      {position.protectiveStop
                        ? `$${fmtMoney(Number(position.protectiveStop))}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hx-muted">
              {t('Flat — waiting for a qualified entry.', '空仓 — 等待符合条件的入场信号。')}
            </p>
          )}
          <div className="hx-card-title top-gap">
            <HistoryOutlined /> {t('Recent trades', '最近成交')}
          </div>
          <TradeTable trades={sim?.recentTrades || []} zh={zh} compact />
        </div>

        <div className="hx-card">
          <div className="hx-card-title">
            <AimOutlined /> {t('Latest decisions', '最新决策')}
          </div>
          <DecisionList decisions={sim?.latestDecisions || []} zh={zh} />
        </div>
      </section>

      <section className="hx-card">
        <div className="hx-card-title">
          <SafetyCertificateOutlined /> {t('Alpaca paper automation (optional)', 'Alpaca 纸面自动化（可选）')}
        </div>
        <p className="hx-muted">
          {t(
            'Routes real paper orders to your Alpaca account with the same Helios engine. Requires Alpaca API keys in Settings.',
            '使用同一 Helios 引擎将纸面订单路由至你的 Alpaca 账户。需在设置中配置 Alpaca API 密钥。',
          )}
        </p>
        <div className="hx-actions-row">
          {!automation.enabled ? (
            <button
              type="button"
              className="hx-btn"
              disabled={busy !== ''}
              onClick={() =>
                runAction(
                  'alpaca-start',
                  () => cryptoAPI.startAutomation(apiMode),
                  t('Alpaca automation started', 'Alpaca 自动化已启动'),
                )
              }
            >
              {busy === 'alpaca-start' ? <LoadingOutlined /> : <PlayCircleOutlined />}{' '}
              {t('Start Alpaca automation', '启动 Alpaca 自动化')}
            </button>
          ) : (
            <button
              type="button"
              className="hx-btn danger"
              disabled={busy !== ''}
              onClick={() =>
                runAction(
                  'alpaca-stop',
                  () => cryptoAPI.stopAutomation(),
                  t('Alpaca automation stopped', 'Alpaca 自动化已停止'),
                )
              }
            >
              {busy === 'alpaca-stop' ? <LoadingOutlined /> : <StopOutlined />}{' '}
              {t('Stop Alpaca automation', '停止 Alpaca 自动化')}
            </button>
          )}
          <button
            type="button"
            className={`hx-btn ${automation.killSwitch ? '' : 'ghost'}`}
            disabled={busy !== ''}
            onClick={() =>
              runAction(
                'kill-switch',
                () => cryptoAPI.setKillSwitch(!automation.killSwitch, 'ui toggle'),
                automation.killSwitch
                  ? t('Kill switch released', '紧急停止已解除')
                  : t('Kill switch engaged', '紧急停止已启用'),
              )
            }
          >
            {busy === 'kill-switch' ? <LoadingOutlined /> : <AlertOutlined />}{' '}
            {automation.killSwitch ? t('Release kill switch', '解除紧急停止') : t('Kill switch', '紧急停止')}
          </button>
          <span className="hx-muted">
            {t('Status', '状态')}: {String(automation.status || 'idle')} · {t('next run', '下次运行')}{' '}
            {shortTime(automation.nextRun || null)}
          </span>
        </div>
      </section>
    </>
  );

  const ledgerView = (
    <section className="hx-card">
      <div className="hx-tabs">
        {(
          [
            ['trades', t('Sim trades', '模拟成交')],
            ['decisions', t('Sim decisions', '模拟决策')],
            ['alpaca', t('Alpaca ledger', 'Alpaca 账本')],
          ] as Array<['trades' | 'decisions' | 'alpaca', string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`hx-tab ${ledgerTab === key ? 'active' : ''}`}
            onClick={() => setLedgerTab(key)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="hx-btn ghost small" onClick={loadLedger} disabled={ledgerLoading}>
          {ledgerLoading ? <LoadingOutlined /> : <ReloadOutlined />} {t('Refresh', '刷新')}
        </button>
      </div>
      {ledgerTab === 'trades' && <TradeTable trades={simTrades} zh={zh} />}
      {ledgerTab === 'decisions' && <DecisionList decisions={simDecisions} zh={zh} expandable />}
      {ledgerTab === 'alpaca' && (
        <div className="hx-ledger-list">
          {alpacaLedger.length === 0 && (
            <p className="hx-muted">
              {ledgerLoading
                ? t('Loading…', '加载中…')
                : t('No Alpaca ledger records.', '暂无 Alpaca 账本记录。')}
            </p>
          )}
          {alpacaLedger.map((record, index) => (
            <div className="hx-ledger-row" key={index}>
              <span className="hx-ledger-time">
                {shortTime(String(record.createdAt || record.created_at || ''))}
              </span>
              <span className="hx-ledger-type">
                {String(record.type || record.event_type || '—')}
              </span>
              <span>{String(record.symbol || '')}</span>
              <ActionChip action={String(record.action || '') || null} />
              <span className="hx-muted">
                {String(record.reason || record.message || '').slice(0, 140)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="hx-root">
      {header}
      <main className="hx-main">
        {view === 'command' && commandView}
        {view === 'lab' && labView}
        {view === 'sim' && simView}
        {view === 'ledger' && ledgerView}
      </main>
      <footer className="hx-footer">
        <CheckCircleOutlined />{' '}
        {t(
          'Paper trading only. Signals execute at completed bars with fees and slippage modeled; live routing stays behind explicit authorization.',
          '仅模拟交易。信号基于完整K线并计入手续费与滑点；实盘路由需显式授权。',
        )}
      </footer>
    </div>
  );
};

export default Crypto;
