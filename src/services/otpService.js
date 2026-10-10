// ============================================
// services/otpService.js
// OTP generation, delivery (EmailJS), and verification
//
// BUG FIXED: OTP store previously used a plain JS object (const otpStore = {})
// which gets wiped on every Vite HMR reload — so the stored OTP was gone by
// the time the user typed it in. Storage is now sessionStorage so it survives
// hot reloads and page re-renders without persisting across browser sessions.
// ============================================

import { SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY, IS_CONFIGURED } from './emailServiceConfig';

// ── SessionStorage helpers ──────────────────────────────────
// Key format: "otp:<email>" so multiple emails don't collide
function storeKey(email) {
  return 'otp:' + email.trim().toLowerCase();
}

function saveOTPRecord(email, record) {
  try {
    sessionStorage.setItem(storeKey(email), JSON.stringify(record));
  } catch (e) {
    console.error('[OTP] sessionStorage write failed:', e);
  }
}

function getOTPRecord(email) {
  try {
    const raw = sessionStorage.getItem(storeKey(email));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function deleteOTPRecord(email) {
  try {
    sessionStorage.removeItem(storeKey(email));
  } catch {}
}

// ── EmailJS SDK loader ──────────────────────────────────────
let sdkLoaded = false;

async function loadSDK() {
  if (sdkLoaded && window.emailjs) return;
  if (window.emailjs) { sdkLoaded = true; return; }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => {
      window.emailjs.init(PUBLIC_KEY);
      sdkLoaded = true;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Generate a 6-digit numeric OTP */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * sendOTP — generates an OTP, saves it to sessionStorage, and either
 * emails it (EmailJS configured) or returns it for dev-mode display.
 */
export async function sendOTP(email, name = 'User') {
  const normalEmail = email.trim().toLowerCase();
  const otp = generateOTP();

  // Save to sessionStorage — survives HMR, does not survive tab close
  saveOTPRecord(normalEmail, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts:  0,
  });

  if (!IS_CONFIGURED) {
    console.warn(
      `[OTP] DEV MODE — OTP for ${normalEmail}: ${otp}\n` +
      `[OTP] Configure emailServiceConfig.js to send real emails.`
    );
    return { ok: true, devOtp: otp };
  }

  try {
    await loadSDK();
    await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email:  normalEmail,
      to_name:   name,
      from_name: 'RoomSync',
      subject:   'Your RoomSync Verification Code',
      message:
        `Hi ${name},\n\n` +
        `Your verification code is: ${otp}\n\n` +
        `This code expires in 10 minutes.\n\n— RoomSync Team`,
      otp_code: otp,
    });
    return { ok: true };
  } catch (err) {
    // Remove record so user can retry cleanly
    deleteOTPRecord(normalEmail);
    return { ok: false, error: err?.text || err?.message || 'Failed to send OTP' };
  }
}

/**
 * verifyOTP — reads from sessionStorage and checks the submitted code.
 * Normalises email the same way sendOTP does so keys always match.
 */
export function verifyOTP(email, submittedOtp) {
  const normalEmail = email.trim().toLowerCase();
  const submitted   = submittedOtp.trim();
  const record      = getOTPRecord(normalEmail);

  if (!record) {
    return { valid: false, reason: 'No OTP found. Please click "Resend OTP" to get a new one.' };
  }

  if (Date.now() > record.expiresAt) {
    deleteOTPRecord(normalEmail);
    return { valid: false, reason: 'OTP has expired. Please click "Resend OTP".' };
  }

  record.attempts += 1;
  saveOTPRecord(normalEmail, record); // persist updated attempt count

  if (record.attempts > MAX_ATTEMPTS) {
    deleteOTPRecord(normalEmail);
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  if (record.otp !== submitted) {
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      valid:  false,
      reason: remaining > 0
        ? `Incorrect OTP — ${remaining} attempt${remaining !== 1 ? 's' : ''} left.`
        : 'No attempts remaining. Please click "Resend OTP".',
    };
  }

  // Correct — remove from storage so it can't be reused
  deleteOTPRecord(normalEmail);
  return { valid: true };
}

/**
 * clearOTP — call this if the user cancels out of the OTP step.
 */
export function clearOTP(email) {
  deleteOTPRecord(email.trim().toLowerCase());
}
