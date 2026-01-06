// hooks/useOnboardingCheck.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';

/**
 * Hook to check if user needs to see onboarding
 * Returns: { needsOnboarding, loading }
 */
export function useOnboardingCheck(userId: string | undefined) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkOnboarding();
  }, [userId]);

  const checkOnboarding = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Check AsyncStorage first (faster)
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      
      if (onboardingCompleted === 'true') {
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      // Check Firestore for onboarding status
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // If onboarding is completed in Firestore but not in AsyncStorage, sync it
        if (userData.onboardingCompleted) {
          await AsyncStorage.setItem('onboarding_completed', 'true');
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      } else {
        // New user, needs onboarding
        setNeedsOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(false); // Default to not showing on error
    } finally {
      setLoading(false);
    }
  };

  return { needsOnboarding, loading };
}

/**
 * Function to redirect to onboarding if needed
 * Call this in your root layout or authentication flow
 */
export async function redirectToOnboardingIfNeeded(userId: string) {
  try {
    // Check AsyncStorage
    const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
    
    if (onboardingCompleted === 'true') {
      return false; // No redirect needed
    }

    // Check Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (!userData.onboardingCompleted) {
        router.replace('/onboarding');
        return true; // Redirected
      } else {
        // Sync AsyncStorage
        await AsyncStorage.setItem('onboarding_completed', 'true');
        return false;
      }
    } else {
      // New user
      router.replace('/onboarding');
      return true;
    }
  } catch (error) {
    console.error('Error checking onboarding:', error);
    return false;
  }
}
