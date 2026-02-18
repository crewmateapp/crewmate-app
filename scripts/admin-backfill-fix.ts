// ==========================================================================
// ADMIN.TSX FIX — Replace handleBackfillGooglePhotos function
// ==========================================================================
//
// In admin.tsx, find the handleBackfillGooglePhotos function (around line 1295)
// and replace the ENTIRE function with this version.
//
// WHAT CHANGED:
// - Instead of storing raw Google API URLs in Firestore (which trigger API
//   charges on every render), this version downloads the photo and uploads
//   it to Firebase Storage, then stores the Firebase URL.
// - Rate limit delay increased from 100ms to 500ms.
// - Added a storage import if not already present.
//
// MAKE SURE these imports exist at the top of admin.tsx:
//   import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
//   import { storage } from '@/config/firebase';
//
// Then replace the function:
// ==========================================================================

  const handleBackfillGooglePhotos = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      'Backfill Google Photos',
      'This will fetch photos from Google Places for all spots that:\n• Have a placeId (from Google Places)\n• Don\'t have any photos yet\n\nPhotos will be saved to Firebase Storage (no ongoing API costs).\n\nThis may take a few minutes depending on how many spots need photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Backfill',
          onPress: async () => {
            try {
              setBackfillingPhotos(true);
              setPhotoBackfillResult(null);

              const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
              
              if (!GOOGLE_PLACES_API_KEY) {
                Alert.alert('Error', 'Google Places API key not found in environment variables');
                return;
              }

              // Fetch all approved spots
              const spotsSnapshot = await getDocs(
                query(collection(db, 'spots'), where('status', '==', 'approved'))
              );

              const spotsNeedingPhotos: any[] = [];
              const spotsWithPhotos: any[] = [];
              const spotsWithoutPlaceId: any[] = [];

              // Categorize spots
              spotsSnapshot.docs.forEach((doc) => {
                const spot = doc.data();
                
                if (!spot.placeId) {
                  spotsWithoutPlaceId.push({ id: doc.id, name: spot.name });
                } else if (!spot.photoURLs || spot.photoURLs.length === 0) {
                  spotsNeedingPhotos.push({ id: doc.id, name: spot.name, placeId: spot.placeId });
                } else {
                  spotsWithPhotos.push({ id: doc.id, name: spot.name });
                }
              });

              console.log(`📊 Found ${spotsNeedingPhotos.length} spots needing photos`);

              let successCount = 0;
              let noPhotosAvailable = 0;
              let errorCount = 0;
              const errors: any[] = [];

              // Process each spot that needs photos
              for (let i = 0; i < spotsNeedingPhotos.length; i++) {
                const spot = spotsNeedingPhotos[i];
                
                try {
                  // Fetch place details with photos
                  const detailsResponse = await fetch(
                    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${spot.placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
                  );

                  const detailsData = await detailsResponse.json();

                  if (detailsData.status === 'OK' && detailsData.result?.photos && detailsData.result.photos.length > 0) {
                    // ============================================================
                    // FIX: Upload photos to Firebase Storage instead of storing
                    // raw Google API URLs. This means photo renders in the app
                    // will load from Firebase (free) instead of hitting the
                    // Google Places Photo API ($7/1,000 requests) every time.
                    // ============================================================
                    const firebasePhotoUrls: string[] = [];

                    // Process up to 3 photos
                    const photosToProcess = detailsData.result.photos.slice(0, 3);

                    for (let j = 0; j < photosToProcess.length; j++) {
                      const photo = photosToProcess[j];

                      try {
                        // Fetch the actual photo from Google
                        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                        const photoResponse = await fetch(photoApiUrl);

                        if (!photoResponse.ok) {
                          console.warn(`   ⚠️ Failed to fetch photo ${j + 1} for ${spot.name}`);
                          continue;
                        }

                        // Upload to Firebase Storage
                        const blob = await photoResponse.blob();
                        const timestamp = Date.now();
                        const storageRef = ref(
                          storage,
                          `spots/backfill/${spot.id}_${j}_${timestamp}.jpg`
                        );
                        await uploadBytes(storageRef, blob);
                        const downloadUrl = await getDownloadURL(storageRef);

                        firebasePhotoUrls.push(downloadUrl);
                      } catch (photoError) {
                        console.warn(`   ⚠️ Error uploading photo ${j + 1}:`, photoError);
                      }
                    }

                    if (firebasePhotoUrls.length > 0) {
                      // Update spot with Firebase Storage URLs (NOT Google API URLs)
                      await updateDoc(doc(db, 'spots', spot.id), {
                        photoURLs: firebasePhotoUrls
                      });

                      successCount++;
                      console.log(`✅ ${i + 1}/${spotsNeedingPhotos.length} - Added ${firebasePhotoUrls.length} photos to ${spot.name}`);
                    } else {
                      noPhotosAvailable++;
                      console.log(`⚠️ ${i + 1}/${spotsNeedingPhotos.length} - Photos found but upload failed for ${spot.name}`);
                    }
                  } else {
                    noPhotosAvailable++;
                    console.log(`⚠️ ${i + 1}/${spotsNeedingPhotos.length} - No photos available for ${spot.name}`);
                  }

                  // Rate limit delay (increased from 100ms to 500ms)
                  await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error: any) {
                  errorCount++;
                  errors.push({ name: spot.name, error: error.message });
                  console.error(`❌ Error processing ${spot.name}:`, error);
                }
              }

              // Show results
              setPhotoBackfillResult({
                totalSpots: spotsSnapshot.docs.length,
                spotsNeedingPhotos: spotsNeedingPhotos.length,
                spotsWithPhotos: spotsWithPhotos.length,
                spotsWithoutPlaceId: spotsWithoutPlaceId.length,
                successCount,
                noPhotosAvailable,
                errorCount,
                errors
              });

              Alert.alert(
                'Backfill Complete!',
                `Successfully added photos to ${successCount} spots!\n\n` +
                `• Total spots: ${spotsSnapshot.docs.length}\n` +
                `• Already had photos: ${spotsWithPhotos.length}\n` +
                `• Photos added: ${successCount}\n` +
                `• No photos available: ${noPhotosAvailable}\n` +
                `• Errors: ${errorCount}\n` +
                `• No Place ID: ${spotsWithoutPlaceId.length}`
              );

            } catch (error: any) {
              console.error('Error backfilling photos:', error);
              Alert.alert('Error', error.message || 'Failed to backfill photos');
            } finally {
              setBackfillingPhotos(false);
            }
          }
        }
      ]
    );
  };
