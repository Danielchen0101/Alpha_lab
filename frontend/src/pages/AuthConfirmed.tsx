import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

const AuthConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
          background:
            'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
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
          background:
            'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Content card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 480,
          background: 'rgba(17,25,40,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          backdropFilter: 'blur(24px)',
          boxShadow:
            '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
          padding: '56px 48px',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <img
            src="/brand/alphalab-logo.png"
            alt="AlphaLab"
            style={{
              height: 48,
              width: 'auto',
              objectFit: 'contain',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          />
        </div>

        {/* Success icon */}
        <div style={{ marginBottom: 24 }}>
          <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a' }} />
        </div>

        {/* Title */}
        <h1
          style={{
            color: '#fff',
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: 12,
            letterSpacing: '-0.02em',
          }}
        >
          {t.authConfirmed.title}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: '#94a3b8',
            fontSize: '1.05rem',
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          {t.authConfirmed.subtitle}
        </p>

        {/* Description */}
        <p
          style={{
            color: '#64748b',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          {t.authConfirmed.description}
        </p>

        {/* Continue to Sign In */}
        <Button
          type="primary"
          size="large"
          block
          onClick={() => navigate('/signin')}
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: '1.05rem',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
            border: 'none',
            boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
            marginBottom: 24,
          }}
        >
          {t.authConfirmed.continueToSignIn}
        </Button>

        {/* Back to Home */}
        <div>
          <Link
            to="/"
            style={{
              color: '#94a3b8',
              fontSize: '0.95rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8')
            }
          >
            <ArrowLeftOutlined /> {t.authConfirmed.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthConfirmed;
