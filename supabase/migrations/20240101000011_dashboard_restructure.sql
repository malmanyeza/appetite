-- Stage 5: Dual-Role Dashboard Architecture & Strict Isolation
begin;

-- 1. Create Restaurant Members Table
create table if not exists public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  role text check (role in ('owner', 'manager')) not null default 'manager',
  created_at timestamptz default now() not null,
  unique(user_id, restaurant_id)
);

-- Enable RLS on restaurant_members
alter table public.restaurant_members enable row level security;

-- 2. Migrate existing owner_user_id to restaurant_members
insert into public.restaurant_members (user_id, restaurant_id, role)
select owner_user_id, id, 'owner'
from public.restaurants
on conflict (user_id, restaurant_id) do nothing;

-- 3. Update RLS for Restaurants
drop policy if exists "Public can view restaurants" on public.restaurants;
drop policy if exists "Owners can manage their restaurants" on public.restaurants;

-- New Policies for Restaurants
create policy "Public can view open restaurants" 
on public.restaurants for select 
using (is_open = true);

create policy "Admins can manage all restaurants" 
on public.restaurants for all 
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "Members can view their restaurant" 
on public.restaurants for select 
using (exists (select 1 from public.restaurant_members where user_id = auth.uid() and restaurant_id = public.restaurants.id));

create policy "Owners/Managers can update their restaurant" 
on public.restaurants for update 
using (exists (select 1 from public.restaurant_members where user_id = auth.uid() and restaurant_id = public.restaurants.id));

-- 4. Update RLS for Menu Items
drop policy if exists "Public can view menu items" on public.menu_items;
drop policy if exists "Owners can manage their menu items" on public.menu_items;

create policy "Public can view available menu items" 
on public.menu_items for select 
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_open = true));

create policy "Admins can manage all menu items" 
on public.menu_items for all 
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "Members can manage their restaurant menu" 
on public.menu_items for all 
using (exists (select 1 from public.restaurant_members where user_id = auth.uid() and restaurant_id = public.menu_items.restaurant_id));

-- 5. Update RLS for Orders
drop policy if exists "Restaurant owners can view restaurant orders" on public.orders;
drop policy if exists "Authorized parties can update order status" on public.orders;

-- Unified Order Access for Administrative Roles
create policy "Admins can see everything" 
on public.orders for all 
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "Restaurant members can manage their orders" 
on public.orders for all -- Includes update for status
using (exists (select 1 from public.restaurant_members where user_id = auth.uid() and restaurant_id = public.orders.restaurant_id));

-- Maintain existing Customer/Driver policies for orders
-- Customers can already see their own, Drivers assigned to them. 

commit;
