// types/plan.ts
export type PlanVisibility = 'public' | 'connections';
export type RSVPStatus = 'going' | 'interested' | 'not_going';
export type PlanStatus = 'active' | 'cancelled';

export interface Plan {
  id: string;
  hostUserId: string;
  hostName: string;
  hostPhoto?: string;
  title: string;
  spotId: string;
  spotName: string;
  city: string;
  area?: string;
  scheduledTime: any; // Firestore Timestamp
  meetupLocation?: string;
  description?: string;
  visibility: PlanVisibility;
  attendeeIds: string[];
  attendeeCount: number;
  status: PlanStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface PlanAttendee {
  userId: string;
  displayName: string;
  photoURL?: string;
  rsvpStatus: RSVPStatus;
  joinedAt: any; // Firestore Timestamp
}

export interface CreatePlanInput {
  title: string;
  spotId: string;
  spotName: string;
  scheduledTime: Date;
  meetupLocation?: string;
  description?: string;
  visibility: PlanVisibility;
}