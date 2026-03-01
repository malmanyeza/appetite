-- 1. Add an override policy for orders so admins can SELECT, UPDATE, etc all orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Add an override policy for order items so admins can see what was ordered
DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
CREATE POLICY "Admins can manage all order items" ON public.order_items
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
