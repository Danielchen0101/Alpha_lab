import api from './api';

export interface AlpacaAccount {
  accountNumber: string;
  status: string;
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  longMarketValue: number;
  shortMarketValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  currency: string;
}

export interface AlpacaPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: string;
}

export interface AlpacaOrder {
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  type: string;
  timeInForce: string;
  status: string;
  createdAt: string;
  filledAt: string | null;
  filledQty: number;
  limitPrice: number | null;
  stopPrice: number | null;
}

export interface PlaceOrderRequest {
  symbol: string;
  qty: string;
  side: 'buy' | 'sell';
  type?: string;
  time_in_force?: string;
  limit_price?: string;
  stop_price?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class AlpacaBrokerService {
  async getAccount(): Promise<AlpacaAccount> {
    try {
      const response = await api.get('/broker/account');
      const apiResponse: ApiResponse<AlpacaAccount> = response.data;
      
      if (!apiResponse.success || !apiResponse.data) {
        const error = new Error(apiResponse.error || 'Failed to fetch account');
        (error as any).response = response;
        throw error;
      }
      
      return apiResponse.data;
    } catch (error: any) {
      if (!error.response) {
        error.response = { data: { error: { message: error.message || 'Network error' } } };
      }
      throw error;
    }
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    try {
      const response = await api.get('/broker/positions');
      const apiResponse: ApiResponse<AlpacaPosition[]> = response.data;
      
      if (!apiResponse.success) {
        const error = new Error(apiResponse.error || 'Failed to fetch positions');
        (error as any).response = response;
        throw error;
      }
      
      return apiResponse.data || [];
    } catch (error: any) {
      if (!error.response) {
        error.response = { data: { error: { message: error.message || 'Network error' } } };
      }
      throw error;
    }
  }

  async getOrders(status?: string): Promise<AlpacaOrder[]> {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/broker/orders', { params });
      const apiResponse: ApiResponse<AlpacaOrder[]> = response.data;
      
      if (!apiResponse.success) {
        const error = new Error(apiResponse.error || 'Failed to fetch orders');
        (error as any).response = response;
        throw error;
      }
      
      return apiResponse.data || [];
    } catch (error: any) {
      if (!error.response) {
        error.response = { data: { error: { message: error.message || 'Network error' } } };
      }
      throw error;
    }
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{orderId: string, status: string, symbol: string, quantity: number, side: string, type: string}> {
    const response = await api.post('/broker/order', order);
    const apiResponse: ApiResponse<{orderId: string, status: string, symbol: string, quantity: number, side: string, type: string}> = response.data;
    
    if (!apiResponse.success || !apiResponse.data) {
      throw new Error(apiResponse.error || 'Failed to place order');
    }
    
    return apiResponse.data;
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/broker/order/${orderId}`);
    const apiResponse: ApiResponse<{ success: boolean; message: string }> = response.data;
    
    if (!apiResponse.success || !apiResponse.data) {
      throw new Error(apiResponse.error || 'Failed to cancel order');
    }
    
    return apiResponse.data;
  }

  // AI-ready methods
  async buy(symbol: string, qty: string): Promise<{orderId: string, status: string, symbol: string, quantity: number, side: string, type: string}> {
    return this.placeOrder({
      symbol,
      qty,
      side: 'buy',
      type: 'market',
      time_in_force: 'gtc'
    });
  }

  async sell(symbol: string, qty: string): Promise<{orderId: string, status: string, symbol: string, quantity: number, side: string, type: string}> {
    return this.placeOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'gtc'
    });
  }

  async refreshAll(): Promise<{
    account: AlpacaAccount;
    positions: AlpacaPosition[];
    orders: AlpacaOrder[];
  }> {
    const [account, positions, orders] = await Promise.all([
      this.getAccount(),
      this.getPositions(),
      this.getOrders()
    ]);
    return { account, positions, orders };
  }
}

export default new AlpacaBrokerService();