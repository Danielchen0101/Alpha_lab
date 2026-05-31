import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    const nextLang = language === 'en-US' ? 'zh-CN' : 'en-US';
    setLanguage(nextLang);
  };

  return (
    <Button
      onClick={toggleLanguage}
      aria-label={t.common.switchLanguage}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--app-card-bg)',
        color: 'var(--app-text)',
        border: '1px solid var(--app-border)',
        borderRadius: '6px',
        padding: '0 12px',
        fontSize: '12px',
        fontWeight: 600,
        height: '32px',
        boxShadow: 'var(--app-card-shadow)',
      }}
    >
      <GlobalOutlined style={{ marginRight: '6px', fontSize: '14px', color: '#1890ff' }} />
      <span>
        {language === 'zh-CN' ? '中文' : 'English'}
      </span>
    </Button>
  );
};

export default LanguageSwitcher;
