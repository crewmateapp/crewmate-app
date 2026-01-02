import { ThemedText } from '@/components/themed-text';
import { type CrewMember } from '@/data/mockCrew';
import { router } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

type CrewCardProps = {
  crew: CrewMember;
  onPress: () => void;
};

export function CrewCard({ crew, onPress }: CrewCardProps) {
  const handleCardPress = () => {
    // Navigate to user profile
    router.push(`/profile/${crew.id}`);
  };

  const handleConnectPress = (e: any) => {
    // Stop event from bubbling to card press
    e?.stopPropagation?.();
    // Call the onPress for connect action
    onPress();
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handleCardPress}>
      <View style={styles.row}>
        {crew.photoURL ? (
          <Image source={{ uri: crew.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <ThemedText style={styles.avatarText}>
              {crew.firstName[0]}{crew.lastInitial}
            </ThemedText>
          </View>
        )}
        
        <View style={styles.info}>
          <ThemedText style={styles.name}>{crew.displayName}</ThemedText>
          <ThemedText style={styles.airline}>{crew.airline}</ThemedText>
          <ThemedText style={styles.base}>📍 Based in {crew.base}</ThemedText>
        </View>
      </View>
      
      {crew.bio ? (
        <ThemedText style={styles.bio} numberOfLines={2}>
          "{crew.bio}"
        </ThemedText>
      ) : null}

      <TouchableOpacity 
        style={styles.connectButton} 
        onPress={handleConnectPress}
      >
        <ThemedText style={styles.connectButtonText}>👋 Connect</ThemedText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    color: '#000',
  },
  airline: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 2,
  },
  base: {
    fontSize: 12,
    opacity: 0.6,
    color: '#666',
  },
  bio: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});