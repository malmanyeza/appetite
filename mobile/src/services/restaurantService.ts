import { supabase } from '../lib/supabase';

/**
 * Service to handle restaurant and menu data fetching.
 * Centralizing logic here ensures that prefetching and 
 * on-demand fetching always use the same keys and filters.
 */
export const restaurantService = {
    /**
     * Fetch specific branch (location) details
     */
    getLocationDetails: async (locationId: string) => {
        const { data, error } = await supabase
            .from('restaurant_locations')
            .select('id, location_name, physical_address, lat, lng, phone, opening_hours, is_open, rating_avg, rating_count, restaurant_id')
            .eq('id', locationId)
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Fetch parent restaurant chain info
     */
    getRestaurantInfo: async (restaurantId: string) => {
        const { data, error } = await supabase
            .from('restaurants')
            .select('id, name, cover_image_url, description, categories, rating_avg')
            .eq('id', restaurantId)
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Fetch menu items available for a specific branch
     */
    getBranchMenu: async (restaurantId: string, locationId: string) => {
        // Get all items for the chain with category names
        const { data: items, error: mError } = await supabase
            .from('menu_items')
            .select('*, menu_categories(name, sort_order)')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true);
        if (mError) throw mError;

        // Get location-specific availability overrides
        const { data: availability, error: aError } = await supabase
            .from('location_menu_items')
            .select('menu_item_id, is_available')
            .eq('location_id', locationId);
        
        if (aError) throw aError;

        // Filter based on location settings and sort by category order
        const filtered = (items || []).filter((item: any) => {
            const setting = availability?.find((a: any) => a.menu_item_id === item.id);
            return setting ? setting.is_available : true;
        });

        return filtered.sort((a: any, b: any) => {
            const orderA = a.menu_categories?.sort_order ?? 999;
            const orderB = b.menu_categories?.sort_order ?? 999;
            return orderA - orderB;
        });
    },

    /**
     * Fetch promotional banners for a restaurant
     */
    getRestaurantBanners: async (restaurantId: string) => {
        const { data, error } = await supabase
            .from('restaurant_banners')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data;
    },

    /**
     * Fetch modifier groups and options for a menu item
     */
    getItemModifiers: async (menuItemId: string) => {
        const { data, error } = await supabase
            .from('menu_item_modifier_groups')
            .select('modifier_groups(*, modifier_options(*))')
            .eq('menu_item_id', menuItemId);
        if (error) throw error;
        
        // Extract and return the actual group objects
        return (data || []).map((d: any) => d.modifier_groups).filter(Boolean);
    },

    /**
     * Fetch items belonging to specific categories (used for suggested add-ons)
     */
    getItemsByCategories: async (categoryIds: string[]) => {
        if (!categoryIds || categoryIds.length === 0) return [];
        const { data, error } = await supabase
            .from('menu_items')
            .select('*, menu_categories(name)')
            .in('category_id', categoryIds)
            .eq('is_available', true);
        if (error) throw error;
        return data;
    },

    /**
     * Fetch a single menu item by ID
     */
    getMenuItem: async (itemId: string) => {
        return await supabase
            .from('menu_items')
            .select('*, menu_categories(name)')
            .eq('id', itemId)
            .single();
    }
};
