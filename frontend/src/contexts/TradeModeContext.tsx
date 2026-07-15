import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type TradeMode = 'paper' | 'real';

interface TradeModeContextType {
  tradeMode: TradeMode;
  setTradeMode: (mode: TradeMode) => void;
}

const TradeModeContext = createContext<TradeModeContextType | undefined>(undefined);

export const TradeModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tradeMode, setTradeModeState] = useState<TradeMode>('paper');

  const setTradeMode = (mode: TradeMode) => {
    setTradeModeState(mode);
  };

  // A live environment is intentionally session-only. Signing out, changing
  // accounts, or reloading the app always returns to paper mode so a previous
  // user's authorization can never leak into a new session.
  useEffect(() => {
    setTradeModeState('paper');
  }, [user?.id]);

  useEffect(() => {
    const resetToPaper = () => setTradeModeState('paper');
    window.addEventListener('alphalab:auth-lost', resetToPaper);
    return () => window.removeEventListener('alphalab:auth-lost', resetToPaper);
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
