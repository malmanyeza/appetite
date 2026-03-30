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
        name: "Chicken Inn",
        description: "Luv dat chicken! Zimbabwe's favorite fried chicken.",
        categories: ["Chicken", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1562967914-608f82629710",
        branches: [
            { name: "Chicken Inn Avondale", address: "Avondale Shopping Centre, King George Rd", phone: "+263242755250", lat: -17.8016, lng: 31.0366, suburb: "Avondale" },
            { name: "Chicken Inn CBD (Leopold Takawira)", address: "Cnr Leopold Takawira & Jason Moyo Ave", phone: "+263242755250", lat: -17.8285, lng: 31.0450, suburb: "CBD" },
            { name: "Chicken Inn Westgate", address: "Westgate Shopping Mall, Lomagundi Rd", phone: "+263242755250", lat: -17.7667, lng: 30.9833, suburb: "Westgate" },
            { name: "Chicken Inn Borrowdale", address: "Sam Levy's Village, Borrowdale Rd", phone: "+263242755250", lat: -17.7588, lng: 31.0841, suburb: "Borrowdale" }
        ]
    },
    {
        name: "KFC",
        description: "Original Recipe chicken and bucket meals. Finger Lickin' Good.",
        categories: ["Chicken", "Global", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb",
        branches: [
            { name: "KFC Avondale", address: "Avondale Shopping Centre, King George Rd", phone: "+2638677004001", lat: -17.8016, lng: 31.0366, suburb: "Avondale" },
            { name: "KFC Belgravia", address: "Sam Nujoma Street Ext, Belgravia", phone: "+2638677004002", lat: -17.7950, lng: 31.0380, suburb: "Belgravia" },
            { name: "KFC Joina City", address: "1st Floor, Joina City Mall, CBD", phone: "+2638677004003", lat: -17.8288, lng: 31.0475, suburb: "CBD" },
            { name: "KFC Msasa", address: "Mutare Road, Msasa", phone: "+2638677004004", lat: -17.8380, lng: 31.1050, suburb: "Msasa" }
        ]
    },
    {
        name: "Nando's",
        description: "Flame-grilled PERi-PERI chicken. Prepared the legendary way.",
        categories: ["Grill", "Chicken", "Healthy"],
        cover_image_url: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6",
        branches: [
            { name: "Nando's Avondale", address: "Avondale Shopping Centre, King George Rd", phone: "+263242303102", lat: -17.8015, lng: 31.0365, suburb: "Avondale" },
            { name: "Nando's Speke", address: "Speke Avenue, CBD", phone: "+263242770889", lat: -17.8310, lng: 31.0460, suburb: "CBD" },
            { name: "Nando's Borrowdale", address: "Sam Levy's Village, Borrowdale", phone: "+263242883440", lat: -17.7585, lng: 31.0845, suburb: "Borrowdale" }
        ]
    },
    {
        name: "Pizza Inn",
        description: "Must be the Pizza! Fresh dough and high-quality toppings.",
        categories: ["Pizza", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591",
        branches: [
            { name: "Pizza Inn Avondale", address: "Avondale Shopping Centre", phone: "+263242755250", lat: -17.8016, lng: 31.0366, suburb: "Avondale" },
            { name: "Pizza Inn Chisipite", address: "Chisipite Shopping Centre, Hindhead Ave", phone: "+263242755250", lat: -17.7780, lng: 31.1120, suburb: "Chisipite" },
            { name: "Pizza Inn Speke", address: "Speke Avenue, CBD", phone: "+263242755250", lat: -17.8310, lng: 31.0460, suburb: "CBD" }
        ]
    },
    {
        name: "Steers",
        description: "Flame-grilled burgers and famous hand-cut chips.",
        categories: ["Burgers", "Grill"],
        cover_image_url: "https://images.unsplash.com/photo-1550547660-d9450f859349",
        branches: [
            { name: "Steers Avondale", address: "King George Rd, Avondale", phone: "+263242755250", lat: -17.8016, lng: 31.0366, suburb: "Avondale" },
            { name: "Steers CBD", address: "Cnr Leopold Takawira & Samora Machel", phone: "+263242755250", lat: -17.8280, lng: 31.0440, suburb: "CBD" }
        ]
    },
    {
        name: "Chicken Slice",
        description: "A slice of goodness. Fried chicken, burgers and more.",
        categories: ["Chicken", "Fast Food"],
        cover_image_url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec",
        branches: [
            { name: "Chicken Slice CBD", address: "Cnr Leopold Takawira & Nelson Mandela", phone: "+263242754511", lat: -17.8270, lng: 31.0450, suburb: "CBD" },
            { name: "Chicken Slice Mbare", address: "Mbare Musika", phone: "+263242754511", lat: -17.8580, lng: 31.0370, suburb: "Mbare" },
            { name: "Chicken Slice Braeside", address: "Braeside Shopping Centre", phone: "+263242754511", lat: -17.8480, lng: 31.0660, suburb: "Braeside" }
        ]
    },
    {
        name: "Wimpy",
        description: "Famous for breakfast, burgers and thickshakes.",
        categories: ["Breakfast", "Coffee", "Burgers"],
        cover_image_url: "https://images.unsplash.com/photo-1552566626-52f8b828add9",
        branches: [
            { name: "Wimpy Eastgate", address: "Eastgate Mall, CBD", phone: "+263242707621", lat: -17.8306, lng: 31.0489, suburb: "CBD" },
            { name: "Wimpy Avondale", address: "Avondale Shopping Centre", phone: "+263242339591", lat: -17.8016, lng: 31.0366, suburb: "Avondale" }
        ]
    },
    {
        name: "Mugg & Bean",
        description: "Generous portions of fresh food and world-class coffee.",
        categories: ["Coffee", "Breakfast", "Bakery"],
        cover_image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
        branches: [
            { name: "Mugg & Bean Borrowdale", address: "Sam Levy's Village, Borrowdale", phone: "+263242851412", lat: -17.7588, lng: 31.0841, suburb: "Borrowdale" },
            { name: "Mugg & Bean Arundel", address: "Arundel Village, Quorn Ave", phone: "+263242301131", lat: -17.7750, lng: 31.0350, suburb: "Arundel" }
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

        console.log('\nSeeding Harare Branches...');

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
                    suburb: brand.branches[0].suburb, // Default suburb
                    lat: brand.branches[0].lat,
                    lng: brand.branches[0].lng,
                    cover_image_url: brand.cover_image_url,
                    is_open: true,
                    business_type: 'restaurant',
                    delivery_radius_km: 15,
                    avg_prep_time: '20-30 mins'
                })
            });

            if (!rRes.ok) {
                console.error(`Error inserting brand ${brand.name}:`, await rRes.text());
                continue;
            }

            const rData = await rRes.json();
            const restaurantId = rData[0].id;
            console.log(`✅ Brand: ${brand.name}`);

            for (const branch of brand.branches) {
                const lRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        restaurant_id: restaurantId,
                        location_name: branch.name,
                        city: "Harare",
                        suburb: branch.suburb,
                        lat: branch.lat,
                        lng: branch.lng,
                        physical_address: branch.address,
                        phone: branch.phone,
                        is_open: true,
                        opening_hours: "08:00 - 21:00"
                    })
                });

                if (lRes.ok) {
                    console.log(`   📍 Branch: ${branch.name}`);
                } else {
                    console.error(`   ❌ Failed branch ${branch.name}:`, await lRes.text());
                }
            }
        }

        console.log('\nDONE! Seeded 8 brands and 23 branches in Harare.');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
