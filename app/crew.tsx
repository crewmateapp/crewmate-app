// app/crew.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

type CrewMember = {
  id: string;
  displayName: string;
  photoURL: string | null;
  airline: string | null;
  position: string | null;
  currentLayover: {
    city: string;
    area: string;
    discoverable: boolean;
    isLive: boolean;
  } | null;
};

export default function CrewScreen() {
  const { user } = useAuth();
  const { filter } = useLocalSearchParams<{ filter?: 'live' | 'nearby' }>();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLayover, setMyLayover] = useState<any>(null);

  // Get user's layover
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setMyLayover(docSnap.data()?.currentLayover);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch crew members
  useEffect(() => {
    if (!user || !myLayover) {
      setLoading(false);
      return;
    }

    let q;

    if (filter === 'live') {
      // Same area + discoverable + live
      q = query(
        collection(db, 'users'),
        where('currentLayover.city', '==', myLayover.city),
        where('currentLayover.area', '==', myLayover.area),
        where('currentLayover.discoverable', '==', true),
        where('currentLayover.isLive', '==', true)
      );
    } else {
      // Same city + discoverable + live (nearby)
      q = query(
        collection(db, 'users'),
        where('currentLayover.city', '==', myLayover.city),
        where('currentLayover.discoverable', '==', true),
        where('currentLayover.isLive', '==', true)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: CrewMember[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== user.uid) { // Exclude self from list
          members.push({
            id: doc.id,
            ...doc.data(),
          } as CrewMember);
        }
      });
      setCrew(members);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, myLayover, filter]);

  const handleCrewPress = (crewId: string) => {
    // Navigate to crew profile or send connection request
    router.push(`/profile/${crewId}`);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  // Check if user is live before showing crew
  if (myLayover && !myLayover.isLive) {
    return (
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>
            {filter === 'live' ? 'Live Crew' : 'Crew Nearby'}
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.verifyContainer}>
          <Ionicons name="location-outline" size={80} color={Colors.warning} />
          <ThemedText style={styles.verifyTitle}>Verify Your Location</ThemedText>
          <ThemedText style={styles.verifyText}>
            Go live from your layover page to see and connect with crew nearby.
          </ThemedText>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
            <ThemedText style={styles.goBackText}>Back to My Layover</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          <ThemedText style={styles.backText}>Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {filter === 'live' ? 'In Your Area' : `Crew in ${myLayover?.city}`}
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!myLayover ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyText}>Set Your Layover First</ThemedText>
            <ThemedText style={styles.emptyHint}>
              Check in to see crew in your area
            </ThemedText>
          </View>
        ) : crew.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={filter === 'live' ? 'checkmark-circle' : 'location'} 
              size={64} 
              color={Colors.primary} 
            />
            <ThemedText style={styles.emptyText}>
              {filter === 'live' ? "You're Live!" : "You're Here!"}
            </ThemedText>
            <ThemedText style={styles.emptyHint}>
              {filter === 'live' 
                ? `No other crew live in ${myLayover.area} right now. Check back later!`
                : `No other crew live in ${myLayover.city} at the moment. Be the first!`
              }
            </ThemedText>
          </View>
        ) : (
          <View style={styles.crewList}>
            <ThemedText style={styles.listTitle}>
              {crew.length} {crew.length === 1 ? 'crew member' : 'crew members'} {filter === 'live' ? 'in your area' : 'in your city'}
            </ThemedText>

            {crew.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.crewCard}
                onPress={() => handleCrewPress(member.id)}
              >
                <View style={styles.crewContent}>
                  {member.photoURL ? (
                    <Image source={{ uri: member.photoURL }} style={styles.crewAvatar} />
                  ) : (
                    <View style={styles.crewAvatarFallback}>
                      <ThemedText style={styles.crewAvatarText}>
                        {member.displayName.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.crewInfo}>
                    <ThemedText style={styles.crewName}>{member.displayName}</ThemedText>
                    
                    {member.position && member.airline && (
                      <ThemedText style={styles.crewPosition}>
                        {member.position} • {member.airline}
                      </ThemedText>
                    )}

                    {member.currentLayover && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color={Colors.success} />
                        <ThemedText style={styles.crewLocation}>
                          Live in {member.currentLayover.area}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  verifyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  verifyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  goBackText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  crewList: {
    gap: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  crewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  crewAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  crewAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  crewInfo: {
    flex: 1,
    gap: 4,
  },
  crewName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  crewPosition: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crewLocation: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },
});
