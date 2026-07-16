import {
  getInitialLanguage,
  LANGUAGE_PREFERENCE_VERSION,
  LANGUAGE_PREFERENCE_VERSION_KEY,
  LANGUAGE_STORAGE_KEY,
} from './LanguageContext';
import {
  getInitialThemeMode,
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_KEY,
  THEME_STORAGE_KEY,
} from './ThemeContext';

describe('workspace preference defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
});
