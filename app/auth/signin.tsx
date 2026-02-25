// auth/signin.tsx
// Primary sign-in screen: Apple / Google / Email+Password
import Logo from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useEffect, useState } from 'react';
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

// Configure Google Sign-In on load
function configureGoogleSignIn() {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      // This comes from Firebase Console → Authentication → Sign-in method → Google → Web client ID
      // You MUST replace this with your actual web client ID from Firebase
      webClientId: '224833054920-2tc4n359fhfumlnj0dpgtsfrqpblpdpp.apps.googleusercontent.com',
    });
  } catch (error) {
    console.log('Google Sign-In not available:', error);
  }
}

export default function SignInScreen() {
  const { signIn, signInWithGoogle, signInWithApple, signOut, sendVerificationEmail } = useAuth();
  
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Forgot password state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Email verification state
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // ── Social Sign-In Handlers ───────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Navigation handled by root layout after auth state changes
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert('Sign In Failed', error.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await signInWithApple();
      // Navigation handled by root layout after auth state changes
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      Alert.alert('Sign In Failed', error.message || 'Failed to sign in with Apple');
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Email/Password Handler ────────────────────────────────────────────

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setShowResendVerification(false);

    try {
      await signIn(email, password);

      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await signOut();
        setShowResendVerification(true);
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before signing in. Check your inbox for the verification link.',
          [{ text: 'OK' }]
        );
        return;
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      let message = 'Failed to sign in';
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'No account found with this email';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection.';
          break;
        default:
          message = error.message || 'Failed to sign in';
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
      await signIn(email, password);
      await sendVerificationEmail();
      await signOut();
      Alert.alert(
        'Verification Email Sent!',
        `A new verification link has been sent to ${email}.`,
        [{ text: 'OK' }]
      );
      setShowResendVerification(false);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to resend verification email');
    } finally {
      setResendingVerification(false);
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────

  const handleForgotPassword = () => {
    setResetEmail(email);
    setResetSent(false);
    setForgotModalVisible(true);
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetSent(true);
    } catch (error: any) {
      let message = 'Failed to send reset email';
      if (error.code === 'auth/user-not-found') message = 'No account found with this email';
      Alert.alert('Error', message);
    } finally {
      setResetLoading(false);
    }
  };

  const isAnySocialLoading = googleLoading || appleLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          {/* Logo */}
          <View style={styles.header}>
            <Logo size="large" variant="full" />
            <ThemedText style={styles.subtitle}>
              Made by crew, for crew
            </ThemedText>
          </View>

          {/* ── Social Sign-In Buttons ─────────────────────────────── */}
          <View style={styles.socialButtons}>
            {/* Apple Sign-In (iOS only) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={isAnySocialLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={22} color="#fff" />
                    <ThemedText style={styles.appleButtonText}>
                      Continue with Apple
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google Sign-In */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isAnySocialLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <ThemedText style={styles.googleButtonText}>
                    Continue with Google
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Divider ────────────────────────────────────────────── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>or</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Email/Password Section ─────────────────────────────── */}
          {!showEmailForm ? (
            <TouchableOpacity
              style={styles.emailToggleButton}
              onPress={() => setShowEmailForm(true)}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.emailToggleText}>
                Sign in with email & password
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.emailForm}>
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Email</ThemedText>
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
                    <ThemedText style={styles.forgotLink}>Forgot?</ThemedText>
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
                style={[styles.signInButton, loading && styles.buttonDisabled]}
                onPress={handleEmailSignIn}
                disabled={loading}
              >
                <ThemedText style={styles.signInButtonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </ThemedText>
              </TouchableOpacity>

              {/* Resend Verification */}
              {showResendVerification && (
                <View style={styles.verificationBanner}>
                  <View style={styles.verificationContent}>
                    <Ionicons name="mail-outline" size={18} color={Colors.warning} />
                    <ThemedText style={styles.verificationText}>Email not verified</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[styles.resendButton, resendingVerification && styles.buttonDisabled]}
                    onPress={handleResendVerification}
                    disabled={resendingVerification}
                  >
                    <ThemedText style={styles.resendText}>
                      {resendingVerification ? 'Sending...' : 'Resend Verification'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <View style={styles.guidanceBox}>
            <View style={styles.guidanceRow}>
              <Ionicons name="sparkles" size={14} color={Colors.primary} />
              <ThemedText style={styles.guidanceLabel}>New here? </ThemedText>
              <ThemedText style={styles.guidanceText}>Tap Apple or Google to get started</ThemedText>
            </View>
            <View style={styles.guidanceDivider} />
            <View style={styles.guidanceRow}>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              <ThemedText style={styles.guidanceLabel}>Joined before March 2026? </ThemedText>
              <ThemedText style={styles.guidanceText}>Use email & password</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.privacyNote}>
            🔒 CrewMate is exclusively for verified airline crew members
          </ThemedText>
        </ThemedView>
      </ScrollView>

      {/* ── Forgot Password Modal ────────────────────────────────── */}
      <Modal
        visible={forgotModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Reset Password</ThemedText>
              <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {!resetSent ? (
              <View style={styles.modalBody}>
                <ThemedText style={styles.modalDescription}>
                  Enter your email and we'll send you a reset link.
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="yourname@aa.com"
                  placeholderTextColor={Colors.text.disabled}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.signInButton, resetLoading && styles.buttonDisabled]}
                  onPress={handleSendResetEmail}
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <ThemedText style={styles.signInButtonText}>Send Reset Link</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalBody}>
                <Ionicons name="mail-outline" size={48} color={Colors.success} style={{ alignSelf: 'center', marginBottom: 16 }} />
                <ThemedText style={styles.modalDescription}>
                  Reset link sent to {resetEmail}. Check your inbox!
                </ThemedText>
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={() => setForgotModalVisible(false)}
                >
                  <ThemedText style={styles.signInButtonText}>Back to Sign In</ThemedText>
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
    padding: 24,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // ── Social Buttons ────────────────────────────────────────────────────
  socialButtons: {
    gap: 12,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 14,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleButtonText: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '600',
  },

  // ── Divider ───────────────────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.text.secondary,
    fontSize: 14,
  },

  // ── Email Toggle / Form ───────────────────────────────────────────────
  emailToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  emailToggleText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  emailForm: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
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
  signInButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  signInButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ── Verification Banner ───────────────────────────────────────────────
  verificationBanner: {
    backgroundColor: Colors.warning + '15',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  verificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
  },
  resendButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Footer ────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  footerLink: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 20,
  },
  guidanceBox: {
    marginTop: 24,
    backgroundColor: Colors.primary + '08',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  guidanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  guidanceText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  guidanceDivider: {
    height: 1,
    backgroundColor: Colors.primary + '15',
  },

  // ── Modal ─────────────────────────────────────────────────────────────
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
  modalBody: {
    padding: 20,
    gap: 16,
  },
  modalDescription: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
