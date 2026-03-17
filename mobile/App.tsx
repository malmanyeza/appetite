import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/store/authStore';
import { ThemeContext, Colors } from './src/theme';
import { RootNavigator } from './src/navigation';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://a44a140302c25fae7acd8834c1089bc8@o4511050037723136.ingest.us.sentry.io/4511050041720832',
  debug: __DEV__,
});

const queryClient = new QueryClient();

// Global error handler for uncaught JS errors
if (typeof ErrorUtils !== 'undefined') {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.log('--- GLOBAL ERROR ---', error.message);
        Sentry.captureException(error);
        if (defaultHandler) defaultHandler(error, isFatal);
    });
}

const FallbackComponent = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#FF4D00" />
    </View>
);

function App() {
    console.log('--- APP STARTING ---');
    
    useEffect(() => {
        // Log startup success to help with debugging
        console.log('App mounting sequence started');
        
        if (!supabase) {
            console.error('CRITICAL: Supabase client failed to initialize at the module level.');
        }

        // Hide native splash screen once the JS components are ready to take over
        const hideSplash = async () => {
            await SplashScreen.hideAsync().catch(() => {});
        };
        hideSplash();
    }, []);

    // Initialize Push Notifications
    usePushNotifications();
    const [showSplash, setShowSplash] = useState(true);

    const colorScheme = useColorScheme();
    const { loading, user, refreshSession } = useAuthStore();

    const isDark = colorScheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    useEffect(() => {
        // Initial session check
        refreshSession();

        // Listen for auth state changes safely
        const authData = supabase?.auth?.onAuthStateChange((event: string, session: any) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                refreshSession(session);
            } else if (event === 'SIGNED_OUT') {
                refreshSession(null);
            }
        });

        const subscription = authData?.data?.subscription;

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    // Remove the generic loading spinner because AnimatedSplash now handles the loading phase 
    // seamlessly on top of everything.

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary FallbackComponent={FallbackComponent}>
                <QueryClientProvider client={queryClient}>
                    <ThemeContext.Provider value={{ theme, isDark }}>
                        <NavigationContainer>
                            <StatusBar style={isDark ? 'light' : 'dark'} />
                            <RootNavigator />
                        </NavigationContainer>
                        {showSplash && (
                            <AnimatedSplash 
                                isAppReady={!loading} 
                                onReady={() => setShowSplash(false)} 
                            />
                        )}
                    </ThemeContext.Provider>
                </QueryClientProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}

export default Sentry.wrap(App);
