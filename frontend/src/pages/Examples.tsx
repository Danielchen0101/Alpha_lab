import React, { useEffect, useRef } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import ResearchExamplesExplorer from '../components/public/ResearchExamplesExplorer';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

const Examples: React.FC = () => {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const explorerRef = useRef<HTMLElement>(null);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-examples-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero
          index="04"
          eyebrow={isZh ? '公开研究案例' : 'PUBLIC RESEARCH EXAMPLES'}
          title={isZh ? '先检查证据，再考虑策略。' : 'Inspect the evidence before the strategy.'}
          subtitle={isZh ? '浏览可交互的模拟研究样本，比较假设、样本外指标、成本、回撤和局限。这里的数字用于说明研究界面，不是投资建议或未来表现承诺。' : 'Explore interactive simulated research samples and compare hypotheses, out-of-sample metrics, costs, drawdown, and limitations. Figures demonstrate the research interface; they are not advice or promises of future performance.'}
          primaryLabel={isZh ? '在模拟模式中开始' : 'Start in paper mode'}
          secondaryLabel={isZh ? '打开案例浏览器' : 'Open the example browser'}
          onSecondary={() => scrollPublicTarget(explorerRef.current)}
        >
          <div className="public-instrument">
            <div className="public-instrument-header"><strong>{isZh ? '案例索引 / 03 份研究记录' : 'EXAMPLE INDEX / 03 RESEARCH NOTES'}</strong><span>{isZh ? '全部为模拟结果' : 'ALL RESULTS SIMULATED'}</span></div>
            <div className="public-instrument-body"><MiniSparkline values={[18,21,25,24,32,36,41,39,47,53,58,63,69]} label={isZh ? '研究案例指数' : 'Research example index'} /></div>
            <MetricStrip metrics={[
              { label: isZh ? '研究案例' : 'Research notes', value: '3', tone: 'blue' },
              { label: isZh ? '验证窗口' : 'OOS folds', value: '15' },
              { label: isZh ? '基准' : 'Benchmarks', value: '2' },
              { label: isZh ? '实盘推荐' : 'Live calls', value: '0', tone: 'moss' },
            ]} />
          </div>
        </PublicHero>

        <section className="public-section examples-browser-section" ref={explorerRef}>
          <SectionHeading eyebrow={isZh ? '研究案例浏览器' : 'RESEARCH EXAMPLE BROWSER'} title={isZh ? '切换策略和时间范围，查看证据如何变化。' : 'Change strategy and range. Watch the evidence change.'} description={isZh ? '每个案例都带有研究假设、样本外结果、风险指标和证据摘要。' : 'Each example keeps its thesis, out-of-sample results, risk metrics, and evidence summary together.'} />
          <ResearchExamplesExplorer locale={language} />
        </section>

        <section className="public-section is-dark examples-reading-strip">
          <SectionHeading eyebrow={isZh ? '阅读规范' : 'HOW TO READ AN EXAMPLE'} title={isZh ? '一个漂亮曲线，不足以证明策略可靠。' : 'An attractive curve is not enough.'} description={isZh ? '公开案例必须同时展示成本、回撤、基准、样本外窗口和明确局限。缺少其中任何一项，都只能被视为待验证假设。' : 'A public example should show costs, drawdown, benchmark, out-of-sample windows, and explicit limitations together. Without them, it remains a hypothesis.'} />
          <div className="public-card-grid">
            {[
              [isZh ? '假设' : 'THESIS', isZh ? '策略试图解释什么现象，哪些条件必须成立。' : 'What the strategy attempts to explain and which conditions must hold.'],
              [isZh ? '验证' : 'VALIDATION', isZh ? '独立样本外窗口、基准和参数敏感度。' : 'Independent out-of-sample windows, benchmark, and parameter sensitivity.'],
              [isZh ? '成本' : 'COSTS', isZh ? '交易费用、滑点和换手率如何影响结果。' : 'How fees, slippage, and turnover affect the result.'],
              [isZh ? '风险' : 'RISK', isZh ? '回撤、暴露、仓位和失效条件。' : 'Drawdown, exposure, sizing, and invalidation conditions.'],
              [isZh ? '局限' : 'LIMITS', isZh ? '幸存者偏差、前视偏差和数据覆盖缺口。' : 'Survivorship bias, look-ahead bias, and coverage gaps.'],
              [isZh ? '结论' : 'CONCLUSION', isZh ? '通过、复核或拒绝，并保留原因。' : 'Pass, review, or reject—with the reason preserved.'],
            ].map(([title, desc], index) => <article className="public-card" key={title} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.13)' }}><span>0{index + 1}</span><h3 style={{ color: '#f5f1e8' }}>{title}</h3><p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p></article>)}
          </div>
        </section>

        <PublicCta eyebrow={isZh ? '所有案例均为模拟结果' : 'ALL EXAMPLES ARE SIMULATED'} title={isZh ? '把自己的假设带进研究流程。' : 'Bring your own hypothesis into the workflow.'} description={isZh ? '从模拟模式开始，检查每一道门槛，再决定一份计划是否值得继续。' : 'Start in paper mode, inspect every gate, and decide whether a plan deserves to continue.'} primary={isZh ? '开始构建' : 'Start building'} secondary={isZh ? '查看研究方法' : 'Review the research method'} secondaryPath="/research" />
      </main>
    </MarketingLayout>
  );
};

export default Examples;
