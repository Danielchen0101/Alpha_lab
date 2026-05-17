import React, { useEffect } from 'react';
import { Row, Col, Space, Button } from 'antd';
import { 
  ThunderboltOutlined, CheckCircleOutlined, SafetyOutlined, 
  ArrowRightOutlined, TeamOutlined, AimOutlined, 
  InteractionOutlined, NodeIndexOutlined, RocketOutlined,
  GlobalOutlined, ExperimentOutlined, AppstoreOutlined, RobotOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import RevealSection from '../components/RevealSection';
import { useLanguage } from '../contexts/LanguageContext';

const Platform: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <MarketingLayout>
      <style>{`
        .who-it-is-for-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: clamp(24px, 3vw, 32px);
          transition: all 0.3s ease;
          height: 100%;
        }
        .who-it-is-for-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(24, 144, 255, 0.3);
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .platform-feature-card {
          background: rgba(17, 25, 40, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: clamp(32px, 4vw, 40px);
          height: 100%;
          backdrop-filter: blur(12px);
          transition: all 0.4s ease;
        }
        .platform-feature-card:hover {
          border-color: rgba(24, 144, 255, 0.3);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .step-num {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1890ff;
          margin-bottom: 12px;
          display: block;
          letter-spacing: 1px;
        }
      `}</style>

      <div className="page-hero">
        <RevealSection>
          <h1 className="page-title">{t.platform.heroTitle}</h1>
        </RevealSection>
        <RevealSection delay={0.1}>
          <p className="page-subtitle">
            {t.platform.heroSubtitle}
          </p>
        </RevealSection>
      </div>

      <section className="section-container" style={{ paddingTop: 0 }}>
        {/* End-to-End Workflow Summary */}
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 8vw, 80px)' }}>
            <h2 className="section-title">{t.platform.intelTitle}</h2>
            <p className="section-subtitle">
              {t.platform.intelSubtitle}
            </p>
          </div>
        </RevealSection>

        <Row gutter={[32, 32]}>
          <Col xs={24} md={12} lg={8}>
            <RevealSection delay={0.1} style={{ height: '100%' }}>
              <div className="platform-feature-card">
                <span className="step-num">{t.platform.phase1}</span>
                <GlobalOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
                <h3 style={{ color: '#fff', fontSize: 'clamp(1.3rem, 2vw, 1.5rem)', fontWeight: 700, marginBottom: 16 }}>{t.platform.scanTitle}</h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                  {t.platform.scanDesc}
                </p>
              </div>
            </RevealSection>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <RevealSection delay={0.2} style={{ height: '100%' }}>
              <div className="platform-feature-card">
                <span className="step-num">{t.platform.phase2}</span>
                <RobotOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
                <h3 style={{ color: '#fff', fontSize: 'clamp(1.3rem, 2vw, 1.5rem)', fontWeight: 700, marginBottom: 16 }}>{t.platform.aiTitle}</h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                  {t.platform.aiDesc}
                </p>
              </div>
            </RevealSection>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <RevealSection delay={0.3} style={{ height: '100%' }}>
              <div className="platform-feature-card">
                <span className="step-num">{t.platform.phase3}</span>
                <AimOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
                <h3 style={{ color: '#fff', fontSize: 'clamp(1.3rem, 2vw, 1.5rem)', fontWeight: 700, marginBottom: 16 }}>{t.platform.planTitle}</h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                  {t.platform.planDesc}
                </p>
              </div>
            </RevealSection>
          </Col>
        </Row>

        {/* Core Value Prop: Risk Aware */}
        <RevealSection>
          <div style={{ marginTop: 'clamp(60px, 10vw, 120px)', background: 'linear-gradient(145deg, rgba(17,25,40,0.6) 0%, rgba(11,21,41,0.4) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 'clamp(32px, 5vw, 48px)', backdropFilter: 'blur(16px)' }}>
            <Row gutter={[48, 48]} align="middle">
              <Col xs={24} lg={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <ThunderboltOutlined aria-hidden="true" style={{ color: '#1890ff', fontSize: 24 }} />
                  <span style={{ color: '#1890ff', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.9rem' }}>{t.platform.riskAware}</span>
                </div>
                <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 800, color: '#fff', marginBottom: 24, lineHeight: 1.2 }}>
                  {t.platform.beyondBlind}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', lineHeight: 1.7, marginBottom: 24 }}>
                  {t.platform.beyondBlindDesc}
                </p>
                <Space size="large" direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                    <CheckCircleOutlined aria-hidden="true" style={{ color: '#49aa19' }}/> {t.platform.check1}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                    <CheckCircleOutlined aria-hidden="true" style={{ color: '#49aa19' }}/> {t.platform.check2}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                    <CheckCircleOutlined aria-hidden="true" style={{ color: '#49aa19' }}/> {t.platform.check3}
                  </div>
                </Space>
              </Col>
              <Col xs={24} lg={12}>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 'clamp(24px, 4vw, 32px)', position: 'relative' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SafetyOutlined aria-hidden="true" style={{ color: '#1890ff' }} /> {t.platform.hubTitle}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: 'rgba(24,144,255,0.1)', borderLeft: '4px solid #1890ff', borderRadius: 4, color: '#e2e8f0' }}>
                      <ExperimentOutlined aria-hidden="true" style={{ marginRight: 8 }} /> {t.platform.hubPaper}
                    </div>
                    <div style={{ padding: 12, background: 'rgba(73,170,25,0.1)', borderLeft: '4px solid #49aa19', borderRadius: 4, color: '#e2e8f0' }}>
                      <RocketOutlined aria-hidden="true" style={{ marginRight: 8 }} /> {t.platform.hubLive}
                    </div>
                    <div style={{ padding: 12, background: 'rgba(114,46,209,0.1)', borderLeft: '4px solid #722ed1', borderRadius: 4, color: '#e2e8f0' }}>
                      <NodeIndexOutlined aria-hidden="true" style={{ marginRight: 8 }} /> {t.platform.hubAI}
                    </div>
                    <div style={{ marginTop: 12, fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                      {t.platform.hubNote}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </RevealSection>

        {/* Who it is for */}
        <div style={{ marginTop: 'clamp(60px, 10vw, 120px)' }}>
          <RevealSection>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <h2 className="section-title">{t.platform.whoTitle}</h2>
              <p className="section-subtitle">{t.platform.whoSubtitle}</p>
            </div>
          </RevealSection>
          
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <RevealSection delay={0.1} style={{ height: '100%' }}>
                <div className="who-it-is-for-card">
                  <TeamOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                  <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>{t.platform.traderTitle}</h3>
                  <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{t.platform.traderDesc}</p>
                </div>
              </RevealSection>
            </Col>
            <Col xs={24} md={8}>
              <RevealSection delay={0.2} style={{ height: '100%' }}>
                <div className="who-it-is-for-card">
                  <InteractionOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                  <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>{t.platform.quantTitle}</h3>
                  <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{t.platform.quantDesc}</p>
                </div>
              </RevealSection>
            </Col>
            <Col xs={24} md={8}>
              <RevealSection delay={0.3} style={{ height: '100%' }}>
                <div className="who-it-is-for-card">
                  <AppstoreOutlined aria-hidden="true" style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                  <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>{t.platform.scalerTitle}</h3>
                  <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{t.platform.scalerDesc}</p>
                </div>
              </RevealSection>
            </Col>
          </Row>
        </div>

        <RevealSection>
          <div style={{ textAlign: 'center', marginTop: 'clamp(60px, 10vw, 120px)' }}>
            <div style={{ background: 'rgba(24,144,255,0.05)', padding: 'clamp(40px, 8vw, 60px)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: 800, margin: '0 auto' }}>
              <h3 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>{t.platform.readyTitle}</h3>
              <p style={{ color: '#94a3b8', fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', marginBottom: 40 }}>{t.platform.readyDesc}</p>
              <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 60px', fontSize: '1.2rem' }}>
                {t.platform.getStarted} <ArrowRightOutlined aria-hidden="true" />
              </Button>
            </div>
          </div>
        </RevealSection>
      </section>
    </MarketingLayout>
  );
};

export default Platform;
