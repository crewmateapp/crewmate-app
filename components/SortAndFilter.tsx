import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
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

type SortOption = 'rating' | 'distance' | 'reviews' | 'newest';

type FilterSettings = {
  minRating: number;
  maxDistance: number;
  openNow: boolean;
};

type SortAndFilterProps = {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filters: FilterSettings;
  onFiltersChange: (filters: FilterSettings) => void;
};

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'rating', label: 'Highest Rated', icon: 'star' },
  { value: 'distance', label: 'Nearest', icon: 'navigate' },
  { value: 'reviews', label: 'Most Reviews', icon: 'chatbubbles' },
  { value: 'newest', label: 'Newest', icon: 'time' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'All Ratings' },
  { value: 3, label: '3+ Stars' },
  { value: 4, label: '4+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
];

const DISTANCE_OPTIONS = [
  { value: 50, label: 'Any Distance' },
  { value: 1, label: 'Within 1 mile' },
  { value: 3, label: 'Within 3 miles' },
  { value: 5, label: 'Within 5 miles' },
  { value: 10, label: 'Within 10 miles' },
];

export default function SortAndFilter({
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
}: SortAndFilterProps) {
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilters, setTempFilters] = useState<FilterSettings>(filters);

  const currentSortLabel = SORT_OPTIONS.find(opt => opt.value === sortBy)?.label || 'Sort';

  const hasActiveFilters = filters.minRating > 0 || filters.maxDistance < 50 || filters.openNow;

  const handleApplyFilters = () => {
    onFiltersChange(tempFilters);
    setShowFilterModal(false);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      minRating: 0,
      maxDistance: 50,
      openNow: false,
    };
    setTempFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  return (
    <View style={styles.container}>
      {/* Sort Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowSortModal(true)}
      >
        <Ionicons name="swap-vertical" size={18} color={COLORS.darkGray} />
        <ThemedText style={styles.buttonText}>{currentSortLabel}</ThemedText>
        <Ionicons name="chevron-down" size={18} color={COLORS.mediumGray} />
      </TouchableOpacity>

      {/* Filter Button */}
      <TouchableOpacity
        style={[styles.button, hasActiveFilters && styles.buttonActive]}
        onPress={() => {
          setTempFilters(filters);
          setShowFilterModal(true);
        }}
      >
        <Ionicons
          name="filter"
          size={18}
          color={hasActiveFilters ? COLORS.white : COLORS.darkGray}
        />
        <ThemedText
          style={[
            styles.buttonText,
            hasActiveFilters && styles.buttonTextActive,
          ]}
        >
          Filter
        </ThemedText>
        {hasActiveFilters && (
          <View style={styles.filterBadge}>
            <ThemedText style={styles.filterBadgeText}>•</ThemedText>
          </View>
        )}
      </TouchableOpacity>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModal}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Sort By</ThemedText>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.sortOption}
                onPress={() => {
                  onSortChange(option.value);
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={sortBy === option.value ? COLORS.primary : COLORS.mediumGray}
                />
                <ThemedText
                  style={[
                    styles.sortOptionText,
                    sortBy === option.value && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </ThemedText>
                {sortBy === option.value && (
                  <Ionicons name="checkmark" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.filterModalContainer}>
          {/* Header */}
          <View style={styles.filterHeader}>
            <TouchableOpacity onPress={handleResetFilters}>
              <ThemedText style={styles.resetButton}>Reset</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.filterTitle}>Filters</ThemedText>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={28} color={COLORS.darkGray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            {/* Minimum Rating */}
            <View style={styles.filterSection}>
              <ThemedText style={styles.filterSectionTitle}>Minimum Rating</ThemedText>
              {RATING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() =>
                    setTempFilters({ ...tempFilters, minRating: option.value })
                  }
                >
                  <ThemedText style={styles.filterOptionText}>{option.label}</ThemedText>
                  {tempFilters.minRating === option.value && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Maximum Distance */}
            <View style={styles.filterSection}>
              <ThemedText style={styles.filterSectionTitle}>Maximum Distance</ThemedText>
              <ThemedText style={styles.filterSectionSubtitle}>
                Distance from your current location or hotel
              </ThemedText>
              {DISTANCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.filterOption}
                  onPress={() =>
                    setTempFilters({ ...tempFilters, maxDistance: option.value })
                  }
                >
                  <ThemedText style={styles.filterOptionText}>{option.label}</ThemedText>
                  {tempFilters.maxDistance === option.value && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Open Now (Placeholder - needs hours data) */}
            <View style={styles.filterSection}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <ThemedText style={styles.filterSectionTitle}>Open Now</ThemedText>
                  <ThemedText style={styles.filterSectionSubtitle}>
                    Coming soon - needs hours data
                  </ThemedText>
                </View>
                <Switch
                  value={tempFilters.openNow}
                  onValueChange={(value) =>
                    setTempFilters({ ...tempFilters, openNow: value })
                  }
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
                  thumbColor={tempFilters.openNow ? COLORS.primary : COLORS.white}
                  disabled
                />
              </View>
            </View>
          </ScrollView>

          {/* Apply Button */}
          <View style={styles.filterFooter}>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyFilters}
            >
              <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    gap: 6,
  },
  buttonActive: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  buttonTextActive: {
    color: COLORS.white,
  },
  filterBadge: {
    marginLeft: -2,
  },
  filterBadgeText: {
    fontSize: 20,
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkGray,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  sortOptionTextActive: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterModalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resetButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkGray,
  },
  filterContent: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  filterSectionSubtitle: {
    fontSize: 13,
    color: COLORS.mediumGray,
    marginBottom: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  filterOptionText: {
    fontSize: 16,
    color: COLORS.darkGray,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
  },
  filterFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
