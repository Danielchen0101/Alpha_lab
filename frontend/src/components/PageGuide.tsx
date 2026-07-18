import React from 'react';
import { Button, Tour } from 'antd';
import type { TourProps } from 'antd';
import { CompassOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import './PageGuide.css';

type Language = 'zh-CN' | 'en-US';

interface GuideStep {
  selector: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
}

interface PageGuideDefinition {
  key: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  match: (path: string) => boolean;
  steps: GuideStep[];
}

interface PageGuideProps {
  language: Language;
  userId?: string;
  openSignal: number;
}

const step = (selector: string, titleZh: string, titleEn: string, bodyZh: string, bodyEn: string): GuideStep => ({
  selector, titleZh, titleEn, bodyZh, bodyEn,
});

const starts = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

const PAGE_GUIDES: PageGuideDefinition[] = [
  {
    key: 'connections', titleZh: '连接管理', titleEn: 'Connections',
    summaryZh: '连接券商、市场数据、AI 与通知服务。建议先完成模拟盘连接。',
    summaryEn: 'Connect brokerage, market data, AI, and notifications. Start with Paper trading.',
    match: (path) => starts(path, '/settings/configuration'),
    steps: [
      step('[data-tour="config-paper"] .config-card-header', 'Alpaca 模拟盘', 'Alpaca Paper', '从这里申请并保存模拟盘 API Key 与 Secret，然后测试连接。', 'Save Paper API credentials here, then test the connection.'),
      step('[data-tour="config-finnhub"] .config-card-header', '基本面数据', 'Fundamental data', 'Finnhub 用于补充公司资料、财报日期和事件信息。', 'Finnhub adds company profiles, earnings dates, and event context.'),
      step('[data-tour="config-ai"] .config-card-header', 'AI 审核服务', 'AI reviewer', '选择提供商、模型和 API Key。AI 负责解释与质询，不能绕过硬风控。', 'Choose a provider, model, and API key. AI explains and challenges; it cannot override hard gates.'),
      step('#notifications .configuration-group__header', '通知服务', 'Notifications', '在这里配置 Discord，只接收重要交易、风险和周期摘要。', 'Configure Discord for important trade, risk, and cycle summaries.'),
    ],
  },
  {
    key: 'settings', titleZh: '偏好与账户设置', titleEn: 'Preferences and account',
    summaryZh: '管理连接状态、界面偏好与账户安全。', summaryEn: 'Manage connection status, display preferences, and account security.',
    match: (path) => path === '/settings',
    steps: [
      step('.settings-status__summary', '服务状态', 'Service status', '先确认券商、数据和 AI 服务是否可用。', 'Confirm brokerage, data, and AI services are available.'),
      step('.settings-panel--connections .settings-panel__copy', '连接管理', 'Connection management', '进入连接管理可更新或测试各服务的 API 凭证。', 'Open Connections to update or test provider credentials.'),
      step('.settings-panel--appearance .settings-panel__heading', '显示偏好', 'Display preferences', '选择主题和语言；这些设置会保存在当前账户下。', 'Choose theme and language; preferences are saved for this account.'),
    ],
  },
  {
    key: 'dashboard', titleZh: '每日总览', titleEn: 'Daily overview',
    summaryZh: '开盘前先检查账户、市场广度、研究状态与关注标的。', summaryEn: 'Check account, market breadth, research status, and watchlist before the session.',
    match: (path) => path === '/dashboard',
    steps: [
      step('.ed-page-heading', '今日市场结构', 'Today\'s market structure', '这里汇总市场环境和账户同步状态，不是直接交易信号。', 'This summarizes market and account state; it is not a trade signal.'),
      step('.ed-panel-heading-dark', '市场广度', 'Market breadth', '查看上涨比例和板块参与度，判断信号是否得到市场确认。', 'Use breadth and sector participation to judge whether signals have broad confirmation.'),
      step('.ed-session-panel .ed-panel-heading', '研究进度', 'Research progress', '这里显示最近研究流程和需要继续处理的阶段。', 'This shows the latest research cycle and stages needing attention.'),
      step('.ed-watchlist-panel .ed-panel-heading', '关注标的', 'Watchlist', '快速查看已关注标的，详细判断仍应进入市场或研究页面完成。', 'Review watched symbols here; use Markets or Research for detailed decisions.'),
    ],
  },
  {
    key: 'activity', titleZh: '活动记录', titleEn: 'Activity log',
    summaryZh: '查看扫描、研究、订单和风险事件的可追溯记录。', summaryEn: 'Review traceable scan, research, order, and risk events.',
    match: (path) => path === '/activity',
    steps: [
      step('.activity-page__hero', '活动账本', 'Activity ledger', '这里记录后台真实发生的操作和结果。', 'This ledger contains operations and outcomes recorded by the backend.'),
      step('.activity-page__toolbar', '筛选活动', 'Filter activity', '按事件类型和时间缩小范围，定位异常或订单结果。', 'Filter by event type and time to investigate anomalies or order outcomes.'),
      step('.activity-page__feed-head', '事件证据', 'Event evidence', '展开事件查看原因、数据来源和关联的运行阶段。', 'Open an event to inspect reasons, sources, and its pipeline stage.'),
    ],
  },
  {
    key: 'system-health', titleZh: '系统状态', titleEn: 'System health',
    summaryZh: '检查后端、数据源、调度器和延迟状态。', summaryEn: 'Inspect backend, providers, scheduler, and latency health.',
    match: (path) => path === '/system-health',
    steps: [
      step('.sh-hero__controls', '刷新状态', 'Refresh status', '需要排查问题时先刷新，确认状态来自最新一次检查。', 'Refresh first when troubleshooting so status reflects the latest check.'),
      step('.sh-section-heading', '服务账本', 'Service ledger', '逐项检查连接、健康状态和最后响应时间。', 'Inspect each service connection, health state, and latest response.'),
      step('.sh-attention-panel .sh-section-heading', '需要关注', 'Needs attention', '这里集中显示会影响研究或交易的异常。', 'This area collects issues that can affect research or execution.'),
    ],
  },
  {
    key: 'safety', titleZh: '交易安全中心', titleEn: 'Trading safety center',
    summaryZh: '在异常情况下暂停新入场，同时保留持仓保护与退出能力。', summaryEn: 'Pause new entries during incidents while keeping position protection and exits active.',
    match: (path) => path === '/safety',
    steps: [
      step('.safety-hero__controls', '安全控制', 'Safety controls', '这里可以暂停新买入或恢复交易权限。', 'Pause new buys or restore trading authority here.'),
      step('.safety-section-heading', '账户风险', 'Account risk', '检查账户限制、风险预算和当前安全状态。', 'Review account limits, risk budget, and current safety state.'),
      step('.safety-check-grid', '交易前检查', 'Pre-trade checks', '实盘订单必须通过这些检查，AI 也不能跳过。', 'Live orders must pass these checks; AI cannot bypass them.'),
    ],
  },
  {
    key: 'market-scanner', titleZh: '市场扫描', titleEn: 'Market scanner',
    summaryZh: '设置股票池和硬筛选条件，再生成研究优先级候选。', summaryEn: 'Set universe and hard filters, then rank research candidates.',
    match: (path) => path === '/market',
    steps: [
      step('.market-hero__actions', '运行扫描', 'Run scanner', '启动 Alpaca 全市场扫描；排名代表研究优先级，不代表自动买入。', 'Run the Alpaca universe scan. Ranking is research priority, not an automatic buy.'),
      step('.market-filter-panel .market-section-head', '扫描条件', 'Scan criteria', '调整价格、流动性、历史长度、波动率和输出数量。', 'Adjust price, liquidity, history, volatility, and output size.'),
      step('.market-ledger', '扫描摘要', 'Scan summary', '核对处理数量、证据覆盖和数据质量，再查看候选。', 'Check processed count, evidence coverage, and data quality before reviewing candidates.'),
      step('.market-section-head--results', '候选排名', 'Candidate ranking', '展开标的查看因子、风险、新闻与 AI 质询。', 'Open a symbol to inspect factors, risk, news, and AI challenge.'),
    ],
  },
  {
    key: 'symbol', titleZh: '标的分析', titleEn: 'Symbol analysis',
    summaryZh: '检查价格结构、技术指标、关键价位和公司信息。', summaryEn: 'Inspect price structure, indicators, key levels, and company context.',
    match: (path) => starts(path, '/market/symbol') || starts(path, '/market/stock'),
    steps: [
      step('.sa-symbol-header', '标的概览', 'Symbol overview', '先确认价格、交易状态和数据更新时间。', 'Confirm price, trading state, and data freshness first.'),
      step('.sa-price-panel .sa-panel-heading', '价格与成交', 'Price and volume', '结合时间窗口查看趋势、波动和成交变化。', 'Use the time range to inspect trend, volatility, and volume changes.'),
      step('.sa-indicator-grid .sa-panel-heading', '技术证据', 'Technical evidence', '指标用于确认或否定交易假设，不应单独作为下单依据。', 'Indicators confirm or reject a thesis; they should not be the sole order trigger.'),
      step('.sa-levels .sa-panel-heading', '关键价位', 'Key levels', '支撑、阻力和参考区间会进入后续入场计划。', 'Support, resistance, and reference zones feed later entry planning.'),
    ],
  },
  {
    key: 'watchlist', titleZh: '自选监控', titleEn: 'Watchlist',
    summaryZh: '集中监控关注标的、价格变化和研究状态。', summaryEn: 'Monitor watched symbols, price changes, and research state.',
    match: (path) => path === '/watchlist',
    steps: [
      step('.wl-page-heading', '自选列表', 'Watchlist', '这里显示关注标的数量、数据状态和最后更新时间。', 'This shows watched symbols, data state, and freshness.'),
      step('.wl-command-panel__head', '添加与管理', 'Add and manage', '搜索代码添加标的，也可以刷新或清理列表。', 'Search symbols to add them, or refresh and clean the list.'),
      step('#watchlist-table-title', '监控表', 'Monitoring table', '比较价格、成交、信号与风险，再决定是否送入研究。', 'Compare price, volume, signals, and risk before sending a name to research.'),
    ],
  },
  {
    key: 'research-pipeline', titleZh: 'AI 研究管线', titleEn: 'AI research pipeline',
    summaryZh: '先设定风险、周期和 AI 权限，再运行逐层收窄的研究流程。', summaryEn: 'Set risk, horizon, and AI authority before running the research funnel.',
    match: (path) => path === '/agent',
    steps: [
      step('.agent-mandate-header', '交易策略', 'Trading mandate', '风险偏好、持有周期和 AI 权限共同决定仓位与研究门槛。', 'Risk, holding horizon, and AI authority jointly determine sizing and research gates.'),
      step('.agent-mandate-control-grid', '三项核心设置', 'Three core controls', '修改后会应用到手动扫描、自动流程、入场和退出规则。', 'Changes apply to manual scans, automation, entries, and exits.'),
      step('.agent-pipeline-heading-actions', '自动研究流程', 'Automated research', '自动流程依次运行 Scanner、Fine Scan、DV、入场和持仓保护。', 'Automation runs Scanner, Fine Scan, DV, entry planning, and position protection in order.'),
      step('#research-pipeline', '研究阶段', 'Research stages', '逐阶段展开查看证据、决策、拦截原因和下一步。', 'Expand each stage to review evidence, decisions, blocks, and next actions.'),
    ],
  },
  {
    key: 'research-candidates', titleZh: '研究候选池', titleEn: 'Research candidates',
    summaryZh: '比较扫描后的候选、因子覆盖和 AI 结论。', summaryEn: 'Compare scanned candidates, factor coverage, and AI review.',
    match: (path) => path === '/agent/candidates',
    steps: [
      step('.rw-hero-actions', '候选快照', 'Candidate snapshot', '刷新或返回研究管线，确认当前候选来自哪次运行。', 'Refresh or return to the pipeline and confirm which run produced this snapshot.'),
      step('.rw-filter-band', '候选筛选', 'Candidate filters', '按优先级、决策和数据状态缩小范围。', 'Filter by priority, decision, and data state.'),
      step('.rw-table-section .rw-section-heading', '证据账本', 'Evidence ledger', '比较因子、流动性、事件风险和 AI 意见。', 'Compare factors, liquidity, event risk, and AI review.'),
    ],
  },
  {
    key: 'research-review', titleZh: '审核队列', titleEn: 'Review queue',
    summaryZh: '集中处理需要人工确认、数据补全或风险复核的候选。', summaryEn: 'Handle candidates requiring human confirmation, missing evidence, or risk review.',
    match: (path) => path === '/agent/review',
    steps: [
      step('.rw-review .rw-hero-actions', '审核快照', 'Review snapshot', '确认队列更新时间以及研究管线是否仍在运行。', 'Confirm queue freshness and whether the pipeline is still running.'),
      step('.rw-review-analysis .rw-panel-heading', '决策漏斗', 'Decision funnel', '查看候选如何在各阶段被继续、观察或拦截。', 'See how candidates advance, remain on watch, or are blocked.'),
      step('.rw-review .rw-section-heading--queue', '待审核项目', 'Items to review', '打开项目查看缺失证据和具体复核原因。', 'Open an item to inspect missing evidence and the exact review reason.'),
    ],
  },
  {
    key: 'backtest-detail', titleZh: '回测报告', titleEn: 'Backtest report',
    summaryZh: '检查回测结果、曲线、参数和交易样本。', summaryEn: 'Inspect results, curves, parameters, and the underlying trade sample.',
    match: (path) => path.startsWith('/backtest/'),
    steps: [
      step('.bt-detail-hero', '报告范围', 'Report scope', '先确认标的、策略、运行状态和生成时间。', 'Confirm symbols, strategy, run status, and creation time first.'),
      step('.bt-detail-performance', '核心结果', 'Key results', '收益必须与回撤、交易数和成本一起解读。', 'Read return together with drawdown, trade count, and costs.'),
      step('.bt-detail-report .ant-tabs-nav', '证据分页', 'Evidence tabs', '切换查看曲线、参数和交易记录，检查结果是否可解释。', 'Review curves, parameters, and trades to confirm the result is explainable.'),
    ],
  },
  {
    key: 'backtest', titleZh: '策略回测', titleEn: 'Strategy backtest',
    summaryZh: '用历史数据检验规则、成本、回撤和样本外稳定性。', summaryEn: 'Test rules, costs, drawdown, and out-of-sample stability on historical data.',
    match: (path) => path === '/backtest',
    steps: [
      step('.bt-primary-fields', '标的与策略', 'Symbol and strategy', '输入股票或组合，并选择要验证的策略模型。', 'Enter a symbol or portfolio and choose the strategy model to validate.'),
      step('.execution-inner-panel .bt-execution-heading', '策略参数', 'Strategy parameters', '参数会改变信号频率和风险，应避免只追求最高历史收益。', 'Parameters alter signal frequency and risk; avoid optimizing only for peak historical return.'),
      step('.bt-simulation-fields', '样本区间与资金', 'Window and capital', '设置历史区间和初始资金，确保样本覆盖不同市场环境。', 'Set the historical window and capital, covering multiple market regimes.'),
      step('.bt-form-actions', '运行与保存', 'Run and save', '运行后重点检查回撤、交易数、成本和样本外表现。', 'After running, focus on drawdown, trade count, costs, and out-of-sample behavior.'),
    ],
  },
  {
    key: 'optimization', titleZh: '参数优化', titleEn: 'Parameter optimization',
    summaryZh: '在受控范围内寻找稳定参数，而不是寻找单一最高收益点。', summaryEn: 'Search for stable parameter regions, not one maximum-return point.',
    match: (path) => path === '/optimize',
    steps: [
      step('.op-hero', '优化任务', 'Optimization study', '先确认标的、策略和优化目标。', 'Confirm symbol, strategy, and optimization objective.'),
      step('.op-config-grid', '参数范围', 'Parameter ranges', '使用合理区间和步长，过宽会增加过拟合风险。', 'Use defensible ranges and increments; overly broad searches increase overfitting risk.'),
      step('.op-progress-panel__top', '运行进度', 'Run progress', '优化可能需要较长时间；完成后查看稳定区域和样本外结果。', 'Optimization may take time; inspect stable regions and out-of-sample results afterward.'),
    ],
  },
  {
    key: 'comparison', titleZh: '策略对比', titleEn: 'Strategy comparison',
    summaryZh: '在相同维度比较多个历史回测会话。', summaryEn: 'Compare multiple historical backtest sessions on consistent dimensions.',
    match: (path) => path === '/compare',
    steps: [
      step('.strategy-lab-hero', '对比工作台', 'Comparison workspace', '先选择至少两个可比的历史回测会话。', 'Select at least two comparable historical backtest sessions.'),
      step('.comparison-selector-card', '选择会话', 'Select sessions', '尽量使用相同标的、区间和资金假设，避免失真比较。', 'Prefer the same symbols, windows, and capital assumptions for a fair comparison.'),
    ],
  },
  {
    key: 'ranking', titleZh: '策略排名', titleEn: 'Strategy rankings',
    summaryZh: '根据风险调整后表现比较已验证策略。', summaryEn: 'Compare validated strategies using risk-adjusted performance.',
    match: (path) => path === '/ranking',
    steps: [
      step('.strategy-ranking-hero', '排名说明', 'Ranking methodology', '排名综合考虑收益、波动、回撤和稳定性，不只是收益率。', 'Rankings combine return, volatility, drawdown, and stability rather than return alone.'),
      step('.strategy-ranking-chart-grid', '策略分布', 'Strategy distribution', '查看领先策略在风险和收益维度上的位置。', 'Review where leading strategies sit across risk and return dimensions.'),
    ],
  },
  {
    key: 'trade', titleZh: '交易台', titleEn: 'Trade desk',
    summaryZh: '审核候选、账户资金、订单和成交状态。', summaryEn: 'Review candidates, account capital, orders, and fills.',
    match: (path) => path === '/trade',
    steps: [
      step('.trade-editorial__hero-actions', '交易环境与刷新', 'Environment and refresh', '先确认模拟盘或实盘，以及数据是否为最新。', 'Confirm Paper or Live mode and data freshness first.'),
      step('.trade-panel-heading__identity', '执行候选', 'Execution candidates', '这里只显示通过研究并进入执行监控的候选。', 'Only candidates admitted through research appear for execution monitoring.'),
      step('.trade-section-heading', '账户资金', 'Account capital', '买入数量受购买力、风险预算和持仓上限共同限制。', 'Buying power, risk budget, and position limits jointly constrain sizing.'),
      step('.trade-editorial__table-panel .trade-table-heading', '订单与持仓', 'Orders and positions', '检查订单状态、成交价格和退出保护是否已经建立。', 'Check order status, fill price, and whether exit protection is active.'),
    ],
  },
  {
    key: 'portfolio', titleZh: '持仓组合', titleEn: 'Portfolio',
    summaryZh: '监控敞口、集中度、盈亏和每个持仓的退出保护。', summaryEn: 'Monitor exposure, concentration, P/L, and exit protection for every position.',
    match: (path) => path === '/portfolio',
    steps: [
      step('.portfolio-editorial__hero-actions', '持仓刷新', 'Portfolio refresh', '确认交易环境并刷新账户与持仓数据。', 'Confirm trading mode and refresh account and position data.'),
      step('.portfolio-section-heading', '组合指标', 'Portfolio metrics', '检查总敞口、现金、当日盈亏和集中度。', 'Review gross exposure, cash, daily P/L, and concentration.'),
      step('.portfolio-editorial__holdings > .ant-card-head', '持仓明细', 'Holdings', '逐项检查数量、成本、收益和保护状态。', 'Inspect quantity, cost, return, and protection state for each holding.'),
    ],
  },
];

const guideForPath = (path: string) => PAGE_GUIDES.find((guide) => guide.match(path));

const PageGuide: React.FC<PageGuideProps> = ({ language, userId, openSignal }) => {
  const location = useLocation();
  const isZh = language === 'zh-CN';
  const guide = React.useMemo(() => guideForPath(location.pathname), [location.pathname]);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const revealSequence = React.useRef(0);

  const storageKey = React.useMemo(() => (
    guide ? `alphalab:page-guide:v1:${userId || 'local'}:${guide.key}` : ''
  ), [guide, userId]);

  const saveState = React.useCallback((value: 'dismissed' | 'completed') => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, value); } catch { /* optional local preference */ }
  }, [storageKey]);

  React.useEffect(() => {
    revealSequence.current += 1;
    setTourOpen(false);
    setPromptOpen(false);
    setCurrent(0);
    if (!guide || !storageKey) return undefined;
    let seen = '';
    try { seen = localStorage.getItem(storageKey) || ''; } catch { /* optional local preference */ }
    if (seen) return undefined;
    const timer = window.setTimeout(() => setPromptOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [guide, storageKey]);

  const showStep = React.useCallback((index: number) => {
    if (!guide) return;
    const bounded = Math.max(0, Math.min(index, guide.steps.length - 1));
    const selector = guide.steps[bounded]?.selector;
    const sequence = ++revealSequence.current;
    let attempts = 0;
    const reveal = () => {
      if (sequence !== revealSequence.current) return;
      const target = document.querySelector(selector) as HTMLElement | null;
      attempts += 1;
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          if (sequence !== revealSequence.current || !document.contains(target)) return;
          setCurrent(bounded);
          setTourOpen(true);
        }, 140);
        return;
      }
      if (attempts < 50) window.setTimeout(reveal, 50);
      else {
        setCurrent(bounded);
        setTourOpen(true);
      }
    };
    setTourOpen(false);
    reveal();
  }, [guide]);

  const startGuide = React.useCallback(() => {
    setPromptOpen(false);
    showStep(0);
  }, [showStep]);

  React.useEffect(() => {
    if (openSignal > 0 && guide) startGuide();
  }, [guide, openSignal, startGuide]);

  if (!guide) return null;

  const steps: TourProps['steps'] = guide.steps.map((item, index) => ({
    title: isZh ? item.titleZh : item.titleEn,
    description: (
      <div className="page-guide-tour__copy">
        <span>{String(index + 1).padStart(2, '0')} / {guide.steps.length}</span>
        <p>{isZh ? item.bodyZh : item.bodyEn}</p>
      </div>
    ),
    target: () => document.querySelector(item.selector) as HTMLElement,
    nextButtonProps: { children: index === guide.steps.length - 1 ? (isZh ? '完成' : 'Finish') : (isZh ? '下一步' : 'Next') },
    prevButtonProps: { children: isZh ? '上一步' : 'Back' },
  }));

  return (
    <>
      {promptOpen && (
        <aside className="page-guide-prompt" role="dialog" aria-label={isZh ? guide.titleZh : guide.titleEn}>
          <span className="page-guide-prompt__icon"><CompassOutlined /></span>
          <div>
            <small>{isZh ? '首次进入 · 页面指南' : 'FIRST VISIT · PAGE GUIDE'}</small>
            <strong>{isZh ? guide.titleZh : guide.titleEn}</strong>
            <p>{isZh ? guide.summaryZh : guide.summaryEn}</p>
            <div>
              <Button size="small" onClick={() => { setPromptOpen(false); saveState('dismissed'); }}>{isZh ? '暂不查看' : 'Not now'}</Button>
              <Button size="small" type="primary" icon={<QuestionCircleOutlined />} onClick={startGuide}>{isZh ? '开始指南' : 'Start guide'}</Button>
            </div>
          </div>
        </aside>
      )}
      <Tour
        open={tourOpen}
        current={current}
        steps={steps}
        onChange={(next) => showStep(next)}
        onClose={() => { revealSequence.current += 1; setTourOpen(false); saveState('dismissed'); }}
        onFinish={() => { revealSequence.current += 1; setTourOpen(false); saveState('completed'); }}
        mask={{ color: 'rgba(7, 18, 13, 0.68)' }}
        type="primary"
        zIndex={1310}
        rootClassName="page-guide-tour"
      />
    </>
  );
};

export default PageGuide;
