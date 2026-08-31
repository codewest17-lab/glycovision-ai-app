import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

export async function getSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

export async function signInWithProvider(provider) {
  try {
    return await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
  } catch (error) {
    return { data: null, error };
  }
}

