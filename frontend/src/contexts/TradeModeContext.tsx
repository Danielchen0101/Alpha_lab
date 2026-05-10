import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TradeMode = 'paper' | 'real';

interface TradeModeContextType {
  tradeMode: TradeMode;
  setTradeMode: (mode: TradeMode) => void;
}

const TradeModeContext = createContext<TradeModeContextType | undefined>(undefined);

const STORAGE_KEY = 'tradeMode';

const getStoredTradeMode = (): TradeMode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'paper' || stored === 'real') return stored;
  return 'paper'; // default to paper for safety
};

export const TradeModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tradeMode, setTradeModeState] = useState<TradeMode>(getStoredTradeMode);

  const setTradeMode = (mode: TradeMode) => {
    setTradeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'paper' || e.newValue === 'real')) {
        setTradeModeState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <TradeModeContext.Provider value={{ tradeMode, setTradeMode }}>
      {children}
    </TradeModeContext.Provider>
  );
};

export const useTradeMode = (): TradeModeContextType => {
  const ctx = useContext(TradeModeContext);
  if (!ctx) throw new Error('useTradeMode must be used within TradeModeProvider');
  return ctx;
};
