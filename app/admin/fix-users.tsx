import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function FixUsersScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFixOrphanedUsers = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in');
      return;
    }

    try {
      setLoading(true);
      const fixOrphanedUsers = httpsCallable(functions, 'fixOrphanedUsers');
      const response = await fixOrphanedUsers();
      
      setResult(response.data);
      Alert.alert(
        'Success!',
        `Fixed ${(response.data as any).fixed} orphaned users out of ${(response.data as any).processed} total users.`
      );
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error.message || 'Failed to fix orphaned users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          🔧 Admin Tools
        </ThemedText>

        <ThemedText style={styles.description}>
          This will create Firestore documents for any users who are in Firebase Authentication but missing from the users collection.
        </ThemedText>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleFixOrphanedUsers}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>
              Fix Orphaned Users
            </ThemedText>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultBox}>
            <ThemedText style={styles.resultTitle}>✅ Results:</ThemedText>
            <ThemedText style={styles.resultText}>
              • Processed: {result.processed} users
            </ThemedText>
            <ThemedText style={styles.resultText}>
              • Fixed: {result.fixed} orphaned users
            </ThemedText>
            <ThemedText style={styles.resultText}>
              • Already existed: {result.alreadyExisted} users
            </ThemedText>
            
            {result.fixedUsers && result.fixedUsers.length > 0 && (
              <>
                <ThemedText style={styles.resultTitle}>Fixed Users:</ThemedText>
                {result.fixedUsers.map((user: any, index: number) => (
                  <ThemedText key={index} style={styles.userText}>
                    • {user.email}
                  </ThemedText>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    marginBottom: 30,
    textAlign: 'center',
    opacity: 0.7,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    marginBottom: 8,
  },
  userText: {
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 4,
  },
});
