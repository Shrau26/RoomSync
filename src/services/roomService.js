// ============================================
// services/roomService.js
// Firestore room listing CRUD operations
// ============================================
import {
  collection, addDoc, getDocs, getDoc, doc,
  query, where, orderBy, serverTimestamp, deleteDoc, updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

/** Add a new room listing */
export const addRoom = async (ownerId, data) => {
  return addDoc(collection(db, 'rooms'), {
    owner_id: ownerId,
    ...data,
    created_at: serverTimestamp(),
  });
};

/** Get all rooms */
export const getAllRooms = async () => {
  const snap = await getDocs(query(collection(db, 'rooms'), orderBy('created_at', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** Get rooms by owner */
export const getMyRooms = async (ownerId) => {
  const snap = await getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** Get single room */
export const getRoom = async (id) => {
  const snap = await getDoc(doc(db, 'rooms', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/** Delete room */
export const deleteRoom = (id) => deleteDoc(doc(db, 'rooms', id));

/** Upload room image */
export const uploadRoomImage = async (roomId, file) => {
  const storageRef = ref(storage, `room_images/${roomId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};
