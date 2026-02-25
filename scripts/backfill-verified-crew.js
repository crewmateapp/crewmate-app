// scripts/backfill-verified-crew.js
// Run from project root: node scripts/backfill-verified-crew.js
//
// Sets verifiedCrew: true for all existing users who signed up
// with an airline email domain. Safe to run multiple times.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with your service account
const serviceAccount = require('../service-account.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Known airline email domains (same list your app uses)
const AIRLINE_DOMAINS = [
  'aa.com', 'jetblue.com', 'united.com', 'delta.com',
  'southwest.com', 'wnco.com', 'spirit.com', 'frontier.com',
  'allegiantair.com', 'hawaiianair.com', 'alaskaair.com',
  'skywest.com', 'envoyair.com', 'piedmont-airlines.com',
  'psa-airlines.com', 'mesaair.com', 'rjet.com',
  'gojetairlines.com', 'airwis.com', 'commutair.com',
  'horizonair.com', 'flyrepublic.com', 'endeavorair.com',
  // Add any others from your airlines.ts data file
];

function isAirlineDomain(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return AIRLINE_DOMAINS.includes(domain);
}

async function backfillVerifiedCrew() {
  console.log('🔍 Fetching all users...');
  const usersSnapshot = await db.collection('users').get();
  console.log(`📊 Found ${usersSnapshot.size} users total`);

  let updated = 0;
  let skipped = 0;
  let alreadySet = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();

    // Already has verifiedCrew set — skip
    if (data.verifiedCrew !== undefined) {
      alreadySet++;
      continue;
    }

    const email = data.email || '';
    
    if (isAirlineDomain(email)) {
      const domain = email.split('@')[1]?.toLowerCase();
      
      batch.update(userDoc.ref, {
        verifiedCrew: true,
        verifiedAirline: domain,
        verifiedAt: new Date(),
        authProvider: 'email',
      });

      console.log(`  ✅ ${userDoc.id} — ${email} → verified (${domain})`);
      updated++;
      batchCount++;

      // Firestore batches max at 500
      if (batchCount >= 450) {
        await batch.commit();
        console.log(`  💾 Committed batch of ${batchCount}`);
        batchCount = 0;
      }
    } else {
      skipped++;
      console.log(`  ⏭️  ${userDoc.id} — ${email} → skipped (not airline domain)`);
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('\n══════════════════════════════════');
  console.log(`✅ Updated:     ${updated}`);
  console.log(`⏭️  Skipped:     ${skipped}`);
  console.log(`🔄 Already set: ${alreadySet}`);
  console.log(`📊 Total:       ${usersSnapshot.size}`);
  console.log('══════════════════════════════════');
}

backfillVerifiedCrew()
  .then(() => {
    console.log('\n🎉 Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
