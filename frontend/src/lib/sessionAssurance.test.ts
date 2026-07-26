import type { Session } from '@supabase/supabase-js';
import { getSessionAssuranceKey } from './sessionAssurance';

const makeJwt = (sessionId: string, issuedAt: number) => {
  const encode = (value: object) => globalThis.btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({ session_id: sessionId, iat: issuedAt })}.signature`;
};

const makeSession = (accessToken: string, userId = 'user-1') => ({
  access_token: accessToken,
  user: { id: userId },
} as Session);

describe('getSessionAssuranceKey', () => {
  it('is stable when an access token refresh keeps the same security session', () => {
    const first = makeSession(makeJwt('session-1', 1));
    const refreshed = makeSession(makeJwt('session-1', 2));

    expect(getSessionAssuranceKey(first)).toBe(getSessionAssuranceKey(refreshed));
  });

  it('changes when the same user receives a new recovery or sign-in session', () => {
    const original = makeSession(makeJwt('session-1', 1));
    const recovery = makeSession(makeJwt('session-2', 2));

    expect(getSessionAssuranceKey(original)).not.toBe(getSessionAssuranceKey(recovery));
  });

  it('fails closed to the complete token when the JWT cannot be decoded', () => {
    expect(getSessionAssuranceKey(makeSession('opaque-token-1')))
      .not.toBe(getSessionAssuranceKey(makeSession('opaque-token-2')));
  });

  it('returns null when signed out', () => {
    expect(getSessionAssuranceKey(null)).toBeNull();
  });
});
