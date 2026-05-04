import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ShoppingBag, ChevronRight, Clock } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

export const OrdersScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const { user } = useAuthStore();

    const queryClient = useQueryClient();

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase.channel(`user-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `customer_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['orders', user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, queryClient]);

    const { data: orders, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['orders', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurants (name),
                    order_items (id)
                `)
                .eq('customer_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!user
    });

    const getDisplayStatus = (status: string) => {
        if (['accepted', 'picked_up', 'ready_for_pickup'].includes(status)) return 'ready_for_pickup';
        return status;
    };

    const formatStatus = (status: string) => {
        const displayStatus = getDisplayStatus(status);
        return displayStatus.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getStatusColor = (status: string) => {
        const displayStatus = getDisplayStatus(status);
        switch (displayStatus) {
            case 'completed': 
            case 'delivered': return '#10B981';
            case 'cancelled': return '#EF4444';
            case 'pending': return '#F59E0B';
            case 'awaiting_payment': return '#F59E0B';
            case 'preparing': return '#3B82F6';
            case 'ready_for_pickup': return theme.accent;
            case 'on_the_way': return theme.accent;
            default: return theme.textMuted;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={[styles.orderCard, { backgroundColor: theme.surface }]}
            onPress={() => {
                const isHistorical = ['delivered', 'cancelled'].includes(item.status);
                if (isHistorical) {
                    navigation.navigate('OrderDetails', { orderId: item.id });
                } else {
                    navigation.navigate('Tracking', { screen: 'TrackingMain', params: { orderId: item.id } });
                }
            }}
        >
            <View style={styles.orderHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.background }]}>
                    <ShoppingBag size={24} color={theme.accent} />
                </View>
                <View style={styles.orderTitle}>
                    <Text style={[styles.restaurantName, { color: theme.text }]} numberOfLines={1}>
                        {item.restaurants?.name}
                    </Text>
                    <View style={styles.timelineContainer}>
                        <View style={styles.timelineRow}>
                            <View style={[styles.timelineDot, { backgroundColor: theme.accent }]} />
                            <Text style={[styles.timelineLabel, { color: theme.textMuted }]}>Ordered</Text>
                            <Text style={[styles.timelineTime, { color: theme.text }]}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <View style={[styles.dateBadge, { backgroundColor: `${theme.accent}15` }]}>
                                <Text style={[styles.dateBadgeText, { color: theme.accent }]}>
                                    {new Date(item.created_at).toDateString() === new Date().toDateString() ? 'TODAY' : new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </Text>
                            </View>
                        </View>
                        {item.delivered_at && (
                            <View style={styles.timelineRow}>
                                <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                                <Text style={[styles.timelineLabel, { color: theme.textMuted }]}>Delivered</Text>
                                <Text style={[styles.timelineTime, { color: theme.text }]}>
                                    {new Date(item.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <View style={[styles.dateBadge, { backgroundColor: '#10B98115' }]}>
                                    <Text style={[styles.dateBadgeText, { color: '#10B981' }]}>
                                        {new Date(item.delivered_at).toDateString() === new Date().toDateString() ? 'TODAY' : new Date(item.delivered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
                <ChevronRight size={20} color={theme.textMuted} />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.orderFooter}>
                <View style={styles.orderInfo}>
                    <Text style={[styles.orderAmount, { color: theme.text }]}>
                        ${item.pricing?.total?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={[styles.orderItems, { color: theme.textMuted }]}>
                        {item.order_items?.length || 0} {(item.order_items?.length || 0) === 1 ? 'item' : 'items'}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {formatStatus(item.status)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Your Orders</Text>
            </View>

            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator color={theme.accent} size="large" />
                </View>
            ) : orders && orders.length > 0 ? (
                <FlatList
                    data={orders}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor={theme.accent}
                        />
                    }
                />
            ) : (
                <View style={styles.centerContainer}>
                    <ShoppingBag size={64} color={theme.surface} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No orders yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                        When you place an order, it will appear here.
                    </Text>
                    <TouchableOpacity
                        style={[styles.browseButton, { backgroundColor: theme.accent }]}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.browseButtonText}>Browse Restaurants</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    title: { fontSize: 28, fontWeight: 'bold' },
    listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 },
    orderCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        gap: 16,
    },
    orderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orderTitle: { flex: 1 },
    restaurantName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    timelineContainer: { marginTop: 8, gap: 8 },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timelineDot: { width: 6, height: 6, borderRadius: 3 },
    timelineLabel: { fontSize: 13, fontWeight: '500', width: 65, letterSpacing: -0.2 },
    timelineTime: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
    dateBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
    dateBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    divider: { height: 1, marginHorizontal: -16 },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderInfo: { gap: 2 },
    orderAmount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    orderItems: { fontSize: 14, fontWeight: '500', letterSpacing: -0.2 },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
    browseButton: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    browseButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
