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
import { User, Phone, LogOut, ArrowRight } from 'lucide-react-native';

export const PhoneEntryScreen = () => {
    const { theme } = useTheme();
    const { user, profile, refreshProfile, signOut } = useAuthStore();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('+263'); // Prefilled with Zimbabwe's country code
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Prefill name if available and not 'Unnamed User'
        if (profile?.full_name && profile.full_name !== 'Unnamed User') {
            setName(profile.full_name);
        }
    }, [profile]);

    const validatePhone = (number: string) => {
        // Must start with + and contain at least 8 digits
        const clean = number.trim();
        return clean.startsWith('+') && clean.length >= 9 && /^\+[0-9]+$/.test(clean);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Name', 'Please enter your full name.');
            return;
        }

        const trimmedPhone = phone.trim();
        if (!trimmedPhone || trimmedPhone === '+263') {
            Alert.alert('Missing Phone Number', 'Please enter your phone number.');
            return;
        }

        if (!validatePhone(trimmedPhone)) {
            Alert.alert(
                'Invalid Phone Number',
                'Please enter a valid phone number starting with the country code (e.g. +263771234567).'
            );
            return;
        }

        setLoading(true);
        try {
            // 1. Check if the phone number is already registered in the profiles table
            const { data: phoneIsTaken, error: rpcError } = await supabase
                .rpc('check_phone_exists', { phone_number: trimmedPhone });

            if (rpcError) {
                console.error('RPC Phone check error:', rpcError);
            }

            if (phoneIsTaken) {
                throw new Error('This phone number is already registered. Please use a different phone number.');
            }

            // 2. Update profiles table with phone number and full name
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: name.trim(),
                    phone: trimmedPhone
                })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            // 3. Refresh user profile in authStore, which triggers navigator remount
            await refreshProfile();

            Alert.alert('Welcome!', 'Your profile has been completed successfully.');
        } catch (error: any) {
            Alert.alert('Profile Update Failed', error.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Sign Out', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut();
                        } catch (err: any) {
                            Alert.alert('Error', err.message);
                        }
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                        <View style={[styles.iconContainer, { backgroundColor: theme.accent }]}>
                            <Phone color="white" size={32} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>Almost There!</Text>
                        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                            To complete your registration, please verify your full name and enter your Zimbabwean or international phone number.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: theme.textMuted }]}>FULL NAME</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <User size={20} color={theme.textMuted} />
                                <TextInput
                                    placeholder="Enter your full name"
                                    placeholderTextColor={theme.textMuted}
                                    value={name}
                                    onChangeText={setName}
                                    style={[styles.input, { color: theme.text }]}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: theme.textMuted }]}>PHONE NUMBER</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <Phone size={20} color={theme.textMuted} />
                                <TextInput
                                    placeholder="+263 7..."
                                    placeholderTextColor={theme.textMuted}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    style={[styles.input, { color: theme.text }]}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: theme.accent }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text style={styles.submitButtonText}>Complete Sign Up</Text>
                                    <ArrowRight size={20} color="white" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                            <LogOut size={16} color={theme.textMuted} />
                            <Text style={[styles.signOutText, { color: theme.textMuted }]}>
                                Use a different account
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
    scrollContent: { flexGrow: 1, padding: 24 },
    content: { flex: 1, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 40 },
    iconContainer: {
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
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 12, lineHeight: 22 },
    form: { gap: 20 },
    inputContainer: { gap: 8 },
    label: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 60,
        borderRadius: 16,
        gap: 12,
    },
    input: { flex: 1, fontSize: 16, height: '100%' },
    submitButton: {
        height: 60,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#FF4D00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    footer: {
        alignItems: 'center',
        marginTop: 32,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    signOutText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
