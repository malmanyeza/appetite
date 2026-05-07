import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Animated,
    TextInput,
    Dimensions,
    FlatList,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, Share2, Info, Plus, Minus, X, Check, MapPin, Clock, Search, Utensils } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useCartStore } from '../store/cartStore';
import { restaurantService } from '../services/restaurantService';
import { getThumbnailUrl, getOriginalUrl } from '../utils/storageUtils';

const { width } = Dimensions.get('window');

export const RestaurantDetails = ({ route, navigation }: any) => {
    const { id } = route.params;
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { addItem, items: cartItems } = useCartStore();

    const [searchQuery, setSearchQuery] = useState('');
    const scrollY = useRef(new Animated.Value(0)).current;
    const bannerFlatListRef = useRef<FlatList>(null);
    const [bannerIndex, setBannerIndex] = useState(0);

    // Auto-sliding logic for banners
    useEffect(() => {
        if (!banners || banners.length <= 1) return;
        
        const interval = setInterval(() => {
            const nextIndex = (bannerIndex + 1) % banners.length;
            setBannerIndex(nextIndex);
            bannerFlatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [banners, bannerIndex]);

    const { data: locationData, isLoading: loadingLoc, error: errorLoc, refetch: refetchLoc, isRefetching: isRefetchingLoc } = useQuery({
        queryKey: ['location', id],
        queryFn: () => restaurantService.getLocationDetails(id)
    });

    const restaurantId = locationData?.restaurant_id;

    const { data: restaurant, isLoading: loadingRest, error: errorRest, refetch: refetchRest, isRefetching: isRefetchingRest } = useQuery({
        queryKey: ['restaurant', restaurantId],
        queryFn: () => restaurantService.getRestaurantInfo(restaurantId),
        enabled: !!restaurantId
    });

    const { data: menu, isLoading: loadingMenu, error: errorMenu, refetch: refetchMenu, isRefetching: isRefetchingMenu } = useQuery({
        queryKey: ['menu', restaurantId, id],
        queryFn: () => restaurantService.getBranchMenu(restaurantId, id),
        enabled: !!restaurantId
    });

    const { data: banners } = useQuery({
        queryKey: ['banners', restaurantId],
        queryFn: () => restaurantService.getRestaurantBanners(restaurantId),
        enabled: !!restaurantId
    });

    const isRefreshing = isRefetchingLoc || isRefetchingRest || isRefetchingMenu;
    const onRefresh = async () => {
        await Promise.all([
            refetchLoc(),
            restaurantId ? refetchRest() : Promise.resolve(),
            restaurantId ? refetchMenu() : Promise.resolve()
        ]);
    };

    const filteredMenu = useMemo(() => {
        if (!menu) return [];
        if (!searchQuery) return menu;
        return menu.filter((item: any) => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [menu, searchQuery]);

    const categories = useMemo(() => {
        if (!filteredMenu) return [];
        const cats = filteredMenu.map((i: any) => i.menu_categories?.name || i.category || 'Uncategorized');
        const uniqueCats = Array.from(new Set(cats)) as string[];
        
        // Sort: "promos" first, then alphabetical
        return uniqueCats.sort((a, b) => {
            const aL = a.toLowerCase();
            const bL = b.toLowerCase();
            if (aL.includes('promo')) return -1;
            if (bL.includes('promo')) return 1;
            return a.localeCompare(b);
        });
    }, [filteredMenu]);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const mainScrollRef = useRef<ScrollView>(null);
    const categoryRefs = useRef<{ [key: string]: number }>({});

    // Default to first category (Promos) when loaded
    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0]);
        }
    }, [categories]);

    const stickyOpacity = scrollY.interpolate({
        inputRange: [140, 220],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const stickyCatTranslateY = scrollY.interpolate({
        inputRange: [250, 350],
        outputRange: [-60, 0],
        extrapolate: 'clamp',
    });

    const stickyCatOpacity = scrollY.interpolate({
        inputRange: [250, 320],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const actuallyLoading = loadingLoc || (!!restaurantId && (loadingRest || loadingMenu));
    const anyError = errorLoc || errorRest || errorMenu;

    if (actuallyLoading && !anyError) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} size="large" />
        </View>
    );

    if (anyError || !locationData || (!!restaurantId && !restaurant)) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Oops! Something went wrong.</Text>
            <TouchableOpacity 
                style={[styles.backButton, { marginTop: 20, backgroundColor: theme.accent }]} 
                onPress={() => navigation.goBack()}
            >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Sticky Header Overlay */}
            <Animated.View 
                pointerEvents="box-none"
                style={[styles.stickyHeader, { opacity: stickyOpacity, zIndex: 100 }]}
            >
                <View style={[styles.stickyInner, { backgroundColor: theme.background, borderBottomColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <View style={styles.stickyContent}>
                        <TouchableOpacity 
                            style={[styles.stickyIconButton, { backgroundColor: theme.surface }]} 
                            onPress={() => navigation.goBack()}
                        >
                            <ChevronLeft color={theme.text} size={22} />
                        </TouchableOpacity>
                        
                        <View style={[styles.stickySearchBar, { backgroundColor: theme.surface }]}>
                            <Search size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder="Search in menu..."
                                placeholderTextColor={theme.textMuted}
                                style={[styles.stickySearchInput, { color: theme.text }]}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Animated Categories for Sticky Header */}
                    <Animated.View style={{ 
                        opacity: stickyCatOpacity, 
                        transform: [{ translateY: stickyCatTranslateY }],
                        marginTop: 10,
                        height: 50
                    }}>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                        >
                            {categories.map((cat) => (
                                <TouchableOpacity 
                                    key={`sticky_${cat}`} 
                                    style={[
                                        styles.stickyCatItem, 
                                        { backgroundColor: selectedCategory === cat ? theme.accent : 'transparent' }
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(cat);
                                        if (categoryRefs.current[cat] !== undefined) {
                                            mainScrollRef.current?.scrollTo({
                                                y: categoryRefs.current[cat],
                                                animated: true
                                            });
                                        }
                                    }}
                                >
                                    <Text style={[
                                        styles.stickyCatText, 
                                        { color: selectedCategory === cat ? '#FFF' : theme.text }
                                    ]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Animated.View>

            <Animated.ScrollView 
                ref={mainScrollRef}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                }
            >
                {/* Hero / Banners Section */}
                <View style={[styles.bannerWrapper, { paddingTop: insets.top }]}>
                    {banners && banners.length > 0 ? (
                        <View>
                            <FlatList
                                ref={bannerFlatListRef}
                                data={banners}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={(e) => {
                                    setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                                }}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        activeOpacity={0.9}
                                        onPress={() => {
                                            if (item.menu_item_id && menu) {
                                                const foodItem = menu.find((f: any) => f.id === item.menu_item_id);
                                                if (foodItem) {
                                                    navigation.navigate('FoodItemDetail', { 
                                                        item: foodItem, 
                                                        restaurantId, 
                                                        locationId: id 
                                                    });
                                                }
                                            }
                                        }}
                                        style={{ width, height: 280 }}
                                    >
                                        <Image
                                            source={getOriginalUrl(item.image_url)}
                                            style={styles.heroImage}
                                            contentFit="cover"
                                            cachePolicy="memory-disk"
                                        />
                                        {item.title && (
                                            <View style={styles.bannerTitleOverlay}>
                                                <Text style={styles.bannerTitle}>{item.title}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.imageContainer}>
                            <Image
                                source={getOriginalUrl(restaurant?.cover_image_url) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                                style={styles.heroImage}
                                contentFit="cover"
                            />
                        </View>
                    )}
                    
                    <View style={[styles.navOverlay, { top: insets.top + 10 }]}>
                        <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => navigation.goBack()}>
                            <ChevronLeft color="#FFF" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                            <Share2 color="#FFF" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info */}
                <View style={styles.infoSection}>
                    <Text style={[styles.name, { color: theme.text }]}>{locationData?.location_name || restaurant?.name}</Text>
                    <Text style={[styles.description, { color: theme.textMuted }]}>{restaurant?.description}</Text>

                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={styles.categoryNav}
                        contentContainerStyle={{ paddingVertical: 10 }}
                    >
                        {categories.map((cat) => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[
                                    styles.catNavItem, 
                                    { backgroundColor: selectedCategory === cat ? theme.accent : theme.surface }
                                ]}
                                onPress={() => {
                                    setSelectedCategory(cat);
                                    if (categoryRefs.current[cat] !== undefined) {
                                        mainScrollRef.current?.scrollTo({
                                            y: categoryRefs.current[cat],
                                            animated: true
                                        });
                                    }
                                }}
                            >
                                <Text style={[
                                    styles.catNavText, 
                                    { color: selectedCategory === cat ? '#FFF' : theme.text }
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Inline Search */}
                <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                    <View style={[styles.inlineSearchBar, { backgroundColor: theme.surface }]}>
                        <Search size={18} color={theme.textMuted} style={{ marginRight: 10 }} />
                        <TextInput
                            placeholder="Search dishes, drinks..."
                            placeholderTextColor={theme.textMuted}
                            style={[styles.inlineSearchInput, { color: theme.text }]}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Menu Sections */}
                <View style={styles.menuSection}>
                    {categories.map((cat) => (
                        <View 
                            key={cat} 
                            style={styles.categorySection}
                            onLayout={(e) => {
                                categoryRefs.current[cat] = e.nativeEvent.layout.y + 400; // Adding offset for header
                            }}
                        >
                            <Text style={[styles.categoryTitle, { color: theme.text }]}>{cat}</Text>
                            {filteredMenu?.filter((i: any) => (i.menu_categories?.name || i.category || 'Uncategorized') === cat).map((item: any) => (
                                <TouchableOpacity 
                                    key={item.id} 
                                    style={[styles.menuItem, { borderBottomColor: theme.border }]}
                                    onPress={() => navigation.navigate('FoodItemDetail', { item, restaurantId, locationId: id })}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.itemText}>
                                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                                        <Text style={[styles.itemDesc, { color: theme.textMuted }]} numberOfLines={2}>{item.description}</Text>
                                        <Text style={[styles.itemPrice, { color: theme.accent }]}>${item.price.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.itemAction}>
                                        {item.image_url && (
                                            <Image
                                                source={getThumbnailUrl(item.image_url)}
                                                style={styles.itemImage}
                                                contentFit="cover"
                                            />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                    {categories.length === 0 && (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Utensils size={48} color={theme.textMuted} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <Text style={{ color: theme.textMuted }}>No items found in this section.</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 120 }} />
            </Animated.ScrollView>

            {/* Cart Bar */}
            {cartItems.length > 0 && (
                <View style={[styles.cartBar, { backgroundColor: theme.accent }]}>
                    <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
                        <View style={styles.cartCount}>
                            <Text style={styles.cartCountText}>
                                {cartItems.reduce((sum: number, i: any) => sum + i.qty, 0)}
                            </Text>
                        </View>
                        <Text style={styles.cartButtonText}>View Cart</Text>
                        <Text style={styles.cartTotalText}>
                            ${cartItems.reduce((sum: number, i: any) => {
                                const extras = i.selected_add_ons.reduce((s: number, a: any) => s + a.price, 0);
                                return sum + ((i.price + extras) * i.qty);
                            }, 0).toFixed(2)}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    bannerWrapper: { position: 'relative' },
    imageContainer: { width: '100%', height: 280 },
    heroImage: { width: '100%', height: '100%' },
    bannerTitleOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 30,
        backgroundColor: 'rgba(0,0,0,0.3)'
    },
    bannerTitle: { color: '#FFF', fontSize: 24, fontFamily: theme.fonts.headingBlack, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    navOverlay: {
        position: 'absolute',
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 10
    },
    iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    backButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
    infoSection: { padding: 20 },
    name: { fontSize: 28, fontFamily: theme.fonts.headingBlack, letterSpacing: -0.5 },
    description: { fontSize: 14, fontFamily: theme.fonts.body, marginTop: 6, lineHeight: 20, opacity: 0.7 },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 16, fontFamily: theme.fonts.heading },
    statLabel: { fontSize: 11, fontFamily: theme.fonts.body, marginTop: 2, opacity: 0.5 },
    divider: { width: 1, height: 24, opacity: 0.1 },
    categoryNav: { marginTop: 20 },
    catNavItem: { 
        paddingHorizontal: 20, 
        paddingVertical: 10, 
        borderRadius: 25, 
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    catNavText: { fontSize: 14, fontFamily: theme.fonts.heading, textTransform: 'capitalize' },
    menuSection: { padding: 20 },
    categorySection: { marginBottom: 32 },
    categoryTitle: { fontSize: 22, fontFamily: theme.fonts.headingBlack, marginBottom: 20, letterSpacing: -0.5 },
    menuItem: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1 },
    itemText: { flex: 1, paddingRight: 16 },
    itemName: { fontSize: 17, fontFamily: theme.fonts.heading },
    itemDesc: { fontSize: 13, fontFamily: theme.fonts.body, marginTop: 4, lineHeight: 18, opacity: 0.6 },
    itemPrice: { fontSize: 16, fontFamily: theme.fonts.heading, marginTop: 10 },
    itemAction: { position: 'relative' },
    itemImage: { width: 110, height: 110, borderRadius: 20 },
    cartBar: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    cartButton: { flexDirection: 'row', alignItems: 'center', padding: 18 },
    cartCount: {
        width: 28,
        height: 28,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    cartCountText: { color: '#FFF', fontSize: 14, fontFamily: theme.fonts.heading },
    cartButtonText: { flex: 1, color: '#FFF', fontSize: 17, fontFamily: theme.fonts.heading },
    cartTotalText: { color: '#FFF', fontSize: 17, fontFamily: theme.fonts.heading },
    stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
    stickyInner: { paddingTop: 55, paddingBottom: 15, paddingHorizontal: 20 },
    stickyContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stickyIconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    stickySearchBar: { flex: 1, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    stickySearchInput: { flex: 1, fontSize: 14, fontFamily: theme.fonts.body, height: '100%' },
    inlineSearchBar: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 18, paddingHorizontal: 18, marginTop: 10 },
    inlineSearchInput: { flex: 1, fontSize: 16, fontFamily: theme.fonts.bodyMedium, height: '100%' },
    stickyCatItem: {
        paddingHorizontal: 16,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        borderRadius: 20
    },
    stickyCatText: {
        fontSize: 13,
        fontFamily: theme.fonts.heading,
        textTransform: 'capitalize'
    }
});
