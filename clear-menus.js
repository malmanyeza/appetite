require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
};
const always = '?id=neq.00000000-0000-0000-0000-000000000000';

async function del(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${always}`, { method: 'DELETE', headers });
    if (res.ok) console.log(`✅ Cleared ${table}`);
    else console.error(`❌ ${table}:`, await res.text());
}

(async () => {
    await del('order_items');
    await del('orders');
    await del('menu_items');
    console.log('Done!');
})();
