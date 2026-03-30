import * as ExpoLocation from 'expo-location';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface GeocodeResult {
    city: string;
    suburb: string;
    physical_address: string;
}

export const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<GeocodeResult> => {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const isPlusCode = (text: string) => 
                /^[A-Z0-9]{4}\+[A-Z0-9]{2,3}/.test(text.trim()) || 
                (text.includes('+') && text.split(' ').length === 1);

            // Find best available result (skip ones that are primarily plus codes)
            const bestResult = data.results.find((r: any) => 
                !r.types.includes('plus_code') && 
                !isPlusCode(r.formatted_address.split(',')[0])
            ) || data.results[0];

            const components = bestResult.address_components;

            let city = '';
            let suburb = '';
            let neighborhood = '';
            let sublocality = '';
            let locality = '';
            let adminArea2 = '';
            let route = '';
            let premise = '';
            let subpremise = '';

            components.forEach((c: any, index: number) => {
                if (c.types.includes('locality')) locality = c.long_name;
                if (c.types.includes('administrative_area_level_2')) adminArea2 = c.long_name;
                if (c.types.includes('neighborhood')) neighborhood = c.long_name;
                if (c.types.includes('sublocality_level_1')) sublocality = c.long_name;
                if (c.types.includes('route')) route = c.long_name;
                if (c.types.includes('premise')) premise = c.long_name;
                if (c.types.includes('subpremise')) subpremise = c.long_name;
                if (c.types.includes('sublocality')) {
                    if (!sublocality) sublocality = c.long_name;
                }
                // HACK for Harare: Google often provides the suburb name in the first component with 0 types
                if (index === 0 && c.types.length === 0 && !neighborhood) {
                    // Only use it if it's not a plus code
                    if (!isPlusCode(c.long_name)) {
                        neighborhood = c.long_name;
                    }
                }
            });

            city = locality || adminArea2 || 'Harare';
            // Preference: Street name -> Neighborhood -> Premise -> Locality (if not city)
            let finalSuburb = route || neighborhood || sublocality || premise || subpremise || (locality !== city ? locality : '');
            
            // If still empty OR if it's a plus code, use the first part of the formatted address
            if ((!finalSuburb || isPlusCode(finalSuburb)) && bestResult.formatted_address) {
                const parts = bestResult.formatted_address.split(',');
                const firstPart = parts[0].trim();
                if (!isPlusCode(firstPart)) {
                    finalSuburb = firstPart;
                }
            }

            if (!finalSuburb || isPlusCode(finalSuburb)) finalSuburb = 'Nearby';
            
            // Clean up common over-verbose strings (e.g., "SOUTHLANDS SHOPS SOUTHLANDS" -> "Southlands")
            if (finalSuburb.toUpperCase().includes('SHOPS')) {
                const parts = finalSuburb.split(' ');
                if (parts.length > 1) {
                    finalSuburb = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
                }
            }

            suburb = finalSuburb;

            // Clean Plus Code from physical address if it's at the start
            let cleanAddress = bestResult.formatted_address;
            if (isPlusCode(cleanAddress.split(',')[0])) {
                cleanAddress = cleanAddress.split(',').slice(1).join(',').trim();
            }

            return {
                city,
                suburb,
                physical_address: cleanAddress
            };
        }
        
        if (data.status !== 'ZERO_RESULTS') {
            console.warn('[GeocodingService] Google Geocoding failed, falling back to native:', data.status, data.error_message || '');
        }
        
        // Fallback to native Expo geocoding
        const [rev] = await ExpoLocation.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng
        });

        if (rev) {
            const cityName = (rev.city === '1' || !rev.city) ? (rev.region === 'Harare' ? 'Harare' : rev.city) : rev.city;
            return {
                city: cityName || 'Harare',
                suburb: rev.district || rev.subregion || 'Nearby',
                physical_address: rev.name || rev.street || 'Nearby'
            };
        }

        throw new Error(`Google Geocoding failed (${data.status}) and native fallback failed.`);
    } catch (err) {
        console.error('[GeocodingService] Error:', err);
        return {
            city: 'Harare',
            suburb: 'Nearby',
            physical_address: 'Unknown location'
        };
    }
};
