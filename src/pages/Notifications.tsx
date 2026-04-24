import React, { useEffect, useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { Notification } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Bell, Activity, ShieldAlert, Megaphone, Ship, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { grantRandomShipPart } from '@/src/services/shipService';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/components/ui/dialog';

export const Notifications: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
    return () => unsubscribe();
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
      if (profile?.uid) {
        grantRandomShipPart(profile.uid, '알림 확인');
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'EMERGENCY': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'NOTICE': return <Megaphone className="w-5 h-5 text-primary" />;
      case 'HEALTH_CHECK': return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'LEAVE_REMINDER': return <CalendarDays className="w-5 h-5 text-blue-500" />;
      case 'SHIP_UPDATE': return <Ship className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex items-end justify-between">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-white leading-tight">알림</h2>
           <p className="text-muted-foreground font-bold">중요한 소식을 확인하세요</p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <Button 
            variant="ghost" 
            className="text-xs font-black text-primary hover:bg-white/5"
            onClick={markAllAsRead}
          >
            모두 읽음
          </Button>
        )}
      </header>

      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={cn(
                "p-5 rounded-2xl flex items-start gap-4 transition-all cursor-pointer active:scale-[0.98]",
                notification.isRead ? "bg-white/[0.02] opacity-50" : "bg-card border border-white/5"
              )}
              onClick={() => {
                setSelectedNotification(notification);
                if (!notification.isRead) markAsRead(notification.id);
              }}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                notification.isRead ? "bg-white/5" : "bg-white/5 shadow-inner"
              )}>
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 space-y-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h4 className={cn("text-sm tracking-tight truncate", notification.isRead ? "font-bold text-muted-foreground" : "font-black text-white")}>
                    {notification.title}
                  </h4>
                  <span className="text-[10px] font-bold text-muted-foreground shrink-0 ml-2">
                    {format(new Date(notification.createdAt), 'MM.dd')}
                  </span>
                </div>
                <p className={cn("text-xs leading-relaxed truncate", notification.isRead ? "text-muted-foreground/60" : "text-muted-foreground font-bold")}>
                  {notification.message}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-muted-foreground/20">
              <Bell className="w-8 h-8" />
            </div>
            <p className="text-sm font-black text-muted-foreground opacity-30">새로운 알림이 없습니다</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-[90vw] sm:max-w-md p-0 overflow-hidden">
          {selectedNotification && (
            <div className="flex flex-col">
              <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                  {getIcon(selectedNotification.type)}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-black tracking-tight">{selectedNotification.title}</DialogTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {format(new Date(selectedNotification.createdAt), 'yyyy.MM.dd HH:mm')}
                  </p>
                </div>
              </div>
              <div className="px-8 pb-8">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message}
                </p>
              </div>
              <div className="p-6 pt-0 border-t border-white/5">
                <Button 
                  onClick={() => setSelectedNotification(null)}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black mt-6"
                >
                  닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
