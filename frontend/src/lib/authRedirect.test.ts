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

  it('falls back safely when the configured site URL is invalid', () => {
    process.env.REACT_APP_SITE_URL = 'javascript:alert(1)';

    expect(getEmailConfirmationRedirect()).toBe(`${window.location.origin}/auth/confirmed`);
  });

  it('encodes the post-OAuth destination as a single query parameter', () => {
    process.env.REACT_APP_SITE_URL = 'https://alphalabquant.com';

    expect(getOAuthSignInRedirect('/research?mode=crypto&view=signals'))
      .toBe('https://alphalabquant.com/signin?next=%2Fresearch%3Fmode%3Dcrypto%26view%3Dsignals');
  });
});
