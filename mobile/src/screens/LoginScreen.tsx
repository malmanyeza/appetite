import React, { useState } from 'react';
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
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react-native';

export const LoginScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
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

            // Explicitly ping the authoritative backend to prevent zombie passwords bypassing cache
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                await supabase.auth.signOut().catch(() => { });
                throw new Error('This account has been administratively disabled or deleted.');
            }

            // Strictly check if the user exists in our public database (profiles)
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();

            if (!profile) {
                await supabase.auth.signOut().catch(() => { });
                throw new Error('This user does not exist in the database. Please sign up or contact support.');
            }

            // Manually trigger a store refresh to ensure the session is picked up immediately
            // regardless of the race condition with the initial app boot check.
            await useAuthStore.getState().refreshSession(data.session);
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                            Sign in to continue ordering delicious food
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
                                secureTextEntry
                                style={[styles.input, { color: theme.text }]}
                            />
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
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textMuted }]}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                            <Text style={[styles.signUpLink, { color: theme.accent }]}>Sign Up</Text>
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
    input: { flex: 1, fontSize: 16 },
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
});
