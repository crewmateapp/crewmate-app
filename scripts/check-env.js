// scripts/check-env.js
// Quick script to check if .env variables are loading correctly

require('dotenv').config();

console.log('🔍 Checking environment variables...\n');

const required = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY'
];

let allGood = true;

required.forEach(key => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${key}: MISSING`);
    allGood = false;
  }
});

console.log('\n');

if (allGood) {
  console.log('🎉 All variables loaded correctly!');
} else {
  console.log('❌ Some variables are missing!');
  console.log('\nCheck your .env file in the project root.');
  console.log('Make sure it has all the EXPO_PUBLIC_* variables.');
}
