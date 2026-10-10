import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const updateUserProfile = async (uid, data) => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updated_at: serverTimestamp() });
  } else {
    await setDoc(ref, { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() });
  }
};

export const uploadProfileImage = async (uid, file) => {
  const CLOUD_NAME    = 'dkmpxqwft';
  const UPLOAD_PRESET = 'roomsync_preset';
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'roomsync/profiles');
  const res  = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
  await updateUserProfile(uid, { profile_image_url: data.secure_url });
  return data.secure_url;
};
