import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { PublicTabList, publicTabIds, scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

type ModuleId = 'scan' | 'validate' | 'backtest' | 'plan';

const Platform: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const modulesRef = useRef<HTMLElement>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('scan');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const modules = useMemo(() => ({
    scan: {
      label: isZh ? '市场扫描' : 'Market scan',
      eyebrow: isZh ? '候选池' : 'CANDIDATE UNIVERSE',
      value: '8,421 → 24',
      line: [22, 24, 21, 29, 32, 35, 38, 37, 45, 49, 56, 61],
      stats: [[isZh ? '流动性通过' : 'Liquidity pass', '409'], [isZh ? '结构通过' : 'Structure pass', '78'], [isZh ? '候选' : 'Candidates', '24']],
    },
    validate: {
      label: isZh ? '证据验证' : 'Evidence audit',
      eyebrow: isZh ? '验证报告' : 'VALIDATION REPORT',
      value: '3 / 24',
      line: [30, 35, 32, 40, 46, 43, 52, 58, 61, 67, 70, 74],
      stats: [[isZh ? '硬门槛' : 'Hard gates', '5 / 5'], [isZh ? '样本外' : 'Out-of-sample', isZh ? '通过' : 'PASS'], [isZh ? '稳定性' : 'Stability', '0.82']],
    },
    backtest: {
      label: isZh ? '滚动回测' : 'Walk-forward test',
      eyebrow: isZh ? '样本外净值' : 'OUT-OF-SAMPLE EQUITY',
      value: isZh ? '夏普 2.45' : '2.45 Sharpe',
      line: [19, 25, 31, 29, 39, 45, 50, 47, 58, 64, 61, 75],
      stats: [[isZh ? '滚动窗口' : 'Walk-forward', '5 / 5'], [isZh ? '最大回撤' : 'Max drawdown', '-4.1%'], [isZh ? '成本模型' : 'Cost model', isZh ? '已启用' : 'ON']],
    },
    plan: {
      label: isZh ? '风险计划' : 'Risk plan',
      eyebrow: isZh ? '模拟计划' : 'PAPER TRADE PLAN',
      value: isZh ? '限制已设置' : 'Limits set',
      line: [52, 48, 50, 44, 39, 41, 35, 30, 32, 27, 23, 20],
      stats: [[isZh ? '入场' : 'Entry', '$925.30'], [isZh ? '止损' : 'Stop', '$887.40'], [isZh ? '风险回报' : 'Reward / risk', '3.28']],
    },
  }), [isZh]);

  const active = modules[activeModule];
  const platformPanelIds = publicTabIds('platform-modules', activeModule);
  const capabilities = [
    [t.platform.scanTitle, t.platform.scanDesc, '8,421'],
    [t.platform.aiTitle, t.platform.aiDesc, '3 / 24'],
    [isZh ? '滚动样本外验证' : 'Walk-forward validation', isZh ? '成本、回撤、基准和参数稳定性在独立窗口中共同验证。' : 'Costs, drawdown, benchmark-relative return, and parameter stability are tested in independent windows.', '5 / 5'],
    [t.platform.planTitle, t.platform.planDesc, isZh ? '有边界' : 'BOUNDED'],
    [isZh ? '证据账本' : 'Evidence ledger', isZh ? '每个候选都保留数据版本、规则、模型审查和淘汰原因。' : 'Every candidate keeps its data version, rules, model review, and rejection reasons attached.', isZh ? '可审计' : 'AUDIT'],
    [isZh ? '模拟优先执行' : 'Paper-first execution', t.platform.hubPaper, isZh ? '模拟' : 'PAPER'],
  ];

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-platform-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero
          index="01"
          eyebrow={isZh ? '量化研究基础设施' : 'QUANT RESEARCH INFRASTRUCTURE'}
          title={t.platform.heroTitle}
          subtitle={t.platform.heroSubtitle}
          primaryLabel={t.platform.getStarted}
          secondaryLabel={isZh ? '查看工作台' : 'Inspect the workspace'}
          onSecondary={() => scrollPublicTarget(modulesRef.current)}
        >
          <div className="public-instrument">
            <div className="public-instrument-header"><strong>{isZh ? 'ALPHALAB / 研究运行 0842' : 'ALPHALAB / RESEARCH RUN 0842'}</strong><span>{isZh ? '样例 · 模拟模式' : 'SAMPLE · PAPER MODE'}</span></div>
            <div className="public-instrument-body">
              <MiniSparkline values={[100, 104, 108, 106, 114, 119, 117, 126, 132, 138, 135, 147, 153]} secondaryValues={[100, 102, 103, 105, 107, 109, 111, 114, 116, 119, 121, 124, 127]} secondaryLabel="SPY" baseline="first" label={isZh ? '样例滚动验证净值曲线，对比 SPY' : 'Sample walk-forward equity curve compared with SPY'} />
            </div>
            <MetricStrip metrics={[
              { label: isZh ? '已观察' : 'Observed', value: '8,421', tone: 'blue' },
              { label: isZh ? '已初筛' : 'Shortlisted', value: '24' },
              { label: isZh ? '已验证' : 'Validated', value: '3' },
              { label: isZh ? '风险计划' : 'Risk plan', value: '1', tone: 'moss' },
            ]} />
          </div>
        </PublicHero>

        <section className="public-section platform-module-stage" ref={modulesRef}>
          <SectionHeading eyebrow={isZh ? '可操作的产品界面' : 'AN OPERABLE PRODUCT SURFACE'} title={t.platform.intelTitle} description={t.platform.intelSubtitle} />
          <div className="platform-module-layout">
            <PublicTabList
              id="platform-modules"
              items={(Object.keys(modules) as ModuleId[]).map(id => ({ id, label: modules[id].label }))}
              activeId={activeModule}
              onChange={id => setActiveModule(id as ModuleId)}
              ariaLabel={isZh ? '平台模块' : 'Platform modules'}
              className="platform-module-rail"
              orientation="vertical"
            />
          <div key={activeModule} className="public-data-grid platform-module-panel public-panel-swap" role="tabpanel" id={platformPanelIds.panelId} aria-labelledby={platformPanelIds.tabId}>
            <div className="public-data-main">
              <div className="public-instrument-header" style={{ padding: '0 0 18px', borderBottom: 0 }}><strong>{active.eyebrow}</strong><span>{isZh ? '最近样例运行' : 'LATEST SAMPLE RUN'}</span></div>
              <MiniSparkline values={active.line} color={activeModule === 'plan' ? 'moss' : 'blue'} showNodes={activeModule === 'validate'} label={active.label} />
            </div>
            <aside className="public-data-aside">
              <p>{active.eyebrow}</p>
              <strong>{active.value}</strong>
              <dl>{active.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            </aside>
          </div>
          </div>
        </section>

        <section className="public-section is-dark public-topic-section">
          <SectionHeading eyebrow={isZh ? '完整研究能力' : 'COMPLETE RESEARCH CAPABILITY'} title={isZh ? '从市场全貌到一份可审核的计划。' : 'From market field to an auditable plan.'} description={t.platform.beyondBlindDesc} />
          <div className="public-card-grid">
            {capabilities.map(([title, desc, stat], index) => (
              <article className="public-card" key={title} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.13)' }}>
                <div className="public-card-index" aria-label={`${isZh ? '模块' : 'Module'} ${index + 1}, ${stat}`}>
                  <span>0{index + 1}</span>
                  <i aria-hidden="true" />
                  <b>{stat}</b>
                </div>
                <h3 style={{ color: '#f5f1e8' }}>{title}</h3>
                <p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section public-audience-section">
          <SectionHeading
            eyebrow={isZh ? '适合谁' : 'BUILT FOR PROCESS'}
            title={isZh ? t.platform.whoTitle : 'Built for people who put process first.'}
            description={isZh ? t.platform.whoSubtitle : 'Use one documented workflow for screening, research review, risk planning, and execution.'}
          />
          <div className="public-card-grid">
            {[[t.platform.traderTitle, t.platform.traderDesc], [t.platform.quantTitle, t.platform.quantDesc], [isZh ? t.platform.scalerTitle : 'Active Traders', t.platform.scalerDesc]].map(([title, desc], index) => (
              <article className="public-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{desc}</p></article>
            ))}
          </div>
        </section>

        <PublicCta eyebrow={isZh ? 'ALPHALAB · 模拟优先' : 'ALPHALAB · PAPER FIRST'} title={t.platform.readyTitle} description={t.platform.readyDesc} primary={t.platform.getStarted} secondary={isZh ? '查看研究流程' : 'Review the workflow'} />
      </main>
    </MarketingLayout>
  );
};

export default Platform;
