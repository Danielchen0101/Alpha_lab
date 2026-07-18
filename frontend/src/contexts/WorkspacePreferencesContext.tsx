import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { WorkspacePreferences, workspacePreferencesAPI } from '../services/api';

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  tradeMode: 'paper', pipelineMode: 'hybrid', riskProfile: 'medium', timeHorizon: 'mid',
  leverageEnabled: false, scheduleEnabled: false, intervalMinutes: 0,
  liveAutoTradingEnabled: false, language: 'en-US', updatedAt: '', strategyPolicy: null,
  general: {
    timezone: 'America/New_York', currency: 'USD', numberFormat: 'standard',
    defaultLandingPage: '/dashboard', fontScale: 'comfortable', density: 'comfortable',
    reduceMotion: false, themeMode: 'light',
  },
  trading: {
    defaultOrderType: 'limit', timeInForce: 'day', extendedHours: false,
    orderSizeMode: 'dollars', limitOffsetBps: 5, confirmationPolicy: 'live_only',
  },
  risk: {
    maxOrderNotional: 10000, maxPositionPct: 20, dailyLossLimitPct: 4,
    sectorConcentrationPct: 35, maxOpenPositions: 12, staleQuoteSeconds: 45,
    blockOnStaleQuote: true, circuitBreakerEnabled: true,
  },
  research: {
    universe: 'alpaca_market', excludedSymbols: [], excludedSectors: [], minPrice: 5,
    minMarketCap: 0, minDollarVolume: 10_000_000, maxSymbols: 1500,
    outputSize: 100, aiReviewLimit: 100, dataFreshnessSeconds: 120,
    includeExtendedHours: false,
  },
  charts: {
    timeframe: '1D', chartType: 'line', adjustedData: true, session: 'regular',
    benchmark: 'SPY', precision: 2, showEvents: true,
  },
  notifications: {
    inApp: true, discord: true, tradeActivity: true, recommendations: true,
    riskAlerts: true, pipelineDigest: true, dataQuality: true, securityAlerts: true,
    deliveryMode: 'instant', quietHoursEnabled: false, quietStart: '22:00', quietEnd: '07:00',
  },
  security: { inactivityTimeoutMinutes: 10, newDeviceAlerts: true, sensitiveActionConfirmation: true },
};

const mergePreferences = (value?: Partial<WorkspacePreferences> | null): WorkspacePreferences => ({
  ...DEFAULT_WORKSPACE_PREFERENCES,
  ...(value || {}),
  general: { ...DEFAULT_WORKSPACE_PREFERENCES.general, ...(value?.general || {}) },
  trading: { ...DEFAULT_WORKSPACE_PREFERENCES.trading, ...(value?.trading || {}) },
  risk: { ...DEFAULT_WORKSPACE_PREFERENCES.risk, ...(value?.risk || {}) },
  research: { ...DEFAULT_WORKSPACE_PREFERENCES.research, ...(value?.research || {}) },
  charts: { ...DEFAULT_WORKSPACE_PREFERENCES.charts, ...(value?.charts || {}) },
  notifications: { ...DEFAULT_WORKSPACE_PREFERENCES.notifications, ...(value?.notifications || {}) },
  security: { ...DEFAULT_WORKSPACE_PREFERENCES.security, ...(value?.security || {}) },
});

const cacheKey = (userId: string) => `alphalab:workspace-preferences:${userId}`;
const DEVICE_ID_KEY = 'alphalab:browser-device-id';

const browserDeviceRegistration = () => {
  let deviceId = '';
  try {
    deviceId = window.localStorage.getItem(DEVICE_ID_KEY) || '';
    if (!deviceId) {
      deviceId = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
  } catch {
    deviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  return {
    deviceId,
    deviceLabel: navigator.userAgent || 'Web browser',
    timezone,
  };
};

export const readCachedWorkspacePreferences = (userId?: string | null): WorkspacePreferences => {
  if (!userId) return DEFAULT_WORKSPACE_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    return mergePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
};

const cachePreferences = (userId: string, preferences: WorkspacePreferences) => {
  try { window.localStorage.setItem(cacheKey(userId), JSON.stringify(preferences)); } catch { /* optional cache */ }
};

export const applyWorkspacePreferences = (preferences: WorkspacePreferences) => {
  const root = document.documentElement;
  root.dataset.workspaceDensity = preferences.general.density;
  root.dataset.fontScale = preferences.general.fontScale;
  root.dataset.reduceMotion = preferences.general.reduceMotion ? 'true' : 'false';
  try {
    window.localStorage.setItem('alphalab:inactivity-timeout-minutes', String(preferences.security.inactivityTimeoutMinutes));
    window.localStorage.setItem('alphalab:default-landing-page', preferences.general.defaultLandingPage);
    window.localStorage.setItem('alphalab:number-format', preferences.general.numberFormat);
    window.localStorage.setItem('alphalab:base-currency', preferences.general.currency);
    window.localStorage.setItem('alphalab:market-timezone', preferences.general.timezone);
  } catch { /* optional cache */ }
};

interface WorkspacePreferencesContextValue {
  preferences: WorkspacePreferences;
  loading: boolean;
  saving: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (patch: Partial<WorkspacePreferences>) => Promise<WorkspacePreferences>;
  reset: () => Promise<WorkspacePreferences>;
}

const WorkspacePreferencesContext = createContext<WorkspacePreferencesContextValue | undefined>(undefined);

export const WorkspacePreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const { setThemeMode } = useTheme();
  const [preferences, setPreferences] = useState(DEFAULT_WORKSPACE_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const commit = useCallback((next: WorkspacePreferences) => {
    setPreferences(next);
    applyWorkspacePreferences(next);
    if (user?.id) cachePreferences(user.id, next);
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) { commit(DEFAULT_WORKSPACE_PREFERENCES); return; }
    setLoading(true);
    setError('');
    const cached = readCachedWorkspacePreferences(user.id);
    commit(cached);
    try {
      const response = await workspacePreferencesAPI.get();
      const next = mergePreferences(response.data?.preferences);
      commit(next);
      if (next.general.themeMode) setThemeMode(next.general.themeMode);
      if (next.language) setLanguage(next.language);
      void workspacePreferencesAPI.registerDevice(browserDeviceRegistration()).catch(() => {
        // Device alerts are best-effort and must never block workspace loading.
      });
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Preferences could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [commit, setLanguage, setThemeMode, user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (patch: Partial<WorkspacePreferences>) => {
    if (!user?.id) throw new Error('Authentication required.');
    setSaving(true);
    setError('');
    try {
      const response = await workspacePreferencesAPI.update(patch);
      const next = mergePreferences(response.data?.preferences);
      commit(next);
      return next;
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.message || requestError?.message || 'Preferences could not be saved.';
      setError(detail);
      throw new Error(detail);
    } finally {
      setSaving(false);
    }
  }, [commit, user?.id]);

  const reset = useCallback(() => save({
    tradeMode: DEFAULT_WORKSPACE_PREFERENCES.tradeMode,
    general: DEFAULT_WORKSPACE_PREFERENCES.general,
    trading: DEFAULT_WORKSPACE_PREFERENCES.trading,
    risk: DEFAULT_WORKSPACE_PREFERENCES.risk,
    research: DEFAULT_WORKSPACE_PREFERENCES.research,
    charts: DEFAULT_WORKSPACE_PREFERENCES.charts,
    notifications: DEFAULT_WORKSPACE_PREFERENCES.notifications,
    security: DEFAULT_WORKSPACE_PREFERENCES.security,
  }), [save]);

  const value = useMemo(() => ({ preferences, loading, saving, error, refresh, save, reset }), [error, loading, preferences, refresh, reset, save, saving]);
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>;
};

export const useWorkspacePreferences = (): WorkspacePreferencesContextValue => {
  const context = useContext(WorkspacePreferencesContext);
  if (!context) throw new Error('useWorkspacePreferences must be used within WorkspacePreferencesProvider');
  return context;
};
