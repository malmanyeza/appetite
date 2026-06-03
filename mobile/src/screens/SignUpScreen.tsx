import React, { useState, useEffect } from 'react';
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
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, Mail, Lock, User, UserCircle, Car, Phone, Eye, EyeOff } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

export const SignUpScreen = ({ navigation, route }: any) => {
    const { theme } = useTheme();
    const returnToCart = route?.params?.returnToCart ?? false;
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role] = useState<'customer'>('customer');
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

    const setSigningUp = useAuthStore(state => state.setSigningUp);
    const setPendingRedirect = useAuthStore(state => state.setPendingRedirect);
    const refreshSession = useAuthStore(state => state.refreshSession);

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSignUp = async () => {
        if (!name.trim() || !email.trim() || !password || !phone.trim()) {
            Alert.alert('Missing Fields', 'Please fill in all fields to create your account.');
            return;
        }

        if (name.trim().length < 2) {
            Alert.alert('Invalid Name', 'Please enter your full name (at least 2 characters).');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Weak Password', 'Your password must be at least 6 characters long.');
            return;
        }

        setLoading(true);
        setSigningUp(true);
        try {
            // 0. Safely check if phone number already exists using RPC
            // Direct table query (Profiles) fails for unauthenticated users due to RLS
            const { data: phoneIsTaken, error: rpcError } = await supabase
                .rpc('check_phone_exists', { phone_number: phone.trim() });

            if (rpcError) {
                console.error('RPC Phone check error:', rpcError);
                // We proceed if RPC fails but log it for debugging
            }

            if (phoneIsTaken) {
                throw new Error('This phone number is already registered. Please use a different number or sign in.');
            }

            // 1. Sign up user
            const { data: { user, session }, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { 
                        full_name: name.trim(),
                        phone: phone.trim()
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('User already registered')) {
                    throw new Error('This email is already registered. Try signing in instead.');
                }
                throw signUpError;
            }
            if (!user) throw new Error('Sign up failed. Please try again.');

            // 2. Profile & roles are auto-created on the server via DB trigger.

            // 3. Check if email verification is required.
            //    If auto-confirm is enabled in Supabase, session will be returned immediately.
            if (!session) {
                // Email verification required — navigate before auth state change remounts navigator
                navigation.navigate('EmailVerification', { email: email.trim() });
            } else {
                // Auto-signed-in — explicitly update the store with the session.
                // This is more reliable on iOS than waiting for onAuthStateChange.
                await refreshSession(session);
                
                if (returnToCart) {
                    setPendingRedirect('Cart');
                }
            }

        } catch (error: any) {
            Alert.alert('Sign Up Failed', error.message);
        } finally {
            setSigningUp(false);
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
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                            {returnToCart
                                ? 'Create an account to complete your order'
                                : 'Join Appetite and start your journey'}
                        </Text>
                </View>
                <View style={styles.form}>
                    <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
                        <User size={20} color={theme.textMuted} />
                        <TextInput
                            placeholder="Full Name"
                            placeholderTextColor={theme.textMuted}
                            value={name}
                            onChangeText={setName}
                            style={[styles.input, { color: theme.text }]}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.surface }]}>
                        <Phone size={20} color={theme.textMuted} />
                        <TextInput
                            placeholder="Phone Number (e.g. +123456789)"
                            placeholderTextColor={theme.textMuted}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            style={[styles.input, { color: theme.text }]}
                        />
                    </View>

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

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, paddingHorizontal: 16 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                            By signing up, you agree to our{' '}
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold' }}>Terms of Service</Text>
                        </TouchableOpacity>
                        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                            {' '}and{' '}
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold' }}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                            .
                        </Text>
                    </View>

                     <TouchableOpacity
                        style={[styles.signUpButton, { backgroundColor: theme.accent }]}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.signUpButtonText}>Create Account</Text>
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
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textMuted }]}>Already have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.loginLink, { color: theme.accent }]}>Sign In</Text>
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
    scrollContent: { padding: 24 },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    header: { marginBottom: 32 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16 },
    roleContainer: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    roleCard: {
        flex: 1,
        height: 100,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    roleText: { fontWeight: 'bold', fontSize: 16 },
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
    signUpButton: {
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
    signUpButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 32,
        marginBottom: 40,
    },
    footerText: { fontSize: 16 },
    loginLink: { fontSize: 16, fontWeight: 'bold' },
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
