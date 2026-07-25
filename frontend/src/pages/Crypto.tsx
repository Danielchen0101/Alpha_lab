import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import cryptoAPI, {
  CryptoAssetSnapshot,
  CryptoConfig,
  CryptoOverviewResponse,
} from '../services/cryptoApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import '../styles/Crypto.css';

type View = 'desk' | 'strategy' | 'automation' | 'ledger' | 'not-found';
type LedgerRecord = {
  id?: string;
  eventType?: string;
  symbol?: string;
  createdAt?: string;
  payload?: Record<string, any>;
};

const REFRESH_MS = 30_000;

const money = (value: unknown, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const pct = (value: unknown, alreadyPercent = false, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const normalized = alreadyPercent ? number : number * 100;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(digits)}%`;
};

const time = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const signedMoney = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '$0.00';
  return `${number > 0 ? '+' : number < 0 ? '-' : ''}$${money(Math.abs(number))}`;
};

const PnlTooltip: React.FC<any> = ({ active, payload, label, zh }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload || {};
  return <div className="cx-pnl-tooltip">
    <strong>{time(label)}</strong>
    <span>{zh ? '累计盈亏' : 'Cumulative P/L'} <b>{signedMoney(point.pnl)}</b></span>
    {!point.baseline && <>
      <span>{point.symbol} · {point.action}</span>
      <span>{zh ? '本次成交' : 'This fill'} <b>{signedMoney(point.tradePnl)}</b></span>
      <small>{zh ? '预估手续费' : 'Estimated fee'} ${money(point.fee)}</small>
    </>}
  </div>;
};

const valueOf = <T,>(response: any): T => (response?.data ?? response) as T;

const viewFor = (pathname: string): View => {
  if (pathname === '/crypto') return 'desk';
  if (pathname === '/crypto/strategy') return 'strategy';
  if (pathname === '/crypto/automation') return 'automation';
  if (pathname === '/crypto/ledger') return 'ledger';
  return 'not-found';
};

const regimeLabel = (regime: unknown, zh: boolean) => {
  const labels: Record<string, [string, string]> = {
    trend_up: ['Uptrend', '上升趋势'],
    trend_down: ['Downtrend', '下降趋势'],
    range: ['Range', '震荡区间'],
    panic: ['Risk-off', '风险规避'],
    insufficient_data: ['Warming up', '数据预热'],
    awaiting_data: ['Awaiting data', '等待数据'],
  };
  const pair = labels[String(regime)] || [String(regime || 'Awaiting data'), String(regime || '等待数据')];
  return zh ? pair[1] : pair[0];
};

const actionClass = (action: unknown) => `cx-action ${String(action || 'WAIT').toLowerCase()}`;

const Header: React.FC<{
  zh: boolean;
  mode: 'paper' | 'live';
  overview: CryptoOverviewResponse | null;
  loading: boolean;
  onRefresh: () => void;
}> = ({ zh, mode, overview, loading, onRefresh }) => {
  const active = Boolean(overview?.automation?.enabled);
  const healthy = !overview?.accountError && overview?.account?.configured;
  return (
    <header className="cx-header">
      <div>
        <div className="cx-eyebrow">CRYPTO · BTC / ETH · 24/7</div>
        <h1>{zh ? '数字资产交易台' : 'Crypto Trading Desk'}</h1>
        <p>
          {zh
            ? '确定性多周期策略、渐进式仓位管理与完整交易记录。'
            : 'Deterministic multi-horizon signals, progressive position management and durable trade records.'}
        </p>
      </div>
      <div className="cx-header-actions">
        <span className={`cx-status ${active ? 'running' : ''}`}>
          <i />
          {active ? (zh ? '自动交易运行中' : 'AUTOMATION RUNNING') : (zh ? '自动交易已停止' : 'AUTOMATION STOPPED')}
        </span>
        <span className={`cx-mode ${mode}`}>{mode === 'paper' ? 'PAPER' : 'LIVE'}</span>
        <button className="cx-icon-btn" type="button" onClick={onRefresh} aria-label="Refresh">
          {loading ? <LoadingOutlined /> : <ReloadOutlined />}
        </button>
        <span className={`cx-health ${healthy ? 'ok' : ''}`} title={healthy ? 'Broker ready' : 'Broker setup required'}>
          {healthy ? <CheckCircleOutlined /> : <AlertOutlined />}
        </span>
      </div>
    </header>
  );
};

const AssetCard: React.FC<{ asset: CryptoAssetSnapshot; zh: boolean }> = ({ asset, zh }) => {
  const detail = asset.signalDetail || {};
  const change = Number(asset.change24h);
  const action = detail.action || asset.signal || 'WAIT';
  return (
    <article className="cx-asset">
      <div className="cx-asset-head">
        <div className={`cx-coin ${asset.symbol.startsWith('BTC') ? 'btc' : 'eth'}`}>
          {asset.symbol.startsWith('BTC') ? '₿' : 'Ξ'}
        </div>
        <div>
          <h3>{asset.symbol}</h3>
          <span>{asset.name}</span>
        </div>
        <span className={actionClass(action)}>{action}</span>
      </div>
      <div className="cx-price">${money(asset.price, asset.symbol.startsWith('BTC') ? 0 : 2)}</div>
      <div className={`cx-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
        {pct(change, true, 2)} <span>24H</span>
      </div>
      <div className="cx-asset-grid">
        <div><span>{zh ? '市场状态' : 'Regime'}</span><strong>{regimeLabel(detail.regime || asset.regime, zh)}</strong></div>
        <div><span>{zh ? '置信度' : 'Confidence'}</span><strong>{money(detail.confidence ?? asset.confidence, 0)}</strong></div>
        <div><span>{zh ? '目标仓位' : 'Target weight'}</span><strong>{pct(detail.targetWeight)}</strong></div>
        <div><span>{zh ? '点差' : 'Spread'}</span><strong>{money(asset.spreadBps, 1)} bps</strong></div>
      </div>
      <div className={`cx-readiness ${asset.executionReady ? 'ready' : ''}`}>
        <i /> {asset.executionReady ? (zh ? '行情可执行' : 'Execution ready') : (zh ? '等待有效报价' : 'Waiting for valid quote')}
      </div>
      <p className="cx-reason">
        {(detail.reasons || [])[0]
          || (zh ? '下一根完整 15 分钟 K 线后重新评估。' : 'Re-evaluates after the next completed 15-minute bar.')}
      </p>
    </article>
  );
};

const PositionTable: React.FC<{ positions: Array<Record<string, any>>; zh: boolean }> = ({ positions, zh }) => (
  <div className="cx-table-wrap">
    <table className="cx-table">
      <thead><tr>
        <th>{zh ? '资产' : 'Asset'}</th><th>{zh ? '数量' : 'Quantity'}</th>
        <th>{zh ? '均价' : 'Avg. entry'}</th><th>{zh ? '市值' : 'Market value'}</th>
        <th>{zh ? '未实现盈亏' : 'Unrealized P/L'}</th>
      </tr></thead>
      <tbody>
        {positions.length === 0 && <tr><td colSpan={5} className="cx-empty">{zh ? '当前没有持仓' : 'No open crypto positions'}</td></tr>}
        {positions.map((row, index) => {
          const pnl = Number(row.unrealizedPnl ?? row.unrealized_pl);
          return <tr key={String(row.symbol || index)}>
            <td><strong>{row.symbol}</strong></td>
            <td>{money(row.qty, 6)}</td>
            <td>${money(row.avgEntryPrice ?? row.avg_entry_price)}</td>
            <td>${money(row.marketValue ?? row.market_value)}</td>
            <td className={pnl > 0 ? 'cx-positive' : pnl < 0 ? 'cx-negative' : ''}>${money(pnl)}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>
);

const Crypto: React.FC = () => {
  const { pathname } = useLocation();
  const view = viewFor(pathname);
  const { language } = useLanguage();
  const { tradeMode, tradeModeReady } = useTradeMode();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const zh = language === 'zh-CN';
  const mode: 'paper' | 'live' = tradeMode === 'real' ? 'live' : 'paper';
  const mounted = useRef(true);

  const [overview, setOverview] = useState<CryptoOverviewResponse | null>(null);
  const [config, setConfig] = useState<CryptoConfig | null>(null);
  const [ledger, setLedger] = useState<LedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!isAuthenticated || !tradeModeReady) return;
    if (!quiet) setLoading(true);
    try {
      const response = valueOf<CryptoOverviewResponse>(await cryptoAPI.overview(mode));
      if (!mounted.current) return;
      setOverview(response);
      setConfig((response.config || null) as CryptoConfig | null);
      setError(response.error || '');
    } catch (requestError: any) {
      if (mounted.current) setError(requestError?.response?.data?.message || requestError?.message || 'Crypto service unavailable');
    } finally {
      if (mounted.current && !quiet) setLoading(false);
    }
  }, [isAuthenticated, mode, tradeModeReady]);

  const loadLedger = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const result = valueOf<{ records?: LedgerRecord[] }>(await cryptoAPI.ledger(100));
      if (mounted.current) setLedger(result.records || []);
    } catch (requestError: any) {
      if (mounted.current) setError(requestError?.response?.data?.message || requestError?.message || 'Ledger unavailable');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    if (view === 'ledger') void loadLedger();
  }, [loadLedger, view]);

  const act = async (key: string, operation: () => Promise<any>, success: string) => {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try {
      await operation();
      setNotice(success);
      await load(true);
      if (view === 'ledger') await loadLedger();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Request failed');
    } finally {
      setBusy('');
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    await act('save', () => cryptoAPI.saveConfig({
      tradeHorizon: 'short',
      intervalMinutes: 15,
      symbols: ['BTC/USD', 'ETH/USD'],
      minimumConfidence: config.minimumConfidence,
      riskProfile: config.riskProfile,
      riskPerTradePct: config.riskPerTradePct,
      maxTotalExposure: config.maxTotalExposure,
      maxAssetExposurePct: config.maxAssetExposurePct,
      assetAllocationsPct: config.assetAllocationsPct,
      maxOrderNotional: config.maxOrderNotional,
      minOrderNotional: config.minOrderNotional,
      allowAdds: config.allowAdds,
      aiReviewEnabled: false,
      paperLearningEnabled: false,
      order: config.order,
    }), zh ? '策略参数已保存。' : 'Strategy mandate saved.');
  };

  const performance = (overview?.runtime?.cryptoPerformance || {}) as Record<string, any>;
  const pnlEvents = useMemo(() => {
    const curve = overview?.runtime?.cryptoPerformance;
    return (
      curve
      && typeof curve === 'object'
      && Array.isArray((curve as Record<string, any>).curve)
    ) ? (curve as Record<string, any>).curve : [];
  }, [overview?.runtime?.cryptoPerformance]);
  const pnlData = useMemo(() => {
    const points = pnlEvents.map((point: any) => ({
      ...point,
      time: new Date(point.time).getTime(),
      pnl: Number(point.value),
      tradePnl: Number(point.tradePnl),
      fee: Number(point.fee),
    })).filter((point: any) => Number.isFinite(point.time) && Number.isFinite(point.pnl));
    if (points.length) {
      return [{ time: points[0].time - 1, pnl: 0, baseline: true }, ...points];
    }
    const now = Date.now();
    return [
      { time: now - 60 * 60 * 1000, pnl: 0, baseline: true },
      { time: now, pnl: 0, baseline: true },
    ];
  }, [pnlEvents]);

  if (view === 'not-found') return <Navigate to="/crypto" replace />;
  if (authLoading || !tradeModeReady) return <div className="cx-page-state"><LoadingOutlined /></div>;
  if (!isAuthenticated) return <Navigate to="/signin?next=/crypto" replace />;

  const positions = (overview?.portfolio?.positions || []) as Array<Record<string, any>>;
  const realizedPnl = Number(performance.realizedPnl || 0);
  const unrealizedPnl = positions.reduce(
    (total, row) => total + Number(row.unrealizedPnl ?? row.unrealized_pl ?? 0),
    0,
  );
  const totalCryptoPnl = realizedPnl + unrealizedPnl;
  const closedTrades = Number(performance.closedTradeCount || 0);
  const wins = Number(performance.wins || 0);
  const active = Boolean(overview?.automation?.enabled);
  const runtime = overview?.runtime || {};
  const tradeRecords = ledger.filter((row) => row.eventType === 'crypto_trade_recorded');
  const decisionRecords = ledger.filter((row) => row.eventType === 'crypto_decision');

  const desk = <>
    <section className="cx-metrics">
      <div><span>{zh ? '账户净值' : 'Account equity'}</span><strong>${money(overview?.portfolio?.equity, 0)}</strong></div>
      <div><span>{zh ? '数字资产敞口' : 'Crypto exposure'}</span><strong>{money(overview?.portfolio?.exposurePct, 1)}%</strong></div>
      <div><span>{zh ? '今日盈亏' : 'Day P/L'}</span><strong className={Number(overview?.portfolio?.dayPnl) >= 0 ? 'cx-positive' : 'cx-negative'}>${money(overview?.portfolio?.dayPnl)}</strong></div>
      <div><span>{zh ? '可用购买力' : 'Buying power'}</span><strong>${money(overview?.account?.nonMarginableBuyingPower, 0)}</strong></div>
    </section>
    <section className="cx-assets">{(overview?.assets || []).map((asset) => <AssetCard key={asset.symbol} asset={asset} zh={zh} />)}</section>
    <section className="cx-grid-main">
      <article className="cx-panel cx-chart-panel">
        <div className="cx-panel-head"><div><span className="cx-kicker">{zh ? '交易表现' : 'TRADING PERFORMANCE'}</span><h2>{zh ? 'Crypto 累计盈亏' : 'Crypto cumulative P/L'}</h2></div><span>{zh ? '从 $0 开始 · 每次成交一个数据点' : 'Starts at $0 · one point per fill'}</span></div>
        <div className="cx-pnl-summary">
          <div><span>{zh ? '当前总盈亏' : 'Current total P/L'}</span><strong className={totalCryptoPnl >= 0 ? 'cx-positive' : 'cx-negative'}>{signedMoney(totalCryptoPnl)}</strong></div>
          <div><span>{zh ? '已实现' : 'Realized'}</span><b>{signedMoney(realizedPnl)}</b></div>
          <div><span>{zh ? '持仓浮动' : 'Open unrealized'}</span><b>{signedMoney(unrealizedPnl)}</b></div>
          <div><span>{zh ? '平仓胜率' : 'Closed-fill win rate'}</span><b>{closedTrades ? `${money(wins / closedTrades * 100, 1)}%` : '—'}</b></div>
        </div>
        <div className="cx-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={pnlData}>
          <defs><linearGradient id="cxPnl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2c6bed" stopOpacity={0.24}/><stop offset="100%" stopColor="#2c6bed" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="rgba(120,130,145,.16)"/>
          <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(value) => new Date(value).toLocaleDateString()} tickLine={false} axisLine={false}/>
          <YAxis domain={['auto', 'auto']} tickFormatter={(value) => signedMoney(value)} tickLine={false} axisLine={false} width={74}/>
          <ReferenceLine y={0} stroke="rgba(120,130,145,.5)" strokeDasharray="4 4"/>
          <Tooltip content={<PnlTooltip zh={zh}/>}/>
          <Area type="linear" dataKey="pnl" stroke="#2c6bed" strokeWidth={2} fill="url(#cxPnl)" dot={pnlEvents.length ? { r: 3, fill: '#2c6bed', strokeWidth: 0 } : false}/>
        </AreaChart></ResponsiveContainer></div>
        {!pnlEvents.length && <div className="cx-pnl-empty">{zh ? '第一笔成交后，这里会从 $0 开始记录每次收益。' : 'After the first fill, every result will be plotted from a $0 baseline.'}</div>}
      </article>
      <article className="cx-panel">
        <div className="cx-panel-head"><div><span className="cx-kicker">{zh ? '系统状态' : 'SYSTEM'}</span><h2>{zh ? '执行健康度' : 'Execution health'}</h2></div></div>
        <div className="cx-health-list">
          <div><CheckCircleOutlined /><span>{zh ? '运行频率' : 'Decision cadence'}</span><strong>15 min</strong></div>
          <div><CheckCircleOutlined /><span>{zh ? '交易资产' : 'Trading universe'}</span><strong>BTC · ETH</strong></div>
          <div><CheckCircleOutlined /><span>{zh ? '决策模型' : 'Decision model'}</span><strong>{zh ? '确定性 / 无 AI' : 'Deterministic / no AI'}</strong></div>
          <div className={overview?.account?.configured ? '' : 'warn'}><SafetyCertificateOutlined /><span>{zh ? '经纪商连接' : 'Broker connection'}</span><strong>{overview?.account?.configured ? (zh ? '已配置' : 'Ready') : (zh ? '需要配置' : 'Setup required')}</strong></div>
        </div>
      </article>
    </section>
    <section className="cx-panel">
      <div className="cx-panel-head"><div><span className="cx-kicker">{zh ? '实时持仓' : 'LIVE BOOK'}</span><h2>{zh ? '当前持仓' : 'Open positions'}</h2></div></div>
      <PositionTable positions={positions} zh={zh} />
    </section>
  </>;

  const strategy = <section className="cx-strategy-layout">
    <div className="cx-panel">
      <div className="cx-panel-head"><div><span className="cx-kicker">EXECUTION MANDATE</span><h2>{zh ? '策略与风险参数' : 'Strategy & risk mandate'}</h2></div><span>{zh ? 'BTC / ETH · 15 分钟' : 'BTC / ETH · 15 minute'}</span></div>
      <div className="cx-form-grid">
        <label><span>{zh ? '最低置信度' : 'Minimum confidence'} <b>{money(config?.minimumConfidence, 0)}</b></span>
          <input type="range" min="50" max="65" step="1" value={config?.minimumConfidence ?? 52} onChange={(e) => setConfig((old) => old ? { ...old, minimumConfidence: Number(e.target.value) } : old)} /></label>
        <label><span>{zh ? '总敞口上限' : 'Total exposure cap'} <b>{pct(config?.maxTotalExposure)}</b></span>
          <input type="range" min="0.10" max="0.50" step="0.01" value={config?.maxTotalExposure ?? .30} onChange={(e) => setConfig((old) => old ? { ...old, maxTotalExposure: Number(e.target.value) } : old)} /></label>
        <label><span>{zh ? '单笔风险预算' : 'Risk budget / trade'} <b>{money(config?.riskPerTradePct, 2)}%</b></span>
          <input type="range" min="0.10" max="0.75" step="0.05" value={config?.riskPerTradePct ?? .25} onChange={(e) => setConfig((old) => old ? { ...old, riskPerTradePct: Number(e.target.value) } : old)} /></label>
        <label><span>{zh ? '单笔订单上限' : 'Max order notional'} <b>${money(config?.maxOrderNotional, 0)}</b></span>
          <input type="number" min="10" max="200000" value={config?.maxOrderNotional ?? 1000} onChange={(e) => setConfig((old) => old ? { ...old, maxOrderNotional: Number(e.target.value) } : old)} /></label>
        {['BTC/USD', 'ETH/USD'].map((symbol) => <label key={symbol}><span>{symbol} {zh ? '目标上限' : 'allocation cap'} <b>{money(config?.assetAllocationsPct?.[symbol], 0)}%</b></span>
          <input type="range" min="3" max={config?.maxAssetExposurePct ?? 18} step="1" value={config?.assetAllocationsPct?.[symbol] ?? (symbol.startsWith('BTC') ? 18 : 12)} onChange={(e) => setConfig((old) => old ? { ...old, assetAllocationsPct: { ...old.assetAllocationsPct, [symbol]: Number(e.target.value) } } : old)} /></label>)}
        <label className="cx-check"><input type="checkbox" checked={config?.allowAdds ?? true} onChange={(e) => setConfig((old) => old ? { ...old, allowAdds: e.target.checked } : old)} /><span>{zh ? '允许顺势加仓' : 'Allow trend-confirmed adds'}</span></label>
      </div>
      <button className="cx-primary" type="button" disabled={!config || busy === 'save'} onClick={() => void saveConfig()}>{busy === 'save' ? <LoadingOutlined /> : <SafetyCertificateOutlined />} {zh ? '保存策略' : 'Save mandate'}</button>
    </div>
    <aside className="cx-panel cx-rules">
      <span className="cx-kicker">DECISION STANDARD</span>
      <h2>{zh ? '机器人如何交易' : 'How the robot trades'}</h2>
      {[
        [zh ? '入场' : 'ENTRY', zh ? '完整 15 分钟 K 线使用 1 小时、3 小时和 12 小时动量，配合快速 EMA、短通道突破或震荡低吸；评分、报价和流动性同时合格才入场。' : 'Completed 15-minute bars combine 1h, 3h and 12h momentum with fast EMAs, short-channel breakouts or range dips; score, quote and liquidity gates must all pass.'],
        [zh ? '加仓' : 'ADD', zh ? '仅在已有盈利仓位、快速上升趋势与 3 小时突破同时确认，且价格比上次买入至少上涨 0.35% 时增加。' : 'Only into a profitable position when the fast uptrend and 3-hour breakout agree and price is at least 0.35% above the last add.'],
        [zh ? '减仓' : 'REDUCE', zh ? '置信度下降、波动过高或震荡区超买时，先降低到目标仓位的约一半，而不是一次性清仓。' : 'When conviction weakens, volatility expands or a range becomes overbought, exposure steps down toward half-size instead of liquidating everything.'],
        [zh ? '平仓' : 'EXIT', zh ? '趋势与动量共同转负、跌破结构、触发追踪止损、恐慌状态或资本保护线时退出。' : 'Exit when trend and momentum turn negative together, structure breaks, the trailing stop closes through, panic regime appears or a capital circuit fires.'],
      ].map(([title, copy], index) => <div className="cx-rule" key={title}><b>0{index + 1}</b><div><h3>{title}</h3><p>{copy}</p></div></div>)}
      <div className="cx-note"><SafetyCertificateOutlined />{zh ? '回测已保留为独立研究工具，不再放在日常交易页面，也不会直接修改线上策略。' : 'Backtesting remains an offline research tool. It is no longer mixed into the live workspace and cannot directly alter production.'}</div>
    </aside>
  </section>;

  const automation = <section className="cx-automation-layout">
    <article className={`cx-panel cx-automation-hero ${active ? 'active' : ''}`}>
      <div className="cx-orbit"><ThunderboltOutlined /></div>
      <span className="cx-kicker">{mode.toUpperCase()} · 24/7 AUTOPILOT</span>
      <h2>{active ? (zh ? '自动交易正在运行' : 'Automation is running') : (zh ? '自动交易等待启动' : 'Automation is standing by')}</h2>
      <p>{zh ? '每根完整的 15 分钟 K 线评估 BTC 与 ETH；服务端调度器持续运行，页面关闭后不会停止。' : 'BTC and ETH are evaluated after every completed 15-minute bar. The server scheduler continues when this page is closed.'}</p>
      <div className="cx-automation-actions">
        {active
          ? <button className="cx-danger" type="button" onClick={() => void act('stop', () => cryptoAPI.stopAutomation(), zh ? '自动交易已停止。' : 'Automation stopped.')} disabled={Boolean(busy)}>{busy === 'stop' ? <LoadingOutlined /> : <PauseCircleOutlined />} {zh ? '停止自动交易' : 'Stop automation'}</button>
          : <button className="cx-primary" type="button" onClick={() => void act('start', () => cryptoAPI.startAutomation(mode, mode === 'live'), zh ? '自动交易已启动。' : 'Automation started.')} disabled={Boolean(busy) || !overview?.account?.configured}>{busy === 'start' ? <LoadingOutlined /> : <PlayCircleOutlined />} {zh ? '启动 24/7 自动交易' : 'Start 24/7 automation'}</button>}
        <button className="cx-secondary" type="button" onClick={() => void act('cycle', () => cryptoAPI.runCycle(mode, false), zh ? '决策周期已完成。' : 'Decision cycle completed.')} disabled={Boolean(busy) || !overview?.account?.configured}>{busy === 'cycle' ? <LoadingOutlined /> : <ThunderboltOutlined />} {zh ? '立即运行一次' : 'Run one cycle now'}</button>
      </div>
    </article>
    <article className="cx-panel">
      <div className="cx-panel-head"><div><span className="cx-kicker">SCHEDULER</span><h2>{zh ? '运行状态' : 'Runtime status'}</h2></div></div>
      <div className="cx-runtime-grid">
        <div><ClockCircleOutlined /><span>{zh ? '上次运行' : 'Last run'}</span><strong>{time(overview?.automation?.lastRun)}</strong></div>
        <div><ClockCircleOutlined /><span>{zh ? '下次运行' : 'Next run'}</span><strong>{time(overview?.automation?.nextRun)}</strong></div>
        <div><HistoryOutlined /><span>{zh ? '上次耗时' : 'Last duration'}</span><strong>{money(runtime.lastDurationMs, 0)} ms</strong></div>
        <div><SafetyCertificateOutlined /><span>{zh ? '连续错误' : 'Consecutive errors'}</span><strong>{money(runtime.consecutiveErrors, 0)}</strong></div>
      </div>
      <div className="cx-operational-note"><CheckCircleOutlined /><div><strong>{zh ? '线上持续性' : 'Online continuity'}</strong><p>{zh ? '配置、运行状态、决策与每笔订单都写入 Supabase；成交状态由 Alpaca 对账。' : 'Config, runtime, decisions and every routed order are persisted to Supabase; broker fills are reconciled with Alpaca.'}</p></div></div>
    </article>
  </section>;

  const ledgerView = <section className="cx-panel">
    <div className="cx-panel-head">
      <div><span className="cx-kicker">PORTFOLIO RECORDS</span><h2>{zh ? '交易与决策记录' : 'Trade & decision records'}</h2></div>
      <button className="cx-secondary compact" type="button" onClick={() => void loadLedger()}>{loading ? <LoadingOutlined /> : <ReloadOutlined />} {zh ? '刷新' : 'Refresh'}</button>
    </div>
    <div className="cx-ledger-summary">
      <div><strong>{tradeRecords.length}</strong><span>{zh ? '路由交易' : 'Routed trades'}</span></div>
      <div><strong>{decisionRecords.length}</strong><span>{zh ? '策略决策' : 'Strategy decisions'}</span></div>
      <div><strong>{ledger.length}</strong><span>{zh ? '审计事件' : 'Audit events'}</span></div>
    </div>
    <div className="cx-table-wrap">
      <table className="cx-table cx-ledger-table"><thead><tr>
        <th>{zh ? '时间' : 'Time'}</th><th>{zh ? '资产' : 'Asset'}</th><th>{zh ? '事件' : 'Event'}</th>
        <th>{zh ? '动作' : 'Action'}</th><th>{zh ? '状态' : 'Status'}</th><th>{zh ? '成交/信号价格' : 'Fill / signal price'}</th>
        <th>{zh ? '置信度' : 'Confidence'}</th><th>{zh ? '市场状态' : 'Regime'}</th>
      </tr></thead><tbody>
        {ledger.length === 0 && <tr><td colSpan={8} className="cx-empty">{loading ? (zh ? '正在加载…' : 'Loading…') : (zh ? '暂无记录，启动 Paper 自动交易后会开始积累。' : 'No records yet. Start Paper automation to begin collecting data.')}</td></tr>}
        {ledger.map((row, index) => {
          const payload = row.payload || {};
          const order = payload.brokerOrder || payload.order || {};
          const action = payload.action || order.side || '—';
          return <tr key={row.id || index}>
            <td>{time(row.createdAt || payload.submittedAt || payload.timestamp)}</td>
            <td><strong>{row.symbol || payload.symbol || '—'}</strong></td>
            <td>{String(row.eventType || 'event').replace(/^crypto_/, '').replace(/_/g, ' ')}</td>
            <td><span className={actionClass(action)}>{String(action).toUpperCase()}</span></td>
            <td>{payload.status || order.status || '—'}</td>
            <td>${money(payload.filledAveragePrice || payload.signalPrice || payload.price)}</td>
            <td>{money(payload.confidence ?? payload.score, 0)}</td>
            <td>{regimeLabel(payload.regime, zh)}</td>
          </tr>;
        })}
      </tbody></table>
    </div>
  </section>;

  return <main className="cx-root">
    <Header zh={zh} mode={mode} overview={overview} loading={loading} onRefresh={() => void load()} />
    {error && <div className="cx-banner error"><AlertOutlined />{error}</div>}
    {notice && <div className="cx-banner success"><CheckCircleOutlined />{notice}</div>}
    {loading && !overview ? <div className="cx-page-state"><LoadingOutlined /><span>{zh ? '正在连接 Crypto 服务…' : 'Connecting to crypto services…'}</span></div> : <>
      {view === 'desk' && desk}
      {view === 'strategy' && strategy}
      {view === 'automation' && automation}
      {view === 'ledger' && ledgerView}
    </>}
  </main>;
};

export default Crypto;
