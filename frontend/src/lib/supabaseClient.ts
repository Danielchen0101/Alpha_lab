import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { shouldAutoDetectAuthSession } from './authCallback';

const LOCAL_SUPABASE_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEVELOPMENT_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEVELOPMENT_SUPABASE_ANON_KEY = 'development-anon-key';

export const validateSupabaseBrowserConfig = (
  urlValue: string | undefined,
  anonKeyValue: string | undefined,
  environment = process.env.NODE_ENV,
): string => {
  const urlText = urlValue?.trim();
  const anonKey = anonKeyValue?.trim();
  if (!urlText || !anonKey) {
    return 'Supabase auth unavailable: REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY is missing';
  }

  try {
    const url = new URL(urlText);
    if (url.username || url.password) {
      return 'Supabase auth unavailable: REACT_APP_SUPABASE_URL must not contain credentials';
    }
    if (environment === 'production' && url.protocol !== 'https:') {
      return 'Supabase auth unavailable: production REACT_APP_SUPABASE_URL must use HTTPS';
    }
    const localHttp = url.protocol === 'http:' && LOCAL_SUPABASE_HOSTS.has(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) {
      return 'Supabase auth unavailable: REACT_APP_SUPABASE_URL must use HTTPS, except for local development';
    }
  } catch {
    return 'Supabase auth unavailable: REACT_APP_SUPABASE_URL is invalid';
  }

  return '';
};

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();
export const supabaseConfigError = validateSupabaseBrowserConfig(
  supabaseUrl,
  supabaseAnonKey,
);

if (supabaseConfigError) {
  console.error(
    `[Supabase] ${supabaseConfigError}. Set valid browser auth variables in frontend/.env`,
  );
}

const resolvedSupabaseUrl = supabaseConfigError
  ? DEVELOPMENT_SUPABASE_URL
  : supabaseUrl!;
const resolvedSupabaseAnonKey = supabaseConfigError
  ? DEVELOPMENT_SUPABASE_ANON_KEY
  : supabaseAnonKey!;
const supabaseProjectRef = new URL(resolvedSupabaseUrl).hostname.split('.')[0];
export const supabaseAuthStorageKey = `sb-${supabaseProjectRef}-auth-token`;

export const supabase: SupabaseClient = createClient(
  resolvedSupabaseUrl,
  resolvedSupabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // This is the SDK's existing default key, made explicit so a recovery
      // failure can reliably remove the current browser's persisted session.
      storageKey: supabaseAuthStorageKey,
      // Confirmation and password-recovery pages verify their own callback
      // payload before trusting a session. Other routes retain the SDK's
      // implicit-callback detection without misclassifying ordinary loads.
      detectSessionInUrl: (url, params) => shouldAutoDetectAuthSession(url, params),
      // The dedicated email callback pages intentionally redeem implicit
      // fragments themselves. Keep the browser flow explicit so a future SDK
      // default cannot introduce an automatic PKCE exchange race there.
      flowType: 'implicit',
    },
  },
);

export const clearPersistedSupabaseAuthSession = () => {
  try {
    globalThis.localStorage?.removeItem(supabaseAuthStorageKey);
    globalThis.localStorage?.removeItem(`${supabaseAuthStorageKey}-code-verifier`);
  } catch {
    // A hard navigation still clears an in-memory-only session when browser
    // storage is unavailable.
  }
};
