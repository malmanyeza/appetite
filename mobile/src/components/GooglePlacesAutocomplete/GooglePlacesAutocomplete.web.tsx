import React, { forwardRef } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

const GooglePlacesAutocomplete = forwardRef((props: any, ref: any) => {
    return (
        <View style={props.styles?.container}>
            <TextInput
                ref={ref}
                style={props.styles?.textInput}
                placeholder={props.placeholder || "Search address..."}
                placeholderTextColor={props.styles?.textInput?.color || '#999'}
                onChangeText={(text) => {
                    // Basic fallback for web: allow typing but skip autocomplete to prevent crash
                }}
            />
            {/* Optional: Add a note that autocomplete is limited on web if needed */}
        </View>
    );
});

export { GooglePlacesAutocomplete };
export default GooglePlacesAutocomplete;
