import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Spin } from 'antd';
import { KeyOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import '../styles/Auth.css';

const safeNext = (value: string | null) => value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

const MfaChallenge: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, mfaStatus, refreshMfaAssurance, logout } = useAuth();
  const { language } = useLanguage();
  const zh = language === 'zh-CN';
  const [factorId, setFactorId] = useState('');
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const next = useMemo(() => safeNext(new URLSearchParams(location.search).get('next')), [location.search]);
  const copy = zh ? {
    eyebrow: '02 / 双重验证', title: '验证你的安全代码', body: '打开身份验证器并输入当前的 6 位验证码。验证成功后才会进入交易工作区。', code: '验证码', placeholder: '000000', submit: '验证并继续', checking: '正在检查安全设置…', missing: '当前账户没有可用的验证器。请重新登录或联系管理员。', failed: '验证码不正确或已过期，请使用新的验证码重试。', signOut: '退出并返回登录',
  } : {
    eyebrow: '02 / TWO-FACTOR VERIFICATION', title: 'Verify your security code', body: 'Open your authenticator app and enter the current 6-digit code. The trading workspace remains locked until verification succeeds.', code: 'Authenticator code', placeholder: '000000', submit: 'Verify and continue', checking: 'Checking security settings…', missing: 'No verified authenticator is available for this account. Sign in again or contact an administrator.', failed: 'The code is incorrect or expired. Use a new authenticator code and try again.', signOut: 'Sign out and return to login',
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (!mounted) return;
      if (listError) {
        setError(copy.missing);
      } else {
        const factor = data?.totp?.find((item: any) => item.status === 'verified');
        setFactorId(factor?.id || '');
        if (!factor) setError(copy.missing);
      }
      setChecking(false);
    };
    if (isAuthenticated) load();
    return () => { mounted = false; };
  }, [copy.missing, isAuthenticated]);

  if (loading) return <main className="auth-shell"><div className="auth-card-container"><Spin size="large" /></div></main>;
  if (!isAuthenticated) return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
  if ((mfaStatus === 'not_required' || mfaStatus === 'verified') && !checking) return <Navigate to={next} replace />;

  const verify = async ({ code }: { code: string }) => {
    if (!factorId) return;
    setSubmitting(true);
    setError('');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (verifyError) {
      setError(copy.failed);
      setSubmitting(false);
      return;
    }
    const stillRequired = await refreshMfaAssurance();
    if (stillRequired) {
      setError(copy.failed);
      setSubmitting(false);
      return;
    }
    navigate(next, { replace: true });
  };

  return (
    <main className="auth-shell">
      <div className="auth-card-container">
        <section className="auth-card auth-card--compact mfa-challenge-card" aria-labelledby="mfa-title">
          <span className="auth-card-eyebrow"><SafetyCertificateOutlined /> {copy.eyebrow}</span>
          <h1 id="mfa-title" className="auth-title">{copy.title}</h1>
          <p className="auth-subtitle">{copy.body}</p>
          {error && <Alert type="error" showIcon message={error} />}
          {checking ? <div className="mfa-challenge-loading"><Spin /><span>{copy.checking}</span></div> : (
            <Form layout="vertical" onFinish={verify} requiredMark={false}>
              <Form.Item label={copy.code} name="code" rules={[{ required: true }, { pattern: /^\d{6}$/, message: copy.failed }]}>
                <Input prefix={<KeyOutlined />} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={copy.placeholder} autoFocus />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large" icon={<LockOutlined />} loading={submitting} disabled={!factorId}>{copy.submit}</Button>
            </Form>
          )}
          <Button type="link" block onClick={logout}>{copy.signOut}</Button>
        </section>
      </div>
    </main>
  );
};

export default MfaChallenge;
