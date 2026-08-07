import { createClient } from '@supabase/supabase-js';

// Watchtower runs in one of two modes:
//  - LIVE: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set -> real auth, real data
//  - DEMO: no keys -> simulated data from src/data/, no login required
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
