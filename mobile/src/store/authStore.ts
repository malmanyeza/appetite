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
        if (get().isRefreshing) return;
        
        try {
            set({ isRefreshing: true });
            if (!get().user) set({ loading: true });

            if (!supabase) {
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
                return;
            }

            let session = providedSession;
            if (!session) {
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) {
                    // Check for invalid refresh token and handle silently
                    if (sessionError.message?.includes('Refresh Token Not Found') || sessionError.message?.includes('Invalid Refresh Token')) {
                        console.log('[Auth] Invalid session detected, clearing auth state silently.');
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

            // Use getUser() to ensure token is valid server-side, preventing DB-wiped zombie sessions
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                // The local session is orphaned/invalidated server-side.
                await supabase.auth.signOut().catch(() => { });
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
                return;
            }

            // Fetch profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            // If profile is strictly missing (PGRST116) or deleted from database, kill the auth session.
            if ((profileError && profileError.code === 'PGRST116') || !profile) {
                await supabase.auth.signOut().catch(() => { });
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
                return;
            } else if (profileError) {
                console.error('Error fetching profile:', profileError);
            }

            // Fetch roles
            const { data: roles, error: rolesError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id);

            if (rolesError) {
                console.error('Error fetching roles:', rolesError);
            }

            const availableRoles = roles?.map((r: { role: string }) => r.role as Role) || [];

            // Default to customer if no roles found (fallback)
            let defaultRole = availableRoles.includes('customer') ? 'customer' : (availableRoles.includes('driver') ? 'driver' : null);

            if (!defaultRole) {
                console.warn('No roles found for user, defaulting to customer');
                defaultRole = 'customer';
            }

            // Restore the last active role saved natively on the device
            const savedRole = await getStoredRole();
            if (savedRole && availableRoles.includes(savedRole as Role)) {
                defaultRole = savedRole as any;
            }

            set({
                user: user,
                profile: profile || null,
                roles: availableRoles.length > 0 ? availableRoles : ['customer'],
                activeRole: defaultRole as any,
                loading: false,
                isRefreshing: false
            });
        } catch (error: any) {
            // Check for invalid refresh token during getUser or other calls
            if (error.message?.includes('Refresh Token Not Found') || error.message?.includes('Invalid Refresh Token')) {
                console.log('[Auth] Invalid refresh token in catch block, clearing auth state.');
                await supabase.auth.signOut().catch(() => {});
            } else {
                console.error('Session refresh failed:', error);
            }
            set({ user: null, profile: null, roles: [], activeRole: null, loading: false, isRefreshing: false });
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
