import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  ArrowLeftOutlined, 
  SafetyCertificateOutlined,
  BarChartOutlined,
  SecurityScanOutlined,
  KeyOutlined
} from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import type { Provider } from '@supabase/supabase-js';
import '../styles/Auth.css';

const { Title, Text } = Typography;

const REMEMBER_EMAIL_KEY = 'alpha_lab_remember_email';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);
  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = captchaConfigured ? !!captchaToken : isDev;
  const [form] = Form.useForm();

  useEffect(() => {
    window.scrollTo(0, 0);
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      form.setFieldsValue({ email: savedEmail, remember: true });
    }
  }, [form]);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (values: { email: string; password: string; remember?: boolean }) => {
    setSubmitting(true);
    setError('');
    const result = await login(values.email, values.password, captchaToken);
    setSubmitting(false);
    if (result.success) {
      if (values.remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      navigate('/dashboard');
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
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError(t.auth.errorNetworkIssue);
      } else if (errMsg.includes('session_expired') || errMsg.includes('session not found')) {
        setError(t.auth.errorSessionExpired);
      } else {
        setError(result.message || t.auth.errorUnexpected);
      }
    }
  };

  const toggleLang = () => {
    setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
  };

  const handleOAuthLogin = async (provider: Provider) => {
    if (oauthLoading) return;
    setOauthLoading(provider);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        setError(error.message);
        setOauthLoading(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (t.auth.oauthFailed || 'OAuth login failed');
      setError(msg);
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

  return (
    <div className="auth-shell">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />

      <div className="auth-nav-top">
        <Link to="/" className="auth-back-link-top">
          <ArrowLeftOutlined aria-hidden="true" /> {t.auth.backToHome}
        </Link>
        <button type="button" onClick={toggleLang} className="lang-toggle-btn">
          {language === 'zh-CN' ? 'EN' : '中文'}
        </button>
      </div>

      <div className="auth-card-container">
        <div className="auth-card signin">
          <div className="signin-form-grid">
            {/* Left Column: Branding and Features */}
            <div className="auth-card-header" style={{ textAlign: 'left', marginBottom: 0, paddingTop: 20 }}>
              <div className="auth-brand-logo-text" style={{ textAlign: 'left', margin: '0 0 16px 0' }} onClick={() => navigate('/')}>
                Alpha<span className="accent">Lab</span>
              </div>
              <Title level={2} className="auth-title">{t.auth.welcomeBack}</Title>
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
              <Title level={3} className="auth-form-title" style={{ marginBottom: 16 }}>{t.auth.signInBtn}</Title>
              
              {error && (
                <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 14, borderRadius: 12 }} />
              )}

              <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="off">
                <Form.Item name="email" label={t.auth.emailAddress} rules={[{ required: true, message: t.auth.enterValidEmail }]} style={{ marginBottom: 10 }}>
                  <Input prefix={<UserOutlined aria-hidden="true" />} placeholder={t.auth.emailPlaceholderSignIn} className="auth-input" />
                </Form.Item>

                <Form.Item name="password" label={t.auth.password} rules={[{ required: true, message: t.auth.passwordMinLength }]} style={{ marginBottom: 10 }}>
                  <Input.Password prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.passwordPlaceholderSignIn} autoComplete="current-password" />
                </Form.Item>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Form.Item name="remember" valuePropName="checked" noStyle>
                    <Checkbox className="auth-checkbox">{t.auth.rememberEmail}</Checkbox>
                  </Form.Item>
                  <Link to="/forgot-password" className="auth-link-forgot">{t.auth.forgotPassword}</Link>
                </div>

                <div className="auth-captcha-wrapper" style={{ marginBottom: 14 }}>
                  {captchaConfigured ? (
                    <Turnstile
                      sitekey={turnstileSiteKey || ''}
                      onLoad={(_widgetId, bound) => { turnstileRef.current = bound; }}
                      onVerify={(token) => setCaptchaToken(token)}
                      onError={() => setCaptchaToken('')}
                      onExpire={() => setCaptchaToken('')}
                      theme="dark"
                    />
                  ) : isDev ? (
                    <div style={{ padding: '10px 14px', background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 8, color: '#fbbf24', fontSize: 12, textAlign: 'center' }}>
                      {t.auth.captchaNotConfigured} — {t.auth.captchaBypassDev || 'Bypassed in development'}
                    </div>
                  ) : (
                    <div className="auth-captcha-placeholder error">{t.auth.captchaNotConfigured}</div>
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
                    { provider: 'github' as Provider, label: 'GitHub', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#e2e8f0" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>) },
                  ].map((btn) => {
                    const isLoading = oauthLoading === btn.provider;
                    return (
                      <button key={btn.provider} type="button" onClick={() => handleOAuthLogin(btn.provider)} disabled={!!oauthLoading} className="oauth-btn">
                        {isLoading ? <span className="spinner" /> : btn.icon}
                        {isLoading ? '' : btn.label}
                      </button>
                    );
                  })}
                </div>
                <div className="auth-oauth-footer">
                  <span>{t.auth.oauthAttribution} · Secured by Supabase Auth</span>
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
    </div>
  );
};

export default SignIn;