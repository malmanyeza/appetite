-- Migration: Ensure full cascade deletion for users
-- This allows deleting a user from auth.users to automatically clean up all associated data.

DO $$ 
BEGIN
    -- 1. Fix restaurants table (manager_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants') THEN
        ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_owner_user_id_fkey;
        ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_manager_id_fkey;
        ALTER TABLE public.restaurants 
        ADD CONSTRAINT restaurants_manager_id_fkey 
        FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- 2. Fix orders table (customer_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

        -- 3. Fix orders table (driver_id)
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- 4. Fix reviews table (customer_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_customer_id_fkey;
        ALTER TABLE public.reviews 
        ADD CONSTRAINT reviews_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

        -- 5. Fix reviews table (restaurant_id)
        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_restaurant_id_fkey;
        ALTER TABLE public.reviews 
        ADD CONSTRAINT reviews_restaurant_id_fkey 
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;

END $$;
