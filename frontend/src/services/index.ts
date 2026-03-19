/**
 * 服务层索引文件
 * 统一导出所有 API 服务
 */

// 市场数据服务
export * from './polygonApi';

// 交易服务
export * from './alpacaApi';

// 旧版 API 服务（兼容性）
export { default as legacyApi } from './api';

// 类型定义
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

export interface AccountData {
  account_number: string;
  status: string;
  currency: string;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  equity: number;
  last_equity: number;
  long_market_value: number;
  short_market_value: number;
  initial_margin: number;
  maintenance_margin: number;
  daytrade_count: number;
  dataSource: string;
  paper_trading: boolean;
  timestamp: string;
}

export interface PositionData {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  side: string;
  dataSource: string;
}

export interface OrderData {
  order_id: string;
  client_order_id: string;
  symbol: string;
  qty: number;
  filled_qty: number;
  side: string;
  type: string;
  time_in_force: string;
  status: string;
  submitted_at: string;
  filled_at: string;
  limit_price: number | null;
  stop_price: number | null;
  filled_avg_price: number | null;
  dataSource: string;
}

// 服务选择器
export const getMarketService = () => {
  // 可以根据配置选择不同的市场数据服务
  return import('./polygonApi').then(module => module.polygonApi);
};

export const getTradingService = () => {
  // 可以根据配置选择不同的交易服务
  return import('./alpacaApi').then(module => module.alpacaApi);
};

// 服务健康检查
export const checkServicesHealth = async () => {
  try {
    const marketService = await getMarketService();
    const tradingService = await getTradingService();
    
    const [marketHealth, tradingHealth] = await Promise.allSettled([
      marketService.getSystemHealth(),
      tradingService.getTradingHealth(),
    ]);
    
    return {
      market: marketHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      trading: tradingHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('服务健康检查失败:', error);
    return {
      market: 'unknown',
      trading: 'unknown',
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
};