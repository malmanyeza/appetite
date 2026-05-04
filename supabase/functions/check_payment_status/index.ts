import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  const steps: string[] = [];
  const version = "deep-diagnostic-v5";

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    steps.push("Function triggered");
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    steps.push("Admin client initialized");

    let body;
    try {
      body = await req.json();
      steps.push("Request JSON parsed");
    } catch (e) {
      throw new Error(`Failed to parse request JSON: ${e.message}`);
    }

    const { orderId } = body;
    if (!orderId) throw new Error('Order ID is missing in request body.');
    steps.push(`Processing Order ID: ${orderId}`);

    // 1. Fetch the order
    const { data: order, error: fetchError } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) throw new Error(`Database fetch error: ${fetchError.message}`);
    if (!order) throw new Error('Order record not found in database.');
    steps.push("Order record retrieved");
    
    // If already paid, just return it
    if (order.payment?.status === 'paid') {
      steps.push("Order already marked as paid");
      return new Response(JSON.stringify({ success: true, status: 'paid', order, steps, version }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const pollUrl = order.payment?.poll_url;
    if (!pollUrl) {
      steps.push("No poll_url found in order");
      return new Response(JSON.stringify({ success: true, status: order.payment?.status || 'pending', message: 'No poll URL available yet.', steps, version }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    steps.push(`Polling Paynow URL: ${pollUrl.substring(0, 50)}...`);

    // 2. Poll Paynow
    const paynowResp = await fetch(pollUrl);
    steps.push(`Paynow response received (Status: ${paynowResp.status})`);
    const paynowText = await paynowResp.text();
    steps.push(`Paynow body length: ${paynowText.length}`);
    const params = new URLSearchParams(paynowText);
    
    const paynowStatus = params.get('status');
    const paynowRef = params.get('paynowreference');
    const paynowError = params.get('error');

    // 3. Determine new status
    steps.push("Analyzing Paynow response...");
    const currentPayment = order.payment || {};
    let paymentStatus = currentPayment.status || 'pending';
    let orderStatus = order.status;

    const lowerError = paynowError?.toLowerCase() || '';
    const lowerStatus = paynowStatus?.toLowerCase() || '';
    
    const isTerminalError = lowerError.includes('insufficient') || 
                           lowerError.includes('balance') || 
                           lowerError.includes('funds') ||
                           lowerError.includes('auth failed') ||
                           lowerError.includes('invalid') ||
                           lowerError.includes('declined') ||
                           lowerError.includes('rejected') ||
                           lowerError.includes('expired') ||
                           lowerError.includes('not enough') ||
                           lowerStatus === 'refused' ||
                           lowerStatus === 'error' ||
                           lowerStatus === 'cancelled' ||
                           lowerStatus === 'failed';

    if (paynowStatus === 'Paid' || paynowStatus === 'Awaiting Delivery' || paynowStatus === 'Delivered') {
      paymentStatus = 'paid';
      if (orderStatus === 'pending') orderStatus = 'confirmed';
    } else if (isTerminalError) {
      paymentStatus = 'failed';
      if (orderStatus === 'pending') orderStatus = 'cancelled';
    }
    steps.push(`Determined status: payment=${paymentStatus}, order=${orderStatus}`);

    // 4. Update Database if changed
    const currentStatusInDb = currentPayment.status || 'pending';
    if (paymentStatus !== currentStatusInDb || orderStatus !== order.status) {
      steps.push("Updating database...");
      const { data: updatedOrder, error: updateError } = await adminClient.from('orders').update({
        status: orderStatus,
        payment: {
          ...currentPayment,
          status: paymentStatus,
          gateway_reference: paynowRef || currentPayment.gateway_reference,
          paid_at: paymentStatus === 'paid' ? new Date().toISOString() : currentPayment.paid_at,
          error_message: paynowError || null
        }
      }).eq('id', orderId).select().single();

      if (updateError) throw new Error(`Database update failed: ${updateError.message}`);
      steps.push("Database updated successfully");

      // Trigger notification if just confirmed
      if (orderStatus === 'confirmed' && order.status === 'pending') {
         steps.push("Triggering notifications...");
         await Promise.all([
             fetch(`${supabaseUrl}/functions/v1/notify_admins`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${supabaseServiceKey}`
                 },
                 body: JSON.stringify({
                     title: 'New Paid Order!',
                     message: `Order #${orderId.slice(0,8)} has been paid via ${order.payment?.method || 'Online'}`,
                     type: 'order_alert',
                     payload: { orderId: orderId }
                 })
             }),
             fetch(`${supabaseUrl}/functions/v1/notify_restaurant`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${supabaseServiceKey}`
                 },
                 body: JSON.stringify(updatedOrder)
             }),
             fetch(`${supabaseUrl}/functions/v1/notify_customer`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${supabaseServiceKey}`
                 },
                 body: JSON.stringify(updatedOrder)
             })
         ]).catch(err => console.error('Notification trigger failed:', err));
      }

      return new Response(JSON.stringify({ 
        success: true, 
        status: paymentStatus, 
        order: updatedOrder, 
        gatewayError: paynowError, 
        instructions: params.get('instructions') || params.get('status'), // Some mobile responses put text in status
        steps, 
        version 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    steps.push("No database update needed");
    return new Response(JSON.stringify({ 
      success: true, 
      status: paymentStatus, 
      order, 
      gatewayError: paynowError, 
      instructions: params.get('instructions') || params.get('status'),
      steps, 
      version 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    console.error(`[check_payment_status Fatal Error]:`, err);
    return new Response(JSON.stringify({ 
      success: false,
      error: err.message || 'Unknown error', 
      stack: err.stack,
      steps,
      version,
      hint: 'Trace the steps above to find the failure point'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
});
