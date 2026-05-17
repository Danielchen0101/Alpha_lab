import React, { useEffect } from 'react';
import { Row, Col, Button } from 'antd';
import { 
  NodeIndexOutlined, 
  BarChartOutlined, SafetyOutlined, ArrowRightOutlined,
  DesktopOutlined, DatabaseOutlined, SecurityScanOutlined,
  ApiOutlined, PartitionOutlined,
  LockOutlined, CloudServerOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import MarketingLayout from '../components/MarketingLayout';

const Technology: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const techStack = [
    {
      icon: <DesktopOutlined />,
      titleKey: 'stackFrontendTitle',
      descKey: 'stackFrontendDesc',
      catKey: 'catClient'
    },
    {
      icon: <CloudServerOutlined />,
      titleKey: 'stackBackendTitle',
      descKey: 'stackBackendDesc',
      catKey: 'catServer'
    },
    {
      icon: <DatabaseOutlined />,
      titleKey: 'stackDataTitle',
      descKey: 'stackDataDesc',
      catKey: 'catData'
    },
    {
      icon: <ApiOutlined />,
      titleKey: 'stackAlpacaTitle',
      descKey: 'stackAlpacaDesc',
      catKey: 'catExecution'
    },
    {
      icon: <NodeIndexOutlined />,
      titleKey: 'stackLLMTitle',
      descKey: 'stackLLMDesc',
      catKey: 'catIntelligence'
    },
    {
      icon: <BarChartOutlined />,
      titleKey: 'stackQuantTitle',
      descKey: 'stackQuantDesc',
      catKey: 'catQuant'
    },
    {
      icon: <PartitionOutlined />,
      titleKey: 'stackValidationTitle',
      descKey: 'stackValidationDesc',
      catKey: 'catLogic'
    },
    {
      icon: <SafetyOutlined />,
      titleKey: 'stackRiskTitle',
      descKey: 'stackRiskDesc',
      catKey: 'catRisk'
    },
    {
      icon: <LockOutlined />,
      titleKey: 'stackSecretsTitle',
      descKey: 'stackSecretsDesc',
      catKey: 'catSecurity'
    },
    {
      icon: <SecurityScanOutlined />,
      titleKey: 'stackDockerTitle',
      descKey: 'stackDockerDesc',
      catKey: 'catDevOps'
    }
  ];

  return (
    <MarketingLayout>
      <style>{`
        .tech-card {
          background: rgba(17, 25, 40, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 32px;
          height: 100%;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(12px);
          position: relative;
        }
        .tech-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(24,144,255,0.3);
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .tech-category {
          font-size: 0.7rem;
          color: #1890ff;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 16px;
          background: rgba(24,144,255,0.1);
          padding: 4px 10px;
          border-radius: 4px;
          width: fit-content;
        }
        .tech-icon {
          font-size: 32px;
          color: #fff;
          margin-bottom: 24px;
          width: 60px;
          height: 60px;
          background: rgba(255,255,255,0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: all 0.3s ease;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .tech-card:hover .tech-icon {
          background: #1890ff;
          color: #fff;
          transform: scale(1.1);
          border-color: #1890ff;
        }
        .tech-title {
          color: #fff;
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .tech-desc {
          color: #64748b;
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }
        .architecture-concept {
          margin-bottom: 80px;
          padding: 60px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 32px;
          text-align: center;
        }
      `}</style>

      <div className="page-hero">
        <h1 className="page-title reveal-on-scroll">{t.technology.heroTitle}</h1>
        <p className="page-subtitle reveal-on-scroll delay-100">
          {t.technology.heroSubtitle}
        </p>
      </div>

      <section className="section-container" style={{ paddingTop: 0, paddingBottom: 100 }}>
        {/* Architecture Diagram Concept */}
        <div className="architecture-concept reveal-on-scroll">
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>{t.technology.archTitle}</h2>
          <Row gutter={[32, 32]} align="middle" justify="center">
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(24,144,255,0.1)', borderRadius: 16, border: '1px dashed rgba(24,144,255,0.3)' }}>
                <h4 style={{ color: '#1890ff', margin: 0 }}>{t.technology.archMarketFeeds}</h4>
              </div>
            </Col>
            <Col xs={24} md={1}>
              <ArrowRightOutlined aria-hidden="true" style={{ color: '#475569', fontSize: 20 }} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(114,46,209,0.1)', borderRadius: 16, border: '1px solid rgba(114,46,209,0.3)' }}>
                <h4 style={{ color: '#722ed1', margin: 0 }}>{t.technology.archAIValidation}</h4>
              </div>
            </Col>
            <Col xs={24} md={1}>
              <ArrowRightOutlined aria-hidden="true" style={{ color: '#475569', fontSize: 20 }} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(73,170,25,0.1)', borderRadius: 16, border: '1px dashed rgba(73,170,25,0.3)' }}>
                <h4 style={{ color: '#49aa19', margin: 0 }}>{t.technology.archBrokerAPI}</h4>
              </div>
            </Col>
          </Row>
          <p style={{ color: '#64748b', marginTop: 40, maxWidth: 600, margin: '40px auto 0' }}>
            {t.technology.archDesc}
          </p>
        </div>

        <Row gutter={[24, 24]}>
          {techStack.map((tech, i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <div className={`tech-card reveal-on-scroll delay-${(i % 3) * 100 + 100}`}>
                <div className="tech-category">{t.technology[tech.catKey as keyof typeof t.technology]}</div>
                <div className="tech-icon">{React.cloneElement(tech.icon as React.ReactElement, { "aria-hidden": "true" })}</div>
                <h4 className="tech-title">{t.technology[tech.titleKey as keyof typeof t.technology]}</h4>
                <p className="tech-desc">{t.technology[tech.descKey as keyof typeof t.technology]}</p>
              </div>
            </Col>
          ))}
        </Row>
        
        <div style={{ textAlign: 'center', marginTop: 120 }} className="reveal-on-scroll">
          <h3 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: 24 }}>{t.technology.ctaTitle}</h3>
          <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')}>
            {t.technology.ctaAction} <ArrowRightOutlined aria-hidden="true" />
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Technology;
