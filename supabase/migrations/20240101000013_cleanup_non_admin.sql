-- Database Cleanup: Remove all users except admin (malmanyeza@gmail.com)
-- WARNING: This permanently deletes all non-admin users and all their associated data.
-- Cascading deletes will clean up profiles, user_roles, restaurant_members, 
-- restaurants (via owner_user_id), orders, order_items, addresses, driver_profiles, etc.

-- 1. Delete all order_items first (references orders)
DELETE FROM public.order_items;

-- 2. Delete all orders
DELETE FROM public.orders;

-- 3. Delete all menu_items (references restaurants)
DELETE FROM public.menu_items;

-- 4. Delete all restaurant_members
DELETE FROM public.restaurant_members;

-- 5. Delete all restaurants
DELETE FROM public.restaurants;

-- 6. Delete all addresses
DELETE FROM public.addresses;

-- 7. Delete all driver_profiles
DELETE FROM public.driver_profiles;

-- 8. Delete all user_roles except admin for malmanyeza@gmail.com
DELETE FROM public.user_roles
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'malmanyeza@gmail.com'
);

-- 9. Delete all profiles except admin
DELETE FROM public.profiles
WHERE id NOT IN (
    SELECT id FROM auth.users WHERE email = 'malmanyeza@gmail.com'
);

-- 10. Delete all auth users except admin
DELETE FROM auth.users
WHERE email != 'malmanyeza@gmail.com';
