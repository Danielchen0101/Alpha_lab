import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isCN = language === 'zh-CN';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = React.useRef<BoundTurnstileObject | null>(null);

  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = captchaConfigured ? !!captchaToken : isDev;

  const handleSend = async (values: { email: string }) => {
    setError('');
    setSubmitting(true);
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
        } else {
          setError(resetError.message);
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
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 460,
          background: 'rgba(17,25,40,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
          padding: '48px 40px',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <img
            src="/brand/alphalab-logo.png"
            alt="AlphaLab"
            style={{
              height: 40,
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
            marginBottom: 12,
            fontWeight: 700,
            fontSize: '1.6rem',
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
                height: 48,
                borderRadius: 12,
                fontSize: '1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
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
                  style={{
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#F8FAFC',
                  }}
                />
              </Form.Item>

              {/* CAPTCHA */}
              <div style={{ marginBottom: 24, minHeight: 65, maxWidth: '100%', overflow: 'hidden' }}>
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

              {/* Submit */}
              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={!canSubmit || submitting}
                  block
                  size="large"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    fontSize: '1rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                    border: 'none',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
                  }}
                >
                  {submitting ? sendingLabel : t.auth.sendResetLink}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}

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
