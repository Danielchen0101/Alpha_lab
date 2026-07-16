import React from 'react';
import { Checkbox, Drawer, Dropdown, Input, Modal, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  CloseOutlined,
  DesktopOutlined,
  DownOutlined,
  ExperimentOutlined,
  FundOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  PieChartOutlined,
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
import { searchStocks } from '../services/marketDataService';
import type { SearchResult } from '../services/marketDataService';
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

export type ShellSection = 'overview' | 'markets' | 'research' | 'strategies' | 'trade' | 'settings';

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
      isShellPath(pathname, '/system-status')
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

export interface ShellNavigationState {
  pathname: string;
  sectionKey: ShellSection | null;
  linkKey: string | null;
}

const findActiveSection = (pathname: string): ShellSectionConfig | undefined => (
  sections.find((section) => section.matches(pathname))
  ?? (settingsSection.matches(pathname) ? settingsSection : undefined)
);

const isShellLinkActive = (pathname: string, link: ShellLink): boolean => (
  link.match ? link.match(pathname) : isShellPath(pathname, link.path)
);

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
  const [realModalOpen, setRealModalOpen] = React.useState(false);
  const [realRiskAccepted, setRealRiskAccepted] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [dashboardSync, setDashboardSync] = React.useState<{ loading: boolean; timestamp: number | null }>({
    loading: false,
    timestamp: null,
  });
  const searchInputRef = React.useRef<InputRef>(null);
  const mobileSearchInputRef = React.useRef<InputRef>(null);
  const searchRequestRef = React.useRef(0);
  const secondaryNavRef = React.useRef<HTMLElement>(null);

  const isChinese = language === 'zh-CN';
  const navigationState = getShellNavigationState(location.pathname);
  const navigationPath = navigationState.pathname;
  const onConfigurationRoute = isShellPath(navigationPath, '/settings/configuration');
  const activeSection = findActiveSection(navigationPath);
  const workspaceContext = activeSection?.key === 'overview'
    ? (isChinese ? '总览工作台' : 'OVERVIEW DESK')
    : activeSection?.key === 'markets'
      ? (isChinese ? '市场工作区' : 'MARKET WORKSPACE')
      : activeSection?.key === 'research'
        ? (isChinese ? '研究工作区' : 'RESEARCH WORKSPACE')
        : activeSection?.key === 'strategies'
          ? (isChinese ? '策略实验室' : 'STRATEGY LAB')
          : activeSection?.key === 'trade'
            ? (isChinese ? '执行工作区' : 'EXECUTION WORKSPACE')
            : activeSection?.key === 'settings'
              ? (isChinese ? '账户设置' : 'ACCOUNT SETTINGS')
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
    let active = true;
    setAlpacaStatus('checking');
    void loadConfigStatus({ timeoutMs: 6000, force: true }).then((result) => {
      if (!active) return;
      const alpaca = result.data?.alpaca;
      const configured = tradeMode === 'real' ? alpaca?.liveConfigured : alpaca?.paperConfigured;
      setAlpacaStatus(result.ok && configured ? 'connected' : 'attention');
    });
    return () => { active = false; };
  }, [tradeMode, onConfigurationRoute]);

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
  }, [symbolQuery]);

  const localize = (item: { label: string; labelZh: string }) => (
    isChinese ? item.labelZh : item.label
  );

  const resolveLinkPath = (link: ShellLink) => (
    link.key === 'symbol-analysis' ? marketSymbolPath(lastMarketSymbol) : link.path
  );

  const handleSearch = (event?: React.FormEvent, compact = false) => {
    event?.preventDefault();
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
        placeholder={isChinese ? '搜索股票代码或命令' : 'Search symbols or commands'}
        aria-label={isChinese ? '搜索股票代码' : 'Search stock symbols'}
        bordered={false}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      {!compact && (searchLoading ? <span className="auth-shell__search-loading" aria-hidden="true" /> : <kbd>⌘K</kbd>)}
      {searchOpen && symbolResults.length > 0 && (
        <div className="auth-shell__search-results" role="listbox" aria-label={isChinese ? '股票搜索结果' : 'Symbol search results'}>
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

          <Link to="/dashboard" className="auth-shell__wordmark" aria-label={isChinese ? 'AlphaLab 市场总览' : 'AlphaLab overview'}>
            <span className="auth-shell__wordmark-symbol">A</span>
            <span>lphaLab</span>
            <i aria-hidden="true" />
          </Link>

          <nav className="auth-shell__primary-nav" aria-label={isChinese ? '主导航' : 'Primary navigation'}>
            {sections.map((section) => (
              <Link
                key={section.key}
                to={section.path}
                className={activeSection?.key === section.key ? 'is-active' : undefined}
                aria-current={activeSection?.key === section.key ? 'page' : undefined}
              >
                {localize(section)}
              </Link>
            ))}
          </nav>

          <div className="auth-shell__desktop-search">{renderSearch()}</div>

          <div className="auth-shell__environment" aria-label={isChinese ? '交易环境' : 'Trading environment'}>
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
          </div>

          <div className="auth-shell__utilities">
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
              onClick={() => setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US')}
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
                  to="/settings/configuration"
                  state={{ returnTo: `${navigationPath}${location.search}${location.hash}` }}
                >
                  {isChinese ? '连接设置' : 'CONNECTIONS'}
                </Link>
              </>
            )}
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
            to="/dashboard"
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
        <div className="auth-shell__drawer-environment">
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
        </div>
        <nav className="auth-shell__drawer-nav" aria-label={isChinese ? '移动端导航' : 'Mobile navigation'}>
          {sections.map((section) => (
            <section key={section.key}>
              <Link
                to={section.path}
                className={`auth-shell__drawer-section-title${activeSection?.key === section.key ? ' is-active' : ''}`}
                aria-current={activeSection?.key === section.key ? 'location' : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{localize(section)}</span>
                <span>0{sections.indexOf(section) + 1}</span>
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
            to="/settings"
            className={navigationState.linkKey === 'preferences' ? 'is-active' : undefined}
            aria-current={navigationState.linkKey === 'preferences' ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span><SettingOutlined /> {t.navigation.settings}</span>
            <small>{isChinese ? '账户与偏好' : 'Account & preferences'}</small>
          </Link>
          <Link
            to="/settings/configuration"
            className={navigationState.linkKey === 'connections' ? 'is-active' : undefined}
            aria-current={navigationState.linkKey === 'connections' ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span><SlidersOutlined /> {isChinese ? '连接管理' : 'Connections'}</span>
            <small>{isChinese ? '数据与交易连接' : 'Data & trading access'}</small>
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
    </div>
  );
};

export default AuthenticatedShell;
