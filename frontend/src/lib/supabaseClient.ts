import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { shouldAutoDetectAuthSession } from './authCallback';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const missingSupabaseEnv = !supabaseUrl || !supabaseAnonKey;
const resolvedSupabaseUrl = supabaseUrl ?? 'https://placeholder.supabase.co';
const supabaseProjectRef = new URL(resolvedSupabaseUrl).hostname.split('.')[0];
export const supabaseAuthStorageKey = `sb-${supabaseProjectRef}-auth-token`;

export const supabaseConfigError = missingSupabaseEnv
  ? 'Supabase auth unavailable: REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY is missing'
  : '';

if (missingSupabaseEnv) {
  console.error(
    '[Supabase] Missing environment variables. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend/.env'
  );
}

export const supabase: SupabaseClient = createClient(
  resolvedSupabaseUrl,
  supabaseAnonKey ?? 'placeholder-anon-key',
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
