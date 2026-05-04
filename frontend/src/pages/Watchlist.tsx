import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, Table, Button, Input, Space, Empty, Tag, message, 
  Typography, Row, Col, Statistic, Tooltip
} from 'antd';
import { 
  PlusOutlined, PlayCircleOutlined, DeleteOutlined, 
  LineChartOutlined, SearchOutlined, InfoCircleOutlined,
  RiseOutlined, FallOutlined, DashOutlined, ClockCircleOutlined,
  ThunderboltOutlined, ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons';

import marketDataService from '../services/marketDataService';

const { Title, Text } = Typography;
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
  const [searchTerm, setSearchTerm] = useState('');
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
    
    if (!price || price <= 0 || !dayHigh || !dayLow || dayHigh <= 0 || dayLow <= 0) {
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
  };

  // Load watchlist from localStorage on component mount and listen for changes
  useEffect(() => {
    if (hasLoaded.current) return;
    
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
    
    loadWatchlist();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadWatchlist();
    };
    window.addEventListener('storage', handleStorageChange);
    hasLoaded.current = true;
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 更新watchlist中的股票数据
  const updateWatchlistData = useCallback(async (symbolsArg?: string[]) => {
    const symbols = symbolsArg ?? watchlistSymbols;
    if (symbols.length === 0) {
      setWatchlistData([]);
      return;
    }
    if (updating) return;
    
    try {
      setUpdating(true);
      const stocks = await marketDataService.getStocks(symbols);
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
  }, [watchlistSymbols, updating]);

  useEffect(() => {
    if (watchlistSymbols.length > 0) {
      updateWatchlistData();
    } else {
      setWatchlistData([]);
    }
    const intervalId = setInterval(() => updateWatchlistData(), 60000);
    return () => clearInterval(intervalId);
  }, [watchlistSymbols, updateWatchlistData]);

  useEffect(() => {
    if (watchlistSymbols.length === 0 && !hasLoaded.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlistSymbols));
  }, [watchlistSymbols]);

  // 解析输入到真实symbol
  const resolveWatchlistSymbol = async (input: string): Promise<string | null> => {
    const rawInput = input.trim();
    if (!rawInput) return null;
    const normalizedInput = rawInput.replace(/^["']|["']$/g, '').trim();
    if (!normalizedInput) return null;
    const upperInput = normalizedInput.toUpperCase();
    const lowerInput = normalizedInput.toLowerCase();
    
    try {
      const looksLikeSymbol = /^[A-Za-z]{1,5}$/.test(normalizedInput);
      if (looksLikeSymbol) {
        try {
          const stockData = await marketDataService.getStockData(upperInput);
          if (stockData && !stockData.error) return stockData.symbol.toUpperCase();
        } catch (error) {}
        
        try {
          const currentStocks = await marketDataService.getStocks([]);
          const exactSymbolMatch = currentStocks.find(stock => stock.symbol.toUpperCase() === upperInput);
          if (exactSymbolMatch) return exactSymbolMatch.symbol.toUpperCase();
        } catch (error) {}
      }
      
      try {
        const currentStocks = await marketDataService.getStocks([]);
        let matchedStock = currentStocks.find(stock => stock.name?.toLowerCase() === lowerInput) ||
                       currentStocks.find(stock => stock.name?.toLowerCase().startsWith(lowerInput)) ||
                       currentStocks.find(stock => stock.name?.toLowerCase().includes(lowerInput));
        if (matchedStock) return matchedStock.symbol.toUpperCase();
      } catch (error) {}
      
      try {
        const searchResults = await marketDataService.searchStocks(normalizedInput, 10);
        if (searchResults && searchResults.length > 0) {
          let matchedResult = searchResults.find(result => result.name?.toLowerCase() === lowerInput) ||
                          searchResults.find(result => result.name?.toLowerCase().startsWith(lowerInput)) ||
                          searchResults.find(result => result.name?.toLowerCase().includes(lowerInput)) ||
                          searchResults[0];
          return matchedResult.symbol.toUpperCase();
        }
      } catch (error) {}
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
      const resolvedSymbol = await resolveWatchlistSymbol(rawInput);
      if (!resolvedSymbol) {
        message.error(`No matching stock found for "${rawInput}"`);
        return;
      }

      if (watchlistSymbols.includes(resolvedSymbol)) {
        message.warning(`${resolvedSymbol} is already in your watchlist`);
        setNewSymbol('');
        return;
      }

      const nextSymbols = [...watchlistSymbols, resolvedSymbol];
      setWatchlistSymbols(nextSymbols);
      await updateWatchlistData(nextSymbols);
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
    setWatchlistData(prev => prev.filter(item => item.symbol !== symbolToRemove));
    message.success(`${symbolToRemove} removed from watchlist`);
  };

  const handleRunBacktest = (symbol: string) => {
    navigate(`/backtest?symbol=${symbol}`);
  };

  const handleAnalyze = (symbol: string) => {
    navigate(`/analysis/${symbol}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddSymbol();
  };

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
      width: 120,
      fixed: 'left' as const,
      sorter: true,
      render: (symbol: string, record: WatchlistDisplayItem) => (
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              backgroundColor: '#f0f2f5', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '11px',
              color: '#595959',
              border: '1px solid #e8e8e8'
            }}>
              {symbol.substring(0, 2)}
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#111827', lineHeight: '1.2' }}>{symbol}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {record.name || '-'}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right' as const,
      sorter: true,
      render: (price: number) => (
        <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>
          {price != null ? `$${safeToFixed(price, 2)}` : '—'}
        </div>
      ),
    },
    {
      title: 'Change',
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 110,
      align: 'right' as const,
      sorter: true,
      render: (percent: number, record: WatchlistDisplayItem) => {
        const safePercent = percent || 0;
        const safeChange = record.change || 0;
        const color = safePercent > 0 ? '#10b981' : safePercent < 0 ? '#ef4444' : '#6b7280';
        const Icon = safePercent > 0 ? ArrowUpOutlined : safePercent < 0 ? ArrowDownOutlined : DashOutlined;
        
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color, fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              <Icon style={{ fontSize: '10px' }} />
              {safePercent !== 0 ? `${Math.abs(safePercent).toFixed(2)}%` : '0.00%'}
            </div>
            <div style={{ color, fontSize: '11px', opacity: 0.8 }}>
              {safeChange !== 0 ? `${safeChange > 0 ? '+' : ''}${safeChange.toFixed(2)}` : '0.00'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Day Range',
      key: 'dayRange',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: WatchlistDisplayItem) => {
        if (record.dayLow == null || record.dayHigh == null || record.price == null) return '—';
        const range = record.dayHigh - record.dayLow;
        const pos = range === 0 ? 0 : ((record.price - record.dayLow) / range) * 100;
        return (
          <div style={{ width: '100%', padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
              <span>{record.dayLow.toFixed(2)}</span>
              <span>{record.dayHigh.toFixed(2)}</span>
            </div>
            <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', position: 'relative' }}>
              <div style={{ 
                position: 'absolute', 
                left: `${Math.max(0, Math.min(100, pos))}%`, 
                top: '-2px', 
                width: '8px', 
                height: '8px', 
                background: '#3b82f6', 
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }} />
            </div>
          </div>
        );
      },
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      width: 110,
      render: (sector: string | null) => (
        <Tag color="blue" style={{ 
          fontSize: '10px', borderRadius: '4px', border: 'none', 
          backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 
        }}>
          {sector || 'Other'}
        </Tag>
      ),
    },
    {
      title: 'Signal',
      key: 'signal',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: WatchlistDisplayItem) => {
        const signal = getSignal(record);
        let color = '#6b7280';
        let bgColor = '#f3f4f6';
        if (signal.includes('Bullish')) { color = '#059669'; bgColor = '#ecfdf5'; }
        else if (signal.includes('Bearish')) { color = '#dc2626'; bgColor = '#fef2f2'; }
        else if (signal.includes('support')) { color = '#2563eb'; bgColor = '#eff6ff'; }
        else if (signal.includes('resistance')) { color = '#d97706'; bgColor = '#fffbeb'; }
        
        return (
          <span style={{ 
            fontSize: '11px', fontWeight: '700', color, backgroundColor: bgColor,
            padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap'
          }}>
            {signal}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: WatchlistDisplayItem) => (
        <Space size={4}>
          <Tooltip title="Analyze">
            <Button
              type="primary"
              size="small"
              icon={<LineChartOutlined />}
              onClick={() => handleAnalyze(record.symbol)}
              style={{ borderRadius: '4px', height: '28px', fontSize: '12px' }}
            >
              Analyze
            </Button>
          </Tooltip>
          <Tooltip title="Backtest">
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRunBacktest(record.symbol)}
              style={{ borderRadius: '4px', height: '28px', fontSize: '12px' }}
            >
              Backtest
            </Button>
          </Tooltip>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveSymbol(record.symbol)}
            style={{ borderRadius: '4px', height: '28px' }}
          />
        </Space>
      ),
    },
  ];

  const dataSource = useMemo(() => {
    let data = [...watchlistData];
    
    // Search filter
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.symbol.toLowerCase().includes(s) || 
        (item.name && item.name.toLowerCase().includes(s))
      );
    }
    
    // Sort
    if (sortedInfo.columnKey && sortedInfo.order) {
      const key = sortedInfo.columnKey as keyof WatchlistDisplayItem;
      const order = sortedInfo.order;
      data.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        
        if (valA == null) return order === 'descend' ? 1 : -1;
        if (valB == null) return order === 'descend' ? -1 : 1;
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return order === 'descend' ? valB - valA : valA - valB;
        }
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return order === 'descend' ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return 0;
      });
    }
    
    return data.map(item => ({ key: item.symbol, ...item }));
  }, [watchlistData, searchTerm, sortedInfo]);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Watchlist</Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>Monitor and analyze your selected stocks in real-time</Text>
          <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
            <span><ThunderboltOutlined style={{ color: '#3b82f6', marginRight: '4px' }} />Total: <strong>{totalSymbols}</strong> symbols</span>
            <span><ClockCircleOutlined style={{ marginRight: '4px' }} />Updated: <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
            <span><RiseOutlined style={{ color: avgChange >= 0 ? '#10b981' : '#ef4444', marginRight: '4px' }} />Avg Change: <strong style={{ color: avgChange >= 0 ? '#10b981' : '#ef4444' }}>{avgChange.toFixed(2)}%</strong></span>
          </div>
        </div>
        
        {/* Add Symbol Panel */}
        <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '380px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Add Symbol to Watchlist</div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="e.g. AAPL, TSLA, NVDA"
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              style={{ height: '36px', borderRadius: '6px 0 0 6px' }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSymbol}
              loading={loading}
              style={{ height: '36px', borderRadius: '0 6px 6px 0', fontWeight: 600 }}
            >
              Add
            </Button>
          </Space.Compact>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Press Enter to add</span>
            <span>Input company name or ticker</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {watchlistSymbols.length > 0 && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>WATCHLIST SIZE</Text>}
                value={totalSymbols}
                prefix={<DashOutlined style={{ color: '#3b82f6', opacity: 0.8 }} />}
                valueStyle={{ fontWeight: 800, fontSize: '24px' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>GAINERS</Text>}
                value={gainers}
                valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: '24px' }}
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>LOSERS</Text>}
                value={losers}
                valueStyle={{ color: '#ef4444', fontWeight: 800, fontSize: '24px' }}
                prefix={<FallOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bodyStyle={{ padding: '16px' }} style={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>AVG PERFORMANCE</Text>}
                value={avgChange}
                precision={2}
                suffix="%"
                valueStyle={{ color: avgChange >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: '24px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Watchlist Table Card */}
      <Card 
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text strong style={{ fontSize: '16px' }}>Watchlist Items</Text>
            <Tag color="blue" style={{ borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>{watchlistSymbols.length}</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Input 
              placeholder="Search watchlist..."
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              size="small"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '220px', borderRadius: '6px' }}
              allowClear
            />
            {watchlistSymbols.length > 0 && (
              <Tooltip title="Click column headers to sort">
                <InfoCircleOutlined style={{ color: '#9ca3af', cursor: 'help' }} />
              </Tooltip>
            )}
          </div>
        </div>

        {watchlistSymbols.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="middle"
            bordered={false}
            scroll={{ x: 1000 }}
            onChange={handleTableChange}
            rowClassName={() => 'watchlist-row'}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ padding: '40px 0' }}>
                <Title level={4} style={{ marginBottom: '8px' }}>Your watchlist is empty</Title>
                <Text type="secondary">Add a stock symbol above to start monitoring real-time performance and AI signals.</Text>
                <div style={{ marginTop: '24px' }}>
                  <Button type="primary" onClick={() => setNewSymbol('AAPL')} icon={<PlusOutlined />}>
                    Try adding AAPL
                  </Button>
                </div>
              </div>
            }
          />
        )}
      </Card>

      {/* Quick Tips / Help Strip */}
      {watchlistSymbols.length > 0 && (
        <div style={{ 
          marginTop: '24px', 
          padding: '12px 20px', 
          borderRadius: '12px', 
          background: '#f9fafb',
          border: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'center',
          gap: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#eff6ff', color: '#3b82f6', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <LineChartOutlined />
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>Analyze for technical context</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#f5f3ff', color: '#8b5cf6', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <PlayCircleOutlined />
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>Backtest strategy fit</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#ecfdf5', color: '#10b981', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <InfoCircleOutlined />
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>Click headers to sort</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#fffbeb', color: '#f59e0b', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              <ClockCircleOutlined />
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>Data auto-saves in browser</Text>
          </div>
        </div>
      )}

      <style>{`
        .watchlist-row { transition: background-color 0.2s; }
        .watchlist-row:hover { background-color: #f9fafb !important; }
        .ant-table-thead > tr > th { background: #fafafa !important; font-weight: 700 !important; color: #374151 !important; border-bottom: 1px solid #f3f4f6 !important; }
        .ant-card { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
      `}</style>
    </div>
  );
};

export default Watchlist;