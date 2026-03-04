import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, MapPin, Receipt, Star, Clock, Bike, Send, StarHalf } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

export const OrderDetailsScreen = ({ route, navigation }: any) => {
    const { orderId } = route.params;
    const { theme } = useTheme();

    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [showRatingModal, setShowRatingModal] = useState(false);

    const { data: order, isLoading } = useQuery({
        queryKey: ['order', orderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurants (name, suburb, city, cover_image_url),
                    order_items (*),
                    reviews (*)
                `)
                .eq('id', orderId)
                .single();
            if (error) throw error;
            return data;
        }
    });

    const submitReview = useMutation({
        mutationFn: async () => {
            if (rating === 0) throw new Error('Please select a rating');
            const { error } = await supabase.from('reviews').insert({
                order_id: orderId,
                customer_id: user?.id,
                restaurant_id: order.restaurant_id,
                rating,
                comment
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['order', orderId] });
            setShowRatingModal(false);
            Alert.alert('Thank You!', 'Your review has been submitted.');
        },
        onError: (err: any) => Alert.alert('Error', err.message)
    });

    if (isLoading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
    if (!order) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={{ color: theme.textMuted }}>Order information unavailable.</Text></View>;

    const addr = order.delivery_address_snapshot;
    const pricing = order.pricing;
    const existingReview = order.reviews && order.reviews[0];

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ChevronLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Order Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusLabel, { color: theme.textMuted }]}>STATUS</Text>
                        <Text style={[styles.statusText, { color: theme.accent }]}>{order.status.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusLabel, { color: theme.textMuted }]}>ORDERED ON</Text>
                        <Text style={[styles.statusText, { color: theme.text }]}>{new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>

                {/* Restaurant Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>FROM</Text>
                    <View style={[styles.restaurantCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.restaurantName, { color: theme.text }]}>{order.restaurants?.name}</Text>
                        <Text style={[styles.restaurantSub, { color: theme.textMuted }]}>{order.restaurants?.suburb}, {order.restaurants?.city}</Text>
                    </View>
                </View>

                {/* Delivery Address Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>DELIVERY TO</Text>
                    <View style={[styles.addressCard, { backgroundColor: theme.surface }]}>
                        <MapPin size={20} color={theme.accent} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.addressMain, { color: theme.text }]}>{addr.suburb}</Text>
                            <Text style={[styles.addressDetail, { color: theme.accent }]}>"{addr.landmark_notes}"</Text>
                            <Text style={[styles.addressSub, { color: theme.textMuted }]}>
                                {addr.street ? `${addr.street}, ` : ''}{addr.city}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Items Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ITEMS</Text>
                    <View style={[styles.itemsContainer, { backgroundColor: theme.surface }]}>
                        {order.order_items?.map((item: any) => (
                            <View key={item.id} style={styles.itemRow}>
                                <View style={[styles.qtyBox, { backgroundColor: theme.background }]}>
                                    <Text style={[styles.qtyText, { color: theme.accent }]}>{item.qty}x</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.itemName, { color: theme.text }]}>{item.name_snapshot}</Text>
                                    {item.notes && <Text style={[styles.itemNotes, { color: theme.textMuted }]}>{item.notes}</Text>}
                                </View>
                                <Text style={[styles.itemPrice, { color: theme.text }]}>${(item.price_snapshot * item.qty).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Receipt Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>RECEIPT</Text>
                    <View style={[styles.receiptCard, { backgroundColor: theme.surface }]}>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Subtotal</Text>
                            <Text style={[styles.receiptValue, { color: theme.text }]}>${pricing.subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Delivery Fee</Text>
                            <Text style={[styles.receiptValue, { color: theme.text }]}>${pricing.deliveryFee.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.receiptRow}>
                            <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                            <Text style={[styles.totalValue, { color: theme.accent }]}>${pricing.total.toFixed(2)}</Text>
                        </View>
                        <View style={styles.paymentInfo}>
                            <Text style={[styles.paymentText, { color: theme.textMuted }]}>
                                Paid via {order.payment.method.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Actions Section */}
                {order.status === 'delivered' && (
                    <View style={styles.actionContainer}>
                        {existingReview ? (
                            <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <View style={styles.reviewHeader}>
                                    <Text style={[styles.reviewRateLabel, { color: theme.text }]}>Your Review</Text>
                                    <View style={styles.starsRow}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star
                                                key={s}
                                                size={16}
                                                color={s <= existingReview.rating ? theme.accent : theme.border}
                                                fill={s <= existingReview.rating ? theme.accent : 'transparent'}
                                            />
                                        ))}
                                    </View>
                                </View>
                                {existingReview.comment && (
                                    <Text style={[styles.reviewComment, { color: theme.textMuted }]}>
                                        "{existingReview.comment}"
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.rateButton, { backgroundColor: theme.surface, borderColor: theme.accent }]}
                                onPress={() => setShowRatingModal(true)}
                            >
                                <Star size={20} color={theme.accent} />
                                <Text style={[styles.rateButtonText, { color: theme.accent }]}>Rate this Delivery</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Rating Modal */}
            <Modal visible={showRatingModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Rate Your Order</Text>
                            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                                <Text style={{ color: theme.textMuted }}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSub, { color: theme.textMuted }]}>How was your experience with {order.restaurants?.name}?</Text>

                        <View style={styles.modalStarsRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                    <Star
                                        size={40}
                                        color={s <= rating ? theme.accent : theme.border}
                                        fill={s <= rating ? theme.accent : 'transparent'}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.commentInput, { backgroundColor: theme.surface, color: theme.text }]}
                            placeholder="Add a comment (optional)..."
                            placeholderTextColor={theme.textMuted}
                            multiline
                            numberOfLines={4}
                            value={comment}
                            onChangeText={setComment}
                        />

                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: theme.accent }]}
                            onPress={() => submitReview.mutate()}
                            disabled={submitReview.isPending}
                        >
                            {submitReview.isPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Review</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        paddingBottom: 20,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { padding: 20 },
    statusCard: {
        flexDirection: 'row',
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
    },
    statusInfo: { flex: 1 },
    statusLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
    statusText: { fontSize: 16, fontWeight: 'bold' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },
    restaurantCard: { padding: 20, borderRadius: 20 },
    restaurantName: { fontSize: 18, fontWeight: 'bold' },
    restaurantSub: { fontSize: 14, marginTop: 4 },
    addressCard: { padding: 20, borderRadius: 20, flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    addressMain: { fontSize: 18, fontWeight: 'bold' },
    addressDetail: { fontSize: 16, fontWeight: 'bold', fontStyle: 'italic', marginVertical: 4 },
    addressSub: { fontSize: 13 },
    itemsContainer: { padding: 16, borderRadius: 20 },
    itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
    qtyBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    qtyText: { fontWeight: 'bold', fontSize: 14 },
    itemName: { fontSize: 16, fontWeight: '600' },
    itemNotes: { fontSize: 12, marginTop: 2 },
    itemPrice: { fontSize: 16, fontWeight: 'bold' },
    receiptCard: { padding: 20, borderRadius: 20 },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    receiptLabel: { fontSize: 14 },
    receiptValue: { fontSize: 14, fontWeight: '600' },
    divider: { height: 1, marginVertical: 12 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: '900' },
    paymentInfo: { marginTop: 16, alignItems: 'center' },
    paymentText: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    rateButton: {
        height: 56,
        borderRadius: 16,
        borderWidth: 2,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    rateButtonText: { fontSize: 16, fontWeight: 'bold' },
    actionContainer: { marginTop: 12 },
    reviewCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    reviewRateLabel: { fontSize: 16, fontWeight: 'bold' },
    starsRow: { flexDirection: 'row', gap: 4 },
    reviewComment: { fontSize: 14, fontStyle: 'italic' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalSub: { fontSize: 14, marginBottom: 24 },
    modalStarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 32 },
    commentInput: { borderRadius: 16, padding: 16, height: 120, textAlignVertical: 'top', fontSize: 16, marginBottom: 24 },
    submitButton: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
