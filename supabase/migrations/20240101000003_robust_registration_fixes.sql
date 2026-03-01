-- Trigger function to automatically create a profile and assign 'restaurant' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed User'));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'restaurant');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Ensure all necessary columns exist and are named correctly (defensive migration)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='owner_user_id') THEN
    ALTER TABLE public.restaurants RENAME COLUMN owner_user_id TO manager_id;
  END IF;
END $$;

-- Fix RLS for restaurants with explicit WITH CHECK
DROP POLICY IF EXISTS "Owners can manage their restaurants" ON public.restaurants;
CREATE POLICY "Owners can manage their restaurants" ON public.restaurants 
FOR ALL USING (auth.uid() = manager_id) 
WITH CHECK (auth.uid() = manager_id);

-- Ensure profiles and user_roles have insertion policies (though trigger usually bypasses RLS, it's safer for manual inserts)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
