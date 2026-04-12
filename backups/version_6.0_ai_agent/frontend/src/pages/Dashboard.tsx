import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Row, Col, Button, Spin, Alert, Empty, Tag, Typography, Space, Progress } from 'antd';
import { ReloadOutlined, DashboardOutlined, RiseOutlined, FallOutlined, LineChartOutlined, EyeOutlined, PieChartOutlined, BarChartOutlined, ClockCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StockData, formatCurrency, safeNumber, safeToFixed } from '../services/marketDataService';
import { sharedDataService } from '../services/sharedDataService';
import DataSourceBadge from '../components/DataSourceBadge';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const { Title, Text } = Typography;

interface MarketStats {
  totalSymbols: number;
  gainers: number;
  losers: number;
  avgChange: number;
  totalMarketCap: number;
  avgVolume: number;
  totalVolume: number;
  largestCapStock: { symbol: string; marketCap: number } | null;
  largestMoveStock: { symbol: string; changePercent: number } | null;
  sectorsCovered: number;
}

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
  const [marketData, setMarketData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  // marketStats现在由useMemo计算，见下方
  const [sectorData, setSectorData] = useState<SectorData[]>([]);

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
      setError(''); // 明确清除错误状态

      console.log('[Dashboard优化] 开始获取市场数据...');
      
      // 使用共享数据服务，避免重复请求
      const stocks = forceRefresh 
        ? await sharedDataService.refreshStocks()
        : await sharedDataService.getStocks();

      // 检查是否获取到有效数据
      if (!stocks || stocks.length === 0) {
        setError('No market data available');
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
      const errorMessage = err.message || 'Failed to load market data';
      setError(errorMessage);

      // 清空数据，避免显示旧数据
      setMarketData([]);
      setSectorData([]);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  // getChangePercent函数已移动到组件顶部，见下方

  const formatChangePercent = (value: number | null): string => {
    if (value === null) return '--';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatVolume = (volume: number | null): string => {
    // Alpaca API可能不提供成交量数据，所以volume可能是null或0
    // 明确告诉用户数据不可用，而不是显示'--'
    if (volume === null || volume === undefined || volume === 0) return 'N/A';
    const num = Number(volume);
    if (isNaN(num) || num === 0) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

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

  const refresh = () => fetchMarketData(true); // 强制刷新，忽略缓存

  useEffect(() => {
    // 组件加载时清除所有错误状态
    setError('');

    // 延迟加载数据，让用户先看到页面框架
    const loadTimer = setTimeout(() => {
      fetchMarketData();
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

  /**
   * 格式化市值显示为缩写格式（如 $14.2T, $1.5B, $750M）
   */
  const formatMarketCap = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) return '--';

    const num = Number(value);
    if (isNaN(num)) return '--';

    // 万亿 (Trillion) - 1万亿 = 1e12
    if (num >= 1e12) {
      const trillions = num / 1e12;
      // 对于万亿级别，显示1位小数，除非是整数
      return `$${trillions.toFixed(trillions >= 100 ? 0 : trillions >= 10 ? 1 : 2)}T`;
    }

    // 十亿 (Billion) - 10亿 = 1e9
    if (num >= 1e9) {
      const billions = num / 1e9;
      // 对于十亿级别，显示1位小数
      return `$${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
    }

    // 百万 (Million) - 1百万 = 1e6
    if (num >= 1e6) {
      const millions = num / 1e6;
      return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
    }

    // 千 (Thousand)
    if (num >= 1e3) {
      const thousands = num / 1e3;
      return `$${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
    }

    // 小于1000
    return `$${num.toFixed(2)}`;
  };

  const StatCard = ({ title, value, icon, color = '#1890ff', suffix = '', formatValue = (v: any) => v, valueColor }: { title: string; value: any; icon: React.ReactNode; color?: string; suffix?: string; formatValue?: (v: any) => string; valueColor?: string }) => (
    <Card
      hoverable
      style={{
        height: '116px',
        borderRadius: '10px',
        border: '1px solid #e8e8e8',
        borderTop: '1px solid #f5f5f5',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)',
        background: '#ffffff',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
          borderColor: '#d4d4d4',
        },
        '&:active': {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)',
        }
      } as any}
      bodyStyle={{
        padding: '22px 18px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1
      }}
    >
      {/* 底部强调线 - 非常克制 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: `linear-gradient(90deg, ${color}20 0%, ${color}10 50%, transparent 100%)`,
        opacity: 0.6,
        transition: 'all 0.25s ease',
        '&:hover': {
          opacity: 0.9,
          height: '3px',
        }
      } as any} />

      {/* 标题行 - 恢复正常易读样式 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <Text type="secondary" style={{
          fontSize: '12px',  // 恢复正常大小
          color: '#595959',  // 恢复正常颜色
          fontWeight: 500,   // 恢复正常字重
          letterSpacing: 'normal',  // 恢复正常字距
          textTransform: 'none',    // 取消全大写
          fontFamily: 'inherit'     // 使用继承字体
        }}>
          {title}
        </Text>
        <span style={{
          color: '#bfbfbf',  // 恢复原颜色
          fontSize: '12px',  // 恢复原大小
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7       // 恢复原透明度
        }}>
          {icon}
        </span>
      </div>

      {/* 数值 - 专业金融仪表板风格 */}
      <div style={{
        fontSize: '24px',    // 减小字号，更克制
        fontWeight: 600,     // 减轻字重，不要太重
        color: valueColor || '#1a1a1a',    // 使用valueColor或默认颜色
        lineHeight: 1.1,     // 略微增加行高
        textAlign: 'left',
        fontFeatureSettings: '"tnum", "ss01", "zero"',  // 添加zero特征
        letterSpacing: '-0.3px',  // 减少负间距
        marginTop: '6px',    // 增加间距，更协调
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",  // 专业字体
        textShadow: '0 1px 1px rgba(0,0,0,0.02)'  // 微妙阴影增加层次感
      }}>
        {formatValue(value)}{suffix}
      </div>
    </Card>
  );

  return (
    <div style={{ padding: '20px 28px', width: '100%', maxWidth: 'none', margin: 0 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col span={24}>
          <Card style={{ padding: '16px 20px', borderRadius: '10px' }} bodyStyle={{ padding: 0 }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space align="center" size={12}>
                  <DashboardOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                  <Space direction="vertical" size={4}>
                    <Title level={3} style={{ margin: 0, fontWeight: 600, fontSize: '20px' }}>Dashboard</Title>
                    <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c' }}>Real-time market overview</Text>
                  </Space>
                </Space>
              </Col>
              <Col>
                <Space align="center" size={12}>
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      <ClockCircleOutlined style={{ marginRight: '4px', fontSize: '11px' }} />
                      {lastFetched ? new Date(lastFetched).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}
                    </Text>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={refresh} loading={loading} size="small">Refresh</Button>
                  </Space>
                  {marketData.length > 0 && marketData[0]?.dataSource ? (
                    <DataSourceBadge source={marketData[0].dataSource} />
                  ) : (
                    <DataSourceBadge source="Alpaca" />
                  )}
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {loading && (
        <Row justify="center" style={{ marginBottom: '24px' }}>
          <Col>
            <Spin size="large" tip="Loading market data..." />
          </Col>
        </Row>
      )}

      {error && (
        <Row style={{ marginBottom: '24px' }}>
          <Col span={24}>
            <Alert message="Error Loading Data" description={error} type="error" showIcon closable onClose={() => setError('')} />
          </Col>
        </Row>
      )}

      {/* 显示API调用失败的消息 */}
      {!loading && !error && marketData.length > 0 && marketData.every(stock => stock.price === null) && (
        <Row style={{ marginBottom: '24px' }}>
          <Col span={24}>
            <Alert 
              message="API Connection Issue" 
              description="Unable to fetch real-time market data. Please check your API configuration. Displaying empty data instead of simulated data." 
              type="warning" 
              showIcon 
            />
          </Col>
        </Row>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '24px',
        marginLeft: '-6px',
        marginRight: '-6px'
      }}>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          <StatCard title="Total Symbols" value={marketStats.totalSymbols} icon={<DatabaseOutlined />} color="#595959" />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          <StatCard title="Market Gainers" value={marketStats.gainers} icon={<RiseOutlined />} color="#52c41a" valueColor="#52c41a" />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          <StatCard title="Market Losers" value={marketStats.losers} icon={<FallOutlined />} color="#ff4d4f" valueColor="#ff4d4f" />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          <StatCard title="Average Change" value={marketStats.avgChange} icon={<LineChartOutlined />} color={marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#595959'} valueColor={marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#595959'} suffix="%" formatValue={(v) => v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)} />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          <StatCard title="Total Market Cap" value={marketStats.totalMarketCap} icon={<BarChartOutlined />} color="#1d39c4" formatValue={formatMarketCap} />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          {/* 自定义 Largest Move 卡片 */}
          <Card
            hoverable
            style={{
              height: '116px',
              borderRadius: '10px',
              border: '1px solid #e8e8e8',
              borderTop: '1px solid #f5f5f5',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)',
              background: '#ffffff',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                borderColor: '#d9d9d9'
              }
            } as any}
            onClick={() => {
              if (marketStats.largestMoveStock) {
                // 点击时跳转到该股票详情
                navigate(`/market?symbol=${marketStats.largestMoveStock.symbol}`);
              }
            }}
          >
            {/* 标题行 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <Text type="secondary" style={{
                fontSize: '12px',
                color: '#595959',
                fontWeight: 500,
                letterSpacing: 'normal',
                textTransform: 'none',
                fontFamily: 'inherit'
              }}>
                Largest Move
              </Text>
              <span style={{
                color: '#bfbfbf',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7
              }}>
                <LineChartOutlined />
              </span>
            </div>

            {/* 内容区域 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              height: 'calc(100% - 28px)'
            }}>
              {/* 股票代码 - 大字体 */}
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: '24px',
                color: '#262626',
                marginBottom: '4px'
              }}>
                {marketStats.largestMoveStock ? marketStats.largestMoveStock.symbol : '--'}
              </div>

              {/* 涨跌幅 - 根据涨跌显示颜色 */}
              {marketStats.largestMoveStock && (
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  lineHeight: '20px',
                  color: marketStats.largestMoveStock.changePercent > 0 ? '#52c41a' : marketStats.largestMoveStock.changePercent < 0 ? '#ff4d4f' : '#595959'
                }}>
                  {marketStats.largestMoveStock.changePercent > 0 ? '+' : ''}{marketStats.largestMoveStock.changePercent.toFixed(2)}%
                </div>
              )}
            </div>
          </Card>
        </div>
        <div style={{ flex: '1 1 0', minWidth: '180px', padding: '0 6px' }}>
          {/* 自定义 Largest Cap 卡片，优化 typography 和 spacing */}
          <Card
            hoverable
            style={{
              height: '116px',
              borderRadius: '10px',
              border: '1px solid #e8e8e8',
              borderTop: '1px solid #f5f5f5',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)',
              background: '#ffffff',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
                borderColor: '#d4d4d4',
              },
              '&:active': {
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)',
              }
            } as any}
            bodyStyle={{
              padding: '22px 18px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1
            }}
          >
            {/* 底部强调线 */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: `linear-gradient(90deg, #59595920 0%, #59595910 50%, transparent 100%)`,
              opacity: 0.6,
              transition: 'all 0.25s ease',
              '&:hover': {
                opacity: 0.9,
                height: '3px',
              }
            } as any} />

            {/* 标题行 - 增大标签，更明显 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'  // 增加间距
            }}>
              <Text type="secondary" style={{
                fontSize: '13px',  // 增大标签字体
                color: '#404040',  // 稍微深一点，更明显
                fontWeight: 600,   // 加重字重
                letterSpacing: '0.1px',
                textTransform: 'none',
                fontFamily: 'inherit'
              }}>
                Largest Cap
              </Text>
              <span style={{
                color: '#bfbfbf',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7
              }}>
                <DatabaseOutlined />
              </span>
            </div>

            {/* 数值行 - 减小数据字体，优化间距 */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',  // NVDA 和 $4.4T 之间的自然间距
              marginTop: '4px'  // 减少顶部间距
            }}>
              {/* 股票代码 */}
              <div style={{
                fontSize: '20px',  // 减小字体
                fontWeight: 600,
                color: '#1a1a1a',
                lineHeight: 1.1,
                fontFeatureSettings: '"tnum", "ss01", "zero"',
                letterSpacing: '-0.2px',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                textShadow: '0 1px 1px rgba(0,0,0,0.02)'
              }}>
                {marketStats.largestCapStock ? marketStats.largestCapStock.symbol : '--'}
              </div>

              {/* 市值 - 更小字体，作为补充信息 */}
              {marketStats.largestCapStock && (
                <div style={{
                  fontSize: '14px',  // 明显小于股票代码
                  fontWeight: 500,
                  color: '#595959',   // 更中性颜色
                  lineHeight: 1.1,
                  fontFeatureSettings: '"tnum", "ss01"',
                  letterSpacing: 'normal',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  opacity: 0.9
                }}>
                  {formatMarketCap(marketStats.largestCapStock.marketCap)}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12} xl={12}>
          <Card
            title={<Space><RiseOutlined style={{ color: '#52c41a' }} /><Text strong>Top Gainers</Text></Space>}
            size="small"
            style={{
              height: '320px',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}
            bodyStyle={{
              padding: '16px 20px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {getTopGainers().length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%',
                padding: '20px'
              }}>
                <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c', textAlign: 'center', lineHeight: 1.4 }}>
                  {marketData.length === 0 ? 'No market data available' : 
                   marketData.every(stock => stock.price === null) ? 'Real-time data unavailable' : 
                   'No advancing stocks in current market session'}
                </Text>
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '8px',
                marginRight: '-8px'
              }}>
                {/* 显示所有上涨股票 */}
                {getTopGainers().map((stock) => {
                  const changePercent = getChangePercent(stock);
                  return (
                    <div key={stock.symbol} style={{
                      padding: '10px 0',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#fafafa'
                      }
                    } as any} onClick={() => handleSymbolClick(stock.symbol)}>
                      <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                        <Col style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                          <Space direction="vertical" size={1} style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.2px' }} ellipsis>{stock.symbol}</Text>
                            <Text type="secondary" style={{ fontSize: '10px', color: '#8c8c8c', fontWeight: 400 }} ellipsis>{stock.name || 'N/A'}</Text>
                          </Space>
                        </Col>
                        <Col style={{ flexShrink: 0 }}>
                          <Space align="center" size={8}>
                            <Text strong style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>${safeNumber(stock.price).toFixed(2)}</Text>
                            <Tag color="green" style={{
                              margin: 0,
                              fontSize: '10px',
                              padding: '2px 8px',
                              fontWeight: 500,
                              borderRadius: '10px',
                              minWidth: '55px',
                              textAlign: 'center'
                            }}>{formatChangePercent(changePercent)}</Tag>
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  );
                })}

                {/* 显示所有上涨股票，无需截断提示 */}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12} xl={12}>
          <Card
            title={<Space><FallOutlined style={{ color: '#ff4d4f' }} /><Text strong>Top Losers</Text></Space>}
            size="small"
            style={{
              height: '320px',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}
            bodyStyle={{
              padding: '16px 20px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {getTopLosers().length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%'
              }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  {marketData.length === 0 ? 'No market data available' : 
                   marketData.every(stock => stock.price === null) ? 'Real-time data unavailable' : 
                   'No losers in current market'}
                </Text>
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '8px',
                marginRight: '-8px'
              }}>
                {/* 显示所有下跌股票，如果超过8条则添加滚动提示 */}
                {getTopLosers().map((stock) => {
                  const changePercent = getChangePercent(stock);
                  return (
                    <div key={stock.symbol} style={{
                      padding: '10px 0',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#fafafa'
                      }
                    } as any} onClick={() => handleSymbolClick(stock.symbol)}>
                      <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                        <Col style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                          <Space direction="vertical" size={1} style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.2px' }} ellipsis>{stock.symbol}</Text>
                            <Text type="secondary" style={{ fontSize: '10px', color: '#8c8c8c', fontWeight: 400 }} ellipsis>{stock.name || 'N/A'}</Text>
                          </Space>
                        </Col>
                        <Col style={{ flexShrink: 0 }}>
                          <Space align="center" size={8}>
                            <Text strong style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>${safeNumber(stock.price).toFixed(2)}</Text>
                            <Tag color="red" style={{
                              margin: 0,
                              fontSize: '10px',
                              padding: '2px 8px',
                              fontWeight: 500,
                              borderRadius: '10px',
                              minWidth: '55px',
                              textAlign: 'center'
                            }}>{formatChangePercent(changePercent)}</Tag>
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  );
                })}

                {/* 显示所有下跌股票，无需截断提示 */}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={10} xl={10}>
          <Card
            title={<Space><PieChartOutlined /><Text strong style={{ fontSize: '15px', fontWeight: 600 }}>Sector Distribution</Text></Space>}
            size="small"
            style={{ height: '300px' }}
            bodyStyle={{
              padding: '16px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {sectorData.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%'
              }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  {marketData.length === 0 ? 'No market data available' : 
                   marketData.every(stock => stock.sector === null || stock.sector === '') ? 'Sector data unavailable' : 
                   'No sector data available'}
                </Text>
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'row',
                gap: '20px',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'flex-start',
                paddingTop: '8px'
              }}>
                {/* 左侧：优化后的环形图 */}
                <div style={{ flex: '0 0 130px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4px' }}>
                  <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sectorData.slice(0, 5)}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={55}
                          paddingAngle={1}
                          dataKey="percentage"
                        >
                          {sectorData.slice(0, 5).map((sector, index) => (
                            <Cell key={`cell-${index}`} fill={getSectorColor(sector.name)} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Weight']}
                          labelFormatter={(label) => `Sector: ${label}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* 中心显示总数 */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f1f1f', lineHeight: 1.2 }}>
                        {marketStats.totalSymbols}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: '2px' }}>
                        Symbols
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右侧：优化后的sector列表 */}
                <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    justifyContent: 'flex-start',
                    paddingTop: '4px'
                  }}>
                    {sectorData.slice(0, 5).map((sector, index) => {
                      const sectorColor = getSectorColor(sector.name);
                      return (
                        <div key={sector.name} style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: '36px',
                          padding: '0 4px',
                          borderBottom: index < Math.min(sectorData.length, 5) - 1 ? '1px solid #f5f5f5' : 'none'
                        }}>
                          {/* 颜色标识 */}
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            backgroundColor: sectorColor,
                            marginRight: '12px',
                            flexShrink: 0
                          }} />

                          {/* sector名称 - 左对齐 */}
                          <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                            <Text style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#1f1f1f',
                              lineHeight: '36px'
                            }} ellipsis>
                              {sector.name}
                            </Text>
                          </div>

                          {/* 权重百分比 - 右对齐 */}
                          <div style={{
                            width: '70px',
                            textAlign: 'right',
                            marginRight: '16px'
                          }}>
                            <Text style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#1f1f1f',
                              lineHeight: '36px'
                            }}>
                              {sector.percentage.toFixed(1)}%
                            </Text>
                          </div>

                          {/* 股票数量 - 右对齐，有适当右边距 */}
                          <div style={{
                            width: '50px',
                            textAlign: 'right',
                            paddingRight: '8px'
                          }}>
                            <Text type="secondary" style={{
                              fontSize: '13px',
                              color: '#595959',
                              fontWeight: 400,
                              lineHeight: '36px'
                            }}>
                              {sector.count}
                            </Text>
                          </div>
                        </div>
                      );
                    })}

                    {/* 如果超过5个sector，显示Other */}
                    {sectorData.length > 5 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '36px',
                        padding: '0 4px',
                        marginTop: '4px',
                        borderTop: '1px solid #f5f5f5'
                      }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '2px',
                          backgroundColor: '#d9d9d9',
                          marginRight: '12px',
                          flexShrink: 0
                        }} />

                        <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                          <Text style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#8c8c8c',
                            lineHeight: '36px'
                          }}>
                            Other
                          </Text>
                        </div>

                        <div style={{
                          width: '70px',
                          textAlign: 'right',
                          marginRight: '16px'
                        }}>
                          <Text style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#8c8c8c',
                            lineHeight: '36px'
                          }}>
                            {sectorData.slice(5).reduce((sum, s) => sum + s.percentage, 0).toFixed(1)}%
                          </Text>
                        </div>

                        <div style={{
                          width: '50px',
                          textAlign: 'right',
                          paddingRight: '8px'
                        }}>
                          <Text type="secondary" style={{
                            fontSize: '13px',
                            color: '#8c8c8c',
                            fontWeight: 400,
                            lineHeight: '36px'
                          }}>
                            {sectorData.slice(5).reduce((sum, s) => sum + s.count, 0)}
                          </Text>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8} xl={7}>
          <Card
            title={<Space><BarChartOutlined /><Text strong style={{ fontSize: '15px', fontWeight: 600 }}>Market Breadth</Text></Space>}
            size="small"
            style={{ height: '300px' }}
            bodyStyle={{
              padding: '16px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingTop: '8px'
            }}>
              {/* 上半部分：紧凑的三列统计 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                {/* Advancing */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#52c41a',
                    lineHeight: 1,
                    marginBottom: '4px'
                  }}>
                    {marketStats.gainers}
                  </div>
                  <Text type="secondary" style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    Advancing
                  </Text>
                </div>

                {/* Declining */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#ff4d4f',
                    lineHeight: 1,
                    marginBottom: '4px'
                  }}>
                    {marketStats.losers}
                  </div>
                  <Text type="secondary" style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    Declining
                  </Text>
                </div>

                {/* Flat */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#666',
                    lineHeight: 1,
                    marginBottom: '4px'
                  }}>
                    {marketStats.totalSymbols - marketStats.gainers - marketStats.losers}
                  </div>
                  <Text type="secondary" style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    Flat
                  </Text>
                </div>
              </div>

              {/* 下半部分：摘要信息区 */}
              <div style={{
                textAlign: 'center',
                paddingTop: '16px',
                borderTop: '1px solid #f0f0f0'
              }}>
                {/* 市场状态标签 */}
                <div style={{ marginBottom: '8px' }}>
                  <Text type="secondary" style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    Market Status
                  </Text>
                  <Tag
                    color={marketStats.avgChange > 0.5 ? 'green' : marketStats.avgChange < -0.5 ? 'red' : 'default'}
                    style={{
                      fontSize: '11px',
                      padding: '3px 10px',
                      marginLeft: '6px',
                      fontWeight: 600,
                      borderRadius: '12px',
                      height: '24px',
                      lineHeight: '18px'
                    }}
                  >
                    {marketStats.avgChange > 0.5 ? 'Bullish' : marketStats.avgChange < -0.5 ? 'Bearish' : 'Neutral'}
                  </Tag>
                </div>

                {/* Average Change */}
                <div>
                  <Text type="secondary" style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: 500,
                    marginRight: '8px'
                  }}>
                    Average Change
                  </Text>
                  <Text strong style={{
                    fontSize: '18px',
                    color: marketStats.avgChange > 0 ? '#52c41a' : marketStats.avgChange < 0 ? '#ff4d4f' : '#666',
                    fontWeight: 600
                  }}>
                    {marketStats.avgChange > 0 ? '+' : ''}{marketStats.avgChange.toFixed(2)}%
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={6} xl={7}>
          <Card
            title={<Space><EyeOutlined /><Text strong style={{ fontSize: '15px', fontWeight: 600 }}>System Status</Text></Space>}
            size="small"
            style={{ height: '300px' }}
            bodyStyle={{
              padding: '16px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              {/* 状态列表 - 专业状态面板 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Market Data */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '40px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <Space align="center" size={10}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#52c41a',
                      boxShadow: '0 0 0 3px #52c41a15'
                    }} />
                    <Text style={{ fontSize: '14px', fontWeight: 600, color: '#1f1f1f' }}>Market Data</Text>
                  </Space>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: marketData.length > 0 && !marketData.every(stock => stock.price === null) ? '#52c41a' : '#faad14',
                    padding: '5px 14px',
                    borderRadius: '12px',
                    width: '80px',
                    textAlign: 'center',
                    letterSpacing: '0.3px',
                    boxSizing: 'border-box'
                  }}>{marketData.length > 0 && !marketData.every(stock => stock.price === null) ? 'LIVE' : 'OFFLINE'}</div>
                </div>

                {/* Quote Feed */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '40px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <Text style={{ fontSize: '14px', fontWeight: 500, color: '#595959' }}>Quote Feed</Text>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: marketData.length > 0 && !marketData.every(stock => stock.price === null) ? '#52c41a' : '#ff4d4f',
                    padding: '5px 14px',
                    borderRadius: '12px',
                    width: '80px',
                    textAlign: 'center',
                    letterSpacing: '0.3px',
                    boxSizing: 'border-box'
                  }}>{marketData.length > 0 && !marketData.every(stock => stock.price === null) ? 'HEALTHY' : 'ERROR'}</div>
                </div>

                {/* Broker Connection */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '40px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <Text style={{ fontSize: '14px', fontWeight: 500, color: '#595959' }}>Broker Connection</Text>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#595959',
                    backgroundColor: '#f5f5f5',
                    padding: '5px 14px',
                    borderRadius: '12px',
                    width: '80px',
                    textAlign: 'center',
                    letterSpacing: '0.3px',
                    border: '1px solid #e8e8e8',
                    boxSizing: 'border-box'
                  }}>PAPER</div>
                </div>

                {/* Symbols Loaded */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '40px'
                }}>
                  <Text style={{ fontSize: '14px', fontWeight: 500, color: '#595959' }}>Symbols Loaded</Text>
                  <Text strong style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#1f1f1f',
                    fontFeatureSettings: '"tnum"'
                  }}>{marketStats.totalSymbols}</Text>
                </div>
              </div>

              {/* 底部信息 - 简洁版本 */}
              <div style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f0f0f0'
              }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    {marketData.length > 0 && marketData[0]?.dataSource ? (
                      <DataSourceBadge source={marketData[0].dataSource} />
                    ) : (
                      <DataSourceBadge source="Alpaca" />
                    )}
                  </Col>
                  <Col>
                    <Text type="secondary" style={{
                      fontSize: '12px',
                      color: '#8c8c8c',
                      fontWeight: 500,
                      paddingRight: '4px'
                    }}>
                      {lastFetched ? new Date(lastFetched).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}
                    </Text>
                  </Col>
                </Row>
              </div>
            </div>
          </Card>
        </Col>
      </Row>



      <Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card title={<Space><EyeOutlined /><Text strong style={{ fontSize: '15px', fontWeight: 600 }}>Watchlist Snapshot</Text></Space>} extra={<Button type="link" size="small" onClick={handleManageWatchlist} style={{ fontSize: '12px', fontWeight: 500 }}>Manage Watchlist</Button>}>
            {getWatchlistSymbols().length === 0 ? (
              <Empty description="Watchlist is empty. Add stocks from Market page or click 'Manage Watchlist'." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : getWatchlistData().length === 0 ? (
              <Empty description="Watchlist stocks not found in current market data. Try refreshing." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[16, 16]}>
                {getWatchlistData().map((stock) => {
                  const changePercent = getChangePercent(stock);
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} xl={4} xxl={3} key={stock.symbol}>
                      <Card size="small" hoverable onClick={() => handleSymbolClick(stock.symbol)} style={{ cursor: 'pointer', height: '140px' }} bodyStyle={{ padding: '12px' }}>
                        {/* 完整一体化信息卡 */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          justifyContent: 'space-between'
                        }}>
                          {/* 顶部区域：Symbol + 涨跌badge */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <Text strong style={{
                              fontSize: '16px',
                              fontWeight: 700,
                              letterSpacing: '-0.2px',
                              lineHeight: 1.2
                            }} ellipsis>{stock.symbol}</Text>
                            <Tag color={changePercent === null ? 'default' : changePercent > 0 ? 'green' : 'red'} style={{
                              margin: 0,
                              fontSize: '10px',
                              padding: '2px 8px',
                              fontWeight: 600,
                              borderRadius: '10px',
                              minWidth: '50px',
                              textAlign: 'center',
                              flexShrink: 0
                            }}>
                              {formatChangePercent(changePercent)}
                            </Tag>
                          </div>

                          {/* 中部区域：公司名 + 价格 */}
                          <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            marginBottom: '8px'
                          }}>
                            <Text type="secondary" style={{
                              fontSize: '11px',
                              color: '#595959',
                              fontWeight: 500,
                              lineHeight: 1.2,
                              marginBottom: '6px'
                            }} ellipsis>{stock.name || 'N/A'}</Text>
                            <Text strong style={{
                              fontSize: '20px',
                              color: '#1890ff',
                              fontWeight: 700,
                              fontFeatureSettings: '"tnum"',
                              lineHeight: 1
                            }}>{stock.price !== null && stock.price !== undefined ? `$${safeToFixed(stock.price, 2)}` : '--'}</Text>
                          </div>

                          {/* 底部区域：Volume + Market Cap - 往上提，去掉分割线 */}
                          <div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end'
                            }}>
                              {/* CHANGE 列 - 显示涨跌额，而不是百分比 */}
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '9px',
                                  color: '#8c8c8c',
                                  fontWeight: 600,
                                  letterSpacing: '0.4px',
                                  textTransform: 'uppercase',
                                  marginBottom: '2px'
                                }}>CHANGE</div>
                                <div style={{
                                  fontSize: '11px',
                                  color: stock.change && stock.change > 0 ? '#237804' : stock.change && stock.change < 0 ? '#a8071a' : '#595959',
                                  fontWeight: 500,
                                  fontFeatureSettings: '"tnum"'
                                }}>
                                  {stock.change !== null && stock.change !== undefined
                                    ? (stock.change > 0 ? '+' : '') + stock.change.toFixed(2)
                                    : '--'}
                                </div>
                              </div>

                              {/* Market Cap 列 */}
                              <div style={{ flex: 1, textAlign: 'right' }}>
                                <div style={{
                                  fontSize: '9px',
                                  color: '#8c8c8c',
                                  fontWeight: 600,
                                  letterSpacing: '0.4px',
                                  textTransform: 'uppercase',
                                  marginBottom: '2px'
                                }}>MKT CAP</div>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#595959',
                                  fontWeight: 500,
                                  fontFeatureSettings: '"tnum"'
                                }}>{formatMarketCap(stock.marketCap)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;