import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Linking,
    Modal,
    ScrollView
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { 
    ShoppingBag, 
    Clock, 
    Phone, 
    User, 
    MapPin, 
    Bike, 
    Search, 
    X,
    Navigation,
    Info,
    ChevronRight
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

export const AdminOrdersScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const queryClient = useQueryClient();
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
    const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
    const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);

    useEffect(() => {
        const channel = supabase.channel('admin-all-orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['admin-all-orders'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const { data: orders, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['admin-all-orders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*, restaurants(*), restaurant_locations(*), customer:profiles!customer_id(*), driver:profiles!driver_id(*), order_items(*)')
                .neq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[AdminOrders] Fetch error:', error);
                throw error;
            }
            console.log('[AdminOrders] Fetched orders:', data?.length);
            return data;
        }
    });

    const fetchNearbyDrivers = async (restaurantLat: number, restaurantLng: number) => {
        setIsLoadingDrivers(true);
        setIsDriverModalVisible(true);
        try {
            const { data, error } = await supabase.rpc('get_restaurants_with_distance', {
                u_lat: restaurantLat,
                u_lng: restaurantLng
            });
            // Note: get_restaurants_with_distance is for restaurants. 
            // We need one for drivers. Let's check if we have get_nearby_drivers RPC.
            // For now, let's fetch all online drivers and calculate distance locally or use a proper RPC if it exists.
            
            const { data: drivers, error: driversError } = await supabase
                .from('driver_profiles')
                .select(`
                    *,
                    profiles:user_id (full_name, phone)
                `)
                .eq('is_online', true)
                .gt('last_location_update', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Active in last 15 mins

            if (driversError) throw driversError;
            
            // Basic distance calculation
            const sortedDrivers = drivers.map(d => {
                const dist = Math.sqrt(Math.pow(d.lat - restaurantLat, 2) + Math.pow(d.lng - restaurantLng, 2)) * 111; // Approx km
                return { ...d, distance: dist };
            }).sort((a, b) => a.distance - b.distance);

            setNearbyDrivers(sortedDrivers);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        } finally {
            setIsLoadingDrivers(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered': return '#10B981';
            case 'cancelled': return '#EF4444';
            case 'pending': return '#F59E0B';
            case 'confirmed': return '#3B82F6';
            case 'preparing': return '#8B5CF6';
            case 'ready_for_pickup': return theme.accent;
            case 'on_the_way': return theme.accent;
            default: return theme.textMuted;
        }
    };

    const renderOrderItem = ({ item }: any) => (
        <TouchableOpacity
            style={[styles.orderCard, { backgroundColor: theme.surface }]}
            onPress={() => setSelectedOrder(item)}
        >
            <View style={styles.orderHeader}>
                <View>
                    <Text style={[styles.restaurantName, { color: theme.text }]}>{item.restaurants?.name}</Text>
                    <Text style={[styles.orderId, { color: theme.textMuted }]}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.customerInfo}>
                <User size={14} color={theme.textMuted} />
                <Text style={[styles.customerName, { color: theme.text }]}>{item.customer?.full_name}</Text>
                <Text style={[styles.dot, { color: theme.textMuted }]}>•</Text>
                <Text style={[styles.orderTime, { color: theme.textMuted }]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>

            <View style={styles.orderFooter}>
                <Text style={[styles.itemCount, { color: theme.textMuted }]}>
                    {item.order_items?.length} items • ${Number(item.pricing?.total).toFixed(2)}
                </Text>
                {item.status === 'confirmed' && (
                    <TouchableOpacity 
                        style={[styles.dispatchButton, { backgroundColor: theme.accent }]}
                        onPress={() => fetchNearbyDrivers(item.restaurants.lat, item.restaurants.lng)}
                    >
                        <Navigation size={14} color="white" />
                        <Text style={styles.dispatchButtonText}>Dispatch</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Live Orders</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Platform Overview</Text>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.accent} />
                    }
                />
            )}

            {/* Order Detail Modal */}
            <Modal
                visible={!!selectedOrder}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedOrder(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Order Details</Text>
                            <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                                <X size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {selectedOrder && (
                                <View style={styles.detailContainer}>
                                    {/* Status Section */}
                                    <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                                        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Status</Text>
                                        <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedOrder.status) + '20' }]}>
                                            <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedOrder.status) }]}>
                                                {selectedOrder.status.replace(/_/g, ' ').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Parties Section */}
                                    <View style={styles.contactContainer}>
                                        <View style={[styles.contactCard, { backgroundColor: theme.surface }]}>
                                            <View style={styles.contactHeader}>
                                                <ShoppingBag size={18} color={theme.accent} />
                                                <Text style={[styles.contactTitle, { color: theme.text }]}>Restaurant</Text>
                                            </View>
                                            <Text style={[styles.contactName, { color: theme.text }]}>{selectedOrder.restaurants?.name}</Text>
                                            <TouchableOpacity 
                                                style={styles.phoneButton}
                                                onPress={() => Linking.openURL(`tel:${selectedOrder.restaurant_locations?.phone || selectedOrder.restaurants?.phone}`)}
                                            >
                                                <Phone size={14} color={theme.accent} />
                                                <Text style={[styles.phoneNumber, { color: theme.accent }]}>
                                                    {selectedOrder.restaurant_locations?.phone || selectedOrder.restaurants?.phone || 'No phone'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={[styles.contactCard, { backgroundColor: theme.surface }]}>
                                            <View style={styles.contactHeader}>
                                                <User size={18} color={theme.accent} />
                                                <Text style={[styles.contactTitle, { color: theme.text }]}>Customer</Text>
                                            </View>
                                            <Text style={[styles.contactName, { color: theme.text }]}>{selectedOrder.customer?.full_name}</Text>
                                            <TouchableOpacity 
                                                style={styles.phoneButton}
                                                onPress={() => Linking.openURL(`tel:${selectedOrder.customer?.phone}`)}
                                            >
                                                <Phone size={14} color={theme.accent} />
                                                <Text style={[styles.phoneNumber, { color: theme.accent }]}>{selectedOrder.customer?.phone || 'No phone'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Biker Section */}
                                    <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                                        <View style={styles.contactHeader}>
                                            <Bike size={18} color={theme.accent} />
                                            <Text style={[styles.contactTitle, { color: theme.text }]}>Assigned Biker</Text>
                                        </View>
                                        {selectedOrder.driver ? (
                                            <View style={styles.bikerInfo}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.contactName, { color: theme.text }]}>{selectedOrder.driver.full_name}</Text>
                                                    <TouchableOpacity 
                                                        style={styles.phoneButton}
                                                        onPress={() => Linking.openURL(`tel:${selectedOrder.driver.phone}`)}
                                                    >
                                                        <Phone size={14} color={theme.accent} />
                                                        <Text style={[styles.phoneNumber, { color: theme.accent }]}>{selectedOrder.driver.phone}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <Text style={[styles.noBiker, { color: theme.textMuted }]}>No biker assigned yet</Text>
                                        )}
                                    </View>

                                    {/* Items Section */}
                                    <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                                        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Items Ordered</Text>
                                        {selectedOrder.order_items?.map((item: any) => (
                                            <View key={item.id} style={styles.itemRow}>
                                                <Text style={[styles.itemQty, { color: theme.accent }]}>{item.qty}x</Text>
                                                <Text style={[styles.itemName, { color: theme.text }]}>{item.name_snapshot}</Text>
                                                <Text style={[styles.itemPrice, { color: theme.text }]}>${Number(item.price_snapshot * item.qty).toFixed(2)}</Text>
                                            </View>
                                        ))}
                                        <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                                            <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                                            <Text style={[styles.totalAmount, { color: theme.accent }]}>${Number(selectedOrder.pricing?.total).toFixed(2)}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Nearby Drivers Modal */}
            <Modal
                visible={isDriverModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsDriverModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentSmall, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Nearby Bikers</Text>
                                <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Available for dispatch</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsDriverModalVisible(false)}>
                                <X size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        {isLoadingDrivers ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.accent} />
                            </View>
                        ) : nearbyDrivers.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Bike size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active bikers nearby</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.driverList}>
                                {nearbyDrivers.map((driver) => (
                                    <View key={driver.user_id} style={[styles.driverCard, { backgroundColor: theme.surface }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.driverName, { color: theme.text }]}>{driver.profiles?.full_name}</Text>
                                            <Text style={[styles.driverDist, { color: theme.textMuted }]}>{driver.distance.toFixed(1)} km away</Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.callButton, { backgroundColor: theme.accent }]}
                                            onPress={() => Linking.openURL(`tel:${driver.profiles?.phone}`)}
                                        >
                                            <Phone size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 24, paddingTop: 60 },
    headerTitle: { fontSize: 28, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 14, marginTop: 4 },
    listContent: { padding: 20, paddingTop: 0 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    orderCard: {
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    restaurantName: { fontSize: 18, fontWeight: 'bold' },
    orderId: { fontSize: 12, marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    customerName: { fontSize: 14, fontWeight: '600' },
    dot: { fontSize: 14 },
    orderTime: { fontSize: 14 },
    orderFooter: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)'
    },
    itemCount: { fontSize: 14 },
    dispatchButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    dispatchButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 },
    modalContentSmall: { borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '60%', padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    modalSubtitle: { fontSize: 14, marginTop: 2 },
    
    detailContainer: { gap: 16, paddingBottom: 40 },
    detailSection: { padding: 16, borderRadius: 20, gap: 12 },
    sectionLabel: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    statusBadgeLarge: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    statusTextLarge: { fontSize: 14, fontWeight: 'bold' },
    
    contactContainer: { flexDirection: 'row', gap: 12 },
    contactCard: { flex: 1, padding: 16, borderRadius: 20, gap: 8 },
    contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contactTitle: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    contactName: { fontSize: 16, fontWeight: 'bold' },
    phoneButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    phoneNumber: { fontSize: 14, fontWeight: '600' },
    
    bikerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    noBiker: { fontSize: 14, fontStyle: 'italic' },
    
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemQty: { fontSize: 14, fontWeight: 'bold', width: 25 },
    itemName: { flex: 1, fontSize: 14 },
    itemPrice: { fontSize: 14, fontWeight: '600' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalAmount: { fontSize: 20, fontWeight: '900' },
    
    driverList: { maxHeight: 400 },
    driverCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12 },
    driverName: { fontSize: 16, fontWeight: 'bold' },
    driverDist: { fontSize: 12, marginTop: 2 },
    callButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '500' }
});
