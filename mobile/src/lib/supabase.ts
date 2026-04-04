import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('CRITICAL: Supabase environment variables are missing! The app will likely fail to load data.');
}

const storageAdapter = Platform.OS === 'web' ? {
    getItem: (key: string) => {
        if (typeof window !== 'undefined') {
            return window.localStorage.getItem(key);
        }
        return null;
    },
    setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
        }
    },
    removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
        }
    },
} : AsyncStorage;

// Create client lazily or handle missing config gracefully
export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: storageAdapter,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    })
    : null as any; // Cast to 'any' to avoid breaking types, but we check for null in App.tsx

