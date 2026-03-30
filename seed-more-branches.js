require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const KFC_ID = "8852ff4b-7f57-48b6-bd4d-5b4b81c410b9";
const CHICKEN_INN_ID = "3b422500-f11c-4715-ada7-1bb3b04856b9";
const NANDOS_ID = "9bafe786-7871-454a-9c9b-fa5fec9ea8e8";

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const newLocations = [
    // KFC
    { restaurant_id: KFC_ID, location_name: "KFC Kuwadzana", physical_address: "A5, Harare", suburb: "Kuwadzana", phone: "+263784935170", lat: -17.8304, lng: 30.9130, rating_avg: 4.1, rating_count: 156 },
    { restaurant_id: KFC_ID, location_name: "KFC Enterprise", physical_address: "167 ED Mnangagwa Rd, Harare", suburb: "Highlands", phone: "+263789514136", lat: -17.7916, lng: 31.1049, rating_avg: 4.4, rating_count: 243 },
    { restaurant_id: KFC_ID, location_name: "KFC Belvedere", physical_address: "Princes Rd & Bishop Gaul Ave", suburb: "Belvedere", phone: "+263783301384", lat: -17.8228, lng: 31.0264, rating_avg: 4.2, rating_count: 312 },
    { restaurant_id: KFC_ID, location_name: "KFC Hillside", physical_address: "Chiremba Rd & Glenara Ave", suburb: "Hillside", phone: "+263783301324", lat: -17.8485, lng: 31.0825, rating_avg: 4.0, rating_count: 189 },
    { restaurant_id: KFC_ID, location_name: "KFC Greencroft", physical_address: "Nemakonde Rd, Harare", suburb: "Greencroft", phone: "+263776356322", lat: -17.7845, lng: 31.0215, rating_avg: 4.3, rating_count: 215 },
    { restaurant_id: KFC_ID, location_name: "KFC Sunway", physical_address: "Mutare Rd & Zimre Way", suburb: "Sunway City", phone: "+263783301300", lat: -17.8248, lng: 31.1530, rating_avg: 3.9, rating_count: 98 },
    { restaurant_id: KFC_ID, location_name: "KFC Simon Mazorodze", physical_address: "29630 Simon Mazorodze Rd", suburb: "Southerton", phone: "+263773057946", lat: -17.8765, lng: 31.0285, rating_avg: 3.8, rating_count: 124 },

    // Chicken Inn
    { restaurant_id: CHICKEN_INN_ID, location_name: "Chicken Inn Five Avenue", physical_address: "161 Fife Avenue, Harare", suburb: "Avenues", phone: "+263731200419", lat: -17.8185, lng: 31.0535, rating_avg: 4.2, rating_count: 456 },
    { restaurant_id: CHICKEN_INN_ID, location_name: "Chicken Inn RG Mugabe", physical_address: "105 R G Mugabe, Harare", suburb: "CBD", phone: "+263773057900", lat: -17.8300, lng: 31.0656, rating_avg: 3.5, rating_count: 890 },
    { restaurant_id: CHICKEN_INN_ID, location_name: "Chicken Inn Samora", physical_address: "Corner Samora Machel & 5th St", suburb: "CBD", phone: "+263731200429", lat: -17.8275, lng: 31.0545, rating_avg: 3.9, rating_count: 612 },
    { restaurant_id: CHICKEN_INN_ID, location_name: "Chicken Inn Machipisa", physical_address: "Burombo Road, Harare", suburb: "Highfield", phone: "+263773057910", lat: -17.8925, lng: 31.0385, rating_avg: 3.7, rating_count: 534 },
    { restaurant_id: CHICKEN_INN_ID, location_name: "Chicken Inn Park Street", physical_address: "11 Hurudza House, Park St", suburb: "CBD", phone: "+263773057920", lat: -17.8255, lng: 31.0485, rating_avg: 4.1, rating_count: 267 },

    // Nando's
    { restaurant_id: NANDOS_ID, location_name: "Nando's Fife Avenue", physical_address: "Fife Avenue Shopping Centre", suburb: "Avenues", phone: "+263712335357", lat: -17.8191, lng: 31.0543, rating_avg: 4.5, rating_count: 312 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Marimba", physical_address: "Marimba Shopping Centre", suburb: "Belvedere", phone: "+263777006825", lat: -17.8385, lng: 30.9795, rating_avg: 4.3, rating_count: 156 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Nelson Mandela", physical_address: "57 Nelson Mandela Avenue", suburb: "CBD", phone: "+263777006843", lat: -17.8285, lng: 31.0515, rating_avg: 4.2, rating_count: 423 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Pomona", physical_address: "54 Edinburgh Road, Pomona", suburb: "Pomona", phone: "+263777006834", lat: -17.7685, lng: 31.0785, rating_avg: 4.6, rating_count: 512 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Simon Mazorodze", physical_address: "38 Simon Mazorodze Road", suburb: "Southerton", phone: "+263777006846", lat: -17.8685, lng: 31.0315, rating_avg: 4.0, rating_count: 189 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Borrowdale", physical_address: "1 Balmoral Rd, Borrowdale", suburb: "Borrowdale", phone: "+263777006800", lat: -17.7585, lng: 31.0985, rating_avg: 4.7, rating_count: 645 },
    { restaurant_id: NANDOS_ID, location_name: "Nando's Braeside", physical_address: "Casa Jika, Chiremba Rd", suburb: "Braeside", phone: "+263777006810", lat: -17.8415, lng: 31.0745, rating_avg: 4.4, rating_count: 278 }
];

(async () => {
    try {
        console.log(`Adding ${newLocations.length} new branches to the database...`);
        for (const loc of newLocations) {
            // Check if exists by name for that restaurant
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations?restaurant_id=eq.${loc.restaurant_id}&location_name=eq.${encodeURIComponent(loc.location_name)}`, {
                method: 'GET',
                headers
            });
            const existing = await checkRes.json();

            if (existing && existing.length > 0) {
                console.log(`   ⏭️ Skipping existing: ${loc.location_name}`);
                continue;
            }

            const res = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...loc,
                    is_open: true,
                    city: 'Harare'
                })
            });

            if (res.ok) {
                console.log(`   ✅ Added: ${loc.location_name}`);
            } else {
                console.error(`   ❌ Failed ${loc.location_name}:`, await res.text());
            }
        }
        console.log('\nExpansion complete!');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
