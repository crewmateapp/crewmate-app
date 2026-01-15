import Logo from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signOut, sendVerificationEmail } = useAuth();

  // Forgot password state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Email verification state
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setShowResendVerification(false);
    
    try {
      await signIn(email, password);
      
      // Check if email is verified
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        // Sign them back out since email isn't verified
        await signOut();
        setShowResendVerification(true);
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before signing in. Check your inbox for the verification link.',
          [
            { text: 'OK' }
          ]
        );
        return;
      }
      
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Sign in error:', error.code, error.message);
      
      let message = 'Failed to sign in';
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          message = 'Invalid email address';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed attempts. Please try again later or reset your password.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Email/password sign in is not enabled';
          break;
        case 'auth/internal-error':
          message = 'An internal error occurred. Please try again.';
          break;
        default:
          message = error.message || 'Failed to sign in. Please try again.';
      }
      Alert.alert('Sign In Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password first');
      return;
    }

    setResendingVerification(true);
    
    try {
      // Sign in temporarily to get the user object
      await signIn(email, password);
      
      // Send verification email
      await sendVerificationEmail();
      
      // Sign them back out
      await signOut();
      
      Alert.alert(
        'Verification Email Sent!',
        `A new verification link has been sent to ${email}.\n\n⚠️ If you don't see it:\n• Check your spam/junk folder\n• Airline emails may take longer to arrive\n• Some airline email servers may block automated emails`,
        [{ text: 'OK' }]
      );
      
      setShowResendVerification(false);
    } catch (error: any) {
      console.error('Resend verification error:', error);
      
      let message = 'Failed to resend verification email';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      
      Alert.alert('Error', message);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email); // Pre-fill with current email if entered
    setResetSent(false);
    setForgotModalVisible(true);
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    if (!resetEmail.includes('@') || !resetEmail.includes('.')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetSent(true);
    } catch (error: any) {
      let message = 'Failed to send reset email';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email address';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      Alert.alert('Error', message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseModal = () => {
    setForgotModalVisible(false);
    setResetEmail('');
    setResetSent(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          {/* Logo Header */}
          <View style={styles.header}>
            <Logo size="large" variant="full" />
            <ThemedText style={styles.subtitle}>
              Made by crew, for crew
            </ThemedText>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Airline Email</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="yourname@aa.com"
                placeholderTextColor={Colors.text.disabled}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <ThemedText style={styles.label}>Password</ThemedText>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <ThemedText style={styles.forgotLink}>Forgot Password?</ThemedText>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.text.disabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </ThemedText>
            </TouchableOpacity>

            {/* Resend Verification Email */}
            {showResendVerification && (
              <View style={styles.verificationBanner}>
                <View style={styles.verificationContent}>
                  <Ionicons name="mail-outline" size={20} color={Colors.warning} />
                  <ThemedText style={styles.verificationText}>
                    Email not verified
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.resendVerificationButton, resendingVerification && styles.buttonDisabled]}
                  onPress={handleResendVerification}
                  disabled={resendingVerification}
                >
                  {resendingVerification ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <ThemedText style={styles.resendVerificationText}>
                      Resend Verification Email
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
              <ThemedText style={styles.link}>
                Don't have an account? Sign Up
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {resetSent ? 'Check Your Email' : 'Reset Password'}
              </ThemedText>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {!resetSent ? (
              // Reset form
              <View style={styles.modalBody}>
                <View style={styles.iconContainer}>
                  <Ionicons name="lock-open-outline" size={48} color={Colors.primary} />
                </View>
                <ThemedText style={styles.modalDescription}>
                  Enter your airline email and we'll send you a link to reset your password.
                </ThemedText>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Email Address</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="yourname@aa.com"
                    placeholderTextColor={Colors.text.disabled}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, resetLoading && styles.buttonDisabled]}
                  onPress={handleSendResetEmail}
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <ThemedText style={styles.buttonText}>Send Reset Link</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Success state
              <View style={styles.modalBody}>
                <View style={[styles.iconContainer, styles.successIcon]}>
                  <Ionicons name="mail-outline" size={48} color={Colors.success} />
                </View>
                <ThemedText style={styles.modalDescription}>
                  We've sent a password reset link to:
                </ThemedText>
                <ThemedText style={styles.emailHighlight}>{resetEmail}</ThemedText>
                <ThemedText style={styles.modalSubtext}>
                  Check your inbox and click the link to reset your password. The link expires in 1 hour.
                </ThemedText>
                <ThemedText style={styles.modalTip}>
                  💡 Don't see it? Check your spam folder.
                </ThemedText>

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleCloseModal}
                >
                  <ThemedText style={styles.buttonText}>Back to Sign In</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={() => setResetSent(false)}
                >
                  <ThemedText style={styles.resendText}>Didn't receive it? Try again</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
    gap: 15,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.text.secondary,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  forgotLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: Colors.white,
    color: Colors.text.primary,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    color: Colors.primary,
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  // Verification banner styles
  verificationBanner: {
    backgroundColor: Colors.warning + '15',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  verificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.warning,
  },
  resendVerificationButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resendVerificationText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    backgroundColor: Colors.success + '15',
  },
  modalDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  emailHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  modalTip: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: Colors.accent + '15',
    padding: 12,
    borderRadius: 8,
  },
  resendButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
