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

const Platform: React.FC = () => {
  const navigate = useNavigate();

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
          padding: 32px;
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
          padding: 40px;
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
        <h1 className="page-title reveal-on-scroll">The AI-Powered Quant Pipeline</h1>
        <p className="page-subtitle reveal-on-scroll delay-100">
          AlphaLab is an end-to-end quantitative trading and market analysis platform engineered for systematic traders. 
          We bridge the gap between institutional technical screening and modern AI reasoning.
        </p>
      </div>

      <section className="section-container" style={{ paddingTop: 0 }}>
        {/* End-to-End Workflow Summary */}
        <div style={{ textAlign: 'center', marginBottom: 80 }} className="reveal-on-scroll">
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>Systematic Intelligence</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: 800, margin: '0 auto' }}>
            AlphaLab provides a complete, risk-aware algorithmic pipeline that moves from broad market discovery to deterministic execution.
          </p>
        </div>

        <Row gutter={[32, 32]}>
          <Col xs={24} md={12} lg={8}>
            <div className="platform-feature-card reveal-on-scroll delay-100">
              <span className="step-num">PHASE 1</span>
              <GlobalOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
              <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Autonomous Scan</h3>
              <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                Identify emerging technical structures across thousands of equities in real-time. 
                Our multi-factor scanner filters noise to surface high-probability candidates.
              </p>
            </div>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <div className="platform-feature-card reveal-on-scroll delay-200">
              <span className="step-num">PHASE 2</span>
              <RobotOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
              <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>AI Validation</h3>
              <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                Specialized LLMs act as a secondary analyst, reviewing charts and context to verify market structure 
                and sentiment before a trade is even considered.
              </p>
            </div>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <div className="platform-feature-card reveal-on-scroll delay-300">
              <span className="step-num">PHASE 3</span>
              <AimOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 24 }} />
              <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Deterministic Plan</h3>
              <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                Automatically generate precise entry levels, stop-losses, and profit targets. 
                Every plan is account-aware, enforcing strict risk-to-reward parameters.
              </p>
            </div>
          </Col>
        </Row>

        {/* Core Value Prop: Risk Aware */}
        <div style={{ marginTop: 120, background: 'linear-gradient(145deg, rgba(17,25,40,0.6) 0%, rgba(11,21,41,0.4) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 48, backdropFilter: 'blur(16px)' }} className="reveal-on-scroll">
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} lg={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 24 }} />
                <span style={{ color: '#1890ff', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.9rem' }}>Risk-Aware Decision Support</span>
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 24, lineHeight: 1.2 }}>
                Beyond Blind Buy Signals.
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.15rem', lineHeight: 1.7, marginBottom: 24 }}>
                We don't just alert you to setups. AlphaLab walks every candidate through a comprehensive validation pipeline, ensuring statistical robustness before any capital is risked.
              </p>
              <Space size="large" direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                  <CheckCircleOutlined style={{ color: '#49aa19' }}/> Multi-LLM provider compatibility.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                  <CheckCircleOutlined style={{ color: '#49aa19' }}/> Real-time Alpaca paper and live trading.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
                  <CheckCircleOutlined style={{ color: '#49aa19' }}/> User-controlled AI configuration & audit trails.
                </div>
              </Space>
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 32, position: 'relative' }}>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SafetyOutlined style={{ color: '#1890ff' }} /> Trading Logic Hub
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 12, background: 'rgba(24,144,255,0.1)', borderLeft: '4px solid #1890ff', borderRadius: 4, color: '#e2e8f0' }}>
                    <ExperimentOutlined style={{ marginRight: 8 }} /> Paper Trading: Test strategies risk-free.
                  </div>
                  <div style={{ padding: 12, background: 'rgba(73,170,25,0.1)', borderLeft: '4px solid #49aa19', borderRadius: 4, color: '#e2e8f0' }}>
                    <RocketOutlined style={{ marginRight: 8 }} /> Live Execution: Direct broker connectivity.
                  </div>
                  <div style={{ padding: 12, background: 'rgba(114,46,209,0.1)', borderLeft: '4px solid #722ed1', borderRadius: 4, color: '#e2e8f0' }}>
                    <NodeIndexOutlined style={{ marginRight: 8 }} /> AI Provider: Configure OpenAI, DeepSeek, or Claude.
                  </div>
                  <div style={{ marginTop: 12, fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                    * Users bring their own API keys; secret configuration is handled securely.
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* Who it is for */}
        <div style={{ marginTop: 120 }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>Who is AlphaLab For?</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: 700, margin: '0 auto' }}>Designed for traders who value process and precision over "gut feelings" and blind alerts.</p>
          </div>
          
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <div className="who-it-is-for-card reveal-on-scroll delay-100">
                <TeamOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>Systematic Traders</h3>
                <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Traders who have a defined ruleset and want to scale their execution through automation and AI-assisted filtering.</p>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="who-it-is-for-card reveal-on-scroll delay-200">
                <InteractionOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>Quant Analysts</h3>
                <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Analysts looking to integrate modern LLM reasoning into traditional quantitative screening pipelines without coding from scratch.</p>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="who-it-is-for-card reveal-on-scroll delay-300">
                <AppstoreOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 20 }} />
                <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>Active Scalers</h3>
                <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Traders managing multiple setups simultaneously who need deterministic risk controls and position sizing to preserve capital.</p>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ textAlign: 'center', marginTop: 120 }} className="reveal-on-scroll">
          <div style={{ background: 'rgba(24,144,255,0.05)', padding: '60px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: 800, margin: '0 auto' }}>
            <h3 style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>Ready to experience the platform?</h3>
            <p style={{ color: '#94a3b8', fontSize: '1.15rem', marginBottom: 40 }}>Join systematic traders leveraging our AI quant pipeline.</p>
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 60px', fontSize: '1.2rem' }}>
              Get Started Now <ArrowRightOutlined />
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Platform;
