import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const processEnv = (typeof process !== 'undefined' && process.env) || (typeof window !== 'undefined' && window.process && window.process.env) || {};

const supabaseUrl =
  processEnv.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== 'undefined' && window.NEXT_PUBLIC_SUPABASE_URL) ||
  '';
const supabaseAnonKey =
  processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && window.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
