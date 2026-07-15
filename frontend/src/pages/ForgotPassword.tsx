import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
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

const ForgotPassword: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);
  const compactCaptcha = useCompactCaptcha();
  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const captchaConfigured = !!turnstileSiteKey;
  const canSubmit = emailValid && (captchaConfigured ? !!captchaToken : isDev);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    setCaptchaToken('');
    turnstileRef.current = null;
  }, [language, resolvedTheme]);

  const handleSend = async ({ email }: { email: string }) => {
    if (!EMAIL_RE.test(email)) { setError(t.auth.enterValidEmail); return; }
    setError('');
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });
      if (resetError) {
        const message = resetError.message.toLowerCase();
        if (message.includes('rate') || message.includes('too many')) setError(t.auth.resetRateLimit);
        else if (message.includes('captcha')) setError(t.auth.captchaRequired);
        else if (message.includes('network') || message.includes('fetch')) setError(t.auth.errorNetworkIssue);
        else setError(t.auth.resetFailed || t.auth.errorUnexpected);
      } else {
        setSent(true);
      }
    } catch {
      setError(t.auth.errorNetworkIssue);
    } finally {
      setCaptchaToken('');
      turnstileRef.current?.reset();
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <nav className="auth-nav-top" aria-label={t.auth.backToHome}>
        <Link to="/" className="auth-back-link-top"><ArrowLeftOutlined aria-hidden="true" />{t.auth.backToHome}</Link>
        <button type="button" className="lang-toggle-btn" onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')} aria-label={language === 'zh-CN' ? 'Switch language to English' : '切换语言为中文'}>{language === 'zh-CN' ? 'EN' : '中文'}</button>
      </nav>
      <div className="auth-card-container">
        <section className="auth-card signup auth-card--compact">
          <header className="auth-card-header">
            <Link to="/" className="auth-brand-logo-text">Alpha<span className="accent">Lab</span></Link>
            <span className="auth-card-eyebrow">{language === 'zh-CN' ? '账户恢复 / 01' : 'ACCOUNT RECOVERY / 01'}</span>
            <Title level={1} className="auth-title">{sent ? t.auth.resetEmailSentTitle : t.auth.forgotPassword}</Title>
            <Text className="auth-subtitle">{sent ? t.auth.resetEmailSentDesc : t.auth.forgotPasswordDesc}</Text>
          </header>
          <div className="auth-form-content">
            {sent ? (
              <div className="auth-status-panel" role="status" aria-live="polite">
                <div className="auth-status-mark is-success" aria-hidden="true">✓</div>
                <Link to="/signin" className="auth-link-forgot">{t.auth.backToSignIn}</Link>
              </div>
            ) : (
              <>
                {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 18 }} />}
                <Form form={form} layout="vertical" onFinish={handleSend} autoComplete="on" aria-busy={submitting} onValuesChange={(_, values) => setEmailValid(EMAIL_RE.test(values.email || ''))}>
                  <Form.Item name="email" label={t.auth.emailAddress} rules={[{ required: true, type: 'email', message: t.auth.enterValidEmail }]}>
                    <Input className="auth-input" type="email" autoComplete="email" prefix={<MailOutlined aria-hidden="true" />} placeholder={t.auth.emailPlaceholder} />
                  </Form.Item>
                  <div className="auth-captcha-wrapper">
                    {captchaConfigured ? <Turnstile key={`${resolvedTheme}-${language}`} sitekey={turnstileSiteKey || ''} className="auth-turnstile" size={compactCaptcha ? 'compact' : 'flexible'} fixedSize onLoad={(_id, bound) => { turnstileRef.current = bound; }} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => setCaptchaToken('')} theme={resolvedTheme} language={language === 'zh-CN' ? 'zh-CN' : 'en'} /> : isDev ? <div className="auth-captcha-placeholder">{t.auth.captchaBypassDev}</div> : <div className="auth-captcha-placeholder error">{t.auth.captchaNotConfigured}</div>}
                  </div>
                  <Button htmlType="submit" type="primary" block className="auth-btn" loading={submitting} disabled={!canSubmit || submitting}>{submitting ? t.auth.sending : t.auth.sendResetLink}</Button>
                </Form>
                <div className="auth-bottom-switch"><Text className="text"><Link to="/signin" className="link">{t.auth.backToSignIn}</Link></Text></div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default ForgotPassword;
