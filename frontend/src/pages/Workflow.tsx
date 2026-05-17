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
import { useLanguage } from '../contexts/LanguageContext';

const Workflow: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const workflowSteps = [
    {
      id: 'market-scan',
      num: '01',
      title: t.workflow.step1Title,
      status: t.workflow.step1Status,
      desc: t.workflow.step1Desc,
      icon: <GlobalOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step1Purpose,
        inputs: t.workflow.step1Inputs,
        outputs: t.workflow.step1Outputs,
        risk: t.workflow.step1Risk
      }
    },
    {
      id: 'continue-scan',
      num: '02',
      title: t.workflow.step2Title,
      status: t.workflow.step2Status,
      desc: t.workflow.step2Desc,
      icon: <SearchOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step2Purpose,
        inputs: t.workflow.step2Inputs,
        outputs: t.workflow.step2Outputs,
        risk: t.workflow.step2Risk
      }
    },
    {
      id: 'fine-scan',
      num: '03',
      title: t.workflow.step3Title,
      status: t.workflow.step3Status,
      desc: t.workflow.step3Desc,
      icon: <FilterOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step3Purpose,
        inputs: t.workflow.step3Inputs,
        outputs: t.workflow.step3Outputs,
        risk: t.workflow.step3Risk
      }
    },
    {
      id: 'validate',
      num: '04',
      title: t.workflow.step4Title,
      status: t.workflow.step4Status,
      desc: t.workflow.step4Desc,
      icon: <RobotOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step4Purpose,
        inputs: t.workflow.step4Inputs,
        outputs: t.workflow.step4Outputs,
        risk: t.workflow.step4Risk
      }
    },
    {
      id: 'plan',
      num: '05',
      title: t.workflow.step5Title,
      status: t.workflow.step5Status,
      desc: t.workflow.step5Desc,
      icon: <AimOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step5Purpose,
        inputs: t.workflow.step5Inputs,
        outputs: t.workflow.step5Outputs,
        risk: t.workflow.step5Risk
      }
    },
    {
      id: 'execute',
      num: '06',
      title: t.workflow.step6Title,
      status: t.workflow.step6Status,
      desc: t.workflow.step6Desc,
      icon: <DeploymentUnitOutlined aria-hidden="true" />,
      details: {
        purpose: t.workflow.step6Purpose,
        inputs: t.workflow.step6Inputs,
        outputs: t.workflow.step6Outputs,
        risk: t.workflow.step6Risk
      }
    }
  ];

  const [activeWorkflow, setActiveWorkflow] = useState(workflowSteps[0]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // When language changes, update the active workflow to use translated strings
    const currentId = activeWorkflow.id;
    const updatedStep = workflowSteps.find(s => s.id === currentId);
    if (updatedStep) setActiveWorkflow(updatedStep);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

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
          transition: transform 220ms ease, background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
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
            <DeploymentUnitOutlined aria-hidden="true" /> {t.workflow.coreWorkflow}
          </div>
        </RevealSection>
        <RevealSection delay={0.1}>
          <h1 className="page-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }} dangerouslySetInnerHTML={{ __html: t.workflow.heroTitle }} />
        </RevealSection>
        <RevealSection delay={0.2}>
          <p className="page-subtitle">
            {t.workflow.heroSubtitle}
          </p>
        </RevealSection>
      </div>

      <section className="section-container" style={{ paddingTop: 20, paddingBottom: 100 }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 8vw, 60px)' }}>
            <h2 className="section-title">{t.workflow.sectionTitle}</h2>
            <p className="section-subtitle">
              {t.workflow.sectionSubtitle}
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
                       <div style={{ color: '#1890ff', fontSize: '0.85rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{t.workflow.phaseLabel} {activeWorkflow.num}</div>
                       <h3 style={{ color: '#fff', fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', margin: 0, fontWeight: 800 }}>{activeWorkflow.title}</h3>
                     </div>
                   </div>
                   
                   <div className="wf-preview-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                     <div className="wf-detail-group">
                       <div className="wf-detail-label">{t.workflow.purposeLabel}</div>
                       <div className="wf-detail-text">{activeWorkflow.details.purpose}</div>
                     </div>
                     
                     <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                       <Col xs={24} sm={12}>
                         <div className="wf-detail-box">
                           <div className="wf-box-label">{t.workflow.inputsLabel}</div>
                           <div className="wf-box-text">{activeWorkflow.details.inputs}</div>
                         </div>
                       </Col>
                       <Col xs={24} sm={12}>
                         <div className="wf-detail-box">
                           <div className="wf-box-label">{t.workflow.outputsLabel}</div>
                           <div className="wf-box-text">{activeWorkflow.details.outputs}</div>
                         </div>
                       </Col>
                     </Row>
                     
                     <div className="wf-risk-box">
                       <SafetyOutlined aria-hidden="true" style={{ color: '#49aa19', fontSize: 24, marginTop: 4 }} />
                       <div>
                         <div style={{ color: '#49aa19', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 4 }}>{t.workflow.riskCheckLabel}</div>
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
            <h3 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>{t.workflow.readyTitle}</h3>
            <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')} style={{ height: 56, padding: '0 40px', fontSize: '1.2rem' }}>
              {t.workflow.getStarted} <ArrowRightOutlined aria-hidden="true" />
            </Button>
          </div>
        </RevealSection>
      </section>
    </MarketingLayout>
  );
};

export default Workflow;