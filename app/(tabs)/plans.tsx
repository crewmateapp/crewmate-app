// app/(tabs)/plans.tsx
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

type TabType = 'my' | 'all';

export default function PlansScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [currentCity, setCurrentCity] = useState<string | null>(null);

  // Get user's current layover city
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentCity(data.currentLayover?.city || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch user's plans (hosting or attending)
  useEffect(() => {
    if (!user || !currentCity) {
      setMyPlans([]);
      return;
    }

    const q = query(
      collection(db, 'plans'),
      where('city', '==', currentCity),
      where('status', '==', 'active'),
      orderBy('scheduledTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plans: Plan[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Plan;
        // Include if user is host or attendee
        if (data.hostUserId === user.uid || data.attendeeIds.includes(user.uid)) {
          plans.push({
            id: doc.id,
            ...data,
          });
        }
      });
      setMyPlans(plans);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [user, currentCity]);

  // Fetch all public plans in current city (excluding user's plans)
  useEffect(() => {
    if (!currentCity || !user) {
      setAllPlans([]);
      return;
    }

    const q = query(
      collection(db, 'plans'),
      where('city', '==', currentCity),
      where('status', '==', 'active'),
      orderBy('scheduledTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plans: Plan[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Plan;
        // Exclude plans where user is host or attendee
        if (data.hostUserId !== user.uid && !data.attendeeIds.includes(user.uid)) {
          plans.push({
            id: doc.id,
            ...data,
          } as Plan);
        }
      });
      setAllPlans(plans);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [currentCity, user]);

  const handleRefresh = () => {
    setRefreshing(true);
  };

  const handleCreatePlan = () => {
    if (!currentCity) {
      alert('Please set your layover location first');
      return;
    }
    router.push('/create-plan');
  };

  if (!currentCity) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No Layover Set</ThemedText>
          <ThemedText style={styles.emptyText}>
            Set your layover location to view and create plans
          </ThemedText>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/')}
          >
            <ThemedText style={styles.primaryButtonText}>
              Go to My Layover
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  const displayedPlans = activeTab === 'my' ? myPlans : allPlans;

  return (
    <ThemedView style={styles.container}>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Plans ({myPlans.length})
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              Happening Now ({allPlans.length})
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Plans List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {displayedPlans.length > 0 ? (
            displayedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} showHost={true} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'my' ? 'calendar-outline' : 'search-outline'} 
                size={80} 
                color={Colors.text.secondary} 
              />
              <ThemedText style={styles.emptyTitle}>
                {activeTab === 'my' ? 'No Plans Yet' : 'No Plans Happening'}
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                {activeTab === 'my' 
                  ? 'Create a plan or RSVP to join others'
                  : 'No one has created plans in this area yet'
                }
              </ThemedText>
              {activeTab === 'my' && (
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={handleCreatePlan}
                >
                  <Ionicons name="add" size={20} color={Colors.white} />
                  <ThemedText style={styles.primaryButtonText}>
                    Create Plan
                  </ThemedText>
                </TouchableOpacity>
              )}
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.text.primary,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
