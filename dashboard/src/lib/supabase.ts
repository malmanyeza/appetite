import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Ensure .env file is configured.');
}

// Regular client for normal operations (uses anon key + RLS)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

// Admin client for privileged operations (creating auth users, bypasses RLS)
// Only used by admin dashboard functions - NEVER expose in client-facing apps
export const supabaseAdmin = supabaseServiceRoleKey
    ? createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;
