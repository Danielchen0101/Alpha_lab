import {
  getInitialLanguage,
  LANGUAGE_PREFERENCE_VERSION,
  LANGUAGE_PREFERENCE_VERSION_KEY,
  LANGUAGE_STORAGE_KEY,
} from './LanguageContext';
import {
  applyResolvedTheme,
  getInitialResolvedTheme,
  getInitialThemeMode,
  persistThemeMode,
  resolveThemeMode,
  THEME_COLOR,
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_KEY,
  THEME_STORAGE_KEY,
} from './ThemeContext';

describe('workspace preference defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts new visitors in English', () => {
    expect(getInitialLanguage()).toBe('en-US');
  });

  it('preserves a valid explicit language choice', () => {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN');
    expect(getInitialLanguage()).toBe('zh-CN');
  });

  it('migrates a legacy stored language back to English once', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN');
    expect(getInitialLanguage()).toBe('en-US');
  });

  it('falls back to English for an invalid language value', () => {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr-FR');
    expect(getInitialLanguage()).toBe('en-US');
  });

  it('starts new visitors in the light theme', () => {
    expect(getInitialThemeMode()).toBe('light');
  });

  it('preserves a valid explicit theme choice', () => {
    window.localStorage.setItem(THEME_PREFERENCE_VERSION_KEY, THEME_PREFERENCE_VERSION);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getInitialThemeMode()).toBe('dark');
  });

  it('migrates a legacy stored dark theme back to light once', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getInitialThemeMode()).toBe('light');
  });

  it('falls back to light for an invalid theme value', () => {
    window.localStorage.setItem(THEME_PREFERENCE_VERSION_KEY, THEME_PREFERENCE_VERSION);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(getInitialThemeMode()).toBe('light');
  });

  it('falls back to light instead of throwing when storage reads are disabled', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => getInitialThemeMode()).not.toThrow();
    expect(getInitialThemeMode()).toBe('light');
  });

  it('keeps the selected in-memory mode when storage writes are disabled', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => persistThemeMode('system')).not.toThrow();
    expect(persistThemeMode('system')).toBe(false);
    expect(resolveThemeMode('system', true)).toBe('dark');
  });

  it('initializes the provider from the theme already applied by the bootstrap', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(getInitialResolvedTheme('light')).toBe('dark');
  });
});

describe('resolved theme document state', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('keeps the browser chrome color synchronized with the resolved theme', () => {
    const themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);

    applyResolvedTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(themeColorMeta.content).toBe(THEME_COLOR.dark);

    applyResolvedTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeColorMeta.content).toBe(THEME_COLOR.light);
  });

  it('creates the theme-color metadata when the host document omits it', () => {
    applyResolvedTheme('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLOR.dark);
  });
});
