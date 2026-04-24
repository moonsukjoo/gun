import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with experimentalForceLongPolling for better connectivity in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

// Connection health check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("🔥 Firestore connection established");
  } catch (error) {
    console.warn("⚠️ Firestore connection status:", error);
    if (error instanceof Error && error.message.includes('permission-denied')) {
      console.log("Note: Permission denied is expected if rules are restrictive, but it means we reached the server.");
    }
  }
}

testConnection();
