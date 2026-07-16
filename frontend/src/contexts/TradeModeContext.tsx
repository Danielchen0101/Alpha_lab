import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { workspacePreferencesAPI } from '../services/api';

export type TradeMode = 'paper' | 'real';

interface TradeModeContextType {
  tradeMode: TradeMode;
  tradeModeReady: boolean;
  setTradeMode: (mode: TradeMode) => void;
}

const TradeModeContext = createContext<TradeModeContextType | undefined>(undefined);

export const TradeModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tradeMode, setTradeModeState] = useState<TradeMode>('paper');
  const [tradeModeReady, setTradeModeReady] = useState(false);

  const setTradeMode = useCallback((mode: TradeMode) => {
    setTradeModeState(mode);
    setTradeModeReady(true);
    if (!user?.id) return;
    localStorage.setItem(`alphaLabTradeMode:${user.id}`, mode);
    void workspacePreferencesAPI.update({ tradeMode: mode }).catch((error) => {
      console.error('[TradeMode] Could not persist account preference:', error);
      window.dispatchEvent(new CustomEvent('alphalab:preference-save-error', {
        detail: { preference: 'tradeMode' },
      }));
    });
  }, [user?.id]);

  // Scope the instant cache by user, then replace it with the server's durable
  // value. This prevents one account's mode from leaking into another account.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setTradeModeState('paper');
      setTradeModeReady(false);
      return () => { cancelled = true; };
    }
    const cacheKey = `alphaLabTradeMode:${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    setTradeModeState(cached === 'real' ? 'real' : 'paper');
    setTradeModeReady(cached === 'real' || cached === 'paper');
    void workspacePreferencesAPI.get()
      .then((response) => {
        if (cancelled) return;
        const savedMode = response.data?.preferences?.tradeMode === 'real' ? 'real' : 'paper';
        setTradeModeState(savedMode);
        setTradeModeReady(true);
        localStorage.setItem(cacheKey, savedMode);
      })
      .catch((error) => {
        console.error('[TradeMode] Could not restore account preference:', error);
        if (!cancelled) setTradeModeReady(true);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    // Clear only in-memory state when auth is lost. The saved account preference
    // remains available for the next successful login.
    const resetToPaper = () => {
      setTradeModeState('paper');
      setTradeModeReady(false);
    };
    window.addEventListener('alphalab:auth-lost', resetToPaper);
    return () => window.removeEventListener('alphalab:auth-lost', resetToPaper);
  }, []);

  return (
    <TradeModeContext.Provider value={{ tradeMode, tradeModeReady, setTradeMode }}>
      {children}
    </TradeModeContext.Provider>
  );
};

export const useTradeMode = (): TradeModeContextType => {
  const ctx = useContext(TradeModeContext);
  if (!ctx) throw new Error('useTradeMode must be used within TradeModeProvider');
  return ctx;
};
