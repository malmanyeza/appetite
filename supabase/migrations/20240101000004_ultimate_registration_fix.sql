-- 1. Backfill profiles for all existing auth users
INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'System User')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Backfill 'restaurant' role for all existing users (defensive for registration)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'restaurant'
FROM auth.users
ON CONFLICT DO NOTHING;

-- 3. Trigger for automatic profile creation on future signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed User'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'restaurant')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Foolproof RLS for restaurants (Explicitly separate INSERT/UPDATE/SELECT)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage their restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;

-- Allow owners to insert their own restaurant
CREATE POLICY "Owners can insert own restaurant" ON public.restaurants 
FOR INSERT WITH CHECK (auth.uid() = manager_id);

-- Allow owners to update their own restaurant
CREATE POLICY "Owners can update own restaurant" ON public.restaurants 
FOR UPDATE USING (auth.uid() = manager_id);

-- Allow owners to see their own restaurant (even if is_open = false)
CREATE POLICY "Owners can see own restaurant" ON public.restaurants 
FOR SELECT USING (auth.uid() = manager_id);

-- Allow public to see open restaurants
CREATE POLICY "Public can see open restaurants" ON public.restaurants 
FOR SELECT USING (is_open = true);

-- 5. Ensure profile reading is accessible to avoid select-after-insert failures
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "All authenticated users can see profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
