import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Row, Col, Space } from 'antd';
import {
  RobotOutlined, ArrowRightOutlined,
  ThunderboltOutlined, GithubOutlined,
  GlobalOutlined, SearchOutlined, FilterOutlined, AimOutlined,
  ExperimentOutlined, DeploymentUnitOutlined, EyeOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import MarketingLayout from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import StockMarketHeroVisual from '../components/home/StockMarketHeroVisual';

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
        /* Premium Fintech Background */
        .nav-header:not(.scrolled) {
          border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
          background: linear-gradient(to bottom, rgba(2, 6, 17, 0.8) 0%, rgba(2, 6, 17, 0) 100%) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        
        .nav-header.scrolled {
          background: rgba(2, 6, 17, 0.95) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
        }

        .nav-item {
          letter-spacing: 0.01em;
        }

        .hero-section {
          position: relative;
          min-height: calc(100vh - 72px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 52px 24px 60px;
          overflow: hidden;
          background: radial-gradient(ellipse at 50% 30%, #07111f 0%, #040914 50%, #020611 100%);
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }
        
        .hero-section::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 150px;
          background: linear-gradient(to bottom, transparent, #020611);
          z-index: 1;
          pointer-events: none;
        }
        
        .hero-bg-orb-1 {
          position: absolute;
          top: -10%;
          left: -10%;
          width: 70vw;
          height: 70vw;
          background: radial-gradient(circle, rgba(24,144,255,0.15) 0%, transparent 60%);
          z-index: 0;
          pointer-events: none;
        }
        .hero-bg-orb-2 {
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 70vw;
          height: 70vw;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 60%);
          z-index: 0;
          pointer-events: none;
        }
        .hero-bg-orb-3 {
          position: absolute;
          top: 30%;
          right: 15%;
          width: 50vw;
          height: 50vw;
          background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 60%);
          z-index: 0;
          pointer-events: none;
        }
        .hero-bg-orb-4 {
          position: absolute;
          top: 20%;
          right: 0%;
          width: 50vw;
          height: 60vw;
          background: radial-gradient(ellipse at center, rgba(34,211,238,0.1) 0%, transparent 70%);
          z-index: 0;
          pointer-events: none;
        }

        .hero-grid {
          position: absolute;
          inset: 0;
          background-size: 100px 100px;
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px);
          mask-image: radial-gradient(circle at 50% 50%, black 20%, transparent 90%);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, black 20%, transparent 90%);
          z-index: 0;
          pointer-events: none;
        }

        .hero-perspective-lines {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.5;
          background-image: repeating-linear-gradient(45deg, rgba(24,144,255,0.1) 0px, rgba(24,144,255,0.1) 1px, transparent 1px, transparent 100px);
          mask-image: radial-gradient(circle at 100% 0%, black, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at 100% 0%, black, transparent 70%);
        }

        .bg-dot-matrix {
          position: absolute;
          top: 10%;
          left: 2%;
          width: 300px;
          height: 400px;
          background-image: radial-gradient(rgba(255,255,255,0.15) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
          mask-image: linear-gradient(to bottom right, black, transparent);
          -webkit-mask-image: linear-gradient(to bottom right, black, transparent);
          z-index: 0;
          pointer-events: none;
        }

        .bg-signal-lines {
          position: absolute;
          top: 15%;
          right: 5%;
          width: 400px;
          height: 400px;
          z-index: 0;
          pointer-events: none;
          opacity: 0.2;
        }

        /* Subtle background data signals */
        .bg-data-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .bg-data-item {
          position: absolute;
          font-family: 'SFMono-Regular', Consolas, monospace;
          color: rgba(148,163,184,0.25);
          font-size: 12px;
          letter-spacing: 0.15em;
          white-space: pre;
          text-transform: uppercase;
          line-height: 1.8;
        }
        .bg-data-left { left: 4%; top: 20%; }
        .bg-data-right { right: 4%; top: 25%; text-align: right; }
        
        .bg-faint-chart {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 300px;
          opacity: 0.2;
          pointer-events: none;
          z-index: 0;
        }
        
        .content-relative {
          position: relative;
          z-index: 5;
          max-width: clamp(1160px, 92vw, 1460px);
          margin: 0 auto;
          width: 100%;
          display: grid;
          grid-template-columns: minmax(380px, 0.5fr) minmax(520px, 0.85fr);
          align-items: center;
          gap: clamp(28px, 3.5vw, 52px);
          padding: 0 clamp(20px, 2vw, 40px);
        }

        .hero-text-area {
          text-align: left;
          background: transparent;
          padding: 0;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        .hero-badge {
          display: inline-flex;
          margin-bottom: 24px;
          padding: 6px 16px;
          border-radius: 20px;
          background: rgba(24,144,255,0.05);
          border: 1px solid rgba(24,144,255,0.1);
          color: #60a5fa;
          font-size: clamp(0.75rem, 0.9vw, 0.85rem);
          font-weight: 600;
          letter-spacing: 0.5px;
          animation: fadeUp 0.6s ease-out forwards;
        }

        .premium-title {
          font-size: clamp(2.4rem, 3.2vw, 3.6rem);
          font-weight: 800;
          line-height: 1.15;
          background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 24px;
          letter-spacing: -0.01em;
          animation: fadeUp 0.8s ease-out forwards;
        }
        .premium-title span {
          background: linear-gradient(135deg, rgba(96,165,250,0.95) 0%, rgba(59,130,246,0.9) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .premium-subtitle {
          font-size: clamp(0.95rem, 1.1vw, 1.1rem);
          color: rgba(203,213,225,0.8);
          margin-bottom: 32px;
          line-height: 1.8;
          font-weight: 400;
          max-width: 580px;
          animation: fadeUp 0.8s ease-out 0.2s forwards;
          opacity: 0;
        }

        .feature-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 40px;
          animation: fadeUp 0.8s ease-out 0.25s forwards;
          opacity: 0;
        }

        .feature-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          color: rgba(148,163,184,0.9);
          font-size: clamp(0.8rem, 0.9vw, 0.9rem);
          font-weight: 500;
        }

        .hero-actions {
          animation: fadeUp 0.8s ease-out 0.3s forwards;
          opacity: 0;
        }

        .hero-actions .btn-primary,
        .hero-actions .btn-secondary {
          height: clamp(44px, 3.5vw, 50px) !important;
          border-radius: 12px !important;
          padding: 0 clamp(20px, 2.5vw, 32px) !important;
          font-size: clamp(0.9rem, 1vw, 1rem) !important;
          font-weight: 600 !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .hero-actions .btn-primary {
          background: linear-gradient(135deg, rgba(24,144,255,0.9) 0%, rgba(37,99,235,0.9) 100%) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: 0 8px 20px rgba(24,144,255,0.15) !important;
          color: #ffffff !important;
        }
        .hero-actions .btn-primary:hover {
          background: linear-gradient(135deg, rgba(64,169,255,1) 0%, rgba(59,130,246,1) 100%) !important;
          box-shadow: 0 12px 28px rgba(24,144,255,0.25) !important;
          transform: translateY(-2px);
        }

        .hero-actions .btn-secondary {
          background: rgba(255,255,255,0.02) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #f8fafc !important;
          backdrop-filter: blur(8px);
        }
        .hero-actions .btn-secondary:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(24,144,255,0.3) !important;
          color: #60a5fa !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hero-visual-wrapper {
          position: relative;
          width: 100%;
          padding-top: clamp(16px, 2vh, 32px);
          animation: fadeUp 0.8s ease-out 0.4s forwards;
          opacity: 0;
        }

        .hero-visual {
          border-radius: 20px;
          background: rgba(11, 17, 32, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 0;
          box-shadow: 0 30px 80px -20px rgba(0,0,0,0.6), 0 0 20px rgba(24,144,255,0.04);
          position: relative;
          border: 1px solid rgba(255,255,255,0.06);
          max-height: calc(100vh - 130px);
          overflow: hidden;
          /* Removed scale and complex transforms for sharp text */
          transform: translateY(0);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        .hero-visual:hover {
          border-color: rgba(24,144,255,0.2);
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.7), 0 0 30px rgba(24,144,255,0.1);
          transform: translateY(-4px);
        }

        .pulse-indicator {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        /* Floating dashboard animation */
        .hero-visual-float {
          animation: floatSoft 7s ease-in-out 1.5s infinite;
        }
        @keyframes floatSoft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        /* Hero background spotlight */
        .hero-spotlight {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 70vw;
          height: 50vw;
          max-width: 1000px;
          max-height: 700px;
          background: radial-gradient(ellipse at center, rgba(56,189,248,0.05) 0%, transparent 60%);
          z-index: 0;
          pointer-events: none;
          animation: spotlightBreathe 6s ease-in-out infinite;
        }
        @keyframes spotlightBreathe {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
        }

        /* Dashboard scanning sweep line */
        .hero-visual::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(56,189,248,0.03) 40%,
            rgba(56,189,248,0.06) 50%,
            rgba(56,189,248,0.03) 60%,
            transparent 100%
          );
          pointer-events: none;
          z-index: 2;
          animation: scanSweep 7s ease-in-out infinite;
        }
        @keyframes scanSweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }
        .reveal-on-scroll.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Highlight feature grid classes */
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

        @media (max-width: 1440px) {
          .premium-title { font-size: clamp(2.2rem, 3.5vw, 3.2rem); }
          .hero-visual-wrapper { padding-top: clamp(12px, 1.5vh, 24px); }
        }

        @media (max-width: 1280px) {
          .content-relative { grid-template-columns: minmax(320px, 0.5fr) minmax(400px, 0.9fr); gap: clamp(16px, 2.5vw, 24px); }
          .hero-section { padding: 32px 20px 48px; }
          .premium-title { font-size: clamp(2rem, 3vw, 2.8rem); }
          .premium-subtitle { font-size: clamp(0.9rem, 1vw, 1rem); }
          .hero-actions .btn-primary, .hero-actions .btn-secondary { height: 40px !important; padding: 0 18px !important; font-size: 0.85rem !important; }
          .hero-badge { font-size: clamp(0.65rem, 0.8vw, 0.75rem); }
          .hero-visual-wrapper { padding-top: clamp(8px, 1.5vh, 20px); }
        }

        @media (max-width: 1024px) {
          .content-relative { grid-template-columns: 1fr; text-align: center; }
          .hero-text-area { padding-right: 0; margin-bottom: 60px; max-width: 600px; margin-left: auto; margin-right: auto; }
          .hero-badge { margin: 0 auto 24px; }
          .feature-chips { justify-content: center; }
          .hero-actions { justify-content: center; }
          .hero-visual-wrapper { width: 100%; left: 0; }
        }
        
        @media (max-width: 768px) {
          .premium-title { font-size: clamp(2rem, 8vw, 2.5rem); }
          .hero-section { padding: 60px 16px 40px; }
          .bg-data-overlay { display: none; }
          .feature-chips { 
            gap: 8px; 
            margin-bottom: 32px; 
          }
          .feature-chip {
            padding: 4px 10px;
            font-size: 11px;
          }
          /* Hide secondary features on mobile to reduce density */
          .feature-chip:nth-child(n+4) { display: none; }

          .hero-actions {
            flex-direction: column;
            width: 100%;
            gap: 12px !important;
          }
          .hero-actions .ant-btn {
            width: 100%;
            height: 50px !important;
          }
        }

        @media (max-height: 800px) {
          .hero-section { min-height: auto; padding: 16px 24px 40px; }
          .premium-title { font-size: clamp(1.6rem, 2.5vw, 2.2rem); margin-bottom: 12px; }
          .premium-subtitle { margin-bottom: 16px; font-size: clamp(0.8rem, 0.9vw, 0.95rem); }
          .feature-chips { margin-bottom: 20px; gap: 6px; }
          .feature-chip { padding: 4px 8px; font-size: clamp(0.7rem, 0.8vw, 0.8rem); }
          .hero-badge { margin-bottom: 12px; padding: 4px 12px; }
          .hero-actions .btn-primary, .hero-actions .btn-secondary { height: 36px !important; padding: 0 16px !important; font-size: 0.8rem !important; }
          .hero-visual-wrapper { padding-top: 16px; }
          .hero-grid { background-size: 60px 60px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-orb-1"></div>
        <div className="hero-bg-orb-2"></div>
        <div className="hero-bg-orb-3"></div>
        <div className="hero-bg-orb-4"></div>
        <div className="hero-grid"></div>
        <div className="hero-perspective-lines"></div>
        <div className="bg-dot-matrix"></div>
        <div className="hero-spotlight"></div>
        
        {/* Background Data Streams */}
        <div className="bg-data-overlay">
          <svg className="bg-signal-lines" viewBox="0 0 200 200" preserveAspectRatio="none">
            <path d="M 0 50 Q 50 50 100 100 T 200 150" fill="none" stroke="#60a5fa" strokeWidth="0.5" />
            <path d="M 50 0 Q 100 50 150 50 T 200 100" fill="none" stroke="#34d399" strokeWidth="0.5" />
            <path d="M 0 150 Q 100 100 200 50" fill="none" stroke="#818cf8" strokeWidth="0.5" strokeDasharray="2 2" />
          </svg>
          
          <div className="bg-data-item bg-data-left" style={{ transform: 'none' }}>
            <div>SCAN UNIVERSE: 12,402</div>
            <div style={{ color: 'rgba(16,185,129,0.7)' }}>+ LIVE FEED ACTIVE</div>
            <div style={{ marginTop: 16 }}>MODEL: ALPHA-V4</div>
            <div>LATENCY: 12ms</div>
            <div style={{ marginTop: 24, fontSize: '10px', opacity: 0.6 }}>
              NVDA +3.42<br/>
              SPY +0.63<br/>
              AAPL +1.27
            </div>
          </div>
          <div className="bg-data-item bg-data-right" style={{ transform: 'none' }}>
            <div>RISK EXPOSURE: LOW</div>
            <div style={{ color: 'rgba(96,165,250,0.7)' }}>ENTRY SIGNAL: VALIDATED</div>
            <div style={{ marginTop: 16 }}>PORTFOLIO DELTA: +0.42</div>
            <div>SHARPE: 2.1</div>
            <div style={{ marginTop: 24, fontSize: '10px', opacity: 0.6 }}>
              AI SIGNAL ACTIVE<br/>
              RISK MODEL ONLINE
            </div>
          </div>
          <svg className="bg-faint-chart" viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path d="M0 180 Q 200 150 400 160 T 800 120 T 1000 80" fill="none" stroke="rgba(24,144,255,0.25)" strokeWidth="2" />
            <path d="M0 160 Q 250 180 500 120 T 900 100 T 1000 40" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />
            <path d="M0 190 Q 300 170 600 190 T 1000 140" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="1.5" />
          </svg>
        </div>
        
        <div className="content-relative">
          <div className="hero-text-area">
            <div className="hero-badge">
              {t.landing.heroBadge || "Systematic Intelligence. Flawless Execution."}
            </div>
            <h1 className="premium-title">
              {t.landing.heroTitle1 || "Smarter AI Trading."}<br/> 
              <span>{t.landing.heroTitle2 || "Stronger Tomorrow."}</span>
            </h1>
            <p className="premium-subtitle">
              {t.landing.heroSubtitle || "AlphaLab combines AI intelligence, real-time market data, and advanced analytics to help you trade with clarity and confidence."}
            </p>
            <div className="feature-chips">
              <span className="feature-chip"><AimOutlined style={{ color: '#60a5fa' }} /> Real-time scanning</span>
              <span className="feature-chip"><RobotOutlined style={{ color: '#60a5fa' }} /> AI validation</span>
              <span className="feature-chip"><CheckCircleOutlined style={{ color: '#60a5fa' }} /> Risk-aware execution</span>
              <span className="feature-chip"><ExperimentOutlined style={{ color: '#60a5fa' }} /> Backtest ready</span>
            </div>
            <Space size="large" className="hero-actions">
              <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} aria-label="hero-start-free-trial">
                {t.landing.startBuilding || "Start Free Trial"} <ArrowRightOutlined />
              </Button>
              <Button className="btn-secondary" onClick={() => navigate('/platform')} aria-label="hero-explore-strategies">
                {t.landing.explorePlatform || "Explore Strategies"}
              </Button>
            </Space>
          </div>

          {/* Dynamic AI Workflow Dashboard Mockup */}
          <div className="hero-visual-wrapper">
            <div className="hero-visual-float">
              <div className="hero-visual" style={{ transform: 'rotateX(0.8deg) rotateY(-0.5deg)' }}>
                <StockMarketHeroVisual />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Overview */}
      <section className="section-container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="reveal-on-scroll visible">
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>{t.landing.overviewTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: 800, margin: '0 auto 40px', lineHeight: 1.7 }}>
            {t.landing.overviewDesc}
          </p>
        </div>

        {/* Tech Stack */}
        <div className="reveal-on-scroll visible delay-100" style={{ marginTop: 60 }}>
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
        <div className="reveal-on-scroll visible" style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>{t.landing.capabilitiesTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>{t.landing.capabilitiesSubtitle}</p>
        </div>
        
        <Row gutter={[24, 24]}>
          {capabilities.map((cap, idx) => (
            <Col xs={24} sm={12} md={8} key={idx}>
              <div className="cap-card reveal-on-scroll visible">
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
        <div className="github-section reveal-on-scroll visible">
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
        <div className="reveal-on-scroll visible" style={{ background: 'linear-gradient(145deg, rgba(24,144,255,0.05) 0%, rgba(114,46,209,0.05) 100%)', padding: '60px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>{t.landing.ctaTitle}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: 40, maxWidth: 700, margin: '0 auto 40px' }}>
            {t.landing.ctaDesc}
          </p>
          <Space size="large">
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 40px' }} aria-label="cta-get-started">{t.landing.ctaGetStarted}</Button>
            <Button className="btn-secondary" onClick={() => navigate('/signin')} style={{ height: 56, padding: '0 40px' }} aria-label="cta-sign-in">{t.landing.ctaSignIn}</Button>
          </Space>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Landing;