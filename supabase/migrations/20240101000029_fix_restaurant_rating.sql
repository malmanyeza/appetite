-- Upgrade the Restaurant mapping algorithm to include the missing rating_avg property required by the front-end map.
CREATE OR REPLACE FUNCTION public.get_restaurants_with_distance(
    u_lat NUMERIC,
    u_lng NUMERIC
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    cover_image_url TEXT,
    categories TEXT[],
    avg_prep_time TEXT,
    rating_avg NUMERIC,
    delivery_radius_km NUMERIC,
    is_open BOOLEAN,
    distance_km NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.description,
        r.cover_image_url,
        r.categories,
        r.avg_prep_time,
        r.rating_avg,
        r.delivery_radius_km,
        r.is_open,
        public.get_distance_km(r.lat, r.lng, u_lat, u_lng) AS distance_km
    FROM 
        public.restaurants r
    WHERE
        r.is_open = true
        AND r.lat IS NOT NULL
        AND r.lng IS NOT NULL
    ORDER BY 
        distance_km ASC;
END;
$$ LANGUAGE plpgsql;
