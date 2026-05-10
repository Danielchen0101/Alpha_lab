import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const { language, t, setLanguage } = useLanguage();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    
    // Set up intersection observer for scroll animations
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    // Observe all elements with reveal class
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => observerRef.current?.observe(el));

    // Also observe dynamically on route change
    return () => {
      window.removeEventListener('scroll', handleScroll);
      observerRef.current?.disconnect();
    };
  }, [location.pathname]);

  // Re-observe when children changes (simple way)
  useEffect(() => {
    const revealElements = document.querySelectorAll('.reveal-on-scroll:not(.reveal-visible)');
    revealElements.forEach(el => observerRef.current?.observe(el));
  });

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
        
        /* Scroll Reveal Animations */
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }
        .delay-300 { transition-delay: 300ms; }
        .delay-400 { transition-delay: 400ms; }
        
        /* Navigation Bar */
        .nav-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          z-index: 1000;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          border-bottom: 1px solid transparent;
        }
        .nav-header.scrolled {
          background: rgba(2, 6, 17, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
          height: 70px;
        }
        .nav-logo {
          font-size: 1.5rem;
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
          gap: 32px;
        }
        @media (max-width: 900px) {
          .nav-links { display: none; }
        }
        .nav-item {
          color: #94a3b8;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          padding: 8px 0;
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
          gap: 16px;
          align-items: center;
        }

        /* Buttons */
        .btn-primary {
          background: linear-gradient(135deg, #1890ff 0%, #2f54eb 100%);
          border: none;
          height: 52px;
          padding: 0 36px;
          font-size: 1.1rem;
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
          height: 52px;
          padding: 0 36px;
          font-size: 1.1rem;
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
          padding: 120px 24px;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          scroll-margin-top: 80px;
        }
        .section-title {
          font-size: 2.8rem;
          font-weight: 800;
          color: #fff;
          text-align: center;
          margin-bottom: 20px;
          letter-spacing: -0.02em;
        }
        .section-subtitle {
          text-align: center;
          color: #94a3b8;
          font-size: 1.15rem;
          max-width: 650px;
          margin: 0 auto 60px;
          line-height: 1.6;
        }

        /* Footer */
        .footer {
          padding: 60px 24px 40px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: #020611;
        }
        
        .page-hero {
          padding: 160px 24px 80px;
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
          font-size: clamp(3rem, 5vw, 4.5rem);
          font-weight: 800;
          color: #fff;
          margin-bottom: 24px;
          position: relative;
          z-index: 1;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          font-size: 1.2rem;
          color: #94a3b8;
          max-width: 700px;
          margin: 0 auto 40px;
          line-height: 1.6;
          position: relative;
          z-index: 1;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US');
  };

  // For navigating to the landing page and scrolling to a specific section (optional, if we want cross-page anchors)
  // But here we use dedicated pages.
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
          <div className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => handleNavClick('/')}>{t.landing.navHome}</div>
          <div className={`nav-item ${location.pathname === '/platform' ? 'active' : ''}`} onClick={() => handleNavClick('/platform')}>{t.landing.navPlatform}</div>
          <div className={`nav-item ${location.pathname === '/workflow' ? 'active' : ''}`} onClick={() => handleNavClick('/workflow')}>{t.landing.navWorkflow}</div>
          <div className={`nav-item ${location.pathname === '/features' ? 'active' : ''}`} onClick={() => handleNavClick('/features')}>{t.landing.navFeatures}</div>
          <div className={`nav-item ${location.pathname === '/technology' ? 'active' : ''}`} onClick={() => handleNavClick('/technology')}>{t.landing.navTechnology}</div>
        </div>
        <div className="nav-actions">
          <Button type="text" onClick={toggleLanguage} style={{ color: '#94a3b8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><GlobalOutlined style={{ fontSize: 14 }} /> {language === 'zh-CN' ? '中文' : 'EN'}</Button>
          <Button type="text" style={{ color: '#fff', fontWeight: 600 }} onClick={() => navigate('/signin')}>{t.landing.signIn}</Button>
          <Button type="primary" style={{ background: '#1890ff', borderColor: '#1890ff', fontWeight: 600, boxShadow: '0 4px 12px rgba(24,144,255,0.3)' }} onClick={() => navigate('/signup')}>{t.landing.getStarted}</Button>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 12, lineHeight: 1.6 }}>
            {t.landing.footerDisclaimer}
          </div>
          <div style={{ color: '#475569', fontSize: '0.75rem', marginBottom: 20, lineHeight: 1.6 }}>
            {t.landing.footerPrivacy}
          </div>
          <div style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
            {t.landing.footerCopyright.replace('{year}', String(new Date().getFullYear()))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
