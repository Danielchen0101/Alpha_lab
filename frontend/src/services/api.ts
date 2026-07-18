import axios from 'axios';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import { hasSessionAwayExpired, readAwaySince, refreshSessionOnce } from './authSession';

const rawApiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '/api';

  let normalized = trimmed.replace(/\/+$/, '');
  normalized = normalized.replace(/(\/api)+$/i, '/api');

  if (/^https?:\/\/[^/]+$/i.test(normalized)) {
    return `${normalized}/api`;
  }

  return normalized || '/api';
};

export const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl || '/api');
export const apiBaseUrlConfigError =
  process.env.NODE_ENV === 'production' && !rawApiBaseUrl
    ? 'REACT_APP_API_BASE_URL is not set'
    : '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Heavy scans have a longer boundary than ordinary reads, while still failing
// cleanly if a connection is lost instead of leaving the interface waiting forever.
const scannerApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const statusApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
      const refreshedSession = await refreshSessionOnce();
      if (refreshedSession) session = refreshedSession;
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
statusApi.interceptors.request.use(attachSupabaseToken);

// Attach Supabase token to all requests
api.interceptors.request.use(attachSupabaseToken);

// Recover once from an expired access token. A brief background-tab refresh
// failure should not destroy an otherwise persisted Supabase session.
const handle401 = async (error: any) => {
  if (error.response?.status !== 401) return Promise.reject(error);

  const requestConfig = error.config as any;
  if (requestConfig && !requestConfig._authRetry) {
    requestConfig._authRetry = true;
    try {
      const refreshedSession = await refreshSessionOnce();
      if (refreshedSession?.access_token) {
        requestConfig.headers = requestConfig.headers || {};
        requestConfig.headers.Authorization = `Bearer ${refreshedSession.access_token}`;
        return axios.request(requestConfig);
      }
    } catch {
      // The session check below decides whether this is a real sign-out.
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  const awayExpired = hasSessionAwayExpired(readAwaySince());
  if (session && !awayExpired) {
    return Promise.reject(error);
  }

  window.dispatchEvent(new Event('alphalab:auth-lost'));
  try { await supabase.auth.signOut(); } catch {}
  window.location.href = '/signin';
  return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handle401);
scannerApi.interceptors.response.use((response) => response, handle401);

export interface ConfigStatusResponse {
  success?: boolean;
  backend?: 'ok' | 'error';
  supabase?: 'ok' | 'error';
  auth?: 'ok' | 'error';
  errorCode?: string | null;
  message?: string;
  user?: {
    authenticated?: boolean;
    userResolved?: boolean;
    userId?: string | null;
  };
  ai?: {
    configured?: boolean;
    keyIsMasked?: boolean;
    testStatus?: string;
    lastTestError?: string | null;
  };
  aiProvider?: {
    status?: 'connected' | 'not_configured' | 'error' | 'checking';
    message?: string;
  };
  alpaca?: {
    status?: 'connected' | 'not_configured' | 'error' | 'checking';
    paperConfigured?: boolean;
    liveConfigured?: boolean;
    message?: string;
  };
  alpacaMarketData?: {
    configured?: boolean;
  };
  finnhub?: {
    status?: 'connected' | 'not_configured' | 'error' | 'checking';
    configured?: boolean;
    message?: string;
  };
}

export interface ConfigStatusLoadResult {
  ok: boolean;
  data?: ConfigStatusResponse;
  errorCode?: string;
  message: string;
  httpStatus?: number;
  timedOut?: boolean;
  backendWaking?: boolean;
}

const CONFIG_STATUS_CACHE_MS = 30000;
const CONFIG_STATUS_RETRY_DELAY_MS = 2000;
const DEFAULT_CONFIG_STATUS_TIMEOUT_MS = 10000;

let configStatusCache: { fetchedAt: number; result: ConfigStatusLoadResult } | null = null;
let configStatusInflight: Promise<ConfigStatusLoadResult> | null = null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableStatusError = (error: any): boolean => {
  const status = error?.response?.status;
  return !error?.response || error?.code === 'ECONNABORTED' || status === 408 || status === 429 || status >= 500;
};

const statusErrorResult = (error: any, backendWaking = false): ConfigStatusLoadResult => {
  const responseData = error?.response?.data || {};
  const status = error?.response?.status;

  if (error?.code === 'ECONNABORTED') {
    return {
      ok: false,
      errorCode: 'backend_timeout',
      message: 'Backend timeout',
      httpStatus: status,
      timedOut: true,
      backendWaking,
    };
  }

  if (!error?.response) {
    return {
      ok: false,
      errorCode: 'backend_unreachable',
      message: 'Backend unreachable',
      backendWaking,
    };
  }

  if (status === 401 || status === 403) {
    return {
      ok: false,
      errorCode: responseData.errorCode || 'unauthorized',
      message: responseData.message || 'Please sign in again',
      httpStatus: status,
    };
  }

  return {
    ok: false,
    errorCode: responseData.errorCode || responseData.code || 'connection_check_failed',
    message: responseData.message || responseData.error || 'Connection check failed',
    httpStatus: status,
    backendWaking,
  };
};

export const clearConfigStatusCache = () => {
  configStatusCache = null;
};

export const loadConfigStatus = async (options: {
  force?: boolean;
  timeoutMs?: number;
  onRetry?: (result: ConfigStatusLoadResult) => void;
} = {}): Promise<ConfigStatusLoadResult> => {
  const now = Date.now();
  if (!options.force && configStatusCache && now - configStatusCache.fetchedAt < CONFIG_STATUS_CACHE_MS) {
    return configStatusCache.result;
  }

  if (configStatusInflight) return configStatusInflight;

  configStatusInflight = (async () => {
    if (apiBaseUrlConfigError) {
      const result = {
        ok: false,
        errorCode: 'api_base_url_missing',
        message: apiBaseUrlConfigError,
      };
      configStatusCache = { fetchedAt: Date.now(), result };
      return result;
    }

    if (supabaseConfigError) {
      const result = {
        ok: false,
        errorCode: 'supabase_auth_unavailable',
        message: supabaseConfigError,
      };
      configStatusCache = { fetchedAt: Date.now(), result };
      return result;
    }

    const timeout = options.timeoutMs || DEFAULT_CONFIG_STATUS_TIMEOUT_MS;

    try {
      const response = await statusApi.get<ConfigStatusResponse>('/config/status', { timeout });
      const result = {
        ok: !!response.data?.success,
        data: response.data,
        errorCode: response.data?.errorCode || undefined,
        message: response.data?.message || 'OK',
      };
      configStatusCache = { fetchedAt: Date.now(), result };
      return result;
    } catch (error: any) {
      const firstFailure = statusErrorResult(error);
      if (isRetryableStatusError(error)) {
        const wakingResult = {
          ...firstFailure,
          errorCode: firstFailure.errorCode === 'backend_timeout' ? 'backend_waking' : firstFailure.errorCode,
          message: 'Backend is waking up, retrying...',
          backendWaking: true,
        };
        options.onRetry?.(wakingResult);
        await sleep(CONFIG_STATUS_RETRY_DELAY_MS);

        try {
          const retryResponse = await statusApi.get<ConfigStatusResponse>('/config/status', { timeout });
          const retryResult = {
            ok: !!retryResponse.data?.success,
            data: retryResponse.data,
            errorCode: retryResponse.data?.errorCode || undefined,
            message: retryResponse.data?.message || 'OK',
          };
          configStatusCache = { fetchedAt: Date.now(), result: retryResult };
          return retryResult;
        } catch (retryError: any) {
          const result = statusErrorResult(retryError, true);
          configStatusCache = { fetchedAt: Date.now(), result };
          return result;
        }
      }

      configStatusCache = { fetchedAt: Date.now(), result: firstFailure };
      return firstFailure;
    }
  })().finally(() => {
    configStatusInflight = null;
  });

  return configStatusInflight;
};

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
  validate: (candidates: any[], period = '2y', initialCapital = 100000, options: any = {}) => {
    return scannerApi.post('/ai/deeper-validation', {
      candidates,
      period,
      initialCapital,
      ...options,
    }, { timeout: 600000 });
  },
};

// Entry Plan API (deterministic entry/stop/target calculator)
export const entryPlanAPI = {
  generate: (candidates: any[], accountSize = 100000, riskPerTradePct = 1, maxPositionPct = 10,
             existingPositions: any[] = [], dailyLoss = 0, holdingSymbols: string[] = [],
             executionMode = 'Recommend Only', accountMode = 'paper',
             riskProfile = 'medium', timeHorizon = 'mid', pipelineMode = 'hybrid',
             leverageEnabled = false) => {
    return api.post('/ai/entry-plan', {
      candidates, accountSize, riskPerTradePct, maxPositionPct,
      existingPositions, dailyLoss, holdingSymbols, executionMode, accountMode,
      riskProfile, timeHorizon, pipelineMode, leverageEnabled
    });
  },
  execute: (data: {
    symbol: string;
    planSnapshot: any;
    executionMode: string;
    liveConfirm?: boolean;
    confirmText?: string;
    clientOrderId?: string;
    client_order_id?: string;
    isAutoExecute?: boolean;
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

export interface WorkspacePreferences {
  tradeMode: 'paper' | 'real';
  pipelineMode: 'manual' | 'hybrid' | 'ai';
  riskProfile: 'low' | 'medium' | 'high';
  timeHorizon: 'short' | 'mid' | 'long';
  leverageEnabled: boolean;
  scheduleEnabled: boolean;
  intervalMinutes: number;
  liveAutoTradingEnabled: boolean;
  language?: 'en-US' | 'zh-CN' | null;
  strategyPolicy?: any;
  updatedAt?: string;
  general: {
    timezone: string;
    currency: string;
    numberFormat: 'standard' | 'compact';
    defaultLandingPage: '/dashboard' | '/market' | '/agent' | '/trade' | '/portfolio';
    fontScale: 'compact' | 'comfortable' | 'large';
    density: 'compact' | 'comfortable' | 'spacious';
    reduceMotion: boolean;
    themeMode: 'light' | 'dark' | 'system';
  };
  trading: {
    defaultOrderType: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    extendedHours: boolean;
    orderSizeMode: 'shares' | 'dollars';
    limitOffsetBps: number;
    confirmationPolicy: 'always' | 'live_only';
  };
  risk: {
    maxOrderNotional: number;
    maxPositionPct: number;
    dailyLossLimitPct: number;
    sectorConcentrationPct: number;
    maxOpenPositions: number;
    staleQuoteSeconds: number;
    blockOnStaleQuote: boolean;
    circuitBreakerEnabled: boolean;
  };
  research: {
    universe: 'alpaca_market' | 'sp500' | 'nasdaq100' | 'watchlist';
    excludedSymbols: string[];
    excludedSectors: string[];
    minPrice: number;
    minMarketCap: number;
    minDollarVolume: number;
    maxSymbols: number;
    outputSize: number;
    aiReviewLimit: number;
    dataFreshnessSeconds: number;
    includeExtendedHours: boolean;
  };
  charts: {
    timeframe: '1D' | '1W' | '1M' | '3M' | '1Y';
    chartType: 'candles' | 'line' | 'area';
    adjustedData: boolean;
    session: 'regular' | 'extended';
    benchmark: string;
    precision: number;
    showEvents: boolean;
  };
  notifications: {
    inApp: boolean;
    discord: boolean;
    tradeActivity: boolean;
    recommendations: boolean;
    riskAlerts: boolean;
    pipelineDigest: boolean;
    dataQuality: boolean;
    securityAlerts: boolean;
    deliveryMode: 'instant' | 'digest';
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
  };
  security: {
    inactivityTimeoutMinutes: number;
    newDeviceAlerts: boolean;
    sensitiveActionConfirmation: boolean;
  };
}

export const workspacePreferencesAPI = {
  get: () => api.get<{ success: boolean; preferences: WorkspacePreferences }>('/user/preferences'),
  update: (data: Partial<Pick<WorkspacePreferences, 'tradeMode' | 'pipelineMode' | 'riskProfile' | 'timeHorizon' | 'leverageEnabled' | 'language' | 'general' | 'trading' | 'risk' | 'research' | 'charts' | 'notifications' | 'security'>>) =>
    api.patch<{ success: boolean; preferences: WorkspacePreferences }>('/user/preferences', data),
  registerDevice: (data: { deviceId: string; deviceLabel: string; timezone: string }) =>
    api.post<{ success: boolean; isNew: boolean; registered: boolean }>('/user/security/device', data),
};

// Pipeline Auto API (market-hours auto pipeline scheduler)
export const pipelineAutoAPI = {
  getStatus: () => api.get('/ai-agent/pipeline-auto/status'),
  setLiveAuthority: (enabled: boolean) =>
    api.patch<{
      success: boolean;
      liveAutoTradingEnabled: boolean;
      preferences?: WorkspacePreferences;
      reason?: string;
      message?: string;
    }>('/ai-agent/live-auto-authority', { enabled }),
  saveConfig: (data: { enabled: boolean; intervalMinutes?: number | null; mode: string; lastRunAt?: string; riskProfile?: string; timeHorizon?: string; tradeMode?: string; leverageEnabled?: boolean; liveAutoTradingEnabled?: boolean }) =>
    api.post('/ai-agent/pipeline-auto/config', data),
  getHistory: (limit = 5) =>
    api.get<{ success: boolean; history: any[]; count: number }>(`/ai-agent/pipeline-auto/history?limit=${limit}`),
  getMarketSchedule: (days = 15) =>
    api.get<{ success: boolean; timezone: string; source: string; warning?: string; days: any[] }>(`/ai-agent/pipeline-auto/market-schedule?days=${days}`),
  runHeadlessTest: (data?: { dryRun?: boolean; mode?: string; intervalMinutes?: number }) =>
    api.post('/ai-agent/pipeline-auto/run-headless-test', data || { dryRun: true }),
  runNow: (data?: {}) =>
    api.post<{
      success: boolean;
      runId?: string;
      status?: string;
      error?: string;
      message?: string;
      orderAuthority?: {
        authorized: boolean;
        buyAuthorized: boolean;
        sellAuthorized: boolean;
        code: string;
        message: string;
        pipelineMode: string;
        tradeMode: string;
      };
    }>('/ai-agent/pipeline-auto/run-now', data || {}),
  runPipeline: (data: { trigger?: string; mode?: string; intervalMinutes?: number; riskProfile?: string; timeHorizon?: string; tradeMode?: string; leverageEnabled?: boolean }) =>
    api.post('/ai-agent/pipeline/run', data),
  getPipelineResult: (runId?: string, kind?: 'manual' | 'auto') =>
    api.get('/ai-agent/pipeline/result', { params: { runId, kind } }),
  stopPipeline: () => api.post('/ai-agent/pipeline/stop'),
  // Shared Continue Scan + Fine Scan — delegates to backend shared helpers.
  // Fine Scan can run AI trader review across 30 symbols, so it needs a longer timeout than normal UI calls.
  runContinueScan: (data: { scannerResults: any[]; riskProfile?: string; timeHorizon?: string; pipelineMode?: string; tradeMode?: string }) =>
    api.post('/ai-agent/continue-scan', data),
  runFineScan: (data: { candidates: any[]; riskProfile?: string; timeHorizon?: string; pipelineMode?: string; tradeMode?: string }) =>
    scannerApi.post('/ai-agent/fine-scan', data, { timeout: 240000 }),
  runAdmission: (data: { candidates: any[]; fineResults?: any[]; marketResults?: any[]; accountState?: any; riskProfile?: string; timeHorizon?: string; pipelineMode?: string; aiEnabled?: boolean }) =>
    scannerApi.post('/ai-agent/admission', data, { timeout: 90000 }),
  runExitScan: (data: { entryPlans?: any[]; riskProfile?: string; timeHorizon?: string; pipelineMode?: string; tradeMode?: string; autoSubmit?: boolean; aiReview?: boolean; suppressDiscord?: boolean }) =>
    scannerApi.post('/ai-agent/exit-scan', data, { timeout: 120000 }),
  // Lazy-fetch Alpaca News for a single symbol (on-demand when user expands a detail row)
  fetchScannerNews: (symbol: string) =>
    api.get(`/ai-agent/scanner-news/${symbol}`),
  // DEPRECATED: Auto-run is now fully headless. No frontend claim needed.
  // claimRun: (runKey: string) => api.post('/ai-agent/pipeline-auto/claim-run', { runKey }),
};

// Discord webhook notification settings and event bridge
export const notificationAPI = {
  getDiscordConfig: () => api.get('/notifications/discord/config'),
  saveDiscordConfig: (data: any) => api.post('/notifications/discord/config', data),
  testDiscord: (data?: any) => api.post('/notifications/discord/test', data || {}),
  sendDiscordEvent: (
    eventType: 'cycle_digest' | 'risk_alert' | 'recommendation' | 'order' | 'scan_summary' | 'entry_plan' | 'exit_scan' | 'error',
    payload: any
  ) => api.post('/notifications/discord/event', { eventType, payload }),
};

export { scannerApi };
export default api;
