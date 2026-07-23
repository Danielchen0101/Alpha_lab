import React from 'react';
import { Checkbox, Drawer, Dropdown, Input, Modal, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  CloseOutlined,
  CompassOutlined,
  DesktopOutlined,
  DollarCircleOutlined,
  DownOutlined,
  ExperimentOutlined,
  FundOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  PieChartOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SlidersOutlined,
  SunOutlined,
  MoonOutlined,
  StockOutlined,
  SwapOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeMode } from '../contexts/ThemeContext';
import { loadConfigStatus } from '../services/api';
import kalshiAPI, {
  DEFAULT_KALSHI_BOT_CONFIG,
  KALSHI_CONFIG_CHANGED_EVENT,
  KALSHI_CONFIG_STORAGE_KEY,
  type KalshiBotConfig,
  type KalshiExecutionMode,
} from '../services/kalshiApi';
import { searchStocks } from '../services/marketDataService';
import type { SearchResult } from '../services/marketDataService';
import BeginnerGuide from './BeginnerGuide';
import PageGuide from './PageGuide';
import {
  DEFAULT_MARKET_SYMBOL,
  LEGACY_MARKET_SYMBOL_ROOT,
  MARKET_SCANNER_PATH,
  MARKET_SYMBOL_ROOT,
  marketSymbolFromPath,
  marketSymbolPath,
  normalizeMarketSymbol,
  readLastMarketSymbol,
  rememberMarketSymbol,
} from '../routes/marketRoutes';
import {
  AI_RESEARCH_PATH,
  RESEARCH_CANDIDATES_PATH,
  RESEARCH_REVIEW_PATH,
} from '../routes/researchRoutes';
import './AuthenticatedShell.css';

export type ShellSection =
  | 'overview'
  | 'markets'
  | 'crypto'
  | 'research'
  | 'strategies'
  | 'trade'
  | 'settings'
  | 'kalshi-market'
  | 'kalshi-bots'
  | 'kalshi-portfolio';

interface ShellLink {
  key: string;
  label: string;
  labelZh: string;
  path: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
}

interface AuthenticatedShellProps {
  children?: React.ReactNode;
}

interface ShellSectionConfig {
  key: ShellSection;
  label: string;
  labelZh: string;
  path: string;
  matches: (pathname: string) => boolean;
  links: ShellLink[];
}

export const normalizeShellPath = (pathname: string): string => {
  const pathOnly = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : '/';
};

export const isShellPath = (pathname: string, root: string) => (
  pathname === root || pathname.startsWith(`${root}/`)
);

const sections: ShellSectionConfig[] = [
  {
    key: 'overview',
    label: 'Overview',
    labelZh: '总览',
    path: '/dashboard',
    matches: (pathname) => (
      isShellPath(pathname, '/dashboard') ||
      isShellPath(pathname, '/activity') ||
      isShellPath(pathname, '/signals') ||
      isShellPath(pathname, '/system-health') ||
      isShellPath(pathname, '/system-status') ||
      isShellPath(pathname, '/safety')
    ),
    links: [
      { key: 'daily-brief', label: 'Daily brief', labelZh: '每日概览', path: '/dashboard', icon: <AppstoreOutlined /> },
      {
        key: 'activity',
        label: 'Activity log',
        labelZh: '活动记录',
        path: '/activity',
        icon: <HistoryOutlined />,
        match: (pathname) => isShellPath(pathname, '/activity') || isShellPath(pathname, '/signals'),
      },
      {
        key: 'system-health',
        label: 'System health',
        labelZh: '系统状态',
        path: '/system-health',
        icon: <SafetyCertificateOutlined />,
        match: (pathname) => isShellPath(pathname, '/system-health') || isShellPath(pathname, '/system-status'),
      },
      {
        key: 'safety-center',
        label: 'Safety center',
        labelZh: '交易安全',
        path: '/safety',
        icon: <SafetyCertificateOutlined />,
        match: (pathname) => isShellPath(pathname, '/safety'),
      },
    ],
  },
  {
    key: 'markets',
    label: 'Markets',
    labelZh: '市场',
    path: MARKET_SCANNER_PATH,
    matches: (pathname) => (
      isShellPath(pathname, MARKET_SCANNER_PATH) ||
      isShellPath(pathname, LEGACY_MARKET_SYMBOL_ROOT) ||
      isShellPath(pathname, '/watchlist')
    ),
    links: [
      {
        key: 'market-scanner',
        label: 'Market scanner',
        labelZh: '市场扫描',
        path: MARKET_SCANNER_PATH,
        icon: <StockOutlined />,
        match: (pathname) => pathname === MARKET_SCANNER_PATH,
      },
      {
        key: 'symbol-analysis',
        label: 'Symbol analysis',
        labelZh: '标的分析',
        path: marketSymbolPath(DEFAULT_MARKET_SYMBOL),
        icon: <LineChartOutlined />,
        match: (pathname) => isShellPath(pathname, MARKET_SYMBOL_ROOT) || isShellPath(pathname, LEGACY_MARKET_SYMBOL_ROOT),
      },
      {
        key: 'watchlist',
        label: 'Watchlist',
        labelZh: '自选监控',
        path: '/watchlist',
        icon: <UnorderedListOutlined />,
        match: (pathname) => isShellPath(pathname, '/watchlist'),
      },
    ],
  },
  {
    key: 'crypto',
    label: 'Crypto',
    labelZh: '虚拟币',
    path: '/crypto',
    matches: (pathname) => isShellPath(pathname, '/crypto'),
    links: [
      {
        key: 'crypto-overview',
        label: 'Command center',
        labelZh: '交易中枢',
        path: '/crypto',
        icon: <DollarCircleOutlined />,
        match: (pathname) => pathname === '/crypto',
      },
      {
        key: 'crypto-strategy',
        label: 'Strategy evidence',
        labelZh: '策略证据',
        path: '/crypto/strategy',
        icon: <LineChartOutlined />,
        match: (pathname) => pathname === '/crypto/strategy',
      },
      {
        key: 'crypto-automation',
        label: '24/7 automation',
        labelZh: '24/7 自动化',
        path: '/crypto/automation',
        icon: <RobotOutlined />,
        match: (pathname) => pathname === '/crypto/automation',
      },
      {
        key: 'crypto-ledger',
        label: 'Decision ledger',
        labelZh: '决策账本',
        path: '/crypto/ledger',
        icon: <HistoryOutlined />,
        match: (pathname) => pathname === '/crypto/ledger',
      },
    ],
  },
  {
    key: 'research',
    label: 'Research',
    labelZh: '研究',
    path: AI_RESEARCH_PATH,
    matches: (pathname) => isShellPath(pathname, '/agent'),
    links: [
      {
        key: 'ai-research',
        label: 'Research pipeline',
        labelZh: '研究管线',
        path: AI_RESEARCH_PATH,
        icon: <RobotOutlined />,
        match: (pathname) => pathname === AI_RESEARCH_PATH,
      },
      {
        key: 'research-market',
        label: 'Candidates',
        labelZh: '候选池',
        path: RESEARCH_CANDIDATES_PATH,
        icon: <FundOutlined />,
        match: (pathname) => pathname === RESEARCH_CANDIDATES_PATH,
      },
      {
        key: 'research-review',
        label: 'Review queue',
        labelZh: '审核队列',
        path: RESEARCH_REVIEW_PATH,
        icon: <UnorderedListOutlined />,
        match: (pathname) => pathname === RESEARCH_REVIEW_PATH,
      },
    ],
  },
  {
    key: 'strategies',
    label: 'Strategies',
    labelZh: '策略',
    path: '/backtest',
    matches: (pathname) => (
      isShellPath(pathname, '/backtest') ||
      isShellPath(pathname, '/backtest-analysis') ||
      isShellPath(pathname, '/optimize') ||
      isShellPath(pathname, '/compare') ||
      isShellPath(pathname, '/ranking')
    ),
    links: [
      {
        key: 'backtests',
        label: 'Backtests',
        labelZh: '策略回测',
        path: '/backtest',
        icon: <BarChartOutlined />,
        match: (pathname) => isShellPath(pathname, '/backtest') || isShellPath(pathname, '/backtest-analysis'),
      },
      {
        key: 'optimization',
        label: 'Optimization',
        labelZh: '参数优化',
        path: '/optimize',
        icon: <SlidersOutlined />,
        match: (pathname) => pathname === '/optimize',
      },
      {
        key: 'comparison',
        label: 'Comparison',
        labelZh: '策略对比',
        path: '/compare',
        icon: <SwapOutlined />,
        match: (pathname) => pathname === '/compare',
      },
      {
        key: 'ranking',
        label: 'Rankings',
        labelZh: '策略排名',
        path: '/ranking',
        icon: <TrophyOutlined />,
        match: (pathname) => pathname === '/ranking',
      },
    ],
  },
  {
    key: 'trade',
    label: 'Trade',
    labelZh: '交易',
    path: '/trade',
    matches: (pathname) => (
      isShellPath(pathname, '/trade') ||
      isShellPath(pathname, '/portfolio')
    ),
    links: [
      { key: 'execution', label: 'Trade desk', labelZh: '交易台', path: '/trade', icon: <ExperimentOutlined /> },
      { key: 'portfolio', label: 'Portfolio', labelZh: '持仓组合', path: '/portfolio', icon: <PieChartOutlined /> },
    ],
  },
];

const settingsSection: ShellSectionConfig = {
  key: 'settings',
  label: 'Settings',
  labelZh: '设置',
  path: '/settings',
  matches: (pathname) => isShellPath(pathname, '/settings'),
  links: [
    { key: 'preferences', label: 'Preferences', labelZh: '偏好设置', path: '/settings', icon: <SettingOutlined />, match: (pathname) => pathname === '/settings' },
    { key: 'connections', label: 'Connections', labelZh: '连接管理', path: '/settings/configuration', icon: <SlidersOutlined />, match: (pathname) => isShellPath(pathname, '/settings/configuration') },
  ],
};

const kalshiSections: ShellSectionConfig[] = [
  {
    key: 'kalshi-market',
    label: 'Market',
    labelZh: '市场',
    path: '/kalshi',
    matches: (pathname) => pathname === '/kalshi' || isShellPath(pathname, '/kalshi/markets'),
    links: [
      {
        key: 'kalshi-btc15-market',
        label: 'Live contract',
        labelZh: '实时合约',
        path: '/kalshi/markets/btc-15m',
        icon: <LineChartOutlined />,
        match: (pathname) => pathname === '/kalshi' || pathname === '/kalshi/markets/btc-15m',
      },
      {
        key: 'kalshi-contract-rules',
        label: 'Contract rules',
        labelZh: '合约规则',
        path: '/kalshi/markets/rules',
        icon: <SafetyCertificateOutlined />,
      },
    ],
  },
  {
    key: 'kalshi-bots',
    label: 'Robots',
    labelZh: '机器人',
    path: '/kalshi/bots/btc-15m',
    matches: (pathname) => isShellPath(pathname, '/kalshi/bots'),
    links: [
      { key: 'kalshi-btc15-bot', label: 'Live monitor', labelZh: '实时监控', path: '/kalshi/bots/btc-15m', icon: <RobotOutlined /> },
      { key: 'kalshi-decisions', label: 'Decision log', labelZh: '决策记录', path: '/kalshi/bots/decisions', icon: <HistoryOutlined /> },
      { key: 'kalshi-risk', label: 'Strategy & risk', labelZh: '策略与风控', path: '/kalshi/bots/risk', icon: <SafetyCertificateOutlined /> },
    ],
  },
  {
    key: 'kalshi-portfolio',
    label: 'Portfolio',
    labelZh: '组合',
    path: '/kalshi/portfolio/positions',
    matches: (pathname) => isShellPath(pathname, '/kalshi/portfolio'),
    links: [
      { key: 'kalshi-positions', label: 'Overview', labelZh: '组合总览', path: '/kalshi/portfolio/positions', icon: <PieChartOutlined /> },
      { key: 'kalshi-orders', label: 'Execution', labelZh: '订单执行', path: '/kalshi/portfolio/orders', icon: <UnorderedListOutlined /> },
    ],
  },
];

export interface ShellNavigationState {
  pathname: string;
  sectionKey: ShellSection | null;
  linkKey: string | null;
}

const findActiveSection = (pathname: string): ShellSectionConfig | undefined => (
  kalshiSections.find((section) => section.matches(pathname))
  ?? sections.find((section) => section.matches(pathname))
  ?? (settingsSection.matches(pathname) ? settingsSection : undefined)
);

const isShellLinkActive = (pathname: string, link: ShellLink): boolean => (
  link.match ? link.match(pathname) : isShellPath(pathname, link.path)
);

const readKalshiStoredConfig = (): KalshiBotConfig => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KALSHI_CONFIG_STORAGE_KEY) || '{}');
    return { ...DEFAULT_KALSHI_BOT_CONFIG, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_KALSHI_BOT_CONFIG };
  }
};

const writeKalshiStoredConfig = (config: KalshiBotConfig) => {
  try {
    localStorage.setItem(KALSHI_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(KALSHI_CONFIG_CHANGED_EVENT, { detail: config }));
  } catch {
    // Local persistence is best-effort; backend config remains authoritative.
  }
};

export const getShellNavigationState = (pathname: string): ShellNavigationState => {
  const normalizedPath = normalizeShellPath(pathname);
  const section = findActiveSection(normalizedPath);
  const link = section?.links.find((item) => isShellLinkActive(normalizedPath, item));

  return {
    pathname: normalizedPath,
    sectionKey: section?.key ?? null,
    linkKey: link?.key ?? null,
  };
};

const AuthenticatedShell: React.FC<AuthenticatedShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { language, setLanguage, t } = useLanguage();
  const { tradeMode, setTradeMode } = useTradeMode();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const { user, session, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [symbolQuery, setSymbolQuery] = React.useState('');
  const [symbolResults, setSymbolResults] = React.useState<SearchResult[]>([]);
  const [lastMarketSymbol, setLastMarketSymbol] = React.useState(readLastMarketSymbol);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [alpacaStatus, setAlpacaStatus] = React.useState<'checking' | 'connected' | 'attention'>('checking');
  const [kalshiExecutionMode, setKalshiExecutionMode] = React.useState<KalshiExecutionMode>(() => (
    readKalshiStoredConfig().executionMode === 'real' ? 'real' : 'paper'
  ));
  const [kalshiConfigured, setKalshiConfigured] = React.useState(false);
  const [kalshiModeBusy, setKalshiModeBusy] = React.useState(false);
  const [realModalOpen, setRealModalOpen] = React.useState(false);
  const [realRiskAccepted, setRealRiskAccepted] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [guideOpenSignal, setGuideOpenSignal] = React.useState(0);
  const [pageGuideOpenSignal, setPageGuideOpenSignal] = React.useState(0);
  const [languageSwitchLocked, setLanguageSwitchLocked] = React.useState(false);
  const [dashboardSync, setDashboardSync] = React.useState<{ loading: boolean; timestamp: number | null }>({
    loading: false,
    timestamp: null,
  });
  const searchInputRef = React.useRef<InputRef>(null);
  const mobileSearchInputRef = React.useRef<InputRef>(null);
  const searchRequestRef = React.useRef(0);
  const secondaryNavRef = React.useRef<HTMLElement>(null);
  const languageSwitchTimerRef = React.useRef<number | null>(null);

  const isChinese = language === 'zh-CN';

  const handleLanguageSwitch = React.useCallback(() => {
    if (languageSwitchTimerRef.current !== null) return;
    setLanguageSwitchLocked(true);
    setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US');
    languageSwitchTimerRef.current = window.setTimeout(() => {
      languageSwitchTimerRef.current = null;
      setLanguageSwitchLocked(false);
    }, 600);
  }, [language, setLanguage]);

  React.useEffect(() => () => {
    if (languageSwitchTimerRef.current !== null) {
      window.clearTimeout(languageSwitchTimerRef.current);
    }
  }, []);
  const navigationState = getShellNavigationState(location.pathname);
  const navigationPath = navigationState.pathname;
  const onConfigurationRoute = isShellPath(navigationPath, '/settings/configuration');
  const activeSection = findActiveSection(navigationPath);
  const onCryptoRoute = activeSection?.key === 'crypto';
  const onKalshiRoute = isShellPath(navigationPath, '/kalshi');
  const workspaceSections = onKalshiRoute ? kalshiSections : sections;
  const workspaceHome = onKalshiRoute ? '/kalshi' : '/dashboard';
  const workspaceSafetyPath = onKalshiRoute ? '/kalshi/bots/risk' : '/safety';
  const workspaceConnectionPath = '/settings/configuration';
  const workspaceContext = activeSection?.key === 'overview'
    ? (isChinese ? '总览工作台' : 'OVERVIEW DESK')
      : activeSection?.key === 'markets'
        ? (isChinese ? '市场工作区' : 'MARKET WORKSPACE')
        : activeSection?.key === 'crypto'
          ? (isChinese ? '虚拟币工作区' : 'CRYPTO WORKSPACE')
          : activeSection?.key === 'research'
            ? (isChinese ? '研究工作区' : 'RESEARCH WORKSPACE')
            : activeSection?.key === 'strategies'
              ? (isChinese ? '策略实验室' : 'STRATEGY LAB')
              : activeSection?.key === 'trade'
                ? (isChinese ? '执行工作区' : 'EXECUTION WORKSPACE')
                : activeSection?.key === 'settings'
                  ? (isChinese ? '账户设置' : 'ACCOUNT SETTINGS')
                  : onKalshiRoute
                    ? (isChinese ? 'KALSHI 工作区' : 'KALSHI WORKSPACE')
                    : (isChinese ? '工作区' : 'WORKSPACE');

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.hash, location.pathname, location.search]);

  React.useEffect(() => {
    if (location.hash) {
      let anchor = location.hash.slice(1);
      try {
        anchor = decodeURIComponent(anchor);
      } catch {
        // Keep the raw fragment when a manually entered URL contains malformed escaping.
      }
      let observer: MutationObserver | null = null;
      const scrollToAnchor = () => {
        const target = document.getElementById(anchor);
        if (!target) return false;
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        observer?.disconnect();
        return true;
      };
      const frame = window.requestAnimationFrame(() => {
        if (scrollToAnchor()) return;
        observer = new MutationObserver(scrollToAnchor);
        observer.observe(document.body, { childList: true, subtree: true });
      });
      const timeout = window.setTimeout(() => observer?.disconnect(), 2500);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
        observer?.disconnect();
      };
    }
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return undefined;
  }, [location.hash, location.pathname, navigationType]);

  React.useEffect(() => {
    const activeLink = secondaryNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeLink?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeSection?.key, navigationPath]);

  React.useEffect(() => {
    const routeSymbol = marketSymbolFromPath(location.pathname);
    if (!routeSymbol) return;

    rememberMarketSymbol(routeSymbol);
    setLastMarketSymbol(routeSymbol);
  }, [location.pathname]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        (mobileMenuOpen ? mobileSearchInputRef : searchInputRef).current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    const syncStoredKalshiMode = (event?: Event) => {
      const detail = (event as CustomEvent<Partial<KalshiBotConfig> | undefined>)?.detail;
      const nextConfig = detail && typeof detail === 'object'
        ? { ...readKalshiStoredConfig(), ...detail }
        : readKalshiStoredConfig();
      setKalshiExecutionMode(nextConfig.executionMode === 'real' ? 'real' : 'paper');
    };
    window.addEventListener(KALSHI_CONFIG_CHANGED_EVENT, syncStoredKalshiMode);
    window.addEventListener('storage', syncStoredKalshiMode);
    return () => {
      window.removeEventListener(KALSHI_CONFIG_CHANGED_EVENT, syncStoredKalshiMode);
      window.removeEventListener('storage', syncStoredKalshiMode);
    };
  }, []);

  React.useEffect(() => {
    if (!onKalshiRoute) return undefined;
    let active = true;
    const storedMode = readKalshiStoredConfig().executionMode === 'real' ? 'real' : 'paper';
    setKalshiExecutionMode(storedMode);
    void kalshiAPI.status()
      .then((response) => {
        if (!active) return;
        setKalshiConfigured(Boolean(response.data?.personalApiConfigured || response.data?.liveTradingConfigured));
        const backendMode = response.data?.activeEnvironment === 'real' ? 'real' : 'paper';
        setKalshiExecutionMode(backendMode);
        const stored = readKalshiStoredConfig();
        if (stored.executionMode !== backendMode) {
          writeKalshiStoredConfig({ ...stored, executionMode: backendMode });
        }
      })
      .catch(() => {
        if (active) setKalshiConfigured(false);
      });
    return () => { active = false; };
  }, [onKalshiRoute, onConfigurationRoute]);

  React.useEffect(() => {
    let active = true;
    if (onKalshiRoute) {
      setAlpacaStatus('connected');
      return () => { active = false; };
    }
    setAlpacaStatus('checking');
    void loadConfigStatus({ timeoutMs: 6000, force: true }).then((result) => {
      if (!active) return;
      const alpaca = result.data?.alpaca;
      const configured = tradeMode === 'real' ? alpaca?.liveConfigured : alpaca?.paperConfigured;
      setAlpacaStatus(result.ok && configured ? 'connected' : 'attention');
    });
    return () => { active = false; };
  }, [tradeMode, onConfigurationRoute, onKalshiRoute]);

  React.useEffect(() => {
    const handleDataSync = (event: Event) => {
      const detail = (event as CustomEvent<{ loading?: boolean; timestamp?: number | null }>).detail;
      if (!detail) return;
      setDashboardSync((current) => ({
        loading: detail.loading ?? current.loading,
        timestamp: detail.timestamp ?? current.timestamp,
      }));
    };
    window.addEventListener('alphalab:data-sync', handleDataSync);
    return () => window.removeEventListener('alphalab:data-sync', handleDataSync);
  }, []);

  React.useEffect(() => {
    const query = symbolQuery.trim();
    const requestId = ++searchRequestRef.current;
    if (query.length < 2) {
      setSymbolResults([]);
      setSearchLoading(false);
      return undefined;
    }

    if (onKalshiRoute) {
      const normalized = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const kalshiUniverse: SearchResult[] = [
        { symbol: 'KXBTC15M', name: 'Bitcoin up in next 15 minutes', type: 'EVENT', region: 'Kalshi', currency: 'USD' },
      ];
      setSymbolResults(kalshiUniverse.filter((item) => (
        item.symbol.includes(normalized)
        || item.name.toUpperCase().includes(query.toUpperCase())
        || normalized.includes('BTC')
      )));
      setSearchOpen(true);
      setSearchLoading(false);
      return undefined;
    }

    if (onCryptoRoute) {
      const normalized = query.toUpperCase().replace(/[^A-Z]/g, '');
      const cryptoUniverse: SearchResult[] = [
        { symbol: 'BTC/USD', name: 'Bitcoin', type: 'CRYPTO', region: '24/7', currency: 'USD' },
        { symbol: 'ETH/USD', name: 'Ethereum', type: 'CRYPTO', region: '24/7', currency: 'USD' },
      ];
      setSymbolResults(cryptoUniverse.filter((item) => (
        item.symbol.replace('/', '').includes(normalized)
        || item.name.toUpperCase().includes(query.toUpperCase())
      )));
      setSearchOpen(true);
      setSearchLoading(false);
      return undefined;
    }

    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchStocks(query, 6)
        .then((results) => {
          if (requestId !== searchRequestRef.current) return;
          setSymbolResults(results);
          setSearchOpen(true);
        })
        .catch(() => {
          if (requestId === searchRequestRef.current) setSymbolResults([]);
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setSearchLoading(false);
        });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [onCryptoRoute, onKalshiRoute, symbolQuery]);

  const localize = (item: { label: string; labelZh: string }) => (
    isChinese ? item.labelZh : item.label
  );

  const resolveLinkPath = (link: ShellLink) => (
    link.key === 'symbol-analysis' ? marketSymbolPath(lastMarketSymbol) : link.path
  );

  const handleSearch = (event?: React.FormEvent, compact = false) => {
    event?.preventDefault();
    if (onKalshiRoute) {
      const normalized = symbolQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!normalized.includes('BTC') && !normalized.includes('KXBTC15M')) {
        (compact ? mobileSearchInputRef : searchInputRef).current?.focus();
        return;
      }
      setSymbolQuery('KXBTC15M');
      setSearchOpen(false);
      setMobileMenuOpen(false);
      navigate('/kalshi/markets/btc-15m');
      return;
    }
    if (onCryptoRoute) {
      const normalized = symbolQuery.toUpperCase().replace(/[^A-Z]/g, '');
      const pair = normalized.startsWith('ETH') ? 'ETH/USD' : normalized.startsWith('BTC') ? 'BTC/USD' : '';
      if (!pair) {
        (compact ? mobileSearchInputRef : searchInputRef).current?.focus();
        return;
      }
      setSymbolQuery(pair);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      navigate(`/crypto?symbol=${encodeURIComponent(pair)}`);
      return;
    }
    const symbol = normalizeMarketSymbol(symbolQuery);
    if (!symbol) {
      (compact ? mobileSearchInputRef : searchInputRef).current?.focus();
      return;
    }
    rememberMarketSymbol(symbol);
    setLastMarketSymbol(symbol);
    setSymbolQuery(symbol);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(marketSymbolPath(symbol));
  };

  const refreshDashboard = () => {
    setDashboardSync((current) => ({ ...current, loading: true }));
    window.dispatchEvent(new Event('alphalab:refresh'));
  };

  const selectSymbol = (symbol: string) => {
    if (onKalshiRoute) {
      if (symbol.toUpperCase() !== 'KXBTC15M') return;
      setSymbolQuery('KXBTC15M');
      setSearchOpen(false);
      setMobileMenuOpen(false);
      navigate('/kalshi/markets/btc-15m');
      return;
    }
    if (onCryptoRoute) {
      const pair = symbol.toUpperCase();
      if (pair !== 'BTC/USD' && pair !== 'ETH/USD') return;
      setSymbolQuery(pair);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      navigate(`/crypto?symbol=${encodeURIComponent(pair)}`);
      return;
    }
    const normalized = normalizeMarketSymbol(symbol);
    if (!normalized) return;
    rememberMarketSymbol(normalized);
    setLastMarketSymbol(normalized);
    setSymbolQuery(normalized);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(marketSymbolPath(normalized));
  };

  const handleModeToggle = () => {
    if (tradeMode === 'real') {
      setTradeMode('paper');
      return;
    }
    setRealRiskAccepted(false);
    setRealModalOpen(true);
  };

  const handleMobileModeToggle = () => {
    setMobileMenuOpen(false);
    handleModeToggle();
  };

  const handleKalshiModeToggle = async () => {
    if (kalshiModeBusy) return;
    const currentMode = kalshiExecutionMode === 'real' ? 'real' : 'paper';
    const nextMode: KalshiExecutionMode = currentMode === 'real' ? 'paper' : 'real';
    const currentConfig = readKalshiStoredConfig();
    const nextConfig: KalshiBotConfig = { ...currentConfig, executionMode: nextMode };
    setKalshiModeBusy(true);
    try {
      if (nextMode === 'real') {
        const status = await kalshiAPI.status();
        const configured = Boolean(status.data?.personalApiConfigured || status.data?.liveTradingConfigured);
        setKalshiConfigured(configured);
        if (!configured) {
          Modal.warning({
            title: isChinese ? 'Kalshi 实盘 API 还没配置' : 'Kalshi Real API is not configured',
            content: isChinese
              ? '请先在 Connections / 设置里保存并测试 Kalshi production API key。没有签名密钥时，AlphaLab 不会假装切到真钱交易。'
              : 'Save and test your Kalshi production API key in Connections / Settings first. AlphaLab will not pretend to enable real-money trading without signed credentials.',
            okText: isChinese ? '去设置' : 'Open settings',
            onOk: () => navigate('/settings/configuration'),
          });
          return;
        }
      }
      setKalshiExecutionMode(nextMode);
      writeKalshiStoredConfig(nextConfig);
      await kalshiAPI.savePaperRobotConfig(nextConfig, nextMode);
      window.dispatchEvent(new CustomEvent(KALSHI_CONFIG_CHANGED_EVENT, { detail: nextConfig }));
      window.dispatchEvent(new Event('alphalab:refresh'));
    } catch (error: any) {
      setKalshiExecutionMode(currentMode);
      writeKalshiStoredConfig(currentConfig);
      Modal.error({
        title: isChinese ? 'Kalshi 模式切换失败' : 'Kalshi mode switch failed',
        content: error?.response?.data?.message || error?.message || (isChinese ? '请检查 Kalshi 连接设置后重试。' : 'Check Kalshi connection settings and try again.'),
      });
    } finally {
      setKalshiModeBusy(false);
    }
  };

  const handlePlatformSwitch = () => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setSymbolQuery('');
    navigate(onKalshiRoute ? '/dashboard' : '/kalshi');
  };

  const handleRealConfirm = () => {
    if (!realRiskAccepted) return;
    setTradeMode('real');
    setRealModalOpen(false);
    setRealRiskAccepted(false);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate('/signin', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const profileName = typeof session?.user.user_metadata?.full_name === 'string'
    ? session.user.user_metadata.full_name.trim()
    : '';
  const initials = (profileName || user?.email || 'AlphaLab')
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AL';
  const dashboardSyncTime = dashboardSync.timestamp
    ? new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(dashboardSync.timestamp))
    : '—';

  const accountItems: MenuProps['items'] = [
    {
      key: 'identity',
      disabled: true,
      label: (
        <div className="auth-shell__account-identity">
          <span>{isChinese ? '当前账户' : 'Signed in as'}</span>
          <strong>{user?.email || (isChinese ? '已登录用户' : 'Authenticated user')}</strong>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: t.navigation.settings },
    { key: 'logout', icon: <LogoutOutlined />, danger: true, label: t.settings.signOut },
  ];

  const themeItems: MenuProps['items'] = [
    { key: 'system', icon: <DesktopOutlined />, label: t.common.themeSystem },
    { key: 'light', icon: <SunOutlined />, label: t.common.themeLight },
    { key: 'dark', icon: <MoonOutlined />, label: t.common.themeDark },
  ];

  const handleAccountClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'settings') navigate('/settings');
    if (key === 'logout') void handleSignOut();
  };

  const renderSearch = (compact = false) => (
    <form
      className={`auth-shell__search${compact ? ' auth-shell__search--drawer' : ''}`}
      role="search"
      onSubmit={(event) => handleSearch(event, compact)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
      }}
    >
      <SearchOutlined aria-hidden="true" />
      <Input
        ref={compact ? mobileSearchInputRef : searchInputRef}
        value={symbolQuery}
        onChange={(event) => setSymbolQuery(event.target.value)}
        onFocus={() => setSearchOpen(symbolResults.length > 0)}
        placeholder={onKalshiRoute
          ? (isChinese ? '搜索 KXBTC15M' : 'Search KXBTC15M')
          : onCryptoRoute
            ? (isChinese ? '搜索 BTC 或 ETH' : 'Search BTC or ETH')
            : (isChinese ? '搜索股票代码或命令' : 'Search symbols or commands')}
        aria-label={onKalshiRoute
          ? (isChinese ? '搜索 Kalshi 合约' : 'Search Kalshi contracts')
          : onCryptoRoute
            ? (isChinese ? '搜索虚拟币交易对' : 'Search crypto pairs')
            : (isChinese ? '搜索股票代码' : 'Search stock symbols')}
        bordered={false}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      {!compact && (searchLoading ? <span className="auth-shell__search-loading" aria-hidden="true" /> : <kbd>⌘K</kbd>)}
      {searchOpen && symbolResults.length > 0 && (
        <div className="auth-shell__search-results" role="listbox" aria-label={onKalshiRoute
          ? (isChinese ? 'Kalshi 合约搜索结果' : 'Kalshi contract results')
          : onCryptoRoute
            ? (isChinese ? '虚拟币搜索结果' : 'Crypto search results')
            : (isChinese ? '股票搜索结果' : 'Symbol search results')}>
          {symbolResults.map((result) => (
            <button
              key={`${result.symbol}-${result.region || 'market'}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => selectSymbol(result.symbol)}
            >
              <strong>{result.symbol}</strong>
              <span>{result.name || result.symbol}</span>
              <small>{result.region || result.type || 'EQUITY'}</small>
            </button>
          ))}
        </div>
      )}
    </form>
  );

  return (
    <div className="workspace-shell">
      <header className="auth-shell__chrome">
        <div className="auth-shell__primary-row">
          <button
            type="button"
            className="auth-shell__mobile-trigger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={isChinese ? '打开导航菜单' : 'Open navigation menu'}
          >
            <MenuOutlined />
          </button>

          <div className="auth-shell__brand-cluster">
            <Link to={workspaceHome} className="auth-shell__wordmark" aria-label={onKalshiRoute ? 'AlphaLab Kalshi' : (isChinese ? 'AlphaLab 市场总览' : 'AlphaLab overview')}>
              <span className="auth-shell__wordmark-symbol">A</span>
              <span>lphaLab</span>
              <i aria-hidden="true" />
            </Link>
            <Tooltip title={onKalshiRoute
              ? (isChinese ? '切换到股票与量化工作区' : 'Switch to equities workspace')
              : (isChinese ? '切换到 Kalshi 事件合约工作区' : 'Switch to Kalshi workspace')}>
              <button
                type="button"
                className={`auth-shell__platform-switch${onKalshiRoute ? ' is-kalshi' : ''}`}
                onClick={handlePlatformSwitch}
                aria-label={onKalshiRoute
                  ? (isChinese ? '切换到 AlphaLab 股票平台' : 'Switch to AlphaLab equities')
                  : (isChinese ? '切换到 Kalshi 平台' : 'Switch to Kalshi')}
              >
                <SwapOutlined />
                <span>{onKalshiRoute ? 'KALSHI' : 'ALPACA'}</span>
              </button>
            </Tooltip>
          </div>

          <nav className="auth-shell__primary-nav" aria-label={isChinese ? '主导航' : 'Primary navigation'}>
            {workspaceSections.map((section) => (
              <Link
                key={section.key}
                to={section.path}
                data-tour={`nav-${section.key}`}
                className={activeSection?.key === section.key ? 'is-active' : undefined}
                aria-current={activeSection?.key === section.key ? 'page' : undefined}
              >
                {localize(section)}
              </Link>
            ))}
          </nav>

          <div className="auth-shell__desktop-search">{renderSearch()}</div>

          <div className="auth-shell__environment" data-tour="trade-environment" aria-label={isChinese ? '交易环境' : 'Trading environment'}>
            {onKalshiRoute ? (
              <>
                <span className="auth-shell__connection auth-shell__connection--connected">
                  <i aria-hidden="true" />
                  <span>
                    {kalshiExecutionMode === 'real'
                      ? (isChinese ? 'KALSHI 实盘账户' : 'KALSHI REAL ACCOUNT')
                      : (isChinese ? 'KALSHI 公共行情' : 'KALSHI PUBLIC DATA')}
                  </span>
                </span>
                <Tooltip title={kalshiExecutionMode === 'real'
                  ? (isChinese ? '切换到 AlphaLab Paper 模拟盘' : 'Switch to AlphaLab Paper mode')
                  : kalshiConfigured
                    ? (isChinese ? '切换到 Kalshi Real mode' : 'Switch to Kalshi Real mode')
                    : (isChinese ? '配置 Kalshi API 后才能切到 Real mode' : 'Configure Kalshi API before enabling Real mode')}>
                  <button
                    type="button"
                    className={`auth-shell__mode ${kalshiExecutionMode === 'real' ? 'auth-shell__mode--real' : 'auth-shell__mode--paper'}`}
                    onClick={handleKalshiModeToggle}
                    disabled={kalshiModeBusy}
                    aria-label={isChinese ? '切换 Kalshi 执行模式' : 'Toggle Kalshi execution mode'}
                  >
                    {kalshiExecutionMode === 'real'
                      ? (isChinese ? '实盘模式' : 'REAL MODE')
                      : kalshiConfigured
                        ? (isChinese ? '模拟模式' : 'PAPER MODE')
                        : (isChinese ? '仅模拟' : 'PAPER ONLY')}
                  </button>
                </Tooltip>
              </>
            ) : (
              <>
                <span className={`auth-shell__connection auth-shell__connection--${alpacaStatus}`}>
                  <i aria-hidden="true" />
                  <span>
                    {alpacaStatus === 'checking'
                      ? (isChinese ? 'ALPACA 检查中' : 'ALPACA CHECKING')
                      : alpacaStatus === 'connected'
                        ? (isChinese ? 'ALPACA 已配置' : 'ALPACA CONFIGURED')
                        : (isChinese ? 'ALPACA 待配置' : 'ALPACA SETUP')}
                  </span>
                </span>
                <Tooltip
                  title={tradeMode === 'paper'
                    ? (isChinese ? '点击切换至实盘模式' : 'Switch to real trading')
                    : (isChinese ? '点击返回模拟模式' : 'Return to paper trading')}
                >
                  <button
                    type="button"
                    className={`auth-shell__mode auth-shell__mode--${tradeMode}`}
                    onClick={handleModeToggle}
                  >
                    {tradeMode === 'paper'
                      ? (isChinese ? '模拟模式' : 'PAPER MODE')
                      : (isChinese ? '实盘' : 'LIVE')}
                  </button>
                </Tooltip>
              </>
            )}
          </div>

          <div className="auth-shell__utilities">
            <Tooltip title={isChinese ? '新手教程' : 'Beginner guide'}>
              <button
                type="button"
                className="auth-shell__utility-button"
                aria-label={isChinese ? '打开新手教程' : 'Open beginner guide'}
                onClick={() => setGuideOpenSignal((value) => value + 1)}
              >
                <QuestionCircleOutlined />
              </button>
            </Tooltip>
            <Tooltip title={isChinese ? '打开交易安全中心' : 'Open trading safety center'}>
              <Link
                to={workspaceSafetyPath}
                className={`auth-shell__utility-button${navigationPath === workspaceSafetyPath ? ' is-active' : ''}`}
                aria-label={onKalshiRoute
                  ? (isChinese ? 'Kalshi 机器人风控' : 'Kalshi bot risk limits')
                  : (isChinese ? '交易安全中心' : 'Trading safety center')}
              >
                <SafetyCertificateOutlined />
              </Link>
            </Tooltip>
            <Dropdown
              menu={{
                items: themeItems,
                selectedKeys: [themeMode],
                onClick: ({ key }) => setThemeMode(key as ThemeMode),
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <button type="button" className="auth-shell__utility-button" aria-label={t.common.switchTheme}>
                {resolvedTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
              </button>
            </Dropdown>
            <button
              type="button"
              className="auth-shell__utility-button auth-shell__language-button"
              onClick={handleLanguageSwitch}
              disabled={languageSwitchLocked}
              aria-busy={languageSwitchLocked}
              aria-label={t.common.switchLanguage}
            >
              <GlobalOutlined />
              <span>{language === 'zh-CN' ? '中' : 'EN'}</span>
            </button>
            <span className="auth-shell__utility-rule" aria-hidden="true" />
            <Dropdown
              menu={{ items: accountItems, onClick: handleAccountClick }}
              trigger={['click']}
              placement="bottomRight"
            >
              <button
                type="button"
                className="auth-shell__account"
                aria-label={isChinese ? '账户菜单' : 'Account menu'}
                aria-busy={signingOut}
              >
                <span className="auth-shell__account-avatar">{initials}</span>
                <DownOutlined />
              </button>
            </Dropdown>
          </div>
        </div>

        <div className="auth-shell__secondary-row">
          <nav ref={secondaryNavRef} aria-label={`${activeSection ? localize(activeSection) : (isChinese ? '账户' : 'Account')} ${isChinese ? '导航' : 'navigation'}`}>
            {activeSection ? activeSection.links.map((link) => {
              const isActive = isShellLinkActive(navigationPath, link);
              return (
                <Link
                  key={link.key}
                  to={resolveLinkPath(link)}
                  className={isActive ? 'is-active' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {localize(link)}
                </Link>
              );
            }) : (
                <span className="auth-shell__secondary-context">{isChinese ? '工作区' : 'Workspace'}</span>
            )}
          </nav>
          <div className="auth-shell__secondary-meta">
            {navigationPath === '/dashboard' ? (
              <>
                <span>{isChinese ? '最后同步' : 'LAST SYNC'}&nbsp;&nbsp;<strong>{dashboardSyncTime} ET</strong></span>
                <i aria-hidden="true" />
                <button type="button" onClick={refreshDashboard} disabled={dashboardSync.loading}>
                  <ReloadOutlined className={dashboardSync.loading ? 'is-spinning' : undefined} />
                  {isChinese ? '刷新' : 'REFRESH'}
                </button>
              </>
            ) : isShellPath(navigationPath, '/settings') ? (
              <span>{workspaceContext}</span>
            ) : (
              <>
                <span>{workspaceContext}</span>
                <i aria-hidden="true" />
                <Link
                  to={workspaceConnectionPath}
                  state={{ returnTo: `${navigationPath}${location.search}${location.hash}` }}
                >
                  {isChinese ? '连接设置' : 'CONNECTIONS'}
                </Link>
              </>
            )}
            <i aria-hidden="true" />
            <button
              type="button"
              className="auth-shell__page-guide-button"
              onClick={() => setPageGuideOpenSignal((value) => value + 1)}
            >
              <QuestionCircleOutlined />
              {isChinese ? '本页指南' : 'PAGE GUIDE'}
            </button>
          </div>
        </div>
      </header>

      <main className="auth-shell__content">
        {children ?? <Outlet />}
      </main>

      <Drawer
        placement="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width="min(360px, 92vw)"
        closable={false}
        className="auth-shell__drawer"
        styles={{ body: { padding: 0 } }}
      >
        <div className="auth-shell__drawer-head">
          <Link
            to={workspaceHome}
            className="auth-shell__wordmark"
            aria-label={isChinese ? '返回市场总览' : 'Return to market overview'}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="auth-shell__wordmark-symbol">A</span>
            <span>lphaLab</span>
            <i aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={isChinese ? '关闭导航菜单' : 'Close navigation menu'}
          >
            <CloseOutlined />
          </button>
        </div>
        <div className="auth-shell__drawer-search">{renderSearch(true)}</div>
        <button
          type="button"
          className={`auth-shell__drawer-platform-switch${onKalshiRoute ? ' is-kalshi' : ''}`}
          onClick={handlePlatformSwitch}
        >
          <span><SwapOutlined /> {isChinese ? '当前平台' : 'Current platform'}</span>
          <strong>{onKalshiRoute ? 'KALSHI' : 'ALPACA'} · {isChinese ? '点击切换' : 'SWITCH'}</strong>
        </button>
        <div className="auth-shell__drawer-environment">
          {onKalshiRoute ? (
            <>
              <span className="auth-shell__connection auth-shell__connection--connected">
                <i aria-hidden="true" />
                <span>
                  {kalshiExecutionMode === 'real'
                    ? (isChinese ? 'KALSHI 实盘账户' : 'KALSHI REAL ACCOUNT')
                    : (isChinese ? 'KALSHI 公共行情' : 'KALSHI PUBLIC DATA')}
                </span>
              </span>
              <button
                type="button"
                className={`auth-shell__mode ${kalshiExecutionMode === 'real' ? 'auth-shell__mode--real' : 'auth-shell__mode--paper'}`}
                onClick={handleKalshiModeToggle}
                disabled={kalshiModeBusy}
              >
                {kalshiExecutionMode === 'real'
                  ? (isChinese ? '实盘模式' : 'REAL MODE')
                  : kalshiConfigured
                    ? (isChinese ? '模拟模式' : 'PAPER MODE')
                    : (isChinese ? '仅模拟' : 'PAPER ONLY')}
              </button>
            </>
          ) : (
            <>
              <span className={`auth-shell__connection auth-shell__connection--${alpacaStatus}`}>
                <i aria-hidden="true" />
                <span>
                  {alpacaStatus === 'checking'
                    ? (isChinese ? 'ALPACA 检查中' : 'ALPACA CHECKING')
                    : alpacaStatus === 'connected'
                      ? (isChinese ? 'ALPACA 已配置' : 'ALPACA CONFIGURED')
                      : (isChinese ? 'ALPACA 待配置' : 'ALPACA SETUP')}
                </span>
              </span>
              <button
                type="button"
                className={`auth-shell__mode auth-shell__mode--${tradeMode}`}
                onClick={handleMobileModeToggle}
              >
                {tradeMode === 'paper'
                  ? (isChinese ? '模拟模式' : 'PAPER MODE')
                  : (isChinese ? '实盘' : 'LIVE')}
              </button>
            </>
          )}
        </div>
        <nav className="auth-shell__drawer-nav" aria-label={isChinese ? '移动端导航' : 'Mobile navigation'}>
          {workspaceSections.map((section, sectionIndex) => (
            <section key={section.key}>
              <Link
                to={section.path}
                className={`auth-shell__drawer-section-title${activeSection?.key === section.key ? ' is-active' : ''}`}
                aria-current={activeSection?.key === section.key ? 'location' : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{localize(section)}</span>
                <span>0{sectionIndex + 1}</span>
              </Link>
              <div>
                {section.links.map((link) => {
                  const isActive = isShellLinkActive(navigationPath, link);
                  return (
                    <Link
                      key={link.key}
                      to={resolveLinkPath(link)}
                      className={isActive ? 'is-active' : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.icon}
                      <span>{localize(link)}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="auth-shell__drawer-preferences">
          <Link
            to={workspaceSafetyPath}
            className={navigationPath === workspaceSafetyPath ? 'is-active' : undefined}
            aria-current={navigationPath === workspaceSafetyPath ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span><SafetyCertificateOutlined /> {onKalshiRoute
              ? (isChinese ? '机器人风控' : 'Bot risk limits')
              : (isChinese ? '交易安全中心' : 'Safety center')}</span>
            <small>{onKalshiRoute
              ? (isChinese ? '概率、优势、流动性与仓位限制' : 'Probability, edge, liquidity and sizing limits')
              : (isChinese ? '暂停新入场并保持持仓保护' : 'Pause entries, keep protection active')}</small>
          </Link>
          <Link
            to="/settings"
            className={navigationState.linkKey === 'preferences' ? 'is-active' : undefined}
            aria-current={navigationState.linkKey === 'preferences' ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span><SettingOutlined /> {t.navigation.settings}</span>
            <small>{isChinese ? '账户与偏好' : 'Account & preferences'}</small>
          </Link>
          <Link
            to={workspaceConnectionPath}
            className={navigationPath === workspaceConnectionPath ? 'is-active' : undefined}
            aria-current={navigationPath === workspaceConnectionPath ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span><SlidersOutlined /> {isChinese ? '连接管理' : 'Connections'}</span>
            <small>{onKalshiRoute
              ? (isChinese ? 'Kalshi 与参考价格源状态' : 'Kalshi and reference price status')
              : (isChinese ? '数据与交易连接' : 'Data & trading access')}</small>
          </Link>
          <div className="auth-shell__drawer-theme">
            <span>{isChinese ? '外观' : 'Appearance'}</span>
            <div role="group" aria-label={t.common.switchTheme}>
              {([
                ['system', <DesktopOutlined key="system" />, t.common.themeSystem],
                ['light', <SunOutlined key="light" />, t.common.themeLight],
                ['dark', <MoonOutlined key="dark" />, t.common.themeDark],
              ] as const).map(([mode, icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={themeMode === mode ? 'is-active' : undefined}
                  aria-pressed={themeMode === mode}
                  onClick={() => setThemeMode(mode)}
                >
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="auth-shell__drawer-language"
            onClick={() => setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US')}
          >
            <span><GlobalOutlined /> {isChinese ? '语言' : 'Language'}</span>
            <strong>{isChinese ? '中文 / EN' : 'English / 中'}</strong>
          </button>
          <button
            type="button"
            className="auth-shell__drawer-language"
            onClick={() => {
              setMobileMenuOpen(false);
              setGuideOpenSignal((value) => value + 1);
            }}
          >
            <span><QuestionCircleOutlined /> {isChinese ? '新手教程' : 'Beginner guide'}</span>
            <strong>{isChinese ? '打开' : 'OPEN'}</strong>
          </button>
          <button
            type="button"
            className="auth-shell__drawer-language"
            onClick={() => {
              setMobileMenuOpen(false);
              setPageGuideOpenSignal((value) => value + 1);
            }}
          >
            <span><CompassOutlined /> {isChinese ? '本页指南' : 'Page guide'}</span>
            <strong>{isChinese ? '打开' : 'OPEN'}</strong>
          </button>
        </div>
        <div className="auth-shell__drawer-account">
          <span className="auth-shell__avatar">{initials}</span>
          <div><b>{user?.email || 'AlphaLab'}</b><span>{isChinese ? '已登录' : 'Authenticated'}</span></div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            aria-label={isChinese ? '退出登录' : 'Sign out'}
          >
            <LogoutOutlined />
          </button>
        </div>
      </Drawer>

      <Modal
        title={(
          <div className="auth-shell__real-modal-title">
            <span><SwapOutlined /> {t.navigation.tradeEnvironment}</span>
            <strong>{t.navigation.switchToRealTrading}</strong>
          </div>
        )}
        open={realModalOpen}
        onOk={handleRealConfirm}
        onCancel={() => {
          setRealModalOpen(false);
          setRealRiskAccepted(false);
        }}
        okText={t.navigation.switchToRealMode}
        cancelText={t.navigation.stayInPaperMode}
        okButtonProps={{ disabled: !realRiskAccepted, className: 'auth-shell__real-confirm-button' }}
        width={480}
        className="auth-shell__real-modal"
        centered
        destroyOnHidden
      >
        <div className="auth-shell__mode-transition" aria-label={t.navigation.tradeEnvironment}>
          <div>
            <span>{t.navigation.currentEnvironment}</span>
            <strong>{t.navigation.paperEnvironment}</strong>
          </div>
          <i aria-hidden="true">→</i>
          <div className="is-live">
            <span>{t.navigation.liveEnvironment}</span>
            <strong>{t.navigation.realMode}</strong>
          </div>
        </div>

        <p className="auth-shell__real-modal-copy">{t.navigation.modeSwitchNoOrder}</p>

        <div className="auth-shell__real-guardrails">
          <div><SafetyCertificateOutlined /><span>{t.navigation.liveOrdersRequireReview}</span></div>
          <div><WarningOutlined /><span>{t.navigation.liveUsesConnectedAccount}</span></div>
        </div>

        <label className="auth-shell__real-acceptance">
          <Checkbox checked={realRiskAccepted} onChange={(event) => setRealRiskAccepted(event.target.checked)} />
          <span>{t.navigation.liveRiskAcceptance}</span>
        </label>
      </Modal>
      <BeginnerGuide language={language} userId={user?.id} openSignal={guideOpenSignal} />
      <PageGuide language={language} userId={user?.id} openSignal={pageGuideOpenSignal} />
    </div>
  );
};

export default AuthenticatedShell;
