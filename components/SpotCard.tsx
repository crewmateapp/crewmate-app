import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';

const COLORS = {
  primary: '#114878',
  accent: '#F4C430',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#999999',
  darkGray: '#333333',
  border: '#E0E0E0',
};

type Spot = {
  id: string;
  name: string;
  category: string; // This is the actual field name in Firebase
  type?: string; // Keep for backwards compatibility
  address: string;
  city: string;
  description: string;
  photos?: string[];
  photoURLs?: string[];
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
};

type SpotCardProps = {
  spot: Spot;
  userLocation: { latitude: number; longitude: number } | null;
  onCreatePlan: () => void;
  onPress: () => void;
};

const CATEGORY_COLORS: { [key: string]: string } = {
  Food: '#FF6B6B',
  Bar: '#4ECDC4',
  Coffee: '#95E1D3',
  Activity: '#F38181',
  Shopping: '#AA96DA',
};

const CATEGORY_ICONS: { [key: string]: string } = {
  Food: 'restaurant',
  Bar: 'beer',
  Coffee: 'cafe',
  Activity: 'compass',
  Shopping: 'cart',
};

export default function SpotCard({
  spot,
  userLocation,
  onCreatePlan,
  onPress,
}: SpotCardProps) {
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getDistance = (): string | null => {
    if (!userLocation || !spot.latitude || !spot.longitude) return null;
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      spot.latitude,
      spot.longitude
    );

    if (distance < 1) {
      return `${(distance * 5280).toFixed(0)} ft`;
    }
    return `${distance.toFixed(1)} mi`;
  };

  const distance = getDistance();
  
  // Firebase stores category as lowercase: "bar", "food", "coffee"
  // Capitalize first letter for display and lookup
  const categoryCapitalized = spot.category 
    ? spot.category.charAt(0).toUpperCase() + spot.category.slice(1)
    : 'Activity';
  
  const categoryColor = CATEGORY_COLORS[categoryCapitalized] || COLORS.mediumGray;
  const categoryIcon = CATEGORY_ICONS[categoryCapitalized] || 'location';
  
  // Get primary photo
  const photoUrl = spot.photoURLs?.[0] || spot.photos?.[0];

  // Check if this spot has reviews from verified crew
  const hasVerifiedReviews = (spot.reviewCount || 0) > 0;

  return (
    <View style={styles.card}>
      {/* Spot Photo */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name={categoryIcon as any} size={48} color={COLORS.mediumGray} />
          </View>
        )}
      </TouchableOpacity>

      {/* Spot Details */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.details}>
          {/* Name and Rating */}
          <View style={styles.header}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {spot.name}
            </ThemedText>
            {(spot.rating || 0) > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color={COLORS.accent} />
                <ThemedText style={styles.rating}>
                  {spot.rating?.toFixed(1)}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Metadata */}
          <View style={styles.metadata}>
            {/* Category Badge */}
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
              <Ionicons name={categoryIcon as any} size={12} color={categoryColor} />
              <ThemedText style={[styles.categoryText, { color: categoryColor }]}>
                {categoryCapitalized}
              </ThemedText>
            </View>

            {/* Distance */}
            {distance && (
              <>
                <ThemedText style={styles.metadataSeparator}>•</ThemedText>
                <ThemedText style={styles.metadataText}>{distance}</ThemedText>
              </>
            )}

            {/* Verified Badge */}
            {hasVerifiedReviews && (
              <>
                <ThemedText style={styles.metadataSeparator}>•</ThemedText>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                  <ThemedText style={styles.verifiedText}>Crew Verified</ThemedText>
                </View>
              </>
            )}
          </View>

          {/* Reviews Count */}
          {(spot.reviewCount || 0) > 0 && (
            <ThemedText style={styles.reviewCount}>
              {spot.reviewCount} {spot.reviewCount === 1 ? 'review' : 'reviews'}
            </ThemedText>
          )}

          {/* Description Preview */}
          {spot.description && (
            <ThemedText style={styles.description} numberOfLines={2}>
              {spot.description}
            </ThemedText>
          )}
        </View>
      </TouchableOpacity>

      {/* Create Plan Button */}
      <TouchableOpacity
        style={styles.createPlanButton}
        onPress={onCreatePlan}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar" size={18} color={COLORS.white} />
        <ThemedText style={styles.createPlanText}>Create Plan Here</ThemedText>
        <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.lightGray,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metadataSeparator: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginHorizontal: 6,
  },
  metadataText: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  reviewCount: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.darkGray,
    lineHeight: 20,
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    gap: 8,
  },
  createPlanText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
