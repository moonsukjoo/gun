
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Initializes FCM and saves the device token to Firestore
 * This token is used to send REAL push notifications to the phone OS.
 */
export const initializeFCM = async (uid: string) => {
  try {
    if (!('serviceWorker' in navigator)) return;

    const messaging = getMessaging();
    
    // 1. Get the registration token
    // For real OS push to work, you need a VAPID key (Web Push Certificate) from Firebase Console
    const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY;
    
    const token = await getToken(messaging, {
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
      vapidKey: vapidKey || undefined,
    });

    if (token) {
      console.log('FCM Token generated:', token);
      
      // 2. Save token to user profile so server/other clients can target this device
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    }

    // 3. Listen for foreground messages
    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      // We can use our existing notification service here if we want
    });

  } catch (error) {
    console.warn('FCM registration failed (this usually happens if the app is not in a secure context or manifest is missing):', error);
  }
};
