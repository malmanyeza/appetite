import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json()
    console.log('Customer Notification payload received:', payload)

    const order = payload.record || payload
    const oldOrder = payload.old_record || {}

    if (!order || !order.customer_id) {
       return new Response(JSON.stringify({ error: 'Invalid order or customer id' }), { status: 400 })
    }

    let title = 'Order Update';
    let body = `Your order status has changed to ${order.status.replace(/_/g, ' ')}.`;

    if (!oldOrder.status) {
        title = 'Order Received!';
        body = 'We have received your order and are notifying the restaurant.';
    } else if (order.status === 'confirmed' && oldOrder.status === 'pending') {
        title = 'Order Confirmed!';
        body = 'The restaurant has accepted your order and is starting to prepare it.';
    } else if (order.status === 'on_the_way' && oldOrder.status !== 'on_the_way') {
        title = 'Order Out for Delivery!';
        body = 'Your driver is on the way to your location. Get ready!';
    } else if (order.status === 'delivered') {
        title = 'Order Delivered!';
        body = 'Enjoy your meal! Please rate your experience in the app.';
    } else if (order.is_driver_at_restaurant && !oldOrder.is_driver_at_restaurant) {
        title = 'Driver Arrived at Restaurant';
        body = 'Your driver has arrived and is picking up your order.';
    } else if (order.is_driver_at_customer && !oldOrder.is_driver_at_customer) {
        title = 'Driver is Outside!';
        body = 'Your driver has arrived at your location. Please meet them at the door.';
    } else if (order.status === 'ready_for_pickup' && oldOrder.status !== 'ready_for_pickup') {
        title = 'Order Ready!';
        body = 'Your order is ready at the restaurant. Your driver will pick it up shortly.';
    }

    // 1. Fetch customer profile to get token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', order.customer_id)
      .single()

    if (profileError || !profile?.expo_push_token) {
      console.log('Customer has no push token, skipping push notification');
      return new Response(JSON.stringify({ message: 'No push token found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Prepare Expo notification
    const message = {
      to: profile.expo_push_token,
      sound: 'appetite_alert.wav',
      title: title,
      body: body,
      data: { orderId: order.id, status: order.status, type: 'ORDER_UPDATE' },
    }

    // 3. Send to Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()
    console.log('Expo notification result (Customer):', result)

    return new Response(JSON.stringify({ success: true, result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in notify_customer:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
