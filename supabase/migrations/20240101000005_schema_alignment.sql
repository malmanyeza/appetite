-- Database Schema Alignment for Appetite Food Delivery
-- This migration ensures all missing columns are added to the restaurants table

-- 1. Ensure fulfillment_type exists
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'appetite_delivery';

-- 2. Ensure business_type exists
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'restaurant';

-- 3. Ensure owner contact fields exist
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS owner_phone text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS owner_email text;

-- 4. Ensure operational fields exist
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS physical_address text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS landmark_notes text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS days_open text[] DEFAULT '{}'::text[];
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS opening_time text DEFAULT '08:00';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS closing_time text DEFAULT '20:00';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS avg_prep_time text DEFAULT '20-30 mins';

-- 5. Ensure payout fields exist
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS payout_method text DEFAULT 'ecocash';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS payout_number text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS payout_name text;

-- 6. Ensure status and location fields exist (defensive)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS city text DEFAULT 'Harare';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS suburb text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT true;

-- 7. Reset schema cache (Internal Supabase hint)
-- Note: Running any DDL (like ADD COLUMN) automatically reloads the schema cache in most managed Supabase instances.
-- If the error persists, please click "Reload PostgREST" in the Supabase Dashboard -> Settings -> API.
