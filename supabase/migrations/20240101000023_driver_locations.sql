-- 1. Create driver_locations table for live GPS tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES public.user_roles(user_id) ON DELETE CASCADE,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    heading NUMERIC,
    speed NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Realtime triggers
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- 3. Enable RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Drivers can upsert their own location
CREATE POLICY "Drivers can update own location"
ON public.driver_locations
FOR ALL
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- Everyone (customers/admins/other drivers depending on use case) can read locations
-- We'll allow public reads so active orders can track delivery
CREATE POLICY "Public can view driver locations"
ON public.driver_locations
FOR SELECT
USING (true);

-- 5. Auto-update timestamp
CREATE OR REPLACE FUNCTION update_driver_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_driver_location_timestamp
BEFORE UPDATE ON public.driver_locations
FOR EACH ROW
EXECUTE FUNCTION update_driver_location_timestamp();
