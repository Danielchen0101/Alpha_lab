import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined, SafetyCertificateOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORGOT_PASSWORD_STYLE_ID = 'forgot-password-page-dark-styles';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isCN = language === 'zh-CN';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const turnstileRef = React.useRef<BoundTurnstileObject | null>(null);

  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = emailValid && (captchaConfigured ? !!captchaToken : isDev);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!document.getElementById(FORGOT_PASSWORD_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = FORGOT_PASSWORD_STYLE_ID;
      style.innerHTML = `
        .forgot-password-card .ant-input,
        .forgot-password-card .ant-input-affix-wrapper {
          background: rgba(0,0,0,0.35) !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          color: #F8FAFC !important;
          border-radius: 10px !important;
        }
        .forgot-password-card .ant-btn-primary[disabled],
        .forgot-password-card .ant-btn-primary[disabled]:hover {
          color: rgba(255,255,255,0.45) !important;
          background: rgba(255,255,255,0.08) !important;
          opacity: 1 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }
        .trust-strip {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,0.35);
          font-size: 11px;
        }
        .trust-item svg {
          font-size: 12px;
          color: #10b981;
        }

        @media (max-width: 480px) {
          .trust-strip { gap: 8px; margin-top: 16px; padding-top: 12px; }
          .trust-item { gap: 4px; font-size: 10px; }
          .trust-item svg { font-size: 10px; }
        }
        .forgot-password-card .auth-input {
          height: clamp(40px, 4vh, 44px) !important;
          font-size: clamp(0.85rem, 1.1vw, 0.95rem) !important;
        }
        .forgot-password-card .auth-btn {
          height: clamp(40px, 4vh, 44px) !important;
          font-size: clamp(0.9rem, 1.2vw, 1rem) !important;
        }
        @media (max-width: 480px) {
          .forgot-password-card .auth-input { height: 40px !important; font-size: 0.85rem !important; }
          .forgot-password-card .auth-btn { height: 40px !important; }
        }
        .forgot-password-card .cf-turnstile { transform-origin: left center; }
        @media (max-width: 400px) {
          .forgot-password-card .cf-turnstile { transform: scale(0.85); }
          .forgot-password-card .cf-turnstile iframe { width: 300px !important; }
        }
        @media (max-width: 340px) {
          .forgot-password-card .cf-turnstile { transform: scale(0.75); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleSend = async (values: { email: string }) => {
    setError('');
    setSubmitting(true);
    if (!EMAIL_RE.test(values.email)) {
      setError(t.auth.enterValidEmail);
      setSubmitting(false);
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });
      if (resetError) {
        const msg = resetError.message?.toLowerCase() || '';
        if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many')) {
          setError(t.auth.resetRateLimit);
        } else if (msg.includes('captcha') || msg.includes('captcha_token')) {
          setError(t.auth.captchaRequired);
        } else if (msg.includes('email') && (msg.includes('not found') || msg.includes('invalid'))) {
          setError(t.auth.enterValidEmail);
        } else if (msg.includes('network') || msg.includes('fetch')) {
          setError(t.auth.errorNetworkIssue);
        } else {
          setError(resetError.message || t.auth.errorUnexpected);
        }
        setCaptchaToken('');
        turnstileRef.current?.reset();
        setSubmitting(false);
        return;
      }
      setSent(true);
      setCaptchaToken('');
      turnstileRef.current?.reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send reset email';
      setError(msg);
      setCaptchaToken('');
      turnstileRef.current?.reset();
    }
    setSubmitting(false);
  };

  const sendingLabel = isCN ? '发送中...' : 'Sending...';

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
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: '60vw',
          height: '60vw',
          maxWidth: 800,
          maxHeight: 800,
          background: 'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: '50vw',
          height: '50vw',
          maxWidth: 700,
          maxHeight: 700,
          background: 'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div
        className="forgot-password-card"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: 440,
          background: 'rgba(17,25,40,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
          padding: 'clamp(28px, 5vh, 40px) clamp(24px, 5vw, 36px)',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <img
            src="/brand/alphalab-logo.png"
            alt="AlphaLab"
            style={{
              height: 24,
              width: 'auto',
              objectFit: 'contain',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          />
        </div>

        {/* Title */}
        <Title
          level={2}
          style={{
            color: '#fff',
            marginBottom: 8,
            fontWeight: 700,
            fontSize: '1.5rem',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {t.auth.forgotPassword}
        </Title>

        {sent ? (
          <>
            <Alert
              message={t.auth.resetEmailSent}
              type="success"
              showIcon
              style={{
                marginBottom: 24,
                borderRadius: 8,
                background: 'rgba(82, 196, 26, 0.1)',
                border: '1px solid rgba(82, 196, 26, 0.25)',
                color: '#b7eb8f',
              }}
            />
            <Button
              type="primary"
              block
              size="large"
              onClick={() => navigate('/signin')}
              style={{
                height: 44,
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: '0 8px 20px rgba(24,144,255,0.3)',
              }}
            >
              {t.auth.backToSignIn}
            </Button>
          </>
        ) : (
          <>
            {/* Description */}
            <Text
              style={{
                color: '#cbd5e1',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                display: 'block',
                textAlign: 'center',
                marginBottom: 32,
              }}
            >
              {t.auth.forgotPasswordDesc}
            </Text>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                onClose={() => setError('')}
                style={{
                  marginBottom: 20,
                  borderRadius: 8,
                  background: 'rgba(255,77,79,0.08)',
                  border: '1px solid rgba(255,77,79,0.25)',
                  color: '#fca5a5',
                }}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSend}
              onValuesChange={() => {
                const email = form.getFieldValue('email');
                setEmailValid(!!email && EMAIL_RE.test(email));
              }}
              autoComplete="off"
            >
              {/* Email */}
              <Form.Item
                name="email"
                label={<span style={{ color: '#cbd5e1', fontWeight: 500 }}>{t.auth.emailAddress}</span>}
                rules={[
                  { required: true, message: t.auth.enterValidEmail },
                  { type: 'email', message: t.auth.enterValidEmail },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#94A3B8' }} />}
                  placeholder={t.auth.emailPlaceholderSignIn}
                  size="large"
                  className="auth-input"
                />
              </Form.Item>

              {/* CAPTCHA */}
              <div style={{ marginBottom: 8, minHeight: 65, maxWidth: '100%', overflow: 'hidden' }}>
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
              </div>
              {/* CAPTCHA footer — P1-4 */}
              {captchaConfigured && (
                <div style={{ textAlign: 'center', marginBottom: 24, marginTop: -4 }}>
                  <span style={{ color: '#475569', fontSize: '0.65rem' }}>
                    {t.auth.captchaFooter}
                  </span>
                </div>
              )}

              {/* Submit */}
              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={!canSubmit || submitting}
                  block
                  size="large"
                  className="auth-btn"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    fontSize: '1rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                    border: 'none',
                    color: '#fff',
                    boxShadow: '0 8px 20px rgba(24,144,255,0.3)',
                  }}
                >
                  {submitting ? sendingLabel : t.auth.sendResetLink}
                </Button>
              </Form.Item>

              {!canSubmit && !submitting && (
                <div style={{ textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>
                    {!emailValid
                      ? t.auth.forgotHelperEmail
                      : t.auth.forgotHelperCaptcha}
                  </span>
                </div>
              )}
            </Form>
          </>
        )}

        <div className="trust-strip">
          <div className="trust-item">
            <SafetyCertificateOutlined aria-hidden="true" />
            <span>{t.auth.trustSecureAuth}</span>
          </div>
          <div className="trust-item">
            <LockOutlined aria-hidden="true" />
            <span>{t.auth.trustEncryptedConfigs}</span>
          </div>
          <div className="trust-item">
            <SafetyOutlined aria-hidden="true" />
            <span>{t.auth.trustCloudflare}</span>
          </div>
        </div>

        {/* Privacy copy */}
        <div style={{ textAlign: 'center', marginTop: 16, padding: '0 16px' }}>
          <span style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
            {t.auth.forgotPrivacyCopy}
          </span>
        </div>

        {/* Navigation links */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            to="/signin"
            style={{
              color: '#60a5fa',
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#93c5fd'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
          >
            <ArrowLeftOutlined /> {t.auth.backToSignIn}
          </Link>
          <span style={{ color: '#64748b', margin: '0 12px' }}>·</span>
          <Link
            to="/"
            style={{
              color: '#60a5fa',
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#93c5fd'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
          >
            {t.legal.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
