import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
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
  base: string;
  bio: string;
  photoURL?: string;
};

export default function EditProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [airline, setAirline] = useState('');
  const [base, setBase] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null);

  // Base picker modal
  const [baseModalVisible, setBaseModalVisible] = useState(false);
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 100 }} />
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
                placeholderTextColor="#888"
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
                placeholderTextColor="#888"
                value={lastInitial}
                onChangeText={(text) => setLastInitial(text.slice(0, 1))}
                autoCapitalize="characters"
                maxLength={1}
              />
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
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Bio</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Looking for coffee spots and local recommendations..."
                placeholderTextColor="#888"
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
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* BASE PICKER MODAL */}
          <Modal
            visible={baseModalVisible}
            animationType="slide"
            onRequestClose={() => setBaseModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <ThemedText type="title" style={styles.modalTitle}>
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
                placeholderTextColor="#888"
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
    color: '#2196F3',
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
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
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
  readOnlyInput: {
  backgroundColor: '#f5f5f5',
  justifyContent: 'center',
},
readOnlyText: {
  fontSize: 16,
  color: '#666',
},
});