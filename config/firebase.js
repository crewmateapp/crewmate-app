import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYcqfRRjgL2Rp_uXQKTajWATcfGS4wvFc",
  authDomain: "crewmate-4399c.firebaseapp.com",
  projectId: "crewmate-4399c",
  storageBucket: "crewmate-4399c.firebasestorage.app",
  messagingSenderId: "224833054920",
  appId: "1:224833054920:web:f748a0bb88f40a3daa1dfd"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with platform-specific persistence
let auth;
if (Platform.OS === 'web') {
  // For web, use default browser persistence
  auth = getAuth(app);
} else {
  // For native (iOS/Android), use AsyncStorage
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize functions with error handling
let functions;
try {
  functions = getFunctions(app);
  console.log('✅ Firebase Functions initialized');
} catch (error) {
  console.error('⚠️ Functions initialization error:', error);
  functions = null;
}

export { functions };
