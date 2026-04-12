import React, { useEffect } from 'react';
import { makeCall } from '../utils/callUtils';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Animated,
    Dimensions,
    Modal,
    Platform,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as ExpoLocation from 'expo-location';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, MapPin, Package, Bike, CheckCircle2, Search, Navigation, Clock, LocateFixed, X, Phone, Target } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/Map';
import { MapSkeleton } from '../components/MapSkeleton';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Polyline Decoder (reuse logic)
const decodePolyline = (t: string) => {
    let points = []; let index = 0, len = t.length; let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = t.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;
        shift = 0; result = 0;
        do { b = t.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;
        points.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
    }
    return points;
};

export const OrderTracking = ({ route, navigation }: any) => {
    const passedOrderId = route?.params?.orderId;
    const { user } = useAuthStore();
    const { theme, isDark } = useTheme();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    
    // Live tracking states
    const [driverLocation, setDriverLocation] = React.useState<any>(null);
    const [userLocation, setUserLocation] = React.useState<any>(null);
    const [isMapVisible, setIsMapVisible] = React.useState(false);
    const [routeCoords, setRouteCoords] = React.useState<any[]>([]);
    const [distance, setDistance] = React.useState<string>('');
    const [duration, setDuration] = React.useState<string>('');
    
    // Scalability Optimization: refs to track last fetch to avoid excessive Google Maps API calls
    const lastFetchRef = React.useRef<number>(0);
    const lastPosRef = React.useRef<{lat: number, lng: number} | null>(null);

    const mapRef = React.useRef<MapView | null>(null);
    const slideAnim = React.useRef(new Animated.Value(Dimensions.get('screen').height)).current;

    // In-App Calling States
    const [isCallModalVisible, setIsCallModalVisible] = React.useState(false);
    const [isInAppCalling, setIsInAppCalling] = React.useState(false);
    const [isIncomingCall, setIsIncomingCall] = React.useState(false);
    const [activeCallId, setActiveCallId] = React.useState<string | null>(null);
    const [callStartedAt, setCallStartedAt] = React.useState<Date | null>(null);
    const [isMapReady, setIsMapReady] = React.useState(false);

    const { data: activeOrder, isLoading: isActiveLoading } = useQuery({
        queryKey: ['active-order', user?.id],
        queryFn: async () => {
            if (passedOrderId) return null;
            const { data, error } = await supabase
                .from('orders')
                .select('id')
                .eq('customer_id', user?.id)
                .not('status', 'in', '("delivered","cancelled")')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !passedOrderId && !!user?.id
    });

    const resolvedOrderId = passedOrderId || activeOrder?.id;

    const { data: order, isLoading: isOrderLoading, refetch, isRefetching } = useQuery({
        queryKey: ['order', resolvedOrderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    *,
                    restaurants:restaurant_id (name, suburb, city, landmark_notes, owner_phone),
                    restaurant_locations:location_id (lat, lng, phone, physical_address, landmark_notes, suburb, city),
                    profiles:driver_id (id, full_name, phone, lat, lng)
                `)
                .eq('id', resolvedOrderId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!resolvedOrderId
    });

    useEffect(() => {
        if (!resolvedOrderId) return;

        const channel = supabase
            .channel(`order-${resolvedOrderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${resolvedOrderId}`
                },
                () => {
                    refetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [resolvedOrderId]);

    useEffect(() => {
        if (!order?.driver_id) return;
        
        // Initial set if available in profile query
        if (order.profiles?.lat && order.profiles?.lng) {
            const loc = {
                latitude: order.profiles.lat,
                longitude: order.profiles.lng
            };
            setDriverLocation(loc);
            
            /* Auto-centering removed to prevent disorienting auto-zooms
            if (isMapVisible && mapRef.current) {
                mapRef.current.animateToRegion({
                    ...loc,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                }, 1000);
            }
            */
        }

        const channel = supabase
            .channel(`driver-loc-${order.driver_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${order.driver_id}`
                },
                (payload: any) => {
                    console.log("[Tracking] Realtime update payload:", payload.new.lat, payload.new.lng);
                    if (payload.new.lat && payload.new.lng) {
                        const newLoc = {
                            latitude: Number(payload.new.lat),
                            longitude: Number(payload.new.lng)
                        };
                        setDriverLocation(newLoc);
                        
                        /* Auto-following removed to prevent disorienting auto-zooms
                        if (isMapVisible && mapRef.current) {
                            mapRef.current.animateToRegion({
                                ...newLoc,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01
                            }, 1000);
                        }
                        */
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [order?.driver_id, isMapVisible]);
    


    // Track user location for pickup orders
    useEffect(() => {
        if (!isMapVisible) return;
        let subscription: any;
        (async () => {
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            subscription = await ExpoLocation.watchPositionAsync(
                { accuracy: ExpoLocation.Accuracy.High, distanceInterval: 15 },
                (loc) => setUserLocation(loc.coords)
            );
        })();
        return () => subscription?.remove();
    }, [isMapVisible]);

    // Live Route Calculation - Delivery: driver->customer, Pickup: user->restaurant
    useEffect(() => {
        if (!isMapVisible) return;

        const isPickup = order?.fulfillment_type === 'pickup' ||
            String(order?.fulfillment_type || '').toLowerCase().trim() === 'pickup';

        // Choose moving entity position
        const movingLat = isPickup ? userLocation?.latitude : driverLocation?.latitude;
        const movingLng = isPickup ? userLocation?.longitude : driverLocation?.longitude;

        if (!movingLat || !movingLng) return;

        // SCALABILITY CHECK: Only fetch if:
        // 1. We haven't fetched in the last 60 seconds
        // 2. OR the entity has moved more than 100 meters
        const now = Date.now();
        const timeDiff = now - lastFetchRef.current;
        
        let shouldFetch = false;
        if (timeDiff > 60000) { // 60 seconds
            shouldFetch = true;
        } else if (lastPosRef.current) {
            const R = 6371e3; // meters
            const φ1 = lastPosRef.current.lat * Math.PI/180;
            const φ2 = movingLat * Math.PI/180;
            const Δφ = (movingLat-lastPosRef.current.lat) * Math.PI/180;
            const Δλ = (movingLng-lastPosRef.current.lng) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceMoved = R * c;
            
            if (distanceMoved > 100) { // 100 meters
                shouldFetch = true;
            }
        } else {
            shouldFetch = true; // First time
        }

        if (!shouldFetch) return;

        // Pickup: route from user location to restaurant
        if (isPickup) {
            const dest = order?.restaurant_locations || order?.delivery_address_snapshot;
            if (!userLocation || !dest?.lat) return;
            const fetchPickupRoute = async () => {
                try {
                    lastFetchRef.current = Date.now();
                    lastPosRef.current = { lat: movingLat, lng: movingLng };
                    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${userLocation.latitude},${userLocation.longitude}&destination=${dest.lat},${dest.lng}&key=${GOOGLE_API_KEY}`;
                    const resp = await fetch(url);
                    const json = await resp.json();
                    if (json.routes?.length > 0) {
                        const route = json.routes[0];
                        setRouteCoords(decodePolyline(route.overview_polyline.points));
                        if (route.legs?.length > 0) {
                            setDistance(route.legs[0].distance.text);
                            setDuration(route.legs[0].duration.text);
                        }
                    }
                } catch (err) {
                    console.error('[Tracking] Pickup route error:', err);
                }
            };
            fetchPickupRoute();
            return;
        }

        // Delivery: route from driver to customer
        if (!driverLocation || !order?.delivery_address_snapshot) return;
        const fetchRoute = async () => {
            try {
                lastFetchRef.current = Date.now();
                lastPosRef.current = { lat: movingLat, lng: movingLng };
                const dest = order.delivery_address_snapshot;
                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${dest.lat},${dest.lng}&key=${GOOGLE_API_KEY}`;
                const resp = await fetch(url);
                const json = await resp.json();
                if (json.status !== 'OK') return;
                if (json.routes?.length > 0) {
                    const route = json.routes[0];
                    setRouteCoords(decodePolyline(route.overview_polyline.points));
                    if (route.legs?.length > 0) {
                        setDistance(route.legs[0].distance.text);
                        setDuration(route.legs[0].duration.text);
                    }
                }
            } catch (err) {
                console.error('[Tracking] Delivery route error:', err);
            }
        };
        fetchRoute();
    }, [isMapVisible, driverLocation, userLocation?.latitude, userLocation?.longitude, order?.delivery_address_snapshot?.lat, order?.delivery_address_snapshot?.lng]);

    const toggleMap = (show: boolean) => {
        setIsMapVisible(show);
        Animated.spring(slideAnim, {
            toValue: show ? 0 : Dimensions.get('window').height,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start(() => {
            // After map slides in, try to fit coordinates
            if (show) {
                setTimeout(fitMarkers, 100);
            }
        });
    };

    const recenterMap = () => {
        if (routeCoords.length > 0 && mapRef.current) {
            mapRef.current.fitToCoordinates(routeCoords, {
                edgePadding: { top: 80, right: 50, bottom: 180, left: 50 },
                animated: true,
            });
        }
    };

    const fitMarkers = () => {
        if (!mapRef.current) return;
        const coords = [];
        const isPickup = order?.fulfillment_type === 'pickup' ||
            String(order?.fulfillment_type || '').toLowerCase().trim() === 'pickup';

        if (isPickup) {
            if (userLocation?.latitude) coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
            // Add restaurant location
            if (order?.restaurant_locations?.lat) {
                coords.push({ 
                    latitude: Number(order.restaurant_locations.lat), 
                    longitude: Number(order.restaurant_locations.lng) 
                });
            }
        } else {
            if (order?.delivery_address_snapshot?.lat) coords.push({ latitude: order.delivery_address_snapshot.lat, longitude: order.delivery_address_snapshot.lng });
            if (driverLocation?.latitude) coords.push(driverLocation);
        }
        
        if (coords.length > 0) {
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
                animated: true
            });
        }
    };

    const handleCall = async (type: 'direct' | 'in-app') => {
        setIsCallModalVisible(false);
        if (type === 'direct' && order?.profiles?.phone) {
            makeCall(order.profiles.phone);
        } else if (type === 'in-app') {
            if (!order?.driver_id) return;
            
            // Create signaling record
            const { data, error } = await supabase
                .from('in_app_calls')
                .insert({
                    caller_id: user.id,
                    receiver_id: order.driver_id,
                    order_id: order.id,
                    status: 'ringing'
                })
                .select()
                .single();

            if (error) {
                console.error("[Call] Failed to start call:", error);
                return;
            }

            setActiveCallId(data.id);
            // Add a small delay for modal transition stability
            setTimeout(() => {
                setIsInAppCalling(true);
                setIsIncomingCall(false);
            }, 300);
        }
    };

    const handleCallAction = async (action: 'accept' | 'decline' | 'end') => {
        if (!activeCallId) return;

        const now = new Date();
        const newStatus = action === 'accept' ? 'active' : (action === 'decline' ? 'declined' : 'ended');
        
        const updates: any = { 
            status: newStatus, 
            updated_at: now.toISOString() 
        };

        if (action === 'accept') {
            updates.started_at = now.toISOString();
        } else if (action === 'end' && callStartedAt) {
            updates.ended_at = now.toISOString();
            updates.duration_seconds = Math.floor((now.getTime() - callStartedAt.getTime()) / 1000);
        }

        const { error } = await supabase
            .from('in_app_calls')
            .update(updates)
            .eq('id', activeCallId);

        if (error) console.error("[Call] Status update failed:", error);

        if (action !== 'accept') {
            setIsInAppCalling(false);
            setIsIncomingCall(false);
            setActiveCallId(null);
            setCallStartedAt(null);
        } else {
            setIsIncomingCall(false);
            setCallStartedAt(now);
        }
    };

    if (isActiveLoading || isOrderLoading) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} size="large" />
        </View>
    );

    if (!order) return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text, marginLeft: 20 }]}>Order Tracking</Text>
            </View>
            <View style={[styles.center, { paddingHorizontal: 32 }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: `${theme.accent}15` }]}>
                    <Package size={64} color={theme.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Orders</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    Looks like your stomach is empty! Discover amazing local restaurants and get delicious food delivered fast.
                </Text>
                <TouchableOpacity
                    style={[styles.browseButton, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('Home', { screen: 'HomeMain' })}
                    activeOpacity={0.8}
                >
                    <Search size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.browseButtonText}>Browse Restaurants</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const statuses = order?.fulfillment_type === 'pickup' ? [
        { id: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
        { id: 'preparing', label: 'Preparing', icon: Package },
        { id: 'ready_for_pickup', label: 'Ready for Pickup', icon: MapPin },
        { id: 'delivered', label: 'Collected', icon: CheckCircle2 },
    ] : [
        { id: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
        { id: 'preparing', label: 'Preparing', icon: Package },
        { id: 'ready_for_pickup', label: 'Ready', icon: CheckCircle2 },
        { id: 'on_the_way', label: 'On the Way', icon: Bike },
        { id: 'delivered', label: 'Delivered', icon: MapPin },
    ];

    const getDisplayStatus = (status: string) => {
        if (['accepted', 'picked_up', 'ready_for_pickup'].includes(status)) return 'ready_for_pickup';
        return status;
    };

    const displayStatus = getDisplayStatus(order.status);
    const currentIdx = statuses.findIndex(s => s.id === displayStatus);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home', { screen: 'HomeMain' })}>
                    <ChevronLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Order Tracking</Text>
                <TouchableOpacity onPress={() => makeCall(order?.restaurant_locations?.phone || order?.restaurants?.owner_phone)}>
                    <Phone color={theme.accent} size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefetching} 
                        onRefresh={refetch}
                        tintColor={theme.accent}
                        colors={[theme.accent]}
                    />
                }
            >
                <View style={[styles.statusCard, { 
                    backgroundColor: theme.surface,
                    borderWidth: order.is_driver_at_customer ? 2 : 0,
                    borderColor: theme.accent
                }]}>
                    {order.is_driver_at_customer && (
                        <View style={{ 
                            backgroundColor: theme.accent, 
                            padding: 8, 
                            borderRadius: 8, 
                            marginBottom: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8
                        }}>
                            <Target size={18} color="#FFF" />
                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
                                DRIVER HAS ARRIVED!
                            </Text>
                        </View>
                    )}
                    {order.is_driver_at_restaurant && !order.is_driver_at_customer && (
                        <View style={{ 
                            backgroundColor: `${theme.accent}20`, 
                            padding: 8, 
                            borderRadius: 8, 
                            marginBottom: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderWidth: 1,
                            borderColor: theme.accent
                        }}>
                            <MapPin size={18} color={theme.accent} />
                            <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 13 }}>
                                Driver is at the Restaurant
                            </Text>
                        </View>
                    )}
                    <Text style={[styles.restaurantName, { color: theme.text }]}>{order.restaurants?.name}</Text>
                    <Text style={[styles.statusText, { color: theme.accent }]}>
                        {order.is_driver_at_customer ? 'DRIVER HAS ARRIVED! Please meet them at the delivery point.' :
                         order.is_driver_at_restaurant ? 'Driver has arrived at the restaurant and is picking up your order' :
                            displayStatus === 'confirmed' ? 'Restaurant is confirming your order' :
                            displayStatus === 'preparing' ? 'Your food is being prepared' :
                                displayStatus === 'ready_for_pickup' ? (
                                    order.fulfillment_type === 'pickup' ? 'Your order is ready for collection! Please head to the restaurant.' :
                                    order.status === 'picked_up' ? 'Biker has picked up your order and is preparing to head your way' :
                                    order.driver_id ? 'Driver has accepted and is heading to the restaurant' : 
                                    'Restaurant has finished preparing your food'
                                ) :
                                    displayStatus === 'on_the_way' ? 'Biker is on the way to you!' :
                                        order.fulfillment_type === 'pickup' ? 'Order Collected' : 'Order Delivered'}
                    </Text>

                    {order?.driver_id && (order.status === 'ready_for_pickup' || order.status === 'on_the_way' || order.status === 'picked_up') && (
                        <TouchableOpacity 
                            style={[styles.callBtn, { backgroundColor: `${theme.accent}15`, marginTop: 12 }]}
                            onPress={() => makeCall(order.profiles?.phone)}
                        >
                            <Phone size={14} color={theme.accent} />
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold' }}>Call Biker ({order.profiles?.full_name})</Text>
                        </TouchableOpacity>
                    )}

                    {order.status === 'on_the_way' && order.delivery_address_snapshot?.landmark_notes && (
                        <Text style={{ color: theme.textMuted, marginTop: 4, fontStyle: 'italic', fontSize: 13 }}>
                            Delivering to: {order.delivery_address_snapshot.landmark_notes}
                        </Text>
                    )}

                    <View style={styles.pinBox}>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>{order.fulfillment_type === 'pickup' ? 'Collection PIN' : 'Delivery PIN'}</Text>
                        <Text style={[styles.pinCode, { color: theme.text }]}>{order.delivery_pin}</Text>
                    </View>
                </View>

                <View style={styles.timeline}>
                    {statuses.map((status, idx) => {
                        const isCompleted = idx <= currentIdx;
                        const Icon = status.icon;

                        return (
                            <View key={status.id} style={styles.timelineItem}>
                                <View style={styles.timelineLeft}>
                                    <View style={[
                                        styles.timelineDot,
                                        { backgroundColor: isCompleted ? theme.accent : theme.border }
                                    ]}>
                                        <Icon size={14} color={isCompleted ? '#FFF' : theme.textMuted} />
                                    </View>
                                    {idx < statuses.length - 1 && (
                                        <View style={[
                                            styles.timelineLine,
                                            { backgroundColor: idx < currentIdx ? theme.accent : theme.border }
                                        ]} />
                                    )}
                                </View>
                                
                                <View style={styles.timelineContent}>
                                    <Text style={[
                                        styles.timelineLabel,
                                        { color: isCompleted ? theme.text : theme.textMuted, fontWeight: isCompleted ? 'bold' : 'normal' }
                                    ]}>
                                        {status.label}
                                    </Text>
                                    
                                    {/* Show map/nav from first step onwards for pickups; show for 'on_the_way' for deliveries */}
                                    {((order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup')
                                        ? status.id === 'confirmed' && currentIdx >= idx
                                        : status.id === 'on_the_way' && currentIdx >= idx
                                    ) && (
                                        <View style={styles.timelineActions}>
                                            <TouchableOpacity 
                                                style={[styles.liveMapBtn, { backgroundColor: `${theme.accent}15` }]}
                                                onPress={() => toggleMap(true)}
                                            >
                                                <Navigation size={14} color={theme.accent} />
                                                <Text style={[styles.liveMapBtnText, { color: theme.accent }]}>
                                                    {order.fulfillment_type === 'pickup' ? 'Restaurant Location' : 'Live Map'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>


            {/* Live Map Overlay */}
            <Animated.View style={[
                styles.mapOverlay, 
                { 
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: theme.background 
                }
            ]}>
                <MapSkeleton visible={!isMapReady} />
                <View style={styles.mapHeader}>
                    <TouchableOpacity style={styles.closeMapBtn} onPress={() => toggleMap(false)}>
                        <X color={theme.text} size={24} />
                    </TouchableOpacity>
                    <View style={styles.mapHeadingContainer}>
                        <Text style={[styles.mapTitle, { color: theme.text }]}>
                            {order.fulfillment_type === 'pickup' ? 'Pickup Location' : 'Live Tracking'}
                        </Text>
                        <Text style={[styles.mapSubtitle, { color: theme.textMuted }]}>
                            {order.fulfillment_type === 'pickup' ? 'Navigate to the restaurant' : 'Biker is on the way to you'}
                        </Text>
                    </View>
                </View>

                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    customMapStyle={Platform.OS === 'android' ? (isDark ? mapDarkStyle : mapLightStyle) : undefined}
                    onMapReady={() => setIsMapReady(true)}
                    initialRegion={{
                        latitude: (order.fulfillment_type === 'pickup' ? (order.delivery_address_snapshot?.lat || order.restaurants?.lat) : (driverLocation?.latitude || order?.delivery_address_snapshot?.lat)) || -17.8248,
                        longitude: (order.fulfillment_type === 'pickup' ? (order.delivery_address_snapshot?.lng || order.restaurants?.lng) : (driverLocation?.longitude || order?.delivery_address_snapshot?.lng)) || 31.0530,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    }}
                >
                    {/* Delivery: show customer address marker */}
                    {order.fulfillment_type === 'delivery' && order.delivery_address_snapshot?.lat && (
                        <Marker
                            coordinate={{
                                latitude: Number(order.delivery_address_snapshot.lat),
                                longitude: Number(order.delivery_address_snapshot.lng)
                            }}
                            tracksViewChanges={true}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinContainer}>
                                <View style={styles.destinationMarker}>
                                    <View style={styles.destinationMarkerInner} />
                                </View>
                            </View>
                        </Marker>
                    )}

                    {/* Pickup: show restaurant destination marker */}
                    {(order.isPickup || order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup') && (order.delivery_address_snapshot?.lat || order.restaurants?.lat) && (
                        <Marker
                            coordinate={{
                                latitude: Number(order.delivery_address_snapshot?.lat || order.restaurants?.lat),
                                longitude: Number(order.delivery_address_snapshot?.lng || order.restaurants?.lng)
                            }}
                            tracksViewChanges={true}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinContainer}>
                                <View style={styles.destinationMarker}>
                                    <View style={styles.destinationMarkerInner} />
                                </View>
                            </View>
                        </Marker>
                    )}

                    {/* Pickup: show user's current location marker */}
                    {(order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup') && userLocation?.latitude && (
                        <Marker
                            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
                            title="You"
                        >
                            <View style={[styles.driverMarker, { backgroundColor: '#3B82F6' }]}>
                                <LocateFixed color="#FFF" size={16} />
                            </View>
                        </Marker>
                    )}

                    {order.fulfillment_type === 'delivery' && driverLocation?.latitude && (
                        <Marker
                            coordinate={{
                                latitude: Number(driverLocation.latitude),
                                longitude: Number(driverLocation.longitude)
                            }}
                            title="Biker"
                            pinColor="#3B82F6"
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={[styles.driverMarker, { backgroundColor: theme.accent }]}>
                                <Bike color="#FFF" size={16} />
                            </View>
                        </Marker>
                    )}
                    {/* Route Polyline */}
                    {routeCoords.length > 0 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={4}
                            strokeColor={theme.accent}
                            lineJoin="round"
                            lineCap="round"
                        />
                    )}
                </MapView>


                {/* Floating Metrics + Navigate button for pickup */}
                {(distance || duration) && (
                    <View style={[styles.floatingMetrics, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.metricItem}>
                            <LocateFixed size={18} color={theme.accent} />
                            <Text style={[styles.metricText, { color: theme.text }]}>{distance}</Text>
                        </View>
                        <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.metricItem}>
                            <Clock size={18} color={theme.accent} />
                            <Text style={[styles.metricText, { color: theme.text }]}>{duration}</Text>
                        </View>
                        {(order.fulfillment_type === 'pickup' || String(order.fulfillment_type || '').toLowerCase().trim() === 'pickup') && (order.delivery_address_snapshot?.lat || order.restaurants?.lat) && (
                            <>
                                <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
                                <TouchableOpacity
                                    style={styles.metricItem}
                                    onPress={recenterMap}
                                >
                                    <Target size={18} color={theme.accent} />
                                    <Text style={[styles.metricText, { color: theme.accent }]}>Recenter</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </Animated.View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    content: { padding: 20 },
    statusCard: { padding: 24, borderRadius: 24, alignItems: 'center' },
    restaurantName: { fontSize: 20, fontWeight: 'bold' },
    statusText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
    pinBox: { marginTop: 24, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)', width: '100%' },
    pinCode: { fontSize: 24, fontWeight: 'bold', letterSpacing: 4, marginTop: 4 },
    timeline: { marginTop: 40, paddingHorizontal: 20 },
    timelineItem: { flexDirection: 'row', minHeight: 80, marginBottom: 8 },
    timelineLeft: { width: 32, alignItems: 'center' },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    timelineLine: {
        position: 'absolute',
        left: 15,
        top: 32,
        width: 2,
        height: '100%',
        zIndex: 1
    },
    timelineContent: { 
        flex: 1, 
        marginLeft: 16, 
        paddingBottom: 24,
        justifyContent: 'flex-start'
    },
    timelineLabel: { fontSize: 16, marginBottom: 4 },
    timelineActions: { 
        flexDirection: 'row', 
        gap: 12, 
        marginTop: 12,
        flexWrap: 'wrap'
    },
    emptyIconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    emptySubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    browseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    browseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    liveMapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    liveMapBtnText: {
        fontSize: 13,
        fontWeight: 'bold'
    },
    mapOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000
    },
    mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        zIndex: 1001
    },
    closeMapBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)'
    },
    mapHeadingContainer: {
        marginLeft: 16
    },
    mapTitle: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    mapSubtitle: {
        fontSize: 13
    },
    map: {
        flex: 1
    },
    userMarker: {
        width: 30,
        height: 30,
        backgroundColor: '#3B82F6',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 15,
        transform: [{ rotate: '45deg' }],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    driverMarker: {
        width: 30,
        height: 30,
        backgroundColor: '#3B82F6',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 15,
        transform: [{ rotate: '45deg' }],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10
    },
    destinationMarker: {
        width: 30,
        height: 30,
        backgroundColor: '#ef4444',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 15,
        transform: [{ rotate: '45deg' }],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    destinationMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFF',
        transform: [{ rotate: '-45deg' }],
    },
    pinContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
    },
    recenterBtn: {
        position: 'absolute',
        right: 20,
        top: 140,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 1002
    },
    floatingMetrics: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    metricText: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    metricDivider: {
        width: 1,
        height: 24
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center'
    },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        padding: 24,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        minHeight: 300
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8
    },
    modalSubtitle: {
        fontSize: 14,
        marginBottom: 24
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        gap: 16
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600'
    },
    optionDesc: {
        fontSize: 12
    },
    cancelBtn: {
        marginTop: 8,
        padding: 16,
        alignItems: 'center'
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600'
    },
    callUI: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 100,
        alignItems: 'center'
    },
    callHeader: {
        alignItems: 'center'
    },
    callStatus: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    callUserName: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: 8
    },
    callTimer: {
        color: '#FFF',
        fontSize: 18,
        marginTop: 12
    },
    callAvatarPlaceholder: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    callActions: {
        width: '100%',
        alignItems: 'center'
    },
    endCallBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10
    }
});
