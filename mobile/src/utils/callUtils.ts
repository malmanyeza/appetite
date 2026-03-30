import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';

/**
 * Initiates a phone call using the native dialer.
 * @param phone The phone number to call.
 */
export const makeCall = (phone: string | null | undefined) => {
    if (!phone) {
        Alert.alert('Error', 'No phone number available for this contact.');
        return;
    }

    // Clean number (remove spaces, etc.)
    const cleanPhone = phone.replace(/\s/g, '');
    const url = `tel:${cleanPhone}`;

    Linking.canOpenURL(url)
        .then((supported) => {
            if (!supported) {
                Alert.alert('Error', 'Phone calls are not supported on this device.');
            } else {
                return Linking.openURL(url);
            }
        })
        .catch((err) => console.error('An error occurred', err));
};
