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
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/src/firebase';
import { cn } from '@/lib/utils';
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
      "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-300 relative",
      active ? "text-white" : "text-muted-foreground hover:text-white"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-all", active && "scale-110")} />
    <span className={cn(
      "text-[10px] font-bold tracking-tight transition-all",
      active ? "opacity-100" : "opacity-40"
    )}>
      {label}
    </span>
    {active && (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
    )}
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSOSDialogOpen, setIsSOSDialogOpen] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', profile.uid),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [profile]);

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

      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `🚨 [긴급 SOS] ${type} 발생!`,
          message: `${profile.displayName}님이 위급 상황(${type})을 보고했습니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString()
        })
      );

      await Promise.all(notificationPromises);
      setIsSOSDialogOpen(false);
      toast.error('긴급 SOS 전송 완료');
    } catch (error) {
      toast.error('SOS 전송 실패');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const isAdmin = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '홈' },
    { to: '/attendance', icon: Clock, label: '근태' },
    isAdmin 
      ? { to: '/admin', icon: Settings, label: '관리' } 
      : { to: '/personnel', icon: Users, label: '직원' },
    { to: '/mypage', icon: User, label: '마이' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#121212] font-sans text-white select-none">
      <header className="h-16 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-center flex-shrink-0 sticky top-0 z-50">
        <div className="max-w-4xl w-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {location.pathname !== '/' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="w-10 h-10 -ml-2 text-muted-foreground hover:text-white transition-all rounded-xl"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg p-1.5 active:scale-95 transition-all">
                <img src="/company_logo.png" alt="Kunmyung Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight leading-none text-white">건명기업</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
              <DialogTrigger 
                className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all shadow-lg shadow-red-900/20"
              >
                <ShieldAlert className="w-5 h-5" />
              </DialogTrigger>
              <DialogContent className="bg-card border-none rounded-3xl p-0 overflow-hidden max-w-xs">
                <div className="bg-red-600 p-6 text-center text-white">
                  <h2 className="text-xl font-black">긴급 상황 전송</h2>
                  <p className="text-[10px] font-bold opacity-80">유형을 선택하면 관리자에게 즉시 알림이 전송됩니다</p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                  {['화재', '추락', '협착', '기타'].map(type => (
                    <button 
                      key={type}
                      onClick={() => handleEmergencySOS(type)}
                      className="h-20 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-xs border border-white/5 active:scale-95 transition-all"
                    >
                      {type === '화재' ? '🔥' : type === '추락' ? '🧗' : type === '협착' ? '🏗️' : '🆘'}
                      <span className="text-muted-foreground">{type}</span>
                    </button>
                  ))}
                </div>
                <div className="p-4 pt-0">
                  <Button variant="ghost" className="w-full text-muted-foreground font-black text-xs" onClick={() => setIsSOSDialogOpen(false)}>취소</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-10 h-10 text-muted-foreground hover:text-white transition-all rounded-xl"
                onClick={() => navigate('/notifications')}
              >
                <Bell className="w-5 h-5" />
              </Button>
              {unreadCount > 0 && (
                <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#121212] flex items-center justify-center">
                  <span className="text-[7px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-[#121212]">
        <div className="w-full max-w-4xl mx-auto px-4 pb-24">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#121212]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 pb-safe z-50">
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
    </div>
  );
};
