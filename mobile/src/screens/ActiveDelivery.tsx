import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ArrowLeft, MapPin, Store, Phone, CheckCircle2, Navigation, FileText } from 'lucide-react-native';
import * as Linking from 'expo-linking';

export const ActiveDelivery = () => {
    const { theme } = useTheme();
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

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
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
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.title, { color: theme.text }]}>Active Delivery</Text>
                    <Text style={[styles.subtitle, { color: theme.accent }]}>
                        {isHeadingToRestaurant ? 'Head to Restaurant' : 'Navigate to Customer'}
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Stepper Timeline (Simplified) */}
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                    <View style={styles.step}>
                        <CheckCircle2 color={isHeadingToRestaurant ? theme.textMuted : theme.accent} size={20} />
                        <Text style={[styles.stepText, { color: isHeadingToRestaurant ? theme.text : theme.textMuted }]}>Head to Restaurant</Text>
                    </View>
                    <View style={styles.stepLine} />
                    <View style={styles.step}>
                        <CheckCircle2 color={order.status === 'picked_up' ? theme.accent : theme.textMuted} size={20} />
                        <Text style={[styles.stepText, { color: order.status === 'picked_up' ? theme.text : theme.textMuted }]}>Confirm Pickup</Text>
                    </View>
                    <View style={styles.stepLine} />
                    <View style={styles.step}>
                        <CheckCircle2 color={order.status === 'on_the_way' ? theme.accent : theme.textMuted} size={20} />
                        <Text style={[styles.stepText, { color: order.status === 'on_the_way' ? theme.text : theme.textMuted }]}>Navigate to Customer</Text>
                    </View>
                    <View style={styles.stepLine} />
                    <View style={styles.step}>
                        <CheckCircle2 color={order.status === 'delivered' ? theme.accent : theme.textMuted} size={20} />
                        <Text style={[styles.stepText, { color: order.status === 'delivered' ? theme.text : theme.textMuted }]}>Confirm Delivery</Text>
                    </View>
                </View>

                {isHeadingToRestaurant ? (
                    <View style={[styles.card, { backgroundColor: theme.surface }]}>
                        <View style={styles.cardHeader}>
                            <Store color={theme.accent} size={24} />
                            <Text style={[styles.cardTitle, { color: theme.text }]}>{order.restaurants?.name}</Text>
                        </View>
                        <Text style={[styles.cardText, { color: theme.textMuted }]}>{order.restaurants?.suburb}, {order.restaurants?.city}</Text>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.background }]} onPress={() => callNumber('0000000000')}>
                                <Phone color={theme.text} size={20} />
                                <Text style={[styles.iconButtonText, { color: theme.text }]}>Call Restaurant</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.summaryBox, { backgroundColor: theme.background }]}>
                            <View style={styles.summaryHeader}>
                                <FileText color={theme.textMuted} size={16} />
                                <Text style={[styles.summaryTitle, { color: theme.text }]}>Order #{order.id.slice(0, 6).toUpperCase()}</Text>
                                <Text style={[styles.summaryTitle, { color: theme.textMuted, marginLeft: 8 }]}>
                                    • {order.order_items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0} items
                                </Text>
                            </View>
                        </View>

                        {order.restaurants?.lat && (
                            <TouchableOpacity
                                style={[styles.navButton, { backgroundColor: theme.surface, borderColor: theme.accent, borderWidth: 1 }]}
                                onPress={() => openMaps(order.restaurants.lat, order.restaurants.lng)}
                            >
                                <Navigation color={theme.accent} size={20} style={{ marginRight: 8 }} />
                                <Text style={[styles.primaryButtonText, { color: theme.accent }]}>Navigate to Restaurant</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                            onPress={() => setIsPickupModalVisible(true)}
                        >
                            <Text style={styles.primaryButtonText}>Confirm Pickup</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={[styles.card, { backgroundColor: theme.surface }]}>
                        <View style={styles.cardHeader}>
                            <Navigation color={theme.accent} size={24} />
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 24 }]}>{order.delivery_address_snapshot?.suburb?.toUpperCase() || 'UNKNOWN SUBURB'}</Text>
                        </View>
                        <Text style={[styles.cardText, { color: theme.text, fontSize: 18, fontWeight: 'bold', marginVertical: 8 }]}>
                            {order.delivery_address_snapshot?.landmark_notes || 'No landmark provided'}
                        </Text>
                        <Text style={[styles.cardText, { color: theme.textMuted }]}>
                            {order.delivery_address_snapshot?.street_address}
                        </Text>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.background }]} onPress={() => callNumber(order.profiles?.phone || '')}>
                                <Phone color={theme.text} size={20} />
                                <Text style={[styles.iconButtonText, { color: theme.text }]}>Call Customer</Text>
                            </TouchableOpacity>
                        </View>

                        {order.status === 'picked_up' && (
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                                onPress={() => updateStatusMutation.mutate('on_the_way')}
                            >
                                <Text style={styles.primaryButtonText}>Start Trip / On The Way</Text>
                            </TouchableOpacity>
                        )}

                        {order.status === 'on_the_way' && (
                            <>
                                {order.delivery_address_snapshot?.lat && (
                                    <TouchableOpacity
                                        style={[styles.navButton, { backgroundColor: theme.surface, borderColor: theme.accent, borderWidth: 1 }]}
                                        onPress={() => openMaps(order.delivery_address_snapshot.lat, order.delivery_address_snapshot.lng)}
                                    >
                                        <Navigation color={theme.accent} size={20} style={{ marginRight: 8 }} />
                                        <Text style={[styles.primaryButtonText, { color: theme.accent }]}>Navigate to Customer</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryButton, { backgroundColor: '#22c55e' }]}
                                    onPress={() => setIsPinModalVisible(true)}
                                >
                                    <Text style={styles.primaryButtonText}>Complete Delivery</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </ScrollView>

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
            <Modal visible={isPinModalVisible} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={{ flex: 1, justifyContent: 'center', width: '100%' }}
                        >
                            <TouchableWithoutFeedback>
                                <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                                    <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Delivery PIN</Text>
                                    <Text style={[styles.modalText, { color: theme.textMuted }]}>Ask the customer for the 4-digit PIN shown in their app.</Text>

                                    <TextInput
                                        style={[styles.pinInput, { color: theme.text, borderColor: pinError ? '#ef4444' : theme.border, backgroundColor: theme.background }]}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        value={pinEntry}
                                        onChangeText={setPinEntry}
                                        placeholder="0000"
                                        placeholderTextColor={theme.textMuted}
                                        textAlign="center"
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
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 40, borderBottomWidth: 1 },
    backButton: { marginRight: 16 },
    title: { fontSize: 20, fontWeight: 'bold' },
    subtitle: { fontSize: 14, fontWeight: '600' },
    scrollContent: { padding: 16, gap: 16 },
    card: { padding: 20, borderRadius: 16, gap: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardTitle: { fontSize: 18, fontWeight: 'bold' },
    cardText: { fontSize: 14 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepText: { fontSize: 14, fontWeight: '600' },
    stepLine: { width: 2, height: 20, backgroundColor: '#333', marginLeft: 9, marginVertical: 4 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    iconButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12 },
    iconButtonText: { fontSize: 14, fontWeight: '600' },
    summaryBox: { padding: 16, borderRadius: 12 },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryTitle: { fontSize: 14, fontWeight: 'bold' },
    primaryButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    navButton: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 12, marginTop: 8 },
    primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    secondaryButton: { padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
    secondaryButtonText: { fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    modalText: { fontSize: 16, marginBottom: 16 },
    pinInput: { fontSize: 32, letterSpacing: 16, padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 }
});
