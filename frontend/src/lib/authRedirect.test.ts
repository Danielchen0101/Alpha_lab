import {
  getAuthRedirect,
  getEmailConfirmationRedirect,
  getOAuthSignInRedirect,
  getPasswordRecoveryRedirect,
  getPublicSiteOrigin,
} from './authRedirect';

describe('auth redirects', () => {
  const originalSiteUrl = process.env.REACT_APP_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.REACT_APP_SITE_URL;
    } else {
      process.env.REACT_APP_SITE_URL = originalSiteUrl;
    }
  });

  it('keeps callbacks on the current deployment when no canonical site is configured', () => {
    delete process.env.REACT_APP_SITE_URL;

    expect(getPublicSiteOrigin()).toBe(window.location.origin);
    expect(getEmailConfirmationRedirect()).toBe(`${window.location.origin}/auth/confirmed`);
    expect(getPasswordRecoveryRedirect()).toBe(`${window.location.origin}/reset-password`);
  });

  it('uses the configured canonical origin and strips paths and trailing slashes', () => {
    process.env.REACT_APP_SITE_URL = 'https://www.example.com/deployment/';

    expect(getPublicSiteOrigin()).toBe('https://www.example.com');
    expect(getAuthRedirect('dashboard')).toBe('https://www.example.com/dashboard');
  });

  it.each([
    ['http://localhost:3000/app', 'http://localhost:3000'],
    ['http://127.0.0.1:4173/app', 'http://127.0.0.1:4173'],
  ])('allows local HTTP development origin %s', (configured, expected) => {
    process.env.REACT_APP_SITE_URL = configured;

    expect(getPublicSiteOrigin()).toBe(expected);
  });

  it('falls back safely when the configured site URL is invalid', () => {
    process.env.REACT_APP_SITE_URL = 'ftp://example.com/callback';

    expect(getEmailConfirmationRedirect()).toBe(`${window.location.origin}/auth/confirmed`);
  });

  it.each([
    'http://example.com',
    'http://localhost.example.com',
    'https://user:password@example.com',
    ' https://example.com',
  ])('does not trust an unsafe configured site origin %s', (configured) => {
    process.env.REACT_APP_SITE_URL = configured;

    expect(getPublicSiteOrigin()).toBe(window.location.origin);
  });

  it.each([
    '//attacker.example/callback',
    '\\\\attacker.example\\callback',
    '/auth\\confirmed',
    '/auth/%5cconfirmed',
    '/auth/\u000aconfirmed',
    'https://attacker.example/callback',
  ])('rejects unsafe callback path %s', (path) => {
    process.env.REACT_APP_SITE_URL = 'https://alphalabquant.com';

    expect(() => getAuthRedirect(path)).toThrow('Unsafe authentication redirect path');
  });

  it('encodes the post-OAuth destination as a single query parameter', () => {
    process.env.REACT_APP_SITE_URL = 'https://alphalabquant.com';

    expect(getOAuthSignInRedirect('/research?mode=crypto&view=signals'))
      .toBe('https://alphalabquant.com/signin?next=%2Fresearch%3Fmode%3Dcrypto%26view%3Dsignals');
  });
});
