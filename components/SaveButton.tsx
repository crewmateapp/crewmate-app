// components/SaveButton.tsx
import { useTheme } from '@/contexts/ThemeContext';
import { useSavedSpots } from '@/hooks/useSavedSpots';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type SaveButtonProps = {
  spot: {
    spotId: string;
    spotName: string;
    city: string;
    category: string;
    photoURL?: string;
  };
  size?: number;
  style?: any;
};

export function SaveButton({ spot, size = 24, style }: SaveButtonProps) {
  const { colors } = useTheme();
  const { isSaved, toggleSave } = useSavedSpots();
  const [saving, setSaving] = useState(false);

  const handleToggleSave = async () => {
    setSaving(true);
    await toggleSave(spot);
    setSaving(false);
  };

  const saved = isSaved(spot.spotId);

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handleToggleSave}
      disabled={saving}
    >
      {saving ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={size}
          color={saved ? colors.primary : colors.text.primary}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
