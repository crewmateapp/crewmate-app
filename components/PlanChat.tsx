// components/PlanChat.tsx
import { ThemedText } from '@/components/themed-text';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  message: string | null;
  photoURL: string | null;
  createdAt: any;
};

interface PlanChatProps {
  planId: string;
  planTitle: string;
}

export function PlanChat({ planId, planTitle }: PlanChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch messages in real-time
  useEffect(() => {
    if (!planId) return;

    const messagesRef = collection(db, 'plans', planId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({
          id: doc.id,
          ...doc.data(),
        } as ChatMessage);
      });
      setMessages(msgs);
      setLoading(false);

      // Auto-scroll to bottom when new messages arrive
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [planId]);

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    setSending(true);

    try {
      await addDoc(collection(db, 'plans', planId, 'messages'), {
        userId: user.uid,
        userName: user.displayName || 'Crew Member',
        userPhoto: user.photoURL || null,
        message: messageText,
        photoURL: null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handlePickPhoto = async () => {
    if (!user) return;

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
  };

  const uploadPhoto = async (uri: string) => {
    if (!user) return;

    setUploadingPhoto(true);

    try {
      // Upload to Firebase Storage
      const response = await fetch(uri);
      const blob = await response.blob();
      const photoRef = ref(storage, `plans/${planId}/chat/${Date.now()}.jpg`);
      await uploadBytes(photoRef, blob);
      const downloadURL = await getDownloadURL(photoRef);

      // Add photo message to chat
      await addDoc(collection(db, 'plans', planId, 'messages'), {
        userId: user.uid,
        userName: user.displayName || 'Crew Member',
        userPhoto: user.photoURL || null,
        message: null,
        photoURL: downloadURL,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Photo shared!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="chatbubbles" size={20} color={Colors.text.primary} />
        <ThemedText style={styles.headerTitle}>Plan Chat</ThemedText>
        <ThemedText style={styles.messageCount}>
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </ThemedText>
      </View>

      {/* Messages ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyText}>No messages yet</ThemedText>
            <ThemedText style={styles.emptyHint}>Start the conversation!</ThemedText>
          </View>
        ) : (
          messages.map((item) => {
            const isCurrentUser = item.userId === user?.uid;

            return (
              <View 
                key={item.id}
                style={[styles.messageContainer, isCurrentUser && styles.messageContainerRight]}
              >
                {!isCurrentUser && (
                  <View style={styles.avatarContainer}>
                    {item.userPhoto ? (
                      <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <ThemedText style={styles.avatarText}>
                          {item.userName.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.messageBubble, isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
                  {!isCurrentUser && (
                    <ThemedText style={styles.userName}>{item.userName}</ThemedText>
                  )}

                  {item.photoURL && (
                    <Image source={{ uri: item.photoURL }} style={styles.messagePhoto} />
                  )}

                  {item.message && (
                    <ThemedText style={[styles.messageText, isCurrentUser && styles.messageTextRight]}>
                      {item.message}
                    </ThemedText>
                  )}

                  <ThemedText style={[styles.messageTime, isCurrentUser && styles.messageTimeRight]}>
                    {formatTime(item.createdAt)}
                  </ThemedText>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.photoButton}
          onPress={handlePickPhoto}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="image" size={24} color={Colors.primary} />
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={Colors.text.disabled}
          multiline
          maxLength={500}
        />

        <TouchableOpacity 
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="send" size={20} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  messageCount: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageContainerRight: {
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleLeft: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  messagePhoto: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  messageTextRight: {
    color: Colors.white,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  messageTimeRight: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
