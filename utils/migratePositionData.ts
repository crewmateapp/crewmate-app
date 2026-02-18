// utils/migratePositionData.ts
// ─────────────────────────────────────────────────────────────────────
// Normalizes the position field for all users.
// Fixes casing variants like "flight attendant", "FLIGHT ATTENDANT" etc.
//
// Safe to run multiple times — only writes if the value doesn't match canonical.
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Canonical position values. These are what the app uses for display and filtering.
// The variant map below catches common casing/spelling differences and maps them here.
const POSITION_VARIANT_MAP: Record<string, string> = {
  // Flight Attendant variants
  'flight attendant': 'Flight Attendant',
  'flightattendant': 'Flight Attendant',
  'flight att': 'Flight Attendant',
  'fa': 'Flight Attendant',
  'cabin crew': 'Flight Attendant',

  // Pilot variants
  'pilot': 'Pilot',

  // Captain variants
  'captain': 'Captain',
  'capt': 'Captain',
  'capt.': 'Captain',

  // First Officer variants
  'first officer': 'First Officer',
  'fo': 'First Officer',
  'f.o.': 'First Officer',
  'first off': 'First Officer',
};

function resolvePosition(current: string): string | null {
  const normalized = current.trim().toLowerCase();
  return POSITION_VARIANT_MAP[normalized] || null;
}

export async function migratePositionData(): Promise<void> {
  console.log('🎯 Starting position migration...');

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));

    let fixed = 0;
    let skipped = 0;
    let noPosition = 0;
    const details: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const data = userDoc.data();
      const currentPosition = data.position || '';

      if (!currentPosition) {
        noPosition++;
        continue;
      }

      const resolved = resolvePosition(currentPosition);

      if (!resolved) {
        // Has a position but we don't recognize it — log it so we can add it later
        console.warn(`⚠️  Unrecognized position "${currentPosition}" for ${userDoc.id} (${data.displayName || 'no name'}) — skipping`);
        skipped++;
        continue;
      }

      if (resolved === currentPosition) {
        // Already canonical
        skipped++;
        continue;
      }

      await updateDoc(doc(db, 'users', userDoc.id), { position: resolved });
      details.push(`  ${userDoc.id}: "${currentPosition}" → "${resolved}" (${data.displayName || 'no name'})`);
      fixed++;
    }

    console.log('─────────────────────────────────');
    console.log('✅ Position migration complete');
    console.log(`   Fixed:       ${fixed}`);
    console.log(`   Skipped:     ${skipped}`);
    console.log(`   No position: ${noPosition}`);
    if (details.length > 0) {
      console.log('   Changes:');
      details.forEach(d => console.log(d));
    }
    console.log('─────────────────────────────────');
  } catch (error) {
    console.error('❌ Position migration failed:', error);
  }
}
