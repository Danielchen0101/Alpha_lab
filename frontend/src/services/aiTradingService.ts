import api from './api';

export interface AIDecision {
  // 核心动作字段
  action: 'BUY' | 'SELL' | 'HOLD' | 'ERROR' | 'CANCEL' | 'SKIP';
  signalAction?: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  executionAction?: 'BUY' | 'SELL' | 'HOLD' | 'ERROR' | 'CANCEL' | 'SKIP';
  
  // 股票标识
  symbol: string;
  
  // 数量相关字段（兼容新旧格式）
  qty: number;
  recommendedQty?: number;
  positionSize?: number;
  
  // 订单详情
  orderType?: string;
  timeInForce?: string;
  limitPrice?: number;
  stopPrice?: number;
  
  // 分析和置信度
  confidence?: number;
  reason?: string;
  reasonSummary?: string;
  reasoningFull?: string;
  riskNote?: string;
  whyNotOtherActions?: string;
  
  // 风险标记
  riskFlags?: string[];
  
  // 市场摘要
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
  
  // 策略模式
  strategyMode?: {
    mode: string;
    marketRegime: string;
    tradingBias: string;
    holdingHorizon: string;
    adaptationEnabled: boolean;
    confidence: number;
  };
  
  // 验证结果
  validationResult?: {
    is_valid: boolean;
    message: string;
  };
  
  // 执行相关
  executable?: boolean;
  
  // 价格目标
  entry?: string;
  stopLoss?: string;
  takeProfit?: string;
  
  // 风险和时间框架
  riskLevel?: string;
  timeFrame?: string;
  
  // 原始数据
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
      const response = await api.post('/ai/trade/preview', { symbol });
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

  // AI 分析（带完整上下文）
  async previewTradeWithContext(symbol: string, context: any): Promise<AIPreviewResponse> {
    try {
      console.log('Sending AI analysis with context:', { symbol, context });
      
      const response = await api.post('/ai/trade/analyze-with-context', {
        symbol,
        context
      });
      
      console.log('AI analysis response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('AI analysis with context error:', error);
      return {
        success: false,
        decision: {
          action: 'HOLD',
          symbol,
          qty: 0,
          confidence: 0,
          reason: 'AI analysis failed - using fallback logic'
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
      const response = await api.post('/ai/trade/execute', { 
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
      const response = await api.post('/ai/trade/toggle', { auto_mode: autoMode });
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
      const response = await api.get('/ai/trade/status');
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
      const response = await api.get('/ai/trade/history', {
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
      console.log('开始获取账户快照数据...');
      
      // 分别处理每个请求，避免 Promise.all 一个失败全部失败
      let accountData = null;
      let positionsData = null;
      let ordersData = null;
      
      try {
        console.log('调用账户接口: /ai/alpaca/account');
        const accountResponse = await api.get('/ai/alpaca/account');
        console.log('账户接口响应状态:', accountResponse.status);
        console.log('账户接口响应数据:', accountResponse.data);
        accountData = accountResponse.data;
        console.log('accountData.success:', accountData?.success);
        console.log('accountData.data:', accountData?.data);
        console.log('accountData.data?.cash:', accountData?.data?.cash);
      } catch (accountError) {
        console.error('获取账户信息失败:', accountError);
        accountData = { success: false, data: null };
      }
      
      try {
        const positionsResponse = await api.get('/ai/alpaca/positions');
        console.log('持仓接口响应:', positionsResponse.data);
        positionsData = positionsResponse.data;
      } catch (positionsError) {
        console.error('获取持仓信息失败:', positionsError);
        positionsData = { success: false, data: [] };
      }
      
      try {
        const ordersResponse = await api.get('/ai/alpaca/orders?status=open&limit=50');
        console.log('订单接口响应:', ordersResponse.data);
        ordersData = ordersResponse.data;
      } catch (ordersError) {
        console.error('获取订单信息失败:', ordersError);
        ordersData = { success: false, data: [] };
      }
      
      // 即使部分请求失败，也返回已有的数据
      // 确保正确处理 backend 返回的数据结构
      const accountCash = accountData?.success === true ? (accountData?.data?.cash || 0) : 0;
      const accountEquity = accountData?.success === true ? (accountData?.data?.equity || 0) : 0;
      const accountBuyingPower = accountData?.success === true ? (accountData?.data?.buyingPower || 0) : 0;
      const accountPortfolioValue = accountData?.success === true ? (accountData?.data?.portfolioValue || 0) : 0;
      const accountNumber = accountData?.success === true ? (accountData?.data?.accountNumber || '') : '';
      const accountStatus = accountData?.success === true ? (accountData?.data?.status || '') : '';
      
      const positionsCount = positionsData?.success === true ? (positionsData?.data?.length || 0) : 0;
      const openOrdersCount = ordersData?.success === true ? (ordersData?.data?.length || 0) : 0;
      
      const result = {
        cash: accountCash,
        equity: accountEquity,
        buyingPower: accountBuyingPower,
        portfolioValue: accountPortfolioValue,
        positionsCount: positionsCount,
        openOrdersCount: openOrdersCount,
        accountNumber: accountNumber,
        status: accountStatus,
        // 添加详细的调试信息
        debug: {
          accountSuccess: accountData?.success || false,
          positionsSuccess: positionsData?.success || false,
          ordersSuccess: ordersData?.success || false,
          accountData: accountData?.data ? '有数据' : '无数据',
          positionsData: positionsData?.data ? `有${positionsData.data.length}条数据` : '无数据',
          ordersData: ordersData?.data ? `有${ordersData.data.length}条数据` : '无数据',
          accountDataRaw: accountData,
          positionsDataRaw: positionsData,
          ordersDataRaw: ordersData,
          calculatedCash: accountCash,
          calculatedEquity: accountEquity
        }
      };
      
      console.log('getAccountSnapshot 返回结果:', result);
      return result;
    } catch (error) {
      console.error('获取账户快照总体错误:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        cash: 0,
        equity: 0,
        buyingPower: 0,
        portfolioValue: 0,
        positionsCount: 0,
        openOrdersCount: 0,
        accountNumber: '',
        status: '',
        debug: {
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Block 2: 获取详细的账户、持仓、订单数据
  async getAlpacaAccount(): Promise<any> {
    try {
      console.log('调用 Alpaca 账户接口...');
      const response = await api.get('/ai/alpaca/account');
      console.log('Alpaca 账户接口响应:', response.data);
      
      // 确保返回的数据包含 isMockData 字段
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            ...response.data.data,
            isMockData: response.data.data.isMockData || false,
            message: response.data.data.message || ''
          }
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca account error:', error);
      console.error('错误详情:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message || '获取账户信息失败',
        data: null
      };
    }
  }

  async getAlpacaPositions(): Promise<any> {
    try {
      const response = await api.get('/ai/alpaca/positions');
      
      // 如果请求成功，对数据进行字段映射
      if (response.data.success && response.data.data) {
        const normalizedPositions = response.data.data.map((p: any) => {
          // 按照要求的映射逻辑
          return {
            // 基础信息
            symbol: p.symbol ?? '',
            assetId: p.asset_id ?? p.assetId ?? '',
            assetClass: p.asset_class ?? p.assetClass ?? '',
            exchange: p.exchange ?? '',
            assetMarginable: p.asset_marginable ?? p.assetMarginable ?? false,
            
            // 数量信息
            qty: Number(p.qty ?? 0),
            qtyAvailable: Number(p.qty_available ?? p.qtyAvailable ?? 0),
            quantity: Number(p.qty ?? p.quantity ?? 0),
            side: p.side ?? (Number(p.qty ?? 0) >= 0 ? 'long' : 'short'),
            
            // 价格信息
            price: Number(p.currentPrice ?? p.current_price ?? 0),
            currentPrice: Number(p.currentPrice ?? p.current_price ?? 0),
            avgEntry: Number(p.avgEntryPrice ?? p.avg_entry_price ?? p.avgPrice ?? 0),
            avgEntryPrice: Number(p.avgEntryPrice ?? p.avg_entry_price ?? p.avgPrice ?? 0),
            lastdayPrice: Number(p.lastday_price ?? p.lastdayPrice ?? 0),
            
            // 价值信息
            marketValue: Number(p.marketValue ?? p.market_value ?? 0),
            costBasis: Number(p.costBasis ?? p.cost_basis ?? 0),
            
            // 当日盈亏信息
            todayPlPercent: Number(p.unrealizedIntradayPLPercent ?? (p.unrealized_intraday_plpc ? p.unrealized_intraday_plpc * 100 : 0) ?? 0),
            todayPlValue: Number(p.unrealizedIntradayPL ?? p.unrealized_intraday_pl ?? 0),
            
            // 总盈亏信息
            totalPlPercent: Number(p.unrealizedPLPercent ?? (p.unrealized_plpc ? p.unrealized_plpc * 100 : 0) ?? 0),
            totalPlValue: Number(p.unrealizedPL ?? p.unrealized_pl ?? 0),
            
            // 当日变化
            changeToday: Number(p.changeToday ?? p.change_today ?? 0),
            
            // 元数据
            isMockData: p.isMockData || false,
            message: p.message || ''
          };
        });
        
        return {
          ...response.data,
          data: normalizedPositions
        };
      }
      
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
      const response = await api.get('/ai/alpaca/orders', {
        params: { status }
      });
      
      // 如果请求成功，对数据进行字段映射
      if (response.data.success && response.data.data) {
        const normalizedOrders = response.data.data.map((order: any) => ({
          id: order.id || '',
          symbol: order.symbol || '',
          qty: Number(order.qty || order.quantity || 0),
          quantity: Number(order.qty || order.quantity || 0),  // 确保 quantity 字段有值
          filled_qty: Number(order.filled_qty || order.filledQty || 0),
          filledQty: Number(order.filled_qty || order.filledQty || 0),
          filled_avg_price: Number(order.filled_avg_price || order.filledAvgPrice || 0),
          filledAvgPrice: Number(order.filled_avg_price || order.filledAvgPrice || 0),
          side: order.side || '',
          type: order.type || '',
          limit_price: order.limit_price || order.limitPrice || null,
          limitPrice: order.limit_price || order.limitPrice || null,
          status: order.status || '',
          created_at: order.created_at || order.createdAt || '',
          createdAt: order.created_at || order.createdAt || '',
          submitted_at: order.submitted_at || order.submittedAt || order.created_at || order.createdAt || '',
          submittedAt: order.submitted_at || order.submittedAt || order.created_at || order.createdAt || '',
          time_in_force: order.time_in_force || order.timeInForce || '',
          timeInForce: order.time_in_force || order.timeInForce || '',
          isMockData: order.isMockData || false,
          message: order.message || ''
        }));
        
        return {
          ...response.data,
          data: normalizedOrders
        };
      }
      
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
      const response = await api.get('/ai/alpaca/orders/history', {
        params: { limit, status: 'all' }
      });
      
      // 如果请求成功，对数据进行字段映射
      if (response.data.success && response.data.data) {
        const normalizedOrders = response.data.data.map((order: any) => ({
          id: order.id || '',
          symbol: order.symbol || '',
          qty: Number(order.qty || order.quantity || 0),
          quantity: Number(order.qty || order.quantity || 0),  // 确保 quantity 字段有值
          filled_qty: Number(order.filled_qty || order.filledQty || 0),
          filledQty: Number(order.filled_qty || order.filledQty || 0),
          filled_avg_price: Number(order.filled_avg_price || order.filledAvgPrice || 0),
          filledAvgPrice: Number(order.filled_avg_price || order.filledAvgPrice || 0),
          side: order.side || '',
          type: order.type || '',
          limit_price: order.limit_price || order.limitPrice || null,
          limitPrice: order.limit_price || order.limitPrice || null,
          status: order.status || '',
          created_at: order.created_at || order.createdAt || '',
          createdAt: order.created_at || order.createdAt || '',
          submitted_at: order.submitted_at || order.submittedAt || order.created_at || order.createdAt || '',
          submittedAt: order.submitted_at || order.submittedAt || order.created_at || order.createdAt || '',
          time_in_force: order.time_in_force || order.timeInForce || '',
          timeInForce: order.time_in_force || order.timeInForce || '',
          isMockData: order.isMockData || false,
          message: order.message || ''
        }));
        
        return {
          ...response.data,
          data: normalizedOrders
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Get Alpaca orders history error:', error);
      return {
        success: false,
        data: []
      };
    }
  }

  // Place Alpaca Order
  async placeAlpacaOrder(orderData: any): Promise<any> {
    try {
      console.log('Placing Alpaca order:', orderData);
      
      // 调用后端下单接口
      const response = await api.post('/api/ai/alpaca/orders', orderData);
      
      console.log('Order response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Place Alpaca order error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || '下单失败'
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
      console.log('saveProviderConfig 调用，配置:', config);
      const response = await api.post('/api/ai/provider/config', config);
      console.log('Save provider config response:', response.data);
      console.log('response.data.success:', response.data.success);
      console.log('response.data.message:', response.data.message);
      
      // Backend 返回的 config 可能包含 baseURL（大写），但前端接口期望 baseUrl（小写）
      // 规范化配置对象以确保类型安全
      const backendConfig = response.data.config || {};
      const normalizedConfig: AIProviderConfig = {
        provider: backendConfig.provider || config.provider,
        apiKey: backendConfig.apiKey || config.apiKey,
        // 处理 baseURL/baseUrl 字段名不一致问题
        baseUrl: backendConfig.baseUrl || backendConfig.baseURL || config.baseUrl,
        model: backendConfig.model || config.model
      };
      
      return {
        success: response.data.success === true,
        config: normalizedConfig
      };
    } catch (error: any) {
      console.error('Save provider config error:', error);
      console.error('Error details:', error.response?.data || error.message);
      // 返回符合 AIProviderConfigResponse 接口的响应
      return {
        success: false,
        config: config
      };
    }
  }

  async getProviderConfig(): Promise<AIProviderConfigResponse> {
    try {
      const response = await api.get('/api/ai/provider/config');
      console.log('getProviderConfig response:', response.data);
      
      // Backend 返回的 config 可能包含 baseURL（大写），但前端接口期望 baseUrl（小写）
      // 规范化配置对象以确保类型安全
      const backendConfig = response.data.config || {};
      const normalizedConfig: AIProviderConfig = {
        provider: backendConfig.provider || 'DeepSeek',
        apiKey: backendConfig.apiKey || '',
        // 处理 baseURL/baseUrl 字段名不一致问题
        baseUrl: backendConfig.baseUrl || backendConfig.baseURL || 'https://api.deepseek.com/v1',
        model: backendConfig.model || 'deepseek-chat'
      };
      
      return {
        success: response.data.success === true,
        config: normalizedConfig
      };
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
      const response = await api.get('/ai/trading/environment');
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
      const response = await api.post('/ai/trading/environment', environment);
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
      const response = await api.post('/ai/chat', {
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
      
      const response = await api.get('/ai/chat/history', { params });
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
      const response = await api.post('/ai/chat/clear', { symbol });
      return response.data;
    } catch (error: any) {
      console.error('Clear chat history error:', error);
      return {
        success: false,
        error: error.message || '清空聊天历史失败'
      };
    }
  }

  // Portfolio History 接口
  async getPortfolioHistory(range: string = '1D'): Promise<any> {
    try {
      console.log('📊 [1] 调用portfolio history接口，range:', range);
      const response = await api.get('/ai/alpaca/portfolio/history', {
        params: { range }
      });
      
      console.log('📊 [2] portfolio history原始响应结构:', {
        status: response.status,
        success: response.data?.success,
        dataLength: response.data?.data?.length,
        responseKeys: Object.keys(response.data || {}),
        hasDataArray: Array.isArray(response.data?.data),
        responseData: response.data
      });
      
      // 如果请求成功，对数据进行处理
      if (response.data.success && response.data.data) {
        const normalizedData = response.data.data.map((item: any, index: number) => {
          // 处理时间戳：后端已经转换为毫秒，直接使用
          let timestamp = item.timestamp;
          
          // 如果时间戳是数字，确保是毫秒
          if (typeof timestamp === 'number') {
            // 如果时间戳小于1e12，可能是秒，转换为毫秒
            if (timestamp < 1e12) {
              timestamp = timestamp * 1000;
            }
          }
          
          const result = {
            timestamp: timestamp || '',
            equity: Number(item.equity || 0),  // 只使用equity字段
            pnl: Number(item.pnl || item.profit_loss || 0),
            pnlPct: Number(item.pnlPct || item.profit_loss_pct || 0),
            isMockData: item.isMockData || false
          };
          
          // 打印前3个点的详细信息
          if (index < 3) {
            console.log(`📊 [3] portfolio history点[${index}]:`, {
              rawItem: item,
              normalized: result,
              timestamp: result.timestamp,
              equity: result.equity,
              timestampType: typeof result.timestamp,
              equityType: typeof result.equity
            });
          }
          
          return result;
        }).filter((item: any) => {
          // 过滤无效数据点
          const ts = this.normalizeTimestamp(item.timestamp);
          return ts !== null && Number.isFinite(item.equity);
        });
        
        console.log('📊 [4] portfolio history处理完成:', {
          原始数据点数量: response.data.data.length,
          过滤后数据点数量: normalizedData.length,
          第一个点: normalizedData[0],
          最后一个点: normalizedData[normalizedData.length - 1]
        });
        
        return {
          ...response.data,
          data: normalizedData
        };
      }
      
      console.log('📊 [5] portfolio history响应格式不正确:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Get portfolio history error:', error);
      return {
        success: false,
        data: [],
        range: range,
        isMockData: true,
        message: '获取portfolio历史数据失败'
      };
    }
  }
  
  // 时间戳规范化函数
  private normalizeTimestamp(timestamp: number | string): number | null {
    const n = Number(timestamp);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? n * 1000 : n;
  }
}

export default new AITradingService();