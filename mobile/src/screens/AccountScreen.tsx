import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Share
} from 'react-native';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/authStore';
import {
    User,
    Settings,
    LogOut,
    ChevronRight,
    MapPin,
    CreditCard,
    Bell,
    Share2,
    HelpCircle,
    Smartphone
} from 'lucide-react-native';

export const AccountScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const { user, profile, roles, activeRole, setActiveRole, signOut } = useAuthStore();

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

    const handleRoleSwitch = () => {
        const otherRole = activeRole === 'customer' ? 'driver' : 'customer';
        if (roles.includes(otherRole)) {
            setActiveRole(otherRole);
        } else {
            Alert.alert(
                'Switch Role',
                `You don't have a ${otherRole} profile yet. Would you like to create one?`,
                [{ text: 'Maybe Later', style: 'cancel' }]
            );
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

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <View style={[styles.profileImage, { backgroundColor: theme.surface }]}>
                    <Text style={{ fontSize: 40 }}>👤</Text>
                </View>
                <Text style={[styles.name, { color: theme.text }]}>{profile?.full_name || 'Appetite User'}</Text>
                <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>

                {roles.length > 1 && (
                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: theme.accent }]}
                        onPress={handleRoleSwitch}
                    >
                        <Smartphone size={16} color="white" />
                        <Text style={styles.roleBadgeText}>
                            Switch to {activeRole === 'customer' ? 'Driver' : 'Customer'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Account Settings</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                    <MenuItem icon={User} label="Profile Information" onPress={() => navigation.navigate('Profile')} />
                    <MenuItem icon={MapPin} label="Saved Addresses" onPress={() => navigation.navigate('AddressManagement')} />
                    <MenuItem icon={CreditCard} label="Payment Methods" onPress={() => { }} />
                    <MenuItem icon={Bell} label="Notifications" onPress={() => { }} showBorder={false} />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>More</Text>
                <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                    <MenuItem icon={Share2} label="Invite Friends" onPress={handleShare} />
                    <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => { }} />
                    <MenuItem icon={Settings} label="App Settings" onPress={() => { }} showBorder={false} />
                </View>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#EF4444" />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={[styles.versionText, { color: theme.textMuted }]}>Version 1.0.0 (Build 5)</Text>
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
    versionText: { textAlign: 'center', fontSize: 14, marginBottom: 100 },
});
