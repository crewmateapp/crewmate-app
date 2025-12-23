import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useMemo, useState } from 'react';
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

export default function AddSpotScreen() {
  const { city: cityParam } = useLocalSearchParams<{ city?: string }>();
  const { user } = useAuth();
  
  // Form fields
  const [name, setName] = useState('');
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
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // City/Area picker
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityObj, setSelectedCityObj] = useState<any>(null);

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
  }, [searchQuery]);

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

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to auto-fill coordinates.');
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      
      // Optionally reverse geocode to get address
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (geocode[0] && !address) {
        const addr = `${geocode[0].street || ''} ${geocode[0].city || ''} ${geocode[0].region || ''}`.trim();
        setAddress(addr);
      }
      
      Alert.alert('Location Added', 'Coordinates captured!');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get location. You can enter address manually.');
    } finally {
      setGettingLocation(false);
    }
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
      Alert.alert('Missing Info', 'Please enter a spot name');
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
      Alert.alert('Missing Info', 'Please add a description');
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

      // Get user display name (with initials format)
      const userDisplayName = await getUserDisplayName();

      // Create spot document
      await addDoc(collection(db, 'spots'), {
        name: name.trim(),
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>Add Spot</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.form}>
            {/* Spot Name */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Spot Name *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Blue Bottle Coffee"
                placeholderTextColor="#888"
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            {/* Category */}
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

            {/* City & Area */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>City *</ThemedText>
              <TouchableOpacity style={styles.pickerButton} onPress={openCityPicker}>
                <ThemedText style={city ? styles.pickerText : styles.pickerPlaceholder}>
                  {city || 'Select city'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {city && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Area (Optional)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Downtown, Airport Area, etc."
                  placeholderTextColor="#888"
                  value={area}
                  onChangeText={setArea}
                  maxLength={30}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Description *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What makes this spot great for crew?"
                placeholderTextColor="#888"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
              <ThemedText style={styles.hint}>{description.length}/200</ThemedText>
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Address (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="123 Main St"
                placeholderTextColor="#888"
                value={address}
                onChangeText={setAddress}
                maxLength={100}
              />
              <ThemedText style={styles.hint}>
                💡 Tip: Use "Get Current Location" below to auto-fill
              </ThemedText>
            </View>

            {/* Get Current Location Button */}
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <>
                  <Ionicons name="location" size={20} color="#2196F3" />
                  <ThemedText style={styles.locationButtonText}>
                    {latitude && longitude ? '✓ Location Added' : 'Get Current Location'}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            {/* Phone */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Phone (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="+1 555-123-4567"
                placeholderTextColor="#888"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>

            {/* Website */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Website (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="https://example.com"
                placeholderTextColor="#888"
                value={website}
                onChangeText={setWebsite}
                keyboardType="url"
                autoCapitalize="none"
                maxLength={100}
              />
            </View>

            {/* Reservation URL (for restaurants) */}
            {category === 'food' && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Reservation Link (Optional)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="https://resy.com/..."
                  placeholderTextColor="#888"
                  value={reservationUrl}
                  onChangeText={setReservationUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  maxLength={100}
                />
              </View>
            )}

            {/* Crew Tips */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Crew Tips (Optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any insider tips? Best time to visit? Must-try items?"
                placeholderTextColor="#888"
                value={tips}
                onChangeText={setTips}
                multiline
                numberOfLines={3}
                maxLength={150}
              />
              <ThemedText style={styles.hint}>{tips.length}/150</ThemedText>
            </View>

            {/* Photos */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Photos (Optional, up to 3)</ThemedText>
              
              {photoUris.length > 0 && (
                <View style={styles.photoGrid}>
                  {photoUris.map((uri, index) => (
                    <View key={index} style={styles.photoPreview}>
                      <Image source={{ uri }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#f44336" />
                      </TouchableOpacity>
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

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Add Spot</ThemedText>
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    justifyContent: 'center',
  },
  locationButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
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
});