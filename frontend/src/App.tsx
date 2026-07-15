import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import enUSAntd from 'antd/locale/en_US';
import zhCNAntd from 'antd/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Platform from './pages/Platform';
import Workflow from './pages/Workflow';
import Features from './pages/Features';
import Examples from './pages/Examples';
import DataMethod from './pages/DataMethod';
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
import Activity from './pages/Activity';
import Market from './pages/Market';
import Backtest from './pages/Backtest';
import BacktestDetail from './pages/BacktestDetail';
import StrategyComparison from './pages/StrategyComparison';
import Watchlist from './pages/Watchlist';
import StrategyRanking from './pages/StrategyRanking';
import ParameterOptimization from './pages/ParameterOptimization.jsx';
import Trade from './pages/Trade';
import Portfolio from './pages/Portfolio';
import Settings from './pages/Settings';
import SystemHealth from './pages/SystemHealth';
import Configuration from './pages/Configuration';
import SymbolAnalysis from './pages/SymbolAnalysis';
import LanguageTest from './pages/LanguageTest';
import NotFound from './pages/NotFound';
import Security from './pages/Security';
import LanguageButtonPreview from './components/LanguageButtonPreview';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TradeModeProvider } from './contexts/TradeModeContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AuthenticatedShell from './components/AuthenticatedShell';
import { CandidateUniversePage, ReviewWorkspacePage } from './pages/ResearchWorkspace';
import {
  LEGACY_MARKET_SYMBOL_ROOT,
  MARKET_SCANNER_PATH,
  MARKET_SYMBOL_ROOT,
  marketSymbolPath,
} from './routes/marketRoutes';
import {
  AI_RESEARCH_PATH,
  RESEARCH_CANDIDATES_PATH,
  RESEARCH_REVIEW_PATH,
} from './routes/researchRoutes';
import './App.css';

const Agent = React.lazy(() => import('./pages/Agent'));

type RedirectTarget = {
  pathname: string;
  search: string;
  hash: string;
};

export const buildRedirectTarget = (
  pathname: string,
  location: Pick<Location, 'search' | 'hash'>,
): RedirectTarget => ({
  pathname,
  search: location.search,
  hash: location.hash,
});

const PreservingRedirect: React.FC<{ to: string }> = ({ to }) => {
  const location = useLocation();
  return <Navigate to={buildRedirectTarget(to, location)} replace />;
};

const AgentRoute: React.FC = () => {
  const { language } = useLanguage();

  return (
    <React.Suspense
      fallback={(
        <div
          className="app-route-loader"
          role="status"
          aria-label={language === 'zh-CN' ? '正在加载 AI 研究工作台' : 'Loading AI research workspace'}
        >
          <Spin size="large" />
        </div>
      )}
    >
      <Agent />
    </React.Suspense>
  );
};

const LegacySymbolAnalysisRedirect: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const location = useLocation();
  return <Navigate to={buildRedirectTarget(marketSymbolPath(symbol), location)} replace />;
};

const LegacyBacktestAnalysisRedirect: React.FC = () => {
  const { backtestId } = useParams<{ backtestId: string }>();
  const location = useLocation();
  const pathname = backtestId ? `/backtest/${encodeURIComponent(backtestId)}` : '/backtest';
  return <Navigate to={buildRedirectTarget(pathname, location)} replace />;
};

const RouteTitleManager: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();

  React.useEffect(() => {
    const zh = language === 'zh-CN';
    const pathname = location.pathname;
    const title = pathname === '/' ? (zh ? '量化研究平台' : 'Quant Research Platform')
      : pathname.startsWith('/dashboard') ? (zh ? '市场总览' : 'Market Overview')
        : pathname.startsWith('/activity') ? (zh ? '活动记录' : 'Activity')
          : pathname.startsWith('/system-health') ? (zh ? '系统状态' : 'System Health')
            : pathname.startsWith('/watchlist') ? (zh ? '自选列表' : 'Watchlist')
              : pathname.startsWith('/market') ? (zh ? '市场研究' : 'Markets')
                : pathname.startsWith('/agent/review') ? (zh ? '研究审核' : 'Review Workspace')
                  : pathname.startsWith('/agent/candidates') ? (zh ? '候选池' : 'Candidate Universe')
                    : pathname.startsWith('/agent') ? (zh ? 'AI 研究' : 'AI Research')
                      : pathname.startsWith('/backtest') || pathname.startsWith('/compare') || pathname.startsWith('/optimize') || pathname.startsWith('/ranking')
                        ? (zh ? '策略研究' : 'Strategy Lab')
                        : pathname.startsWith('/trade') ? (zh ? '交易台' : 'Trade Desk')
                          : pathname.startsWith('/portfolio') ? (zh ? '投资组合' : 'Portfolio')
                            : pathname.startsWith('/settings/configuration') ? (zh ? '连接管理' : 'Connections')
                              : pathname.startsWith('/settings') ? (zh ? '设置' : 'Settings')
                              : pathname.startsWith('/signin') ? (zh ? '登录' : 'Sign In')
                                : pathname.startsWith('/signup') ? (zh ? '注册' : 'Create Account')
                                  : pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')
                                    ? (zh ? '账户恢复' : 'Account Recovery')
                                    : pathname.startsWith('/platform') ? (zh ? '平台' : 'Platform')
                                      : pathname.startsWith('/workflow') ? (zh ? '工作流程' : 'Workflow')
                                        : pathname.startsWith('/research') ? (zh ? '研究能力' : 'Research')
                                          : pathname.startsWith('/examples') ? (zh ? '案例' : 'Examples')
                                            : pathname.startsWith('/data') ? (zh ? '数据与方法' : 'Data & Method')
                                              : pathname.startsWith('/technology') ? (zh ? '技术架构' : 'Technology')
                                              : pathname.startsWith('/security') ? (zh ? '安全' : 'Security')
                                                : pathname.startsWith('/terms') ? (zh ? '服务条款' : 'Terms of Service')
                                                  : pathname.startsWith('/privacy') ? (zh ? '隐私政策' : 'Privacy Policy')
                                                    : pathname.startsWith('/auth/confirmed') ? (zh ? '邮箱已确认' : 'Email Confirmed')
                                                      : pathname.startsWith('/about') ? (zh ? '关于' : 'About')
                                                        : (zh ? '页面未找到' : 'Page Not Found');

    document.title = `${title} | AlphaLab`;
  }, [language, location.pathname]);

  return null;
};

const AuthAwareNotFound: React.FC = () => {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const zh = language === 'zh-CN';

  if (loading) {
    return (
      <div className="app-route-loader" role="status" aria-label={zh ? '正在检查登录状态' : 'Checking session'}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <NotFound />;

  return (
    <AuthenticatedShell>
      <section className="workspace-not-found" aria-labelledby="workspace-not-found-title">
        <span>{zh ? '404 / 工作区路径' : '404 / WORKSPACE ROUTE'}</span>
        <h1 id="workspace-not-found-title">{zh ? '这个工作区页面不存在。' : 'This workspace page does not exist.'}</h1>
        <p>{zh ? '链接可能已更新，或地址输入有误。你的登录状态和当前设置都没有受到影响。' : 'The link may have changed or the address may be incomplete. Your session and workspace settings are unchanged.'}</p>
        <div>
          <Link to="/dashboard">{zh ? '返回市场总览' : 'Return to overview'}</Link>
          <Link to="/settings">{zh ? '打开设置' : 'Open settings'}</Link>
        </div>
      </section>
    </AuthenticatedShell>
  );
};

const ThemedApp: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { language } = useLanguage();
  
  return (
    <ConfigProvider
      locale={language === 'zh-CN' ? zhCNAntd : enUSAntd}
      theme={{
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
      }}
    >
      <Router>
        <RouteTitleManager />
        <AuthProvider>
          <TradeModeProvider>
            <Routes>
            {/* Public routes - no sidebar */}
            <Route path="/" element={<Landing />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/research" element={<Features />} />
            <Route path="/features" element={<PreservingRedirect to="/research" />} />
            <Route path="/examples" element={<Examples />} />
            <Route path="/data" element={<DataMethod />} />
            <Route path="/technology" element={<Technology />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<PreservingRedirect to="/signin" />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/auth/confirmed" element={<AuthConfirmed />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/scanner" element={<PreservingRedirect to={MARKET_SCANNER_PATH} />} />
            <Route path="/security" element={<Security />} />

            {/* Protected routes - with the authenticated research workspace shell */}
            <Route element={<ProtectedRoute><AuthenticatedShell /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/system-health" element={<SystemHealth />} />
              <Route path="/system-status" element={<PreservingRedirect to="/system-health" />} />
              <Route path="/signals" element={<PreservingRedirect to="/activity" />} />
              <Route path={MARKET_SCANNER_PATH} element={<Market />} />
              <Route path={`${MARKET_SYMBOL_ROOT}/:symbol`} element={<SymbolAnalysis />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/backtest/:id" element={<BacktestDetail />} />
              <Route path="/backtest-analysis" element={<PreservingRedirect to="/backtest" />} />
              <Route path="/backtest-analysis/:backtestId" element={<LegacyBacktestAnalysisRedirect />} />
              <Route path={`${LEGACY_MARKET_SYMBOL_ROOT}/:symbol`} element={<LegacySymbolAnalysisRedirect />} />
              <Route path="/compare" element={<StrategyComparison />} />
              <Route path="/optimize" element={<ParameterOptimization />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/ranking" element={<StrategyRanking />} />
              <Route path={AI_RESEARCH_PATH} element={<AgentRoute />} />
              <Route path={RESEARCH_CANDIDATES_PATH} element={<CandidateUniversePage />} />
              <Route path={RESEARCH_REVIEW_PATH} element={<ReviewWorkspacePage />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/configuration" element={<Configuration />} />
              {process.env.NODE_ENV === 'development' && (
                <>
                  <Route path="/language-test" element={<LanguageTest />} />
                  <Route path="/button-preview" element={<LanguageButtonPreview />} />
                </>
              )}
            </Route>

            {/* Fallback 404 — must be last */}
            <Route path="*" element={<AuthAwareNotFound />} />
            </Routes>
          </TradeModeProvider>
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;
