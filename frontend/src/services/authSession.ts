import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export const AUTH_AWAY_TIMEOUT_MS = 10 * 60 * 1000;
export const AUTH_AWAY_STORAGE_KEY = 'alphalab:auth-away-since';
export const AUTH_SESSION_READ_TIMEOUT_MS = 5_000;
export const AUTH_SESSION_REFRESH_TIMEOUT_MS = 8_000;

let refreshInFlight: Promise<Session | null> | null = null;

export class AuthOperationTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation} timed out`);
    this.name = 'AuthOperationTimeoutError';
  }
}

export const withAuthTimeout = <T,>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => new Promise<T>((resolve, reject) => {
  const timer = window.setTimeout(
    () => reject(new AuthOperationTimeoutError(label)),
    Math.max(1, timeoutMs),
  );
  Promise.resolve(operation).then(resolve, reject).finally(() => window.clearTimeout(timer));
});

export const getSessionWithTimeout = async (
  timeoutMs = AUTH_SESSION_READ_TIMEOUT_MS,
): Promise<Session | null> => {
  const { data, error } = await withAuthTimeout(
    supabase.auth.getSession(),
    timeoutMs,
    'Session restore',
  );
  if (error) throw error;
  return data.session;
};

export const getAuthAwayTimeoutMs = (): number => {
  try {
    const minutes = Number(window.localStorage.getItem('alphalab:inactivity-timeout-minutes'));
    if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 120) return minutes * 60 * 1000;
  } catch {
    // Fall back to the secure account default when storage is unavailable.
  }
  return AUTH_AWAY_TIMEOUT_MS;
};

export const refreshSessionOnce = async (
  timeoutMs = AUTH_SESSION_REFRESH_TIMEOUT_MS,
): Promise<Session | null> => {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return data.session;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  // Keep the underlying single-flight promise alive after a caller times out.
  // A late successful refresh can still update Supabase's persisted session,
  // while the current page request receives a bounded failure instead of
  // hanging behind an unhealthy Auth service.
  return withAuthTimeout(refreshInFlight, timeoutMs, 'Session refresh');
};

export const readAwaySince = (): number | null => {
  try {
    const value = Number(window.localStorage.getItem(AUTH_AWAY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export const markSessionAway = (now = Date.now()): number => {
  const existing = readAwaySince();
  if (existing !== null) return existing;
  try {
    window.localStorage.setItem(AUTH_AWAY_STORAGE_KEY, String(now));
  } catch {
    // The in-memory caller can still enforce the timeout when storage is unavailable.
  }
  return now;
};

export const clearSessionAway = (): void => {
  try {
    window.localStorage.removeItem(AUTH_AWAY_STORAGE_KEY);
  } catch {
    // Ignore private-mode or storage-policy errors.
  }
};

export const hasSessionAwayExpired = (awaySince: number | null, now = Date.now()): boolean => (
  awaySince !== null && now - awaySince >= getAuthAwayTimeoutMs()
);

export const getAwayTimeRemaining = (awaySince: number, now = Date.now()): number => (
  Math.max(0, getAuthAwayTimeoutMs() - (now - awaySince))
);
