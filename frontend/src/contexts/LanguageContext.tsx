import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';

// 导入语言包
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { supabase } from '../lib/supabaseClient';
import { workspacePreferencesAPI } from '../services/api';

// 支持的语言类型
export type Language = 'en-US' | 'zh-CN';

// 语言包类型
export type Translation = typeof enUS;

// 上下文类型
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translation;
  translateSector: (name: string) => string;
  translateSignal: (name: string) => string;
}

// 创建上下文
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 语言包映射
const translations: Record<Language, Translation> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

export const LANGUAGE_STORAGE_KEY = 'quant-platform-language';
export const LANGUAGE_PREFERENCE_VERSION_KEY = 'quant-platform-language-version';
export const LANGUAGE_PREFERENCE_VERSION = '2';

// Preserve an explicit user choice, but always start new visitors in English.
export const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en-US';

  // Version 1 inferred Chinese from the browser and persisted that value, so a
  // visitor could remain on Chinese even after English became the product
  // default. Reset that legacy value once; choices made after this migration
  // continue to be preserved normally.
  if (window.localStorage.getItem(LANGUAGE_PREFERENCE_VERSION_KEY) !== LANGUAGE_PREFERENCE_VERSION) {
    return 'en-US';
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored;
  }

  return 'en-US';
};

// 提供者组件
interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const languageRef = useRef<Language>(language);
  const preferenceSyncTimerRef = useRef<number | null>(null);
  const t = translations[language];

  // Apply the visual change immediately, but debounce the remote preference
  // write so a language toggle never causes a burst of auth + settings calls.
  const setLanguage = useCallback((lang: Language) => {
    if (lang !== 'en-US' && lang !== 'zh-CN') return;
    const changed = languageRef.current !== lang;
    languageRef.current = lang;
    setLanguageState(current => current === lang ? current : lang);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    if (!changed) return;
    if (preferenceSyncTimerRef.current !== null) {
      window.clearTimeout(preferenceSyncTimerRef.current);
    }
    preferenceSyncTimerRef.current = window.setTimeout(() => {
      preferenceSyncTimerRef.current = null;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) return workspacePreferencesAPI.update({ language: lang });
        return undefined;
      }).catch(() => {
        // Local language switching must keep working even if preference sync is unavailable.
      });
    }, 500);
  }, []);

  useEffect(() => () => {
    if (preferenceSyncTimerRef.current !== null) {
      window.clearTimeout(preferenceSyncTimerRef.current);
    }
  }, []);

  // Keep the authenticated user's website and Discord notification language
  // aligned across devices. Older accounts without a saved language retain the
  // explicit browser choice until the user switches language again.
  useEffect(() => {
    let active = true;

    const loadSavedLanguage = async (knownSession?: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      try {
        const session = knownSession === undefined
          ? (await supabase.auth.getSession()).data.session
          : knownSession;
        if (!session) return;
        const response = await workspacePreferencesAPI.get();
        const saved = response.data?.preferences?.language;
        if (active && (saved === 'en-US' || saved === 'zh-CN')) {
          languageRef.current = saved;
          setLanguageState(saved);
        } else if (active) {
          const local = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
          const current = local === 'zh-CN' ? 'zh-CN' : 'en-US';
          void workspacePreferencesAPI.update({ language: current }).catch(() => {});
        }
      } catch {
        // A language preference is optional; local storage remains authoritative
        // while the backend is offline or the session is still being restored.
      }
    };

    void loadSavedLanguage();
    let deferredLoad: number | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Supabase auth callbacks must stay synchronous. Defer all API work
        // until after the auth event lock has been released.
        if (deferredLoad !== null) window.clearTimeout(deferredLoad);
        deferredLoad = window.setTimeout(() => void loadSavedLanguage(session), 0);
      }
    });
    return () => {
      active = false;
      if (deferredLoad !== null) window.clearTimeout(deferredLoad);
      subscription.unsubscribe();
    };
  }, []);

  // 当语言改变时更新翻译
  useEffect(() => {
    languageRef.current = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    // Set document html lang attribute
    document.documentElement.lang = language === 'zh-CN' ? 'zh' : 'en';
  }, [language]);

  // Translate sector/industry name using the sectors mapping
  const translateSector = useCallback((name: string): string => {
    if (!name) return name;
    const mapped = t.sectors[name];
    if (mapped) return mapped;
    // Try case-insensitive match
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(t.sectors)) {
      if (key.toLowerCase() === lower) return val;
    }
    return name;
  }, [t]);

  // Translate signal label using the signals mapping
  const translateSignal = useCallback((name: string): string => {
    if (!name) return name;
    return t.signals[name] || name;
  }, [t]);

  const contextValue = useMemo(() => ({
    language, setLanguage, t, translateSector, translateSignal,
  }), [language, setLanguage, t, translateSector, translateSignal]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// 自定义钩子
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context as LanguageContextType;
};

// 工具函数：格式化带参数的文本
export const formatText = (text: string, params: Record<string, any> = {}): string => {
  return Object.keys(params).reduce((result, key) => {
    return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(params[key]));
  }, text);
};
