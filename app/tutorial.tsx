// app/tutorial.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TutorialStep = {
  id: number;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  actionText: string;
  actionIcon: string;
  action: () => void;
  skipable: boolean;
};

export default function TutorialScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      icon: 'location',
      iconColor: '#114878',
      title: 'Set Your Layover',
      description: 'To let other crew know where you are, go to the Home tab and tap "Set Layover Location". This helps you discover crew nearby and get personalized spot recommendations for your city.',
      actionText: 'Got It, Next Step',
      actionIcon: 'checkmark-circle',
      action: () => {
        handleNext();
      },
      skipable: true,
    },
    {
      id: 2,
      icon: 'compass',
      iconColor: '#F4C430',
      title: 'Explore Crew Spots',
      description: 'Tap the Explore tab at the bottom to browse spots. Search for any city, filter by category (Food, Bar, Coffee, etc.), and read reviews from other crew members.',
      actionText: 'Got It, Next Step',
      actionIcon: 'checkmark-circle',
      action: () => {
        handleNext();
      },
      skipable: true,
    },
    {
      id: 3,
      icon: 'people',
      iconColor: '#4CAF50',
      title: 'Connect With Crew',
      description: 'Go to the Connections tab to see crew members on layover in your city. Send connection requests, chat with crew, and make plans together.',
      actionText: 'Got It, Next Step',
      actionIcon: 'checkmark-circle',
      action: () => {
        handleNext();
      },
      skipable: true,
    },
    {
      id: 4,
      icon: 'calendar',
      iconColor: '#FF6B6B',
      title: 'Create Plans',
      description: 'Found something fun to do? Create a plan in the Plans tab! Other crew in your city can join, and you can organize group meetups for dinner, drinks, or exploring.',
      actionText: 'Got It, Next Step',
      actionIcon: 'checkmark-circle',
      action: () => {
        handleNext();
      },
      skipable: true,
    },
    {
      id: 5,
      icon: 'star',
      iconColor: '#F4C430',
      title: 'Share Your Experience',
      description: 'When you visit a spot, leave a review! Your feedback helps other crew discover great places. Tap any spot card and hit "Write Review" to share your thoughts.',
      actionText: 'Got It, Next Step',
      actionIcon: 'checkmark-circle',
      action: () => {
        handleNext();
      },
      skipable: true,
    },
    {
      id: 6,
      icon: 'checkmark-circle',
      iconColor: '#4CAF50',
      title: 'You\'re All Set!',
      description: 'You now know how to use CrewMate! Remember: this app is built by crew, for crew. Be respectful, stay safe, and enjoy connecting with fellow crew members. Happy layovering! ✈️',
      actionText: 'Start Using CrewMate',
      actionIcon: 'rocket',
      action: async () => {
        await completeTutorial();
      },
      skipable: false,
    },
  ];

  const currentStepData = tutorialSteps[currentStep];

  const completeTutorial = async () => {
    try {
      await AsyncStorage.setItem('tutorial_completed', 'true');
      
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          tutorialCompleted: true,
          tutorialCompletedAt: new Date(),
        }, { merge: true });
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing tutorial:', error);
      router.replace('/(tabs)');
    }
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = async () => {
    await completeTutorial();
  };

  const handleAction = () => {
    currentStepData.action();
  };

  return (
    <ThemedView style={styles.container}>
      {/* Skip Button */}
      {currentStepData.skipable && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <ThemedText style={[styles.skipText, { color: colors.text.secondary }]}>
            Skip Tutorial
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${((currentStep + 1) / tutorialSteps.length) * 100}%`,
              },
            ]}
          />
        </View>
        <ThemedText style={[styles.progressText, { color: colors.text.secondary }]}>
          Step {currentStep + 1} of {tutorialSteps.length}
        </ThemedText>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: currentStepData.iconColor + '20' },
          ]}
        >
          <Ionicons
            name={currentStepData.icon as any}
            size={80}
            color={currentStepData.iconColor}
          />
        </View>

        {/* Title */}
        <ThemedText style={styles.title}>{currentStepData.title}</ThemedText>

        {/* Description */}
        <ThemedText style={[styles.description, { color: colors.text.secondary }]}>
          {currentStepData.description}
        </ThemedText>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentStepData.iconColor }]}
          onPress={handleAction}
        >
          <Ionicons name={currentStepData.actionIcon as any} size={24} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>
            {currentStepData.actionText}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Step Dots */}
      <View style={styles.dotsContainer}>
        {tutorialSteps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentStep ? colors.primary : colors.border,
                width: index === currentStep ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>
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
  progressContainer: {
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
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
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
