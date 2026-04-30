import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Form, Input, Select, Button, Space, Collapse, Tag, message, Spin, Row, Col, Divider,
} from 'antd';
import {
  SettingOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  SaveOutlined, ApiOutlined, ExperimentOutlined, BankOutlined, CloudOutlined, EyeOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

// --- Masking helper ---
const maskKey = (key: string): string => {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
};

// --- Status badge ---
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'connected') return <Tag icon={<CheckCircleOutlined />} color="success">Connected</Tag>;
  if (status === 'error') return <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>;
  return <Tag icon={<QuestionCircleOutlined />} color="default">Not tested</Tag>;
};

// =====================================================================
// Section A: Alpaca Paper Trading
// =====================================================================
const AlpacaPaperSection: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/config/alpaca').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          paper_api_key: cfg.paper_api_key_masked || '',
          paper_api_secret: cfg.paper_api_secret_masked || '',
          paper_base_url: cfg.paper_base_url || 'https://paper-api.alpaca.markets',
        });
        setHasSaved(!!cfg.paper_api_key);
        if (cfg.paper_api_key) setStatus('not_tested');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { paper_base_url: values.paper_base_url };
      if (values.paper_api_key && !values.paper_api_key.includes('****')) payload.paper_api_key = values.paper_api_key;
      if (values.paper_api_secret && !values.paper_api_secret.includes('****')) payload.paper_api_secret = values.paper_api_secret;
      const res = await api.post('/config/alpaca', payload);
      if (res.data?.success) {
        message.success('Paper trading settings saved');
        setHasSaved(true);
        // Reload masked values
        const reload = await api.get('/config/alpaca');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({
            paper_api_key: cfg.paper_api_key_masked || '',
            paper_api_secret: cfg.paper_api_secret_masked || '',
          });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return; // validation error
      message.error('Save failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/config/alpaca/test', { mode: 'paper' });
      if (res.data?.success) {
        setStatus('connected');
        message.success(`Paper connection OK — Account: ${res.data.account_id || 'N/A'}`);
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><BankOutlined />Alpaca Paper Trading</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Paper trading credentials for simulated orders and positions.</Text>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="paper_api_key" label="Paper API Key">
              <Input.Password
                placeholder={hasSaved ? 'Key saved (masked)' : 'Enter paper API key'}
                visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="paper_api_secret" label="Paper Secret Key">
              <Input.Password
                placeholder={hasSaved ? 'Secret saved (masked)' : 'Enter paper secret key'}
                visibilityToggle={{ visible: showSecret, onVisibleChange: setShowSecret }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="paper_base_url" label="Paper Trading Base URL">
              <Input placeholder="https://paper-api.alpaca.markets" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>Test Connection</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>Save Paper Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section B: Alpaca Real Trading
// =====================================================================
const AlpacaRealSection: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/config/alpaca').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          live_api_key: cfg.live_api_key_masked || '',
          live_api_secret: cfg.live_api_secret_masked || '',
          live_base_url: cfg.live_base_url || 'https://api.alpaca.markets',
        });
        setHasSaved(!!cfg.live_api_key);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { live_base_url: values.live_base_url };
      if (values.live_api_key && !values.live_api_key.includes('****')) payload.live_api_key = values.live_api_key;
      if (values.live_api_secret && !values.live_api_secret.includes('****')) payload.live_api_secret = values.live_api_secret;
      const res = await api.post('/config/alpaca', payload);
      if (res.data?.success) {
        message.success('Real trading settings saved');
        setHasSaved(true);
        const reload = await api.get('/config/alpaca');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({
            live_api_key: cfg.live_api_key_masked || '',
            live_api_secret: cfg.live_api_secret_masked || '',
          });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('Save failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/config/alpaca/test', { mode: 'live' });
      if (res.data?.success) {
        setStatus('connected');
        message.success(`Live connection OK — Account: ${res.data.account_id || 'N/A'}`);
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><BankOutlined />Alpaca Real Trading</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Live trading credentials. Handle with care — real money at risk.</Text>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="live_api_key" label="Real API Key">
              <Input.Password
                placeholder={hasSaved ? 'Key saved (masked)' : 'Enter real API key'}
                visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="live_api_secret" label="Real Secret Key">
              <Input.Password
                placeholder={hasSaved ? 'Secret saved (masked)' : 'Enter real secret key'}
                visibilityToggle={{ visible: showSecret, onVisibleChange: setShowSecret }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="live_base_url" label="Real Trading Base URL">
              <Input placeholder="https://api.alpaca.markets" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>Test Connection</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>Save Real Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section C: Alpaca Market Data
// =====================================================================
const MarketDataSection: React.FC = () => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');

  useEffect(() => {
    api.get('/config/market-data').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          data_base_url: cfg.data_base_url || 'https://data.alpaca.markets',
          feed: cfg.feed || 'iex',
        });
      }
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/config/market-data', values);
      if (res.data?.success) {
        message.success('Market data settings saved');
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('Save failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/config/market-data/test');
      if (res.data?.success) {
        setStatus('connected');
        message.success('Market data connection OK');
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><CloudOutlined />Alpaca Market Data</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Market data endpoint for bars, snapshots, and quotes. Separate from trading endpoints.</Text>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="data_base_url" label="Market Data Base URL">
              <Input placeholder="https://data.alpaca.markets" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="feed" label="Market Data Feed">
              <Select>
                <Option value="iex">IEX (free tier)</Option>
                <Option value="sip">SIP (paid tier)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>Test Market Data</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>Save Market Data Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section D: AI Provider
// =====================================================================
const AI_PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  DeepSeek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  OpenAI: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' },
  Claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-sonnet-20240229' },
  'NVIDIA NIM': { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'deepseek-ai/deepseek-r1' },
};

const AIProviderSection: React.FC = () => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ rpm: number; minIntervalMs: number } | null>(null);

  useEffect(() => {
    api.get('/ai/provider/config').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        const model = cfg.model || 'deepseek-chat';
        const isKnown = KNOWN_MODELS.includes(model);
        setCustomModel(!isKnown);
        form.setFieldsValue({
          provider: cfg.provider || 'DeepSeek',
          model: isKnown ? model : '__custom__',
          customModel: isKnown ? '' : model,
          apiKey: cfg.apiKey ? maskKey(cfg.apiKey) : '',
          baseUrl: cfg.baseUrl || cfg.baseURL || 'https://api.deepseek.com',
        });
        setHasSaved(!!cfg.apiKey);
        if (cfg.apiKey) setStatus('not_tested');
        setRateLimitInfo(res.data.rateLimit || null);
      }
    }).catch(() => {});
  }, [form]);

  const handleProviderChange = (value: string) => {
    const defaults = AI_PROVIDER_DEFAULTS[value];
    if (defaults) {
      form.setFieldsValue({ baseUrl: defaults.baseUrl, model: defaults.model });
      setCustomModel(false);
    }
  };

  const handleModelChange = (value: string) => {
    setCustomModel(value === '__custom__');
  };

  const KNOWN_MODELS = [
    'deepseek-chat', 'deepseek-coder', 'deepseek-ai/deepseek-r1',
    'meta/llama-3.1-70b-instruct', 'gpt-4', 'gpt-3.5-turbo',
    'claude-3-opus', 'claude-3-sonnet',
  ];

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const modelValue = customModel ? values.customModel : values.model;
      const payload: any = {
        provider: values.provider,
        model: modelValue,
        baseUrl: values.baseUrl,
      };
      if (values.apiKey && !values.apiKey.includes('****')) {
        payload.apiKey = values.apiKey;
      }
      const res = await api.post('/ai/provider/config', payload);
      if (res.data?.success) {
        message.success('AI provider settings saved');
        setHasSaved(true);
        const reload = await api.get('/ai/provider/config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          const model = cfg.model || modelValue;
          const isKnown = KNOWN_MODELS.includes(model);
          setCustomModel(!isKnown);
          form.setFieldsValue({
            apiKey: cfg.apiKey ? maskKey(cfg.apiKey) : '',
            model: isKnown ? model : '__custom__',
            customModel: isKnown ? '' : model,
          });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('Save failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const values = form.getFieldsValue();
      const modelValue = customModel ? values.customModel : values.model;
      const res = await api.post('/ai/provider/test', {
        baseUrl: values.baseUrl,
        model: modelValue,
        provider: values.provider,
      });
      if (res.data?.success) {
        setStatus('connected');
        message.success('AI provider connection OK');
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><ApiOutlined />AI Provider Configuration</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Configure the AI provider used by Scanner, Fine Scan, Deeper Validation, and Entry Plan.</Text>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="provider" label="Provider">
              <Select onChange={handleProviderChange}>
                <Option value="DeepSeek">DeepSeek</Option>
                <Option value="OpenAI">OpenAI</Option>
                <Option value="Claude">Claude</Option>
                <Option value="NVIDIA NIM">NVIDIA NIM</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="model" label="Model">
              <Select showSearch onChange={handleModelChange}>
                {KNOWN_MODELS.map(m => <Option key={m} value={m}>{m}</Option>)}
                <Option value="__custom__">Other (custom model)...</Option>
              </Select>
            </Form.Item>
            {customModel && (
              <Form.Item name="customModel" label="Custom Model Name" rules={[{ required: true, message: 'Enter model name' }]}>
                <Input placeholder="e.g. deepseek-ai/deepseek-r1" onChange={(e) => form.setFieldsValue({ model: e.target.value })} />
              </Form.Item>
            )}
          </Col>
          <Col span={6}>
            <Form.Item name="apiKey" label="API Key">
              <Input.Password
                placeholder={hasSaved ? 'Key saved (masked)' : 'Enter API key'}
                visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="baseUrl" label="Base URL">
              <Input placeholder="https://api.deepseek.com" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>Test AI Connection</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>Save AI Settings</Button>
        </div>
      </Form>
      {rateLimitInfo && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Rate limit: {rateLimitInfo.rpm} RPM / min interval {rateLimitInfo.minIntervalMs}ms</Text>
        </div>
      )}
    </Card>
  );
};

// =====================================================================
// Section E: Finnhub
// =====================================================================
const FinnhubSection: React.FC = () => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    api.get('/config/finnhub').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          api_key: cfg.api_key_masked || '',
          base_url: cfg.base_url || 'https://finnhub.io/api/v1',
        });
        setHasSaved(!!cfg.api_key);
      }
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { base_url: values.base_url };
      if (values.api_key && !values.api_key.includes('****')) payload.api_key = values.api_key;
      const res = await api.post('/config/finnhub', payload);
      if (res.data?.success) {
        message.success('Finnhub settings saved');
        setHasSaved(true);
        const reload = await api.get('/config/finnhub');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({ api_key: cfg.api_key_masked || '' });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('Save failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/config/finnhub/test');
      if (res.data?.success) {
        setStatus('connected');
        message.success('Finnhub connection OK');
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><CloudOutlined />Finnhub Configuration</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Finnhub API for company profiles, sector data, news, and earnings calendar.</Text>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="api_key" label="Finnhub API Key">
              <Input.Password
                placeholder={hasSaved ? 'Key saved (masked)' : 'Enter Finnhub API key'}
                visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="base_url" label="Base URL">
              <Input placeholder="https://finnhub.io/api/v1" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>Test Finnhub Connection</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>Save Finnhub Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Main Configuration Page
// =====================================================================
const Configuration: React.FC = () => {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={2}>
        <SettingOutlined style={{ marginRight: 12 }} />
        Configuration
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Configure API connections for Alpaca, Finnhub, and AI providers. Changes take effect immediately.
      </Text>

      <Collapse
        defaultActiveKey={['paper', 'ai']}
        expandIconPosition="start"
        items={[
          {
            key: 'paper',
            label: <Text strong>A. Alpaca Paper Trading</Text>,
            children: <AlpacaPaperSection />,
          },
          {
            key: 'real',
            label: <Text strong>B. Alpaca Real Trading</Text>,
            children: <AlpacaRealSection />,
          },
          {
            key: 'data',
            label: <Text strong>C. Alpaca Market Data</Text>,
            children: <MarketDataSection />,
          },
          {
            key: 'ai',
            label: <Text strong>D. AI Provider</Text>,
            children: <AIProviderSection />,
          },
          {
            key: 'finnhub',
            label: <Text strong>E. Finnhub</Text>,
            children: <FinnhubSection />,
          },
        ]}
      />
    </div>
  );
};

export default Configuration;
