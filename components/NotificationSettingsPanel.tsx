// components/NotificationSettingsPanel.tsx
// ─────────────────────────────────────────────────────────────────────
// The notification preferences UI. Each category has its own toggle,
// and there's a master on/off at the top that dims everything when off.
//
// Drop this anywhere in your existing settings or profile screen:
//
//   import NotificationSettingsPanel from '@/components/NotificationSettingsPanel';
//
//   <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
//     <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
//     <NotificationSettingsPanel />
//   </View>
//
// It loads preferences from Firestore on mount, and saves on every toggle
// change (debounced — no save button needed, it just works).
// ─────────────────────────────────────────────────────────────────────

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Switch,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import {
  NotificationCategory,
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/utils/notificationPreferences';

// ─── Category Display Config ─────────────────────────────────────────
// Defines how each category appears in the settings list.
// Order here = order on screen.

const CATEGORY_CONFIG: {
  key: NotificationCategory;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  {
    key: 'social',
    title: 'Connections & Messages',
    description: 'Connection requests, accepts, and new messages',
    icon: 'people',
    color: '#4A90D9',
  },
  {
    key: 'crewfies',
    title: 'Crewfie Activity',
    description: 'Likes and comments on your posts',
    icon: 'images',
    color: '#FF9500',
  },
  {
    key: 'plans',
    title: 'Plans',
    description: 'RSVPs, cancels, messages, and plan reminders',
    icon: 'calendar',
    color: '#8E44AD',
  },
  {
    key: 'spots',
    title: 'Spot & City Reviews',
    description: 'Updates on spots and cities you submitted',
    icon: 'location',
    color: '#34C759',
  },
  {
    key: 'nearby',
    title: 'Nearby Crew',
    description: 'When crew members are on a layover where you are',
    icon: 'location',
    color: '#4A90D9',
  },
  {
    key: 'badges',
    title: 'Badges',
    description: 'When you earn a new badge',
    icon: 'trophy',
    color: '#F5A623',
  },
];

// ─── Component ───────────────────────────────────────────────────────

export default function NotificationSettingsPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Debounce timer ref — saves 600ms after the last toggle change
  // so rapid taps don't spam Firestore
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load saved preferences on mount ────────────────────────────
  useEffect(() => {
    if (!user) return;

    (async () => {
      const saved = await getNotificationPreferences(user.uid);
      setPrefs(saved);
      setLoading(false);
    })();
  }, [user]);

  // ── Auto-save with debounce ────────────────────────────────────
  // Called after every toggle change. Waits 600ms of inactivity before
  // writing to Firestore, so if the user flips several toggles quickly
  // it only writes once.

  const scheduleSave = useCallback(
    (updatedPrefs: NotificationPreferences) => {
      if (!user) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        await saveNotificationPreferences(user.uid, updatedPrefs);
      }, 600);
    },
    [user]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Toggle handlers ────────────────────────────────────────────

  const toggleMaster = (value: boolean) => {
    const updated = { ...prefs, pushEnabled: value };
    setPrefs(updated);
    scheduleSave(updated);
  };

  const toggleCategory = (category: NotificationCategory, value: boolean) => {
    const updated = {
      ...prefs,
      categories: { ...prefs.categories, [category]: value },
    };
    setPrefs(updated);
    scheduleSave(updated);
  };

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Master toggle */}
      <View style={styles.masterRow}>
        <View style={styles.masterLeft}>
          <View style={[styles.masterIconBg, { backgroundColor: `${Colors.primary}1A` }]}>
            <Ionicons name="notifications" size={22} color={Colors.primary} />
          </View>
          <View style={styles.masterText}>
            <ThemedText style={styles.masterTitle}>Push Notifications</ThemedText>
            <ThemedText style={styles.masterDescription}>
              {prefs.pushEnabled ? 'Enabled' : 'All notifications are off'}
            </ThemedText>
          </View>
        </View>
        <Switch
          value={prefs.pushEnabled}
          onValueChange={toggleMaster}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.white}
          ios_backgroundColor={Colors.border}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Per-category toggles */}
      {CATEGORY_CONFIG.map((cat, index) => (
        <View key={cat.key}>
          <View
            style={[
              styles.categoryRow,
              !prefs.pushEnabled && styles.categoryRowDisabled,
            ]}
          >
            {/* Icon */}
            <View
              style={[
                styles.categoryIconBg,
                { backgroundColor: `${cat.color}1A` },
              ]}
            >
              <Ionicons name={cat.icon} size={20} color={cat.color} />
            </View>

            {/* Label */}
            <View style={styles.categoryText}>
              <ThemedText style={styles.categoryTitle}>{cat.title}</ThemedText>
              <ThemedText style={styles.categoryDescription}>
                {cat.description}
              </ThemedText>
            </View>

            {/* Toggle */}
            <Switch
              value={prefs.categories[cat.key]}
              onValueChange={(value) => toggleCategory(cat.key, value)}
              disabled={!prefs.pushEnabled}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.border}
            />
          </View>

          {/* Divider between categories (indented past icon) */}
          {index < CATEGORY_CONFIG.length - 1 && (
            <View style={styles.categoryDivider} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },

  // ── Master Toggle ──
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  masterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  masterIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  masterText: {
    flex: 1,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  masterDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // ── Dividers ──
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  categoryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 76, // indent past the 44px icon + 16px padding + 16px gap
  },

  // ── Category Rows ──
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryRowDisabled: {
    opacity: 0.35,
  },
  categoryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryText: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  categoryDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
