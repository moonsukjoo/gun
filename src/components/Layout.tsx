import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  Bell, 
  Users, 
  LogOut, 
  ShieldCheck,
  HardHat,
  Anchor,
  Circle,
  Settings,
  User,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/src/firebase';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { Notification, Role } from '@/src/types';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
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
      "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative",
      active 
        ? "text-primary" 
        : "text-slate-500 hover:text-slate-700"
    )}
  >
    <div className={cn(
      "p-1.5 rounded-xl transition-all duration-300",
      active && "bg-primary/10 shadow-inner"
    )}>
      <Icon className={cn("w-5 h-5 transition-transform duration-300", active && "scale-110")} />
    </div>
    <span className={cn(
      "text-[9px] font-black uppercase tracking-widest transition-all duration-300",
      active ? "opacity-100 translate-y-0" : "opacity-60 translate-y-0.5"
    )}>
      {label}
    </span>
    {active && (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_2px_10px_rgba(0,0,0,0.1)]" />
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
      // 1. Identify target users: Directors, Safety Managers, and current Dept Team Leaders
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

      if (targetUids.size === 0) {
        toast.error('주변에 알림을 받을 관리자가 없습니다.');
        setIsSOSLoading(false);
        return;
      }

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
          message: `${profile.displayName}님(${profile.workplace || '알수없음'})이 위급 상황(${type})을 보고했습니다. 즉시 확인 바랍니다!`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );

      await Promise.all(notificationPromises);
      setIsSOSDialogOpen(false);
      toast.error('긴급 SOS 전송 완료', {
        description: '안전한 곳으로 즉시 대피하십시오. 관리자가 확인 중입니다.',
        duration: 8000,
      });
    } catch (error) {
      console.error("SOS error:", error);
      toast.error('심각한 오류: SOS 전송에 실패했습니다.');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const canSeePersonnel = profile && (['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK'].includes(profile.role) || profile.permissions?.includes('employee_mgmt'));
  const isManager = profile && profile.role !== 'EMPLOYEE';
  const isAdmin = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '홈' },
    { to: '/attendance', icon: Clock, label: '근태' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: '관리' }] : []),
    { to: '/mypage', icon: User, label: '마이' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden font-sans text-foreground select-none">
      {/* Mobile Header */}
      <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-center flex-shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-sm w-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <HardHat className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base tracking-tighter leading-none text-slate-900">건명기업</span>
              <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] leading-none mt-0.5">Kunmyung Enterprise</span>
            </div>
          </div>

          <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
            <DialogTrigger render={
              <button className="flex flex-col items-center group active:scale-95 transition-all">
                <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  <ShieldAlert className="w-5 h-5 relative z-10" />
                </div>
                <span className="text-[7px] font-black text-red-600 uppercase tracking-tighter mt-0.5 animate-pulse">SOS</span>
              </button>
            } />
            <DialogContent className="bg-white border-none rounded-[2.5rem] shadow-2xl max-w-[320px] w-[90%] p-0 overflow-hidden">
              <div className="bg-red-600 p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-red-700/50 animate-pulse" />
                <ShieldAlert className="w-10 h-10 text-white mx-auto mb-2 relative z-10 animate-bounce" />
                <h2 className="text-xl font-black text-white tracking-tighter relative z-10">긴급 상황 선택</h2>
                <p className="text-red-100 font-bold text-[11px] relative z-10 leading-tight">유형 선택 시 즉시 관리자 알림</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2 bg-white">
                {[
                  { type: '추락', icon: '🧗', color: 'bg-orange-50 text-orange-600 border-orange-100' },
                  { type: '화재', icon: '🔥', color: 'bg-red-50 text-red-600 border-red-100' },
                  { type: '협착', icon: '🏗️', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                  { type: '기타 위급', icon: '🆘', color: 'bg-slate-50 text-slate-600 border-slate-100' }
                ].map((item) => (
                  <button
                    key={item.type}
                    disabled={isSOSLoading}
                    onClick={() => handleEmergencySOS(item.type)}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-3xl border transition-all active:scale-95 gap-1",
                      item.color,
                      isSOSLoading && "opacity-50 pointer-events-none"
                    )}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-black text-[13px]">{item.type}</span>
                  </button>
                ))}
              </div>
              <DialogFooter className="p-3 pt-0 bg-white">
                <DialogTrigger render={
                  <Button variant="ghost" className="w-full h-10 rounded-xl text-slate-400 font-black text-[10px] uppercase tracking-widest">
                    취소
                  </Button>
                } />
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-10 h-10 text-slate-300 hover:text-primary hover:bg-slate-50 transition-all rounded-xl"
                onClick={() => navigate('/notifications')}
              >
                <Bell className="w-5 h-5" />
              </Button>
              {unreadCount > 0 && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-[8px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-[9px] font-black text-primary uppercase tracking-widest leading-none mb-1">
                {profile?.position || '사원'}
              </div>
              <div className="text-sm font-black text-slate-900 leading-none tracking-tight">
                {profile?.displayName}
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 text-slate-300 hover:text-primary hover:bg-slate-50 transition-all rounded-xl" 
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 bg-[#F8FAFC]">
        <div className="w-full max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 glass flex items-center justify-around px-2 pb-safe z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
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
