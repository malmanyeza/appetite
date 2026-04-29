import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { DollarSign, TrendingUp, Calendar, ChevronRight, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';

export const DriverEarnings = () => {
    const { theme } = useTheme();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Fetch Delivered Orders (Earnings)
    const { data: orders, isLoading: isOrdersLoading, refetch: refetchOrders, isRefetching: isRefetchingOrders } = useQuery({
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

    // 2. Fetch Payout History
    const { data: payouts, isLoading: isPayoutsLoading, refetch: refetchPayouts } = useQuery({
        queryKey: ['driver-payouts', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payouts')
                .select('*')
                .eq('driver_id', user?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // 2b. Fetch Driver Profile for EcoCash Details
    const { data: driverProfile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['driver-profile-earnings', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('driver_profiles')
                .select('ecocash_number, account_name')
                .eq('user_id', user?.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // 3. Payout Request Mutation
    const requestPayoutMutation = useMutation({
        mutationFn: async (grossAmount: number) => {
            const fee = grossAmount * 0.05;
            const netAmount = grossAmount - fee;
            
            const { data, error } = await supabase
                .from('payouts')
                .insert([{
                    driver_id: user?.id,
                    amount: netAmount,
                    status: 'pending',
                    metadata: {
                        ecocash_number: driverProfile?.ecocash_number,
                        account_name: driverProfile?.account_name,
                        requested_at: new Date().toISOString(),
                        gross_amount: grossAmount,
                        fee: fee
                    }
                }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['driver-payouts'] });
            setIsModalVisible(false);
            const receiveAmount = variables * 0.95;
            setPayoutAmount('');
            Alert.alert('Success', `Your payout request has been submitted. You will receive $${receiveAmount.toFixed(2)} after charges.`);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message || 'Failed to submit request');
        }
    });

    const onRefresh = () => {
        refetchOrders();
        refetchPayouts();
    };

    if (isOrdersLoading || isPayoutsLoading || isProfileLoading) {
        return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
    }

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

        acc.totalEarnings += earnings;
        if (orderDate >= startOfToday) acc.today += earnings;
        if (orderDate >= startOfWeek) acc.week += earnings;
        if (orderDate >= startOfMonth) acc.month += earnings;

        return acc;
    }, { totalEarnings: 0, today: 0, week: 0, month: 0 });

    // Total amount that has left the wallet (including fees)
    const totalDeducted = (payouts || [])
        .filter(p => p.status === 'processed')
        .reduce((sum, p) => sum + Number(p.amount) + Number(p.metadata?.fee || 0), 0);
    
    // Amount the driver actually received in their pocket
    const totalActuallyReceived = (payouts || [])
        .filter(p => p.status === 'processed')
        .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const pendingWithdrawalDeduction = (payouts || [])
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount) + Number(p.metadata?.fee || 0), 0);

    const availableBalance = Math.max(0, stats.totalEarnings - totalDeducted - pendingWithdrawalDeduction);

    const handleRequestSubmit = () => {
        const amount = parseFloat(payoutAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }
        if (amount > availableBalance) {
            Alert.alert('Insufficient Balance', `You only have $${availableBalance.toFixed(2)} available.`);
            return;
        }
        requestPayoutMutation.mutate(amount);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Earnings</Text>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetchingOrders}
                        onRefresh={onRefresh}
                        tintColor={theme.accent}
                    />
                }
            >
                {/* Available Balance Card */}
                <View style={[styles.balanceCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.balanceHeader}>
                        <Wallet size={20} color={theme.accent} />
                        <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>AVAILABLE TO WITHDRAW</Text>
                    </View>
                    <Text style={[styles.balanceValue, { color: theme.text }]}>${availableBalance.toFixed(2)}</Text>
                    
                    {pendingWithdrawalDeduction > 0 && (
                        <Text style={[styles.pendingText, { color: theme.textMuted }]}>
                            Pending Request: ${pendingWithdrawalDeduction.toFixed(2)}
                        </Text>
                    )}

                    <TouchableOpacity 
                        style={[styles.requestButton, { backgroundColor: availableBalance > 0 ? theme.accent : theme.border }]}
                        onPress={() => setIsModalVisible(true)}
                        disabled={availableBalance <= 0}
                    >
                        <Text style={styles.requestButtonText}>Request Payout</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Stats Row */}
                <View style={[styles.statsGrid, { marginTop: 24 }]}>
                    <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>Total Earned</Text>
                        <Text style={[styles.statBoxValue, { color: theme.text }]}>${stats.totalEarnings.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.statBoxLabel, { color: theme.textMuted }]}>Total Paid</Text>
                        <Text style={[styles.statBoxValue, { color: '#22c55e' }]}>${totalActuallyReceived.toFixed(2)}</Text>
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

                {/* Payout History Section */}
                {payouts && payouts.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Payout History</Text>
                        {payouts.map((payout: any) => (
                            <View key={payout.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                                <View style={[styles.iconBox, { backgroundColor: theme.surface }]}>
                                    {payout.status === 'processed' ? (
                                        <CheckCircle size={20} color="#22c55e" />
                                    ) : payout.status === 'rejected' ? (
                                        <XCircle size={20} color="#ef4444" />
                                    ) : (
                                        <Clock size={20} color={theme.accent} />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.historyName, { color: theme.text }]}>
                                        Withdrawal {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                                    </Text>
                                    <Text style={[styles.historyDate, { color: theme.textMuted }]}>
                                        {new Date(payout.created_at).toLocaleDateString()} at {new Date(payout.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <Text style={[styles.historyAmount, { color: theme.text }]}>${Number(payout.amount).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Recent Trips */}
                <View style={[styles.historySection, { marginTop: 32 }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Recent Trips</Text>
                    </View>
                    {orders?.slice(0, 10).map((order: any) => {
                        const earnings = Number(order.pricing?.driver_earnings || order.pricing?.driverEarnings || 0);
                        return (
                            <View key={order.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                                <View style={[styles.iconBox, { backgroundColor: theme.surface }]}>
                                    <DollarSign size={18} color="#22c55e" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.historyName, { color: theme.text }]}>Trip Completed</Text>
                                    <Text style={[styles.historyDate, { color: theme.textMuted }]}>
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Text style={[styles.historyAmount, { color: '#22c55e' }]}>+${earnings.toFixed(2)}</Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Request Payout Modal */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Request Payout</Text>
                            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                                Available Balance: ${availableBalance.toFixed(2)}
                            </Text>
                            <View style={[styles.infoBanner, { backgroundColor: `${theme.accent}10` }]}>
                                <Text style={{ color: theme.accent, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>
                                    Note: A 5% processing fee applies. You will receive 95% of the requested amount.
                                </Text>
                            </View>

                            <View style={[styles.inputWrapper, { backgroundColor: theme.background }]}>
                                <Text style={{ color: theme.text, fontSize: 18, marginRight: 8 }}>$</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={payoutAmount}
                                    onChangeText={setPayoutAmount}
                                    placeholder="0.00"
                                    placeholderTextColor={theme.textMuted}
                                    keyboardType="numeric"
                                    autoFocus
                                />
                            </View>

                            {parseFloat(payoutAmount) > 0 && (
                                <View style={styles.calculationBox}>
                                    <View style={styles.calcRow}>
                                        <Text style={{ color: theme.textMuted }}>Requested Amount</Text>
                                        <Text style={{ color: theme.text }}>${parseFloat(payoutAmount).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.calcRow}>
                                        <Text style={{ color: theme.textMuted }}>Charges (5%)</Text>
                                        <Text style={{ color: '#ef4444' }}>-${(parseFloat(payoutAmount) * 0.05).toFixed(2)}</Text>
                                    </View>
                                    <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8, marginTop: 4 }]}>
                                        <Text style={{ color: theme.text, fontWeight: 'bold' }}>You will receive</Text>
                                        <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>${(parseFloat(payoutAmount) * 0.95).toFixed(2)}</Text>
                                    </View>
                                </View>
                            )}

                            <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center' }}>
                                Based on your balance, you can receive a maximum of <Text style={{ color: theme.text, fontWeight: 'bold' }}>${(availableBalance * 0.95).toFixed(2)}</Text>
                            </Text>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, { backgroundColor: theme.border }]}
                                    onPress={() => setIsModalVisible(false)}
                                >
                                    <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalButton, { backgroundColor: theme.accent }]}
                                    onPress={handleRequestSubmit}
                                    disabled={requestPayoutMutation.isPending}
                                >
                                    {requestPayoutMutation.isPending ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Submit</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
    headerTitle: { fontSize: 24, fontWeight: 'bold' },
    scrollContent: { padding: 20 },
    
    // Balance Card
    balanceCard: { borderRadius: 24, padding: 24, alignItems: 'center', gap: 8 },
    balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    balanceLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
    balanceValue: { fontSize: 42, fontWeight: 'bold' },
    pendingText: { fontSize: 14, fontStyle: 'italic' },
    requestButton: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 100, width: '100%', alignItems: 'center' },
    requestButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    breakdownSection: { marginTop: 32 },
    statsGrid: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statBox: { flex: 1, padding: 16, borderRadius: 16, gap: 4, alignItems: 'center' },
    statBoxValue: { fontSize: 16, fontWeight: 'bold' },
    statBoxLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    historySection: { marginTop: 40 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    historyName: { fontSize: 16, fontWeight: '600' },
    historyDate: { fontSize: 12, marginTop: 2 },
    historyAmount: { fontSize: 16, fontWeight: 'bold' },
    
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 24, padding: 24, gap: 16 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16 },
    input: { flex: 1, fontSize: 24, fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalButtonText: { fontWeight: 'bold', fontSize: 16 },
    
    infoBanner: { padding: 12, borderRadius: 12, marginBottom: 8 },
    calculationBox: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.02)', gap: 8 },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
