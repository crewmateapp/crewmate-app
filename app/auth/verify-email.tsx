import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export default function VerifyEmailScreen() {
  const { user, sendVerificationEmail, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // Check if email is already verified
    if (user?.emailVerified) {
      router.replace('/auth/create-profile');
    }
  }, [user]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      Alert.alert('Email Sent', 'Verification email sent! Check your inbox.');
      setCooldown(60); // 60 second cooldown
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      await user?.reload();
      if (user?.emailVerified) {
        router.replace('/auth/create-profile');
      } else {
        Alert.alert('Not Verified Yet', 'Please check your email and click the verification link.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check verification status');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/signin');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        📧 Verify Your Email
      </ThemedText>
      
      <View style={styles.content}>
        <ThemedText style={styles.message}>
          We sent a verification link to:
        </ThemedText>
        <ThemedText style={styles.email}>
          {user?.email}
        </ThemedText>
        <ThemedText style={styles.instruction}>
          Please check your inbox and click the verification link to continue.
        </ThemedText>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCheckVerification}
        >
          <ThemedText style={styles.buttonText}>
            I've Verified My Email
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, (loading || cooldown > 0) && styles.buttonDisabled]}
          onPress={handleResendEmail}
          disabled={loading || cooldown > 0}
        >
          <ThemedText style={styles.secondaryButtonText}>
            {cooldown > 0 
              ? `Resend Email (${cooldown}s)` 
              : loading 
                ? 'Sending...' 
                : 'Resend Verification Email'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleSignOut}
        >
          <ThemedText style={styles.link}>
            Wrong email? Sign out and try again
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <ThemedText style={styles.noticeText}>
          💡 Tip: Check your spam folder if you don't see the email within a few minutes.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  content: {
    gap: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#2196F3',
  },
  instruction: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
  },
  link: {
    color: '#2196F3',
    textAlign: 'center',
    fontSize: 14,
  },
  notice: {
    marginTop: 40,
    padding: 15,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
});