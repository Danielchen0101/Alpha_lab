import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import type { Provider } from '@supabase/supabase-js';
import '../styles/Auth.css';

const { Title, Text } = Typography;

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);

  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const captchaConfigured = !!turnstileSiteKey;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleFinish = async (values: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    terms?: boolean;
  }) => {
    setError('');
    if (values.password !== values.confirmPassword) {
      setError(t.auth.passwordsDoNotMatchError);
      return;
    }
    const redirectTo = `${window.location.origin}/auth/confirmed`;
    setSubmitting(true);
    const result = await signUp(values.email, values.password, captchaToken, values.fullName, redirectTo);      
    setSubmitting(false);
    if (result.success) {
      setCaptchaToken('');
      turnstileRef.current?.reset();
      setSubmitted(true);
    } else {
      const errMsg = (result.message || '').toLowerCase();
      if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid email')) {
        setError(t.auth.invalidCredentials);
      } else if (errMsg.includes('already') && errMsg.includes('registered')) {
        setError(t.auth.errorEmailExists);
      } else if (errMsg.includes('weak') || errMsg.includes('password')) {
        setError(t.auth.errorWeakPassword);
      } else if (errMsg.includes('captcha') || errMsg.includes('captcha_token')) {
        setError(t.auth.captchaSignInError || t.auth.verifyHuman);
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError(t.auth.errorNetworkIssue);
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
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        setError(error.message);
        setOauthLoading(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'OAuth login failed';
      setError(msg);
      setOauthLoading(null);
    }
  };

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
        <div className="auth-card signup">
          <div className="auth-card-header">
            <img
              src="/brand/alphalab-logo.png"
              alt="AlphaLab"
              className="auth-brand-logo"
              onClick={() => navigate('/')}
            />
            <Title level={2} className="auth-title">{t.auth.createAccount}</Title>
            <Text className="auth-subtitle">{t.auth.signUpSubtitle}</Text>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px', background: 'rgba(24, 144, 255, 0.1)', border: '2px solid #1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#1890ff', boxShadow: '0 0 20px rgba(24,144,255,0.2)' }}>✓</div>
              <Title level={3} style={{ color: '#fff', marginBottom: 12, fontWeight: 700 }}>{t.auth.accountCreated}</Title>
              <Text style={{ color: '#94a3b8', fontSize: '1rem', display: 'block', marginBottom: 32, lineHeight: 1.5 }}>{t.auth.accountCreatedDesc}</Text>
              <Button type="primary" size="large" onClick={() => navigate('/signin')} className="auth-btn" style={{ width: '100%', maxWidth: 300 }}>{t.auth.goToSignIn}</Button>
            </div>
          ) : (
            <>
              {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 24, borderRadius: 12 }} />}

              <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                onValuesChange={() => {
                  const vals = form.getFieldsValue();
                  const passwordsMatch = vals.password === vals.confirmPassword;
                  setFormValid(
                    !!vals.fullName && !!vals.email && !!vals.password && !!vals.confirmPassword && passwordsMatch && !!vals.terms && !!captchaToken
                  );
                }}
                autoComplete="off"
              >
                <div className="signup-grid">
                  <Form.Item name="fullName" label={t.auth.fullName} rules={[{ required: true, message: t.auth.enterFullName }]}>
                    <Input prefix={<UserOutlined aria-hidden="true" />} placeholder={t.auth.fullNamePlaceholder} className="auth-input" />
                  </Form.Item>
                  <Form.Item name="email" label={t.auth.emailAddress} rules={[{ required: true, message: t.auth.enterValidEmail }, { type: 'email', message: t.auth.enterValidEmail }]}>
                    <Input prefix={<MailOutlined aria-hidden="true" />} placeholder={t.auth.emailPlaceholder} className="auth-input" />
                  </Form.Item>
                </div>

                <div className="signup-grid">
                  <Form.Item name="password" label={t.auth.password} rules={[{ required: true, message: t.auth.passwordMinLength }, { min: 8 }]}>
                    <Input.Password prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.passwordPlaceholder} className="auth-input" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label={t.auth.confirmPassword}
                    dependencies={['password']}
                    rules={[
                      { required: true, message: t.auth.passwordsDoNotMatch },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) return Promise.resolve();
                          return Promise.reject(new Error(t.auth.passwordsDoNotMatch));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.confirmPasswordPlaceholder} className="auth-input" />
                  </Form.Item>
                </div>

                <div style={{ marginTop: -12, marginBottom: 20, paddingLeft: 4, display: 'flex', gap: 16 }}>
                  {[
                    { test: (v: string) => v.length >= 8, label: t.auth.passwordRuleLength },
                    { test: (v: string) => v === form.getFieldValue('confirmPassword') && v.length > 0, label: t.auth.passwordRuleMatch },
                  ].map((rule, i) => {
                    const pw = form.getFieldValue('password') || '';
                    const met = pw ? rule.test(pw) : false;
                    return (
                      <div key={i} style={{ color: met ? '#10b981' : '#475569', fontSize: 11, fontWeight: 500 }}>
                        <span style={{ marginRight: 6 }}>{met ? '✓' : '○'}</span>{rule.label}
                      </div>
                    );
                  })}
                </div>

                <Form.Item name="terms" valuePropName="checked" style={{ marginBottom: 20 }} rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error(t.auth.acceptTerms)) }]}>
                  <Checkbox className="auth-checkbox">
                    {t.auth.termsPrefix}{' '}
                    <Link to="/terms" className="auth-link-forgot">{t.auth.termsOfService}</Link>{' '}
                    {t.auth.and}{' '}
                    <Link to="/privacy" className="auth-link-forgot">{t.auth.privacyPolicy}</Link>
                  </Checkbox>
                </Form.Item>

                <div className="auth-captcha-wrapper">
                  {captchaConfigured ? (
                    <Turnstile
                      sitekey={turnstileSiteKey || ''}
                      onLoad={(_widgetId, bound) => { turnstileRef.current = bound; }}
                      onVerify={(token) => setCaptchaToken(token)}
                      onError={() => { setCaptchaToken(''); }}
                      onExpire={() => setCaptchaToken('')}
                      theme="dark"
                    />
                  ) : (
                    <div className="auth-captcha-placeholder error">{t.auth.captchaNotConfigured}</div>
                  )}
                </div>

                <Form.Item style={{ marginBottom: 16 }}>
                  <Button type="primary" htmlType="submit" loading={submitting} block disabled={!formValid || submitting} className="auth-btn">
                    {submitting ? t.auth.creatingAccount : t.auth.createAccountBtn}
                  </Button>
                </Form.Item>

                {!formValid && !submitting && (
                  <div className="auth-helper-text">
                    <span>{captchaConfigured && !captchaToken ? t.auth.signUpHelperCaptcha : t.auth.signUpHelperTerms}</span>
                  </div>
                )}
              </Form>

              <div className="trust-row">
                <div className="trust-item"><SafetyCertificateOutlined aria-hidden="true" /> {t.auth.trustSecureAuth}</div>
                <div className="trust-item"><LockOutlined aria-hidden="true" /> {t.auth.trustEncryptedConfigs}</div>
              </div>

              <div className="auth-oauth-section">
                <div className="auth-divider">
                  <div className="line" />
                  <Text className="text">{t.auth.signUpWith}</Text>
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
                        {isLoading ? t.auth.oauthRedirecting : btn.label}
                      </button>
                    );
                  })}
                </div>
                <div className="auth-oauth-footer">
                  <span>{t.auth.oauthAttribution} · Secured by Supabase Auth</span>
                </div>
              </div>

              <div className="auth-bottom-switch">
                <Text className="text">
                  {t.auth.alreadyHaveAccount}
                  <Link to="/signin" className="link">{t.auth.signIn}</Link>
                </Text>
              </div>
            </>
          )}
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

export default SignUp;