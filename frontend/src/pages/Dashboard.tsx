import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  StockData,
  getDashboardStatus,
  safeNumber,
} from '../services/marketDataService';
import { sharedDataService } from '../services/sharedDataService';
import { pipelineAutoAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMarketCap } from '../utils/format';
import { marketSymbolPath, rememberMarketSymbol } from '../routes/marketRoutes';
import './DashboardEditorial.css';

const { Text } = Typography;

const STORAGE_KEY = 'quant_watchlist_symbols';

type MoversView = 'all' | 'gainers' | 'losers' | 'watchlist';
type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

interface SectorData {
  name: string;
  count: number;
  percentage: number;
}

interface SectorBreadthData {
  name: string;
  total: number;
  advancing: number;
  declining: number;
  unchanged: number;
}

interface HistogramBin {
  label: string;
  count: number;
  tone: 'negative' | 'neutral' | 'positive';
}

function getChangePercent(stock: StockData): number | null {
  if (!stock || typeof stock.price !== 'number' || !Number.isFinite(stock.price)) return null;
  const directChange = stock.changePct ?? stock.changePercent;
  if (typeof directChange === 'number' && Number.isFinite(directChange)) return directChange;
  if (typeof stock.previousClose === 'number' && Number.isFinite(stock.previousClose) && stock.previousClose !== 0) {
    return ((stock.price - stock.previousClose) / stock.previousClose) * 100;
  }
  if (
    typeof stock.change === 'number'
    && Number.isFinite(stock.change)
    && typeof stock.previousClose === 'number'
    && Number.isFinite(stock.previousClose)
    && stock.previousClose !== 0
  ) {
    return (stock.change / stock.previousClose) * 100;
  }
  return null;
}

const formatCompactNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const number = safeNumber(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
};

const formatPrice = (value: number | null | undefined, currency = 'USD'): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }
};

const formatSignedPercent = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const magnitude = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${magnitude}%`;
};

const normalizeStatus = (status?: string): string => {
  if (!status) return 'UNKNOWN';
  return status.replace(/_/g, ' ');
};

const getStatusTone = (status?: string): StatusTone => {
  const value = (status || '').toUpperCase();
  if (['ONLINE', 'HEALTHY', 'CONNECTED', 'LIVE', 'PAPER'].some(item => value.includes(item))) return 'good';
  if (value.includes('CONFIG') || value.includes('AUTH') || value.includes('UNKNOWN')) return 'warn';
  if (value.includes('OFFLINE') || value.includes('ERROR') || value.includes('DISCONNECTED')) return 'bad';
  return 'neutral';
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t, translateSector, language } = useLanguage();
  const fetchingRef = useRef(false);
  const refreshRef = useRef<() => void>(() => undefined);

  const [marketData, setMarketData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsConfig, setNeedsConfig] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const [moversView, setMoversView] = useState<MoversView>('all');
  const [pipelineSummary, setPipelineSummary] = useState<any | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    marketData: 'CONFIG_REQUIRED',
    quoteFeed: 'CONFIG_REQUIRED',
    brokerConnection: 'CONFIG_REQUIRED',
    environment: 'Unknown',
  });

  const isZh = language === 'zh-CN';
  const ui = isZh ? {
    overview: '市场概览', watchlist: '自选列表', signalStream: '信号流', systemStatus: '系统状态',
    lastSync: '最后同步', refresh: '刷新', layout: '布局 02 · 宽幅编辑式', title: '今日市场结构',
    subtitle: '基于当前市场快照与研究工作区的实时概览。', universe: '股票池', advancing: '上涨',
    declining: '下跌', avgMove: '平均波动', marketCap: '总市值', largestMove: '最大波动', totalSymbols: '全部标的',
    averageMove: '平均涨跌幅', strongestMove: '当前最大波动', marketRegime: '市场状态', asOf: '截至',
    breadthSpectrum: '涨跌分布', advancingDeclining: '上涨 / 下跌', sectorParticipation: '板块参与度',
    sector: '板块', ratio: '比例', noBreadth: '当前快照暂无可用涨跌数据。', sessionBrief: '盘面摘要',
    leadingMove: '领先波动', concentration: '集中度', topTenMarketCap: '市值前十占比', unavailable: '暂无',
    systemReadiness: '系统就绪状态', researchQueue: '研究队列', reviewQueue: '查看活动', observed: '已观察',
    observedDescription: '最近一次管线扫描', shortlisted: '已入选', shortlistedDescription: '进入精筛的候选',
    validated: '已验证', validatedDescription: '通过深度验证', riskPlan: '风险计划', riskPlanDescription: '已生成入场计划',
    notLinked: '—', marketMovers: '市场异动', topMovers: '波动排行', gainers: '涨幅榜', losers: '跌幅榜',
    company: '公司', price: '价格', change: '涨跌', volume: '成交量', noMovers: '当前筛选暂无可用标的。',
    viewMarkets: '查看全部市场', sectorMap: '板块分布', viewSectors: '查看板块', shareOfUniverse: '占股票池',
    manage: '管理', noWatchlist: '自选列表为空。', addSymbols: '添加标的', waiting: '等待市场数据同步…',
    dataSource: '数据源', dataQuality: '数据质量', quoteFeed: '行情源', environment: '环境', broker: '券商状态',
    lastUpdated: '最后更新', good: '良好', partial: '部分可用', issue: '异常', loading: '同步中',
    paperMode: '模拟模式', realMode: '实盘模式', saved: '已收藏', marketData: '市场数据',
  } : {
    overview: 'Market overview', watchlist: 'Watchlist', signalStream: 'Signal stream', systemStatus: 'System status',
    lastSync: 'Last sync', refresh: 'Refresh', layout: 'Layout 02 · Wide editorial', title: 'Today’s market structure',
    subtitle: 'A live view of the current market snapshot and research workspace.', universe: 'Universe', advancing: 'Advancing',
    declining: 'Declining', avgMove: 'Avg move', marketCap: 'Market cap', largestMove: 'Largest move', totalSymbols: 'Total symbols',
    averageMove: 'Average move', strongestMove: 'Strongest move', marketRegime: 'Market regime', asOf: 'As of',
    breadthSpectrum: 'Breadth spectrum', advancingDeclining: 'Advancing / declining', sectorParticipation: 'Sector participation',
    sector: 'Sector', ratio: 'Ratio', noBreadth: 'No change data is available in the current snapshot.', sessionBrief: 'Session brief',
    leadingMove: 'Leading move', concentration: 'Concentration', topTenMarketCap: 'Top 10 by market cap', unavailable: 'Unavailable',
    systemReadiness: 'System readiness', researchQueue: 'Research queue', reviewQueue: 'View activity', observed: 'Observed',
    observedDescription: 'Latest pipeline scan', shortlisted: 'Shortlisted', shortlistedDescription: 'Candidates sent to fine scan',
    validated: 'Validated', validatedDescription: 'Passed deeper validation', riskPlan: 'Risk plan', riskPlanDescription: 'Entry plans generated',
    notLinked: '—', marketMovers: 'Market movers', topMovers: 'Top movers', gainers: 'Gainers', losers: 'Losers',
    company: 'Company', price: 'Price', change: 'Change', volume: 'Volume', noMovers: 'No instruments match this view.',
    viewMarkets: 'View all markets', sectorMap: 'Sector map', viewSectors: 'View sectors', shareOfUniverse: 'Share of universe',
    manage: 'Manage', noWatchlist: 'Your watchlist is empty.', addSymbols: 'Add symbols', waiting: 'Waiting for market data synchronization…',
    dataSource: 'Data source', dataQuality: 'Data quality', quoteFeed: 'Quote feed', environment: 'Environment', broker: 'Broker status',
    lastUpdated: 'Last updated', good: 'Good', partial: 'Partial', issue: 'Issue', loading: 'Syncing',
    paperMode: 'Paper mode', realMode: 'Real mode', saved: 'Saved', marketData: 'Market data',
  };

  const localizeSystemValue = (value?: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    if (!isZh) return normalizeStatus(raw);
    const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    const labels: Record<string, string> = {
      ONLINE: '在线', HEALTHY: '健康', CONNECTED: '已连接', DISCONNECTED: '未连接',
      'CONFIG REQUIRED': '需要配置', 'AUTH REQUIRED': '需要登录', UNKNOWN: '未知',
      PAPER: '模拟', REAL: '实盘', LIVE: '实盘', OFFLINE: '离线', ERROR: '异常',
      IEX: 'IEX 行情', SIP: 'SIP 全市场行情',
    };
    if (labels[normalized]) return labels[normalized];
    if (/ALPACA SANDBOX.*PAPER/i.test(raw)) return 'Alpaca 沙盒（模拟） · 用户级';
    return raw.replace(/per[- ]user/ig, '用户级');
  };

  const fetchSystemStatus = async () => {
    try {
      const status = await getDashboardStatus();
      setSystemStatus(status);
    } catch {
      // The default status deliberately communicates that setup is still required.
    }
  };

  const fetchPipelineSummary = async () => {
    try {
      const response = await pipelineAutoAPI.getStatus();
      if (response.data?.success) {
        const summary = response.data.lastSummary;
        setPipelineSummary(summary && Object.keys(summary).length ? summary : null);
      }
    } catch {
      // A user may not have run the research pipeline yet; the queue remains empty.
      setPipelineSummary(null);
    }
  };

  const fetchMarketData = async (forceRefresh = false) => {
    if (fetchingRef.current && !forceRefresh) return;
    try {
      fetchingRef.current = true;
      setLoading(true);
      setError('');
      setNeedsConfig(false);
      setNeedsAuth(false);
      const stocks = forceRefresh
        ? await sharedDataService.refreshStocks()
        : await sharedDataService.getStocks();

      if (!stocks || stocks.length === 0) {
        setError(t.dashboard.noMarketData);
        setMarketData([]);
      } else {
        setMarketData(stocks);
        setLastFetched(Date.now());
      }
    } catch (requestError: any) {
      const rawMessage = requestError.message || t.dashboard.errorLoading;
      const code = requestError.code || '';
      setError(language === 'zh-CN' ? t.dashboard.errorLoading : rawMessage);
      setNeedsAuth(code === 'AUTH_REQUIRED' || rawMessage.includes('Authentication required'));
      setNeedsConfig(
        code === 'CONFIG_REQUIRED'
        || rawMessage.includes('not configured')
        || rawMessage.includes('needsConfig')
        || rawMessage.includes('Configuration required')
      );
      setMarketData([]);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchMarketData(true);
    fetchSystemStatus();
    fetchPipelineSummary();
  };
  refreshRef.current = refresh;

  useEffect(() => {
    setError('');
    const loadTimer = window.setTimeout(() => {
      fetchMarketData();
      fetchSystemStatus();
      fetchPipelineSummary();
    }, 100);
    return () => window.clearTimeout(loadTimer);
    // Initial data hydration intentionally runs once per authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setWatchlistVersion(version => version + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const handleGlobalRefresh = () => refreshRef.current();
    window.addEventListener('alphalab:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('alphalab:refresh', handleGlobalRefresh);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('alphalab:data-sync', {
      detail: { loading, timestamp: lastFetched },
    }));
  }, [loading, lastFetched]);

  const watchlistSymbols = useMemo(() => {
    // The version counter invalidates this snapshot when another tab edits localStorage.
    void watchlistVersion;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [] as string[];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.map(symbol => String(symbol).toUpperCase().trim()).filter(Boolean);
    } catch {
      return [] as string[];
    }
  }, [watchlistVersion]);

  const marketStats = useMemo(() => {
    const changes = marketData
      .map(stock => getChangePercent(stock))
      .filter((change): change is number => change !== null);
    const validMarketCaps = marketData.filter(stock => safeNumber(stock.marketCap) > 0);
    const totalMarketCap = validMarketCaps.reduce((sum, stock) => sum + safeNumber(stock.marketCap), 0);
    const largestMoveStock = marketData.reduce<StockData | null>((largest, stock) => {
      const change = getChangePercent(stock);
      if (change === null) return largest;
      if (!largest) return stock;
      const largestChange = getChangePercent(largest);
      return largestChange === null || Math.abs(change) > Math.abs(largestChange) ? stock : largest;
    }, null);

    return {
      totalSymbols: marketData.length,
      validChangeCount: changes.length,
      gainers: changes.filter(change => change > 0).length,
      losers: changes.filter(change => change < 0).length,
      avgChange: changes.length ? changes.reduce((sum, change) => sum + change, 0) / changes.length : 0,
      totalMarketCap,
      largestMoveStock,
      largestMovePercent: largestMoveStock ? getChangePercent(largestMoveStock) : null,
    };
  }, [marketData]);

  const sectorData = useMemo<SectorData[]>(() => {
    const counts = new Map<string, number>();
    marketData.forEach(stock => {
      const rawName = stock.sector || stock.industry;
      if (!rawName || ['unknown', 'none', 'n/a'].includes(rawName.toLowerCase())) return;
      counts.set(rawName, (counts.get(rawName) || 0) + 1);
    });
    if (!counts.size && marketData.length) {
      return [{ name: 'Stocks', count: marketData.length, percentage: 100 }];
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: marketData.length ? (count / marketData.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [marketData]);

  const sectorBreadth = useMemo<SectorBreadthData[]>(() => {
    const sectors = new Map<string, SectorBreadthData>();
    marketData.forEach(stock => {
      const rawName = stock.sector || stock.industry || 'General';
      const name = ['unknown', 'none', 'n/a'].includes(rawName.toLowerCase()) ? 'General' : rawName;
      const row = sectors.get(name) || { name, total: 0, advancing: 0, declining: 0, unchanged: 0 };
      const change = getChangePercent(stock);
      row.total += 1;
      if (change === null || change === 0) row.unchanged += 1;
      else if (change > 0) row.advancing += 1;
      else row.declining += 1;
      sectors.set(name, row);
    });
    return Array.from(sectors.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [marketData]);

  const histogram = useMemo<HistogramBin[]>(() => {
    const ranges = [
      { min: -Infinity, max: -5, label: '<−5', tone: 'negative' as const },
      { min: -5, max: -3, label: '−5', tone: 'negative' as const },
      { min: -3, max: -2, label: '−3', tone: 'negative' as const },
      { min: -2, max: -1.5, label: '−2', tone: 'negative' as const },
      { min: -1.5, max: -1, label: '−1.5', tone: 'negative' as const },
      { min: -1, max: -0.75, label: '−1', tone: 'negative' as const },
      { min: -0.75, max: -0.5, label: '−.75', tone: 'negative' as const },
      { min: -0.5, max: -0.25, label: '−.5', tone: 'negative' as const },
      { min: -0.25, max: 0, label: '−.25', tone: 'negative' as const },
      { min: 0, max: 0.25, label: '0', tone: 'neutral' as const },
      { min: 0.25, max: 0.5, label: '+.25', tone: 'positive' as const },
      { min: 0.5, max: 0.75, label: '+.5', tone: 'positive' as const },
      { min: 0.75, max: 1, label: '+.75', tone: 'positive' as const },
      { min: 1, max: 1.5, label: '+1', tone: 'positive' as const },
      { min: 1.5, max: 2, label: '+1.5', tone: 'positive' as const },
      { min: 2, max: 3, label: '+2', tone: 'positive' as const },
      { min: 3, max: 5, label: '+3', tone: 'positive' as const },
      { min: 5, max: Infinity, label: '>+5', tone: 'positive' as const },
    ];
    const bins = ranges.map(range => ({ label: range.label, count: 0, tone: range.tone }));
    marketData.forEach(stock => {
      const change = getChangePercent(stock);
      if (change === null) return;
      const index = ranges.findIndex((range, rangeIndex) => (
        change >= range.min && (change < range.max || rangeIndex === ranges.length - 1)
      ));
      if (index >= 0) bins[index].count += 1;
    });
    return bins;
  }, [marketData]);

  const concentration = useMemo(() => {
    const marketCaps = marketData.map(stock => safeNumber(stock.marketCap)).filter(value => value > 0).sort((a, b) => b - a);
    const total = marketCaps.reduce((sum, value) => sum + value, 0);
    if (!total) return null;
    return (marketCaps.slice(0, 10).reduce((sum, value) => sum + value, 0) / total) * 100;
  }, [marketData]);

  const watchlistData = marketData
    .filter(stock => watchlistSymbols.includes(stock.symbol.toUpperCase().trim()))
    .slice(0, 5);

  const moversData = useMemo(() => {
    let stocks = marketData.filter(stock => getChangePercent(stock) !== null);
    if (moversView === 'gainers') stocks = stocks.filter(stock => (getChangePercent(stock) || 0) > 0);
    if (moversView === 'losers') stocks = stocks.filter(stock => (getChangePercent(stock) || 0) < 0);
    if (moversView === 'watchlist') stocks = stocks.filter(stock => watchlistSymbols.includes(stock.symbol.toUpperCase().trim()));
    return [...stocks]
      .sort((a, b) => Math.abs(getChangePercent(b) || 0) - Math.abs(getChangePercent(a) || 0))
      .slice(0, 6);
  }, [marketData, moversView, watchlistSymbols]);

  const advancingPercent = marketStats.validChangeCount ? (marketStats.gainers / marketStats.validChangeCount) * 100 : 0;
  const decliningPercent = marketStats.validChangeCount ? (marketStats.losers / marketStats.validChangeCount) * 100 : 0;
  const histogramMax = Math.max(...histogram.map(bin => bin.count), 1);
  const lastUpdated = lastFetched
    ? new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(lastFetched))
    : '—';
  const dataSource = marketData[0]?.dataSource || '—';
  const dataQuality = loading
    ? ui.loading
    : error
      ? ui.issue
      : marketData.length && marketData.some(stock => stock.price === null)
        ? ui.partial
        : marketData.length
          ? ui.good
          : '—';
  const pipelineObserved = pipelineSummary
    ? safeNumber(pipelineSummary.scannedTotal ?? pipelineSummary.scanned)
    : null;
  const pipelineShortlisted = pipelineSummary
    ? safeNumber(pipelineSummary.fine_input_count ?? pipelineSummary.fine_count)
    : null;
  const pipelineVerdicts = pipelineSummary?.validation_stats?.verdicts;
  const pipelineValidated = pipelineVerdicts
    ? safeNumber(pipelineVerdicts.Confirmed) + safeNumber(pipelineVerdicts.Pass)
    : null;
  const pipelineRiskPlans = pipelineSummary
    ? safeNumber(pipelineSummary.entry_plan_count)
    : null;

  const handleSymbolClick = (symbol: string) => {
    rememberMarketSymbol(symbol);
    navigate(marketSymbolPath(symbol));
  };

  const renderStatus = (label: string, status: string) => (
    <div className="ed-readiness-row" key={label}>
      <span className={`ed-status-dot is-${getStatusTone(status)}`} aria-hidden="true" />
      <span>{label}</span>
      <strong>{localizeSystemValue(status)}</strong>
    </div>
  );

  return (
    <div className="dashboard-page-shell editorial-dashboard" aria-busy={loading}>
      <div className="ed-canvas">
        <header className="ed-page-heading">
          <div>
            <p className="ed-kicker">{ui.layout}</p>
            <h1>{ui.title}</h1>
            <p>{ui.subtitle}</p>
          </div>
        </header>

        {(needsAuth || needsConfig || error || (marketData.length > 0 && marketData.every(stock => stock.price === null))) && (
          <div className="ed-alerts">
            {needsAuth && (
              <Alert message={<Text strong>{t.dashboard.authRequired}</Text>} description={t.dashboard.authRequiredDesc} type="warning" showIcon />
            )}
            {needsConfig && !needsAuth && (
              <Alert
                message={<Text strong>{t.dashboard.apiConfigRequired}</Text>}
                description={t.dashboard.apiConfigRequiredDesc}
                type="warning"
                showIcon
                action={<Button size="middle" type="primary" onClick={() => navigate('/settings/configuration')}>{t.dashboard.configure}</Button>}
              />
            )}
            {error && !needsAuth && !needsConfig && (
              <Alert
                message={<Text strong>{error.includes('Network Error') || error.includes('ECONNREFUSED') ? t.dashboard.backendConnectionError : t.dashboard.apiError}</Text>}
                description={error.includes('Network Error') || error.includes('ECONNREFUSED') ? t.dashboard.backendConnectionErrorDesc : error}
                type="error"
                showIcon
              />
            )}
            {!loading && !error && !needsAuth && !needsConfig && marketData.length > 0 && marketData.every(stock => stock.price === null) && (
              <Alert
                message={<Text strong>{t.dashboard.apiError}</Text>}
                description={t.dashboard.apiNoPricesDesc}
                type="warning"
                showIcon
                action={<Button size="middle" onClick={() => navigate('/settings/configuration')}>{t.dashboard.checkConfig}</Button>}
              />
            )}
          </div>
        )}

        <section className="ed-metric-ledger" aria-label={t.dashboard.marketOverview}>
          <article>
            <span>{ui.universe}</span>
            <strong className="is-blue">{marketStats.totalSymbols ? marketStats.totalSymbols.toLocaleString() : '—'}</strong>
            <small>{ui.totalSymbols}</small>
          </article>
          <article>
            <span>{ui.advancing}</span>
            <strong className="is-positive">{marketStats.gainers.toLocaleString()}</strong>
            <small>{advancingPercent.toFixed(1)}%</small>
          </article>
          <article>
            <span>{ui.declining}</span>
            <strong className="is-negative">{marketStats.losers.toLocaleString()}</strong>
            <small>{decliningPercent.toFixed(1)}%</small>
          </article>
          <article>
            <span>{ui.avgMove}</span>
            <strong className={marketStats.avgChange >= 0 ? 'is-positive' : 'is-negative'}>
              {marketStats.validChangeCount ? formatSignedPercent(marketStats.avgChange) : '—'}
            </strong>
            <small>{ui.averageMove}</small>
          </article>
          <article>
            <span>{ui.marketCap}</span>
            <strong className="is-blue">{marketStats.totalMarketCap ? formatMarketCap(marketStats.totalMarketCap) : '—'}</strong>
            <small>{ui.marketCap}</small>
          </article>
          <article>
            <span>{ui.largestMove}</span>
            <div className="ed-largest-move">
              <strong>{marketStats.largestMoveStock?.symbol || '—'}</strong>
              {marketStats.largestMovePercent !== null && (
                <b className={marketStats.largestMovePercent >= 0 ? 'is-positive' : 'is-negative'}>
                  {formatSignedPercent(marketStats.largestMovePercent)}
                </b>
              )}
            </div>
            <small>{ui.strongestMove}</small>
          </article>
        </section>

        <div className="ed-primary-grid">
          <section className="ed-market-regime" aria-labelledby="market-regime-title">
            <div className="ed-panel-heading ed-panel-heading-dark">
              <h2 id="market-regime-title">{ui.marketRegime}</h2>
              <span>{ui.asOf} {lastUpdated}</span>
            </div>

            <div className="ed-breadth-summary">
              <div>
                <span>{ui.advancing}</span>
                <strong className="is-moss">{marketStats.gainers.toLocaleString()}</strong>
                <small>{advancingPercent.toFixed(1)}%</small>
              </div>
              <div className="ed-breadth-ratio">
                <strong><span>{advancingPercent.toFixed(1)}</span> / <b>{decliningPercent.toFixed(1)}</b></strong>
                <small>{ui.advancingDeclining}</small>
              </div>
              <div className="ed-align-right">
                <span>{ui.declining}</span>
                <strong className="is-copper">{marketStats.losers.toLocaleString()}</strong>
                <small>{decliningPercent.toFixed(1)}%</small>
              </div>
            </div>

            <div className="ed-histogram-block">
              <span className="ed-dark-label">{ui.breadthSpectrum}</span>
              {marketStats.validChangeCount ? (
                <div
                  className="ed-histogram"
                  role="img"
                  aria-label={`${ui.breadthSpectrum}: ${marketStats.validChangeCount} ${ui.totalSymbols}`}
                >
                  {histogram.map(bin => (
                    <div className="ed-histogram-column" key={bin.label} title={`${bin.label}%: ${bin.count}`}>
                      <span>{bin.count || ''}</span>
                      <i className={`is-${bin.tone}`} style={{ height: `${bin.count === 0 ? 0 : Math.max(8, (bin.count / histogramMax) * 100)}%` }} />
                    </div>
                  ))}
                </div>
              ) : <div className="ed-dark-empty">{ui.noBreadth}</div>}
              <div className="ed-axis-labels" aria-hidden="true"><span>−5%</span><span>0%</span><span>+5%</span></div>
            </div>

            <div className="ed-sector-breadth">
              <div className="ed-sector-head">
                <span>{ui.sectorParticipation}</span>
                <span>{sectorBreadth.length ? `${sectorBreadth.length} ${ui.sector.toLowerCase()}` : '—'}</span>
              </div>
              {sectorBreadth.length ? sectorBreadth.map(sector => {
                const advancingWidth = sector.total ? (sector.advancing / sector.total) * 100 : 0;
                const decliningWidth = sector.total ? (sector.declining / sector.total) * 100 : 0;
                return (
                  <div className="ed-sector-breadth-row" key={sector.name}>
                    <span>{translateSector(sector.name)}</span>
                    <div className="ed-sector-stack" aria-label={`${sector.advancing} ${ui.advancing}, ${sector.declining} ${ui.declining}`}>
                      <i className="is-advancing" style={{ width: `${advancingWidth}%` }} />
                      <i className="is-declining" style={{ width: `${decliningWidth}%` }} />
                    </div>
                    <b>{sector.advancing}</b>
                    <b>{sector.declining}</b>
                    <strong>{advancingWidth.toFixed(0)} / {decliningWidth.toFixed(0)}</strong>
                  </div>
                );
              }) : <div className="ed-dark-empty is-compact">{t.dashboard.sectorDataUnavailable}</div>}
            </div>
          </section>

          <section className="ed-paper-panel ed-session-panel" aria-labelledby="session-brief-title">
            <div className="ed-panel-heading">
              <h2 id="session-brief-title">{ui.sessionBrief}</h2>
            </div>
            <div className="ed-session-grid">
              <div className="ed-session-facts">
                <div className="ed-fact-block">
                  <span>{ui.leadingMove}</span>
                  <div>
                    <strong>{marketStats.largestMoveStock?.symbol || '—'}</strong>
                    {marketStats.largestMovePercent !== null && (
                      <b className={marketStats.largestMovePercent >= 0 ? 'is-positive' : 'is-negative'}>
                        {formatSignedPercent(marketStats.largestMovePercent)}
                      </b>
                    )}
                  </div>
                  <small>{ui.strongestMove}</small>
                </div>
                <div className="ed-fact-block">
                  <span>{ui.concentration}</span>
                  <small>{ui.topTenMarketCap}</small>
                  <div className="ed-concentration-bar" aria-label={`${ui.concentration}: ${concentration?.toFixed(1) || ui.unavailable}`}>
                    <i style={{ width: `${concentration || 0}%` }} />
                  </div>
                  <strong className="ed-concentration-value">{concentration === null ? '—' : `${concentration.toFixed(1)}%`}</strong>
                </div>
                <div className="ed-fact-block" id="dashboard-system-status">
                  <span>{ui.systemReadiness}</span>
                  {renderStatus(ui.marketData, systemStatus.marketData)}
                  {renderStatus(ui.quoteFeed, systemStatus.quoteFeed)}
                  {renderStatus(ui.broker, systemStatus.brokerConnection)}
                </div>
              </div>

              <div className="ed-research-queue">
                <div className="ed-queue-heading">
                  <span>{ui.researchQueue}</span>
                  <button type="button" onClick={() => navigate('/activity')}>{ui.reviewQueue} <b>→</b></button>
                </div>
                {[
                  { label: ui.observed, value: pipelineObserved === null ? ui.notLinked : pipelineObserved.toLocaleString(), description: ui.observedDescription, tone: 'blue' },
                  { label: ui.shortlisted, value: pipelineShortlisted === null ? ui.notLinked : pipelineShortlisted.toLocaleString(), description: ui.shortlistedDescription, tone: 'moss' },
                  { label: ui.validated, value: pipelineValidated === null ? ui.notLinked : pipelineValidated.toLocaleString(), description: ui.validatedDescription, tone: 'muted' },
                  { label: ui.riskPlan, value: pipelineRiskPlans === null ? ui.notLinked : pipelineRiskPlans.toLocaleString(), description: ui.riskPlanDescription, tone: 'copper' },
                ].map((item, index) => (
                  <div className="ed-queue-item" key={item.label}>
                    <div className="ed-queue-track" aria-hidden="true">
                      <i className={`is-${item.tone}`} />
                      {index < 3 && <span />}
                    </div>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="ed-lower-grid">
          <section className="ed-paper-panel ed-movers-panel" aria-labelledby="market-movers-title">
            <div className="ed-panel-heading ed-tabbed-heading">
              <h2 id="market-movers-title">{ui.marketMovers}</h2>
              <div className="ed-tabs" role="tablist" aria-label={ui.marketMovers}>
                {([
                  ['all', ui.topMovers],
                  ['gainers', ui.gainers],
                  ['losers', ui.losers],
                  ['watchlist', ui.watchlist],
                ] as [MoversView, string][]).map(([key, label]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={moversView === key}
                    className={moversView === key ? 'is-active' : ''}
                    onClick={() => setMoversView(key)}
                    key={key}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="ed-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.dashboard.symbol}</th>
                    <th scope="col">{ui.company}</th>
                    <th scope="col">{ui.price}</th>
                    <th scope="col">{ui.change}</th>
                    <th scope="col">{ui.volume}</th>
                    <th scope="col">{ui.marketCap}</th>
                  </tr>
                </thead>
                <tbody>
                  {moversData.map(stock => {
                    const change = getChangePercent(stock);
                    return (
                      <tr key={stock.symbol}>
                        <td>
                          <span className={`ed-direction is-${(change || 0) >= 0 ? 'up' : 'down'}`} aria-hidden="true" />
                          <button type="button" className="ed-symbol-button" onClick={() => handleSymbolClick(stock.symbol)}>{stock.symbol}</button>
                        </td>
                        <td title={stock.name || undefined}>{stock.name || '—'}</td>
                        <td>{formatPrice(stock.price, stock.currency)}</td>
                        <td className={(change || 0) >= 0 ? 'is-positive' : 'is-negative'}>
                          {formatSignedPercent(change)}
                        </td>
                        <td>{formatCompactNumber(stock.volume)}</td>
                        <td>{safeNumber(stock.marketCap) ? formatMarketCap(stock.marketCap) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!moversData.length && <div className="ed-table-empty">{loading ? ui.waiting : ui.noMovers}</div>}
            </div>
            <button type="button" className="ed-panel-link" onClick={() => navigate('/market')}>{ui.viewMarkets} <span>→</span></button>
          </section>

          <aside className="ed-side-stack">
            <section className="ed-paper-panel ed-sector-map" aria-labelledby="sector-map-title">
              <div className="ed-panel-heading">
                <h2 id="sector-map-title">{ui.sectorMap}</h2>
                <button type="button" onClick={() => navigate('/market')}>{ui.viewSectors} <b>→</b></button>
              </div>
              {sectorData.length ? sectorData.slice(0, 5).map(sector => (
                <div className="ed-sector-map-row" key={sector.name}>
                  <span>{translateSector(sector.name)}</span>
                  <div><i style={{ width: `${sector.percentage}%` }} /></div>
                  <strong>{sector.percentage.toFixed(1)}%</strong>
                </div>
              )) : <div className="ed-inline-empty">{t.dashboard.sectorDataUnavailable}</div>}
              <small>{ui.shareOfUniverse}</small>
            </section>

            <section className="ed-paper-panel ed-watchlist-panel" aria-labelledby="watchlist-title">
              <div className="ed-panel-heading">
                <h2 id="watchlist-title">{ui.watchlist}</h2>
                <button type="button" onClick={() => navigate('/watchlist')}>{ui.manage} <b>→</b></button>
              </div>
              {watchlistSymbols.length === 0 ? (
                <div className="ed-watchlist-empty">
                  <span>{ui.noWatchlist}</span>
                  <button type="button" onClick={() => navigate('/market')}>{ui.addSymbols}</button>
                </div>
              ) : watchlistData.length === 0 ? (
                <div className="ed-inline-empty">{ui.waiting}</div>
              ) : (
                <div className="ed-watchlist-list">
                  {watchlistData.slice(0, 3).map(stock => {
                    const change = getChangePercent(stock);
                    return (
                      <button type="button" onClick={() => handleSymbolClick(stock.symbol)} key={stock.symbol}>
                        <strong>{stock.symbol}</strong>
                        <span>{stock.name || '—'}</span>
                        <b>{formatPrice(stock.price, stock.currency)}</b>
                        <em className={(change || 0) >= 0 ? 'is-positive' : 'is-negative'}>
                          {formatSignedPercent(change)}
                        </em>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="ed-status-ledger" aria-label={ui.systemStatus}>
          {[
            { label: ui.dataSource, value: dataSource, tone: dataSource === '—' ? 'neutral' : 'good' as StatusTone },
            { label: ui.dataQuality, value: dataQuality, tone: error ? 'bad' : marketData.length ? 'good' : 'neutral' as StatusTone },
            { label: ui.quoteFeed, value: localizeSystemValue(systemStatus.quoteFeed), tone: getStatusTone(systemStatus.quoteFeed) },
            { label: ui.environment, value: localizeSystemValue(systemStatus.environment), tone: getStatusTone(systemStatus.environment) },
            { label: ui.broker, value: localizeSystemValue(systemStatus.brokerConnection), tone: getStatusTone(systemStatus.brokerConnection) },
            { label: ui.lastUpdated, value: lastUpdated, tone: lastFetched ? 'good' : 'neutral' as StatusTone },
          ].map(item => (
            <div key={item.label}>
              <span>{item.label}</span>
              <p><i className={`ed-status-dot is-${item.tone}`} aria-hidden="true" />{item.value}</p>
            </div>
          ))}
          <button type="button" onClick={refresh} disabled={loading}>
            <ReloadOutlined className={loading ? 'is-spinning' : ''} /> {t.dashboard.refreshData}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
