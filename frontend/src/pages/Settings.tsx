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
  ReloadOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { clearConfigStatusCache, ConfigStatusLoadResult, loadConfigStatus } from '../services/api';

const { Title, Text, Paragraph } = Typography;

type ServiceStatus =
  | 'loading'
  | 'connected'
  | 'not_configured'
  | 'backend_waking'
  | 'backend_timeout'
  | 'session_unavailable'
  | 'restoring_session'
  | 'unauthorized'
  | 'backend_unreachable'
  | 'api_base_url_missing'
  | 'connection_check_failed'
  | 'service_error'
  | 'schema_migration';

type ProviderStatus = 'alpaca' | 'ai' | 'finnhub';

const allStatuses = (status: ServiceStatus): Record<ProviderStatus, ServiceStatus> => ({
  alpaca: status,
  ai: status,
  finnhub: status
});

const providerStatusToServiceStatus = (status?: string): ServiceStatus => {
  if (status === 'connected') return 'connected';
  if (status === 'not_configured') return 'not_configured';
  if (status === 'checking') return 'backend_waking';
  if (status === 'error') return 'connection_check_failed';
  return 'service_error';
};

const resultToServiceStatus = (result: ConfigStatusLoadResult): ServiceStatus => {
  switch (result.errorCode) {
    case 'api_base_url_missing':
      return 'api_base_url_missing';
    case 'supabase_auth_unavailable':
      return 'session_unavailable';
    case 'backend_waking':
      return 'backend_waking';
    case 'backend_timeout':
      return 'backend_timeout';
    case 'backend_unreachable':
      return 'backend_unreachable';
    case 'unauthorized':
    case 'auth_required':
      return 'unauthorized';
    case 'schema_migration':
      return 'schema_migration';
    default:
      return 'connection_check_failed';
  }
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, loading, logout } = useAuth();
  const { t } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();
  const requestIdRef = useRef(0);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [statuses, setStatuses] = useState<Record<ProviderStatus, ServiceStatus>>({
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
      if (loading) {
        if (isCurrentRequest()) {
          setStatuses(allStatuses('restoring_session'));
          setStatusMessage('Restoring session...');
        }
        return;
      }

      if (isCurrentRequest()) {
        setStatuses(allStatuses('loading'));
        setStatusMessage('');
      }

      if (!user || !session?.access_token) {
        if (isCurrentRequest()) {
          setStatuses(allStatuses('unauthorized'));
          setStatusMessage('Please sign in again');
        }
        return;
      }

      const result = await loadConfigStatus({
        force: statusRefreshKey > 0,
        timeoutMs: 10000,
        onRetry: (retryResult) => {
          if (isCurrentRequest()) {
            setStatuses(allStatuses('backend_waking'));
            setStatusMessage(retryResult.message);
          }
        }
      });

      if (!isCurrentRequest()) return;

      if (!result.ok || !result.data?.success) {
        setStatuses(allStatuses(resultToServiceStatus(result)));
        setStatusMessage(result.message);
        return;
      }

      setStatuses({
        alpaca: providerStatusToServiceStatus(result.data.alpaca?.status),
        ai: providerStatusToServiceStatus(result.data.aiProvider?.status),
        finnhub: providerStatusToServiceStatus(result.data.finnhub?.status)
      });
      setStatusMessage(result.data.message || '');
    };
    checkStatuses();
    return () => {
      mounted = false;
    };
  }, [loading, user, session, statusRefreshKey]);

  const StatusTag = ({ status }: { status: ServiceStatus }) => {
    if (status === 'loading') return <Badge status="processing" text={t.settings.checking} />;
    if (status === 'backend_waking') return <Badge status="processing" text="Backend waking up..." />;
    if (status === 'connected') return <Tag color="success">{t.settings.configured}</Tag>;
    if (status === 'restoring_session') return <Badge status="processing" text="Restoring session..." />;
    if (status === 'session_unavailable') return <Tag color="warning">Supabase auth unavailable</Tag>;
    if (status === 'unauthorized') return <Tag color="error">Please sign in again</Tag>;
    if (status === 'backend_unreachable') return <Tag color="error">Backend unreachable</Tag>;
    if (status === 'backend_timeout') return <Tag color="error">Backend timeout</Tag>;
    if (status === 'api_base_url_missing') return <Tag color="error">Backend URL missing</Tag>;
    if (status === 'connection_check_failed') return <Tag color="error">Connection check failed</Tag>;
    if (status === 'schema_migration') return <Tag color="warning">Schema migration needed</Tag>;
    if (status === 'service_error') return <Tag color="error">Configuration service error</Tag>;
    return <Tag color="default">{t.settings.notConfigured}</Tag>;
  };

  const retryStatuses = () => {
    clearConfigStatusCache();
    setStatusRefreshKey(key => key + 1);
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
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<ReloadOutlined />} onClick={retryStatuses} style={{ borderRadius: 8, fontWeight: 600 }}>
            Verify connections
          </Button>
          {statusMessage && (
            <Text style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
              {statusMessage}
            </Text>
          )}
        </div>
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
