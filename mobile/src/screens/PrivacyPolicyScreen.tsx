import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { ArrowLeft } from 'lucide-react-native';

export const PrivacyPolicyScreen = ({ navigation }: any) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy Policy</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: theme.text }]}>Privacy Policy for Appetize</Text>
                <Text style={[styles.date, { color: theme.textMuted }]}>Last Updated: March 2026</Text>

                <Text style={[styles.paragraph, { color: theme.text }]}>
                    Welcome to Appetize! Your privacy is critically important to us. This Privacy Policy outlines how we collect, use, and protect your personal data.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>1. Information We Collect</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • Account Information: Name, email address, phone number, and password.{'\n'}
                    • Location Data: GPS location is collected when the app is active to dispatch deliveries and track orders accurately.{'\n'}
                    • Driver Data: Background information, vehicle details, and photo identification.{'\n'}
                    • Usage Data: Device information, crash logs, and app interaction data.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>2. How We Use Your Information</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • To facilitate food ordering, payment processing, and delivery.{'\n'}
                    • To provide real-time location tracking for active orders.{'\n'}
                    • To verify the identity of our delivery drivers.{'\n'}
                    • To communicate with you regarding your orders or account security.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>3. Data Sharing</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    We do not sell your personal data. We only share information with restaurants to prepare your order, drivers to deliver your order, and service providers required to run the app.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>4. Your Rights and Account Deletion</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    You have the right to access, modify, or delete your personal data. You can permanently delete your account and all associated data directly within the Appetize app by navigating to Account settings and tapping 'Delete Account'.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>5. Contact Us</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    If you have any questions about this Privacy Policy, please contact us at malmanyeza@gmail.com.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        padding: 24,
        paddingBottom: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    date: {
        fontSize: 14,
        marginBottom: 24,
    },
    heading: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 24,
    },
});
