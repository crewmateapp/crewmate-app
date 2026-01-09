// app/feedback.tsx
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeedbackCategory = 'bug' | 'feature' | 'general' | 'other';

const CATEGORIES: { value: FeedbackCategory; label: string; icon: string; color: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: 'bug', color: Colors.error },
  { value: 'feature', label: 'Feature Request', icon: 'bulb', color: Colors.accent },
  { value: 'general', label: 'General Feedback', icon: 'chatbubble', color: Colors.primary },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: Colors.text.secondary },
];

export default function FeedbackScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit feedback.');
      return;
    }

    if (!category) {
      Alert.alert('Select Category', 'Please select a feedback category.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Add Description', 'Please describe your feedback.');
      return;
    }

    setSubmitting(true);

    try {
      // Get user info
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: userData?.displayName || 'Unknown',
        userEmail: userData?.email || user.email || 'Unknown',
        userAirline: userData?.airline || 'Unknown',
        category,
        title: title.trim() || getCategoryLabel(category),
        description: description.trim(),
        status: 'new', // new, reviewed, resolved, archived
        createdAt: serverTimestamp(),
        platform: Platform.OS,
        appVersion: '1.0.2', // Update this as needed
      });

      Alert.alert(
        'Thank You! 🙏',
        'Your feedback has been submitted. We really appreciate you helping us improve CrewMate!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: FeedbackCategory) => {
    return CATEGORIES.find(c => c.value === cat)?.label || 'Feedback';
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Send Feedback</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro */}
          <View style={styles.introCard}>
            <Ionicons name="heart" size={32} color={Colors.primary} />
            <ThemedText style={styles.introTitle}>We'd Love Your Feedback!</ThemedText>
            <ThemedText style={styles.introText}>
              As an alpha tester, your input is invaluable. Help us make CrewMate better for the crew community.
            </ThemedText>
          </View>

          {/* Category Selection */}
          <ThemedText style={styles.sectionTitle}>What type of feedback?</ThemedText>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryCard,
                  category === cat.value && styles.categoryCardSelected,
                  category === cat.value && { borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={28} 
                  color={category === cat.value ? cat.color : Colors.text.secondary} 
                />
                <ThemedText 
                  style={[
                    styles.categoryLabel,
                    category === cat.value && { color: cat.color, fontWeight: '700' },
                  ]}
                >
                  {cat.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title (Optional) */}
          <ThemedText style={styles.sectionTitle}>
            Title <ThemedText style={styles.optional}>(optional)</ThemedText>
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Brief summary..."
            placeholderTextColor={Colors.text.secondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <ThemedText style={styles.sectionTitle}>Description *</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={
              category === 'bug' 
                ? "What happened? What did you expect to happen? Steps to reproduce..." 
                : category === 'feature'
                ? "Describe the feature you'd like to see..."
                : "Tell us what's on your mind..."
            }
            placeholderTextColor={Colors.text.secondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <ThemedText style={styles.charCount}>{description.length}/2000</ThemedText>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!category || !description.trim() || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!category || !description.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={Colors.white} />
                <ThemedText style={styles.submitButtonText}>Submit Feedback</ThemedText>
              </>
            )}
          </TouchableOpacity>

          {/* Bottom Spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  introCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    color: Colors.primary,
  },
  introText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  optional: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.secondary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  categoryCardSelected: {
    backgroundColor: Colors.background,
    borderWidth: 2,
  },
  categoryLabel: {
    fontSize: 14,
    marginTop: 8,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
    marginTop: -16,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
