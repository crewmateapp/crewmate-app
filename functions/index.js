const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();

// ── Email transporter ───────────────────────────────────────────────────
// Uses Gmail with an App Password
// Set these with: firebase functions:config:set gmail.email="crewmateapphq@gmail.com" gmail.password="your-app-password"
// OR for v2 functions, use environment variables in .env file in functions/ dir
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL || "crewmateapphq@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (NOT regular password)
  },
});

// ── Generate 6-digit code ───────────────────────────────────────────────
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── FUNCTION: Send Verification Code ────────────────────────────────────
// Called from the app when user enters their airline email
exports.sendCrewVerificationCode = onCall(async (request) => {
  // Must be authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const uid = request.auth.uid;
  const airlineEmail = request.data.airlineEmail?.trim().toLowerCase();

  if (!airlineEmail || !airlineEmail.includes("@")) {
    throw new HttpsError("invalid-argument", "Invalid email address");
  }

  // Rate limiting: max 5 codes per hour per user
  const codesRef = db.collection("verificationCodes").doc(uid);
  const existingDoc = await codesRef.get();

  if (existingDoc.exists()) {
    const data = existingDoc.data();
    const attempts = data.attempts || 0;
    const firstAttempt = data.firstAttemptAt?.toDate();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (firstAttempt && firstAttempt > oneHourAgo && attempts >= 5) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. Please try again in an hour."
      );
    }

    // Reset counter if first attempt was over an hour ago
    if (firstAttempt && firstAttempt < oneHourAgo) {
      await codesRef.update({ attempts: 0 });
    }
  }

  // Generate code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Store code in Firestore
  await codesRef.set(
    {
      code: code,
      airlineEmail: airlineEmail,
      airlineDomain: airlineEmail.split("@")[1],
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      verified: false,
      attempts: FieldValue.increment(1),
      firstAttemptAt: existingDoc.exists()
        ? existingDoc.data().firstAttemptAt
        : FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Send email
  try {
    await transporter.sendMail({
      from: '"CrewMate" <crewmateapphq@gmail.com>',
      to: airlineEmail,
      subject: "Your CrewMate Verification Code ✈️",
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
    console.error("Email send error:", emailError);
    throw new HttpsError(
      "internal",
      "Failed to send verification email. Please try again."
    );
  }

  // Return domain for UI (not the full email)
  const domain = airlineEmail.split("@")[1];
  return {
    success: true,
    domain: domain,
    message: `Verification code sent to your airline email`,
  };
});

// ── FUNCTION: Verify Code ───────────────────────────────────────────────
// Called when user enters the 6-digit code
exports.verifyCrewCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const uid = request.auth.uid;
  const submittedCode = request.data.code?.trim();

  if (!submittedCode || submittedCode.length !== 6) {
    throw new HttpsError("invalid-argument", "Please enter a 6-digit code");
  }

  // Get stored code
  const codeDoc = await db.collection("verificationCodes").doc(uid).get();

  if (!codeDoc.exists()) {
    throw new HttpsError(
      "not-found",
      "No verification code found. Please request a new one."
    );
  }

  const codeData = codeDoc.data();

  // Check expiry
  const expiresAt = codeData.expiresAt?.toDate();
  if (expiresAt && new Date() > expiresAt) {
    throw new HttpsError(
      "deadline-exceeded",
      "Code has expired. Please request a new one."
    );
  }

  // Check code
  if (codeData.code !== submittedCode) {
    // Track failed verification attempts
    await db
      .collection("verificationCodes")
      .doc(uid)
      .update({
        verifyAttempts: FieldValue.increment(1),
      });

    const verifyAttempts = (codeData.verifyAttempts || 0) + 1;
    if (verifyAttempts >= 5) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many incorrect attempts. Please request a new code."
      );
    }

    throw new HttpsError(
      "permission-denied",
      `Incorrect code. ${5 - verifyAttempts} attempts remaining.`
    );
  }

  // Code matches! Update user document
  const domain = codeData.airlineDomain;

  // Map common domains to airline names
  const airlineNames = {
    "aa.com": "American Airlines",
    "united.com": "United Airlines",
    "delta.com": "Delta Air Lines",
    "jetblue.com": "JetBlue Airways",
    "southwest.com": "Southwest Airlines",
    "wnco.com": "Southwest Airlines",
    "spirit.com": "Spirit Airlines",
    "frontier.com": "Frontier Airlines",
    "allegiantair.com": "Allegiant Air",
    "hawaiianair.com": "Hawaiian Airlines",
    "alaskaair.com": "Alaska Airlines",
    "skywest.com": "SkyWest Airlines",
    "envoyair.com": "Envoy Air",
    "piedmont-airlines.com": "Piedmont Airlines",
    "psa-airlines.com": "PSA Airlines",
    "mesaair.com": "Mesa Airlines",
    "rjet.com": "Republic Airways",
    "gojetairlines.com": "GoJet Airlines",
    "airwis.com": "Air Wisconsin",
    "commutair.com": "CommutAir",
    "horizonair.com": "Horizon Air",
    "flyrepublic.com": "Republic Airways",
    "endeavorair.com": "Endeavor Air",
  };

  const airlineName = airlineNames[domain] || domain;

  await db.collection("users").doc(uid).update({
    verifiedCrew: true,
    verifiedAirline: domain,
    verifiedAirlineName: airlineName,
    verifiedAt: FieldValue.serverTimestamp(),
    // Full airline email is NOT stored — only the domain
  });

  // Mark code as used
  await db.collection("verificationCodes").doc(uid).update({
    verified: true,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    airline: airlineName,
    message: `Verified as ${airlineName} crew!`,
  };
});

// ── FUNCTION: Resend Code ───────────────────────────────────────────────
// Generates a new code for the same email
exports.resendCrewVerificationCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const uid = request.auth.uid;

  // Get existing verification record
  const codeDoc = await db.collection("verificationCodes").doc(uid).get();

  if (!codeDoc.exists() || !codeDoc.data().airlineEmail) {
    throw new HttpsError(
      "not-found",
      "No previous verification found. Please enter your airline email first."
    );
  }

  // Re-use the same airline email, generate new code
  const airlineEmail = codeDoc.data().airlineEmail;

  // Rate limiting
  const data = codeDoc.data();
  const attempts = data.attempts || 0;
  const firstAttempt = data.firstAttemptAt?.toDate();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (firstAttempt && firstAttempt > oneHourAgo && attempts >= 5) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in an hour."
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.collection("verificationCodes").doc(uid).update({
    code: code,
    expiresAt: expiresAt,
    verified: false,
    verifyAttempts: 0,
    attempts: FieldValue.increment(1),
  });

  // Send email
  try {
    await transporter.sendMail({
      from: '"CrewMate" <crewmateapphq@gmail.com>',
      to: airlineEmail,
      subject: "Your New CrewMate Verification Code ✈️",
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
    console.error("Resend email error:", emailError);
    throw new HttpsError("internal", "Failed to resend email. Please try again.");
  }

  return {
    success: true,
    message: "New code sent to your airline email",
  };
});
