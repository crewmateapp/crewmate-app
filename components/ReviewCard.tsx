// components/ReviewCard.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
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

type ReviewCardProps = {
  review: Review;
  currentUserId: string | undefined;
  onHelpfulVote: (reviewId: string, currentVotes: string[]) => void;
  onUserPress?: (userId: string) => void;
  onPhotoPress?: (photoUrl: string) => void;
};

export function ReviewCard({ 
  review, 
  currentUserId,
  onHelpfulVote,
  onUserPress,
  onPhotoPress
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLongReview = review.reviewText.length > 200;
  const displayText = expanded || !isLongReview 
    ? review.reviewText 
    : review.reviewText.slice(0, 200) + '...';

  const hasVoted = currentUserId ? review.helpfulVotes.includes(currentUserId) : false;
  const helpfulCount = review.helpfulVotes.length;

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const reviewDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now.getTime() - reviewDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  return (
    <View style={styles.container}>
      {/* User Info */}
      <TouchableOpacity 
        style={styles.userSection}
        onPress={() => onUserPress?.(review.userId)}
        disabled={!onUserPress}
      >
        {review.userPhoto ? (
          <Image source={{ uri: review.userPhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <ThemedText style={styles.avatarText}>
              {review.userName.slice(0, 2).toUpperCase()}
            </ThemedText>
          </View>
        )}

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.userName}>{review.userName}</ThemedText>
            {review.verified && (
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            )}
          </View>
          {review.userPosition && (
            <ThemedText style={styles.userPosition}>{review.userPosition}</ThemedText>
          )}
        </View>
      </TouchableOpacity>

      {/* Rating & Date */}
      <View style={styles.metaRow}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={review.rating >= star ? 'star' : 'star-outline'}
              size={16}
              color={Colors.accent}
            />
          ))}
        </View>
        <ThemedText style={styles.timeAgo}>{getTimeAgo(review.createdAt)}</ThemedText>
      </View>

      {/* Review Text */}
      <ThemedText style={styles.reviewText}>{displayText}</ThemedText>
      {isLongReview && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <ThemedText style={styles.readMoreText}>
            {expanded ? 'Show less' : 'Read more'}
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Photos */}
      {review.photos.length > 0 && (
        <View style={styles.photosContainer}>
          {review.photos.slice(0, 3).map((photo, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.photoWrapper}
              onPress={() => onPhotoPress?.(photo)}
            >
              <Image source={{ uri: photo }} style={styles.photo} />
              {index === 2 && review.photos.length > 3 && (
                <View style={styles.photoOverlay}>
                  <ThemedText style={styles.photoOverlayText}>
                    +{review.photos.length - 3}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Helpful Vote */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.helpfulButton, hasVoted && styles.helpfulButtonActive]}
          onPress={() => onHelpfulVote(review.id, review.helpfulVotes)}
        >
          <Ionicons 
            name={hasVoted ? 'thumbs-up' : 'thumbs-up-outline'} 
            size={18} 
            color={hasVoted ? Colors.primary : Colors.text.secondary} 
          />
          <ThemedText style={[styles.helpfulText, hasVoted && styles.helpfulTextActive]}>
            Helpful {helpfulCount > 0 && `(${helpfulCount})`}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  userPosition: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  timeAgo: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  readMoreText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  helpfulButtonActive: {
    backgroundColor: Colors.primary + '20',
  },
  helpfulText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  helpfulTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
