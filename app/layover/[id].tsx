// app/layover/[id].tsx
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Layover = {
  id: string;
  city: string;
  area: string;
  startDate: any;
  endDate: any;
  status: string;
  preDiscoverable?: boolean;
};

type CrewMember = {
  id: string;
  displayName: string;
  photoURL?: string;
  airline?: string;
  base?: string;
  isConnected?: boolean;
  connectionPending?: boolean;
};

export default function LayoverDetailScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [layover, setLayover] = useState<Layover | null>(null);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [connections, setConnections] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id && user) {
      fetchLayoverData();
    }
  }, [id, user]);

  const fetchLayoverData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLayover(),
        fetchMyPlans(),
        fetchConnections(),
      ]);
      // Fetch crew after we have layover data
      await fetchCrewMembers();
    } catch (error) {
      console.error('Error fetching layover data:', error);
      Alert.alert('Error', 'Failed to load layover details');
    } finally {
      setLoading(false);
    }
  };

  const fetchLayover = async () => {
    if (!user?.uid) return;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const upcomingLayovers = data.upcomingLayovers || [];
      const found = upcomingLayovers.find((l: Layover) => l.id === id);
      
      if (found) {
        setLayover(found);
      } else {
        Alert.alert('Not Found', 'Layover not found');
        router.back();
      }
    }
  };

  const fetchMyPlans = async () => {
    if (!user?.uid) return;

    try {
      // Get all plans where user is host and layoverId matches
      const plansQuery = query(
        collection(db, 'plans'),
        where('hostUserId', '==', user.uid),
        where('layoverId', '==', id),
        where('status', '==', 'active')
      );

      const plansSnap = await getDocs(plansQuery);
      const plans: Plan[] = plansSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Plan));

      // Sort by scheduled time
      plans.sort((a, b) => {
        const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
        const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
        return aTime.getTime() - bTime.getTime();
      });

      setMyPlans(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchConnections = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const connectedIds = new Set(userData.connections || []);
        setConnections(connectedIds);

        // Get pending requests
        const pendingQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        const pending = new Set(pendingSnap.docs.map(doc => doc.data().toUserId));
        setPendingRequests(pending);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const fetchCrewMembers = async () => {
    if (!layover) return;

    try {
      const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
      const endDate = layover.endDate?.toDate ? layover.endDate.toDate() : new Date(layover.endDate);

      const usersQuery = query(collection(db, 'users'));
      const usersSnap = await getDocs(usersQuery);
      
      const crew: CrewMember[] = [];

      usersSnap.docs.forEach((userDoc) => {
        if (userDoc.id === user?.uid) return;

        const userData = userDoc.data();
        const upcomingLayovers = userData.upcomingLayovers || [];

        const matchingLayover = upcomingLayovers.find((l: any) => {
          if (l.city !== layover.city) return false;
          
          const lStart = l.startDate?.toDate ? l.startDate.toDate() : new Date(l.startDate);
          const lEnd = l.endDate?.toDate ? l.endDate.toDate() : new Date(l.endDate);
          
          // Check for date overlap
          return (lStart <= endDate && lEnd >= startDate);
        });

        if (matchingLayover && matchingLayover.preDiscoverable) {
          crew.push({
            id: userDoc.id,
            displayName: userData.displayName || 'Crew Member',
            photoURL: userData.photoURL,
            airline: userData.airline,
            base: userData.base,
            isConnected: connections.has(userDoc.id),
            connectionPending: pendingRequests.has(userDoc.id),
          });
        }
      });

      setCrewMembers(crew);
    } catch (error) {
      console.error('Error fetching crew members:', error);
    }
  };

  const handleConnect = async (crewMember: CrewMember) => {
    if (!user?.uid) return;

    try {
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        toUserId: crewMember.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setPendingRequests(prev => new Set([...prev, crewMember.id]));
      Alert.alert('Request Sent!', `Connection request sent to ${crewMember.displayName}`);
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const formatDateRange = (startDate: any, endDate: any) => {
    const start = startDate?.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
    
    const startStr = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (start.toDateString() === end.toDateString()) {
      return startStr;
    }
    
    const endStr = end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    
    return `${startStr} - ${endStr}`;
  };

  const getDaysUntil = () => {
    if (!layover) return '';
    const date = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return 'Past';
    return `${diff} days away`;
  };

  if (loading || !layover) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Layover Info Card */}
          <View style={styles.layoverCard}>
            <View style={styles.layoverIcon}>
              <Ionicons name="airplane" size={32} color={Colors.primary} />
            </View>
            
            <ThemedText style={styles.cityName}>{layover.city}</ThemedText>
            <ThemedText style={styles.areaName}>{layover.area}</ThemedText>
            <ThemedText style={styles.dates}>
              {formatDateRange(layover.startDate, layover.endDate)}
            </ThemedText>
            
            <View style={styles.countdownBadge}>
              <ThemedText style={styles.countdownText}>{getDaysUntil()}</ThemedText>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/explore?city=${layover.city}&layoverId=${layover.id}`)}
            >
              <Ionicons name="add-circle" size={24} color={Colors.white} />
              <ThemedText style={styles.actionButtonText}>Add Plan</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => {
                const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
                router.push(`/discover-crew?city=${layover.city}&date=${startDate.toISOString()}&layoverId=${layover.id}`);
              }}
            >
              <Ionicons name="people" size={24} color={Colors.primary} />
              <ThemedText style={styles.actionButtonTextSecondary}>Find Crew</ThemedText>
            </TouchableOpacity>
          </View>

          {/* My Plans Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>📋 My Plans ({myPlans.length})</ThemedText>
            </View>

            {myPlans.length > 0 ? (
              myPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No plans yet</ThemedText>
                <ThemedText style={styles.emptyHint}>
                  Tap "Add Plan" above to create one
                </ThemedText>
              </View>
            )}
          </View>

          {/* Crew Going Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>👋 Crew Going ({crewMembers.length})</ThemedText>
            </View>

            {crewMembers.length > 0 ? (
              crewMembers.slice(0, 5).map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.crewCard}
                  onPress={() => router.push(`/profile/${member.id}`)}
                >
                  <View style={styles.crewCardContent}>
                    {member.photoURL ? (
                      <Image source={{ uri: member.photoURL }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={20} color={Colors.text.secondary} />
                      </View>
                    )}

                    <View style={styles.crewInfo}>
                      <ThemedText style={styles.crewName}>{member.displayName}</ThemedText>
                      {member.airline && (
                        <ThemedText style={styles.crewDetail}>
                          {member.airline} {member.base ? `• ${member.base}` : ''}
                        </ThemedText>
                      )}
                    </View>
                  </View>

                  {member.isConnected ? (
                    <View style={styles.connectedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <ThemedText style={styles.connectedText}>Connected</ThemedText>
                    </View>
                  ) : member.connectionPending ? (
                    <View style={styles.pendingBadge}>
                      <ThemedText style={styles.pendingText}>Pending</ThemedText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleConnect(member);
                      }}
                    >
                      <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No crew found yet</ThemedText>
                <ThemedText style={styles.emptyHint}>
                  Others will appear here as they add this layover
                </ThemedText>
              </View>
            )}

            {crewMembers.length > 5 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => {
                  const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
                  router.push(`/discover-crew?city=${layover.city}&date=${startDate.toISOString()}&layoverId=${layover.id}`);
                }}
              >
                <ThemedText style={styles.viewAllText}>
                  View All {crewMembers.length} Crew Members
                </ThemedText>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  layoverCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  layoverIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cityName: {
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 6,
  },
  areaName: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  dates: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  countdownBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonTextSecondary: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  crewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  crewDetail: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  connectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.success + '10',
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.text.secondary + '20',
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});
