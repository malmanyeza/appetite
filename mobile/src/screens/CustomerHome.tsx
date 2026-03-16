import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Platform,
    UIManager,
    LayoutAnimation,
    Modal,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ActivityIndicator,
    Alert
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Search, MapPin, ChevronRight, Filter, X, CheckCircle2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useLocationStore } from '../store/locationStore';
import { useAuthStore } from '../store/authStore';
export const CustomerHome = ({ navigation }: any) => {
    const { theme, isDark } = useTheme();
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [locationModalVisible, setLocationModalVisible] = React.useState(false);
    const [currentLocation, setCurrentLocation] = React.useState<string | null>(null);
    const [city, setCity] = React.useState('');
    const [suburb, setSuburb] = React.useState('');
    const [street, setStreet] = React.useState('');
    const [landmark, setLandmark] = React.useState('');
    const [isFetchingLocation, setIsFetchingLocation] = React.useState(false);
    const [modalLocationFetched, setModalLocationFetched] = React.useState(false);

    const { selectedLocation, setSelectedLocation } = useLocationStore();
    const { profile } = useAuthStore();
    const queryClient = useQueryClient();

    // 1. Load default address if none is selected
    useQuery({
        queryKey: ['default_address', profile?.id],
        queryFn: async () => {
            if (selectedLocation) return selectedLocation;
            
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', profile?.id)
                .eq('is_default', true)
                .single();
            
            if (data && !selectedLocation) {
                setSelectedLocation(data);
            }
            return data;
        },
        enabled: !!profile?.id && !selectedLocation
    });

    // 2. Fallback to GPS if absolutely no saved address
    React.useEffect(() => {
        if (!selectedLocation) {
            (async () => {
                try {
                    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
                        setSelectedLocation({
                            city: 'Current Location',
                            suburb: 'Detecting...',
                            lat: loc.coords.latitude,
                            lng: loc.coords.longitude
                        });
                        
                        // Try to reverse geocode for a better label
                        const [rev] = await ExpoLocation.reverseGeocodeAsync({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude
                        });
                        
                        if (rev) {
                            setSelectedLocation({
                                city: rev.city || 'Current Location',
                                suburb: rev.district || rev.subregion || 'Nearby',
                                lat: loc.coords.latitude,
                                lng: loc.coords.longitude
                            });
                        }
                    }
                } catch (err) {
                    console.warn('GPS Fallback failed:', err);
                }
            })();
        }
    }, [selectedLocation]);

    // 3. Fetch saved addresses for the modal
    const { data: savedAddresses } = useQuery({
        queryKey: ['user_addresses', profile?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', profile?.id)
                .order('is_default', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.id
    });

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const { data: restaurants, isLoading } = useQuery({
        queryKey: ['restaurants', selectedCategory, selectedLocation?.lat, selectedLocation?.lng],
        queryFn: async () => {
            if (!selectedLocation?.lat || !selectedLocation?.lng) {
                // Return empty if no location yet
                return [];
            }

            // Fetch with distance calc
            const { data, error } = await supabase.rpc('get_restaurants_with_distance', {
                u_lat: selectedLocation.lat,
                u_lng: selectedLocation.lng
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            let result = data || [];
            if (selectedCategory && result.length > 0) {
                result = result.filter((r: any) => r.categories && r.categories.includes(selectedCategory));
            }
            return result;
        }
    });

    const filteredRestaurants = React.useMemo(() => {
        if (!restaurants) return [];
        if (!searchQuery) return restaurants;
        return restaurants.filter((r: any) =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.categories.some((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [restaurants, searchQuery]);

    React.useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [filteredRestaurants, selectedCategory]);

    const tempCoords = React.useRef<{ lat: number, lng: number } | null>(null);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header / Location */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.locationLabel, { color: theme.textMuted }]}>Delivering to</Text>
                    <TouchableOpacity
                        style={styles.locationSelector}
                        onPress={() => {
                            setModalLocationFetched(false);
                            setLocationModalVisible(true);
                        }}
                    >
                        <MapPin size={16} color={theme.accent} />
                        <Text style={[styles.locationText, { color: theme.text }]}>
                            {selectedLocation ? `${selectedLocation.suburb || selectedLocation.city}` : 'Pick Location...'}
                        </Text>
                        <ChevronRight size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={[styles.profileButton, { backgroundColor: theme.surface }]}
                    onPress={() => navigation.navigate('Account')}
                >
                    <Text style={{ color: theme.text }}>👤</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
                        <Search size={20} color={theme.textMuted} style={styles.searchIcon} />
                        <TextInput
                            placeholder="Search restaurants or food..."
                            placeholderTextColor={theme.textMuted}
                            style={[styles.searchInput, { color: theme.text }]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Text style={{ color: theme.textMuted, marginRight: 8 }}>✕</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.filterButton}>
                            <Filter size={20} color={theme.accent} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Categories */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
                        {['All', 'Chicken', 'Burgers', 'Pizza', 'Traditional', 'Sushi', 'Desserts'].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryCard,
                                    { backgroundColor: theme.surface },
                                    (selectedCategory === cat || (cat === 'All' && !selectedCategory)) && { backgroundColor: theme.accent }
                                ]}
                                onPress={() => setSelectedCategory(cat === 'All' ? null : cat)}
                            >
                                <Text style={[
                                    styles.categoryText,
                                    { color: (selectedCategory === cat || (cat === 'All' && !selectedCategory)) ? '#FFF' : theme.text }
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Popular Nearby */}
                <View style={[styles.row, { paddingHorizontal: 20, marginBottom: 16 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 0, marginBottom: 0 }]}>
                        {selectedCategory ? `${selectedCategory} near you` : 'Popular Nearby'}
                    </Text>
                    <TouchableOpacity onPress={() => { setSelectedCategory(null); setSearchQuery(''); }}><Text style={{ color: theme.accent }}>View all</Text></TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={{ height: 200, justifyContent: 'center' }}>
                        <Text style={{ color: theme.textMuted, textAlign: 'center' }}>Finding restaurants...</Text>
                    </View>
                ) : filteredRestaurants.length === 0 ? (
                    <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: theme.textMuted }}>No results found.</Text>
                    </View>
                ) : (
                    filteredRestaurants.map((item: any) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.restaurantCard, { backgroundColor: theme.surface }]}
                            onPress={() => navigation.navigate('RestaurantDetails', { id: item.id })}
                        >
                            <Image
                                source={item.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                                style={styles.restaurantImage}
                                contentFit="cover"
                            />
                            <View style={styles.restaurantDetails}>
                                <View style={styles.row}>
                                    <Text style={[styles.restaurantName, { color: theme.text }]}>{item.name}</Text>
                                    <Text style={[styles.rating, { color: theme.text }]}>⭐ {item.rating_avg != null ? Number(item.rating_avg).toFixed(1) : 'New'}</Text>
                                </View>
                                <Text style={[styles.categories, { color: theme.textMuted }]}>{item.categories ? item.categories.join(' • ') : 'Food & Drink'}</Text>
                                <View style={styles.deliveryInfo}>
                                    <Text style={[styles.infoText, { color: theme.textMuted }]}>
                                        {item.distance_km != null ? `${Number(item.distance_km).toFixed(1)} km • ` : ''}Delivery
                                    </Text>
                                    <Text style={[styles.infoText, { color: theme.textMuted }]}>
                                        {item.avg_prep_time || '20-30 min'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            <Modal
                visible={locationModalVisible}
                animationType="slide"
                transparent={false}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, backgroundColor: theme.background }}
                >
                    <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>Delivery Location</Text>
                            <TouchableOpacity onPress={() => setLocationModalVisible(false)} style={{ padding: 8 }}>
                                <X size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 16, color: theme.textMuted, marginBottom: 24 }}>
                            Enter your precise address or suburb for delivery
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 16, paddingBottom: 100 }}>
                                {savedAddresses && savedAddresses.length > 0 && (
                                    <View style={{ marginBottom: 24 }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>Your Saved Locations</Text>
                                        {savedAddresses.map((addr: any) => (
                                            <TouchableOpacity 
                                                key={addr.id}
                                                style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    padding: 16, 
                                                    backgroundColor: theme.surface, 
                                                    borderRadius: 16, 
                                                    marginBottom: 8,
                                                    borderWidth: selectedLocation?.id === addr.id ? 1 : 0,
                                                    borderColor: theme.accent
                                                }}
                                                onPress={() => {
                                                    setSelectedLocation(addr);
                                                    setLocationModalVisible(false);
                                                }}
                                            >
                                                <MapPin size={18} color={theme.accent} />
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text style={{ color: theme.text, fontWeight: 'bold' }}>{addr.label}</Text>
                                                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>{addr.street ? `${addr.street}, ` : ''}{addr.suburb}</Text>
                                                </View>
                                                {selectedLocation?.id === addr.id && <CheckCircle2 size={16} color={theme.accent} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>Or Enter New Location</Text>
                                <TextInput
                                    placeholder="City (e.g., Harare)"
                                    placeholderTextColor={theme.textMuted}
                                    style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 16, padding: 16, fontSize: 16 }}
                                    value={city}
                                    onChangeText={setCity}
                                />
                                <TextInput
                                    placeholder="Suburb (e.g. Avondale, CBD)"
                                    placeholderTextColor={theme.textMuted}
                                    style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 16, padding: 16, fontSize: 16 }}
                                    value={suburb}
                                    onChangeText={setSuburb}
                                />
                                <TextInput
                                    placeholder="Street Name (Optional)"
                                    placeholderTextColor={theme.textMuted}
                                    style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 16, padding: 16, fontSize: 16 }}
                                    value={street}
                                    onChangeText={setStreet}
                                />
                                <TextInput
                                    placeholder="Landmark Notes (Optional: Blue gate, Near shop...)"
                                    placeholderTextColor={theme.textMuted}
                                    style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 16, padding: 16, fontSize: 16, minHeight: 100 }}
                                    value={landmark}
                                    onChangeText={setLandmark}
                                    multiline
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: modalLocationFetched ? '#10B981' : theme.accent, borderRadius: 16, justifyContent: 'center', gap: 8, marginTop: 16 }}
                                    onPress={async () => {
                                        setIsFetchingLocation(true);
                                        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                                        if (status === 'granted') {
                                            const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
                                            setModalLocationFetched(true);
                                            tempCoords.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
                                        } else {
                                            Alert.alert('Permission Denied', 'Location permission is required.');
                                        }
                                        setIsFetchingLocation(false);
                                    }}
                                    disabled={isFetchingLocation || modalLocationFetched}
                                >
                                    {isFetchingLocation ? (
                                        <ActivityIndicator size="small" color={theme.accent} />
                                    ) : modalLocationFetched ? (
                                        <CheckCircle2 size={20} color="#10B981" />
                                    ) : (
                                        <MapPin size={20} color={theme.accent} />
                                    )}
                                    <Text style={{ color: modalLocationFetched ? '#10B981' : theme.accent, fontWeight: 'bold' }}>
                                        {isFetchingLocation ? 'Acquiring GPS...' : modalLocationFetched ? 'GPS Pin Captured' : 'Use Current Location (GPS)'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ backgroundColor: theme.accent, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 }}
                                    onPress={() => {
                                        if (!modalLocationFetched || !tempCoords.current) {
                                            Alert.alert('Location Required', 'Please tap "Use Current Location (GPS)" to confirm your exact delivery coordinates.');
                                            return;
                                        }
                                        if (!city.trim() || !suburb.trim()) {
                                            Alert.alert('Missing Info', 'Please enter at least the City and Suburb.');
                                            return;
                                        }
                                        
                                        setSelectedLocation({
                                            city: city.trim(),
                                            suburb: suburb.trim(),
                                            street: street.trim(),
                                            landmark_notes: landmark.trim(),
                                            lat: tempCoords.current.lat,
                                            lng: tempCoords.current.lng
                                        });
                                        setLocationModalVisible(false);
                                    }}
                                >
                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Confirm New Location</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    locationLabel: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    locationSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    locationText: { fontSize: 16, fontWeight: 'bold' },
    profileButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { paddingHorizontal: 20, marginBottom: 24 },
    searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderRadius: 16 },
    searchIcon: { marginRight: 12 },
    searchInput: { flex: 1, fontSize: 16 },
    filterButton: { marginLeft: 12 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 16 },
    categoriesContainer: { paddingHorizontal: 20, gap: 12 },
    categoryCard: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    categoryText: { fontWeight: '600' },
    restaurantCard: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
    restaurantImage: { width: '100%', height: 180 },
    restaurantDetails: { padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    restaurantName: { fontSize: 18, fontWeight: 'bold' },
    rating: { fontSize: 14, fontWeight: 'bold' },
    categories: { fontSize: 13, marginTop: 4 },
    deliveryInfo: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    infoText: { fontSize: 12 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalSubtitle: { fontSize: 14, marginBottom: 24 },
    locationInput: { borderRadius: 16, padding: 16, height: 56, fontSize: 16, marginBottom: 24 },
    saveLocationBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveLocationBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
