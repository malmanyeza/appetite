import React, { useEffect, useRef } from 'react';

interface MapPickerProps {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
}

declare global {
    interface Window {
        google: any;
    }
}

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onChange }) => {
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

        // Click to move marker
        map.addListener('click', (e: any) => {
            const newPos = e.latLng;
            marker.setPosition(newPos);
            onChange(newPos.lat(), newPos.lng());
        });

        // Drag marker to update
        marker.addListener('dragend', (e: any) => {
            const newPos = e.latLng;
            onChange(newPos.lat(), newPos.lng());
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
        <div 
            ref={mapRef} 
            className="w-full h-80 rounded-2xl border border-white/10 shadow-inner mt-4 overflow-hidden"
            style={{ minHeight: '320px' }}
        />
    );
};
