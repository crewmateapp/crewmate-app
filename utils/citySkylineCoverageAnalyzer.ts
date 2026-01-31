/**
 * City Skyline Coverage Analyzer (Expanded)
 * 
 * Checks which cities have skylines and which don't
 * Covers: Base cities, layover cities, and all cities in the app
 */

import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface CityUsage {
  city: string;
  cityName: string;
  hasSkyline: boolean;
  source: 'skylines' | 'baseSkylines' | 'none';
  usageScore: number; // Combined score from bases + layovers
  baseUsers: number; // Users with this as their base
  layoverCount: number; // Active layovers in this city
  totalUsage: number; // baseUsers + layoverCount
  baseUserDetails: { id: string; name: string; email: string }[];
}

export interface CityCoverageReport {
  totalCities: number; // Total cities in cities collection
  citiesWithSkylines: number;
  citiesWithoutSkylines: number;
  coveragePercent: number;
  
  // User/layover stats
  totalUsers: number;
  usersWithSkylines: number;
  usersWithoutSkylines: number;
  userCoveragePercent: number;
  
  totalLayovers: number;
  layoversWithSkylines: number;
  
  // City lists
  citiesWithSkylines: string[];
  citiesWithoutSkylines: string[];
  
  // Detailed breakdown
  cityDetails: CityUsage[];
}

/**
 * Analyze skyline coverage across all cities
 */
export async function analyzeCitySkylineCoverage(): Promise<CityCoverageReport> {
  console.log('🔍 Starting comprehensive city skyline analysis...');
  
  // 1. Get all cities from cities collection
  console.log('📍 Fetching cities...');
  const citiesSnapshot = await getDocs(collection(db, 'cities'));
  const allCities = citiesSnapshot.docs.map(doc => ({
    code: doc.id,
    name: doc.data().name || doc.id,
  }));
  console.log(`Found ${allCities.length} cities in database`);
  
  // 2. Get all skylines (check both collections)
  console.log('🏙️ Fetching skylines...');
  const skylinesSnapshot = await getDocs(collection(db, 'skylines'));
  const skylines = new Set(skylinesSnapshot.docs.map(doc => doc.id));
  
  const baseSkylinesSnapshot = await getDocs(collection(db, 'baseSkylines'));
  const baseSkylines = new Set(baseSkylinesSnapshot.docs.map(doc => doc.id));
  console.log(`Found ${skylines.size} in skylines, ${baseSkylines.size} in baseSkylines`);
  
  // 3. Get all users and their bases
  console.log('👥 Fetching users...');
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`Found ${users.length} users`);
  
  // 4. Get all active layovers
  console.log('✈️ Fetching layovers...');
  const layoversSnapshot = await getDocs(collection(db, 'layovers'));
  const layovers = layoversSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`Found ${layovers.length} total layovers`);
  
  // Filter for active/future layovers only
  const now = new Date();
  const activeLayovers = layovers.filter(layover => {
    const endDate = layover.endDate?.toDate?.() || new Date(layover.endDate);
    return endDate >= now;
  });
  console.log(`${activeLayovers.length} active/future layovers`);
  
  // 5. Build city usage map
  const cityMap = new Map<string, CityUsage>();
  
  // Initialize all cities from cities collection
  for (const city of allCities) {
    const hasSkylineInNew = skylines.has(city.code);
    const hasSkylineInOld = baseSkylines.has(city.code);
    
    cityMap.set(city.code, {
      city: city.code,
      cityName: city.name,
      hasSkyline: hasSkylineInNew || hasSkylineInOld,
      source: hasSkylineInNew ? 'skylines' : hasSkylineInOld ? 'baseSkylines' : 'none',
      usageScore: 0,
      baseUsers: 0,
      layoverCount: 0,
      totalUsage: 0,
      baseUserDetails: []
    });
  }
  
  // 6. Count base users for each city
  for (const user of users) {
    const base = user.base as string | undefined;
    if (!base) continue;
    
    const normalizedBase = normalizeCode(base);
    
    // Create entry if city not in cities collection (shouldn't happen but handle it)
    if (!cityMap.has(normalizedBase)) {
      const hasSkylineInNew = skylines.has(normalizedBase);
      const hasSkylineInOld = baseSkylines.has(normalizedBase);
      
      cityMap.set(normalizedBase, {
        city: normalizedBase,
        cityName: normalizedBase,
        hasSkyline: hasSkylineInNew || hasSkylineInOld,
        source: hasSkylineInNew ? 'skylines' : hasSkylineInOld ? 'baseSkylines' : 'none',
        usageScore: 0,
        baseUsers: 0,
        layoverCount: 0,
        totalUsage: 0,
        baseUserDetails: []
      });
    }
    
    const cityUsage = cityMap.get(normalizedBase)!;
    cityUsage.baseUsers++;
    cityUsage.baseUserDetails.push({
      id: user.id,
      name: user.displayName || 'Unknown',
      email: user.email || 'No email'
    });
  }
  
  // 7. Count layovers for each city
  for (const layover of activeLayovers) {
    const city = layover.city as string | undefined;
    if (!city) continue;
    
    const normalizedCity = normalizeCode(city);
    
    if (cityMap.has(normalizedCity)) {
      cityMap.get(normalizedCity)!.layoverCount++;
    }
  }
  
  // 8. Calculate usage scores
  // Score = (baseUsers * 10) + layoverCount
  // Base users weighted more heavily than layovers
  for (const cityUsage of cityMap.values()) {
    cityUsage.usageScore = (cityUsage.baseUsers * 10) + cityUsage.layoverCount;
    cityUsage.totalUsage = cityUsage.baseUsers + cityUsage.layoverCount;
  }
  
  // 9. Calculate statistics
  const cityDetails = Array.from(cityMap.values())
    .sort((a, b) => b.usageScore - a.usageScore); // Sort by usage
  
  const citiesWithSkylines = cityDetails.filter(c => c.hasSkyline);
  const citiesWithoutSkylines = cityDetails.filter(c => !c.hasSkyline);
  
  const usersWithSkylines = cityDetails
    .filter(c => c.hasSkyline)
    .reduce((sum, c) => sum + c.baseUsers, 0);
  
  const usersWithoutSkylines = cityDetails
    .filter(c => !c.hasSkyline)
    .reduce((sum, c) => sum + c.baseUsers, 0);
  
  const layoversWithSkylines = cityDetails
    .filter(c => c.hasSkyline)
    .reduce((sum, c) => sum + c.layoverCount, 0);
  
  console.log('✅ Analysis complete!');
  
  return {
    totalCities: allCities.length,
    citiesWithSkylines: citiesWithSkylines.length,
    citiesWithoutSkylines: citiesWithoutSkylines.length,
    coveragePercent: allCities.length > 0 
      ? (citiesWithSkylines.length / allCities.length) * 100 
      : 0,
    
    totalUsers: users.length,
    usersWithSkylines,
    usersWithoutSkylines,
    userCoveragePercent: users.length > 0 
      ? (usersWithSkylines / users.length) * 100 
      : 0,
    
    totalLayovers: activeLayovers.length,
    layoversWithSkylines,
    
    citiesWithSkylines: citiesWithSkylines.map(c => c.city),
    citiesWithoutSkylines: citiesWithoutSkylines.map(c => c.city),
    
    cityDetails
  };
}

/**
 * Normalize city code
 */
function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Get priority list of cities to add (by usage score)
 */
export function getPriorityCities(report: CityCoverageReport): CityUsage[] {
  return report.cityDetails
    .filter(c => !c.hasSkyline && c.totalUsage > 0) // Only cities being used
    .sort((a, b) => b.usageScore - a.usageScore);
}

/**
 * Format report for display
 */
export function formatCityCoverageReport(report: CityCoverageReport): string {
  let output = '🏙️ CITY SKYLINE COVERAGE REPORT\n\n';
  
  // Overall city coverage
  output += '📊 OVERALL COVERAGE:\n';
  output += `Total Cities: ${report.totalCities}\n`;
  output += `✅ With Skylines: ${report.citiesWithSkylines} (${report.coveragePercent.toFixed(1)}%)\n`;
  output += `❌ Without Skylines: ${report.citiesWithoutSkylines} (${(100 - report.coveragePercent).toFixed(1)}%)\n\n`;
  
  // User coverage
  output += '👥 USER COVERAGE:\n';
  output += `Total Users: ${report.totalUsers}\n`;
  output += `✅ Users with skylines: ${report.usersWithSkylines} (${report.userCoveragePercent.toFixed(1)}%)\n`;
  output += `❌ Users without skylines: ${report.usersWithoutSkylines}\n\n`;
  
  // Layover coverage
  output += '✈️ LAYOVER COVERAGE:\n';
  output += `Total Active Layovers: ${report.totalLayovers}\n`;
  output += `✅ Layovers with skylines: ${report.layoversWithSkylines}\n`;
  output += `❌ Layovers without skylines: ${report.totalLayovers - report.layoversWithSkylines}\n\n`;
  
  // Cities with skylines
  if (report.citiesWithSkylines.length > 0) {
    output += '✅ CITIES WITH SKYLINES:\n';
    report.cityDetails
      .filter(c => c.hasSkyline && c.totalUsage > 0) // Only show used cities
      .slice(0, 20) // Top 20
      .forEach(c => {
        const usage = [];
        if (c.baseUsers > 0) usage.push(`${c.baseUsers} users`);
        if (c.layoverCount > 0) usage.push(`${c.layoverCount} layovers`);
        output += `  • ${c.city} - ${c.cityName} (${usage.join(', ')}, source: ${c.source})\n`;
      });
    output += '\n';
  }
  
  // Priority cities needing skylines
  const priorityCities = getPriorityCities(report);
  if (priorityCities.length > 0) {
    output += '🎯 CITIES NEEDING SKYLINES (Priority Order):\n';
    priorityCities.slice(0, 20).forEach((c, i) => {
      const usage = [];
      if (c.baseUsers > 0) usage.push(`${c.baseUsers} users`);
      if (c.layoverCount > 0) usage.push(`${c.layoverCount} layovers`);
      output += `  ${i + 1}. ${c.city} - ${c.cityName} (${usage.join(', ')})\n`;
      
      // Show base users for top priorities
      if (i < 10 && c.baseUserDetails.length > 0) {
        c.baseUserDetails.forEach(u => {
          output += `      - ${u.name}\n`;
        });
      }
    });
    output += '\n';
  }
  
  // Unused cities without skylines
  const unusedCities = report.cityDetails.filter(c => !c.hasSkyline && c.totalUsage === 0);
  if (unusedCities.length > 0) {
    output += `ℹ️ ${unusedCities.length} cities have no skylines but are also not currently used\n`;
    output += `   (Can add skylines for these later as needed)\n\n`;
  }
  
  return output;
}

/**
 * Get quick summary for UI display
 */
export function getCityCoverageSummary(report: CityCoverageReport): string {
  return `${report.citiesWithSkylines}/${report.totalCities} cities have skylines (${report.coveragePercent.toFixed(1)}%)\n` +
         `${report.usersWithSkylines}/${report.totalUsers} users covered (${report.userCoveragePercent.toFixed(1)}%)\n` +
         `${report.layoversWithSkylines}/${report.totalLayovers} active layovers covered`;
}
