import React, { useEffect, useState } from 'react';
import MarketingLayout from '../components/MarketingLayout';
import { scrollPublicTarget } from '../components/public/PublicExperience';
import { MetricStrip, MiniSparkline, PublicCta, PublicHero, SectionHeading } from '../components/public/PublicPrimitives';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';
import './PublicExperience.css';

const Security: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  const [activeControlIndex, setActiveControlIndex] = useState(0);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const controls = [
    [t.security.featureAuth, t.security.featureAuthDesc, isZh ? '会话' : 'SESSION'],
    [t.security.featureTurnstile, t.security.featureTurnstileDesc, isZh ? '防滥用' : 'ABUSE'],
    [t.security.featureEncryption, t.security.featureEncryptionDesc, isZh ? '凭证' : 'SECRETS'],
    [t.security.featureHeaders, t.security.featureHeadersDesc, isZh ? '传输' : 'TRANSPORT'],
    [t.security.featureRateLimit, t.security.featureRateLimitDesc, isZh ? '限流' : 'LIMITS'],
    [t.security.featureAudit, t.security.featureAuditDesc, isZh ? '审计' : 'AUDIT'],
  ];
  const activeControl = controls[activeControlIndex];
  const never = [[t.security.never1, t.security.never1Desc], [t.security.never2, t.security.never2Desc], [t.security.never3, t.security.never3Desc], [t.security.never4, t.security.never4Desc]];
  return (
    <MarketingLayout tone="paper">
      <main className={`public-page public-security-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <PublicHero index="06" eyebrow={isZh ? '安全与用户控制' : 'SECURITY & USER CONTROL'} title={t.security.title} subtitle={t.security.subtitle} primaryLabel={isZh ? '创建账户' : 'Create an account'} secondaryLabel={isZh ? '查看控制边界' : 'Review control boundaries'} onSecondary={() => scrollPublicTarget(document.querySelector('#security-controls'))}>
          <div className="public-instrument"><div className="public-instrument-header"><strong>{isZh ? '控制中心 / 公开摘要' : 'CONTROL PLANE / PUBLIC SUMMARY'}</strong><span>{isZh ? '产品边界' : 'PRODUCT BOUNDARIES'}</span></div><div className="public-instrument-body"><MiniSparkline values={[2,2,3,3,3,4,4,5,5,5,6,6]} color="moss" variant="step" showNodes label={isZh ? '六项安全控制的产品边界示意' : 'Product-boundary map for six security controls'} /></div><MetricStrip metrics={[{ label: isZh ? '认证' : 'Auth', value: isZh ? '必需' : 'REQ', tone: 'blue' }, { label: isZh ? '验证码' : 'Captcha', value: isZh ? '需配置' : 'CONFIG' }, { label: isZh ? '默认环境' : 'Default mode', value: isZh ? '模拟' : 'PAPER' }, { label: isZh ? '人工订单' : 'Manual orders', value: isZh ? '核对' : 'REVIEW', tone: 'moss' }]} /></div>
        </PublicHero>
        <section className="public-section security-control-section" id="security-controls">
          <SectionHeading eyebrow={isZh ? '当前安全控制' : 'CURRENT CONTROLS'} title={isZh ? '具体说明边界，不使用空泛的安全口号。' : 'Specific boundaries, not generic security claims.'} description={isZh ? '以下说明基于当前产品设计。部署相关控制仍需要在每次生产发布后验证。' : 'The following describes the current product design. Deployment-level controls still require verification after every production release.'} />
          <div className="security-control-layout">
            <div className="security-control-map" aria-label={isZh ? '安全控制矩阵' : 'Security control matrix'}>
              {controls.map(([title, , type], index) => (
                <button key={title} type="button" className={`security-control-button ${activeControlIndex === index ? 'is-active' : ''}`} aria-pressed={activeControlIndex === index} onClick={() => setActiveControlIndex(index)}>
                  <span>0{index + 1} · {type}</span><b>{title}</b>
                </button>
              ))}
              <div className="security-control-core">{isZh ? '人工核对\n自动化需启用' : 'MANUAL REVIEW\nAUTO OPT-IN'}</div>
            </div>
            <aside key={activeControlIndex} className="security-control-dossier public-panel-swap" aria-live="polite">
              <span>{isZh ? '控制边界' : 'CONTROL BOUNDARY'} · {activeControl[2]}</span>
              <h3>{activeControl[0]}</h3>
              <p>{activeControl[1]}</p>
            </aside>
          </div>
        </section>
        <section className="public-section is-dark security-boundary-section"><SectionHeading eyebrow={isZh ? '安全问题' : 'SAFETY QUESTIONS'} title={t.security.neverTitle} description={t.security.neverSubtitle} /><div className="public-feature-list">{never.map(([title, desc], index) => <article className="public-feature-row" key={title} style={{ borderColor: 'rgba(255,255,255,.14)' }}><span style={{ color: '#9eb7dc' }}>0{index + 1}</span><div className="public-feature-copy"><h3 style={{ color: '#f5f1e8' }}>{title}</h3><p style={{ color: 'rgba(245,241,232,.62)' }}>{desc}</p></div><b>{isZh ? '用户控制' : 'USER CONTROL'}</b></article>)}</div></section>
        <section className="public-section security-revoke-section"><SectionHeading eyebrow={isZh ? '用户可以做什么' : 'USER CONTROLS'} title={isZh ? '凭证、会话和执行权应当可以撤销。' : 'Credentials, sessions, and execution authority should be revocable.'} /><div className="public-card-grid">{[[isZh ? '轮换密钥' : 'Rotate keys', isZh ? '从提供商后台撤销并替换已有凭证。' : 'Revoke and replace provider credentials from the provider dashboard.'], [isZh ? '删除配置' : 'Delete configuration', isZh ? '移除保存的券商与 AI 提供商设置。' : 'Remove saved broker and AI-provider settings.'], [isZh ? '保持模拟模式' : 'Stay in paper mode', isZh ? '无需连接实盘券商即可完成研究和验证。' : 'Research and validation can run without connecting a live broker.']].map(([title, desc], index) => <article className="public-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
        <PublicCta eyebrow={isZh ? '安全 · 透明 · 用户控制' : 'SECURITY · TRANSPARENCY · CONTROL'} title={t.security.ctaTitle} description={t.security.ctaDesc} primary={isZh ? '创建账户' : 'Create account'} secondary={isZh ? '阅读隐私政策' : 'Read privacy policy'} secondaryPath="/privacy" />
      </main>
    </MarketingLayout>
  );
};
export default Security;
