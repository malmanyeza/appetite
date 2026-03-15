import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const usePushNotifications = () => {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);
    const { user } = useAuthStore();

    useEffect(() => {
        registerForPushNotificationsAsync().then((token) => {
            setExpoPushToken(token);
            if (token && typeof token === 'string' && !token.includes('Error:') && user && supabase) {
                // Sync to Supabase
                supabase
                    .from('profiles')
                    .update({ expo_push_token: token })
                    .eq('id', user.id)
                    .then(({ error }: { error: any }) => {
                        if (error) console.error('Failed to sync push token', error);
                        else console.log('Successfully synced push token to Supabase');
                    });
            } else if (token) {
                console.warn('Invalid token or missing Supabase/User, skipping sync:', token);
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('Notification Response:', response);
        });

        return () => {
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
        };
    }, [user]);

    return { expoPushToken, notification };
};

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        // Since Expo SDK 53, remote notifications are NOT supported in Expo Go.
        // We check if we're running in Expo Go to avoid confusing warnings/errors.
        const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
        
        if (isExpoGo) {
            console.log('--- PUSH NOTIFICATIONS ---');
            console.log('Running in Expo Go. Remote push notifications are not supported here in SDK 54.');
            console.log('To test push notifications, please use your Development Build (Native App).');
            console.log('--------------------------');
            return undefined;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return undefined;
        }

        try {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ?? 
                Constants?.easConfig?.projectId ??
                '15c0aa0d-83d5-40df-ac4d-7ab315d086da'; // Hard fallback based on app.json check

            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } else {
                console.warn('Project ID not found in Constants. Attempting fetch without ID...');
                token = (await Notifications.getExpoPushTokenAsync()).data;
            }
        } catch (e: any) {
            console.error('Failed to get Expo push token:', e);
            token = undefined;
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}
