// app/edit-plan.tsx - Enhanced with Multi-Stop Support
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

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

type Spot = {
  id: string;
  name: string;
  city: string;
  address?: string;
};

type Plan = {
  id: string;
  title: string;
  spotId?: string;
  spotName?: string;
  spotAddress?: string;
  city: string;
  scheduledTime: any;
  description?: string;
  meetupLocation?: string;
  isPublic: boolean;
  hostUserId: string;
  attendeeIds: string[];
  isMultiStop?: boolean;
  stops?: any[];
  layoverId?: string;
};

export default function EditPlanScreen() {
  const { 
    id: planId,
    selectedSpotId: returnedSpotId,
    selectedSpotName: returnedSpotName,
    isMultiStop: isMultiStopParam,
    stops: stopsParam,
  } = useLocalSearchParams<{ 
    id: string;
    selectedSpotId?: string;
    selectedSpotName?: string;
    isMultiStop?: string;
    stops?: string;
  }>();
  
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Multi-stop state
  const [isMultiStop, setIsMultiStop] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState('');
  const [selectedSpotName, setSelectedSpotName] = useState('');
  const [currentCity, setCurrentCity] = useState<string | null>(null);

  // Edit stop state
  const [showEditStopModal, setShowEditStopModal] = useState(false);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [editStopTime, setEditStopTime] = useState(new Date());

  // Track if we've restored stops from params (to prevent multiple restorations)
  const hasRestoredStops = useRef(false);

  // Handle spot selection from explore
  useEffect(() => {
    if (returnedSpotId && returnedSpotName) {
      console.log('🎯 Received spot selection:', { returnedSpotId, returnedSpotName });
      setSelectedSpotId(returnedSpotId);
      setSelectedSpotName(returnedSpotName);
    }
  }, [returnedSpotId, returnedSpotName]);

  // Restore multi-stop state and stops array from params (when returning from explore)
  useEffect(() => {
    // Only restore if:
    // 1. We're returning from explore with a newly selected spot
    // 2. We haven't already restored in this session
    // This prevents old params from restoring deleted stops
    if (isMultiStopParam === 'true' && returnedSpotId && !hasRestoredStops.current) {
      console.log('🔄 Restoring multi-stop state in edit-plan');
      setIsMultiStop(true);
      
      if (stopsParam) {
        try {
          const decodedStops = JSON.parse(decodeURIComponent(stopsParam));
          console.log('🔄 Restoring stops:', decodedStops);
          // Convert scheduledTime back to Date objects
          const restoredStops = decodedStops.map((stop: any) => ({
            ...stop,
            scheduledTime: new Date(stop.scheduledTime),
          }));
          setStops(restoredStops);
          hasRestoredStops.current = true; // Mark as restored
        } catch (error) {
          console.error('❌ Error restoring stops:', error);
        }
      } else {
        // No stops param means empty array
        setStops([]);
        hasRestoredStops.current = true;
      }
    }
  }, [isMultiStopParam, stopsParam, returnedSpotId]);

  // Load plan data
  useEffect(() => {
    const loadPlan = async () => {
      if (!planId) return;

      try {
        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (planDoc.exists()) {
          const planData = { id: planDoc.id, ...planDoc.data() } as Plan;
          
          // Check if user is the host
          if (planData.hostUserId !== user?.uid) {
            Alert.alert('Error', 'Only the host can edit this plan');
            router.back();
            return;
          }

          setPlan(planData);
          setTitle(planData.title);
          setDescription(planData.description || '');
          setMeetupLocation(planData.meetupLocation || '');
          setScheduledTime(planData.scheduledTime.toDate());
          setIsPublic(planData.isPublic);
          setCurrentCity(planData.city);
          
          // Handle multi-stop plans
          if (planData.isMultiStop && planData.stops) {
            setIsMultiStop(true);
            const loadedStops: Stop[] = planData.stops.map((s: any) => ({
              id: s.id,
              spotId: s.spotId,
              spotName: s.spotName,
              spotAddress: s.spotAddress,
              scheduledTime: s.scheduledTime?.toDate ? s.scheduledTime.toDate() : new Date(s.scheduledTime),
              duration: s.duration,
              notes: s.notes,
              order: s.order,
            }));
            setStops(loadedStops);
          }
        } else {
          Alert.alert('Error', 'Plan not found');
          router.back();
        }
      } catch (error) {
        console.error('Error loading plan:', error);
        Alert.alert('Error', 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [planId, user]);

  // Fetch spots for city
  useEffect(() => {
    if (!currentCity) return;

    const fetchSpots = async () => {
      try {
        const q = query(
          collection(db, 'spots'),
          where('city', '==', currentCity),
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
        
        spotsList.sort((a, b) => a.name.localeCompare(b.name));
        setSpots(spotsList);
      } catch (error) {
        console.error('Error fetching spots:', error);
      }
    };

    fetchSpots();
  }, [currentCity]);

  const addStop = () => {
    if (!selectedSpotId || !selectedSpotName) {
      Alert.alert('Error', 'Please select a spot first');
      return;
    }

    const spot = spots.find(s => s.id === selectedSpotId);

    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      spotId: selectedSpotId,
      spotName: selectedSpotName,
      spotAddress: spot?.address,
      scheduledTime: new Date(scheduledTime),
      order: stops.length,
    };

    setStops([...stops, newStop]);
    
    // Reset selection
    setSelectedSpotId('');
    setSelectedSpotName('');
    
    // Auto-increment time by 2 hours
    const nextTime = new Date(scheduledTime);
    nextTime.setHours(nextTime.getHours() + 2);
    setScheduledTime(nextTime);
  };

  const removeStop = (index: number) => {
    const updated = stops.filter((_, i) => i !== index);
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

  const handleEditStop = (index: number) => {
    setEditingStopIndex(index);
    setEditStopTime(new Date(stops[index].scheduledTime));
    setShowEditStopModal(true);
  };

  const confirmEditStop = () => {
    if (editingStopIndex === null) return;
    
    const updated = [...stops];
    updated[editingStopIndex] = {
      ...updated[editingStopIndex],
      scheduledTime: editStopTime
    };
    
    // Sort by time after editing
    updated.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    
    // Update order values
    updated.forEach((stop, i) => {
      stop.order = i;
    });
    
    setStops(updated);
    setShowEditStopModal(false);
    setEditingStopIndex(null);
  };

  const onEditStopTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowEditStopModal(false);
    }
    if (selectedTime) {
      setEditStopTime(selectedTime);
    }
  };

  const handleSave = async () => {
    if (!plan || !user) return;

    // Validate
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a plan title');
      return;
    }

    if (isMultiStop && stops.length === 0) {
      Alert.alert('Error', 'Please add at least one stop');
      return;
    }

    setSaving(true);

    try {
      // Build update data, excluding undefined values (Firebase rejects them)
      const updateData: any = {
        title,
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they're not undefined
      if (description !== undefined) {
        updateData.description = description;
      }
      if (meetupLocation !== undefined) {
        updateData.meetupLocation = meetupLocation;
      }
      if (isPublic !== undefined) {
        updateData.isPublic = isPublic;
      }

      if (isMultiStop) {
        // Multi-stop plan
        updateData.isMultiStop = true;
        updateData.stops = stops.map(stop => ({
          id: stop.id,
          spotId: stop.spotId,
          spotName: stop.spotName,
          spotAddress: stop.spotAddress || null,
          scheduledTime: stop.scheduledTime,
          duration: stop.duration || null,
          notes: stop.notes || null,
          order: stop.order,
        }));
        // Set scheduledTime to first stop
        updateData.scheduledTime = stops[0].scheduledTime;
      } else {
        // Single-stop plan (unchanged)
        updateData.scheduledTime = scheduledTime;
      }

      await updateDoc(doc(db, 'plans', plan.id), updateData);

      // Notify attendees if there are any
      if (plan.attendeeIds.length > 0) {
        for (const attendeeId of plan.attendeeIds) {
          await addDoc(collection(db, 'planNotifications'), {
            userId: attendeeId,
            planId: plan.id,
            planTitle: title,
            type: 'plan_updated',
            message: 'Plan has been updated',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      Alert.alert(
        'Plan Updated!',
        plan.attendeeIds.length > 0 
          ? `Your plan has been updated. ${plan.attendeeIds.length} attendee${plan.attendeeIds.length > 1 ? 's' : ''} will be notified.`
          : 'Your plan has been updated.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          }
        ]
      );
    } catch (error) {
      console.error('Error updating plan:', error);
      Alert.alert('Error', 'Failed to update plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(scheduledTime);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledTime(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(scheduledTime);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledTime(newDate);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Edit Plan</ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <ThemedText style={styles.saveButton}>Save</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Plan Title</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Vegas Strip Night"
              placeholderTextColor={Colors.text.secondary}
              maxLength={100}
            />
          </View>

          {/* Multi-Stop Stops List */}
          {isMultiStop && (
            <View style={styles.section}>
              <ThemedText style={styles.label}>Stops ({stops.length})</ThemedText>
              
              {stops.map((stop, index) => (
                <View key={stop.id} style={styles.stopCard}>
                  <View style={styles.stopNumber}>
                    <ThemedText style={styles.stopNumberText}>{index + 1}</ThemedText>
                  </View>
                  
                  <View style={styles.stopContent}>
                    <ThemedText style={styles.stopName}>{stop.spotName}</ThemedText>
                    <ThemedText style={styles.stopTime}>{formatTime(stop.scheduledTime)}</ThemedText>
                    {stop.spotAddress && (
                      <ThemedText style={styles.stopAddress}>{stop.spotAddress}</ThemedText>
                    )}
                  </View>

                  <View style={styles.stopActions}>
                    <TouchableOpacity
                      style={styles.stopActionButton}
                      onPress={() => handleEditStop(index)}
                    >
                      <Ionicons name="pencil" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.stopActionButton}
                        onPress={() => moveStopUp(index)}
                      >
                        <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    {index < stops.length - 1 && (
                      <TouchableOpacity
                        style={styles.stopActionButton}
                        onPress={() => moveStopDown(index)}
                      >
                        <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.stopActionButton, styles.deleteButton]}
                      onPress={() => {
                        Alert.alert(
                          'Remove Stop',
                          `Remove ${stop.spotName} from this plan?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeStop(index) }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Add Another Stop */}
              <TouchableOpacity 
                style={styles.addStopButton}
                onPress={() => {
                  Keyboard.dismiss();
                  // Encode existing stops to preserve them
                  const stopsData = encodeURIComponent(JSON.stringify(stops));
                  router.push(`/explore?city=${currentCity}&selectionMode=true&returnTo=edit-plan&planId=${planId}&isMultiStop=true&stops=${stopsData}`);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                <ThemedText style={styles.addStopButtonText}>Add Another Stop</ThemedText>
              </TouchableOpacity>

              {/* Next Stop Time */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>Time for Next Stop</ThemedText>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color={Colors.primary} />
                  <ThemedText style={styles.dateTimeText}>
                    {formatTime(scheduledTime)}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Single-Stop Location (Read-only) */}
          {!isMultiStop && plan?.spotName && (
            <View style={styles.section}>
              <ThemedText style={styles.label}>Location</ThemedText>
              <View style={styles.readOnlyField}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.spotName}>{plan.spotName}</ThemedText>
                  {plan.spotAddress && (
                    <ThemedText style={styles.spotAddress}>{plan.spotAddress}</ThemedText>
                  )}
                </View>
              </View>
              <ThemedText style={styles.helperText}>
                To change location, create a new plan
              </ThemedText>
            </View>
          )}

          {/* Date & Time (Single-Stop Only) */}
          {!isMultiStop && (
            <View style={styles.section}>
              <ThemedText style={styles.label}>Date & Time</ThemedText>
              
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={Colors.primary} />
                <ThemedText style={styles.dateTimeText}>
                  {scheduledTime.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={Colors.primary} />
                <ThemedText style={styles.dateTimeText}>
                  {formatTime(scheduledTime)}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Meetup Location */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Meetup Location (Optional)</ThemedText>
            <TextInput
              style={styles.input}
              value={meetupLocation}
              onChangeText={setMeetupLocation}
              placeholder="e.g., Front entrance, By the fountain..."
              placeholderTextColor={Colors.text.secondary}
              maxLength={200}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Description (Optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add any additional details..."
              placeholderTextColor={Colors.text.secondary}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          {/* Privacy Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Public Plan</ThemedText>
                <ThemedText style={styles.helperText}>
                  {isPublic 
                    ? 'Anyone in your city can see and join this plan'
                    : 'Only people you share with can join'
                  }
                </ThemedText>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Attendees Info */}
          {plan && plan.attendeeIds.length > 0 && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <ThemedText style={styles.infoText}>
                {plan.attendeeIds.length} attendee{plan.attendeeIds.length > 1 ? 's' : ''} will be notified of changes
              </ThemedText>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={scheduledTime}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Edit Stop Time Modal */}
        {showEditStopModal && editingStopIndex !== null && (
          <View style={styles.modalOverlay}>
            <View style={styles.editStopModal}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Edit Stop Time</ThemedText>
                <TouchableOpacity onPress={() => setShowEditStopModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalContent}>
                <ThemedText style={styles.editStopName}>
                  {stops[editingStopIndex]?.spotName}
                </ThemedText>
                
                <View style={styles.timeSection}>
                  <ThemedText style={styles.timeLabel}>Scheduled Time</ThemedText>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => {
                      // On Android, the picker opens immediately
                      // On iOS, we show inline picker below
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color={Colors.primary} />
                    <ThemedText style={styles.timeButtonText}>
                      {editStopTime.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                
                {Platform.OS === 'ios' && (
                  <DateTimePicker
                    value={editStopTime}
                    mode="time"
                    display="spinner"
                    onChange={onEditStopTimeChange}
                    style={styles.iosTimePicker}
                  />
                )}
                
                {Platform.OS === 'android' && (
                  <DateTimePicker
                    value={editStopTime}
                    mode="time"
                    display="default"
                    onChange={onEditStopTimeChange}
                  />
                )}
                
                <ThemedText style={styles.editStopHint}>
                  Stops will automatically reorder by time
                </ThemedText>
              </View>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={confirmEditStop}
              >
                <ThemedText style={styles.saveButtonText}>Save Time</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text.primary,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  spotAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  helperText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dateTimeText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.accent + '20',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
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
    color: Colors.text.primary,
  },
  stopTime: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
  stopActions: {
    flexDirection: 'row',
    gap: 4,
  },
  stopActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteButton: {
    backgroundColor: Colors.error + '10',
    borderColor: Colors.error + '30',
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 16,
    marginTop: 8,
  },
  addStopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  
  // Edit Stop Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  editStopModal: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    marginBottom: 20,
  },
  editStopName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  timeSection: {
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.7,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeButtonText: {
    fontSize: 16,
  },
  iosTimePicker: {
    marginTop: 16,
  },
  editStopHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
