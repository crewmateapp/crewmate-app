// app/setup-profile.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
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

const POSITIONS = ['Flight Attendant', 'Pilot', 'Captain', 'First Officer'];

export default function SetupProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [position, setPosition] = useState('');
  const [airline, setAirline] = useState('');
  const [base, setBase] = useState('');
  const [photoURL, setPhotoURL] = useState('');

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
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleComplete = async () => {
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

    if (!position.trim()) {
      Alert.alert('Required', 'Please select your position.');
      return;
    }

    if (!airline.trim()) {
      Alert.alert('Required', 'Please enter your airline.');
      return;
    }

    if (!base.trim()) {
      Alert.alert('Required', 'Please enter your base.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim().charAt(0).toUpperCase(),
        displayName: `${firstName.trim()} ${lastInitial.trim().charAt(0).toUpperCase()}.`,
        position: position.trim(),
        airline: airline.trim(),
        base: base.trim(),
        photoURL: photoURL || null,
        profileSetupCompleted: true,
        profileSetupCompletedAt: new Date(),
      });

      Alert.alert(
        'Welcome to CrewMate! ✈️',
        'Let\'s take a quick tour of the app to get you started!',
        [{ text: 'Let\'s Go!', onPress: () => router.replace('/tutorial') }]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Profile Setup?',
      'You can always complete your profile later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Complete Your Profile</ThemedText>
          <TouchableOpacity onPress={handleSkip}>
            <ThemedText style={[styles.skipText, { color: colors.text.secondary }]}>
              Skip
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary }]} />
            </View>
            <ThemedText style={[styles.progressText, { color: colors.text.secondary }]}>
              Step 1 of 1
            </ThemedText>
          </View>

          {/* Photo Section */}
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
              <ThemedText style={[styles.addPhotoText, { color: colors.primary }]}>
                {photoURL ? 'Change Photo' : 'Add Photo'}
              </ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.photoHint, { color: colors.text.secondary }]}>
              Optional, but helps crew recognize you
            </ThemedText>
          </View>

          {/* Input Fields */}
          <View style={styles.section}>
            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>First Name *</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor={colors.text.secondary}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Last Initial *</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={lastInitial}
                onChangeText={setLastInitial}
                placeholder="D"
                placeholderTextColor={colors.text.secondary}
                maxLength={1}
                autoCapitalize="characters"
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Position *</ThemedText>
              <View style={styles.positionsGrid}>
                {POSITIONS.map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={[
                      styles.positionChip,
                      {
                        backgroundColor: position === pos ? colors.primary : colors.background,
                        borderColor: position === pos ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPosition(pos)}
                  >
                    <ThemedText
                      style={[
                        styles.positionText,
                        { color: position === pos ? '#FFFFFF' : colors.text.primary },
                      ]}
                    >
                      {pos}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Airline *</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={airline}
                onChangeText={setAirline}
                placeholder="American Airlines"
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={styles.inputLabel}>Base *</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                value={base}
                onChangeText={setBase}
                placeholder="DFW"
                placeholderTextColor={colors.text.secondary}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <ThemedText style={[styles.infoText, { color: colors.primary }]}>
              Your full name is never shown. Only crew members can see your profile.
            </ThemedText>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Complete Button */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: colors.primary }]}
            onPress={handleComplete}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <ThemedText style={styles.completeButtonText}>Complete Setup</ThemedText>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  progressText: {
    fontSize: 13,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
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
  addPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  photoHint: {
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    gap: 16,
  },
  inputGroup: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
  positionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  positionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
