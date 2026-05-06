import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import { navigationRef } from '../lib/navigationRef';
import { Home, ClipboardList, User, Briefcase, DollarSign, MapPin } from 'lucide-react-native';

import { CustomerHome } from '../screens/CustomerHome';
import { RestaurantDetails } from '../screens/RestaurantDetails';
import { CartScreen } from '../screens/CartScreen';
import { OrderTracking } from '../screens/OrderTracking';
import { OrdersScreen } from '../screens/OrdersScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { AddressManagementScreen } from '../screens/AddressManagementScreen';
import { DriverJobs } from '../screens/DriverJobs';
import { ActiveDelivery } from '../screens/ActiveDelivery';
import { DeliveryCompleted } from '../screens/DeliveryCompleted';
import { DriverEarnings } from '../screens/DriverEarnings';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { OrderDetailsScreen } from '../screens/OrderDetailsScreen';
import { DriverOnboarding } from '../screens/DriverOnboarding';
import { AdminOrdersScreen } from '../screens/AdminOrdersScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from '../screens/TermsOfServiceScreen';
import { HelpSupportScreen } from '../screens/HelpSupportScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { FoodItemDetail } from '../screens/FoodItemDetail';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeMain" component={CustomerHome} />
        </Stack.Navigator>
    );
};

const AccountStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AccountMain" component={AccountScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="DriverOnboarding" component={DriverOnboarding} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        </Stack.Navigator>
    );
};

const TrackingStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="TrackingMain" component={OrderTracking} />
        </Stack.Navigator>
    );
};

const OrdersStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OrdersMain" component={OrdersScreen} />
        </Stack.Navigator>
    );
};

const CustomerTabs = () => {
    const { theme } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                    if (route.name === 'Home') return <Home color={color} size={size} />;
                    if (route.name === 'Tracking') return <MapPin color={color} size={size} />;
                    if (route.name === 'Orders') return <ClipboardList color={color} size={size} />;
                    if (route.name === 'Account') return <User color={color} size={size} />;
                },
                tabBarActiveTintColor: theme.accent,
                tabBarInactiveTintColor: theme.textMuted,
                tabBarStyle: { backgroundColor: theme.background, borderTopWidth: 0, elevation: 0 },
                headerStyle: { backgroundColor: theme.background },
                headerTintColor: theme.text,
            })}
        >
            <Tab.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
            <Tab.Screen name="Tracking" component={TrackingStack} options={{ headerShown: false }} />
            <Tab.Screen name="Orders" component={OrdersStack} options={{ headerShown: false }} />
            <Tab.Screen name="Account" component={AccountStack} options={{ headerShown: false }} />
        </Tab.Navigator>
    );
};

const DriverJobsStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="JobsMain" component={DriverJobs} />
        </Stack.Navigator>
    );
};

const AdminTabs = () => {
    const { theme } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                    if (route.name === 'Live Orders') return <ClipboardList color={color} size={size} />;
                    if (route.name === 'Account') return <User color={color} size={size} />;
                },
                tabBarActiveTintColor: theme.accent,
                tabBarInactiveTintColor: theme.textMuted,
                tabBarStyle: { backgroundColor: theme.background, borderTopWidth: 0, elevation: 0 },
                headerStyle: { backgroundColor: theme.background },
                headerTintColor: theme.text,
            })}
        >
            <Tab.Screen 
                name="Live Orders" 
                component={AdminOrdersScreen} 
                options={{ headerShown: false }} 
            />
            <Tab.Screen name="Account" component={AccountStack} options={{ headerShown: false }} />
        </Tab.Navigator>
    );
};

const DriverTabs = () => {
    const { theme } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                    if (route.name === 'Jobs') return <Briefcase color={color} size={size} />;
                    if (route.name === 'Earnings') return <DollarSign color={color} size={size} />;
                    if (route.name === 'Account') return <User color={color} size={size} />;
                },
                tabBarActiveTintColor: theme.accent,
                tabBarInactiveTintColor: theme.textMuted,
                tabBarStyle: { backgroundColor: theme.background, borderTopWidth: 0, elevation: 0 },
                headerStyle: { backgroundColor: theme.background },
                headerTintColor: theme.text,
            })}
        >
            <Tab.Screen name="Jobs" component={DriverJobsStack} options={{ headerShown: false }} />
            <Tab.Screen name="Earnings" component={DriverEarnings} options={{ headerShown: false }} />
            <Tab.Screen name="Account" component={AccountStack} options={{ headerShown: false }} />
        </Tab.Navigator>
    );
};

export const RootNavigator = () => {
    const { user, activeRole, isSigningUp, pendingRedirect, setPendingRedirect } = useAuthStore();

    // Track the previous user ID so we can detect a fresh login (guest → authenticated)
    const prevUserIdRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const prevUserId = prevUserIdRef.current;
        const currentUserId = user?.id ?? null;
        prevUserIdRef.current = currentUserId;

        // A fresh login just happened and there is a pending screen to redirect to
        if (!prevUserId && currentUserId && pendingRedirect) {
            // Safety: Don't redirect if we are already on the target screen
            const isAlreadyOnTarget = navigationRef.isReady() && 
                navigationRef.getCurrentRoute()?.name === pendingRedirect;

            if (isAlreadyOnTarget) {
                setPendingRedirect(null);
                return;
            }

            // Wait for the remounted navigator to fully settle before navigating
            const timer = setTimeout(() => {
                if (navigationRef.isReady()) {
                    console.log(`[Navigation] Executing pending redirect to: ${pendingRedirect}`);
                    (navigationRef as any).navigate(pendingRedirect);
                    setPendingRedirect(null);
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [user?.id, pendingRedirect]);

    return (
        <Stack.Navigator 
            screenOptions={{ headerShown: false }}
        >
            {/* 1. Only render ONE interface as the root screen to prevent "stack slip" */}
            {user && !isSigningUp ? (
                activeRole === 'driver' ? (
                    <Stack.Screen name="DriverApp" component={DriverTabs} />
                ) : activeRole === 'admin' ? (
                    <Stack.Screen name="AdminApp" component={AdminTabs} />
                ) : (
                    <Stack.Screen name="CustomerApp" component={CustomerTabs} />
                )
            ) : (
                <Stack.Screen name="CustomerApp" component={CustomerTabs} />
            )}
            
            {/* 3. Authentication Screens (Only needed if NOT logged in) */}
            {!user && (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
                </>
            )}

            {/* 4. Shared Public & Customer Screens */}
            <Stack.Screen name="RestaurantDetails" component={RestaurantDetails} />
            <Stack.Screen name="FoodItemDetail" component={FoodItemDetail} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="OrderTracking" component={OrderTracking} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />

            {/* 5. Authenticated-Only Customer Screens (will handle guest state internally) */}
            <Stack.Screen name="AddressManagement" component={AddressManagementScreen} />
            <Stack.Screen name="ActiveDelivery" component={ActiveDelivery} />
            <Stack.Screen name="DeliveryCompleted" component={DeliveryCompleted} />
        </Stack.Navigator>
    );
};

