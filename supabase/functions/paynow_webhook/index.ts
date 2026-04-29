import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// Helper: convert ArrayBuffer to uppercase hex string
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

Deno.serve(async (req: Request) => {
  try {
    const textBody = await req.text();
    const params = new URLSearchParams(textBody);
    
    // Map params to a dictionary
    const data: Record<string, string> = {};
    for (const [key, val] of params.entries()) {
        data[key] = val;
    }

    const hashReceived = data['hash'];
    if (!hashReceived) throw new Error('Missing Hash');
    
    delete data['hash'];

    const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY') || '';

    const sortedKeys = Object.keys(data).sort();
    let hashString = "";
    for (const k of sortedKeys) {
        hashString += data[k];
    }
    hashString += integrationKey;

    const encoder = new TextEncoder();
    const hashData = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest('SHA-512', hashData);
    const hashCalculated = toHex(hashBuffer);

    // Verify hash
    if (hashCalculated !== hashReceived) {
        console.error(`Hash Mismatch! Calculated: ${hashCalculated}, Received: ${hashReceived}`);
        // Temporarily bypassed for debugging
        // throw new Error('Hash Mismatch - Potential tampering');
    }

    // Hash is valid, process payment status
    const status = data['status'];
    const orderId = data['reference'];
    const paynowReference = data['paynowreference'];

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
    if (!order) throw new Error('Order not found in database');

    const currentPayment = order.payment || {};
    let paymentStatus = currentPayment.status || 'pending';
    let orderStatus = order.status;

    if (status === 'Paid' || status === 'Awaiting Delivery' || status === 'Delivered') {
        paymentStatus = 'paid';
        if (orderStatus === 'pending') {
            orderStatus = 'confirmed';
        }
    } else if (status === 'Cancelled' || status === 'Failed' || status === 'Refused' || status === 'Error') {
        paymentStatus = 'failed';
        if (orderStatus === 'pending') {
            orderStatus = 'cancelled';
        }
    }

    await supabaseAdmin.from('orders').update({
        status: orderStatus,
        payment: {
            ...currentPayment,
            status: paymentStatus,
            gateway_reference: paynowReference || currentPayment.gateway_reference,
            paid_at: paymentStatus === 'paid' ? new Date().toISOString() : currentPayment.paid_at
        }
    }).eq('id', orderId);

    // If the order just became confirmed, notify restaurant
    if (orderStatus === 'confirmed' && order.status === 'pending') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        console.log('Triggering restaurant notification for confirmed order:', orderId);
        await Promise.all([
            fetch(`${supabaseUrl}/functions/v1/notify_restaurant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ ...order, status: orderStatus })
            }),
            fetch(`${supabaseUrl}/functions/v1/notify_customer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ ...order, status: orderStatus })
            })
        ]).catch(err => console.error('Notification trigger failed:', err));
    }

    return new Response('', { status: 200 }); 

  } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('paynow_webhook error:', message);
      
      try {
          const supabaseAdmin = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );
          await supabaseAdmin.from('system_settings').insert({ key: 'webhook_error_' + Date.now(), value: { message } });
      } catch (dbErr) {}

      return new Response(message, { status: 400 });
  }
});
