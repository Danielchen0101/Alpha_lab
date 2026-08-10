import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link, useLocation } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  SafetyCertificateOutlined,
  BarChartOutlined,
  SecurityScanOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import {
  getEmailConfirmationRedirect,
  getOAuthSignInRedirect,
} from '../lib/authRedirect';
import {
  classifyAuthCallbackError,
  parseAuthCallback,
} from '../lib/authCallback';
import { getSafeInternalRedirect } from '../lib/safeRedirect';
import AuthPageNav from '../components/AuthPageNav';
import AuthTurnstile, { AuthTurnstileHandle } from '../components/AuthTurnstile';
import { withAuthTimeout } from '../services/authSession';
import type { Provider } from '@supabase/supabase-js';
import '../styles/Auth.css';

const { Title, Text } = Typography;

const REMEMBER_EMAIL_KEY = 'alpha_lab_remember_email';

interface SignInLocationState {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
}

const getSafeRedirectPath = (candidate?: string | null) => {
  const safePath = getSafeInternalRedirect(candidate);
  if (!safePath) return null;
  const pathname = safePath.split(/[?#]/, 1)[0];
  if (pathname === '/signin' || pathname === '/login') return null;
  return safePath;
};

const getRememberedLandingPage = () => {
  try {
    return getSafeRedirectPath(window.localStorage.getItem('alphalab:default-landing-page'));
  } catch {
    return null;
  }
};

const useCompactCaptcha = () => {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 360px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
};

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading, mfaRequired } = useAuth();
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<AuthTurnstileHandle | null>(null);
  const compactCaptcha = useCompactCaptcha();
  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = !supabaseConfigError && (captchaConfigured ? !!captchaToken : isDev);
  const canResendConfirmation = !supabaseConfigError
    && !resendingConfirmation
    && (captchaConfigured ? !!captchaToken : isDev);
  const [form] = Form.useForm();
  const initialOAuthCallbackRef = useRef<ReturnType<typeof parseAuthCallback> | null>(null);
  if (initialOAuthCallbackRef.current === null) {
    initialOAuthCallbackRef.current = parseAuthCallback(
      window.location.search,
      window.location.hash,
    );
  }
  const initialOAuthCallback = initialOAuthCallbackRef.current;
  const oauthCallbackErrorMessage = initialOAuthCallback.kind === 'provider_error'
    ? classifyAuthCallbackError(
      `${initialOAuthCallback.code} ${initialOAuthCallback.description}`,
    ) === 'network'
      ? t.auth.errorNetworkIssue
      : t.auth.oauthFailed
    : '';
  const from = (location.state as SignInLocationState | null)?.from;
  const stateRedirect = from?.pathname
    ? `${from.pathname}${from.search || ''}${from.hash || ''}`
    : null;
  const queryRedirect = new URLSearchParams(location.search).get('next');
  const passwordUpdated = new URLSearchParams(location.search).get('passwordUpdated') === '1';
  const passwordSessionWarning = new URLSearchParams(location.search).get('sessionWarning') === '1';
  const redirectPath = getSafeRedirectPath(queryRedirect)
    || getSafeRedirectPath(stateRedirect)
    || getRememberedLandingPage()
    || '/dashboard';

  useEffect(() => {
    window.scrollTo(0, 0);
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      form.setFieldsValue({ email: savedEmail, remember: true });
    }
  }, [form]);

  useEffect(() => {
    if (!oauthCallbackErrorMessage) return;
    setError(oauthCallbackErrorMessage);
    const cleanUrl = new URL(window.location.href);
    for (const key of ['error', 'error_code', 'error_description']) {
      cleanUrl.searchParams.delete(key);
    }
    cleanUrl.hash = '';
    window.history.replaceState(
      window.history.state,
      document.title,
      `${cleanUrl.pathname}${cleanUrl.search}`,
    );
  }, [oauthCallbackErrorMessage]);

  if (loading) {
    return (
      <main className="auth-shell">
        <div className="auth-card-container">
          <section className="auth-card auth-card--compact auth-loading-card" role="status" aria-live="polite">
            <span className="spinner is-dark" aria-hidden="true" />
            <div>
              <strong>{language === 'zh-CN' ? '正在恢复工作区' : 'Restoring your workspace'}</strong>
              <span>{language === 'zh-CN' ? '正在检查登录状态…' : 'Checking your session…'}</span>
            </div>
          </section>
        </div>
      </main>
    );
  }
  if (isAuthenticated) return <Navigate to={mfaRequired ? `/mfa?next=${encodeURIComponent(redirectPath)}` : redirectPath} replace />;

  const handleLogin = async (values: { email: string; password: string; remember?: boolean }) => {
    if (supabaseConfigError) {
      setError(t.auth.authServiceUnavailable);
      return;
    }
    if (!captchaConfigured && !isDev) {
      setError(t.auth.captchaNotConfigured);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError(t.auth.captchaSignInError);
      return;
    }
    setSubmitting(true);
    setError('');
    setUnconfirmedEmail('');
    setConfirmationMessage('');
    const result = await login(values.email, values.password, captchaToken);
    setSubmitting(false);
    if (result.success) {
      if (values.remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      navigate(result.mfaRequired ? `/mfa?next=${encodeURIComponent(redirectPath)}` : redirectPath, { replace: true });
    } else {
      setCaptchaToken('');
      turnstileRef.current?.reset();
      const errMsg = (result.message || '').toLowerCase();
      if (errMsg.includes('captcha') || errMsg.includes('captcha_token')) {
        setError(t.auth.captchaSignInError || t.auth.verifyHuman);
      } else if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid email')) {
        setError(t.auth.invalidCredentials);
      } else if (errMsg.includes('email not confirmed')) {
        setError(t.auth.checkEmailConfirmation);
        setUnconfirmedEmail(values.email.trim());
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError(t.auth.errorNetworkIssue);
      } else if (errMsg.includes('session_expired') || errMsg.includes('session not found')) {
        setError(t.auth.errorSessionExpired);
      } else {
        setError(t.auth.errorUnexpected);
      }
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    if (supabaseConfigError) {
      setConfirmationMessage(t.auth.authServiceUnavailable);
      return;
    }
    if (!captchaConfigured && !isDev) {
      setConfirmationMessage(t.auth.captchaNotConfigured);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setConfirmationMessage(t.auth.confirmationResendCaptcha);
      return;
    }
    if (!canResendConfirmation) return;
    setResendingConfirmation(true);
    setConfirmationMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: {
          emailRedirectTo: getEmailConfirmationRedirect(),
          captchaToken: captchaToken || undefined,
        },
      });
      if (resendError) throw resendError;
      setConfirmationMessage(t.auth.confirmationResent);
    } catch (resendError: unknown) {
      const message = resendError instanceof Error ? resendError.message.toLowerCase() : '';
      setConfirmationMessage(
        message.includes('captcha')
          ? t.auth.confirmationResendCaptcha
          : message.includes('rate') || message.includes('too many')
          ? t.auth.confirmationResendRateLimit
          : t.auth.confirmationResendFailed,
      );
    } finally {
      setCaptchaToken('');
      turnstileRef.current?.reset();
      setResendingConfirmation(false);
    }
  };

  const handleOAuthLogin = async (provider: Provider) => {
    if (oauthLoading) return;
    if (supabaseConfigError) {
      setError(t.auth.authServiceUnavailable);
      return;
    }
    setOauthLoading(provider);
    setError('');
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: getOAuthSignInRedirect(redirectPath),
          },
        }),
        10_000,
        'OAuth sign in',
      );
      if (error) {
        setError(t.auth.oauthFailed || t.auth.errorUnexpected);
        setOauthLoading(null);
      }
    } catch {
      setError(t.auth.oauthFailed || t.auth.errorUnexpected);
      setOauthLoading(null);
    }
  };

  const features = [
    {
      icon: <BarChartOutlined />,
      title: t.auth.authFeatureMarketTitle,
      desc: t.auth.authFeatureMarketDesc,
    },
    {
      icon: <SecurityScanOutlined />,
      title: t.auth.authFeatureExecutionTitle,
      desc: t.auth.authFeatureExecutionDesc,
    },
    {
      icon: <KeyOutlined />,
      title: t.auth.authFeatureSecurityTitle,
      desc: t.auth.authFeatureSecurityDesc,
    }
  ];
  const captchaCopy = {
    developmentBypass: `${t.auth.captchaNotConfigured} · ${t.auth.captchaBypassDev}`,
    missingConfiguration: t.auth.captchaNotConfigured,
    loadFailed: t.auth.captchaLoadFailed,
    timedOut: t.auth.captchaTimedOut,
    unsupported: t.auth.captchaUnsupported,
    retry: t.auth.captchaRetry,
    reload: t.auth.captchaReload,
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />

      <AuthPageNav backLabel={t.auth.backToHome} />

      <div className="auth-card-container">
        <div className="auth-card signin">
          <div className="signin-form-grid">
            {/* Left Column: Branding and Features */}
            <div className="auth-card-header" style={{ textAlign: 'left', marginBottom: 0, paddingTop: 20 }}>
              <Link to="/" className="auth-brand-logo-text" style={{ textAlign: 'left', margin: '0 0 16px 0' }} aria-label={language === 'zh-CN' ? '返回 AlphaLab 首页' : 'Return to AlphaLab home'}>
                Alpha<span className="accent">Lab</span>
              </Link>
              <span className="auth-card-eyebrow">{language === 'zh-CN' ? '01 / 受保护的工作区' : '01 / SECURE WORKSPACE'}</span>
              <Title level={1} className="auth-title">{t.auth.welcomeBack}</Title>
              <Text className="auth-subtitle">{t.auth.signInSubtitle}</Text>
              
              <div className="auth-features-container">
                {features.map((f, i) => (
                  <div key={i} className="auth-feature-item">
                    <div className="auth-feature-icon">{f.icon}</div>
                    <div className="auth-feature-content">
                      <span className="auth-feature-title">{f.title}</span>
                      <span className="auth-feature-desc">{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="trust-row" style={{ justifyContent: 'flex-start', marginTop: 24, opacity: 0.5 }}>
                <div className="trust-item"><SafetyCertificateOutlined aria-hidden="true" /> {t.auth.trustSecureAuth}</div>
                <div className="trust-item"><LockOutlined aria-hidden="true" /> {t.auth.trustEncryptedConfigs}</div>
              </div>
            </div>

            {/* Right Column: Form */}
            <div style={{ paddingLeft: 4, width: '100%', maxWidth: 420 }}>
              <Title level={2} className="auth-form-title" style={{ marginBottom: 16 }}>{t.auth.signInBtn}</Title>
              
              {supabaseConfigError && (
                <Alert message={t.auth.authServiceUnavailable} type="error" showIcon style={{ marginBottom: 14, borderRadius: 12 }} />
              )}
              {error && (
                <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 14, borderRadius: 12 }} />
              )}
              {passwordUpdated && (
                <Alert
                  message={t.auth.passwordUpdated}
                  description={passwordSessionWarning ? t.auth.passwordUpdatedSignOutWarning : undefined}
                  type={passwordSessionWarning ? 'warning' : 'success'}
                  showIcon
                  style={{ marginBottom: 14, borderRadius: 12 }}
                />
              )}
              {unconfirmedEmail && (
                <div className="auth-inline-action" role="status" aria-live="polite">
                  <Button onClick={handleResendConfirmation} loading={resendingConfirmation} disabled={!canResendConfirmation}>
                    {resendingConfirmation ? t.auth.resendingConfirmation : t.auth.resendConfirmation}
                  </Button>
                  <Text>
                    {confirmationMessage
                      || (captchaConfigured
                        ? t.auth.confirmationResendCaptcha
                        : isDev
                          ? t.auth.captchaBypassDev
                          : t.auth.captchaNotConfigured)}
                  </Text>
                </div>
              )}

              <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="on" aria-busy={submitting}>
                <Form.Item name="email" label={t.auth.emailAddress} rules={[{ required: true, message: t.auth.enterValidEmail }]} style={{ marginBottom: 10 }}>
                  <Input type="email" autoComplete="username" prefix={<UserOutlined aria-hidden="true" />} placeholder={t.auth.emailPlaceholderSignIn} className="auth-input" />
                </Form.Item>

                <Form.Item name="password" label={t.auth.password} rules={[{ required: true, message: t.auth.passwordPlaceholderSignIn }]} style={{ marginBottom: 10 }}>
                  <Input.Password prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.passwordPlaceholderSignIn} autoComplete="current-password" />
                </Form.Item>

                <div className="auth-form-options">
                  <Form.Item name="remember" valuePropName="checked" noStyle>
                    <Checkbox className="auth-checkbox">{t.auth.rememberEmail}</Checkbox>
                  </Form.Item>
                  <Link
                    to="/forgot-password"
                    className="auth-link-forgot auth-link-forgot--button"
                    aria-label={t.auth.forgotPassword}
                  >
                    <KeyOutlined aria-hidden="true" />
                    <span>{t.auth.forgotPassword}</span>
                  </Link>
                </div>

                <div className="auth-captcha-wrapper" style={{ marginBottom: 14 }}>
                  {captchaConfigured ? (
                    <AuthTurnstile
                      ref={turnstileRef}
                      siteKey={turnstileSiteKey}
                      development={isDev}
                      theme={resolvedTheme}
                      language={language}
                      compact={compactCaptcha}
                      copy={captchaCopy}
                      onTokenChange={setCaptchaToken}
                    />
                  ) : isDev ? (
                    <div className="auth-captcha-placeholder" role="status">
                      {t.auth.captchaNotConfigured} · {t.auth.captchaBypassDev}
                    </div>
                  ) : (
                    <div className="auth-captcha-placeholder error" role="alert">{t.auth.captchaNotConfigured}</div>
                  )}
                </div>

                <Form.Item style={{ marginBottom: 12 }}>
                  <Button type="primary" htmlType="submit" loading={submitting} disabled={!canSubmit || submitting} block className="auth-btn">
                    {submitting ? t.auth.signingIn : t.auth.signInBtn}
                  </Button>
                </Form.Item>
              </Form>

              <div className="auth-oauth-section">
                <div className="auth-divider">
                  <div className="line" />
                  <Text className="text">{t.auth.continueWith}</Text>
                  <div className="line" />
                </div>
                <div className="auth-oauth-grid">
                  {[
                    { provider: 'google' as Provider, label: 'Google', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>) },
                    { provider: 'github' as Provider, label: 'GitHub', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>) },
                  ].map((btn) => {
                    const isLoading = oauthLoading === btn.provider;
                    return (
                      <button key={btn.provider} type="button" onClick={() => handleOAuthLogin(btn.provider)} disabled={!!oauthLoading || !!supabaseConfigError} className="oauth-btn">
                        {isLoading ? <span className="spinner" /> : btn.icon}
                        {isLoading ? '' : btn.label}
                      </button>
                    );
                  })}
                </div>
                <div className="auth-oauth-footer">
                  <span>{t.auth.oauthAttribution}</span>
                </div>
              </div>

              <div className="auth-bottom-switch" style={{ borderTop: 'none', paddingTop: 0, marginTop: 12 }}>
                <Text className="text">
                  {t.auth.noAccount}
                  <Link to="/signup" className="link">{t.auth.createAccount}</Link>
                </Text>
              </div>
            </div>
          </div>
        </div>

        <div className="product-proof-bar">
          <div className="proof-item">{t.auth.featureAiTitle}</div>
          <div className="proof-dot" />
          <div className="proof-item">{t.auth.featurePaperTitle}</div>
          <div className="proof-dot" />
          <div className="proof-item">{t.auth.trustEncryptedConfigs}</div>
        </div>
      </div>
    </main>
  );
};

export default SignIn;
