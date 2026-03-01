-- Grant admin role to malmanyeza@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'malmanyeza@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
