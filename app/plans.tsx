// app/plans.tsx
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

  // Fetch all public plans in current city
  useEffect(() => {
    if (!currentCity) {
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
        plans.push({
          id: doc.id,
          ...doc.data(),
        } as Plan);
      });
      setAllPlans(plans);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [currentCity]);

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
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Plans</ThemedText>
          <View style={styles.placeholder} />
        </View>

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          <ThemedText style={styles.backText}>Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Plans in {currentCity}</ThemedText>
        <TouchableOpacity 
          style={styles.newButton}
          onPress={handleCreatePlan}
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <ThemedText style={styles.newButtonText}>New</ThemedText>
        </TouchableOpacity>
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  placeholder: {
    width: 70,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
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