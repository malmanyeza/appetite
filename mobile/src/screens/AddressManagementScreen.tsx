import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    TextInput,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Animated
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { MapSkeleton } from '../components/MapSkeleton';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';
import { useTheme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2, Home, Briefcase, MapIcon, ChevronLeft, CheckCircle2, X } from 'lucide-react-native';
import { reverseGeocodeGoogle } from '../services/geocodingService';

export const AddressManagementScreen = ({ navigation }: any) => {
    const { theme, isDark } = useTheme();
    const { user } = useAuthStore();
    const { profile } = useAuthStore();
    const queryClient = useQueryClient();
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [label, setLabel] = useState('Home');
    const [city, setCity] = useState('Harare');
    const [suburb, setSuburb] = useState('');
    const [street, setStreet] = useState('');
    const [landmark, setLandmark] = useState('');
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [isDefault, setIsDefault] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [isGpsButtonLoading, setIsGpsButtonLoading] = useState(false);
    const [isGpsCaptured, setIsGpsCaptured] = useState(false);
    
    const mapRef = useRef<MapView | null>(null);
    const googlePlacesRef = useRef<any>(null);
    const modalY = useRef(new Animated.Value(0)).current;
    
    const [mapRegion, setMapRegion] = useState<any>({
        latitude: -17.8248, // Harare
        longitude: 31.0530,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [isMapReady, setIsMapReady] = useState(false);
    const [isModalDown, setIsModalDown] = useState(false);
    const pinAnim = useRef(new Animated.Value(0)).current;
    const isProgrammaticChange = useRef(false);
    const gpsRequestCounter = useRef(0);

    const animateModal = (toValue: number) => {
        Animated.timing(modalY, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

    const { data: addresses, isLoading } = useQuery({
        queryKey: ['addresses', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', user?.id)
                .order('is_default', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    const addAddressMutation = useMutation({
        mutationFn: async (newAddress: any) => {
            if (newAddress.is_default) {
                await supabase.from('addresses').update({ is_default: false }).eq('user_id', user?.id);
            }
            const { error } = await supabase.from('addresses').insert({
                ...newAddress,
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['addresses'] });
            setModalVisible(false);
            resetForm();
        },
        onError: (error: any) => Alert.alert('Error', error.message)
    });

    const deleteAddressMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('addresses').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
        onError: (error: any) => Alert.alert('Error', error.message)
    });

    const handleUseCurrentLocation = async () => {
        const currentRequestId = ++gpsRequestCounter.current;
        isProgrammaticChange.current = true;
        setIsGpsButtonLoading(true);
        try {
            setIsFetchingLocation(true);
            const ExpoLocation = require('expo-location');
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required.');
                setIsGpsButtonLoading(false);
                setIsFetchingLocation(false);
                return;
            }

            // 1. Fast initial jump
            const lastKnown = await ExpoLocation.getLastKnownPositionAsync();
            if (currentRequestId !== gpsRequestCounter.current) return;

            if (lastKnown) {
                const region = {
                    latitude: lastKnown.coords.latitude,
                    longitude: lastKnown.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                };
                isProgrammaticChange.current = true;
                mapRef.current?.animateToRegion(region, 100);

                const rev = await reverseGeocodeGoogle(lastKnown.coords.latitude, lastKnown.coords.longitude);
                if (rev) {
                    setCity(rev.city || 'Harare');
                    setSuburb(rev.suburb || 'Nearby');
                    setStreet(rev.physical_address || '');
                    setCoords({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
                    setIsGpsCaptured(true);
                    // Clear button loading early once we have a fix
                    setIsGpsButtonLoading(false);
                }
            }

            const location = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Highest });
            if (currentRequestId !== gpsRequestCounter.current) return;

            const newCoords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };
            setCoords(newCoords);
            
            // 2. Animate immediately once accurate coordinates are in
            const region = {
                latitude: newCoords.lat,
                longitude: newCoords.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            isProgrammaticChange.current = true;
            mapRef.current?.animateToRegion(region, 300);

            // 3. Geocode in the background
            const rev = await reverseGeocodeGoogle(newCoords.lat, newCoords.lng);
            if (rev) {
                setCity(rev.city || 'Harare');
                setSuburb(rev.suburb || 'Nearby');
                setStreet(rev.physical_address || '');
            }

            setIsGpsCaptured(true);
            setIsFetchingLocation(false);
            setIsGpsButtonLoading(false);
        } catch (error) {
            console.warn('GPS logic failed:', error);
            setIsFetchingLocation(false);
            setIsGpsButtonLoading(false);
            Alert.alert('Location Error', 'Could not access GPS. Please ensure location services are enabled.');
        }
    };

    const resetForm = () => {
        setLabel('Home');
        setCity('Harare');
        setSuburb('');
        setStreet('');
        setLandmark('');
        setCoords(null);
        setIsDefault(false);
    };

    const handleAddAddress = () => {
        if (!coords?.lat || !coords?.lng) {
            Alert.alert('Location Required', 'Please search for an address or use GPS to pick a location on the map.');
            return;
        }
        addAddressMutation.mutate({
            label,
            city,
            suburb: suburb.trim(),
            street: street.trim(),
            landmark_notes: landmark.trim(),
            lat: coords?.lat,
            lng: coords?.lng,
            is_default: isDefault
        });
    };

    const confirmDelete = (id: string) => {
        Alert.alert('Delete Address', 'Are you sure you want to remove this address?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteAddressMutation.mutate(id) }
        ]);
    };

    const renderAddressItem = ({ item }: any) => {
        const Icon = item.label === 'Home' ? Home : item.label === 'Work' ? Briefcase : MapIcon;
        return (
            <View style={[styles.addressCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.iconBox, { backgroundColor: `${theme.accent}15` }]}>
                    <Icon size={20} color={theme.accent} />
                </View>
                <View style={styles.addressInfo}>
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.text }]}>{item.label}</Text>
                        {item.is_default && (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultText}>Default</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.addressText, { color: theme.text, fontWeight: 'bold' }]}>
                        {item.suburb}, {item.landmark_notes}
                    </Text>
                    <Text style={[styles.landmark, { color: theme.textMuted }]}>
                        {item.street ? `${item.street}, ` : ''}{item.city}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(item.id)}>
                    <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ChevronLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Address Book</Text>
                <View style={{ width: 24 }} />
            </View>

            {isLoading ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={addresses}
                    renderItem={renderAddressItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MapPin size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No addresses saved yet</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.accent }]}
                onPress={() => setModalVisible(true)}
            >
                <Plus color="white" size={24} />
                <Text style={styles.addButtonText}>Add New Address</Text>
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent={false}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1, backgroundColor: theme.background }}>
                        <MapSkeleton visible={!isMapReady} />
                        {/* Full Screen Map */}
                        <MapView
                            ref={mapRef}
                            provider={PROVIDER_GOOGLE}
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={mapRegion}
                            mapPadding={{ top: 0, right: 0, left: 0, bottom: Dimensions.get('window').height * 0.4 }}
                            customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                            onMapReady={() => setIsMapReady(true)}
                            onPress={() => {
                                Keyboard.dismiss();
                                if (isModalDown) {
                                    animateModal(0);
                                    setIsModalDown(false);
                                } else {
                                    animateModal(Dimensions.get('window').height * 0.7);
                                    setIsModalDown(true);
                                }
                            }}
                            onRegionChangeStart={() => {
                                Keyboard.dismiss();
                                // Only raise pin for manual gestures, not automated ones
                                if (!isProgrammaticChange.current) {
                                    Animated.spring(pinAnim, { toValue: -15, useNativeDriver: true }).start();
                                    // Manual gesture cancels any pending programmatic GPS snaps
                                    gpsRequestCounter.current += 1;
                                }
                                setIsGpsCaptured(false);
                                setCity('Locating...');
                                setSuburb('');
                                setStreet('');
                                animateModal(Dimensions.get('window').height * 0.7);
                                if (!isProgrammaticChange.current) {
                                    setIsModalDown(true);
                                }
                            }}
                            onRegionChangeComplete={async (region) => {
                                if (isProgrammaticChange.current) {
                                    isProgrammaticChange.current = false;
                                    Animated.spring(pinAnim, { toValue: 0, useNativeDriver: true }).start();
                                    animateModal(0);
                                    setIsModalDown(false);
                                    return;
                                }

                                // Reset the flag
                                isProgrammaticChange.current = false;
                                Animated.spring(pinAnim, { toValue: 0, useNativeDriver: true }).start();
                                animateModal(0);
                                setIsModalDown(false);
                                
                                setCoords({ lat: region.latitude, lng: region.longitude });
                                try {
                                    const rev = await reverseGeocodeGoogle(region.latitude, region.longitude);
                                    if (rev) {
                                        setCity(rev.city || 'Harare');
                                        setSuburb(rev.suburb || 'Nearby');
                                        setStreet(rev.physical_address || '');
                                    } else {
                                        setCity('Harare');
                                        setSuburb('Nearby');
                                    }
                                } catch (error) {
                                    setCity('Harare');
                                    setSuburb('Nearby');
                                    console.warn("Drag Pin Geocode Error:", error);
                                }
                            }}
                        >
                            {/* Marker removed in favor of center pin */}
                        </MapView>

                        <View style={styles.fixedPinContainer} pointerEvents="none">
                            {/* Glowing Target Dot - Appears when map is dragged */}
                            <Animated.View style={[
                                styles.glowingDot,
                                {
                                    opacity: pinAnim.interpolate({ inputRange: [-15, 0], outputRange: [1, 0] }),
                                    transform: [{ scale: pinAnim.interpolate({ inputRange: [-15, 0], outputRange: [1.5, 0.5] }) }]
                                }
                            ]} />

                            <Animated.View style={{ transform: [{ translateY: pinAnim }] }}>
                                <View style={styles.destinationMarker}>
                                    <View style={styles.destinationMarkerInner} />
                                </View>
                            </Animated.View>
                            <Animated.View style={[
                                styles.pinShadow, 
                                { 
                                    opacity: pinAnim.interpolate({ inputRange: [-15, 0], outputRange: [0.3, 1] }),
                                    transform: [{ scale: pinAnim.interpolate({ inputRange: [-15, 0], outputRange: [0.5, 1] }) }]
                                }
                            ]} />
                        </View>

                        <View style={styles.modalHeaderButtons}>
                            <TouchableOpacity 
                                onPress={() => setModalVisible(false)}
                                style={[styles.backCircle, { backgroundColor: theme.surface }]}
                            >
                                <X color={theme.text} size={24} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <GooglePlacesAutocomplete
                                    ref={googlePlacesRef}
                                    placeholder="Search address..."
                                    fetchDetails={true}
                                    enablePoweredByContainer={false}
                                    onPress={(data, details = null) => {
                                        if (details) {
                                            const newCoords = {
                                                lat: details.geometry.location.lat,
                                                lng: details.geometry.location.lng,
                                            };
                                            setCoords(newCoords);
                                            setCity(details.address_components.find(c => c.types.includes('locality'))?.long_name || 'Harare');
                                            setSuburb(data.structured_formatting.main_text);
                                            setStreet(details.address_components.find(c => c.types.includes('route'))?.long_name || '');
                                            
                                            googlePlacesRef.current?.setAddressText(data.description);
                                            googlePlacesRef.current?.blur();
                                            Keyboard.dismiss();

                                            const region = {
                                                latitude: newCoords.lat,
                                                longitude: newCoords.lng,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            };
                                            isProgrammaticChange.current = true;
                                            setMapRegion(region);
                                            mapRef.current?.animateToRegion(region, 500);
                                        }
                                    }}
                                    query={{
                                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                                        language: 'en',
                                        components: 'country:zw',
                                        types: 'establishment|geocode',
                                        location: `${mapRegion.latitude},${mapRegion.longitude}`,
                                        radius: 5000
                                    }}
                                    styles={{
                                        container: { flex: 0 },
                                        textInput: {
                                            height: 48,
                                            backgroundColor: theme.surface,
                                            color: theme.text,
                                            borderRadius: 24,
                                            paddingLeft: 20,
                                            fontSize: 14,
                                            elevation: 5,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 4
                                        },
                                        listView: {
                                            backgroundColor: theme.background,
                                            borderRadius: 12,
                                            marginTop: 8,
                                            elevation: 10,
                                            zIndex: 3000
                                        },
                                        row: { backgroundColor: theme.background, padding: 13, height: 48, flexDirection: 'row' },
                                        description: { color: theme.text }
                                    }}
                                />
                            </View>
                        </View>

                        <Animated.View
                            style={[
                                styles.modalContent, 
                                { 
                                    backgroundColor: theme.background,
                                    transform: [{ translateY: modalY }],
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: Dimensions.get('window').height * 0.65
                                }
                            ]}
                        >
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={{ flex: 1 }}
                            >
                                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    <View style={styles.form}>
                                        <View style={styles.formHeader}>
                                            <Text style={[styles.modalTitle, { color: theme.text }]}>New Address</Text>
                                            <Text style={{ color: theme.textMuted }}>Pick a spot and add details</Text>
                                        </View>

                                        <View>
                                            <Text style={[styles.inputLabel, { color: theme.text }]}>Label</Text>
                                            <View style={styles.labelPicker}>
                                                {['Home', 'Work', 'Other'].map(l => (
                                                    <TouchableOpacity
                                                        key={l}
                                                        style={[
                                                            styles.labelChip,
                                                            { backgroundColor: theme.surface },
                                                            label === l && { borderColor: theme.accent, borderWidth: 2 }
                                                        ]}
                                                        onPress={() => setLabel(l)}
                                                    >
                                                        <Text style={{ color: label === l ? theme.accent : theme.text, fontWeight: label === l ? 'bold' : 'normal' }}>{l}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        <View style={{ gap: 4 }}>
                                            <Text style={[styles.inputLabel, { color: theme.text }]}>Selected Location</Text>
                                            <View style={[styles.input, { backgroundColor: theme.surface, justifyContent: 'center' }]}>
                                                <Text style={{ color: theme.text }} numberOfLines={1}>
                                                    {suburb ? `${city}, ${suburb}` : city}
                                                </Text>
                                            </View>
                                        </View>

                                        <TextInput
                                            placeholder="House Number / Notes (Optional)"
                                            placeholderTextColor={theme.textMuted}
                                            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                                            value={street}
                                            onChangeText={setStreet}
                                        />

                                        <TouchableOpacity
                                            style={[styles.gpsButton, { borderColor: isGpsCaptured ? '#10B981' : theme.accent, backgroundColor: isGpsCaptured ? '#10B98110' : 'transparent' }]}
                                            onPress={handleUseCurrentLocation}
                                            disabled={isGpsButtonLoading}
                                        >
                                            {isGpsButtonLoading ? (
                                                <ActivityIndicator size="small" color={theme.accent} />
                                            ) : isGpsCaptured ? (
                                                <CheckCircle2 size={20} color="#10B981" />
                                            ) : (
                                                <MapPin size={20} color={theme.accent} />
                                            )}
                                            <Text style={{ color: isGpsCaptured ? '#10B981' : theme.accent, fontWeight: 'bold' }}>
                                                {isGpsButtonLoading ? 'Acquiring GPS...' : isGpsCaptured ? 'GPS Captured' : 'Use Current GPS'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.checkboxRow}
                                            onPress={() => setIsDefault(!isDefault)}
                                        >
                                            <View style={[styles.checkbox, isDefault && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                                                {isDefault && <CheckCircle2 size={16} color="white" />}
                                            </View>
                                            <Text style={[styles.checkboxLabel, { color: theme.text }]}>Set as Default address</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.saveButton, { backgroundColor: theme.accent }]}
                                            onPress={handleAddAddress}
                                            disabled={addAddressMutation.isPending}
                                        >
                                            {addAddressMutation.isPending ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <Text style={styles.saveButtonText}>Save Address</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    list: { padding: 20, gap: 16 },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        gap: 16
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addressInfo: { flex: 1 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    label: { fontSize: 16, fontWeight: 'bold' },
    defaultBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    defaultText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    addressText: { fontSize: 14, lineHeight: 20 },
    landmark: { fontSize: 12, marginTop: 4 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, marginTop: 16 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        margin: 20,
        height: 56,
        borderRadius: 16,
        marginBottom: 40
    },
    addButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    modalContent: { 
        flex: 1, 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        marginTop: -30, 
        padding: 24,
    },
    modalHeaderButtons: { 
        position: 'absolute', 
        top: 50, 
        left: 20, 
        right: 20, 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 12 
    },
    formHeader: { marginBottom: 24, gap: 4 },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    form: { gap: 16, paddingBottom: 40 },
    inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    labelPicker: { flexDirection: 'row', gap: 12 },
    labelChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
    input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 16 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
    checkboxLabel: { fontSize: 15 },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 14,
        borderWidth: 1.5,
        borderRadius: 16,
        marginTop: 4
    },
    saveButton: { height: 58, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    backCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    destinationMarker: {
        width: 30,
        height: 30,
        backgroundColor: '#ef4444',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 15,
        transform: [{ rotate: '45deg' }],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    destinationMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFF',
        transform: [{ rotate: '-45deg' }],
    },
    fixedPinContainer: {
        position: 'absolute',
        top: Dimensions.get('window').height * 0.3 - 38,
        left: '50%',
        marginLeft: -15,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 5
    },
    pinShadow: {
        width: 12,
        height: 6,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        marginTop: 4,
    },
    glowingDot: {
        position: 'absolute',
        bottom: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.4)',
        borderWidth: 2,
        borderColor: '#ef4444',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 8,
    }
});
