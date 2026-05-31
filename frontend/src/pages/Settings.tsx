import React, { useState, useEffect, useRef } from 'react';
import { Typography, Card, Button, Space, Row, Col, Badge, Tag, Divider, Radio, Modal, Descriptions, Alert } from 'antd';
import { 
  SettingOutlined, 
  ApiOutlined, 
  ArrowRightOutlined, 
  UserOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const { Title, Text, Paragraph } = Typography;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
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
userApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const hadAuthHeader = !!error.config?.headers?.Authorization;
    if (error.response?.status === 401 && hadAuthHeader) {
      await supabase.auth.signOut();
      window.location.href = '/signin';
    }
    return Promise.reject(error);
  }
);

type ServiceStatus =
  | 'loading'
  | 'connected'
  | 'not_configured'
  | 'backend_waking'
  | 'session_unavailable'
  | 'unauthorized'
  | 'backend_unreachable'
  | 'service_error'
  | 'schema_migration';

const STATUS_RETRY_DELAYS = [800, 1500];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getWithRetry = async (url: string) => {
  let lastError: any;
  for (let attempt = 0; attempt <= STATUS_RETRY_DELAYS.length; attempt += 1) {
    try {
      return await userApi.get(url);
    } catch (error: any) {
      lastError = error;
      const status = error.response?.status;
      if (status === 401 || status === 403) throw error;
      if (attempt < STATUS_RETRY_DELAYS.length) {
        await sleep(STATUS_RETRY_DELAYS[attempt]);
      }
    }
  }
  throw lastError;
};

const resolveStatusError = (error: any): ServiceStatus => {
  if (!error.response) return 'backend_unreachable';
  if (error.response.status === 401 || error.response.status === 403) return 'unauthorized';
  const code = error.response.data?.code || '';
  const msg = `${error.response.data?.message || ''} ${error.response.data?.error || ''}`;
  if (code.includes('config_type') || msg.toLowerCase().includes('migration')) return 'schema_migration';
  return 'service_error';
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, loading, logout } = useAuth();
  const { t } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();
  const requestIdRef = useRef(0);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [statuses, setStatuses] = useState<Record<'alpaca' | 'ai' | 'finnhub', ServiceStatus>>({
    alpaca: 'loading',
    ai: 'loading',
    finnhub: 'loading'
  });

  useEffect(() => {
    let mounted = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => mounted && requestIdRef.current === requestId;

    const checkStatuses = async () => {
      if (loading) return;
      if (isCurrentRequest()) {
        setStatuses({
          alpaca: 'loading',
          ai: 'loading',
          finnhub: 'loading'
        });
      }
      if (!user || !session?.access_token) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.access_token) {
          if (isCurrentRequest()) setStatuses({
            alpaca: 'session_unavailable',
            ai: 'session_unavailable',
            finnhub: 'session_unavailable'
          });
          return;
        }
      }

      try {
        try {
          await getWithRetry('/health');
        } catch (healthError) {
          if (isCurrentRequest()) setStatuses({
            alpaca: 'backend_unreachable',
            ai: 'backend_unreachable',
            finnhub: 'backend_unreachable'
          });
          return;
        }

        const [alpacaRes, aiRes, finnhubRes] = await Promise.all([
          getWithRetry('/settings/broker-config').then(
            res => ({ status: 'fulfilled' as const, value: res }),
            reason => ({ status: 'rejected' as const, reason })
          ),
          getWithRetry('/settings/ai-config').then(
            res => ({ status: 'fulfilled' as const, value: res }),
            reason => ({ status: 'rejected' as const, reason })
          ),
          getWithRetry('/settings/finnhub-config').then(
            res => ({ status: 'fulfilled' as const, value: res }),
            reason => ({ status: 'rejected' as const, reason })
          )
        ]);

        const alpacaConfig = alpacaRes.status === 'fulfilled' ? alpacaRes.value.data?.config : null;
        if (!isCurrentRequest()) return;
        setStatuses({
          alpaca: alpacaRes.status === 'rejected'
            ? resolveStatusError(alpacaRes.reason)
            : (alpacaConfig?.paper_api_key || alpacaConfig?.paper_api_key_masked || alpacaConfig?.live_api_key || alpacaConfig?.live_api_key_masked)
              ? 'connected'
              : 'not_configured',
          ai: aiRes.status === 'rejected' ? resolveStatusError(aiRes.reason) : aiRes.value.data?.hasUserKey ? 'connected' : 'not_configured',
          finnhub: finnhubRes.status === 'rejected'
            ? resolveStatusError(finnhubRes.reason)
            : (finnhubRes.value.data?.config?.api_key || finnhubRes.value.data?.config?.api_key_masked)
              ? 'connected'
              : 'not_configured'
        });
      } catch (e) {
        console.error('Failed to fetch statuses', e);
        if (isCurrentRequest()) setStatuses({
          alpaca: resolveStatusError(e),
          ai: resolveStatusError(e),
          finnhub: resolveStatusError(e)
        });
      }
    };
    checkStatuses();
    return () => {
      mounted = false;
    };
  }, [loading, user, session]);

  const StatusTag = ({ status }: { status: ServiceStatus }) => {
    if (status === 'loading') return <Badge status="processing" text={t.settings.checking} />;
    if (status === 'backend_waking') return <Badge status="processing" text="Backend waking up..." />;
    if (status === 'connected') return <Tag color="success">{t.settings.configured}</Tag>;
    if (status === 'session_unavailable') return <Tag color="warning">Session unavailable</Tag>;
    if (status === 'unauthorized') return <Tag color="error">Sign in again</Tag>;
    if (status === 'backend_unreachable') return <Tag color="error">Backend unreachable</Tag>;
    if (status === 'schema_migration') return <Tag color="warning">Schema migration needed</Tag>;
    if (status === 'service_error') return <Tag color="error">Configuration service error</Tag>;
    return <Tag color="default">{t.settings.notConfigured}</Tag>;
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 40px' }}>
      <div style={{ marginBottom: 40 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', color: 'var(--app-text-strong)', fontWeight: 800, letterSpacing: '-0.5px' }}>
          <SettingOutlined style={{ marginRight: 16, color: 'var(--app-blue-text)' }} />
          {t.settings.title}
        </Title>
        <Text style={{ fontSize: 16, color: 'var(--app-text-muted)', fontWeight: 500 }}>
          {t.settings.subtitle}
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="summary-card" 
            style={{ 
              background: 'var(--app-card-bg)', 
              boxShadow: 'var(--app-shadow)', 
              borderRadius: 12,
              border: '1px solid var(--app-border-soft)'
            }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--app-text-muted)', letterSpacing: '0.5px' }}>{t.settings.tradingProvider}</Text>
                <ThunderboltOutlined style={{ color: '#fbbf24' }} />
              </div>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)', fontWeight: 700 }}>Alpaca Markets</Title>
              <StatusTag status={statuses.alpaca} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="summary-card" 
            style={{ 
              background: 'var(--app-card-bg)', 
              boxShadow: 'var(--app-shadow)', 
              borderRadius: 12,
              border: '1px solid var(--app-border-soft)'
            }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--app-text-muted)', letterSpacing: '0.5px' }}>{t.settings.intelligence}</Text>
                <RobotOutlined style={{ color: 'var(--app-blue-text)' }} />
              </div>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)', fontWeight: 700 }}>{t.settings.aiProvider}</Title>
              <StatusTag status={statuses.ai} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            bordered={false} 
            className="summary-card" 
            style={{ 
              background: 'var(--app-card-bg)', 
              boxShadow: 'var(--app-shadow)', 
              borderRadius: 12,
              border: '1px solid var(--app-border-soft)'
            }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--app-text-muted)', letterSpacing: '0.5px' }}>{t.settings.marketData}</Text>
                <CloudServerOutlined style={{ color: '#4ade80' }} />
              </div>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)', fontWeight: 700 }}>Finnhub API</Title>
              <StatusTag status={statuses.finnhub} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Title level={4} style={{ marginBottom: 16, color: 'var(--app-text-strong)' }}>Appearance</Title>
      <Card bordered={false} style={{ marginBottom: 24, borderRadius: 12, border: '1px solid var(--app-border-soft)', background: 'var(--app-card-bg)', boxShadow: 'var(--app-shadow-sm)' }} bodyStyle={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: 'var(--app-card-bg-soft)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid var(--app-border-soft)'
            }}>
              <BgColorsOutlined style={{ fontSize: 24, color: 'var(--app-blue-text)' }} />
            </div>
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)' }}>Theme</Title>
              <Text style={{ fontSize: 14, color: 'var(--app-text-muted)' }}>
                Customize how AlphaLab looks on this device.
                {themeMode === 'system' && <span style={{ marginLeft: 8, fontStyle: 'italic', opacity: 0.8 }}>(Follows system appearance)</span>}
              </Text>
            </Space>
          </div>
          <Radio.Group value={themeMode} onChange={(e) => setThemeMode(e.target.value)} size="middle">
            <Radio.Button value="light">Light</Radio.Button>
            <Radio.Button value="dark">Dark</Radio.Button>
            <Radio.Button value="system">System</Radio.Button>
          </Radio.Group>
        </div>
      </Card>

      <Title level={4} style={{ marginBottom: 16, color: 'var(--app-text-strong)' }}>{t.settings.platformManagement}</Title>
      
      <Card
        hoverable
        style={{ marginBottom: 24, borderRadius: 12, border: '1px solid var(--app-border-soft)', background: 'var(--app-card-bg)', boxShadow: 'var(--app-shadow-sm)' }}
        bodyStyle={{ padding: 24 }}
        onClick={() => navigate('/settings/configuration')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: 'var(--app-blue-bg-soft)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ApiOutlined style={{ fontSize: 24, color: 'var(--app-blue-text)' }} />
            </div>
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)' }}>{t.settings.connectionConfig}</Title>
              <Text style={{ fontSize: 14, color: 'var(--app-text-muted)' }}>
                {t.settings.connectionConfigDesc}
              </Text>
            </Space>
          </div>
          <ArrowRightOutlined style={{ fontSize: 18, color: 'var(--app-text-muted)' }} />
        </div>
      </Card>

      <Divider style={{ margin: '40px 0', borderColor: 'var(--app-border-soft)' }} />

      <Title level={4} style={{ marginBottom: 16, color: 'var(--app-text-strong)' }}>{t.settings.securityAccount}</Title>
      <Card bordered={false} style={{ background: 'var(--app-card-bg-soft)', borderRadius: 12, border: '1px solid var(--app-border-soft)' }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={14}>
            <Space size={16} align="start">
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--app-card-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--app-border-soft)'
              }}>
                <UserOutlined style={{ color: 'var(--app-text-muted)' }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 16, color: 'var(--app-text-strong)' }}>{t.settings.accountInfo}</Text>
                <Paragraph style={{ margin: 0, color: 'var(--app-text-muted)' }}>
                  {t.settings.loggedInAs} <Text strong style={{ color: 'var(--app-text-strong)' }}>{user?.email}</Text>
                </Paragraph>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={10}>
            <Space size={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                icon={<SafetyCertificateOutlined />} 
                onClick={() => setSecurityModalVisible(true)}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                {t.settings.securitySettings}
              </Button>
              <Button
                icon={<LogoutOutlined />}
                onClick={async () => { await logout(); navigate('/signin'); }}
                style={{ borderRadius: 8, fontWeight: 600, borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }}
              >
                {t.settings.signOut}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Security Info Modal */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--app-text-strong)' }}>
            <SafetyCertificateOutlined style={{ color: 'var(--app-blue-text)' }} />
            Security Info
          </span>
        }
        open={securityModalVisible}
        onCancel={() => setSecurityModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setSecurityModalVisible(false)} style={{ borderRadius: 8 }}>Close</Button>
        }
        width={480}
        destroyOnClose
        className="dark-modal"
      >
        <Descriptions 
          column={1} 
          bordered 
          size="small" 
          style={{ marginBottom: 16 }}
          labelStyle={{ background: 'var(--app-card-bg-soft)', color: 'var(--app-text-muted)', fontWeight: 600 }}
          contentStyle={{ background: 'var(--app-card-bg)', color: 'var(--app-text-strong)' }}
        >
          <Descriptions.Item label="Email">{user?.email || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Auth Provider">Supabase</Descriptions.Item>
          <Descriptions.Item label="Session">
            {session ? 'Active' : 'No active session'}
          </Descriptions.Item>
        </Descriptions>
        <Alert
          message={<span style={{ fontWeight: 600 }}>Auth Security</span>}
          description="Password and account security are managed by Supabase / Auth provider."
          type="info"
          showIcon
          style={{ marginBottom: 12, borderRadius: 8, background: 'var(--app-blue-bg-soft)', border: '1px solid var(--app-blue-border)' }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
            Coming soon: MFA, session management, and activity log.
          </Text>
        </Space>
        <Divider style={{ margin: '16px 0', borderColor: 'var(--app-border-soft)' }} />
        <Button
          block
          icon={<LogoutOutlined />}
          danger
          type="primary"
          onClick={async () => { await logout(); navigate('/signin'); }}
          style={{ borderRadius: 8, height: 40, fontWeight: 700 }}
        >
          Sign Out
        </Button>
      </Modal>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          AlphaLab Quantitative Trading Platform &copy; 2026. {t.settings.footerNote}
        </Text>
      </div>

      <style>{`
        .summary-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .summary-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--app-shadow) !important;
        }
      `}</style>
    </div>
  );
};

export default Settings;
