import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { generateReferralCode } from '../utils/referralUtils';

// Check if email is already registered — returns true if exists
export const checkEmailExists = async (email) => {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
    return methods.length > 0;
  } catch {
    return false; // on error, don't block the user
  }
};

export const registerUser = async (name, email, password, role = 'student_need_room', referredBy = null, referredByName = '') => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });

  const referralCode = generateReferralCode(name);

  await setDoc(doc(db, 'users', user.uid), {
    uid:               user.uid,
    name,
    email,
    role,
    referralCode,
    ...(referredBy ? { referredBy, referredByName } : {}),
    college:           '',
    year:              '',
    budget:            { min: 0, max: 10000 },
    sleep_schedule:    '',
    study_type:        '',
    cleanliness:       3,
    profile_image_url: '',
    created_at:        serverTimestamp(),
  });

  return user;
};

export const loginUser = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

export const logoutUser = () => signOut(auth);

export const forgotPassword = (email) =>
  sendPasswordResetEmail(auth, email);

export const subscribeToAuthChanges = (callback) =>
  onAuthStateChanged(auth, callback);

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};