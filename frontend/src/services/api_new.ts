import axios from 'axios';

// 使用相对路径，依赖 CRA 代理配置
// 开发模式下：/api/* → http://127.0.0.1:8889/api/*
// 生产模式下：需要配置正确的后端地址
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器用于 JWT 认证
api.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器用于错误处理
api.interceptors.response.use(
  (response) => {
    // 记录数据源信息
    if (response.data?.dataSource) {
      console.log(`数据来源: ${response.data.dataSource}`);
    }
    return response;
  },
  (error) => {
    console.error('Response error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      // 处理认证错误
      if (error.response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========== 认证API ==========
export const authAPI = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  register: (userData: any) => api.post('/auth/register', userData),
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
};

// ========== 系统API ==========
export const systemAPI = {
  getSystemStatus: () => api.get('/system/status'),
  getHealth: () => api.get('/health'),
};

// ========== 市场数据API (Polygon.io) ==========
export const marketAPI = {
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
};

// ========== 交易API (Alpaca Markets) ==========
export const tradingAPI = {
  // 账户信息
  getAccount: () => api.get('/trading/account'),
  
  // 持仓
  getPositions: () => api.get('/trading/positions'),
  getPosition: (symbol: string) => api.get(`/trading/position/${symbol}`),
  
  // 订单
  getOrders: (status?: string, limit?: number) => {
    const params: any = {};
    if (status) params.status = status;
    if (limit) params.limit = limit;
    return api.get('/trading/orders', { params });
  },
  
  // 下单
  placeOrder: (orderData: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type?: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force?: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
  }) => api.post('/trading/order', orderData),
  
  // 取消订单
  cancelOrder: (orderId: string) => api.delete(`/trading/order/${orderId}`),
  cancelAllOrders: () => api.delete('/trading/orders'),
  
  // 交易健康检查
  getTradingHealth: () => api.get('/trading/health'),
};

// ========== 用户API ==========
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (profileData: any) => api.put('/user/profile', profileData),
};

// ========== 辅助函数 ==========

// 保存认证信息
export const saveAuthData = (token: string, user: any) => {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// 获取当前用户
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// 检查是否已登录
export const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

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
  
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
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

export default api;