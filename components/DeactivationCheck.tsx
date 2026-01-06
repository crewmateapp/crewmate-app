// components/DeactivationCheck.tsx
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

/**
 * DeactivationCheck Component
 * 
 * This component checks if the current user's account is deactivated.
 * If deactivated, it redirects them to the reactivation screen.
 * 
 * Place this component in your root layout (_layout.tsx) so it runs on every app load.
 */
export function DeactivationCheck() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Listen to user document for deactivation status
    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // If account is deactivated, redirect to reactivation screen
        if (userData.deactivated === true) {
          router.replace('/reactivate');
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  return null; // This component doesn't render anything
}
