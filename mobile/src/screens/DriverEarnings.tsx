import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { DollarSign, TrendingUp, Calendar, ChevronRight } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';

export const DriverEarnings = () => {
    const { theme } = useTheme();
    const { user } = useAuthStore();

    const { data: orders, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['driver-earnings', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('driver_id', user?.id)
                .eq('status', 'delivered')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    if (isLoading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;

    // Aggregation Logic
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = (orders || []).reduce((acc: any, order: any) => {
        const earnings = Number(order.pricing?.driver_earnings || order.pricing?.driverEarnings || 0);
        const orderDate = new Date(order.created_at);

        acc.total += earnings;
        if (orderDate >= startOfToday) acc.today += earnings;
        if (orderDate >= startOfWeek) acc.week += earnings;
        if (orderDate >= startOfMonth) acc.month += earnings;

        return acc;
    }, { total: 0, today: 0, week: 0, month: 0 });

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Earnings</Text>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={theme.accent}
                    />
                }
            >
                {/* Main Card - Total Balance */}
                <View style={[styles.earningsCard, { backgroundColor: theme.accent }]}>
                    <Text style={styles.cardLabel}>All-Time Earnings</Text>
                    <Text style={styles.cardValue}>${stats.total.toFixed(2)}</Text>
                    <View style={styles.cardFooter}>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>Total Trips</Text>
                            <Text style={styles.footerValue}>{orders?.length || 0}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>Avg / Trip</Text>
                            <Text style={styles.footerValue}>
                                ${orders?.length ? (stats.total / orders.length).toFixed(2) : '0.00'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Periodic Breakdown Section */}
                <View style={styles.breakdownSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Earnings Summary</Text>
                    <View style={styles.statsGrid}>
                        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>Today</Text>
                            <Text style={[styles.statBoxValue, { color: theme.text }]}>${stats.today.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>This Week</Text>
                            <Text style={[styles.statBoxValue, { color: theme.text }]}>${stats.week.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>This Month</Text>
                            <Text style={[styles.statBoxValue, { color: theme.text }]}>${stats.month.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* History */}
                <View style={styles.historySection}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Recent Trips</Text>
                        <Text style={{ color: theme.accent, fontSize: 14 }}>View All</Text>
                    </View>
                    {orders?.map((order: any) => {
                        const earnings = Number(order.pricing?.driver_earnings || order.pricing?.driverEarnings || 0);
                        return (
                            <View key={order.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                                <View style={[styles.iconBox, { backgroundColor: theme.surface }]}>
                                    <DollarSign size={18} color="#22c55e" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.historyName, { color: theme.text }]}>Trip Completed</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                                        <View>
                                            <Text style={[styles.historyDate, { color: theme.text, fontWeight: 'bold' }]}>
                                                Ord: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <View style={{ backgroundColor: theme.surface, alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                                                <Text style={{ color: theme.accent, fontSize: 10, fontWeight: 'bold' }}>
                                                    {new Date(order.created_at).toDateString() === new Date().toDateString() ? 'TODAY' : new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </Text>
                                            </View>
                                        </View>
                                        <View>
                                            <Text style={[styles.historyDate, { color: '#22c55e', fontWeight: 'bold' }]}>
                                                Del: {order.delivered_at ? new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                                            </Text>
                                            {order.delivered_at && (
                                                <Text style={[styles.historyDate, { color: '#16a34a', fontSize: 10, marginTop: -2 }]}>
                                                    {new Date(order.delivered_at).toDateString() === new Date().toDateString() ? 'Today' : new Date(order.delivered_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <Text style={[styles.historyAmount, { color: '#22c55e' }]}>+${earnings.toFixed(2)}</Text>
                            </View>
                        );
                    })}
                    {orders?.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <DollarSign size={48} color={theme.surface} />
                            <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 12 }}>No delivery history yet.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
    headerTitle: { fontSize: 24, fontWeight: 'bold' },
    scrollContent: { padding: 20 },
    earningsCard: { borderRadius: 24, padding: 24, height: 200, justifyContent: 'center' },
    cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
    cardValue: { color: '#FFF', fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: 'bold', marginTop: 4 },
    cardFooter: { flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    footerItem: { flex: 1 },
    footerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    footerValue: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    divider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20 },
    breakdownSection: { marginTop: 32 },
    statsGrid: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statBox: { flex: 1, padding: 16, borderRadius: 16, gap: 4, alignItems: 'center' },
    statBoxValue: { fontSize: 16, fontWeight: 'bold' },
    statBoxLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    historySection: { marginTop: 40, paddingBottom: 40 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold' },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    historyName: { fontSize: 16, fontWeight: '600' },
    historyDate: { fontSize: 12, marginTop: 2 },
    historyAmount: { fontSize: 16, fontWeight: 'bold' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 }
});
