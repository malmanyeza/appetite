import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { ChevronLeft, Share2, Info, Plus, Minus, X, Check, MapPin } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useCartStore } from '../store/cartStore';

export const RestaurantDetails = ({ route, navigation }: any) => {
    const { id } = route.params;
    const { theme } = useTheme();
    const { addItem, items: cartItems } = useCartStore();

    const [selectedItemForOptions, setSelectedItemForOptions] = useState<any>(null);
    const [tempSelectedAddons, setTempSelectedAddons] = useState<any[]>([]);

    const { data: locationData, isLoading: loadingLoc, refetch: refetchLoc, isRefetching: isRefetchingLoc } = useQuery({
        queryKey: ['location', id],
        queryFn: async () => {
            const { data, error } = await supabase.from('restaurant_locations').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        }
    });

    const restaurantId = locationData?.restaurant_id;

    const { data: restaurant, isLoading: loadingRest, refetch: refetchRest, isRefetching: isRefetchingRest } = useQuery({
        queryKey: ['restaurant', restaurantId],
        queryFn: async () => {
            const { data, error } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!restaurantId
    });

    const { data: menu, isLoading: loadingMenu, refetch: refetchMenu, isRefetching: isRefetchingMenu } = useQuery({
        queryKey: ['menu', restaurantId, id],
        queryFn: async () => {
            // Get all items
            const { data: items, error: mError } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('is_available', true)
                .order('category');
            if (mError) throw mError;

            // Get location-specific availability
            const { data: availability, error: aError } = await supabase
                .from('location_menu_items')
                .select('menu_item_id, is_available')
                .eq('location_id', id);
            
            if (aError) throw aError;

            // Filter out items that are explicitly set to unavailable for this location
            return items.filter(item => {
                const setting = availability?.find(a => a.menu_item_id === item.id);
                return setting ? setting.is_available : true;
            });
        },
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

    if (loadingRest || loadingMenu || loadingLoc) return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} size="large" />
        </View>
    );

    const categories = Array.from(new Set(menu?.map((i: any) => i.category))) as string[];

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
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
                        source={restaurant.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                        style={styles.heroImage}
                        contentFit="cover"
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
                    <Text style={[styles.name, { color: theme.text }]}>{restaurant.name}</Text>
                    <Text style={[styles.description, { color: theme.textMuted }]}>{restaurant.description}</Text>

                    {locationData && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.surface, borderRadius: 12, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MapPin size={14} color={theme.accent} />
                                <Text style={{ color: theme.text, fontSize: 13, fontWeight: 'bold' }}>{locationData.location_name}</Text>
                            </View>
                            <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 20 }}>{locationData.physical_address || `${locationData.suburb}, ${locationData.city}`}</Text>
                            {(locationData.phone || locationData.email) && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4, marginLeft: 20 }}>
                                    {locationData.phone && <Text style={{ color: theme.accent, fontSize: 12 }}>📞 {locationData.phone}</Text>}
                                    {locationData.email && <Text style={{ color: theme.accent, fontSize: 12 }}>✉️ {locationData.email}</Text>}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: theme.text }]}>⭐ {restaurant.rating_avg}</Text>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{restaurant.rating_count}+ ratings</Text>
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

                {/* Menu */}
                <View style={styles.menuSection}>
                    {categories.map((cat: string) => (
                        <View key={cat} style={styles.categorySection}>
                            <Text style={[styles.categoryTitle, { color: theme.text }]}>{cat}</Text>
                            {menu?.filter((i: any) => i.category === cat).map((item: any) => (
                                <View key={item.id} style={[styles.menuItem, { borderBottomColor: theme.border }]}>
                                    <View style={styles.itemText}>
                                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                                        <Text style={[styles.itemDesc, { color: theme.textMuted }]} numberOfLines={2}>{item.description}</Text>
                                        <Text style={[styles.itemPrice, { color: theme.accent }]}>${item.price}</Text>
                                    </View>
                                    <View style={styles.itemAction}>
                                        {item.image_url && <Image source={item.image_url} style={styles.itemImage} contentFit="cover" />}
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
                    ))}
                </View>
                <View style={{ height: 120 }} />
            </ScrollView>

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
        paddingHorizontal: 20
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
    }
});
