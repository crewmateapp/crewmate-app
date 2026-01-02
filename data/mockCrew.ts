export type CrewMember = {
  id: string;
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  base: string;
  bio: string;
  photoURL?: string;
  currentLocation: {
    city: string;
    area: string;
  };
};

export const mockCrew: CrewMember[] = [
  {
    id: 'mock1',
    firstName: 'Sarah',
    lastInitial: 'M',
    displayName: 'Sarah M.',
    airline: 'Delta Air Lines',
    base: 'Atlanta',
    bio: 'Looking for coffee spots!',
    currentLocation: { city: 'New York', area: 'JFK Airport Area' },
  },
  {
    id: 'mock2',
    firstName: 'Mike',
    lastInitial: 'R',
    displayName: 'Mike R.',
    airline: 'United Airlines',
    base: 'Chicago',
    bio: 'Always down for good food',
    currentLocation: { city: 'New York', area: 'JFK Airport Area' },
  },
  {
    id: 'mock3',
    firstName: 'Jessica',
    lastInitial: 'T',
    displayName: 'Jessica T.',
    airline: 'American Airlines',
    base: 'Dallas–Fort Worth',
    bio: '10 year FA, love exploring new cities',
    currentLocation: { city: 'New York', area: 'LGA Airport Area' },
  },
  {
    id: 'mock4',
    firstName: 'Chris',
    lastInitial: 'B',
    displayName: 'Chris B.',
    airline: 'Southwest Airlines',
    base: 'Denver',
    bio: 'Gym and brunch enthusiast',
    currentLocation: { city: 'Los Angeles', area: 'LAX Airport Area' },
  },
  {
    id: 'mock5',
    firstName: 'Amanda',
    lastInitial: 'K',
    displayName: 'Amanda K.',
    airline: 'JetBlue Airways',
    base: 'New York',
    bio: 'NYC based, know all the spots!',
    currentLocation: { city: 'New York', area: 'JFK Airport Area' },
  },
  {
    id: 'mock6',
    firstName: 'David',
    lastInitial: 'L',
    displayName: 'David L.',
    airline: 'Alaska Airlines',
    base: 'Seattle',
    bio: 'First layover here, any suggestions?',
    currentLocation: { city: 'Charlotte', area: 'CLT Airport Area' },
  },
  {
    id: 'mock7',
    firstName: 'Emily',
    lastInitial: 'W',
    displayName: 'Emily W.',
    airline: 'Delta Air Lines',
    base: 'Los Angeles',
    bio: 'Vegan food finder',
    currentLocation: { city: 'Charlotte', area: 'CLT Airport Area' },
  },
];