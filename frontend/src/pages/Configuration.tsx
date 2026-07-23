import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Typography, Card, Form, Input, Select, Button, Tag, message, Row, Col, Alert, Switch, Checkbox, Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  SaveOutlined, ApiOutlined, ExperimentOutlined, BankOutlined, CloudOutlined,
  ArrowLeftOutlined, SafetyCertificateOutlined,
  InfoCircleOutlined, RobotOutlined, ThunderboltOutlined, BellOutlined, ReloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import kalshiAPI, { KalshiConnectionConfigResponse, KalshiEnvironment } from '../services/kalshiApi';
import './ConfigurationEditorial.css';

const { Text } = Typography;
const { Option } = Select;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const localizedResultMessage = (candidate: unknown, fallback: string) => {
  // Backend diagnostics are currently English. Keep Chinese UI states consistent
  // instead of dropping a raw server sentence into an otherwise translated form.
  if (/[\u3400-\u9fff]/.test(fallback)) return fallback;
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
};

const localizedRequestError = (error: any, fallback: string) => localizedResultMessage(
  error?.response?.data?.message || error?.message,
  fallback,
);

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
  if (status === 'connected') return <span className="config-status config-status--connected"><CheckCircleOutlined />{connected}</span>;
  if (status === 'saved') return <span className="config-status config-status--saved"><CheckCircleOutlined />{saved}</span>;
  if (status === 'error') return <span className="config-status config-status--error"><CloseCircleOutlined />{errorText}</span>;
  return <span className="config-status config-status--idle"><QuestionCircleOutlined />{notTested}</span>;
};

// --- Section Header ---
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; status?: string; statusTexts?: { connected?: string; saved?: string; error?: string; notTested?: string }; websiteUrl?: string; websiteLabel?: string }> = ({ icon, title, subtitle, status, statusTexts, websiteUrl, websiteLabel }) => (
  <div className="config-card-header">
    <div className="config-card-header__identity">
      <span className="config-card-header__icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
    <div className="config-card-header__actions">
      {websiteUrl && (
        <a className="config-provider-link" href={websiteUrl} target="_blank" rel="noreferrer">
          <LinkOutlined />{websiteLabel || 'Provider website'}
        </a>
      )}
      {status && <StatusBadge status={status} texts={statusTexts} />}
    </div>
  </div>
);

// --- Security Note ---
const SecurityNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="config-security-note">
    <SafetyCertificateOutlined />
    <span>{text}</span>
  </div>
);

// =====================================================================
// Optional Kalshi production credentials (Paper trading is built into AlphaLab)
// =====================================================================
const KalshiPersonalSection: React.FC<{ t: any; isZh: boolean }> = ({ t, isZh }) => {
  const [form] = Form.useForm();
  const [environment] = useState<KalshiEnvironment>('production');
  const [config, setConfig] = useState<KalshiConnectionConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const copy = isZh ? {
    title: 'Kalshi 个人账户 API',
    subtitle: 'AlphaLab Paper 无需密钥；这里只保存可选的 Kalshi 实盘账户凭证。',
    website: 'Kalshi API 密钥页面',
    environment: '账户环境',
    production: 'Production 实盘账户',
    keyId: 'API Key ID',
    privateKey: 'RSA Private Key',
    keyHint: '从 Kalshi 账户设置复制 Key ID。',
    privateHint: '粘贴创建 API Key 时下载的完整 PEM 私钥；保存后不会再次显示。',
    save: '保存 Kalshi 凭证',
    test: '测试账户连接',
    remove: '移除凭证',
    removeConfirm: '确定移除当前环境的 Kalshi 凭证吗？',
    saved: 'Kalshi 凭证已加密保存。',
    removed: 'Kalshi 凭证已移除。',
    connected: 'Kalshi 账户连接已验证。',
    warning: '实盘凭证可以访问真实账户。请确认账户环境和密钥无误后再保存或测试连接。',
    security: 'RSA 私钥只发送到后端并使用 Fernet 加密保存；浏览器只会收到遮罩状态。AlphaLab Paper 永远不会使用该密钥。',
    requiredKey: '请输入 Kalshi API Key ID',
    requiredPrivate: '首次连接需要粘贴 RSA Private Key',
  } : {
    title: 'Kalshi personal account API',
    subtitle: 'AlphaLab Paper needs no key. This section stores optional Kalshi production credentials only.',
    website: 'Kalshi API key page',
    environment: 'Account environment',
    production: 'Production account',
    keyId: 'API Key ID',
    privateKey: 'RSA Private Key',
    keyHint: 'Copy the Key ID from Kalshi account settings.',
    privateHint: 'Paste the complete PEM key downloaded when the API key was created. It is never displayed again.',
    save: 'Save Kalshi credentials',
    test: 'Test account connection',
    remove: 'Remove credentials',
    removeConfirm: 'Remove the Kalshi credentials for this environment?',
    saved: 'Kalshi credentials saved with encryption.',
    removed: 'Kalshi credentials removed.',
    connected: 'Kalshi account connection verified.',
    warning: 'Production credentials can access a real-money account. Confirm the account environment and keys before saving or testing.',
    security: 'The RSA private key is sent only to the backend and stored with Fernet encryption. AlphaLab Paper never uses this key.',
    requiredKey: 'Enter the Kalshi API Key ID',
    requiredPrivate: 'Paste the RSA private key for the first connection',
  };

  const current = config?.environments?.[environment];

  const loadConfig = useCallback(async () => {
    try {
      const response = await kalshiAPI.getConnectionConfig();
      setConfig(response.data);
      const selected: KalshiEnvironment = 'production';
      const summary = response.data.environments?.[selected];
      form.setFieldsValue({
        environment: selected,
        apiKeyId: summary?.apiKeyIdMasked || '',
        privateKey: '',
      });
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      const values = await form.validateFields();
      setSaving(true);
      const payload: { environment: KalshiEnvironment; apiKeyId?: string; privateKey?: string } = { environment };
      if (values.apiKeyId && !values.apiKeyId.includes('****')) payload.apiKeyId = values.apiKeyId.trim();
      if (values.privateKey && !values.privateKey.includes('****')) payload.privateKey = values.privateKey;
      const response = await kalshiAPI.saveConnectionConfig(payload);
      if (!response.data?.success) throw new Error(response.data?.message || t.config.saveFailed);
      message.success(copy.saved);
      await loadConfig();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(localizedRequestError(error, t.config.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setTesting(true);
      const response = await kalshiAPI.testConnection(environment);
      if (!response.data?.success) throw new Error(response.data?.message || t.config.connectionFailed);
      message.success(copy.connected);
      await loadConfig();
    } catch (error: any) {
      message.error(localizedRequestError(error, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    try {
      const response = await kalshiAPI.removeConnection(environment);
      if (!response.data?.success) throw new Error(response.data?.message || t.config.saveFailed);
      message.success(copy.removed);
      await loadConfig();
    } catch (error: any) {
      message.error(localizedRequestError(error, t.config.saveFailed));
    }
  };

  const status = current?.testStatus === 'connected'
    ? 'connected'
    : current?.configured ? 'saved' : 'not_tested';
  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} loading={loading} className="config-provider-card config-provider-card--kalshi">
      <SectionHeader
        icon={<ApiOutlined />}
        title={copy.title}
        subtitle={copy.subtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://kalshi.com/account/profile"
        websiteLabel={copy.website}
      />
      {environment === 'production' && <Alert type="warning" showIcon className="config-risk-alert" message={copy.warning} />}
      <Form form={form} layout="vertical" initialValues={{ environment: 'production' }}>
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item name="environment" label={<Text strong style={{ fontSize: 13 }}>{copy.environment}</Text>}>
              <Select disabled>
                <Option value="production">{copy.production}</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="apiKeyId"
              label={<Text strong style={{ fontSize: 13 }}>{copy.keyId}</Text>}
              help={copy.keyHint}
              rules={[{ validator: async (_, value) => { if (!value && !current?.configured) throw new Error(copy.requiredKey); } }]}
            >
              <Input.Password autoComplete="off" placeholder={current?.configured ? t.config.savedMasked : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item
              name="privateKey"
              label={<Text strong style={{ fontSize: 13 }}>{copy.privateKey}</Text>}
              help={current?.privateKeySaved ? `${t.config.savedMasked}. ${copy.privateHint}` : copy.privateHint}
              rules={[{ validator: async (_, value) => { if (!value && !current?.privateKeySaved) throw new Error(copy.requiredPrivate); } }]}
            >
              <Input.Password autoComplete="new-password" placeholder={current?.privateKeySaved ? t.config.savedMasked : '-----BEGIN PRIVATE KEY-----'} />
            </Form.Item>
          </Col>
        </Row>
        <div className="config-card-actions">
          {current?.configured && (
            <Popconfirm title={copy.removeConfirm} onConfirm={() => void handleRemove()}>
              <Button danger>{copy.remove}</Button>
            </Popconfirm>
          )}
          <Button onClick={handleTest} loading={testing} disabled={!current?.configured} icon={<ExperimentOutlined />}>{copy.test}</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{copy.save}</Button>
        </div>
      </Form>
      <SecurityNote text={copy.security} />
    </Card>
  );
};

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
        message.error(localizedResultMessage(res.data?.message, t.config.saveFailed));
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(localizedRequestError(e, t.config.saveFailed));
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
        message.error(localizedResultMessage(res.data?.message, t.config.connectionFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--paper">
      <SectionHeader
        icon={<ThunderboltOutlined />}
        title={t.config.paperTitle}
        subtitle={t.config.paperSubtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://app.alpaca.markets/"
        websiteLabel={t.config.alpacaWebsite}
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
        <div className="config-card-actions">
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
        message.error(localizedResultMessage(res.data?.message, t.config.saveFailed));
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(localizedRequestError(e, t.config.saveFailed));
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
        message.error(localizedResultMessage(res.data?.message, t.config.connectionFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--live">
      <SectionHeader
        icon={<BankOutlined />}
        title={t.config.liveTitle}
        subtitle={t.config.liveSubtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://app.alpaca.markets/"
        websiteLabel={t.config.alpacaWebsite}
      />
      <Alert
        message={t.config.securityWarning}
        description={t.config.securityWarningDesc}
        type="warning"
        showIcon
        className="config-risk-alert"
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
        <div className="config-card-actions">
          <Button onClick={handleTest} loading={testing} icon={<ExperimentOutlined />}>{t.config.testLiveConnection}</Button>
          <Button type="primary" className="config-save-live" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{t.config.saveLiveSettings}</Button>
        </div>
      </Form>
    </Card>
  );
};

// =====================================================================
// Section C: Alpaca Market Data
// =====================================================================
const MarketDataSection: React.FC<{ reloadKey?: number; t: any; isZh?: boolean }> = ({ reloadKey, t, isZh }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [credentialSource, setCredentialSource] = useState<string>('none');

  const loadConfig = useCallback(() => {
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
  }, [form]);

  useEffect(() => { loadConfig(); }, [loadConfig, reloadKey]);

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
        message.error(localizedResultMessage(res.data?.message, t.config.saveFailed));
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(localizedRequestError(e, t.config.saveFailed));
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
        message.error(localizedResultMessage(res.data?.message, t.config.connectionFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const hasKeys = credentialSource !== 'none';
  const inheritsBrokerKeys = credentialSource === 'real_trading' || credentialSource === 'live_trading' || credentialSource === 'paper_trading';
  const sourceLabel = credentialSource === 'market_data'
    ? (isZh ? '专用行情凭证' : 'Dedicated market-data credentials')
    : credentialSource === 'live_trading' || credentialSource === 'real_trading'
      ? (isZh ? '继承实盘券商凭证' : 'Inherited from the live broker connection')
      : credentialSource === 'paper_trading'
        ? (isZh ? '继承模拟盘券商凭证' : 'Inherited from the paper broker connection')
        : (isZh ? '尚未配置行情凭证' : 'Market-data credentials are not configured');
  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--market">
      <SectionHeader
        icon={<CloudOutlined />}
        title={t.config.marketDataTitle}
        subtitle={t.config.marketDataSubtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://app.alpaca.markets/"
        websiteLabel={t.config.alpacaWebsite}
      />
      <div style={{ marginBottom: 20 }}>
        {hasKeys ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>{sourceLabel}</Tag>
        ) : (
          <Tag color="warning" icon={<InfoCircleOutlined />}>{sourceLabel}</Tag>
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
              <Input.Password disabled={inheritsBrokerKeys} placeholder={hasKeys ? (isZh ? '已保存凭证' : 'Saved credential') : (isZh ? '输入行情 API Key' : 'Enter a market-data API key')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="api_secret" label={<Text strong style={{ fontSize: 13 }}>{isZh ? '数据 API Secret' : t.config.dataApiSecret}</Text>}>
              <Input.Password disabled={inheritsBrokerKeys} placeholder={hasKeys ? (isZh ? '已保存凭证' : 'Saved credential') : (isZh ? '输入行情 API Secret' : 'Enter a market-data API secret')} />
            </Form.Item>
          </Col>
        </Row>
        <div className="config-card-actions">
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
const PROVIDER_WEBSITES: Record<string, string> = {
  DeepSeek: 'https://platform.deepseek.com/api_keys',
  OpenAI: 'https://platform.openai.com/api-keys',
  Claude: 'https://console.anthropic.com/settings/keys',
  Gemini: 'https://aistudio.google.com/app/apikey',
  'NVIDIA NIM': 'https://build.nvidia.com/',
  Mimo: 'https://platform.mimo.ai/',
  Custom: '',
};

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
        message.error(localizedResultMessage(res.data?.message, t.config.saveFailed));
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(localizedRequestError(e, t.config.saveFailed));
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
        message.error(localizedResultMessage(res.data?.message, t.config.connectionFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--ai">
      <SectionHeader
        icon={<RobotOutlined />}
        title={t.config.aiTitle}
        subtitle={t.config.aiSubtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl={PROVIDER_WEBSITES[currentProvider]}
        websiteLabel={`${currentProvider} API`}
      />
      {keyIsMasked && (
        <Alert
          message={t.config.keyMismatch}
          description={t.config.keyMismatchDesc}
          type="error"
          showIcon
          className="config-key-alert"
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
        <div className="config-card-actions">
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
        message.error(localizedResultMessage(res.data?.message, t.config.saveFailed));
      }
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(localizedRequestError(e, t.config.saveFailed));
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
        message.error(localizedResultMessage(res.data?.message, t.config.connectionFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, t.config.connectionFailed));
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = { connected: t.config.statusConnected, saved: t.config.statusSaved, error: t.config.statusError, notTested: t.config.statusNotTested };

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--finnhub">
      <SectionHeader
        icon={<CloudOutlined />}
        title={t.config.finnhubTitle}
        subtitle={t.config.finnhubSubtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://finnhub.io/dashboard"
        websiteLabel={t.config.finnhubWebsite}
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
        <div className="config-card-actions">
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
const DiscordNotificationsSection: React.FC<{ t: any; isZh: boolean }> = ({ t, isZh }) => {
  const { tradeMode } = useTradeMode();
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('not_tested');
  const [hasSaved, setHasSaved] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const copy = isZh ? {
    title: 'Discord 通知',
    subtitle: '只发送交易结果、重要风险和精简的周期摘要。',
    loading: '正在读取通知设置…',
    saved: 'Discord 通知设置已保存。',
    saveError: 'Discord 设置无法保存，请检查后端或 Supabase 配置。',
    testSent: 'Discord 测试摘要已发送。',
    testFailed: 'Discord 测试通知发送失败。',
    quiet: '常规扫描开始和中间阶段不会发送通知；Webhook 保存后只显示遮罩值。',
    enable: '启用 Discord 通知',
    webhook: 'Discord Webhook 地址',
    savedHint: '已保存 Webhook。只有需要替换时才输入新地址。',
    newHint: '在 Discord 频道的“集成”中创建 Webhook。',
    savedPlaceholder: 'Webhook 已保存（已遮罩）',
    webhookPlaceholder: 'https://discord.com/api/webhooks/…',
    policy: '通知策略',
    trade: '交易活动',
    tradeDesc: '券商确认的买卖成交与被拒订单。',
    risk: '重要风险',
    riskDesc: '保护缺口、紧急退出与流程失败；重复状态会自动抑制。',
    digest: '操作摘要',
    digestDesc: '立即自动运行结束后发送摘要；定时任务只有发生交易或保护操作时才发送。',
    recommendations: '推荐股票',
    recommendationsDesc: '研究流程产生可买入、待复核或等待入场的候选时发送一份精简清单。',
    test: '发送测试摘要',
    save: '保存通知设置',
    connected: '已连接',
    savedStatus: '已保存',
    error: '错误',
    notConfigured: '未配置',
  } : {
    title: 'Discord notifications',
    subtitle: 'Trade outcomes, material risk alerts, and one concise cycle digest.',
    loading: 'Loading notification settings…',
    saved: 'Discord notification settings saved.',
    saveError: 'Discord settings could not be saved. Check the backend or Supabase configuration.',
    testSent: 'Discord test digest sent.',
    testFailed: 'Discord test notification failed.',
    quiet: 'Routine scan starts and intermediate stages are not sent. A saved webhook is shown only as a masked value.',
    enable: 'Enable Discord notifications',
    webhook: 'Discord webhook URL',
    savedHint: 'A webhook is saved. Enter a new URL only when replacing it.',
    newHint: 'Create a webhook in your Discord channel integrations.',
    savedPlaceholder: 'Saved webhook URL',
    webhookPlaceholder: 'https://discord.com/api/webhooks/…',
    policy: 'Notification policy',
    trade: 'Trade activity',
    tradeDesc: 'Broker-confirmed buy and sell fills, plus rejected orders.',
    risk: 'Material risk alerts',
    riskDesc: 'Protection gaps, emergency exits, and pipeline failures. Repeated conditions are muted.',
    digest: 'Action digest',
    digestDesc: 'One compact summary after Run Now; scheduled cycles stay quiet unless trading or protection changed.',
    recommendations: 'Recommended stocks',
    recommendationsDesc: 'A concise list when research produces buy-ready, review, or wait-for-entry candidates.',
    test: 'Send test digest',
    save: 'Save notification settings',
    connected: 'Connected',
    savedStatus: 'Saved',
    error: 'Error',
    notConfigured: 'Not configured',
  };

  const loadConfig = useCallback(async () => {
    try {
      const res = await userApi.get('/notifications/discord/config');
      if (res.data?.success) {
        const cfg = res.data.config || {};
        form.setFieldsValue({
          enabled: cfg.enabled === true,
          webhookUrl: cfg.webhookUrlMasked || '',
          notifyTradeActivity: cfg.notifyTradeActivity !== false,
          notifyRiskAlerts: cfg.notifyRiskAlerts !== false,
          notifyCycleDigest: cfg.notifyCycleDigest !== false,
          notifyRecommendations: cfg.notifyRecommendations !== false,
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
        notifyTradeActivity: values.notifyTradeActivity !== false,
        notifyRiskAlerts: values.notifyRiskAlerts !== false,
        notifyCycleDigest: values.notifyCycleDigest !== false,
        notifyRecommendations: values.notifyRecommendations !== false,
      };
      if (values.webhookUrl && !values.webhookUrl.includes('****')) {
        payload.webhookUrl = values.webhookUrl.trim();
      }
      const res = await userApi.post('/notifications/discord/config', payload);
      if (res.data?.success) {
        message.success(copy.saved);
        await loadConfig();
      } else {
        setStatus('error');
        console.error('Discord settings save failed:', res.data);
        message.error(copy.saveError);
      }
    } catch (e: any) {
      if (e.errorFields) return;
      setStatus('error');
      console.error('Discord settings save failed:', e);
      message.error(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const token = await requireSession(t.config.pleaseSignIn);
      if (!token) return;
      setTesting(true);
      const res = await userApi.post('/notifications/discord/test', {
        mode: tradeMode,
        eventType: 'cycle_digest',
        // Use the language visible on this page immediately. Persisting the
        // workspace preference is asynchronous, so relying only on the saved
        // preference can make a test sent right after a switch use stale copy.
        language: isZh ? 'zh-CN' : 'en-US',
      });
      if (res.data?.success) {
        setStatus('connected');
        message.success(copy.testSent);
        await loadConfig();
      } else {
        setStatus('error');
        message.error(localizedResultMessage(res.data?.message, copy.testFailed));
      }
    } catch (e: any) {
      setStatus('error');
      message.error(localizedRequestError(e, copy.testFailed));
    } finally {
      setTesting(false);
    }
  };

  const statusTexts = {
    connected: copy.connected,
    saved: copy.savedStatus,
    error: copy.error,
    notTested: hasSaved ? copy.savedStatus : copy.notConfigured,
  };

  // Only show form after config has been loaded from backend to avoid initialValues flash
  if (!configLoaded) {
    return (
      <Card bordered={false} className="config-provider-card config-provider-card--notifications">
        <SectionHeader
          icon={<BellOutlined />}
          title={copy.title}
          subtitle={copy.subtitle}
          status="not_tested"
          statusTexts={{ notTested: isZh ? '读取中' : 'Loading' }}
          websiteUrl="https://discord.com/developers/docs/resources/webhook"
          websiteLabel={isZh ? 'Discord Webhook 官网' : 'Discord Webhook docs'}
        />
        <div className="config-loading-state"><ReloadOutlined spin />{copy.loading}</div>
      </Card>
    );
  }

  return (
    <Card bordered={false} className="config-provider-card config-provider-card--notifications">
      <SectionHeader
        icon={<BellOutlined />}
        title={copy.title}
        subtitle={copy.subtitle}
        status={status}
        statusTexts={statusTexts}
        websiteUrl="https://discord.com/developers/docs/resources/webhook"
        websiteLabel={isZh ? 'Discord Webhook 官网' : 'Discord Webhook docs'}
      />
      <Alert
        type="info"
        showIcon
        className="config-info-alert"
        message={copy.quiet}
      />
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item name="enabled" label={<Text strong>{copy.enable}</Text>} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item
              name="webhookUrl"
              label={<Text strong>{copy.webhook}</Text>}
              extra={hasSaved ? copy.savedHint : copy.newHint}
            >
              <Input.Password placeholder={hasSaved ? copy.savedPlaceholder : copy.webhookPlaceholder} autoComplete="off" />
            </Form.Item>
          </Col>
        </Row>

        <Text strong className="config-policy-title">{copy.policy}</Text>
        <Row gutter={[12, 12]}>
          {[
            ['notifyTradeActivity', copy.trade, copy.tradeDesc],
            ['notifyRiskAlerts', copy.risk, copy.riskDesc],
            ['notifyCycleDigest', copy.digest, copy.digestDesc],
            ['notifyRecommendations', copy.recommendations, copy.recommendationsDesc],
          ].map(([name, title, description]) => (
            <Col xs={24} md={12} key={name}>
              <div className="config-policy-card">
                <Form.Item name={name} valuePropName="checked" noStyle>
                  <Checkbox><Text strong>{title}</Text></Checkbox>
                </Form.Item>
                <Text type="secondary">{description}</Text>
              </div>
            </Col>
          ))}
        </Row>

        <div className="config-card-actions">
          <Button onClick={handleTest} loading={testing} disabled={!hasSaved} icon={<ExperimentOutlined />}>{copy.test}</Button>
          <Button type="primary" onClick={handleSave} loading={saving} icon={<SaveOutlined />}>{copy.save}</Button>
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
  const location = useLocation();
  const { t, language } = useLanguage();
  const [marketDataReloadKey, setMarketDataReloadKey] = useState(0);
  const requestedReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const validReturnTo = typeof requestedReturnTo === 'string' && /^\/(?!\/)/.test(requestedReturnTo)
    ? requestedReturnTo
    : '/settings';
  const returnTo = validReturnTo.startsWith('/settings/configuration') ? '/settings' : validReturnTo;
  const returnsToStrategyLab = /^\/(backtest(?:\/|$)|backtest-analysis(?:\/|$)|optimize$|compare$|ranking$)/.test(returnTo);
  const backLabel = returnTo.startsWith('/agent')
    ? (language === 'zh-CN' ? '返回研究工作区' : 'Back to Research')
    : returnsToStrategyLab
      ? (language === 'zh-CN' ? '返回策略实验室' : 'Back to Strategy Lab')
      : returnTo.startsWith('/trade') || returnTo.startsWith('/portfolio')
        ? (language === 'zh-CN' ? '返回交易工作区' : 'Back to Trade')
        : returnTo.startsWith('/market') || returnTo.startsWith('/watchlist')
          ? (language === 'zh-CN' ? '返回市场工作区' : 'Back to Markets')
          : returnTo.startsWith('/dashboard') || returnTo.startsWith('/activity') || returnTo.startsWith('/system-health')
            ? (language === 'zh-CN' ? '返回总览' : 'Back to Overview')
            : t.config.backToSettings;
  const isZh = language === 'zh-CN';
  const copy = isZh ? {
    eyebrow: '设置 / 连接',
    title: '连接与服务配置',
    subtitle: '按照实际工作流配置券商、行情、AI 与通知。保存配置后再测试连接，状态才会反映当前可用性。',
    guideTitle: '配置原则',
    guideItems: ['7 个集成点', '密钥仅显示遮罩值', '先保存，再验证'],
    navTitle: '配置目录',
    brokerNav: '券商与执行',
    marketNav: '行情与数据',
    aiNav: 'AI 智能',
    notifyNav: '通知',
    brokerIndex: '01 / 券商',
    brokerTitle: '券商与执行环境',
    brokerDesc: '分别管理模拟盘和实盘凭证。建议先完成模拟盘验证，再配置真实资金环境。',
    marketIndex: '02 / 行情数据',
    marketTitle: '行情与研究数据',
    marketDesc: '配置报价、K 线、公司基本面和板块研究所需的数据源。',
    aiIndex: '03 / 模型服务',
    aiTitle: 'AI 模型服务',
    aiDesc: '选择研究审查使用的提供商、模型和兼容 API 地址。',
    notifyIndex: '04 / 通知',
    notifyTitle: '通知与提醒',
    notifyDesc: '只发送需要用户处理的交易、风险和周期摘要。',
    footer: '已保存密钥不会在页面中完整回显。生产环境请使用 HTTPS，并定期轮换凭证。',
  } : {
    eyebrow: 'SETTINGS / CONNECTIONS',
    title: 'Connections & services',
    subtitle: 'Configure broker, market data, AI, and notifications in workflow order. Save first, then verify so status reflects the current setup.',
    guideTitle: 'Configuration rules',
    guideItems: ['7 integration points', 'Secrets stay masked', 'Save, then verify'],
    navTitle: 'Configuration map',
    brokerNav: 'Broker & execution',
    marketNav: 'Market & data',
    aiNav: 'AI intelligence',
    notifyNav: 'Notifications',
    brokerIndex: '01 / BROKER',
    brokerTitle: 'Broker & execution environments',
    brokerDesc: 'Manage paper and live credentials separately. Verify paper trading before enabling a real-money environment.',
    marketIndex: '02 / MARKET DATA',
    marketTitle: 'Market & research data',
    marketDesc: 'Configure sources for quotes, bars, company fundamentals, and sector research.',
    aiIndex: '03 / INTELLIGENCE',
    aiTitle: 'AI model service',
    aiDesc: 'Choose the provider, model, and compatible API endpoint used for research review.',
    notifyIndex: '04 / NOTIFICATIONS',
    notifyTitle: 'Notifications & alerts',
    notifyDesc: 'Send only actionable trade, risk, and cycle-summary events.',
    footer: 'Saved secrets are never displayed in full. Use HTTPS in production and rotate credentials regularly.',
  };

  useEffect(() => {
    const allowedTargets = ['#broker', '#paper', '#live', '#kalshi', '#market-data', '#finnhub', '#ai', '#notifications'];
    if (!allowedTargets.includes(location.hash)) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div className="configuration-page">
      <Button className="configuration-back" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(returnTo)}>
        {backLabel}
      </Button>

      <header className="configuration-hero">
        <div className="configuration-hero__copy">
          <span className="configuration-eyebrow"><ApiOutlined />{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="configuration-guide">
          <span>{copy.guideTitle}</span>
          <ol>
            {copy.guideItems.map((item, index) => <li key={item}><b>0{index + 1}</b>{item}</li>)}
          </ol>
        </div>
      </header>

      <div className="configuration-layout">
        <aside className="configuration-nav" aria-label={copy.navTitle}>
          <span>{copy.navTitle}</span>
          <a href="#broker"><b>01</b>{copy.brokerNav}</a>
          <a href="#market-data"><b>02</b>{copy.marketNav}</a>
          <a href="#ai"><b>03</b>{copy.aiNav}</a>
          <a href="#notifications"><b>04</b>{copy.notifyNav}</a>
          <div className="configuration-nav__security"><SafetyCertificateOutlined /><p>{copy.footer}</p></div>
        </aside>

        <main className="configuration-content">
          <section className="configuration-group" id="broker">
            <header className="configuration-group__header">
              <span>{copy.brokerIndex}</span>
              <div><h2>{copy.brokerTitle}</h2><p>{copy.brokerDesc}</p></div>
            </header>
            <div className="configuration-anchor" id="paper" data-tour="config-paper"><AlpacaPaperSection t={t} /></div>
            <div className="configuration-anchor" id="live"><AlpacaRealSection onMarketDataSynced={() => setMarketDataReloadKey((key) => key + 1)} t={t} /></div>
            <div className="configuration-anchor" id="kalshi" data-tour="config-kalshi"><KalshiPersonalSection t={t} isZh={isZh} /></div>
          </section>

          <section className="configuration-group" id="market-data">
            <header className="configuration-group__header">
              <span>{copy.marketIndex}</span>
              <div><h2>{copy.marketTitle}</h2><p>{copy.marketDesc}</p></div>
            </header>
            <div className="configuration-anchor" id="market-provider" data-tour="config-market"><MarketDataSection reloadKey={marketDataReloadKey} t={t} isZh={isZh} /></div>
            <div className="configuration-anchor" id="finnhub" data-tour="config-finnhub"><FinnhubSection t={t} /></div>
          </section>

          <section className="configuration-group" id="ai">
            <header className="configuration-group__header">
              <span>{copy.aiIndex}</span>
              <div><h2>{copy.aiTitle}</h2><p>{copy.aiDesc}</p></div>
            </header>
            <div className="configuration-anchor" id="ai-provider" data-tour="config-ai"><AIProviderSection t={t} /></div>
          </section>

          <section className="configuration-group" id="notifications">
            <header className="configuration-group__header">
              <span>{copy.notifyIndex}</span>
              <div><h2>{copy.notifyTitle}</h2><p>{copy.notifyDesc}</p></div>
            </header>
            <DiscordNotificationsSection t={t} isZh={isZh} />
          </section>

          <footer className="configuration-footer"><SafetyCertificateOutlined />{copy.footer}</footer>
        </main>
      </div>
    </div>
  );
};

export default Configuration;
