import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { backtraderAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './BacktestEditorial.css';

interface EquityPoint {
  date: string;
  equity: number;
}

interface TradeItem {
  tradeId?: number | string;
  entryDate?: string;
  exitDate?: string;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  returnPct?: number;
  position?: number;
  action?: string;
  quantity?: number;
  symbol?: string;
}

interface BacktestResult {
  backtestId?: string;
  name?: string;
  status?: string;
  results?: {
    totalReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    trades?: number;
    annualizedReturn?: number;
    profitLoss?: number;
    calmarRatio?: number;
    avgReturnPerTrade?: number;
    avgWin?: number;
    avgLoss?: number;
    volatility?: number;
    sortinoRatio?: number;
    profitFactor?: number;
    expectancy?: number;
    exposure?: number;
    equityCurve?: EquityPoint[];
    tradesList?: TradeItem[];
  };
  parameters?: Record<string, unknown> & {
    strategy?: string;
    symbols?: string[];
    period?: string;
    initialCapital?: number;
    startDate?: string;
    endDate?: string;
  };
  createdAt?: string;
}

type ValueKind = 'percent' | 'currency' | 'ratio' | 'integer';

interface MetricRow {
  key: string;
  metric: string;
  value: number | null;
  kind: ValueKind;
  description: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/[$,%]/g, '').replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const dateToMilliseconds = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  const numeric = /^\d+$/.test(normalized) ? Number(normalized) : null;
  const milliseconds = numeric === null
    ? new Date(normalized).getTime()
    : (numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

const DETAIL_TAB_KEYS = ['overview', 'curves', 'parameters', 'trades'] as const;

const normalizeRecord = (record: any, id?: string): BacktestResult => {
  const results = record?.results || record || {};
  return {
    ...record,
    backtestId: record?.backtestId || record?.id || id,
    results,
    parameters: record?.parameters || record?.config || {},
  };
};

const BacktestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';
  const [loading, setLoading] = React.useState(true);
  const [record, setRecord] = React.useState<BacktestResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const copy = React.useMemo(() => ({
    kicker: isZh ? '02 / 策略验证报告' : '02 / STRATEGY VALIDATION REPORT',
    title: isZh ? '回测研究报告' : 'Backtest research report',
    subtitle: isZh
      ? '把收益、风险、回撤和研究参数放在同一份可复核报告中。'
      : 'Review return, risk, drawdown, and research parameters in one report.',
    back: isZh ? '返回策略回测' : 'Back to backtests',
    refresh: isZh ? '刷新报告' : 'Refresh report',
    loading: isZh ? '正在载入回测报告…' : 'Loading backtest report…',
    loadError: isZh ? '无法载入回测报告' : 'Unable to load backtest report',
    notFound: isZh ? '没有找到这份回测记录' : 'Backtest record not found',
    notFoundHelp: isZh ? '记录可能已被清理，或该链接已失效。可以返回策略页重新运行。' : 'The record may have expired or the link may be incomplete. Return to the strategy page to run it again.',
    id: isZh ? '报告编号' : 'REPORT ID',
    created: isZh ? '生成时间' : 'CREATED',
    noDate: isZh ? '时间未记录' : 'Date unavailable',
    model: isZh ? '策略模型' : 'STRATEGY MODEL',
    scope: isZh ? '研究标的' : 'RESEARCH SCOPE',
    overview: isZh ? '指标概览' : 'Metric overview',
    curves: isZh ? '净值与回撤' : 'Equity & drawdown',
    parameters: isZh ? '参数与范围' : 'Parameters & scope',
    trades: isZh ? '交易摘要' : 'Trade summary',
    metric: isZh ? '指标' : 'Metric',
    value: isZh ? '数值' : 'Value',
    description: isZh ? '解释' : 'Interpretation',
    equity: isZh ? '净值曲线' : 'Equity curve',
    drawdown: isZh ? '回撤曲线' : 'Drawdown curve',
    noCurve: isZh ? '这份历史记录没有保存曲线数据。' : 'This historical record does not include curve data.',
    parametersEmpty: isZh ? '这份记录没有保存参数。' : 'No parameters were saved with this record.',
    tradesEmpty: isZh ? '历史摘要没有保存逐笔交易明细。' : 'Individual trade rows were not retained in this historical summary.',
    tradesHelp: isZh ? '核心交易统计仍保留在上方；重新运行回测可生成新的完整记录。' : 'Core trade statistics remain available above. Run a new backtest to create a fresh full record.',
    runNew: isZh ? '运行新回测' : 'Run new backtest',
    unknown: isZh ? '未记录' : 'Not recorded',
  }), [isZh]);

  const loadRecord = React.useCallback(async () => {
    if (!id) {
      setError(copy.notFound);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let history: any[] = [];
      try {
        const historyResponse = await backtraderAPI.getBacktestHistory();
        history = Array.isArray(historyResponse.data?.history) ? historyResponse.data.history : [];
      } catch {
        // Continue through the local and direct-record fallbacks.
      }
      const fromHistory = history.find((item: any) => String(item?.backtestId || item?.id) === id);
      if (fromHistory) {
        setRecord(normalizeRecord(fromHistory, id));
        return;
      }

      try {
        const saved = window.localStorage.getItem('quant_backtest_history');
        const localHistory = saved ? JSON.parse(saved) : [];
        const localRecord = Array.isArray(localHistory)
          ? localHistory.find((item: any) => String(item?.backtestId || item?.id) === id)
          : null;
        if (localRecord) {
          setRecord(normalizeRecord(localRecord, id));
          return;
        }
      } catch {
        // A malformed local cache should not prevent the API fallback below.
      }

      const response = await backtraderAPI.getBacktestResults(id);
      const payload = response.data;
      const directRecord = payload?.result ?? payload?.backtest ?? payload;
      if (!directRecord || typeof directRecord !== 'object') throw new Error(copy.notFound);
      setRecord(normalizeRecord(directRecord, id));
    } catch (requestError) {
      setRecord(null);
      setError(
        requestError instanceof Error && requestError.message === copy.notFound
          ? copy.notFound
          : copy.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, copy.notFound, id]);

  React.useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const results = React.useMemo(() => record?.results || {}, [record?.results]);
  const parameters = React.useMemo(() => record?.parameters || {}, [record?.parameters]);
  const symbols = Array.isArray(parameters.symbols) ? parameters.symbols.filter(Boolean) : [];
  const strategy = String(parameters.strategy || record?.name || copy.unknown);
  const strategyLabel = (t.strategies as Record<string, string>)[strategy] || strategy.replace(/_/g, ' ');
  const requestedTab = searchParams.get('tab');
  const activeTab = DETAIL_TAB_KEYS.includes(requestedTab as typeof DETAIL_TAB_KEYS[number])
    ? requestedTab as typeof DETAIL_TAB_KEYS[number]
    : 'overview';

  const handleTabChange = React.useCallback((tab: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', tab);
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const equityData = React.useMemo(() => (
    Array.isArray(results.equityCurve)
      ? results.equityCurve
        .flatMap((point) => {
          const date = typeof point?.date === 'string' ? point.date.trim() : '';
          const equity = finiteNumber(point?.equity);
          return date && dateToMilliseconds(date) !== null && equity !== null ? [{ date, equity }] : [];
        })
        .sort((left, right) => (dateToMilliseconds(left.date) as number) - (dateToMilliseconds(right.date) as number))
      : []
  ), [results.equityCurve]);

  const drawdownData = React.useMemo(() => {
    let peak: number | null = null;
    return equityData.flatMap((point) => {
      peak = peak === null ? point.equity : Math.max(peak, point.equity);
      if (peak <= 0) return [];
      peak = Math.max(peak, point.equity);
      return [{
        date: point.date,
        drawdown: ((point.equity / peak) - 1) * 100,
      }];
    });
  }, [equityData]);

  const metricRows = React.useMemo<MetricRow[]>(() => {
    const initialCapital = finiteNumber(parameters.initialCapital);
    const totalReturn = finiteNumber(results.totalReturn);
    const annualized = finiteNumber(results.annualizedReturn);
    const suppliedProfitLoss = finiteNumber(results.profitLoss);
    const profitLoss = suppliedProfitLoss !== null
      ? suppliedProfitLoss
      : initialCapital !== null && totalReturn !== null
        ? initialCapital * totalReturn / 100
        : null;
    const maxDrawdown = finiteNumber(results.maxDrawdown);
    const rows: MetricRow[] = [
      { key: 'totalReturn', metric: isZh ? '总收益率' : 'Total return', value: totalReturn, kind: 'percent', description: isZh ? '完整研究区间的累计收益。' : 'Cumulative return over the full study window.', sentiment: totalReturn === null ? undefined : totalReturn >= 0 ? 'positive' : 'negative' },
      { key: 'annualizedReturn', metric: isZh ? '年化收益率' : 'Annualized return', value: annualized, kind: 'percent', description: isZh ? '按年度折算的复合收益。' : 'Compounded return expressed on an annual basis.', sentiment: annualized === null ? undefined : annualized >= 0 ? 'positive' : 'negative' },
      { key: 'profitLoss', metric: isZh ? '损益金额' : 'Profit / loss', value: profitLoss, kind: 'currency', description: isZh ? '相对初始资金的估算损益。' : 'Estimated profit or loss relative to initial capital.', sentiment: profitLoss === null ? undefined : profitLoss >= 0 ? 'positive' : 'negative' },
      { key: 'sharpeRatio', metric: isZh ? '夏普比率' : 'Sharpe ratio', value: finiteNumber(results.sharpeRatio), kind: 'ratio', description: isZh ? '每单位总波动获得的超额收益。' : 'Excess return earned per unit of total volatility.' },
      { key: 'sortinoRatio', metric: isZh ? '索提诺比率' : 'Sortino ratio', value: finiteNumber(results.sortinoRatio), kind: 'ratio', description: isZh ? '只考虑下行波动的风险调整收益。' : 'Risk-adjusted return using downside volatility only.' },
      { key: 'calmarRatio', metric: isZh ? '卡玛比率' : 'Calmar ratio', value: finiteNumber(results.calmarRatio), kind: 'ratio', description: isZh ? '年化收益相对最大回撤的效率。' : 'Annualized return relative to maximum drawdown.' },
      { key: 'maxDrawdown', metric: isZh ? '最大回撤' : 'Maximum drawdown', value: maxDrawdown === null ? null : -Math.abs(maxDrawdown), kind: 'percent', description: isZh ? '从历史峰值到谷值的最大跌幅。' : 'Largest peak-to-trough decline during the study.', sentiment: maxDrawdown === null ? undefined : 'negative' },
      { key: 'winRate', metric: isZh ? '胜率' : 'Win rate', value: finiteNumber(results.winRate), kind: 'percent', description: isZh ? '盈利交易占全部交易的比例。' : 'Share of completed trades that were profitable.' },
      { key: 'trades', metric: isZh ? '交易次数' : 'Trades', value: finiteNumber(results.trades), kind: 'integer', description: isZh ? '研究期间完成的交易数量。' : 'Number of completed trades in the study.' },
      { key: 'profitFactor', metric: isZh ? '盈亏比因子' : 'Profit factor', value: finiteNumber(results.profitFactor), kind: 'ratio', description: isZh ? '总盈利除以总亏损绝对值。' : 'Gross profit divided by absolute gross loss.' },
      { key: 'volatility', metric: isZh ? '年化波动率' : 'Annualized volatility', value: finiteNumber(results.volatility), kind: 'percent', description: isZh ? '策略收益的年化波动程度。' : 'Annualized variability of strategy returns.' },
      { key: 'exposure', metric: isZh ? '持仓暴露' : 'Market exposure', value: finiteNumber(results.exposure), kind: 'percent', description: isZh ? '策略处于持仓状态的时间比例。' : 'Share of time the strategy held a position.' },
    ];
    return rows;
  }, [isZh, parameters.initialCapital, results]);

  const formatMetric = React.useCallback((row: MetricRow) => {
    if (row.value === null) return copy.unknown;
    if (row.kind === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(row.value);
    if (row.kind === 'integer') return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(row.value);
    if (row.kind === 'percent') return `${row.value > 0 ? '+' : ''}${row.value.toFixed(2)}%`;
    return row.value.toFixed(2);
  }, [copy.unknown, locale]);

  const columns = React.useMemo<ColumnsType<MetricRow>>(() => [
    { title: copy.metric, dataIndex: 'metric', key: 'metric', width: 220, render: (value: string) => <strong>{value}</strong> },
    {
      title: copy.value,
      key: 'value',
      width: 170,
      align: 'right',
      render: (_, row) => <span className={`bt-detail-value${row.sentiment ? ` is-${row.sentiment}` : ''}`}>{formatMetric(row)}</span>,
    },
    { title: copy.description, dataIndex: 'description', key: 'description' },
  ], [copy.description, copy.metric, copy.value, formatMetric]);

  const chartDate = React.useCallback((value: string) => {
    const milliseconds = dateToMilliseconds(value);
    return milliseconds === null ? value : new Date(milliseconds).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }, [locale]);

  const moneyTick = React.useCallback((value: unknown) => {
    const numericValue = finiteNumber(value);
    if (numericValue === null) return copy.unknown;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: Math.abs(numericValue) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(numericValue) < 1000 ? 2 : 1,
    }).format(numericValue);
  }, [copy.unknown, locale]);

  const parameterLabels = React.useMemo<Record<string, string>>(() => ({
    symbol: t.comparison.paramSymbol,
    symbols: t.comparison.paramSymbol,
    strategy: t.comparison.paramStrategy,
    period: t.comparison.paramPeriod,
    startDate: t.backtest.startDate,
    endDate: t.backtest.endDate,
    initialCapital: t.comparison.paramInitialCapital,
    dataSource: t.comparison.paramDataSource,
    dataMode: t.comparison.paramDataMode,
    createdAt: t.comparison.paramCreatedAt,
    backtestId: t.comparison.paramBacktestId,
    status: t.comparison.paramStatus,
    shortMaPeriod: t.backtest.paramShortMaPeriod,
    longMaPeriod: t.backtest.paramLongMaPeriod,
    rsiPeriod: t.backtest.paramRsiPeriod,
    rsiOversold: t.backtest.paramRsiOversold,
    rsiOverbought: t.backtest.paramRsiOverbought,
    macdFast: t.backtest.paramMacdFast,
    macdSlow: t.backtest.paramMacdSlow,
    macdSignal: t.backtest.paramMacdSignal,
    bollingerPeriod: t.backtest.paramBollingerPeriod,
    bollingerStdDev: t.backtest.paramBollingerStdDev,
    momentumPeriod: t.backtest.paramMomentumPeriod,
    lookbackPeriod: t.backtest.paramLookbackPeriod,
    entryZScore: t.backtest.paramEntryZScore,
    exitZScore: t.backtest.paramExitZScore,
    stopLossPct: t.backtest.paramStopLossPct,
    takeProfitPct: t.backtest.paramTakeProfitPct,
    entryPeriod: t.backtest.paramEntryPeriod,
    exitPeriod: t.backtest.paramExitPeriod,
    atrPeriod: t.backtest.paramAtrPeriod,
    atrStopMultiple: t.backtest.paramAtrStopMultiple,
  }), [t]);

  const parameterRows = React.useMemo(() => {
    const rows: Array<{ key: string; label: string; value: string }> = [];
    const addRow = (key: string, value: unknown, parentKey?: string) => {
      if (value === undefined || value === null || value === '') return;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => addRow(childKey, childValue, key));
        return;
      }
      const rawLabel = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
      const label = parameterLabels[key] || rawLabel.replace(/\b\w/g, character => character.toUpperCase());
      const displayValue = Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'boolean'
          ? (value ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No'))
          : String(value);
      rows.push({ key: parentKey ? `${parentKey}.${key}` : key, label, value: displayValue });
    };
    Object.entries(parameters).forEach(([key, value]) => addRow(key, value));
    return rows;
  }, [isZh, parameterLabels, parameters]);

  const tradeColumns = React.useMemo<ColumnsType<TradeItem>>(() => {
    const formatTradeDate = (value: unknown) => {
      if (typeof value !== 'string' || !value.trim()) return copy.unknown;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale);
    };
    const formatTradeNumber = (value: unknown, options?: Intl.NumberFormatOptions) => {
      const numericValue = finiteNumber(value);
      return numericValue === null
        ? copy.unknown
        : new Intl.NumberFormat(locale, options).format(numericValue);
    };
    return [
      { title: t.backtest.entryDate, dataIndex: 'entryDate', key: 'entryDate', render: formatTradeDate },
      { title: t.backtest.exitDate, dataIndex: 'exitDate', key: 'exitDate', render: formatTradeDate },
      { title: t.backtest.symbolCol, dataIndex: 'symbol', key: 'symbol', render: (value: unknown) => value ? String(value) : copy.unknown },
      {
        title: t.backtest.action,
        dataIndex: 'action',
        key: 'action',
        render: (value: unknown, trade) => value
          ? String(value)
          : trade.position === 1
            ? 'BUY'
            : trade.position === -1
              ? 'SELL'
              : copy.unknown,
      },
      { title: t.backtest.entryPrice, dataIndex: 'entryPrice', key: 'entryPrice', align: 'right', render: (value: unknown) => formatTradeNumber(value, { style: 'currency', currency: 'USD' }) },
      { title: t.backtest.exitPrice, dataIndex: 'exitPrice', key: 'exitPrice', align: 'right', render: (value: unknown) => formatTradeNumber(value, { style: 'currency', currency: 'USD' }) },
      {
        title: t.backtest.pnlDollar,
        dataIndex: 'pnl',
        key: 'pnl',
        align: 'right',
        render: (value: unknown) => {
          const numericValue = finiteNumber(value);
          if (numericValue === null) return copy.unknown;
          return <span className={numericValue > 0 ? 'bt-detail-value is-positive' : numericValue < 0 ? 'bt-detail-value is-negative' : 'bt-detail-value'}>{formatTradeNumber(numericValue, { style: 'currency', currency: 'USD' })}</span>;
        },
      },
      {
        title: t.backtest.returnLabel,
        dataIndex: 'returnPct',
        key: 'returnPct',
        align: 'right',
        render: (value: unknown) => {
          const numericValue = finiteNumber(value);
          return numericValue === null ? copy.unknown : `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
        },
      },
    ];
  }, [copy.unknown, locale, t.backtest]);

  if (loading) {
    return (
      <div className="backtest-editorial bt-detail-state" role="status">
        <Spin size="large" />
        <span>{copy.loading}</span>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="backtest-editorial bt-detail-state">
        <Alert
          type="error"
          showIcon
          message={error ? copy.loadError : copy.notFound}
          description={error || copy.notFoundHelp}
          action={<Button type="primary" onClick={() => navigate('/backtest')}>{copy.back}</Button>}
        />
      </div>
    );
  }

  const status = String(record.status || 'completed').toLowerCase();
  const statusLabel = status === 'completed'
    ? (isZh ? '已完成' : 'Completed')
    : status === 'running'
      ? (isZh ? '运行中' : 'Running')
      : status === 'failed'
        ? (isZh ? '失败' : 'Failed')
        : status;
  const createdLabel = record.createdAt
    ? new Date(record.createdAt).toLocaleString(locale)
    : copy.noDate;

  const summaryNumber = (value: unknown, digits: number, suffix = '') => {
    const numericValue = finiteNumber(value);
    if (numericValue === null) return copy.unknown;
    return `${numericValue > 0 && suffix === '%' ? '+' : ''}${numericValue.toFixed(digits)}${suffix}`;
  };
  const totalReturn = finiteNumber(results.totalReturn);
  const annualizedReturn = finiteNumber(results.annualizedReturn);
  const maxDrawdown = finiteNumber(results.maxDrawdown);
  const summary = [
    { label: isZh ? '总收益' : 'TOTAL RETURN', value: summaryNumber(results.totalReturn, 2, '%'), tone: totalReturn === null ? undefined : totalReturn >= 0 ? 'positive' : 'negative' },
    { label: isZh ? '年化收益' : 'ANNUALIZED', value: summaryNumber(results.annualizedReturn, 2, '%'), tone: annualizedReturn === null ? undefined : annualizedReturn >= 0 ? 'positive' : 'negative' },
    { label: isZh ? '夏普比率' : 'SHARPE', value: summaryNumber(results.sharpeRatio, 2) },
    { label: isZh ? '最大回撤' : 'MAX DRAWDOWN', value: maxDrawdown === null ? copy.unknown : `${-Math.abs(maxDrawdown).toFixed(2)}%`, tone: maxDrawdown === null ? undefined : 'negative' },
    { label: isZh ? '胜率' : 'WIN RATE', value: summaryNumber(results.winRate, 1, '%') },
    { label: isZh ? '交易数' : 'TRADES', value: finiteNumber(results.trades) === null ? copy.unknown : String(Math.round(finiteNumber(results.trades)!)) },
  ];

  const curvePanel = equityData.length ? (
    <div className="bt-detail-chart-grid">
      <section className="chart-container-premium">
        <h3>{copy.equity}</h3>
        <div className="bt-detail-chart" aria-label={copy.equity}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equityData} margin={{ top: 12, right: 18, bottom: 8, left: 4 }}>
              <CartesianGrid stroke="var(--bt-rule-soft)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={chartDate} minTickGap={48} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={moneyTick} width={72} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip formatter={(value) => [moneyTick(value), copy.equity]} labelFormatter={(value) => chartDate(String(value))} />
              <Line type="monotone" dataKey="equity" stroke="var(--bt-blue)" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="chart-container-premium">
        <h3>{copy.drawdown}</h3>
        <div className="bt-detail-chart bt-detail-chart--drawdown" aria-label={copy.drawdown}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={drawdownData} margin={{ top: 12, right: 18, bottom: 8, left: 4 }}>
              <defs>
                <linearGradient id="btDrawdownFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--bt-red)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--bt-red)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--bt-rule-soft)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={chartDate} minTickGap={48} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => {
                const numericValue = finiteNumber(value);
                return numericValue === null ? copy.unknown : `${numericValue.toFixed(1)}%`;
              }} width={58} tickLine={false} axisLine={false} domain={['auto', 0]} />
              <Tooltip formatter={(value) => {
                const numericValue = finiteNumber(value);
                return [numericValue === null ? copy.unknown : `${numericValue.toFixed(2)}%`, copy.drawdown];
              }} labelFormatter={(value) => chartDate(String(value))} />
              <Area type="monotone" dataKey="drawdown" stroke="var(--bt-red)" strokeWidth={1.8} fill="url(#btDrawdownFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  ) : <div className="bt-chart-empty"><Empty description={copy.noCurve} /></div>;

  return (
    <div className="backtest-editorial backtest-detail-editorial">
      <div className="bt-detail-toolbar">
        <Button className="secondary-action-btn" icon={<ArrowLeftOutlined />} onClick={() => navigate('/backtest')}>{copy.back}</Button>
        <Button className="secondary-action-btn" icon={<ReloadOutlined />} onClick={() => void loadRecord()}>{copy.refresh}</Button>
      </div>

      <header className="bt-hero bt-detail-hero">
        <div className="bt-hero__copy">
          <span className="bt-kicker">{copy.kicker}</span>
          <h1 className="ant-typography">{copy.title}</h1>
          <p>{copy.subtitle}</p>
          <div className="bt-hero__meta">
            <span><i className={status === 'running' ? 'is-running' : 'is-ready'} />{statusLabel}</span>
            <span>{copy.id}: {record.backtestId || id}</span>
            <span>{copy.created}: {createdLabel}</span>
          </div>
        </div>
        <aside className="bt-hero__instrument">
          <span>{copy.model}</span>
          <strong>{strategyLabel}</strong>
          <small>{copy.scope}: {symbols.join(', ') || copy.unknown}</small>
        </aside>
      </header>

      <section className="performance-strip bt-detail-performance" aria-label={copy.overview}>
        {summary.map((item) => (
          <article className="stat-metric-card" key={item.label}>
            <span className="stat-metric-label">{item.label}</span>
            <strong className={`stat-metric-value${item.tone ? ` is-${item.tone}` : ''}`}>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="premium-card backtest-report-card bt-detail-report">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'overview',
              label: copy.overview,
              children: <Table columns={columns} dataSource={metricRows} pagination={false} rowKey="key" scroll={{ x: 720 }} />,
            },
            { key: 'curves', label: copy.curves, children: curvePanel },
            {
              key: 'parameters',
              label: copy.parameters,
              children: parameterRows.length ? (
                <div className="bt-detail-parameter-grid">
                  {parameterRows.map((item) => (
                    <article className="blueprint-module" key={item.key}>
                      <span className="blueprint-label">{item.label}</span>
                      <strong className="blueprint-value">{item.value}</strong>
                    </article>
                  ))}
                </div>
              ) : <Empty description={copy.parametersEmpty} />,
            },
            {
              key: 'trades',
              label: copy.trades,
              children: Array.isArray(results.tradesList) && results.tradesList.length > 0 ? (
                <Table
                  columns={tradeColumns}
                  dataSource={results.tradesList}
                  rowKey={(trade, index) => String(trade.tradeId ?? `${trade.entryDate || 'trade'}-${index}`)}
                  pagination={{ pageSize: 12, simple: true }}
                  scroll={{ x: 900 }}
                />
              ) : (
                <div className="bt-detail-trades-empty">
                  <Empty description={copy.tradesEmpty} />
                  <p>{copy.tradesHelp}</p>
                  <Button type="primary" onClick={() => navigate('/backtest')}>{copy.runNew}</Button>
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
};

export default BacktestDetail;
