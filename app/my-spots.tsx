import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type Spot = {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  description: string;
  createdAt: any;
};

export default function MySpotsScreen() {
  const { user } = useAuth();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpots = async () => {
      if (!user) return;

      try {
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', user.uid),
          where('type', '==', 'spot_added')
        );
        
        const activitiesSnapshot = await getDocs(activitiesQuery);
        const spotIds = activitiesSnapshot.docs.map(doc => doc.data().spotId);

        if (spotIds.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch spot details
        const fetchedSpots: Spot[] = [];
        for (const spotId of spotIds) {
          const spotsQuery = query(
            collection(db, 'spots'),
            where('__name__', '==', spotId)
          );
          const spotSnapshot = await getDocs(spotsQuery);
          
          if (!spotSnapshot.empty) {
            const spotData = spotSnapshot.docs[0].data();
            fetchedSpots.push({
              id: spotSnapshot.docs[0].id,
              ...spotData,
            } as Spot);
          }
        }

        setSpots(fetchedSpots);
      } catch (error) {
        console.error('Error fetching spots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpots();
  }, [user]);

  const renderSpot = ({ item }: { item: Spot }) => (
    <TouchableOpacity
      style={styles.spotCard}
      onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.id } })}
    >
      <View style={styles.spotHeader}>
        <View style={styles.spotTitleContainer}>
          <ThemedText style={styles.spotName}>{item.name}</ThemedText>
          <View style={styles.typeTag}>
            <ThemedText style={styles.typeText}>{item.type}</ThemedText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
      </View>
      
      <View style={styles.spotDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={Colors.text.secondary} />
          <ThemedText style={styles.detailText}>{item.city}</ThemedText>
        </View>
        <ThemedText style={styles.address} numberOfLines={1}>
          {item.address}
        </ThemedText>
      </View>

      {item.description && (
        <ThemedText style={styles.description} numberOfLines={2}>
          {item.description}
        </ThemedText>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>My Spots</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>My Spots</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={spots}
        renderItem={renderSpot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={80} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No spots yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Spots you add will appear here
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  spotCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  spotTitleContainer: {
    flex: 1,
    gap: 8,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  typeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  spotDetails: {
    gap: 4,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  address: {
    fontSize: 13,
    color: Colors.text.secondary,
    paddingLeft: 22,
  },
  description: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});