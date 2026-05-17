import React, { useEffect, useState } from 'react';
import { Row, Col, Button } from 'antd';
import { 
  GlobalOutlined, RobotOutlined, 
  AimOutlined, ArrowRightOutlined, SafetyOutlined, SearchOutlined,
  FilterOutlined, DeploymentUnitOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import RevealSection from '../components/RevealSection';

const workflowSteps = [
  {
    id: 'market-scan',
    num: '01',
    title: 'Market Scanner',
    status: 'Global Scan',
    desc: 'Broad spectrum analysis across thousands of equities.',
    icon: <GlobalOutlined aria-hidden="true" />,
    details: {
      purpose: 'Continuously monitors over 8,000+ assets to identify technical anomalies, liquidity spikes, and emerging trends.',
      inputs: 'Real-time price data, volume profiles, institutional flow indicators.',
      outputs: 'Broad list of potential candidates meeting baseline volatility and liquidity criteria.',
      risk: 'Filters out "dead" stocks and low-liquidity traps at the source.'
    }
  },
  {
    id: 'continue-scan',
    num: '02',
    title: 'Continue Scan',
    status: 'Monitoring',
    desc: 'Persistent tracking of candidates for structural maturity.',
    icon: <SearchOutlined aria-hidden="true" />,
    details: {
      purpose: 'Maintains a state-aware buffer of candidates, waiting for specific price action triggers or technical confirmations.',
      inputs: 'Time-series technical data, historical support/resistance levels.',
      outputs: 'High-probability setups entering the "hot" zone.',
      risk: 'Prevents premature entries by requiring multi-candle confirmation.'
    }
  },
  {
    id: 'fine-scan',
    num: '03',
    title: 'Fine Scan',
    status: 'Refinement',
    desc: 'Surgical filtering for high-precision technical structures.',
    icon: <FilterOutlined aria-hidden="true" />,
    details: {
      purpose: 'Applies complex multi-factor filters to detect early multi-timeframe structures like base breaks or mean reversions.',
      inputs: 'Multi-timeframe charts (1H, 4H, Daily), volatility contraction factors.',
      outputs: 'Shortlist of "Trade-Ready" candidates for AI audit.',
      risk: 'Eliminates over-extended or low-probability technical patterns.'
    }
  },
  {
    id: 'validate',
    num: '04',
    title: 'Deeper Validation',
    status: 'AI Audit',
    desc: 'Deep AI reasoning to review context and setup quality.',
    icon: <RobotOutlined aria-hidden="true" />,
    details: {
      purpose: 'Deploys specialized LLM agents to act as expert analysts, reviewing market structure context and potential catalysts.',
      inputs: 'Detailed technical data, recent news, sector sentiment.',
      outputs: 'AI Confidence Score and comprehensive reasoning report.',
      risk: 'Filters out technical false positives and sentiment traps.'
    }
  },
  {
    id: 'plan',
    num: '05',
    title: 'Entry Plan',
    status: 'Planning',
    desc: 'Generate deterministic execution levels and sizing.',
    icon: <AimOutlined aria-hidden="true" />,
    details: {
      purpose: 'Calculates precise limit entry zones, trailing stops, and profit targets based on volatility and account metrics.',
      inputs: 'Average True Range (ATR), account balance, risk preference.',
      outputs: 'Complete execution-ready trade plan with 1:2.5+ RR ratio.',
      risk: 'Enforces strict 1% account risk per trade via position sizing.'
    }
  },
  {
    id: 'execute',
    num: '06',
    title: 'Watchlist / Execution',
    status: 'Execution',
    desc: 'Final routing to watchlist or live broker execution.',
    icon: <DeploymentUnitOutlined aria-hidden="true" />,
    details: {
      purpose: 'Transitions validated plans into active monitoring or direct execution via Alpaca Markets API.',
      inputs: 'Finalized trade plan, API credentials.',
      outputs: 'Live or paper trade execution with automated management.',
      risk: 'Real-time slippage protection and margin requirements check.'
    }
  }
];

const Workflow: React.FC = () => {
  const navigate = useNavigate();
  const [activeWorkflow, setActiveWorkflow] = useState(workflowSteps[0]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <MarketingLayout>
      <style>{`
        .workflow-board-card {
          background: rgba(17,25,40,0.4);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: clamp(16px, 2vw, 20px);
          display: flex;
          align-items: center;
          gap: clamp(12px, 2vw, 20px);
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .workflow-board-card:hover, .workflow-board-card.active {
          background: rgba(24,144,255,0.05);
          border-color: rgba(24,144,255,0.3);
          transform: translateX(10px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        @media (max-width: 768px) {
          .workflow-board-card:hover, .workflow-board-card.active {
            transform: translateY(-5px);
          }
        }
        .workflow-board-card.active {
          border-left: 4px solid #1890ff;
          background: rgba(24,144,255,0.1);
        }
        .wf-card-icon {
          width: clamp(48px, 6vw, 56px); 
          height: clamp(48px, 6vw, 56px);
          border-radius: 14px;
          background: rgba(2,6,17,0.8);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; justify-content: center; align-items: center;
          font-size: clamp(20px, 3vw, 24px); color: #94a3b8;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .workflow-board-card:hover .wf-card-icon, .workflow-board-card.active .wf-card-icon {
          color: #1890ff;
          border-color: #1890ff;
          box-shadow: 0 0 20px rgba(24,144,255,0.3);
          transform: scale(1.05);
        }
        .wf-card-content { flex: 1; text-align: left; }
        .wf-status-chip {
          font-size: clamp(0.65rem, 1vw, 0.75rem);
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        .workflow-board-card.active .wf-status-chip {
          background: rgba(24,144,255,0.15);
          color: #1890ff;
          border: 1px solid rgba(24,144,255,0.3);
        }
  
        .workflow-preview-panel {
          background: linear-gradient(145deg, rgba(17,25,40,0.6) 0%, rgba(11,21,41,0.4) 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: clamp(24px, 4vw, 48px);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          height: 100%;
          display: flex;
          flex-direction: column;
          text-align: left;
          position: sticky;
          top: 120px;
        }
        .wf-preview-header {
          display: flex; align-items: center; gap: clamp(12px, 3vw, 24px);
          margin-bottom: clamp(24px, 4vw, 32px);
          padding-bottom: clamp(16px, 3vw, 24px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap;
        }
        .wf-preview-icon {
          width: clamp(60px, 8vw, 80px); 
          height: clamp(60px, 8vw, 80px);
          border-radius: 20px;
          background: rgba(24,144,255,0.1);
          border: 1px solid rgba(24,144,255,0.3);
          display: flex; justify-content: center; align-items: center;
          font-size: clamp(28px, 4vw, 36px); color: #1890ff;
          box-shadow: 0 0 30px rgba(24,144,255,0.2);
          flex-shrink: 0;
        }
        .wf-detail-group { margin-bottom: 24px; }
        .wf-detail-label { color: #64748b; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700; }
        .wf-detail-text { color: #e2e8f0; font-size: 1.1rem; line-height: 1.6; }
        
        .wf-detail-box {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
          height: 100%;
        }
        .wf-box-label { color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700; }
        .wf-box-text { color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; }
        
        .wf-risk-box {
          margin-top: auto;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: rgba(73,170,25,0.05);
          border: 1px solid rgba(73,170,25,0.2);
          padding: 24px;
          border-radius: 16px;
          margin-top: 32px;
        }
      `}</style>

      <div className="page-hero">
        <RevealSection>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(114,46,209,0.1)', borderRadius: 20, border: '1px solid rgba(114,46,209,0.3)', color: '#b37feb', fontSize: '0.85rem', fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>
            <DeploymentUnitOutlined aria-hidden="true" /> CORE WORKFLOW
          </div>
        </RevealSection>
        <RevealSection delay={0.1}>
          <h1 className="page-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            The Systematic <span style={{ background: 'linear-gradient(90deg, #1890ff, #722ed1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Pipeline</span>
          </h1>
        </RevealSection>
        <RevealSection delay={0.2}>
          <p className="page-subtitle">
            AlphaLab orchestrates a rigorous algorithmic workflow. We filter out noise, validate hypotheses objectively, and enforce strict risk management before execution.
          </p>
        </RevealSection>
      </div>

      <section className="section-container" style={{ paddingTop: 20, paddingBottom: 100 }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 8vw, 60px)' }}>
            <h2 className="section-title">Discovery to Execution</h2>
            <p className="section-subtitle">
              Interactive breakdown of the AlphaLab end-to-end quantitative research and trading pipeline.
            </p>
          </div>
        </RevealSection>

        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={11}>
              <RevealSection delay={0.1}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {workflowSteps.map(step => (
                    <div 
                      key={step.id}
                      className={`workflow-board-card ${activeWorkflow.id === step.id ? 'active' : ''}`}
                      onMouseEnter={() => setActiveWorkflow(step)}
                      onClick={() => setActiveWorkflow(step)}
                    >
                      <div className="wf-card-icon">{step.icon}</div>
                      <div className="wf-card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <h4 style={{ margin: 0, color: '#fff', fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', fontWeight: 700 }}>{step.num}. {step.title}</h4>
                          <span className="wf-status-chip">{step.status}</span>
                        </div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)', lineHeight: 1.5 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RevealSection>
            </Col>
            
            <Col xs={24} lg={13}>
              <RevealSection delay={0.2} style={{ height: '100%' }}>
                <div className="workflow-preview-panel">
                   <div className="wf-preview-header">
                     <div className="wf-preview-icon">{activeWorkflow.icon}</div>
                     <div>
                       <div style={{ color: '#1890ff', fontSize: '0.85rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PHASE {activeWorkflow.num}</div>
                       <h3 style={{ color: '#fff', fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', margin: 0, fontWeight: 800 }}>{activeWorkflow.title}</h3>
                     </div>
                   </div>
                   
                   <div className="wf-preview-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                     <div className="wf-detail-group">
                       <div className="wf-detail-label">Purpose</div>
                       <div className="wf-detail-text">{activeWorkflow.details.purpose}</div>
                     </div>
                     
                     <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                       <Col xs={24} sm={12}>
                         <div className="wf-detail-box">
                           <div className="wf-box-label">Inputs</div>
                           <div className="wf-box-text">{activeWorkflow.details.inputs}</div>
                         </div>
                       </Col>
                       <Col xs={24} sm={12}>
                         <div className="wf-detail-box">
                           <div className="wf-box-label">Outputs</div>
                           <div className="wf-box-text">{activeWorkflow.details.outputs}</div>
                         </div>
                       </Col>
                     </Row>
                     
                     <div className="wf-risk-box">
                       <SafetyOutlined aria-hidden="true" style={{ color: '#49aa19', fontSize: 24, marginTop: 4 }} />
                       <div>
                         <div style={{ color: '#49aa19', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 4 }}>Risk Check</div>
                         <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.5 }}>{activeWorkflow.details.risk}</div>
                       </div>
                     </div>
                   </div>
                </div>
              </RevealSection>
            </Col>
          </Row>
        </div>
        
        <RevealSection>
          <div style={{ textAlign: 'center', marginTop: 'clamp(60px, 10vw, 120px)' }}>
            <h3 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>Ready to experience the platform?</h3>
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 40px', fontSize: '1.2rem' }}>
              Get Started Now <ArrowRightOutlined aria-hidden="true" />
            </Button>
          </div>
        </RevealSection>
      </section>
    </MarketingLayout>
  );
};

export default Workflow;
