import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  CalendarDays, 
  Trophy, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Lock,
  ClipboardList,
  Smartphone,
  RefreshCw,
  Eye,
  Check,
  BookOpen,
  AlertCircle,
  LogOut,
  Wallet,
  Ticket,
  Bell,
  Navigation,
  Activity,
  FileText,
  Sun,
  Moon,
  Info,
  Users,
  Utensils,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { TrainingResult } from '@/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { PinKeypad } from '@/components/PinKeypad';
import { requestNotificationPermission } from '@/services/notificationService';

export const MyPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reAuthPin, setReAuthPin] = useState('');
  const [isReAuthPending, setIsReAuthPending] = useState(false);
  const [examHistory, setExamHistory] = useState<TrainingResult[]>([]);
  const [allResults, setAllResults] = useState<TrainingResult[]>([]);
  const [isExamHistoryOpen, setIsExamHistoryOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [evacuationStatus, setEvacuationStatus] = useState<any>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  React.useEffect(() => {
    if (!profile) return;
    const unsubStatus = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEvacuationStatus(data);
        if (data.isActive) {
          const checkinRef = doc(db, 'evacuations', data.id, 'checkins', profile.uid);
          const unsubscribeCheckin = onSnapshot(checkinRef, (checkSnap) => {
            setHasConfirmed(checkSnap.exists());
          }, (error) => handleFirestoreError(error, OperationType.GET, `evacuations/${data.id}/checkins/${profile.uid}`));
          return () => unsubscribeCheckin();
        }
      } else {
        setEvacuationStatus(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'evacuation/status'));
    return () => unsubStatus();
  }, [profile]);

  const checkPermission = async () => {
    const capacitor = (window as any).Capacitor;
    const isNative = !!(capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform());
    
    if (isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const status = await LocalNotifications.checkPermissions();
        setNotificationPermission(status.display);
      } catch (e: any) {
        if (e?.message !== 'Notifications not supported in this browser.') {
          console.warn('Native permission check failed:', e);
        }
        setNotificationPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
      }
    } else {
      setNotificationPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    }
  };

  React.useEffect(() => {
    checkPermission();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    await checkPermission();
    
    if (granted) {
      toast.success('알림이 허용되었습니다.');
    } else {
      const capacitor = (window as any).Capacitor;
      const isNative = capacitor !== undefined && capacitor.isNativePlatform?.();
      const isAdminApp = isNative || window.location.protocol === 'capacitor:' || /Android/i.test(navigator.userAgent);
      
      if (isAdminApp) {
        toast.error('기기 알람 권한이 필요합니다.', {
          description: '핸드폰의 [설정 > 애플리케이션 > 건명 > 알림]에서 "알림 허용"을 활성화해 주세요.',
          duration: 6000
        });
      } else {
        toast.error('알림 권한이 거부되었습니다.', {
          description: '브라우저 주소창 옆의 자물쇠 아이콘을 눌러 알림 권한을 허용해 주세요.',
        });
      }
    }
  };

  React.useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'trainingResults'), 
      where('uid', '==', profile.uid),
      orderBy('completedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setExamHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'trainingResults_history'));
    return () => unsubscribe();
  }, [profile]);

  React.useEffect(() => {
    const q = query(
      collection(db, 'trainingResults'), 
      orderBy('score', 'desc'),
      orderBy('completedAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'trainingResults_all'));
    return () => unsubscribe();
  }, []);

  const getRanking = (resId: string, trainingId: string) => {
    const trainingResults = allResults.filter(r => r.trainingId === trainingId);
    const total = trainingResults.length;
    if (total === 0) return '- / -등';
    const rank = trainingResults.findIndex(r => r.id === resId) + 1;
    return `${rank} / ${total}등`;
  };

  const handleUpdatePin = async (finalPin: string) => {
    if (!auth.currentUser || !profile) return;
    setIsUpdating(true);
    try {
      await updatePassword(auth.currentUser, finalPin);
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCustomPin: true,
        lastPinChange: new Date().toISOString()
      });
      toast.success('비밀번호 등록 완료');
      setIsPinModalOpen(false);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setIsReAuthPending(true);
        setPinStep(1);
        toast.info('보안을 위해 한 번 더 입력해주세요.');
      } else {
        toast.error('오류가 발생했습니다.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReAuth = async (currentPin: string) => {
    if (!auth.currentUser || !profile) return;
    setIsUpdating(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, auth.currentUser.email!, currentPin);
      setIsReAuthPending(false);
      setReAuthPin('');
      toast.success('본인 확인 완료');
    } catch (error: any) {
      toast.error('일치하지 않습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (isReAuthPending) {
      const val = reAuthPin + digit;
      setReAuthPin(val);
      if (val.length === 6) handleReAuth(val);
      return;
    }
    if (pinStep === 1) {
      const val = newPin + digit;
      setNewPin(val);
      if (val.length === 6) setTimeout(() => setPinStep(2), 300);
    } else {
      const val = confirmPin + digit;
      setConfirmPin(val);
      if (val.length === 6) {
        if (val === newPin) handleUpdatePin(val);
        else {
          toast.error('일치하지 않습니다.');
          setPinStep(1); setNewPin(''); setConfirmPin('');
        }
      }
    }
  };

  const toggleElderlyMode = async () => {
    if (!profile) return;
    try {
      const newValue = !profile.elderlyMode;
      await updateDoc(doc(db, 'users', profile.uid), { elderlyMode: newValue });
      toast.success(newValue ? '어르신 모드 ON' : '어르신 모드 OFF');
    } catch (error) {
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const handleCalibrateAltitude = async () => {
    if (!profile) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        basePressure: null,
        currentAltitude: 0
      });
      toast.success('고도가 초기화되었습니다.', {
        description: '현재 위치가 지면(0m)으로 설정됩니다.'
      });
    } catch (e) {
      toast.error('초기화 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleTheme = async () => {
    if (!profile) return;
    try {
      const newValue = !profile.lightTheme;
      await updateDoc(doc(db, 'users', profile.uid), { lightTheme: newValue });
      toast.success(newValue ? '밝은 테마가 적용되었습니다.' : '어두운 테마가 적용되었습니다.');
    } catch (error) {
      toast.error('변경 실패');
    }
  };

  const handleToggleGhostGuard = async () => {
    if (!profile) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ghostGuardEnabled: !profile.ghostGuardEnabled
      });
      toast.success(profile.ghostGuardEnabled ? '유령 가드가 비활성화되었습니다.' : '유령 가드가 활성화되었습니다.');
    } catch (e) {
      toast.error('변경 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const categories = [
    {
      title: '안전 및 업무',
      items: [
        { label: '작업지시서 작성', icon: ClipboardList, to: '/work-instruction', color: 'text-blue-600', bgColor: 'bg-blue-500/10', roles: ['TEAM_LEADER', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'CEO'] },
        { label: '근태관리', icon: Navigation, to: '/attendance', color: 'text-indigo-600', bgColor: 'bg-indigo-500/10' },
        { label: '안전 보건 교육', icon: BookOpen, to: '/training', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
        { label: '교육 이수증', icon: Trophy, onClick: () => setIsExamHistoryOpen(true), color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
      ]
    },
    {
      title: '인사 및 복리후생',
      items: [
        { label: '연차 신청/내역', icon: CalendarDays, to: '/leave', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
        { label: '월급 명세서', icon: FileText, to: '/mypage/payslip', color: 'text-rose-600', bgColor: 'bg-rose-500/10' },
        { label: '현물 보상 신청', icon: Wallet, to: '/redemption', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
        { label: '포상 및 칭찬', icon: ShieldCheck, to: '/praise', color: 'text-pink-600', bgColor: 'bg-pink-500/10' },
      ]
    },
    {
      title: '시스템 및 편의',
      items: [
        { label: '공지사항', icon: Bell, to: '/notices', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
        { label: '로또 생성기', icon: Ticket, to: '/lotto', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
        { label: '엔터놀이', icon: Sparkles, to: '/entertainment', color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
      ]
    }
  ];

  const adminMenu = {
    title: '관리자 전용 메뉴',
    items: [
      { label: '임직원 정보 관리', icon: Users, to: '/personnel', color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
      { label: '임직원 근태 현황', icon: Navigation, to: '/attendance-mgmt', color: 'text-indigo-600', bgColor: 'bg-indigo-500/10' },
      { label: '연차 신청 승인/조회', icon: CalendarDays, to: '/leave-mgmt', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
      { label: '포상 및 쿠폰 지급', icon: Wallet, to: '/redemption-mgmt', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
      { label: '고소작업 통합 모니터링', icon: Activity, to: '/high-work-monitor', color: 'text-rose-600', bgColor: 'bg-rose-500/10' },
      { label: '식사·간식 신청 관리', icon: Utensils, to: '/meal-mgmt', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
      { label: '안전 보건 교육 관리', icon: BookOpen, to: '/training-mgmt', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
      { label: '작업지시 관리', icon: ClipboardList, to: '/work-instruction-mgmt', color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
      { label: '고급 관리자 설정', icon: Lock, to: '/admin', color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    ]
  };

  return (
    <div className="w-full space-y-7 pb-32 px-4 overflow-x-hidden bg-background">
      {/* 1. Cohesive Header */}
      <header className="pt-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black tracking-widest text-primary/83 uppercase">KM HRM SYSTEM</p>
            </div>
            <h1 className="text-[20px] xs:text-[22px] font-black text-foreground tracking-tight leading-tight">
              마이 페이지
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 bg-card border border-border/40 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/10 transition-all active:scale-90 cursor-pointer"
              title={profile?.lightTheme ? "어두운 모드로 변경" : "밝은 모드로 변경"}
            >
              {profile?.lightTheme ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-card border border-border/40 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/10 transition-all active:scale-90 cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Status Alert Card */}
      {evacuationStatus?.isActive && (
        <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           className={cn(
             "p-4 rounded-3xl border flex items-center gap-4 shadow-xl mb-2",
             hasConfirmed 
               ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-500" 
               : "bg-rose-600/10 border-rose-600/20 text-rose-500"
           )}
        >
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
            hasConfirmed ? "bg-emerald-600/20" : "bg-rose-600/20 animate-pulse"
          )}>
            {hasConfirmed ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black truncate">{hasConfirmed ? '대피 완료 (안전)' : '즉시 대피 요망!'}</p>
            <p className="text-[10px] font-bold opacity-60 truncate">{evacuationStatus.reason || '비상 상황 소집령'}</p>
          </div>
          {!hasConfirmed && (
            <Button size="sm" className="bg-rose-600 text-white rounded-xl h-8 px-4 text-[10px] font-black shrink-0 cursor-pointer" onClick={() => toast.info('서명해주세요!')}>
              확인
            </Button>
          )}
        </motion.div>
      )}

      {/* 2. Compact Profile Section */}
      <div className="grid grid-cols-5 gap-3.5">
        <Card className="col-span-3 border border-border/40 bg-card rounded-3xl relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center text-xl font-black text-primary shadow-sm rotate-3 group-hover:rotate-0 transition-transform">
                {profile?.displayName?.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-card flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="min-w-0 w-full px-2">
              <h3 className="text-base font-black text-foreground truncate">{profile?.displayName}</h3>
              <div className="flex flex-col items-center gap-1.5 mt-2">
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-[9px] font-black px-2 py-0.5 rounded text-primary">
                  {profile?.role === 'CEO' ? '대표' : 
                   profile?.role === 'DIRECTOR' ? '직장' :
                   profile?.role === 'GENERAL_MANAGER' ? '부장' :
                   profile?.role === 'SAFETY_MANAGER' ? '안전관리자' :
                   profile?.role === 'TEAM_LEADER' ? '팀장' :
                   profile?.role === 'GROUP_LEADER' ? '조장' :
                   profile?.role === 'EMPLOYEE' ? '사원' : profile?.role || '사원'}
                </Badge>
                {profile?.position && profile.role !== 'CEO' && (
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight truncate w-full block">
                    {profile.position.replace('대표이사 사무실', '').trim()}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-2 flex flex-col gap-3">
          <Card className="flex-1 border border-border/40 bg-card p-3.5 flex flex-col justify-center items-center gap-1.5 group shadow-sm rounded-3xl">
             <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform shrink-0">
               <Wallet className="w-4.5 h-4.5" />
             </div>
             <div className="text-center">
               <p className="text-sm font-black text-foreground">{(profile?.points || 0).toLocaleString()}</p>
               <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">포인트</p>
             </div>
          </Card>
          <Card className="flex-1 border border-border/40 bg-card p-3.5 flex flex-col justify-center items-center gap-1.5 group shadow-sm rounded-3xl">
             <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform shrink-0">
               <CalendarDays className="w-4.5 h-4.5" />
             </div>
             <div className="text-center">
               <p className="text-sm font-black text-foreground">{profile?.annualLeaveBalance || 0}일</p>
               <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">연차잔여</p>
             </div>
          </Card>
        </div>
      </div>

      {/* 3. Reorganized Categorized Menu */}
      <div className="space-y-6">
        {categories.map((category, idx) => (
          <div key={idx} className="space-y-3.5">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                {category.title}
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {category.items.filter(item => !item.roles || item.roles.includes(profile?.role)).map((item, i) => (
                <button 
                  key={i} 
                  onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
                  className="flex items-center gap-3.5 p-3.5 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted active:scale-95 shadow-sm group cursor-pointer"
                >
                  <div className={cn("w-9 h-9 border rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-all shrink-0", item.bgColor, "border-border/5")}>
                    <item.icon className={cn("w-4 h-4", item.color)} />
                  </div>
                  <span className="text-[11px] font-black text-foreground tracking-tight leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Admin Menu Section */}
        {profile && ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER', 'TEAM_LEADER', 'GENERAL_AFFAIRS'].includes(profile.role) && (
          <div className="space-y-4 bg-muted/40 p-4 rounded-3xl border border-border/30">
            <div className="flex items-center gap-2 px-1">
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <h4 className="text-[11px] font-black text-rose-500 uppercase tracking-[0.2em]">
                {adminMenu.title}
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {adminMenu.items.map((item, i) => (
                <button 
                  key={i} 
                  onClick={() => navigate(item.to!)}
                  className="flex items-center justify-between p-4 bg-card border border-border/40 rounded-2xl text-left hover:bg-muted transition-all active:scale-98 shadow-sm group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 border rounded-xl flex items-center justify-center shadow-inner", item.bgColor, "border-border/5")}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <span className="text-[12px] font-black text-foreground">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. System Settings - Compact Grid */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
          <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
            기기 및 시스템 제어
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-4">
          <button 
            onClick={toggleElderlyMode}
            className={cn(
              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group cursor-pointer",
              profile?.elderlyMode ? "bg-blue-600/10 border-blue-500/30 shadow-sm shadow-blue-500/5 animate-pulse" : "bg-card border-border/40 hover:bg-muted"
            )}
          >
            <div className={cn("w-9 h-9 border rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0", profile?.elderlyMode ? "bg-blue-500 text-white border-blue-500" : "bg-muted text-muted-foreground border-border/5")}>
              <Eye className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black text-foreground">어르신 모드</p>
              <p className={cn("text-[8px] font-black uppercase tracking-widest mt-0.5", profile?.elderlyMode ? "text-blue-400" : "text-muted-foreground/80")}>{profile?.elderlyMode ? '운영 중' : '중지됨'}</p>
            </div>
          </button>

          <button 
            onClick={handleRequestPermission}
            className={cn(
              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group cursor-pointer",
              notificationPermission === 'granted' ? "bg-emerald-600/10 border-emerald-500/30 shadow-sm shadow-emerald-500/5" : "bg-card border-border/40 hover:bg-muted shadow-inner"
            )}
          >
            <div className={cn("w-9 h-9 border rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0", notificationPermission === 'granted' ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted text-muted-foreground border-border/5")}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black text-foreground">기기 알림</p>
              <p className={cn("text-[8px] font-black uppercase tracking-widest mt-0.5", notificationPermission === 'granted' ? "text-emerald-400" : "text-muted-foreground/80")}>{notificationPermission === 'granted' ? '허용됨' : '차단됨'}</p>
            </div>
          </button>

          <button 
            onClick={handleToggleGhostGuard}
            className={cn(
              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group cursor-pointer",
              profile?.ghostGuardEnabled ? "bg-rose-600/10 border-rose-500/30 shadow-sm shadow-rose-500/5" : "bg-card border-border/40 hover:bg-muted shadow-inner"
            )}
          >
            <div className={cn("w-9 h-9 border rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0", profile?.ghostGuardEnabled ? "bg-rose-500 text-white border-rose-500" : "bg-muted text-muted-foreground border-border/5")}>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black text-foreground">유령 가드</p>
              <p className={cn("text-[8px] font-black uppercase tracking-widest mt-0.5", profile?.ghostGuardEnabled ? "text-rose-400" : "text-muted-foreground/80")}>{profile?.ghostGuardEnabled ? '작동 중' : '비활성'}</p>
            </div>
          </button>

          <button 
            onClick={handleCalibrateAltitude}
            className="p-4 rounded-2xl border bg-card border-border/40 transition-all flex flex-col items-center gap-2 group hover:bg-muted shadow-inner cursor-pointer"
          >
            <div className="w-9 h-9 border rounded-xl bg-muted border-border/5 flex items-center justify-center text-muted-foreground transition-transform group-hover:scale-105 shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black text-foreground">고도 영점</p>
              <p className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded-full mt-1.5 font-mono">{(profile?.currentAltitude || 0).toFixed(1)}M 기준</p>
            </div>
          </button>
        </div>

        {/* Altitude Sensor Info Card */}
        <Card className="bg-primary/[0.04] border border-primary/15 rounded-3xl p-4 mt-2 shadow-sm">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 shadow-inner">
              <Info className="w-4.5 h-4.5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-[11px] font-black text-foreground">기압계 센서 안내</h5>
              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                고소작업 모니터링은 기압계 센서를 사용합니다. 아이폰(iOS)은 [설정 {'>'} Safari {'>'} 동작 및 방향 접근]을 활성화해야 하며, 안드로이드는 브라우저 센서 권한이 필요합니다. 센서가 없는 기기는 고도 측정이 불가능합니다.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-0 overflow-hidden max-w-sm">
           <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                 <Smartphone className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                 <DialogTitle className="text-xl font-black">
                   {isReAuthPending ? '본인 확인' : (pinStep === 1 ? '비밀번호 설정' : '비밀번호 확인')}
                 </DialogTitle>
                 <DialogDescription className="text-muted-foreground text-xs font-bold">
                    6자리 숫자를 입력해주세요
                 </DialogDescription>
              </div>
              <div className="flex gap-3">
                 {[...Array(6)].map((_, i) => {
                   const len = isReAuthPending ? reAuthPin.length : (pinStep === 1 ? newPin.length : confirmPin.length);
                   return <div key={i} className={cn("w-3 h-3 rounded-full border-2", len > i ? "bg-primary border-primary shadow-[0_0_10px_rgba(49,130,246,0.5)]" : "bg-muted border-border")} />;
                 })}
              </div>
           </div>
           <PinKeypad 
             onInput={handlePinInput} 
             onDelete={() => {
                if (isReAuthPending) setReAuthPin(p => p.slice(0, -1));
                else if (pinStep === 1) setNewPin(p => p.slice(0, -1));
                else setConfirmPin(p => p.slice(0, -1));
             }} 
             onClear={() => {
                if (isReAuthPending) setReAuthPin("");
                else if (pinStep === 1) setNewPin("");
                else setConfirmPin("");
             }}
             passwordLength={isReAuthPending ? reAuthPin.length : (pinStep === 1 ? newPin.length : confirmPin.length)}
             onBack={() => setIsPinModalOpen(false)}
             onOtherMethod={() => setIsPinModalOpen(false)}
             className={cn(!isPinModalOpen && "hidden")}
           />
        </DialogContent>
      </Dialog>

      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground p-0 overflow-hidden max-w-lg">
           <DialogHeader className="p-8 pb-4 border-b border-border">
              <DialogTitle className="text-xl font-black">교육 이수 내역</DialogTitle>
           </DialogHeader>
           <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
              {examHistory.map((res) => (
                <div key={res.id} className="bg-muted p-4 rounded-2xl flex items-center justify-between border border-border">
                   <div className="min-w-0">
                      <h4 className="text-sm font-black text-foreground truncate">{res.trainingTitle}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(res.completedAt), 'yyyy.MM.dd')}</p>
                        <span className="text-[10px] text-primary font-black">{res.score}점</span>
                        <span className="text-[10px] text-muted-foreground/40 font-bold">{getRanking(res.id, res.trainingId)}</span>
                      </div>
                   </div>
                   <Badge className={cn("rounded-lg font-black text-[10px] shrink-0", res.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                      {res.isPassed ? '합격' : '과락'}
                   </Badge>
                </div>
              ))}
              {examHistory.length === 0 && (
                <div className="py-20 text-center opacity-20">
                   <p className="text-xs font-black text-muted-foreground">이력 없습니다</p>
                </div>
              )}
           </div>
           <div className="p-6 border-t border-border">
              <Button className="w-full h-14 bg-muted text-foreground font-black rounded-2xl hover:bg-muted/80" onClick={() => setIsExamHistoryOpen(false)}>닫기</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
