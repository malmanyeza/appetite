-- Migration: Fix restaurant deletion cascade
-- This ensures that deleting a restaurant (or its location) cleans up all associated orders and links.

DO $$ 
BEGIN
    -- 1. Fix orders table (restaurant_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_restaurant_id_fkey;
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_restaurant_id_fkey 
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

        -- 2. Fix orders table (location_id)
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_location_id_fkey;
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_location_id_fkey 
        FOREIGN KEY (location_id) REFERENCES public.restaurant_locations(id) ON DELETE CASCADE;
    END IF;

    -- 3. Fix order_items table (menu_item_id)
    -- We want order items to stay if possible, but if the menu item is deleted via restaurant deletion, 
    -- we must cascade or set null. Since order_items references menu_items which belongs to restaurants,
    -- and restaurants deletion cascades to menu_items, we should cascade here too for a clean wipe.
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;
        ALTER TABLE public.order_items 
        ADD CONSTRAINT order_items_menu_item_id_fkey 
        FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;
    END IF;

    -- 4. Add DELETE policies
    DROP POLICY IF EXISTS "Admins and managers can delete restaurants" ON public.restaurants;
    CREATE POLICY "Admins and managers can delete restaurants" 
    ON public.restaurants FOR DELETE 
    USING (is_admin() OR auth.uid() = manager_id);

    DROP POLICY IF EXISTS "Admins can delete locations" ON public.restaurant_locations;
    CREATE POLICY "Admins can delete locations" 
    ON public.restaurant_locations FOR DELETE 
    USING (is_admin() OR EXISTS (
        SELECT 1 FROM public.restaurants r 
        WHERE r.id = restaurant_id AND r.manager_id = auth.uid()
    ));

    DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu_items;
    CREATE POLICY "Admins can delete menu items" 
    ON public.menu_items FOR DELETE 
    USING (is_admin() OR EXISTS (
        SELECT 1 FROM public.restaurants r 
        WHERE r.id = restaurant_id AND r.manager_id = auth.uid()
    ));

    DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
    CREATE POLICY "Admins can delete orders" 
    ON public.orders FOR DELETE 
    USING (is_admin());

END $$;
