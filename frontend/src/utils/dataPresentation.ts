export type DataFreshnessStatus = 'fresh' | 'delayed' | 'stale' | 'unavailable';

export interface DataFreshnessResult {
  status: DataFreshnessStatus;
  ageSeconds: number | null;
}

export interface NumericFormatOptions {
  locale?: 'en-US' | 'zh-CN';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  placeholder?: string;
}

const readPresentationSetting = (key: string, fallback: string) => {
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
};

export const formatNumericValue = (
  value: number | string | null | undefined,
  options: NumericFormatOptions = {},
) => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return options.placeholder ?? '—';

  // Financial feeds commonly return -0 after rounding. It should never appear
  // as a negative move in the interface.
  const normalized = Object.is(parsed, -0) ? 0 : parsed;
  return new Intl.NumberFormat(options.locale ?? 'en-US', {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    signDisplay: options.signDisplay ?? 'auto',
    notation: readPresentationSetting('alphalab:number-format', 'standard') === 'compact' ? 'compact' : 'standard',
  }).format(normalized);
};

export const formatCurrencyValue = (
  value: number | string | null | undefined,
  options: NumericFormatOptions & { currency?: string } = {},
) => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return options.placeholder ?? '—';
  return new Intl.NumberFormat(options.locale ?? 'en-US', {
    style: 'currency',
    currency: options.currency || readPresentationSetting('alphalab:base-currency', 'USD'),
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    signDisplay: options.signDisplay ?? 'auto',
    notation: readPresentationSetting('alphalab:number-format', 'standard') === 'compact' ? 'compact' : 'standard',
  }).format(Object.is(parsed, -0) ? 0 : parsed);
};

export const resolveDataFreshness = (
  timestamp: string | number | Date | null | undefined,
  now = Date.now(),
  delayedAfterSeconds = 15,
  staleAfterSeconds = 60,
): DataFreshnessResult => {
  if (timestamp === null || timestamp === undefined || timestamp === '') {
    return { status: 'unavailable', ageSeconds: null };
  }

  const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return { status: 'unavailable', ageSeconds: null };

  // Clock skew should not make a fresh feed look stale.
  const ageSeconds = Math.max(0, Math.floor((now - time) / 1000));
  if (ageSeconds >= staleAfterSeconds) return { status: 'stale', ageSeconds };
  if (ageSeconds >= delayedAfterSeconds) return { status: 'delayed', ageSeconds };
  return { status: 'fresh', ageSeconds };
};
