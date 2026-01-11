// scripts/backfill-photos-admin.js
// Uses Firebase Admin SDK to bypass authentication

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'crewmate-4399c.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

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

    console.log('   📤 Uploading to Firebase Storage...');

    // Upload to Firebase Storage
    const buffer = Buffer.from(await photoRes.arrayBuffer());
    const filename = `spots/backfill/${spotId}_${Date.now()}.jpg`;
    const file = bucket.file(filename);
    
    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: {
        metadata: {
          source: 'google-places-backfill'
        }
      }
    });

    // Make it publicly readable
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    return publicUrl;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting backfill with Admin SDK...\n');

  try {
    // Get all approved spots
    const snapshot = await db.collection('spots')
      .where('status', '==', 'approved')
      .get();
    
    console.log(`📦 Found ${snapshot.size} approved spots`);

    // Filter for spots that need photos
    const needPhotos = snapshot.docs.filter(doc => {
      const data = doc.data();
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
        console.log('   💾 Updating Firestore...');
        await spotDoc.ref.update({
          photoURLs: [photoURL]
        });
        success++;
        console.log('   ✅ Added photo!');
      } else {
        failed++;
        console.log('   ❌ Failed');
      }

      await new Promise(r => setTimeout(r, 1000)); // Rate limit delay
    }

    console.log(`\n📈 Done! Success: ${success}, Failed: ${failed}`);
  } catch (error) {
    console.error('💥 Error:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n🎉 Script finished!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Script failed:', err);
    process.exit(1);
  });
