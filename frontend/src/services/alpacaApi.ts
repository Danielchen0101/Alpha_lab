/**
 * Alpaca Markets API 服务 - 专门负责交易功能
 */

import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Supabase access token to all requests
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    console.error('Alpaca API 请求错误:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器用于错误处理
api.interceptors.response.use(
  (response) => {
    // 记录数据源信息
    if (response.data?.dataSource) {
      console.log(`交易数据来源: ${response.data.dataSource}`);
    }
    return response;
  },
  (error) => {
    console.error('Alpaca API 响应错误:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误数据:', error.response.data);
      
      // 处理认证错误
      if (error.response.status === 401) {
        supabase.auth.signOut().then(() => {
          window.location.href = '/signin';
        });
      }
    }
    return Promise.reject(error);
  }
);

// ========== 交易API ==========

export const alpacaApi = {
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
  
  getOrder: (orderId: string) => api.get(`/trading/order/${orderId}`),
  
  // 下单
  placeOrder: (orderData: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type?: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force?: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
    client_order_id?: string;
  }) => api.post('/trading/order', orderData),
  
  // 取消订单
  cancelOrder: (orderId: string) => api.delete(`/trading/order/${orderId}`),
  cancelAllOrders: () => api.delete('/trading/orders'),
  
  // 资产
  getAssets: (status?: string, assetClass?: string) => {
    const params: any = {};
    if (status) params.status = status;
    if (assetClass) params.asset_class = assetClass;
    return api.get('/trading/assets', { params });
  },
  
  getAsset: (symbol: string) => api.get(`/trading/asset/${symbol}`),
  
  // 平仓
  closePosition: (symbol: string, qty?: number) => {
    const params: any = {};
    if (qty !== undefined) params.qty = qty;
    return api.delete(`/trading/position/${symbol}`, { params });
  },
  
  closeAllPositions: () => api.delete('/trading/positions'),
  
  // 账户活动
  getAccountActivities: (activityType?: string, date?: string) => {
    const params: any = {};
    if (activityType) params.activity_type = activityType;
    if (date) params.date = date;
    return api.get('/trading/activities', { params });
  },
  
  // 交易健康检查
  getTradingHealth: () => api.get('/trading/health'),
};

// ========== 认证辅助函数 (Supabase) ==========

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
};

export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

export const logout = async () => {
  await supabase.auth.signOut();
};

// ========== 交易辅助函数 ==========

// 计算持仓总价值
export const calculateTotalPositionValue = (positions: any[]): number => {
  return positions.reduce((total, position) => {
    return total + (position.market_value || 0);
  }, 0);
};

// 计算总未实现盈亏
export const calculateTotalUnrealizedPL = (positions: any[]): number => {
  return positions.reduce((total, position) => {
    return total + (position.unrealized_pl || 0);
  }, 0);
};

// 格式化订单状态
export const formatOrderStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'new': '新建',
    'partially_filled': '部分成交',
    'filled': '已成交',
    'done_for_day': '当日完成',
    'canceled': '已取消',
    'expired': '已过期',
    'replaced': '已替换',
    'pending_cancel': '取消中',
    'pending_replace': '替换中',
    'accepted': '已接受',
    'pending_new': '新建中',
    'accepted_for_bidding': '竞价中',
    'stopped': '已停止',
    'rejected': '已拒绝',
    'suspended': '已暂停',
    'calculated': '已计算',
  };
  
  return statusMap[status] || status;
};

// 获取订单状态颜色
export const getOrderStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    'filled': 'green',
    'canceled': 'red',
    'rejected': 'red',
    'new': 'blue',
    'partially_filled': 'orange',
    'pending_cancel': 'orange',
    'pending_new': 'blue',
  };
  
  return colorMap[status] || 'default';
};

// 检查是否是模拟交易
export const isPaperTrading = (data: any): boolean => {
  return data?.paper_trading === true;
};

// 获取交易模式
export const getTradingMode = (data: any): string => {
  return isPaperTrading(data) ? '模拟交易' : '实盘交易';
};

export default alpacaApi;