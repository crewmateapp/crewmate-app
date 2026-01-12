// app/chat/[id].tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { notifyNewMessage } from '@/utils/notifications';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
  read: boolean;
};

type OtherUser = {
  id: string;
  displayName: string;
  photoURL?: string;
};

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Load other user info
  useEffect(() => {
    if (!id || !user) return;

    const loadOtherUser = async () => {
      try {
        // Get connection to find other user ID
        const connectionDoc = await getDoc(doc(db, 'connections', id));
        if (connectionDoc.exists()) {
          const data = connectionDoc.data();
          const otherUserId = data.userIds.find((uid: string) => uid !== user.uid);
          
          if (otherUserId) {
            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
            if (otherUserDoc.exists()) {
              const userData = otherUserDoc.data();
              setOtherUser({
                id: otherUserId,
                displayName: userData.displayName || name || 'Unknown',
                photoURL: userData.photoURL,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading other user:', error);
      }
    };

    loadOtherUser();
  }, [id, user, name]);

  // Load messages from Firestore in real-time
  useEffect(() => {
    if (!id || !user) return;

    const messagesRef = collection(db, 'messages', id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMessages: Message[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName,
            createdAt: data.createdAt?.toDate() || new Date(),
            read: data.read || false,
          };
        });
        setMessages(loadedMessages);
        setLoading(false);
        
        // Mark connection as read for current user
        markConnectionAsRead();
      },
      (error) => {
        console.error('Error loading messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, user]);

  const markConnectionAsRead = async () => {
    if (!id || !user) return;
    
    try {
      // Update in connections collection
      const connectionRef = doc(db, 'connections', id);
      await updateDoc(connectionRef, {
        [`unreadCount.${user.uid}`]: 0,
      });

      // Also update in conversations collection for compatibility
      const conversationRef = doc(db, 'conversations', id);
      const conversationSnap = await getDoc(conversationRef);
      if (conversationSnap.exists()) {
        await updateDoc(conversationRef, {
          [`unreadCount.${user.uid}`]: 0,
        });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !id || !user) return;

    setSending(true);
    try {
      // Get user's display name
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const senderName = userData?.displayName || user.email?.split('@')[0] || 'Unknown';

      const messagesRef = collection(db, 'messages', id, 'messages');
      
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: senderName,
        createdAt: serverTimestamp(),
        read: false,
      });

      // Update connection with last message
      const connectionRef = doc(db, 'connections', id);
      const connectionSnap = await getDoc(connectionRef);
      
      let otherUserId: string | undefined;
      if (connectionSnap.exists()) {
        const data = connectionSnap.data();
        otherUserId = data.userIds.find((uid: string) => uid !== user.uid);
        
        await updateDoc(connectionRef, {
          lastMessage: newMessage.trim(),
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: (data.unreadCount?.[otherUserId] || 0) + 1,
        });
      }

        // Send notification to the other user
        if (otherUserId) {
          const messagePreview = newMessage.trim().length > 50
            ? newMessage.trim().substring(0, 50) + '...'
            : newMessage.trim();
          
          await notifyNewMessage(
            otherUserId,
            user.uid,
            senderName,
            messagePreview,
            id
          );
        }

      // Also update conversations collection for compatibility
      const conversationRef = doc(db, 'conversations', id);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const data = conversationSnap.data();
        const otherUserId = data.participantIds.find((uid: string) => uid !== user.uid);
        
        await updateDoc(conversationRef, {
          lastMessage: newMessage.trim(),
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: (data.unreadCount?.[otherUserId] || 0) + 1,
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessages = () => {
    if (selectedMessages.length === 0) return;

    Alert.alert(
      'Delete Messages',
      `Delete ${selectedMessages.length} message${selectedMessages.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const messageId of selectedMessages) {
                await deleteDoc(doc(db, 'messages', id!, 'messages', messageId));
              }
              setSelectedMessages([]);
              setSelectionMode(false);
            } catch (error) {
              console.error('Error deleting messages:', error);
              Alert.alert('Error', 'Failed to delete messages.');
            }
          },
        },
      ]
    );
  };

  const toggleMessageSelection = (messageId: string) => {
    if (selectedMessages.includes(messageId)) {
      setSelectedMessages(prev => prev.filter(id => id !== messageId));
    } else {
      setSelectedMessages(prev => [...prev, messageId]);
    }
  };

  const handleLongPress = (messageId: string, senderId: string) => {
    // Only allow deleting own messages
    if (senderId !== user?.uid) return;
    
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedMessages([messageId]);
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  const handleProfilePress = () => {
    if (otherUser?.id) {
      router.push({
        pathname: '/profile/[userId]',
        params: { userId: otherUser.id },
      });
    }
  };

  const handleMoreOptions = () => {
    Alert.alert(
      'Options',
      '',
      [
        {
          text: 'Delete Conversation',
          style: 'destructive',
          onPress: handleDeleteConversation,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this entire conversation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all messages in the conversation
              const messagesRef = collection(db, 'messages', id!, 'messages');
              const messagesSnapshot = await getDocs(messagesRef);
              
              for (const msgDoc of messagesSnapshot.docs) {
                await deleteDoc(doc(db, 'messages', id!, 'messages', msgDoc.id));
              }

              // Clear last message in connection
              const connectionRef = doc(db, 'connections', id!);
              await updateDoc(connectionRef, {
                lastMessage: '',
                lastMessageTime: null,
              });

              // Also clear in conversations collection if it exists
              const conversationRef = doc(db, 'conversations', id!);
              const conversationSnap = await getDoc(conversationRef);
              if (conversationSnap.exists()) {
                await updateDoc(conversationRef, {
                  lastMessage: '',
                  lastMessageTime: null,
                });
              }

              Alert.alert('Deleted', 'Conversation has been deleted.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerName}>{name}</ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          {selectionMode ? (
            // Selection mode header
            <>
              <TouchableOpacity onPress={cancelSelection} style={styles.backButton}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <ThemedText style={styles.headerName}>
                {selectedMessages.length} selected
              </ThemedText>
              <TouchableOpacity onPress={handleDeleteMessages} style={styles.deleteButton}>
                <Ionicons name="trash" size={24} color={Colors.error} />
              </TouchableOpacity>
            </>
          ) : (
            // Normal header
            <>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
              
              {/* Clickable profile section */}
              <TouchableOpacity 
                style={styles.headerProfile}
                onPress={handleProfilePress}
                activeOpacity={0.7}
              >
                {otherUser?.photoURL ? (
                  <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />
                ) : (
                  <View style={styles.headerAvatarFallback}>
                    <ThemedText style={styles.headerAvatarText}>
                      {(otherUser?.displayName || name || '?').charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.headerInfo}>
                  <ThemedText style={styles.headerName}>{otherUser?.displayName || name}</ThemedText>
                  <ThemedText style={styles.headerHint}>Tap to view profile</ThemedText>
                </View>
              </TouchableOpacity>

              {/* More options button */}
              <TouchableOpacity onPress={handleMoreOptions} style={styles.moreButton}>
                <Ionicons name="ellipsis-vertical" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyText}>
              No messages yet. Say hi! 👋
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            inverted={false}
            renderItem={({ item }) => {
              const isMyMessage = item.senderId === user?.uid;
              const isSelected = selectedMessages.includes(item.id);
              
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => handleLongPress(item.id, item.senderId)}
                  onPress={() => {
                    if (selectionMode && isMyMessage) {
                      toggleMessageSelection(item.id);
                    }
                  }}
                  style={[
                    styles.messageRow,
                    isMyMessage ? styles.myMessageRow : styles.theirMessageRow,
                  ]}
                >
                  {/* Other user's avatar for their messages */}
                  {!isMyMessage && (
                    <TouchableOpacity onPress={handleProfilePress}>
                      {otherUser?.photoURL ? (
                        <Image source={{ uri: otherUser.photoURL }} style={styles.messageAvatar} />
                      ) : (
                        <View style={styles.messageAvatarFallback}>
                          <ThemedText style={styles.messageAvatarText}>
                            {(otherUser?.displayName || '?').charAt(0).toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isMyMessage ? styles.myMessage : styles.theirMessage,
                      isSelected && styles.messageSelected,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.messageText,
                        isMyMessage ? styles.myMessageText : styles.theirMessageText,
                      ]}
                    >
                      {item.text}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.timestamp,
                        isMyMessage ? styles.myTimestamp : styles.theirTimestamp,
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </ThemedText>
                  </View>

                  {/* Selection checkbox */}
                  {selectionMode && isMyMessage && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Colors.text.secondary}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={Colors.white} />
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 5,
  },
  moreButton: {
    padding: 5,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerHint: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
  },
  myMessage: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageSelected: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: Colors.white,
  },
  theirMessageText: {
    color: Colors.text.primary,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  theirTimestamp: {
    color: Colors.text.secondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
