// auth/verify-crew.tsx
// Two-step airline email verification:
// Step 1: Enter airline email → sends 6-digit code
// Step 2: Enter code → verified as crew
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isValidAirlineEmail } from '@/data/airlines';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useState, useRef, useEffect } from 'react';
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

export default function VerifyCrewScreen() {
  const { user, signOut } = useAuth();
  const functions = getFunctions();
  
  // Step management
  const [step, setStep] = useState<'email' | 'code'>('email');
  
  // Step 1: Email
  const [airlineEmail, setAirlineEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  
  // Step 2: Code
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ── Step 1: Send verification code ────────────────────────────────────
  const handleSendCode = async () => {
    const trimmedEmail = airlineEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter your airline email');
      return;
    }

    if (!isValidAirlineEmail(trimmedEmail)) {
      Alert.alert(
        'Not a Recognized Airline Email',
        'CrewMate is exclusively for airline crew. Please enter your official airline email address (e.g., yourname@aa.com, yourname@united.com).\n\nIf your airline isn\'t recognized, contact us at hello@crewmateapp.dev',
      );
      return;
    }

    setSendingCode(true);

    try {
      const sendCode = httpsCallable(functions, 'sendCrewVerificationCode');
      await sendCode({ airlineEmail: trimmedEmail });
      
      setStep('code');
      setResendCooldown(60); // 60 second cooldown before resend
      
      // Focus first code input
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch (error: any) {
      console.error('Send code error:', error);
      const message = error?.message || 'Failed to send verification code. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSendingCode(false);
    }
  };

  // ── Step 2: Verify the code ───────────────────────────────────────────
  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Error', 'Please enter the full 6-digit code');
      return;
    }

    setVerifying(true);

    try {
      const verifyCode = httpsCallable(functions, 'verifyCrewCode');
      const result = await verifyCode({ code: fullCode });
      const data = result.data as { airline: string };
      
      Alert.alert(
        'Verified! ✈️',
        `Welcome to CrewMate, ${data.airline} crew!`,
        [{
          text: 'Create Profile',
          onPress: () => router.replace('/auth/create-profile'),
        }]
      );
    } catch (error: any) {
      console.error('Verify code error:', error);
      const message = error?.message || 'Verification failed. Please try again.';
      Alert.alert('Incorrect Code', message);
      // Clear code inputs
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend code ───────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setResending(true);
    try {
      const resendCode = httpsCallable(functions, 'resendCrewVerificationCode');
      await resendCode({});
      
      setResendCooldown(60);
      setCode(['', '', '', '', '', '']);
      Alert.alert('Code Sent!', 'A new verification code has been sent to your airline email.');
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      console.error('Resend error:', error);
      Alert.alert('Error', error?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  // ── Code input handling ───────────────────────────────────────────────
  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        // Small delay so user sees the last digit
        setTimeout(() => {
          const verifyCode = httpsCallable(functions, 'verifyCrewCode');
          setVerifying(true);
          verifyCode({ code: fullCode })
            .then((result) => {
              const data = result.data as { airline: string };
              Alert.alert(
                'Verified! ✈️',
                `Welcome to CrewMate, ${data.airline} crew!`,
                [{
                  text: 'Create Profile',
                  onPress: () => router.replace('/auth/create-profile'),
                }]
              );
            })
            .catch((err: any) => {
              console.error('Auto-verify error:', err);
              Alert.alert('Incorrect Code', err?.message || 'Please try again.');
              setCode(['', '', '', '', '', '']);
              inputRefs.current[0]?.focus();
            })
            .finally(() => setVerifying(false));
        }, 200);
      }
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  // ── Go back to email step ─────────────────────────────────────────────
  const handleChangeEmail = () => {
    setStep('email');
    setCode(['', '', '', '', '', '']);
  };

  // ── Sign out ──────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out?',
      'You can come back and verify anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/signin');
          },
        },
      ]
    );
  };

  // ── Mask email for display ────────────────────────────────────────────
  const getMaskedEmail = () => {
    const parts = airlineEmail.split('@');
    if (parts[0].length <= 3) return airlineEmail;
    return `${parts[0].slice(0, 3)}***@${parts[1]}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>

          {/* ═══ STEP 1: Enter Airline Email ═══════════════════════════ */}
          {step === 'email' && (
            <>
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
                </View>
                <ThemedText style={styles.title}>Verify You're Crew</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Enter your airline email and we'll send you a 6-digit verification code. Your airline email won't be stored — we only save that you're verified.
                </ThemedText>
              </View>

              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Airline Email</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="yourname@aa.com"
                    placeholderTextColor={Colors.text.disabled}
                    value={airlineEmail}
                    onChangeText={setAirlineEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    autoFocus
                  />
                  <ThemedText style={styles.hint}>
                    We accept emails from all major US airlines
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, sendingCode && styles.buttonDisabled]}
                  onPress={handleSendCode}
                  disabled={sendingCode}
                >
                  {sendingCode ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="mail" size={20} color={Colors.white} />
                      <ThemedText style={styles.primaryButtonText}>Send Verification Code</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Privacy Notice */}
              <View style={styles.privacyCard}>
                <View style={styles.privacyRow}>
                  <Ionicons name="lock-closed" size={18} color={Colors.success} />
                  <ThemedText style={styles.privacyText}>
                    Your airline email is <ThemedText style={styles.privacyBold}>never stored</ThemedText> — we only save that you're verified crew
                  </ThemedText>
                </View>
                <View style={styles.privacyRow}>
                  <Ionicons name="eye-off" size={18} color={Colors.success} />
                  <ThemedText style={styles.privacyText}>
                    Your login stays with Google/Apple — completely separate from work
                  </ThemedText>
                </View>
                <View style={styles.privacyRow}>
                  <Ionicons name="people" size={18} color={Colors.success} />
                  <ThemedText style={styles.privacyText}>
                    Other crew <ThemedText style={styles.privacyBold}>never see</ThemedText> your airline email
                  </ThemedText>
                </View>
              </View>
            </>
          )}

          {/* ═══ STEP 2: Enter Verification Code ═══════════════════════ */}
          {step === 'code' && (
            <>
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="keypad" size={48} color={Colors.primary} />
                </View>
                <ThemedText style={styles.title}>Enter Your Code</ThemedText>
                <ThemedText style={styles.subtitle}>
                  We sent a 6-digit code to your airline email. Check your inbox and enter it below.
                </ThemedText>
                <View style={styles.emailBadge}>
                  <Ionicons name="mail" size={16} color={Colors.primary} />
                  <ThemedText style={styles.emailBadgeText}>{getMaskedEmail()}</ThemedText>
                </View>
              </View>

              {/* Code Input */}
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleCodeKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.primaryButton, verifying && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                    <ThemedText style={styles.primaryButtonText}>Verify</ThemedText>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend / Change Email */}
              <View style={styles.codeActions}>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resendCooldown > 0 || resending}
                  style={styles.codeActionButton}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <ThemedText style={[
                      styles.codeActionText,
                      resendCooldown > 0 && styles.codeActionDisabled,
                    ]}>
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend code'
                      }
                    </ThemedText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleChangeEmail} style={styles.codeActionButton}>
                  <ThemedText style={styles.codeActionText}>
                    Use different email
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* Tips */}
              <View style={styles.tipsCard}>
                <ThemedText style={styles.tipsTitle}>Don't see the email?</ThemedText>
                <ThemedText style={styles.tipsText}>
                  • Check your spam/junk folder{'\n'}
                  • Airline emails can take a few minutes{'\n'}
                  • Some airline servers may delay delivery{'\n'}
                  • The code is valid for 1 hour
                </ThemedText>
              </View>
            </>
          )}

          {/* Sign Out Option (both steps) */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <ThemedText style={styles.signOutText}>Use a different account</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
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

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  // ── Email Badge ───────────────────────────────────────────────────────
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.primary + '10',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  emailBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Form ──────────────────────────────────────────────────────────────
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    backgroundColor: Colors.white,
    color: Colors.text.primary,
  },
  hint: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },

  // ── Primary Button ────────────────────────────────────────────────────
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ── Code Input ────────────────────────────────────────────────────────
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 58,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    backgroundColor: Colors.white,
  },
  codeInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },

  // ── Code Actions ──────────────────────────────────────────────────────
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeActionButton: {
    padding: 8,
  },
  codeActionText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  codeActionDisabled: {
    color: Colors.text.secondary,
  },

  // ── Tips Card ─────────────────────────────────────────────────────────
  tipsCard: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 22,
  },

  // ── Privacy Card ──────────────────────────────────────────────────────
  privacyCard: {
    backgroundColor: Colors.success + '08',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.success + '20',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  privacyBold: {
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // ── Sign Out ──────────────────────────────────────────────────────────
  signOutButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 12,
  },
  signOutText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});
