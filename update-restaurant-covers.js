require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const updates = [
    { name: "Pizza Inn", cover: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Chicken Inn", cover: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "KFC", cover: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Nando's", cover: "https://images.unsplash.com/photo-1594212699903-ec8a3ecc50f1?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Chicken Slice", cover: "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Chop Chop", cover: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Tong Fu", cover: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&h=675&q=80" },
    { name: "Mugg & Bean", cover: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&h=675&q=80" }
];

(async () => {
    try {
        for (const update of updates) {
            console.log(`Updating ${update.name}...`);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/restaurants?name=eq.${update.name}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ cover_image_url: update.cover })
            });

            if (res.ok) {
                console.log(`   ✅ Success`);
            } else {
                console.error(`   ❌ Failed:`, await res.text());
            }
        }
        console.log('\nAll restaurant cover images updated to premium 16:9 versions!');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
