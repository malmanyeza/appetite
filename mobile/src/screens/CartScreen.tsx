import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    TextInput,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    Keyboard,
    Dimensions,
    TouchableWithoutFeedback
} from 'react-native';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';
import { useTheme } from '../theme';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';
import * as ExpoLocation from 'expo-location';
import { ChevronLeft, Trash2, MapPin, Smartphone, CheckCircle2, DollarSign, CreditCard, Search, X, ChevronRight } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';


export const CartScreen = ({ navigation }: any) => {
    const { items, total, updateQty, clearCart } = useCartStore();
    const { profile } = useAuthStore();
    const { selectedLocation, setSelectedLocation } = useLocationStore();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = React.useState(false);
    const queryClient = useQueryClient();

    const { data: addresses } = useQuery({
        queryKey: ['addresses', profile?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', profile?.id)
                .order('is_default', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.id
    });

    const [selectedAddress, setSelectedAddress] = React.useState<any>(selectedLocation);
    const [paymentMethod, setPaymentMethod] = React.useState<'cod' | 'ecocash' | 'card'>('ecocash');
    const [ecocashPhone, setEcocashPhone] = React.useState('');
    const [deliveryFee, setDeliveryFee] = React.useState(0);
    const [serviceFee, setServiceFee] = React.useState(0.5);

    const [showEcocashModal, setShowEcocashModal] = React.useState(false);
    const [addressModalVisible, setAddressModalVisible] = React.useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = React.useState(false);
    const [mapRegion, setMapRegion] = React.useState<any>(null);
    const mapRef = React.useRef<MapView | null>(null);
    const googlePlacesRef = React.useRef<any>(null);
    const modalY = React.useRef(new Animated.Value(0)).current;

    const animateModal = (toValue: number) => {
        Animated.timing(modalY, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

    const [ecocashPending, setEcocashPending] = React.useState(false);
    const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (addressModalVisible) {
            animateModal(0);
        } else {
            animateModal(Dimensions.get('window').height);
        }
    }, [addressModalVisible]);

    // EcoCash Polling
    React.useEffect(() => {
        let interval: NodeJS.Timeout;

        if (ecocashPending && pendingOrderId) {
            interval = setInterval(async () => {
                try {
                    const { data, error } = await supabase
                        .from('orders')
                        .select('payment')
                        .eq('id', pendingOrderId)
                        .single();
                        
                    if (data?.payment?.status === 'paid') {
                        clearInterval(interval);
                        setEcocashPending(false);
                        setPendingOrderId(null);
                        WebBrowser.dismissBrowser();
                        clearCart();
                        navigation.navigate('Home', { screen: 'HomeMain' });
                        navigation.navigate('Tracking', { screen: 'TrackingMain', params: { orderId: pendingOrderId } });
                    } else if (data?.payment?.status === 'failed' || data?.payment?.status === 'cancelled') {
                        clearInterval(interval);
                        setEcocashPending(false);
                        setPendingOrderId(null);
                        WebBrowser.dismissBrowser();
                        Alert.alert('Payment Failed', 'Your payment failed or was cancelled. Please try again.');
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [ecocashPending, pendingOrderId]);

    // Fetch Delivery Settings & Restaurant Location
    const restaurantId = items[0]?.restaurant_id;
    const locationId = items[0]?.location_id;

    const { data: deliveryConfig } = useQuery({
        queryKey: ['delivery_config'],
        queryFn: async () => {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'delivery_fee_config').single();
            if (error) throw error;
            return data?.value || { base_fee: 1.5, per_km_fee: 0.4, service_fee: 0.5, surge_amount: 0 };
        }
    });

    const { data: restaurant } = useQuery({
        queryKey: ['restaurant_branch_location', locationId],
        queryFn: async () => {
            const { data, error } = await supabase.from('restaurant_locations').select('lat, lng').eq('id', locationId).single();
            if (error) throw error;
            if (!data) throw new Error('Restaurant branch not found');
            return data;
        },
        enabled: !!locationId
    });

    React.useEffect(() => {
        const channel = supabase
            .channel('cart_system_settings_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'system_settings',
                    filter: "key=eq.delivery_fee_config"
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['delivery_config'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Distance Calculation Logic
    React.useEffect(() => {
        if (selectedAddress && restaurant && deliveryConfig) {
            const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371; // km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            const distance = Math.round(getDistance(
                restaurant.lat,
                restaurant.lng,
                selectedAddress.lat,
                selectedAddress.lng
            ));

            const base = Number(deliveryConfig.base_fee) || 1.5;
            const perKm = Number(deliveryConfig.per_km_fee) || 0.4;
            const surge = Number(deliveryConfig.surge_amount) || 0;
            const srv = Number(deliveryConfig.service_fee) || 0.5;

            setDeliveryFee(base + (distance * perKm) + surge);
            setServiceFee(srv);
        }
    }, [selectedAddress, restaurant, deliveryConfig]);

    React.useEffect(() => {
        if (!selectedAddress && addresses && addresses.length > 0) {
            setSelectedAddress(addresses[0]);
        }
    }, [addresses, selectedAddress]);

    const handleCheckout = () => {
        if (items.length === 0) return;
        if (!selectedAddress) {
            Alert.alert('Address Required', 'Please add a delivery address before placing an order.', [
                { text: 'Add Address', onPress: () => navigation.navigate('AddressManagement') }
            ]);
            return;
        }
        
        if (paymentMethod === 'ecocash') {
            setShowEcocashModal(true);
            return;
        }

        processPayment();
    };

    const processPayment = async (phoneToUse?: string) => {
        setLoading(true);
        if (showEcocashModal) {
            setShowEcocashModal(false);
        }
        try {
            const session = (await supabase.auth.getSession()).data.session;
            if (!session) throw new Error('You must be logged in to place an order.');

            const response = await fetch(`${supabaseUrl}/functions/v1/place_order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({
                    items: items.map((item: any) => ({ id: item.id, qty: item.qty })),
                    address: {
                        label: selectedAddress.label,
                        city: selectedAddress.city,
                        suburb: selectedAddress.suburb,
                        street: selectedAddress.street,
                        landmark_notes: selectedAddress.landmark_notes,
                        lat: selectedAddress.lat,
                        lng: selectedAddress.lng
                    },
                    paymentMethod,
                    restaurantId: items[0].restaurant_id,
                    locationId: items[0].location_id,
                    phone: paymentMethod === 'ecocash' ? phoneToUse?.trim() : undefined
                })
            });

            const rawText = await response.text();
            let data: any;
            try { data = JSON.parse(rawText); } catch (_) {
                throw new Error(`Server error (${response.status})`);
            }

            if (!response.ok) throw new Error(data?.error || `Server error (${response.status})`);
            if (data?.error) throw new Error(data.error);

            // EcoCash Express: two-step client-side submission
            if (data?.ecocashExpress) {
                const { initUrl, initFields, initFieldOrder, expressUrl, phone, method, integrationKey } = data.ecocashExpress;

                // Step 1: initiatetransaction
                const initBody = initFieldOrder.map((k: string) => `${encodeURIComponent(k)}=${encodeURIComponent(initFields[k])}`).join('&');
                const initResp = await fetch(initUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: initBody
                });
                const initText = await initResp.text();
                const initParams = new URLSearchParams(initText);

                if (initParams.get('status') !== 'Ok') {
                    throw new Error(initParams.get('error') || 'Failed to initiate Paynow transaction.');
                }

                const pollUrl = initParams.get('pollurl') || '';

                // Step 2: remotetransaction (EcoCash Express)
                const expressFields: Record<string, string> = {
                    resulturl: initFields.resulturl,
                    returnurl: initFields.returnurl,
                    reference: initFields.reference,
                    amount: initFields.amount,
                    id: initFields.id,
                    additionalinfo: initFields.additionalinfo,
                    authemail: initFields.authemail,
                    status: 'Message',
                    method: method,
                    phone: phone,
                    pollurl: decodeURIComponent(pollUrl)
                };

                const expressFieldOrder = ['resulturl', 'returnurl', 'reference', 'amount', 'id', 'additionalinfo', 'authemail', 'status', 'method', 'phone', 'pollurl'];

                // Get hash from server
                const signResp = await fetch(`${supabaseUrl}/functions/v1/sign_paynow`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': supabaseAnonKey,
                    },
                    body: JSON.stringify({
                        fields: expressFields,
                        fieldOrder: expressFieldOrder
                    })
                });

                if (!signResp.ok) throw new Error('Failed to sign Paynow request.');
                const { hash } = await signResp.json();
                expressFields.hash = hash;

                const expressBody = [...expressFieldOrder, 'hash'].map((k: string) => `${encodeURIComponent(k)}=${encodeURIComponent(expressFields[k])}`).join('&');
                const expressResp = await fetch(expressUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: expressBody
                });
                const expressText = await expressResp.text();
                const expressParams = new URLSearchParams(expressText);
                
                console.log('EcoCash Express response:', expressText);

                if (expressParams.get('status') !== 'Ok') {
                    throw new Error(expressParams.get('error') || 'EcoCash payment initiation failed.');
                }

                setPendingOrderId(data.orderId);
                setEcocashPending(true);
                return;
            }

            // PAYNOW STANDARD CHECKOUT (Visa / Mastercard)
            if (data?.standardCheckout) {
                const { initUrl, initFields, initFieldOrder } = data.standardCheckout;

                const initBody = initFieldOrder.map((k: string) => `${encodeURIComponent(k)}=${encodeURIComponent(initFields[k])}`).join('&');
                const initResp = await fetch(initUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: initBody
                });
                const initText = await initResp.text();
                const initParams = new URLSearchParams(initText);

                if (initParams.get('status') !== 'Ok') {
                    throw new Error(initParams.get('error') || 'Failed to initiate Paynow checkout.');
                }

                const browserUrl = initParams.get('browserurl');
                if (!browserUrl) throw new Error('No browser URL returned from Paynow.');

                setPendingOrderId(data.orderId);
                setEcocashPending(true);
                
                // Open In-App Browser
                const result = await WebBrowser.openBrowserAsync(decodeURIComponent(browserUrl));
                
                // If user closes browser manually
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    setEcocashPending(false);
                    setPendingOrderId(null);
                }
                return;
            }

            clearCart();
            navigation.navigate('Home', { screen: 'HomeMain' });
            navigation.navigate('Tracking', { screen: 'TrackingMain', params: { orderId: data.orderId } });
        } catch (error: any) {
            console.error('Checkout Error:', error);
            Alert.alert('Checkout Error', error.message || 'Failed to process order.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ChevronLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Cart</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {items.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ color: theme.textMuted }}>Your cart is empty.</Text>
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.accent, marginTop: 20 }]}
                            onPress={() => navigation.navigate('Home')}
                        >
                            <Text style={styles.buttonText}>Find Food</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.itemsSection}>
                            {items.map((item) => (
                                <View key={item.id} style={[styles.cartItem, { borderBottomColor: theme.border }]}>
                                    <Image source={item.image_url} style={styles.itemImage} contentFit="cover" />
                                    <View style={styles.itemInfo}>
                                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                                        {item.selected_add_ons?.length > 0 && (
                                            <Text style={[styles.itemExtras, { color: theme.textMuted }]}>
                                                + {item.selected_add_ons.map((a: any) => a.name).join(', ')}
                                            </Text>
                                        )}
                                        <Text style={[styles.itemPrice, { color: theme.accent }]}>
                                            ${(item.price + (item.selected_add_ons?.reduce((s: number, a: any) => s + a.price, 0) || 0)).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.qtyControls}>
                                        <TouchableOpacity onPress={() => updateQty(item.id, -1)}>
                                            <Text style={[styles.qtyBtn, { color: theme.text }]}>-</Text>
                                        </TouchableOpacity>
                                        <Text style={[styles.qtyText, { color: theme.text }]}>{item.qty}</Text>
                                        <TouchableOpacity onPress={() => updateQty(item.id, 1)}>
                                            <Text style={[styles.qtyBtn, { color: theme.text }]}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={[styles.section, { borderTopColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Address</Text>
                            <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
                                <MapPin size={20} color={theme.accent} />
                                <View style={{ flex: 1 }}>
                                    {selectedAddress ? (
                                        <Text style={[styles.infoCardText, { color: theme.text }]}>
                                            {selectedAddress.street}, {selectedAddress.suburb}
                                        </Text>
                                    ) : (
                                        <Text style={[styles.infoCardText, { color: '#EF4444' }]}>No address selected</Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setAddressModalVisible(true)}>
                                    <Text style={{ color: theme.accent, fontWeight: 'bold' }}>{selectedAddress ? 'Change' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.section, { borderTopColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
                            <View style={styles.paymentMethods}>
                                {[
                                    { id: 'card', label: 'Visa / Mastercard', icon: CreditCard },
                                    { id: 'ecocash', label: 'EcoCash', icon: Smartphone },
                                    { id: 'cod', label: 'Cash on Delivery', icon: DollarSign }
                                ].map((method) => (
                                    <TouchableOpacity
                                        key={method.id}
                                        style={[
                                            styles.infoCard,
                                            { backgroundColor: theme.surface, marginBottom: 8 },
                                            paymentMethod === method.id && { borderColor: theme.accent, borderWidth: 1 }
                                        ]}
                                        onPress={() => setPaymentMethod(method.id as any)}
                                    >
                                        <method.icon size={20} color={paymentMethod === method.id ? theme.accent : theme.textMuted} />
                                        <Text style={[styles.infoCardText, { color: theme.text }]}>{method.label}</Text>
                                        {paymentMethod === method.id && <CheckCircle2 size={20} color={theme.accent} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.summaryBox}>
                            <View style={styles.summaryRow}>
                                <Text style={{ color: theme.textMuted }}>Subtotal</Text>
                                <Text style={{ color: theme.text }}>${total.toFixed(2)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={{ color: theme.textMuted }}>Delivery Fee</Text>
                                <Text style={{ color: theme.text }}>${deliveryFee.toFixed(2)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={{ color: theme.textMuted }}>Service Fee</Text>
                                <Text style={{ color: theme.text }}>${serviceFee.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.summaryRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }]}>
                                <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                                <Text style={[styles.totalValue, { color: theme.accent }]}>${(total + deliveryFee + serviceFee).toFixed(2)}</Text>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>

            {items.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                        onPress={handleCheckout}
                    >
                        <Text style={styles.buttonText}>
                            {paymentMethod === 'ecocash' ? 'Pay with EcoCash' : paymentMethod === 'card' ? 'Pay with Card' : 'Place Order'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {ecocashPending && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <Text style={{ color: 'white', marginTop: 16, fontSize: 18, fontWeight: 'bold' }}>
                        {paymentMethod === 'card' ? 'Awaiting Payment...' : 'Awaiting EcoCash...'}
                    </Text>
                    <Text style={{ color: theme.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                        {paymentMethod === 'card' 
                            ? 'Please complete the secure Visa/Mastercard checkout in the browser window.'
                            : 'Please check your phone for the EcoCash prompt and enter your PIN to complete the transaction.'}
                    </Text>
                    <TouchableOpacity 
                        style={{ marginTop: 32, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }} 
                        onPress={() => {
                            setEcocashPending(false);
                            setPendingOrderId(null);
                            if (paymentMethod === 'card') {
                                WebBrowser.dismissBrowser();
                            }
                        }}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel Waiting</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={addressModalVisible} animationType="slide" transparent={false}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1, backgroundColor: theme.background }}>
                        {/* Full Screen Map */}
                        <MapView
                            ref={mapRef}
                            provider={PROVIDER_GOOGLE}
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={mapRegion || {
                                latitude: selectedAddress?.lat || -17.8248,
                                longitude: selectedAddress?.lng || 31.0530,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                            mapPadding={{ top: 0, right: 0, left: 0, bottom: Dimensions.get('window').height * 0.4 }}
                            customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                            onRegionChangeComplete={(region) => setMapRegion(region)}
                        >
                            {selectedAddress?.lat && selectedAddress?.lng && (
                                <Marker
                                    coordinate={{
                                        latitude: selectedAddress.lat,
                                        longitude: selectedAddress.lng
                                    }}
                                    pinColor={theme.accent}
                                />
                            )}
                        </MapView>

                        <View style={styles.modalHeaderExtra}>
                            <TouchableOpacity 
                                onPress={() => setAddressModalVisible(false)}
                                style={[styles.backCircle, { backgroundColor: theme.surface }]}
                            >
                                <X color={theme.text} size={24} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <GooglePlacesAutocomplete
                                    ref={googlePlacesRef}
                                    placeholder="Search delivery address..."
                                    fetchDetails={true}
                                    minLength={2}
                                    enablePoweredByContainer={false}
                                    onPress={(data, details = null) => {
                                        if (details) {
                                            const newLoc = {
                                                label: data.structured_formatting.main_text,
                                                city: details.address_components.find(c => c.types.includes('locality'))?.long_name || '',
                                                suburb: data.structured_formatting.main_text,
                                                street: details.address_components.find(c => c.types.includes('route'))?.long_name || '',
                                                lat: details.geometry.location.lat,
                                                lng: details.geometry.location.lng,
                                            };
                                            setSelectedAddress(newLoc);
                                            const region = {
                                                latitude: newLoc.lat,
                                                longitude: newLoc.lng,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            };
                                            setMapRegion(region);
                                            mapRef.current?.animateToRegion(region, 500);
                                        }
                                    }}
                                    query={{
                                        key: 'AIzaSyAfW8js09sB0cfQzz19aRBkSE7sDMy5cu0',
                                        language: 'en',
                                        components: 'country:zw',
                                        types: 'establishment|geocode',
                                    }}
                                    styles={{
                                        container: { flex: 0 },
                                        textInput: {
                                            height: 48,
                                            backgroundColor: theme.surface,
                                            color: theme.text,
                                            borderRadius: 24,
                                            paddingLeft: 20,
                                            fontSize: 14,
                                            elevation: 5,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 4
                                        },
                                        listView: {
                                            backgroundColor: theme.background,
                                            borderRadius: 12,
                                            marginTop: 8,
                                            elevation: 10,
                                            zIndex: 3000
                                        },
                                        row: { backgroundColor: theme.background, padding: 13, height: 48, flexDirection: 'row' },
                                        description: { color: theme.text }
                                    }}
                                />
                            </View>
                        </View>

                        <Animated.View 
                            style={[
                                styles.addressPickerSheet, 
                                { 
                                    backgroundColor: theme.background,
                                    transform: [{ translateY: modalY }]
                                }
                            ]}
                        >
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>Delivery Details</Text>
                            <Text style={{ color: theme.textMuted, marginBottom: 20 }}>Pick a spot or choose a saved one</Text>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                <View style={{ gap: 20, paddingBottom: 40 }}>
                                    {/* Saved Addresses List */}
                                    {addresses && addresses.length > 0 && (
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Saved Addresses</Text>
                                            {addresses.map((addr: any) => (
                                                <TouchableOpacity
                                                    key={addr.id}
                                                    style={[
                                                        styles.savedAddressItem,
                                                        { backgroundColor: theme.surface },
                                                        selectedAddress?.id === addr.id && { borderColor: theme.accent, borderWidth: 1 }
                                                    ]}
                                                    onPress={() => setSelectedAddress(addr)}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.border + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                        <MapPin size={20} color={theme.textMuted} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.text, fontWeight: '500' }}>{addr.label} • {addr.suburb}</Text>
                                                        <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>{addr.street ? `${addr.street}, ` : ''}{addr.city}</Text>
                                                    </View>
                                                    {selectedAddress?.id === addr.id && <CheckCircle2 size={16} color={theme.accent} />}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* GPS Capture */}
                                    <TouchableOpacity
                                        style={[styles.gpsCaptureBtn, { backgroundColor: theme.surface }]}
                                        onPress={async () => {
                                            setIsFetchingLocation(true);
                                            try {
                                                const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                                                if (status === 'granted') {
                                                    const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
                                                    const [rev] = await ExpoLocation.reverseGeocodeAsync({
                                                        latitude: loc.coords.latitude,
                                                        longitude: loc.coords.longitude
                                                    });
                                                    if (rev) {
                                                        const newLoc = {
                                                            city: rev.city || 'Current Location',
                                                            suburb: rev.district || rev.subregion || 'Nearby',
                                                            street: rev.name || '',
                                                            lat: loc.coords.latitude,
                                                            lng: loc.coords.longitude
                                                        };
                                                        setSelectedAddress(newLoc);
                                                        const region = {
                                                            latitude: loc.coords.latitude,
                                                            longitude: loc.coords.longitude,
                                                            latitudeDelta: 0.01,
                                                            longitudeDelta: 0.01,
                                                        };
                                                        setMapRegion(region);
                                                        mapRef.current?.animateToRegion(region, 500);
                                                    }
                                                } else {
                                                    Alert.alert('Permission Denied', 'Location permission is required.');
                                                }
                                            } catch (error) {
                                                console.error('GPS Error:', error);
                                            } finally {
                                                setIsFetchingLocation(false);
                                            }
                                        }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                                            {isFetchingLocation ? (
                                                <ActivityIndicator size="small" color={theme.accent} />
                                            ) : (
                                                <MapPin size={20} color={theme.accent} />
                                            )}
                                        </View>
                                        <Text style={{ color: theme.text, fontWeight: '600' }}>
                                            {isFetchingLocation ? 'Locating...' : 'Use Current GPS Location'}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Confirm Button */}
                                    <TouchableOpacity
                                        style={[styles.confirmAddressBtn, { backgroundColor: theme.accent }]}
                                        onPress={() => {
                                            if (selectedAddress) {
                                                setSelectedLocation(selectedAddress);
                                                setAddressModalVisible(false);
                                            } else {
                                                Alert.alert('Pick a spot', 'Please select a location on the map or from the list.');
                                            }
                                        }}
                                    >
                                        <Text style={{ color: 'white', fontSize: 17, fontWeight: 'bold' }}>Confirm Address</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={showEcocashModal} animationType="slide" transparent>
                <KeyboardAvoidingView 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={{ backgroundColor: theme.background, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold' }}>Enter EcoCash Number</Text>
                            <TouchableOpacity onPress={() => setShowEcocashModal(false)}>
                                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: theme.textMuted, marginBottom: 12 }}>Please enter the phone number registered with EcoCash to receive the push prompt.</Text>
                        
                        <TextInput
                            style={[
                                styles.ecocashInput,
                                { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, borderWidth: 1, marginBottom: 24 }
                            ]}
                            placeholder="e.g. 0771234567"
                            placeholderTextColor={theme.textMuted}
                            value={ecocashPhone}
                            onChangeText={setEcocashPhone}
                            keyboardType="phone-pad"
                            maxLength={12}
                            autoFocus
                        />

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: loading ? 0.7 : 1 }]}
                            onPress={() => {
                                if (!ecocashPhone.trim() || ecocashPhone.trim().length < 9) {
                                    Alert.alert('Invalid Number', 'Please enter a valid phone number.');
                                    return;
                                }
                                processPayment(ecocashPhone);
                            }}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.buttonText}>Confirm Payment</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { padding: 20 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    itemsSection: { marginBottom: 32 },
    cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    itemImage: { width: 60, height: 60, borderRadius: 12 },
    itemInfo: { flex: 1, marginLeft: 16 },
    itemName: { fontSize: 16, fontWeight: '600' },
    itemExtras: { fontSize: 12, marginTop: 2, fontStyle: 'italic', opacity: 0.6 },
    itemPrice: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    qtyBtn: { fontSize: 20, fontWeight: 'bold', width: 24, textAlign: 'center' },
    qtyText: { fontSize: 16, fontWeight: '600' },
    section: { marginTop: 24, paddingTop: 24, borderTopWidth: 1 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    infoCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 12 },
    infoCardText: { flex: 1, fontSize: 14 },
    paymentMethods: { gap: 8 },
    summaryBox: { marginTop: 32, padding: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold' },
    phoneInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 16, marginTop: 16 },
    ecocashContainer: {
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
    },
    ecocashHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    ecocashTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    ecocashInput: {
        height: 56,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        marginTop: 8,
        fontWeight: '500',
    },
    primaryButton: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    footer: { padding: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: '#000' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalHeaderExtra: { 
        position: 'absolute', 
        top: 50, 
        left: 20, 
        right: 20, 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 12 
    },
    backCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    addressPickerSheet: { 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: Dimensions.get('window').height * 0.65,
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        padding: 24,
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12
    },
    savedAddressItem: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    gpsCaptureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    confirmAddressBtn: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    }
});
