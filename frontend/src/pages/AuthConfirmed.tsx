import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearPersistedSupabaseAuthSession,
  supabase,
} from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import {
  classifyAuthCallbackError,
  parseAuthCallback,
  scheduleAuthCallbackRedemption,
} from '../lib/authCallback';
import type { AuthCallbackErrorKind } from '../lib/authCallback';
import AuthPageNav from '../components/AuthPageNav';
import '../styles/Auth.css';

const { Title, Text } = Typography;

type ConfirmationState =
  | { phase: 'checking'; hasSession: false; errorKind: null }
  | { phase: 'confirmed'; hasSession: boolean; errorKind: null }
  | { phase: 'error'; hasSession: false; errorKind: AuthCallbackErrorKind };

const AuthConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [state, setState] = useState<ConfirmationState>({
    phase: 'checking',
    hasSession: false,
    errorKind: null,
  });
  const initialCallbackRef = useRef<ReturnType<typeof parseAuthCallback> | null>(null);
  if (initialCallbackRef.current === null) {
    initialCallbackRef.current = parseAuthCallback(window.location.search, window.location.hash);
  }

  useEffect(() => {
    let active = true;
    let settled = false;
    const callback = initialCallbackRef.current!;
    window.history.replaceState({}, document.title, '/auth/confirmed');

    const finishConfirmed = (sessionAvailable: boolean) => {
      if (!active || settled) return;
      settled = true;
      setState({
        phase: 'confirmed',
        hasSession: sessionAvailable,
        errorKind: null,
      });
    };

    const finishError = (kind: AuthCallbackErrorKind) => {
      if (!active || settled) return;
      settled = true;
      setState({
        phase: 'error',
        hasSession: false,
        errorKind: kind,
      });
    };

    const timeout = window.setTimeout(() => finishError('network'), 15000);

    const discardCancelledSession = async (sessionAvailable: boolean) => {
      if (!sessionAvailable || (active && !settled)) return false;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Persisted storage is cleared below and the timeout path hard reloads.
      } finally {
        clearPersistedSupabaseAuthSession();
      }
      if (active && settled) {
        window.location.replace(
          '/auth/confirmed?error=timeout&error_description=Verification+timed+out',
        );
      } else if (!active) {
        window.location.replace('/signin');
      }
      return true;
    };

    const verify = async () => {
      try {
        if (callback.kind === 'provider_error') {
          finishError(classifyAuthCallbackError(`${callback.code} ${callback.description}`));
          return;
        }

        // Always process the email callback before looking at an existing
        // browser session. Otherwise an unrelated signed-in account can cause
        // this confirmation code to be skipped.
        if (callback.kind === 'token_hash') {
          if (callback.otpType !== 'signup') {
            finishError('invalid');
            return;
          }
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: callback.tokenHash,
            type: callback.otpType,
          });
          if (!error) {
            if (await discardCancelledSession(Boolean(data.session))) return;
            finishConfirmed(Boolean(data.session));
            return;
          }
          finishError(classifyAuthCallbackError(error.message));
          return;
        }

        if (callback.kind === 'code') {
          const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
          const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType;
          if (await discardCancelledSession(Boolean(data.session))) return;
          if (!error && data.session && redirectType !== 'recovery') {
            finishConfirmed(Boolean(data.session));
            return;
          }
          if (data.session) await supabase.auth.signOut({ scope: 'local' });
          finishError(classifyAuthCallbackError(error?.message || 'unexpected confirmation flow'));
          return;
        }

        if (callback.kind === 'implicit') {
          if (callback.flowType !== 'signup') {
            finishError('invalid');
            return;
          }
          const { data, error } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          if (!error) {
            if (await discardCancelledSession(Boolean(data.session))) return;
            finishConfirmed(Boolean(data.session));
            return;
          }
          finishError(classifyAuthCallbackError(error.message));
          return;
        }

        finishError('invalid');
      } catch (error: unknown) {
        finishError(classifyAuthCallbackError(
          error instanceof Error ? error.message : 'invalid confirmation callback',
        ));
      } finally {
        window.clearTimeout(timeout);
      }
    };

    // Deferring one task makes this effect safe under React 18 development
    // StrictMode: the throwaway first effect is cleaned up before it can redeem
    // a single-use email token.
    const cancelRedemption = scheduleAuthCallbackRedemption(() => void verify());
    return () => {
      active = false;
      cancelRedemption();
      window.clearTimeout(timeout);
    };
  }, []);

  const errorTitle = state.errorKind === 'expired'
    ? t.authConfirmed.expiredTitle
    : state.errorKind === 'network'
      ? t.authConfirmed.networkTitle
      : t.authConfirmed.invalidTitle;
  const errorDescription = state.errorKind === 'expired'
    ? t.authConfirmed.expiredDescription
    : state.errorKind === 'network'
      ? t.authConfirmed.networkDescription
      : t.authConfirmed.invalidDescription;

  return (
    <main className="auth-shell">
      <AuthPageNav backLabel={t.authConfirmed.backToHome} />
      <div className="auth-card-container">
        <section className="auth-card signup auth-card--compact auth-state-card">
          <Link to="/" className="auth-brand-logo-text">Alpha<span className="accent">Lab</span></Link>
          <span className="auth-card-eyebrow">{t.authConfirmed.eyebrow}</span>
          {state.phase === 'checking' ? (
            <div className="auth-status-panel" role="status" aria-live="polite">
              <span className="spinner is-dark" aria-hidden="true" />
              <Text>{t.authConfirmed.verifying}</Text>
            </div>
          ) : state.phase === 'confirmed' ? (
            <div className="auth-status-panel" role="status" aria-live="polite">
              <div className="auth-status-mark is-success" aria-hidden="true">✓</div>
              <Title level={1} className="auth-title">{t.authConfirmed.title}</Title>
              <Text className="auth-subtitle">{t.authConfirmed.description}</Text>
              <Button type="primary" className="auth-btn" block onClick={() => navigate(state.hasSession ? '/dashboard' : '/signin')}>
                {state.hasSession ? t.auth.continueToWorkspace : t.authConfirmed.continueToSignIn}
              </Button>
            </div>
          ) : (
            <div className="auth-status-panel" role="alert">
              <div className="auth-status-mark is-error" aria-hidden="true">!</div>
              <Title level={1} className="auth-title">{errorTitle}</Title>
              <Text className="auth-subtitle">{errorDescription}</Text>
              <div className="auth-state-actions">
                <Button type="primary" className="auth-btn" block onClick={() => navigate('/signup')}>
                  {t.authConfirmed.returnToSignUp}
                </Button>
                <Button block onClick={() => navigate('/signin')}>
                  {t.authConfirmed.continueToSignIn}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
export default AuthConfirmed;
