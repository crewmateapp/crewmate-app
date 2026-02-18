// utils/migrateAirlineData.ts
// ─────────────────────────────────────────────────────────────────────
// Airline field normalization — safe to run multiple times.
//
// Two-pass approach:
//   Pass 1 (email-based): For users WITH an email, derive the correct
//           airline from the domain and overwrite if wrong.
//   Pass 2 (variant-based): For users WITHOUT an email, check if their
//           airline field is a known variant/typo of a real airline name
//           and normalize it. Handles seeded/test users who were inserted
//           directly into Firestore without Auth accounts.
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAirlineFromEmail, airlineNames } from '@/data/airlines';

// Map of lowercase variant → correct canonical name.
// Covers abbreviations, casing differences, and common typos.
const airlineVariantMap: Record<string, string> = {};

// Build the variant map from the canonical airline names
Object.values(airlineNames).forEach((canonical) => {
  // lowercase of the full name → canonical (catches "american airlines", "AMERICAN AIRLINES", etc.)
  airlineVariantMap[canonical.toLowerCase()] = canonical;
});

// Manual abbreviation mappings
airlineVariantMap['aa'] = 'American Airlines';
airlineVariantMap['american'] = 'American Airlines';
airlineVariantMap['delta'] = 'Delta Air Lines';
airlineVariantMap['united'] = 'United Airlines';
airlineVariantMap['ua'] = 'United Airlines';
airlineVariantMap['dl'] = 'Delta Air Lines';
airlineVariantMap['sw'] = 'Southwest Airlines';
airlineVariantMap['southwest'] = 'Southwest Airlines';
airlineVariantMap['alaska'] = 'Alaska Airlines';
airlineVariantMap['as'] = 'Alaska Airlines';
airlineVariantMap['jetblue'] = 'JetBlue Airways';
airlineVariantMap['b6'] = 'JetBlue Airways';
airlineVariantMap['spirit'] = 'Spirit Airlines';
airlineVariantMap['nk'] = 'Spirit Airlines';
airlineVariantMap['frontier'] = 'Frontier Airlines';
airlineVariantMap['f9'] = 'Frontier Airlines';
airlineVariantMap['hawaiian'] = 'Hawaiian Airlines';
airlineVariantMap['ha'] = 'Hawaiian Airlines';
airlineVariantMap['allegiant'] = 'Allegiant Air';
airlineVariantMap['g4'] = 'Allegiant Air';
airlineVariantMap['sun country'] = 'Sun Country Airlines';
airlineVariantMap['breeze'] = 'Breeze Airways';

function resolveAirlineVariant(current: string): string | null {
  const normalized = current.trim().toLowerCase();
  return airlineVariantMap[normalized] || null;
}

export async function migrateAirlineData(): Promise<void> {
  console.log('🛫 Starting airline migration...');

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));

    let fixedByEmail = 0;
    let fixedByVariant = 0;
    let skipped = 0;
    let noEmailNoVariant = 0;
    const details: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const data = userDoc.data();
      const currentAirline = data.airline || '';
      const email = data.email;

      // ── PASS 1: Email-based derivation ──
      if (email) {
        const correctAirline = getAirlineFromEmail(email);

        if (correctAirline === 'Airline') {
          // Unrecognized domain — can't derive, but still try variant pass below
          console.warn(`⚠️  Unrecognized domain for ${email} — trying variant pass`);
        } else if (currentAirline === correctAirline) {
          skipped++;
          continue;
        } else {
          // Fix via email
          await updateDoc(doc(db, 'users', userDoc.id), { airline: correctAirline });
          details.push(`  [email] ${userDoc.id}: "${currentAirline || '(empty)'}" → "${correctAirline}" (${email})`);
          fixedByEmail++;
          continue;
        }
      }

      // ── PASS 2: Variant normalization (no email, or unrecognized domain) ──
      if (!currentAirline) {
        // No airline at all and no email — nothing we can do
        noEmailNoVariant++;
        continue;
      }

      const resolved = resolveAirlineVariant(currentAirline);

      if (!resolved) {
        // Has an airline value but we don't recognize it as a variant
        console.warn(`⚠️  Can't resolve airline "${currentAirline}" for ${userDoc.id} — skipping`);
        skipped++;
        continue;
      }

      if (resolved === currentAirline) {
        // Already canonical
        skipped++;
        continue;
      }

      // Fix via variant normalization
      await updateDoc(doc(db, 'users', userDoc.id), { airline: resolved });
      details.push(`  [variant] ${userDoc.id}: "${currentAirline}" → "${resolved}" (${data.displayName || 'no name'})`);
      fixedByVariant++;
    }

    console.log('─────────────────────────────────');
    console.log('✅ Airline migration complete');
    console.log(`   Fixed by email:   ${fixedByEmail}`);
    console.log(`   Fixed by variant: ${fixedByVariant}`);
    console.log(`   Skipped:          ${skipped}`);
    console.log(`   No email + no airline: ${noEmailNoVariant}`);
    if (details.length > 0) {
      console.log('   Changes:');
      details.forEach(d => console.log(d));
    }
    console.log('─────────────────────────────────');
  } catch (error) {
    console.error('❌ Airline migration failed:', error);
  }
}
