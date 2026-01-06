// components/NotificationBell.tsx
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText } from './themed-text';

interface NotificationBellProps {
  size?: number;
  showBadge?: boolean;
}

export function NotificationBell({ size = 24, showBadge = true }: NotificationBellProps) {
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();

  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={unreadCount > 0 ? "notifications" : "notifications-outline"} 
        size={size} 
        color={colors.text.primary} 
      />
      {showBadge && unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
          <ThemedText style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
