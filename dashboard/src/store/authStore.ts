import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Role } from '@appetite/shared';

interface AuthState {
    user: any | null;
    profile: any | null;
    roles: Role[];
    currentRole: Role | null;
    loading: boolean;
    initialized: boolean;

    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    switchRole: (role: Role) => void;
    refreshSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    roles: [],
    currentRole: null,
    loading: true,
    initialized: false,

    signIn: async (email, password) => {
        set({ loading: true });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            set({ loading: false });
            throw error;
        }

        // Verify Dashboard Clearance
        const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.user.id);

        const availableRoles = roles?.map(r => r.role as Role) || [];
        if (!availableRoles.includes('admin') && !availableRoles.includes('restaurant')) {
            await supabase.auth.signOut();
            set({ loading: false, user: null, profile: null, roles: [], currentRole: null });
            throw new Error('Unauthorized access. This dashboard is strictly for Restaurant Partners and Admins.');
        }

        await get().refreshSession();
    },

    signUp: async (email, password, fullName) => {
        set({ loading: true });
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        });
        if (error) throw error;

        // Profiles and Roles are handled by DB triggers/policies 
        // OR we can manually insert for MVP robustness if triggers aren't reliable
        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                full_name: fullName
            });
            await supabase.from('user_roles').insert({
                user_id: data.user.id,
                role: 'restaurant'
            });
            await get().refreshSession();
        }

        set({ loading: false });
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null, roles: [], currentRole: null });
    },

    switchRole: (role) => {
        if (get().roles.includes(role)) {
            set({ currentRole: role });
        }
    },

    refreshSession: async () => {
        set({ loading: true });
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            set({ user: null, profile: null, roles: [], currentRole: null, loading: false, initialized: true });
            return;
        }

        // Use getUser() to ensure token is valid server-side, preventing DB-wiped zombie sessions
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            // Zombie session or expired
            await supabase.auth.signOut().catch(() => { });
            set({ user: null, profile: null, roles: [], currentRole: null, loading: false, initialized: true });
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

        const availableRoles = roles?.map(r => r.role as Role) || [];

        // If a malicious user bypasses signIn and hits refreshSession with a customer token:
        if (!availableRoles.includes('admin') && !availableRoles.includes('restaurant')) {
            await supabase.auth.signOut();
            set({ user: null, profile: null, roles: [], currentRole: null, loading: false, initialized: true });
            return;
        }

        set({
            user,
            profile,
            roles: availableRoles,
            currentRole: availableRoles.includes('admin') ? 'admin' : (availableRoles[0] || null),
            loading: false,
            initialized: true
        });
    }
}));
