import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { mockCrew, type CrewMember } from '@/data/mockCrew';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const { user } = useAuth();
  
  // Find the user from mock data
  // Later this will be a Firestore query
  const crew = mockCrew.find(c => c.id === userId) as CrewMember | undefined;

  const handleConnectPress = async () => {
    if (!crew || !user) return;

    Alert.alert(
      `Connect with ${crew.displayName}?`,
      `Send a connection request to ${crew.firstName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Request', 
          onPress: async () => {
            try {
              await addDoc(collection(db, 'connectionRequests'), {
                fromUserId: user.uid,
                fromUserName: user.email?.split('@')[0] || 'Unknown',
                toUserId: crew.id,
                toUserName: crew.displayName,
                status: 'pending',
                createdAt: serverTimestamp(),
              });
              
              Alert.alert(
                'Request Sent! ✈️', 
                `${crew.firstName} will be notified.`,
                [
                  {
                    text: 'OK',
                    onPress: () => router.back()
                  }
                ]
              );
            } catch (error) {
              console.error('Error sending request:', error);
              Alert.alert('Error', 'Failed to send request. Try again.');
            }
          }
        }
      ]
    );
  };

  if (!crew) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <ThemedText style={styles.errorText}>User not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <ThemedView style={styles.container}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {crew.photoURL ? (
            <Image source={{ uri: crew.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>
                {crew.firstName[0]}{crew.lastInitial}
              </ThemedText>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.infoSection}>
          <ThemedText type="title" style={styles.name}>
            {crew.displayName}
          </ThemedText>
          
          <ThemedText style={styles.airline}>{crew.airline}</ThemedText>
          <ThemedText style={styles.base}>📍 Based in {crew.base}</ThemedText>

          {crew.bio && (
            <View style={styles.bioContainer}>
              <ThemedText style={styles.bio}>"{crew.bio}"</ThemedText>
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={handleConnectPress}
        >
          <ThemedText style={styles.connectButtonText}>👋 Connect</ThemedText>
        </TouchableOpacity>
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
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  airline: {
    fontSize: 18,
    color: '#2196F3',
    marginBottom: 5,
  },
  base: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  bioContainer: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    width: '100%',
  },
  bio: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 40,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
    opacity: 0.5,
  },
});