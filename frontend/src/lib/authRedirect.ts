const ENCODED_UNSAFE_REDIRECT_INPUT = /%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/i;
const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1']);
const hasUnsafeRedirectCharacter = (value: string) => Array.from(value).some((character) => {
  const codePoint = character.charCodeAt(0);
  return codePoint <= 0x1f || codePoint === 0x7f || character === '\\';
});

export const normalizeConfiguredSiteOrigin = (value?: string): string | null => {
  if (!value || value !== value.trim() || hasUnsafeRedirectCharacter(value)) return null;

  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const localHttp = url.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const getPublicSiteOrigin = () => {
  const configuredOrigin = normalizeConfiguredSiteOrigin(process.env.REACT_APP_SITE_URL);
  if (configuredOrigin) return configuredOrigin;

  const currentOrigin = normalizeConfiguredSiteOrigin(window.location.origin);
  if (currentOrigin) return currentOrigin;

  throw new Error('Authentication redirects require HTTPS, except on localhost or 127.0.0.1');
};

export const getAuthRedirect = (path: string) => {
  if (
    !path
    || path.startsWith('//')
    || hasUnsafeRedirectCharacter(path)
    || ENCODED_UNSAFE_REDIRECT_INPUT.test(path)
    || /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    throw new Error('Unsafe authentication redirect path');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getPublicSiteOrigin();
  const redirect = new URL(normalizedPath, `${origin}/`);
  if (redirect.origin !== origin) throw new Error('Unsafe authentication redirect origin');
  return redirect.toString();
};

export const getEmailConfirmationRedirect = () => getAuthRedirect('/auth/confirmed');

export const getPasswordRecoveryRedirect = () => getAuthRedirect('/reset-password');

export const getOAuthSignInRedirect = (nextPath: string) => {
  const url = new URL(getAuthRedirect('/signin'));
  url.searchParams.set('next', nextPath);
  return url.toString();
};

