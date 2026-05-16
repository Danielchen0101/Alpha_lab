import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, ArrowLeftOutlined, SafetyCertificateOutlined, SafetyOutlined } from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import type { Provider } from '@supabase/supabase-js';

const { Title, Text } = Typography;

const SIGNUP_STYLE_ID = 'signup-page-dark-styles';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const isCN = language === 'zh-CN';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);

  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;

  const turnstileDebug = isDev
    ? `[DEBUG] hasSiteKey=${captchaConfigured} prefix=${turnstileSiteKey?.slice(0, 8) || 'none'} NODE_ENV=${process.env.NODE_ENV} captchaToken=${Boolean(captchaToken)} turnstileError=${turnstileError}`
    : null;

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!document.getElementById(SIGNUP_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = SIGNUP_STYLE_ID;
      style.innerHTML = `
        /* --- Input backgrounds & text --- */
        .signup-card .ant-input,
        .signup-card .ant-input-affix-wrapper {
          background: rgba(0,0,0,0.35) !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          color: #F8FAFC !important;
          border-radius: 10px !important;
          transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
        }
        .signup-card .ant-form-item {
          margin-bottom: 14px !important;
        }
        .signup-card .ant-form-item-label {
          padding-bottom: 4px !important;
        }
        .signup-card .ant-input::placeholder,
        .signup-card .ant-input-affix-wrapper input::placeholder {
          color: #64748b !important;
          opacity: 1 !important;
        }
        .signup-card .ant-input-affix-wrapper > input.ant-input {
          background: transparent !important;
          border: none !important;
          color: #F8FAFC !important;
        }
        /* --- Prefix icon color --- */
        .signup-card .ant-input-prefix {
          color: #94A3B8 !important;
        }
        /* --- Password eye icon --- */
        .signup-card .ant-input-password-icon,
        .signup-card .ant-input-password-icon.anticon {
          color: #94A3B8 !important;
        }
        .signup-card .ant-input-password-icon:hover {
          color: #e2e8f0 !important;
        }
        /* --- Focus glow --- */
        .signup-card .ant-input-affix-wrapper:focus,
        .signup-card .ant-input-affix-wrapper-focused,
        .signup-card .ant-input:focus {
          border-color: rgba(24,144,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(24,144,255,0.12) !important;
        }
        /* --- Autofill override --- */
        .signup-card input:-webkit-autofill,
        .signup-card input:-webkit-autofill:hover,
        .signup-card input:-webkit-autofill:focus,
        .signup-card input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px rgba(0,0,0,0.35) inset !important;
          -webkit-text-fill-color: #F8FAFC !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        /* --- Form labels --- */
        .signup-card .ant-form-item-label > label {
          color: #cbd5e1 !important;
          font-size: 0.85rem !important;
          font-weight: 500 !important;
        }
        /* --- Validation error messages --- */
        .signup-card .ant-form-item-explain-error {
          color: #ff7875 !important;
          font-size: 0.8rem !important;
        }
        /* --- Checkbox --- */
        .signup-card .ant-checkbox-wrapper {
          color: #94a3b8 !important;
          font-size: 0.85rem !important;
        }
        .signup-card .ant-checkbox-inner {
          background: rgba(0,0,0,0.3) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .signup-card .ant-checkbox-checked .ant-checkbox-inner {
          background: #1890ff !important;
          border-color: #1890ff !important;
        }
        /* --- Alert error --- */
        .signup-card .ant-alert-error {
          background: rgba(255,77,79,0.08) !important;
          border: 1px solid rgba(255,77,79,0.25) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
        }
        .signup-card .ant-alert-error .ant-alert-message {
          color: #ff7875 !important;
          font-size: 0.85rem !important;
        }
        /* --- Hover on inputs --- */
        .signup-card .ant-input:hover,
        .signup-card .ant-input-affix-wrapper:hover {
          border-color: rgba(255,255,255,0.22) !important;
        }
        /* --- Primary button always white --- */
        .signup-card .ant-btn-primary {
          color: #fff !important;
        }
        .signup-card .ant-btn-primary[disabled],
        .signup-card .ant-btn-primary[disabled]:hover {
          color: rgba(255,255,255,0.5) !important;
          background: linear-gradient(135deg, #1890ff 0%, #2f54eb 100%) !important;
          opacity: 0.5 !important;
          border: none !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
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

  const features = [
    { title: t.auth.featureAiTitle, desc: t.auth.featureAiDesc },
    { title: t.auth.featureBacktestTitle, desc: t.auth.featureBacktestDesc },
    { title: t.auth.featureRiskTitle, desc: t.auth.featureRiskDesc },
    { title: t.auth.featurePaperTitle, desc: t.auth.featurePaperDesc },
  ];

  const toggleLang = () => {
    setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
  };

  const handleOAuthLogin = async (provider: Provider) => {
    if (oauthLoading) return; // prevent double-click
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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020611',
        color: '#e2e8f0',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow effects */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '15%',
          width: '60vw',
          height: '60vw',
          maxWidth: 800,
          maxHeight: 800,
          background:
            'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '15%',
          width: '50vw',
          height: '50vw',
          maxWidth: 700,
          maxHeight: 700,
          background:
            'radial-gradient(circle, rgba(24,144,255,0.06) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Language toggle — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={toggleLang}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            color: '#94a3b8',
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.22)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)';
          }}
        >
          {language === 'zh-CN' ? 'EN' : '中文'}
        </button>
      </div>

      <div
        className="signup-card"
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 960,
          minHeight: 'auto',
          background: 'rgba(17,25,40,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          overflow: 'hidden',
          backdropFilter: 'blur(24px)',
          boxShadow:
            '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(114,46,209,0.05)',
          position: 'relative',
          zIndex: 1,
          flexDirection: 'row',
        }}
      >
        {/* Left panel — features showcase */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '40px 48px',
            background:
              'linear-gradient(160deg, rgba(114,46,209,0.04) 0%, rgba(24,144,255,0.04) 100%)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
          }}
          className="signup-left-panel"
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background:
                'radial-gradient(circle at bottom left, rgba(114,46,209,0.12), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
            <h3
              style={{
                color: '#fff',
                marginBottom: 28,
                fontWeight: 700,
                fontSize: '1.6rem',
                letterSpacing: '-0.02em',
              }}
            >
              {t.auth.buildYourEdge}
            </h3>
            {features.map((item, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#722ed1',
                      boxShadow: '0 0 10px rgba(114,46,209,0.6)',
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.title}
                  </Text>
                </div>
                <Text
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    paddingLeft: 16,
                    lineHeight: 1.4,
                    display: 'block',
                  }}
                >
                  {item.desc}
                </Text>
              </div>
            ))}
            <div
              style={{
                marginTop: 28,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(24,144,255,0.05)',
                border: '1px solid rgba(24,144,255,0.15)',
              }}
            >
              <Text
                style={{
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                }}
              >
                {t.auth.signUpHint}
              </Text>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div
          style={{
            flex: 1,
            padding: '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 20,
                cursor: 'pointer',
                background: 'transparent',
              }}
              onClick={() => navigate('/')}
              aria-label="Back to AlphaLab home"
            >
              <img
                src="/brand/alphalab-logo.png"
                alt="AlphaLab"
                style={{
                  height: '32px',
                  width: 'auto',
                  objectFit: 'contain',
                  background: 'transparent',
                  display: 'block',
                }}
              />
            </div>
            <Title
              level={2}
              style={{
                color: '#fff',
                marginBottom: 4,
                fontWeight: 700,
                fontSize: '1.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              {t.auth.createAccount}
            </Title>
            <Text style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              {t.auth.signUpSubtitle}
            </Text>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  background: 'rgba(24,144,255,0.1)',
                  border: '2px solid #1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  color: '#1890ff',
                  boxShadow: '0 0 20px rgba(24,144,255,0.2)',
                }}
              >
                ✓
              </div>
              <Title
                level={3}
                style={{
                  color: '#fff',
                  marginBottom: 12,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                }}
              >
                {t.auth.accountCreated}
              </Title>
              <Text
                style={{
                  color: '#94a3b8',
                  fontSize: '1rem',
                  display: 'block',
                  marginBottom: 32,
                  lineHeight: 1.5,
                }}
              >
                {t.auth.accountCreatedDesc}
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate('/signin')}
                style={{
                  height: 44,
                  borderRadius: 10,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#fff',
                  background:
                    'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                  border: 'none',
                  paddingInline: 40,
                  boxShadow: '0 8px 20px rgba(24,144,255,0.3)',
                }}
              >
                {t.auth.goToSignIn}
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setError('')}
                  style={{
                    marginBottom: 16,
                    borderRadius: 8,
                  }}
                />
              )}

              <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                onValuesChange={() => {
                  const vals = form.getFieldsValue();
                  const passwordsMatch = vals.password === vals.confirmPassword;
                  setFormValid(
                    !!vals.fullName &&
                    !!vals.email &&
                    !!vals.password &&
                    !!vals.confirmPassword &&
                    passwordsMatch &&
                    !!vals.terms &&
                    !!captchaToken
                  );
                }}
                autoComplete="off"
                style={{ maxWidth: 420 }}
              >
                {/* Full name */}
                <Form.Item
                  name="fullName"
                  label={t.auth.fullName}
                  rules={[
                    { required: true, message: t.auth.enterFullName },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder={t.auth.fullNamePlaceholder}
                    size="large"
                    style={{ height: 44, fontSize: '0.95rem' }}
                  />
                </Form.Item>

                {/* Email */}
                <Form.Item
                  name="email"
                  label={t.auth.emailAddress}
                  rules={[
                    { required: true, message: t.auth.enterValidEmail },
                    { type: 'email', message: t.auth.enterValidEmail },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder={t.auth.emailPlaceholder}
                    size="large"
                    style={{ height: 44, fontSize: '0.95rem' }}
                  />
                </Form.Item>

                {/* Password */}
                <Form.Item
                  name="password"
                  label={t.auth.password}
                  rules={[
                    { required: true, message: t.auth.passwordMinLength },
                    { min: 8, message: t.auth.passwordMinLength },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t.auth.passwordPlaceholder}
                    size="large"
                    autoComplete="new-password"
                    style={{ height: 44, fontSize: '0.95rem' }}
                  />
                </Form.Item>

                {/* Password rule checklist */}
                <div style={{ marginTop: -16, marginBottom: 16, paddingLeft: 4 }}>
                  {[
                    { test: (v: string) => v.length >= 8, label: t.auth.passwordRuleLength },
                    { test: (v: string) => /[A-Z]/.test(v), label: t.auth.passwordRuleUpper },
                    { test: (v: string) => /[a-z]/.test(v), label: t.auth.passwordRuleLower },
                    { test: (v: string) => /[0-9]/.test(v), label: t.auth.passwordRuleNumber },
                  ].map((rule, i) => {
                    const pw = form.getFieldValue('password') || '';
                    const met = pw ? rule.test(pw) : false;
                    return (
                      <div key={i} style={{
                        color: met ? '#10b981' : '#475569',
                        fontSize: 11,
                        marginBottom: 2,
                        transition: 'color 0.15s ease',
                      }}>
                        <span style={{ marginRight: 6, fontSize: 11 }}>
                          {met ? '✓' : '○'}
                        </span>
                        {rule.label}
                      </div>
                    );
                  })}
                </div>

                {/* Confirm password */}
                <Form.Item
                  name="confirmPassword"
                  label={t.auth.confirmPassword}
                  dependencies={['password']}
                  rules={[
                    { required: true, message: t.auth.passwordsDoNotMatch },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value)
                          return Promise.resolve();
                        return Promise.reject(
                          new Error(t.auth.passwordsDoNotMatch)
                        );
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    size="large"
                    autoComplete="new-password"
                    style={{ height: 44, fontSize: '0.95rem' }}
                  />
                </Form.Item>

                {/* Terms checkbox */}
                <Form.Item
                  name="terms"
                  valuePropName="checked"
                  style={{ marginBottom: 12 }}
                  rules={[
                    {
                      validator: (_, value) =>
                        value
                          ? Promise.resolve()
                          : Promise.reject(new Error(t.auth.acceptTerms)),
                    },
                  ]}
                >
                  <Checkbox>
                    {t.auth.termsPrefix}{' '}
                    <Link
                      to="/terms"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: '#1890ff',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                    >
                      {t.auth.termsOfService}
                    </Link>{' '}
                    {t.auth.and}{' '}
                    <Link
                      to="/privacy"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: '#1890ff',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                    >
                      {t.auth.privacyPolicy}
                    </Link>
                  </Checkbox>
                </Form.Item>

                {/* CAPTCHA / Human verification — always renders */}
                <div style={{ marginBottom: 8, minHeight: 70, maxWidth: '100%', overflow: 'hidden' }}>
                  {captchaConfigured ? (
                    turnstileError ? (
                      <div style={{
                        padding: '10px 14px',
                        background: 'rgba(255, 77, 79, 0.12)',
                        border: '1px solid rgba(255, 77, 79, 0.3)',
                        borderRadius: 8,
                        color: '#ff4d4f',
                        fontSize: 12,
                        textAlign: 'center',
                      }}>
                        {t.auth.verifyHuman} — {t.auth.captchaNotConfigured}
                      </div>
                    ) : (
                      <Turnstile
                        sitekey={turnstileSiteKey || ''}
                        onLoad={(_widgetId, bound) => { turnstileRef.current = bound; }}
                        onVerify={(token) => setCaptchaToken(token)}
                        onError={() => { setCaptchaToken(''); setTurnstileError(true); }}
                        onExpire={() => setCaptchaToken('')}
                        theme="dark"
                      />
                    )
                  ) : isDev ? (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 193, 7, 0.12)',
                      border: '1px solid rgba(255, 193, 7, 0.3)',
                      borderRadius: 8,
                      color: '#fbbf24',
                      fontSize: 12,
                      textAlign: 'center',
                    }}>
                      {t.auth.captchaNotConfigured} — {t.auth.captchaBypassDev}
                    </div>
                  ) : (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 77, 79, 0.12)',
                      border: '1px solid rgba(255, 77, 79, 0.3)',
                      borderRadius: 8,
                      color: '#ff4d4f',
                      fontSize: 12,
                      textAlign: 'center',
                    }}>
                      {t.auth.captchaNotConfigured}
                    </div>
                  )}

                  {/* Dev-mode debug info */}
                  {isDev && turnstileDebug && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: '#64748b',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}>
                      {turnstileDebug}
                    </div>
                  )}
                </div>
                {/* CAPTCHA footer — P1-4 */}
                {captchaConfigured && (
                  <div style={{ textAlign: 'center', marginBottom: 20, marginTop: -8 }}>
                    <span style={{ color: '#475569', fontSize: '0.65rem' }}>
                      {t.auth.captchaFooter}
                    </span>
                  </div>
                )}

                {/* Submit button */}
                <Form.Item style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    block
                    size="large"
                    disabled={!formValid || submitting}
                    style={{
                      height: 44,
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      background:
                        'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                      border: 'none',
                      boxShadow: '0 8px 20px rgba(24,144,255,0.3)',
                      opacity: 1,
                    }}
                  >
                    {submitting ? t.auth.creatingAccount : t.auth.createAccountBtn}
                  </Button>
                </Form.Item>

                {!formValid && !submitting && (
                  <div style={{ textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {captchaConfigured && !captchaToken
                        ? t.auth.signUpHelperCaptcha
                        : t.auth.signUpHelperTerms}
                    </span>
                  </div>
                )}
              </Form>

              <div className="trust-strip">
                <div className="trust-item">
                  <SafetyCertificateOutlined />
                  <span>{t.auth.trustSupabase}</span>
                </div>
                <div className="trust-item">
                  <LockOutlined />
                  <span>{t.auth.trustEncryption}</span>
                </div>
                <div className="trust-item">
                  <SafetyOutlined />
                  <span>{t.auth.trustCloudflare}</span>
                </div>
              </div>

              {/* Divider + Social OAuth */}
              <div style={{ marginTop: 16, maxWidth: 420 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <Text style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {t.auth.signUpWith}
                  </Text>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>
                {[
                  {
                    provider: 'google' as Provider,
                    label: t.auth.signUpWithGoogle,
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    ),
                  },
                  {
                    provider: 'github' as Provider,
                    label: t.auth.signUpWithGithub,
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#e2e8f0">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
                      </svg>
                    ),
                  },
                ].map((btn) => {
                  const isLoading = oauthLoading === btn.provider;
                  return (
                    <button
                      key={btn.provider}
                      type="button"
                      onClick={() => handleOAuthLogin(btn.provider)}
                      disabled={!!oauthLoading}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        padding: '10px 0',
                        marginBottom: 8,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        color: '#e2e8f0',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: oauthLoading ? 'not-allowed' : 'pointer',
                        opacity: oauthLoading ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        if (!oauthLoading) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.24)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      }}
                    >
                      {isLoading ? (
                        <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      ) : btn.icon}
                      {isLoading ? (isCN ? '跳转中...' : 'Redirecting...') : btn.label}
                    </button>
                  );
                })}

                {/* Supabase attribution — P1-3 */}
                <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 4 }}>
                  <span style={{ color: '#475569', fontSize: '0.7rem' }}>
                    {t.auth.oauthAttribution}
                  </span>
                </div>
              </div>

              {/* Sign in link */}
              <div style={{ marginTop: 16 }}>
                <Text style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  {t.auth.alreadyHaveAccount}{' '}
                  <Link
                    to="/signin"
                    style={{ color: '#1890ff', fontWeight: 600 }}
                  >
                    {t.auth.signIn}
                  </Link>
                </Text>
              </div>

              {/* Back to home */}
              <div style={{ marginTop: 16 }}>
                <Link
                  to="/"
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.color =
                      '#e2e8f0')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.color =
                      '#94a3b8')
                  }
                >
                  <ArrowLeftOutlined /> {t.auth.backToHome}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Responsive: stack vertically on narrow screens */}
      <style>{`
        @media (max-width: 768px) {
          .signup-card {
            flex-direction: column !important;
            min-height: auto !important;
          }
          .signup-left-panel {
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
            padding: 40px 32px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SignUp;
