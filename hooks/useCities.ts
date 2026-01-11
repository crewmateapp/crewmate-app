// hooks/useCities.ts - Hook to load cities from Firestore
import { db } from '@/config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export type City = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  areas: string[];
  status?: string;
  createdAt?: any;
};

export const useCities = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'cities'),
      (snapshot) => {
        const citiesList: City[] = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as City))
          .filter(city => city.status === 'active' || !city.status) // Only active cities
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setCities(citiesList);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading cities:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { cities, loading, error };
};

// Helper function to get city by code
export const getCityByCode = (cities: City[], code: string): City | undefined => {
  return cities.find(city => city.code.toUpperCase() === code.toUpperCase());
};

// Helper function to get all areas for a city
export const getCityAreas = (cities: City[], code: string): string[] => {
  const city = getCityByCode(cities, code);
  return city?.areas || [];
};
