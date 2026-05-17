import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import {
  SafetyOutlined, SecurityScanOutlined,
  KeyOutlined, DashboardOutlined, CheckCircleOutlined,
  ArrowRightOutlined,
  HomeOutlined, LoginOutlined
} from '@ant-design/icons';
import MarketingLayout from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const securityFeatures = [
  { icon: <KeyOutlined />, titleKey: 'featureAuth', descKey: 'featureAuthDesc' },
  { icon: <SafetyOutlined />, titleKey: 'featureEncryption', descKey: 'featureEncryptionDesc' },
  { icon: <SecurityScanOutlined />, titleKey: 'featureCsp', descKey: 'featureCspDesc' },
  { icon: <SafetyOutlined />, titleKey: 'featureHeaders', descKey: 'featureHeadersDesc' },
  { icon: <DashboardOutlined />, titleKey: 'featureRateLimit', descKey: 'featureRateLimitDesc' },
  { icon: <CheckCircleOutlined />, titleKey: 'featureAudit', descKey: 'featureAuditDesc' },
];

const Security: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <MarketingLayout>
      <style>{`
        .page-hero {
          padding: 80px 24px 60px;
          text-align: center;
          background: radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.05) 0%, transparent 70%);
        }
        .page-title {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 800;
          color: #fff;
          margin-bottom: 20px;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          font-size: clamp(1.1rem, 1.5vw, 1.25rem);
          color: #94a3b8;
          max-width: 700px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .security-feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 32px;
          transition: all 0.3s ease;
          height: 100%;
        }
        .security-feature-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(52, 211, 153, 0.3);
          transform: translateY(-4px);
        }
        .feature-icon {
          font-size: 32px;
          color: #34d399;
          margin-bottom: 24px;
          display: inline-flex;
          padding: 12px;
          background: rgba(52, 211, 153, 0.1);
          border-radius: 12px;
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
          <SafetyOutlined aria-hidden="true" />
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
              <div className="feature-icon">{React.cloneElement(feat.icon as React.ReactElement, { "aria-hidden": "true", "focusable": "false" })}</div>
              <Title level={4} style={{ color: '#fff', marginBottom: 10, fontSize: '1.1rem' }}>
                {t.security[feat.titleKey as keyof typeof t.security]}
              </Title>
              <Text style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7 }}>
                {t.security[feat.descKey as keyof typeof t.security]}
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
              icon={<HomeOutlined aria-hidden="true" />}
              onClick={() => navigate('/')}
              style={{
                height: 48, borderRadius: 12, fontWeight: 600, padding: '0 32px',
                background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                border: 'none', boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
              }}
              aria-label="Back to AlphaLab Home"
            >
              {t.landing.navHome}
            </Button>
            <Button
              ghost size="large"
              icon={<LoginOutlined aria-hidden="true" />}
              onClick={() => navigate('/signup')}
              style={{
                height: 48, borderRadius: 12, fontWeight: 600, padding: '0 32px',
                color: '#60a5fa', borderColor: 'rgba(24,144,255,0.5)',
              }}
              aria-label="Get started with AlphaLab"
            >
              {t.landing.getStarted} <ArrowRightOutlined aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Security;