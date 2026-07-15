import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { PieChartOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, SafetyCertificateOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tradingAccountAPI, TradingAccountResponse, TradingPosition } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import './PortfolioEditorial.css';

const { Text } = Typography;
const { Option } = Select;

interface HistoryPoint {
  timestamp: number;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
}

type TradeMode = 'paper' | 'real';
type PortfolioDataSource = 'alpaca_paper' | 'alpaca_real';

const PORTFOLIO_TIME_ZONE = 'America/New_York';
const isExpectedPortfolioResponse = (
  data: any,
  mode: TradeMode,
  expectedSource: PortfolioDataSource,
): boolean => (
  (!data?.modeUsed || data.modeUsed === mode)
  && (!data?.source || data.source === expectedSource)
  && data?.isMockData !== true
);

const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeDisplayNumber = (value: any, precision = 2): number => {
  const numericValue = asNumber(value);
  return Math.abs(numericValue) < (0.5 * (10 ** -precision)) ? 0 : numericValue;
};

const normalizeTimestamp = (timestamp: number | string): number | null => {
  const n = Number(timestamp);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
};

const toneColor = (value: number, precision = 2): string => {
  const displayValue = normalizeDisplayNumber(value, precision);
  if (displayValue > 0) return 'var(--portfolio-green, #345d3d)';
  if (displayValue < 0) return 'var(--portfolio-red, #a74730)';
  return 'var(--app-text-muted)';
};

const formatMoney = (value: any): string => {
  const n = normalizeDisplayNumber(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const formatCompactMoney = (value: any, visibleSpread = Number.POSITIVE_INFINITY): string => {
  const n = asNumber(value);
  const absolute = Math.abs(n);
  if (absolute >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (absolute >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  const fractionDigits = visibleSpread < 20 ? 2 : visibleSpread < 100 ? 1 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
};

const formatSignedMoney = (value: any): string => {
  const n = normalizeDisplayNumber(value);
  const formatted = formatMoney(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};

const formatPercent = (value: any, input: 'ratio' | 'percent' = 'percent'): string => {
  const raw = asNumber(value);
  const n = normalizeDisplayNumber(input === 'ratio' ? raw * 100 : raw);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const formatQty = (value: any): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const localizeApiMessage = (raw: unknown, fallback: string, isZh: boolean): string => {
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

const extractApiError = (error: any, fallback: string, isZh: boolean): string => {
  const data = error?.response?.data;
  if (error?.response?.status === 429 || data?.reason === 'alpaca_rate_limited') {
    return isZh
      ? 'Alpaca 请求频率过高，系统稍后会自动刷新。'
      : data?.message || 'Alpaca rate limit reached. Portfolio history will refresh later.';
  }
  return localizeApiMessage(data?.error || data?.message || error?.message, fallback, isZh);
};

const normalizeHistory = (rows: any[]): HistoryPoint[] => {
  const points = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const ts = normalizeTimestamp(row?.timestamp);
      const eq = asNumber(row?.equity);
      if (!ts || !Number.isFinite(eq) || eq <= 0) return null;
      return {
        timestamp: ts,
        equity: eq,
        profitLoss: asNumber(row?.profitLoss ?? row?.pnl),
        profitLossPct: asNumber(row?.profitLossPct ?? row?.pnlPct),
      };
    })
    .filter(Boolean) as HistoryPoint[];

  return Array.from(new Map(points.map((point) => [point.timestamp, point])).values())
    .sort((left, right) => left.timestamp - right.timestamp);
};

const CustomTooltip: React.FC<any> = ({ active, payload, label, t, localeName, history }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ts = normalizeTimestamp(label);
    const dateStr = ts ? new Date(ts).toLocaleString(localeName, {
      timeZone: PORTFOLIO_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) : '';

    // Calculate change from first point in history if available
    let changeVal = data.profitLoss || 0;
    let changePct = data.profitLossPct || 0;

    if (history && history.length > 0) {
      const firstEquity = history[0].equity;
      changeVal = data.equity - firstEquity;
      changePct = firstEquity !== 0 ? (changeVal / firstEquity) * 100 : 0;
    }

    return (
      <div className="portfolio-equity-tooltip" style={{
        backgroundColor: 'var(--app-card-bg)',
        border: '1px solid var(--app-border)',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: 'var(--app-shadow)',
        minWidth: '200px'
      }}>
        <div style={{ marginBottom: '8px', borderBottom: '1px solid var(--app-border-soft)', paddingBottom: '4px' }}>
          <Text style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--app-text-muted)' }}>
            {t.portfolio.tooltipTime}
          </Text>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--app-text-strong)' }}>{dateStr} ET</div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <Text style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--app-text-muted)' }}>
            {t.portfolio.tooltipEquity}
          </Text>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--app-text-strong)' }}>{formatMoney(data.equity)}</div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div>
            <Text style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--app-text-muted)' }}>
              {t.portfolio.tooltipChange}
            </Text>
            <div style={{ fontSize: '13px', fontWeight: 700, color: toneColor(changeVal) }}>
              {formatSignedMoney(changeVal)}
            </div>
          </div>
          <div>
            <Text style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--app-text-muted)' }}>
              {t.portfolio.tooltipChangePct}
            </Text>
            <div style={{ fontSize: '13px', fontWeight: 700, color: toneColor(changeVal) }}>
              {formatPercent(changePct)}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const Portfolio: React.FC = () => {
  const { t, language } = useLanguage();
  const { tradeMode } = useTradeMode();
  const navigate = useNavigate();

  const [account, setAccount] = useState<TradingAccountResponse | null>(null);
  const [positions, setPositions] = useState<TradingPosition[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<HistoryPoint[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1M');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });
  const [source, setSource] = useState<PortfolioDataSource | undefined>();
  const [historySource, setHistorySource] = useState<PortfolioDataSource | undefined>();
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const lastPortfolioRefreshRef = useRef(0);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const lastAutoRefreshAtRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const activeRefreshRef = useRef<{ requestId: number; mode: TradeMode } | null>(null);
  const tradeModeRef = useRef<TradeMode>(tradeMode);
  const portfolioRangeRef = useRef(portfolioRange);
  const autoRefreshEnabledRef = useRef(autoRefreshEnabled);
  tradeModeRef.current = tradeMode;
  portfolioRangeRef.current = portfolioRange;
  autoRefreshEnabledRef.current = autoRefreshEnabled;

  const localeName = language === 'zh-CN' ? 'zh-CN' : 'en-US';
  const isZh = language === 'zh-CN';
  const editorialCopy = isZh ? {
    ledger: '01 / 资金账本',
    account: '02 / 账户',
    equityCurve: '03 / 净值曲线',
    exposure: '04 / 持仓敞口',
    risk: '05 / 风险',
    updated: '更新于',
    autoOn: '自动刷新：开',
    autoOff: '自动刷新：关',
    long: '多头',
    short: '空头',
    active: '正常',
    paperAccount: '模拟账户',
    liveAccount: '实盘账户',
    easternTime: '美东时间',
    historyMismatch: 'Alpaca 返回的历史净值与当前账户不一致。为避免显示误导性曲线，本页已隐藏该历史数据。',
    accountBoundary: '账户数据按当前交易环境读取；任何下单操作仍需在交易工作台单独核对并确认。',
  } : {
    ledger: '01 / CAPITAL LEDGER',
    account: '02 / ACCOUNT',
    equityCurve: '03 / EQUITY CURVE',
    exposure: '04 / EXPOSURE',
    risk: '05 / RISK',
    updated: 'Updated',
    autoOn: 'Auto refresh: on',
    autoOff: 'Auto refresh: off',
    long: 'Long',
    short: 'Short',
    active: 'Active',
    paperAccount: 'Paper account',
    liveAccount: 'Live account',
    easternTime: 'Eastern Time',
    historyMismatch: 'Alpaca history did not match the selected account. It is hidden to avoid showing a misleading equity curve.',
    accountBoundary: 'Account data follows the selected trading environment. Every order is still reviewed and confirmed separately in the trade desk.',
  };

  const formatDateTime = (value?: string): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(localeName, {
      timeZone: PORTFOLIO_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date) + ' ET';
  };

  const loadData = useCallback(async (
    mode: TradeMode = tradeModeRef.current,
    range: string = portfolioRangeRef.current,
    includeHistory: boolean = true,
    force: boolean = false,
  ) => {
    if (mode !== tradeModeRef.current) return;

    const activeRefresh = activeRefreshRef.current;
    if (activeRefresh?.mode === mode && !force) return;

    const requestId = ++requestGenerationRef.current;
    activeRefreshRef.current = { requestId, mode };
    const isCurrentRequest = () => (
      mountedRef.current
      && requestId === requestGenerationRef.current
      && tradeModeRef.current === mode
    );

    setLoading(true);
    if (includeHistory) {
      setHistoryLoading(true);
      setHistoryError(null);
    }

    try {
      const apiCalls: Promise<any>[] = [
        tradingAccountAPI.getAccount(mode),
        tradingAccountAPI.getPositions(mode),
      ];
      if (includeHistory) {
        apiCalls.push(tradingAccountAPI.getPortfolioHistory(mode, range));
      }

      const results = await Promise.allSettled(apiCalls);
      if (!isCurrentRequest()) return;

      const [accountRes, positionsRes, historyRes] = results;

      let nextError: string | null = null;
      let nextHistoryError: string | null = null;
      let nextUpdatedAt = '';
      let nextSource: PortfolioDataSource | undefined;
      let nextHistorySource: PortfolioDataSource | undefined;
      let accountEquity = 0;
      const expectedSource: PortfolioDataSource = mode === 'real' ? 'alpaca_real' : 'alpaca_paper';

      if (accountRes.status === 'fulfilled') {
        const data = accountRes.value.data;
        if (data.success && data.available !== false && isExpectedPortfolioResponse(data, mode, expectedSource)) {
          setAccount(data);
          accountEquity = asNumber(data.equity || data.portfolioValue);
          nextSource = data.source;
          nextUpdatedAt = data.updatedAt || nextUpdatedAt;
        } else {
          setAccount(null);
          nextError = !isExpectedPortfolioResponse(data, mode, expectedSource)
            ? editorialCopy.historyMismatch
            : localizeApiMessage(data.error || data.message, t.portfolio.dataUnavailable, isZh);
        }
      } else {
        setAccount(null);
        nextError = extractApiError(accountRes.reason, t.portfolio.dataUnavailable, isZh);
      }

      if (positionsRes.status === 'fulfilled') {
        const data = positionsRes.value.data;
        if (data.success && isExpectedPortfolioResponse(data, mode, expectedSource)) {
          setPositions(Array.isArray(data.positions) ? data.positions : []);
          nextSource = nextSource || data.source;
          nextUpdatedAt = nextUpdatedAt || data.updatedAt || '';
        } else {
          setPositions([]);
          if (!nextError) {
            nextError = !isExpectedPortfolioResponse(data, mode, expectedSource)
              ? editorialCopy.historyMismatch
              : localizeApiMessage(data.error || data.message, t.portfolio.dataUnavailable, isZh);
          }
        }
      } else {
        setPositions([]);
        if (!nextError) nextError = extractApiError(positionsRes.reason, t.portfolio.dataUnavailable, isZh);
      }

      if (includeHistory && historyRes && historyRes.status === 'fulfilled') {
        const data = historyRes.value.data;
        if (data.success && isExpectedPortfolioResponse(data, mode, expectedSource)) {
          const normalized = normalizeHistory(data.data || []);
          const lastHistoryEquity = normalized[normalized.length - 1]?.equity || 0;
          const historyRatio = accountEquity > 0 ? lastHistoryEquity / accountEquity : 1;
          const historyMatchesAccount = accountEquity <= 0 || (historyRatio >= 0.2 && historyRatio <= 5);

          if (!historyMatchesAccount) {
            setPortfolioHistory([]);
            setPortfolioChange({ value: 0, percent: 0 });
            setHistorySource(undefined);
            nextHistoryError = editorialCopy.historyMismatch;
          } else {
            setPortfolioHistory(normalized);
            nextHistorySource = data.source || expectedSource;
            nextUpdatedAt = nextUpdatedAt || data.updatedAt || '';

            if (normalized.length >= 2) {
              const first = normalized[0].equity;
              const last = normalized[normalized.length - 1].equity;
              setPortfolioChange({
                value: last - first,
                percent: first !== 0 ? ((last - first) / first) * 100 : 0,
              });
            } else {
              setPortfolioChange({ value: 0, percent: 0 });
            }
          }
        } else {
          setPortfolioHistory([]);
          setPortfolioChange({ value: 0, percent: 0 });
          setHistorySource(undefined);
          if (!isExpectedPortfolioResponse(data, mode, expectedSource)) {
            nextHistoryError = editorialCopy.historyMismatch;
          } else {
            nextHistoryError = localizeApiMessage(data.error || data.message, t.portfolio.dataUnavailable, isZh);
          }
        }
      } else if (includeHistory && historyRes && historyRes.status === 'rejected') {
        setPortfolioHistory([]);
        setPortfolioChange({ value: 0, percent: 0 });
        setHistorySource(undefined);
        nextHistoryError = extractApiError(historyRes.reason, t.portfolio.dataUnavailable, isZh);
      }

      setSource(nextSource);
      setLastUpdated(nextUpdatedAt);
      setError(nextError);
      if (includeHistory) {
        setHistorySource(nextHistorySource);
        setHistoryError(nextHistoryError);
      }
    } catch (loadError: any) {
      if (!isCurrentRequest()) return;
      setError(extractApiError(loadError, t.portfolio.dataUnavailable, isZh));
    } finally {
      if (activeRefreshRef.current?.requestId === requestId) {
        activeRefreshRef.current = null;
      }
      if (isCurrentRequest()) {
        lastAutoRefreshAtRef.current = Date.now();
        setLoading(false);
        if (includeHistory) setHistoryLoading(false);
      }
    }
  }, [editorialCopy.historyMismatch, isZh, t.portfolio.dataUnavailable]);

  // Unified mount + tradeMode change + auto-refresh effect
  useEffect(() => {
    mountedRef.current = true;
    setAccount(null);
    setPositions([]);
    setPortfolioHistory([]);
    setPortfolioChange({ value: 0, percent: 0 });
    setSource(undefined);
    setHistorySource(undefined);
    setLastUpdated('');
    setError(null);
    setHistoryError(null);

    // A mode change always starts a new generation, even if the old account is still loading.
    loadData(tradeMode, portfolioRangeRef.current, true, true);

    // Auto-refresh: 30s interval for core data, portfolio history every 5 min
    const startAutoRefresh = () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = setInterval(() => {
        if (!mountedRef.current || !autoRefreshEnabledRef.current) return;
        const currentMode = tradeModeRef.current;
        if (activeRefreshRef.current?.mode === currentMode) return;
        const now = Date.now();
        const includeHistory = (now - lastPortfolioRefreshRef.current) >= 300000;
        if (includeHistory) lastPortfolioRefreshRef.current = now;
        loadData(currentMode, portfolioRangeRef.current, includeHistory);
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
  }, [loadData, tradeMode]);

  const handlePortfolioRangeChange = (range: string) => {
    portfolioRangeRef.current = range;
    setPortfolioRange(range);
    lastPortfolioRefreshRef.current = Date.now();
    loadData(tradeModeRef.current, range, true, true);
  };

  const totalUnrealizedPL = useMemo(
    () => positions.reduce((sum, p) => sum + asNumber(p.unrealizedPL), 0),
    [positions]
  );

  const exposure = useMemo(() => {
    const equity = asNumber(account?.equity || account?.portfolioValue);
    if (equity <= 0) return 0;
    const marketValue = positions.reduce((sum, p) => sum + Math.abs(asNumber(p.marketValue)), 0);
    return (marketValue / equity) * 100;
  }, [account, positions]);

  const todayPL = useMemo(() => {
    const equity = asNumber(account?.equity);
    const lastEquity = asNumber(account?.lastEquity);
    if (equity && lastEquity) return equity - lastEquity;
    const latest = portfolioHistory[portfolioHistory.length - 1];
    return latest ? latest.profitLoss : 0;
  }, [account, portfolioHistory]);

  const todayPLPercent = useMemo(() => {
    const lastEquity = asNumber(account?.lastEquity);
    if (lastEquity) return (todayPL / lastEquity) * 100;
    const latest = portfolioHistory[portfolioHistory.length - 1];
    return latest ? latest.profitLossPct * 100 : 0;
  }, [account, portfolioHistory, todayPL]);

  const yDomain = useMemo((): [number, number] => {
    const equityValues = portfolioHistory
      .map((p) => asNumber(p.equity))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (equityValues.length === 0) return [0, 100];
    const minE = Math.min(...equityValues);
    const maxE = Math.max(...equityValues);
    if (minE === maxE) {
      const pad = Math.max(1, Math.abs(maxE) * 0.05);
      return [minE - pad, maxE + pad];
    }
    const spread = maxE - minE;
    const pad = Math.max(spread * 0.15, Math.abs(maxE) * 0.005);
    return [minE - pad, maxE + pad];
  }, [portfolioHistory]);

  const modeLabel = tradeMode === 'real' ? editorialCopy.liveAccount : editorialCopy.paperAccount;
  const sourceLabel = source === 'alpaca_real' ? t.portfolio.sourceReal : source === 'alpaca_paper' ? t.portfolio.sourcePaper : '-';

  const kpis = [
    {
      label: t.portfolio.portfolioValue,
      value: account ? formatMoney(account.portfolioValue || account.equity) : '-',
      detail: t.portfolio.equity,
      tone: asNumber(account?.portfolioValue || account?.equity),
    },
    {
      label: t.portfolio.cash,
      value: account ? formatMoney(account.cash) : '-',
      detail: t.portfolio.accountSnapshot,
      tone: asNumber(account?.cash),
    },
    {
      label: t.portfolio.buyingPower,
      value: account ? formatMoney(account.buyingPower) : '-',
      detail: t.portfolio.dayTradeBuyingPower,
      tone: asNumber(account?.buyingPower),
    },
    {
      label: t.portfolio.todayPL,
      value: account || portfolioHistory.length ? formatSignedMoney(todayPL) : '-',
      detail: formatPercent(todayPLPercent),
      tone: todayPL,
    },
    {
      label: t.portfolio.totalUnrealizedPL,
      value: positions.length ? formatSignedMoney(totalUnrealizedPL) : '-',
      detail: `${positions.length} ${t.portfolio.positionsLabel}`,
      tone: totalUnrealizedPL,
    },
  ];

  const positionsColumns: ColumnsType<TradingPosition> = [
    {
      title: t.portfolio.colAsset,
      dataIndex: 'symbol',
      key: 'symbol',
      fixed: 'left',
      width: 128,
      className: 'portfolio-symbol-cell',
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.assetClass || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t.portfolio.colQty,
      dataIndex: 'qty',
      key: 'qty',
      align: 'right',
      width: 90,
      className: 'portfolio-number-cell',
      render: formatQty,
    },
    {
      title: t.portfolio.colAvgEntry,
      dataIndex: 'avgEntryPrice',
      key: 'avgEntryPrice',
      align: 'right',
      width: 118,
      className: 'portfolio-number-cell',
      render: formatMoney,
    },
    {
      title: t.portfolio.colCurrentPrice,
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      align: 'right',
      width: 122,
      className: 'portfolio-number-cell',
      render: formatMoney,
    },
    {
      title: t.portfolio.colMarketValue,
      dataIndex: 'marketValue',
      key: 'marketValue',
      align: 'right',
      width: 132,
      className: 'portfolio-number-cell',
      render: formatMoney,
    },
    {
      title: t.portfolio.colCostBasis,
      dataIndex: 'costBasis',
      key: 'costBasis',
      align: 'right',
      width: 126,
      className: 'portfolio-number-cell',
      render: formatMoney,
    },
    {
      title: t.portfolio.colPL,
      dataIndex: 'unrealizedPL',
      key: 'unrealizedPL',
      align: 'right',
      width: 122,
      className: 'portfolio-number-cell',
      render: (v: any) => {
        const n = asNumber(v);
        return <Text strong style={{ color: toneColor(n) }}>{formatSignedMoney(n)}</Text>;
      },
    },
    {
      title: t.portfolio.colPLPct,
      dataIndex: 'unrealizedPLPercent',
      key: 'unrealizedPLPercent',
      align: 'right',
      width: 110,
      className: 'portfolio-number-cell',
      render: (v: any) => {
        const n = asNumber(v);
        return <Text strong style={{ color: toneColor(n, 4) }}>{formatPercent(n, 'ratio')}</Text>;
      },
    },
    {
      title: t.portfolio.colTodayChange,
      dataIndex: 'changeToday',
      key: 'changeToday',
      align: 'right',
      width: 124,
      className: 'portfolio-number-cell',
      render: (v: any) => {
        const n = asNumber(v);
        return <Text style={{ color: toneColor(n, 4), fontWeight: 700 }}>{formatPercent(n, 'ratio')}</Text>;
      },
    },
    {
      title: t.portfolio.colSide,
      dataIndex: 'side',
      key: 'side',
      align: 'center',
      width: 92,
      render: (s: string) => {
        const isShort = s === 'short';
        return <Tag color={isShort ? 'red' : 'green'}>{isShort ? editorialCopy.short : editorialCopy.long}</Tag>;
      },
    },
  ];

  return (
    <div className="portfolio-editorial">
      <header className="portfolio-editorial__hero">
        <div className="portfolio-editorial__hero-copy">
          <span className="portfolio-editorial__kicker"><PieChartOutlined /> {editorialCopy.ledger}</span>
          <h1>{t.portfolio.title}</h1>
          <p>{t.portfolio.subtitle}</p>
          <div className="portfolio-editorial__hero-meta">
            <span className={tradeMode === 'real' ? 'is-live' : 'is-paper'}><i /> {modeLabel}</span>
            <span>{positions.length} {t.portfolio.positionsLabel}</span>
            <span>{sourceLabel}</span>
          </div>
        </div>
        <Space wrap className="portfolio-editorial__hero-actions">
          {lastUpdated && (
            <span className="portfolio-editorial__updated">
              {editorialCopy.updated}: {formatDateTime(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            className={`portfolio-auto-refresh${autoRefreshEnabled ? ' is-active' : ''}`}
            aria-pressed={autoRefreshEnabled}
            onClick={() => setAutoRefreshEnabled(prev => !prev)}
          >
            {autoRefreshEnabled ? editorialCopy.autoOn : editorialCopy.autoOff}
          </button>
          <Button
            className="portfolio-editorial__refresh"
            icon={<ReloadOutlined />}
            onClick={() => loadData(tradeMode, portfolioRange, true, true)}
            loading={loading}
            style={{ 
              borderRadius: 8, 
              background: 'var(--app-card-bg-soft)', 
              color: 'var(--app-text)', 
              borderColor: 'var(--app-border)',
              fontWeight: 600
            }}
          >
            {t.portfolio.refresh}
          </Button>
        </Space>
      </header>

      {error && (
        <Alert
          className="portfolio-editorial__alert"
          type="error"
          showIcon
          message={<span style={{ fontWeight: 700 }}>{t.portfolio.apiErrorTitle}</span>}
          description={error}
          action={<Button size="small" type="primary" danger onClick={() => navigate('/settings/configuration')}>{t.portfolio.configureAction}</Button>}
          style={{ marginBottom: 20, border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}
        />
      )}

      <section className="portfolio-editorial__section portfolio-editorial__section--kpis">
        <div className="portfolio-section-heading">
          <div><span className="portfolio-editorial__kicker">{editorialCopy.account}</span><h2>{t.portfolio.accountSnapshot}</h2></div>
        </div>
      <Row gutter={[0, 0]} className="portfolio-kpi-grid">
        {kpis.map((kpi) => (
          <Col xs={24} sm={12} xl={kpi.label === t.portfolio.totalUnrealizedPL ? 4 : 5} key={kpi.label}>
            <Card 
              className="portfolio-kpi"
              style={{ borderRadius: 10, minHeight: 128, background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }} 
              bodyStyle={{ padding: 18 }}
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: '55%' }} />
              ) : (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--app-text-muted)', letterSpacing: '0.5px' }}>{kpi.label}</Text>
                  <Text style={{ fontSize: 24, fontWeight: 800, color: toneColor(kpi.tone), letterSpacing: '-0.5px' }}>{kpi.value}</Text>
                  <Text style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{kpi.detail}</Text>
                </Space>
              )}
            </Card>
          </Col>
        ))}
      </Row>
      </section>

      <Row gutter={[18, 18]} className="portfolio-editorial__workspace">
        <Col xs={24} xl={17}>
          <Card
            className="portfolio-editorial__panel portfolio-editorial__performance"
            title={<div className="portfolio-card-title"><span>{editorialCopy.equityCurve}</span><strong>{t.portfolio.portfolioPerformance}</strong></div>}
            extra={
              <Space wrap>
                {portfolioHistory.length > 0 && (
                  <Tag
                    color={portfolioChange.value >= 0 ? 'success' : 'error'}
                    icon={portfolioChange.value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    className="portfolio-performance-change"
                  >
                    {formatSignedMoney(portfolioChange.value)} ({formatPercent(portfolioChange.percent)})
                  </Tag>
                )}
                <Select 
                  value={portfolioRange} 
                  onChange={handlePortfolioRangeChange} 
                  style={{ width: 112 }}
                  dropdownStyle={{ background: 'var(--app-card-bg)' }}
                >
                  <Option value="1D">{t.portfolio.range1Day}</Option>
                  <Option value="1W">{t.portfolio.range1Week}</Option>
                  <Option value="1M">{t.portfolio.range1Month}</Option>
                  <Option value="3M">{t.portfolio.range3Months}</Option>
                  <Option value="1Y">{t.portfolio.range1Year}</Option>
                  <Option value="All">{t.portfolio.rangeAll}</Option>
                </Select>
              </Space>
            }
            style={{ marginBottom: 18, background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          >
            {historyLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : historyError ? (
              <Empty description={t.portfolio.portfolioHistoryLoadFailed}>
                <Text className="portfolio-history-error">{historyError}</Text>
              </Empty>
            ) : portfolioHistory.length === 0 ? (
              <Empty description={t.portfolio.noPortfolioHistory}>
                <Text style={{ color: 'var(--app-text-muted)' }}>{t.portfolio.noPortfolioHistoryDesc}</Text>
              </Empty>
            ) : (
              <>
              <div className="portfolio-performance-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioHistory} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--app-blue-text)" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="var(--app-blue-text)" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      minTickGap={30}
                      tickFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        if (!ts) return '';
                        const date = new Date(ts);
                        const options: Intl.DateTimeFormatOptions = { timeZone: PORTFOLIO_TIME_ZONE };

                        if (portfolioRange === '1D') {
                          return date.toLocaleTimeString(localeName, { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
                        }
                        if (portfolioRange === '1W') {
                          return date.toLocaleDateString(localeName, { ...options, month: 'numeric', day: 'numeric' });
                        }
                        if (portfolioRange === '1M' || portfolioRange === '3M') {
                          return date.toLocaleDateString(localeName, { ...options, month: 'short', day: 'numeric' });
                        }
                        if (portfolioRange === '1Y') {
                          return date.toLocaleDateString(localeName, { ...options, month: 'short' });
                        }
                        if (portfolioRange === 'All') {
                          return date.toLocaleDateString(localeName, { ...options, year: '2-digit', month: 'short' });
                        }
                        return date.toLocaleDateString(localeName, { ...options, month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCompactMoney(v, yDomain[1] - yDomain[0])}
                      width={64}
                      tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      domain={yDomain}
                      tickCount={6}
                    />
                    <RechartsTooltip
                      content={<CustomTooltip t={t} localeName={localeName} history={portfolioHistory} />}
                      cursor={{ stroke: 'rgba(238, 242, 233, 0.38)', strokeWidth: 1, strokeDasharray: '3 4' }}
                      wrapperStyle={{ outline: 'none', zIndex: 8, pointerEvents: 'none' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="var(--app-blue-text)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorEquity)"
                      name={t.portfolio.portfolioValueLine}
                      connectNulls
                      isAnimationActive={false}
                      activeDot={{ r: 6, stroke: 'var(--app-card-bg)', strokeWidth: 2, fill: 'var(--app-blue-text)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {historySource ? (
                <div className="portfolio-history-source">
                  <Text>
                    <SafetyCertificateOutlined style={{ color: 'var(--portfolio-green)', marginRight: 4 }} />
                    {t.portfolio.verifiedAlpacaHistory}
                    {' · '}
                    {historySource === 'alpaca_real' ? t.portfolio.sourceReal : t.portfolio.sourcePaper}
                    {' · '}
                    {editorialCopy.easternTime}
                  </Text>
                </div>
              ) : null}
              </>
            )}
          </Card>

          <Card 
            className="portfolio-editorial__panel portfolio-editorial__holdings"
            title={<div className="portfolio-card-title"><span>{editorialCopy.exposure}</span><strong>{t.portfolio.holdings}</strong><em>{positions.length}</em></div>}
            style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
            bodyStyle={{ padding: 0 }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 10 }} style={{ padding: 24 }} />
            ) : positions.length === 0 ? (
              <Empty description={t.portfolio.noPositions} style={{ padding: '40px 0' }} />
            ) : (
              <Table
                className="portfolio-table"
                columns={positionsColumns}
                dataSource={positions}
                rowKey={(record) => record.symbol}
                size="middle"
                pagination={{ pageSize: 12, showSizeChanger: false }}
                scroll={{ x: 1170 }}
                rowClassName="portfolio-row"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card 
            className="portfolio-editorial__panel portfolio-editorial__summary"
            title={<div className="portfolio-card-title"><span>{editorialCopy.risk}</span><strong>{t.portfolio.summary}</strong></div>}
            style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 7 }} />
            ) : !account ? (
              <Empty description={t.portfolio.dataUnavailable} />
            ) : (
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Descriptions 
                  column={1} 
                  size="small" 
                  labelStyle={{ color: 'var(--app-text-muted)', fontWeight: 600 }}
                  contentStyle={{ color: 'var(--app-text-strong)', fontWeight: 700, textAlign: 'right', display: 'block' }}
                >
                  <Descriptions.Item label={t.portfolio.accountStatus}>
                    <Tag color={account?.status === 'ACTIVE' ? 'green' : account?.status ? 'orange' : 'default'} style={{ margin: 0 }}>
                      {account?.status === 'ACTIVE' ? editorialCopy.active : account?.status || '-'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.tradingMode}>
                    <Tag className={`portfolio-mode-tag is-${tradeMode}`}>{modeLabel}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.dataSource}>{sourceLabel}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.lastUpdated}>{formatDateTime(lastUpdated)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.exposure}>{formatPercent(exposure)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.dayTradeBuyingPower}>{formatMoney(account?.dayTradeBuyingPower)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.maintenanceMargin}>{formatMoney(account?.maintenanceMargin)}</Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: '4px 0', borderColor: 'var(--app-border-soft)' }} />

                <div>
                  <Text style={{ display: 'block', marginBottom: 12, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px' }}>{t.portfolio.riskStatus}</Text>
                  <Space wrap>
                    {account?.tradingBlocked && <Tag color="red" style={{ fontWeight: 700 }}>{t.portfolio.tradingBlocked}</Tag>}
                    {account?.accountBlocked && <Tag color="red" style={{ fontWeight: 700 }}>{t.portfolio.accountBlocked}</Tag>}
                    {account?.patternDayTrader && <Tag color="gold" style={{ fontWeight: 700 }}>{t.portfolio.patternDayTrader}</Tag>}
                    {!account?.tradingBlocked && !account?.accountBlocked && !account?.patternDayTrader && <Tag color="green" style={{ fontWeight: 700 }}>{t.portfolio.riskClear}</Tag>}
                  </Space>
                </div>

                <div className="portfolio-account-boundary">
                  <InfoCircleOutlined />
                  <Text>{editorialCopy.accountBoundary}</Text>
                </div>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Portfolio;
