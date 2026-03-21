/**
 * Market Data Service - Responsible for fetching market data from Finnhub API
 * This layer only handles: viewing markets, fetching market data, format conversion, caching
 * No trading execution logic
 */

import axios from 'axios';

// 使用相对路径，依赖React代理
// 开发环境：/api/* → http://127.0.0.1:8889/api/* (通过package.json proxy)
// 生产环境：通过环境变量REACT_APP_API_BASE_URL配置
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// 调试：输出环境变量
console.log('[调试] API_BASE_URL:', API_BASE_URL);
console.log('[调试] REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
console.log('[调试] REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('[调试] NODE_ENV:', process.env.NODE_ENV);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,  // 增加到30秒，适应更多股票数据
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器用于调试
api.interceptors.request.use(
  (config) => {
    console.log('[axios请求拦截器] 请求配置:', {
      url: config.url,
      baseURL: config.baseURL,
      method: config.method,
      params: config.params,
      headers: config.headers,
      完整URL: (config.baseURL || '') + (config.url || '')
    });
    return config;
  },
  (error) => {
    console.error('[axios请求拦截器] 请求错误:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器用于调试
api.interceptors.response.use(
  (response) => {
    console.log('[axios响应拦截器] 响应成功:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      dataKeys: Object.keys(response.data)
    });
    return response;
  },
  (error) => {
    console.error('[axios响应拦截器] 响应错误:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config ? {
        url: error.config.url,
        baseURL: error.config.baseURL,
        method: error.config.method,
        params: error.config.params
      } : '无配置信息'
    });
    return Promise.reject(error);
  }
);

// ========== Type Definitions ==========

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
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
}

export interface HistoricalDataResponse {
  symbol: string;
  interval: string;
  range: string;
  data: HistoricalDataPoint[];
  count: number;
  dataSource: string;
  timestamp: number;
  error?: string;
  warning?: string;
  isSimulated?: boolean;
  basePrice?: number;
  priceRange?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

// ========== Timeframe Configuration ==========

export const TIMEFRAMES: Record<string, { interval: string; range: string; dataPoints: number; label: string }> = {
  '1D': { interval: '30', range: '1day', dataPoints: 14, label: '1 Day' },     // 30分钟粒度，约14个数据点（9:30-16:00，每30分钟一个）
  '1W': { interval: '60', range: '1week', dataPoints: 40, label: '1 Week' },   // 60分钟粒度，约40个数据点（一周5天，每天6.5小时）
  '1M': { interval: 'D', range: '1month', dataPoints: 20, label: '1 Month' },  // 日线粒度，约20个数据点
  '3M': { interval: 'D', range: '3month', dataPoints: 60, label: '3 Months' }, // 日线粒度，约60个数据点
  '1Y': { interval: 'D', range: '1year', dataPoints: 252, label: '1 Year' },   // 日线粒度，约252个数据点
};

// ========== Utility Functions ==========

/**
 * Format currency for display
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format percentage for display
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

/**
 * Safe number conversion (returns 0 for null/undefined/NaN)
 */
export const safeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Safe toFixed with null handling
 */
export const safeToFixed = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  return num.toFixed(decimals);
};

/**
 * Calculate Simple Moving Average
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
 * Calculate Exponential Moving Average
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
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
 * Calculate Relative Strength Index
 */
export const calculateRSI = (data: number[], period: number = 14): number[] => {
  const rsi: number[] = [];
  
  if (data.length < period + 1) {
    return Array(data.length).fill(NaN);
  }
  
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  // Pad beginning with NaN
  return [...Array(period).fill(NaN), ...rsi];
};

// ========== Core API Functions ==========

/**
 * Get list of stocks for Market page
 * @param symbols Optional array of symbols to filter (if provided, returns data for those symbols only)
 */
export const getStocks = async (symbols?: string[], dashboard?: boolean): Promise<StockData[]> => {
  try {
    const params: any = {};
    
    // 如果提供了symbols参数，传递给后端
    if (symbols && symbols.length > 0) {
      params.symbols = symbols.join(',');
    }
    
    // Dashboard请求使用轻量级模式
    if (dashboard) {
      params.dashboard = 'true';
    }
    
    console.log(`[marketDataService调试] 开始请求股票数据`);
    console.log(`[marketDataService调试] 参数: symbols=${symbols?.join(',') || '无'}, dashboard=${dashboard}`);
    console.log(`[marketDataService调试] api实例配置:`, {
      baseURL: api.defaults.baseURL,
      timeout: api.defaults.timeout,
      headers: api.defaults.headers
    });
    console.log(`[marketDataService调试] 完整请求URL: ${api.defaults.baseURL}/market/stocks`);
    console.log(`[marketDataService调试] 请求参数:`, params);
    
    const response = await api.get('/market/stocks', { params });
    
    console.log(`[前端调试] 收到响应:`, {
      status: response.status,
      dataKeys: Object.keys(response.data),
      hasStocks: !!response.data.stocks,
      stocksCount: response.data.stocks?.length || 0,
      responseStructure: response.data
    });
    
    if (response.data && response.data.stocks) {
      const stocks = response.data.stocks.map((stock: any) => ({
        ...stock,
        // 后端已经返回正确的字段名：dayHigh, dayLow, previousClose
        dayHigh: stock.dayHigh !== undefined ? stock.dayHigh : null,
        dayLow: stock.dayLow !== undefined ? stock.dayLow : null,
        previousClose: stock.previousClose !== undefined ? stock.previousClose : null,
        // 保持其他字段
        dataSource: stock.dataSource || response.data.source || 'Finnhub',
        timestamp: new Date().toISOString(),
      }));
      
      console.log(`[前端调试] 成功处理 ${stocks.length} 支股票`);
      return stocks;
    }
    
    console.warn(`[前端调试] 响应中没有 stocks 字段，返回空数组`);
    return [];
  } catch (error: any) {
    console.error('[前端调试] Failed to fetch stocks:', error);
    console.error('[前端调试] 错误详情:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch stocks');
  }
};

/**
 * Get single stock detailed information
 */
export const getStockData = async (symbol: string): Promise<StockData> => {
  try {
    const response = await api.get(`/market/stock/${symbol}`);
    
    if (response.data && !response.data.error) {
      // 后端已经返回正确的字段名：dayHigh, dayLow, previousClose
      const stock = response.data;
      return {
        ...stock,
        // 确保字段存在，如果后端返回null/undefined，设置为null
        dayHigh: stock.dayHigh !== undefined ? stock.dayHigh : null,
        dayLow: stock.dayLow !== undefined ? stock.dayLow : null,
        previousClose: stock.previousClose !== undefined ? stock.previousClose : null,
        dataSource: stock.dataSource || 'Finnhub',
        timestamp: new Date().toISOString(),
      } as StockData;
    }
    
    throw new Error(response.data?.error || `Stock ${symbol} not found`);
  } catch (error: any) {
    console.error(`Failed to fetch stock ${symbol} data:`, error);
    throw new Error(error.response?.data?.error || error.message || `Failed to fetch stock ${symbol} data`);
  }
};

/**
 * Get stock historical price data
 */
export const getStockHistory = async (
  symbol: string, 
  timeframe: string = '1M'
): Promise<HistoricalDataResponse> => {
  try {
    const config = TIMEFRAMES[timeframe] || TIMEFRAMES['1M'];
    
    const response = await api.get(`/market/history/${symbol}`, {
      params: {
        interval: config.interval,
        range: config.range,
      },
    });
    
    if (response.data) {
      const data = response.data;
      
      // Check for errors
      if (data.error) {
        throw new Error(`Finnhub API error: ${data.error}`);
      }
      
      return {
        ...data,
        symbol,
        interval: config.interval,
        range: config.range,
        dataSource: data.dataSource || data.source || 'Finnhub',
        count: data.count || (data.data ? data.data.length : 0),
        warning: data.warning,
        isSimulated: data.isSimulated,
        basePrice: data.basePrice,
        priceRange: data.priceRange,
      } as HistoricalDataResponse;
    } else {
      throw new Error('Finnhub returned empty data');
    }
    
  } catch (error) {
    console.error(`Failed to fetch ${symbol} historical data:`, error);
    throw error;
  }
};

/**
 * Search stocks by symbol or name
 * @param query Search query string
 * @param limit Optional limit for number of results
 */
export const searchStocks = async (query: string, limit?: number): Promise<SearchResult[]> => {
  try {
    const response = await api.get('/market/search', {
      params: { q: query },
    });
    
    if (response.data && response.data.results) {
      let results = response.data.results;
      
      // Apply limit if provided
      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }
      
      return results;
    }
    
    return [];
  } catch (error: any) {
    console.error('Failed to search stocks:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to search stocks');
  }
};

/**
 * Get batch stock data for multiple symbols
 */
export const getBatchStockData = async (symbols: string[]): Promise<StockData[]> => {
  try {
    const promises = symbols.map(symbol => getStockData(symbol).catch(() => null));
    const results = await Promise.all(promises);
    
    return results.filter((result): result is StockData => result !== null);
  } catch (error: any) {
    console.error('Failed to fetch batch stock data:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch batch stock data');
  }
};

// ========== Service Object ==========

const marketDataService = {
  // Core API
  getStocks,
  getStockData,
  getStockHistory,
  searchStocks,
  getBatchStockData,
  
  // Utility functions
  formatCurrency,
  formatPercent,
  safeNumber,
  safeToFixed,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  
  // Constants
  TIMEFRAMES,
};

export default marketDataService;