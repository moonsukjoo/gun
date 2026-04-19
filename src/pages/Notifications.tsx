import React, { useEffect, useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { Notification } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const Notifications: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">알림함</h2>
        </div>
        {notifications.some(n => !n.isRead) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
            onClick={markAllAsRead}
          >
            모두 읽음 처리
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={cn(
                "border-none shadow-sm rounded-2xl overflow-hidden transition-all active:scale-[0.98]",
                notification.isRead ? "bg-white/50 opacity-70" : "bg-white border-l-4 border-l-primary"
              )}
              onClick={() => !notification.isRead && markAsRead(notification.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    notification.isRead ? "bg-slate-100 text-slate-400" : "bg-primary/5 text-primary"
                  )}>
                    {notification.type === 'HEALTH_CHECK' ? <Activity className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm tracking-tight text-slate-900">{notification.title}</h4>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {format(new Date(notification.createdAt), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold leading-relaxed">{notification.message}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {format(new Date(notification.createdAt), 'yyyy.MM.dd')}
                      </span>
                      {!notification.isRead && (
                        <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <Bell className="w-8 h-8" />
            </div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest">새로운 알림이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

import { Activity } from 'lucide-react';
