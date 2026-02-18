import 'dotenv/config';

// scripts/find-broken-cities.ts
// Finds cities with missing or zero lat/lng coordinates

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log('🔍 Finding cities with broken coordinates');
  console.log('==========================================\n');

  const citiesSnapshot = await getDocs(collection(db, 'cities'));
  
  let broken = 0;
  let good = 0;

  for (const doc of citiesSnapshot.docs) {
    const data = doc.data();
    const lat = data.lat;
    const lng = data.lng;
    const name = data.name || '(no name)';
    const code = data.code || '(no code)';

    if (!lat || !lng || lat === 0 || lng === 0) {
      console.log(`❌ ${name} (${code}) — lat: ${lat}, lng: ${lng}`);
      broken++;
    } else {
      good++;
    }
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`==========`);
  console.log(`Good:   ${good}`);
  console.log(`Broken: ${broken}`);
  console.log(`Total:  ${citiesSnapshot.size}`);
}

main()
  .then(() => { console.log('\n✅ Done!'); process.exit(0); })
  .catch(err => { console.error('\n💥 Failed:', err); process.exit(1); });
