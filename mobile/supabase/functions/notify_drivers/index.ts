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

    // The payload will contain the order object
    const orderRecord = payload.record || payload

    if (!orderRecord || orderRecord.status !== 'ready_for_pickup') {
      return new Response(JSON.stringify({ message: `Ignored: Order status '${orderRecord.status}' does not trigger broad driver notification` }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch extensive order details (Restaurant, Destination)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        delivery_address_snapshot,
        restaurants (
          name,
          suburb
        )
      `)
      .eq('id', orderRecord.id)
      .single()

    if (orderError || !order) {
      console.error('Error fetching full order details:', orderError)
      throw new Error('Could not fetch order context for notification')
    }

    const restaurantName = (order.restaurants as any)?.name || 'Restaurant'
    const restaurantSuburb = (order.restaurants as any)?.suburb || ''
    const destinationSuburb = (order.delivery_address_snapshot as any)?.suburb || 'Destination'

    // Construct descriptive message
    const title = 'New Delivery Opportunity';
    const body = `There is an order from ${restaurantName}${restaurantSuburb ? ` (${restaurantSuburb})` : ''} to ${destinationSuburb}.`;

    console.log('Constructed Notification Body:', body);

    // 2. Fetch drivers assigned to this order via job offers
    console.log('Fetching job offers for order:', order.id);
    const { data: jobOffers, error: offersError } = await supabase
      .from('driver_job_offers')
      .select(`
        driver_id,
        profiles!inner (
          expo_push_token
        )
      `)
      .eq('order_id', order.id)

    if (offersError) {
      console.error('Error fetching job offers:', offersError)
      throw offersError
    }

    const validOffers = (jobOffers || []).filter(h => (h.profiles as any)?.expo_push_token)
    console.log(`Found ${validOffers.length} valid drivers with tokens for this order.`);

    if (validOffers.length === 0) {
      console.log('No targeted drivers found for order:', order.id)
      return new Response(JSON.stringify({ message: 'No drivers found with job offers and tokens for this order' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Prepare Expo notifications
    const tokens = validOffers.map(offer => (offer.profiles as any).expo_push_token)
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: { orderId: order.id, type: 'NEW_JOB', status: order.status },
    }))

    // 4. Send to Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const result = await response.json()
    console.log('Expo notification result:', result)

    return new Response(JSON.stringify({ success: true, result }), { 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in notify_drivers:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
