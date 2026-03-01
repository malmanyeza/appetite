import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Keyboard,
    TouchableWithoutFeedback
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme';
import { Search as SearchIcon, X, Filter, ChevronRight } from 'lucide-react-native';
import { Image } from 'expo-image';

export const SearchScreen = ({ navigation }: any) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: results, isLoading } = useQuery({
        queryKey: ['search', searchQuery],
        queryFn: async () => {
            if (!searchQuery.trim()) return [];

            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .or(`name.ilike.%${searchQuery}%,categories.cs.{${searchQuery}}`)
                .eq('is_open', true);

            if (error) throw error;
            return data;
        },
        enabled: searchQuery.length > 2
    });

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={[styles.resultCard, { borderBottomColor: theme.border }]}
            onPress={() => navigation.navigate('RestaurantDetails', { id: item.id })}
        >
            <Image
                source={item.cover_image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                style={styles.resultImage}
                contentFit="cover"
            />
            <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.resultCategories, { color: theme.textMuted }]}>
                    {item.categories.join(' • ')}
                </Text>
                <View style={styles.resultMeta}>
                    <Text style={[styles.resultRating, { color: theme.text }]}>⭐ {item.rating_avg}</Text>
                    <Text style={[styles.resultDot, { color: theme.textMuted }]}>•</Text>
                    <Text style={[styles.resultTime, { color: theme.textMuted }]}>25-35 min</Text>
                </View>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
        </TouchableOpacity>
    );

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.header}>
                    <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
                        <SearchIcon size={20} color={theme.textMuted} />
                        <TextInput
                            placeholder="Search for restaurants or food..."
                            placeholderTextColor={theme.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                            style={[styles.searchInput, { color: theme.text }]}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={20} color={theme.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity style={[styles.filterButton, { backgroundColor: theme.surface }]}>
                        <Filter size={20} color={theme.accent} />
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator color={theme.accent} size="large" />
                    </View>
                ) : results && results.length > 0 ? (
                    <FlatList
                        data={results}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    />
                ) : searchQuery.length > 2 ? (
                    <View style={styles.centerContainer}>
                        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                            No restaurants found for "{searchQuery}"
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.centerContainer, { paddingHorizontal: 40 }]}>
                        <SearchIcon size={64} color={theme.surface} style={{ marginBottom: 16 }} />
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Search Appetite</Text>
                        <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                            Find your favorite restaurants, cuisines, or specific dishes.
                        </Text>
                    </View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 12,
        gap: 12,
    },
    searchInput: { flex: 1, fontSize: 16 },
    filterButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: { paddingHorizontal: 20, paddingTop: 10 },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    resultImage: { width: 60, height: 60, borderRadius: 12 },
    resultInfo: { flex: 1, marginLeft: 16, gap: 2 },
    resultName: { fontSize: 16, fontWeight: 'bold' },
    resultCategories: { fontSize: 13 },
    resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    resultRating: { fontSize: 12, fontWeight: 'bold' },
    resultDot: { fontSize: 12 },
    resultTime: { fontSize: 12 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 16, textAlign: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 16, textAlign: 'center' },
});
