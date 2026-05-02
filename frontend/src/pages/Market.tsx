import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, Button, Row, Col, Statistic, Space, Alert, message, Empty, Spin, Skeleton } from 'antd';
import { SearchOutlined, LineChartOutlined, PlayCircleOutlined, BarChartOutlined, ReloadOutlined, EyeOutlined, StarOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import marketDataService, { StockData, searchStockData, safeNumber, safeToFixed, getUserMarketSymbols, addUserMarketSymbols, deleteUserMarketSymbol } from '../services/marketDataService';
import { sharedDataService } from '../services/sharedDataService';
import { formatMarketCap } from '../utils/format';

const MAX_MARKET_SYMBOLS = 100;

const { Option } = Select;

const Market: React.FC = () => {
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

  // 格式化成交量函数
  const _formatVolume = (volume: number | null): string => {
    if (volume === null || volume === undefined || volume === 0) return '--';
    
    const num = Number(volume);
    if (isNaN(num)) return '--';
    
    // 十亿 (Billion) - 10亿 = 1e9
    if (num >= 1e9) {
      const billions = num / 1e9;
      return `${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
    }
    
    // 百万 (Million) - 1百万 = 1e6
    if (num >= 1e6) {
      const millions = num / 1e6;
      return `${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
    }
    
    // 千 (Thousand) - 1千 = 1e3
    if (num >= 1e3) {
      const thousands = num / 1e3;
      return `${thousands.toFixed(thousands >= 100 ? 0 : thousands >= 10 ? 1 : 2)}K`;
    }
    
    return num.toFixed(0);
  };

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

  // 过滤和排序股票（不依赖searchText，搜索只在点击按钮/Enter时触发API调用）
  useEffect(() => {
    filterAndSortStocks();
  }, [stocks, selectedSector, sortField, sortOrder]);

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
          setError('没有获取到有效的股票数据');
          message.warning('没有获取到有效的股票数据');
        } else {
          setStocks(validStocks);
          setLastUpdated(new Date());
          setLastFetched(Date.now());
          message.success(`已加载 ${validStocks.length} 只股票数据 (来源: ${stockData[0]?.dataSource || 'Alpaca'})`);
        }
      } else {
        setError('服务器返回的数据格式不正确');
        message.error('数据格式错误');
      }
    } catch (err: any) {
      console.error('[Market优化] 获取市场数据失败:', err);
      const errorMessage = err.message || '未知错误';
      setError(`获取市场数据失败: ${errorMessage}`);
      message.error('获取市场数据失败');
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
      message.info(`${qUpper} is already in the list`);
      return true;
    }

    try {
      setSearching(true);
      console.log(`[Market] Searching: "${q}"`);

      // Use the new search endpoint — backend handles symbol detection + company name search
      const { stocks: results, status, message: msg } = await searchStockData(q);

      if (status === 'not_found' || results.length === 0) {
        message.warning(msg || 'No matching company or symbol found. Please check your input.');
        return false;
      }

      // Filter out duplicates already in the list
      const existingSymbols = new Set(stocks.map(s => s.symbol.toUpperCase()));
      const newStocks = results.filter(s => !existingSymbols.has(s.symbol.toUpperCase()));

      if (newStocks.length === 0) {
        message.info(`${results.map(s => s.symbol).join(', ')} already in the list`);
        return true;
      }

      // Add new stocks to the list
      setStocks(prev => [...prev, ...newStocks]);
      const addedNames = newStocks.map(s => s.symbol).join(', ');
      message.success(`Added ${addedNames} (source: ${newStocks[0]?.dataSource || 'Alpaca'})`);
      return true;
    } catch (error: any) {
      console.error(`[Market] Search failed for "${q}":`, error);
      const errorCode = error.code || '';
      if (errorCode === 'AUTH_REQUIRED') {
        message.error('Authentication required. Please sign in again.');
      } else if (errorCode === 'CONFIG_REQUIRED') {
        message.error('API keys not configured. Please configure in Settings.');
      } else {
        message.error(`Search failed: ${error.message || 'Unknown error'}`);
      }
      return false;
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    const q = searchText.trim();
    if (q) {
      await searchStockBySymbol(q);
      setSearchText(''); // Clear search input after search
    }
  };

  const addSymbolToUserList = async (symbol: string) => {
    if (addingSymbol) return;

    // Check limit
    if (userSymbols.length >= MAX_MARKET_SYMBOLS) {
      message.warning(`Maximum of ${MAX_MARKET_SYMBOLS} symbols reached. Please remove some before adding more.`);
      return;
    }

    // Check if already in user list
    if (userSymbols.includes(symbol.toUpperCase())) {
      message.info(`${symbol} is already in your list`);
      return;
    }

    try {
      setAddingSymbol(true);
      const result = await addUserMarketSymbols([symbol]);

      if (result.status === 'limit_reached') {
        message.warning(result.error || `Maximum of ${MAX_MARKET_SYMBOLS} symbols reached.`);
        return;
      }

      if (result.status === 'ok') {
        setUserSymbols(result.symbols);
        message.success(`Added ${symbol} to your list`);

        // If the stock data is not in the current list, fetch it
        if (!stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase())) {
          const stockData = await marketDataService.getStocks([symbol]);
          if (stockData.length > 0) {
            setStocks(prev => [...prev, ...stockData]);
          }
        }
      } else {
        message.error(`Failed to add ${symbol}: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      message.error(`Failed to add ${symbol}: ${err.message}`);
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
        message.success(`Removed ${symbol} from your list`);
      } else {
        message.error(`Failed to remove ${symbol}`);
      }
    } catch (err: any) {
      message.error(`Failed to remove ${symbol}: ${err.message}`);
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
        message.success(`Removed ${symbol} from watchlist`);
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
          message.success(`Added ${symbol} to watchlist`);
          newWatchlist = [...prev, watchlistItem];
        } else {
          // 如果没有找到完整信息，至少保存symbol
          message.warning(`Added ${symbol} to watchlist (limited info available)`);
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
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      sorter: true,
      render: (symbol: string, record: StockData) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '-0.2px' }}>{symbol}</div>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: 400, marginTop: '2px', lineHeight: 1.3 }}>
            {record.name || symbol}
          </div>
        </div>
      ),
    },
    {
      title: 'Price',
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
            color: '#1f1f1f',
            letterSpacing: '-0.2px'
          }}>
            {price !== null ? `$${safeToFixed(price, 2)}` : '--'}
          </div>
        );
      },
    },
    {
      title: 'Price High',
      dataIndex: 'dayHigh',
      key: 'dayHigh',
      width: 95,
      sorter: true,
      render: (dayHigh: number | null) => {
        // 只读取dayHigh字段，如果没有真实数据就显示--
        if (dayHigh === null || dayHigh === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#bfbfbf', textAlign: 'center', lineHeight: '40px' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', textAlign: 'center', lineHeight: '40px' }}>${safeToFixed(dayHigh, 2)}</div>;
      },
    },
    {
      title: 'Price Low',
      dataIndex: 'dayLow',
      key: 'dayLow',
      width: 95,
      sorter: true,
      render: (dayLow: number | null) => {
        // 只读取dayLow字段，如果没有真实数据就显示--
        if (dayLow === null || dayLow === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#bfbfbf', textAlign: 'center', lineHeight: '40px' }}>--</div>;
        return <div style={{ fontSize: '14px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', textAlign: 'center', lineHeight: '40px' }}>${safeToFixed(dayLow, 2)}</div>;
      },
    },


    {
      title: 'Change',
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
              color: '#666',
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
      title: 'Change %',
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
      title: 'Market Cap',
      dataIndex: 'marketCap',
      key: 'marketCap',
      width: 105,
      sorter: true,
      align: 'center' as const,
      className: 'market-cap-column',
      render: (marketCap: number | null) => {
        const formatted = formatMarketCap(marketCap);
        return <div style={{ fontSize: '13px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>{formatted}</div>;
      },
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      width: 100,
      sorter: true,
      render: (volume: number | null) => {
        if (volume === null || volume === undefined || volume === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#bfbfbf', textAlign: 'center', lineHeight: '40px' }}>--</div>;
        const num = Number(volume);
        if (isNaN(num) || num === 0) return <div style={{ fontSize: '13px', fontWeight: 500, color: '#bfbfbf', textAlign: 'center', lineHeight: '40px' }}>--</div>;
        if (num >= 1000000) return <div style={{ fontSize: '13px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${(num / 1000000).toFixed(1)}M</div>;
        if (num >= 1000) return <div style={{ fontSize: '13px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${(num / 1000).toFixed(1)}K</div>;
        return <div style={{ fontSize: '13px', fontWeight: 600, color: '#595959', fontFeatureSettings: '"tnum"', lineHeight: '40px', textAlign: 'center' }}>${num.toFixed(0)}</div>;
      },
    },

    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      width: 95,
      sorter: true,
      render: (sector: string | null) => {
        // Alpaca可能不提供sector数据，安全处理
        const displaySector = sector || '--';
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
              color: '#595959',
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
      title: 'Actions',
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
              Analyze
            </Button>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleBacktest(record.symbol)}
              style={{ fontSize: '14px', fontWeight: 500, padding: '0 12px', height: '32px', minWidth: '78px' }}
            >
              Backtest
            </Button>
            {isInList ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeSymbolFromUserList(record.symbol)}
                style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
                title="Remove from list"
              />
            ) : (
              <Button
                size="small"
                type="default"
                icon={<PlusOutlined />}
                onClick={() => addSymbolToUserList(record.symbol)}
                disabled={userSymbols.length >= MAX_MARKET_SYMBOLS}
                style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}
                title={userSymbols.length >= MAX_MARKET_SYMBOLS ? `Max ${MAX_MARKET_SYMBOLS} symbols reached` : 'Add to list'}
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
    .market-container {
      padding: 24px;
      background-color: #f8fafc;
      min-height: calc(100vh - 112px);
    }
    
    .market-card {
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    
    .market-header {
      margin-bottom: 24px;
    }
    
    .market-title {
      font-size: 24px;
      font-weight: 800;
      color: #1a202c;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    
    .market-subtitle {
      font-size: 14px;
      color: #718096;
      font-weight: 500;
    }
    
    .metric-card {
      transition: all 0.2s ease-in-out;
      border: 1px solid #edf2f7;
      border-radius: 10px;
    }
    
    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border-color: #e2e8f0;
    }
    
    .search-toolbar {
      background: #ffffff;
      padding: 16px 32px;
      border-radius: 10px;
      border: 1px solid #edf2f7;
      margin-bottom: 20px;
    }
    
    .market-table .ant-table-thead > tr > th {
      background: #f8fafc;
      color: #4a5568;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 16px;
      border-bottom: 2px solid #edf2f7;
    }
    
    .market-table .ant-table-thead > tr > th:first-child {
      padding-left: 40px !important;
    }
    
    .market-table .ant-table-tbody > tr > td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .market-table .ant-table-tbody > tr > td:first-child {
      padding-left: 40px !important;
    }
    
    .market-table .ant-table-tbody > tr:hover > td {
      background: #f1f5f9 !important;
    }
    
    .symbol-tag {
      font-family: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #2d3748;
      font-size: 15px;
    }
    
    .company-name {
      font-size: 12px;
      color: #718096;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }
    
    .price-text {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 16px;
      font-feature-settings: "tnum";
    }
    
    .action-btn {
      border-radius: 6px;
      font-weight: 600;
      transition: all 0.2s;
    }
    
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 20px;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
    }
    
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      margin-right: 6px;
    }
  `;

  return (
    <div className="market-container">
      <style>{marketPageStyles}</style>
      
      {/* Header Area */}
      <div className="market-header">
        <Row justify="space-between" align="bottom">
          <Col>
            <div className="market-title">Market Overview</div>
            <div className="market-subtitle">
              Real-time equity universe and intelligent action center
              <span style={{ marginLeft: '16px', fontSize: '12px', color: '#a0aec0' }}>
                ({userSymbols.length}/{MAX_MARKET_SYMBOLS} symbols)
              </span>
            </div>
          </Col>
          <Col>
            <Space size={12}>
              <Button
                className="action-btn"
                icon={<ReloadOutlined spin={loading} />}
                onClick={() => initializeMarket()}
                loading={loading}
              >
                Refresh Data
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Summary Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="metric-card" bodyStyle={{ padding: '20px' }}>
            <Statistic 
              title={<span style={{ color: '#718096', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Total Stocks</span>}
              value={marketStats.totalStocks}
              valueStyle={{ fontWeight: 800, fontSize: '28px', color: '#1a202c' }}
              prefix={<EyeOutlined style={{ color: '#3182ce', marginRight: '8px', fontSize: '20px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="metric-card" bodyStyle={{ padding: '20px' }}>
            <Statistic 
              title={<span style={{ color: '#718096', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Market Gainers</span>}
              value={marketStats.gainers}
              valueStyle={{ fontWeight: 800, fontSize: '28px', color: '#38a169' }}
              prefix={<BarChartOutlined style={{ color: '#38a169', marginRight: '8px', fontSize: '20px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="metric-card" bodyStyle={{ padding: '20px' }}>
            <Statistic 
              title={<span style={{ color: '#718096', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Market Losers</span>}
              value={marketStats.losers}
              valueStyle={{ fontWeight: 800, fontSize: '28px', color: '#e53e3e' }}
              prefix={<BarChartOutlined style={{ color: '#e53e3e', marginRight: '8px', fontSize: '20px' }} rotate={180} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="metric-card" bodyStyle={{ padding: '20px' }}>
            <Statistic 
              title={<span style={{ color: '#718096', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Avg Change</span>}
              value={marketStats.avgChange}
              precision={2}
              suffix="%"
              valueStyle={{ 
                fontWeight: 800, 
                fontSize: '28px', 
                color: marketStats.avgChange >= 0 ? '#38a169' : '#e53e3e' 
              }}
              prefix={<LineChartOutlined style={{ 
                color: marketStats.avgChange >= 0 ? '#38a169' : '#e53e3e', 
                marginRight: '8px', 
                fontSize: '20px' 
              }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="market-card" bodyStyle={{ padding: 0 }}>
        {/* Toolbar */}
        <div className="search-toolbar" style={{ border: 'none', borderRadius: 0, borderBottom: '1px solid #edf2f7' }}>
          <Row gutter={16}>
            <Col flex="auto">
              <Input
                placeholder="Search by symbol or company name..."
                prefix={<SearchOutlined style={{ color: '#a0aec0' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                style={{ borderRadius: '8px', height: '40px' }}
                suffix={searching ? <Spin size="small" /> : null}
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="Filter by sector"
                value={selectedSector}
                onChange={setSelectedSector}
                size="large"
                dropdownStyle={{ borderRadius: '8px' }}
              >
                <Option value="all">All Sectors</Option>
                {getAllSectors().map(sector => (
                  <Option key={sector} value={sector}>{sector}</Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
                loading={searching}
                className="action-btn"
                style={{ height: '40px', padding: '0 24px' }}
              >
                Search
              </Button>
            </Col>
          </Row>
        </div>

        {error && (
          <div style={{ padding: '16px' }}>
            <Alert
              message="Data Sync Error"
              description={error}
              type="error"
              showIcon
              action={<Button size="small" type="default" onClick={() => initializeMarket()}>Retry</Button>}
            />
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px' }}>
            <Skeleton active paragraph={{ rows: 12 }} />
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{ padding: '80px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#a0aec0' }}>No instruments found matching your filters</span>}
            />
          </div>
        ) : (
          <Table
            className="market-table"
            columns={columns.map(col => {
              if (col.key === 'symbol') {
                return {
                  ...col,
                  render: (symbol: string, record: StockData) => (
                    <Space direction="vertical" size={0}>
                      <span className="symbol-tag">{symbol}</span>
                      <span className="company-name">{record.name || symbol}</span>
                    </Space>
                  )
                };
              }
              if (col.key === 'price') {
                return {
                  ...col,
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
                  render: (val: number | null) => {
                    if (val === null) return '--';
                    return (
                      <Tag color={val > 0 ? 'green' : val < 0 ? 'red' : 'default'} style={{ 
                        borderRadius: '6px', 
                        fontWeight: 700, 
                        border: 'none',
                        padding: '4px 8px',
                        fontSize: '13px',
                        minWidth: '65px',
                        textAlign: 'center'
                      }}>
                        {val > 0 ? '+' : ''}{safeToFixed(val, 2)}%
                      </Tag>
                    );
                  }
                };
              }
              if (col.key === 'actions') {
                return {
                  ...col,
                  render: (_: any, record: StockData) => (
                    <Space size={8}>
                      <Button
                        type="primary"
                        size="small"
                        className="action-btn"
                        icon={<LineChartOutlined />}
                        onClick={() => handleAnalyze(record.symbol)}
                        style={{ background: '#3182ce', borderColor: '#3182ce' }}
                      >
                        Analyze
                      </Button>
                      <Button
                        size="small"
                        className="action-btn"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleBacktest(record.symbol)}
                      >
                        Backtest
                      </Button>
                      <Button
                        size="small"
                        type={isInWatchlist(record.symbol) ? 'primary' : 'default'}
                        icon={isInWatchlist(record.symbol) ? <StarOutlined style={{ color: '#fff' }} /> : <StarOutlined />}
                        onClick={() => toggleWatchlist(record.symbol)}
                        className="action-btn"
                        style={isInWatchlist(record.symbol) ? { background: '#ecc94b', borderColor: '#ecc94b' } : {}}
                      />
                    </Space>
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
                <span style={{ color: '#718096', fontSize: '13px' }}>
                  Showing {range[0]}-{range[1]} of {total} assets
                </span>
              ),
              position: ['bottomRight']
            }}
            scroll={{ x: 'max-content' }}
          />
        )}

        {/* Footer Info */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid #edf2f7', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div className="status-pill">
            <div className="status-dot"></div>
            Data Source: <span style={{ marginLeft: '4px', color: '#2d3748' }}>{stocks[0]?.dataSource || 'Alpaca Markets'}</span>
          </div>
          
          {lastUpdated && (
            <div style={{ fontSize: '12px', color: '#718096', fontWeight: 500 }}>
              Last synchronized: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Market;
