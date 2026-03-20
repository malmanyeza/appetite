import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: convert ArrayBuffer to uppercase hex string
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) throw new Error('Missing authorization token.');

    // Create an anon client just to verify the user's identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(jwt);
    if (authError || !user) throw new Error("Unauthorized: " + (authError?.message || 'No user session'));

    // Use service role key for DB operations (bypasses RLS for order creation)
    const adminClient = supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } }
        });

    const { items, address, paymentMethod, restaurantId, locationId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cart is empty or invalid.');
    }
    if (!restaurantId) throw new Error('Restaurant ID is required.');
    if (!locationId) throw new Error('Location ID is required.');
    if (!address) throw new Error('Delivery address is required.');

    // Fetch master prices to prevent tampering
    const itemIds = items.map((i: any) => i.menu_item_id || i.id);
    const { data: menuItems, error: menuError } = await adminClient
      .from('menu_items')
      .select('*')
      .in('id', itemIds);
      
    if (menuError) throw new Error('Failed to fetch menu items: ' + menuError.message);
    if (!menuItems || menuItems.length === 0) throw new Error('No valid menu items found for the given IDs.');

    let subtotal = 0;
    const finalItemsToInsert = items.map((item: any) => {
        const menuItemId = item.menu_item_id || item.id;
        const dbItem = (menuItems as any[]).find((m: any) => m.id === menuItemId);
        if (!dbItem) throw new Error(`Menu item ${menuItemId} not found in database.`);
        
        // Calculate extras price and validate them
        let extrasPrice = 0;
        const selectedExtras = item.selected_add_ons || [];
        const dbExtras = dbItem.add_ons || [];

        for (const selected of selectedExtras) {
            const masterExtra = dbExtras.find((e: any) => e.name === selected.name);
            if (!masterExtra) {
                throw new Error(`Extra "${selected.name}" is not a valid option for ${dbItem.name}.`);
            }
            // Use the price from the database, not the client
            extrasPrice += masterExtra.price;
        }

        subtotal += (dbItem.price + extrasPrice) * item.qty;
        
        return {
            menu_item_id: menuItemId,
            name_snapshot: dbItem.name,
            price_snapshot: dbItem.price,
            qty: item.qty,
            selected_add_ons: selectedExtras // Store exactly what the user picked
        };
    });

    // Fetch restaurant location and fee config
    const [restaurantRes, settingsRes] = await Promise.all([
        adminClient.from('restaurant_locations').select('lat, lng').eq('id', locationId).single(),
        adminClient.from('system_settings').select('value').eq('key', 'delivery_fee_config').single()
    ]);

    const restaurant = restaurantRes.data;
    const config = settingsRes.data?.value || { base_fee: 2.0, per_km_fee: 0.5, service_commission_pct: 20.0 };

    if (!restaurant || !restaurant.lat || !restaurant.lng) {
        throw new Error('Restaurant location not found for distance calculation.');
    }

    // Calculate Distance using native SQL function
    const { data: distanceKm, error: distError } = await adminClient.rpc('get_distance_km', {
        lat1: restaurant.lat,
        lng1: restaurant.lng,
        lat2: address.lat,
        lng2: address.lng
    });

    if (distError) console.error('Distance calculation error:', distError);

    // Apply exact same rounding logic as mobile client
    const distance = Math.round(Number(distanceKm) || 0);
    
    // 1. Customer Pricing
    const baseFee = Number(config.base_fee || 1.5);
    const perKmFee = Number(config.per_km_fee || 0.4);
    const surge = Number(config.surge_amount || 0);
    const serviceFee = Number(config.service_fee || 0.5);
    
    // Formula: Base + (PerKm * Distance) + Surge
    const deliveryFee = baseFee + (perKmFee * distance) + surge;
    
    // 2. Driver Payout
    const driverBase = Number(config.driver_base || 1.2);
    const driverPerKm = Number(config.driver_per_km || 0.3);
    const driverBonus = Number(config.driver_bonus || 0);
    
    // Formula: DriverBase + (DriverPerKm * Distance) + Bonus
    const driverEarnings = driverBase + (driverPerKm * distance) + driverBonus;
    
    // 3. Totals & Margins
    // Total = Food + Delivery + Service
    const total = subtotal + deliveryFee + serviceFee;
    
    const appetiteMargin = (deliveryFee - driverEarnings) + serviceFee;
    
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    const orderPayload = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        location_id: locationId,
        status: (paymentMethod === 'ecocash' || paymentMethod === 'card') ? 'pending' : 'confirmed',
        delivery_pin: deliveryPin,
        delivery_address_snapshot: address,
        pricing: {
            subtotal,
            delivery_fee: deliveryFee,
            service_fee: serviceFee,
            distance_km: distance,
            driver_earnings: driverEarnings,
            appetite_margin: appetiteMargin,
            surge_applied: surge,
            driver_bonus_applied: driverBonus,
            total,
            currency: 'USD'
        },
        payment: {
            method: paymentMethod || 'cod',
            status: 'pending',
            gateway_reference: null,
            poll_url: null,
            paid_at: null
        }
    };

    const { data: newOrder, error: orderError } = await adminClient
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

    if (orderError) throw new Error('Failed to create order: ' + orderError.message);

    const orderItemsPayload = finalItemsToInsert.map((i: any) => ({
        ...i,
        order_id: newOrder.id
    }));

    const { error: itemsError } = await adminClient
        .from('order_items')
        .insert(orderItemsPayload);

    if (itemsError) throw new Error('Failed to insert order items: ' + itemsError.message);

    // COD: return immediately
    if (paymentMethod === 'cod') {
        // Trigger restaurant notification - Await to ensure it completes
        console.log('Triggering restaurant notification for COD order:', newOrder.id);
        await fetch(`${supabaseUrl}/functions/v1/notify_restaurant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify(newOrder)
        }).catch(err => console.error('Notification trigger failed:', err));

        return new Response(JSON.stringify({ 
            success: true, 
            orderId: newOrder.id,
            message: "Order placed successfully for Cash on Delivery." 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PAYNOW EXPRESS: EcoCash direct payment via USSD push
    if (paymentMethod === 'ecocash') {
        const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID') || '';
        const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY') || '';

        if (!integrationId || !integrationKey) {
            return new Response(JSON.stringify({ 
                success: true, 
                orderId: newOrder.id,
                message: "Order placed. Paynow keys not configured yet."
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const phone = body.phone;
        if (!phone) throw new Error('EcoCash phone number is required.');
        
        const resultUrl = `${supabaseUrl}/functions/v1/paynow_webhook`; 
        const returnUrl = resultUrl;

        // Step 1: Build initiatetransaction form data
        const initFields: Record<string, string> = {
            resulturl: resultUrl,
            returnurl: returnUrl,
            reference: newOrder.id,
            amount: total.toFixed(2),
            id: integrationId,
            additionalinfo: 'Appetite Order',
            authemail: 'malmanyeza@gmail.com', // Must be the merchant email in Paynow Test Mode
            status: 'Message'
        };

        const initFieldOrder = ['resulturl', 'returnurl', 'reference', 'amount', 'id', 'additionalinfo', 'authemail', 'status'];
        let hashString = "";
        for (const k of initFieldOrder) {
            hashString += initFields[k];
        }
        hashString += integrationKey;

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-512', encoder.encode(hashString));
        initFields.hash = toHex(hashBuffer);

        return new Response(JSON.stringify({ 
            success: true, 
            orderId: newOrder.id,
            ecocashExpress: {
                initUrl: 'https://www.paynow.co.zw/interface/initiatetransaction',
                initFields: initFields,
                initFieldOrder: [...initFieldOrder, 'hash'],
                expressUrl: 'https://www.paynow.co.zw/interface/remotetransaction',
                phone: phone,
                method: 'ecocash'
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PAYNOW STANDARD: Visa / Mastercard via web checkout
    if (paymentMethod === 'card') {
        const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID') || '';
        const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY') || '';

        if (!integrationId || !integrationKey) {
            return new Response(JSON.stringify({ 
                success: true, 
                orderId: newOrder.id,
                message: "Order placed. Paynow keys not configured yet."
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const resultUrl = `${supabaseUrl}/functions/v1/paynow_webhook`; 
        const returnUrl = `https://appetite.delivery/payment-complete?order=${newOrder.id}`; // Custom return URL

        // Step 1: Build initiatetransaction form data
        const initFields: Record<string, string> = {
            resulturl: resultUrl,
            returnurl: returnUrl,
            reference: newOrder.id,
            amount: total.toFixed(2),
            id: integrationId,
            additionalinfo: 'Appetite Order',
            authemail: 'malmanyeza@gmail.com', // Must be the merchant email in Paynow Test Mode
            status: 'Message'
        };

        const initFieldOrder = ['resulturl', 'returnurl', 'reference', 'amount', 'id', 'additionalinfo', 'authemail', 'status'];
        let hashString = "";
        for (const k of initFieldOrder) {
            hashString += initFields[k];
        }
        hashString += integrationKey;

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-512', encoder.encode(hashString));
        initFields.hash = toHex(hashBuffer);

        return new Response(JSON.stringify({ 
            success: true, 
            orderId: newOrder.id,
            standardCheckout: {
                initUrl: 'https://www.paynow.co.zw/interface/initiatetransaction',
                initFields: initFields,
                initFieldOrder: [...initFieldOrder, 'hash']
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, orderId: newOrder.id }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('place_order error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
