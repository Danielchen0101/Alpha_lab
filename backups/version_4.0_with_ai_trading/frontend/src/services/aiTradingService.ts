import api from './api';

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CANCEL';
  symbol: string;
  qty: number;
  orderType?: string;
  timeInForce?: string;
  limitPrice?: number;
  stopPrice?: number;
  confidence?: number;
  reason?: string;
  riskFlags?: string[];
  marketSummary?: {
    marketRegime: string;
    trend: string;
    volatility: string;
    rsi: number;
    volume: number;
    support: number;
    resistance: number;
    timestamp: string;
  };
  strategyMode?: {
    mode: string;
    marketRegime: string;
    tradingBias: string;
    holdingHorizon: string;
    adaptationEnabled: boolean;
    confidence: number;
  };
  validationResult?: {
    is_valid: boolean;
    message: string;
  };
  executable?: boolean;
  rawDecisionJson?: string;
}

export interface AIRiskCheck {
  passed: string[];
  blocked: Array<[string, string]>;
  executable: boolean;
}

export interface AIPreviewResponse {
  success: boolean;
  decision: AIDecision;
  validation: {
    is_valid: boolean;
    message: string;
  };
  risk_checks: AIRiskCheck;
  history_id: number;
}

export interface AIExecuteResponse {
  success: boolean;
  order?: any;
  execution_time?: string;
  error?: string;
}

export interface AIStatus {
  auto_mode: boolean;
  paper_only: boolean;
  human_confirm_required: boolean;
  max_qty_per_order: number;
  max_notional_per_order: number;
  max_orders_per_day: number;
  allowed_symbols: string[];
  today_order_count: number;
  last_analysis_time: string | null;
  last_execution_time: string | null;
  ai_status: string;
}

export interface AIHistoryEntry {
  timestamp: string;
  symbol: string;
  action: string;
  qty: number;
  confidence: number;
  reason: string;
  risk_passed: string[];
  risk_blocked: Array<[string, string]>;
  executable: boolean;
  executed: boolean;
  order_id?: string;
  execution_time?: string;
  order_status?: string;
}

export interface AIHistoryResponse {
  success: boolean;
  history: AIHistoryEntry[];
  total_count: number;
}

export interface AIStatusResponse {
  success: boolean;
  state: AIStatus;
  history_count: number;
}

export interface AIToggleResponse {
  success: boolean;
  auto_mode: boolean;
  paper_only: boolean;
  human_confirm_required: boolean;
}

// Block 1: AI Provider Configuration
export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AIProviderTestResponse {
  success: boolean;
  message: string;
  valid: boolean;
}

export interface AIProviderConfigResponse {
  success: boolean;
  config: AIProviderConfig;
}

// Block 1: Trading Environment
export interface TradingEnvironment {
  environment: 'paper' | 'live';
  alpacaPaperKey?: string;
  alpacaPaperSecret?: string;
  alpacaLiveKey?: string;
  alpacaLiveSecret?: string;
}

export interface TradingEnvironmentResponse {
  success: boolean;
  environment: TradingEnvironment;
}

class AITradingService {
  // AI 交易预览
  async previewTrade(symbol: string): Promise<AIPreviewResponse> {
    try {
      const response = await api.post('/api/ai/trade/preview', { symbol });
      return response.data;
    } catch (error: any) {
      console.error('AI preview error:', error);
      return {
        success: false,
        decision: {
          action: 'HOLD',
          symbol,
          qty: 0,
          confidence: 0,
          reason: 'AI analysis failed'
        },
        validation: {
          is_valid: false,
          message: error.response?.data?.error || error.message || 'AI analysis failed'
        },
        risk_checks: {
          passed: [],
          blocked: [['ai_error', 'AI analysis failed']],
          executable: false
        },
        history_id: -1
      };
    }
  }

  // 执行 AI 交易
  async executeTrade(historyId: number, confirmed: boolean = false): Promise<AIExecuteResponse> {
    try {
      const response = await api.post('/api/ai/trade/execute', { 
        history_id: historyId,
        confirmed 
      });
      return response.data;
    } catch (error: any) {
      console.error('AI execute error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Execution failed'
      };
    }
  }

  // 切换自动交易模式
  async toggleAutoMode(autoMode: boolean): Promise<AIToggleResponse> {
    try {
      const response = await api.post('/api/ai/trade/toggle', { auto_mode: autoMode });
      return response.data;
    } catch (error: any) {
      console.error('Toggle auto mode error:', error);
      return {
        success: false,
        auto_mode: false,
        paper_only: true,
        human_confirm_required: true
      };
    }
  }

  // 获取 AI 状态
  async getStatus(): Promise<AIStatusResponse> {
    try {
      const response = await api.get('/api/ai/trade/status');
      return response.data;
    } catch (error: any) {
      console.error('Get AI status error:', error);
      return {
        success: false,
        state: {
          auto_mode: false,
          paper_only: true,
          human_confirm_required: true,
          max_qty_per_order: 1,
          max_notional_per_order: 1000,
          max_orders_per_day: 10,
          allowed_symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'],
          today_order_count: 0,
          last_analysis_time: null,
          last_execution_time: null,
          ai_status: 'error'
        },
        history_count: 0
      };
    }
  }

  // 获取 AI 历史记录
  async getHistory(limit: number = 50): Promise<AIHistoryResponse> {
    try {
      const response = await api.get('/api/ai/trade/history', {
        params: { limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('Get AI history error:', error);
      return {
        success: false,
        history: [],
        total_count: 0
      };
    }
  }

  // 获取账户快照（从 Alpaca）
  async getAccountSnapshot() {
    try {
      // 使用新的 AI 专用接口
      const [accountResponse, positionsResponse, ordersResponse] = await Promise.all([
        api.get('/api/ai/alpaca/account'),
        api.get('/api/ai/alpaca/positions'),
        api.get('/api/ai/alpaca/orders?status=open&limit=50')
      ]);

      return {
        cash: accountResponse.data.data?.cash || 0,
        equity: accountResponse.data.data?.equity || 0,
        buyingPower: accountResponse.data.data?.buyingPower || 0,
        portfolioValue: accountResponse.data.data?.portfolioValue || 0,
        positionsCount: positionsResponse.data.data?.length || 0,
        openOrdersCount: ordersResponse.data.data?.length || 0,
        accountNumber: accountResponse.data.data?.accountNumber || '',
        status: accountResponse.data.data?.status || ''
      };
    } catch (error) {
      console.error('Get account snapshot error:', error);
      return {
        cash: 0,
        equity: 0,
        buyingPower: 0,
        portfolioValue: 0,
        positionsCount: 0,
        openOrdersCount: 0,
        accountNumber: '',
        status: ''
      };
    }
  }

  // Block 2: 获取详细的账户、持仓、订单数据
  async getAlpacaAccount(): Promise<any> {
    try {
      const response = await api.get('/api/ai/alpaca/account');
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca account error:', error);
      return {
        success: false,
        error: error.message || '获取账户信息失败'
      };
    }
  }

  async getAlpacaPositions(): Promise<any> {
    try {
      const response = await api.get('/api/ai/alpaca/positions');
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca positions error:', error);
      return {
        success: false,
        data: []
      };
    }
  }

  async getAlpacaOrders(status: string = 'open'): Promise<any> {
    try {
      const response = await api.get('/api/ai/alpaca/orders', {
        params: { status }
      });
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca orders error:', error);
      return {
        success: false,
        data: []
      };
    }
  }

  async getAlpacaOrdersHistory(limit: number = 50): Promise<any> {
    try {
      const response = await api.get('/api/ai/alpaca/orders/history', {
        params: { limit, status: 'all' }
      });
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca orders history error:', error);
      return {
        success: false,
        data: []
      };
    }
  }

  // Block 1: AI Provider Configuration
  async testProviderConnection(config: AIProviderConfig): Promise<AIProviderTestResponse> {
    try {
      const response = await api.post('/api/ai/provider/test', config);
      return response.data;
    } catch (error: any) {
      console.error('Test provider connection error:', error);
      return {
        success: false,
        message: error.response?.data?.error || error.message || 'Connection test failed',
        valid: false
      };
    }
  }

  async saveProviderConfig(config: AIProviderConfig): Promise<AIProviderConfigResponse> {
    try {
      const response = await api.post('/api/ai/provider/config', config);
      return response.data;
    } catch (error: any) {
      console.error('Save provider config error:', error);
      return {
        success: false,
        config: config
      };
    }
  }

  async getProviderConfig(): Promise<AIProviderConfigResponse> {
    try {
      const response = await api.get('/api/ai/provider/config');
      return response.data;
    } catch (error: any) {
      console.error('Get provider config error:', error);
      return {
        success: false,
        config: {
          provider: 'DeepSeek',
          apiKey: '',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat'
        }
      };
    }
  }

  // Block 1: Trading Environment
  async getTradingEnvironment(): Promise<TradingEnvironmentResponse> {
    try {
      const response = await api.get('/api/ai/trading/environment');
      return response.data;
    } catch (error: any) {
      console.error('Get trading environment error:', error);
      return {
        success: false,
        environment: {
          environment: 'paper'
        }
      };
    }
  }

  async setTradingEnvironment(environment: TradingEnvironment): Promise<TradingEnvironmentResponse> {
    try {
      const response = await api.post('/api/ai/trading/environment', environment);
      return response.data;
    } catch (error: any) {
      console.error('Set trading environment error:', error);
      return {
        success: false,
        environment: environment
      };
    }
  }

  // Block 3: AI Chat 接口
  async sendChatMessage(message: string, symbol?: string, history?: any[]): Promise<any> {
    try {
      const response = await api.post('/api/ai/chat', {
        message,
        symbol,
        history
      });
      return response.data;
    } catch (error: any) {
      console.error('Send chat message error:', error);
      return {
        success: false,
        error: error.message || '发送消息失败'
      };
    }
  }

  async getChatHistory(limit: number = 50, symbol?: string): Promise<any> {
    try {
      const params: any = { limit };
      if (symbol) params.symbol = symbol;
      
      const response = await api.get('/api/ai/chat/history', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get chat history error:', error);
      return {
        success: false,
        history: [],
        total_count: 0
      };
    }
  }

  async clearChatHistory(symbol?: string): Promise<any> {
    try {
      const response = await api.post('/api/ai/chat/clear', { symbol });
      return response.data;
    } catch (error: any) {
      console.error('Clear chat history error:', error);
      return {
        success: false,
        error: error.message || '清空聊天历史失败'
      };
    }
  }
}

export default new AITradingService();