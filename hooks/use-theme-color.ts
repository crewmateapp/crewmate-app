// hooks/use-theme-color.ts
import { Colors } from '@/constants/theme';
import { useColorScheme } from './use-color-scheme';

/**
 * Original hook for ThemedText/ThemedView components
 * Gets a specific color by name from the theme
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

/**
 * New simplified hook to get all theme colors
 * Returns the appropriate color scheme based on system theme
 * 
 * Usage:
 * const colors = useColors();
 * backgroundColor: colors.background
 */
export function useColors() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
}
