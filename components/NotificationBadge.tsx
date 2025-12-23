import { ThemedText } from '@/components/themed-text';
import { StyleSheet, View } from 'react-native';

type NotificationBadgeProps = {
  count: number;
  size?: 'small' | 'medium';
};

export function NotificationBadge({ count, size = 'medium' }: NotificationBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall]}>
      <ThemedText style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>
        {displayCount}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  badgeSmall: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextSmall: {
    fontSize: 10,
  },
});
