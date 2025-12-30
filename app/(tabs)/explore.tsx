import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { cities } from '@/data/cities';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity
} from 'react-native';

export default function ExploreScreen() {
  const { city: initialCity } = useLocalSearchParams<{ city?: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-fill search if coming from My Layover with a city
  useEffect(() => {
    if (initialCity && typeof initialCity === 'string') {
      setSearchQuery(initialCity);
    }
  }, [initialCity]);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 30);

    return cities
      .filter((c) => {
        const name = c.name.toLowerCase();
        const airportCode = (c.areas?.[0] ?? '').slice(0, 3).toLowerCase();
        return name.includes(q) || airportCode.startsWith(q);
      })
      .slice(0, 30);
  }, [searchQuery]);

  const handleCityPress = (cityName: string) => {
    router.push({
      pathname: '/city/[name]',
      params: { name: cityName }
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        🌍 Explore
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Discover crew favorites around the world
      </ThemedText>

      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search cities or airport codes..."
        placeholderTextColor={Colors.text.disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filteredCities}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cityCard}
            onPress={() => handleCityPress(item.name)}
          >
            <ThemedText style={styles.cityEmoji}>
              {getCityEmoji(item.name)}
            </ThemedText>
            <ThemedText style={styles.cityName}>{item.name}</ThemedText>
            <ThemedText style={styles.cityAirport}>
              {item.areas[0]?.slice(0, 3) || ''}
            </ThemedText>
          </TouchableOpacity>
        )}
      />
    </ThemedView>
  );
}

const getCityEmoji = (cityName: string): string => {
  const emojiMap: Record<string, string> = {
    'New York': '🗽',
    'Los Angeles': '🌴',
    'Chicago': '🌆',
    'Miami': '🏖️',
    'San Francisco': '🌉',
    'Las Vegas': '🎰',
    'Seattle': '☕',
    'Denver': '🏔️',
    'Atlanta': '🍑',
    'Dallas—Fort Worth': '🤠',
    'Boston': '🦞',
    'Phoenix': '🌵',
    'Orlando': '🏰',
    'Honolulu': '🌺',
    'Paris': '🗼',
    'London': '🎡',
    'Tokyo': '🗾',
    'Sydney': '🦘',
    'Dubai': '🏙️',
    'Amsterdam': '🚲',
    'Rome': '🛕',
    'Barcelona': '⚽',
    'Toronto': '🍁',
    'Singapore': '🦁',
    'Hong Kong': '🏮',
    'Charlotte': '👑',
  };
  return emojiMap[cityName] || '✈️';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: Colors.text.secondary,
  },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  cityCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  cityAirport: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
});
