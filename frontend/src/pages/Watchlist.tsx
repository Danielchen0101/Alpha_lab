import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Input, Space, Alert, Empty, Tag, message, Statistic } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, EyeOutlined, LineChartOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import marketDataService from '../services/marketDataService';

const STORAGE_KEY = "quant_watchlist";

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  sector: string;
  addedAt: string;
  dayHigh?: number;
  dayLow?: number;
}

const Watchlist: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
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
  const getSignal = (item: WatchlistItem): string => {
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

  // 格式化市值函数（与Market页面一致）
  const formatMarketCap = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) return '--';
    
    const num = Number(value);
    if (isNaN(num)) return '--';
    
    // 万亿 (Trillion) - 1万亿 = 1e12
    if (num >= 1e12) {
      const trillions = num / 1e12;
      // 对于万亿级别，显示2位小数
      return `$${trillions.toFixed(2)}T`;
    }
    
    // 十亿 (Billion) - 10亿 = 1e9
    if (num >= 1e9) {
      const billions = num / 1e9;
      // 对于十亿级别，显示2位小数
      return `$${billions.toFixed(2)}B`;
    }
    
    // 百万 (Million) - 1百万 = 1e6
    if (num >= 1e6) {
      const millions = num / 1e6;
      return `$${millions.toFixed(2)}M`;
    }
    
    // 千 (Thousand) - 1千 = 1e3
    if (num >= 1e3) {
      const thousands = num / 1e3;
      return `$${thousands.toFixed(2)}K`;
    }
    
    return `$${num.toFixed(2)}`;
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
            setWatchlist(parsed);
          } else {
            setWatchlist([]);
          }
        } catch (err) {
          console.error('Failed to parse watchlist from localStorage:', err);
          setWatchlist([]);
        }
      } else {
        setWatchlist([]);
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
  useEffect(() => {
    const updateWatchlistData = async () => {
      if (watchlist.length === 0 || updating) return;
      
      try {
        setUpdating(true);
        const symbols = watchlist.map(item => item.symbol);
        if (symbols.length === 0) return;
        
        // 获取最新市场数据
        const marketData = await marketDataService.getStocks(symbols);
        
        // 更新watchlist中的数据
        setWatchlist(prev => {
          return prev.map(item => {
            const latestData = marketData.find(stock => stock.symbol === item.symbol);
            if (latestData && !latestData.error) {
              return {
                ...item,
                name: latestData.name || item.name,
                price: latestData.price || item.price,
                change: latestData.change || item.change,
                changePercent: latestData.changePercent || item.changePercent,
                volume: latestData.volume || item.volume,
                marketCap: latestData.marketCap || item.marketCap,
                sector: latestData.sector || item.sector,
                dayHigh: latestData.dayHigh !== undefined && latestData.dayHigh !== null ? latestData.dayHigh : item.dayHigh,
                dayLow: latestData.dayLow !== undefined && latestData.dayLow !== null ? latestData.dayLow : item.dayLow
              };
            }
            return item;
          });
        });
      } catch (error) {
        console.error('Failed to update watchlist data:', error);
      } finally {
        setUpdating(false);
      }
    };

    // 初始加载时更新一次
    if (watchlist.length > 0) {
      updateWatchlistData();
    }

    // 每60秒更新一次数据（减少刷新频率，避免数字频繁跳动）
    const intervalId = setInterval(updateWatchlistData, 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [watchlist]);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    // Don't save on initial mount (empty array)
    if (watchlist.length === 0 && !hasLoaded.current) {
      return;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const handleAddSymbol = async () => {
    const symbol = newSymbol.trim().toUpperCase();
    
    if (!symbol) {
      message.warning('Please enter a stock symbol');
      return;
    }

    // Basic validation: 1-5 letters
    if (!/^[A-Z]{1,5}$/.test(symbol)) {
      message.error('Invalid stock symbol. Use 1-5 uppercase letters (e.g., AAPL, TSLA)');
      return;
    }

    // Check for duplicates
    if (watchlist.some(item => item.symbol === symbol)) {
      message.warning(`${symbol} is already in your watchlist`);
      setNewSymbol('');
      return;
    }

    try {
      setLoading(true);
      
      // 尝试获取股票数据
      const stockData = await marketDataService.getStockData(symbol);
      
      if (stockData.error) {
        // 如果获取失败，使用基本数据
        const newItem: WatchlistItem = {
          symbol: symbol,
          name: `${symbol} Inc.`,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          marketCap: 0,
          sector: 'Unknown',
          addedAt: new Date().toISOString()
        };
        
        setWatchlist(prev => [...prev, newItem]);
        message.warning(`Added ${symbol} to watchlist (limited info available)`);
      } else {
        // 使用获取到的完整数据
        const newItem: WatchlistItem = {
          symbol: stockData.symbol,
          name: stockData.name || `${symbol} Inc.`,
          price: stockData.price || 0,
          change: stockData.change || 0,
          changePercent: stockData.changePercent || 0,
          volume: stockData.volume || 0,
          marketCap: stockData.marketCap || 0,
          sector: stockData.sector || 'Unknown',
          dayHigh: stockData.dayHigh !== undefined && stockData.dayHigh !== null ? stockData.dayHigh : undefined,
          dayLow: stockData.dayLow !== undefined && stockData.dayLow !== null ? stockData.dayLow : undefined,
          addedAt: new Date().toISOString()
        };
        
        setWatchlist(prev => [...prev, newItem]);
        message.success(`Added ${symbol} to watchlist`);
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      // 出错时使用基本数据
      const newItem: WatchlistItem = {
        symbol: symbol,
        name: `${symbol} Inc.`,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        marketCap: 0,
        sector: 'Unknown',
        dayHigh: undefined,
        dayLow: undefined,
        addedAt: new Date().toISOString()
      };
      
      setWatchlist(prev => [...prev, newItem]);
      message.warning(`Added ${symbol} to watchlist (data fetch failed)`);
    } finally {
      setLoading(false);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (symbolToRemove: string) => {
    setWatchlist(prevWatchlist => {
      const updatedWatchlist = prevWatchlist.filter(item => item.symbol !== symbolToRemove);
      message.success(`${symbolToRemove} removed from watchlist`);
      return updatedWatchlist;
    });
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
  const totalSymbols = watchlist.length;
  const gainers = watchlist.filter(item => item.changePercent > 0).length;
  const losers = watchlist.filter(item => item.changePercent < 0).length;
  const avgChange = watchlist.length > 0 
    ? watchlist.reduce((sum, item) => sum + (item.changePercent || 0), 0) / watchlist.length 
    : 0;

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 90,
      fixed: 'left' as const,
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.symbol.localeCompare(b.symbol),
      render: (symbol: string, record: WatchlistItem) => (
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
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.price || 0) - (b.price || 0),
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
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.change || 0) - (b.change || 0),
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
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.changePercent || 0) - (b.changePercent || 0),
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
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.marketCap || 0) - (b.marketCap || 0),
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
      render: (_: any, record: WatchlistItem) => {
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
      render: (_: any, record: WatchlistItem) => (
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
  let sortedDataSource = [...watchlist];
  if (sortedInfo.columnKey) {
    sortedDataSource.sort((a, b) => {
      const aValue = a[sortedInfo.columnKey as keyof WatchlistItem];
      const bValue = b[sortedInfo.columnKey as keyof WatchlistItem];
      
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
      {watchlist.length > 0 && (
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
              Watchlist ({watchlist.length} {watchlist.length === 1 ? 'stock' : 'stocks'})
            </span>
            {watchlist.length > 0 && (
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                Click column headers to sort
              </div>
            )}
          </div>
        }
        style={{ borderRadius: '8px' }}
      >
        {watchlist.length > 0 ? (
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
      {watchlist.length > 0 && (
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