
import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { sendPushNotification } from '../services/notificationService';
import { initializeFCM } from '../services/fcmService';
import { Notification } from '../types';

/**
 * Global component that listens for new notifications in Firestore
 * and triggers system-style push alerts
 */
export const NotificationHandler: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Register device for real OS push notifications
    initializeFCM(user.uid);

    // Listen for new notifications targetting this user
    // We only want notifications created AFTER now to avoid old alerts on load
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      where('createdAt', '>=', now),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as Notification;
          
          // Trigger the visual alert (Foreground OS Notification)
          await sendPushNotification(data.title, {
            body: data.message,
            tag: data.id || change.doc.id,
            requireInteraction: data.type === 'EMERGENCY',
            // Use specific icons based on type
            badge: data.type === 'EMERGENCY' ? '/emergency-icon.png' : undefined
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return null; // This is a logic-only component
};
