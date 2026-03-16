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
    Dimensions 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ArrowLeft, MapPin, Store, Phone, CheckCircle2, Navigation, FileText, X, ChevronUp, ChevronDown } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';

export const ActiveDelivery = () => {
    const { theme, isDark } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const queryClient = useQueryClient();

    // We expect the order object or order_id to be passed in navigation, or we can fetch the currently active one here.
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
        refetchInterval: 5000 // Poll every 5 seconds just in case
    });

    const [isPickupModalVisible, setIsPickupModalVisible] = useState(false);
    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [pinEntry, setPinEntry] = useState('');
    const [pinError, setPinError] = useState('');
    
    const mapRef = React.useRef<MapView | null>(null);
    const modalY = React.useRef(new Animated.Value(0)).current;
    
    const animateModal = (toValue: number) => {
        Animated.timing(modalY, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

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
            if (status === 'delivered') {
                navigation.replace('DeliveryCompleted', { orderId });
            }
        },
        onError: (err: any) => {
            setPinError(err.message || "Failed to update status. Please check your connection.");
        }
    });

    if (isLoading) return <View style={[styles.container, { backgroundColor: theme.background }]}><Text style={{ color: theme.text }}>Loading...</Text></View>;
    if (!order) return <View style={[styles.container, { backgroundColor: theme.background }]}><Text style={{ color: theme.text }}>Order not found</Text></View>;

    const openMaps = (lat: number, lng: number) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        Linking.openURL(url);
    };

    const callNumber = (phone: string) => {
        Linking.openURL(`tel:${phone}`);
    };

    const handleConfirmPickup = () => {
        setIsPickupModalVisible(false);
        updateStatusMutation.mutate('picked_up');
    };

    const handleConfirmDelivery = () => {
        setPinError('');
        if (!pinEntry || pinEntry.trim().length !== 4) {
            setPinError("Please enter a valid 4-digit PIN.");
            return;
        }
        if (order.delivery_pin && pinEntry.trim() !== String(order.delivery_pin).trim()) {
            setPinError("The PIN entered does not match the customer's PIN.");
            return;
        }
        setIsPinModalVisible(false);
        updateStatusMutation.mutate('delivered');
    };

    const isHeadingToRestaurant = ['pending', 'accepted', 'ready_for_pickup'].includes(order.status);
    const isNavigatingToCustomer = ['picked_up', 'on_the_way'].includes(order.status);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Full Screen Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFillObject}
                customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                mapPadding={{ top: 100, right: 0, left: 0, bottom: Dimensions.get('window').height * 0.4 }}
                onRegionChangeStart={() => animateModal(Dimensions.get('window').height * 0.5)}
                onRegionChangeComplete={() => animateModal(0)}
            >
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

            {/* Floating Top Header */}
            <View style={styles.floatingHeader}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={[styles.backButtonFloating, { backgroundColor: theme.surface }]}
                >
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <View style={[styles.statusBadge, { backgroundColor: theme.surface }]}>
                    <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                    <Text style={[styles.statusText, { color: theme.text }]}>
                        {isHeadingToRestaurant ? 'Heading to Pickup' : 'Heading to Delivery'}
                    </Text>
                </View>
            </View>

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
                        {isHeadingToRestaurant ? (
                            <>
                                <View style={styles.cardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: theme.textMuted }]}>PICKUP FROM</Text>
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
                                        <Text style={[styles.value, { color: theme.text }]}>{order.delivery_address_snapshot?.suburb?.toUpperCase()}</Text>
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

                        <View style={styles.actionRow}>
                            <TouchableOpacity 
                                style={[styles.actionBtn, { backgroundColor: theme.background }]} 
                                onPress={() => callNumber(isHeadingToRestaurant ? '0000000000' : order.profiles?.phone || '')}
                            >
                                <Phone color={theme.text} size={20} />
                                <Text style={[styles.actionBtnText, { color: theme.text }]}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.actionBtn, { backgroundColor: theme.accent + '20' }]} 
                                onPress={() => {
                                    const loc = isHeadingToRestaurant ? order.restaurants : order.delivery_address_snapshot;
                                    openMaps(loc.lat, loc.lng);
                                }}
                            >
                                <Navigation color={theme.accent} size={20} />
                                <Text style={[styles.actionBtnText, { color: theme.accent }]}>Navigate</Text>
                            </TouchableOpacity>
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
                                onPress={() => setIsPickupModalVisible(true)}
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

            {/* Pickup Modal */}
            <Modal visible={isPickupModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Pickup</Text>
                        <Text style={[styles.modalText, { color: theme.textMuted }]}>Make sure you received all items and the order is sealed.</Text>
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={handleConfirmPickup}>
                            <Text style={styles.primaryButtonText}>Yes, Pickup Confirmed</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={() => setIsPickupModalVisible(false)}>
                            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
    floatingHeader: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    backButtonFloating: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    statusText: {
        fontSize: 14,
        fontWeight: 'bold'
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
        fontSize: 20,
        fontWeight: '900'
    },
    subValue: {
        fontSize: 14,
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
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: 'bold'
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
