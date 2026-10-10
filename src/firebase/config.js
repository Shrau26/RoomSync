// ============================================
// firebase/config.js
// Firebase initialization & configuration
// Replace with your own Firebase project config
// ============================================
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 🔑 Replace these values with your Firebase project config
// Go to: Firebase Console → Project Settings → Your Apps → SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyEaEA_qMDnO_4fAJPnsTen4_Fi6LOuNo",
  authDomain: "roomsync-8d2c4.firebaseapp.com",
  projectId: "roomsync-8d2c4",
  storageBucket: "roomsync-8d2c4.firebasestorage.app",
  messagingSenderId: "600714660659",
  appId: "1:600714660659:web:0bb7b290d351b694638c46",
  measurementId: "G-NYJS6NN49H"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
