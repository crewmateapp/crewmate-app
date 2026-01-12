// app/connect/[userId].tsx
// Deep link handler: crewmateapp://connect/{userId}
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { notifyConnectionRequest } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  position: string;
  base: string;
  bio?: string;
  photoURL?: string;
};

export default function ConnectDeepLinkScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, [userId, user]);

  const loadUserProfile = async () => {
    if (!userId || !user) {
      Alert.alert('Error', 'Invalid connection link');
      router.back();
      return;
    }

    // Check if trying to connect with yourself
    if (userId === user.uid) {
      Alert.alert(
        'Oops!',
        "You can't connect with yourself! 😄",
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
      return;
    }

    try {
      // Get target user's profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        Alert.alert(
          'User Not Found',
          'This user may have deleted their account or the link is invalid.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      const profile = userDoc.data() as UserProfile;
      setTargetProfile(profile);

      // Check if already connected
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user.uid)
      );
      const connectionsSnapshot = await getDocs(connectionsQuery);
      const isConnected = connectionsSnapshot.docs.some(doc => 
        doc.data().userIds.includes(userId)
      );

      if (isConnected) {
        Alert.alert(
          'Already Connected!',
          `You're already connected with ${profile.displayName}. Check your Connections tab to chat!`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/connections') }]
        );
        return;
      }

      // Check if request already sent
      const requestsQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', userId),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);

      if (!requestsSnapshot.empty) {
        Alert.alert(
          'Request Already Sent',
          `You already sent a connection request to ${profile.displayName}. They'll see it in their Connections tab!`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/connections') }]
        );
        return;
      }

      // Check if they sent you a request (reverse)
      const reverseRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', userId),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const reverseRequestSnapshot = await getDocs(reverseRequestQuery);

      if (!reverseRequestSnapshot.empty) {
        Alert.alert(
          'They Already Sent You a Request!',
          `${profile.displayName} already sent you a connection request. Check your Connections tab to accept it!`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/connections') }]
        );
        return;
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(
        'Error',
        'Failed to load user profile. Please try again.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const sendConnectionRequest = async () => {
    if (!targetProfile || !user || !userId) return;

    setSending(true);
    try {
      // Get current user's profile
      const myProfileDoc = await getDoc(doc(db, 'users', user.uid));
      const myProfile = myProfileDoc.data();
      
      if (!myProfile) {
        Alert.alert('Error', 'Could not load your profile. Please try again.');
        setSending(false);
        return;
      }

      // Send connection request
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        fromUserName: myProfile.displayName || 'Crew Member',
        toUserId: userId,
        toUserName: targetProfile.displayName || 'Crew Member',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Send notification
      await notifyConnectionRequest(
        userId,
        user.uid,
        myProfile.displayName || 'Crew Member',
        myProfile.photoURL
      );

      Alert.alert(
        'Request Sent! ✈️',
        `Connection request sent to ${targetProfile.displayName}. They'll see it in their Connections tab!`,
        [
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)/connections')
          }
        ]
      );
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
        <ThemedText style={styles.loadingText}>Loading connection...</ThemedText>
      </ThemedView>
    );
  }

  if (!targetProfile) {
    return null; // Handled by alerts
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Ionicons name="link" size={48} color={Colors.primary} style={styles.icon} />
        
        <ThemedText style={styles.title}>Connect with Crew</ThemedText>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {targetProfile.photoURL ? (
            <Image source={{ uri: targetProfile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <ThemedText style={styles.avatarText}>
                {targetProfile.displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          
          <ThemedText style={styles.name}>{targetProfile.displayName}</ThemedText>
          <ThemedText style={styles.details}>
            {targetProfile.position} • {targetProfile.airline}
          </ThemedText>
          <ThemedText style={styles.base}>Based in {targetProfile.base}</ThemedText>
          
          {targetProfile.bio && (
            <ThemedText style={styles.bio}>"{targetProfile.bio}"</ThemedText>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.connectButton, sending && styles.connectButtonDisabled]}
          onPress={sendConnectionRequest}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="person-add" size={20} color={Colors.white} />
              <ThemedText style={styles.connectButtonText}>
                Send Connection Request
              </ThemedText>
            </>
          )}
        </TouchableOpacity>

        <ThemedText style={styles.helpText}>
          They'll see your connection request in their Connections tab
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  profileCard: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  details: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  base: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  helpText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
