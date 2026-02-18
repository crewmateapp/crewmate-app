// app/settings.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const [deactivating, setDeactivating] = useState(false);

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'No email address found for this account.');
      return;
    }

    Alert.alert(
      'Reset Password',
      `We'll send a password reset link to ${user.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, user.email!);
              Alert.alert(
                'Email Sent',
                'Check your email for a link to reset your password.',
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              console.error('Password reset error:', error);
              Alert.alert(
                'Error',
                'Could not send password reset email. Please try again later.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleDeactivateAccount = () => {
    Alert.alert(
      'Deactivate Account',
      'Your account will be deactivated and hidden from other crew. You can reactivate by signing in again.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setDeactivating(true);
            try {
              // Update user document to mark as deactivated
              await updateDoc(doc(db, 'users', user!.uid), {
                deactivated: true,
                deactivatedAt: new Date(),
                discoverable: false, // Hide from other users
              });

              Alert.alert(
                'Account Deactivated',
                'Your account has been deactivated. You can reactivate by signing in again.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await signOut();
                      router.replace('/auth/signin');
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Deactivation error:', error);
              Alert.alert('Error', 'Could not deactivate account. Please try again.');
            } finally {
              setDeactivating(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account - Coming Soon',
      'Complete account deletion will be available soon. For now, you can deactivate your account to hide it from other crew.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate Instead', onPress: handleDeactivateAccount }
      ]
    );
  };

  const openURL = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
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
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            ACCOUNT
          </ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="mail-outline" size={20} color={colors.text.primary} />
                <View style={styles.settingTextContainer}>
                  <ThemedText style={styles.settingLabel}>Email</ThemedText>
                  <ThemedText style={[styles.settingValue, { color: colors.text.secondary }]}>
                    {user?.email}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
              <View style={styles.settingInfo}>
                <Ionicons name="key-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Change Password</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy & Safety Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            PRIVACY & SAFETY
          </ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/profile')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="eye-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Profile Visibility</ThemedText>
              </View>
              <View style={styles.settingRight}>
                <ThemedText style={[styles.settingValue, { color: colors.text.secondary }]}>
                  Manage on Profile
                </ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/blocked-users')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="ban-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Blocked Users</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => openURL('https://crewmateapp.dev/privacy')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="shield-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Data & Privacy</ThemedText>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            NOTIFICATIONS
          </ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => Alert.alert('Coming Soon', 'Notification preferences coming soon!')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Push Notifications</ThemedText>
              </View>
              <View style={styles.settingRight}>
                <ThemedText style={[styles.settingValue, { color: colors.text.secondary }]}>
                  Coming Soon
                </ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About & Legal Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            ABOUT & LEGAL
          </ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => openURL('https://crewmateapp.dev/privacy')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="document-text-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Privacy Policy</ThemedText>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => openURL('https://crewmateapp.dev/terms')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="document-text-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Terms of Service</ThemedText>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => openURL('https://crewmateapp.dev/community-guidelines')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="people-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Community Guidelines</ThemedText>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => openURL('https://crewmateapp.dev/faq')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="help-circle-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Help & FAQ</ThemedText>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 🧪 TESTING SECTION - DELETE BEFORE PRODUCTION */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.error }]}>
            🧪 TESTING (DELETE BEFORE PRODUCTION)
          </ThemedText>

          <View style={[styles.testingCard, { backgroundColor: '#FFF3CD', borderColor: '#FFB020' }]}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                try {
                  await AsyncStorage.removeItem('onboarding_completed');
                  Alert.alert(
                    '✅ Reset Complete',
                    'Onboarding has been reset. Sign out and back in to see it again.',
                    [{ text: 'OK' }]
                  );
                } catch (error) {
                  Alert.alert('Error', 'Failed to reset onboarding');
                }
              }}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="refresh-circle" size={20} color="#FF6B6B" />
                <ThemedText style={[styles.settingLabel, { color: '#FF6B6B' }]}>
                  Reset Onboarding
                </ThemedText>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: '#FFB020' }]} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.push('/onboarding')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="eye" size={20} color="#FF6B6B" />
                <ThemedText style={[styles.settingLabel, { color: '#FF6B6B' }]}>
                  View Onboarding
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: '#FFB020' }]} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.push('/tutorial')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="school" size={20} color="#FF6B6B" />
                <ThemedText style={[styles.settingLabel, { color: '#FF6B6B' }]}>
                  View Tutorial
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            ACCOUNT ACTIONS
          </ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
              <View style={styles.settingInfo}>
                <Ionicons name="log-out-outline" size={20} color={colors.text.primary} />
                <ThemedText style={styles.settingLabel}>Sign Out</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={handleDeactivateAccount}
              disabled={deactivating}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="pause-circle-outline" size={20} color={colors.error} />
                <ThemedText style={[styles.settingLabel, { color: colors.error }]}>
                  Deactivate Account
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.settingItem} onPress={handleDeleteAccount}>
              <View style={styles.settingInfo}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <ThemedText style={[styles.settingLabel, { color: colors.error }]}>
                  Delete Account
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <ThemedText style={[styles.versionText, { color: colors.text.secondary }]}>
            CrewMate v1.0.2 (3)
          </ThemedText>
          <ThemedText style={[styles.versionText, { color: colors.text.secondary }]}>
            Built by crew, for crew ✈️
          </ThemedText>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
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
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  settingCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  testingCard: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: 1,
    marginLeft: 48,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  versionText: {
    fontSize: 13,
  },
});
