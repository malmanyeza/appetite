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
    RefreshControl,
    PanResponder,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/Map';
import { MapSkeleton } from '../components/MapSkeleton';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { mapDarkStyle, mapLightStyle } from '../theme/MapStyle';
import * as ExpoLocation from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reverseGeocodeGoogle } from '../services/geocodingService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { restaurantService } from '../services/restaurantService';
import { Search, MapPin, Clock, Filter, ChevronRight, Star, Heart, Truck, ShoppingBag, Map as MapIcon, X, CheckCircle2, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useLocationStore } from '../store/locationStore';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { getThumbnailUrl } from '../utils/storageUtils';

const INITIAL_REGION = {
    latitude: -17.8248, // Harare
    longitude: 31.0530,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

export const CustomerHome = () => {
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
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

    const { selectedLocation, setSelectedLocation, splashHasFinished, hasAutoPrompted, setHasAutoPrompted } = useLocationStore();
    const { profile } = useAuthStore();
    const [mapRegion, setMapRegion] = React.useState<any>(selectedLocation ? {
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    } : INITIAL_REGION);
    // Live GPS position — used for distance calculations (separate from delivery address)
    const [gpsLocation, setGpsLocation] = React.useState<{ lat: number; lng: number } | null>(null);
    const mapRef = React.useRef<MapView | null>(null);
    const googlePlacesRef = React.useRef<any>(null);
    const modalY = React.useRef(new Animated.Value(0)).current;

    // Track modalY value for synchronous use in PanResponder
    const modalYValue = React.useRef(0);
    React.useEffect(() => {
        const id = modalY.addListener(({ value }) => {
            modalYValue.current = value;
        });
        return () => modalY.removeListener(id);
    }, [modalY]);

    const scrollY = React.useRef(new Animated.Value(0)).current;
    const modalEntryAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;

    // 5. Done Button Animation & State
    const [isLocationSelected, setIsLocationSelected] = React.useState(false);
    const [isModalDown, setIsModalDown] = React.useState(false);
    const [isAutoTrigger, setIsAutoTrigger] = React.useState(false);
    const [isMapReady, setIsMapReady] = React.useState(false);
    const doneButtonAnim = React.useRef(new Animated.Value(120)).current;
    const pinAnim = React.useRef(new Animated.Value(0)).current;
    const isProgrammaticChange = React.useRef(false);
    const [isGpsButtonLoading, setIsGpsButtonLoading] = React.useState(false);
    const gpsRequestCounter = React.useRef(0);
    const isHumanGestureRef = React.useRef(false);

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

    const openLocationModal = () => {
        setLocationModalVisible(true);
    };

    const closeLocationModal = () => {
        setHasAutoPrompted(true);
        setIsLocationSelected(false);
        setIsAutoTrigger(false);
        doneButtonAnim.setValue(120);
        setLocationModalVisible(false);
    };

    const SHEET_HEIGHT = Dimensions.get('window').height * 0.55;
    const DOWN_VALUE = Dimensions.get('window').height * 0.45;

    const initialPanY = React.useRef(0);
    const panResponder = React.useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            initialPanY.current = modalYValue.current;
        },
        onPanResponderMove: (_, gestureState) => {
            // Move in perfect sync with finger by using the baseline from grant
            const newY = Math.max(0, initialPanY.current + gestureState.dy);
            modalY.setValue(newY);
        },
        onPanResponderRelease: (_, gestureState) => {
            // Snap logic based on final position and velocity
            if (gestureState.dy < -50 || (modalYValue.current < DOWN_VALUE / 2 && gestureState.vy < 0)) {
                // Snapping UP
                animateModal(0);
                setIsModalDown(false);
            } else if (gestureState.dy > 50 || (modalYValue.current >= DOWN_VALUE / 2)) {
                // Snapping DOWN
                animateModal(DOWN_VALUE);
                setIsModalDown(true);
            } else {
                // Revert to current state if gesture was too small
                animateModal(isModalDown ? DOWN_VALUE : 0);
            }
        }
    }), [isModalDown]);

    const animateModal = (toValue: number) => {
        Animated.spring(modalY, {
            toValue,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        }).start();
    };
    // Removed auto-animating map region when selectedLocation changes to solve infinite panning loops.
    // Instead, explicit actions like pressing GPS and choosing saved locations will manually call animateToRegion.

    const [hasAnimatedInitialLocation, setHasAnimatedInitialLocation] = React.useState(false);

    React.useEffect(() => {
        if (!isMapReady || hasAnimatedInitialLocation) return;

        (async () => {
            // 1. Priority: Selected Location (Saved Address)
            if (selectedLocation?.lat && selectedLocation?.lng) {
                isProgrammaticChange.current = true;
                mapRef.current?.animateToRegion({
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 600);
                setHasAnimatedInitialLocation(true);
                return;
            }

            // 2. Fallback: Live GPS Auto-Snap — use lastKnown for instant snap
            try {
                const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    // Fast path: OS-cached position resolves instantly
                    let loc = await ExpoLocation.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
                    if (!loc) {
                        loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
                    }

                    setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

                    isProgrammaticChange.current = true;
                    mapRef.current?.animateToRegion({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }, 600);
                    setHasAnimatedInitialLocation(true);
                }
            } catch (err) {
                console.warn('[Home] Auto-snap GPS failed:', err);
                setHasAnimatedInitialLocation(true);
            }
        })();
    }, [isMapReady, selectedLocation, hasAnimatedInitialLocation]);

    // Background GPS for distance accuracy (separate from the delivery address)
    React.useEffect(() => {
        (async () => {
            try {
                const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await ExpoLocation.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 })
                        || await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
                    setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                }
            } catch (err) {
                console.warn('[Home] Distance GPS failed:', err);
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
                .select('id, label, city, suburb, street, lat, lng, is_default')
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
                        let loc = await ExpoLocation.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
                        if (!loc) loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });

                        const rev = await reverseGeocodeGoogle(loc.coords.latitude, loc.coords.longitude);

                        setSelectedLocation({
                            city: rev?.city || 'Current Location',
                            suburb: rev?.suburb || 'Nearby',
                            lat: loc.coords.latitude,
                            lng: loc.coords.longitude
                        });
                    }
                } catch (err) {
                    console.warn('GPS Fallback failed:', err);
                }
            })();
        }
    }, [selectedLocation]);

    // 3. Fetch saved addresses for the modal

    const { data: savedAddresses, isLoading: isAddressesLoading } = useQuery({
        queryKey: ['user_addresses', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return [];
            const { data, error } = await supabase
                .from('addresses')
                .select('id, label, city, suburb, street, lat, lng, is_default')
                .eq('user_id', profile?.id)
                .order('is_default', { ascending: false });
            if (error) {
                console.warn('Address Fetch Error:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!profile?.id
    });

    // LayoutAnimation experimental is no longer needed in the New Architecture

    const { data: restaurants, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['restaurants', selectedCategory, selectedLocation?.lat, selectedLocation?.lng],
        queryFn: async () => {
            // Use the active selected location (GPS or searched) as the single source of truth
            // Fallback to Harare Center (INITIAL_REGION) so guests see restaurants immediately
            const coordLat = selectedLocation?.lat || INITIAL_REGION.latitude;
            const coordLng = selectedLocation?.lng || INITIAL_REGION.longitude;

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

    // Integrated Smart Prefetching for the home feed
    React.useEffect(() => {
        if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
            const urls = restaurants
                .slice(0, 10)
                .map((r: any) => getThumbnailUrl(r.cover_image_url, r.updated_at))
                .filter((u): u is string => !!u);
            if (urls.length > 0) {
                Image.prefetch(urls);
            }
        }
    }, [restaurants]);

    // 1. Auto-trigger modal after a small delay once the app is REVEALED
    // 1. Consolidated Modal Animation Controller
    React.useEffect(() => {
        if (locationModalVisible) {
            // Strictly enforce UI state on open
            modalY.setValue(0);
            setIsModalDown(false);

            // Animate SLIDE UP
            Animated.spring(modalEntryAnim, {
                toValue: 0,
                tension: 40,
                friction: 8,
                useNativeDriver: true,
            }).start();

            // Refresh GPS on open
            (async () => {
                try {
                    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
                        const region = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        };
                        setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                        setMapRegion(region);
                        isProgrammaticChange.current = true;
                        mapRef.current?.animateToRegion(region, 500);
                    }
                } catch (err) {
                    console.warn('[Home] Modal GPS snap failed:', err);
                }
            })();
        } else {
            // Animate SLIDE DOWN
            Animated.timing(modalEntryAnim, {
                toValue: Dimensions.get('window').height,
                duration: 800,
                easing: (t) => Math.pow(t, 4),
                useNativeDriver: true,
            }).start();
        }
    }, [locationModalVisible]);

    // 2. Simple Auto-trigger logic (Once per session)
    const hasAutoTriggeredLocal = React.useRef(false);
    React.useEffect(() => {
        if (!hasAutoTriggeredLocal.current) {
            const timer = setTimeout(() => {
                setLocationModalVisible(true);
                hasAutoTriggeredLocal.current = true;
            }, 1500); // Safe delay for all device speeds
            return () => clearTimeout(timer);
        }
    }, []);



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
                            openLocationModal();
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
                                source={getThumbnailUrl(item.cover_image_url, item.updated_at) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                                style={styles.restaurantImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={300}
                                placeholder="L6PZf-S4.AyD_NbH9G_dyD%MwvVs"
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

            {/* Location Picker Overlay (Replaces Modal for instant load) */}
            <Animated.View
                pointerEvents={locationModalVisible ? 'auto' : 'none'}
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        zIndex: locationModalVisible ? 3000 : -1,
                        backgroundColor: theme.background,
                        transform: [{ translateY: modalEntryAnim }]
                    }
                ]}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        <MapSkeleton visible={!isMapReady} />
                        {/* Full Screen Map - Always mounted for instant speed */}
                        <MapView
                            ref={mapRef}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={mapRegion}
                            mapPadding={{ top: 0, right: 0, left: 0, bottom: Dimensions.get('window').height * 0.4 }}
                            customMapStyle={Platform.OS === 'android' ? (isDark ? mapDarkStyle : mapLightStyle) : undefined}
                            onMapReady={() => setIsMapReady(true)}
                            onPress={() => {
                                Keyboard.dismiss();
                                if (!isLocationSelected && !isModalDown) {
                                    animateModal(DOWN_VALUE);
                                    setIsModalDown(true);
                                }
                            }}
                            onRegionChangeStart={(_region, details) => {
                                Keyboard.dismiss();
                                // isGesture is supplied by react-native-maps (mostly reliable on iOS)
                                // We store this in a ref so onRegionChangeComplete can see it
                                isHumanGestureRef.current = details ? details.isGesture : !isProgrammaticChange.current;

                                if (isHumanGestureRef.current) {
                                    Animated.spring(pinAnim, { toValue: -15, useNativeDriver: true }).start();
                                    gpsRequestCounter.current += 1;
                                    setIsFetchingLocation(true);
                                    setHasAnimatedInitialLocation(true);
                                }
                            }}
                            onRegionChangeComplete={async (region, _details) => {
                                // We stay in whatever state the user has left the sheet (usually UP)
                                if (!isHumanGestureRef.current || isProgrammaticChange.current) {
                                    isProgrammaticChange.current = false;
                                    isHumanGestureRef.current = false; // Reset
                                    Animated.spring(pinAnim, { toValue: 0, useNativeDriver: true }).start();
                                    return;
                                }

                                isHumanGestureRef.current = false; // Reset for next time
                                Animated.spring(pinAnim, { toValue: 0, useNativeDriver: true }).start();

                                try {
                                    const rev = await reverseGeocodeGoogle(region.latitude, region.longitude);
                                    if (rev) {
                                        setSelectedLocation({
                                            label: 'Selected Area',
                                            city: rev.city || 'Harare',
                                            suburb: rev.suburb || 'Nearby',
                                            street: rev.physical_address || '',
                                            lat: region.latitude,
                                            lng: region.longitude
                                        });
                                        if (!isLocationSelected) {
                                            showDoneButton();
                                        }
                                    }
                                } catch (err) {
                                    console.warn("Drag Pin Reverse Geocode Error:", err);
                                } finally {
                                    setIsFetchingLocation(false);
                                }

                                // Only slide sheet back up if we haven't locked a selection
                                if (!isLocationSelected) {
                                    animateModal(0);
                                    setIsModalDown(false);
                                }
                            }}
                        >
                            {/* Marker removed in favor of fixed center pin */}
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


                        <View style={{ position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2000, elevation: 2000 }}>
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
                                    textInputProps={{
                                        placeholderTextColor: theme.textMuted,
                                    }}
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
                                            googlePlacesRef.current?.setAddressText(data.description);
                                            googlePlacesRef.current?.blur();
                                            Keyboard.dismiss();

                                            isProgrammaticChange.current = true;
                                            mapRef.current?.animateCamera({
                                                center: {
                                                    latitude: newLoc.lat,
                                                    longitude: newLoc.lng,
                                                },
                                                zoom: 15,
                                                heading: 0,
                                                pitch: 0,
                                            }, { duration: 600 });

                                            showDoneButton();
                                        }
                                    }}
                                    query={{
                                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAfW8js09sB0cfQzz19aRBkSE7sDMy5cu0',
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
                                            height: 48,
                                            color: theme.text,
                                            fontSize: 16,
                                            backgroundColor: theme.surface,
                                            borderRadius: 24,
                                            paddingLeft: 20,
                                            borderWidth: 1,
                                            borderColor: theme.border,
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
                                            borderColor: theme.border,
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
                                            height: 52,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: theme.background
                                        },
                                        separator: { height: 1, backgroundColor: theme.border },
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
                                height: Dimensions.get('screen').height * 0.55,
                                borderTopLeftRadius: 48,
                                borderTopRightRadius: 48,
                                backgroundColor: theme.background,
                                padding: 24,
                                paddingBottom: insets.bottom + 24, // SEAL THE GAP
                                transform: [{ translateY: modalY }],
                                zIndex: 50,
                                elevation: 15,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: -4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 10
                            }}
                        >
                            {/* Drag Handle - Larger touch area for usability */}
                            <View
                                {...panResponder.panHandlers}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    marginTop: -24,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10
                                }}
                            >
                                <View
                                    style={{
                                        width: 40,
                                        height: 5,
                                        borderRadius: 3,
                                        backgroundColor: theme.textMuted,
                                        opacity: 0.3
                                    }}
                                />
                            </View>
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
                                                const currentRequestId = ++gpsRequestCounter.current;
                                                isProgrammaticChange.current = true;
                                                setIsGpsButtonLoading(true);
                                                setIsFetchingLocation(true);
                                                try {
                                                    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
                                                    if (status === 'granted') {
                                                        // Get coordinates — lastKnown is instant, Balanced is 1-2s fallback
                                                        const lastKnown = await ExpoLocation.getLastKnownPositionAsync();
                                                        const loc = lastKnown && (Date.now() - lastKnown.timestamp) < 60000
                                                            ? lastKnown
                                                            : await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Highest });

                                                        if (currentRequestId !== gpsRequestCounter.current) return;

                                                        // Snap map immediately
                                                        isProgrammaticChange.current = true;
                                                        mapRef.current?.animateToRegion({
                                                            latitude: loc.coords.latitude,
                                                            longitude: loc.coords.longitude,
                                                            latitudeDelta: 0.005,
                                                            longitudeDelta: 0.005,
                                                        }, 300);

                                                        // Set a placeholder location instantly so the button restores NOW
                                                        setSelectedLocation({
                                                            label: 'Current Spot',
                                                            city: 'Locating...',
                                                            suburb: 'Your location',
                                                            street: '',
                                                            lat: loc.coords.latitude,
                                                            lng: loc.coords.longitude
                                                        });
                                                        showDoneButton();

                                                        // ✅ Button loading stops HERE — user sees instant response
                                                        setIsGpsButtonLoading(false);
                                                        setIsFetchingLocation(false);

                                                        // Reverse geocode runs silently in the background
                                                        reverseGeocodeGoogle(loc.coords.latitude, loc.coords.longitude)
                                                            .then(rev => {
                                                                if (rev && currentRequestId === gpsRequestCounter.current) {
                                                                    setSelectedLocation({
                                                                        label: 'Current Spot',
                                                                        city: rev.city || 'Harare',
                                                                        suburb: rev.suburb || 'Nearby',
                                                                        street: rev.physical_address || '',
                                                                        lat: loc.coords.latitude,
                                                                        lng: loc.coords.longitude
                                                                    });
                                                                }
                                                            })
                                                            .catch(() => { /* silent — placeholder label stays */ });
                                                    } else {
                                                        Alert.alert('Permission Denied', 'Location permission is required.');
                                                        setIsGpsButtonLoading(false);
                                                        setIsFetchingLocation(false);
                                                    }
                                                } catch (error) {
                                                    console.error('GPS Error:', error);
                                                    setIsGpsButtonLoading(false);
                                                    setIsFetchingLocation(false);
                                                }
                                            }}

                                        >
                                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                {isGpsButtonLoading ? (
                                                    <ActivityIndicator size="small" color={theme.accent} />
                                                ) : (
                                                    <MapPin size={24} color={theme.accent} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>
                                                    {isGpsButtonLoading ? 'Locating...' : 'Use my current location'}
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
                                                        mapRef.current?.animateToRegion({
                                                            latitude: addr.lat,
                                                            longitude: addr.lng,
                                                            latitudeDelta: 0.01,
                                                            longitudeDelta: 0.01,
                                                        }, 500);
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
                                        bottom: insets.bottom + 20, // ADJUST FOR ANDROID BAR
                                        left: 20,
                                        right: 20,
                                        zIndex: 60,
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
                    </View>
                </TouchableWithoutFeedback>
            </Animated.View>
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
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        minHeight: 400
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalSubtitle: { fontSize: 14, marginBottom: 24 },
    locationInput: { borderRadius: 16, padding: 16, height: 56, fontSize: 16, marginBottom: 24 },
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
        top: Dimensions.get('window').height * 0.25 - 38,
        left: '50%',
        marginLeft: -15,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 1000,
        elevation: 1000
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
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(239, 68, 68, 0.4)',
        borderWidth: 2,
        borderColor: '#ef4444',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 6,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20
    },
    saveLocationBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveLocationBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
