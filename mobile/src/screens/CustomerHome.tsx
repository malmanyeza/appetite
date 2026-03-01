import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    FlatList,
    Platform,
    UIManager,
    LayoutAnimation
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Search, MapPin, ChevronRight, Filter } from 'lucide-react-native';
import { Image } from 'expo-image';

export const CustomerHome = ({ navigation }: any) => {
    const { theme, isDark } = useTheme();
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const { data: restaurants, isLoading } = useQuery({
        queryKey: ['restaurants', selectedCategory],
        queryFn: async () => {
            let query = supabase
                .from('restaurants')
                .select('*')
                .eq('is_open', true);

            if (selectedCategory) {
                query = query.contains('categories', [selectedCategory]);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    });

    const filteredRestaurants = React.useMemo(() => {
        if (!restaurants) return [];
        if (!searchQuery) return restaurants;
        return restaurants.filter(r =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.categories.some((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [restaurants, searchQuery]);

    React.useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [filteredRestaurants, selectedCategory]);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header / Location */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.locationLabel, { color: theme.textMuted }]}>Delivering to</Text>
                    <TouchableOpacity style={styles.locationSelector}>
                        <MapPin size={16} color={theme.accent} />
                        <Text style={[styles.locationText, { color: theme.text }]}>Avondale, Harare</Text>
                        <ChevronRight size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.profileButton, { backgroundColor: theme.surface }]}>
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
                    <TouchableOpacity><Text style={{ color: theme.accent }}>View all</Text></TouchableOpacity>
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
                    filteredRestaurants.map((item) => (
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
                                    <Text style={[styles.rating, { color: theme.text }]}>⭐ {item.rating_avg.toFixed(1)}</Text>
                                </View>
                                <Text style={[styles.categories, { color: theme.textMuted }]}>{item.categories.join(' • ')}</Text>
                                <View style={styles.deliveryInfo}>
                                    <Text style={[styles.infoText, { color: theme.textMuted }]}>
                                        {item.avg_prep_time || '20-30 min'} • Free Delivery
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
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
});
