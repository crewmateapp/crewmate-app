import { StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../../config/firebase';

export default function Index() {
  console.log('Firebase Auth initialized:', !!auth);
  console.log('Firestore DB initialized:', !!db);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>✈️ CrewMate</Text>
      <Text style={styles.status}>Firebase Connected!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    color: '#4CAF50',
  }
});