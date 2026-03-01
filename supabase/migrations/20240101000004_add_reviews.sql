-- Migration: Add Reviews & Ratings System

-- 1. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(order_id) -- One review per order
);

-- 2. Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Public can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Customers can create their own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- 4. Function to update restaurant average rating
CREATE OR REPLACE FUNCTION public.update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.restaurants
    SET 
        rating_avg = (
            SELECT AVG(rating)::NUMERIC(3,2) 
            FROM public.reviews 
            WHERE restaurant_id = NEW.restaurant_id
        ),
        rating_count = (
            SELECT COUNT(*) 
            FROM public.reviews 
            WHERE restaurant_id = NEW.restaurant_id
        )
    WHERE id = NEW.restaurant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger for rating updates
DROP TRIGGER IF EXISTS tr_update_restaurant_rating ON public.reviews;
CREATE TRIGGER tr_update_restaurant_rating
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE PROCEDURE public.update_restaurant_rating();
