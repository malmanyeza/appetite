-- Allow authenticated users to create their own profile during signup
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow authenticated users to create their own roles during signup
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure owners can insert their own restaurants
DROP POLICY IF EXISTS "Owners can manage their restaurants" ON public.restaurants;
CREATE POLICY "Owners can manage their restaurants" ON public.restaurants FOR ALL USING (auth.uid() = manager_id) WITH CHECK (auth.uid() = manager_id);
