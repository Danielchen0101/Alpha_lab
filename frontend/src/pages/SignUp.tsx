import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { getEmailConfirmationRedirect } from '../lib/authRedirect';
import type { Provider } from '@supabase/supabase-js';
import '../styles/Auth.css';

const { Title, Text } = Typography;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [formValid, setFormValid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);
  const compactCaptcha = useCompactCaptcha();

  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = formValid && (captchaConfigured ? !!captchaToken : isDev);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setCaptchaToken('');
    turnstileRef.current = null;
  }, [language, resolvedTheme]);

  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleFinish = async (values: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    terms?: boolean;
  }) => {
    setError('');
    if (!values.terms) {
      setError(t.auth.acceptTerms);
      return;
    }
    if (values.password !== values.confirmPassword) {
      setError(t.auth.passwordsDoNotMatchError);
      return;
    }
    const redirectTo = getEmailConfirmationRedirect();
    setSubmitting(true);
    const result = await signUp(values.email, values.password, captchaToken, values.fullName, redirectTo);      
    setSubmitting(false);
    if (result.success) {
      setCaptchaToken('');
      turnstileRef.current?.reset();
      setSubmittedEmail(values.email.trim());
      setConfirmationRequired(result.confirmationRequired !== false);
      setSubmitted(true);
    } else {
      const errMsg = (result.message || '').toLowerCase();
      if (errMsg.includes('invalid email')) {
        setError(t.auth.enterValidEmail);
      } else if (errMsg.includes('invalid login credentials')) {
        setError(t.auth.registrationFailed || t.auth.errorUnexpected);
      } else if (errMsg.includes('already') && errMsg.includes('registered')) {
        setError(t.auth.errorEmailExists);
      } else if (errMsg.includes('weak') || errMsg.includes('password')) {
        setError(t.auth.errorWeakPassword);
      } else if (errMsg.includes('captcha') || errMsg.includes('captcha_token')) {
        setError(t.auth.signUpHelperCaptcha || t.auth.verifyHuman);
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError(t.auth.errorNetworkIssue);
      } else {
        setError(t.auth.errorUnexpected);
      }
    }
  };

  const handleResendConfirmation = async () => {
    if (!submittedEmail || resending) return;
    setResending(true);
    setResendMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
        options: { emailRedirectTo: getEmailConfirmationRedirect() },
      });
      if (resendError) throw resendError;
      setResendMessage(t.auth.confirmationResent);
    } catch (resendError: unknown) {
      const message = resendError instanceof Error ? resendError.message.toLowerCase() : '';
      setResendMessage(
        message.includes('rate') || message.includes('too many')
          ? t.auth.confirmationResendRateLimit
          : t.auth.confirmationResendFailed,
      );
    } finally {
      setResending(false);
    }
  };

  const toggleLang = () => {
    setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
  };

  const handleOAuthLogin = async (provider: Provider) => {
    if (oauthLoading) return;
    if (!termsAccepted) {
      setError(t.auth.acceptTerms);
      void form.validateFields(['terms']).catch(() => undefined);
      return;
    }
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
        setError(t.auth.oauthFailed || t.auth.errorUnexpected);
        setOauthLoading(null);
      }
    } catch {
      setError(t.auth.oauthFailed || t.auth.errorUnexpected);
      setOauthLoading(null);
    }
  };

  const getButtonTip = () => {
    if (captchaConfigured && !captchaToken && !termsAccepted) {
      return t.auth.signUpHelperAll;
    }
    if (captchaConfigured && !captchaToken) {
      return t.auth.signUpHelperCaptcha;
    }
    if (!termsAccepted) {
      return t.auth.signUpHelperTerms;
    }
    if (!formValid) {
      const values = form.getFieldsValue();
      if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
        return t.auth.signUpHelperPasswordMismatch;
      }
      return t.auth.signUpHelperFields;
    }
    return '';
  };

  const buttonTip = getButtonTip();

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />

      <div className="auth-nav-top">
        <Link to="/" className="auth-back-link-top">
          <ArrowLeftOutlined aria-hidden="true" /> {t.auth.backToHome}
        </Link>
        <button type="button" onClick={toggleLang} className="lang-toggle-btn" aria-label={language === 'zh-CN' ? 'Switch language to English' : '切换语言为中文'}>
          {language === 'zh-CN' ? 'EN' : '中文'}
        </button>
      </div>

      <div className="auth-card-container">
        <div className="auth-card signup">
          <div className="auth-card-header">
            <button type="button" className="auth-brand-logo-text" onClick={() => navigate('/')} aria-label={language === 'zh-CN' ? '返回 AlphaLab 首页' : 'Return to AlphaLab home'}>
              Alpha<span className="accent">Lab</span>
            </button>
            <span className="auth-card-eyebrow">{language === 'zh-CN' ? '02 / 研究账户' : '02 / RESEARCH ACCOUNT'}</span>
            <Title level={1} className="auth-title">{t.auth.createAccount}</Title>
            <Text className="auth-subtitle">{t.auth.signUpSubtitle}</Text>
            <span className="auth-trust-microcopy">{t.auth.trustMicrocopy}</span>
          </div>

          <div className="auth-form-content">
            {submitted ? (
              <div className="auth-success-panel" role="status" aria-live="polite">
                <div className="auth-status-mark is-success" aria-hidden="true">✓</div>
                <Title level={3} className="auth-success-title">{confirmationRequired ? t.auth.accountCreated : t.auth.accountReady}</Title>
                <Text className="auth-success-copy">{confirmationRequired ? t.auth.accountCreatedDesc : t.auth.accountReadyDesc}</Text>
                {confirmationRequired && (
                  <>
                    <Button loading={resending} disabled={resending} size="large" onClick={handleResendConfirmation} style={{ width: '100%', maxWidth: 300 }}>
                      {resending ? t.auth.resendingConfirmation : t.auth.resendConfirmation}
                    </Button>
                    {resendMessage && <Text className="auth-success-copy" role="status" aria-live="polite">{resendMessage}</Text>}
                  </>
                )}
                <Button type="primary" size="large" onClick={() => navigate(confirmationRequired ? '/signin' : '/dashboard')} className="auth-btn" style={{ width: '100%', maxWidth: 300 }}>
                  {confirmationRequired ? t.auth.goToSignIn : t.auth.continueToWorkspace}
                </Button>
              </div>
            ) : (
              <>
                {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 20, borderRadius: 12 }} />}

                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleFinish}
                  onValuesChange={() => {
                    const vals = form.getFieldsValue();
                    const password = vals.password || '';
                    const passwordsMatch = password.length >= 8 && password === vals.confirmPassword;
                    setTermsAccepted(!!vals.terms);
                    setFormValid(
                      !!vals.fullName?.trim()
                      && EMAIL_RE.test(vals.email || '')
                      && passwordsMatch
                      && !!vals.terms
                    );
                  }}
                  autoComplete="on"
                  aria-busy={submitting}
                >
                  <div className="signup-form-grid">
                    <Form.Item name="fullName" label={t.auth.fullName} rules={[{ required: true, message: t.auth.enterFullName }]}>
                      <Input autoComplete="name" prefix={<UserOutlined aria-hidden="true" />} placeholder={t.auth.fullNamePlaceholder} className="auth-input" />
                    </Form.Item>
                    <Form.Item name="email" label={t.auth.emailAddress} rules={[{ required: true, message: t.auth.enterValidEmail }, { type: 'email', message: t.auth.enterValidEmail }]}>
                      <Input type="email" autoComplete="email" prefix={<MailOutlined aria-hidden="true" />} placeholder={t.auth.emailPlaceholder} className="auth-input" />
                    </Form.Item>
                  </div>

                  <div className="signup-form-grid">
                    <Form.Item name="password" label={t.auth.password} rules={[{ required: true, message: t.auth.passwordMinLength }, { min: 8, message: t.auth.passwordMinLength }]}>
                      <Input.Password autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.passwordPlaceholder} className="auth-input" />
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
                      <Input.Password autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.confirmPasswordPlaceholder} className="auth-input" />
                    </Form.Item>
                  </div>

                  <div className="auth-password-rules" aria-live="polite">
                    {[
                      { test: (v: string) => v.length >= 8, label: t.auth.passwordRuleLength },
                      { test: (v: string) => v === form.getFieldValue('confirmPassword') && v.length > 0, label: t.auth.passwordRuleMatch },
                    ].map((rule, i) => {
                      const pw = form.getFieldValue('password') || '';
                      const met = pw ? rule.test(pw) : false;
                      return (
                        <div key={i} className={`auth-password-rule ${met ? 'is-met' : ''}`}>
                          <span style={{ marginRight: 6 }}>{met ? '✓' : '○'}</span>{rule.label}
                        </div>
                      );
                    })}
                  </div>

                  <Form.Item name="terms" valuePropName="checked" style={{ marginBottom: 14 }} rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error(t.auth.acceptTerms)) }]}>
                    <Checkbox className="auth-checkbox">
                      {t.auth.termsPrefix}{' '}
                      <Link to="/terms" className="auth-link-forgot">{t.auth.termsOfService}</Link>{' '}
                      {t.auth.and}{' '}
                      <Link to="/privacy" className="auth-link-forgot">{t.auth.privacyPolicy}</Link>
                    </Checkbox>
                  </Form.Item>

                  <div className="auth-captcha-wrapper" style={{ margin: '12px auto 16px' }}>
                    {captchaConfigured ? (
                      <Turnstile
                        key={`${resolvedTheme}-${language}`}
                        sitekey={turnstileSiteKey || ''}
                        className="auth-turnstile"
                        size={compactCaptcha ? 'compact' : 'flexible'}
                        fixedSize
                        onLoad={(_widgetId, bound) => { turnstileRef.current = bound; }}
                        onVerify={(token) => setCaptchaToken(token)}
                        onError={() => { setCaptchaToken(''); }}
                        onExpire={() => setCaptchaToken('')}
                        theme={resolvedTheme}
                        language={language === 'zh-CN' ? 'zh-CN' : 'en'}
                      />
                    ) : isDev ? (
                      <div className="auth-captcha-placeholder" role="status">
                        {t.auth.captchaNotConfigured} · {t.auth.captchaBypassDev}
                      </div>
                    ) : (
                      <div className="auth-captcha-placeholder error">{t.auth.captchaNotConfigured}</div>
                    )}
                  </div>

                  <Form.Item style={{ marginBottom: 12 }}>
                    <Button type="primary" htmlType="submit" loading={submitting} block disabled={!canSubmit || submitting} className="auth-btn">
                      {submitting ? t.auth.creatingAccount : t.auth.createAccountBtn}
                    </Button>
                    {buttonTip && <div className="auth-button-tip">{buttonTip}</div>}
                  </Form.Item>
                </Form>

                <div className="auth-trust-summary">
                  <span>✓ {t.auth.trustSecureAuth}</span>
                  <span>✓ {t.auth.trustEncryptedConfigs}</span>
                  <span>✓ {t.auth.trustEmailReq}</span>
                </div>

                <div className="auth-oauth-section">
                  <div className="auth-divider" style={{ marginBottom: 14 }}>
                    <div className="line" />
                    <Text className="text">{t.auth.signUpWith}</Text>
                    <div className="line" />
                  </div>
                  <div className="auth-oauth-grid" style={{ gap: 16 }}>
                    {[
                      { provider: 'google' as Provider, label: 'Google', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>) },        
                      { provider: 'github' as Provider, label: 'GitHub', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>) },
                    ].map((btn) => {
                      const isLoading = oauthLoading === btn.provider;
                      return (
                        <button key={btn.provider} type="button" onClick={() => handleOAuthLogin(btn.provider)} disabled={!termsAccepted || !!oauthLoading} className="oauth-btn" style={{ height: 42 }}>
                          {isLoading ? <span className="spinner" /> : btn.icon}
                          {isLoading ? t.auth.oauthRedirecting : btn.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="auth-oauth-footer">
                    <span>{t.auth.oauthAttribution}</span>
                  </div>
                </div>

                <div className="auth-bottom-switch" style={{ marginTop: 18, paddingTop: 16 }}>
                  <Text className="text">
                    {t.auth.alreadyHaveAccount}
                    <Link to="/signin" className="link">{t.auth.signIn}</Link>
                  </Text>
                </div>
              </>
            )}
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

export default SignUp;
