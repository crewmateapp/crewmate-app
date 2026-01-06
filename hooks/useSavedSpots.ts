// hooks/useSavedSpots.ts
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

export type SavedSpot = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  category: string;
  photoURL?: string;
  savedAt: any;
};

export function useSavedSpots() {
  const { user } = useAuth();
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [savedSpotIds, setSavedSpotIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSavedSpots([]);
      setSavedSpotIds(new Set());
      setLoading(false);
      return;
    }

    // Real-time listener for saved spots
    const savedSpotsRef = collection(db, 'users', user.uid, 'savedSpots');
    const q = query(savedSpotsRef, orderBy('savedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const spots: SavedSpot[] = [];
        const ids = new Set<string>();

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          spots.push({
            id: doc.id,
            spotId: data.spotId,
            spotName: data.spotName,
            city: data.city,
            category: data.category,
            photoURL: data.photoURL,
            savedAt: data.savedAt,
          });
          ids.add(data.spotId);
        });

        setSavedSpots(spots);
        setSavedSpotIds(ids);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching saved spots:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const isSaved = (spotId: string): boolean => {
    return savedSpotIds.has(spotId);
  };

  const saveSpot = async (spot: {
    spotId: string;
    spotName: string;
    city: string;
    category: string;
    photoURL?: string;
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      const savedSpotRef = doc(db, 'users', user.uid, 'savedSpots', spot.spotId);
      await setDoc(savedSpotRef, {
        spotId: spot.spotId,
        spotName: spot.spotName,
        city: spot.city,
        category: spot.category,
        photoURL: spot.photoURL || null,
        savedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Error saving spot:', error);
      return false;
    }
  };

  const unsaveSpot = async (spotId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const savedSpotRef = doc(db, 'users', user.uid, 'savedSpots', spotId);
      await deleteDoc(savedSpotRef);
      return true;
    } catch (error) {
      console.error('Error unsaving spot:', error);
      return false;
    }
  };

  const toggleSave = async (spot: {
    spotId: string;
    spotName: string;
    city: string;
    category: string;
    photoURL?: string;
  }): Promise<boolean> => {
    if (isSaved(spot.spotId)) {
      return await unsaveSpot(spot.spotId);
    } else {
      return await saveSpot(spot);
    }
  };

  return {
    savedSpots,
    savedSpotIds,
    loading,
    isSaved,
    saveSpot,
    unsaveSpot,
    toggleSave,
  };
}
