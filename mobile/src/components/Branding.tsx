import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';

interface BrandingProps {
    color?: string;
    showFromText?: boolean;
    style?: any;
    withBackground?: boolean;
}

export const Branding = ({ 
    showFromText = true, 
    style,
    color,
    withBackground = true 
}: BrandingProps) => {
    
    const content = (
        <>
            {showFromText && (
                <Text style={[styles.fromText, color ? { color } : undefined]}>from</Text>
            )}
            <Image 
                source={require('../../assets/images/nexura_logo.png')}
                style={styles.logo}
                resizeMode="contain"
                fadeDuration={0} // Prevents "pop-in" delay on Android
            />
        </>
    );

    return (
        <View style={[styles.wrapper, style]}>
            <View 
                style={[
                    styles.container, 
                    withBackground && styles.glassEffect,
                    !withBackground && { backgroundColor: 'transparent', borderColor: 'transparent' }
                ]}
            >
                {content}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    glassEffect: {
        // Frosty White finish to block out complex backgrounds
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
                backgroundColor: '#FFFFFF', // solid white for better contrast on Android
            }
        })
    },
    fromText: {
        fontSize: 12,               // Slightly larger for lowercase legibility
        textTransform: 'lowercase', 
        letterSpacing: 0.5,         // Organic spacing for lowercase
        marginBottom: 0,
        fontWeight: '500',          // Medium weight for a cleaner look
        color: '#444444', 
    },
    logo: {
        width: 88,
        height: 20,
    },
});
