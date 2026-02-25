import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin
admin.initializeApp();

// ── Email transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL || 'crewmateapphq@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── Generate 6-digit code ───────────────────────────────────────────────
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Airline domain → name mapping ───────────────────────────────────────
const airlineNames: Record<string, string> = {
  'aa.com': 'American Airlines',
  'united.com': 'United Airlines',
  'delta.com': 'Delta Air Lines',
  'jetblue.com': 'JetBlue Airways',
  'southwest.com': 'Southwest Airlines',
  'wnco.com': 'Southwest Airlines',
  'spirit.com': 'Spirit Airlines',
  'frontier.com': 'Frontier Airlines',
  'allegiantair.com': 'Allegiant Air',
  'hawaiianair.com': 'Hawaiian Airlines',
  'alaskaair.com': 'Alaska Airlines',
  'skywest.com': 'SkyWest Airlines',
  'envoyair.com': 'Envoy Air',
  'piedmont-airlines.com': 'Piedmont Airlines',
  'psa-airlines.com': 'PSA Airlines',
  'mesaair.com': 'Mesa Airlines',
  'rjet.com': 'Republic Airways',
  'gojetairlines.com': 'GoJet Airlines',
  'airwis.com': 'Air Wisconsin',
  'commutair.com': 'CommutAir',
  'horizonair.com': 'Horizon Air',
  'flyrepublic.com': 'Republic Airways',
  'endeavorair.com': 'Endeavor Air',
};

// ═════════════════════════════════════════════════════════════════════════
// EXISTING FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════

// Function to fix orphaned users (users in Auth but not in Firestore)
export const fixOrphanedUsers = functions.https.onCall(async (request) => {
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

    const listUsersResult = await admin.auth().listUsers(1000);

    for (const userRecord of listUsersResult.users) {
      processed++;

      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(userRecord.uid)
        .get();

      if (!userDoc.exists) {
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
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().updateUser(user.uid, {
      emailVerified: true,
    });

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

// ═════════════════════════════════════════════════════════════════════════
// NEW: CREW VERIFICATION FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════

// Send a 6-digit verification code to an airline email
export const sendCrewVerificationCode = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const uid = request.auth.uid;
  const airlineEmail = request.data.airlineEmail?.trim().toLowerCase();

  if (!airlineEmail || !airlineEmail.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
  }

  // Rate limiting: max 5 codes per hour per user
  const codesRef = admin.firestore().collection('verificationCodes').doc(uid);
  const existingDoc = await codesRef.get();

  if (existingDoc.exists) {
    const data = existingDoc.data()!;
    const attempts = data.attempts || 0;
    const firstAttempt = data.firstAttemptAt?.toDate();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (firstAttempt && firstAttempt > oneHourAgo && attempts >= 5) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many attempts. Please try again in an hour.'
      );
    }

    if (firstAttempt && firstAttempt < oneHourAgo) {
      await codesRef.update({ attempts: 0 });
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await codesRef.set(
    {
      code,
      airlineEmail,
      airlineDomain: airlineEmail.split('@')[1],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      verified: false,
      verifyAttempts: 0,
      attempts: admin.firestore.FieldValue.increment(1),
      firstAttemptAt: existingDoc.exists
        ? existingDoc.data()!.firstAttemptAt
        : admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  try {
    await transporter.sendMail({
      from: '"CrewMate" <crewmateapphq@gmail.com>',
      to: airlineEmail,
      subject: 'Your CrewMate Verification Code ✈️',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1B3A5C; margin: 0;">✈️ CrewMate</h1>
            <p style="color: #666; margin-top: 8px;">Crew Verification</p>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Hey crew! Here's your verification code:
          </p>
          
          <div style="background: #F0F7FF; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1B3A5C;">${code}</span>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Enter this code in the CrewMate app to verify your crew status. 
            This code expires in <strong>1 hour</strong>.
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            If you didn't request this code, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            CrewMate — Made by crew, for crew<br />
            Your airline email will not be stored after verification.
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error('Email send error:', emailError);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send verification email. Please try again.'
    );
  }

  return {
    success: true,
    domain: airlineEmail.split('@')[1],
    message: 'Verification code sent to your airline email',
  };
});

// Verify the 6-digit code
export const verifyCrewCode = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const uid = request.auth.uid;
  const submittedCode = request.data.code?.trim();

  if (!submittedCode || submittedCode.length !== 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Please enter a 6-digit code');
  }

  const codeDoc = await admin.firestore().collection('verificationCodes').doc(uid).get();

  if (!codeDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'No verification code found. Please request a new one.'
    );
  }

  const codeData = codeDoc.data()!;

  // Check expiry
  const expiresAt = codeData.expiresAt?.toDate();
  if (expiresAt && new Date() > expiresAt) {
    throw new functions.https.HttpsError(
      'deadline-exceeded',
      'Code has expired. Please request a new one.'
    );
  }

  // Check code
  if (codeData.code !== submittedCode) {
    await admin.firestore().collection('verificationCodes').doc(uid).update({
      verifyAttempts: admin.firestore.FieldValue.increment(1),
    });

    const verifyAttempts = (codeData.verifyAttempts || 0) + 1;
    if (verifyAttempts >= 5) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many incorrect attempts. Please request a new code.'
      );
    }

    throw new functions.https.HttpsError(
      'permission-denied',
      `Incorrect code. ${5 - verifyAttempts} attempts remaining.`
    );
  }

  // Code matches — verify user
  const domain = codeData.airlineDomain;
  const airlineName = airlineNames[domain] || domain;

  await admin.firestore().collection('users').doc(uid).update({
    verifiedCrew: true,
    verifiedAirline: domain,
    verifiedAirlineName: airlineName,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await admin.firestore().collection('verificationCodes').doc(uid).update({
    verified: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    airline: airlineName,
    message: `Verified as ${airlineName} crew!`,
  };
});

// Resend verification code to the same airline email
export const resendCrewVerificationCode = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const uid = request.auth.uid;

  const codeDoc = await admin.firestore().collection('verificationCodes').doc(uid).get();

  if (!codeDoc.exists || !codeDoc.data()?.airlineEmail) {
    throw new functions.https.HttpsError(
      'not-found',
      'No previous verification found. Please enter your airline email first.'
    );
  }

  const airlineEmail = codeDoc.data()!.airlineEmail;
  const data = codeDoc.data()!;
  const attempts = data.attempts || 0;
  const firstAttempt = data.firstAttemptAt?.toDate();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (firstAttempt && firstAttempt > oneHourAgo && attempts >= 5) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many attempts. Please try again in an hour.'
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await admin.firestore().collection('verificationCodes').doc(uid).update({
    code,
    expiresAt,
    verified: false,
    verifyAttempts: 0,
    attempts: admin.firestore.FieldValue.increment(1),
  });

  try {
    await transporter.sendMail({
      from: '"CrewMate" <crewmateapphq@gmail.com>',
      to: airlineEmail,
      subject: 'Your New CrewMate Verification Code ✈️',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1B3A5C; margin: 0;">✈️ CrewMate</h1>
            <p style="color: #666; margin-top: 8px;">Crew Verification</p>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Here's your new verification code:
          </p>
          
          <div style="background: #F0F7FF; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1B3A5C;">${code}</span>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            This code expires in <strong>1 hour</strong>.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            CrewMate — Made by crew, for crew
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error('Resend email error:', emailError);
    throw new functions.https.HttpsError('internal', 'Failed to resend email. Please try again.');
  }

  return {
    success: true,
    message: 'New code sent to your airline email',
  };
});
