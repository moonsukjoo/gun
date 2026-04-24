
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configuration from firebase-applet-config.json
// Note: These must be hardcoded here or retrieved via a clever way. 
// For this environment, we will use the global config.
firebase.initializeApp({
  apiKey: "AIzaSyBqSXt4sLbrLVZA8ExYa44xRltGvX_VjFQ",
  authDomain: "gen-lang-client-0407488917.firebaseapp.com",
  projectId: "gen-lang-client-0407488917",
  storageBucket: "gen-lang-client-0407488917.firebasestorage.app",
  messagingSenderId: "1059393589891",
  appId: "1:1059393589891:web:0708325cfee3df0c1081b6"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/company_logo.png',
    badge: '/company_logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Standard Push listener fallback
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || data.notification?.body,
        icon: '/company_logo.png',
        badge: '/company_logo.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || data.notification?.title || '알림', options)
      );
    } catch (e) {
      console.error('Push data parse failed:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
