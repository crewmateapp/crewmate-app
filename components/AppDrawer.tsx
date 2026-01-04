// components/AppDrawer.tsx
import { ThemedText } from '@/components/themed-text';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    ScrollView,
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

export default function AppDrawer({ visible, onClose }: AppDrawerProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme, colors } = useTheme();
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
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigation('/profile')}
              >
                <Ionicons name="person-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Profile</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigation('/explore')}
              >
                <Ionicons name="compass-outline" size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Explore Guide</ThemedText>
              </TouchableOpacity>

              {/* Theme Toggle */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleThemeChange}
              >
                <Ionicons name={getThemeIcon()} size={24} color={colors.text.primary} />
                <ThemedText style={styles.menuText}>Theme</ThemedText>
                <View style={[styles.themeBadge, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.themeBadgeText}>{getThemeLabel()}</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, styles.menuItemDisabled]}
                onPress={() => Alert.alert('Coming Soon', 'Saved Places feature is coming soon!')}
              >
                <Ionicons name="bookmark-outline" size={24} color={colors.text.disabled} />
                <ThemedText style={[styles.menuText, { color: colors.text.disabled }]}>
                  Saved Places
                </ThemedText>
                <View style={[styles.comingSoonBadge, { backgroundColor: colors.accent }]}>
                  <ThemedText style={styles.comingSoonText}>Soon</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, styles.menuItemDisabled]}
                onPress={() => Alert.alert('Coming Soon', 'Settings feature is coming soon!')}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text.disabled} />
                <ThemedText style={[styles.menuText, { color: colors.text.disabled }]}>
                  Settings
                </ThemedText>
                <View style={[styles.comingSoonBadge, { backgroundColor: colors.accent }]}>
                  <ThemedText style={styles.comingSoonText}>Soon</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, styles.menuItemDisabled]}
                onPress={() => Alert.alert('Coming Soon', 'Help & Support feature is coming soon!')}
              >
                <Ionicons name="help-circle-outline" size={24} color={colors.text.disabled} />
                <ThemedText style={[styles.menuText, { color: colors.text.disabled }]}>
                  Help & Support
                </ThemedText>
                <View style={[styles.comingSoonBadge, { backgroundColor: colors.accent }]}>
                  <ThemedText style={styles.comingSoonText}>Soon</ThemedText>
                </View>
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
  },
  menuSection: {
    paddingTop: 20,
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
  themeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  themeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
