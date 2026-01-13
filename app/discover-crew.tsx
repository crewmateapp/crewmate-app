// app/discover-crew.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
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

type CrewMember = {
  id: string;
  displayName: string;
  photoURL?: string;
  airline?: string;
  base?: string;
  layover?: {
    startDate: any;
    endDate: any;
    area: string;
  };
  isConnected?: boolean;
  connectionPending?: boolean;
};

type Plan = {
  id: string;
  title: string;
  hostUserId: string;
  hostName: string;
  hostPhoto?: string;
  spotName: string;
  scheduledTime: any;
  attendeeCount: number;
  visibility: string;
  description?: string;
};

export default function DiscoverCrewScreen() {
  const { user } = useAuth();
  const { city, date, layoverId } = useLocalSearchParams<{
    city?: string;
    date?: string;
    layoverId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [publicPlans, setPublicPlans] = useState<Plan[]>([]);
  const [connections, setConnections] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (city && date) {
      fetchData();
    }
  }, [city, date, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCrewMembers(),
        fetchPublicPlans(),
        fetchConnections(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load crew and plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    if (!user?.uid) return;

    try {
      // Get user's connections
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
    if (!city || !date) return;

    try {
      const targetDate = new Date(date);
      
      // Get all users (we'll filter client-side for date matching)
      const usersQuery = query(collection(db, 'users'));
      const usersSnap = await getDocs(usersQuery);
      
      const crew: CrewMember[] = [];

      usersSnap.docs.forEach((userDoc) => {
        // Skip current user
        if (userDoc.id === user?.uid) return;

        const userData = userDoc.data();
        const upcomingLayovers = userData.upcomingLayovers || [];

        // Find matching layover for this city and date
        const matchingLayover = upcomingLayovers.find((layover: any) => {
          if (layover.city !== city) return false;
          
          const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
          const endDate = layover.endDate?.toDate ? layover.endDate.toDate() : new Date(layover.endDate);
          
          // Check if target date falls within layover dates
          return targetDate >= startDate && targetDate <= endDate;
        });

        if (matchingLayover && matchingLayover.preDiscoverable) {
          crew.push({
            id: userDoc.id,
            displayName: userData.displayName || 'Crew Member',
            photoURL: userData.photoURL,
            airline: userData.airline,
            base: userData.base,
            layover: matchingLayover,
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

  const fetchPublicPlans = async () => {
    if (!city || !date) return;

    try {
      const targetDate = new Date(date);
      const dateString = targetDate.toISOString().split('T')[0];

      // Query public plans for this city and date
      const plansQuery = query(
        collection(db, 'plans'),
        where('city', '==', city),
        where('status', '==', 'active'),
        where('visibility', 'in', ['public', 'connections'])
      );

      const plansSnap = await getDocs(plansQuery);
      const plans: Plan[] = [];

      plansSnap.docs.forEach((planDoc) => {
        const planData = planDoc.data();
        const scheduledTime = planData.scheduledTime?.toDate ? 
          planData.scheduledTime.toDate() : 
          new Date(planData.scheduledTime);

        // Check if plan is on the target date
        const planDateString = scheduledTime.toISOString().split('T')[0];
        if (planDateString === dateString) {
          plans.push({
            id: planDoc.id,
            title: planData.title,
            hostUserId: planData.hostUserId,
            hostName: planData.hostName,
            hostPhoto: planData.hostPhoto,
            spotName: planData.spotName,
            scheduledTime: planData.scheduledTime,
            attendeeCount: planData.attendeeCount || 0,
            visibility: planData.visibility,
            description: planData.description,
          });
        }
      });

      // Sort by time
      plans.sort((a, b) => {
        const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
        const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
        return aTime.getTime() - bTime.getTime();
      });

      setPublicPlans(plans);
    } catch (error) {
      console.error('Error fetching public plans:', error);
    }
  };

  const handleConnect = async (crewMember: CrewMember) => {
    if (!user?.uid) return;

    try {
      // Create connection request
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        toUserId: crewMember.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Update local state
      setPendingRequests(prev => new Set([...prev, crewMember.id]));

      Alert.alert('Request Sent!', `Connection request sent to ${crewMember.displayName}`);
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: any) => {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!city || !date) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Find Crew</ThemedText>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.text.secondary} />
            <ThemedText style={styles.errorText}>Missing city or date</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Find Crew</ThemedText>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <ThemedText style={styles.loadingText}>Finding crew...</ThemedText>
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
          <ThemedText style={styles.headerTitle}>Find Crew</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Location & Date */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <ThemedText style={styles.infoText}>{city}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
              <ThemedText style={styles.infoText}>{formatDate(date)}</ThemedText>
            </View>
          </View>

          {/* Crew Members Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                👋 Crew Going ({crewMembers.length})
              </ThemedText>
            </View>

            {crewMembers.length > 0 ? (
              crewMembers.map((member) => (
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
                        <Ionicons name="person" size={24} color={Colors.text.secondary} />
                      </View>
                    )}

                    <View style={styles.crewInfo}>
                      <ThemedText style={styles.crewName}>{member.displayName}</ThemedText>
                      {member.airline && (
                        <ThemedText style={styles.crewDetail}>
                          {member.airline} {member.base ? `• ${member.base}` : ''}
                        </ThemedText>
                      )}
                      {member.layover && (
                        <ThemedText style={styles.crewDetail}>
                          {member.layover.area}
                        </ThemedText>
                      )}
                    </View>
                  </View>

                  <View style={styles.crewActions}>
                    {member.isConnected ? (
                      <View style={styles.connectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
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
                        <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                        <ThemedText style={styles.connectButtonText}>Connect</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>
                  No crew members have added this layover yet
                </ThemedText>
                <ThemedText style={styles.emptyHint}>
                  Be the first! Others will see you here when they check.
                </ThemedText>
              </View>
            )}
          </View>

          {/* Public Plans Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>
                📋 Plans You Can Join ({publicPlans.length})
              </ThemedText>
            </View>

            {publicPlans.length > 0 ? (
              publicPlans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.planCard}
                  onPress={() => router.push(`/plan/${plan.id}`)}
                >
                  <View style={styles.planHeader}>
                    <ThemedText style={styles.planTitle}>{plan.title}</ThemedText>
                    <ThemedText style={styles.planTime}>{formatTime(plan.scheduledTime)}</ThemedText>
                  </View>

                  <View style={styles.planDetails}>
                    <View style={styles.planDetail}>
                      <Ionicons name="location-outline" size={16} color={Colors.text.secondary} />
                      <ThemedText style={styles.planDetailText}>{plan.spotName}</ThemedText>
                    </View>

                    <View style={styles.planDetail}>
                      <Ionicons name="people-outline" size={16} color={Colors.text.secondary} />
                      <ThemedText style={styles.planDetailText}>
                        {plan.attendeeCount} {plan.attendeeCount === 1 ? 'person' : 'people'} going
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.planHost}>
                    {plan.hostPhoto ? (
                      <Image source={{ uri: plan.hostPhoto }} style={styles.hostAvatar} />
                    ) : (
                      <View style={[styles.hostAvatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={12} color={Colors.text.secondary} />
                      </View>
                    )}
                    <ThemedText style={styles.planHostText}>Hosted by {plan.hostName}</ThemedText>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>
                  No public plans yet for this date
                </ThemedText>
                <ThemedText style={styles.emptyHint}>
                  Be the first to create one!
                </ThemedText>
              </View>
            )}
          </View>

          {/* Create Plan Button */}
          {layoverId && (
            <TouchableOpacity
              style={styles.createPlanButton}
              onPress={() => router.push(`/explore?city=${city}&layoverId=${layoverId}`)}
            >
              <Ionicons name="add-circle" size={24} color={Colors.white} />
              <ThemedText style={styles.createPlanButtonText}>Create a Plan</ThemedText>
            </TouchableOpacity>
          )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.primary + '10',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  crewCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  crewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  crewDetail: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  crewActions: {
    alignItems: 'flex-start',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.success + '10',
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.text.secondary + '20',
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  planTime: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  planDetails: {
    gap: 8,
    marginBottom: 12,
  },
  planDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planDetailText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  planHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  planHostText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createPlanButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
