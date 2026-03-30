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
}

const brands = [
    {
        name: "Pizza Inn",
        description: "Must be the Pizza! Freshly baked with the best ingredients.",
        categories: ["Pizza", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
        rating_avg: 3.8,
        rating_count: 520,
        branches: [
            { name: "Pizza Inn Samora Machel", address: "121 Samora Machel Ave (Cnr 6th St)", phone: "+263242704111", lat: -17.8286, lng: 31.0530, suburb: "CBD", rating: 3.8, count: 124 },
            { name: "Pizza Inn Belgravia", address: "Leopold Takawira St (Near Parirenyatwa)", phone: "+263242333441", lat: -17.7946, lng: 31.0427, suburb: "Belgravia", rating: 3.7, count: 88 },
            { name: "Pizza Inn Avondale", address: "Avondale Shopping Centre, King George Rd", phone: "+263242304381", lat: -17.8016, lng: 31.0349, suburb: "Avondale", rating: 3.9, count: 210 },
            { name: "Pizza Inn Borrowdale", address: "Village Market, Borrowdale Rd", phone: "+263242885941", lat: -17.7600, lng: 31.1070, suburb: "Borrowdale", rating: 4.0, count: 156 },
            { name: "Pizza Inn Chisipite", address: "Chisipite Shopping Centre", phone: "+263242495331", lat: -17.7885, lng: 31.1172, suburb: "Chisipite", rating: 3.8, count: 65 },
            { name: "Pizza Inn Msasa", address: "Mutare Road (Near Juntion)", phone: "+263242446731", lat: -17.8388, lng: 31.1097, suburb: "Msasa", rating: 3.6, count: 42 },
            { name: "Pizza Inn Westgate", address: "Westgate Mall Shopping Centre", phone: "+263242334752", lat: -17.7618, lng: 30.9859, suburb: "Westgate", rating: 3.7, count: 94 },
            { name: "Pizza Inn Greencroft", address: "Greencroft Shopping Centre", phone: "+263242315551", lat: -17.7820, lng: 31.0020, suburb: "Greencroft", rating: 3.8, count: 53 },
            { name: "Pizza Inn Kamfinsa", address: "Kamfinsa Shopping Centre", phone: "+263242495332", lat: -17.8185, lng: 31.1150, suburb: "Kamfinsa", rating: 3.7, count: 37 },
            { name: "Pizza Inn Newlands", address: "Newlands Shopping Centre", phone: "+263242746111", lat: -17.8115, lng: 31.0768, suburb: "Newlands", rating: 3.9, count: 82 },
            { name: "Pizza Inn Highlands", address: "Highlands Shopping Centre", phone: "+263242495333", lat: -17.8080, lng: 31.0880, suburb: "Highlands", rating: 3.8, count: 44 },
            { name: "Pizza Inn Machipisa", address: "Machipisa Shopping Centre, Highfield", phone: "+263242664331", lat: -17.8860, lng: 31.0080, suburb: "Highfield", rating: 3.5, count: 110 },
            { name: "Pizza Inn Southerton", address: "Southerton Shopping Centre", phone: "+263242664332", lat: -17.8580, lng: 31.0250, suburb: "Southerton", rating: 3.6, count: 56 },
            { name: "Pizza Inn Waterfalls", address: "Simon Mazorodze Rd (Near Parktown)", phone: "+263242664333", lat: -17.8850, lng: 31.0350, suburb: "Waterfalls", rating: 3.5, count: 72 }
        ]
    },
    {
        name: "Chicken Inn",
        description: "Luv dat chicken! Zimbabwe's favorite fried chicken brand.",
        categories: ["Chicken", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
        rating_avg: 3.8,
        rating_count: 650,
        branches: [
            { name: "Chicken Inn Speke Ave", address: "Speke Avenue, CBD", phone: "+263242772551", lat: -17.8310, lng: 31.0515, suburb: "CBD", rating: 3.8, count: 180 },
            { name: "Chicken Inn Leopold Takawira", address: "Leopold Takawira St, CBD", phone: "+263242751551", lat: -17.8290, lng: 31.0490, suburb: "CBD", rating: 3.7, count: 145 },
            { name: "Chicken Inn Groombridge", address: "Groombridge Shopping Centre", phone: "+263242335551", lat: -17.7780, lng: 31.0550, suburb: "Groombridge", rating: 3.9, count: 92 },
            { name: "Chicken Inn Greencroft", address: "Greencroft Shopping Centre", phone: "+263242315551", lat: -17.7820, lng: 31.0020, suburb: "Greencroft", rating: 3.8, count: 77 },
            { name: "Chicken Inn Belgravia", address: "Leopold Takawira St", phone: "+263242333441", lat: -17.7946, lng: 31.0427, suburb: "Belgravia", rating: 3.8, count: 120 },
            { name: "Chicken Inn Borrowdale", address: "Village Market", phone: "+263242885941", lat: -17.7600, lng: 31.1070, suburb: "Borrowdale", rating: 4.1, count: 240 },
            { name: "Chicken Inn Avondale", address: "Avondale SC", phone: "+263242304381", lat: -17.8016, lng: 31.0349, suburb: "Avondale", rating: 3.9, count: 310 },
            { name: "Chicken Inn Msasa", address: "Mutare Road", phone: "+263242446731", lat: -17.8388, lng: 31.1097, suburb: "Msasa", rating: 3.7, count: 85 },
            { name: "Chicken Inn Westgate", address: "Westgate Mall", phone: "+263242304382", lat: -17.7618, lng: 30.9859, suburb: "Westgate", rating: 3.8, count: 115 }
        ]
    },
    {
        name: "KFC",
        description: "Original Recipe chicken and bucket meals. Finger Lickin' Good.",
        categories: ["Chicken", "Global", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.1,
        rating_count: 1200,
        branches: [
            { name: "KFC Belgravia", address: "Leopold Takawira St (Cnr Parirenyatwa)", phone: "+263242307374", lat: -17.7950, lng: 31.0430, suburb: "Belgravia", rating: 4.3, count: 450 },
            { name: "KFC Joina City", address: "Joina City Mall, CBD", phone: "+263772147434", lat: -17.8315, lng: 31.0505, suburb: "CBD", rating: 4.0, count: 320 },
            { name: "KFC Westgate", address: "Westgate Mall", phone: "+263242334752", lat: -17.7620, lng: 30.9860, suburb: "Westgate", rating: 4.1, count: 180 },
            { name: "KFC Msasa", address: "Mutare Road", phone: "+263242486121", lat: -17.8390, lng: 31.1100, suburb: "Msasa", rating: 4.2, count: 210 },
            { name: "KFC Simon Muzenda", address: "Simon Muzenda St (4th Street), CBD", phone: "+263242795791", lat: -17.8280, lng: 31.0590, suburb: "CBD", rating: 3.9, count: 155 },
            { name: "KFC Avondale", address: "Avondale Shopping Centre", phone: "+263242302341", lat: -17.8020, lng: 31.0350, suburb: "Avondale", rating: 4.1, count: 290 },
            { name: "KFC Borrowdale", address: "Near Wicklow Rd (Borrowdale)", phone: "+263242707252", lat: -17.7580, lng: 31.1050, suburb: "Borrowdale", rating: 4.3, count: 410 }
        ]
    },
    {
        name: "Nando's",
        description: "Flame-grilled PERi-PERI chicken. Legendary flavor.",
        categories: ["Grill", "Chicken", "Healthy"],
        cover_image_url: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.0,
        rating_count: 850,
        branches: [
            { name: "Nando's Avondale", address: "Avondale Shopping Centre", phone: "+263242307311", lat: -17.8016, lng: 31.0349, suburb: "Avondale", rating: 4.1, count: 320 },
            { name: "Nando's Belgravia", address: "Belgravia SC", phone: "+263242307312", lat: -17.7946, lng: 31.0427, suburb: "Belgravia", rating: 4.0, count: 180 },
            { name: "Nando's Samora Machel", address: "Samora Machel Ave", phone: "+263242705311", lat: -17.8286, lng: 31.0530, suburb: "CBD", rating: 3.9, count: 210 },
            { name: "Nando's Chisipite", address: "Chisipite Shopping Centre", phone: "+263242495334", lat: -17.7885, lng: 31.1172, suburb: "Chisipite", rating: 4.1, count: 95 },
            { name: "Nando's Msasa", address: "Mutare Road", phone: "+263242446734", lat: -17.8388, lng: 31.1097, suburb: "Msasa", rating: 4.0, count: 110 }
        ]
    },
    {
        name: "Chicken Slice",
        description: "A slice of goodness. Quality fried chicken and burgers.",
        categories: ["Chicken", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
        rating_avg: 3.6,
        rating_count: 450,
        branches: [
            { name: "Chicken Slice Mbuya Nehanda", address: "Mbuya Nehanda St, CBD", phone: "+263242750311", lat: -17.8320, lng: 31.0420, suburb: "CBD", rating: 3.5, count: 140 },
            { name: "Chicken Slice Angwa St", address: "Angwa Street, CBD", phone: "+263242750312", lat: -17.8315, lng: 31.0480, suburb: "CBD", rating: 3.6, count: 110 },
            { name: "Chicken Slice Samora Machel", address: "Samora Machel Ave", phone: "+263242750313", lat: -17.8285, lng: 31.0540, suburb: "CBD", rating: 3.7, count: 95 }
        ]
    },
    {
        name: "Chop Chop",
        description: "Authentic Brazilian Churrasco and grilled favorites.",
        categories: ["Grill", "Brazillian", "Steak"],
        cover_image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.1,
        rating_count: 320,
        branches: [
            { name: "Chop Chop Fife Avenue", address: "Fife Avenue SC", phone: "+263242703311", lat: -17.8210, lng: 31.0550, suburb: "CBD", rating: 4.1, count: 320 }
        ]
    },
    {
        name: "Tong Fu",
        description: "Authentic Chinese cuisine in a serene environment.",
        categories: ["Chinese", "Fine Dining"],
        cover_image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.1,
        rating_count: 280,
        branches: [
            { name: "Tong Fu Belgravia", address: "Belgravia Shopping Centre, 2nd St Extension", phone: "+263772420465", lat: -17.7950, lng: 31.0430, suburb: "Belgravia", rating: 4.1, count: 155 },
            { name: "Tong Fu Avondale", address: "Avondale", phone: "+263242303312", lat: -17.8020, lng: 31.0350, suburb: "Avondale", rating: 4.0, count: 125 }
        ]
    },
    {
        name: "Mugg & Bean",
        description: "Generous portions and world-class coffee.",
        categories: ["Coffee", "Breakfast"],
        cover_image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.0,
        rating_count: 550,
        branches: [
            { name: "Mugg & Bean Borrowdale", address: "Village Market", phone: "+263242885942", lat: -17.7600, lng: 31.1070, suburb: "Borrowdale", rating: 4.0, count: 550 }
        ]
    },
    {
        name: "Steers",
        description: "Real food, real people. Famous flame-grilled burgers.",
        categories: ["Burgers", "Grill"],
        cover_image_url: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
        rating_avg: 3.7,
        rating_count: 420,
        branches: [
            { name: "Steers CBD", address: "Cnr First St & Jason Moyo", phone: "+263242707255", lat: -17.8310, lng: 31.0500, suburb: "CBD", rating: 3.7, count: 420 }
        ]
    },
    {
        name: "Wimpy",
        description: "Famous for its breakfast and thickshakes.",
        categories: ["Breakfast", "Coffee"],
        cover_image_url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80",
        rating_avg: 3.8,
        rating_count: 180,
        branches: [
            { name: "Wimpy Avondale", address: "Avondale Shopping Centre", phone: "+263242302345", lat: -17.8016, lng: 31.0349, suburb: "Avondale", rating: 3.8, count: 180 }
        ]
    },
    {
        name: "Spur",
        description: "People with a taste for life. Steaks, burgers and ribs.",
        categories: ["Steak", "Family"],
        cover_image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        rating_avg: 4.2,
        rating_count: 350,
        branches: [
            { name: "Eagle Spur Avondale", address: "Avondale Shopping Centre", phone: "+263242307315", lat: -17.8016, lng: 31.0349, suburb: "Avondale", rating: 4.2, count: 350 }
        ]
    }
];

(async () => {
    try {
        await del('order_items');
        await del('orders');
        await del('location_menu_items');
        await del('menu_items');
        await del('restaurant_locations');
        await del('restaurant_members');
        await del('restaurants');

        console.log('\nSeeding FINAL Harare Branches with Real Ratings...');

        for (const brand of brands) {
            const rRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurants`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    manager_id: ADMIN_ID,
                    name: brand.name,
                    description: brand.description,
                    categories: brand.categories,
                    city: "Harare",
                    suburb: brand.branches[0].suburb,
                    lat: brand.branches[0].lat,
                    lng: brand.branches[0].lng,
                    cover_image_url: brand.cover_image_url,
                    is_open: true,
                    business_type: 'restaurant',
                    delivery_radius_km: 15,
                    avg_prep_time: '20-30 mins',
                    rating_avg: brand.rating_avg,
                    rating_count: brand.rating_count
                })
            });

            if (!rRes.ok) {
                console.error(`Error brand ${brand.name}:`, await rRes.text());
                continue;
            }

            const rData = await rRes.json();
            const restaurantId = rData[0].id;
            console.log(`✅ ${brand.name} (${brand.rating_avg}⭐)`);

            for (const b of brand.branches) {
                const lRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        restaurant_id: restaurantId,
                        location_name: b.name,
                        city: "Harare",
                        suburb: b.suburb,
                        lat: b.lat,
                        lng: b.lng,
                        physical_address: b.address,
                        phone: b.phone,
                        is_open: true,
                        opening_hours: "08:00 - 21:00",
                        rating_avg: b.rating,
                        rating_count: b.count
                    })
                });

                if (lRes.ok) {
                    console.log(`   📍 ${b.name} (${b.rating}⭐)`);
                } else {
                    console.error(`   ❌ ${b.name}:`, await lRes.text());
                }
            }
        }

        console.log('\nDONE! Seeded 11 brands and 45+ branches with Google Ratings.');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
