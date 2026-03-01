import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { DollarSign, TrendingUp, Calendar, ChevronRight } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';

export const DriverEarnings = () => {
    const { theme } = useTheme();
    const { user } = useAuthStore();

    const { data: orders, isLoading } = useQuery({
        queryKey: ['driver-earnings', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('driver_id', user?.id)
                .eq('status', 'delivered');
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    if (isLoading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;

    const totalEarnings = (orders?.length || 0) * 2.50; // Simple flat rate for MVP

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Earnings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Main Card */}
                <View style={[styles.earningsCard, { backgroundColor: theme.accent }]}>
                    <Text style={styles.cardLabel}>Total Balance</Text>
                    <Text style={styles.cardValue}>${totalEarnings.toFixed(2)}</Text>
                    <View style={styles.cardFooter}>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>Deliveries</Text>
                            <Text style={styles.footerValue}>{orders?.length || 0}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>This Week</Text>
                            <Text style={styles.footerValue}>${totalEarnings.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                        <TrendingUp size={20} color={theme.accent} />
                        <Text style={[styles.statBoxValue, { color: theme.text }]}>100%</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>Reliability</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                        <Calendar size={20} color={theme.accent} />
                        <Text style={[styles.statBoxValue, { color: theme.text }]}>5.0</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>Rating</Text>
                    </View>
                </View>

                {/* History */}
                <View style={styles.historySection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
                    {orders?.map((order) => (
                        <View key={order.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: theme.surface }]}>
                                <DollarSign size={18} color="#22c55e" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={[styles.historyName, { color: theme.text }]}>Delivery Complete</Text>
                                <Text style={[styles.historyDate, { color: theme.textMuted }]}>{new Date(order.created_at).toLocaleDateString()}</Text>
                            </View>
                            <Text style={[styles.historyAmount, { color: theme.text }]}>+$2.50</Text>
                        </View>
                    ))}
                    {orders?.length === 0 && (
                        <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 20 }}>No delivery history yet.</Text>
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
    statsGrid: { flexDirection: 'row', gap: 16, marginTop: 20 },
    statBox: { flex: 1, padding: 20, borderRadius: 20, gap: 8 },
    statBoxValue: { fontSize: 18, fontWeight: 'bold' },
    statBoxLabel: { fontSize: 12 },
    historySection: { marginTop: 40 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    historyName: { fontSize: 16, fontWeight: '600' },
    historyDate: { fontSize: 12, marginTop: 2 },
    historyAmount: { fontSize: 16, fontWeight: 'bold' }
});
