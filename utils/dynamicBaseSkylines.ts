/**
 * Dynamic Base Skylines System
 * 
 * Instead of hardcoding all cities, this system:
 * 1. Stores skylines in Firestore
 * 2. Auto-detects when a user registers with a new base
 * 3. Shows default until admin adds skyline
 * 4. Allows easy updates via admin panel
 */

import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export interface BaseSkyline {
  code: string;
  city: string;
  state: string;
  imageUrl: string;
  airlines: string[];
  addedAt?: Date;
  addedBy?: string;
}

/**
 * Default skyline for unknown bases
 */
const DEFAULT_SKYLINE: BaseSkyline = {
  code: 'DEFAULT',
  city: 'Aviation',
  state: 'USA',
  imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
  airlines: []
};

/**
 * Seed data - Start with the cities you've already added
 */
const SEED_SKYLINES: Record<string, BaseSkyline> = {
  CLT: {
    code: 'CLT',
    city: 'Charlotte',
    state: 'NC',
    imageUrl: 'https://images.unsplash.com/photo-1562762394-3acfba62a48e?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    airlines: ['American Airlines']
  },
  PHL: {
    code: 'PHL',
    city: 'Philadelphia',
    state: 'PA',
    imageUrl: 'https://plus.unsplash.com/premium_photo-1742457643727-88c1256fa378?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    airlines: ['American Airlines']
  },
};

/**
 * City name to airport code mapping
 */
const CITY_TO_CODE: Record<string, string> = {
  'charlotte': 'CLT',
  'philadelphia': 'PHL',
  'dallas': 'DFW',
  'chicago': 'ORD',
  'miami': 'MIA',
  'phoenix': 'PHX',
  'los angeles': 'LAX',
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
 * Normalize base code/name
 */
function normalizeBase(base: string): string {
  const upper = base.toUpperCase();
  if (upper.length === 3) return upper; // Already airport code
  
  const lower = base.toLowerCase().trim();
  return CITY_TO_CODE[lower] || upper;
}

/**
 * Get skyline from Firestore (with caching)
 */
const skylineCache = new Map<string, BaseSkyline>();

export async function getSkylineForBase(baseCode: string | undefined): Promise<BaseSkyline> {
  if (!baseCode) return DEFAULT_SKYLINE;
  
  const normalized = normalizeBase(baseCode);
  
  // Check cache first
  if (skylineCache.has(normalized)) {
    return skylineCache.get(normalized)!;
  }
  
  try {
    // Try Firestore
    const skylineDoc = await getDoc(doc(db, 'baseSkylines', normalized));
    
    if (skylineDoc.exists()) {
      const skyline = skylineDoc.data() as BaseSkyline;
      skylineCache.set(normalized, skyline);
      return skyline;
    }
    
    // Not found - track it for admin
    await trackMissingBase(normalized, baseCode);
    
    return DEFAULT_SKYLINE;
  } catch (error) {
    console.error('Error fetching skyline:', error);
    return DEFAULT_SKYLINE;
  }
}

/**
 * Track bases that need skylines added
 * Creates a "pending" record for admin to see
 */
async function trackMissingBase(code: string, originalBase: string) {
  try {
    const pendingRef = doc(db, 'pendingBaseSkylines', code);
    const existing = await getDoc(pendingRef);
    
    if (!existing.exists()) {
      await setDoc(pendingRef, {
        code,
        originalBase,
        requestCount: 1,
        firstRequestedAt: new Date(),
        lastRequestedAt: new Date(),
        status: 'pending',
      });
    } else {
      // Increment request count
      await setDoc(pendingRef, {
        ...existing.data(),
        requestCount: (existing.data().requestCount || 0) + 1,
        lastRequestedAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error tracking missing base:', error);
  }
}

/**
 * Admin function: Add a new skyline
 */
export async function addBaseSkyline(
  code: string, 
  city: string, 
  state: string, 
  imageUrl: string, 
  airlines: string[],
  adminId: string
): Promise<void> {
  const skyline: BaseSkyline = {
    code: code.toUpperCase(),
    city,
    state,
    imageUrl,
    airlines,
    addedAt: new Date(),
    addedBy: adminId,
  };
  
  await setDoc(doc(db, 'baseSkylines', code.toUpperCase()), skyline);
  
  // Remove from pending
  await setDoc(doc(db, 'pendingBaseSkylines', code.toUpperCase()), {
    status: 'completed',
    completedAt: new Date(),
  }, { merge: true });
  
  // Clear cache
  skylineCache.delete(code.toUpperCase());
}

/**
 * Admin function: Get all pending bases
 */
export async function getPendingBases(): Promise<any[]> {
  const pendingQuery = query(
    collection(db, 'pendingBaseSkylines'),
    where('status', '==', 'pending')
  );
  
  const snapshot = await getDocs(pendingQuery);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * One-time: Seed initial skylines from your existing data
 */
export async function seedInitialSkylines() {
  for (const [code, skyline] of Object.entries(SEED_SKYLINES)) {
    await setDoc(doc(db, 'baseSkylines', code), {
      ...skyline,
      addedAt: new Date(),
      addedBy: 'seed',
    });
  }
  console.log('✅ Seeded initial skylines');
}

/**
 * Usage in profile component:
 * 
 * const [skyline, setSkyline] = useState<BaseSkyline>(DEFAULT_SKYLINE);
 * 
 * useEffect(() => {
 *   getSkylineForBase(profile?.base).then(setSkyline);
 * }, [profile?.base]);
 */
