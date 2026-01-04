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
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Determine actual theme based on mode
  const actualTheme = themeMode === 'auto' 
    ? (systemColorScheme || 'light')
    : themeMode;

  const isDark = actualTheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const setTheme = async (theme: ThemeMode) => {
    try {
      await AsyncStorage.setItem('theme', theme);
      setThemeMode(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: themeMode,
        colors,
        isDark,
        isLight: !isDark,
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
