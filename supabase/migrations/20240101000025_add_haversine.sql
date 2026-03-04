-- 1. Haversine Math Function to instantly calculate Distance (km) between 2 sets of Coordinates natively in SQL
CREATE OR REPLACE FUNCTION public.get_distance_km(
    lat1 NUMERIC,
    lng1 NUMERIC,
    lat2 NUMERIC,
    lng2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    radius_earth_km CONSTANT NUMERIC := 6371;
    r_lat1 NUMERIC;
    r_lng1 NUMERIC;
    r_lat2 NUMERIC;
    r_lng2 NUMERIC;
    d_lat NUMERIC;
    d_lng NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    if lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN 999999; -- return effectively infinite distance instead of error
    END IF;

    -- Degrees to Radians
    r_lat1 := radians(lat1);
    r_lng1 := radians(lng1);
    r_lat2 := radians(lat2);
    r_lng2 := radians(lng2);

    d_lat := r_lat2 - r_lat1;
    d_lng := r_lng2 - r_lng1;

    -- Haversine formula
    a := sin(d_lat / 2)^2 + cos(r_lat1) * cos(r_lat2) * sin(d_lng / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));

    RETURN radius_earth_km * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Dispatch Function: Get Closest 5 Drivers
-- Usage: supabase.rpc('get_closest_drivers', { r_lat: -17.82, r_lng: 31.05, max_distance_km: 10 })
CREATE OR REPLACE FUNCTION public.get_closest_drivers(
    r_lat NUMERIC,
    r_lng NUMERIC,
    max_distance_km NUMERIC DEFAULT 15
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
        loc.updated_at >= (now() - interval '6 hours') -- exclude stale locations
        AND public.get_distance_km(loc.lat, loc.lng, r_lat, r_lng) <= max_distance_km
    ORDER BY 
        distance_km ASC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;
