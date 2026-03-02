import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, MapPin, Package, Bike, CheckCircle2, Search } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

export const OrderTracking = ({ route, navigation }: any) => {
    const passedOrderId = route?.params?.orderId;
    const { user } = useAuthStore();
    const { theme } = useTheme();
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
                    restaurants (name, suburb, city, landmark_notes)
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
            <View style={styles.center}>
                <MapPin size={64} color={theme.surface} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Orders</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    You do not have any orders actively being prepared or delivered right now.
                </Text>
                <TouchableOpacity
                    style={[styles.browseButton, { backgroundColor: theme.accent, marginTop: 24 }]}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Browse Restaurants</Text>
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

    const displayStatus = order.status === 'picked_up' ? 'ready_for_pickup' : order.status;
    const currentIdx = statuses.findIndex(s => s.id === displayStatus);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
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
                                displayStatus === 'ready_for_pickup' ? (order.driver_id ? 'Driver is heading to the restaurant to pick up your food' : 'Waiting for a driver to accept your order') :
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
                                <Text style={[
                                    styles.timelineLabel,
                                    { color: isCompleted ? theme.text : theme.textMuted, fontWeight: isCompleted ? 'bold' : 'normal' }
                                ]}>
                                    {status.label}
                                </Text>
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
    timeline: { marginTop: 40, paddingLeft: 40 },
    timelineItem: { flexDirection: 'row', alignItems: 'center', height: 80, position: 'relative' },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2
    },
    timelineLine: {
        position: 'absolute',
        left: 15,
        top: 32,
        width: 2,
        height: 60,
        zIndex: 1
    },
    timelineLabel: { marginLeft: 20, fontSize: 16 },
    backButton: { padding: 20, alignItems: 'center', borderTopWidth: 1 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
    browseButton: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }
});
