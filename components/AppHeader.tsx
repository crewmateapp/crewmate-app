// components/AppHeader.tsx
import Logo from '@/components/Logo';
import { ProfileMenu } from '@/components/ProfileMenu';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';

interface AppHeaderProps {
  onMenuPress: () => void;
}

export default function AppHeader({ 
  onMenuPress,
}: AppHeaderProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [hasLayover, setHasLayover] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { counts: adminCounts, isAdmin } = useAdminNotifications();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const layover = data.currentLayover;
        setHasLayover(!!layover);
        setIsVisible(layover?.discoverable || false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleVisibilityToggle = async (value: boolean) => {
    if (!user) return;

    // If no layover set, prompt user to set one
    if (!hasLayover) {
      Alert.alert(
        'Set Your Layover First',
        'You need to set your layover location before you can become discoverable.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'currentLayover.discoverable': value,
      });
    } catch (error) {
      console.error('Error updating visibility:', error);
    }
  };

  // Show badge if admin and has pending items
  const showAdminBadge = isAdmin && adminCounts.total > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Hamburger Menu with Admin Badge */}
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={onMenuPress}
        >
          <Ionicons name="menu" size={28} color={Colors.white} />
          {showAdminBadge && (
            <View style={styles.adminBadge}>
              <ThemedText style={styles.adminBadgeText}>
                {adminCounts.total > 9 ? '9+' : adminCounts.total}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>

        {/* Logo */}
        <TouchableOpacity 
          style={styles.logoContainer}
          onPress={() => router.push("/(tabs)/")}
          activeOpacity={0.7}
        >
          <Logo variant="full" size="small" />
        </TouchableOpacity>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {/* Visibility Toggle */}
          <View style={styles.visibilityContainer}>
            <Ionicons 
              name={isVisible ? "eye" : "eye-off"} 
              size={20} 
              color={hasLayover ? Colors.white : Colors.text.disabled} 
            />
            <Switch
              value={isVisible}
              onValueChange={handleVisibilityToggle}
              trackColor={{ 
                false: Colors.border, 
                true: Colors.accent 
              }}
              thumbColor={Colors.white}
              style={styles.switch}
            />
          </View>

          {/* Profile Menu with Notifications */}
          <ProfileMenu />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  adminBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#E53935',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
});
