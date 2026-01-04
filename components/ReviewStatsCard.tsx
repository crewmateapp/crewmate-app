// components/ReviewStatsCard.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

type ReviewStats = {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
};

type ReviewStatsCardProps = {
  stats: ReviewStats | null;
  quickVoteCount: number;
  quickVoteAverage: number;
  onWriteReview: () => void;
  onQuickRate: () => void;
};

export function ReviewStatsCard({ 
  stats, 
  quickVoteCount,
  quickVoteAverage,
  onWriteReview, 
  onQuickRate 
}: ReviewStatsCardProps) {
  // Use review stats if available, otherwise fall back to quick votes
  const displayRating = stats?.averageRating || quickVoteAverage;
  const displayCount = stats?.totalReviews || quickVoteCount;
  const hasReviews = stats && stats.totalReviews > 0;

  const getRatingBar = (count: number) => {
    const maxCount = stats ? Math.max(...Object.values(stats.ratingBreakdown)) : 0;
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    return percentage;
  };

  return (
    <View style={styles.container}>
      {/* Overall Rating */}
      <View style={styles.overallSection}>
        <View style={styles.ratingDisplay}>
          <ThemedText style={styles.bigNumber}>
            {displayRating > 0 ? displayRating.toFixed(1) : '—'}
          </ThemedText>
          <View style={styles.starsDisplay}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={displayRating >= star ? 'star' : displayRating >= star - 0.5 ? 'star-half' : 'star-outline'}
                size={20}
                color={Colors.accent}
              />
            ))}
          </View>
          <ThemedText style={styles.countText}>
            {displayCount} {displayCount === 1 ? 'rating' : 'ratings'}
          </ThemedText>
          {hasReviews && (
            <ThemedText style={styles.reviewsText}>
              {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
            </ThemedText>
          )}
        </View>

        {/* Rating Breakdown */}
        {hasReviews && stats && (
          <View style={styles.breakdownSection}>
            {[5, 4, 3, 2, 1].map((rating) => (
              <View key={rating} style={styles.breakdownRow}>
                <ThemedText style={styles.breakdownLabel}>{rating}★</ThemedText>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.barFill, 
                      { width: `${getRatingBar(stats.ratingBreakdown[rating as keyof typeof stats.ratingBreakdown])}%` }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.breakdownCount}>
                  {stats.ratingBreakdown[rating as keyof typeof stats.ratingBreakdown]}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={onWriteReview}
        >
          <Ionicons name="create-outline" size={20} color={Colors.white} />
          <ThemedText style={styles.primaryButtonText}>Write Review</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={onQuickRate}
        >
          <Ionicons name="star-outline" size={20} color={Colors.primary} />
          <ThemedText style={styles.secondaryButtonText}>Quick Rate</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overallSection: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  ratingDisplay: {
    alignItems: 'center',
    minWidth: 100,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 52,
  },
  starsDisplay: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  countText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  reviewsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  breakdownSection: {
    flex: 1,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    width: 30,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    width: 30,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
