import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/Auth.css';

const { Title, Text } = Typography;

const ResetPassword: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [form] = Form.useForm();
  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState('');
  const [formValid, setFormValid] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasRecoveryHint = query.get('type') === 'recovery'
      || hash.get('type') === 'recovery'
      || query.has('code')
      || hash.has('access_token');
    if (
      query.get('error')
      || hash.get('error')
      || query.get('error_code')
      || hash.get('error_code')
      || query.get('error_description')
      || hash.get('error_description')
    ) {
      setChecking(false);
      return undefined;
    }

    let active = true;
    let observedRecoverySession = false;

    const markRecoveryReady = () => {
      if (!active) return;
      observedRecoverySession = true;
      setError('');
      setRecoveryReady(true);
      setChecking(false);
      window.history.replaceState({}, document.title, '/reset-password');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && hasRecoveryHint))) {
        markRecoveryReady();
      }
    });

    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        // A normal signed-in session must never be enough to turn this public
        // route into a password-change form. Require evidence that the page was
        // opened from a Supabase recovery link.
        if (session && hasRecoveryHint) markRecoveryReady();
      })
      .catch(() => {
        // The timeout below presents the same invalid-link state if session recovery fails.
      });

    const timeout = window.setTimeout(() => {
      if (active && !observedRecoverySession) {
        setRecoveryReady(false);
        setChecking(false);
      }
    }, 3500);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async ({ password, confirmPassword }: { password: string; confirmPassword: string }) => {
    if (password !== confirmPassword || password.length < 8) { setError(password.length < 8 ? t.auth.passwordMinLength : t.auth.passwordsDoNotMatchError); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(t.auth.passwordUpdateFailed || t.auth.errorUnexpected); return; }
      await supabase.auth.signOut({ scope: 'local' });
      setUpdated(true);
      setRecoveryReady(false);
      window.history.replaceState({}, document.title, '/reset-password');
    } catch {
      setError(t.auth.passwordUpdateFailed || t.auth.errorUnexpected);
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = !checking && !recoveryReady && !updated;
  return (
    <main className="auth-shell">
      <nav className="auth-nav-top" aria-label={t.auth.backToHome}><Link to="/" className="auth-back-link-top"><ArrowLeftOutlined aria-hidden="true" />{t.auth.backToHome}</Link><button type="button" className="lang-toggle-btn" onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')} aria-label={language === 'zh-CN' ? 'Switch language to English' : '切换语言为中文'}>{language === 'zh-CN' ? 'EN' : '中文'}</button></nav>
      <div className="auth-card-container"><section className="auth-card signup auth-card--compact"><header className="auth-card-header"><Link to="/" className="auth-brand-logo-text">Alpha<span className="accent">Lab</span></Link><span className="auth-card-eyebrow">{language === 'zh-CN' ? '账户恢复 / 02' : 'ACCOUNT RECOVERY / 02'}</span><Title level={1} className="auth-title">{updated ? t.auth.passwordUpdatedTitle : t.auth.resetPasswordTitle}</Title><Text className="auth-subtitle">{updated ? t.auth.passwordUpdatedDesc : t.auth.resetPasswordDesc}</Text></header><div className="auth-form-content">
        {checking ? <div className="auth-status-panel" role="status" aria-live="polite"><span className="spinner is-dark" /><Text>{language === 'zh-CN' ? '正在验证恢复链接…' : 'Verifying recovery link…'}</Text></div> : updated ? <div className="auth-status-panel" role="status" aria-live="polite"><div className="auth-status-mark is-success" aria-hidden="true">✓</div><Link to="/signin" className="auth-link-forgot">{t.auth.backToSignIn}</Link></div> : invalid ? <div className="auth-status-panel" role="alert"><div className="auth-status-mark is-error" aria-hidden="true">!</div><Alert message={error || t.auth.resetLinkInvalid} description={t.auth.errorResetLinkExpired} type="error" showIcon /><Link to="/forgot-password" className="auth-link-forgot">{t.auth.requestNewResetLink}</Link></div> : <>
          {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 18 }} />}
          <Form form={form} layout="vertical" onFinish={handleUpdate} autoComplete="on" aria-busy={submitting} onValuesChange={(_, values) => setFormValid(!!values.password && values.password.length >= 8 && values.password === values.confirmPassword)}>
            <Form.Item name="password" label={t.auth.newPassword} rules={[{ required: true, min: 8, message: t.auth.passwordMinLength }]}><Input.Password className="auth-input" autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} /></Form.Item>
            <Form.Item name="confirmPassword" label={t.auth.confirmPassword} dependencies={['password']} rules={[{ required: true, message: t.auth.passwordsDoNotMatch }, ({ getFieldValue }) => ({ validator(_, value) { return !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error(t.auth.passwordsDoNotMatch)); } })]}><Input.Password className="auth-input" autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} /></Form.Item>
            <Button htmlType="submit" type="primary" block className="auth-btn" loading={submitting} disabled={!formValid || submitting}>{t.auth.updatePassword}</Button>
          </Form>
        </>}
      </div></section></div>
    </main>
  );
};
export default ResetPassword;
