import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getAirlineFromEmail } from '@/data/airlines';
import { cities } from '@/data/cities';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
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

export default function CreateProfileScreen() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [airline, setAirline] = useState(getAirlineFromEmail(user?.email || ''));
  const [base, setBase] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleCreateProfile = async () => {
    // Validation
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

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim().toUpperCase(),
        displayName: `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`,
        email: user.email,
        airline: airline,
        base: base,
        bio: bio.trim() || '',
        createdAt: new Date().toISOString(),
        emailVerified: user.emailVerified,
        profileComplete: true,
      });

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

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>First Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Sarah"
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
              <ThemedText style={styles.label}>Airline</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Delta Air Lines"
                value={airline}
                onChangeText={setAirline}
                autoCapitalize="words"
              />
              <ThemedText style={styles.hint}>
                Auto-filled from your email domain
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
              <ThemedText style={styles.label}>Bio (Optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Looking for coffee spots and local recommendations..."
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
              <ThemedText style={styles.buttonText}>
                {loading ? 'Creating Profile...' : 'Complete Profile'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.notice}>
            <ThemedText style={styles.noticeText}>
              🔒 Your email address is private and will never be shown to other crew members. Only your first name and last initial will be visible.
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
    padding: 20,
    paddingTop: 60,
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
    marginBottom: 40,
    opacity: 0.7,
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
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
  },
  pickerPlaceholder: {
    fontSize: 16,
    opacity: 0.5,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  notice: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
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