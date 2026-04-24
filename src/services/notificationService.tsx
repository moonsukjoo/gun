
import { toast } from 'sonner';

/**
 * Handles Web Notification API permissions and delivery
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  // Register service worker for background notifications
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }

  if (Notification.permission === 'granted') return true;

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Shows a browser-level notification and a custom "System-style" toast
 */
export const sendPushNotification = async (title: string, options: NotificationOptions & { useToast?: boolean } = {}) => {
  const { useToast = true, ...navOptions } = options;

  // 1. Browser Level Notification (OS Level)
  if ('Notification' in window && Notification.permission === 'granted') {
    // If a service worker is active, use it to show the notification (better for mobile OS)
    const registration = await navigator.serviceWorker.ready;
    if (registration) {
      registration.showNotification(title, {
        icon: '/company_logo.png',
        badge: '/company_logo.png',
        ...navOptions,
      });
    } else {
      new Notification(title, {
        icon: '/company_logo.png',
        badge: '/company_logo.png',
        ...navOptions,
      });
    }
  }

  // 2. In-app System Style Toast (inspired by the user's image)
  if (useToast) {
    // Custom toast using sonner
    toast.custom((t) => (
      <div className="w-full max-w-sm bg-black/85 backdrop-blur-xl rounded-[2rem] p-5 shadow-2xl border border-white/10 flex items-start gap-4 animate-in slide-in-from-top-10 duration-500 animate-out fade-out slide-out-to-top-10">
        <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white tracking-tight">{title}</h4>
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none">지금</span>
          </div>
          <p className="text-xs text-white/60 font-medium leading-relaxed line-clamp-2">
            {options.body || '새로운 알림이 도착했습니다.'}
          </p>
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ), {
      duration: 8000,
      position: 'top-center'
    });
  }
};
