/**
 * Base Skylines - Skyline images for airline crew bases
 * 
 * Maps airport codes to skyline images for profile hero sections.
 * Each major US airline base has a corresponding skyline image.
 */

export interface BaseSkyline {
  code: string;
  city: string;
  state: string;
  imageUrl: string;
  airlines: string[];
}

/**
 * Major US Airline Bases with Skyline Images
 * 
 * Sources for high-quality skyline images:
 * - Unsplash (free, high-quality)
 * - Pexels (free, high-quality)
 * - Custom assets (if needed)
 */
export const BASE_SKYLINES: Record<string, BaseSkyline> = {
  // American Airlines Hubs
  CLT: {
    code: 'CLT',
    city: 'Charlotte',
    state: 'NC',
    imageUrl: 'https://images.unsplash.com/photo-1562762394-3acfba62a48e?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Charlotte skyline
    airlines: ['American Airlines']
  },
  DFW: {
    code: 'DFW',
    city: 'Dallas',
    state: 'TX',
    imageUrl: 'https://images.unsplash.com/photo-1625950019503-cae6a7825762?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Dallas skyline
    airlines: ['American Airlines']
  },
  ORD: {
    code: 'ORD',
    city: 'Chicago',
    state: 'IL',
    imageUrl: 'https://plus.unsplash.com/premium_photo-1697729984771-daa8c31ecd1f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Chicago skyline
    airlines: ['American Airlines', 'United Airlines']
  },
  MIA: {
    code: 'MIA',
    city: 'Miami',
    state: 'FL',
    imageUrl: 'https://images.unsplash.com/photo-1605723517503-3cadb5818a0c?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Miami skyline
    airlines: ['American Airlines']
  },
  PHX: {
    code: 'PHX',
    city: 'Phoenix',
    state: 'AZ',
    imageUrl: 'https://images.unsplash.com/photo-1729041534038-fdc1f9cf3d3a?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Phoenix skyline
    airlines: ['American Airlines', 'Southwest Airlines']
  },
  LAX: {
    code: 'LAX',
    city: 'Los Angeles',
    state: 'CA',
    imageUrl: 'https://images.unsplash.com/flagged/photo-1575555201693-7cd442b8023f?q=80&w=1632&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // LA skyline
    airlines: ['American Airlines', 'Delta Air Lines', 'United Airlines']
  },
  PHL: {
    code: 'PHL',
    city: 'Philadelphia',
    state: 'PA',
    imageUrl: 'https://plus.unsplash.com/premium_photo-1742457643727-88c1256fa378?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Philly skyline
    airlines: ['American Airlines']
  },
  
  // Delta Hubs
  ATL: {
    code: 'ATL',
    city: 'Atlanta',
    state: 'GA',
    imageUrl: 'https://images.unsplash.com/photo-1663601460253-aba72eea6edf?q=80&w=1633&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Atlanta skyline
    airlines: ['Delta Air Lines']
  },
  MSP: {
    code: 'MSP',
    city: 'Minneapolis',
    state: 'MN',
    imageUrl: 'https://images.unsplash.com/photo-1643653186431-1e7b4c6ef7b5?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Minneapolis skyline
    airlines: ['Delta Air Lines']
  },
  DTW: {
    code: 'DTW',
    city: 'Detroit',
    state: 'MI',
    imageUrl: 'https://images.unsplash.com/photo-1568267938179-f50e67de5ffc?q=80&w=1193&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Detroit skyline
    airlines: ['Delta Air Lines']
  },
  SEA: {
    code: 'SEA',
    city: 'Seattle',
    state: 'WA',
    imageUrl: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?q=80&w=1726&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Seattle skyline
    airlines: ['Delta Air Lines', 'Alaska Airlines']
  },
  SLC: {
    code: 'SLC',
    city: 'Salt Lake City',
    state: 'UT',
    imageUrl: 'https://images.unsplash.com/photo-1621603933126-6c216db10045?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // SLC skyline
    airlines: ['Delta Air Lines']
  },
  
  // United Hubs
  IAH: {
    code: 'IAH',
    city: 'Houston',
    state: 'TX',
    imageUrl: 'https://images.unsplash.com/photo-1692154600992-463fa9b27abd?q=80&w=1633&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Houston skyline
    airlines: ['United Airlines']
  },
  EWR: {
    code: 'EWR',
    city: 'Newark',
    state: 'NJ',
    imageUrl: 'https://images.unsplash.com/photo-1546436836-07a91091f160?w=800&q=80', // NYC skyline
    airlines: ['United Airlines']
  },
  DEN: {
    code: 'DEN',
    city: 'Denver',
    state: 'CO',
    imageUrl: 'https://images.unsplash.com/photo-1619856699906-09e1f58c98b1?w=800&q=80', // Denver skyline
    airlines: ['United Airlines', 'Southwest Airlines']
  },
  SFO: {
    code: 'SFO',
    city: 'San Francisco',
    state: 'CA',
    imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80', // SF skyline
    airlines: ['United Airlines']
  },
  
  // Southwest Hubs
  DAL: {
    code: 'DAL',
    city: 'Dallas',
    state: 'TX',
    imageUrl: 'https://images.unsplash.com/photo-1583165775995-5e31e8d89ad1?w=800&q=80', // Dallas skyline
    airlines: ['Southwest Airlines']
  },
  BWI: {
    code: 'BWI',
    city: 'Baltimore',
    state: 'MD',
    imageUrl: 'https://images.unsplash.com/photo-1619031379591-e5c6e6e5b5f5?w=800&q=80', // Baltimore skyline
    airlines: ['Southwest Airlines']
  },
  MDW: {
    code: 'MDW',
    city: 'Chicago',
    state: 'IL',
    imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80', // Chicago skyline
    airlines: ['Southwest Airlines']
  },
  
  // JetBlue Hubs
  JFK: {
    code: 'JFK',
    city: 'New York',
    state: 'NY',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80', // NYC skyline
    airlines: ['JetBlue Airways']
  },
  BOS: {
    code: 'BOS',
    city: 'Boston',
    state: 'MA',
    imageUrl: 'https://images.unsplash.com/photo-1501621667575-af81f1f0bacc?w=800&q=80', // Boston skyline
    airlines: ['JetBlue Airways']
  },
  
  // Alaska Airlines Hubs
  PDX: {
    code: 'PDX',
    city: 'Portland',
    state: 'OR',
    imageUrl: 'https://images.unsplash.com/photo-1545561613-31c6f74f8d22?w=800&q=80', // Portland skyline
    airlines: ['Alaska Airlines']
  },
  
  // Spirit/Frontier
  FLL: {
    code: 'FLL',
    city: 'Fort Lauderdale',
    state: 'FL',
    imageUrl: 'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=800&q=80', // South Florida skyline
    airlines: ['Spirit Airlines', 'JetBlue Airways']
  },
  
  // Additional Major Cities
  SAN: {
    code: 'SAN',
    city: 'San Diego',
    state: 'CA',
    imageUrl: 'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&q=80', // San Diego skyline
    airlines: ['Southwest Airlines']
  },
  LAS: {
    code: 'LAS',
    city: 'Las Vegas',
    state: 'NV',
    imageUrl: 'https://images.unsplash.com/photo-1515859005217-8a1f08870f59?w=800&q=80', // Vegas skyline
    airlines: ['Southwest Airlines', 'Spirit Airlines']
  },
  MCO: {
    code: 'MCO',
    city: 'Orlando',
    state: 'FL',
    imageUrl: 'https://images.unsplash.com/photo-1616529735342-4cb3080c0c00?w=800&q=80', // Orlando skyline
    airlines: ['JetBlue Airways', 'Southwest Airlines']
  },
  AUS: {
    code: 'AUS',
    city: 'Austin',
    state: 'TX',
    imageUrl: 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?w=800&q=80', // Austin skyline
    airlines: ['Southwest Airlines']
  },
  MSY: {
    code: 'MSY',
    city: 'New Orleans',
    state: 'LA',
    imageUrl: 'https://images.unsplash.com/photo-1573924681963-e2cf62e0e2b0?w=800&q=80', // NOLA skyline
    airlines: ['Southwest Airlines']
  },
  BNA: {
    code: 'BNA',
    city: 'Nashville',
    state: 'TN',
    imageUrl: 'https://images.unsplash.com/photo-1557093793-e196ae071479?w=800&q=80', // Nashville skyline
    airlines: ['Southwest Airlines']
  },
  
  // Cargo/Other
  MEM: {
    code: 'MEM',
    city: 'Memphis',
    state: 'TN',
    imageUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80', // Memphis skyline
    airlines: ['FedEx']
  },
  SDF: {
    code: 'SDF',
    city: 'Louisville',
    state: 'KY',
    imageUrl: 'https://images.unsplash.com/photo-1606924490366-ae61c5b4db9e?w=800&q=80', // Louisville skyline
    airlines: ['UPS']
  },
};

/**
 * City name to airport code mapping
 * Handles cases where database has "Charlotte" instead of "CLT"
 */
const CITY_TO_CODE: Record<string, string> = {
  // Normalize to lowercase for matching
  'charlotte': 'CLT',
  'dallas': 'DFW',
  'chicago': 'ORD',
  'miami': 'MIA',
  'phoenix': 'PHX',
  'los angeles': 'LAX',
  'philadelphia': 'PHL',
  'atlanta': 'ATL',
  'minneapolis': 'MSP',
  'detroit': 'DTW',
  'seattle': 'SEA',
  'salt lake city': 'SLC',
  'houston': 'IAH',
  'newark': 'EWR',
  'denver': 'DEN',
  'san francisco': 'SFO',
  'baltimore': 'BWI',
  'new york': 'JFK',
  'boston': 'BOS',
  'portland': 'PDX',
  'fort lauderdale': 'FLL',
  'san diego': 'SAN',
  'las vegas': 'LAS',
  'orlando': 'MCO',
  'austin': 'AUS',
  'new orleans': 'MSY',
  'nashville': 'BNA',
  'memphis': 'MEM',
  'louisville': 'SDF',
};

/**
 * Default skyline for bases not in the list
 */
export const DEFAULT_SKYLINE = {
  code: 'DEFAULT',
  city: 'Aviation',
  state: 'USA',
  imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80', // Airplane/sky image
  airlines: []
};

/**
 * Get skyline data for a given base code OR city name
 * Handles both "CLT" and "Charlotte"
 */
export function getSkylineForBase(baseCode: string | undefined): BaseSkyline {
  if (!baseCode) return DEFAULT_SKYLINE;
  
  // Try as airport code first (uppercase)
  const upperCode = baseCode.toUpperCase();
  if (BASE_SKYLINES[upperCode]) {
    return BASE_SKYLINES[upperCode];
  }
  
  // Try as city name (lowercase, normalized)
  const lowerCity = baseCode.toLowerCase().trim();
  const mappedCode = CITY_TO_CODE[lowerCity];
  if (mappedCode && BASE_SKYLINES[mappedCode]) {
    return BASE_SKYLINES[mappedCode];
  }
  
  // Return default if no match
  return DEFAULT_SKYLINE;
}

/**
 * Get all bases for a specific airline
 */
export function getBasesForAirline(airline: string): BaseSkyline[] {
  return Object.values(BASE_SKYLINES).filter(base => 
    base.airlines.some(a => a.toLowerCase().includes(airline.toLowerCase()))
  );
}

/**
 * Check if a base code is valid
 */
export function isValidBase(baseCode: string): boolean {
  return baseCode.toUpperCase() in BASE_SKYLINES;
}
