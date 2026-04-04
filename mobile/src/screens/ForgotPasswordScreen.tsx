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
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import { Mail, ArrowLeft, Send } from 'lucide-react-native';

export const ForgotPasswordScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPasswordForEmail } = useAuthStore();

    const handleResetRequest = async () => {
        if (!email) {
            Alert.alert('Missing Email', 'Please enter your email address to reset your password.');
            return;
        }
    
        const cleanedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanedEmail)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }
    
        setLoading(true);
        try {
            // Pre-check: Status of the user (exists/confirmed)
            const { data: status, error: statusError } = await supabase
                .rpc('check_user_status', { email_text: cleanedEmail });

            if (statusError) {
                console.error('Status check error:', statusError);
                // Fallback to standard behavior if RPC fails
            } else {
                if (!status.exists) {
                    throw new Error('This email address is not registered. Please sign up first.');
                }
                if (!status.confirmed) {
                    throw new Error('Your email has not been verified yet. Please check your inbox for the confirmation link or sign in to resend it.');
                }
            }
            
            await resetPasswordForEmail(cleanedEmail);
            
            Alert.alert(
                'Link Sent!',
                'We have sent a password reset link to your email. Please check your inbox and spam folder!',
                [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
            );
        } catch (error: any) {
            Alert.alert('Unable to Reset', error.message || 'Failed to send reset link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>

                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: theme.accent }]}>
                            <Mail color="white" size={32} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>Forgot Password?</Text>
                        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                            Enter your email address and we'll send you a link to reset your password.
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

                        <TouchableOpacity
                            style={[styles.resetButton, { backgroundColor: theme.accent }]}
                            onPress={handleResetRequest}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text style={styles.resetButtonText}>Send Reset Link</Text>
                                    <Send color="white" size={20} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 24 },
    backButton: {
        marginTop: Platform.OS === 'ios' ? 40 : 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: { marginTop: 40 },
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
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
    subtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
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
    resetButton: {
        height: 60,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 12,
        shadowColor: '#FF4D00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    resetButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
