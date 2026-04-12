-- 1. DROP OBSOLETE TRIGGERS
DROP TRIGGER IF EXISTS trg_instant_dispatch ON orders;
DROP TRIGGER IF EXISTS trg_dispatch_closest_drivers ON orders;

-- 2. CREATE CONSOLIDATED DISPATCH FUNCTION
CREATE OR REPLACE FUNCTION public.final_dispatch_and_notify_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r_lat DOUBLE PRECISION;
  r_lng DOUBLE PRECISION;
  -- Use the verified active project key
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptc2FjdG9uaW5oZHRuZ3RseWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTk2ODksImV4cCI6MjA5MTMzNTY4OX0.FDgdXuVaDJe_yM5S9UhVB-Y-PEcbBQOm5M-ndAeJMWQ';
  active_offer_count INT;
BEGIN
  -- Trigger logic: Run for new orders or specific status changes that require dispatch
  -- Conditions: Status is confirmed/preparing/ready_for_pickup AND status changed (or new) AND fulfillment is delivery
  IF (NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup'))
     AND (OLD.status IS NULL OR (OLD.status <> NEW.status))
     AND (NEW.fulfillment_type = 'delivery' OR NEW.fulfillment_type IS NULL) THEN
     
     -- 2a. Determine Restaurant/Location Coordinates
     IF NEW.location_id IS NOT NULL THEN
        SELECT lat, lng INTO r_lat, r_lng FROM public.restaurant_locations WHERE id = NEW.location_id;
     ELSE
        SELECT lat, lng INTO r_lat, r_lng FROM public.restaurants WHERE id = NEW.restaurant_id;
     END IF;

     -- Guard: ensure we have coordinates
     IF r_lat IS NULL OR r_lng IS NULL THEN RETURN NEW; END IF;

     -- 2b. Insert Close Drivers into job offers
     -- CRITICAL CHANGE: JOIN with user_roles to ensure ONLY 'driver' role gets the offer
     INSERT INTO public.driver_job_offers (order_id, driver_id)
     SELECT 
        NEW.id, 
        dp.user_id 
     FROM public.driver_profiles dp
     JOIN public.user_roles ur ON ur.user_id = dp.user_id
     WHERE dp.is_online = true 
       AND dp.status = 'approved' 
       AND ur.role = 'driver' -- Strict Role Check
       AND dp.lat IS NOT NULL 
       AND dp.lng IS NOT NULL
     ORDER BY (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0, 
            cos(radians(dp.lat)) * cos(radians(r_lat)) * cos(radians(r_lng) - radians(dp.lng)) + 
            sin(radians(dp.lat)) * sin(radians(r_lat))
          ))
        )
     ) ASC
     LIMIT 5 
     ON CONFLICT (order_id, driver_id) DO NOTHING;

     -- 2c. Trigger Edge Function Notification
     SELECT count(*) INTO active_offer_count FROM public.driver_job_offers WHERE order_id = NEW.id;
     
     IF active_offer_count > 0 THEN
       PERFORM net.http_post(
         url := 'https://zmsactoninhdtngtlyep.supabase.co/functions/v1/notify_drivers',
         headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key),
         body := jsonb_build_object('record', row_to_json(NEW))
       );
     END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. APPLY NEW CONSOLIDATED TRIGGER
CREATE TRIGGER trg_final_dispatch_and_notify
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION final_dispatch_and_notify_trigger();

-- 4. CLEANUP EXISTING GHOST OFFERS
-- Remove any job offers assigned to users who DO NOT have the driver role
DELETE FROM public.driver_job_offers
WHERE driver_id IN (
    SELECT djo.driver_id 
    FROM public.driver_job_offers djo
    LEFT JOIN public.user_roles ur ON ur.user_id = djo.driver_id AND ur.role = 'driver'
    WHERE ur.user_id IS NULL
);

-- 5. DEPRECATE OLD FUNCTIONS
-- (Optional cleanup of the code itself)
DROP FUNCTION IF EXISTS public.unified_dispatch_and_notify_trigger();
DROP FUNCTION IF EXISTS public.trigger_dispatch_closest_drivers();
