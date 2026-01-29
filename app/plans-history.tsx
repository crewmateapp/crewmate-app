import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';

interface Plan {
  id: string;
  title: string;
  description: string;
  hostUserId: string;
  hostName: string;
  hostPhotoURL: string;
  city: string;
  state: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: {
    name: string;
    address: string;
  };
  attendeeIds: string[];
  attendees: Array<{
    userId: string;
    name: string;
    photoURL: string;
  }>;
  isPast: boolean;
}

export default function PlansHistoryScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [hostedPlans, setHostedPlans] = useState<Plan[]>([]);
  const [attendedPlans, setAttendedPlans] = useState<Plan[]>([]);
  const [activeTab, setActiveTab] = useState<'hosted' | 'attended'>('hosted');
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    loadPlans();
  }, [userId]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const targetUserId = userId ? String(userId) : currentUser.uid;
      setIsOwnProfile(targetUserId === currentUser.uid);

      // Get user info
      const userDoc = await getDoc(doc(db, 'users', targetUserId));
      if (userDoc.exists()) {
        setViewingUser({ id: userDoc.id, ...userDoc.data() });
      }

      const now = new Date();

      // Get hosted plans
      const hostedQuery = query(
        collection(db, 'plans'),
        where('hostUserId', '==', targetUserId),
        orderBy('date', 'desc')
      );
      const hostedSnapshot = await getDocs(hostedQuery);
      const hosted = await Promise.all(
        hostedSnapshot.docs.map(async (planDoc) => {
          const data = planDoc.data();
          const planDate = data.date?.toDate() || new Date();
          
          // Get attendee details
          const attendees = await Promise.all(
            (data.attendeeIds || []).map(async (attendeeId: string) => {
              const attendeeDoc = await getDoc(doc(db, 'users', attendeeId));
              if (attendeeDoc.exists()) {
                const attendeeData = attendeeDoc.data();
                return {
                  userId: attendeeId,
                  name: attendeeData.name || 'Unknown',
                  photoURL: attendeeData.photoURL || '',
                };
              }
              return null;
            })
          );

          return {
            id: planDoc.id,
            ...data,
            date: planDate,
            attendees: attendees.filter(Boolean),
            isPast: planDate < now,
          } as Plan;
        })
      );
      setHostedPlans(hosted);

      // Get attended plans (where user is in attendeeIds but not host)
      const attendedQuery = query(
        collection(db, 'plans'),
        where('attendeeIds', 'array-contains', targetUserId),
        orderBy('date', 'desc')
      );
      const attendedSnapshot = await getDocs(attendedQuery);
      const attended = await Promise.all(
        attendedSnapshot.docs
          .filter((planDoc) => planDoc.data().hostUserId !== targetUserId)
          .map(async (planDoc) => {
            const data = planDoc.data();
            const planDate = data.date?.toDate() || new Date();

            // Get host details
            const hostDoc = await getDoc(doc(db, 'users', data.hostUserId));
            let hostName = 'Unknown';
            let hostPhotoURL = '';
            if (hostDoc.exists()) {
              const hostData = hostDoc.data();
              hostName = hostData.name || 'Unknown';
              hostPhotoURL = hostData.photoURL || '';
            }

            // Get attendee details
            const attendees = await Promise.all(
              (data.attendeeIds || []).map(async (attendeeId: string) => {
                const attendeeDoc = await getDoc(doc(db, 'users', attendeeId));
                if (attendeeDoc.exists()) {
                  const attendeeData = attendeeDoc.data();
                  return {
                    userId: attendeeId,
                    name: attendeeData.name || 'Unknown',
                    photoURL: attendeeData.photoURL || '',
                  };
                }
                return null;
              })
            );

            return {
              id: planDoc.id,
              ...data,
              hostName,
              hostPhotoURL,
              date: planDate,
              attendees: attendees.filter(Boolean),
              isPast: planDate < now,
            } as Plan;
          })
      );
      setAttendedPlans(attended);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const renderPlanCard = (plan: Plan) => {
    const isHosted = plan.hostUserId === (userId ? String(userId) : auth.currentUser?.uid);
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.planCard}
        onPress={() => router.push(`/plan/${plan.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.planHeader}>
          <View style={styles.planTitleSection}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <View style={styles.planMeta}>
              <Ionicons name="location" size={14} color="#666" />
              <Text style={styles.planCity}>{plan.city}, {plan.state}</Text>
            </View>
          </View>
          {plan.isPast && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past</Text>
            </View>
          )}
        </View>

        <View style={styles.planDetails}>
          <View style={styles.planDetailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.planDetailText}>{formatDate(plan.date)}</Text>
          </View>
          <View style={styles.planDetailRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.planDetailText}>
              {plan.startTime} - {plan.endTime}
            </Text>
          </View>
          {plan.location?.name && (
            <View style={styles.planDetailRow}>
              <Ionicons name="pin-outline" size={16} color="#666" />
              <Text style={styles.planDetailText} numberOfLines={1}>
                {plan.location.name}
              </Text>
            </View>
          )}
        </View>

        {/* Host info for attended plans */}
        {!isHosted && (
          <View style={styles.hostSection}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <View style={styles.hostInfo}>
              {plan.hostPhotoURL ? (
                <Image source={{ uri: plan.hostPhotoURL }} style={styles.hostAvatar} />
              ) : (
                <View style={[styles.hostAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={16} color="#999" />
                </View>
              )}
              <Text style={styles.hostName}>{plan.hostName}</Text>
            </View>
          </View>
        )}

        {/* Attendees */}
        {plan.attendees && plan.attendees.length > 0 && (
          <View style={styles.attendeesSection}>
            <Text style={styles.attendeesLabel}>
              {plan.attendees.length} {plan.attendees.length === 1 ? 'attendee' : 'attendees'}
            </Text>
            <View style={styles.attendeeAvatars}>
              {plan.attendees.slice(0, 5).map((attendee, index) => (
                <View key={attendee.userId} style={[styles.attendeeAvatarWrapper, { marginLeft: index > 0 ? -8 : 0 }]}>
                  {attendee.photoURL ? (
                    <Image source={{ uri: attendee.photoURL }} style={styles.attendeeAvatar} />
                  ) : (
                    <View style={[styles.attendeeAvatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={12} color="#999" />
                    </View>
                  )}
                </View>
              ))}
              {plan.attendees.length > 5 && (
                <View style={[styles.attendeeAvatar, styles.moreAttendees]}>
                  <Text style={styles.moreAttendeesText}>+{plan.attendees.length - 5}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (type: 'hosted' | 'attended') => {
    const messages = {
      hosted: {
        own: {
          icon: 'calendar-outline' as const,
          title: 'No plans hosted yet',
          description: 'Create your first plan to connect with crew during layovers',
          action: 'Go to Plans',
        },
        other: {
          icon: 'calendar-outline' as const,
          title: 'No plans hosted',
          description: `${viewingUser?.name || 'This crew member'} hasn't hosted any plans yet`,
        },
      },
      attended: {
        own: {
          icon: 'people-outline' as const,
          title: 'No plans attended yet',
          description: 'Join plans created by your crew connections',
          action: 'Browse Plans',
        },
        other: {
          icon: 'people-outline' as const,
          title: 'No plans attended',
          description: `${viewingUser?.name || 'This crew member'} hasn't attended any plans yet`,
        },
      },
    };

    const content = messages[type][isOwnProfile ? 'own' : 'other'];

    return (
      <View style={styles.emptyState}>
        <Ionicons name={content.icon} size={64} color="#ccc" />
        <Text style={styles.emptyStateTitle}>{content.title}</Text>
        <Text style={styles.emptyStateDescription}>{content.description}</Text>
        {isOwnProfile && content.action && (
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.push('/(tabs)/plans')}
          >
            <Text style={styles.emptyStateButtonText}>{content.action}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const activePlans = activeTab === 'hosted' ? hostedPlans : attendedPlans;
  const upcomingPlans = activePlans.filter((p) => !p.isPast);
  const pastPlans = activePlans.filter((p) => p.isPast);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plans</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e88e5" />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Plans' : `${viewingUser?.name || 'Plans'}`}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hosted' && styles.activeTab]}
          onPress={() => setActiveTab('hosted')}
        >
          <Text style={[styles.tabText, activeTab === 'hosted' && styles.activeTabText]}>
            Hosted ({hostedPlans.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'attended' && styles.activeTab]}
          onPress={() => setActiveTab('attended')}
        >
          <Text style={[styles.tabText, activeTab === 'attended' && styles.activeTabText]}>
            Attended ({attendedPlans.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activePlans.length === 0 ? (
          renderEmptyState(activeTab)
        ) : (
          <>
            {/* Upcoming Plans */}
            {upcomingPlans.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcomingPlans.map(renderPlanCard)}
              </View>
            )}

            {/* Past Plans */}
            {pastPlans.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past</Text>
                {pastPlans.map(renderPlanCard)}
              </View>
            )}
          </>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1e88e5',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1e88e5',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planTitleSection: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planCity: {
    fontSize: 14,
    color: '#666',
  },
  pastBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pastBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  planDetails: {
    gap: 8,
    marginBottom: 12,
  },
  planDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planDetailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  hostSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 12,
  },
  hostLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  hostName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  attendeesSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeesLabel: {
    fontSize: 14,
    color: '#666',
  },
  attendeeAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatarWrapper: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 14,
  },
  attendeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAttendees: {
    backgroundColor: '#e0e0e0',
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAttendeesText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyStateButton: {
    marginTop: 24,
    backgroundColor: '#1e88e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
