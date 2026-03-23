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

    // 每30秒更新一次数据
    const intervalId = setInterval(updateWatchlistData, 30000);
    
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
      width: 100,
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.symbol.localeCompare(b.symbol),
      render: (symbol: string) => (
        <Tag color="blue" style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {symbol}
        </Tag>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 95,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.price || 0) - (b.price || 0),
      render: (price: number) => (
        <div style={{ fontWeight: '600', fontFeatureSettings: '"tnum"' }}>
          {price !== null && price !== undefined ? `$${safeToFixed(price, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      width: 95,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.change || 0) - (b.change || 0),
      render: (change: number) => {
        const safeChange = typeof change === 'number' && !isNaN(change) ? change : 0;
        const color = safeChange >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <div style={{ color, fontWeight: '600', fontFeatureSettings: '"tnum"' }}>
            {safeChange >= 0 ? '+' : ''}${safeToFixed(safeChange, 2)}
          </div>
        );
      },
    },
    {
      title: 'Change %',
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 95,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.changePercent || 0) - (b.changePercent || 0),
      render: (percent: number) => {
        const safePercent = typeof percent === 'number' && !isNaN(percent) ? percent : 0;
        const color = safePercent >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <Tag 
            color={safePercent >= 0 ? 'green' : 'red'}
            style={{ 
              fontWeight: '600',
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '6px',
              border: 'none'
            }}
          >
            {safePercent >= 0 ? '+' : ''}{safeToFixed(safePercent, 2)}%
          </Tag>
        );
      },
    },
    {
      title: 'Day High',
      dataIndex: 'dayHigh',
      key: 'dayHigh',
      width: 95,
      render: (dayHigh: number) => (
        <div style={{ fontSize: '13px', color: '#595959', fontFeatureSettings: '"tnum"' }}>
          {dayHigh !== null && dayHigh !== undefined ? `$${safeToFixed(dayHigh, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Day Low',
      dataIndex: 'dayLow',
      key: 'dayLow',
      width: 95,
      render: (dayLow: number) => (
        <div style={{ fontSize: '13px', color: '#595959', fontFeatureSettings: '"tnum"' }}>
          {dayLow !== null && dayLow !== undefined ? `$${safeToFixed(dayLow, 2)}` : '--'}
        </div>
      ),
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      width: 110,
      ellipsis: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_: any, record: WatchlistItem) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          <Button
            type="primary"
            icon={<LineChartOutlined />}
            onClick={() => handleAnalyze(record.symbol)}
            size="small"
            style={{ 
              fontSize: '12px', 
              padding: '0 10px', 
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Backtest
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveSymbol(record.symbol)}
            size="small"
            style={{ 
              fontSize: '12px', 
              padding: '0 8px', 
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Remove
          </Button>
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

      {/* Watchlist Summary */}
      {watchlist.length > 0 && (
        <Card style={{ marginBottom: '16px', padding: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px', letterSpacing: '0.3px' }}>TOTAL SYMBOLS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f1f1f' }}>{totalSymbols}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px', letterSpacing: '0.3px' }}>GAINERS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#52c41a' }}>{gainers}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px', letterSpacing: '0.3px' }}>LOSERS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ff4d4f' }}>{losers}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px', letterSpacing: '0.3px' }}>AVG CHANGE</div>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: '700', 
                  color: avgChange >= 0 ? '#52c41a' : '#ff4d4f' 
                }}>
                  {avgChange >= 0 ? '+' : ''}{safeToFixed(avgChange, 2)}%
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px', letterSpacing: '0.3px' }}>LAST UPDATED</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#595959' }}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </Card>
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
            scroll={{ x: 950 }}
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

      {/* Quick Tips */}
      {watchlist.length > 0 && (
        <Card style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: '#fafafa' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#595959', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span>Quick Tips</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#8c8c8c', fontSize: '12px', lineHeight: '1.6' }}>
            <li>Click <strong>Analyze</strong> for detailed technical analysis</li>
            <li>Click <strong>Backtest</strong> to test trading strategies</li>
            <li>Click column headers to sort the table</li>
            <li>Watchlist is saved automatically in your browser</li>
          </ul>
        </Card>
      )}
    </div>
  );
};

export default Watchlist;