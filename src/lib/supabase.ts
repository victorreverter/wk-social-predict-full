import { createClient } from '@supabase/supabase-js';

// ── Replace these with your Supabase project credentials ──
// Go to: https://supabase.com/dashboard → your project → Settings → API
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
