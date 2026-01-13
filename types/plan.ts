// types/plan.ts
export type PlanVisibility = 'public' | 'connections' | 'invite_only';
export type RSVPStatus = 'going' | 'interested' | 'not_going';
export type PlanStatus = 'active' | 'cancelled';

// New type for multi-stop plans
export interface Stop {
  id: string;
  spotId: string;
  spotName: string;
  spotAddress?: string;
  scheduledTime: any; // Firestore Timestamp
  duration?: number; // Minutes at this stop (optional)
  notes?: string; // Special notes for this stop
  order: number; // Display order (0, 1, 2, etc.)
}

export interface Plan {
  id: string;
  hostUserId: string;
  hostName: string;
  hostPhoto?: string;
  title: string;
  
  // Single-stop fields (now optional for backward compatibility)
  spotId?: string;
  spotName?: string;
  
  city: string;
  area?: string;
  scheduledTime: any; // Firestore Timestamp - for single-stop OR first stop time in multi-stop
  meetupLocation?: string;
  description?: string;
  visibility: PlanVisibility;
  attendeeIds: string[];
  attendeeCount: number;
  status: PlanStatus;
  
  // Multi-stop fields
  isMultiStop?: boolean; // Flag to indicate plan type
  stops?: Stop[]; // Array of stops for itinerary
  
  // Optional: Link to upcoming layover
  layoverId?: string;
  
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface PlanAttendee {
  userId: string;
  displayName: string;
  photoURL?: string;
  rsvpStatus: RSVPStatus;
  
  // For multi-stop plans
  allStops?: boolean; // True if attending all stops
  stopsAttending?: string[]; // Array of stop IDs they're joining
  
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
