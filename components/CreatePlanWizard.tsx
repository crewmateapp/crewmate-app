// components/CreatePlanWizard.tsx
// 5-Step Create Plan Wizard with Combined Search/Filter in Step 1
import { ThemedText } from '@/components/themed-text';
import { CMSAnimationContainer } from '@/components/CMSAnimationContainer';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/use-theme-color';
import { useCMSTracking } from '@/hooks/useCMSTracking';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;
const STEP_1_HEIGHT = SCREEN_HEIGHT * 0.85; // Taller for search/browse
const FULL_SCREEN_HEIGHT = SCREEN_HEIGHT * 0.95;

// Category options matching your spot categories
const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🌟', spotTypes: [] }, // Special "all" category
  { id: 'coffee', label: 'Coffee', emoji: '☕', spotTypes: ['coffee'] },
  { id: 'food', label: 'Food', emoji: '🍽️', spotTypes: ['food', 'breakfast', 'lunch', 'dinner', 'fastfood', 'restaurant'] },
  { id: 'drinks', label: 'Drinks', emoji: '🍺', spotTypes: ['bar', 'cocktail', 'wine', 'brewery', 'lounge'] },
  { id: 'nightlife', label: 'Nightlife', emoji: '🪩', spotTypes: ['club', 'karaoke'] },
  { id: 'activity', label: 'Activity', emoji: '🎯', spotTypes: ['activity', 'museum', 'park', 'shopping', 'arcade', 'bowling', 'movies', 'sports'] },
  { id: 'wellness', label: 'Wellness', emoji: '💆', spotTypes: ['gym', 'yoga', 'spa', 'massage', 'salon'] },
  { id: 'outdoors', label: 'Outdoors', emoji: '🌳', spotTypes: ['beach', 'hiking', 'park', 'viewpoint'] },
  { id: 'other', label: 'Other', emoji: '✨', spotTypes: ['other', 'landmark'] },
];

type Spot = {
  id: string;
  name: string;
  city: string;
  address?: string;
  categories?: string[];
  category?: string; // Legacy field
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

interface CreatePlanWizardProps {
  isOpen: boolean;
  onClose: () => void;
  layoverId?: string;
  layoverCity?: string;
  preSelectedSpot?: Spot; // NEW: Pre-fill spot from context (e.g., from spot page)
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function CreatePlanWizard({ isOpen, onClose, layoverId, layoverCity, preSelectedSpot }: CreatePlanWizardProps) {
  const { user } = useAuth();
  const colors = useColors();
  const cmsTracking = useCMSTracking();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // User profile state
  const [userName, setUserName] = useState<string>('');
  
  // Form data
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // Start with "All"
  const [searchQuery, setSearchQuery] = useState<string>(''); // NEW: Search functionality
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [isMultiStop, setIsMultiStop] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'invite_only'>('public');
  
  // UI state
  const [spots, setSpots] = useState<Spot[]>([]); // ALL spots loaded at once
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [cityName, setCityName] = useState(layoverCity || '');
  
  // Multi-stop modal state
  const [showSpotPicker, setShowSpotPicker] = useState(false);
  const [showTimePicker2, setShowTimePicker2] = useState(false);
  const [showEditStopModal, setShowEditStopModal] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [editStopTime, setEditStopTime] = useState(new Date());
  const [newStopTime, setNewStopTime] = useState(new Date());
  const [newStopSpot, setNewStopSpot] = useState<Spot | null>(null);
  
  // Animation
  const sheetHeight = useState(new Animated.Value(0))[0];

  // Load user's name from profile
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Try multiple fields for the user's name
          const name = userData.name || userData.displayName || userData.fullName || 'Unknown';
          setUserName(name);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserName('Unknown');
      }
    };
    
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen, user]);

  // Load city name from layover
  useEffect(() => {
    const loadLayover = async () => {
      if (!layoverId || !user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const layover = data.upcomingLayovers?.find((l: any) => l.id === layoverId);
          if (layover) {
            setCityName(layover.city);
            // Auto-populate date/time from layover start
            if (layover.startDate) {
              const layoverStart = layover.startDate.toDate();
              setScheduledDate(layoverStart);
              setScheduledTime(layoverStart);
            }
          }
        }
      } catch (error) {
        console.error('Error loading layover:', error);
      }
    };
    
    if (isOpen) {
      loadLayover();
    }
  }, [isOpen, layoverId, user]);

  // Handle pre-selected spot (e.g., from spot detail page)
  useEffect(() => {
    if (isOpen && preSelectedSpot) {
      console.log('🎯 Pre-selected spot:', preSelectedSpot.name);
      setSelectedSpot(preSelectedSpot);
      // Skip to Step 2 (When?) since spot is already chosen
      setCurrentStep(2);
      setIsFullScreen(true); // Step 2 is full screen
    }
  }, [isOpen, preSelectedSpot]);

  // Animate sheet in/out
  useEffect(() => {
    if (isOpen) {
      // Determine height based on current step
      let targetHeight = BOTTOM_SHEET_HEIGHT;
      
      if (currentStep === 1) {
        targetHeight = STEP_1_HEIGHT; // Taller for search/browse
      } else if (isFullScreen) {
        targetHeight = FULL_SCREEN_HEIGHT;
      }
      
      Animated.spring(sheetHeight, {
        toValue: targetHeight,
        useNativeDriver: false,
        damping: 20,
      }).start();
    } else {
      Animated.timing(sheetHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [isOpen, isFullScreen, currentStep]);

  // Load ALL spots when wizard opens (for search/filter)
  useEffect(() => {
    const loadAllSpots = async () => {
      if (!cityName || !isOpen) return;
      
      console.log('🔍 Loading all spots in city:', cityName);
      setLoadingSpots(true);
      
      try {
        const spotsQuery = query(
          collection(db, 'spots'),
          where('city', '==', cityName),
          where('status', '==', 'approved')
        );
        
        const snapshot = await getDocs(spotsQuery);
        const loadedSpots: Spot[] = [];
        
        snapshot.forEach((doc) => {
          const spotData = doc.data() as Spot;
          loadedSpots.push({
            id: doc.id,
            name: spotData.name,
            city: spotData.city,
            address: spotData.address,
            categories: spotData.categories,
            category: spotData.category, // Legacy field
          });
        });
        
        // Sort alphabetically
        loadedSpots.sort((a, b) => a.name.localeCompare(b.name));
        console.log('📊 Loaded spots:', loadedSpots.length);
        setSpots(loadedSpots);
      } catch (error) {
        console.error('Error loading spots:', error);
        Alert.alert('Error', 'Failed to load spots');
      } finally {
        setLoadingSpots(false);
      }
    };
    
    loadAllSpots();
  }, [cityName, isOpen]);

  // Filter spots based on search query and selected category
  const getFilteredSpots = (): Spot[] => {
    let filtered = spots;
    
    // Filter by category (if not "all")
    if (selectedCategory !== 'all') {
      const category = CATEGORIES.find(c => c.id === selectedCategory);
      if (category) {
        filtered = filtered.filter(spot => {
          // Handle both array and string category formats
          if (spot.categories && Array.isArray(spot.categories)) {
            // Check if any of the spot's categories match the selected category's spotTypes
            return spot.categories.some(cat => 
              category.spotTypes.includes(cat.toLowerCase())
            );
          } else if (spot.category) {
            // Legacy string format
            return category.spotTypes.includes(spot.category.toLowerCase());
          }
          return false;
        });
      }
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(spot => {
        const nameMatch = spot.name.toLowerCase().includes(query);
        const addressMatch = spot.address?.toLowerCase().includes(query);
        return nameMatch || addressMatch;
      });
    }
    
    return filtered;
  };

  const handleClose = () => {
    // Reset all state
    setCurrentStep(1);
    setIsFullScreen(false);
    setSelectedCategory('all');
    setSearchQuery('');
    setSelectedSpot(null);
    setScheduledDate(new Date());
    setScheduledTime(new Date());
    setIsMultiStop(false);
    setStops([]);
    setDescription('');
    setVisibility('public');
    setSpots([]);
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 1) {
      handleClose();
    } else if (currentStep === 2) {
      // Going back from Step 2
      if (preSelectedSpot) {
        // If spot was pre-selected, allow going to Step 1 to change it
        setCurrentStep(1);
        setIsFullScreen(false);
      } else {
        // Normal flow - Step 2 back to Step 1
        setCurrentStep(1);
        setIsFullScreen(false);
      }
    } else if (currentStep === 3) {
      // Going back from step 3, return to bottom sheet
      setCurrentStep(2);
      setIsFullScreen(true);
    } else if (currentStep === 4 || currentStep === 5) {
      // Going back from steps 4-5
      setCurrentStep((currentStep - 1) as Step);
      if (currentStep === 4) {
        // Stay full screen
        setIsFullScreen(true);
      } else {
        // Going to step 4 from step 5
        setIsFullScreen(false);
      }
    } else {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 1 && !selectedSpot) {
      Alert.alert('Select Spot', 'Please select a spot to continue');
      return;
    }
    
    // Transition logic
    if (currentStep === 1) {
      // Going to step 2, expand to full screen
      setIsFullScreen(true);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Going to step 3, stay full screen
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Going to step 4, return to bottom sheet
      setIsFullScreen(false);
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Going to step 5 (review), stay bottom sheet
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // Submit the plan
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!selectedSpot || !user) return;
    
    setSubmitting(true);
    
    try {
      // Combine date and time
      const combinedDateTime = new Date(scheduledDate);
      combinedDateTime.setHours(scheduledTime.getHours());
      combinedDateTime.setMinutes(scheduledTime.getMinutes());
      
      const planData: any = {
        hostUserId: user.uid,
        hostName: userName || 'Unknown',
        hostPhoto: user.photoURL || '',
        title: selectedSpot.name,
        spotId: selectedSpot.id,
        spotName: selectedSpot.name,
        spotAddress: selectedSpot.address || '',
        city: cityName,
        scheduledTime: Timestamp.fromDate(combinedDateTime),
        description,
        visibility,
        attendeeIds: [user.uid],
        attendeeCount: 1,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Add layover reference if coming from layover page
      if (layoverId) {
        planData.layoverId = layoverId;
      }
      
      // Add multi-stop data if enabled
      if (isMultiStop && stops.length > 0) {
        planData.isMultiStop = true;
        planData.stops = stops.map(stop => ({
          id: stop.id,
          spotId: stop.spotId,
          spotName: stop.spotName,
          spotAddress: stop.spotAddress || '',
          scheduledTime: Timestamp.fromDate(stop.scheduledTime),
          duration: stop.duration || 60,
          notes: stop.notes || '',
          order: stop.order,
        }));
      }
      
      const planRef = await addDoc(collection(db, 'plans'), planData);
      
      // ✨ TRACKING: Track plan creation (NO CMS yet - awaiting check-in)
      try {
        await cmsTracking.trackPlanCreated(user.uid, planRef.id);
      } catch (error) {
        console.error('Error tracking plan creation:', error);
        // Don't fail the plan creation if tracking fails
      }
      
      // Plan created successfully - close quickly since no animations
      setSubmitting(false); // Re-enable the button
      
      // Show success message
      Alert.alert(
        'Plan Created!',
        'Check in at the location to earn CMS and count toward badges.',
        [{ text: 'Got it!', onPress: () => handleClose() }]
      );
      
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Error', 'Failed to create plan. Please try again.');
      setSubmitting(false);
    }
  };

  // Multi-stop handlers
  const handleAddStop = () => {
    // Set default time to 1 hour after last stop or scheduled time
    const lastTime = stops.length > 0 
      ? stops[stops.length - 1].scheduledTime 
      : new Date(scheduledDate);
    lastTime.setHours(scheduledTime.getHours());
    lastTime.setMinutes(scheduledTime.getMinutes());
    
    const defaultTime = new Date(lastTime);
    defaultTime.setHours(defaultTime.getHours() + 1);
    
    setNewStopTime(defaultTime);
    setNewStopSpot(null);
    setShowSpotPicker(true);
  };

  const confirmAddStop = () => {
    if (!newStopSpot) {
      Alert.alert('Select Spot', 'Please select a spot for this stop');
      return;
    }
    
    // Check if this is the first stop - auto-add starting point
    if (stops.length === 0 && selectedSpot) {
      // Add the originally selected spot as "Starting Point"
      const startingPoint: Stop = {
        id: 'first-stop',
        spotId: selectedSpot.id,
        spotName: selectedSpot.name,
        spotAddress: selectedSpot.address,
        scheduledTime: new Date(scheduledDate),
        duration: 60,
        notes: 'Starting point',
        order: 0,
      };
      startingPoint.scheduledTime.setHours(scheduledTime.getHours());
      startingPoint.scheduledTime.setMinutes(scheduledTime.getMinutes());
      
      // Add new stop
      const newStop: Stop = {
        id: Date.now().toString(),
        spotId: newStopSpot.id,
        spotName: newStopSpot.name,
        spotAddress: newStopSpot.address,
        scheduledTime: newStopTime,
        duration: 60,
        notes: '',
        order: 1,
      };
      
      // Sort by time and update order
      const allStops = [startingPoint, newStop];
      const sortedStops = sortStopsByTime(allStops);
      setStops(sortedStops);
    } else {
      // Add additional stop
      const newStop: Stop = {
        id: Date.now().toString(),
        spotId: newStopSpot.id,
        spotName: newStopSpot.name,
        spotAddress: newStopSpot.address,
        scheduledTime: newStopTime,
        duration: 60,
        notes: '',
        order: stops.length,
      };
      
      // Sort by time and update order
      const allStops = [...stops, newStop];
      const sortedStops = sortStopsByTime(allStops);
      setStops(sortedStops);
    }
    
    setShowSpotPicker(false);
  };

  // Sort stops by scheduled time and update order values
  const sortStopsByTime = (stopsToSort: Stop[]): Stop[] => {
    return stopsToSort
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
      .map((stop, index) => ({ ...stop, order: index }));
  };

  const removeStop = (stopId: string) => {
    const updatedStops = stops.filter(s => s.id !== stopId);
    const sortedStops = sortStopsByTime(updatedStops);
    setStops(sortedStops);
  };

  const handleEditStop = (stop: Stop) => {
    setEditingStop(stop);
    setEditStopTime(new Date(stop.scheduledTime));
    setShowEditStopModal(true);
  };

  const confirmEditStop = () => {
    if (!editingStop) return;
    
    const updatedStops = stops.map(stop => 
      stop.id === editingStop.id 
        ? { ...stop, scheduledTime: editStopTime }
        : stop
    );
    
    // Re-sort by time after editing
    const sortedStops = sortStopsByTime(updatedStops);
    setStops(sortedStops);
    setShowEditStopModal(false);
    setEditingStop(null);
  };

  // Date/Time picker handlers
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setScheduledTime(selectedTime);
    }
  };

  const onStopTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker2(Platform.OS === 'ios');
    if (selectedTime) {
      setNewStopTime(selectedTime);
    }
  };

  const onEditStopTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowEditStopModal(false);
    }
    if (selectedTime) {
      setEditStopTime(selectedTime);
    }
  };

  const renderStep = () => {
    const filteredSpots = getFilteredSpots();
    
    switch (currentStep) {
      case 1:
        // STEP 1: Combined Search + Category Filter + Spots
        return (
          <View style={styles.stepContainer}>
            <ThemedText style={styles.stepTitle}>Where?</ThemedText>
            <ThemedText style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
              Search or browse spots in {cityName}
            </ThemedText>
            
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.text.secondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search spots (e.g., taco, rooftop, cheap...)"
                placeholderTextColor={colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Category Chips (Horizontal Scroll) */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selectedCategory === category.id ? colors.primary : colors.card,
                      borderColor: selectedCategory === category.id ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.categoryChipEmoji}>{category.emoji}</ThemedText>
                  <ThemedText 
                    style={[
                      styles.categoryChipLabel,
                      { color: selectedCategory === category.id ? Colors.white : colors.text.primary }
                    ]}
                  >
                    {category.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Results Counter */}
            {!loadingSpots && filteredSpots.length > 0 && (
              <View style={styles.resultsHeader}>
                <ThemedText style={[styles.resultsCount, { color: colors.text.secondary }]}>
                  {filteredSpots.length} {filteredSpots.length === 1 ? 'spot' : 'spots'}
                </ThemedText>
                {filteredSpots.length > 3 && (
                  <ThemedText style={[styles.scrollHint, { color: colors.text.secondary }]}>
                    Scroll to see more ↓
                  </ThemedText>
                )}
              </View>
            )}
            
            {/* Spots List */}
            {loadingSpots ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={[styles.loadingText, { color: colors.text.secondary }]}>
                  Loading spots...
                </ThemedText>
              </View>
            ) : filteredSpots.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color={colors.text.secondary} />
                <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
                  {searchQuery ? `No spots found for "${searchQuery}"` : 
                   selectedCategory !== 'all' ? 'No spots in this category' :
                   'No approved spots in this city yet'}
                </ThemedText>
                {(searchQuery || selectedCategory !== 'all') && (
                  <TouchableOpacity 
                    style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                  >
                    <ThemedText style={styles.clearFiltersText}>Clear Filters</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView 
                style={styles.spotsList} 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.spotsListContent}
              >
                {filteredSpots.map((spot) => (
                  <TouchableOpacity
                    key={spot.id}
                    style={[
                      styles.spotCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: selectedSpot?.id === spot.id ? colors.primary : colors.border,
                        borderWidth: selectedSpot?.id === spot.id ? 2 : 1,
                      }
                    ]}
                    onPress={() => setSelectedSpot(spot)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.spotInfo}>
                      <ThemedText style={styles.spotName}>{spot.name}</ThemedText>
                      {spot.address && (
                        <ThemedText style={[styles.spotAddress, { color: colors.text.secondary }]}>
                          {spot.address}
                        </ThemedText>
                      )}
                    </View>
                    {selectedSpot?.id === spot.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );
        
      case 2:
        // STEP 2: When?
        return (
          <KeyboardAvoidingView 
            style={styles.stepContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ThemedText style={styles.stepTitle}>When?</ThemedText>
            <ThemedText style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
              Select date and time for your plan
            </ThemedText>
            
            <View style={styles.dateTimeSection}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <ThemedText style={styles.dateTimeText}>
                  {scheduledDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <ThemedText style={styles.dateTimeText}>
                  {scheduledTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </ThemedText>
              </TouchableOpacity>
            </View>
            
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
            
            {showTimePicker && (
              <DateTimePicker
                value={scheduledTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
              />
            )}
          </KeyboardAvoidingView>
        );
        
      case 3:
        // STEP 3: Multi-Stop?
        return (
          <KeyboardAvoidingView 
            style={styles.stepContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ThemedText style={styles.stepTitle}>Multi-Stop?</ThemedText>
            <ThemedText style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
              Add multiple stops to your plan (optional)
            </ThemedText>
            
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <ThemedText style={styles.toggleLabel}>Multi-Stop Plan</ThemedText>
                <ThemedText style={[styles.toggleSubtext, { color: colors.text.secondary }]}>
                  Create an itinerary with multiple stops
                </ThemedText>
              </View>
              <Switch
                value={isMultiStop}
                onValueChange={setIsMultiStop}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
            
            {isMultiStop && (
              <View style={styles.stopsSection}>
                <View style={styles.stopsHeader}>
                  <ThemedText style={styles.stopsTitle}>Stops ({stops.length})</ThemedText>
                  <TouchableOpacity
                    style={[styles.addStopButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddStop}
                  >
                    <Ionicons name="add" size={20} color={Colors.white} />
                    <ThemedText style={styles.addStopText}>Add Stop</ThemedText>
                  </TouchableOpacity>
                </View>
                
                {stops.length === 0 ? (
                  <View style={[styles.emptyStops, { borderColor: colors.border }]}>
                    <ThemedText style={[styles.emptyStopsText, { color: colors.text.secondary }]}>
                      No stops added yet. The first stop will be "{selectedSpot?.name}" at your scheduled time.
                    </ThemedText>
                  </View>
                ) : (
                  <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
                    {stops.map((stop, index) => (
                      <View
                        key={stop.id}
                        style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={styles.stopHeader}>
                          <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
                            <ThemedText style={styles.stopNumberText}>{index + 1}</ThemedText>
                          </View>
                          <View style={styles.stopInfo}>
                            <ThemedText style={styles.stopName}>{stop.spotName}</ThemedText>
                            {stop.id === 'first-stop' && (
                              <ThemedText style={[styles.stopLabel, { color: colors.primary }]}>
                                Starting Point
                              </ThemedText>
                            )}
                            <ThemedText style={[styles.stopTime, { color: colors.text.secondary }]}>
                              {stop.scheduledTime.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}
                            </ThemedText>
                          </View>
                          <View style={styles.stopActions}>
                            <TouchableOpacity 
                              style={styles.stopActionButton}
                              onPress={() => handleEditStop(stop)}
                            >
                              <Ionicons name="pencil" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.stopActionButton}
                              onPress={() => removeStop(stop.id)}
                            >
                              <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        );
        
      case 4:
        // STEP 4: Details
        return (
          <KeyboardAvoidingView 
            style={styles.stepContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView 
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 100 }}
              bounces={true}
            >
              <ThemedText style={styles.stepTitle}>Details</ThemedText>
              <ThemedText style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
                Add a description and set visibility
              </ThemedText>
              
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Description (Optional)</ThemedText>
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: colors.card, 
                    borderColor: colors.border,
                    color: colors.text.primary
                  }]}
                  placeholder="What's the plan? Add any details..."
                  placeholderTextColor={colors.text.secondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Who can see this plan?</ThemedText>
                
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    { 
                      backgroundColor: colors.card,
                      borderColor: visibility === 'public' ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setVisibility('public')}
                >
                  <View style={styles.visibilityInfo}>
                    <Ionicons name="globe-outline" size={24} color={colors.primary} />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Public</ThemedText>
                      <ThemedText style={[styles.visibilitySubtext, { color: colors.text.secondary }]}>
                        All crew in {cityName} can see and join
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'public' && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    { 
                      backgroundColor: colors.card,
                      borderColor: visibility === 'connections' ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setVisibility('connections')}
                >
                  <View style={styles.visibilityInfo}>
                    <Ionicons name="people-outline" size={24} color={colors.primary} />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Connections Only</ThemedText>
                      <ThemedText style={[styles.visibilitySubtext, { color: colors.text.secondary }]}>
                        Only your connections can see and join
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'connections' && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    { 
                      backgroundColor: colors.card,
                      borderColor: visibility === 'invite_only' ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setVisibility('invite_only')}
                >
                  <View style={styles.visibilityInfo}>
                    <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
                    <View style={styles.visibilityText}>
                      <ThemedText style={styles.visibilityTitle}>Invite Only</ThemedText>
                      <ThemedText style={[styles.visibilitySubtext, { color: colors.text.secondary }]}>
                        Only people you invite can see this plan
                      </ThemedText>
                    </View>
                  </View>
                  {visibility === 'invite_only' && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        );
        
      case 5:
        // STEP 5: Review
        return (
          <ScrollView 
            style={styles.reviewStepContainer}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.reviewScrollContent}
            bounces={true}
          >
            <ThemedText style={styles.stepTitle}>Review</ThemedText>
            <ThemedText style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
              Confirm your plan details
            </ThemedText>
            
            {/* Main Plan Info */}
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Only show single spot if NOT multi-stop */}
              {!isMultiStop && (
                <View style={styles.reviewRow}>
                  <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>Spot</ThemedText>
                  <ThemedText style={styles.reviewValue}>{selectedSpot?.name}</ThemedText>
                </View>
              )}
              
              <View style={styles.reviewRow}>
                <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>Location</ThemedText>
                <ThemedText style={styles.reviewValue}>{cityName}</ThemedText>
              </View>
              
              {/* Only show single date/time if NOT multi-stop */}
              {!isMultiStop && (
                <>
                  <View style={styles.reviewRow}>
                    <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>Date</ThemedText>
                    <ThemedText style={styles.reviewValue}>
                      {scheduledDate.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.reviewRow}>
                    <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>Time</ThemedText>
                    <ThemedText style={styles.reviewValue}>
                      {scheduledTime.toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </ThemedText>
                  </View>
                </>
              )}
              
              {isMultiStop && stops.length > 0 && (
                <View style={styles.reviewRow}>
                  <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>
                    Type
                  </ThemedText>
                  <ThemedText style={styles.reviewValue}>Multi-Stop Plan ({stops.length} stops)</ThemedText>
                </View>
              )}
              
              {description && (
                <View style={styles.reviewRow}>
                  <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>
                    Description
                  </ThemedText>
                  <ThemedText style={styles.reviewValue}>{description}</ThemedText>
                </View>
              )}
              
              <View style={styles.reviewRow}>
                <ThemedText style={[styles.reviewLabel, { color: colors.text.secondary }]}>
                  Visibility
                </ThemedText>
                <ThemedText style={styles.reviewValue}>
                  {visibility === 'public' ? 'Public' : 
                   visibility === 'connections' ? 'Connections Only' : 'Invite Only'}
                </ThemedText>
              </View>
            </View>
            
            {/* Itinerary Section - More Prominent */}
            {isMultiStop && stops.length > 0 && (
              <View style={styles.itinerarySection}>
                <View style={styles.itineraryHeader}>
                  <ThemedText style={styles.reviewSectionTitle}>Itinerary</ThemedText>
                  <ThemedText style={[styles.itinerarySubtitle, { color: colors.text.secondary }]}>
                    {scheduledDate.toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </ThemedText>
                </View>
                {stops.map((stop, index) => (
                  <View 
                    key={stop.id}
                    style={[styles.reviewStopCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
                      <ThemedText style={styles.stopNumberText}>{index + 1}</ThemedText>
                    </View>
                    <View style={styles.reviewStopInfo}>
                      <ThemedText style={styles.reviewStopName}>{stop.spotName}</ThemedText>
                      {stop.id === 'first-stop' && (
                        <ThemedText style={[styles.stopLabel, { color: colors.primary, fontSize: 11 }]}>
                          Starting Point
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.reviewStopTime, { color: colors.text.secondary }]}>
                        {stop.scheduledTime.toLocaleTimeString('en-US', { 
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        );
        
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                height: sheetHeight,
                backgroundColor: colors.background,
              }
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              
              <View style={styles.headerCenter}>
                <ThemedText style={styles.headerTitle}>
                  {preSelectedSpot && currentStep > 1 ? selectedSpot?.name : 'Create Plan'}
                </ThemedText>
                <ThemedText style={[styles.headerStep, { color: colors.text.secondary }]}>
                  Step {currentStep} of 5
                </ThemedText>
              </View>
              
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={styles.content}>
              {renderStep()}
            </View>
            
            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  { 
                    backgroundColor: (currentStep === 1 && !selectedSpot) ? colors.border : colors.primary,
                    opacity: (currentStep === 1 && !selectedSpot) ? 0.5 : 1
                  }
                ]}
                onPress={handleNext}
                disabled={(currentStep === 1 && !selectedSpot) || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.nextButtonText}>
                    {currentStep === 5 ? 'Create Plan' : 'Next'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
      
      {/* Multi-Stop Spot Picker Modal */}
      <Modal
        visible={showSpotPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSpotPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModal, { backgroundColor: colors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={styles.pickerTitle}>Select Stop</ThemedText>
              <TouchableOpacity onPress={() => setShowSpotPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.pickerContent}>
              {spots.map((spot) => (
                <TouchableOpacity
                  key={spot.id}
                  style={[
                    styles.pickerSpotCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: newStopSpot?.id === spot.id ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setNewStopSpot(spot)}
                >
                  <View style={styles.spotInfo}>
                    <ThemedText style={styles.spotName}>{spot.name}</ThemedText>
                    {spot.address && (
                      <ThemedText style={[styles.spotAddress, { color: colors.text.secondary }]}>
                        {spot.address}
                      </ThemedText>
                    )}
                  </View>
                  {newStopSpot?.id === spot.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.pickerTimeSection}>
              <ThemedText style={styles.pickerTimeLabel}>Stop Time</ThemedText>
              <TouchableOpacity
                style={[styles.pickerTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowTimePicker2(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <ThemedText style={styles.dateTimeText}>
                  {newStopTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </ThemedText>
              </TouchableOpacity>
            </View>
            
            {showTimePicker2 && (
              <DateTimePicker
                value={newStopTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onStopTimeChange}
              />
            )}
            
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={[styles.pickerConfirmButton, { backgroundColor: colors.primary }]}
                onPress={confirmAddStop}
              >
                <ThemedText style={styles.pickerConfirmText}>Add Stop</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Edit Stop Time Modal */}
      <Modal
        visible={showEditStopModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditStopModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editStopModal, { backgroundColor: colors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={styles.pickerTitle}>Edit Stop Time</ThemedText>
              <TouchableOpacity onPress={() => setShowEditStopModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.editStopContent}>
              <View style={styles.editStopInfo}>
                <ThemedText style={styles.editStopName}>{editingStop?.spotName}</ThemedText>
                {editingStop?.id === 'first-stop' && (
                  <ThemedText style={[styles.stopLabel, { color: colors.primary }]}>
                    Starting Point
                  </ThemedText>
                )}
              </View>
              
              <View style={styles.pickerTimeSection}>
                <ThemedText style={styles.pickerTimeLabel}>Scheduled Time</ThemedText>
                <TouchableOpacity
                  style={[styles.pickerTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      // iOS shows inline picker
                    } else {
                      // Android shows native picker
                      setShowEditStopModal(true);
                    }
                  }}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <ThemedText style={styles.dateTimeText}>
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
              
              {Platform.OS === 'android' && showEditStopModal && (
                <DateTimePicker
                  value={editStopTime}
                  mode="time"
                  display="default"
                  onChange={onEditStopTimeChange}
                />
              )}
              
              <ThemedText style={[styles.editStopHint, { color: colors.text.secondary }]}>
                Stops will automatically reorder by time
              </ThemedText>
            </View>
            
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={[styles.pickerConfirmButton, { backgroundColor: colors.primary }]}
                onPress={confirmEditStop}
              >
                <ThemedText style={styles.pickerConfirmText}>Save Time</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* CMS Animations */}
      <CMSAnimationContainer tracking={cmsTracking} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 32,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerStep: {
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  
  // Category Chips
  categoriesScroll: {
    marginBottom: 10,
    maxHeight: 44,
  },
  categoriesScrollContent: {
    paddingRight: 20,
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipEmoji: {
    fontSize: 15,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Results Header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollHint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Spots List
  spotsList: {
    flex: 1,
  },
  spotsListContent: {
    paddingBottom: 16,
  },
  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  spotInfo: {
    flex: 1,
  },
  spotName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  spotAddress: {
    fontSize: 13,
  },
  
  // Date/Time Section
  dateTimeSection: {
    gap: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Multi-Stop Section
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubtext: {
    fontSize: 14,
  },
  stopsSection: {
    flex: 1,
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addStopText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStops: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyStopsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  stopsList: {
    flex: 1,
  },
  stopCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopActionButton: {
    padding: 4,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  stopLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  stopTime: {
    fontSize: 13,
  },
  
  // Details Section
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  visibilityInfo: {
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
    marginBottom: 2,
  },
  visibilitySubtext: {
    fontSize: 13,
  },
  
  // Review Section
  reviewStepContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  reviewScrollContent: {
    paddingBottom: 20,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  reviewRow: {
    gap: 4,
  },
  reviewLabel: {
    fontSize: 13,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  itinerarySection: {
    marginTop: 20,
  },
  itineraryHeader: {
    marginBottom: 12,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  itinerarySubtitle: {
    fontSize: 13,
  },
  reviewStopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  reviewStopInfo: {
    flex: 1,
  },
  reviewStopName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  reviewStopTime: {
    fontSize: 13,
  },
  
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  nextButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Spot Picker Modal
  pickerModal: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pickerSpotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  pickerTimeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pickerTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  pickerFooter: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pickerConfirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerConfirmText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Edit Stop Modal
  editStopModal: {
    width: '100%',
    maxHeight: '70%',
    marginTop: 'auto',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  editStopContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  editStopInfo: {
    marginBottom: 20,
  },
  editStopName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  editStopHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  iosTimePicker: {
    marginTop: 16,
  },
});
