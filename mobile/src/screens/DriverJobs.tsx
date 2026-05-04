import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Switch,
    ActivityIndicator,
    Linking,
    RefreshControl,
    Alert,
    Modal,
    Animated
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ExpoLocation from 'expo-location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import { MapPin, Package, Phone, CheckCircle2, Navigation, Store } from 'lucide-react-native';
import { makeCall } from '../utils/callUtils';

// Module-level guard — survives component remounts within the same app session.
// Prevents the welcome modal from firing more than once even if DriverJobs
// remounts multiple times due to navigator key changes during session restore.
const welcomeShownThisSession = new Set<string>();

export const DriverJobs = () => {
    const { theme } = useTheme();
    const { user } = useAuthStore();
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();
    const [isOnline, setIsOnline] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [locationSubscription, setLocationSubscription] = useState<ExpoLocation.LocationSubscription | null>(null);

    const [showWelcome, setShowWelcome] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.8))[0];

    useEffect(() => {
        const checkFirstVisit = async () => {
            if (!user?.id) return;
            const key = `@driver_welcome_v1_${user.id}`;

            // Session guard: if already shown this app session, skip entirely
            if (welcomeShownThisSession.has(key)) return;

            try {
                const hasSeen = await AsyncStorage.getItem(key);
                // Mark seen in session regardless of result so remounts don't re-trigger
                welcomeShownThisSession.add(key);

                if (!hasSeen) {
                    setShowWelcome(true);
                    Animated.parallel([
                        Animated.timing(fadeAnim, {
                            toValue: 1,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.spring(scaleAnim, {
                            toValue: 1,
                            friction: 4,
                            useNativeDriver: true,
                        })
                    ]).start();
                    await AsyncStorage.setItem(key, 'true');
                }
            } catch (e) {
                console.warn('[DriverJobs] Welcome check failed:', e);
            }
        };
        checkFirstVisit();
    }, [user?.id]);

    const closeWelcome = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setShowWelcome(false));
    };

    // Fetch Dynamic Payout Settings
    const { data: deliveryConfig } = useQuery({
        queryKey: ['delivery_config'],
        queryFn: async () => {
            const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'delivery_fee_config').single();
            if (error) throw error;
            return data?.value || { driver_base: 1.2, driver_per_km: 0.3, driver_bonus: 0 };
        }
    });

    useEffect(() => {
        const channel = supabase
            .channel('driver_settings_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'system_settings',
                    filter: "key=eq.delivery_fee_config"
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['delivery_config'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);


    // 1. GPS Heartbeat Active Polling
    const startLocationTracking = async () => {
        try {
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'You must allow location tracking to go online and receive delivery jobs.');
                setIsOnline(false); // revert toggle
                return;
            }

            // Immediately fetch current pos and upload first
            const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
            if (user?.id) {
                // Heartbeat to the live profiles table
                await supabase.from('profiles').update({
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude
                }).eq('id', user.id);

                // Heartbeat to the driver monitoring table
                await supabase.from('driver_profiles').update({
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude,
                    last_location_update: new Date().toISOString()
                }).eq('user_id', user.id);
            }

            // Begin continuous watch subscription (15s intervals)
            const subscription = await ExpoLocation.watchPositionAsync(
                {
                    accuracy: ExpoLocation.Accuracy.High,
                    timeInterval: 15000, 
                    distanceInterval: 50, // 50m displacement
                },
                async (newLocation) => {
                    if (user?.id) {
                        // Concurrent pings to keep both tables in sync
                        await Promise.all([
                            supabase.from('profiles').update({
                                lat: newLocation.coords.latitude,
                                lng: newLocation.coords.longitude
                            }).eq('id', user.id),
                            supabase.from('driver_profiles').update({
                                lat: newLocation.coords.latitude,
                                lng: newLocation.coords.longitude,
                                last_location_update: new Date().toISOString()
                            }).eq('user_id', user.id)
                        ]);
                    }
                }
            );

            setLocationSubscription(subscription);

        } catch (e) {
            console.warn('Location tracking Initialization failed:', e);
            Alert.alert('GPS Error', 'Failed to connect to GPS hardware.');
            setIsOnline(false);
        }
    };

    const stopLocationTracking = () => {
        if (locationSubscription) {
            locationSubscription.remove();
            setLocationSubscription(null);
        }
    };

    const toggleOnlineStatus = async (value: boolean) => {
        setIsOnline(value);
        setIsSyncing(true);
        if (user?.id) {
            // Update legacy state boolean
            await supabase.from('driver_profiles').update({
                is_online: value
            }).eq('user_id', user.id);

            if (value) {
                await startLocationTracking();
            } else {
                stopLocationTracking();
            }
        }
        setIsSyncing(false);
    };

    // Auto-sync status on mount
    useEffect(() => {
        if (user?.id) {
            supabase.from('driver_profiles').select('is_online').eq('user_id', user.id).single()
                .then(({ data }: { data: any }) => {
                    if (data?.is_online) {
                        setIsOnline(true);
                        startLocationTracking();
                    }
                });
        }
        return () => {
            stopLocationTracking(); // cleanup on unmount
        };
    }, [user?.id]);

    // 2. Real-Time Targeted Broadcast Query
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel(`driver-offers-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'driver_job_offers',
                    filter: `driver_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `driver_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
                    queryClient.invalidateQueries({ queryKey: ['active-driver-order'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, queryClient]);

    const { data: activeOrder, isLoading: isActiveOrderLoading } = useQuery({
        queryKey: ['active-driver-order', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('orders')
                .select('id, status')
                .eq('driver_id', user.id)
                .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'])
                .maybeSingle();

            // Just return data. If no active order, data is null.
            return data;
        },
        enabled: !!user?.id
    });

    const { data: jobs, isLoading, refetch } = useQuery({
        queryKey: ['driver-jobs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('targeted_driver_jobs')
                .select('id, offer_id, status, created_at, delivery_address_snapshot, offer_assigned_driver_id, driver_id, customer_id, restaurant_id, pricing, restaurant_name, restaurant_suburb, restaurant_city, restaurant_landmark_notes, customer_name, customer_phone')
                .eq('offer_assigned_driver_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Fetch Error:", error);
                throw error;
            }

            console.log("RAW OFFERS FROM VIEW:", JSON.stringify(data, null, 2));

            // Map the flat SQL View natively back to the expected `job` object hierarchy 
            const activeOffers = (data || []).map((offer: any) => {
                return {
                    id: offer.id,
                    offer_id: offer.offer_id,
                    status: offer.status,
                    delivery_address_snapshot: offer.delivery_address_snapshot,
                    delivery_pin: offer.delivery_pin,
                    driver_id: offer.driver_id,
                    offer_assigned_driver_id: offer.offer_assigned_driver_id,
                    customer_id: offer.customer_id,
                    restaurant_id: offer.restaurant_id,
                    pricing: offer.pricing,
                    payment: offer.payment,
                    created_at: offer.created_at,
                    updated_at: offer.updated_at,
                    restaurants: {
                        name: offer.restaurant_name,
                        suburb: offer.restaurant_suburb,
                        city: offer.restaurant_city,
                        landmark_notes: offer.restaurant_landmark_notes,
                        lat: offer.restaurant_lat,
                        lng: offer.restaurant_lng
                    },
                    profiles: {
                        full_name: offer.customer_name,
                        phone: offer.customer_phone
                    }
                };
            });

            console.log("FINAL MAPPED OFFERS:", activeOffers);
            return activeOffers;
        }
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    // 3. Atomic Job Acceptance
    const acceptJob = useMutation({
        mutationFn: async (orderId: string) => {
            const { data, error } = await supabase.rpc('accept_order_safely', {
                p_order_id: orderId,
                p_driver_id: user?.id
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            return data;
        },
        onSuccess: (data, orderId) => {
            queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['active-driver-order'] });
            navigation.navigate('ActiveDelivery', { orderId });
        },
        onError: (err: any) => Alert.alert('Acceptance Failed', err.message)
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['driver-jobs'] });
        },
        onError: (err: any) => Alert.alert('Error', err.message)
    });

    const handleCall = (phone: string) => {
        makeCall(phone);
    };

    const handleNavigate = (lat: number, lng: number, addressText: string) => {
        const url = lat && lng
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
        Linking.openURL(url);
    };

    if (isActiveOrderLoading || isLoading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;

    if (activeOrder) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <Navigation color={theme.accent} size={84} style={{ marginBottom: 24 }} />
                <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>Active Delivery</Text>
                <Text style={{ color: theme.textMuted, fontSize: 16, textAlign: 'center', marginBottom: 40, lineHeight: 24 }}>
                    You have a live delivery in progress. Please complete your current trip before accepting new jobs.
                </Text>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.accent, width: '100%', paddingVertical: 20 }]}
                    onPress={() => navigation.navigate('ActiveDelivery', { orderId: activeOrder.id })}
                >
                    <Text style={[styles.primaryButtonText, { fontSize: 18 }]}>Resume Delivery Hub</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.onlineSection, { borderBottomColor: theme.border }]}>
                <View>
                    <Text style={[styles.onlineStatus, { color: isOnline ? '#22C55E' : theme.textMuted }]}>
                        {isOnline ? 'You are Online' : 'You are Offline'}
                    </Text>
                    <Text style={[styles.onlineSub, { color: theme.textMuted }]}>
                        {isOnline ? 'Waiting for new jobs...' : 'Turn on to start receiving jobs'}
                    </Text>
                </View>
                <View style={{ gap: 8, alignItems: 'flex-end', flexDirection: 'row' }}>
                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnlineStatus}
                            disabled={isSyncing}
                            trackColor={{ false: theme.border, true: '#22C55E' }}
                            thumbColor="#FFF"
                        />
                    </View>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
            >
                {jobs?.length === 0 ? (
                    <View style={styles.emptyJobs}>
                        <Package size={48} color={theme.border} />
                        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active jobs at the moment.</Text>
                    </View>
                ) : (
                    jobs?.map((job: any) => {
                        const addr = job.delivery_address_snapshot;
                        const pickup = job.restaurants;
                        const potentialPayout = (job.pricing?.driver_earnings ||
                                                    ((Number(deliveryConfig?.driver_base) || 1.20) +
                                                        ((Number(deliveryConfig?.driver_per_km) || 0.30) * (job.pricing?.distance_km || 0)) +
                                                        (Number(deliveryConfig?.driver_bonus) || 0))
                                                ).toFixed(2);
                        
                        return (
                            <View key={job.id} style={[styles.jobCard, { backgroundColor: theme.surface }]}>
                                <View style={styles.cardInfo}>
                                    <View style={styles.jobHeader}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={[styles.orderId, { color: theme.textMuted }]}>Order #{job.id.slice(0, 8)}</Text>
                                                <Text style={{ color: theme.textMuted, fontSize: 10 }}>•</Text>
                                                <Text style={{ color: theme.textMuted, fontSize: 10 }}>
                                                    {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>
                                            <Text style={[styles.jobStatus, { color: theme.accent, fontWeight: 'bold' }]}>{job.status.replace('_', ' ').toUpperCase()}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.payout, { color: '#22C55E' }]}>${potentialPayout}</Text>
                                            <Text style={{ fontSize: 10, color: theme.textMuted }}>Est. Earnings</Text>
                                        </View>
                                    </View>

                                    <View style={styles.addressSection}>
                                        <View style={styles.addressRow}>
                                            <Store color={theme.accent} size={20} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.addressText, { color: theme.text }]}>{pickup?.name}</Text>
                                                <Text style={[styles.smallText, { color: theme.textMuted }]}>{pickup?.suburb}</Text>
                                            </View>
                                        </View>

                                        <View style={[styles.line, { backgroundColor: theme.border }]} />

                                        <View style={styles.addressRow}>
                                            <MapPin color={theme.textMuted} size={20} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.addressText, { color: theme.text }]}>{addr?.suburb}</Text>
                                                <Text style={[styles.smallText, { color: theme.textMuted }]} numberOfLines={1}>To Delivery Location</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.metricsRow}>
                                        <View style={styles.metric}>
                                            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>DISTANCE</Text>
                                            <Text style={[styles.metricValue, { color: theme.text }]}>{(job.pricing?.distance_km || 0).toFixed(1)} km</Text>
                                        </View>
                                        <View style={styles.metric}>
                                            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>EST. PAY</Text>
                                            <Text style={[styles.metricValue, { color: '#22C55E' }]}>${potentialPayout}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.actionSectionItems}>
                                        {(['confirmed', 'preparing', 'ready_for_pickup'].includes(job.status)) && !job.driver_id && (
                                            <TouchableOpacity
                                                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                                                onPress={() => acceptJob.mutate(job.id)}
                                                disabled={acceptJob.isPending}
                                            >
                                                {acceptJob.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Accept Job Offer</Text>}
                                            </TouchableOpacity>
                                        )}
                                        {job.driver_id === user?.id && ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(job.status) && (
                                            <TouchableOpacity
                                                style={[styles.primaryBtn, { backgroundColor: '#3B82F6' }]}
                                                onPress={() => navigation.navigate('ActiveDelivery', { orderId: job.id })}
                                            >
                                                <CheckCircle2 size={20} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.btnText}>Open Active Hub</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <Modal visible={showWelcome} transparent animationType="none">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <Animated.View style={{ 
                        backgroundColor: theme.surface, 
                        borderRadius: 24, 
                        padding: 32, 
                        alignItems: 'center',
                        width: '100%',
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }]
                    }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${theme.accent}20`, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                            <Store size={40} color={theme.accent} />
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 12, textAlign: 'center' }}>Welcome Aboard! 🎉</Text>
                        <Text style={{ fontSize: 16, color: theme.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>
                            Your driver application was approved! You are now ready to start accepting delivery jobs and earning with Appetite.
                        </Text>
                        <TouchableOpacity 
                            style={[styles.primaryButton, { backgroundColor: theme.accent, width: '100%' }]}
                            onPress={closeWelcome}
                        >
                            <Text style={styles.primaryButtonText}>Let's Go!</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    onlineSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1 },
    onlineStatus: { fontSize: 18, fontWeight: 'bold' },
    onlineSub: { fontSize: 12, marginTop: 2 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    jobCard: { borderRadius: 24, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    cardInfo: { padding: 20 },
    jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    orderId: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
    jobStatus: { fontSize: 12, marginTop: 2 },
    payout: { fontSize: 24, fontWeight: '900' },
    addressSection: { marginBottom: 20 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    addressText: { fontSize: 17, fontWeight: 'bold' },
    smallText: { fontSize: 13, marginTop: 1 },
    line: { width: 2, height: 20, marginLeft: 9, marginVertical: 4, opacity: 0.2 },
    metricsRow: { flexDirection: 'row', gap: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginBottom: 20 },
    metric: { flex: 1 },
    metricLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    metricValue: { fontSize: 16, fontWeight: 'bold' },
    actionSectionItems: { gap: 12 },
    navBtnSmall: { height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    navBtnText: { fontSize: 14, fontWeight: 'bold' },
    primaryBtn: { height: 56, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    emptyJobs: { marginTop: 100, alignItems: 'center', gap: 16 },
    emptyText: { fontSize: 16 },
    primaryButton: {
        backgroundColor: '#E87A5D',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
