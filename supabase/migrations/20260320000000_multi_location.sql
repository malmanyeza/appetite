-- Migration: Multi-Location Support
-- Create restaurant_locations table
CREATE TABLE IF NOT EXISTS public.restaurant_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  location_name text NOT NULL,
  city text NOT NULL,
  suburb text NOT NULL,
  physical_address text,
  landmark_notes text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  phone text,
  email text,
  is_open boolean DEFAULT true NOT NULL,
  opening_hours text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on restaurant_locations
ALTER TABLE public.restaurant_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_locations
CREATE POLICY "Public can view locations" ON public.restaurant_locations FOR SELECT USING (true);
CREATE POLICY "Owners can manage their locations" ON public.restaurant_locations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid())
);

-- Create location_menu_items table
CREATE TABLE IF NOT EXISTS public.location_menu_items (
  location_id uuid REFERENCES public.restaurant_locations(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  is_available boolean DEFAULT true NOT NULL,
  PRIMARY KEY (location_id, menu_item_id)
);

-- Enable RLS on location_menu_items
ALTER TABLE public.location_menu_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_menu_items
CREATE POLICY "Public can view location menu items" ON public.location_menu_items FOR SELECT USING (true);
CREATE POLICY "Owners can manage location menu items" ON public.location_menu_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_locations rl
    JOIN public.restaurants r ON rl.restaurant_id = r.id
    WHERE rl.id = location_id AND r.owner_user_id = auth.uid()
  )
);

-- Update orders table to include location_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.restaurant_locations(id);

-- Migrate existing restaurant data to locations
DO $$
DECLARE
    r RECORD;
    new_loc_id UUID;
BEGIN
    FOR r IN SELECT * FROM public.restaurants LOOP
        -- Insert a default "Main Branch" for each restaurant if it doesn't have one
        IF NOT EXISTS (SELECT 1 FROM public.restaurant_locations WHERE restaurant_id = r.id) THEN
            INSERT INTO public.restaurant_locations (
                restaurant_id, 
                location_name, 
                city, 
                suburb, 
                lat, 
                lng, 
                is_open, 
                opening_hours
            ) VALUES (
                r.id, 
                'Main Branch', 
                r.city, 
                r.suburb, 
                COALESCE(r.lat, 0), 
                COALESCE(r.lng, 0), 
                r.is_open, 
                r.opening_hours
            ) RETURNING id INTO new_loc_id;

            -- Link existing orders to this new location
            UPDATE public.orders SET location_id = new_loc_id WHERE restaurant_id = r.id AND location_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- Update get_restaurants_with_distance RPC to use locations
CREATE OR REPLACE FUNCTION public.get_restaurants_with_distance(
    u_lat NUMERIC,
    u_lng NUMERIC
)
RETURNS TABLE (
    id UUID, -- This is now the location_id
    restaurant_id UUID,
    name TEXT,
    description TEXT,
    cover_image_url TEXT,
    categories TEXT[],
    avg_prep_time TEXT,
    delivery_radius_km NUMERIC,
    is_open BOOLEAN,
    distance_km NUMERIC,
    suburb TEXT,
    city TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rl.id as id,
        r.id as restaurant_id,
        r.name,
        r.description,
        r.cover_image_url,
        r.categories,
        r.avg_prep_time,
        r.delivery_radius_km,
        rl.is_open,
        public.get_distance_km(rl.lat, rl.lng, u_lat, u_lng) AS distance_km,
        rl.suburb,
        rl.city
    FROM 
        public.restaurant_locations rl
    JOIN
        public.restaurants r ON rl.restaurant_id = r.id
    WHERE
        rl.is_open = true
        AND rl.lat IS NOT NULL
        AND rl.lng IS NOT NULL
    ORDER BY 
        distance_km ASC;
END;
$$ LANGUAGE plpgsql;
