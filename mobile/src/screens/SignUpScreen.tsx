import React, { useState } from 'react';
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
import { ArrowLeft, Mail, Lock, User, UserCircle, Car, Phone } from 'lucide-react-native';

export const SignUpScreen = ({ navigation, route }: any) => {
    const { theme } = useTheme();
    const returnToCart = route?.params?.returnToCart ?? false;
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role] = useState<'customer'>('customer');
    const [loading, setLoading] = useState(false);

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
                            secureTextEntry
                            style={[styles.input, { color: theme.text }]}
                        />
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
});
