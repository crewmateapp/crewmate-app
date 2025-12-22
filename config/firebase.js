import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Initialize Auth with AsyncStorage for persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);