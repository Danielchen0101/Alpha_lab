import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Input, Space, Empty, Tag, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';

import marketDataService from '../services/marketDataService';
import { formatMarketCap } from '../utils/format';

const STORAGE_KEY = "quant_watchlist_symbols";

// 显示用的数据接口，从真实数据源获取
type WatchlistDisplayItem = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number;
  marketCap: number | null;
  sector: string | null;
  dayHigh: number | null;
  dayLow: number | null;
  signal?: string | null;
  addedAt?: string;
};

const Watchlist: React.FC = () => {
  const navigate = useNavigate();
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]); // 只存储symbol
  const [watchlistData, setWatchlistData] = useState<WatchlistDisplayItem[]>([]); // 显示用的真实数据
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sortedInfo, setSortedInfo] = useState<any>({});
  const hasLoaded = React.useRef(false);

  // 安全的格式化函数
  const safeToFixed = (value: any, decimals: number = 2): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '0.00';
  };

  // 生成稳定的监控signal信号
  const getSignal = (item: WatchlistDisplayItem): string => {
    const changePercent = item.changePercent || 0;
    const price = item.price || 0;
    const dayHigh = item.dayHigh || 0;
    const dayLow = item.dayLow || 0;
    
    // 检查数据是否有效
    if (!price || price <= 0 || !dayHigh || !dayLow || dayHigh <= 0 || dayLow <= 0) {
      return 'Data unavailable';
    }
    
    // 1. Bullish - 强势上涨（需要显著上涨）
    if (changePercent > 7) return 'Bullish';
    
    // 2. Bearish - 强势下跌（需要显著下跌）
    if (changePercent < -7) return 'Bearish';
    
    // 3. Oversold - 超卖信号（大幅下跌且接近日内低点）
    if (changePercent < -5 && (price - dayLow) / price < 0.015) {
      return 'Oversold';
    }
    
    // 4. Near support - 接近支撑位（接近日内低点，但变化不大）
    if (Math.abs(changePercent) < 3 && (price - dayLow) / price < 0.01) {
      return 'Near support';
    }
    
    // 5. Near resistance - 接近阻力位（接近日内高点）
    if (Math.abs(changePercent) < 3 && (dayHigh - price) / price < 0.01) {
      return 'Near resistance';
    }
    
    // 6. 如果价格变化很小，返回"No clear setup"
    if (Math.abs(changePercent) < 2) {
      return 'No clear setup';
    }
    
    // 7. 中等上涨
    if (changePercent > 2) {
      return 'Mild bullish';
    }
    
    // 8. 中等下跌
    if (changePercent < -2) {
      return 'Mild bearish';
    }
    
    // 默认返回"No clear setup"
    return 'No clear setup';
  };

  // Load watchlist from localStorage on component mount and listen for changes
  useEffect(() => {
    // Prevent double loading in React Strict Mode
    if (hasLoaded.current) {
      return;
    }
    
    const loadWatchlist = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setWatchlistSymbols(parsed);
          } else {
            setWatchlistSymbols([]);
          }
        } catch (err) {
          console.error('Failed to parse watchlist from localStorage:', err);
          setWatchlistSymbols([]);
        }
      } else {
        setWatchlistSymbols([]);
      }
    };
    
    // Initial load
    loadWatchlist();
    
    // Listen for storage events (changes from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadWatchlist();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    hasLoaded.current = true;
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 更新watchlist中的股票数据
  const updateWatchlistData = async (symbolsArg?: string[]) => {
    const symbols = symbolsArg ?? watchlistSymbols;
    
    if (symbols.length === 0) {
      setWatchlistData([]);
      return;
    }
    
    if (updating) return;
    
    try {
      setUpdating(true);
      
      // 获取最新市场数据
      const stocks = await marketDataService.getStocks(symbols);
      
      // 将真实数据映射到显示数据结构
      const mapped: WatchlistDisplayItem[] = symbols.map(symbol => {
        const stock = stocks.find(s => s.symbol === symbol);
        
        return {
          symbol,
          name: stock?.name ?? null,
          price: stock?.price ?? null,
          change: stock?.change ?? null,
          changePercent: stock?.changePercent ?? null,
          volume: stock?.volume ?? 0,
          marketCap: stock?.marketCap ?? null,
          sector: stock?.sector ?? null,
          dayHigh: stock?.dayHigh ?? null,
          dayLow: stock?.dayLow ?? null,
          signal: null,
        };
      });
      
      setWatchlistData(mapped);
    } catch (error) {
      console.error('Failed to update watchlist data:', error);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    // 初始加载时更新一次
    if (watchlistSymbols.length > 0) {
      updateWatchlistData();
    } else {
      setWatchlistData([]);
    }

    // 每60秒更新一次数据（减少刷新频率，避免数字频繁跳动）
    const intervalId = setInterval(() => updateWatchlistData(), 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [watchlistSymbols]);

  // Save watchlist symbols to localStorage whenever it changes
  useEffect(() => {
    // Don't save on initial mount (empty array)
    if (watchlistSymbols.length === 0 && !hasLoaded.current) {
      return;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlistSymbols));
  }, [watchlistSymbols]);

  // 解析输入到真实symbol - 全新实现
  const resolveWatchlistSymbol = async (input: string): Promise<string | null> => {
    // 1. 统一清洗输入
    const rawInput = input.trim();
    if (!rawInput) {
      console.log('[解析] 空输入');
      return null;
    }
    
    const normalizedInput = rawInput.replace(/^["']|["']$/g, '').trim();
    if (!normalizedInput) {
      console.log('[解析] 清洗后为空');
      return null;
    }
    
    const upperInput = normalizedInput.toUpperCase();
    const lowerInput = normalizedInput.toLowerCase();
    
    console.log(`[解析开始] 输入: "${rawInput}" → 清洗: "${normalizedInput}" → 大写: "${upperInput}" → 小写: "${lowerInput}"`);
    
    try {
      // 2. 判断是否像symbol (1-5个字母)
      const looksLikeSymbol = /^[A-Za-z]{1,5}$/.test(normalizedInput);
      console.log(`[解析] 是否像symbol: ${looksLikeSymbol}`);
      
      // ========== 路径A: 优先按symbol解析 ==========
      if (looksLikeSymbol) {
        console.log(`[路径A] 尝试按symbol解析: "${upperInput}"`);
        
        // A1. 尝试精确查询symbol
        try {
          console.log(`[路径A1] 精确查询: ${upperInput}`);
          const stockData = await marketDataService.getStockData(upperInput);
          if (stockData && !stockData.error) {
            console.log(`[路径A1] 成功: ${stockData.symbol}`);
            return stockData.symbol.toUpperCase(); // 确保大写
          }
          console.log(`[路径A1] 失败: ${upperInput} 不是有效symbol`);
        } catch (error) {
          console.log(`[路径A1] 查询异常:`, error);
        }
        
        // A2. 从当前股票列表中匹配exact symbol
        try {
          console.log(`[路径A2] 从当前列表匹配exact symbol`);
          const currentStocks = await marketDataService.getStocks([]);
          const exactSymbolMatch = currentStocks.find(stock => 
            stock.symbol.toUpperCase() === upperInput
          );
          if (exactSymbolMatch) {
            console.log(`[路径A2] 成功: ${exactSymbolMatch.symbol}`);
            return exactSymbolMatch.symbol.toUpperCase();
          }
          console.log(`[路径A2] 失败: 当前列表中没有 ${upperInput}`);
        } catch (error) {
          console.log(`[路径A2] 查询异常:`, error);
        }
        
        // A3. symbol路径失败，继续尝试公司名路径
        console.log(`[路径A] symbol路径失败，继续尝试公司名路径`);
      }
      
      // ========== 路径B: 按公司名解析 ==========
      console.log(`[路径B] 尝试按公司名解析: "${normalizedInput}"`);
      
      // B1. 从当前股票列表中匹配公司名
      try {
        console.log(`[路径B1] 从当前列表匹配公司名`);
        const currentStocks = await marketDataService.getStocks([]);
        
        // 按优先级匹配
        let matchedStock = null;
        
        // 1. 精确名称匹配
        matchedStock = currentStocks.find(stock => 
          stock.name?.toLowerCase() === lowerInput
        );
        if (matchedStock) {
          console.log(`[路径B1] 精确名称匹配: ${matchedStock.symbol} (${matchedStock.name})`);
          return matchedStock.symbol.toUpperCase();
        }
        
        // 2. 开头匹配
        matchedStock = currentStocks.find(stock => 
          stock.name?.toLowerCase().startsWith(lowerInput)
        );
        if (matchedStock) {
          console.log(`[路径B1] 开头匹配: ${matchedStock.symbol} (${matchedStock.name})`);
          return matchedStock.symbol.toUpperCase();
        }
        
        // 3. 包含匹配
        matchedStock = currentStocks.find(stock => 
          stock.name?.toLowerCase().includes(lowerInput)
        );
        if (matchedStock) {
          console.log(`[路径B1] 包含匹配: ${matchedStock.symbol} (${matchedStock.name})`);
          return matchedStock.symbol.toUpperCase();
        }
        
        console.log(`[路径B1] 失败: 当前列表中没有匹配 "${normalizedInput}" 的公司名`);
      } catch (error) {
        console.log(`[路径B1] 查询异常:`, error);
      }
      
      // B2. 使用搜索接口
      try {
        console.log(`[路径B2] 使用搜索接口: "${normalizedInput}"`);
        const searchResults = await marketDataService.searchStocks(normalizedInput, 10);
        
        if (searchResults && searchResults.length > 0) {
          console.log(`[路径B2] 搜索返回 ${searchResults.length} 个结果`);
          
          let matchedResult = null;
          
          // 1. 精确名称匹配
          matchedResult = searchResults.find(result => 
            result.name?.toLowerCase() === lowerInput
          );
          if (matchedResult) {
            console.log(`[路径B2] 精确名称匹配: ${matchedResult.symbol} (${matchedResult.name})`);
            return matchedResult.symbol.toUpperCase();
          }
          
          // 2. 开头匹配
          matchedResult = searchResults.find(result => 
            result.name?.toLowerCase().startsWith(lowerInput)
          );
          if (matchedResult) {
            console.log(`[路径B2] 开头匹配: ${matchedResult.symbol} (${matchedResult.name})`);
            return matchedResult.symbol.toUpperCase();
          }
          
          // 3. 包含匹配
          matchedResult = searchResults.find(result => 
            result.name?.toLowerCase().includes(lowerInput)
          );
          if (matchedResult) {
            console.log(`[路径B2] 包含匹配: ${matchedResult.symbol} (${matchedResult.name})`);
            return matchedResult.symbol.toUpperCase();
          }
          
          // 4. 返回第一个合理结果
          console.log(`[路径B2] 返回第一个结果: ${searchResults[0].symbol} (${searchResults[0].name})`);
          return searchResults[0].symbol.toUpperCase();
        }
        
        console.log(`[路径B2] 失败: 搜索接口返回空结果`);
      } catch (error) {
        console.log(`[路径B2] 查询异常:`, error);
      }
      
      // 3. 所有路径都失败
      console.log(`[解析失败] 所有路径都失败: "${normalizedInput}"`);
      return null;
      
    } catch (error) {
      console.error('[解析异常] Failed to resolve symbol:', error);
      return null;
    }
  };

  const handleAddSymbol = async () => {
    const rawInput = newSymbol.trim();
    
    if (!rawInput) {
      message.warning('Please enter a stock symbol or company name');
      return;
    }

    try {
      setLoading(true);
      
      // 使用新的解析函数
      console.log(`[添加] 开始解析: "${rawInput}"`);
      const resolvedSymbol = await resolveWatchlistSymbol(rawInput);
      console.log(`[添加] 解析结果: "${resolvedSymbol}" (输入: "${rawInput}")`);
      
      if (!resolvedSymbol) {
        message.error(`No matching stock found for "${rawInput}"`);
        return;
      }

      // 基于解析后的真实symbol检查重复
      if (watchlistSymbols.includes(resolvedSymbol)) {
        message.warning(`${resolvedSymbol} is already in your watchlist`);
        setNewSymbol('');
        return;
      }

      // 立即更新symbol列表 - 只存储真实symbol
      const nextSymbols = [...watchlistSymbols, resolvedSymbol];
      setWatchlistSymbols(nextSymbols);
      
      // 立即获取并显示数据
      await updateWatchlistData(nextSymbols);
      
      // 显示成功消息 - 只显示真实symbol
      message.success(`Added ${resolvedSymbol} to watchlist`);
    } catch (error) {
      console.error(`Failed to add "${rawInput}" to watchlist:`, error);
      message.error(`Failed to add "${rawInput}". Please try again.`);
    } finally {
      setLoading(false);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (symbolToRemove: string) => {
    setWatchlistSymbols(prev => prev.filter(symbol => symbol !== symbolToRemove));
    // 同时从显示数据中移除
    setWatchlistData(prev => prev.filter(item => item.symbol !== symbolToRemove));
    message.success(`${symbolToRemove} removed from watchlist`);
  };

  const handleRunBacktest = (symbol: string) => {
    // Navigate to backtest page with symbol pre-filled
    navigate(`/backtest?symbol=${symbol}`);
  };

  const handleAnalyze = (symbol: string) => {
    // Navigate to analyze page with symbol pre-filled
    navigate(`/analysis/${symbol}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSymbol();
    }
  };

  // 处理表格排序变化
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setSortedInfo(sorter);
  };

  // 计算统计信息
  const totalSymbols = watchlistSymbols.length;
  const gainers = watchlistData.filter(item => (item.changePercent ?? 0) > 0).length;
  const losers = watchlistData.filter(item => (item.changePercent ?? 0) < 0).length;
  const avgChange = watchlistData.length > 0 
    ? watchlistData.reduce((sum, item) => sum + (item.changePercent ?? 0), 0) / watchlistData.length 
    : 0;

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 90,
      fixed: 'left' as const,
      sorter: (a: WatchlistDisplayItem, b: WatchlistDisplayItem) => a.symbol.localeCompare(b.symbol),
      render: (symbol: string, record: WatchlistDisplayItem) => (
        <div>
          <div style={{ 
            fontWeight: '800', 
            fontSize: '15px', 
            letterSpacing: '-0.2px',
            color: '#1f1f1f',
            lineHeight: '1.1'
          }}>
            {symbol}
          </div>
          <div style={{ 
            fontSize: '10px', 
            color: '#bfbfbf', 
            fontWeight: 400, 
            marginTop: '1px',
            lineHeight: '1.2',
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: 0.7
          }}>
            {record.name || symbol}
          </div>
        </div>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 90,
      align: 'center' as const,
      sorter: (a: WatchlistDisplayItem, b: WatchlistDisplayItem) => (a.price || 0) - (b.price || 0),
      render: (price: number) => (
        <div style={{ 
          fontWeight: '800', 
          fontSize: '16px', 
          fontFeatureSettings: '"tnum"',
          color: '#1f1f1f',
          textAlign: 'center',
          lineHeight: '40px'
        }}>
          {price !== null && price !== undefined ? `$${safeToFixed(price, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      width: 95,
      align: 'center' as const,
      sorter: (a: WatchlistDisplayItem, b: WatchlistDisplayItem) => (a.change || 0) - (b.change || 0),
      render: (change: number) => {
        const safeChange = typeof change === 'number' && !isNaN(change) ? change : 0;
        const isPositive = safeChange > 0;
        const isNegative = safeChange < 0;
        
        return (
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 800, 
            color: isPositive ? '#52c41a' : isNegative ? '#ff4d4f' : '#666',
            fontFeatureSettings: '"tnum"',
            textAlign: 'center',
            lineHeight: '40px'
          }}>
            {safeChange !== 0 ? `${isPositive ? '+' : '-'}$${safeToFixed(Math.abs(safeChange), 2)}` : '$0.00'}
          </div>
        );
      },
    },
    {
      title: 'Change %',
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 100,
      align: 'center' as const,
      sorter: (a: WatchlistDisplayItem, b: WatchlistDisplayItem) => (a.changePercent || 0) - (b.changePercent || 0),
      render: (percent: number) => {
        const safePercent = typeof percent === 'number' && !isNaN(percent) ? percent : 0;
        const isPositive = safePercent > 0;
        const isNegative = safePercent < 0;
        
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
                fontSize: '13px',
                padding: '4px 10px',
                fontWeight: 800,
                borderRadius: '6px',
                textAlign: 'center',
                display: 'inline-block',
                lineHeight: '16px',
                minWidth: '70px',
                border: 'none'
              }}
            >
              {safePercent !== 0 ? `${isPositive ? '+' : '-'}${safeToFixed(Math.abs(safePercent), 2)}%` : '0.00%'}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Day High',
      dataIndex: 'dayHigh',
      key: 'dayHigh',
      width: 90,
      align: 'center' as const,
      render: (dayHigh: number) => (
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: '#595959', 
          fontFeatureSettings: '"tnum"',
          textAlign: 'center',
          lineHeight: '40px'
        }}>
          {dayHigh !== null && dayHigh !== undefined ? `$${safeToFixed(dayHigh, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Day Low',
      dataIndex: 'dayLow',
      key: 'dayLow',
      width: 90,
      align: 'center' as const,
      render: (dayLow: number) => (
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: '#595959', 
          fontFeatureSettings: '"tnum"',
          textAlign: 'center',
          lineHeight: '40px'
        }}>
          {dayLow !== null && dayLow !== undefined ? `$${safeToFixed(dayLow, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Market Cap',
      dataIndex: 'marketCap',
      key: 'marketCap',
      width: 100,
      align: 'center' as const,
      sorter: (a: WatchlistDisplayItem, b: WatchlistDisplayItem) => (a.marketCap || 0) - (b.marketCap || 0),
      render: (marketCap: number | null) => (
        <div style={{ 
          fontSize: '13px', 
          fontWeight: 700, 
          color: '#595959', 
          fontFeatureSettings: '"tnum"',
          textAlign: 'center',
          lineHeight: '40px'
        }}>
          {formatMarketCap(marketCap)}
        </div>
      ),
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      width: 95,
      align: 'center' as const,
      render: (sector: string | null) => (
        <Tag 
          color="default" 
          style={{ 
            margin: 0,
            fontSize: '11px',
            padding: '3px 8px',
            fontWeight: 600,
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
            color: '#595959',
            border: '1px solid #e8e8e8',
            display: 'inline-block',
            lineHeight: '14px',
            maxWidth: '85px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {sector || 'Other'}
        </Tag>
      ),
    },
    {
      title: 'Signal',
      key: 'signal',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: WatchlistDisplayItem) => {
        const signal = getSignal(record);
        
        // 根据signal类型设置颜色和样式
        let color = 'default';
        let bgColor = '#f5f5f5';
        let textColor = '#595959';
        
        switch(signal) {
          case 'Bullish':
            color = 'green';
            bgColor = '#f6ffed';
            textColor = '#52c41a';
            break;
          case 'Bearish':
            color = 'red';
            bgColor = '#fff2f0';
            textColor = '#ff4d4f';
            break;
          case 'Near support':
            color = 'blue';
            bgColor = '#e6f7ff';
            textColor = '#1890ff';
            break;
          case 'Oversold':
            color = 'purple';
            bgColor = '#f9f0ff';
            textColor = '#722ed1';
            break;
          case 'No clear setup':
            color = 'default';
            bgColor = '#fafafa';
            textColor = '#8c8c8c';
            break;
          default:
            color = 'default';
            bgColor = '#f5f5f5';
            textColor = '#bfbfbf';
        }
        
        return (
          <Tag 
            color={color}
            style={{ 
              margin: 0,
              fontSize: '12px',
              padding: '4px 8px',
              fontWeight: 700,
              borderRadius: '5px',
              backgroundColor: bgColor,
              color: textColor,
              border: 'none',
              display: 'inline-block',
              lineHeight: '14px',
              minWidth: '80px',
              textAlign: 'center'
            }}
          >
            {signal}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: WatchlistDisplayItem) => (
        <div style={{ 
          display: 'flex', 
          gap: '6px', 
          justifyContent: 'center',
          height: '40px',
          alignItems: 'center'
        }}>
          <Button
            type="primary"
            icon={<LineChartOutlined />}
            onClick={() => handleAnalyze(record.symbol)}
            size="small"
            style={{ 
              fontSize: '12px', 
              padding: '0 10px', 
              height: '30px',
              minWidth: '75px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600'
            }}
          >
            Analyze
          </Button>
          <Button
            type="default"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunBacktest(record.symbol)}
            size="small"
            style={{ 
              fontSize: '12px', 
              padding: '0 10px', 
              height: '30px',
              minWidth: '75px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              borderColor: '#d9d9d9'
            }}
          >
            Backtest
          </Button>
          <Button
            type="default"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveSymbol(record.symbol)}
            size="small"
            style={{ 
              fontSize: '12px', 
              padding: '0 8px', 
              height: '30px',
              minWidth: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              borderColor: '#ffa39e'
            }}
          />
        </div>
      ),
    },
  ];

  // 应用排序
  let sortedDataSource = [...watchlistData];
  if (sortedInfo.columnKey) {
    sortedDataSource.sort((a, b) => {
      const aValue = a[sortedInfo.columnKey as keyof WatchlistDisplayItem];
      const bValue = b[sortedInfo.columnKey as keyof WatchlistDisplayItem];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortedInfo.order === 'descend' ? bValue - aValue : aValue - bValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortedInfo.order === 'descend' 
          ? bValue.localeCompare(aValue) 
          : aValue.localeCompare(bValue);
      }
      
      return 0;
    });
  }

  const dataSource = sortedDataSource.map(item => ({
    key: item.symbol,
    ...item
  }));

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ marginBottom: '4px', fontSize: '24px', fontWeight: '700', color: '#1f1f1f' }}>Watchlist</h1>
        <div style={{ color: '#8c8c8c', fontSize: '13px' }}>
          Monitor and analyze your selected stocks
        </div>
      </div>

      {/* Add Symbol Form */}
      <Card style={{ marginBottom: '16px', padding: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
            Add Symbol to Watchlist
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="Enter stock symbol (e.g., AAPL, TSLA)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              style={{ maxWidth: '280px', fontSize: '13px' }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSymbol}
              loading={loading}
              style={{ fontSize: '13px' }}
            >
              Add
            </Button>
          </Space.Compact>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '6px' }}>
            Enter 1-5 uppercase letters. Example: AAPL, MSFT, TSLA, NVDA
          </div>
        </Space>
      </Card>

      {/* Watchlist Summary - Tight Professional Bar */}
      {watchlistSymbols.length > 0 && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '10px 14px', 
          borderRadius: '6px',
          background: '#f8f9fa',
          border: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: '#8c8c8c', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>TOTAL</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#1f1f1f', marginLeft: '2px' }}>{totalSymbols}</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: '#8c8c8c', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>GAINERS</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#52c41a', marginLeft: '2px' }}>{gainers}</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: '#8c8c8c', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>LOSERS</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#ff4d4f', marginLeft: '2px' }}>{losers}</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: '#8c8c8c', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>AVG Δ</div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '800', 
              color: avgChange >= 0 ? '#52c41a' : '#ff4d4f',
              marginLeft: '2px'
            }}>
              {avgChange !== 0 ? `${avgChange > 0 ? '+' : '-'}${safeToFixed(Math.abs(avgChange), 2)}%` : '0.00%'}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <div style={{ fontSize: '9px', color: '#8c8c8c', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>UPDATED</div>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '700', 
              color: '#595959',
              fontFamily: 'monospace',
              marginLeft: '2px'
            }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Table */}
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
              Watchlist ({watchlistSymbols.length} {watchlistSymbols.length === 1 ? 'stock' : 'stocks'})
            </span>
            {watchlistSymbols.length > 0 && (
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                Click column headers to sort
              </div>
            )}
          </div>
        }
        style={{ borderRadius: '8px' }}
      >
        {watchlistSymbols.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="middle"
            bordered={false}
            scroll={{ x: 1250 }}
            onChange={handleTableChange}
            style={{ marginTop: '-8px' }}
          />
        ) : (
          <Empty
            description="Your watchlist is empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          >
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#666', marginBottom: '8px' }}>
                You can add stocks to your watchlist from:
              </p>
              <ul style={{ textAlign: 'left', margin: '0 auto', display: 'inline-block', color: '#666' }}>
                <li>Market page - Click "Watchlist" button on any stock</li>
                <li>This page - Use the form above to add symbols</li>
              </ul>
            </div>
            <Button
              type="primary"
              onClick={() => setNewSymbol('AAPL')}
            >
              Add Example Stock (AAPL)
            </Button>
          </Empty>
        )}
      </Card>

      {/* Quick Tips - Minimal Helper */}
      {watchlistSymbols.length > 0 && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px 10px', 
          borderRadius: '4px', 
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          fontSize: '10px',
          color: '#8c8c8c',
          lineHeight: '1.4'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            marginBottom: '2px'
          }}>
            <span style={{ fontSize: '10px', opacity: 0.5 }}>💡</span>
            <span style={{ fontWeight: '500', color: '#8c8c8c' }}>Quick Tips</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span>• <span style={{ fontWeight: '500', color: '#595959' }}>Analyze</span> for technicals</span>
            <span>• <span style={{ fontWeight: '500', color: '#595959' }}>Backtest</span> strategies</span>
            <span>• Click headers to sort</span>
            <span>• Auto-saves in browser</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;