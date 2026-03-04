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
import { Mail, Lock, User, UserPlus, ArrowLeft } from 'lucide-react-native';

export const SignUpScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role] = useState<'customer'>('customer');
    const [loading, setLoading] = useState(false);

    const setSigningUp = useAuthStore(state => state.setSigningUp);
    const refreshSession = useAuthStore(state => state.refreshSession);

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSignUp = async () => {
        if (!name.trim() || !email.trim() || !password) {
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
            // 1. Sign up user
            const { data: { user }, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name.trim() }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('User already registered')) {
                    throw new Error('This email is already registered. Try signing in instead.');
                }
                throw signUpError;
            }
            if (!user) throw new Error('Sign up failed. Please try again.');

            // 2. Create profile entries
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: name.trim()
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
                Alert.alert('Note', 'Your account was created, but there was an error setting up your profile. Please try signing in to complete your setup.');
                navigation.navigate('Login');
                return;
            }

            // 3. Assign role
            const { error: roleError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: user.id,
                    role: role
                });

            if (roleError) {
                console.error('Role assignment error:', roleError);
                // We continue because they have a profile, but the role might need fixing via support or re-login
            }

            // 5. Force session refresh to accurately load the new role
            await refreshSession();

            // If Supabase didn't auto-login (e.g. email verification required)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert(
                    'Account Created!',
                    'Welcome to Appetite! Please check your email for a verification link before signing in.',
                    [{ text: 'Got it', onPress: () => navigation.navigate('Login') }]
                );
            }
            // If they are auto-logged in, they will be seamlessly routed once we release the lock below.

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
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                        Join Appetite and start your journey
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
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.textMuted }]}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={[styles.loginLink, { color: theme.accent }]}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
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
    input: { flex: 1, fontSize: 16 },
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
