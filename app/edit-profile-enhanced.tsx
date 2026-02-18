// app/edit-profile-enhanced.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { getAirlineFromEmail } from '@/data/airlines';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { creditReferrer } from '@/utils/handleReferral';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
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
  position: string;
  airline: string;
  base: string;
  photoURL?: string;
  bio?: string;
  favoriteCities?: string[];
  interests?: string[];
};

const INTEREST_OPTIONS = [
  'Coffee', 'Food', 'Nightlife', 'Museums', 'Shopping', 'Hiking',
  'Beaches', 'Parks', 'Photography', 'Fitness', 'Music', 'Art',
  'History', 'Sports', 'Live Shows', 'Wine/Beer', 'Sightseeing', 'Local Culture'
];

export default function EditProfileEnhancedScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Tracks what photoURL was when the profile was first loaded.
  // If it was empty/null and the user uploads a photo, that's their first photo
  // and we need to call creditReferrer().
  const initialPhotoRef = useRef<string | null>(null);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [position, setPosition] = useState('');
  const [airline, setAirline] = useState('');
  const [base, setBase] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteCities, setFavoriteCities] = useState<string[]>([]);
  const [newCity, setNewCity] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setFirstName(data.firstName || '');
        setLastInitial(data.lastInitial || '');
        setPosition(data.position || '');
        setAirline(data.airline || '');
        setBase(data.base || '');
        setPhotoURL(data.photoURL || '');
        setBio(data.bio || '');
        setFavoriteCities(data.favoriteCities || []);
        setSelectedInterests(data.interests || []);

        // Snapshot the initial photoURL so we can detect first-photo uploads
        initialPhotoRef.current = data.photoURL || null;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const photoRef = ref(storage, `profilePhotos/${user.uid}`);
      await uploadBytes(photoRef, blob);
      const downloadURL = await getDownloadURL(photoRef);

      // Update local state
      setPhotoURL(downloadURL);

      // Persist photoURL to Firestore immediately — don't wait for Save.
      // This is important for two reasons:
      //   1. The referral system checks photoURL to determine if a referral is complete
      //   2. Other crew can see the photo right away
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL,
      });

      // ─── Referral: if this is the user's first photo, credit their referrer ──
      if (!initialPhotoRef.current) {
        console.log('🎁 First photo uploaded, checking for referrer to credit');
        await creditReferrer(user.uid);
        // Update the ref so we don't credit again if they change their photo
        initialPhotoRef.current = downloadURL;
      }
      // ────────────────────────────────────────────────────────────────────────

    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddCity = () => {
    if (!newCity.trim()) return;
    
    const cityTrimmed = newCity.trim();
    if (favoriteCities.includes(cityTrimmed)) {
      Alert.alert('Already Added', 'This city is already in your favorites.');
      return;
    }

    setFavoriteCities([...favoriteCities, cityTrimmed]);
    setNewCity('');
  };

  const handleRemoveCity = (city: string) => {
    setFavoriteCities(favoriteCities.filter(c => c !== city));
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length >= 8) {
        Alert.alert('Limit Reached', 'You can select up to 8 interests.');
        return;
      }
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name.');
      return;
    }

    if (!lastInitial.trim()) {
      Alert.alert('Required', 'Please enter your last initial.');
      return;
    }

    if (bio.length > 300) {
      Alert.alert('Too Long', 'Bio must be 300 characters or less.');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim().charAt(0).toUpperCase(),
        displayName: `${firstName.trim()} ${lastInitial.trim().charAt(0).toUpperCase()}.`,
        position: position.trim(),
        airline: airline.trim(),
        base: base.trim(),
        photoURL: photoURL || null,
        bio: bio.trim() || null,
        favoriteCities: favoriteCities.length > 0 ? favoriteCities : null,
        interests: selectedInterests.length > 0 ? selectedInterests : null,
      }, { merge: true });

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={[styles.saveButton, { color: colors.primary }]}>Save</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.photo} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons name="person" size={48} color={colors.text.secondary} />
                </View>
              )}
              {uploadingPhoto && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
              <ThemedText style={[styles.changePhotoText, { color: colors.primary }]}>
                Change Photo
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              BASIC INFO
            </ThemedText>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>First Name</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Last Initial</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={lastInitial}
                onChangeText={setLastInitial}
                placeholder="Enter last initial"
                placeholderTextColor={colors.text.secondary}
                maxLength={1}
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Position</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={position}
                onChangeText={setPosition}
                placeholder="Flight Attendant, Pilot, Captain"
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Airline</ThemedText>
              <TextInput
                style={[styles.input, styles.inputLocked, { color: colors.text.secondary }]}
                value={airline}
                editable={false}
                placeholder="Your airline"
                placeholderTextColor={colors.text.secondary}
              />
              <ThemedText style={[styles.lockedHint, { color: colors.text.secondary }]}>
                Auto-detected from your airline email
              </ThemedText>
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Base</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={base}
                onChangeText={setBase}
                placeholder="Your home base"
                placeholderTextColor={colors.text.secondary}
              />
            </View>
          </View>

          {/* Bio Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              BIO
            </ThemedText>
            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>About You</ThemedText>
              <TextInput
                style={[styles.textArea, { color: colors.text.primary }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell other crew about yourself... (optional)"
                placeholderTextColor={colors.text.secondary}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <ThemedText style={[styles.charCount, { color: colors.text.secondary }]}>
                {bio.length}/300
              </ThemedText>
            </View>
          </View>

          {/* Favorite Cities */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              FAVORITE LAYOVER CITIES
            </ThemedText>
            
            {favoriteCities.map((city, index) => (
              <View key={index} style={[styles.cityTag, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText style={styles.cityText}>{city}</ThemedText>
                <TouchableOpacity onPress={() => handleRemoveCity(city)}>
                  <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addCityRow}>
              <TextInput
                style={[styles.addCityInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text.primary }]}
                value={newCity}
                onChangeText={setNewCity}
                placeholder="Add a city..."
                placeholderTextColor={colors.text.secondary}
                onSubmitEditing={handleAddCity}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddCity}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interests */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              INTERESTS (Select up to 8)
            </ThemedText>
            <View style={styles.interestsGrid}>
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.interestTag,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <ThemedText
                      style={[
                        styles.interestText,
                        { color: isSelected ? '#FFFFFF' : colors.text.primary }
                      ]}
                    >
                      {interest}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  inputGroup: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingVertical: 4,
  },
  inputLocked: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    opacity: 0.6,
  },
  lockedHint: {
    fontSize: 11,
    marginTop: 4,
  },
  textArea: {
    fontSize: 16,
    minHeight: 100,
    paddingVertical: 8,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  cityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  cityText: {
    fontSize: 15,
  },
  addCityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addCityInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
