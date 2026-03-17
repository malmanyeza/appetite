import React, { useEffect } from 'react';
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
    Platform
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, MapPin, Package, Bike, CheckCircle2, Search, Navigation, Clock, LocateFixed, X, Phone } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/Map';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';

const GOOGLE_API_KEY = 'AIzaSyAfW8js09sB0cfQzz19aRBkSE7sDMy5cu0';

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
    
    // Live tracking states
    const [driverLocation, setDriverLocation] = React.useState<any>(null);
    const [isMapVisible, setIsMapVisible] = React.useState(false);
    const [routeCoords, setRouteCoords] = React.useState<any[]>([]);
    const [distance, setDistance] = React.useState<string>('');
    const [duration, setDuration] = React.useState<string>('');
    
    const mapRef = React.useRef<MapView | null>(null);
    const slideAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;
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

    const { data: order, isLoading: isOrderLoading, refetch } = useQuery({
        queryKey: ['order', resolvedOrderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurants (name, suburb, city, landmark_notes),
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
            
            // Initial map centering if visible
            if (isMapVisible && mapRef.current) {
                mapRef.current.animateToRegion({
                    ...loc,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                }, 1000);
            }
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
                        
                        // Follow movement
                        if (isMapVisible && mapRef.current) {
                            mapRef.current.animateToRegion({
                                ...newLoc,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01
                            }, 1000);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [order?.driver_id, isMapVisible]);
    


    // Live Route Calculation
    useEffect(() => {
        if (!isMapVisible || !driverLocation || !order?.delivery_address_snapshot) return;

        const fetchRoute = async () => {
            try {
                const dest = order.delivery_address_snapshot;
                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${dest.lat},${dest.lng}&key=${GOOGLE_API_KEY}`;
                
                console.log(`[Tracking] Fetching route: ${driverLocation.latitude},${driverLocation.longitude} -> ${dest.lat},${dest.lng}`);
                
                const resp = await fetch(url);
                const json = await resp.json();
                
                if (json.status !== 'OK') {
                    console.warn(`[Tracking] Directions API Status: ${json.status}`, json.error_message);
                    return;
                }

                if (json.routes && json.routes.length > 0) {
                    const route = json.routes[0];
                    const pts = decodePolyline(route.overview_polyline.points);
                    setRouteCoords(pts);
                    
                    if (route.legs && route.legs.length > 0) {
                        const leg = route.legs[0];
                        setDistance(leg.distance.text);
                        setDuration(leg.duration.text);
                        console.log(`[Tracking] Route updated: ${leg.distance.text}, ${leg.duration.text}`);
                    }
                } else {
                    console.log("[Tracking] No routes found");
                }
            } catch (err) {
                console.error("[Tracking] Directions Fetch Fatal Error:", err);
            }
        };

        fetchRoute();
        // Recalculate if driver moves significantly (handled by driverLocation dependency)
    }, [isMapVisible, driverLocation, order?.delivery_address_snapshot?.lat]);

    const toggleMap = (show: boolean) => {
        setIsMapVisible(show);
        Animated.spring(slideAnim, {
            toValue: show ? 0 : Dimensions.get('window').height,
            useNativeDriver: true,
            tension: 50,
            friction: 9
        }).start(() => {
            // After map slides in, try to fit coordinates
            if (show) {
                setTimeout(fitMarkers, 100);
            }
        });
    };

    const fitMarkers = () => {
        if (!mapRef.current) return;
        const coords = [];
        if (order?.delivery_address_snapshot?.lat) {
            coords.push({ 
                latitude: order.delivery_address_snapshot.lat, 
                longitude: order.delivery_address_snapshot.lng 
            });
        }
        if (driverLocation?.latitude) {
            coords.push(driverLocation);
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
            Linking.openURL(`tel:${order.profiles.phone}`);
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

    const statuses = [
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
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.restaurantName, { color: theme.text }]}>{order.restaurants?.name}</Text>
                    <Text style={[styles.statusText, { color: theme.accent }]}>
                        {displayStatus === 'confirmed' ? 'Restaurant is confirming your order' :
                            displayStatus === 'preparing' ? 'Your food is being prepared' :
                                displayStatus === 'ready_for_pickup' ? (
                                    order.status === 'picked_up' ? 'Biker has picked up your order and is preparing to head your way' :
                                    order.driver_id ? 'Driver has accepted and is heading to the restaurant' : 
                                    'Restaurant has finished preparing your food'
                                ) :
                                    displayStatus === 'on_the_way' ? 'Biker is on the way to you!' :
                                        'Order Delivered'}
                    </Text>

                    {order.status === 'on_the_way' && order.delivery_address_snapshot?.landmark_notes && (
                        <Text style={{ color: theme.textMuted, marginTop: 4, fontStyle: 'italic', fontSize: 13 }}>
                            Delivering to: {order.delivery_address_snapshot.landmark_notes}
                        </Text>
                    )}

                    <View style={styles.pinBox}>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Delivery PIN</Text>
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
                                    
                                    {status.id === 'on_the_way' && currentIdx >= idx && (
                                        <View style={styles.timelineActions}>
                                            <TouchableOpacity 
                                                style={[styles.liveMapBtn, { backgroundColor: `${theme.accent}15` }]}
                                                onPress={() => toggleMap(true)}
                                            >
                                                <LocateFixed size={14} color={theme.accent} />
                                                <Text style={[styles.liveMapBtnText, { color: theme.accent }]}>Live Map</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.backButton, { borderTopColor: theme.border }]}
                onPress={() => navigation.navigate('Home')}
            >
                <Text style={{ color: theme.accent, fontWeight: 'bold' }}>Back to Home</Text>
            </TouchableOpacity>

            {/* Live Map Overlay */}
            <Animated.View style={[
                styles.mapOverlay, 
                { 
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: theme.background 
                }
            ]}>
                <View style={styles.mapHeader}>
                    <TouchableOpacity style={styles.closeMapBtn} onPress={() => toggleMap(false)}>
                        <X color={theme.text} size={24} />
                    </TouchableOpacity>
                    <View style={styles.mapHeadingContainer}>
                        <Text style={[styles.mapTitle, { color: theme.text }]}>Live Tracking</Text>
                        <Text style={[styles.mapSubtitle, { color: theme.textMuted }]}>
                            Biker is on the way to you
                        </Text>
                    </View>
                </View>

                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                    initialRegion={{
                        latitude: driverLocation?.latitude || order?.delivery_address_snapshot?.lat || -17.8248,
                        longitude: driverLocation?.longitude || order?.delivery_address_snapshot?.lng || 31.0530,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    }}
                >
                    {order.delivery_address_snapshot?.lat && (
                        <Marker
                            coordinate={{
                                latitude: Number(order.delivery_address_snapshot.lat),
                                longitude: Number(order.delivery_address_snapshot.lng)
                            }}
                            title="You"
                            pinColor={theme.accent}
                        />
                    )}

                    {driverLocation?.latitude && (
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

                    {routeCoords.length > 0 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={6}
                            strokeColor={theme.accent}
                            lineJoin="round"
                            lineCap="round"
                        />
                    )}
                </MapView>

                {/* Floating Metrics */}
                {(distance || duration) && (
                    <View style={[styles.floatingMetrics, { backgroundColor: theme.surface }]}>
                        <View style={styles.metricItem}>
                            <LocateFixed size={18} color={theme.accent} />
                            <Text style={[styles.metricText, { color: theme.text }]}>{distance}</Text>
                        </View>
                        <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.metricItem}>
                            <Clock size={18} color={theme.accent} />
                            <Text style={[styles.metricText, { color: theme.text }]}>{duration}</Text>
                        </View>
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
    backButton: { padding: 20, alignItems: 'center', borderTopWidth: 1 },
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
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF'
    },
    driverMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
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
