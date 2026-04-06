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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { orderId } = await req.json()

    if (!orderId) throw new Error('Order ID is required')

    // 1. Fetch complete order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant:restaurants(name, manager_id),
        items:order_items(*)
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`)

    // 2. Fetch customer and restaurant manager profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [order.customer_id, order.restaurant.manager_id])

    const customer = profiles?.find(p => p.id === order.customer_id)
    const manager = profiles?.find(p => p.id === order.restaurant.manager_id)

    if (!customer?.email) {
      console.warn('Customer email missing, skipping email notification')
      return new Response(JSON.stringify({ message: 'Customer email missing' }), { status: 200 })
    }

    // 3. Simple HTML Template (Professional Appetite Orange #FF4D00)
    const itemsHtml = order.items.map((i: any) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #EEEEEE;">
          <div style="font-weight: bold; font-size: 16px;">${i.qty}x ${i.name_snapshot}</div>
          <div style="font-size: 14px; color: #666666;">$${(i.price_snapshot * i.qty).toFixed(2)}</div>
        </td>
      </tr>
    `).join('')

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Appetite Order Confirmation</title>
      </head>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F9F9F9; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color: #FF4D00; padding: 40px; text-align: center;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 800;">Appetite</h1>
          </div>
          
          <div style="padding: 40px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h2 style="margin: 0; color: #111111;">Order Confirmed!</h2>
              <p style="color: #666666; font-size: 16px;">We've received your order from <strong>${order.restaurant.name}</strong>.</p>
            </div>

            <div style="background: #FFF8F5; border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
              <div style="font-size: 12px; color: #FF4D00; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 8px;">Order Reference</div>
              <div style="font-size: 24px; font-weight: 800; color: #111111;">#${order.id.slice(0, 8).toUpperCase()}</div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
              ${itemsHtml}
            </table>

            <div style="background: #F9F9F9; border-radius: 12px; padding: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #666666;">Subtotal</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold;">$${order.pricing.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666666;">Delivery Fee</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold;">$${order.pricing.delivery_fee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666666;">Service Fee</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold;">$${order.pricing.service_fee.toFixed(2)}</td>
                </tr>
                <tr style="border-top: 1px solid #DDDDDD;">
                  <td style="padding: 16px 0 4px 0; font-size: 20px; font-weight: 800;">Total</td>
                  <td style="padding: 16px 0 4px 0; text-align: right; font-size: 20px; font-weight: 800; color: #FF4D00;">$${order.pricing.total.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="margin-top: 40px; text-align: center; color: #999999; font-size: 14px;">
              <p>Payment Method: ${order.payment.method.toUpperCase()}</p>
              <p>Need help? Contact support via the Appetite app.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    // 4. Send using Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Appetite <appetite@nexura.co.zw>', 
        to: [customer.email, manager?.email].filter(Boolean),
        subject: `Order Recieved: #${order.id.slice(0, 8).toUpperCase()}`,
        html: emailHtml
      })
    })

    const result = await res.json()
    console.log('Resend API Result:', result)

    return new Response(JSON.stringify({ success: true, result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in send_order_email:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
