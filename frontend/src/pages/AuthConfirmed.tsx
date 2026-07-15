import React, { useEffect, useMemo, useState } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/Auth.css';

const { Title, Text } = Typography;

const AuthConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const hasCallback = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return !!(query.get('code') || query.get('token_hash') || hash.get('access_token') || hash.get('type'));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (query.get('error') || hash.get('error') || !hasCallback) { setChecking(false); return undefined; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') && session && hasCallback) {
        setConfirmed(true);
        setChecking(false);
        window.history.replaceState({}, document.title, '/auth/confirmed');
      }
    });
    const timeout = window.setTimeout(() => setChecking(false), 3500);
    return () => { window.clearTimeout(timeout); subscription.unsubscribe(); };
  }, [hasCallback]);

  return (
    <main className="auth-shell">
      <nav className="auth-nav-top" aria-label={t.authConfirmed.backToHome}>
        <Link to="/" className="auth-back-link-top"><ArrowLeftOutlined aria-hidden="true" />{t.authConfirmed.backToHome}</Link>
        <button type="button" className="lang-toggle-btn" onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')} aria-label={language === 'zh-CN' ? 'Switch language to English' : '切换语言为中文'}>{language === 'zh-CN' ? 'EN' : '中文'}</button>
      </nav>
      <div className="auth-card-container">
        <section className="auth-card signup auth-card--compact auth-state-card">
          <Link to="/" className="auth-brand-logo-text">Alpha<span className="accent">Lab</span></Link>
          <span className="auth-card-eyebrow">{language === 'zh-CN' ? '邮箱验证 / 状态' : 'EMAIL VERIFICATION / STATUS'}</span>
          {checking ? (
            <div className="auth-status-panel" role="status" aria-live="polite">
              <span className="spinner is-dark" aria-hidden="true" />
              <Text>{language === 'zh-CN' ? '正在验证确认链接…' : 'Verifying confirmation link…'}</Text>
            </div>
          ) : confirmed ? (
            <div className="auth-status-panel" role="status" aria-live="polite">
              <div className="auth-status-mark is-success" aria-hidden="true">✓</div>
              <Title level={1} className="auth-title">{t.authConfirmed.title}</Title>
              <Text className="auth-subtitle">{t.authConfirmed.description}</Text>
              <Button type="primary" className="auth-btn" block onClick={() => navigate('/signin')}>{t.authConfirmed.continueToSignIn}</Button>
            </div>
          ) : (
            <div className="auth-status-panel" role="alert">
              <div className="auth-status-mark is-error" aria-hidden="true">!</div>
              <Title level={1} className="auth-title">{language === 'zh-CN' ? '确认链接无效' : 'Confirmation link is invalid'}</Title>
              <Text className="auth-subtitle">{language === 'zh-CN' ? '请使用邮件中的最新确认链接，或返回注册页面重新开始。' : 'Use the latest link from your email, or return to sign up and start again.'}</Text>
              <Button type="primary" className="auth-btn" block onClick={() => navigate('/signup')}>{t.auth.createAccount}</Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
export default AuthConfirmed;
