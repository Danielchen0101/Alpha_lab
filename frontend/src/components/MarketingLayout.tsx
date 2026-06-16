import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { GlobalOutlined, SafetyOutlined, MenuOutlined, CloseOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import SystemStatusIndicator from './SystemStatusIndicator';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, t, setLanguage } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Injecting the common marketing CSS
    const styleId = 'marketing-layout-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .landing-container {
          background-color: #020611;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }
        
        .landing-container p,
        .landing-container h1,
        .landing-container h2,
        .landing-container h3,
        .landing-container h4,
        .landing-container h5,
        .landing-container h6,
        .landing-container span,
        .landing-container a {
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        /* Navigation Bar */
        .nav-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: clamp(60px, 8vh, 80px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(20px, 4vw, 40px);
          z-index: 1000;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          border-bottom: 1px solid transparent;
        }
        /* Premium Fintech Background */
        .nav-header:not(.scrolled) {
          border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
          background: linear-gradient(to bottom, rgba(2, 6, 17, 0.8) 0%, rgba(2, 6, 17, 0) 100%) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        
        .nav-header.scrolled {
          background: rgba(2, 6, 17, 0.95) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .nav-logo {
          font-size: clamp(1.2rem, 2vw, 1.5rem);
          font-weight: 800;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: -0.5px;
        }
        .nav-logo span {
          color: #1890ff;
        }
        .nav-links {
          display: flex;
          gap: clamp(16px, 3vw, 32px);
        }
        @media (max-width: 900px) {
          .nav-links { display: none; }
          .nav-actions .btn-sign-in-desktop { display: none; }
          .nav-actions .btn-get-started-desktop { display: none; }
          .lang-text { display: none; }
        }
        @media (min-width: 901px) {
          .nav-hamburger { display: none; }
        }
        .nav-item {
          color: #94a3b8;
          font-size: clamp(0.85rem, 1vw, 0.95rem);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          padding: 8px 0;
          text-decoration: none;
        }
        .nav-item:hover, .nav-item.active {
          color: #fff;
        }
        .nav-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 2px;
          background: #1890ff;
          transition: width 0.3s ease;
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(24,144,255,0.6);
        }
        .nav-item:hover::after, .nav-item.active::after {
          width: 100%;
        }
        .nav-actions {
          display: flex;
          gap: clamp(8px, 1.5vw, 16px);
          align-items: center;
        }
        @media (max-width: 768px) {
          .nav-header .btn-get-started { display: none; }
          .nav-links { display: none; }
        }
        @media (max-width: 480px) {
          .nav-header { padding: 0 12px !important; }
          .nav-actions { gap: 4px !important; }
        }

        /* Mobile menu overlay */
        .mobile-menu-overlay {
          position: fixed; inset: 0; z-index: 2000;
          background: rgba(2,6,17,0.97);
          display: flex; flex-direction: column;
          padding: 24px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .mobile-menu-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 32px;
        }
        .mobile-menu-nav {
          display: flex; flex-direction: column; gap: 4px; flex: 1;
        }
        .mobile-menu-nav-item {
          color: #94a3b8; font-size: 1.05rem; font-weight: 600;
          padding: 14px 16px; cursor: pointer;
          border-radius: 10px;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .mobile-menu-nav-item:hover, .mobile-menu-nav-item.mobile-active {
          color: #f1f5f9; background: rgba(255,255,255,0.04);
        }
        .mobile-menu-actions {
          display: flex; flex-direction: column; gap: 10px;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 16px;
        }

        /* Buttons */
        .btn-primary {
          background: linear-gradient(135deg, #1890ff 0%, #2f54eb 100%);
          border: none;
          height: clamp(44px, 5vh, 52px);
          padding: 0 clamp(20px, 3vw, 36px);
          font-size: clamp(0.95rem, 1.2vw, 1.1rem);
          font-weight: 600;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(24,144,255,0.3);
          transition: all 0.3s ease;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(24,144,255,0.5);
        }
        .btn-secondary {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          height: clamp(44px, 5vh, 52px);
          padding: 0 clamp(20px, 3vw, 36px);
          font-size: clamp(0.95rem, 1.2vw, 1.1rem);
          font-weight: 600;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.3);
          color: #fff;
        }

        /* Sections */
        .section-container {
          padding: clamp(60px, 10vw, 120px) clamp(16px, 4vw, 24px);
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          scroll-margin-top: 80px;
        }
        .section-title {
          font-size: clamp(2rem, 4vw, 2.8rem);
          font-weight: 800;
          color: #fff;
          text-align: center;
          margin-bottom: 20px;
          letter-spacing: -0.02em;
        }
        .section-subtitle {
          text-align: center;
          color: #94a3b8;
          font-size: clamp(1rem, 1.5vw, 1.15rem);
          max-width: 650px;
          margin: 0 auto 60px;
          line-height: 1.6;
        }

        /* Footer */
        .footer {
          padding: clamp(48px, 8vw, 72px) clamp(16px, 4vw, 24px) 32px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(to bottom, #020611, #01040d);
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: clamp(24px, 4vw, 48px);
          max-width: 1100px;
          margin: 0 auto 48px;
          text-align: left;
        }
        .footer-col-title {
          color: #e2e8f0;
          font-weight: 700;
          margin-bottom: 16px;
          font-size: 0.82rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .footer-link {
          color: #94a3b8;
          font-size: 0.83rem;
          cursor: pointer;
          text-decoration: none;
          display: block;
          padding: 3px 0;
          transition: color 0.2s ease;
        }
        .footer-link:hover { color: #cbd5e1; }
        .footer-brand-tagline {
          color: #64748b;
          font-size: 0.82rem;
          line-height: 1.6;
          margin-top: 12px;
        }
        .footer-divider {
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 24px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .footer-disclaimer {
          color: #64748b;
          font-size: 0.78rem;
          line-height: 1.7;
          margin-bottom: 16px;
          text-align: left;
        }
        .footer-bottom-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .footer-copyright {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 500;
        }
        .footer-trust-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #60a5fa;
          font-size: 0.73rem;
          font-weight: 600;
        }
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr; gap: 28px; }
          .footer-bottom-row { flex-direction: column; align-items: flex-start; }
        }
        
        .page-hero {
          padding: clamp(100px, 15vw, 160px) clamp(16px, 4vw, 24px) clamp(60px, 10vw, 80px);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .page-hero::before {
          content: '';
          position: absolute;
          top: -50%; left: 50%;
          transform: translateX(-50%);
          width: 80vw; height: 80vw;
          max-width: 800px; max-height: 800px;
          background: radial-gradient(circle, rgba(24,144,255,0.15) 0%, transparent 60%);
          filter: blur(60px);
          z-index: 0;
          pointer-events: none;
        }
        .page-title {
          font-size: clamp(2.5rem, 5vw, 4.5rem);
          font-weight: 800;
          color: #fff;
          margin-bottom: clamp(16px, 2vw, 24px);
          position: relative;
          z-index: 1;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          font-size: clamp(1rem, 1.5vw, 1.2rem);
          color: #94a3b8;
          max-width: 700px;
          margin: 0 auto clamp(24px, 4vw, 40px);
          line-height: 1.6;
          position: relative;
          z-index: 1;
        }

        /* Legacy fallback for elements still using .reveal-on-scroll */
        .reveal-on-scroll {
          opacity: 1;
          transform: none;
        }
        
        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US');
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  return (
    <div className="landing-container">
      {/* Navigation Bar */}
      <nav className={`nav-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo" onClick={() => handleNavClick('/')} style={{ display: 'flex', alignItems: 'center', background: 'transparent' }}>
          <img 
            src="/brand/alphalab-logo.png" 
            alt="AlphaLab" 
            style={{ 
              height: '32px', 
              width: 'auto', 
              objectFit: 'contain', 
              background: 'transparent',
              display: 'block'
            }} 
          />
        </div>
        <div className="nav-links">
          <div className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => handleNavClick('/')} aria-current={location.pathname === '/' ? 'page' : undefined}>{t.landing.navHome}</div>
          <div className={`nav-item ${location.pathname === '/platform' ? 'active' : ''}`} onClick={() => handleNavClick('/platform')} aria-current={location.pathname === '/platform' ? 'page' : undefined}>{t.landing.navPlatform}</div>
          <div className={`nav-item ${location.pathname === '/workflow' ? 'active' : ''}`} onClick={() => handleNavClick('/workflow')} aria-current={location.pathname === '/workflow' ? 'page' : undefined}>{t.landing.navWorkflow}</div>
          <div className={`nav-item ${location.pathname === '/features' ? 'active' : ''}`} onClick={() => handleNavClick('/features')} aria-current={location.pathname === '/features' ? 'page' : undefined}>{t.landing.navFeatures}</div>
          <div className={`nav-item ${location.pathname === '/technology' ? 'active' : ''}`} onClick={() => handleNavClick('/technology')} aria-current={location.pathname === '/technology' ? 'page' : undefined} aria-label={t.landing.ariaLabelTechPage}>{t.landing.navTechnology}</div>
        </div>
        <div className="nav-actions">
          <Button type="text" onClick={toggleLanguage} style={{ color: '#94a3b8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'clamp(12px, 1vw, 13px)', padding: '4px 8px' }} aria-label={t.landing.ariaLabelSwitchLang}><GlobalOutlined aria-hidden="true" style={{ fontSize: 'clamp(12px, 1vw, 14px)' }} /> <span className="lang-text">{language === 'zh-CN' ? '中文' : 'EN'}</span></Button>
          <Button type="text" className="btn-sign-in-desktop" style={{ color: '#fff', fontWeight: 600, fontSize: 'clamp(13px, 1vw, 14px)', padding: '4px 8px' }} onClick={() => navigate('/signin')} aria-label={t.landing.ariaLabelSignIn}>{t.landing.signIn}</Button>
          <Button type="primary" className="btn-get-started btn-get-started-desktop" style={{ background: '#1890ff', borderColor: '#1890ff', fontWeight: 600, boxShadow: '0 4px 12px rgba(24,144,255,0.3)' }} onClick={() => navigate('/signup')} aria-label={t.landing.ariaLabelGetStarted}>{t.landing.getStarted}</Button>
          <Button type="text" className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} style={{ color: '#fff', fontSize: 20, padding: '4px 8px' }} aria-label="Open menu"><MenuOutlined /></Button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-header">
            <div className="nav-logo" style={{ cursor: 'pointer', fontSize: 'clamp(1.1rem, 1.8vw, 1.35rem)' }} onClick={() => { handleNavClick('/'); setMobileMenuOpen(false); }}>
              Alpha<span>Lab</span>
            </div>
            <Button type="text" onClick={() => setMobileMenuOpen(false)} style={{ color: '#94a3b8', fontSize: 20, padding: '4px 8px' }} aria-label="Close menu"><CloseOutlined /></Button>
          </div>
          <div className="mobile-menu-nav">
            {[
              { path: '/', label: t.landing.navHome },
              { path: '/platform', label: t.landing.navPlatform },
              { path: '/workflow', label: t.landing.navWorkflow },
              { path: '/features', label: t.landing.navFeatures },
              { path: '/technology', label: t.landing.navTechnology },
            ].map(item => (
              <div
                key={item.path}
                className={`mobile-menu-nav-item ${location.pathname === item.path ? 'mobile-active' : ''}`}
                onClick={() => { handleNavClick(item.path); setMobileMenuOpen(false); }}
              >
                {item.label}
              </div>
            ))}
          </div>
          <div className="mobile-menu-actions">
            <Button type="text" onClick={toggleLanguage} style={{ color: '#94a3b8', fontWeight: 600, fontSize: '1rem', padding: '12px 16px', width: '100%', textAlign: 'left' }}>
              <GlobalOutlined style={{ marginRight: 8 }} /> {language === 'zh-CN' ? '中文' : 'EN'} — {t.landing.ariaLabelSwitchLang}
            </Button>
            <Button onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} style={{ height: 48, width: '100%', color: '#f1f5f9', fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
              {t.landing.signIn}
            </Button>
            <Button type="primary" onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }} style={{ height: 48, width: '100%', fontWeight: 600, background: '#2563eb', border: 'none', borderRadius: 10 }}>
              {t.landing.getStarted}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
          gap: 'clamp(24px, 4vw, 48px)',
          maxWidth: '1100px',
          margin: '0 auto 48px',
          textAlign: 'left',
        }}>
          {/* Brand */}
          <div>
            <div className="nav-logo" style={{ marginBottom: 8, cursor: 'default', fontSize: 'clamp(1.1rem, 1.8vw, 1.35rem)' }}>
              Alpha<span>Lab</span>
            </div>
            <div className="footer-brand-tagline" style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6, marginTop: 12 }}>
              {t.landing.footerTagline || 'Research-first quant automation for market scanning, signal validation, and risk-aware planning.'}
            </div>
          </div>

          {/* Product */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerProduct}</div>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }} onClick={() => handleNavClick('/platform')}>{t.landing.navPlatform}</span>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }} onClick={() => handleNavClick('/workflow')}>{t.landing.navWorkflow}</span>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }} onClick={() => handleNavClick('/features')}>{t.landing.navFeatures}</span>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }} onClick={() => handleNavClick('/technology')}>{t.landing.navTechnology}</span>
          </div>

          {/* Trust */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerTrust}</div>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }} onClick={() => { navigate('/security'); window.scrollTo(0, 0); }}>{t.landing.navSecurity || 'Security'}</span>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }}>{t.landing.footerPrivacyPolicy}</span>
            <span className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0' }}>{t.landing.footerTermsOfService}</span>
          </div>

          {/* Resources */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerResources}</div>
            <a className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0', textDecoration: 'none' }} href="https://github.com/Danielchen0101/quant_platform" target="_blank" rel="noopener noreferrer">{t.landing.footerGithub}</a>
            <SystemStatusIndicator />
          </div>
        </div>

        {/* Disclaimer + Bottom */}
        <div className="footer-divider" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 24, maxWidth: '1100px', margin: '0 auto' }}>
          <div className="footer-disclaimer" style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 16, textAlign: 'left' }}>
            {t.landing.footerDisclaimer}
          </div>
          <div className="footer-bottom-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div className="footer-copyright" style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 500 }}>
              {t.landing.footerCopyright.replace('{year}', String(new Date().getFullYear()))}
            </div>
            <div className="footer-trust-badge" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa', fontSize: '0.73rem', fontWeight: 600 }}>
              <SafetyOutlined aria-hidden="true" style={{ fontSize: 11 }} />
              <span>{t.landing.footerSecureEnv}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;