// utils/googlePlacesPhoto.ts
// Helper functions for fetching photos from Google Places API

import { storage } from '@/config/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

interface PlacePhotoResponse {
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}

/**
 * Fetches a photo from Google Places API and uploads it to Firebase Storage
 * @param placeId - Google Place ID from the autocomplete
 * @param userId - User ID for storage path
 * @returns Firebase Storage download URL or null if failed
 */
export async function fetchAndUploadGooglePlacePhoto(
  placeId: string,
  userId: string
): Promise<string | null> {
  if (!placeId || !GOOGLE_PLACES_API_KEY || !userId) {
    console.log('Missing required params for photo fetch');
    return null;
  }

  try {
    // Step 1: Get place details with photos field
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
    );

    const detailsData: { result?: PlacePhotoResponse; status: string } = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.[0]) {
      console.log('No photos available for this place');
      return null;
    }

    const photoReference = detailsData.result.photos[0].photo_reference;

    // Step 2: Fetch the actual photo (max width 1600px for good quality)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const photoResponse = await fetch(photoUrl);
    
    if (!photoResponse.ok) {
      console.error('Failed to fetch photo:', photoResponse.status);
      return null;
    }

    // Step 3: Convert to blob
    const photoBlob = await photoResponse.blob();

    // Step 4: Upload to Firebase Storage
    const timestamp = Date.now();
    const photoRef = ref(storage, `spots/${userId}/${timestamp}_google_places.jpg`);
    await uploadBytes(photoRef, photoBlob);

    // Step 5: Get download URL
    const downloadURL = await getDownloadURL(photoRef);
    
    console.log('Successfully fetched and uploaded Google Places photo');
    return downloadURL;

  } catch (error) {
    console.error('Error fetching/uploading Google Places photo:', error);
    return null;
  }
}

/**
 * Alternative: Get photo URL without uploading to Firebase
 * Use this if you want to store the Google photo reference instead
 */
export function getGooglePlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 1600
): string {
  if (!photoReference || !GOOGLE_PLACES_API_KEY) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}
