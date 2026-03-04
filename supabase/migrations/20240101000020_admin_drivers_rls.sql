-- 1. Add override policy for profiles so Admins can view all users
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.is_admin());

-- 2. Add override policy for driver_profiles so Admins can manage drivers
DROP POLICY IF EXISTS "Admins can manage all driver profiles" ON public.driver_profiles;
CREATE POLICY "Admins can manage all driver profiles" ON public.driver_profiles
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Add override policy for user_roles so Admins can update roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
CREATE POLICY "Admins can manage all user roles" ON public.user_roles
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
