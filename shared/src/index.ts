import { z } from 'zod';

export const RoleSchema = z.enum(['customer', 'driver', 'restaurant', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const OrderStatusSchema = z.enum([
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentMethodSchema = z.enum(['cod', 'paynow', 'ecocash']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ProfileSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().min(2),
    phone: z.string(),
    created_at: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const AddressSchema = z.object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid(),
    label: z.string(), // home, work, etc.
    city: z.string(),
    suburb: z.string(),
    street: z.string().optional(),
    landmark_notes: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    is_default: z.boolean().default(false),
});
export type Address = z.infer<typeof AddressSchema>;

export const RestaurantSchema = z.object({
    id: z.string().uuid(),
    owner_user_id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    categories: z.array(z.string()).default([]),
    is_open: z.boolean().default(true),
    opening_hours: z.string().optional(),
    city: z.string(),
    suburb: z.string(),
    delivery_radius_km: z.number().default(5),
    rating_avg: z.number().default(0),
    rating_count: z.number().default(0),
    cover_image_url: z.string().url().optional().nullable(),
});
export type Restaurant = z.infer<typeof RestaurantSchema>;

export const MenuItemSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    category: z.string(),
    image_url: z.string().url().optional().nullable(),
    is_available: z.boolean().default(true),
    add_ons: z.array(z.object({
        name: z.string(),
        price: z.number(),
    })).default([]),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const OrderSchema = z.object({
    id: z.string().uuid(),
    customer_id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    driver_id: z.string().uuid().nullable(),
    status: OrderStatusSchema,
    delivery_pin: z.string().length(4),
    delivery_address_snapshot: AddressSchema,
    pricing: z.object({
        subtotal: z.number(),
        delivery_fee: z.number(),
        service_fee: z.number(),
        total: z.number(),
    }),
    payment: z.object({
        method: PaymentMethodSchema,
        status: z.enum(['pending', 'paid', 'failed']),
    }),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = z.object({
    id: z.string().uuid(),
    order_id: z.string().uuid(),
    menu_item_id: z.string().uuid(),
    name_snapshot: z.string(),
    price_snapshot: z.number(),
    qty: z.number().int().positive(),
    notes: z.string().optional(),
    selected_add_ons: z.array(z.object({
        name: z.string(),
        price: z.number(),
    })).default([]),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;
