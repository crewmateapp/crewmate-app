import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Initialize Firebase Admin
admin.initializeApp();

// Function to fix orphaned users (users in Auth but not in Firestore)
export const fixOrphanedUsers = functions.https.onCall(async (request) => {
  // Security: Only allow authenticated users
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to run this function'
    );
  }

  try {
    const fixed: { uid: string; email: string }[] = [];
    const alreadyExists: string[] = [];
    let processed = 0;

    // List all users from Firebase Auth
    const listUsersResult = await admin.auth().listUsers(1000); // Max 1000 at a time

    for (const userRecord of listUsersResult.users) {
      processed++;
      
      // Check if user exists in Firestore
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(userRecord.uid)
        .get();

      if (!userDoc.exists) {
        // User is orphaned - create Firestore document
        await admin
          .firestore()
          .collection('users')
          .doc(userRecord.uid)
          .set({
            email: userRecord.email?.toLowerCase() || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            emailVerified: userRecord.emailVerified,
            onboardingComplete: false,
            currentLayover: null,
            upcomingLayovers: [],
          });

        fixed.push({
          uid: userRecord.uid,
          email: userRecord.email || 'no-email',
        });

        console.log(`Fixed orphaned user: ${userRecord.email}`);
      } else {
        alreadyExists.push(userRecord.email || userRecord.uid);
      }
    }

    return {
      success: true,
      processed,
      fixed: fixed.length,
      fixedUsers: fixed,
      alreadyExisted: alreadyExists.length,
      message: `Processed ${processed} users. Fixed ${fixed.length} orphaned users.`,
    };
  } catch (error) {
    console.error('Error fixing orphaned users:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to fix orphaned users',
      error
    );
  }
});

// Function to manually verify a user's email
export const manuallyVerifyUser = functions.https.onCall(async (request) => {
  // Security check
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }

  const { email } = request.data;

  if (!email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email is required'
    );
  }

  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Update Auth
    await admin.auth().updateUser(user.uid, {
      emailVerified: true,
    });

    // Update Firestore
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(user.uid)
      .get();

    if (userDoc.exists) {
      await admin
        .firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          emailVerified: true,
        });
    }

    return {
      success: true,
      email,
      message: `Successfully verified ${email}`,
    };
  } catch (error) {
    console.error('Error verifying user:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to verify user',
      error
    );
  }
});
