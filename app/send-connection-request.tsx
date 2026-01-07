// app/send-connection-request.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
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

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  position: string;
  airline: string;
  base: string;
  photoURL?: string;
  bio?: string;
};

type MutualConnection = {
  id: string;
  name: string;
  photoURL?: string;
};

export default function SendConnectionRequestScreen() {
  const { userId, userName } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState('');
  const [mutualConnections, setMutualConnections] = useState<MutualConnection[]>([]);

  useEffect(() => {
    loadProfileAndMutuals();
  }, []);

  const loadProfileAndMutuals = async () => {
    if (!userId || !user) return;

    try {
      // Load target user profile
      const userDoc = await getDoc(doc(db, 'users', userId as string));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      }

      // Find mutual connections
      await findMutualConnections();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const findMutualConnections = async () => {
    if (!user || !userId) return;

    try {
      // Get my connections
      const myConnectionsQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user.uid)
      );
      const myConnectionsSnap = await getDocs(myConnectionsQuery);
      const myConnectionUserIds = new Set<string>();
      
      myConnectionsSnap.docs.forEach(doc => {
        const userIds = doc.data().userIds as string[];
        userIds.forEach(id => {
          if (id !== user.uid) myConnectionUserIds.add(id);
        });
      });

      // Get their connections
      const theirConnectionsQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', userId as string)
      );
      const theirConnectionsSnap = await getDocs(theirConnectionsQuery);
      const theirConnectionUserIds = new Set<string>();
      
      theirConnectionsSnap.docs.forEach(doc => {
        const userIds = doc.data().userIds as string[];
        userIds.forEach(id => {
          if (id !== userId) theirConnectionUserIds.add(id);
        });
      });

      // Find mutual connections
      const mutualIds = Array.from(myConnectionUserIds).filter(id => 
        theirConnectionUserIds.has(id)
      );

      // Fetch mutual connection profiles
      const mutuals: MutualConnection[] = [];
      for (const mutualId of mutualIds.slice(0, 3)) { // Show max 3
        const mutualDoc = await getDoc(doc(db, 'users', mutualId));
        if (mutualDoc.exists()) {
          const data = mutualDoc.data();
          mutuals.push({
            id: mutualId,
            name: data.displayName || 'Crew Member',
            photoURL: data.photoURL,
          });
        }
      }

      setMutualConnections(mutuals);
    } catch (error) {
      console.error('Error finding mutual connections:', error);
    }
  };

  const handleSendRequest = async () => {
    if (!user || !userId || !profile) return;

    setSending(true);
    try {
      // Get current user's profile for name
      const myProfileDoc = await getDoc(doc(db, 'users', user.uid));
      const myProfile = myProfileDoc.data();
      
      if (!myProfile) {
        Alert.alert('Error', 'Could not load your profile. Please try again.');
        setSending(false);
        return;
      }

      // Create connection request with user names
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        fromUserName: myProfile.displayName || 'Crew Member',
        toUserId: userId,
        toUserName: profile.displayName || 'Crew Member',
        message: message.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Request Sent! ✈️',
        `Your connection request has been sent to ${userName || profile?.displayName}.`,
        [{ text: 'OK', onPress: () => router.back() }]
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
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Send Request</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Send Request</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Unable to load user profile</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Send Request</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.avatarText}>
                  {profile.firstName?.[0]}{profile.lastInitial}
                </ThemedText>
              </View>
            )}

            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{profile.displayName}</ThemedText>
              <ThemedText style={[styles.profilePosition, { color: colors.text.secondary }]}>
                {profile.position} • {profile.airline}
              </ThemedText>
              <ThemedText style={[styles.profileBase, { color: colors.text.secondary }]}>
                📍 {profile.base}
              </ThemedText>
            </View>
          </View>

          {/* Mutual Connections */}
          {mutualConnections.length > 0 && (
            <View style={[styles.mutualsCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <View style={styles.mutualsHeader}>
                <Ionicons name="people" size={20} color={colors.primary} />
                <ThemedText style={[styles.mutualsTitle, { color: colors.primary }]}>
                  {mutualConnections.length} Mutual Connection{mutualConnections.length !== 1 ? 's' : ''}
                </ThemedText>
              </View>
              <View style={styles.mutualsAvatars}>
                {mutualConnections.map((mutual, index) => (
                  <View key={mutual.id} style={[styles.mutualAvatarContainer, { marginLeft: index > 0 ? -12 : 0 }]}>
                    {mutual.photoURL ? (
                      <Image source={{ uri: mutual.photoURL }} style={styles.mutualAvatar} />
                    ) : (
                      <View style={[styles.mutualAvatarFallback, { backgroundColor: colors.accent }]}>
                        <ThemedText style={styles.mutualAvatarText}>
                          {mutual.name[0]}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <ThemedText style={[styles.mutualsNames, { color: colors.primary }]}>
                {mutualConnections.map(m => m.name).join(', ')}
              </ThemedText>
            </View>
          )}

          {/* Message Section */}
          <View style={styles.messageSection}>
            <ThemedText style={styles.messageLabel}>
              Add a message (optional)
            </ThemedText>
            <ThemedText style={[styles.messageHint, { color: colors.text.secondary }]}>
              Introduce yourself and let them know why you'd like to connect!
            </ThemedText>
            
            <View style={[styles.messageInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.messageInput, { color: colors.text.primary }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Hey! I noticed we're both on layover in..."
                placeholderTextColor={colors.text.secondary}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
            </View>
            <ThemedText style={[styles.charCount, { color: colors.text.secondary }]}>
              {message.length}/300
            </ThemedText>
          </View>

          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
            <Ionicons name="information-circle" size={20} color={colors.accent} />
            <ThemedText style={[styles.infoText, { color: colors.accent }]}>
              They'll see your profile and can accept or decline your request.
            </ThemedText>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Send Button */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={handleSendRequest}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <ThemedText style={styles.sendButtonText}>Send Connection Request</ThemedText>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profilePosition: {
    fontSize: 14,
    marginBottom: 4,
  },
  profileBase: {
    fontSize: 14,
  },
  mutualsCard: {
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  mutualsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  mutualsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  mutualsAvatars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  mutualAvatarContainer: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  mutualAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  mutualAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutualAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mutualsNames: {
    fontSize: 13,
    fontWeight: '500',
  },
  messageSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  messageHint: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  messageInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  messageInput: {
    fontSize: 16,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
  },
});
