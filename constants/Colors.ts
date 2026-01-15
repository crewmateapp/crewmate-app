// constants/Colors.ts

export const LightColors = {
  // Brand Colors
  primary: '#114878',
  accent: '#F4C430',
  
  // Backgrounds
  background: '#F5F7FA',
  card: '#FFFFFF',
  
  // Text
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
    inverse: '#FFFFFF', // For text on dark backgrounds
  },
  
  // UI Elements
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
  
  // Status Colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Special
  white: '#FFFFFF',
  black: '#000000',
};

export const DarkColors = {
  // Brand Colors (slightly adjusted for dark mode)
  primary: '#4A9EFF', // Lighter blue for visibility
  accent: '#F4C430',
  
  // Backgrounds
  background: '#0F172A', // Dark blue-gray
  card: '#1E293B',       // Lighter dark for cards
  
  // Text
  text: {
    primary: '#F1F5F9',    // Light text
    secondary: '#94A3B8',  // Gray text
    disabled: '#64748B',   // Disabled state
    inverse: '#1A1A1A',    // For text on light backgrounds
  },
  
  // UI Elements
  border: '#334155',
  borderDark: '#475569',
  
  // Status Colors (adjusted for dark backgrounds)
  success: '#22C55E',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  
  // Special
  white: '#FFFFFF',
  black: '#000000',
};

// Theme-structured export for theme system (used by hooks)
export const ThemeColors = {
  light: LightColors,
  dark: DarkColors,
};

// Main export - backwards compatible (always light mode for now)
// Components will continue to work, but won't be theme-aware
// TODO: Migrate components to use useColors() hook for theme support
export const Colors = LightColors;
