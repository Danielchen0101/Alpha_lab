import type { EmailOtpType } from '@supabase/supabase-js';

export type AuthCallback =
  | {
      kind: 'provider_error';
      code: string;
      description: string;
    }
  | {
      kind: 'token_hash';
      tokenHash: string;
      otpType: EmailOtpType;
    }
  | {
      kind: 'code';
      code: string;
    }
  | {
      kind: 'implicit';
      accessToken: string;
      refreshToken: string;
      flowType: string;
    }
  | {
      kind: 'none';
    };

export type AuthCallbackErrorKind = 'expired' | 'network' | 'invalid';

interface AuthCallbackRedemptionOptions {
  onSlow?: () => void;
  slowAfterMs?: number;
}

const MANUALLY_HANDLED_AUTH_PATHS = new Set([
  '/auth/confirmed',
  '/reset-password',
]);

export const shouldAutoDetectAuthSession = (
  url: URL,
  params: Record<string, string> = {},
): boolean => {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (MANUALLY_HANDLED_AUTH_PATHS.has(pathname)) return false;

  // Supabase treats a custom detector's return value as authoritative. Match
  // the SDK's built-in implicit-flow detection instead of returning true for
  // every ordinary page load, which would otherwise skip persisted-session
  // recovery when no callback tokens are present.
  return Boolean(
    params.access_token
    || params.error
    || params.error_description
    || params.error_code
  );
};

const getFirst = (
  query: URLSearchParams,
  fragment: URLSearchParams,
  key: string,
): string => query.get(key) || fragment.get(key) || '';

export const parseAuthCallback = (search: string, hash: string): AuthCallback => {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));

  const errorCode = getFirst(query, fragment, 'error_code') || getFirst(query, fragment, 'error');
  const errorDescription = getFirst(query, fragment, 'error_description');
  if (errorCode || errorDescription) {
    return {
      kind: 'provider_error',
      code: errorCode,
      description: errorDescription,
    };
  }

  // Keep callback values coupled to the URL component that carried them.
  // Mixing a token from the query with a type from the fragment (or vice
  // versa) can misclassify which single-use flow is being redeemed.
  for (const source of [query, fragment]) {
    const tokenHash = source.get('token_hash') || '';
    const otpType = source.get('type') || '';
    if (tokenHash && otpType) {
      return {
        kind: 'token_hash',
        tokenHash,
        otpType: otpType as EmailOtpType,
      };
    }
  }

  const code = getFirst(query, fragment, 'code');
  if (code) {
    return { kind: 'code', code };
  }

  const accessToken = fragment.get('access_token') || '';
  const refreshToken = fragment.get('refresh_token') || '';
  if (accessToken && refreshToken) {
    return {
      kind: 'implicit',
      accessToken,
      refreshToken,
      // Implicit credentials live in the fragment, so their flow type must
      // come from the fragment too. A query-string type must not override it.
      flowType: fragment.get('type') || '',
    };
  }

  return { kind: 'none' };
};

/**
 * Defers redemption until after React has had a chance to run an effect
 * cleanup. React 18 development StrictMode cleans up its throwaway effect
 * before the next macrotask, preventing a one-time auth code from being
 * consumed by both the throwaway and committed effects.
 */
export const scheduleAuthCallbackRedemption = (
  redeem: () => void,
  options: AuthCallbackRedemptionOptions = {},
): (() => void) => {
  const timer = window.setTimeout(redeem, 0);
  const slowTimer = options.onSlow
    ? window.setTimeout(options.onSlow, options.slowAfterMs ?? 15000)
    : null;
  return () => {
    window.clearTimeout(timer);
    if (slowTimer !== null) window.clearTimeout(slowTimer);
  };
};

export const classifyAuthCallbackError = (
  codeOrMessage: string,
): AuthCallbackErrorKind => {
  const normalized = codeOrMessage.toLowerCase();
  if (
    normalized.includes('expired')
    || normalized.includes('otp_expired')
    || normalized.includes('token has expired')
  ) {
    return 'expired';
  }
  if (
    normalized.includes('network')
    || normalized.includes('fetch')
    || normalized.includes('timeout')
    || normalized.includes('temporarily unavailable')
  ) {
    return 'network';
  }
  return 'invalid';
};
