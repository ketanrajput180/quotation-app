import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to local for better UX across refreshes
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Standard scopes
googleProvider.addScope('profile');
googleProvider.addScope('email');

export const signInWithGoogle = async () => {
  try {
    console.log("Initiating Google Sign-In sequence via Popup...");
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Authentication successful for user:", result.user.email);
    return result.user;
  } catch (error: any) {
    console.error("Authentication sequence failed:", error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup blocked by browser. Please enable popups for this site or try a different browser.');
    }
    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in cancelled. Please try again.');
    }
    throw error;
  }
};

export const logout = () => {
  console.log("Terminating user session...");
  return signOut(auth);
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
