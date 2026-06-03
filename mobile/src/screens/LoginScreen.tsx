import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Branding } from '../components/Branding';
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

export const LoginScreen = ({ navigation, route }: any) => {
    const { theme } = useTheme();
    const returnToCart = route?.params?.returnToCart ?? false;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

        const isIos = Platform.OS === 'ios';
        const hasValidIosClientId = !!(
            iosClientId &&
            iosClientId.trim() !== '' &&
            !iosClientId.includes('YOUR_GOOGLE_IOS_CLIENT_ID')
        );

        if (isIos && !hasValidIosClientId) {
            console.warn('[GoogleSignin] Native Google Sign-In is not configured for iOS yet (missing or placeholder EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID). Skipping configuration to prevent startup crash.');
            return;
        }

        try {
            GoogleSignin.configure({
                webClientId: webClientId && !webClientId.includes('YOUR_GOOGLE_WEB_CLIENT_ID') ? webClientId : undefined,
                iosClientId: hasValidIosClientId ? iosClientId : undefined,
            });
        } catch (err) {
            console.warn('[GoogleSignin] Failed to configure native Google SDK:', err);
        }
    }, []);


    const handleOAuth = async (provider: 'google' | 'apple') => {
        if (provider === 'google') {
            const isIos = Platform.OS === 'ios';
            const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
            const hasValidIosClientId = !!(
                iosClientId &&
                iosClientId.trim() !== '' &&
                !iosClientId.includes('YOUR_GOOGLE_IOS_CLIENT_ID')
            );

            if (isIos && !hasValidIosClientId) {
                Alert.alert(
                    'Google Sign-In Setup Required',
                    'Native Google Sign-In is not fully configured for iOS yet.\n\nPlease update your mobile/.env file with a valid "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" and rebuild the application to enable native Google Sign-In on iOS.',
                    [{ text: 'OK' }]
                );
                return;
            }
        }

        setLoading(true);
        try {
            if (provider === 'google') {
                if (Platform.OS === 'android') {
                    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                }

                // Force showing the Google account picker by signing out first
                try {
                    await GoogleSignin.signOut();
                } catch (signOutError) {
                    // Ignore error if already signed out
                }

                const userInfo = await GoogleSignin.signIn();
                const idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;

                if (!idToken) {
                    throw new Error('No Google identity token (ID Token) was returned from the native sign-in.');
                }

                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: idToken,
                });

                if (error) throw error;

                if (returnToCart) {
                    useAuthStore.getState().setPendingRedirect('Cart');
                }
            } else {
                if (Platform.OS === 'ios') {
                    // Check if native Apple authentication is available
                    const isAvailable = await AppleAuthentication.isAvailableAsync();
                    if (!isAvailable) {
                        throw new Error('Native Apple Authentication is not available on this device.');
                    }

                    const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                    });

                    if (credential.identityToken) {
                        const { error } = await supabase.auth.signInWithIdToken({
                            provider: 'apple',
                            token: credential.identityToken,
                        });
                        if (error) throw error;

                        if (returnToCart) {
                            useAuthStore.getState().setPendingRedirect('Cart');
                        }
                    } else {
                        throw new Error('No identity token was returned from native Apple Sign-In.');
                    }
                } else {
                    // Fallback to standard web-based OAuth for non-iOS platforms
                    // Generate standard dynamic redirect URL using Expo Linking
                    const redirectUrl = Linking.createURL('signup-callback');
                    console.log(`[OAuth] Redirect URL set to: ${redirectUrl}`);

                    // Call Supabase OAuth
                    const { data, error } = await supabase.auth.signInWithOAuth({
                        provider: provider,
                        options: {
                            redirectTo: redirectUrl,
                            skipBrowserRedirect: true,
                        },
                    });

                    if (error) throw error;
                    if (!data?.url) throw new Error(`Failed to generate ${provider} OAuth URL.`);

                    // Open in-app browser using Expo WebBrowser
                    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                    if (result.type === 'success' && result.url) {
                        // Parse returned URL and set session
                        const parsed = parseSessionParams(result.url);
                        const accessToken = parsed.access_token;
                        const refreshToken = parsed.refresh_token;

                        if (accessToken && refreshToken) {
                            const { error: sessionError } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });

                            if (sessionError) throw sessionError;

                            // Set standard Zustand pendingRedirect if returnToCart is true
                            if (returnToCart) {
                                useAuthStore.getState().setPendingRedirect('Cart');
                            }
                        } else {
                            throw new Error('No authentication tokens found in session redirection.');
                        }
                    }
                }
            }
        } catch (error: any) {
            if (provider === 'google' && error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('[OAuth] Native Google Sign-In was cancelled by the user.');
            } else if (provider === 'apple' && (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED')) {
                console.log('[OAuth] Native Apple Sign-In was cancelled by the user.');
            } else {
                console.error(`[OAuth] Error during ${provider} sign-in:`, error);
                Alert.alert(`${provider === 'google' ? 'Google' : 'Apple'} Sign-In Failed`, error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setLoading(true);
        try {
            const cleanEmail = email.trim();
            const cleanPassword = password.trim();

            const { error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: cleanPassword,
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Incorrect email or password. Please try again.');
                }
                if (error.message.toLowerCase().includes('email not confirmed')) {
                    navigation.navigate('EmailVerification', { email: email.trim() });
                    return;
                }
                throw error;
            }

            // Note: We no longer perform any secondary checks (getUser or profiles ping) here.
            // The onAuthStateChange listener in App.tsx now handles the 
            // sub-second transition to the Home screen automatically.
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flex: 1 }} />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: theme.accent }]}>
                            <LogIn color="white" size={32} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
                        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                            {returnToCart
                                ? 'Sign in to complete your order'
                                : 'Sign in to continue ordering delicious food'}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
                            <Mail size={20} color={theme.textMuted} />
                            <TextInput
                                placeholder="Email Address"
                                placeholderTextColor={theme.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={[styles.input, { color: theme.text }]}
                            />
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
                            <Lock size={20} color={theme.textMuted} />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor={theme.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                style={[styles.input, { color: theme.text }]}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                                {showPassword ? (
                                    <EyeOff size={20} color={theme.textMuted} />
                                ) : (
                                    <Eye size={20} color={theme.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={() => navigation.navigate('ForgotPassword')}
                            style={styles.forgotPasswordContainer}
                        >
                            <Text style={[styles.forgotPasswordText, { color: theme.textMuted }]}>
                                Forgot Password?
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, { backgroundColor: theme.accent }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.loginButtonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                            <Text style={[styles.dividerText, { color: theme.textMuted }]}>or continue with</Text>
                            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                        </View>

                        <View style={styles.socialButtons}>
                            <TouchableOpacity 
                                style={[styles.socialButton, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                                onPress={() => handleOAuth('google')}
                                disabled={loading}
                            >
                                <GoogleIcon size={20} />
                                <Text style={[styles.socialButtonText, { color: theme.text }]}>Continue with Google</Text>
                            </TouchableOpacity>

                            {Platform.OS === 'ios' && (
                                <TouchableOpacity 
                                    style={[styles.socialButton, { backgroundColor: '#000000' }]}
                                    onPress={() => handleOAuth('apple')}
                                    disabled={loading}
                                >
                                    <AppleIcon size={20} color="white" />
                                    <Text style={[styles.socialButtonText, { color: 'white' }]}>Continue with Apple</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textMuted }]}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                            <Text style={[styles.signUpLink, { color: theme.accent }]}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 20, alignItems: 'center' }}>
                        <TouchableOpacity 
                            onPress={() => navigation.navigate('CustomerApp')}
                            style={{ padding: 12 }}
                        >
                            <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '600', opacity: 0.8 }}>
                                Continue as Guest
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={{ flex: 1 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    content: { padding: 24 },
    header: { alignItems: 'center', marginBottom: 48 },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#FF4D00',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
    form: { gap: 16 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 60,
        borderRadius: 16,
        gap: 12,
    },
    input: { flex: 1, fontSize: 16, height: '100%', minHeight: 40 },
    loginButton: {
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#FF4D00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 32,
    },
    footerText: { fontSize: 16 },
    signUpLink: { fontSize: 16, fontWeight: 'bold' },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    forgotPasswordText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        fontWeight: '600',
    },
    socialButtons: {
        gap: 12,
    },
    socialButton: {
        height: 60,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    socialButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});

// -----------------------------------------------------------------------------
// SVG Icons & Helper Functions
// -----------------------------------------------------------------------------

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z" />
        <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z" />
        <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.422-5.189l-6.13-5.219C29.29 34.856 26.785 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.13 5.219C40.912 35.342 44 30.038 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
);

const AppleIcon = ({ size = 20, color = 'white' }: { size?: number, color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
            fill={color}
            d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        />
    </Svg>
);

const parseSessionParams = (url: string) => {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
        const queryIndex = url.indexOf('?');
        if (queryIndex === -1) return {};
        const queryString = url.substring(queryIndex + 1);
        return parseParams(queryString);
    }
    const hashString = url.substring(hashIndex + 1);
    return parseParams(hashString);
};

const parseParams = (paramString: string) => {
    const params: Record<string, string> = {};
    const pairs = paramString.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    }
    return params;
};
