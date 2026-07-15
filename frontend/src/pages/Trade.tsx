import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert, Card, Typography, Button, Divider, Table, Tag, Row, Col, Statistic,
  message, Tooltip, Empty, Modal, Spin
} from 'antd';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
  RobotOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  EyeOutlined, ThunderboltOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ShoppingCartOutlined, SwapOutlined, StopOutlined,
  ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons';
import { aiAgentWatchlistAPI, tradingAccountAPI } from '../services/api';
import OrderModal from '../components/OrderModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import './TradeEditorial.css';

const { Text } = Typography;

type PortfolioRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';
type TradeMode = 'paper' | 'real';
type TradeDataErrors = {
  account: string | null;
  positions: string | null;
  orders: string | null;
  history: string | null;
};

const EMPTY_TRADE_DATA_ERRORS: TradeDataErrors = {
  account: null,
  positions: null,
  orders: null,
  history: null,
};

type PortfolioPoint = {
  timestamp: number;
  equity: number;
};

type PortfolioChartPoint = PortfolioPoint & {
  changeValue: number;
  changePercent: number;
  drawdownPercent: number;
};

type PortfolioTooltipLabels = {
  value: string;
  change: string;
  drawdown: string;
};

const PORTFOLIO_TIME_ZONE = 'America/New_York';
const PORTFOLIO_RANGES: PortfolioRange[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];

const normalizeTimestamp = (timestamp: unknown): number | null => {
  const numericTimestamp = Number(timestamp);
  if (Number.isFinite(numericTimestamp) && numericTimestamp > 0) {
    return numericTimestamp < 1e12 ? numericTimestamp * 1000 : numericTimestamp;
  }

  if (typeof timestamp === 'string') {
    const parsedTimestamp = Date.parse(timestamp);
    if (Number.isFinite(parsedTimestamp)) return parsedTimestamp;
  }

  return null;
};

const normalizePortfolioHistory = (raw: unknown): PortfolioPoint[] => {
  if (!Array.isArray(raw)) return [];

  const pointsByTimestamp = new Map<number, PortfolioPoint>();
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const point = item as { timestamp?: unknown; equity?: unknown };
    const timestamp = normalizeTimestamp(point.timestamp);
    const equity = Number(point.equity);
    if (timestamp === null || !Number.isFinite(equity) || equity <= 0) return;
    pointsByTimestamp.set(timestamp, { timestamp, equity });
  });

  return Array.from(pointsByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const localizeTradeError = (raw: unknown, fallback: string, isZh: boolean): string => {
  const detail = String(raw ?? '').trim();
  if (!detail) return fallback;
  if (!isZh) return detail;
  const normalized = detail.toLowerCase();
  if (/rate.?limit|throttl|\b429\b/.test(normalized)) return 'Alpaca 请求频率过高，系统稍后会自动刷新。';
  if (/not configured|configuration|credential|api.?key|unauthor|forbidden|\b401\b|\b403\b/.test(normalized)) {
    return '当前账户连接或凭据不可用，请在设置中检查连接。';
  }
  if (/timeout|timed out/.test(normalized)) return '数据请求超时，请稍后重试。';
  if (/network|failed to fetch|failed to reach|connection/.test(normalized)) return '暂时无法连接数据服务，请稍后重试。';
  return fallback;
};

const responseError = (result: PromiseSettledResult<any>, fallback: string, isZh: boolean): string => {
  if (result.status === 'rejected') {
    return localizeTradeError(result.reason?.response?.data?.message
      || result.reason?.response?.data?.error
      || result.reason?.message, fallback, isZh);
  }
  return localizeTradeError(result.value?.data?.message || result.value?.data?.error, fallback, isZh);
};

const expectedPortfolioSource = (mode: TradeMode) => mode === 'real' ? 'alpaca_real' : 'alpaca_paper';
const isExpectedAccountResponse = (body: any, mode: TradeMode): boolean => (
  (!body?.modeUsed || body.modeUsed === mode)
  && (!body?.source || body.source === expectedPortfolioSource(mode))
);
const isExpectedPortfolioResponse = (body: any, mode: TradeMode): boolean => (
  body?.isMockData !== true
  && isExpectedAccountResponse(body, mode)
);

const normalizeDisplayNumber = (value: number, precision = 2): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.abs(numericValue) < (0.5 * (10 ** -precision)) ? 0 : numericValue;
};

const formatMoney = (value: number, minimumFractionDigits = 2): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(normalizeDisplayNumber(value));

const formatSignedMoney = (value: number): string => {
  const displayValue = normalizeDisplayNumber(value);
  const prefix = displayValue > 0 ? '+' : displayValue < 0 ? '−' : '';
  return `${prefix}${formatMoney(Math.abs(displayValue))}`;
};

const formatSignedPercent = (value: number): string => {
  const displayValue = normalizeDisplayNumber(value);
  const prefix = displayValue > 0 ? '+' : displayValue < 0 ? '−' : '';
  return `${prefix}${Math.abs(displayValue).toFixed(2)}%`;
};

const signedTone = (value: number): string => {
  const displayValue = normalizeDisplayNumber(value);
  if (displayValue > 0) return 'var(--trade-green)';
  if (displayValue < 0) return 'var(--trade-red)';
  return 'var(--trade-muted)';
};

const formatOptionalMoney = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? formatMoney(numericValue) : '—';
};

const formatAxisMoney = (value: number, spread: number): string => {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (absoluteValue >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (absoluteValue >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: spread < 10 ? 2 : 0,
    maximumFractionDigits: spread < 10 ? 2 : 0,
  })}`;
};

const formatPortfolioTick = (timestamp: number, range: PortfolioRange, locale: string): string => {
  const date = new Date(timestamp);
  if (range === '1D') {
    return date.toLocaleTimeString(locale, {
      timeZone: PORTFOLIO_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (range === '1W') {
    return date.toLocaleDateString(locale, {
      timeZone: PORTFOLIO_TIME_ZONE,
      weekday: 'short',
      day: 'numeric',
    });
  }
  if (range === '1M' || range === '3M') {
    return date.toLocaleDateString(locale, {
      timeZone: PORTFOLIO_TIME_ZONE,
      month: 'short',
      day: 'numeric',
    });
  }
  if (range === '1Y') {
    return date.toLocaleDateString(locale, {
      timeZone: PORTFOLIO_TIME_ZONE,
      month: 'short',
    });
  }
  return date.toLocaleDateString(locale, {
    timeZone: PORTFOLIO_TIME_ZONE,
    month: 'short',
    year: '2-digit',
  });
};

const PortfolioEquityTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PortfolioChartPoint }>;
  locale: string;
  labels: PortfolioTooltipLabels;
}> = ({ active, payload, locale, labels }) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const changeTone = point.changeValue > 0 ? 'is-positive' : point.changeValue < 0 ? 'is-negative' : 'is-neutral';
  return (
    <div className={`trade-equity-tooltip ${changeTone}`}>
      <div className="trade-equity-tooltip__time">
        {new Date(point.timestamp).toLocaleString(locale, {
          timeZone: PORTFOLIO_TIME_ZONE,
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })} ET
      </div>
      <strong>{formatMoney(point.equity)}</strong>
      <div className="trade-equity-tooltip__row">
        <span>{labels.change}</span>
        <b>{formatSignedMoney(point.changeValue)} · {formatSignedPercent(point.changePercent)}</b>
      </div>
      <div className="trade-equity-tooltip__row">
        <span>{labels.drawdown}</span>
        <b>{formatSignedPercent(point.drawdownPercent)}</b>
      </div>
      <div className="trade-equity-tooltip__series"><i />{labels.value}</div>
    </div>
  );
};

const Trade: React.FC = () => {
  const { t, language } = useLanguage();
  const { tradeMode } = useTradeMode();
  const isZh = language === 'zh-CN';
  const editorialCopy = isZh ? {
    executionDesk: '01 / 执行台',
    signalMonitor: '02 / 信号监控',
    capital: '03 / 资金',
    equityCurve: '04 / 净值曲线',
    exposure: '05 / 持仓敞口',
    working: '06 / 未成交订单',
    ledger: '07 / 订单记录',
    long: '多头',
    short: '空头',
    active: '正常',
    autoOn: '自动刷新：开',
    autoOff: '自动刷新：关',
    watch: '观察',
    pass: '通过',
    review: '复核',
    paperAccount: '模拟账户',
    liveAccount: '实盘账户',
    sourcePaper: 'Alpaca 模拟账户',
    sourceReal: 'Alpaca 实盘账户',
    sourceMismatch: '返回数据与当前所选账户不一致，已停止显示以避免误操作。',
    accountLoading: '正在读取所选账户...',
    accountUnavailable: '账户快照暂不可用',
    positionsUnavailable: '持仓读取失败',
    ordersUnavailable: '未成交订单读取失败',
    historyUnavailable: '订单记录读取失败',
    retry: '重试',
    cancelLiveDescription: '这将取消所选实盘账户中的订单。提交撤单后，原订单可能已部分成交。',
    cancelPaperDescription: '这将取消所选模拟账户中的订单。',
    cancelAction: '确认撤单',
    status: {
      filled: '已成交', canceled: '已取消', accepted: '已受理', new: '已提交',
      pending_new: '待受理', pending_cancel: '撤单中', rejected: '已拒绝', expired: '已过期',
    } as Record<string, string>,
    orderType: {
      market: '市价', limit: '限价', stop: '止损', stop_limit: '止损限价', trailing_stop: '移动止损',
    } as Record<string, string>,
    setup: {
      'Pullback Entry': '回调入场', 'Breakout Entry': '突破入场', 'Range Support Entry': '区间支撑入场', 'Watch Only': '仅观察',
    } as Record<string, string>,
  } : {
    executionDesk: '01 / EXECUTION DESK',
    signalMonitor: '02 / SIGNAL MONITOR',
    capital: '03 / CAPITAL',
    equityCurve: '04 / EQUITY CURVE',
    exposure: '05 / EXPOSURE',
    working: '06 / WORKING',
    ledger: '07 / LEDGER',
    long: 'Long',
    short: 'Short',
    active: 'Active',
    autoOn: 'Auto refresh: on',
    autoOff: 'Auto refresh: off',
    watch: 'Watch',
    pass: 'Pass',
    review: 'Review',
    paperAccount: 'Paper account',
    liveAccount: 'Live account',
    sourcePaper: 'Alpaca Paper account',
    sourceReal: 'Alpaca Live account',
    sourceMismatch: 'The returned data did not match the selected account, so it was hidden to prevent an incorrect action.',
    accountLoading: 'Reading the selected account...',
    accountUnavailable: 'Account snapshot is unavailable',
    positionsUnavailable: 'Positions could not be loaded',
    ordersUnavailable: 'Open orders could not be loaded',
    historyUnavailable: 'Order history could not be loaded',
    retry: 'Retry',
    cancelLiveDescription: 'This cancels the order in the selected live account. The order may already be partially filled when the request reaches Alpaca.',
    cancelPaperDescription: 'This cancels the order in the selected paper account.',
    cancelAction: 'Confirm cancellation',
    status: {} as Record<string, string>,
    orderType: {} as Record<string, string>,
    setup: {} as Record<string, string>,
  };

  const sideLabel = (side: string) => side === 'sell' ? t.trade.sell : t.trade.buy;
  const positionSideLabel = (side: string) => side === 'short' ? editorialCopy.short : editorialCopy.long;
  const humanizeCode = (value: string) => value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const statusLabel = (status: string) => editorialCopy.status[status] || (status ? humanizeCode(status) : '—');
  const orderTypeLabel = (type: string) => editorialCopy.orderType[type] || (type ? humanizeCode(type) : '—');
  const formatQuantity = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString('en-US', { maximumFractionDigits: 4 })
      : '—';
  };

  // Account Snapshot 状态
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0, 
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });
  
  // Alpaca 数据状态
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [alpacaOrdersHistory, setAlpacaOrdersHistory] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioPoint[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<PortfolioRange>('1D');
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioSource, setPortfolioSource] = useState<'alpaca_paper' | 'alpaca_real' | null>(null);
  const [accountAvailable, setAccountAvailable] = useState(false);
  const [dataErrors, setDataErrors] = useState<TradeDataErrors>(EMPTY_TRADE_DATA_ERRORS);
  const [cancelingOrderIds, setCancelingOrderIds] = useState<Set<string>>(new Set());

  // 加载状态
  const [loadingData, setLoadingData] = useState({
    account: false,
    positions: false,
    orders: false,
    history: false,
    portfolio: false
  });

  // Order Modal 状态
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderModalPreset, setOrderModalPreset] = useState<{
    symbol?: string;
    side?: 'buy' | 'sell';
    qty?: number;
    limitPrice?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  }>({});

  // Auto-refresh state
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const lastPortfolioRefreshRef = useRef(0);
  const portfolioRequestRef = useRef(0);
  const refreshRequestRef = useRef(0);
  const activeRefreshRef = useRef<{ requestId: number; mode: TradeMode } | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const tradeModeRef = useRef<TradeMode>(tradeMode);
  const portfolioRangeRef = useRef<PortfolioRange>(portfolioRange);
  const autoRefreshEnabledRef = useRef(autoRefreshEnabled);
  const cancelingOrderIdsRef = useRef<Set<string>>(new Set());
  tradeModeRef.current = tradeMode;
  portfolioRangeRef.current = portfolioRange;
  autoRefreshEnabledRef.current = autoRefreshEnabled;

  const formatEasternTimestamp = (date: Date): string => `${date.toLocaleTimeString(language, {
    timeZone: PORTFOLIO_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })} ET`;

  const portfolioChartData = useMemo<PortfolioChartPoint[]>(() => {
    if (portfolioHistory.length === 0) return [];

    const startEquity = portfolioHistory[0].equity;
    let highWater = startEquity;
    return portfolioHistory.map((point) => {
      highWater = Math.max(highWater, point.equity);
      const changeValue = point.equity - startEquity;
      return {
        ...point,
        changeValue,
        changePercent: startEquity === 0 ? 0 : (changeValue / startEquity) * 100,
        drawdownPercent: highWater === 0 ? 0 : ((point.equity - highWater) / highWater) * 100,
      };
    });
  }, [portfolioHistory]);

  const portfolioStats = useMemo(() => {
    if (portfolioChartData.length === 0) return null;

    const first = portfolioChartData[0];
    const last = portfolioChartData[portfolioChartData.length - 1];
    const high = portfolioChartData.reduce((best, point) => point.equity > best.equity ? point : best, first);
    const low = portfolioChartData.reduce((best, point) => point.equity < best.equity ? point : best, first);
    const maxDrawdown = portfolioChartData.reduce(
      (lowestDrawdown, point) => Math.min(lowestDrawdown, point.drawdownPercent),
      0,
    );

    return {
      start: first.equity,
      end: last.equity,
      startTimestamp: first.timestamp,
      endTimestamp: last.timestamp,
      high,
      low,
      maxDrawdown,
      changeValue: last.equity - first.equity,
      changePercent: first.equity === 0 ? 0 : ((last.equity - first.equity) / first.equity) * 100,
      spread: Math.max(high.equity - low.equity, 0),
    };
  }, [portfolioChartData]);

  const portfolioYDomain = useMemo<[number, number]>(() => {
    if (!portfolioStats) return [0, 1];
    const centerValue = (portfolioStats.high.equity + portfolioStats.low.equity) / 2;
    const padding = Math.max(
      portfolioStats.spread * 0.16,
      Math.abs(centerValue) * 0.0015,
      0.05,
    );
    return [
      Math.max(0, portfolioStats.low.equity - padding),
      portfolioStats.high.equity + padding,
    ];
  }, [portfolioStats]);

  const portfolioXDomain = useMemo<[number, number]>(() => {
    if (!portfolioStats) return [0, 1];
    if (portfolioStats.startTimestamp !== portfolioStats.endTimestamp) {
      return [portfolioStats.startTimestamp, portfolioStats.endTimestamp];
    }
    const singlePointPadding: Record<PortfolioRange, number> = {
      '1D': 30 * 60 * 1000,
      '1W': 6 * 60 * 60 * 1000,
      '1M': 24 * 60 * 60 * 1000,
      '3M': 3 * 24 * 60 * 60 * 1000,
      '1Y': 7 * 24 * 60 * 60 * 1000,
      All: 30 * 24 * 60 * 60 * 1000,
    };
    const padding = singlePointPadding[portfolioRange];
    return [portfolioStats.startTimestamp - padding, portfolioStats.endTimestamp + padding];
  }, [portfolioRange, portfolioStats]);

  const portfolioBaselineOffset = portfolioStats
    ? Math.min(
        100,
        Math.max(
          0,
          ((portfolioYDomain[1] - portfolioStats.start) / (portfolioYDomain[1] - portfolioYDomain[0])) * 100,
        ),
      )
    : 50;

  const portfolioChange = portfolioStats
    ? { value: portfolioStats.changeValue, percent: portfolioStats.changePercent }
    : { value: 0, percent: 0 };

  const portfolioTone = portfolioChange.value > 0
    ? 'is-positive'
    : portfolioChange.value < 0
      ? 'is-negative'
      : 'is-neutral';

  const portfolioRangeLabels: Record<PortfolioRange, string> = {
    '1D': t.trade.range1Day,
    '1W': t.trade.range1Week,
    '1M': t.trade.range1Month,
    '3M': t.trade.range3Months,
    '1Y': t.trade.range1Year,
    All: t.trade.rangeAll,
  };

  const handlePortfolioRangeChange = useCallback(async (range: PortfolioRange) => {
    const requestMode = tradeModeRef.current;
    const requestId = ++portfolioRequestRef.current;
    portfolioRangeRef.current = range;
    setPortfolioRange(range);
    setPortfolioError(null);
    setLoadingData((previous) => ({ ...previous, portfolio: true }));
    lastPortfolioRefreshRef.current = Date.now();

    try {
      const response = await tradingAccountAPI.getPortfolioHistory(requestMode, range);
      if (
        !mountedRef.current
        || requestId !== portfolioRequestRef.current
        || tradeModeRef.current !== requestMode
      ) return;

      const responseBody = response?.data;
      if (
        responseBody
        && typeof responseBody === 'object'
        && responseBody.success
        && isExpectedPortfolioResponse(responseBody, requestMode)
      ) {
        setPortfolioHistory(normalizePortfolioHistory(responseBody.data));
        setPortfolioSource(responseBody.source || expectedPortfolioSource(requestMode));
        return;
      }

      const errorMessage = responseBody?.success && !isExpectedPortfolioResponse(responseBody, requestMode)
        ? editorialCopy.sourceMismatch
        : responseBody?.message || responseBody?.error || t.trade.portfolioUnavailableDesc;
      setPortfolioHistory([]);
      setPortfolioSource(null);
      setPortfolioError(errorMessage);
    } catch (error: any) {
      if (
        !mountedRef.current
        || requestId !== portfolioRequestRef.current
        || tradeModeRef.current !== requestMode
      ) return;
      setPortfolioHistory([]);
      setPortfolioSource(null);
      setPortfolioError(
        error?.response?.data?.message || error?.response?.data?.error || error?.message || t.trade.portfolioUnavailableDesc,
      );
    } finally {
      if (
        mountedRef.current
        && requestId === portfolioRequestRef.current
        && tradeModeRef.current === requestMode
      ) {
        setLoadingData((previous) => ({ ...previous, portfolio: false }));
      }
    }
  }, [editorialCopy.sourceMismatch, t.trade.portfolioUnavailableDesc]);

  // AI Entry Watchlist 状态
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const res = await aiAgentWatchlistAPI.list();
      if (res.data.success) {
        setWatchlistItems(res.data.items || []);
      }
    } catch (e) {
      console.error('Failed to load watchlist:', e);
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  const removeWatchlistItem = async (id: string) => {
    try {
      const res = await aiAgentWatchlistAPI.remove(id);
      if (res.data.success) {
        message.success(isZh ? '已从观察列表移除。' : 'Removed from watchlist.');
        loadWatchlist();
      }
    } catch (e: any) {
      const detail = localizeTradeError(
        e?.response?.data?.error || e?.response?.data?.message || e?.message,
        t.trade.removeFailed,
        isZh,
      );
      message.error(detail);
    }
  };

  // Cancel open order
  const handleCancelOrder = async (orderId: string, symbol: string) => {
    if (cancelingOrderIdsRef.current.has(orderId)) return;

    const requestMode = tradeModeRef.current;
    const markCanceling = (active: boolean) => {
      const next = new Set(cancelingOrderIdsRef.current);
      if (active) next.add(orderId);
      else next.delete(orderId);
      cancelingOrderIdsRef.current = next;
      setCancelingOrderIds(next);
    };

    markCanceling(true);
    const modal = Modal.confirm({
      className: 'trade-confirm-modal',
      rootClassName: 'trade-confirm-root',
      centered: true,
      closable: false,
      keyboard: false,
      maskClosable: false,
      icon: <StopOutlined />,
      title: t.trade.cancelOrderTitle.replace('{symbol}', symbol),
      content: requestMode === 'real'
        ? editorialCopy.cancelLiveDescription
        : editorialCopy.cancelPaperDescription,
      okText: editorialCopy.cancelAction,
      okButtonProps: { danger: true },
      cancelText: t.trade.keepOrder,
      onCancel: () => markCanceling(false),
      onOk: async () => {
        modal.update({ cancelButtonProps: { disabled: true }, keyboard: false, maskClosable: false });
        try {
          if (tradeModeRef.current !== requestMode) {
            throw new Error(editorialCopy.sourceMismatch);
          }
          const res = await tradingAccountAPI.cancelOrder(orderId, requestMode);
          if (res.data.success) {
            message.success(t.trade.orderCancelled);
            await refreshAllAlpacaData(requestMode, true, true);
          } else {
            throw new Error(res.data.error || t.trade.cancelFailed);
          }
        } catch (e: any) {
          const errorMessage = e?.response?.data?.error || e?.message || t.trade.cancelFailed;
          message.error(errorMessage);
          modal.update({ cancelButtonProps: { disabled: false } });
          throw e;
        } finally {
          markCanceling(false);
        }
      },
    });
  };

  // 统一刷新所有 Alpaca 数据（按当前 tradeMode）
  const refreshAllAlpacaData = useCallback(async (
    mode: TradeMode = tradeModeRef.current,
    includePortfolio: boolean = true,
    force: boolean = false,
  ) => {
    const m = mode;
    if (m !== tradeModeRef.current) return;

    const activeRefresh = activeRefreshRef.current;
    if (activeRefresh?.mode === m && !force) return;

    const requestId = ++refreshRequestRef.current;
    activeRefreshRef.current = { requestId, mode: m };
    const portfolioRequestId = includePortfolio ? ++portfolioRequestRef.current : null;
    const requestedPortfolioRange = portfolioRangeRef.current;
    const isCurrentRequest = () => (
      mountedRef.current
      && requestId === refreshRequestRef.current
      && tradeModeRef.current === m
    );
    let receivedCurrentData = false;

    try {
      setLoadingData(prev => ({ ...prev, account: true, positions: true, orders: true, history: true, ...(includePortfolio ? { portfolio: true } : {}) }));
      if (includePortfolio) setPortfolioError(null);

      const apiCalls: Promise<any>[] = [
        tradingAccountAPI.getAccount(m as 'paper' | 'real'),
        tradingAccountAPI.getPositions(m as 'paper' | 'real'),
        tradingAccountAPI.getOrders(m as 'paper' | 'real', 'open'),
        tradingAccountAPI.getOrders(m as 'paper' | 'real', 'all'),
      ];
      if (includePortfolio) {
        apiCalls.push(tradingAccountAPI.getPortfolioHistory(m, requestedPortfolioRange));
      }

      const results = await Promise.allSettled(apiCalls);
      if (!isCurrentRequest()) return;

      const [accountRes, positionsRes, ordersRes, historyRes, portfolioRes] = results;
      const expectedSource = expectedPortfolioSource(m);
      const nextDataErrors: TradeDataErrors = { ...EMPTY_TRADE_DATA_ERRORS };

      // Account — flat response, no .data wrapper
      if (
        accountRes.status === 'fulfilled'
        && accountRes.value.data.success
        && isExpectedAccountResponse(accountRes.value.data, m)
      ) {
        receivedCurrentData = true;
        const d = accountRes.value.data;
        setAccountSnapshot({
          cash: d.cash || 0, equity: d.equity || 0, buyingPower: d.buyingPower || 0,
          portfolioValue: d.portfolioValue || 0, positionsCount: 0, openOrdersCount: 0,
          accountNumber: d.id || '', status: d.status || '',
        });
        setAccountAvailable(true);
      } else {
        setAccountAvailable(false);
        setAccountSnapshot((previous) => ({
          ...previous,
          cash: 0,
          equity: 0,
          buyingPower: 0,
          portfolioValue: 0,
          accountNumber: '',
          status: '',
        }));
        nextDataErrors.account = accountRes.status === 'fulfilled'
          && !isExpectedAccountResponse(accountRes.value.data, m)
          ? editorialCopy.sourceMismatch
          : responseError(accountRes, editorialCopy.accountUnavailable, isZh);
      }

      // Positions — response.data.positions (camelCase normalized by backend)
      if (
        positionsRes.status === 'fulfilled'
        && positionsRes.value.data.success
        && isExpectedAccountResponse(positionsRes.value.data, m)
      ) {
        receivedCurrentData = true;
        const positions = (positionsRes.value.data.positions || []).map((p: any) => ({
          ...p,
          todayPlPercent: p.todayPlPercent ?? p.unrealizedPLPercent ?? 0,
          todayPlValue: p.todayPlValue ?? 0,
          totalPlPercent: p.unrealizedPLPercent ?? 0,
          totalPlValue: p.unrealizedPL ?? 0,
        }));
        setAlpacaPositions(positions);
        setAccountSnapshot(prev => ({ ...prev, positionsCount: positions.length }));
      } else {
        setAlpacaPositions([]);
        nextDataErrors.positions = positionsRes.status === 'fulfilled'
          && !isExpectedAccountResponse(positionsRes.value.data, m)
          ? editorialCopy.sourceMismatch
          : responseError(positionsRes, editorialCopy.positionsUnavailable, isZh);
      }

      // Open Orders — response.data.orders
      if (
        ordersRes.status === 'fulfilled'
        && ordersRes.value.data.success
        && isExpectedAccountResponse(ordersRes.value.data, m)
      ) {
        receivedCurrentData = true;
        const orders = (ordersRes.value.data.orders || []).map((o: any) => ({
          id: o.id, symbol: o.symbol, qty: o.qty, side: o.side, type: o.type,
          limitPrice: o.limit_price, stopPrice: o.stop_price,
          status: o.status, createdAt: o.created_at, timeInForce: o.time_in_force,
        }));
        setAlpacaOrders(orders);
        setAccountSnapshot(prev => ({ ...prev, openOrdersCount: orders.length }));
      } else {
        setAlpacaOrders([]);
        nextDataErrors.orders = ordersRes.status === 'fulfilled'
          && !isExpectedAccountResponse(ordersRes.value.data, m)
          ? editorialCopy.sourceMismatch
          : responseError(ordersRes, editorialCopy.ordersUnavailable, isZh);
      }

      // Order History — same endpoint, status=all
      if (
        historyRes.status === 'fulfilled'
        && historyRes.value.data.success
        && isExpectedAccountResponse(historyRes.value.data, m)
      ) {
        receivedCurrentData = true;
        const history = (historyRes.value.data.orders || []).map((o: any) => ({
          id: o.id, symbol: o.symbol, qty: o.qty, side: o.side, type: o.type,
          status: o.status, filledAvgPrice: o.filled_avg_price, filledQty: o.filled_qty,
          submittedAt: o.created_at, timeInForce: o.time_in_force,
        }));
        setAlpacaOrdersHistory(history);
      } else {
        setAlpacaOrdersHistory([]);
        nextDataErrors.history = historyRes.status === 'fulfilled'
          && !isExpectedAccountResponse(historyRes.value.data, m)
          ? editorialCopy.sourceMismatch
          : responseError(historyRes, editorialCopy.historyUnavailable, isZh);
      }

      setDataErrors(nextDataErrors);

      // Portfolio History (only when included)
      if (
        includePortfolio &&
        portfolioRequestId === portfolioRequestRef.current &&
        portfolioRes &&
        portfolioRes.status === 'fulfilled'
      ) {
        const resBody = portfolioRes.value?.data;
        if (
          resBody
          && typeof resBody === 'object'
          && resBody.success
          && isExpectedPortfolioResponse(resBody, m)
        ) {
          receivedCurrentData = true;
          setPortfolioHistory(normalizePortfolioHistory(resBody.data));
          setPortfolioSource(resBody.source || expectedSource);
          setPortfolioError(null);
        } else {
          // Backend returned success=false or malformed response
          const errMsg = (resBody as any)?.message || resBody?.error || (resBody as any)?.reason || 'Unknown error from portfolio history endpoint';
          setPortfolioHistory([]);
          setPortfolioSource(null);
          if (resBody?.success && !isExpectedPortfolioResponse(resBody, m)) {
            setPortfolioError(editorialCopy.sourceMismatch);
          } else if ((resBody as any)?.reason === 'config_required' || errMsg?.includes('not configured')) {
            setPortfolioError(t.trade.credentialsNotConfigured.replace('{mode}', m === 'paper' ? t.trade.paperLabel : t.trade.liveLabel));
          } else {
            setPortfolioError(localizeTradeError(errMsg, t.trade.portfolioUnavailableDesc, isZh));
          }
        }
      } else if (
        includePortfolio &&
        portfolioRequestId === portfolioRequestRef.current &&
        portfolioRes &&
        portfolioRes.status === 'rejected'
      ) {
        // HTTP-level failure (network error, timeout, 429 rate limit, etc.)
        const reason = portfolioRes.reason;
        setPortfolioHistory([]);
        setPortfolioSource(null);
        // Try to extract backend error message from Axios error response
        const axiosErrData = reason?.response?.data;
        const backendMsg = axiosErrData?.message || axiosErrData?.reason;
        if (reason?.response?.status === 429 || axiosErrData?.reason === 'alpaca_rate_limited') {
          setPortfolioError(isZh
            ? 'Alpaca 请求频率过高，系统稍后会自动刷新。'
            : backendMsg || 'Alpaca rate limit reached. Portfolio history will refresh later.');
        } else {
          setPortfolioError(localizeTradeError(
            backendMsg || reason?.message,
            t.trade.portfolioUnavailableDesc,
            isZh,
          ));
        }
      }
    } catch (error: any) {
      if (!isCurrentRequest()) return;
      const rawFailure = error?.response?.data?.message || error?.response?.data?.error || error?.message;
      setDataErrors({
        account: localizeTradeError(rawFailure, editorialCopy.accountUnavailable, isZh),
        positions: localizeTradeError(rawFailure, editorialCopy.positionsUnavailable, isZh),
        orders: localizeTradeError(rawFailure, editorialCopy.ordersUnavailable, isZh),
        history: localizeTradeError(rawFailure, editorialCopy.historyUnavailable, isZh),
      });
      message.error(t.trade.refreshFailed);
    } finally {
      if (activeRefreshRef.current?.requestId === requestId) {
        activeRefreshRef.current = null;
      }
      if (isCurrentRequest()) {
        if (receivedCurrentData) setLastUpdated(new Date());
        setLoadingData((previous) => ({
          ...previous,
          account: false,
          positions: false,
          orders: false,
          history: false,
          portfolio: portfolioRequestId === null || portfolioRequestId !== portfolioRequestRef.current
            ? previous.portfolio
            : false,
        }));
      }
    }
  }, [
    editorialCopy.accountUnavailable,
    editorialCopy.historyUnavailable,
    editorialCopy.ordersUnavailable,
    editorialCopy.positionsUnavailable,
    editorialCopy.sourceMismatch,
    isZh,
    t.trade.credentialsNotConfigured,
    t.trade.liveLabel,
    t.trade.paperLabel,
    t.trade.refreshFailed,
    t.trade.portfolioUnavailableDesc,
  ]);

  // Unified mount + tradeMode change + auto-refresh effect
  useEffect(() => {
    mountedRef.current = true;
    setAccountSnapshot({
      cash: 0,
      equity: 0,
      buyingPower: 0,
      portfolioValue: 0,
      positionsCount: 0,
      openOrdersCount: 0,
      accountNumber: '',
      status: '',
    });
    setAlpacaPositions([]);
    setAlpacaOrders([]);
    setAlpacaOrdersHistory([]);
    setPortfolioHistory([]);
    setPortfolioError(null);
    setPortfolioSource(null);
    setAccountAvailable(false);
    setDataErrors(EMPTY_TRADE_DATA_ERRORS);
    setLastUpdated(null);

    // A mode change always supersedes an in-flight request from the previous account.
    refreshAllAlpacaData(tradeMode, true, true);
    loadWatchlist();

    // Auto-refresh: 30s interval for core data, portfolio history every 5 min
    const startAutoRefresh = () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = setInterval(() => {
        if (!mountedRef.current || !autoRefreshEnabledRef.current) return;
        const currentMode = tradeModeRef.current;
        if (activeRefreshRef.current?.mode === currentMode) return;
        const now = Date.now();
        const includePortfolio = (now - lastPortfolioRefreshRef.current) >= 300000;
        if (includePortfolio) lastPortfolioRefreshRef.current = now;
        refreshAllAlpacaData(currentMode, includePortfolio);
      }, 30000);
    };

    if (!document.hidden) {
      startAutoRefresh();
    }

    const handleVisibility = () => {
      if (document.hidden) {
        if (autoRefreshTimerRef.current) { clearInterval(autoRefreshTimerRef.current); autoRefreshTimerRef.current = null; }
      } else if (mountedRef.current) {
        startAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      if (autoRefreshTimerRef.current) { clearInterval(autoRefreshTimerRef.current); autoRefreshTimerRef.current = null; }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadWatchlist, refreshAllAlpacaData, tradeMode]);

  // Order Modal helpers
  const openOrderModal = (preset?: typeof orderModalPreset) => {
    setOrderModalPreset(preset || {});
    setOrderModalVisible(true);
  };

  const handleOrderSuccess = async () => {
    await refreshAllAlpacaData(tradeMode, true, true);
  };

  // 持仓表格列定义 - 与Alpaca页面一致
  const positionsColumns = [
    { title: t.trade.colAsset, dataIndex: 'symbol', key: 'symbol', width: 112, fixed: 'left' as const, className: 'trade-symbol-cell' },
    { title: t.trade.colPrice, dataIndex: 'currentPrice', key: 'currentPrice', width: 112, align: 'right' as const, className: 'trade-number-cell', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? formatMoney(num) : '—';
    }},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty', width: 86, align: 'right' as const, className: 'trade-number-cell', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? formatQuantity(num) : '-';
    }},
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', width: 82, align: 'center' as const, render: (side: string) => (
      <Tag color={side === 'long' ? 'green' : 'red'}>{positionSideLabel(side)}</Tag>
    )},
    { title: t.trade.colMarketValue, dataIndex: 'marketValue', key: 'marketValue', width: 130, align: 'right' as const, className: 'trade-number-cell', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? formatMoney(num) : '—';
    }},
    { title: t.trade.colAvgEntry, dataIndex: 'avgEntryPrice', key: 'avgEntryPrice', width: 112, align: 'right' as const, className: 'trade-number-cell', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? formatMoney(num) : '—';
    }},
    { title: t.trade.colCostBasis, dataIndex: 'costBasis', key: 'costBasis', width: 126, align: 'right' as const, className: 'trade-number-cell', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? formatMoney(num) : '—';
    }},
    { title: t.trade.colTodayPLPct, dataIndex: 'todayPlPercent', key: 'todayPlPercent', width: 126, align: 'right' as const, className: 'trade-number-cell', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: signedTone(num) }}>
          {formatSignedPercent(num)}
        </span>
      ) : '-';
    }},
    { title: t.trade.colTodayPL, dataIndex: 'todayPlValue', key: 'todayPlValue', width: 126, align: 'right' as const, className: 'trade-number-cell', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: signedTone(num) }}>
          {formatSignedMoney(num)}
        </span>
      ) : '-';
    }},
    { title: t.trade.colTotalPLPct, dataIndex: 'totalPlPercent', key: 'totalPlPercent', width: 120, align: 'right' as const, className: 'trade-number-cell', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: signedTone(num) }}>
          {formatSignedPercent(num)}
        </span>
      ) : '-';
    }},
    { title: t.trade.colTotalPL, dataIndex: 'totalPlValue', key: 'totalPlValue', width: 122, align: 'right' as const, className: 'trade-number-cell', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: signedTone(num) }}>
          {formatSignedMoney(num)}
        </span>
      ) : '-';
    }},
    { title: '', key: 'action', width: 112, fixed: 'right' as const, align: 'center' as const, className: 'trade-action-cell', render: (_: any, record: any) => (
      <Button
        size="small"
        danger
        className="trade-row-action trade-row-action--sell"
        icon={<SwapOutlined />}
        onClick={() => openOrderModal({
          symbol: record.symbol,
          side: 'sell',
          qty: Number(record.qty) || undefined,
        })}
      >
        {t.trade.sell}
      </Button>
    )}
  ];

  // 未平仓订单表格列定义
  const openOrdersColumns = [
    { title: t.trade.colSymbol, dataIndex: 'symbol', key: 'symbol', width: 112, fixed: 'left' as const, className: 'trade-symbol-cell', render: (v: string) => <span style={{ fontWeight: 700 }}>{v}</span> },
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', width: 84, align: 'center' as const, render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{sideLabel(side)}</Tag>
    )},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty', width: 90, align: 'right' as const, className: 'trade-number-cell', render: formatQuantity },
    { title: t.trade.colType, dataIndex: 'type', key: 'type', width: 110, render: orderTypeLabel },
    { title: t.trade.colLimitPrice, dataIndex: 'limitPrice', key: 'limitPrice', width: 118, align: 'right' as const, className: 'trade-number-cell', render: (price: any) => {
      return formatOptionalMoney(price);
    }},
    { title: t.trade.colStopPrice, dataIndex: 'stopPrice', key: 'stopPrice', width: 118, align: 'right' as const, className: 'trade-number-cell', render: (price: any) => {
      return formatOptionalMoney(price);
    }},
    { title: t.trade.colTIF, dataIndex: 'timeInForce', key: 'tif', width: 78, align: 'center' as const, render: (v: string) => (v || '').toUpperCase() },
    { title: t.trade.statusLabel, dataIndex: 'status', key: 'status', width: 108, align: 'center' as const, render: (status: string) => (
      <Tag color={status === 'filled' ? 'green' : status === 'canceled' ? 'red' : 'blue'}>
        {statusLabel(status)}
      </Tag>
    )},
    { title: t.trade.colCreated, dataIndex: 'createdAt', key: 'createdAt', width: 190, render: (time: string) => {
      if (!time) return '—';
      const date = new Date(time);
      return date.toLocaleString(language, { timeZone: 'America/New_York' });
    }},
    { title: '', key: 'action', width: 118, fixed: 'right' as const, align: 'center' as const, className: 'trade-action-cell', render: (_: any, record: any) => (
      <Button
        size="small"
        danger
        className="trade-row-action trade-row-action--cancel"
        icon={<StopOutlined />}
        disabled={cancelingOrderIds.has(record.id)}
        onClick={() => handleCancelOrder(record.id, record.symbol)}
      >
        {t.trade.cancel}
      </Button>
    )},
  ];

  // 订单历史表格列定义 - 与Alpaca页面一致
  const orderHistoryColumns = [
    { title: t.trade.colTime, dataIndex: 'submittedAt', key: 'submittedAt', width: 188, render: (time: string) => {
      if (!time) return '—';
      try {
        const date = new Date(time);
        return date.toLocaleString(language, {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch (e) {
        return t.trade.invalidDate;
      }
    }},
    { title: t.trade.colSymbol, dataIndex: 'symbol', key: 'symbol', width: 110, className: 'trade-symbol-cell' },
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', width: 84, align: 'center' as const, render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{sideLabel(side)}</Tag>
    )},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty', width: 92, align: 'right' as const, className: 'trade-number-cell', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? formatQuantity(num) : '-';
    }},
    { title: t.trade.colType, dataIndex: 'type', key: 'type', width: 118, render: orderTypeLabel },
    { title: t.trade.statusLabel, dataIndex: 'status', key: 'status', width: 110, align: 'center' as const, render: (status: string) => {
      const statusColors: Record<string, string> = {
        'filled': 'green',
        'canceled': 'red',
        'accepted': 'blue',
        'new': 'blue',
        'pending_new': 'orange',
        'pending_cancel': 'orange',
        'rejected': 'red',
        'expired': 'gray'
      };
      return (
        <Tag color={statusColors[status] || 'blue'}>
          {statusLabel(status)}
        </Tag>
      );
    }},
    { title: t.trade.colAvgFillPrice, dataIndex: 'filledAvgPrice', key: 'filledAvgPrice', width: 138, align: 'right' as const, className: 'trade-number-cell', render: (price: any) => {
      return formatOptionalMoney(price);
    }},
    { title: t.trade.colFilledQty, dataIndex: 'filledQty', key: 'filledQty', width: 112, align: 'right' as const, className: 'trade-number-cell', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? formatQuantity(num) : '-';
    }}
  ];

  return (
    <div className="trade-editorial">
      {/* 页面标题 + Trade Mode */}
      <header className="trade-editorial__hero">
        <div className="trade-editorial__hero-copy">
          <span className="trade-editorial__kicker"><RobotOutlined /> {editorialCopy.executionDesk}</span>
          <h1>{t.trade.title}</h1>
          <p>{t.trade.subtitle}</p>
          <div className="trade-editorial__hero-meta">
            <span className={tradeMode === 'real' ? 'is-live' : 'is-paper'}>
              <i /> {tradeMode === 'paper' ? editorialCopy.paperAccount : editorialCopy.liveAccount}
            </span>
            <span>{accountSnapshot.positionsCount} {t.trade.positionsLabel}</span>
            <span>{accountSnapshot.openOrdersCount} {t.trade.openOrdersLabel}</span>
          </div>
        </div>
          <div className="trade-editorial__hero-actions">
            <div className="trade-editorial__sync">
              <button
                type="button"
                className={`trade-auto-refresh${autoRefreshEnabled ? ' is-active' : ''}`}
                aria-pressed={autoRefreshEnabled}
                onClick={() => setAutoRefreshEnabled(prev => !prev)}
              >
                {autoRefreshEnabled ? t.trade.autoRefreshOn : t.trade.autoRefreshOff}
              </button>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: 'var(--app-text-muted)', fontWeight: 500 }}>
                  {t.trade.updated}: {formatEasternTimestamp(lastUpdated)}
                </span>
              )}
            </div>
            <Button
              className="trade-editorial__refresh"
              size="middle"
              icon={<ReloadOutlined />}
              onClick={() => refreshAllAlpacaData(tradeMode, true)}
              loading={loadingData.account || loadingData.positions || loadingData.orders || loadingData.portfolio}
              style={{
                borderRadius: 8,
                height: 34,
                fontWeight: 600,
                color: 'var(--app-text)',
                background: 'var(--app-card-bg-soft)',
                border: '1px solid var(--app-border)'
              }}
            >
              {t.trade.refreshData}
            </Button>
          </div>
      </header>

      {/* AI Entry Watchlist */}
      <section className="trade-editorial__section trade-editorial__section--watchlist">
        <Card
          className={`premium-card trade-editorial__panel trade-editorial__watchlist${watchlistItems.length === 0 ? ' is-empty' : ''}`}
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          title={
            <div className="trade-panel-heading">
              <div className="trade-panel-heading__identity">
                <div className="trade-panel-heading__icon"><EyeOutlined /></div>
                <div>
                  <span className="trade-editorial__kicker">{editorialCopy.signalMonitor}</span>
                  <h2>{t.trade.watchlistTitle}</h2>
                  <p>{t.trade.watchlistSubtitle}</p>
                </div>
                <Tag color="blue" bordered={false}>{watchlistItems.length}</Tag>
              </div>
              <div className="trade-panel-heading__actions">
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>{t.trade.realTimeData}</Tag>
                <Divider type="vertical" style={{ height: 20, borderColor: 'var(--app-border-soft)' }} />
                <Button 
                  size="middle" 
                  icon={<ReloadOutlined spin={watchlistLoading} />} 
                  onClick={loadWatchlist} 
                  loading={watchlistLoading} 
                  style={{ 
                    borderRadius: 8, 
                    height: 32, 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: 'var(--app-text-muted)', 
                    background: 'var(--app-card-bg-soft)',
                    border: '1px solid var(--app-border)' 
                  }}
                >
                  {t.trade.refresh}
                </Button>
              </div>
            </div>
          }
        >
          {watchlistItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-strong)' }}>{t.trade.noWatchlist}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.noWatchlistDesc}</div>
                </div>
              }
            />
          ) : (
            <>
              {/* Summary stats strip */}
              <div className="trade-watchlist-stats">
                {[
                  { label: t.trade.statActive, value: watchlistItems.filter(w => w.status === 'ACTIVE').length, color: 'var(--app-blue-text)', icon: <EyeOutlined /> },
                  { label: t.trade.statReadySoon, value: watchlistItems.filter(w => w.finalAction === 'BUY_READY' || (w.riskGateStatus === 'PASS' && w.dataQuality === 'GOOD')).length, color: '#4ade80', icon: <ThunderboltOutlined /> },
                  { label: t.trade.statReview, value: watchlistItems.filter(w => w.riskGateStatus === 'REVIEW' || w.finalAction === 'WAIT_FOR_ENTRY').length, color: '#fbbf24', icon: <ClockCircleOutlined /> },
                  { label: t.trade.statArchived, value: watchlistItems.filter(w => w.status !== 'ACTIVE').length, color: 'var(--app-text-muted)', icon: <CheckCircleOutlined /> }
                ].map((stat, idx) => (
                  <React.Fragment key={stat.label}>
                    <div className="trade-watchlist-stat">
                      <div style={{ color: stat.color, fontSize: 14 }}>{stat.icon}</div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                      </div>
                    </div>
                    {idx < 3 && <Divider type="vertical" style={{ height: 24, margin: 0, borderColor: 'var(--app-border-soft)' }} />}
                  </React.Fragment>
                ))}
              </div>

              {/* Table */}
              <div className="watchlist-table-container">
                <Table
                  className="watchlist-table"
                  dataSource={watchlistItems}
                  rowKey="id"
                  size="small"
                  pagination={watchlistItems.length > 10 ? { pageSize: 10, size: 'small' } : false}
                  loading={watchlistLoading}
                  scroll={{ x: 1200 }}
                  rowClassName="watchlist-row"
                  columns={[
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSymbol}</span>,
                      dataIndex: 'symbol', key: 'symbol', width: 90, fixed: 'left' as const,
                      render: (text: string) => <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--app-text-strong)' }}>{text}</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSetup}</span>,
                      dataIndex: 'setupType', key: 'setup', width: 120,
                      render: (v: string) => {
                        const c: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue' };
                        return <Tag color={c[v] || 'default'} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{editorialCopy.setup[v] || v || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colAI}</span>,
                      dataIndex: 'aiDecision', key: 'aiDecision', width: 75,
                      render: (d: string) => {
                        const c = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                        const label = d === 'BUY' ? t.trade.buy : d === 'WATCH' ? editorialCopy.watch : d;
                        return <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4, width: '100%', textAlign: 'center' }}>{label || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colCnf}</span>,
                      dataIndex: 'confidence', key: 'confidence', width: 60,
                      render: (v: number) => <span style={{ fontSize: 12, fontWeight: 700, color: v >= 80 ? '#4ade80' : 'var(--app-blue-text)' }}>{v != null ? `${v}%` : '—'}</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colEntryZone}</span>,
                      key: 'entryZone', width: 140,
                      render: (_: any, r: any) => r.entryZoneLow != null ? <span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 600 }}>${r.entryZoneLow?.toFixed(2)} – ${r.entryZoneHigh?.toFixed(2)}</span> : <span style={{ color: 'var(--app-text-muted)' }}>—</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colStop}</span>,
                      dataIndex: 'stopLoss', key: 'stop', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colTarget}</span>,
                      dataIndex: 'takeProfit1', key: 'tp1', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colRR}</span>,
                      dataIndex: 'riskReward', key: 'rr', width: 65,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, fontWeight: 700, color: v >= 2 ? '#4ade80' : 'var(--app-text-muted)' }}>{v.toFixed(1)}:1</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colGate}</span>,
                      dataIndex: 'riskGateStatus', key: 'gate', width: 80,
                      render: (s: string) => {
                        const c = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                        const label = s === 'PASS' ? editorialCopy.pass : s === 'REVIEW' ? editorialCopy.review : s;
                        return s ? <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4 }}>{label}</Tag> : '—';
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colFinal}</span>,
                      dataIndex: 'finalAction', key: 'final', width: 110,
                      render: (a: string) => {
                        const labels: Record<string, string> = { 'BUY_READY': t.trade.finalBuyReady, 'WAIT_FOR_ENTRY': t.trade.finalWaitEntry, 'SKIP': t.trade.finalSkip, 'BLOCKED_BY_RISK': t.trade.finalBlocked };
                        const c = a === 'BUY_READY' ? 'green' : a === 'WAIT_FOR_ENTRY' ? 'gold' : 'red';
                        return <Tag color={c} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{labels[a]?.toUpperCase() || a || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colNextStep}</span>, 
                      dataIndex: 'nextStep', key: 'nextStep', width: 200, ellipsis: true,
                      render: (t: string) => (
                        <Tooltip title={t}>
                          <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t || '—'}</span>
                        </Tooltip>
                      )},
                    {
                      title: '', key: 'actions', width: 110, fixed: 'right' as const,
                      render: (_: any, r: any) => (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Tooltip title={t.trade.buy}>
                            <Button size="small" type="primary" icon={<ShoppingCartOutlined style={{ fontSize: 13 }} />} onClick={() => openOrderModal({
                              symbol: r.symbol,
                              side: 'buy' as const,
                              limitPrice: r.entryZoneLow || undefined,
                              takeProfitPrice: r.takeProfit1 || undefined,
                              stopLossPrice: r.stopLoss || undefined,
                            })} style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }} />
                          </Tooltip>
                          <Tooltip title={t.trade.remove}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 15 }} />} onClick={() => removeWatchlistItem(r.id)} style={{ 
                              padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, 
                              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' 
                            }} />
                          </Tooltip>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          )}
        </Card>
      </section>

      <Divider className="trade-editorial__divider" />

      {/* Account Snapshot */}
      <section className="trade-editorial__section">
        <div className="trade-section-heading">
          <div>
            <span className="trade-editorial__kicker">{editorialCopy.capital}</span>
            <h2>{t.trade.accountSnapshot}</h2>
          </div>
          <Button
            className="trade-editorial__primary-action"
            type="primary"
            size="middle"
            icon={<PlusOutlined />}
            onClick={() => openOrderModal()}
            style={{ borderRadius: 8, height: 36, fontWeight: 700, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.2)' }}
          >
            {t.trade.newOrder}
          </Button>
        </div>

        {dataErrors.account && (
          <Alert
            className="trade-data-alert"
            type="error"
            showIcon
            message={editorialCopy.accountUnavailable}
            description={dataErrors.account}
            action={<Button size="small" onClick={() => refreshAllAlpacaData(tradeMode, true, true)}>{editorialCopy.retry}</Button>}
          />
        )}
        
        <Card
          className="trade-editorial__panel trade-editorial__account"
          size="small"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: '24px' }}
        >
          {loadingData.account && !accountAvailable && (
            <div className="trade-account-loading" role="status"><ReloadOutlined spin /> {editorialCopy.accountLoading}</div>
          )}
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} lg={6}>
              <div className="trade-kpi">
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.cash}</span>} 
                  value={accountAvailable ? accountSnapshot.cash : '—'}
                  prefix={accountAvailable ? '$' : undefined}
                  precision={accountAvailable ? 2 : undefined}
                  valueStyle={{ color: 'var(--app-text-strong)', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="trade-kpi trade-kpi--blue">
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.equity}</span>} 
                  value={accountAvailable ? accountSnapshot.equity : '—'}
                  prefix={accountAvailable ? '$' : undefined}
                  precision={accountAvailable ? 2 : undefined}
                  valueStyle={{ color: 'var(--app-blue-text)', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="trade-kpi trade-kpi--amber">
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.buyingPower}</span>} 
                  value={accountAvailable ? accountSnapshot.buyingPower : '—'}
                  prefix={accountAvailable ? '$' : undefined}
                  precision={accountAvailable ? 2 : undefined}
                  valueStyle={{ color: '#fbbf24', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="trade-kpi">
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.portfolioValue}</span>} 
                  value={accountAvailable ? accountSnapshot.portfolioValue : '—'}
                  prefix={accountAvailable ? '$' : undefined}
                  precision={accountAvailable ? 2 : undefined}
                  valueStyle={{ color: 'var(--app-text-strong)', fontWeight: 800 }}
                />
              </div>
            </Col>
          </Row>
          <div className="trade-account-meta" style={{
            marginTop: '20px', 
            padding: '12px 16px', 
            background: 'var(--app-input-bg)', 
            borderRadius: 8, 
            border: '1px solid var(--app-border-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.accountLabel}:</strong> {accountAvailable ? accountSnapshot.accountNumber || '—' : '—'}
              </Text>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.statusLabel}:</strong> 
                <Tag color={accountSnapshot.status === 'ACTIVE' ? 'success' : 'default'} style={{ marginLeft: 6, fontWeight: 700, borderRadius: 4 }}>
                  {accountAvailable ? (accountSnapshot.status === 'ACTIVE' ? editorialCopy.active : accountSnapshot.status || '—') : '—'}
                </Tag>
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.positionsLabel}:</strong> {accountSnapshot.positionsCount}
              </Text>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.openOrdersLabel}:</strong> {accountSnapshot.openOrdersCount}
              </Text>
            </div>
          </div>
        </Card>
      </section>
      
      {/* Portfolio Performance */}
      <section className="trade-editorial__section">
        <Card 
          className="premium-card trade-editorial__panel trade-editorial__performance"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: '24px' }}
        >
          <div className="trade-performance-heading">
            <div>
              <span className="trade-editorial__kicker">{editorialCopy.equityCurve}</span>
              <h2>{t.trade.portfolioPerformance}</h2>
            </div>
            <div className="trade-performance-ranges" role="group" aria-label={t.trade.portfolioPerformance}>
              {PORTFOLIO_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={portfolioRange === range ? 'is-active' : ''}
                  aria-pressed={portfolioRange === range}
                  disabled={loadingData.portfolio && portfolioRange === range}
                  onClick={() => handlePortfolioRangeChange(range)}
                >
                  {portfolioRangeLabels[range]}
                </button>
              ))}
            </div>
          </div>

          {portfolioError ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--trade-red)' }}>{t.trade.portfolioUnavailable}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.portfolioUnavailableDesc}</div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 8, opacity: 0.8 }}>{portfolioError}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 && !loadingData.portfolio ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-strong)' }}>{t.trade.noPortfolioHistory}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.noPortfolioHistoryDesc}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" indicator={<ReloadOutlined spin style={{ fontSize: 24, color: 'var(--app-blue-text)' }} />} />
              <div style={{ marginTop: 16, color: 'var(--app-text-muted)' }}>{t.trade.loadingPortfolio}</div>
            </div>
          ) : portfolioStats ? (
            <>
              <div className={`trade-performance-overview ${portfolioTone}`}>
                <div className="trade-performance-primary">
                  <span>{t.trade.periodChange}</span>
                  <div>
                    <i aria-hidden="true">
                      {portfolioChange.value > 0
                        ? <ArrowUpOutlined />
                        : portfolioChange.value < 0
                          ? <ArrowDownOutlined />
                          : <SwapOutlined />}
                    </i>
                    <strong>{formatSignedMoney(portfolioChange.value)}</strong>
                    <em>{formatSignedPercent(portfolioChange.percent)}</em>
                  </div>
                  <small>{portfolioRangeLabels[portfolioRange]} · {portfolioChartData.length} {t.trade.observations}</small>
                </div>

                <div className="trade-performance-metric">
                  <span>{t.trade.periodOpen}</span>
                  <strong>{formatMoney(portfolioStats.start)}</strong>
                </div>
                <div className="trade-performance-metric">
                  <span>{t.trade.periodHigh}</span>
                  <strong>{formatMoney(portfolioStats.high.equity)}</strong>
                </div>
                <div className="trade-performance-metric">
                  <span>{t.trade.periodLow}</span>
                  <strong>{formatMoney(portfolioStats.low.equity)}</strong>
                </div>
                <div className="trade-performance-metric trade-performance-metric--drawdown">
                  <span>{t.trade.maxDrawdown}</span>
                  <strong>{formatSignedPercent(portfolioStats.maxDrawdown)}</strong>
                </div>
              </div>

              <div className="trade-performance-canvas">
                <div className="trade-performance-chartbar">
                  <div className="trade-performance-legend" aria-label={t.trade.portfolioValueLabel}>
                    <span><i className="trade-performance-legend__equity" />{t.trade.portfolioValueLabel}</span>
                    <span><i className="trade-performance-legend__baseline" />{t.trade.openingBaseline}</span>
                  </div>
                  <div className="trade-performance-current">
                    <span>{t.trade.portfolioValueLabel}</span>
                    <strong>{formatMoney(portfolioStats.end)}</strong>
                    <small>
                      {portfolioSource
                        ? `${portfolioSource === 'alpaca_real' ? editorialCopy.sourceReal : editorialCopy.sourcePaper} · ET`
                        : t.trade.easternTime}
                    </small>
                  </div>
                </div>

                <div className="trade-performance-chart">
                  <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    <AreaChart
                      data={portfolioChartData}
                      margin={{ top: 18, right: 10, left: 6, bottom: 10 }}
                    >
                      <defs>
                        <linearGradient id="tradeEquityLineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a8c09e" />
                          <stop offset={`${portfolioBaselineOffset}%`} stopColor="#a8c09e" />
                          <stop offset={`${portfolioBaselineOffset}%`} stopColor="#dc765c" />
                          <stop offset="100%" stopColor="#dc765c" />
                        </linearGradient>
                        <linearGradient id="tradeEquityAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#9eb895" stopOpacity={0.34} />
                          <stop offset={`${portfolioBaselineOffset}%`} stopColor="#9eb895" stopOpacity={0.035} />
                          <stop offset={`${portfolioBaselineOffset}%`} stopColor="#d76d51" stopOpacity={0.035} />
                          <stop offset="100%" stopColor="#d76d51" stopOpacity={0.28} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="rgba(220, 229, 217, 0.105)"
                        strokeDasharray="2 6"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={portfolioXDomain}
                        tick={{ fill: '#97a398', fontSize: 10.5, fontWeight: 550 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(220, 229, 217, 0.16)' }}
                        tickMargin={12}
                        height={34}
                        minTickGap={36}
                        interval="preserveStartEnd"
                        tickCount={7}
                        tickFormatter={(timestamp) => formatPortfolioTick(Number(timestamp), portfolioRange, language)}
                      />
                      <YAxis
                        orientation="right"
                        domain={portfolioYDomain}
                        width={78}
                        tickCount={5}
                        tick={{ fill: '#aab4aa', fontSize: 10.5, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={11}
                        allowDataOverflow={false}
                        tickFormatter={(value) => formatAxisMoney(Number(value), portfolioStats.spread)}
                      />
                      <ReferenceLine
                        y={portfolioStats.start}
                        stroke="rgba(226, 234, 221, 0.42)"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        ifOverflow="extendDomain"
                      />
                      <RechartsTooltip
                        content={(
                          <PortfolioEquityTooltip
                            locale={language}
                            labels={{
                              value: t.trade.portfolioValueLabel,
                              change: t.trade.periodChange,
                              drawdown: t.trade.drawdown,
                            }}
                          />
                        )}
                        cursor={{ stroke: 'rgba(238, 242, 233, 0.38)', strokeWidth: 1, strokeDasharray: '3 4' }}
                        wrapperStyle={{ outline: 'none', zIndex: 8, pointerEvents: 'none' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                      />
                      <Area
                        type="linear"
                        dataKey="equity"
                        baseValue={portfolioStats.start}
                        stroke="url(#tradeEquityLineGradient)"
                        strokeWidth={2.4}
                        fill="url(#tradeEquityAreaGradient)"
                        fillOpacity={1}
                        dot={portfolioChartData.length === 1 ? { r: 3.5, fill: '#e7eee3', strokeWidth: 0 } : false}
                        activeDot={{ r: 5, fill: '#f6f3e9', stroke: '#345d3d', strokeWidth: 2.5 }}
                        isAnimationActive={false}
                        connectNulls
                        name={t.trade.portfolioValueLabel}
                      />
                      {portfolioChartData.length > 1 && (
                        <>
                          <ReferenceDot
                            x={portfolioStats.high.timestamp}
                            y={portfolioStats.high.equity}
                            r={3.25}
                            fill="#b8cbb1"
                            stroke="#152019"
                            strokeWidth={2}
                            ifOverflow="extendDomain"
                          />
                          <ReferenceDot
                            x={portfolioStats.low.timestamp}
                            y={portfolioStats.low.equity}
                            r={3.25}
                            fill="#de836b"
                            stroke="#152019"
                            strokeWidth={2}
                            ifOverflow="extendDomain"
                          />
                          <ReferenceDot
                            x={portfolioStats.endTimestamp}
                            y={portfolioStats.end}
                            r={4.25}
                            fill={portfolioChange.value >= 0 ? '#a8c09e' : '#dc765c'}
                            stroke="#f4f1e8"
                            strokeWidth={2}
                            ifOverflow="extendDomain"
                          />
                        </>
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </section>

      {/* Positions */}
      <section className="trade-editorial__section">
        <Card 
          title={<div className="trade-table-heading"><span>{editorialCopy.exposure}</span><strong>{t.trade.positions}</strong><em>{alpacaPositions.length}</em></div>}
          loading={loadingData.positions}
          className="premium-card trade-editorial__panel trade-editorial__table-panel"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {dataErrors.positions ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="trade-table-state"
              description={<><strong>{editorialCopy.positionsUnavailable}</strong><span>{dataErrors.positions}</span></>}
            >
              <Button size="small" onClick={() => refreshAllAlpacaData(tradeMode, true, true)}>{editorialCopy.retry}</Button>
            </Empty>
          ) : alpacaPositions.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noPositions}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={positionsColumns} 
              dataSource={alpacaPositions} 
              rowKey="symbol"
              size="middle"
              pagination={alpacaPositions.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 1500 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </section>
      
      {/* Open Orders */}
      <section className="trade-editorial__section">
        <Card 
          title={<div className="trade-table-heading"><span>{editorialCopy.working}</span><strong>{t.trade.openOrders}</strong><em>{alpacaOrders.length}</em></div>}
          loading={loadingData.orders}
          className="premium-card trade-editorial__panel trade-editorial__table-panel"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {dataErrors.orders ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="trade-table-state"
              description={<><strong>{editorialCopy.ordersUnavailable}</strong><span>{dataErrors.orders}</span></>}
            >
              <Button size="small" onClick={() => refreshAllAlpacaData(tradeMode, true, true)}>{editorialCopy.retry}</Button>
            </Empty>
          ) : alpacaOrders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noOpenOrders}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={openOrdersColumns} 
              dataSource={alpacaOrders} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrders.length > 5 ? { pageSize: 5, size: 'small' } : false}
              scroll={{ x: 1120 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </section>
      
      {/* Order History */}
      <section className="trade-editorial__section">
        <Card 
          title={<div className="trade-table-heading"><span>{editorialCopy.ledger}</span><strong>{t.trade.orderHistory}</strong><em>{alpacaOrdersHistory.length}</em></div>}
          loading={loadingData.history}
          className="premium-card trade-editorial__panel trade-editorial__table-panel"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {dataErrors.history ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="trade-table-state"
              description={<><strong>{editorialCopy.historyUnavailable}</strong><span>{dataErrors.history}</span></>}
            >
              <Button size="small" onClick={() => refreshAllAlpacaData(tradeMode, true, true)}>{editorialCopy.retry}</Button>
            </Empty>
          ) : alpacaOrdersHistory.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noOrderHistory}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={orderHistoryColumns} 
              dataSource={alpacaOrdersHistory} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrdersHistory.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 980 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </section>
      
      {/* Order Modal */}
      <OrderModal
        visible={orderModalVisible}
        onClose={() => setOrderModalVisible(false)}
        onSuccess={handleOrderSuccess}
        preset={orderModalPreset}
      />
    </div>
  );
};

export default Trade;
