import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';
import { auth, db } from '../../config/firebase';

export default function MyLayoverScreen() {
  console.log('Firebase Auth initialized:', !!auth);
  console.log('Firestore DB initialized:', !!db);
  
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>🗺️ My Layover</ThemedText>
      <ThemedText style={styles.subtitle}>Set your location to see nearby crew and spots</ThemedText>
      <ThemedText style={styles.status}>✅ Firebase Connected!</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  status: {
    fontSize: 14,
    color: '#4CAF50',
  },
});