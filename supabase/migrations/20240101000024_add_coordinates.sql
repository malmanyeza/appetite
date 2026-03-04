-- 1. Add lat/lng to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS lat NUMERIC,
ADD COLUMN IF NOT EXISTS lng NUMERIC;

-- 2. Add lat/lng to addresses
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS lat NUMERIC,
ADD COLUMN IF NOT EXISTS lng NUMERIC,
ADD COLUMN IF NOT EXISTS landmark_notes TEXT;
