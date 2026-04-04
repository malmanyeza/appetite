import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Dimensions, Easing, View, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
    onReady: () => void;
    isAppReady: boolean;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onReady, isAppReady }) => {
    const [animationDone, setAnimationDone] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const opacityAnim = useRef(new Animated.Value(1)).current;
    
    // Split the word for wave animation
    const word = 'appetite';
    const letterAnims = useRef(word.split('').map(() => new Animated.Value(0))).current;

    useEffect(() => {
        // Start the typography wave animation
        const animations = letterAnims.map((anim, index) => {
            return Animated.sequence([
                Animated.timing(anim, {
                    toValue: -15, // Move up
                    duration: 300,
                    delay: index * 100,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0, // Move back down
                    duration: 300,
                    easing: Easing.bounce,
                    useNativeDriver: true,
                })
            ]);
        });

        Animated.stagger(100, animations).start(() => {
            // Once the wave is complete, wait for the app to be ready
            if (isAppReady) {
                beginFadeOut();
            }
        });
    }, []);

    useEffect(() => {
        if (isAppReady && !animationDone && !isFading) {
            // Give it a tiny delay to ensure the wave had time to finish or is finishing
            setTimeout(() => {
                beginFadeOut();
            }, 500);
        }
    }, [isAppReady]);

    const beginFadeOut = () => {
        if (isFading) return;
        setIsFading(true);
        Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            setAnimationDone(true);
            onReady();
        });
    };

    if (animationDone) return null;

    return (
        <Animated.View 
            pointerEvents={isFading ? "none" : "auto"}
            style={[
                styles.container, 
                { opacity: opacityAnim },
                isFading && { elevation: 0, zIndex: 0 }
            ]}
        >
            <View style={styles.textContainer}>
                {word.split('').map((letter, index) => (
                    <Animated.Text
                        key={index}
                        style={[
                            styles.logoText,
                            { transform: [{ translateY: letterAnims[index] }] }
                        ]}
                    >
                        {letter}
                    </Animated.Text>
                ))}
            </View>
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
        fontSize: 48,
        fontWeight: 'bold',
        letterSpacing: -1,
        // Platform-agnostic system font approach
        fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System'
    }
});
