/**
 * Base Skyline Coverage Analyzer
 * 
 * Checks which users have skylines available and which don't
 */

import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';

// City name to airport code mapping (built-in)
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

export interface BaseCoverage {
  base: string;
  hasSkyline: boolean;
  source: 'hardcoded' | 'firestore' | 'none';
  userCount: number;
  users: { id: string; name: string; email: string }[];
}

export interface CoverageReport {
  totalUsers: number;
  usersWithSkylines: number;
  usersWithoutSkylines: number;
  coveragePercent: number;
  basesWithSkylines: string[];
  basesWithoutSkylines: string[];
  baseDetails: BaseCoverage[];
}

/**
 * Analyze skyline coverage across all users
 */
export async function analyzeSkylineCoverage(): Promise<CoverageReport> {
  // Get all users
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Get all skylines from Firestore
  const skylinesSnapshot = await getDocs(collection(db, 'baseSkylines'));
  const firestoreSkylines = new Set(skylinesSnapshot.docs.map(doc => doc.id));

  // Group users by base
  const baseMap = new Map<string, BaseCoverage>();

  for (const user of users) {
    const rawBase = user.base as string | undefined;
    if (!rawBase) continue;

    // Normalize base code
    const normalizedBase = normalizeBase(rawBase);

    // Check if skyline exists in Firestore
    const hasSkyline = firestoreSkylines.has(normalizedBase);
    const source: 'hardcoded' | 'firestore' | 'none' = hasSkyline ? 'firestore' : 'none';

    // Add to map
    if (!baseMap.has(normalizedBase)) {
      baseMap.set(normalizedBase, {
        base: normalizedBase,
        hasSkyline,
        source,
        userCount: 0,
        users: []
      });
    }

    const coverage = baseMap.get(normalizedBase)!;
    coverage.userCount++;
    coverage.users.push({
      id: user.id,
      name: user.displayName || 'Unknown',
      email: user.email || 'No email'
    });
  }

  // Calculate statistics
  const baseDetails = Array.from(baseMap.values()).sort((a, b) => b.userCount - a.userCount);
  
  const usersWithSkylines = baseDetails
    .filter(b => b.hasSkyline)
    .reduce((sum, b) => sum + b.userCount, 0);
  
  const usersWithoutSkylines = baseDetails
    .filter(b => !b.hasSkyline)
    .reduce((sum, b) => sum + b.userCount, 0);

  const basesWithSkylines = baseDetails
    .filter(b => b.hasSkyline)
    .map(b => b.base);

  const basesWithoutSkylines = baseDetails
    .filter(b => !b.hasSkyline)
    .map(b => b.base);

  return {
    totalUsers: users.length,
    usersWithSkylines,
    usersWithoutSkylines,
    coveragePercent: users.length > 0 ? (usersWithSkylines / users.length) * 100 : 0,
    basesWithSkylines,
    basesWithoutSkylines,
    baseDetails
  };
}

/**
 * Normalize base code from city name or airport code
 */
function normalizeBase(base: string): string {
  const upper = base.toUpperCase();
  
  // If it's already 3 letters, assume it's an airport code
  if (upper.length === 3) return upper;
  
  // Try to map city name to code
  const lower = base.toLowerCase().trim();
  return CITY_TO_CODE[lower] || upper;
}

/**
 * Get priority list of bases to add (by user count)
 */
export function getPriorityBases(report: CoverageReport): BaseCoverage[] {
  return report.baseDetails
    .filter(b => !b.hasSkyline)
    .sort((a, b) => b.userCount - a.userCount);
}

/**
 * Format report for display
 */
export function formatCoverageReport(report: CoverageReport): string {
  let output = '📊 SKYLINE COVERAGE REPORT\n\n';
  
  output += `Total Users: ${report.totalUsers}\n`;
  output += `✅ With Skylines: ${report.usersWithSkylines} (${report.coveragePercent.toFixed(1)}%)\n`;
  output += `❌ Without Skylines: ${report.usersWithoutSkylines} (${(100 - report.coveragePercent).toFixed(1)}%)\n\n`;
  
  if (report.basesWithSkylines.length > 0) {
    output += '✅ BASES WITH SKYLINES:\n';
    report.baseDetails
      .filter(b => b.hasSkyline)
      .forEach(b => {
        output += `  • ${b.base} (${b.userCount} users, source: ${b.source})\n`;
      });
    output += '\n';
  }
  
  if (report.basesWithoutSkylines.length > 0) {
    output += '❌ BASES NEEDING SKYLINES:\n';
    report.baseDetails
      .filter(b => !b.hasSkyline)
      .forEach(b => {
        output += `  • ${b.base} (${b.userCount} users)\n`;
        b.users.forEach(u => {
          output += `      - ${u.name}\n`;
        });
      });
    output += '\n';
  }
  
  if (report.basesWithoutSkylines.length > 0) {
    output += '🎯 PRIORITY ORDER (add these first):\n';
    getPriorityBases(report).slice(0, 10).forEach((b, i) => {
      output += `  ${i + 1}. ${b.base} (${b.userCount} users waiting)\n`;
    });
  }
  
  return output;
}
