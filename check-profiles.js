require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` };

fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name`, { headers })
    .then(r => r.json())
    .then(data => console.log('Profiles:', JSON.stringify(data, null, 2)))
    .catch(console.error);
