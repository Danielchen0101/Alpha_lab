import React, { useState, useEffect } from 'react';
import { Table, Tag, Input, Select, Button, Space, Alert, message, Empty, Spin, Skeleton, Typography } from 'antd';
import { SearchOutlined, LineChartOutlined, PlayCircleOutlined, BarChartOutlined, ReloadOutlined, EyeOutlined, StarOutlined, PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import marketDataService, { StockData, searchStockData, safeNumber, safeToFixed, getUserMarketSymbols, addUserMarketSymbols, deleteUserMarketSymbol } from '../services/marketDataService';
import { sharedDataService } from '../services/sharedDataService';
import { formatMarketCap } from '../utils/format';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';

const MAX_MARKET_SYMBOLS = 100;

const { Option } = Select;
const { Text } = Typography;

const Market: React.FC = () => {
  const { t, translateSector } = useLanguage();
  const { tradeMode } = useTradeMode();
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('symbol');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setLastFetched] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [userSymbols, setUserSymbols] = useState<string[]>([]);
  const [addingSymbol, setAddingSymbol] = useState(false);
  const navigate = useNavigate();

  const STORAGE_KEY = "quant_watchlist";

  // 默认股票列表（与后端保持一致，优先主流科技股）
  const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'AMD', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC'];

  // 初始化加载数据
  useEffect(() => {
    // 延迟加载数据，让用户先看到页面框架
    const loadTimer = setTimeout(() => {
      initializeMarket();
    }, 100); // 100ms延迟，足够渲染初始界面

    // 从localStorage加载watchlist
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
        }
      } catch (err) {
        console.error('Failed to parse watchlist from localStorage:', err);
      }
    }

    // 清理定时器
    return () => {
      clearTimeout(loadTimer);
    };
  }, []);

  // 过滤和排序股票（依赖searchText实现实时过滤）
  useEffect(() => {
    filterAndSortStocks();
  }, [stocks, selectedSector, sortField, sortOrder, searchText]);

  // 监听localStorage变化，实现页面间watchlist同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              setWatchlist(parsed);
            }
          } catch (err) {
            console.error('Failed to parse watchlist from storage event:', err);
          }
        } else {
          setWatchlist([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const filterAndSortStocks = () => {
    let result = [...stocks];

    // 按搜索文本过滤 (local filter by symbol or name)
    if (searchText.trim()) {
      const q = searchText.trim().toUpperCase();
      result = result.filter(stock =>
        stock.symbol.toUpperCase().includes(q) ||
        (stock.name && stock.name.toUpperCase().includes(q))
      );
    }

    // 按行业过滤
    if (selectedSector !== 'all') {
      result = result.filter(stock => stock.sector === selectedSector);
    }

    // 排序
    result.sort((a, b) => {
      const aValue = a[sortField as keyof StockData];
      const bValue = b[sortField as keyof StockData];

      // 处理 null 值 - null 始终排在最后
      const aIsNull = aValue === null || aValue === undefined;
      const bIsNull = bValue === null || bValue === undefined;
      
      if (aIsNull && bIsNull) return 0; // 两个都是 null，保持顺序
      if (aIsNull) return 1; // a 是 null，排在后面
      if (bIsNull) return -1; // b 是 null，a 排前面

      // 数字排序
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'ascend' ? aValue - bValue : bValue - aValue;
      }

      // 字符串排序
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ascend'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    setFilteredStocks(result);
  };

  const initializeMarket = async () => {
    try {
      setLoading(true);
      setError('');

      // Step 1: Load user's saved symbols from backend
      console.log('[Market] Loading user symbols...');
      const { symbols: savedSymbols, status } = await getUserMarketSymbols();

      let symbolsToLoad: string[];
      if (status === 'ok' && savedSymbols.length > 0) {
        symbolsToLoad = savedSymbols;
        setUserSymbols(savedSymbols);
        console.log('[Market] Loaded user symbols:', savedSymbols);
      } else {
        // No saved symbols, use defaults
        symbolsToLoad = DEFAULT_SYMBOLS;
        setUserSymbols(DEFAULT_SYMBOLS);
        console.log('[Market] Using default symbols:', DEFAULT_SYMBOLS);
      }

      // Step 2: Fetch market data for these symbols
      await fetchMarketData(symbolsToLoad);
    } catch (err: any) {
      console.error('[Market] Initialization failed:', err);
      setError(`Initialization failed: ${err.message}`);
      // Fallback to defaults
      await fetchMarketData(DEFAULT_SYMBOLS);
    }
  };

  const fetchMarketData = async (symbols?: string[]) => {
    // 如果已经在请求中，直接返回
    if (isFetching) {
      console.log('[Market优化] 请求已在进行中，跳过重复请求');
      return;
    }

    try {
      setIsFetching(true);
      setLoading(true);
      setError('');

      console.log('[Market优化] 正在获取市场数据...');

      let stockData: StockData[];
      if (symbols && symbols.length > 0) {
        // Fetch data for specific symbols
        stockData = await marketDataService.getStocks(symbols);
      } else {
        // Fallback to shared data service (uses default symbols)
        stockData = await sharedDataService.getStocks();
      }

      if (stockData.length > 0) {
        console.log('[Market优化] 市场数据加载成功');
        console.log('[Market优化] 数据来源:', stockData[0]?.dataSource || 'Alpaca');
        console.log('[Market优化] 股票数量:', stockData.length);

        // 过滤掉有错误的股票
        const validStocks = stockData.filter(stock => !stock.error);

        if (validStocks.length === 0) {
          setError(t.market.noValidStockData);
          message.warning(t.market.noValidStockData);
        } else {
          setStocks(validStocks);
          setLastUpdated(new Date());
          setLastFetched(Date.now());
          message.success(`${t.market.dataSource}: ${stockData[0]?.dataSource || 'Alpaca'} (${validStocks.length})`);
        }
      } else {
        setError(t.market.invalidDataFormat);
        message.error(t.market.invalidDataFormat);
      }
    } catch (err: any) {
      console.error('[Market优化] 获取市场数据失败:', err);
      const errorMessage = err.message || t.common.unknown;
      setError(`${t.market.failedToLoadMarketData}: ${errorMessage}`);
      message.error(t.market.failedToLoadMarketData);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  const searchStockBySymbol = async (query: string) => {
    const q = query.trim();
    if (!q) return false;

    // Check if already in stocks list (case-insensitive symbol match)
    const qUpper = q.toUpperCase();
    const existingStock = stocks.find(s => s.symbol.toUpperCase() === qUpper);
    if (existingStock) {
      message.info(`${qUpper} ${t.market.alreadyInListShort}`);
      return true;
    }

    try {
      setSearching(true);
      console.log(`[Market] Searching: "${q}"`);

      // Use the new search endpoint — backend handles symbol detection + company name search
      const { stocks: results, status, message: msg } = await searchStockData(q);

      if (status === 'not_found' || results.length === 0) {
        message.warning(msg || t.market.noMatchFound);
        return false;
      }

      // Filter out duplicates already in the list
      const existingSymbols = new Set(stocks.map(s => s.symbol.toUpperCase()));
      const newStocks = results.filter(s => !existingSymbols.has(s.symbol.toUpperCase()));

      if (newStocks.length === 0) {
        message.info(`${results.map(s => s.symbol).join(', ')} ${t.market.alreadyInListShort}`);
        return true;
      }

      // Add new stocks to the list
      setStocks(prev => [...prev, ...newStocks]);
      const addedNames = newStocks.map(s => s.symbol).join(', ');
      message.success(`${t.market.addedSymbol.replace('{symbol}', addedNames)} (${newStocks[0]?.dataSource || 'Alpaca'})`);
      return true;
    } catch (error: any) {
      console.error(`[Market] Search failed for "${q}":`, error);
      const errorCode = error.code || '';
      if (errorCode === 'AUTH_REQUIRED') {
        message.error(t.market.authRequired);
      } else if (errorCode === 'CONFIG_REQUIRED') {
        message.error(t.market.apiKeysNotConfigured);
      } else {
        message.error(`${t.market.searchFailed}: ${error.message || t.common.unknown}`);
      }
      return false;
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    const q = searchText.trim();
    if (!q) {
      // Empty search — show all
      return;
    }
    // Check if symbol exists in current stocks (case-insensitive)
    const qUpper = q.toUpperCase();
    const existsLocally = stocks.some(s => s.symbol.toUpperCase() === qUpper);
    if (existsLocally) {
      // Already filtered by searchText in real-time; just keep it filtered
      return;
    }
    // Symbol not in current list — try external search to add it
    await searchStockBySymbol(q);
  };

  const addSymbolToUserList = async (symbol: string) => {
    if (addingSymbol) return;

    // Check limit
    if (userSymbols.length >= MAX_MARKET_SYMBOLS) {
      message.warning(t.market.maxSymbolsWarning.replace('{max}', String(MAX_MARKET_SYMBOLS)));
      return;
    }

    // Check if already in user list
    if (userSymbols.includes(symbol.toUpperCase())) {
      message.info(t.market.alreadyInList.replace('{symbol}', symbol));
      return;
    }

    try {
      setAddingSymbol(true);
      const result = await addUserMarketSymbols([symbol]);

      if (result.status === 'limit_reached') {
        message.warning(result.error || t.market.maxSymbolsWarning.replace('{max}', String(MAX_MARKET_SYMBOLS)));
        return;
      }

      if (result.status === 'ok') {
        setUserSymbols(result.symbols);
        message.success(t.market.addedToList.replace('{symbol}', symbol));

        // If the stock data is not in the current list, fetch it
        if (!stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase())) {
          const stockData = await marketDataService.getStocks([symbol]);
          if (stockData.length > 0) {
            setStocks(prev => [...prev, ...stockData]);
          }
        }
      } else {
        message.error(`${t.market.failedToAdd.replace('{symbol}', symbol)}: ${result.error || t.common.unknown}`);
      }
    } catch (err: any) {
      message.error(`${t.market.failedToAdd.replace('{symbol}', symbol)}: ${err.message}`);
    } finally {
      setAddingSymbol(false);
    }
  };

  const removeSymbolFromUserList = async (symbol: string) => {
    try {
      const result = await deleteUserMarketSymbol(symbol);

      if (result.status === 'ok') {
        setUserSymbols(result.symbols);
        // Remove from displayed stocks
        setStocks(prev => prev.filter(s => s.symbol.toUpperCase() !== symbol.toUpperCase()));
        message.success(t.market.removedFromList.replace('{symbol}', symbol));
      } else {
        message.error(t.market.failedToRemove.replace('{symbol}', symbol));
      }
    } catch (err: any) {
      message.error(`${t.market.failedToRemove.replace('{symbol}', symbol)}: ${err.message}`);
    }
  };

  const handleAnalyze = (symbol: string) => {
    navigate(`/analysis/${symbol}`);
  };

  const handleBacktest = (symbol: string) => {
    navigate('/backtest', { state: { presetSymbol: symbol } });
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const exists = prev.some(item => item.symbol === symbol);
      let newWatchlist;
      
      if (exists) {
        message.success(`${t.market.removedSymbol.replace('{symbol}', symbol)}`);
        newWatchlist = prev.filter(item => item.symbol !== symbol);
      } else {
        // 从当前stocks数据中查找完整股票信息
        const stock = stocks.find(s => s.symbol === symbol);
        if (stock) {
          // 创建完整的watchlist item
          const watchlistItem = {
            symbol: stock.symbol,
            name: stock.name || `${symbol} Inc.`,
            price: stock.price || 0,
            change: stock.change || 0,
            changePercent: stock.changePercent || 0,
            volume: stock.volume || 0,
            marketCap: stock.marketCap || 0,
            sector: stock.sector || 'Unknown',
            addedAt: new Date().toISOString()
          };
          message.success(`${t.market.addedSymbol.replace('{symbol}', symbol)}`);
          newWatchlist = [...prev, watchlistItem];
        } else {
          // 如果没有找到完整信息，至少保存symbol
          message.warning(`${t.market.addedSymbol.replace('{symbol}', symbol)}`);
          newWatchlist = [...prev, { 
            symbol, 
            name: `${symbol} Inc.`,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            marketCap: 0,
            sector: 'Unknown',
            addedAt: new Date().toISOString() 
          }];
        }
      }
      
      // 保存到localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  };

  const isInWatchlist = (symbol: string): boolean => {
    return watchlist.some(item => item.symbol === symbol);
  };

  // 获取所有行业 - 对Alpaca数据友好
  const getAllSectors = () => {
    const sectors = new Set<string>();
    stocks.forEach(stock => {
      if (stock.sector && stock.sector !== 'N/A' && stock.sector !== '--') {
        sectors.add(stock.sector);
      }
    });
    
    // 如果没有sector数据，返回空数组
    if (sectors.size === 0) {
      return [];
    }
    
    return Array.from(sectors).sort();
  };

  // 计算市场统计
  const marketStats = {
    totalStocks: stocks.length,
    gainers: stocks.filter(s => safeNumber(s.changePercent) > 0).length,
    losers: stocks.filter(s => safeNumber(s.changePercent) < 0).length,
    unchanged: stocks.filter(s => safeNumber(s.changePercent) === 0).length,
    avgChange: stocks.length > 0 
      ? stocks.reduce((sum, s) => sum + safeNumber(s.changePercent), 0) / stocks.length 
      : 0,
    totalMarketCap: stocks.reduce((sum, s) => sum + safeNumber(s.marketCap), 0),
  };

  // 表格列定义
  const columns = [
    {
      title: t.market.symbol,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      sorter: true,
      render: (symbol: string, record: StockData) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '-0.2px' }}>{symbol}</div>
          <div style={{ fontSize: '12px', color: "var(--app-text-muted)", fontWeight: 400, marginTop: '2px', lineHeight: 1.3 }}>
            {record.name || symbol}
          </div>
        </div>
      ),
    },
    {
      title: t.market.price,
      dataIndex: 'price',
      key: 'price',
      width: 105,
      sorter: true,
      render: (price: number | null) => {
        return (
          <div style={{ 
            fontWeight: '800', 
            fontSize: '17px', 
            fontFeatureSettings: '"tnum"',
            textAlign: 'center',
            lineHeight: '40px',
            color: "var(--app-text)",
            letterSpacing: '-0.2px'
          }}>
            {price !== null ? `$${safeToFixed(price, 2)}` : '--'}
          </div>
        );
      },
    },
    {
      title: t.market.priceHigh,
      dataIndex: 'dayHigh',
      key: 'dayHigh',
      width: 95,
      sorter: true,
      render: (dayHigh: number | null) => {
        // 只读取dayHigh字段，如果没有真实数据就显示--
        if (dayHigh === null || dayHigh === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: "var(--app-text-muted)", textAlign: 'center', lineHeight: '40px' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', textAlign: 'center', lineHeight: '40px' }}>${safeToFixed(dayHigh, 2)}</div>;
      },
    },
    {
      title: t.market.priceLow,
      dataIndex: 'dayLow',
      key: 'dayLow',
      width: 95,
      sorter: true,
      render: (dayLow: number | null) => {
        // 只读取dayLow字段，如果没有真实数据就显示--
        if (dayLow === null || dayLow === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: "var(--app-text-muted)", textAlign: 'center', lineHeight: '40px' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', textAlign: 'center', lineHeight: '40px' }}>${safeToFixed(dayLow, 2)}</div>;
      },
    },


    {
      title: t.market.change,
      dataIndex: 'change',
      key: 'change',
      width: 90,
      sorter: true,
      render: (change: number | null) => {
        if (change === null || change === undefined) {
          return (
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 700, 
              color: "var(--app-text-muted)",
              fontFeatureSettings: '"tnum"',
              textAlign: 'center',
              lineHeight: '40px'
            }}>
              --
            </div>
          );
        }
        
        const isPositive = change > 0;
        const isNegative = change < 0;
        
        return (
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 700, 
            color: isPositive ? '#52c41a' : isNegative ? '#ff4d4f' : '#666',
            fontFeatureSettings: '"tnum"',
            textAlign: 'center',
            lineHeight: '40px'
          }}>
            {change !== 0 ? `${change > 0 ? '+' : '-'}$${safeToFixed(Math.abs(change), 2)}` : '$0.00'}
          </div>
        );
      },
    },
    {
      title: t.market.changePercent,
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 90,
      sorter: true,
      render: (changePercent: number | null) => {
        if (changePercent === null || changePercent === undefined) {
          return (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: '40px'
            }}>
              <Tag 
                color="default"
                style={{ 
                  margin: 0,
                  fontSize: '12px',
                  padding: '4px 10px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  textAlign: 'center',
                  display: 'inline-block',
                  lineHeight: '16px',
                  minWidth: '65px',
                  border: 'none'
                }}
              >
                --
              </Tag>
            </div>
          );
        }
        
        const isPositive = changePercent > 0;
        const isNegative = changePercent < 0;
        
        return (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: '40px'
          }}>
            <Tag 
              color={isPositive ? 'green' : isNegative ? 'red' : 'default'}
              style={{ 
                margin: 0,
                fontSize: '12px',
                padding: '4px 10px',
                fontWeight: 700,
                borderRadius: '8px',
                textAlign: 'center',
                display: 'inline-block',
                lineHeight: '16px',
                minWidth: '65px',
                border: 'none'
              }}
            >
              {changePercent !== 0 ? `${changePercent > 0 ? '+' : '-'}${safeToFixed(Math.abs(changePercent), 2)}%` : '0.00%'}
            </Tag>
          </div>
        );
      },
    },
    {
      title: t.market.marketCap,
      dataIndex: 'marketCap',
      key: 'marketCap',
      width: 105,
      sorter: true,
      align: 'center' as const,
      className: 'market-cap-column',
      render: (marketCap: number | null) => {
        const formatted = formatMarketCap(marketCap);
        return <div style={{ fontSize: '13px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>{formatted}</div>;
      },
    },
    {
      title: t.market.volume,
      dataIndex: 'volume',
      key: 'volume',
      width: 100,
      sorter: true,
      render: (volume: number | null) => {
        if (volume === null || volume === undefined || volume === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: "var(--app-text-muted)", textAlign: 'center', lineHeight: '40px' }}>--</div>;
        const num = Number(volume);
        if (isNaN(num) || num === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: "var(--app-text-muted)", textAlign: 'center', lineHeight: '40px' }}>--</div>;
        if (num >= 1000000) return <div style={{ fontSize: '13px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${(num / 1000000).toFixed(1)}M</div>;
        if (num >= 1000) return <div style={{ fontSize: '13px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${(num / 1000).toFixed(1)}K</div>;
        return <div style={{ fontSize: '13px', fontWeight: 600, color: "var(--app-text)", fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${num.toFixed(0)}</div>;
      },
    },

    {
      title: t.market.sector,
      dataIndex: 'sector',
      key: 'sector',
      width: 95,
      sorter: true,
      render: (sector: string | null) => {
        // Alpaca可能不提供sector数据，安全处理
        const displaySector = sector ? translateSector(sector) : '--';
        return (
          <Tag 
            color="default" 
            style={{ 
              margin: 0,
              fontSize: '10px',
              padding: '2px 5px',
              fontWeight: 500,
              borderRadius: '6px',
              backgroundColor: '#f5f5f5',
              color: "var(--app-text)",
              border: '1px solid #e8e8e8',
              display: 'inline-block',
              lineHeight: '14px'
            }}
          >
            {displaySector}
          </Tag>
        );
      },
    },




    {
      title: t.market.actions,
      key: 'actions',
      width: 180,
      render: (_: any, record: StockData) => {
        const isInList = userSymbols.includes(record.symbol.toUpperCase());
        return (
          <Space size={2} style={{ justifyContent: 'center', width: '100%' }}>
            <Button
              type="primary"
              size="small"
              icon={<LineChartOutlined />}
              onClick={() => handleAnalyze(record.symbol)}
              style={{ fontSize: '14px', fontWeight: 500, padding: '0 12px', height: '32px', minWidth: '78px' }}
            >
              {t.market.analyze}
            </Button>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleBacktest(record.symbol)}
              style={{ fontSize: '14px', fontWeight: 500, padding: '0 12px', height: '32px', minWidth: '78px' }}
            >
              {t.market.backtest}
            </Button>
            {isInList ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeSymbolFromUserList(record.symbol)}
                style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
                title={t.market.removeFromList}
              />
            ) : (
              <Button
                size="small"
                type="default"
                icon={<PlusOutlined />}
                onClick={() => addSymbolToUserList(record.symbol)}
                disabled={userSymbols.length >= MAX_MARKET_SYMBOLS}
                style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
                title={userSymbols.length >= MAX_MARKET_SYMBOLS ? t.market.maxSymbolsReached.replace('{max}', String(MAX_MARKET_SYMBOLS)) : t.market.addToList}
              />
            )}
            <Button
              size="small"
              type={isInWatchlist(record.symbol) ? 'primary' : 'default'}
              icon={<StarOutlined />}
              onClick={() => toggleWatchlist(record.symbol)}
              style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
            />
          </Space>
        );
      },
    },
  ];

  // 处理表格排序
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order || 'ascend');
    }
  };

  // Market Cap列专用样式
  const marketPageStyles = `
    .market-page-shell {
      width: 100%;
      max-width: 1380px;
      margin: 0 auto;
      padding: clamp(16px, 1.8vw, 28px);
      animation: fadeIn 0.5s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .premium-card {
      border-radius: 16px !important;
      border: 1px solid var(--app-border-soft) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      background: var(--app-card-bg) !important;
      overflow: hidden;
    }
    
    .premium-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04) !important;
      transform: translateY(-1px) !important;
      border-color: rgba(24, 144, 255, 0.15) !important;
    }

    .market-header {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .market-title {
      font-size: clamp(22px, 2vw, 26px);
      font-weight: 800;
      color: var(--app-text-strong);
      margin: 0;
      letter-spacing: -0.02em;
    }
    
    .market-subtitle {
      font-size: 14px;
      color: var(--app-text-muted);
    }

    .count-badge {
      background: rgba(24, 144, 255, 0.06);
      color: #1890ff;
      padding: 1px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 10px;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .metric-card-content {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .metric-label {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--app-text-muted);
      font-weight: 700;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--app-text-strong);
      line-height: 1.1;
    }

    .metric-icon-bg {
      position: absolute;
      right: 16px;
      top: 18px;
      font-size: 22px;
      opacity: 0.1;
      color: #1890ff;
    }
    
    .toolbar-card {
      background: var(--app-card-bg);
      padding: 14px 18px;
      border-radius: 16px;
      border: 1px solid var(--app-border-soft);
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .toolbar-grid {
      display: grid;
      grid-template-columns: 1fr 220px auto;
      gap: 12px;
      align-items: center;
    }

    @media (max-width: 900px) {
      .toolbar-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .market-search-input {
      background: var(--app-input-bg) !important;
      border: 1px solid var(--app-border-soft) !important;
      border-radius: 10px !important;
      height: 40px !important;
      color: var(--app-text-strong) !important;
    }
    
    .sector-select .ant-select-selector {
      border-radius: 10px !important;
      height: 40px !important;
      border-color: var(--app-border-soft) !important;
      display: flex !important;
      align-items: center !important;
      background: var(--app-input-bg) !important;
      color: var(--app-text-strong) !important;
    }

    .market-table-container {
      background: var(--app-card-bg);
      border-radius: 16px;
      border: 1px solid var(--app-border-soft);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      overflow: hidden;
    }

    .market-table .ant-table-thead > tr > th {
      background: var(--app-table-header-bg) !important;
      color: var(--app-text-muted) !important;
      font-weight: 700 !important;
      font-size: 10.5px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      padding: 14px !important;
      border-bottom: 1px solid var(--app-border-soft) !important;
    }
    .market-table .ant-table-column-sorter {
      color: var(--app-text-muted) !important;
    }
    .market-table .ant-select-selection-item {
      color: var(--app-text-strong) !important;
    }
    
    .market-table .ant-table-tbody > tr > td {
      padding: 12px 14px !important;
      border-bottom: 1px solid var(--app-border-soft) !important;
    }
    
    .market-table .ant-table-tbody > tr:hover > td {
      background: var(--app-table-row-hover-bg, rgba(59, 130, 246, 0.08)) !important;
    }
    
    .symbol-tag {
      font-weight: 800;
      color: var(--app-text-strong);
      font-size: 15px;
    }
    
    .company-name {
      font-size: 11px;
      color: var(--app-text-muted);
      font-weight: 500;
    }
    
    .price-text {
      font-weight: 800;
      font-size: 15px;
      color: var(--app-text-strong);
    }
    
    .action-btn-compact {
      border-radius: 8px !important;
      font-weight: 700 !important;
      height: 32px !important;
      padding: 0 10px !important;
      font-size: 13px !important;
    }
    .action-btn-compact.ant-btn-default {
      background: transparent !important;
      border-color: var(--app-border) !important;
      color: var(--app-text) !important;
    }
    .action-btn-compact.ant-btn-default:hover {
      border-color: #3b82f6 !important;
      color: #3b82f6 !important;
    }
    
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 10px;
      background: var(--app-card-bg-soft);
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--app-border-soft);
    }
    
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      margin-right: 7px;
    }
  `;

  return (
    <div className="market-page-shell">
      <style>{marketPageStyles}</style>
      
      {/* Header Area */}
      <div className="market-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 2 }}>
            <div style={{ 
              width: 38, height: 38, borderRadius: '10px', background: 'linear-gradient(135deg, #1890ff 0%, #003a8c 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18,
              boxShadow: '0 4px 10px rgba(24, 144, 255, 0.2)'
            }}>
              <LineChartOutlined />
            </div>
            <h1 className="market-title">{t.market.title}</h1>
            <span className="count-badge">
              {userSymbols.length}/{MAX_MARKET_SYMBOLS}
            </span>
          </div>
          <div className="market-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span>{t.market.subtitle}</span>
            <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}>
              {tradeMode === 'paper' ? 'PAPER MODE' : 'REAL MODE'}
            </Tag>
            {stocks.length > 0 && (
              <Tag color="green" bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}>
                Data: {stocks[0]?.dataSource || 'Alpaca'}
              </Tag>
            )}
            {stocks.length > 0 && stocks[0]?.dataSource?.toLowerCase().includes('fallback') && (
              <Tag color="warning" bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}>
                MOCK DATA
              </Tag>
            )}
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "var(--app-text-muted)", fontWeight: 500 }}>
                Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stocks.length > 0 && (
            <div className="status-pill">
              <div className="status-dot"></div>
              {stocks[0]?.dataSource || 'Alpaca Markets'}
            </div>
          )}
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => initializeMarket()}
            loading={loading}
            style={{ borderRadius: '8px', height: 40, fontWeight: 700, padding: '0 20px', boxShadow: '0 2px 6px rgba(24, 144, 255, 0.15)' }}
          >
            {t.market.refreshData}
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="metrics-grid">
        <div className="premium-card">
          <div className="metric-card-content">
            <span className="metric-label">{t.market.totalStocks}</span>
            <span className="metric-value">{marketStats.totalStocks}</span>
            <EyeOutlined className="metric-icon-bg" style={{ color: '#3b82f6' }} />
          </div>
        </div>
        <div className="premium-card">
          <div className="metric-card-content">
            <span className="metric-label">{t.market.marketGainers}</span>
            <span className="metric-value" style={{ color: '#10b981' }}>{marketStats.gainers}</span>
            <BarChartOutlined className="metric-icon-bg" style={{ color: '#10b981' }} />
          </div>
        </div>
        <div className="premium-card">
          <div className="metric-card-content">
            <span className="metric-label">{t.market.marketLosers}</span>
            <span className="metric-value" style={{ color: '#ef4444' }}>{marketStats.losers}</span>
            <BarChartOutlined className="metric-icon-bg" style={{ color: '#ef4444' }} rotate={180} />
          </div>
        </div>
        <div className="premium-card">
          <div className="metric-card-content">
            <span className="metric-label">{t.market.avgChange}</span>
            <span className="metric-value" style={{ color: marketStats.avgChange >= 0 ? '#10b981' : '#ef4444' }}>
              {marketStats.avgChange >= 0 ? '+' : ''}{marketStats.avgChange.toFixed(2)}%
            </span>
            <LineChartOutlined className="metric-icon-bg" style={{ color: marketStats.avgChange >= 0 ? '#10b981' : '#ef4444' }} />
          </div>
        </div>
      </div>

      <div className="toolbar-card">
        <div className="toolbar-grid">
          <Input
            placeholder={t.market.searchPlaceholder}
            prefix={<SearchOutlined style={{ color: "var(--app-text-muted)" }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            className="market-search-input"
            allowClear
            suffix={searching ? <Spin size="small" /> : null}
          />
          <Select
            className="sector-select"
            placeholder={t.market.allSectors}
            value={selectedSector}
            onChange={setSelectedSector}
            dropdownStyle={{ borderRadius: '10px' }}
          >
            <Option value="all">{t.market.allSectors}</Option>
            {getAllSectors().map(sector => (
              <Option key={sector} value={sector}>{translateSector(sector)}</Option>
            ))}
          </Select>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleSearch}
            loading={searching}
            style={{ height: 40, borderRadius: '10px', fontWeight: 700, padding: '0 24px' }}
          >
            {t.market.search}
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Alert
            message={<Text strong style={{ fontSize: 13 }}>{t.market.dataSyncError}</Text>}
            description={error}
            type="error"
            showIcon
            style={{ borderRadius: 12 }}
            action={<Button size="small" type="primary" onClick={() => initializeMarket()} style={{ borderRadius: 6 }}>{t.market.retry}</Button>}
          />
        </div>
      )}

      <div className="market-table-container">
        {loading ? (
          <div style={{ padding: '40px 30px' }}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        ) : filteredStocks.length === 0 && stocks.length > 0 ? (
          <div style={{ padding: '80px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)", marginBottom: 4 }}>
                    No matching symbols for "{searchText || selectedSector}"
                  </div>
                  <div style={{ fontSize: 12, color: "var(--app-text-muted)" }}>
                    Try adjusting your search or filters, or add a new symbol to analyze.
                  </div>
                </div>
              }
            >
              <Space>
                <Button type="link" onClick={() => { setSearchText(''); setSelectedSector('all'); }}>
                  Clear Filters
                </Button>
                {searchText.trim() && (
                  <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => searchStockBySymbol(searchText.trim())}>
                    Search & Add "{searchText.trim().toUpperCase()}"
                  </Button>
                )}
              </Space>
            </Empty>
          </div>
        ) : filteredStocks.length === 0 && stocks.length === 0 ? (
          <div style={{ padding: '80px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: "var(--app-text-muted)", fontSize: '14px', fontWeight: 500 }}>{t.market.noResults}</span>}
            >
              <Button type="link" onClick={() => { setSearchText(''); setSelectedSector('all'); initializeMarket(); }}>
                Clear Filters
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            className="market-table"
            columns={columns.map(col => {
              if (col.key === 'symbol') {
                return {
                  ...col,
                  width: 170,
                  render: (symbol: string, record: StockData) => (
                    <Space size={12}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--app-card-bg-soft)', border: "1px solid var(--app-border-soft)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: "var(--app-text-strong)", fontSize: 14 }}>
                        {symbol[0]}
                      </div>
                      <Space direction="vertical" size={0}>
                        <span className="symbol-tag">{symbol}</span>
                        <span className="company-name">{record.name || symbol}</span>
                      </Space>
                    </Space>
                  )
                };
              }
              if (col.key === 'price') {
                return {
                  ...col,
                  width: 110,
                  render: (price: number | null) => (
                    <span className="price-text">
                      {price !== null ? `$${safeToFixed(price, 2)}` : '--'}
                    </span>
                  )
                };
              }
              if (col.key === 'changePercent') {
                return {
                  ...col,
                  width: 110,
                  render: (val: number | null) => {
                    if (val === null) return '--';
                    const isUp = val > 0;
                    const isDown = val < 0;
                    return (
                      <div style={{ 
                        background: isUp ? 'rgba(16, 185, 129, 0.08)' : isDown ? 'rgba(239, 68, 68, 0.08)' : '#f1f5f9',
                        color: isUp ? '#10b981' : isDown ? '#ef4444' : '#64748b',
                        padding: '3px 8px', 
                        borderRadius: 6, 
                        fontSize: 12.5, 
                        fontWeight: 800, 
                        display: 'inline-block',
                        minWidth: '68px',
                        textAlign: 'center'
                      }}>
                        {val > 0 ? '+' : ''}{safeToFixed(val, 2)}%
                      </div>
                    );
                  }
                };
              }
              if (col.key === 'sector') {
                return {
                  ...col,
                  render: (sector: string) => (
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, padding: '1px 8px', border: "1px solid var(--app-blue-border, transparent)", background: "var(--app-blue-bg, #eff6ff)", color: "var(--app-blue-text, #3b82f6)", fontSize: 11 }}>
                      {translateSector(sector) || 'N/A'}
                    </Tag>
                  )
                };
              }
              if (col.key === 'actions') {
                return {
                  ...col,
                  width: 190,
                  render: (_: any, record: StockData) => (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Button
                        type="primary"
                        size="small"
                        className="action-btn-compact"
                        icon={<LineChartOutlined />}
                        onClick={() => handleAnalyze(record.symbol)}
                        style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                      >
                        {t.market.analyze}
                      </Button>
                      <Button
                        size="small"
                        className="action-btn-compact"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleBacktest(record.symbol)}
                      >
                        {t.market.backtest}
                      </Button>
                      <Button
                        size="small"
                        type={isInWatchlist(record.symbol) ? 'primary' : 'default'}
                        icon={isInWatchlist(record.symbol) ? <StarOutlined style={{ color: '#fff' }} /> : <StarOutlined />}
                        onClick={() => toggleWatchlist(record.symbol)}
                        className="action-btn-compact"
                        style={isInWatchlist(record.symbol) ? { background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' } : {}}
                      />
                    </div>
                  )
                };
              }
              return col;
            })}
            dataSource={filteredStocks}
            rowKey="symbol"
            size="middle"
            onChange={handleTableChange}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total, range) => (
                <span style={{ color: "var(--app-text-muted)", fontSize: '12.5px', fontWeight: 500 }}>
                  {range[0]}-{range[1]} {t.market.of} {total}
                </span>
              ),
              position: ['bottomRight']
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        {lastUpdated && (
          <div style={{ fontSize: '11px', color: "var(--app-text-muted)", fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <ClockCircleOutlined style={{ marginRight: 5 }} />
            {t.market.lastSynchronized}: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Market;
