import React, { useEffect } from 'react';
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
    Alert,
    Dimensions,
    Animated,
    RefreshControl
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';
import * as ExpoLocation from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { restaurantService } from '../services/restaurantService';
import { Search, MapPin, Clock, Filter, ChevronRight, Star, Heart, Truck, ShoppingBag, Map as MapIcon, X, CheckCircle2, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useLocationStore } from '../store/locationStore';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
export const CustomerHome = () => {
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();
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
    const [mapRegion, setMapRegion] = React.useState<any>(null);
    // Live GPS position — used for distance calculations (separate from delivery address)
    const [gpsLocation, setGpsLocation] = React.useState<{ lat: number; lng: number } | null>(null);
    const mapRef = React.useRef<MapView | null>(null);
    const googlePlacesRef = React.useRef<any>(null);
    const modalY = React.useRef(new Animated.Value(0)).current;
    const scrollY = React.useRef(new Animated.Value(0)).current;
    const [hasAutoPrompted, setHasAutoPrompted] = React.useState(false);
    const modalEntryAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;
    
    // 5. Done Button Animation & State
    const [isLocationSelected, setIsLocationSelected] = React.useState(false);
    const [isAutoTrigger, setIsAutoTrigger] = React.useState(false);
    const doneButtonAnim = React.useRef(new Animated.Value(120)).current;

    const showDoneButton = () => {
        setHasAutoPrompted(true); // LOCK immediately to prevent any re-popups during selection
        setIsLocationSelected(true);
        Animated.spring(doneButtonAnim, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        }).start();
    };

    const closeLocationModal = () => {
        setHasAutoPrompted(true);
        setIsLocationSelected(false);
        setIsAutoTrigger(false); // Reset to ensure next manual opening is fast
        doneButtonAnim.setValue(120); // Reset for next time
        Animated.timing(modalEntryAnim, {
            toValue: Dimensions.get('window').height,
            duration: 800, // Balanced responsive close
            easing: (t) => Math.pow(t, 4), // Smooth acceleration mirror
            useNativeDriver: true,
        }).start(() => {
            setLocationModalVisible(false);
        });
    };

    const animateModal = (toValue: number) => {
        Animated.timing(modalY, {
            toValue,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

    // Sync map region when selected location changes
    React.useEffect(() => {
        if (selectedLocation?.lat && selectedLocation?.lng) {
            const region = {
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setMapRegion(region);
            mapRef.current?.animateToRegion(region, 500);
        }
    }, [selectedLocation]);

    // Get live GPS for distance accuracy (independently of the delivery address)
    React.useEffect(() => {
        (async () => {
            try {
                const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
                    setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                }
            } catch (err) {
                console.warn('[Home] GPS for distance failed:', err);
            }
        })();
    }, []);

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

    const { data: restaurants, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['restaurants', selectedCategory, selectedLocation?.lat, selectedLocation?.lng],
        queryFn: async () => {
            // Use the active selected location (GPS or searched) as the single source of truth
            const coordLat = selectedLocation?.lat;
            const coordLng = selectedLocation?.lng;

            if (!coordLat || !coordLng) return [];

            const { data, error } = await supabase.rpc('get_restaurants_with_distance', {
                u_lat: coordLat,
                u_lng: coordLng
            });

            if (error) {
                console.error('RPC Error:', error);
                throw error;
            }

            let result = data || [];
            if (selectedCategory && result.length > 0) {
                result = result.filter((r: any) => r.categories && r.categories.includes(selectedCategory));
            }
            return result;
        }
    });

    // 4. Auto-trigger modal after restaurants load (One-time)
    React.useEffect(() => {
        // Only trigger if restaurants are loaded and we haven't prompted yet
        if (!hasAutoPrompted && !isLoading && restaurants && restaurants.length > 0) {
            const timer = setTimeout(() => {
                setIsAutoTrigger(true); // Auto trigger uses slow animation
                setLocationModalVisible(true);
                setHasAutoPrompted(true);
            }, 800); // Slight delay after restaurants appear
            return () => clearTimeout(timer);
        }
    }, [isLoading, restaurants, hasAutoPrompted]);

    // 5. Modal Animation Control -- Monitors visibility changes (Auto or Manual)
    React.useEffect(() => {
        if (locationModalVisible) {
            // Ensure map points to relevant context before showing
            if (gpsLocation && !selectedLocation) {
                const region = {
                    latitude: gpsLocation.lat,
                    longitude: gpsLocation.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                setMapRegion(region);
                mapRef.current?.animateToRegion(region, 500);
            }

            // Super smooth decelerating animation
            // Speed logic: Auto-start is slow (2.5s), Manual is snappy (400ms)
            modalEntryAnim.stopAnimation((value) => {
                const targetDuration = isAutoTrigger ? 2500 : 400;
                if (value > 0) {
                    Animated.timing(modalEntryAnim, {
                        toValue: 0,
                        duration: targetDuration,
                        easing: isAutoTrigger ? (t) => 1 - Math.pow(1 - t, 6) : (t) => 1 - Math.pow(1 - t, 3), 
                        useNativeDriver: true,
                    }).start();
                }
            });
        } else {
            // Ensure off-screen when hidden
            modalEntryAnim.setValue(Dimensions.get('window').height);
        }
    }, [locationModalVisible, modalEntryAnim, isAutoTrigger]);

    const prefetchRestaurant = async (locationId: string, restaurantId: string) => {
        if (!locationId || !restaurantId) return;
        
        // Prefetch location details
        queryClient.prefetchQuery({
            queryKey: ['location', locationId],
            queryFn: () => restaurantService.getLocationDetails(locationId),
            staleTime: 1000 * 60 * 10, // 10 minutes
        });

        // Prefetch restaurant info
        queryClient.prefetchQuery({
            queryKey: ['restaurant', restaurantId],
            queryFn: () => restaurantService.getRestaurantInfo(restaurantId),
            staleTime: 1000 * 60 * 10,
        });

        // Prefetch menu
        queryClient.prefetchQuery({
            queryKey: ['menu', restaurantId, locationId],
            queryFn: () => restaurantService.getBranchMenu(restaurantId, locationId),
            staleTime: 1000 * 60 * 5, // 5 minutes
        });
    };

    // Auto-prefetch top 5 restaurants on load
    useEffect(() => {
        if (restaurants && restaurants.length > 0) {
            restaurants.slice(0, 5).forEach((r: any) => {
                prefetchRestaurant(r.id, r.restaurant_id);
            });
        }
    }, [restaurants]);

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

    const stickyOpacity = scrollY.interpolate({
        inputRange: [120, 240],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const stickyTranslateY = scrollY.interpolate({
        inputRange: [120, 240],
        outputRange: [-30, 0],
        extrapolate: 'clamp',
    });

    const stickyScale = scrollY.interpolate({
        inputRange: [120, 240],
        outputRange: [0.95, 1],
        extrapolate: 'clamp',
    });

    const renderSearchBar = (isSticky = false) => (
        <View style={[
            styles.searchBar,
            { backgroundColor: theme.surface },
            isSticky && { 
                height: 50, 
                borderRadius: 25, 
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 10
            }
        ]}>
            <Search size={isSticky ? 18 : 20} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
                placeholder="Search restaurants or food..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }, isSticky && { fontSize: 14 }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={{ color: theme.textMuted, marginRight: 8 }}>✕</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.filterButton}>
                <Filter size={isSticky ? 18 : 20} color={theme.accent} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Sticky Search Bar Overlay */}
            <Animated.View 
                pointerEvents="box-none"
                style={[
                    styles.stickyHeader, 
                    { 
                        backgroundColor: 'transparent', // Container is transparent
                        opacity: stickyOpacity,
                        transform: [
                            { translateY: stickyTranslateY },
                            { scale: stickyScale }
                        ],
                        zIndex: 100,
                    }
                ]}
            >
                <View style={[
                    styles.stickyInner, 
                    { 
                        backgroundColor: theme.background,
                        borderBottomColor: theme.surface,
                        borderBottomWidth: StyleSheet.hairlineWidth
                    }
                ]}>
                    {renderSearchBar(true)}
                </View>
            </Animated.View>

            {/* Header / Location */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.locationLabel, { color: theme.textMuted }]}>Delivering to</Text>
                    <TouchableOpacity
                        style={styles.locationSelector}
                        onPress={() => {
                            setIsAutoTrigger(false); // Manual trigger uses snappy animation
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

            <Animated.ScrollView 
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={theme.accent}
                    />
                }
            >
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    {renderSearchBar()}
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
                            onPressIn={() => prefetchRestaurant(item.id, item.restaurant_id)}
                        >
                            <Image
                                source={item.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                                style={styles.restaurantImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={200}
                            />
                            <View style={styles.restaurantDetails}>
                                <View style={styles.row}>
                                    <Text style={[styles.restaurantName, { color: theme.text }]}>
                                        {item.name}{item.suburb ? ` • ${item.suburb}` : ''}
                                    </Text>
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
            </Animated.ScrollView>
            <Modal
                visible={locationModalVisible}
                animationType="none"
                transparent={true}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <Animated.View 
                        style={{ 
                            flex: 1, 
                            backgroundColor: theme.background,
                            transform: [{ translateY: modalEntryAnim }]
                        }}
                    >
                        {/* Full Screen Map */}
                        <MapView
                            ref={mapRef}
                            provider={PROVIDER_GOOGLE}
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={mapRegion}
                            mapPadding={{ top: 0, right: 0, left: 0, bottom: Dimensions.get('window').height * 0.4 }}
                            customMapStyle={isDark ? mapDarkStyle : mapLightStyle}
                            onPress={() => {
                                Keyboard.dismiss();
                            }}
                            onRegionChangeStart={() => {
                                Keyboard.dismiss();
                                // Only slide sheet down if we haven't locked a selection
                                if (!isLocationSelected) animateModal(Dimensions.get('window').height * 0.7);
                            }}
                            onRegionChangeComplete={(region) => {
                                setMapRegion(region);
                                // Only slide sheet back up if we haven't locked a selection
                                if (!isLocationSelected) animateModal(0);
                            }}
                        >
                            {selectedLocation?.lat && selectedLocation?.lng && (
                                <Marker
                                    coordinate={{
                                        latitude: selectedLocation.lat,
                                        longitude: selectedLocation.lng
                                    }}
                                    pinColor={theme.accent}
                                />
                            )}
                        </MapView>


                        <View style={{ position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <TouchableOpacity
                                onPress={closeLocationModal}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: theme.surface,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 5
                                }}
                            >
                                <X size={24} color={theme.text} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <GooglePlacesAutocomplete
                                    ref={googlePlacesRef}
                                    placeholder="Search delivery address..."
                                    fetchDetails={true}
                                    minLength={2}
                                    enablePoweredByContainer={false}
                                    onFail={(error) => {
                                        console.error('Places Error:', error);
                                    }}
                                    onNotFound={() => console.log('no results')}
                                    debounce={300}
                                    onPress={(data, details = null) => {
                                        if (details) {
                                            const newLoc = {
                                                label: data.structured_formatting.main_text,
                                                city: details.address_components.find(c => c.types.includes('locality'))?.long_name || '',
                                                suburb: data.structured_formatting.main_text,
                                                street: details.address_components.find(c => c.types.includes('route'))?.long_name || '',
                                                lat: details.geometry.location.lat,
                                                lng: details.geometry.location.lng,
                                            };
                                            setSelectedLocation(newLoc);
                                            showDoneButton();
                                        }
                                    }}
                                    query={{
                                        key: 'AIzaSyAfW8js09sB0cfQzz19aRBkSE7sDMy5cu0',
                                        language: 'en',
                                        components: 'country:zw',
                                        types: 'establishment|geocode',
                                        location: selectedLocation?.lat && selectedLocation?.lng ? `${selectedLocation.lat},${selectedLocation.lng}` : undefined,
                                        radius: 5000
                                    }}
                                    nearbyPlacesAPI="GooglePlacesSearch"
                                    enableHighAccuracyLocation={true}

                                    styles={{
                                        container: { flex: 0, zIndex: 1000 },
                                        textInputContainer: { width: '100%' },
                                        textInput: {
                                            height: 44,
                                            color: theme.text,
                                            fontSize: 16,
                                            backgroundColor: theme.surface,
                                            borderRadius: 22,
                                            paddingLeft: 20,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            elevation: 5
                                        },
                                        predefinedPlacesDescription: { color: theme.accent },
                                        listView: {
                                            backgroundColor: theme.background,
                                            borderRadius: 16,
                                            marginTop: 8,
                                            borderWidth: 1,
                                            borderColor: theme.surface,
                                            position: 'absolute',
                                            top: 45,
                                            left: 0,
                                            right: 0,
                                            zIndex: 2000,
                                            elevation: 10,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 8
                                        },
                                        row: { 
                                            padding: 13, 
                                            height: 48, 
                                            flexDirection: 'row', 
                                            alignItems: 'center',
                                            backgroundColor: theme.background 
                                        },
                                        separator: { height: 1.5, backgroundColor: theme.surface },
                                        description: { color: theme.text, fontSize: 14 }
                                    }}
                                />
                            </View>
                        </View>

                        {/* Animated Overlay */}
                        <Animated.View 
                            style={{ 
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: Dimensions.get('window').height * 0.65,
                                borderTopLeftRadius: 48, 
                                borderTopRightRadius: 48, 
                                backgroundColor: theme.background, 
                                padding: 24,
                                transform: [{ translateY: modalY }],
                                elevation: 15,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: -4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 12
                            }}
                        >
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>Delivery Details</Text>
                            <Text style={{ color: theme.textMuted, marginBottom: 20 }}>Confirm your location or choose a saved one</Text>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                <View style={{ gap: 20, paddingBottom: 40 }}>
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Selected Spot</Text>
                                        
                                        {/* GPS Capture Button */}
                                        <TouchableOpacity
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 18,
                                                backgroundColor: theme.surface,
                                                borderRadius: 20,
                                                gap: 12,
                                                borderWidth: 2,
                                                borderColor: selectedLocation?.label === 'Current Spot' ? theme.accent : theme.border,
                                                marginBottom: 12,
                                                shadowColor: selectedLocation?.label === 'Current Spot' ? theme.accent : 'transparent',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: selectedLocation?.label === 'Current Spot' ? 0.1 : 0,
                                                shadowRadius: 10,
                                                elevation: selectedLocation?.label === 'Current Spot' ? 4 : 0
                                            }}
                                            onPress={async () => {
                                                setIsFetchingLocation(true);
                                                try {
                                                    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                                                    if (status === 'granted') {
                                                        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
                                                        const [rev] = await ExpoLocation.reverseGeocodeAsync({
                                                            latitude: loc.coords.latitude,
                                                            longitude: loc.coords.longitude
                                                        });
                                                        if (rev) {
                                                            const newLoc = {
                                                                label: 'Current Spot',
                                                                city: rev.city || 'Current Location',
                                                                suburb: rev.district || rev.subregion || 'Nearby',
                                                                street: rev.name || '',
                                                                lat: loc.coords.latitude,
                                                                lng: loc.coords.longitude
                                                            };
                                                            setSelectedLocation(newLoc);
                                                            const region = {
                                                                latitude: loc.coords.latitude,
                                                                longitude: loc.coords.longitude,
                                                                latitudeDelta: 0.01,
                                                                longitudeDelta: 0.01,
                                                            };
                                                            setMapRegion(region);
                                                            mapRef.current?.animateToRegion(region, 500);
                                                            
                                                            // Trigger manual Done button instead of auto-close
                                                            showDoneButton();
                                                        }
                                                    } else {
                                                        Alert.alert('Permission Denied', 'Location permission is required.');
                                                    }
                                                } catch (error) {
                                                    console.error('GPS Error:', error);
                                                } finally {
                                                    setIsFetchingLocation(false);
                                                }
                                            }}
                                        >
                                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                {isFetchingLocation ? (
                                                    <ActivityIndicator size="small" color={theme.accent} />
                                                ) : (
                                                    <MapPin size={24} color={theme.accent} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>
                                                    {isFetchingLocation ? 'Locating...' : 'Use Current GPS'}
                                                </Text>
                                                <Text style={{ color: theme.textMuted, fontSize: 12 }}>Pinpoint your exact delivery spot</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Selected Location Card (Redesigned to look like a STATUS, not a button) */}
                                        {selectedLocation && (
                                            <View 
                                                style={{ 
                                                    backgroundColor: theme.surface + '80', // More translucent
                                                    borderRadius: 24, 
                                                    padding: 20, 
                                                    borderWidth: 1.5, 
                                                    borderColor: theme.border,
                                                    borderStyle: 'dashed', // Differentiates from solid buttons
                                                    marginTop: 8
                                                }}
                                            >
                                                <View style={{ position: 'absolute', top: -10, left: 20, backgroundColor: theme.background, paddingHorizontal: 12, borderRadius: 4 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.accent, letterSpacing: 1 }}>CURRENT ACTIVE SPOT</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accent + '15', justifyContent: 'center', alignItems: 'center' }}>
                                                        <MapPin size={22} color={theme.accent} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 17 }}>{selectedLocation.suburb || selectedLocation.city}</Text>
                                                        <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>{selectedLocation.street ? `${selectedLocation.street}, ` : ''}{selectedLocation.city}</Text>
                                                    </View>
                                                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b98120', justifyContent: 'center', alignItems: 'center' }}>
                                                        <Check size={14} color="#10b981" />
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Saved Addresses List */}
                                    {savedAddresses && savedAddresses.length > 0 && (
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Saved Addresses</Text>
                                            {savedAddresses.map((addr: any) => (
                                                <TouchableOpacity
                                                    key={addr.id}
                                                    style={{
                                                        backgroundColor: theme.surface,
                                                        borderRadius: 16,
                                                        padding: 16,
                                                        marginBottom: 12,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        borderWidth: selectedLocation?.id === addr.id ? 1 : 0,
                                                        borderColor: theme.accent
                                                    }}
                                                    onPress={() => {
                                                        setSelectedLocation(addr);
                                                        showDoneButton();
                                                    }}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.border + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                        <MapPin size={20} color={theme.textMuted} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.text, fontWeight: '500' }}>{addr.label} • {addr.suburb}</Text>
                                                        <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>{addr.street ? `${addr.street}, ` : ''}{addr.city}</Text>
                                                    </View>
                                                    {selectedLocation?.id === addr.id && <CheckCircle2 size={16} color={theme.accent} />}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                </View>
                            </ScrollView>

                            {/* Floating DONE Button */}
                            {isLocationSelected && (
                                <Animated.View 
                                    style={{ 
                                        position: 'absolute', 
                                        bottom: 30, 
                                        left: 20, 
                                        right: 20,
                                        transform: [{ translateY: doneButtonAnim }]
                                    }}
                                >
                                    <TouchableOpacity
                                        onPress={closeLocationModal}
                                        style={{
                                            backgroundColor: theme.accent,
                                            height: 64,
                                            borderRadius: 32,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            gap: 12,
                                            shadowColor: theme.accent,
                                            shadowOffset: { width: 0, height: 8 },
                                            shadowOpacity: 0.4,
                                            shadowRadius: 15,
                                            elevation: 8,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Done</Text>
                                        <ChevronRight size={24} color="#fff" />
                                    </TouchableOpacity>
                                </Animated.View>
                            )}
                        </Animated.View>
                    </Animated.View>
                </TouchableWithoutFeedback>
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
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    stickyInner: {
        paddingTop: 55,
        paddingBottom: 15,
        paddingHorizontal: 20,
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
