import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import webpush from "npm:web-push"

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json()
    console.log('Restaurant Notification payload received:', payload)

    const order = payload.record || payload

    if (!order || order.status !== 'confirmed') {
      return new Response(JSON.stringify({ message: 'Ignored: Order not confirmed' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 1. Find the restaurant manager(s)
    // First check manager_id on restaurants
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('manager_id, name')
      .eq('id', order.restaurant_id)
      .single()

    if (restError || !restaurant) {
      console.error('Error fetching restaurant manager:', restError)
      throw new Error('Restaurant not found')
    }

    // Also check restaurant_members for any other owners/managers
    const { data: members, error: membersError } = await supabase
      .from('restaurant_members')
      .select('user_id')
      .eq('restaurant_id', order.restaurant_id)
      .in('role', ['owner', 'manager'])

    const managerIds = new Set<string>()
    if (restaurant.manager_id) managerIds.add(restaurant.manager_id)
    members?.forEach(m => managerIds.add(m.user_id))

    if (managerIds.size === 0) {
      return new Response(JSON.stringify({ message: 'No managers found for this restaurant' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch push tokens for all managers
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .in('id', Array.from(managerIds))
      .not('expo_push_token', 'is', null)

    if (profileError) {
      console.error('Error fetching manager profiles:', profileError)
      throw profileError
    }

    // 2.5 Fetch Web Push Subscriptions
    const { data: webSubs, error: webSubsError } = await supabase
      .from('web_push_subscriptions')
      .select('subscription')
      .in('user_id', Array.from(managerIds))

    if (webSubsError) {
      console.error('Error fetching web push subscriptions:', webSubsError)
    }

    if (!profiles?.length && !webSubs?.length) {
      return new Response(JSON.stringify({ message: 'No managers with push tokens or web subscriptions found' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Prepare Expo notifications
    const tokens = profiles.map(p => p.expo_push_token)
    const messages = tokens.map(token => ({
      to: token,
      sound: 'appetite_alert.wav',
      title: 'New Order Received!',
      body: `Order #${order.id.slice(0, 8)} has been placed at ${restaurant.name}.`,
      data: { orderId: order.id, type: 'NEW_ORDER' },
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
    console.log('Expo notification result (Restaurant):', result)

    // 5. Send Web Push Notifications
    if (webSubs && webSubs.length > 0) {
      const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || 'BLD_WNWSzhZvd9hqgkGQ2qTi1CjvOnhnxnNhz2B7Db6Jhk0HNTs3o2O6I1Ld5j5hOfT93HjjU10ErD0gjRAPcrc';
      const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || 'oS39sJFRlmeG_jhnnz5evNIfAjlnSl79mNyuP3tPxe4';
      
      webpush.setVapidDetails(
        'mailto:malmanyeza@gmail.com',
        vapidPublic,
        vapidPrivate
      );

      const webPushPromises = webSubs.map(s => {
        const sub = s.subscription as any;
        return webpush.sendNotification(sub, JSON.stringify({
          title: 'New Order Received!',
          body: `Order #${order.id.slice(0, 8)} has been placed at ${restaurant.name}.`,
          data: { orderId: order.id, type: 'NEW_ORDER' }
        })).catch(err => console.error('Web Push failed for endpoint:', sub.endpoint, err));
      });

      await Promise.all(webPushPromises);
      console.log(`Sent ${webSubs.length} Web Push notifications.`);
    }

    return new Response(JSON.stringify({ success: true, expoResult: result, webPushCount: webSubs?.length || 0 }), { 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in notify_restaurant:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
