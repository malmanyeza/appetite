import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert
} from 'react-native';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import { ChevronLeft, Trash2, MapPin, CreditCard, CheckCircle2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';

export const CartScreen = ({ navigation }: any) => {
    const { items, total, updateQty, clearCart } = useCartStore();
    const { profile } = useAuthStore();
    const { theme } = useTheme();
    const [loading, setLoading] = React.useState(false);

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

    const [selectedAddress, setSelectedAddress] = React.useState<any>(null);
    const [paymentMethod, setPaymentMethod] = React.useState<'cod' | 'ecocash'>('cod');

    React.useEffect(() => {
        if (addresses && addresses.length > 0 && !selectedAddress) {
            setSelectedAddress(addresses[0]);
        }
    }, [addresses]);

    const handleCheckout = async () => {
        if (items.length === 0) return;
        if (!selectedAddress) {
            Alert.alert('Address Required', 'Please add a delivery address before placing an order.', [
                { text: 'Add Address', onPress: () => navigation.navigate('AddressManagement') }
            ]);
            return;
        }

        setLoading(true);
        try {
            const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: profile.id,
                    restaurant_id: items[0].restaurant_id,
                    status: 'confirmed',
                    delivery_pin: deliveryPin,
                    delivery_address_snapshot: {
                        label: selectedAddress.label,
                        city: selectedAddress.city,
                        suburb: selectedAddress.suburb,
                        street: selectedAddress.street,
                        landmark_notes: selectedAddress.landmark_notes,
                        lat: selectedAddress.lat,
                        lng: selectedAddress.lng
                    },
                    pricing: {
                        subtotal: total,
                        delivery_fee: 2,
                        service_fee: 0.5,
                        total: total + 2.5
                    },
                    payment: { method: paymentMethod, status: 'pending' }
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const orderItems = items.map(item => ({
                order_id: order.id,
                menu_item_id: item.id,
                name_snapshot: item.name,
                price_snapshot: item.price,
                qty: item.qty
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) throw itemsError;

            clearCart();
            navigation.navigate('Tracking', { screen: 'TrackingMain', params: { orderId: order.id } });
        } catch (error: any) {
            Alert.alert('Checkout Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
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
                                        <Text style={[styles.itemPrice, { color: theme.accent }]}>${item.price.toFixed(2)}</Text>
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
                                <TouchableOpacity onPress={() => navigation.navigate('AddressManagement')}>
                                    <Text style={{ color: theme.accent, fontWeight: 'bold' }}>{selectedAddress ? 'Change' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.section, { borderTopColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
                            <View style={styles.paymentMethods}>
                                {[
                                    { id: 'cod', label: 'Cash on Delivery', icon: CreditCard },
                                    { id: 'ecocash', label: 'EcoCash', icon: CreditCard }
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
                                <Text style={{ color: theme.text }}>$2.00</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={{ color: theme.textMuted }}>Service Fee</Text>
                                <Text style={{ color: theme.text }}>$0.50</Text>
                            </View>
                            <View style={[styles.summaryRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }]}>
                                <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                                <Text style={[styles.totalValue, { color: theme.accent }]}>${(total + 2.5).toFixed(2)}</Text>
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
                        <Text style={styles.buttonText}>Place Order</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
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
    footer: { padding: 20, paddingBottom: 40 },
    primaryButton: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});
