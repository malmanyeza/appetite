-- Expand driver_profiles table for Onboarding Wizard

ALTER TABLE public.driver_profiles
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS operating_area text,
ADD COLUMN IF NOT EXISTS plate_number text,
ADD COLUMN IF NOT EXISTS emergency_contact text,
ADD COLUMN IF NOT EXISTS id_photo_url text,
ADD COLUMN IF NOT EXISTS selfie_url text,
ADD COLUMN IF NOT EXISTS ecocash_number text,
ADD COLUMN IF NOT EXISTS account_name text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;

-- Existing drivers should be grandfathered in as approved to prevent disruption
UPDATE public.driver_profiles SET status = 'approved' WHERE status IS NULL;

-- Enforce strict status enumeration limits
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_driver_status'
    ) THEN
        ALTER TABLE public.driver_profiles
        ADD CONSTRAINT check_driver_status CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;
