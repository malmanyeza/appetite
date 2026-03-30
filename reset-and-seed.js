require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_ID = "7f57531f-6a41-439a-aec3-08b826a5d14f";

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const always = '?id=neq.00000000-0000-0000-0000-000000000000';

async function del(table) {
    console.log(`Clearing ${table}...`);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${always}`, { method: 'DELETE', headers });
    if (res.ok) console.log(`✅ Cleared ${table}`);
    else console.error(`❌ ${table}:`, await res.text());
}

const outlets = [
    {
        name: "Chicken Inn",
        description: "Luv dat chicken! Famous for fried chicken, burgers and chips.",
        categories: ["Chicken", "Fast Food", "Burgers"],
        cover_image_url: "https://images.unsplash.com/photo-1562967914-608f82629710",
        suburb: "CBD",
        city: "Harare",
        lat: -17.829,
        lng: 31.049
    },
    {
        name: "KFC",
        description: "It's Finger Lickin' Good. Original Recipe chicken and bucket meals.",
        categories: ["Chicken", "Global", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb",
        suburb: "CBD",
        city: "Harare",
        lat: -17.825,
        lng: 31.052
    },
    {
        name: "Nando's",
        description: "Legendary flame-grilled PERi-PERI chicken.",
        categories: ["Grill", "Healthy", "Chicken"],
        cover_image_url: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6",
        suburb: "Avondale",
        city: "Harare",
        lat: -17.798,
        lng: 31.037
    },
    {
        name: "Pizza Inn",
        description: "Must be the Pizza! Freshly baked pizzas with a variety of toppings.",
        categories: ["Pizza", "Fast Food", "Italian"],
        cover_image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591",
        suburb: "CBD",
        city: "Harare",
        lat: -17.831,
        lng: 31.048
    },
    {
        name: "Steers",
        description: "Real Food. Real People. Flame-grilled burgers and famous chips.",
        categories: ["Burgers", "Grill", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1550547660-d9450f859349",
        suburb: "CBD",
        city: "Harare",
        lat: -17.828,
        lng: 31.051
    }
];

(async () => {
    try {
        // 1. Clear everything
        await del('order_items');
        await del('orders');
        await del('location_menu_items');
        await del('menu_items');
        await del('restaurant_locations');
        await del('restaurant_members');
        await del('restaurants');

        console.log('\nSeeding new outlets...');

        for (const outlet of outlets) {
            // 2. Insert Restaurant
            const rRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurants`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    manager_id: ADMIN_ID,
                    name: outlet.name,
                    description: outlet.description,
                    categories: outlet.categories,
                    city: outlet.city,
                    suburb: outlet.suburb,
                    lat: outlet.lat,
                    lng: outlet.lng,
                    cover_image_url: outlet.cover_image_url,
                    is_open: true,
                    business_type: 'restaurant',
                    delivery_radius_km: 10,
                    avg_prep_time: '20-30 mins'
                })
            });

            if (!rRes.ok) {
                console.error(`Error inserting ${outlet.name}:`, await rRes.text());
                continue;
            }

            const rData = await rRes.json();
            const restaurantId = rData[0].id;
            console.log(`✅ Restaurant created: ${outlet.name} (${restaurantId})`);

            // 3. Insert Location (Main Branch)
            const lRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    restaurant_id: restaurantId,
                    location_name: "Main Branch",
                    city: outlet.city,
                    suburb: outlet.suburb,
                    lat: outlet.lat,
                    lng: outlet.lng,
                    is_open: true,
                    opening_hours: "08:00 - 21:00"
                })
            });

            if (lRes.ok) {
                console.log(`   ✅ Location created for ${outlet.name}`);
            } else {
                console.error(`   ❌ Failed to create location for ${outlet.name}:`, await lRes.text());
            }
        }

        console.log('\nDONE! Database reset to popular outlets.');
    } catch (e) {
        console.error('Fatal error:', e);
    }
})();
