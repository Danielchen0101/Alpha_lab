import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './StrategyRanking.css';

const { Title, Text } = Typography;
const { Option } = Select;

const CHART_PALETTE = ['#93ad8d', '#6f91b8', '#c38a61', '#a66d61', '#7e8f78', '#7489a1'];

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const safeToFixed = (value: unknown, decimals = 2): string => {
  const parsed = safeNumber(value);
  return parsed === null ? '—' : parsed.toFixed(decimals);
};

const formatPercent = (value: unknown): string => {
  const safeValue = safeNumber(value);
  if (safeValue === null) return '—';
  return `${safeValue >= 0 ? '+' : ''}${safeValue.toFixed(2)}%`;
};

const formatPlainPercent = (value: unknown, decimals = 1): string => {
  const safeValue = safeNumber(value);
  return safeValue === null ? '—' : `${safeValue.toFixed(decimals)}%`;
};

const formatDrawdown = (value: unknown, decimals = 1): string => {
  const safeValue = safeNumber(value);
  if (safeValue === null) return '—';
  const magnitude = Math.abs(safeValue).toFixed(decimals);
  return safeValue === 0 ? `${magnitude}%` : `-${magnitude}%`;
};

const compareNullableDescending = (left: unknown, right: unknown): number => {
  const leftValue = safeNumber(left);
  const rightValue = safeNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue;
};

const compareNullableMagnitudeAscending = (left: unknown, right: unknown): number => {
  const leftValue = safeNumber(left);
  const rightValue = safeNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return Math.abs(leftValue) - Math.abs(rightValue);
};

const maxFinite = (values: Array<number | null>): number | null => {
  const finiteValues = values.filter((value): value is number => value !== null);
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
};

const minMagnitude = (values: Array<number | null>): number | null => {
  const finiteValues = values.filter((value): value is number => value !== null);
  return finiteValues.length > 0 ? Math.min(...finiteValues.map(value => Math.abs(value))) : null;
};

interface RankingItem {
  key: string;
  backtestId: string;
  symbol: string;
  strategy: string;
  totalReturn: number | null;
  annualizedReturn: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number | null;
  volatility: number | null;
  winRate: number | null;
  profitFactor: number | null;
  trades: number | null;
  status: string;
  period: string;
  createdAt: string;
  originalRecord: any;
}

const normalizeHistoryItem = (item: any, index: number, source: 'local' | 'api'): RankingItem => {
  const backtestId = String(item?.backtestId || item?.id || '');
  const rawStatus = String(item?.status || '').toLowerCase();
  const normalizedStatus = ['completed', 'running', 'failed', 'unknown'].includes(rawStatus)
    ? rawStatus
    : 'unknown';
  return {
    key: backtestId || `${source}-${index}`,
    backtestId,
    symbol: String(item?.symbol || item?.parameters?.symbols?.[0] || item?.parameters?.symbol || 'N/A'),
    strategy: String(item?.strategy || item?.parameters?.strategy || 'N/A'),
    totalReturn: safeNumber(item?.results?.totalReturn ?? item?.totalReturn),
    annualizedReturn: safeNumber(item?.results?.annualizedReturn ?? item?.annualizedReturn),
    sharpeRatio: safeNumber(item?.results?.sharpeRatio ?? item?.sharpeRatio),
    sortinoRatio: safeNumber(item?.results?.sortinoRatio ?? item?.sortinoRatio),
    maxDrawdown: safeNumber(item?.results?.maxDrawdown ?? item?.maxDrawdown),
    volatility: safeNumber(item?.results?.volatility ?? item?.volatility),
    winRate: safeNumber(item?.results?.winRate ?? item?.winRate),
    profitFactor: safeNumber(item?.results?.profitFactor ?? item?.profitFactor),
    trades: safeNumber(item?.results?.trades ?? item?.trades),
    status: normalizedStatus,
    period: item?.period || item?.parameters?.period || `${item?.startDate || ''} - ${item?.endDate || ''}`,
    createdAt: item?.createdAt || item?.timestamp || '',
    originalRecord: item,
  };
};

const StrategyRanking: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [loadIssue, setLoadIssue] = useState<'remote' | 'local' | 'load' | null>(null);
  const [searchText, setSearchText] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalReturn');
  const [showCompletedOnly, setShowCompletedOnly] = useState(true);

  const loadLocalBacktestHistory = (): { records: RankingItem[]; failed: boolean } => {
    try {
      const saved = localStorage.getItem('quant_backtest_history');
      if (!saved) return { records: [], failed: false };
      const history = JSON.parse(saved);
      const records = Array.isArray(history)
        ? history.map((item: any, index: number) => normalizeHistoryItem(item, index, 'local'))
        : [];
      return { records, failed: !Array.isArray(history) };
    } catch (loadError) {
      console.error('Failed to load local history:', loadError);
      return { records: [], failed: true };
    }
  };

  const fetchRankingData = async () => {
    setLoading(true);
    setLoadIssue(null);

    try {
      const localHistory = loadLocalBacktestHistory();
      let combinedData = localHistory.records;
      let apiUnavailable = false;
      try {
        const response = await backtraderAPI.getBacktestHistory();
        const apiHistory = response.data?.history;
        if (Array.isArray(apiHistory)) {
          const apiData = apiHistory.map((item: any, index: number) => normalizeHistoryItem(item, index, 'api'));
          const dataMap = new Map<string, RankingItem>();
          combinedData.forEach(item => dataMap.set(item.backtestId || item.key, item));
          apiData.forEach((item: RankingItem) => dataMap.set(item.backtestId || item.key, item));
          combinedData = Array.from(dataMap.values());
        } else {
          throw new Error('Invalid backtest history response');
        }
      } catch (apiError) {
        console.warn('API history fetch failed, using local only', apiError);
        apiUnavailable = true;
      }
      if (apiUnavailable) setLoadIssue('remote');
      else if (localHistory.failed) setLoadIssue(combinedData.length > 0 ? 'local' : 'load');
      setRankingData(combinedData);
    } catch (fetchError) {
      console.error('Failed to load ranking data:', fetchError);
      setRankingData([]);
      setLoadIssue('load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRankingData();
    // Ranking data is refreshed manually after the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let data = [...rankingData];
    if (showCompletedOnly) data = data.filter(item => item.status === 'completed');
    if (searchText) {
      const query = searchText.toLowerCase();
      data = data.filter(item => item.symbol.toLowerCase().includes(query) || item.strategy.toLowerCase().includes(query));
    }
    if (strategyFilter !== 'All') data = data.filter(item => item.strategy === strategyFilter);

    data.sort((a, b) => {
      const primaryDifference = sortBy === 'maxDrawdown'
        ? compareNullableMagnitudeAscending(a.maxDrawdown, b.maxDrawdown)
        : compareNullableDescending((a as any)[sortBy], (b as any)[sortBy]);
      if (primaryDifference !== 0) return primaryDifference;
      const sharpeDifference = compareNullableDescending(a.sharpeRatio, b.sharpeRatio);
      if (sharpeDifference !== 0) return sharpeDifference;
      return compareNullableMagnitudeAscending(a.maxDrawdown, b.maxDrawdown);
    });
    return data;
  }, [rankingData, searchText, strategyFilter, sortBy, showCompletedOnly]);

  const rankableData = useMemo(() => filteredAndSortedData.filter(item => (
    (item.status === 'completed' || item.status === 'unknown')
    && [
      item.totalReturn,
      item.sharpeRatio,
      item.maxDrawdown,
      item.winRate,
      item.profitFactor,
      item.trades,
    ].some(value => value !== null)
  )), [filteredAndSortedData]);
  const rankPositionByKey = useMemo(() => new Map<string, number>(
    rankableData.map((item, index) => [item.key, index + 1]),
  ), [rankableData]);

  const strategies = useMemo(() => Array.from(new Set(
    rankingData.filter(item => item.strategy && item.strategy !== 'N/A').map(item => item.strategy),
  )).sort(), [rankingData]);

  const summaryStats = useMemo(() => {
    if (rankableData.length === 0) return null;
    return {
      count: rankableData.length,
      bestReturn: maxFinite(rankableData.map(item => item.totalReturn)),
      bestSharpe: maxFinite(rankableData.map(item => item.sharpeRatio)),
      lowestDD: minMagnitude(rankableData.map(item => item.maxDrawdown)),
      bestWinRate: maxFinite(rankableData.map(item => item.winRate)),
      coveredStrategies: new Set(rankableData.filter(item => item.strategy !== 'N/A').map(item => item.strategy)).size,
    };
  }, [rankableData]);

  const riskRewardData = useMemo(() => rankableData
    .filter((item): item is RankingItem & { maxDrawdown: number; totalReturn: number; trades: number } => (
      item.maxDrawdown !== null && item.totalReturn !== null && item.trades !== null
    ))
    .map((item, index) => ({
      label: `${item.symbol} · ${(t.strategies as Record<string, string>)[item.strategy] || item.strategy.replace(/_/g, ' ')}`,
      symbol: item.symbol,
      risk: Math.abs(item.maxDrawdown),
      totalReturn: item.totalReturn,
      trades: item.trades,
      fill: CHART_PALETTE[index % CHART_PALETTE.length],
    })), [rankableData, t]);

  const returnLeaders = useMemo(() => [...rankableData]
    .filter((item): item is RankingItem & { totalReturn: number } => item.totalReturn !== null)
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .slice(0, 8)
    .map((item, index) => ({
      label: `${item.symbol} · ${(t.strategies as Record<string, string>)[item.strategy] || item.strategy.replace(/_/g, ' ')}`,
      totalReturn: item.totalReturn,
      fill: item.totalReturn >= 0 ? CHART_PALETTE[index % CHART_PALETTE.length] : '#b7654e',
  })), [rankableData, t]);

  const getQualityLabel = (item: RankingItem) => {
    if (item.status === 'failed' || item.status === 'running') return { label: t.ranking.qualityNeutral, color: 'default' };
    if (item.trades !== null && item.trades < 3) return { label: t.ranking.qualityLowSample, color: 'default' };
    if (item.totalReturn === null || item.sharpeRatio === null) return { label: t.ranking.qualityNeutral, color: 'default' };
    if (item.totalReturn <= 0 || item.sharpeRatio < 0) return { label: t.ranking.qualityWeak, color: 'error' };
    if (item.maxDrawdown !== null && Math.abs(item.maxDrawdown) > 25) return { label: t.ranking.qualityHighRisk, color: 'warning' };
    if (item.totalReturn > 15 && item.sharpeRatio > 1.5) return { label: t.ranking.qualityElite, color: 'purple' };
    if (item.totalReturn > 8 && item.sharpeRatio > 1) return { label: t.ranking.qualityStrong, color: 'success' };
    if (item.sharpeRatio > 0.8 && item.totalReturn > 0) return { label: t.ranking.qualityStable, color: 'processing' };
    if (item.totalReturn > 10) return { label: t.ranking.qualityHighReturn, color: 'success' };
    return { label: t.ranking.qualityNeutral, color: 'default' };
  };

  const columns: ColumnsType<RankingItem> = [
    {
      title: t.ranking.colRank,
      key: 'rank',
      width: 76,
      fixed: 'left',
      align: 'center',
      render: (_value, record) => {
        const position = rankPositionByKey.get(record.key);
        return position
          ? <div className={`ranking-position ranking-position--${Math.min(position, 4)}`}>{String(position).padStart(2, '0')}</div>
          : <span className="ranking-number">—</span>;
      },
    },
    {
      title: t.ranking.colSymbolStrategy,
      key: 'info',
      width: 215,
      fixed: 'left',
      render: (_value, record) => {
        const quality = getQualityLabel(record);
        return (
          <div className="ranking-strategy-cell">
            <div className="ranking-strategy-cell__top">
              <Tag>{record.symbol}</Tag>
              {quality.label !== t.ranking.qualityNeutral && <Badge status={quality.color as any} text={<span>{quality.label}</span>} />}
            </div>
            <div className="ranking-strategy-cell__name">{(t.strategies as Record<string, string>)[record.strategy] || record.strategy.replace(/_/g, ' ')}</div>
          </div>
        );
      },
    },
    {
      title: t.ranking.colTotalReturn,
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 126,
      render: value => {
        const number = safeNumber(value);
        return <span className={`ranking-number ${number === null ? '' : number >= 0 ? 'is-positive' : 'is-negative'}`}>{formatPercent(number)}</span>;
      },
    },
    {
      title: t.ranking.colSharpe,
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 105,
      render: value => {
        const number = safeNumber(value);
        const tone = number === null ? '' : number >= 1.5 ? 'is-elite' : number >= 1 ? 'is-positive' : number >= 0 ? 'is-caution' : 'is-negative';
        return <span className={`ranking-number ${tone}`}>{safeToFixed(number)}</span>;
      },
    },
    {
      title: t.ranking.colMaxDD,
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 112,
      render: value => {
        const number = safeNumber(value);
        const magnitude = number === null ? null : Math.abs(number);
        const tone = magnitude === null ? '' : magnitude < 15 ? 'is-positive' : magnitude < 25 ? 'is-caution' : 'is-negative';
        return <span className={`ranking-number ${tone}`}>{formatDrawdown(number, 1)}</span>;
      },
    },
    { title: t.ranking.colWinRate, dataIndex: 'winRate', key: 'winRate', width: 108, render: value => <span className="ranking-number">{formatPlainPercent(value, 1)}</span> },
    { title: t.ranking.colProfFactor, dataIndex: 'profitFactor', key: 'profitFactor', width: 118, render: value => { const number = safeNumber(value); return <span className={`ranking-number ${number !== null && number >= 1.5 ? 'is-positive' : ''}`}>{safeToFixed(number)}</span>; } },
    { title: t.ranking.colTrades, dataIndex: 'trades', key: 'trades', width: 82, render: value => { const number = safeNumber(value); return <span className="ranking-number">{number === null ? '—' : number.toLocaleString()}</span>; } },
    { title: t.ranking.colDate, dataIndex: 'createdAt', key: 'createdAt', width: 124, render: date => { const parsed = date ? new Date(date) : null; return <span className="ranking-date">{parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US') : '—'}</span>; } },
    {
      title: t.ranking.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 108,
      render: status => {
        const statusMap: Record<string, string> = { completed: t.comparison.statusCompleted, failed: t.comparison.statusFailed, running: t.comparison.statusRunning, unknown: language === 'zh-CN' ? '未知' : 'Unknown' };
        const color = status === 'completed' ? 'success' : status === 'failed' ? 'error' : status === 'running' ? 'processing' : 'default';
        return <Tag color={color}>{statusMap[status] || status}</Tag>;
      },
    },
  ];

  const editorialCopy = language === 'zh-CN'
    ? {
        kicker: '04 / 策略排行', source: '本地历史 + 回测服务', updated: '按当前筛选即时重排',
        chartKicker: '01 / 风险收益平面', chartTitle: '领先者需要同时经得起回撤检验。', chartNote: '气泡大小代表交易次数；位置来自每个已持久化回测的实际指标。',
        returnChart: '累计收益领先者', ledgerKicker: '02 / 完整记录', ledgerTitle: '策略证据排行榜', ledgerNote: '单击任意行可打开原始回测会话。',
        remoteFallback: '回测服务暂时不可用，当前显示本地保存的历史。', remoteUnavailable: '无法连接回测服务，且本地没有可用记录。', localFallback: '本地历史无法读取，当前显示回测服务返回的记录。', loadError: '无法加载策略排行数据。', retry: '重试',
        noChartData: '当前记录缺少生成该图表所需的完整指标。', filteredEmptyTitle: '没有符合当前筛选的记录', filteredEmptyNote: '调整搜索、策略或状态筛选后再试。', clearFilters: '清除筛选',
      }
    : {
        kicker: '04 / STRATEGY RANKING', source: 'Local history + backtest service', updated: 'Re-ranked from the active filter set',
        chartKicker: '01 / RISK AND RETURN', chartTitle: 'Compare return with the drawdown required to earn it.', chartNote: 'Bubble size shows trade count. Each point comes from a saved backtest.',
        returnChart: 'Cumulative return leaders', ledgerKicker: '02 / SAVED SESSIONS', ledgerTitle: 'Strategy results', ledgerNote: 'Open a row to inspect its original backtest session.',
        remoteFallback: 'The backtest service is unavailable. Showing locally saved history.', remoteUnavailable: 'The backtest service is unavailable and no local records were found.', localFallback: 'Local history could not be read. Showing records returned by the backtest service.', loadError: 'Strategy ranking data could not be loaded.', retry: 'Retry',
        noChartData: 'These records do not include the complete metrics required for this chart.', filteredEmptyTitle: 'No records match the active filters', filteredEmptyNote: 'Adjust the search, strategy, or status filters and try again.', clearFilters: 'Clear filters',
      };

  const clearFilters = () => {
    setSearchText('');
    setStrategyFilter('All');
    setShowCompletedOnly(false);
  };

  const openBacktest = (record: RankingItem) => {
    if (!record.backtestId) return;
    try {
      sessionStorage.setItem('selectedBacktestForView', JSON.stringify(record.originalRecord));
    } catch (storageError) {
      console.warn('Unable to cache selected backtest:', storageError);
    }
    navigate(`/backtest/${encodeURIComponent(record.backtestId)}`);
  };

  if (loading && rankingData.length === 0) {
    return <div className="strategy-ranking-page"><div className="strategy-ranking-loading"><Spin size="large" /><span>{t.ranking.loadingTip}</span></div></div>;
  }

  return (
    <div className="strategy-ranking-page">
      <header className="strategy-ranking-hero">
        <div className="strategy-ranking-hero__copy">
          <span className="strategy-ranking-kicker"><TrophyOutlined />{editorialCopy.kicker}</span>
          <Title level={1}>{t.ranking.leaderboardTitle}</Title>
          <Text>{t.ranking.leaderboardSubtitle}</Text>
          <div className="strategy-ranking-meta"><span><i />{editorialCopy.source}</span><span>{editorialCopy.updated}</span></div>
        </div>
        <Button className="strategy-ranking-refresh" icon={<ReloadOutlined />} onClick={fetchRankingData} loading={loading}>{t.ranking.refreshData}</Button>
      </header>

      {loadIssue && (
        <Alert
          className="strategy-ranking-alert"
          message={loadIssue === 'remote' ? (rankingData.length > 0 ? editorialCopy.remoteFallback : editorialCopy.remoteUnavailable) : loadIssue === 'local' ? editorialCopy.localFallback : editorialCopy.loadError}
          type={(loadIssue === 'remote' || loadIssue === 'local') && rankingData.length > 0 ? 'warning' : 'error'}
          showIcon
          action={<Button size="small" onClick={fetchRankingData} loading={loading}>{editorialCopy.retry}</Button>}
        />
      )}

      {summaryStats && (
        <section className="strategy-ranking-ledger" aria-label={t.ranking.leaderboardTitle}>
          <article><span><HistoryOutlined />{t.ranking.rankedSessions}</span><strong>{summaryStats.count}</strong><small>{t.ranking.totalStrategies.replace('{count}', String(summaryStats.count))}</small></article>
          <article><span>{t.ranking.bestReturnStat}</span><strong className={summaryStats.bestReturn === null ? '' : summaryStats.bestReturn >= 0 ? 'is-positive' : 'is-negative'}>{formatPercent(summaryStats.bestReturn)}</strong><small>{t.ranking.sortByTotalReturn}</small></article>
          <article><span>{t.ranking.topSharpe}</span><strong>{safeToFixed(summaryStats.bestSharpe)}</strong><small>{t.ranking.sortBySharpeRatio}</small></article>
          <article><span><SafetyCertificateOutlined />{t.ranking.bestMaxDD}</span><strong>{formatDrawdown(summaryStats.lowestDD, 1)}</strong><small>{t.ranking.sortByMaxDrawdown}</small></article>
          <article><span>{t.ranking.topWinRate}</span><strong>{formatPlainPercent(summaryStats.bestWinRate, 1)}</strong><small>{t.ranking.sortByWinRate}</small></article>
          <article><span><LineChartOutlined />{t.ranking.strategiesCount}</span><strong>{summaryStats.coveredStrategies}</strong><small>{t.ranking.allStrategies}</small></article>
        </section>
      )}

      <section className="strategy-ranking-filter-band">
        <label className="strategy-ranking-search"><SearchOutlined /><Input placeholder={t.ranking.searchPlaceholder} value={searchText} onChange={event => setSearchText(event.target.value)} allowClear bordered={false} /></label>
        <Select value={strategyFilter} onChange={setStrategyFilter} aria-label={t.ranking.allStrategies}><Option value="All">{t.ranking.allStrategies}</Option>{strategies.map(strategy => <Option key={strategy} value={strategy}>{(t.strategies as Record<string, string>)[strategy] || strategy.replace(/_/g, ' ')}</Option>)}</Select>
        <Select value={sortBy} onChange={setSortBy} aria-label={t.ranking.sortByTotalReturn}><Option value="totalReturn">{t.ranking.sortByTotalReturn}</Option><Option value="sharpeRatio">{t.ranking.sortBySharpeRatio}</Option><Option value="maxDrawdown">{t.ranking.sortByMaxDrawdown}</Option><Option value="winRate">{t.ranking.sortByWinRate}</Option><Option value="profitFactor">{t.ranking.sortByProfitFactor}</Option><Option value="trades">{t.ranking.sortByTrades}</Option></Select>
        <Button className={showCompletedOnly ? 'is-active' : ''} onClick={() => setShowCompletedOnly(!showCompletedOnly)}>{showCompletedOnly ? t.ranking.completedOnly : t.ranking.allStatus}</Button>
      </section>

      {rankableData.length > 0 && (
        <section className="strategy-ranking-intelligence">
          <header><div><span>{editorialCopy.chartKicker}</span><h2>{editorialCopy.chartTitle}</h2></div><p>{editorialCopy.chartNote}</p></header>
          <div className="strategy-ranking-chart-grid">
            <article><div className="strategy-ranking-chart-label">{t.comparison.riskRewardQuadrant}</div><div className="strategy-ranking-chart">
              {riskRewardData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 20, bottom: 18, left: 2 }}><CartesianGrid stroke="rgba(230,236,229,0.12)" strokeDasharray="3 5" /><XAxis type="number" dataKey="risk" name={t.ranking.colMaxDD} unit="%" tick={{ fill: '#aab4a9', fontSize: 11 }} axisLine={{ stroke: 'rgba(230,236,229,0.24)' }} tickLine={false} /><YAxis type="number" dataKey="totalReturn" name={t.ranking.colTotalReturn} unit="%" tick={{ fill: '#aab4a9', fontSize: 11 }} axisLine={{ stroke: 'rgba(230,236,229,0.24)' }} tickLine={false} /><ZAxis type="number" dataKey="trades" range={[72, 310]} /><ReferenceLine y={0} stroke="rgba(230,236,229,0.32)" /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#16261e', border: '1px solid rgba(230,236,229,0.22)', borderRadius: 2, color: '#f1efe7' }} /><Scatter name={t.comparison.strategiesLabel} data={riskRewardData}>{riskRewardData.map((point, index) => <Cell key={`${point.symbol}-${index}`} fill={point.fill} />)}</Scatter></ScatterChart></ResponsiveContainer> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={editorialCopy.noChartData} />}
            </div></article>
            <article><div className="strategy-ranking-chart-label">{editorialCopy.returnChart}</div><div className="strategy-ranking-chart">
              {returnLeaders.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={returnLeaders} layout="vertical" margin={{ top: 14, right: 18, bottom: 10, left: 14 }}><CartesianGrid horizontal={false} stroke="rgba(230,236,229,0.12)" strokeDasharray="3 5" /><XAxis type="number" tick={{ fill: '#aab4a9', fontSize: 11 }} axisLine={{ stroke: 'rgba(230,236,229,0.24)' }} tickLine={false} unit="%" /><YAxis type="category" dataKey="label" width={116} tick={{ fill: '#c2cbc1', fontSize: 10 }} axisLine={false} tickLine={false} /><ReferenceLine x={0} stroke="rgba(230,236,229,0.32)" /><Tooltip contentStyle={{ background: '#16261e', border: '1px solid rgba(230,236,229,0.22)', borderRadius: 2, color: '#f1efe7' }} formatter={(value: any) => [formatPlainPercent(value, 2), t.ranking.colTotalReturn]} /><Bar dataKey="totalReturn" radius={0} barSize={18}>{returnLeaders.map((item, index) => <Cell key={`${item.label}-${index}`} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={editorialCopy.noChartData} />}
            </div></article>
          </div>
        </section>
      )}

      <Card className="strategy-ranking-table-card" bodyStyle={{ padding: 0 }}>
        <header className="strategy-ranking-table-heading"><div><span>{editorialCopy.ledgerKicker}</span><h2>{editorialCopy.ledgerTitle}</h2></div><p>{editorialCopy.ledgerNote}</p></header>
        {filteredAndSortedData.length > 0 ? (
          <Table columns={columns} dataSource={filteredAndSortedData} pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => t.ranking.totalStrategies.replace('{count}', String(total)) }} rowKey="key" size="middle" scroll={{ x: 1175 }} onRow={record => record.backtestId ? ({ role: 'button', tabIndex: 0, onClick: () => openBacktest(record), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBacktest(record); } } }) : {}} rowClassName={(record) => { const position = rankPositionByKey.get(record.key); return `ranking-row ${record.backtestId ? '' : 'is-disabled'} ${position === 1 ? 'gold-row' : position === 2 ? 'silver-row' : position === 3 ? 'bronze-row' : ''}`; }} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div className="strategy-ranking-empty"><Title level={4}>{rankingData.length > 0 ? editorialCopy.filteredEmptyTitle : t.ranking.noRankedStrategies}</Title><Text type="secondary">{rankingData.length > 0 ? editorialCopy.filteredEmptyNote : t.ranking.runBacktestsFirst}</Text><Button type="primary" size="large" onClick={rankingData.length > 0 ? clearFilters : () => navigate('/backtest')}>{rankingData.length > 0 ? editorialCopy.clearFilters : t.ranking.goToBacktest}</Button></div>} />
        )}
      </Card>
    </div>
  );
};

export default StrategyRanking;
