import 'dotenv/config';

// scripts/fix-spot-cities.ts
// Checks every spot's coordinates against the cities collection
// and fixes any that don't match (e.g., "Redondo Beach" → "Los Angeles")

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log('🔧 Fix Spot Cities — Coordinate Matching');
  console.log('=========================================\n');

  // Load cities
  const citiesSnapshot = await getDocs(collection(db, 'cities'));
  const cities = citiesSnapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(c => c.lat && c.lng);
  console.log(`📍 Loaded ${cities.length} cities with coordinates\n`);

  // Load spots
  const spotsSnapshot = await getDocs(collection(db, 'spots'));
  console.log(`📦 Found ${spotsSnapshot.size} total spots\n`);

  let fixed = 0;
  let noCoords = 0;
  let alreadyCorrect = 0;
  let noMatch = 0;

  for (const spotDoc of spotsSnapshot.docs) {
    const data = spotDoc.data();
    const spotLat = data.latitude;
    const spotLng = data.longitude;
    const currentCity = data.city || '';

    if (!spotLat || !spotLng) {
      noCoords++;
      continue;
    }

    // Check if current city matches a city in the database
    const exactMatch = cities.find((c: any) => c.name.toLowerCase() === currentCity.toLowerCase());
    if (exactMatch) {
      alreadyCorrect++;
      continue;
    }

    // Find nearest city by coordinates
    let nearest: { name: string; distance: number } | null = null;
    for (const city of cities) {
      const dist = getDistance(spotLat, spotLng, city.lat, city.lng);
      if (dist < 80 && (!nearest || dist < nearest.distance)) {
        nearest = { name: city.name, distance: dist };
      }
    }

    if (nearest) {
      console.log(`✏️  ${data.name}`);
      console.log(`   "${currentCity}" → "${nearest.name}" (${nearest.distance.toFixed(1)}km away)`);
      await updateDoc(doc(db, 'spots', spotDoc.id), { city: nearest.name });
      fixed++;
    } else {
      console.log(`⚠️  ${data.name} — "${currentCity}" — no matching city within 80km`);
      noMatch++;
    }
  }

  console.log('\n📊 SUMMARY');
  console.log('==========');
  console.log(`Already correct:   ${alreadyCorrect}`);
  console.log(`Fixed:             ${fixed}`);
  console.log(`No coordinates:    ${noCoords}`);
  console.log(`No match found:    ${noMatch}`);
}

main()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Failed:', err);
    process.exit(1);
  });
