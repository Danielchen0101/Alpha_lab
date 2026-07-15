import React, { useEffect } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';

const Technology: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const layers = [
    [t.technology.catClient, t.technology.stackFrontendTitle, t.technology.stackFrontendDesc],
    [t.technology.catServer, t.technology.stackBackendTitle, t.technology.stackBackendDesc],
    [t.technology.catData, t.technology.stackDataTitle, t.technology.stackDataDesc],
    [t.technology.catIntelligence, t.technology.stackLLMTitle, t.technology.stackLLMDesc],
    [t.technology.catQuant, t.technology.stackQuantTitle, t.technology.stackQuantDesc],
    [t.technology.catLogic, t.technology.stackValidationTitle, t.technology.stackValidationDesc],
    [t.technology.catRisk, t.technology.stackRiskTitle, t.technology.stackRiskDesc],
    [t.technology.catSecurity, t.technology.stackSecretsTitle, t.technology.stackSecretsDesc],
    [t.technology.catDevOps, t.technology.stackDockerTitle, t.technology.stackDockerDesc],
  ];
  return (
    <MarketingLayout tone="paper">
      <main className={`public-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero index="T1" eyebrow={isZh ? '技术说明' : 'TECHNICAL NOTE'} title={t.technology.heroTitle} subtitle={t.technology.heroSubtitle} primaryLabel={t.technology.ctaAction} secondaryLabel={isZh ? '查看系统层级' : 'Inspect the system layers'} onSecondary={() => document.querySelector('#architecture')?.scrollIntoView({ behavior: 'smooth' })}>
          <div className="public-instrument"><div className="public-instrument-header"><strong>{isZh ? '系统运行 / 追踪 0842' : 'SYSTEM RUN / TRACE 0842'}</strong><span>{isZh ? '模块化研究流水线' : 'MODULAR RESEARCH PIPELINE'}</span></div><div className="public-instrument-body"><MiniSparkline values={[33,35,38,37,42,45,48,51,54,58,61,65]} label={isZh ? '系统吞吐样例' : 'Sample system throughput'} /></div><MetricStrip metrics={[{ label: isZh ? '处理层' : 'Layers', value: '5', tone: 'blue' }, { label: isZh ? '硬门槛' : 'Hard gates', value: isZh ? '已启用' : 'ON' }, { label: isZh ? '运行日志' : 'Run log', value: isZh ? '已锁定' : 'PIN' }, { label: isZh ? '执行默认' : 'Default', value: isZh ? '模拟' : 'PAPER', tone: 'moss' }]} /></div>
        </PublicHero>
        <section className="public-section" id="architecture"><SectionHeading eyebrow={isZh ? '系统架构' : 'SYSTEM ARCHITECTURE'} title={isZh ? '每一层只负责一件明确的事。' : 'Each layer has one explicit responsibility.'} description={t.technology.archDesc} /><div className="public-card-grid">{layers.map(([cat, title, desc], index) => <article className="public-card" key={title}><span>0{index + 1} / {cat}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
        <section className="public-section is-dark"><SectionHeading eyebrow={isZh ? '责任边界' : 'RESPONSIBILITY BOUNDARIES'} title={isZh ? '数据、推理、量化和执行彼此分离。' : 'Data, reasoning, quant, and execution stay separated.'} description={isZh ? '模型可以提出上下文与反证，但不能绕过确定性风险门槛；执行层默认模拟，并需要明确授权。' : 'Models may add context and counterevidence, but cannot bypass deterministic risk gates. Execution defaults to paper and requires explicit authorization.'} /><div className="public-feature-list">{[[isZh ? '数据层' : 'DATA', isZh ? '负责来源、复权、标准化和质量标记。' : 'Owns provenance, adjustments, normalization, and quality flags.'], [isZh ? '智能层' : 'INTELLIGENCE', isZh ? '负责上下文审查与引用，不直接决定仓位。' : 'Reviews context and sources; it does not decide position size.'], [isZh ? '量化层' : 'QUANT', isZh ? '负责样本外验证、成本、基准与回撤。' : 'Owns out-of-sample tests, costs, benchmark, and drawdown.'], [isZh ? '风控层' : 'RISK', isZh ? '负责入场边界、仓位规模和审批状态。' : 'Owns entry bounds, sizing, and approval state.'], [isZh ? '执行层' : 'EXECUTION', isZh ? '默认模拟；实盘需要用户配置与授权。' : 'Defaults to paper; live routing requires user configuration and authorization.']].map(([title, desc], index) => <article className="public-feature-row" key={title} style={{ borderColor: 'rgba(255,255,255,.14)' }}><span style={{ color: '#9eb7dc' }}>0{index + 1}</span><div className="public-feature-copy"><h3 style={{ color: '#f5f1e8' }}>{title}</h3><p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p></div><b>{isZh ? '边界明确' : 'BOUND'}</b></article>)}</div></section>
        <PublicCta eyebrow={isZh ? 'ALPHALAB · 模块化设计' : 'ALPHALAB · MODULAR BY DESIGN'} title={t.technology.ctaTitle} description={isZh ? '从模拟模式开始，逐层检查自己的数据、模型和风控配置。' : 'Start in paper mode and inspect your data, model, and risk configuration layer by layer.'} primary={t.technology.ctaAction} secondary={isZh ? '查看数据方法' : 'Review data method'} secondaryPath="/data" />
      </main>
    </MarketingLayout>
  );
};
export default Technology;
