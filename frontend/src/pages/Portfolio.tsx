import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { PieChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tradingAccountAPI, TradingAccountResponse, TradingPosition } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';

const { Title, Text } = Typography;
const { Option } = Select;

type TradingMode = 'paper' | 'real';

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
  if (value > 0) return '#0f9f6e';
  if (value < 0) return '#d14343';
  return '#6b7280';
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
  return data?.error || data?.message || error?.message || fallback;
};

const normalizeHistory = (rows: any[]): HistoryPoint[] => {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const ts = normalizeTimestamp(row?.timestamp);
      if (!ts) return null;
      return {
        timestamp: ts,
        equity: asNumber(row?.equity),
        profitLoss: asNumber(row?.profitLoss ?? row?.pnl),
        profitLossPct: asNumber(row?.profitLossPct ?? row?.pnlPct),
      };
    })
    .filter(Boolean) as HistoryPoint[];
};

const Portfolio: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [account, setAccount] = useState<TradingAccountResponse | null>(null);
  const [positions, setPositions] = useState<TradingPosition[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<HistoryPoint[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1M');
  const [portfolioMode, setPortfolioMode] = useState<TradingMode>('paper');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });
  const [source, setSource] = useState<'alpaca_paper' | 'alpaca_real' | undefined>();
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const loadData = async (mode: TradingMode = portfolioMode, range: string = portfolioRange) => {
    setLoading(true);
    setError(null);
    setAccount(null);
    setPositions([]);
    setPortfolioHistory([]);
    setPortfolioChange({ value: 0, percent: 0 });
    setSource(undefined);
    setLastUpdated('');

    try {
      const [accountRes, positionsRes, historyRes] = await Promise.allSettled([
        tradingAccountAPI.getAccount(mode),
        tradingAccountAPI.getPositions(mode),
        tradingAccountAPI.getPortfolioHistory(mode, range),
      ]);

      let nextError: string | null = null;
      let nextUpdatedAt = '';
      let nextSource: 'alpaca_paper' | 'alpaca_real' | undefined;

      if (accountRes.status === 'fulfilled') {
        const data = accountRes.value.data;
        if (data.success && data.available !== false) {
          setAccount(data);
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

      if (historyRes.status === 'fulfilled') {
        const data = historyRes.value.data;
        if (data.success) {
          const normalized = normalizeHistory(data.data || []);
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
      } else if (!nextError) {
        nextError = extractApiError(historyRes.reason, t.portfolio.dataUnavailable);
      }

      setSource(nextSource);
      setLastUpdated(nextUpdatedAt);
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(portfolioMode, portfolioRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioMode, tradeMode]);

  const handlePortfolioRangeChange = (range: string) => {
    setPortfolioRange(range);
    loadData(portfolioMode, range);
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

  const modeLabel = portfolioMode === 'real' ? t.portfolio.realTrading : t.portfolio.paperTrading;
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
          <Title level={2} style={{ marginBottom: 4 }}>
            <PieChartOutlined style={{ marginRight: 12, color: '#2563eb' }} />
            {t.portfolio.title}
          </Title>
          <Text type="secondary">{t.portfolio.subtitle}</Text>
        </div>
        <Space wrap>
          <Select
            value={portfolioMode}
            onChange={(value) => setPortfolioMode(value as TradingMode)}
            style={{ width: 160 }}
            aria-label={t.portfolio.mode}
          >
            <Option value="paper">{t.portfolio.paperTrading}</Option>
            <Option value="real">{t.portfolio.realTrading}</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
            {t.portfolio.refresh}
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t.portfolio.apiErrorTitle}
          description={error}
          action={<Button size="small" onClick={() => navigate('/settings/configuration')}>{t.portfolio.configureAction}</Button>}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <Col xs={24} sm={12} xl={kpi.label === t.portfolio.totalUnrealizedPL ? 4 : 5} key={kpi.label}>
            <Card style={{ borderRadius: 8, minHeight: 128 }} bodyStyle={{ padding: 18 }}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: '55%' }} />
              ) : (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{kpi.label}</Text>
                  <Text style={{ fontSize: 24, fontWeight: 800, color: toneColor(kpi.tone) }}>{kpi.value}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{kpi.detail}</Text>
                </Space>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Card
            title={t.portfolio.portfolioPerformance}
            extra={
              <Space wrap>
                <Text strong style={{ color: toneColor(portfolioChange.value) }}>
                  {t.portfolio.change}: {formatSignedMoney(portfolioChange.value)} ({formatPercent(portfolioChange.percent)})
                </Text>
                <Select value={portfolioRange} onChange={handlePortfolioRangeChange} style={{ width: 112 }}>
                  <Option value="1D">{t.portfolio.range1Day}</Option>
                  <Option value="1W">{t.portfolio.range1Week}</Option>
                  <Option value="1M">{t.portfolio.range1Month}</Option>
                  <Option value="1Y">{t.portfolio.range1Year}</Option>
                  <Option value="All">{t.portfolio.rangeAll}</Option>
                </Select>
              </Space>
            }
            style={{ borderRadius: 8, marginBottom: 16 }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : portfolioHistory.length === 0 ? (
              <Empty description={t.portfolio.noPortfolioHistory}>
                <Text type="secondary">{t.portfolio.noPortfolioHistoryDesc}</Text>
              </Empty>
            ) : (
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioHistory} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        if (!ts) return '';
                        const date = new Date(ts);
                        if (portfolioRange === '1D') {
                          return date.toLocaleTimeString(localeName, { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
                        }
                        return date.toLocaleDateString(localeName, { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' });
                      }}
                    />
                    <YAxis yAxisId="left" tickFormatter={(v) => formatMoney(v).replace('.00', '')} width={72} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatMoney(v).replace('.00', '')} width={72} />
                    <RechartsTooltip
                      labelFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp as any);
                        return ts ? new Date(ts).toLocaleString(localeName, { timeZone: 'America/New_York' }) : '';
                      }}
                      formatter={(value: any, name: string) => [formatMoney(value), name]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="equity" stroke="#2563eb" strokeWidth={2.5} dot={false} name={t.portfolio.portfolioValueLine} />
                    <Line yAxisId="right" type="monotone" dataKey="profitLoss" stroke="#0f9f6e" strokeWidth={2} dot={false} name={t.portfolio.profitLossLine} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title={t.portfolio.holdings} style={{ borderRadius: 8 }}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 10 }} />
            ) : positions.length === 0 ? (
              <Empty description={t.portfolio.noPositions} />
            ) : (
              <Table
                columns={positionsColumns}
                dataSource={positions}
                rowKey={(record) => record.symbol}
                size="middle"
                pagination={{ pageSize: 12, showSizeChanger: false }}
                scroll={{ x: 1180 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card title={t.portfolio.summary} style={{ borderRadius: 8 }}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 7 }} />
            ) : !account ? (
              <Empty description={t.portfolio.dataUnavailable} />
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t.portfolio.accountStatus}>
                    <Tag color={account?.status === 'ACTIVE' ? 'green' : account?.status ? 'orange' : 'default'}>{account?.status || '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.tradingMode}>
                    <Tag color={portfolioMode === 'real' ? 'red' : 'blue'}>{modeLabel}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.dataSource}>{sourceLabel}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.lastUpdated}>{formatDateTime(lastUpdated)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.exposure}>{formatPercent(exposure)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.dayTradeBuyingPower}>{formatMoney(account?.dayTradeBuyingPower)}</Descriptions.Item>
                  <Descriptions.Item label={t.portfolio.maintenanceMargin}>{formatMoney(account?.maintenanceMargin)}</Descriptions.Item>
                </Descriptions>

                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>{t.portfolio.riskStatus}</Text>
                  <Space wrap>
                    {account?.tradingBlocked && <Tag color="red">{t.portfolio.tradingBlocked}</Tag>}
                    {account?.accountBlocked && <Tag color="red">{t.portfolio.accountBlocked}</Tag>}
                    {account?.patternDayTrader && <Tag color="gold">{t.portfolio.patternDayTrader}</Tag>}
                    {!account?.tradingBlocked && !account?.accountBlocked && !account?.patternDayTrader && <Tag color="green">{t.portfolio.riskClear}</Tag>}
                  </Space>
                </div>

                <div style={{ padding: 12, borderRadius: 8, background: portfolioMode === 'real' ? '#fff7ed' : '#eff6ff', border: `1px solid ${portfolioMode === 'real' ? '#fed7aa' : '#bfdbfe'}` }}>
                  <Text style={{ color: portfolioMode === 'real' ? '#9a3412' : '#1d4ed8', fontWeight: 700 }}>
                    {portfolioMode === 'real' ? t.portfolio.realModeNote : t.portfolio.paperModeNote}
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
