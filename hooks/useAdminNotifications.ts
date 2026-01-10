// hooks/useAdminNotifications.ts
// Hook to count pending admin items for notification badges

import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

type AdminCounts = {
  pendingSpots: number;
  reports: number;
  removalRequests: number;
  cityRequests: number;
  total: number;
};

export function useAdminNotifications() {
  const { user } = useAuth();
  const { role, cities, loading: roleLoading } = useAdminRole();
  const [counts, setCounts] = useState<AdminCounts>({
    pendingSpots: 0,
    reports: 0,
    removalRequests: 0,
    cityRequests: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || roleLoading) return;
    
    // Not an admin - no notifications
    if (!isAdmin(role)) {
      setLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Helper to filter by city for city admins
    const filterByCity = (items: any[]): any[] => {
      if (isSuperAdmin(role)) return items;
      if (!cities || cities.length === 0) return [];
      return items.filter(item => cities.includes(item.city || ''));
    };

    // Listen for pending spots
    const spotsQuery = query(
      collection(db, 'spots'),
      where('status', '==', 'pending')
    );
    unsubscribes.push(
      onSnapshot(spotsQuery, (snapshot) => {
        const spots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = filterByCity(spots);
        setCounts(prev => {
          const newCounts = { ...prev, pendingSpots: filtered.length };
          newCounts.total = newCounts.pendingSpots + newCounts.reports + newCounts.removalRequests + newCounts.cityRequests;
          return newCounts;
        });
      })
    );

    // Listen for reports
    const reportsQuery = collection(db, 'spotReports');
    unsubscribes.push(
      onSnapshot(reportsQuery, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = filterByCity(reports);
        setCounts(prev => {
          const newCounts = { ...prev, reports: filtered.length };
          newCounts.total = newCounts.pendingSpots + newCounts.reports + newCounts.removalRequests + newCounts.cityRequests;
          return newCounts;
        });
      })
    );

    // Listen for removal requests
    const removalsQuery = query(
      collection(db, 'deleteRequests'),
      where('status', '==', 'pending')
    );
    unsubscribes.push(
      onSnapshot(removalsQuery, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = filterByCity(requests);
        setCounts(prev => {
          const newCounts = { ...prev, removalRequests: filtered.length };
          newCounts.total = newCounts.pendingSpots + newCounts.reports + newCounts.removalRequests + newCounts.cityRequests;
          return newCounts;
        });
      })
    );

    // Listen for city requests (super admin only)
    if (isSuperAdmin(role)) {
      const cityRequestsQuery = query(
        collection(db, 'cityRequests'),
        where('status', '==', 'pending')
      );
      unsubscribes.push(
        onSnapshot(cityRequestsQuery, (snapshot) => {
          setCounts(prev => {
            const newCounts = { ...prev, cityRequests: snapshot.size };
            newCounts.total = newCounts.pendingSpots + newCounts.reports + newCounts.removalRequests + newCounts.cityRequests;
            return newCounts;
          });
        })
      );
    }

    setLoading(false);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, role, cities, roleLoading]);

  return { counts, loading, isAdmin: isAdmin(role) };
}
