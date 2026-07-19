
import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { sendPushNotification } from '../services/notificationService';
import { initializeFCM } from '../services/fcmService';
import { Notification } from '../types';
import { AlertSoundPlayer } from '../lib/sound';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

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
          
          // Trigger voice notification
          AlertSoundPlayer.trigger('general', data.title);

          // Trigger the visual alert (Foreground OS Notification)
          const isUrgent = data.type === 'EMERGENCY' || data.type === 'URGENT_NOTICE';
          
          await sendPushNotification(data.title, {
            body: data.message,
            tag: data.id || change.doc.id,
            requireInteraction: isUrgent,
            silent: false,
            // Use specific icons based on type
            icon: '/company_logo.png',
            badge: '/company_logo.png'
          });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  return null; // This is a logic-only component
};
