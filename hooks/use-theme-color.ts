// hooks/use-theme-color.ts
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Original hook for ThemedText/ThemedView components
 * Gets a specific color by name from the theme
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: string
) {
  const { colors, isDark } = useTheme();
  const theme = isDark ? 'dark' : 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    // Access color from the colors object
    return (colors as any)[colorName];
  }
}

/**
 * New simplified hook to get all theme colors
 * Returns the appropriate color scheme based on user preference from ThemeContext
 * 
 * Usage:
 * const colors = useColors();
 * backgroundColor: colors.background
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}
