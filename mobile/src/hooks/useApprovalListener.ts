import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

/**
 * useApprovalListener
 * 
 * A background hook that listens for real-time updates to the current user's
 * driver application status. When an admin approves the application from the
 * dashboard, this listener automatically refreshes the user's session/roles
 * and switches them to the 'driver' dashboard immediately.
 */
export const useApprovalListener = () => {
    const { user, refreshSession, setActiveRole, activeRole } = useAuthStore();

    useEffect(() => {
        if (!user?.id || !supabase) return;

        // Only listen if we are NOT already acting as a driver
        if (activeRole === 'driver') return;

        console.log(`[ApprovalListener] Subscribing to driver_profiles for user: ${user.id}`);

        const channel = supabase
            .channel(`driver-approval-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for all events (UPDATE/INSERT)
                    schema: 'public',
                    table: 'driver_profiles',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload: any) => {
                    const status = payload.new?.status;
                    console.log(`[ApprovalListener] Status update detected: ${status}`);

                    if (status === 'approved') {
                        console.log('[ApprovalListener] Driver approved! Syncing permissions and switching roles...');
                        
                        // 1-second delay to ensure backend user_roles update has finished
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // 1. Refresh the session to fetch the new 'driver' role from the database
                        await refreshSession();

                        // 2. Automatically switch to the driver dashboard
                        setActiveRole('driver');

                        // 3. Automatically set the driver to 'Online' so they are ready to work
                        console.log('[ApprovalListener] Setting driver to Online status...');
                        await supabase
                            .from('driver_profiles')
                            .update({ is_online: true })
                            .eq('user_id', user.id);
                    }
                }
            )
            .subscribe();

        return () => {
            console.log('[ApprovalListener] Unsubscribing');
            supabase.removeChannel(channel);
        };
    }, [user?.id, activeRole, refreshSession, setActiveRole]);
};
