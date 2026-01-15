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
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    layoverId,
    selectedSpotId: returnedSpotId,
    selectedSpotName: returnedSpotName,
    isMultiStop: isMultiStopParam,
    stops: stopsParam,
  } = useLocalSearchParams<{ 
    spotId?: string; 
    spotName?: string;
    layoverId?: string;
    selectedSpotId?: string;
    selectedSpotName?: string;
    isMultiStop?: string;
    stops?: string;
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

  // Track if we've restored stops from params (to prevent multiple restorations)
  const hasRestoredStops = useRef(false);

  // Common state
  const [title, setTitle] = useState('');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'invite_only'>('public');
  const [showSpotSelector, setShowSpotSelector] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  // Layover selection state
  const [showLayoverPicker, setShowLayoverPicker] = useState(false);
  const [availableLayovers, setAvailableLayovers] = useState<any[]>([]);
  const [selectedLayoverId, setSelectedLayoverId] = useState<string | null>(null);

  // Pre-fill spot if coming from spot detail page
  useEffect(() => {
    if (prefilledSpotId && prefilledSpotName) {
      setSelectedSpotId(prefilledSpotId);
      setSelectedSpotName(prefilledSpotName);
      setTitle(prefilledSpotName);
    }
  }, [prefilledSpotId, prefilledSpotName]);

  // Handle spot selection returned from explore page
  useEffect(() => {
    if (returnedSpotId && returnedSpotName) {
      console.log('🎯 Received spot selection from explore:', { returnedSpotId, returnedSpotName });
      setSelectedSpotId(returnedSpotId);
      setSelectedSpotName(returnedSpotName);
      if (!title && !isMultiStop) {
        setTitle(returnedSpotName);
      }
    }
  }, [returnedSpotId, returnedSpotName]);

  // Restore multi-stop state and stops array from params (when returning from explore)
  useEffect(() => {
    // Only restore if:
    // 1. We're returning from explore with a newly selected spot
    // 2. We haven't already restored in this session
    // This prevents old params from restoring deleted stops
    if (isMultiStopParam === 'true' && returnedSpotId && !hasRestoredStops.current) {
      console.log('🔄 Restoring multi-stop state (returning from explore)');
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
        // No stops param means empty array (user deleted all stops)
        setStops([]);
        hasRestoredStops.current = true;
      }
    }
  }, [isMultiStopParam, stopsParam, returnedSpotId]);

  // Get user's current layover or upcoming layover
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      console.log('👤 Fetching user data, layoverId:', layoverId);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        // Build list of available layovers
        const layoverOptions: any[] = [];
        
        // Add current layover if exists
        if (data.currentLayover?.city) {
          layoverOptions.push({
            id: 'current',
            city: data.currentLayover.city,
            area: data.currentLayover.area,
            startDate: data.currentLayover.startDate || Timestamp.now(),
            endDate: data.currentLayover.endDate || Timestamp.now(),
            isCurrent: true,
          });
        }
        
        // Add upcoming layovers
        if (data.upcomingLayovers && Array.isArray(data.upcomingLayovers)) {
          data.upcomingLayovers.forEach((l: any) => {
            layoverOptions.push({
              ...l,
              isCurrent: false,
            });
          });
        }
        
        console.log('🛫 Available layovers:', layoverOptions.length);
        setAvailableLayovers(layoverOptions);
        
        // Handle layover selection logic
        if (layoverId) {
          // Specific layover ID was passed in URL
          const foundLayover = layoverOptions.find((l: any) => l.id === layoverId);
          if (foundLayover) {
            console.log('✅ Found layover from URL:', foundLayover);
            setLayover(foundLayover);
            setSelectedLayoverId(layoverId);
            setCurrentCity(foundLayover.city);
            setCurrentArea(foundLayover.area);
            
            // Auto-generate title if empty
            if (!title) {
              const date = foundLayover.startDate?.toDate?.() || new Date();
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              setTitle(`${foundLayover.city} - ${dateStr}`);
            }
            
            if (foundLayover.startDate?.toDate) {
              setScheduledDate(foundLayover.startDate.toDate());
            }
          }
        } else if (layoverOptions.length === 0) {
          // No layovers at all - show alert and go back
          Alert.alert(
            'Add a Layover First',
            'You need to add a layover before creating plans.',
            [
              {
                text: 'Add Layover',
                onPress: () => router.replace('/(tabs)/'),
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => router.back(),
              },
            ]
          );
        } else if (layoverOptions.length === 1) {
          // Only one layover - auto-select it
          const onlyLayover = layoverOptions[0];
          console.log('✅ Auto-selecting only layover:', onlyLayover);
          setLayover(onlyLayover);
          setSelectedLayoverId(onlyLayover.id);
          setCurrentCity(onlyLayover.city);
          setCurrentArea(onlyLayover.area);
          
          if (!title) {
            const date = onlyLayover.startDate?.toDate?.() || new Date();
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            setTitle(`${onlyLayover.city} - ${dateStr}`);
          }
          
          if (onlyLayover.startDate?.toDate) {
            setScheduledDate(onlyLayover.startDate.toDate());
          }
        } else {
          // Multiple layovers - show picker
          console.log('🔍 Multiple layovers, showing picker');
          setShowLayoverPicker(true);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, [user, layoverId]);

  // Fetch spots in current city
  useEffect(() => {
    console.log('🏙️ Fetching spots for city:', currentCity);
    if (!currentCity) {
      console.log('❌ No currentCity set, skipping spots fetch');
      return;
    }

    const fetchSpots = async () => {
      try {
        console.log('📍 Starting spots query for:', currentCity);
        
        const q = query(
          collection(db, 'spots'),
          where('city', '==', currentCity),
          limit(100)
        );

        const snapshot = await getDocs(q);
        console.log('✅ Spots query returned:', snapshot.size, 'spots');
        
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
        
        // Sort by name manually
        spotsList.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('📋 Spots list:', spotsList.map(s => s.name).join(', '));
        setSpots(spotsList);
      } catch (error) {
        console.error('❌ Error fetching spots:', error);
      }
    };

    fetchSpots();
  }, [currentCity]);

  const selectLayover = (layoverToSelect: any) => {
    console.log('✅ User selected layover:', layoverToSelect);
    setLayover(layoverToSelect);
    setSelectedLayoverId(layoverToSelect.id);
    setCurrentCity(layoverToSelect.city);
    setCurrentArea(layoverToSelect.area);
    
    // Auto-generate title if empty
    if (!title) {
      const date = layoverToSelect.startDate?.toDate?.() || new Date();
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setTitle(`${layoverToSelect.city} - ${dateStr}`);
    }
    
    if (layoverToSelect.startDate?.toDate) {
      setScheduledDate(layoverToSelect.startDate.toDate());
    }
    
    setShowLayoverPicker(false);
  };

  const addStop = () => {
    console.log('🔍 addStop called, selectedSpotId:', selectedSpotId);
    console.log('📍 Available spots:', spots.length);
    
    // Validate we have both ID and name
    if (!selectedSpotId || !selectedSpotName) {
      console.log('❌ Missing spot data:', { selectedSpotId, selectedSpotName });
      Alert.alert('Error', 'Please select a spot first');
      return;
    }

    // Try to find spot in array for address, but it's okay if not found
    const spot = spots.find(s => s.id === selectedSpotId);
    console.log('✅ Found spot in array:', spot);

    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      spotId: selectedSpotId,
      spotName: selectedSpotName, // Use the name we already have
      spotAddress: spot?.address, // Optional - only if we found it
      scheduledTime: new Date(scheduledDate),
      order: stops.length,
    };

    console.log('➕ Adding stop:', newStop);
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
        layoverId: selectedLayoverId || layoverId || null,
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
                        // Encode existing stops to preserve them
                        const stopsData = encodeURIComponent(JSON.stringify(stops));
                        router.push(`/explore?city=${currentCity}&selectionMode=true&returnTo=create-plan${layoverId ? `&layoverId=${layoverId}` : ''}&isMultiStop=true&stops=${stopsData}`);
                      }}
                    >
                      <ThemedText style={selectedSpotId ? styles.selectorTextSelected : styles.selectorTextPlaceholder}>
                        {selectedSpotName || 'Browse spots...'}
                      </ThemedText>
                      <Ionicons name="search" size={20} color={Colors.text.secondary} />
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

                    {/* Debug: Show selected spot */}
                    {__DEV__ && (
                      <View style={{ padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginTop: 8 }}>
                        <ThemedText style={{ fontSize: 12, color: '#666' }}>
                          DEBUG - Selected: {selectedSpotId || 'none'} / {selectedSpotName || 'none'}
                        </ThemedText>
                      </View>
                    )}

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
                        router.push(`/explore?city=${currentCity}&selectionMode=true&returnTo=create-plan${layoverId ? `&layoverId=${layoverId}` : ''}`);
                      }}
                    >
                      <ThemedText style={selectedSpotId ? styles.selectorTextSelected : styles.selectorTextPlaceholder}>
                        {selectedSpotName || 'Browse spots...'}
                      </ThemedText>
                      <Ionicons name="search" size={20} color={Colors.text.secondary} />
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

            {/* Spot Selector Modal - Now using explore page instead */}
            {/* <SpotSelector
              visible={showSpotSelector}
              spots={spots}
              onClose={() => setShowSpotSelector(false)}
              onSelect={(spotId, spotName) => {
                console.log('🎯 Spot selected:', { spotId, spotName });
                setSelectedSpotId(spotId);
                setSelectedSpotName(spotName);
                setShowSpotSelector(false);
                if (!title && !isMultiStop) {
                  setTitle(spotName);
                }
              }}
            /> */}

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

            {/* Layover Picker Modal */}
            <Modal
              visible={showLayoverPicker}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => {
                if (availableLayovers.length > 0) {
                  setShowLayoverPicker(false);
                  router.back();
                }
              }}
            >
              <ThemedView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => {
                    setShowLayoverPicker(false);
                    router.back();
                  }}>
                    <Ionicons name="close" size={28} color={Colors.text.primary} />
                  </TouchableOpacity>
                  <ThemedText style={styles.modalTitle}>Select Layover</ThemedText>
                  <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.modalContent}>
                  <ThemedText style={styles.modalDescription}>
                    Which layover is this plan for?
                  </ThemedText>

                  {availableLayovers.map((layover) => (
                    <TouchableOpacity
                      key={layover.id}
                      style={styles.layoverOption}
                      onPress={() => selectLayover(layover)}
                    >
                      <View style={styles.layoverOptionContent}>
                        <View style={styles.layoverIconContainer}>
                          <Ionicons 
                            name={layover.isCurrent ? "location" : "airplane"} 
                            size={24} 
                            color={layover.isCurrent ? Colors.success : Colors.primary} 
                          />
                        </View>
                        <View style={styles.layoverDetails}>
                          <View style={styles.layoverTitleRow}>
                            <ThemedText style={styles.layoverOptionCity}>
                              {layover.city}
                            </ThemedText>
                            {layover.isCurrent && (
                              <View style={styles.currentBadge}>
                                <ThemedText style={styles.currentBadgeText}>Current</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={styles.layoverOptionArea}>
                            {layover.area}
                          </ThemedText>
                          <ThemedText style={styles.layoverOptionDates}>
                            {layover.startDate?.toDate?.().toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })} - {layover.endDate?.toDate?.().toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </ThemedText>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </ThemedView>
            </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  layoverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layoverOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  layoverIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoverDetails: {
    flex: 1,
  },
  layoverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  layoverOptionCity: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  currentBadge: {
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  layoverOptionArea: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  layoverOptionDates: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
});
