-- Migration to support Google/Apple OAuth and Phone Number Collection
-- 1. Create a secure RPC function to check if a phone number is already registered in the profiles table
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_number text)
RETURNS boolean AS $$
DECLARE
  exists_flag boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE phone = phone_number
  ) INTO exists_flag;
  RETURN exists_flag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the handle_new_user function to copy phone numbers from auth raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    full_name = CASE WHEN profiles.full_name = 'Unnamed User' OR profiles.full_name IS NULL THEN EXCLUDED.full_name ELSE profiles.full_name END;

  -- Default fallback is restaurant to maintain legacy compatibility, but support metadata role if present
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'role', 'restaurant'))
  ON CONFLICT DO NOTHING;

  -- Ensure they also have customer role explicitly in the user_roles table if metadata specifies it
  IF new.raw_user_meta_data->>'role' = 'customer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'customer')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
