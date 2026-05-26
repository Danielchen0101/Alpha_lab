import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Space, Row, Col, Badge, Tag, Divider } from 'antd';
import { 
  SettingOutlined, 
  ApiOutlined, 
  ArrowRightOutlined, 
  UserOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const { Title, Text, Paragraph } = Typography;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
const userApi = axios.create({ baseURL: API_BASE_URL, timeout: 5000 });
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
  | 'session_unavailable'
  | 'unauthorized'
  | 'backend_unreachable'
  | 'service_error'
  | 'schema_migration';

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
  const [statuses, setStatuses] = useState<Record<'alpaca' | 'ai' | 'finnhub', ServiceStatus>>({
    alpaca: 'loading',
    ai: 'loading',
    finnhub: 'loading'
  });

  useEffect(() => {
    const checkStatuses = async () => {
      if (loading) return;
      if (!user || !session?.access_token) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.access_token) {
          setStatuses({
            alpaca: 'session_unavailable',
            ai: 'session_unavailable',
            finnhub: 'session_unavailable'
          });
          return;
        }
      }

      try {
        const [alpacaRes, aiRes, finnhubRes] = await Promise.allSettled([
          userApi.get('/settings/broker-config'),
          userApi.get('/settings/ai-config'),
          userApi.get('/settings/finnhub-config')
        ]);

        const alpacaConfig = alpacaRes.status === 'fulfilled' ? alpacaRes.value.data?.config : null;
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
      }
    };
    checkStatuses();
  }, [loading, user, session]);

  const StatusTag = ({ status }: { status: ServiceStatus }) => {
    if (status === 'loading') return <Badge status="processing" text={t.settings.checking} />;
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
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
          <SettingOutlined style={{ marginRight: 16, color: '#1890ff' }} />
          {t.settings.title}
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          {t.settings.subtitle}
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} className="summary-card" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t.settings.tradingProvider}</Text>
                <ThunderboltOutlined style={{ color: '#faad14' }} />
              </div>
              <Title level={4} style={{ margin: 0 }}>Alpaca Markets</Title>
              <StatusTag status={statuses.alpaca} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} className="summary-card" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t.settings.intelligence}</Text>
                <RobotOutlined style={{ color: '#13c2c2' }} />
              </div>
              <Title level={4} style={{ margin: 0 }}>{t.settings.aiProvider}</Title>
              <StatusTag status={statuses.ai} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} className="summary-card" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t.settings.marketData}</Text>
                <CloudServerOutlined style={{ color: '#52c41a' }} />
              </div>
              <Title level={4} style={{ margin: 0 }}>Finnhub API</Title>
              <StatusTag status={statuses.finnhub} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Title level={4} style={{ marginBottom: 16 }}>{t.settings.platformManagement}</Title>
      
      <Card
        hoverable
        style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: 24 }}
        onClick={() => navigate('/settings/configuration')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12, 
              background: '#e6f7ff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ApiOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </div>
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>{t.settings.connectionConfig}</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                {t.settings.connectionConfigDesc}
              </Text>
            </Space>
          </div>
          <ArrowRightOutlined style={{ fontSize: 18, color: '#bfbfbf' }} />
        </div>
      </Card>

      <Divider style={{ margin: '40px 0' }} />

      <Title level={4} style={{ marginBottom: 16 }}>{t.settings.securityAccount}</Title>
      <Card bordered={false} style={{ background: '#fafafa', borderRadius: 12 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={14}>
            <Space size={16} align="start">
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #f0f0f0'
              }}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 16 }}>{t.settings.accountInfo}</Text>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {t.settings.loggedInAs} <Text strong>{user?.email}</Text>
                </Paragraph>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={10}>
            <Space size={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button icon={<SafetyCertificateOutlined />}>{t.settings.securitySettings}</Button>
              <Button
                icon={<LogoutOutlined />}
                onClick={async () => { await logout(); navigate('/signin'); }}
                style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
              >
                {t.settings.signOut}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

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
          box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
        }
      `}</style>
    </div>
  );
};

export default Settings;
