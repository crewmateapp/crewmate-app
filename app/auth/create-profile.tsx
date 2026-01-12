import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { getAirlineFromEmail } from '@/data/airlines';
import { Ionicons } from '@expo/vector-icons';
import { notifyAdminsNewUser } from '@/utils/notifications';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
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

const POSITIONS = [
  { value: 'Flight Attendant', label: 'Flight Attendant', icon: 'airplane' },
  { value: 'Pilot', label: 'Pilot', icon: 'navigate' },
];

export default function CreateProfileScreen() {
  const { user } = useAuth();
  const { cities, loading: citiesLoading } = useCities();
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [position, setPosition] = useState('');
  const [airline, setAirline] = useState(getAirlineFromEmail(user?.email || ''));
  const [base, setBase] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library to add a profile photo.');
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

  const handleCreateProfile = async () => {
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

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      // Upload photo if selected
      const photoURL = await uploadPhoto();

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim().toUpperCase(),
        displayName: `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`,
        position: position,
        email: user.email,
        airline: airline,
        base: base,
        bio: bio.trim() || '',
        photoURL: photoURL,
        createdAt: new Date().toISOString(),
        emailVerified: user.emailVerified,
        profileComplete: true,
      });

      // Notify admins of new user signup
      await notifyAdminsNewUser(
        user.uid,
        `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`,
        user.email || '',
        airline
      );

      Alert.alert(
        'Welcome to CrewMate! ✈️',
        'Your profile has been created. Let\'s find some crew!',
        [{ text: 'Get Started', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error) {
      console.error('Profile creation error:', error);
      Alert.alert('Error', 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.title}>
            ✈️ Create Your Profile
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Let's set up your CrewMate profile
          </ThemedText>

          {/* Photo Picker */}
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ThemedText style={styles.photoPlaceholderText}>📷</ThemedText>
                <ThemedText style={styles.photoPlaceholderLabel}>Add Photo</ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>First Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Sarah"
                placeholderTextColor={Colors.text.disabled}
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
                placeholderTextColor={Colors.text.disabled}
                value={lastInitial}
                onChangeText={(text) => setLastInitial(text.slice(0, 1))}
                autoCapitalize="characters"
                maxLength={1}
              />
              <ThemedText style={styles.hint}>
                For privacy, only your last initial will be shown (e.g., Sarah M.)
              </ThemedText>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Position</ThemedText>
              <View style={styles.positionContainer}>
                {POSITIONS.map((pos) => (
                  <TouchableOpacity
                    key={pos.value}
                    style={[
                      styles.positionButton,
                      position === pos.value && styles.positionButtonActive,
                    ]}
                    onPress={() => setPosition(pos.value)}
                  >
                    <Ionicons 
                      name={pos.icon as any} 
                      size={24} 
                      color={position === pos.value ? Colors.white : Colors.text.primary} 
                    />
                    <ThemedText
                      style={[
                        styles.positionText,
                        position === pos.value && styles.positionTextActive,
                      ]}
                    >
                      {pos.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Airline</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Delta Air Lines"
                placeholderTextColor={Colors.text.disabled}
                value={airline}
                onChangeText={setAirline}
                autoCapitalize="words"
              />
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
              <ThemedText style={styles.label}>Bio (Optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Looking for coffee spots and local recommendations..."
                placeholderTextColor={Colors.text.disabled}
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
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <ThemedText style={styles.buttonText}>Complete Profile</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.notice}>
            <ThemedText style={styles.noticeText}>
              🔒 Your email address is private and will never be shown to other crew members.
            </ThemedText>
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
                placeholderTextColor={Colors.text.disabled}
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: Colors.text.secondary,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 20,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 32,
  },
  photoPlaceholderLabel: {
    color: Colors.white,
    fontSize: 14,
    marginTop: 5,
  },
  form: {
    gap: 20,
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
    backgroundColor: Colors.white,
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
  positionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  positionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  positionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  positionTextActive: {
    color: Colors.white,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    backgroundColor: Colors.white,
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: Colors.text.disabled,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  notice: {
    marginTop: 30,
    padding: 15,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.white,
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
  },
  listItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
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