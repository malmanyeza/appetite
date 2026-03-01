-- Migration: Fix RLS for driver_profiles table

-- 1. Enable RLS (already enabled but just in case)
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can insert own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can update own profile" ON public.driver_profiles;

-- 3. Create policies
-- Allow drivers to view their own profile
CREATE POLICY "Drivers can view own profile" ON public.driver_profiles 
FOR SELECT USING (auth.uid() = user_id);

-- Allow drivers to insert their own profile during registration
CREATE POLICY "Drivers can insert own profile" ON public.driver_profiles 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow drivers to update their own profile (e.g., toggling online status)
CREATE POLICY "Drivers can update own profile" ON public.driver_profiles 
FOR UPDATE USING (auth.uid() = user_id);

-- 4. Allow public (specifically customers) to see driver names for tracking (via profiles join)
-- This is already covered by the policy on public.profiles:
-- "All authenticated users can see profiles"
