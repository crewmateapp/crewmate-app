import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: Date;
};

// Mock initial messages
const getMockMessages = (connectionName: string): Message[] => [
  {
    id: '1',
    text: `Hey! Nice to connect with you!`,
    fromMe: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: '2',
    text: `Same here! Are you on a layover in the city?`,
    fromMe: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  },
  {
    id: '3',
    text: `Yes! Just got in. Know any good coffee spots nearby?`,
    fromMe: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
  },
];

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [messages, setMessages] = useState<Message[]>(getMockMessages(name || ''));
  const [newMessage, setNewMessage] = useState('');

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      fromMe: true,
      timestamp: new Date(),
    };

    setMessages([...messages, message]);
    setNewMessage('');

    // Mock reply after 1 second
    setTimeout(() => {
      const replies = [
        "That sounds great!",
        "Awesome, let me know!",
        "I'll check it out 👍",
        "See you there!",
        "Thanks for the tip!",
      ];
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        text: replies[Math.floor(Math.random() * replies.length)],
        fromMe: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, reply]);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backText}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.headerName}>{name}</ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.fromMe ? styles.myMessage : styles.theirMessage,
            ]}
          >
            <ThemedText
              style={[
                styles.messageText,
                item.fromMe ? styles.myMessageText : styles.theirMessageText,
              ]}
            >
              {item.text}
            </ThemedText>
            <ThemedText
              style={[
                styles.timestamp,
                item.fromMe ? styles.myTimestamp : styles.theirTimestamp,
              ]}
            >
              {formatTime(item.timestamp)}
            </ThemedText>
          </View>
        )}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <ThemedText style={styles.sendButtonText}>Send</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  backText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 60,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 20,
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 5,
  },
  myTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  theirTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});