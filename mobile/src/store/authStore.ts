import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Role } from '../../../shared/src';

interface AuthState {
    user: any | null;
    profile: any | null;
    roles: Role[];
    activeRole: 'customer' | 'driver' | null;
    loading: boolean;

    refreshSession: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    setActiveRole: (role: 'customer' | 'driver') => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    roles: [],
    activeRole: null,
    loading: true,

    refreshSession: async () => {
        try {
            set({ loading: true });
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (session) {
                // Fetch profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    console.error('Error fetching profile:', profileError);
                }

                // Fetch roles
                const { data: roles, error: rolesError } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id);

                if (rolesError) {
                    console.error('Error fetching roles:', rolesError);
                }

                const availableRoles = roles?.map(r => r.role as Role) || [];

                // Default to customer if no roles found (fallback)
                let defaultRole = availableRoles.includes('customer') ? 'customer' : (availableRoles.includes('driver') ? 'driver' : null);

                if (!defaultRole && session.user) {
                    console.warn('No roles found for user, defaulting to customer');
                    defaultRole = 'customer';
                }

                set({
                    user: session.user,
                    profile: profile || null,
                    roles: availableRoles.length > 0 ? availableRoles : ['customer'],
                    activeRole: defaultRole as any,
                    loading: false
                });
            } else {
                set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
            }
        } catch (error) {
            console.error('Session refresh failed:', error);
            set({ user: null, profile: null, roles: [], activeRole: null, loading: false });
        }
    },

    refreshProfile: async () => {
        const userId = get().user?.id;
        if (!userId) return;

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
        }
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null, roles: [], activeRole: null });
    },
}));
