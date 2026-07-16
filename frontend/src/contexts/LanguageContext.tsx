import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 导入语言包
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';

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
  const [t, setT] = useState<Translation>(translations[language]);

  // 更新语言
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
  };

  // 当语言改变时更新翻译
  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    setT(translations[language]);
    
    // Set document html lang attribute
    document.documentElement.lang = language === 'zh-CN' ? 'zh' : 'en';
  }, [language]);

  // Translate sector/industry name using the sectors mapping
  const translateSector = (name: string): string => {
    if (!name) return name;
    const mapped = t.sectors[name];
    if (mapped) return mapped;
    // Try case-insensitive match
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(t.sectors)) {
      if (key.toLowerCase() === lower) return val;
    }
    return name;
  };

  // Translate signal label using the signals mapping
  const translateSignal = (name: string): string => {
    if (!name) return name;
    return t.signals[name] || name;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateSector, translateSignal }}>
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
