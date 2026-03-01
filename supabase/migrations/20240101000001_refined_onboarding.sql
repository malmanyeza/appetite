-- Add refined onboarding fields to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS physical_address text,
ADD COLUMN IF NOT EXISTS landmark_notes text,
ADD COLUMN IF NOT EXISTS owner_phone text,
ADD COLUMN IF NOT EXISTS owner_email text,
ADD COLUMN IF NOT EXISTS days_open text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS opening_time text,
ADD COLUMN IF NOT EXISTS closing_time text,
ADD COLUMN IF NOT EXISTS avg_prep_time text,
ADD COLUMN IF NOT EXISTS payout_method text,
ADD COLUMN IF NOT EXISTS payout_number text,
ADD COLUMN IF NOT EXISTS payout_name text,
ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'appetite_delivery';

-- Rename owner_user_id to manager_id for consistency with frontend code
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='owner_user_id') THEN
    ALTER TABLE public.restaurants RENAME COLUMN owner_user_id TO manager_id;
  END IF;
END $$;

-- Update RLS policies to use manager_id
DROP POLICY IF EXISTS "Owners can manage their restaurants" ON public.restaurants;
CREATE POLICY "Owners can manage their restaurants" ON public.restaurants FOR ALL USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "Owners can manage their menu items" ON public.menu_items;
CREATE POLICY "Owners can manage their menu items" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "Restaurant owners can view restaurant orders" ON public.orders;
CREATE POLICY "Restaurant owners can view restaurant orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "Authorized parties can update order status" ON public.orders;
CREATE POLICY "Authorized parties can update order status" ON public.orders FOR UPDATE USING (
  auth.uid() = customer_id OR 
  auth.uid() = driver_id OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.manager_id = auth.uid())
);
