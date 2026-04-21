/**
 * Finnhub API 服务 - 专门负责市场数据
 */

import axios from 'axios';

// 使用相对路径，依赖React代理
// 开发环境：/api/* → http://127.0.0.1:8889/api/* (通过package.json proxy)
// 生产环境：通过环境变量REACT_APP_API_BASE_URL配置
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加市场数据特定的请求头
    return config;
  },
  (error) => {
    console.error('Finnhub API 请求错误:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器
api.interceptors.response.use(
  (response) => {
    // 记录数据源信息
    if (response.data?.dataSource) {
      console.log(`市场数据来源: ${response.data.dataSource}`);
    }
    return response;
  },
  (error) => {
    console.error('Finnhub API 响应错误:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// ========== 市场数据API ==========

export const finnhubApi = {
  // 股票列表
  getStocks: (symbols?: string) => {
    const params: any = {};
    if (symbols) params.symbols = symbols;
    return api.get('/market/stocks', { params });
  },
  
  // 单个股票详情
  getStockData: (symbol: string) => api.get(`/market/stock/${symbol}`),
  
  // 历史价格数据
  getStockHistory: (symbol: string, interval?: string, range?: string) => {
    const params: any = {};
    if (interval) params.interval = interval;
    if (range) params.range = range;
    return api.get(`/market/history/${symbol}`, { params });
  },
  
  // 搜索股票
  searchStocks: (query: string, limit?: number) => {
    const params: any = { q: query };
    if (limit) params.limit = limit;
    return api.get('/market/search', { params });
  },
  
  // 市场健康检查
  getMarketHealth: () => api.get('/market/health'),
  
  // 系统健康检查
  getSystemHealth: () => api.get('/health'),
};

// ========== 辅助函数 ==========

// 格式化货币显示
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

// 格式化百分比
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  if (num === 0) return '0.00%';
  const sign = num > 0 ? '+' : '-';
  return `${sign}${Math.abs(num).toFixed(2)}%`;
};

// 安全数字转换
export const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

// 安全保留小数
export const safeToFixed = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value);
  return num.toFixed(decimals);
};

// 获取数据来源
export const getDataSource = (data: any): string => {
  return data?.dataSource || data?.source || 'Unknown';
};

// 检查是否是真实数据
export const isRealData = (data: any): boolean => {
  const source = getDataSource(data).toLowerCase();
  return !source.includes('simulated') && !source.includes('fallback') && !source.includes('mock');
};

export default finnhubApi;