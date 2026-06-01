import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDZODZT6uXGC119i33LCL5AL8CoumbTYgI',
  authDomain: 'notas-cf9db.firebaseapp.com',
  projectId: 'notas-cf9db',
  storageBucket: 'notas-cf9db.firebasestorage.app',
  messagingSenderId: '17449392645',
  appId: '1:17449392645:web:e5d5d48a59b807a1a8da6c',
  measurementId: 'G-ZW1C0XRYW3',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
