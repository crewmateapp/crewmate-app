// app/qr-code.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'show' | 'scan'>('show');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

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
      await Share.share({
        message: `Connect with me on CrewMate! https://crewmate.app/connect/${user?.uid}`,
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
                router.back();
                router.push({ pathname: '/plan/[id]', params: { id: planId } });
              }
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
      } else {
        // Not connected - ask to connect first
        Alert.alert(
          'Join Plan',
          `"${plan.title}" is hosted by ${plan.hostName}. You're not connected yet. Would you like to send a connection request and join the plan?`,
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
              text: 'Connect & Join',
              onPress: async () => {
                // Send connection request to host
                await sendConnectionRequest(plan.hostUserId, plan.hostName, planId);
                // Join the plan
                await joinPlan(planId, plan.title);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error handling plan QR:', error);
      Alert.alert('Error', 'Failed to join plan. Please try again.');
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
          }
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
      Alert.alert('Oops!', "You can't connect with yourself! 😄");
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
      return;
    }

    // Get scanned user's profile
    const scannedUserDoc = await getDoc(doc(db, 'users', scannedUserId));
    if (!scannedUserDoc.exists()) {
      Alert.alert('Error', 'User not found. They may have deleted their account.');
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
      return;
    }

    const scannedUserData = scannedUserDoc.data() as UserProfile;

    // Check if already connected
    const isConnected = await checkConnection(user.uid, scannedUserId);

    if (isConnected) {
      Alert.alert(
        'Already Connected!',
        `You're already connected with ${scannedUserData.displayName}. Check your Connections tab to chat!`
      );
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
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
        `You already sent a connection request to ${scannedUserData.displayName}. They'll see it in their Connections tab!`
      );
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
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
        `${scannedUserData.displayName} already sent you a connection request. Check your Connections tab to accept it!`
      );
      setTimeout(() => {
        setScanned(false);
        setProcessing(false);
      }, 2000);
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

    Alert.alert(
      'Request Sent! ✈️',
      `Connection request sent to ${scannedUserData.displayName}. They'll see it in their Connections tab!`,
      [
        {
          text: 'Done',
          onPress: () => router.back()
        }
      ]
    );
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    
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
      Alert.alert('Error', 'Failed to process QR code. Please try again.');
    } finally {
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

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Quick Connect</ThemedText>
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
            My Code
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'scan' && styles.tabActive]}
          onPress={() => setTab('scan')}
        >
          <ThemedText style={[styles.tabText, tab === 'scan' && styles.tabTextActive]}>
            Scan Code
          </ThemedText>
        </Pressable>
      </View>

      {/* Content */}
      {tab === 'show' ? (
        <View style={styles.content}>
          <View style={styles.qrContainer}>
            <QRCode
              value={user?.uid || ''}
              size={250}
              backgroundColor="white"
              color={Colors.primary}
            />
          </View>

          <View style={styles.profileInfo}>
            <ThemedText style={styles.displayName}>{profile?.displayName}</ThemedText>
            <ThemedText style={styles.airline}>{profile?.airline}</ThemedText>
            <ThemedText style={styles.base}>📍 {profile?.base}</ThemedText>
          </View>

          <ThemedText style={styles.instructions}>
            Have a crew member scan this code to connect instantly!
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
                Allow CrewMate to use your camera to scan QR codes from other crew members
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
                      <ThemedText style={styles.processingText}>Processing...</ThemedText>
                    </View>
                  ) : (
                    <>
                      <ThemedText style={styles.scannerText}>
                        {scanned ? 'QR Code Scanned!' : 'Point camera at QR code'}
                      </ThemedText>
                      <ThemedText style={styles.scannerHint}>
                        Scan crew codes or plan codes
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
                  <ThemedText style={styles.scanAgainText}>Scan Again</ThemedText>
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
    backgroundColor: Colors.white,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrContainer: {
    backgroundColor: Colors.white,
    padding: 30,
    borderRadius: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  airline: {
    fontSize: 18,
    color: Colors.primary,
    marginBottom: 5,
  },
  base: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  instructions: {
    textAlign: 'center',
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 30,
    paddingHorizontal: 20,
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
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.text.primary,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 10,
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
    marginTop: 30,
    textAlign: 'center',
  },
  scannerHint: {
    color: Colors.white,
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
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
});
