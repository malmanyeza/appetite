import React from 'react';
import { View, Text } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export const Marker = ({ children }: any) => <View>{children}</View>;
export const Polyline = () => null;
export const Callout = ({ children }: any) => <View>{children}</View>;
export const Circle = () => null;
export const Polygon = () => null;

const MapView = ({ style, children }: any) => (
    <View style={[style, { backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Map View (Not available on Web)</Text>
    </View>
);

export default MapView;
