import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState, useMemo } from 'react';
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
  { id: 'other', label: 'Other', emoji: '📍' },
];

// Admin emails
const ADMIN_EMAILS = ['zachary.tillman@aa.com', 'johnny.guzman@aa.com'];

export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  
  // Check if user is admin
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
  
  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [tips, setTips] = useState('');
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // City/Area picker
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityObj, setSelectedCityObj] = useState<any>(null);

  // Load spot data
  useEffect(() => {
    const loadSpot = async () => {
      if (!id) return;
      
      try {
        const spotDoc = await getDoc(doc(db, 'spots', id));
        if (spotDoc.exists()) {
          const data = spotDoc.data();
          setName(data.name || '');
          setCategory(data.category || '');
          setCity(data.city || '');
          setArea(data.area || '');
          setDescription(data.description || '');
          setAddress(data.address || '');
          setPhone(data.phone || '');
          setWebsite(data.website || '');
          setTips(data.tips || '');
          setPhotoURLs(data.photoURLs || data.photos || []);
          
          // Find city object for area selection
          const cityObj = cities.find(c => c.name === data.city);
          if (cityObj) {
            setSelectedCityObj(cityObj);
          }
        }
      } catch (error) {
        console.error('Error loading spot:', error);
        Alert.alert('Error', 'Failed to load spot data');
      } finally {
        setLoading(false);
      }
    };

    loadSpot();
  }, [id]);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 25);
    return cities
      .filter((c) => {
        const name = c.name.toLowerCase();
        const code = c.code.toLowerCase();
        return name.includes(q) || code.startsWith(q);
      })
      .slice(0, 30);
  }, [searchQuery]);

  const pickImages = async () => {
    const totalPhotos = photoURLs.length + newPhotoUris.length;
    if (totalPhotos >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 photos allowed');
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
      setNewPhotoUris([...newPhotoUris, result.assets[0].uri]);
    }
  };

  const removeExistingPhoto = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotoURLs(photoURLs.filter((_, i) => i !== index));
          }
        }
      ]
    );
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotoUris(newPhotoUris.filter((_, i) => i !== index));
  };

  const uploadNewPhotos = async (): Promise<string[]> => {
    if (newPhotoUris.length === 0 || !user) return [];

    const uploadPromises = newPhotoUris.map(async (uri, index) => {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const photoRef = ref(storage, `spots/${id}/${Date.now()}_${index}.jpg`);
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
    if (!id) return;

    setSaving(true);
    try {
      // Upload any new photos
      const newUploadedURLs = await uploadNewPhotos();
      const allPhotoURLs = [...photoURLs, ...newUploadedURLs];

      // Update spot document
      await updateDoc(doc(db, 'spots', id), {
        name: name.trim(),
        category,
        city,
        area: area || '',
        description: description.trim(),
        address: address.trim() || '',
        ...(phone.trim() && { phone: phone.trim() }),
        ...(website.trim() && { website: website.trim() }),
        ...(tips.trim() && { tips: tips.trim() }),
        photoURLs: allPhotoURLs,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'admin',
      });

      Alert.alert(
        'Saved! ✅',
        `${name} has been updated.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error updating spot:', error);
      Alert.alert('Error', 'Failed to update spot. Please try again.');
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
      setArea(''); // Reset area when city changes
      setAreaModalVisible(true);
    }
  };

  const selectArea = (areaName: string) => {
    setArea(areaName);
    setAreaModalVisible(false);
  };

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={Colors.error} />
          <ThemedText style={styles.errorText}>Admin Access Only</ThemedText>
          <ThemedText style={styles.errorHint}>
            You don't have permission to edit spots.
          </ThemedText>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
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
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>Edit Spot</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.form}>
            {/* Spot Name */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Spot Name *</ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Business name"
                placeholderTextColor="#888"
                style={styles.input}
              />
            </View>

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

            {/* City Picker */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>City *</ThemedText>
              <Pressable style={styles.pickerButton} onPress={openCityPicker}>
                <ThemedText style={city ? styles.pickerText : styles.pickerPlaceholder}>
                  {city || 'Select city'}
                </ThemedText>
              </Pressable>
            </View>

            {/* Area Display */}
            {selectedCityObj && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Area</ThemedText>
                <Pressable 
                  style={styles.pickerButton} 
                  onPress={() => setAreaModalVisible(true)}
                >
                  <ThemedText style={area ? styles.pickerText : styles.pickerPlaceholder}>
                    {area || 'Select area'}
                  </ThemedText>
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
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Address</ThemedText>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Business address"
                placeholderTextColor="#888"
                style={styles.input}
              />
            </View>

            {/* Phone */}
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

            {/* Website */}
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

            {/* Crew Tips */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Crew Tips</ThemedText>
              <TextInput
                value={tips}
                onChangeText={setTips}
                placeholder="Any insider tips for crew?"
                placeholderTextColor="#888"
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Existing Photos */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>
                Photos ({photoURLs.length + newPhotoUris.length}/5)
              </ThemedText>
              
              {photoURLs.length > 0 && (
                <>
                  <ThemedText style={styles.subLabel}>Existing Photos</ThemedText>
                  <View style={styles.photoGrid}>
                    {photoURLs.map((url, index) => (
                      <View key={`existing-${index}`} style={styles.photoPreview}>
                        <Image source={{ uri: url }} style={styles.photoImage} />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => removeExistingPhoto(index)}
                        >
                          <Ionicons name="close-circle" size={24} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* New Photos to Upload */}
              {newPhotoUris.length > 0 && (
                <>
                  <ThemedText style={styles.subLabel}>New Photos (to upload)</ThemedText>
                  <View style={styles.photoGrid}>
                    {newPhotoUris.map((uri, index) => (
                      <View key={`new-${index}`} style={styles.photoPreview}>
                        <Image source={{ uri }} style={styles.photoImage} />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => removeNewPhoto(index)}
                        >
                          <Ionicons name="close-circle" size={24} color={Colors.error} />
                        </TouchableOpacity>
                        <View style={styles.newBadge}>
                          <ThemedText style={styles.newBadgeText}>NEW</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {(photoURLs.length + newPhotoUris.length) < 5 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickImages}>
                  <Ionicons name="camera" size={24} color={Colors.primary} />
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
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>

      {/* City Picker Modal */}
      <Modal visible={cityModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select City</ThemedText>
            <Pressable onPress={() => setCityModalVisible(false)}>
              <ThemedText style={styles.modalClose}>Cancel</ThemedText>
            </Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search cities or airport codes..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.listItem}
                onPress={() => selectCity(item)}
              >
                <ThemedText style={styles.listItemTitle}>{item.name}</ThemedText>
                <ThemedText style={styles.listItemSub}>{item.code}</ThemedText>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Area Picker Modal */}
      <Modal visible={areaModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Area</ThemedText>
            <Pressable onPress={() => setAreaModalVisible(false)}>
              <ThemedText style={styles.modalClose}>Cancel</ThemedText>
            </Pressable>
          </View>
          <FlatList
            data={selectedCityObj?.areas || []}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.listItem}
                onPress={() => selectArea(item)}
              >
                <ThemedText style={styles.listItemTitle}>{item}</ThemedText>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
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
    backgroundColor: '#9C27B0',
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
    color: Colors.text.primary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: Colors.card,
    color: Colors.text.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '20',
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    backgroundColor: Colors.card,
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  photoPreview: {
    width: 100,
    height: 70,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  newBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addPhotoText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#9C27B0',
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
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  modalClose: {
    color: Colors.primary,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: Colors.text.primary,
    backgroundColor: Colors.card,
  },
  listItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    backgroundColor: Colors.card,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  listItemSub: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
    color: Colors.text.primary,
  },
  errorHint: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    color: Colors.text.secondary,
  },
  backBtn: {
    marginTop: 30,
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
