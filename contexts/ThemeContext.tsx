// contexts/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors } from '@/constants/Colors';

type ThemeMode = 'light' | 'dark' | 'auto';

type ThemeContextType = {
  theme: ThemeMode;
  colors: typeof LightColors;
  isDark: boolean;
  isLight: boolean;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // TEMPORARY: Force light mode only
  // Dark mode disabled until post-alpha
  const themeMode: ThemeMode = 'light';
  const isDark = false;
  const colors = LightColors;

  const setTheme = async (theme: ThemeMode) => {
    // No-op for now - theme switching disabled
    console.log('Theme switching disabled - light mode only');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: themeMode,
        colors,
        isDark,
        isLight: true,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
