import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, 
  Clock, 
  Bell, 
  Users, 
  LogOut, 
  User,
  ShieldAlert,
  ChevronLeft,
  Settings,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/firebase';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { sendPushNotification } from '../services/notificationService';
import { CriticalIncidentAlertCenter } from './CriticalIncidentAlertCenter';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, active }) => (
  <Link
    to={to}
    className={cn(
      "flex flex-col items-center justify-center gap-1.5 flex-1 py-1 transition-all duration-300 relative",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}
  >
    <div className={cn(
      "w-12 h-7 rounded-full transition-all duration-300 flex items-center justify-center",
      active ? "bg-primary/15 text-primary shadow-[0_2px_8px_rgba(59,130,246,0.12)]" : "bg-transparent"
    )}>
      <Icon className={cn("w-4.5 h-4.5 transition-all duration-300", active && "scale-105")} />
    </div>
    <span className={cn(
      "text-[11.5px] font-black tracking-tight transition-all leading-none",
      active ? "opacity-100 text-primary" : "opacity-70"
    )}>
      {label}
    </span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSOSDialogOpen, setIsSOSDialogOpen] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);

  const lightTheme = profile?.lightTheme;

  useEffect(() => {
    // Apply light-theme class to body to ensure backgrounds and scrollbars update
    if (lightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [lightTheme]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', profile.uid),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
      
      // Trigger local notification for new arrivals if not initially loading
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Avoid notifying for old messages on first load or messages from self
          const isNew = data.createdAt && new Date(data.createdAt).getTime() > Date.now() - 10000;
          if (isNew) {
            sendPushNotification(data.title, {
              body: data.message,
              data: { type: data.type, id: change.doc.id }
            });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications_unread');
    });
    return () => unsubscribe();
  }, [profile]);

  const [hasImportantNotice, setHasImportantNotice] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'notices'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const hasImportant = docs.some(doc => {
        const isImportant = doc.isImportant === true || doc.priority === 'high' || doc.priority === 'URGENT';
        if (!isImportant) return false;
        
        let createdAtDate: Date;
        if (doc.createdAt) {
          if (typeof doc.createdAt === 'string') {
            createdAtDate = new Date(doc.createdAt);
          } else if (doc.createdAt.toDate) {
            createdAtDate = doc.createdAt.toDate();
          } else if (doc.createdAt.seconds) {
            createdAtDate = new Date(doc.createdAt.seconds * 1000);
          } else {
            createdAtDate = new Date();
          }
        } else {
          createdAtDate = new Date();
        }
        
        // Is recent (within last 7 days)
        const isRecent = Date.now() - createdAtDate.getTime() < 7 * 24 * 60 * 60 * 1000;
        
        // Is unread (createdAt is newer than lastViewedNoticesTime)
        const lastViewed = localStorage.getItem('lastViewedNoticesTime');
        const isUnread = !lastViewed || createdAtDate.getTime() > new Date(lastViewed).getTime() + 1000;
        
        return isRecent && isUnread;
      });
      setHasImportantNotice(hasImportant);
    }, (error) => {
      console.error("Error listening to notices for alert pulse:", error);
    });
    return () => unsubscribe();
  }, [profile, location.pathname]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const handleEmergencySOS = async (type: string) => {
    if (!profile) return;
    setIsSOSLoading(true);

    try {
      const directorsQuery = query(collection(db, 'users'), where('role', '==', 'DIRECTOR'));
      const safetyManagersQuery = query(collection(db, 'users'), where('role', '==', 'SAFETY_MANAGER'));
      const teamLeadersQuery = query(
        collection(db, 'users'), 
        where('role', '==', 'TEAM_LEADER'),
        where('departmentId', '==', profile.departmentId || '')
      );

      const [directorsSnap, safetySnap, teamLeadersSnap] = await Promise.all([
        getDocs(directorsQuery),
        getDocs(safetyManagersQuery),
        getDocs(teamLeadersQuery)
      ]);

      const targetUids = new Set<string>();
      directorsSnap.docs.forEach(d => targetUids.add(d.id));
      safetySnap.docs.forEach(d => targetUids.add(d.id));
      teamLeadersSnap.docs.forEach(d => targetUids.add(d.id));
      
      const ceoQuery = query(collection(db, 'users'), where('role', '==', 'CEO'));
      const ceoSnap = await getDocs(ceoQuery);
      ceoSnap.docs.forEach(d => targetUids.add(d.id));

      targetUids.delete(profile.uid);

      await addDoc(collection(db, 'emergencyLogs'), {
        uid: profile.uid,
        displayName: profile.displayName,
        type,
        location: profile.workplace || '현장',
        createdAt: new Date().toISOString()
      });

      // Create critical Incident record for superior check-in
      await addDoc(collection(db, 'criticalIncidents'), {
        type: 'SOS',
        typeName: `비상 SOS (${type})`,
        uid: profile.uid,
        displayName: profile.displayName || '이름없음',
        employeeId: profile.employeeId || '',
        departmentName: profile.departmentName || '미지정',
        jobRole: profile.jobRole || '',
        workplace: profile.workplace || '현장',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `🚨 [긴급 SOS] ${type} 발생!`,
          message: `${profile.displayName}님이 위급 상황(${type})을 보고했습니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName,
          priority: 'high'
        })
      );

      await Promise.all(notificationPromises);
      
      // 실제 푸시 알림 전송 (Capacitor/브라우저 OS 레벨)
      await sendPushNotification(`🚨 [긴급 SOS] ${type} 발생!`, {
        body: `${profile.displayName}님이 위급 상황(${type})을 보고했습니다.`,
        tag: `emergency-${Date.now()}`,
        data: { type: 'EMERGENCY' }
      });

      setIsSOSDialogOpen(false);
      toast.error('긴급 SOS 전송 완료');
    } catch (error) {
      toast.error('SOS 전송 실패');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    (['조장', '반장', '사원'].includes(profile.position?.trim() || '') && profile.role !== 'TEAM_LEADER') ||
    profile.employeeId?.trim()?.toLowerCase()?.includes('x66626') ||
    profile.displayName?.toLowerCase().includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName.toLowerCase().includes('x66626'))
  );

  const isAdmin = profile && !isExcludedRole && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));
  const canSeePersonnel = profile && !isExcludedRole && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role) || profile.permissions?.includes('employee_mgmt'));

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '홈' },
    { to: '/attendance', icon: Clock, label: '근태' },
    isAdmin && { to: '/admin', icon: Settings, label: '관리' },
    { to: '/mypage', icon: User, label: '마이' },
  ].filter(Boolean) as any[];

  return (
    <div className="flex flex-col h-screen bg-background font-sans text-foreground select-none">
      <header className="h-13 bg-card/85 backdrop-blur-xl border-b border-border/40 flex items-center justify-center flex-shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="w-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {location.pathname !== '/' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="w-8 h-8 -ml-1 text-muted-foreground hover:text-foreground transition-all rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center p-1 active:scale-95 transition-all">
                <CompanyLogo className="w-full h-full" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xs tracking-tight leading-none text-foreground">건명기업</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
              <DialogTrigger 
                className="w-8.5 h-8.5 bg-red-600 rounded-lg flex items-center justify-center text-white active:scale-90 transition-all shadow-md shadow-red-900/15"
              >
                <ShieldAlert className="w-4 h-4" />
              </DialogTrigger>
              <DialogContent className="bg-card border-none rounded-2xl p-0 overflow-hidden max-w-[280px]">
                <div className="bg-red-600 p-5 text-center text-white">
                  <h2 className="text-lg font-black">긴급 상황 전송</h2>
                  <p className="text-[9px] font-bold text-white/90 mt-1">유형을 선택하면 관리자에게 즉시 알림이 전송됩니다</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-1.5">
                  {['화재', '추락', '협착', '기타'].map(type => (
                    <button 
                      key={type}
                      onClick={() => handleEmergencySOS(type)}
                      className="h-16 bg-muted rounded-xl flex flex-col items-center justify-center gap-0.5 font-black text-[11px] border border-border active:scale-95 transition-all hover:bg-muted/80"
                    >
                      <span className="text-lg mb-0.5">{type === '화재' ? '🔥' : type === '추락' ? '🧗' : type === '협착' ? '🏗️' : '🆘'}</span>
                      <span className="text-foreground">{type}</span>
                    </button>
                  ))}
                </div>
                <div className="p-3 pt-0">
                  <Button variant="ghost" className="w-full text-muted-foreground font-black text-xs h-8" onClick={() => setIsSOSDialogOpen(false)}>취소</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "w-8.5 h-8.5 text-muted-foreground hover:text-foreground transition-all rounded-lg relative z-10",
                  hasImportantNotice && location.pathname === '/' && "animate-glow-pulse bg-red-500/15 text-red-500 hover:bg-red-500/25 border border-red-500/30"
                )}
                onClick={() => navigate('/notifications')}
              >
                <Bell className={cn("w-4.5 h-4.5", hasImportantNotice && location.pathname === '/' && "scale-110")} />
              </Button>
              {unreadCount > 0 && (
                <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full border border-background flex items-center justify-center z-20">
                  <span className="text-[6px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-background relative overflow-x-hidden">
        {/* Dynamic background glass glowing nodes */}
        <div className="absolute top-8 left-8 w-64 h-64 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-[40%] -right-16 w-80 h-80 rounded-full bg-indigo-500/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-16 -left-12 w-72 h-72 rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
        
        <div className="w-full pb-16 relative z-10 animate-fade-in">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-card/85 backdrop-blur-xl border-t border-border/40 flex items-center justify-around px-4 pb-safe z-50 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        {navItems.map((item) => (
          <NavItem 
            key={item.to} 
            to={item.to} 
            icon={item.icon} 
            label={item.label} 
            active={location.pathname === item.to} 
          />
        ))}
      </nav>
      <CriticalIncidentAlertCenter />
    </div>
  );
};
