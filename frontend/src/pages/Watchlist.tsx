import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, Button, Input, Space, Empty, Tag, message, 
  Typography, Tooltip
} from 'antd';
import { 
  PlusOutlined, PlayCircleOutlined, DeleteOutlined, 
  LineChartOutlined, SearchOutlined, InfoCircleOutlined,
  RiseOutlined, FallOutlined, DashOutlined, ClockCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

import marketDataService from '../services/marketDataService';
import { useLanguage } from '../contexts/LanguageContext';

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
  const { t, translateSector, translateSignal } = useLanguage();
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
      message.warning(t.watchlist.pleaseEnterSymbol);
      return;
    }

    try {
      setLoading(true);
      const resolvedSymbol = await resolveWatchlistSymbol(rawInput);
      if (!resolvedSymbol) {
        message.error(t.watchlist.noMatchFound.replace('{input}', rawInput));
        return;
      }

      if (watchlistSymbols.includes(resolvedSymbol)) {
        message.warning(t.watchlist.alreadyInWatchlist.replace('{symbol}', resolvedSymbol));
        setNewSymbol('');
        return;
      }

      const nextSymbols = [...watchlistSymbols, resolvedSymbol];
      setWatchlistSymbols(nextSymbols);
      await updateWatchlistData(nextSymbols);
      message.success(t.watchlist.addedToWatchlist.replace('{symbol}', resolvedSymbol));
    } catch (error) {
      console.error(`Failed to add "${rawInput}" to watchlist:`, error);
      message.error(t.watchlist.failedToAdd.replace('{input}', rawInput));
    } finally {
      setLoading(false);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (symbolToRemove: string) => {
    setWatchlistSymbols(prev => prev.filter(symbol => symbol !== symbolToRemove));
    setWatchlistData(prev => prev.filter(item => item.symbol !== symbolToRemove));
    message.success(t.watchlist.removedFromWatchlist.replace('{symbol}', symbolToRemove));
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
      title: t.market.symbol,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 160,
      fixed: 'left' as const,
      sorter: true,
      render: (symbol: string, record: WatchlistDisplayItem) => (
        <Space size={12}>
          <div style={{ 
            width: 36, height: 36, borderRadius: 10, background: "var(--app-card-bg-soft)", 
            border: "1px solid var(--app-border-soft)", display: 'flex', alignItems: 'center', 
            justifyContent: 'center', fontWeight: 800, color: "var(--app-text-strong)", fontSize: 14 
          }}>
            {symbol[0]}
          </div>
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "var(--app-text-strong)", letterSpacing: '-0.01em' }}>{symbol}</span>
            <div style={{ fontSize: 11, color: "var(--app-text-muted)", fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.name || symbol}
            </div>
          </Space>
        </Space>
      ),
    },
    {
      title: t.market.price,
      dataIndex: 'price',
      key: 'price',
      width: 110,
      align: 'right' as const,
      sorter: true,
      render: (price: number) => (
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--app-text-strong)" }}>
          {price != null ? `$${safeToFixed(price, 2)}` : '—'}
        </span>
      ),
    },
    {
      title: t.market.changePercent,
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 110,
      align: 'right' as const,
      sorter: true,
      render: (percent: number, record: WatchlistDisplayItem) => {
        const safePercent = percent || 0;
        const isUp = safePercent > 0;
        const isDown = safePercent < 0;
        const color = isUp ? '#10b981' : isDown ? '#ef4444' : "var(--app-text-muted)";
        
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              background: isUp ? 'rgba(16, 185, 129, 0.08)' : isDown ? 'rgba(239, 68, 68, 0.08)' : "var(--app-border-soft)",
              color, padding: '3px 8px', borderRadius: '6px', fontSize: '13px', 
              fontWeight: 800, display: 'inline-block', minWidth: '65px'
            }}>
              {safePercent > 0 ? '+' : ''}{safeToFixed(safePercent, 2)}%
            </div>
          </div>
        );
      },
    },
    {
      title: t.watchlist.dayRange,
      key: 'dayRange',
      width: 160,
      render: (_: any, record: WatchlistDisplayItem) => {
        if (record.dayLow == null || record.dayHigh == null || record.price == null) return '—';
        const range = record.dayHigh - record.dayLow;
        const pos = range === 0 ? 0 : ((record.price - record.dayLow) / range) * 100;
        return (
          <div style={{ padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: "var(--app-text-muted)", fontWeight: 700, marginBottom: 4 }}>
              <span>{record.dayLow.toFixed(2)}</span>
              <span>{record.dayHigh.toFixed(2)}</span>
            </div>
            <div style={{ height: 4, background: "var(--app-border-soft)", borderRadius: 2, position: 'relative' }}>
              <div style={{ 
                position: 'absolute', left: `${Math.max(0, Math.min(100, pos))}%`, 
                top: -2, width: 8, height: 8, background: "var(--app-blue-bg, #3b82f6)", 
                borderRadius: '50%', border: "2px solid var(--app-card-bg)", boxShadow: '0 1px 4px rgba(59,130,246,0.3)'
              }} />
            </div>
          </div>
        );
      },
    },
    {
      title: t.watchlist.signal,
      key: 'signal',
      width: 130,
      render: (_: any, record: WatchlistDisplayItem) => {
        const signal = getSignal(record);
        const displaySignal = translateSignal(signal);
        let color = "var(--app-blue-text, #3b82f6)";
        let bgColor = "var(--app-blue-bg, #eff6ff)";
        if (signal.includes('Bullish')) { color = '#10b981'; bgColor = '#f0fdf4'; }
        else if (signal.includes('Bearish')) { color = '#ef4444'; bgColor = '#fef2f2'; }
        else if (signal.includes('resistance')) { color = '#f59e0b'; bgColor = "var(--app-card-bg-soft)"; }

        return (
          <Tag style={{ 
            borderRadius: 8, fontWeight: 700, padding: '2px 10px', border: 'none', 
            background: bgColor, color, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px'
          }}>
            {displaySignal}
          </Tag>
        );
      },
    },
    {
      title: t.market.sector,
      dataIndex: 'sector',
      key: 'sector',
      width: 120,
      render: (sector: string | null) => (
        <span style={{ fontSize: 12, color: "var(--app-text-muted)", fontWeight: 500 }}>
          {sector ? translateSector(sector) : 'N/A'}
        </span>
      ),
    },
    {
      title: t.watchlist.actions,
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: WatchlistDisplayItem) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            size="small"
            icon={<LineChartOutlined />}
            onClick={() => handleAnalyze(record.symbol)}
            style={{ borderRadius: 8, height: 32, fontWeight: 700, fontSize: 13, background: "var(--app-blue-bg, #3b82f6)" }}
          >
            {t.watchlist.analyze}
          </Button>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunBacktest(record.symbol)}
            style={{ borderRadius: 8, height: 32, fontWeight: 700, fontSize: 13 }}
          >
            {t.watchlist.backtest}
          </Button>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveSymbol(record.symbol)}
            style={{ borderRadius: 8, height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        </div>
      ),
    },
  ];

  const dataSource = useMemo(() => {
    let data = [...watchlistData];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.symbol.toLowerCase().includes(s) || 
        (item.name && item.name.toLowerCase().includes(s))
      );
    }
    if (sortedInfo.columnKey && sortedInfo.order) {
      const key = sortedInfo.columnKey as keyof WatchlistDisplayItem;
      const order = sortedInfo.order;
      data.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (valA == null) return order === 'descend' ? 1 : -1;
        if (valB == null) return order === 'descend' ? -1 : 1;
        if (typeof valA === 'number' && typeof valB === 'number') return order === 'descend' ? valB - valA : valA - valB;
        if (typeof valA === 'string' && typeof valB === 'string') return order === 'descend' ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return 0;
      });
    }
    return data.map(item => ({ key: item.symbol, ...item }));
  }, [watchlistData, searchTerm, sortedInfo]);

  return (
    <div className="watchlist-page-shell">
      <style>{`
        .premium-card {
          border-radius: 18px !important;
          border: 1px solid var(--app-border-soft) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          background: var(--app-card-bg) !important;
          overflow: hidden;
        }
        .metric-card-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .metric-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
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
          right: 18px;
          top: 20px;
          font-size: 22px;
          opacity: 0.1;
          color: #1890ff;
        }
        .watchlist-table .ant-table-thead > tr > th {
          background: var(--app-table-header-bg) !important;
          color: var(--app-text-muted) !important;
          font-weight: 700 !important;
          font-size: 10.5px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid var(--app-border-soft) !important;
        }
        .watchlist-table .ant-table-tbody > tr > td {
          padding: 14px 16px !important;
          border-bottom: 1px solid var(--app-border-soft) !important;
        }
        .watchlist-table .ant-table-tbody > tr:hover > td {
          background: var(--app-table-row-hover-bg, rgba(59, 130, 246, 0.08)) !important;
          background: rgba(24, 144, 255, 0.02) !important;
        }
        .note-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--app-card-bg);
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 12px;
          color: var(--app-text-muted);
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0,0,0,0.01);
        }
      `}</style>

      {/* Header Section */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Title level={1} style={{ margin: 0, fontSize: 'clamp(26px, 2.5vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: "var(--app-text-strong)" }}>{t.watchlist.title}</Title>
          <Text style={{ fontSize: 15, color: "var(--app-text-muted)", display: 'block', marginTop: 4 }}>{t.watchlist.subtitle}</Text>
          <div style={{ marginTop: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: "var(--app-card-bg-soft)", padding: "6px 12px", borderRadius: 10, border: "1px solid var(--app-border-soft)" }}>
              <ThunderboltOutlined style={{ color: "var(--app-blue-text, #3b82f6)" }} />
              <span style={{ fontSize: 13, color: "var(--app-text-muted)", fontWeight: 600 }}>{totalSymbols} <span style={{ color: "var(--app-text-muted)", fontWeight: 500 }}>Symbols</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: "var(--app-card-bg-soft)", padding: "6px 12px", borderRadius: 10, border: "1px solid var(--app-border-soft)" }}>
              <ClockCircleOutlined style={{ color: "var(--app-text-muted)" }} />
              <span style={{ fontSize: 13, color: "var(--app-text-muted)", fontWeight: 600 }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: "var(--app-card-bg-soft)", padding: "6px 12px", borderRadius: 10, border: "1px solid var(--app-border-soft)" }}>
              <RiseOutlined style={{ color: avgChange >= 0 ? '#10b981' : '#ef4444' }} />
              <span style={{ fontSize: 13, color: avgChange >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{avgChange.toFixed(2)}% <span style={{ color: "var(--app-text-muted)", fontWeight: 500, marginLeft: 2 }}>Avg</span></span>
            </div>
          </div>
        </div>
        
        {/* Add Symbol Panel */}
        <div className="premium-card" style={{ width: 360, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 12, color: "var(--app-text-muted)", textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.watchlist.addSymbolToWatchlist}</div>
          <Space.Compact style={{ width: '100%', marginBottom: 10 }}>
            <Input
              placeholder={t.watchlist.symbolPlaceholder}
              prefix={<SearchOutlined style={{ color: "var(--app-text-muted)" }} />}
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              style={{ height: 42, borderRadius: '10px 0 0 10px', borderRight: 0 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSymbol}
              loading={loading}
              style={{ height: 42, borderRadius: '0 10px 10px 0', fontWeight: 700, padding: '0 20px', background: '#2563eb' }}
            >
              {t.watchlist.add}
            </Button>
          </Space.Compact>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: 11, color: "var(--app-text-muted)", fontWeight: 500 }}>Press Enter to add</span>
            <span style={{ fontSize: 11, color: "var(--app-text-muted)", fontWeight: 500 }}>Supports names</span>
          </div>
        </div>
      </div>

      {/* Summary Stats Grid */}
      {watchlistSymbols.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div className="premium-card">
            <div className="metric-card-content">
              <span className="metric-label">{t.watchlist.watchlistSize}</span>
              <span className="metric-value">{totalSymbols}</span>
              <DashOutlined className="metric-icon-bg" />
            </div>
          </div>
          <div className="premium-card">
            <div className="metric-card-content">
              <span className="metric-label">{t.watchlist.gainers}</span>
              <span className="metric-value" style={{ color: '#10b981' }}>{gainers}</span>
              <RiseOutlined className="metric-icon-bg" style={{ color: '#10b981' }} />
            </div>
          </div>
          <div className="premium-card">
            <div className="metric-card-content">
              <span className="metric-label">{t.watchlist.losers}</span>
              <span className="metric-value" style={{ color: '#ef4444' }}>{losers}</span>
              <FallOutlined className="metric-icon-bg" style={{ color: '#ef4444' }} />
            </div>
          </div>
          <div className="premium-card">
            <div className="metric-card-content">
              <span className="metric-label">{t.watchlist.avgPerformance}</span>
              <span className="metric-value" style={{ color: avgChange >= 0 ? '#10b981' : '#ef4444' }}>
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
              </span>
              <LineChartOutlined className="metric-icon-bg" style={{ color: avgChange >= 0 ? '#10b981' : '#ef4444' }} />
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Table Card */}
      <div className="premium-card" style={{ marginBottom: 32 }}>
        <div style={{ padding: '18px 24px', borderBottom: "1px solid var(--app-border-soft)", display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "var(--app-text-strong)" }}>{t.watchlist.watchlistItems}</span>
            <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '0 8px', border: 'none', background: "var(--app-blue-bg, #eff6ff)", color: "var(--app-blue-text, #3b82f6)" }}>{watchlistSymbols.length}</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Input 
              placeholder={t.watchlist.searchWatchlist}
              prefix={<SearchOutlined style={{ color: "var(--app-text-muted)" }} />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: 260, borderRadius: 10, height: 38 }}
              allowClear
            />
            {watchlistSymbols.length > 0 && (
              <Tooltip title={t.watchlist.clickColumnSort}>
                <InfoCircleOutlined style={{ color: '#cbd5e1', cursor: 'help', fontSize: 16 }} />
              </Tooltip>
            )}
          </div>
        </div>

        {watchlistSymbols.length > 0 ? (
          <Table
            className="watchlist-table"
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="middle"
            bordered={false}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '80px 0' }}
            description={
              <div>
                <Title level={4} style={{ marginBottom: 8, color: "var(--app-text-strong)" }}>{t.watchlist.noSymbols}</Title>
                <Text style={{ color: "var(--app-text-muted)" }}>{t.watchlist.addSymbolPrompt}</Text>
                <div style={{ marginTop: 24 }}>
                  <Button type="primary" onClick={() => { setNewSymbol('AAPL'); handleAddSymbol(); }} icon={<PlusOutlined />} style={{ borderRadius: 8, fontWeight: 700, height: 40, padding: '0 24px' }}>
                    {t.watchlist.tryAAPL}
                  </Button>
                </div>
              </div>
            }
          />
        )}
      </div>

      {/* Quick Tips / Help Strip */}
      {watchlistSymbols.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="note-chip">
            <LineChartOutlined style={{ color: "var(--app-blue-text, #3b82f6)" }} />
            <span>{t.watchlist.analyzeTip}</span>
          </div>
          <div className="note-chip">
            <PlayCircleOutlined style={{ color: '#8b5cf6' }} />
            <span>{t.watchlist.backtestTip}</span>
          </div>
          <div className="note-chip">
            <InfoCircleOutlined style={{ color: '#10b981' }} />
            <span>{t.watchlist.sortTip}</span>
          </div>
          <div className="note-chip">
            <ClockCircleOutlined style={{ color: '#f59e0b' }} />
            <span>{t.watchlist.autoSaveTip}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;