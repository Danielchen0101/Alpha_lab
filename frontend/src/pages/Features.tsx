import React, { useEffect } from 'react';
import { Button } from 'antd';
import {
  RobotOutlined, AimOutlined,
  BarChartOutlined, RocketOutlined, SafetyOutlined,
  ArrowRightOutlined,
  SearchOutlined, FilterOutlined, DeploymentUnitOutlined, EyeOutlined,
  InteractionOutlined, NodeIndexOutlined, GlobalOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';

const Features: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Ensure CSS is injected
    const styleId = 'features-premium-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .feature-card {
          background: rgba(17, 25, 40, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 32px;
          height: 100%;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          backdrop-filter: blur(12px);
          position: relative;
          overflow: hidden;
          cursor: default;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at top right, rgba(24,144,255,0.1), transparent 70%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .feature-card:hover {
          background: rgba(24, 144, 255, 0.03);
          border-color: rgba(24, 144, 255, 0.3);
          transform: translateY(-8px);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 40px rgba(24,144,255,0.1);
        }
        .feature-card:hover::before {
          opacity: 1;
        }
        .feature-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: rgba(24,144,255,0.08);
          border: 1px solid rgba(24,144,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          transition: all 0.4s ease;
          position: relative;
          z-index: 1;
        }
        .feature-card:hover .feature-icon-wrapper {
          background: rgba(24,144,255,0.15);
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 0 25px rgba(24,144,255,0.3);
        }
        .feature-title {
          color: #fff;
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }
        .feature-desc {
          color: #94a3b8;
          line-height: 1.6;
          font-size: 1rem;
          margin: 0;
          position: relative;
          z-index: 1;
          transition: color 0.3s ease;
        }
        .feature-card:hover .feature-desc {
          color: #e2e8f0;
        }
        
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-gap: 24px;
        }
        @media (max-width: 1200px) {
          .bento-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .bento-grid { grid-template-columns: 1fr; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const features = [
    { icon: <GlobalOutlined />, title: 'Market Scanner', desc: 'Identify emerging trends and anomalies across thousands of equities with multi-factor technical screening.' },
    { icon: <SearchOutlined />, title: 'AI Agent', desc: 'Autonomous intelligence that acts as your lead analyst, orchestrating the entire research and verification workflow.' },
    { icon: <FilterOutlined />, title: 'Fine Scan', desc: 'Surgical filtering logic to detect early multi-timeframe structures like base breaks and mean reversions.' },
    { icon: <RobotOutlined />, title: 'Deeper Validation', desc: 'Deploy specialized AI models to audit market structure context and sentiment, eliminating technical false positives.' },
    { icon: <AimOutlined />, title: 'Entry Plan', desc: 'Deterministic generation of entry zones, trailing stops, and profit targets with account-aware position sizing.' },
    { icon: <BarChartOutlined />, title: 'Institutional Backtesting', desc: 'Validate hypotheses against historical tick data with granular performance metrics and drawdown analysis.' },
    { icon: <RocketOutlined />, title: 'Strategy Optimization', desc: 'Leverage quantitative algorithms to fine-tune strategy parameters for maximum alpha and minimum risk.' },
    { icon: <InteractionOutlined />, title: 'Strategy Comparison', desc: 'Side-by-side performance benchmarking of multiple quantitative models to identify the most robust setups.' },
    { icon: <DeploymentUnitOutlined />, title: 'Alpaca Trading', desc: 'Seamless integration for both paper trading and live execution via high-performance broker API connection.' },
    { icon: <EyeOutlined />, title: 'AI Watchlist', desc: 'Intelligent monitoring with real-time tactical alerts and persistent technical score tracking for candidates.' },
    { icon: <NodeIndexOutlined />, title: 'Multi-AI Provider', desc: 'Provider-agnostic architecture compatible with OpenAI, DeepSeek, Claude, and local LLM configurations.' },
    { icon: <SafetyOutlined />, title: 'Risk Governance', desc: 'Hard-coded risk protocols that prevent over-exposure and enforce strict reward-to-risk thresholds on every plan.' },
  ];

  return (
    <MarketingLayout>
      <div className="page-hero">
        <h1 className="page-title reveal-on-scroll">Comprehensive Capabilities</h1>
        <p className="page-subtitle reveal-on-scroll delay-100">
          Everything you need to scan, validate, backtest, and execute strategies systematically without switching context.
        </p>
      </div>

      <section className="section-container" style={{ paddingTop: 0, paddingBottom: 100 }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }} className="reveal-on-scroll">
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>Systematic Feature Suite</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: 800, margin: '0 auto' }}>
            AlphaLab provides a modular set of tools designed for professional-grade quantitative analysis.
          </p>
        </div>

        <div className="bento-grid">
          {features.map((f, i) => (
            <div key={i} className={`feature-card reveal-on-scroll delay-${(i % 3) * 100 + 100}`}>
              <div className="feature-icon-wrapper">
                {React.cloneElement(f.icon as React.ReactElement, { style: { fontSize: 28, color: '#1890ff' } })}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 120 }} className="reveal-on-scroll">
          <div style={{ background: 'rgba(24,144,255,0.05)', padding: '60px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: 900, margin: '0 auto' }}>
            <h3 style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>Ready to experience these features?</h3>
            <p style={{ color: '#94a3b8', fontSize: '1.15rem', marginBottom: 40 }}>Start building your systematic edge with AlphaLab today.</p>
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 60px', fontSize: '1.2rem' }}>
              Get Started Now <ArrowRightOutlined />
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Features;
