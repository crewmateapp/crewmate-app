// app/onboarding.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
};

const ONBOARDING_SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'airplane',
    iconColor: '#114878',
    title: 'Welcome to CrewMate!',
    description: 'The social discovery app built exclusively for verified airline crew members. Connect with fellow crew during layovers and discover the best spots in every city.',
  },
  {
    id: '2',
    icon: 'location',
    iconColor: '#F4C430',
    title: 'Discover Crew Spots',
    description: 'Find restaurants, bars, coffee shops, and activities recommended by other crew members. Real reviews from people who know the layover life.',
  },
  {
    id: '3',
    icon: 'people',
    iconColor: '#4CAF50',
    title: 'Connect During Layovers',
    description: 'Set your layover location and discover other crew nearby. Make plans, share recommendations, and turn layovers into adventures.',
  },
  {
    id: '4',
    icon: 'calendar',
    iconColor: '#FF6B6B',
    title: 'Create & Join Plans',
    description: 'Organize group meetups or join existing plans. Whether it\'s dinner, drinks, or exploring, find crew who want to do the same thing.',
  },
  {
    id: '5',
    icon: 'star',
    iconColor: '#F4C430',
    title: 'Share Your Favorites',
    description: 'Leave reviews, add photos, and recommend spots to help other crew. Build a community of trusted recommendations.',
  },
  {
    id: '6',
    icon: 'shield-checkmark',
    iconColor: '#114878',
    title: 'Built by Crew, for Crew',
    description: 'Your privacy matters. We verify all members with airline emails, and you control what others see. No random people, just verified crew.',
  },
];

export default function OnboardingScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem('onboarding_completed', 'true');
      
      // Update user document
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
        }, { merge: true });
      }

      // Navigate to profile setup or main app
      router.replace('/setup-profile');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      router.replace('/setup-profile');
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '20' }]}>
        <Ionicons name={item.icon as any} size={80} color={item.iconColor} />
      </View>
      <ThemedText style={styles.title}>{item.title}</ThemedText>
      <ThemedText style={[styles.description, { color: colors.text.secondary }]}>
        {item.description}
      </ThemedText>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {ONBOARDING_SLIDES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === currentIndex ? colors.primary : colors.border,
              width: index === currentIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Skip Button */}
      {currentIndex < ONBOARDING_SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <ThemedText style={[styles.skipText, { color: colors.text.secondary }]}>
            Skip
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {/* Dots Indicator */}
      {renderDots()}

      {/* Next/Get Started Button */}
      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: colors.primary }]}
        onPress={handleNext}
      >
        <ThemedText style={styles.nextButtonText}>
          {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </ThemedText>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 200,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
