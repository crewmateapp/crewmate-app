// hooks/useAdminRole.ts
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export type AdminRole = 'super' | 'city' | null;

type AdminStatus = {
  role: AdminRole;
  cities: string[];
  loading: boolean;
};

export function useAdminRole(): AdminStatus {
  const { user } = useAuth();
  const [role, setRole] = useState<AdminRole>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setRole(null);
      setCities([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRole(data.adminRole || null);
        setCities(data.adminCities || []);
      } else {
        setRole(null);
        setCities([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { role, cities, loading };
}

// Helper functions
export function isAdmin(role: AdminRole): boolean {
  return role === 'super' || role === 'city';
}

export function isSuperAdmin(role: AdminRole): boolean {
  return role === 'super';
}

export function canManageCity(role: AdminRole, cities: string[], city: string): boolean {
  if (role === 'super') return true;
  if (role === 'city') return cities.includes(city);
  return false;
}
