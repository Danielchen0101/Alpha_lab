/* eslint-disable testing-library/no-unnecessary-act -- this test uses React's low-level createRoot API */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';

jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en-US',
    setLanguage: jest.fn(),
    t: {
      landing: {
        navPlatform: 'Platform',
        navWorkflow: 'Workflow',
        navTechnology: 'Technology',
        navSecurity: 'Security',
        signIn: 'Sign in',
        getStarted: 'Get started',
        ariaLabelSwitchLang: 'Switch language',
        ariaLabelSignIn: 'Sign in',
        ariaLabelGetStarted: 'Get started',
        footerTagline: 'Research platform',
        footerProduct: 'Product',
        footerTrust: 'Trust',
        footerPrivacyPolicy: 'Privacy',
        footerTermsOfService: 'Terms',
        footerResources: 'Resources',
        footerGithub: 'GitHub',
        footerDisclaimer: 'Research only.',
        footerCopyright: '© {year} AlphaLab',
        footerSecureEnv: 'Secure environment',
        marketField: { navResearch: 'Research' },
      },
    },
  }),
}));

jest.mock('./ThemeSwitcher', () => () => <button type="button" data-testid="theme-switcher">Theme</button>);
jest.mock('./SystemStatusIndicator', () => () => <span>Operational</span>);

describe('MarketingLayout mobile navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    window.requestAnimationFrame = callback => {
      callback(0);
      return 1;
    };
    window.scrollTo = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.style.overflow = '';
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  });

  it('offers theme controls and isolates background regions while the dialog is open', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MarketingLayout tone="paper">
            <main className="public-page">Content</main>
          </MarketingLayout>
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-testid="theme-switcher"]')).toHaveLength(1);
    expect(container.querySelector('nav a.nav-logo[href="/"]')).not.toBeNull();
    expect(container.querySelector('nav a.nav-item[href="/research"]')).not.toBeNull();
    expect(container.querySelector('nav button.nav-item')).toBeNull();
    expect(container.querySelector('a.marketing-sign-in-action[href="/signin"]')).not.toBeNull();
    expect(container.querySelector('footer a.footer-link-button[href="/privacy"]')).not.toBeNull();
    expect(container.querySelector('footer button.footer-link-button')).toBeNull();

    const menuTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]');
    expect(menuTrigger).not.toBeNull();
    await act(async () => menuTrigger?.click());

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    const navigation = container.querySelector<HTMLElement>('.nav-header');
    const mainContent = container.querySelector<HTMLElement>('#public-main-content');
    const footer = container.querySelector<HTMLElement>('footer');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('inert')).toBe(false);
    [navigation, mainContent, footer].forEach(region => {
      expect(region?.hasAttribute('inert')).toBe(true);
      expect(region?.getAttribute('aria-hidden')).toBe('true');
    });
    expect(container.querySelectorAll('[data-testid="theme-switcher"]')).toHaveLength(2);

    const mobileNavigationLink = container.querySelector<HTMLAnchorElement>('.mobile-menu-nav-item[href="/platform"]');
    expect(mobileNavigationLink).not.toBeNull();
    await act(async () => mobileNavigationLink?.click());
    [navigation, mainContent, footer].forEach(region => {
      expect(region?.hasAttribute('inert')).toBe(false);
      expect(region?.hasAttribute('aria-hidden')).toBe(false);
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
