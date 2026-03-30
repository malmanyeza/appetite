import React, { useEffect, useRef } from 'react';

interface MapPickerProps {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
    onPlaceSelected?: (details: {
        physical_address: string;
        city: string;
        suburb: string;
        lat: number;
        lng: number;
    }) => void;
}

declare global {
    interface Window {
        google: any;
    }
}

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onChange, onPlaceSelected }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<any>(null);
    const googleMapRef = useRef<any>(null);

    useEffect(() => {
        if (!window.google || !mapRef.current) return;

        const initialPos = { lat: lat || -17.8248, lng: lng || 31.0530 };

        const map = new window.google.maps.Map(mapRef.current, {
            center: initialPos,
            zoom: 15,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                {
                    featureType: 'administrative.locality',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }]
                },
                {
                    featureType: 'poi',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }]
                },
                {
                    featureType: 'poi.park',
                    elementType: 'geometry',
                    stylers: [{ color: '#263c3f' }]
                },
                {
                    featureType: 'poi.park',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#6b9a76' }]
                },
                {
                    featureType: 'road',
                    elementType: 'geometry',
                    stylers: [{ color: '#38414e' }]
                },
                {
                    featureType: 'road',
                    elementType: 'geometry.stroke',
                    stylers: [{ color: '#212a37' }]
                },
                {
                    featureType: 'road',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#9ca5b3' }]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'geometry',
                    stylers: [{ color: '#746855' }]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'geometry.stroke',
                    stylers: [{ color: '#1f2835' }]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#f3d19c' }]
                },
                {
                    featureType: 'transit',
                    elementType: 'geometry',
                    stylers: [{ color: '#2f3948' }]
                },
                {
                    featureType: 'transit.station',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#d59563' }]
                },
                {
                    featureType: 'water',
                    elementType: 'geometry',
                    stylers: [{ color: '#17263c' }]
                },
                {
                    featureType: 'water',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#515c6d' }]
                },
                {
                    featureType: 'water',
                    elementType: 'labels.text.stroke',
                    stylers: [{ color: '#17263c' }]
                }
            ],
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });

        googleMapRef.current = map;

        const marker = new window.google.maps.Marker({
            position: initialPos,
            map: map,
            draggable: true,
            animation: window.google.maps.Animation.DROP,
            icon: {
                path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 8,
                fillColor: '#FF4D00',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
            }
        });

        markerRef.current = marker;

        // --- Search & Geocoding Integration ---
        const geocoder = new window.google.maps.Geocoder();
        const input = document.getElementById('pac-input') as HTMLInputElement;

        const processPlace = (components: any[], address: string, newLat: number, newLng: number) => {
            let city = '';
            let suburb = '';
            let neighborhood = '';
            let sublocality = '';
            let locality = '';
            let adminArea2 = '';

            components?.forEach((c: any, index: number) => {
                if (c.types.includes('locality')) locality = c.long_name;
                if (c.types.includes('administrative_area_level_2')) adminArea2 = c.long_name;
                if (c.types.includes('neighborhood')) neighborhood = c.long_name;
                if (c.types.includes('sublocality_level_1')) sublocality = c.long_name;
                if (c.types.includes('sublocality')) {
                    if (!sublocality) sublocality = c.long_name;
                }
                // HACK for Harare: Google often provides the suburb name in the first component with 0 types
                if (index === 0 && c.types.length === 0 && !neighborhood) {
                    neighborhood = c.long_name;
                }
            });

            city = locality || adminArea2 || 'Harare';
            // If route (street name) is available, use it, then try neighborhood, then sublocality, then locality only if it's not the same as city
            let finalSuburb = route || neighborhood || sublocality || (locality !== city ? locality : '') || 'Nearby';
            
            // Clean up common over-verbose strings (e.g., "SOUTHLANDS SHOPS SOUTHLANDS" -> "Southlands")
            if (finalSuburb.toUpperCase().includes('SHOPS')) {
                const parts = finalSuburb.split(' ');
                if (parts.length > 1) {
                    finalSuburb = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
                }
            }
            suburb = finalSuburb;

            if (onPlaceSelected) {
                onPlaceSelected({
                    physical_address: address,
                    city,
                    suburb,
                    lat: newLat,
                    lng: newLng
                });
            }
        };

        if (input && window.google.maps.places) {
            const autocomplete = new window.google.maps.places.Autocomplete(input, {
                fields: ["address_components", "geometry", "name", "formatted_address"],
                origin: map.getCenter(),
                strictBounds: false,
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) {
                    return;
                }

                const newLat = place.geometry.location.lat();
                const newLng = place.geometry.location.lng();
                const newPos = { lat: newLat, lng: newLng };

                map.setCenter(newPos);
                map.setZoom(17);
                marker.setPosition(newPos);
                onChange(newLat, newLng);

                processPlace(place.address_components || [], place.formatted_address || '', newLat, newLng);
            });
        }

        const handleGeocode = (latLng: any) => {
            onChange(latLng.lat(), latLng.lng());
            if (onPlaceSelected) {
                geocoder.geocode({ location: latLng }, (results: any, status: string) => {
                    if (status === "OK" && results[0]) {
                        processPlace(results[0].address_components, results[0].formatted_address, latLng.lat(), latLng.lng());
                    } else {
                        console.warn("Geocoder failed due to: " + status);
                    }
                });
            }
        };

        // Click to move marker
        map.addListener('click', (e: any) => {
            const newPos = e.latLng;
            marker.setPosition(newPos);
            handleGeocode(newPos);
        });

        // Drag marker to update
        marker.addListener('dragend', (e: any) => {
            const newPos = e.latLng;
            handleGeocode(newPos);
        });

    }, []);

    // Sync marker position if lat/lng props change externally (e.g. via GPS button)
    useEffect(() => {
        if (markerRef.current && googleMapRef.current && lat && lng) {
            const newPos = { lat, lng };
            markerRef.current.setPosition(newPos);
            googleMapRef.current.panTo(newPos);
        }
    }, [lat, lng]);

    return (
        <div className="space-y-4">
            <div className="relative">
                <input
                    id="pac-input"
                    type="text"
                    placeholder="Search for a location..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors shadow-inner"
                />
            </div>
            <div 
                ref={mapRef} 
                className="w-full h-80 rounded-2xl border border-white/10 shadow-inner overflow-hidden"
                style={{ minHeight: '320px' }}
            />
        </div>
    );
};
