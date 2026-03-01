-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create an RPC function that allows an admin to create a new user account safely
CREATE OR REPLACE FUNCTION public.admin_create_user(
  email text,
  password text,
  full_name text,
  phone text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
  is_admin boolean;
BEGIN
  -- 1. Security Check: Only allow existing admins to run this function
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create new user accounts.';
  END IF;

  -- 2. Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = admin_create_user.email) THEN
    RAISE EXCEPTION 'A user with this email already exists.';
  END IF;

  -- 3. Generate UUID and hash the password
  new_user_id := gen_random_uuid();
  encrypted_pw := crypt(password, gen_salt('bf'));

  -- 4. Insert into auth.users (auto-confirmed)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', email, encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', full_name),
    now(), now(), '', '', '', ''
  );

  -- 5. Insert into auth.identities
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) VALUES (
    new_user_id::text, new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, email)::jsonb, 'email', now(), now(), now(), gen_random_uuid()
  );

  -- 6. The on_auth_user_created trigger automatically inserts the initial profile and user_roles row. 
  -- We just need to update the profile to add the phone number if provided.
  IF phone IS NOT NULL THEN
    UPDATE public.profiles SET phone = admin_create_user.phone WHERE id = new_user_id;
  END IF;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
