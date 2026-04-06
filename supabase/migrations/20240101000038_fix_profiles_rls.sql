-- Migration: 20240101000038_fix_profiles_rls.sql
-- Goal: Allow Drivers and Restaurant Owners to view Customer Profiles for their active orders.

-- 1. Create a robust policy for Drivers to see THEIR customers
CREATE POLICY "Drivers can view customer profiles for assigned orders" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.customer_id = profiles.id 
    AND o.driver_id = auth.uid()
  )
);

-- 2. Create a robust policy for Restaurant Managers to see THEIR customers
CREATE POLICY "Restaurant managers can view customer profiles for their orders" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON o.restaurant_id = r.id
    WHERE o.customer_id = profiles.id 
    AND r.manager_id = auth.uid()
  )
);
