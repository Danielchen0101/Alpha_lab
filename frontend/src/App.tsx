import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider, theme, Space, Button, Drawer, Menu } from 'antd';
import { MenuOutlined, DashboardOutlined, LineChartOutlined, BarChartOutlined, TrophyOutlined, UnorderedListOutlined, SwapOutlined, RocketOutlined, PieChartOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Platform from './pages/Platform';
import Workflow from './pages/Workflow';
import Features from './pages/Features';
import Technology from './pages/Technology';
import About from './pages/About';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import AuthConfirmed from './pages/AuthConfirmed';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Backtest from './pages/Backtest';
import BacktestDetail from './pages/BacktestDetail';
import StrategyComparison from './pages/StrategyComparison';
import Watchlist from './pages/Watchlist';
import StrategyRanking from './pages/StrategyRanking';
import ParameterOptimization from './pages/ParameterOptimization.jsx';
import Agent from './pages/Agent';
import Trade from './pages/Trade';
import Portfolio from './pages/Portfolio';
import Settings from './pages/Settings';
import Configuration from './pages/Configuration';
import SymbolAnalysis from './pages/SymbolAnalysis';
import BacktestAnalysis from './pages/BacktestAnalysis';
import LanguageTest from './pages/LanguageTest';
import NotFound from './pages/NotFound';
import Security from './pages/Security';
import LanguageButtonPreview from './components/LanguageButtonPreview';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeSwitcher from './components/ThemeSwitcher';
import NavigationMenu from './components/NavigationMenu';
import { LanguageProvider } from './contexts/LanguageContext';
import { useLanguage } from './contexts/LanguageContext';
import { TradeModeProvider } from './contexts/TradeModeContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './App.css';

const { Header, Content, Sider } = Layout;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { t } = useLanguage();


  // Mobile nav items — mirrors desktop sidebar structure
  const mobileNavItems = [
    { key: 'research-group', type: 'group' as const, label: t.navigation.researchGroup, children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: t.navigation.dashboard },
      { key: '/market', icon: <LineChartOutlined />, label: t.navigation.market },
      { key: '/watchlist', icon: <UnorderedListOutlined />, label: t.navigation.watchlist },
    ]},
    { key: 'strategy-group', type: 'group' as const, label: t.navigation.strategyGroup, children: [
      { key: '/backtest', icon: <BarChartOutlined />, label: t.navigation.backtest },
      { key: '/optimize', icon: <RocketOutlined />, label: t.navigation.parameterOptimization },
      { key: '/compare', icon: <SwapOutlined />, label: t.navigation.strategyComparison },
      { key: '/ranking', icon: <TrophyOutlined />, label: t.navigation.strategyRanking },
    ]},
    { key: 'trading-group', type: 'group' as const, label: t.navigation.tradingGroup, children: [
      { key: '/agent', icon: <RobotOutlined />, label: t.navigation.agent },
      { key: '/trade', icon: <SwapOutlined />, label: t.navigation.trade },
      { key: '/portfolio', icon: <PieChartOutlined />, label: t.navigation.portfolio },
    ]},
    { key: 'system-group', type: 'group' as const, label: t.navigation.systemGroup, children: [
      { key: '/settings', icon: <SettingOutlined />, label: t.navigation.settings },
    ]},
  ];

  const handleMobileNavClick = (path: string) => {
    setMobileMenuOpen(false);
    // Use window.location for simplicity; React Router navigation would require useNavigate
    window.location.href = path;
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        width="var(--app-sidebar-width, 220px)"
        collapsedWidth={80}
        theme="dark"
        className="app-sidebar"
        style={{
          overflow: 'hidden',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="sidebar-logo-container" style={{
          height: 64,
          margin: '16px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          padding: collapsed ? '0 8px' : '0 24px',
          transition: 'padding 0.2s'
        }}>
          {collapsed ? (
            <img src="/brand/alphalab-icon.png" alt="AlphaLab" style={{ height: 32, width: 32, objectFit: 'contain' }} />
          ) : (
            <img src="/brand/alphalab-logo.png" alt="AlphaLab" style={{ width: '100%', maxWidth: '160px', height: 'auto', objectFit: 'contain' }} />
          )}
        </div>
        <NavigationMenu collapsed={collapsed} />
      </Sider>
      <Layout className="app-main-layout" style={{
        marginLeft: collapsed ? 80 : 'var(--app-sidebar-width, 220px)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--app-bg)'
      }}>
        <Header style={{
          padding: '0 24px',
          background: 'var(--app-header-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--app-header-shadow)',
          zIndex: 99
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              className="mobile-nav-trigger"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              style={{ color: 'var(--app-text)', display: 'none' }}
            />
          </div>
          <Space size={8}>
            <ThemeSwitcher />
            <LanguageSwitcher />
          </Space>
        </Header>
        <Content style={{
          margin: '24px 24px 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          height: 'calc(100vh - 112px)',
          minHeight: 0,
          paddingBottom: 24
        }}>
          <div style={{
            padding: 32,
            background: 'var(--app-surface)',
            borderRadius: 12,
            minHeight: '100%',
            boxShadow: 'var(--app-shadow)',
            color: 'var(--app-text)'
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* Mobile Navigation Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/brand/alphalab-icon.png" alt="AlphaLab" style={{ height: 24, width: 24, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>AlphaLab</span>
          </div>
        }
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
        className="mobile-nav-drawer"
        styles={{
          body: { padding: '8px 0' },
          header: { borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[window.location.pathname]}
          defaultOpenKeys={['research-group', 'strategy-group', 'trading-group', 'system-group']}
          items={mobileNavItems}
          onClick={({ key }) => handleMobileNavClick(key)}
          style={{ background: 'transparent', border: 'none' }}
        />
      </Drawer>
    </Layout>
  );
};

const ThemedApp: React.FC = () => {
  const { resolvedTheme } = useTheme();
  
  return (
    <ConfigProvider theme={{ 
      algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: { 
        colorPrimary: '#1890ff', 
        borderRadius: 6,
        fontSize: 13.5,
        fontSizeSM: 12,
        controlHeight: 30,
        controlHeightSM: 24,
        padding: 16,
        paddingSM: 12,
        margin: 16,
        marginSM: 12,
      } 
    }}>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public routes - no sidebar */}
            <Route path="/" element={<Landing />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/features" element={<Features />} />
            <Route path="/technology" element={<Technology />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/auth/confirmed" element={<AuthConfirmed />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/scanner" element={<Navigate to="/market" replace />} />
            <Route path="/security" element={<Security />} />

            {/* Protected routes - with sidebar layout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/market" element={<Market />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/backtest/:id" element={<BacktestDetail />} />
              <Route path="/backtest-analysis" element={<BacktestAnalysis />} />
              <Route path="/analysis/:symbol" element={<SymbolAnalysis />} />
              <Route path="/compare" element={<StrategyComparison />} />
              <Route path="/optimize" element={<ParameterOptimization />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/ranking" element={<StrategyRanking />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/configuration" element={<Configuration />} />
              <Route path="/language-test" element={<LanguageTest />} />
              <Route path="/button-preview" element={<LanguageButtonPreview />} />
            </Route>

            {/* Fallback 404 — must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <TradeModeProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </TradeModeProvider>
    </LanguageProvider>
  );
};

export default App;
