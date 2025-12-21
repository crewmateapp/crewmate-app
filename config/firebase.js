import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYcqfRRjgL2Rp_uXQKTajWATcfGS4wvFc",
  authDomain: "crewmate-4399c.firebaseapp.com",
  projectId: "crewmate-4399c",
  storageBucket: "crewmate-4399c.firebasestorage.app",
  messagingSenderId: "224833054920",
  appId: "1:224833054920:web:f748a0bb88f40a3daa1dfd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;