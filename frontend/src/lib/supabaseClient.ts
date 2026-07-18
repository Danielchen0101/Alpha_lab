import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const missingSupabaseEnv = !supabaseUrl || !supabaseAnonKey;

export const supabaseConfigError = missingSupabaseEnv
  ? 'Supabase auth unavailable: REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY is missing'
  : '';

if (missingSupabaseEnv) {
  console.error(
    '[Supabase] Missing environment variables. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend/.env'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
