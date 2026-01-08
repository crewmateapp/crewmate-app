import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const categories = [
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'gym', label: 'Gym', emoji: '💪' },
  { id: 'activity', label: 'Activity', emoji: '🎯' },
];

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// Types for Google Places API
interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  place_id: string;
}

// FIXED: Removed 'async' keyword - React components cannot be async functions
export default function AddSpotScreen() {
  const { cities, loading: citiesLoading } = useCities();
  const { city: cityParam } = useLocalSearchParams<{ city?: string }>();
  const { user } = useAuth();
  
  // Form fields
  const [name, setName] = useState('');
  const [placeId, setPlaceId] = useState(''); // Google Place ID for fetching details
  const [category, setCategory] = useState('');
  const [city, setCity] = useState(cityParam || '');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [reservationUrl, setReservationUrl] = useState('');
  const [tips, setTips] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  const [saving, setSaving] = useState(false);
  
  // City/Area picker
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityObj, setSelectedCityObj] = useState<any>(null);

  // Google Places Autocomplete state
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 25);
    return cities
      .filter((c) => {
        const name = c.name.toLowerCase();
        const airportCode = (c.areas?.[0] ?? '').slice(0, 3).toLowerCase();
        return name.includes(q) || airportCode.startsWith(q);
      })
      .slice(0, 30);
  }, [searchQuery, cities]);
  

  // Fetch place predictions from Google Places Autocomplete API
  const fetchPlacePredictions = async (input: string) => {
    if (!input.trim() || !GOOGLE_PLACES_API_KEY) {
      setPlacePredictions([]);
      return;
    }

    setLoadingPredictions(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&types=establishment&key=${GOOGLE_PLACES_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setPlacePredictions(data.predictions);
        setShowPredictions(true);
      } else if (data.status === 'ZERO_RESULTS') {
        setPlacePredictions([]);
        setShowPredictions(true);
      } else {
        console.error('Places API error:', data.status, data.error_message);
        setPlacePredictions([]);
      }
    } catch (error) {
      console.error('Error fetching place predictions:', error);
      setPlacePredictions([]);
    } finally {
      setLoadingPredictions(false);
    }
  };

  // Fetch place details from Google Places Details API
  const fetchPlaceDetails = async (placeId: string) => {
    if (!placeId || !GOOGLE_PLACES_API_KEY) return;

    setLoadingDetails(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,geometry,types,place_id&key=${GOOGLE_PLACES_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const details: PlaceDetails = data.result;
        handlePlaceDetailsReceived(details);
      } else {
        console.error('Place Details API error:', data.status, data.error_message);
        Alert.alert('Error', 'Could not fetch place details. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Error', 'Failed to load place details. Please check your connection.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle place details and auto-fill form
  const handlePlaceDetailsReceived = (details: PlaceDetails) => {
    // Auto-fill all available fields
    setName(details.name || '');
    setPlaceId(details.place_id || '');
    setAddress(details.formatted_address || '');
    setPhone(details.formatted_phone_number || details.international_phone_number || '');
    setWebsite(details.website || '');
    
    // Set coordinates
    if (details.geometry?.location) {
      setLatitude(details.geometry.location.lat);
      setLongitude(details.geometry.location.lng);
    }

    // Try to determine category from Google's types
    const types = details.types || [];
    if (types.includes('cafe') || types.includes('coffee_shop')) {
      setCategory('coffee');
    } else if (types.includes('restaurant') || types.includes('meal_takeaway') || types.includes('food')) {
      setCategory('food');
    } else if (types.includes('bar') || types.includes('night_club')) {
      setCategory('bar');
    } else if (types.includes('gym') || types.includes('fitness_center')) {
      setCategory('gym');
    }

    // Clear predictions and search
    setShowPredictions(false);
    setPlacePredictions([]);

    Alert.alert(
      'Business Found! 🎯',
      `${details.name} info loaded. Please select city/area and add a description.`
    );
  };

  // Handle place search input with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is too short
    if (placeSearchQuery.trim().length < 2) {
      setPlacePredictions([]);
      setShowPredictions(false);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      fetchPlacePredictions(placeSearchQuery);
    }, 300);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [placeSearchQuery]);

  // Handle selecting a prediction
  const handlePredictionSelect = (prediction: PlacePrediction) => {
    setPlaceSearchQuery(prediction.structured_formatting.main_text);
    fetchPlaceDetails(prediction.place_id);
  };

  const pickImages = async () => {
    if (photoUris.length >= 3) {
      Alert.alert('Limit Reached', 'You can add up to 3 photos');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
    });

    if (!result.canceled) {
      setPhotoUris([...photoUris, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUris(photoUris.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photoUris.length === 0 || !user) return [];

    const uploadPromises = photoUris.map(async (uri, index) => {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const photoRef = ref(storage, `spots/${user.uid}/${Date.now()}_${index}.jpg`);
        await uploadBytes(photoRef, blob);
        
        return await getDownloadURL(photoRef);
      } catch (error) {
        console.error('Error uploading photo:', error);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    return results.filter((url): url is string => url !== null);
  };

  const getUserDisplayName = async () => {
    if (!user) return 'Crew Member';
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return userDoc.data().displayName || user.email?.split('@')[0] || 'Crew Member';
      }
    } catch (error) {
      console.error('Error getting user name:', error);
    }
    return user.email?.split('@')[0] || 'Crew Member';
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please search and select a business');
      return;
    }
    if (!category) {
      Alert.alert('Missing Info', 'Please select a category');
      return;
    }
    if (!city) {
      Alert.alert('Missing Info', 'Please select a city');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please add a description (why crew should visit)');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be signed in to add spots');
      return;
    }

    setSaving(true);
    try {
      // Upload photos
      const photoURLs = await uploadPhotos();

      // Get user display name
      const userDisplayName = await getUserDisplayName();

      // Create spot document
      await addDoc(collection(db, 'spots'), {
        name: name.trim(),
        ...(placeId && { placeId }), // Store Google Place ID for future reference
        category,
        city,
        area: area || '',
        description: description.trim(),
        address: address.trim() || '',
        ...(latitude && longitude && { latitude, longitude }),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(website.trim() && { website: website.trim() }),
        ...(reservationUrl.trim() && { reservationUrl: reservationUrl.trim() }),
        ...(tips.trim() && { tips: tips.trim() }),
        ...(photoURLs.length > 0 && { photoURLs }),
        addedBy: user.uid,
        addedByName: userDisplayName,
        status: 'pending', // Requires approval
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Spot Submitted! 📋',
        `Thanks for submitting ${name}! We'll review it and it will appear once approved.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error adding spot:', error);
      Alert.alert('Error', 'Failed to add spot. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openCityPicker = () => {
    setSearchQuery('');
    setCityModalVisible(true);
  };

  const selectCity = (cityObj: any) => {
    setCity(cityObj.name);
    setSelectedCityObj(cityObj);
    setCityModalVisible(false);
    
    // If city has only one area, auto-select it
    if (cityObj.areas.length === 1) {
      setArea(cityObj.areas[0]);
    } else {
      setAreaModalVisible(true);
    }
  };

  const selectArea = (areaName: string) => {
    setArea(areaName);
    setAreaModalVisible(false);
  };

  if (!GOOGLE_PLACES_API_KEY) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#ff9800" />
          <ThemedText style={styles.errorText}>
            Google Places API key not configured
          </ThemedText>
          <ThemedText style={styles.errorHint}>
            Please add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env file
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>Add Crew Spot</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.form}>
            {/* Google Places Autocomplete Search */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Search Business *</ThemedText>
              <View style={styles.autocompleteContainer}>
                <View style={styles.searchInputWrapper}>
                  <Ionicons 
                    name="search" 
                    size={20} 
                    color="#888" 
                    style={styles.searchIcon} 
                  />
                  <TextInput
                    value={placeSearchQuery}
                    onChangeText={(text) => {
                      setPlaceSearchQuery(text);
                      if (!text.trim()) {
                        setShowPredictions(false);
                      }
                    }}
                    placeholder="Search for a business (Starbucks, Planet Fitness...)"
                    placeholderTextColor="#888"
                    style={styles.searchTextInput}
                    autoCapitalize="words"
                    onFocus={() => {
                      if (placePredictions.length > 0) {
                        setShowPredictions(true);
                      }
                    }}
                  />
                  {loadingPredictions && (
                    <ActivityIndicator size="small" color="#2196F3" style={styles.searchLoader} />
                  )}
                  {placeSearchQuery.length > 0 && !loadingPredictions && (
                    <Pressable 
                      onPress={() => {
                        setPlaceSearchQuery('');
                        setShowPredictions(false);
                        setPlacePredictions([]);
                      }}
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#888" />
                    </Pressable>
                  )}
                </View>

                {/* Predictions Dropdown */}
                {showPredictions && placePredictions.length > 0 && (
                  <View style={styles.predictionsContainer}>
                    <FlatList
                      data={placePredictions}
                      keyExtractor={(item) => item.place_id}
                      scrollEnabled={false}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.predictionItem}
                          onPress={() => handlePredictionSelect(item)}
                        >
                          <Ionicons name="location" size={18} color="#2196F3" />
                          <View style={styles.predictionTextContainer}>
                            <ThemedText style={styles.predictionMainText}>
                              {item.structured_formatting.main_text}
                            </ThemedText>
                            <ThemedText style={styles.predictionSecondaryText}>
                              {item.structured_formatting.secondary_text}
                            </ThemedText>
                          </View>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                {showPredictions && placePredictions.length === 0 && !loadingPredictions && placeSearchQuery.length > 2 && (
                  <View style={styles.predictionsContainer}>
                    <View style={styles.noPredictionsContainer}>
                      <ThemedText style={styles.noPredictionsText}>
                        No businesses found
                      </ThemedText>
                    </View>
                  </View>
                )}
              </View>
              <ThemedText style={styles.hint}>
                Start typing to search Google Places
              </ThemedText>
            </View>

            {/* Loading Details Indicator */}
            {loadingDetails && (
              <View style={styles.loadingDetailsContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <ThemedText style={styles.loadingDetailsText}>
                  Loading business details...
                </ThemedText>
              </View>
            )}

            {/* Selected Spot Display */}
            {name && !loadingDetails && (
              <View style={styles.selectedSpot}>
                <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
                <ThemedText style={styles.selectedSpotName}>{name}</ThemedText>
                <Pressable
                  onPress={() => {
                    setName('');
                    setPlaceId('');
                    setAddress('');
                    setPhone('');
                    setWebsite('');
                    setLatitude(null);
                    setLongitude(null);
                    setCategory('');
                    setPlaceSearchQuery('');
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#666" />
                </Pressable>
              </View>
            )}

            {/* Category Selection */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Category *</ThemedText>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryButton,
                      category === cat.id && styles.categoryButtonActive,
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <ThemedText style={styles.categoryEmoji}>{cat.emoji}</ThemedText>
                    <ThemedText style={styles.categoryLabel}>{cat.label}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* City Selection */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>City *</ThemedText>
              <Pressable style={styles.pickerButton} onPress={openCityPicker}>
                {city ? (
                  <ThemedText style={styles.pickerText}>{city}</ThemedText>
                ) : (
                  <ThemedText style={styles.pickerPlaceholder}>Select a city</ThemedText>
                )}
              </Pressable>
            </View>

            {/* Area Selection (if city selected and has areas) */}
            {city && selectedCityObj?.areas?.length > 0 && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Area (Optional)</ThemedText>
                <Pressable 
                  style={styles.pickerButton} 
                  onPress={() => selectedCityObj && setAreaModalVisible(true)}
                >
                  <ThemedText style={styles.pickerText}>{area}</ThemedText>
                </Pressable>
              </View>
            )}

            {/* Description */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Description *</ThemedText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Why should crew visit this spot?"
                placeholderTextColor="#888"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
              />
              <ThemedText style={styles.hint}>
                Share what makes this spot special for crew
              </ThemedText>
            </View>

            {/* Address (Auto-filled) */}
            {address && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Address</ThemedText>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Business address"
                  placeholderTextColor="#888"
                  style={styles.input}
                  editable={true}
                />
              </View>
            )}

            {/* Phone (Auto-filled) */}
            {phone && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Phone</ThemedText>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor="#888"
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Website (Auto-filled) */}
            {website && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Website</ThemedText>
                <TextInput
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="Website URL"
                  placeholderTextColor="#888"
                  style={styles.input}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Reservation URL (Optional) */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Reservation URL (Optional)</ThemedText>
              <TextInput
                value={reservationUrl}
                onChangeText={setReservationUrl}
                placeholder="OpenTable, Resy, etc."
                placeholderTextColor="#888"
                style={styles.input}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            {/* Crew Tips */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Crew Tips (Optional)</ThemedText>
              <TextInput
                value={tips}
                onChangeText={setTips}
                placeholder="Any insider tips for crew?"
                placeholderTextColor="#888"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
              />
              <ThemedText style={styles.hint}>
                e.g., "Ask for crew discount" or "Open late for redeyes"
              </ThemedText>
            </View>

            {/* Photos */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Photos (Optional, up to 3)</ThemedText>
              
              {photoUris.length > 0 && (
                <View style={styles.photoGrid}>
                  {photoUris.map((uri, index) => (
                    <View key={index} style={styles.photoPreview}>
                      <Image source={{ uri }} style={styles.photoImage} />
                      <Pressable
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={28} color="#ff3b30" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {photoUris.length < 3 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickImages}>
                  <Ionicons name="camera" size={24} color="#2196F3" />
                  <ThemedText style={styles.addPhotoText}>Add Photo</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Submit for Approval</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* City Picker Modal */}
          <Modal
            visible={cityModalVisible}
            animationType="slide"
            onRequestClose={() => setCityModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <ThemedText type="title" style={styles.modalTitle}>
                  Select City
                </ThemedText>
                <Pressable onPress={() => setCityModalVisible(false)}>
                  <ThemedText style={styles.modalClose}>Close</ThemedText>
                </Pressable>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search city or airport code"
                placeholderTextColor="#888"
                style={styles.searchInput}
                autoCapitalize="none"
              />

              <FlatList
                data={filteredCities}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.listItem} onPress={() => selectCity(item)}>
                    <ThemedText style={styles.listItemTitle}>{item.name}</ThemedText>
                    <ThemedText style={styles.listItemSub}>{item.areas[0]}</ThemedText>
                  </Pressable>
                )}
              />
            </View>
          </Modal>

          {/* Area Picker Modal */}
          <Modal
            visible={areaModalVisible}
            animationType="slide"
            onRequestClose={() => setAreaModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <ThemedText type="title" style={styles.modalTitle}>
                  Select Area (Optional)
                </ThemedText>
                <Pressable onPress={() => setAreaModalVisible(false)}>
                  <ThemedText style={styles.modalClose}>Skip</ThemedText>
                </Pressable>
              </View>

              <FlatList
                data={selectedCityObj?.areas || []}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable style={styles.listItem} onPress={() => selectArea(item)}>
                    <ThemedText style={styles.listItemTitle}>{item}</ThemedText>
                  </Pressable>
                )}
              />
            </View>
          </Modal>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    backgroundColor: '#2196F3',
    marginBottom: 20,
  },
  cancelButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  form: {
    paddingHorizontal: 20,
    gap: 20,
    paddingBottom: 40,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
  },
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchTextInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
  },
  searchLoader: {
    marginLeft: 10,
  },
  clearButton: {
    padding: 5,
  },
  predictionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 250,
    marginTop: -1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noPredictionsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noPredictionsText: {
    fontSize: 14,
    color: '#888',
  },
  loadingDetailsContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  loadingDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  selectedSpot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  selectedSpotName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    flex: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
  },
  pickerText: {
    fontSize: 16,
    color: '#000',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#888',
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  photoPreview: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addPhotoText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#2196F3',
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: '#000',
  },
  listItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  listItemSub: {
    fontSize: 12,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.7,
  },
});
