import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Easing, View, Platform } from 'react-native';
import { Branding } from './Branding';
import { useLocationStore } from '../store/locationStore';

const word = 'appetite';

interface AnimatedSplashProps {
    onReady: () => void;
    isAppReady: boolean;
    isFirstLaunch?: boolean | null;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onReady, isAppReady }) => {
    const [animationDone, setAnimationDone] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [waveComplete, setWaveComplete] = useState(false);
    const opacityAnim = useRef(new Animated.Value(1)).current;
    const letterAnims = useRef(word.split('').map(() => new Animated.Value(0))).current;
    const setSplashHasFinished = useLocationStore(state => state.setSplashHasFinished);

    // Hide the native splash screen immediately so there is no duplicate
    useEffect(() => {
        import('expo-splash-screen').then(pkg => pkg.hideAsync().catch(() => {}));
    }, []);

    // Start the letter wave animation immediately on mount — no image to wait for
    useEffect(() => {
        const animations = letterAnims.map((anim, index) =>
            Animated.sequence([
                Animated.timing(anim, {
                    toValue: -15,
                    duration: 280,
                    delay: index * 80,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 280,
                    easing: Easing.bounce,
                    useNativeDriver: true,
                }),
            ])
        );

        Animated.stagger(80, animations).start(() => {
            setWaveComplete(true);
        });
    }, []);

    // Fade out as soon as BOTH the wave has finished AND app data is ready.
    // - If data loads before wave ends  → fades immediately after wave (~1.2s total)
    // - If data takes longer than wave  → fades the moment data arrives
    useEffect(() => {
        if (isAppReady && waveComplete && !isFading && !animationDone) {
            beginFadeOut();
        }
    }, [isAppReady, waveComplete]);

    const beginFadeOut = () => {
        if (isFading) return;
        setIsFading(true);
        Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            setAnimationDone(true);
            setSplashHasFinished(true);
            onReady();
        });
    };

    if (animationDone) return null;

    return (
        <Animated.View
            pointerEvents={isFading ? 'none' : 'auto'}
            style={[styles.container, { opacity: opacityAnim }]}
        >
            <View style={styles.textContainer}>
                {word.split('').map((letter, index) => (
                    <Animated.Text
                        key={index}
                        style={[
                            styles.logoText,
                            { transform: [{ translateY: letterAnims[index] }] },
                        ]}
                    >
                        {letter}
                    </Animated.Text>
                ))}
            </View>

            <Branding style={{ position: 'absolute', bottom: 60 }} withBackground={false} color="#FFFFFF" />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FF4D00',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    textContainer: {
        flexDirection: 'row',
    },
    logoText: {
        color: '#FFFFFF',
        fontSize: 44,
        fontWeight: 'bold',
        letterSpacing: -1,
        fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
    },
});
