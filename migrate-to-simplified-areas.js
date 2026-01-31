// Migration Script: Simplify Areas
// Run this ONCE to update all existing spots and layovers
// 
// Usage: node migrate-to-simplified-areas.js
//
// This script will:
// 1. Update all spots to use "Airport Area" or "City-wide"
// 2. Update all layovers to use simplified areas
// 3. Add default layover length to existing layovers

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); // Your Firebase service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Helper function to determine simplified area
function getSimplifiedArea(area) {
  if (!area) return 'City-wide';
  
  const areaLower = area.toLowerCase();
  
  // Check if it's an airport-related area
  const airportKeywords = ['airport', 'clt', 'terminal', 'concourse'];
  const isAirport = airportKeywords.some(keyword => areaLower.includes(keyword));
  
  return isAirport ? 'Airport Area' : 'City-wide';
}

// Calculate layover length category
function getLayoverLength(startDate, endDate) {
  const hours = (endDate.toMillis() - startDate.toMillis()) / (1000 * 60 * 60);
  
  if (hours < 12) return 'short';
  if (hours <= 24) return 'mid';
  return 'long';
}

async function migrateSpots() {
  console.log('🔄 Starting spots migration...');
  
  const spotsRef = db.collection('spots');
  const snapshot = await spotsRef.get();
  
  let updatedCount = 0;
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    const spot = doc.data();
    const simplifiedArea = getSimplifiedArea(spot.area);
    
    // Update the spot
    batch.update(doc.ref, {
      area: simplifiedArea, // Replace area with simplified version
      originalArea: spot.area || null, // Keep original for reference (optional)
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    updatedCount++;
    console.log(`  ✓ ${spot.name} (${spot.city}): ${spot.area} → ${simplifiedArea}`);
  });
  
  await batch.commit();
  console.log(`✅ Updated ${updatedCount} spots\n`);
}

async function migrateLayovers() {
  console.log('🔄 Starting layovers migration...');
  
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  let updatedCount = 0;
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    const userData = doc.data();
    
    // Update current layover
    if (userData.currentLayover?.area) {
      const simplifiedArea = getSimplifiedArea(userData.currentLayover.area);
      batch.update(doc.ref, {
        'currentLayover.area': simplifiedArea
      });
      console.log(`  ✓ Current layover: ${userData.currentLayover.area} → ${simplifiedArea}`);
      updatedCount++;
    }
    
    // Update upcoming layovers
    if (userData.upcomingLayovers && Array.isArray(userData.upcomingLayovers)) {
      const updatedLayovers = userData.upcomingLayovers.map(layover => {
        const simplifiedArea = getSimplifiedArea(layover.area);
        const layoverLength = getLayoverLength(layover.startDate, layover.endDate);
        
        console.log(`  ✓ Upcoming: ${layover.area} → ${simplifiedArea}, length: ${layoverLength}`);
        
        return {
          ...layover,
          area: simplifiedArea,
          layoverLength: layoverLength
        };
      });
      
      batch.update(doc.ref, {
        upcomingLayovers: updatedLayovers
      });
      updatedCount += updatedLayovers.length;
    }
  });
  
  await batch.commit();
  console.log(`✅ Updated ${updatedCount} layovers\n`);
}

async function updateCityAreas() {
  console.log('🔄 Updating city areas...');
  
  const citiesRef = db.collection('cities');
  const snapshot = await citiesRef.get();
  
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    // Update each city to have only two areas
    batch.update(doc.ref, {
      areas: ['Airport Area', 'City-wide']
    });
    console.log(`  ✓ ${doc.id}: Set to Airport Area / City-wide`);
  });
  
  await batch.commit();
  console.log(`✅ Updated ${snapshot.size} cities\n`);
}

async function runMigration() {
  try {
    console.log('🚀 Starting Area Simplification Migration\n');
    console.log('This will update:');
    console.log('  - All spots to use "Airport Area" or "City-wide"');
    console.log('  - All layovers to use simplified areas + length');
    console.log('  - All cities to have only 2 areas\n');
    
    // Run migrations in order
    await migrateSpots();
    await migrateLayovers();
    await updateCityAreas();
    
    console.log('🎉 Migration complete!\n');
    console.log('Next steps:');
    console.log('  1. Update your app code to use the new fields');
    console.log('  2. Test layover creation');
    console.log('  3. Test spot creation');
    console.log('  4. Deploy updated app\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run it!
runMigration();
