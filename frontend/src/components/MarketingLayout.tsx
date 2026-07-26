import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { GlobalOutlined, SafetyOutlined, MenuOutlined, CloseOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import SystemStatusIndicator from './SystemStatusIndicator';
import ThemeSwitcher from './ThemeSwitcher';

interface MarketingLayoutProps {
  children: React.ReactNode;
  tone?: 'dark' | 'paper';
}

const getMarketingThemePopupContainer = (triggerNode: HTMLElement): HTMLElement => (
  triggerNode.closest<HTMLElement>('#marketing-mobile-menu') || document.body
);

const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, tone = 'paper' }) => {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const skipLinkRef = useRef<HTMLAnchorElement | null>(null);
  const navigationRef = useRef<HTMLElement | null>(null);
  const mainContentRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const { language, t, setLanguage } = useLanguage();
  const isPaper = tone === 'paper';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isPaper) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.querySelector('.public-page');
    if (!root) return undefined;
    const selector = '.public-section-heading, .public-data-grid, .public-card, .public-feature-row, .research-explorer, .public-cta, .security-control-layout';
    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));

    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(target => target.classList.add('public-reveal', 'is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach((target, index) => {
      target.classList.add('public-reveal');
      target.style.setProperty('--public-reveal-delay', `${Math.min(index % 4, 3) * 55}ms`);
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, [isPaper, location.pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

        .public-skip-link {
          position: fixed;
          top: 10px;
          left: 12px;
          z-index: 3000;
          padding: 10px 14px;
          color: #fff;
          border: 1px solid rgba(255,255,255,.3);
          background: #171a17;
          font-size: .78rem;
          font-weight: 650;
          text-decoration: none;
          transform: translateY(-160%);
          transition: transform .16s ease;
        }
        .public-skip-link:focus {
          outline: 2px solid #3569c8;
          outline-offset: 2px;
          transform: translateY(0);
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
          border: 0;
          padding: 0;
          background: transparent;
          text-decoration: none;
        }
        .nav-logo span {
          color: #1890ff;
        }
        .nav-logo:focus-visible,
        .mobile-menu-nav-item:focus-visible,
        .footer-link-button:focus-visible,
        .marketing-action-link:focus-visible {
          outline: 2px solid #1890ff;
          outline-offset: 4px;
        }
        .nav-links {
          display: flex;
          gap: clamp(16px, 3vw, 32px);
        }
        @media (max-width: 1080px) {
          .nav-links { display: none; }
          .nav-actions .btn-sign-in-desktop { display: none; }
          .nav-actions .btn-get-started-desktop { display: none; }
          .lang-text { display: none; }
        }
        @media (min-width: 1081px) {
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
          border: 0;
          background: transparent;
          font-family: inherit;
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
        .marketing-action-link {
          box-sizing: border-box;
          display: inline-flex;
          min-height: 32px;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          background: transparent;
          color: inherit;
          font-family: inherit;
          line-height: 1.5715;
          text-decoration: none;
          white-space: nowrap;
          transition: color .2s ease, border-color .2s ease, background .2s ease, filter .2s ease;
        }
        .marketing-action-link:hover {
          text-decoration: none;
          filter: brightness(1.06);
        }
        .marketing-primary-action {
          padding: 4px 15px;
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
          box-sizing: border-box;
          min-height: 100vh;
          height: 100dvh;
          padding: 24px 24px max(24px, env(safe-area-inset-bottom));
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .mobile-menu-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 32px;
          flex: 0 0 auto;
        }
        .mobile-menu-nav {
          display: flex; flex-direction: column; gap: 4px;
          flex: 1 0 auto;
          min-height: max-content;
        }
        .mobile-menu-nav-item {
          color: #94a3b8; font-size: 1.05rem; font-weight: 600;
          padding: 14px 16px; cursor: pointer;
          display: block; width: 100%; border: 0; background: transparent; text-align: left;
          font-family: inherit;
          border-radius: 10px;
          text-decoration: none;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .mobile-menu-nav-item:hover, .mobile-menu-nav-item.mobile-active {
          color: #f1f5f9; background: rgba(255,255,255,0.04);
        }
        .mobile-menu-actions {
          display: flex; flex-direction: column; gap: 10px;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 16px;
          flex: 0 0 auto;
        }
        @media (max-height: 700px) {
          .mobile-menu-overlay {
            padding-top: 16px;
          }
          .mobile-menu-header {
            margin-bottom: 12px;
          }
          .mobile-menu-nav-item {
            padding-block: 10px;
          }
          .mobile-menu-actions {
            margin-top: 10px;
            padding-top: 12px;
            gap: 8px;
          }
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
        .footer-link-button {
          width: fit-content;
          border: 0;
          background: transparent;
          font: inherit;
          text-align: left;
        }
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

        /* Paper tone — used by the Market Field landing page only. */
        .landing-container.marketing-paper {
          --paper: #f2efe7;
          --paper-bright: #faf8f2;
          --paper-ink: #171a17;
          --paper-muted: #666b64;
          --paper-accent: #3569c8;
          --paper-line: rgba(23, 26, 23, 0.18);
          background: var(--paper);
          color: var(--paper-ink);
          overflow-x: clip;
          overflow-y: visible;
        }
        html[data-theme='dark'] .landing-container.marketing-paper {
          --paper: #15191a;
          --paper-bright: #1d2223;
          --paper-ink: #f3f1e9;
          --paper-muted: #b9c1bb;
          --paper-accent: #91baff;
          --paper-line: rgba(243, 241, 233, 0.22);
          background: var(--paper);
          color: var(--paper-ink);
          color-scheme: dark;
        }
        .marketing-paper p,
        .marketing-paper h1,
        .marketing-paper h2,
        .marketing-paper h3,
        .marketing-paper h4,
        .marketing-paper span,
        .marketing-paper a {
          word-break: normal;
          overflow-wrap: normal;
        }
        .marketing-paper .nav-header:not(.scrolled) {
          background: rgba(242, 239, 231, 0.9) !important;
          border-bottom-color: rgba(23, 26, 23, 0.12) !important;
        }
        .marketing-paper .nav-header.scrolled {
          background: rgba(242, 239, 231, 0.96) !important;
          border-bottom-color: rgba(23, 26, 23, 0.14) !important;
          box-shadow: 0 8px 30px rgba(45, 43, 35, 0.08) !important;
        }
        .marketing-paper .paper-wordmark {
          color: var(--paper-ink);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.45rem, 2vw, 1.85rem);
          font-weight: 600;
          letter-spacing: -0.055em;
          line-height: 1;
          white-space: nowrap;
        }
        .marketing-paper .nav-item {
          color: #4f544e;
          font-weight: 500;
        }
        .marketing-paper .nav-item:hover,
        .marketing-paper .nav-item.active {
          color: var(--paper-ink);
        }
        .marketing-paper .nav-item::after {
          background: var(--paper-accent);
          box-shadow: none;
          height: 1px;
        }
        .marketing-paper .mobile-menu-overlay {
          background: rgba(242, 239, 231, 0.98);
          color: var(--paper-ink);
        }
        .marketing-paper .mobile-menu-nav-item {
          color: #555b54;
          border-radius: 0;
          border-bottom: 1px solid var(--paper-line);
        }
        .marketing-paper .mobile-menu-nav-item:hover,
        .marketing-paper .mobile-menu-nav-item.mobile-active {
          color: var(--paper-ink);
          background: rgba(53, 105, 200, 0.07);
        }
        .marketing-paper .mobile-menu-actions {
          border-top-color: var(--paper-line);
        }
        .marketing-paper .marketing-language-action,
        .marketing-paper .marketing-close-action {
          color: var(--paper-muted) !important;
        }
        .marketing-paper .marketing-sign-in-action,
        .marketing-paper .marketing-menu-action,
        .marketing-paper .marketing-mobile-sign-in-action {
          color: var(--paper-ink) !important;
        }
        .marketing-paper .marketing-primary-action,
        .marketing-paper .marketing-mobile-primary-action {
          color: var(--paper) !important;
          border-color: var(--paper-ink) !important;
          background: var(--paper-ink) !important;
          box-shadow: none !important;
        }
        .marketing-paper .marketing-mobile-sign-in-action {
          border-color: var(--paper-line) !important;
          background: transparent !important;
        }
        .marketing-theme-switcher {
          display: inline-flex;
          flex: 0 0 auto;
        }
        .marketing-paper .marketing-theme-switcher .ant-btn {
          color: var(--paper-ink) !important;
          border-color: var(--paper-line) !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .marketing-paper .marketing-theme-switcher .ant-btn:hover,
        .marketing-paper .marketing-theme-switcher .ant-btn:focus-visible {
          color: var(--paper-accent) !important;
          border-color: currentColor !important;
        }
        .marketing-paper .footer {
          background: #e9e5da !important;
          border-top-color: var(--paper-line) !important;
          color: var(--paper-ink) !important;
        }
        .marketing-paper .footer-col-title,
        .marketing-paper .footer .nav-logo,
        .marketing-paper .footer .nav-logo span {
          color: var(--paper-ink) !important;
        }
        .marketing-paper .footer-link,
        .marketing-paper .footer-brand-tagline,
        .marketing-paper .footer-disclaimer,
        .marketing-paper .footer-copyright {
          color: #5d625c !important;
        }
        .marketing-paper .footer-link:hover {
          color: #3569c8 !important;
        }
        .marketing-paper .footer-divider {
          border-top-color: var(--paper-line) !important;
        }
        .marketing-paper .footer-trust-badge {
          color: #2557a3 !important;
        }
        .marketing-paper .footer-system-status > span {
          color: #4e644c !important;
          font-size: 0.75rem !important;
        }
        html[data-theme='dark'] .marketing-paper .nav-header:not(.scrolled) {
          background: rgba(21, 25, 26, 0.9) !important;
          border-bottom-color: rgba(243, 241, 233, 0.14) !important;
        }
        html[data-theme='dark'] .marketing-paper .nav-header.scrolled {
          background: rgba(21, 25, 26, 0.97) !important;
          border-bottom-color: rgba(243, 241, 233, 0.18) !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3) !important;
        }
        html[data-theme='dark'] .marketing-paper .nav-item,
        html[data-theme='dark'] .marketing-paper .mobile-menu-nav-item {
          color: #c5ccc6;
        }
        html[data-theme='dark'] .marketing-paper .mobile-menu-overlay {
          background: rgba(21, 25, 26, 0.99);
          color: var(--paper-ink);
        }
        html[data-theme='dark'] .marketing-paper .mobile-menu-nav-item:hover,
        html[data-theme='dark'] .marketing-paper .mobile-menu-nav-item.mobile-active {
          color: var(--paper-ink);
          background: rgba(145, 186, 255, 0.1);
        }
        html[data-theme='dark'] .marketing-paper .footer {
          background: #101415 !important;
        }
        html[data-theme='dark'] .marketing-paper .footer-link,
        html[data-theme='dark'] .marketing-paper .footer-brand-tagline,
        html[data-theme='dark'] .marketing-paper .footer-disclaimer,
        html[data-theme='dark'] .marketing-paper .footer-copyright {
          color: #b9c1bb !important;
        }
        html[data-theme='dark'] .marketing-paper .footer-link:hover,
        html[data-theme='dark'] .marketing-paper .footer-trust-badge {
          color: #91baff !important;
        }
        html[data-theme='dark'] .marketing-paper .footer-system-status > span {
          color: #acc99f !important;
        }
        .marketing-paper .nav-logo:focus-visible,
        .marketing-paper .mobile-menu-nav-item:focus-visible,
        .marketing-paper .footer-link-button:focus-visible,
        .marketing-paper .marketing-action-link:focus-visible {
          outline-color: var(--paper-accent);
        }
        @media (max-width: 480px) {
          .mobile-menu-overlay {
            padding-top: max(16px, env(safe-area-inset-top));
          }
        }
        @media (forced-colors: active) {
          .nav-header,
          .mobile-menu-overlay,
          .footer {
            forced-color-adjust: auto;
            border-color: CanvasText !important;
            background: Canvas !important;
          }
          .nav-item,
          .mobile-menu-nav-item,
          .footer-link,
          .paper-wordmark {
            color: CanvasText !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const trigger = mobileTriggerRef.current;
    const backgroundRegions = [
      skipLinkRef.current,
      navigationRef.current,
      mainContentRef.current,
      footerRef.current,
    ].filter((node): node is HTMLElement => Boolean(node));
    const backgroundRegionState = backgroundRegions.map(node => ({
      node,
      hadInert: node.hasAttribute('inert'),
      inert: node.getAttribute('inert'),
      ariaHidden: node.getAttribute('aria-hidden'),
    }));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
      if (event.key === 'Tab') {
        const menu = document.getElementById('marketing-mobile-menu');
        const focusable = Array.from(menu?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') || []).filter(node => !node.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.style.overflow = 'hidden';
    backgroundRegions.forEach(node => {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    });
    window.addEventListener('keydown', handleEscape);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#marketing-mobile-menu [data-mobile-menu-close]')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
      backgroundRegionState.forEach(({ node, hadInert, inert, ariaHidden }) => {
        if (hadInert) node.setAttribute('inert', inert ?? '');
        else node.removeAttribute('inert');
        if (ariaHidden === null) node.removeAttribute('aria-hidden');
        else node.setAttribute('aria-hidden', ariaHidden);
      });
      (previousFocus || trigger)?.focus();
    };
  }, [mobileMenuOpen]);

  const toggleLanguage = () => {
    setLanguage(language === 'en-US' ? 'zh-CN' : 'en-US');
  };

  const handleInternalLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    closeMobileMenu = false,
  ) => {
    const isPlainNavigation = event.button === 0
      && !event.metaKey
      && !event.ctrlKey
      && !event.shiftKey
      && !event.altKey
      && event.currentTarget.target !== '_blank';
    if (!isPlainNavigation || event.defaultPrevented) return;
    if (closeMobileMenu) setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const navItems = isPaper
    ? [
        { path: '/platform', label: t.landing.navPlatform },
        { path: '/research', label: t.landing.marketField.navResearch },
        { path: '/workflow', label: t.landing.navWorkflow },
        { path: '/examples', label: language === 'zh-CN' ? '案例' : 'Examples' },
        { path: '/data', label: language === 'zh-CN' ? '数据与方法' : 'Data & Method' },
        { path: '/security', label: t.landing.navSecurity },
      ]
    : [
        { path: '/', label: t.landing.navHome },
        { path: '/platform', label: t.landing.navPlatform },
        { path: '/workflow', label: t.landing.navWorkflow },
        { path: '/features', label: t.landing.navFeatures },
        { path: '/technology', label: t.landing.navTechnology, ariaLabel: t.landing.ariaLabelTechPage },
      ];

  return (
    <div className={`landing-container ${isPaper ? 'marketing-paper' : ''}`}>
      <a ref={skipLinkRef} className="public-skip-link" href="#public-main-content">
        {language === 'zh-CN' ? '跳到主要内容' : 'Skip to main content'}
      </a>
      {/* Navigation Bar */}
      <nav ref={navigationRef} className={`nav-header ${scrolled ? 'scrolled' : ''}`} aria-label={language === 'zh-CN' ? '主要导航' : 'Primary navigation'}>
        <Link to="/" className="nav-logo" onClick={handleInternalLinkClick} style={{ display: 'flex', alignItems: 'center', background: 'transparent' }} aria-label={language === 'zh-CN' ? 'AlphaLab 首页' : 'AlphaLab home'}>
          {isPaper ? (
            <span className="paper-wordmark">AlphaLab</span>
          ) : (
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
          )}
        </Link>
        <div className="nav-links">
          {navItems.map(item => (
            <Link
              to={item.path}
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={handleInternalLinkClick}
              aria-current={location.pathname === item.path ? 'page' : undefined}
              aria-label={item.ariaLabel}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <span className="marketing-theme-switcher"><ThemeSwitcher getPopupContainer={getMarketingThemePopupContainer} /></span>
          <Button type="text" className="marketing-language-action" onClick={toggleLanguage} style={{ color: isPaper ? undefined : '#94a3b8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'clamp(12px, 1vw, 13px)', padding: '4px 8px' }} aria-label={t.landing.ariaLabelSwitchLang}><GlobalOutlined aria-hidden="true" style={{ fontSize: 'clamp(12px, 1vw, 14px)' }} /> <span className="lang-text">{language === 'zh-CN' ? 'EN' : '中文'}</span></Button>
          <Link to="/signin" className="btn-sign-in-desktop marketing-sign-in-action marketing-action-link" style={{ color: isPaper ? undefined : '#fff', fontWeight: 600, fontSize: 'clamp(13px, 1vw, 14px)', padding: '4px 8px' }} onClick={handleInternalLinkClick} aria-label={t.landing.ariaLabelSignIn}>{t.landing.signIn}</Link>
          <Link to="/signup" className="btn-get-started btn-get-started-desktop marketing-primary-action marketing-action-link" style={{ background: isPaper ? undefined : '#1890ff', borderColor: isPaper ? undefined : '#1890ff', color: isPaper ? undefined : '#fff', fontWeight: 600, boxShadow: isPaper ? 'none' : '0 4px 12px rgba(24,144,255,0.3)', borderRadius: isPaper ? 0 : undefined }} onClick={handleInternalLinkClick} aria-label={t.landing.ariaLabelGetStarted}>{t.landing.getStarted}</Link>
          <Button ref={mobileTriggerRef} type="text" className="nav-hamburger marketing-menu-action" onClick={() => setMobileMenuOpen(true)} style={{ color: isPaper ? undefined : '#fff', fontSize: 20, padding: '4px 8px' }} aria-label={language === 'zh-CN' ? '打开导航菜单' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="marketing-mobile-menu"><MenuOutlined /></Button>
        </div>
      </nav>
      {isPaper && <div ref={progressRef} className="public-scroll-progress" aria-hidden="true" />}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" id="marketing-mobile-menu" role="dialog" aria-modal="true" aria-label={language === 'zh-CN' ? '导航菜单' : 'Navigation menu'}>
          <div className="mobile-menu-header">
            <Link to="/" className="nav-logo" style={{ cursor: 'pointer', fontSize: 'clamp(1.1rem, 1.8vw, 1.35rem)' }} onClick={event => handleInternalLinkClick(event, true)} aria-label={language === 'zh-CN' ? '返回 AlphaLab 首页' : 'Return to AlphaLab home'}>
              {isPaper ? <span className="paper-wordmark">AlphaLab</span> : <>Alpha<span>Lab</span></>}
            </Link>
            <Button data-mobile-menu-close type="text" className="marketing-close-action" onClick={() => setMobileMenuOpen(false)} style={{ color: isPaper ? undefined : '#94a3b8', fontSize: 20, padding: '4px 8px' }} aria-label={language === 'zh-CN' ? '关闭导航菜单' : 'Close menu'}><CloseOutlined /></Button>
          </div>
          <div className="mobile-menu-nav">
            {navItems.map(item => (
              <Link
                to={item.path}
                key={item.path}
                className={`mobile-menu-nav-item ${location.pathname === item.path ? 'mobile-active' : ''}`}
                onClick={event => handleInternalLinkClick(event, true)}
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mobile-menu-actions">
            <span className="marketing-theme-switcher"><ThemeSwitcher getPopupContainer={getMarketingThemePopupContainer} /></span>
            <Button type="text" className="marketing-language-action" onClick={toggleLanguage} style={{ color: isPaper ? undefined : '#94a3b8', fontWeight: 600, fontSize: '1rem', padding: '12px 16px', width: '100%', textAlign: 'left' }}>
              <GlobalOutlined style={{ marginRight: 8 }} /> {language === 'zh-CN' ? 'English' : '中文'} · {t.landing.ariaLabelSwitchLang}
            </Button>
            <Link to="/signin" className="marketing-mobile-sign-in-action marketing-action-link" onClick={event => handleInternalLinkClick(event, true)} style={{ height: 48, width: '100%', color: isPaper ? undefined : '#f1f5f9', fontWeight: 600, background: isPaper ? undefined : 'rgba(255,255,255,0.05)', border: isPaper ? undefined : '1px solid rgba(255,255,255,0.1)', borderRadius: isPaper ? 0 : 10 }}>
              {t.landing.signIn}
            </Link>
            <Link to="/signup" className="marketing-mobile-primary-action marketing-action-link" onClick={event => handleInternalLinkClick(event, true)} style={{ height: 48, width: '100%', color: isPaper ? undefined : '#fff', fontWeight: 600, background: isPaper ? undefined : '#2563eb', border: 'none', borderRadius: isPaper ? 0 : 10 }}>
              {t.landing.getStarted}
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div ref={mainContentRef} id="public-main-content" tabIndex={-1} style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {/* Footer */}
      <footer ref={footerRef} className="footer">
        <div className="footer-grid" style={{
          display: 'grid',
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
              {t.landing.footerTagline}
            </div>
          </div>

          {/* Product */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerProduct}</div>
            <Link to="/platform" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.navPlatform}</Link>
            <Link to="/workflow" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.navWorkflow}</Link>
            <Link to="/research" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.marketField.navResearch}</Link>
            <Link to="/examples" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{language === 'zh-CN' ? '研究案例' : 'Examples'}</Link>
            <Link to="/data" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{language === 'zh-CN' ? '数据与方法' : 'Data & Method'}</Link>
            <Link to="/technology" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.navTechnology}</Link>
          </div>

          {/* Trust */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerTrust}</div>
            <Link to="/security" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.navSecurity}</Link>
            <Link to="/privacy" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.footerPrivacyPolicy}</Link>
            <Link to="/terms" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{t.landing.footerTermsOfService}</Link>
            <Link to="/about" className="footer-link footer-link-button" onClick={handleInternalLinkClick}>{language === 'zh-CN' ? '关于 AlphaLab' : 'About AlphaLab'}</Link>
          </div>

          {/* Resources */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="footer-col-title" style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 14, fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{t.landing.footerResources}</div>
            <a className="footer-link" style={{ color: '#94a3b8', fontSize: '0.83rem', cursor: 'pointer', display: 'block', padding: '3px 0', textDecoration: 'none' }} href="https://github.com/Danielchen0101/Alpha_lab" target="_blank" rel="noopener noreferrer">{t.landing.footerGithub}</a>
            <div className="footer-system-status"><SystemStatusIndicator /></div>
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
