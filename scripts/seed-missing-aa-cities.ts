import 'dotenv/config';

// scripts/seed-missing-aa-cities.ts
// Adds the 33 AA layover cities that were missing from the initial seed
// Run AFTER seed-all-cities.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

const MISSING_CITIES: Record<string, { name: string; lat: number; lng: number; areas: string[] }> = {
  // US
  AMA: { name: 'Amarillo', lat: 35.2194, lng: -101.7059, areas: ['AMA Airport Area', 'Downtown', 'Route 66 District'] },
  AVP: { name: 'Scranton', lat: 41.3385, lng: -75.7234, areas: ['AVP Airport Area', 'Downtown', 'Downtown Scranton'] },
  BFL: { name: 'Bakersfield', lat: 35.4336, lng: -119.0568, areas: ['BFL Airport Area', 'Downtown'] },
  DAB: { name: 'Daytona Beach', lat: 29.1799, lng: -81.0581, areas: ['DAB Airport Area', 'Downtown', 'Boardwalk'] },
  ECP: { name: 'Panama City Beach', lat: 30.3571, lng: -85.7956, areas: ['ECP Airport Area', 'Downtown', 'Pier Park'] },
  EGE: { name: 'Eagle-Vail', lat: 39.6426, lng: -106.9176, areas: ['EGE Airport Area', 'Downtown', 'Vail', 'Beaver Creek'] },
  FSD: { name: 'Sioux Falls', lat: 43.5820, lng: -96.7419, areas: ['FSD Airport Area', 'Downtown'] },
  ILM: { name: 'Wilmington NC', lat: 34.2706, lng: -77.9026, areas: ['ILM Airport Area', 'Downtown', 'Riverwalk'] },
  LBB: { name: 'Lubbock', lat: 33.6636, lng: -101.8227, areas: ['LBB Airport Area', 'Downtown'] },
  MDT: { name: 'Harrisburg', lat: 40.1935, lng: -76.7634, areas: ['MDT Airport Area', 'Downtown'] },
  MFE: { name: 'McAllen', lat: 26.1758, lng: -98.2386, areas: ['MFE Airport Area', 'Downtown'] },
  MLB: { name: 'Melbourne FL', lat: 28.1028, lng: -80.6453, areas: ['MLB Airport Area', 'Downtown'] },
  MRY: { name: 'Monterey', lat: 36.5870, lng: -121.8430, areas: ['MRY Airport Area', 'Downtown', 'Cannery Row'] },
  MSN: { name: 'Madison', lat: 43.1399, lng: -89.3375, areas: ['MSN Airport Area', 'Downtown', 'Capitol Square'] },
  MSO: { name: 'Missoula', lat: 46.9163, lng: -114.0906, areas: ['MSO Airport Area', 'Downtown'] },
  MTJ: { name: 'Montrose', lat: 38.5098, lng: -107.8942, areas: ['MTJ Airport Area', 'Downtown', 'Telluride'] },
  NYC: { name: 'New York City', lat: 40.7128, lng: -74.0060, areas: ['NYC Airport Area', 'Downtown', 'Manhattan', 'Brooklyn', 'Times Square'] },
  ORF: { name: 'Norfolk', lat: 36.8946, lng: -76.2012, areas: ['ORF Airport Area', 'Downtown', 'Ghent'] },
  SBP: { name: 'San Luis Obispo', lat: 35.2368, lng: -120.6424, areas: ['SBP Airport Area', 'Downtown'] },
  VQQ: { name: 'Jacksonville NAS', lat: 30.2187, lng: -81.8767, areas: ['VQQ Airport Area', 'Downtown', 'Jacksonville'] },

  // Caribbean
  ANU: { name: 'Antigua', lat: 17.1367, lng: -61.7926, areas: ['ANU Airport Area', 'Downtown', 'St Johns', 'English Harbour'] },
  GND: { name: 'Grenada', lat: 12.0042, lng: -61.7862, areas: ['GND Airport Area', 'Downtown', "St George's"] },
  PBM: { name: 'Paramaribo', lat: 5.4528, lng: -55.1876, areas: ['PBM Airport Area', 'Downtown', 'Waterkant'] },
  SKB: { name: 'St Kitts', lat: 17.3112, lng: -62.7187, areas: ['SKB Airport Area', 'Downtown', 'Basseterre'] },
  STI: { name: 'Santiago DR', lat: 19.4061, lng: -70.6047, areas: ['STI Airport Area', 'Downtown', 'Monumento'] },
  SVD: { name: 'St Vincent', lat: 13.1568, lng: -61.1499, areas: ['SVD Airport Area', 'Downtown', 'Kingstown'] },

  // Mexico
  SLP: { name: 'San Luis Potosí', lat: 22.2543, lng: -100.9308, areas: ['SLP Airport Area', 'Downtown', 'Centro Historico'] },

  // Central America
  LIR: { name: 'Liberia CR', lat: 10.5933, lng: -85.5444, areas: ['LIR Airport Area', 'Downtown', 'Guanacaste', 'Papagayo'] },

  // South America
  BAQ: { name: 'Barranquilla', lat: 10.8896, lng: -74.7808, areas: ['BAQ Airport Area', 'Downtown', 'El Prado'] },
  GEO: { name: 'Georgetown', lat: 6.4985, lng: -58.2541, areas: ['GEO Airport Area', 'Downtown', 'Stabroek'] },

  // Europe
  BLQ: { name: 'Bologna', lat: 44.5354, lng: 11.2887, areas: ['BLQ Airport Area', 'Downtown', 'Piazza Maggiore', 'Quadrilatero'] },
  NAP: { name: 'Naples', lat: 40.8860, lng: 14.2908, areas: ['NAP Airport Area', 'Downtown', 'Spaccanapoli', 'Vomero'] },
  SNN: { name: 'Shannon', lat: 52.7020, lng: -8.9248, areas: ['SNN Airport Area', 'Downtown', 'Limerick', 'Ennis'] },
};

async function main() {
  console.log('✈️  Seeding 33 missing AA layover cities');
  console.log('=========================================\n');

  let added = 0;
  let skipped = 0;

  for (const [code, city] of Object.entries(MISSING_CITIES)) {
    const docRef = doc(db, 'cities', code);
    const existing = await getDoc(docRef);

    if (existing.exists()) {
      console.log(`⏭️  ${code} (${city.name}) already exists`);
      skipped++;
      continue;
    }

    await setDoc(docRef, {
      name: city.name,
      code,
      lat: city.lat,
      lng: city.lng,
      areas: city.areas,
      status: 'active',
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Added ${city.name} (${code})`);
    added++;
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`==========`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Newly added:     ${added}`);
}

main()
  .then(() => { console.log('\n✅ Done!'); process.exit(0); })
  .catch(err => { console.error('\n💥 Failed:', err); process.exit(1); });
