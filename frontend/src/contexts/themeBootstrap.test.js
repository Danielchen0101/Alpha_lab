const { readFileSync } = require('fs');
const { join } = require('path');
const applyThemeBootstrap = require('../../public/theme-bootstrap.js');

const makeRoot = ({ savedMode = null, version = '2', prefersDark = false } = {}) => ({
  document,
  localStorage: {
    getItem: key => {
      if (key === 'alphaLabThemeModeVersion') return version;
      if (key === 'alphaLabThemeMode') return savedMode;
      return null;
    },
  },
  matchMedia: jest.fn(() => ({ matches: prefersDark })),
});
describe('theme bootstrap', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('applies a saved dark theme before the React application starts', () => {
    const resolved = applyThemeBootstrap(makeRoot({ savedMode: 'dark' }));
    expect(resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#121114');
  });

  it('resolves a saved system preference from the current media query', () => {
    const root = makeRoot({ savedMode: 'system', prefersDark: true });
    expect(applyThemeBootstrap(root)).toBe('dark');
    expect(root.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('falls back to light when storage access is disabled', () => {
    const root = makeRoot({ savedMode: 'dark' });
    root.localStorage.getItem = () => {
      throw new Error('storage disabled');
    };
    expect(() => applyThemeBootstrap(root)).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('is loaded as a same-origin external script allowed by the deployed CSP', () => {
    const indexHtml = readFileSync(join(process.cwd(), 'public', 'index.html'), 'utf8');
    const headers = readFileSync(join(process.cwd(), 'public', '_headers'), 'utf8');
    expect(indexHtml).toContain('<script src="%PUBLIC_URL%/theme-bootstrap.js"></script>');
    expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(headers).toMatch(/script-src 'self'/);
  });
});
