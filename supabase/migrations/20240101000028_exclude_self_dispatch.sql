-- Upgrade the GPS Dispatch algorithm to exclude a specific driver (usually the customer placing the order)
CREATE OR REPLACE FUNCTION public.get_closest_drivers(
    r_lat NUMERIC,
    r_lng NUMERIC,
    max_distance_km NUMERIC DEFAULT 15,
    exclude_driver_id UUID DEFAULT NULL
)
RETURNS TABLE (
    driver_id UUID,
    full_name TEXT,
    expo_push_token TEXT,
    lat NUMERIC,
    lng NUMERIC,
    distance_km NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        loc.driver_id,
        p.full_name,
        p.expo_push_token,
        loc.lat,
        loc.lng,
        public.get_distance_km(loc.lat, loc.lng, r_lat, r_lng) AS distance_km,
        loc.updated_at
    FROM 
        public.driver_locations loc
    JOIN 
        public.profiles p ON loc.driver_id = p.id
    WHERE
        loc.updated_at >= (now() - interval '6 hours')
        AND public.get_distance_km(loc.lat, loc.lng, r_lat, r_lng) <= max_distance_km
        AND (exclude_driver_id IS NULL OR loc.driver_id != exclude_driver_id)
    ORDER BY 
        distance_km ASC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;
