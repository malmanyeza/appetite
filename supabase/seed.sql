-- Seed Data for Appetite MVP

-- Note: Profile for owner and user must be created after Supabase Auth signup.
-- This script provides sample restaurants and menu items.

-- 1. Sample Restaurant (Requires a valid owner_user_id from auth.users)
-- Usage: Replace 'OWNER_UUID_HERE' with a real user ID after signing up in the app.

/*
INSERT INTO public.profiles (id, full_name, phone)
VALUES ('OWNER_UUID_HERE', 'Tinashe Mudzviti', '+263771234567');

INSERT INTO public.user_roles (user_id, role)
VALUES ('OWNER_UUID_HERE', 'restaurant');

INSERT INTO public.restaurants (
  owner_user_id, name, description, categories, city, suburb, cover_image_url
) VALUES (
  'OWNER_UUID_HERE', 
  'The Flame Grill Harare', 
  'Authentic Zimbabwean charcoal grilled chicken and traditional sides.',
  ARRAY['Chicken', 'Grill', 'Traditional'],
  'Harare',
  'Avondale',
  'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800'
);
*/

-- Since we can't know the UUIDs, we'll provide a script that can be run after the first user signs up.
-- For now, here is the structure for menu items once a restaurant ID exists.

/*
INSERT INTO public.menu_items (restaurant_id, name, description, price, category, image_url)
VALUES 
('RESTAURANT_UUID', 'Quarter Chicken & Chips', 'Flame grilled 1/4 chicken served with crispy fries.', 6.50, 'Main', 'https://images.unsplash.com/photo-1567622411816-493526bac9ac'),
('RESTAURANT_UUID', 'Full Pack Family Meal', 'Whole chicken, large chips, and garden salad.', 22.00, 'Platters', 'https://images.unsplash.com/photo-1626082896592-249219ea287d'),
('RESTAURANT_UUID', 'Sadza with Beef Stew', 'Traditional sadza served with slow-cooked beef and greens.', 5.00, 'Traditional', 'https://images.unsplash.com/photo-1512058560366-cd2427ba5e7d'),
('RESTAURANT_UUID', 'Flame Grilled Wings (6pcs)', 'Spicy or mild wings grilled to perfection.', 4.50, 'Sides', 'https://images.unsplash.com/photo-1527477396000-e27163b481c2'),
('RESTAURANT_UUID', 'Garden Salad', 'Fresh seasonal vegetables with vinaigrette.', 3.00, 'Sides', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd'),
('RESTAURANT_UUID', 'Mazoe Orange Juice 500ml', 'Local favorite refreshing orange juice.', 1.50, 'Drinks', 'https://images.unsplash.com/photo-1600271886311-ad8d7142c92e'),
('RESTAURANT_UUID', 'Beef Burger Classic', 'Juicy beef patty with lettuce, tomato, and onion.', 7.00, 'Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd'),
('RESTAURANT_UUID', 'Chocolate Decadence Cake', 'Rich chocolate cake slice.', 4.00, 'Desserts', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587');
*/
