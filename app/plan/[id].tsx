// app/plan/[id].tsx
import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import { PlanChat } from '@/components/PlanChat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, PlanAttendee, Stop } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [attendees, setAttendees] = useState<PlanAttendee[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch plan details
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'plans', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Plan;
        setPlan(data);
        setIsHost(data.hostUserId === user?.uid);
        setIsAttending(data.attendeeIds.includes(user?.uid || ''));
      } else {
        Alert.alert('Error', 'Plan not found');
        router.back();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, user]);

  // Fetch attendees
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      collection(db, 'plans', id, 'attendees'),
      (snapshot) => {
        const attendeesList: PlanAttendee[] = [];
        snapshot.forEach((doc) => {
          attendeesList.push(doc.data() as PlanAttendee);
        });
        setAttendees(attendeesList);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handleRSVP = async () => {
    if (!user || !plan) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (isAttending) {
        // Remove RSVP
        await updateDoc(doc(db, 'plans', plan.id), {
          attendeeIds: arrayRemove(user.uid),
          attendeeCount: increment(-1),
          updatedAt: serverTimestamp(),
        });

        await deleteDoc(doc(db, 'plans', plan.id, 'attendees', user.uid));
      } else {
        // Add RSVP
        await updateDoc(doc(db, 'plans', plan.id), {
          attendeeIds: arrayUnion(user.uid),
          attendeeCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'plans', plan.id, 'attendees', user.uid), {
          userId: user.uid,
          displayName: userData?.displayName || 'Unknown',
          photoURL: userData?.photoURL || null,
          rsvpStatus: 'going',
          joinedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
      Alert.alert('Error', 'Failed to update RSVP. Please try again.');
    }
  };

  const handleViewSpot = () => {
    if (!plan) return;
    router.push({
      pathname: '/spot/[id]',
      params: { id: plan.spotId }
    });
  };

  const handleSharePlan = () => {
    if (!id) return;
    router.push({
      pathname: '/plan-invite',
      params: { id }
    });
  };

  const handleCancelPlan = () => {
    if (!plan || !isHost) return;

    Alert.alert(
      'Cancel Plan',
      'Are you sure you want to cancel this plan? This cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'plans', plan.id), {
                status: 'cancelled',
                updatedAt: serverTimestamp(),
              });
              Alert.alert('Cancelled', 'Your plan has been cancelled.');
              router.back();
            } catch (error) {
              console.error('Error cancelling plan:', error);
              Alert.alert('Error', 'Failed to cancel plan.');
            }
          }
        }
      ]
    );
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dateStr} at ${timeStr}`;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading || !plan) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <>
      <AppDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
      
      <AppHeader 
        onMenuPress={() => setDrawerVisible(true)}
      />
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
          
          <View style={styles.headerRight}>
            {/* Share Plan Button - Always visible for host and attendees */}
            {(isHost || isAttending) && (
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={handleSharePlan}
              >
                <Ionicons name="qr-code" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
            
            {/* Edit Button - Host only */}
            {isHost && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => router.push({ pathname: '/edit-plan', params: { id } })}
              >
                <Ionicons name="pencil" size={18} color={Colors.white} />
                <ThemedText style={styles.editButtonText}>Edit</ThemedText>
              </TouchableOpacity>
            )}
            
            {isHost && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelPlan}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan Info Card */}
          <View style={styles.planCard}>
            <ThemedText style={styles.title}>{plan.title}</ThemedText>
            
            {/* Host Info */}
            <View style={styles.hostSection}>
              {plan.hostPhoto ? (
                <Image source={{ uri: plan.hostPhoto }} style={styles.hostAvatar} />
              ) : (
                <View style={styles.hostAvatarFallback}>
                  <ThemedText style={styles.hostAvatarText}>
                    {plan.hostName.slice(0, 2).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.hostInfo}>
                <ThemedText style={styles.hostLabel}>Hosted by</ThemedText>
                <ThemedText style={styles.hostName}>{plan.hostName}</ThemedText>
              </View>
              
              {/* Share QR Button for Host */}
              {isHost && (
                <TouchableOpacity 
                  style={styles.inviteButton}
                  onPress={handleSharePlan}
                >
                  <Ionicons name="person-add" size={18} color={Colors.white} />
                  <ThemedText style={styles.inviteButtonText}>Invite</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Date/Time & Location - Different for multi-stop */}
            {plan.isMultiStop && plan.stops && plan.stops.length > 0 ? (
              /* MULTI-STOP TIMELINE */
              <>
                {/* Date Header */}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
                  <View style={styles.infoText}>
                    <ThemedText style={styles.infoLabel}>When</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {formatDate(plan.stops[0].scheduledTime)}
                    </ThemedText>
                  </View>
                </View>

                {/* Itinerary Timeline */}
                <View style={styles.timelineSection}>
                  <ThemedText style={styles.timelinelabel}>Itinerary ({plan.stops.length} stops)</ThemedText>
                  
                  {plan.stops.map((stop: Stop, index: number) => (
                    <View key={stop.id} style={styles.stopContainer}>
                      {/* Timeline Connector */}
                      {index < plan.stops!.length - 1 && (
                        <View style={styles.timelineConnector} />
                      )}
                      
                      {/* Stop Card */}
                      <View style={styles.stopCard}>
                        <View style={styles.stopNumber}>
                          <ThemedText style={styles.stopNumberText}>{index + 1}</ThemedText>
                        </View>
                        
                        <View style={styles.stopContent}>
                          <View style={styles.stopHeader}>
                            <ThemedText style={styles.stopTime}>
                              {formatTime(stop.scheduledTime)}
                            </ThemedText>
                            {stop.duration && (
                              <ThemedText style={styles.stopDuration}>
                                {stop.duration} min
                              </ThemedText>
                            )}
                          </View>
                          
                          <TouchableOpacity 
                            onPress={() => router.push({ pathname: '/spot/[id]', params: { id: stop.spotId }})}
                          >
                            <ThemedText style={styles.stopName}>{stop.spotName}</ThemedText>
                          </TouchableOpacity>
                          
                          {stop.spotAddress && (
                            <ThemedText style={styles.stopAddress}>{stop.spotAddress}</ThemedText>
                          )}
                          
                          {stop.notes && (
                            <ThemedText style={styles.stopNotes}>{stop.notes}</ThemedText>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              /* SINGLE-STOP VIEW (existing) */
              <>
                {/* Date/Time */}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
                  <View style={styles.infoText}>
                    <ThemedText style={styles.infoLabel}>When</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {formatDateTime(plan.scheduledTime)}
                    </ThemedText>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={24} color={Colors.primary} />
                  <View style={styles.infoText}>
                    <ThemedText style={styles.infoLabel}>Where</ThemedText>
                    <TouchableOpacity onPress={handleViewSpot}>
                      <ThemedText style={styles.infoValueLink}>{plan.spotName}</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.infoSubtext}>{plan.city}</ThemedText>
                  </View>
                </View>
              </>
            )}

            {/* Meetup Location */}
            {plan.meetupLocation && (
              <View style={styles.infoRow}>
                <Ionicons name="flag-outline" size={24} color={Colors.primary} />
                <View style={styles.infoText}>
                  <ThemedText style={styles.infoLabel}>Meet at</ThemedText>
                  <ThemedText style={styles.infoValue}>{plan.meetupLocation}</ThemedText>
                </View>
              </View>
            )}

            {/* Description */}
            {plan.description && (
              <View style={styles.descriptionSection}>
                <ThemedText style={styles.descriptionLabel}>Details</ThemedText>
                <ThemedText style={styles.descriptionText}>{plan.description}</ThemedText>
              </View>
            )}

            {/* Visibility Badge */}
            <View style={styles.visibilityBadge}>
              <Ionicons 
                name={
                  plan.visibility === 'public' ? 'globe-outline' : 
                  plan.visibility === 'connections' ? 'people-outline' : 
                  'lock-closed-outline'
                } 
                size={16} 
                color={Colors.text.secondary} 
              />
              <ThemedText style={styles.visibilityText}>
                {
                  plan.visibility === 'public' ? 'Public Plan' : 
                  plan.visibility === 'connections' ? 'Connections Only' : 
                  'Invite Only'
                }
              </ThemedText>
            </View>
          </View>

          {/* Attendees Section */}
          <View style={styles.attendeesSection}>
            <View style={styles.attendeesHeader}>
              <ThemedText style={styles.attendeesTitle}>
                Who's Going ({attendees.length})
              </ThemedText>
            </View>

            {attendees.length > 0 ? (
              <View style={styles.attendeesList}>
                {attendees.map((attendee) => (
                  <View key={attendee.userId} style={styles.attendeeItem}>
                    {attendee.photoURL ? (
                      <Image source={{ uri: attendee.photoURL }} style={styles.attendeeAvatar} />
                    ) : (
                      <View style={styles.attendeeAvatarFallback}>
                        <ThemedText style={styles.attendeeAvatarText}>
                          {attendee.displayName.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText style={styles.attendeeName}>{attendee.displayName}</ThemedText>
                    {attendee.userId === plan.hostUserId && (
                      <View style={styles.hostBadge}>
                        <ThemedText style={styles.hostBadgeText}>Host</ThemedText>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyAttendees}>
                <ThemedText style={styles.emptyAttendeesText}>
                  No one has RSVP'd yet. Be the first!
                </ThemedText>
              </View>
            )}
          </View>

          {/* Plan Chat Section */}
          <View style={styles.chatSection}>
            <PlanChat planId={id!} planTitle={plan.title} />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* RSVP Button */}
        {!isHost && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.rsvpButton, isAttending && styles.rsvpButtonAttending]}
              onPress={handleRSVP}
            >
              <Ionicons 
                name={isAttending ? 'checkmark-circle' : 'add-circle-outline'} 
                size={24} 
                color={Colors.white} 
              />
              <ThemedText style={styles.rsvpButtonText}>
                {isAttending ? "You're Going!" : 'RSVP to Join'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
    </>
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
    paddingTop: 20,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hostAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  hostAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  hostInfo: {
    flex: 1,
  },
  hostLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  infoValueLink: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  infoSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  descriptionSection: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  descriptionLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  visibilityText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  attendeesSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attendeesHeader: {
    marginBottom: 16,
  },
  attendeesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  attendeesList: {
    gap: 12,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  attendeeAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  attendeeName: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  hostBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  emptyAttendees: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyAttendeesText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  chatSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    height: 500,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  rsvpButtonAttending: {
    backgroundColor: Colors.success,
  },
  rsvpButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  // Multi-stop timeline styles
  timelineSection: {
    marginTop: 8,
  },
  timelinelabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  stopContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  timelineConnector: {
    position: 'absolute',
    left: 15,
    top: 40,
    bottom: -20,
    width: 2,
    backgroundColor: Colors.border,
  },
  stopCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stopNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  stopContent: {
    flex: 1,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  stopTime: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  stopDuration: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  stopName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stopAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  stopNotes: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
});
