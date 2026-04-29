import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Form, Input, Select, Space, Tag, message, Divider, Row, Col } from 'antd';
import {
  ArrowLeftOutlined, CloudServerOutlined, ApiOutlined, RobotOutlined,
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, EyeInvisibleOutlined, EyeTwoTone
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import aiTradingService, { AIProviderConfig } from '../services/aiTradingService';

const { Title, Text } = Typography;
const { Option } = Select;

const Configuration: React.FC = () => {
  const navigate = useNavigate();

  // Alpaca state
  const [alpacaForm] = Form.useForm();
  const [alpacaLoading, setAlpacaLoading] = useState(false);
  const [alpacaTestLoading, setAlpacaTestLoading] = useState(false);
  const [alpacaStatus, setAlpacaStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [alpacaStatusMsg, setAlpacaStatusMsg] = useState('');

  // Finnhub state
  const [finnhubForm] = Form.useForm();
  const [finnhubLoading, setFinnhubLoading] = useState(false);
  const [finnhubTestLoading, setFinnhubTestLoading] = useState(false);
  const [finnhubStatus, setFinnhubStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [finnhubStatusMsg, setFinnhubStatusMsg] = useState('');

  // AI state
  const [aiForm] = Form.useForm();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [aiStatusMsg, setAiStatusMsg] = useState('');

  // Load all configs on mount
  useEffect(() => {
    loadAlpacaConfig();
    loadFinnhubConfig();
    loadAiConfig();
  }, []);

  // ===== Alpaca =====
  const loadAlpacaConfig = async () => {
    try {
      const res = await api.get('/config/alpaca');
      if (res.data.success) {
        const c = res.data.config;
        alpacaForm.setFieldsValue({
          environment: c.environment || 'paper',
          paperApiKey: c.paperApiKey || '',
          paperApiSecret: c.paperApiSecret || '',
          liveApiKey: c.liveApiKey || '',
          liveApiSecret: c.liveApiSecret || '',
          tradingBaseUrl: c.tradingBaseUrl || '',
          dataBaseUrl: c.dataBaseUrl || 'https://data.alpaca.markets',
        });
      }
    } catch (e) {
      console.error('Failed to load Alpaca config:', e);
    }
  };

  const handleSaveAlpaca = async () => {
    setAlpacaLoading(true);
    try {
      const values = await alpacaForm.validateFields();
      const res = await api.post('/config/alpaca', values);
      if (res.data.success) {
        message.success('Alpaca configuration saved');
        setAlpacaStatus('idle');
      } else {
        message.error('Failed to save Alpaca config');
      }
    } catch (e: any) {
      message.error('Failed to save: ' + (e.message || 'Error'));
    } finally {
      setAlpacaLoading(false);
    }
  };

  const handleTestAlpaca = async () => {
    setAlpacaTestLoading(true);
    setAlpacaStatus('idle');
    try {
      const values = alpacaForm.getFieldsValue();
      const res = await api.post('/config/alpaca/test', values);
      if (res.data.success) {
        setAlpacaStatus('ok');
        setAlpacaStatusMsg(res.data.message);
        message.success(res.data.message);
      } else {
        setAlpacaStatus('error');
        setAlpacaStatusMsg(res.data.message);
        message.error(res.data.message);
      }
    } catch (e: any) {
      setAlpacaStatus('error');
      const msg = e.response?.data?.message || e.message || 'Connection failed';
      setAlpacaStatusMsg(msg);
      message.error(msg);
    } finally {
      setAlpacaTestLoading(false);
    }
  };

  // ===== Finnhub =====
  const loadFinnhubConfig = async () => {
    try {
      const res = await api.get('/config/finnhub');
      if (res.data.success) {
        const c = res.data.config;
        finnhubForm.setFieldsValue({
          apiKey: c.apiKey || '',
          baseUrl: c.baseUrl || 'https://finnhub.io/api/v1',
        });
      }
    } catch (e) {
      console.error('Failed to load Finnhub config:', e);
    }
  };

  const handleSaveFinnhub = async () => {
    setFinnhubLoading(true);
    try {
      const values = await finnhubForm.validateFields();
      const res = await api.post('/config/finnhub', values);
      if (res.data.success) {
        message.success('Finnhub configuration saved');
        setFinnhubStatus('idle');
      } else {
        message.error('Failed to save Finnhub config');
      }
    } catch (e: any) {
      message.error('Failed to save: ' + (e.message || 'Error'));
    } finally {
      setFinnhubLoading(false);
    }
  };

  const handleTestFinnhub = async () => {
    setFinnhubTestLoading(true);
    setFinnhubStatus('idle');
    try {
      const values = finnhubForm.getFieldsValue();
      const res = await api.post('/config/finnhub/test', values);
      if (res.data.success) {
        setFinnhubStatus('ok');
        setFinnhubStatusMsg(res.data.message);
        message.success(res.data.message);
      } else {
        setFinnhubStatus('error');
        setFinnhubStatusMsg(res.data.message);
        message.error(res.data.message);
      }
    } catch (e: any) {
      setFinnhubStatus('error');
      const msg = e.response?.data?.message || e.message || 'Connection failed';
      setFinnhubStatusMsg(msg);
      message.error(msg);
    } finally {
      setFinnhubTestLoading(false);
    }
  };

  // ===== AI Provider =====
  const loadAiConfig = async () => {
    try {
      const res = await aiTradingService.getProviderConfig();
      if (res.success && res.config) {
        const c = res.config;
        aiForm.setFieldsValue({
          provider: c.provider || 'DeepSeek',
          model: c.model || 'deepseek-chat',
          apiKey: c.apiKey || '',
          baseUrl: c.baseUrl || 'https://api.deepseek.com',
        });
      }
    } catch (e) {
      console.error('Failed to load AI config:', e);
    }
  };

  const handleSaveAi = async () => {
    setAiLoading(true);
    try {
      const values = await aiForm.validateFields();
      const config: AIProviderConfig = {
        provider: values.provider || 'DeepSeek',
        model: values.model || 'deepseek-chat',
        apiKey: values.apiKey || '',
        baseUrl: values.baseUrl || 'https://api.deepseek.com',
      };
      const res = await aiTradingService.saveProviderConfig(config);
      if (res.success) {
        message.success('AI provider configuration saved');
        setAiStatus('idle');
      } else {
        message.error('Failed to save AI config');
      }
    } catch (e: any) {
      message.error('Failed to save: ' + (e.message || 'Error'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleTestAi = async () => {
    setAiTestLoading(true);
    setAiStatus('idle');
    try {
      const values = await aiForm.validateFields();
      const res = await aiTradingService.testProviderConnection(values);
      if (res.success) {
        setAiStatus('ok');
        setAiStatusMsg(res.message || 'Connection successful');
        message.success(res.message || 'AI connection successful');
      } else {
        setAiStatus('error');
        setAiStatusMsg(res.message || 'Connection failed');
        message.error(res.message || 'AI connection failed');
      }
    } catch (e: any) {
      setAiStatus('error');
      const msg = e.message || 'Connection failed';
      setAiStatusMsg(msg);
      message.error(msg);
    } finally {
      setAiTestLoading(false);
    }
  };

  const StatusBadge = ({ status, msg }: { status: 'idle' | 'ok' | 'error'; msg: string }) => {
    if (status === 'idle') return null;
    return (
      <Tag
        icon={status === 'ok' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        color={status === 'ok' ? 'success' : 'error'}
        style={{ marginTop: 8 }}
      >
        {msg}
      </Tag>
    );
  };

  const cardStyle = { marginBottom: 20 };
  const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, marginBottom: 4 };
  const sectionDescStyle: React.CSSProperties = { fontSize: 12, color: '#888', marginBottom: 16 };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/settings')} />
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>Configuration</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Manage API connections for Alpaca, Finnhub, and AI providers.</Text>
        </div>
      </div>

      {/* A. Alpaca API Configuration */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <CloudServerOutlined style={{ fontSize: 18, color: '#1890ff' }} />
          <span style={sectionTitleStyle}>Alpaca API Configuration</span>
          <StatusBadge status={alpacaStatus} msg={alpacaStatusMsg} />
        </div>
        <div style={sectionDescStyle}>Trading and market data API settings for Alpaca.</div>

        <Form form={alpacaForm} layout="vertical" onFinish={handleSaveAlpaca} initialValues={{ environment: 'paper' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="environment" label="Default Trading Mode">
                <Select>
                  <Option value="paper">Paper Trading</Option>
                  <Option value="live">Real Trading</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tradingBaseUrl" label="Trading Base URL">
                <Input placeholder="https://paper-api.alpaca.markets" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dataBaseUrl" label="Market Data Base URL">
                <Input placeholder="https://data.alpaca.markets" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ fontSize: 12, margin: '12px 0' }}>Paper Trading Keys</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="paperApiKey" label="Paper API Key">
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Paper API Key" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="paperApiSecret" label="Paper Secret Key">
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Paper Secret Key" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ fontSize: 12, margin: '12px 0' }}>Live Trading Keys</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="liveApiKey" label="Live API Key">
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Live API Key" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="liveApiSecret" label="Live Secret Key">
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Live Secret Key" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleTestAlpaca} loading={alpacaTestLoading} icon={<CheckCircleOutlined />}>
              Test Connection
            </Button>
            <Button type="primary" htmlType="submit" loading={alpacaLoading}>
              Save Alpaca Settings
            </Button>
          </div>
        </Form>
      </Card>

      {/* B. Finnhub API Configuration */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ApiOutlined style={{ fontSize: 18, color: '#52c41a' }} />
          <span style={sectionTitleStyle}>Finnhub API Configuration</span>
          <StatusBadge status={finnhubStatus} msg={finnhubStatusMsg} />
        </div>
        <div style={sectionDescStyle}>Market data fallback for company profiles, news, and scanner.</div>

        <Form form={finnhubForm} layout="vertical" onFinish={handleSaveFinnhub}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="apiKey" label="Finnhub API Key" rules={[{ required: true, message: 'API key is required' }]}>
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Finnhub API Key" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="baseUrl" label="Base URL">
                <Input placeholder="https://finnhub.io/api/v1" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleTestFinnhub} loading={finnhubTestLoading} icon={<CheckCircleOutlined />}>
              Test Connection
            </Button>
            <Button type="primary" htmlType="submit" loading={finnhubLoading}>
              Save Finnhub Settings
            </Button>
          </div>
        </Form>
      </Card>

      {/* C. AI Provider Configuration */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <RobotOutlined style={{ fontSize: 18, color: '#722ed1' }} />
          <span style={sectionTitleStyle}>AI Provider Configuration</span>
          <StatusBadge status={aiStatus} msg={aiStatusMsg} />
        </div>
        <div style={sectionDescStyle}>AI provider for analysis, decisions, and entry plan generation.</div>

        <Form form={aiForm} layout="vertical" onFinish={handleSaveAi} initialValues={{ provider: 'DeepSeek', model: 'deepseek-chat' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="provider" label="AI Provider" rules={[{ required: true }]}>
                <Select onChange={(v) => {
                  const m: Record<string, string> = { DeepSeek: 'deepseek-chat', OpenAI: 'gpt-4', Claude: 'claude-3-opus' };
                  if (m[v]) aiForm.setFieldsValue({ model: m[v] });
                }}>
                  <Option value="DeepSeek">DeepSeek</Option>
                  <Option value="OpenAI">OpenAI</Option>
                  <Option value="Claude">Claude</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model" label="Model" rules={[{ required: true }]}>
                <Select>
                  <Option value="deepseek-chat">deepseek-chat</Option>
                  <Option value="deepseek-coder">deepseek-coder</Option>
                  <Option value="gpt-4">GPT-4</Option>
                  <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                  <Option value="claude-3-opus">Claude 3 Opus</Option>
                  <Option value="claude-3-sonnet">Claude 3 Sonnet</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true }]}>
                <Input placeholder="https://api.deepseek.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: 'API key is required' }]}>
                <Input.Password iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} placeholder="Enter your API key" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleTestAi} loading={aiTestLoading} icon={<CheckCircleOutlined />}>
              Test Connection
            </Button>
            <Button type="primary" htmlType="submit" loading={aiLoading}>
              Save AI Settings
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Configuration;
