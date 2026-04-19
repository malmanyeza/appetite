import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    console.error('⚠️ SUPABASE CONFIGURATION ERROR:', {
        url: supabaseUrl ? 'Set (masked)' : 'MISSING',
        key: supabaseAnonKey ? 'Set (masked)' : 'MISSING'
    });
} else {
    const maskedUrl = supabaseUrl.substring(0, 15) + '...';
    console.log('✅ Supabase initialized for project starts with:', maskedUrl);
}

// Regular client for normal operations (uses anon key + RLS)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
