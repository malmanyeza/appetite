import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Share,
    ActivityIndicator
} from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { Branding } from '../components/Branding';
import {
    User,
    LogOut,
    ChevronRight,
    MapPin,
    Bell,
    Share2,
    HelpCircle,
    Briefcase,
    Trash2,
    FileText,
    ShieldCheck
} from 'lucide-react-native';

export const AccountScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const [isSwitching, setIsSwitching] = useState(false);
    const { user, profile, roles, activeRole, setActiveRole, signOut } = useAuthStore();
    
    const { data: driverProfile } = useQuery({
        queryKey: ['driver-profile', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('driver_profiles')
                .select('status')
                .eq('user_id', user?.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        },
        enabled: !!user?.id && !roles.includes('driver')
    });

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone and you will lose all data.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('delete_user_account');
                            if (error) throw error;
                            signOut(); // Force local logout after remote destruction
                        } catch (err: any) {
                            Alert.alert('Error', err.message);
                        }
                    }
                }
            ]
        );
    };

    const handleRoleSwitch = async () => {
        if (isSwitching) return;
        
        try {
            setIsSwitching(true);
            
            if (activeRole === 'driver') {
                await setActiveRole('customer');
                return;
            }

            // Fast path: if they already have the driver role, switch immediately without network lookup
            if (roles.includes('driver')) {
                await setActiveRole('driver');
                return;
            }

            // They don't have the role locally, check their driver_profiles status
            const { data: driverProfile, error } = await supabase
                .from('driver_profiles')
                .select('*')
                .eq('user_id', user?.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    navigation.navigate('DriverOnboarding');
                    return;
                }
                throw error;
            }

            if (driverProfile.status === 'pending') {
                Alert.alert(
                    'Application Pending',
                    'Your driver application is currently pending review. We will notify you once approved!',
                    [{ text: 'OK' }]
                );
                return;
            }

            if (driverProfile.status === 'rejected') {
                Alert.alert(
                    'Application Rejected',
                    'Unfortunately, your driver application was not approved. Please contact support.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // If approved but role is missing, fetch fresh roles from server PROACTIVELY
            // if it's not already in our immediate local roles array.
            if (!roles.includes('driver')) {
                await useAuthStore.getState().refreshSession();
            }
            
            if (!useAuthStore.getState().roles.includes('driver')) {
                Alert.alert('Notice', 'You have been approved! Please restart your app to sync permissions.');
                return;
            }

            // Sync the store with the new role and await persistence
            await setActiveRole('driver');

        } catch (err: any) {
            Alert.alert('Error checking status', err.message);
        } finally {
            setIsSwitching(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: 'Download Appetite - The best food delivery app in Harare!',
            });
        } catch (error) {
            console.error(error);
        }
    };

    const MenuItem = ({ icon: Icon, label, value, onPress, color = theme.text, showBorder = true }: any) => (
        <TouchableOpacity
            style={[styles.menuItem, showBorder && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
            onPress={onPress}
        >
            <View style={[styles.menuIcon, { backgroundColor: `${color}15` }]}>
                <Icon size={22} color={color} />
            </View>
            <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
                {value && <Text style={[styles.menuValue, { color: theme.textMuted }]}>{value}</Text>}
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
        </TouchableOpacity>
    );

    if (!user) {
        return (
            <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={[styles.profileImage, { backgroundColor: theme.surface }]}>
                        <User size={40} color={theme.textMuted} />
                    </View>
                    <Text style={[styles.name, { color: theme.text }]}>Welcome to Appetite</Text>
                    <Text style={[styles.email, { color: theme.textMuted }]}>Sign in to track orders and save addresses</Text>

                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: theme.accent, paddingHorizontal: 40 }]}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <LogOut size={16} color="white" style={{ transform: [{ rotate: '180deg' }] }} />
                        <Text style={styles.roleBadgeText}>Sign In / Create Account</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { marginTop: 0 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>App Settings</Text>
                    <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                        <MenuItem icon={Share2} label="Invite Friends" onPress={handleShare} />
                        <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
                        <MenuItem icon={FileText} label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} />
                        <MenuItem icon={FileText} label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} showBorder={false} />
                    </View>
                </View>

                <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
                        Join thousands of food lovers in Harare getting their favorites delivered fast.
                    </Text>
                </View>

            </ScrollView>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <View style={[styles.profileImage, { backgroundColor: theme.surface }]}>
                    <Text style={{ fontSize: 40 }}>👤</Text>
                </View>
                <Text style={[styles.name, { color: theme.text }]}>{profile?.full_name || 'Appetite User'}</Text>
                <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>

                {activeRole !== 'admin' && roles.includes('admin') && (
                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: '#8B5CF6', marginBottom: 12 }]}
                        onPress={() => setActiveRole('admin')}
                        disabled={isSwitching}
                    >
                        <ShieldCheck size={16} color="white" />
                        <Text style={styles.roleBadgeText}>Switch to Admin Mode</Text>
                    </TouchableOpacity>
                )}

                {activeRole === 'customer' ? (
                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: theme.accent }]}
                        onPress={handleRoleSwitch}
                        disabled={isSwitching}
                    >
                        {isSwitching ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Briefcase size={16} color="white" />
                                <Text style={styles.roleBadgeText}>
                                    {roles.includes('driver') 
                                        ? 'Switch to Driver' 
                                        : driverProfile?.status === 'pending'
                                            ? 'Application Under Review'
                                            : 'Become a Driver'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: theme.accent }]}
                        onPress={() => setActiveRole('customer')}
                        disabled={isSwitching}
                    >
                        {isSwitching ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <User size={16} color="white" />
                                <Text style={styles.roleBadgeText}>Switch to Customer</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Account Settings</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                    <MenuItem icon={User} label="Profile Information" onPress={() => navigation.navigate('Profile')} />
                    <MenuItem icon={MapPin} label="Saved Addresses" onPress={() => navigation.navigate('AddressManagement')} />
                    <MenuItem icon={Bell} label="Notifications" onPress={() => { }} showBorder={false} />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>More</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                    <MenuItem icon={Share2} label="Invite Friends" onPress={handleShare} />
                    <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
                    <MenuItem icon={FileText} label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} />
                    <MenuItem icon={FileText} label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} showBorder={false} />
                </View>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#EF4444" />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                <Trash2 size={20} color="#DC2626" />
                <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>

            <Text style={[styles.versionText, { color: theme.textMuted }]}>
                v1.5.5 (Build 20)
            </Text>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    name: { fontSize: 24, fontWeight: 'bold' },
    email: { fontSize: 16, marginTop: 4 },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 20,
    },
    roleBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    section: { marginTop: 24, paddingHorizontal: 20 },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: 1,
    },
    menuContainer: { borderRadius: 24, overflow: 'hidden' },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuContent: { flex: 1, gap: 2 },
    menuLabel: { fontSize: 16, fontWeight: '600' },
    menuValue: { fontSize: 14 },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 40,
        marginBottom: 12,
    },
    signOutText: { color: '#EF4444', fontSize: 18, fontWeight: 'bold' },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 8,
        marginBottom: 24,
    },
    deleteText: { color: '#DC2626', fontSize: 16, fontWeight: 'bold' },
    versionText: { textAlign: 'center', fontSize: 14, marginBottom: 100 },
});
