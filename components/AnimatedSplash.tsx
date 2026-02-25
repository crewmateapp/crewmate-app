// components/AnimatedSplash.tsx
// Animated splash screen: logo fades in + scales, tagline appears, then fades out
// Shows on app launch with a MINIMUM display time so branding is always visible

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Minimum time the splash stays visible (in ms) — even if the app loads instantly
const MIN_DISPLAY_TIME = 3500;

interface AnimatedSplashProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Track whether minimum time has elapsed
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTime = useRef(Date.now()).current;

  // Start minimum timer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_TIME);
    return () => clearTimeout(timer);
  }, []);

  // Phase 1: Animate in (logo + tagline)
  useEffect(() => {
    // Logo fades in and scales up (0 → 1.2s)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 25,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Hold for a beat, then tagline fades in (1.2s → 2.4s)
      setTimeout(() => {
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }, 400);
    });
  }, []);

  // Phase 2: Fade out ONLY when both conditions are met:
  // 1. App has finished loading (isReady)
  // 2. Minimum display time has passed (minTimeElapsed)
  useEffect(() => {
    if (!isReady || !minTimeElapsed) return;

    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 700,
      useNativeDriver: true,
    }).start(() => {
      onAnimationComplete();
    });
  }, [isReady, minTimeElapsed]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: overlayOpacity },
      ]}
      pointerEvents={isReady && minTimeElapsed ? 'none' : 'auto'}
    >
      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text
        style={[
          styles.tagline,
          { opacity: taglineOpacity },
        ]}
      >
        Built by Crew, For Crew
      </Animated.Text>

      {/* Subtle loading dots */}
      <Animated.View
        style={[
          styles.loadingContainer,
          { opacity: taglineOpacity },
        ]}
      >
        <LoadingDots />
      </Animated.View>
    </Animated.View>
  );
}

// Simple animated loading dots
function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);

    animations.start();
    return () => animations.stop();
  }, []);

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { opacity: dot },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B2E58',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  tagline: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600',
    color: '#D4A853',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: height * 0.12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4A853',
  },
});
