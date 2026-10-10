// ============================================
// services/referralService.js
// FIXED: All queries use only ONE where() clause to avoid composite index errors.
// Status checks are done in JS after fetching, not in Firestore queries.
// ============================================

import {
  collection, doc, addDoc, getDocs,
  query, where, updateDoc, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ── Helper: get referral doc for a referred user (single where, no index needed)
async function getReferralDoc(referredUserId) {
  const q = query(
    collection(db, 'referrals'),
    where('referredUserId', '==', referredUserId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data(), id: snap.docs[0].id };
}

// ── 1. Look up a referral code
export async function findUserByReferralCode(code) {
  if (!code || !code.trim()) return null;
  const q = query(
    collection(db, 'users'),
    where('referralCode', '==', code.trim().toUpperCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── 2. Create referral on signup
export async function createReferralOnSignup({ referrerId, referredUserId, referredEmail, referrerName = '' }) {
  if (referrerId === referredUserId) throw new Error('You cannot refer yourself.');

  const existing = await getReferralDoc(referredUserId);
  if (existing) throw new Error('This user already used a referral code.');

  await addDoc(collection(db, 'referrals'), {
    referrerId,
    referredUserId,
    referredEmail,
    referrerName,
    status:     'registered',
    commission: 0,
    createdAt:  serverTimestamp(),
  });
}

// ── 3. Mark referral as booked (visit scheduled)
export async function markReferralBooked(referredUserId) {
  if (!referredUserId) return;
  const r = await getReferralDoc(referredUserId);
  if (!r) return;
  if (r.data.status !== 'registered') return; // don't regress
  await updateDoc(r.ref, { status: 'booked', bookedAt: serverTimestamp() });
}

// ── 4. Mark referral as moved_in (owner confirms student moved in)
export async function markReferralMovedIn(referredUserId) {
  if (!referredUserId) return;
  const r = await getReferralDoc(referredUserId);
  if (!r) return;
  if (r.data.status === 'completed') return; // already done

  await updateDoc(r.ref, { status: 'moved_in', movedInAt: serverTimestamp() });

  // Create payment request (best-effort)
  try {
    await addDoc(collection(db, 'paymentRequests'), {
      studentUid:   referredUserId,
      referrerId:   r.data.referrerId,
      referrerName: r.data.referrerName || '',
      referralId:   r.id,
      amount:       1000,
      status:       'pending',
      createdAt:    serverTimestamp(),
    });
  } catch (_) {}
}

// ── 5. Mark referral as completed (commission earned)
export async function markReferralCompleted(referredUserId) {
  if (!referredUserId) return;
  const r = await getReferralDoc(referredUserId);
  if (!r) return;
  if (r.data.status === 'completed') return;
  await updateDoc(r.ref, { status: 'completed', commission: 1000, completedAt: serverTimestamp() });
}

// ── 6. Student clicks "I've Paid" — directly marks referral completed
export async function markPaymentDone(studentUid) {
  if (!studentUid) { console.warn('[markPaymentDone] no studentUid'); return; }
  console.log('[markPaymentDone] looking up referral for', studentUid);
  const r = await getReferralDoc(studentUid);
  if (!r) { console.warn('[markPaymentDone] no referral doc found for', studentUid); return; }
  console.log('[markPaymentDone] found referral, status =', r.data.status, 'id =', r.id);
  if (r.data.status === 'completed') { console.log('[markPaymentDone] already completed'); return; }

  // Directly update referral to completed — no dependency on paymentRequests
  console.log('[markPaymentDone] updating to completed...');
  await updateDoc(r.ref, { status: 'completed', commission: 1000, completedAt: serverTimestamp() });
  console.log('[markPaymentDone] SUCCESS — referral marked completed');

  // Best-effort: also close any pending paymentRequest
  try {
    const pq = query(
      collection(db, 'paymentRequests'),
      where('studentUid', '==', studentUid),
      limit(1),
    );
    const psnap = await getDocs(pq);
    if (!psnap.empty && psnap.docs[0].data().status === 'pending') {
      await updateDoc(psnap.docs[0].ref, { status: 'paid', paidAt: serverTimestamp() });
    }
  } catch (_) {}
}