import api, { scannerApi } from './api';

export type CryptoMode = 'paper' | 'live';
export type CryptoAction = 'BUY' | 'ADD' | 'HOLD' | 'REDUCE' | 'EXIT' | 'WAIT';
export const CRYPTO_LEDGER_LIMIT = 100;

export interface CryptoAssetSnapshot {
  symbol: string;
  name?: string;
  price?: number | null;
  change24h?: number | null;
  bid?: number | null;
  ask?: number | null;
  spreadBps?: number | null;
  volume?: number | null;
  tradable?: boolean;
  dataAvailable?: boolean;
  marketDataAvailable?: boolean;
  executionReady?: boolean;
  reasons?: string[];
  dataAgeSeconds?: number | null;
  signal?: {
    action?: CryptoAction;
    score?: number;
    regime?: 'risk_on' | 'transition' | 'risk_off' | string;
    confidence?: number;
    targetWeight?: number;
    reasons?: string[];
  };
}

export interface CryptoOverviewResponse {
  success: boolean;
  mode: CryptoMode;
  generatedAt?: string;
  account?: {
    configured?: boolean;
    cryptoStatus?: string;
    eligible?: boolean;
    eligibilityReasons?: string[];
    equity?: number | null;
    nonMarginableBuyingPower?: number | null;
  };
  assets?: CryptoAssetSnapshot[];
  positions?: Array<Record<string, unknown>>;
  automation?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  risk?: Record<string, unknown>;
  liveAdmission?: {
    admitted?: boolean;
    environmentVariable?: string;
    defaultMode?: string;
    algorithm?: string;
    reason?: string;
  };
  ai?: {
    configured?: boolean;
    status?: string;
    provider?: string;
    model?: string;
    role?: string;
  };
  equityCurve?: Array<{ time: string | number; value: number }>;
  warnings?: string[];
  accountError?: string | null;
  error?: string;
  message?: string;
}

export interface CryptoLedgerResponse {
  success: boolean;
  records?: Array<Record<string, unknown>>;
  requestedLimit?: number;
  returnedCount?: number;
  scannedRows?: number;
  scannedPages?: number;
  maxScannedRows?: number;
  maxPages?: number;
  scanTruncated?: boolean;
}

export interface CryptoConfig {
  enabled: boolean;
  mode: CryptoMode;
  symbols: string[];
  tradeHorizon: 'short' | 'long';
  intervalMinutes: number;
  liveAuthorized: boolean;
  killSwitch: boolean;
  maxTotalExposure: number;
  maxAssetExposurePct: number;
  assetAllocationsPct: Record<string, number>;
  riskPerTradePct: number;
  minimumConfidence: number;
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  maxOrderNotional: number;
  minOrderNotional: number;
  allowAdds: boolean;
  aiReviewEnabled: boolean;
  paperLearningEnabled: boolean;
  calibrationEveryCycles: 12 | 24 | 48 | 168;
  order: {
    type: 'market' | 'limit' | 'stop_limit';
    timeInForce: 'gtc' | 'ioc';
    limitOffsetBps: number;
    stopOffsetBps: number;
  };
  strategy: Record<string, unknown>;
  algorithm: { name: string; version: string };
  version?: number;
}

export type CryptoConfigUpdate = Partial<CryptoConfig> & {
  confirmLiveRisk?: boolean;
};

export const sanitizeCryptoConfigUpdate = (config: CryptoConfigUpdate): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...config };
  delete payload.enabled;
  delete payload.killSwitch;
  return payload;
};

export const cryptoAPI = {
  overview: (mode: CryptoMode) =>
    api.get<CryptoOverviewResponse>('/crypto/overview', { params: { mode } }),
  assets: (mode: CryptoMode) =>
    api.get('/crypto/assets', { params: { mode } }),
  bars: (symbol: string, timeframe = '1Hour', limit = 720, mode?: CryptoMode) =>
    api.get('/crypto/bars', { params: { symbol, timeframe, limit, ...(mode ? { mode } : {}) } }),
  getConfig: () =>
    api.get<{ success: boolean; config: CryptoConfig }>('/crypto/config'),
  saveConfig: (config: CryptoConfigUpdate) =>
    api.put<{ success: boolean; config: CryptoConfig }>('/crypto/config', sanitizeCryptoConfigUpdate(config)),
  runtime: () => api.get('/crypto/runtime'),
  ledger: (limit = CRYPTO_LEDGER_LIMIT) =>
    api.get<CryptoLedgerResponse>('/crypto/ledger', {
      params: { limit: Math.min(CRYPTO_LEDGER_LIMIT, Math.max(1, limit)) },
    }),
  runCycle: (mode: CryptoMode, dryRun = false) =>
    scannerApi.post('/crypto/run-cycle', { mode, dryRun }, { timeout: 4 * 60 * 1000 }),
  backtest: (payload: Record<string, unknown>) =>
    scannerApi.post('/crypto/backtest', payload, { timeout: 4 * 60 * 1000 }),
  calibrate: (apply = true) =>
    scannerApi.post('/crypto/calibration/run', { apply }, { timeout: 4 * 60 * 1000 }),
  strategyLibrary: () =>
    api.get<{
      success: boolean;
      version: string;
      strategies: Array<{
        id: string;
        name: string;
        role: 'control' | 'paper_challenger';
        source: { title?: string; url?: string; concept?: string };
      }>;
      method: string;
      guardrail: string;
    }>('/crypto/strategy-library'),
  startAutomation: (mode: CryptoMode, acknowledgeRisk = false) =>
    api.post('/crypto/automation/start', {
      mode,
      ...(acknowledgeRisk ? { acknowledgeRisk: true } : {}),
    }),
  stopAutomation: () => api.post('/crypto/automation/stop'),
  setKillSwitch: (enabled: boolean, reason = '') =>
    api.post('/crypto/kill-switch', { enabled, reason }),
};

export default cryptoAPI;
