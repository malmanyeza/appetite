import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse .env manually to avoid needing the 'dotenv' npm package
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key) env[key] = val;
    }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
require('dotenv').config({ path: '../.env' });
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchGoogleRestaurants(query, nextPageToken = null) {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
    if (nextPageToken) {
        url += `&pagetoken=${nextPageToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    return data;
}

async function insertRestaurant(place) {
    if (!place.name || !place.geometry || !place.geometry.location) return;

    // Check if the restaurant already exists by name to avoid duplicates
    const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('name', place.name)
        .maybeSingle();

    if (existing) {
        console.log(`[SKIP] Restaurant already exists: ${place.name}`);
        return;
    }

    let coverImageUrl = 'https://images.unsplash.com/photo-1552566626-52f8b828add9'; // default image
    if (place.photos && place.photos.length > 0) {
        const photoRef = place.photos[0].photo_reference;
        coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
    }

    let adminUserId = null;
    const { data: admin } = await supabase.from('profiles').select('id').limit(1).single();
    if (admin) {
        adminUserId = admin.id;
    } else {
        console.error('No users found in database to assign as manager.');
        return;
    }

    const restaurantData = {
        name: place.name,
        city: 'Harare',
        suburb: place.formatted_address ? place.formatted_address.split(',')[0] : 'Harare',
        physical_address: place.formatted_address || '',
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        rating_avg: place.rating || 0.0,
        cover_image_url: coverImageUrl,
        is_open: place.business_status === 'OPERATIONAL' || true,
        categories: place.types ? place.types.filter(t => t !== 'point_of_interest' && t !== 'establishment') : ['Restaurant'],
        days_open: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        business_type: 'restaurant',
        manager_id: adminUserId
    };

    console.log(`[INSERT] Creating restaurant: ${place.name}`);
    const { data: insertedRest, error: restError } = await supabase
        .from('restaurants')
        .insert(restaurantData)
        .select()
        .single();

    if (restError) {
        console.error(`Failed to insert ${place.name}:`, restError.message);
        return;
    }

    // Insert into restaurant_locations
    const { error: locError } = await supabase
        .from('restaurant_locations')
        .insert({
            restaurant_id: insertedRest.id,
            location_name: 'Main Branch',
            city: insertedRest.city,
            suburb: insertedRest.suburb,
            physical_address: insertedRest.physical_address,
            lat: insertedRest.lat,
            lng: insertedRest.lng,
            is_open: insertedRest.is_open,
            phone: ''
        });

    if (locError) {
        console.error(`Failed to create location for ${place.name}:`, locError.message);
    } else {
        console.log(`         -> Successfully created location for ${place.name}`);
    }
}

async function run() {
    console.log('--- Starting Automated Restaurant Seeding ---');
    console.log('Target: Harare, Zimbabwe');
    
    let pageToken = null;
    let totalInserted = 0;
    let pagesFetched = 0;
    const MAX_PAGES = 3; // roughly 60 restaurants
    
    const queries = [
        "fast food in Harare",
        "Chicken Inn in Harare",
        "Chicken Slice in Harare",
        "KFC in Harare",
        "Pizza Inn in Harare",
        "Nandos in Harare",
        "Mambos Chicken in Harare",
        "Steers in Harare",
        "cafes in Harare",
        "takeaway in Harare",
        "restaurants in Avondale Harare",
        "restaurants in Borrowdale Harare"
    ];

    for (const query of queries) {
        console.log(`\n\n=== Executing Query: "${query}" ===`);
        pageToken = null;
        pagesFetched = 0;

        do {
            console.log(`Fetching Page ${pagesFetched + 1} for ${query}...`);
            const result = await fetchGoogleRestaurants(query, pageToken);
            
            if (result.status !== 'OK' && result.status !== 'ZERO_RESULTS') {
                console.error('Google API Error:', result.status, result.error_message);
                break;
            }
            
            const places = result.results || [];
            console.log(`Found ${places.length} places on this page.`);
            
            for (const place of places) {
                await insertRestaurant(place);
                totalInserted++;
            }
            
            pageToken = result.next_page_token;
            pagesFetched++;
            
            if (pageToken && pagesFetched < MAX_PAGES) {
                console.log('Waiting 2 seconds for next_page_token to become valid...');
                await sleep(2000); // Google requires a delay before using next_page_token
            } else {
                pageToken = null; // stop loop
            }
            
        } while (pageToken && pagesFetched < MAX_PAGES);
    }

    console.log(`\n--- Seeding Complete! Processed ${totalInserted} attempting inserts. ---`);
    process.exit(0);
}

run();
