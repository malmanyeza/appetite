-- 1. Ensure driver profiles have GPS fields
ALTER TABLE public.driver_profiles 
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ DEFAULT NOW();

-- 2. Create the RPC for drivers to update their live location from the mobile app
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

-- 3. Create the targeted dispatch table (Job Offers)
CREATE TABLE IF NOT EXISTS public.driver_job_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, driver_id)
);

-- 4. Enable RLS and Realtime WebSockets for the Live Feed
ALTER TABLE public.driver_job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view targeted job offers" ON public.driver_job_offers;
CREATE POLICY "Drivers can view targeted job offers"
ON public.driver_job_offers FOR SELECT
USING (auth.uid() = driver_id);

-- Explicitly enable Supabase Realtime for the job offers table
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_job_offers;

-- 5. Create the Spatial Engine Trigger
CREATE OR REPLACE FUNCTION public.trigger_dispatch_closest_drivers()
RETURNS TRIGGER AS $$
DECLARE
    r_lat DOUBLE PRECISION;
    r_lng DOUBLE PRECISION;
BEGIN
    -- Only run when status flips TO 'ready_for_pickup'
    IF NEW.status = 'ready_for_pickup' AND (OLD.status IS NULL OR OLD.status != 'ready_for_pickup') THEN
        
        -- Get the restaurant coordinates
        SELECT lat, lng INTO r_lat, r_lng 
        FROM public.restaurants 
        WHERE id = NEW.restaurant_id;

        -- Calculate distance using Haversine and push to top 5 closest online drivers
        INSERT INTO public.driver_job_offers (order_id, driver_id)
        SELECT NEW.id, dp.user_id 
        FROM public.driver_profiles dp
        WHERE dp.is_online = true 
        ORDER BY 
          (6371 * acos(cos(radians(COALESCE(dp.lat, 0))) * cos(radians(COALESCE(r_lat, 0))) * cos(radians(COALESCE(r_lng, 0)) - radians(COALESCE(dp.lng, 0))) + sin(radians(COALESCE(dp.lat, 0))) * sin(radians(COALESCE(r_lat, 0))))) ASC
        LIMIT 5;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach the Trigger
DROP TRIGGER IF EXISTS trg_dispatch_closest_drivers ON public.orders;
CREATE TRIGGER trg_dispatch_closest_drivers
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dispatch_closest_drivers();

-- 7. Upgrade Job Acceptance to clear out remaining targeted offers dynamically
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

    -- Vaporize the offer from the other 4 drivers' screens
    DELETE FROM public.driver_job_offers
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Job accepted successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create the Secure Flat View for the Mobile App
-- This view runs with system privileges, bypassing any strict RLS on the nested orders and restaurants tables!
DROP VIEW IF EXISTS public.targeted_driver_jobs;
CREATE OR REPLACE VIEW public.targeted_driver_jobs AS
SELECT 
    djo.id as offer_id,
    djo.status as offer_status,
    djo.driver_id as offer_assigned_driver_id,
    djo.created_at as offer_created_at,
    o.*,
    r.name as restaurant_name,
    r.suburb as restaurant_suburb,
    r.city as restaurant_city,
    r.landmark_notes as restaurant_landmark_notes,
    r.lat as restaurant_lat,
    r.lng as restaurant_lng,
    p.full_name as customer_name,
    p.phone as customer_phone
FROM public.driver_job_offers djo
JOIN public.orders o ON djo.order_id = o.id
JOIN public.restaurants r ON o.restaurant_id = r.id
JOIN public.profiles p ON o.customer_id = p.id;
