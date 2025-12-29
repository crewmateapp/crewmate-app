import CrewCard from '@/components/CrewCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';

type CrewMember = {
  id: string;
  displayName: string;
  airline: string;
  bio: string;
  photoURL?: string;
};

type UserLayover = {
  city: string;
  area: string;
  discoverable: boolean;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myLayover, setMyLayover] = useState<UserLayover | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [isDiscoverable, setIsDiscoverable] = useState(false);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const layover = data.currentLayover as UserLayover | undefined;
        if (layover) {
          setMyLayover(layover);
          setSelectedCity(layover.city);
          setSelectedArea(layover.area);
          setIsDiscoverable(layover.discoverable);
        }
      }
      setLoading(false);
    });

    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!user || !myLayover || !myLayover.discoverable) {
      setCrewMembers([]);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', myLayover.city),
      where('currentLayover.area', '==', myLayover.area),
      where('currentLayover.discoverable', '==', true)
    );

    const unsubCrew = onSnapshot(q, async (snapshot) => {
      const members: CrewMember[] = [];
      for (const docSnap of snapshot.docs) {
        if (docSnap.id === user.uid) continue;

        const data = docSnap.data();
        members.push({
          id: docSnap.id,
          displayName: data.displayName || 'Unknown',
          airline: data.airline || 'Unknown',
          bio: data.bio || '',
          photoURL: data.photoURL,
        });
      }
      setCrewMembers(members);
    });

    return () => unsubCrew();
  }, [user, myLayover]);

  const handleSetLayover = async () => {
    if (!user || !selectedCity || !selectedArea) {
      Alert.alert('Missing Info', 'Please select both a city and area.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: selectedCity,
          area: selectedArea,
          discoverable: isDiscoverable,
          updatedAt: serverTimestamp(),
        },
      });
      Alert.alert('Success', 'Your layover has been set!');
    } catch (error) {
      console.error('Error setting layover:', error);
      Alert.alert('Error', 'Failed to set layover. Please try again.');
    }
  };

  const handleClearLayover = async () => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: null,
      });
      setMyLayover(null);
      setSelectedCity('');
      setSelectedArea('');
      setIsDiscoverable(false);
      Alert.alert('Cleared', 'Your layover has been cleared.');
    } catch (error) {
      console.error('Error clearing layover:', error);
      Alert.alert('Error', 'Failed to clear layover.');
    }
  };

  const handleConnect = async (crewMemberId: string) => {
    if (!user) return;

    try {
      const existingQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', crewMemberId),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDoc(doc(db, 'connectionRequests', `${user.uid}_${crewMemberId}`));
      
      if (existingSnap.exists()) {
        Alert.alert('Already Sent', 'You already sent a connection request to this crew member.');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const crewDoc = await getDoc(doc(db, 'users', crewMemberId));
      const crewData = crewDoc.data();

      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        fromUserName: userData?.displayName || 'Unknown',
        toUserId: crewMemberId,
        toUserName: crewData?.displayName || 'Unknown',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Request Sent', 'Your connection request has been sent!');
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request.');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  const selectedCityData = cities.find((c) => c.name === selectedCity);
  const areas = selectedCityData?.areas || [];

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          📍 My Layover
        </ThemedText>

        {!myLayover ? (
          <View style={styles.setupCard}>
            <ThemedText style={styles.setupTitle}>Set Your Layover</ThemedText>
            <ThemedText style={styles.setupSubtitle}>
              Let other crew know where you are
            </ThemedText>

            <View style={styles.pickerContainer}>
              <ThemedText style={styles.label}>City</ThemedText>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedCity}
                  onValueChange={(val) => {
                    setSelectedCity(val);
                    setSelectedArea('');
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a city..." value="" />
                  {cities.map((city) => (
                    <Picker.Item key={city.name} label={city.name} value={city.name} />
                  ))}
                </Picker>
              </View>
            </View>

            {selectedCity && areas.length > 0 && (
              <View style={styles.pickerContainer}>
                <ThemedText style={styles.label}>Area</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedArea}
                    onValueChange={setSelectedArea}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select an area..." value="" />
                    {areas.map((area) => (
                      <Picker.Item key={area} label={area} value={area} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <ThemedText style={styles.switchLabel}>Make me discoverable</ThemedText>
                <ThemedText style={styles.switchHint}>
                  Other crew in this area can find you
                </ThemedText>
              </View>
              <Switch
                value={isDiscoverable}
                onValueChange={setIsDiscoverable}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (!selectedCity || !selectedArea) && styles.buttonDisabled]}
              onPress={handleSetLayover}
              disabled={!selectedCity || !selectedArea}
            >
              <ThemedText style={styles.buttonText}>Set Layover</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.currentLayoverCard}>
              <View style={styles.layoverHeader}>
                <View>
                  <ThemedText style={styles.layoverCity}>{myLayover.city}</ThemedText>
                  <ThemedText style={styles.layoverArea}>{myLayover.area}</ThemedText>
                </View>
                <TouchableOpacity onPress={handleClearLayover} style={styles.clearButton}>
                  <ThemedText style={styles.clearButtonText}>Clear</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.discoverableStatus}>
                <ThemedText style={styles.discoverableLabel}>
                  {myLayover.discoverable ? '✅ Discoverable' : '🔒 Private'}
                </ThemedText>
              </View>
            </View>

            {myLayover.discoverable ? (
              <View style={styles.crewSection}>
                <ThemedText style={styles.sectionTitle}>
                  ✈️ Crew in {myLayover.area} ({crewMembers.length})
                </ThemedText>

                {crewMembers.length > 0 ? (
                  crewMembers.map((member) => (
                    <CrewCard
                      key={member.id}
                      crewMember={member}
                      onConnect={() => handleConnect(member.id)}
                    />
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <ThemedText style={styles.emptyText}>
                      No other crew members are currently discoverable in this area.
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.privateNotice}>
                <ThemedText style={styles.privateText}>
                  🔒 You're in private mode. Enable discoverable mode to see other crew members.
                </ThemedText>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.push('/explore')}
        >
          <ThemedText style={styles.exploreButtonText}>
            🌍 Explore Cities & Crew Spots
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  setupCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: Colors.text.primary,
  },
  setupSubtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: Colors.text.secondary,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text.primary,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 20,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: Colors.text.primary,
  },
  switchHint: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  currentLayoverCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  layoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  layoverCity: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  layoverArea: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  clearButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  discoverableStatus: {
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  discoverableLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  crewSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    color: Colors.text.primary,
  },
  emptyState: {
    padding: 30,
    backgroundColor: Colors.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  privateNotice: {
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privateText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  exploreButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  exploreButtonText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});