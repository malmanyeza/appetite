import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme, Text, LogBox } from 'react-native';
import * as ExpoLinking from 'expo-linking';

// Ignore all React Native LogBox notifications in the app completely
LogBox.ignoreAllLogs();
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/store/authStore';
import { ThemeContext, Colors, Fonts } from './src/theme';
import { RootNavigator } from './src/navigation';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { useNetwork } from './src/hooks/useNetwork';
import { useLocationStore } from './src/store/locationStore';
import { useApprovalListener } from './src/hooks/useApprovalListener';
import { WifiOff } from 'lucide-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from 'react-error-boundary';
import { GlobalError } from './src/components/GlobalError';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from './src/lib/navigationRef';
import { 
    useFonts, 
    Outfit_400Regular, 
    Outfit_700Bold, 
    Outfit_900Black 
} from '@expo-google-fonts/outfit';
import { 
    Inter_400Regular, 
    Inter_700Bold,
    Inter_500Medium
} from '@expo-google-fonts/inter';


const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5, // 5 minutes (allow offline viewing of recent data)
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            networkMode: 'offlineFirst',
        },
        mutations: {
            networkMode: 'offlineFirst',
        }
    }
});

// Global error handler for uncaught JS errors
if (typeof ErrorUtils !== 'undefined') {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.log('--- GLOBAL ERROR ---', error.message);
        
        // In development, we might still want to see the RedBox for easier debugging.
        // In production, we definitely want to avoid it.
        if (__DEV__) {
            if (defaultHandler) defaultHandler(error, isFatal);
        } else {
            // In production, we've already logged to Sentry.
            // If it's fatal, the ErrorBoundary at the root will handle it if it's a render error.
            // For other fatal errors, we could show a final alert.
            if (isFatal) {
                // You could add a native alert here if needed
            }
        }
    });
}

// FallbackComponent is now handled by GlobalError.tsx

const ConnectionBanner = ({ isOnline, theme }: { isOnline: boolean, theme: any }) => {
    if (isOnline) return null;
    return (
        <View style={{ 
            backgroundColor: '#EF4444', 
            paddingTop: 50, 
            paddingBottom: 8, 
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 9999
        }}>
            <WifiOff size={14} color="white" />
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>Offline: Some features may be limited</Text>
        </View>
    );
};

function App() {
    console.log('--- APP STARTING ---');
    
    useEffect(() => {
        // Log startup success to help with debugging
        console.log('App mounting sequence started');
        
        if (!supabase) {
            console.error('CRITICAL: Supabase client failed to initialize at the module level.');
        }

        // Note: SplashScreen.hideAsync() is now handled below to ensure 
        // there is NO gap between the native splash and our custom animation.
    }, []);

    // Initialize Push Notifications
    usePushNotifications();
    
    // Background listener for driver approval status
    useApprovalListener();

    const [showSplash, setShowSplash] = useState(true);
    const [fontsLoaded] = useFonts({
        Outfit_400Regular,
        Outfit_700Bold,
        Outfit_900Black,
        Inter_400Regular,
        Inter_700Bold,
        Inter_500Medium
    });

    const colorScheme = useColorScheme();
    const { loading, user, refreshSession } = useAuthStore();
    const setSplashHasFinished = useLocationStore(state => state.setSplashHasFinished);
    const setHasAutoPrompted = useLocationStore(state => state.setHasAutoPrompted);
    const { isOnline } = useNetwork();
    
    // -------------------------------------------------------------------------
    // Deep Link Discovery & Debugging
    // -------------------------------------------------------------------------
    const initialUrl = ExpoLinking.useURL();
    
    useEffect(() => {
        if (initialUrl) {
            console.log('--- INCOMING DEEP LINK DETECTED ---');
            console.log(`URL: ${initialUrl}`);
            
            // Helpful for debugging on physical devices where terminal isn't visible 
            if (__DEV__) {
                console.log(`[Link Info] Host: ${ExpoLinking.parse(initialUrl).path}`);
            }
        }
    }, [initialUrl]);

    const isDark = colorScheme === 'dark';
    const theme = isDark ? { ...Colors.dark, fonts: Fonts } : { ...Colors.light, fonts: Fonts };

    useEffect(() => {
        // Initial session check
        refreshSession();
        
        // Fail-safe: Always dismiss splash after 5 seconds to prevent getting stuck
        const failSafeTimeout = setTimeout(() => {
            if (showSplash) {
                console.warn('[App] Fail-safe triggered: Dismissing splash screen after 5s');
                setShowSplash(false);
            }
        }, 5000);

        // Listen for auth state changes safely
        const authData = supabase?.auth?.onAuthStateChange((event: string, session: any) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                refreshSession(session);
            } else if (event === 'SIGNED_OUT') {
                refreshSession(null);
            } else if (event === 'PASSWORD_RECOVERY') {
                console.log('[Auth] Password recovery event detected');
            }
        });

        const subscription = authData?.data?.subscription;

        return () => {
            if (subscription) subscription.unsubscribe();
            clearTimeout(failSafeTimeout);
        };
    }, []);

    const appLinkingConfig = React.useMemo(() => ({
        prefixes: [
            ExpoLinking.createURL('/'),
            'https://malmanyeza.github.io/appetite',
            'https://malmanyeza.github.io',
            'appetite://'
        ],
        config: {
            screens: {
                ResetPassword: 'reset-password',
                Login: 'signup-callback',
                ForgotPassword: 'forgot-password',
            },
        },
    }), []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary 
                FallbackComponent={GlobalError as any}
                onReset={() => {
                    queryClient.clear();
                }}
            >
                <QueryClientProvider client={queryClient}>
                    <ThemeContext.Provider value={{ theme, isDark }}>
                        <NavigationContainer 
                            ref={navigationRef} 
                            linking={appLinkingConfig}
                            fallback={<ActivityIndicator color={theme.accent} size="large" style={{ flex: 1 }} />}
                        >
                            <StatusBar style={isDark ? 'light' : 'dark'} />
                            <ConnectionBanner isOnline={isOnline} theme={theme} />
                            <RootNavigator />
                        </NavigationContainer>
                        {showSplash && (
                            <AnimatedSplash 
                                isAppReady={!loading && fontsLoaded} 
                                onReady={() => {
                                    setShowSplash(false);
                                    useLocationStore.getState().setSplashHasFinished(true);
                                }} 
                            />
                        )}
                    </ThemeContext.Provider>
                </QueryClientProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}

export default App;
