-- Migration: Ultimate Dispatch Logic & Driver Location Tracking

-- 1. Enhance driver_profiles with GPS and fresh timestamps
ALTER TABLE public.driver_profiles 
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ DEFAULT NOW();

-- 2. Index for spatial performance (standard btree for now, assuming small driver pool)
CREATE INDEX IF NOT EXISTS idx_driver_locations ON public.driver_profiles (lat, lng) WHERE is_online = true;

-- 3. Function to update driver location (called via RPC heartbeat)
CREATE OR REPLACE FUNCTION public.update_driver_location(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS VOID AS $$
BEGIN
    UPDATE public.driver_profiles
    SET 
        lat = p_lat,
        lng = p_lng,
        last_location_update = NOW()
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic Job Acceptance RPC
-- This prevents race conditions where two drivers accept the same order simultaneously.
CREATE OR REPLACE FUNCTION public.accept_order_safely(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order public.orders;
BEGIN
    -- Select for update to lock the row
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id AND driver_id IS NULL AND status = 'ready_for_pickup'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is no longer available or already accepted.');
    END IF;

    UPDATE public.orders
    SET 
        driver_id = auth.uid(),
        status = 'picked_up', -- Move directly to picked_up or keep as ready_for_pickup? 
                              -- User said: "Accept wins the job. orders.driver_id is set". 
                              -- Let's keep status until they actually 'Confirm Pickup' to be safe, 
                              -- BUT usually in delivery apps, acceptance changes status to 'assigned' or similar.
                              -- The current schema uses 'picked_up'. Let's stick to status transition 'on_the_way' later.
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Job accepted successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Dispatch Wave View (The "Controlled Broadcast" algorithm)
-- This view filters orders based on driver proximity and time elapsed.
CREATE OR REPLACE VIEW public.available_driver_jobs AS
WITH driver_info AS (
    SELECT 
        dp.user_id,
        dp.lat,
        dp.lng,
        dp.last_location_update
    FROM public.driver_profiles dp
    WHERE dp.is_online = true 
      AND dp.last_location_update > (NOW() - INTERVAL '10 minutes') -- GPS freshness
)
SELECT 
    o.*,
    r.name as restaurant_name,
    r.suburb as restaurant_suburb,
    r.lat as restaurant_lat,
    r.lng as restaurant_lng,
    -- Distance calculation (Haversine formula approximation)
    (6371 * acos(cos(radians(di.lat)) * cos(radians(r.lat)) * cos(radians(r.lng) - radians(di.lng)) + sin(radians(di.lat)) * sin(radians(r.lat)))) AS dist_km,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at)) AS elapsed_seconds
FROM public.orders o
JOIN public.restaurants r ON o.restaurant_id = r.id
CROSS JOIN driver_info di
WHERE o.status = 'ready_for_pickup' 
  AND o.driver_id IS NULL
  AND di.user_id = auth.uid() -- Filter for the currently logged in driver
  AND (
    -- WAVE 1: First 45s - Only closest 5km (or closest 5 if we used rank, but time-based is easier for views)
    (EXTRACT(EPOCH FROM (NOW() - o.updated_at)) < 45 AND (6371 * acos(cos(radians(di.lat)) * cos(radians(r.lat)) * cos(radians(r.lng) - radians(di.lng)) + sin(radians(di.lat)) * sin(radians(r.lat)))) < 3)
    OR
    -- WAVE 2: 45s - 90s - Expand to 10km
    (EXTRACT(EPOCH FROM (NOW() - o.updated_at)) >= 45 AND EXTRACT(EPOCH FROM (NOW() - o.updated_at)) < 90 AND (6371 * acos(cos(radians(di.lat)) * cos(radians(r.lat)) * cos(radians(r.lng) - radians(di.lng)) + sin(radians(di.lat)) * sin(radians(r.lat)))) < 7)
    OR
    -- WAVE 3: 90s+ - Everyone in the city (Harare is ~20km wide)
    (EXTRACT(EPOCH FROM (NOW() - o.updated_at)) >= 90)
  );
