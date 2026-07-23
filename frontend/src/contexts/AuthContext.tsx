import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import {
  clearSessionAway,
  getAwayTimeRemaining,
  hasSessionAwayExpired,
  markSessionAway,
  readAwaySince,
} from '../services/authSession';

interface AuthContextType {
  user: { id: string; email: string } | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  mfaStatus: MfaAssuranceStatus;
  mfaRequired: boolean;
  refreshMfaAssurance: () => Promise<boolean>;
  login: (email: string, password: string, captchaToken?: string) => Promise<{ success: boolean; message?: string; mfaRequired?: boolean }>;
  signUp: (email: string, password: string, captchaToken?: string, fullName?: string, emailRedirectTo?: string) => Promise<{ success: boolean; message?: string; confirmationRequired?: boolean }>;
  logout: () => Promise<void>;
}

export type MfaAssuranceStatus = 'checking' | 'not_required' | 'required' | 'verified' | 'unknown';

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  mfaStatus: 'checking',
  mfaRequired: false,
  refreshMfaAssurance: async () => false,
  login: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const mapSupabaseUser = (u: User | null): { id: string; email: string } | null => {
  if (!u) return null;
  return { id: u.id, email: u.email ?? '' };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MfaAssuranceStatus>('checking');
  const assuranceRequestRef = React.useRef(0);
  const sessionUserIdRef = React.useRef<string | null>(null);
  const authenticatedUserId = session?.user.id ?? null;

  const setSignedOutState = useCallback(() => {
    assuranceRequestRef.current += 1;
    setMfaStatus('not_required');
  }, []);

  const refreshMfaAssurance = useCallback(async (): Promise<boolean> => {
    const requestId = ++assuranceRequestRef.current;
    setMfaStatus('checking');
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (requestId !== assuranceRequestRef.current) return false;
      const nextStatus: MfaAssuranceStatus = data?.currentLevel === 'aal2'
        ? 'verified'
        : data?.nextLevel === 'aal2' ? 'required' : 'not_required';
      setMfaStatus(nextStatus);
      return nextStatus === 'required';
    } catch {
      // If AAL cannot be read, independently confirm whether the account has a
      // verified factor. An enrolled or indeterminate account fails closed.
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (requestId !== assuranceRequestRef.current) return false;
        const hasVerifiedFactor = Boolean(data?.totp?.some((factor) => factor.status === 'verified'));
        setMfaStatus(hasVerifiedFactor ? 'required' : 'not_required');
        return hasVerifiedFactor;
      } catch {
        if (requestId === assuranceRequestRef.current) setMfaStatus('unknown');
        return true;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session: currentSession } }: { data: { session: Session | null } }) => {
      if (!active) return;
      sessionUserIdRef.current = currentSession?.user.id ?? null;
      setSession(currentSession);
      setUser(mapSupabaseUser(currentSession?.user ?? null));
      if (!currentSession) setSignedOutState();
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setUser(null);
      setSignedOutState();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        const previousUserId = sessionUserIdRef.current;
        const nextUserId = newSession?.user.id ?? null;
        sessionUserIdRef.current = nextUserId;
        setSession(newSession);
        setUser(mapSupabaseUser(newSession?.user ?? null));
        if (!newSession) {
          setMfaStatus('not_required');
          assuranceRequestRef.current += 1;
        } else if (previousUserId !== nextUserId || event === 'MFA_CHALLENGE_VERIFIED') {
          // Token refreshes happen in the background and must not blank the app
          // behind a fresh MFA check when the signed-in identity is unchanged.
          setMfaStatus('checking');
        }
        setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSignedOutState]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    void refreshMfaAssurance();
  }, [authenticatedUserId, refreshMfaAssurance]);

  useEffect(() => {
    let disposed = false;
    let awayTimer: ReturnType<typeof setTimeout> | null = null;
    let inMemoryAwaySince: number | null = null;

    const clearAwayTimer = () => {
      if (awayTimer) clearTimeout(awayTimer);
      awayTimer = null;
    };

    if (!session?.user.id) {
      clearSessionAway();
      return clearAwayTimer;
    }

    const expireAwaySession = async () => {
      const awaySince = readAwaySince() ?? inMemoryAwaySince;
      if (!hasSessionAwayExpired(awaySince)) return;
      clearAwayTimer();
      clearSessionAway();
      inMemoryAwaySince = null;
      try {
        await supabase.auth.signOut();
      } finally {
        if (!disposed) {
          setSession(null);
          setUser(null);
          setSignedOutState();
        }
      }
    };

    const scheduleAwayExpiry = (awaySince: number) => {
      clearAwayTimer();
      const remaining = getAwayTimeRemaining(awaySince);
      if (remaining <= 0) {
        void expireAwaySession();
        return;
      }
      awayTimer = setTimeout(() => void expireAwaySession(), remaining);
    };

    const markAway = () => {
      const awaySince = markSessionAway();
      inMemoryAwaySince = awaySince;
      scheduleAwayExpiry(awaySince);
    };

    const restoreActiveSession = async () => {
      clearAwayTimer();
      const awaySince = readAwaySince() ?? inMemoryAwaySince;
      if (hasSessionAwayExpired(awaySince)) {
        await expireAwaySession();
        return;
      }
      clearSessionAway();
      inMemoryAwaySince = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') markAway();
      else void restoreActiveSession();
    };
    const handlePageHide = () => markAway();
    const handlePageShow = () => void restoreActiveSession();

    if (document.visibilityState === 'hidden') markAway();
    else void restoreActiveSession();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      disposed = true;
      clearAwayTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [session?.user.id, setSignedOutState]);

  const login = async (email: string, password: string, captchaToken?: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error) {
        return { success: false, message: error.message };
      }
      if (data.session) {
        setSession(data.session);
        setUser(mapSupabaseUser(data.user));
      }
      const requiresMfa = data.session ? await refreshMfaAssurance() : false;
      return { success: true, mfaRequired: requiresMfa };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      return { success: false, message: msg };
    }
  };

  const signUp = async (email: string, password: string, captchaToken?: string, fullName?: string, emailRedirectTo?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '' },
          captchaToken,
          emailRedirectTo,
        },
      });
      if (error) {
        return { success: false, message: error.message };
      }
      if (data.user && !data.session) {
        return { success: true, confirmationRequired: true, message: 'Check your email to confirm your account.' };
      }
      if (data.session) {
        setSession(data.session);
        setUser(mapSupabaseUser(data.user));
      }
      return { success: true, confirmationRequired: false };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    clearSessionAway();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSignedOutState();
  };

  const mfaRequired = mfaStatus === 'required' || mfaStatus === 'unknown';

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!user, loading, mfaStatus, mfaRequired, refreshMfaAssurance, login, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
