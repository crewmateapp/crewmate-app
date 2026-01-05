// app/create-plan.tsx
import AppHeader from '@/components/AppHeader';
import AppDrawer from '@/components/AppDrawer';
import { DateTimePicker } from '@/components/DateTimePicker';
import { SpotSelector } from '@/components/SpotSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { CreatePlanInput } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type Spot = {
  id: string;
  name: string;
  city: string;
};

export default function CreatePlanScreen() {
  const { user } = useAuth();
  const { spotId: prefilledSpotId, spotName: prefilledSpotName } = useLocalSearchParams<{ 
    spotId?: string; 
    spotName?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);

  // Form state
  const [selectedSpotId, setSelectedSpotId] = useState('');
  const [selectedSpotName, setSelectedSpotName] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [meetupLocation, setMeetupLocation] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'invite_only'>('public');
  const [showSpotSelector, setShowSpotSelector] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Pre-fill spot if coming from spot detail page
  useEffect(() => {
    if (prefilledSpotId && prefilledSpotName) {
      setSelectedSpotId(prefilledSpotId);
      setSelectedSpotName(prefilledSpotName);
      setTitle(prefilledSpotName); // Auto-fill title
    }
  }, [prefilledSpotId, prefilledSpotName]);

  // Get user's current layover
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setCurrentCity(data.currentLayover?.city || null);
        setCurrentArea(data.currentLayover?.area || null);
      }
      setLoading(false);
    };

    fetchUserData();
  }, [user]);

  // Fetch spots in current city
  useEffect(() => {
    if (!currentCity) return;

    const fetchSpots = async () => {
      const q = query(
        collection(db, 'spots'),
        where('city', '==', currentCity),
        where('approved', '==', true),
        orderBy('name', 'asc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const spotsList: Spot[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        spotsList.push({
          id: doc.id,
          name: data.name,
          city: data.city,
        });
      });
      setSpots(spotsList);
    };

    fetchSpots();
  }, [currentCity]);

  // Auto-fill title when spot is selected
  useEffect(() => {
    if (selectedSpotId && !title) {
      const spot = spots.find(s => s.id === selectedSpotId);
      if (spot) {
        setTitle(spot.name);
        setSelectedSpotName(spot.name);
      }
    }
  }, [selectedSpotId, spots]);

  const handleSubmit = async () => {
    if (!user || !currentCity) return;

    // Validation
    if (!selectedSpotId) {
      Alert.alert('Missing Info', 'Please select a spot for your plan.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for your plan.');
      return;
    }

    if (scheduledDate <= new Date()) {
      Alert.alert('Invalid Date', 'Please select a future date and time.');
      return;
    }

    setSubmitting(true);

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      // Create plan
      const planData = {
        hostUserId: user.uid,
        hostName: userData?.displayName || 'Unknown',
        hostPhoto: userData?.photoURL || null,
        title: title.trim(),
        spotId: selectedSpotId,
        spotName: selectedSpotName,
        city: currentCity,
        area: currentArea || null,
        scheduledTime: scheduledDate,
        meetupLocation: meetupLocation.trim() || null,
        description: description.trim() || null,
        visibility: visibility,
        attendeeIds: [user.uid], // Host is automatically attending
        attendeeCount: 1,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const planRef = await addDoc(collection(db, 'plans'), planData);

      // Add host as first attendee
      await addDoc(collection(db, 'plans', planRef.id, 'attendees'), {
        userId: user.uid,
        displayName: userData?.displayName || 'Unknown',
        photoURL: userData?.photoURL || null,
        rsvpStatus: 'going',
        joinedAt: serverTimestamp(),
      });

      Alert.alert('Success!', 'Your plan has been created!', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            router.push({
              pathname: '/plan/[id]',
              params: { id: planRef.id }
            });
          }
        }
      ]);
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Error', 'Failed to create plan. Please try again.');
      setSubmitting(false);
    }
  };

  const handleAddSpot = () => {
    Alert.alert(
      'Add Spot',
      'You need to add this spot to the database first. Go to Explore and add a new spot.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Explore',
          onPress: () => {
            router.back();
            router.push('/explore');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

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
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No Layover Set</ThemedText>
          <ThemedText style={styles.emptyText}>
            Set your layover location before creating plans
          </ThemedText>
        </View>
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
      >
        <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Create Plan</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Spot Selection */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Select Spot *</ThemedText>
            <TouchableOpacity 
              style={styles.selectorButton}
              onPress={() => {
                Keyboard.dismiss();
                setShowSpotSelector(true);
              }}
            >
              <ThemedText style={selectedSpotId ? styles.selectorTextSelected : styles.selectorTextPlaceholder}>
                {selectedSpotName || 'Choose a spot...'}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addSpotButton} onPress={handleAddSpot}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.addSpotText}>
                Can't find your spot? Add it first
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Plan Title *</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Dinner at Catch"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          {/* Date/Time */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>When *</ThemedText>
            
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateTimeText}>
                {scheduledDate.toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateTimeText}>
                {scheduledDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Meetup Location */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Meet At (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              value={meetupLocation}
              onChangeText={setMeetupLocation}
              placeholder="e.g., Hotel lobby, or Meet at spot"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Details (Optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add any additional details..."
              placeholderTextColor={Colors.text.disabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Visibility Options */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Who can see this plan?</ThemedText>
            
            <TouchableOpacity
              style={[styles.visibilityOption, visibility === 'public' && styles.visibilityOptionSelected]}
              onPress={() => setVisibility('public')}
            >
              <View style={styles.visibilityLeft}>
                <Ionicons 
                  name={visibility === 'public' ? 'radio-button-on' : 'radio-button-off'} 
                  size={24} 
                  color={visibility === 'public' ? Colors.primary : Colors.text.secondary} 
                />
                <View style={styles.visibilityText}>
                  <ThemedText style={styles.visibilityTitle}>Public</ThemedText>
                  <ThemedText style={styles.visibilityDescription}>
                    Anyone in {currentCity} can find and join
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="earth" size={20} color={visibility === 'public' ? Colors.primary : Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.visibilityOption, visibility === 'connections' && styles.visibilityOptionSelected]}
              onPress={() => setVisibility('connections')}
            >
              <View style={styles.visibilityLeft}>
                <Ionicons 
                  name={visibility === 'connections' ? 'radio-button-on' : 'radio-button-off'} 
                  size={24} 
                  color={visibility === 'connections' ? Colors.primary : Colors.text.secondary} 
                />
                <View style={styles.visibilityText}>
                  <ThemedText style={styles.visibilityTitle}>Connections Only</ThemedText>
                  <ThemedText style={styles.visibilityDescription}>
                    Only your approved connections can see this
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="people" size={20} color={visibility === 'connections' ? Colors.primary : Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.visibilityOption, visibility === 'invite_only' && styles.visibilityOptionSelected]}
              onPress={() => setVisibility('invite_only')}
            >
              <View style={styles.visibilityLeft}>
                <Ionicons 
                  name={visibility === 'invite_only' ? 'radio-button-on' : 'radio-button-off'} 
                  size={24} 
                  color={visibility === 'invite_only' ? Colors.primary : Colors.text.secondary} 
                />
                <View style={styles.visibilityText}>
                  <ThemedText style={styles.visibilityTitle}>Invite Only</ThemedText>
                  <ThemedText style={styles.visibilityDescription}>
                    Only people you invite can see and join
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="lock-closed" size={20} color={visibility === 'invite_only' ? Colors.primary : Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Create Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              (!selectedSpotId || !title.trim() || submitting) && styles.createButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!selectedSpotId || !title.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={24} color={Colors.white} />
                <ThemedText style={styles.createButtonText}>Create Plan</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Spot Selector Modal */}
        <SpotSelector
          visible={showSpotSelector}
          spots={spots}
          onClose={() => setShowSpotSelector(false)}
          onSelect={(spotId, spotName) => {
            setSelectedSpotId(spotId);
            setSelectedSpotName(spotName);
            if (!title) {
              setTitle(spotName); // Auto-fill title
            }
          }}
        />

        {/* Date Picker Modal */}
        <DateTimePicker
          visible={showDatePicker}
          mode="date"
          value={scheduledDate}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => setScheduledDate(date)}
          minimumDate={new Date()}
        />

        {/* Time Picker Modal */}
        <DateTimePicker
          visible={showTimePicker}
          mode="time"
          value={scheduledDate}
          onClose={() => setShowTimePicker(false)}
          onSelect={(date) => setScheduledDate(date)}
        />
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
    paddingTop: 20, // Reduced from 60 since AppHeader provides spacing
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
  placeholder: {
    width: 70,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text.primary,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectorTextPlaceholder: {
    fontSize: 16,
    color: Colors.text.disabled,
  },
  selectorTextSelected: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.card,
    marginBottom: 12,
  },
  dateTimeText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  addSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  addSpotText: {
    fontSize: 14,
    color: Colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateTimeText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  visibilityOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  visibilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  visibilityText: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: Colors.text.primary,
  },
  visibilityDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
  },
});
