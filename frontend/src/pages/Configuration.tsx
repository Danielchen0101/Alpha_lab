import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Form, Input, Select, Button, Space, Tag, message, Row, Col, Divider, Alert, Switch, Checkbox,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  SaveOutlined, ApiOutlined, ExperimentOutlined, BankOutlined, CloudOutlined,
  ArrowLeftOutlined, SafetyCertificateOutlined,
  InfoCircleOutlined, RobotOutlined, ThunderboltOutlined, BellOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Per-user API instance with Supabase auth token (with refresh)
const userApi = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
userApi.interceptors.request.use(async (config) => {
  let { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      if (!payload.exp || Date.now() >= (payload.exp * 1000 - 60000)) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) session = refreshed.session;
      }
    } catch { /* use existing token */ }
  }
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// --- Auth check helper ---
const requireSession = async (signInMsg?: string): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    message.error(signInMsg || 'Please sign in before saving settings.');
    return null;
  }
  return session.access_token;
};

// --- Status badge ---
const StatusBadge: React.FC<{ status: string; texts?: { connected?: string; saved?: string; error?: string; notTested?: string } }> = ({ status, texts }) => {
  const connected = texts?.connected ?? 'Connected';
  const saved = texts?.saved ?? 'Saved';
  const errorText = texts?.error ?? 'Error';
  const notTested = texts?.notTested ?? 'Not tested';
  if (status === 'connected') return <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 12, padding: '0 10px' }}>{connected}</Tag>;
  if (status === 'saved') return <Tag icon={<CheckCircleOutlined />} color="blue" style={{ borderRadius: 12, padding: '0 10px' }}>{saved}</Tag>;
  if (status === 'error') return <Tag icon={<CloseCircleOutlined />} color="error" style={{ borderRadius: 12, padding: '0 10px' }}>{errorText}</Tag>;
  return <Tag icon={<QuestionCircleOutlined />} color="default" style={{ borderRadius: 12, padding: '0 10px' }}>{notTested}</Tag>;
};

// --- Section Header ---
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; status?: string; statusTexts?: { connected?: string; saved?: string; error?: string; notTested?: string } }> = ({ icon, title, subtitle, status, statusTexts }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: '12px' }}>
    <Space size={16} align="start">
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--app-card-bg-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        color: 'var(--app-blue-text)',
        border: '1px solid var(--app-border-soft)'
      }}>
        {icon}
      </div>
      <div>
        <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)', fontWeight: 700 }}>{title}</Title>
        <Text style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500 }}>{subtitle}</Text>
      </div>
    </Space>
    {status && <StatusBadge status={status} texts={statusTexts} />}
  </div>
);

// --- Security Note ---
const SecurityNote: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ 
    marginTop: 16, 
    display: 'flex', 
    alignItems: 'center', 
    gap: 8, 
    padding: '10px 14px', 
    background: 'rgba(74, 222, 128, 0.05)', 
    borderRadius: 8, 
    border: '1px solid rgba(74, 222, 128, 0.15)' 
  }}>
    <SafetyCertificateOutlined style={{ color: '#4ade80' }} />
    <Text style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{text}</Text>
  </div>
);

// =====================================================================
// Section A: Alpaca Paper Trading
// =====================================================================
const AlpacaPaperSection: React.FC<{ t: any }> = ({ t }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
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
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { paper_base_url: values.paper_base_url };
      if (values.paper_api_key && !values.paper_api_key.includes('****')) payload.paper_api_key = values.paper_api_key;
      if (values.paper_api_secret && !values.paper_api_secret.includes('****')) payload.paper_api_secret = values.paper_api_secret;
      const res = await userApi.post('/settings/broker-config', payload);
      if (res.data?.success) {
        message.success(t.config.paperSaved);
        setHasSaved(true);
        setStatus('saved');
        const reload = await userApi.get('/settings/broker-config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({
            paper_api_key: cfg.paper_api_key_masked || '',
            paper_api_secret: cfg.paper_api_secret_masked || '',
          });
        }
      } else {
        message.error(res.data?.message || t.config.saveFailed);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || t.config.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) { setTesting(false); return; }
      const res = await userApi.post('/config/alpaca/test', { mode: 'paper' });
      if (res.data?.success) {
        setStatus('connected');
        message.success(t.config.paperTestOK.replace('{id}', res.data.account_id || 'N/A'));
      } else {
        setStatus('error');
        message.error(res.data?.message || t.config.connectionFailed);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || t.config.connectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<ThunderboltOutlined />}
        title={t.config.paperTitle}
        subtitle={t.config.paperSubtitle}
        status={status}
        statusTexts={statusTexts}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="paper_api_key" label={<Text strong style={{ fontSize: 13 }}>{t.config.apiKey}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterApiKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="paper_api_secret" label={<Text strong style={{ fontSize: 13 }}>{t.config.secretKey}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterSecretKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="paper_base_url" label={<Text strong style={{ fontSize: 13 }}>{t.config.endpointUrl}</Text>}>
              <Input placeholder="https://paper-api.alpaca.markets" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testConnection}</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{t.config.saveChanges}</Button>
        </div>
      </Form>
      <SecurityNote text={t.config.paperSecurityNote} />
    </Card>
  );
};

// =====================================================================
// Section B: Alpaca Real Trading
// =====================================================================
const AlpacaRealSection: React.FC<{ onMarketDataSynced?: (keys: { apiKey: string; secretKey: string }) => void; t: any }> = ({ onMarketDataSynced, t }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
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
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { live_base_url: values.live_base_url };
      if (values.live_api_key && !values.live_api_key.includes('****')) payload.live_api_key = values.live_api_key;
      if (values.live_api_secret && !values.live_api_secret.includes('****')) payload.live_api_secret = values.live_api_secret;
      const res = await userApi.post('/settings/broker-config', payload);
      if (res.data?.success) {
        message.success(t.config.liveSaved);
        setHasSaved(true);
        setStatus('saved');
        const reload = await userApi.get('/settings/broker-config');
        if (reload.data?.success) {
          const cfg = reload.data.config || {};
          form.setFieldsValue({
            live_api_key: cfg.live_api_key_masked || '',
            live_api_secret: cfg.live_api_secret_masked || '',
          });
        }
        if (res.data.marketDataSynced && onMarketDataSynced) {
          onMarketDataSynced({
            apiKey: res.data.maskedMarketDataApiKey || '',
            secretKey: res.data.maskedMarketDataSecretKey || '',
          });
        }
      } else {
        message.error(res.data?.message || t.config.saveFailed);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || t.config.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) { setTesting(false); return; }
      const res = await userApi.post('/config/alpaca/test', { mode: 'live' });
      if (res.data?.success) {
        setStatus('connected');
        message.success(t.config.liveTestOK.replace('{id}', res.data.account_id || 'N/A'));
      } else {
        setStatus('error');
        message.error(res.data?.message || t.config.connectionFailed);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || t.config.connectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<BankOutlined style={{ color: '#ef4444' }} />}
        title={t.config.liveTitle}
        subtitle={t.config.liveSubtitle}
        status={status}
        statusTexts={statusTexts}
      />
      <Alert
        message={t.config.securityWarning}
        description={t.config.securityWarningDesc}
        type="warning"
        showIcon
        style={{ marginBottom: 20, borderRadius: 8 }}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="live_api_key" label={<Text strong style={{ fontSize: 13 }}>{t.config.apiKey}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterApiKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="live_api_secret" label={<Text strong style={{ fontSize: 13 }}>{t.config.secretKey}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterSecretKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="live_base_url" label={<Text strong style={{ fontSize: 13 }}>{t.config.endpointUrl}</Text>}>
              <Input placeholder="https://api.alpaca.markets" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testLiveConnection}</Button>
          <Button type="primary" danger onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{t.config.saveLiveSettings}</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section C: Alpaca Market Data
// =====================================================================
const MarketDataSection: React.FC<{ reloadKey?: number; t: any }> = ({ reloadKey, t }) => {
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
      if (values.api_key && !values.api_key.includes('****')) payload.api_key = values.api_key;
      if (values.api_secret && !values.api_secret.includes('****')) payload.api_secret = values.api_secret;
      const res = await userApi.post('/config/market-data', payload);
      if (res.data?.success) {
        message.success(t.config.marketDataSaved);
        loadConfig();
        setStatus('saved');
      } else {
        message.error(res.data?.message || t.config.saveFailed);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || t.config.saveFailed);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await userApi.post('/config/market-data/test');
      if (res.data?.success) {
        setStatus('connected');
        message.success(t.config.marketDataConnected.replace('{source}', res.data.debug?.keySource || 'N/A'));
      } else {
        setStatus('error');
        message.error(res.data?.message || t.config.connectionFailed);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || t.config.connectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const hasKeys = credentialSource === 'real_trading';
  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<CloudOutlined />}
        title={t.config.marketDataTitle}
        subtitle={t.config.marketDataSubtitle}
        status={status}
        statusTexts={statusTexts}
      />
      <div style={{ marginBottom: 20 }}>
        {hasKeys ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>{t.config.keysAutoSynced}</Tag>
        ) : (
          <Tag color="warning" icon={<InfoCircleOutlined />}>{t.config.configureRealFirst}</Tag>
        )}
      </div>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="data_base_url" label={<Text strong style={{ fontSize: 13 }}>{t.config.dataEndpointUrl}</Text>}>
              <Input disabled placeholder="https://data.alpaca.markets" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="feed" label={<Text strong style={{ fontSize: 13 }}>{t.config.dataFeedTier}</Text>}>
              <Select>
                <Option value="iex">{t.config.iexFree}</Option>
                <Option value="sip">{t.config.sipPaid}</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="api_key" label={<Text strong style={{ fontSize: 13 }}>{t.config.dataApiKey}</Text>}>
              <Input.Password disabled={hasKeys} placeholder={hasKeys ? t.config.usingRealKey : t.config.configureRealTrading} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="api_secret" label={<Text strong style={{ fontSize: 13 }}>{t.config.dataApiSecret}</Text>}>
              <Input.Password disabled={hasKeys} placeholder={hasKeys ? t.config.usingRealSecret : t.config.configureRealTrading} />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testDataAccess}</Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>{t.config.saveConfiguration}</Button>
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
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  Claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
  },
  Gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  },
  'NVIDIA NIM': {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'],
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

const AIProviderSection: React.FC<{ t: any }> = ({ t }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
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
        const hasValidKey = !!res.data.hasUserKey;
        const keyInvalid = !!res.data.apiKeyIsInvalid;
        setKeyIsMasked(keyInvalid);
        form.setFieldsValue({
          provider,
          model: isKnown ? model : '__custom__',
          customModel: isKnown ? '' : model,
          apiKey: '',
          baseUrl: cfg.baseUrl || cfg.baseURL || PROVIDER_MODELS[provider]?.baseUrl || '',
        });
        setHasSaved(hasValidKey);
        if (keyInvalid) setStatus('error');
        else if (res.data.testStatus === 'connected') setStatus('connected');
        else if (hasValidKey) setStatus('saved');
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

  const handleSave = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const modelValue = customModel ? values.customModel : values.model;
      const payload: any = { provider: values.provider, model: modelValue, baseUrl: values.baseUrl };
      if (values.apiKey && !values.apiKey.includes('****')) payload.apiKey = values.apiKey;
      const res = await userApi.post('/settings/ai-config', payload);
      if (res.data?.success) {
        message.success(t.config.aiSaved);
        setHasSaved(true);
        setStatus('saved');
      } else {
        message.error(res.data?.message || t.config.saveFailed);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || t.config.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) { setTesting(false); return; }
      const values = form.getFieldsValue();
      const modelValue = customModel ? values.customModel : values.model;
      const payload: any = { baseUrl: values.baseUrl, model: modelValue, provider: values.provider };
      if (values.apiKey && !values.apiKey.includes('****')) payload.apiKey = values.apiKey;
      const res = await userApi.post('/ai/provider/test', payload);
      if (res.data?.success) {
        setStatus('connected');
        message.success(t.config.aiConnected);
      } else {
        setStatus('error');
        message.error(res.data?.message || t.config.connectionFailed);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || e.message || t.config.connectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<RobotOutlined />}
        title={t.config.aiTitle}
        subtitle={t.config.aiSubtitle}
        status={status}
        statusTexts={statusTexts}
      />
      {keyIsMasked && (
        <Alert
          message={t.config.keyMismatch}
          description={t.config.keyMismatchDesc}
          type="error"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item name="provider" label={<Text strong style={{ fontSize: 13 }}>{t.config.provider}</Text>}>
              <Select onChange={handleProviderChange}>
                {PROVIDER_NAMES.map(p => <Option key={p} value={p}>{p}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="model" label={<Text strong style={{ fontSize: 13 }}>{t.config.primaryModel}</Text>}>
              <Select showSearch onChange={v => setCustomModel(v === '__custom__')}>
                {modelOptions.map(m => <Option key={m} value={m}>{m}</Option>)}
                <Option value="__custom__">{t.config.customModel}</Option>
              </Select>
            </Form.Item>
            {customModel && (
              <Form.Item name="customModel" label={<Text strong style={{ fontSize: 13 }}>{t.config.modelIdentifier}</Text>} rules={[{ required: true }]}>
                <Input placeholder={t.config.modelPlaceholder} />
              </Form.Item>
            )}
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="apiKey" label={<Text strong style={{ fontSize: 13 }}>{t.config.apiKeyLabel}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterApiKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="baseUrl" label={<Text strong style={{ fontSize: 13 }}>{t.config.apiBaseUrl}</Text>}>
              <Input placeholder="https://api.deepseek.com" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testAiConnection}</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{t.config.saveIntelligence}</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section E: Finnhub
// =====================================================================
const FinnhubSection: React.FC<{ t: any }> = ({ t }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
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
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = { base_url: values.base_url };
      if (values.api_key && !values.api_key.includes('****')) payload.api_key = values.api_key;
      const res = await userApi.post('/settings/finnhub-config', payload);
      if (res.data?.success) {
        message.success(t.config.finnhubSaved);
        setHasSaved(true);
        setStatus('saved');
      } else {
        message.error(res.data?.message || t.config.saveFailed);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || e.message || t.config.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) { setTesting(false); return; }
      const res = await userApi.post('/settings/finnhub-config/test');
      if (res.data?.success) {
        setStatus('connected');
        message.success(t.config.finnhubConnected);
      } else {
        setStatus('error');
        message.error(res.data?.message || t.config.connectionFailed);
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || t.config.connectionFailed);
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<CloudOutlined />}
        title={t.config.finnhubTitle}
        subtitle={t.config.finnhubSubtitle}
        status={status}
        statusTexts={statusTexts}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="api_key" label={<Text strong style={{ fontSize: 13 }}>{t.config.finnhubApiKey}</Text>}>
              <Input.Password placeholder={hasSaved ? t.config.savedMasked : t.config.enterApiKey} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="base_url" label={<Text strong style={{ fontSize: 13 }}>{t.config.finnhubBaseUrl}</Text>}>
              <Input placeholder="https://finnhub.io/api/v1" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testFinnhub}</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{t.config.saveChanges}</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section F: Discord Notifications
// =====================================================================
const DiscordNotificationsSection: React.FC<{ t: any }> = ({ t }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [hasSaved, setHasSaved] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await userApi.get('/notifications/discord/config');
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          enabled: cfg.enabled === true,
          webhookUrl: cfg.webhookUrlMasked || '',
          notifyScanSummary: cfg.notifyScanSummary !== false,
          notifyEntryPlan: cfg.notifyEntryPlan !== false,
          notifyOrders: cfg.notifyOrders !== false,
          notifyExitScan: cfg.notifyExitScan !== false,
          notifyErrors: cfg.notifyErrors !== false,
        });
        setHasSaved(!!cfg.hasWebhookUrl);
        setStatus(cfg.testStatus === 'connected' ? 'connected' : cfg.hasWebhookUrl ? 'saved' : 'not_tested');
      }
    } catch {
      setStatus('error');
    } finally {
      setConfigLoaded(true);
    }
  }, [form]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setSaving(true);
      const values = await form.validateFields();
      const payload: any = {
        enabled: values.enabled === true,
        notifyScanSummary: values.notifyScanSummary !== false,
        notifyEntryPlan: values.notifyEntryPlan !== false,
        notifyOrders: values.notifyOrders !== false,
        notifyExitScan: values.notifyExitScan !== false,
        notifyErrors: values.notifyErrors !== false,
      };
      if (values.webhookUrl && !values.webhookUrl.includes('****')) {
        payload.webhookUrl = values.webhookUrl.trim();
      }
      const res = await userApi.post('/notifications/discord/config', payload);
      if (res.data?.success) {
        message.success('Discord notification settings saved.');
        await loadConfig();
      } else {
        setStatus('error');
        console.error('Discord settings save failed:', res.data);
        message.error('Discord settings could not be saved. Please check backend/Supabase configuration.');
      }
    } catch (e: any) {
      if (e.errorFields) return;
      setStatus('error');
      console.error('Discord settings save failed:', e);
      message.error('Discord settings could not be saved. Please check backend/Supabase configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (testAll?: boolean) => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      if (testAll) {
        setTestingAll(true);
      } else {
        setTesting(true);
      }
      const mode = localStorage.getItem('tradingMode') || localStorage.getItem('tradeMode') || 'paper';
      const payload: any = { mode };
      if (testAll) {
        payload.testAll = true;
      }
      const res = await userApi.post('/notifications/discord/test', payload);
      if (res.data?.success) {
        setStatus('connected');
        const typeCount = res.data.results ? Object.keys(res.data.results).length : 1;
        message.success(testAll
          ? `All ${typeCount} Discord test notification types sent.`
          : 'Discord test notification sent.');
        await loadConfig();
      } else {
        setStatus('error');
        message.error(res.data?.message || 'Discord test notification failed.');
      }
    } catch (e: any) {
      setStatus('error');
      message.error(e.response?.data?.message || e.message || 'Discord test notification failed.');
    } finally {
      setTesting(false);
      setTestingAll(false);
    }
  };

  const statusTexts = {
    connected: 'Connected',
    saved: 'Saved',
    error: 'Error',
    notTested: hasSaved ? 'Saved' : 'Not Configured',
  };

  // Only show form after config has been loaded from backend to avoid initialValues flash
  if (!configLoaded) {
    return (
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
        <SectionHeader
          icon={<BellOutlined />}
          title="Discord Notifications"
          subtitle="Send scanner, entry plan, order, exit scan, and error events to a Discord channel."
          status="not_tested"
          statusTexts={{ notTested: 'Loading...' }}
        />
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>Loading Discord settings...</div>
      </Card>
    );
  }

  return (
    <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
      <SectionHeader
        icon={<BellOutlined />}
        title="Discord Notifications"
        subtitle="Send scanner, entry plan, order, exit scan, and error events to a Discord channel."
        status={status}
        statusTexts={statusTexts}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Webhook URLs are encrypted at rest and are never shown after saving."
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item name="enabled" label={<Text strong style={{ fontSize: 13 }}>Enable Discord Notifications</Text>} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item
              name="webhookUrl"
              label={<Text strong style={{ fontSize: 13 }}>Discord Webhook URL</Text>}
              extra={hasSaved ? 'A webhook is saved. Enter a new URL only if you want to replace it.' : 'Create a webhook in your Discord channel integrations.'}
            >
              <Input.Password placeholder={hasSaved ? 'Saved webhook URL' : 'https://discord.com/api/webhooks/...'} autoComplete="off" />
            </Form.Item>
          </Col>
        </Row>

        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>Notification Types</Text>
        <Row gutter={[16, 10]}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="notifyScanSummary" valuePropName="checked" noStyle>
              <Checkbox>Scan Summary</Checkbox>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="notifyEntryPlan" valuePropName="checked" noStyle>
              <Checkbox>Entry Plan Recommendations</Checkbox>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="notifyOrders" valuePropName="checked" noStyle>
              <Checkbox>Order Submitted / Filled</Checkbox>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="notifyExitScan" valuePropName="checked" noStyle>
              <Checkbox>Exit Scan / Sell Signals</Checkbox>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="notifyErrors" valuePropName="checked" noStyle>
              <Checkbox>Errors / Blocked Actions</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={() => handleTest(false)} loading={testing} disabled={testingAll || !hasSaved} icon={<ExperimentOutlined />}>Test Notification</Button>
          <Button onClick={() => handleTest(true)} loading={testingAll} disabled={testing || !hasSaved} icon={<ThunderboltOutlined />}>Test All Types</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>Save Discord Settings</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Main Configuration Page
// =====================================================================
const Configuration: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [marketDataReloadKey, setMarketDataReloadKey] = useState(0);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 60px' }}>
      <div style={{ marginBottom: 32 }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/settings')}
          style={{ marginLeft: -16, marginBottom: 8, color: 'var(--app-text-muted)' }}
        >
          {t.config.backToSettings}
        </Button>
        <div>
          <Title level={2} style={{ margin: 0, color: 'var(--app-text-strong)', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <ApiOutlined style={{ marginRight: 12, color: 'var(--app-blue-text)' }} />
            {t.config.title}
          </Title>
          <Text style={{ fontSize: 15, color: 'var(--app-text-muted)', fontWeight: 500 }}>
            {t.config.subtitle}
          </Text>
        </div>
      </div>

      <Divider style={{ margin: '32px 0', borderColor: 'var(--app-border-soft)' }} />

      <style>{`
        .ant-card {
          background: var(--app-card-bg) !important;
          border: 1px solid var(--app-border-soft) !important;
          box-shadow: var(--app-shadow-sm) !important;
        }
        .ant-input, .ant-input-password, .ant-select-selector {
          background-color: var(--app-input-bg) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border) !important;
        }
        .ant-form-item-label label {
          color: var(--app-text) !important;
        }
        .ant-btn-default {
          background: var(--app-card-bg-soft) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border) !important;
        }
        .ant-btn-primary {
          box-shadow: 0 2px 4px rgba(24, 144, 255, 0.2);
        }
        .ant-alert-info {
          background-color: var(--app-blue-bg-soft) !important;
          border-color: var(--app-blue-border) !important;
        }
        .ant-alert-warning {
          background-color: rgba(251, 191, 36, 0.05) !important;
          border-color: rgba(251, 191, 36, 0.2) !important;
        }
      `}</style>

      <AlpacaPaperSection t={t} />
      <AlpacaRealSection onMarketDataSynced={() => setMarketDataReloadKey(k => k + 1)} t={t} />
      <MarketDataSection reloadKey={marketDataReloadKey} t={t} />
      <AIProviderSection t={t} />
      <FinnhubSection t={t} />
      <DiscordNotificationsSection t={t} />

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <Text style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: '#4ade80' }} />
          {t.config.footerSecurity}
        </Text>
      </div>
    </div>
  );
};

export default Configuration;
