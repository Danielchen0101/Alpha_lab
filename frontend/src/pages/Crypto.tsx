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
  CryptoDecision,
  CryptoLedgerRecord,
  CryptoLedgerResponse,
  CryptoMode,
  CryptoOverviewResponse,
  CryptoPosition,
  CryptoRuntime,
} from '../services/cryptoApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/Crypto.css';

type View = 'desk' | 'strategy' | 'automation' | 'ledger' | 'not-found';
type LedgerCategory = 'all' | 'trade' | 'decision' | 'system';
type HealthTone = 'healthy' | 'working' | 'standby' | 'warning' | 'blocked';
type Dictionary = Record<string, unknown>;

type SchedulerHealth = {
  tone: HealthTone;
  label: string;
  detail: string;
  heartbeatAt: unknown;
  heartbeatAge: number | null;
  staleAfter: number;
};

type ExecutionEvidence = {
  tradesPerWeek: number | null;
  averageHoldingHours: number | null;
  medianHoldingHours: number | null;
  costToGrossProfit: number | null;
};

type NormalizedLedgerRow = {
  raw: CryptoLedgerRecord;
  category: Exclude<LedgerCategory, 'all'>;
  event: string;
  timestamp: unknown;
  symbol: string;
  action: string;
  status: string;
  source: string;
  qty: number | null;
  price: number | null;
  grossNotional: number | null;
  netNotional: number | null;
  fee: number | null;
  realizedPnl: number | null;
  netPnl: number | null;
  positionBefore: unknown;
  positionAfter: unknown;
  weights: boolean;
  reason: string;
};

const REFRESH_MS = 30_000;

const objectOf = (value: unknown): Dictionary => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Dictionary : {}
);

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : '';
    if (text) return text;
  }
  return '';
};

const unwrapApiBody = (value: unknown): Dictionary => {
  const envelope = objectOf(value);
  const data = objectOf(envelope.data);
  return Object.keys(data).length ? data : envelope;
};

const lifecycleErrorMessage = (
  requestError: unknown,
  action: 'start' | 'stop',
  zh: boolean,
) => {
  const details = objectOf(requestError);
  const response = objectOf(details.response);
  const data = objectOf(response.data);
  const statusCode = numberOf(response.status);
  const status = firstText(
    data.reason,
    data.status,
    data.code,
    data.errorCode,
  ).toLowerCase();
  const schedulerUnavailable = statusCode === 503
    || status === 'service_unavailable'
    || status === 'scheduler_unavailable';

  if (action === 'start' && schedulerUnavailable) {
    return zh
      ? '24/7 自动交易暂时无法启动：服务端调度器正在切换或暂不可用。已重新核对当前状态，请稍后重试。'
      : '24/7 automation could not be started because the server scheduler is switching or temporarily unavailable. The current state was rechecked; please try again shortly.';
  }

  return firstText(
    data.message,
    details.message,
    action === 'start'
      ? (zh ? '24/7 自动交易启动失败。' : 'Failed to start 24/7 automation.')
      : (zh ? '自动交易停止失败。' : 'Failed to stop automation.'),
  );
};

const stringList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map((item) => firstText(item)).filter(Boolean)
    : []
);

const normalizedSymbol = (value: unknown) => firstText(value).toUpperCase();

const uniqueSymbols = (...groups: unknown[]): string[] => {
  const seen = new Set<string>();
  const symbols: string[] = [];
  groups.forEach((group) => {
    stringList(group).forEach((symbol) => {
      const normalized = normalizedSymbol(symbol);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      symbols.push(normalized);
    });
  });
  return symbols;
};

const baseAsset = (symbol: unknown) => normalizedSymbol(symbol).split('/')[0] || 'ASSET';

const assetIdentity = (symbol: unknown) => {
  const base = baseAsset(symbol);
  if (base === 'BTC') return { className: 'btc', mark: '₿', name: 'Bitcoin' };
  if (base === 'ETH') return { className: 'eth', mark: 'Ξ', name: 'Ethereum' };
  if (base === 'SOL') return { className: 'sol', mark: '◎', name: 'Solana' };
  return { className: 'generic', mark: base.slice(0, 2), name: base };
};

const priceDigits = (value: unknown) => {
  const price = numberOf(value);
  if (price === null) return 2;
  if (Math.abs(price) >= 1_000) return 0;
  if (Math.abs(price) >= 1) return 2;
  return 6;
};

const money = (value: unknown, digits = 2) => {
  const number = numberOf(value);
  if (number === null) return '—';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const signedMoney = (value: unknown) => {
  const number = numberOf(value);
  if (number === null) return '—';
  return `${number > 0 ? '+' : number < 0 ? '-' : ''}$${money(Math.abs(number))}`;
};

const ratioPct = (value: unknown, signed = false, digits = 1) => {
  const number = numberOf(value);
  if (number === null) return '—';
  const normalized = number * 100;
  return `${signed && normalized > 0 ? '+' : ''}${normalized.toFixed(digits)}%`;
};

const plainPct = (value: unknown, signed = false, digits = 1) => {
  const number = numberOf(value);
  if (number === null) return '—';
  return `${signed && number > 0 ? '+' : ''}${number.toFixed(digits)}%`;
};

const flexiblePct = (value: unknown, digits = 1) => {
  const number = numberOf(value);
  if (number === null) return '—';
  return Math.abs(number) <= 1 ? ratioPct(number, false, digits) : plainPct(number, false, digits);
};

const formatTime = (value: unknown, zh: boolean, withSeconds = false) => {
  if (!value) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(zh ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
  });
};

const ageSeconds = (value: unknown): number | null => {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 1000) : null;
};

const durationLabel = (seconds: unknown, zh: boolean) => {
  const value = numberOf(seconds);
  if (value === null) return zh ? '等待心跳' : 'Awaiting heartbeat';
  if (value < 10) return zh ? '刚刚' : 'just now';
  if (value < 60) return zh ? `${Math.floor(value)} 秒前` : `${Math.floor(value)}s ago`;
  if (value < 3600) return zh ? `${Math.floor(value / 60)} 分钟前` : `${Math.floor(value / 60)}m ago`;
  return zh ? `${Math.floor(value / 3600)} 小时前` : `${Math.floor(value / 3600)}h ago`;
};

const humanize = (value: unknown) => firstText(value)
  .replace(/^crypto_/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase()) || '—';

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
    range: ['Range', '区间震荡'],
    panic: ['Risk-off', '风险规避'],
    insufficient_data: ['Warming up', '数据预热'],
    awaiting_data: ['Awaiting data', '等待数据'],
    unknown: ['Unknown', '未知'],
  };
  const key = firstText(regime).toLowerCase();
  const pair = labels[key] || [humanize(key || 'unknown'), humanize(key || 'unknown')];
  return zh ? pair[1] : pair[0];
};

const actionClass = (action: unknown) => `cx-action ${firstText(action, 'WAIT').toLowerCase()}`;

const stageLabel = (stage: unknown, zh: boolean) => {
  const labels: Record<string, [string, string]> = {
    idle: ['Idle', '空闲'],
    stopped: ['Stopped', '已停止'],
    standby: ['Standby', '待机'],
    armed: ['Armed', '已就绪'],
    starting: ['Starting', '启动中'],
    loading_account: ['Loading account', '读取账户'],
    loading_market_data: ['Loading market data', '读取行情'],
    evaluating: ['Evaluating signals', '评估信号'],
    routing_orders: ['Routing orders', '路由订单'],
    reconciling: ['Reconciling fills', '成交对账'],
    reconciliation_required: ['Reconciliation required', '需要成交对账'],
    complete: ['Cycle complete', '周期完成'],
    completed: ['Cycle complete', '周期完成'],
    interrupted: ['Cycle interrupted', '周期已中断'],
    killed: ['Emergency stop', '紧急停止'],
    error: ['Cycle error', '周期错误'],
  };
  const key = firstText(stage, 'idle').toLowerCase();
  const pair = labels[key] || [humanize(key), humanize(key)];
  return zh ? pair[1] : pair[0];
};

const recoveryLabel = (state: unknown, zh: boolean) => {
  const labels: Record<string, [string, string]> = {
    normal: ['Normal', '正常'],
    steady: ['Steady', '稳定'],
    idle: ['Idle', '空闲'],
    standby: ['Standby', '待机'],
    disabled: ['Disabled', '已禁用'],
    stopped: ['Stopped', '已停止'],
    stale: ['Stale', '心跳过期'],
    recovering: ['Recovering', '恢复中'],
    degraded: ['Degraded', '性能下降'],
  };
  const key = firstText(state, 'normal').toLowerCase();
  const pair = labels[key] || [humanize(key), humanize(key)];
  return zh ? pair[1] : pair[0];
};

const runtimeMessage = (
  runtime: CryptoRuntime,
  fallback: string,
  zh: boolean,
) => {
  if (!zh) return firstText(runtime.message, fallback);
  const stage = firstText(runtime.currentStage, runtime.status).toLowerCase();
  const localized: Record<string, string> = {
    idle: '当前空闲，等待下一个交易周期。',
    stopped: 'Crypto 自动交易已停止。',
    standby: '调度器处于待机状态，主节点仍可接受控制命令。',
    armed: 'Crypto 自动交易已启动，正在等待下一个交易周期。',
    starting: '正在启动交易周期。',
    complete: '最近一个交易周期已完成。',
    completed: '最近一个交易周期已完成。',
  };
  return localized[stage] || firstText(runtime.message, fallback);
};

const sourceLabel = (source: unknown, zh: boolean) => {
  const key = firstText(source, 'system').toLowerCase();
  const labels: Record<string, [string, string]> = {
    scheduler: ['Scheduler', '服务端调度'],
    manual: ['Manual', '手动触发'],
    system: ['System', '系统'],
    broker: ['Broker', '经纪商'],
    reconciliation: ['Reconciliation', '成交对账'],
  };
  const pair = labels[key] || [humanize(key), humanize(key)];
  return zh ? pair[1] : pair[0];
};

const schedulerHealth = (
  overview: CryptoOverviewResponse | null,
  runtime: CryptoRuntime,
  zh: boolean,
): SchedulerHealth => {
  const automation = overview?.automation || {};
  const heartbeatAt = runtime.lastHeartbeat || runtime.heartbeat || automation.lastRun;
  const heartbeatAge = numberOf(runtime.heartbeatAgeSeconds) ?? ageSeconds(heartbeatAt);
  const intervalMinutes = numberOf(automation.intervalMinutes, overview?.config?.intervalMinutes) ?? 15;
  const staleAfter = numberOf(runtime.staleAfterSeconds)
    ?? Math.max(180, intervalMinutes * 120 + 60);
  const active = Boolean(automation.enabled);
  const status = firstText(automation.status, runtime.status).toLowerCase();
  const consecutiveErrors = numberOf(runtime.consecutiveErrors);
  const reconciliation = Boolean(runtime.reconciliationRequired);
  const blocked = Boolean(automation.killSwitch || runtime.killSwitch || automation.locked || runtime.locked);

  if (reconciliation) {
    return {
      tone: 'blocked',
      label: zh ? '需要人工对账' : 'Reconciliation required',
      detail: zh ? '订单状态未完成闭环，已阻止新交易' : 'New orders are blocked until broker state is reconciled',
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  if (blocked) {
    return {
      tone: 'blocked',
      label: zh ? '交易已锁定' : 'Trading locked',
      detail: automation.killSwitch || runtime.killSwitch
        ? (zh ? '紧急停止开关已开启' : 'Kill switch is active')
        : (zh ? '运行时安全锁已开启' : 'Runtime safety lock is active'),
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  if (!active) {
    return {
      tone: 'standby',
      label: zh ? '自动交易待机' : 'Automation on standby',
      detail: zh ? '服务可用，尚未启用持续调度' : 'Service available; continuous scheduling is not enabled',
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  if (status === 'error' || (consecutiveErrors !== null && consecutiveErrors > 0)) {
    return {
      tone: 'warning',
      label: zh ? '运行异常' : 'Runtime degraded',
      detail: firstText(runtime.lastError, zh ? '最近周期出现错误' : 'The latest cycle reported an error'),
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  if (heartbeatAge !== null && heartbeatAge > staleAfter) {
    return {
      tone: 'warning',
      label: zh ? '心跳已过期' : 'Heartbeat stale',
      detail: zh ? '调度仍标记运行，但后端心跳超过安全窗口' : 'Scheduler is enabled but its heartbeat exceeded the safe window',
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  const cycleProgress = numberOf(runtime.progress) ?? 0;
  if (status === 'running' || (cycleProgress > 0 && cycleProgress < 100)) {
    return {
      tone: 'working',
      label: zh ? '交易周期执行中' : 'Trading cycle in progress',
      detail: stageLabel(runtime.currentStage, zh),
      heartbeatAt,
      heartbeatAge,
      staleAfter,
    };
  }
  return {
    tone: 'healthy',
    label: zh ? '24/7 调度健康' : '24/7 scheduler healthy',
    detail: zh ? '服务端调度已启用，页面关闭后继续运行' : 'Server scheduling stays active when this page is closed',
    heartbeatAt,
    heartbeatAge,
    staleAfter,
  };
};

const decisionOutcome = (decision: CryptoDecision) => {
  const action = firstText(decision.action, 'WAIT').toUpperCase();
  const order = objectOf(decision.order);
  const entryGate = objectOf(decision.entryGate);
  const riskGate = objectOf(decision.persistentRiskGate);
  const routed = decision.executed === true
    || Boolean(firstText(order.id, order.orderId, order.client_order_id, order.clientOrderId, order.status));
  const rejected = entryGate.eligible === false
    || riskGate.eligible === false
    || (!routed && ['BUY', 'ADD', 'REDUCE', 'EXIT', 'SELL'].includes(action));
  if (decision.dryRun) return 'simulated';
  if (routed) return 'routed';
  if (rejected) return 'rejected';
  return 'no-order';
};

const decisionReason = (decision: CryptoDecision, zh: boolean) => {
  const entryGate = objectOf(decision.entryGate);
  const riskGate = objectOf(decision.persistentRiskGate);
  const reason = firstText(decision.reason, stringList(decision.reasons)[0]);
  const gates = [
    ...stringList(entryGate.reasons),
    ...stringList(riskGate.reasons),
  ];
  if (reason) return reason;
  if (gates.length) return gates.map(humanize).join(' · ');
  return zh
    ? '等待下一根完整 K 线，尚未产生可执行信号。'
    : 'Waiting for the next completed bar; no executable signal yet.';
};

const outcomeLabel = (outcome: string, zh: boolean) => {
  const labels: Record<string, [string, string]> = {
    routed: ['Order routed', '订单已路由'],
    rejected: ['Order rejected', '拒绝下单'],
    simulated: ['Dry run', '仅演练'],
    'no-order': ['No order', '未下单'],
  };
  const pair = labels[outcome] || labels['no-order'];
  return zh ? pair[1] : pair[0];
};

const normalizeLedgerRow = (row: CryptoLedgerRecord): NormalizedLedgerRow => {
  const payload = objectOf(row.payload);
  const order = objectOf(payload.brokerOrder || payload.order);
  const performance = objectOf(payload.tradePerformance);
  const event = firstText(row.eventType, 'crypto_system_event');
  const category: NormalizedLedgerRow['category'] = /decision/i.test(event)
    ? 'decision'
    : /(trade|order|fill)/i.test(event) ? 'trade' : 'system';
  const action = firstText(payload.action, payload.side, order.side, category === 'system' ? 'EVENT' : 'WAIT').toUpperCase();
  const qty = numberOf(
    payload.filledQty,
    payload.qty,
    payload.requestedQty,
    order.filled_qty,
    order.filledQty,
    order.qty,
  );
  const price = numberOf(
    payload.filledAveragePrice,
    payload.fillPrice,
    payload.price,
    payload.signalPrice,
    order.filled_avg_price,
    order.filledAveragePrice,
    order.limit_price,
  );
  const grossNotional = numberOf(
    payload.grossNotional,
    payload.filledNotional,
    payload.requestedNotional,
    order.notional,
  ) ?? (qty !== null && price !== null ? qty * price : null);
  const fee = numberOf(
    payload.fee,
    payload.estimatedFee,
    payload.estimatedFees,
    performance.fee,
    performance.estimatedFee,
  );
  const realizedPnl = numberOf(
    payload.realizedPnl,
    payload.tradePnl,
    performance.realizedPnl,
    performance.tradePnl,
  );
  const explicitNet = numberOf(payload.netPnl, payload.netResult, payload.netProfit, performance.netPnl);
  const netPnl = explicitNet ?? (
    realizedPnl !== null ? realizedPnl - (fee ?? 0) : null
  );
  const directBefore = payload.positionBefore ?? performance.positionBefore;
  const directAfter = payload.positionAfter ?? performance.positionAfter;
  const weights = directBefore === undefined && directAfter === undefined
    && (payload.currentWeight !== undefined || payload.targetWeight !== undefined);

  return {
    raw: row,
    category,
    event,
    timestamp: row.createdAt
      || payload.filledAt
      || payload.submittedAt
      || payload.recordedAt
      || payload.timestamp,
    symbol: firstText(row.symbol, payload.symbol, order.symbol, '—'),
    action,
    status: firstText(payload.status, order.status, category === 'decision' ? decisionOutcome(payload as CryptoDecision) : 'recorded'),
    source: firstText(payload.source, row.source, row.actor, 'system'),
    qty,
    price,
    grossNotional,
    netNotional: numberOf(payload.netNotional, performance.netNotional),
    fee,
    realizedPnl,
    netPnl,
    positionBefore: directBefore ?? payload.currentWeight,
    positionAfter: directAfter ?? payload.targetWeight,
    weights,
    reason: firstText(payload.reason, stringList(payload.reasons)[0], payload.message, payload.error),
  };
};

const positionValue = (value: unknown, weights: boolean) => {
  if (value === null || value === undefined || value === '') return '—';
  const record = objectOf(value);
  const qty = numberOf(record.qty, record.quantity, record.positionQty);
  if (qty !== null) return money(qty, 6);
  const weight = numberOf(record.weight, record.positionWeight);
  if (weight !== null) return ratioPct(weight);
  const marketValue = numberOf(record.marketValue, record.notional);
  if (marketValue !== null) return `$${money(marketValue)}`;
  const number = numberOf(value);
  if (number !== null) return weights ? ratioPct(number) : money(number, 6);
  return firstText(value, '—');
};

const PnlTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: Dictionary }>;
  label?: unknown;
  zh: boolean;
}> = ({ active, payload, label, zh }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload || {};
  return <div className="cx-pnl-tooltip">
    <strong>{formatTime(label, zh)}</strong>
    <span>{zh ? '累计已实现' : 'Cumulative realized'} <b>{signedMoney(point.pnl)}</b></span>
    {!point.baseline && <>
      <span>{firstText(point.symbol, 'CRYPTO')} · {firstText(point.action, 'FILL')}</span>
      <span>{zh ? '本次净结果' : 'Net fill result'} <b>{signedMoney(point.tradePnl)}</b></span>
      <small>{zh ? '费用' : 'Fee'} ${money(point.fee)}</small>
    </>}
  </div>;
};

const Header: React.FC<{
  zh: boolean;
  mode: CryptoMode;
  health: SchedulerHealth;
  loading: boolean;
  symbols: string[];
  onRefresh: () => void;
}> = ({ zh, mode, health, loading, symbols, onRefresh }) => (
  <header className="cx-header">
    <div>
      <div className="cx-eyebrow">
        CRYPTO OPERATIONS · {symbols.length ? symbols.map(baseAsset).join(' / ') : 'CONFIGURED UNIVERSE'} · 24/7
      </div>
      <h1>{zh ? '数字资产交易台' : 'Crypto Trading Desk'}</h1>
      <p>
        {zh
          ? '短线与波段信号、仓位风险、自动化健康和完整账本集中在一个执行工作区；15 分钟决策不代表每根 K 线都会下单。'
          : 'Short-term and swing signals, position risk, automation health and a complete ledger in one workspace; a 15-minute decision cadence does not imply a trade on every bar.'}
      </p>
    </div>
    <div className="cx-header-actions">
      <span className={`cx-status ${health.tone}`} title={health.detail}>
        <i /> {health.label}
      </span>
      <span className={`cx-mode ${mode}`}>{mode === 'paper' ? 'PAPER' : 'LIVE'}</span>
      <button
        className="cx-icon-btn"
        type="button"
        onClick={onRefresh}
        aria-label={zh ? '刷新 Crypto 数据' : 'Refresh crypto data'}
      >
        {loading ? <LoadingOutlined /> : <ReloadOutlined />}
      </button>
    </div>
  </header>
);

const OperationsStrip: React.FC<{
  zh: boolean;
  overview: CryptoOverviewResponse | null;
  runtime: CryptoRuntime;
  health: SchedulerHealth;
}> = ({ zh, overview, runtime, health }) => (
  <section className={`cx-ops-strip ${health.tone}`} aria-label={zh ? '24/7 运行健康' : '24/7 operating health'}>
    <div className="cx-ops-lead">
      <span className="cx-live-dot" />
      <div><small>{zh ? '自动化状态' : 'AUTOMATION'}</small><strong>{health.label}</strong><p>{health.detail}</p></div>
    </div>
    <div>
      <ClockCircleOutlined />
      <span>{zh ? '后端心跳' : 'Backend heartbeat'}</span>
      <strong>{durationLabel(health.heartbeatAge, zh)}</strong>
      <small>{formatTime(health.heartbeatAt, zh, true)}</small>
    </div>
    <div>
      <ThunderboltOutlined />
      <span>{zh ? '当前阶段' : 'Current stage'}</span>
      <strong>{stageLabel(runtime.currentStage || overview?.automation?.status, zh)}</strong>
      <small>{money(runtime.progress, 0)}% · {zh ? '周期' : 'cycle'} {money(runtime.cycleCount, 0)}</small>
    </div>
    <div>
      <HistoryOutlined />
      <span>{zh ? '下一周期' : 'Next cycle'}</span>
      <strong>{formatTime(overview?.automation?.nextRun || runtime.nextRun, zh)}</strong>
      <small>{overview?.automation?.intervalMinutes || overview?.config?.intervalMinutes || 15} min cadence</small>
    </div>
  </section>
);

const StrategyProfiles: React.FC<{
  zh: boolean;
  overview: CryptoOverviewResponse | null;
}> = ({ zh, overview }) => {
  const horizon = overview?.config?.tradeHorizon || 'short';
  const interval = overview?.automation?.intervalMinutes || overview?.config?.intervalMinutes || 15;
  const algorithm = overview?.algorithm || overview?.config?.algorithm;
  return <section className="cx-profile-strip">
    <div className={horizon === 'short' ? 'selected' : ''}>
      <span>{zh ? '短线执行' : 'SHORT-TERM EXECUTION'}</span>
      <strong>{horizon === 'short' ? (zh ? '主策略' : 'PRIMARY') : (zh ? '监控' : 'MONITOR')}</strong>
      <small>{horizon === 'short' ? `${interval}m` : '15m'} {zh ? '决策 · 1 小时–1 天持仓' : 'decisions · 1h–1d holding window'}</small>
    </div>
    <div className={horizon === 'long' ? 'selected' : ''}>
      <span>{zh ? '波段引擎' : 'SWING ENGINE'}</span>
      <strong>{horizon === 'long' ? (zh ? '主策略' : 'PRIMARY') : (zh ? '趋势过滤' : 'CONTEXT FILTER')}</strong>
      <small>{horizon === 'long' ? `${interval}m` : '1–4h'} {zh ? '决策 · 1–4 天持仓' : 'decisions · 1–4d holding window'}</small>
    </div>
    <div>
      <span>{zh ? '决策内核' : 'DECISION ENGINE'}</span>
      <strong>{firstText(algorithm?.name, zh ? '确定性策略' : 'Deterministic strategy')}</strong>
      <small>v{firstText(algorithm?.version, '—')} · {zh ? '可复现 / 无生成式 AI' : 'reproducible / no generative AI'}</small>
    </div>
  </section>;
};

const EvidenceStrip: React.FC<{
  evidence: ExecutionEvidence;
  zh: boolean;
}> = ({ evidence, zh }) => {
  const available = Object.values(evidence).some((value) => value !== null);
  if (!available) return null;
  return <div className="cx-evidence-strip" aria-label={zh ? '近期执行统计' : 'Recent execution statistics'}>
    {evidence.tradesPerWeek !== null && <div><span>{zh ? '每周成交' : 'Trades / week'}</span><strong>{money(evidence.tradesPerWeek, 1)}</strong></div>}
    {evidence.averageHoldingHours !== null && <div><span>{zh ? '平均持仓' : 'Average hold'}</span><strong>{money(evidence.averageHoldingHours, 1)}h</strong></div>}
    {evidence.medianHoldingHours !== null && <div><span>{zh ? '持仓中位数' : 'Median hold'}</span><strong>{money(evidence.medianHoldingHours, 1)}h</strong></div>}
    {evidence.costToGrossProfit !== null && <div><span>{zh ? '成本 / 毛利' : 'Cost / gross profit'}</span><strong>{flexiblePct(evidence.costToGrossProfit)}</strong></div>}
  </div>;
};

const AssetCard: React.FC<{
  asset: CryptoAssetSnapshot;
  decision?: CryptoDecision;
  zh: boolean;
  mode: CryptoMode;
  experimental: boolean;
}> = ({ asset, decision, zh, mode, experimental }) => {
  const detail = asset.signalDetail || {};
  const identity = assetIdentity(asset.symbol);
  const resolvedDecision: CryptoDecision = decision || {
    action: detail.action || asset.signal,
    confidence: detail.confidence ?? asset.confidence,
    regime: detail.regime || asset.regime,
    targetWeight: detail.targetWeight,
    reasons: detail.reasons,
    symbol: asset.symbol,
  };
  const change = numberOf(asset.change24h);
  const action = firstText(resolvedDecision.action, asset.signal, 'WAIT').toUpperCase();
  const outcome = decisionOutcome(resolvedDecision);
  const quoteAge = numberOf(asset.quoteAgeSeconds);
  const liveUnavailable = experimental && mode === 'live';
  const executionReady = Boolean(asset.executionReady) && !liveUnavailable;
  return (
    <article className={`cx-asset ${experimental ? 'experimental' : ''}`}>
      <div className="cx-asset-head">
        <div className={`cx-coin ${identity.className}`}>{identity.mark}</div>
        <div>
          <h3>{asset.symbol}</h3>
          <span>{firstText(asset.name, identity.name)}</span>
        </div>
        <span className={actionClass(action)}>{action}</span>
      </div>
      {experimental && <div className={`cx-experiment-band ${liveUnavailable ? 'blocked' : ''}`}>
        <span>{liveUnavailable
          ? (zh ? 'FORWARD VALIDATION · LIVE 不可用' : 'FORWARD VALIDATION · LIVE UNAVAILABLE')
          : (zh ? 'PAPER 实验 · FORWARD VALIDATION' : 'PAPER EXPERIMENT · FORWARD VALIDATION')}</span>
        <p>{liveUnavailable
          ? (zh
            ? '该 sleeve 仅用于 Paper 前向验证；Live 下禁止路由订单，实验额度保持隔离。'
            : 'This sleeve is Paper-only: Live order routing is unavailable and its experimental allocation stays isolated.')
          : (zh
            ? '小额度隔离验证：完整 K 线信号与流动性门槛通过后才入场，并前向记录费用、退出与回撤。'
            : 'Isolated small-cap validation: entries require completed-bar signals and liquidity gates; fees, exits and drawdown are measured forward.')}</p>
      </div>}
      <div className="cx-asset-quote">
        <div>
          <div className="cx-price">${money(asset.price, priceDigits(asset.price))}</div>
          <div className={`cx-change ${(change ?? 0) > 0 ? 'up' : (change ?? 0) < 0 ? 'down' : ''}`}>
            {plainPct(change, true, 2)} <span>24H</span>
          </div>
        </div>
        <div className={`cx-route-state ${outcome}`}>
          <span>{outcomeLabel(outcome, zh)}</span>
          <small>{sourceLabel(resolvedDecision.source, zh)}</small>
        </div>
      </div>
      <div className="cx-asset-grid">
        <div><span>{zh ? '市场状态' : 'Regime'}</span><strong>{regimeLabel(resolvedDecision.regime || asset.regime, zh)}</strong></div>
        <div><span>{zh ? '信号评分' : 'Signal score'}</span><strong>{money(resolvedDecision.confidence ?? resolvedDecision.score ?? asset.confidence, 0)} / 100</strong></div>
        <div><span>{zh ? '仓位路径' : 'Position path'}</span><strong>{ratioPct(resolvedDecision.currentWeight)} → {ratioPct(resolvedDecision.targetWeight ?? detail.targetWeight)}</strong></div>
        <div><span>{zh ? '报价质量' : 'Quote quality'}</span><strong>{money(asset.spreadBps, 1)} bps · {quoteAge === null ? '—' : `${money(quoteAge, 0)}s`}</strong></div>
      </div>
      <div className={`cx-readiness ${executionReady ? 'ready' : ''} ${liveUnavailable ? 'blocked' : ''}`}>
        <i /> {liveUnavailable
          ? (zh ? 'Paper-only sleeve：Live 路由明确禁用' : 'Paper-only sleeve: Live routing is explicitly disabled')
          : executionReady
            ? (zh ? '实时行情满足执行条件' : 'Quote passes execution gates')
            : (zh ? '当前报价不可执行' : 'Quote is not execution-ready')}
      </div>
      <div className="cx-decision-explain">
        <span>{outcome === 'rejected' ? (zh ? '拒单原因' : 'REJECTION') : (zh ? '决策依据' : 'RATIONALE')}</span>
        <p title={decisionReason(resolvedDecision, zh)}>{decisionReason(resolvedDecision, zh)}</p>
      </div>
    </article>
  );
};

const PositionTable: React.FC<{
  positions: CryptoPosition[];
  equity: number | null;
  zh: boolean;
}> = ({ positions, equity, zh }) => (
  <div className="cx-table-wrap">
    <table className="cx-table cx-position-table">
      <caption className="cx-sr-only">{zh ? '当前数字资产持仓' : 'Current crypto positions'}</caption>
      <thead><tr>
        <th>{zh ? '资产' : 'Asset'}</th>
        <th>{zh ? '数量' : 'Quantity'}</th>
        <th>{zh ? '均价' : 'Avg. entry'}</th>
        <th>{zh ? '最新价' : 'Last price'}</th>
        <th>{zh ? '市值' : 'Market value'}</th>
        <th>{zh ? '组合权重' : 'Weight'}</th>
        <th>{zh ? '未实现盈亏' : 'Unrealized P/L'}</th>
      </tr></thead>
      <tbody>
        {positions.length === 0 && <tr><td colSpan={7} className="cx-empty">{zh ? '当前没有数字资产持仓' : 'No open crypto positions'}</td></tr>}
        {positions.map((row, index) => {
          const pnl = numberOf(row.unrealizedPnl, row.unrealized_pl);
          const marketValue = numberOf(row.marketValue, row.market_value);
          const basisValue = marketValue !== null && pnl !== null ? marketValue - pnl : null;
          const pnlPct = numberOf(row.unrealizedPnlPct)
            ?? (basisValue && pnl !== null ? pnl / basisValue * 100 : null);
          const weight = numberOf(row.weight)
            ?? (equity && marketValue !== null ? marketValue / equity : null);
          return <tr key={firstText(row.symbol, index)}>
            <td data-label={zh ? '资产' : 'Asset'}><strong>{firstText(row.symbol, '—')}</strong><small>{firstText(row.side, 'long').toUpperCase()}</small></td>
            <td data-label={zh ? '数量' : 'Quantity'}>{money(row.qty, 6)}</td>
            <td data-label={zh ? '均价' : 'Avg. entry'}>${money(row.averageEntryPrice, 2)}</td>
            <td data-label={zh ? '最新价' : 'Last price'}>${money(row.currentPrice, 2)}</td>
            <td data-label={zh ? '市值' : 'Market value'}>${money(marketValue)}</td>
            <td data-label={zh ? '组合权重' : 'Weight'}>{ratioPct(weight)}</td>
            <td data-label={zh ? '未实现盈亏' : 'Unrealized P/L'} className={(pnl ?? 0) > 0 ? 'cx-positive' : (pnl ?? 0) < 0 ? 'cx-negative' : ''}>
              <strong>{signedMoney(pnl)}</strong><small>{plainPct(pnlPct, true)}</small>
            </td>
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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const zh = language === 'zh-CN';
  // Crypto is intentionally Paper-only and does not inherit the workspace
  // header's global Paper/Real selection.
  const mode: CryptoMode = 'paper';
  const mounted = useRef(true);
  const overviewRequestSequence = useRef(0);

  const [overview, setOverview] = useState<CryptoOverviewResponse | null>(null);
  const [config, setConfig] = useState<Partial<CryptoConfig> | null>(null);
  const [ledger, setLedger] = useState<CryptoLedgerRecord[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<CryptoLedgerResponse | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerCategory>('all');
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (
    quiet = false,
    preserveError = false,
  ): Promise<CryptoOverviewResponse | null> => {
    if (!isAuthenticated) return null;
    const requestSequence = ++overviewRequestSequence.current;
    if (!quiet) setLoading(true);
    try {
      const apiResponse = await cryptoAPI.overview(mode);
      const response = ((apiResponse as { data?: CryptoOverviewResponse }).data
        ?? apiResponse) as unknown as CryptoOverviewResponse;
      if (
        !mounted.current
        || requestSequence !== overviewRequestSequence.current
      ) return null;
      setOverview(response);
      setConfig(response.config || null);
      if (!preserveError) setError(response.error || '');
      return response;
    } catch (requestError: unknown) {
      const details = objectOf(requestError);
      const response = objectOf(details.response);
      const data = objectOf(response.data);
      if (
        mounted.current
        && requestSequence === overviewRequestSequence.current
        && !preserveError
      ) {
        setError(firstText(data.message, details.message, zh ? 'Crypto 服务不可用' : 'Crypto service unavailable'));
      }
      return null;
    } finally {
      if (
        mounted.current
        && requestSequence === overviewRequestSequence.current
        && !quiet
      ) setLoading(false);
    }
  }, [isAuthenticated, mode, zh]);

  const loadLedger = useCallback(async () => {
    if (!isAuthenticated) return;
    setLedgerLoading(true);
    try {
      const apiResponse = await cryptoAPI.ledger(100);
      const result = ((apiResponse as { data?: CryptoLedgerResponse }).data ?? apiResponse) as CryptoLedgerResponse;
      if (mounted.current) {
        setLedger(result.records || []);
        setLedgerMeta(result);
      }
    } catch (requestError: unknown) {
      const details = objectOf(requestError);
      const response = objectOf(details.response);
      const data = objectOf(response.data);
      if (mounted.current) setError(firstText(data.message, details.message, zh ? '账本暂不可用' : 'Ledger unavailable'));
    } finally {
      if (mounted.current) setLedgerLoading(false);
    }
  }, [isAuthenticated, zh]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      mounted.current = false;
      overviewRequestSequence.current += 1;
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (view === 'ledger') void loadLedger();
  }, [loadLedger, view]);

  const act = async (key: string, operation: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(success);
      await load(true);
      if (view === 'ledger') await loadLedger();
    } catch (requestError: unknown) {
      const details = objectOf(requestError);
      const response = objectOf(details.response);
      const data = objectOf(response.data);
      setError(firstText(data.message, details.message, zh ? '请求失败' : 'Request failed'));
    } finally {
      setBusy('');
    }
  };

  const applyLifecycleResponse = (apiResponse: unknown) => {
    // A mutation response is newer than any GET already in flight.
    overviewRequestSequence.current += 1;
    const body = unwrapApiBody(apiResponse);
    const configPatch = objectOf(body.config) as Partial<CryptoConfig>;
    const runtimePatch = objectOf(body.runtime) as CryptoRuntime;
    const hasConfigPatch = Object.keys(configPatch).length > 0;
    const hasRuntimePatch = Object.keys(runtimePatch).length > 0;
    if (!hasConfigPatch && !hasRuntimePatch) return;

    if (hasConfigPatch) {
      setConfig((current) => ({ ...(current || {}), ...configPatch }));
    }
    setOverview((current) => {
      if (!current) return current;
      const enabled = typeof configPatch.enabled === 'boolean'
        ? configPatch.enabled
        : typeof runtimePatch.enabled === 'boolean'
          ? runtimePatch.enabled
          : undefined;
      const automationPatch: NonNullable<CryptoOverviewResponse['automation']> = {};
      if (enabled !== undefined) automationPatch.enabled = enabled;
      if (typeof runtimePatch.status === 'string') automationPatch.status = runtimePatch.status;
      if (runtimePatch.nextRun !== undefined) automationPatch.nextRun = runtimePatch.nextRun;
      if (runtimePatch.lastRun !== undefined) automationPatch.lastRun = runtimePatch.lastRun;
      if (typeof runtimePatch.locked === 'boolean') automationPatch.locked = runtimePatch.locked;
      if (typeof runtimePatch.killSwitch === 'boolean') automationPatch.killSwitch = runtimePatch.killSwitch;
      if (typeof configPatch.killSwitch === 'boolean') automationPatch.killSwitch = configPatch.killSwitch;
      if (typeof configPatch.intervalMinutes === 'number') {
        automationPatch.intervalMinutes = configPatch.intervalMinutes;
      }

      return {
        ...current,
        config: hasConfigPatch ? { ...(current.config || {}), ...configPatch } : current.config,
        runtime: hasRuntimePatch ? { ...(current.runtime || {}), ...runtimePatch } : current.runtime,
        automation: { ...(current.automation || {}), ...automationPatch },
      };
    });
  };

  const actLifecycle = async (
    action: 'start' | 'stop',
    operation: () => Promise<unknown>,
    success: string,
  ) => {
    if (busy) return;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const response = await operation();
      applyLifecycleResponse(response);
      setNotice(success);
      await load(true, true);
    } catch (requestError: unknown) {
      setError(lifecycleErrorMessage(requestError, action, zh));
      const reconciled = await load(true, true);
      const reconciledEnabled = reconciled?.automation?.enabled
        ?? reconciled?.config?.enabled
        ?? reconciled?.runtime?.enabled;
      const reachedRequestedState = typeof reconciledEnabled === 'boolean'
        && reconciledEnabled === (action === 'start');
      if (reachedRequestedState) {
        setError('');
        setNotice(success);
      }
    } finally {
      setBusy('');
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    const tradeHorizon = config.tradeHorizon || 'short';
    const intervalMinutes = tradeHorizon === 'short'
      ? 15
      : [60, 120, 240].includes(Number(config.intervalMinutes)) ? Number(config.intervalMinutes) : 60;
    await act('save', () => cryptoAPI.saveConfig({
      tradeHorizon,
      intervalMinutes,
      symbols: stringList(config.symbols),
      experimentalPaperSleeves: stringList(config.experimentalPaperSleeves),
      minimumConfidence: config.minimumConfidence ?? 52,
      riskProfile: config.riskProfile || 'balanced',
      riskPerTradePct: config.riskPerTradePct ?? 0.25,
      maxTotalExposure: config.maxTotalExposure ?? 0.30,
      maxAssetExposurePct: config.maxAssetExposurePct ?? 18,
      assetAllocationsPct: config.assetAllocationsPct || {},
      maxOrderNotional: config.maxOrderNotional ?? 1000,
      minOrderNotional: config.minOrderNotional ?? 10,
      allowAdds: config.allowAdds ?? true,
      aiReviewEnabled: false,
      paperLearningEnabled: false,
      ...(config.order ? { order: config.order } : {}),
    }), zh ? '策略与风险参数已保存。' : 'Strategy and risk mandate saved.');
  };

  const runtime = overview?.runtime || {};
  const performance = runtime.cryptoPerformance || {};
  const pnlEvents = useMemo(() => Array.isArray(performance.curve) ? performance.curve : [], [performance.curve]);
  const pnlData = useMemo(() => {
    const points = pnlEvents.map((point) => ({
      ...point,
      time: new Date(String(point.time)).getTime(),
      pnl: numberOf(point.value),
      tradePnl: numberOf(point.tradePnl),
      fee: numberOf(point.fee),
    })).filter((point) => Number.isFinite(point.time) && point.pnl !== null);
    if (points.length) return [{ time: points[0].time - 1, pnl: 0, baseline: true }, ...points];
    const now = Date.now();
    return [
      { time: now - 60 * 60 * 1000, pnl: 0, baseline: true },
      { time: now, pnl: 0, baseline: true },
    ];
  }, [pnlEvents]);

  const ledgerRows = useMemo(() => ledger.map(normalizeLedgerRow), [ledger]);
  const ledgerCounts = useMemo(() => ({
    all: ledgerRows.length,
    trade: ledgerRows.filter((row) => row.category === 'trade').length,
    decision: ledgerRows.filter((row) => row.category === 'decision').length,
    system: ledgerRows.filter((row) => row.category === 'system').length,
  }), [ledgerRows]);
  const filteredLedger = useMemo(() => (
    ledgerFilter === 'all' ? ledgerRows : ledgerRows.filter((row) => row.category === ledgerFilter)
  ), [ledgerFilter, ledgerRows]);
  const ledgerFinance = useMemo(() => {
    const trades = ledgerRows.filter((row) => row.category === 'trade');
    return trades.reduce((totals, row) => ({
      fees: totals.fees + (row.fee ?? 0),
      realized: totals.realized + (row.realizedPnl ?? 0),
      net: totals.net + (row.netPnl ?? 0),
    }), { fees: 0, realized: 0, net: 0 });
  }, [ledgerRows]);

  if (view === 'not-found') return <Navigate to="/crypto" replace />;
  if (authLoading) return <div className="cx-page-state"><LoadingOutlined /></div>;
  if (!isAuthenticated) return <Navigate to="/signin?next=/crypto" replace />;

  const positions = (overview?.portfolio?.positions || []) as CryptoPosition[];
  const equity = numberOf(overview?.portfolio?.equity, overview?.account?.equity);
  const realizedPnl = numberOf(performance.realizedPnl) ?? 0;
  const fees = numberOf(performance.estimatedFees) ?? 0;
  const unrealizedPnl = positions.reduce((total, row) => total + (numberOf(row.unrealizedPnl, row.unrealized_pl) ?? 0), 0);
  const totalCryptoPnl = realizedPnl + unrealizedPnl;
  const closedTrades = numberOf(performance.closedTradeCount) ?? 0;
  const wins = numberOf(performance.wins) ?? 0;
  const active = Boolean(overview?.automation?.enabled);
  const health = schedulerHealth(overview, runtime, zh);
  const decisions = (overview?.decisions || (overview?.decision ? [overview.decision] : [])) as CryptoDecision[];
  const decisionsBySymbol = new Map(decisions.map((decision) => [decision.symbol, decision]));
  const overviewExtras = objectOf(overview);
  const strategyMetrics = objectOf(
    overviewExtras.strategyMetrics
    || overviewExtras.executionMetrics
    || overviewExtras.metrics,
  );
  const evidence: ExecutionEvidence = {
    tradesPerWeek: numberOf(performance.tradesPerWeek, runtime.tradesPerWeek, strategyMetrics.tradesPerWeek),
    averageHoldingHours: numberOf(performance.averageHoldingHours, runtime.averageHoldingHours, strategyMetrics.averageHoldingHours),
    medianHoldingHours: numberOf(performance.medianHoldingHours, runtime.medianHoldingHours, strategyMetrics.medianHoldingHours),
    costToGrossProfit: numberOf(performance.costToGrossProfit, runtime.costToGrossProfit, strategyMetrics.costToGrossProfit),
  };
  const maxExposure = numberOf(overview?.config?.maxTotalExposure, config?.maxTotalExposure);
  const exposurePct = numberOf(overview?.portfolio?.exposurePct);
  const exposureHeadroom = maxExposure !== null && exposurePct !== null
    ? Math.max(0, maxExposure * 100 - exposurePct)
    : null;
  const configuredSymbols = uniqueSymbols(config?.symbols, overview?.config?.symbols);
  const overviewAssets = overview?.assets || [];
  const assetSymbols = uniqueSymbols(configuredSymbols, overviewAssets.map((asset) => asset.symbol));
  const assetsBySymbol = new Map(
    overviewAssets.map((asset) => [normalizedSymbol(asset.symbol), asset]),
  );
  const displayedAssets = assetSymbols.map((symbol) => (
    assetsBySymbol.get(symbol) || {
      symbol,
      name: assetIdentity(symbol).name,
      dataAvailable: false,
      marketDataAvailable: false,
      executionReady: false,
    }
  ));
  const experimentalSleeves = new Set(uniqueSymbols(
    config?.experimentalPaperSleeves,
    overview?.config?.experimentalPaperSleeves,
  ));
  const universeLabel = assetSymbols.length
    ? assetSymbols.map(baseAsset).join(' / ')
    : (zh ? '已配置资产' : 'the configured universe');

  const desk = <>
    <OperationsStrip zh={zh} overview={overview} runtime={runtime} health={health} />
    <section className="cx-metrics">
      <div><span>{zh ? '账户净值' : 'Account equity'}</span><strong>${money(equity, 0)}</strong><small>{zh ? '经纪商账户总权益' : 'Total broker equity'}</small></div>
      <div><span>{zh ? 'Crypto 净收益' : 'Crypto net P/L'}</span><strong className={totalCryptoPnl > 0 ? 'cx-positive' : totalCryptoPnl < 0 ? 'cx-negative' : ''}>{signedMoney(totalCryptoPnl)}</strong><small>{zh ? '已实现 + 持仓浮动' : 'Realized + open unrealized'}</small></div>
      <div><span>{zh ? '今日盈亏' : 'Day P/L'}</span><strong className={(numberOf(overview?.portfolio?.dayPnl) ?? 0) >= 0 ? 'cx-positive' : 'cx-negative'}>{signedMoney(overview?.portfolio?.dayPnl)}</strong><small>{plainPct(overview?.risk?.daily_return, true)} {zh ? '策略权益回报' : 'strategy-equity return'}</small></div>
      <div><span>{zh ? '风险敞口' : 'Risk exposure'}</span><strong>{plainPct(exposurePct)}</strong><small>{zh ? `剩余额度 ${plainPct(exposureHeadroom)}` : `${plainPct(exposureHeadroom)} capacity left`}</small></div>
      <div><span>{zh ? '可用购买力' : 'Buying power'}</span><strong>${money(overview?.account?.nonMarginableBuyingPower, 0)}</strong><small>{mode.toUpperCase()} · {overview?.account?.eligible === false ? (zh ? '不可交易' : 'ineligible') : (zh ? '账户可用' : 'account ready')}</small></div>
    </section>
    <StrategyProfiles zh={zh} overview={overview} />
    <section className="cx-assets">
      {displayedAssets.map((asset) => (
        <AssetCard
          key={asset.symbol}
          asset={asset}
          decision={decisionsBySymbol.get(asset.symbol)}
          zh={zh}
          mode={mode}
          experimental={experimentalSleeves.has(normalizedSymbol(asset.symbol))}
        />
      ))}
      {!displayedAssets.length && <div className="cx-empty-card">{zh ? '等待已配置资产的行情快照…' : 'Waiting for configured market snapshots…'}</div>}
    </section>
    <section className="cx-grid-main">
      <article className="cx-panel cx-chart-panel">
        <div className="cx-panel-head">
          <div><span className="cx-kicker">{zh ? '收益与成本' : 'RETURN & COST'}</span><h2>{zh ? '成交后累计已实现收益' : 'Cumulative realized P/L after fills'}</h2></div>
          <span>{zh ? '每次确认成交更新' : 'Updated on confirmed fills'}</span>
        </div>
        <div className="cx-pnl-summary">
          <div><span>{zh ? '净收益（含持仓）' : 'Net P/L incl. open'}</span><strong className={totalCryptoPnl > 0 ? 'cx-positive' : totalCryptoPnl < 0 ? 'cx-negative' : ''}>{signedMoney(totalCryptoPnl)}</strong></div>
          <div><span>{zh ? '累计已实现' : 'Realized'}</span><b>{signedMoney(realizedPnl)}</b></div>
          <div><span>{zh ? '估算费用' : 'Estimated fees'}</span><b>-${money(fees)}</b></div>
          <div><span>{zh ? '平仓胜率' : 'Closed-fill win rate'}</span><b>{closedTrades ? plainPct(wins / closedTrades * 100, false) : '—'}</b></div>
        </div>
        <div className="cx-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={pnlData}>
          <defs><linearGradient id="cxPnl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f6f5c" stopOpacity={0.25}/><stop offset="100%" stopColor="#1f6f5c" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="rgba(120,130,145,.16)"/>
          <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(value) => new Date(value).toLocaleDateString()} tickLine={false} axisLine={false}/>
          <YAxis domain={['auto', 'auto']} tickFormatter={(value) => signedMoney(value)} tickLine={false} axisLine={false} width={76}/>
          <ReferenceLine y={0} stroke="rgba(120,130,145,.5)" strokeDasharray="4 4"/>
          <Tooltip content={<PnlTooltip zh={zh}/>}/>
          <Area type="linear" dataKey="pnl" stroke="#1f6f5c" strokeWidth={2} fill="url(#cxPnl)" dot={pnlEvents.length ? { r: 3, fill: '#1f6f5c', strokeWidth: 0 } : false}/>
        </AreaChart></ResponsiveContainer></div>
        {!pnlEvents.length && <div className="cx-pnl-empty">{zh ? '首笔成交后从 $0 基线记录净结果。' : 'Net fill results will plot from a $0 baseline after the first trade.'}</div>}
      </article>
      <article className="cx-panel cx-risk-panel">
        <div className="cx-panel-head"><div><span className="cx-kicker">{zh ? '资本保护' : 'CAPITAL PROTECTION'}</span><h2>{zh ? '实时风险边界' : 'Live risk boundaries'}</h2></div></div>
        <div className="cx-risk-score">
          <div><span>{zh ? '当前回撤' : 'Current drawdown'}</span><strong className={(numberOf(overview?.risk?.drawdown) ?? 0) < 0 ? 'cx-negative' : ''}>{ratioPct(overview?.risk?.drawdown, true)}</strong></div>
          <div><span>{zh ? '7 日回报' : '7-day return'}</span><strong>{ratioPct(overview?.risk?.seven_day_return, true)}</strong></div>
        </div>
        <div className="cx-health-list">
          <div><SafetyCertificateOutlined /><span>{zh ? '单笔风险预算' : 'Risk budget / trade'}</span><strong>{plainPct(config?.riskPerTradePct)}</strong></div>
          <div><SafetyCertificateOutlined /><span>{zh ? '总敞口上限' : 'Total exposure cap'}</span><strong>{ratioPct(maxExposure)}</strong></div>
          <div><SafetyCertificateOutlined /><span>{zh ? '最低信号评分' : 'Minimum signal score'}</span><strong>{money(config?.minimumConfidence, 0)} / 100</strong></div>
          <div className={runtime.cooldownUntil ? 'warn' : ''}><ClockCircleOutlined /><span>{zh ? '风险冷却' : 'Risk cooldown'}</span><strong>{runtime.cooldownUntil ? formatTime(runtime.cooldownUntil, zh) : (zh ? '未触发' : 'Clear')}</strong></div>
        </div>
      </article>
    </section>
    <section className="cx-panel">
      <div className="cx-panel-head"><div><span className="cx-kicker">{zh ? '实时持仓' : 'LIVE BOOK'}</span><h2>{zh ? '当前仓位与浮动收益' : 'Open positions and unrealized P/L'}</h2></div><span>{positions.length} {zh ? '个持仓' : 'positions'}</span></div>
      <PositionTable positions={positions} equity={equity} zh={zh} />
    </section>
  </>;

  const horizon = config?.tradeHorizon || 'short';
  const strategy = <section className="cx-strategy-layout">
    <div className="cx-panel">
      <div className="cx-panel-head"><div><span className="cx-kicker">EXECUTION MANDATE</span><h2>{zh ? '策略与风险参数' : 'Strategy & risk mandate'}</h2></div><span>{firstText(overview?.algorithm?.name, 'Crypto engine')}</span></div>
      <div className="cx-horizon-picker" role="group" aria-label={zh ? '交易周期' : 'Trading horizon'}>
        <button type="button" className={horizon === 'short' ? 'selected' : ''} onClick={() => setConfig((old) => old ? { ...old, tradeHorizon: 'short', intervalMinutes: 15 } : old)}>
          <span>{zh ? '短线' : 'Short-term'}</span><strong>15 min</strong><small>{zh ? '更高决策频率，适合日内与数日持仓' : 'Higher cadence for intraday and multi-day holds'}</small>
        </button>
        <button type="button" className={horizon === 'long' ? 'selected' : ''} onClick={() => setConfig((old) => old ? { ...old, tradeHorizon: 'long', intervalMinutes: 60 } : old)}>
          <span>{zh ? '波段' : 'Swing'}</span><strong>1–4 hour</strong><small>{zh ? '更慢的结构信号，降低换手' : 'Slower structure signals with lower turnover'}</small>
        </button>
      </div>
      <EvidenceStrip evidence={evidence} zh={zh} />
      {horizon === 'long' && <label className="cx-select-row"><span>{zh ? '波段评估频率' : 'Swing evaluation cadence'}</span><select value={config?.intervalMinutes ?? 60} onChange={(event) => setConfig((old) => old ? { ...old, intervalMinutes: Number(event.target.value) } : old)}><option value={60}>60 min</option><option value={120}>120 min</option><option value={240}>240 min</option></select></label>}
      <div className="cx-form-grid">
        <label><span>{zh ? '最低信号评分' : 'Minimum signal score'} <b>{money(config?.minimumConfidence, 0)} / 100</b></span>
          <input type="range" min="45" max="75" step="1" value={config?.minimumConfidence ?? 52} onChange={(event) => setConfig((old) => old ? { ...old, minimumConfidence: Number(event.target.value) } : old)} /></label>
        <label><span>{zh ? '总敞口上限' : 'Total exposure cap'} <b>{ratioPct(config?.maxTotalExposure)}</b></span>
          <input type="range" min="0.10" max="0.60" step="0.01" value={config?.maxTotalExposure ?? .30} onChange={(event) => setConfig((old) => old ? { ...old, maxTotalExposure: Number(event.target.value) } : old)} /></label>
        <label><span>{zh ? '单笔风险预算' : 'Risk budget / trade'} <b>{plainPct(config?.riskPerTradePct, false, 2)}</b></span>
          <input type="range" min="0.05" max="1.00" step="0.05" value={config?.riskPerTradePct ?? .25} onChange={(event) => setConfig((old) => old ? { ...old, riskPerTradePct: Number(event.target.value) } : old)} /></label>
        <label><span>{zh ? '单笔订单上限' : 'Max order notional'} <b>${money(config?.maxOrderNotional, 0)}</b></span>
          <input type="number" min="10" max="200000" value={config?.maxOrderNotional ?? 1000} onChange={(event) => setConfig((old) => old ? { ...old, maxOrderNotional: Number(event.target.value) } : old)} /></label>
        <label><span>{zh ? '风险等级' : 'Risk profile'}</span><select value={config?.riskProfile ?? 'balanced'} onChange={(event) => setConfig((old) => old ? { ...old, riskProfile: event.target.value as CryptoConfig['riskProfile'] } : old)}><option value="conservative">{zh ? '保守' : 'Conservative'}</option><option value="balanced">{zh ? '均衡' : 'Balanced'}</option><option value="aggressive">{zh ? '积极' : 'Aggressive'}</option></select></label>
        {assetSymbols.map((symbol) => {
          const experimental = experimentalSleeves.has(symbol);
          const allocation = numberOf(config?.assetAllocationsPct?.[symbol]) ?? 0;
          const allocationMaximum = Math.max(numberOf(config?.maxAssetExposurePct) ?? 18, allocation);
          const liveUnavailable = false;
          return <label className={`cx-allocation-control ${experimental ? 'experimental' : ''}`} key={symbol}>
            <span>
              <span className="cx-allocation-name">
                {symbol} {zh ? '配置上限' : 'allocation cap'}
                {experimental && <em>{liveUnavailable ? (zh ? 'LIVE 不可用' : 'LIVE UNAVAILABLE') : 'FORWARD VALIDATION'}</em>}
              </span>
              <b>{plainPct(allocation)}</b>
            </span>
            <input
              type="range"
              min="0"
              max={allocationMaximum}
              step="1"
              value={allocation}
              disabled={liveUnavailable}
              aria-label={`${symbol} ${zh ? '配置上限' : 'allocation cap'}`}
              onChange={(event) => setConfig((old) => old ? {
                ...old,
                assetAllocationsPct: {
                  ...(old.assetAllocationsPct || {}),
                  [symbol]: Number(event.target.value),
                },
              } : old)}
            />
            {experimental && <small>{liveUnavailable
              ? (zh ? 'Paper 实验额度不会在 Live 模式路由。' : 'Paper experimental allocation cannot route in Live mode.')
              : (zh ? '隔离的小额度 Paper 前向验证。' : 'Isolated small-allocation Paper forward validation.')}</small>}
          </label>;
        })}
        <label className="cx-check"><input type="checkbox" checked={config?.allowAdds ?? true} onChange={(event) => setConfig((old) => old ? { ...old, allowAdds: event.target.checked } : old)} /><span>{zh ? '允许盈利趋势中逐步加仓' : 'Allow progressive adds in profitable trends'}</span></label>
      </div>
      <div className="cx-save-row"><button className="cx-primary" type="button" disabled={!config || busy === 'save'} onClick={() => void saveConfig()}>{busy === 'save' ? <LoadingOutlined /> : <SafetyCertificateOutlined />} {zh ? '保存策略参数' : 'Save strategy mandate'}</button><span>{zh ? '保存不会启动或停止调度器。' : 'Saving never starts or stops the scheduler.'}</span></div>
    </div>
    <aside className="cx-panel cx-rules">
      <span className="cx-kicker">ORDER LIFECYCLE</span>
      <h2>{zh ? '买入、减仓与平仓规则' : 'Entry, reduction and exit rules'}</h2>
      {[
        [zh ? '买入' : 'ENTRY', zh ? '完整 K 线上的趋势、动量或区间反转信号通过评分、报价、点差、流动性与总敞口门槛后才下单。' : 'A completed-bar trend, momentum or range-reversion signal must pass score, quote, spread, liquidity and portfolio-cap gates.'],
        [zh ? '加仓' : 'ADD', zh ? '仅对已有盈利仓位加码，并要求趋势继续确认、保护止损有效且距离上次买入达到最小涨幅。' : 'Adds require an already profitable position, renewed trend confirmation, a durable protective stop and minimum gain from the previous add.'],
        [zh ? '减仓' : 'REDUCE', zh ? '信号转弱、波动扩大或区间超买时先降低风险；成交后记录费用、已实现收益和仓位变化。' : 'Weakening signals, volatility expansion or range overbought conditions step risk down; fees, realized P/L and position changes are recorded after fills.'],
        [zh ? '平仓' : 'EXIT', zh ? '结构跌破、趋势和动量共同转负、追踪止损、恐慌状态或资本保护线会触发全部退出。' : 'Structure breaks, negative trend-plus-momentum, trailing stops, panic regimes or capital circuits trigger a full exit.'],
      ].map(([title, copy], index) => <div className="cx-rule" key={title}><b>0{index + 1}</b><div><h3>{title}</h3><p>{copy}</p></div></div>)}
      <div className="cx-note"><SafetyCertificateOutlined /><span>{zh ? '每次未下单也会保留原因，便于区分“没有信号”与“被风险或市场门槛拒绝”。回测仍是独立研究工具，不直接改写线上参数。' : 'No-order decisions retain their rationale, separating absent signals from risk or market-gate rejections. Backtesting remains an offline research tool and cannot rewrite production parameters.'}</span></div>
    </aside>
  </section>;

  const startDisabledReason = !overview?.account?.configured
    ? (zh ? '需要先配置经纪商账户' : 'Broker account setup is required')
    : runtime.reconciliationRequired
      ? (zh ? '需要先完成订单对账' : 'Order reconciliation is required first')
      : overview?.automation?.killSwitch || runtime.killSwitch
        ? (zh ? '需要先重置紧急停止开关' : 'Reset the kill switch before restarting')
        : '';
  const cycleDisabledReason = startDisabledReason || (
    overview?.automation?.locked || runtime.locked
      ? (zh ? '请先重新启动以清除可恢复的运行时锁' : 'Restart automation to clear the recoverable runtime lock')
      : ''
  );
  const recoverableRuntimeLock = Boolean(overview?.automation?.locked || runtime.locked)
    && !runtime.reconciliationRequired
    && !overview?.automation?.killSwitch
    && !runtime.killSwitch;
  const progress = Math.max(0, Math.min(100, numberOf(runtime.progress) ?? 0));
  const automation = <>
    <OperationsStrip zh={zh} overview={overview} runtime={runtime} health={health} />
    <section className="cx-automation-layout">
      <article className={`cx-panel cx-automation-hero ${active ? 'active' : ''}`}>
        <div className="cx-orbit"><ThunderboltOutlined /></div>
        <span className="cx-kicker">{mode.toUpperCase()} · 24/7 SERVER AUTOPILOT</span>
        <h2>{active ? (zh ? '持续交易调度已启用' : 'Continuous trading is enabled') : (zh ? '自动交易等待启动' : 'Automation is standing by')}</h2>
        <p>{zh ? `服务端按完整 K 线运行，页面或浏览器关闭后仍会继续。每个周期先同步账户与订单，再评估 ${universeLabel} 并持久化决策。` : `The server runs on completed bars and continues after the browser closes. Each cycle syncs account and order state before evaluating ${universeLabel} and persisting decisions.`}</p>
        <div className="cx-automation-actions">
          {active
            ? <button className="cx-danger" type="button" onClick={() => void actLifecycle('stop', () => cryptoAPI.stopAutomation(), zh ? '自动交易已停止。' : 'Automation stopped.')} disabled={Boolean(busy)}>{busy === 'stop' ? <LoadingOutlined /> : <PauseCircleOutlined />} {zh ? '停止自动交易' : 'Stop automation'}</button>
            : <button className="cx-primary" type="button" onClick={() => void actLifecycle('start', () => cryptoAPI.startAutomation(mode, false), zh ? '24/7 自动交易已启动。' : '24/7 automation started.')} disabled={Boolean(busy) || Boolean(startDisabledReason)}>{busy === 'start' ? <LoadingOutlined /> : <PlayCircleOutlined />} {recoverableRuntimeLock ? (zh ? '清除故障锁并重新启动' : 'Clear lock and restart') : (zh ? '启动 24/7 自动交易' : 'Start 24/7 automation')}</button>}
          <button className="cx-secondary" type="button" onClick={() => void act('cycle', () => cryptoAPI.runCycle(mode, false), zh ? '交易周期已完成。' : 'Trading cycle completed.')} disabled={Boolean(busy) || Boolean(cycleDisabledReason)}>{busy === 'cycle' ? <LoadingOutlined /> : <ThunderboltOutlined />} {zh ? '立即运行一次' : 'Run one cycle now'}</button>
        </div>
        {(startDisabledReason || cycleDisabledReason) && <div className="cx-inline-warning"><AlertOutlined /> {startDisabledReason || cycleDisabledReason}</div>}
      </article>
      <article className="cx-panel">
        <div className="cx-panel-head"><div><span className="cx-kicker">SCHEDULER TELEMETRY</span><h2>{zh ? '运行时与恢复状态' : 'Runtime and recovery state'}</h2></div><span>{recoveryLabel(runtime.recoveryState, zh)}</span></div>
        <div className="cx-cycle-progress">
          <div><span>{stageLabel(runtime.currentStage, zh)}</span><strong>{progress}%</strong></div>
          <div className="cx-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
          <p>{runtimeMessage(runtime, health.detail, zh)}</p>
        </div>
        <div className="cx-runtime-grid">
          <div><ClockCircleOutlined /><span>{zh ? '最后心跳' : 'Last heartbeat'}</span><strong>{formatTime(health.heartbeatAt, zh, true)}</strong><small>{durationLabel(health.heartbeatAge, zh)}</small></div>
          <div><HistoryOutlined /><span>{zh ? '上次 / 下次周期' : 'Last / next cycle'}</span><strong>{formatTime(overview?.automation?.lastRun || runtime.lastRun, zh)}</strong><small>→ {formatTime(overview?.automation?.nextRun || runtime.nextRun, zh)}</small></div>
          <div><ThunderboltOutlined /><span>{zh ? '累计周期 / 上次耗时' : 'Cycles / last duration'}</span><strong>{money(runtime.cycleCount, 0)}</strong><small>{money(runtime.lastDurationMs, 0)} ms</small></div>
          <div className={(numberOf(runtime.consecutiveErrors) ?? 0) > 0 ? 'warn' : ''}><SafetyCertificateOutlined /><span>{zh ? '连续错误 / 恢复' : 'Errors / recovery'}</span><strong>{money(runtime.consecutiveErrors, 0)}</strong><small>{recoveryLabel(runtime.recoveryState, zh)}</small></div>
        </div>
        {runtime.reconciliationRequired
          ? <div className="cx-operational-note danger"><AlertOutlined /><div><strong>{zh ? '需要订单对账' : 'Order reconciliation required'}</strong><p>{firstText(runtime.reconciliationMessage, runtime.lastError, health.detail)}</p></div></div>
          : <div className="cx-operational-note"><CheckCircleOutlined /><div><strong>{zh ? '线上持续性' : 'Online continuity'}</strong><p>{zh ? '配置、运行状态、每次决策与路由订单均持久化；已成交订单由经纪商状态对账。' : 'Configuration, runtime state, every decision and routed order are persisted; confirmed fills are reconciled against broker state.'}</p></div></div>}
      </article>
    </section>
  </>;

  const ledgerFilterLabels: Record<LedgerCategory, [string, string]> = {
    all: ['All events', '全部事件'],
    trade: ['Trades', '成交 / 订单'],
    decision: ['Decisions', '策略决策'],
    system: ['System', '系统事件'],
  };
  const ledgerView = <section className="cx-panel cx-ledger-panel">
    <div className="cx-panel-head">
      <div><span className="cx-kicker">IMMUTABLE OPERATIONS RECORD</span><h2>{zh ? '专业交易账本' : 'Professional trading ledger'}</h2><p>{zh ? '成交、决策与系统事件按时间统一审计；金额为当前返回窗口内的可用字段。' : 'Trades, decisions and system events share one chronological audit trail; financial totals use available fields in the returned window.'}</p></div>
      <button className="cx-secondary compact" type="button" onClick={() => void loadLedger()} disabled={ledgerLoading}>{ledgerLoading ? <LoadingOutlined /> : <ReloadOutlined />} {zh ? '刷新账本' : 'Refresh ledger'}</button>
    </div>
    <div className="cx-ledger-summary">
      <div><span>{zh ? '记录数' : 'Visible events'}</span><strong>{ledgerRows.length}</strong><small>{ledgerMeta?.scanTruncated ? (zh ? '扫描窗口已截断' : 'scan window truncated') : (zh ? '最新审计窗口' : 'latest audit window')}</small></div>
      <div><span>{zh ? '费用' : 'Fees'}</span><strong className="cx-negative">-${money(ledgerFinance.fees)}</strong><small>{zh ? '可用成交记录合计' : 'sum of available trade fields'}</small></div>
      <div><span>{zh ? '已实现盈亏' : 'Realized P/L'}</span><strong className={ledgerFinance.realized > 0 ? 'cx-positive' : ledgerFinance.realized < 0 ? 'cx-negative' : ''}>{signedMoney(ledgerFinance.realized)}</strong><small>{zh ? '费用前字段（如提供）' : 'pre-fee field when supplied'}</small></div>
      <div><span>{zh ? '净结果' : 'Net result'}</span><strong className={ledgerFinance.net > 0 ? 'cx-positive' : ledgerFinance.net < 0 ? 'cx-negative' : ''}>{signedMoney(ledgerFinance.net)}</strong><small>{zh ? '已实现盈亏减费用' : 'realized P/L less fees'}</small></div>
    </div>
    <EvidenceStrip evidence={evidence} zh={zh} />
    <div className="cx-ledger-toolbar">
      <div className="cx-ledger-filters" role="group" aria-label={zh ? '账本筛选' : 'Ledger filters'}>
        {(Object.keys(ledgerFilterLabels) as LedgerCategory[]).map((filter) => <button key={filter} type="button" className={ledgerFilter === filter ? 'selected' : ''} aria-pressed={ledgerFilter === filter} onClick={() => setLedgerFilter(filter)}>{zh ? ledgerFilterLabels[filter][1] : ledgerFilterLabels[filter][0]} <b>{ledgerCounts[filter]}</b></button>)}
      </div>
      <span>{zh ? `扫描 ${money(ledgerMeta?.scannedRows, 0)} 行` : `${money(ledgerMeta?.scannedRows, 0)} rows scanned`}</span>
    </div>
    <div className="cx-table-wrap cx-ledger-wrap">
      <table className="cx-table cx-ledger-table">
        <caption className="cx-sr-only">{zh ? 'Crypto 交易、决策和系统审计事件' : 'Crypto trade, decision and system audit events'}</caption>
        <thead><tr>
          <th>{zh ? '时间 / 类型' : 'Time / type'}</th>
          <th>{zh ? '资产 / 动作' : 'Asset / action'}</th>
          <th>{zh ? '状态 / 来源' : 'Status / source'}</th>
          <th>{zh ? '数量' : 'Quantity'}</th>
          <th>{zh ? '成交 / 信号价' : 'Fill / signal price'}</th>
          <th>{zh ? '名义金额' : 'Notional'}</th>
          <th>{zh ? '费用' : 'Fee'}</th>
          <th>{zh ? '已实现盈亏' : 'Realized P/L'}</th>
          <th>{zh ? '净结果' : 'Net result'}</th>
          <th>{zh ? '仓位变化' : 'Position change'}</th>
          <th>{zh ? '决策依据 / 备注' : 'Rationale / note'}</th>
        </tr></thead>
        <tbody>
          {filteredLedger.length === 0 && <tr><td colSpan={11} className="cx-empty">{ledgerLoading ? (zh ? '正在读取账本…' : 'Loading ledger…') : (zh ? '当前筛选没有记录。Paper 自动交易启动后将持续积累。' : 'No records in this filter. Paper automation will build the ledger continuously.')}</td></tr>}
          {filteredLedger.map((row, index) => <tr key={row.raw.id || `${row.event}-${index}`}>
            <td data-label={zh ? '时间 / 类型' : 'Time / type'}><strong>{formatTime(row.timestamp, zh, true)}</strong><small><span className={`cx-event-dot ${row.category}`} />{humanize(row.event)}</small></td>
            <td data-label={zh ? '资产 / 动作' : 'Asset / action'}><strong>{row.symbol}</strong><small><span className={actionClass(row.action)}>{row.action}</span></small></td>
            <td data-label={zh ? '状态 / 来源' : 'Status / source'}><strong>{humanize(row.status)}</strong><small>{sourceLabel(row.source, zh)}</small></td>
            <td data-label={zh ? '数量' : 'Quantity'}>{money(row.qty, 6)}</td>
            <td data-label={zh ? '成交 / 信号价' : 'Fill / signal price'}>{row.price === null ? '—' : `$${money(row.price, 2)}`}</td>
            <td data-label={zh ? '名义金额' : 'Notional'}>{row.grossNotional === null ? '—' : <><strong>${money(row.grossNotional)}</strong>{row.netNotional !== null && <small>{zh ? '净额' : 'net'} ${money(row.netNotional)}</small>}</>}</td>
            <td data-label={zh ? '费用' : 'Fee'} className={(row.fee ?? 0) > 0 ? 'cx-negative' : ''}>{row.fee === null ? '—' : `-$${money(row.fee)}`}</td>
            <td data-label={zh ? '已实现盈亏' : 'Realized P/L'} className={(row.realizedPnl ?? 0) > 0 ? 'cx-positive' : (row.realizedPnl ?? 0) < 0 ? 'cx-negative' : ''}>{signedMoney(row.realizedPnl)}</td>
            <td data-label={zh ? '净结果' : 'Net result'} className={(row.netPnl ?? 0) > 0 ? 'cx-positive' : (row.netPnl ?? 0) < 0 ? 'cx-negative' : ''}>{signedMoney(row.netPnl)}</td>
            <td data-label={zh ? '仓位变化' : 'Position change'}><span className="cx-position-delta">{positionValue(row.positionBefore, row.weights)} <b>→</b> {positionValue(row.positionAfter, row.weights)}</span></td>
            <td data-label={zh ? '决策依据 / 备注' : 'Rationale / note'} className="cx-ledger-reason" title={row.reason}>{row.reason || '—'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;

  return <main className="cx-root">
    <Header zh={zh} mode={mode} health={health} loading={loading} symbols={assetSymbols} onRefresh={() => void load()} />
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
