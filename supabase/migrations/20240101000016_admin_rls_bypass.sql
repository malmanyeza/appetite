-- 1. Create a reusable helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add an override policy for restaurants
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage all restaurants" ON public.restaurants
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Add an override policy for menu items
DROP POLICY IF EXISTS "Admins can manage all menu items" ON public.menu_items;
CREATE POLICY "Admins can manage all menu items" ON public.menu_items
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Add an override policy for restaurant members
DROP POLICY IF EXISTS "Admins can manage all restaurant members" ON public.restaurant_members;
CREATE POLICY "Admins can manage all restaurant members" ON public.restaurant_members
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
