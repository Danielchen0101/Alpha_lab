import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import {
  clearSessionAway,
  AUTH_SESSION_READ_TIMEOUT_MS,
  getAwayTimeRemaining,
  hasSessionAwayExpired,
  markSessionAway,
  readAwaySince,
  withAuthTimeout,
} from '../services/authSession';
import { getSessionAssuranceKey } from '../lib/sessionAssurance';

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
const MFA_ASSURANCE_TIMEOUT_MS = 5_000;
const INTERACTIVE_AUTH_TIMEOUT_MS = 10_000;

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
  const assuranceSessionKeyRef = React.useRef<string | null>(null);
  const authenticatedAssuranceKey = getSessionAssuranceKey(session);

  const setSignedOutState = useCallback(() => {
    assuranceRequestRef.current += 1;
    setMfaStatus('not_required');
  }, []);

  const refreshMfaAssurance = useCallback(async (): Promise<boolean> => {
    const requestId = ++assuranceRequestRef.current;
    setMfaStatus('checking');
    const startedAt = Date.now();
    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        MFA_ASSURANCE_TIMEOUT_MS,
        'MFA assurance check',
      );
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
        const remainingMs = Math.max(1, MFA_ASSURANCE_TIMEOUT_MS - (Date.now() - startedAt));
        const { data, error } = await withAuthTimeout(
          supabase.auth.mfa.listFactors(),
          remainingMs,
          'MFA factor check',
        );
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        const previousAssuranceKey = assuranceSessionKeyRef.current;
        const nextAssuranceKey = getSessionAssuranceKey(newSession);
        assuranceSessionKeyRef.current = nextAssuranceKey;
        setSession(newSession);
        setUser(mapSupabaseUser(newSession?.user ?? null));
        if (!newSession) {
          setMfaStatus('not_required');
          assuranceRequestRef.current += 1;
        } else if (previousAssuranceKey !== nextAssuranceKey) {
          // Invalidate a result that may still be in flight for the previous
          // security session. Token refreshes retain the JWT session_id, while
          // sign-in and password recovery issue a new one and must recheck AAL.
          assuranceRequestRef.current += 1;
          setMfaStatus('checking');
        } else if (event === 'MFA_CHALLENGE_VERIFIED') {
          void refreshMfaAssurance();
        }
        setLoading(false);
      }
    );

    withAuthTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_READ_TIMEOUT_MS,
      'Initial session restore',
    ).then(({ data: { session: currentSession } }: { data: { session: Session | null } }) => {
      if (!active) return;
      assuranceSessionKeyRef.current = getSessionAssuranceKey(currentSession);
      setSession(currentSession);
      setUser(mapSupabaseUser(currentSession?.user ?? null));
      if (!currentSession) setSignedOutState();
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      // Do not destroy persisted credentials when Supabase Auth is briefly
      // unavailable. The auth-state subscription can still apply a late
      // session, while public/sign-in pages stop showing an endless loader.
      setSignedOutState();
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshMfaAssurance, setSignedOutState]);

  useEffect(() => {
    if (!authenticatedAssuranceKey) return;
    void refreshMfaAssurance();
  }, [authenticatedAssuranceKey, refreshMfaAssurance]);

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
      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password, options: { captchaToken } }),
        INTERACTIVE_AUTH_TIMEOUT_MS,
        'Password sign in',
      );
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
      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || '' },
            captchaToken,
            emailRedirectTo,
          },
        }),
        INTERACTIVE_AUTH_TIMEOUT_MS,
        'Account sign up',
      );
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
