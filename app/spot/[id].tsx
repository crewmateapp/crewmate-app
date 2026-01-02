import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

// Admin emails
const ADMIN_EMAILS = ['zachary.tillman@aa.com', 'johnny.guzman@aa.com'];

type Spot = {
  id: string;
  name: string;
  type: string;
  category?: string;
  address: string;
  city: string;
  description: string;
  status: string;
  addedBy: string;
  addedByName: string;
  photos?: string[];
  photoURLs?: string[];
  website?: string;
  tips?: string;
  phone?: string;
};

type Vote = {
  id: string;
  userId: string;
  vote: number;
};

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hasLayover, setHasLayover] = useState(false);

  // Check if user is admin
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (!id) return;

    const spotDoc = doc(db, 'spots', id);
    const unsubscribe = onSnapshot(spotDoc, (docSnap) => {
      if (docSnap.exists()) {
        setSpot({ id: docSnap.id, ...docSnap.data() } as Spot);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const votesQuery = query(collection(db, 'votes'), where('spotId', '==', id));
    const unsubscribe = onSnapshot(votesQuery, (snapshot) => {
      const fetchedVotes: Vote[] = [];
      snapshot.docs.forEach((voteDoc) => {
        const voteData = voteDoc.data();
        fetchedVotes.push({
          id: voteDoc.id,
          userId: voteData.userId,
          vote: voteData.vote,
        });
      });
      setVotes(fetchedVotes);

      const userVote = fetchedVotes.find((v) => v.userId === user?.uid);
      setMyVote(userVote ? userVote.vote : null);
    });

    return () => unsubscribe();
  }, [id, user]);

  // Check if user has a layover set
  useEffect(() => {
    if (!user) return;

    const userDoc = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDoc, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setHasLayover(!!userData.currentLayover);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleVote = async (rating: number) => {
    if (!user || !id || !spot) return;

    try {
      // Get user profile for activity
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (myVote !== null) {
        const voteQuery = query(
          collection(db, 'votes'),
          where('spotId', '==', id),
          where('userId', '==', user.uid)
        );
        const voteSnapshot = await getDocs(voteQuery);

        if (!voteSnapshot.empty) {
          const voteDoc = voteSnapshot.docs[0];
          await updateDoc(doc(db, 'votes', voteDoc.id), {
            vote: rating,
            updatedAt: serverTimestamp(),
          });

          // Update activity (delete old, create new)
          const activityQuery = query(
            collection(db, 'activities'),
            where('type', '==', 'review_left'),
            where('userId', '==', user.uid),
            where('spotId', '==', id)
          );
          const activitySnapshot = await getDocs(activityQuery);
          
          // Delete old activities
          activitySnapshot.docs.forEach(async (activityDoc) => {
            await deleteDoc(doc(db, 'activities', activityDoc.id));
          });

          // Create new activity
          await addDoc(collection(db, 'activities'), {
            type: 'review_left',
            userId: user.uid,
            userName: userData?.displayName || 'Unknown',
            userPhoto: userData?.photoURL || null,
            spotId: id,
            spotName: spot.name,
            city: spot.city,
            rating: rating,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        await addDoc(collection(db, 'votes'), {
          spotId: id,
          userId: user.uid,
          vote: rating,
          createdAt: serverTimestamp(),
        });

        // Create activity for new review
        await addDoc(collection(db, 'activities'), {
          type: 'review_left',
          userId: user.uid,
          userName: userData?.displayName || 'Unknown',
          userPhoto: userData?.photoURL || null,
          spotId: id,
          spotName: spot.name,
          city: spot.city,
          rating: rating,
          createdAt: serverTimestamp(),
        });
      }

      Alert.alert('Thanks!', 'Your rating has been saved.');
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to save rating.');
    }
  };

  const handleAddPhoto = async () => {
    if (!user || !id || !spot) return;

    Alert.alert(
      'Add Photo',
      'Choose where to get your photo from',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Please allow access to your camera.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.7,
            });

            if (!result.canceled) {
              await uploadPhoto(result.assets[0].uri);
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Please allow access to your photo library.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.7,
            });

            if (!result.canceled) {
              await uploadPhoto(result.assets[0].uri);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const uploadPhoto = async (uri: string) => {
    if (!user || !id || !spot) return;

    setUploadingPhoto(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const photoRef = ref(storage, `spots/${id}/${Date.now()}.jpg`);
      await uploadBytes(photoRef, blob);

      const downloadURL = await getDownloadURL(photoRef);

      // Support both old 'photos' and new 'photoURLs' field
      const currentPhotos = spot.photoURLs || spot.photos || [];
      await updateDoc(doc(db, 'spots', id), {
        photoURLs: [...currentPhotos, downloadURL],
      });

      // Get user profile for activity
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      // Create activity for photo
      await addDoc(collection(db, 'activities'), {
        type: 'photo_posted',
        userId: user.uid,
        userName: userData?.displayName || 'Unknown',
        userPhoto: userData?.photoURL || null,
        spotId: id,
        spotName: spot.name,
        city: spot.city,
        photoURL: downloadURL,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Photo added!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleReport = async () => {
    if (!user || !id || !spot) return;

    Alert.alert(
      'Report Issue',
      'What would you like to report?',
      [
        {
          text: 'Closed/Moved',
          onPress: async () => {
            try {
              await addDoc(collection(db, 'reports'), {
                spotId: id,
                spotName: spot.name,
                reportedBy: user.uid,
                reason: 'Closed or Moved',
                createdAt: serverTimestamp(),
              });
              Alert.alert('Thanks', 'We\'ll review this spot.');
            } catch (error) {
              console.error('Error reporting:', error);
              Alert.alert('Error', 'Failed to submit report.');
            }
          }
        },
        {
          text: 'Incorrect Info',
          onPress: async () => {
            try {
              await addDoc(collection(db, 'reports'), {
                spotId: id,
                spotName: spot.name,
                reportedBy: user.uid,
                reason: 'Incorrect Information',
                createdAt: serverTimestamp(),
              });
              Alert.alert('Thanks', 'We\'ll review this spot.');
            } catch (error) {
              console.error('Error reporting:', error);
              Alert.alert('Error', 'Failed to submit report.');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleCreatePlan = () => {
    if (!hasLayover) {
      Alert.alert(
        'Set Your Layover First',
        'You need to set your layover before creating a plan.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Set Layover',
            onPress: () => router.push('/(tabs)')
          }
        ]
      );
      return;
    }

    // Navigate to create plan with spot pre-selected
    router.push({
      pathname: '/create-plan',
      params: {
        spotId: id,
        spotName: spot?.name || ''
      }
    });
  };

  const handleEditSpot = () => {
    router.push({
      pathname: '/edit-spot',
      params: { id }
    });
  };

  const averageRating =
    votes.length > 0 ? votes.reduce((sum, v) => sum + v.vote, 0) / votes.length : 0;

  // Get photos from either field
  const spotPhotos = spot?.photoURLs || spot?.photos || [];

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!spot) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Spot not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        {/* Header with Back and Admin Edit */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity style={styles.adminEditButton} onPress={handleEditSpot}>
              <Ionicons name="pencil" size={18} color="#fff" />
              <ThemedText style={styles.adminEditText}>Edit</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        <ThemedText type="title" style={styles.title}>
          {spot.name}
        </ThemedText>

        <View style={styles.metaContainer}>
          <View style={styles.typeTag}>
            <ThemedText style={styles.typeText}>{spot.category || spot.type}</ThemedText>
          </View>
          <ThemedText style={styles.cityText}>📍 {spot.city}</ThemedText>
        </View>

        {/* CREATE PLAN BUTTON */}
        <TouchableOpacity 
          style={styles.createPlanButton}
          onPress={handleCreatePlan}
        >
          <Ionicons name="calendar" size={20} color={Colors.white} />
          <ThemedText style={styles.createPlanButtonText}>Create Plan Here</ThemedText>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </TouchableOpacity>

        {spot.description && (
          <View style={styles.descriptionCard}>
            <ThemedText style={styles.description}>{spot.description}</ThemedText>
          </View>
        )}

        {/* Crew Tips */}
        {spot.tips && (
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={20} color={Colors.accent} />
              <ThemedText style={styles.tipsTitle}>Crew Tips</ThemedText>
            </View>
            <ThemedText style={styles.tipsText}>{spot.tips}</ThemedText>
          </View>
        )}

        <View style={styles.ratingCard}>
          <ThemedText style={styles.sectionTitle}>Rating</ThemedText>
          <View style={styles.ratingContainer}>
            <ThemedText style={styles.averageRating}>
              {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings yet'}
            </ThemedText>
            {votes.length > 0 && (
              <ThemedText style={styles.voteCount}>({votes.length} reviews)</ThemedText>
            )}
          </View>

          <ThemedText style={styles.ratePrompt}>Your Rating:</ThemedText>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleVote(star)}>
                <Ionicons
                  name={myVote && myVote >= star ? 'star' : 'star-outline'}
                  size={40}
                  color={myVote && myVote >= star ? Colors.accent : Colors.text.secondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {spotPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <ThemedText style={styles.sectionTitle}>Photos</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {spotPhotos.map((photoUrl, index) => (
                <Image key={index} source={{ uri: photoUrl }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addPhotoButton, uploadingPhoto && styles.buttonDisabled]}
          onPress={handleAddPhoto}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="camera" size={20} color={Colors.white} />
              <ThemedText style={styles.buttonText}>Add Photo</ThemedText>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>
          {spot.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={Colors.text.secondary} />
              <ThemedText style={styles.infoText}>{spot.address}</ThemedText>
            </View>
          )}
          {spot.phone && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(`tel:${spot.phone}`)}
            >
              <Ionicons name="call" size={20} color={Colors.primary} />
              <ThemedText style={[styles.infoText, styles.linkText]}>{spot.phone}</ThemedText>
            </TouchableOpacity>
          )}
          {spot.website && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(spot.website!)}
            >
              <Ionicons name="globe" size={20} color={Colors.primary} />
              <ThemedText style={[styles.infoText, styles.linkText]}>Visit Website</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.reportButton} onPress={handleReport}>
          <Ionicons name="flag-outline" size={18} color={Colors.error} />
          <ThemedText style={styles.reportButtonText}>Report Issue</ThemedText>
        </TouchableOpacity>

        <View style={styles.addedByContainer}>
          <ThemedText style={styles.addedByText}>
            Added by {spot.addedByName}
          </ThemedText>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  adminEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adminEditText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  typeTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cityText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createPlanButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  descriptionCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text.primary,
  },
  tipsCard: {
    backgroundColor: Colors.accent + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accent,
  },
  tipsText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  ratingCard: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 20,
  },
  averageRating: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  voteCount: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  ratePrompt: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  photosSection: {
    marginBottom: 20,
  },
  photo: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  reportButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  addedByContainer: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addedByText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
    color: Colors.text.secondary,
  },
});
