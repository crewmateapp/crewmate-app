// scripts/backfill-spot-photos.js
// One-time script to add Google Places photos to existing spots without photos

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
require('dotenv').config();

// Your Firebase config
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

async function fetchAndUploadGooglePlacePhoto(placeId, spotId) {
  if (!placeId || !GOOGLE_PLACES_API_KEY) {
    console.log('Missing placeId or API key');
    return null;
  }

  try {
    // Get place details with photos
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
    );

    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.[0]) {
      console.log(`No photos available for placeId: ${placeId}`);
      return null;
    }

    const photoReference = detailsData.result.photos[0].photo_reference;

    // Fetch the photo
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const photoResponse = await fetch(photoUrl);
    
    if (!photoResponse.ok) {
      console.error(`Failed to fetch photo: ${photoResponse.status}`);
      return null;
    }

    // Convert to blob
    const photoBlob = await photoResponse.blob();

    // Upload to Firebase Storage
    const timestamp = Date.now();
    const photoRef = ref(storage, `spots/backfill/${spotId}_${timestamp}_google_places.jpg`);
    await uploadBytes(photoRef, photoBlob);

    // Get download URL
    const downloadURL = await getDownloadURL(photoRef);
    
    console.log(`✅ Successfully uploaded photo for spot ${spotId}`);
    return downloadURL;

  } catch (error) {
    console.error(`❌ Error fetching photo for spot ${spotId}:`, error);
    return null;
  }
}

async function backfillSpotPhotos() {
  console.log('🚀 Starting photo backfill...\n');

  try {
    // Query approved spots
    const spotsQuery = query(
      collection(db, 'spots'),
      where('status', '==', 'approved')
    );

    const snapshot = await getDocs(spotsQuery);
    
    // Filter for spots without photos and with a placeId
    const spotsToProcess = snapshot.docs.filter(doc => {
      const data = doc.data();
      const hasPhotos = data.photoURLs && data.photoURLs.length > 0;
      const hasPlaceId = data.placeId && data.placeId.trim() !== '';
      return !hasPhotos && hasPlaceId;
    });

    console.log(`📊 Found ${spotsToProcess.length} spots without photos that have placeIds\n`);

    if (spotsToProcess.length === 0) {
      console.log('✨ No spots need photo backfill!');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Process each spot
    for (let i = 0; i < spotsToProcess.length; i++) {
      const spotDoc = spotsToProcess[i];
      const spotData = spotDoc.data();
      const spotId = spotDoc.id;
      
      console.log(`\n[${i + 1}/${spotsToProcess.length}] Processing: ${spotData.name}`);
      console.log(`   City: ${spotData.city}`);
      console.log(`   PlaceId: ${spotData.placeId}`);

      // Fetch and upload photo
      const photoURL = await fetchAndUploadGooglePlacePhoto(spotData.placeId, spotId);

      if (photoURL) {
        // Update spot document with photo
        await updateDoc(doc(db, 'spots', spotId), {
          photoURLs: [photoURL],
        });
        successCount++;
        console.log(`   ✅ Photo added successfully!`);
      } else {
        failCount++;
        console.log(`   ❌ Could not add photo (place may not have photos)`);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n📈 SUMMARY:');
    console.log(`   Total processed: ${spotsToProcess.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n✨ Backfill complete!');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
  }
}

// Run the script
backfillSpotPhotos()
  .then(() => {
    console.log('\n🎉 Script finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
