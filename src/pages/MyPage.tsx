import React, { useState } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
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
  Smartphone,
  RefreshCw,
  Eye,
  Check,
  BookOpen,
  AlertCircle,
  LogOut,
  Wallet,
  Ticket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { updatePassword, signOut } from 'firebase/auth';
import { auth, db } from '@/src/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { TrainingResult } from '@/src/types';
import { format } from 'date-fns';
import { PinKeypad } from '@/src/components/PinKeypad';

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
  const [isExamHistoryOpen, setIsExamHistoryOpen] = useState(false);

  React.useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'trainingResults'), 
      where('uid', '==', profile.uid),
      orderBy('completedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setExamHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResult)));
    });
    return () => unsubscribe();
  }, [profile]);

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

  const menuItems = [
    { label: '연차 내역', icon: CalendarDays, to: '/leave', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: '현물 신청', icon: Wallet, to: '/redemption', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
    { label: '엔터놀이터', icon: Trophy, to: '/entertainment', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: '로또 번호 생성기', icon: Ticket, to: '/lotto', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: '교육 이수증', icon: BookOpen, onClick: () => setIsExamHistoryOpen(true), color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: '간편 비밀번호', icon: Lock, onClick: () => setIsPinModalOpen(true), color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex items-end justify-between">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-white leading-tight">마이 페이지</h2>
           <p className="text-muted-foreground font-bold">나의 정보를 관리하세요</p>
        </div>
        <Button variant="ghost" className="text-muted-foreground hover:text-red-500" onClick={handleLogout}>
          <LogOut className="w-5 h-5 mr-2" /> 로그아웃
        </Button>
      </header>

      {/* Profile Card */}
      <Card className="border-none shadow-none bg-card rounded-2xl overflow-hidden border border-white/5">
        <CardContent className="p-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-3xl font-black text-white border border-white/10">
              {profile?.displayName?.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full border-4 border-[#121212] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-black text-white tracking-tight">{profile?.displayName}</h3>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-primary/20 text-primary border-none rounded-lg px-2 h-6 font-black text-[10px]">
                {profile?.position || '사원'}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Building2 className="w-3 h-3" />
                {profile?.departmentName || '부서미지정'}
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">나의 포인트</p>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center gap-1 text-primary">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xl font-black">{(profile?.points || 0).toLocaleString()}</span>
                 </div>
               </div>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">잔여 연차</p>
               <p className="text-xl font-black text-white">{profile?.annualLeaveBalance || 0}일</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu List */}
      <div className="space-y-2">
        {menuItems.map((item, idx) => (
          <div 
            key={idx} 
            className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => item.onClick ? item.onClick() : navigate(item.to!)}
          >
            <div className="flex items-center gap-4">
               <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bgColor)}>
                 <item.icon className={cn("w-5 h-5", item.color)} />
               </div>
               <span className="text-base font-black text-white">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/10" />
          </div>
        ))}
      </div>

      {/* Settings section */}
      <div className="pt-4">
        <div 
          className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer"
          onClick={toggleElderlyMode}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-muted-foreground">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">어르신 모드</p>
              <p className="text-[10px] text-muted-foreground font-bold">글씨를 크게 봅니다</p>
            </div>
          </div>
          <div className={cn("w-10 h-5 rounded-full transition-colors p-1", profile?.elderlyMode ? "bg-primary" : "bg-white/10")}>
            <div className={cn("w-3 h-3 bg-white rounded-full transition-transform", profile?.elderlyMode ? "translate-x-5" : "translate-x-0")} />
          </div>
        </div>
      </div>

      {/* PIN Dialog */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-sm">
           <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary">
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
                   return <div key={i} className={cn("w-3 h-3 rounded-full border-2", len > i ? "bg-primary border-primary shadow-[0_0_10px_rgba(0,122,255,0.5)]" : "bg-white/5 border-white/10")} />;
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
             className="bg-white/[0.02]" 
           />
        </DialogContent>
      </Dialog>

      {/* Education Histroy Dialog */}
      <Dialog open={isExamHistoryOpen} onOpenChange={setIsExamHistoryOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white p-0 overflow-hidden max-w-lg">
           <DialogHeader className="p-8 pb-4">
              <DialogTitle className="text-xl font-black">교육 이수 내역</DialogTitle>
           </DialogHeader>
           <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
              {examHistory.map((res) => (
                <div key={res.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                   <div>
                      <h4 className="text-sm font-black text-white">{res.trainingTitle}</h4>
                      <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(res.completedAt), 'yyyy.MM.dd')}</p>
                   </div>
                   <Badge className={cn("rounded-lg font-black text-[10px]", res.isPassed ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}>
                      {res.isPassed ? '합격' : '과락'}
                   </Badge>
                </div>
              ))}
              {examHistory.length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <p className="text-xs font-black">이력 없습니다</p>
                </div>
              )}
           </div>
           <div className="p-6">
              <Button className="w-full h-14 bg-white/5 text-white font-black rounded-2xl" onClick={() => setIsExamHistoryOpen(false)}>닫기</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
