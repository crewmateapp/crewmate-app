// scripts/backfill-photos.js
// Simple script to add Google Places photos to spots without photos
// Run with: node scripts/backfill-photos.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
require('dotenv').config();

// Firebase config from your .env file
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

async function fetchPhoto(placeId, spotId) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!placeId || !apiKey) return null;

  try {
    // Get photo reference from Google Places
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.[0]) {
      console.log('   ⚠️  No photos available');
      return null;
    }

    // Fetch the actual photo
    const photoRef = detailsData.result.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoRef}&key=${apiKey}`;
    const photoRes = await fetch(photoUrl);
    
    if (!photoRes.ok) return null;

    // Upload to Firebase Storage
    const blob = await photoRes.blob();
    const storageRef = ref(storage, `spots/backfill/${spotId}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('   ❌ Error:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting backfill...\n');

  // Get all approved spots
  const q = query(collection(db, 'spots'), where('status', '==', 'approved'));
  const snapshot = await getDocs(q);
  
  console.log(`📦 Found ${snapshot.size} approved spots`);

  // Filter for spots that need photos
  const needPhotos = snapshot.docs.filter(d => {
    const data = d.data();
    const hasPhotos = data.photoURLs?.length > 0;
    const hasPlaceId = !!data.placeId;
    return !hasPhotos && hasPlaceId;
  });

  console.log(`📊 ${needPhotos.length} spots need photos\n`);

  if (needPhotos.length === 0) {
    console.log('✨ All set! No spots need photos.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needPhotos.length; i++) {
    const spotDoc = needPhotos[i];
    const data = spotDoc.data();
    
    console.log(`[${i + 1}/${needPhotos.length}] ${data.name} (${data.city})`);

    const photoURL = await fetchPhoto(data.placeId, spotDoc.id);

    if (photoURL) {
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: [photoURL] });
      success++;
      console.log('   ✅ Added photo!');
    } else {
      failed++;
      console.log('   ❌ Failed');
    }

    await new Promise(r => setTimeout(r, 1000)); // Rate limit delay
  }

  console.log(`\n📈 Done! Success: ${success}, Failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Error:', err);
    process.exit(1);
  });
