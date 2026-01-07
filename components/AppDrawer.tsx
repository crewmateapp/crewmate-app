// components/AppDrawer.tsx
import { ThemedText } from '@/components/themed-text';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
}

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  position: string;
  photoURL?: string;
};

// App version info
const APP_VERSION = '1.0.2';
const BUILD_NUMBER = '3';

export default function AppDrawer({ visible, onClose }: AppDrawerProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme, colors } = useTheme();
  const { role } = useAdminRole();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    if (visible) {
      fetchProfile();
    }
  }, [user, visible]);

  const handleNavigation = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as any);
    }, 300);
  };

  const handleThemeChange = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    if (theme === 'light') return 'sunny';
    if (theme === 'dark') return 'moon';
    return 'phone-portrait'; // auto mode
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light';
    if (theme === 'dark') return 'Dark';
    return 'Auto';
  };

  const handleMyReviews = () => {
    handleNavigation('/my-reviews');
  };

  const handleReportProblem = async () => {
    onClose();
    
    const subject = 'CrewMate - Report a Problem';
    const body = `
Hi CrewMate Team,

I'd like to report the following issue:

[Please describe the problem here]

---
App Version: ${APP_VERSION} (${BUILD_NUMBER})
User ID: ${user?.uid}
Device: ${Platform.OS} ${Platform.Version}
    `.trim();

    const emailUrl = `mailto:crewmateapphq@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert(
          'Email Not Available',
          'Please email us at crewmateapphq@gmail.com',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Could not open email. Please contact crewmateapphq@gmail.com',
        [{ text: 'OK' }]
      );
    }
  };

  const handleInviteCrew = async () => {
    onClose();
    
    try {
      const inviteMessage = `Hey! I've been using CrewMate to connect with other crew during layovers. It's built by crew, for crew. Check it out!\n\n🔗 Download: [App Store/Play Store link coming soon]\n\nUse my referral: ${user?.uid?.substring(0, 8)}`;
      
      await Share.share({
        message: inviteMessage,
        title: 'Join me on CrewMate!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleAboutCrewMate = () => {
    onClose();
    
    const appVersion = Application.nativeApplicationVersion || 'Unknown';
    const buildNumber = Application.nativeBuildVersion || 'Unknown';
    
    Alert.alert(
      'About CrewMate',
      `Built by crew, for crew ✈️\n\nVersion ${appVersion} (${buildNumber})\n\nCrewMate helps airline crew connect during layovers and discover crew-recommended spots worldwide.\n\nCreated by Zach & Johnny`,
      [
        {
          text: 'Privacy Policy',
          onPress: () => {
            Linking.openURL('https://crewmate.beehiiv.com/privacy-policy');
          }
        },
        {
          text: 'Learn More',
          onPress: () => {
            Linking.openURL('https://crewmate.beehiiv.com');
          }
        },
        { text: 'Close', style: 'cancel' }
      ]
    );
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
            onClose();
            await signOut();
            router.replace('/auth/signin');
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={[styles.drawer, { backgroundColor: colors.card }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={32} color={colors.text.primary} />
          </TouchableOpacity>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Header */}
            <View style={[styles.profileSection, { borderBottomColor: colors.border }]}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.avatarText}>
                    {profile?.firstName?.[0]}{profile?.lastInitial}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={styles.profileName}>
                {profile?.displayName || 'Loading...'}
              </ThemedText>
              <ThemedText style={[styles.profileRole, { color: colors.text.secondary }]}>
                {profile?.position || 'Crew Member'}
              </ThemedText>

              {/* Theme Toggle - Now under position */}
              <TouchableOpacity 
                style={[styles.themeToggle, { backgroundColor: colors.background }]}
                onPress={handleThemeChange}
              >
                <Ionicons name={getThemeIcon()} size={20} color={colors.text.primary} />
                <ThemedText style={styles.themeToggleText}>Theme: {getThemeLabel()}</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              {/* Profile */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigation('/profile')}
              >
                <Ionicons name="person-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Profile</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Admin Panel - Only visible to admins */}
              {isAdmin(role) && (
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('/admin')}
                >
                  <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                  <ThemedText style={[styles.menuText, { color: colors.primary }]}>Admin Panel</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}

              {/* My Reviews */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleMyReviews}
              >
                <Ionicons name="star-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>My Reviews</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Saved Places */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigation('/saved-places')}
              >
                <Ionicons name="bookmark-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Saved Places</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Report a Problem */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleReportProblem}
              >
                <Ionicons name="flag-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Report a Problem</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Invite Crew */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleInviteCrew}
              >
                <Ionicons name="paper-plane-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Invite Crew</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigation('/settings')}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Settings</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* Help & Support */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  Linking.openURL('https://crewmate.beehiiv.com/untitledcrewmate-faq---help');
                }}
              >
                <Ionicons name="help-circle-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Help & Support</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>

              {/* About CrewMate */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleAboutCrewMate}
              >
                <Ionicons name="information-circle-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>About CrewMate</ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity 
              style={[styles.signOutButton, { borderTopColor: colors.border }]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={24} color={colors.error} />
              <ThemedText style={[styles.signOutText, { color: colors.error }]}>Sign Out</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 320,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    marginBottom: 16,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  themeToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSection: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuText: {
    fontSize: 16,
    flex: 1,
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
    marginTop: 20,
    marginBottom: 40,
    borderTopWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
