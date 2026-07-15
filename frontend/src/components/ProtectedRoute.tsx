import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const isChinese = language === 'zh-CN';

  if (loading) {
    return (
      <main className="protected-route-loading" aria-busy="true" aria-live="polite">
        <section className="protected-route-loading__panel" role="status">
          <span className="protected-route-loading__brand">AlphaLab</span>
          <span className="protected-route-loading__index">01 / {isChinese ? '安全会话' : 'SECURE SESSION'}</span>
          <Spin size="large" />
          <h1>{isChinese ? '正在恢复工作区' : 'Restoring your workspace'}</h1>
          <p>{isChinese ? '正在核对登录状态与页面权限。' : 'Checking your session and page access.'}</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
