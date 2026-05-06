import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    const nextLang = language === 'en-US' ? 'zh-CN' : 'en-US';
    setLanguage(nextLang);
  };

  return (
    <Button 
      onClick={toggleLanguage}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        padding: '0 12px',
        fontSize: '12px',
        fontWeight: 600,
        height: '32px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <GlobalOutlined style={{ marginRight: '6px', fontSize: '14px', color: '#1890ff' }} />
      <span style={{ letterSpacing: '0.5px' }}>
        {language === 'zh-CN' ? 'CN 中文' : 'US ENGLISH'}
      </span>
    </Button>
  );
};

export default LanguageSwitcher;