CREATE OR REPLACE FUNCTION public.accept_order_safely(p_order_id UUID, p_driver_id UUID)
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

    -- Assign driver and log acceptance explicitly using the provided driver UUID
    UPDATE public.orders
    SET 
        driver_id = p_driver_id,
        status = 'accepted', 
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Vaporize the offer from the other 4 drivers' screens
    DELETE FROM public.driver_job_offers
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Job accepted successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
