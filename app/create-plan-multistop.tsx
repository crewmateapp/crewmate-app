// app/create-plan.tsx - Enhanced with Multi-Stop Support
import AppHeader from '@/components/AppHeader';
import AppDrawer from '@/components/AppDrawer';
import { DateTimePicker } from '@/components/DateTimePicker';
import { SpotSelector } from '@/components/SpotSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  address?: string;
};

type Stop = {
  id: string;
  spotId: string;
  spotName: string;
  spotAddress?: string;
  scheduledTime: Date;
  duration?: number;
  notes?: string;
  order: number;
};

export default function CreatePlanScreen() {
  const { user } = useAuth();
  const { 
    spotId: prefilledSpotId, 
    spotName: prefilledSpotName,
    layoverId 
  } = useLocalSearchParams<{ 
    spotId?: string; 
    spotName?: string;
    layoverId?: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [layover, setLayover] = useState<any>(null);

  // Plan type toggle
  const [isMultiStop, setIsMultiStop] = useState(false);

  // Single-stop state
  const [selectedSpotId, setSelectedSpotId] = useState('');
  const [selectedSpotName, setSelectedSpotName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Multi-stop state
  const [stops, setStops] = useState<Stop[]>([]);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);

  // Common state
  const [title, setTitle] = useState('');
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
      setTitle(prefilledSpotName);
    }
  }, [prefilledSpotId, prefilledSpotName]);

  // Get user's current layover or upcoming layover
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        if (layoverId && data.upcomingLayovers) {
          const foundLayover = data.upcomingLayovers.find((l: any) => l.id === layoverId);
          if (foundLayover) {
            setLayover(foundLayover);
            setCurrentCity(foundLayover.city);
            setCurrentArea(foundLayover.area);
            
            if (foundLayover.startDate?.toDate) {
              setScheduledDate(foundLayover.startDate.toDate());
            }
          }
        } else {
          setCurrentCity(data.currentLayover?.city || null);
          setCurrentArea(data.currentLayover?.area || null);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, [user, layoverId]);

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
          address: data.address,
        });
      });
      setSpots(spotsList);
    };

    fetchSpots();
  }, [currentCity]);

  const addStop = () => {
    const spot = spots.find(s => s.id === selectedSpotId);
    if (!spot) {
      Alert.alert('Error', 'Please select a spot first');
      return;
    }

    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      spotId: spot.id,
      spotName: spot.name,
      spotAddress: spot.address,
      scheduledTime: new Date(scheduledDate),
      order: stops.length,
    };

    setStops([...stops, newStop]);
    
    // Reset selection
    setSelectedSpotId('');
    setSelectedSpotName('');
    
    // Auto-increment time by 2 hours for next stop
    const nextTime = new Date(scheduledDate);
    nextTime.setHours(nextTime.getHours() + 2);
    setScheduledDate(nextTime);
  };

  const removeStop = (index: number) => {
    const updated = stops.filter((_, i) => i !== index);
    // Reorder remaining stops
    updated.forEach((stop, i) => {
      stop.order = i;
    });
    setStops(updated);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const updated = [...stops];
    [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
    updated.forEach((stop, i) => {
      stop.order = i;
    });
    setStops(updated);
  };

  const moveStopDown = (index: number) => {
    if (index === stops.length - 1) return;
    const updated = [...stops];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((stop, i) => {
      stop.order = i;
    });
    setStops(updated);
  };

  const handleSubmit = async () => {
    if (!user || !currentCity) return;

    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for your plan.');
      return;
    }

    if (isMultiStop) {
      if (stops.length < 2) {
        Alert.alert('Add More Stops', 'Multi-stop plans need at least 2 stops.');
        return;
      }
    } else {
      if (!selectedSpotId) {
        Alert.alert('Missing Info', 'Please select a spot for your plan.');
        return;
      }

      if (scheduledDate <= new Date()) {
        Alert.alert('Invalid Date', 'Please select a future date and time.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      const basePlanData: any = {
        hostUserId: user.uid,
        hostName: userData?.displayName || 'Unknown',
        hostPhoto: userData?.photoURL || null,
        title: title.trim(),
        city: currentCity,
        area: currentArea || null,
        meetupLocation: meetupLocation.trim() || null,
        description: description.trim() || null,
        visibility: visibility,
        attendeeIds: [user.uid],
        attendeeCount: 1,
        status: 'active',
        layoverId: layoverId || null,
        isMultiStop: isMultiStop,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isMultiStop) {
        // Multi-stop plan
        basePlanData.stops = stops.map(stop => ({
          ...stop,
          scheduledTime: stop.scheduledTime,
        }));
        // Set main scheduledTime to first stop's time for sorting
        basePlanData.scheduledTime = stops[0].scheduledTime;
      } else {
        // Single-stop plan
        basePlanData.spotId = selectedSpotId;
        basePlanData.spotName = selectedSpotName;
        basePlanData.scheduledTime = scheduledDate;
      }

      const planRef = await addDoc(collection(db, 'plans'), basePlanData);

      // Add host as first attendee
      const attendeeData: any = {
        userId: user.uid,
        displayName: userData?.displayName || 'Unknown',
        photoURL: userData?.photoURL || null,
        rsvpStatus: 'going',
        joinedAt: serverTimestamp(),
      };

      // Only add multi-stop fields if it's a multi-stop plan
      if (isMultiStop) {
        attendeeData.allStops = true; // Attending all stops by default
        attendeeData.stopsAttending = stops.map(s => s.id);
      }

      await addDoc(collection(db, 'plans', planRef.id, 'attendees'), attendeeData);

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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!currentCity) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={28} color={Colors.primary} />
              <ThemedText style={styles.backText}>Back</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={80} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No Layover Set</ThemedText>
            <ThemedText style={styles.emptyText}>
              Set your layover location before creating plans
            </ThemedText>
            <TouchableOpacity 
              style={styles.setLayoverButton}
              onPress={() => router.push('/(tabs)')}
            >
              <ThemedText style={styles.setLayoverButtonText}>Set Layover</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </SafeAreaView>
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
      
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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
                <Ionicons name="arrow-back" size={28} color={Colors.primary} />
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
              {/* Layover Context Banner */}
              {layover && (
                <View style={styles.layoverBanner}>
                  <View style={styles.layoverBannerIcon}>
                    <Ionicons name="airplane" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.layoverBannerContent}>
                    <ThemedText style={styles.layoverBannerTitle}>
                      Planning for {layover.city}
                    </ThemedText>
                    <ThemedText style={styles.layoverBannerDate}>
                      {layover.startDate?.toDate?.().toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      {layover.endDate?.toDate && layover.startDate?.toDate?.().getTime() !== layover.endDate?.toDate?.().getTime() && (
                        <> - {layover.endDate.toDate().toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}</>
                      )}
                    </ThemedText>
                  </View>
                </View>
              )}

              {/* Plan Type Toggle */}
              <View style={styles.section}>
                <View style={styles.toggleRow}>
                  <View>
                    <ThemedText style={styles.toggleLabel}>Multi-Stop Itinerary</ThemedText>
                    <ThemedText style={styles.toggleHint}>
                      Create a plan with multiple stops (dinner → bar → club)
                    </ThemedText>
                  </View>
                  <Switch
                    value={isMultiStop}
                    onValueChange={setIsMultiStop}
                    trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
                    thumbColor={isMultiStop ? Colors.primary : Colors.text.secondary}
                  />
                </View>
              </View>

              {/* Title */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>Plan Title *</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Vegas Strip Night Out"
                  placeholderTextColor={Colors.text.disabled}
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {isMultiStop ? (
                /* MULTI-STOP MODE */
                <>
                  {/* Add Stop Section */}
                  <View style={styles.section}>
                    <ThemedText style={styles.label}>Add Stops *</ThemedText>
                    
                    {/* Select Spot */}
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
                      <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>

                    {/* Date & Time for this stop */}
                    <View style={styles.dateTimeRow}>
                      {layoverId ? (
                        /* Show date as read-only when from layover */
                        <View style={[styles.dateTimeButton, styles.dateTimeReadOnly]}>
                          <Ionicons name="calendar-outline" size={20} color={Colors.text.secondary} />
                          <ThemedText style={[styles.dateTimeText, styles.dateTimeTextReadOnly]}>
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </ThemedText>
                        </View>
                      ) : (
                        /* Allow date selection when not from layover */
                        <TouchableOpacity
                          style={styles.dateTimeButton}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                          <ThemedText style={styles.dateTimeText}>
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </ThemedText>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={20} color={Colors.primary} />
                        <ThemedText style={styles.dateTimeText}>
                          {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={styles.addStopButton}
                      onPress={addStop}
                      disabled={!selectedSpotId}
                    >
                      <Ionicons name="add-circle" size={22} color={selectedSpotId ? Colors.primary : Colors.text.disabled} />
                      <ThemedText style={[styles.addStopButtonText, !selectedSpotId && styles.addStopButtonTextDisabled]}>
                        Add Stop to Itinerary
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {/* Stops List */}
                  {stops.length > 0 && (
                    <View style={styles.section}>
                      <ThemedText style={styles.label}>Itinerary ({stops.length} stops)</ThemedText>
                      
                      {stops.map((stop, index) => (
                        <View key={stop.id} style={styles.stopCard}>
                          <View style={styles.stopNumber}>
                            <ThemedText style={styles.stopNumberText}>{index + 1}</ThemedText>
                          </View>
                          
                          <View style={styles.stopContent}>
                            <ThemedText style={styles.stopName}>{stop.spotName}</ThemedText>
                            <ThemedText style={styles.stopTime}>
                              {stop.scheduledTime.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}
                            </ThemedText>
                          </View>

                          <View style={styles.stopActions}>
                            {index > 0 && (
                              <TouchableOpacity onPress={() => moveStopUp(index)} style={styles.stopAction}>
                                <Ionicons name="chevron-up" size={20} color={Colors.text.secondary} />
                              </TouchableOpacity>
                            )}
                            {index < stops.length - 1 && (
                              <TouchableOpacity onPress={() => moveStopDown(index)} style={styles.stopAction}>
                                <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => removeStop(index)} style={styles.stopAction}>
                              <Ionicons name="trash-outline" size={20} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                /* SINGLE-STOP MODE */
                <>
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
                      <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Date & Time */}
                  <View style={styles.section}>
                    <ThemedText style={styles.label}>When *</ThemedText>
                    <View style={styles.dateTimeRow}>
                      {layoverId ? (
                        /* Show date as read-only when from layover */
                        <View style={[styles.dateTimeButton, styles.dateTimeReadOnly]}>
                          <Ionicons name="calendar-outline" size={20} color={Colors.text.secondary} />
                          <ThemedText style={[styles.dateTimeText, styles.dateTimeTextReadOnly]}>
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </ThemedText>
                        </View>
                      ) : (
                        /* Allow date selection when not from layover */
                        <TouchableOpacity
                          style={styles.dateTimeButton}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                          <ThemedText style={styles.dateTimeText}>
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </ThemedText>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={20} color={Colors.primary} />
                        <ThemedText style={styles.dateTimeText}>
                          {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Meetup Location (Optional) */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>Meetup Location (Optional)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Where to meet before the plan"
                  placeholderTextColor={Colors.text.disabled}
                  value={meetupLocation}
                  onChangeText={setMeetupLocation}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Description */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>Description (Optional)</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add details about your plan..."
                  placeholderTextColor={Colors.text.disabled}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Visibility */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>Who Can See This? *</ThemedText>
                
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    visibility === 'public' && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setVisibility('public')}
                >
                  <View style={styles.visibilityLeft}>
                    <Ionicons 
                      name="earth" 
                      size={24} 
                      color={visibility === 'public' ? Colors.primary : Colors.text.secondary} 
                    />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Public</ThemedText>
                      <ThemedText style={styles.visibilityDescription}>
                        Anyone in {currentCity} can see and join
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'public' && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    visibility === 'connections' && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setVisibility('connections')}
                >
                  <View style={styles.visibilityLeft}>
                    <Ionicons 
                      name="people" 
                      size={24} 
                      color={visibility === 'connections' ? Colors.primary : Colors.text.secondary} 
                    />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Connections Only</ThemedText>
                      <ThemedText style={styles.visibilityDescription}>
                        Only your connections can see this plan
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'connections' && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    visibility === 'invite_only' && styles.visibilityOptionSelected
                  ]}
                  onPress={() => setVisibility('invite_only')}
                >
                  <View style={styles.visibilityLeft}>
                    <Ionicons 
                      name="lock-closed" 
                      size={24} 
                      color={visibility === 'invite_only' ? Colors.primary : Colors.text.secondary} 
                    />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Invite Only</ThemedText>
                      <ThemedText style={styles.visibilityDescription}>
                        Only people you invite can see this plan
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'invite_only' && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Create Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  ((!isMultiStop && (!selectedSpotId || !title.trim())) || 
                   (isMultiStop && (stops.length < 2 || !title.trim())) || 
                   submitting) && styles.createButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={
                  (!isMultiStop && (!selectedSpotId || !title.trim())) || 
                  (isMultiStop && (stops.length < 2 || !title.trim())) || 
                  submitting
                }
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
                if (!title && !isMultiStop) {
                  setTitle(spotName);
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
      </SafeAreaView>
    </>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: 17,
    fontWeight: '600',
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleHint: {
    fontSize: 13,
    color: Colors.text.secondary,
    maxWidth: '80%',
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
    marginTop: 12,
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
  dateTimeReadOnly: {
    backgroundColor: Colors.background,
    opacity: 0.6,
  },
  dateTimeTextReadOnly: {
    color: Colors.text.secondary,
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addStopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  addStopButtonTextDisabled: {
    color: Colors.text.disabled,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
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
  },
  stopNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  stopContent: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  stopTime: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  stopActions: {
    flexDirection: 'row',
    gap: 8,
  },
  stopAction: {
    padding: 4,
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
    padding: 20,
    paddingBottom: 34,
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
  setLayoverButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 30,
  },
  setLayoverButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  layoverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  layoverBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  layoverBannerContent: {
    flex: 1,
  },
  layoverBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  layoverBannerDate: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});
