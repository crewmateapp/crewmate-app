// utils/migrateUserNames.ts
// ─────────────────────────────────────────────────────────────────────
// Backfills firstName, lastInitial, and displayName for users whose
// Firestore doc is missing those fields. Currently parses AA emails
// only (first.last@aa.com or first.middle.last@aa.com).
//
// Safe to run multiple times — only writes if the fields are missing.
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Domains where we're confident the email follows a first.last naming convention.
// Add more here as we learn other airlines' patterns.
const NAME_PARSEABLE_DOMAINS = ['aa.com'];

function deriveNameFromEmail(email: string): { firstName: string; lastInitial: string; displayName: string } | null {
  const [local, domain] = email.toLowerCase().split('@');
  if (!NAME_PARSEABLE_DOMAINS.includes(domain)) return null;

  const parts = local.split('.');
  if (parts.length < 2) return null;

  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();

  return {
    firstName,
    lastInitial,
    displayName: `${firstName} ${lastInitial}.`,
  };
}

export async function migrateUserNames(): Promise<void> {
  console.log('👤 Starting name migration...');

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));

    let fixed = 0;
    let skipped = 0;
    let noEmail = 0;
    let unparseable = 0;
    const details: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const data = userDoc.data();
      const email = data.email;

      if (!email) {
        noEmail++;
        continue;
      }

      // Already has a name — don't overwrite
      if (data.firstName && data.lastInitial) {
        skipped++;
        continue;
      }

      const derived = deriveNameFromEmail(email);

      if (!derived) {
        unparseable++;
        continue;
      }

      // Build the update — only set fields that are actually missing
      const updates: Record<string, string> = {};
      if (!data.firstName) updates.firstName = derived.firstName;
      if (!data.lastInitial) updates.lastInitial = derived.lastInitial;
      if (!data.displayName) updates.displayName = derived.displayName;

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      await updateDoc(doc(db, 'users', userDoc.id), updates);

      details.push(`  ${userDoc.id}: ${email} → ${derived.displayName} (set: ${Object.keys(updates).join(', ')})`);
      fixed++;
    }

    console.log('─────────────────────────────────');
    console.log('✅ Name migration complete');
    console.log(`   Fixed:       ${fixed}`);
    console.log(`   Skipped:     ${skipped}`);
    console.log(`   No email:    ${noEmail}`);
    console.log(`   Unparseable: ${unparseable}`);
    if (details.length > 0) {
      console.log('   Changes:');
      details.forEach(d => console.log(d));
    }
    console.log('─────────────────────────────────');
  } catch (error) {
    console.error('❌ Name migration failed:', error);
  }
}
