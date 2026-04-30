import axios from 'axios';

// 使用相对路径，依赖React代理
// 开发环境：/api/* → http://127.0.0.1:8889/api/* (通过package.json proxy)
// 生产环境：通过环境变量REACT_APP_API_BASE_URL配置
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// 调试：输出环境变量
console.log('[api.ts调试] API_BASE_URL:', API_BASE_URL);
console.log('[api.ts调试] REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 增加到30秒，避免Backtest超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 为scanner AI分析创建专用实例，没有timeout限制
const scannerApi = axios.create({
  baseURL: API_BASE_URL,
  // 不设置timeout，让scanner可以等待AI分析完成
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器用于调试（仅记录优化请求）
api.interceptors.request.use(
  (config) => {
    if (config.url && config.url.includes('/backtest/optimize')) {
      console.log('=== OPTIMIZATION REQUEST ===');
      console.log('URL:', config.url);
      console.log('Method:', config.method);
      console.log('Data:', config.data);
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器用于调试（仅记录优化响应）
api.interceptors.response.use(
  (response) => {
    if (response.config.url && response.config.url.includes('/backtest/optimize')) {
      console.log('=== OPTIMIZATION RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Success:', response.data?.success);
    }
    return response;
  },
  (error) => {
    console.error('Response error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  register: (userData: any) => api.post('/auth/register', userData),
};

// System API
export const systemAPI = {
  getSystemStatus: () => api.get('/system/status'),
  getSystemMetrics: () => api.get('/system/metrics'),
};

// Market API
export const marketAPI = {
  getStocks: () => api.get('/market/stocks'),
  getStockData: (symbol: string) => api.get(`/market/stock/${symbol}`),
  getStockHistory: (symbol: string, interval?: string, range?: string) => {
    const params: any = {};
    if (interval) params.interval = interval;
    if (range) params.range = range;
    return api.get(`/market/history/${symbol}`, { params });
  },
};

// Backtrader API
export const backtraderAPI = {
  runBacktest: (config: any) => api.post('/backtest/run', config),
  getBacktestResults: (id: string) => api.get(`/backtest/results/${id}`),
  getBacktestHistory: () => api.get('/backtest/history'),
  runParameterOptimization: (config: any) => {
    console.log('=== API CALL: runParameterOptimization ===');
    console.log('Request config:', JSON.stringify(config, null, 2));
    return api.post('/backtest/optimize', config);
  },
};

// User API
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (profileData: any) => api.put('/user/profile', profileData),
};

// Entry Quality API
export const entryQualityAPI = {
  assessEntry: (symbol: string) => {
    return api.post('/ai/entry-quality', { symbol });
  },
};

// Fine Scan Advanced API (Steps 6-8: Liquidity, News, Risk)
export const fineScanAdvancedAPI = {
  scan: (symbol: string, entryDetails?: any) => {
    return api.post('/ai/fine-scan-advanced', { symbol, entryDetails });
  },
};

export const fineScanSelectAPI = {
  select: (candidates: any[]) => {
    return api.post('/ai/fine-scan-select', { candidates });
  },
};

export const deeperValidationAPI = {
  validate: (candidates: any[], period = '1y', initialCapital = 100000) => {
    return api.post('/ai/deeper-validation', { candidates, period, initialCapital });
  },
};

// Entry Plan API (deterministic entry/stop/target calculator)
export const entryPlanAPI = {
  generate: (candidates: any[], accountSize = 100000, riskPerTradePct = 1, maxPositionPct = 10,
             existingPositions: any[] = [], dailyLoss = 0, holdingSymbols: string[] = [],
             executionMode = 'Recommend Only', accountMode = 'paper') => {
    return api.post('/ai/entry-plan', {
      candidates, accountSize, riskPerTradePct, maxPositionPct,
      existingPositions, dailyLoss, holdingSymbols, executionMode, accountMode
    });
  },
  execute: (data: {
    symbol: string;
    planSnapshot: any;
    executionMode: string;
    liveConfirm?: boolean;
    confirmText?: string;
  }) => {
    return api.post('/entry-plan/execute', data);
  },
};

// AI Agent Watchlist API
export const aiAgentWatchlistAPI = {
  list: () => api.get('/ai-agent/watchlist'),
  add: (item: any) => api.post('/ai-agent/watchlist', item),
  remove: (id: string) => api.delete(`/ai-agent/watchlist/${id}`),
  updateStatus: (id: string, data: { status?: string; nextStep?: string }) =>
    api.patch(`/ai-agent/watchlist/${id}`, data),
};

// Fine Scan AI Decision (per-symbol Continue/Watch/Skip + Grade with source tracking)
export const fineScanDecisionAPI = {
  decide: (data: FineScanDecisionRequest) => {
    return api.post('/ai/fine-scan-decision', data);
  },
};

export interface FineScanDecisionRequest {
  symbol: string;
  trendLabel: string;
  trendScore: number;
  matchedStrategies: string[];
  matchConfidence: number;
  backtestStatus: string;
  backtestPerformance: string;
  backtestTotalReturn?: number;
  entryQuality: { grade?: string; score?: number; zone?: string; };
  liquidityGrade: string;
  newsGrade: string;
  riskGrade: string;
  riskScore: number;
  entryScore: number;
}

export interface FineScanDecisionResponse {
  success: boolean;
  symbol: string;
  decision: 'CONTINUE' | 'WATCH' | 'SKIP';
  grade: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  reason: string;
  source: 'ai' | 'local-rule';
  decisionDetail: {
    strengths: string[];
    warnings: string[];
    blockers: string[];
  };
}

// Fine Scan AI Explanation Layer (generates narrative text only, no metrics)
export const fineScanExplainAPI = {
  explain: (data: FineScanExplainRequest) => {
    return api.post('/ai/fine-scan-explain', data);
  },
};

export interface FineScanExplainRequest {
  symbol: string;
  trendLabel: string;
  trendScore: number;
  matchedStrategies: string[];
  backtestMetrics: {
    totalReturn?: number;
    sharpe?: number;
    winRate?: number;
    profitFactor?: number;
    maxDrawdown?: number;
    tradeCount?: number;
  };
  optimizationMetrics: {
    stability?: string;
    avgReturn?: number;
    positiveRatio?: number;
  };
  entryQuality: {
    grade?: string;
    score?: number;
    atr?: number;
    zone?: string;
  };
  liquidity: {
    grade?: string;
    score?: number;
  };
  newsSummary: {
    grade?: string;
    headlineCount?: number;
  };
  riskAssessment: {
    grade?: string;
    score?: number;
    reason?: string;
  };
}

export interface FineScanExplainResponse {
  success: boolean;
  symbol: string;
  whyMatched: string;
  keySignalExplanation: string;
  finalReason: string;
  nextStep: string;
}

// Trading Account Mode API (paper / real)
export const tradingAccountAPI = {
  getAccount: (mode: 'paper' | 'real') => {
    return api.get<TradingAccountResponse>(`/trading/account?mode=${mode}`);
  },
};

export interface TradingAccountResponse {
  success: boolean;
  mode: 'paper' | 'real';
  available: boolean;
  error?: string;
  status?: string;
  cash?: number;
  equity?: number;
  buyingPower?: number;
  portfolioValue?: number;
  longMarketValue?: number;
  shortMarketValue?: number;
  patternDayTrader?: boolean;
  tradingBlocked?: boolean;
  currency?: string;
  id?: string;
}

export { scannerApi };
export default api;