import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { PublicTabList, publicTabIds, scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

type ResearchView = 'hypothesis' | 'validation' | 'limits';

const Features: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const researchRef = useRef<HTMLElement>(null);
  const [activeView, setActiveView] = useState<ResearchView>('hypothesis');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const views = useMemo(() => ({
    hypothesis: {
      label: isZh ? '研究假设' : 'Hypothesis',
      heading: isZh ? '波动收缩后的动量延续' : 'Momentum continuation after volatility contraction',
      note: isZh ? '当流动性、相对强度和趋势结构同时通过门槛时，测试突破后的持续性。' : 'Test post-breakout persistence only when liquidity, relative strength, and trend structure pass together.',
      line: [34, 32, 31, 33, 34, 35, 36, 43, 49, 54, 58, 65],
      stats: [[isZh ? '标的池' : 'UNIVERSE', isZh ? '美股' : 'US EQUITIES'], [isZh ? '研究周期' : 'HORIZON', isZh ? '20 至 60 天' : '20–60 DAYS'], [isZh ? '基准' : 'BENCHMARK', 'SPY']],
    },
    validation: {
      label: isZh ? '验证方法' : 'Validation',
      heading: isZh ? '滚动窗口，而不是一次漂亮回测' : 'Walk-forward windows, not one attractive backtest',
      note: isZh ? '五个独立样本外窗口同时计算成本、回撤、基准超额和参数敏感度。' : 'Five independent out-of-sample windows include costs, drawdown, benchmark excess return, and parameter sensitivity.',
      line: [21, 27, 30, 28, 36, 43, 45, 52, 49, 61, 65, 71],
      stats: [[isZh ? '样本外窗口' : 'OOS FOLDS', '5 / 5'], [isZh ? '成本模型' : 'COST MODEL', '12 BPS'], [isZh ? '最大回撤' : 'MAX DD', '-4.1%']],
    },
    limits: {
      label: isZh ? '限制与反证' : 'Limits',
      heading: isZh ? '记录策略不成立的地方' : 'Record where the idea does not hold',
      note: isZh ? '高波动财报窗口、低流动性尾部与参数漂移会明确标记，而不是从结果中删除。' : 'High-volatility earnings windows, illiquid tails, and parameter drift are marked explicitly rather than removed from results.',
      line: [66, 61, 58, 60, 53, 48, 50, 44, 39, 42, 35, 31],
      stats: [[isZh ? '未通过门槛' : 'FAILED GATES', '7'], [isZh ? '排除项' : 'EXCLUDED', isZh ? '已披露' : 'DISCLOSED'], [isZh ? '状态' : 'STATUS', isZh ? '待复核' : 'REVIEW']],
    },
  }), [isZh]);
  const active = views[activeView];
  const researchPanelIds = publicTabIds('research-ledger', activeView);
  const withoutLeadingIndex = (title: string) => title.replace(/^\d+\.\s*/, '');

  const methods = [
    [withoutLeadingIndex(t.features.group1Title), t.features.group1Desc, isZh ? '价格 · 流动性 · 结构' : 'PRICE · LIQUIDITY · STRUCTURE'],
    [withoutLeadingIndex(t.features.group2Title), t.features.group2Desc, isZh ? '上下文 · 反证 · 引用' : 'CONTEXT · COUNTEREVIDENCE · SOURCES'],
    [withoutLeadingIndex(t.features.group3Title), t.features.group3Desc, isZh ? 'OOS · 成本 · 回撤' : 'OOS · COSTS · DRAWDOWN'],
    [withoutLeadingIndex(t.features.group4Title), t.features.group4Desc, isZh ? '边界 · 仓位 · 审批' : 'BOUNDS · SIZING · APPROVAL'],
    [withoutLeadingIndex(t.features.group5Title), t.features.group5Desc, isZh ? '模拟 · 监控 · 复盘' : 'PAPER · MONITOR · REVIEW'],
    [isZh ? '可复现研究' : 'Reproducible research', isZh ? '数据版本、参数、运行时间、规则与淘汰原因随每份结果保留。' : 'Data version, parameters, runtime, rules, and rejection reasons remain attached to every result.', isZh ? '版本 · 参数 · 日志' : 'VERSION · PARAMETERS · LOGS'],
  ];

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-research-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero
          index="02"
          eyebrow={isZh ? '研究，不是推荐' : 'RESEARCH, NOT RECOMMENDATIONS'}
          title={isZh ? '让每个结论都经得起追问。' : 'Make every result answerable.'}
          subtitle={t.features.heroSubtitle}
          primaryLabel={t.features.getStarted}
          secondaryLabel={isZh ? '查看研究样本' : 'Inspect a research sample'}
          onSecondary={() => scrollPublicTarget(researchRef.current)}
        >
          <div className="public-instrument">
            <div className="public-instrument-header"><strong>{isZh ? '研究记录 / 动量-042' : 'RESEARCH NOTE / MOMENTUM-042'}</strong><span>{isZh ? '可复现样本' : 'REPRODUCIBLE SAMPLE'}</span></div>
            <div className="public-instrument-body">
              <MiniSparkline values={[22, 25, 24, 31, 34, 39, 42, 40, 49, 53, 61, 66]} label={isZh ? '研究样本净值' : 'Research sample equity'} />
            </div>
            <MetricStrip metrics={[
              { label: isZh ? '样本外窗口' : 'OOS folds', value: '5 / 5', tone: 'blue' },
              { label: isZh ? '夏普' : 'Sharpe', value: '2.45' },
              { label: isZh ? '最大回撤' : 'Max DD', value: '-4.1%', tone: 'copper' },
              { label: isZh ? '稳定性' : 'Stability', value: '0.82', tone: 'moss' },
            ]} />
          </div>
        </PublicHero>

        <section className="public-section research-ledger-section" ref={researchRef}>
          <SectionHeading eyebrow={isZh ? '研究账本' : 'THE RESEARCH LEDGER'} title={isZh ? '假设、验证和局限放在同一个页面。' : 'Hypothesis, validation, and limitations on one page.'} description={isZh ? '点击三个视图，查看一个公开研究样本如何保留方法与反证。所有数据均为演示用模拟结果。' : 'Use the three views to inspect how a public research sample keeps its method and counterevidence attached. All figures are illustrative simulated results.'} />
          <div className="research-ledger-frame">
            <PublicTabList
              id="research-ledger"
              items={(Object.keys(views) as ResearchView[]).map(id => ({ id, label: views[id].label }))}
              activeId={activeView}
              onChange={id => setActiveView(id as ResearchView)}
              ariaLabel={isZh ? '研究样本视图' : 'Research sample views'}
              className="research-ledger-tabs"
              orientation="vertical"
            />
          <div key={activeView} className="public-data-grid research-ledger-panel public-panel-swap" role="tabpanel" id={researchPanelIds.panelId} aria-labelledby={researchPanelIds.tabId}>
            <div className="public-data-main">
              <div className="public-instrument-header" style={{ padding: '0 0 22px', borderBottom: 0 }}><strong>{active.heading}</strong><span>{isZh ? '模拟研究样本' : 'SIMULATED RESEARCH SAMPLE'}</span></div>
              <MiniSparkline values={active.line} color={activeView === 'limits' ? 'copper' : 'blue'} bands={activeView === 'validation' ? 5 : 0} showNodes={activeView === 'limits'} label={active.heading} />
              <p style={{ margin: '24px 0 0', color: '#626760', lineHeight: 1.65 }}>{active.note}</p>
            </div>
            <aside className="public-data-aside"><p>{active.label}</p><strong>{activeView === 'validation' ? '5 / 5' : activeView === 'limits' ? (isZh ? '7 项标记' : '7 flags') : (isZh ? '20 至 60 天' : '20–60D')}</strong><dl>{active.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></aside>
          </div>
          </div>
        </section>

        <section className="public-section is-dark public-topic-section public-method-boundaries">
          <SectionHeading eyebrow={isZh ? '方法边界' : 'METHOD BOUNDARIES'} title={isZh ? 'AI 增加审查层，不替代验证。' : 'AI adds a review layer.\nIt does not replace validation.'} description={isZh ? '确定性门槛先筛选数据与结构，模型只审查上下文和反证；最终结果仍需样本外测试、成本模型和人工审批。' : 'Deterministic gates screen data and structure first. Models review context and counterevidence; out-of-sample tests, cost models, and human approval remain required.'} />
          <div className="public-card-grid">
            {methods.map(([title, desc, artifact], index) => (
              <article className="public-card" key={title} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.13)' }}>
                <div className="public-card-index" aria-label={`${isZh ? '方法' : 'Method'} ${index + 1}, ${artifact}`}>
                  <span>0{index + 1}</span>
                  <i aria-hidden="true" />
                  <b>{artifact}</b>
                </div>
                <h3 style={{ color: '#f5f1e8' }}>{title}</h3>
                <p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section research-question-ledger">
          <SectionHeading eyebrow={isZh ? '每份研究应回答' : 'EVERY NOTE SHOULD ANSWER'} title={isZh ? '收益数字需要一套可信的解释。' : 'A return figure needs a reason to trust it.'} />
          <div className="public-feature-list">
            {[
              [isZh ? '数据来自哪里？' : 'Where did the data come from?', isZh ? '数据源、时间范围、复权方式、缺失值与版本号。' : 'Source, date range, adjustments, missing-data handling, and version.'],
              [isZh ? '测试如何隔离？' : 'How was the test isolated?', isZh ? '训练区间、样本外窗口、基准、成本和滑点假设。' : 'Training range, out-of-sample windows, benchmark, costs, and slippage assumptions.'],
              [isZh ? '哪些条件会失败？' : 'What would falsify it?', isZh ? '失败门槛、漂移、拥挤、低流动性和事件风险。' : 'Failed gates, drift, crowding, illiquidity, and event risk.'],
              [isZh ? '谁做最后决定？' : 'Who makes the final decision?', isZh ? '系统生成边界清晰的模拟计划，用户保留审批权。' : 'The system generates a bounded paper plan; the user retains approval.'],
            ].map(([title, desc], index) => <article className="public-feature-row" key={title}><span>0{index + 1}</span><div className="public-feature-copy"><h3>{title}</h3><p>{desc}</p></div><b>{isZh ? '必须披露' : 'REQUIRED'}</b></article>)}
          </div>
        </section>

        <PublicCta eyebrow={t.features.disclaimer} title={t.features.readyTitle} description={t.features.readyDesc} primary={t.features.getStarted} secondary={isZh ? '浏览研究案例' : 'Browse examples'} secondaryPath="/examples" />
      </main>
    </MarketingLayout>
  );
};

export default Features;
