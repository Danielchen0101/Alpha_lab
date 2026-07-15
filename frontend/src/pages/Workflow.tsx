import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { PublicTabList, publicTabIds, scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

const Workflow: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const workflowRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const steps = useMemo(() => [
    [t.workflow.step1Title, t.workflow.step1Status, t.workflow.step1Desc, t.workflow.step1Purpose, t.workflow.step1Inputs, t.workflow.step1Outputs, t.workflow.step1Risk, '8,421'],
    [t.workflow.step2Title, t.workflow.step2Status, t.workflow.step2Desc, t.workflow.step2Purpose, t.workflow.step2Inputs, t.workflow.step2Outputs, t.workflow.step2Risk, '409'],
    [t.workflow.step3Title, t.workflow.step3Status, t.workflow.step3Desc, t.workflow.step3Purpose, t.workflow.step3Inputs, t.workflow.step3Outputs, t.workflow.step3Risk, '24'],
    [t.workflow.step4Title, t.workflow.step4Status, t.workflow.step4Desc, t.workflow.step4Purpose, t.workflow.step4Inputs, t.workflow.step4Outputs, t.workflow.step4Risk, '3'],
    [t.workflow.step5Title, t.workflow.step5Status, t.workflow.step5Desc, t.workflow.step5Purpose, t.workflow.step5Inputs, t.workflow.step5Outputs, t.workflow.step5Risk, isZh ? '已设置' : 'SET'],
    [t.workflow.step6Title, t.workflow.step6Status, t.workflow.step6Desc, t.workflow.step6Purpose, t.workflow.step6Inputs, t.workflow.step6Outputs, t.workflow.step6Risk, isZh ? '模拟' : 'PAPER'],
  ], [isZh, t]);
  const active = steps[activeStep];
  const workflowActiveId = String(activeStep);
  const workflowPanelIds = publicTabIds('workflow-stages', workflowActiveId);
  const curves = [
    [48, 46, 49, 51, 47, 54, 57, 53, 61, 63, 68, 70],
    [28, 31, 30, 34, 33, 38, 41, 40, 45, 48, 51, 54],
    [22, 25, 29, 27, 35, 39, 44, 43, 50, 56, 60, 64],
    [18, 24, 29, 27, 38, 42, 48, 46, 57, 63, 61, 72],
    [72, 69, 65, 62, 59, 55, 51, 48, 43, 38, 34, 30],
    [33, 36, 40, 42, 46, 49, 52, 56, 60, 62, 65, 68],
  ];

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-workflow-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero
          index="03"
          eyebrow={isZh ? '从观察到批准' : 'FROM OBSERVATION TO APPROVAL'}
          title={isZh ? '每个阶段都有输入、产物和门槛。' : 'Every stage has an input, artifact, and gate.'}
          subtitle={t.workflow.heroSubtitle}
          primaryLabel={t.workflow.getStarted}
          secondaryLabel={isZh ? '跟随完整流程' : 'Follow the full workflow'}
          onSecondary={() => scrollPublicTarget(workflowRef.current)}
        >
          <div className="public-instrument">
            <div className="public-instrument-header"><strong>{isZh ? '模拟运行日志 / NVDA-动量-042' : 'SIMULATED RUN LOG / NVDA-MOM-042'}</strong><span>{isZh ? '运行中 · 模拟模式' : 'RUNNING · PAPER MODE'}</span></div>
            <div className="public-instrument-body">
              <div className="public-feature-list">
                {steps.slice(0, 4).map((step, index) => <div className="public-feature-row" style={{ padding: '14px 0', gridTemplateColumns: '42px 1fr auto' }} key={step[0]}><span>0{index + 1}</span><div className="public-feature-copy"><h3 style={{ fontSize: '1rem' }}>{step[0]}</h3></div><b>{index < 3 ? (isZh ? '完成' : 'PASS') : (isZh ? '审查' : 'REVIEW')}</b></div>)}
              </div>
            </div>
            <MetricStrip metrics={[
              { label: isZh ? '观察' : 'Observe', value: '8,421', tone: 'blue' },
              { label: isZh ? '筛选' : 'Filter', value: '24' },
              { label: isZh ? '验证' : 'Validate', value: '3' },
              { label: isZh ? '计划' : 'Plan', value: '1', tone: 'moss' },
            ]} />
          </div>
        </PublicHero>

        <section className="public-section workflow-story-section" ref={workflowRef}>
          <SectionHeading eyebrow={t.workflow.coreWorkflow} title={t.workflow.sectionTitle} description={t.workflow.sectionSubtitle} />
          <PublicTabList
            id="workflow-stages"
            items={steps.map((step, index) => ({ id: String(index), label: <>0{index + 1} · {step[0]}</> }))}
            activeId={workflowActiveId}
            onChange={id => setActiveStep(Number(id))}
            ariaLabel={t.workflow.sectionTitle}
            className="workflow-step-rail"
          />
          <div key={activeStep} className="public-data-grid workflow-stage-shell public-panel-swap" role="tabpanel" id={workflowPanelIds.panelId} aria-labelledby={workflowPanelIds.tabId}>
            <div className="public-data-main">
              <div className="public-instrument-header" style={{ padding: '0 0 20px', borderBottom: 0 }}><strong>{active[0]} / {active[1]}</strong><span>{isZh ? '对应研究产物' : 'STAGE ARTIFACT'}</span></div>
              <MiniSparkline values={curves[activeStep]} color={activeStep === 4 ? 'moss' : activeStep === 5 ? 'copper' : 'blue'} showNodes label={String(active[0])} />
              <p style={{ margin: '24px 0 0', color: '#626760', lineHeight: 1.65 }}>{active[3]}</p>
            </div>
            <aside className="public-data-aside">
              <p>{active[1]}</p><strong>{active[7]}</strong>
              <dl>
                <div><dt>{t.workflow.inputsLabel}</dt><dd>{isZh ? '已记录' : 'LOGGED'}</dd></div>
                <div><dt>{t.workflow.outputsLabel}</dt><dd>{isZh ? '可审计' : 'AUDITABLE'}</dd></div>
                <div><dt>{t.workflow.riskCheckLabel}</dt><dd>{activeStep === 5 ? (isZh ? '需批准' : 'APPROVAL') : (isZh ? '通过' : 'PASS')}</dd></div>
              </dl>
            </aside>
          </div>
          <div className="public-card-grid workflow-stage-briefs" style={{ marginTop: 28 }}>
            {[[t.workflow.inputsLabel, active[4]], [t.workflow.outputsLabel, active[5]], [t.workflow.riskCheckLabel, active[6]]].map(([label, copy], index) => <article className="public-card" key={label}><span>0{index + 1}</span><h3>{label}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className="public-section is-dark workflow-run-log">
          <SectionHeading eyebrow={isZh ? '运行日志' : 'RUN LOG'} title={isZh ? '被淘汰的候选也留下原因。' : 'Rejected candidates keep their reasons too.'} description={isZh ? '流程不是只展示成功结果。每一次门槛失败、数据缺口、模型分歧和人工否决都会进入审计轨迹。' : 'The workflow does not show successes only. Every failed gate, data gap, model disagreement, and manual rejection enters the audit trail.'} />
          <div className="public-feature-list" style={{ borderColor: 'rgba(255,255,255,.14)' }}>
            {[
              ['09:31:04', isZh ? '流动性门槛' : 'Liquidity gate', isZh ? '8,012 个标的被过滤' : '8,012 symbols removed', isZh ? '通过' : 'PASS'],
              ['09:31:12', isZh ? '结构门槛' : 'Structure gate', isZh ? '331 个候选被过滤' : '331 candidates removed', isZh ? '通过' : 'PASS'],
              ['09:32:48', isZh ? '证据分歧' : 'Evidence conflict', isZh ? '4 个候选需要复核' : '4 candidates flagged', isZh ? '复核' : 'REVIEW'],
              ['09:34:05', isZh ? '风险预算' : 'Risk budget', isZh ? '计划已应用账户中配置的风险上限' : 'Plan uses the risk limit configured for this account', isZh ? '受限' : 'BOUND'],
            ].map(([time, title, desc, status]) => <article className="public-feature-row" key={time} style={{ borderColor: 'rgba(255,255,255,.14)' }}><span style={{ color: '#9eb7dc' }}>{time}</span><div className="public-feature-copy"><h3 style={{ color: '#f5f1e8' }}>{title}</h3><p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p></div><b style={{ color: status === 'REVIEW' || status === '复核' ? '#d0a16e' : '#9caf91' }}>{status}</b></article>)}
          </div>
        </section>

        <PublicCta eyebrow={isZh ? '观察 · 筛选 · 验证 · 规划' : 'OBSERVE · FILTER · TEST · PLAN'} title={t.workflow.readyTitle} description={isZh ? '从模拟模式开始，亲自检查每个阶段的输入、产物和风险门槛。' : 'Start in paper mode and inspect every stage input, artifact, and risk gate yourself.'} primary={t.workflow.getStarted} secondary={isZh ? '浏览研究案例' : 'Browse examples'} secondaryPath="/examples" />
      </main>
    </MarketingLayout>
  );
};

export default Workflow;
