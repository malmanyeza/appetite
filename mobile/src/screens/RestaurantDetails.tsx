import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Animated,
    TextInput
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, Share2, Info, Plus, Minus, X, Check, MapPin, Clock, Search } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useCartStore } from '../store/cartStore';
import { restaurantService } from '../services/restaurantService';
import { getThumbnailUrl, getOriginalUrl } from '../utils/storageUtils';

export const RestaurantDetails = ({ route, navigation }: any) => {
    const { id } = route.params;
    const { theme } = useTheme();
    const { addItem, items: cartItems } = useCartStore();

    const [selectedItemForOptions, setSelectedItemForOptions] = useState<any>(null);
    const [tempSelectedAddons, setTempSelectedAddons] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollY = React.useRef(new Animated.Value(0)).current;

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

    const addToCart = (item: any) => {
        if (item.add_ons && item.add_ons.length > 0) {
            setSelectedItemForOptions(item);
            setTempSelectedAddons([]); // Start with nothing selected
        } else {
            if (restaurantId) {
                addItem(item, restaurantId, id);
            }
        }
    };

    const confirmAddToOptionsCart = () => {
        if (restaurantId) {
            addItem(selectedItemForOptions, restaurantId, id, tempSelectedAddons);
        }
        setSelectedItemForOptions(null);
        setTempSelectedAddons([]);
    };

    const toggleAddon = (addon: any) => {
        const isSelected = tempSelectedAddons.find((a: any) => a.name === addon.name);
        if (isSelected) {
            setTempSelectedAddons(tempSelectedAddons.filter((a: any) => a.name !== addon.name));
        } else {
            setTempSelectedAddons([...tempSelectedAddons, addon]);
        }
    };

    const isRefreshing = isRefetchingLoc || isRefetchingRest || isRefetchingMenu;
    const onRefresh = async () => {
        await Promise.all([
            refetchLoc(),
            restaurantId ? refetchRest() : Promise.resolve(),
            restaurantId ? refetchMenu() : Promise.resolve()
        ]);
    };

    const filteredMenu = React.useMemo(() => {
        if (!menu) return [];
        if (!searchQuery) return menu;
        return menu.filter((item: any) => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [menu, searchQuery]);

    const categories = Array.from(new Set(menu?.map((i: any) => i.category))) as string[];
    const filteredCategories = Array.from(new Set(filteredMenu.map((i: any) => i.category))) as string[];

    // Integrated Image Prefetching for the entire visible menu
    React.useEffect(() => {
        if (menu && menu.length > 0) {
            const urls = menu.map(m => m.image_url).filter(url => !!url);
            if (urls.length > 0) {
                Image.prefetch(urls);
            }
        }
    }, [menu]);

    const stickyOpacity = scrollY.interpolate({
        inputRange: [140, 220],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const stickyTranslateY = scrollY.interpolate({
        inputRange: [140, 220],
        outputRange: [-20, 0],
        extrapolate: 'clamp',
    });

    const stickyScale = scrollY.interpolate({
        inputRange: [140, 220],
        outputRange: [0.98, 1],
        extrapolate: 'clamp',
    });

    // More robust loading check: wait for location first, then for restaurant/menu if ID exists
    const actuallyLoading = loadingLoc || (!!restaurantId && (loadingRest || loadingMenu));
    const anyError = errorLoc || errorRest || errorMenu;

    if (actuallyLoading && !anyError) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={{ color: theme.textMuted, marginTop: 12 }}>
                {loadingLoc ? "Searching for location..." : loadingRest ? "Getting restaurant info..." : "Preparing menu..."}
            </Text>
        </View>
    );

    // Final check for data existence or errors
    if (anyError || !locationData || (!!restaurantId && !restaurant)) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Oops! Something went wrong.</Text>
            <Text style={{ color: theme.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                {anyError ? (anyError as any).message : "Restaurant information not found."}
            </Text>
            {anyError && (
                <Text style={{ color: theme.accent, marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                    Code: {(anyError as any).code || 'Unknown'}
                </Text>
            )}
            <TouchableOpacity 
                style={[styles.addButton, { position: 'static', marginTop: 30, paddingHorizontal: 30, height: 44, width: 'auto' }]} 
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
                style={[
                    styles.stickyHeader, 
                    { 
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
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X size={14} color={theme.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Animated.View>

            <Animated.ScrollView 
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.accent}
                    />
                }
            >
                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={getOriginalUrl(restaurant?.cover_image_url) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                        style={styles.heroImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        priority="high"
                        transition={300}
                        placeholder="L6PZf-S4.AyD_NbH9G_dyD%MwvVs"
                    />
                    <View style={styles.navOverlay}>
                        <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => navigation.goBack()}>
                            <ChevronLeft color="#FFF" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                            <Share2 color="#FFF" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info */}
                <View style={styles.infoSection}>
                    <Text style={[styles.name, { color: theme.text }]}>{locationData?.location_name || restaurant?.name || 'Restaurant'}</Text>
                    <Text style={[styles.description, { color: theme.textMuted }]}>{restaurant?.description}</Text>

                    {locationData && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.surface, borderRadius: 12, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MapPin size={14} color={theme.accent} />
                                <Text style={{ color: theme.text, fontSize: 13, fontWeight: 'bold' }}>{locationData.location_name}</Text>
                            </View>
                            <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 20 }}>{locationData.physical_address || locationData.suburb}</Text>
                            {(locationData.opening_time || locationData.closing_time) && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20, marginTop: 4 }}>
                                    <Clock size={12} color={theme.textMuted} />
                                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                                        {locationData.opening_time?.slice(0, 5)} - {locationData.closing_time?.slice(0, 5)}
                                        {locationData.days_open && ` (${locationData.days_open.join(', ')})`}
                                    </Text>
                                </View>
                            )}
                            {locationData.email && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4, marginLeft: 20 }}>
                                    <Text style={{ color: theme.accent, fontSize: 12 }}>✉️ {locationData.email}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: theme.text }]}>⭐ {locationData?.rating_avg || restaurant?.rating_avg}</Text>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{locationData?.rating_count || restaurant?.rating_count || 0}+ ratings</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: theme.text }]}>25-35</Text>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>min</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <TouchableOpacity style={styles.statItem}>
                            <Info size={18} color={theme.accent} />
                            <Text style={[styles.statValue, { color: theme.accent, marginTop: 2 }]}>More info</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar - Inline (Static) */}
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
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={18} color={theme.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Menu */}
                <View style={styles.menuSection}>
                    {filteredCategories.length === 0 && searchQuery !== '' ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Search size={48} color={theme.textMuted} style={{ opacity: 0.3, marginBottom: 16 }} />
                            <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>No items found</Text>
                            <Text style={{ color: theme.textMuted, marginTop: 4 }}>Try searching for something else</Text>
                        </View>
                    ) : (
                        filteredCategories.map((cat: string) => (
                            <View key={cat} style={styles.categorySection}>
                                <Text style={[styles.categoryTitle, { color: theme.text }]}>{cat}</Text>
                                {filteredMenu?.filter((i: any) => i.category === cat).map((item: any) => (
                                    <View key={item.id} style={[styles.menuItem, { borderBottomColor: theme.border }]}>
                                        <View style={styles.itemText}>
                                            <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                                            <Text style={[styles.itemDesc, { color: theme.textMuted }]} numberOfLines={2}>{item.description}</Text>
                                            <Text style={[styles.itemPrice, { color: theme.accent }]}>${item.price}</Text>
                                        </View>
                                        <View style={styles.itemAction}>
                                            {item.image_url && (
                                                <Image
                                                    source={getThumbnailUrl(item.image_url) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                                                    style={styles.itemImage}
                                                    contentFit="cover"
                                                    cachePolicy="disk"
                                                    transition={300}
                                                    placeholder="L6PZf-S4.AyD_NbH9G_dyD%MwvVs"
                                                />
                                            )}
                                            <TouchableOpacity
                                                style={[styles.addButton, { backgroundColor: theme.accent }]}
                                                onPress={() => addToCart(item)}
                                            >
                                                <Plus size={20} color="#FFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ))
                    )}
                </View>
                <View style={{ height: 120 }} />
            </Animated.ScrollView>

            {/* Sticky Cart Bar */}
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
                                const base = i.price;
                                const extras = i.selected_add_ons.reduce((s: number, a: any) => s + a.price, 0);
                                return sum + ((base + extras) * i.qty);
                            }, 0).toFixed(2)}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Options Modal */}
            {selectedItemForOptions && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Customize your {selectedItemForOptions.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedItemForOptions(null)}>
                                <X size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalScroll}>
                            <Text style={[styles.optionsLabel, { color: theme.textMuted }]}>EXTRAS</Text>
                            {selectedItemForOptions.add_ons.map((addon: any) => {
                                const isSelected = tempSelectedAddons.find(a => a.name === addon.name);
                                return (
                                    <TouchableOpacity 
                                        key={addon.name} 
                                        style={[styles.optionItem, { borderBottomColor: theme.border }]}
                                        onPress={() => toggleAddon(addon)}
                                    >
                                        <View style={styles.optionInfo}>
                                            <Text style={[styles.optionName, { color: theme.text }]}>{addon.name}</Text>
                                            <Text style={[styles.optionPrice, { color: theme.accent }]}>+${addon.price.toFixed(2)}</Text>
                                        </View>
                                        <View style={[
                                            styles.checkbox, 
                                            { borderColor: isSelected ? theme.accent : theme.border },
                                            isSelected && { backgroundColor: theme.accent }
                                        ]}>
                                            {isSelected && <Check size={14} color="#FFF" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity 
                            style={[styles.modalAddButton, { backgroundColor: theme.accent }]}
                            onPress={confirmAddToOptionsCart}
                        >
                            <Text style={styles.modalAddButtonText}>
                                Add to Cart - ${(selectedItemForOptions.price + tempSelectedAddons.reduce((s, a) => s + a.price, 0)).toFixed(2)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageContainer: { width: '100%', height: 260 },
    heroImage: { width: '100%', height: '100%' },
    navOverlay: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 10
    },
    iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    infoSection: { padding: 20 },
    name: { fontSize: 28, fontWeight: 'bold' },
    description: { fontSize: 14, marginTop: 4, lineHeight: 20 },
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
    statValue: { fontSize: 16, fontWeight: 'bold' },
    statLabel: { fontSize: 12, marginTop: 2 },
    divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
    menuSection: { padding: 20 },
    categorySection: { marginBottom: 32 },
    categoryTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    menuItem: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1 },
    itemText: { flex: 1, paddingRight: 16 },
    itemName: { fontSize: 16, fontWeight: '600' },
    itemDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
    itemPrice: { fontSize: 16, fontWeight: 'bold', marginTop: 8 },
    itemAction: { position: 'relative' },
    itemImage: { width: 100, height: 100, borderRadius: 12 },
    addButton: {
        position: 'absolute',
        bottom: -10,
        right: -10,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4
    },
    cartBar: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8
    },
    cartButton: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    cartCount: {
        width: 24,
        height: 24,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    cartCountText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    cartButtonText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    cartTotalText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    
    // Modal Styles
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 16
    },
    modalScroll: {
        marginBottom: 24
    },
    optionsLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1.2,
        marginBottom: 16,
        opacity: 0.6
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1
    },
    optionInfo: {
        flex: 1
    },
    optionName: {
        fontSize: 16,
        fontWeight: '500'
    },
    optionPrice: {
        fontSize: 14,
        marginTop: 2
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalAddButton: {
        borderRadius: 16,
        padding: 18,
        alignItems: 'center'
    },
    modalAddButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },

    // Sticky Header Styles
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    stickyInner: {
        paddingTop: 55,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    stickyContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stickyIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    stickySearchBar: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    stickySearchInput: {
        flex: 1,
        fontSize: 14,
        height: '100%',
        paddingVertical: 0,
    },

    // Inline Search Styles
    inlineSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginTop: 10,
    },
    inlineSearchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    }
});
