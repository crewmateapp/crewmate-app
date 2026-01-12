// app/qr-code.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { notifyConnectionRequest } from '@/utils/notifications';
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
import { useEffect, useRef, useState } from 'react';
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

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string;
};

type Plan = {
  id: string;
  title: string;
  hostUserId: string;
  hostName: string;
  spotName: string;
  city: string;
  attendeeIds: string[];
};

export default function QRCodeModal() {
  const { user } = useAuth();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'show' | 'scan'>(
    initialTab === 'scan' ? 'scan' : 'show'
  );
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // DEBOUNCE FIX: Use ref to track last scan time
  const lastScanRef = useRef<number>(0);
  const SCAN_COOLDOWN = 3000; // 3 seconds between scans

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleShare = async () => {
    try {
      const deepLink = `crewmateapp://connect/${user?.uid}`;
      await Share.share({
        message: `Connect with me on CrewMate! Tap this link to send me a connection request:\n\n${deepLink}`,
        title: 'Connect on CrewMate',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
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

  // Handle plan QR code scan
  const handlePlanQRCode = async (planId: string) => {
    if (!user || !profile) return;

    try {
      // Get plan details
      const planDoc = await getDoc(doc(db, 'plans', planId));
      if (!planDoc.exists()) {
        Alert.alert('Error', 'Plan not found. It may have been cancelled.');
        resetScanner();
        return;
      }

      const plan = { id: planDoc.id, ...planDoc.data() } as Plan;

      // Check if already attending
      if (plan.attendeeIds?.includes(user.uid)) {
        Alert.alert(
          'Already Joined!',
          `You're already part of "${plan.title}"`,
          [
            {
              text: 'View Plan',
              onPress: () => {
                resetScanner();
                router.back();
                router.push({ pathname: '/plan/[id]', params: { id: planId } });
              }
            },
            {
              text: 'OK',
              onPress: () => resetScanner()
            }
          ]
        );
        return;
      }

      // Check if connected to host
      const isConnectedToHost = await checkConnection(user.uid, plan.hostUserId);

      if (isConnectedToHost) {
        // Connected - just join the plan
        await joinPlan(planId, plan.title);
        resetScanner();
      } else {
        // Not connected - ask to connect first
        Alert.alert(
          'Join Plan',
          `"${plan.title}" is hosted by ${plan.hostName}. You're not connected yet. Would you like to send a connection request and join the plan?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resetScanner()
            },
            {
              text: 'Connect & Join',
              onPress: async () => {
                // Send connection request to host
                await sendConnectionRequest(plan.hostUserId, plan.hostName, planId);
                // Join the plan
                await joinPlan(planId, plan.title);
                resetScanner();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error handling plan QR:', error);
      Alert.alert('Error', 'Failed to join plan. Please try again.');
      resetScanner();
    }
  };

  // Send connection request
  const sendConnectionRequest = async (toUserId: string, toUserName: string, pendingPlanId?: string) => {
    if (!user || !profile) return;

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
        fromUserName: profile.displayName,
        toUserId: toUserId,
        toUserName: toUserName,
        status: 'pending',
        createdAt: serverTimestamp(),
        ...(pendingPlanId && { pendingPlanInvite: pendingPlanId }),
      });
    }
  };

  // Join a plan
  const joinPlan = async (planId: string, planTitle: string) => {
    if (!user || !profile) return;

    try {

      // Notify the recipient of the connection request  
      await notifyConnectionRequest(
        toUserId,
        user.uid,
        profile.displayName,
        profile.photoURL
      );
      // Add user to plan
      await updateDoc(doc(db, 'plans', planId), {
        attendeeIds: arrayUnion(user.uid),
        attendeeCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // Add attendee document
      await setDoc(doc(db, 'plans', planId, 'attendees', user.uid), {
        userId: user.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
        rsvpStatus: 'going',
        joinedAt: serverTimestamp(),
        joinedViaQR: true,
      });

      Alert.alert(
        'Joined! 🎉',
        `You've joined "${planTitle}"!`,
        [
          {
            text: 'View Plan',
            onPress: () => {
              router.back();
              router.push({ pathname: '/plan/[id]', params: { id: planId } });
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Error joining plan:', error);
      throw error;
    }
  };

  // Handle user QR code scan (existing logic)
  const handleUserQRCode = async (scannedUserId: string) => {
    if (!user || !profile) return;

    // Check if scanning yourself
    if (scannedUserId === user.uid) {
      Alert.alert('Oops!', "You can't connect with yourself! 😄", [
        { text: 'OK', onPress: () => resetScanner() }
      ]);
      return;
    }

    // Get scanned user's profile
    const scannedUserDoc = await getDoc(doc(db, 'users', scannedUserId));
    if (!scannedUserDoc.exists()) {
      Alert.alert('Error', 'User not found. They may have deleted their account.', [
        { text: 'OK', onPress: () => resetScanner() }
      ]);
      return;
    }

    const scannedUserData = scannedUserDoc.data() as UserProfile;

    // Check if already connected
    const isConnected = await checkConnection(user.uid, scannedUserId);

    if (isConnected) {
      Alert.alert(
        'Already Connected!',
        `You're already connected with ${scannedUserData.displayName}. Check your Connections tab to chat!`,
        [{ text: 'OK', onPress: () => resetScanner() }]
      );
      return;
    }

    // Check if request already exists
    const requestsQuery = query(
      collection(db, 'connectionRequests'),
      where('fromUserId', '==', user.uid),
      where('toUserId', '==', scannedUserId),
      where('status', '==', 'pending')
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    if (!requestsSnapshot.empty) {
      Alert.alert(
        'Request Already Sent',
        `You already sent a connection request to ${scannedUserData.displayName}. They'll see it in their Connections tab!`,
        [{ text: 'OK', onPress: () => resetScanner() }]
      );
      return;
    }

    // Check if they sent you a request (reverse)
    const reverseRequestQuery = query(
      collection(db, 'connectionRequests'),
      where('fromUserId', '==', scannedUserId),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const reverseRequestSnapshot = await getDocs(reverseRequestQuery);

    if (!reverseRequestSnapshot.empty) {
      Alert.alert(
        'They Already Sent You a Request!',
        `${scannedUserData.displayName} already sent you a connection request. Check your Connections tab to accept it!`,
        [{ text: 'OK', onPress: () => resetScanner() }]
      );
      return;
    }

    // Send connection request
    await addDoc(collection(db, 'connectionRequests'), {
      fromUserId: user.uid,
      fromUserName: profile.displayName,
      toUserId: scannedUserId,
      toUserName: scannedUserData.displayName,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    // Notify the scanned user of the connection request
    await notifyConnectionRequest(
      scannedUserId,
      user.uid,
      profile.displayName,
      profile.photoURL
    );

    Alert.alert(
      'Request Sent! ✈️',
      `Connection request sent to ${scannedUserData.displayName}. They'll see it in their Connections tab!`,
      [
        {
          text: 'Done',
          onPress: () => {
            resetScanner();
            router.back();
          }
        }
      ]
    );
  };

  // DEBOUNCE FIX: Reset scanner state
  const resetScanner = () => {
    setScanned(false);
    setProcessing(false);
  };

  // DEBOUNCE FIX: Enhanced handleBarCodeScanned with cooldown
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    const now = Date.now();
    
    // Check if we're in cooldown period
    if (now - lastScanRef.current < SCAN_COOLDOWN) {
      console.log('Scan ignored - cooldown active');
      return;
    }
    
    // Check if already processing
    if (scanned || processing) {
      console.log('Scan ignored - already processing');
      return;
    }
    
    // Update last scan time and set states
    lastScanRef.current = now;
    setScanned(true);
    setProcessing(true);

    try {
      // Check if it's a plan QR code (format: "PLAN:{planId}")
      if (data.startsWith('PLAN:')) {
        const planId = data.replace('PLAN:', '');
        await handlePlanQRCode(planId);
      } else {
        // It's a user QR code (just the userId)
        await handleUserQRCode(data);
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      Alert.alert('Error', 'Failed to process QR code. Please try again.', [
        { text: 'OK', onPress: () => resetScanner() }
      ]);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Error loading profile</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <ThemedText>Close</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Connect with Crew</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, tab === 'show' && styles.activeTab]}
          onPress={() => setTab('show')}
        >
          <ThemedText style={[styles.tabText, tab === 'show' && styles.activeTabText]}>
            My QR Code
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'scan' && styles.activeTab]}
          onPress={() => {
            setTab('scan');
            resetScanner(); // Reset when switching tabs
          }}
        >
          <ThemedText style={[styles.tabText, tab === 'scan' && styles.activeTabText]}>
            Scan QR
          </ThemedText>
        </Pressable>
      </View>

      {/* Content */}
      {tab === 'show' ? (
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={user?.uid || ''}
              size={250}
              backgroundColor="white"
              color={Colors.primary}
            />
          </View>
          
          <View style={styles.infoCard}>
            <ThemedText style={styles.infoTitle}>{profile.displayName}</ThemedText>
            <ThemedText style={styles.infoSubtitle}>
              {profile.airline} • {profile.base}
            </ThemedText>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={Colors.white} />
            <ThemedText style={styles.shareButtonText}>Share My Code</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.instructionText}>
            Have another crew member scan this code to connect!
          </ThemedText>
        </View>
      ) : (
        <View style={styles.scanContainer}>
          {permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              />
              
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
              </View>

              {scanned && (
                <View style={styles.scanningIndicator}>
                  <ActivityIndicator size="large" color={Colors.white} />
                  <ThemedText style={styles.scanningText}>Processing...</ThemedText>
                </View>
              )}

              <View style={styles.scanInstructions}>
                <ThemedText style={styles.scanInstructionText}>
                  Position QR code within the frame
                </ThemedText>
              </View>

              {scanned && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={resetScanner}
                >
                  <ThemedText style={styles.resetButtonText}>Scan Again</ThemedText>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.permissionContainer}>
              <Ionicons name="camera-outline" size={64} color={Colors.text.secondary} />
              <ThemedText style={styles.permissionText}>
                Camera permission is required to scan QR codes
              </ThemedText>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                <ThemedText style={styles.permissionButtonText}>Grant Permission</ThemedText>
              </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.white,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrWrapper: {
    backgroundColor: Colors.white,
    padding: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 20,
  },
  infoCard: {
    alignItems: 'center',
    marginTop: 30,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  scanContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: Colors.accent,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scanningIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -50,
  },
  scanningText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scanInstructions: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanInstructionText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  resetButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resetButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
