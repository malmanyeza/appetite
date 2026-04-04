import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('CRITICAL: Supabase environment variables are missing! The app will likely fail to load data.');
}

/**
 * Smart Chunking Storage for SecureStore
 * Bypasses the 2048 byte limit of SecureStore by splitting large strings into chunks.
 */
const CHUNK_SIZE = 2000;
const MAX_CHUNKS = 10;

const ChunkingSecureStore = {
    getItem: async (key: string) => {
        try {
            // First look for the marker/first chunk
            const firstChunk = await SecureStore.getItemAsync(key);
            if (!firstChunk) return null;

            // If it's not a chunked value, return as is
            if (!firstChunk.startsWith('__chunked:')) return firstChunk;

            // Otherwise, rebuild the string from all chunks
            const totalChunks = parseInt(firstChunk.split(':')[1], 10);
            let combined = '';
            for (let i = 0; i < totalChunks; i++) {
                const part = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
                if (part) combined += part;
            }
            return combined;
        } catch (e) {
            return null;
        }
    },
    setItem: async (key: string, value: string) => {
        try {
            // If the value is small enough, just save it normally
            if (value.length <= CHUNK_SIZE) {
                return await SecureStore.setItemAsync(key, value);
            }

            // Otherwise, split into chunks
            const chunks = [];
            for (let i = 0; i < value.length; i += CHUNK_SIZE) {
                chunks.push(value.substring(i, i + CHUNK_SIZE));
            }

            if (chunks.length > MAX_CHUNKS) {
                console.error('[Auth] Token is too large even for chunking!');
                return;
            }

            // 1. Save the individual chunks
            for (let i = 0; i < chunks.length; i++) {
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
            }

            // 2. Save a marker/header for the main key
            await SecureStore.setItemAsync(key, `__chunked:${chunks.length}`);
        } catch (e) {
            console.error('[Auth] Storage error during sign-in:', e);
        }
    },
    removeItem: async (key: string) => {
        try {
            // Check if it was a chunked value
            const marker = await SecureStore.getItemAsync(key);
            if (marker && marker.startsWith('__chunked:')) {
                const totalChunks = parseInt(marker.split(':')[1], 10);
                for (let i = 0; i < totalChunks; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
                }
            }
            await SecureStore.deleteItemAsync(key);
        } catch (e) {
            // Ignore removal errors
        }
    },
};

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
} : ChunkingSecureStore;

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

