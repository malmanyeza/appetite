require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

async function check() {
    const lat = -17.829;
    const lng = 31.049;
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_restaurants_with_distance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ u_lat: lat, u_lng: lng })
    });
    
    const data = await res.json();
    console.log('Total Restaurants:', data.length);
    if (data.length > 0) {
        console.log('First Item Image:', data[0].cover_image_url);
        console.log('Sample Data:', JSON.stringify(data[0], null, 2));
    }
}

check().catch(console.error);
