import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicSite.css';

const NotFound: React.FC = () => {
  const { language, t } = useLanguage();
  const isZh = language === 'zh-CN';
  React.useEffect(() => { window.scrollTo(0, 0); }, []);
  return <MarketingLayout tone="paper"><main className={`public-page ${isZh ? 'is-zh' : 'is-en'}`}><section className="public-section" style={{ minHeight: '80svh', paddingTop: 'clamp(150px,18vw,220px)' }}><div className="public-split"><div className="public-sticky-copy"><p>{isZh ? '错误 / 404' : 'ERROR / 404'}</p><h1>{t.notFound.title}</h1><span>{t.notFound.description}</span><div className="public-actions"><Link to="/" className="public-primary">{t.notFound.backToHome}</Link><Link to="/signin" className="public-secondary">{t.notFound.signIn}<span aria-hidden="true">↗</span></Link></div></div><div className="public-instrument"><div className="public-instrument-header"><strong>{isZh ? '路由查询 / 无匹配结果' : 'ROUTE LOOKUP / NO MATCH'}</strong><span>{isZh ? '页面未找到' : 'PAGE NOT FOUND'}</span></div><div className="public-instrument-body" style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><div style={{ textAlign: 'center' }}><span style={{ display: 'block', color: 'var(--public-blue)', font: '700 .65rem ui-monospace, monospace', letterSpacing: '.12em' }}>{isZh ? '请求已终止' : 'REQUEST TERMINATED'}</span><strong style={{ display: 'block', marginTop: 20, font: '650 clamp(4rem,10vw,9rem) var(--public-display-en)', letterSpacing: '-.07em' }}>404</strong><p style={{ color: 'var(--public-muted)' }}>{t.notFound.subtitle}</p></div></div></div></div></section></main></MarketingLayout>;
};
export default NotFound;
