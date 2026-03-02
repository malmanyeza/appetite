import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { CheckCircle2, DollarSign, Store, Navigation } from 'lucide-react-native';

export const DeliveryCompleted = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const orderId = route.params?.orderId;

    const { data: order, isLoading } = useQuery({
        queryKey: ['completed-delivery', orderId],
        queryFn: async () => {
            if (!orderId) return null;
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurants:restaurant_id (name),
                    profiles:customer_id (full_name)
                `)
                .eq('id', orderId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!orderId
    });

    if (isLoading) return <View style={[styles.container, { backgroundColor: theme.background }]}><Text style={{ color: theme.text }}>Loading...</Text></View>;
    if (!order) return <View style={[styles.container, { backgroundColor: theme.background }]}><Text style={{ color: theme.text }}>Order details unavailable.</Text></View>;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <View style={styles.successIconContainer}>
                    <CheckCircle2 color="#22c55e" size={80} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>Delivery Completed</Text>

                <View style={[styles.earningsCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.earningsHeader}>
                        <DollarSign color={theme.accent} size={24} />
                        <Text style={[styles.earningsText, { color: theme.text }]}>Earnings</Text>
                    </View>
                    <Text style={[styles.amount, { color: theme.text }]}>
                        ${((order.pricing?.total || 0) * 0.15).toFixed(2)} {/* Null-safe calculation */}
                    </Text>
                </View>

                <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.summaryTitle, { color: theme.textMuted }]}>Trip Summary</Text>

                    <View style={styles.summaryItem}>
                        <Store color={theme.text} size={20} />
                        <Text style={[styles.summaryText, { color: theme.text }]}>{order.restaurants?.name}</Text>
                    </View>

                    <View style={styles.summaryItem}>
                        <Navigation color={theme.text} size={20} />
                        <Text style={[styles.summaryText, { color: theme.text }]}>
                            {order.delivery_address_snapshot?.suburb || 'Customer Location'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.reset({ index: 0, routes: [{ name: 'JobsMain' }] })}
                >
                    <Text style={styles.primaryButtonText}>Back to Jobs</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 60 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
    successIconContainer: { marginBottom: 16 },
    title: { fontSize: 32, fontWeight: 'bold' },
    earningsCard: { width: '100%', padding: 24, borderRadius: 20, alignItems: 'center', gap: 12 },
    earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    earningsText: { fontSize: 18, fontWeight: '600' },
    amount: { fontSize: 48, fontWeight: 'black' },
    summaryCard: { width: '100%', padding: 20, borderRadius: 20, gap: 16 },
    summaryTitle: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryText: { fontSize: 16 },
    footer: { paddingBottom: 20 },
    primaryButton: { padding: 18, borderRadius: 16, alignItems: 'center' },
    primaryButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
