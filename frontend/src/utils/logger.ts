const isDev = process.env.NODE_ENV === 'development';

export function devLog(...args: unknown[]) {
  if (isDev) console.log(...args);
}

export function devWarn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

export function devInfo(...args: unknown[]) {
  if (isDev) console.info(...args);
}
