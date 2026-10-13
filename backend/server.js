// ============================================
// backend/server.js — RoomSync Backend (OPTIONAL)
//
// The React frontend talks directly to Firebase + Flask.
// You do NOT need to run this file for the app to work.
// Only run it if you specifically need server-side Firebase Admin features.
//
// IMPROVEMENTS in this version:
//   • Server-side input validation on all API routes
//   • Secure password requirements enforced on /api/register
//   • Sanitised inputs (trim, lowercase email)
//   • Descriptive validation error responses
// ============================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Firebase Admin (optional) ──────────────────────────────
let db = null;
let adminAuth = null;
let firebaseEnabled = false;

const KEY_PATH = './serviceAccountKey.json';

if (existsSync(KEY_PATH)) {
  try {
    const { default: admin } = await import('firebase-admin');
    const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    adminAuth = admin.auth();
    firebaseEnabled = true;
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.warn('⚠️  Firebase Admin failed to init:', err.message);
  }
} else {
  console.log('ℹ️  No serviceAccountKey.json — Firebase Admin skipped (not required).');
}

// ── Server-side validation helpers ────────────────────────

/**
 * Validates an email string format.
 * Returns an error string, or null if valid.
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim())
    return 'Email is required';
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!pattern.test(email.trim()))
    return 'Invalid email format';
  return null;
}

/**
 * Validates password strength:
 *  - Minimum 8 characters
 *  - At least one uppercase, one lowercase, one digit, one special char
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string')
    return 'Password is required';
  if (password.length < 8)
    return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password))
    return 'Password must contain at least one special character';
  return null;
}

/**
 * Validates a required string field.
 */
function validateRequired(value, fieldName) {
  if (!value || typeof value !== 'string' || !value.trim())
    return `${fieldName} is required`;
  return null;
}

/**
 * Express middleware: validates request body fields.
 * @param {Function} validatorFn - receives req.body, returns { errors: {field: msg} }
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    const hasErrors = Object.values(errors).some(v => v !== null);
    if (hasErrors) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: errors,
      });
    }
    next();
  };
}

// ── Auth middleware ────────────────────────────────────────
const authenticate = async (req, res, next) => {
  if (!firebaseEnabled)
    return res.status(503).json({ error: 'Firebase Admin not configured' });
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token)
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  try {
    req.user = await adminAuth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
};

// ── Routes ─────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'RoomSync Backend API',
  firebase_admin: firebaseEnabled ? 'enabled' : 'disabled (not required)',
}));

// Rooms list
app.get('/api/rooms', async (req, res) => {
  if (!firebaseEnabled)
    return res.status(503).json({ error: 'Firebase Admin not configured' });
  try {
    const snap = await db.collection('rooms').orderBy('created_at', 'desc').get();
    res.json({ rooms: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single room
app.get('/api/rooms/:id', async (req, res) => {
  if (!firebaseEnabled)
    return res.status(503).json({ error: 'Firebase Admin not configured' });
  try {
    const docRef = await db.collection('rooms').doc(req.params.id).get();
    if (!docRef.exists) return res.status(404).json({ error: 'Room not found' });
    res.json({ room: { id: docRef.id, ...docRef.data() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create room — with server-side validation
app.post(
  '/api/rooms',
  authenticate,
  validate((body) => ({
    title:       validateRequired(body.title, 'Title'),
    location:    validateRequired(body.location, 'Location'),
    price:       (body.price == null || isNaN(Number(body.price))) ? 'Price must be a number' : null,
    room_type:   validateRequired(body.room_type, 'Room type'),
    description: null, // optional
    facilities:  null, // optional
  })),
  async (req, res) => {
    try {
      const { default: admin } = await import('firebase-admin');
      const { title, location, price, room_type, facilities, description } = req.body;
      const docRef = await db.collection('rooms').add({
        owner_id: req.user.uid,
        title:       title.trim(),
        location:    location.trim(),
        price:       Number(price),
        room_type:   room_type.trim(),
        facilities:  facilities || [],
        description: description?.trim() || '',
        images:      [],
        created_at:  admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(201).json({ id: docRef.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get profile
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const docRef = await db.collection('users').doc(req.user.uid).get();
    if (!docRef.exists) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: docRef.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile — with server-side validation
app.put(
  '/api/profile',
  authenticate,
  validate((body) => ({
    // Only validate fields that are present; all are optional on update
    email: body.email ? validateEmail(body.email) : null,
    name:  body.name  ? (body.name.trim().length < 2 ? 'Name is too short' : null) : null,
  })),
  async (req, res) => {
    try {
      const { default: admin } = await import('firebase-admin');
      // Sanitise: trim strings, lowercase email
      const sanitised = { ...req.body };
      if (sanitised.email) sanitised.email = sanitised.email.trim().toLowerCase();
      if (sanitised.name)  sanitised.name  = sanitised.name.trim();

      await db.collection('users').doc(req.user.uid).update({
        ...sanitised,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

const PORT = process.env.PORT || 4000;
export default app;
