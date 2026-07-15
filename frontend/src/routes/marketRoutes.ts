export const MARKET_SCANNER_PATH = '/market';
export const MARKET_SYMBOL_ROOT = '/market/symbol';
export const LEGACY_MARKET_SYMBOL_ROOT = '/analysis';
export const DEFAULT_MARKET_SYMBOL = 'SPY';

const LAST_MARKET_SYMBOL_KEY = 'alpha_lab_last_market_symbol_v1';
const MARKET_SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;

export const normalizeMarketSymbol = (value: unknown): string => {
  const symbol = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '');

  return MARKET_SYMBOL_PATTERN.test(symbol) ? symbol : '';
};

export const marketSymbolPath = (value?: unknown): string => {
  const symbol = normalizeMarketSymbol(value) || DEFAULT_MARKET_SYMBOL;
  return `${MARKET_SYMBOL_ROOT}/${encodeURIComponent(symbol)}`;
};

export const backtestForSymbolPath = (value?: unknown): string => {
  const symbol = normalizeMarketSymbol(value);
  return symbol ? `/backtest?symbol=${encodeURIComponent(symbol)}` : '/backtest';
};

export const marketSymbolFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/(?:market\/symbol|analysis)\/([^/]+)\/?$/i);
  if (!match) return null;

  try {
    return normalizeMarketSymbol(decodeURIComponent(match[1])) || null;
  } catch {
    return null;
  }
};

export const readLastMarketSymbol = (): string => {
  if (typeof window === 'undefined') return DEFAULT_MARKET_SYMBOL;

  try {
    return normalizeMarketSymbol(window.localStorage.getItem(LAST_MARKET_SYMBOL_KEY))
      || DEFAULT_MARKET_SYMBOL;
  } catch {
    return DEFAULT_MARKET_SYMBOL;
  }
};

export const rememberMarketSymbol = (value: unknown): string => {
  const symbol = normalizeMarketSymbol(value);
  if (!symbol) return '';

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_MARKET_SYMBOL_KEY, symbol);
    } catch {
      // Navigation still works when storage is unavailable.
    }
  }

  return symbol;
};
