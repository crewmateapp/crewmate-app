// components/PlanCard.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface PlanCardProps {
  plan: Plan;
  showHost?: boolean;
  compact?: boolean;
}

export function PlanCard({ plan, showHost = true, compact = false }: PlanCardProps) {
  const handlePress = () => {
    router.push({
      pathname: '/plan/[id]',
      params: { id: plan.id }
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) {
      return `Today ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      return `${dateStr} ${timeStr}`;
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={handlePress}>
        <View style={styles.compactContent}>
          <ThemedText style={styles.compactTitle} numberOfLines={1}>
            {plan.title}
          </ThemedText>
          {showHost && (
            <ThemedText style={styles.compactHost} numberOfLines={1}>
              Hosted by {plan.hostName}
            </ThemedText>
          )}
          <ThemedText style={styles.compactTime}>
            {formatTime(plan.scheduledTime)}
          </ThemedText>
        </View>
        <View style={styles.compactFooter}>
          <Ionicons name="people" size={14} color={Colors.text.secondary} />
          <ThemedText style={styles.compactAttendees}>
            {plan.attendeeCount}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>{plan.title}</ThemedText>
          {showHost && (
            <View style={styles.hostRow}>
              {plan.hostPhoto ? (
                <Image source={{ uri: plan.hostPhoto }} style={styles.hostAvatar} />
              ) : (
                <View style={styles.hostAvatarFallback}>
                  <ThemedText style={styles.hostAvatarText}>
                    {plan.hostName.slice(0, 2).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={styles.hostText}>
                Hosted by {plan.hostName}
              </ThemedText>
            </View>
          )}
        </View>
        <View style={styles.attendeeBadge}>
          <Ionicons name="people" size={16} color={Colors.text.secondary} />
          <ThemedText style={styles.attendeeCount}>{plan.attendeeCount}</ThemedText>
        </View>
      </View>

      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={18} color={Colors.primary} />
        <ThemedText style={styles.timeText}>
          {formatTime(plan.scheduledTime)}
        </ThemedText>
      </View>

      {plan.meetupLocation && (
        <View style={styles.meetupRow}>
          <Ionicons name="location-outline" size={18} color={Colors.text.secondary} />
          <ThemedText style={styles.meetupText} numberOfLines={1}>
            {plan.meetupLocation}
          </ThemedText>
        </View>
      )}

      <TouchableOpacity style={styles.detailsButton} onPress={handlePress}>
        <ThemedText style={styles.detailsButtonText}>View Details</ThemedText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  hostAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  hostText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  attendeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  attendeeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  meetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  meetupText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  detailsButton: {
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Compact card styles
  compactCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 180,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compactContent: {
    marginBottom: 10,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  compactHost: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  compactTime: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  compactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  compactAttendees: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
});