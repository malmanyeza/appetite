-- Initial Schema for Appetite Food Delivery

-- 1. Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  created_at timestamptz default now() not null
);

-- 2. User Roles
create table public.user_roles (
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('customer', 'driver', 'restaurant', 'admin')) not null,
  created_at timestamptz default now() not null,
  primary key (user_id, role)
);

-- 3. Addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null, -- home/work/other
  city text not null,
  suburb text not null,
  street text,
  landmark_notes text,
  lat double precision,
  lng double precision,
  is_default boolean default false not null,
  created_at timestamptz default now() not null
);

-- 4. Restaurants
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) not null,
  name text not null,
  description text,
  categories text[] default '{}'::text[] not null,
  is_open boolean default true not null,
  opening_hours text,
  city text not null,
  suburb text not null,
  lat double precision,
  lng double precision,
  delivery_radius_km numeric default 5 not null,
  rating_avg numeric default 0 not null,
  rating_count int default 0 not null,
  cover_image_url text,
  created_at timestamptz default now() not null
);

-- 5. Menu Items
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric not null,
  category text not null,
  image_url text,
  is_available boolean default true not null,
  add_ons jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null
);

-- 6. Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) not null,
  restaurant_id uuid references public.restaurants(id) not null,
  driver_id uuid references public.profiles(id),
  status text not null default 'confirmed' check (status in ('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled')),
  delivery_pin text not null,
  delivery_address_snapshot jsonb not null,
  pricing jsonb not null,
  payment jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 7. Order Items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu_items(id) not null,
  name_snapshot text not null,
  price_snapshot numeric not null,
  qty int not null check (qty > 0),
  notes text,
  selected_add_ons jsonb default '[]'::jsonb not null
);

-- 8. Driver Profiles
create table public.driver_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text,
  is_online boolean default false not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.driver_profiles enable row level security;

-- Triggers for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_orders_updated_at
before update on public.orders
for each row execute procedure public.handle_updated_at();

-- RLS Policies

-- Profiles: Users can view and update their own profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- User Roles: Users can view their own roles
create policy "Users can view own roles" on public.user_roles for select using (auth.uid() = user_id);

-- Addresses: Users can CRUD their own addresses
create policy "Users can manage own addresses" on public.addresses for all using (auth.uid() = user_id);

-- Restaurants: Everyone can view open restaurants; Owners can CRUD their own
create policy "Public can view restaurants" on public.restaurants for select using (is_open = true);
create policy "Owners can manage their restaurants" on public.restaurants for all using (auth.uid() = owner_user_id);

-- Menu Items: Everyone can view items of open restaurants; Owners can CRUD
create policy "Public can view menu items" on public.menu_items for select using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_open = true)
);
create policy "Owners can manage their menu items" on public.menu_items for all using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
);

-- Orders: 
-- Customers can view their own orders
-- Restaurant owners can view orders for their restaurant
-- Drivers can view orders assigned to them
create policy "Customers can view own orders" on public.orders for select using (auth.uid() = customer_id);
create policy "Restaurant owners can view restaurant orders" on public.orders for select using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
);
create policy "Drivers can view assigned orders" on public.orders for select using (auth.uid() = driver_id);
create policy "Customers can create orders" on public.orders for insert with check (auth.uid() = customer_id);
create policy "Authorized parties can update order status" on public.orders for update using (
  auth.uid() = customer_id OR 
  auth.uid() = driver_id OR 
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
);

-- Order Items: Viewable if you can view the order
create policy "Viewable if order viewable" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id)
);
create policy "Customers can insert order items" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
