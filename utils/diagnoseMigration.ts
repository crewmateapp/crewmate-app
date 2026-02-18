// utils/diagnoseMigration.ts
// ─────────────────────────────────────────────────────────────────────
// DIAGNOSTIC — run this to see exactly what's in Firestore for every user.
// Drop it behind a super admin button, check the console output.
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getAirlineFromEmail } from '@/data/airlines';

export async function diagnoseMigration(): Promise<void> {
  console.log('🔍 Starting migration diagnosis...\n');

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));

    console.log(`Total Firestore user docs: ${usersSnapshot.size}\n`);
    console.log('─────────────────────────────────');

    for (const userDoc of usersSnapshot.docs) {
      const data = userDoc.data();
      const email = data.email || '(no email field)';
      const airline = data.airline || '(no airline field)';
      const firstName = data.firstName || '(no firstName)';
      const displayName = data.displayName || '(no displayName)';
      const base = data.base || '(no base)';

      // What SHOULD the airline be based on the email?
      const expectedAirline = data.email ? getAirlineFromEmail(data.email) : 'N/A — no email';
      const isCorrect = airline === expectedAirline;

      // Only log users that have a problem
      if (!isCorrect || !data.email || !data.airline || !data.firstName) {
        console.log(`📄 Doc ID: ${userDoc.id}`);
        console.log(`   Name:     "${firstName}" / displayName: "${displayName}"`);
        console.log(`   Email:    "${email}"`);
        console.log(`   Airline:  "${airline}"`);
        console.log(`   Expected: "${expectedAirline}"`);
        console.log(`   Base:     "${base}"`);
        console.log(`   Match:    ${isCorrect ? '✅' : '❌'}`);
        console.log(`   All keys: ${JSON.stringify(Object.keys(data))}`);
        console.log('');
      }
    }

    console.log('─────────────────────────────────');
    console.log('✅ Diagnosis complete. Only problem users shown above.');
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}
