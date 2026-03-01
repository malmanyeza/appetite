import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import { Home, ClipboardList, User, Briefcase, DollarSign, MapPin } from 'lucide-react-native';

import { CustomerHome } from '../screens/CustomerHome';
import { RestaurantDetails } from '../screens/RestaurantDetails';
import { CartScreen } from '../screens/CartScreen';
import { OrderTracking } from '../screens/OrderTracking';
import { OrdersScreen } from '../screens/OrdersScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { AddressManagementScreen } from '../screens/AddressManagementScreen';
import { DriverJobs } from '../screens/DriverJobs';
import { DriverEarnings } from '../screens/DriverEarnings';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { OrderDetailsScreen } from '../screens/OrderDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeMain" component={CustomerHome} />
            <Stack.Screen name="RestaurantDetails" component={RestaurantDetails} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="AddressManagement" component={AddressManagementScreen} />
        </Stack.Navigator>
    );
};

const AccountStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AccountMain" component={AccountScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
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
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
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
            <Tab.Screen name="Jobs" component={DriverJobs} options={{ headerShown: false }} />
            <Tab.Screen name="Earnings" component={DriverEarnings} options={{ headerShown: false }} />
            <Tab.Screen name="Account" component={AccountStack} options={{ headerShown: false }} />
        </Tab.Navigator>
    );
};

export const RootNavigator = () => {
    const { user, activeRole } = useAuthStore();

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                </>
            ) : activeRole === 'driver' ? (
                <Stack.Screen name="DriverApp" component={DriverTabs} />
            ) : (
                <Stack.Screen name="CustomerApp" component={CustomerTabs} />
            )}
        </Stack.Navigator>
    );
};
