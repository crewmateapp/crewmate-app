// components/ProfileMenu.tsx
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Image,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText } from './themed-text';

/**
 * ProfileMenu - Dropdown menu from profile picture
 * Shows menu items with notification badges
 */
export function ProfileMenu() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { notifications, unreadCount } = useNotifications();
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Calculate notification counts by type
  const connectionNotifications = notifications.filter(n => n.type === 'connection' && !n.read).length;
  const planNotifications = notifications.filter(n => n.type === 'plan' && !n.read).length;
  const spotNotifications = notifications.filter(n => n.type === 'spot' && !n.read).length;
  const cityNotifications = notifications.filter(n => n.type === 'city' && !n.read).length;
  
  // Combined submission notifications (spots + cities)
  const submissionNotifications = spotNotifications + cityNotifications;

  // Listen for unread messages from conversations
  useEffect(() => {
    if (!user) return;

    // Listen to conversations where user is participant
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const userUnread = data.unreadCount?.[user.uid] || 0;
        totalUnread += userUnread;
      });
      setUnreadMessages(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  // Total badge count including messages
  const totalBadgeCount = unreadCount + unreadMessages;

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPhotoURL(data.photoURL || null);
          setInitials(`${data.firstName?.[0] || ''}${data.lastInitial || ''}`);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, [user]);

  const handleMenuItemPress = (route: string) => {
    setMenuVisible(false);
    setTimeout(() => {
      router.push(route as any);
    }, 200);
  };

  return (
    <>
      {/* Profile Picture Button */}
      <TouchableOpacity 
        onPress={() => setMenuVisible(true)}
        style={styles.profileButton}
        activeOpacity={0.7}
      >
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.profileImage} />
        ) : (
          <View style={[styles.profileFallback, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.profileInitials}>{initials}</ThemedText>
          </View>
        )}

        {/* Total Notification Badge (includes messages) */}
        {totalBadgeCount > 0 && (
          <View style={[styles.totalBadge, { backgroundColor: colors.error }]}>
            <ThemedText style={styles.totalBadgeText}>
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </ThemedText>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Menu */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Profile Section */}
            <TouchableOpacity
              style={[styles.menuItem, styles.profileMenuItem]}
              onPress={() => handleMenuItemPress('/profile')}
              activeOpacity={0.7}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.menuProfileImage} />
              ) : (
                <View style={[styles.menuProfileFallback, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.menuProfileInitials}>{initials}</ThemedText>
                </View>
              )}
              <View style={styles.profileInfo}>
                <ThemedText style={styles.profileName}>View Profile</ThemedText>
                <ThemedText style={[styles.profileHint, { color: colors.text.secondary }]}>
                  Edit your profile
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Notifications */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress('/notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications" size={22} color={colors.text.primary} />
              <ThemedText style={styles.menuItemText}>Notifications</ThemedText>
              {submissionNotifications > 0 && (
                <View style={[styles.itemBadge, { backgroundColor: colors.error }]}>
                  <ThemedText style={styles.itemBadgeText}>
                    {submissionNotifications}
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            {/* Connections */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress('/(tabs)/connections')}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={22} color={colors.text.primary} />
              <ThemedText style={styles.menuItemText}>Connections</ThemedText>
              {connectionNotifications > 0 && (
                <View style={[styles.itemBadge, { backgroundColor: colors.error }]}>
                  <ThemedText style={styles.itemBadgeText}>
                    {connectionNotifications}
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            {/* My Plans */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress('/(tabs)/plans')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={22} color={colors.text.primary} />
              <ThemedText style={styles.menuItemText}>My Plans</ThemedText>
              {planNotifications > 0 && (
                <View style={[styles.itemBadge, { backgroundColor: colors.error }]}>
                  <ThemedText style={styles.itemBadgeText}>
                    {planNotifications}
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            {/* Messages */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress('/(tabs)/messages')}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble" size={22} color={colors.text.primary} />
              <ThemedText style={styles.menuItemText}>Messages</ThemedText>
              {unreadMessages > 0 && (
                <View style={[styles.itemBadge, { backgroundColor: colors.error }]}>
                  <ThemedText style={styles.itemBadgeText}>
                    {unreadMessages}
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress('/settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings" size={22} color={colors.text.primary} />
              <ThemedText style={styles.menuItemText}>Settings</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  profileButton: {
    position: 'relative',
    padding: 4,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 20,
  },
  menuContainer: {
    width: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  profileMenuItem: {
    paddingVertical: 16,
  },
  menuProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  menuProfileFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuProfileInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileHint: {
    fontSize: 13,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  itemBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 'auto',
    marginRight: 8,
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
