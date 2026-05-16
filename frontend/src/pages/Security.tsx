import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import {
  SafetyOutlined, MailOutlined, SecurityScanOutlined,
  KeyOutlined, DashboardOutlined, CheckCircleOutlined,
  HomeOutlined, ArrowRightOutlined, LoginOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import MarketingLayout from '../components/MarketingLayout';

const { Title, Text } = Typography;

const securityFeatures = [
  { icon: <SafetyOutlined />, titleKey: 'featureAuth' as const, descKey: 'featureAuthDesc' as const },
  { icon: <MailOutlined />, titleKey: 'featureEmail' as const, descKey: 'featureEmailDesc' as const },
  { icon: <SecurityScanOutlined />, titleKey: 'featureTurnstile' as const, descKey: 'featureTurnstileDesc' as const },
  { icon: <KeyOutlined />, titleKey: 'featureEncryption' as const, descKey: 'featureEncryptionDesc' as const },
  { icon: <DashboardOutlined />, titleKey: 'featureRateLimit' as const, descKey: 'featureRateLimitDesc' as const },
  { icon: <CheckCircleOutlined />, titleKey: 'featureHeaders' as const, descKey: 'featureHeadersDesc' as const },
];

const Security: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <MarketingLayout>
      <style>{`
        .security-feature-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 32px;
          height: 100%;
          transition: all 0.3s ease;
        }
        .security-feature-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(24,144,255,0.3);
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .feature-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.05));
          border: 1px solid rgba(24,144,255,0.2);
          color: #60a5fa;
        }
        .security-shield {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05));
          border: 2px solid rgba(16,185,129,0.3);
          font-size: 36px;
          color: #34d399;
        }
      `}</style>

      {/* Hero */}
      <section className="page-hero">
        <div className="security-shield">
          <SafetyOutlined />
        </div>
        <h1 className="page-title">{t.security.title}</h1>
        <p className="page-subtitle">{t.security.subtitle}</p>
      </section>

      {/* Features Grid */}
      <section className="section-container" style={{ paddingTop: 20 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {securityFeatures.map((feat, idx) => (
            <div key={idx} className="security-feature-card reveal-on-scroll visible">
              <div className="feature-icon">{feat.icon}</div>
              <Title level={4} style={{ color: '#fff', marginBottom: 10, fontSize: '1.1rem' }}>
                {t.security[feat.titleKey]}
              </Title>
              <Text style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7 }}>
                {t.security[feat.descKey]}
              </Text>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-container" style={{ textAlign: 'center', paddingBottom: 100 }}>
        <div style={{
          background: 'linear-gradient(145deg, rgba(16,185,129,0.05) 0%, rgba(24,144,255,0.05) 100%)',
          padding: '60px 40px', borderRadius: 32,
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            {t.security.ctaTitle}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: 600, margin: '0 auto 36px', lineHeight: 1.6 }}>
            {t.security.ctaDesc}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              type="primary" size="large"
              icon={<HomeOutlined />}
              onClick={() => navigate('/')}
              style={{
                height: 48, borderRadius: 12, fontWeight: 600, padding: '0 32px',
                background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                border: 'none', boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
              }}
            >
              {t.landing.navHome}
            </Button>
            <Button
              ghost size="large"
              icon={<LoginOutlined />}
              onClick={() => navigate('/signup')}
              style={{
                height: 48, borderRadius: 12, fontWeight: 600, padding: '0 32px',
                color: '#60a5fa', borderColor: 'rgba(24,144,255,0.5)',
              }}
            >
              {t.landing.getStarted} <ArrowRightOutlined />
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Security;
