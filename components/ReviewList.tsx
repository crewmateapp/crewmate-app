// components/ReviewList.tsx
import { ReviewCard } from '@/components/ReviewCard';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Review = {
  id: string;
  spotId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  userPosition: string | null;
  rating: number;
  reviewText: string;
  photos: string[];
  helpfulVotes: string[];
  notHelpfulVotes: string[];
  verified: boolean;
  createdAt: any;
  updatedAt: any;
};

type SortOption = 'helpful' | 'newest' | 'highest' | 'lowest';

type ReviewListProps = {
  reviews: Review[];
  currentUserId: string | undefined;
  onHelpfulVote: (reviewId: string, currentVotes: string[]) => void;
  onUserPress?: (userId: string) => void;
};

export function ReviewList({ 
  reviews, 
  currentUserId,
  onHelpfulVote,
  onUserPress 
}: ReviewListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('helpful');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const getSortedReviews = () => {
    const sorted = [...reviews];
    
    switch (sortBy) {
      case 'helpful':
        return sorted.sort((a, b) => b.helpfulVotes.length - a.helpfulVotes.length);
      case 'newest':
        return sorted.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      case 'highest':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return sorted.sort((a, b) => a.rating - b.rating);
      default:
        return sorted;
    }
  };

  const sortOptions: { value: SortOption; label: string; icon: string }[] = [
    { value: 'helpful', label: 'Most Helpful', icon: 'thumbs-up-outline' },
    { value: 'newest', label: 'Newest First', icon: 'time-outline' },
    { value: 'highest', label: 'Highest Rated', icon: 'arrow-up-outline' },
    { value: 'lowest', label: 'Lowest Rated', icon: 'arrow-down-outline' },
  ];

  const currentSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label || 'Sort';

  if (reviews.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={64} color={Colors.text.secondary} />
        <ThemedText style={styles.emptyTitle}>No Reviews Yet</ThemedText>
        <ThemedText style={styles.emptyText}>
          Be the first to share your experience!
        </ThemedText>
      </View>
    );
  }

  const sortedReviews = getSortedReviews();

  return (
    <View style={styles.container}>
      {/* Header with Sort */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>
          💬 Reviews ({reviews.length})
        </ThemedText>
        
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <ThemedText style={styles.sortButtonText}>{currentSortLabel}</ThemedText>
          <Ionicons 
            name={showSortMenu ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={Colors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Sort Menu */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive
              ]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
              }}
            >
              <Ionicons 
                name={option.icon as any} 
                size={20} 
                color={sortBy === option.value ? Colors.primary : Colors.text.secondary} 
              />
              <ThemedText style={[
                styles.sortOptionText,
                sortBy === option.value && styles.sortOptionTextActive
              ]}>
                {option.label}
              </ThemedText>
              {sortBy === option.value && (
                <Ionicons name="checkmark" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Review Cards */}
      <View style={styles.reviewsList}>
        {sortedReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            currentUserId={currentUserId}
            onHelpfulVote={onHelpfulVote}
            onUserPress={onUserPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  sortButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  sortMenu: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortOptionActive: {
    backgroundColor: Colors.primary + '10',
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  reviewsList: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
