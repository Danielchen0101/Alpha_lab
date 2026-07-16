import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Descriptions, Modal } from 'antd';
import {
  ApiOutlined,
  ArrowRightOutlined,
  BgColorsOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  MoonOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SunOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { clearConfigStatusCache, ConfigStatusLoadResult, loadConfigStatus } from '../services/api';
import './SettingsEditorial.css';

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
  finnhub: status,
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
    case 'api_base_url_missing': return 'api_base_url_missing';
    case 'supabase_auth_unavailable': return 'session_unavailable';
    case 'backend_waking': return 'backend_waking';
    case 'backend_timeout': return 'backend_timeout';
    case 'backend_unreachable': return 'backend_unreachable';
    case 'unauthorized':
    case 'auth_required': return 'unauthorized';
    case 'schema_migration': return 'schema_migration';
    default: return 'connection_check_failed';
  }
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, loading, logout } = useAuth();
  const { language } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();
  const isZh = language === 'zh-CN';
  const requestIdRef = useRef(0);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [statuses, setStatuses] = useState<Record<ProviderStatus, ServiceStatus>>({
    alpaca: 'loading',
    ai: 'loading',
    finnhub: 'loading',
  });

  const copy = isZh ? {
    eyebrow: '工作区 / 设置',
    statusIndex: '01 / 状态',
    integrationsIndex: '02 / 连接',
    displayIndex: '03 / 显示',
    accountIndex: '04 / 账户',
    title: '配置中心',
    subtitle: '集中管理连接、显示偏好与账户安全。此页显示配置状态，实际连通性在各服务的测试按钮中验证。',
    verify: '刷新状态',
    overview: '连接状态',
    overviewDesc: '研究与交易依赖项的当前配置摘要',
    available: '项已配置',
    of: '共 3 项服务',
    broker: '券商与执行',
    brokerName: 'Alpaca Markets',
    brokerDesc: '模拟盘、实盘凭证与订单执行环境',
    intelligence: 'AI 智能',
    intelligenceName: '模型提供商',
    intelligenceDesc: '研究审查、策略解释与候选分析',
    market: '市场数据',
    marketName: 'Finnhub / Alpaca',
    marketDesc: '报价、K 线、公司与板块数据',
    manage: '管理配置',
    connections: '连接与数据源',
    connectionsDesc: '配置券商、行情、AI 与通知服务。密钥输入仅在需要替换时填写。',
    openConnections: '打开连接配置',
    secureTitle: '凭证安全',
    secureDesc: '已保存的密钥只显示遮罩值。连接测试和保存是两个独立动作。',
    appearance: '显示偏好',
    appearanceDesc: '选择适合当前设备与环境的界面模式。',
    light: '浅色',
    lightDesc: '明亮、纸张质感',
    dark: '深色',
    darkDesc: '低光环境',
    system: '跟随系统',
    systemDesc: '自动匹配设备',
    selected: '当前',
    account: '账户与安全',
    signedInAs: '当前登录账户',
    activeSession: '会话有效',
    inactiveSession: '会话不可用',
    security: '查看安全信息',
    signOut: '退出登录',
    modalTitle: '账户安全信息',
    email: '账户邮箱',
    provider: '认证服务',
    session: '当前会话',
    credentialPolicy: '凭证显示',
    active: '有效',
    inactive: '无有效会话',
    masked: '仅返回遮罩值',
    securityMessage: '安全边界',
    securityDescription: '账户认证由 Supabase 管理；外部服务密钥经认证后保存，页面不会回显完整密钥。若怀疑密钥泄露，请立即在对应提供商后台轮换。',
    close: '完成',
  } : {
    eyebrow: 'WORKSPACE / SETTINGS',
    statusIndex: '01 / STATUS',
    integrationsIndex: '02 / INTEGRATIONS',
    displayIndex: '03 / DISPLAY',
    accountIndex: '04 / ACCOUNT',
    title: 'Settings center',
    subtitle: 'Manage connections, display preferences, and account security in one place. This page shows saved configuration; each service has a separate connection test.',
    verify: 'Refresh status',
    overview: 'Connection status',
    overviewDesc: 'Current setup for research and trading dependencies',
    available: 'configured',
    of: 'of 3 services',
    broker: 'Broker & execution',
    brokerName: 'Alpaca Markets',
    brokerDesc: 'Paper, live credentials, and order execution',
    intelligence: 'AI intelligence',
    intelligenceName: 'Model provider',
    intelligenceDesc: 'Research review, explanations, and candidate analysis',
    market: 'Market data',
    marketName: 'Finnhub / Alpaca',
    marketDesc: 'Quotes, bars, company, and sector data',
    manage: 'Manage',
    connections: 'Connections & data sources',
    connectionsDesc: 'Configure broker, market data, AI, and notification services. Enter a secret only when replacing it.',
    openConnections: 'Open connection settings',
    secureTitle: 'Credential safety',
    secureDesc: 'Saved secrets are shown only as masked values. Testing and saving are separate actions.',
    appearance: 'Display preferences',
    appearanceDesc: 'Choose the interface mode that fits this device and environment.',
    light: 'Light',
    lightDesc: 'Bright paper surface',
    dark: 'Dark',
    darkDesc: 'For low-light work',
    system: 'System',
    systemDesc: 'Match this device',
    selected: 'Active',
    account: 'Account & security',
    signedInAs: 'Signed in as',
    activeSession: 'Session active',
    inactiveSession: 'Session unavailable',
    security: 'Security details',
    signOut: 'Sign out',
    modalTitle: 'Account security',
    email: 'Account email',
    provider: 'Authentication',
    session: 'Current session',
    credentialPolicy: 'Secret display',
    active: 'Active',
    inactive: 'No active session',
    masked: 'Masked values only',
    securityMessage: 'Security boundary',
    securityDescription: 'Supabase manages account authentication. External-service credentials are saved after authentication and full secrets are never returned to this page. Rotate a key at its provider immediately if exposure is suspected.',
    close: 'Done',
  };

  useEffect(() => {
    let mounted = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => mounted && requestIdRef.current === requestId;

    const checkStatuses = async () => {
      const localizedStatusMessage = (errorCode: ConfigStatusLoadResult['errorCode'], fallback: string) => {
        if (!isZh) return fallback;
        switch (errorCode) {
          case 'api_base_url_missing': return '尚未配置后端服务地址。';
          case 'supabase_auth_unavailable': return '认证服务暂时不可用，请稍后重试。';
          case 'backend_waking': return '服务正在启动，连接状态会自动重试。';
          case 'backend_timeout': return '状态检查超时，请稍后刷新。';
          case 'backend_unreachable': return '暂时无法连接后端服务。';
          case 'unauthorized':
          case 'auth_required': return '登录会话已失效，请重新登录。';
          case 'schema_migration': return '服务正在更新配置结构，请稍后刷新。';
          default: return '暂时无法检查连接状态，请稍后重试。';
        }
      };

      if (loading) {
        if (isCurrentRequest()) {
          setStatuses(allStatuses('restoring_session'));
          setStatusMessage(isZh ? '正在恢复登录会话…' : 'Restoring session…');
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
          setStatusMessage(isZh ? '登录会话已失效，请重新登录。' : 'Your session has expired. Please sign in again.');
        }
        return;
      }

      const result = await loadConfigStatus({
        force: statusRefreshKey > 0,
        timeoutMs: 10000,
        onRetry: (retryResult) => {
          if (isCurrentRequest()) {
            setStatuses(allStatuses('backend_waking'));
            setStatusMessage(localizedStatusMessage(retryResult.errorCode, retryResult.message));
          }
        },
      });

      if (!isCurrentRequest()) return;
      if (!result.ok || !result.data?.success) {
        setStatuses(allStatuses(resultToServiceStatus(result)));
        setStatusMessage(localizedStatusMessage(result.errorCode, result.message));
        return;
      }

      const marketDataConfigured = Boolean(result.data.alpacaMarketData?.configured || result.data.finnhub?.configured);
      setStatuses({
        alpaca: providerStatusToServiceStatus(result.data.alpaca?.status),
        ai: providerStatusToServiceStatus(result.data.aiProvider?.status),
        finnhub: marketDataConfigured ? 'connected' : providerStatusToServiceStatus(result.data.finnhub?.status),
      });
      setStatusMessage('');
    };

    checkStatuses();
    return () => { mounted = false; };
  }, [isZh, loading, session, statusRefreshKey, user]);

  const statusPresentation = (status: ServiceStatus) => {
    if (status === 'connected') return { tone: 'ready', label: isZh ? '已配置' : 'Configured', icon: <CheckCircleOutlined /> };
    if (['loading', 'backend_waking', 'restoring_session'].includes(status)) {
      return { tone: 'checking', label: isZh ? '检查中' : 'Checking', icon: <ReloadOutlined spin /> };
    }
    if (status === 'not_configured') return { tone: 'empty', label: isZh ? '待配置' : 'Not configured', icon: <KeyOutlined /> };
    if (['session_unavailable', 'unauthorized'].includes(status)) {
      return { tone: 'attention', label: isZh ? '需要登录' : 'Sign-in required', icon: <ExclamationCircleOutlined /> };
    }
    return { tone: 'attention', label: isZh ? '需要检查' : 'Needs attention', icon: <ExclamationCircleOutlined /> };
  };

  const retryStatuses = () => {
    clearConfigStatusCache();
    setStatusRefreshKey((key) => key + 1);
  };

  const providers = [
    { key: 'alpaca' as const, section: 'paper', icon: <ThunderboltOutlined />, category: copy.broker, name: copy.brokerName, description: copy.brokerDesc },
    { key: 'ai' as const, section: 'ai', icon: <RobotOutlined />, category: copy.intelligence, name: copy.intelligenceName, description: copy.intelligenceDesc },
    { key: 'finnhub' as const, section: 'finnhub', icon: <CloudServerOutlined />, category: copy.market, name: copy.marketName, description: copy.marketDesc },
  ];
  const readyCount = Object.values(statuses).filter((status) => status === 'connected').length;
  const themeOptions = [
    { value: 'light', label: copy.light, description: copy.lightDesc, icon: <SunOutlined /> },
    { value: 'dark', label: copy.dark, description: copy.darkDesc, icon: <MoonOutlined /> },
    { value: 'system', label: copy.system, description: copy.systemDesc, icon: <DesktopOutlined /> },
  ];

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div className="settings-hero__copy">
          <span className="settings-eyebrow"><SettingOutlined /> {copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <Button className="settings-verify" icon={<ReloadOutlined />} onClick={retryStatuses}>
          {copy.verify}
        </Button>
      </header>

      <section className="settings-status" aria-labelledby="settings-status-title">
        <div className="settings-status__summary">
          <span className="settings-section-index">{copy.statusIndex}</span>
          <h2 id="settings-status-title">{copy.overview}</h2>
          <p>{copy.overviewDesc}</p>
          <div className="settings-status__count">
            <strong>{readyCount}</strong>
            <div><b>{copy.available}</b><span>{copy.of}</span></div>
          </div>
          {statusMessage && <p className="settings-status__message">{statusMessage}</p>}
        </div>
        <div className="settings-provider-grid">
          {providers.map((provider) => {
            const visual = statusPresentation(statuses[provider.key]);
            return (
              <button
                type="button"
                className="settings-provider-card"
                key={provider.key}
                onClick={() => navigate(`/settings/configuration#${provider.section}`)}
              >
                <span className="settings-provider-card__icon">{provider.icon}</span>
                <span className="settings-provider-card__body">
                  <small>{provider.category}</small>
                  <strong>{provider.name}</strong>
                  <span>{provider.description}</span>
                </span>
                <span className={`settings-status-pill settings-status-pill--${visual.tone}`}>
                  {visual.icon}{visual.label}
                </span>
                <ArrowRightOutlined className="settings-provider-card__arrow" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="settings-content-grid">
        <section className="settings-panel settings-panel--connections">
          <div className="settings-panel__icon"><ApiOutlined /></div>
          <div className="settings-panel__copy">
            <span className="settings-section-index">{copy.integrationsIndex}</span>
            <h2>{copy.connections}</h2>
            <p>{copy.connectionsDesc}</p>
            <Button type="primary" onClick={() => navigate('/settings/configuration')}>
              {copy.openConnections}<ArrowRightOutlined />
            </Button>
          </div>
          <div className="settings-security-note">
            <LockOutlined />
            <div><strong>{copy.secureTitle}</strong><span>{copy.secureDesc}</span></div>
          </div>
        </section>

        <section className="settings-panel settings-panel--appearance">
          <div className="settings-panel__heading">
            <div className="settings-panel__icon"><BgColorsOutlined /></div>
            <div>
              <span className="settings-section-index">{copy.displayIndex}</span>
              <h2>{copy.appearance}</h2>
              <p>{copy.appearanceDesc}</p>
            </div>
          </div>
          <div className="settings-theme-grid" role="radiogroup" aria-label={copy.appearance}>
            {themeOptions.map((option) => {
              const active = themeMode === option.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`settings-theme-option${active ? ' is-active' : ''}`}
                  key={option.value}
                  onClick={() => setThemeMode(option.value as typeof themeMode)}
                >
                  <span className={`settings-theme-option__preview settings-theme-option__preview--${option.value}`}>
                    <i /><i /><i />
                  </span>
                  <span className="settings-theme-option__label">{option.icon}<b>{option.label}</b></span>
                  <small>{option.description}</small>
                  {active && <span className="settings-theme-option__active"><CheckCircleOutlined /> {copy.selected}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="settings-account">
        <div className="settings-account__identity">
          <span className="settings-account__avatar"><UserOutlined /></span>
          <div>
            <span className="settings-section-index">{copy.accountIndex}</span>
            <h2>{copy.account}</h2>
            <p>{copy.signedInAs} <strong>{user?.email || '—'}</strong></p>
          </div>
        </div>
        <span className={`settings-session ${session ? 'is-active' : ''}`}>
          <i />{session ? copy.activeSession : copy.inactiveSession}
        </span>
        <div className="settings-account__actions">
          <Button icon={<SafetyCertificateOutlined />} onClick={() => setSecurityModalVisible(true)}>{copy.security}</Button>
          <Button
            danger
            icon={<LogoutOutlined />}
            onClick={async () => {
              await logout();
              navigate('/signin', { replace: true });
            }}
          >
            {copy.signOut}
          </Button>
        </div>
      </section>

      <Modal
        title={<span className="settings-security-modal__title"><SafetyCertificateOutlined />{copy.modalTitle}</span>}
        open={securityModalVisible}
        onCancel={() => setSecurityModalVisible(false)}
        footer={<Button type="primary" onClick={() => setSecurityModalVisible(false)}>{copy.close}</Button>}
        width={560}
        destroyOnClose
        className="settings-security-modal"
      >
        <div className="settings-security-modal__intro">
          <span><EyeOutlined /></span>
          <p>{copy.secureDesc}</p>
        </div>
        <Descriptions column={1} bordered size="small" className="settings-security-modal__details">
          <Descriptions.Item label={copy.email}>{user?.email || '—'}</Descriptions.Item>
          <Descriptions.Item label={copy.provider}>Supabase Auth</Descriptions.Item>
          <Descriptions.Item label={copy.session}>{session ? copy.active : copy.inactive}</Descriptions.Item>
          <Descriptions.Item label={copy.credentialPolicy}>{copy.masked}</Descriptions.Item>
        </Descriptions>
        <Alert
          message={copy.securityMessage}
          description={copy.securityDescription}
          type="info"
          showIcon
        />
      </Modal>
    </div>
  );
};

export default Settings;
