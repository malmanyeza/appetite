import { supabase } from './supabase';

export const ordersService = {
    async getRestaurantOrders(restaurantId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
        *,
        profiles:customer_id (full_name, phone),
        order_items (*)
      `)
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async updateOrderStatus(orderId: string, status: string) {
        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);
        if (error) throw error;
    },

    async getAdminOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select(`
        *,
        profiles:customer_id (full_name, phone),
        restaurants:restaurant_id (
            name,
            owner_phone
        ),
        order_items (*)
      `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }
};

export const restaurantService = {
    async getMyRestaurant(userId: string) {
        // First try restaurant_members table
        const { data: membership, error: memberError } = await supabase
            .from('restaurant_members')
            .select('restaurant_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (membership) {
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', membership.restaurant_id)
                .single();
            if (error) throw error;
            return data;
        }

        // Fallback: check if user owns a restaurant directly (for legacy data)
        const { data: directRestaurant, error: directError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('manager_id', userId)
            .maybeSingle();

        if (directRestaurant) {
            // Auto-link them into restaurant_members for future lookups
            await supabase
                .from('restaurant_members')
                .upsert({
                    user_id: userId,
                    restaurant_id: directRestaurant.id,
                    role: 'owner'
                }, { onConflict: 'user_id,restaurant_id' });
            return directRestaurant;
        }

        return null;
    },

    async getAllRestaurants() {
        // ... keeps existing logic for admin/public use
        const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    },

    async getMenu(restaurantId: string) {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('category')
            .order('name');
        if (error) throw error;
        return data;
    },

    async addMenuItem(item: any) {
        const { data, error } = await supabase
            .from('menu_items')
            .insert(item)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateMenuItem(id: string, updates: any) {
        const { data, error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteMenuItem(id: string) {
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async updateMenuAvailability(id: string, isAvailable: boolean) {
        const { error } = await supabase
            .from('menu_items')
            .update({ is_available: isAvailable })
            .eq('id', id);
        if (error) throw error;
    },

    async upsertRestaurant(restaurant: any) {
        // 1. Perform the upsert
        const { data, error } = await supabase
            .from('restaurants')
            .upsert(restaurant)
            .select()
            .single();
        if (error) throw error;

        // 2. Ensure the owner/manager is linked in restaurant_members
        // We only do this logic here if it's the dashboard creating/updating its own restaurant
        // For admin creation, we might handle it differently, but for consistency:
        if (restaurant.manager_id) {
            const { error: memberError } = await supabase
                .from('restaurant_members')
                .upsert({
                    user_id: restaurant.manager_id,
                    restaurant_id: data.id,
                    role: 'owner'
                }, { onConflict: 'user_id,restaurant_id' });

            if (memberError) console.error('Failed to update membership:', memberError);
        }

        return data;
    },

    async getLocations(restaurantId: string) {
        const { data, error } = await supabase
            .from('restaurant_locations')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async upsertLocation(location: any) {
        const { data, error } = await supabase
            .from('restaurant_locations')
            .upsert(location)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteLocation(id: string) {
        const { error } = await supabase
            .from('restaurant_locations')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getLocationAvailability(locationId: string) {
        const { data, error } = await supabase
            .from('location_menu_items')
            .select('menu_item_id, is_available')
            .eq('location_id', locationId);
        if (error) throw error;
        return data;
    },

    async updateLocationAvailability(locationId: string, menuItemId: string, isAvailable: boolean) {
        const { error } = await supabase
            .from('location_menu_items')
            .upsert({
                location_id: locationId,
                menu_item_id: menuItemId,
                is_available: isAvailable
            });
        if (error) throw error;
    },

    async getAnalytics(restaurantId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Get today's orders for revenue and count
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', today.toISOString());

        if (ordersError) throw ordersError;

        // 2. Get restaurant details for rating and prep time
        const { data: restaurant, error: restError } = await supabase
            .from('restaurants')
            .select('rating_avg, avg_prep_time')
            .eq('id', restaurantId)
            .single();

        if (restError) throw restError;

        // 3. Generate Basic Alerts
        const alerts = [];
        const pendingCount = orders.filter(o => o.status === 'pending').length;

        if (pendingCount > 0) {
            alerts.push({
                type: 'new_order',
                title: 'New Orders Waiting',
                message: `You have ${pendingCount} new ${pendingCount === 1 ? 'order' : 'orders'} waiting to be accepted.`,
                color: 'accent' // Custom tailwind color class
            });
        }

        const totalRevenue = orders.reduce((acc, order) => acc + (order.pricing?.total || 0), 0);

        return {
            todayOrders: orders.length,
            revenue: totalRevenue,
            avgPrepTime: restaurant?.avg_prep_time ? `${restaurant.avg_prep_time}m` : '0m',
            rating: restaurant?.rating_avg?.toFixed(1) || '0.0',
            alerts
        };
    },

    async uploadImage(file: File, path: string) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('restaurant-assets')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};

export const adminService = {
    async createRestaurantUser(email: string, password: string, fullName: string, phone?: string) {
        // 1. Create auth user via secure RPC
        // This bypasses the GoTrue browser block on service_role keys by doing the work inside Postgres securely.
        const { data: newUserId, error: authError } = await supabase.rpc('admin_create_user', {
            email,
            password,
            full_name: fullName,
            phone: phone || null
        });

        if (authError) throw new Error(`Auth Error: ${authError.message || authError.details}`);
        if (!newUserId) throw new Error('Failed to create user');

        return newUserId;
    },

    async getAllDrivers() {
        const { data, error } = await supabase
            .from('driver_profiles')
            .select(`
                *,
                profiles:user_id (*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform the payload to match the expected format: 
        // Profiles array where each profile contains its driver_profile as an array [0]
        return data.map((dp: any) => ({
            ...dp.profiles,
            driver_profiles: [dp]
        }));
    },

    async sendPushNotification(pushToken: string, title: string, body: string, data?: any) {
        if (!pushToken) return;
        const message = {
            to: pushToken,
            sound: 'default',
            title,
            body,
            data,
        };

        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
        } catch (error) {
            console.error('Error sending push notification', error);
        }
    },

    async updateDriverStatus(userId: string, status: string) {
        // Look up the driver's notification token before processing the event
        const { data: profile } = await supabase.from('profiles').select('expo_push_token').eq('id', userId).single();
        const pushToken = profile?.expo_push_token;

        if (status === 'rejected') {
            const { error: deleteError } = await supabase
                .from('driver_profiles')
                .delete()
                .eq('user_id', userId);

            if (deleteError) throw deleteError;

            // Ensure any accidentally granted driver role is removed
            await supabase.from('user_roles').delete().match({ user_id: userId, role: 'driver' });

            if (pushToken) {
                await this.sendPushNotification(pushToken, 'Application Update', 'Your driver application was reviewed but could not be approved at this time.');
            }
            return;
        }

        const { error } = await supabase
            .from('driver_profiles')
            .update({ status })
            .eq('user_id', userId);

        if (error) throw error;

        // Also ensure user_roles has 'driver' if approved
        if (status === 'approved') {
            await supabase.from('user_roles').upsert({ user_id: userId, role: 'driver' }, { onConflict: 'user_id, role' });
            if (pushToken) {
                await this.sendPushNotification(pushToken, 'Application Approved!', 'Welcome to the fleet! You are now officially approved to start accepting delivery orders.');
            }
        }
    },

    async assignDriver(orderId: string, driverId: string) {
        const { error } = await supabase
            .from('orders')
            .update({ driver_id: driverId, status: 'dispatched' })
            .eq('id', orderId);

        if (error) throw error;

        // Automatically dispatch a Push Notification to the target driver
        const { data: profile } = await supabase.from('profiles').select('expo_push_token').eq('id', driverId).single();
        if (profile?.expo_push_token) {
            await this.sendPushNotification(
                profile.expo_push_token,
                'New Delivery Assigned!',
                'You have a new active order securely routed to your device for pickup.'
            );
        }
    },

    async getGlobalAnalytics() {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // 1. Get all orders for revenue calculation and charting
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('pricing, created_at, status, delivered_at')
            .neq('status', 'cancelled');

        if (ordersError) throw ordersError;

        // 2. Get online restaurants
        const { count: onlineRestaurants } = await supabase
            .from('restaurants')
            .select('*', { count: 'exact', head: true })
            .eq('is_open', true);

        // 3. Get total active drivers
        const { count: activeDrivers } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'driver');

        // 4. Generate alerts (delayed orders, etc.)
        const alerts = [];
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
        const { count: delayedOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'delivered')
            .neq('status', 'cancelled')
            .lt('created_at', thirtyMinsAgo);

        if (delayedOrders && delayedOrders > 0) {
            alerts.push({
                type: 'delayed_orders',
                title: 'Delayed Orders',
                message: `${delayedOrders} orders delayed > 30 mins.`,
                color: 'red'
            });
        }

        // Calculations
        const todayOrders = orders.filter(o => new Date(o.created_at) >= startOfToday);
        
        // Exclude pending orders from actual revenue
        const finalizedOrders = orders.filter(o => o.status !== 'pending');
        const finalizedTodayOrders = todayOrders.filter(o => o.status !== 'pending');

        const todayRevenue = finalizedTodayOrders.reduce((acc, o) => acc + (o.pricing?.appetite_margin || 0), 0);
        const totalRevenue = finalizedOrders.reduce((acc, o) => acc + (o.pricing?.appetite_margin || 0), 0);

        return {
            todayOrders: todayOrders.length,
            todayRevenue,
            totalRevenue,
            allOrders: orders, // For frontend charting
            onlineRestaurants: onlineRestaurants || 0,
            activeDrivers: activeDrivers || 0,
            alerts
        };
    }
};
