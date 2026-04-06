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
    console.log('Driver Notification payload received:', payload)

    // The payload usually contains a 'record' from a Postgres hook or the full object
    const orderRecord = payload.record || payload

    // 1. STATUS CHECK - Now including 'preparing' as requested
    const allowedStatuses = ['confirmed', 'preparing', 'ready_for_pickup'];
    if (!orderRecord || !allowedStatuses.includes(orderRecord.status)) {
      return new Response(JSON.stringify({ 
        message: `Ignored: Status '${orderRecord?.status}' does not trigger broad driver notification` 
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Ignore pickups for drivers
    if (orderRecord.fulfillment_type === 'pickup') {
      return new Response(JSON.stringify({ message: "Ignored fulfillment: pickup" }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. FETCH ENHANCED DATA (Restaurant name, specialized pricing)
    // We fetch again to ensure we have the most up-to-date data for the notification body
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, status, pricing, restaurants (name, suburb), delivery_address_snapshot
      `)
      .eq('id', orderRecord.id)
      .single()

    if (orderError) {
      console.error('Error fetching fresh order data:', orderError)
      // Fallback to record data if the select fails
    }

    const finalData = orderData || orderRecord;
    const pricing = finalData.pricing || {};
    const restaurant = finalData.restaurants || {};
    
    const restaurantName = restaurant.name || 'New Job';
    const earnings = typeof pricing.driver_earnings === 'number' ? pricing.driver_earnings.toFixed(2) : '0.00';
    const distance = typeof pricing.distance_km === 'number' ? pricing.distance_km.toFixed(1) : '?';
    const deliverySuburb = finalData.delivery_address_snapshot?.suburb || 'Customer';

    const title = `New Job Available: $${earnings} 🛵`;
    const body = `${restaurantName} ➔ ${deliverySuburb} (${distance}km). Tap to accept!`;

    // 3. FETCH TARGETED DRIVERS (Those with active job offers)
    const { data: jobOffers, error: offersError } = await supabase
      .from('driver_job_offers')
      .select(`profiles!inner (expo_push_token)`)
      .eq('order_id', orderRecord.id)

    if (offersError) throw offersError

    const tokens = (jobOffers || [])
        .map(h => (h.profiles as any)?.expo_push_token)
        .filter(t => !!t)

    console.log(`Sending to ${tokens.length} target drivers.`);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens found for targeted drivers' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. PREPARE EXPO PUSH (High Priority + Custom Alert Sound)
    const messages = tokens.map(token => ({
      to: token,
      sound: 'appetite_alert.wav',
      title: title,
      body: body,
      priority: 'high',
      channelId: 'job-notifications',
      data: { 
        orderId: orderRecord.id, 
        type: 'NEW_JOB', 
        status: orderRecord.status
      },
    }))

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    const result = await expoResponse.json()
    console.log('Expo Result:', result)

    return new Response(JSON.stringify({ success: true, result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('CRITICAL ERROR in notify_drivers:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
