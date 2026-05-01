import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Divider, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const About: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 24 }}>Back to Home</Button>

        <Title>What is AlphaLab?</Title>
        <Paragraph>
          AlphaLab is an AI-powered quantitative trading and market analysis platform.
          It combines technical analysis, backtesting, and AI-driven insights to help traders
          make data-driven decisions.
        </Paragraph>

        <Divider />

        <Title level={2}>AI Trading Workflow</Title>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
          <Paragraph>
            <Text strong>1. Market Scanner</Text> — Screen stocks across multiple sectors using technical indicators and strategy matching.
          </Paragraph>
          <Paragraph>
            <Text strong>2. Preferred Continue Scan</Text> — AI selects the most promising candidates from the scan results.
          </Paragraph>
          <Paragraph>
            <Text strong>3. Fine Scan</Text> — Deep analysis of selected stocks including liquidity, news sentiment, and risk assessment.
          </Paragraph>
          <Paragraph>
            <Text strong>4. Deeper Validation</Text> — AI verdict on whether each candidate is worth trading based on comprehensive data.
          </Paragraph>
          <Paragraph>
            <Text strong>5. Entry Plan</Text> — Deterministic entry price, stop-loss, and target calculation with position sizing.
          </Paragraph>
          <Paragraph>
            <Text strong>6. AI Watchlist</Text> — Continuous monitoring of approved trades with AI-driven recommendations.
          </Paragraph>
        </div>

        <Divider />

        <Title level={2}>Paper Trading vs Real Trading</Title>
        <Paragraph>
          AlphaLab supports both paper trading (simulated) and real trading via Alpaca Markets.
          Paper trading uses real market data but executes orders in a simulated environment.
          Real trading connects to Alpaca's live API for actual order execution.
        </Paragraph>

        <Divider />

        <Title level={2}>API Configuration</Title>
        <Paragraph>
          AlphaLab requires API keys for market data (Finnhub), trading (Alpaca), and AI analysis (DeepSeek/OpenAI/NVIDIA NIM).
          All keys are configured through the Settings page and stored securely on the backend.
          No API keys are exposed to the frontend.
        </Paragraph>

        <Divider />

        <Title level={2}>Risk Control Philosophy</Title>
        <Paragraph>
          AlphaLab enforces strict risk controls at every stage:
        </Paragraph>
        <ul style={{ lineHeight: 2 }}>
          <li>Position sizing based on account equity and risk per trade</li>
          <li>Maximum position concentration limits</li>
          <li>Daily loss limits</li>
          <li>AI-driven risk assessment before entry</li>
          <li>Backtesting validation before live execution</li>
        </ul>

        <Divider />

        <Title level={2}>Disclaimer</Title>
        <Paragraph type="warning">
          AlphaLab is a research and analysis tool. Nothing on this platform constitutes financial advice.
          Past performance does not guarantee future results. Trading stocks involves risk of capital loss.
          Always conduct your own research and consult a qualified financial advisor before making investment decisions.
          The creators of AlphaLab are not responsible for any losses incurred from using this platform.
        </Paragraph>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Space>
            <Button type="primary" onClick={() => navigate('/login')}>Get Started</Button>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default About;
