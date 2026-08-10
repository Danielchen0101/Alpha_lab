type RouteTitle = {
  en: string;
  zh: string;
};

const title = (en: string, zh: string): RouteTitle => ({ en, zh });

const exactRouteTitles: Record<string, RouteTitle> = {
  '/': title('Quant Research Platform', '量化研究平台'),
  '/dashboard': title('Market Overview', '市场总览'),
  '/activity': title('Activity', '活动记录'),
  '/signals': title('Activity', '活动记录'),
  '/system-health': title('System Health', '系统状态'),
  '/system-status': title('System Health', '系统状态'),
  '/safety': title('Trading Safety Center', '交易安全中心'),
  '/watchlist': title('Watchlist', '自选列表'),
  '/market': title('Markets', '市场研究'),
  '/scanner': title('Markets', '市场研究'),
  '/agent': title('AI Research', 'AI 研究'),
  '/agent-preview': title('AI Research', 'AI 研究'),
  '/agent/candidates': title('Candidate Universe', '候选池'),
  '/agent/review': title('Review Workspace', '研究审核'),
  '/backtest': title('Strategy Lab', '策略研究'),
  '/backtest-analysis': title('Strategy Lab', '策略研究'),
  '/compare': title('Strategy Lab', '策略研究'),
  '/optimize': title('Strategy Lab', '策略研究'),
  '/ranking': title('Strategy Lab', '策略研究'),
  '/trade': title('Trade Desk', '交易台'),
  '/market/intelligence': title('Market Intelligence', '市场分析'),
  '/portfolio': title('Portfolio', '投资组合'),
  '/settings': title('Settings', '设置'),
  '/settings/configuration': title('Connections', '连接管理'),
  '/signin': title('Sign In', '登录'),
  '/login': title('Sign In', '登录'),
  '/signup': title('Create Account', '注册'),
  '/mfa': title('Two-Factor Verification', '双重验证'),
  '/forgot-password': title('Account Recovery', '账户恢复'),
  '/reset-password': title('Account Recovery', '账户恢复'),
  '/platform': title('Platform', '平台'),
  '/workflow': title('Workflow', '工作流程'),
  '/research': title('Research', '研究能力'),
  '/features': title('Research', '研究能力'),
  '/examples': title('Examples', '案例'),
  '/data': title('Data & Method', '数据与方法'),
  '/technology': title('Technology', '技术架构'),
  '/security': title('Security', '安全'),
  '/terms': title('Terms of Service', '服务条款'),
  '/privacy': title('Privacy Policy', '隐私政策'),
  '/auth/confirmed': title('Email Confirmed', '邮箱已确认'),
  '/about': title('About', '关于'),
  '/language-test': title('Language Test', '语言测试'),
  '/button-preview': title('Button Preview', '按钮预览'),
};

const normalizePathname = (pathname: string): string => {
  const path = pathname || '/';
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return normalized.toLowerCase();
};

const isPathWithin = (pathname: string, base: string): boolean => (
  pathname === base || pathname.startsWith(`${base}/`)
);

export const resolveRouteTitle = (pathname: string, language: string): string => {
  const normalizedPathname = normalizePathname(pathname);
  const isZh = language === 'zh-CN';
  let routeTitle = exactRouteTitles[normalizedPathname];

  if (!routeTitle && isPathWithin(normalizedPathname, '/crypto')) {
    routeTitle = title('Crypto Quant', '虚拟币量化');
  } else if (!routeTitle && isPathWithin(normalizedPathname, '/kalshi')) {
    routeTitle = title('Kalshi Event Contracts', 'Kalshi 事件合约');
  } else if (!routeTitle && (
    isPathWithin(normalizedPathname, '/market/intelligence')
    || isPathWithin(normalizedPathname, '/trade/intelligence')
  )) {
    routeTitle = title('Market Intelligence', '市场分析');
  } else if (
    !routeTitle
    && (/^\/market\/symbol\/[^/]+$/.test(normalizedPathname)
      || /^\/analysis\/[^/]+$/.test(normalizedPathname))
  ) {
    routeTitle = title('Markets', '市场研究');
  } else if (
    !routeTitle
    && (/^\/backtest\/[^/]+$/.test(normalizedPathname)
      || /^\/backtest-analysis\/[^/]+$/.test(normalizedPathname))
  ) {
    routeTitle = title('Strategy Lab', '策略研究');
  }

  const resolved = routeTitle || title('Page Not Found', '页面未找到');
  return isZh ? resolved.zh : resolved.en;
};
