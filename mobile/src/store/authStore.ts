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
    activeRole: 'customer' | 'driver' | null;
    loading: boolean;
    isSigningUp: boolean;
    isRefreshing: boolean;

    refreshSession: (providedSession?: any) => Promise<void>;
    refreshProfile: () => Promise<void>;
    setActiveRole: (role: 'customer' | 'driver') => void;
    setSigningUp: (status: boolean) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    roles: [],
    activeRole: null,
    loading: true,
    isSigningUp: false,
    isRefreshing: false,

    refreshSession: async (providedSession?: any) => {
        // Bypass the refresh lock if a session is explicitly provided (e.g. from SIGNED_IN event)
        if (get().isRefreshing && !providedSession) {
            console.log('[Auth] Refresh already in progress, skipping background check');
            return;
        }
        
        try {
            set({ isRefreshing: true });
            
            // 1. Try to load cached data immediately to speed up splash screen exit
            if (!get().user) {
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

            // 2. Wrap network calls in a timeout to prevent hanging on splash screen
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

            // 3. getUser() verifies the session with the server
            const { data: { user }, error: authError }: any = await withTimeout(
                supabase.auth.getUser(),
                TIMEOUT_MS,
                'User verification timed out'
            );

            if (authError || !user) {
                await supabase.auth.signOut().catch(() => { });
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
                return;
            }

            // 4. Fetch profile and roles (parallel for speed)
            const [profileRes, rolesRes]: any[] = await Promise.all([
                withTimeout(supabase.from('profiles').select('*').eq('id', user.id).single(), TIMEOUT_MS, 'Profile fetch timed out'),
                withTimeout(supabase.from('user_roles').select('role').eq('user_id', user.id), TIMEOUT_MS, 'Roles fetch timed out')
            ]);

            const profile = profileRes.data;
            const roles = rolesRes.data;

            if ((profileRes.error && profileRes.error.code === 'PGRST116') || !profile) {
                await supabase.auth.signOut().catch(() => { });
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
                return;
            }

            const availableRoles = roles?.map((r: { role: string }) => r.role as Role) || [];
            let defaultRole = availableRoles.includes('customer') ? 'customer' : (availableRoles.includes('driver') ? 'driver' : null);

            if (!defaultRole) defaultRole = 'customer';

            const savedRole = await getStoredRole();
            if (savedRole && availableRoles.includes(savedRole as Role)) {
                defaultRole = savedRole as any;
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
                isRefreshing: false
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

    setActiveRole: (role) => {
        if (get().roles.includes(role)) {
            set({ activeRole: role });
            // Save the role choice asynchronously to device storage
            setStoredRole(role);
        }
    },

    setSigningUp: (status) => {
        set({ isSigningUp: status });
    },

    signOut: async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => {});
        }
        set({ user: null, profile: null, roles: [], activeRole: null });
    },
}));
