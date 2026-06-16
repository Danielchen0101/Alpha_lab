import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { PieChartOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tradingAccountAPI, TradingAccountResponse, TradingPosition } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';

const { Title, Text } = Typography;
const { Option } = Select;

interface HistoryPoint {
  timestamp: number;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
}

const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeTimestamp = (timestamp: number | string): number | null => {
  const n = Number(timestamp);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
};

const toneColor = (value: number): string => {
  if (value > 0) return '#4ade80'; // Vibrant green
  if (value < 0) return '#ef4444'; // Vibrant red
  return 'var(--app-text-muted)';
};

const formatMoney = (value: any): string => {
  const n = asNumber(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const formatCompactMoney = (value: any): string => {
  const n = asNumber(value);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

const formatSignedMoney = (value: any): string => {
  const n = asNumber(value);
  const formatted = formatMoney(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};

const formatPercent = (value: any, input: 'ratio' | 'percent' = 'percent'): string => {
  const raw = asNumber(value);
  const n = input === 'ratio' ? raw * 100 : raw;
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

const extractApiError = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  if (error?.response?.status === 429 || data?.reason === 'alpaca_rate_limited') {
    return data?.message || 'Alpaca rate limit reached. Portfolio history will refresh later.';
  }
  return data?.error || data?.message || error?.message || fallback;
};

const normalizeHistory = (rows: any[]): HistoryPoint[] => {
  return (Array.isArray(rows) ? rows : [])
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
};

const generateFallbackHistory = (equity: number, range: string): HistoryPoint[] => {
  const now = Date.now();
  const rangeStart: Record<string, number> = {
    '1D': now - 6.5 * 60 * 60 * 1000,
    '1W': now - 7 * 24 * 60 * 60 * 1000,
    '1M': now - 30 * 24 * 60 * 60 * 1000,
    '3M': now - 90 * 24 * 60 * 60 * 1000,
    '1Y': now - 365 * 24 * 60 * 60 * 1000,
    'All': now - 365 * 24 * 60 * 60 * 1000,
  };
  const start = rangeStart[range] || rangeStart['1M'];
  return [
    { timestamp: start, equity, profitLoss: 0, profitLossPct: 0 },
    { timestamp: now, equity, profitLoss: 0, profitLossPct: 0 },
  ];
};

const CustomTooltip: React.FC<any> = ({ active, payload, label, t, localeName, history }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ts = normalizeTimestamp(label);
    const dateStr = ts ? new Date(ts).toLocaleString(localeName, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      <div style={{
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
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--app-text-strong)' }}>{dateStr}</div>
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
  const [source, setSource] = useState<'alpaca_paper' | 'alpaca_real' | undefined>();
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const isRefreshingRef = useRef(false);
  const lastPortfolioRefreshRef = useRef(0);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const lastAutoRefreshAtRef = useRef(0);

  const localeName = language === 'zh-CN' ? 'zh-CN' : 'en-US';

  const formatDateTime = (value?: string): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(localeName, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const loadData = async (mode: 'paper' | 'real' = tradeMode, range: string = portfolioRange, includeHistory: boolean = true, force: boolean = false) => {
    if (isRefreshingRef.current && !force) return;
    isRefreshingRef.current = true;
    setLoading(true);
    if (includeHistory) {
      setError(null);
      setUsingFallback(false);
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
      const [accountRes, positionsRes, historyRes] = results;

      let nextError: string | null = null;
      let nextUpdatedAt = '';
      let nextSource: 'alpaca_paper' | 'alpaca_real' | undefined;
      let normalizedHistory: HistoryPoint[] = [];
      let accountEquity = 0;

      if (accountRes.status === 'fulfilled') {
        const data = accountRes.value.data;
        if (data.success && data.available !== false) {
          setAccount(data);
          accountEquity = asNumber(data.equity || data.portfolioValue);
          nextSource = data.source;
          nextUpdatedAt = data.updatedAt || nextUpdatedAt;
        } else {
          nextError = data.error || t.portfolio.dataUnavailable;
        }
      } else {
        nextError = extractApiError(accountRes.reason, t.portfolio.dataUnavailable);
      }

      if (positionsRes.status === 'fulfilled') {
        const data = positionsRes.value.data;
        if (data.success) {
          setPositions(Array.isArray(data.positions) ? data.positions : []);
          nextSource = nextSource || data.source;
          nextUpdatedAt = nextUpdatedAt || data.updatedAt || '';
        } else if (!nextError) {
          nextError = data.error || t.portfolio.dataUnavailable;
        }
      } else if (!nextError) {
        nextError = extractApiError(positionsRes.reason, t.portfolio.dataUnavailable);
      }

      if (includeHistory && historyRes && historyRes.status === 'fulfilled') {
        const data = historyRes.value.data;
        if (data.success) {
          const normalized = normalizeHistory(data.data || []);
          normalizedHistory = normalized;
          setPortfolioHistory(normalized);
          nextSource = nextSource || data.source;
          nextUpdatedAt = nextUpdatedAt || data.updatedAt || '';

          if (Number.isFinite(Number(data.total_change)) || Number.isFinite(Number(data.total_change_pct))) {
            setPortfolioChange({
              value: asNumber(data.total_change),
              percent: asNumber(data.total_change_pct),
            });
          } else if (normalized.length >= 2) {
            const first = normalized[0]?.equity || 0;
            const last = normalized[normalized.length - 1]?.equity || 0;
            setPortfolioChange({
              value: last - first,
              percent: first !== 0 ? ((last - first) / first) * 100 : 0,
            });
          }
        } else if (!nextError) {
          nextError = data.error || data.message || t.portfolio.dataUnavailable;
        }
      } else if (includeHistory && historyRes && historyRes.status === 'rejected' && !nextError) {
        nextError = extractApiError(historyRes.reason, t.portfolio.dataUnavailable);
      }

      if (!nextError && accountEquity > 0) {
        const maxHistoryEquity = normalizedHistory.length > 0
          ? Math.max(...normalizedHistory.map((p) => p.equity))
          : 0;
        const historyLooksReasonable = maxHistoryEquity >= accountEquity * 0.1;

        if (!historyLooksReasonable) {
          const fallback = generateFallbackHistory(accountEquity, range);
          setPortfolioHistory(fallback);
          setPortfolioChange({ value: 0, percent: 0 });
          setUsingFallback(true);
        }
      }

      setSource(nextSource);
      setLastUpdated(nextUpdatedAt);
      setError(nextError);
    } finally {
      isRefreshingRef.current = false;
      lastAutoRefreshAtRef.current = Date.now();
      setLoading(false);
    }
  };

  // Unified mount + tradeMode change + auto-refresh effect
  useEffect(() => {
    mountedRef.current = true;
    loadData(tradeMode, portfolioRange, true);

    // Auto-refresh: 30s interval for core data, portfolio history every 5 min
    const startAutoRefresh = () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = setInterval(() => {
        if (!mountedRef.current || isRefreshingRef.current || !autoRefreshEnabled) return;
        const now = Date.now();
        const includeHistory = (now - lastPortfolioRefreshRef.current) >= 300000;
        if (includeHistory) lastPortfolioRefreshRef.current = now;
        loadData(tradeMode, portfolioRange, includeHistory);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeMode]);

  const handlePortfolioRangeChange = (range: string) => {
    setPortfolioRange(range);
    lastPortfolioRefreshRef.current = Date.now();
    loadData(tradeMode, range, true, true);
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

  const modeLabel = tradeMode === 'real' ? t.portfolio.currentRealTrading : t.portfolio.currentPaperTrading;
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
      render: formatQty,
    },
    {
      title: t.portfolio.colAvgEntry,
      dataIndex: 'avgEntryPrice',
      key: 'avgEntryPrice',
      align: 'right',
      render: formatMoney,
    },
    {
      title: t.portfolio.colCurrentPrice,
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      align: 'right',
      render: formatMoney,
    },
    {
      title: t.portfolio.colMarketValue,
      dataIndex: 'marketValue',
      key: 'marketValue',
      align: 'right',
      render: formatMoney,
    },
    {
      title: t.portfolio.colCostBasis,
      dataIndex: 'costBasis',
      key: 'costBasis',
      align: 'right',
      render: formatMoney,
    },
    {
      title: t.portfolio.colPL,
      dataIndex: 'unrealizedPL',
      key: 'unrealizedPL',
      align: 'right',
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
      render: (v: any) => {
        const n = asNumber(v);
        return <Text strong style={{ color: toneColor(n) }}>{formatPercent(n, 'ratio')}</Text>;
      },
    },
    {
      title: t.portfolio.colTodayChange,
      dataIndex: 'changeToday',
      key: 'changeToday',
      align: 'right',
      render: (v: any) => {
        const n = asNumber(v);
        return <Text style={{ color: toneColor(n), fontWeight: 700 }}>{formatPercent(n, 'ratio')}</Text>;
      },
    },
    {
      title: t.portfolio.colSide,
      dataIndex: 'side',
      key: 'side',
      render: (s: string) => <Tag color={s === 'short' ? 'red' : 'green'}>{(s || 'long').toUpperCase()}</Tag>,
    },
  ];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <Title level={2} style={{ marginBottom: 4, color: 'var(--app-text-strong)', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <PieChartOutlined style={{ marginRight: 12, color: 'var(--app-blue-text)' }} />
            {t.portfolio.title}
          </Title>
          <Text style={{ color: 'var(--app-text-muted)', fontSize: 14, fontWeight: 500 }}>{t.portfolio.subtitle}</Text>
        </div>
        <Space wrap>
          <Tag color={tradeMode === 'real' ? 'red' : 'blue'} bordered={false} style={{ 
            fontSize: 13, 
            padding: '4px 12px', 
            borderRadius: 6,
            backgroundColor: tradeMode === 'real' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            color: tradeMode === 'real' ? '#ef4444' : '#60a5fa',
            border: `1px solid ${tradeMode === 'real' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
            fontWeight: 700
          }}>
            {modeLabel}
          </Tag>
          <Tag color="green" bordered={false} style={{ 
            fontSize: 11, 
            fontWeight: 800, 
            borderRadius: 4,
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            color: '#4ade80',
            border: '1px solid rgba(74, 222, 128, 0.2)'
          }}>
            Data: {sourceLabel}
          </Tag>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>
              Updated: {formatDateTime(lastUpdated)}
            </span>
          )}
          <Tag
            color={autoRefreshEnabled ? 'green' : 'default'}
            bordered={false}
            style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, cursor: 'pointer' }}
            onClick={() => setAutoRefreshEnabled(prev => !prev)}
          >
            {autoRefreshEnabled ? 'AUTO: ON' : 'AUTO: OFF'}
          </Tag>
          <Button
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
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={<span style={{ fontWeight: 700 }}>{t.portfolio.apiErrorTitle}</span>}
          description={error}
          action={<Button size="small" type="primary" danger onClick={() => navigate('/settings/configuration')}>{t.portfolio.configureAction}</Button>}
          style={{ marginBottom: 20, borderRadius: 10, border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <Col xs={24} sm={12} xl={kpi.label === t.portfolio.totalUnrealizedPL ? 4 : 5} key={kpi.label}>
            <Card 
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

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Card
            title={<span style={{ color: 'var(--app-text-strong)', fontWeight: 700 }}>{t.portfolio.portfolioPerformance}</span>}
            extra={
              <Space wrap>
                <Tag
                  color={portfolioChange.value >= 0 ? 'success' : 'error'}
                  icon={portfolioChange.value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  style={{
                    fontSize: 13,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: portfolioChange.value >= 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: portfolioChange.value >= 0 ? '#4ade80' : '#ef4444'
                  }}
                >
                  {formatSignedMoney(portfolioChange.value)} ({formatPercent(portfolioChange.percent)})
                </Tag>
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
            style={{ borderRadius: 10, marginBottom: 16, background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : error ? (
              <Empty description={t.portfolio.portfolioHistoryLoadFailed}>
                <Text style={{ color: '#ef4444', fontWeight: 600 }}>{error}</Text>
              </Empty>
            ) : portfolioHistory.length === 0 ? (
              <Empty description={t.portfolio.noPortfolioHistory}>
                <Text style={{ color: 'var(--app-text-muted)' }}>{t.portfolio.noPortfolioHistoryDesc}</Text>
              </Empty>
            ) : (
              <>
              <div style={{ height: 400, marginTop: 10 }}>
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
                        const options: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };

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
                      tickFormatter={(v) => formatCompactMoney(v)}
                      width={64}
                      tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      domain={yDomain}
                      tickCount={6}
                    />
                    <RechartsTooltip
                      content={<CustomTooltip t={t} localeName={localeName} history={portfolioHistory} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="var(--app-blue-text)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorEquity)"
                      name={t.portfolio.portfolioValueLine}
                      activeDot={{ r: 6, stroke: 'var(--app-card-bg)', strokeWidth: 2, fill: 'var(--app-blue-text)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {usingFallback ? (
                <Alert
                  message={t.portfolio.fallbackHistoryBanner}
                  type="warning"
                  showIcon
                  style={{ marginTop: 16, borderRadius: 10 }}
                />
              ) : source ? (
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <Text style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>
                    <SafetyCertificateOutlined style={{ color: '#4ade80', marginRight: 4 }} />
                    {t.portfolio.verifiedAlpacaHistory}
                    {' · '}
                    {sourceLabel}
                  </Text>
                </div>
              ) : null}
              </>
            )}
          </Card>

          <Card 
            title={<span style={{ color: 'var(--app-text-strong)', fontWeight: 700 }}>{t.portfolio.holdings}</span>} 
            style={{ borderRadius: 10, background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
            bodyStyle={{ padding: 0 }}
          >
            <style>{`
              .portfolio-table .ant-table-thead > tr > th { 
                background: var(--app-table-header-bg) !important; 
                color: var(--app-text-muted) !important;
                font-weight: 700 !important;
                font-size: 11px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                padding: 12px 16px !important;
                border-bottom: 1px solid var(--app-border-soft) !important;
              }
              .portfolio-table .ant-table-thead > tr > th:first-child,
              .portfolio-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
              .portfolio-row > td { border-bottom: 1px solid var(--app-border-soft) !important; background: var(--app-card-bg) !important; color: var(--app-text) !important; }
              .portfolio-row:hover > td { background-color: var(--app-card-bg-soft) !important; }
              .ant-table-placeholder .ant-table-cell { background: var(--app-card-bg) !important; border-bottom: none !important; }
            `}</style>
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
                scroll={{ x: 1180 }}
                rowClassName="portfolio-row"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card 
            title={<span style={{ color: 'var(--app-text-strong)', fontWeight: 700 }}>{t.portfolio.summary}</span>} 
            style={{ borderRadius: 10, background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
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
                    <Tag color={account?.status === 'ACTIVE' ? 'green' : account?.status ? 'orange' : 'default'} style={{ margin: 0 }}>{account?.status || '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.tradingMode}>
                    <Tag color={tradeMode === 'real' ? 'red' : 'blue'} style={{ margin: 0 }}>{modeLabel}</Tag>
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

                <div style={{ 
                  padding: '16px', 
                  borderRadius: 10, 
                  background: tradeMode === 'real' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)', 
                  border: `1px solid ${tradeMode === 'real' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'}` 
                }}>
                  <Text style={{ color: tradeMode === 'real' ? '#ef4444' : 'var(--app-blue-text)', fontWeight: 600, fontSize: 13, lineHeight: 1.5, display: 'block' }}>
                    {tradeMode === 'real' ? t.portfolio.realModeNote : t.portfolio.paperModeNote}
                  </Text>
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
