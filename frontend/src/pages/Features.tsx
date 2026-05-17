import React, { useEffect } from 'react';
import { Button, Row, Col } from 'antd';
import {
  RobotOutlined, AimOutlined,
  BarChartOutlined, RocketOutlined, SafetyOutlined,
  ArrowRightOutlined, InfoCircleOutlined,
  SearchOutlined, FilterOutlined, DeploymentUnitOutlined, EyeOutlined,
  InteractionOutlined, NodeIndexOutlined, GlobalOutlined, ThunderboltOutlined,
  ExperimentOutlined, CheckCircleOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import RevealSection from '../components/RevealSection';

const featureGroups = [
  {
    title: '1. Market Scanning',
    desc: 'Discover high-probability setups from a universe of thousands of equities.',
    features: [
      { icon: <GlobalOutlined aria-hidden="true" />, title: 'Real-Time Scanner', desc: 'Identify emerging trends and anomalies across thousands of equities with multi-factor technical screening.' },
      { icon: <FilterOutlined aria-hidden="true" />, title: 'Fine-Grained Filters', desc: 'Surgical filtering logic to detect early multi-timeframe structures like base breaks and mean reversions.' },
      { icon: <EyeOutlined aria-hidden="true" />, title: 'Intelligent Watchlist', desc: 'Monitor candidates with real-time tactical alerts and persistent technical score tracking.' },
    ]
  },
  {
    title: '2. AI Validation',
    desc: 'Act as your personal quantitative analyst to audit technical structures.',
    features: [
      { icon: <RobotOutlined aria-hidden="true" />, title: 'LLM Context Audit', desc: 'Deploy specialized AI models to audit market structure context and sentiment, eliminating technical false positives.' },
      { icon: <NodeIndexOutlined aria-hidden="true" />, title: 'Multi-Provider Routing', desc: 'Provider-agnostic architecture compatible with OpenAI, DeepSeek, Claude, and local LLM configurations.' },
      { icon: <SearchOutlined aria-hidden="true" />, title: 'Autonomous Verification', desc: 'Autonomous intelligence that orchestrates the entire research and verification workflow before you see it.' },
    ]
  },
  {
    title: '3. Backtesting & Optimization',
    desc: 'Validate hypotheses against historical data before risking capital.',
    features: [
      { icon: <BarChartOutlined aria-hidden="true" />, title: 'Institutional Backtesting', desc: 'Validate hypotheses against historical tick data with granular performance metrics and drawdown analysis.' },
      { icon: <RocketOutlined aria-hidden="true" />, title: 'Parameter Optimization', desc: 'Leverage quantitative algorithms to fine-tune strategy parameters for maximum alpha and minimum risk.' },
      { icon: <InteractionOutlined aria-hidden="true" />, title: 'Strategy Comparison', desc: 'Side-by-side performance benchmarking of multiple quantitative models to identify the most robust setups.' },
    ]
  },
  {
    title: '4. Entry Planning & Risk Controls',
    desc: 'Generate deterministic execution levels and enforce strict risk management.',
    features: [
      { icon: <AimOutlined aria-hidden="true" />, title: 'Deterministic Entry', desc: 'Deterministic generation of entry zones, trailing stops, and profit targets.' },
      { icon: <SafetyCertificateOutlined aria-hidden="true" />, title: 'Position Sizing', desc: 'Account-aware sizing ensuring you never risk more than 1% of equity per trade.' },
      { icon: <SafetyOutlined aria-hidden="true" />, title: 'Risk Governance', desc: 'Hard-coded risk protocols that prevent over-exposure and enforce strict reward-to-risk thresholds on every plan.' },
    ]
  },
  {
    title: '5. Execution Workflow',
    desc: 'Seamlessly switch between testing environments and live broker routing.',
    features: [
      { icon: <ExperimentOutlined aria-hidden="true" />, title: 'Paper Trading', desc: 'Test new strategies and AI configurations in a completely risk-free simulated environment.' },
      { icon: <DeploymentUnitOutlined aria-hidden="true" />, title: 'Live Broker Integration', desc: 'Direct execution via high-performance broker API connection (e.g., Alpaca).' },
      { icon: <CheckCircleOutlined aria-hidden="true" />, title: 'Execution Monitoring', desc: 'Track live fills, slippage, and automated trailing stop adjustments in real-time.' },
    ]
  }
];

const Features: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <MarketingLayout>
      <style>{`
        .feature-card {
          background: rgba(17, 25, 40, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: clamp(24px, 3vw, 32px);
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
          width: clamp(56px, 6vw, 64px);
          height: clamp(56px, 6vw, 64px);
          border-radius: 16px;
          background: rgba(24,144,255,0.08);
          border: 1px solid rgba(24,144,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: clamp(16px, 2.5vw, 24px);
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
          font-size: clamp(1.2rem, 1.8vw, 1.4rem);
          font-weight: 700;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }
        .feature-desc {
          color: #94a3b8;
          line-height: 1.6;
          font-size: clamp(0.9rem, 1.2vw, 1rem);
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
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          grid-gap: clamp(16px, 2vw, 24px);
        }

        .feature-group-title {
          font-size: clamp(1.8rem, 3vw, 2.2rem);
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
        }
        .feature-group-desc {
          font-size: clamp(1rem, 1.5vw, 1.15rem);
          color: #94a3b8;
          margin-bottom: clamp(24px, 4vw, 40px);
        }
        .feature-group {
          margin-bottom: clamp(60px, 8vw, 100px);
          padding-top: clamp(20px, 4vw, 40px);
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .feature-group:first-of-type {
          border-top: none;
          padding-top: 0;
        }
      `}</style>

      <div className="page-hero">
        <RevealSection>
          <h1 className="page-title">Comprehensive Capabilities</h1>
        </RevealSection>
        <RevealSection delay={0.1}>
          <p className="page-subtitle">
            Everything you need to scan, validate, backtest, and execute strategies systematically without switching context.
          </p>
        </RevealSection>
      </div>

      <section className="section-container" style={{ paddingTop: 0, paddingBottom: 100 }}>
        
        <RevealSection>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px 24px', borderRadius: 100, width: 'fit-content', margin: '0 auto clamp(60px, 8vw, 100px)' }}>
            <InfoCircleOutlined aria-hidden="true" style={{ color: '#10b981' }} />
            <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 600 }}>Built for research and decision support, not financial advice.</span>
          </div>
        </RevealSection>

        {featureGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="feature-group">
            <RevealSection>
              <h2 className="feature-group-title">{group.title}</h2>
              <p className="feature-group-desc">{group.desc}</p>
            </RevealSection>
            
            <div className="bento-grid">
              {group.features.map((f, i) => (
                <RevealSection key={i} delay={i * 0.1} style={{ height: '100%' }}>
                  <div className="feature-card">
                    <div className="feature-icon-wrapper">
                      {React.cloneElement(f.icon as React.ReactElement, { style: { fontSize: 28, color: '#1890ff' } })}
                    </div>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        ))}
        
        <RevealSection>
          <div style={{ textAlign: 'center', marginTop: 'clamp(60px, 10vw, 120px)' }}>
            <div style={{ background: 'rgba(24,144,255,0.05)', padding: 'clamp(40px, 8vw, 60px)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: 900, margin: '0 auto' }}>
              <h3 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>Ready to experience these features?</h3>
              <p style={{ color: '#94a3b8', fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', marginBottom: 40 }}>Start building your systematic edge with AlphaLab today.</p>
              <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 60px', fontSize: '1.2rem' }}>
                Get Started Now <ArrowRightOutlined aria-hidden="true" />
              </Button>
            </div>
          </div>
        </RevealSection>
      </section>
    </MarketingLayout>
  );
};

export default Features;
