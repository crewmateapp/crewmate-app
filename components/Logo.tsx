// components/Logo.tsx
import { Colors } from '@/constants/Colors';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'full' | 'icon';
}

const SIZES = {
  small: { width: 120, height: 40 },
  medium: { width: 180, height: 60 },
  large: { width: 240, height: 80 },
};

const ICON_SIZES = {
  small: 30,
  medium: 45,
  large: 60,
};

export default function Logo({ size = 'medium', variant = 'full' }: LogoProps) {
  const logoSource = variant === 'full' 
    ? require('../assets/images/crewmate-logo.png')
    : require('../assets/images/crewmate-icon.png');

  const dimensions = variant === 'full' 
    ? SIZES[size]
    : { width: ICON_SIZES[size], height: ICON_SIZES[size] };

  return (
    <View style={[styles.container, variant === 'full' && styles.fullLogoContainer]}>
      <Image 
        source={logoSource}
        style={[styles.logo, dimensions]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullLogoContainer: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
  },
  logo: {
    // Dimensions set dynamically
  },
});