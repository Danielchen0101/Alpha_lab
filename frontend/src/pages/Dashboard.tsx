import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Button, Alert, Tag, Typography, Space, Divider } from 'antd';
import { ReloadOutlined, DashboardOutlined, RiseOutlined, FallOutlined, LineChartOutlined, EyeOutlined, PieChartOutlined, BarChartOutlined, ClockCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StockData, safeNumber, safeToFixed, getDashboardStatus } from '../services/marketDataService';
import { sharedDataService } from '../services/sharedDataService';
import DataSourceBadge from '../components/DataSourceBadge';
import { formatMarketCap } from '../utils/format';
import { useLanguage } from '../contexts/LanguageContext';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const { Title, Text } = Typography;


interface SectorData {
  name: string;
  count: number;
  percentage: number;
}

// 函数声明：提升到组件顶部，避免暂时性死区
function getChangePercent(stock: StockData): number | null {
  // 如果股票数据无效，返回null
  if (!stock || stock.price === null || stock.price === undefined) {
    return null;
  }
  
  // 优先使用changePercent
  if (stock.changePercent !== null && stock.changePercent !== undefined) {
    return stock.changePercent;
  }
  
  // 如果有price和previousClose，计算changePercent
  if (stock.price !== null && stock.previousClose !== null && stock.previousClose !== 0) {
    return ((stock.price - stock.previousClose) / stock.previousClose) * 100;
  }
  
  // 如果有change和previousClose，计算changePercent
  if (stock.change !== null && stock.previousClose !== null && stock.previousClose !== 0) {
    return (stock.change / stock.previousClose) * 100;
  }
  
  return null;
}

const STORAGE_KEY = "quant_watchlist_symbols";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t, translateSector } = useLanguage();
  const [marketData, setMarketData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsConfig, setNeedsConfig] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [, setWatchlist] = useState<any[]>([]);
  // marketStats现在由useMemo计算，见下方
  const [sectorData, setSectorData] = useState<SectorData[]>([]);
  const [systemStatus, setSystemStatus] = useState<{
    marketData: string;
    quoteFeed: string;
    brokerConnection: string;
    environment: string;
  }>({ marketData: 'CONFIG_REQUIRED', quoteFeed: 'CONFIG_REQUIRED', brokerConnection: 'CONFIG_REQUIRED', environment: 'Unknown' });

  // 添加请求锁，防止重复请求
  const [isFetching, setIsFetching] = useState(false);

  // 使用useMemo优化市场统计计算，只在marketData变化时重新计算
  const marketStats = useMemo(() => {
    if (marketData.length === 0) {
      return {
        totalSymbols: 0,
        gainers: 0,
        losers: 0,
        avgChange: 0,
        totalMarketCap: 0,
        avgVolume: 0,
        totalVolume: 0,
        largestCapStock: null,
        largestMoveStock: null,
        sectorsCovered: 0
      };
    }

    const totalSymbols = marketData.length;
    const validChanges = marketData.map(s => getChangePercent(s)).filter(change => change !== null) as number[];
    const gainers = validChanges.filter(change => change > 0).length;
    const losers = validChanges.filter(change => change < 0).length;
    const avgChange = validChanges.length > 0 ? validChanges.reduce((sum, change) => sum + change, 0) / validChanges.length : 0;

    // 简化marketCap计算 - Alpaca可能不提供marketCap，使用价格作为替代
    const validMarketCapStocks = marketData.filter(s => {
      const marketCap = safeNumber(s.marketCap);
      return marketCap !== null && marketCap !== undefined && marketCap > 0;
    });

    // 如果没有marketCap数据，使用价格作为替代指标
    let totalMarketCap = 0;
    if (validMarketCapStocks.length > 0) {
      totalMarketCap = validMarketCapStocks.reduce((sum, s) => sum + safeNumber(s.marketCap || 0), 0);
    } else {
      // 使用价格作为替代，假设每股市值约等于价格的1000倍（简化估算）
      const validPriceStocks = marketData.filter(s => safeNumber(s.price) > 0);
      totalMarketCap = validPriceStocks.reduce((sum, s) => sum + (safeNumber(s.price || 0) * 1000), 0);
    }

    // 调试：输出market cap计算详情
    console.log('[Dashboard调试] Market Cap计算详情:');
    console.log('[Dashboard调试] 有效股票数量:', validMarketCapStocks.length);
    console.log('[Dashboard调试] 每个股票的market cap:');
    validMarketCapStocks.forEach((s, i) => {
      const cap = safeNumber(s.marketCap || 0);
      console.log(`[Dashboard调试] ${i+1}. ${s.symbol}: ${cap} (${cap/1e12}T)`);
    });
    console.log('[Dashboard调试] 计算的总市值:', totalMarketCap);
    console.log('[Dashboard调试] 格式化显示:', `$${totalMarketCap/1e12}T`);

    // 找到最大市值的股票
    const largestCapStock = validMarketCapStocks.length > 0
      ? validMarketCapStocks.reduce((max, s) =>
          safeNumber(s.marketCap || 0) > safeNumber(max.marketCap || 0) ? s : max
        )
      : null;

    // 找到最大涨跌幅的股票
    const largestMoveStock = marketData.length > 0
      ? marketData.reduce((max, s) => {
          const change = getChangePercent(s);
          const maxChange = getChangePercent(max);
          return (change !== null && maxChange !== null && Math.abs(change) > Math.abs(maxChange)) ? s : max;
        })
      : null;

    // 计算成交量
    const validVolumeStocks = marketData.filter(s => safeNumber(s.volume) > 0);
    const totalVolume = validVolumeStocks.reduce((sum, s) => sum + safeNumber(s.volume || 0), 0);
    const avgVolume = validVolumeStocks.length > 0 ? totalVolume / validVolumeStocks.length : 0;

    // 计算覆盖的行业数量 - Alpaca可能不提供sector/industry
    const sectors = new Set(marketData.map(s => s.sector).filter(Boolean));
    const sectorsCovered = sectors.size;

    // 计算sector分布 - 对Alpaca数据更友好
    const sectorMap: Record<string, number> = {};
    marketData.forEach(stock => {
      const sector = stock.sector || stock.industry || 'General';
      if (sector && sector !== 'Unknown' && sector !== 'None' && sector !== 'N/A') {
        sectorMap[sector] = (sectorMap[sector] || 0) + 1;
      }
    });

    // 更新sectorData
    if (Object.keys(sectorMap).length === 0) {
      // 如果没有sector数据，显示通用分类
      const total = marketData.length;
      const sectorArray: SectorData[] = [
        { name: 'Stocks', count: total, percentage: 100 }
      ];
      setSectorData(sectorArray);
    } else {
      const total = marketData.length;
      const sectorArray: SectorData[] = Object.entries(sectorMap)
        .map(([name, count]) => ({
          name,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      setSectorData(sectorArray);
    }

    return {
      totalSymbols,
      gainers,
      losers,
      avgChange,
      totalMarketCap,
      avgVolume,
      totalVolume,
      largestCapStock: largestCapStock ? {
        symbol: largestCapStock.symbol,
        marketCap: safeNumber(largestCapStock.marketCap || 0)
      } : null,
      largestMoveStock: largestMoveStock ? {
        symbol: largestMoveStock.symbol,
        changePercent: getChangePercent(largestMoveStock) || 0
      } : null,
      sectorsCovered
    };
  }, [marketData]);

  // 移除旧的marketStats状态，改用useMemo计算
  // const [marketStats, setMarketStats] = useState<MarketStats>({ ... });

  const fetchMarketData = async (forceRefresh = false) => {
    // 如果已经在请求中，直接返回
    if (isFetching && !forceRefresh) {
      console.log('[Dashboard优化] 请求已在进行中，跳过重复请求');
      return;
    }

    try {
      setIsFetching(true);
      setLoading(true);
      setError('');
      setNeedsConfig(false);
      setNeedsAuth(false);

      console.log('[Dashboard优化] 开始获取市场数据...');

      // 使用共享数据服务，避免重复请求
      const stocks = forceRefresh
        ? await sharedDataService.refreshStocks()
        : await sharedDataService.getStocks();

      // 检查是否获取到有效数据
      if (!stocks || stocks.length === 0) {
        setError(t.dashboard.noMarketData);
        setMarketData([]);
        setSectorData([]);
      } else {
        // 成功获取数据
        console.log('[Dashboard优化] 成功获取数据:', {
          股票数量: stocks.length,
          数据源: stocks[0]?.dataSource || 'Alpaca',
          缓存有效: sharedDataService.isCacheValid()
        });
        setMarketData(stocks);
        setLastFetched(Date.now());
      }
    } catch (err: any) {
      console.error('[Dashboard优化] 获取市场数据失败:', err);
      const errorMessage = err.message || t.dashboard.errorLoading;
      const errorCode = err.code || '';
      setError(errorMessage);
      setNeedsAuth(false);
      setNeedsConfig(false);
      if (errorCode === 'AUTH_REQUIRED' || errorMessage.includes('Authentication required')) {
        setNeedsAuth(true);
      } else if (errorCode === 'CONFIG_REQUIRED' || errorMessage.includes('not configured') || errorMessage.includes('needsConfig') || errorMessage.includes('Configuration required')) {
        setNeedsConfig(true);
      }

      // 清空数据，避免显示旧数据
      setMarketData([]);
      setSectorData([]);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  // getChangePercent函数已移动到组件顶部，见下方


  // calculateMarketStats函数已由useMemo替代，见上方marketStats计算

  const getTopGainers = () => {
    console.log(`[调试] getTopGainers: marketData长度=${marketData.length}`);
    const gainers = [...marketData].filter(s => {
      const change = getChangePercent(s);
      const isGainer = change !== null && change > 0;
      console.log(`[调试] ${s.symbol}: change=${change}, isGainer=${isGainer}`);
      return isGainer;
    }).sort((a, b) => {
      const changeA = getChangePercent(a) || 0;
      const changeB = getChangePercent(b) || 0;
      return changeB - changeA;
    });
    console.log(`[调试] getTopGainers结果:`, gainers.map(g => ({symbol: g.symbol, changePercent: g.changePercent})));
    return gainers;
  };

  const getTopLosers = () => {
    console.log(`[调试] getTopLosers: marketData长度=${marketData.length}`);
    const losers = [...marketData].filter(s => {
      const change = getChangePercent(s);
      const isLoser = change !== null && change < 0;
      console.log(`[调试] ${s.symbol}: change=${change}, isLoser=${isLoser}`);
      return isLoser;
    }).sort((a, b) => {
      const changeA = getChangePercent(a) || 0;
      const changeB = getChangePercent(b) || 0;
      return changeA - changeB;
    });
    console.log(`[调试] getTopLosers结果:`, losers.map(l => ({symbol: l.symbol, changePercent: l.changePercent})));
    return losers;
  };
  const getWatchlistSymbols = () => {
    // 直接从localStorage读取symbol数组
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    
    try {
      const watchlistSymbols = JSON.parse(saved);
      if (!Array.isArray(watchlistSymbols)) return [];
      
      // 标准化symbols（大写、去空格）
      return watchlistSymbols.map(s => String(s).toUpperCase().trim());
    } catch (err) {
      console.error('Failed to parse watchlist symbols:', err);
      return [];
    }
  };

  const getWatchlistData = () => {
    // 用当前真实marketData过滤映射watchlist symbols
    const watchlistSymbols = getWatchlistSymbols();
    
    // 用当前真实marketData过滤映射
    return marketData
      .filter(stock => watchlistSymbols.includes(stock.symbol.toUpperCase().trim()))
      .slice(0, 8); // 最多显示8个
  };

  const refresh = () => {
    fetchMarketData(true); // 强制刷新，忽略缓存
    fetchSystemStatus();
  };

  // 获取系统状态（per-user config state）
  const fetchSystemStatus = async () => {
    try {
      const status = await getDashboardStatus();
      setSystemStatus(status);
    } catch {
      // Keep default CONFIG_REQUIRED state
    }
  };

  useEffect(() => {
    // 组件加载时清除所有错误状态
    setError('');

    // 延迟加载数据，让用户先看到页面框架
    const loadTimer = setTimeout(() => {
      fetchMarketData();
      fetchSystemStatus();
    }, 100); // 100ms延迟，足够渲染初始界面

    // 从localStorage加载watchlist symbols（仅用于初始化状态）
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // 只存储symbols用于状态跟踪，实际数据从getWatchlistData()获取
          setWatchlist(parsed.map(s => ({ symbol: String(s).toUpperCase().trim() })));
        }
      } catch (err) {
        console.error('Failed to parse watchlist from localStorage:', err);
        // watchlist解析失败不是关键错误，不设置全局error
      }
    }

    // 清理定时器
    return () => {
      clearTimeout(loadTimer);
    };
  }, []);

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

  const handleSymbolClick = (symbol: string) => navigate(`/analysis/${symbol}`);
  const handleManageWatchlist = () => navigate('/watchlist');

  // 专业金融面板sector颜色映射函数
  // 每个sector都有独特且稳定的颜色，donut图和legend颜色一一对应
  const getSectorColor = (sectorName: string): string => {
    const lowerName = sectorName.toLowerCase();

    // 1. 优先处理常见且重要的sector（根据你的要求）
    // Technology - 蓝色，科技感
    if (lowerName.includes('technology') || lowerName === 'tech') {
      return '#1890ff';
    }
    // Semiconductors - 深蓝色，与Technology区分但相关
    if (lowerName.includes('semiconductor')) {
      return '#2f54eb';
    }
    // Banking - 绿色，金融稳定
    if (lowerName.includes('banking') || lowerName === 'bank') {
      return '#52c41a';
    }
    // Automobiles - 橙色，工业感
    if (lowerName.includes('automobile') || lowerName.includes('auto')) {
      return '#fa8c16';
    }
    // Financial Services - 青色，与Banking区分但相关
    if (lowerName.includes('financial services') || lowerName.includes('financial')) {
      return '#13c2c2';
    }

    // 2. 其他常见sector
    // Communications/Media - 紫色
    if (lowerName.includes('communication') || lowerName.includes('media')) {
      return '#722ed1';
    }
    // Retail/Consumer - 粉色
    if (lowerName.includes('retail') || lowerName.includes('consumer')) {
      return '#eb2f96';
    }
    // Healthcare - 亮粉色
    if (lowerName.includes('health') || lowerName.includes('medical')) {
      return '#f759ab';
    }
    // Energy - 红色橙色
    if (lowerName.includes('energy') || lowerName.includes('oil') || lowerName.includes('gas')) {
      return '#fa541c';
    }
    // Industrials - 中蓝色
    if (lowerName.includes('industrial') || lowerName.includes('manufactur')) {
      return '#597ef7';
    }
    // Real Estate - 亮紫色
    if (lowerName.includes('real estate') || lowerName.includes('estate')) {
      return '#9254de';
    }
    // Utilities - 亮绿色
    if (lowerName.includes('utilit')) {
      return '#a0d911';
    }
    // Materials - 深紫色
    if (lowerName.includes('material')) {
      return '#531dab';
    }
    // Information Technology - 天蓝色
    if (lowerName.includes('information')) {
      return '#69c0ff';
    }

    // 3. 稳定颜色映射表 - 确保相同sector总是得到相同颜色
    // 即使sector数量变化，颜色也不会随机重复
    const stableColorMap: Record<string, string> = {
      // 已定义的sector
      'technology': '#1890ff',
      'tech': '#1890ff',
      'semiconductors': '#2f54eb',
      'semiconductor': '#2f54eb',
      'banking': '#52c41a',
      'bank': '#52c41a',
      'automobiles': '#fa8c16',
      'automobile': '#fa8c16',
      'auto': '#fa8c16',
      'financial services': '#13c2c2',
      'financial': '#13c2c2',
      'communications': '#722ed1',
      'communication': '#722ed1',
      'media': '#722ed1',
      'retail': '#eb2f96',
      'consumer': '#eb2f96',
      'healthcare': '#f759ab',
      'health': '#f759ab',
      'medical': '#f759ab',
      'energy': '#fa541c',
      'oil': '#fa541c',
      'gas': '#fa541c',
      'industrials': '#597ef7',
      'industrial': '#597ef7',
      'manufacturing': '#597ef7',
      'real estate': '#9254de',
      'estate': '#9254de',
      'utilities': '#a0d911',
      'utility': '#a0d911',
      'materials': '#531dab',
      'material': '#531dab',
      'information technology': '#69c0ff',
      'information': '#69c0ff',

      // 其他可能出现的sector
      'telecommunications': '#7cb305',
      'insurance': '#08979c',
      'pharmaceuticals': '#d4380d',
      'biotechnology': '#d46b08',
      'software': '#096dd9',
      'hardware': '#1d39c4',
      'internet': '#10239e',
      'e-commerce': '#c41d7f',
      'entertainment': '#9e1068',
      'transportation': '#ad8b00',
      'logistics': '#ad6800',
      'construction': '#5c3811',
      'agriculture': '#389e0d',
      'defense': '#003a8c',
      'aerospace': '#00474f',
    };

    // 首先检查精确匹配
    if (stableColorMap[lowerName]) {
      return stableColorMap[lowerName];
    }

    // 然后检查包含关系
    for (const [key, color] of Object.entries(stableColorMap)) {
      if (lowerName.includes(key)) {
        return color;
      }
    }

    // 最后，使用稳定的哈希算法确保相同sector总是得到相同颜色
    const stableColors = [
      '#1890ff', '#2f54eb', '#52c41a', '#fa8c16', '#13c2c2', '#722ed1', '#eb2f96',
      '#f759ab', '#fa541c', '#597ef7', '#9254de', '#a0d911', '#531dab', '#69c0ff',
      '#7cb305', '#08979c', '#d4380d', '#d46b08', '#096dd9', '#1d39c4'
    ];

    // 稳定的哈希函数
    let hash = 0;
    for (let i = 0; i < sectorName.length; i++) {
      hash = ((hash << 5) - hash) + sectorName.charCodeAt(i);
      hash = hash & hash; // 转换为32位整数
    }
    hash = Math.abs(hash);

    return stableColors[hash % stableColors.length];
  };

  return (
    <div className="dashboard-container" style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      <style>{`
        .dashboard-container {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .premium-card {
          border-radius: 12px !important;
          border: 1px solid #f0f0f0 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          background: #fff !important;
        }
        .premium-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important;
          transform: translateY(-2px) !important;
          border-color: #e6e6e6 !important;
        }
        .metric-card {
          padding: 20px !important;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
        }
        .metric-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #8c8c8c;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .metric-value {
          font-size: 24px;
          font-weight: 800;
          color: #1a1a1a;
          line-height: 1.1;
          font-family: 'SF Pro Display', -apple-system, system-ui, sans-serif;
        }
        .metric-icon {
          position: absolute;
          right: 20px;
          top: 20px;
          font-size: 20px;
          opacity: 0.15;
          color: #1890ff;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
        }
        .empty-state-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px 20px;
          text-align: center;
        }
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          font-weight: 700 !important;
        }
        .refresh-btn:hover {
          transform: rotate(30deg);
        }
      `}</style>

      {/* ── Dashboard Header ── */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ 
              width: 36, height: 36, borderRadius: '8px', background: 'linear-gradient(135deg, #1890ff 0%, #003a8c 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20,
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
            }}>
              <DashboardOutlined />
            </div>
            <Title level={1} style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>{t.dashboard.title}</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 14, marginLeft: 48 }}>{t.dashboard.subtitle}</Text>
        </div>
        <Space size={16}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t.dashboard.lastUpdated}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
              {lastFetched ? new Date(lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
            </div>
          </div>
          <Button 
            type="primary" 
            icon={<ReloadOutlined className={loading ? 'anticon-spin' : ''} />} 
            onClick={refresh} 
            loading={loading}
            style={{ borderRadius: '8px', fontWeight: 600, height: 40, padding: '0 20px' }}
          >
            {t.dashboard.refreshData}
          </Button>
          {marketData.length > 0 && marketData[0]?.dataSource && (
            <DataSourceBadge source={marketData[0].dataSource} />
          )}
        </Space>
      </div>

      {/* ── Warnings & Alerts ── */}
      {(needsAuth || needsConfig || error || (marketData.length > 0 && marketData.every(stock => stock.price === null))) && (
        <div style={{ marginBottom: 24 }}>
          {needsAuth && (
            <Alert
              message={<Text strong>{t.dashboard.authRequired}</Text>}
              description={t.dashboard.authRequiredDesc}
              type="warning"
              showIcon
              style={{ borderRadius: 10, border: '1px solid #ffe58f', background: '#fffbe6' }}
            />
          )}
          {needsConfig && !needsAuth && (
            <Alert
              message={<Text strong>{t.dashboard.apiConfigRequired}</Text>}
              description={t.dashboard.apiConfigRequiredDesc}
              type="warning"
              showIcon
              action={<Button size="small" type="primary" onClick={() => navigate('/configuration')}>{t.dashboard.configure}</Button>}
              style={{ borderRadius: 10, border: '1px solid #ffe58f', background: '#fffbe6' }}
            />
          )}
          {error && !needsAuth && !needsConfig && (
            <Alert
              message={<Text strong>{error.includes('Network Error') || error.includes('ECONNREFUSED') ? t.dashboard.backendConnectionError : t.dashboard.apiError}</Text>}
              description={error.includes('Network Error') || error.includes('ECONNREFUSED') ? t.dashboard.backendConnectionErrorDesc : error}
              type="error"
              showIcon
              style={{ borderRadius: 10, marginTop: 12 }}
            />
          )}
          {!loading && !error && !needsAuth && !needsConfig && marketData.length > 0 && marketData.every(stock => stock.price === null) && (
            <Alert
              message={<Text strong>{t.dashboard.apiError}</Text>}
              description={t.dashboard.apiNoPricesDesc}
              type="warning"
              showIcon
              action={<Button size="small" onClick={() => navigate('/configuration')}>{t.dashboard.checkConfig}</Button>}
              style={{ borderRadius: 10, border: '1px solid #ffe58f', background: '#fffbe6', marginTop: 12 }}
            />
          )}
        </div>
      )}

      {/* ── Summary Metrics Grid ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.totalSymbols}</span>
              <span className="metric-value">{marketStats.totalSymbols || '—'}</span>
              <DatabaseOutlined className="metric-icon" />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.gainers}</span>
              <span className="metric-value" style={{ color: '#52c41a' }}>{marketStats.gainers || '0'}</span>
              <RiseOutlined className="metric-icon" style={{ color: '#52c41a' }} />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.losers}</span>
              <span className="metric-value" style={{ color: '#ff4d4f' }}>{marketStats.losers || '0'}</span>
              <FallOutlined className="metric-icon" style={{ color: '#ff4d4f' }} />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.avgChange}</span>
              <span className="metric-value" style={{ color: marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#1a1a1a' }}>
                {marketStats.avgChange !== 0 ? (marketStats.avgChange > 0 ? '+' : '') + marketStats.avgChange.toFixed(2) + '%' : '0.00%'}
              </span>
              <LineChartOutlined className="metric-icon" />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.mktCap}</span>
              <span className="metric-value">{formatMarketCap(marketStats.totalMarketCap)}</span>
              <BarChartOutlined className="metric-icon" style={{ color: '#2f54eb' }} />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            <div className="metric-card">
              <span className="metric-label">{t.dashboard.largestMove}</span>
              <span className="metric-value" style={{ fontSize: 18 }}>
                {marketStats.largestMoveStock ? marketStats.largestMoveStock.symbol : '—'}
                {marketStats.largestMoveStock && (
                  <span style={{ fontSize: 13, marginLeft: 6, color: marketStats.largestMoveStock.changePercent > 0 ? '#52c41a' : '#ff4d4f' }}>
                    ({marketStats.largestMoveStock.changePercent > 0 ? '+' : ''}{marketStats.largestMoveStock.changePercent.toFixed(1)}%)
                  </span>
                )}
              </span>
              <RiseOutlined className="metric-icon" />
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Market Movers ── */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={12}>
          <Card 
            className="premium-card" 
            title={<span style={{ fontWeight: 700, fontSize: 15 }}><RiseOutlined style={{ color: '#52c41a', marginRight: 8 }} />{t.dashboard.topGainers}</span>}
            bodyStyle={{ padding: '8px 0', minHeight: 340 }}
          >
            {getTopGainers().length === 0 ? (
              <div className="empty-state-container">
                <RiseOutlined style={{ fontSize: 32, color: '#f0f0f0', marginBottom: 12 }} />
                <Text strong style={{ color: '#bfbfbf' }}>{t.dashboard.noGainersFound}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{t.dashboard.configureMarketData}</Text>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                {getTopGainers().slice(0, 6).map((stock, i) => (
                  <div key={stock.symbol} onClick={() => handleSymbolClick(stock.symbol)} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0',
                    borderBottom: i === 5 ? 'none' : '1px solid #f5f5f5', cursor: 'pointer'
                  }}>
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: 14 }}>{stock.symbol}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{stock.name || 'N/A'}</Text>
                    </Space>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>${safeToFixed(stock.price, 2)}</div>
                      <Tag color="green" style={{ margin: 0, borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                        +{getChangePercent(stock)?.toFixed(2)}%
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            className="premium-card" 
            title={<span style={{ fontWeight: 700, fontSize: 15 }}><FallOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />{t.dashboard.topLosers}</span>}
            bodyStyle={{ padding: '8px 0', minHeight: 340 }}
          >
            {getTopLosers().length === 0 ? (
              <div className="empty-state-container">
                <FallOutlined style={{ fontSize: 32, color: '#f0f0f0', marginBottom: 12 }} />
                <Text strong style={{ color: '#bfbfbf' }}>{t.dashboard.noLosersFound}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{t.dashboard.configureMarketData}</Text>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                {getTopLosers().slice(0, 6).map((stock, i) => (
                  <div key={stock.symbol} onClick={() => handleSymbolClick(stock.symbol)} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0',
                    borderBottom: i === 5 ? 'none' : '1px solid #f5f5f5', cursor: 'pointer'
                  }}>
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: 14 }}>{stock.symbol}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{stock.name || 'N/A'}</Text>
                    </Space>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>${safeToFixed(stock.price, 2)}</div>
                      <Tag color="red" style={{ margin: 0, borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                        {getChangePercent(stock)?.toFixed(2)}%
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Mid-level Analytics ── */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={10}>
          <Card 
            className="premium-card" 
            title={<span style={{ fontWeight: 700, fontSize: 15 }}><PieChartOutlined style={{ marginRight: 8 }} />{t.dashboard.sectorDistribution}</span>}
            bodyStyle={{ height: 320, padding: 24 }}
          >
            {sectorData.length === 0 ? (
              <div className="empty-state-container">
                <PieChartOutlined style={{ fontSize: 32, color: '#f0f0f0', marginBottom: 12 }} />
                <Text type="secondary">{t.dashboard.sectorDataUnavailable}</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                <div style={{ width: '50%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="percentage"
                      >
                        {sectorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getSectorColor(entry.name)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, translateSector(name)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '50%', paddingLeft: 20 }}>
                  {sectorData.slice(0, 5).map(sector => (
                    <div key={sector.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Space size={8}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: getSectorColor(sector.name) }} />
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>{translateSector(sector.name)}</Text>
                      </Space>
                      <Text strong style={{ fontSize: 12 }}>{sector.percentage.toFixed(1)}%</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={7}>
          <Card 
            className="premium-card" 
            title={<span style={{ fontWeight: 700, fontSize: 15 }}><BarChartOutlined style={{ marginRight: 8 }} />{t.dashboard.marketBreadth}</span>}
            bodyStyle={{ height: 320, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{t.dashboard.advancingVsDeclining}</div>
              <Row gutter={16} align="middle" justify="center">
                <Col>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#52c41a' }}>{marketStats.gainers}</div>
                  <Text type="secondary" style={{ fontSize: 10, fontWeight: 700 }}>{t.dashboard.up}</Text>
                </Col>
                <Col>
                  <Divider type="vertical" style={{ height: 40, borderLeft: '2px solid #f0f0f0' }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#ff4d4f' }}>{marketStats.losers}</div>
                  <Text type="secondary" style={{ fontSize: 10, fontWeight: 700 }}>{t.dashboard.down}</Text>
                </Col>
              </Row>
            </div>
            <div style={{ background: '#fafafa', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#595959' }}>{t.dashboard.overallStatus}</Text>
                <Tag color={marketStats.avgChange > 0 ? 'green' : marketStats.avgChange < 0 ? 'red' : 'default'} style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                  {marketStats.avgChange > 0.5 ? t.dashboard.bullish : marketStats.avgChange < -0.5 ? t.dashboard.bearish : t.dashboard.neutral}
                </Tag>
              </div>
              <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ height: '100%', background: '#52c41a', width: `${marketStats.totalSymbols > 0 ? (marketStats.gainers / marketStats.totalSymbols) * 100 : 0}%` }} />
                <div style={{ height: '100%', background: '#ff4d4f', width: `${marketStats.totalSymbols > 0 ? (marketStats.losers / marketStats.totalSymbols) * 100 : 0}%` }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={7}>
          <Card 
            className="premium-card" 
            title={<span style={{ fontWeight: 700, fontSize: 15 }}><DatabaseOutlined style={{ marginRight: 8 }} />{t.dashboard.systemStatus}</span>}
            bodyStyle={{ height: 320, padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
              {[
                { label: t.dashboard.marketData, status: systemStatus.marketData },
                { label: t.dashboard.quoteFeed, status: systemStatus.quoteFeed },
                { label: t.dashboard.brokerConnection, status: systemStatus.brokerConnection },
                { label: t.dashboard.symbols, status: marketStats.totalSymbols.toString(), isTag: false }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>{item.label}</Text>
                  {item.isTag === false ? (
                    <Text strong style={{ fontSize: 14 }}>{item.status}</Text>
                  ) : (
                    <Tag color={item.status === 'ONLINE' || item.status === 'HEALTHY' ? 'success' : item.status === 'PAPER' || item.status === 'LIVE' ? 'blue' : item.status === 'CONFIG_REQUIRED' || item.status === 'AUTH_REQUIRED' ? 'warning' : 'error'}
                         style={{ margin: 0, fontWeight: 700, borderRadius: 4, fontSize: 10 }}>
                      {item.status === 'CONFIG_REQUIRED' ? t.dashboard.configRequired : item.status === 'AUTH_REQUIRED' ? t.dashboard.signIn : item.status}
                    </Tag>
                  )}
                </div>
              ))}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ background: '#f9f9f9', padding: '10px 12px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{t.dashboard.environment}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: systemStatus.marketData === 'CONFIG_REQUIRED' || systemStatus.marketData === 'AUTH_REQUIRED' ? '#faad14' : '#1890ff' }} />
                  <Text strong style={{ fontSize: 12 }}>{systemStatus.environment || 'Unknown'}</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Watchlist Snapshot ── */}
      <Card 
        className="premium-card" 
        title={<span style={{ fontWeight: 700, fontSize: 16 }}><EyeOutlined style={{ color: '#1890ff', marginRight: 8 }} />{t.dashboard.watchlistSnapshot}</span>}
        extra={<Button type="link" onClick={handleManageWatchlist} style={{ fontWeight: 600 }}>{t.dashboard.manageAll}</Button>}
      >
        {getWatchlistSymbols().length === 0 ? (
          <div className="empty-state-container">
            <EyeOutlined style={{ fontSize: 32, color: '#f0f0f0', marginBottom: 12 }} />
            <Text type="secondary">{t.dashboard.watchlistEmpty}</Text>
            <Button type="link" onClick={() => navigate('/market')} style={{ marginTop: 8 }}>{t.dashboard.exploreMarket}</Button>
          </div>
        ) : getWatchlistData().length === 0 ? (
          <div className="empty-state-container">
            <ReloadOutlined style={{ fontSize: 32, color: '#f0f0f0', marginBottom: 12 }} />
            <Text type="secondary">{t.dashboard.waitingForData}</Text>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {getWatchlistData().map((stock) => {
              const change = getChangePercent(stock);
              return (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={stock.symbol}>
                  <Card 
                    hoverable 
                    onClick={() => handleSymbolClick(stock.symbol)}
                    bodyStyle={{ padding: '16px' }}
                    style={{ borderRadius: 10, border: '1px solid #f0f0f0', background: '#fafafa' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 15 }}>{stock.symbol}</Text>
                      <Tag color={change && change > 0 ? 'green' : change && change < 0 ? 'red' : 'default'} style={{ margin: 0, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {change !== null ? (change > 0 ? '+' : '') + change.toFixed(1) + '%' : '—'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>
                      ${safeToFixed(stock.price, 2)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{stock.name || 'N/A'}</Text>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;