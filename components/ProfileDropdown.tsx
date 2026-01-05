// components/ProfileDropdown.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

type ProfileDropdownProps = {
  photoURL?: string;
  displayName: string;
  unreadCount: number; // Total notifications (connections + messages)
};

export default function ProfileDropdown({ 
  photoURL, 
  displayName, 
  unreadCount 
}: ProfileDropdownProps) {
  const [visible, setVisible] = useState(false);

  const handlePress = () => {
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  const navigateToProfile = () => {
    setVisible(false);
    router.push('/(tabs)/profile');
  };

  const navigateToConnections = () => {
    setVisible(false);
    router.push('/(tabs)/connections');
  };

  return (
    <>
      {/* Profile Photo Button */}
      <TouchableOpacity 
        style={styles.profileButton}
        onPress={handlePress}
      >
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.profilePhoto} />
        ) : (
          <View style={styles.profilePhotoFallback}>
            <ThemedText style={styles.profilePhotoText}>
              {displayName.slice(0, 2).toUpperCase()}
            </ThemedText>
          </View>
        )}
        
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </ThemedText>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable 
          style={styles.overlay}
          onPress={handleClose}
        >
          <View style={styles.dropdownContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.dropdown}>
                {/* User Info Header */}
                <View style={styles.header}>
                  {photoURL ? (
                    <Image source={{ uri: photoURL }} style={styles.headerPhoto} />
                  ) : (
                    <View style={styles.headerPhotoFallback}>
                      <ThemedText style={styles.headerPhotoText}>
                        {displayName.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText style={styles.displayName}>{displayName}</ThemedText>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Menu Items */}
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={navigateToProfile}
                >
                  <Ionicons name="person" size={20} color={Colors.text.primary} />
                  <ThemedText style={styles.menuItemText}>Profile</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={navigateToConnections}
                >
                  <Ionicons name="people" size={20} color={Colors.text.primary} />
                  <ThemedText style={styles.menuItemText}>Connections</ThemedText>
                  {unreadCount > 0 && (
                    <View style={styles.menuBadge}>
                      <ThemedText style={styles.menuBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </ThemedText>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  profileButton: {
    position: 'relative',
    padding: 4,
  },
  profilePhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profilePhotoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profilePhotoText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 60, // Below the header
    right: 16,
    minWidth: 220,
  },
  dropdown: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerPhotoFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPhotoText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  menuBadge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
});
