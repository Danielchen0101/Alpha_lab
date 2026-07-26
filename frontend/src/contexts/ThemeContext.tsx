import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'alphaLabThemeMode';
export const THEME_PREFERENCE_VERSION_KEY = 'alphaLabThemeModeVersion';
export const THEME_PREFERENCE_VERSION = '2';
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f7f6f1',
  dark: '#121114',
};

export const applyResolvedTheme = (resolvedTheme: ResolvedTheme): void => {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme', resolvedTheme);
  let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = THEME_COLOR[resolvedTheme];
};

export const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

  try {
    // Earlier releases defaulted to the operating-system theme and persisted it.
    // Migrate that legacy value once so the refreshed product starts in light
    // mode, while preserving all choices made after this version marker exists.
    if (window.localStorage.getItem(THEME_PREFERENCE_VERSION_KEY) !== THEME_PREFERENCE_VERSION) {
      return 'light';
    }

    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system'
      ? saved
      : 'light';
  } catch {
    return 'light';
  }
};

export const resolveThemeMode = (
  themeMode: ThemeMode,
  systemPrefersDark?: boolean,
): ResolvedTheme => {
  if (themeMode !== 'system') return themeMode;
  if (typeof systemPrefersDark === 'boolean') return systemPrefersDark ? 'dark' : 'light';
  if (typeof window === 'undefined') return 'light';

  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const getInitialResolvedTheme = (themeMode: ThemeMode = getInitialThemeMode()): ResolvedTheme => {
  if (typeof document !== 'undefined') {
    const bootstrappedTheme = document.documentElement.getAttribute('data-theme');
    if (bootstrappedTheme === 'light' || bootstrappedTheme === 'dark') {
      return bootstrappedTheme;
    }
  }
  return resolveThemeMode(themeMode);
};

export const persistThemeMode = (themeMode: ThemeMode): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(THEME_PREFERENCE_VERSION_KEY, THEME_PREFERENCE_VERSION);
    return true;
  } catch {
    return false;
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    () => getInitialResolvedTheme(themeMode),
  );

  useEffect(() => {
    persistThemeMode(themeMode);

    let mediaQuery: MediaQueryList | null = null;
    if (themeMode === 'system') {
      try {
        mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
      } catch {
        mediaQuery = null;
      }
    }
    
    const updateTheme = () => {
      const currentResolved = resolveThemeMode(themeMode, mediaQuery?.matches);
      setResolvedTheme(currentResolved);
      applyResolvedTheme(currentResolved);
    };

    updateTheme();

    if (!mediaQuery) return undefined;
    const listener = () => updateTheme();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery?.removeEventListener('change', listener);
    }
    mediaQuery.addListener(listener);
    return () => mediaQuery?.removeListener(listener);
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
