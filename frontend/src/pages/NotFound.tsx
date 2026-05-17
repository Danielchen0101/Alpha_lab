import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { HomeOutlined, LoginOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020611',
        color: '#e2e8f0',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '15%', width: '60vw', height: '60vw',
        maxWidth: 800, maxHeight: 800,
        background: 'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%', width: '50vw', height: '50vw',
        maxWidth: 700, maxHeight: 700,
        background: 'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        background: 'rgba(17,25,40,0.65)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
        padding: '56px 40px', textAlign: 'center',
      }}>
        {/* Brand Logo */}
        <div style={{ marginBottom: 40 }}>
          <img 
            src="/brand/alphalab-logo.png" 
            alt="AlphaLab" 
            style={{ height: 40, cursor: 'pointer' }} 
            onClick={() => navigate('/')}
          />
        </div>

        <Title level={1} style={{ 
          color: '#60a5fa', 
          marginBottom: 8, 
          fontSize: '5rem', 
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.05em'
        }}>
          {t.notFound.title}
        </Title>
        <Title level={3} style={{ color: '#fff', marginBottom: 12, fontWeight: 600 }}>
          {t.notFound.subtitle}
        </Title>
        <Text style={{ color: '#94a3b8', fontSize: '0.95rem', display: 'block', marginBottom: 40, lineHeight: 1.6 }}>
          {t.notFound.description}
        </Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button
            type="primary" size="large"
            icon={<HomeOutlined aria-hidden="true" />}
            onClick={() => navigate('/')}
            style={{
              height: 48, borderRadius: 12, fontSize: '1rem', fontWeight: 600,
              background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
              border: 'none', boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
            }}
          >
            {t.notFound.backToHome}
          </Button>
          <Button
            ghost size="large"
            icon={<LoginOutlined aria-hidden="true" />}
            onClick={() => navigate('/signin')}
            style={{ 
              height: 48, 
              borderRadius: 12, 
              color: '#60a5fa', 
              borderColor: 'rgba(24,144,255,0.5)' 
            }}
          >
            {t.notFound.signIn}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
