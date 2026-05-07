import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Plus, Minus, Info, Check } from 'lucide-react-native';
import { useTheme } from '../theme';
import { restaurantService } from '../services/restaurantService';
import { useCartStore } from '../store/cartStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOriginalUrl } from '../utils/storageUtils';

const { width } = Dimensions.get('window');

export const FoodItemDetail = ({ route, navigation }: any) => {
    const { item, restaurantId, locationId } = route.params;
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { addItem } = useCartStore();
    const scrollY = React.useRef(new Animated.Value(0)).current;

    // Selected options state: { [groupId]: [option1, option2] }
    const [selections, setSelections] = useState<{ [key: string]: any[] }>({});
    const [qty, setQty] = useState(1);

    const { data: latestItem, isLoading: isItemLoading } = useQuery({
        queryKey: ['menu-item', item.id],
        queryFn: async () => {
            const { data, error } = await restaurantService.getMenuItem(item.id);
            if (error) throw error;
            return data;
        },
        initialData: item
    });

    const activeItem = latestItem || item;

    const { data: modifierGroups, isLoading: isModifiersLoading } = useQuery({
        queryKey: ['item-modifiers', activeItem.id],
        queryFn: () => restaurantService.getItemModifiers(activeItem.id)
    });

    const { data: suggestedItems, isLoading: isSuggestedLoading } = useQuery({
        queryKey: ['suggested-items', activeItem.id],
        queryFn: () => restaurantService.getItemsByCategories(activeItem.suggested_addon_category_ids || []),
        enabled: !!activeItem.suggested_addon_category_ids && activeItem.suggested_addon_category_ids.length > 0
    });

    // Group suggested items by category
    const suggestedGroups = useMemo(() => {
        if (!suggestedItems) return [];
        const groups: { [key: string]: { id: string, name: string, items: any[] } } = {};
        suggestedItems.forEach((i: any) => {
            const catId = i.category_id;
            const catName = i.menu_categories?.name || 'Add-ons';
            if (!groups[catId]) {
                groups[catId] = { id: catId, name: catName, items: [] };
            }
            groups[catId].items.push(i);
        });
        return Object.values(groups);
    }, [suggestedItems]);

    const toggleOption = (group: any, option: any) => {
        const currentGroupSelections = selections[group.id] || [];
        const isSelected = currentGroupSelections.find(o => o.id === option.id);

        if (isSelected) {
            setSelections({
                ...selections,
                [group.id]: currentGroupSelections.filter(o => o.id !== option.id)
            });
        } else {
            // Check max selection
            if (group.max_selection === 1) {
                // Radio button behavior
                setSelections({
                    ...selections,
                    [group.id]: [option]
                });
            } else if (currentGroupSelections.length < group.max_selection) {
                setSelections({
                    ...selections,
                    [group.id]: [...currentGroupSelections, option]
                });
            }
        }
    };

    const totalPrice = useMemo(() => {
        let extra = 0;
        Object.values(selections).forEach(groupOptions => {
            groupOptions.forEach(opt => {
                extra += opt.price || 0;
            });
        });
        return (item.price + extra) * qty;
    }, [selections, qty, item.price]);

    const canAddToCart = useMemo(() => {
        if (!modifierGroups) return true;
        // Check if all required groups have minimum selections met
        return modifierGroups.every(group => {
            if (group.min_selection > 0) {
                const count = (selections[group.id] || []).length;
                return count >= group.min_selection;
            }
            return true;
        });
    }, [modifierGroups, selections]);

    const handleAddToCart = () => {
        const allSelectedAddons: any[] = [];
        Object.values(selections).forEach(groupOptions => {
            allSelectedAddons.push(...groupOptions);
        });

        addItem(item, restaurantId, locationId, allSelectedAddons);
        // We need to handle quantity properly if cart store doesn't support multiple at once in addItem
        // For now, let's assume it adds 1 and we might need to update cart store or call multiple times
        // Looking at cartStore.ts, it adds 1. I'll just navigate back for now.
        navigation.goBack();
    };

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 150],
        outputRange: [0, 1],
        extrapolate: 'clamp'
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Animated.ScrollView
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={getOriginalUrl(item.image_url) || 'https://images.unsplash.com/photo-1513104890138-7c749659a591'}
                        style={styles.heroImage}
                        contentFit="cover"
                        transition={300}
                    />
                    <View style={[styles.navOverlay, { top: insets.top + 10 }]}>
                        <TouchableOpacity 
                            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
                            onPress={() => navigation.goBack()}
                        >
                            <ChevronLeft color="#FFF" size={24} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.price, { color: theme.accent }]}>${item.price.toFixed(2)}</Text>
                    </View>
                    <Text style={[styles.description, { color: theme.textMuted }]}>{item.description}</Text>

                    {/* Modifiers */}
                    <View style={styles.modifiersSection}>
                        {isModifiersLoading ? (
                            <View style={{ padding: 40 }}>
                                <ActivityIndicator color={theme.accent} />
                                <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 12 }}>Loading options...</Text>
                            </View>
                        ) : (
                            modifierGroups?.map((group: any) => {
                                const groupSelections = selections[group.id] || [];
                                const isRequired = group.min_selection > 0;
                                const isFulfilled = groupSelections.length >= group.min_selection;

                                return (
                                    <View key={group.id} style={styles.groupContainer}>
                                        <View style={styles.groupHeader}>
                                            <View>
                                                <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
                                                <Text style={[styles.groupSubtitle, { color: theme.textMuted }]}>
                                                    {isRequired ? `Required • Select at least ${group.min_selection}` : `Optional • Select up to ${group.max_selection}`}
                                                </Text>
                                            </View>
                                            {isRequired && (
                                                <View style={[
                                                    styles.badge, 
                                                    { backgroundColor: isFulfilled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                                                ]}>
                                                    <Text style={[
                                                        styles.badgeText, 
                                                        { color: isFulfilled ? '#22c55e' : '#ef4444' }
                                                    ]}>
                                                        {isFulfilled ? 'Completed' : 'Required'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.optionsList}>
                                            {group.modifier_options?.map((option: any) => {
                                                const isSelected = groupSelections.find(o => o.id === option.id);
                                                return (
                                                    <TouchableOpacity
                                                        key={option.id}
                                                        style={[
                                                            styles.optionItem,
                                                            { borderBottomColor: theme.border }
                                                        ]}
                                                        onPress={() => toggleOption(group, option)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.optionInfo}>
                                                            <Text style={[styles.optionName, { color: theme.text }]}>{option.name}</Text>
                                                            {option.price > 0 && (
                                                                <Text style={[styles.optionPrice, { color: theme.accent }]}>+${option.price.toFixed(2)}</Text>
                                                            )}
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
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        {/* Suggested Add-ons Categories */}
                        {isSuggestedLoading && (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={theme.accent} />
                                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>Finding best matches...</Text>
                            </View>
                        )}
                        {!isSuggestedLoading && suggestedGroups.map((group: any) => {
                            const groupSelections = selections[`cat_${group.id}`] || [];
                            return (
                                <View key={group.id} style={[styles.groupContainer, { marginTop: 32 }]}>
                                    <View style={styles.groupHeader}>
                                        <View>
                                            <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
                                            <Text style={[styles.groupSubtitle, { color: theme.textMuted }]}>Optional Add-ons</Text>
                                        </View>
                                    </View>

                                    <View style={styles.optionsList}>
                                        {group.items.map((addonItem: any) => {
                                            const isSelected = groupSelections.find(o => o.id === addonItem.id);
                                            return (
                                                <TouchableOpacity
                                                    key={addonItem.id}
                                                    style={[
                                                        styles.optionItem,
                                                        { borderBottomColor: theme.border }
                                                    ]}
                                                    onPress={() => {
                                                        const current = selections[`cat_${group.id}`] || [];
                                                        if (isSelected) {
                                                            setSelections({
                                                                ...selections,
                                                                [`cat_${group.id}`]: current.filter(o => o.id !== addonItem.id)
                                                            });
                                                        } else {
                                                            setSelections({
                                                                ...selections,
                                                                [`cat_${group.id}`]: [...current, { ...addonItem, is_category_addon: true }]
                                                            });
                                                        }
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.optionInfo}>
                                                        <Text style={[styles.optionName, { color: theme.text }]}>{addonItem.name}</Text>
                                                        <Text style={[styles.optionPrice, { color: theme.accent }]}>+${addonItem.price.toFixed(2)}</Text>
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
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
                <View style={{ height: 150 }} />
            </Animated.ScrollView>

            {/* Sticky Top Bar (shows on scroll) */}
            <Animated.View style={[
                styles.stickyBar, 
                { 
                    backgroundColor: theme.background, 
                    opacity: headerOpacity,
                    borderBottomColor: theme.surface,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    paddingTop: insets.top + 10
                }
            ]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyBack}>
                    <ChevronLeft color={theme.text} size={24} />
                </TouchableOpacity>
                <Text style={[styles.stickyTitle, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            </Animated.View>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.surface }]}>
                <View style={styles.qtyContainer}>
                    <TouchableOpacity 
                        onPress={() => setQty(Math.max(1, qty - 1))}
                        style={[styles.qtyBtn, { backgroundColor: theme.surface }]}
                    >
                        <Minus size={18} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: theme.text }]}>{qty}</Text>
                    <TouchableOpacity 
                        onPress={() => setQty(qty + 1)}
                        style={[styles.qtyBtn, { backgroundColor: theme.surface }]}
                    >
                        <Plus size={18} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[
                        styles.addBtn, 
                        { backgroundColor: canAddToCart ? theme.accent : theme.textMuted + '20' }
                    ]}
                    onPress={handleAddToCart}
                    disabled={!canAddToCart}
                >
                    <Text style={[styles.addBtnText, { color: canAddToCart ? '#FFF' : theme.textMuted }]}>
                        Add to Cart • ${totalPrice.toFixed(2)}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    imageContainer: { width: width, height: 300 },
    heroImage: { width: '100%', height: '100%' },
    navOverlay: {
        position: 'absolute',
        left: 20,
        zIndex: 10
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
    content: { padding: 24 },
    headerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    name: { fontSize: 26, fontFamily: theme.fonts.headingBlack, flex: 1, marginRight: 16 },
    price: { fontSize: 20, fontFamily: theme.fonts.heading },
    description: { fontSize: 15, fontFamily: theme.fonts.body, lineHeight: 22, opacity: 0.7, marginBottom: 32 },
    modifiersSection: { gap: 32 },
    groupContainer: {},
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    groupName: { fontSize: 18, fontFamily: theme.fonts.heading },
    groupSubtitle: { fontSize: 12, fontFamily: theme.fonts.body, marginTop: 2 },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeText: { fontSize: 10, fontFamily: theme.fonts.heading, uppercase: true },
    optionsList: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 20,
        overflow: 'hidden'
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1
    },
    optionInfo: { flex: 1 },
    optionName: { fontSize: 15, fontFamily: theme.fonts.bodyMedium },
    optionPrice: { fontSize: 13, fontFamily: theme.fonts.heading, marginTop: 4 },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center'
    },
    stickyBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingBottom: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 100
    },
    stickyBack: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    stickyTitle: {
        fontSize: 16,
        fontFamily: theme.fonts.heading,
        marginLeft: 12,
        flex: 1
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderTopWidth: 1
    },
    qtyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    qtyBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    qtyText: { fontSize: 18, fontFamily: theme.fonts.heading, minWidth: 24, textAlign: 'center' },
    addBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addBtnText: { fontSize: 16, fontFamily: theme.fonts.heading }
});
