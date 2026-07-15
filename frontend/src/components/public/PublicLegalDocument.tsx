import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from '../MarketingLayout';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../pages/PublicSite.css';
import '../../styles/Legal.css';

export interface LegalSection {
  title: string;
  body: string;
}

interface PublicLegalDocumentProps {
  kind: 'terms' | 'privacy';
  title: string;
  updated: string;
  sections: LegalSection[];
  disclaimer: string;
  importantNotice: string;
}

const renderLegalBody = (body: string) => body.split('\n\n').map((block, blockIndex) => {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
  const firstBullet = lines.findIndex(line => line.startsWith('- '));

  if (firstBullet === -1) {
    return <p key={`paragraph-${blockIndex}`}>{lines.join(' ')}</p>;
  }

  const introduction = lines.slice(0, firstBullet).join(' ');
  const bullets = lines.slice(firstBullet).filter(line => line.startsWith('- '));

  return (
    <React.Fragment key={`list-${blockIndex}`}>
      {introduction && <p className="legal-list-introduction">{introduction}</p>}
      <ul>
        {bullets.map((line, itemIndex) => <li key={`${line}-${itemIndex}`}>{line.slice(2)}</li>)}
      </ul>
    </React.Fragment>
  );
});

const PublicLegalDocument: React.FC<PublicLegalDocumentProps> = ({
  kind,
  title,
  updated,
  sections,
  disclaimer,
  importantNotice,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const relatedPath = kind === 'terms' ? '/privacy' : '/terms';
  const relatedLabel = kind === 'terms'
    ? (isZh ? '隐私政策' : 'Privacy Policy')
    : (isZh ? '服务条款' : 'Terms of Service');

  useEffect(() => { window.scrollTo(0, 0); }, [kind]);

  return (
    <MarketingLayout tone="paper">
      <main className={`public-page legal-public-page ${isZh ? 'is-zh' : 'is-en'}`}>
        <header className="legal-public-hero" aria-labelledby="legal-document-title">
          <div className="legal-public-hero-copy">
            <p>{kind === 'terms' ? (isZh ? '法律文件 / 服务条款' : 'LEGAL / TERMS') : (isZh ? '法律文件 / 隐私政策' : 'LEGAL / PRIVACY')}</p>
            <h1 id="legal-document-title">{title}</h1>
            <span>{disclaimer}</span>
          </div>
          <dl className="legal-public-meta" aria-label={isZh ? '文档信息' : 'Document information'}>
            <div><dt>{isZh ? '版本日期' : 'Version date'}</dt><dd>{updated.replace(/^Last updated:\s*/i, '').replace(/^最后更新：\s*/, '')}</dd></div>
            <div><dt>{isZh ? '章节' : 'Sections'}</dt><dd>{String(sections.length).padStart(2, '0')}</dd></div>
            <div><dt>{isZh ? '用途' : 'Purpose'}</dt><dd>{isZh ? '透明说明' : 'Transparency'}</dd></div>
          </dl>
        </header>

        <section className="legal-document-shell" aria-label={title}>
          <aside className="legal-document-rail">
            <div className="legal-document-rail-header">
              <span>{isZh ? '文档目录' : 'DOCUMENT INDEX'}</span>
              <strong>{sections.length}</strong>
            </div>
            <nav aria-label={isZh ? `${title}目录` : `${title} table of contents`}>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a href={`#legal-section-${index + 1}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <b>{section.title.replace(/^\d+\.\s*/, '')}</b>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="legal-document-related">
              <span>{isZh ? '相关文件' : 'RELATED'}</span>
              <Link to={relatedPath}>{relatedLabel}<i aria-hidden="true">↗</i></Link>
              <Link to="/signup">{isZh ? '返回创建账户' : 'Return to create account'}<i aria-hidden="true">↗</i></Link>
            </div>
          </aside>

          <article className="legal-document-content">
            <div className="legal-document-note" role="note">
              <span aria-hidden="true">i</span>
              <p>{disclaimer}</p>
            </div>

            {sections.map((section, index) => (
              <section id={`legal-section-${index + 1}`} className="legal-document-section" key={section.title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{section.title.replace(/^\d+\.\s*/, '')}</h2>
                  {renderLegalBody(section.body)}
                </div>
              </section>
            ))}

            <div className="legal-document-warning" role="note">
              <strong>{isZh ? '问题与请求' : 'QUESTIONS & REQUESTS'}</strong>
              <p>{importantNotice}</p>
            </div>

            <footer className="legal-document-end">
              <span>{isZh ? '文档结束' : 'END OF DOCUMENT'}</span>
              <a href="#legal-document-title">{isZh ? '返回顶部' : 'Back to top'}<i aria-hidden="true">↑</i></a>
            </footer>
          </article>
        </section>
      </main>
    </MarketingLayout>
  );
};

export default PublicLegalDocument;
