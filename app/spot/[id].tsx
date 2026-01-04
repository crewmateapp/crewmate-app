// app/spot/[id].tsx
import AppHeader from '@/components/AppHeader';
import AppDrawer from '@/components/AppDrawer';
import { ReviewList } from '@/components/ReviewList';
import { ReviewStatsCard } from '@/components/ReviewStatsCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WriteReviewModal } from '@/components/WriteReviewModal';
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
  Modal,
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

type Review = {
  id: string;
  spotId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  userPosition: string | null;
  rating: number;
  reviewText: string;
  photos: string[];
  helpfulVotes: string[];
  notHelpfulVotes: string[];
  verified: boolean;
  createdAt: any;
  updatedAt: any;
};

type ReviewStats = {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
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

  // Review state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [showQuickRate, setShowQuickRate] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Image viewer state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Drawer state for AppHeader
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Fetch reviews
  useEffect(() => {
    if (!id) return;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('spotId', '==', id)
    );

    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const fetchedReviews: Review[] = [];
      snapshot.docs.forEach((reviewDoc) => {
        fetchedReviews.push({
          id: reviewDoc.id,
          ...reviewDoc.data(),
        } as Review);
      });
      setReviews(fetchedReviews);

      // Calculate review stats
      if (fetchedReviews.length > 0) {
        const stats: ReviewStats = {
          totalReviews: fetchedReviews.length,
          averageRating: fetchedReviews.reduce((sum, r) => sum + r.rating, 0) / fetchedReviews.length,
          ratingBreakdown: {
            5: fetchedReviews.filter(r => r.rating === 5).length,
            4: fetchedReviews.filter(r => r.rating === 4).length,
            3: fetchedReviews.filter(r => r.rating === 3).length,
            2: fetchedReviews.filter(r => r.rating === 2).length,
            1: fetchedReviews.filter(r => r.rating === 1).length,
          }
        };
        setReviewStats(stats);
      } else {
        setReviewStats(null);
      }
    });

    return () => unsubscribe();
  }, [id]);

  // Check if user has a layover set and if verified
  useEffect(() => {
    if (!user || !spot) return;

    const userDoc = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDoc, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setHasLayover(!!userData.currentLayover);
        
        // Check if verified (has been in this city)
        const layoverHistory = userData.layoverHistory || [];
        setIsVerified(layoverHistory.includes(spot.city));
      }
    });

    return () => unsubscribe();
  }, [user, spot]);

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

      setShowQuickRate(false);
      Alert.alert('Thanks!', 'Your rating has been saved.');
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to save rating.');
    }
  };

  const handleWriteReview = async (rating: number, reviewText: string, reviewPhotos: string[]) => {
    if (!user || !id || !spot) return;

    try {
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      // Check if user already reviewed this spot
      const existingReviewQuery = query(
        collection(db, 'reviews'),
        where('spotId', '==', id),
        where('userId', '==', user.uid)
      );
      const existingReviewSnapshot = await getDocs(existingReviewQuery);

      if (!existingReviewSnapshot.empty) {
        Alert.alert('Already Reviewed', 'You\'ve already reviewed this spot. Edit your existing review instead.');
        return;
      }

      // Upload review photos if any
      const uploadedPhotoURLs: string[] = [];
      for (const photoUri of reviewPhotos) {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const photoRef = ref(storage, `reviews/${id}/${user.uid}/${Date.now()}.jpg`);
        await uploadBytes(photoRef, blob);
        const downloadURL = await getDownloadURL(photoRef);
        uploadedPhotoURLs.push(downloadURL);
      }

      // Create review
      await addDoc(collection(db, 'reviews'), {
        spotId: id,
        userId: user.uid,
        userName: userData?.displayName || 'Unknown',
        userPhoto: userData?.photoURL || null,
        userPosition: userData?.position || null,
        rating: rating,
        reviewText: reviewText.trim(),
        photos: uploadedPhotoURLs,
        helpfulVotes: [],
        notHelpfulVotes: [],
        verified: isVerified,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create activity
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

      Alert.alert('Thanks!', 'Your review has been posted.');
    } catch (error) {
      console.error('Error posting review:', error);
      Alert.alert('Error', 'Failed to post review. Please try again.');
      throw error;
    }
  };

  const handleHelpfulVote = async (reviewId: string, currentHelpfulVotes: string[]) => {
    if (!user) return;

    try {
      const reviewDoc = doc(db, 'reviews', reviewId);
      
      if (currentHelpfulVotes.includes(user.uid)) {
        // Remove vote
        await updateDoc(reviewDoc, {
          helpfulVotes: currentHelpfulVotes.filter(id => id !== user.uid),
        });
      } else {
        // Add vote
        await updateDoc(reviewDoc, {
          helpfulVotes: [...currentHelpfulVotes, user.uid],
        });
      }
    } catch (error) {
      console.error('Error voting on review:', error);
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
              await addDoc(collection(db, 'spotReports'), {
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
              await addDoc(collection(db, 'spotReports'), {
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
    <>
      <AppDrawer 
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      
      <AppHeader 
        onMenuPress={() => setDrawerOpen(true)}
        onConnectionsPress={() => router.push('/(tabs)/connections')}
      />
      <ScrollView style={styles.scrollContainer}>
        <ThemedView style={styles.container}>
          {/* Hero Image with Overlays */}
          {spotPhotos.length > 0 ? (
            <View style={styles.heroContainer}>
              <TouchableOpacity onPress={() => setSelectedImage(spotPhotos[0])}>
                <Image
                  source={{ uri: spotPhotos[0] }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              
              {/* Back Button Overlay */}
              <TouchableOpacity 
                style={styles.backButtonOverlay} 
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              
              {/* Rating Overlay */}
              {averageRating > 0 && (
                <View style={styles.ratingOverlay}>
                  <Ionicons name="star" size={20} color={Colors.accent} />
                  <ThemedText style={styles.ratingOverlayText}>
                    {averageRating.toFixed(1)}
                  </ThemedText>
                </View>
              )}
              
              {/* Admin Edit Button Overlay */}
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.adminEditButtonOverlay} 
                  onPress={handleEditSpot}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <ThemedText style={styles.adminEditText}>Edit</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // Fallback if no photos - show back button normally
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
                <ThemedText style={styles.backText}>Back</ThemedText>
              </TouchableOpacity>
              
              {isAdmin && (
                <TouchableOpacity style={styles.adminEditButton} onPress={handleEditSpot}>
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <ThemedText style={styles.adminEditText}>Edit</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}

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

        {/* REVIEW STATS CARD */}
        <ReviewStatsCard
          stats={reviewStats}
          quickVoteCount={votes.length}
          quickVoteAverage={averageRating}
          onWriteReview={() => setShowWriteReview(true)}
          onQuickRate={() => setShowQuickRate(true)}
        />

        {/* More Photos Section - Show remaining photos (skip first since it's hero) */}
        {spotPhotos.length > 1 && (
          <View style={styles.photosSection}>
            <ThemedText style={styles.sectionTitle}>📸 More Photos</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {spotPhotos.slice(1).map((photoUrl, index) => (
                <TouchableOpacity key={index} onPress={() => setSelectedImage(photoUrl)}>
                  <Image source={{ uri: photoUrl }} style={styles.photo} />
                </TouchableOpacity>
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

        {/* Details Card */}
        <View style={styles.infoCard}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>
          {spot.address && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={async () => {
                try {
                  const address = encodeURIComponent(spot.address);
                  let url;
                  if (Platform.OS === 'ios') {
                    url = `maps://maps.apple.com/?address=${address}`;
                  } else {
                    url = `https://www.google.com/maps/search/?api=1&query=${address}`;
                  }
                  const supported = await Linking.canOpenURL(url);
                  if (supported) {
                    await Linking.openURL(url);
                  } else {
                    // Fallback to web maps
                    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
                  }
                } catch (error) {
                  console.error('Error opening maps:', error);
                  Alert.alert('Error', 'Could not open maps app');
                }
              }}
            >
              <Ionicons name="location" size={20} color={Colors.primary} />
              <ThemedText style={[styles.infoText, styles.linkText]}>{spot.address}</ThemedText>
            </TouchableOpacity>
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

        {/* REVIEW LIST */}
        <ReviewList
          reviews={reviews}
          currentUserId={user?.uid}
          onHelpfulVote={handleHelpfulVote}
          onPhotoPress={setSelectedImage}
        />

        {/* Report Button */}
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

      {/* WRITE REVIEW MODAL */}
      <WriteReviewModal
        visible={showWriteReview}
        onClose={() => setShowWriteReview(false)}
        onSubmit={handleWriteReview}
        spotName={spot.name}
        isVerified={isVerified}
      />

      {/* QUICK RATE MODAL */}
      <Modal
        visible={showQuickRate}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowQuickRate(false)}
      >
        <View style={styles.quickRateOverlay}>
          <View style={styles.quickRateModal}>
            <View style={styles.quickRateHeader}>
              <ThemedText style={styles.quickRateTitle}>Quick Rate</ThemedText>
              <TouchableOpacity onPress={() => setShowQuickRate(false)}>
                <Ionicons name="close" size={28} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={styles.quickRateSpot}>{spot.name}</ThemedText>
            
            <View style={styles.quickRateStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity 
                  key={star} 
                  onPress={() => handleVote(star)}
                  style={styles.quickRateStar}
                >
                  <Ionicons
                    name={myVote && myVote >= star ? 'star' : 'star-outline'}
                    size={56}
                    color={myVote && myVote >= star ? Colors.accent : Colors.text.secondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {myVote !== null && (
              <ThemedText style={styles.currentRating}>
                Current: {myVote} {myVote === 1 ? 'star' : 'stars'}
              </ThemedText>
            )}
          </View>
        </View>
      </Modal>

      {/* IMAGE VIEWER MODAL */}
      <Modal
        visible={selectedImage !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity 
            style={styles.imageViewerClose}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color={Colors.white} />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },
  // Hero Image Styles
  heroContainer: {
    height: 250,
    position: 'relative',
    marginLeft: -20,
    marginRight: -20,
    marginTop: -20,
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: 250,
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingOverlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  adminEditButtonOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#9333EA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.text.primary,
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
    marginTop: 20,
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
  quickRateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickRateModal: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  quickRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickRateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  quickRateSpot: {
    fontSize: 18,
    color: Colors.text.secondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  quickRateStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  quickRateStar: {
    padding: 4,
  },
  currentRating: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
});
