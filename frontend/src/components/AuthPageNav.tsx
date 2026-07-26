import React from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeSwitcher from './ThemeSwitcher';

interface AuthPageNavProps {
  backLabel: string;
  backTo?: string;
}

const AuthPageNav: React.FC<AuthPageNavProps> = ({
  backLabel,
  backTo = '/',
}) => {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';

  return (
    <nav className="auth-nav-top" aria-label={backLabel}>
      <Link to={backTo} className="auth-back-link-top">
        <ArrowLeftOutlined aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="auth-nav-actions">
        <ThemeSwitcher />
        <button
          type="button"
          className="lang-toggle-btn"
          onClick={() => setLanguage(nextLanguage)}
          aria-label={language === 'zh-CN' ? 'Switch language to English' : '切换语言为中文'}
        >
          {language === 'zh-CN' ? 'EN' : '中文'}
        </button>
      </div>
    </nav>
  );
};

export default AuthPageNav;
