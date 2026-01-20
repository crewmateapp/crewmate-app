// app/(tabs)/plans.tsx - Shows plans from ALL layovers
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import CreatePlanWizard from '@/components/CreatePlanWizard';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    where,
    Timestamp
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

type Layover = {
  id: string;
  city: string;
  area: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: string;
};

type GroupedPlans = {
  [city: string]: {
    layover: Layover | null;
    plans: Plan[];
  };
};

export default function PlansScreen() {
  const { user } = useAuth();
  const { city: cityParam } = useLocalSearchParams<{ city?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [layovers, setLayovers] = useState<Layover[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // Get user's layovers
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const userLayovers: Layover[] = [];
        
        // Add current layover if exists
        if (data.currentLayover?.city) {
          userLayovers.push({
            id: 'current',
            city: data.currentLayover.city,
            area: data.currentLayover.area || '',
            startDate: data.currentLayover.startDate || Timestamp.now(),
            endDate: data.currentLayover.endDate || Timestamp.now(),
            status: 'current',
          });
        }
        
        // Add upcoming layovers
        if (data.upcomingLayovers && Array.isArray(data.upcomingLayovers)) {
          data.upcomingLayovers.forEach((layover: any) => {
            if (layover.city) {
              userLayovers.push({
                id: layover.id,
                city: layover.city,
                area: layover.area || '',
                startDate: layover.startDate,
                endDate: layover.endDate,
                status: layover.status || 'upcoming',
              });
            }
          });
        }

        console.log('📋 User layovers:', userLayovers.map(l => l.city));
        setLayovers(userLayovers);
        
        // Set selected city from URL param if provided, otherwise default to first layover
        if (cityParam && userLayovers.some(l => l.city === cityParam)) {
          console.log('🎯 Setting city from URL param:', cityParam);
          setSelectedCity(cityParam);
        } else if (!selectedCity && userLayovers.length > 0) {
          setSelectedCity(userLayovers[0].city);
        }
      }
    });

    return () => unsubscribe();
  }, [user, cityParam]);

  // Fetch user's plans across ALL their layover cities
  useEffect(() => {
    if (!user?.uid || layovers.length === 0) {
      setMyPlans([]);
      setLoading(false);
      return;
    }

    const cities = [...new Set(layovers.map(l => l.city))]; // Unique cities
    console.log('🔍 Fetching myPlans for cities:', cities);

    // Create a query for each city
    const unsubscribes: (() => void)[] = [];
    const allMyPlans: Plan[] = [];

    cities.forEach(city => {
      const q = query(
        collection(db, 'plans'),
        where('city', '==', city),
        where('status', '==', 'active'),
        orderBy('scheduledTime', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Remove plans from this city
        const filtered = allMyPlans.filter(p => p.city !== city);
        
        // Add new plans from this city
        snapshot.forEach((doc) => {
          const data = doc.data() as Plan;
          // Include if user is host or attendee
          if (data.hostUserId === user.uid || data.attendeeIds.includes(user.uid)) {
            filtered.push({
              id: doc.id,
              ...data,
            });
          }
        });

        // Sort by scheduled time
        filtered.sort((a, b) => {
          const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate().getTime() : 0;
          const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate().getTime() : 0;
          return aTime - bTime;
        });

        console.log('📋 My plans updated, total:', filtered.length);
        setMyPlans([...filtered]);
        setLoading(false);
        setRefreshing(false);
      });

      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, layovers]);

  // Fetch all public plans in user's layover cities
  useEffect(() => {
    if (!user?.uid || layovers.length === 0) {
      setAllPlans([]);
      return;
    }

    const cities = [...new Set(layovers.map(l => l.city))];
    console.log('🔍 Fetching allPlans for cities:', cities);

    const unsubscribes: (() => void)[] = [];
    const allPublicPlans: Plan[] = [];

    cities.forEach(city => {
      const q = query(
        collection(db, 'plans'),
        where('city', '==', city),
        where('status', '==', 'active'),
        orderBy('scheduledTime', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Remove plans from this city
        const filtered = allPublicPlans.filter(p => p.city !== city);
        
        // Add new plans from this city
        snapshot.forEach((doc) => {
          const data = doc.data() as Plan;
          // Exclude plans where user is host or attendee
          if (data.hostUserId !== user.uid && !data.attendeeIds.includes(user.uid)) {
            filtered.push({
              id: doc.id,
              ...data,
            } as Plan);
          }
        });

        // Sort by scheduled time
        filtered.sort((a, b) => {
          const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate().getTime() : 0;
          const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate().getTime() : 0;
          return aTime - bTime;
        });

        console.log('📋 All plans updated, total:', filtered.length);
        setAllPlans([...filtered]);
        setLoading(false);
        setRefreshing(false);
      });

      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, layovers]);

  const handleRefresh = () => {
    setRefreshing(true);
  };

  const handleCreatePlan = () => {
    if (layovers.length === 0) {
      alert('Please add a layover first');
      return;
    }
    setShowCreateWizard(true);
  };

  // Group plans by city
  const groupPlansByCity = (plans: Plan[]): GroupedPlans => {
    const grouped: GroupedPlans = {};
    
    plans.forEach(plan => {
      if (!grouped[plan.city]) {
        grouped[plan.city] = {
          layover: layovers.find(l => l.city === plan.city) || null,
          plans: [],
        };
      }
      grouped[plan.city].plans.push(plan);
    });
    
    return grouped;
  };

  // Filter plans by selected city (if any)
  const getFilteredPlans = (plans: Plan[]) => {
    if (!selectedCity || selectedCity === 'all') return plans;
    return plans.filter(p => p.city === selectedCity);
  };

  if (layovers.length === 0 && !loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="airplane-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No Layovers Yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Add your upcoming layovers to start creating and joining plans with other crew
          </ThemedText>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/')}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <ThemedText style={styles.primaryButtonText}>
              Add Layover
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
  const filteredPlans = getFilteredPlans(displayedPlans);
  const groupedPlans = groupPlansByCity(filteredPlans);
  const cityOptions = ['all', ...new Set(layovers.map(l => l.city))];

  return (
    <ThemedView style={styles.container}>
      {/* City Filter */}
      {layovers.length > 1 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {cityOptions.map((city) => (
            <TouchableOpacity
              key={city}
              style={[
                styles.filterChip,
                selectedCity === city && styles.filterChipActive
              ]}
              onPress={() => setSelectedCity(city)}
            >
              <ThemedText 
                style={[
                  styles.filterChipText,
                  selectedCity === city && styles.filterChipTextActive
                ]}
              >
                {city === 'all' ? 'All Cities' : city}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
        {Object.keys(groupedPlans).length > 0 ? (
          Object.entries(groupedPlans).map(([city, { layover, plans }]) => (
            <View key={city} style={styles.cityGroup}>
              {/* City Header (only show if multiple cities) */}
              {Object.keys(groupedPlans).length > 1 && (
                <View style={styles.cityHeader}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <ThemedText style={styles.cityName}>{city}</ThemedText>
                  {layover && (
                    <ThemedText style={styles.cityDates}>
                      {layover.startDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {layover.endDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </ThemedText>
                  )}
                </View>
              )}
              
              {/* Plans in this city */}
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} showHost={true} />
              ))}
            </View>
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
                ? 'Create a plan or RSVP to join others in your layover cities'
                : 'No one has created plans in these areas yet'
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

      {/* Create Plan Wizard */}
      <CreatePlanWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        layoverCity={selectedCity || undefined}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterScroll: {
    maxHeight: 50,
    marginTop: 12,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
    marginTop: 16,
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
  cityGroup: {
    marginBottom: 24,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cityDates: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginLeft: 'auto',
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
