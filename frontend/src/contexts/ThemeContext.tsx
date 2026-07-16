import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'alphaLabThemeMode';
export const THEME_PREFERENCE_VERSION_KEY = 'alphaLabThemeModeVersion';
export const THEME_PREFERENCE_VERSION = '2';

export const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

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
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(THEME_PREFERENCE_VERSION_KEY, THEME_PREFERENCE_VERSION);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      let currentResolved: 'light' | 'dark' = 'light';
      if (themeMode === 'system') {
        currentResolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        currentResolved = themeMode;
      }
      setResolvedTheme(currentResolved);
      document.documentElement.setAttribute('data-theme', currentResolved);
    };

    updateTheme();

    const listener = (e: MediaQueryListEvent) => {
      if (themeMode === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
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
