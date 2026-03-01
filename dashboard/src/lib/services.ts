import { supabase, supabaseAdmin } from './supabase';

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
        profiles:customer_id (full_name),
        restaurants:restaurant_id (name)
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
            .from('profiles')
            .select(`
        *,
        driver_profiles (*)
      `)
            .eq('role', 'driver');
        if (error) throw error;
        return data;
    },

    async getGlobalAnalytics() {
        // Start of today in UTC
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Get today's orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('pricing')
            .gte('created_at', today.toISOString());

        if (ordersError) throw ordersError;

        // 2. Get online restaurants
        const { count: onlineRestaurants, error: restError } = await supabase
            .from('restaurants')
            .select('*', { count: 'exact', head: true })
            .eq('is_open', true);

        // 3. Get total active drivers
        const { count: activeDrivers, error: driverError } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'driver');

        // 4. Generate basic alerts
        const alerts = [];

        // Delayed Orders (not delivered/cancelled and older than 30 mins)
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
                message: `${delayedOrders} orders have been delayed > 30 mins.`,
                color: 'red'
            });
        }

        // Offline Restaurants
        const { count: offlineCount } = await supabase
            .from('restaurants')
            .select('*', { count: 'exact', head: true })
            .eq('is_open', false);

        if (offlineCount && offlineCount > 0) {
            alerts.push({
                type: 'store_offline',
                title: 'Stores Offline',
                message: `${offlineCount} partner restaurants are currently offline.`,
                color: 'orange'
            });
        }

        if (activeDrivers && activeDrivers < 5) {
            alerts.push({
                type: 'driver_shortage',
                title: 'Driver Shortage',
                message: `Only ${activeDrivers} drivers available. Expect high delivery times.`,
                color: 'yellow'
            });
        }

        const totalRevenue = orders.reduce((acc, order) => acc + (order.pricing?.total || 0), 0);

        return {
            todayOrders: orders.length,
            revenue: totalRevenue,
            onlineRestaurants: onlineRestaurants || 0,
            activeDrivers: activeDrivers || 0,
            alerts
        };
    }
};
