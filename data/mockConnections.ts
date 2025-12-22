export type ConnectionRequest = {
  id: string;
  fromUserId: string;
  fromUser: {
    displayName: string;
    airline: string;
    photoURL?: string;
  };
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type Connection = {
  id: string;
  odisplayName: string;
  odisplayName: string;
  odisplayName: string;
  odisplayName: string;
  odisplayName: string;
  odisplayName: string;
  odisplayName: string;
  userId: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string;
  lastMessage?: string;
  lastMessageAt?: string;
};

// Mock incoming requests (people who want to connect with you)
export const mockIncomingRequests: ConnectionRequest[] = [
  {
    id: 'req1',
    fromUserId: 'mock1',
    fromUser: {
      displayName: 'Sarah M.',
      airline: 'Delta Air Lines',
    },
    toUserId: 'currentUser',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'req2',
    fromUserId: 'mock3',
    fromUser: {
      displayName: 'Jessica T.',
      airline: 'American Airlines',
    },
    toUserId: 'currentUser',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

// Mock accepted connections (your crew friends)
export const mockConnections: Connection[] = [
  {
    id: 'conn1',
    userId: 'mock2',
    displayName: 'Mike R.',
    airline: 'United Airlines',
    base: 'Chicago',
    lastMessage: 'Hey! Want to grab coffee later?',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  },
  {
    id: 'conn2',
    userId: 'mock5',
    displayName: 'Amanda K.',
    airline: 'JetBlue Airways',
    base: 'New York',
    lastMessage: 'That restaurant was amazing!',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
];