import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Form, Input, Select, Button, Space, Collapse, Tag, message, Row, Col,
} from 'antd';
import {
  SettingOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  SaveOutlined, ApiOutlined, ExperimentOutlined, BankOutlined, CloudOutlined,
  LogoutOutlined, UserOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

// Per-user API instance with Supabase auth token
const userApi = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
userApi.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// --- Auth check helper ---
const requireSession = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    message.error('Please sign in before saving settings.');
    return null;
  }
  return session.access_token;
};

// --- Status badge ---
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'connected') return <Tag icon={<CheckCircleOutlined />} color="success">Connected</Tag>;
  if (status === 'saved') return <Tag icon={<CheckCircleOutlined />} color="blue">Saved</Tag>;
  if (status === 'error') return <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>;
  return <Tag icon={<QuestionCircleOutlined />} color="default">Not tested</Tag>;
};

// =====================================================================
// Section A: Alpaca Paper Trading
// =====================================================================
const AlpacaPaperSection: React.FC = () => {
  const [form] = Form.useForm();
  const [, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    userApi.get('/settings/broker-config').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          paper_api_key: cfg.paper_api_key_masked || '',
          paper_api_secret: cfg.paper_api_secret_masked || '',
          paper_base_url: cfg.paper_base_url || 'https://paper-api.alpaca.markets',
        });
        setHasSaved(!!cfg.paper_api_key);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    try {
      const token = await requireSession();
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { paper_base_url: values.paper_base_url };
      if (values.paper_api_key && !values.paper_api_key.includes('****')) payload.paper_api_key = values.paper_api_key;
      if (values.paper_api_secret && !values.paper_api_secret.includes('****')) payload.paper_api_secret = values.paper_api_secret;
      const res = await userApi.post('/settings/broker-config', payload);
      if (res.data?.success) {
        message.success('Paper trading settings saved');
        setHasSaved(true);
        setStatus('not_tested');
        const reload = await userApi.get('/settings/broker-config');
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
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || 'Save failed');
    } finally {
      setSaving(false);
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
          <Button onClick={handleTest} loading={testing} disabled={testing || saving} icon={<ExperimentOutlined />}>Test Connection</Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={saving || testing} icon={<SaveOutlined />}>Save Paper Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section B: Alpaca Real Trading
// =====================================================================
const AlpacaRealSection: React.FC<{ onMarketDataSynced?: (keys: { apiKey: string; secretKey: string }) => void }> = ({ onMarketDataSynced }) => {
  const [form] = Form.useForm();
  const [, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    userApi.get('/settings/broker-config').then(res => {
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
      const token = await requireSession();
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { live_base_url: values.live_base_url };
      if (values.live_api_key && !values.live_api_key.includes('****')) payload.live_api_key = values.live_api_key;
      if (values.live_api_secret && !values.live_api_secret.includes('****')) payload.live_api_secret = values.live_api_secret;
      const res = await userApi.post('/settings/broker-config', payload);
      if (res.data?.success) {
        message.success('Real trading settings saved');
        setHasSaved(true);
        setStatus('not_tested');
        const reload = await userApi.get('/settings/broker-config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({
            live_api_key: cfg.live_api_key_masked || '',
            live_api_secret: cfg.live_api_secret_masked || '',
          });
        }
        // Trigger Market Data reload if keys were synced
        if (res.data.marketDataSynced && onMarketDataSynced) {
          onMarketDataSynced({
            apiKey: res.data.maskedMarketDataApiKey || '',
            secretKey: res.data.maskedMarketDataSecretKey || '',
          });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || 'Save failed');
    } finally {
      setSaving(false);
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
          <Button onClick={handleTest} loading={testing} disabled={testing || saving} icon={<ExperimentOutlined />}>Test Connection</Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={saving || testing} icon={<SaveOutlined />}>Save Real Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section C: Alpaca Market Data
// =====================================================================
const MarketDataSection: React.FC<{ reloadKey?: number }> = ({ reloadKey }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [credentialSource, setCredentialSource] = useState<string>('none');

  const loadConfig = () => {
    userApi.get('/config/market-data').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          data_base_url: cfg.data_base_url || 'https://data.alpaca.markets',
          feed: cfg.feed || 'iex',
          api_key: cfg.api_key_masked || '',
          api_secret: cfg.api_secret_masked || '',
        });
        setCredentialSource(cfg.credentialSource || 'none');
      }
    }).catch(() => {});
  };

  useEffect(() => { loadConfig(); }, [form, reloadKey]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        data_base_url: values.data_base_url,
        feed: values.feed,
      };
      if (values.api_key && !values.api_key.includes('****')) {
        payload.api_key = values.api_key;
      }
      if (values.api_secret && !values.api_secret.includes('****')) {
        payload.api_secret = values.api_secret;
      }
      const res = await userApi.post('/config/market-data', payload);
      if (res.data?.success) {
        message.success('Market data settings saved');
        loadConfig();
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      const msg = e.response?.data?.message || e.message || 'Save failed';
      message.error(msg);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await userApi.post('/config/market-data/test');
      const d = res.data?.debug;
      const debugHint = d ? ` (source=${d.keySource}, baseUrl=${d.baseUrl})` : '';
      if (res.data?.success) {
        setStatus('connected');
        message.success(`Market data connected${debugHint}`);
      } else {
        setStatus('error');
        message.error((res.data?.message || 'Connection failed') + debugHint);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const hasKeys = credentialSource === 'real_trading';

  return (
    <Card title={<Space><CloudOutlined />Alpaca Market Data</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Market data endpoint for bars, snapshots, and quotes. Uses Alpaca Real Trading credentials with data.alpaca.markets endpoint.</Text>
      {hasKeys && <Text type="success" style={{ display: 'block', marginBottom: 16 }}>Credential Source: Alpaca Real Trading (auto-synced)</Text>}
      {!hasKeys && <Text type="warning" style={{ display: 'block', marginBottom: 16 }}>Configure Alpaca Real Trading first, then Market Data keys will be auto-synced.</Text>}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="data_base_url" label="Market Data Base URL">
              <Input disabled placeholder="https://data.alpaca.markets" />
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
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="api_key" label="Market Data API Key (auto-synced from Real Trading)">
              <Input.Password placeholder={hasKeys ? undefined : 'Configure Real Trading first'} disabled={hasKeys} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="api_secret" label="Market Data API Secret (auto-synced from Real Trading)">
              <Input.Password placeholder={hasKeys ? undefined : 'Configure Real Trading first'} disabled={hasKeys} />
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
const PROVIDER_MODELS: Record<string, { baseUrl: string; models: string[] }> = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  },
  OpenAI: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4', 'gpt-3.5-turbo'],
  },
  Claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  Gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  'NVIDIA NIM': {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-405b-instruct', 'mistralai/mistral-7b-instruct-v0.3', 'google/gemma-2-9b-it'],
  },
  Mimo: {
    baseUrl: 'https://api.mimo.ai/v1',
    models: ['mimo-7b', 'mimo-13b'],
  },
  Custom: {
    baseUrl: '',
    models: [],
  },
};
const PROVIDER_NAMES = Object.keys(PROVIDER_MODELS);

const AIProviderSection: React.FC = () => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [keyIsMasked, setKeyIsMasked] = useState(false);

  const currentProvider = Form.useWatch('provider', form) || 'DeepSeek';
  const modelOptions = PROVIDER_MODELS[currentProvider]?.models || [];

  useEffect(() => {
    userApi.get('/settings/ai-config').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        const provider = cfg.provider || 'DeepSeek';
        const model = cfg.model || PROVIDER_MODELS[provider]?.models[0] || '';
        const providerModels = PROVIDER_MODELS[provider]?.models || [];
        const isKnown = providerModels.includes(model);
        setCustomModel(!isKnown);
        // Use backend indicators — don't detect **** in returned value
        const hasValidKey = !!res.data.hasUserKey;
        const keyInvalid = !!res.data.apiKeyIsInvalid;
        setKeyIsMasked(keyInvalid);
        // Don't set masked key as form value — use placeholder "Key saved (masked)" instead
        form.setFieldsValue({
          provider,
          model: isKnown ? model : '__custom__',
          customModel: isKnown ? '' : model,
          apiKey: '',
          baseUrl: cfg.baseUrl || cfg.baseURL || PROVIDER_MODELS[provider]?.baseUrl || '',
        });
        setHasSaved(hasValidKey);
        if (keyInvalid) {
          setStatus('error');
        } else {
          const testStatus = res.data.testStatus || 'not_tested';
          if (testStatus === 'connected') {
            setStatus('connected');
          } else if (testStatus === 'error') {
            setStatus('error');
          } else if (testStatus === 'saved' || hasValidKey) {
            setStatus('saved');
          } else {
            setStatus('not_tested');
          }
        }
      }
    }).catch(() => {});
  }, [form]);

  const handleProviderChange = (value: string) => {
    const p = PROVIDER_MODELS[value];
    if (p) {
      form.setFieldsValue({ baseUrl: p.baseUrl, model: p.models[0] || '__custom__' });
      setCustomModel(!p.models[0]);
    }
  };

  const handleModelChange = (value: string) => {
    setCustomModel(value === '__custom__');
  };

  const handleSave = async () => {
    try {
      const token = await requireSession();
      if (!token) return;
      setSaving(true);
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
      const res = await userApi.post('/settings/ai-config', payload);
      if (res.data?.success) {
        message.success('AI provider settings saved');
        setHasSaved(true);
        // Use backend testStatus if available, otherwise 'saved'
        const testStatus = res.data.testStatus || 'saved';
        setStatus(testStatus === 'connected' ? 'connected' : 'saved');
        const reload = await userApi.get('/settings/ai-config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          const model = cfg.model || modelValue;
          const providerModels = PROVIDER_MODELS[values.provider]?.models || [];
          const isKnown = providerModels.includes(model);
          setCustomModel(!isKnown);
          const hasValidKey = !!reload.data.hasUserKey;
          const keyInvalid = !!reload.data.apiKeyIsInvalid;
          setKeyIsMasked(keyInvalid);
          setHasSaved(hasValidKey);
          // Don't set masked key as form value — use placeholder instead
          form.setFieldsValue({
            apiKey: '',
            model: isKnown ? model : '__custom__',
            customModel: isKnown ? '' : model,
          });
          const reloadStatus = reload.data.testStatus || 'saved';
          if (reloadStatus === 'connected') setStatus('connected');
          else if (reloadStatus === 'error') setStatus('error');
          else setStatus('saved');
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession();
      if (!token) { setTesting(false); return; }
      const values = form.getFieldsValue();
      const modelValue = customModel ? values.customModel : values.model;
      if (!modelValue) {
        message.error('Please select or enter a model name');
        setTesting(false); return;
      }
      const payload: any = {
        baseUrl: values.baseUrl,
        model: modelValue,
        provider: values.provider,
      };
      if (values.apiKey && !values.apiKey.includes('****')) {
        payload.apiKey = values.apiKey;
      }
      const res = await userApi.post('/ai/provider/test', payload);
      if (res.data?.success) {
        setStatus(res.data.testStatus || 'connected');
        message.success('AI provider connection OK');
      } else {
        setStatus(res.data.testStatus || 'error');
        message.error(res.data?.message || 'Connection failed');
      }
    } catch (e: any) {
      setStatus('error');
      const detail = e.response?.data?.message || e.response?.data?.error || e.message;
      message.error(detail || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title={<Space><ApiOutlined />AI Provider Configuration</Space>} extra={<StatusBadge status={status} />} style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Configure the AI provider used by Scanner, Fine Scan, Deeper Validation, and Entry Plan.</Text>
      {keyIsMasked && (
        <Text type="danger" style={{ display: 'block', marginBottom: 16, fontWeight: 600 }}>
          Stored AI key is invalid because a masked value was saved. Please re-enter the real API key below and click Save, then Test AI Connection.
        </Text>
      )}
      <Form form={form} layout="vertical" initialValues={{ provider: 'DeepSeek', model: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="provider" label="Provider">
              <Select onChange={handleProviderChange}>
                {PROVIDER_NAMES.map(p => <Option key={p} value={p}>{p}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="model" label="Model">
              <Select showSearch onChange={handleModelChange}>
                {modelOptions.map(m => <Option key={m} value={m}>{m}</Option>)}
                <Option value="__custom__">Custom model...</Option>
              </Select>
            </Form.Item>
            {customModel && (
              <Form.Item name="customModel" label="Custom Model Name" rules={[{ required: true, message: 'Enter model name' }]}>
                <Input placeholder="e.g. deepseek-ai/deepseek-r1" />
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
          <Button onClick={handleTest} loading={testing} disabled={testing || saving} icon={<ExperimentOutlined />}>Test AI Connection</Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={saving || testing} icon={<SaveOutlined />}>Save AI Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section E: Finnhub
// =====================================================================
const FinnhubSection: React.FC = () => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [showKey, setShowKey] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    userApi.get('/settings/finnhub-config').then(res => {
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          api_key: cfg.api_key_masked || cfg.api_key || '',
          base_url: cfg.base_url || 'https://finnhub.io/api/v1',
        });
        setHasSaved(!!cfg.api_key_masked || !!cfg.api_key);
      }
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const token = await requireSession();
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { base_url: values.base_url };
      if (values.api_key && !values.api_key.includes('****')) payload.api_key = values.api_key;
      const res = await userApi.post('/settings/finnhub-config', payload);
      if (res.data?.success) {
        message.success('Finnhub settings saved');
        setHasSaved(true);
        setStatus('not_tested');
        const reload = await userApi.get('/settings/finnhub-config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({ api_key: cfg.api_key_masked || '' });
        }
      } else {
        message.error(res.data?.message || 'Save failed');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession();
      if (!token) { setTesting(false); return; }
      const res = await userApi.post('/settings/finnhub-config/test');
      if (res.data?.success) {
        setStatus('connected');
        message.success(res.data?.message || 'Finnhub connection OK');
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
          <Button onClick={handleTest} loading={testing} disabled={testing || saving} icon={<ExperimentOutlined />}>Test Finnhub Connection</Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={saving || testing} icon={<SaveOutlined />}>Save Finnhub Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Main Configuration Page
// =====================================================================
const Configuration: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [marketDataReloadKey, setMarketDataReloadKey] = useState(0);

  const handleSignOut = async () => {
    await logout();
    navigate('/signin');
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            <SettingOutlined style={{ marginRight: 12 }} />
            Configuration
          </Title>
          <Text type="secondary">
            Configure API connections for Alpaca, Finnhub, and AI providers.
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Space>
            <UserOutlined />
            <Text type="secondary">{user?.email || 'Unknown'}</Text>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>

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
            children: <AlpacaRealSection onMarketDataSynced={() => setMarketDataReloadKey(k => k + 1)} />,
          },
          {
            key: 'data',
            label: <Text strong>C. Alpaca Market Data</Text>,
            children: <MarketDataSection reloadKey={marketDataReloadKey} />,
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
