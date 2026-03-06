import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { ArrowLeft } from 'lucide-react-native';

export const TermsOfServiceScreen = ({ navigation }: any) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Terms of Service</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: theme.text }]}>Terms of Service for Appetite</Text>
                <Text style={[styles.date, { color: theme.textMuted }]}>Last Updated: March 2026</Text>

                <Text style={[styles.paragraph, { color: theme.text }]}>
                    Please read these Terms of Service carefully before using the Appetite mobile application.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>1. Acceptance of Terms</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    By creating an account and using Appetite, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the application.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>2. User Accounts</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • You must provide accurate and complete information when creating an account.{'\n'}
                    • You are responsible for maintaining the security of your account credentials.{'\n'}
                    • Appetite reserves the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>3. Ordering and Delivery</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • Appetite acts as an intermediary between you, independent restaurants, and independent delivery drivers.{'\n'}
                    • Delivery times are estimates and may vary.{'\n'}
                    • All sales are final once an order is confirmed by the restaurant.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>4. Driver Obligations</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    • Drivers must maintain valid licenses, insurance, and vehicle registration.{'\n'}
                    • Drivers agree to deliver orders safely, promptly, and professionally.{'\n'}
                    • Drivers are independent contractors, not employees.
                </Text>

                <Text style={[styles.heading, { color: theme.text }]}>5. Limitation of Liability</Text>
                <Text style={[styles.paragraph, { color: theme.text }]}>
                    Appetite is not liable for indirect, incidental, or consequential damages arising from your use of the service. We do not guarantee that the app will be error-free or uninterrupted.
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
