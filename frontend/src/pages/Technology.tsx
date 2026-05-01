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
import MarketingLayout from '../components/MarketingLayout';

const Technology: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const techStack = [
    {
      icon: <DesktopOutlined />,
      title: 'Frontend: React & TypeScript',
      desc: 'High-density trading interface built for performance and type-safety. Leverages Ant Design for professional components.',
      category: 'Client'
    },
    {
      icon: <CloudServerOutlined />,
      title: 'Backend: Python & Flask',
      desc: 'Asynchronous engine for market data processing and quantitative calculations. High-concurrency ready.',
      category: 'Server'
    },
    {
      icon: <DatabaseOutlined />,
      title: 'Market Data Hub',
      desc: 'Deep integration with institutional data providers (Finnhub) for real-time and historical tick data.',
      category: 'Data Layer'
    },
    {
      icon: <ApiOutlined />,
      title: 'Alpaca Connectivity',
      desc: 'Direct pipeline to Alpaca Markets for low-latency paper trading and live execution routing.',
      category: 'Execution'
    },
    {
      icon: <NodeIndexOutlined />,
      title: 'Multi-LLM Pipeline',
      desc: 'Universal adapter for OpenAI, Claude, and DeepSeek. Specialized prompt engineering for structural audit.',
      category: 'Intelligence'
    },
    {
      icon: <BarChartOutlined />,
      title: 'Quant Core Engine',
      desc: 'Vectorized backtesting and strategy evaluation system designed for rapid hypothesis validation.',
      category: 'Quant'
    },
    {
      icon: <PartitionOutlined />,
      title: 'Validation Pipeline',
      desc: 'Multi-stage decision logic that aggregates technical, sentiment, and structural scores into a final signal.',
      category: 'Logic'
    },
    {
      icon: <SafetyOutlined />,
      title: 'Account-Aware Sizing',
      desc: 'Dynamic position sizing that reads live account equity to calculate exact unit risk per trade.',
      category: 'Risk'
    },
    {
      icon: <LockOutlined />,
      title: 'Secure Secret Management',
      desc: 'Users configure their own provider keys. Logic is built to ensure API secrets are never committed to public source control.',
      category: 'Security'
    },
    {
      icon: <SecurityScanOutlined />,
      title: 'Docker Orchestration',
      desc: 'Fully containerized environment ensuring identical execution across development, testing, and production.',
      category: 'DevOps'
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
        <h1 className="page-title reveal-on-scroll">Built for Scale & Extensibility</h1>
        <p className="page-subtitle reveal-on-scroll delay-100">
          AlphaLab is powered by a modern tech stack engineered for high-performance quantitative analysis, seamless API integrations, and extensible multi-LLM architecture.
        </p>
      </div>

      <section className="section-container" style={{ paddingTop: 0, paddingBottom: 100 }}>
        {/* Architecture Diagram Concept */}
        <div className="architecture-concept reveal-on-scroll">
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 24 }}>System Architecture</h2>
          <Row gutter={[32, 32]} align="middle" justify="center">
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(24,144,255,0.1)', borderRadius: 16, border: '1px dashed rgba(24,144,255,0.3)' }}>
                <h4 style={{ color: '#1890ff', margin: 0 }}>Market Feeds</h4>
              </div>
            </Col>
            <Col xs={24} md={1}>
              <ArrowRightOutlined style={{ color: '#475569', fontSize: 20 }} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(114,46,209,0.1)', borderRadius: 16, border: '1px solid rgba(114,46,209,0.3)' }}>
                <h4 style={{ color: '#722ed1', margin: 0 }}>AI Validation Core</h4>
              </div>
            </Col>
            <Col xs={24} md={1}>
              <ArrowRightOutlined style={{ color: '#475569', fontSize: 20 }} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ padding: 20, background: 'rgba(73,170,25,0.1)', borderRadius: 16, border: '1px dashed rgba(73,170,25,0.3)' }}>
                <h4 style={{ color: '#49aa19', margin: 0 }}>Broker API</h4>
              </div>
            </Col>
          </Row>
          <p style={{ color: '#64748b', marginTop: 40, maxWidth: 600, margin: '40px auto 0' }}>
            A decoupled, modular approach where data ingestion, intelligence validation, and execution logic are separated for maximum stability.
          </p>
        </div>

        <Row gutter={[24, 24]}>
          {techStack.map((tech, i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <div className={`tech-card reveal-on-scroll delay-${(i % 3) * 100 + 100}`}>
                <div className="tech-category">{tech.category}</div>
                <div className="tech-icon">{tech.icon}</div>
                <h4 className="tech-title">{tech.title}</h4>
                <p className="tech-desc">{tech.desc}</p>
              </div>
            </Col>
          ))}
        </Row>
        
        <div style={{ textAlign: 'center', marginTop: 120 }} className="reveal-on-scroll">
          <h3 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: 24 }}>Ready to leverage our stack?</h3>
          <Button type="primary" className="btn-primary" onClick={() => navigate('/signup')}>
            Get Started Now <ArrowRightOutlined />
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Technology;
