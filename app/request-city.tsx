// app/request-city.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RequestCityScreen() {
  const { user } = useAuth();
  const [airportCode, setAirportCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitRequest = async () => {
    if (!airportCode.trim()) {
      Alert.alert('Error', 'Please enter an airport code');
      return;
    }

    if (!user) return;

    setSubmitting(true);
    try {
      // Get user profile for name/email
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (!userData) {
        Alert.alert('Error', 'Could not load your profile');
        setSubmitting(false);
        return;
      }

      // Submit city request
      await addDoc(collection(db, 'cityRequests'), {
        airportCode: airportCode.toUpperCase().trim(),
        requestedBy: user.uid,
        requestedByName: userData.displayName || 'Crew Member',
        requestedByEmail: user.email || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Request Submitted! ✈️',
        `Thank you! We'll add ${airportCode.toUpperCase()} soon. You'll be notified when it's available.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting city request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Request a City</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={48} color={Colors.primary} />
            <ThemedText style={styles.infoTitle}>City Not Listed?</ThemedText>
            <ThemedText style={styles.infoText}>
              Can't find your layover city? Request it here! Just enter the airport code and
              we'll add it to CrewMate.
            </ThemedText>
          </View>

          {/* Input Form */}
          <View style={styles.form}>
            <ThemedText style={styles.label}>Airport Code</ThemedText>
            <ThemedText style={styles.hint}>
              Enter the 3-4 letter airport code (e.g., DEN, LHR, HNL)
            </ThemedText>

            <TextInput
              style={styles.input}
              value={airportCode}
              onChangeText={setAirportCode}
              placeholder="e.g., CLT"
              placeholderTextColor={Colors.text.secondary}
              autoCapitalize="characters"
              maxLength={4}
              editable={!submitting}
            />

            {/* Examples */}
            <View style={styles.examplesCard}>
              <ThemedText style={styles.examplesTitle}>Common Examples:</ThemedText>
              <View style={styles.examplesList}>
                <View style={styles.exampleItem}>
                  <ThemedText style={styles.exampleCode}>CLT</ThemedText>
                  <ThemedText style={styles.exampleCity}>Charlotte</ThemedText>
                </View>
                <View style={styles.exampleItem}>
                  <ThemedText style={styles.exampleCode}>DEN</ThemedText>
                  <ThemedText style={styles.exampleCity}>Denver</ThemedText>
                </View>
                <View style={styles.exampleItem}>
                  <ThemedText style={styles.exampleCode}>LAX</ThemedText>
                  <ThemedText style={styles.exampleCity}>Los Angeles</ThemedText>
                </View>
                <View style={styles.exampleItem}>
                  <ThemedText style={styles.exampleCode}>LHR</ThemedText>
                  <ThemedText style={styles.exampleCity}>London Heathrow</ThemedText>
                </View>
              </View>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
              <Ionicons name="bulb" size={20} color={Colors.accent} />
              <View style={styles.tipsContent}>
                <ThemedText style={styles.tipsTitle}>Tips:</ThemedText>
                <ThemedText style={styles.tipsText}>
                  • Use the official IATA or ICAO airport code{'\n'}
                  • We'll verify and add the city within 24 hours{'\n'}
                  • You'll get a notification when it's live
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitRequest}
            disabled={submitting || !airportCode.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={Colors.white} />
                <ThemedText style={styles.submitButtonText}>Submit Request</ThemedText>
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
    borderBottomColor: Colors.border,
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
    paddingHorizontal: 20,
  },
  infoCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 24,
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginTop: 32,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  examplesCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  examplesList: {
    gap: 8,
  },
  exampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exampleCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    textAlign: 'center',
  },
  exampleCity: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tipsCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.accent + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
});
