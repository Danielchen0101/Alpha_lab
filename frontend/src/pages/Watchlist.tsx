import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, message, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  LineChartOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import marketDataService from '../services/marketDataService';
import { isOperationsArtifactConflict, operationsArtifactsAPI } from '../services/operationsArtifactsService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { marketSymbolPath, rememberMarketSymbol } from '../routes/marketRoutes';
import './WatchlistEditorial.css';

const STORAGE_KEY_PREFIX = 'quant_watchlist_symbols';
const REFRESH_INTERVAL_MS = 60_000;

type WatchlistDisplayItem = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  sector: string | null;
  dayHigh: number | null;
  dayLow: number | null;
  currency: string;
  dataSource: string | null;
};

type WatchlistFilter = 'all' | 'gainers' | 'losers' | 'missing';
type SortOrder = 'ascend' | 'descend' | null | undefined;
type SortState = { columnKey?: string; order?: SortOrder };

const finiteNumber = (value: unknown): number | null => {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
};

const normalizeSymbols = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(symbol => String(symbol).trim().toUpperCase())
      .filter(Boolean),
  ));
};

const watchlistStorageKey = (userId: string): string => `${STORAGE_KEY_PREFIX}:${userId}`;

const readStoredSymbols = (storageKey: string, serialized?: string | null): string[] => {
  if (typeof window === 'undefined') return [];
  const source = serialized === undefined ? window.localStorage.getItem(storageKey) : serialized;
  if (!source) return [];
  try {
    return normalizeSymbols(JSON.parse(source));
  } catch {
    return [];
  }
};

const Watchlist: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t, translateSector, translateSignal } = useLanguage();
  const isChinese = language === 'zh-CN';

  const copy = isChinese ? {
    kicker: '监控 / 个人标的池',
    description: '集中查看您关注标的的实时报价、日内位置和规则派生状态。',
    addLabel: '添加标的',
    addHint: '输入股票代码或公司名称；按回车添加',
    refresh: '刷新行情',
    lastSync: '最后同步',
    neverSynced: '等待首次同步',
    coverage: '报价覆盖率',
    quoted: '有效报价',
    largestMove: '最大波动',
    breadth: '自选广度',
    breadthDescription: '仅基于当前自选列表的有效日涨跌幅',
    distribution: '涨跌分布',
    sectorMix: '板块分布',
    advancing: '上涨',
    unchanged: '平盘',
    declining: '下跌',
    unavailable: '缺失',
    monitoredSymbols: '监控标的',
    all: '全部',
    needsData: '待补数据',
    noFilteredRows: '没有符合当前筛选条件的标的',
    emptyPrompt: '在上方添加股票代码，开始监控真实报价和规则派生状态。',
    resetFilters: '重置筛选',
    last: '最新价',
    dayMove: '日涨跌',
    volume: '成交量',
    marketCap: '市值',
    context: '派生状态',
    contextNote: '由日涨跌和日内区间规则计算，不是 AI 建议',
    noBreadth: '暂无有效涨跌数据',
    noSector: '暂无板块数据',
    rangeUnavailable: '日内区间暂无数据',
    dataSource: '数据源',
    openAnalysis: '打开标的分析',
    runBacktest: '运行回测',
    removeSymbol: '移出自选列表',
    loading: '正在同步真实行情…',
    fetchError: '行情同步失败，已保留最近一次成功数据。',
    symbolsTracked: '个标的',
    validMoves: '个有效涨跌',
    ofList: '占自选列表',
  } : {
    kicker: 'MONITORING / PERSONAL UNIVERSE',
    description: 'A focused view of live quotes, intraday position, and rule-derived context for the symbols you follow.',
    addLabel: 'Add symbol',
    addHint: 'Enter a ticker or company name; press Enter to add',
    refresh: 'Refresh data',
    lastSync: 'Last sync',
    neverSynced: 'Awaiting first sync',
    coverage: 'Quote coverage',
    quoted: 'Quoted',
    largestMove: 'Largest move',
    breadth: 'Watchlist breadth',
    breadthDescription: 'Based only on valid daily moves in this watchlist',
    distribution: 'Move distribution',
    sectorMix: 'Sector mix',
    advancing: 'Advancing',
    unchanged: 'Unchanged',
    declining: 'Declining',
    unavailable: 'Missing',
    monitoredSymbols: 'Monitored symbols',
    all: 'All',
    needsData: 'Needs data',
    noFilteredRows: 'No symbols match the current filters',
    emptyPrompt: 'Add a symbol above to monitor real quotes and rule-derived context.',
    resetFilters: 'Reset filters',
    last: 'Last',
    dayMove: 'Day move',
    volume: 'Volume',
    marketCap: 'Market cap',
    context: 'Derived context',
    contextNote: 'Rule-derived from day move and range; not AI advice',
    noBreadth: 'No valid move data yet',
    noSector: 'No sector data yet',
    rangeUnavailable: 'Intraday range unavailable',
    dataSource: 'Source',
    openAnalysis: 'Open symbol analysis',
    runBacktest: 'Run backtest',
    removeSymbol: 'Remove from watchlist',
    loading: 'Synchronizing live market data…',
    fetchError: 'Market data sync failed. The last successful snapshot is retained.',
    symbolsTracked: 'symbols tracked',
    validMoves: 'valid moves',
    ofList: 'of watchlist',
  };

  const locale = isChinese ? 'zh-CN' : 'en-US';
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [watchlistData, setWatchlistData] = useState<WatchlistDisplayItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<WatchlistFilter>('all');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [sortedInfo, setSortedInfo] = useState<SortState>({});

  const symbolsRef = useRef(watchlistSymbols);
  const durableHydratedRef = useRef(false);
  const durableVersionRef = useRef<number | undefined>(undefined);
  const durableDirtyRef = useRef(false);
  const durableSaveTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    // React StrictMode replays effects in development. Restore the mounted flag
    // on every setup so the replayed cleanup cannot permanently discard data.
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const persistDurableWatchlist = useCallback(async (symbols: string[]) => {
    const normalized = normalizeSymbols(symbols);
    try {
      const artifact = await operationsArtifactsAPI.put(
        'watchlist',
        'primary',
        { symbols: normalized },
        durableVersionRef.current,
      );
      if (artifact) durableVersionRef.current = artifact.version;
      durableDirtyRef.current = false;
    } catch (error) {
      if (!isOperationsArtifactConflict(error)) throw error;

      // A second tab or device saved first. Refresh the version and retry this
      // explicit local edit once instead of overwriting an unknown revision.
      const latest = await operationsArtifactsAPI.get<{ symbols?: string[] }>('watchlist', 'primary');
      durableVersionRef.current = latest?.version;
      const retry = await operationsArtifactsAPI.put(
        'watchlist',
        'primary',
        { symbols: normalized },
        durableVersionRef.current,
      );
      if (retry) durableVersionRef.current = retry.version;
      durableDirtyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      durableHydratedRef.current = false;
      durableVersionRef.current = undefined;
      durableDirtyRef.current = false;
      setWatchlistSymbols([]);
      return undefined;
    }

    let active = true;
    const hydrateDurableWatchlist = async () => {
      const storageKey = watchlistStorageKey(user.id);
      const localSymbols = readStoredSymbols(storageKey);
      symbolsRef.current = localSymbols;
      setWatchlistSymbols(localSymbols);
      durableHydratedRef.current = false;
      durableVersionRef.current = undefined;
      durableDirtyRef.current = false;
      try {
        const artifact = await operationsArtifactsAPI.get<{ symbols?: string[] }>('watchlist', 'primary');
        if (!active) return;
        durableVersionRef.current = artifact?.version;
        const remoteSymbols = normalizeSymbols(artifact?.payload?.symbols);
        if (durableDirtyRef.current) {
          await persistDurableWatchlist(symbolsRef.current);
        } else if (remoteSymbols.length > 0 || artifact) {
          symbolsRef.current = remoteSymbols;
          setWatchlistSymbols(remoteSymbols);
        } else if (localSymbols.length > 0) {
          // Only a cache already namespaced to this authenticated account may
          // seed a new server artifact. Legacy global caches are never read.
          await persistDurableWatchlist(localSymbols);
        }
      } catch (error) {
        console.warn('Durable watchlist is unavailable; using this device cache.', error);
      } finally {
        if (active) {
          window.localStorage.setItem(storageKey, JSON.stringify(symbolsRef.current));
          durableHydratedRef.current = true;
        }
      }
    };
    void hydrateDurableWatchlist();
    return () => { active = false; };
  }, [persistDurableWatchlist, user?.id]);

  const formatPrice = useCallback((value: number | null, currency = 'USD'): string => {
    if (value === null) return '—';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }, [locale]);

  const formatCompact = useCallback((value: number | null): string => {
    if (value === null) return '—';
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
    }).format(value);
  }, [locale]);

  const formatPercent = useCallback((value: number | null): string => {
    if (value === null) return '—';
    if (value === 0) return '0.00%';
    return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;
  }, []);

  const formatSyncTime = useCallback((timestamp: number | null): string => {
    if (!timestamp) return copy.neverSynced;
    return `${new Intl.DateTimeFormat(locale, {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(timestamp))} ET`;
  }, [copy.neverSynced, locale]);

  const getContext = useCallback((item: WatchlistDisplayItem): string => {
    const changePercent = item.changePercent;
    const price = item.price;
    const dayHigh = item.dayHigh;
    const dayLow = item.dayLow;

    if (changePercent === null || price === null || dayHigh === null || dayLow === null || price <= 0 || dayHigh <= 0 || dayLow <= 0) {
      return 'Data unavailable';
    }
    if (changePercent > 7) return 'Bullish';
    if (changePercent < -7) return 'Bearish';
    if (changePercent < -5 && (price - dayLow) / price < 0.015) return 'Oversold';
    if (Math.abs(changePercent) < 3 && (price - dayLow) / price < 0.01) return 'Near support';
    if (Math.abs(changePercent) < 3 && (dayHigh - price) / price < 0.01) return 'Near resistance';
    if (Math.abs(changePercent) < 2) return 'No clear setup';
    if (changePercent > 2) return 'Mild bullish';
    if (changePercent < -2) return 'Mild bearish';
    return 'No clear setup';
  }, []);

  const contextTone = (context: string): string => {
    const normalized = context.toLowerCase();
    if (normalized.includes('bullish') || normalized.includes('support') || normalized.includes('oversold')) return 'is-positive';
    if (normalized.includes('bearish')) return 'is-negative';
    if (normalized.includes('resistance')) return 'is-caution';
    if (normalized.includes('unavailable')) return 'is-muted';
    return 'is-neutral';
  };

  const refreshWatchlistData = useCallback(async (symbolsArg?: string[]) => {
    const symbols = normalizeSymbols(symbolsArg ?? symbolsRef.current);
    const requestId = ++requestIdRef.current;

    if (symbols.length === 0) {
      setWatchlistData([]);
      setRefreshing(false);
      setFetchError(null);
      return;
    }

    setRefreshing(true);
    try {
      const stocks = await marketDataService.getStocks(symbols);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const stockMap = new Map(stocks.map(stock => [String(stock.symbol).trim().toUpperCase(), stock]));
      const mapped = symbols.map<WatchlistDisplayItem>(symbol => {
        const stock = stockMap.get(symbol);
        const price = finiteNumber(stock?.price);
        const previousClose = finiteNumber(stock?.previousClose);
        const suppliedChange = finiteNumber(stock?.change);
        const suppliedPercent = finiteNumber(stock?.changePercent) ?? finiteNumber(stock?.changePct);
        const calculatedChange = suppliedChange ?? (price !== null && previousClose !== null ? price - previousClose : null);
        const calculatedPercent = suppliedPercent ?? (
          price !== null && previousClose !== null && previousClose !== 0
            ? ((price - previousClose) / previousClose) * 100
            : null
        );

        return {
          symbol,
          name: stock?.name ?? null,
          price,
          change: calculatedChange,
          changePercent: calculatedPercent,
          volume: finiteNumber(stock?.volume),
          marketCap: finiteNumber(stock?.marketCap),
          sector: stock?.sector ?? null,
          dayHigh: finiteNumber(stock?.dayHigh),
          dayLow: finiteNumber(stock?.dayLow),
          currency: stock?.currency || 'USD',
          dataSource: stock?.dataSource || null,
        };
      });

      setWatchlistData(mapped);
      setFetchError(null);
      setLastUpdated(Date.now());
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error('Failed to refresh watchlist market data:', error);
      setFetchError(copy.fetchError);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setRefreshing(false);
    }
  }, [copy.fetchError]);

  useEffect(() => {
    symbolsRef.current = watchlistSymbols;
    if (!user?.id) return undefined;
    if (!durableHydratedRef.current) {
      void refreshWatchlistData(watchlistSymbols);
      return undefined;
    }
    const storageKey = watchlistStorageKey(user.id);
    window.localStorage.setItem(storageKey, JSON.stringify(watchlistSymbols));
    window.dispatchEvent(new CustomEvent('alphalab:watchlist-change', {
      detail: { symbols: watchlistSymbols },
    }));
    if (durableHydratedRef.current) {
      if (durableSaveTimerRef.current !== null) window.clearTimeout(durableSaveTimerRef.current);
      durableSaveTimerRef.current = window.setTimeout(() => {
        void persistDurableWatchlist(watchlistSymbols).catch((error) => {
          console.warn('Watchlist could not be synchronized across devices.', error);
        });
      }, 300);
    }
    void refreshWatchlistData(watchlistSymbols);
    return () => {
      if (durableSaveTimerRef.current !== null) window.clearTimeout(durableSaveTimerRef.current);
    };
  }, [persistDurableWatchlist, refreshWatchlistData, user?.id, watchlistSymbols]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshWatchlistData();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshWatchlistData]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const storageKey = watchlistStorageKey(user.id);
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) setWatchlistSymbols(readStoredSymbols(storageKey, event.newValue));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user?.id]);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      void refreshWatchlistData();
    };
    window.addEventListener('alphalab:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('alphalab:refresh', handleGlobalRefresh);
  }, [refreshWatchlistData]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('alphalab:data-sync', {
      detail: { loading: refreshing, timestamp: lastUpdated },
    }));
  }, [lastUpdated, refreshing]);

  const resolveWatchlistSymbol = useCallback(async (input: string): Promise<string | null> => {
    const normalizedInput = input.trim().replace(/^["']|["']$/g, '').trim();
    if (!normalizedInput) return null;
    const upperInput = normalizedInput.toUpperCase();
    const lowerInput = normalizedInput.toLowerCase();

    if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(upperInput)) {
      try {
        const stockData = await marketDataService.getStockData(upperInput);
        if (stockData && !stockData.error) return stockData.symbol.trim().toUpperCase();
      } catch {
        // Continue into company/symbol search when direct lookup is unavailable.
      }
    }

    try {
      const results = await marketDataService.searchStocks(normalizedInput, 10);
      const match = results.find(result => result.symbol.toUpperCase() === upperInput)
        || results.find(result => result.name?.toLowerCase() === lowerInput)
        || results.find(result => result.name?.toLowerCase().startsWith(lowerInput))
        || results.find(result => result.name?.toLowerCase().includes(lowerInput))
        || results[0];
      return match?.symbol?.trim().toUpperCase() || null;
    } catch {
      return null;
    }
  }, []);

  const handleAddSymbol = useCallback(async (inputOverride?: string) => {
    const rawInput = (inputOverride ?? newSymbol).trim();
    if (!rawInput) {
      message.warning(t.watchlist.pleaseEnterSymbol);
      return;
    }

    setAdding(true);
    try {
      const resolvedSymbol = await resolveWatchlistSymbol(rawInput);
      if (!resolvedSymbol) {
        message.error(t.watchlist.noMatchFound.replace('{input}', rawInput));
        return;
      }
      if (symbolsRef.current.includes(resolvedSymbol)) {
        message.warning(t.watchlist.alreadyInWatchlist.replace('{symbol}', resolvedSymbol));
        setNewSymbol('');
        return;
      }

      durableDirtyRef.current = true;
      setWatchlistSymbols(current => normalizeSymbols([...current, resolvedSymbol]));
      setNewSymbol('');
      message.success(t.watchlist.addedToWatchlist.replace('{symbol}', resolvedSymbol));
    } catch (error) {
      console.error(`Failed to add ${rawInput} to watchlist:`, error);
      message.error(t.watchlist.failedToAdd.replace('{input}', rawInput));
    } finally {
      setAdding(false);
    }
  }, [newSymbol, resolveWatchlistSymbol, t.watchlist]);

  const handleRemoveSymbol = useCallback((symbolToRemove: string) => {
    durableDirtyRef.current = true;
    setWatchlistSymbols(current => current.filter(symbol => symbol !== symbolToRemove));
    setWatchlistData(current => current.filter(item => item.symbol !== symbolToRemove));
    message.success(t.watchlist.removedFromWatchlist.replace('{symbol}', symbolToRemove));
  }, [t.watchlist.removedFromWatchlist]);

  const handleAnalyze = useCallback((symbol: string) => {
    rememberMarketSymbol(symbol);
    navigate(marketSymbolPath(symbol));
  }, [navigate]);

  const handleRunBacktest = useCallback((symbol: string) => {
    navigate(`/backtest?symbol=${encodeURIComponent(symbol)}`);
  }, [navigate]);

  const validMoveData = useMemo(
    () => watchlistData.filter(item => item.changePercent !== null),
    [watchlistData],
  );
  const gainers = validMoveData.filter(item => (item.changePercent as number) > 0).length;
  const losers = validMoveData.filter(item => (item.changePercent as number) < 0).length;
  const unchanged = validMoveData.length - gainers - losers;
  const pricedCount = watchlistData.filter(item => item.price !== null).length;
  const averageChange = validMoveData.length > 0
    ? validMoveData.reduce((sum, item) => sum + (item.changePercent as number), 0) / validMoveData.length
    : null;
  const largestMove = useMemo(() => (
    validMoveData.reduce<WatchlistDisplayItem | null>((largest, item) => {
      if (!largest) return item;
      return Math.abs(item.changePercent as number) > Math.abs(largest.changePercent as number) ? item : largest;
    }, null)
  ), [validMoveData]);
  const hasMarketSnapshot = lastUpdated !== null;
  const quoteCoverage = watchlistSymbols.length > 0 && hasMarketSnapshot
    ? (pricedCount / watchlistSymbols.length) * 100
    : null;

  const filterCounts = useMemo(() => ({
    all: watchlistData.length,
    gainers,
    losers,
    missing: watchlistData.filter(item => item.price === null || item.changePercent === null).length,
  }), [gainers, losers, watchlistData]);

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let data = watchlistData.filter(item => {
      if (activeFilter === 'gainers' && (item.changePercent === null || item.changePercent <= 0)) return false;
      if (activeFilter === 'losers' && (item.changePercent === null || item.changePercent >= 0)) return false;
      if (activeFilter === 'missing' && item.price !== null && item.changePercent !== null) return false;
      if (!query) return true;
      const translatedSector = item.sector ? translateSector(item.sector) : '';
      const context = translateSignal(getContext(item));
      return item.symbol.toLowerCase().includes(query)
        || Boolean(item.name?.toLowerCase().includes(query))
        || translatedSector.toLowerCase().includes(query)
        || context.toLowerCase().includes(query);
    });

    if (sortedInfo.columnKey && sortedInfo.order) {
      const key = sortedInfo.columnKey as keyof WatchlistDisplayItem;
      const direction = sortedInfo.order === 'descend' ? -1 : 1;
      data = [...data].sort((left, right) => {
        const leftValue = left[key];
        const rightValue = right[key];
        if (leftValue === null && rightValue === null) return 0;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * direction;
        return String(leftValue).localeCompare(String(rightValue), locale) * direction;
      });
    }
    return data;
  }, [activeFilter, getContext, locale, searchTerm, sortedInfo, translateSector, translateSignal, watchlistData]);

  const distribution = useMemo(() => {
    const bins = [
      { label: '≤ −3%', min: Number.NEGATIVE_INFINITY, max: -3 },
      { label: '−3 / −1%', min: -3, max: -1 },
      { label: '−1 / +1%', min: -1, max: 1 },
      { label: '+1 / +3%', min: 1, max: 3 },
      { label: '≥ +3%', min: 3, max: Number.POSITIVE_INFINITY },
    ];
    return bins.map((bin, index) => ({
      ...bin,
      count: validMoveData.filter(item => {
        const value = item.changePercent as number;
        if (index === 0) return value <= bin.max;
        if (index === bins.length - 1) return value >= bin.min;
        if (index === 1) return value > bin.min && value <= bin.max;
        if (index === 3) return value >= bin.min && value < bin.max;
        return value > bin.min && value < bin.max;
      }).length,
      tone: index < 2 ? 'is-negative' : index > 2 ? 'is-positive' : 'is-neutral',
    }));
  }, [validMoveData]);
  const distributionMax = Math.max(1, ...distribution.map(bin => bin.count));

  const sectorDistribution = useMemo(() => {
    const sectorCounts = new Map<string, number>();
    watchlistData.forEach(item => {
      if (!item.sector) return;
      sectorCounts.set(item.sector, (sectorCounts.get(item.sector) || 0) + 1);
    });
    return Array.from(sectorCounts.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((left, right) => right.count - left.count || left.sector.localeCompare(right.sector))
      .slice(0, 6);
  }, [watchlistData]);

  const rangePosition = (item: WatchlistDisplayItem): number | null => {
    if (item.dayLow === null || item.dayHigh === null || item.price === null || item.dayHigh <= item.dayLow) return null;
    return Math.max(0, Math.min(100, ((item.price - item.dayLow) / (item.dayHigh - item.dayLow)) * 100));
  };

  const renderRange = (item: WatchlistDisplayItem) => {
    const position = rangePosition(item);
    if (position === null || item.dayLow === null || item.dayHigh === null) {
      return <span className="wl-missing-value">—</span>;
    }
    return (
      <div className="wl-range" aria-label={`${item.dayLow.toFixed(2)} – ${item.dayHigh.toFixed(2)}`}>
        <div className="wl-range__labels">
          <span>{item.dayLow.toFixed(2)}</span>
          <span>{item.dayHigh.toFixed(2)}</span>
        </div>
        <div className="wl-range__track">
          <i style={{ left: `${position}%` }} />
        </div>
      </div>
    );
  };

  const columns = [
    {
      title: t.market.symbol,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 188,
      fixed: 'left' as const,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'symbol' ? sortedInfo.order : undefined,
      render: (symbol: string, item: WatchlistDisplayItem) => (
        <button type="button" className="wl-symbol" onClick={() => handleAnalyze(symbol)}>
          <span className="wl-symbol__mark" aria-hidden="true">{symbol.charAt(0)}</span>
          <span>
            <strong>{symbol}</strong>
            <small>{item.name || symbol}</small>
          </span>
        </button>
      ),
    },
    {
      title: copy.last,
      dataIndex: 'price',
      key: 'price',
      width: 124,
      align: 'right' as const,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'price' ? sortedInfo.order : undefined,
      render: (price: number | null, item: WatchlistDisplayItem) => (
        <div className="wl-number-cell">
          <strong>{formatPrice(price, item.currency)}</strong>
          <small>{item.dataSource || copy.dataSource}</small>
        </div>
      ),
    },
    {
      title: copy.dayMove,
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 124,
      align: 'right' as const,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'changePercent' ? sortedInfo.order : undefined,
      render: (percent: number | null, item: WatchlistDisplayItem) => (
        <div className={`wl-number-cell wl-move ${percent === null ? 'is-muted' : percent > 0 ? 'is-positive' : percent < 0 ? 'is-negative' : 'is-neutral'}`}>
          <strong>{formatPercent(percent)}</strong>
          <small>{item.change === null ? '—' : `${item.change > 0 ? '+' : item.change < 0 ? '−' : ''}${formatPrice(Math.abs(item.change), item.currency)}`}</small>
        </div>
      ),
    },
    {
      title: t.watchlist.dayRange,
      key: 'dayRange',
      width: 164,
      render: (_: unknown, item: WatchlistDisplayItem) => renderRange(item),
    },
    {
      title: copy.volume,
      dataIndex: 'volume',
      key: 'volume',
      width: 106,
      align: 'right' as const,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'volume' ? sortedInfo.order : undefined,
      render: (volume: number | null) => <span className="wl-tabular">{formatCompact(volume)}</span>,
    },
    {
      title: copy.marketCap,
      dataIndex: 'marketCap',
      key: 'marketCap',
      width: 116,
      align: 'right' as const,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'marketCap' ? sortedInfo.order : undefined,
      render: (marketCap: number | null) => <span className="wl-tabular">{formatCompact(marketCap)}</span>,
    },
    {
      title: t.market.sector,
      dataIndex: 'sector',
      key: 'sector',
      width: 132,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'sector' ? sortedInfo.order : undefined,
      render: (sector: string | null) => <span className="wl-sector-name">{sector ? translateSector(sector) : '—'}</span>,
    },
    {
      title: (
        <Tooltip title={copy.contextNote}>
          <span className="wl-context-heading">{copy.context}<sup>i</sup></span>
        </Tooltip>
      ),
      key: 'context',
      width: 146,
      render: (_: unknown, item: WatchlistDisplayItem) => {
        const context = getContext(item);
        return (
          <span className={`wl-context ${contextTone(context)}`}>
            <i aria-hidden="true" />
            {translateSignal(context)}
          </span>
        );
      },
    },
    {
      title: t.watchlist.actions,
      key: 'actions',
      width: 122,
      className: 'wl-actions-column',
      align: 'right' as const,
      render: (_: unknown, item: WatchlistDisplayItem) => (
        <div className="wl-row-actions">
          <Tooltip title={copy.openAnalysis}>
            <button type="button" className="wl-action wl-action--primary" onClick={() => handleAnalyze(item.symbol)} aria-label={`${copy.openAnalysis}: ${item.symbol}`}>
              <LineChartOutlined />
              <span className="wl-action__label">{t.watchlist.analyze}</span>
            </button>
          </Tooltip>
          <Tooltip title={copy.runBacktest}>
            <button type="button" className="wl-action" onClick={() => handleRunBacktest(item.symbol)} aria-label={`${copy.runBacktest}: ${item.symbol}`}>
              <PlayCircleOutlined />
              <span className="wl-action__label">{t.watchlist.backtest}</span>
            </button>
          </Tooltip>
          <Tooltip title={copy.removeSymbol}>
            <button type="button" className="wl-action wl-action--remove" onClick={() => handleRemoveSymbol(item.symbol)} aria-label={`${copy.removeSymbol}: ${item.symbol}`}>
              <DeleteOutlined />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const resetFilters = () => {
    setActiveFilter('all');
    setSearchTerm('');
    setSortedInfo({});
  };

  return (
    <div className="watchlist-page-shell editorial-watchlist">
      <div className="wl-canvas">
        <header className="wl-page-heading">
          <div className="wl-heading-copy">
            <p className="wl-kicker">{copy.kicker}</p>
            <h1>{t.watchlist.title}</h1>
            <p className="wl-description">{copy.description}</p>
            <div className="wl-sync-line">
              <ClockCircleOutlined aria-hidden="true" />
              <span>{copy.lastSync}</span>
              <strong>{formatSyncTime(lastUpdated)}</strong>
              {refreshing && <i className="wl-live-dot" aria-label={copy.loading} />}
            </div>
          </div>

          <div className="wl-command-panel">
            <div className="wl-command-panel__head">
              <span>{copy.addLabel}</span>
              <button
                type="button"
                className="wl-refresh-button"
                onClick={() => void refreshWatchlistData()}
                disabled={refreshing || watchlistSymbols.length === 0}
              >
                <ReloadOutlined className={refreshing ? 'is-spinning' : undefined} />
                {copy.refresh}
              </button>
            </div>
            <form
              className="wl-add-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddSymbol();
              }}
            >
              <label className="wl-add-input">
                <SearchOutlined aria-hidden="true" />
                <input
                  value={newSymbol}
                  onChange={event => setNewSymbol(event.target.value.toUpperCase())}
                  placeholder={t.watchlist.symbolPlaceholder}
                  aria-label={copy.addLabel}
                  autoComplete="off"
                />
              </label>
              <button type="submit" className="wl-add-button" disabled={adding || !newSymbol.trim()}>
                <PlusOutlined className={adding ? 'is-spinning' : undefined} />
                {t.watchlist.add}
              </button>
            </form>
            <small>{copy.addHint}</small>
          </div>
        </header>

        {fetchError && (
          <div className="wl-error-banner" role="alert">
            <span>{fetchError}</span>
            <button type="button" onClick={() => void refreshWatchlistData()}>{copy.refresh}</button>
          </div>
        )}

        <section className="wl-metric-ledger" aria-label={isChinese ? '自选列表摘要' : 'Watchlist summary'}>
          <article>
            <span>{t.watchlist.watchlistSize}</span>
            <strong className="is-blue">{watchlistSymbols.length}</strong>
            <small>{copy.symbolsTracked}</small>
          </article>
          <article>
            <span>{copy.coverage}</span>
            <strong>{quoteCoverage === null ? '—' : `${quoteCoverage.toFixed(0)}%`}</strong>
            <small>{hasMarketSnapshot ? `${copy.quoted} ${pricedCount} / ${watchlistSymbols.length}` : copy.neverSynced}</small>
          </article>
          <article>
            <span>{copy.advancing}</span>
            <strong className="is-positive">{hasMarketSnapshot ? gainers : '—'}</strong>
            <small>{hasMarketSnapshot ? `${validMoveData.length} ${copy.validMoves}` : copy.neverSynced}</small>
          </article>
          <article>
            <span>{copy.declining}</span>
            <strong className="is-negative">{hasMarketSnapshot ? losers : '—'}</strong>
            <small>{hasMarketSnapshot ? `${validMoveData.length} ${copy.validMoves}` : copy.neverSynced}</small>
          </article>
          <article>
            <span>{t.watchlist.avgPerformance}</span>
            <strong className={averageChange === null ? '' : averageChange > 0 ? 'is-positive' : averageChange < 0 ? 'is-negative' : ''}>
              {formatPercent(averageChange)}
            </strong>
            <small>{hasMarketSnapshot ? `${validMoveData.length} ${copy.validMoves}` : copy.neverSynced}</small>
          </article>
          <article>
            <span>{copy.largestMove}</span>
            <strong className={largestMove?.changePercent == null ? '' : largestMove.changePercent > 0 ? 'is-positive' : largestMove.changePercent < 0 ? 'is-negative' : ''}>
              {largestMove ? largestMove.symbol : '—'}
            </strong>
            <small>{largestMove ? formatPercent(largestMove.changePercent) : hasMarketSnapshot ? t.watchlist.dataUnavailable : copy.neverSynced}</small>
          </article>
        </section>

        {watchlistSymbols.length === 0 ? (
          <section className="wl-empty-state">
            <div className="wl-empty-state__mark" aria-hidden="true">+</div>
            <p className="wl-kicker">{copy.kicker}</p>
            <h2>{t.watchlist.noSymbols}</h2>
            <p>{copy.emptyPrompt}</p>
            <button type="button" onClick={() => void handleAddSymbol('AAPL')} disabled={adding}>
              <PlusOutlined />
              {t.watchlist.tryAAPL}
            </button>
          </section>
        ) : (
          <div className="wl-workspace-grid">
            <section className="wl-table-panel" aria-labelledby="watchlist-table-title">
              <div className="wl-table-heading">
                <div>
                  <p className="wl-kicker">{copy.monitoredSymbols}</p>
                  <h2 id="watchlist-table-title">{t.watchlist.watchlistItems}</h2>
                </div>
                <label className="wl-table-search">
                  <SearchOutlined aria-hidden="true" />
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder={t.watchlist.searchWatchlist}
                    aria-label={t.watchlist.searchWatchlist}
                  />
                  {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label={copy.resetFilters}>×</button>}
                </label>
              </div>

              <div className="wl-filter-tabs" role="tablist" aria-label={isChinese ? '筛选自选标的' : 'Filter watchlist'}>
                {([
                  ['all', copy.all, filterCounts.all],
                  ['gainers', copy.advancing, filterCounts.gainers],
                  ['losers', copy.declining, filterCounts.losers],
                  ['missing', copy.needsData, filterCounts.missing],
                ] as Array<[WatchlistFilter, string, number]>).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === key}
                    className={activeFilter === key ? 'is-active' : undefined}
                    onClick={() => setActiveFilter(key)}
                  >
                    {label}<span>{count}</span>
                  </button>
                ))}
              </div>

              {refreshing && watchlistData.length === 0 ? (
                <div className="wl-loading-state"><ReloadOutlined className="is-spinning" /> {copy.loading}</div>
              ) : filteredData.length === 0 ? (
                <div className="wl-filter-empty">
                  <span>{copy.noFilteredRows}</span>
                  <button type="button" onClick={resetFilters}>{copy.resetFilters}</button>
                </div>
              ) : (
                <>
                  <div className="wl-desktop-table">
                    <Table
                      className="wl-table"
                      columns={columns}
                      dataSource={filteredData}
                      rowKey="symbol"
                      pagination={false}
                      bordered={false}
                      loading={refreshing}
                      scroll={{ x: 1222 }}
                      onChange={(_pagination, _filters, sorter) => {
                        const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
                        setSortedInfo({
                          columnKey: nextSorter?.columnKey ? String(nextSorter.columnKey) : undefined,
                          order: nextSorter?.order,
                        });
                      }}
                      rowClassName={item => item.price === null ? 'wl-row--missing' : ''}
                    />
                  </div>

                  <div className="wl-mobile-list">
                    {filteredData.map(item => {
                      const context = getContext(item);
                      const position = rangePosition(item);
                      return (
                        <article key={item.symbol} className="wl-mobile-card">
                          <header>
                            <button type="button" className="wl-symbol" onClick={() => handleAnalyze(item.symbol)}>
                              <span className="wl-symbol__mark" aria-hidden="true">{item.symbol.charAt(0)}</span>
                              <span><strong>{item.symbol}</strong><small>{item.name || item.symbol}</small></span>
                            </button>
                            <div className="wl-mobile-quote">
                              <strong>{formatPrice(item.price, item.currency)}</strong>
                              <span className={item.changePercent === null ? 'is-muted' : item.changePercent > 0 ? 'is-positive' : item.changePercent < 0 ? 'is-negative' : ''}>
                                {formatPercent(item.changePercent)}
                              </span>
                            </div>
                          </header>

                          <div className="wl-mobile-range">
                            <span>{t.watchlist.dayRange}</span>
                            {position === null || item.dayLow === null || item.dayHigh === null ? (
                              <small>{copy.rangeUnavailable}</small>
                            ) : (
                              <div className="wl-range">
                                <div className="wl-range__labels"><span>{item.dayLow.toFixed(2)}</span><span>{item.dayHigh.toFixed(2)}</span></div>
                                <div className="wl-range__track"><i style={{ left: `${position}%` }} /></div>
                              </div>
                            )}
                          </div>

                          <dl>
                            <div><dt>{copy.volume}</dt><dd>{formatCompact(item.volume)}</dd></div>
                            <div><dt>{copy.marketCap}</dt><dd>{formatCompact(item.marketCap)}</dd></div>
                            <div><dt>{t.market.sector}</dt><dd>{item.sector ? translateSector(item.sector) : '—'}</dd></div>
                            <div><dt>{copy.context}</dt><dd><span className={`wl-context ${contextTone(context)}`}><i />{translateSignal(context)}</span></dd></div>
                          </dl>

                          <footer>
                            <button type="button" className="wl-action wl-action--primary" onClick={() => handleAnalyze(item.symbol)}><LineChartOutlined />{t.watchlist.analyze}</button>
                            <button type="button" className="wl-action" onClick={() => handleRunBacktest(item.symbol)}><PlayCircleOutlined />{t.watchlist.backtest}</button>
                            <button type="button" className="wl-action wl-action--remove" onClick={() => handleRemoveSymbol(item.symbol)} aria-label={`${copy.removeSymbol}: ${item.symbol}`}><DeleteOutlined /></button>
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            <aside className="wl-insight-panel" aria-labelledby="watchlist-breadth-title">
              <div className="wl-insight-heading">
                <div>
                  <p className="wl-dark-kicker">{copy.breadth}</p>
                  <h2 id="watchlist-breadth-title">{validMoveData.length ? `${gainers} / ${losers}` : '— / —'}</h2>
                  <span>{copy.advancing} / {copy.declining}</span>
                </div>
                <small>{formatSyncTime(lastUpdated)}</small>
              </div>

              <p className="wl-insight-description">{copy.breadthDescription}</p>
              {validMoveData.length > 0 ? (
                <>
                  <div className="wl-breadth-track" aria-label={`${copy.advancing} ${gainers}, ${copy.unchanged} ${unchanged}, ${copy.declining} ${losers}`}>
                    <i className="is-positive" style={{ width: `${(gainers / validMoveData.length) * 100}%` }} />
                    <i className="is-neutral" style={{ width: `${(unchanged / validMoveData.length) * 100}%` }} />
                    <i className="is-negative" style={{ width: `${(losers / validMoveData.length) * 100}%` }} />
                  </div>
                  <div className="wl-breadth-legend">
                    <span><i className="is-positive" />{copy.advancing}<strong>{gainers}</strong></span>
                    <span><i className="is-neutral" />{copy.unchanged}<strong>{unchanged}</strong></span>
                    <span><i className="is-negative" />{copy.declining}<strong>{losers}</strong></span>
                  </div>
                </>
              ) : <div className="wl-dark-empty">{copy.noBreadth}</div>}

              <section className="wl-dark-section">
                <div className="wl-dark-section__heading"><h3>{copy.distribution}</h3><span>{validMoveData.length}</span></div>
                {validMoveData.length > 0 ? (
                  <div className="wl-distribution-list">
                    {distribution.map(bin => (
                      <div key={bin.label} className={bin.tone}>
                        <span>{bin.label}</span>
                        <i><b style={{ width: `${(bin.count / distributionMax) * 100}%` }} /></i>
                        <strong>{bin.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : <div className="wl-dark-empty is-compact">{copy.noBreadth}</div>}
              </section>

              <section className="wl-dark-section">
                <div className="wl-dark-section__heading"><h3>{copy.sectorMix}</h3><span>{sectorDistribution.length}</span></div>
                {sectorDistribution.length > 0 ? (
                  <div className="wl-sector-list">
                    {sectorDistribution.map(item => (
                      <div key={item.sector}>
                        <span>{translateSector(item.sector)}</span>
                        <i><b style={{ width: `${(item.count / Math.max(1, watchlistData.length)) * 100}%` }} /></i>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : <div className="wl-dark-empty is-compact">{copy.noSector}</div>}
              </section>

              <footer className="wl-insight-footer">
                <span>{copy.quoted}<strong>{pricedCount}</strong></span>
                <span>{copy.unavailable}<strong>{filterCounts.missing}</strong></span>
                <span>{copy.coverage}<strong>{quoteCoverage === null ? '—' : `${quoteCoverage.toFixed(0)}%`}</strong></span>
              </footer>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;
