require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` };

fetch(`${SUPABASE_URL}/rest/v1/restaurants?select=*&limit=1`, { headers })
    .then(r => r.json())
    .then(data => console.log('Restaurant Sample:', JSON.stringify(data[0] || {}, null, 2)))
    .catch(console.error);
