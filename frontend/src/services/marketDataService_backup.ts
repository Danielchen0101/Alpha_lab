/**
 * 市场数据服务层 - 专门负责从 Polygon.io 获取市场数据
 * 这一层只负责：看市场、拿行情数据、格式转换、缓存
 * 不包含任何交易执行逻辑
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8889/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========== 类型定义 ==========

export interface StockData {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  currency: string;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  dataSource: string;
  timestamp: string;
  error?: string;
  peRatio?: number | null;
  dividendYield?: number | null;
  yearHigh?: number | null;
  yearLow?: number | null;
}

export interface HistoricalDataPoint {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataResponse {
  symbol: string;
  interval: string;
  range: string;
  data: HistoricalDataPoint[];
  count: number;
  dataSource: string;
  timestamp: string;
}

export interface TickerInfo {
  symbol: string;
  name: string;
  market: string;
  locale: string;
  currency: string;
  active: boolean;
  primaryExch: string;
  type: string;
  updated: string;
}

export interface TimeframeConfig {
  interval: string;
  range: string;
  label: string;
  dataPoints: number;
}

// ========== 时间框架配置 ==========

export const TIMEFRAMES: Record<string, TimeframeConfig> = {
  '1D': {
    interval: '5min',
    range: '1day',
    label: '1 Day',
    dataPoints: 78, // 6.5小时交易时间，每5分钟一个点
  },
  '1W': {
    interval: '1day',
    range: '1week',
    label: '1 Week',
    dataPoints: 5, // 5个交易日
  },
  '1M': {
    interval: '1day',
    range: '1month',
    label: '1 Month',
    dataPoints: 20, // 约20个交易日
  },
  '3M': {
    interval: '1day',
    range: '3month',
    label: '3 Months',
    dataPoints: 60, // 约60个交易日
  },
  '1Y': {
    interval: '1day',
    range: '1year',
    label: '1 Year',
    dataPoints: 252, // 约252个交易日
  },
};

// ========== 核心API方法 ==========

/**
 * 获取股票列表
 * @param symbols 股票代码列表（可选，默认使用常用股票）
 */
export const getStocks = async (symbols?: string[]): Promise<StockData[]> => {
  try {
    const params: any = {};
    if (symbols && symbols.length > 0) {
      params.symbols = symbols.join(',');
    }
    
    const response = await api.get('/market/stocks', { params });
    
    if (response.data && response.data.stocks) {
      return response.data.stocks as StockData[];
    }
    
    return [];
  } catch (error) {
    console.error('获取股票列表失败:', error);
    throw new Error('无法获取市场数据');
  }
};

/**
 * 获取单个股票详细信息
 * @param symbol 股票代码
 */
export const getStockData = async (symbol: string): Promise<StockData> => {
  try {
    // 首先尝试直接获取单个股票数据
    try {
      const response = await api.get(`/market/stock/${symbol}`);
      
      if (response.data && !response.data.error) {
        return response.data as StockData;
      }
    } catch (directError) {
      const error = directError as Error;
      console.log(`直接获取 ${symbol} 数据失败，尝试从股票列表中获取:`, error.message);
    }
    
    // 如果直接获取失败，尝试从股票列表中过滤
    const stocksResponse = await api.get(`/market/stocks`);
    
    if (stocksResponse.data && stocksResponse.data.stocks) {
      const stock = stocksResponse.data.stocks.find((s: any) => s.symbol === symbol);
      if (stock) {
        // 确保返回的数据有正确的dataSource字段
        return {
          ...stock,
          dataSource: stock.dataSource || stocksResponse.data.source || 'Yahoo Finance',
          timestamp: new Date().toISOString(),
          currency: 'USD'
        } as StockData;
      }
    }
    
    throw new Error(`股票 ${symbol} 未找到`);
  } catch (error: any) {
    console.error(`获取股票 ${symbol} 数据失败:`, error);
    throw new Error(error.response?.data?.error || error.message || '获取股票数据失败');
  }
};

/**
 * 获取股票历史价格数据
 * @param symbol 股票代码
 * @param timeframe 时间框架 (1D, 1W, 1M, 3M, 1Y)
 */
export const getStockHistory = async (
  symbol: string, 
  timeframe: string = '1M'
): Promise<HistoricalDataResponse> => {
  try {
    const config = TIMEFRAMES[timeframe] || TIMEFRAMES['1M'];
    
    // 首先尝试直接获取历史数据
    try {
      const response = await api.get(`/market/history/${symbol}`, {
        params: {
          interval: config.interval,
          range: config.range,
        },
      });
      
      if (response.data) {
        // 处理后端字段名不匹配问题
        const data = response.data;
        return {
          ...data,
          symbol,
          interval: config.interval,
          range: config.range,
          // 后端返回'source'，前端期望'dataSource'
          dataSource: data.dataSource || data.source || 'Polygon.io',
          // 确保count字段存在
          count: data.count || (data.data ? data.data.length : 0),
        } as HistoricalDataResponse;
      }
    } catch (directError) {
      const error = directError as Error;
      console.log(`直接获取 ${symbol} 历史数据失败，生成模拟数据:`, error.message);
    }
    
    // 如果直接获取失败，生成模拟历史数据
    console.log(`为 ${symbol} 生成模拟历史数据，时间框架: ${timeframe}, 数据点: ${config.dataPoints}`);
    
    // 根据timeframe生成不同的模拟数据
    const now = Date.now();
    const dataPoints = config.dataPoints || 30;
    const basePrice = 100 + Math.random() * 100; // 基础价格在100-200之间
    
    const mockData: HistoricalDataPoint[] = [];
    
    // 根据timeframe调整时间间隔
    let timeInterval = 24 * 60 * 60 * 1000; // 默认每天
    
    if (timeframe === '1D') {
      // 1天视图：5分钟间隔
      timeInterval = 5 * 60 * 1000; // 5分钟
    } else if (timeframe === '1W') {
      // 1周视图：每天
      timeInterval = 24 * 60 * 60 * 1000;
    } else if (timeframe === '1M') {
      // 1月视图：每天
      timeInterval = 24 * 60 * 60 * 1000;
    } else if (timeframe === '3M') {
      // 3月视图：每天
      timeInterval = 24 * 60 * 60 * 1000;
    } else if (timeframe === '1Y') {
      // 1年视图：每周（约5天）
      timeInterval = 5 * 24 * 60 * 60 * 1000;
    }
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const timestamp = now - i * timeInterval;
      
      // 根据timeframe调整价格波动
      let priceVolatility = 0.02; // 默认波动率
      if (timeframe === '1D') {
        priceVolatility = 0.005; // 日内波动较小
      } else if (timeframe === '1Y') {
        priceVolatility = 0.05; // 年波动较大
      }
      
      const open = basePrice * (0.95 + Math.random() * 0.1);
      const close = open * (0.98 + Math.random() * 0.04);
      const high = Math.max(open, close) * (1 + Math.random() * priceVolatility);
      const low = Math.min(open, close) * (0.98 - Math.random() * priceVolatility);
      
      // 根据timeframe调整成交量
      let baseVolume = 1000000;
      let volumeRandom = 9000000;
      if (timeframe === '1D') {
        baseVolume = 50000; // 日内成交量较小
        volumeRandom = 50000;
      } else if (timeframe === '1Y') {
        baseVolume = 5000000; // 年成交量较大
        volumeRandom = 5000000;
      }
      
      const volume = Math.floor(baseVolume + Math.random() * volumeRandom);
      
      mockData.push({
        timestamp: Math.floor(timestamp / 1000), // 转换为秒
        time: new Date(timestamp).toISOString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume
      });
    }
    
    return {
      symbol,
      interval: config.interval,
      range: config.range,
      data: mockData,
      count: mockData.length,
      dataSource: `Mock Data (${timeframe})`,
      timestamp: new Date().toISOString()
    } as HistoricalDataResponse;
    
  } catch (error: any) {
    console.error(`获取股票 ${symbol} 历史数据失败:`, error);
    // 即使出错也返回模拟数据，避免页面崩溃
    const config = TIMEFRAMES[timeframe] || TIMEFRAMES['1M'];
    const dataPoints = config.dataPoints || 30;
    const basePrice = 100;
    
    const mockData: HistoricalDataPoint[] = [];
    const now = Date.now();
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const timestamp = now - i * 24 * 60 * 60 * 1000;
      mockData.push({
        timestamp: Math.floor(timestamp / 1000),
        time: new Date(timestamp).toISOString(),
        open: basePrice,
        high: basePrice * 1.02,
        low: basePrice * 0.98,
        close: basePrice * (0.99 + Math.random() * 0.02),
        volume: 1000000
      });
    }
    
    return {
      symbol,
      interval: config.interval,
      range: config.range,
      data: mockData,
      count: mockData.length,
      dataSource: 'Fallback Mock Data',
      timestamp: new Date().toISOString()
    } as HistoricalDataResponse;
  }
};

/**
 * 搜索股票
 * @param query 搜索关键词
 * @param limit 返回结果数量限制
 */
export const searchStocks = async (query: string, limit: number = 10): Promise<TickerInfo[]> => {
  try {
    const response = await api.get('/market/search', {
      params: { q: query, limit },
    });
    
    if (response.data && response.data.tickers) {
      return response.data.tickers as TickerInfo[];
    }
    
    return [];
  } catch (error) {
    console.error('搜索股票失败:', error);
    throw new Error('搜索股票失败');
  }
};

/**
 * 批量获取股票数据（用于Dashboard等需要多个股票数据的场景）
 * @param symbols 股票代码数组
 */
export const getBatchStockData = async (symbols: string[]): Promise<StockData[]> => {
  try {
    const promises = symbols.map(symbol => 
      getStockData(symbol).catch(error => {
        console.warn(`获取股票 ${symbol} 数据失败:`, error);
        return null;
      })
    );
    
    const results = await Promise.all(promises);
    return results.filter((stock): stock is StockData => stock !== null);
  } catch (error) {
    console.error('批量获取股票数据失败:', error);
    return [];
  }
};

// ========== 辅助函数 ==========

/**
 * 格式化货币显示
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  if (num >= 1_000_000_000_000) {
    return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
  } else if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
};

/**
 * 格式化百分比
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

/**
 * 安全数字转换
 */
export const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * 安全保留小数
 */
export const safeToFixed = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value);
  return num.toFixed(decimals);
};

/**
 * 获取数据来源信息
 */
export const getDataSource = (data: any): string => {
  return data?.dataSource || data?.source || 'Unknown';
};

/**
 * 检查是否是真实数据
 */
export const isRealData = (data: any): boolean => {
  const source = getDataSource(data).toLowerCase();
  return !source.includes('simulated') && !source.includes('fallback') && !source.includes('mock');
};

/**
 * 计算技术指标 - 简单移动平均线 (SMA)
 */
export const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
};

/**
 * 计算技术指标 - 指数移动平均线 (EMA)
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // 第一个 EMA 是 SMA
  let emaValue = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(emaValue);
    } else {
      emaValue = (data[i] - emaValue) * multiplier + emaValue;
      ema.push(emaValue);
    }
  }
  return ema;
};

/**
 * 计算相对强弱指数 (RSI)
 */
export const calculateRSI = (data: number[], period: number = 14): number[] => {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // 计算价格变化
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  // 计算平均增益和平均损失
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    } else {
      const gain = gains[i - 1];
      const loss = losses[i - 1];
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
};

// ========== 缓存管理 ==========

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MarketDataCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5分钟默认缓存时间
  
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL),
    });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  remove(key: string): void {
    this.cache.delete(key);
  }
}

export const marketDataCache = new MarketDataCache();

// ========== 导出服务实例 ==========

const marketDataService = {
  // 核心API
  getStocks,
  getStockData,
  getStockHistory,
  searchStocks,
  getBatchStockData,
  
  // 辅助函数
  formatCurrency,
  formatPercent,
  safeNumber,
  safeToFixed,
  getDataSource,
  isRealData,
  
  // 技术指标
  calculateSMA,
  calculateEMA,
  calculateRSI,
  
  // 配置
  TIMEFRAMES,
  
  // 缓存
  marketDataCache,
};

export default marketDataService;