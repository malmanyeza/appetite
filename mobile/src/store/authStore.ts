import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Role } from '../../../shared/src';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const setStoredRole = async (role: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('lastActiveRole', role);
    } else if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('lastActiveRole', role).catch(console.error);
    }
};

const getStoredRole = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return window.localStorage.getItem('lastActiveRole');
    } else if (Platform.OS !== 'web') {
        return await SecureStore.getItemAsync('lastActiveRole').catch(() => null);
    }
    return null;
};

const getCachedAuthData = async () => {
    if (Platform.OS === 'web') return null;
    try {
        const data = await SecureStore.getItemAsync('cached_auth_data');
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

const setCachedAuthData = async (data: any) => {
    if (Platform.OS === 'web') return;
    try {
        await SecureStore.setItemAsync('cached_auth_data', JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to cache auth data:', e);
    }
};

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
};

interface AuthState {
    user: any | null;
    profile: any | null;
    roles: Role[];
    activeRole: 'customer' | 'driver' | 'admin' | null;
    loading: boolean;
    isSigningUp: boolean;
    isRefreshing: boolean;
    pendingRedirect: string | null;

    refreshSession: (providedSession?: any) => Promise<void>;
    refreshProfile: () => Promise<void>;
    setActiveRole: (role: 'customer' | 'driver' | 'admin') => Promise<void>;
    setSigningUp: (status: boolean) => void;
    setPendingRedirect: (screen: string | null) => void;
    signOut: () => Promise<void>;
    resetPasswordForEmail: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    roles: [],
    activeRole: null,
    loading: true,
    isSigningUp: false,
    isRefreshing: false,
    pendingRedirect: null,

    refreshSession: async (providedSession?: any) => {
        // 1. Instant Transition: If a session is provided, set the user state immediately
        // This avoids the 'stuck on login screen' bug while profile data loads in background.
        if (providedSession?.user) {
            console.log('[Auth] Instant user set from provided session');
            set({ 
                user: providedSession.user,
                isSigningUp: false, // Ensure we exit sign-up mode
                loading: false
            });
        }

        // Bypass the refresh lock if a session is explicitly provided (e.g. from SIGNED_IN event)
        if (get().isRefreshing && !providedSession) {
            console.log('[Auth] Refresh already in progress, skipping background check');
            return;
        }
        
        try {
            set({ isRefreshing: true });
            
            // 2. Try to load cached data immediately to speed up splash screen exit
            if (!get().user && !providedSession) {
                const cached = await getCachedAuthData();
                if (cached) {
                    console.log('[Auth] Restoring cached session data');
                    set({ 
                        user: cached.user, 
                        profile: cached.profile, 
                        roles: cached.roles, 
                        activeRole: cached.activeRole,
                        loading: false 
                    });
                } else {
                    set({ loading: true });
                }
            }

            if (!supabase) {
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
                return;
            }

            // 3. Wrap network calls in a timeout to prevent hanging on splash screen
            const TIMEOUT_MS = 6000;

            let session = providedSession;
            if (!session) {
                const { data: { session: currentSession }, error: sessionError }: any = await withTimeout(
                    supabase.auth.getSession(),
                    TIMEOUT_MS,
                    'Session check timed out'
                );
                if (sessionError) {
                    if (sessionError.message?.includes('Refresh Token Not Found') || sessionError.message?.includes('Invalid Refresh Token')) {
                        await supabase.auth.signOut().catch(() => {});
                        set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
                        return;
                    }
                    throw sessionError;
                }
                session = currentSession;
            }

            if (!session) {
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
                return;
            }

            // 4. getUser() verifies the session with the server
            // If we just logged in (providedSession), we can skip this extra verify step for speed
            let user = session.user;
            if (!providedSession) {
                const { data: { user: verifiedUser }, error: authError }: any = await withTimeout(
                    supabase.auth.getUser(),
                    TIMEOUT_MS,
                    'User verification timed out'
                );

                if (authError || !verifiedUser) {
                    await supabase.auth.signOut().catch(() => { });
                    set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
                    return;
                }
                user = verifiedUser;
            }

            // 5. Fetch profile and roles (with retry for profile since triggers might be slow)
            let profileRes: any;
            let rolesRes: any;
            let profile: any = null;
            let roles: any = null;
            let retries = 0;
            const MAX_RETRIES = 3;

            while (retries < MAX_RETRIES) {
                const [pRes, rRes]: any[] = await Promise.all([
                    withTimeout(supabase.from('profiles').select('*').eq('id', user.id).single(), TIMEOUT_MS, 'Profile fetch timed out'),
                    withTimeout(supabase.from('user_roles').select('role').eq('user_id', user.id), TIMEOUT_MS, 'Roles fetch timed out')
                ]);
                
                profileRes = pRes;
                rolesRes = rRes;
                profile = pRes.data;
                roles = rRes.data;

                // If profile found, break
                if (profile) break;
                
                // If it's a "not found" error, wait and retry
                if (pRes.error?.code === 'PGRST116') {
                    console.log(`[Auth] Profile not found, retry ${retries + 1}/${MAX_RETRIES}...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retries++;
                } else {
                    // Other error, don't retry
                    break;
                }
            }

            if (!profile) {
                console.warn('[Auth] Profile still not found after retries. Signing out.');
                await supabase.auth.signOut().catch(() => { });
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
                return;
            }

            const availableRoles = roles?.map((r: { role: string }) => r.role as Role) || [];
            const currentRole = get().activeRole;
            const savedRole = await getStoredRole();
            
            let defaultRole: Role | null = null;
            
            // Priority:
            // 1. Saved role in SecureStore — always written by setActiveRole(), always current
            // 2. Current in-memory role  — may be from a stale cache read, checked as backup
            // 3. Fallback: driver before customer so drivers land on their dashboard by default
            if (savedRole && availableRoles.includes(savedRole as Role)) {
                defaultRole = savedRole as any;
            } else if (currentRole && availableRoles.includes(currentRole as Role)) {
                defaultRole = currentRole as any;
            } else if (availableRoles.includes('admin' as Role)) {
                defaultRole = 'admin';
            } else if (availableRoles.includes('driver' as Role)) {
                defaultRole = 'driver';
            } else if (availableRoles.includes('customer' as Role)) {
                defaultRole = 'customer';
            }

            const finalRoles = Array.from(new Set([...availableRoles, 'customer' as Role]));

            // 5. Cache the successful auth data for offline use
            await setCachedAuthData({
                user,
                profile,
                roles: finalRoles,
                activeRole: defaultRole
            });

            set({
                user: user,
                profile: profile || null,
                roles: finalRoles,
                activeRole: defaultRole as any,
                loading: false,
                isRefreshing: false,
                isSigningUp: false // Ensure we exit sign-up mode
            });
        } catch (error: any) {
            console.warn('[Auth] Session refresh failed (likely offline):', error.message);
            
            // If we're already showing something (from cache), don't wipe it out on network failure
            const state = get();
            if (state.user) {
                set({ loading: false, isRefreshing: false });
            } else {
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
            }
        }
    },

    refreshProfile: async () => {
        const userId = get().user?.id;
        if (!userId) return;

        if (!userId || !supabase) return;
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!error && data) {
            set({ profile: data });
        }
    },

    setActiveRole: async (role: 'customer' | 'driver' | 'admin') => {
        const { roles } = get();
        if (roles.includes(role)) {
            console.log(`[Auth] Switching active role to: ${role}`);
            
            // 1. PERSIST FIRST: Save to storage asynchronously but AWAIT it 
            // to ensure no race condition on re-mount refreshes.
            await setStoredRole(role);
            
            // 2. TRIGGER UI: Set memory state which triggers Navigator re-mount
            set({ activeRole: role });
        } else {
            console.warn(`[Auth] Cannot switch to role "${role}" - not found in user roles:`, roles);
            // Safety: if it's 'customer', we always allow it as a fallback
            if (role === 'customer') {
                await setStoredRole('customer');
                set({ activeRole: 'customer' });
            }
        }
    },

    setSigningUp: (status) => {
        set({ isSigningUp: status });
    },

    setPendingRedirect: (screen) => {
        set({ pendingRedirect: screen });
    },

    signOut: async () => {
        const userId = get().user?.id;
        
        // 1. Instant UI update
        set({ 
            user: null, 
            profile: null, 
            roles: [], 
            activeRole: null,
            isSigningUp: false 
        });

        // 2. Background cleanup
        if (supabase) {
            if (userId) {
                supabase
                    .from('profiles')
                    .update({ expo_push_token: null })
                    .eq('id', userId)
                    .catch(err => console.warn('[Auth] Background token clear failed:', err));
            }
            await supabase.auth.signOut().catch(() => {});
        }
    },

    resetPasswordForEmail: async (email: string) => {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://malmanyeza.github.io/appetite/reset-password',
        });
        if (error) throw error;
    },

    updatePassword: async (password: string) => {
        if (!supabase) return;
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
    },
}));
