import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../theme';

interface MapSkeletonProps {
    visible: boolean;
}

export const MapSkeleton: React.FC<MapSkeletonProps> = ({ visible }) => {
    const { theme, isDark } = useTheme();
    const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
    
    const { width, height } = Dimensions.get('window');
    const gridSize = 40;
    const horizontalLines = Math.ceil(height / gridSize);
    const verticalLines = Math.ceil(width / gridSize);

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    if (!visible && opacity._value === 0) return null;

    return (
        <Animated.View 
            style={[
                StyleSheet.absoluteFillObject, 
                { 
                    backgroundColor: isDark ? '#121212' : '#F5F5F7',
                    opacity,
                    zIndex: 10
                }
            ]}
            pointerEvents="none"
        >
            {/* Vertical Lines */}
            {Array.from({ length: verticalLines }).map((_, i) => (
                <View 
                    key={`v-${i}`} 
                    style={[
                        styles.line, 
                        { 
                            left: i * gridSize, 
                            width: 1, 
                            height: '100%', 
                            backgroundColor: theme.border,
                            opacity: isDark ? 0.1 : 0.3
                        }
                    ]} 
                />
            ))}
            
            {/* Horizontal Lines */}
            {Array.from({ length: horizontalLines }).map((_, i) => (
                <View 
                    key={`h-${i}`} 
                    style={[
                        styles.line, 
                        { 
                            top: i * gridSize, 
                            height: 1, 
                            width: '100%', 
                            backgroundColor: theme.border,
                            opacity: isDark ? 0.1 : 0.3
                        }
                    ]} 
                />
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    line: {
        position: 'absolute',
    }
});
