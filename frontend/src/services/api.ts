import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 为scanner AI分析创建专用实例，没有timeout限制
const scannerApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Check if JWT is expired (decode exp claim, with 60s buffer)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !payload.exp || Date.now() >= (payload.exp * 1000 - 60000);
  } catch {
    return true;
  }
}

// Attach Supabase access token to all requests, refreshing if needed
const attachSupabaseToken = async (config: any) => {
  let { data: { session } } = await supabase.auth.getSession();
  // If token is expired, attempt refresh
  if (session?.access_token && isTokenExpired(session.access_token)) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        session = refreshed.session;
      }
    } catch (e) {
      console.warn('[Auth] Session refresh failed, will use existing token:', e);
    }
  }
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
};

scannerApi.interceptors.request.use(attachSupabaseToken);

// Attach Supabase token to all requests
api.interceptors.request.use(attachSupabaseToken);

// Global 401 interceptor: clear session and redirect to signin
const handle401 = async (error: any) => {
  if (error.response?.status === 401) {
    try {
      const { supabase } = await import('../lib/supabaseClient');
      await supabase.auth.signOut();
    } catch {}
    window.location.href = '/signin';
  }
  return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handle401);
scannerApi.interceptors.response.use((response) => response, handle401);

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
    return scannerApi.post('/ai/deeper-validation', { candidates, period, initialCapital });
  },
};

// Entry Plan API (deterministic entry/stop/target calculator)
export const entryPlanAPI = {
  generate: (candidates: any[], accountSize = 100000, riskPerTradePct = 1, maxPositionPct = 10,
             existingPositions: any[] = [], dailyLoss = 0, holdingSymbols: string[] = [],
             executionMode = 'Recommend Only', accountMode = 'paper',
             riskProfile = 'medium', timeHorizon = 'mid') => {
    return api.post('/ai/entry-plan', {
      candidates, accountSize, riskPerTradePct, maxPositionPct,
      existingPositions, dailyLoss, holdingSymbols, executionMode, accountMode,
      riskProfile, timeHorizon
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

// AI Execution Order API
export const aiExecutionAPI = {
  placeOrder: (data: {
    symbol: string; side: string; qty?: number; notional?: number;
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    limit_price?: number; stop_price?: number;
    trail_price?: number; trail_percent?: number;
    time_in_force?: string;
    tradingMode: string; automationMode: string;
    executionSource?: string; confirmed?: boolean;
  }) => api.post('/ai/execution/order', data),
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
  getPositions: (mode: 'paper' | 'real') => {
    return api.get<{ success: boolean; mode: string; modeUsed?: string; source?: 'alpaca_paper' | 'alpaca_real'; updatedAt?: string; reason?: string; positions: TradingPosition[]; error?: string }>(`/trading/positions?mode=${mode}`);
  },
  getOrders: (mode: 'paper' | 'real', status: string = 'open') => {
    return api.get<{ success: boolean; mode: string; modeUsed?: string; orders: any[]; error?: string }>(`/trading/orders?mode=${mode}&status=${status}`);
  },
  placeOrder: (orderData: {
    mode: 'paper' | 'real';
    symbol: string;
    side: 'buy' | 'sell';
    qty?: number;
    notional?: number;
    type?: string;
    time_in_force?: string;
    limit_price?: number;
    stop_price?: number;
    trail_price?: number;
    trail_percent?: number;
    extended_hours?: boolean;
    order_class?: string;
    take_profit?: { limit_price: number };
    stop_loss?: { stop_price: number; limit_price?: number };
    client_order_id?: string;
    confirmed?: boolean;
  }) => {
    return api.post<{
      success: boolean;
      status?: string;
      message?: string;
      order?: any;
      modeUsed?: string;
      endpointUsed?: string;
      error?: string;
    }>('/trading/order', orderData);
  },
  getPortfolioHistory: (mode: 'paper' | 'real', range: string = '1M') => {
    return api.get<{
      success: boolean;
      data: any[];
      count: number;
      range: string;
      modeUsed?: string;
      source?: 'alpaca_paper' | 'alpaca_real';
      updatedAt?: string;
      total_change?: number;
      total_change_pct?: number;
      first_value?: number;
      last_value?: number;
      error?: string;
      message?: string;
      reason?: string;
    }>(`/ai/alpaca/portfolio/history?mode=${mode}&range=${range}`);
  },
  getOrderStatus: (orderId: string, mode: 'paper' | 'real') => {
    return api.get<{ success: boolean; order?: any; error?: string; errorType?: string }>(`/trading/orders/${orderId}?mode=${mode}`);
  },
  cancelOrder: (orderId: string, mode: 'paper' | 'real') => {
    return api.post<{ success: boolean; orderId?: string; status?: string; error?: string; errorType?: string }>(`/trading/orders/${orderId}/cancel`, { mode });
  },
  getAsset: (symbol: string, mode: 'paper' | 'real') => {
    return api.get<{
      success: boolean; symbol?: string; name?: string; tradable?: boolean;
      status?: string; assetClass?: string; exchange?: string;
      fractionable?: boolean; easyToBorrow?: boolean; error?: string;
    }>(`/trading/asset/${symbol}?mode=${mode}`);
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
  dayTradeBuyingPower?: number;
  initialMargin?: number;
  maintenanceMargin?: number;
  lastEquity?: number;
  patternDayTrader?: boolean;
  tradingBlocked?: boolean;
  accountBlocked?: boolean;
  currency?: string;
  id?: string;
  modeUsed?: 'paper' | 'real';
  source?: 'alpaca_paper' | 'alpaca_real';
  updatedAt?: string;
  reason?: string;
  configured?: boolean;
}

export interface TradingPosition {
  symbol: string;
  qty?: number;
  side?: string;
  avgEntryPrice?: number;
  currentPrice?: number;
  marketValue?: number;
  costBasis?: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
  changeToday?: number;
  assetClass?: string;
  exchange?: string;
  lastUpdated?: string;
}

// Pipeline Auto API (market-hours auto pipeline scheduler)
export const pipelineAutoAPI = {
  getStatus: () => api.get('/ai-agent/pipeline-auto/status'),
  saveConfig: (data: { enabled: boolean; intervalMinutes?: number | null; mode: string; lastRunAt?: string }) =>
    api.post('/ai-agent/pipeline-auto/config', data),
  getHistory: (limit = 5) =>
    api.get<{ success: boolean; history: any[]; count: number }>(`/ai-agent/pipeline-auto/history?limit=${limit}`),
  getMarketSchedule: (days = 15) =>
    api.get<{ success: boolean; timezone: string; source: string; warning?: string; days: any[] }>(`/ai-agent/pipeline-auto/market-schedule?days=${days}`),
};

export { scannerApi };
export default api;
