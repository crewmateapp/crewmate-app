import {
  User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithCredential,
  OAuthProvider,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';
import { DEFAULT_ENGAGEMENT_FIELDS } from '../types/user';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Ensure Firestore user doc exists (for social sign-ins) ───────────
  const ensureUserDocument = async (firebaseUser: User) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // First-time social sign-in — create minimal user doc
      await setDoc(userRef, {
        email: firebaseUser.email?.toLowerCase() || '',
        createdAt: serverTimestamp(),
        emailVerified: true, // Social logins are inherently verified
        verifiedCrew: false, // Still needs airline verification
        onboardingComplete: false,
        currentLayover: null,
        upcomingLayovers: [],
        authProvider: firebaseUser.providerData?.[0]?.providerId || 'unknown',
        ...DEFAULT_ENGAGEMENT_FIELDS,
      });
    }
  };

  // ── Email/Password Sign Up (legacy — still works for existing users) ─
  const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const actionCodeSettings = {
      url: 'https://crewmate-4399c.firebaseapp.com/?emailVerified=true',
      handleCodeInApp: false,
      iOS: { bundleId: 'com.crewmate.app' },
      android: { packageName: 'com.crewmate.app', installApp: true },
    };

    await sendEmailVerification(userCredential.user, actionCodeSettings);

    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: email.toLowerCase(),
      createdAt: serverTimestamp(),
      emailVerified: false,
      verifiedCrew: true, // Email/password users verified via airline email domain
      verifiedAirline: email.split('@')[1]?.toLowerCase() || '',
      verifiedAt: serverTimestamp(),
      onboardingComplete: false,
      currentLayover: null,
      upcomingLayovers: [],
      authProvider: 'email',
      ...DEFAULT_ENGAGEMENT_FIELDS,
    });
  };

  // ── Email/Password Sign In ────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // ── Google Sign In ────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    try {
      // Import dynamically to avoid crash if package not installed
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      // Get the ID token
      const idToken = signInResult?.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      // Create Firebase credential and sign in
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, googleCredential);

      // Ensure Firestore user doc exists
      await ensureUserDocument(result.user);
    } catch (error: any) {
      console.error('Google Sign-In error:', error);

      // Handle specific error codes
      if (error.code === 'SIGN_IN_CANCELLED' || error.code === '12501') {
        // User cancelled — don't show error
        return;
      }
      throw error;
    }
  };

  // ── Apple Sign In ─────────────────────────────────────────────────────
  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      const AppleAuthentication = require('expo-apple-authentication');
      const Crypto = require('expo-crypto');

      // Generate nonce for security
      const rawNonce = Array.from(
        { length: 32 },
        () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[
          Math.floor(Math.random() * 62)
        ]
      ).join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      // Create Firebase OAuthProvider credential
      const oAuthProvider = new OAuthProvider('apple.com');
      const firebaseCredential = oAuthProvider.credential({
        idToken: credential.identityToken!,
        rawNonce: rawNonce,
      });

      const result = await signInWithCredential(auth, firebaseCredential);

      // Ensure Firestore user doc exists
      await ensureUserDocument(result.user);
    } catch (error: any) {
      console.error('Apple Sign-In error:', error);

      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled
        return;
      }
      throw error;
    }
  };

  // ── Sign Out ──────────────────────────────────────────────────────────
  const signOut = async () => {
    // Try to sign out of Google if applicable
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // Google Sign-In not available or not signed in — that's fine
    }

    await firebaseSignOut(auth);
  };

  // ── Send Verification Email ───────────────────────────────────────────
  const sendVerificationEmail = async () => {
    if (auth.currentUser) {
      const actionCodeSettings = {
        url: 'https://crewmate-4399c.firebaseapp.com/?emailVerified=true',
        handleCodeInApp: false,
        iOS: { bundleId: 'com.crewmate.app' },
        android: { packageName: 'com.crewmate.app', installApp: true },
      };
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
        sendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
