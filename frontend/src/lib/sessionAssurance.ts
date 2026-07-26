import type { Session } from '@supabase/supabase-js';

const decodeSessionId = (accessToken: string): string | null => {
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, '=');
    const binary = globalThis.atob(base64);
    const decoded = typeof TextDecoder === 'undefined'
      ? binary
      : new TextDecoder().decode(
        Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      );
    const payload = JSON.parse(decoded) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === 'string' && payload.session_id
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
};

/**
 * Identifies the security session without changing when the same session's
 * access token is refreshed. A malformed or legacy token falls back to the
 * complete token so assurance is rechecked rather than accidentally reused.
 */
export const getSessionAssuranceKey = (session: Session | null): string | null => {
  if (!session) return null;
  const sessionId = decodeSessionId(session.access_token);
  return `${session.user.id}:${sessionId || `token:${session.access_token}`}`;
};
