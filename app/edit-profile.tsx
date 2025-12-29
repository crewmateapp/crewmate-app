import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
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

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  position: string;
  base: string;
  bio: string;
  photoURL?: string;
};

const POSITIONS = [
  'Flight Attendant',
  'Purser',
  'Captain',
  'First Officer',
  'Captain',
];

export default function EditProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [airline, setAirline] = useState('');
  const [position, setPosition] = useState('');
  const [base, setBase] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null);

  // Modal states
  const [baseModalVisible, setBaseModalVisible] = useState(false);
  const [positionModalVisible, setPositionModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setFirstName(data.firstName);
          setLastInitial(data.lastInitial);
          setAirline(data.airline);
          setPosition(data.position || '');
          setBase(data.base);
          setBio(data.bio || '');
          setCurrentPhotoURL(data.photoURL || null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoUri || !user) return null;

    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();
      
      const photoRef = ref(storage, `profilePhotos/${user.uid}.jpg`);
      await uploadBytes(photoRef, blob);
      
      const downloadURL = await getDownloadURL(photoRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }

    if (!lastInitial.trim() || lastInitial.length !== 1) {
      Alert.alert('Error', 'Please enter your last initial (one letter)');
      return;
    }

    if (!position) {
      Alert.alert('Error', 'Please select your position');
      return;
    }

    if (!base) {
      Alert.alert('Error', 'Please select your home base');
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      // Upload new photo if selected
      let photoURL = currentPhotoURL;
      if (photoUri) {
        const newPhotoURL = await uploadPhoto();
        if (newPhotoURL) {
          photoURL = newPhotoURL;
        }
      }

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim().toUpperCase(),
        displayName: `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`,
        position: position,
        base: base,
        bio: bio.trim(),
        ...(photoURL && { photoURL }),
      });

      Alert.alert('Success!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openBasePicker = () => {
    setSearchQuery('');
    setBaseModalVisible(true);
  };

  const selectBase = (cityName: string) => {
    setBase(cityName);
    setBaseModalVisible(false);
  };

  const selectPosition = (pos: string) => {
    setPosition(pos);
    setPositionModalVisible(false);
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
            <ThemedText style={styles.title}>Edit Profile</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          {/* Photo */}
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : currentPhotoURL ? (
              <Image source={{ uri: currentPhotoURL }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ThemedText style={styles.photoPlaceholderText}>
                  {firstName[0]}{lastInitial}
                </ThemedText>
              </View>
            )}
            <View style={styles.editBadge}>
              <ThemedText style={styles.editBadgeText}>📷</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>First Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Sarah"
                placeholderTextColor={Colors.text.secondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                maxLength={20}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Last Initial</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="M"
                placeholderTextColor={Colors.text.secondary}
                value={lastInitial}
                onChangeText={(text) => setLastInitial(text.slice(0, 1))}
                autoCapitalize="characters"
                maxLength={1}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Position</ThemedText>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setPositionModalVisible(true)}
              >
                <ThemedText style={position ? styles.pickerText : styles.pickerPlaceholder}>
                  {position || 'Select your position'}
                </ThemedText>
                <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Airline</ThemedText>
              <View style={[styles.input, styles.readOnlyInput]}>
                <ThemedText style={styles.readOnlyText}>{airline}</ThemedText>
              </View>
              <ThemedText style={styles.hint}>
                🔒 Airline is determined by your email and cannot be changed
              </ThemedText>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Home Base</ThemedText>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={openBasePicker}
              >
                <ThemedText style={base ? styles.pickerText : styles.pickerPlaceholder}>
                  {base || 'Select your base airport'}
                </ThemedText>
                <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Bio</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Looking for coffee spots and local recommendations..."
                placeholderTextColor={Colors.text.secondary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                maxLength={150}
              />
              <ThemedText style={styles.hint}>
                {bio.length}/150 characters
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* POSITION PICKER MODAL */}
          <Modal
            visible={positionModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setPositionModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <ThemedText style={styles.modalTitle}>Select Position</ThemedText>
                  <Pressable onPress={() => setPositionModalVisible(false)}>
                    <Ionicons name="close" size={24} color={Colors.text.primary} />
                  </Pressable>
                </View>
                
                <ScrollView>
                  {POSITIONS.map((pos) => (
                    <Pressable
                      key={pos}
                      style={[
                        styles.positionOption,
                        position === pos && styles.positionOptionSelected
                      ]}
                      onPress={() => selectPosition(pos)}
                    >
                      <ThemedText style={[
                        styles.positionOptionText,
                        position === pos && styles.positionOptionTextSelected
                      ]}>
                        {pos}
                      </ThemedText>
                      {position === pos && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* BASE PICKER MODAL */}
          <Modal
            visible={baseModalVisible}
            animationType="slide"
            onRequestClose={() => setBaseModalVisible(false)}
          >
            <ThemedView style={styles.fullModalContainer}>
              <View style={styles.fullModalHeader}>
                <ThemedText type="title" style={styles.fullModalTitle}>
                  Select Home Base
                </ThemedText>
                <Pressable onPress={() => setBaseModalVisible(false)}>
                  <ThemedText style={styles.modalClose}>Close</ThemedText>
                </Pressable>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by city or airport code"
                placeholderTextColor={Colors.text.secondary}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <FlatList
                data={filteredCities}
                keyExtractor={(item, index) => `${item.name}-${index}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.listItem}
                    onPress={() => selectBase(item.name)}
                  >
                    <ThemedText style={styles.listItemTitle}>
                      {item.name}
                    </ThemedText>
                    <ThemedText style={styles.listItemSub}>
                      {item.areas[0]}
                    </ThemedText>
                  </Pressable>
                )}
              />
            </ThemedView>
          </Modal>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  cancelButton: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  editBadgeText: {
    fontSize: 16,
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
  hint: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  readOnlyInput: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  positionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.background,
  },
  positionOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  positionOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  positionOptionTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  fullModalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalClose: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
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
});