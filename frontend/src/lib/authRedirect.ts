const normalizeConfiguredSiteOrigin = (value?: string): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const getPublicSiteOrigin = () => (
  normalizeConfiguredSiteOrigin(process.env.REACT_APP_SITE_URL)
  || window.location.origin
);

export const getAuthRedirect = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${getPublicSiteOrigin()}/`).toString();
};

export const getEmailConfirmationRedirect = () => getAuthRedirect('/auth/confirmed');

export const getPasswordRecoveryRedirect = () => getAuthRedirect('/reset-password');

export const getOAuthSignInRedirect = (nextPath: string) => {
  const url = new URL(getAuthRedirect('/signin'));
  url.searchParams.set('next', nextPath);
  return url.toString();
};

