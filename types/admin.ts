// types/admin.ts

export type AdminRole = 'super' | 'city' | null;

export type AdminUser = {
  odiserId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  adminRole: AdminRole;
  adminCities?: string[]; // Only for city admins
};

export type RemovalRequest = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
};
