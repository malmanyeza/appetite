import React, { useState } from 'react';
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
    Platform
} from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2, Home, Briefcase, MapIcon, ChevronLeft, CheckCircle2 } from 'lucide-react-native';

export const AddressManagementScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const { user } = useAuthStore();
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
    const [showCityPicker, setShowCityPicker] = useState(false);

    const cities = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Kwekwe', 'Chitungwiza'];

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
        try {
            // Check if expo-location is available
            const Location = require('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for this bonus feature.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            setCoords({
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
            Alert.alert('GPS Pin Saved', 'Accuracy pin added. Please still verify your Suburb and Landmark notes!');
        } catch (error) {
            console.warn('GPS logic failed, possible missing dependencies:', error);
            Alert.alert('Location Feature', 'GPS accuracy is a bonus! Please ensure your Suburb and Landmarks are accurate first.');
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
        if (!suburb.trim() || !landmark.trim()) {
            Alert.alert('Required Fields', 'Suburb and Landmark Notes are required for successful delivery in Zimbabwe.');
            return;
        }
        if (!coords?.lat || !coords?.lng) {
            Alert.alert('Location Required', 'You must tap "Use Current Location (GPS)" to drop a precise pin for this address before saving.');
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
                    {item.lat && (
                        <Text style={[styles.landmark, { color: '#10B981', fontSize: 10 }]}>
                            📍 GPS Pin Saved
                        </Text>
                    )}
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

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={[styles.modalContent, { backgroundColor: theme.background }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>New Address</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={{ color: theme.accent, fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.form}>
                            <Text style={[styles.inputLabel, { color: theme.text }]}>Label</Text>
                            <View style={styles.labelPicker}>
                                {['Home', 'Work', 'Other'].map(l => (
                                    <TouchableOpacity
                                        key={l}
                                        style={[
                                            styles.labelChip,
                                            { backgroundColor: theme.surface },
                                            label === l && { borderColor: theme.accent, borderWidth: 1 }
                                        ]}
                                        onPress={() => setLabel(l)}
                                    >
                                        <Text style={{ color: label === l ? theme.accent : theme.text }}>{l}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.input, { backgroundColor: theme.surface, justifyContent: 'center' }]}
                                onPress={() => setShowCityPicker(true)}
                            >
                                <Text style={{ color: theme.text }}>City: {city}</Text>
                            </TouchableOpacity>

                            <TextInput
                                placeholder="Suburb (e.g. Avondale, CBD)"
                                placeholderTextColor={theme.textMuted}
                                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                                value={suburb}
                                onChangeText={setSuburb}
                            />
                            <TextInput
                                placeholder="Street Name (Optional)"
                                placeholderTextColor={theme.textMuted}
                                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                                value={street}
                                onChangeText={setStreet}
                            />
                            <TextInput
                                placeholder="Landmark Notes (Required: Blue gate, Near shop...)"
                                placeholderTextColor={theme.textMuted}
                                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                                value={landmark}
                                onChangeText={setLandmark}
                                multiline
                            />

                            <TouchableOpacity
                                style={[styles.gpsButton, { borderColor: theme.accent }]}
                                onPress={handleUseCurrentLocation}
                            >
                                <MapPin size={20} color={theme.accent} />
                                <Text style={{ color: theme.accent, fontWeight: 'bold' }}>Use Current Location (GPS)</Text>
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

                        {/* City Picker Modal */}
                        <Modal visible={showCityPicker} transparent animationType="fade">
                            <View style={styles.modalOverlay}>
                                <View style={[styles.cityPickerContent, { backgroundColor: theme.background }]}>
                                    <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 16 }]}>Select City</Text>
                                    {cities.map(c => (
                                        <TouchableOpacity
                                            key={c}
                                            style={styles.cityOption}
                                            onPress={() => { setCity(c); setShowCityPicker(false); }}
                                        >
                                            <Text style={{ color: theme.text, fontSize: 16 }}>{c}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity onPress={() => setShowCityPicker(false)} style={{ marginTop: 16 }}>
                                        <Text style={{ color: theme.accent, textAlign: 'center' }}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </KeyboardAvoidingView>
                </View>
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    form: { gap: 16 },
    inputLabel: { fontSize: 14, fontWeight: '600' },
    labelPicker: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    input: { height: 56, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
    checkboxLabel: { fontSize: 15 },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderRadius: 12,
        marginTop: 8
    },
    cityPickerContent: { width: '80%', padding: 24, borderRadius: 24 },
    cityOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    saveButton: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
