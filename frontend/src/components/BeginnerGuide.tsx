import React from 'react';
import { Button, Modal, Progress, Tour } from 'antd';
import type { TourProps } from 'antd';
import {
  ApiOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  ExperimentOutlined,
  FundOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import './BeginnerGuide.css';

type GuideModule = 'connections' | 'markets' | 'research' | 'strategies' | 'trading';

interface BeginnerGuideProps {
  language: 'zh-CN' | 'en-US';
  userId?: string;
  openSignal: number;
}

interface GuideStepDefinition {
  id: string;
  module: GuideModule;
  path: string;
  selector?: string;
  titleEn: string;
  titleZh: string;
  bodyEn: React.ReactNode;
  bodyZh: React.ReactNode;
}

interface PersistedGuideState {
  welcomed: boolean;
  completed: boolean;
  current: number;
  visited: string[];
}

const GUIDE_VERSION = 'v1';

const guideSteps: GuideStepDefinition[] = [
  {
    id: 'alpaca-paper',
    module: 'connections',
    path: '/settings/configuration#paper',
    selector: '[data-tour="config-paper"] .config-card-header',
    titleEn: '1. Connect Alpaca Paper first',
    titleZh: '1. 先连接 Alpaca 模拟盘',
    bodyEn: <><p>Enter the paper API key and secret, save them, then run the connection test.</p><small>Start in Paper mode. A successful test confirms account access without putting real capital at risk.</small></>,
    bodyZh: <><p>填写模拟盘 API Key 和 Secret，先保存，再点击“测试连接”。</p><small>新手应从模拟盘开始；测试成功只代表账户连接正常，不会动用真实资金。</small></>,
  },
  {
    id: 'finnhub',
    module: 'connections',
    path: '/settings/configuration#finnhub',
    selector: '[data-tour="config-finnhub"] .config-card-header',
    titleEn: '2. Add fundamentals and events',
    titleZh: '2. 补充基本面与事件数据',
    bodyEn: <><p>Add a Finnhub key for company profiles, fundamentals, earnings, and event context.</p><small>The research pipeline can still use Alpaca market data when this optional source is unavailable, but evidence coverage will be lower.</small></>,
    bodyZh: <><p>填写 Finnhub API Key，用于公司资料、基本面、财报日期和事件信息。</p><small>它是增强数据源；未配置时仍可使用 Alpaca 行情，但研究证据覆盖率会下降。</small></>,
  },
  {
    id: 'ai-provider',
    module: 'connections',
    path: '/settings/configuration#ai-provider',
    selector: '[data-tour="config-ai"] .config-card-header',
    titleEn: '3. Connect the AI reviewer',
    titleZh: '3. 连接 AI 审核服务',
    bodyEn: <><p>Select a supported provider, save its key and model, then test the connection.</p><small>AI challenges conflicts and explains decisions. Deterministic scores and hard risk gates remain authoritative.</small></>,
    bodyZh: <><p>选择支持的 AI 提供商，保存 API Key 与模型，然后测试连接。</p><small>AI 用来质疑冲突、解释结论；确定性评分和硬风控仍拥有最终决定权。</small></>,
  },
  {
    id: 'overview',
    module: 'markets',
    path: '/dashboard',
    selector: '[data-tour="nav-overview"]',
    titleEn: '4. Begin each session in Overview',
    titleZh: '4. 每次从总览开始',
    bodyEn: <><p>Review account state, market conditions, recent activity, and system health before starting research.</p><small>Use this as the operational check-in, not as a buy signal.</small></>,
    bodyZh: <><p>先检查账户状态、市场环境、最近活动和系统健康，再开始研究。</p><small>总览是每日检查入口，不代表买入信号。</small></>,
  },
  {
    id: 'markets',
    module: 'markets',
    path: '/market',
    selector: '[data-tour="nav-markets"]',
    titleEn: '5. Explore the market workspace',
    titleZh: '5. 使用市场工作区',
    bodyEn: <><p>Use Market Scanner to rank the universe, open a symbol for evidence, and place names on the Watchlist.</p><small>Scanner rank is research priority. It is not an order instruction.</small></>,
    bodyZh: <><p>用 Market Scanner 排名股票池，打开标的查看证据，并把关注对象加入自选监控。</p><small>扫描排名表示研究优先级，不是直接下单指令。</small></>,
  },
  {
    id: 'research',
    module: 'research',
    path: '/agent',
    selector: '[data-tour="nav-research"]',
    titleEn: '6. Run the research pipeline',
    titleZh: '6. 运行研究管线',
    bodyEn: <><p>Choose risk, holding horizon, and AI authority before running Scanner, Fine Scan, and Deeper Validation.</p><small>Keep Paper mode on while learning. Read every stage as a narrowing funnel from ideas to executable plans.</small></>,
    bodyZh: <><p>运行前先选择风险偏好、持有周期和 AI 权限，再依次查看 Scanner、Fine Scan 与 Deeper Validation。</p><small>学习阶段保持模拟模式；把每一阶段理解为从候选到可执行计划的逐层收窄。</small></>,
  },
  {
    id: 'strategies',
    module: 'strategies',
    path: '/backtest',
    selector: '[data-tour="nav-strategies"]',
    titleEn: '7. Validate strategies before trust',
    titleZh: '7. 先验证策略，再建立信任',
    bodyEn: <><p>Backtest a strategy, inspect drawdown and sample size, then compare or optimize parameters.</p><small>A high return alone is not enough. Prefer stable out-of-sample behavior and realistic costs.</small></>,
    bodyZh: <><p>先回测策略，检查回撤和样本量，再进行策略对比或参数优化。</p><small>高收益本身不够；优先关注样本外稳定性和真实交易成本。</small></>,
  },
  {
    id: 'trading',
    module: 'trading',
    path: '/trade',
    selector: '[data-tour="nav-trade"]',
    titleEn: '8. Review orders and positions',
    titleZh: '8. 审核订单与持仓',
    bodyEn: <><p>Use Trade for order review and Portfolio for exposure, performance, and position protection.</p><small>Entry plans use limit orders. Exit protection and account risk gates remain active after entry.</small></>,
    bodyZh: <><p>在交易台审核订单，在持仓组合查看敞口、盈亏和持仓保护。</p><small>入场计划使用限价单；成交后退出保护与账户风控仍会继续运行。</small></>,
  },
  {
    id: 'environment',
    module: 'trading',
    path: '/trade',
    selector: '[data-tour="trade-environment"]',
    titleEn: '9. Paper and Live are separate authorities',
    titleZh: '9. 模拟盘与实盘是两套权限',
    bodyEn: <><p>Stay in Paper while learning. Switching to Live changes the broker account but does not submit an order by itself.</p><small>Unattended live execution also requires Full AI, Live Orders authorization, and every hard gate to pass.</small></>,
    bodyZh: <><p>学习阶段保持模拟盘。切换到实盘只会改变券商环境，本身不会立即下单。</p><small>无人值守实盘还必须同时开启全 AI、Live Orders 授权，并通过全部硬风控。</small></>,
  },
  {
    id: 'complete',
    module: 'trading',
    path: '/dashboard',
    titleEn: 'Your workspace is ready',
    titleZh: '你的工作区已经准备好了',
    bodyEn: <><p>Start with Paper, complete one research cycle, review its entry and exit plans, then evaluate results before enabling Live.</p><small>You can reopen this guide from the question-mark button in the top bar.</small></>,
    bodyZh: <><p>先在模拟盘完成一轮研究，检查入场与退出计划，再根据结果决定是否启用实盘。</p><small>以后可以随时从顶部问号按钮重新打开教程。</small></>,
  },
];

const moduleStart: Record<GuideModule, number> = {
  connections: 0,
  markets: 3,
  research: 5,
  strategies: 6,
  trading: 7,
};

const moduleStepIds: Record<GuideModule, string[]> = {
  connections: ['alpaca-paper', 'finnhub', 'ai-provider'],
  markets: ['overview', 'markets'],
  research: ['research'],
  strategies: ['strategies'],
  trading: ['trading', 'environment', 'complete'],
};

const defaultState: PersistedGuideState = {
  welcomed: false,
  completed: false,
  current: 0,
  visited: [],
};

const readState = (key: string): PersistedGuideState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? { ...defaultState, ...parsed } : defaultState;
  } catch {
    return defaultState;
  }
};

const BeginnerGuide: React.FC<BeginnerGuideProps> = ({ language, userId, openSignal }) => {
  const isZh = language === 'zh-CN';
  const navigate = useNavigate();
  const location = useLocation();
  const storageKey = React.useMemo(() => `alphalab:beginner-guide:${GUIDE_VERSION}:${userId || 'local'}`, [userId]);
  const [state, setState] = React.useState<PersistedGuideState>(() => readState(storageKey));
  const [welcomeOpen, setWelcomeOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [current, setCurrent] = React.useState(state.current || 0);
  const revealSequence = React.useRef(0);

  const persist = React.useCallback((next: PersistedGuideState) => {
    setState(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* local progress is optional */ }
  }, [storageKey]);

  React.useEffect(() => {
    const saved = readState(storageKey);
    setState(saved);
    setCurrent(saved.current || 0);
    if (!saved.welcomed) {
      const timer = window.setTimeout(() => setWelcomeOpen(true), 650);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [storageKey]);

  React.useEffect(() => {
    if (openSignal > 0) setWelcomeOpen(true);
  }, [openSignal]);

  const visited = React.useMemo(() => new Set(state.visited), [state.visited]);
  const moduleDone = React.useCallback((module: GuideModule) => (
    moduleStepIds[module].every((id) => visited.has(id))
  ), [visited]);
  const completedModules = (Object.keys(moduleStepIds) as GuideModule[]).filter(moduleDone).length;

  const showTourWhenReady = React.useCallback((index: number) => {
    const selector = guideSteps[index]?.selector;
    const sequence = ++revealSequence.current;
    let attempts = 0;
    const reveal = () => {
      if (sequence !== revealSequence.current) return;
      attempts += 1;
      const target = selector ? document.querySelector(selector) as HTMLElement | null : null;
      if (!selector) {
        setCurrent(index);
        setTourOpen(true);
        return;
      }
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
        window.setTimeout(() => {
          if (sequence !== revealSequence.current || !document.contains(target)) return;
          setCurrent(index);
          setTourOpen(true);
        }, 140);
        return;
      }
      if (attempts >= 60) {
        // Keep the guide usable if a feature is unavailable for this account,
        // but do not leave a stale spotlight attached to the previous page.
        setCurrent(index);
        setTourOpen(true);
        return;
      }
      window.setTimeout(reveal, 50);
    };
    reveal();
  }, []);

  const markVisited = React.useCallback((index: number, completed = false) => {
    const id = guideSteps[index]?.id;
    const nextVisited = id && !visited.has(id) ? [...state.visited, id] : state.visited;
    persist({
      welcomed: true,
      completed: completed || state.completed,
      current: completed ? 0 : index,
      visited: completed ? guideSteps.map((step) => step.id) : nextVisited,
    });
  }, [persist, state.completed, state.visited, visited]);

  const openAt = React.useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(index, guideSteps.length - 1));
    const targetStep = guideSteps[bounded];
    setWelcomeOpen(false);
    setTourOpen(false);
    persist({ ...state, welcomed: true, current: bounded });
    if (`${location.pathname}${location.hash}` !== targetStep.path) navigate(targetStep.path);
    window.setTimeout(() => showTourWhenReady(bounded), 120);
  }, [location.hash, location.pathname, navigate, persist, showTourWhenReady, state]);

  const restartTour = () => {
    const reset = { ...defaultState, welcomed: true };
    persist(reset);
    setCurrent(0);
    const firstStep = guideSteps[0];
    setWelcomeOpen(false);
    setTourOpen(false);
    if (`${location.pathname}${location.hash}` !== firstStep.path) navigate(firstStep.path);
    window.setTimeout(() => showTourWhenReady(0), 120);
  };

  const changeStep = (next: number) => {
    markVisited(current);
    const targetStep = guideSteps[next];
    persist({ ...state, welcomed: true, current: next, visited: Array.from(new Set([...state.visited, guideSteps[current].id])) });
    setTourOpen(false);
    if (targetStep && `${location.pathname}${location.hash}` !== targetStep.path) navigate(targetStep.path);
    window.setTimeout(() => showTourWhenReady(next), 120);
  };

  const finish = () => {
    revealSequence.current += 1;
    markVisited(current, true);
    setTourOpen(false);
    navigate('/dashboard');
    setWelcomeOpen(true);
  };

  const closeTour = () => {
    revealSequence.current += 1;
    markVisited(current);
    setTourOpen(false);
  };

  const copy = isZh ? {
    eyebrow: 'ALPHALAB / 快速开始',
    title: '从连接数据到完成第一轮研究',
    description: '这套交互教程会先带你配置必要服务，再依次认识市场、研究、策略和交易工作区。全程不会自动填写密钥或提交订单。',
    progress: '上手进度',
    start: state.completed ? '重新开始完整教程' : state.welcomed ? '继续教程' : '开始教程',
    later: '稍后再说',
    done: '已完成',
    pending: '待学习',
    modules: {
      connections: ['连接服务', 'Alpaca 模拟盘、Finnhub 与 AI'],
      markets: ['总览与市场', '检查环境、扫描股票与查看标的'],
      research: ['AI 研究管线', '设置风险、周期并运行筛选流程'],
      strategies: ['策略验证', '回测、比较与参数优化'],
      trading: ['交易与安全', '审核订单、持仓、退出和实盘权限'],
    } as Record<GuideModule, [string, string]>,
  } : {
    eyebrow: 'ALPHALAB / QUICK START',
    title: 'Connect your data and complete a first research cycle',
    description: 'This interactive guide starts with required services, then introduces Markets, Research, Strategies, and Trade. It never fills secrets or submits orders for you.',
    progress: 'Onboarding progress',
    start: state.completed ? 'Restart full guide' : state.welcomed ? 'Continue guide' : 'Start guide',
    later: 'Maybe later',
    done: 'Complete',
    pending: 'To learn',
    modules: {
      connections: ['Connect services', 'Alpaca Paper, Finnhub, and AI'],
      markets: ['Overview & Markets', 'Check conditions, scan stocks, inspect symbols'],
      research: ['AI research pipeline', 'Set mandate and run the research funnel'],
      strategies: ['Strategy validation', 'Backtest, compare, and optimize'],
      trading: ['Trade & safety', 'Review orders, positions, exits, and Live authority'],
    } as Record<GuideModule, [string, string]>,
  };

  const icons: Record<GuideModule, React.ReactNode> = {
    connections: <ApiOutlined />,
    markets: <BarChartOutlined />,
    research: <FundOutlined />,
    strategies: <ExperimentOutlined />,
    trading: <SafetyCertificateOutlined />,
  };

  const steps: TourProps['steps'] = guideSteps.map((step, index) => ({
    title: isZh ? step.titleZh : step.titleEn,
    description: (
      <div className="beginner-tour__copy">
        <span className="beginner-tour__counter">{String(index + 1).padStart(2, '0')} / {guideSteps.length}</span>
        {isZh ? step.bodyZh : step.bodyEn}
      </div>
    ),
    target: step.selector ? () => document.querySelector(step.selector!) as HTMLElement : undefined,
    nextButtonProps: { children: index === guideSteps.length - 1 ? (isZh ? '完成教程' : 'Finish') : (isZh ? '下一步' : 'Next') },
    prevButtonProps: { children: isZh ? '上一步' : 'Back' },
  }));

  return (
    <>
      <Modal
        open={welcomeOpen}
        onCancel={() => {
          setWelcomeOpen(false);
          persist({ ...state, welcomed: true });
        }}
        footer={null}
        width={720}
        centered
        className="beginner-guide-modal"
        destroyOnHidden
      >
        <div className="beginner-guide__hero">
          <span className="beginner-guide__mark"><RocketOutlined /></span>
          <div>
            <span className="beginner-guide__eyebrow">{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
        </div>

        <div className="beginner-guide__progress">
          <div><span>{copy.progress}</span><strong>{completedModules}/5</strong></div>
          <Progress percent={completedModules * 20} showInfo={false} strokeColor="#1f6f4a" trailColor="rgba(16, 40, 29, 0.1)" />
        </div>

        <div className="beginner-guide__modules">
          {(Object.keys(moduleStart) as GuideModule[]).map((module) => {
            const done = moduleDone(module);
            const [title, detail] = copy.modules[module];
            return (
              <button type="button" key={module} onClick={() => openAt(moduleStart[module])}>
                <span className="beginner-guide__module-icon">{done ? <CheckCircleFilled /> : icons[module]}</span>
                <span><strong>{title}</strong><small>{detail}</small></span>
                <em className={done ? 'is-done' : undefined}>{done ? copy.done : copy.pending}</em>
              </button>
            );
          })}
        </div>

        <div className="beginner-guide__actions">
          <Button onClick={() => {
            setWelcomeOpen(false);
            persist({ ...state, welcomed: true });
          }}>{copy.later}</Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => state.completed ? restartTour() : openAt(state.current || 0)}>{copy.start}</Button>
        </div>
      </Modal>

      <Tour
        open={tourOpen}
        current={current}
        steps={steps}
        onChange={changeStep}
        onFinish={finish}
        onClose={closeTour}
        mask={{ color: 'rgba(7, 18, 13, 0.68)' }}
        type="primary"
        zIndex={1300}
        rootClassName="beginner-tour"
      />
    </>
  );
};

export default BeginnerGuide;
