import React, { useEffect } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/store/authStore';
import { ThemeContext, Colors } from './src/theme';
import { RootNavigator } from './src/navigation';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import { usePushNotifications } from './src/hooks/usePushNotifications';

const queryClient = new QueryClient();

export default function App() {
    // Initialize Push Notifications
    usePushNotifications();

    const colorScheme = useColorScheme();
    const { loading, user, refreshSession } = useAuthStore();

    const isDark = colorScheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    useEffect(() => {
        // Initial session check
        refreshSession();

        // Listen for auth state changes (Login, Logout, Token Refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                refreshSession();
            } else if (event === 'SIGNED_OUT') {
                refreshSession();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={theme.accent} size="large" />
            </View>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeContext.Provider value={{ theme, isDark }}>
                <NavigationContainer>
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <RootNavigator />
                </NavigationContainer>
            </ThemeContext.Provider>
        </QueryClientProvider>
    );
}
