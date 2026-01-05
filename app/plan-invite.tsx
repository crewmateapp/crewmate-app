// app/plan-invite.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Plan = {
  id: string;
  title: string;
  hostUserId: string;
  hostName: string;
  spotName: string;
  city: string;
  scheduledTime: any;
  attendeeIds: string[];
};

type UserProfile = {
  displayName: string;
  photoURL?: string;
};

export default function PlanInviteScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'show' | 'scan'>('show');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load plan and user profile
  useEffect(() => {
    const loadData = async () => {
      if (!planId || !user) return;

      try {
        // Load plan
        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (planDoc.exists()) {
          setPlan({ id: planDoc.id, ...planDoc.data() } as Plan);
        }

        // Load user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [planId, user]);

  const handleShare = async () => {
    if (!plan) return;
    
    try {
      await Share.share({
        message: `Join my plan "${plan.title}" on CrewMate! Scan the QR code in the app to join.`,
        title: `Join ${plan.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Check if users are connected
  const checkConnection = async (userId1: string, userId2: string): Promise<boolean> => {
    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', userId1)
    );
    const snapshot = await getDocs(connectionsQuery);
    return snapshot.docs.some(doc => doc.data().userIds.includes(userId2));
  };

  // Send connection request
  const sendConnectionRequest = async (toUserId: string, toUserName: string) => {
    if (!user || !userProfile) return;

    // Check if request already exists
    const existingQuery = query(
      collection(db, 'connectionRequests'),
      where('fromUserId', '==', user.uid),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (existingSnapshot.empty) {
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        fromUserName: userProfile.displayName,
        toUserId: toUserId,
        toUserName: toUserName,
        status: 'pending',
        createdAt: serverTimestamp(),
        // Store plan info so we can auto-add them after connection
        pendingPlanInvite: planId,
      });
    }
  };

  // Add user to plan
  const addUserToPlan = async (userId: string, userName: string, userPhoto: string | null) => {
    if (!planId) return;

    // Check if already attending
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) return;
    
    const planData = planDoc.data();
    if (planData.attendeeIds?.includes(userId)) {
      return; // Already attending
    }

    // Add to plan
    await updateDoc(doc(db, 'plans', planId), {
      attendeeIds: arrayUnion(userId),
      attendeeCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Add attendee document
    await setDoc(doc(db, 'plans', planId, 'attendees', userId), {
      userId: userId,
      displayName: userName,
      photoURL: userPhoto,
      rsvpStatus: 'going',
      joinedAt: serverTimestamp(),
      invitedViaQR: true,
    });
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing || !user || !plan) return;
    
    setScanned(true);
    setProcessing(true);

    try {
      // QR code contains the user ID to invite
      const scannedUserId = data;

      // Can't invite yourself
      if (scannedUserId === user.uid) {
        Alert.alert('Oops!', "That's your own code! 😄");
        setTimeout(() => {
          setScanned(false);
          setProcessing(false);
        }, 2000);
        return;
      }

      // Get scanned user's profile
      const scannedUserDoc = await getDoc(doc(db, 'users', scannedUserId));
      if (!scannedUserDoc.exists()) {
        Alert.alert('Error', 'User not found.');
        setTimeout(() => {
          setScanned(false);
          setProcessing(false);
        }, 2000);
        return;
      }

      const scannedUserData = scannedUserDoc.data();
      const scannedUserName = scannedUserData.displayName || 'Unknown';
      const scannedUserPhoto = scannedUserData.photoURL || null;

      // Check if already attending this plan
      if (plan.attendeeIds?.includes(scannedUserId)) {
        Alert.alert(
          'Already Attending!',
          `${scannedUserName} is already part of this plan.`
        );
        setTimeout(() => {
          setScanned(false);
          setProcessing(false);
        }, 2000);
        return;
      }

      // Check if connected
      const isConnected = await checkConnection(user.uid, scannedUserId);

      if (isConnected) {
        // Already connected - just add to plan
        await addUserToPlan(scannedUserId, scannedUserName, scannedUserPhoto);
        
        Alert.alert(
          'Added to Plan! 🎉',
          `${scannedUserName} has been added to "${plan.title}"!`,
          [{ text: 'Awesome!', onPress: () => setScanned(false) }]
        );
        setProcessing(false);
      } else {
        // Not connected - need to connect first
        Alert.alert(
          'Connection Required',
          `You're not connected with ${scannedUserName} yet. Send a connection request first?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: 'Send Request & Add to Plan',
              onPress: async () => {
                await sendConnectionRequest(scannedUserId, scannedUserName);
                // Add them to plan immediately (they can see it even without connection)
                await addUserToPlan(scannedUserId, scannedUserName, scannedUserPhoto);
                
                Alert.alert(
                  'Done! 🎉',
                  `Connection request sent to ${scannedUserName} and they've been added to the plan!`,
                  [{ text: 'Great!', onPress: () => setScanned(false) }]
                );
                setProcessing(false);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      Alert.alert('Error', 'Failed to process. Please try again.');
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  if (!plan) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Plan not found</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // The QR code value is: PLAN:{planId}
  // This distinguishes it from user QR codes (which are just the userId)
  const qrValue = `PLAN:${planId}`;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Share Plan</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, tab === 'show' && styles.tabActive]}
          onPress={() => {
            setTab('show');
            setScanned(false);
            setProcessing(false);
          }}
        >
          <ThemedText style={[styles.tabText, tab === 'show' && styles.tabTextActive]}>
            Show Code
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'scan' && styles.tabActive]}
          onPress={() => setTab('scan')}
        >
          <ThemedText style={[styles.tabText, tab === 'scan' && styles.tabTextActive]}>
            Scan to Add
          </ThemedText>
        </Pressable>
      </View>

      {/* Content */}
      {tab === 'show' ? (
        <View style={styles.content}>
          <View style={styles.qrContainer}>
            <QRCode
              value={qrValue}
              size={220}
              backgroundColor="white"
              color={Colors.primary}
            />
          </View>

          <View style={styles.planInfo}>
            <ThemedText style={styles.planTitle}>{plan.title}</ThemedText>
            <ThemedText style={styles.planSpot}>📍 {plan.spotName}</ThemedText>
            <ThemedText style={styles.planTime}>
              🗓️ {formatDateTime(plan.scheduledTime)}
            </ThemedText>
            <ThemedText style={styles.planCity}>{plan.city}</ThemedText>
          </View>

          <ThemedText style={styles.instructions}>
            Have crew members scan this code to join your plan instantly!
          </ThemedText>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
            <ThemedText style={styles.shareButtonText}>Share Link</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {!permission?.granted ? (
            <View style={styles.permissionContainer}>
              <Ionicons name="camera-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.permissionTitle}>
                Camera Access Needed
              </ThemedText>
              <ThemedText style={styles.permissionText}>
                Allow camera access to scan other crew members' QR codes and add them to your plan
              </ThemedText>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                <ThemedText style={styles.permissionButtonText}>Enable Camera</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scannerContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  {processing ? (
                    <View style={styles.processingContainer}>
                      <ActivityIndicator size="large" color={Colors.white} />
                      <ThemedText style={styles.processingText}>Adding to plan...</ThemedText>
                    </View>
                  ) : (
                    <>
                      <ThemedText style={styles.scannerText}>
                        {scanned ? 'Scanned!' : 'Scan a crew member\'s QR code'}
                      </ThemedText>
                      <ThemedText style={styles.scannerSubtext}>
                        They'll be added to "{plan.title}"
                      </ThemedText>
                    </>
                  )}
                </View>
              </CameraView>
              
              {scanned && !processing && (
                <TouchableOpacity 
                  style={styles.scanAgainButton}
                  onPress={() => setScanned(false)}
                >
                  <ThemedText style={styles.scanAgainText}>Scan Another</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </ThemedView>
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
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrContainer: {
    backgroundColor: Colors.white,
    padding: 25,
    borderRadius: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  planInfo: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  planSpot: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  planTime: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  planCity: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  instructions: {
    textAlign: 'center',
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 25,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.text.primary,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: Colors.white,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 25,
    textAlign: 'center',
  },
  scannerSubtext: {
    color: Colors.white,
    fontSize: 14,
    marginTop: 8,
    opacity: 0.8,
    textAlign: 'center',
  },
  processingContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
  },
  processingText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  scanAgainButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: Colors.white,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanAgainText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
    color: Colors.text.secondary,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    alignSelf: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
