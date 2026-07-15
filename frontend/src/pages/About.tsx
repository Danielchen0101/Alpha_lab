import React, { useEffect } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { PublicCta, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';

const About: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <MarketingLayout tone="paper"><main className={`public-page ${isZh ? 'is-zh' : 'is-en'}`}><section className="public-section" style={{ paddingTop: 'clamp(130px,15vw,190px)' }}><SectionHeading eyebrow={isZh ? '关于 AlphaLab' : 'ABOUT ALPHALAB'} title={t.about.title} description={t.about.intro} level={1} /><div className="public-card-grid">{[[t.about.workflowTitle, t.about.workflowScannerDesc], [t.about.tradingModesTitle, t.about.tradingModesDesc], [t.about.apiTitle, t.about.apiDesc], [t.about.riskTitle, t.about.riskDesc], [isZh ? '研究优先' : 'Research first', isZh ? '我们把证据、局限和风险边界放在自动化之前。' : 'We place evidence, limitations, and risk bounds before automation.'], [t.about.disclaimerTitle, t.about.disclaimerDesc]].map(([title, desc], index) => <article className="public-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section><PublicCta eyebrow={isZh ? 'ALPHALAB · 研究优先' : 'ALPHALAB · RESEARCH FIRST'} title={isZh ? '从一份可以解释的研究开始。' : 'Start with research you can explain.'} description={isZh ? '在模拟环境中检查数据、验证和风险计划。' : 'Inspect data, validation, and risk plans in a paper environment.'} primary={t.about.getStarted} secondary={isZh ? '返回主页' : 'Back to home'} secondaryPath="/" /></main></MarketingLayout>;
};
export default About;
