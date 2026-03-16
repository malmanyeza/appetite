import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface Address {
    id?: string;
    label?: string;
    city: string;
    suburb: string;
    street?: string;
    landmark_notes?: string;
    lat: number;
    lng: number;
    is_default?: boolean;
}

interface LocationState {
    selectedLocation: Address | null;
    setSelectedLocation: (location: Address | null) => void;
    clearLocation: () => void;
}

const secureStorage = {
    getItem: (name: string): string | Promise<string | null> | null => {
        if (Platform.OS === 'web') return localStorage.getItem(name);
        return SecureStore.getItemAsync(name);
    },
    setItem: (name: string, value: string): void | Promise<void> => {
        if (Platform.OS === 'web') return localStorage.setItem(name, value);
        return SecureStore.setItemAsync(name, value);
    },
    removeItem: (name: string): void | Promise<void> => {
        if (Platform.OS === 'web') return localStorage.removeItem(name);
        return SecureStore.deleteItemAsync(name);
    },
};

export const useLocationStore = create<LocationState>()(
    persist(
        (set) => ({
            selectedLocation: null,
            setSelectedLocation: (location) => set({ selectedLocation: location }),
            clearLocation: () => set({ selectedLocation: null }),
        }),
        {
            name: 'appetite-location-storage',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
