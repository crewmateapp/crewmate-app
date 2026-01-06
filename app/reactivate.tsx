// app/reactivate.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ReactivateScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const [reactivating, setReactivating] = useState(false);

  const handleReactivate = async () => {
    if (!user) return;

    setReactivating(true);
    try {
      // Update user document to reactivate
      await updateDoc(doc(db, 'users', user.uid), {
        deactivated: false,
        reactivatedAt: new Date(),
        discoverable: true, // Make them visible again
      });

      Alert.alert(
        'Welcome Back!',
        'Your account has been reactivated. You\'re back on the crew!',
        [
          {
            text: 'Let\'s Go',
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } catch (error) {
      console.error('Reactivation error:', error);
      Alert.alert('Error', 'Could not reactivate your account. Please try again.');
    } finally {
      setReactivating(false);
    }
  };

  const handleStayDeactivated = () => {
    Alert.alert(
      'Sign Out?',
      'Your account will remain deactivated. You can reactivate anytime by signing in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/signin');
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="airplane" size={64} color={colors.primary} />
        </View>

        {/* Title */}
        <ThemedText style={styles.title}>Welcome Back, Crew!</ThemedText>

        {/* Message */}
        <ThemedText style={[styles.message, { color: colors.text.secondary }]}>
          Your account was deactivated. Would you like to reactivate it and get back to connecting with crew during layovers?
        </ThemedText>

        {/* What Happens List */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.infoTitle}>When you reactivate:</ThemedText>
          
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText style={styles.infoText}>Your profile becomes visible again</ThemedText>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText style={styles.infoText}>You can be discovered during layovers</ThemedText>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText style={styles.infoText}>All your data and connections are restored</ThemedText>
          </View>
        </View>

        {/* Reactivate Button */}
        <TouchableOpacity
          style={[styles.reactivateButton, { backgroundColor: colors.primary }]}
          onPress={handleReactivate}
          disabled={reactivating}
        >
          {reactivating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
              <ThemedText style={styles.reactivateButtonText}>Reactivate My Account</ThemedText>
            </>
          )}
        </TouchableOpacity>

        {/* Stay Deactivated Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleStayDeactivated}
          disabled={reactivating}
        >
          <ThemedText style={[styles.cancelButtonText, { color: colors.text.secondary }]}>
            Keep Account Deactivated
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 100,
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  infoCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  reactivateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
