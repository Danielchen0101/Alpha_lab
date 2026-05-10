import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Row, Col, Space } from 'antd';
import {
  RobotOutlined, CheckCircleOutlined, ArrowRightOutlined, NodeIndexOutlined,
  LoadingOutlined, ThunderboltOutlined, GithubOutlined,
  GlobalOutlined, SearchOutlined, FilterOutlined, AimOutlined,
  ExperimentOutlined, DeploymentUnitOutlined, EyeOutlined
} from '@ant-design/icons';
import MarketingLayout from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const techStack = [
    'React', 'TypeScript', 'Python / Flask', 'Alpaca API',
    'AI Providers: OpenAI / DeepSeek / Anthropic',
    'Backtesting Engine', 'Market Data Integration'
  ];

  const capabilities = [
    { icon: <GlobalOutlined />, title: t.landing.capMarketScanner, desc: t.landing.capMarketScannerDesc },
    { icon: <SearchOutlined />, title: t.landing.capAIAgent, desc: t.landing.capAIAgentDesc },
    { icon: <FilterOutlined />, title: t.landing.capFineScan, desc: t.landing.capFineScanDesc },
    { icon: <RobotOutlined />, title: t.landing.capDeeperValidation, desc: t.landing.capDeeperValidationDesc },
    { icon: <AimOutlined />, title: t.landing.capEntryPlan, desc: t.landing.capEntryPlanDesc },
    { icon: <ExperimentOutlined />, title: t.landing.capBacktesting, desc: t.landing.capBacktestingDesc },
    { icon: <ThunderboltOutlined />, title: t.landing.capOptimization, desc: t.landing.capOptimizationDesc },
    { icon: <DeploymentUnitOutlined />, title: t.landing.capTradingModes, desc: t.landing.capTradingModesDesc },
    { icon: <EyeOutlined />, title: t.landing.capWatchlist, desc: t.landing.capWatchlistDesc },
  ];

  return (
    <MarketingLayout>
      <style>{`
        /* Advanced Animated Background */
        .hero-section {
          position: relative;
          min-height: calc(100vh - 80px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 80px 24px 80px;
          overflow: hidden;
        }
        
        .hero-bg-orb-1 {
          position: absolute;
          top: 15%;
          left: 20%;
          width: 60vw;
          height: 60vw;
          max-width: 800px;
          max-height: 800px;
          background: radial-gradient(circle, rgba(24,144,255,0.12) 0%, rgba(3,8,22,0) 70%);
          filter: blur(80px);
          z-index: 0;
          animation: orbDrift 20s ease-in-out infinite alternate;
        }
        .hero-bg-orb-2 {
          position: absolute;
          bottom: 10%;
          right: 15%;
          width: 50vw;
          height: 50vw;
          max-width: 700px;
          max-height: 700px;
          background: radial-gradient(circle, rgba(114,46,209,0.1) 0%, rgba(3,8,22,0) 70%);
          filter: blur(80px);
          z-index: 0;
          animation: orbDrift 25s ease-in-out infinite alternate-reverse;
        }
        .hero-bg-orb-3 {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40vw;
          height: 40vw;
          max-width: 500px;
          max-height: 500px;
          background: radial-gradient(circle, rgba(19,194,194,0.08) 0%, rgba(3,8,22,0) 60%);
          filter: blur(60px);
          z-index: 0;
          animation: pulseOrb 8s ease-in-out infinite alternate;
        }
        
        @keyframes orbDrift {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5%, 5%) scale(1.05); }
          100% { transform: translate(-5%, -5%) scale(0.95); }
        }
        @keyframes pulseOrb {
          0% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.8); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }

        .hero-grid {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-size: 80px 80px;
          background-image: linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%);
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%);
          z-index: 0;
          transform: perspective(800px) rotateX(40deg);
          transform-origin: top center;
          animation: gridPan 30s linear infinite;
        }
        @keyframes gridPan {
          0% { background-position: 0 0; }
          100% { background-position: 80px 80px; }
        }
        
        /* Glowing Scan Line Background */
        .bg-scan-line {
          position: absolute;
          top: -10%;
          left: -10%;
          width: 120%;
          height: 200px;
          background: linear-gradient(to bottom, transparent, rgba(24,144,255,0.05), transparent);
          transform: rotate(-15deg);
          animation: bgScan 8s linear infinite;
          z-index: 0;
          pointer-events: none;
        }
        @keyframes bgScan {
          0% { transform: translateY(-50vh) rotate(-15deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(150vh) rotate(-15deg); opacity: 0; }
        }
        
        .content-relative {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }
        .premium-title {
          font-size: clamp(3.5rem, 7vw, 6rem);
          font-weight: 800;
          line-height: 1.05;
          background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 24px;
          letter-spacing: -0.03em;
          animation: fadeUp 0.8s ease-out forwards;
        }
        .premium-subtitle {
          font-size: clamp(1.1rem, 2vw, 1.25rem);
          color: #94a3b8;
          max-width: 750px;
          margin: 0 auto 40px;
          line-height: 1.6;
          animation: fadeUp 0.8s ease-out 0.2s forwards;
          opacity: 0;
        }
        .hero-actions {
          animation: fadeUp 0.8s ease-out 0.4s forwards;
          opacity: 0;
        }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Hero Dashboard Visual Mockup */
        .hero-visual {
          margin-top: 60px;
          border-radius: 20px;
          background: rgba(17,25,40,0.5);
          backdrop-filter: blur(24px);
          padding: 24px;
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.8), 0 0 50px rgba(24,144,255,0.08);
          animation: fadeUp 0.8s ease-out 0.6s forwards, floatPanel 8s ease-in-out infinite;
          opacity: 0;
          position: relative;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .hero-visual::before {
          content: '';
          position: absolute;
          top: -1px; left: -1px; right: -1px; bottom: -1px;
          background: linear-gradient(135deg, rgba(24,144,255,0.3) 0%, transparent 30%, transparent 70%, rgba(114,46,209,0.3) 100%);
          border-radius: 20px;
          z-index: -1;
          opacity: 0.6;
          transition: opacity 0.5s ease;
        }
        .hero-visual:hover::before {
          opacity: 1;
        }
        @keyframes floatPanel {
          0% { transform: translateY(0px) rotateX(0deg); }
          50% { transform: translateY(-12px) rotateX(2deg); }
          100% { transform: translateY(0px) rotateX(0deg); }
        }
        
        .mockup-inner-panel {
          background: rgba(0,0,0,0.4);
          border-radius: 12px;
          padding: 24px;
          border: 1px solid rgba(255,255,255,0.05);
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        
        .mockup-scan-line {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 2px;
          background: linear-gradient(to right, transparent, #1890ff, transparent);
          box-shadow: 0 0 15px #1890ff;
          animation: scanBar 3s linear infinite;
          z-index: 2;
        }
        @keyframes scanBar {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          background: rgba(24,144,255,0.1);
          color: #1890ff;
          border: 1px solid rgba(24,144,255,0.2);
        }
        .status-chip.success {
          background: rgba(73,170,25,0.1);
          color: #49aa19;
          border-color: rgba(73,170,25,0.2);
        }
        .status-chip.purple {
          background: rgba(114,46,209,0.1);
          color: #b37feb;
          border-color: rgba(114,46,209,0.2);
        }
        
        .blinking-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          display: inline-block;
          animation: blinkPulse 1.5s infinite;
        }
        .blinking-dot.blue { background-color: #1890ff; box-shadow: 0 0 8px #1890ff; }
        .blinking-dot.green { background-color: #49aa19; box-shadow: 0 0 8px #49aa19; }
        @keyframes blinkPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .highlight-card {
          background: rgba(17, 25, 40, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 32px;
          height: 100%;
          transition: all 0.4s ease;
          text-align: left;
          backdrop-filter: blur(12px);
        }
        .highlight-card:hover {
          background: rgba(24, 144, 255, 0.03);
          border-color: rgba(24, 144, 255, 0.3);
          transform: translateY(-5px);
        }

        .tech-tag {
          background: rgba(24, 144, 255, 0.05);
          border: 1px solid rgba(24, 144, 255, 0.2);
          color: #1890ff;
          padding: 6px 16px;
          border-radius: 8px;
          font-weight: 500;
          margin: 4px;
          display: inline-block;
        }

        .cap-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.3s ease;
          height: 100%;
        }
        .cap-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(24, 144, 255, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .cap-icon {
          font-size: 24px;
          color: #1890ff;
          margin-bottom: 16px;
        }
        .cap-title {
          color: #fff;
          font-weight: 700;
          margin-bottom: 8px;
          font-size: 1.1rem;
        }
        .cap-desc {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .github-section {
          background: linear-gradient(145deg, rgba(17,25,40,0.6) 0%, rgba(11,21,41,0.4) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px;
          margin-top: 80px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .github-section:hover {
          border-color: rgba(255,255,255,0.2);
        }
      `}</style>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-orb-1"></div>
        <div className="hero-bg-orb-2"></div>
        <div className="hero-bg-orb-3"></div>
        <div className="hero-grid"></div>
        <div className="bg-scan-line"></div>
        
        <div className="content-relative">
          <div style={{ display: 'flex', width: 'fit-content', margin: '0 auto 28px auto', alignItems: 'center', justifyContent: 'center', padding: '8px 24px', borderRadius: '30px', background: 'rgba(24,144,255,0.1)', border: '1px solid rgba(24,144,255,0.3)', color: '#1890ff', fontSize: '0.95rem', fontWeight: 600, animation: 'fadeUp 0.8s ease-out forwards', boxShadow: '0 0 20px rgba(24,144,255,0.15)', letterSpacing: '0.5px' }}>
            {t.landing.heroBadge}
          </div>
          <h1 className="premium-title">
            {t.landing.heroTitle1}<br/> {t.landing.heroTitle2}
          </h1>
          <p className="premium-subtitle">
            {t.landing.heroSubtitle}
          </p>
          <Space size="large" className="hero-actions">
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')}>
              {t.landing.startBuilding} <ArrowRightOutlined />
            </Button>
            <Button className="btn-secondary" onClick={() => navigate('/platform')}>
              {t.landing.explorePlatform}
            </Button>
          </Space>

          {/* Dynamic AI Workflow Dashboard Mockup */}
          <div className="hero-visual">
            <Row gutter={24}>
              <Col xs={24} md={10}>
                <div className="mockup-inner-panel">
                  <div className="mockup-scan-line"></div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 20, letterSpacing: 1.5, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t.landing.orchestrator}</span>
                    <span className="blinking-dot blue"></span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t.landing.globalMarketScan}</span>
                        <span className="status-chip success"><CheckCircleOutlined /> {t.landing.complete}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{t.landing.processedEquities}</div>
                    </div>
                    
                    <div style={{ background: 'rgba(24,144,255,0.05)', border: '1px solid rgba(24,144,255,0.2)', padding: '12px 16px', borderRadius: 8, boxShadow: '0 0 15px rgba(24,144,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t.landing.deeperValidation}</span>
                        <span className="status-chip"><LoadingOutlined style={{ marginRight: 4 }}/> {t.landing.analyzing}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{t.landing.llmReview}</div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: '65%', height: '100%', background: '#1890ff', transition: 'width 2s ease' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
              
              <Col xs={24} md={14}>
                <div className="mockup-inner-panel">
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                     <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1.5, fontWeight: 600 }}>{t.landing.backtestEntryPlan}</span>
                     <span className="status-chip purple"><NodeIndexOutlined /> {t.landing.synthesizingStrategy}</span>
                   </div>
                   
                   <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 120, marginBottom: 16 }}>
                     {/* Simulated AI Decision Network */}
                     <svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="none">
                        <path d="M20,60 L100,20 L200,80 L300,30 L380,60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                        <path d="M20,60 L120,90 L200,80 L280,100 L380,60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                        <path d="M100,20 Q200,0 300,30" fill="none" stroke="rgba(114,46,209,0.4)" strokeWidth="2" strokeDasharray="5,5" style={{ animation: 'scanBar 5s linear infinite' }} />
                        <path d="M0,80 Q100,60 200,80 T400,60" fill="none" stroke="rgba(24,144,255,0.5)" strokeWidth="3" filter="drop-shadow(0 0 4px rgba(24,144,255,0.5))" />
                        <circle cx="20" cy="60" r="4" fill="#fff" />
                        <circle cx="100" cy="20" r="4" fill="#fff" />
                        <circle cx="200" cy="80" r="6" fill="#1890ff" filter="drop-shadow(0 0 6px #1890ff)" />
                        <circle cx="300" cy="30" r="4" fill="#fff" />
                        <circle cx="380" cy="60" r="6" fill="#1890ff" filter="drop-shadow(0 0 6px #1890ff)" />
                     </svg>
                   </div>

                   <div style={{ display: 'flex', gap: 16 }}>
                     <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 8, flex: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{t.landing.riskProtocol}</div>
                       <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t.landing.strictPerTrade}</div>
                     </div>
                     <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 8, flex: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{t.landing.targetRR}</div>
                       <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>1 : 2.5</div>
                     </div>
                   </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </section>

      {/* Project Overview */}
      <section className="section-container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="reveal-on-scroll">
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>{t.landing.overviewTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: 800, margin: '0 auto 40px', lineHeight: 1.7 }}>
            {t.landing.overviewDesc}
          </p>
        </div>

        {/* Tech Stack */}
        <div className="reveal-on-scroll delay-100" style={{ marginTop: 60 }}>
          <h3 style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 }}>{t.landing.builtWith}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900, margin: '0 auto' }}>
            {techStack.map((tech, idx) => (
              <span key={idx} className="tech-tag">{tech}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="section-container">
        <div className="reveal-on-scroll" style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>{t.landing.capabilitiesTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>{t.landing.capabilitiesSubtitle}</p>
        </div>
        
        <Row gutter={[24, 24]}>
          {capabilities.map((cap, idx) => (
            <Col xs={24} sm={12} md={8} key={idx}>
              <div className={`cap-card reveal-on-scroll delay-${(idx % 3) * 100 + 100}`}>
                <div className="cap-icon">{cap.icon}</div>
                <h3 className="cap-title">{cap.title}</h3>
                <p className="cap-desc">{cap.desc}</p>
              </div>
            </Col>
          ))}
        </Row>
      </section>

      {/* GitHub Repository Link */}
      <section className="section-container" style={{ paddingBottom: 100 }}>
        <div className="github-section reveal-on-scroll">
          <GithubOutlined style={{ fontSize: 48, color: '#fff', marginBottom: 24 }} />
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>{t.landing.githubTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: 600, margin: '0 auto 32px' }}>
            {t.landing.githubDesc}
          </p>
          <Button 
            className="btn-secondary" 
            style={{ height: 50, padding: '0 32px' }}
            href="https://github.com/Danielchen0101/quant_platform"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.landing.githubButton} <ArrowRightOutlined />
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-container" style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div className="reveal-on-scroll" style={{ background: 'linear-gradient(145deg, rgba(24,144,255,0.05) 0%, rgba(114,46,209,0.05) 100%)', padding: '60px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>{t.landing.ctaTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: 40, maxWidth: 700, margin: '0 auto 40px' }}>
            {t.landing.ctaDesc}
          </p>
          <Space size="large">
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 40px' }}>{t.landing.ctaGetStarted}</Button>
            <Button className="btn-secondary" onClick={() => navigate('/signin')} style={{ height: 56, padding: '0 40px' }}>{t.landing.ctaSignIn}</Button>
          </Space>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Landing;
