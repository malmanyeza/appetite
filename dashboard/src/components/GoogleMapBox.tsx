import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Night mode styles for a professional look
const nightModeStyles = [
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
];

interface MarkerData {
    id: string;
    lat: number;
    lng: number;
    type: 'restaurant' | 'driver' | 'customer';
    title: string;
    details?: string;
    phone?: string;
    isOnline?: boolean; // New: To distinguish active drivers
    lastSeen?: string;  // New: For telemetry info
}

interface GoogleMapBoxProps {
    center?: { lat: number; lng: number };
    markers?: MarkerData[];
    autoFit?: boolean;
    route?: {
        origin: { lat: number; lng: number };
        waypoint?: { lat: number; lng: number };
        destination: { lat: number; lng: number };
    };
}

export const GoogleMapBox = forwardRef<any, GoogleMapBoxProps>(({ 
    center = { lat: -17.8252, lng: 31.0335 }, 
    markers = [],
    autoFit = false,
    route
}, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
    const infoWindowRef = useRef<any>(null);
    const directionsRendererRef = useRef<any>(null);

    // Expose the map instance functions to parents
    useImperativeHandle(ref, () => ({
        panTo: (pos: { lat: number, lng: number }) => {
            if (googleMapRef.current) {
                googleMapRef.current.panTo(pos);
                googleMapRef.current.setZoom(16);
            }
        }
    }));

    useEffect(() => {
        if (!window.google || !mapRef.current) return;

        // Initialize Map
        const map = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: 14,
            styles: nightModeStyles,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });

        googleMapRef.current = map;
        infoWindowRef.current = new window.google.maps.InfoWindow();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true, // We draw our own professional markers
            polylineOptions: {
                strokeColor: '#FF4D00',
                strokeWeight: 5,
                strokeOpacity: 0.8
            }
        });

        // Close info window when clicking anywhere on the map
        map.addListener('click', () => {
            if (infoWindowRef.current) {
                infoWindowRef.current.close();
            }
        });

        return () => {
            // Cleanup
            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current.clear();
        };
    }, []);

    // Focus Map logic
    useEffect(() => {
        if (googleMapRef.current && center && !route) {
            googleMapRef.current.panTo(center);
            googleMapRef.current.setZoom(15);
        }
    }, [center.lat, center.lng, !!route]);

    // Update Markers
    useEffect(() => {
        if (!googleMapRef.current || !window.google) return;

        const map = googleMapRef.current;
        const currentMarkerIds = new Set(markers.map(m => m.id));

        // Remove old markers
        markersRef.current.forEach((marker, id) => {
            if (!currentMarkerIds.has(id)) {
                marker.setMap(null);
                markersRef.current.delete(id);
            }
        });

        // Add/Update markers
        markers.forEach(data => {
            let marker = markersRef.current.get(data.id);
            const position = { lat: data.lat, lng: data.lng };

            if (!marker) {
                // Create new marker
                marker = new window.google.maps.Marker({
                    position,
                    map,
                    title: data.title,
                    animation: window.google.maps.Animation.DROP,
                    icon: {
                        path: data.type === 'restaurant' 
                            ? window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW 
                            : 'M12,2c-4.4,0-8,3.6-8,8c0,5.4,7,11.5,7.3,11.8c0.2,0.1,0.5,0.2,0.7,0.2c0.2,0,0.5-0.1,0.7-0.2C13,21.5,20,15.4,20,10 C20,5.6,16.4,2,12,2z M12,13c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S13.7,13,12,13z',
                        fillColor: data.type === 'restaurant' ? '#FF4D00' : (data.type === 'driver' ? (data.isOnline ? '#10B981' : '#9CA3AF') : '#3B82F6'),
                        fillOpacity: data.type === 'driver' && !data.isOnline ? 0.65 : 1,
                        strokeWeight: 3, // Heavier stroke for visibility
                        strokeColor: '#FFFFFF',
                        scale: data.type === 'driver' ? 1.5 : 2.2, // Make Store and Customer much larger
                        anchor: new window.google.maps.Point(12, 24),
                        labelOrigin: new window.google.maps.Point(12, 10)
                    },
                    label: data.type === 'driver' ? null : {
                        text: data.type === 'restaurant' ? 'S' : 'C',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '900'
                    }
                });

                marker.addListener('click', () => {
                    if (infoWindowRef.current) {
                        infoWindowRef.current.setContent(`
                            <div style="color: #111; padding: 10px; font-family: system-ui, sans-serif;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                                    <h4 style="margin: 0; font-weight: 800; font-size: 14px;">${data.title}</h4>
                                    <span style="font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${data.isOnline ? '#DCFCE7' : '#F3F4F6'}; color: ${data.isOnline ? '#166534' : '#4B5563'}; text-transform: uppercase;">
                                        ${data.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                <p style="margin: 4px 0; font-size: 11px; color: #666; font-weight: 500;">${data.details || ''}</p>
                                ${data.lastSeen ? `<p style="margin: 2px 0; font-size: 10px; color: #999; font-weight: 600;">🕒 Last Seen: ${data.lastSeen}</p>` : ''}
                                ${data.phone ? `<p style="margin: 8px 0 0 0; font-weight: bold; color: #FF4D00; font-size: 12px; border-top: 1px solid #eee; padding-top: 8px;">📞 ${data.phone}</p>` : ''}
                            </div>
                        `);
                        infoWindowRef.current.open(map, marker);
                    }
                });

                markersRef.current.set(data.id, marker);
            } else {
                // Update position for live tracking
                marker.setPosition(position);
            }
        });

        // Trigger Auto-Fit Bounds
        if (autoFit && markers.length > 0 && window.google && map) {
            const bounds = new window.google.maps.LatLngBounds();
            markers.forEach(m => {
                bounds.extend({ lat: m.lat, lng: m.lng });
            });
            
            // Pan and zoom to fit all markers
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
            
            // Prevent excessive zoom for single markers
            if (markers.length === 1) {
                map.setZoom(15);
            }
        }
    }, [markers, autoFit]);

    // Handle Routes & Directions
    useEffect(() => {
        if (!googleMapRef.current || !window.google || !route) {
            if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
            return;
        }

        const map = googleMapRef.current;
        const directionsService = new window.google.maps.DirectionsService();

        const request = {
            origin: route.origin,
            destination: route.destination,
            waypoints: route.waypoint ? [{ location: route.waypoint, stopover: true }] : [],
            travelMode: window.google.maps.TravelMode.DRIVING
        };

        directionsService.route(request, (result: any, status: any) => {
            if (status === 'OK') {
                directionsRendererRef.current.setDirections(result);
                
                // For a single order track, we ALWAYS want to fit the route in view
                const bounds = result.routes[0].bounds;
                map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
            }
        });
    }, [route?.origin.lat, route?.origin.lng, route?.destination.lat, route?.destination.lng, route?.waypoint?.lat]);

    return (
        <div 
            ref={mapRef} 
            className="w-full h-full"
            style={{ minHeight: '400px', backgroundColor: '#111' }}
        />
    );
});
