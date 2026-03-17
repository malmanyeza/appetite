import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ScrollView, 
    Alert, 
    Modal, 
    TextInput, 
    KeyboardAvoidingView, 
    TouchableWithoutFeedback, 
    Keyboard, 
    Platform, 
    Animated, 
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ArrowLeft, MapPin, Store, CheckCircle2, Navigation, FileText, X, LocateFixed, Bike } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/Map';
import * as ExpoLocation from 'expo-location';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';
import { useAuthStore } from '../store/authStore';
const GOOGLE_API_KEY = 'AIzaSyAfW8js09sB0cfQzz19aRBkSE7sDMy5cu0';

// Polyline Decoder
const decodePolyline = (t: string) => {
    let points = [];
    let index = 0, len = t.length;
    let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = t.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0; result = 0;
        do { b = t.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
    }
    return points;
};

export const ActiveDelivery = () => {
    const { theme, isDark } = useTheme();
    const { user } = useAuthStore();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const queryClient = useQueryClient();

    const orderId = route.params?.orderId;

    const { data: order, isLoading } = useQuery({
        queryKey: ['active-delivery', orderId],
        queryFn: async () => {
            if (!orderId) return null;
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurants:restaurant_id (name, suburb, city, landmark_notes, lat, lng),
                    profiles:customer_id (full_name, phone),
                    order_items (qty, name_snapshot)
                `)
                .eq('id', orderId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!orderId,
        refetchInterval: 5000
    });

    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [pinEntry, setPinEntry] = useState('');
    const [pinError, setPinError] = useState('');
    const [userLocation, setUserLocation] = useState<any>(null);
    const [routeCoords, setRouteCoords] = useState<any[]>([]);
    const [isNavigating, setIsNavigating] = useState(false);
    const [distance, setDistance] = useState<string>('');
    const [duration, setDuration] = useState<string>('');
    
    const mapRef = React.useRef<MapView | null>(null);
    const modalY = React.useRef(new Animated.Value(0)).current;
    
    const animateModal = (toValue: number) => {
        Animated.timing(modalY, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

    // Track user location
    useEffect(() => {
        let subscription: any;
        (async () => {
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            subscription = await ExpoLocation.watchPositionAsync(
                {
                    accuracy: ExpoLocation.Accuracy.High,
                    distanceInterval: 10,
                },
                (location) => {
                    const coords = {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude
                    };
                    setUserLocation(location.coords);
                    
                    if (user?.id) {
                        // Update main profile
                        supabase
                            .from('profiles')
                            .update(coords)
                            .eq('id', user.id)
                            .then(({ error }: any) => {
                                if (error) console.error("[Driver] Profiles Sync Error:", error);
                            });
                            
                        // Also update driver_profiles extension
                        supabase
                            .from('driver_profiles')
                            .update({
                                ...coords,
                                last_location_update: new Date().toISOString()
                            })
                            .eq('user_id', user.id)
                            .then(({ error }: any) => {
                                if (error) console.error("[Driver] DriverProfiles Sync Error:", error);
                            });
                    }
                }
            );
        })();
        return () => subscription?.remove();
    }, [user?.id]);

    // Phased road-based route logic
    useEffect(() => {
        if (!order || !userLocation) return;
        
        const isHeadingToRest = ['ready_for_pickup', 'accepted', 'pending'].includes(order.status);
        const isDrivingToCustomer = order.status === 'on_the_way';

        let dest = null;
        if (isHeadingToRest) {
            dest = { lat: order.restaurants?.lat, lng: order.restaurants?.lng };
        } else if (isDrivingToCustomer) {
            dest = { lat: order.delivery_address_snapshot?.lat, lng: order.delivery_address_snapshot?.lng };
        }

        if (dest && dest.lat && userLocation.latitude) {
            const fetchRoute = async () => {
                try {
                    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${userLocation.latitude},${userLocation.longitude}&destination=${dest.lat},${dest.lng}&key=${GOOGLE_API_KEY}`;
                    const resp = await fetch(url);
                    const json = await resp.json();
                    
                    if (json.routes && json.routes.length > 0) {
                        const route = json.routes[0];
                        const points = decodePolyline(route.overview_polyline.points);
                        setRouteCoords(points);
                        
                        // Extract metrics from the first leg
                        if (route.legs && route.legs.length > 0) {
                            setDistance(route.legs[0].distance.text);
                            setDuration(route.legs[0].duration.text);
                        }
                    } else {
                        // Fallback to straight line if API fails or no route found
                        setRouteCoords([
                            { latitude: userLocation.latitude, longitude: userLocation.longitude },
                            { latitude: dest.lat, longitude: dest.lng }
                        ]);
                    }
                } catch (err) {
                    console.error("Directions error:", err);
                    setRouteCoords([
                        { latitude: userLocation.latitude, longitude: userLocation.longitude },
                        { latitude: dest.lat, longitude: dest.lng }
                    ]);
                }
            };
            fetchRoute();
        } else {
            // Clear route and metrics if no active destination (e.g. status is picked_up)
            setRouteCoords([]);
            setDistance('');
            setDuration('');
        }
    }, [order?.status, userLocation?.latitude, userLocation?.longitude]);

    // Center map on route
    const handleRecenter = () => {
        if (routeCoords.length > 0 && mapRef.current) {
            mapRef.current.fitToCoordinates(routeCoords, {
                edgePadding: { top: 180, right: 50, bottom: 450, left: 50 },
                animated: true
            });
        }
    };

    useEffect(() => {
        handleRecenter();
    }, [routeCoords]);

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            const updates: any = { status: newStatus };
            if (newStatus === 'delivered') {
                updates.delivered_at = new Date().toISOString();
            }
            const { error } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', orderId);
            if (error) throw error;
            return newStatus;
        },
        onSuccess: (status) => {
            queryClient.invalidateQueries({ queryKey: ['active-delivery', orderId] });
            queryClient.invalidateQueries({ queryKey: ['active-driver-order'] });
            if (status === 'delivered') {
                if (isNavigating) return;
                setIsNavigating(true);
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'JobsMain' }],
                });
            }
        },
        onError: (err: any) => {
            setPinError(err.message || "Failed to update status.");
        }
    });

    // Auto-navigate away if status is delivered (backup for mutation) - REMOVED TO PREVENT CONFLICT
    /*
    useEffect(() => {
        if (order?.status === 'delivered') {
            navigation.reset({
                index: 0,
                routes: [{ name: 'JobsMain' }],
            });
        }
    }, [order?.status]);
    */

    if (isLoading) return <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={theme.accent} /></View>;
    if (!order) return <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.text }}>Order not found</Text></View>;

    const callNumber = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };


    const handleConfirmDelivery = () => {
        setPinError('');
        if (!pinEntry || pinEntry.trim().length !== 4) {
            setPinError("Please enter a valid 4-digit PIN.");
            return;
        }
        if (order.delivery_pin && pinEntry.trim() !== String(order.delivery_pin).trim()) {
            setPinError("The PIN entered does not match.");
            return;
        }
        setIsPinModalVisible(false);
        updateStatusMutation.mutate('delivered');
    };

    const isHeadingToRestaurant = ['pending', 'accepted', 'ready_for_pickup'].includes(order.status);
    const isPostPickupWaiting = order.status === 'picked_up';
    const isNavigatingToCustomer = order.status === 'on_the_way';

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Full Screen Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFillObject}
                customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                onRegionChangeStart={() => animateModal(Dimensions.get('window').height * 0.4)}
                onRegionChangeComplete={() => animateModal(0)}
            >
                {/* Route Polyline */}
                {routeCoords.length > 1 && (
                    <Polyline
                        coordinates={routeCoords}
                        strokeWidth={6}
                        strokeColor={theme.accent}
                        lineJoin="round"
                        lineCap="round"
                    />
                )}

                {/* Driver Live Marker */}
                {userLocation && (
                    <Marker
                        coordinate={{
                            latitude: userLocation.latitude,
                            longitude: userLocation.longitude
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={[styles.driverMarker, { backgroundColor: theme.accent }]}>
                            <Bike color="#FFF" size={16} />
                        </View>
                    </Marker>
                )}

                {/* Restaurant Marker */}
                {order.restaurants?.lat && (
                    <Marker
                        coordinate={{
                            latitude: order.restaurants.lat,
                            longitude: order.restaurants.lng
                        }}
                    >
                        <View style={[styles.markerContainer, { backgroundColor: isHeadingToRestaurant ? theme.accent : theme.surface }]}>
                            <Store color={isHeadingToRestaurant ? '#FFF' : theme.textMuted} size={20} />
                        </View>
                    </Marker>
                )}

                {/* Customer Marker */}
                {order.delivery_address_snapshot?.lat && (
                    <Marker
                        coordinate={{
                            latitude: order.delivery_address_snapshot.lat,
                            longitude: order.delivery_address_snapshot.lng
                        }}
                    >
                        <View style={[styles.markerContainer, { backgroundColor: isNavigatingToCustomer ? theme.accent : theme.surface }]}>
                            <MapPin color={isNavigatingToCustomer ? '#FFF' : theme.textMuted} size={20} />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* Floating Top Header - Orders Info */}
            <View style={[styles.floatingHeaderFull, { backgroundColor: theme.surface }]}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={styles.backButtonInline}
                >
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerOrderId, { color: theme.textMuted }]}>ORDER #{order.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={[styles.headerRestaurantName, { color: theme.text }]} numberOfLines={1}>
                        {order.restaurants?.name}
                    </Text>
                    {(distance || duration) && (
                        <Text style={[styles.metricsText, { color: theme.textMuted }]}>
                            {distance} • {duration}
                        </Text>
                    )}
                </View>
                <View style={[styles.phaseIndicator, { backgroundColor: theme.accent + '20' }]}>
                    <Text style={[styles.phaseText, { color: theme.accent }]}>
                        {isHeadingToRestaurant ? 'TO PICKUP' : 'TO CUSTOMER'}
                    </Text>
                </View>
            </View>

            {/* Recenter Button */}
            <TouchableOpacity 
                style={[styles.recenterBtn, { backgroundColor: theme.surface }]} 
                onPress={handleRecenter}
            >
                <LocateFixed color={theme.accent} size={24} />
            </TouchableOpacity>

            {/* Bottom Details Overlay */}
            <Animated.View 
                style={[
                    styles.bottomSheet, 
                    { 
                        backgroundColor: theme.background,
                        transform: [{ translateY: modalY }]
                    }
                ]}
            >
                <View style={styles.sheetHandle}>
                    <View style={[styles.handle, { backgroundColor: theme.border }]} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                    {/* Primary Info Card */}
                    <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
                        {(isHeadingToRestaurant || isPostPickupWaiting) ? (
                            <>
                                <View style={styles.cardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: theme.textMuted }]}>
                                            {isPostPickupWaiting ? 'PACKAGE SECURED AT' : 'PICKUP FROM'}
                                        </Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{order.restaurants?.name}</Text>
                                        <Text style={[styles.subValue, { color: theme.textMuted }]}>{order.restaurants?.suburb}, {order.restaurants?.city}</Text>
                                    </View>
                                    <Store color={theme.accent} size={32} />
                                </View>
                                {order.restaurants?.landmark_notes && (
                                    <View style={[styles.noteBox, { backgroundColor: theme.background }]}>
                                        <Text style={[styles.noteText, { color: theme.text }]}>"{order.restaurants.landmark_notes}"</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                <View style={styles.cardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: theme.textMuted }]}>DELIVER TO</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>
                                            {order.profiles?.full_name?.toUpperCase() || order.delivery_address_snapshot?.suburb?.toUpperCase()}
                                        </Text>
                                        <Text style={[styles.subValue, { color: theme.textMuted }]}>{order.delivery_address_snapshot?.street_address}</Text>
                                    </View>
                                    <MapPin color={theme.accent} size={32} />
                                </View>
                                {order.delivery_address_snapshot?.landmark_notes && (
                                    <View style={[styles.noteBox, { backgroundColor: theme.background }]}>
                                        <Text style={[styles.noteText, { color: theme.text }]}>"{order.delivery_address_snapshot.landmark_notes}"</Text>
                                    </View>
                                )}
                            </>
                        )}
                        
                        <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.label, { color: theme.textMuted }]}>CUSTOMER</Text>
                            <View style={styles.cardRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.value, { color: theme.text }]}>
                                        {order.profiles?.full_name}
                                    </Text>
                                    <Text style={[styles.subValue, { color: theme.textMuted }]}>
                                        {order.profiles?.phone}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Order Payout Section */}
                    <View style={[styles.payoutCard, { backgroundColor: theme.surface }]}>
                        <View>
                            <Text style={[styles.label, { color: theme.textMuted }]}>ESTIMATED EARNINGS</Text>
                            <Text style={[styles.payoutValue, { color: '#22c55e' }]}>
                                ${(order.pricing?.driver_earnings || order.pricing?.driverEarnings || 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={styles.itemBadge}>
                            <FileText color={theme.textMuted} size={14} />
                            <Text style={[styles.itemText, { color: theme.textMuted }]}>
                                {order.order_items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0} items
                            </Text>
                        </View>
                    </View>

                    {/* Status Primary Actions */}
                    <View style={{ marginTop: 8 }}>
                        {isHeadingToRestaurant ? (
                            <TouchableOpacity
                                style={[styles.mainActionBtn, { backgroundColor: theme.accent }]}
                                onPress={() => updateStatusMutation.mutate('on_the_way')}
                            >
                                <CheckCircle2 color="#FFF" size={24} style={{ marginRight: 8 }} />
                                <Text style={styles.mainActionText}>Confirm Pickup</Text>
                            </TouchableOpacity>
                        ) : order.status === 'picked_up' ? (
                            <TouchableOpacity
                                style={[styles.mainActionBtn, { backgroundColor: theme.accent }]}
                                onPress={() => updateStatusMutation.mutate('on_the_way')}
                            >
                                <Navigation color="#FFF" size={24} style={{ marginRight: 8 }} />
                                <Text style={styles.mainActionText}>Start Trip to Customer</Text>
                            </TouchableOpacity>
                        ) : order.status === 'on_the_way' ? (
                            <TouchableOpacity
                                style={[styles.mainActionBtn, { backgroundColor: '#22c55e' }]}
                                onPress={() => setIsPinModalVisible(true)}
                            >
                                <CheckCircle2 color="#FFF" size={24} style={{ marginRight: 8 }} />
                                <Text style={styles.mainActionText}>Complete Delivery</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </ScrollView>
            </Animated.View>


            {/* PIN Modal */}
            <Modal visible={isPinModalVisible} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlayCentered}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "padding"}
                            style={{ width: '100%', alignItems: 'center' }}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
                        >
                            <TouchableWithoutFeedback>
                                <View style={[styles.modalContentCentered, { backgroundColor: theme.surface }]}>
                                    <View style={{ alignItems: 'center', marginBottom: 8 }}>
                                        <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
                                    </View>
                                    
                                    <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>Enter Delivery PIN</Text>
                                    <Text style={[styles.modalText, { color: theme.textMuted, textAlign: 'center' }]}>Ask the customer for the 4-digit PIN shown in their app.</Text>

                                    <TextInput
                                        style={[styles.pinInput, { color: theme.text, borderColor: pinError ? '#ef4444' : theme.border, backgroundColor: theme.background }]}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        value={pinEntry}
                                        onChangeText={setPinEntry}
                                        placeholder="0000"
                                        placeholderTextColor={theme.textMuted}
                                        textAlign="center"
                                        autoFocus={true}
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />

                                    {!!pinError && (
                                        <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12, fontWeight: '600' }}>
                                            {pinError}
                                        </Text>
                                    )}

                                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#22c55e' }]} onPress={handleConfirmDelivery}>
                                        <Text style={styles.primaryButtonText}>Confirm Delivery</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={() => setIsPinModalVisible(false)}>
                                        <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    markerContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8
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
    },
    floatingHeaderFull: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        borderRadius: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 100
    },
    backButtonInline: {
        padding: 4
    },
    headerTitleContainer: {
        flex: 1
    },
    headerOrderId: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    headerRestaurantName: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    metricsText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2
    },
    phaseIndicator: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    phaseText: {
        fontSize: 10,
        fontWeight: '900'
    },
    driverMarker: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5
    },
    recenterBtn: {
        position: 'absolute',
        bottom: Dimensions.get('window').height * 0.45,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 100
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 20,
        maxHeight: '60%'
    },
    sheetHandle: {
        alignItems: 'center',
        paddingVertical: 12
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 3
    },
    sheetContent: {
        paddingHorizontal: 24,
        gap: 16
    },
    infoCard: {
        padding: 20,
        borderRadius: 24,
        gap: 16
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16
    },
    label: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 6
    },
    value: {
        fontSize: 18,
        fontWeight: '900'
    },
    subValue: {
        fontSize: 13,
        marginTop: 2
    },
    noteBox: {
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#E87A5D'
    },
    noteText: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 18
    },
    payoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderRadius: 24
    },
    payoutValue: {
        fontSize: 28,
        fontWeight: '900'
    },
    itemBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    itemText: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    mainActionBtn: {
        height: 64,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5
    },
    mainActionText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold'
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { padding: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 16 },
    modalSubtitle: { fontSize: 14, marginBottom: 16 },
    cancelBtn: { padding: 16, alignItems: 'center' },
    cancelText: { fontSize: 16, fontWeight: '600' },
    modalActionBtn: { height: 60, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    modalActionText: { fontSize: 16, fontWeight: 'bold' },
    modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContentCentered: { width: '100%', padding: 32, borderRadius: 32, gap: 20 },
    modalHandle: { width: 40, height: 6, borderRadius: 3, marginBottom: 8 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    modalText: { fontSize: 16, marginBottom: 16 },
    pinInput: { fontSize: 32, letterSpacing: 16, padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
    secondaryButton: { padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
    secondaryButtonText: { fontSize: 16, fontWeight: 'bold' },
    primaryButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
