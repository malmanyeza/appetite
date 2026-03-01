# Database & Security Policy

## Row Level Security (RLS)

All tables in the Appetite database have RLS enabled.

### Orders Table Policies
- `Admins can do everything`: `(SELECT * FROM profiles WHERE id = auth.uid() AND role = 'admin')`
- `Customers can view own orders`: `customer_id = auth.uid()`
- `Restaurants can view their orders`: `restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())`
- `Drivers can view available jobs`: `status = 'ready_for_pickup' OR driver_id = auth.uid()`

### Menu Items Policies
- `Public view for available items`: `is_available = true`
- `Restaurant owner can manage`: `restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())`

## Triggers

- `handle_updated_at`: Automatically updates the `updated_at` column on record modification.
- `on_auth_user_created`: (Planned) Automatically create a `profile` record when a user signs up.

## Constraints

- `orders.delivery_pin`: 4-digit code required for delivery confirmation.
- `pricing`: JSONB object containing subtotal, fees, and total for auditability.
