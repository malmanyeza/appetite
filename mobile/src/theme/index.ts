import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export const Colors = {
    dark: {
        background: '#0F0F0F',
        surface: '#1A1A1A',
        text: '#FFFFFF',
        textMuted: '#A3A3A3',
        accent: '#FF4D00',
        border: '#2A2A2A',
    },
    light: {
        background: '#FFFFFF',
        surface: '#F6F6F6',
        text: '#0F0F0F',
        textMuted: '#737373',
        accent: '#FF4D00',
        border: '#E5E5E5',
    }
};

export type Theme = typeof Colors.light;

export const ThemeContext = createContext<{
    theme: Theme;
    isDark: boolean;
}>({
    theme: Colors.light,
    isDark: false,
});

export const useTheme = () => useContext(ThemeContext);
