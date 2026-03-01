-- Geospatial Top-5 Driver Dispatch Engine

-- 1. Create the targeted dispatch table
CREATE TABLE IF NOT EXISTS public.driver_job_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, driver_id)
);

-- Enable RLS for the offers table
ALTER TABLE public.driver_job_offers ENABLE ROW LEVEL SECURITY;

-- Policy: Drivers can see their own offers
CREATE POLICY "Drivers can view targeted job offers"
ON public.driver_job_offers FOR SELECT
USING (auth.uid() = driver_id);

-- 2. Create the Trigger Function to Dispatch to Top 5 Closest Drivers
CREATE OR REPLACE FUNCTION public.trigger_dispatch_closest_drivers()
RETURNS TRIGGER AS $$
DECLARE
    r_lat DOUBLE PRECISION;
    r_lng DOUBLE PRECISION;
BEGIN
    -- Only run when status flips to 'ready_for_pickup'
    IF NEW.status = 'ready_for_pickup' AND (OLD.status IS NULL OR OLD.status != 'ready_for_pickup') THEN
        
        -- Get the restaurant coordinates
        SELECT lat, lng INTO r_lat, r_lng 
        FROM public.restaurants 
        WHERE id = NEW.restaurant_id;

        -- If restaurant has no coordinates, we just broadcast to 5 random online drivers
        IF r_lat IS NULL OR r_lng IS NULL THEN
            INSERT INTO public.driver_job_offers (order_id, driver_id)
            SELECT NEW.id, user_id FROM public.driver_profiles 
            WHERE is_online = true 
            LIMIT 5;
            RETURN NEW;
        END IF;

        -- Calculate distance using Haversine and INSERT top 5 closest online drivers
        INSERT INTO public.driver_job_offers (order_id, driver_id)
        SELECT NEW.id, dp.user_id 
        FROM public.driver_profiles dp
        WHERE dp.is_online = true 
          AND dp.lat IS NOT NULL AND dp.lng IS NOT NULL
          AND dp.last_location_update > (NOW() - INTERVAL '30 minutes') -- Ensure they aren't ghost connections
        ORDER BY 
          (6371 * acos(cos(radians(dp.lat)) * cos(radians(r_lat)) * cos(radians(r_lng) - radians(dp.lng)) + sin(radians(dp.lat)) * sin(radians(r_lat)))) ASC
        LIMIT 5;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the Trigger to the Orders table
DROP TRIGGER IF EXISTS trg_dispatch_closest_drivers ON public.orders;
CREATE TRIGGER trg_dispatch_closest_drivers
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dispatch_closest_drivers();

-- 4. Create an optimized View for the Driver App to query targeted jobs
DROP VIEW IF EXISTS public.targeted_driver_jobs;
CREATE OR REPLACE VIEW public.targeted_driver_jobs AS
SELECT 
    djo.id as offer_id,
    o.*,
    r.name as restaurant_name,
    r.suburb as restaurant_suburb,
    r.lat as restaurant_lat,
    r.lng as restaurant_lng
FROM public.driver_job_offers djo
JOIN public.orders o ON djo.order_id = o.id
JOIN public.restaurants r ON o.restaurant_id = r.id
WHERE djo.driver_id = auth.uid() 
  AND djo.status = 'pending'
  AND o.driver_id IS NULL 
  AND o.status = 'ready_for_pickup';

-- 5. Upgrade the standard Accept Order RPC to clear out offers after acceptance
CREATE OR REPLACE FUNCTION public.accept_order_safely(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order public.orders;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id AND driver_id IS NULL AND status = 'ready_for_pickup'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is no longer available or already accepted.');
    END IF;

    -- Assign driver and log acceptance
    UPDATE public.orders
    SET 
        driver_id = auth.uid(),
        status = 'picked_up', 
        updated_at = NOW()
    WHERE id = p_order_id;

    -- CASCADE REALTIME DELETE: Instantly vaporize the offer from the other 4 drivers' mobile screens!
    DELETE FROM public.driver_job_offers
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Job accepted successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
