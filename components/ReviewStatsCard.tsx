// components/ReviewStatsCard.tsx
import { LightColors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      {/* Header */}
      <Text style={styles.header}>⭐ Ratings & Reviews</Text>
      
      {/* Overall Rating */}
      <View style={styles.overallSection}>
        <View style={styles.ratingDisplay}>
          <Text style={styles.bigNumber}>
            {displayRating > 0 ? displayRating.toFixed(1) : '—'}
          </Text>
          <View style={styles.starsDisplay}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={displayRating >= star ? 'star' : displayRating >= star - 0.5 ? 'star-half' : 'star-outline'}
                size={20}
                color={LightColors.accent}
              />
            ))}
          </View>
          <Text style={styles.countText}>
            {displayCount} {displayCount === 1 ? 'rating' : 'ratings'}
          </Text>
          {!hasReviews && displayCount === 0 && (
            <Text style={styles.noReviewsText}>No ratings yet</Text>
          )}
          {hasReviews && (
            <Text style={styles.reviewsText}>
              {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
            </Text>
          )}
        </View>

        {/* Rating Breakdown */}
        {hasReviews && stats && (
          <View style={styles.breakdownSection}>
            {[5, 4, 3, 2, 1].map((rating) => (
              <View key={rating} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{rating}★</Text>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.barFill, 
                      { width: `${getRatingBar(stats.ratingBreakdown[rating as keyof typeof stats.ratingBreakdown])}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.breakdownCount}>
                  {stats.ratingBreakdown[rating as keyof typeof stats.ratingBreakdown]}
                </Text>
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
          <Ionicons name="create-outline" size={20} color={LightColors.white} />
          <Text style={styles.primaryButtonText}>Write Review</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={onQuickRate}
        >
          <Ionicons name="star-outline" size={20} color={LightColors.primary} />
          <Text style={styles.secondaryButtonText}>Quick Rate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: LightColors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: LightColors.text.primary,
    marginBottom: 16,
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
    color: LightColors.text.primary,
    lineHeight: 52,
  },
  starsDisplay: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  countText: {
    fontSize: 14,
    color: LightColors.text.secondary,
    marginTop: 8,
  },
  noReviewsText: {
    fontSize: 13,
    color: LightColors.text.secondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  reviewsText: {
    fontSize: 12,
    color: LightColors.text.secondary,
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
    color: LightColors.text.primary,
    width: 30,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: LightColors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: LightColors.accent,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: 12,
    color: LightColors.text.secondary,
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
    backgroundColor: LightColors.primary,
  },
  primaryButtonText: {
    color: LightColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: LightColors.primary,
  },
  secondaryButtonText: {
    color: LightColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
