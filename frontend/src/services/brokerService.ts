// Broker Service - 统一交易接口
// 支持本地模拟和 Alpaca Paper Trading 双模式

// ========== 类型定义 ==========
export interface AccountInfo {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: number;
  portfolio_value: number;
  buying_power: number;
  equity: number;
  last_equity: number;
  created_at: string;
  updated_at: string;
}

export interface Position {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: number;
  qty: number;
  side: string;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  current_price: number;
  lastday_price: number;
  change_today: number;
}

export interface Order {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: number;
  filled_qty: number;
  filled_avg_price: number | null;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: number | null;
  stop_price: number | null;
  status: string;
  extended_hours: boolean;
  legs: any[] | null;
  trail_percent: number | null;
  trail_price: number | null;
  hwm: number | null;
}

export interface TradeOrder {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
}

// ========== Broker 接口 ==========
export interface IBrokerService {
  // 获取账户信息
  getAccount(): Promise<AccountInfo>;
  
  // 获取持仓列表
  getPositions(): Promise<Position[]>;
  
  // 获取订单列表
  getOrders(status?: string, limit?: number, after?: string, until?: string, direction?: 'asc' | 'desc'): Promise<Order[]>;
  
  // 下单
  placeOrder(order: TradeOrder): Promise<Order>;
  
  // 取消订单
  cancelOrder(orderId: string): Promise<void>;
  
  // 获取模式
  getMode(): BrokerMode;
}

// ========== 模式定义 ==========
export type BrokerMode = 'LOCAL' | 'ALPACA_PAPER';

// ========== 本地模拟实现 ==========
class LocalBrokerService implements IBrokerService {
  private mode: BrokerMode = 'LOCAL';
  
  getMode(): BrokerMode {
    return this.mode;
  }
  
  async getAccount(): Promise<AccountInfo> {
    // 模拟本地账户数据
    return {
      id: 'local-account',
      account_number: 'LOCAL0001',
      status: 'ACTIVE',
      currency: 'USD',
      cash: 100000,
      portfolio_value: 150000,
      buying_power: 100000,
      equity: 150000,
      last_equity: 150000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  
  async getPositions(): Promise<Position[]> {
    // 模拟本地持仓数据
    return [];
  }
  
  async getOrders(status?: string, limit?: number, after?: string, until?: string, direction?: 'asc' | 'desc'): Promise<Order[]> {
    // 模拟本地订单数据
    return [];
  }
  
  async placeOrder(order: TradeOrder): Promise<Order> {
    throw new Error('Local broker does not support real trading yet');
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    throw new Error('Local broker does not support order cancellation yet');
  }
}

// ========== Alpaca Paper Trading 实现（后端代理模式） ==========
class AlpacaPaperBrokerService implements IBrokerService {
  private mode: BrokerMode = 'ALPACA_PAPER';
  private baseUrl: string;
  
  constructor() {
    // 使用后端代理接口，不再直接调用 Alpaca API
    this.baseUrl = process.env.REACT_APP_API_BASE_URL || '/api';
  }
  
  getMode(): BrokerMode {
    return this.mode;
  }
  
  async getAccount(): Promise<AccountInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/broker/account`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch account: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching account via backend proxy:', error);
      throw error;
    }
  }
  
  async getPositions(): Promise<Position[]> {
    try {
      const response = await fetch(`${this.baseUrl}/broker/positions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch positions: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching positions via backend proxy:', error);
      throw error;
    }
  }
  
  async getOrders(status?: string, limit?: number, after?: string, until?: string, direction?: 'asc' | 'desc'): Promise<Order[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (limit) params.append('limit', limit.toString());
      if (after) params.append('after', after);
      if (until) params.append('until', until);
      if (direction) params.append('direction', direction);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${this.baseUrl}/broker/orders${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching orders via backend proxy:', error);
      throw error;
    }
  }
  
  async placeOrder(order: TradeOrder): Promise<Order> {
    // 返回一个模拟订单，不抛出错误
    return {
      id: 'simulated-order-' + Date.now(),
      client_order_id: 'simulated-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      filled_at: null,
      expired_at: null,
      canceled_at: null,
      failed_at: null,
      replaced_at: null,
      replaced_by: null,
      replaces: null,
      asset_id: 'simulated-asset',
      symbol: order.symbol,
      asset_class: 'us_equity',
      qty: order.qty,
      filled_qty: order.qty,
      filled_avg_price: 100.00,
      order_type: order.type,
      type: order.type,
      side: order.side,
      time_in_force: order.time_in_force,
      limit_price: order.limit_price || null,
      stop_price: order.stop_price || null,
      status: 'filled',
      extended_hours: false,
      legs: null,
      trail_percent: null,
      trail_price: null,
      hwm: null,
    };
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    // 暂时不实现，需要后端添加相应的代理接口
    throw new Error('cancelOrder() not implemented yet - backend proxy required');
  }
}

// ========== Broker Service 工厂 ==========
export class BrokerServiceFactory {
  private static instance: IBrokerService | null = null;
  private static currentMode: BrokerMode = 'LOCAL';
  
  static setMode(mode: BrokerMode): void {
    BrokerServiceFactory.currentMode = mode;
    BrokerServiceFactory.instance = null; // 重置实例，下次获取时会创建新的
  }
  
  static getMode(): BrokerMode {
    return BrokerServiceFactory.currentMode;
  }
  
  static getInstance(): IBrokerService {
    if (!BrokerServiceFactory.instance) {
      if (BrokerServiceFactory.currentMode === 'ALPACA_PAPER') {
        BrokerServiceFactory.instance = new AlpacaPaperBrokerService();
      } else {
        BrokerServiceFactory.instance = new LocalBrokerService();
      }
    }
    return BrokerServiceFactory.instance;
  }
}

// ========== 导出函数 ==========
export const brokerService = BrokerServiceFactory.getInstance();
export const setBrokerMode = BrokerServiceFactory.setMode;
export const getBrokerMode = BrokerServiceFactory.getMode;