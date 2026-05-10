import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
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
import LanguageButtonPreview from './components/LanguageButtonPreview';
import LanguageSwitcher from './components/LanguageSwitcher';
import NavigationMenu from './components/NavigationMenu';
import { LanguageProvider } from './contexts/LanguageContext';
import { TradeModeProvider } from './contexts/TradeModeContext';
import './App.css';

const { Header, Content, Sider } = Layout;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        width={240}
        collapsedWidth={80}
        theme="dark"
        className="app-sidebar"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
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
      <Layout style={{ 
        marginLeft: collapsed ? 80 : 240, 
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        background: '#f8fafc' 
      }}>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          zIndex: 99
        }}>
          <LanguageSwitcher />
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
            background: '#fff', 
            borderRadius: 12, 
            minHeight: '100%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <TradeModeProvider>
      <ConfigProvider theme={{ token: { colorPrimary: '#1890ff', borderRadius: 6 } }}>
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
            </Routes>
          </AuthProvider>
        </Router>
      </ConfigProvider>
      </TradeModeProvider>
    </LanguageProvider>
  );
};

export default App;
