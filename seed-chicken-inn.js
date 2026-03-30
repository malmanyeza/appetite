require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CHICKEN_INN_ID = "3b422500-f11c-4715-ada7-1bb3b04856b9";

const locationsToAdd = [
    "Chicken Inn Drive Thru Willowvale",
    "Chicken Inn Warren Park",
    "Chicken Inn Waterfalls",
    "Chicken Inn Madokero Drive",
    "Chicken Inn Robson Manyika",
    "Chicken Inn Aspindale Dial & Deliver",
    "Chicken Inn Machipisa",
    "Chicken Inn Harare Drive",
    "Chicken Inn Dzivarasekwa",
    "Chicken Inn Tynwald Complex",
    "Chicken Inn Greenfield",
    "Chicken Inn Tote House",
    "Chicken Inn Cork Road",
    "Chicken Inn Harare Street",
    "Chicken Inn Chinamano",
    "Chicken Inn Julius Nyerere",
    "Chicken Inn Westend",
    "Chicken Inn Kelvin",
    "Chicken Inn Sakunda",
    "Chicken Inn Matlock",
    "Chicken Inn Showground",
    "Chicken Inn 105 Robert Mugabe",
    "Chicken Inn AMC",
    "Chicken Inn Walktall",
    "Chicken Inn Hughes",
    "Chicken Inn Roadport",
    "Chicken Inn First Street",
    "Chicken Inn Samora",
    "Chicken Inn Speke",
    "Chicken Inn Construction House",
    "Chicken Inn Lister",
    "Chicken Inn Highland Park",
    "Chicken Inn Donnybrook",
    "Chicken Inn Mabelreign",
    "Chicken Inn Bluffhill Complex",
    "Chicken Inn Avondale Drive Thru",
    "Chicken Inn Belgravia",
    "Chicken Inn Five Avenue",
    "Chicken Inn Hogerty",
    "Chicken Inn Helensvale",
    "Chicken Inn Cardinals Corner",
    "Chicken Inn Borrowdale Drive Thru",
    "Chicken Inn Emerald Hill",
    "Chicken Inn Westgate",
    "Chicken Inn Greencroft Drive Thru",
    "Chicken Inn University of Zimbabwe",
    "Chicken Inn Parkwell",
    "Chicken Inn Chisipite",
    "Chicken Inn Pomona",
    "Chicken Inn Melfort"
];

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function getExistingLocations() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations?restaurant_id=eq.${CHICKEN_INN_ID}`, { headers });
    return await res.json();
}

function isDuplicate(newName, existingLocations) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normNew = normalize(newName);
    
    // Direct or fuzzy match
    return existingLocations.some(loc => {
        const normExisting = normalize(loc.location_name);
        return normNew.includes(normExisting) || normExisting.includes(normNew);
    });
}

async function fetchPlaceDetails(query) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ", Harare")}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
        return data.results[0];
    }
    return null;
}

(async () => {
    try {
        console.log("Fetching existing Chicken Inn locations...");
        const existing = await getExistingLocations();
        console.log(`Found ${existing.length} existing locations.`);

        const toProcess = locationsToAdd.filter(name => !isDuplicate(name, existing));
        console.log(`Total locations to process: ${toProcess.length}`);

        for (const locName of toProcess) {
            console.log(`Processing: ${locName}...`);
            const place = await fetchPlaceDetails(locName);
            
            if (!place) {
                console.warn(`   ⚠️ Could not find ${locName} on Google Maps. Skipping.`);
                continue;
            }

            const payload = {
                restaurant_id: CHICKEN_INN_ID,
                location_name: locName,
                city: 'Harare',
                suburb: locName.split(' ').slice(2).join(' ') || 'Harare', // Rough suburb extraction
                physical_address: place.formatted_address,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                rating_avg: place.rating || 0,
                rating_count: place.user_ratings_total || 0,
                is_open: true,
                opening_time: "08:00:00",
                closing_time: "21:00:00",
                days_open: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            };

            const res = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_locations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                console.log(`   ✅ Successfully added ${locName}`);
            } else {
                console.error(`   ❌ Failed to add ${locName}:`, await res.text());
            }
            
            // Sleep for a bit to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        console.log("\nDone!");
    } catch (e) {
        console.error("Fatal error:", e);
    }
})();
