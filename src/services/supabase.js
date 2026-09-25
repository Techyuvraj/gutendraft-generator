import { createClient } from '@supabase/supabase-js';

/*
 * The anon (publishable) key is designed to ship in browser code: it only
 * grants what the row-level-security policies in supabase/schema.sql allow,
 * which is a signed-in user reading and writing their own rows.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    : null;
