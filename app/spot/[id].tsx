import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type Spot = {
  id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  reservationUrl?: string;
  photoURLs?: string[];
  tips?: string;
  addedBy: string;
  addedByName: string;
  createdAt: Date;
};

const categoryEmojis: { [key: string]: string } = {
  coffee: '☕',
  food: '🍽️',
  bar: '🍸',
  gym: '💪',
  activity: '🎯',
};

const reportReasons = [
  { id: 'spam', label: 'Spam or Fake' },
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'closed', label: 'Closed or Doesn\'t Exist' },
  { id: 'wrong_info', label: 'Wrong Information' },
  { id: 'other', label: 'Other' },
];

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  useEffect(() => {
    const loadSpot = async () => {
      if (!id || typeof id !== 'string') return;

      try {
        const spotDoc = await getDoc(doc(db, 'spots', id));
        if (spotDoc.exists()) {
          const data = spotDoc.data();
          setSpot({
            id: spotDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as Spot);
        }
      } catch (error) {
        console.error('Error loading spot:', error);
        Alert.alert('Error', 'Failed to load spot details');
      } finally {
        setLoading(false);
      }
    };

    loadSpot();
  }, [id]);

  const openMaps = () => {
    if (!spot?.latitude || !spot?.longitude) {
      Alert.alert('No Location', 'This spot doesn\'t have coordinates set.');
      return;
    }

    const label = encodeURIComponent(spot.name);
    const coords = `${spot.latitude},${spot.longitude}`;

    const url = Platform.select({
      ios: `maps://app?daddr=${coords}&q=${label}`,
      android: `geo:0,0?q=${coords}(${label})`,
    }) || `https://www.google.com/maps/search/?api=1&query=${coords}`;

    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords}`);
    });
  };

  const openPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openWebsite = (url: string) => {
    // Add https:// if not present
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(formattedUrl).catch(() => {
      Alert.alert('Error', 'Could not open website');
    });
  };

  const handleReport = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for reporting this spot');
      return;
    }

    if (!user || !spot) return;

    try {
      await addDoc(collection(db, 'spotReports'), {
        spotId: spot.id,
        spotName: spot.name,
        reportedBy: user.uid,
        reportedByName: user.email?.split('@')[0] || 'Unknown',
        reason: selectedReason,
        createdAt: serverTimestamp(),
      });

      setReportModalVisible(false);
      setSelectedReason('');
      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep CrewMate safe. We\'ll review this report.'
      );
    } catch (error) {
      console.error('Error reporting spot:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const handleRequestDelete = () => {
  if (!spot || !user) return;

  Alert.prompt(
    'Request Deletion',
    'Please tell us why this spot should be removed:',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit Request',
        onPress: async (reason) => {
          if (!reason || !reason.trim()) {
            Alert.alert('Reason Required', 'Please provide a reason for deletion.');
            return;
          }

          try {
            await addDoc(collection(db, 'deleteRequests'), {
              spotId: spot.id,
              spotName: spot.name,
              requestedBy: user.uid,
              requestedByName: user.email?.split('@')[0] || 'Unknown',
              reason: reason.trim(),
              createdAt: serverTimestamp(),
            });

            Alert.alert(
              'Request Submitted',
              'We\'ll review your deletion request. Thank you!'
            );
          } catch (error) {
            console.error('Error submitting delete request:', error);
            Alert.alert('Error', 'Failed to submit request. Please try again.');
          }
        },
      },
    ],
    'plain-text'
  );
};

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Spot Details</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </ThemedView>
    );
  }

  if (!spot) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Spot Details</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Spot not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <ThemedView style={styles.container}>
        {/* Header with Action Buttons */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Spot Details</ThemedText>
          
          {/* Action Menu */}
          <View style={styles.headerActions}>
            {/* Delete if you added it */}
            {spot.addedBy === user?.uid && (
              <TouchableOpacity onPress={handleRequestDelete} style={styles.headerActionButton}>
                <Ionicons name="trash-outline" size={22} color="#f44336" />
              </TouchableOpacity>
            )}
            
            {/* Report button (everyone can report) */}
            <TouchableOpacity 
              onPress={() => setReportModalVisible(true)} 
              style={styles.headerActionButton}
            >
              <Ionicons name="flag-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos */}
        {spot.photoURLs && spot.photoURLs.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
          >
            {spot.photoURLs.map((url, index) => (
              <Image key={index} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        {/* Main Info */}
        <View style={styles.mainInfo}>
          <View style={styles.categoryBadge}>
            <ThemedText style={styles.categoryEmoji}>
              {categoryEmojis[spot.category] || '📍'}
            </ThemedText>
            <ThemedText style={styles.categoryText}>
              {spot.category.charAt(0).toUpperCase() + spot.category.slice(1)}
            </ThemedText>
          </View>

          <ThemedText type="title" style={styles.name}>
            {spot.name}
          </ThemedText>

          <ThemedText style={styles.area}>
            {spot.area}, {spot.city}
          </ThemedText>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          {(spot.latitude && spot.longitude) && (
            <TouchableOpacity style={styles.actionButton} onPress={openMaps}>
              <Ionicons name="navigate" size={20} color="#2196F3" />
              <ThemedText style={styles.actionText}>Directions</ThemedText>
            </TouchableOpacity>
          )}

          {spot.phone && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openPhone(spot.phone!)}
            >
              <Ionicons name="call" size={20} color="#2196F3" />
              <ThemedText style={styles.actionText}>Call</ThemedText>
            </TouchableOpacity>
          )}

          {spot.website && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openWebsite(spot.website!)}
            >
              <Ionicons name="globe" size={20} color="#2196F3" />
              <ThemedText style={styles.actionText}>Website</ThemedText>
            </TouchableOpacity>
          )}

          {spot.reservationUrl && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openWebsite(spot.reservationUrl!)}
            >
              <Ionicons name="calendar" size={20} color="#2196F3" />
              <ThemedText style={styles.actionText}>Reserve</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        {spot.description && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About</ThemedText>
            <ThemedText style={styles.description}>{spot.description}</ThemedText>
          </View>
        )}

        {/* Address */}
        {spot.address && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Address</ThemedText>
            <Pressable onPress={openMaps}>
              <ThemedText style={styles.address}>{spot.address}</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Crew Tips */}
        {spot.tips && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>✈️ Crew Tips</ThemedText>
            <View style={styles.tipsBox}>
              <ThemedText style={styles.tips}>{spot.tips}</ThemedText>
            </View>
          </View>
        )}

        {/* Added By */}
        <View style={styles.footer}>
          <ThemedText style={styles.addedBy}>
            Recommended by {spot.addedByName}
          </ThemedText>
        </View>

        {/* Report Modal */}
        <Modal
          visible={reportModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.reportModal}>
              <ThemedText style={styles.reportModalTitle}>Report Spot</ThemedText>
              <ThemedText style={styles.reportModalSubtitle}>
                Why are you reporting "{spot.name}"?
              </ThemedText>

              <View style={styles.reasonsList}>
                {reportReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.reasonButton,
                      selectedReason === reason.id && styles.reasonButtonActive,
                    ]}
                    onPress={() => setSelectedReason(reason.id)}
                  >
                    <View style={styles.reasonRadio}>
                      {selectedReason === reason.id && (
                        <View style={styles.reasonRadioInner} />
                      )}
                    </View>
                    <ThemedText style={styles.reasonLabel}>{reason.label}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.reportModalActions}>
                <TouchableOpacity
                  style={[styles.reportModalButton, styles.reportModalButtonCancel]}
                  onPress={() => {
                    setReportModalVisible(false);
                    setSelectedReason('');
                  }}
                >
                  <ThemedText style={styles.reportModalButtonTextCancel}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportModalButton, styles.reportModalButtonSubmit]}
                  onPress={handleReport}
                >
                  <ThemedText style={styles.reportModalButtonTextSubmit}>Submit Report</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    opacity: 0.5,
  },
  photoScroll: {
    height: 250,
  },
  photo: {
    width: 400,
    height: 250,
    resizeMode: 'cover',
  },
  mainInfo: {
    padding: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  area: {
    fontSize: 16,
    opacity: 0.7,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  actionText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  address: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  tipsBox: {
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  tips: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  addedBy: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  reportModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  reportModalSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
    color: '#000',
  },
  reasonsList: {
    gap: 12,
    marginBottom: 20,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  reasonButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reasonRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  reasonLabel: {
    fontSize: 16,
    color: '#000',
  },
  reportModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reportModalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportModalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  reportModalButtonSubmit: {
    backgroundColor: '#f44336',
  },
  reportModalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  reportModalButtonTextSubmit: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});